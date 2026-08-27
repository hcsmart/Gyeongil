-- ============================================================
-- GI MES : 연마 / 교체 주기 관리 (BASE)
--   · 공통 주기기준 (ki_tool_rule)
--   · 금형별 개별 주기 (ki_mold_tool)
--   · 도래 판정 뷰   (ki_v_tool_due)
--   · 안돈 / ntfy 알림 (ki_tool_alert, ki_notify_config)
--   ※ 재실행 안전 (DROP CASCADE → CREATE)
-- ============================================================

-- ------------------------------------------------------------
-- 1) 테이블
-- ------------------------------------------------------------

/* 공통 주기기준 — target='ALL' 전체적용 / 금형종류 지정 시 우선적용 */
create table if not exists public.ki_tool_rule (
  rule_id     text primary key,
  kind        text not null,                 -- 연마 / 교체
  target      text not null default 'ALL',   -- ALL 또는 금형종류(mold_type)
  part_name   text default '공통',           -- 펀치 / 다이 / 스트리퍼 …
  limit_shot  numeric,                       -- 타발수 한도
  cycle_days  integer,                       -- 기간(일)
  warn_pct    numeric default 90,            -- 임박 경보 기준(%)
  label       text,
  sort_order  integer default 0,
  is_active   boolean default true,
  remark      text,
  updated_at  timestamptz default now());

/* 금형별 개별 주기 — use_common=true 이면 공통기준 적용 */
create table if not exists public.ki_mold_tool (
  mold_code   text not null,
  kind        text not null,                 -- 연마 / 교체
  part_name   text default '공통',
  use_common  boolean default true,
  limit_shot  numeric,
  cycle_days  integer,
  warn_pct    numeric,
  last_date   date,                          -- 최근 실시일
  last_shot   numeric,                       -- 최근 실시 시점 누적 타발수
  is_active   boolean default true,
  remark      text,
  updated_at  timestamptz default now(),
  primary key (mold_code, kind));

/* 안돈 · ntfy 알림 이력 */
create table if not exists public.ki_tool_alert (
  alert_id    bigserial primary key,
  occurred_at timestamptz default now(),
  mold_code   text,
  kind        text,                          -- 연마 / 교체
  part_name   text,
  level       text default '도래',           -- 임박 / 도래
  reason      text,                          -- 타발수 / 기간
  shot_count  numeric,
  limit_shot  numeric,
  used_shot   numeric,
  days_left   integer,
  message     text,
  status      text default '발생',           -- 발생 / 조치중 / 해제
  notified    boolean default false,         -- ntfy 발송 여부
  notified_at timestamptz,
  action      text,
  closed_at   timestamptz,
  closed_by   text);

create index if not exists ki_tool_alert_idx
  on public.ki_tool_alert(status, occurred_at desc);
create unique index if not exists ki_tool_alert_open_uidx
  on public.ki_tool_alert(mold_code, kind, part_name, level)
  where status <> '해제';

/* 알림 설정 (단일행) */
create table if not exists public.ki_notify_config (
  id            integer primary key default 1,
  andon_enabled boolean default true,        -- 화면 안돈 표시
  ntfy_enabled  boolean default false,       -- ntfy 발송
  ntfy_url      text default 'https://ntfy.sh',
  ntfy_topic    text,
  ntfy_priority integer default 4,
  alert_level   text default '도래',         -- 도래 / 임박+도래
  poll_sec      integer default 60,          -- 감시 주기(초)
  updated_at    timestamptz default now(),
  updated_by    text,
  constraint ki_notify_config_one check (id = 1));

insert into public.ki_notify_config(id) values (1) on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 2) 뷰  (★ create or replace 금지 — 항상 DROP CASCADE 후 CREATE)
-- ------------------------------------------------------------
drop view if exists public.ki_v_tool_rule  cascade;
drop view if exists public.ki_v_mold_tool  cascade;
drop view if exists public.ki_v_tool_due   cascade;
drop view if exists public.ki_v_tool_alert cascade;

