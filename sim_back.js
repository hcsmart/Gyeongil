/* 협력사 → 본사 반송 흐름 시뮬레이터
   · DB 측 : ki_scan_* RPC 를 SQL 정의 그대로 JS 로 옮겨 실행
   · UI 측 : lot_qr.html 의 수량 헬퍼를 파일에서 그대로 추출해 실행 */
const fs = require('fs');

/* ── lot_qr.html 에서 실제 헬퍼 코드 추출 ───────────────────── */
const html = fs.readFileSync('lot_qr.html', 'utf8');
const S = html.indexOf("const LIVE = ()");
const E = html.indexOf("const pName =");
if (S < 0 || E < 0) throw new Error('헬퍼 구간을 찾지 못함');
const frag = html.slice(S, E);
const num = v => { const n = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
let D = { moves: [], osp: [] };
const H = new Function('num', 'getD', frag +
  ';return {LIVE,movedOf,remainOf,arrivedOf,backOf,rcvOf,arrOf,pendingOf,transitOf,undoneOf};')
  (num, () => D);
/* frag 안의 D 참조를 위해 전역으로 노출 */
global.D = D;
const _h = new Function('num', frag +
  ';return {LIVE,movedOf,remainOf,arrivedOf,backOf,rcvOf,arrOf,pendingOf,transitOf,doneQtyOf,openQtyOf};')(num);
/* 계산 직전 항상 최신 DB 상태를 주입 */
const helpers = new Proxy(_h, { get: (t, k) => (...a) => { D.moves = MV; D.osp = ORD; return t[k](...a); } });

/* ── DB ─────────────────────────────────────────────────────── */
let ORD = [], MV = [], SEQ = 0, MID = 0, RCPT = null;
const live = () => MV.filter(m => !m.void);
const ord = no => ORD.find(o => o.no === no);
const sum = (a, f) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0);

function scan_base(no) {           /* ki_scan_base */
  const a = live().filter(m => m.osp_no === no && (m.io === '도착' || m.io === '입고') && m.in_qty != null)
    .sort((x, y) => y.move_id - x.move_id)[0];
  return Math.max((a ? a.in_qty : ord(no).qty) - sum(live().filter(m => m.osp_no === no && m.io === '출고'), m => m.out_qty), 0);
}
function scan_held(no) {           /* ki_scan_held (신규) */
  const a = live().filter(m => m.osp_no === no && m.io === '도착' && m.in_qty != null)
    .sort((x, y) => y.move_id - x.move_id)[0];
  return Math.max((a ? a.in_qty : ord(no).qty)
    - sum(live().filter(m => m.osp_no === no && (m.io === '출고' || m.io === '반송')), m => m.out_qty), 0);
}
function scan_transit(no) {        /* ki_scan_transit (신규) */
  return Math.max(sum(live().filter(m => m.osp_no === no && m.io === '반송'), m => m.out_qty)
    - sum(live().filter(m => m.osp_no === no && m.io === '입고'), m => m.in_qty), 0);
}
const push = m => { MV.push(Object.assign({ move_id: ++MID, part: 'LOT111' }, m)); };

