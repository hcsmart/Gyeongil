-- ============================================================
-- KI MES 통합관리시스템 — 이전(Migration)용 전체 스크립트
--   모듈 : 금형 정기점검 / 외주 LOT관리 / 트윈팩토리 / 온습도 모니터링
--          + 기준정보 + 시스템(사용자·권한)
--
--   사용법
--     1) 대상 Supabase 프로젝트의 SQL Editor 에서 이 파일 전체 실행
--     2) ki_config.js 상단의 SUPABASE_URL / SUPABASE_KEY 두 줄 교체
--   ※ 화면은 ki_ 로 시작하는 오브젝트만 참조합니다.
--   ※ 기존 시스템 테이블은 생성/변경하지 않고 뷰로 감쌉니다.
--   ※ 보안 : Supabase Auth 로그인 필수. 공개키(anon)만으로는 어떤 데이터도
--            읽거나 쓸 수 없으며, 화면별 권한(ki_permission)이 RLS 로 강제됩니다.
--   ※ Edge Function 'ki-admin-user' 를 함께 배포해야 계정 생성/재설정이 됩니다.
-- ============================================================

-- ------------------------------------------------------------
-- 1) 설정 : PIN
-- ------------------------------------------------------------
create table if not exists public.ki_app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz default now(),
  updated_by text
);
-- (환경설정 보관용. 관리자만 접근 가능)

-- ------------------------------------------------------------
-- 2) 자체 테이블
-- ------------------------------------------------------------

/* --- 금형 정기점검 --- */
create table if not exists public.ki_mold (
  mold_code text primary key, mold_name text, customer_name text, model text, mold_type text,
  mold_no text, grade text, machine_no text, prod_type text default '양산',
  factory_code text, location text, shot_count numeric default 0, shot_limit numeric,
  cycle_days integer default 90, last_inspection date, next_inspection date,
  status text default '정상', remark text, updated_at timestamptz default now());

create table if not exists public.ki_inspection_item (
  item_code text primary key, item_name text not null, category text, method text,
  criteria text, unit text, sort_order integer default 0, is_active boolean default true);

create table if not exists public.ki_inspection_result (
  inspection_no bigserial primary key, mold_code text, inspection_date date, inspector text,
  shot_count numeric, judgement text, defect_count integer default 0, action_taken text,
  next_inspection date, remark text, created_at timestamptz default now());

create table if not exists public.ki_inspection_detail (
  inspection_no bigint, item_code text, item_name text, criteria text,
  measured_value text, result text, remark text, primary key (inspection_no, item_code));

/* --- 트윈팩토리 --- */
create table if not exists public.ki_factory (
  factory_code text primary key, factory_name text,
  width_m numeric default 100, height_m numeric default 60, remark text);

create table if not exists public.ki_zone (
  zone_code text primary key, factory_code text, zone_name text,
  x numeric, y numeric, w numeric, h numeric, color text default '#dce8f6', remark text);

create table if not exists public.ki_asset (
  asset_code text primary key, factory_code text, zone_code text, asset_name text, asset_type text,
  x numeric, y numeric, status text default '정지', spec text, last_signal timestamptz, remark text);

/* --- 온습도 모니터링 --- */
create table if not exists public.ki_sensor (
  sensor_code text primary key, factory_code text, zone_code text, sensor_name text,
  x numeric, y numeric, temp_min numeric default 15, temp_max numeric default 30,
  humi_min numeric default 30, humi_max numeric default 70, is_active boolean default true, remark text);

create table if not exists public.ki_env_reading (
  reading_id bigserial primary key, sensor_code text,
  measured_at timestamptz default now(), temperature numeric, humidity numeric);
create index if not exists ki_env_reading_idx on public.ki_env_reading(sensor_code, measured_at desc);

create table if not exists public.ki_env_alert (
  alert_id bigserial primary key, sensor_code text, occurred_at timestamptz default now(),
  alert_type text, value numeric, threshold numeric, status text default '발생', action text);

/* --- 금형 수명관리 (등급 · 타발수 · 점검) --- */
create table if not exists public.ki_shot_ledger (
  mold_code text not null, year integer not null,
  m1 numeric,m2 numeric,m3 numeric,m4 numeric,m5 numeric,m6 numeric,
  m7 numeric,m8 numeric,m9 numeric,m10 numeric,m11 numeric,m12 numeric,
  updated_at timestamptz default now(), primary key (mold_code, year));

create table if not exists public.ki_grade_item (
  item_no integer primary key, item_name text not null,
  auto_source text, default_score integer default 2, remark text);

create table if not exists public.ki_grade_eval (
  eval_id bigserial primary key, mold_code text not null,
  eval_date date default current_date, evaluator text,
  total_score integer, grade text, applied boolean default false,
  method text default '평가표', remark text, created_at timestamptz default now());
create table if not exists public.ki_grade_eval_detail (
  eval_id bigint not null, item_no integer not null, score integer, note text,
  primary key (eval_id, item_no));

create table if not exists public.ki_daily_item (
  side text not null, item_no integer not null, item_name text not null,
  is_active boolean default true, primary key (side, item_no));

create table if not exists public.ki_daily_check (
  check_id bigserial primary key, mold_code text not null,
  check_date date default current_date, checker text, shot_count numeric,
  actions text[], judgement text default '합격', issue text, action_taken text,
  created_at timestamptz default now());
create table if not exists public.ki_daily_check_detail (
  check_id bigint not null, side text not null, item_no integer not null,
  item_name text, result text default '양호', note text,
  primary key (check_id, side, item_no));

