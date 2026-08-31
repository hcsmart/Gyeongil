-- ============================================================
-- KI MES 통합관리시스템 — 이전(Migration)용 전체 스크립트
--   모듈 : 금형 정기점검 / 외주 LOT관리 / 트윈팩토리 / 온습도 모니터링
--          + 기준정보 + 시스템(사용자·권한)
--
--   사용법
--     1) 대상 Supabase 프로젝트의 SQL Editor 에서 이 파일 전체 실행
--     2) ki_config.js 상단의 SUPABASE_URL / SUPABASE_KEY 두 줄 교체
--   ※ 화면은 ki_ 로 시작하는 오브젝트만 참조합니다.
--   ※ 한 프로젝트에 다른 MES 가 함께 얹혀 있어도 안전합니다.
--      GI MES 는 전용 테이블(ki_*)만 쓰고 레거시 공용 테이블은 읽지도 쓰지도 않습니다.
--      (레거시 DB 에서 넘어올 때만 5) 블록이 기준정보를 1회 복사합니다)
--   ※ 재실행 안전 : create table if not exists · drop view → create · on conflict do nothing.
--      기존 데이터는 보존됩니다.
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

/* --- 기준정보 : 금형 보관위치 --- */
create table if not exists public.ki_mold_location (
  location_code text primary key, location_name text not null,
  factory_code text, sort_order integer default 0,
  is_active boolean default true, remark text);

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
 ('ki_osp_order',array['osp-order','osp-stock','osp-issue','lot-route','lot-track','ven-stock']),
 ('ki_osp_receipt',array['osp-receipt']),
 ('ki_lot_progress',array['osp-order','lot-route','lot-track','lot-trace']),
 ('ki_std_route',array['std-route','lot-route','lot-track']),
 ('ki_lot_move',array['lot-route','lot-scan','lot-move','lot-track']),
 ('ki_lot_receipt',array['lot-route','lot-scan','lot-track']),
 ('ki_lot_token',array['lot-token','lot-track','lot-route','lot-scan']),
 ('ki_vendor',array['vendor','lot-route','lot-scan','osp-order','lot-track','ven-stock']),
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
 ('ki_cycle_rule',array['cycle-rule']),
 ('ki_mold_location',array['mold-loc'])
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

/* 점검 실적 통합 조회 (일상 / 정기 / 세척) */
create view public.ki_v_check_log with (security_invoker=true) as
select '정기'::text as kind, r.inspection_no::text as ref_no, r.inspection_date as check_date,
       r.mold_code, m.mold_name, m.customer_name,
       d.item_code, d.item_name, d.criteria, d.measured_value as value_note, d.result,
       r.inspector as worker, coalesce(d.remark, r.remark) as remark
from public.ki_inspection_detail d
join public.ki_inspection_result r on r.inspection_no = d.inspection_no
left join public.ki_mold m on m.mold_code = r.mold_code
union all
select '일상', c.check_id::text, c.check_date, c.mold_code, m.mold_name, m.customer_name,
       d.side || d.item_no::text, d.item_name, null, d.note, d.result, c.checker, c.issue
from public.ki_daily_check_detail d
join public.ki_daily_check c on c.check_id = d.check_id
left join public.ki_mold m on m.mold_code = c.mold_code
union all
select '세척', w.wash_id::text, w.wash_date, w.mold_code, m.mold_name, m.customer_name,
       w.wash_type || s.ord::text, s.step, null,
       case when w.shot_count is null then null else '누적 ' || w.shot_count::text end,
       w.judgement, w.worker, w.remark
from public.ki_wash w
left join public.ki_mold m on m.mold_code = w.mold_code
cross join lateral unnest(coalesce(w.steps, array['(세척항목 미기록)']))
           with ordinality s(step, ord);

/* 잔여 개방 정책 정리 — anon 허용 · 무조건 허용(auth_all) 제거
   (구버전에서 넘어온 정책이 남아 있으면 ki_can 권한 판정이 우회된다) */
do $$
declare r record;
begin
  for r in
    select c.relname t, p.polname n
    from pg_policy p join pg_class c on c.oid=p.polrelid
    join pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='public'
      and exists (select 1 from unnest(p.polroles) ro where ro::regrole::text = 'anon')
  loop execute format('drop policy if exists %I on public.%I', r.n, r.t); end loop;

  for r in
    select c.relname t, p.polname n
    from pg_policy p join pg_class c on c.oid=p.polrelid
    join pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='public'
      and c.relname in (select table_name from public.ki_table_menu)
      /* 다른 MES 와 공용으로 쓰는 레거시 테이블은 개방 정책을 그대로 둔다.
         (여기서 지우면 그쪽 시스템의 등록·수정이 막힌다) */
      and c.relname <> all (array['processes','vendors'])
      and coalesce(pg_get_expr(p.polqual,p.polrelid),'true')='true'
      and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'true')='true'
      and p.polname not like '%\_sel' and p.polname not like '%\_ins'
      and p.polname not like '%\_upd' and p.polname not like '%\_del'
      and p.polname not like 'ki\_%'
  loop execute format('drop policy if exists %I on public.%I', r.n, r.t); end loop;
end $$;

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
                    'ki_grade_item','ki_daily_item','ki_wash_step','ki_cycle_rule','ki_mold_location'];
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
-- 5) LOT관리 전용 테이블 (GI MES 전용)
--    ★ 이 프로젝트에는 다른 MES 가 함께 얹혀 있다.
--      예전에는 레거시 공용 테이블(outsourcing_* · machining_* · processes)을 뷰로 감싸 썼으나,
--      시연·운영 데이터가 서로 섞이는 문제가 있어 GI MES 전용 테이블로 완전히 분리했다.
--    ★ 레거시 테이블은 읽지도 쓰지도 않는다. (다른 MES 가 그대로 사용)
-- ------------------------------------------------------------
create table if not exists public.ki_process(
  process_code text primary key,
  process_name text,
  process_group text,
  sort_order numeric,
  completion_progress numeric,
  use_progress boolean,
  use_plan boolean,
  remark text
);

