/* ============================================================
   SCM Smart — 표준경로 · 부분반입 · 잔량처리 시뮬레이션
   · lot_route.html 의 추적코어를 그대로 떼어 실행
   · ki_lot_qty_guard.sql 의 트리거 규칙을 JS로 미러링해
     초과입고가 실제로 막히는지까지 함께 검증한다
   실행 : node sim_qty.js [lot_route.html]
   ============================================================ */
const fs = require('fs');
const FILE = process.argv[2] || 'lot_route.html';
const src = fs.readFileSync(FILE, 'utf8');

/* ── 추적코어 추출 (qtyOf ~ «/trace-core») ── */
const s0 = src.indexOf('const qtyOf = (c,mp) =>');
const s1 = src.indexOf('/*«/trace-core»*/');
if (s0 < 0 || s1 < 0) { console.error('❌ 추적코어 마커를 찾지 못했습니다.'); process.exit(2); }
const CORE = src.slice(s0, s1);
const mkCore = new Function('OSP', 'MVQ', 'RCPT', CORE +
  '\n return {qtyOf, openQtyOf, homeQty, holdersOf, holderOf, stateOf, posOf, ospOf,' +
  ' openOsp, openIn, wipMpOf, step0Of, isFeed, undoneOf, transitQtyOf, lostOf};');

/* ── 표준경로 ── */
const ROUTE = { no: '90', steps: ['AA', 'AB', 'MS', 'AD'], inhouse: ['MS'] };

/* ── 원장 ── */
let OSP, MOVE, RCPT, seqO, seqM, TODAY = '2026-09-01';
function reset() { OSP = []; MOVE = []; RCPT = []; seqO = 100; seqM = 1000; }

/* ── DB 트리거 미러 (ki_lot_qty_guard.sql) ───────────────── */
const ospOpenQty = no => {
  const o = OSP.find(x => x.no === no) || {};
  const lost = MOVE.filter(m => m.osp_no === no && m.io === '도착')
    .reduce((s, m) => s + (+m.short_qty || 0), 0);
  const got = MOVE.filter(m => m.osp_no === no && m.io === '입고')
    .reduce((s, m) => s + (+m.in_qty || 0) + (+m.short_qty || 0), 0);
  return Math.max((+o.qty || 0) - lost - got, 0);
};
const feedQty = part => {
  const step0 = ROUTE.steps[0];
  return OSP.filter(o => o.part === part && o.mp === step0 && !o.rework)
    .reduce((s, o) => s + (+o.qty || 0), 0);
};
/* ki_lot_home_qty : 사내 대기수량 (화면 homeQty 와 같은 규칙) */
const homeQtySql = part => {
  const step0 = ROUTE.steps[0];
  const isFeed = o => o.mp === step0 && !o.rework;
  const back = MOVE.filter(m => m.part === part && m.io === '입고')
    .reduce((s, m) => s + (+m.in_qty || 0), 0);
  const outAgain = OSP.filter(o => o.part === part && o.sdate && !isFeed(o))
    .reduce((s, o) => s + ((o.move_kind === '사내' && !o.idate)
      ? (+o.qty || 0) - ospOpenQty(o.no) : (+o.qty || 0)), 0);
  const inFeed = OSP.filter(o => o.part === part && o.sdate && !o.idate
      && isFeed(o) && o.move_kind === '사내')
    .reduce((s, o) => s + ospOpenQty(o.no), 0);
  const recvQ = MOVE.filter(m => m.part === part && m.io === '사내입고')
    .reduce((s, m) => s + (+m.in_qty || 0), 0);
  const lost = MOVE.filter(m => m.part === part && m.io === '기록' && m.osp_no == null)
    .reduce((s, m) => s + (+m.short_qty || 0), 0);
  return Math.max(back + inFeed - outAgain - recvQ - lost, 0);
};
/* insert 시 트리거가 거부하면 예외 */
function insMove(r) {
  const q = (+r.in_qty || 0) + (+r.short_qty || 0);
  if (q > 0) {
    if (r.io === '입고' && r.osp_no != null) {
      const rem = ospOpenQty(r.osp_no);
      if (q > rem + 1e-6) throw new Error(`입고수량(${q})이 반출건 #${r.osp_no} 잔여(${rem})보다 많습니다.`);
    } else if (r.io === '도착' && r.osp_no != null) {
      const ord = +(OSP.find(x => x.no === r.osp_no) || {}).qty || 0;
      if (q > ord + 1e-6) throw new Error(`도착수량(${q})이 반출수량(${ord})보다 많습니다.`);
    } else if (r.io === '사내입고') {
      const home = homeQtySql(r.part);
      if ((+r.in_qty || 0) > home + 1e-6)
        throw new Error(`사내입고 수량(${+r.in_qty || 0})이 사내 대기수량(${home})을 넘습니다.`);
      const feed = feedQty(r.part);
      if (feed > 0) {
        const got = MOVE.filter(m => m.part === r.part && m.io === '사내입고')
          .reduce((s, m) => s + (+m.in_qty || 0) + (+m.short_qty || 0), 0);
        if (got + q > feed + 1e-6)
          throw new Error(`사내입고 누계(${got + q})가 LOT 투입량(${feed})을 넘습니다.`);
      }
    }
  }
  r.move_id = ++seqM; MOVE.push(r); return r;
}

