/* ============================================================
   점검기준 공용 화면 : KI_CHECK.init('설비'|'금형', 화면id)
============================================================ */
const KI_CHECK = (function(){
const T='ki_check_item';

/* 기본 항목 (캡쳐 기준) */
const DEFAULTS = {
  '설비':[
    ['오버로드 프로텍트 (정상범위)','압력계 정상범위 · 경고등 소등','PRESS-1','2,3'],
    ['발란스 실린더 (정상범위)','설정 압력 유지 · 누유 없음','',''],
    ['클러치 / 브레이크 (정상범위)','에어압 정상 · 제동거리 정상','',''],
    ['모터 (이상음)','이상음 · 이상진동 · 발열 없음','PRESS-4',''],
    ['클러치 (작동상태)','결합/해제 지연 없음','PRESS-5',''],
    ['안전장치 (센서, 양수조작버튼)','광전센서 · 양수조작 정상 동작','PRESS-6',''],
    ['오일러 급유 (적정량, 흐름상태)','유면 MIN 이상 · 적하 확인','PRESS-7',''],
    ['피치세팅 10회 체크','10회 연속 피치 편차 없음','PRESS-8',''],
    ['안전보호구 착용','크레인/사다리 사용 시 안전모 착용','','']
  ],
  '금형':[
    ['금형 외관 · 균열 확인','크랙 · 파손 · 변형 없음','MOLD-1','2'],
    ['펀치 / 다이 상태','치핑 · 마모 · 버 발생 없음','',''],
    ['스프링 · 리프터 파손','절손 · 처짐 없음','MOLD-3',''],
    ['가이드 포스트 급유','급유 상태 양호 · 소착 없음','MOLD-4',''],
    ['스크랩 배출 상태','스크랩 막힘 없음','MOLD-5',''],
    ['미스피드 / 센서 작동','센서 감지 및 정지 동작 정상','MOLD-6',''],
    ['체결 볼트 / 클램프','풀림 없음 · 규정 토크','','']
  ]
};
const CYCLES=['','일','주','월','분기','반기','연간'];

async function init(target, pageId){
  if(!await KI.guard(pageId))return;
  const $=KI.$, el=KI.el, esc=KI.esc;
  const cur=KI.chrome(pageId);
  let type='일상', ROWS=[], editId=null;

  const acts=[];
  if(KI.can(pageId,'save')) acts.push(['＋ 항목 등록','primary',()=>open(null)],
                                      ['기본항목 불러오기','',()=>loadDefaults()]);
  acts.push(['QR 라벨 출력','green',()=>printQr()],['새로고침','',()=>load()]);
  const ui=KI.page(cur,acts);
  const CAN_E=KI.can(pageId,'edit'), CAN_D=KI.can(pageId,'delete');

  /* 안내 */
  const nt=el('div','ck-note');
  nt.innerHTML='여기서 등록한 항목이 <b>일상점검 · 정기점검</b> 화면에 그대로 표시됩니다. '+
    '<b>QR코드</b>값을 넣으면 해당 항목은 QR 스캔 후에만 판정할 수 있고, <b>연동번호</b>를 넣으면 스캔 시 함께 열립니다.';
  ui.pg.appendChild(nt);

  /* 툴바 */
  const tb=el('div','ck-tb');
  tb.innerHTML='<button class="tab on" data-t="일상">📋 일상점검 항목</button>'+
               '<button class="tab" data-t="정기">🗓 정기점검 항목</button>'+
               '<span class="sp" id="ckCnt"></span>';
  ui.pg.appendChild(tb);
  tb.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{
    type=b.dataset.t;
    tb.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x===b));
    draw();
  }));

  /* 목록 */
  const gw=el('div','grid-wrap');
  const tbl=el('table','grid');
  tbl.innerHTML='<thead><tr>'+
    '<th style="width:56px">NO</th><th>점검항목 / 판정기준</th>'+
    '<th style="width:90px">주기</th><th style="width:170px">QR / 연동</th>'+
    '<th style="width:64px">사용</th><th style="width:130px"></th></tr></thead><tbody></tbody>';
  gw.appendChild(tbl); ui.pg.appendChild(gw);
  const tbody=tbl.querySelector('tbody');

  const ft=el('div'); ft.style.cssText='margin:0 7px 7px;color:#8b98a5;font-size:11px';
  ft.innerHTML='※ 점검기준은 서버(<b>'+T+'</b>)에 저장되어 모든 기기에서 동일하게 사용됩니다.';
  ui.pg.appendChild(ft);

  /* ---------- 모달 ---------- */
  const mask=el('div','mask');
  mask.innerHTML=
    '<div class="modal"><h3 id="mTitle">점검항목 등록<button class="x" id="mX">✕</button></h3><div class="bd">'+
      '<div class="mrow"><label>점검구분</label><select id="m_type"><option>일상</option><option>정기</option></select></div>'+
      '<div class="mrow"><label>점검항목 *</label><input id="m_item" maxlength="100" placeholder="예: 금형 외관 · 균열 확인"></div>'+
      '<div class="mrow"><label>판정기준</label><textarea id="m_cri" maxlength="200" placeholder="예: 크랙 · 파손 · 변형 없음"></textarea></div>'+
      '<div class="mrow"><label>주기</label><select id="m_cycle"></select></div>'+
      '<div class="mrow"><label>QR 코드</label><input id="m_qr" maxlength="40" placeholder="예: MOLD-1 (비우면 QR 없음)"></div>'+
      '<div class="mhint">값을 넣으면 QR 스캔 후에만 판정 가능</div>'+
      '<div class="mrow"><label>연동번호</label><input id="m_link" maxlength="40" placeholder="예: 2,3"></div>'+
      '<div class="mhint">스캔 시 함께 열릴 항목 NO (쉼표 구분)</div>'+
      '<div class="mrow"><label>표시순서</label><input id="m_sort" type="number"></div>'+
      '<div class="mrow"><label>사용</label><select id="m_use"><option value="true">사용</option><option value="false">미사용</option></select></div>'+
    '</div><div class="mfoot">'+
      '<button class="btn primary" id="mSave">저장</button>'+
      '<button class="btn" id="mCancel">취소</button>'+
      '<span class="msg" id="mMsg"></span></div></div>';
  document.body.appendChild(mask);
  CYCLES.forEach(c=>{ const o=el('option',null,c||'(없음)'); o.value=c; $('#m_cycle').appendChild(o); });
  $('#mX').addEventListener('click',close);
  $('#mCancel').addEventListener('click',close);
  mask.addEventListener('click',e=>{ if(e.target===mask) close(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&mask.classList.contains('on')) close(); });
  $('#mSave').addEventListener('click',save);

  function close(){ mask.classList.remove('on'); editId=null; }
  function open(r){
    editId = r ? r.check_id : null;
    $('#mTitle').childNodes[0].nodeValue = (r?'점검항목 수정':'점검항목 등록')+' — '+target;
    $('#m_type').value = r ? (r.check_type||'일상') : type;
    $('#m_item').value = r ? (r.item_name||'') : '';
    $('#m_cri').value  = r ? (r.criteria||'') : '';
    $('#m_cycle').value= r ? (r.cycle||'') : '';
    $('#m_qr').value   = r ? (r.qr_code||'') : '';
    $('#m_link').value = r ? (r.link_no||'') : '';
    $('#m_sort').value = r ? (r.sort_order??'') : nextSort();
    $('#m_use').value  = r ? String(r.is_active!==false) : 'true';
    $('#mMsg').textContent='';
    mask.classList.add('on'); setTimeout(()=>$('#m_item').focus(),50);
  }
  function nextSort(){
    const list=ROWS.filter(r=>r.check_type===type);
    return list.length ? Math.max(...list.map(r=>Number(r.sort_order)||0))+1 : 1;
  }
  async function save(){
    const m=$('#mMsg');
    const item=$('#m_item').value.trim();
    if(!item){ m.className='msg err'; m.textContent='점검항목을 입력하세요.'; return; }
    const body={ target:target, check_type:$('#m_type').value,
      item_name:item, criteria:$('#m_cri').value.trim()||null,
      cycle:$('#m_cycle').value||null, qr_code:$('#m_qr').value.trim()||null,
      link_no:$('#m_link').value.trim()||null,
      sort_order:Number($('#m_sort').value)||0, is_active:$('#m_use').value==='true' };
    m.className='msg'; m.textContent='저장중...';
    try{
      if(editId) await KI.upd(T,'check_id=eq.'+editId,body);
      else       await KI.ins(T,[body]);
      close(); await load();
      KI.msg('✓ '+(editId?'수정':'등록')+'되었습니다.');
    }catch(e){ m.className='msg err'; m.textContent='❌ '+e.message; }
  }
  async function remove(r){
    if(!confirm('[' + r.item_name + '] 항목을 삭제하시겠습니까?'))return;
    try{ await KI.del(T,'check_id=eq.'+r.check_id); await load(); KI.msg('✓ 삭제되었습니다.'); }
    catch(e){ alert('❌ '+e.message); }
  }
  async function loadDefaults(){
    const d=DEFAULTS[target]||[];
    const exist=new Set(ROWS.filter(r=>r.check_type==='일상').map(r=>r.item_name));
    const add=d.filter(x=>!exist.has(x[0]));
    if(!add.length) return alert('기본항목이 이미 모두 등록되어 있습니다.');
    if(!confirm('기본 점검항목 '+add.length+'건을 일상점검으로 추가합니다.\n계속할까요?'))return;
    let n=ROWS.filter(r=>r.check_type==='일상').length;
    try{
      await KI.ins(T, add.map((x,i)=>({target:target,check_type:'일상',item_name:x[0],criteria:x[1],
        qr_code:x[2]||null,link_no:x[3]||null,sort_order:n+i+1,is_active:true})));
      await load(); KI.msg('✓ 기본항목 '+add.length+'건이 추가되었습니다.');
    }catch(e){ alert('❌ '+e.message); }
  }

  /* ---------- QR 라벨 출력 ---------- */
  function printQr(){
    const list=ROWS.filter(r=>r.check_type===type && r.qr_code);
    if(!list.length) return alert('QR 코드가 등록된 항목이 없습니다.');
    const has = (typeof qrcode==='function');
    const cell=r=>{
      let img='';
      if(has){
        try{ const q=qrcode(0,'M'); q.addData(r.qr_code); q.make(); img=q.createImgTag(5,8); }
        catch(e){ img='<div class="nq">'+r.qr_code+'</div>'; }
      } else img='<div class="nq">QR 라이브러리 없음<br>'+r.qr_code+'</div>';
      return '<div class="lb">'+img+'<div class="cd">'+r.qr_code+'</div>'+
             '<div class="nm">'+String(r.item_name||'').replace(/</g,'&lt;')+'</div>'+
             '<div class="tg">'+target+' · '+r.check_type+'점검</div></div>';
    };
    const w=window.open('','_blank');
    w.document.write('<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">'+
      '<title>QR 라벨 - '+target+' '+type+'점검</title><style>'+
      'body{font-family:"Malgun Gothic",Arial;margin:12px}'+
      'h2{font-size:15px;margin:0 0 10px;color:#22537f}'+
      '.wrap{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px}'+
      '.lb{border:1px solid #333;padding:8px;text-align:center;page-break-inside:avoid}'+
      '.lb img{width:110px;height:110px;image-rendering:pixelated}'+
      '.cd{font-weight:800;font-size:13px;margin-top:5px;letter-spacing:.5px}'+
      '.nm{font-size:11px;color:#333;margin-top:3px;line-height:1.4}'+
      '.tg{font-size:10px;color:#888;margin-top:3px}'+
      '.nq{width:110px;height:110px;display:flex;align-items:center;justify-content:center;'+
      'border:1px dashed #aaa;color:#888;font-size:11px;margin:0 auto}'+
      '@media print{.no{display:none}}</style></head><body>'+
      '<h2>'+target+' '+type+'점검 QR 라벨 ('+list.length+'건)</h2>'+
      '<button class="no" onclick="window.print()" style="margin-bottom:10px;padding:6px 14px">🖨 인쇄</button>'+
      '<div class="wrap">'+list.map(cell).join('')+'</div></body></html>');
    w.document.close();
  }

  /* ---------- 렌더 ---------- */
  function draw(){
    const list=ROWS.filter(r=>r.check_type===type)
                   .sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0));
    tbody.innerHTML='';
    if(!list.length){
      const t=el('tr'), d=el('td','center','등록된 '+type+'점검 항목이 없습니다. [기본항목 불러오기] 또는 [＋ 항목 등록]');
      d.colSpan=6; d.style.cssText='color:#8894a0;height:56px'; t.appendChild(d); tbody.appendChild(t);
    }
    list.forEach((r,i)=>{
      const t=el('tr');
      const qr = r.qr_code
        ? '<span class="badge b-run">'+esc(r.qr_code)+'</span>'
        : '<span class="badge" style="background:#eef1f4;color:#8b98a5;border-color:#d6dde4">QR 없음</span>';
      const lk = r.link_no ? ' <span class="badge" style="background:#f4ecfa;color:#7b3fa0;border-color:#ddc9ec">↔ '+esc(r.link_no)+'</span>' : '';
      t.innerHTML='<td class="center">'+(i+1)+'</td>'+
        '<td style="white-space:normal"><span class="ck-item">'+esc(r.item_name)+'</span>'+
          '<span class="ck-cri">'+esc(r.criteria||'')+'</span></td>'+
        '<td class="center">'+esc(r.cycle||'-')+'</td>'+
        '<td class="center">'+qr+lk+'</td>'+
        '<td class="center">'+(r.is_active===false?'<span style="color:#a7b3bf">미사용</span>':'<span class="badge b-done">✓</span>')+'</td>';
      const td=el('td','center');
      if(CAN_E){ const e=el('button','mini-btn2','수정'); e.addEventListener('click',ev=>{ev.stopPropagation();open(r);}); td.appendChild(e); }
      if(CAN_D){ const d=el('button','mini-btn2 del','삭제'); d.addEventListener('click',ev=>{ev.stopPropagation();remove(r);}); td.appendChild(d); }
      t.appendChild(td);
      if(CAN_E) t.addEventListener('dblclick',()=>open(r));
      tbody.appendChild(t);
    });
    $('#ckCnt').textContent = list.length+'항목 · '+target+' '+type+'점검';
    KI.msg(target+' '+type+'점검 기준 '+list.length+'건');
  }
  async function load(){
    try{
      ROWS=await KI.get(T+'?select=*&target=eq.'+encodeURIComponent(target)+'&order=sort_order.asc');
      draw();
    }catch(e){
      tbody.innerHTML='<tr><td colspan="6" class="center" style="color:#b0442f;height:50px">❌ '+esc(e.message)+'</td></tr>';
    }
  }
  load();
}
return {init:init};
})();
