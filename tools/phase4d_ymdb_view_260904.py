# -*- coding: utf-8 -*-
# [260904 Phase4-3b] 운영 시트 읽기/통째쓰기 전부 YMDB 창구로. 옛 이름(공연마스터·전시마스터·회차상세·일일입력·전시일일)은
#   YMDB.view/save 가 통합 시트(판매설정·회차·일일실적)로 번역(앱 안 어댑터 1곳 = M-8). 훅 별칭은 이제 앱이 안 쓴다(다른 클라이언트 대비 유지).
#   실행: python3 tools/phase4d_ymdb_view_260904.py (먼저 backups/ 로 cp)
import io, re
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
def rep(a,b,label):
    global s
    n=s.count(a); assert n==1, 'anchor %s: %d'%(label,n)
    s=s.replace(a,b)
assert 'var YMDB=' in s and 'function view(name,fresh)' not in s

VIEW = r'''  // [Phase4-3b] 옛 시트 모양 뷰/저장 — 화면 코드가 아직 옛 열 이름(ID·사업명·유료좌석…)을 쓰는 동안의 어댑터(한 곳). 열 이름을 새 체계로 바꾸는 작업이 끝나면 이 표를 지운다.
  var VIEW={
    '공연마스터':{sheet:'판매설정',part:'공연',cols:{'ID':'프로그램ID','사업명':'명칭'},d8:['시작일','종료일','티켓오픈일'],headers:['사업명','ID','기준석','총회차','총오픈석','목표점유율','수익성','티켓오픈일','종료일','시작일','상태','사업코드']},
    '전시마스터':{sheet:'판매설정',part:'전시',cols:{'전시ID':'프로그램ID','전시명':'명칭'},d8:[],headers:['전시ID','전시명','연도','시작일','종료일','운영일수','목표관객','목표금액','최종유료','최종무료','최종총인원','최종매출','최종점유율','수익성','무료여부','상태','장소','사업코드']},
    '회차상세':{sheet:'회차',part:'공연',cols:{'ID':'프로그램ID'},d8:[],headers:['ID','공연일']},
    '일일입력':{sheet:'일일실적',part:'공연',cols:{'공연ID':'프로그램ID','공연명':'명칭','유료좌석':'누계유료','무료좌석':'누계무료','합계좌석':'누계총인원','합계금액':'누계금액'},d8:['기준일자'],headers:['기준일자','공연명','유료좌석','유료금액','무료좌석','합계좌석','합계금액','점유율','전일대비(석)','공연ID','예측제외']},
    '전시일일':{sheet:'일일실적',part:'전시',cols:{'전시ID':'프로그램ID','전시명':'명칭'},d8:['기준일자'],headers:['기준일자','전시ID','전시명','일일유료','일일무료','일일총인원','일일금액','누계유료','누계무료','누계총인원','누계금액','점유율']}
  };
  function statusOld(part,v){ v=String(v||'').trim(); if(part==='공연')return v==='진행중'?'판매중':v; if(part==='전시')return v==='판매중'?'예정':v; return v; }
  function raw(sheet,fresh){ return api('GET','/api/ops?sheet='+encodeURIComponent(sheet)+(fresh?'&fresh=1':'')); }
  // view(옛 이름) → {sheet,headers,rows,count} 옛 모양. 표에 없는 이름은 그대로 통과(단체·사업비·카페일정 등).
  function view(name,fresh){
    var v=VIEW[name]; if(!v)return raw(name,fresh);
    return raw(v.sheet,fresh).then(function(j){
      var rs=((j&&j.rows)||[]).filter(function(r){return String(r['구분']||'').trim()===v.part;});
      var out=rs.map(function(r){ var o={}; v.headers.forEach(function(h){ var x=r[v.cols[h]||h]; x=(x===undefined||x===null)?'':String(x); if(v.d8.indexOf(h)>=0&&/^\d{4}-\d{2}-\d{2}$/.test(x))x=x.replace(/-/g,''); if(h==='상태'&&v.sheet==='판매설정')x=statusOld(v.part,x); o[h]=x; }); return o; });
      return {sheet:'운영_'+name,headers:v.headers.slice(),rows:out,count:out.length,via:v.sheet};
    });
  }
  // save({sheet:옛 이름,headers,rows,mode}) → 통합 시트 + 구분 한 칸만 교체/추가(훅 part). 표에 없는 이름은 그대로 POST.
  function save(body){
    var v=VIEW[body&&body.sheet]; if(!v)return api('POST','/api/ops',body);
    var toU=function(h){ return v.cols[h]||h; };
    var rs=(body.rows||[]).map(function(r){ var o={}; Object.keys(r||{}).forEach(function(k){ var x=r[k]; if(v.d8.indexOf(k)>=0){ var t=String(x===undefined||x===null?'':x).trim(); if(/^\d{8}$/.test(t))x=t.slice(0,4)+'-'+t.slice(4,6)+'-'+t.slice(6,8); } var u=toU(k); if(o[u]===undefined||o[u]==='')o[u]=x; }); o['구분']=v.part; if(v.sheet==='판매설정'){ var st=status(o['시작일'],o['종료일'],o['티켓오픈일']); if(st)o['상태']=st; } return o; });
    var b={sheet:v.sheet,part:v.part,rows:rs}; if(body.mode)b.mode=body.mode; var hd=(body.headers||[]).map(toU); if(hd.length)b.headers=hd; if(body.allowEmpty===true)b.allowEmpty=true; if(body.force===true)b.force=true;
    return api('POST','/api/ops',b);
  }
'''
rep('''  return {rows:rows,byId:byId,iso:iso,today:today,status:status,upsert:upsert,replaceById:replaceById};
})();''', VIEW + '''  return {rows:rows,byId:byId,iso:iso,today:today,status:status,upsert:upsert,replaceById:replaceById,view:view,save:save,VIEW:VIEW};
})();''','ymdb-export')

