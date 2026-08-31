/* lot_qr.html 협력사 앱 — 취소 · 미처리 반납 로직 단위검증 */
const fs=require('fs');
const src=fs.readFileSync('/home/claude/lot_qr.html','utf8');
const seg=fs.readFileSync('/tmp/seg.js','utf8');
const num=v=>Number(String(v==null?0:v).toString().replace(/[^0-9.-]/g,''))||0;
const mk=(D)=>new Function('D','num', seg+
  '\n return {LIVE,movedOf,arrQtyOf,remainOf,arrivedOf,undoneOf,lastMoveId,undoable};')(D,num);

let P=0,F=0; const ok=(n,c,d)=>{ c?P++:(F++,console.log('  ❌ '+n+(d?' — '+d:''))); };

/* ① 취소된 도착기록은 없는 것으로 본다 */
let D={last_move:3,receipt:null,osp:[{no:1,mp:'HQ',qty:1000}],
  moves:[{move_id:3,osp_no:1,io:'도착',mp:'HQ',in_qty:400,void:false},
         {move_id:2,osp_no:1,io:'도착',mp:'HQ',in_qty:900,void:true,void_reason:'수량 오등록'}]};
let T=mk(D);
ok('① 취소분 제외 도착수량', T.arrQtyOf(1)===400, '='+T.arrQtyOf(1));
ok('② 잔량 계산', T.remainOf({no:1,qty:1000})===400, '='+T.remainOf({no:1,qty:1000}));

/* ③ 전량 취소되면 도착 이력이 없다 */
D={last_move:0,receipt:null,osp:[{no:1,mp:'HQ',qty:1000}],
   moves:[{move_id:2,osp_no:1,io:'도착',mp:'HQ',in_qty:900,void:true}]};
T=mk(D);
ok('③ 전량취소 → 미도착', T.arrivedOf({no:1})===null && T.remainOf({no:1,qty:1000})===1000);

/* ④ 미처리 반납 잔량 */
D={last_move:5,receipt:null,
   osp:[{no:1,mp:'GS',qty:1000},{no:2,mp:'GS',qty:120,rework:true,rework_kind:'미처리'}],
   moves:[{move_id:5,osp_no:1,io:'입고',mp:'GS',in_qty:1000,undone_qty:300,void:false}]};
T=mk(D);
ok('④ 미처리 잔량 (재반출 차감)', T.undoneOf('GS')===180, '='+T.undoneOf('GS'));

/* ⑤ 마지막 기록만 취소 가능 */
D={last_move:9,receipt:null,osp:[],
   moves:[{move_id:9,io:'출고',mp:'GS',void:false},
          {move_id:8,io:'입고',mp:'HQ',in_qty:500,void:false}]};
T=mk(D);
ok('⑤ 출고가 뒤에 있으면 취소 불가', T.undoable()===null);

D={last_move:8,receipt:null,osp:[],
   moves:[{move_id:8,io:'입고',mp:'HQ',in_qty:500,move_date:'2026-08-30',void:false}]};
T=mk(D);
ok('⑥ 마지막 입고는 취소 가능', T.undoable()&&T.undoable().move_id===8);

/* ⑦ 사내입고(종결)된 LOT은 취소 불가 */
D={last_move:8,receipt:{in_date:'2026-08-31',qty:500},osp:[],
   moves:[{move_id:8,io:'입고',mp:'HQ',in_qty:500,void:false}]};
T=mk(D);
ok('⑦ 종결 LOT 취소 불가', T.undoable()===null);

/* ⑧ 완료 공정 판정 : 전량 미처리면 완료 아님 */
const seen=(moves)=>new Set(moves.filter(m=>!m.void&&m.mp&&m.io==='입고'&&
  (num(m.in_qty)-num(m.undone_qty))>0).map(m=>m.mp));
ok('⑧ 전량 미처리 → 공정 미완료',
   !seen([{mp:'GS',io:'입고',in_qty:500,undone_qty:500}]).has('GS'));
ok('⑨ 일부 가공 → 공정 완료로 인정',
   seen([{mp:'GS',io:'입고',in_qty:500,undone_qty:200}]).has('GS'));
ok('⑩ 도착만으로는 완료 아님', !seen([{mp:'GS',io:'도착',in_qty:500}]).has('GS'));

console.log(F?`\n  통과 ${P} · 실패 ${F}`:`  ✅ 협력사 앱 로직 ${P}항목 전부 통과`);
process.exit(F?1:0);
