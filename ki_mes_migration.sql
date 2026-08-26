-- ============================================================
-- KI MES 통합관리시스템 — 이전용 스크립트
-- 금형 정기점검 / 외주 LOT관리 / 트윈팩토리 / 온습도 모니터링
-- 대상 Supabase의 SQL Editor에서 실행
-- 화면(index.html)은 ki_* 오브젝트만 참조하므로
-- 이 파일만 실행하면 DB 준비 완료
-- ============================================================

-- ------------------------------------------------------------
-- 1) 자체 테이블 : 설정(PIN)
-- ------------------------------------------------------------
create table if not exists public.ki_app_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

alter table public.ki_app_settings enable row level security;

drop policy if exists ki_app_settings_anon_rw on public.ki_app_settings;
create policy ki_app_settings_anon_rw on public.ki_app_settings
  for all to anon using (true) with check (true);

drop policy if exists ki_app_settings_auth_rw on public.ki_app_settings;
create policy ki_app_settings_auth_rw on public.ki_app_settings
  for all to authenticated using (true) with check (true);

-- 초기 비밀번호 123456 (SHA-256)
insert into public.ki_app_settings(key, value, updated_by) values
  ('pin_master','8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92','init'),
  ('pin_user',  '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92','init')
on conflict (key) do nothing;

grant select, insert, update on public.ki_app_settings to anon, authenticated;


-- ------------------------------------------------------------
-- 2) 핵심 4모듈 테이블
-- ------------------------------------------------------------

/* --- 금형 정기점검 --- */
create table if not exists public.ki_mold (
  mold_code text primary key, mold_name text, customer_name text, model text, mold_type text,
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

/* --- RLS / 권한 --- */
do $$
declare t text; tbls text[] := array[
  'ki_mold','ki_inspection_item','ki_inspection_result','ki_inspection_detail',
  'ki_factory','ki_zone','ki_asset','ki_sensor','ki_env_reading','ki_env_alert'];
begin
  foreach t in array tbls loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_anon_rw', t);
    execute format('create policy %I on public.%I for all to anon using (true) with check (true)', t||'_anon_rw', t);
    execute format('drop policy if exists %I on public.%I', t||'_auth_rw', t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', t||'_auth_rw', t);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
  end loop;
end $$;
grant usage, select on all sequences in schema public to anon, authenticated;


-- ------------------------------------------------------------
-- 2-1) 모듈 조회 뷰
-- ------------------------------------------------------------
create or replace view public.ki_v_mold_due with (security_invoker = true) as
select m.mold_code, m.mold_name, m.customer_name, m.model, m.mold_type, m.factory_code, m.location,
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

create or replace view public.ki_v_inspection_history with (security_invoker = true) as
select r.inspection_no, r.inspection_date, r.mold_code, m.mold_name, m.customer_name,
       r.inspector, r.shot_count, r.judgement, r.defect_count,
       r.action_taken, r.next_inspection, r.remark
from public.ki_inspection_result r left join public.ki_mold m on m.mold_code = r.mold_code;

create or replace view public.ki_v_inspection_detail with (security_invoker = true) as
select d.inspection_no, r.inspection_date, r.mold_code, m.mold_name,
       d.item_code, d.item_name, d.criteria, d.measured_value, d.result, d.remark
from public.ki_inspection_detail d
left join public.ki_inspection_result r on r.inspection_no = d.inspection_no
left join public.ki_mold m on m.mold_code = r.mold_code;

create or replace view public.ki_v_asset_status with (security_invoker = true) as
select a.asset_code, a.factory_code, f.factory_name, a.zone_code, z.zone_name,
       a.asset_name, a.asset_type, a.status, a.spec, a.x, a.y, a.last_signal, a.remark
from public.ki_asset a
left join public.ki_factory f on f.factory_code = a.factory_code
left join public.ki_zone z on z.zone_code = a.zone_code;

create or replace view public.ki_v_env_latest with (security_invoker = true) as
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

create or replace view public.ki_v_env_history with (security_invoker = true) as
select e.reading_id, e.sensor_code, s.sensor_name, s.zone_code, e.measured_at, e.temperature, e.humidity
from public.ki_env_reading e left join public.ki_sensor s on s.sensor_code = e.sensor_code;

create or replace view public.ki_v_env_alert with (security_invoker = true) as
select a.alert_id, a.occurred_at, a.sensor_code, s.sensor_name, s.zone_code,
       a.alert_type, a.value, a.threshold, a.status, a.action
from public.ki_env_alert a left join public.ki_sensor s on s.sensor_code = a.sensor_code;

create or replace view public.ki_v_mold            with (security_invoker=true) as select * from public.ki_mold;
create or replace view public.ki_v_inspection_item with (security_invoker=true) as select * from public.ki_inspection_item;
create or replace view public.ki_v_factory         with (security_invoker=true) as select * from public.ki_factory;
create or replace view public.ki_v_zone            with (security_invoker=true) as select * from public.ki_zone;
create or replace view public.ki_v_sensor          with (security_invoker=true) as select * from public.ki_sensor;


-- ------------------------------------------------------------
-- 2-2) 외주 LOT관리 : 기존 시스템 테이블을 감싼 뷰
--      ★ 대상 DB의 원천 테이블명이 다르면 from 절만 수정
-- ------------------------------------------------------------
create or replace view public.ki_v_osp_order with (security_invoker = true) as
select "no", st, vendor, job, item, proc, "procName", part, "partName", mp,
       odate, edate, idate, cdate, quote, fix