create view public.ki_v_tool_rule with (security_invoker=true) as
select rule_id, kind, target, part_name, limit_shot, cycle_days, warn_pct,
       label, sort_order, is_active, remark, updated_at
from public.ki_tool_rule;

create view public.ki_v_mold_tool with (security_invoker=true) as
select t.mold_code, m.mold_name, m.customer_name, m.mold_type, m.grade,
       coalesce(m.shot_count,0) as shot_count,
       t.kind, t.part_name, t.use_common,
       t.limit_shot, t.cycle_days, t.warn_pct,
       t.last_date, t.last_shot, t.is_active, t.remark, t.updated_at
from public.ki_mold_tool t
left join public.ki_mold m on m.mold_code = t.mold_code;

/* 도래 판정 : 금형 × (연마·교체) — 개별설정 없으면 공통기준 적용 */
create view public.ki_v_tool_due with (security_invoker=true) as
with kk(kind) as (values ('연마'),('교체')),
mk as (
  select m.mold_code, m.mold_name, m.customer_name, m.mold_type, m.grade,
         m.machine_no, m.factory_code, m.location,
         coalesce(m.shot_count,0) as shot_count, k.kind
  from public.ki_mold m cross join kk k
),
mix as (
  select mk.mold_code, mk.mold_name, mk.customer_name, mk.mold_type, mk.grade,
         mk.machine_no, mk.factory_code, mk.location, mk.shot_count, mk.kind,
         coalesce(t.part_name,'공통')  as part_name,
         coalesce(t.use_common,true)   as use_common,
         t.limit_shot as i_limit, t.cycle_days as i_days, t.warn_pct as i_warn,
         t.last_date, t.last_shot
  from mk
  left join public.ki_mold_tool t
    on t.mold_code = mk.mold_code and t.kind = mk.kind and coalesce(t.is_active,true)
),
res as (
  select x.*,
         case when x.use_common then r.limit_shot else coalesce(x.i_limit, r.limit_shot) end as limit_shot,
         case when x.use_common then r.cycle_days else coalesce(x.i_days,  r.cycle_days) end as cycle_days,
         coalesce(case when x.use_common then r.warn_pct
                       else coalesce(x.i_warn, r.warn_pct) end, 90) as warn_pct,
         case when x.use_common then '공통' else '개별' end as rule_src,
         r.rule_id, r.label as rule_label
  from mix x
  left join lateral (
    select r2.* from public.ki_tool_rule r2
     where r2.kind = x.kind and coalesce(r2.is_active,true)
       and (r2.target = x.mold_type or r2.target = 'ALL')
     order by case when r2.target = x.mold_type then 0 else 1 end, r2.sort_order
     limit 1) r on true
),
calc as (
  select res.*,
         greatest(res.shot_count - coalesce(res.last_shot,0),0) as used_shot,
         case when coalesce(res.limit_shot,0) > 0
              then round(greatest(res.shot_count - coalesce(res.last_shot,0),0)::numeric
                         / res.limit_shot * 100, 1) end as shot_pct,
         case when res.cycle_days is not null and res.last_date is not null
              then res.last_date + res.cycle_days end as due_date
  from res
)
select mold_code, mold_name, customer_name, mold_type, grade,
       machine_no, factory_code, location,
       kind, part_name, rule_src, rule_id, rule_label,
       shot_count, limit_shot, cycle_days, warn_pct, last_date, last_shot,
       used_shot,
       case when coalesce(limit_shot,0) > 0 then greatest(limit_shot - used_shot,0) end as left_shot,
       shot_pct, due_date,
       case when due_date is not null then due_date - current_date end as d_day,
       case when limit_shot is null and cycle_days is null then '미설정'
            when coalesce(shot_pct,0) >= 100
              or (due_date is not null and due_date <= current_date) then '도래'
            when coalesce(shot_pct,0) >= warn_pct
              or (due_date is not null and due_date - current_date <= 7) then '임박'
            else '정상' end as due_status,
       case when coalesce(shot_pct,0) >= 100 then '타발수'
            when due_date is not null and due_date <= current_date then '기간'
            when coalesce(shot_pct,0) >= warn_pct then '타발수'
            when due_date is not null and due_date - current_date <= 7 then '기간'
            else null end as reason
