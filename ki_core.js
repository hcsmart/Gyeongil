/* ============================================================
   GI MES 공통 코어 : 인증 · 헤더 · Supabase · 그리드 엔진
============================================================ */
const KI = (function(){
const C = KI_CFG;
const LK = {sess:'ki_sess', fail:'ki_login_fail', left:'ki_left_w'};

const $  = (s,r)=>(r||document).querySelector(s);
const el = (t,c,x)=>{const e=document.createElement(t); if(c)e.className=c; if(x!=null)e.textContent=x; return e;};
const esc= s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ============================================================
   인증 : Supabase Auth (아이디 + 비밀번호)
   · 공개키(anon)만으로는 DB 접근 불가 — RLS 에서 차단
   · 로그인 후 발급된 access_token 으로만 조회/등록 가능
============================================================ */
let SESS=null, ME=null, PERM={};

function loadSess(){ try{ SESS=JSON.parse(localStorage.getItem(LK.sess)||'null'); }catch(e){ SESS=null; } return SESS; }
function saveSess(o){ SESS=o; if(o) localStorage.setItem(LK.sess,JSON.stringify(o)); else localStorage.removeItem(LK.sess); }
function token(){ return SESS && SESS.access_token; }
function HDR(){ return {apikey:C.SUPABASE_KEY, Authorization:'Bearer '+(token()||C.SUPABASE_KEY)}; }
const emailOf = id => String(id||'').includes('@') ? String(id).trim().toLowerCase()
                                                  : String(id||'').trim().toLowerCase()+'@'+C.AUTH_DOMAIN;

async function signIn(userId,password){
  const r=await fetch(C.SUPABASE_URL+'/auth/v1/token?grant_type=password',{
    method:'POST',headers:{apikey:C.SUPABASE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({email:emailOf(userId),password:password})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){
    if(r.status===400) throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
    if(r.status===422) throw new Error('입력값을 확인하세요. ('+(d.msg||d.error_description||'')+')');
    if(r.status>=500)  throw new Error('인증 서버 오류입니다. 관리자에게 문의하세요. ('+(d.error_code||r.status)+')');
    throw new Error(d.error_description||d.msg||d.error||'로그인 실패 ('+r.status+')');
  }
  saveSess({access_token:d.access_token,refresh_token:d.refresh_token,
            exp:Date.now()+(d.expires_in||3600)*1000,uid:d.user&&d.user.id,email:d.user&&d.user.email});
  await loadMe();
  if(!ME){ const msg2=LOGIN_ERR||'등록되지 않았거나 사용 중지된 사원입니다. 관리자에게 문의하세요.';
           await signOut(); throw new Error(msg2); }
  return ME;
}
async function refresh(){
  if(!SESS||!SESS.refresh_token) return false;
  const r=await fetch(C.SUPABASE_URL+'/auth/v1/token?grant_type=refresh_token',{
    method:'POST',headers:{apikey:C.SUPABASE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({refresh_token:SESS.refresh_token})});
  if(!r.ok){ saveSess(null); return false; }
  const d=await r.json();
  saveSess({access_token:d.access_token,refresh_token:d.refresh_token,
            exp:Date.now()+(d.expires_in||3600)*1000,uid:SESS.uid,email:SESS.email});
  return true;
}
async function signOut(){
  cacheClear();
  try{ await fetch(C.SUPABASE_URL+'/auth/v1/logout',{method:'POST',headers:HDR()}); }catch(e){}
  saveSess(null); ME=null; PERM={};
}
function logout(){ signOut().then(()=>{ location.href='index.html'; }); }

async function changePassword(newPw){
  const r=await fetch(C.SUPABASE_URL+'/auth/v1/user',{method:'PUT',
    headers:Object.assign({'Content-Type':'application/json'},HDR()),
    body:JSON.stringify({password:newPw})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.msg||d.error_description||d.message||'변경 실패');
  return true;
}
async function adminFn(payload){
  const r=await fetch(C.SUPABASE_URL+'/functions/v1/'+C.ADMIN_FN,{method:'POST',
    headers:Object.assign({'Content-Type':'application/json'},HDR()),
    body:JSON.stringify(payload)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||d.error) throw new Error(d.error||('요청 실패 ('+r.status+')'));
  return d;
}

let LOGIN_ERR='';
const PK='ki_me_cache', PTTL=10*60*1000;      /* 10분 캐시 */
function cacheGet(){
  try{ const c=JSON.parse(sessionStorage.getItem(PK)||'null');
    if(c && SESS && c.uid===SESS.uid && Date.now()-c.ts < PTTL) return c;
  }catch(e){}
  return null;
}
function cacheSet(){
  try{ sessionStorage.setItem(PK,JSON.stringify({uid:SESS.uid,me:ME,perm:PERM,ts:Date.now()})); }catch(e){}
}
function cacheClear(){ try{ sessionStorage.removeItem(PK); }catch(e){} }

/* 캐시가 있으면 네트워크 없이 즉시 복원 (화면 전환 체감 속도) */
function loadMeCached(){
  const c=cacheGet(); if(!c) return null;
  ME=c.me; PERM=c.perm||{};
  return ME;
}
async function loadMe(){
  LOGIN_ERR='';
  /* 1) 사원 조회 — 실패 시 원인을 남긴다 */
  try{
    const rows=await get(OBJ.employee+'?select=*&auth_uid=eq.'+SESS.uid+'&limit=1');
    ME=rows[0]||null;
  }catch(e){
    ME=null; LOGIN_ERR='사원정보 조회 실패 — '+e.message;
    return null;
  }
  if(!ME){ LOGIN_ERR='이 계정에 연결된 사원이 없습니다. [시스템 › 사용자정보]에서 계정을 연결하세요.'; return null; }
  if(ME.is_active===false){ ME=null; LOGIN_ERR='사용 중지된 사원입니다.'; return null; }
  /* 2) 권한 조회 — 실패해도 로그인은 유지(관리자는 전 권한, 사용자는 조회 불가 화면만 숨김) */
  PERM={};
  try{
    const ps=await get(OBJ.permission+'?select=menu_id,can_view,can_save,can_edit,can_delete&emp_no=eq.'+
                       encodeURIComponent(ME.emp_no));
    ps.forEach(p=>PERM[p.menu_id]={v:p.can_view,s:p.can_save,e:p.can_edit,d:p.can_delete});
  }catch(e){ console.warn('권한 조회 실패:',e.message); }
  cacheSet();
  return ME;
}
const loginError = ()=>LOGIN_ERR;
const isAdmin = ()=>!!(ME&&ME.role==='관리자');
function can(menuId,act){
  if(isAdmin()) return true;
  const p=PERM[menuId]; if(!p) return false;
  return act==='save'?!!p.s : act==='edit'?!!p.e : act==='delete'?!!p.d : !!p.v;
}
function session(){ return ME?{role:isAdmin()?'admin':'user',name:ME.emp_name,emp_no:ME.emp_no,
                               exp:(SESS&&SESS.exp)||0}:null; }
function toLogin(){
  const f=location.pathname.split('/').pop();
  location.href='index.html'+(f&&f!=='index.html'?'?r='+encodeURIComponent(f):'');
}
async function guard(menuId){
  loadSess();
  if(!SESS){ toLogin(); return false; }
  if(SESS.exp&&SESS.exp<Date.now()+60000){ if(!await refresh()){ toLogin(); return false; } }
  if(!ME) loadMeCached();                 /* ① 캐시로 즉시 진행 */
  if(!ME) await loadMe();                 /* ② 캐시 없을 때만 조회 */
  else setTimeout(()=>{ loadMe().catch(()=>{}); },0);   /* ③ 백그라운드 갱신 */
  if(!ME){ await signOut(); toLogin(); return false; }
  if(mobileLanding()) return false;       /* 폰 전용 첫 화면이 지정된 경우만 */
  if(menuId&&!can(menuId,'view')){
    alert('이 화면에 대한 조회 권한이 없습니다.\n관리자에게 문의하세요.');
    location.href=C.LANDING; return false;
  }
  return true;
}

/* ---------- Supabase REST ---------- */
async function get(path){
  let r=await fetch(C.SUPABASE_URL+'/rest/v1/'+path,{headers:HDR()});
  if(r.status===401&&await refresh()) r=await fetch(C.SUPABASE_URL+'/rest/v1/'+path,{headers:HDR()});
  if(r.status===401||r.status===403) throw new Error('접근 권한이 없습니다. 관리자에게 권한을 요청하세요.');
  if(!r.ok) throw new Error('조회 실패 ('+r.status+')');
  return await r.json();
}
async function send(method,path,body,prefer){
  const build=()=>({method:method,headers:Object.assign({'Content-Type':'application/json',
      Prefer:prefer||'return=representation'},HDR()),
      body:body===undefined?undefined:JSON.stringify(body)});
  let r=await fetch(C.SUPABASE_URL+'/rest/v1/'+path,build());
  if(r.status===401&&await refresh()) r=await fetch(C.SUPABASE_URL+'/rest/v1/'+path,build());
  if(r.status===401||r.status===403) throw new Error('권한이 없습니다. (관리자에게 권한 요청)');
  if(!r.ok) throw new Error('처리 실패 ('+r.status+') '+(await r.text()).slice(0,120));
  return method==='DELETE'?true:await r.json().catch(()=>true);
}
const ins    = (t,b)=>send('POST',t,b);
const upd    = (t,f,b)=>send('PATCH',t+'?'+f,b);
const del    = (t,f)=>send('DELETE',t+'?'+f,undefined,'return=minimal');
const upsert = (t,b)=>send('POST',t,b,'resolution=merge-duplicates,return=representation');

/* ---------- 화면 크롬 (1차 모듈 / 2차 아이콘 / 좌측 트리 / 상태바) ---------- */
const LK_LEFT='ki_left_w';

/* ---------- 모바일 판정 ---------- */
function isPhone(){
  return Math.min(screen.width||9999, window.innerWidth||9999) <= 820
      && /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent||'');
}
/* 폰 전용 첫 화면(MOBILE_LANDING)이 지정된 경우에만 전환.
   비워두면 PC·모바일 모두 LANDING(빈 홈)을 그대로 사용한다. */
function mobileLanding(){
  const f=C.MOBILE_LANDING;
  if(!f || !isPhone()) return false;
  if(/^kiPop_/.test(window.name||'')) return false;
  const here=(location.pathname.split('/').pop()||'').toLowerCase();
  const tgt=String(f).split('?')[0].toLowerCase();
  if(here===tgt) return false;
  const land=String(C.LANDING||'').split('?')[0].toLowerCase();
  if(here!==land) return false;
  const id=Object.keys(FLAT).find(k=>String(FLAT[k].it.f).split('?')[0].toLowerCase()===tgt);
  if(id && !can(id,'view')) return false;
  location.replace(f);
  return true;
}

/* 팝업 전용 화면 (메뉴 정의의 pop:1) — 보안상 본 화면과 분리된 별도 창으로 실행 */
function isPop(id){ return !!(FLAT[id] && FLAT[id].it && FLAT[id].it.pop); }
function openPop(file,name){
  const w=Math.min(screen.availWidth||480,480), h=Math.min(screen.availHeight||900,900);
  const x=Math.max(((screen.availWidth||w)-w)/2,0), y=Math.max(((screen.availHeight||h)-h)/2,0);
  const win=window.open(file,'kiPop_'+(name||'qr'),
    'width='+w+',height='+h+',left='+Math.round(x)+',top='+Math.round(y)+
    ',menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes');
  if(win) { try{ win.opener=null; win.focus(); }catch(e){} }
  else alert('팝업이 차단되었습니다.\n브라우저 주소창의 팝업 차단을 해제해 주세요.');
  return win;
}
/* 메뉴 링크(a[data-id]) 중 팝업 화면은 현재 창을 이동시키지 않고 새 창으로 실행 */
document.addEventListener('click',function(e){
  const a=e.target.closest?e.target.closest('a[data-id],a.item,a.dd-i'):null;
  if(!a) return;
  const id=a.dataset&&a.dataset.id;
  const f=a.getAttribute('href')||'';
  const hit = id?isPop(id):Object.keys(FLAT).some(k=>isPop(k)&&FLAT[k].it.f===f);
  if(!hit) return;
  e.preventDefault(); e.stopPropagation();
  openPop(f,id||'qr');
},true);
function chrome(curId){
  const cur = FLAT[curId] || FLAT[Object.keys(FLAT)[0]];
  const it  = cur.it;
  document.title = C.APP_NAME+' - '+it.n;

  /* 팝업 창으로 열린 화면은 전체 메뉴를 렌더하지 않는다 (보안 · 오조작 방지) */
  if(/^kiPop_/.test(window.name||'')){
    document.body.classList.add('popmode');
    if(!document.getElementById('kiPopBar')){
      const h=el('div','pop-head');
      h.id='kiPopBar';
      h.innerHTML='<b>'+esc(it.n)+'</b><span>'+esc(it.d||'')+'</span>'+
                  '<button type="button" id="kiPopX">✕ 닫기</button>';
      document.body.insertBefore(h,document.body.firstChild);
      const x=document.getElementById('kiPopX');
      if(x) x.addEventListener('click',()=>window.close());
    }
    return cur;
  }

  /* 메뉴 모드 : 'drop'(상단 드롭다운) / 'top'(상단 가로바) / 'left'(좌측 트리) */
  const NAVMODE = C.NAV_MODE || (C.NAV_TOP===false ? 'left' : 'top');
  const NAVDROP = (NAVMODE==='drop'), NAVTOP = (NAVMODE==='top');
  /* SLIM_HEAD : 화면 제목 · 버튼을 상단바로 올리고 안내문(note)을 숨겨 그리드 영역 확보 */
  if(C.SLIM_HEAD!==false) document.body.classList.add('slim');
  /* ACT_IN_MENU : 실행버튼을 상단바가 아닌 드롭다운 메뉴의 우측 플라이아웃으로 표시 */
  const ACTMENU = NAVDROP && (C.ACT_IN_MENU!==false);
  if(ACTMENU) document.body.classList.add('actmenu');

  /* 1차 */
  const t1=el('div','top1');
  t1.innerHTML =
    '<a class="logo" href="'+(KI_CFG.LANDING||'lot_route.html')+'"><b>GI</b>MES</a>'+
    '<nav class="modules" id="kiMod"></nav>'+
    '<div class="pg-act top" id="kiAct"></div>'+
    '<div class="user">'+
      '<button class="mini" id="kiUser">👤</button>'+
      '<button class="mini" id="kiOut">🔒</button>'+
      '<span class="dot" id="kiDot"></span><span id="kiNet">Connected</span><span id="kiClock"></span>'+
    '</div>';
  document.body.appendChild(t1);

  /* 2차 */
  let sepr=null;
  if(!NAVDROP){ const t2=el('div','top2'); t2.id='kiSec'; document.body.appendChild(t2); }

  if(NAVDROP){
    document.body.classList.add('navdrop');
    const dd=el('div','dropnav'); dd.id='kiDrop'; document.body.appendChild(dd);
    if(ACTMENU){ const a=$('#kiAct'); a.className='pg-act flyout'; document.body.appendChild(a);
      const a2=el('div','pg-act flyout'); a2.id='kiActLink'; document.body.appendChild(a2); }
  }else if(NAVTOP){
    document.body.classList.add('navtop');
    const t3=el('div','top3'); t3.id='kiTop3';
    t3.innerHTML='<span class="t3-path" id="kiPath">'+esc(cur.modName)+' › '+esc(cur.secName||'')+'</span>'+
                 '<div class="tree" id="kiTree"></div>';
    document.body.appendChild(t3);
  }else{
    const lf=el('div','left');
    lf.innerHTML='<div class="tree-top" id="kiPath">'+esc(cur.modName)+' › '+esc(cur.secName||'')+'</div>'+
                 '<div class="tree" id="kiTree"></div>'+
                 '<div class="left-foot" id="kiFoot">⚙ '+esc(cur.modName)+'</div>';
    document.body.appendChild(lf);

    sepr=el('div','splitter'); sepr.id='kiSplit';
    sepr.title='드래그: 창 폭 조절 / 더블클릭: 기본값(300px)';
    document.body.appendChild(sepr);
  }

  /* 상태바 */
  const st=el('div','status');
  const s=session();
  st.innerHTML='<span id="kiTime"></span>'+
    '<span class="msg" id="kiMsg">'+esc(cur.path)+'</span>'+
    '<span class="right">'+esc(s?s.name:'-')+' · '+C.APP_NAME+' '+C.VER+'</span>';
  document.body.appendChild(st);

  /* --- 렌더 --- */
  let curMod=cur.mod, curSec=cur.sec;
  const NAV=(typeof MENU_V!=='undefined'&&MENU_V.length)?MENU_V:MENU;
  const mod=()=>NAV.find(m=>m.key===curMod)||NAV[0];
  const sec=()=>mod().second.find(x=>x.key===curSec)||mod().second[0];

  const okItem = it => can(it.id,'view');
  const okSec  = s2 => s2.groups.some(g=>g.items.some(okItem));
  const okMod  = m1 => m1.second.some(okSec);
  function drawMod(){
    $('#kiMod').innerHTML = NAV.filter(okMod).map(m=>
      '<button class="module'+((!NAVDROP&&m.key===curMod)?' on':'')+'" data-k="'+m.key+'">'+
      esc(m.name)+'</button>').join('');
    $('#kiMod').querySelectorAll('button').forEach(b=>{
      if(NAVDROP){
        b.addEventListener('click',e=>{ e.stopPropagation();
          const m1=NAV.find(m=>m.key===b.dataset.k);
          const its=m1?m1.second.filter(okSec).flatMap(s2=>s2.groups.flatMap(g=>g.items.filter(okItem))):[];
          if(its.length===1){ closeDrop(); location.href=its[0].f; return; }   /* 단일 화면 모듈은 바로 이동 */
          toggleDrop(b); });
        b.addEventListener('mouseenter',()=>{ if(dropKey) openDrop(b); });
        return;
      }
      b.addEventListener('click',()=>{
        curMod=b.dataset.k; curSec=mod().second[0].key; drawMod(); drawSec(); drawTree(); drawPath();
        const ft=$('#kiFoot'); if(ft) ft.textContent='⚙ '+mod().name;
      });
    });
  }

  /* --- 상단 드롭다운 메뉴 (엑셀형) --- */
  let dropKey=null, actTmr=null;
  const ACT_DELAY=150, ACT_LINGER=600;   /* 표시 지연 / 사라짐 유예(ms) */
  function actHover(){ return ['#kiAct','#kiActLink'].some(k=>{ const a=$(k);
    return a && a.classList.contains('on') && a.matches(':hover'); }); }
  function hideAct(force){
    if(!force && actHover()) return;     /* 마우스가 실행메뉴 위에 있으면 유지 */
    ['#kiAct','#kiActLink'].forEach(k=>{ const a=$(k); if(a) a.classList.remove('on'); });
  }
  function placeAct(a,anchor){
    const d=$('#kiDrop'); if(!d) return;
    const r=anchor.getBoundingClientRect(), dr=d.getBoundingClientRect();
    a.style.left=Math.min(dr.right-1, window.innerWidth-160)+'px';
    a.style.top=Math.min(r.top, Math.max(4,window.innerHeight-34*a.children.length-20))+'px';
    a.classList.add('on');
  }
  /* 화면별 실행버튼 목록(방문 시 저장) → 다른 화면 항목에도 우측 메뉴 표시 */
  function showAct(anchor,id){
    hideAct(true);
    if(id===curId){ const a=$('#kiAct'); if(a&&a.children.length) placeAct(a,anchor); return; }
    const a2=$('#kiActLink'), acts=actList(id), f=(FLAT[id]&&FLAT[id].it.f)||'';
    if(!a2||!acts.length||!f) return;
    a2.innerHTML=acts.map(x=>'<a class="btn'+(x.c?' '+x.c:'')+'" href="'+
      f+(f.indexOf('?')>=0?'&':'?')+'act='+encodeURIComponent(x.n)+'">'+esc(x.n)+'</a>').join('');
    placeAct(a2,anchor);
  }
  function closeDrop(){
    dropKey=null; hideAct(true);
    const d=$('#kiDrop'); if(d) d.classList.remove('on');
    $('#kiMod').querySelectorAll('button.open').forEach(b=>b.classList.remove('open'));
  }
  function openDrop(btn){
    const d=$('#kiDrop'); if(!d) return;
    const m1=NAV.find(m=>m.key===btn.dataset.k); if(!m1) return;
    const html=m1.second.filter(okSec).map(m2=>{
      const its=m2.groups.flatMap(g=>g.items.filter(okItem));
      if(!its.length) return '';
      const multi=m1.second.filter(okSec).length>1;
      return (multi?'<div class="dd-t">'+esc(m2.icon||'')+' '+esc(m2.name)+'</div>':'')+
        its.map(x=>'<a class="dd-i" data-id="'+x.id+'" href="'+x.f+'" title="'+esc(x.d||'')+'">'+
          esc(x.n)+'</a>').join('');
    }).join('');
    d.innerHTML=html||'<div class="dd-t">권한이 있는 메뉴가 없습니다.</div>';
    if(ACTMENU){
      hideAct();
      d.querySelectorAll('a.dd-i').forEach(a=>{
        const hasSub = actList(a.dataset.id).length>0;
        if(hasSub) a.classList.add('has-sub');
        a.addEventListener('mouseenter',()=>{ clearTimeout(actTmr);
          actTmr=setTimeout(()=>showAct(a,a.dataset.id),ACT_DELAY); });
        /* 하위(실행) 메뉴가 있는 항목은 클릭으로 이동하지 않음 — 우측에서 선택 */
        if(hasSub) a.addEventListener('click',e=>{ e.preventDefault();
          clearTimeout(actTmr); showAct(a,a.dataset.id); });
      });
      d.addEventListener('mouseleave',()=>{ clearTimeout(actTmr);
        actTmr=setTimeout(()=>hideAct(),ACT_LINGER); });
    }
    const r=btn.getBoundingClientRect();
    d.style.left=Math.max(2,Math.min(r.left,window.innerWidth-260))+'px';
    d.classList.add('on');
    $('#kiMod').querySelectorAll('button').forEach(b=>b.classList.toggle('open',b===btn));
    dropKey=btn.dataset.k;
  }
  function toggleDrop(btn){ if(dropKey===btn.dataset.k) closeDrop(); else openDrop(btn); }
  if(ACTMENU){
    ['#kiAct','#kiActLink'].forEach(k=>{ const a=$(k); if(!a)return;
      a.addEventListener('mouseenter',()=>clearTimeout(actTmr));
      a.addEventListener('mouseleave',()=>{ clearTimeout(actTmr);
        actTmr=setTimeout(()=>hideAct(),ACT_LINGER); });
      a.addEventListener('click',()=>setTimeout(closeDrop,0));
    });
  }
  if(NAVDROP){
    document.addEventListener('click',e=>{
      if(!e.target.closest('#kiDrop')&&!e.target.closest('#kiAct')&&!e.target.closest('#kiActLink')) closeDrop(); });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeDrop(); });
    window.addEventListener('resize',closeDrop);
  }
  function drawSec(){
    if(NAVDROP || !$('#kiSec')) return;
    const secs = mod().second.filter(okSec);
    /* 2차 항목이 1개뿐이면 아이콘바 숨김 (상단 가로 메뉴 모드) */
    document.body.classList.toggle('nosec', NAVTOP && secs.length<2);
    $('#kiSec').innerHTML = secs.map(x=>
      '<button class="tool'+(x.key===curSec?' on':'')+'" data-k="'+x.key+'">'+
      '<span class="ico">'+x.icon+'</span><span>'+esc(x.name)+'</span></button>').join('');
    $('#kiSec').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
      curSec=b.dataset.k; drawSec(); drawTree(); drawPath();
    }));
  }
  function drawPath(){
    const p=$('#kiPath'); if(!p)return;
    const m=mod(), s2=sec();
    p.textContent=(m?m.name:'')+(s2?' › '+s2.name:'');
  }
  function drawTree(){
    const box=$('#kiTree'); if(!box) return;
    const PF=new Set();
    const prefetch=u=>{ if(!u||PF.has(u))return; PF.add(u);
      try{ const l=document.createElement('link'); l.rel='prefetch'; l.as='document'; l.href=u;
        document.head.appendChild(l); }catch(e){}
      try{ fetch(u,{cache:'force-cache'}).catch(()=>{}); }catch(e){} };
    setTimeout(()=>{
      box.querySelectorAll('a.item').forEach(a=>{
        a.addEventListener('mouseenter',()=>prefetch(a.getAttribute('href')));
        a.addEventListener('click',e=>{ if(a.classList.contains('on')) e.preventDefault(); });
      });
    },0);
    box.innerHTML = sec().groups.map(g=>{
      const its=g.items.filter(okItem); if(!its.length) return '';
      return '<div class="group"><div class="group-title">'+esc(g.name)+'</div>'+
        its.map(x=>'<a class="item'+(x.id===curId?' on':'')+'" href="'+x.f+'" title="'+esc(x.d||'')+'">'+
          esc(x.n)+'</a>').join('')+'</div>';
    }).join('') || '<div style="padding:16px;color:#7a8793">권한이 있는 메뉴가 없습니다.</div>';
  }
  drawMod(); drawSec(); drawTree(); drawPath();

  /* --- 스플리터 --- */
  (function(){
    if(!sepr) return;                       /* 상단 가로 메뉴 모드 : 스플리터 없음 */
    const root=document.documentElement, MIN=200, MAX=560, DEF=300;
    const apply=w=>root.style.setProperty('--left',w+'px');
    try{ const v=parseInt(localStorage.getItem(LK_LEFT),10); if(v>=MIN) apply(Math.min(v,MAX)); }catch(e){}
    let drag=false;
    sepr.addEventListener('pointerdown',e=>{ drag=true; try{sepr.setPointerCapture(e.pointerId)}catch(_){}
      sepr.classList.add('drag'); document.body.classList.add('resizing'); e.preventDefault(); });
    sepr.addEventListener('pointermove',e=>{
      if(!drag)return;
      let w=Math.round(e.clientX), lim=Math.min(MAX,window.innerWidth-360);
      apply(Math.max(MIN,Math.min(w,lim)));
    });
    const end=e=>{ if(!drag)return; drag=false; try{sepr.releasePointerCapture(e.pointerId)}catch(_){}
      sepr.classList.remove('drag'); document.body.classList.remove('resizing');
      const w=parseInt(getComputedStyle(root).getPropertyValue('--left'),10)||DEF;
      try{ localStorage.setItem(LK_LEFT,String(w)); }catch(_){}
      msg('메뉴 창 폭을 '+w+'px 로 조절했습니다.'); };
    sepr.addEventListener('pointerup',end); sepr.addEventListener('pointercancel',end);
    sepr.addEventListener('dblclick',()=>{ apply(DEF); try{localStorage.setItem(LK_LEFT,String(DEF))}catch(_){}
      msg('메뉴 창 폭을 기본값(300px)으로 되돌렸습니다.'); });
  })();

  /* --- 사용자 / 시계 / 접속 --- */
  $('#kiUser').textContent='👤 '+(s?s.name+(s.role==='admin'?' (관리자)':''):'-');
  $('#kiUser').addEventListener('click',()=>{ if(!s)return;
    const m=ME||{};
    alert('👤 '+s.name+' ('+s.emp_no+')\n'+
          '권한: '+(s.role==='admin'?'관리자 — 전 화면 사용 가능':'사용자')+'\n'+
          '부서: '+(m.dept||'-')+' / 직급: '+(m.position||'-')+'\n'+
          '계정: '+(m.login_email||'-')); });
  $('#kiOut').addEventListener('click',()=>{ if(confirm('로그아웃 하시겠습니까?')) logout(); });

  const tick=()=>{ const d=new Date();
    $('#kiClock').textContent=d.toLocaleString('ko-KR',{hour12:false,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
    $('#kiTime').textContent=d.toLocaleString('sv-SE',{hour12:false}).replace(',',''); };
  tick(); setInterval(tick,1000);
  const net=async()=>{ let ok=true; try{ await get(OBJ.employee+'?select=emp_no&limit=1'); }catch(e){ ok=false; }
    $('#kiDot').classList.toggle('off',!ok); $('#kiNet').textContent=ok?'Connected':'Offline'; };
  net(); setInterval(net,120000);

  /* --- 모바일 : 햄버거 드로어 (PC 메뉴와 동일 구성 · HIDE 반영) --- */
  if(isPhone()) mobileNav(curId,cur);
  return cur;
}

/* 폰에서는 3단 메뉴 대신 상단바 + 슬라이드 드로어로 전환한다.
   메뉴 원본은 PC와 같은 MENU_V(숨김 모듈 제외)를 그대로 사용한다. */
function mobileNav(curId,cur){
  if(document.getElementById('kiMobBar')) return;
  document.body.classList.add('mobnav');
  const it=cur.it, s=session();

  const bar=el('div','mob-bar'); bar.id='kiMobBar';
  bar.innerHTML='<button class="mob-ham" id="kiHam" aria-label="메뉴">☰</button>'+
    '<span class="mob-lg"><b>GI</b>MES</span>'+
    '<span class="mob-ttl">'+esc(it.n)+'</span>'+
    '<button class="mob-usr" id="kiMobOut">🔒</button>';
  document.body.insertBefore(bar,document.body.firstChild);

  const dim=el('div','mob-dim'); dim.id='kiMobDim';
  const dw =el('div','mob-drawer'); dw.id='kiMobDrawer';

  const src=(typeof MENU_V!=='undefined')?MENU_V:MENU;
  let html='<div class="mob-me"><b>'+esc(s?s.name:'-')+'</b>'+
           '<span>'+esc(s&&s.role==='admin'?'관리자':'사용자')+'</span></div>';
  src.forEach(m1=>{
    /* 현재 화면이 속한 모듈은 펼친 상태로 */
    const openM = (cur.mod===m1.key);
    let inner='';
    m1.second.forEach(m2=>{
      const items=[];
      m2.groups.forEach(g=>g.items.forEach(x=>{ if(can(x.id,'view')) items.push(x); }));
      if(!items.length) return;
      inner+='<div class="mob-sec">'+(m2.icon?'<i>'+m2.icon+'</i>':'')+esc(m2.name)+'</div>'+
        items.map(x=>'<a class="mob-it'+(x.id===curId?' on':'')+'" href="'+esc(x.f)+'" data-id="'+esc(x.id)+'">'+
          esc(x.n)+(x.pop?'<em>새 창</em>':'')+'</a>').join('');
    });
    if(!inner) return;
    html+='<div class="mob-mod'+(openM?' open':'')+'">'+
      '<button class="mob-m1" type="button">'+esc(m1.name)+'<span>▾</span></button>'+
      '<div class="mob-body">'+inner+'</div></div>';
  });
  html+='<div class="mob-foot"><button type="button" id="kiMobLogout">🔒 로그아웃</button></div>';
  dw.innerHTML=html;
  document.body.appendChild(dim); document.body.appendChild(dw);

  const openNav =v=>{ dw.classList.toggle('on',v); dim.classList.toggle('on',v);
                      document.body.classList.toggle('mob-lock',v); };
  document.getElementById('kiHam').addEventListener('click',()=>openNav(!dw.classList.contains('on')));
  dim.addEventListener('click',()=>openNav(false));
  dw.querySelectorAll('.mob-m1').forEach(b=>b.addEventListener('click',()=>{
    b.parentNode.classList.toggle('open');
  }));
  const out=()=>{ if(confirm('로그아웃 하시겠습니까?')) logout(); };
  document.getElementById('kiMobOut').addEventListener('click',out);
  document.getElementById('kiMobLogout').addEventListener('click',out);
}
function msg(t){ const m=$('#kiMsg'); if(m)m.textContent=t; }
const header = chrome;                       /* 하위 호환 */

const ACT_LS='ki_act:';
/* 화면별 실행버튼 목록 : ① ki_config.js 의 ACTS ② 그리드 화면(VIEWS)은 권한으로 자동 산출 ③ 방문 캐시 */
function actList(id){
  if(typeof ACTS!=='undefined' && ACTS[id]) return ACTS[id].map(a=>({n:a[0],c:a[1]||''}));
  const def=(typeof VIEWS!=='undefined')?VIEWS[id]:null;
  if(def){
    const a=[{n:'조회',c:'primary'}];
    if(def.edit){
      if(can(id,'save')){ a.push({n:'등록',c:''}); a.push({n:'엑셀업로드',c:''}); }
      if(can(id,'edit'))   a.push({n:'수정',c:''});
      if(can(id,'delete')) a.push({n:'삭제',c:'danger'});
    }
    a.push({n:'초기화',c:''}); a.push({n:'엑셀다운로드',c:''}); a.push({n:'인쇄',c:''});
    return a;
  }
  try{ return JSON.parse(localStorage.getItem(ACT_LS+id)||'[]'); }catch(e){ return []; }
}
function page(cur, actions){
  const it = cur.it || cur;
  const ws=el('div','workspace'), pg=el('div','page');
  const SLIM = document.body.classList.contains('slim') && $('#kiAct');
  const h=el('div','pg-head');
  h.innerHTML='<h2>'+esc(it.n)+'</h2><span class="sub">'+esc(it.d||'')+'</span>';
  const act = SLIM ? $('#kiAct') : el('div','pg-act');
  if(SLIM){ act.innerHTML=''; }
  (actions||[]).forEach(([label,cls,fn])=>{ const b=el('button','btn'+(cls?' '+cls:''),label);
    b.addEventListener('click',fn); act.appendChild(b); });
  if(!SLIM){ h.appendChild(act); pg.appendChild(h); }
  ws.appendChild(pg); document.body.appendChild(ws);
  /* 화면별 실행버튼 목록 저장 (드롭다운 우측 메뉴용) */
  try{ if(it.id) localStorage.setItem(ACT_LS+it.id,
        JSON.stringify((actions||[]).map(a=>({n:a[0],c:a[1]||''})))); }catch(e){}
  /* 메뉴에서 [?act=버튼명] 으로 진입한 경우 해당 버튼 자동 실행 */
  const qa=new URLSearchParams(location.search).get('act');
  if(qa) setTimeout(()=>{ const b=[].slice.call(act.querySelectorAll('button'))
      .find(x=>x.textContent.trim()===qa); if(b) b.click(); },600);
  return {pg:pg, head:h, act:act, ws:ws};
}

/* ---------- 마스터 캐시 ---------- */
const M={vendors:[],procs:[],procmap:{},routes:[],factories:[],sensors:[]};
async function masters(need){
  need=need||[];
  const j=[];
  if(need.includes('vendor')) j.push(get(OBJ.vendor+'?select=vendor_name&order=vendor_name.asc')
    .then(v=>M.vendors=[...new Set(v.map(x=>x.vendor_name).filter(Boolean))]).catch(()=>{}));
  if(need.includes('proc'))   j.push(get(OBJ.process+'?select=process_code,process_name,process_group,sort_order&order=sort_order.asc')
    .then(p=>{ M.procs=p.filter(x=>x.process_group==='가공').map(x=>({code:x.process_code,name:x.process_name}));
               p.forEach(x=>M.procmap[x.process_code]=x.process_name); }).catch(()=>{}));
  if(need.includes('route'))  j.push(get(OBJ.stdRoute+'?select=standard_process_no,standard_process_name,steps&order=standard_process_no.asc')
    .then(r=>M.routes=r).catch(()=>{}));
  if(need.includes('factory'))j.push(get(OBJ.factory+'?select=*&order=factory_code.asc').then(f=>M.factories=f).catch(()=>{}));
  if(need.includes('sensor')) j.push(get(OBJ.sensor+'?select=*&order=sensor_code.asc').then(s=>M.sensors=s).catch(()=>{}));
  await Promise.all(j);
}

/* ---------- 검색 패널 ---------- */
function opts(kind){
  switch(kind){
    case 'sel-vendor': return ['전체'].concat(M.vendors);
    case 'sel-mp':     return ['전체'].concat(M.procs.map(p=>p.code+' · '+p.name));
    case 'sel-fac':    return ['전체'].concat(M.factories.map(f=>f.factory_code));
    case 'sel-sensor': return ['전체'].concat(M.sensors.map(s=>s.sensor_code));
    case 'sel-due':    return ['전체','지연','임박','예정','여유','미지정'];
    case 'sel-judge':  return ['전체','합격','조건부합격','불합격'];
    case 'sel-res':    return ['전체','합격','주의','불합격'];
    case 'sel-mst':    return ['전체','정상','주의','점검필요','폐기'];
    case 'sel-asset':  return ['전체','가동','정지','경고','정상','고장'];
    case 'sel-ost':    return ['전체','발주','진행','완료','취소'];
    case 'sel-rst':    return ['전체','대기','확인','완료'];
    case 'sel-alert':  return ['전체','고온','저온','고습','저습','무신호'];
    case 'sel-astat':  return ['전체','발생','조치중','해제'];
    case 'sel-ctype':  return ['전체','일상','정기'];
    case 'sel-role':   return ['전체','관리자','사용자'];
    case 'sel-side':   return ['전체','상형','하형'];
    case 'sel-kind':   return ['전체','정기','세척'];
    case 'sel-prod':   return ['전체','양산','A/S'];
    case 'sel-wash':   return ['전체','도래(타발수)','도래(기간)','임박','정상','미실시'];
    case 'sel-ckind':  return ['전체','일상','정기','세척'];
    case 'sel-ckres':  return ['전체','합격','주의','불합격','양호','불량','조건부합격'];
    default: return ['전체'];
  }
}
function field(kind,f){
  const w=el('div','search-field');
  if(kind==='date2'){
    const a=el('input'); a.type='date'; a.dataset.f=f; a.dataset.op='gte';
    const b=el('input'); b.type='date'; b.dataset.f=f; b.dataset.op='lte';
    const t=el('span',null,'~'); t.style.color='#8894a0';
    w.appendChild(a); w.appendChild(t); w.appendChild(b);
  }else if(kind==='num'){
    const i=el('input'); i.type='number'; i.placeholder='이상'; i.dataset.f=f; i.dataset.op='min'; w.appendChild(i);
  }else if(kind==='text'){
    const i=el('input'); i.placeholder='포함 검색'; i.dataset.f=f; i.dataset.op='like'; w.appendChild(i);
  }else{
    const s=el('select'); s.dataset.f=f; s.dataset.op='eq'; s.dataset.kind=kind;
    opts(kind).forEach(v=>{ const o=el('option',null,v); s.appendChild(o); });
    w.appendChild(s);
  }
  return w;
}
function searchPanel(def){
  const sp=el('div','search-panel'); let row=null;
  def.search.forEach((f,i)=>{
    if(i%3===0){ row=el('div','search-row'); sp.appendChild(row); }
    const lb=el('div','search-label'+(i%3===2?' hide-sm':''),f[0]);
    const fd=field(f[1],f[2]);
    row.appendChild(lb); row.appendChild(fd);
  });
  return sp;
}
function filters(sp){
  const out=[];
  sp.querySelectorAll('input,select').forEach(e=>{
    let v=(e.value||'').trim(); if(!v||v==='전체')return;
    if(e.dataset.kind==='sel-mp') v=v.split(' · ')[0];
    out.push({f:e.dataset.f,op:e.dataset.op,v:v});
  });
  return out;
}
function applyFilter(rows,fs){
  return rows.filter(r=>fs.every(f=>{
    const v=r[f.f];
    if(f.op==='like') return String(v==null?'':v).toLowerCase().includes(f.v.toLowerCase());
    if(f.op==='eq')   return String(v==null?'':v)===f.v;
    if(f.op==='gte')  return String(v==null?'':v)>=f.v;
    if(f.op==='lte')  return String(v==null?'':v)<=f.v;
    if(f.op==='min')  return Number(v||0)>=Number(f.v);
    return true;
  }));
}

/* ---------- 데이터 가공 ---------- */
const dayDiff=s=>{ if(!s)return null; const d=new Date(s+'T00:00:00'); return isNaN(d)?null:Math.floor((new Date()-d)/864e5); };
const pName=c=>M.procmap[c]||'';
function matchRoute(mps){
  let best=null,bs=-1,bhit=0;
  M.routes.forEach(rt=>{
    const st=Array.isArray(rt.steps)?rt.steps:[]; let hit=0,pos=0;
    mps.forEach(m=>{ const k=st.indexOf(m,pos); if(k>=0){hit++;pos=k+1;} });
    const sc=hit*100-st.length;
    if(hit>0&&sc>bs){ bs=sc; best=rt; bhit=hit; }
  });
  return best?{rt:best,hit:bhit}:null;
}
const POST={
  issue: rows=>rows.filter(r=>r.odate).map((r,i)=>Object.assign({_i:i+1},r)),
  stock: rows=>rows.filter(r=>!r.idate).map((r,i)=>Object.assign({},r,{
    _i:i+1,_days:dayDiff(r.odate),
    _due:!r.edate?'-':(dayDiff(r.edate)>0?'지연':'정상')})),
  trace: rows=>{
    const out=[];
    rows.forEach(r=>{
      const st=Array.isArray(r.steps)?r.steps:[], chain=st.map(s=>s.mp).join(' → ');
      st.forEach((s,i)=>out.push({job:r.job,part:r.part,proc:r.proc,seq:i+1,mp:s.mp,mpName:pName(s.mp),
        map_part:s.map_part||r.map_part||'', mold_no:s.mold_no||r.mold_no||'',
        vendor:s.vendor,date:s.date,prevMp:i>0?st[i-1].mp:'-',nextMp:i<st.length-1?st[i+1].mp:'-',chain:chain}));
    });
    /* 최신순 : 날짜 내림차순, 같은 날짜면 공정 순번 뒤인 것이 먼저 */
    out.sort((a,b)=>(b.date||'').localeCompare(a.date||'') || (b.seq-a.seq));
    out.forEach((r,i)=>r._i=i+1); return out;
  },
  route: rows=>rows.map((r,i)=>{
    const st=Array.isArray(r.steps)?r.steps:[], last=st[st.length-1]||{};
    const m=matchRoute(st.map(s=>s.mp));
    const sd=m?m.rt.steps:[];
    const seen=new Set(st.map(s=>s.mp));
    /* 진척 = 표준공정 중 실제로 거친 단계 수 */
    const hit   = sd.filter(x=>seen.has(x));
    const total = sd.length || st.length || 1;
    const done  = m ? hit.length : st.length;
    /* 다음 공정 = 아직 거치지 않은 표준공정 중 가장 앞선 것 (건너뛴 공정 우선) */
    const rest  = sd.filter(x=>!seen.has(x));
    const nx    = rest[0]||'';
    const skip  = rest.length>1 ? rest.length-1 : 0;      /* 미진행 잔여 */
    const extra = st.length - done;                        /* 표준경로 밖 공정 수 */
    return {_i:i+1,job:r.job,part:r.part,proc:r.proc,mp:last.mp||'-',mpName:pName(last.mp),
      vendor:last.vendor||'-',date:last.date||'',
      stdName: m ? m.rt.standard_process_name + (extra>0?' (+'+extra+')':'') : '(미매칭)',
      nextMp: nx ? nx+(pName(nx)?' · '+pName(nx):'')+(skip?' 외 '+skip+'건':'') : (m?'완료':'-'),
      done:done,total:total,steps:st.length,
      _rate: total?Math.round(done/total*100):0,
      chain:st.map(s=>s.mp+'('+(s.vendor||'')+')').join(' → ')};
  }),
  std: rows=>rows.map(r=>{ const st=Array.isArray(r.steps)?r.steps:[];
    return Object.assign({},r,{_cnt:st.length,_steps:st.join(' → ')}); })
};

/* ---------- 셀 렌더 ---------- */
function cell(row,col){
  const v=row[col[3]], ct=col[4];
  switch(ct){
    case 'won': return v?Number(v).toLocaleString():'';
    case 'n0':  return v==null?'':Number(v).toLocaleString();
    case 'days':return v==null?'-':v+'일';
    case 'dt':  return v?String(v).replace('T',' ').substring(0,16):'';
    case 'mp':  return v?esc(v)+(pName(v)?' · '+esc(pName(v)):''):'';
    case 'grade':{
      const g=String(v||'').toUpperCase();
      const c={A:'background:#e2f0e6;color:#15803d;border-color:#b7dcc2',
               B:'background:#e9f2fc;color:#1d568c;border-color:#bcd0e4',
               C:'background:#fdeeda;color:#b05c12;border-color:#ecd0a8',
               F:'background:#f1f3f5;color:#77828c;border-color:#d4dae0'}[g];
      return g?'<span class="badge" style="'+(c||'')+'">'+g+'</span>':'';
    }
    case 'w2':  return v==null?'':Number(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
    case 'qr':{
      const q=row.qr_code, lk=row.link_no;
      let h = q ? '<span class="badge b-run">'+esc(q)+'</span>'
                : '<span class="badge" style="background:#eef1f4;color:#8b98a5;border-color:#d6dde4">QR 없음</span>';
      if(lk) h+=' <span class="badge" style="background:#f4ecfa;color:#7b3fa0;border-color:#ddc9ec">↔ '+esc(lk)+'</span>';
      return h;
    }
    case 'bool':return v===true?'<span class="badge b-done">✓</span>':(v===false?'<span style="color:#a7b3bf">–</span>':'');
    case 'color':return v?'<span style="display:inline-block;width:12px;height:12px;border:1px solid #b6c3cf;background:'+esc(v)+';vertical-align:-2px"></span> '+esc(v):'';
    case 'dday':{
      if(v==null)return '';
      const n=Number(v), k=n<0?'b-late':(n<=7?'b-wait':'b-done');
      return '<span class="badge '+k+'">'+(n<0?'D+'+Math.abs(n):'D-'+n)+'</span>';
    }
    case 'bar':{
      const pn=Number(v||0);
      return '<div class="bar'+(pn>=90?' hi':'')+'" title="'+pn+'%"><i style="width:'+Math.max(0,Math.min(100,pn))+'%"></i></div>';
    }
    case 'st':{
      const s=String(v==null?'':v); if(!s)return '';
      const k = /지연|취소|불합격|고온|저온|고습|저습|발생|경고|점검필요|무신호|고장/.test(s) ? 'b-late'
              : /대기|임박|주의|조건부|조치중|정지/.test(s) ? 'b-wait'
              : /완료|확인|정상|합격|여유|가동|해제/.test(s) ? 'b-done' : 'b-run';
      return '<span class="badge '+k+'">'+esc(s)+'</span>';
    }
    case 'chain': return '<span class="chain">'+esc(String(v==null?'':v)).replace(/→/g,'<b>→</b>')+'</span>';
    default: return esc(String(v==null?'':v));
  }
}


/* ============================================================
   공용 편집 모달 : def.edit = {table, pk, auto, fields:[[key,label,type,opt]]}
   type : text | num | date | datetime | bool | area | sel | ref
============================================================ */
const REFCACHE={};
async function refOpts(o){
  const k=o.table+'|'+o.v;
  if(!REFCACHE[k]){
    try{ REFCACHE[k]=await get(o.table+'?select='+o.v+(o.t?','+o.t:'')+'&order='+(o.order||o.v)+'.asc'); }
    catch(e){ REFCACHE[k]=[]; }
  }
  return REFCACHE[k];
}
function makeModal(def, onSaved){
  const E=def.edit;
  const mask=el('div','mask');
  const rows=E.fields.map(f=>{
    const [k,lb,ty]=f;
    let ctl;
    if(ty==='bool')      ctl='<select id="e_'+k+'"><option value="true">사용</option><option value="false">미사용</option></select>';
    else if(ty==='area') ctl='<textarea id="e_'+k+'" maxlength="300"></textarea>';
    else if(ty==='sel'||ty==='ref') ctl='<select id="e_'+k+'"></select>';
    else if(ty==='num')  ctl='<input id="e_'+k+'" type="number" step="any">';
    else if(ty==='list') ctl='<input id="e_'+k+'" type="text" maxlength="300" placeholder="예: P10 → P20 → P30">';
    else if(ty==='date') ctl='<input id="e_'+k+'" type="date">';
    else if(ty==='datetime') ctl='<input id="e_'+k+'" type="datetime-local">';
    else                 ctl='<input id="e_'+k+'" type="text" maxlength="120">';
    if(f[4]==='ro') ctl=ctl.replace(/^<(input|select|textarea)/,'<$1 disabled')
      +'<div style="grid-column:2;color:#8b98a5;font-size:11px;margin-top:2px">기준정보에서 관리하는 항목입니다</div>';
    return '<div class="mrow"><label>'+esc(lb)+(f[4]==='req'?' *':'')+'</label>'+ctl+'</div>';
  }).join('');
  mask.innerHTML='<div class="modal"><h3 id="eTitle">등록<button class="x" id="eX">✕</button></h3>'+
    '<div class="bd" style="max-height:60vh;overflow:auto">'+rows+'</div>'+
    '<div class="mfoot"><button class="btn primary" id="eSave">저장</button>'+
    '<button class="btn" id="eCancel">취소</button><span class="msg" id="eMsg"></span></div></div>';
  document.body.appendChild(mask);

  /* 옵션 채우기 */
  E.fields.forEach(async f=>{
    const [k,,ty,opt]=f;
    if(ty==='sel'){
      const s=$('#e_'+k,mask); s.appendChild(el('option',null,''));
      (opt||[]).forEach(v=>{ const o=el('option',null,v); o.value=v; s.appendChild(o); });
    }else if(ty==='ref'){
      const s=$('#e_'+k,mask); s.appendChild(el('option',null,''));
      (await refOpts(opt)).forEach(r=>{
        const o=el('option',null, opt.t ? (r[opt.v]+' · '+(r[opt.t]||'')) : r[opt.v]); o.value=r[opt.v]; s.appendChild(o);
      });
    }
  });

  let editKey=null, editRow=null;
  const close=()=>mask.classList.remove('on');
  $('#eX',mask).addEventListener('click',close);
  $('#eCancel',mask).addEventListener('click',close);
  mask.addEventListener('click',e=>{ if(e.target===mask) close(); });

  function open(row){
    editKey = row ? row[E.pk] : null; editRow=row||null;
    $('#eTitle',mask).childNodes[0].nodeValue = row ? '수정 — '+(row[E.pk]??'') : '신규 등록';
    E.fields.forEach(f=>{
      const [k,,ty]=f, c=$('#e_'+k,mask); if(!c)return;
      let v = row ? row[k] : (f[3]&&f[3].def!==undefined?f[3].def:'');
      if(ty==='bool') c.value = String(v!==false);
      else if(ty==='datetime') c.value = v?String(v).replace(' ','T').substring(0,16):'';
      else if(ty==='date') c.value = v?String(v).substring(0,10):'';
      else if(ty==='list') c.value = Array.isArray(v)?v.join(' → '):(v==null?'':v);
      else c.value = (v==null?'':v);
    });
    if(E.auto && !row){ const c=$('#e_'+E.pk,mask); if(c){ c.value=''; } }
    const pk=$('#e_'+E.pk,mask); if(pk) pk.readOnly = !!row;
    $('#eMsg',mask).textContent='';
    mask.classList.add('on');
    setTimeout(()=>{ const first=mask.querySelector('input,select,textarea'); if(first)first.focus(); },50);
  }
  $('#eSave',mask).addEventListener('click',async()=>{
    const m=$('#eMsg',mask), body={};
    for(const f of E.fields){
      const [k,lb,ty]=f, c=$('#e_'+k,mask); if(!c)continue;
      if(f[4]==='ro') continue;                 /* 기준정보 항목 : 저장 대상 제외 */
      let v=c.value;
      if(ty==='bool') v = (v==='true');
      else if(ty==='list') v = toList(v).length?toList(v):null;
      else if(ty==='num') v = (v===''?null:Number(v));
      else if(ty==='datetime') v = (v===''?null:new Date(v).toISOString());
      else { v=String(v).trim(); if(v==='') v=null; }
      if(f[4]==='req' && (v===null||v==='')){ m.className='msg err'; m.textContent=lb+' 항목은 필수입니다.'; return; }
      body[k]=v;
    }
    if(E.auto && !editKey) delete body[E.pk];
    m.className='msg'; m.textContent='저장중...';
    try{
      if(editKey!=null){
        let flt=E.pk+'=eq.'+encodeURIComponent(editKey);
        if(E.pk2 && editRow) flt+='&'+E.pk2+'=eq.'+encodeURIComponent(editRow[E.pk2]);
        await upd(E.table, flt, body);
      }
      else              await ins(E.table, [body]);
      close(); await onSaved(editKey!=null?'수정':'등록');
    }catch(e){ m.className='msg err'; m.textContent='❌ '+e.message; }
  });
  return {open:open, close:close};
}

/* ============================================================
   엑셀 템플릿 업로드 / 다운로드
   · [양식 받기] 머리글 + 작성안내 시트가 포함된 템플릿 내려받기
   · [현재자료 받기] 조회된 자료를 템플릿 형식으로 내려받아 수정 후 재업로드
   · [파일 선택 / 끌어놓기] xlsx · xls · csv · txt 업로드 → 검증 → 저장
============================================================ */
const XLSX_SRC='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
let XLSXP=null;
function loadXLSX(){
  if(window.XLSX) return Promise.resolve(window.XLSX);
  if(!XLSXP) XLSXP=new Promise(res=>{
    const s=document.createElement('script');
    s.src=XLSX_SRC; s.onload=()=>res(window.XLSX||null); s.onerror=()=>res(null);
    document.head.appendChild(s);
  });
  return XLSXP;
}
function upFields(E){
  return E.fields.filter(f=>f[4]!=='ro');
}
const upLabel = f => f[1]+(f[4]==='req'?'*':'');
const upHint  = (E,f) => (E.auto&&f[0]===E.pk)?' (신규는 비움)':'';
const normKey = s => String(s==null?'':s).replace(/[*＊\s()（）·]/g,'').toLowerCase();
const typeName = t => ({text:'문자',num:'숫자',date:'날짜(YYYY-MM-DD)',datetime:'일시',
                        bool:'사용 / 미사용',area:'문자(장문)',sel:'목록선택',ref:'코드',
                        lookup:'코드 또는 명칭',list:'순서목록( → 또는 , 구분)'}[t]||'문자');
const lkList = f => (typeof f[3]==='function'?f[3]():f[3])||[];
const toList = s => String(s||'').split(/→|>|,|\//).map(x=>x.trim()).filter(Boolean);
function allowText(f){
  if(f[2]==='sel') return (f[3]||[]).join(' / ');
  if(f[2]==='bool') return '사용 / 미사용';
  if(f[2]==='ref')  return '기준정보 코드';
  if(f[2]==='lookup') return lkList(f).map(x=>x.v+'('+x.t+')').join(' / ');
  if(f[2]==='list') return '예: P10 → P20 → P30';
  return '';
}
/* ---------- 파일 읽기 ---------- */
function parseDelim(text,d){
  const rows=[]; let row=[], cur='', q=false;
  const s=String(text||'').replace(/^\ufeff/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(q){ if(c==='"'){ if(s[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=c; }
    else if(c==='"'&&cur==='') q=true;
    else if(c===d){ row.push(cur); cur=''; }
    else if(c==='\n'){ row.push(cur); rows.push(row); row=[]; cur=''; }
    else cur+=c;
  }
  if(cur!==''||row.length){ row.push(cur); rows.push(row); }
  return rows;
}
function decodeText(buf){
  let t=new TextDecoder('utf-8').decode(buf);
  if(t.indexOf('\ufffd')>=0){                       /* 한글 윈도우 CSV(CP949) 대응 */
    try{ t=new TextDecoder('euc-kr').decode(buf); }catch(e){}
  }
  return t;
}
async function readSheet(file){
  const name=(file.name||'').toLowerCase();
  const buf=await file.arrayBuffer();
  if(/\.(xlsx|xlsm|xlsb|xls)$/.test(name)){
    const X=await loadXLSX();
    if(!X) throw new Error('엑셀(xlsx) 해석 모듈을 불러오지 못했습니다. 파일을 CSV로 저장한 뒤 업로드하세요.');
    const wb=X.read(buf,{type:'array',cellDates:true});
    const ws=wb.Sheets[wb.SheetNames[0]];
    return X.utils.sheet_to_json(ws,{header:1,defval:'',blankrows:false});
  }
  const txt=decodeText(buf);
  const head=(txt.split('\n')[0]||'');
  const d=(head.split('\t').length>head.split(',').length)?'\t':',';
  return parseDelim(txt,d);
}
/* ---------- 값 변환 ---------- */
function pad2(n){ return ('0'+n).slice(-2); }
function dstr(d){ return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }
function normDate(v){
  if(v instanceof Date) return isNaN(v)?null:dstr(v);
  const s=String(v).trim();
  let m=s.match(/^(\d{4})\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*(\d{1,2})/);
  if(m) return m[1]+'-'+pad2(+m[2])+'-'+pad2(+m[3]);
  if(/^\d{8}$/.test(s)) return s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8);
  if(/^\d{5}$/.test(s)){                                    /* 엑셀 날짜 일련번호 */
    const d=new Date(Date.UTC(1899,11,30)+Number(s)*864e5); return dstr(d);
  }
  const d=new Date(s.replace(/\./g,'-'));
  return isNaN(d)?null:dstr(d);
}
/* 반환 {v:값, e:오류, w:경고} */
function ucell(f,raw){
  const ty=f[2], req=(f[4]==='req'), lb=f[1];
  if(ty==='date'&&raw instanceof Date) return {v:dstr(raw),e:null};
  if(ty==='datetime'&&raw instanceof Date) return {v:raw.toISOString(),e:null};
  let s=String(raw==null?'':raw).trim();
  if(s===''||s==='-') return req?{v:null,e:lb+' 필수'}:{v:null,e:null};
  if(ty==='bool')  return {v:!/^(false|미사용|중지|n|no|0|x|아니오)$/i.test(s),e:null};
  if(ty==='num'){
    const n=Number(s.replace(/[,\s%]/g,''));
    return isNaN(n)?{v:null,e:lb+' 숫자오류'}:{v:n,e:null};
  }
  if(ty==='date'){ const d=normDate(s); return d?{v:d,e:null}:{v:null,e:lb+' 날짜오류'}; }
  if(ty==='datetime'){
    const d=new Date(s.replace(/\./g,'-'));
    return isNaN(d)?{v:null,e:lb+' 일시오류'}:{v:d.toISOString(),e:null};
  }
  if(ty==='sel'){
    const list=f[3]&&f[3].length?f[3]:null;
    if(list&&list.indexOf(s)<0) return {v:s,e:null,w:lb+' 목록 외("'+s+'")'};
    return {v:s,e:null};
  }
  if(ty==='lookup'){
    const L=lkList(f);
    if(!L.length) return {v:s,e:null};
    const hit=L.find(x=>String(x.v)===s||String(x.t)===s);
    return hit?{v:hit.v,e:null}:{v:null,e:lb+' 미등록("'+s+'")'};
  }
  if(ty==='list'){
    const a=toList(s);
    return a.length?{v:a,e:null}:(req?{v:null,e:lb+' 필수'}:{v:null,e:null});
  }
  return {v:s,e:null};
}
function outVal(f,v){
  if(v==null) return '';
  if(f[2]==='bool') return v===false?'미사용':'사용';
  if(f[2]==='date') return String(v).substring(0,10);
  if(f[2]==='datetime') return String(v).replace('T',' ').substring(0,16);
  if(f[2]==='lookup'){ const h=lkList(f).find(x=>String(x.v)===String(v)); return h?h.t:v; }
  if(f[2]==='list') return Array.isArray(v)?v.join(' → '):v;
  return v;
}
/* ---------- 템플릿 파일 생성 ---------- */
async function makeTemplate(title, FS, rows){
  const head=FS.map(upLabel);
  const body=(rows||[]).map(r=>FS.map(f=>outVal(f,r[f[0]])));
  const X=await loadXLSX();
  if(X){
    const wb=X.utils.book_new();
    const ws=X.utils.aoa_to_sheet([head].concat(body));
    ws['!cols']=FS.map(f=>({wch:Math.max(10,Math.min(28,f[1].length*2+6))}));
    X.utils.book_append_sheet(wb,ws,'DATA');
    const g=[['항목','필수','형식','입력 가능 값','DB 컬럼']].concat(
      FS.map(f=>[f[1], f[4]==='req'?'필수':'', typeName(f[2]), allowText(f), f[0]]));
    const wg=X.utils.aoa_to_sheet(g);
    wg['!cols']=[{wch:20},{wch:8},{wch:20},{wch:44},{wch:20}];
    X.utils.book_append_sheet(wb,wg,'작성안내');
    X.writeFile(wb, title+'.xlsx');
    return 'xlsx';
  }
  const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const csvT='\ufeff'+[head.map(q).join(',')].concat(body.map(r=>r.map(q).join(','))).join('\n');
  const a=el('a'); a.href=URL.createObjectURL(new Blob([csvT],{type:'text/csv'}));
  a.download=title+'.csv'; a.click(); URL.revokeObjectURL(a.href);
  return 'csv';
}
/* ---------- 업로드 모달 ---------- */
function makeUpload(def, title, getRows, onSaved){
  const E=def.edit, FS=upFields(E), TITLE=(title||E.table);
  const mask=el('div','mask');
  mask.innerHTML=
    '<div class="modal wide"><h3>📊 엑셀 템플릿 업로드<button class="x" id="uX">✕</button></h3>'+
    '<div class="bd">'+
      '<div class="up-step">'+
        '<div class="up-num">1</div><div class="up-txt"><b>양식 내려받기</b> — 머리글과 작성안내가 포함된 파일을 받습니다.'+
        '<div class="up-btns"><button class="btn" id="uTpl">📥 빈 양식 받기</button>'+
        '<button class="btn" id="uCur">📥 현재자료 받기</button></div></div>'+
      '</div>'+
      '<div class="up-step">'+
        '<div class="up-num">2</div><div class="up-txt"><b>엑셀에서 작성</b> — 첫 행(머리글)은 <u>지우지 말고</u> 둘째 행부터 입력하세요. '+
        '＊ 표시는 필수 항목입니다. 열 순서를 바꿔도 머리글 이름으로 자동 인식합니다.'+
        '<div class="up-order">'+FS.map(f=>'<span>'+esc(f[1]+upHint(E,f))+(f[4]==='req'?'<b>＊</b>':'')+'</span>').join('')+'</div></div>'+
      '</div>'+
      '<div class="up-step">'+
        '<div class="up-num">3</div><div class="up-txt"><b>업로드</b> — xlsx · xls · csv 파일을 올리면 자동 검증됩니다.'+
        '<div class="up-drop" id="uDrop"><input type="file" id="uFile" accept=".xlsx,.xls,.xlsm,.csv,.txt" hidden>'+
        '<span id="uDropTxt">파일을 이곳에 끌어놓거나 <b>클릭</b>하여 선택</span></div></div>'+
      '</div>'+
      '<div class="up-bar">'+
        '<label class="up-opt"><input type="checkbox" id="uUp" checked> 기존 키는 덮어쓰기(UPSERT)</label>'+
        '<span class="right" id="uCnt">0건</span>'+
      '</div>'+
      '<div class="up-prev" id="uPrev"></div>'+
    '</div>'+
    '<div class="mfoot"><button class="btn primary" id="uSave">저장</button>'+
    '<button class="btn" id="uCancel">닫기</button><span class="msg" id="uMsg"></span></div></div>';
  document.body.appendChild(mask);

  let parsed=[];
  const close=()=>mask.classList.remove('on');
  const setMsg=(t,k)=>{ const m=$('#uMsg',mask); m.className='msg'+(k?' '+k:''); m.textContent=t||''; };
  const reset=()=>{ parsed=[]; $('#uPrev',mask).innerHTML=''; $('#uCnt',mask).textContent='0건'; };
  $('#uX',mask).addEventListener('click',close);
  $('#uCancel',mask).addEventListener('click',close);
  mask.addEventListener('click',e=>{ if(e.target===mask) close(); });

  $('#uTpl',mask).addEventListener('click',async()=>{
    setMsg('양식 생성중...');
    const k=await makeTemplate(TITLE+'_양식',FS,[]);
    setMsg('✓ 빈 양식('+k+')을 내려받았습니다.','ok');
  });
  $('#uCur',mask).addEventListener('click',async()=>{
    const rows=getRows()||[];
    if(!rows.length) return setMsg('내려받을 조회 자료가 없습니다. 먼저 [조회] 하세요.','err');
    setMsg('생성중...');
    const k=await makeTemplate(TITLE+'_'+new Date().toISOString().slice(0,10),FS,rows);
    setMsg('✓ 현재자료 '+rows.length+'건을 '+k+'로 내려받았습니다. 수정 후 그대로 업로드하세요.','ok');
  });

  /* --- 파일 선택 / 드래그앤드롭 --- */
  const drop=$('#uDrop',mask), fin=$('#uFile',mask);
  drop.addEventListener('click',()=>fin.click());
  fin.addEventListener('change',()=>{ if(fin.files[0]) handle(fin.files[0]); });
  ['dragenter','dragover'].forEach(t=>drop.addEventListener(t,e=>{ e.preventDefault(); drop.classList.add('on'); }));
  ['dragleave','drop'].forEach(t=>drop.addEventListener(t,e=>{ e.preventDefault(); drop.classList.remove('on'); }));
  drop.addEventListener('drop',e=>{ const f=e.dataTransfer.files[0]; if(f) handle(f); });

  async function handle(file){
    reset(); $('#uDropTxt',mask).innerHTML='📄 <b>'+esc(file.name)+'</b>';
    setMsg('파일을 읽는 중...');
    try{
      const aoa=await readSheet(file);
      build(aoa);
    }catch(e){ setMsg('❌ '+e.message,'err'); }
    fin.value='';
  }
  function build(aoa){
    const rows=(aoa||[]).filter(r=>r&&r.some(c=>String(c==null?'':c).trim()!==''));
    if(!rows.length) return setMsg('❌ 내용이 없는 파일입니다.','err');
    /* 머리글 인식 → 열 매핑 (없으면 정의 순서대로) */
    const h=rows[0].map(normKey);
    const map=FS.map(f=>{
      let i=h.indexOf(normKey(f[1])); if(i<0) i=h.indexOf(normKey(f[0]));
      return i;
    });
    const hasHead=map.filter(i=>i>=0).length >= Math.max(1,Math.ceil(FS.length*0.5));
    const idx=hasHead?map:FS.map((f,i)=>i);
    const body=rows.slice(hasHead?1:0);
    const miss=hasHead?FS.filter((f,i)=>map[i]<0&&f[4]==='req').map(f=>f[1]):[];
    if(miss.length) return setMsg('❌ 필수 열이 없습니다 : '+miss.join(', '),'err');

    parsed=body.map(cells=>{
      const o={body:{},err:[],warn:[],cells:[]};
      FS.forEach((f,i)=>{
        const raw = idx[i]>=0 ? cells[idx[i]] : '';
        const r=ucell(f,raw);
        o.body[f[0]]=r.v;
        o.cells.push({t:(raw instanceof Date)?dstr(raw):String(raw==null?'':raw).trim(), e:!!r.e});
        if(r.e) o.err.push(r.e);
        if(r.w) o.warn.push(r.w);
      });
      if(!E.auto && (o.body[E.pk]==null||o.body[E.pk]==='')) o.err.push(E.pk+' 없음');
      return o;
    });
    if(!E.auto){
      const seen={};
      parsed.forEach(o=>{
        const k=String(o.body[E.pk])+(E.pk2?'|'+o.body[E.pk2]:'');
        if(seen[k]) o.err.push('파일 내 중복키'); seen[k]=1;
      });
    }
    render(hasHead);
  }
  function render(hasHead){
    const box=$('#uPrev',mask), ng=parsed.filter(o=>o.err.length).length;
    $('#uCnt',mask).textContent=parsed.length+'건'+(ng?' (오류 '+ng+')':'');
    if(!parsed.length){ box.innerHTML='<div class="up-empty">읽어들인 자료가 없습니다.</div>'; return; }
    const head='<tr><th style="width:34px">#</th>'+FS.map(f=>'<th>'+esc(f[1])+'</th>').join('')+
               '<th style="width:150px">검증</th></tr>';
    const body=parsed.slice(0,200).map((o,i)=>
      '<tr class="'+(o.err.length?'bad':'')+'"><td class="center">'+(i+1)+'</td>'+
      o.cells.map(c=>'<td class="'+(c.e?'cell-bad':'')+'">'+esc(c.t)+'</td>').join('')+
      '<td>'+(o.err.length?'<span class="badge b-late">'+esc(o.err.join(', '))+'</span>':
              o.warn.length?'<span class="badge b-wait">'+esc(o.warn.join(', '))+'</span>':
              '<span class="badge b-done">OK</span>')+'</td></tr>').join('');
    box.innerHTML='<table class="grid up-grid"><thead>'+head+'</thead><tbody>'+body+'</tbody></table>'+
      (parsed.length>200?'<div class="up-empty">… 미리보기는 200행까지 표시됩니다.</div>':'');
    setMsg((hasHead?'':'머리글을 찾지 못해 열 순서대로 읽었습니다. ')+
           (ng?'❌ 오류 '+ng+'건 — 파일 수정 후 다시 업로드하세요.':'✓ 검증 완료 · 저장 가능'), ng?'err':'ok');
  }

  $('#uSave',mask).addEventListener('click',async()=>{
    if(!parsed.length) return setMsg('업로드된 자료가 없습니다.','err');
    const ng=parsed.filter(o=>o.err.length);
    if(ng.length) return setMsg('❌ 오류 '+ng.length+'건이 있어 저장할 수 없습니다.','err');
    if(!confirm(parsed.length+'건을 저장하시겠습니까?')) return;
    const rows=parsed.map(o=>Object.assign({},E.fixed||{},o.body)), N=200; let done=0;
    const upok=$('#uUp',mask).checked;
    setMsg('저장중...');
    try{
      for(let i=0;i<rows.length;i+=N){
        const part=rows.slice(i,i+N);
        if(E.auto){
          /* 번호가 비어있으면 신규(자동채번), 번호가 있으면 갱신 */
          const nw=part.filter(r=>r[E.pk]==null).map(r=>{ const c=Object.assign({},r); delete c[E.pk]; return c; });
          const ex=part.filter(r=>r[E.pk]!=null);
          if(nw.length) await ins(E.table,nw);
          if(ex.length) await (upok?upsert(E.table,ex):ins(E.table,ex));
        }
        else if(upok) await upsert(E.table,part);
        else          await ins(E.table,part);
        done+=part.length; setMsg('저장중... '+done+'/'+rows.length);
      }
      reset(); $('#uDropTxt',mask).innerHTML='파일을 이곳에 끌어놓거나 <b>클릭</b>하여 선택';
      close(); await onSaved(done);
    }catch(e){ setMsg('❌ '+e.message+' (저장 '+done+'건까지 반영)','err'); }
  });

  return {open:()=>{ setMsg(''); mask.classList.add('on'); }, close:close};
}

/* ---------- 그리드 화면 ---------- */
async function grid(id, need){
  if(!await guard(id))return;
  const cur=chrome(id), def=VIEWS[id];
  const acts=[['조회','primary',b=>run(b.target)]];
  if(def.edit){
    if(can(id,'save'))   acts.push(['등록','',()=>modal.open(null)]);
    if(can(id,'save'))   acts.push(['엑셀업로드','',()=>uploader.open()]);
    if(can(id,'edit'))   acts.push(['수정','',()=>{ if(!state.sel) return msg('수정할 행을 선택하세요.'); modal.open(state.sel); }]);
    if(can(id,'delete')) acts.push(['삭제','danger',()=>removeRow()]);
  }
  acts.push(['초기화','',()=>{ sp.querySelectorAll('input').forEach(i=>i.value=''); sp.querySelectorAll('select').forEach(s=>s.selectedIndex=0); }]);
  acts.push(['엑셀다운로드','',()=>csv(cur.it,def,state.rows)]);
  acts.push(['인쇄','',()=>window.print()]);
  const ui=page(cur,acts);
  const state={rows:[],sel:null};
  let modal=null, uploader=null;
  const editable = def.edit && (can(id,'save')||can(id,'edit'));
  if(editable) modal=makeModal(def, async(what)=>{ await run(null); msg('✓ '+what+'되었습니다.'); });
  if(def.edit && can(id,'save'))
    uploader=makeUpload(def, cur.it.n, ()=>state.rows, async(n)=>{
      await run(null); msg('✓ 엑셀 업로드 '+n+'건이 저장되었습니다.'); });
  async function removeRow(){
    if(!state.sel) return msg('삭제할 행을 선택하세요.');
    const E=def.edit, k=state.sel[E.pk];
    if(!confirm('선택한 항목('+k+')을 삭제하시겠습니까?'))return;
    let flt=E.pk+'=eq.'+encodeURIComponent(k);
    if(E.pk2) flt+='&'+E.pk2+'=eq.'+encodeURIComponent(state.sel[E.pk2]);
    try{ await del(E.table, flt); state.sel=null; await run(null); msg('✓ 삭제되었습니다.'); }
    catch(e){ msg('❌ '+e.message); }
  }
  await masters(need);

  if(def.note){
    const nt=el('div','note'); nt.innerHTML=def.note; ui.pg.appendChild(nt);
  }
  const sp=searchPanel(def); ui.pg.appendChild(sp);
  const gw=el('div','grid-wrap');
  const tb=el('div','grid-tb');
  /* 현재 위치 표시 : 모듈 - 화면명 - 실행버튼 (마우스 오버 시 원본 테이블명) */
  const qa=new URLSearchParams(location.search).get('act');
  const src=el('span','crumb', cur.modName+' - '+cur.it.n+' - '+(qa||'조회'));
  src.title=def.table;
  const cnt=el('span','right','총 0건');
  tb.appendChild(src); tb.appendChild(cnt); gw.appendChild(tb);
  const tbl=el('table','grid'), thead=el('thead'), tr=el('tr');
  def.cols.forEach(c=>{ const th=el('th',null,c[0]); if(c[1])th.style.width=c[1]+'px'; tr.appendChild(th); });
  if(def.jump){ const th=el('th',null,'이동'); th.style.width='80px'; tr.appendChild(th); }
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody=el('tbody'); tbl.appendChild(tbody); gw.appendChild(tbl); ui.pg.appendChild(gw);

  /* 표 안내문 (행이 없을 때만) — 상태바 메시지는 msg() 사용 */
  function hint(t){ tbody.innerHTML=''; const r=el('tr'),d=el('td','center',t);
    d.colSpan=def.cols.length+(def.jump?1:0); d.style.cssText='color:#8894a0;height:60px'; r.appendChild(d); tbody.appendChild(r); }

  async function run(btn){
    const old=btn?btn.textContent:''; if(btn){btn.textContent='조회중...';btn.disabled=true;}
    hint('조회중...');
    try{
      let q=def.table+'?select=*'+(def.where?'&'+def.where:'')+(def.order?'&order='+def.order:'')+'&limit=5000';
      let rows=await get(q);
      rows = def.post ? POST[def.post](rows) : rows.map((r,i)=>Object.assign({_i:i+1},r));
      rows = applyFilter(rows, filters(sp));
      state.rows=rows; tbody.innerHTML='';
      if(!rows.length) hint('조회 결과가 없습니다');
      else rows.forEach(r=>{
        const t=el('tr');
        def.cols.forEach(c=>{ const td=el('td',c[2]||''); td.innerHTML=cell(r,c); td.title=td.textContent; t.appendChild(td); });
        if(def.jump){
          const td=el('td','center'); const b=el('button',null,def.jump[0]);
          b.style.cssText='height:21px;padding:0 8px;border:1px solid #2e77bd;background:#2e77bd;color:#fff;border-radius:2px;font-size:11px;font-weight:700;cursor:pointer';
          b.addEventListener('click',ev=>{ ev.stopPropagation(); location.href=def.jump[1](r); });
          td.appendChild(b); t.appendChild(td);
        }
        t.addEventListener('click',()=>{ tbody.querySelectorAll('tr.sel').forEach(x=>x.classList.remove('sel')); t.classList.add('sel'); state.sel=r; });
        if(editable && can(id,'edit')) t.addEventListener('dblclick',()=>modal.open(r));
        tbody.appendChild(t);
      });
      cnt.textContent='총 '+rows.length.toLocaleString()+'건';
      msg(cur.path+' — '+rows.length.toLocaleString()+'건 조회되었습니다.');
    }catch(e){ hint('❌ '+e.message); msg('❌ '+e.message); cnt.textContent='총 0건'; }
    if(btn){btn.textContent=old;btn.disabled=false;}
  }
  /* 자동 조회 여부 : def.manual 또는 전역 CFG.MANUAL_QUERY 이면 [조회] 클릭 시에만 */
  if(def.manual || C.MANUAL_QUERY){
    hint('검색 조건을 지정한 뒤 상단 [조회] 버튼을 누르세요.');
    cnt.textContent='총 -건';
    msg(cur.path+' — 조회 조건을 지정하세요.');
  }else run(null);
}
function csv(cur,def,rows){
  if(!rows||!rows.length){ alert('내보낼 데이터가 없습니다.'); return; }
  const head=def.cols.map(c=>c[0]);
  const body=rows.map(r=>def.cols.map(c=>'"'+String(r[c[3]]==null?'':r[c[3]]).replace(/"/g,'""')+'"').join(','));
  const a=el('a'); a.href=URL.createObjectURL(new Blob(['\ufeff'+head.join(',')+'\n'+body.join('\n')],{type:'text/csv'}));
  a.download=cur.n+'_'+new Date().toISOString().slice(0,10)+'.csv'; a.click(); URL.revokeObjectURL(a.href);
}

return {CFG:C, $:$, el:el, esc:esc,
        get:get, ins:ins, upd:upd, del:del, upsert:upsert, adminFn:adminFn,
        signIn:signIn, signOut:signOut, logout:logout, refresh:refresh,
        changePassword:changePassword, loadSess:loadSess, loadMe:loadMe,
        me:()=>ME, loginError:loginError, isAdmin:isAdmin, clearCache:cacheClear, can:can, session:session, guard:guard,
        header:chrome, chrome:chrome, page:page, masters:masters, M:M, msg:msg,
        grid:grid, csv:csv, makeUpload:makeUpload, POST:POST, cell:cell, LK:LK, emailOf:emailOf,
        isPhone:isPhone, openPop:openPop};
})();
