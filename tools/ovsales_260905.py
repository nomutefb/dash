# ovsales_260905.py — [260905 감사] _bizOvSalesLoad 가 부팅마다 요청하던 '기획공연판매결과' 시트는 개발본·발행본 어디에도 없다(발행본엔 이름이 다른 ops_기획공연판매현황 23행만 있고, 앱은 그걸 부른 적이 없음).
#   훅은 "시트 없음" 빈 응답을 돌려주고 앱은 rows=[] 로 동작해 왔다. 요청만 빼고 같은 결과(rows=[])를 즐시 돌려준다. 다른 코드는 그대로.
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
old="_bizOvSalesState.p=api('GET','/api/ops?sheet='+encodeURIComponent('기획공연판매결과')+(force?'&fresh=1':''))"
new="_bizOvSalesState.p=Promise.resolve({rows:[]}) /* [260905 감사] 기획공연판매결과 시트는 DB에 없음(발행본도) — 빈 응답과 같은 결과, 부팅 요청 1개 제거. 원래 줄: api('GET','/api/ops?sheet='+encodeURIComponent('기획공연판매결과')+(force?'&fresh=1':'')) */"
n=s.count(old); assert n==1, ('anchor count', n)
s=s.replace(old,new)
assert s.count('[260905 감사]')==1, s.count('[260905 감사]')
io.open(P,'w',encoding='utf-8').write(s)
print('ok ovsales', len(s))
