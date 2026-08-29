/* ============================================================
   GI MES — 사내/외주 공정이동 시뮬레이션
   경로 91(혼합 사내2·외주4) / 92(사내전용) / 93(외주전용)
   LOT 9건 × 화면 4종(진행등록 · 공정이동표 · QR현장 · 모바일QR)
   ============================================================ */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const FX = require('./fixture');

const LOG = [];
let PASS = 0, WARN = 0, FAIL = 0;
const say = t => { LOG.push(t); console.log(t); };
const ok   = (n, c, x) => { if (c) { PASS++; say('    ✅ ' + n); }
  else { FAIL++; say('    ❌ ' + n + (x != null ? '  → ' + x : '')); } };
const warn = (n, x) => { WARN++; say('    ⚠️  ' + n + (x != null ? '  → ' + x : '')); };

const wait = ms => new Promise(r => setTimeout(r, ms));
const esc0 = s => String(s == null ? '' : s);

/* ---------- 공통 KI 스텁 ---------- */
function makeKI(win, doc, cap) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  return {
    $: s => doc.querySelector(s), el: (t, c, x) => { const e = doc.createElement(t);
      if (c) e.className = c; if (x != null) e.textContent = x; return e; },
    esc, guard: async () => true, chrome: id => ({ it: { id, n: id, d: '' } }),
    page: (cur, acts) => { const ws = doc.createElement('div'), pg = doc.createElement('div');
      const act = doc.createElement('div');
      (acts || []).forEach(([l, c, fn]) => { const b = doc.createElement('button');
        b.textContent = l; if (fn) b.addEventListener('click', fn); act.appendChild(b); });
      pg.appendChild(act); ws.appendChild(pg); doc.body.appendChild(ws);
      return { pg, head: doc.createElement('div'), act, ws }; },
    can: () => true, isAdmin: () => true, me: () => ({ emp_name: '세일러', dept: '품질경영팀' }),
    msg: () => {}, get: url => Promise.resolve(cap.get(url)),
    ins: (t, r) => { cap.ins.push({ t, rows: r }); return Promise.resolve(r); },
    upd: (t, f, b) => { cap.upd.push({ t, f, b }); return Promise.resolve(b); },
    del: () => Promise.resolve(), upsert: (t, r) => { cap.ins.push({ t, rows: r }); return Promise.resolve(r); },
    POST: (p, a) => { cap.rpc.push({ p, a }); return Promise.resolve('TTOK-NEW'); },
    isPhone: () => false, openPop: () => {}
  };
}
const OBJ = { lotProg: 'v_lot_progress', ospOrder: 'v_osp_order', stdRoute: 'v_std_route',
  lotReceipt: 'v_lot_receipt', lotMove: 'v_lot_move', vendor: 'v_vendor',
  process: 'v_process', moldSpec: 'v_mold_master' };
const TBL = { stdRouteT: 'machining_standard_routes', ospOrder: 'outsourcing_order_status_rows',
  lotMove: 'ki_lot_move', lotProg: 'machining_purchase_progress_rows', lotReceipt: 'ki_lot_receipt' };

function capFor(partFilter) {
  const f = x => !partFilter || x.part === partFilter;
  return {
    ins: [], upd: [], rpc: [],
    get: u => {
      const q = decodeURIComponent(u);
      if (q.startsWith('v_lot_progress')) return FX.PROG.filter(f);
      if (q.startsWith('v_osp_order'))    return FX.OSP.filter(f);
      if (q.startsWith('v_std_route'))    return FX.ROUTES;
      if (q.startsWith('v_process'))      return FX.PROCS;
      if (q.startsWith('v_vendor'))       return FX.VENDORS_VIEW;
      if (q.startsWith('v_mold_master'))  return [];
      if (q.startsWith('v_lot_receipt'))  return FX.RECEIPT.filter(f);
      if (q.startsWith('v_lot_move')) {
        const pe = /part=eq\.([^&]+)/.exec(q);
        let rows = FX.MOVES.filter(m => pe ? m.part === pe[1] : f(m));
        if (/io=eq\.사내입고/.test(q)) rows = rows.filter(m => m.io === '사내입고');
        else if (/io=in\./.test(q))    rows = rows.filter(m => m.io === '도착' || m.io === '입고');
        rows = rows.slice().sort((a, b) => String(b.move_date).localeCompare(String(a.move_date))
          || b.move_id - a.move_id);
        const lm = /limit=(\d+)/.exec(q);
        return lm ? rows.slice(0, Number(lm[1])) : rows;
      }
      return [];
    }
  };
}

