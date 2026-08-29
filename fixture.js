/* GI MES 사내/외주 이동 시뮬레이션 픽스처
   ── DB 시드(ki_seed_inhouse_test.sql)와 동일한 규칙으로 재구성한다.
      · 이동이력 : 각 이동건마다 sdate 에 '출고', idate 가 있으면 '입고' 1건씩
      · 추가 이력 : M2 MS 도착 / M5 GS 도착 · WS 부분출고 / H2 사내입고 / 특기 2건
   기준일 : 2026-08-29 */
const TODAY = '2026-08-29';

const ROUTES = [
  { row_no: 1, standard_process_no: 1, standard_process_name: '3공정_MHG',
    steps: ['MS','HQ','GS'], inhouse: [] },
  { row_no: 2, standard_process_no: 2, standard_process_name: '4공정_MHGW',
    steps: ['MS','HQ','GS','WS'], inhouse: [] },
  { row_no: 3, standard_process_no: 3, standard_process_name: '5공정_MHGWN',
    steps: ['MS','HQ','GS','WS','NM2'], inhouse: [] },
  { row_no: 4, standard_process_no: 4, standard_process_name: '3공정_NGN',
    steps: ['NL','GM','NL1'], inhouse: [] },
  { row_no: 91, standard_process_no: 91, standard_process_name: 'TEST_혼합6공정(사내2·외주4)',
    steps: ['MA','MS','HQ','GS','WS','NM2'], inhouse: ['MA','GS'] },
  { row_no: 92, standard_process_no: 92, standard_process_name: 'TEST_사내전용3공정',
    steps: ['MA','MF','GM'], inhouse: ['MA','MF','GM'] },
  { row_no: 93, standard_process_no: 93, standard_process_name: 'TEST_외주전용3공정',
    steps: ['MS','HQ','GS'], inhouse: [] }
];

const PROCS = [
  ['MA','면삭밀링(소형)'],['MF','면삭밀링(대형)'],['MS','성형밀링(소형)'],
  ['HQ','열처리'],['GS','성형연삭(소형)'],['GM','평면연삭(중형)'],
  ['WS','WIRE CUT'],['NM2','M/C열처리정삭'],['NL','M/C정삭(대형)'],['NL1','M/C정삭(대형)']
].map(([c, n]) => ({ process_code: c, process_name: n }));

/* 협력사 마스터 일원화 후 : ki_v_vendor = ki_vendor (사용중 · 외주/밀링 플래그) */
const VENDORS_KI = ['BTC','가강텍','가림기업','가민산업','금수메탈','금승정기','금재공업',
  '다솔기공','대성열처리','대승공업','대현정밀가공','동방열처리','미래표면처리','바건금속','바한텍',
  '북평ENG','서울방전','서한산업','신영특수강','신진산업','오진텍','임채원','청영시스템','태건정밀',
  '한강메탈','한림메탈','한빛정밀'];
const VENDORS_VIEW = VENDORS_KI.map(v => ({ vendor_name: v }));

