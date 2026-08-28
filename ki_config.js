/* ============================================================
   GI MES 공통 설정
   · 이전 시 아래 SUPABASE 2줄과 DB_PREFIX만 변경
============================================================ */
const KI_CFG = {
  APP_NAME : 'GI MES',
  VER      : 'v12.2',
  SUPABASE_URL : 'https://ipggvrzxfcryzryileuv.supabase.co',
  SUPABASE_KEY : 'sb_publishable_CHO-dAOU00HNwno52255mg_H3C1_vew',
  DB_PREFIX    : 'ki_',
  LANDING      : 'plan_board.html',   // 로그인 후 기본 화면
  AUTH_DOMAIN  : 'ki.local',        // 아이디 → 로그인 이메일 : <아이디>@ki.local
  ADMIN_FN     : 'ki-admin-user',   // 계정관리 Edge Function
  MIN_PW       : 6,   // Supabase Auth 기본 최소 길이
  MANUAL_QUERY : false, // true 면 모든 그리드 화면이 [조회] 클릭 시에만 데이터를 불러옴
  MAX_FAIL     : 5,
  LOCKOUT_SEC  : 60
};

/* --- DB 오브젝트 --- */
const P = KI_CFG.DB_PREFIX;
const TBL = {                      /* 편집 대상 원천 테이블 */
  mold:'ki_mold', inspItem:'ki_inspection_item', inspResult:'ki_inspection_result',
  inspDetail:'ki_inspection_detail',
  factory:'ki_factory', zone:'ki_zone', asset:'ki_asset',
  sensor:'ki_sensor', envAlert:'ki_env_alert', machine:'ki_machine',
  shotLedger:'ki_shot_ledger', gradeItem:'ki_grade_item',
  gradeEval:'ki_grade_eval', gradeEvalDet:'ki_grade_eval_detail',
  dailyItem:'ki_daily_item', dailyCheck:'ki_daily_check', dailyCheckDet:'ki_daily_check_detail',
  wash:'ki_wash', washStep:'ki_wash_step', inspPlan:'ki_insp_plan',
  cycleRule:'ki_cycle_rule', moldLoc:'ki_mold_location',
  toolRule:'ki_tool_rule', moldTool:'ki_mold_tool',
  toolAlert:'ki_tool_alert', notifyCfg:'ki_notify_config',
  moldType:'ki_mold_type', material:'ki_material',
  vendorT:'ki_vendor', stdRouteT:'machining_standard_routes',
  /* 외주 LOT (원천 테이블) */
  lotReceipt:'ki_lot_receipt', lotMove:'ki_lot_move',
  ospOrder:'outsourcing_order_status_rows',
  ospRecv :'outsourcing_receipt_confirm_candidates',
  lotProg :'machining_purchase_progress_rows'
};
const OBJ = {
  settings : P+'app_settings',
  /* 금형 정기점검 */
  moldDue  : P+'v_mold_due',   moldMst  : P+'v_mold',
  inspHist : P+'v_inspection_history', inspDet : P+'v_inspection_detail',
  checkLog : P+'v_check_log',
  inspItem : P+'v_inspection_item',
  /* 외주 LOT */
  ospOrder : P+'v_osp_order',  ospRecv  : P+'v_osp_receipt',
  lotProg  : P+'v_lot_progress', stdRoute: P+'v_std_route',
  lotReceipt : P+'v_lot_receipt', lotMove : P+'v_lot_move',
  vendor   : P+'v_vendor',     process  : P+'v_process',
  /* 트윈팩토리 */
  factory  : P+'v_factory',    zone     : P+'v_zone',
  asset    : P+'v_asset',      assetSt  : P+'v_asset_status',
  /* 온습도 */
  sensor   : P+'v_sensor',     envLive  : P+'v_env_latest',
  envHist  : P+'v_env_history',envAlert : P+'v_env_alert',
  /* 기준정보 — 생산기준 */
  moldSpec : P+'v_mold_master', moldType : P+'v_mold_type',
  material : P+'v_material',    machine  : P+'v_machine',
  /* 기준정보 — 점검기준 */
  chkMach  : P+'v_check_machine',
  cycleRule : P+'v_cycle_rule',
  moldLoc  : P+'v_mold_location',
  /* 연마 · 교체 주기 */
  toolRule : P+'v_tool_rule',  moldTool : P+'v_mold_tool',
  toolDue  : P+'v_tool_due',   toolAlert: P+'v_tool_alert',
  /* 수명관리 */
  shotLedger : P+'v_shot_ledger', gradeItem : P+'v_grade_item',
  gradeEval  : P+'v_grade_eval',  dailyItem : P+'v_daily_item',
  dailyCheck : P+'v_daily_check',
  wash       : P+'v_wash',        washStat : P+'v_wash_status',
  washStep   : P+'v_wash_step',   inspPlan : P+'v_insp_plan',
  /* 시스템 */
  employee : P+'v_employee',   permission : P+'v_permission'
};

