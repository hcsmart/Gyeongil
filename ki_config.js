/* ============================================================
   KI MES 공통 설정
   · 이전 시 아래 SUPABASE 2줄과 DB_PREFIX만 변경
============================================================ */
const KI_CFG = {
  APP_NAME : 'KI MES',
  VER      : 'v11.4',
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
  moldType:'ki_mold_type', material:'ki_material',
  /* 외주 LOT (원천 테이블) */
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

    { key:'m-std', name:'점검기준', icon:'⚙', groups:[
      { name:'주기 기준', items:[
        {id:'cycle-rule', f:'cycle_rule.html', n:'점검주기 기준', d:'정기(등급별) · 세척(타발수/기간)'}
      ]},
      { name:'점검항목 기준', items:[
        {id:'insp-item',  f:'inspection_item.html', n:'정기점검 항목', d:'분류 · 방법 · 판정기준'},
        {id:'daily-item', f:'daily_item.html',      n:'일상점검 항목', d:'상형 8 / 하형 8'},
        {id:'wash-step',  f:'wash_step.html',       n:'세척항목(순서)', d:'정기세척 6항목'}
      ]},
      { name:'평가 기준', items:[
        {id:'grade-item', f:'grade_item.html', n:'등급 평가항목', d:'13항목 · 배점'}
      ]}
    ]},

    { key:'m-plan', name:'점검계획', icon:'📅', groups:[
      { name:'점검계획', items:[
        {id:'plan-board', f:'plan_board.html', n:'점검 도래현황',
         d:'정기 · 세척 통합 → 클릭 시 등록'},
        {id:'plan-cal', f:'plan_board.html?view=plan', n:'점검 예측 · 계획표',
         d:'현재~선택연도 · 자동생성'}
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

  { key:'osp', name:'외주LOT관리', second:[
    { key:'o-io', name:'외주 입출고', icon:'↔', groups:[
      { name:'외주 진행', items:[
        {id:'osp-lot', f:'osp_lot.html', n:'외주 LOT 관리', d:'발주 · 반출 · 입고 · 미입고 통합'}
      ]}
    ]},
    { key:'o-lot', name:'LOT 추적', icon:'🔎', groups:[
      { name:'추적', items:[
        {id:'lot-trace', f:'lot_trace.html', n:'LOT 이동이력', d:'외주업체 경유 이력'},
        {id:'lot-route', f:'lot_route.html', n:'LOT 진행현황', d:'공정 진척 · 현재 위치'}
      ]}
    ]}
  ]},

  { key:'twin', name:'트윈팩토리', second:[
    { key:'t-live', name:'공장현황', icon:'🏭', groups:[
      { name:'실시간', items:[
        {id:'twin-map',  f:'twin_map.html',     n:'공장 레이아웃', d:'2D 배치도 · 가동상태'},
        {id:'asset-st',  f:'asset_status.html', n:'설비 현황',     d:'설비별 가동상태'}
      ]}
    ]},
    { key:'t-base', name:'공장기준', icon:'▦', groups:[
      { name:'기준정보', items:[
        {id:'factory', f:'factory.html', n:'공장',      d:'공장 · 도면 크기'},
        {id:'zone',    f:'zone.html',    n:'구역',      d:'구역 좌표 · 크기'},
        {id:'asset',   f:'asset.html',   n:'설비 배치', d:'설비 좌표 · 사양'}
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
        {id:'mold-loc',  f:'mold_location.html', n:'금형 보관위치', d:'보관위치 코드 · 명칭'}
      ]},
      { name:'설비', items:[
        {id:'machine',   f:'machine.html',   n:'호기설정', d:'호기번호 · 호기명'}
      ]}
    ]},
    { key:'b-osp', name:'외주기준', icon:'↔', groups:[
      { name:'외주 기준정보', items:[
        {id:'vendor',    f:'vendor.html',    n:'외주업체',      d:'외주 가공 거래처'},
        {id:'std-route', f:'std_route.html', n:'표준 공정경로', d:'표준공정 가공순서'}
      ]}
    ]},
    { key:'b-chk', name:'점검기준', icon:'🔧', groups:[
      { name:'점검 기준정보', items:[
        {id:'chk-mach', f:'check_machine.html', n:'설비 점검기준', d:'일상 · 정기 점검항목 / 판정기준'}
      ]}
    ]}
  ]},

  { key:'sys', name:'시스템', second:[
    { key:'s-sys', name:'시스템', icon:'⚙', groups:[
      { name:'시스템', items:[
        {id:'settings',  f:'settings.html',  n:'비밀번호 설정', d:'마스터 / 사용자 PIN'},
        {id:'user-info', f:'user_info.html', n:'사용자정보',   d:'사용자 등록 · 권한 매트릭스'}
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
  edit:{ table:TBL.mold, pk:'mold_code', fields:[
    ['mold_code','금형코드(품번)','text',null,'req'],
    ['mold_no','금형번호','text'],
    ['grade','등급','sel',['A','B','C','F']],
    ['prod_type','생산구분','sel',['양산','A/S'],{def:'양산'}],
    ['machine_no','사용기계','ref',{table:OBJ.machine,v:'machine_no',t:'machine_name'}],
    ['mold_name','금형명','text',null,'req'],
    ['customer_name','고객사','text'],
    ['model','모델','text'],
    ['mold_type','금형종류','sel',['프로그레시브','트랜스퍼','단발','SEMI+단발','TPL','TR']],
    ['factory_code','공장','ref',{table:OBJ.factory,v:'factory_code',t:'factory_name'}],
    ['location','보관위치','ref',{table:OBJ.moldLoc,v:'location_code',t:'location_name'}],
    ['shot_count','타발수','num'],
    ['shot_limit','수명(SHOT)','num'],
    ['cycle_days','점검주기(일)','num',{def:90}],
    ['last_inspection','최근점검','date'],
    ['next_inspection','점검예정','date'],
    ['status','상태','sel',['정상','주의','점검필요','폐기']],
    ['remark','비고','area']
  ]},
  search:[['금형코드','text','mold_code'],['금형명','text','mold_name'],['고객사','text','customer_name'],
          ['금형종류','text','mold_type'],['상태','sel-mst','status'],['보관위치','text','location']],
  cols:[['금형코드',92,'','mold_code'],['금형번호',86,'center','mold_no'],['등급',52,'center','grade','grade'],
        ['금형명',150,'','mold_name'],['고객사',100,'','customer_name'],
        ['모델',90,'','model'],['금형종류',100,'center','mold_type'],['공장',60,'center','factory_code'],
        ['보관위치',110,'','location'],['타발수',96,'num','shot_count','n0'],['수명',96,'num','shot_limit','n0'],
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
  search:[['부품번호(LOT)','text','part'],['JOB(관리번호)','text','job'],['외주처','sel-vendor','vendor'],
          ['가공공정','sel-mp','mp'],['이동일','date2','date'],['공정','text','proc']],
  cols:[['No',46,'center','_i'],['순번',48,'center','seq'],['JOB(관리번호)',118,'','job'],
        ['부품번호(LOT)',110,'','part'],['공정',50,'center','proc'],
        ['가공공정',72,'center','mp'],['가공공정명',130,'','mpName'],
        ['외주업체',130,'','vendor'],['이동일',90,'center','date'],
        ['전공정',80,'center','prevMp'],['다음공정',80,'center','nextMp'],['경유단계',0,'','chain','chain']]
},
'lot-route':{
  table:OBJ.lotProg, order:'no.asc', post:'route',
  note:'외주발주 화면에서 <b>입고일</b>을 입력하면 경유 이력이 자동으로 쌓입니다. 진척률은 표준공정 대비 실제 거친 단계 수입니다.',
  search:[['부품번호(LOT)','text','part'],['JOB(관리번호)','text','job'],['현재 외주처','sel-vendor','vendor'],
          ['현재 공정','sel-mp','mp'],['최근 이동일','date2','date'],['진척(%이상)','num','_rate']],
  cols:[['No',46,'center','_i'],['JOB(관리번호)',118,'','job'],['부품번호(LOT)',110,'','part'],
        ['공정',50,'center','proc'],['표준공정',110,'','stdName'],
        ['현재 가공공정',96,'center','mp'],['현재 가공공정명',126,'','mpName'],
        ['현재 외주업체',126,'','vendor'],['최근 이동일',96,'center','date'],
        ['다음 공정',130,'','nextMp'],['표준완료',60,'num','done'],['표준단계',60,'num','total'],
        ['실제단계',60,'num','steps'],
        ['진척률',100,'','_rate','bar'],['경유 이력',0,'','chain','chain']]
},
'std-route':{
  table:OBJ.stdRoute, order:'standard_process_no.asc', post:'std',
  search:[['표준공정명','text','standard_process_name']],
  cols:[['No',46,'center','row_no'],['표준공정번호',100,'center','standard_process_no'],
        ['표준공정명',160,'','standard_process_name'],['단계수',60,'num','_cnt'],
        ['가공공정 순서',0,'','_steps','chain']]
},
'vendor':{
  table:OBJ.vendor, order:'vendor_name.asc',
  search:[['업체명','text','vendor_name'],['업체코드','text','vendor_code'],['구분','text','vendor_type']],
  cols:[['No',46,'center','_i'],['업체코드',90,'','vendor_code'],['업체명',170,'','vendor_name'],
        ['구분',90,'center','vendor_type'],['협력형태',90,'center','partner_type'],
        ['지역',80,'center','location_type'],['대표자',90,'','ceo_name'],['전화',110,'','phone'],['비고',0,'','remark']]
},

'asset-st':{
  table:OBJ.assetSt, order:'asset_code.asc',
  search:[['설비코드','text','asset_code'],['설비명','text','asset_name'],['공장','sel-fac','factory_code'],
          ['구역','text','zone_name'],['설비구분','text','asset_type'],['상태','sel-asset','status']],
  cols:[['설비코드',86,'','asset_code'],['설비명',150,'','asset_name'],['구분',80,'center','asset_type'],
        ['공장',120,'','factory_name'],['구역',110,'','zone_name'],
        ['상태',80,'center','status','st'],['사양',110,'','spec'],
        ['X',56,'num','x'],['Y',56,'num','y'],['비고',0,'','remark']]
},
'factory':{
  table:OBJ.factory, order:'factory_code.asc',
  edit:{ table:TBL.factory, pk:'factory_code', fields:[
    ['factory_code','공장코드','text',null,'req'],
    ['factory_name','공장명','text',null,'req'],
    ['width_m','가로(m)','num',{def:100}],
    ['height_m','세로(m)','num',{def:60}],
    ['remark','비고','area']
  ]},
  search:[['공장코드','text','factory_code'],['공장명','text','factory_name']],
  cols:[['공장코드',90,'center','factory_code'],['공장명',200,'','factory_name'],
        ['가로(m)',80,'num','width_m'],['세로(m)',80,'num','height_m'],['비고',0,'','remark']]
},
'zone':{
  table:OBJ.zone, order:'zone_code.asc',
  note:'X · Y 는 구역 좌측상단 좌표, 폭 · 높이는 구역 크기입니다(단위 m). 트윈팩토리 배치도에 그대로 반영됩니다.',
  edit:{ table:TBL.zone, pk:'zone_code', fields:[
    ['zone_code','구역코드','text',null,'req'],
    ['factory_code','공장','ref',{table:OBJ.factory,v:'factory_code',t:'factory_name'},'req'],
    ['zone_name','구역명','text',null,'req'],
    ['x','X','num'],['y','Y','num'],['w','폭','num'],['h','높이','num'],
    ['color','색상','sel',['#dbe9f8','#e2f0e6','#f6ecd9','#eee3f2','#fbe4e4','#eef2f6']],
    ['remark','비고','area']
  ]},
  search:[['구역코드','text','zone_code'],['구역명','text','zone_name'],['공장','sel-fac','factory_code']],
  cols:[['구역코드',90,'center','zone_code'],['공장',70,'center','factory_code'],['구역명',170,'','zone_name'],
        ['X',60,'num','x'],['Y',60,'num','y'],['폭',60,'num','w'],['높이',60,'num','h'],
        ['색상',80,'center','color','color'],['비고',0,'','remark']]
},
'asset':{
  table:OBJ.asset, order:'asset_code.asc',
  note:'X · Y 는 배치도 상의 설비 중심 좌표(m)입니다. 상태를 바꾸면 트윈팩토리 화면 색상이 즉시 반영됩니다.',
  edit:{ table:TBL.asset, pk:'asset_code', fields:[
    ['asset_code','설비코드','text',null,'req'],
    ['asset_name','설비명','text',null,'req'],
    ['asset_type','설비구분','sel',['MCT','연삭','방전','와이어','조립','검사','시험','보관','기타']],
    ['factory_code','공장','ref',{table:OBJ.factory,v:'factory_code',t:'factory_name'},'req'],
    ['zone_code','구역','ref',{table:OBJ.zone,v:'zone_code',t:'zone_name'}],
    ['x','X','num'],['y','Y','num'],
    ['status','상태','sel',['가동','정지','경고','정상','고장'],'req'],
    ['spec','사양','text'],
    ['remark','비고','area']
  ]},
  search:[['설비코드','text','asset_code'],['설비명','text','asset_name'],['공장','sel-fac','factory_code'],
          ['구역코드','text','zone_code'],['설비구분','text','asset_type'],['상태','sel-asset','status']],
  cols:[['설비코드',90,'','asset_code'],['설비명',160,'','asset_name'],['구분',80,'center','asset_type'],
        ['공장',70,'center','factory_code'],['구역',80,'center','zone_code'],
        ['X',60,'num','x'],['Y',60,'num','y'],['상태',80,'center','status','st'],
        ['사양',110,'','spec'],['최종신호',140,'center','last_signal','dt'],['비고',0,'','remark']]
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
'mold-loc':{
  table:OBJ.moldLoc, order:'sort_order.asc',
  note:'금형 보관위치 기준입니다. 금형대장의 <b>보관위치</b> 선택 목록으로 사용됩니다.',
  search:[['위치코드','text','location_code'],['위치명','text','location_name']],
  cols:[['위치코드',100,'','location_code'],['위치명',220,'','location_name'],
        ['공장',80,'center','factory_code'],['순서',60,'num','sort_order'],
        ['사용',56,'center','is_active','bool'],['비고',0,'','remark']],
  edit:{ table:TBL.moldLoc, pk:'location_code', fields:[
    ['location_code','위치코드','text',null,'req'],
    ['location_name','위치명','text',null,'req'],
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