from public.outsourcing_order_status_rows;

create or replace view public.ki_v_osp_receipt with (security_invoker = true) as
select "no", status, job, item, proc, "procName", part, "partName", mp, "mpName",
       vendor, odate, idate, cdate, quote, rate
from public.outsourcing_receipt_confirm_candidates;

create or replace view public.ki_v_lot_progress with (security_invoker = true) as
select "no", job, proc, part, steps from public.machining_purchase_progress_rows;

create or replace view public.ki_v_std_route with (security_invoker = true) as
select row_no, standard_process_no, standard_process_name, steps from public.machining_standard_routes;

create or replace view public.ki_v_vendor with (security_invoker = true) as
select vendor_code, vendor_name, vendor_type, partner_type, location_type,
       ceo_name, phone, remark, outsourcing_flag, milling_flag
from public.vendors
where coalesce(outsourcing_flag,false) or coalesce(milling_flag,false);

create or replace view public.ki_v_process with (security_invoker = true) as
select process_code, process_name, process_group, sort_order from public.processes;

grant select on
  public.ki_v_mold_due, public.ki_v_inspection_history, public.ki_v_inspection_detail,
  public.ki_v_asset_status, public.ki_v_env_latest, public.ki_v_env_history, public.ki_v_env_alert,
  public.ki_v_mold, public.ki_v_inspection_item, public.ki_v_factory, public.ki_v_zone, public.ki_v_sensor,
  public.ki_v_osp_order, public.ki_v_osp_receipt, public.ki_v_lot_progress,
  public.ki_v_std_route, public.ki_v_vendor, public.ki_v_process
to anon, authenticated;


-- ------------------------------------------------------------
-- 3) 외주 LOT관리 원천 테이블 anon 읽기 정책 (조회 전용)
--    security_invoker 뷰는 원천 RLS를 따르므로 필요
--    ★ Supabase Auth 로그인 방식으로 전환 시 이 블록은 실행하지 말 것
-- ------------------------------------------------------------
do $$
declare t text; src text[] := array[
  'vendors','processes','machining_standard_routes','machining_purchase_progress_rows',
  'outsourcing_order_status_rows','outsourcing_receipt_confirm_candidates'];
begin
  foreach t in array src loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %I on public.%I', t||'_anon_read', t);
      execute format('create policy %I on public.%I for select to anon using (true)', t||'_anon_read', t);
      execute format('grant select on public.%I to anon', t);
    end if;
  end loop;
end $$;


-- ------------------------------------------------------------
-- 4) 확인
-- ------------------------------------------------------------
-- select table_name from information_schema.tables
--  where table_schema='public' and table_name like 'ki\_%' order by 1;


-- ------------------------------------------------------------
-- 5) 롤백 (KI MES 오브젝트만 제거 — 원천 테이블은 그대로)
-- ------------------------------------------------------------
-- do $$
-- declare r record;
-- begin
--   for r in select c.relname n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
--            where ns.nspname='public' and c.relkind='v' and c.relname like 'ki\_v\_%'
--   loop execute format('drop view if exists public.%I cascade', r.n); end loop;
-- end $$;
-- drop table if exists public.ki_app_settings;