/* --- 점검주기 기준 (정기 / 세척) --- */
create table if not exists public.ki_cycle_rule (
  rule_id text primary key, kind text not null, target text not null,
  cycle_days integer, limit_shot numeric, plan_months integer[],
  label text, sort_order integer default 0, is_active boolean default true,
  remark text, updated_at timestamptz default now());

/* --- 세척점검 · 연간 계획일정 --- */
create table if not exists public.ki_wash (
  wash_id bigserial primary key, mold_code text not null,
  wash_date date default current_date, wash_type text default '정기',
  worker text, shot_count numeric, steps text[],
  judgement text default '양호', remark text, created_at timestamptz default now());
create index if not exists ki_wash_mold_idx on public.ki_wash(mold_code, wash_date desc);

create table if not exists public.ki_wash_step (
  step_no integer primary key, step_name text not null, is_active boolean default true);

create table if not exists public.ki_insp_plan (
  mold_code text not null, year integer not null, months integer[],
  updated_at timestamptz default now(), primary key (mold_code, year));

/* --- 기준정보 : 생산기준 --- */
create table if not exists public.ki_mold_type (
  mold_type_code text primary key, mold_type_name text, sort_order integer default 0, remark text);

create table if not exists public.ki_material (
  material_code text primary key, material_name text, density numeric,
  sort_order integer default 0, remark text);

create table if not exists public.ki_mold_master (
  mold_no text primary key, mold_type_code text, material_code text,
  thickness_mm numeric, width_mm numeric, pitch_mm numeric, density numeric,
  part_no text, asset_owner text, remark text, updated_at timestamptz default now());

create table if not exists public.ki_machine (
  machine_no text primary key, machine_name text, tonnage numeric,
  sort_order integer default 0, is_active boolean default true, remark text);

/* --- 기준정보 : 점검기준 (설비/금형 공용) --- */
create table if not exists public.ki_check_item (
  check_id bigserial primary key, target text, check_type text,
  item_name text, criteria text, cycle text, qr_code text, link_no text,
  sort_order integer default 0, is_active boolean default true, remark text);

/* --- 시스템 : 사용자 / 권한 --- */
create table if not exists public.ki_employee (
  emp_no text primary key, emp_name text, dept text, position text, factory text,
  role text default '사용자', hire_date date, phone text, is_active boolean default true,
  remark text, updated_at timestamptz default now(),
  user_id text, name_en text, user_group text, proc_group text,
  biz_div text, mobile text, email text, login_email text, reg_date date default current_date,
  auth_uid uuid);
create unique index if not exists ki_employee_auth_uid_idx
  on public.ki_employee(auth_uid) where auth_uid is not null;

create table if not exists public.ki_permission (
  perm_id bigserial primary key, emp_no text, menu_id text, menu_name text,
  can_view boolean default true, can_save boolean default false,
  can_edit boolean default false, can_delete boolean default false,
  updated_at timestamptz default now(), unique (emp_no, menu_id));
create index if not exists ki_permission_emp_idx on public.ki_permission(emp_no);

-- ------------------------------------------------------------
-- 3) 보안 : Supabase Auth 로그인 + 화면별 권한 기반 RLS
--    anon(공개키) 은 어떤 테이블에도 접근할 수 없습니다.
-- ------------------------------------------------------------

/* 3-1) 권한 판정 함수 */
create or replace function public.ki_me()
returns public.ki_employee language sql stable security definer set search_path = public as $$
  select * from public.ki_employee
   where auth_uid = auth.uid() and coalesce(is_active,true) limit 1 $$;

create or replace function public.ki_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = '관리자' from public.ki_employee
                    where auth_uid = auth.uid() and coalesce(is_active,true) limit 1), false) $$;

create or replace function public.ki_is_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.ki_employee
                 where auth_uid = auth.uid() and coalesce(is_active,true)) $$;

create or replace function public.ki_can(p_menu text, p_act text default 'view')
returns boolean language sql stable security definer set search_path = public as $$
  select case when public.ki_is_admin() then true
    else coalesce((
      select case p_act when 'view' then p.can_view when 'save' then p.can_save
                        when 'edit' then p.can_edit when 'delete' then p.can_delete
                        else false end
        from public.ki_permission p join public.ki_employee e on e.emp_no = p.emp_no
       where e.auth_uid = auth.uid() and coalesce(e.is_active,true)
         and p.menu_id = p_menu limit 1), false) end $$;

create or replace function public.ki_can_any(p_menus text[], p_act text default 'view')
returns boolean language sql stable security definer set search_path = public as $$
  select public.ki_is_admin()
      or exists(select 1 from unnest(p_menus) m where public.ki_can(m, p_act)) $$;

grant execute on function public.ki_me(), public.ki_is_admin(), public.ki_is_user(),
                         public.ki_can(text,text), public.ki_can_any(text[],text) to authenticated;

/* 3-2) 테이블 → 화면 매핑 */
create table if not exists public.ki_table_menu (
  table_name text primary key, menus text[] not null);