function ship(mp, vendor, qty, date, from) {          /* ki_scan_out (본사 반출) */
  if (from != null) {
    const rem = scan_base(from);
    if (qty > rem) throw new Error(`출고수량(${qty})이 잔량(${rem})보다 많습니다.`);
    if (rem - qty <= 0) { ord(from).idate = date; ord(from).st = '완료'; }
  }
  ORD.push({ no: ++SEQ, mp, vendor, move_kind: '외주', qty, sdate: date, idate: null, st: '진행' });
  push({ osp_no: from, io: '출고', mp, vendor, move_date: date, out_qty: qty });
  return SEQ;
}
function arrive(no, vendor, qty, date) {              /* ki_scan_arrive p_close=false */
  const base = scan_base(no);
  push({ osp_no: no, io: '도착', mp: ord(no).mp, vendor, move_date: date, out_qty: base, in_qty: qty, short_qty: Math.max(base - qty, 0) });
}
function back(no, vendor, qty, date) {                /* ki_scan_back (신규) */
  const o = ord(no);
  if ((o.move_kind || '외주') !== '외주') throw new Error('외주 반출건에서만 본사 반송을 등록할 수 있습니다.');
  if (qty <= 0) throw new Error('반송수량을 입력하세요.');
  const held = scan_held(no);
  if (qty > held) throw new Error(`반송수량(${qty})이 보유수량(${held})보다 많습니다.`);
  push({ osp_no: no, io: '반송', mp: o.mp, vendor, move_date: date, out_qty: qty, short_qty: 0 });
  return { held, left: held - qty };
}
function recv(no, qty, date, close, undone) {         /* ki_scan_recv (신규) */
  const transit = scan_transit(no);
  if (transit <= 0) throw new Error('협력사가 반송 등록한 물량이 없습니다.');
  if (qty > transit) throw new Error(`입고수량(${qty})이 반송(운송 중) 수량(${transit})보다 많습니다.`);
  const held = scan_held(no);
  const rest = Math.max(transit - qty, 0);
  if (close && held > 0) throw new Error(`협력사 보유분 ${held}개가 남아 있어 마감할 수 없습니다.`);
  const short = close ? rest : 0;
  const doClose = (held <= 0 && rest <= 0) || close;
  push({ osp_no: no, io: '입고', mp: ord(no).mp, vendor: ord(no).vendor, move_date: date, out_qty: transit, in_qty: qty, short_qty: short, undone_qty: undone || 0 });
  if (doClose) { ord(no).idate = date; ord(no).st = '완료'; }
  return { transit, rest, held, short, closed: doClose };
}
function home(qty, date) {                            /* ki_scan_home */
  const first = ORD[0];
  RCPT = { qty, short: Math.max(first.qty - qty, 0), date };
  push({ osp_no: null, io: '사내입고', move_date: date, out_qty: first.qty, in_qty: qty, short_qty: RCPT.short });
}

/* ── UI 계산 (lot_qr.html 실제 코드) ─────────────────────────── */
function view(vendor) {
  D.moves = MV; D.osp = ORD;
  const open = ORD.filter(o => o.sdate && !o.idate);
  const isHome = vendor === '사내 (발주처)';
  const mine = open.filter(o => o.vendor === vendor);
  const toArr = mine.filter(o => !helpers.arrivedOf(o));
  const toOut = mine.filter(o => helpers.arrivedOf(o) && helpers.remainOf(o) > 0);
  const toBack = isHome ? [] : toOut.filter(o => helpers.pendingOf(o) > 0);
  const closedSrc = ORD.filter(o => o.idate && helpers.remainOf(o) > 0 && !open.some(x => x.no === o.no));
  return { open, mine, toArr, toOut, toBack, closedSrc, isHome };
}
const HOME = '사내 (발주처)';

/* ── 출력 ───────────────────────────────────────────────────── */
const L = [];
const log = (...a) => L.push(a.join(' '));
function state(tag) {
  D.moves = MV; D.osp = ORD;
  const rows = ORD.map(o => `    #${o.no} ${o.mp}/${o.vendor} 반출${o.qty} ` +
    `도착${helpers.arrOf(o)} 보유${helpers.pendingOf(o)} 반송${helpers.backOf(o.no)} ` +
    `운송중${helpers.transitOf(o)} 본사입고${helpers.rcvOf(o.no)} ${o.idate ? '✔마감' : '진행'}`);
  log(`  [${tag}]\n` + rows.join('\n'));
}