/* ============================================================
   메뉴 구성 : 1차 모듈 > 2차 아이콘 > 그룹 > 화면(파일)
============================================================ */
const MENU = [
  { key:'mold', name:'금형관리', second:[

    { key:'m-plan', name:'점검계획', icon:'📅', groups:[
      { name:'점검계획', items:[
        {id:'plan-board', f:'plan_board.html', n:'점검 도래현황',
         d:'정기 · 세척 통합 → 클릭 시 등록'},
        {id:'plan-cal', f:'plan_board.html?view=plan', n:'점검 예측 · 계획표',
         d:'현재~선택연도 · 자동생성'}
      ]},
      { name:'연마 · 교체', items:[
        {id:'tool-due',   f:'tool_alert.html', n:'연마·교체 도래현황',
         d:'안돈 표시 · ntfy 알림'},
        {id:'tool-alarm', f:'tool_alarm.html', n:'연마·교체 알람이력',
         d:'발생 · 조치중 · 해제'}
      ]}
    ]},

    { key:'m-res', name:'점검등록', icon:'📋', groups:[
      { name:'점검 등록', items:[
        {id:'daily-check', f:'daily_check.html',     n:'일상점검 등록', d:'상형 8 / 하형 8 점검표'},
        {id:'mold-insp',   f:'mold_inspection.html', n:'정기점검 등록', d:'도래현황 · 점검항목 · 이력'},
        {id:'wash-check',  f:'wash_check.html',      n:'세척등록',     d:'일상 · 정기세척'}
      ]},
      { name:'실적 조회', items:[
        {id:'mold-detail', f:'mold_inspection_detail.html', n:'등록실적 조회', d:'항목별 측정값 · 판정'}
      ]}
    ]},

    { key:'m-eval', name:'금형평가', icon:'⏱', groups:[
      { name:'타발수 · 등급', items:[
        {id:'shot-ledger', f:'shot_ledger.html', n:'월별 타발수', d:'누적 SHOT · 연간 타발수 · 점수'},
        {id:'grade-eval',  f:'grade_eval.html',  n:'금형 등급평가', d:'13항목 · A/B/C/F 반영'}
      ]},
      { name:'금형 기준정보', items:[
        {id:'mold-master', f:'mold_master.html', n:'금형대장', d:'금형번호 · 등급 · 타발수 · 수명'}
      ]}
    ]}
  ]},

  { key:'osp', name:'LOT관리', second:[
    { key:'o-lot', name:'LOT 추적', icon:'🔎', groups:[
      { name:'추적', items:[
        {id:'lot-route', f:'lot_route.html', n:'LOT 진행등록',
         d:'진척 · 다음공정 반출 · 입고 등록'},
        {id:'lot-trace', f:'lot_trace.html', n:'LOT 이동이력', d:'외주업체 경유 이력'},
        {id:'lot-move',  f:'lot_move.html',  n:'QR 입출고 이력', d:'QR 스캔 · 부족수량 · 특기사항'}
      ]},
      { name:'현장 (QR)', items:[
        {id:'lot-scan',  f:'lot_scan.html',  n:'QR 입출고(현장)',
         d:'공정이동표 QR 스캔 — 출고 · 입고 · 특기사항'}
      ]}
    ]}
  ]},

  { key:'env', name:'온습도관리', second:[
    { key:'e-live', name:'모니터링', icon:'🌡', groups:[
      { name:'실시간', items:[
        {id:'env-live',  f:'env_live.html',    n:'실시간 현황', d:'센서 온습도 · 추이'},
        {id:'env-hist',  f:'env_history.html', n:'측정 이력',   d:'센서별 측정값'},
        {id:'env-alert', f:'env_alert.html',   n:'알람 이력',   d:'상·하한 이탈 알람'}
      ]}
    ]},
    { key:'e-base', name:'센서기준', icon:'📍', groups:[
      { name:'기준정보', items:[
        {id:'sensor', f:'sensor.html', n:'센서 마스터', d:'센서 · 임계치'}
      ]}
    ]}
  ]},

  { key:'base', name:'기준정보', second:[
    { key:'b-prod', name:'생산기준', icon:'▦', groups:[
      { name:'금형', items:[
        {id:'mold-spec', f:'mold_spec.html',     n:'금형정보',     d:'금형 등록·수정·삭제'},
        {id:'mold-type', f:'mold_type.html',     n:'금형타입',     d:'타입 코드 · 명칭'},
        {id:'material',  f:'material.html',      n:'소재 비중정보', d:'소재코드 · 비중'},
        {id:'mold-loc',  f:'mold_location.html', n:'금형 보관장소', d:'보관장소 코드 · 명칭'},
        {id:'tool-rule', f:'tool_rule.html',     n:'연마/교체주기설정',
         d:'공통 기준 — 타발수 한도 · 기간'},
        {id:'tool-mold', f:'tool_rule.html?view=ind', n:'금형별 연마/교체주기',
         d:'개별 설정 · 미설정 시 공통 적용'}
      ]},
      { name:'설비', items:[
        {id:'machine',   f:'machine.html',   n:'호기설정', d:'호기번호 · 호기명'}
      ]}
    ]},
    { key:'b-osp', name:'외주기준', icon:'↔', groups:[
      { name:'외주 기준정보', items:[
        {id:'vendor',    f:'vendor.html',    n:'협력사 정보',   d:'외주 가공 · 연락처 · 담당공정'},
        {id:'std-route', f:'std_route.html', n:'표준 공정경로', d:'표준공정 가공순서'}
      ]}
    ]},
    { key:'b-chk', name:'점검기준', icon:'🔧', groups:[
      { name:'금형 · 주기 기준', items:[
        {id:'cycle-rule', f:'cycle_rule.html', n:'점검주기 기준', d:'정기(등급별) · 세척(타발수/기간)'}
      ]},
      { name:'금형 · 점검항목 기준', items:[
        {id:'insp-item',  f:'inspection_item.html', n:'정기점검 항목', d:'분류 · 방법 · 판정기준'},
        {id:'daily-item', f:'daily_item.html',      n:'일상점검 항목', d:'상형 8 / 하형 8'},
        {id:'wash-step',  f:'wash_step.html',       n:'세척항목(순서)', d:'정기세척 6항목'}
      ]},
      { name:'금형 · 평가 기준', items:[
        {id:'grade-item', f:'grade_item.html', n:'등급 평가항목', d:'13항목 · 배점'}
      ]},
      { name:'설비 점검기준', items:[
        {id:'chk-mach', f:'check_machine.html', n:'설비 점검기준', d:'일상 · 정기 점검항목 / 판정기준'}
      ]}
    ]}
  ]},

  { key:'sys', name:'시스템', second:[
    { key:'s-sys', name:'시스템', icon:'⚙', groups:[
      { name:'시스템', items:[
        {id:'settings',  f:'settings.html',  n:'비밀번호 설정', d:'마스터 / 사용자 PIN'},
        {id:'user-info', f:'user_info.html', n:'사용자정보',   d:'사용자 등록 · 권한 매트릭스'},
        {id:'notify-cfg',f:'notify_config.html', n:'알림 설정(ntfy)', d:'안돈 · ntfy 서버 · 토픽'}
      ]}
    ]}
  ]}
];

