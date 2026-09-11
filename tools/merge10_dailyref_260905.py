# merge10_dailyref_260905.py — [260905 통합⑮] 일일실적 쓰기(postOps 통째/append/upsert · opsRow POST/PATCH · 창구 patch)에서 프로그램ID 가 프로그램마스터에 없으면 409.
import io
P='api/ym-db.pb.js'
s=io.open(P,encoding='utf-8').read()
def rep(old,new):
    global s
    n=s.count(old); assert n==1, ('anchor count',n,old[:80])
    s=s.replace(old,new)
# postOps: 지우거나 저장하기 전에 모든 행을 먼저 검사(중간 실패로 반쯤 저장되는 일 방지)
rep("""  if (mode !== "append" && mode !== "upsert") {\n    // full replace: delete existing rows for this sheet (별칭이면 같은 구분의 행만)\n""",
    """  var __seen15 = null;\n"""
    """  if (sheetKey === "ops_일일실적") {   // [260905 통합⑮] 일일실적.프로그램ID 는 마스터에 있어야 한다 — 쓰기 전에 전부 검사\n"""
    """    var __V15 = require(__hooks + "/ym-views-lib.js"), __bad15 = []; __seen15 = {};\n"""
    """    for (var __ri = 0; __ri < rows.length; __ri++) { var __pr = alias ? alias.rowToPhys(rows[__ri] || {}) : (rows[__ri] || {}); if (mode === "upsert" && !Object.prototype.hasOwnProperty.call(__pr, "프로그램ID")) continue; var __re = __V15.dailyRefError($app, __col, __pr, __seen15); if (__re && __bad15.indexOf(__re) < 0) __bad15.push(__re); }\n"""
    """    if (__bad15.length) return e.json(409, { error: "일일실적 프로그램ID 가 프로그램마스터에 없음 (" + __bad15.length + "건)", details: __bad15.slice(0, 20) });\n"""
    """  }\n"""
    """  if (mode !== "append" && mode !== "upsert") {\n    // full replace: delete existing rows for this sheet (별칭이면 같은 구분의 행만)\n""")
rep("""  var inserted = 0, updated = 0, window_seen14 = null;   // [260905 통합⑭] 한 요청 안에서 키 겹침 방지용 집합\n""",
    """  var inserted = 0, updated = 0, window_seen14 = __seen15;   // [260905 통합⑭] 한 요청 안에서 키 겹침 방지용 집합 [⑮] 마스터 ID 집합도 같이 캐시\n""")
# opsRow POST
rep("""    if (sheetKey === "ops_일일실적") require(__hooks + "/ym-views-lib.js").dailyStamp($app, __col, data, null); else if (sheetKey === "ops_코드표") require(__hooks + "/ym-views-lib.js").codeStamp($app, __col, data, null);   // [260905 통합⑭]\n""",
    """    if (sheetKey === "ops_일일실적") require(__hooks + "/ym-views-lib.js").dailyStamp($app, __col, data, null); else if (sheetKey === "ops_코드표") require(__hooks + "/ym-views-lib.js").codeStamp($app, __col, data, null);   // [260905 통합⑭]\n"""
    """    if (sheetKey === "ops_일일실적") { var __re15 = require(__hooks + "/ym-views-lib.js").dailyRefError($app, __col, data, null); if (__re15) return e.json(409, { error: __re15 }); }   // [260905 통합⑮]\n""")
# opsRow PATCH
rep("""  for (i = 0; i < headers.length; i++) if (out[headers[i]] === undefined || out[headers[i]] === null) out[headers[i]] = "";\n  target.set("data", out);\n""",
    """  for (i = 0; i < headers.length; i++) if (out[headers[i]] === undefined || out[headers[i]] === null) out[headers[i]] = "";\n"""
    """  if (sheetKey === "ops_일일실적" && Object.prototype.hasOwnProperty.call(patch, "프로그램ID")) { var __re15p = require(__hooks + "/ym-views-lib.js").dailyRefError($app, __col, out, null); if (__re15p) return e.json(409, { error: __re15p }); }   // [260905 통합⑮]\n"""
    """  target.set("data", out);\n""")
# 창구 patch 가 {error,status} 를 돌려주면 그 상태로
rep("""var __vr = __V.patch($app, __col, sheet, rowIdx, body); return __vr ? e.json(200, __vr) : e.json(404, { error: "row not found" }); }""",
    """var __vr = __V.patch($app, __col, sheet, rowIdx, body); return __vr ? e.json(__vr.status || 200, __vr) : e.json(404, { error: "row not found" }); }   // [통합⑮] 409 전달""")
assert s.count('통합⑮')==4, s.count('통합⑮')
io.open(P,'w',encoding='utf-8').write(s)
print('ok', len(s))
