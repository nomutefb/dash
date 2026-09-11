# merge5_ledger_260905.py — [260905 통합⑥] getOps 창구 분기에 세부운영관리대장(정리) 추가(일일실적 구분 회차발권 뷰).
import io
P='api/ym-db.pb.js'
s=io.open(P,encoding='utf-8').read()
a='  if (sh === "장도" || sh === "카페일정" || sh === "대관일정") {   // [260904 통합③·260905 통합⑤] 운영일정 표의 구분 행\n'
assert s.count(a)==1, ('anchor', s.count(a))
b='  if (String(sh).replace(/[()\\s]/g, "") === "세부운영관리대장정리") {   // [260905 통합⑥] 회차 대장은 일일실적 구분 행\n    var __V6 = require(__hooks + "/ym-views-lib.js");\n    if (__V6.isMigrated($app, __col, "세부운영관리대장정리")) return e.json(200, __V6.opsView($app, __col, "세부운영관리대장정리"));\n  }\n'+a
s=s.replace(a,b)
assert s.count('통합⑥')==1
io.open(P,'w',encoding='utf-8').write(s)
print('ok', len(s))