insert into public.ki_table_menu(table_name,menus) values
 ('ki_mold',array['mold-master']), ('ki_inspection_result',array['mold-insp']),
 ('ki_inspection_detail',array['mold-insp']), ('ki_inspection_item',array['insp-item']),
 ('ki_mold_master',array['mold-spec']), ('ki_mold_type',array['mold-spec']),
 ('ki_material',array['mold-spec']), ('ki_machine',array['machine']),
 ('ki_check_item',array['chk-mach']),
 ('ki_factory',array['factory']), ('ki_zone',array['zone']), ('ki_asset',array['asset']),
 ('ki_sensor',array['sensor']), ('ki_env_alert',array['env-alert']), ('ki_env_reading',array['sensor']),
 ('ki_employee',array['user-info']), ('ki_permission',array['user-info']),
 ('outsourcing_order_status_rows',array['osp-order','osp-stock','osp-issue']),
 ('outsourcing_receipt_confirm_candidates',array['osp-receipt']),
 ('machining_purchase_progress_rows',array['osp-order','lot-route']),
 ('machining_standard_routes',array['std-route']),
 ('ki_shot_ledger',array['shot-ledger']),
 ('ki_grade_item',array['grade-item','grade-eval']),
 ('ki_grade_eval',array['grade-eval','shot-ledger']),
 ('ki_grade_eval_detail',array['grade-eval','shot-ledger']),
 ('ki_daily_item',array['daily-item','daily-check']),
 ('ki_daily_check',array['daily-check']),
 ('ki_daily_check_detail',array['daily-check']),
 ('ki_wash',array['wash-check']),
 ('ki_wash_step',array['wash-step','wash-check']),
 ('ki_insp_plan',array['insp-plan']),
 ('ki_cycle_rule',array['cycle-rule'])
on conflict (table_name) do update set menus = excluded.menus;
-- 등급 반영을 위해 ki_mold 는 수명관리 화면에서도 수정 가능
update public.ki_table_menu set menus = array['mold-master','shot-ledger','grade-eval','insp-plan']
 where table_name = 'ki_mold';

alter table public.ki_table_menu enable row level security;
drop policy if exists ki_table_menu_read on public.ki_table_menu;
create policy ki_table_menu_read on public.ki_table_menu for select to authenticated using (true);
grant select on public.ki_table_menu to authenticated;

/* 3-3) 권한 기반 정책 일괄 생성 (anon 정책 제거) */
do $$
declare r record; m text;
begin
  for r in select table_name t, menus ms from public.ki_table_menu loop
    if to_regclass('public.'||r.t) is null then continue; end if;
    m := array_to_string(array(select quote_literal(x) from unnest(r.ms) x), ',');
    execute format('alter table public.%I enable row level security', r.t);
    execute format('drop policy if exists %I on public.%I', r.t||'_anon_rw',   r.t);
    execute format('drop policy if exists %I on public.%I', r.t||'_anon_read', r.t);
    execute format('drop policy if exists %I on public.%I', r.t||'_auth_rw',   r.t);
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

/* 3-4) 본인 사원정보·권한은 항상 조회 가능 (로그인 직후 권한 판정용) */
drop policy if exists ki_employee_self on public.ki_employee;
create policy ki_employee_self on public.ki_employee for select to authenticated
  using (auth_uid = auth.uid());
drop policy if exists ki_permission_self on public.ki_permission;
create policy ki_permission_self on public.ki_permission for select to authenticated
  using (exists(select 1 from public.ki_employee e
                 where e.emp_no = ki_permission.emp_no and e.auth_uid = auth.uid()));

/* 3-5) 설정 테이블 : 관리자 전용 */
alter table public.ki_app_settings enable row level security;
drop policy if exists ki_app_settings_anon_rw on public.ki_app_settings;
drop policy if exists ki_app_settings_auth_rw on public.ki_app_settings;
drop policy if exists ki_app_settings_admin on public.ki_app_settings;
revoke all on public.ki_app_settings from anon;
create policy ki_app_settings_admin on public.ki_app_settings for all to authenticated
  using (public.ki_is_admin()) with check (public.ki_is_admin());
grant select, insert, update, delete on public.ki_app_settings to authenticated;

/* 3-6) 시퀀스 */
revoke all on all sequences in schema public from anon;
grant usage, select on all sequences in schema public to authenticated;

-- ------------------------------------------------------------
-- 4) 조회 뷰
--    ★ create or replace 는 컬럼을 줄이거나 이름을 바꿀 수 없다
--      (ERROR 42P16: cannot drop columns from view)
--      → 재실행 안전을 위해 기존 ki_v_* 를 모두 제거한 뒤 새로 만든다.
-- ------------------------------------------------------------
do $$
declare r record;
begin
  for r in select c.relname n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
           where ns.nspname='public' and c.relkind='v' and c.relname like 'ki\_v\_%'
  loop execute format('drop view if exists public.%I cascade', r.n); end loop;
end $$;

/* 금형 점검 도래현황 (D-day) */
create view public.ki_v_mold_due with (security_invoker=true) as
select m.mold_code, m.mold_no, m.grade, m.machine_no, coalesce(m.prod_type,'양산') as prod_type,
       m.mold_name, m.customer_name, m.model, m.mold_type, m.factory_code, m.location,
       m.shot_count, m.shot_limit,
       case when coalesce(m.shot_limit,0)>0 then round(m.shot_count/m.shot_limit*100,1) end as shot_rate_pct,
       m.cycle_days, m.last_inspection, m.next_inspection,
       (m.next_inspection - current_date) as d_day,
       case when m.next_inspection is null then '미지정'
            when m.next_inspection < current_date then '지연'
            when m.next_inspection - current_date <= 7 then '임박'
            when m.next_inspection - current_date <= 30 then '예정'
            else '여유' end as due_status,
       m.status, m.remark
from public.ki_mold m;

create view public.ki_v_inspection_history with (security_invoker=true) as
select r.inspection_no, r.inspection_date, r.mold_code, m.mold_name, m.customer_name,
       r.inspector, r.shot_count, r.judgement, r.defect_count,
       r.action_taken, r.next_inspection, r.remark
from public.ki_inspection_result r left join public.ki_mold m on m.mold_code = r.mold_code;