/* ══ 시나리오 1 : 정상 4공정 (AA→AB→AC→AD, 각 협력사) ══ */
function scenario1() {
  ORD = []; MV = []; SEQ = 0; MID = 0; RCPT = null;
  log('\n══ 시나리오 1 · 정상 4공정 1,000개 ══');
  const route = [['AA', 'A사'], ['AB', 'B사'], ['AC', 'C사'], ['AD', 'D사']];
  let prev = null, day = 1;
  route.forEach(([mp, ven], i) => {
    const d = `01-${String(day++).padStart(2, '0')}`;
    const no = ship(mp, ven, 1000, d, prev);
    log(`  ▶ 본사 반출 ${mp} → ${ven} 1,000  (osp #${no}${prev ? ' ← #' + prev : ''})`);
    /* 협력사 화면 */
    let v = view(ven);
    log(`    협력사 화면: 입고대기 ${v.toArr.length}건 / 반송대기 ${v.toBack.length}건`);
    arrive(no, ven, 1000, d);
    v = view(ven);
    log(`    협력사 도착등록 1,000 → 보유 ${helpers.pendingOf(ord(no))} · 반송탭 ${v.toBack.length}건`);
    const r = back(no, ven, 1000, d);
    log(`    협력사 반송등록 1,000 → 잔여보유 ${r.left} · 운송중 ${helpers.transitOf(ord(no))}`);
    v = view(ven);
    log(`    반송 후 협력사 화면: 반송대기 ${v.toBack.length}건 (0이어야 정상)`);
    /* 본사 화면 */
    const hv = view(HOME);
    const canClose = helpers.pendingOf(ord(no)) <= 0 && Math.max(helpers.transitOf(ord(no)) - 1000, 0) <= 0;
    log(`    본사 입고화면 기본수량 ${helpers.transitOf(ord(no))} · 마감가능 ${canClose ? 'Y' : 'N'}`);
    recv(no, 1000, d, true);
    log(`    본사 복귀입고 1,000 → #${no} ${ord(no).idate ? '마감' : '미마감'}`);
    const hv2 = view(HOME);
    log(`    ▸ ${mp} 공정 판정 : 회수 ${helpers.doneQtyOf(mp)} · 미회수 ${helpers.openQtyOf(mp)} → ${helpers.openQtyOf(mp) > 0 ? '◐ 진행중' : '✓ 완료'}`);
    log(`    본사 출고화면 출처후보: ${hv2.open.map(o => '#' + o.no).concat(hv2.closedSrc.map(o => '#' + o.no + '(마감분 잔량' + helpers.remainOf(o) + ')')).join(', ') || '없음'}`);
    prev = no;
  });
  state('4공정 종료');
  home(1000, '01-05');
  log(`  🏁 사내입고 종결 1,000 (부족 ${RCPT.short})`);
}

/* ══ 시나리오 2 : 분할 반송 600 + 400 ══ */
function scenario2() {
  ORD = []; MV = []; SEQ = 0; MID = 0; RCPT = null;
  log('\n══ 시나리오 2 · 분할 반송 (600 → 400) ══');
  const no = ship('AA', 'A사', 1000, '02-01', null);
  arrive(no, 'A사', 1000, '02-02');
  let r = back(no, 'A사', 600, '02-03');
  log(`  협력사 1차 반송 600 → 잔여보유 ${r.left} · 운송중 ${helpers.transitOf(ord(no))}`);
  let v = view('A사');
  log(`  협력사 화면: 반송대기 ${v.toBack.length}건 (보유 ${helpers.pendingOf(ord(no))} 남아 1이어야 정상)`);
  let held = helpers.pendingOf(ord(no)), rest = Math.max(helpers.transitOf(ord(no)) - 600, 0);
  log(`  본사 입고화면 기본수량 ${helpers.transitOf(ord(no))} · 마감 ${held > 0 || rest > 0 ? '잠금(정상)' : '가능'}`);
  recv(no, 600, '02-04', false);
  log(`  본사 1차 복귀입고 600 (마감 안 함) → #${no} ${ord(no).idate ? '마감' : '진행'}`);
  log(`  ▸ AA 공정 판정 : 회수 ${helpers.doneQtyOf('AA')} · 미회수 ${helpers.openQtyOf('AA')} → ` +
      `${helpers.openQtyOf('AA') > 0 ? '◐ 진행중(정상)' : '✓ 완료'}`);
  log(`  이 시점 보유 ${helpers.pendingOf(ord(no))} · 반송 ${helpers.backOf(no)} · 본사입고 ${helpers.rcvOf(no)} · 운송중 ${helpers.transitOf(ord(no))}`);
  v = view('A사');
  log(`  협력사 화면 재확인: 반송대기 ${v.toBack.length}건 · 보유 ${helpers.pendingOf(ord(no))} (400 이어야 정상)`);
  r = back(no, 'A사', 400, '02-05');
  log(`  협력사 2차 반송 400 → 잔여보유 ${r.left} · 운송중 ${helpers.transitOf(ord(no))}`);
  held = helpers.pendingOf(ord(no)); rest = Math.max(helpers.transitOf(ord(no)) - 400, 0);
  log(`  본사 입고화면 기본수량 ${helpers.transitOf(ord(no))} · 마감 ${held > 0 || rest > 0 ? '잠금' : '가능(정상)'}`);
  recv(no, 400, '02-06', true);
  log(`  본사 2차 복귀입고 400 (마감) → #${no} ${ord(no).idate ? '마감' : '진행'}`);
  log(`  ▸ AA 공정 판정 : 회수 ${helpers.doneQtyOf('AA')} · 미회수 ${helpers.openQtyOf('AA')} → ` +
      `${helpers.openQtyOf('AA') > 0 ? '◐ 진행중' : '✓ 완료(정상)'}`);
  state('분할회수 완료');
  const shorts = live().filter(m => Number(m.short_qty) > 0)
    .map(m => `${m.io} ${m.move_date} 부족${m.short_qty}`);
  log(`  ⚠ 기록된 부족: ${shorts.join(' / ') || '없음'}`);
}