create table if not exists public.ki_std_route(
  row_no numeric,
  standard_process_no numeric primary key,
  standard_process_name text,
  steps jsonb default '[]'::jsonb,
  inhouse jsonb default '[]'::jsonb          -- 사내에서 수행하는 공정코드 배열
);

create table if not exists public.ki_lot_progress(
  "no" bigint generated by default as identity primary key,
  job text, proc text, part text, steps jsonb default '[]'::jsonb
);

create table if not exists public.ki_osp_order(
  "no" bigint generated by default as identity primary key,
  st text, vendor text, job text, item text, proc text, "procName" text,
  part text, "partName" text, mp text,
  odate text, edate text, idate text, cdate text,
  quote numeric, fix numeric, mold_no text, map_part text, sdate text,
  lot text, qty numeric, lots jsonb, route_no text, move_kind text default '외주'
);

create table if not exists public.ki_osp_receipt(
  "no" bigint generated by default as identity primary key,
  job text, item text, proc text, "procName" text, part text, "partName" text,
  mp text, "mpName" text, vendor text,
  odate text, idate text, cdate text, quote numeric, rate numeric, status text
);

create index if not exists ki_osp_order_part_idx    on public.ki_osp_order(part, "no");
create index if not exists ki_lot_progress_part_idx on public.ki_lot_progress(part);

/* 레거시 DB 에서 옮겨올 때만 실행되는 초기 복사 (원본이 있으면 기준정보만 가져온다) */
do $$
begin
  if to_regclass('public.processes') is not null then
    insert into public.ki_process
      select process_code, process_name, process_group, sort_order,
             completion_progress, use_progress, use_plan, remark
        from public.processes
    on conflict (process_code) do nothing;
  end if;
  if to_regclass('public.machining_standard_routes') is not null then
    insert into public.ki_std_route
      select row_no, standard_process_no, standard_process_name,
             coalesce(steps,'[]'::jsonb), coalesce(inhouse,'[]'::jsonb)
        from public.machining_standard_routes
    on conflict (standard_process_no) do nothing;
  end if;
end $$;

-- 전용 테이블 조회 뷰
drop view if exists public.ki_v_process cascade;
create view public.ki_v_process with (security_invoker=true) as
  select process_code, process_name, process_group, sort_order,
         completion_progress, use_progress, use_plan, remark
    from public.ki_process;

drop view if exists public.ki_v_std_route cascade;
create view public.ki_v_std_route with (security_invoker=true) as
  select row_no, standard_process_no, standard_process_name, steps,
         coalesce(inhouse,'[]'::jsonb) as inhouse
    from public.ki_std_route;

drop view if exists public.ki_v_lot_progress cascade;
create view public.ki_v_lot_progress with (security_invoker=true) as
  select "no", job, proc, part, coalesce(steps,'[]'::jsonb) as steps
    from public.ki_lot_progress;

drop view if exists public.ki_v_osp_order cascade;
create view public.ki_v_osp_order with (security_invoker=true) as
  select "no", st, vendor, job, item, proc, "procName", part, "partName", mp,
         mold_no, map_part, route_no, coalesce(move_kind,'외주') as move_kind,
         odate, sdate, edate, idate, cdate, quote, fix, lot, qty, lots
    from public.ki_osp_order;

drop view if exists public.ki_v_osp_receipt cascade;
create view public.ki_v_osp_receipt with (security_invoker=true) as
  select "no", job, item, proc, "procName", part, "partName", mp, "mpName", vendor,
         odate, idate, cdate, quote, rate, status
    from public.ki_osp_receipt;

revoke all on public.ki_v_process, public.ki_v_std_route, public.ki_v_lot_progress,
              public.ki_v_osp_order, public.ki_v_osp_receipt from anon;
grant select on public.ki_v_process, public.ki_v_std_route, public.ki_v_lot_progress,
                public.ki_v_osp_order, public.ki_v_osp_receipt to authenticated;

-- 공정코드 조회는 모든 로그인 사용자에게 (다른 화면이 공정명을 참조한다)
drop policy if exists ki_process_sel on public.ki_process;
create policy ki_process_sel on public.ki_process for select to authenticated
  using (public.ki_is_user());

-- identity 컬럼 시퀀스 사용 권한
do $$
declare s record;
begin
  for s in select sequencename n from pg_sequences
            where schemaname='public' and sequencename like 'ki\_%'
  loop execute format('grant usage, select on sequence public.%I to authenticated', s.n); end loop;
end $$;

-- ------------------------------------------------------------
-- 5-1) 외주 입고일 기록 시 LOT 이동이력 자동 반영 (트리거)
-- ------------------------------------------------------------
create or replace function public.ki_fn_lot_trace()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_steps jsonb; v_step jsonb; v_job text; v_proc text;
begin
  if new.idate is null or btrim(new.idate) = '' then return new; end if;
  if tg_op = 'UPDATE' and coalesce(old.idate,'') = coalesce(new.idate,'') then return new; end if;
  if new.part is null or new.mp is null then return new; end if;
  v_step := jsonb_build_object('mp', new.mp, 'vendor', coalesce(new.vendor,''), 'date', new.idate);
  /* LOT 번호 기준으로 기존 진행 행에 이어붙인다 */
  select steps, job, proc into v_steps, v_job, v_proc
    from public.ki_lot_progress where part = new.part order by no asc limit 1;
  if not found then
    insert into public.ki_lot_progress(job, proc, part, steps)
    values (new.job, new.proc, new.part, jsonb_build_array(v_step));
    return new;
  end if;
  v_steps := coalesce(v_steps, '[]'::jsonb);
  if exists (select 1 from jsonb_array_elements(v_steps) s
              where s->>'mp' = new.mp and s->>'date' = new.idate) then return new; end if;
  update public.ki_lot_progress
     set steps = v_steps || jsonb_build_array(v_step)
   where part = new.part
     and no = (select min(no) from public.ki_lot_progress where part = new.part);
  return new;