create view public.ki_v_inspection_detail with (security_invoker=true) as
select d.inspection_no, r.inspection_date, r.mold_code, m.mold_name,
       d.item_code, d.item_name, d.criteria, d.measured_value, d.result, d.remark
from public.ki_inspection_detail d
left join public.ki_inspection_result r on r.inspection_no = d.inspection_no
left join public.ki_mold m on m.mold_code = r.mold_code;

/* 트윈팩토리 */
create view public.ki_v_asset_status with (security_invoker=true) as
select a.asset_code, a.factory_code, f.factory_name, a.zone_code, z.zone_name,
       a.asset_name, a.asset_type, a.status, a.spec, a.x, a.y, a.last_signal, a.remark
from public.ki_asset a
left join public.ki_factory f on f.factory_code = a.factory_code
left join public.ki_zone z on z.zone_code = a.zone_code;

/* 온습도 */
create view public.ki_v_env_latest with (security_invoker=true) as
select s.sensor_code, s.sensor_name, s.factory_code, s.zone_code, s.x, s.y,
       s.temp_min, s.temp_max, s.humi_min, s.humi_max,
       r.measured_at, r.temperature, r.humidity,
       case when r.temperature is null then '무신호'
            when r.temperature > s.temp_max then '고온'
            when r.temperature < s.temp_min then '저온' else '정상' end as temp_status,
       case when r.humidity is null then '무신호'
            when r.humidity > s.humi_max then '고습'
            when r.humidity < s.humi_min then '저습' else '정상' end as humi_status
from public.ki_sensor s
left join lateral (select measured_at, temperature, humidity from public.ki_env_reading e
                   where e.sensor_code = s.sensor_code order by measured_at desc limit 1) r on true
where s.is_active;

create view public.ki_v_env_history with (security_invoker=true) as
select e.reading_id, e.sensor_code, s.sensor_name, s.zone_code, e.measured_at, e.temperature, e.humidity
from public.ki_env_reading e left join public.ki_sensor s on s.sensor_code = e.sensor_code;

create view public.ki_v_env_alert with (security_invoker=true) as
select a.alert_id, a.occurred_at, a.sensor_code, s.sensor_name, s.zone_code,
       a.alert_type, a.value, a.threshold, a.status, a.action
from public.ki_env_alert a left join public.ki_sensor s on s.sensor_code = a.sensor_code;

/* 기준정보 : 금형정보 — 소재중량 자동계산 */
create view public.ki_v_mold_master with (security_invoker=true) as
select m.mold_no, m.mold_type_code, t.mold_type_name,
       m.material_code, mt.material_name,
       m.thickness_mm, m.width_mm, m.pitch_mm,
       coalesce(m.density, mt.density) as density,
       round((m.thickness_mm/10.0)*(m.width_mm/10.0)*(m.pitch_mm/10.0)
             * coalesce(m.density, mt.density), 2) as unit_weight_g,
       m.part_no, m.asset_owner, m.remark, m.updated_at
from public.ki_mold_master m
left join public.ki_mold_type t on t.mold_type_code = m.mold_type_code
left join public.ki_material  mt on mt.material_code = m.material_code;

/* 점검기준 */
create view public.ki_v_check_machine with (security_invoker=true) as
select check_id, check_type, item_name, criteria, cycle, qr_code, link_no, sort_order, is_active, remark
from public.ki_check_item where target='설비';

/* 수명관리 뷰 */
create view public.ki_v_shot_ledger with (security_invoker=true) as
select l.mold_code, m.mold_name, m.customer_name, m.model, m.machine_no, m.mold_no, m.grade,
       l.year, l.m1,l.m2,l.m3,l.m4,l.m5,l.m6,l.m7,l.m8,l.m9,l.m10,l.m11,l.m12,
       x.last_val, x.base_val, x.base_is_jan,
       case when x.last_val is null or x.base_val is null then null else x.last_val-x.base_val end as annual_shot,
       case when x.last_val is null or x.base_val is null then null
            when x.last_val-x.base_val >= 4000000 then 5
            when x.last_val-x.base_val >= 3000000 then 4
            when x.last_val-x.base_val >= 2000000 then 3
            when x.last_val-x.base_val >= 1000000 then 2 else 1 end as shot_score,
       l.updated_at
from public.ki_shot_ledger l
join public.ki_mold m on m.mold_code = l.mold_code
cross join lateral (
  select (select v from unnest(array[l.m12,l.m11,l.m10,l.m9,l.m8,l.m7,l.m6,l.m5,l.m4,l.m3,l.m2,l.m1]) v
           where v is not null limit 1) as last_val,
         coalesce(l.m1,(select v from unnest(array[l.m1,l.m2,l.m3,l.m4,l.m5,l.m6,l.m7,l.m8,l.m9,l.m10,l.m11,l.m12]) v
           where v is not null limit 1)) as base_val,
         (l.m1 is not null) as base_is_jan) x;

create view public.ki_v_grade_eval with (security_invoker=true) as
select e.eval_id, e.eval_date, e.mold_code, m.mold_name, m.customer_name, m.mold_no,
       e.evaluator, e.total_score, e.grade, e.applied, e.method, e.remark
from public.ki_grade_eval e left join public.ki_mold m on m.mold_code = e.mold_code;
create view public.ki_v_daily_check with (security_invoker=true) as
select c.check_id, c.check_date, c.mold_code, m.mold_name, m.customer_name, m.grade,
       c.checker, c.shot_count, c.actions, c.judgement, c.issue, c.action_taken,
       (select count(*) from public.ki_daily_check_detail d
         where d.check_id=c.check_id and d.result='불량') as ng_count
