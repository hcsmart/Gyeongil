/* ============================================================
   SCM Smart 공통 설정
   · 이전 시 아래 SUPABASE 2줄과 DB_PREFIX만 변경
============================================================ */
const KI_CFG = {
  APP_NAME : 'SCM Smart',
  VER      : 'v13.3',
  SUPABASE_URL : 'https://ipggvrzxfcryzryileuv.supabase.co',
  SUPABASE_KEY : 'sb_publishable_CHO-dAOU00HNwno52255mg_H3C1_vew',
  DB_PREFIX    : 'ki_',
  LANDING      : 'home.html',         // 로그인 후 첫 화면 (빈 홈 — 메뉴 선택 대기)
  MOBILE_LANDING:'',                  // 폰 전용 첫 화면 (비우면 LANDING 사용)
  NAV_MODE     : 'drop',            // 'drop': 상단 메뉴 클릭 → 드롭다운 / 'top': 상단 가로바 / 'left': 좌측 트리
  SLIM_HEAD    : true,              // true: 화면제목·버튼을 상단바로 이동 + 안내문 숨김 (그리드 영역 최대)
  ACT_IN_MENU  : false,             // true: 실행버튼을 드롭다운 우측에 표시 / false: 상단바 우측 별도 버튼
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
  shotLedger:'ki_shot_ledger', shotDaily:'ki_shot_daily', gradeItem:'ki_grade_item',
  gradeEval:'ki_grade_eval', gradeEvalDet:'ki_grade_eval_detail',
  dailyItem:'ki_daily_item', dailyCheck:'ki_daily_check', dailyCheckDet:'ki_daily_check_detail',
  wash:'ki_wash', washStep:'ki_wash_step', inspPlan:'ki_insp_plan',
  cycleRule:'ki_cycle_rule', moldLoc:'ki_mold_location',
  toolRule:'ki_tool_rule', moldTool:'ki_mold_tool',
  toolAlert:'ki_tool_alert', notifyCfg:'ki_notify_config', errLogT:'ki_error_log',
  moldType:'ki_mold_type', material:'ki_material', moldSpecT:'ki_mold_master',
  vendorT:'ki_vendor', stdRouteT:'ki_std_route', processT:'ki_process',
  /* 외주 LOT (원천 테이블) */
  lotReceipt:'ki_lot_receipt', lotMove:'ki_lot_move',
  /* SCM Smart 전용 테이블 — 같은 프로젝트의 다른 MES 와 데이터가 섞이지 않도록 분리했다.
     (예전 레거시 공용 테이블 outsourcing_* · machining_* 은 더 이상 쓰지 않는다) */
  ospOrder:'ki_osp_order',
  ospRecv :'ki_osp_receipt',
  lotProg :'ki_lot_progress'
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
  lotToken : P+'v_lot_token', venStock : P+'v_vendor_stock',
  vendor   : P+'v_vendor',     process  : P+'v_process',
  errLog   : P+'v_error_log',
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
  shotLedger : P+'v_shot_ledger', shotDaily : P+'v_shot_daily',
  gradeItem : P+'v_grade_item',
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
        {id:'shot-daily',  f:'shot_daily.html',  n:'일별 타발수 등록',
         d:'일 생산량 → 누적 · 월별 자동반영'},
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
        {id:'lot-track', f:'lot_track.html', n:'LOT 추적(통합조회)',
         d:'반출 · QR · 입고 · 사내입고 통합 이력 검색'},
        {id:'lot-trace', f:'lot_trace.html', n:'LOT 이동이력', d:'외주업체 경유 이력'},
        {id:'lot-move',  f:'lot_move.html',  n:'QR 입출고 이력', d:'QR 스캔 · 부족수량 · 특기사항'},
        {id:'lot-token', f:'lot_token.html', n:'공정이동표 발행이력', d:'QR 토큰 · 유효 · 폐기'}
      ]},
      { name:'협력사 재고', items:[
        {id:'ven-stock', f:'vendor_stock.html', n:'협력사 재고현황',
         d:'업체별 보유수량 · 체류일 · 납기'}
      ]},
      { name:'현장 (QR)', items:[
        {id:'lot-scan',  f:'lot_scan.html',  n:'QR 입출고(현장)', pop:1,
         d:'공정이동표 QR 스캔 — 출고 · 입고 · 특기사항 (별도 창)'},
        {id:'lot-vendor',f:'lot_vendor.html',n:'협력사 QR 스캔(모바일)', pop:1,
         d:'협력사 전용 — 카메라로 이동표 QR 스캔 (별도 창)'}
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
        {id:'process',   f:'process.html',   n:'공정코드',      d:'가공 · 조립 · 설계 공정 코드 · 명칭'},
        {id:'vendor',    f:'vendor.html',    n:'협력사 정보',   d:'외주 가공 · 연락처 · 담당공정'},
        {id:'std-route', f:'std_route.html', n:'표준 공정경로', d:'가공순서 · 사내/외주 구분'}
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
        {id:'notify-cfg',f:'notify_config.html', n:'알림 설정(ntfy)', d:'안돈 · ntfy 서버 · 토픽'},
        {id:'err-log',   f:'error_log.html', n:'오류로그', d:'화면 오류 · 조회 실패 추적'}
      ]}
    ]}
  ]},
{ key:'guide', name:'사용안내', second:[
    { key:'g-main', name:'사용안내', icon:'📖', groups:[
      { name:'전체', items:[
        {id:'guide', f:'guide.html', n:'사용안내', d:'업무 흐름 · 전체 메뉴 설명'}
      ]},
      { name:'주제별', items:[
        {id:'guide-start',  f:'guide.html?sec=start',  n:'처음 시작하기',
         d:'초기 설정 순서 — 사용자 · 기준정보 · 알림'},
        {id:'guide-lot',    f:'guide.html?sec=lot',    n:'LOT 외주 진행',
         d:'반출 · 이동표(QR) · 도착확인 · 사내입고'},
        {id:'guide-track',  f:'guide.html?sec=track',  n:'LOT 추적 사용법',
         d:'통합조회 검색조건 · 이벤트 · 활용 조합'},
        {id:'guide-common', f:'guide.html?sec=common', n:'화면 공통 조작',
         d:'제목행 정렬 · 조회 · 엑셀 · 등록예제 안내'}
      ]}
    ]}
  ]}
];

