/* ============================================================
   ki_demo_data.js — 등록예제 안내 : 화면별 예시데이터 + 등록요점
   · 하나의 시나리오로 연결 (rule 7)
       협력사 (주)한빛열처리(V-901) → 표준공정 MA→MF→GM
       → 금형제번 M-2401 / 품번 MB-100-FR → LOT 진행등록(반출)
   · 저장 버튼은 강조·설명만 (rule 1,2)
   · 자동계산 칸은 값을 넣지 않고 원본 칸 이벤트로 계산시킴 (rule 3)
   · 날짜는 오늘 기준 상대일 (rule 4)
   · 키 중복 시 끝자리 자동 증가 (rule 5)
   · 목록형 칸은 등록된 첫 항목 자동 선택, 비면 건너뜀 (rule 6)
   · 일부러 비워두는 칸 있음 (rule 8)
============================================================ */
var KIDEMO = (function(){
'use strict';
const K = KIDemo, day = K.day, uniq = K.uniq, colValues = K.colValues, firstOpt = K.firstOpt;

/* 공통 시나리오 상수 */
const SC = {
  ven  : '(주)한빛열처리',
  vcode: 'V-901',
  part : 'MB-100-FR',
  mold : 'M-2401',
  owner: '현대모비스',
  route: 'TEST_열처리 3공정'
};
const wait = (label,tip,el)=>({t:'say', el:el, label:label, tip:tip});

/* ------------------------------------------------------------
   1. 기준정보 › 외주기준 › 협력사 정보  (폼형 · 그리드 모달)
------------------------------------------------------------ */
function vendor(){
  const code = uniq(SC.vcode, colValues(1));   /* 업체코드 열 */
  return [
    {t:'click', el:()=>K.actBtn('등록'), label:'등록',
     tip:'협력사 등록은 <b>[등록]</b>으로 시작합니다. 여기 등록된 업체만 LOT 진행등록 · QR 입출고의 '+
         '<b>외주처 목록</b>에 나타납니다.'},
    {t:'fill', el:'#e_vendor_code', value:code, wait:3000, label:'업체코드',
     tip:'한 번 정하면 바꾸지 않는 <b>키 값</b>입니다. 발주 · 이동표 · 재고현황이 모두 이 코드로 묶이므로 '+
         '사내 규칙(V-9xx 등)을 지켜 부여하세요.'},
    {t:'fill', el:'#e_vendor_name', value:SC.ven, label:'업체명',
     tip:'사업자등록증 상호와 <b>철자까지 동일</b>하게. 외주업체 계정의 소속(dept)에 이 이름을 그대로 넣어야 '+
         'QR 입출고에서 그 업체 LOT이 자동으로 보입니다.'},
    {t:'fill', el:'#e_vendor_type', value:'열처리', label:'구분',
     tip:'가공 성격 구분. 협력사 재고현황·납기 집계를 구분별로 볼 때 쓰입니다.'},
    {t:'fill', el:'#e_proc_codes', value:'HQ,GS', label:'담당 공정코드',
     tip:'이 업체가 실제로 하는 공정코드를 쉼표로. <b>표준 공정경로의 코드와 같아야</b> '+
         '반출 시 외주처가 올바르게 추천됩니다.'},
    {t:'fill', el:'#e_ceo_name', value:'박정호', label:'대표자',
     tip:'세금계산서 · 계약 확인용. 실무에서는 담당자보다 변동이 적어 기준값으로 둡니다.'},
    {t:'fill', el:'#e_phone', value:'031-495-1200', label:'대표전화',
     tip:'담당자 부재 시 연결되는 번호. 공정이동표(QR) 하단 연락처로 인쇄됩니다.'},
    {t:'fill', el:'#e_contact_name', value:'김현수', label:'담당자',
     tip:'납기 · 부족수량을 실제로 협의하는 사람. 바뀌면 즉시 수정해야 지연 대응이 빨라집니다.'},
    {t:'fill', el:'#e_contact_phone', value:'010-2345-6789', label:'담당자 연락처',
     tip:'휴대전화로. 도착확인 누락 · 체류일 초과 시 가장 먼저 연락하는 번호입니다.'},
    {t:'fill', el:'#e_outsourcing_flag', value:'true', label:'외주가공',
     tip:'꺼두면 외주처 선택 목록에서 <b>제외</b>됩니다. 거래 종료 시 삭제하지 말고 이 값을 끄세요.'},
    {t:'fill', el:'#e_is_active', value:'true', label:'사용',
     tip:'과거 이력은 남기고 신규 선택만 막고 싶을 때 미사용으로. 삭제하면 이력 추적이 끊깁니다.'},
    wait('이메일 · 주소 (비워둠)',
         '실제 확인된 정보만 넣습니다. <b>추정값을 채우면</b> 발주서가 잘못된 곳으로 나가므로 '+
         '확인 전까지는 비워두는 것이 안전합니다.', '#e_email'),
    wait('저장은 직접',
         '내용을 확인한 뒤 <b>[저장]</b>을 눌러 등록하세요. 안내는 값만 채우고 저장하지 않습니다.', '#eSave')
  ];
}

/* ------------------------------------------------------------
   2. 기준정보 › 외주기준 › 표준 공정경로  (폼형 · 그리드 모달)
------------------------------------------------------------ */
function stdRoute(){
  const nos = colValues(2).map(v=>Number(String(v).replace(/[^0-9]/g,''))).filter(n=>!isNaN(n));
  const no  = (nos.length?Math.max.apply(null,nos):900)+1;
  const name= uniq(SC.route, colValues(3));
  return [
    {t:'click', el:()=>K.actBtn('등록'), label:'등록',
     tip:'표준 공정경로는 LOT <b>진척률의 기준</b>입니다. 여기가 비어 있으면 진행등록에서 공정을 고를 수 없습니다.'},
    {t:'fill', el:'#e_standard_process_no', value:String(no), wait:3000, label:'표준공정번호',
     tip:'경로를 식별하는 번호. 기존 번호와 겹치면 저장되지 않으므로 <b>비어 있는 다음 번호</b>를 씁니다.'},
    {t:'fill', el:'#e_standard_process_name', value:name, label:'표준공정명',
     tip:'현장에서 부르는 이름 그대로. 진행등록 · 이동표 · 진척 화면에 그대로 표시됩니다.'},
    {t:'fill', el:'#e_steps', value:'MA → MF → GM', label:'가공공정 순서',
     tip:'실제 가공 순서를 <b>코드로</b>, 화살표로 구분해 입력합니다. 이 순서가 곧 진척 분모(3단계)가 되고 '+
         '반출 시 <b>다음 공정</b>을 자동으로 제안합니다.'},
    wait('저장은 직접',
         '순서를 다시 확인한 뒤 <b>[저장]</b>을 누르세요. 순서를 잘못 넣으면 진척률이 실제와 어긋납니다.', '#eSave')
  ];
}

/* ------------------------------------------------------------
   3. 기준정보 › 생산기준 › 금형정보  (폼형 · 자동계산 시연)
------------------------------------------------------------ */
function moldSpec(){
  const no  = uniq(SC.mold, colValues(1));
  const part= uniq(SC.part, colValues(9));
  const mat = firstOpt('#f_mat'), typ = firstOpt('#f_type');
  return [
    {t:'click', el:()=>K.actBtn('새로입력'), label:'새로입력',
     tip:'수정 중인 내용이 남아 있을 수 있으므로 신규 등록은 항상 <b>[새로입력]</b>부터 시작합니다.'},
    {t:'fill', el:'#f_no', value:no, label:'금형제번',
     tip:'금형을 식별하는 <b>키</b>. 저장 후에는 바꿀 수 없고, 금형대장 · 타발수 · 점검이력이 모두 이 번호로 묶입니다.'},
    typ ? {t:'fill', el:'#f_type', value:typ, label:'금형타입',
     tip:'금형타입 기준정보에 등록된 값에서 고릅니다. 연마 · 교체 주기를 타입별로 다르게 줄 때 기준이 됩니다.'} : null,
    mat ? {t:'fill', el:'#f_mat', value:mat, label:'소재재질',
     tip:'재질을 고르면 <b>비중이 자동으로</b> 들어옵니다. 비중을 손으로 고치면 소재중량이 실제와 달라지니 '+
         '재질 기준정보를 먼저 정비하세요.'} : null,
    {t:'fill', el:'#f_t', value:'1.2', label:'소재두께(mm)',
     tip:'실측 두께. 두께 · 폭 · 피치는 소재중량 계산의 3요소이므로 도면값이 아니라 <b>실제 투입 소재</b> 기준으로.'},
    {t:'fill', el:'#f_w', value:'68', label:'소재폭(mm)',
     tip:'코일 폭. 폭이 바뀌면 원단위가 바뀌므로 소재 변경 시 반드시 갱신합니다.'},
    {t:'fill', el:'#f_p', value:'24', label:'피치(mm)',
     tip:'1타당 이송 거리. 여기까지 넣으면 소재중량이 <b>즉시 계산</b>되는 것을 볼 수 있습니다.'},
    wait('소재중량(g) — 자동계산',
         '두께 · 폭 · 피치 · 비중으로 <b>시스템이 계산</b>합니다. 직접 입력하는 칸이 아니며, '+
         '값이 이상하면 원인은 항상 네 개의 입력값 쪽에 있습니다.', '#f_g'),
    {t:'fill', el:'#f_part', value:part, label:'매칭품번',
     tip:'이 금형으로 생산되는 제품번호. <b>LOT 진행등록의 품번과 문자 하나까지 같아야</b> '+
         '금형제번 · 자산처가 자동으로 따라붙습니다.'},
    {t:'fill', el:'#f_own', value:SC.owner, label:'자산처',
     tip:'금형 소유처(고객사). 사외 자산은 반출 · 폐기 시 승인 대상이므로 반드시 기입합니다.'},
    wait('저장은 직접',
         '<b>[저장]</b>을 눌러야 등록됩니다. 저장 후 LOT 진행등록에서 품번을 치면 이 금형이 매칭됩니다.',
         ()=>K.actBtn('저장'))
  ];
}

/* ------------------------------------------------------------
   4. LOT관리 › LOT 진행등록  (조회형 → 신규 → 반출 입력)
   · ctx.jobBtn : JOB 자동생성 버튼 id, ctx.partCol : 목록의 품번 열 번호
------------------------------------------------------------ */
function lotRoute(ctx){
  ctx=ctx||{};
  const partCol = ctx.partCol||2;
  const listPart= (colValues(partCol,'.lr-list .grid')[0]||SC.part);
  const lot     = 'LOT-'+day(0).replace(/-/g,'').slice(2)+'-01';
  return [
    {t:'click', el:()=>K.actBtn('신규등록'), label:'신규등록',
     tip:'목록에서 LOT 행을 클릭하면 <b>이어서 다음 공정</b>을 등록하고, 처음 반출하는 LOT은 '+
         '<b>[신규등록]</b>으로 시작합니다.'},
    {t:'click', el:'#'+(ctx.jobBtn||'fJobGen'), wait:3000, label:'JOB 자동생성',
     tip:'JOB은 이 LOT 묶음의 관리번호입니다. 버튼을 누르면 <b>JOB-YYMMDD##</b> 형식으로 '+
         '중복을 피해 자동 채번됩니다. 수기로 넣으면 중복 위험이 있습니다.'},
    {t:'fill', el:'#fMap', value:listPart, label:'품번',
     tip:'금형정보에 등록된 <b>매칭품번</b>을 입력합니다. 일치하면 아래에 금형제번 · 자산처가 '+
         '바로 표시됩니다 — 표시가 없으면 금형정보부터 등록하세요.'},
    {t:'fill', el:'#fRoute', value:()=>firstOpt('#fRoute'), label:'표준공정',
     tip:'이 LOT이 따라갈 공정경로. 선택하는 순간 <b>가공공정 목록이 그 경로의 단계로</b> 바뀌고, '+
         '진척률의 분모가 정해집니다.'},
    {t:'fill', el:'#fMp', value:()=>firstOpt('#fMp'), label:'가공공정',
     tip:'이번에 <b>보낼</b> 공정을 고릅니다. 이미 끝난 단계에는 ✓완료 표시가 붙으므로 '+
         '중복 반출을 막을 수 있습니다.'},
    {t:'fill', el:'#fVen', value:()=>firstOpt('#fVen'), label:'외주처',
     tip:'협력사 정보에 등록된 업체만 나옵니다. 여기서 고른 업체가 <b>협력사 재고현황의 보유처</b>가 되고 '+
         '체류일이 이 시점부터 계산됩니다.'},
    {t:'fill', el:'#fSdate', value:day(0), label:'출고(반출)일',
     tip:'제품이 실제로 나간 날. 협력사 <b>체류일 · 납기지연</b>이 이 날짜 기준으로 산출되므로 '+
         '소급 입력할 때도 실제 출고일을 넣습니다.'},
    {t:'fill', el:'#fEdate', value:day(7), label:'납기일',
     tip:'업체와 약속한 회수 예정일. 오늘 기준 <b>+7일</b>로 잡았습니다. '+
         '이 날짜가 지나면 재고현황에서 지연으로 잡힙니다.'},
    {t:'fill', el:'#fQuote', value:'1200', label:'단가',
     tip:'가공 단가(원/EA). 정산 대조용이며 비어 있어도 반출은 되지만, 넣어두면 외주비 집계가 가능합니다.'},
    {t:'fill', el:()=>K.q('#lotBody tr .lLot'), value:lot, label:'LOT 번호',
     tip:'현품표의 LOT 그대로. 이 번호가 <b>공정이동표 QR</b>이 되어 협력사 도착확인 · 출고에 쓰입니다. '+
         '한 번에 여러 LOT을 보낼 때는 [+ LOT 추가].'},
    {t:'fill', el:()=>K.q('#lotBody tr .lQty'), value:'1000', label:'수량',
     tip:'실제 반출 수량. 도착확인 수량과 비교해 <b>부족수량</b>이 자동 산출되므로 현품과 반드시 일치시켜야 합니다.'},
    wait('총수량 — 자동계산',
         'LOT 행 합계가 <b>자동으로</b> 채워집니다. 직접 입력하는 칸이 아니며, 합계가 다르면 '+
         'LOT 행의 수량을 고치세요.', '#fQty'),
    wait('반출 등록은 직접',
         '내용을 확인한 뒤 <b>[반출 등록]</b>을 누르면 저장되고, 이어서 <b>[이동표(QR)]</b>를 인쇄해 '+
         '제품과 함께 보냅니다. 안내는 저장하지 않습니다.', '#mS')
  ];
}

return {'vendor':vendor, 'std-route':stdRoute, 'mold-spec':moldSpec, 'lot-route':lotRoute};
})();