from public.ki_daily_check c left join public.ki_mold m on m.mold_code = c.mold_code;

/* 세척 · 계획 뷰 */
create view public.ki_v_wash_status with (security_invoker=true) as
select m.mold_code, m.mold_name, m.customer_name, m.grade,
       coalesce(m.prod_type,'양산') as prod_type,
       w.wash_date as last_wash_date, w.shot_count as base_shot, s.cur_shot,
       greatest(coalesce(s.cur_shot,0)-coalesce(w.shot_count,0),0) as used_shot,
       coalesce(cr.limit_shot,1000000) as limit_shot,
       coalesce(cr.cycle_days,365)     as limit_days,
       cr.label as rule_label,
       (current_date - w.wash_date) as days_since,
       round(greatest(coalesce(s.cur_shot,0)-coalesce(w.shot_count,0),0)::numeric
             / coalesce(cr.limit_shot,1000000) * 100, 1) as shot_pct,
       case when w.wash_date is null then '미실시'
            when greatest(coalesce(s.cur_shot,0)-coalesce(w.shot_count,0),0)
                 >= coalesce(cr.limit_shot,1000000) then '도래(타발수)'
            when (current_date - w.wash_date) >= coalesce(cr.cycle_days,365) then '도래(기간)'
            when greatest(coalesce(s.cur_shot,0)-coalesce(w.shot_count,0),0)
                 >= coalesce(cr.limit_shot,1000000)*0.9 then '임박'
            when (current_date - w.wash_date) >= coalesce(cr.cycle_days,365)*0.9 then '임박'
            else '정상' end as wash_status
from public.ki_mold m
left join public.ki_cycle_rule cr
       on cr.kind='세척' and cr.target = coalesce(m.prod_type,'양산') and cr.is_active
left join lateral (select wash_date, shot_count from public.ki_wash x
   where x.mold_code=m.mold_code and x.wash_type='정기'
   order by wash_date desc, wash_id desc limit 1) w on true
left join lateral (
  select (select v from unnest(array[l.m12,l.m11,l.m10,l.m9,l.m8,l.m7,l.m6,l.m5,l.m4,l.m3,l.m2,l.m1]) v
           where v is not null limit 1) as cur_shot
    from public.ki_shot_ledger l
   where l.mold_code=m.mold_code and l.year=extract(year from current_date)::int) s on true;

create view public.ki_v_wash with (security_invoker=true) as
select w.wash_id, w.wash_date, w.mold_code, m.mold_name, m.customer_name, m.grade,
       w.wash_type, w.worker, w.shot_count, w.steps, w.judgement, w.remark,
       coalesce(array_length(w.steps,1),0) as step_done
from public.ki_wash w left join public.ki_mold m on m.mold_code = w.mold_code;


create view public.ki_v_insp_plan with (security_invoker=true) as
select p.mold_code, m.mold_name, m.customer_name, m.grade, p.year, p.months,
       coalesce(array_length(p.months,1),0) as plan_cnt,
       (select count(distinct extract(month from r.inspection_date)::int)
          from public.ki_inspection_result r
         where r.mold_code=p.mold_code
           and extract(year from r.inspection_date)::int = p.year
           and extract(month from r.inspection_date)::int = any(p.months)) as done_cnt,
       (select string_agg(x::text, ',' order by x) from unnest(p.months) x) as plan_months,
       p.updated_at
from public.ki_insp_plan p left join public.ki_mold m on m.mold_code = p.mold_code;

/* 시스템 */

create view public.ki_v_permission with (security_invoker=true) as
select p.perm_id, p.emp_no, e.emp_name, e.dept, e.position, e.role,
       p.menu_id, p.menu_name, p.can_view, p.can_save, p.can_edit, p.can_delete, p.updated_at
from public.ki_permission p left join public.ki_employee e on e.emp_no = p.emp_no;

/* 단순 래핑 뷰
   ★ select * 뷰는 생성 시점의 컬럼으로 고정된다.
      테이블에 컬럼을 추가한 뒤에는 반드시 drop 후 재생성해야 새 컬럼이 보인다. */
do $$
declare
  v text[] := array['ki_mold','ki_inspection_item','ki_factory','ki_zone','ki_asset','ki_sensor',
                    'ki_mold_type','ki_material','ki_machine','ki_employee',
                    'ki_grade_item','ki_daily_item','ki_wash_step','ki_cycle_rule'];
  t text;
begin
  foreach t in array v loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('create view public.%I with (security_invoker=true) as select * from public.%I',
                   'ki_v_'||substr(t,4), t);
    execute format('grant select on public.%I to authenticated', 'ki_v_'||substr(t,4));
  end loop;
end $$;