/* ── 화면 동작 ── */
function out(part, mp, vendor, qty, opt = {}) {          /* 반출 (신규투입 · 재반출) */
  const o = { no: ++seqO, part, mp, vendor, qty, sdate: TODAY, idate: null,
    st: '진행', route_no: ROUTE.no, rework: !!opt.rework,
    rework_kind: opt.rework_kind || null,
    move_kind: ROUTE.inhouse.includes(mp) ? '사내' : '외주' };
  OSP.push(o);
  insMove({ part, osp_no: o.no, io: '출고', mp, vendor, move_date: TODAY, out_qty: qty });
  return o;
}
function arrive(o, qty) {                                 /* 협력사 도착확인 */
  const base = ospOpenQty(o.no);
  insMove({ part: o.part, osp_no: o.no, io: '도착', mp: o.mp, vendor: o.vendor,
    move_date: TODAY, out_qty: base, in_qty: qty, short_qty: Math.max(base - qty, 0) });
}
function recv(o, qty, opt = {}) {                         /* 사내 복귀입고 */
  const rem = ospOpenQty(o.no);
  const close = opt.close != null ? opt.close : (qty >= rem);
  const short = opt.short || 0;
  insMove({ part: o.part, osp_no: o.no, io: '입고', mp: o.mp, vendor: o.vendor,
    move_date: TODAY, out_qty: rem, in_qty: qty, short_qty: short,
    in_kind: opt.kind || '가공완료', undone_qty: opt.undone || 0 });
  if (close || short > 0) { o.idate = TODAY; o.st = '완료'; }
}
function inhouseDone(o) {                                 /* 사내공정 자동완료 */
  o.idate = TODAY; o.st = '완료';
  insMove({ part: o.part, osp_no: o.no, io: '입고', mp: o.mp, vendor: o.vendor,
    move_date: TODAY, out_qty: o.qty, in_qty: o.qty, short_qty: 0, in_kind: '가공완료' });
}
function close(part, qty, short = 0) {                    /* 사내입고(종결) */
  insMove({ part, io: '사내입고', move_date: TODAY, in_qty: qty, short_qty: short });
  RCPT.push({ part, in_date: TODAY, qty, short_qty: short });
}

/* ── 추적코어 호출용 c 객체 ── */
function calc(part) {
  const MVQ = {}; MOVE.filter(v => ['도착', '입고', '반송', '기록'].includes(v.io))
    .forEach(v => { (MVQ[v.part] = MVQ[v.part] || []).push(v); });
  const T = mkCore(OSP, MVQ, RCPT);
  const seen = new Set(MOVE.filter(v => v.part === part && v.io === '입고'
    && (+v.in_qty || 0) - (+v.undone_qty || 0) > 0).map(v => v.mp));
  const rcs = RCPT.filter(r => r.part === part);
  const q = rcs.reduce((s, r) => s + (+r.qty || 0), 0);
  const sh = rcs.reduce((s, r) => s + (+r.short_qty || 0), 0);
  /* arr : 도착확인까지 마친 공정 (진행등록 화면의 steps 에 해당) */
  const arr = new Set([...seen, ...MOVE.filter(v => v.part === part && v.io === '도착').map(v => v.mp)]);
  const c = { part, std: ROUTE, sd: ROUTE.steps, seen, arr,
    steps: ROUTE.steps.map(mp => ({ mp })),
    rest: ROUTE.steps.filter(x => !seen.has(x)),
    recv: rcs.length ? { qty: q, short_qty: sh, n: rcs.length } : null, recvOpen: false };
  if (rcs.length) {
    const openOut = OSP.some(o => o.part === part && o.sdate && !o.idate);
    c.recvOpen = openOut || T.homeQty(c) > 0 || T.undoneOf(c) > 0;
  }
  return { c, T };
}

