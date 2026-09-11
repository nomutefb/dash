# merge12_join_260905.py — [260905 통합⑰] 표 사이 참조 조회. GET /api/ym/program?id=X (마스터+사업+일일실적+캘린더+담당자) · GET /api/ops?sheet=일일실적&프로그램ID=X (그 프로그램 것만). 로직은 api/ym-join-lib.js.
import io
P='api/ym-db.pb.js'
s=io.open(P,encoding='utf-8').read()
def rep(old,new):
    global s
    n=s.count(old); assert n==1, ('anchor count',n,old[:80])
    s=s.replace(old,new)
rep("""function getOps(e) {\n""",
    """function getProgramJoin(e) {   // [260905 통합⑰] 프로그램 하나의 모든 것: 마스터 행 + 사업 행 + 일일실적 + 캘린더 홍보 + 담당자 이름 (api/ym-join-lib.js)\n"""
    """  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };\n"""
    """  var q = e.requestInfo().query || {}, id = String(q.id || q["프로그램ID"] || "").trim();\n"""
    """  var r = require(__hooks + "/ym-join-lib.js").program($app, __col, id);\n"""
    """  return e.json(r.status || 200, r);\n"""
    """}\n\n"""
    """function getOps(e) {\n""")
rep("""  var meta = metaFor(sheetKey);\n  if (!meta) {\n    var fallback = readMembersFallback();\n""",
    """  var __pid17 = String(q["프로그램ID"] || q.pid || "").trim();   // [260905 통합⑰] 일일실적을 프로그램 하나 것만(마스터 → 일일실적 참조 조회)\n"""
    """  if (sheetKey === "ops_일일실적" && __pid17) {\n"""
    """    var __J = require(__hooks + "/ym-join-lib.js"), __jm = metaFor(sheetKey); if (!__jm) return e.json(404, { error: "sheet not found: " + sh });\n"""
    """    var __jh = jsonValue(__jm.get("headers"), []), __jd = __J.dailyOf($app, __col, __pid17), __jr = [];\n"""
    """    for (var __ji = 0; __ji < __jd.rows.length; __ji++) { var __row = __J.shape(__jd.rows[__ji], __jh, false); delete __row._rowIndex; __jr.push(__row); }\n"""
    """    return e.json(200, { sheet: "운영_" + sh, headers: __jh, rows: __jr, count: __jr.length, 프로그램ID: __pid17, via: __jd.via });\n"""
    """  }\n"""
    """  var meta = metaFor(sheetKey);\n  if (!meta) {\n    var fallback = readMembersFallback();\n""")
rep("""routerAdd("GET", "/api/ops", getOps);\n""",
    """routerAdd("GET", "/api/ops", getOps);\nrouterAdd("GET", "/api/ym/program", getProgramJoin);   // [260905 통합⑰]\n""")
assert s.count('통합⑰')==3, s.count('통합⑰')
io.open(P,'w',encoding='utf-8').write(s)
print('ok', len(s))