end $function$;

-- 반출건에 입고일이 기록되면 진행이력(ki_lot_progress)에 단계를 자동 추가
drop trigger if exists ki_trg_lot_trace on public.ki_osp_order;
create trigger ki_trg_lot_trace
  after insert or update on public.ki_osp_order
  for each row execute function public.ki_fn_lot_trace();

-- 순차 납품(분할 회수) : LOT 하나에 사내입고가 여러 번 나뉘어 들어올 수 있다.
--  · 과거에는 part 유니크 + on_conflict=part upsert 라서 나중 입고가 앞 입고를 덮어썼다.
--  · 이제 건별로 쌓고, 화면에서 누적(qty 합계)으로 판정한다.
drop index if exists public.ki_lot_receipt_part_uidx;
create index if not exists ki_lot_receipt_part_idx on public.ki_lot_receipt(part, in_date);

-- 오류 로그 (시스템 › 오류로그)
--  · 레거시 error_log 는 다른 MES 와 공용이므로 건드리지 않고 ki_error_log 를 따로 둔다.
--  · 기록은 로그인 사용자 누구나(오류 난 화면의 권한과 무관), 열람·삭제는 err-log 권한자만.
create table if not exists public.ki_error_log(
  err_id      bigserial primary key,
  occurred_at timestamptz not null default now(),
  level       text   not null default 'error',   -- error | warn | info
  kind        text,                              -- js | api | rpc | app
  menu        text,
  page        text,
  emp_no      text,
  emp_name    text,
  message     text   not null,
  detail      text,
  url         text,
  user_agent  text
);
create index if not exists ki_error_log_at_idx   on public.ki_error_log(occurred_at desc);
create index if not exists ki_error_log_menu_idx on public.ki_error_log(menu, occurred_at desc);

alter table public.ki_error_log enable row level security;
revoke all on public.ki_error_log from anon;
grant select, insert, delete on public.ki_error_log to authenticated;
grant usage, select on sequence public.ki_error_log_err_id_seq to authenticated;
drop policy if exists ki_error_log_ins on public.ki_error_log;
drop policy if exists ki_error_log_sel on public.ki_error_log;
drop policy if exists ki_error_log_del on public.ki_error_log;
create policy ki_error_log_ins on public.ki_error_log for insert to authenticated
  with check (public.ki_is_user());
create policy ki_error_log_sel on public.ki_error_log for select to authenticated
  using (public.ki_can_any(array['err-log'],'view'));
create policy ki_error_log_del on public.ki_error_log for delete to authenticated
  using (public.ki_can_any(array['err-log'],'delete'));
insert into public.ki_table_menu(table_name, menus) values
 ('ki_error_log', array['err-log'])
on conflict (table_name) do update set menus = excluded.menus;

drop view if exists public.ki_v_error_log cascade;
create view public.ki_v_error_log with (security_invoker=true) as
  select err_id, occurred_at, level, kind, menu, page, emp_no, emp_name,
         message, detail, url, user_agent
    from public.ki_error_log;
revoke all on public.ki_v_error_log from anon;
grant select on public.ki_v_error_log to authenticated;

-- 오래된 로그 정리 (화면 [오래된 로그 정리] 버튼)
create or replace function public.ki_error_log_purge(p_days integer default 90)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.ki_can_any(array['err-log'],'delete') then
    raise exception '오류로그 삭제 권한이 없습니다.';
  end if;
  delete from public.ki_error_log
   where occurred_at < now() - (greatest(coalesce(p_days,90),1) || ' days')::interval;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.ki_error_log_purge(integer) to authenticated;

-- 공정코드 기준정보 화면(process) — 등록 · 수정 · 삭제
--  · 전용 테이블(ki_process)을 쓰므로 다른 MES 의 공정코드와 분리된다.
insert into public.ki_table_menu(table_name, menus) values
 ('ki_process', array['process','std-route','lot-route','lot-track'])
on conflict (table_name) do update set menus = excluded.menus;

-- 협력사 뷰 : 담당자 · 공정코드 · 사용여부 · 정렬순서까지 노출
--  · select * 로 만든 뷰는 생성 시점 컬럼이 고정되므로, 테이블에 컬럼이 늘면 반드시 재생성한다.
--    (이 컬럼들이 빠져 있어 협력사 정보 조회가 400 으로 실패했다)
drop view if exists public.ki_v_vendor_stock cascade;
create view public.ki_v_vendor_stock with (security_invoker=true) as
with mv as (
  select osp_no,
         max(case when io in ('도착','입고') then in_qty end)    as arrived_qty,
         max(case when io in ('도착','입고') then move_date end) as arrived_date
    from public.ki_lot_move where osp_no is not null group by osp_no
),
out_next as (
  select osp_no, sum(coalesce(out_qty,0)) as moved_qty
    from public.ki_lot_move where io='출고' and osp_no is not null group by osp_no
)
select
  o.no as osp_no, o.vendor, v.contact_name,
  coalesce(v.contact_phone, v.phone) as contact_phone,
  o.part, o.job, o.mp, p.process_name as mp_name, o.map_part, o.mold_no,
  o.sdate as out_date, m.arrived_date::text as arrived_date,
  coalesce(o.qty,0) as out_qty, m.arrived_qty,
  coalesce(n.moved_qty,0) as moved_qty,
  greatest(coalesce(m.arrived_qty, o.qty, 0) - coalesce(n.moved_qty,0), 0) as stock_qty,
  case when m.arrived_qty is not null
       then greatest(coalesce(o.qty,0) - m.arrived_qty, 0) else 0 end as short_qty,
  greatest(current_date - nullif(o.sdate,'')::date, 0) as age_days,
  greatest(current_date - m.arrived_date, 0)           as work_days,
  case when m.arrived_date is null then '도착대기' else '작업중' end as stock_status,
  o.edate as due_date,
  case when nullif(o.edate,'') is null then '-'
       when nullif(o.edate,'')::date < current_date then '지연'
       when nullif(o.edate,'')::date <= current_date + 3 then '임박'
       else '정상' end as due_status