/* ── 이동건(발주/반출) 정의 : [part, mp, vendor, kind, qty, sdate, edate, idate, quote] ── */
const O = [
  ['TLOT-M1','MA','1공장 밀링실','사내',120,'2026-08-28','2026-09-01',null,null],

  ['TLOT-M2','MA','1공장 밀링실','사내',200,'2026-08-19','2026-08-22','2026-08-22',null],
  ['TLOT-M2','MS','한빛정밀','외주',200,'2026-08-26','2026-08-31',null,4800],

  ['TLOT-M3','MA','1공장 밀링실','사내',150,'2026-08-11','2026-08-14','2026-08-14',null],
  ['TLOT-M3','MS','한빛정밀','외주',150,'2026-08-15','2026-08-18','2026-08-18',5200],
  ['TLOT-M3','HQ','대성열처리','외주',150,'2026-08-20','2026-08-24','2026-08-24',3100],
  ['TLOT-M3','GS','2공장 연삭실','사내',150,'2026-08-28','2026-08-31',null,null],

  ['TLOT-M4','MA','1공장 밀링실','사내',300,'2026-08-03','2026-08-05','2026-08-05',null],
  ['TLOT-M4','MS','한빛정밀','외주',300,'2026-08-06','2026-08-08','2026-08-08',7000],
  ['TLOT-M4','HQ','대성열처리','외주',300,'2026-08-10','2026-08-13','2026-08-13',4200],
  ['TLOT-M4','GS','2공장 연삭실','사내',300,'2026-08-15','2026-08-17','2026-08-17',null],
  ['TLOT-M4','WS','청영시스템','외주',300,'2026-08-19','2026-08-21','2026-08-21',6100],
  ['TLOT-M4','NM2','BTC','외주',300,'2026-08-25','2026-08-27','2026-08-27',5500],

  ['TLOT-M5','MA','1공장 밀링실','사내',100,'2026-08-08','2026-08-10','2026-08-10',null],
  ['TLOT-M5','MS','한빛정밀','외주',100,'2026-08-12','2026-08-15','2026-08-15',3000],
  ['TLOT-M5','HQ','대성열처리','외주',100,'2026-08-17','2026-08-20','2026-08-20',2500],
  ['TLOT-M5','GS','2공장 연삭실','사내',100,'2026-08-22','2026-09-03',null,null],
  ['TLOT-M5','WS','청영시스템','외주',60,'2026-08-27','2026-09-02',null,6300],

  ['TLOT-H1','MA','1공장 밀링실','사내',80,'2026-08-21','2026-08-24','2026-08-24',null],
  ['TLOT-H1','MF','1공장 대형밀링','사내',80,'2026-08-29','2026-08-31',null,null],

  ['TLOT-H2','MA','1공장 밀링실','사내',50,'2026-08-10','2026-08-12','2026-08-12',null],
  ['TLOT-H2','MF','1공장 대형밀링','사내',50,'2026-08-14','2026-08-18','2026-08-18',null],
  ['TLOT-H2','GM','2공장 연삭실','사내',50,'2026-08-20','2026-08-24','2026-08-24',null],

  ['TLOT-O1','MS','한빛정밀','외주',500,'2026-08-18','2026-08-21','2026-08-21',9000],
  ['TLOT-O1','HQ','대성열처리','외주',500,'2026-08-28','2026-09-01',null,7800],

  ['TLOT-O2','MS','한빛정밀','외주',250,'2026-08-08','2026-08-11','2026-08-11',5000],
  ['TLOT-O2','HQ','대성열처리','외주',250,'2026-08-13','2026-08-17','2026-08-17',4400],
  ['TLOT-O2','GS','서울방전','외주',250,'2026-08-21','2026-08-25','2026-08-25',6600]
];
const ROUTE_OF = { 'TLOT-M':'91', 'TLOT-H':'92', 'TLOT-O':'93' };
const routeNoOf = p => ROUTE_OF[p.slice(0, 6)];
const mapPartOf = p => 'P-' + p[5] + '-00' + p[6];

let no = 1072;
const OSP = O.map(([part, mp, vendor, kind, qty, sdate, edate, idate, quote]) => ({
  no: no++, st: idate ? '완료' : '진행', vendor, job: 'TJOB-' + part.slice(5),
  item: null, proc: null, procName: null, part, partName: null, mp,
  mold_no: null, map_part: mapPartOf(part), route_no: routeNoOf(part),
  move_kind: kind, odate: null, sdate, edate, idate, cdate: null,
  quote, fix: null, lot: part, qty, lots: [{ lot: part, qty }]
})).sort((a, b) => b.no - a.no);

/* ── 이동이력 ── */
let mid = 91;
const MOVES = [];
OSP.slice().sort((a, b) => a.no - b.no).forEach(o => {
  MOVES.push({ move_id: mid++, part: o.part, osp_no: o.no, io: '출고', move_kind: o.move_kind,
    mp: o.mp, vendor: o.vendor, move_date: o.sdate, out_qty: o.qty, in_qty: null, short_qty: 0,
    reason: null, remark: '[' + o.move_kind + '] ' + o.mp + ' 이동 출고', worker: '세일러', source: 'QR' });
  if (o.idate) MOVES.push({ move_id: mid++, part: o.part, osp_no: o.no, io: '입고',
    move_kind: o.move_kind, mp: o.mp, vendor: o.vendor, move_date: o.idate,
    out_qty: o.qty, in_qty: o.qty, short_qty: 0, reason: null,
    remark: '[' + o.move_kind + '] ' + o.mp + ' 가공완료 입고', worker: '세일러', source: 'QR' });
});
const ospNo = (part, mp, openOnly) => (OSP.find(o => o.part === part && o.mp === mp &&
  (!openOnly || !o.idate)) || {}).no;