/* ── 검증 ── */
let PASS = 0, FAIL = 0; const errs = [];
const nf = v => Number(v || 0).toLocaleString();
function chk(name, got, want) {
  const okk = String(got) === String(want);
  if (okk) PASS++; else { FAIL++; errs.push(`${name} : ${got} ≠ ${want}`); }
  console.log(`    ${okk ? '✅' : '❌'} ${name} = ${got}${okk ? '' : '  (기대 ' + want + ')'}`);
}
function blocked(name, fn) {
  try { fn(); FAIL++; errs.push(name + ' : 차단되지 않음'); console.log(`    ❌ ${name} — 차단 실패`); }
  catch (e) { PASS++; console.log(`    ✅ ${name} — 차단됨 (${e.message})`); }
}
function head(t) { console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(52 - t.length, 0))); }
function state(part) {
  const { c, T } = calc(part);
  return { home: T.homeQty(c), holder: T.holderOf(c), st: T.stateOf(c),
    closed: !!(c.recv && !c.recvOpen), undone: T.undoneOf(c), rest: c.rest.join('·'),
    pos: T.posOf(c) };
}
function show(part) {
  const s = state(part);
  console.log(`       · 사내대기 ${nf(s.home)} · 보유처 ${s.holder} · 상태 ${s.st}` +
              ` · 남은공정 [${s.rest || '-'}]` + (s.undone ? ` · 미처리 ${nf(s.undone)}` : ''));
  return s;
}

/* ══════════════════════════════════════════════════════════
   시나리오 1 : 정상 완주 (4공정 · 전량)
   ══════════════════════════════════════════════════════════ */
head('S1 정상 완주 1,000EA');
reset();
{ const P = 'L001';
  const o1 = out(P, 'AA', 'A사', 1000); arrive(o1, 1000); recv(o1, 1000);
  const o2 = out(P, 'AB', 'B사', 1000); arrive(o2, 1000); recv(o2, 1000);
  const o3 = out(P, 'MS', '생산1팀', 1000); inhouseDone(o3);
  const o4 = out(P, 'AD', 'D사', 1000); arrive(o4, 1000); recv(o4, 1000);
  let s = show(P);
  chk('S1 종결 전 사내대기', s.home, 1000);
  chk('S1 종결 전 남은공정', s.rest, '');
  close(P, 1000);
  s = show(P);
  chk('S1 종결 후 사내대기', s.home, 0);
  chk('S1 종결판정', s.closed, true);
  chk('S1 상태', s.st, '사내입고 완료');
  blocked('S1 종결 후 추가 사내입고', () => close(P, 100));
}

/* ══════════════════════════════════════════════════════════
   시나리오 2 : 부분반입 (600 → 400) · 잔량 유지
   ══════════════════════════════════════════════════════════ */
head('S2 부분반입 600 + 400');
reset();
{ const P = 'L002';
  const o1 = out(P, 'AA', 'A사', 1000); arrive(o1, 1000);
  recv(o1, 600, { close: false });
  let s = show(P);
  chk('S2 1차 후 사내대기', s.home, 600);
  chk('S2 1차 후 반출건 잔여', ospOpenQty(o1.no), 400);
  chk('S2 1차 후 상태', s.st, '분할 진행중');
  blocked('S2 잔여 초과 입고(500)', () => recv(o1, 500, { close: false }));
  recv(o1, 400);
  s = show(P);
  chk('S2 2차 후 사내대기', s.home, 1000);
  chk('S2 2차 후 반출건 잔여', ospOpenQty(o1.no), 0);
  blocked('S2 마감 후 재입고', () => recv(o1, 100, { close: false }));
  chk('S2 AA 회수합계', calc(P).T.qtyOf(calc(P).c, 'AA').in, 1000);
}

