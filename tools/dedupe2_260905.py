# dedupe2_260905.py — [260905 통합⑱-2] fresh=1 GET 도 합친다: 같은 표의 보통 GET 이 날아가는 중이고 그 사이 쓰기(POST/PATCH/DELETE)가 없었으면 그 응답을 나눠 쓴다.
#   실측(통합⑱ 뒤 부팅): 일일실적 3.3MB 가 '일일실적' + '일일실적&fresh=1' 두 번. fresh 의 뜻(내 쓰기 뒤 최신)은 쓰기 순번(_apiWriteSeq)으로 지킨다.
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
def rep(old,new):
    global s
    n=s.count(old); assert n==1, ('anchor count',n,old[:80])
    s=s.replace(old,new)
rep("var _apiInflight=Object.create(null);   // [260905 통합⑱] 날아가는 중인 GET(경로→Promise). 같은 경로는 나눠 쓴다\n",
    "var _apiInflight=Object.create(null), _apiWriteSeq=0;   // [260905 통합⑱] 날아가는 중인 GET(경로→{p,w}). 같은 경로는 나눠 쓴다. w = 그때의 쓰기 순번\n")
rep("  if(method==='GET'&&_apiInflight[path]){ try{ var _shv=await _apiInflight[path]; return _apiClone(_shv); }catch(_e){} }\n",
    "  if(method==='GET'){ var _bp=path.replace(/[?&]fresh=1$/,''); var _inf=_apiInflight[path]||((_bp!==path&&_apiInflight[_bp]&&_apiInflight[_bp].w===_apiWriteSeq)?_apiInflight[_bp]:null);   // [⑱-2] fresh=1 도 그 사이 쓰기가 없었으면 합친다\n"
    "    if(_inf){ try{ var _shv=await _inf.p; return _apiClone(_shv); }catch(_e){} } }\n")
rep("  const _w=(method!=='GET'); if(_w)_apiWrites++;\n",
    "  const _w=(method!=='GET'); if(_w){_apiWrites++; _apiWriteSeq++;}   // [⑱-2] 쓰기 순번\n")
rep("       _apiInflight[path]=_pf;\n       try{ return await _pf; } finally{ if(_apiInflight[path]===_pf)delete _apiInflight[path]; }\n",
    "       _apiInflight[path]={p:_pf,w:_apiWriteSeq};\n       try{ return await _pf; } finally{ if(_apiInflight[path]&&_apiInflight[path].p===_pf)delete _apiInflight[path]; }\n")
assert s.count('⑱-2')==2, s.count('⑱-2')
io.open(P,'w',encoding='utf-8').write(s)
print('ok', len(s))