-- ------------------------------------------------------------
-- 5) 외주 LOT관리 : 기존 시스템 테이블을 감싼 뷰
--    ★ 대상 DB의 원천 테이블명이 다르면 from 절만 수정
--    ★ 원천 테이블이 없으면 이 블록은 건너뛰어도 나머지는 동작
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.outsourcing_order_status_rows') is not null then
    execute $v$create view public.ki_v_osp_order with (security_invoker=true) as
      select "no", st, vendor, job, item, proc, "procName", part, "partName", mp,
             odate, edate, idate, cdate, quote, fix
      from public.outsourcing_order_status_rows$v$;
  end if;
  if to_regclass('public.outsourcing_receipt_confirm_candidates') is not null then
    execute $v$create view public.ki_v_osp_receipt with (security_invoker=true) as
      select "no", status, job, item, proc, "procName", part, "partName", mp, "mpName",
             vendor, odate, idate, cdate, quote, rate
      from public.outsourcing_receipt_confirm_candidates$v$;
  end if;
  if to_regclass('public.machining_purchase_progress_rows') is not null then
    execute $v$create view public.ki_v_lot_progress with (security_invoker=true) as
      select "no", job, proc, part, steps from public.machining_purchase_progress_rows$v$;
  end if;
  if to_regclass('public.machining_standard_routes') is not null then
    execute $v$create view public.ki_v_std_route with (security_invoker=true) as
      select row_no, standard_process_no, standard_process_name, steps
      from public.machining_standard_routes$v$;
  end if;
  if to_regclass('public.vendors') is not null then
    execute $v$create view public.ki_v_vendor with (security_invoker=true) as
      select vendor_code, vendor_name, vendor_type, partner_type, location_type,
             ceo_name, phone, remark, outsourcing_flag, milling_flag
      from public.vendors
      where coalesce(outsourcing_flag,false) or coalesce(milling_flag,false)$v$;
  end if;
  if to_regclass('public.processes') is not null then
    execute $v$create view public.ki_v_process with (security_invoker=true) as
      select process_code, process_name, process_group, sort_order from public.processes$v$;
  end if;
end $$;

-- 외주 LOT 원천 테이블 권한
--   · vendors / processes : 로그인 사용자 조회 전용
--   · 발주/입고/이동이력/표준경로 : 위 3-3 블록에서 권한 기반 정책 적용됨
do $$
declare t text; ro text[] := array['vendors','processes'];
begin
  foreach t in array ro loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_anon_read', t);
    execute format('drop policy if exists %I on public.%I', t||'_anon_rw', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists %I on public.%I', t||'_sel', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.ki_is_user())', t||'_sel', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- 외주 발주/입고 No 자동채번
do $$
begin
  if to_regclass('public.outsourcing_order_status_rows') is not null then
    create sequence if not exists public.ki_osp_order_no_seq;
    perform setval('public.ki_osp_order_no_seq',
      greatest(coalesce((select max("no")::bigint from public.outsourcing_order_status_rows),0),1000));
    execute 'alter table public.outsourcing_order_status_rows alter column "no" set default nextval(''public.ki_osp_order_no_seq'')';
    execute 'grant usage, select on sequence public.ki_osp_order_no_seq to authenticated';
  end if;
  if to_regclass('public.outsourcing_receipt_confirm_candidates') is not null then
    create sequence if not exists public.ki_osp_receipt_no_seq;
    perform setval('public.ki_osp_receipt_no_seq',
      greatest(coalesce((select max("no")::bigint from public.outsourcing_receipt_confirm_candidates),0),1000));
    execute 'alter table public.outsourcing_receipt_confirm_candidates alter column "no" set default nextval(''public.ki_osp_receipt_no_seq'')';
    execute 'grant usage, select on sequence public.ki_osp_receipt_no_seq to authenticated';
  end if;
  if to_regclass('public.machining_purchase_progress_rows') is not null then
    create sequence if not exists public.ki_lot_progress_no_seq;
    perform setval('public.ki_lot_progress_no_seq',
      greatest(coalesce((select max("no")::bigint from public.machining_purchase_progress_rows),0),1000));
    execute 'alter table public.machining_purchase_progress_rows alter column "no" set default nextval(''public.ki_lot_progress_no_seq'')';
    execute 'grant usage, select on sequence public.ki_lot_progress_no_seq to authenticated';
  end if;
end $$;

-- ------------------------------------------------------------
-- 5-1) 외주 입고일 기록 시 LOT 이동이력 자동 반영 (트리거)
-- ------------------------------------------------------------
create or replace function public.ki_fn_lot_trace()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_steps jsonb; v_step jsonb;
begin
  if new.idate is null or btrim(new.idate) = '' then return new; end if;
  if tg_op = 'UPDATE' and coalesce(old.idate,'') = coalesce(new.idate,'') then return new; end if;
  if new.job is null or new.part is null or new.mp is null then return new; end if;

  v_step := jsonb_build_object('mp', new.mp, 'vendor', coalesce(new.vendor,''), 'date', new.idate);

  select steps into v_steps from public.machining_purchase_progress_rows
   where job = new.job and coalesce(proc,'') = coalesce(new.proc,'') and part = new.part limit 1;

  if not found then
    insert into public.machining_purchase_progress_rows(job, proc, part, steps)
    values (new.job, new.proc, new.part, jsonb_build_array(v_step));
    return new;
  end if;

  v_steps := coalesce(v_steps, '[]'::jsonb);
  if exists (select 1 from jsonb_array_elements(v_steps) s
              where s->>'mp' = new.mp and s->>'date' = new.idate) then
    return new;
  end if;

  update public.machining_purchase_progress_rows
     set steps = v_steps || jsonb_build_array(v_step)
   where job = new.job and coalesce(proc,'') = coalesce(new.proc,'') and part = new.part;
  return new;
end $fn$;

do $$
begin
  if to_regclass('public.outsourcing_order_status_rows') is not null then
    drop trigger if exists ki_trg_lot_trace on public.outsourcing_order_status_rows;
    create trigger ki_trg_lot_trace after insert or update of idate
      on public.outsourcing_order_status_rows for each row execute function public.ki_fn_lot_trace();
  end if;
  if to_regclass('public.outsourcing_receipt_confirm_candidates') is not null then
    drop trigger if exists ki_trg_lot_trace_r on public.outsourcing_receipt_confirm_candidates;
    create trigger ki_trg_lot_trace_r after insert or update of idate
      on public.outsourcing_receipt_confirm_candidates for each row execute function public.ki_fn_lot_trace();
  end if;
