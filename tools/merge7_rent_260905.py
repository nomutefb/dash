# merge7_rent_260905.py — [260905 통합⑪] getOps 프로그램마스터 응답에서 캘린더 대관 행(캘린더ID≠'')도 숨긴다(앱 지문 유지 — 대관일정은 창구로 본다).
import io
P='api/ym-db.pb.js'
s=io.open(P,encoding='utf-8').read()
a='''    if (__B2.isMigrated($app, __col)) rows = rows.filter(function (r) { return String(r["구분"] || "").trim() !== "사업"; });\n'''
b='''    if (__B2.isMigrated($app, __col)) rows = rows.filter(function (r) { return String(r["구분"] || "").trim() !== "사업" && String(r["캘린더ID"] || "").trim() === ""; });   // [260905 통합⑪] 캘린더 대관 행도 숨김(대관일정 창구로 봄)\n'''
assert s.count(a)==1, s.count(a)
s=s.replace(a,b)
io.open(P,'w',encoding='utf-8').write(s)
print('ok', len(s))
