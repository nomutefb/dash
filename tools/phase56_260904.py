# -*- coding: utf-8 -*-
# [260904 Phase5·6] (5) 이력 흡수 — 공연마스터_이력·일일입력_이력 은 판매설정·일일실적에 합류됨(DB) → 클라이언트 병합 틱 폐지 / 프로그램마스터 _json 봉인 폐기(열에서 직접 구성)
#                    (6) 이름 조인 제거 — _finOf 는 사업코드 조인만 / 홍보 게이트는 records.공연ID 우선
#   실행: python3 tools/phase56_260904.py (먼저 backups/ 로 cp)
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
def rep(a,b,label):
    global s
    n=s.count(a); assert n==1, 'anchor %s: %d'%(label,n)
    s=s.replace(a,b)

# (5-1) 병합 틱 폐지 — 이력은 이미 통합 시트 안
rep('''function _v46SalesMergeTick(){
  if(_v46sm.done)return;
  _v46sm.tries++;''','''function _v46SalesMergeTick(){
  _v46sm.done=true; return;   /* [260904 Phase5] 공연마스터_이력·일일입력_이력 은 판매설정·일일실적(통합 시트)에 합류 — 클라이언트 병합 폐기 */
  if(_v46sm.done)return;
  _v46sm.tries++;''','tick')

# (5-2) 프로그램마스터: _json 대신 열에서 구성 (열 = _json 전 키의 거울, 실측 1867행 중 1857 동일·10행은 날짜 문자열/숫자 차이뿐)
rep('''    ((j&&j.rows)||[]).forEach(function(r){ var o=null; try{ o=JSON.parse(r['_json']||''); }catch(_e){ o=null; } if(!o||typeof o!=='object')return; o.구ID=String(o.사업ID||r['구ID']||''); o.사업ID=String(r['프로그램ID']||o.사업ID||''); o.사업코드=String(r['사업코드']||''); list.push(o); });''',
'''    // [260904 Phase5] _json 봉인 폐기 — 열이 정본. 숫자 열은 Number, 별칭·병합_ID 는 JSON 배열, 빈 칸은 키 생략(옛 _json 과 같은 모양)
    var NUM={}; ['연도','부문코드','시작일','종료일','기간','판매시작일','판매종료일','데이터_원천수','회차수','기본좌석','발권유료','발권초대','재무_집행액','회차_건수','회차_첫공연일','회차_끝공연일','표시_사업비','표시_수익률','재무_수입','표시_수입','대장_관람객','재무_사업비','재무_객단가','재무_수익률','검토필요','재무_수강인원','교육_프로그램군','전시_티켓가격','원장_금액','원장_정상매수','검증_발권vs원장','원장_첫판매일','원장_끝판매일','재무_매출실적','보고서_유료','보고서_무료','보고서_관객','보고서_매출','보고서_사업비','보고서_수익률','재무_집행률','사업비_분할N','재무_최종예산','전시_일수','수입_분할N','티켓_가용좌석','티켓_유료판매','홍보시작일','홍보종료일','대장_판매금액','회차_공연횟수','회차_공연인원합','일일_유료판매','일일_유료금액','일일_점유율','일일_최종일자','오픈석실측','검증_회차합vs마스터','무료여부','웹_게시일'].forEach(function(k){NUM[k]=1;});
    var ARR={'별칭':1,'병합_ID':1}, SKIP={'_json':1,'프로그램ID':1,'구분':1,'매칭근거':1,'구ID':1,'사업코드':1};
    ((j&&j.rows)||[]).forEach(function(r){
      var o={}, ks=Object.keys(r||{});
      for(var i=0;i<ks.length;i++){ var k=ks[i]; if(SKIP[k])continue; var v=r[k]; if(v===''||v===null||v===undefined)continue;
        if(ARR[k]){ try{ v=JSON.parse(v); }catch(_e){} }
        else if(NUM[k]){ var t=String(v).trim(); if(/^-?\\d+(\\.\\d+)?$/.test(t))v=Number(t); }
        o[k]=v; }
      if(!String(r['프로그램ID']||'').trim())return;
      o.구ID=String(r['구ID']||''); o.사업ID=String(r['프로그램ID']||''); o.사업코드=String(r['사업코드']||''); list.push(o); });''','pmSheet')

# (6-1) _finOf: 사업코드 조인만 (이름 폴백·연결키 매칭 제거)
rep('''function _finOf(name,year){
  if(!name)return null;
  var ix=_finIdx(year),k=_uName(name);
  try{ var _bc=_finCodeOfName(name,year); if(_bc&&ix.byNo[_bc])return ix.byNo[_bc]; }catch(_e){}   // [260903 Phase2 M-5] 사업코드 우선(이름 폴백은 Phase 6 에서 제거)
  if(!k)return null;
  if(ix.byKey[k])return ix.byKey[k];
  var best=null,bl=0;
  Object.keys(ix.byKey).forEach(function(a){
    if(a.length<3)return;
    if(k.indexOf(a)>=0||a.indexOf(k)>=0){ if(a.length>bl){bl=a.length;best=ix.byKey[a];} }
  });
  return best;
}''','''function _finOf(name,year){   // [260904 Phase6] 사업코드 조인만 — 이름·연결키 폴백 제거(프로그램 → 사업코드 → 사업비)
  if(!name)return null;
  var ix=_finIdx(year), _bc=null;
  try{ _bc=_finCodeOfName(name,year); }catch(_e){ _bc=null; }
  return (_bc&&ix.byNo[_bc])?ix.byNo[_bc]:null;
}''','finOf')

# (6-2) 홍보 게이트: records.공연ID 우선, 이름은 폴백
rep('''function _recPerfId(name){ var p=_findPerfByName(name); return (p&&p.id)||''; }''',
'''function _recPerfId(name){ var p=_findPerfByName(name); return (p&&p.id)||''; }
function _findPerfById(id){ id=String(id||'').trim(); if(!id)return null; var arr=(typeof PERFS!=='undefined'&&PERFS)?PERFS:[]; return arr.find(function(p){return String(p.id||'').trim()===id;})||null; }   // [260904 Phase6] 프로그램ID 조인''','findById')
rep('''  var perf=_findPerfByName(opts.program!=null?opts.program:(rec?rec['프로그램']:''));''',
'''  var perf=(opts.program==null&&rec&&rec['공연ID'])?(_findPerfById(rec['공연ID'])||_findPerfByName(rec['프로그램'])):_findPerfByName(opts.program!=null?opts.program:(rec?rec['프로그램']:''));   // [260904 Phase6] 공연ID 우선''','gate')

io.open(P,'w',encoding='utf-8').write(s)
print('OK phase56 applied', len(s))
