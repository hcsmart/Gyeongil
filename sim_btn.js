/* ============================================================
   lot_route.html — 버튼 동작 시뮬레이션
   · jsdom 으로 화면을 띄우고 실제 버튼을 눌러 본다
   · KI 는 메모리 원장으로 스텁 (ki_lot_qty_guard.sql 규칙 포함)
   실행 : node sim_btn.js [lot_route.html]
   ============================================================ */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const FILE = process.argv[2] || 'lot_route.html';
const TODAY = new Date().toISOString().slice(0, 10);

let PASS = 0, FAIL = 0; const errs = [];
const ok = (n, cond, x) => { if (cond) { PASS++; console.log('    ✅ ' + n); }
  else { FAIL++; errs.push(n + (x != null ? ' → ' + x : '')); console.log('    ❌ ' + n + (x != null ? '  → ' + x : '')); } };
const head = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(56 - t.length, 0)));
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ── 메모리 원장 ────────────────────────────────────────── */
const ROUTE = { row_no: 1, standard_process_no: 90, standard_process_name: '4공정_TEST',
  steps: ['AA', 'AB', 'MS', 'AD'], inhouse: ['MS'] };
let DB, seqO, seqM;
function seed() {
  seqO = 100; seqM = 1000;
  DB = {
    prog: [
      { no: 1, job: 'JOB-001', proc: 'P', part: 'T001', steps: [], map_part: '품번_001', route_no: '90' },
      { no: 2, job: 'JOB-002', proc: 'P', part: 'T002', steps: [], map_part: '품번_002', route_no: '90' },
      { no: 3, job: 'JOB-003', proc: 'P', part: 'T003', steps: [], map_part: '품번_003', route_no: '90' }
    ],
    osp: [], move: [], receipt: [], token: [{ token: 'TOK-T001', part: 'T001', revoked: false, issued_at: TODAY }],
    vendor: [{ vendor_name: 'A사' }, { vendor_name: 'B사' }, { vendor_name: 'D사' }],
    proc: ROUTE.steps.map((c, i) => ({ process_code: c, process_name: c + '공정', sort_order: i })),
    route: [ROUTE], mold: [], vstock: []
  };
  /* T001 : AA 반출 → 도착 (외주 작업중)
     T002 : 4공정 완주 후 사내 대기 1,000 (사내입고 대기)
     T003 : AA 반출 후 600만 회수 (분할 진행중) */
  outRec('T001', 'AA', 'A사', 1000); arriveRec(101, 1000);
  ['AA', 'AB'].forEach(mp => { const o = outRec('T002', mp, 'A사', 1000); arriveRec(o.no, 1000); recvRec(o.no, 1000); });
  const oin = outRec('T002', 'MS', '생산1팀', 1000); recvRec(oin.no, 1000);
  const o4 = outRec('T002', 'AD', 'D사', 1000); arriveRec(o4.no, 1000); recvRec(o4.no, 1000);
  const o3 = outRec('T003', 'AA', 'A사', 1000); arriveRec(o3.no, 1000); recvRec(o3.no, 600, false);
  DB.prog.forEach(p => { p.steps = DB.move.filter(m => m.part === p.part && m.io === '입고')
    .map(m => ({ mp: m.mp, vendor: m.vendor, date: m.move_date, done: true })); });
}
function outRec(part, mp, vendor, qty) {
  const o = { no: ++seqO, part, job: 'JOB-' + part, mp, vendor, qty, lot: part,
    lots: [{ lot: part, qty }], sdate: TODAY, idate: null, st: '진행', route_no: '90',
    map_part: '품번_' + part.slice(-3), mold_no: null,
    move_kind: ROUTE.inhouse.includes(mp) ? '사내' : '외주' };
  DB.osp.push(o);
  DB.move.push({ move_id: ++seqM, part, osp_no: o.no, io: '출고', mp, vendor, move_date: TODAY, out_qty: qty });
  return o;
}
function arriveRec(no, qty) { const o = DB.osp.find(x => x.no === no);
  DB.move.push({ move_id: ++seqM, part: o.part, osp_no: no, io: '도착', mp: o.mp, vendor: o.vendor,
    move_date: TODAY, out_qty: o.qty, in_qty: qty, short_qty: Math.max(o.qty - qty, 0) }); }
