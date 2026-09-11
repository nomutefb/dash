# dedupe4_260905.py — [260905 통합⑱-4] 쓰기 순번(_apiWriteSeq)은 자료 표에 쓰는 요청(records·ops·sheet·messages·programs·ym/)만 센다. 실측: 부팅 때 /api/presence(POST, 접속 표시)가 4번 가서 순번이 올라가 '일일실적&fresh=1' 이 합쳐지지 않았다.
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
def rep(old,new):
    global s
    n=s.count(old); assert n==1, ('anchor count',n,old[:80])
    s=s.replace(old,new)
rep("  const _w=(method!=='GET'); if(_w){_apiWrites++; _apiWriteSeq++;}   // [⑱-2] 쓰기 순번\n",
    "  const _w=(method!=='GET'); if(_w){_apiWrites++; if(/^\\/api\\/(records|ops|sheet|messages|programs|ym\\/)/.test(path))_apiWriteSeq++;}   // [⑱-2] 쓰기 순번 [⑱-4] 자료 표 쓰기만(presence 같은 신호는 제외)\n")
assert s.count('⑱-4')==1, s.count('⑱-4')
io.open(P,'w',encoding='utf-8').write(s)
print('ok', len(s))
