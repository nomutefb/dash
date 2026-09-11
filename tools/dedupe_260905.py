# dedupe_260905.py — [260905 통합⑱] api() GET 중복 합치기. 같은 경로의 GET 이 날아가는 중이면 새로 안 보내고 그 응답을 나눠 쓴다(복사본).
#   실측(부팅): 일일실적 3.3MB 를 3번, 판매설정 0.9MB 를 3번 겹쳐 요청 → 서로 느려져 11~18초. 프리로드(_plJobs)는 1회 소비라 두 번째 호출부터 새 fetch 가 나가던 것.
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
def rep(old,new):
    global s
    n=s.count(old); assert n==1, ('anchor count',n,old[:80])
    s=s.replace(old,new)
rep("var _plJobs=Object.create(null), _PL_TTL=180000;\n",
    "var _plJobs=Object.create(null), _PL_TTL=180000;\n"
    "var _apiInflight=Object.create(null);   // [260905 통합⑱] 날아가는 중인 GET(경로→Promise). 같은 경로는 나눠 쓴다\n"
    "function _apiClone(v){ try{ return (typeof structuredClone==='function')?structuredClone(v):JSON.parse(JSON.stringify(v)); }catch(_e){ return v; } }\n")
rep("  const headers={'Content-Type':'application/json','X-App-Password':password};\n  // 서브 admin: 본인 PIN을 헤더에 동봉 (Worker가 검증해 admin 권한 부여)\n",
    "  // [260905 통합⑱] 같은 GET 이 이미 날아가는 중이면 그 응답을 복사해 쓴다(부팅 때 일일실적·판매설정 3번씩 겹치던 낭비 제거). 실패하면 아래 정상 fetch.\n"
    "  if(method==='GET'&&_apiInflight[path]){ try{ var _shv=await _apiInflight[path]; return _apiClone(_shv); }catch(_e){} }\n"
    "  const headers={'Content-Type':'application/json','X-App-Password':password};\n  // 서브 admin: 본인 PIN을 헤더에 동봉 (Worker가 검증해 admin 권한 부여)\n")
rep("     if(localLlmPath)return (await misoLlmRoute(method,path,body)).json();\n",
    "     if(localLlmPath)return (await misoLlmRoute(method,path,body)).json();\n"
    "     if(method==='GET'){   // [260905 통합⑱] GET 은 in-flight 표에 올려 두고, 끝나면 내린다\n"
    "       var _pf=fetch(path,o).then(async function(r){ if(!r.ok)throw new Error(r.status+': '+(await r.text())); return r.json(); });\n"
    "       _apiInflight[path]=_pf;\n"
    "       try{ return await _pf; } finally{ if(_apiInflight[path]===_pf)delete _apiInflight[path]; }\n"
    "     }\n")
assert s.count('통합⑱')==3, s.count('통합⑱')
io.open(P,'w',encoding='utf-8').write(s)
print('ok', len(s))