from public.ki_osp_order o
left join mv m on m.osp_no = o.no
left join out_next n on n.osp_no = o.no
left join public.ki_vendor v on v.vendor_name = o.vendor
left join public.ki_process p on p.process_code = o.mp
where nullif(o.sdate,'') is not null
  and nullif(o.idate,'') is null
  and greatest(coalesce(m.arrived_qty, o.qty, 0) - coalesce(n.moved_qty,0), 0) > 0;

-- 무인증(anon) 은 뷰에 직접 접근할 수 없다 (협력사 QR 은 ki_scan_* RPC 경로만 사용)
revoke all on public.ki_v_osp_order, public.ki_v_lot_move,
              public.ki_v_lot_receipt, public.ki_v_vendor_stock from anon;

-- 공정이동표 발행이력 뷰 (LOT관리 › lot-token)
--  · status : 폐기(revoked) / 만료(expires_at 경과) / 유효
--  · job    : 동일 LOT의 최신 진행행에서 가져옴 (없으면 null)
drop view if exists public.ki_v_lot_token cascade;
create view public.ki_v_lot_token as
select
  t.token,
  t.part,
  (select p.job from public.ki_lot_progress p
     where p.part = t.part order by p.no desc limit 1) as job,
  case when coalesce(t.revoked,false) then '폐기'
       when t.expires_at is not null and t.expires_at < now() then '만료'
       else '유효' end                          as status,
  t.issued_at,
  t.issued_by,
  t.expires_at,
  t.last_used_at,
  coalesce(t.use_count,0)                        as use_count,
  t.remark
from public.ki_lot_token t;
grant select on public.ki_v_lot_token to anon, authenticated;

-- 모든 ki_v_* 뷰 조회 권한
do $$
declare r record;
begin
  for r in select c.relname n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
           where ns.nspname='public' and c.relkind='v' and c.relname like 'ki\_v\_%'
  loop execute format('grant select on public.%I to authenticated', r.n); end loop;
end $$;



-- ------------------------------------------------------------
-- 5-3) 그동안 별도 SQL 로 추가돼 있던 오브젝트 (여기로 통합)
--   · 예전에는 ki_inhouse_move.sql · ki_vendor_stock.sql 등으로 나뉘어 있어
--     이 파일만으로는 새 환경을 세울 수 없었다. 이제 이 파일 하나로 완결된다.
-- ------------------------------------------------------------
create table if not exists public.ki_vendor(
  vendor_code text primary key,
  vendor_name text not null,
  vendor_type text, partner_type text, location_type text,
  ceo_name text, phone text, email text, address text,
  contact_name text, contact_phone text, proc_codes text,
  outsourcing_flag boolean default true,
  milling_flag boolean default false,
  is_active boolean default true,
  sort_order integer default 0,
  remark text,
  updated_at timestamptz default now()
);

create table if not exists public.ki_lot_move(
  move_id bigserial primary key,
  part text not null,
  osp_no bigint,
  io text not null,                      -- 출고 · 도착 · 입고 · 사내입고 · 기록
  mp text, vendor text,
  move_date date default current_date,
  out_qty numeric, in_qty numeric, short_qty numeric default 0,
  reason text, remark text, worker text,
  source text default 'QR',              -- QR · 수동 · SIM
  created_at timestamptz default now(),
  move_kind text default '외주'
);

create table if not exists public.ki_lot_receipt(
  receipt_id bigserial primary key,
  part text not null, job text,
  in_date date default current_date,
  qty numeric, short_qty numeric default 0,
  reason text, worker text, remark text,
  created_at timestamptz default now()
);

create table if not exists public.ki_lot_token(
  token text primary key,
  part text not null,
  issued_by text,
  issued_at timestamptz default now(),
  expires_at timestamptz,
  revoked boolean default false,
  last_used_at timestamptz,
  use_count integer default 0,
  remark text
);

create table if not exists public.ki_notify_config(
  id integer primary key default 1,
  andon_enabled boolean default true,
  ntfy_enabled boolean default false,
  ntfy_url text default 'https://ntfy.sh',
  ntfy_topic text,
  ntfy_priority integer default 4,
  alert_level text default '도래',
  poll_sec integer default 60,
  updated_at timestamptz default now(),
  updated_by text
);

create table if not exists public.ki_tool_rule(
  rule_id text primary key,
  kind text not null,
  target text not null default 'ALL',
  part_name text default '공통',
  limit_shot numeric, cycle_days integer,
  warn_pct numeric default 90,
  label text, sort_order integer default 0,
  is_active boolean default true, remark text,
  updated_at timestamptz default now()
);

create table if not exists public.ki_mold_tool(
  mold_code text not null,
  kind text not null,
  part_name text default '공통',
  use_common boolean default true,
  limit_shot numeric, cycle_days integer, warn_pct numeric,
  last_date date, last_shot numeric,
  is_active boolean default true, remark text,
  updated_at timestamptz default now(),
  primary key (mold_code, kind)
);

create table if not exists public.ki_tool_alert(
  alert_id bigserial primary key,
  occurred_at timestamptz default now(),
  mold_code text, kind text, part_name text,
  level text default '도래',
  reason text, shot_count numeric, limit_shot numeric, used_shot numeric,
  days_left integer, message text,
  status text default '발생',
  notified boolean default false, notified_at timestamptz,
  action text, closed_at timestamptz, closed_by text
);