/* ══════════════════════════════════════════════════════════
   시나리오 3 : 분할 반출 (600/400) → 각각 회수
   ══════════════════════════════════════════════════════════ */
head('S3 분할 반출 A사600 · B사400');
reset();
{ const P = 'L003';
  const a = out(P, 'AA', 'A사', 600), b = out(P, 'AA', 'B사', 400);
  arrive(a, 600); arrive(b, 400);
  let s = show(P);
  chk('S3 반출중 사내대기', s.home, 0);
  chk('S3 반출중 보유처', s.holder, 'B사 400 · A사 600');
  recv(a, 600);
  s = show(P);
  chk('S3 A사 회수 후 사내대기', s.home, 600);
  chk('S3 A사 회수 후 상태', s.st, '분할 진행중');
  recv(b, 400);
  s = show(P);
  chk('S3 전량 회수 후 사내대기', s.home, 1000);
  chk('S3 투입량 인식', feedQty(P), 1000);
}

/* ══════════════════════════════════════════════════════════
   시나리오 4 : 운송 중 부족(도착 시 파손) · 손실 확정
   ══════════════════════════════════════════════════════════ */
head('S4 도착 부족 50 (파손)');
reset();
{ const P = 'L004';
  const o1 = out(P, 'AA', 'A사', 1000);
  arrive(o1, 950);                                   /* 50 파손 */
  chk('S4 도착 후 반출건 잔여', ospOpenQty(o1.no), 950);
  blocked('S4 파손분 포함 입고(1,000)', () => recv(o1, 1000));
  recv(o1, 950);
  const s = show(P);
  chk('S4 회수 후 사내대기', s.home, 950);
  chk('S4 반출건 잔여', ospOpenQty(o1.no), 0);
  blocked('S4 투입량 초과 종결(1,000)', () => close(P, 1000));
  close(P, 950);
  chk('S4 종결판정', state(P).closed, true);
}

/* ══════════════════════════════════════════════════════════
   시나리오 5 : 미처리 반납 → 재반출
   ══════════════════════════════════════════════════════════ */
head('S5 미처리 반납 300 → 재반출');
reset();
{ const P = 'L005';
  const o1 = out(P, 'AA', 'A사', 1000); arrive(o1, 1000);
  recv(o1, 1000, { kind: '부분가공', undone: 300 });
  let s = show(P);
  chk('S5 미처리 잔량', s.undone, 300);
  chk('S5 사내대기', s.home, 1000);
  chk('S5 종결 불가(미처리 존재)', (() => { close(P, 1000); const r = state(P).closed;
    RCPT.pop(); MOVE.pop(); return r; })(), false);
  const o2 = out(P, 'AA', 'A사', 300, { rework: true, rework_kind: '미처리' });
  arrive(o2, 300); recv(o2, 300);
  s = show(P);
  chk('S5 재반출 후 미처리 잔량', s.undone, 0);
  chk('S5 재반출 후 사내대기', s.home, 1000);
  chk('S5 재반출은 투입량 아님', feedQty(P), 1000);
}

/* ══════════════════════════════════════════════════════════
   시나리오 6 : 사내공정 혼합 (반출 → 사내작업 → 반출)
   ══════════════════════════════════════════════════════════ */
head('S6 사내공정 혼합');
reset();
{ const P = 'L006';
  const o1 = out(P, 'AA', 'A사', 1000); arrive(o1, 1000); recv(o1, 1000);
  const o2 = out(P, 'AB', 'B사', 1000); arrive(o2, 1000); recv(o2, 1000);
  const o3 = out(P, 'MS', '생산1팀', 1000);
  let s = show(P);
  chk('S6 사내작업중 위치', s.pos, 'home');
  chk('S6 사내작업중 상태', s.st, '사내 작업중');
  chk('S6 사내작업중 사내대기', s.home, 1000);
  inhouseDone(o3);
  const o4 = out(P, 'AD', 'D사', 1000); arrive(o4, 1000); recv(o4, 1000);
  close(P, 1000);
  s = show(P);
  chk('S6 종결판정', s.closed, true);
  chk('S6 종결 후 사내대기', s.home, 0);
}

