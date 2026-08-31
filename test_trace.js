/* ============================================================
   lot_route.html 추적코어 회귀테스트
   · 패치된 HTML 에서 «trace-core» 블록을 그대로 떼어내 실행한다
   · 입력은 시뮬레이터가 만든 원장(ki_osp_order · ki_lot_move · ki_lot_receipt) 뿐
   · 출력(보유처 · 사내보유 · 상태 · 종결판정)을 시뮬레이터의 실제 상태와 대조
   실행 : node test_trace.js [lot_route.html 경로]
   ============================================================ */
const fs = require('fs');
const FILE = process.argv[2] || '../lot_route.html';
const CASES = JSON.parse(fs.readFileSync('ledger.json', 'utf8'));

const src = fs.readFileSync(FILE, 'utf8');
const m = /\/\*«trace-core»\*\/([\s\S]*?)\/\*«\/trace-core»\*\//.exec(src);
if (!m) { console.error('❌ «trace-core» 마커를 찾지 못했습니다 — 패치본인지 확인하세요.'); process.exit(2); }

/* 추적코어를 고립 실행 : 화면 의존성 없이 원장만 주입 */
const core = new Function('OSP', 'MVQ', 'RCPT', m[1] +
  '\n return {openQtyOf, lostOf, homeQty, holdersOf, holderOf, stateOf, posOf,' +
  ' openOsp, openIn, wipMpOf, step0Of, isFeed, undoneOf};');

const nf = v => Number(v || 0).toLocaleString();
let PASS = 0, FAIL = 0;
const bad = {};
const ok = (k, cond, msg) => { if (cond) PASS++; else { FAIL++; (bad[k] = bad[k] || []).push(msg); } };

for (const C of CASES) {
  const MVQ = {};
  C.move.filter(v => v.io === '도착' || v.io === '입고')
    .forEach(v => { (MVQ[v.part] = MVQ[v.part] || []).push(v); });
  const T = core(C.osp, MVQ, C.receipt);

  for (const part of Object.keys(C.lots)) {
    const L = C.lots[part], truth = L.truth;
    const osp = C.osp.filter(o => o.part === part);
    if (!osp.length) continue;                    /* 원장에 없는 LOT = 추적 대상 밖 */

    /* calc() 가 만드는 c 객체 재현 */
    const steps = L.steps;
    const seen = new Set(C.move.filter(v => v.part === part && v.io === '입고').map(v => v.mp));
    const rcs = C.receipt.filter(r => r.part === part);
    const q = rcs.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    const sh = rcs.reduce((s, r) => s + (Number(r.short_qty) || 0), 0);
    const c0 = { part, std: { steps }, seen, rest: steps.filter(x => !seen.has(x)) };
    const c = Object.assign(c0, {
      recv: rcs.length ? { qty: q, short_qty: sh, n: rcs.length } : null, recvOpen: false
    });
    if (rcs.length) {
      const openOut = osp.some(o => o.sdate && !o.idate);
      c.recvOpen = openOut || T.homeQty(c) > 0 || T.undoneOf(c) > 0;
    }
    const fed = osp.filter(o => o.sdate && T.isFeed(c, o))
      .reduce((s, o) => s + (Number(o.qty) || 0), 0);
    const untouched = Math.max(truth.qty0 - fed, 0);
    const tag = `[시드${C.seed}/${C.day === null ? '완주' : C.day + '일'}] ${part}`;

    /* ② 사내 대기수량 (아직 1공정에 안 나간 물량은 원장에 없으므로 제외) */
    const home = T.homeQty(c);
    const wantHome = Math.max(truth.home - untouched, 0);
    ok('② 사내대기', home === wantHome,
       `${tag} 사내대기 ${nf(home)} ≠ 실제 ${nf(wantHome)} (${home - wantHome > 0 ? '+' : ''}${home - wantHome})`);

    /* ③ 협력사별 보유수량 */
    const hs = T.holdersOf(c);
    const byV = {};
    hs.filter(x => !x.home && x.qty > 0).forEach(x => { byV[x.who] = (byV[x.who] || 0) + x.qty; });
    const vend = truth.vendor || {};
    new Set([...Object.keys(byV), ...Object.keys(vend)]).forEach(v => {
      ok('③ 협력사보유', (byV[v] || 0) === (vend[v] || 0),
         `${tag} ${v} ${nf(byV[v] || 0)} ≠ 실제 ${nf(vend[v] || 0)}`);
    });

    /* ④ 보유 총계 = 투입 − 손실 − 종결 */
    const tot = home + Object.values(byV).reduce((s, x) => s + x, 0);
    const want = truth.qty0 - truth.short - truth.recv - untouched;
    ok('④ 총계정합', tot === want,
       `${tag} 보유총계 ${nf(tot)} ≠ ${nf(want)}`);

    /* ⑤ 종결 판정 */
    const closed = !!(c.recv && !c.recvOpen);
    ok('⑤ 종결판정', closed === truth.done,
       `${tag} 추적=${closed ? '종결' : '진행중'} · 실제=${truth.done ? '종결' : '진행중'}`);

    /* ⑥ 상태 문구가 실제 위치와 모순되지 않는지 */
    const st = T.stateOf(c);
    const atVen = Object.values(vend).reduce((s, x) => s + x, 0);
    let want2;
    if (truth.done && atVen === 0) want2 = ['사내입고 완료'];
    else if (atVen > 0 && truth.home > 0) want2 = ['분할 진행중'];
    else if (atVen > 0) want2 = ['외주 작업중', '이동중', '분할 진행중'];
    else want2 = ['사내 보유', '사내 작업중', '사내입고 대기', '분할 진행중', '사내입고 완료'];
    ok('⑥ 상태문구', want2.includes(st), `${tag} 상태 "${st}" (사내 ${nf(truth.home)} · 외주 ${nf(atVen)})`);

    /* ⑦ 잔량 = 반출건별 실제 미회수 */
    osp.filter(o => !o.idate && o.move_kind !== '사내').forEach(o => {
      const got = C.move.filter(v => v.osp_no === o.no && v.io === '입고')
        .reduce((s, v) => s + (Number(v.in_qty) || 0) + (Number(v.short_qty) || 0), 0);
      const real = Math.max((o.arrived != null ? o.arrived : o.qty) - got, 0);
      ok('⑦ 반출건잔량', T.openQtyOf(o) === real,
         `${tag} #${o.no} 잔량 ${nf(T.openQtyOf(o))} ≠ 실제 ${nf(real)}`);
    });
  }
}

console.log('\n══════ lot_route.html 추적코어 회귀테스트 ══════');
console.log(`  케이스 ${CASES.length}종 (시드 4 × 관측시점 4) · 검증 ${PASS + FAIL}건`);
const keys = ['② 사내대기', '③ 협력사보유', '④ 총계정합', '⑤ 종결판정', '⑥ 상태문구', '⑦ 반출건잔량'];
keys.forEach(k => {
  const n = (bad[k] || []).length;
  console.log(`  ${n ? '❌' : '✅'} ${k}  ${n ? '불일치 ' + n + '건' : '정상'}`);
  (bad[k] || []).slice(0, 3).forEach(x => console.log('       - ' + x));
  if (n > 3) console.log(`       … 외 ${n - 3}건`);
});
console.log(`\n  통과 ${PASS} · 실패 ${FAIL}`);
process.exit(FAIL ? 1 : 0);
