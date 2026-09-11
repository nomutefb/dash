# dedupe3_260905.py — [260905 통합⑱-3] 프리로드(_plOne) fetch 도 in-flight 표에 올린다. 실측: 부팅 때 '일일실적'은 프리로드가 직접 fetch 해서 _apiInflight 에 없었고, 그래서 뒤이은 '일일실적&fresh=1'(3.3MB)이 합쳐지지 않았다.
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
def rep(old,new):
    global s
    n=s.count(old); assert n==1, ('anchor count',n,old[:80])
    s=s.replace(old,new)
rep("  _plJobs[path]={t:Date.now(),p:p};\n",
    "  _plJobs[path]={t:Date.now(),p:p};\n"
    "  _apiInflight[path]={p:p,w:_apiWriteSeq}; p.then(function(){ if(_apiInflight[path]&&_apiInflight[path].p===p)delete _apiInflight[path]; },function(){ if(_apiInflight[path]&&_apiInflight[path].p===p)delete _apiInflight[path]; });   // [⑱-3] 프리로드도 같은 경로·fresh=1 요청과 합쳐진다\n")
assert s.count('⑱-3')==1, s.count('⑱-3')
io.open(P,'w',encoding='utf-8').write(s)
print('ok', len(s))