/* ══════════════════════════════════════════════════════════
   시나리오 7 : 부분종결(분납 사내입고) 후 잔량 종결
   ══════════════════════════════════════════════════════════ */
head('S7 사내입고 분납 700 + 300');
reset();
{ const P = 'L007';
  const o1 = out(P, 'AA', 'A사', 1000); arrive(o1, 1000); recv(o1, 1000);
  const o2 = out(P, 'AB', 'B사', 1000); arrive(o2, 1000); recv(o2, 1000);
  const o3 = out(P, 'MS', '생산1팀', 1000); inhouseDone(o3);
  const o4 = out(P, 'AD', 'D사', 1000); arrive(o4, 1000); recv(o4, 1000);
  close(P, 700);
  let s = show(P);
  chk('S7 분납 후 사내대기', s.home, 300);
  chk('S7 분납 후 종결판정', s.closed, false);
  blocked('S7 투입량 초과 분납(400)', () => close(P, 400));
  close(P, 300);
  s = show(P);
  chk('S7 잔량 종결 후 사내대기', s.home, 0);
  chk('S7 최종 종결판정', s.closed, true);
}

/* ══════════════════════════════════════════════════════════
   시나리오 8 : 공정 미완 상태에서 종결 시도
   ══════════════════════════════════════════════════════════ */
head('S8 공정 미완 · 외주 반출중');
reset();
{ const P = 'L008';
  const o1 = out(P, 'AA', 'A사', 1000); arrive(o1, 1000); recv(o1, 1000);
  const o2 = out(P, 'AB', 'B사', 1000); arrive(o2, 1000);
  const s = show(P);
  chk('S8 남은공정', s.rest, 'AB·MS·AD');
  chk('S8 사내대기', s.home, 0);
  chk('S8 보유처', s.holder, 'B사 1,000');
  chk('S8 상태', s.st, '외주 작업중');
  blocked('S8 외주 반출중 종결 시도', () => close(P, 1000));
}


/* ══════════════════════════════════════════════════════════
   시나리오 9 : 한 외주처에 여러 품번 · 교차 분납
   ══════════════════════════════════════════════════════════ */
head('S9 A사에 2품번 동시 반출 · 교차 분납');
reset();
{ const P1 = 'L101', P2 = 'L102';
  const a = out(P1, 'AA', 'A사', 1000);
  const b = out(P2, 'AA', 'A사', 500);
  arrive(a, 1000); arrive(b, 500);
  chk('S9 P1 보유처', state(P1).holder, 'A사 1,000');
  chk('S9 P2 보유처', state(P2).holder, 'A사 500');
  recv(a, 600, { close: false });                 /* P1 1차 분납 */
  recv(b, 200, { close: false });                 /* P2 1차 분납 */
  chk('S9 P1 1차 후 사내대기', state(P1).home, 600);
  chk('S9 P2 1차 후 사내대기', state(P2).home, 200);
  chk('S9 P1 반출건 잔여', ospOpenQty(a.no), 400);
  chk('S9 P2 반출건 잔여', ospOpenQty(b.no), 300);
  blocked('S9 P2 잔여 초과 입고(400)', () => recv(b, 400, { close: false }));
  chk('S9 차단 후 P1 사내대기 영향없음', state(P1).home, 600);
  recv(a, 400); recv(b, 300);
  chk('S9 P1 전량 회수', state(P1).home, 1000);
  chk('S9 P2 전량 회수', state(P2).home, 500);
  chk('S9 P1 투입량', feedQty(P1), 1000);
  chk('S9 P2 투입량', feedQty(P2), 500);
}

/* ══════════════════════════════════════════════════════════
   시나리오 10 : 같은 외주처 · 한 품번만 부족 발생
   ══════════════════════════════════════════════════════════ */