/* ============================================================
   메뉴 숨김 설정  (실전 테스트 : LOT관리만 사용)
   · 숨겨도 화면 파일 · 데이터 · 권한은 그대로 보존됩니다.
   · 다시 사용하려면 아래 배열에서 해당 key 를 지우면 됩니다.
     (전체 복원 → mod:[], sec:[], item:[] 로 비우기)
============================================================ */
const HIDE = {
  mod : ['env'],                        // 1차 모듈 : 온습도관리만 숨김 (금형관리 사용)
  sec : [],                             // 2차 : 숨김 없음 (생산기준 · 점검기준 사용)
  /* [LOT 추적(통합조회)]와 겹치는 화면만 메뉴에서 숨긴다.
     화면 정의 · 권한 · 파일은 그대로 두므로, 다시 쓰려면 이 배열에서 지우면 된다.
       lot-move  : QR 입출고 이력  → 통합조회 이벤트 [QR 도착 · QR 출고 · 가공입고]
       lot-token : 이동표 발행이력 → 통합조회 이벤트 [이동표 발행]
     lot-trace(LOT 이동이력)는 경유단계 체인 요약을 제공하므로 메뉴에 유지한다. */
  item: ['lot-move','lot-token']
};

/* 상단 1차 메뉴 표시 순서 (여기 없는 key 는 뒤에 원래 순서대로 붙습니다) */
const MENU_ORDER = ['osp','mold','base','sys','guide'];

/* 비활성(회색 · 클릭 불가) 1차 모듈 — 메뉴는 보이지만 사용할 수 없습니다.
   다시 사용하려면 아래 배열에서 해당 key 를 지우세요. */
const DIM_MOD = ['mold'];