function recvRec(no, qty, close = true) { const o = DB.osp.find(x => x.no === no);
  DB.move.push({ move_id: ++seqM, part: o.part, osp_no: no, io: '입고', mp: o.mp, vendor: o.vendor,
    move_date: TODAY, out_qty: qty, in_qty: qty, short_qty: 0, in_kind: '가공완료', undone_qty: 0 });
  if (close) { o.idate = TODAY; o.st = '완료'; } }

/* ── DB 트리거 미러 ── */
const ospOpen = no => { const o = DB.osp.find(x => x.no === no) || {};
  const lost = DB.move.filter(m => m.osp_no === no && m.io === '도착' && !m.void)
    .reduce((s, m) => s + (+m.short_qty || 0), 0);
  const got = DB.move.filter(m => m.osp_no === no && m.io === '입고' && !m.void)
    .reduce((s, m) => s + (+m.in_qty || 0) + (+m.short_qty || 0), 0);
  return Math.max((+o.qty || 0) - lost - got, 0); };
const homeQtyDb = part => {
  const step0 = ROUTE.steps[0], feed = o => o.mp === step0 && !o.rework;
  const back = DB.move.filter(m => m.part === part && m.io === '입고' && !m.void)
    .reduce((s, m) => s + (+m.in_qty || 0), 0);
  const outAgain = DB.osp.filter(o => o.part === part && o.sdate && !feed(o))
    .reduce((s, o) => s + ((o.move_kind === '사내' && !o.idate) ? (+o.qty || 0) - ospOpen(o.no) : (+o.qty || 0)), 0);
  const inFeed = DB.osp.filter(o => o.part === part && o.sdate && !o.idate && feed(o) && o.move_kind === '사내')
    .reduce((s, o) => s + ospOpen(o.no), 0);
  const recvQ = DB.move.filter(m => m.part === part && m.io === '사내입고' && !m.void)
    .reduce((s, m) => s + (+m.in_qty || 0), 0);
  return Math.max(back + inFeed - outAgain - recvQ, 0); };
function guard(r) {
  const q = (+r.in_qty || 0) + (+r.short_qty || 0); if (q <= 0) return;
  if (r.io === '입고' && r.osp_no != null) {
    const rem = ospOpen(r.osp_no);
    if (q > rem + 1e-6) throw new Error(`입고수량(${q})이 반출건 잔여(${rem})보다 많습니다.`);
  } else if (r.io === '사내입고') {
    const h = homeQtyDb(r.part);
    if ((+r.in_qty || 0) > h + 1e-6) throw new Error(`사내입고 수량(${+r.in_qty || 0})이 사내 대기수량(${h})을 넘습니다.`);
  }
}

