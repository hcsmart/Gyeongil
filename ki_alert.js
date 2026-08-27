/* ============================================================
   GI MES 연마 · 교체 알림 (안돈 + ntfy)  — BASE
   사용 :  <script src="ki_alert.js"></script>
           KI_ALERT.start();          // 감시 시작 (안돈 배너 자동 표시)
           await KI_ALERT.scan();     // 1회 수동 점검
           KI_ALERT.onScan = rows=>{} // 결과 콜백 (화면에서 표 그리기)
============================================================ */
const KI_ALERT = (function(){
const T_ALERT = (typeof TBL!=='undefined' && TBL.toolAlert) || 'ki_tool_alert';
const V_DUE   = (typeof OBJ!=='undefined' && OBJ.toolDue)   || 'ki_v_tool_due';
const T_CFG   = (typeof TBL!=='undefined' && TBL.notifyCfg) || 'ki_notify_config';

let CFG=null, TIMER=null, LAST=[], BUSY=false;

/* ---------- 스타일 (1회 주입) ---------- */
function css(){
  if(document.getElementById('kiAndonCss'))return;
  const st=document.createElement('style'); st.id='kiAndonCss';
  st.textContent=
   '#kiAndon{position:fixed;left:0;right:0;bottom:0;z-index:900;display:none;'+
   'background:#b21f1f;color:#fff;font-size:13px;box-shadow:0 -2px 10px rgba(0,0,0,.25)}'+
   '#kiAndon.on{display:block}'+
   '#kiAndon.warn{background:#b06a12}'+
   '#kiAndon .ad-h{display:flex;align-items:center;gap:10px;padding:7px 14px;font-weight:800;letter-spacing:.5px}'+
   '#kiAndon .ad-h .lamp{width:12px;height:12px;border-radius:50%;background:#ffd9d9;'+
   'animation:kiBlink .9s steps(2,start) infinite}'+
   '@keyframes kiBlink{0%,100%{opacity:1}50%{opacity:.15}}'+
   '#kiAndon .ad-x{margin-left:auto;background:rgba(255,255,255,.18);border:0;color:#fff;'+
   'padding:3px 10px;cursor:pointer;font-weight:700}'+
   '#kiAndon .ad-b{max-height:132px;overflow:auto;padding:0 14px 9px;display:flex;flex-wrap:wrap;gap:6px}'+
   '#kiAndon .ad-i{background:rgba(0,0,0,.18);padding:4px 9px;white-space:nowrap}'+
   '#kiAndon .ad-i b{font-weight:800}';
  document.head.appendChild(st);
}

/* ---------- 설정 ---------- */
async function config(force){
  if(CFG&&!force)return CFG;
  try{ const r=await KI.get(T_CFG+'?select=*&id=eq.1&limit=1'); CFG=r[0]||{}; }
  catch(e){ CFG={}; }
  if(CFG.poll_sec==null) CFG.poll_sec=60;
  if(CFG.alert_level==null) CFG.alert_level='도래';
  return CFG;
}
async function saveConfig(body){
  body.updated_at=new Date().toISOString();
  const me=KI.me(); if(me) body.updated_by=me.emp_name||me.emp_no;
  await KI.upd(T_CFG,'id=eq.1',body);
  return config(true);
}

/* ---------- 도래 조회 ---------- */
async function due(levels){
  const lv=(levels||['도래','임박']).map(encodeURIComponent).join(',');
  return KI.get(V_DUE+'?select=*&due_status=in.('+lv+')'+
                '&order=due_status.asc,shot_pct.desc.nullslast&limit=500');
}

/* ---------- ntfy 발송 ---------- */
async function ntfy(title,message,priority,tags){
  const c=await config();
  if(!c.ntfy_enabled||!c.ntfy_url||!c.ntfy_topic) return false;
  try{
    const r=await fetch(String(c.ntfy_url).replace(/\/+$/,''),{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({topic:c.ntfy_topic, title:title, message:message,
        priority:priority||c.ntfy_priority||4, tags:tags||['warning']})
    });
    return r.ok;
  }catch(e){ return false; }
}
async function ntfyTest(){
  const c=await config(true);
  if(!c.ntfy_url||!c.ntfy_topic) return {ok:false,msg:'ntfy 서버 · 토픽을 먼저 입력하세요.'};
  const save=c.ntfy_enabled; c.ntfy_enabled=true;
  const ok=await ntfy('GI MES 알림 테스트',
    '연마 · 교체 알림 채널이 정상 연결되었습니다. ('+new Date().toLocaleString()+')',3,['white_check_mark']);
  c.ntfy_enabled=save;
  return {ok:ok, msg: ok?'ntfy 발송 성공 — 휴대폰 알림을 확인하세요.'
                       :'ntfy 발송 실패 — 서버 주소 · 토픽 · 네트워크를 확인하세요.'};
}

/* ---------- 알람 등록 (중복 방지) ---------- */
async function raise(rows){
  if(!rows.length) return 0;
  let open=[];
  try{
    open=await KI.get(T_ALERT+'?select=mold_code,kind,part_name,level&status=neq.'+
                      encodeURIComponent('해제')+'&limit=2000');
  }catch(e){ return 0; }
  const key=r=>[r.mold_code,r.kind,r.part_name||'공통',r.level||r.due_status].join('|');
  const has={}; open.forEach(o=>has[key(o)]=1);

  let n=0;
  for(const r of rows){
    if(has[key(r)]) continue;
    const msg=r.mold_code+' ('+(r.mold_name||'')+') '+r.kind+' '+r.due_status+
      ' — '+(r.reason==='기간'?('경과일 D'+(r.d_day<0?'+'+Math.abs(r.d_day):'-'+r.d_day))
                              :('누적 '+Number(r.used_shot||0).toLocaleString()+' / 한도 '+
                                Number(r.limit_shot||0).toLocaleString()+' ('+(r.shot_pct??0)+'%)'));
    try{
      await KI.ins(T_ALERT,[{
        mold_code:r.mold_code, kind:r.kind, part_name:r.part_name||'공통',
        level:r.due_status, reason:r.reason,
        shot_count:r.shot_count, limit_shot:r.limit_shot, used_shot:r.used_shot,
        days_left:r.d_day, message:msg, status:'발생'
      }]);
      has[key(r)]=1; n++;
      const ok=await ntfy('⚠ '+r.kind+' '+r.due_status+' — '+r.mold_code, msg,
                          r.due_status==='도래'?5:4,
                          r.due_status==='도래'?['rotating_light']:['warning']);
      if(ok) await KI.upd(T_ALERT,'mold_code=eq.'+encodeURIComponent(r.mold_code)+
                          '&kind=eq.'+encodeURIComponent(r.kind)+
                          '&status=neq.'+encodeURIComponent('해제'),
                          {notified:true, notified_at:new Date().toISOString()});
    }catch(e){ /* 동시 등록 충돌 등은 무시 */ }
  }
  return n;
}

/* ---------- 안돈 배너 ---------- */
function andon(rows){
  css();
  let box=document.getElementById('kiAndon');
  if(!box){
    box=document.createElement('div'); box.id='kiAndon';
    box.innerHTML='<div class="ad-h"><i class="lamp"></i><span id="kiAdT"></span>'+
                  '<button class="ad-x" type="button">닫기</button></div><div class="ad-b" id="kiAdB"></div>';
    document.body.appendChild(box);
    box.querySelector('.ad-x').addEventListener('click',()=>box.classList.remove('on'));
  }
  const hot=rows.filter(r=>r.due_status==='도래');
  const wrn=rows.filter(r=>r.due_status==='임박');
  if(!rows.length){ box.classList.remove('on'); return; }
  box.classList.toggle('warn', hot.length===0);
  document.getElementById('kiAdT').textContent=
    '연마 · 교체 알림 — 도래 '+hot.length+'건 / 임박 '+wrn.length+'건';
  document.getElementById('kiAdB').innerHTML=
    rows.slice(0,40).map(r=>'<span class="ad-i"><b>'+KI.esc(r.mold_code)+'</b> '+
      KI.esc(r.kind)+' '+KI.esc(r.due_status)+
      (r.shot_pct!=null?' '+r.shot_pct+'%':'')+
      (r.d_day!=null?' D'+(r.d_day<0?'+'+Math.abs(r.d_day):'-'+r.d_day):'')+'</span>').join('');
  box.classList.add('on');
}

/* ---------- 감시 ---------- */
async function scan(){
  if(BUSY) return LAST;
  BUSY=true;
  try{
    const c=await config();
    const levels = c.alert_level==='도래' ? ['도래'] : ['도래','임박'];
    LAST = await due(['도래','임박']);
    await raise(LAST.filter(r=>levels.indexOf(r.due_status)>=0));
    if(c.andon_enabled!==false) andon(LAST.filter(r=>levels.indexOf(r.due_status)>=0));
    if(typeof API.onScan==='function') API.onScan(LAST);
  }catch(e){ KI.msg&&KI.msg('❌ 알림 점검 실패 : '+e.message); }
  BUSY=false;
  return LAST;
}
function start(){
  stop();
  KI.loadSess&&KI.loadSess();
  scan();
  config().then(c=>{ TIMER=setInterval(scan, Math.max(15,Number(c.poll_sec)||60)*1000); });
}
function stop(){ if(TIMER){ clearInterval(TIMER); TIMER=null; } }

const API={ start:start, stop:stop, scan:scan, due:due, andon:andon,
            raise:raise, ntfy:ntfy, ntfyTest:ntfyTest,
            config:config, saveConfig:saveConfig,
            last:()=>LAST, onScan:null };
return API;
})();
