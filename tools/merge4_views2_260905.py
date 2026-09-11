# merge4_views2_260905.py — [260905 통합⑤] getOps 창구 분기에 대관일정 추가(장도·카페일정과 같은 운영일정 창구). special 은 getSheet 계열이 VIEWS.has 로 자동.
import io
P='api/ym-db.pb.js'
s=io.open(P,encoding='utf-8').read()
a='  if (sh === "장도" || sh === "카페일정") {   // [260904 통합③] 운영일정 표의 구분 행\n'
assert s.count(a)==1, ('anchor', s.count(a))
s=s.replace(a,'  if (sh === "장도" || sh === "카페일정" || sh === "대관일정") {   // [260904 통합③·260905 통합⑤] 운영일정 표의 구분 행\n')
io.open(P,'w',encoding='utf-8').write(s)
print('ok', len(s))