create table if not exists public.ki_shot_daily(
  mold_code text not null,
  work_date date not null,
  machine_no text, shot_qty numeric default 0, counter_end numeric,
  worker text, remark text,
  updated_at timestamptz default now(),
  primary key (mold_code, work_date)
);

/* 기준정보 · 점검 관련 단순 조회 뷰 */
drop view if exists public.ki_v_vendor cascade;
create view public.ki_v_vendor with (security_invoker=true) as
  select vendor_code, vendor_name, vendor_type, partner_type, location_type,
         ceo_name, phone, email, address, contact_name, contact_phone, proc_codes,
         outsourcing_flag, milling_flag, is_active, sort_order, remark, updated_at
    from public.ki_vendor;

drop view if exists public.ki_v_employee cascade;
create view public.ki_v_employee with (security_invoker=true) as
  select emp_no, emp_name, dept, "position", factory, role, hire_date, phone,
         is_active, remark, updated_at, user_id, name_en, pw, user_group,
         proc_group, biz_div, mobile, email, login_email, reg_date, auth_uid
    from public.ki_employee;

drop view if exists public.ki_v_mold cascade;
create view public.ki_v_mold with (security_invoker=true) as
  select mold_code, mold_name, customer_name, model, mold_type, factory_code, location,
         shot_count, shot_limit, cycle_days, last_inspection, next_inspection, status,
         remark, updated_at, mold_no, grade, machine_no, prod_type, shot_base
    from public.ki_mold;

drop view if exists public.ki_v_mold_type cascade;
create view public.ki_v_mold_type with (security_invoker=true) as
  select mold_type_code, mold_type_name, sort_order, remark from public.ki_mold_type;

drop view if exists public.ki_v_material cascade;
create view public.ki_v_material with (security_invoker=true) as
  select material_code, material_name, density, sort_order, remark from public.ki_material;

drop view if exists public.ki_v_machine cascade;
create view public.ki_v_machine with (security_invoker=true) as
  select machine_no, machine_name, tonnage, sort_order, is_active, remark from public.ki_machine;

drop view if exists public.ki_v_mold_location cascade;
create view public.ki_v_mold_location with (security_invoker=true) as
  select location_code, location_name, factory_code, sort_order, is_active, remark
    from public.ki_mold_location;

drop view if exists public.ki_v_inspection_item cascade;
create view public.ki_v_inspection_item with (security_invoker=true) as
  select item_code, item_name, category, method, criteria, unit, sort_order, is_active
    from public.ki_inspection_item;

drop view if exists public.ki_v_daily_item cascade;
create view public.ki_v_daily_item with (security_invoker=true) as
  select side, item_no, item_name, is_active from public.ki_daily_item;

drop view if exists public.ki_v_wash_step cascade;
create view public.ki_v_wash_step with (security_invoker=true) as
  select step_no, step_name, is_active from public.ki_wash_step;

drop view if exists public.ki_v_grade_item cascade;
create view public.ki_v_grade_item with (security_invoker=true) as
  select item_no, item_name, auto_source, default_score, remark from public.ki_grade_item;

drop view if exists public.ki_v_cycle_rule cascade;
create view public.ki_v_cycle_rule with (security_invoker=true) as
  select rule_id, kind, target, cycle_days, limit_shot, plan_months, label,
         sort_order, is_active, remark, updated_at from public.ki_cycle_rule;

drop view if exists public.ki_v_factory cascade;
create view public.ki_v_factory with (security_invoker=true) as
  select factory_code, factory_name, width_m, height_m, remark from public.ki_factory;

drop view if exists public.ki_v_zone cascade;
create view public.ki_v_zone with (security_invoker=true) as
  select zone_code, factory_code, zone_name, x, y, w, h, color, remark from public.ki_zone;

drop view if exists public.ki_v_asset cascade;
create view public.ki_v_asset with (security_invoker=true) as
  select asset_code, factory_code, zone_code, asset_name, asset_type, x, y,
         status, spec, last_signal, remark from public.ki_asset;

drop view if exists public.ki_v_sensor cascade;
create view public.ki_v_sensor with (security_invoker=true) as
  select sensor_code, factory_code, zone_code, sensor_name, x, y,
         temp_min, temp_max, humi_min, humi_max, is_active, remark from public.ki_sensor;

/* LOT 이력 뷰 */
drop view if exists public.ki_v_lot_move cascade;
create view public.ki_v_lot_move with (security_invoker=true) as
  select move_id, part, osp_no, io, coalesce(move_kind,'외주') as move_kind,
         mp, vendor, move_date, out_qty, in_qty, short_qty,
         reason, remark, worker, source, created_at
    from public.ki_lot_move;

drop view if exists public.ki_v_lot_receipt cascade;
create view public.ki_v_lot_receipt with (security_invoker=true) as
  select receipt_id, part, job, in_date, qty, short_qty,
         reason, worker, remark, created_at
    from public.ki_lot_receipt;


/* 일별 타발수 → 금형대장 누적 · 월별 대장 자동 반영 */
create or replace function public.ki_fn_shot_daily_sync()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_code text; v_year integer; v_base numeric; v_total numeric;
        m integer; v_cum numeric; v_first integer; v_last integer;
