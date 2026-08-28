/* ============================================================
   협력사 재고현황 뷰 (ki_vendor_stock.sql)
   · 미입고(미결) 반출건 기준 = 협력사가 지금 들고 있는 물량
   · migration 재실행 후 항상 재적용
   ============================================================ */
drop view if exists public.ki_v_vendor_stock cascade;

create view public.ki_v_vendor_stock
with (security_invoker = true) as
with mv as (      /* 반출건별 도착확인 (도착 · 입고) */
  select osp_no,
         max(case when io in ('도착','입고') then in_qty end)      as arrived_qty,
         max(case when io in ('도착','입고') then move_date end)   as arrived_date
    from public.ki_lot_move
   where osp_no is not null
   group by osp_no
),
out_next as (     /* 이 반출건에서 다음 공정으로 이관한 수량 */
  select osp_no, sum(coalesce(out_qty,0)) as moved_qty
    from public.ki_lot_move
   where io = '출고' and osp_no is not null
   group by osp_no
)
select
  o.no                                            as osp_no,
  o.vendor,
  v.contact_name,
  coalesce(v.contact_phone, v.phone)              as contact_phone,
  o.part,
  o.job,
  o.mp,
  p.process_name                                  as mp_name,
  o.map_part,
  o.mold_no,
  o.sdate                                         as out_date,
  m.arrived_date::text                            as arrived_date,
  coalesce(o.qty,0)                               as out_qty,
  m.arrived_qty,
  coalesce(n.moved_qty,0)                         as moved_qty,
  /* 보유수량 = 도착확인 수량(없으면 반출수량) − 이관수량 */
  greatest(coalesce(m.arrived_qty, o.qty, 0) - coalesce(n.moved_qty,0), 0) as stock_qty,
  /* 부족 = 반출수량 − 도착확인 수량 (운송 중 파손 등) */
  case when m.arrived_qty is not null
       then greatest(coalesce(o.qty,0) - m.arrived_qty, 0) else 0 end      as short_qty,
  greatest(current_date - nullif(o.sdate,'')::date, 0)  as age_days,   /* 반출 후 경과 */
  greatest(current_date - m.arrived_date, 0)            as work_days,  /* 도착 후 경과 */
  case when m.arrived_date is null then '도착대기' else '작업중' end        as stock_status,
  o.edate                                         as due_date,
  case when nullif(o.edate,'') is null then '-'
       when nullif(o.edate,'')::date < current_date then '지연'
       when nullif(o.edate,'')::date <= current_date + 3 then '임박'
       else '정상' end                            as due_status
from public.outsourcing_order_status_rows o
left join mv        m on m.osp_no = o.no
left join out_next  n on n.osp_no = o.no
left join public.ki_vendor v on v.vendor_name = o.vendor
left join public.processes p on p.process_code = o.mp
where nullif(o.sdate,'') is not null
  and nullif(o.idate,'') is null                       /* 미입고(미결)만 */
  and greatest(coalesce(m.arrived_qty, o.qty, 0) - coalesce(n.moved_qty,0), 0) > 0;

grant select on public.ki_v_vendor_stock to authenticated;