# YMDB 내부 rows()/raw() 의 api 호출은 치환 대상에서 제외 — 표식으로 잠시 바꿔둔다
KEEP1="api('GET','/api/ops?sheet='+encodeURIComponent(sheet)+(fresh?'&fresh=1':''))"
assert s.count(KEEP1)==2, 'YMDB internal api lines: %d'%s.count(KEEP1)
s=s.replace(KEEP1,'@@KEEP_GET@@')
KEEP2="api('POST','/api/ops',body)"; assert s.count(KEEP2)==1
s=s.replace(KEEP2,'@@KEEP_POST1@@')
KEEP3="api('POST','/api/ops',b)"; assert s.count(KEEP3)==1
s=s.replace(KEEP3,'@@KEEP_POST2@@')

# 읽기: api('GET','/api/ops?sheet='+encodeURIComponent(X)[+'&fresh=1' | +(force?'&fresh=1':'')])  →  YMDB.view(X[,true|force])
ARG=r"('(?:공연마스터|전시마스터|회차상세|일일입력|전시일일)'|sheet|n)"
pat1=re.compile(r"api\('GET','/api/ops\?sheet='\+encodeURIComponent\("+ARG+r"\)\+'&fresh=1'\)")
pat2=re.compile(r"api\('GET','/api/ops\?sheet='\+encodeURIComponent\("+ARG+r"\)\+\((\w+)\?'&fresh=1':''\)\)")
pat3=re.compile(r"api\('GET','/api/ops\?sheet='\+encodeURIComponent\("+ARG+r"\)\)")
n1=len(pat1.findall(s)); n2=len(pat2.findall(s)); n3=len(pat3.findall(s))
s=pat1.sub(lambda m:"YMDB.view(%s,true)"%m.group(1),s)
s=pat2.sub(lambda m:"YMDB.view(%s,%s)"%(m.group(1),m.group(2)),s)
s=pat3.sub(lambda m:"YMDB.view(%s)"%m.group(1),s)
print('GET replaced', n1,n2,n3)
assert n1+n2+n3>=30, 'too few GET sites'
# 예외 1곳: _ymRealLoad 의 raw fetch(일일입력) → YMDB.view
rep("_ymRealAggP=fetch('__runtime/api/ops?sheet='+encodeURIComponent('일일입력'),{cache:'no-store'}).then(function(r){ if(!r.ok)throw new Error('HTTP '+r.status); return r.json(); }).then(function(j){", "_ymRealAggP=YMDB.view('일일입력',true).then(function(j){", 'ymReal')

for nm in ['공연마스터','전시마스터','회차상세','일일입력','전시일일']:
    assert ("encodeURIComponent('%s')"%nm) not in s, 'old GET left: '+nm

# 통째 쓰기: api('POST','/api/ops',{...  →  YMDB.save({...
n4=s.count("api('POST','/api/ops',{"); assert n4>=10, 'POST sites %d'%n4
s=s.replace("api('POST','/api/ops',{","YMDB.save({")
assert s.count("api('POST','/api/ops'")==0
print('POST replaced', n4)

s=s.replace('@@KEEP_GET@@',KEEP1).replace('@@KEEP_POST1@@',KEEP2).replace('@@KEEP_POST2@@',KEEP3)
io.open(P,'w',encoding='utf-8').write(s)
print('OK phase4d applied', len(s))