from calc;

create view public.ki_v_tool_alert with (security_invoker=true) as
select a.alert_id, a.occurred_at, a.mold_code, m.mold_name, m.customer_name,
       m.machine_no, a.kind, a.part_name, a.level, a.reason,
       a.shot_count, a.limit_shot, a.used_shot, a.days_left, a.message,
       a.status, a.notified, a.notified_at, a.action, a.closed_at, a.closed_by
from public.ki_tool_alert a
left join public.ki_mold m on m.mold_code = a.mold_code;

-- ------------------------------------------------------------
-- 3) 권한 (화면 매핑 → RLS 정책)
-- ------------------------------------------------------------
insert into public.ki_table_menu(table_name,menus) values
 ('ki_tool_rule' , array['tool-rule']),
 ('ki_mold_tool' , array['tool-mold','tool-due']),
 ('ki_tool_alert', array['tool-due','tool-alarm'])
on conflict (table_name) do update set menus = excluded.menus;

do $$
declare r record; m text;
begin
  for r in select table_name t, menus ms from public.ki_table_menu
            where table_name in ('ki_tool_rule','ki_mold_tool','ki_tool_alert') loop
    if to_regclass('public.'||r.t) is null then continue; end if;
    m := array_to_string(array(select quote_literal(x) from unnest(r.ms) x), ',');
    execute format('alter table public.%I enable row level security', r.t);
    execute format('revoke all on public.%I from anon', r.t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', r.t);
    execute format('drop policy if exists %I on public.%I', r.t||'_sel', r.t);
    execute format('drop policy if exists %I on public.%I', r.t||'_ins', r.t);
    execute format('drop policy if exists %I on public.%I', r.t||'_upd', r.t);
    execute format('drop policy if exists %I on public.%I', r.t||'_del', r.t);
    execute format($p$create policy %I on public.%I for select to authenticated
                      using (public.ki_can_any(array[%s],'view'))$p$, r.t||'_sel', r.t, m);
    execute format($p$create policy %I on public.%I for insert to authenticated
                      with check (public.ki_can_any(array[%s],'save'))$p$, r.t||'_ins', r.t, m);
    execute format($p$create policy %I on public.%I for update to authenticated
                      using (public.ki_can_any(array[%s],'edit'))
                      with check (public.ki_can_any(array[%s],'edit'))$p$, r.t||'_upd', r.t, m, m);
    execute format($p$create policy %I on public.%I for delete to authenticated
                      using (public.ki_can_any(array[%s],'delete'))$p$, r.t||'_del', r.t, m);
  end loop;
end $$;

/* 알림설정 : 조회는 전체 / 수정은 관리자 */
alter table public.ki_notify_config enable row level security;
revoke all on public.ki_notify_config from anon;
grant select, insert, update on public.ki_notify_config to authenticated;
drop policy if exists ki_notify_config_sel on public.ki_notify_config;
drop policy if exists ki_notify_config_adm on public.ki_notify_config;
create policy ki_notify_config_sel on public.ki_notify_config
  for select to authenticated using (true);
create policy ki_notify_config_adm on public.ki_notify_config
  for all to authenticated using (public.ki_is_admin()) with check (public.ki_is_admin());

grant usage, select on all sequences in schema public to authenticated;

-- ------------------------------------------------------------
-- 4) 기본 데이터 (최초 1회)
-- ------------------------------------------------------------
insert into public.ki_tool_rule
 (rule_id,kind,target,part_name,limit_shot,cycle_days,warn_pct,label,sort_order,remark) values
 ('GRIND_ALL' ,'연마','ALL','펀치 · 다이', 200000, 180, 90,'20만타 또는 6개월', 1,'공통 연마주기'),
 ('CHANGE_ALL','교체','ALL','펀치 · 다이',1000000, 730, 90,'100만타 또는 2년', 11,'공통 교체주기')
on conflict (rule_id) do nothing;