begin
  v_code := coalesce(new.mold_code, old.mold_code);
  v_year := extract(year from coalesce(new.work_date, old.work_date))::int;
  select coalesce(shot_base,0) into v_base from public.ki_mold where mold_code = v_code;
  if v_base is null then return null; end if;
  select coalesce(sum(shot_qty),0) into v_total from public.ki_shot_daily where mold_code = v_code;
  update public.ki_mold set shot_count = v_base + v_total, updated_at = now()
   where mold_code = v_code;
  select min(extract(month from work_date))::int, max(extract(month from work_date))::int
    into v_first, v_last
    from public.ki_shot_daily
   where mold_code = v_code and extract(year from work_date)::int = v_year;
  if v_first is null then return null; end if;
  insert into public.ki_shot_ledger(mold_code, year) values (v_code, v_year)
  on conflict (mold_code, year) do nothing;
  for m in 1..12 loop
    if m = v_first - 1 then
      v_cum := v_base;
    elsif m >= v_first and m <= v_last then
      select v_base + coalesce(sum(shot_qty),0) into v_cum from public.ki_shot_daily
       where mold_code = v_code
         and work_date < (make_date(v_year,m,1) + interval '1 month')::date;
    elsif m > v_last then
      v_cum := null;
    else
      continue;
    end if;
    execute format('update public.ki_shot_ledger set m%s = $1, updated_at = now()
                     where mold_code = $2 and year = $3', m)
      using v_cum, v_code, v_year;
  end loop;
  return null;
end $function$;

drop trigger if exists ki_trg_shot_daily on public.ki_shot_daily;
create trigger ki_trg_shot_daily
  after insert or update or delete on public.ki_shot_daily
  for each row execute function public.ki_fn_shot_daily_sync();

-- ------------------------------------------------------------
-- 5-2) 공정이동표 QR — 무인증 접근용 RPC
--   · 협력사는 계정 없이 QR(토큰)만으로 그 LOT 하나만 열람 · 기록한다.
--   · 모두 SECURITY DEFINER 이며 첫 인자로 토큰을 받아 ki_scan_part() 로 검증한다.
--     (테이블 직접 접근은 anon 에게 막혀 있고, 이 함수들만 열려 있다)
-- ------------------------------------------------------------
create or replace function public.ki_scan_part(p_token text)
returns text language plpgsql security definer set search_path to 'public' as $function$
declare v_part text;
begin
  select part into v_part from public.ki_lot_token
   where token = p_token and not coalesce(revoked,false)
     and (expires_at is null or expires_at > now());
  if v_part is null then raise exception '유효하지 않거나 만료된 공정이동표입니다.'; end if;
  update public.ki_lot_token
     set last_used_at = now(), use_count = coalesce(use_count,0)+1
   where token = p_token;
  return v_part;
end $function$;

/* 잔량 : 최근 도착·입고 수량(없으면 반출수량) − 이후 출고 합계 */
create or replace function public.ki_scan_base(p_osp_no bigint)
returns numeric language sql stable security definer set search_path to 'public' as $function$
  select greatest(
    coalesce(
      (select m.in_qty from public.ki_lot_move m
        where m.osp_no = p_osp_no and m.io in ('도착','입고') and m.in_qty is not null
        order by m.created_at desc limit 1),
      (select o.qty from public.ki_osp_order o where o.no = p_osp_no))
    - coalesce((select sum(m2.out_qty) from public.ki_lot_move m2
                 where m2.osp_no = p_osp_no and m2.io = '출고'), 0)
  , 0);
$function$;

/* 이동구분 : 표준경로의 inhouse 우선 → 실제 이동건 → 기본 외주 */
create or replace function public.ki_move_kind(p_part text, p_mp text)
returns text language sql stable security definer set search_path to 'public' as $function$
  select coalesce(
    (select case when coalesce(r.inhouse,'[]'::jsonb) ? p_mp then '사내' else '외주' end
       from public.ki_std_route r
      where r.standard_process_no::text = (
              select o.route_no from public.ki_osp_order o
               where o.part = p_part and o.route_no is not null order by o.no desc limit 1)
        and coalesce(r.steps,'[]'::jsonb) ? p_mp
      limit 1),
    (select o2.move_kind from public.ki_osp_order o2
      where o2.part = p_part and o2.mp = p_mp and o2.move_kind is not null
      order by o2.no desc limit 1),
    '외주');
$function$;

