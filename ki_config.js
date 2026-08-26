/* ============================================================
   KI MES 공통 설정
   · 이전 시 아래 SUPABASE 2줄과 DB_PREFIX만 변경
============================================================ */
const KI_CFG = {
  APP_NAME : 'KI MES',
  VER      : 'v6.5',
  SUPABASE_URL : 'https://ipggvrzxfcryzryileuv.supabase.co',
  SUPABASE_KEY : 'sb_publishable_CHO-dAOU00HNwno52255mg_H3C1_vew',
  DB_PREFIX    : 'ki_',
  LANDING      : 'mold_due.html',   // 로그인 후 기본 화면
  PIN_LEN      : 6,
  DEFAULT_PIN  : '123456',
  SESSION_DAYS : 7,
  MAX_FAIL     : 5,
  LOCKOUT_SEC  : 60
};

/* --- DB 오브젝트 --- */
const P = KI_CFG.DB_PREFIX;
const OBJ = {
  settings : P+'app_settings',
  /* 금형 정기점검 */
  moldDue  : P+'v_mold_due',   moldMst  : P+'v_mold',
  inspHist : P+'v_inspection_history', inspDet : P+'v_inspection_detail',
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
  chkMach  : P+'v_check_machine', chkMold : P+'v_check_mold',
  /* 시스템 */
  employee : P+'v_employee',   permission : P+'v_permission'
};

