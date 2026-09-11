# -*- coding: utf-8 -*-
# [260903 Phase4-3a] 본체 창구 YMDB 도입 + 첫 이전(등록폼 「판매/전시 지표」 읽기·쓰기, 판매 기준일 배지).
#   이 화면들은 이제 옛 시트 이름(공연마스터·전시마스터·회차상세·일일입력) 대신 통합 시트(판매설정·회차·일일실적)를 직접 쓴다.
#   실행: python3 tools/phase4c_ymdb_260903.py (먼저 backups/ 로 cp)
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
def rep(a,b,label):
    global s
    n=s.count(a); assert n==1, 'anchor %s: %d'%(label,n)
    s=s.replace(a,b)
assert 'var YMDB=' not in s, 'YMDB already present'

YMDB = r'''// [260903 Phase4-3] YMDB — 통합 시트 창구. 화면은 옛 시트 이름(공연마스터·전시마스터·회차상세·일일입력·전시일일) 대신 이 창구만 쓴다.
//   통합 체계: 시트 판매설정/회차/일일실적 · 키 프로그램ID · 구분(공연/전시) · 명칭 · 날짜 YYYY-MM-DD · 상태 예정/판매중/진행중/종료(날짜 파생, 훅 ym-ops-alias-lib.js 와 같은 규칙).
var YMDB=(function(){
  function rows(sheet,part,fresh){
    return api('GET','/api/ops?sheet='+encodeURIComponent(sheet)+(fresh?'&fresh=1':'')).then(function(j){
      var rs=(j&&j.rows)||[]; return part?rs.filter(function(r){return String(r['구분']||'').trim()===part;}):rs;
    }).catch(function(){return [];});
  }
  function byId(list,id){ id=String(id||'').trim(); return (list||[]).filter(function(r){return String(r['프로그램ID']||'').trim()===id;}); }
  function iso(v){ var x=String(v==null?'':v).trim(); var m=x.match(/^(\d{4})[-./]?(\d{2})[-./]?(\d{2})/); return m?(m[1]+'-'+m[2]+'-'+m[3]):''; }
  function today(){ var d=new Date(Date.now()+9*3600*1000); return d.toISOString().slice(0,10); }
  function status(s,e,t){ s=iso(s); e=iso(e)||s; t=iso(t); var d=today(); if(!s)return ''; if(d>e)return '종료'; if(d>=s)return '진행중'; return (t&&t<=d)?'판매중':'예정'; }
  function upsert(sheet,part,id,patch){
    var p=Object.assign({},patch); p['구분']=part; p['프로그램ID']=String(id||'').trim();
    return api('PATCH','/api/ops/row',{sheet:sheet,keyCol:'프로그램ID',key:p['프로그램ID'],patch:p}).catch(function(e){
      if(!/404/.test(String(e&&e.message||e)))throw e;
      return api('POST','/api/ops/row',{sheet:sheet,row:p});
    });
  }
  function replaceById(sheet,part,id,list){   // 같은 프로그램ID 행 전부 삭제 후 list 추가(회차 교체용)
    id=String(id||'').trim();
    function del(){ return api('DELETE','/api/ops/row',{sheet:sheet,keyCol:'프로그램ID',key:id}).then(del,function(e){ if(/404/.test(String(e&&e.message||e)))return; throw e; }); }
    return del().then(function(){ var q=Promise.resolve(); (list||[]).forEach(function(r){ q=q.then(function(){ var o=Object.assign({},r); o['구분']=part; o['프로그램ID']=id; return api('POST','/api/ops/row',{sheet:sheet,row:o}); }); }); return q; });
  }
  return {rows:rows,byId:byId,iso:iso,today:today,status:status,upsert:upsert,replaceById:replaceById};
})();
'''

# 1) 창구 삽입 + _progMetaLoad → 통합 시트
rep('''function _progMetaLoad(force){
  var now=Date.now();
  if(!force&&_progMetaCache.perf&&(now-_progMetaCache.at)<60000)return Promise.resolve(_progMetaCache);
  return Promise.all([
    api('GET','/api/ops?sheet='+encodeURIComponent('공연마스터')+(force?'&fresh=1':'')).catch(function(){return null;}),
    api('GET','/api/ops?sheet='+encodeURIComponent('전시마스터')+(force?'&fresh=1':'')).catch(function(){return null;}),
    api('GET','/api/ops?sheet='+encodeURIComponent('회차상세')+(force?'&fresh=1':'')).catch(function(){return null;})
  ]).then(function(r){ _progMetaCache={perf:(r[0]&&r[0].rows)||[],exhib:(r[1]&&r[1].rows)||[],rounds:(r[2]&&r[2].rows)||[],at:Date.now()}; return _progMetaCache; });
}''', YMDB + '''function _progMetaLoad(force){   // [Phase4-3] 판매설정(공연/전시)·회차 — 통합 시트 직접
  var now=Date.now();
  if(!force&&_progMetaCache.perf&&(now-_progMetaCache.at)<60000)return Promise.resolve(_progMetaCache);
  return Promise.all([YMDB.rows('판매설정',null,force),YMDB.rows('회차',null,force)]).then(function(r){
    var all=r[0]||[];
    _progMetaCache={perf:all.filter(function(x){return String(x['구분']||'').trim()==='공연';}),exhib:all.filter(function(x){return String(x['구분']||'').trim()==='전시';}),rounds:r[1]||[],at:Date.now()};
    return _progMetaCache;
  });
}''','metaLoad')