/* 스캔 시 화면에 필요한 정보 일괄 조회 */
create or replace function public.ki_scan_info(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_part text; v_route text; v_res jsonb;
begin
  v_part := public.ki_scan_part(p_token);
  select route_no into v_route from public.ki_osp_order
   where part = v_part and route_no is not null order by no desc limit 1;
  select jsonb_build_object(
    'part', v_part,
    'lot',  (select to_jsonb(x) from (select no, job, proc, part, steps
               from public.ki_lot_progress where part = v_part order by no asc limit 1) x),
    'osp',  coalesce((select jsonb_agg(to_jsonb(y) order by y.no)
               from (select no, job, mp, vendor, sdate, idate, edate, qty,
                            map_part, mold_no, route_no, coalesce(move_kind,'외주') as move_kind
                       from public.ki_osp_order where part = v_part) y), '[]'::jsonb),
    'route',(select to_jsonb(r) from (select standard_process_no, standard_process_name, steps,
                            coalesce(inhouse,'[]'::jsonb) as inhouse
               from public.ki_std_route where standard_process_no::text = v_route limit 1) r),
    'moves',coalesce((select jsonb_agg(to_jsonb(m) order by m.move_date desc, m.move_id desc)
               from (select move_id, osp_no, io, coalesce(move_kind,'외주') as move_kind,
                            mp, vendor, move_date, out_qty, in_qty, short_qty,
                            reason, remark, worker, created_at
                       from public.ki_lot_move where part = v_part
                      order by move_date desc, move_id desc limit 30) m), '[]'::jsonb),
    'receipt',(select to_jsonb(c) from (select in_date, qty, short_qty
               from public.ki_lot_receipt where part = v_part limit 1) c),
    'vendors',coalesce((select jsonb_agg(v.vendor_name order by v.sort_order, v.vendor_name)
               from public.ki_vendor v where coalesce(v.is_active,true)
                and (coalesce(v.outsourcing_flag,false) or coalesce(v.milling_flag,false))), '[]'::jsonb),
    'sites',  coalesce((select jsonb_agg(distinct s.vendor) from public.ki_osp_order s
              where s.move_kind = '사내' and coalesce(btrim(s.vendor),'') <> ''), '[]'::jsonb),
    'procs',  coalesce((select jsonb_agg(jsonb_build_object('c',process_code,'n',process_name)
                                          order by sort_order) from public.ki_process), '[]'::jsonb)
  ) into v_res;
  return v_res;
end $function$;

/* 도착확인 (p_close=true 면 사내 복귀 입고로 반출건 마감) */
create or replace function public.ki_scan_arrive(
  p_token text, p_no bigint, p_vendor text, p_date date, p_qty numeric,
  p_reason text, p_remark text, p_close boolean, p_worker text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_part text; v_o record; v_base numeric; v_short numeric;
begin
  v_part := public.ki_scan_part(p_token);
  select * into v_o from public.ki_osp_order where no = p_no and part = v_part;
  if not found then raise exception '이 이동표의 이동건이 아닙니다.'; end if;
  v_base  := public.ki_scan_base(p_no);
  v_short := greatest(v_base - coalesce(p_qty,0), 0);
  if coalesce(p_close,false) then
    update public.ki_osp_order
       set idate = coalesce(p_date, current_date)::text, st = '완료' where no = p_no;
  end if;
  insert into public.ki_lot_move(part, osp_no, io, move_kind, mp, vendor, move_date,
    out_qty, in_qty, short_qty, reason, remark, worker, source)
  values (v_part, p_no, case when coalesce(p_close,false) then '입고' else '도착' end,
    coalesce(v_o.move_kind,'외주'),
    v_o.mp, coalesce(nullif(btrim(p_vendor),''), v_o.vendor), coalesce(p_date, current_date),
    v_base, p_qty, v_short, nullif(btrim(p_reason),''), nullif(btrim(p_remark),''),
    nullif(btrim(p_worker),''), 'QR');
  return jsonb_build_object('ok',true,'base',v_base,'short',v_short,
                            'closed',coalesce(p_close,false),'kind',coalesce(v_o.move_kind,'외주'));
end $function$;

/* 출고 : 다음 공정으로 이관 (부분출고 시 잔량을 원 반출건에 유지) */
create or replace function public.ki_scan_out(
  p_token text, p_from bigint, p_mp text, p_vendor text, p_date date,
  p_qty numeric, p_remark text, p_worker text, p_kind text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_part text; v_last record; v_src record; v_rem numeric; v_left numeric; v_kind text;
begin
  v_part := public.ki_scan_part(p_token);
  if coalesce(btrim(p_mp),'')='' then raise exception '가공공정을 선택하세요.'; end if;
  v_kind := case when btrim(coalesce(p_kind,'')) in ('사내','외주')
                 then btrim(p_kind) else public.ki_move_kind(v_part, p_mp) end;
  if coalesce(btrim(p_vendor),'')='' then
    if v_kind = '사내' then raise exception '사내 이동처(작업장·부서)를 입력하세요.';
    else raise exception '외주처를 선택하세요.'; end if;
  end if;
  if coalesce(p_qty,0) <= 0 then raise exception '출고수량을 입력하세요.'; end if;
  select * into v_last from public.ki_osp_order where part = v_part order by no desc limit 1;
  v_left := null;
  if p_from is not null then
    select * into v_src from public.ki_osp_order where no = p_from and part = v_part;
    if not found then raise exception '이 이동표의 이동건이 아닙니다.'; end if;
    v_rem := public.ki_scan_base(p_from);
    if p_qty > v_rem then
      raise exception '출고수량(%)이 잔량(%)보다 많습니다.', p_qty, v_rem;
    end if;
    v_left := greatest(v_rem - p_qty, 0);
  end if;
  insert into public.ki_osp_order
    (part, job, mp, vendor, map_part, mold_no, route_no, move_kind, lot, qty, lots, sdate, st)
  values (v_part, v_last.job, p_mp, p_vendor,
    v_last.map_part, v_last.mold_no, v_last.route_no, v_kind, v_part, p_qty,
    jsonb_build_array(jsonb_build_object('lot', v_part, 'qty', p_qty)),
    coalesce(p_date, current_date)::text, '진행');
  insert into public.ki_lot_move(part, osp_no, io, move_kind, mp, vendor, move_date,
    out_qty, short_qty, remark, worker, source)
  values (v_part, p_from, '출고', v_kind, p_mp, p_vendor, coalesce(p_date, current_date),
    p_qty, 0,
    nullif(btrim(coalesce(case when v_left > 0
      then '부분출고 — 잔량 ' || v_left::text || ' 유지. ' else '' end,'') ||
      '[' || v_kind || '] ' || coalesce(p_remark,'')),''),
    nullif(btrim(p_worker),''), 'QR');
  if p_from is not null and coalesce(v_left,0) <= 0 then
    update public.ki_osp_order
       set idate = coalesce(p_date, current_date)::text, st = '완료' where no = p_from;
  end if;
  return jsonb_build_object('ok',true,'left',v_left,'kind',v_kind);
end $function$;

/* 사내입고(종결) — 순차 납품이면 건별로 쌓인다 */
create or replace function public.ki_scan_home(
  p_token text, p_date date, p_qty numeric, p_reason text, p_remark text, p_worker text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_part text; v_job text; v_base numeric; v_short numeric; v_kind text;
begin
  v_part := public.ki_scan_part(p_token);
  select job, qty into v_job, v_base from public.ki_osp_order
   where part = v_part order by no asc limit 1;
  v_short := greatest(coalesce(v_base,0) - coalesce(p_qty,0), 0);
  select coalesce(move_kind,'외주') into v_kind from public.ki_osp_order
   where part = v_part order by no desc limit 1;
  insert into public.ki_lot_receipt(part, job, in_date, qty, short_qty, reason, worker, remark)
  values (v_part, v_job, coalesce(p_date, current_date), p_qty, v_short,
          nullif(btrim(p_reason),''), nullif(btrim(p_worker),''), nullif(btrim(p_remark),''));
  insert into public.ki_lot_move(part, io, move_kind, move_date, out_qty, in_qty, short_qty,
                                 reason, remark, worker, source)
  values (v_part, '사내입고', coalesce(v_kind,'외주'), coalesce(p_date, current_date),
          v_base, p_qty, v_short,
          nullif(btrim(p_reason),''), nullif(btrim(p_remark),''), nullif(btrim(p_worker),''), 'QR');
  update public.ki_lot_token set revoked = true where part = v_part;
  return jsonb_build_object('ok',true,'base',v_base,'short',v_short);
end $function$;

/* 특기사항 기록 */
create or replace function public.ki_scan_memo(
  p_token text, p_remark text, p_mp text default null, p_vendor text default null,
  p_reason text default null, p_worker text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_part text; v_mp text; v_ven text; v_kind text;
begin
  v_part := public.ki_scan_part(p_token);
  if coalesce(btrim(p_remark),'')='' then raise exception '특기사항을 입력하세요.'; end if;
  v_mp  := nullif(btrim(coalesce(p_mp,'')),'');
  v_ven := nullif(btrim(coalesce(p_vendor,'')),'');
  if v_mp is not null and v_ven is null then
    select vendor into v_ven from public.ki_osp_order
     where part = v_part and mp = v_mp order by no desc limit 1;
  end if;
  v_kind := case when v_mp is null then null else public.ki_move_kind(v_part, v_mp) end;
  insert into public.ki_lot_move(part, io, move_kind, mp, vendor, move_date,
                                 reason, remark, worker, source)
  values (v_part, '기록', v_kind, v_mp, v_ven, current_date,
          nullif(btrim(coalesce(p_reason,'')),''), btrim(p_remark),
          nullif(btrim(p_worker),''), 'QR');
  return jsonb_build_object('ok',true,'mp',v_mp,'vendor',v_ven,'kind',v_kind);
end $function$;

/* 협력사 목록 (모바일 첫 화면 · 업체 변경용) */
create or replace function public.ki_vendor_list()
returns jsonb language sql security definer set search_path to 'public' as $function$
  select coalesce(jsonb_agg(v.vendor_name order by v.sort_order, v.vendor_name), '[]'::jsonb)
    from public.ki_vendor v
   where coalesce(v.is_active,true)
     and (coalesce(v.outsourcing_flag,false) or coalesce(v.milling_flag,false));
$function$;

/* 이동표 토큰 발행 · 폐기 (사내 담당자용 — 로그인 필요) */
create or replace function public.ki_lot_token_issue(p_part text, p_days integer default 365)
returns text language plpgsql security definer set search_path to 'public' as $function$
declare v_tok text; v_by text;
begin
  if not public.ki_is_user() then raise exception '권한이 없습니다.'; end if;
  if coalesce(btrim(p_part),'') = '' then raise exception 'LOT 번호가 없습니다.'; end if;
  select token into v_tok from public.ki_lot_token
   where part = p_part and not coalesce(revoked,false)
     and (expires_at is null or expires_at > now())
   order by issued_at desc limit 1;
  if v_tok is not null then return v_tok; end if;
  select coalesce(emp_name, emp_no) into v_by from public.ki_employee where auth_uid = auth.uid();
  v_tok := replace(gen_random_uuid()::text,'-','') || substr(replace(gen_random_uuid()::text,'-',''),1,8);
  insert into public.ki_lot_token(token, part, issued_by, expires_at)
  values (v_tok, p_part, v_by, now() + make_interval(days => greatest(coalesce(p_days,365),1)));
  return v_tok;
end $function$;

create or replace function public.ki_lot_token_revoke(p_part text)
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare n integer;
begin
  if not public.ki_is_user() then raise exception '권한이 없습니다.'; end if;
  update public.ki_lot_token set revoked = true
   where part = p_part and not coalesce(revoked,false);
  get diagnostics n = row_count;
  return n;
end $function$;

/* 무인증(anon) 은 이 함수들만 실행할 수 있다 — 테이블 직접 접근은 막혀 있다 */
grant execute on function
  public.ki_scan_part(text), public.ki_scan_base(bigint), public.ki_scan_info(text),
  public.ki_scan_arrive(text,bigint,text,date,numeric,text,text,boolean,text),
  public.ki_scan_out(text,bigint,text,text,date,numeric,text,text,text),
  public.ki_scan_home(text,date,numeric,text,text,text),
  public.ki_scan_memo(text,text,text,text,text,text),
  public.ki_move_kind(text,text), public.ki_vendor_list()
  to anon, authenticated;
grant execute on function
  public.ki_lot_token_issue(text,integer), public.ki_lot_token_revoke(text)
  to authenticated;

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

-- 금형 보관위치 초기값
insert into public.ki_mold_location(location_code,location_name,sort_order,remark) values
 ('현장','현장 (프레스 장착)',90,'생산 중'),('외주','외주처 반출',91,'수리 · 가공 반출')
on conflict (location_code) do nothing;

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
--    · 기대값 : 테이블 46 · 뷰 43 · 함수 19 (2026-08 기준)
--    · 레거시 참조가 0 이어야 다른 MES 와 완전히 분리된 상태다.
-- ------------------------------------------------------------
select 'tables' kind, count(*) cnt from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and c.relname like 'ki\_%'
union all
select 'views', count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='v' and c.relname like 'ki\_v\_%'
union all
select 'functions', count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like 'ki\_%'
union all
select '레거시 참조(0이어야 정상)', count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like 'ki\_%'
   and (p.prosrc like '%outsourcing_order_status_rows%'
     or p.prosrc like '%machining_purchase_progress_rows%'
     or p.prosrc like '%machining_standard_routes%'
     or p.prosrc like '%public.processes%' or p.prosrc like '%public.vendors%');

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