/* ══ 시나리오 3 : 예외 · 과다반송 / 사내공정 반송 시도 ══ */
function scenario3() {
  ORD = []; MV = []; SEQ = 0; MID = 0;
  log('\n══ 시나리오 3 · 예외 처리 ══');
  const no = ship('AA', 'A사', 1000, '03-01', null);
  arrive(no, 'A사', 950, '03-02');
  log(`  도착 950 (반출 1,000 · 운송손실 50) → 보유 ${helpers.pendingOf(ord(no))}`);
  try { back(no, 'A사', 1000, '03-03'); log('  ✗ 과다반송이 통과됨'); }
  catch (e) { log(`  ✓ 과다반송 차단: ${e.message}`); }
  back(no, 'A사', 950, '03-03');
  try { back(no, 'A사', 1, '03-04'); log('  ✗ 중복반송이 통과됨'); }
  catch (e) { log(`  ✓ 잔여 0 재반송 차단: ${e.message}`); }
  ORD.push({ no: ++SEQ, mp: 'P10', vendor: '연삭실', move_kind: '사내', qty: 100, sdate: '03-05', idate: null, st: '진행' });
  try { back(SEQ, '연삭실', 100, '03-06'); log('  ✗ 사내건 반송이 통과됨'); }
  catch (e) { log(`  ✓ 사내 이동건 반송 차단: ${e.message}`); }
}

/* ══ 시나리오 4 : 미처리 반납 (가공 안 하고 그대로 복귀) ══ */
function scenario4() {
  ORD = []; MV = []; SEQ = 0; MID = 0;
  log('\n══ 시나리오 4 · 미처리 반납 ══');
  const no = ship('AA', 'A사', 500, '04-01', null);
  arrive(no, 'A사', 500, '04-02');
  back(no, 'A사', 500, '04-03');
  recv(no, 500, '04-04', true, 500);
  D.moves = MV; D.osp = ORD;
  const SEEN = new Set(live().filter(m => m.mp && m.io === '입고' && (num(m.in_qty) - num(m.undone_qty)) > 0).map(m => m.mp));
  log(`  본사 복귀입고 500 (미처리 500) → 공정완료 처리 여부: ${SEEN.has('AA') ? '완료(오류)' : '미완료(정상)'}`);
  log(`  → AA 는 다시 반출 대상으로 남는다`);
}


/* ══ 시나리오 5 : 운송 중 분실 (반송 1,000 → 본사 950 수령 후 마감) ══ */
function scenario5() {
  ORD = []; MV = []; SEQ = 0; MID = 0;
  log('\n══ 시나리오 5 · 운송 중 분실 ══');
  const no = ship('AA', 'A사', 1000, '05-01', null);
  arrive(no, 'A사', 1000, '05-02');
  back(no, 'A사', 1000, '05-03');
  try { recv(no, 950, '05-04', false); } catch (e) { log('  ' + e.message); }
  log(`  마감 없이 950 수령 → 운송중 ${helpers.transitOf(ord(no))} · #${no} ${ord(no).idate ? '마감' : '진행(정상)'}`);
  log(`  ▸ AA 공정 판정 : 회수 ${helpers.doneQtyOf('AA')} · 미회수 ${helpers.openQtyOf('AA')} → ${helpers.openQtyOf('AA') > 0 ? '◐ 진행중(정상)' : '✓ 완료'}`);
  const r = recv(no, 50, '05-05', true);
  log(`  잔여 50 을 마감 처리 → closed ${r.closed} · 분실 ${r.short}`);
  MV = MV.filter(m => m.move_date !== '05-05');
  ord(no).idate = null;
  const r2 = recv(no, 20, '05-06', true);   /* 대안 : 20 만 오고 30 은 분실 확정 */
  log(`  (대안) 50 중 20 만 수령하고 마감 → 분실 ${r2.short} · closed ${r2.closed}`);
}

scenario1(); scenario2(); scenario3(); scenario4(); scenario5();
console.log(L.join('\n'));