# 2) 조회 키 = 프로그램ID
rep('''  if(kind==='perf')return (_progMetaCache.perf||[]).filter(function(r){return String(r['ID']||'').trim()===id;})[0]||null;
  if(kind==='exhib')return (_progMetaCache.exhib||[]).filter(function(r){return String(r['전시ID']||'').trim()===id;})[0]||null;''',
'''  if(kind==='perf')return YMDB.byId(_progMetaCache.perf,id)[0]||null;
  if(kind==='exhib')return YMDB.byId(_progMetaCache.exhib,id)[0]||null;''','metaCurrent')
rep('''function _progMetaRounds(id){ return (_progMetaCache.rounds||[]).filter(function(r){return String(r['ID']||'').trim()===id;}).map(function(r){return _progMetaIso(r['공연일']);}).filter(Boolean); }''',
'''function _progMetaRounds(id){ return YMDB.byId(_progMetaCache.rounds,id).map(function(r){return _progMetaIso(r['공연일']);}).filter(Boolean); }''','metaRounds')

# 3) 상태 = 통합 어휘(날짜 파생)
rep('''function _progMetaStatus(kind,s,e){ var t=_progMetaToday(); if(kind==='perf')return (e&&e<t)?'종료':'판매중'; if(!s||t<s)return '예정'; if(e&&t>e)return '종료'; return '진행중'; }''',
'''function _progMetaStatus(kind,s,e,t){ return YMDB.status(s,e,kind==='perf'?t:''); }   // [Phase4-3] 예정/판매중/진행중/종료 한 체계''','metaStatus')
rep("""'티켓오픈일':String(fd.get('m_티켓오픈일')||fd.get('판매시작일')||'').trim(),'상태':_progMetaStatus('perf',s,e)}};""",
"""'티켓오픈일':String(fd.get('m_티켓오픈일')||fd.get('판매시작일')||'').trim(),'상태':_progMetaStatus('perf',s,e,String(fd.get('m_티켓오픈일')||fd.get('판매시작일')||'').trim())}};""",'metaRead-status')

# 4) 저장 → 통합 시트
rep('''  if(meta.kind==='perf'){
    var patch=Object.assign({'사업명':name,'시작일':meta.s,'종료일':meta.e,'사업코드':code},meta.fields);
    var full=Object.assign({'ID':id},patch);
    await _progMetaUpsert('공연마스터','ID',id,patch,full);
    var cur=_progMetaRounds(id).slice().sort(), want=meta.dates.slice().sort();
    if(meta.dates.length&&cur.join('|')!==want.join('|')){
      for(var k=0;k<80;k++){ try{ await api('DELETE','/api/ops/row',{sheet:'회차상세',keyCol:'ID',key:id}); }catch(e){ break; } }
      for(var i=0;i<meta.dates.length;i++)await api('POST','/api/ops/row',{sheet:'회차상세',row:{'ID':id,'공연일':meta.dates[i]}});
    }''',
'''  if(meta.kind==='perf'){   // [Phase4-3] 판매설정(구분=공연) + 회차 — 통합 시트 직접
    var patch=Object.assign({'명칭':name,'시작일':meta.s,'종료일':meta.e,'사업코드':code},meta.fields);
    await YMDB.upsert('판매설정','공연',id,patch);
    var cur=_progMetaRounds(id).slice().sort(), want=meta.dates.slice().sort();
    if(meta.dates.length&&cur.join('|')!==want.join('|')){
      await YMDB.replaceById('회차','공연',id,meta.dates.map(function(d){return {'공연일':d};}));
    }''','metaCommit-perf')
rep('''    var patch2=Object.assign({'전시명':name,'연도':yr,'시작일':meta.s,'종료일':meta.e,'장소':String((values&&values['장소'])||''),'사업코드':code},meta.fields);
    var full2=Object.assign({'전시ID':id},patch2);
    await _progMetaUpsert('전시마스터','전시ID',id,patch2,full2);''',
'''    var patch2=Object.assign({'명칭':name,'연도':yr,'시작일':meta.s,'종료일':meta.e,'장소':String((values&&values['장소'])||''),'사업코드':code},meta.fields);
    await YMDB.upsert('판매설정','전시',id,patch2);   // [Phase4-3] 판매설정(구분=전시)''','metaCommit-exhib')

# 5) 판매 기준일 배지 → 일일실적(공연)
rep('''  api('GET','/api/ops?sheet='+encodeURIComponent('일일입력')).then(_updateSalesAsOfBadge).catch(function(){
    _updateSalesAsOfBadge(null);
  });''',
'''  YMDB.rows('일일실적','공연').then(function(rs){ _updateSalesAsOfBadge({rows:rs}); }).catch(function(){   // [Phase4-3] 통합 시트 직접
    _updateSalesAsOfBadge(null);
  });''','badge')

io.open(P,'w',encoding='utf-8').write(s)
print('OK phase4c applied', len(s))