head('S10 A사 2품번 중 P1만 부족 40');
reset();
{ const P1 = 'L103', P2 = 'L104';
  const a = out(P1, 'AA', 'A사', 800), b = out(P2, 'AA', 'A사', 600);
  arrive(a, 760); arrive(b, 600);                 /* P1 40 파손 */
  chk('S10 P1 잔여', ospOpenQty(a.no), 760);
  chk('S10 P2 잔여', ospOpenQty(b.no), 600);
  blocked('S10 P1 파손분 포함 입고(800)', () => recv(a, 800));
  recv(a, 760); recv(b, 600);
  chk('S10 P1 사내대기', state(P1).home, 760);
  chk('S10 P2 사내대기', state(P2).home, 600);
  blocked('S10 P2 대기 초과 종결(700)', () => close(P2, 700));
  close(P2, 600);
  chk('S10 P2 종결', state(P2).closed, true);
  chk('S10 P2 종결이 P1에 영향없음', state(P1).closed, false);
  chk('S10 P1 사내대기 유지', state(P1).home, 760);
}

/* ══════════════════════════════════════════════════════════
   시나리오 11 : 한 반출건에 2품번을 묶어 보낸 경우 (lots 배열)
   ══════════════════════════════════════════════════════════ */
head('S11 묶음 반출(P1 600 + P2 400) — LOT별 분할 등록 후 교차 분납');
reset();
{ const P1 = 'L105', P2 = 'L106';
  /* 패치된 save() : LOT표에 2건을 넣어도 반출건은 LOT마다 하나씩 만들어진다 */
  const a = out(P1, 'AA', 'A사', 600), b = out(P2, 'AA', 'A사', 400);
  chk('S11 반출건 수', OSP.length, 2);
  arrive(a, 600); arrive(b, 400);
  chk('S11 P1 보유처', state(P1).holder, 'A사 600');
  chk('S11 P2 보유처', state(P2).holder, 'A사 400');
  recv(a, 300, { close: false });                 /* 같은 외주처에서 섞여 들어오는 분납 */
  recv(b, 250, { close: false });
  chk('S11 P1 1차 후 사내대기', state(P1).home, 300);
  chk('S11 P2 1차 후 사내대기', state(P2).home, 250);
  chk('S11 P1 잔여', ospOpenQty(a.no), 300);
  chk('S11 P2 잔여', ospOpenQty(b.no), 150);
  blocked('S11 P1 잔여 초과 입고(400)', () => recv(a, 400, { close: false }));
  recv(a, 300); recv(b, 150);
  chk('S11 P1 전량 회수', state(P1).home, 600);
  chk('S11 P2 전량 회수', state(P2).home, 400);
  blocked('S11 P1 대기 초과 종결(1,000)', () => close(P1, 1000));
  close(P1, 600); close(P2, 400);
  chk('S11 P1 종결', state(P1).closed, true);
  chk('S11 P2 종결', state(P2).closed, true);
}

/* ══════════════════════════════════════════════════════════
   시나리오 12 : 옛 데이터 — 한 반출건에 2 LOT이 묶여 있는 경우
   (패치 이후에는 만들어지지 않는다 · 기존 데이터 진단용)
   ══════════════════════════════════════════════════════════ */
head('S12 [진단] 기존 묶음 반출건 1건에 P1 600 + P2 400');
reset();
{ const P1 = 'L107', P2 = 'L108';
  const o = out(P1, 'AA', 'A사', 1000);
  o.lots = [{ lot: P1, qty: 600 }, { lot: P2, qty: 400 }];
  o.lot = P1 + ',' + P2;
  arrive(o, 1000); recv(o, 1000);
  const h1 = state(P1).home, h2 = state(P2).home;
  console.log(`    ⚠️  P1 사내대기 ${nf(h1)} · P2 사내대기 ${nf(h2)}` +
    `  → 묶음 반출건은 대표 LOT(${P1})에 전량이 잡힌다`);
  console.log('       기존 데이터는 반출건을 LOT별로 나눠 다시 등록해야 정확히 추적된다.');
}

/* ══════════════════════════════════════════════════════════ */
console.log('\n══════ 표준경로 · 부분반입 · 잔량처리 시뮬레이션 ══════');
console.log(`  통과 ${PASS} · 실패 ${FAIL}`);
errs.forEach(e => console.log('   - ' + e));
process.exit(FAIL ? 1 : 0);
