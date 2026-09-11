# merge3_sales_260904.py — [260904 통합②] 훅 ym-db.pb.js 에 판매설정 → 프로그램마스터 창구 분기(ym-sales-lib.js) 삽입. getOps / opsRow / postOps.
import io
P='api/ym-db.pb.js'
s=io.open(P,encoding='utf-8').read()
def rep(old,new):
    global s
    n=s.count(old); assert n==1, ('anchor count',n,old[:80])
    s=s.replace(old,new)
S='    var __S = require(__hooks + "/ym-sales-lib.js");'
# getOps
rep('  var meta = metaFor(sheetKey);\n  if (!meta) {\n    var fallback = readMembersFallback();\n',
    '  if (sh === "판매설정") {   // [260904 통합②] 판매설정은 프로그램마스터 열 — 창구로 답한다\n'+S+'\n    if (__S.isMigrated($app, __col)) return e.json(200, __S.opsView($app, __col));\n  }\n  var meta = metaFor(sheetKey);\n  if (!meta) {\n    var fallback = readMembersFallback();\n')
# opsRow
rep('  var alias = null;   // [Phase4-4] 옛 이름 번역표 폐기\n  var sheetKey = alias ? alias.phys : sheetKeyOf(sh);\n',
    '  if (sh === "판매설정") {   // [260904 통합②]\n'+S+'''
    if (__S.isMigrated($app, __col)) {
      if (method === "POST") { var __row = body.row || {}; if (typeof __row !== "object" || Array.isArray(__row)) return e.json(400, { error: "row object required" }); var __u = __S.upsert($app, __col, __row["구분"], __row); return e.json(__u.status || 200, __u); }
      var __kc = String(body.keyCol || "").trim(), __k = String(body.key === undefined ? "" : body.key).trim();
      if (!__kc || !__k) return e.json(400, { error: "keyCol/key required" });
      if (__kc !== "프로그램ID") return e.json(400, { error: "판매설정 keyCol must be 프로그램ID" });
      if (method === "DELETE") { var __dd = __S.removeById($app, __col, __k); return __dd ? e.json(200, __dd) : e.json(404, { error: "row not found: 프로그램ID=" + __k }); }
      var __pt = body.patch || {}; if (typeof __pt !== "object" || Array.isArray(__pt)) return e.json(400, { error: "patch object required" });
      var __pr = __S.patchById($app, __col, __k, __pt); return __pr ? e.json(200, __pr) : e.json(404, { error: "row not found: 프로그램ID=" + __k });
    }
  }
  var alias = null;   // [Phase4-4] 옛 이름 번역표 폐기
  var sheetKey = alias ? alias.phys : sheetKeyOf(sh);
''')
# postOps
rep('  if (!sh) return e.json(400, { error: "sheet required" });\n  var alias = body.part ? __alias.partAlias(localSheet(sh), body.part, $app, __col("ymmeta")) : null;',
    '  if (!sh) return e.json(400, { error: "sheet required" });\n  if (sh === "판매설정") {   // [260904 통합②] 행마다 마스터 upsert(통째 교체는 거부)\n'+S+'''
    if (__S.isMigrated($app, __col)) {
      var __rows = body.rows || [], __mode = body.mode, __part = body.part || "";
      if (__mode !== "upsert" && __mode !== "append") return e.json(409, { error: "판매설정 is merged into 프로그램마스터 — use mode:'upsert' or /api/ops/row" });
      var __ins = 0, __upd = 0;
      for (var __i = 0; __i < __rows.length; __i++) { var __r = __S.upsert($app, __col, __part || ((__rows[__i] || {})["구분"]), __rows[__i] || {}); if (__r.error) return e.json(__r.status || 400, __r); if (__r.created) __ins++; else __upd++; }
      return e.json(200, { ok: true, inserted: __ins, updated: __upd, removed: 0, via: __S.MASTER });
    }
  }
  var alias = body.part ? __alias.partAlias(localSheet(sh), body.part, $app, __col("ymmeta")) : null;''')
assert s.count('ym-sales-lib.js')==3, s.count('ym-sales-lib.js')
io.open(P,'w',encoding='utf-8').write(s)
print('ok', len(s))