function boot(file, url, cap, extra) {
  const html = fs.readFileSync(file, 'utf8');
  const clean = html.replace(/<script[^>]*\bsrc=[^>]*><\/script>/g, '');
  const dom = new JSDOM(clean, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const win = dom.window, doc = win.document;
  win.confirm = () => true; win.alert = () => {}; win.prompt = () => null; win.open = () => {};
  win.print = () => {};
  win.URL.createObjectURL = () => 'blob:x'; win.URL.revokeObjectURL = () => {};
  win.KI = makeKI(win, doc, cap); win.OBJ = OBJ; win.TBL = TBL;
  Object.assign(win, extra || {});
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m; while ((m = re.exec(clean))) win.eval(m[1]);
  return { win, doc };
}

/* ---------- 레이아웃 감사 ---------- */
const CH = 7.0;   /* 한글 1자 ≈ 7px @11px 맑은고딕 (근사) */
function layoutAudit(doc, label) {
  const issues = [];
  /* 1) 표 헤더/본문 열수 일치 */
  doc.querySelectorAll('table').forEach((t, ti) => {
    const ths = [...t.querySelectorAll('thead th')];
    if (!ths.length) return;
    const hw = ths.reduce((a, th) => a + (Number(th.getAttribute('colspan')) || 1), 0);
    [...t.querySelectorAll('tbody tr')].forEach((tr, ri) => {
      const tds = [...tr.children];
      if (!tds.length) return;
      const bw = tds.reduce((a, td) => a + (Number(td.getAttribute('colspan')) || 1), 0);
      if (bw !== hw) issues.push({ lv: 'FAIL',
        m: label + ' table#' + ti + ' row#' + ri + ' 열수 불일치 th=' + hw + ' td=' + bw });
    });
  });
  /* 2) 고정폭 컬럼 대비 내용 과대 (가로 밀림 후보) */
  doc.querySelectorAll('table').forEach((t, ti) => {
    const ths = [...t.querySelectorAll('thead th')];
    if (!ths.length) return;
    /* .lr-open 내부 표와 이동표(.mv)는 CSS 상 줄바꿈되므로 폭 검사 제외 */
    const wrapNo = !t.closest('.lr-open') && !/\bmv\b/.test(t.className);
    ths.forEach((th, ci) => {
      const w = /width:\s*(\d+)px/.exec(th.getAttribute('style') || '');
      if (!w || Number(w[1]) === 0) return;
      let max = 0, sample = '';
      [...t.querySelectorAll('tbody tr')].forEach(tr => {
        const td = tr.children[ci]; if (!td) return;
        /* 스크롤 컨테이너(mini-chain 등)는 제외 */
        if (/mini-chain|rchain/.test(td.className)) return;
        const txt = (td.textContent || '').trim();
        if (txt.length > max) { max = txt.length; sample = txt; }
      });
      if (wrapNo && max * CH > Number(w[1]) + 10)
        issues.push({ lv: 'WARN', m: label + ' 「' + (th.textContent || '').trim() + '」 열 폭 ' +
          w[1] + 'px < 내용 ~' + Math.round(max * CH) + 'px', x: sample.slice(0, 26) });
    });
  });
  /* 3) 렌더 오류 문자열 */
  const body = doc.body.textContent || '';
  ['undefined', 'NaN', '[object Object]'].forEach(bad => {
    if (body.includes(bad)) issues.push({ lv: 'FAIL', m: label + ' 화면에 "' + bad + '" 노출' });
  });
  /* 4) 폼 그리드(label/field 짝) */
  doc.querySelectorAll('.lr-f, .sr-f').forEach((g, gi) => {
    if (g.children.length % 2 !== 0) issues.push({ lv: 'FAIL',
      m: label + ' 폼그리드#' + gi + ' 라벨/입력 짝 불일치 (' + g.children.length + '칸)' });
  });
  return issues;
}
function report(issues) {
  issues.forEach(i => { if (i.lv === 'FAIL') { FAIL++; say('    ❌ ' + i.m + (i.x ? '  → ' + i.x : '')); }
    else { WARN++; say('    ⚠️  ' + i.m + (i.x ? '  → ' + i.x : '')); } });
  if (!issues.length) { PASS++; say('    ✅ 레이아웃 이상 없음'); }
}

/* ---------- 시나리오 정의 ---------- */
const SCEN = {
  'TLOT-M1': { rt: 91, t: '혼합 · 최초 사내이동중 (MA 미도착)',  cur: 'MA', kind: '사내', wip: true,  next: 'MS' },
  'TLOT-M2': { rt: 91, t: '혼합 · 사내→외주 전환, MS 업체 작업중', cur: 'MS', kind: '외주', wip: false, next: 'HQ' },
  'TLOT-M3': { rt: 91, t: '혼합 · 외주→사내 전환, GS 사내이동중', cur: 'GS', kind: '사내', wip: true,  next: 'WS' },
  'TLOT-M4': { rt: 91, t: '혼합 · 전공정 완료, 사내입고 대기',    cur: 'NM2', kind: '외주', wip: false, next: '' },
  'TLOT-M5': { rt: 91, t: '혼합 · 사내 GS 보유 → WS 부분출고(잔량 40)', cur: 'WS', kind: '외주', wip: true, next: 'NM2' },
  'TLOT-H1': { rt: 92, t: '사내전용 · MA 완료, MF 사내이동중',    cur: 'MF', kind: '사내', wip: true,  next: 'GM' },
  'TLOT-H2': { rt: 92, t: '사내전용 · 전공정 완료 + 사내입고 종결(부족 3)', cur: 'GM', kind: '사내', wip: false, next: '' },
  'TLOT-O1': { rt: 93, t: '외주전용 · MS 완료, HQ 반출중(미도착)', cur: 'HQ', kind: '외주', wip: true,  next: 'GS' },
  'TLOT-O2': { rt: 93, t: '외주전용 · 전공정 완료, 사내입고 대기', cur: 'GS', kind: '외주', wip: false, next: '' }
};
const kindOfStep = (rt, mp) => {
  const r = FX.ROUTES.find(x => x.standard_process_no === rt);
  return r.inhouse.indexOf(mp) >= 0 ? '사내' : '외주';
};

(async () => {

/* ══════════ 1. lot_route.html — LOT 진행등록 ══════════ */
say('\n══════ [1] lot_route.html · LOT 진행등록 ══════');
{
  const cap = capFor(null);
  const { win, doc } = boot('lot_route.html', 'https://x.test/lot_route.html', cap);
  await wait(150);

  const rows = [...doc.querySelectorAll('.lr-list .grid tbody tr')];
  say('  ── 목록 렌더 ──');
  ok('LOT 9건 표시', rows.length === 9, 'rows=' + rows.length);
  report(layoutAudit(doc, '목록'));

  /* 필터 동작 */
  const setF = v => { doc.querySelector('#fs').value = v;
    doc.querySelector('#fs').dispatchEvent(new win.Event('input', { bubbles: true })); };
  const n = () => doc.querySelectorAll('.lr-list .grid tbody tr').length;
  setF('외주 반출중'); const nOut = n();
  setF('사내 이동중');  const nIn  = n();
  setF('사내입고 완료'); const nDone = n();
  setF('사내입고 대기'); const nWait = n();
  setF('');
  say('  ── 상태 필터 ──');
  ok('외주 반출중 = M2·M5·O1 (3건)', nOut === 3, nOut);
  ok('사내 이동중 = M1·M3·M5·H1 (4건)', nIn === 4, nIn);
  ok('사내입고 완료 = H2 (1건)', nDone === 1, nDone);
  ok('사내입고 대기 = M4·O2 (2건)', nWait === 2, nWait);

  /* LOT별 상세 */
  for (const part of Object.keys(SCEN)) {
    const s = SCEN[part];
    say('\n  ── ' + part + ' | 경로 ' + s.rt + ' | ' + s.t + ' ──');
    const tr = rows.find(r => r.children[2].textContent.trim() === part);
    if (!tr) { ok(part + ' 행 존재', false); continue; }

    /* 미니 체인 */
    const mini = tr.querySelector('td.mini-chain').innerHTML;
    const route = FX.ROUTES.find(r => r.standard_process_no === s.rt);
    const wantIn = route.inhouse.length, wantOut = route.steps.length - wantIn;
    const gotIn = (mini.match(/cn k-in/g) || []).length;
    const gotOut = (mini.match(/cn k-out/g) || []).length;
    ok('체인 사내 ' + wantIn + ' · 외주 ' + wantOut + '단계', gotIn === wantIn && gotOut === wantOut,
       '사내=' + gotIn + ' 외주=' + gotOut);
    if (wantIn) ok('사내 이동 아이콘 📦', /📦/.test(mini));
    if (wantOut) ok('외주 이동 아이콘 🚚', /🚚/.test(mini));

    /* 모달 */
    tr.dispatchEvent(new win.Event('click', { bubbles: true }));
    await wait(60);

    const std = doc.querySelector('#iStd').textContent;
    ok('표준공정 매칭 = ' + route.standard_process_name, std === route.standard_process_name, std);
    const curTxt = doc.querySelector('#iCur').textContent;
    ok('현재 공정 = ' + s.cur, curTxt.startsWith(s.cur), curTxt.slice(0, 30));
    ok('현재 공정 구분 배지 = ' + s.kind, curTxt.includes(s.kind), curTxt.slice(0, 40));

    /* 흐름 다이어그램 */
    const fx = doc.querySelector('#iChain');
    const nodes = [...fx.querySelectorAll('.fx-node')];
    ok('노드 = 사내출발 + ' + route.steps.length + '공정 + 사내입고',
       nodes.length === route.steps.length + 2, nodes.length);
    const kd = nodes.slice(1, -1).map((x, i) =>
      (/kd-in/.test(x.className) ? '사내' : /kd-out/.test(x.className) ? '외주' : '?'));
    const want = route.steps.map(mp => kindOfStep(s.rt, mp));
    ok('노드 구분 배열 = [' + want.join(',') + ']', kd.join(',') === want.join(','), kd.join(','));
    const curNode = nodes.find(x => /st-cur/.test(x.className));
    ok('현재 위치 노드 강조', !!curNode, curNode && curNode.textContent.trim().slice(0, 18));

    /* 버튼 */
    const vis = id => doc.querySelector(id).style.display !== 'none';
    const closed = part === 'TLOT-H2';
    const allDone = ['TLOT-M4', 'TLOT-O2'].includes(part);
    ok('[🖨 이동표(QR)] 노출', vis('#mTag'));
    ok('[🏭 사내입고] ' + (allDone ? '노출' : '숨김'), vis('#mInh') === allDone,
       'display=' + doc.querySelector('#mInh').style.display);
    ok('[수정취소] 숨김(신규모드)', !vis('#mEC'));
    if (closed) ok('종결 LOT — 사내입고 버튼 숨김', !vis('#mInh'));

    /* 다음 공정 · 구분 자동선택 */
    const mp = doc.querySelector('#fMp').value, kd2 = doc.querySelector('#fKind').value;
    if (s.next) {
      ok('다음 공정 자동선택 = ' + s.next + ' (이동중 단계 건너뜀)', mp === s.next, mp || '(빈값)');
      const wantK = kindOfStep(s.rt, s.next);
      ok('이동 구분 자동 = ' + wantK, kd2 === wantK, kd2);
      const inh = kd2 === '사내';
      ok('이동처 입력 전환(' + (inh ? '사내=자유입력' : '외주=셀렉트') + ')',
         (doc.querySelector('#fSite').style.display !== 'none') === inh);
      ok('단가 ' + (inh ? '숨김' : '노출'),
         (doc.querySelector('#fQuote').style.display === 'none') === inh);
      ok('저장버튼 라벨', doc.querySelector('#mS').textContent.includes(inh ? '사내이동' : '반출'),
         doc.querySelector('#mS').textContent);
    } else {
      ok('전공정 완료 — 다음 공정 없음', mp === '', mp);
    }

    /* 외주처 목록에 현재 업체가 있는지 (마스터 정합) */
    const openOsp = FX.OSP.filter(o => o.part === part && !o.idate && o.move_kind === '외주');
    openOsp.forEach(o => {
      const has = [...doc.querySelectorAll('#fVen option')].some(x => x.value === o.vendor);
      if (!has) warn('외주처 목록에 「' + o.vendor + '」 없음 (협력사 마스터 불일치)');
    });

    /* 미입고 목록 */
    const openAll = FX.OSP.filter(o => o.part === part && !o.idate);
    const obRows = doc.querySelectorAll('#openBox tbody tr').length;
    ok('이동중 목록 ' + openAll.length + '건', obRows === openAll.length, obRows);

    /* 현장 기록 */
    await wait(40);
    const mvRows = doc.querySelectorAll('#mvFold tbody tr').length;
    const expMv = Math.min(FX.MOVES.filter(m => m.part === part).length, 8);
    ok('현장 기록 ' + expMv + '건 표시', mvRows === expMv, mvRows);

    report(layoutAudit(doc, '모달'));
  }

  /* CSV */
  say('\n  ── 엑셀다운로드 ──');
  const btn = [...doc.querySelectorAll('button')].find(b => b.textContent.trim() === '엑셀다운로드');
  ok('[엑셀다운로드] 버튼 존재', !!btn);
  let csvErr = null;
  try { btn.dispatchEvent(new win.Event('click', { bubbles: true })); }
  catch (e) { csvErr = e.message; }
  ok('CSV 생성 오류 없음', !csvErr, csvErr);
}

/* ══════════ 2. lot_tag.html — 공정이동표 ══════════ */
say('\n══════ [2] lot_tag.html · 공정이동표 발행 ══════');
for (const part of ['TLOT-M3', 'TLOT-M5', 'TLOT-H1', 'TLOT-H2', 'TLOT-O1']) {
  const s = SCEN[part];
  say('\n  ── ' + part + ' | ' + s.t + ' ──');
  const cap = capFor(part);
  const { win, doc } = boot('lot_tag.html', 'https://x.test/lot_tag.html?lot=' + part, cap, {
    qrcode: () => ({ addData() {}, make() {}, createImgTag: () => '<img alt="QR">' })
  });
  await wait(150);

  const route = FX.ROUTES.find(r => r.standard_process_no === s.rt);
  const sheet = doc.getElementById('sheet');
  const html = sheet.innerHTML;
  ok('LOT 번호 인쇄', html.includes(part));
  ok('표준공정명 인쇄', html.includes(route.standard_process_name));

  const stepChips = [...sheet.querySelectorAll('.rchain .rc')].filter(c => !/home/.test(c.className));
  ok('경로 칩 ' + route.steps.length + '개', stepChips.length === route.steps.length, stepChips.length);
  const chipK = stepChips.map(c => /\bin\b/.test(c.className) ? '사내' : '외주');
  const wantK = route.steps.map(mp => kindOfStep(s.rt, mp));
  ok('칩 구분 = [' + wantK.join(',') + ']', chipK.join(',') === wantK.join(','), chipK.join(','));

  const rowsIn = sheet.querySelectorAll('.mv tbody tr.r-in').length;
  const rowsOut = sheet.querySelectorAll('.mv tbody tr.r-out').length;
  const mv = FX.MOVES.filter(m => m.part === part && m.io !== '기록');
  const wIn = mv.filter(m => (m.move_kind === '사내')).length;
  const wOut = mv.length - wIn;
  ok('흐름표 사내행 ' + wIn + ' · 외주행 ' + wOut, rowsIn === wIn && rowsOut === wOut,
     '사내=' + rowsIn + ' 외주=' + rowsOut);

  const hasInStep = route.inhouse.length > 0;
  ok('사내 인수확인란 ' + (hasInStep ? '인쇄' : '미인쇄'), !!sheet.querySelector('.sig') === hasInStep);

  const contact = [...sheet.querySelectorAll('.foot')].map(x => x.textContent)
    .filter(t => /협력사 연락처/.test(t)).join('');
  const hasOutVendor = FX.OSP.some(o => o.part === part && o.move_kind === '외주');
  if (hasOutVendor) {
    const leaked = ['1공장 밀링실', '2공장 연삭실', '1공장 대형밀링'].filter(v => contact.includes(v));
    ok('사내 작업장은 협력사 연락처에서 제외', leaked.length === 0, leaked.join(','));
  } else {
    ok('사내전용 LOT — 협력사 연락처 없음', contact === '');
  }
  ok('QR 토큰 발행 RPC 호출', cap.rpc.some(r => r.p === 'rpc/ki_lot_token_issue'));

  const btn = [...doc.querySelectorAll('button')].map(b => b.textContent.trim());
  ok('[재발행]·[인쇄]·[닫기] 버튼', btn.some(x => /재발행/.test(x)) &&
     btn.some(x => /인쇄/.test(x)) && btn.some(x => /닫기/.test(x)), btn.join(' | '));

  report(layoutAudit(doc, '이동표'));
}

/* ══════════ 3. lot_scan.html — QR 입출고(현장) ══════════ */
say('\n══════ [3] lot_scan.html · QR 입출고(현장) ══════');
for (const part of ['TLOT-M3', 'TLOT-H1', 'TLOT-O1']) {
  const s = SCEN[part];
  say('\n  ── ' + part + ' | ' + s.t + ' ──');
  const cap = capFor(part);
  const { win, doc } = boot('lot_scan.html', 'https://x.test/lot_scan.html?lot=' + part, cap);
  await wait(150);

  const route = FX.ROUTES.find(r => r.standard_process_no === s.rt);
  const chain = doc.querySelector('.chain');
  const spans = chain ? [...chain.querySelectorAll('span')] : [];
  ok('체인 ' + route.steps.length + '단계', spans.length === route.steps.length, spans.length);
  const ck = spans.map(x => /k-in/.test(x.className) ? '사내' : '외주');
  const wk = route.steps.map(mp => kindOfStep(s.rt, mp));
  ok('체인 구분 = [' + wk.join(',') + ']', ck.join(',') === wk.join(','), ck.join(','));

  /* 탭 */
  const tabs = [...doc.querySelectorAll('.tab button')].map(b => b.textContent.trim());
  ok('탭 = 도착확인·출고·특기사항', tabs.length >= 3, tabs.join(' | '));

  /* 출고 구분 전환 */
  const nextMp = route.steps.find(x => !FX.PROG.find(p => p.part === part).steps.some(y => y.mp === x));
  doc.querySelector('#outMp').value = nextMp;
  doc.querySelector('#outMp').dispatchEvent(new win.Event('change', { bubbles: true }));
  await wait(20);
  const wantIn = kindOfStep(s.rt, nextMp) === '사내';
  ok('다음 공정 ' + nextMp + ' → ' + (wantIn ? '사내' : '외주') + ' 모드',
     (doc.querySelector('#outSiteRow').style.display !== 'none') === wantIn);
  ok('안내 박스 색상', /kbig( in)?$/.test(doc.querySelector('#outKind').className.trim()),
     doc.querySelector('#outKind').className);

  /* 도착확인 대상 */
  const openN = FX.OSP.filter(o => o.part === part && !o.idate).length;
  const inOpts = doc.querySelectorAll('#inNo option').length;
  ok('도착확인 대상 ' + openN + '건', inOpts === openN, inOpts);

  report(layoutAudit(doc, 'QR현장'));
}

/* ══════════ 4. lot_qr.html — 모바일 이동표 QR ══════════ */
say('\n══════ [4] lot_qr.html · 모바일 이동표 QR ══════');
function scanInfo(part) {
  const osp = FX.OSP.filter(o => o.part === part).sort((a, b) => a.no - b.no);
  const routeNo = (osp.slice().reverse().find(o => o.route_no) || {}).route_no;
  const rt = FX.ROUTES.find(r => String(r.standard_process_no) === String(routeNo));
  return {
    part, lot: FX.PROG.find(p => p.part === part),
    osp: osp.map(o => ({ no: o.no, job: o.job, mp: o.mp, vendor: o.vendor, sdate: o.sdate,
      idate: o.idate, edate: o.edate, qty: o.qty, map_part: o.map_part, mold_no: o.mold_no,
      route_no: o.route_no, move_kind: o.move_kind })),
    route: rt ? { standard_process_no: rt.standard_process_no,
      standard_process_name: rt.standard_process_name, steps: rt.steps, inhouse: rt.inhouse } : null,
    moves: FX.MOVES.filter(m => m.part === part)
      .sort((a, b) => String(b.move_date).localeCompare(String(a.move_date)) || b.move_id - a.move_id),
    receipt: FX.RECEIPT.find(r => r.part === part) || null,
    vendors: FX.VENDORS_KI,
    sites: [...new Set(FX.OSP.filter(o => o.move_kind === '사내').map(o => o.vendor))],
    procs: FX.PROCS.map(p => ({ c: p.process_code, n: p.process_name }))
  };
}
for (const [part, who] of [['TLOT-M5', '2공장 연삭실'], ['TLOT-H1', '1공장 대형밀링'],
                           ['TLOT-O1', '대성열처리']]) {
  const s = SCEN[part];
  say('\n  ── ' + part + ' | 스캔 주체: ' + who + ' | ' + s.t + ' ──');
  const calls = [];
  const html = fs.readFileSync('lot_qr.html', 'utf8');
  const clean = html.replace(/<script[^>]*\bsrc=[^>]*><\/script>/g, '');
  const dom = new JSDOM(clean, { url: 'https://x.test/lot_qr.html?t=TOK-' + part,
    runScripts: 'outside-only', pretendToBeVisual: true });
  const win = dom.window, doc = win.document;
  win.KI_CFG = { SUPABASE_URL: 'https://db.test', SUPABASE_KEY: 'k' };
  win.confirm = () => true;
  win.fetch = async (url, opt) => {
    const fn = url.split('/rpc/')[1], body = JSON.parse(opt.body);
    calls.push({ fn, body });
    if (fn === 'ki_scan_info') return { ok: true, text: async () => JSON.stringify(scanInfo(part)) };
    return { ok: true, text: async () => JSON.stringify({ ok: true, left: 0, kind: body.p_kind }) };
  };
  win.localStorage.setItem('ki_qr_vendor', who);
  win.localStorage.setItem('ki_qr_worker', '김반장');
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let mm; while ((mm = re.exec(clean))) win.eval(mm[1]);
  await wait(180);

  const route = FX.ROUTES.find(r => r.standard_process_no === s.rt);
  const stps = [...doc.querySelectorAll('.stp')];
  ok('공정 ' + route.steps.length + '단계 렌더', stps.length === route.steps.length, stps.length);
  const sk = stps.map(x => /k-in/.test(x.className) ? '사내' : '외주');
  const wk = route.steps.map(mp => kindOfStep(s.rt, mp));
  ok('단계 구분 = [' + wk.join(',') + ']', sk.join(',') === wk.join(','), sk.join(','));

  const hero = doc.querySelector('.hero');
  ok('히어로 상태 표시', !!hero, hero && hero.querySelector('.tt').textContent);

  const outTab = [...doc.querySelectorAll('.tab button')].find(b => b.dataset.t === 'out');
  ok('출고 탭 존재', !!outTab);
  if (outTab) {
    outTab.dispatchEvent(new win.Event('click', { bubbles: true }));
    await wait(40);
    const nextMp = route.steps.find(x => !FX.PROG.find(p => p.part === part).steps.some(y => y.mp === x));
    if (nextMp && doc.querySelector('#outMp')) {
      doc.querySelector('#outMp').value = nextMp;
      doc.querySelector('#outMp').dispatchEvent(new win.Event('change', { bubbles: true }));
      await wait(20);
      const wantIn = kindOfStep(s.rt, nextMp) === '사내';
      ok('다음 공정 ' + nextMp + ' → ' + (wantIn ? '사내' : '외주') + ' 모드',
         (doc.querySelector('#outSiteRow').style.display !== 'none') === wantIn);
      if (wantIn) {
        doc.querySelector('#outSite').value = '3공장 정삭실';
        doc.querySelector('#outQty').value = '10';
        doc.querySelector('#act').dispatchEvent(new win.Event('click', { bubbles: true }));
        await wait(60);
        const c = calls.filter(x => x.fn === 'ki_scan_out').pop();
        ok('출고 RPC p_kind=사내', c && c.body.p_kind === '사내', c && c.body.p_kind);
        ok('출고 RPC p_vendor=3공장 정삭실', c && c.body.p_vendor === '3공장 정삭실');
      }
    }
  }
  const hist = doc.querySelectorAll('.hist').length;
  ok('최근 기록 표시', hist > 0, hist + '건');
  report(layoutAudit(doc, '모바일QR'));
}

say('\n══════════════════════════════════════');
say('통과 ' + PASS + ' · 경고 ' + WARN + ' · 실패 ' + FAIL);
fs.writeFileSync('sim_result.txt', LOG.join('\n'), 'utf8');
process.exit(FAIL ? 1 : 0);
})();
