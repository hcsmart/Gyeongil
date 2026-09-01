/* ============================================================
   ki_demo.js — 등록예제 안내 재생 엔진 (공용 · 화면 무관)
   · 값만 채우고 저장은 하지 않는다. 저장은 사용자가 직접 누른다.
   · 단계 종류 : fill(입력) / click(클릭) / check(체크) / say(설명만)
   · 화면 배선 : <script src="ki_demo.js"><script src="ki_demo_data.js">
                 KIDemo.attach('화면id');
============================================================ */
var KIDemo = (function(){
'use strict';
const D = document;
const q = (s,r)=>(r||D).querySelector(s);
const qa= (s,r)=>[].slice.call((r||D).querySelectorAll(s));
const SPEEDS = {'느리게':1.7,'보통':1.0,'빠르게':0.55};
let S = null;                      /* 재생 세션 (없으면 정지 상태) */

/* ---------- 스타일 (원본 CSS 를 건드리지 않고 주입) ---------- */
const CSS = ''+
'.kd-hl{outline:3px solid #f08c26!important;outline-offset:2px;'+
'  box-shadow:0 0 0 4px rgba(240,140,38,.18)!important}'+
'.kd-bub{position:fixed;z-index:99999;max-width:330px;background:#22537f;color:#fff;'+
'  padding:9px 12px;border-radius:8px;font-size:12.5px;line-height:1.62;'+
'  box-shadow:0 8px 22px rgba(0,0,0,.28);pointer-events:none}'+
'.kd-bub b{display:block;font-size:13px;margin-bottom:3px;color:#ffd9a8}'+
'.kd-bar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:100000;'+
'  display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:6px;'+
'  padding:8px 10px;max-width:96vw;background:#1f2c3a;border-radius:10px;'+
'  box-shadow:0 8px 22px rgba(0,0,0,.35)}'+
'.kd-bar button,.kd-bar select{height:28px;border:0;border-radius:5px;background:#33475c;'+
'  color:#fff;font-size:12px;font-weight:700;padding:0 10px;cursor:pointer}'+
'.kd-bar button:hover{background:#48627e}'+
'.kd-bar .kd-stop{background:#a63b2f}'+
'.kd-bar .kd-pg{color:#cfe0f0;font-size:12px;font-weight:700;padding:0 8px;line-height:28px}'+
'.kd-bar .kd-tt{color:#8fb6dc;font-size:11.5px;padding:0 6px;line-height:28px}'+
'.kd-btn{background:#f5efe3;border-color:#d9c39a;color:#8a5a12;font-weight:700}'+
'@media(max-width:820px){.kd-bar{left:6px;right:6px;transform:none;max-width:none}'+
' .kd-bub{max-width:74vw;font-size:12px}}';
function injectCss(){
  if(q('#kdCss')) return;
  const st=D.createElement('style'); st.id='kdCss'; st.textContent=CSS; D.head.appendChild(st);
}

/* ============================================================
   대본 작성용 도우미 (예시데이터 모듈에서 사용)
============================================================ */
/* 오늘 기준 상대일 (rule 4) */
function day(n){
  const d=new Date(); d.setDate(d.getDate()+(n||0));
  return d.toISOString().slice(0,10);
}
/* 키 끝자리 자동 증가 : 001→002 / B→C (rule 5) */
function bump(v){
  v=String(v==null?'':v);
  let m=v.match(/^(.*?)(\d+)$/);
  if(m){ const n=String(Number(m[2])+1); return m[1]+(n.length<m[2].length?m[2].slice(0,m[2].length-n.length)+n:n); }
  m=v.match(/^(.*?)([A-Za-z])$/);
  if(m){ const c=m[2]; return m[1]+(c==='Z'?'A':c==='z'?'a':String.fromCharCode(c.charCodeAt(0)+1)); }
  return v+'-2';
}
/* 이미 쓰인 값이면 안 겹칠 때까지 끝자리를 올린다 */
function uniq(base, used){
  const set=new Set((used||[]).map(x=>String(x==null?'':x).trim()));
  let v=String(base);
  for(let i=0;i<200 && set.has(v);i++) v=bump(v);
  return v;
}
/* 목록 그리드의 n번째 열 값 모으기 (중복키 회피용) */
function colValues(idx, sel){
  return qa((sel||'.grid')+' tbody tr').map(tr=>{
    const td=tr.children[idx-1]; return td?td.textContent.trim():'';
  }).filter(Boolean);
}
/* 데이터 키로 열 값 모으기 — 순서변경(⇅) 열이 앞에 붙어도 어긋나지 않는다.
   ki_core 가 제목행에 th.dataset.sk = 필드명 을 넣어두므로 그 위치를 찾아 읽는다. */
function colKey(key, sel){
  const tbl=q(sel||'.grid'); if(!tbl) return [];
  const ths=qa('thead th', tbl);
  const i=ths.findIndex(th=>th.dataset && th.dataset.sk===key);
  if(i<0) return [];
  return qa('tbody tr', tbl).map(tr=>{
    if(tr.children.length<=1) return '';                /* 안내문 행 제외 */
    const td=tr.children[i]; return td?td.textContent.trim():'';
  }).filter(Boolean);
}
/* 숫자열의 다음 번호 (비어 있으면 base) */
function nextNo(key, base, sel){
  const ns=colKey(key,sel).map(v=>Number(String(v).replace(/[^0-9.-]/g,''))).filter(n=>!isNaN(n));
  return ns.length ? Math.max.apply(null,ns)+1 : (base||1);
}
/* 목록의 첫 데이터 행 (조회결과 없음 안내행은 제외) */
function dataRow(sel){
  const t=q((sel||'.grid')+' tbody tr');
  return (t && t.children.length>1) ? t : null;
}
/* select 의 첫 유효 option 값 (rule 6) */
function firstOpt(sel, skipRe){
  const s=(typeof sel==='string')?q(sel):sel;
  if(!s) return '';
  const o=qa('option',s).find(x=>x.value && x.value!=='전체' && !(skipRe&&skipRe.test(x.value)));
  return o?o.value:'';
}
/* 화면 실행버튼 찾기 (상단바 · 폼바 공통) */
function actBtn(label){
  return qa('#kiAct button, .pg-act button, .form-bar button, .lr-mf button, .mfoot button')
    .find(b=>b.textContent.trim().indexOf(label)>=0) || null;
}
/* 라벨 자동 인식 (없으면 대본의 label 사용 — 표 헤더형 대응) */
function autoLabel(el){
  if(!el) return '';
  if(el.id){ const l=q('label[for="'+el.id+'"]'); if(l) return l.textContent.trim(); }
  const row=el.closest('.mrow,.form-fd,.kd-row');
  if(row){
    const lb=row.previousElementSibling;
    if(row.classList.contains('mrow')){ const l=q('label',row); if(l) return l.textContent.replace('*','').trim(); }
    if(lb && (lb.classList.contains('form-lb')||lb.tagName==='LABEL')) return lb.textContent.replace('*','').trim();
  }
  let p=el.previousElementSibling;
  while(p){ if(p.tagName==='LABEL') return p.textContent.replace('*','').trim(); p=p.previousElementSibling; }
  return el.getAttribute('placeholder')||'';
}

/* ============================================================
   내부 : 요소 대기 · 강조 · 말풍선
============================================================ */
function elOf(step){
  const t=step.el;
  if(!t) return null;
  if(typeof t==='function'){ try{ return t(); }catch(e){ return null; } }
  return q(t);
}
/* 숨겨진 대상(콤보 안의 select 등)은 눈에 보이는 상위 요소로 강조 · 말풍선을 잡는다 */
function visOf(e){
  let n=e;
  while(n && n.nodeType===1){
    if(n===D.body || n.offsetParent!==null) return n;
    n=n.parentElement;
  }
  return null;
}
function waitEl(step, ms){
  const lim=Date.now()+(ms||2500);
  return new Promise(res=>{
    (function tick(){
      const e=elOf(step);
      if(e && visOf(e)) return res(e);
      if(Date.now()>lim) return res(e||null);
      setTimeout(tick,80);
    })();
  });
}
function clearHl(){ qa('.kd-hl').forEach(e=>e.classList.remove('kd-hl')); }
function bubble(el, title, tip){
  let b=q('#kdBub');
  if(!b){ b=D.createElement('div'); b.className='kd-bub'; b.id='kdBub'; D.body.appendChild(b); }
  b.innerHTML='<b>'+(title||'')+'</b>'+(tip||'');
  b.style.visibility='hidden'; b.style.display='';
  const r=el?el.getBoundingClientRect():{top:80,bottom:80,left:innerWidth/2,right:innerWidth/2,width:0};
  const bw=b.offsetWidth, bh=b.offsetHeight;
  let top=r.bottom+10, left=r.left;
  if(top+bh>innerHeight-90) top=Math.max(8, r.top-bh-10);
  left=Math.min(Math.max(8,left), innerWidth-bw-8);
  b.style.top=top+'px'; b.style.left=left+'px'; b.style.visibility='';
}
function hideBub(){ const b=q('#kdBub'); if(b) b.remove(); }

/* ============================================================
   내부 : 값 채우기 (타이핑 · 이벤트)
============================================================ */
function fire(el, types){
  (types||['input','change']).forEach(t=>el.dispatchEvent(new Event(t,{bubbles:true})));
}
const INSTANT=/^(date|datetime-local|month|time|number|color)$/;
function setNow(el, v){
  if(el.tagName==='SELECT'){ el.value=v; fire(el,['change']); return; }
  el.value=v; fire(el);
}
/* 타이핑 애니메이션 : 중간에 [다음]/[한번에] 를 눌러도 값이 잘리지 않도록 pending 보관 */
function type(el, v, ms){
  commit();
  if(el.tagName==='SELECT' || INSTANT.test(el.type||'')){ setNow(el,v); return Promise.resolve(); }
  if(!ms){ setNow(el,v); return Promise.resolve(); }
  S.pending={el:el, full:v};
  el.value='';
  return new Promise(res=>{
    let i=0;
    (function tick(){
      if(!S || !S.pending || S.pending.el!==el){ return res(); }
      if(S.paused){ S.pendTimer=setTimeout(tick,120); return; }
      el.value=v.slice(0,++i); fire(el,['input']);
      if(i>=v.length){ S.pending=null; fire(el,['change']); return res(); }
      S.pendTimer=setTimeout(tick,ms);
    })();
  });
}
/* 지나간 칸의 값 확정 (단계 이동 · 종료 시) */
function commit(){
  if(!S||!S.pending) return;
  const p=S.pending; S.pending=null;
  clearTimeout(S.pendTimer);
  p.el.value=p.full; fire(p.el);
}

/* ============================================================
   조작바
============================================================ */
function bar(){
  let b=q('#kdBar'); if(b) return b;
  b=D.createElement('div'); b.className='kd-bar'; b.id='kdBar';
  b.innerHTML=
    '<button data-a="prev">◀️ 이전</button>'+
    '<button data-a="next">▶️ 다음</button>'+
    '<button data-a="pause">⏸️ 일시정지</button>'+
    '<select data-a="speed"><option>느리게</option><option selected>보통</option><option>빠르게</option></select>'+
    '<button data-a="all">⚡️ 한번에</button>'+
    '<button class="kd-stop" data-a="stop">⏹️ 중지</button>'+
    '<span class="kd-pg" id="kdPg">0 / 0</span>'+
    '<span class="kd-tt">ESC 중지</span>';
  D.body.appendChild(b);
  b.addEventListener('click',e=>{
    const t=e.target.closest('[data-a]'); if(!t) return;
    const a=t.dataset.a;
    if(a==='prev'){ commit(); go(S.i-1); }
    else if(a==='next'){ commit(); go(S.i+1); }
    else if(a==='pause'){ S.paused=!S.paused; t.textContent=S.paused?'▶️ 재생':'⏸️ 일시정지';
      if(!S.paused) go(S.i); }
    else if(a==='all'){ commit(); S.rush=true; S.paused=false; go(S.i+1); }
    else if(a==='stop'){ stop(); }
  });
  b.querySelector('[data-a="speed"]').addEventListener('change',e=>{
    S.rush=false; S.speed=SPEEDS[e.target.value]||1; });
  return b;
}
function progress(){
  const p=q('#kdPg'); if(p) p.textContent=(S.i+1)+' / '+S.steps.length;
}

/* ============================================================
   재생 제어
============================================================ */
function stop(){
  if(!S) return;
  commit(); clearTimeout(S.timer); clearTimeout(S.pendTimer);
  clearHl(); hideBub();
  const b=q('#kdBar'); if(b) b.remove();
  if(S.btn){ S.btn.textContent=S.btnLabel; S.btn.classList.remove('kd-on'); }
  D.removeEventListener('keydown',S.esc,true);
  const done=S.i>=S.steps.length-1;
  S=null;
  if(window.KI&&KI.msg) KI.msg(done?'✅ 등록예제 안내를 마쳤습니다. 내용을 확인한 뒤 [저장]을 누르세요.'
                                  :'⏹️ 등록예제 안내를 중지했습니다.');
}
function delay(step){
  if(S.rush) return 140;
  const base = step.t==='say' ? 1500 : 1100;
  const extra= Math.min(1800, String(step.tip||'').length*26);
  return Math.round((base+extra)*S.speed);
}
async function go(i){
  if(!S) return;
  clearTimeout(S.timer);
  if(i<0) i=0;
  if(i>=S.steps.length){ S.i=S.steps.length-1; stop(); return; }
  S.i=i; progress();
  const step=S.steps[i];
  const el = await waitEl(step, step.wait||2200);
  if(!S) return;
  if(!el && step.el){                       /* 없는 요소는 건너뛰고 알림 (rule 6) */
    if(window.KI&&KI.msg) KI.msg('· 안내 건너뜀 : '+(step.label||'대상 없음'));
    return next(step);
  }
  clearHl();
  const vt = el ? (visOf(el)||el) : null;
  if(vt){ vt.classList.add('kd-hl');
    try{ vt.scrollIntoView({block:'center',behavior:S.rush?'auto':'smooth'}); }catch(e){} }
  bubble(vt, step.label||autoLabel(el)||'안내', step.tip||'');
  try{
    if(step.t==='fill' && el){
      let v=(typeof step.value==='function')?step.value():step.value;
      v=String(v==null?'':v);
      if(el.tagName==='SELECT' && v===''){   /* 목록이 비었으면 건너뛰고 알림 (rule 6) */
        if(window.KI&&KI.msg) KI.msg('· 안내 건너뜀 : '+(step.label||'')+' — 선택할 항목이 없습니다.');
      }else await type(el, v, S.rush?0:Math.round(26*S.speed));
    }
    else if(step.t==='click' && el){ if(step.safe!==false) el.click(); }
    else if(step.t==='check' && el){ el.checked=(step.value!==false); fire(el,['change','click']); }
  }catch(e){}
  if(!S) return;
  next(step);
}
function next(step){
  if(!S) return;
  if(S.paused) return;
  S.timer=setTimeout(()=>{ if(S) go(S.i+1); }, delay(step));
}

/* ============================================================
   공개 API
============================================================ */
function run(steps, opts){
  if(S){ stop(); return; }                  /* 같은 버튼 재클릭 = 중지 */
  steps=(steps||[]).filter(Boolean);
  if(!steps.length){ if(window.KI&&KI.msg) KI.msg('❗ 이 화면의 안내 대본이 없습니다.'); return; }
  injectCss();
  S={steps:steps,i:-1,speed:1,rush:false,paused:false,timer:null,pending:null,pendTimer:null,
     btn:(opts&&opts.btn)||null, btnLabel:(opts&&opts.btn)?opts.btn.textContent:''};
  S.esc=e=>{ if(e.key==='Escape'){ e.preventDefault(); stop(); } };
  D.addEventListener('keydown',S.esc,true);
  bar();
  if(S.btn){ S.btn.textContent='⏹️ 안내 중지'; S.btn.classList.add('kd-on'); }
  go(0);
}

/* 화면 배선용 : 상단 실행버튼 옆에 [🎬 등록예제 안내] 버튼 1개를 붙인다 */
function attach(screenId, ctx){
  injectCss();
  let n=0;
  (function tick(){
    const act=q('#kiAct')||q('.pg-act');
    if(!act || !act.querySelector('button')){
      if(n++<80) return setTimeout(tick,150);
      return;
    }
    if(q('#kdPlay')) return;
    const b=D.createElement('button');
    b.className='btn kd-btn'; b.id='kdPlay'; b.type='button';
    b.textContent='🎬 등록예제 안내';
    b.title='입력 예시를 한 칸씩 채우며 등록 요점을 설명합니다 (저장은 하지 않습니다)';
    b.addEventListener('click',()=>{
      const mk=(window.KIDEMO||{})[screenId];
      if(!mk){ if(window.KI&&KI.msg) KI.msg('❗ 이 화면의 안내 대본이 없습니다.'); return; }
      let steps=[];
      try{ steps=mk(ctx||{})||[]; }
      catch(e){ if(window.KI&&KI.msg) KI.msg('❗ 안내 대본 오류 : '+e.message); return; }
      run(steps,{btn:b});
    });
    act.appendChild(b);
  })();
}

return {attach:attach, run:run, stop:stop,
        day:day, bump:bump, uniq:uniq, colValues:colValues, colKey:colKey,
        nextNo:nextNo, dataRow:dataRow,
        firstOpt:firstOpt, actBtn:actBtn, q:q, qa:qa};
})();