/* 실제 화면에 표시되는 메뉴 (숨김 제외 · 순서 적용 · 비활성 표시) */
const MENU_V = MENU
  .filter(m1=>!HIDE.mod.includes(m1.key))
  .slice().sort((a,b)=>{
    const ia=MENU_ORDER.indexOf(a.key), ib=MENU_ORDER.indexOf(b.key);
    return (ia<0?99:ia)-(ib<0?99:ib);
  })
  .map(m1=>Object.assign({},m1,{ off:DIM_MOD.includes(m1.key) }))
  .map(m1=>Object.assign({},m1,{ second:m1.second
      .filter(m2=>!HIDE.sec.includes(m2.key))
      .map(m2=>Object.assign({},m2,{ groups:m2.groups
          .map(g=>Object.assign({},g,{ items:g.items.filter(it=>!HIDE.item.includes(it.id)) }))
          .filter(g=>g.items.length) }))
      .filter(m2=>m2.groups.length) }))
  .filter(m1=>m1.second.length);

/* ============================================================
   화면별 실행버튼 목록 (드롭다운 메뉴 우측에 표시)
   · [버튼명, 클래스('primary'|'new'|'green'|'danger'|'')]
   · 여기에 없는 그리드 화면은 권한에 따라 자동 산출됩니다.
   · 버튼명은 각 화면의 실제 버튼명과 같아야 자동 실행됩니다.
============================================================ */
const ACTS = {
  'lot-route'  : [['신규등록',''],['엑셀다운로드',''],['인쇄','']],
  'lot-track'  : [['조회','primary'],['조건 초기화',''],['엑셀다운로드',''],['인쇄','']],
  'lot-scan'   : [],
  'lot-vendor' : [],
  'notify-cfg' : [['저장','primary'],['ntfy 테스트','green'],['새로고침','']],
  'settings'   : [],
  'user-info'  : [],
  'guide'      : [],
  /* 금형 · 온습도 (현재 숨김) */
  'plan-board' : [['조회','primary'],['엑셀다운로드',''],['인쇄','']],
  'plan-cal'   : [['조회','primary'],['📅 계획표 자동생성','green'],['엑셀다운로드',''],['인쇄','']],
  'daily-check': [['💾 점검 등록','primary'],['전체 양호',''],['새로고침',''],['엑셀다운로드','']],
  'mold-insp'  : [['💾 점검 등록','primary'],['전체 합격',''],['새로고침',''],['엑셀다운로드','']],
  'wash-check' : [['💾 세척 등록','primary'],['정기세척 일괄 등록','green'],['새로고침',''],['엑셀다운로드','']],
  'shot-ledger': [['저장','primary'],['＋ 품번 추가',''],['등급 자동 산정','green'],['새로고침',''],['엑셀다운로드','']],
  'grade-eval' : [['새로고침','']],
  'tool-due'   : [['지금 점검','primary'],['ntfy 테스트',''],['기준 초기화',''],['엑셀다운로드','']],
  'mold-spec'  : [['엑셀업로드',''],['엑셀다운로드',''],['새로고침','']],
  'env-live'   : [['새로고침','primary'],['측정 이력','']]
};