/* ── REST 스텁 ── */
function get(url) {
  const q = decodeURIComponent(url);
  const eq = k => { const m = new RegExp(k + '=eq\\.([^&]+)').exec(q); return m ? m[1] : null; };
  if (q.startsWith('ki_lot_receipt')) { const p = eq('part');
    return DB.receipt.filter(r => !p || r.part === p); }
  if (q.startsWith('ki_osp_order')) { const n = eq('no');
    return DB.osp.filter(o => !n || String(o.no) === n); }
  if (q.startsWith('ki_lot_move')) { const id = eq('move_id');
    return DB.move.filter(m => !id || String(m.move_id) === id); }
  if (q.startsWith('ki_v_lot_progress')) return DB.prog.map(p => Object.assign({}, p));
  if (q.startsWith('ki_v_osp_order')) { const p = eq('part');
    return DB.osp.filter(o => !p || o.part === p).slice().sort((a, b) => b.no - a.no); }
  if (q.startsWith('ki_v_vendor')) return DB.vendor;
  if (q.startsWith('ki_v_process')) return DB.proc;
  if (q.startsWith('ki_v_std_route')) return DB.route;
  if (q.startsWith('ki_v_mold')) return DB.mold;
  if (q.startsWith('ki_v_lot_receipt')) { const p = eq('part');
    return DB.receipt.filter(r => !p || r.part === p); }
  if (q.startsWith('ki_v_lot_token')) { const p = eq('part'); return DB.token.filter(t => !p || t.part === p); }
  if (q.startsWith('ki_v_vendor_stock')) return DB.vstock;
  if (q.startsWith('ki_v_lot_move')) {
    let rows = DB.move.slice();
    if (/io=eq\.사내입고/.test(q)) rows = rows.filter(m => m.io === '사내입고');
    else if (/io=in\./.test(q)) rows = rows.filter(m => ['도착', '입고', '기록', '반송', '출고'].includes(m.io));
    const p = eq('part'); if (p) rows = rows.filter(m => m.part === p);
    const on = eq('osp_no'); if (on) rows = rows.filter(m => String(m.osp_no) === on);
    return rows.sort((a, b) => String(a.move_date).localeCompare(String(b.move_date)) || a.move_id - b.move_id);
  }
  return [];
}
const CALL = { ins: [], upd: [], del: [], rpc: [] };
function ins(t, rows) {
  CALL.ins.push({ t, rows });
  (rows || []).forEach(r => {
    if (t === 'ki_lot_move') { guard(r); DB.move.push(Object.assign({ move_id: ++seqM }, r)); }
    else if (t === 'ki_osp_order') DB.osp.push(Object.assign({ no: ++seqO, lots: r.lots || [] }, r, { no: seqO }));
    else if (t === 'ki_lot_receipt') DB.receipt.push(Object.assign({}, r));
  });
  return Promise.resolve(rows);
}
function upd(t, filter, body) {
  CALL.upd.push({ t, filter, body });
  const no = (/no=eq\.(\d+)/.exec(filter) || [])[1];
  const id = (/move_id=eq\.(\d+)/.exec(filter) || [])[1];
  if (t === 'ki_osp_order' && no) Object.assign(DB.osp.find(o => String(o.no) === no) || {}, body);
  if (t === 'ki_lot_move' && id) Object.assign(DB.move.find(m => String(m.move_id) === id) || {}, body);
  return Promise.resolve(body);
}
function del(t, filter) {
  CALL.del.push({ t, filter });
  const no = (/no=eq\.(\d+)/.exec(filter) || [])[1];
  const id = (/move_id=eq\.(\d+)/.exec(filter) || [])[1];
  const p = (/part=eq\.([^&]+)/.exec(filter) || [])[1];
  if (t === 'ki_osp_order' && no) DB.osp = DB.osp.filter(o => String(o.no) !== no);
  if (t === 'ki_osp_order' && p) DB.osp = DB.osp.filter(o => o.part !== decodeURIComponent(p));
  if (t === 'ki_lot_progress' && no) DB.prog = DB.prog.filter(r => String(r.no) !== no);
  if (t === 'ki_lot_move' && id) DB.move = DB.move.filter(m => String(m.move_id) !== id);
  if (t === 'ki_lot_move' && p) DB.move = DB.move.filter(m => m.part !== decodeURIComponent(p));
  return Promise.resolve();
}