/* ============================================================
   메뉴 구성 : 1차 모듈 > 2차 아이콘 > 그룹 > 화면(파일)
============================================================ */
const MENU = [
  { key:'mold', name:'금형관리', second:[
    { key:'m-insp', name:'정기점검', icon:'🛠', groups:[
      { name:'정기점검', items:[
        {id:'mold-due',    f:'mold_due.html',              n:'점검 도래현황', d:'주기 도래 · 지연 D-day'},
        {id:'mold-insp',   f:'mold_inspection.html',       n:'점검 실적',     d:'금형별 정기점검 결과'},
        {id:'mold-detail', f:'mold_inspection_detail.html',n:'점검 항목결과', d:'항목별 측정값 · 판정'}
      ]}
    ]},
    { key:'m-base', name:'금형기준', icon:'▥', groups:[
      { name:'기준정보', items:[
        {id:'mold-master', f:'mold_master.html',      n:'금형대장',  d:'금형 기준정보 · 타발수'},
        {id:'insp-item',   f:'inspection_item.html',  n:'점검 항목', d:'점검 항목 · 기준값'}
      ]}
    ]}
  ]},

  { key:'osp', name:'외주LOT관리', second:[
    { key:'o-io', name:'외주 입출고', icon:'↔', groups:[
      { name:'외주 진행', items:[
        {id:'osp-order',   f:'osp_order.html',   n:'외주발주',       d:'JOB·부품(LOT) 발주현황'},
        {id:'osp-issue',   f:'osp_issue.html',   n:'외주출고(반출)', d:'외주처 반출 LOT'},
        {id:'osp-receipt', f:'osp_receipt.html', n:'외주입고',       d:'가공 완료 입고 확인'},
        {id:'osp-stock',   f:'osp_stock.html',   n:'미입고 재공',    d:'외주처 보유 재공·경과일'}
      ]}
    ]},
    { key:'o-lot', name:'LOT 추적', icon:'🔎', groups:[
      { name:'추적', items:[
        {id:'lot-trace', f:'lot_trace.html', n:'LOT 이동이력', d:'외주업체 경유 이력'},
        {id:'lot-route', f:'lot_route.html', n:'LOT 진행현황', d:'공정 진척 · 현재 위치'}
      ]},
      { name:'기준', items:[
        {id:'std-route', f:'std_route.html', n:'표준 공정경로', d:'표준공정 가공순서'},
        {id:'vendor',    f:'vendor.html',    n:'외주업체',      d:'외주 가공 거래처'}
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
      { name:'설비 / 금형', items:[
        {id:'mold-spec', f:'mold_spec.html', n:'금형정보', d:'금형 등록·수정·삭제 / 타입·비중 참조'},
        {id:'machine',   f:'machine.html',   n:'호기설정', d:'호기번호 · 호기명'}
      ]}
    ]},
    { key:'b-chk', name:'점검기준', icon:'🔧', groups:[
      { name:'점검 기준정보', items:[
        {id:'chk-mach', f:'check_machine.html', n:'설비 점검기준', d:'일상 · 정기 점검항목 / 판정기준'},
        {id:'chk-mold', f:'check_mold.html',    n:'금형 점검기준', d:'일상 · 정기 점검항목 / 판정기준'}
      ]}
    ]}
  ]},

  { key:'sys', name:'시스템', second:[
    { key:'s-sys', name:'시스템', icon:'⚙', groups:[
      { name:'시스템', items:[
        {id:'settings',   f:'settings.html',   n:'비밀번호 설정', d:'마스터 / 사용자 PIN'},
        {id:'employee',   f:'employee.html',   n:'사원등록',     d:'사번 · 성명 · 부서 · 직위'},
        {id:'permission', f:'permission.html', n:'권한설정',     d:'사원별 화면 조회/저장/수정/삭제'}
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
'mold-due':{
  table:OBJ.moldDue, order:'next_inspection.asc',
  search:[['금형코드','text','mold_code'],['금형명','text','mold_name'],['고객사','text','customer_name'],
          ['도래상태','sel-due','due_status'],['점검예정일','date2','next_inspection'],['공장','sel-fac','factory_code']],
  cols:[['금형코드',92,'','mold_code'],['금형명',150,'','mold_name'],['고객사',100,'','customer_name'],
        ['금형종류',100,'center','mold_type'],['보관위치',110,'','location'],
        ['타발수',92,'num','shot_count','n0'],['수명',92,'num','shot_limit','n0'],
        ['수명소진',96,'','shot_rate_pct','bar'],['주기(일)',64,'num','cycle_days'],
        ['최근점검',92,'center','last_inspection'],['점검예정',92,'center','next_inspection'],
        ['D-day',70,'num','d_day','dday'],['도래',70,'center','due_status','st'],
        ['상태',70,'center','status','st'],['비고',0,'','remark']]
},
'mold-insp':{
  table:OBJ.inspHist, order:'inspection_date.desc',
  search:[['금형코드','text','mold_code'],['금형명','text','mold_name'],['점검자','text','inspector'],
          ['판정','sel-judge','judgement'],['점검일','date2','inspection_date'],['고객사','text','customer_name']],
  cols:[['점검번호',72,'center','inspection_no'],['점검일',92,'center','inspection_date'],
        ['금형코드',92,'','mold_code'],['금형명',150,'','mold_name'],['고객사',100,'','customer_name'],
        ['점검자',80,'center','inspector'],['타발수',96,'num','shot_count','n0'],
        ['판정',90,'center','judgement','st'],['부적합',64,'num','defect_count'],
        ['조치내용',170,'','action_taken'],['다음점검',92,'center','next_inspection'],['비고',0,'','remark']]
},
'mold-detail':{
  table:OBJ.inspDet, order:'inspection_no.desc',
  search:[['금형코드','text','mold_code'],['점검번호','text','inspection_no'],['점검항목','text','item_name'],
          ['판정','sel-res','result'],['점검일','date2','inspection_date'],['금형명','text','mold_name']],
  cols:[['점검번호',72,'center','inspection_no'],['점검일',92,'center','inspection_date'],
        ['금형코드',92,'','mold_code'],['금형명',140,'','mold_name'],
        ['항목코드',72,'center','item_code'],['점검항목',150,'','item_name'],
        ['기준',160,'','criteria'],['측정값',86,'center','measured_value'],
        ['판정',70,'center','result','st'],['비고',0,'','remark']]
},
'mold-master':{
  table:OBJ.moldMst, order:'mold_code.asc',
  search:[['금형코드','text','mold_code'],['금형명','text','mold_name'],['고객사','text','customer_name'],
          ['금형종류','text','mold_type'],['상태','sel-mst','status'],['보관위치','text','location']],
  cols:[['금형코드',92,'','mold_code'],['금형명',150,'','mold_name'],['고객사',100,'','customer_name'],
        ['모델',90,'','model'],['금형종류',100,'center','mold_type'],['공장',60,'center','factory_code'],
        ['보관위치',110,'','location'],['타발수',96,'num','shot_count','n0'],['수명',96,'num','shot_limit','n0'],
        ['주기(일)',64,'num','cycle_days'],['최근점검',92,'center','last_inspection'],
        ['점검예정',92,'center','next_inspection'],['상태',70,'center','status','st'],['비고',0,'','remark']]
},
'insp-item':{
  table:OBJ.inspItem, order:'sort_order.asc',
  search:[['항목코드','text','item_code'],['점검항목','text','item_name'],['분류','text','category']],
  cols:[['항목코드',80,'center','item_code'],['점검항목',180,'','item_name'],['분류',80,'center','category'],
        ['점검방법',90,'center','method'],['기준',220,'','criteria'],['단위',60,'center','unit'],
        ['순서',56,'num','sort_order'],['사용',56,'center','is_active','bool']]
},

'osp-order':{
  table:OBJ.ospOrder, order:'no.asc',
  search:[['외주처','sel-vendor','vendor'],['JOB(관리번호)','text','job'],['부품번호','text','part'],
          ['가공공정','sel-mp','mp'],['발주일','date2','odate'],['상태','sel-ost','st']],
  cols:[['No',46,'center','no'],['상태',64,'center','st','st'],['발주일',88,'center','odate'],
        ['외주처',110,'','vendor'],['JOB(관리번호)',118,'','job'],['제품명',140,'','item'],
        ['부품번호(LOT)',110,'','part'],['부품명',150,'','partName'],
        ['공정',50,'center','proc'],['순서',56,'center','procName'],['가공공정',86,'center','mp','mp'],
        ['납기',88,'center','edate'],['입고일',88,'center','idate'],['외주금액',92,'num','quote','won']]
},
'osp-issue':{
  table:OBJ.ospOrder, order:'odate.desc', post:'issue',
  search:[['외주처','sel-vendor','vendor'],['JOB(관리번호)','text','job'],['부품번호','text','part'],
          ['가공공정','sel-mp','mp'],['반출일','date2','odate'],['상태','sel-ost','st']],
  cols:[['No',46,'center','_i'],['반출일(발주)',96,'center','odate'],['외주처',120,'','vendor'],
        ['JOB(관리번호)',118,'','job'],['부품번호(LOT)',110,'','part'],['부품명',150,'','partName'],
        ['공정',50,'center','proc'],['가공공정',86,'center','mp','mp'],['납기',88,'center','edate'],
        ['회수(입고)일',96,'center','idate'],['상태',64,'center','st','st'],['제품명',0,'','item']]
},
'osp-receipt':{
  table:OBJ.ospRecv, order:'no.asc',
  search:[['외주처','sel-vendor','vendor'],['JOB(관리번호)','text','job'],['부품번호','text','part'],
          ['가공공정','sel-mp','mp'],['입고일','date2','idate'],['확인상태','sel-rst','status']],
  cols:[['No',46,'center','no'],['확인',64,'center','status','st'],['입고일',88,'center','idate'],
        ['외주처',118,'','vendor'],['JOB(관리번호)',118,'','job'],
        ['부품번호(LOT)',110,'','part'],['부품명',140,'','partName'],
        ['공정',50,'center','proc'],['순서',56,'center','procName'],
        ['가공공정',72,'center','mp'],['가공공정명',130,'','mpName'],
        ['발주일',88,'center','odate'],['외주금액',92,'num','quote','won']]
},
'osp-stock':{
  table:OBJ.ospOrder, order:'odate.asc', post:'stock',
  search:[['외주처','sel-vendor','vendor'],['JOB(관리번호)','text','job'],['부품번호','text','part'],
          ['가공공정','sel-mp','mp'],['반출일','date2','odate'],['경과일(이상)','num','_days']],
  cols:[['No',46,'center','_i'],['경과',62,'num','_days','days'],['외주처',120,'','vendor'],
        ['JOB(관리번호)',118,'','job'],['부품번호(LOT)',110,'','part'],['부품명',150,'','partName'],
        ['공정',50,'center','proc'],['가공공정',86,'center','mp','mp'],
        ['반출일',88,'center','odate'],['납기',88,'center','edate'],
        ['납기상태',80,'center','_due','st'],['외주금액',92,'num','quote','won'],['제품명',0,'','item']]
},
'lot-trace':{
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
  search:[['부품번호(LOT)','text','part'],['JOB(관리번호)','text','job'],['현재 외주처','sel-vendor','vendor'],
          ['현재 공정','sel-mp','mp'],['최근 이동일','date2','date'],['진척(%이상)','num','_rate']],
  cols:[['No',46,'center','_i'],['JOB(관리번호)',118,'','job'],['부품번호(LOT)',110,'','part'],
        ['공정',50,'center','proc'],['표준공정',110,'','stdName'],
        ['현재 가공공정',96,'center','mp'],['현재 가공공정명',126,'','mpName'],
        ['현재 외주업체',126,'','vendor'],['최근 이동일',96,'center','date'],
        ['다음 공정',130,'','nextMp'],['완료',52,'num','done'],['총단계',56,'num','total'],
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
  search:[['공장코드','text','factory_code'],['공장명','text','factory_name']],
  cols:[['공장코드',90,'center','factory_code'],['공장명',200,'','factory_name'],
        ['가로(m)',80,'num','width_m'],['세로(m)',80,'num','height_m'],['비고',0,'','remark']]
},
'zone':{
  table:OBJ.zone, order:'zone_code.asc',
  search:[['구역코드','text','zone_code'],['구역명','text','zone_name'],['공장','sel-fac','factory_code']],
  cols:[['구역코드',90,'center','zone_code'],['공장',70,'center','factory_code'],['구역명',170,'','zone_name'],
        ['X',60,'num','x'],['Y',60,'num','y'],['폭',60,'num','w'],['높이',60,'num','h'],
        ['색상',80,'center','color','color'],['비고',0,'','remark']]
},
'asset':{
  table:OBJ.asset, order:'asset_code.asc',
  search:[['설비코드','text','asset_code'],['설비명','text','asset_name'],['공장','sel-fac','factory_code'],
          ['구역코드','text','zone_code'],['설비구분','text','asset_type'],['상태','sel-asset','status']],
  cols:[['설비코드',90,'','asset_code'],['설비명',160,'','asset_name'],['구분',80,'center','asset_type'],
        ['공장',70,'center','factory_code'],['구역',80,'center','zone_code'],
        ['X',60,'num','x'],['Y',60,'num','y'],['상태',80,'center','status','st'],
        ['사양',110,'','spec'],['최종신호',140,'center','last_signal','dt'],['비고',0,'','remark']]
},

'env-hist':{
  table:OBJ.envHist, order:'measured_at.desc',
  search:[['센서','sel-sensor','sensor_code'],['센서명','text','sensor_name'],['구역','text','zone_code'],
          ['측정시각','date2','measured_at']],
  cols:[['측정시각',150,'center','measured_at','dt'],['센서',86,'','sensor_code'],['센서명',160,'','sensor_name'],
        ['구역',80,'center','zone_code'],['온도(℃)',92,'num','temperature'],['습도(%)',92,'num','humidity'],['',0,'','']]
},
'env-alert':{
  table:OBJ.envAlert, order:'occurred_at.desc',
  search:[['센서','sel-sensor','sensor_code'],['알람구분','sel-alert','alert_type'],
          ['처리상태','sel-astat','status'],['발생시각','date2','occurred_at']],
  cols:[['발생시각',150,'center','occurred_at','dt'],['센서',86,'','sensor_code'],['센서명',160,'','sensor_name'],
        ['구역',80,'center','zone_code'],['알람',80,'center','alert_type','st'],
        ['측정값',86,'num','value'],['임계값',86,'num','threshold'],
        ['상태',80,'center','status','st'],['조치',0,'','action']]
},
'machine':{
  table:OBJ.machine, order:'sort_order.asc',
  search:[['호기번호','text','machine_no'],['호기명','text','machine_name']],
  cols:[['호기번호',100,'center','machine_no'],['호기명',220,'','machine_name'],
        ['톤수',80,'num','tonnage'],['순서',60,'num','sort_order'],
        ['사용',60,'center','is_active','bool'],['비고',0,'','remark']]
},
'employee':{
  table:OBJ.employee, order:'emp_no.asc',
  search:[['사번','text','emp_no'],['성명','text','emp_name'],['부서','text','dept'],
          ['직위','text','position'],['권한','sel-role','role'],['공장','sel-fac','factory']],
  cols:[['사번',90,'center','emp_no'],['성명',110,'','emp_name'],['부서',120,'','dept'],
        ['직위',90,'center','position'],['공장',70,'center','factory'],
        ['권한',80,'center','role','st'],['입사일',96,'center','hire_date'],
        ['연락처',130,'','phone'],['사용',56,'center','is_active','bool'],['비고',0,'','remark']]
},
'permission':{
  table:OBJ.permission, order:'emp_no.asc',
  note:'사원별 화면 접근 권한입니다. <b>조회</b> 권한이 없는 화면은 메뉴에서 숨겨집니다.',
  search:[['사번','text','emp_no'],['성명','text','emp_name'],['화면명','text','menu_name'],
          ['부서','text','dept'],['권한','sel-role','role']],
  cols:[['사번',86,'center','emp_no'],['성명',96,'','emp_name'],['부서',110,'','dept'],
        ['직위',80,'center','position'],['권한',76,'center','role','st'],
        ['화면ID',110,'','menu_id'],['화면명',170,'','menu_name'],
        ['조회',60,'center','can_view','bool'],['저장',60,'center','can_save','bool'],
        ['수정',60,'center','can_edit','bool'],['삭제',60,'center','can_delete','bool'],
        ['수정일시',150,'center','updated_at','dt']]
},
'sensor':{
  table:OBJ.sensor, order:'sensor_code.asc',
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