/* 화면 id → {item, 모듈, 2차, 경로} 색인 */
const FLAT = {};
MENU.forEach(m1=>m1.second.forEach(m2=>m2.groups.forEach(g=>g.items.forEach(it=>{
  FLAT[it.id] = {it:it, mod:m1.key, sec:m2.key, modName:m1.name, secName:m2.name,
                 path:m1.name+' › '+m2.name+' › '+it.n};
}))));

/* ============================================================
   화면 정의 (그리드)
   cols : [라벨, 폭(0=가변), class, 필드, 렌더타입]
   search: [라벨, 종류, 필드]
============================================================ */
const VIEWS = {
'mold-insp':{
  table:OBJ.inspHist, order:'inspection_date.desc',
  edit:{ table:TBL.inspResult, pk:'inspection_no', auto:true, fields:[
    ['mold_code','금형코드','ref',{table:OBJ.moldMst,v:'mold_code',t:'mold_name'},'req'],
    ['inspection_date','점검일','date',null,'req'],
    ['inspector','점검자','text',null,'req'],
    ['shot_count','타발수','num'],
    ['judgement','판정','sel',['합격','조건부합격','불합격'],'req'],
    ['defect_count','부적합 건수','num',{def:0}],
    ['action_taken','조치내용','area'],
    ['next_inspection','다음 점검예정','date'],
    ['remark','비고','area']
  ]},
  search:[['금형코드','text','mold_code'],['금형명','text','mold_name'],['점검자','text','inspector'],
          ['판정','sel-judge','judgement'],['점검일','date2','inspection_date'],['고객사','text','customer_name']],
  cols:[['점검번호',72,'center','inspection_no'],['점검일',92,'center','inspection_date'],
        ['금형코드',92,'','mold_code'],['금형명',150,'','mold_name'],['고객사',100,'','customer_name'],
        ['점검자',80,'center','inspector'],['타발수',96,'num','shot_count','n0'],
        ['판정',90,'center','judgement','st'],['부적합',64,'num','defect_count'],
        ['조치내용',170,'','action_taken'],['다음점검',92,'center','next_inspection'],['비고',0,'','remark']]
},
'mold-detail':{
  manual:true,
  table:OBJ.checkLog, order:'check_date.desc,ref_no.desc',
  note:'일상 · 정기 · 세척 점검의 <b>항목별 실적</b>을 한 화면에서 조회합니다. 점검 종류로 필터링하세요.',
  search:[['점검종류','sel-ckind','kind'],['품번','text','mold_code'],['점검항목','text','item_name'],
          ['점검일','date','check_date'],['결과','sel-ckres','result'],['금형명','text','mold_name']],
  cols:[['종류',60,'center','kind','st'],['번호',60,'center','ref_no'],['점검일',92,'center','check_date'],
        ['품번',92,'','mold_code'],['금형명',140,'','mold_name'],
        ['항목코드',80,'center','item_code'],['점검항목',200,'','item_name'],
        ['기준',150,'','criteria'],['측정값 · 메모',130,'','value_note'],
        ['결과',76,'center','result','st'],['담당',80,'center','worker'],['비고',0,'','remark']]
},
'mold-master':{
  table:OBJ.moldMst, order:'mold_code.asc',
  note:'금형번호 · 금형종류는 <b>기준정보 › 생산기준 › 금형정보</b>에서 관리하며 여기서는 수정할 수 없습니다. '+
       '등급 · 타발수 · 보관장소 · 점검주기 등 운영 항목만 수정됩니다.',
  edit:{ table:TBL.mold, pk:'mold_code', fields:[
    ['mold_code','금형코드(품번)','text',null,'req'],
    ['mold_no','금형번호','text',null,'ro'],
    ['mold_type','금형종류','sel',['프로그레시브','트랜스퍼','단발','SEMI+단발','TPL','TR'],'ro'],
    ['grade','등급','sel',['A','B','C','F']],
    ['prod_type','생산구분','sel',['양산','A/S'],{def:'양산'}],
    ['machine_no','사용기계','ref',{table:OBJ.machine,v:'machine_no',t:'machine_name'}],
    ['mold_name','금형명','text',null,'req'],
    ['customer_name','고객사','text'],
    ['model','모델','text'],
    ['factory_code','공장','ref',{table:OBJ.factory,v:'factory_code',t:'factory_name'}],
    ['location','보관장소','ref',{table:OBJ.moldLoc,v:'location_code',t:'location_name'}],
    ['shot_count','타발수','num'],
    ['shot_limit','수명(SHOT)','num'],
    ['cycle_days','점검주기(일)','num',{def:90}],
    ['last_inspection','최근점검','date'],
    ['next_inspection','점검예정','date'],
    ['status','상태','sel',['정상','주의','점검필요','폐기']],
    ['remark','비고','area']
  ]},
  search:[['금형코드','text','mold_code'],['금형명','text','mold_name'],['고객사','text','customer_name'],
          ['금형종류','text','mold_type'],['상태','sel-mst','status'],['보관장소','text','location']],
  cols:[['금형코드',92,'','mold_code'],['금형번호',86,'center','mold_no'],['등급',52,'center','grade','grade'],
        ['금형명',150,'','mold_name'],['고객사',100,'','customer_name'],
        ['모델',90,'','model'],['금형종류',100,'center','mold_type'],['공장',60,'center','factory_code'],
        ['보관장소',110,'','location'],['타발수',96,'num','shot_count','n0'],['수명',96,'num','shot_limit','n0'],
        ['주기(일)',64,'num','cycle_days'],['최근점검',92,'center','last_inspection'],
        ['점검예정',92,'center','next_inspection'],['상태',70,'center','status','st'],['비고',0,'','remark']]
},
'insp-item':{
  table:OBJ.inspItem, order:'sort_order.asc',
  edit:{ table:TBL.inspItem, pk:'item_code', fields:[
    ['item_code','항목코드','text',null,'req'],
    ['item_name','점검항목','text',null,'req'],
    ['category','분류','sel',['외관','기구','윤활','전장','이력']],
    ['method','점검방법','sel',['육안','측정','토크','카운터','통전']],
    ['criteria','기준','area'],
    ['unit','단위','sel',['-','mm','N·m','SHOT','%']],
    ['sort_order','순서','num'],
    ['is_active','사용','bool']
  ]},
  search:[['항목코드','text','item_code'],['점검항목','text','item_name'],['분류','text','category']],
  cols:[['항목코드',80,'center','item_code'],['점검항목',180,'','item_name'],['분류',80,'center','category'],
        ['점검방법',90,'center','method'],['기준',220,'','criteria'],['단위',60,'center','unit'],
        ['순서',56,'num','sort_order'],['사용',56,'center','is_active','bool']]
},

'lot-trace':{
  manual:true,
  table:OBJ.lotProg, order:'no.asc', post:'trace',
  search:[['LOT','text','part'],['매칭품번','text','map_part'],['JOB(관리번호)','text','job'],
          ['외주처','sel-vendor','vendor'],['가공공정','sel-mp','mp'],['이동일','date2','date'],
          ['공정','text','proc']],
  cols:[['No',46,'center','_i'],['순번',48,'center','seq'],['JOB(관리번호)',118,'','job'],
        ['LOT',110,'','part'],['매칭품번',110,'','map_part'],['공정',50,'center','proc'],
        ['가공공정',72,'center','mp'],['가공공정명',130,'','mpName'],
        ['외주업체',130,'','vendor'],['이동일',90,'center','date'],
        ['전공정',80,'center','prevMp'],['다음공정',80,'center','nextMp'],['경유단계',0,'','chain','chain']]
},
'std-route':{
  table:OBJ.stdRoute, order:'standard_process_no.asc', post:'std',
  edit:{ table:TBL.stdRouteT, pk:'standard_process_no', fields:[
    ['standard_process_no','표준공정번호','num',null,'req'],
    ['standard_process_name','표준공정명','text',null,'req'],
    ['steps','가공공정 순서','list',null,'req']
  ]},
  search:[['표준공정명','text','standard_process_name']],
  cols:[['No',46,'center','row_no'],['표준공정번호',100,'center','standard_process_no'],
        ['표준공정명',160,'','standard_process_name'],['단계수',60,'num','_cnt'],
        ['가공공정 순서',0,'','_steps','chain']]
},
'vendor':{
  table:OBJ.vendor, order:'sort_order.asc,vendor_name.asc',
  note:'<b>협력사(외주업체) 기준정보</b>입니다. 여기 등록된 업체가 LOT 진행등록 · QR 입출고 · 외주발주의 '+
       '<b>외주처 선택 목록</b>과 <b>공정이동표의 연락처</b>로 사용됩니다.<br>'+
       '외주업체 계정의 소속(dept)에 <b>업체명을 그대로 입력</b>하면 QR 입출고 화면에서 해당 업체 LOT이 자동 표시됩니다. '+
       '외주가공 · 밀링 플래그가 모두 꺼지거나 미사용 처리하면 목록에서 제외됩니다.',
  edit:{ table:TBL.vendorT, pk:'vendor_code', fields:[
    ['vendor_code','업체코드','text',null,'req'],
    ['vendor_name','업체명','text',null,'req'],
    ['vendor_type','구분','sel',['외주가공','밀링','열처리','표면처리','기타']],
    ['proc_codes','담당 공정코드(쉼표)','text'],
    ['partner_type','협력형태','text'],
    ['location_type','지역','text'],
    ['ceo_name','대표자','text'],
    ['phone','대표전화','text'],
    ['contact_name','담당자','text'],
    ['contact_phone','담당자 연락처','text'],
    ['email','이메일','text'],
    ['address','주소','text'],
    ['outsourcing_flag','외주가공','bool',{def:true}],
    ['milling_flag','밀링','bool',{def:false}],
    ['is_active','사용','bool',{def:true}],
    ['sort_order','순서','num'],
    ['remark','비고','area']
  ]},
  search:[['업체명','text','vendor_name'],['업체코드','text','vendor_code'],
          ['구분','text','vendor_type'],['담당공정','text','proc_codes']],
  cols:[['업체코드',80,'center','vendor_code'],['업체명',150,'','vendor_name'],
        ['구분',80,'center','vendor_type'],['담당공정',90,'center','proc_codes'],
        ['대표자',80,'','ceo_name'],['대표전화',110,'','phone'],
        ['담당자',80,'','contact_name'],['담당자 연락처',110,'','contact_phone'],
        ['지역',80,'center','location_type'],
        ['외주',46,'center','outsourcing_flag','bool'],['밀링',46,'center','milling_flag','bool'],
        ['사용',46,'center','is_active','bool'],['비고',0,'','remark']]
},

'env-hist':{
  manual:true,
  table:OBJ.envHist, order:'measured_at.desc',
  search:[['센서','sel-sensor','sensor_code'],['센서명','text','sensor_name'],['구역','text','zone_code'],
          ['측정시각','date2','measured_at']],
  cols:[['측정시각',150,'center','measured_at','dt'],['센서',86,'','sensor_code'],['센서명',160,'','sensor_name'],
        ['구역',80,'center','zone_code'],['온도(℃)',92,'num','temperature'],['습도(%)',92,'num','humidity'],['',0,'','']]
},
'env-alert':{
  table:OBJ.envAlert, order:'occurred_at.desc',
  edit:{ table:TBL.envAlert, pk:'alert_id', auto:true, fields:[
    ['sensor_code','센서','ref',{table:OBJ.sensor,v:'sensor_code',t:'sensor_name'},'req'],
    ['occurred_at','발생시각','datetime',null,'req'],
    ['alert_type','알람구분','sel',['고온','저온','고습','저습','무신호'],'req'],
    ['value','측정값','num'],['threshold','임계값','num'],
    ['status','처리상태','sel',['발생','조치중','해제'],'req'],
    ['action','조치내용','area']
  ]},
  search:[['센서','sel-sensor','sensor_code'],['알람구분','sel-alert','alert_type'],
          ['처리상태','sel-astat','status'],['발생시각','date2','occurred_at']],
  cols:[['발생시각',150,'center','occurred_at','dt'],['센서',86,'','sensor_code'],['센서명',160,'','sensor_name'],
        ['구역',80,'center','zone_code'],['알람',80,'center','alert_type','st'],
        ['측정값',86,'num','value'],['임계값',86,'num','threshold'],
        ['상태',80,'center','status','st'],['조치',0,'','action']]
},
'grade-item':{
  table:OBJ.gradeItem, order:'item_no.asc',
  note:'등급 평가표 13항목입니다. <b>자동산출</b> : 1번(타발수 대장) · 8번(금형번호 앞자리). '+
       '기본점수는 평가 이력이 없는 금형의 일괄산정에 쓰입니다. 항목명·배점은 <b>사내 금형관리 규정</b>에 맞게 수정하세요.',
  search:[['항목명','text','item_name']],
  cols:[['NO',54,'center','item_no'],['평가항목',280,'','item_name'],
        ['자동산출',90,'center','auto_source'],['기본점수',80,'num','default_score'],['비고',0,'','remark']],
  edit:{ table:TBL.gradeItem, pk:'item_no', fields:[
    ['item_no','항목번호(1~13)','num',null,'req'],
    ['item_name','평가항목','text',null,'req'],
    ['auto_source','자동산출','sel',['','shot','year']],
    ['default_score','기본점수(1~5)','num',{def:2}],
    ['remark','비고','area']
  ]}
},
'daily-item':{
  table:OBJ.dailyItem, order:'side.desc,item_no.asc',
  note:'일상점검표 항목입니다 — <b>상형 8 / 하형 8</b>. 항목명은 현장 규정에 맞게 수정하세요.',
  search:[['구분','sel-side','side'],['항목명','text','item_name']],
  cols:[['구분',66,'center','side','st'],['NO',54,'center','item_no'],
        ['점검항목',320,'','item_name'],['사용',60,'center','is_active','bool']],
  edit:{ table:TBL.dailyItem, pk:'item_no', pk2:'side', auto:false, fields:[
    ['side','구분','sel',['상형','하형'],'req'],
    ['item_no','항목번호(1~8)','num',null,'req'],
    ['item_name','점검항목','text',null,'req'],
    ['is_active','사용','bool']
  ]}
},
'cycle-rule':{
  table:OBJ.cycleRule, order:'sort_order.asc',
  note:'점검주기의 <b>근거 기준표</b>입니다 — SQ 금형관리에서 요구하는 <b>주기 산정 근거</b>에 해당합니다. '+
       '여기 값을 바꾸면 정기점검 도래현황 · 연간 계획 · 세척 도래현황이 함께 바뀝니다.<br>'+
       '<b>정기</b> — 등급별 주기(일)와 연간 계획 기본 배정월 · <b>세척</b> — 타발수 한도와 기간(일). 둘 중 하나라도 넘으면 도래 판정됩니다.',
  search:[['구분','sel-kind','kind'],['대상','text','target']],
  cols:[['구분',66,'center','kind','st'],['대상',80,'center','target'],
        ['표기',130,'','label'],['주기(일)',80,'num','cycle_days'],
        ['타발수 한도',110,'num','limit_shot'],['계획 배정월',120,'center','months'],
        ['사용',56,'center','is_active','bool'],['비고',0,'','remark']],
  edit:{ table:TBL.cycleRule, pk:'rule_id', fields:[
    ['rule_id','기준코드','text',null,'req'],
    ['kind','구분','sel',['정기','세척'],'req'],
    ['target','대상','text',null,'req'],
    ['label','화면 표기','text'],
    ['cycle_days','주기(일)','num'],
    ['limit_shot','타발수 한도','num'],
    ['sort_order','순서','num'],
    ['is_active','사용','bool'],
    ['remark','비고','area']
  ]}
},
'wash-step':{
  table:OBJ.washStep, order:'step_no.asc',
  note:'정기세척 <b>세척항목</b>입니다. 순서대로 세척점검 화면의 체크 항목으로 표시됩니다.',
  search:[['단계명','text','step_name']],
  cols:[['순서',60,'center','step_no'],['세척항목',360,'','step_name'],['사용',60,'center','is_active','bool']],
  edit:{ table:TBL.washStep, pk:'step_no', fields:[
    ['step_no','순서','num',null,'req'],
    ['step_name','세척항목','text',null,'req'],
    ['is_active','사용','bool']
  ]}
},
'mold-type':{
  table:OBJ.moldType, order:'sort_order.asc',
  note:'금형타입 기준입니다. [금형정보]의 금형타입 선택 목록으로 사용됩니다.',
  search:[['코드','text','mold_type_code'],['타입명','text','mold_type_name']],
  cols:[['코드',100,'','mold_type_code'],['타입명',240,'','mold_type_name'],
        ['순서',60,'num','sort_order'],['비고',0,'','remark']],
  edit:{ table:TBL.moldType, pk:'mold_type_code', fields:[
    ['mold_type_code','타입코드','text',null,'req'],
    ['mold_type_name','타입명','text',null,'req'],
    ['sort_order','순서','num'],
    ['remark','비고','area']
  ]}
},
'material':{
  table:OBJ.material, order:'sort_order.asc',
  note:'소재 비중 기준입니다. 금형정보의 <b>소재중량(g) = 두께(cm) × 폭(cm) × 피치(cm) × 비중</b> 계산에 사용됩니다.',
  search:[['소재코드','text','material_code'],['소재명','text','material_name']],
  cols:[['소재코드',110,'','material_code'],['소재명',220,'','material_name'],
        ['비중',80,'num','density'],['순서',60,'num','sort_order'],['비고',0,'','remark']],
  edit:{ table:TBL.material, pk:'material_code', fields:[
    ['material_code','소재코드','text',null,'req'],
    ['material_name','소재명','text',null,'req'],
    ['density','비중','num',null,'req'],
    ['sort_order','순서','num'],
    ['remark','비고','area']
  ]}
},
'lot-move':{
  table:OBJ.lotMove, order:'created_at.desc',
  note:'공정이동표 <b>QR 스캔</b>으로 기록된 입출고 · 특기사항 이력입니다. '+
       '<b>부족수량</b>은 불량 등으로 출고수량보다 적게 입고된 수량이며, 사유와 함께 기록됩니다.',
  search:[['LOT','text','part'],['구분','text','io'],['가공공정','text','mp'],
          ['외주처','text','vendor'],['일자','date2','move_date'],['특기사항','text','remark']],
  cols:[['일시',134,'center','created_at','dt'],['LOT',110,'','part'],
        ['구분',66,'center','io','st'],['가공공정',86,'center','mp'],['외주처',110,'','vendor'],
        ['일자',88,'center','move_date'],
        ['출고수량',86,'num','out_qty','n0'],['입고수량',86,'num','in_qty','n0'],
        ['부족',70,'num','short_qty','n0'],['사유',110,'','reason'],
        ['기록자',80,'center','worker'],['경로',56,'center','source'],['특기사항',0,'','remark']],
  edit:{ table:TBL.lotMove, pk:'move_id', auto:true, fields:[
    ['part','LOT 번호','text',null,'req'],
    ['io','구분','sel',['출고','입고','사내입고','기록'],'req'],
    ['mp','가공공정','text'],
    ['vendor','외주처','text'],
    ['move_date','일자','date'],
    ['out_qty','출고수량','num'],
    ['in_qty','입고수량','num'],
    ['short_qty','부족수량','num'],
    ['reason','부족사유','text'],
    ['worker','기록자','text'],
    ['source','경로','sel',['QR','수동'],{def:'수동'}],
    ['remark','특기사항','area']
  ]}
},
'tool-rule':{
  table:OBJ.toolRule, order:'sort_order.asc',
  note:'연마 · 교체의 <b>공통 주기기준</b>입니다. 대상이 <b>ALL</b>이면 전체 금형에 적용되고, '+
       '금형종류를 지정한 기준이 있으면 그 기준이 우선 적용됩니다.<br>'+
       '<b>타발수 한도</b> 또는 <b>주기(일)</b> 중 하나라도 넘으면 <b>도래</b>, 임박기준(%) 이상이면 <b>임박</b>으로 판정되어 '+
       '<b>안돈 · ntfy 알림</b>이 발생합니다. 금형마다 다르게 쓰려면 [금형별 연마/교체주기]에서 개별 설정하세요.',
  search:[['구분','text','kind'],['대상','text','target'],['부위','text','part_name']],
  cols:[['구분',70,'center','kind','st'],['대상',110,'center','target'],['부위',120,'','part_name'],
        ['표기',150,'','label'],['타발수 한도',110,'num','limit_shot','n0'],
        ['주기(일)',80,'num','cycle_days'],['임박(%)',72,'num','warn_pct'],
        ['순서',56,'num','sort_order'],['사용',56,'center','is_active','bool'],['비고',0,'','remark']],
  edit:{ table:TBL.toolRule, pk:'rule_id', fields:[
    ['rule_id','기준코드','text',null,'req'],
    ['kind','구분','sel',['연마','교체'],'req'],
    ['target','대상(ALL 또는 금형종류)','text',{def:'ALL'},'req'],
    ['part_name','부위','text',{def:'공통'}],
    ['label','화면 표기','text'],
    ['limit_shot','타발수 한도','num'],
    ['cycle_days','주기(일)','num'],
    ['warn_pct','임박기준(%)','num',{def:90}],
    ['sort_order','순서','num'],
    ['is_active','사용','bool'],
    ['remark','비고','area']
  ]}
},
'tool-mold':{
  table:OBJ.moldTool, order:'mold_code.asc,kind.asc',
  note:'금형별 <b>개별 연마 · 교체주기</b>입니다. <b>공통기준 사용</b>에 체크하면 [연마/교체주기설정]의 공통 값이 적용되고, '+
       '해제하면 아래 개별 값이 적용됩니다.<br>'+
       '<b>최근 실시일 · 최근 실시 타발수</b>를 기준으로 잔여량을 계산하므로, 연마 · 교체 후에는 이 값을 갱신해야 도래 판정이 정확합니다.',
  search:[['금형코드','text','mold_code'],['금형명','text','mold_name'],['구분','text','kind']],
  cols:[['금형코드',96,'','mold_code'],['금형명',150,'','mold_name'],['고객사',100,'','customer_name'],
        ['구분',70,'center','kind','st'],['부위',110,'','part_name'],
        ['공통사용',72,'center','use_common','bool'],
        ['타발수 한도',110,'num','limit_shot','n0'],['주기(일)',80,'num','cycle_days'],
        ['임박(%)',72,'num','warn_pct'],
        ['최근 실시일',96,'center','last_date'],['최근 타발수',104,'num','last_shot','n0'],
        ['현재 타발수',104,'num','shot_count','n0'],
        ['사용',56,'center','is_active','bool'],['비고',0,'','remark']],
  edit:{ table:TBL.moldTool, pk:'mold_code', pk2:'kind', auto:false, fields:[
    ['mold_code','금형코드','ref',{table:OBJ.moldMst,v:'mold_code',t:'mold_name'},'req'],
    ['kind','구분','sel',['연마','교체'],'req'],
    ['part_name','부위','text',{def:'공통'}],
    ['use_common','공통기준 사용','bool',{def:true}],
    ['limit_shot','타발수 한도(개별)','num'],
    ['cycle_days','주기(일)(개별)','num'],
    ['warn_pct','임박기준(%)','num'],
    ['last_date','최근 실시일','date'],
    ['last_shot','최근 실시 타발수','num'],
    ['is_active','사용','bool'],
    ['remark','비고','area']
  ]}
},
'tool-alarm':{
  table:OBJ.toolAlert, order:'occurred_at.desc',
  note:'연마 · 교체 도래 시 자동 등록되는 <b>알람 이력</b>입니다. 조치가 끝나면 상태를 <b>해제</b>로 변경하세요. '+
       '해제되지 않은 알람은 안돈 화면에 계속 표시됩니다.',
  search:[['금형코드','text','mold_code'],['구분','text','kind'],['등급','text','level'],
          ['상태','sel-astat','status'],['발생일','date2','occurred_at'],['금형명','text','mold_name']],
  cols:[['발생시각',140,'center','occurred_at','dt'],['금형코드',96,'','mold_code'],
        ['금형명',150,'','mold_name'],['호기',60,'center','machine_no'],
        ['구분',70,'center','kind','st'],['부위',100,'','part_name'],
        ['등급',70,'center','level','st'],['사유',70,'center','reason'],
        ['타발수',100,'num','used_shot','n0'],['한도',100,'num','limit_shot','n0'],
        ['잔여(일)',76,'num','days_left'],
        ['상태',76,'center','status','st'],['ntfy',60,'center','notified','bool'],
        ['조치내용',0,'','action']],
  edit:{ table:TBL.toolAlert, pk:'alert_id', auto:true, fields:[
    ['mold_code','금형코드','ref',{table:OBJ.moldMst,v:'mold_code',t:'mold_name'},'req'],
    ['kind','구분','sel',['연마','교체'],'req'],
    ['part_name','부위','text',{def:'공통'}],
    ['level','등급','sel',['임박','도래'],{def:'도래'}],
    ['reason','사유','sel',['타발수','기간']],
    ['status','상태','sel',['발생','조치중','해제'],{def:'발생'}],
    ['action','조치내용','area'],
    ['message','메시지','area']
  ]}
},
'mold-loc':{
  table:OBJ.moldLoc, order:'sort_order.asc',
  note:'금형 보관장소 기준입니다. 금형대장의 <b>보관장소</b> 선택 목록으로 사용됩니다.',
  search:[['장소코드','text','location_code'],['장소명','text','location_name']],
  cols:[['장소코드',100,'','location_code'],['장소명',220,'','location_name'],
        ['공장',80,'center','factory_code'],['순서',60,'num','sort_order'],
        ['사용',56,'center','is_active','bool'],['비고',0,'','remark']],
  edit:{ table:TBL.moldLoc, pk:'location_code', fields:[
    ['location_code','장소코드','text',null,'req'],
    ['location_name','장소명','text',null,'req'],
    ['factory_code','공장','ref',{table:OBJ.factory,v:'factory_code',t:'factory_name'}],
    ['sort_order','순서','num'],
    ['is_active','사용','bool'],
    ['remark','비고','area']
  ]}
},
'machine':{
  table:OBJ.machine, order:'sort_order.asc',
  edit:{ table:TBL.machine, pk:'machine_no', fields:[
    ['machine_no','호기번호','text',null,'req'],
    ['machine_name','호기명','text',null,'req'],
    ['tonnage','톤수','num'],
    ['sort_order','순서','num'],
    ['is_active','사용','bool'],
    ['remark','비고','area']
  ]},
  search:[['호기번호','text','machine_no'],['호기명','text','machine_name']],
  cols:[['호기번호',100,'center','machine_no'],['호기명',220,'','machine_name'],
        ['톤수',80,'num','tonnage'],['순서',60,'num','sort_order'],
        ['사용',60,'center','is_active','bool'],['비고',0,'','remark']]
},
'sensor':{
  table:OBJ.sensor, order:'sensor_code.asc',
  note:'상·하한을 벗어나면 실시간 현황에서 <b>고온/저온/고습/저습</b>으로 표시됩니다.',
  edit:{ table:TBL.sensor, pk:'sensor_code', fields:[
    ['sensor_code','센서코드','text',null,'req'],
    ['sensor_name','센서명','text',null,'req'],
    ['factory_code','공장','ref',{table:OBJ.factory,v:'factory_code',t:'factory_name'},'req'],
    ['zone_code','구역','ref',{table:OBJ.zone,v:'zone_code',t:'zone_name'}],
    ['x','X','num'],['y','Y','num'],
    ['temp_min','온도 하한','num',{def:15}],['temp_max','온도 상한','num',{def:30}],
    ['humi_min','습도 하한','num',{def:30}],['humi_max','습도 상한','num',{def:70}],
    ['is_active','사용','bool'],
    ['remark','비고','area']
  ]},
  search:[['센서코드','text','sensor_code'],['센서명','text','sensor_name'],['공장','sel-fac','factory_code'],
          ['구역코드','text','zone_code']],
  cols:[['센서코드',90,'','sensor_code'],['센서명',170,'','sensor_name'],
        ['공장',70,'center','factory_code'],['구역',80,'center','zone_code'],
        ['X',56,'num','x'],['Y',56,'num','y'],
        ['온도하한',76,'num','temp_min'],['온도상한',76,'num','temp_max'],
        ['습도하한',76,'num','humi_min'],['습도상한',76,'num','humi_max'],
        ['사용',56,'center','is_active','bool'],['비고',0,'','remark']]
}
};
