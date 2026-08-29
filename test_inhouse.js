const fs = require('fs');
const { JSDOM } = require('jsdom');

let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) { pass++; console.log('  ✅ ' + n); }
  else { fail++; console.log('  ❌ ' + n + (extra ? ' — ' + extra : '')); } };

/* ---------- 공통 스텁 ---------- */
function makeKI(win, doc, capture) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  return {
    $: s => doc.querySelector(s),
    el: (t, c, x) => { const e = doc.createElement(t); if (c) e.className = c;
      if (x != null) e.textContent = x; return e; },
    esc,
    guard: async () => true,
    chrome: id => ({ it: { id, n: id, d: '' } }),
    page: (cur, acts) => {
      const ws = doc.createElement('div'), pg = doc.createElement('div');
      const act = doc.createElement('div');
      (acts || []).forEach(([label, cls, fn]) => {
        const b = doc.createElement('button'); b.textContent = label;
        if (fn) b.addEventListener('click', fn); act.appendChild(b);
      });
      pg.appendChild(act); ws.appendChild(pg); doc.body.appendChild(ws);
      return { pg, head: doc.createElement('div'), act, ws };
    },
    can: () => true, isAdmin: () => true,
    me: () => ({ emp_name: '테스터' }),
    msg: () => {},
    get: url => Promise.resolve(capture.get(url)),
    ins: (t, rows) => { capture.ins.push({ t, rows }); return Promise.resolve(rows); },
    upd: (t, f, b) => { capture.upd.push({ t, f, b }); return Promise.resolve(b); },
    del: () => Promise.resolve(),
    upsert: (t, rows) => { capture.ins.push({ t, rows }); return Promise.resolve(rows); },
    POST: () => Promise.resolve('tok'),
    isPhone: () => false, openPop: () => {}
  };
}

function run(file, capture) {
  const html = fs.readFileSync(file, 'utf8');
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>',
    { url: 'https://x.test/' + file, runScripts: 'outside-only', pretendToBeVisual: true });
  const win = dom.window, doc = win.document;
  win.confirm = () => false; win.alert = () => {}; win.prompt = () => null;
  win.open = () => {};
  win.URL.createObjectURL = () => 'blob:x'; win.URL.revokeObjectURL = () => {};
  win.KI = makeKI(win, doc, capture);
  win.OBJ = { stdRoute: 'v_std_route', process: 'v_process', vendor: 'v_vendor',
    lotProg: 'v_lot_progress', ospOrder: 'v_osp_order', moldSpec: 'v_mold_master',
    lotReceipt: 'v_lot_receipt', lotMove: 'v_lot_move' };
  win.TBL = { stdRouteT: 'machining_standard_routes', ospOrder: 'outsourcing_order_status_rows',
    lotMove: 'ki_lot_move', lotProg: 'machining_purchase_progress_rows',
    lotReceipt: 'ki_lot_receipt' };
  const code = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g.exec(
    html.replace(/<script[^>]*\bsrc=[^>]*><\/script>/g, ''))[1];
  win.eval(code);
  return { win, doc };
}

const ROUTES = [
  { row_no: 1, standard_process_no: 2, standard_process_name: '4공정_MHGW',
    steps: ['MS', 'HQ', 'GS', 'WS'], inhouse: ['MS', 'WS'] }
];
const PROCS = [
  { process_code: 'MS', process_name: '성형밀링(소형)', process_group: '가공', sort_order: 5 },
  { process_code: 'HQ', process_name: '열처리', process_group: '가공', sort_order: 8 },
  { process_code: 'GS', process_name: '성형연삭(소형)', process_group: '가공', sort_order: 11 },
  { process_code: 'WS', process_name: 'WIRE CUT', process_group: '가공', sort_order: 15 }
];