/* ── 화면 부팅 ── */
const ASK = { confirm: () => true, prompt: () => null, alerts: [], opened: [], printed: 0, csv: 0 };
function boot() {
  const html = fs.readFileSync(FILE, 'utf8').replace(/<script[^>]*\bsrc=[^>]*><\/script>/g, '');
  const dom = new JSDOM(html, { url: 'https://x.test/lot_route.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const win = dom.window, doc = win.document;
  win.confirm = (...a) => ASK.confirm(...a);
  win.prompt = (...a) => ASK.prompt(...a);
  win.alert = t => ASK.alerts.push(String(t));
  win.open = u => { ASK.opened.push(String(u)); return { focus() {} }; };
  win.print = () => { ASK.printed++; };
  win.URL.createObjectURL = () => { ASK.csv++; return 'blob:x'; };
  win.URL.revokeObjectURL = () => {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  win.KI = {
    $: s => doc.querySelector(s),
    el: (t, c, x) => { const e = doc.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; },
    esc, guard: async () => true, chrome: id => ({ it: { id, n: id, d: '' } }),
    page: (cur, acts) => { const ws = doc.createElement('div'), pg = doc.createElement('div'), act = doc.createElement('div');
      act.id = 'pgAct';
      (acts || []).forEach(([l, c, fn]) => { const b = doc.createElement('button');
        b.textContent = l; if (fn) b.addEventListener('click', fn); act.appendChild(b); });
      pg.appendChild(act); ws.appendChild(pg); doc.body.appendChild(ws);
      return { pg, head: doc.createElement('div'), act, ws }; },
    can: () => true, isAdmin: () => true, me: () => ({ emp_name: '세일러', dept: '품질경영팀' }),
    msg: t => { MSG.push(String(t)); }, combo: () => {}, comboSync: () => {},
    sortHead: () => ({ apply: r => r, sync: () => {} }),
    get: u => Promise.resolve(get(u)), ins, upd, del,
    upsert: (t, r) => ins(t, r), rpc: (p, a) => { CALL.rpc.push({ p, a }); return Promise.resolve({ ok: true, closed: true }); },
    isPhone: () => false, openPop: u => { ASK.opened.push(String(u)); }
  };
  win.KIDemo = { attach: () => {}, on: () => false };
  win.OBJ = { lotProg: 'ki_v_lot_progress', ospOrder: 'ki_v_osp_order', stdRoute: 'ki_v_std_route',
    lotReceipt: 'ki_v_lot_receipt', lotMove: 'ki_v_lot_move', vendor: 'ki_v_vendor',
    process: 'ki_v_process', moldSpec: 'ki_v_mold', lotToken: 'ki_v_lot_token',
    venStock: 'ki_v_vendor_stock' };
  win.TBL = { ospOrder: 'ki_osp_order', lotMove: 'ki_lot_move', lotReceipt: 'ki_lot_receipt',
    lotProg: 'ki_lot_progress' };
  win.KI_CFG = { APP_NAME: 'SCM Smart', VER: 'test', MANUAL_QUERY: false };
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m; while ((m = re.exec(html))) { try { win.eval(m[1]); }
    catch (e) { console.log('    ⚠️  스크립트 실행 오류 : ' + e.message); } }
  return { win, doc };
}
const MSG = [];
const btnByText = (doc, sel, t) => [...doc.querySelectorAll(sel)].find(b => b.textContent.trim().includes(t));
const rows = doc => [...doc.querySelectorAll('.lr-list .grid tbody tr')];
const rowOf = (doc, part) => rows(doc).find(r => (r.children[2] || {}).textContent === part);
const click = (win, e) => { e.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); };

(async () => {

/* ══════════ 목록 화면 버튼 ══════════ */
head('A. 목록 화면 버튼');
seed();
let { win, doc } = boot();
await wait(120);

ok('목록 3건 렌더', rows(doc).length === 3, rows(doc).length);

/* 조회 · 검색 · 상태 필터 */
const q = doc.querySelector('#q'), fs2 = doc.querySelector('#fs');
q.value = 'T002'; click(win, doc.querySelector('#btnQ')); await wait(30);
ok('[조회] 검색어 필터', rows(doc).length === 1 && rowOf(doc, 'T002'), rows(doc).length);
q.value = ''; click(win, doc.querySelector('#btnQ')); await wait(30);
ok('[조회] 검색어 해제', rows(doc).length === 3, rows(doc).length);
fs2.value = '외주 반출중'; click(win, doc.querySelector('#btnQ')); await wait(30);
ok('상태필터 [외주 반출중] = T001·T003', rows(doc).length === 2 && rowOf(doc, 'T001') && rowOf(doc, 'T003'), rows(doc).length);
fs2.value = '사내입고 대기'; click(win, doc.querySelector('#btnQ')); await wait(30);
ok('상태필터 [사내입고 대기] = T002', rows(doc).length === 1 && rowOf(doc, 'T002'), rows(doc).length);
fs2.value = ''; click(win, doc.querySelector('#btnQ')); await wait(30);

/* 상단 실행버튼 */
const act = doc.querySelector('#pgAct');
click(win, btnByText(doc, '#pgAct button', '엑셀다운로드')); await wait(30);
ok('[엑셀다운로드] CSV 생성', ASK.csv === 1, ASK.csv);
click(win, btnByText(doc, '#pgAct button', '인쇄')); await wait(30);
ok('[인쇄] print 호출', ASK.printed === 1, ASK.printed);
click(win, btnByText(doc, '#pgAct button', '새로고침')); await wait(120);
ok('[새로고침] 목록 유지', rows(doc).length === 3, rows(doc).length);
click(win, btnByText(doc, '#pgAct button', '신규등록')); await wait(60);
ok('[신규등록] 모달 열림', doc.querySelector('.lr-mo:not(.lr-moS)').style.display !== 'none');
ok('[신규등록] 사내입고 버튼 숨김', doc.querySelector('#mInh').style.display === 'none');
click(win, doc.querySelector('#mC')); await wait(30);
ok('[닫기] 모달 닫힘', doc.querySelector('.lr-mo:not(.lr-moS)').style.display === 'none');

/* ══════════ 모달 — 외주 작업중 LOT (T001) ══════════ */
head('B. T001 (외주 작업중) 모달 버튼');
click(win, rowOf(doc, 'T001')); await wait(80);
ok('행 클릭 → 모달 열림', doc.querySelector('.lr-mo:not(.lr-moS)').style.display !== 'none');
ok('제목에 LOT 표시', /T001/.test(doc.querySelector('#mTtl').textContent), doc.querySelector('#mTtl').textContent);
ok('[사내입고] 숨김 (공정 미완)', doc.querySelector('#mInh').style.display === 'none');
ok('[반출등록] 노출', doc.querySelector('#hOut').style.display !== 'none');

click(win, doc.querySelector('#hLg')); await wait(30);
ok('[범례] 패널 표시', /범례|외주|사내/.test(doc.body.textContent));
click(win, doc.querySelector('#hMv')); await wait(80);
ok('[현장기록] 이동기록 표시', doc.querySelectorAll('#moveBox table tbody tr').length >= 2,
   doc.querySelectorAll('#moveBox table tbody tr').length);
click(win, doc.querySelector('#mTag')); await wait(30);
ok('[이동표(QR)] lot_tag 새 창', ASK.opened.some(u => /lot_tag/.test(u)), ASK.opened.join());
click(win, doc.querySelector('#mRf')); await wait(150);
ok('[새로고침] 모달 유지', doc.querySelector('.lr-mo:not(.lr-moS)').style.display !== 'none');

/* 입고 버튼 : 잔여 초과 → 차단 / 정상 수량 → 등록 */
head('C. T001 [입고] 버튼 — 수량 검증');
let inBtn = doc.querySelector('[data-in]');
ok('반출건 행에 [입고] 버튼 존재', !!inBtn);
ASK.alerts.length = 0;
ASK.prompt = msg => /입고 수량/.test(msg) ? '1500' : (/처리 유형/.test(msg) ? '1' : '');
click(win, inBtn); await wait(120);
ok('잔여 초과 입고(1,500) 차단', ASK.alerts.some(a => /많습니다/.test(a)), ASK.alerts.join(' | '));
ok('차단 시 이동기록 미생성', DB.move.filter(m => m.io === '입고' && m.part === 'T001').length === 0);

ASK.alerts.length = 0;
ASK.prompt = msg => /입고 수량/.test(msg) ? '600' : (/처리 유형/.test(msg) ? '1' : '');
ASK.confirm = msg => /나중에 들어올 예정/.test(msg) ? true : true;   /* 분할 납품 */
click(win, doc.querySelector('[data-in]')); await wait(150);
ok('부분 입고 600 등록', DB.move.some(m => m.part === 'T001' && m.io === '입고' && m.in_qty === 600));
ok('반출건 잔여 400 유지', ospOpen(101) === 400, ospOpen(101));
ok('반출건 미마감', !(DB.osp.find(o => o.no === 101) || {}).idate);

/* 잔여 400 초과 재입고 차단 */
ASK.alerts.length = 0;
ASK.prompt = msg => /입고 수량/.test(msg) ? '500' : '1';
click(win, doc.querySelector('[data-in]')); await wait(120);
ok('잔여(400) 초과 재입고 차단', ASK.alerts.some(a => /많습니다/.test(a)), ASK.alerts.join(' | '));

/* ══════════ 반출등록 버튼 ══════════ */
head('D. [반출등록] · [+ LOT 추가] · [반출 등록]');
click(win, doc.querySelector('#hOut')); await wait(50);
ok('[반출등록] 입력폼 펼침', doc.querySelector('#outFold').classList.contains('open'));
const lotRows = () => doc.querySelectorAll('#lotBody tr').length;
const before = lotRows();
click(win, doc.querySelector('#fAdd')); await wait(20);
ok('[+ LOT 추가] 행 추가', lotRows() === before + 1, lotRows());
/* LOT 2건인데 수량 미입력 → 등록 거부 */
ASK.alerts.length = 0;
doc.querySelectorAll('#lotBody tr').forEach((tr, i) => { tr.querySelector('.lLot').value = i ? 'T001-B' : 'T001'; });
click(win, doc.querySelector('#mS')); await wait(60);
click(win, doc.querySelector('#mS')); await wait(80);
ok('LOT 2건 · 수량 미입력 → 등록 거부',
   /LOT별 수량/.test(doc.querySelector('#mMsg').textContent), doc.querySelector('#mMsg').textContent);
/* 추가행 삭제 후 정상 반출 */
click(win, doc.querySelectorAll('#lotBody tr')[1].querySelector('.del')); await wait(20);
ok('LOT 행 [✕] 삭제', lotRows() === before, lotRows());

/* ══════════ 사내입고(종결) 버튼 ══════════ */
head('E. T002 (전공정 완료) [사내입고(종결)]');
click(win, doc.querySelector('#mC')); await wait(30);
click(win, rowOf(doc, 'T002')); await wait(100);
const inh = doc.querySelector('#mInh');
ok('[사내입고(종결)] 노출', inh.style.display !== 'none');
ok('[반출등록] 잠김 안내', /사내입고/.test(doc.querySelector('#mMsg').textContent + doc.body.textContent));
ASK.alerts.length = 0;
ASK.prompt = msg => /사내입고 수량/.test(msg) ? '1500' : '';
click(win, inh); await wait(120);
ok('대기수량 초과 종결(1,500) 차단', ASK.alerts.some(a => /많습니다/.test(a)), ASK.alerts.join(' | '));
ok('차단 시 사내입고 미생성', DB.receipt.filter(r => r.part === 'T002').length === 0);

ASK.alerts.length = 0;
ASK.prompt = msg => /사내입고 수량/.test(msg) ? '700' : '';
ASK.confirm = () => true;                       /* 분납 */
click(win, doc.querySelector('#mInh')); await wait(150);
ok('분납 700 등록', DB.receipt.some(r => r.part === 'T002' && r.qty === 700));
ok('분납 후 사내대기 300', homeQtyDb('T002') === 300, homeQtyDb('T002'));
ok('분납 중이면 버튼이 [분납 추가]', /분납 추가/.test(doc.querySelector('#mInh').textContent),
   doc.querySelector('#mInh').textContent);
ASK.prompt = msg => /사내입고 수량/.test(msg) ? '300' : '';
click(win, doc.querySelector('#mInh')); await wait(150);
ok('잔량 300 종결', homeQtyDb('T002') === 0, homeQtyDb('T002'));
ok('종결 후 [사내입고] 비활성', doc.querySelector('#mInh').disabled || doc.querySelector('#mInh').style.display === 'none');
ASK.alerts.length = 0;
click(win, doc.querySelector('#mInh')); await wait(120);
ok('종결 LOT 재종결 불가', DB.receipt.filter(r => r.part === 'T002').length === 2,
   DB.receipt.filter(r => r.part === 'T002').length);

/* ══════════ 현장기록 정정 · 취소 · 삭제 ══════════ */
head('F. 현장기록 [정정] · [입고취소] · [삭제]');
click(win, doc.querySelector('#mC')); await wait(30);
click(win, rowOf(doc, 'T003')); await wait(100);
click(win, doc.querySelector('#hMv')); await wait(80);
const mvRows = () => doc.querySelectorAll('#moveBox table tbody tr').length;
ok('현장기록 행 렌더', mvRows() >= 3, mvRows());
const nMove = DB.move.filter(m => m.part === 'T003').length;
const mvv = [...doc.querySelectorAll('[data-mvv]')];
const vBtn = mvv[mvv.length - 1];   /* 가장 마지막에 등록된 기록만 취소할 수 있다 */
ok('입고 행에 [↩ 취소] 버튼', !!vBtn);
ASK.alerts.length = 0;
if (mvv.length > 1) { click(win, mvv[0]); await wait(60);
  ok('앞선 기록 취소는 거부', ASK.alerts.some(a => /이후에 등록된/.test(a))); }
ASK.confirm = () => true; ASK.prompt = () => '오등록';
if (vBtn) { click(win, vBtn); await wait(150); }
ok('[↩ 입고취소] 처리됨(void 또는 기록추가)',
   DB.move.some(m => m.part === 'T003' && (m.void || /취소/.test(m.remark || ''))) ||
   DB.move.filter(m => m.part === 'T003').length > nMove);
const xBtn = doc.querySelector('[data-mvx]');
if (xBtn) { const n0 = DB.move.filter(m => m.part === 'T003').length;
  click(win, xBtn); await wait(150);
  ok('[✕ 기록삭제] 1건 삭제', DB.move.filter(m => m.part === 'T003').length === n0 - 1,
     DB.move.filter(m => m.part === 'T003').length); }
else ok('[✕ 기록삭제] 버튼 존재', false);

/* ══════════ 반출건 수정 · 삭제 ══════════ */
head('G. 반출건 [✎ 수정] · [삭제] · 모달 [✕]');
click(win, doc.querySelector('#mC')); await wait(30);
click(win, rowOf(doc, 'T001')); await wait(100);
const ed = doc.querySelector('[data-ed]');
ok('[✎ 수정] 버튼 존재', !!ed);
if (ed) { click(win, ed); await wait(60);
  ok('[✎ 수정] 편집모드 진입', /수정 중/.test(doc.querySelector('#mMsg').textContent),
     doc.querySelector('#mMsg').textContent);
  ok('[↩ 수정취소] 노출', doc.querySelector('#mEC').style.display !== 'none');
  click(win, doc.querySelector('#mEC')); await wait(40);
  ok('[↩ 수정취소] 등록모드 복귀', !/수정 중/.test(doc.querySelector('#mMsg').textContent)); }
const rm = doc.querySelector('[data-rm]');
if (rm) { const n0 = DB.osp.filter(o => o.part === 'T001').length;
  ASK.confirm = () => true; ASK.prompt = () => '삭제';
  click(win, rm); await wait(180);
  ok('[삭제] 반출건 제거', DB.osp.filter(o => o.part === 'T001').length < n0,
     DB.osp.filter(o => o.part === 'T001').length); }
else ok('[삭제] 버튼 존재', false);
click(win, doc.querySelector('#mX')); await wait(30);
ok('[✕] 모달 닫힘', doc.querySelector('.lr-mo:not(.lr-moS)').style.display === 'none');

/* ══════════ 목록 [삭제] ══════════ */
head('H. 목록 [삭제] 버튼');
const delBtn = rowOf(doc, 'T003') && rowOf(doc, 'T003').querySelector('.del');
ok('행 [삭제] 버튼 존재', !!delBtn);
if (delBtn) { ASK.confirm = () => true; ASK.prompt = () => 'T003';
  click(win, delBtn); await wait(200);
  ok('[삭제] 후 목록 갱신', !rowOf(doc, 'T003') || DB.osp.every(o => o.part !== 'T003')); }

console.log('\n══════ lot_route.html 버튼 동작 시뮬레이션 ══════');
console.log(`  통과 ${PASS} · 실패 ${FAIL}`);
errs.forEach(e => console.log('   - ' + e));
process.exit(FAIL ? 1 : 0);
})();
