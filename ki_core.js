/* ============================================================
   KI MES 공통 코어 : 인증 · 헤더 · Supabase · 그리드 엔진
============================================================ */
const KI = (function(){
const C = KI_CFG;
const HDR = {apikey:C.SUPABASE_KEY, Authorization:'Bearer '+C.SUPABASE_KEY};
const LK = {auth:'ki_session', fail:'ki_pin_fail', pin:'ki_pin_cache', recent:'ki_recent'};
const K_MASTER='pin_master', K_USER='pin_user';

const $  = (s,r)=>(r||document).querySelector(s);
const el = (t,c,x)=>{const e=document.createElement(t); if(c)e.className=c; if(x!=null)e.textContent=x; return e;};
const esc= s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- Supabase ---------- */
async function get(path){
  const r=await fetch(C.SUPABASE_URL+'/rest/v1/'+path,{headers:HDR});
  if(!r.ok) throw new Error('조회 실패 ('+r.status+')');
  return await r.json();
}
async function upsert(table,body){
  const r=await fetch(C.SUPABASE_URL+'/rest/v1/'+table,{method:'POST',
    headers:Object.assign({'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},HDR),
    body:JSON.stringify(body)});
  if(!r.ok) throw new Error('저장 실패 ('+r.status+')');
  return await r.json();
}

/* ---------- 인증 ---------- */
async function sha256(t){
  const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function session(){
  try{ const s=JSON.parse(localStorage.getItem(LK.auth)||'null');
    if(!s||!s.exp||s.exp<Date.now()){localStorage.removeItem(LK.auth);return null;} return s;
  }catch(e){return null}
}
function setSession(o){ o.exp=Date.now()+C.SESSION_DAYS*864e5; localStorage.setItem(LK.auth,JSON.stringify(o)); }
function logout(){ localStorage.removeItem(LK.auth); location.href='index.html'; }
function pinCache(){ try{return JSON.parse(localStorage.getItem(LK.pin)||'{}')}catch(e){return{}} }
async function loadPins(){
  try{
    const rows=await get(OBJ.settings+'?select=key,value&key=in.('+K_MASTER+','+K_USER+')');
    const o={}; rows.forEach(r=>o[r.key]=r.value);
    if(o[K_MASTER]&&o[K_USER]){ localStorage.setItem(LK.pin,JSON.stringify(o)); return o; }
  }catch(e){}
  const c=pinCache(); if(c[K_MASTER]&&c[K_USER]) return c;
  const d=await sha256(C.DEFAULT_PIN); return {[K_MASTER]:d,[K_USER]:d};
}
async function savePin(key,hash,who){
  await upsert(OBJ.settings,[{key:key,value:hash,updated_at:new Date().toISOString(),updated_by:who||'-'}]);
  const c=pinCache(); c[key]=hash; localStorage.setItem(LK.pin,JSON.stringify(c));
}
async function isDefaultPin(){
  const d=await sha256(C.DEFAULT_PIN), p=await loadPins();
  return {master:p[K_MASTER]===d, user:p[K_USER]===d};
}
function guard(){                       // 로그인 안 되어 있으면 홈으로
  if(session()) return true;
  location.href='index.html?r='+encodeURIComponent(location.pathname.split('/').pop());
  return false;
}

/* ---------- 화면 크롬 (1차 모듈 / 2차 아이콘 / 좌측 트리 / 상태바) ---------- */
const LK_LEFT='ki_left_w';
function chrome(curId){
  const cur = FLAT[curId] || FLAT[Object.keys(FLAT)[0]];
  const it  = cur.it;
  document.title = C.APP_NAME+' - '+it.n;

  /* 1차 */
  const t1=el('div','top1');
  t1.innerHTML =
    '<a class="logo" href="'+(KI_CFG.LANDING||'mold_due.html')+'"><b>KI</b>MES<i>(Mold)</i></a>'+
    '<nav class="modules" id="kiMod"></nav>'+
    '<div class="user">'+
      '<button class="mini" id="kiUser">👤</button>'+
      '<button class="mini" id="kiOut">🔒</button>'+
      '<span class="dot" id="kiDot"></span><span id="kiNet">Connected</span><span id="kiClock"></span>'+
    '</div>';
  document.body.appendChild(t1);

  /* 2차 */
  const t2=el('div','top2'); t2.id='kiSec'; document.body.appendChild(t2);

  /* 좌측 트리 */
  const lf=el('div','left');
  lf.innerHTML='<div class="tree-top"><input id="kiFind" placeholder="🔍 메뉴 검색 (Ctrl+K)"></div>'+
               '<div class="tree" id="kiTree"></div>'+
               '<div class="left-foot" id="kiFoot">⚙ '+esc(cur.modName)+'</div>';
  document.body.appendChild(lf);

  const sepr=el('div','splitter'); sepr.id='kiSplit';
  sepr.title='드래그: 창 폭 조절 / 더블클릭: 기본값(300px)';
  document.body.appendChild(sepr);

  /* 상태바 */
  const st=el('div','status');
  const s=session();
  st.innerHTML='<span id="kiTime"></span>'+
    '<span class="msg" id="kiMsg">'+esc(cur.path)+'</span>'+
    '<span class="right">'+esc(s?(s.role==='admin'?'관리자':'사용자'):'-')+' · '+C.APP_NAME+' '+C.VER+'</span>';
  document.body.appendChild(st);

  /* --- 렌더 --- */
  let curMod=cur.mod, curSec=cur.sec;
  const mod=()=>MENU.find(m=>m.key===curMod)||MENU[0];
  const sec=()=>mod().second.find(x=>x.key===curSec)||mod().second[0];

  function drawMod(){
    $('#kiMod').innerHTML = MENU.map(m=>
      '<button class="module'+(m.key===curMod?' on':'')+'" data-k="'+m.key+'">'+esc(m.name)+'</button>').join('');
    $('#kiMod').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
      curMod=b.dataset.k; curSec=mod().second[0].key; drawMod(); drawSec(); drawTree();
      $('#kiFoot').textContent='⚙ '+mod().name;
    }));
  }
  function drawSec(){
    $('#kiSec').innerHTML = mod().second.map(x=>
      '<button class="tool'+(x.key===curSec?' on':'')+'" data-k="'+x.key+'">'+
      '<span class="ico">'+x.icon+'</span><span>'+esc(x.name)+'</span></button>').join('');
    $('#kiSec').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
      curSec=b.dataset.k; drawSec(); drawTree();
    }));
  }
  function drawTree(q){
    const box=$('#kiTree');
    if(q){                                   /* 검색 : 전 모듈 평면 결과 */
      const hit=Object.keys(FLAT).map(k=>FLAT[k])
        .filter(f=>(f.it.n+' '+(f.it.d||'')+' '+f.path).toLowerCase().includes(q));
      box.innerHTML = hit.length
        ? '<div class="group"><div class="group-title">검색결과 '+hit.length+'건</div>'+
          hit.map(f=>'<a class="item'+(f.it.id===curId?' on':'')+'" href="'+f.it.f+'">'+esc(f.it.n)+
                     '<small>'+esc(f.path)+'</small></a>').join('')+'</div>'
        : '<div style="padding:16px;color:#7a8793">검색 결과가 없습니다.</div>';
      return;
    }
    box.innerHTML = sec().groups.map(g=>
      '<div class="group"><div class="group-title">'+esc(g.name)+'</div>'+
      g.items.map(x=>'<a class="item'+(x.id===curId?' on':'')+'" href="'+x.f+'" title="'+esc(x.d||'')+'">'+
        esc(x.n)+'<small>'+esc(x.d||'')+'</small></a>').join('')+'</div>').join('');
  }
  drawMod(); drawSec(); drawTree();

  const find=$('#kiFind');
  find.addEventListener('input',e=>drawTree(e.target.value.trim().toLowerCase()));
  document.addEventListener('keydown',e=>{
    if(e.ctrlKey&&e.key.toLowerCase()==='k'){ e.preventDefault(); find.focus(); find.select(); }
    if(e.key==='Escape'&&document.activeElement===find){ find.value=''; drawTree(); find.blur(); }
  });

  /* --- 스플리터 --- */
  (function(){
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
  $('#kiUser').textContent='👤 '+(s?(s.role==='admin'?'관리자':'사용자'):'-');
  $('#kiUser').addEventListener('click',()=>{ if(!s)return;
    alert('👤 '+(s.role==='admin'?'관리자 (마스터 PIN)':'사용자 (일반 PIN)')+
          '\n⏱ 자동 잠금까지: '+Math.max(0,Math.ceil((s.exp-Date.now())/864e5))+'일'); });
  $('#kiOut').addEventListener('click',()=>{ if(confirm('로그아웃 하시겠습니까?')) logout(); });

  const tick=()=>{ const d=new Date();
    $('#kiClock').textContent=d.toLocaleString('ko-KR',{hour12:false,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
    $('#kiTime').textContent=d.toLocaleString('sv-SE',{hour12:false}).replace(',',''); };
  tick(); setInterval(tick,1000);
  const net=async()=>{ let ok=true; try{ await get(OBJ.settings+'?select=key&limit=1'); }catch(e){ ok=false; }
    $('#kiDot').classList.toggle('off',!ok); $('#kiNet').textContent=ok?'Connected':'Offline'; };
  net(); setInterval(net,120000);
  return cur;
}
function msg(t){ const m=$('#kiMsg'); if(m)m.textContent=t; }
const header = chrome;                       /* 하위 호환 */

function page(cur, actions){
  const it = cur.it || cur;
  const ws=el('div','workspace'), pg=el('div','page');
  const h=el('div','pg-head');
  h.innerHTML='<h2>'+esc(it.n)+'</h2><span class="sub">'+esc(it.d||'')+'</span>';
  const act=el('div','pg-act');
  (actions||[]).forEach(([label,cls,fn])=>{ const b=el('button','btn'+(cls?' '+cls:''),label);
    b.addEventListener('click',fn); act.appendChild(b); });
  h.appendChild(act); pg.appendChild(h); ws.appendChild(pg); document.body.appendChild(ws);
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
  let best=null,bs=-1;
  M.routes.forEach(rt=>{
    const st=Array.isArray(rt.steps)?rt.steps:[]; let hit=0,pos=0;
    mps.forEach(m=>{ const k=st.indexOf(m,pos); if(k>=0){hit++;pos=k+1;} });
    const sc=hit*100-st.length;
    if(hit>0&&sc>bs){ bs=sc; best=rt; }
  });
  return best;
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
        vendor:s.vendor,date:s.date,prevMp:i>0?st[i-1].mp:'-',nextMp:i<st.length-1?st[i+1].mp:'-',chain:chain}));
    });
    out.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    out.forEach((r,i)=>r._i=i+1); return out;
  },
  route: rows=>rows.map((r,i)=>{
    const st=Array.isArray(r.steps)?r.steps:[], last=st[st.length-1]||{};
    const rt=matchRoute(st.map(s=>s.mp)), sd=rt?rt.steps:[];
    const total=sd.length||st.length||1, done=Math.min(st.length,total), nx=sd[done]||'';
    return {_i:i+1,job:r.job,part:r.part,proc:r.proc,mp:last.mp||'-',mpName:pName(last.mp),
      vendor:last.vendor||'-',date:last.date||'',stdName:rt?rt.standard_process_name:'(미매칭)',
      nextMp:nx?nx+(pName(nx)?' · '+pName(nx):''):'완료',
      done:done,total:total,_rate:total?Math.round(done/total*100):0,
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

/* ---------- 그리드 화면 ---------- */
async function grid(id, need){
  if(!guard())return;
  const cur=chrome(id), def=VIEWS[id];
  const ui=page(cur,[
    ['조회','primary',b=>run(b.target)],
    ['초기화','',()=>{ sp.querySelectorAll('input').forEach(i=>i.value=''); sp.querySelectorAll('select').forEach(s=>s.selectedIndex=0); }],
    ['엑셀(CSV)','',()=>csv(cur.it,def,state.rows)],
    ['인쇄','',()=>window.print()]
  ]);
  const state={rows:[]};
  await masters(need);

  if(def.note){
    const nt=el('div','note'); nt.innerHTML=def.note; ui.pg.appendChild(nt);
  }
  const sp=searchPanel(def); ui.pg.appendChild(sp);
  const gw=el('div','grid-wrap');
  const tb=el('div','grid-tb');
  const src=el('span',null,def.table); src.style.cssText='color:#94a1ae;font-size:10px';
  const cnt=el('span','right','총 0건');
  tb.appendChild(src); tb.appendChild(cnt); gw.appendChild(tb);
  const tbl=el('table','grid'), thead=el('thead'), tr=el('tr');
  def.cols.forEach(c=>{ const th=el('th',null,c[0]); if(c[1])th.style.width=c[1]+'px'; tr.appendChild(th); });
  thead.appendChild(tr); tbl.appendChild(thead);
  const tbody=el('tbody'); tbl.appendChild(tbody); gw.appendChild(tbl); ui.pg.appendChild(gw);

  function msg(t){ tbody.innerHTML=''; const r=el('tr'),d=el('td','center',t);
    d.colSpan=def.cols.length; d.style.cssText='color:#8894a0;height:60px'; r.appendChild(d); tbody.appendChild(r); }

  async function run(btn){
    const old=btn?btn.textContent:''; if(btn){btn.textContent='조회중...';btn.disabled=true;}
    msg('조회중...');
    try{
      let q=def.table+'?select=*'+(def.where?'&'+def.where:'')+(def.order?'&order='+def.order:'')+'&limit=5000';
      let rows=await get(q);
      rows = def.post ? POST[def.post](rows) : rows.map((r,i)=>Object.assign({_i:i+1},r));
      rows = applyFilter(rows, filters(sp));
      state.rows=rows; tbody.innerHTML='';
      if(!rows.length) msg('조회 결과가 없습니다');
      else rows.forEach(r=>{
        const t=el('tr');
        def.cols.forEach(c=>{ const td=el('td',c[2]||''); td.innerHTML=cell(r,c); td.title=td.textContent; t.appendChild(td); });
        t.addEventListener('click',()=>{ tbody.querySelectorAll('tr.sel').forEach(x=>x.classList.remove('sel')); t.classList.add('sel'); });
        tbody.appendChild(t);
      });
      cnt.textContent='총 '+rows.length.toLocaleString()+'건';
      msg(cur.path+' — '+rows.length.toLocaleString()+'건 조회되었습니다.');
    }catch(e){ msg('❌ '+e.message); cnt.textContent='총 0건'; }
    if(btn){btn.textContent=old;btn.disabled=false;}
  }
  run(null);
}
function csv(cur,def,rows){
  if(!rows||!rows.length){ alert('내보낼 데이터가 없습니다.'); return; }
  const head=def.cols.map(c=>c[0]);
  const body=rows.map(r=>def.cols.map(c=>'"'+String(r[c[3]]==null?'':r[c[3]]).replace(/"/g,'""')+'"').join(','));
  const a=el('a'); a.href=URL.createObjectURL(new Blob(['\ufeff'+head.join(',')+'\n'+body.join('\n')],{type:'text/csv'}));
  a.download=cur.n+'_'+new Date().toISOString().slice(0,10)+'.csv'; a.click(); URL.revokeObjectURL(a.href);
}

return {CFG:C, $:$, el:el, esc:esc, get:get, upsert:upsert, sha256:sha256,
        session:session, setSession:setSession, logout:logout, loadPins:loadPins, savePin:savePin,
        isDefaultPin:isDefaultPin, guard:guard, header:header, chrome:chrome, page:page,
        masters:masters, M:M, msg:msg,
        grid:grid, csv:csv, POST:POST, cell:cell, LK:LK};
})();
