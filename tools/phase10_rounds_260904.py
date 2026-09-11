# phase10_rounds_260904.py — 회차 시트를 판매설정.공연일목록 한 칸으로 흡수. 화면 코드는 YMDB 창구 안에서만 바꾼다(호출부 7곳 무수정).
#   공연일목록 형식: "YYYY-MM-DD" 또는 "YYYY-MM-DD:오픈좌석" 을 "|" 로 이어 붙임. 예: 2026-04-16:1000|2026-04-17
#   - rows('회차', part, fresh)  → 판매설정 행의 공연일목록을 펼쳐 옛 모양(프로그램ID·구분·공연일·오픈좌석) 반환
#   - raw('회차')                → view('회차상세') 가 쓰는 원본도 같은 방식으로 합성
#   - replaceById('회차', …)     → 판매설정 행의 공연일목록 한 칸만 교체(upsert)
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
def rep(old,new):
    global s
    n=s.count(old); assert n==1, ('anchor count',n,old[:60])
    s=s.replace(old,new)

A1="  function rows(sheet,part,fresh){\n    return api('GET','/api/ops?sheet='+encodeURIComponent(sheet)+(fresh?'&fresh=1':'')).then(function(j){"
N1=("  // [260904 Phase10] 회차 → 판매설정.공연일목록 흡수. 옛 모양(한 줄=한 회차)은 여기서 합성.\n"
    "  function roundsOf(r){ var out=[]; String(r['공연일목록']||'').split('|').forEach(function(t){ t=String(t||'').trim(); if(!t)return; var p=t.split(':'); var d=iso(p[0]); if(!d)return; out.push({'프로그램ID':String(r['프로그램ID']||'').trim(),'구분':String(r['구분']||'').trim(),'공연일':d,'오픈좌석':String(p[1]||'').trim()}); }); return out; }\n"
    "  function roundsStr(list){ return (list||[]).map(function(x){ var d=iso(x['공연일']); if(!d)return null; var st=String(x['오픈좌석']==null?'':x['오픈좌석']).trim(); return {d:d,s:st}; }).filter(Boolean).sort(function(a,b){return a.d<b.d?-1:(a.d>b.d?1:0);}).map(function(x){return x.s?(x.d+':'+x.s):x.d;}).join('|'); }\n"
    "  function roundsFromSales(part,fresh){ return rows('판매설정',part,fresh).then(function(rs){ var o=[]; rs.forEach(function(r){ o=o.concat(roundsOf(r)); }); return o; }); }\n"
    "  function rows(sheet,part,fresh){\n"
    "    if(sheet==='회차')return roundsFromSales(part,fresh);\n"
    "    return api('GET','/api/ops?sheet='+encodeURIComponent(sheet)+(fresh?'&fresh=1':'')).then(function(j){")
rep(A1,N1)

A2="  function replaceById(sheet,part,id,list){   // 같은 프로그램ID 행 전부 삭제 후 list 추가(회차 교체용)\n    id=String(id||'').trim();\n"
N2=A2+"    if(sheet==='회차')return upsert('판매설정',part,id,{'공연일목록':roundsStr(list)});   // [Phase10] 회차는 판매설정 한 칸\n"
rep(A2,N2)

A3="  function raw(sheet,fresh){ return api('GET','/api/ops?sheet='+encodeURIComponent(sheet)+(fresh?'&fresh=1':'')); }"
N3=("  function raw(sheet,fresh){\n"
    "    if(sheet==='회차')return roundsFromSales(null,fresh).then(function(rs){ return {sheet:'운영_회차',headers:['프로그램ID','구분','공연일','오픈좌석'],rows:rs,count:rs.length,via:'판매설정'}; });   // [Phase10]\n"
    "    return api('GET','/api/ops?sheet='+encodeURIComponent(sheet)+(fresh?'&fresh=1':''));\n"
    "  }")
rep(A3,N3)

A4="  return {rows:rows,byId:byId,iso:iso,today:today,status:status,upsert:upsert,replaceById:replaceById,view:view,save:save,VIEW:VIEW};"
N4="  return {rows:rows,byId:byId,iso:iso,today:today,status:status,upsert:upsert,replaceById:replaceById,view:view,save:save,VIEW:VIEW,roundsOf:roundsOf,roundsStr:roundsStr};"
rep(A4,N4)

io.open(P,'w',encoding='utf-8').write(s)
print('OK phase10 rounds', len(s))