end $$;

-- 모든 ki_v_* 뷰 조회 권한
do $$
declare r record;
begin
  for r in select c.relname n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
           where ns.nspname='public' and c.relkind='v' and c.relname like 'ki\_v\_%'
  loop execute format('grant select on public.%I to authenticated', r.n); end loop;
end $$;

-- ------------------------------------------------------------
-- 6) 기본 기준정보 (최초 1회)
-- ------------------------------------------------------------
insert into public.ki_mold_type(mold_type_code,mold_type_name,sort_order) values
 ('MD001','PROGRESSIVE',1),('MD002','SEMI+단발',2),('MD003','단발',3),('MD004','TPL',4),('MD005','TR',5)
on conflict do nothing;

insert into public.ki_material(material_code,material_name,density,sort_order) values
 ('SPCC','연강 / SPCC / SPHC / SAPH',7.85,1),('STS304','스테인리스 STS304',7.93,2),
 ('STS430','스테인리스 STS430',7.70,3),('A1050','알루미늄 A1050',2.71,4),
 ('C2680','황동 C2680',8.53,5),('C5191','인청동',8.80,6)
on conflict do nothing;

insert into public.ki_machine(machine_no,machine_name,tonnage,sort_order) values
 ('01','심팩300톤',300,1),('02','국일300톤',300,2)
on conflict do nothing;

insert into public.ki_factory(factory_code,factory_name,width_m,height_m) values
 ('F1','1공장 (금형가공)',120,70),('F2','2공장 (조립·검사)',90,60)
on conflict do nothing;

-- 설비 점검기준 (일상) — QR / 연동번호
insert into public.ki_check_item(target,check_type,item_name,criteria,qr_code,link_no,sort_order)
select * from (values
 ('설비','일상','오버로드 프로텍트 (정상범위)','압력계 정상범위 · 경고등 소등','PRESS-1','2,3',1),
 ('설비','일상','발란스 실린더 (정상범위)','설정 압력 유지 · 누유 없음',null,null,2),
 ('설비','일상','클러치 / 브레이크 (정상범위)','에어압 정상 · 제동거리 정상',null,null,3),
 ('설비','일상','모터 (이상음)','이상음 · 이상진동 · 발열 없음','PRESS-4',null,4),
 ('설비','일상','클러치 (작동상태)','결합/해제 지연 없음','PRESS-5',null,5),
 ('설비','일상','안전장치 (센서, 양수조작버튼)','광전센서 · 양수조작 정상 동작','PRESS-6',null,6),
 ('설비','일상','오일러 급유 (적정량, 흐름상태)','유면 MIN 이상 · 적하 확인','PRESS-7',null,7),
 ('설비','일상','피치세팅 10회 체크','10회 연속 피치 편차 없음','PRESS-8',null,8),
 ('설비','일상','안전보호구 착용','크레인/사다리 사용 시 안전모 착용',null,null,9)
) v(a,b,c,d,e,f,g)
where not exists (select 1 from public.ki_check_item);

-- 등급 평가항목 13 (임시 명칭 — 규정 확보 후 화면에서 수정)
insert into public.ki_grade_item(item_no,item_name,auto_source,default_score,remark) values
 (1,'타발수 (연간)','shot',1,'타발수 대장 자동'),(2,'금형 구조 난이도',null,2,''),
 (3,'제품 두께',null,2,''),(4,'제품 재질',null,2,''),(5,'펀치·다이 마모 상태',null,2,''),
 (6,'유지보수 빈도',null,2,''),(7,'성형 안정성(불량 발생)',null,2,''),
 (8,'금형 제작년도','year',2,'금형번호 앞자리 자동 · F등급 5점'),(9,'부품 수급성',null,2,''),
 (10,'도면·표준 관리 상태',null,2,''),(11,'세척·급유 상태',null,2,''),
 (12,'안전장치 상태',null,2,''),(13,'고객 중요도',null,2,'')
on conflict (item_no) do nothing;

insert into public.ki_daily_item(side,item_no,item_name) values
 ('상형',1,'펀치 마모 · 치핑'),('상형',2,'스트리퍼 작동 상태'),('상형',3,'가이드포스트 · 부시 급유'),
 ('상형',4,'스프링 절손 · 처짐'),('상형',5,'체결 볼트 풀림'),('상형',6,'상형 세척 상태(이물)'),
 ('상형',7,'파일럿 핀 상태'),('상형',8,'미스피드 센서 작동'),
 ('하형',1,'다이 마모 · 치핑'),('하형',2,'리프터 작동 상태'),('하형',3,'스크랩 배출 상태'),
 ('하형',4,'하형 세척 상태(이물)'),('하형',5,'볼 포스트 상태'),('하형',6,'가이드핀 상태'),
 ('하형',7,'볼트 · 클램프 풀림'),('하형',8,'다이면 평탄 · 손상')
on conflict do nothing;

-- 점검주기 기준 (정기 · 세척)
insert into public.ki_cycle_rule(rule_id,kind,target,cycle_days,limit_shot,plan_months,label,sort_order,remark) values
 ('GRADE_A','정기','A',365,null,array[6],        '1회/년',    1,'총점 20점 이하'),
 ('GRADE_B','정기','B',180,null,array[3,9],      '1회/6개월', 2,'총점 21~38점'),
 ('GRADE_C','정기','C', 90,null,array[3,6,9,12], '1회/3개월', 3,'총점 39점 이상'),
 ('GRADE_F','정기','F',null,null,array[]::int[], '사용시',    4,'A/S · 단종 — 자동산정 제외'),
 ('WASH_MASS','세척','양산',365,1000000,null,'100만타 또는 1년', 11,'양산금형 정기세척'),
 ('WASH_AS'  ,'세척','A/S' ,365, 500000,null,'50만타 또는 1년',  12,'A/S금형 정기세척')
