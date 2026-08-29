/* ============================================================
   GI MES — 사내공정 이동 지원 (외주 ↔ 사내)
   ki_mes_migration.sql 의 5) 블록 뒤에 붙여 넣어 함께 관리한다.
   · 재실행 안전 : add column if not exists / drop view → create
   ------------------------------------------------------------
   machining_standard_routes.inhouse
       해당 표준공정경로에서 "사내에서 수행"하는 공정코드 배열
       예) steps ["MS","HQ","GS","WS"] / inhouse ["MS","WS"]
            → MS·WS 는 사내이동, HQ·GS 는 외주반출
   outsourcing_order_status_rows.move_kind  '외주' | '사내'
   ki_lot_move.move_kind                    '외주' | '사내'
   ============================================================ */

alter table public.machining_standard_routes
  add column if not exists inhouse jsonb default '[]'::jsonb;
update public.machining_standard_routes set inhouse = '[]'::jsonb where inhouse is null;

alter table public.outsourcing_order_status_rows
  add column if not exists move_kind text default '외주';
update public.outsourcing_order_status_rows set move_kind = '외주'
 where move_kind is null or btrim(move_kind) = '';

alter table public.ki_lot_move
  add column if not exists move_kind text default '외주';
update public.ki_lot_move set move_kind = '외주'
 where move_kind is null or btrim(move_kind) = '';

/* ── select * / 컬럼고정 뷰 재생성 (create or replace 불가) ── */
drop view if exists public.ki_v_std_route cascade;
create view public.ki_v_std_route with (security_invoker=true) as
  select row_no, standard_process_no, standard_process_name, steps,
         coalesce(inhouse,'[]'::jsonb) as inhouse
    from public.machining_standard_routes;
grant select on public.ki_v_std_route to authenticated;

drop view if exists public.ki_v_osp_order cascade;
create view public.ki_v_osp_order with (security_invoker=true) as
  select "no", st, vendor, job, item, proc, "procName", part, "partName", mp,
         mold_no, map_part, route_no, coalesce(move_kind,'외주') as move_kind,
         odate, sdate, edate, idate, cdate, quote, fix, lot, qty, lots
    from public.outsourcing_order_status_rows;
grant select on public.ki_v_osp_order to authenticated;

drop view if exists public.ki_v_lot_move cascade;
create view public.ki_v_lot_move with (security_invoker=true) as
  select move_id, part, osp_no, io, coalesce(move_kind,'외주') as move_kind,
         mp, vendor, move_date, out_qty, in_qty, short_qty,
         reason, remark, worker, source, created_at
    from public.ki_lot_move;
grant select on public.ki_v_lot_move to authenticated;
