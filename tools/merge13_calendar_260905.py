# merge13_calendar_260905.py — [260905 통합⑲] GET /api/ym/calendar?id=일정ID (캘린더 행+프로그램+사람+코드) · POST /api/ym/codes/reindex (코드표 바뀐 뒤 캘린더 코드 다시 색인) · 홍보 PATCH 창구의 409 전달.
import io
P='api/ym-db.pb.js'
s=io.open(P,encoding='utf-8').read()
n0=s.count('통합⑲')
def rep(old,new):
    global s
    n=s.count(old); assert n==1, ('anchor count',n,old[:80])
    s=s.replace(old,new)
rep("""function getProgramJoin(e) {""",
    """function getCalendarJoin(e) {   // [260905 통합⑲] 캘린더 행 하나 → 프로그램(마스터) + 담당자·작성자 이름 + 코드표 행 (api/ym-join-lib.js)\n"""
    """  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };\n"""
    """  var q = e.requestInfo().query || {}, id = String(q.id || q["일정ID"] || "").trim();\n"""
    """  var r = require(__hooks + "/ym-join-lib.js").calendar($app, __col, id);\n"""
    """  return e.json(r.status || 200, r);\n"""
    """}\n"""
    """function postCodesReindex(e) {   // [260905 통합⑲] 코드표가 바뀐 뒤 캘린더 홍보 행의 코드 칸을 이름 칸으로 다시 채운다(이름은 안 건드림)\n"""
    """  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };\n"""
    """  var C = require(__hooks + "/ym-codes-lib.js"); if (!C.isMigrated($app, __col)) return e.json(409, { error: "코드표 재편(이관 025) 전" });\n"""
    """  var r = C.reindexCalendar($app, __col); r.ok = true; return e.json(200, r);\n"""
    """}\n\n"""
    """function getProgramJoin(e) {""")
rep("""routerAdd("GET", "/api/ym/program", getProgramJoin);   // [260905 통합⑰]\n""",
    """routerAdd("GET", "/api/ym/program", getProgramJoin);   // [260905 통합⑰]\n"""
    """routerAdd("GET", "/api/ym/calendar", getCalendarJoin);   // [260905 통합⑲]\n"""
    """routerAdd("POST", "/api/ym/codes/reindex", postCodesReindex);\n""")
rep("""var __rp = __R.patch($app, __col, rowIdx, body); return __rp ? e.json(200, __rp) : e.json(404, { error: "row not found" }); }""",
    """var __rp = __R.patch($app, __col, rowIdx, body); return __rp ? e.json(__rp.status || 200, __rp) : e.json(404, { error: "row not found" }); }   // [통합⑲] 409 전달""")
assert s.count('통합⑲')==n0+4, (n0, s.count('통합⑲'))
io.open(P,'w',encoding='utf-8').write(s)
print('ok', len(s))