on conflict (rule_id) do nothing;

-- 정기세척 6단계
insert into public.ki_wash_step(step_no,step_name) values
 (1,'금형 분해 · 상하형 분리'),(2,'스크랩 · 이물 제거'),(3,'세척액 세정 (펀치 · 다이)'),
 (4,'건조 · 수분 제거'),(5,'방청유 · 급유'),(6,'조립 · 작동 확인')
on conflict (step_no) do nothing;

-- 금형 정기점검 항목
insert into public.ki_inspection_item(item_code,item_name,category,method,criteria,unit,sort_order)
select * from (values
 ('I01','외관 손상/균열','외관','육안','균열·파손 없을 것','-',1),
 ('I02','녹 발생 여부','외관','육안','녹 없을 것','-',2),
 ('I03','가이드 포스트 마모','기구','측정','0.05 이하','mm',3),
 ('I04','펀치 날 마모','기구','측정','0.03 이하','mm',4),
 ('I05','다이 클리어런스','기구','측정','설계치 ±0.01','mm',5),
 ('I06','스프링 자유장','기구','측정','초기치 95% 이상','mm',6),
 ('I07','볼트 체결 상태','기구','토크','규정 토크','N·m',7),
 ('I08','급유 상태','윤활','육안','유막 형성','-',8),
 ('I09','센서/배선 상태','전장','육안·통전','정상 동작','-',9),
 ('I10','타발수 누적','이력','카운터','수명 대비 90% 미만','SHOT',10)
) v(a,b,c,d,e,f,g)
where not exists (select 1 from public.ki_inspection_item);

-- 초기 관리자 : 사원 + Auth 계정 (hcsmart / 123456)  ★ 접속 후 즉시 변경할 것
insert into public.ki_employee(emp_no,user_id,emp_name,dept,position,factory,role,is_active,login_email)
values ('E001','hcsmart','관리자','시스템','과장','F1','관리자',true,'hcsmart@ki.local')
on conflict (emp_no) do nothing;

do $$
declare v_uid uuid;
begin
  select id into v_uid from auth.users where email='hcsmart@ki.local';
  if v_uid is null then
    v_uid := gen_random_uuid();
    -- ★ GoTrue 는 토큰 컬럼이 NULL 이면 로그인 시 500 오류가 발생하므로 빈 문자열로 채운다
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
                           confirmation_sent_at,last_sign_in_at,created_at,updated_at,
                           raw_app_meta_data,raw_user_meta_data,is_super_admin,
                           confirmation_token,recovery_token,email_change,
                           email_change_token_new,email_change_token_current,
                           phone_change,phone_change_token,reauthentication_token,
                           is_sso_user,is_anonymous)
    values('00000000-0000-0000-0000-000000000000',v_uid,'authenticated','authenticated',
           'hcsmart@ki.local',crypt('123456',gen_salt('bf')),now(),
           now(),now(),now(),now(),
           '{"provider":"email","providers":["email"]}'::jsonb,'{"emp_no":"E001"}'::jsonb,false,
           '','','','','','','','',false,false);
    insert into auth.identities(id,user_id,provider_id,identity_data,provider,
                                last_sign_in_at,created_at,updated_at)
    values(gen_random_uuid(),v_uid,v_uid::text,
      jsonb_build_object('sub',v_uid::text,'email','hcsmart@ki.local','email_verified',true),
      'email',now(),now(),now());
  end if;
  update public.ki_employee set auth_uid=v_uid where emp_no='E001';
end $$;

-- 수동 생성된 계정의 NULL 토큰 보정 (로그인 500 오류 방지)
update auth.users set
  confirmation_token         = coalesce(confirmation_token,''),
  recovery_token             = coalesce(recovery_token,''),
  email_change               = coalesce(email_change,''),
  email_change_token_new     = coalesce(email_change_token_new,''),
  email_change_token_current = coalesce(email_change_token_current,''),
  phone_change               = coalesce(phone_change,''),
  phone_change_token         = coalesce(phone_change_token,''),
  reauthentication_token     = coalesce(reauthentication_token,''),
  is_sso_user                = coalesce(is_sso_user,false),
  is_anonymous               = coalesce(is_anonymous,false)
where confirmation_token is null or recovery_token is null or email_change is null
   or email_change_token_new is null or email_change_token_current is null
   or phone_change is null or phone_change_token is null or reauthentication_token is null;

-- 관리자에게 전 화면 권한 부여 (ki_can 은 관리자를 무조건 통과시키므로 참고용)


-- ------------------------------------------------------------
-- 7) 확인
-- ------------------------------------------------------------
select 'tables' kind, count(*) cnt from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and c.relname like 'ki\_%'
union all
select 'views', count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='v' and c.relname like 'ki\_v\_%';

-- ------------------------------------------------------------
-- 8) 롤백 (KI MES 오브젝트만 제거 — 기존 시스템 테이블은 유지)
-- ------------------------------------------------------------
-- do $$
-- declare r record;
-- begin
--   for r in select c.relname n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
--            where ns.nspname='public' and c.relkind='v' and c.relname like 'ki\_v\_%'
--   loop execute format('drop view if exists public.%I cascade', r.n); end loop;
--   for r in select c.relname n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
--            where ns.nspname='public' and c.relkind='r' and c.relname like 'ki\_%'
--   loop execute format('drop table if exists public.%I cascade', r.n); end loop;
-- end $$;