MOVES.push({ move_id: 140, part: 'TLOT-M2', osp_no: ospNo('TLOT-M2','MS',true), io: '도착',
  move_kind: '외주', mp: 'MS', vendor: '한빛정밀', move_date: '2026-08-27',
  out_qty: 200, in_qty: 200, short_qty: 0, reason: null,
  remark: '[외주] 한빛정밀 도착확인 — 작업 착수', worker: '한빛정밀 김반장', source: 'QR' });
MOVES.push({ move_id: 141, part: 'TLOT-M5', osp_no: ospNo('TLOT-M5','GS',true), io: '도착',
  move_kind: '사내', mp: 'GS', vendor: '2공장 연삭실', move_date: '2026-08-25',
  out_qty: 100, in_qty: 100, short_qty: 0, reason: null,
  remark: '[사내] 2공장 연삭실 도착확인', worker: '세일러', source: 'QR' });
MOVES.push({ move_id: 142, part: 'TLOT-M5', osp_no: ospNo('TLOT-M5','GS',true), io: '출고',
  move_kind: '외주', mp: 'WS', vendor: '청영시스템', move_date: '2026-08-27',
  out_qty: 60, in_qty: null, short_qty: 0, reason: null,
  remark: '부분출고 — 잔량 40 유지. [외주] 청영시스템 반출', worker: '세일러', source: 'QR' });
MOVES.push({ move_id: 143, part: 'TLOT-H2', osp_no: null, io: '사내입고', move_kind: '사내',
  mp: null, vendor: null, move_date: '2026-08-26', out_qty: 50, in_qty: 47, short_qty: 3,
  reason: '가공 중 파손 3EA', remark: '사내 전공정 완료 — 사내입고 종결', worker: '세일러', source: '수동' });
MOVES.push({ move_id: 144, part: 'TLOT-M1', osp_no: null, io: '기록', move_kind: '사내',
  mp: 'MA', vendor: '1공장 밀링실', move_date: TODAY, out_qty: null, in_qty: null, short_qty: 0,
  reason: null, remark: '치수 확인 필요 — 초도품 검사 요청', worker: '세일러', source: '수동' });
MOVES.push({ move_id: 145, part: 'TLOT-O1', osp_no: null, io: '기록', move_kind: '외주',
  mp: 'HQ', vendor: '대성열처리', move_date: TODAY, out_qty: null, in_qty: null, short_qty: 0,
  reason: null, remark: '경도 HRC58 요청 — 도면 특기사항 참조', worker: '세일러', source: '수동' });
MOVES.forEach(m => { m.created_at = '2026-08-29T22:37:21.129942+00:00'; });

/* ── 진행이력(완료 공정) ── */
const PROG = [
  ['TLOT-M1', []],
  ['TLOT-M2', ['MA']],
  ['TLOT-M3', ['MA','MS','HQ']],
  ['TLOT-M4', ['MA','MS','HQ','GS','WS','NM2']],
  ['TLOT-M5', ['MA','MS','HQ','GS']],
  ['TLOT-H1', ['MA']],
  ['TLOT-H2', ['MA','MF','GM']],
  ['TLOT-O1', ['MS']],
  ['TLOT-O2', ['MS','HQ','GS']]
].map(([part, mps], i) => ({
  no: 1020 + i, job: 'TJOB-' + part.slice(5), proc: 'M', part,
  steps: mps.map(mp => { const o = OSP.find(x => x.part === part && x.mp === mp);
    return { mp, vendor: o.vendor, date: o.idate }; })
}));

const RECEIPT = [{ receipt_id: 12, part: 'TLOT-H2', job: 'TJOB-H2', in_date: '2026-08-26',
  qty: 47, short_qty: 3, reason: '가공 중 파손 3EA', worker: '세일러',
  remark: '사내 전공정 완료 후 최종 입고' }];

const TOKENS = { 'TLOT-M1':'TTOK-M1','TLOT-M3':'TTOK-M3','TLOT-M5':'TTOK-M5',
  'TLOT-H1':'TTOK-H1','TLOT-O1':'TTOK-O1' };

module.exports = { TODAY, ROUTES, PROCS, VENDORS_VIEW, VENDORS_KI,
  OSP, MOVES, PROG, RECEIPT, TOKENS };