/* 화면 id → {item, 모듈, 2차, 경로} 색인 (숨김 포함 — 직접 URL 접근 대응) */
const FLAT = {
  /* 로그인 후 첫 화면 — 메뉴에는 표시하지 않는다 */
  home:{ it:{id:'home', f:'home.html', n:'홈', d:'메뉴를 선택하세요'},
         mod:'', sec:'', modName:'', secName:'', path:'홈' }
};
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
       '등급 · 보관장소 · 점검주기 등 운영 항목만 수정됩니다.<br>'+
       '<b>누적 타발수 = 기초 타발수 + 일별 합계</b>로 자동 계산되며 직접 수정할 수 없습니다. '+
       '과거 누적분을 보정하려면 <b>기초 타발수</b>를 수정하고, 이후 실적은 '+
       '[금형평가 › 일별 타발수 등록]에서 입력하세요.',
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
    ['shot_base','기초 타발수','num',{def:0}],
    ['shot_count','누적 타발수','num',null,'ro'],
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
        ['보관장소',110,'','location'],['기초 타발수',108,'num','shot_base','n0'],['일별 합계',96,'num','shot_daily_sum','n0'],
        ['누적 타발수',110,'num','shot_count','n0'],['수명',96,'num','shot_limit','n0'],
        ['최근 실적일',92,'center','last_shot_date'],
        ['주기(일)',64,'num','cycle_days'],['최근점검',92,'center','last_inspection'],
        ['점검예정',92,'center','next_inspection'],['상태',70,'center','status','st'],['비고',0,'','remark']]
},
'insp-item':{
  table:OBJ.inspItem, order:'sort_order.asc',
  edit:{ table:TBL.inspItem, pk:'item_code', rename:[[TBL.inspDetail,'item_code']], fields:[
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
  search:[['LOT','text','part'],['품번','text','map_part'],['JOB(관리번호)','text','job'],
          ['외주처','sel-vendor','vendor'],['가공공정','sel-mp','mp'],['이동일','date2','date'],
          ['공정','text','proc']],
  cols:[['No',46,'center','_i'],['순번',48,'center','seq'],['JOB(관리번호)',118,'','job'],
        ['LOT',110,'','part'],['품번',110,'','map_part'],['공정',50,'center','proc'],
        ['가공공정',72,'center','mp'],['가공공정명',130,'','mpName'],
        ['외주업체',130,'','vendor'],['이동일',90,'center','date'],
        ['전공정',80,'center','prevMp'],['다음공정',80,'center','nextMp'],['경유단계',0,'','chain','chain']]
},
'std-route':{
  table:OBJ.stdRoute, order:'standard_process_no.asc', post:'std',
  note:'LOT이 따라갈 <b>표준 가공순서</b>입니다. 이 순서가 진척률의 분모이자 반출 시 '+
       '<b>다음 공정 자동 제안</b>의 근거가 됩니다.<br>'+
       '<b>사내 수행 공정</b>에 적은 단계는 경일FB 안에서 처리하는 공정으로, 반출 시 '+
       '이동 구분이 <b>🏭 사내</b>로 자동 지정되고 화면에 오렌지색으로 표시됩니다. '+
       '비워 두면 전 단계가 외주(🚚)입니다.',
  edit:{ table:TBL.stdRouteT, pk:'standard_process_no', rename:[[TBL.ospOrder,'route_no']], fields:[
    ['standard_process_no','표준공정번호','num',null,'req'],
    ['standard_process_name','표준공정명','text',null,'req'],
    ['steps','가공공정 순서','list',null,'req'],
    ['inhouse','사내 수행 공정','list']
  ]},
  search:[['표준공정명','text','standard_process_name']],
  cols:[['No',46,'center','row_no'],['표준공정번호',100,'center','standard_process_no'],
        ['표준공정명',160,'','standard_process_name'],['단계수',60,'num','_cnt'],
        ['사내',52,'center','_in'],
        ['가공공정 순서',0,'','_steps','chain']]
},
'err-log':{
  table:OBJ.errLog, order:'occurred_at.desc', post:'errlog',
  note:'화면에서 발생한 <b>오류가 자동으로 쌓이는 곳</b>입니다. 사용자가 따로 신고하지 않아도 '+
       '어느 화면 · 누구 · 언제 · 무슨 메시지였는지 남습니다.<br>'+
       '<b>구분</b> — js(화면 스크립트 오류) · api(조회 · 저장 실패) · app(직접 기록). '+
       '자세한 내용은 행을 더블클릭해 <b>상세</b> 열에서 확인하세요.',
  search:[['일시','date2','occurred_at'],['화면','text','menu'],
          ['구분','sel','kind',['전체','js','api','rpc','app']],
          ['사용자','text','emp_name'],['메시지','text','message']],
  cols:[['일시',140,'center','occurred_at','dt'],['구분',56,'center','kind'],
        ['등급',56,'center','level','st'],['화면',110,'','menu'],
        ['파일',130,'','page'],['사용자',80,'center','emp_name'],
        ['메시지',260,'','message'],['상세',0,'','detail']]
},
'process':{
  table:OBJ.process, order:'sort_order.asc,process_code.asc', post:'proc',
  note:'가공 · 조립 · 설계 <b>공정코드 기준정보</b>입니다. 여기 등록된 코드가 '+
       '<b>표준 공정경로</b>의 단계와 LOT 반출의 가공공정 선택 목록이 됩니다.<br>'+
       '이미 사용 중인 코드는 <b>변경하지 말고</b> 새 코드를 추가하세요 — 과거 이력이 코드로 묶여 있습니다.',
  edit:{ table:TBL.processT, pk:'process_code', rename:{rpc:'ki_process_rename'}, fields:[
    ['process_code','공정코드','text',null,'req'],
    ['process_name','공정명','text',null,'req'],
    ['process_group','공정그룹','sel',['가공','조립','설계','기타']],
    ['sort_order','정렬순서','num'],
    /* 완료 진척률 · 진척 사용 · 계획 사용은 아직 계산에 반영되지 않아 화면에서 감춘다.
       (컬럼은 ki_process 에 그대로 남아 있으므로 나중에 되살릴 수 있다) */
    ['remark','비고','text']
  ]},
  search:[['공정코드','text','process_code'],['공정명','text','process_name'],
          ['공정그룹','sel','process_group',['전체','가공','조립','설계','기타']]],
  cols:[['No',46,'center','_i'],['공정코드',90,'center','process_code'],
        ['공정명',180,'','process_name'],['공정그룹',80,'center','process_group'],
        ['정렬순서',70,'num','sort_order'],
        ['비고',0,'','remark']]
},
'vendor':{
  table:OBJ.vendor, order:'sort_order.asc,vendor_name.asc',
  note:'<b>협력사(외주업체) 기준정보</b>입니다. 여기 등록된 업체가 LOT 진행등록 · QR 입출고 · 외주발주의 '+
       '<b>외주처 선택 목록</b>과 <b>공정이동표의 연락처</b>로 사용됩니다.<br>'+
       '외주업체 계정의 소속(dept)에 <b>업체명을 그대로 입력</b>하면 QR 입출고 화면에서 해당 업체 LOT이 자동 표시됩니다. '+
       '외주가공 · 밀링 플래그가 모두 꺼지거나 미사용 처리하면 목록에서 제외됩니다.',
  edit:{ table:TBL.vendorT, pk:'vendor_code', rename:[], fields:[
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
        ['지역',80,'center','location_type'],['비고',0,'','remark']]
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
  edit:{ table:TBL.cycleRule, pk:'rule_id', rename:[], fields:[
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
  edit:{ table:TBL.moldType, pk:'mold_type_code', rename:[[TBL.moldSpecT,'mold_type_code']], fields:[
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
  edit:{ table:TBL.material, pk:'material_code', rename:[[TBL.moldSpecT,'material_code']], fields:[
    ['material_code','소재코드','text',null,'req'],
    ['material_name','소재명','text',null,'req'],
    ['density','비중','num',null,'req'],
    ['sort_order','순서','num'],
    ['remark','비고','area']
  ]}
},
'ven-stock':{
  table:OBJ.venStock, order:'vendor.asc,out_date.asc',
  note:'협력사가 <b>현재 보유 중인 물량</b>입니다. 미입고(미결) 반출건만 집계합니다.<br>'+
       '<b>보유수량</b> = 도착확인 수량(없으면 반출수량) − 다음 공정으로 이관한 수량 · '+
       '<b>부족</b> = 반출수량 − 도착확인 수량 (운송 중 파손 등)<br>'+
       '<b>도착대기</b> 상태로 체류일이 길면 QR 도착확인이 누락된 것이므로 업체에 확인이 필요합니다.',
  search:[['협력사','text','vendor'],['LOT','text','part'],['JOB','text','job'],
          ['공정','text','mp'],['상태','text','stock_status'],['납기','text','due_status']],
  cols:[['협력사',110,'','vendor'],['담당자',80,'','contact_name'],['연락처',110,'','contact_phone'],
        ['LOT',96,'','part'],['JOB',80,'','job'],
        ['공정',56,'center','mp'],['공정명',110,'','mp_name'],
        ['품번',100,'','map_part'],['금형제번',80,'center','mold_no'],
        ['반출일',88,'center','out_date'],['도착일',88,'center','arrived_date'],
        ['반출수량',80,'num','out_qty','n0'],['도착수량',80,'num','arrived_qty','n0'],
        ['이관',70,'num','moved_qty','n0'],
        ['보유수량',88,'num','stock_qty','n0'],['부족',60,'num','short_qty','n0'],
        ['체류(일)',70,'num','age_days'],
        ['상태',76,'center','stock_status','st'],['납기',88,'center','due_date'],
        ['납기상태',72,'center','due_status','st']]
},
'lot-token':{
  table:OBJ.lotToken, order:'issued_at.desc',
  note:'공정이동표 QR의 <b>발행 이력</b>입니다. QR에는 해당 LOT만 열람 · 기록할 수 있는 토큰이 들어 있어 '+
       '협력사는 <b>로그인 없이</b> 도착확인 · 출고 · 특기사항을 기록합니다.<br>'+
       '분실 · 훼손 시 이동표 화면의 <b>[♻ 재발행]</b>으로 기존 QR을 폐기하고 새로 출력하세요. '+
       '사내입고로 LOT이 종결되면 토큰은 자동 폐기됩니다.',
  search:[['LOT','text','part'],['JOB','text','job'],['상태','text','status'],
          ['발행자','text','issued_by'],['발행일','date2','issued_at']],
  cols:[['LOT',110,'','part'],['JOB',100,'','job'],['상태',70,'center','status','st'],
        ['발행일시',140,'center','issued_at','dt'],['발행자',90,'center','issued_by'],
        ['만료일시',140,'center','expires_at','dt'],
        ['최근사용',140,'center','last_used_at','dt'],['사용횟수',72,'num','use_count'],
        ['비고',0,'','remark']]
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
'shot-daily':{
  table:OBJ.shotDaily, order:'work_date.desc,mold_code.asc',
  note:'금형별 <b>일 생산 타발수</b>를 등록합니다. 저장하면 <b>금형대장의 누적 타발수</b>와 '+
       '<b>월별 타발수 대장</b>이 자동으로 갱신됩니다.<br>'+
       '연마 · 교체 도래현황은 이 값을 기준으로 <b>최근 30일 일평균</b>을 산출해 <b>예상 도래일</b>을 계산합니다. '+
       '일별 등록 시작 이전의 누적분은 금형대장의 <b>기초 타발수</b>로 보존됩니다.',
  search:[['금형제번','text','mold_code'],['금형명','text','mold_name'],
          ['작업일','date2','work_date'],['호기','text','machine_no'],['작업자','text','worker']],
  cols:[['작업일',92,'center','work_date'],['금형제번',92,'','mold_code'],['금형명',150,'','mold_name'],
        ['고객사',100,'','customer_name'],['등급',52,'center','grade','grade'],
        ['호기',56,'center','machine_no'],
        ['일 타발수',96,'num','shot_qty','n0'],['카운터',110,'num','counter_end','n0'],
        ['누적 타발수',120,'num','cum_shot','n0'],['수명',110,'num','shot_limit','n0'],
        ['작업자',80,'center','worker'],['비고',0,'','remark']],
  edit:{ table:TBL.shotDaily, pk:'mold_code', pk2:'work_date', auto:false, fields:[
    ['mold_code','금형제번','ref',{table:OBJ.moldMst,v:'mold_code',t:'mold_name'},'req'],
    ['work_date','작업일','date',null,'req'],
    ['machine_no','호기','ref',{table:OBJ.machine,v:'machine_no',t:'machine_name'}],
    ['shot_qty','일 타발수','num',null,'req'],
    ['counter_end','종료 카운터(참고)','num'],
    ['worker','작업자','text'],
    ['remark','비고','area']
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
  note:'금형 보관장소 기준입니다. 금형대장의 <b>보관장소</b> 선택 목록으로 사용됩니다.<br>'+
       '<b>장소코드</b>는 [수정]에서 직접 바꿀 수 있으며, 바꾸면 그 장소에 있던 '+
       '<b>금형대장의 보관장소</b>도 새 코드로 함께 갱신됩니다.',
  search:[['장소코드','text','location_code'],['장소명','text','location_name']],
  cols:[['장소코드',100,'','location_code'],['장소명',220,'','location_name'],
        ['공장',80,'center','factory_code'],['순서',60,'num','sort_order'],
        ['사용',56,'center','is_active','bool'],['비고',0,'','remark']],
  edit:{ table:TBL.moldLoc, pk:'location_code', rename:[[TBL.mold,'location']], fields:[
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
  edit:{ table:TBL.machine, pk:'machine_no', rename:[[TBL.mold,'machine_no'],[TBL.shotDaily,'machine_no']], fields:[
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