function baseCapture(extra) {
  const map = u => {
    if (u.startsWith('v_std_route')) return ROUTES;
    if (u.startsWith('v_process')) return PROCS;
    if (u.startsWith('v_vendor')) return [{ vendor_name: '대성열처리' }, { vendor_name: 'BTC' }];
    if (u.startsWith('v_mold_master')) return [];
    if (u.startsWith('v_lot_receipt')) return [];
    if (u.startsWith('v_lot_move')) return [];
    if (u.startsWith('v_lot_progress')) return (extra && extra.prog) || [];
    if (u.startsWith('v_osp_order')) return (extra && extra.osp) || [];
    return [];
  };
  return { get: map, ins: [], upd: [] };
}
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {

/* ========== 1. std_route.html ========== */
console.log('\n[std_route.html] 표준공정경로 — 사내/외주 편집');
{
  const cap = baseCapture();
  const { win, doc } = run('std_route.html', cap);
  await wait(60);

  const rows = doc.querySelectorAll('.grid tbody tr');
  ok('경로 목록 1건 렌더', rows.length === 1, 'rows=' + rows.length);
  const chain = doc.querySelector('td.rchain').innerHTML;
  ok('사내 공정 MS·WS 가 주황 칩(rc in)', (chain.match(/rc in/g) || []).length === 2);
  ok('외주 공정 HQ·GS 가 파랑 칩(rc)', (chain.match(/class="rc"/g) || []).length === 2);
  ok('외주/사내 집계 표시', /외 2/.test(rows[0].innerHTML) && /내 2/.test(rows[0].innerHTML));

  rows[0].dispatchEvent(new win.Event('click', { bubbles: true }));
  await wait(20);
  const lis = doc.querySelectorAll('#stList li');
  ok('편집기에 4단계 로드', lis.length === 4);
  ok('1단계 MS 는 사내(k-in)', lis[0].className === 'k-in');
  ok('2단계 HQ 는 외주(k-out)', lis[1].className === 'k-out');
  ok('요약 문구', /4단계 · 외주 2 · 사내 2/.test(doc.querySelector('#eSum').textContent),
     doc.querySelector('#eSum').textContent);

  /* HQ 를 사내로 토글 */
  lis[1].querySelector('[data-k]').dispatchEvent(new win.Event('click', { bubbles: true }));
  await wait(10);
  ok('HQ 사내 토글 반영', doc.querySelectorAll('#stList li')[1].className === 'k-in');

  /* 순서 이동 : GS ▲ */
  doc.querySelectorAll('#stList li')[2].querySelector('[data-u]')
     .dispatchEvent(new win.Event('click', { bubbles: true }));
  await wait(10);
  const names = [...doc.querySelectorAll('#stList .nm')].map(n => n.textContent.split('성')[0].trim());
  ok('GS 가 2번째로 이동', /GS/.test(doc.querySelectorAll('#stList li')[1].textContent),
     doc.querySelectorAll('#stList li')[1].textContent.slice(0, 20));

  /* 저장 */
  doc.querySelector('#eSave').dispatchEvent(new win.Event('click', { bubbles: true }));
  await wait(60);
  const u = cap.upd[0];
  ok('저장 대상은 원천 테이블', u && u.t === 'machining_standard_routes', u && u.t);
  ok('steps 순서 저장', u && JSON.stringify(u.b.steps) === JSON.stringify(['MS','GS','HQ','WS']),
     u && JSON.stringify(u.b.steps));
  ok('inhouse 에 MS·HQ·WS 저장', u && JSON.stringify(u.b.inhouse.slice().sort()) ===
     JSON.stringify(['HQ','MS','WS']), u && JSON.stringify(u.b.inhouse));
}

/* ========== 2. lot_route.html ========== */
console.log('\n[lot_route.html] LOT 진행등록 — 이동구분 자동선택 · 저장');
{
  const osp = [{ no: 1001, part: 'lot801', job: 'JOB-260830-01', mp: 'MS', vendor: '밀링실',
    move_kind: '사내', route_no: '2', sdate: '2026-08-20', idate: '2026-08-22',
    qty: 100, lots: [{ lot: 'lot801', qty: 100 }], map_part: 'P-1' }];
  const prog = [{ no: 1, job: 'JOB-260830-01', proc: 'M', part: 'lot801',
    route_no: '2', steps: [{ mp: 'MS', vendor: '밀링실', date: '2026-08-22' }] }];
  const cap = baseCapture({ osp, prog });
  const { win, doc } = run('lot_route.html', cap);
  await wait(80);

  const tr = doc.querySelector('.lr-list .grid tbody tr');
  ok('LOT 목록 렌더', !!tr);
  const mini = doc.querySelector('td.mini-chain').innerHTML;
  ok('미니체인 사내 구간 k-in', /cn k-in/.test(mini));
  ok('미니체인 외주 구간 k-out', /cn k-out/.test(mini));
  ok('사내 이동 아이콘 📦', /📦/.test(mini));
  ok('외주 이동 아이콘 🚚', /🚚/.test(mini));

  tr.dispatchEvent(new win.Event('click', { bubbles: true }));
  await wait(40);

  ok('다음 공정 HQ 자동 선택', doc.querySelector('#fMp').value === 'HQ',
     doc.querySelector('#fMp').value);
  ok('HQ 는 외주 → 구분 자동 외주', doc.querySelector('#fKind').value === '외주',
     doc.querySelector('#fKind').value);
  ok('외주일 때 외주처 셀렉트 노출', doc.querySelector('#fVen').style.display !== 'none');
  ok('외주일 때 단가 노출', doc.querySelector('#fQuote').style.display !== 'none');
  ok('저장 버튼 라벨(외주)', /반출 등록/.test(doc.querySelector('#mS').textContent),
     doc.querySelector('#mS').textContent);

  const flow = doc.querySelector('#iChain').innerHTML;
  ok('다이어그램 kd-in 노드 존재', /kd-in/.test(flow));
  ok('다이어그램 kd-out 노드 존재', /kd-out/.test(flow));
  ok('노드에 사내/외주 배지', /kbadge/.test(flow));

  /* WS(사내) 로 바꾸면 폼이 사내 모드로 전환되어야 한다 */
  doc.querySelector('#fMp').value = 'WS';
  doc.querySelector('#fMp').dispatchEvent(new win.Event('change', { bubbles: true }));
  await wait(20);
  ok('WS 선택 시 구분 사내로 전환', doc.querySelector('#fKind').value === '사내',
     doc.querySelector('#fKind').value);
  ok('사내일 때 이동처 입력칸 노출', doc.querySelector('#fSite').style.display !== 'none');
  ok('사내일 때 외주처 셀렉트 숨김', doc.querySelector('#fVen').style.display === 'none');
  ok('사내일 때 단가 숨김', doc.querySelector('#fQuote').style.display === 'none');
  ok('라벨 = 이동처', doc.querySelector('#fVenL').textContent === '이동처 *',
     doc.querySelector('#fVenL').textContent);
  ok('라벨 = 이동일', doc.querySelector('#fSdateL').textContent === '이동일');
  ok('저장 버튼 라벨(사내)', /사내이동 등록/.test(doc.querySelector('#mS').textContent),
     doc.querySelector('#mS').textContent);

  /* 사내 이동처 datalist 추천값 */
  ok('사내 이동처 datalist 채워짐', doc.querySelector('#dlSite').children.length > 0);

  /* 저장 : 이동처 미입력이면 사내용 오류 메시지 */
  doc.querySelector('#outFold').classList.add('open');
  doc.querySelector('#mS').dispatchEvent(new win.Event('click', { bubbles: true }));
  await wait(30);
  ok('이동처 미입력 검증 메시지', /사내 이동처/.test(doc.querySelector('#mMsg').textContent),
     doc.querySelector('#mMsg').textContent);

  /* 이동처 입력 후 저장 */
  doc.querySelector('#fSite').value = 'WIRE실';
  doc.querySelector('#mS').dispatchEvent(new win.Event('click', { bubbles: true }));
  await wait(80);
  const insOsp = cap.ins.find(x => x.t === 'outsourcing_order_status_rows');
  const insMv = cap.ins.find(x => x.t === 'ki_lot_move');
  ok('발주행에 move_kind=사내 저장', insOsp && insOsp.rows[0].move_kind === '사내',
     insOsp && insOsp.rows[0].move_kind);
  ok('발주행 vendor = 이동처', insOsp && insOsp.rows[0].vendor === 'WIRE실',
     insOsp && insOsp.rows[0].vendor);
  ok('사내 이동은 단가 null', insOsp && insOsp.rows[0].quote === null);
  ok('이동이력에 move_kind=사내 저장', insMv && insMv.rows[0].move_kind === '사내',
     insMv && insMv.rows[0].move_kind);
  ok('이동이력 비고에 [사내] 표기', insMv && /\[사내\]/.test(insMv.rows[0].remark || ''),
     insMv && insMv.rows[0].remark);
}

/* ========== 3. lot_tag.html ========== */
console.log('\n[lot_tag.html] 공정이동표 — 구분 표기 · 사내 인수확인란');
{
  const osp = [
    { no: 1001, part: 'lot801', job: 'J1', mp: 'MS', vendor: '밀링실', move_kind: '사내',
      route_no: '2', sdate: '2026-08-20', idate: '2026-08-22', qty: 100, map_part: 'P-1' },
    { no: 1002, part: 'lot801', job: 'J1', mp: 'HQ', vendor: '대성열처리', move_kind: '외주',
      route_no: '2', sdate: '2026-08-23', qty: 100, map_part: 'P-1' }
  ];
  const moves = [
    { move_id: 1, part: 'lot801', io: '출고', move_kind: '사내', mp: 'MS', vendor: '밀링실',
      move_date: '2026-08-20', out_qty: 100 },
    { move_id: 2, part: 'lot801', io: '입고', move_kind: '사내', mp: 'MS', vendor: '밀링실',
      move_date: '2026-08-22', in_qty: 100 },
    { move_id: 3, part: 'lot801', io: '출고', move_kind: '외주', mp: 'HQ', vendor: '대성열처리',
      move_date: '2026-08-23', out_qty: 100 }
  ];
  const cap = {
    get: u => {
      if (u.startsWith('v_lot_progress')) return [{ no: 1, job: 'J1', part: 'lot801',
        route_no: '2', steps: [{ mp: 'MS', vendor: '밀링실', date: '2026-08-22' }] }];
      if (u.startsWith('v_osp_order')) return osp;
      if (u.startsWith('v_std_route')) return ROUTES;
      if (u.startsWith('v_process')) return PROCS;
      if (u.startsWith('v_lot_move')) return moves;
      if (u.startsWith('v_vendor')) return [{ vendor_name: '대성열처리', phone: '031-000-0000' }];
      return [];
    }, ins: [], upd: []
  };
  const html = fs.readFileSync('lot_tag.html', 'utf8');
  const dom = new JSDOM(html.replace(/<script[^>]*\bsrc=[^>]*><\/script>/g, ''),
    { url: 'https://x.test/lot_tag.html?lot=lot801', runScripts: 'outside-only' });
  const win = dom.window, doc = win.document;
  win.KI = makeKI(win, doc, cap);
  win.OBJ = { lotProg: 'v_lot_progress', ospOrder: 'v_osp_order', stdRoute: 'v_std_route',
    lotReceipt: 'v_lot_receipt', lotMove: 'v_lot_move', vendor: 'v_vendor', process: 'v_process' };
  win.qrcode = () => ({ addData(){}, make(){}, createImgTag: () => '<img>' });
  win.confirm = () => false; win.alert = () => {};
  const code = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g.exec(
    html.replace(/<script[^>]*\bsrc=[^>]*><\/script>/g, ''))[1];
  win.eval(code);
  await wait(120);

  const sheet = doc.getElementById('sheet').innerHTML;
  ok('표준공정 체인에 사내 칩(rc in)', /rc in/.test(sheet));
  ok('표준공정 체인에 외주 칩', /class="rc"/.test(sheet));
  ok('흐름표에 사내행(r-in)', /r-in/.test(sheet));
  ok('흐름표에 외주행(r-out)', /r-out/.test(sheet));
  ok('구분 배지 kb 렌더', /class="kb/.test(sheet));
  ok('사내 인수확인란 출력', /인수 \(작업장\)/.test(sheet));
  const cont = [...doc.querySelectorAll('.foot')].map(n => n.textContent)
    .filter(t => /협력사 연락처/.test(t)).join('');
  ok('협력사 연락처는 외주 업체만', /대성열처리/.test(cont) && !/밀링실/.test(cont), cont);

  const heads = doc.querySelectorAll('.mv thead th').length;
  const firstRowTds = doc.querySelectorAll('.mv tbody tr')[0].querySelectorAll('td').length;
  ok('표 헤더/본문 열수 일치 (' + heads + ')', heads === firstRowTds,
     'th=' + heads + ' td=' + firstRowTds);
}

/* ========== 4. lot_scan.html (사내 PC 현장) ========== */
console.log('\n[lot_scan.html] QR 입출고(현장) — 사내 이동 대응');
{
  const osp = [{ no: 1001, part: 'lot801', job: 'J1', mp: 'MS', vendor: '밀링실',
    move_kind: '사내', route_no: '2', sdate: '2026-08-20', idate: '2026-08-22',
    qty: 100, map_part: 'P-1' }];
  const cap = {
    get: u => {
      if (u.startsWith('v_lot_progress')) return [{ no: 1, job: 'J1', part: 'lot801',
        route_no: '2', steps: [{ mp: 'MS', vendor: '밀링실', date: '2026-08-22' }] }];
      if (u.startsWith('v_osp_order')) return osp;
      if (u.startsWith('v_std_route')) return ROUTES;
      if (u.startsWith('v_process')) return PROCS;
      if (u.startsWith('v_lot_move')) return [];
      if (u.startsWith('v_lot_receipt')) return [];
      if (u.startsWith('v_vendor')) return [{ vendor_name: '대성열처리' }];
      return [];
    }, ins: [], upd: []
  };
  const html = fs.readFileSync('lot_scan.html', 'utf8');
  const dom = new JSDOM(html.replace(/<script[^>]*\bsrc=[^>]*><\/script>/g, ''),
    { url: 'https://x.test/lot_scan.html?lot=lot801', runScripts: 'outside-only',
      pretendToBeVisual: true });
  const win = dom.window, doc = win.document;
  win.confirm = () => true; win.alert = () => {}; win.prompt = () => null;
  win.KI = makeKI(win, doc, cap);
  win.OBJ = { lotProg: 'v_lot_progress', ospOrder: 'v_osp_order', stdRoute: 'v_std_route',
    lotReceipt: 'v_lot_receipt', lotMove: 'v_lot_move', vendor: 'v_vendor', process: 'v_process' };
  win.TBL = { ospOrder: 'outsourcing_order_status_rows', lotMove: 'ki_lot_move',
    lotReceipt: 'ki_lot_receipt' };
  const clean = html.replace(/<script[^>]*\bsrc=[^>]*><\/script>/g, '');
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let mm; while ((mm = re.exec(clean))) win.eval(mm[1]);
  await wait(150);

  const chain = doc.querySelector('.chain');
  ok('체인에 사내 구간(k-in)', chain && /k-in/.test(chain.innerHTML));
  ok('체인에 외주 구간(k-out)', chain && /k-out/.test(chain.innerHTML));

  /* 출고 탭 : 다음 공정 HQ(외주) 기본 */
  ok('출고 구분 안내 박스 존재', !!doc.querySelector('#outKind'));
  ok('HQ(외주) → 외주처 셀렉트 노출', doc.querySelector('#outVenRow').style.display !== 'none');
  ok('HQ(외주) → 이동처 입력 숨김', doc.querySelector('#outSiteRow').style.display === 'none');

  doc.querySelector('#outMp').value = 'WS';
  doc.querySelector('#outMp').dispatchEvent(new win.Event('change', { bubbles: true }));
  await wait(20);
  ok('WS(사내) → 이동처 입력 노출', doc.querySelector('#outSiteRow').style.display !== 'none');
  ok('WS(사내) → 외주처 셀렉트 숨김', doc.querySelector('#outVenRow').style.display === 'none');
  ok('안내 박스가 사내(kbig in)', /in/.test(doc.querySelector('#outKind').className),
     doc.querySelector('#outKind').className);
  ok('이동처 추천 datalist', doc.querySelector('#dlSite').children.length > 0);

  doc.querySelector('#outSite').value = 'WIRE실';
  doc.querySelector('#outQty').value = '100';
  doc.querySelector('#btOut').dispatchEvent(new win.Event('click', { bubbles: true }));
  await wait(80);
  const io1 = cap.ins.find(x => x.t === 'outsourcing_order_status_rows');
  const im1 = cap.ins.find(x => x.t === 'ki_lot_move');
  ok('발주행 move_kind=사내', io1 && io1.rows[0].move_kind === '사내', io1 && io1.rows[0].move_kind);
  ok('발주행 vendor=WIRE실', io1 && io1.rows[0].vendor === 'WIRE실');
  ok('이동이력 move_kind=사내', im1 && im1.rows[0].move_kind === '사내');
}

/* ========== 5. lot_qr.html (모바일 이동표 QR) ========== */
console.log('\n[lot_qr.html] 협력사·사내 모바일 QR — 사내 이동 대응');
{
  const INFO = {
    part: 'lot801',
    lot: { no: 1, job: 'J1', part: 'lot801',
      steps: [{ mp: 'MS', vendor: '밀링실', date: '2026-08-22' }] },
    osp: [{ no: 1001, job: 'J1', mp: 'MS', vendor: '밀링실', move_kind: '사내',
      sdate: '2026-08-20', idate: '2026-08-22', qty: 100, map_part: 'P-1', route_no: '2' },
      { no: 1002, job: 'J1', mp: 'HQ', vendor: '대성열처리', move_kind: '외주',
      sdate: '2026-08-23', idate: null, qty: 100, map_part: 'P-1', route_no: '2' }],
    route: { standard_process_no: 2, standard_process_name: '4공정_MHGW',
      steps: ['MS','HQ','GS','WS'], inhouse: ['MS','WS'] },
    moves: [{ move_id: 3, osp_no: 1002, io: '출고', move_kind: '외주', mp: 'HQ',
      vendor: '대성열처리', move_date: '2026-08-23', out_qty: 100 }],
    receipt: null,
    vendors: ['대성열처리', 'BTC'],
    sites: ['밀링실', '연삭실'],
    procs: PROCS.map(p => ({ c: p.process_code, n: p.process_name }))
  };
  const calls = [];
  const html = fs.readFileSync('lot_qr.html', 'utf8');
  const dom = new JSDOM(html.replace(/<script[^>]*\bsrc=[^>]*><\/script>/g, ''),
    { url: 'https://x.test/lot_qr.html?t=TOK', runScripts: 'outside-only',
      pretendToBeVisual: true });
  const win = dom.window, doc = win.document;
  win.KI_CFG = { SUPABASE_URL: 'https://db.test', SUPABASE_KEY: 'k' };
  win.confirm = () => true;
  win.fetch = async (url, opt) => {
    const fn = url.split('/rpc/')[1];
    const body = JSON.parse(opt.body);
    calls.push({ fn, body });
    if (fn === 'ki_scan_info') return { ok: true, text: async () => JSON.stringify(INFO) };
    return { ok: true, text: async () => JSON.stringify({ ok: true, left: 0, kind: body.p_kind }) };
  };
  win.localStorage.setItem('ki_qr_vendor', '대성열처리');
  win.localStorage.setItem('ki_qr_worker', '홍길동');
  const code = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g.exec(
    html.replace(/<script[^>]*\bsrc=[^>]*><\/script>/g, ''))[1];
  win.eval(code);
  await wait(150);

  const steps = doc.querySelectorAll('.stp');
  ok('공정 4단계 렌더', steps.length === 4, 'n=' + steps.length);
  ok('MS 는 사내(k-in)', /k-in/.test(steps[0].className));
  ok('HQ 는 외주(k-out)', /k-out/.test(steps[1].className));
  ok('구분 라벨 표기', /사내/.test(steps[0].textContent) && /외주/.test(steps[1].textContent));

  /* 출고 탭 열기 */
  const outTab = [...doc.querySelectorAll('.tab button')].find(b => b.dataset.t === 'out');
  outTab.dispatchEvent(new win.Event('click', { bubbles: true }));
  await wait(30);
  ok('출고 구분 안내 박스 존재', !!doc.querySelector('#outKind'));

  doc.querySelector('#outMp').value = 'WS';
  doc.querySelector('#outMp').dispatchEvent(new win.Event('change', { bubbles: true }));
  await wait(20);
  ok('WS(사내) → 이동처 입력 노출', doc.querySelector('#outSiteRow').style.display !== 'none');
  ok('WS(사내) → 받는 업체 숨김', doc.querySelector('#outVenRow').style.display === 'none');
  ok('안내 박스 사내 스타일', /kbig in/.test(doc.querySelector('#outKind').className));
  ok('사내 이동처 datalist(D.sites)', doc.querySelector('#dlSite').children.length === 2);

  doc.querySelector('#outSite').value = '연삭실';
  doc.querySelector('#outQty').value = '100';
  doc.querySelector('#act').dispatchEvent(new win.Event('click', { bubbles: true }));
  await wait(80);
  const outCall = calls.filter(c => c.fn === 'ki_scan_out').pop();
  ok('ki_scan_out 호출됨', !!outCall);
  ok('p_kind=사내 전달', outCall && outCall.body.p_kind === '사내', outCall && outCall.body.p_kind);
  ok('p_vendor=연삭실 전달', outCall && outCall.body.p_vendor === '연삭실');
  ok('p_token 전달', outCall && outCall.body.p_token === 'TOK');
}

console.log('\n──────────────────────────────');
console.log('통과 ' + pass + ' / 실패 ' + fail);
process.exit(fail ? 1 : 0);
})();
