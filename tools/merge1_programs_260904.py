# merge1_programs_260904.py — [260904 통합①] 훅 ym-db.pb.js 5개 핸들러에 programs → 프로그램마스터 창구 분기 삽입.
#   getPrograms / getSheet / postSheet / patchSheet / deleteSheet. 창구 = api/ym-programs-lib.js (isMigrated 가 false 인 환경에선 옛 경로 그대로 = 호환 다리).
import io
P='api/ym-db.pb.js'
s=io.open(P,encoding='utf-8').read()
def rep(old,new):
    global s
    n=s.count(old); assert n==1, ('anchor count',n,old[:80])
    s=s.replace(old,new)
L='    var __L = require(__hooks + "/ym-programs-lib.js");'
ENVL='  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션\n'
SQ="'"
FILT='  var metaRows = $app.findRecordsByFilter(metaCol, "sheet = '+SQ+'" + quote(sheet) + "'+SQ+'", "", 1, 0);\n'
FILT2='  var records = $app.findRecordsByFilter(col, "sheet = '+SQ+'" + quote(sheet) + "'+SQ+' && rowIndex = " + rowIdx, "", 1, 0);\n'
# 1) getPrograms
rep('function getPrograms(e) {\n'+ENVL,
    'function getPrograms(e) {\n'+ENVL+'  {   // [260904 통합①] programs 시트가 프로그램마스터로 합쳐진 환경이면 마스터 창구로 답한다(앱 무수정)\n'+L+'\n    if (__L.isMigrated($app, __col)) return e.json(200, { programs: __L.list($app, __col, false) });\n  }\n')
# 2) getSheet
A2='  })[slug] || slug;\n  var metaCol = __col("ymmeta");\n'+FILT+'  if (!metaRows.length) {\n    return e.json(200, {\n      ok: true,\n      sheet: "운영_" + slug,'
rep(A2, '  })[slug] || slug;\n  if (sheet === "programs") {   // [260904 통합①]\n'+L+'\n    if (__L.isMigrated($app, __col)) return e.json(200, { headers: __L.HEADERS.slice(), rows: __L.list($app, __col, true) });\n  }\n'+A2[len('  })[slug] || slug;\n'):])
# 3) postSheet
BODY='  })[slug] || slug;\n  var body = info.body || {};\n  if (typeof body === "string") {\n    try { body = JSON.parse(body); } catch (bodyErr) { body = {}; }\n  }\n'
A3=BODY+'  var bodyHeaders = Array.isArray(body.headers) ? body.headers : null;\n'
rep(A3, BODY+'  if (sheet === "programs") {   // [260904 통합①]\n'+L+'\n    if (__L.isMigrated($app, __col)) { var __c = __L.create($app, __col, body); return e.json(__c.status || 200, __c); }\n  }\n  var bodyHeaders = Array.isArray(body.headers) ? body.headers : null;\n')
# 4) patchSheet
A4=BODY+'  var metaCol = __col("ymmeta");\n'+FILT+'  var meta = metaRows.length ? metaRows[0] : null;\n  var headers = jsonValue(meta ? meta.get("headers") : [], []);\n'
rep(A4, BODY+'  if (sheet === "programs") {   // [260904 통합①]\n'+L+'\n    if (__L.isMigrated($app, __col)) { var __r = __L.patch($app, __col, rowIdx, body); return __r ? e.json(__r.status || 200, __r) : e.json(404, { error: "row not found" }); }\n  }\n'+A4[len(BODY):])
# 5) deleteSheet
A5='  })[slug] || slug;\n  var col = __col("ymdata");\n'+FILT2+'  var rec = records && records.length ? records[0] : null;\n  if (!rec) return e.json(404, { error: "row not found" });\n  $app.delete(rec);\n'
rep(A5, '  })[slug] || slug;\n  if (sheet === "programs") {   // [260904 통합①] 폼에서 만든 행은 삭제, 이력 행은 명단에서만 뺀다(콘텐츠구분·NO 비움)\n'+L+'\n    if (__L.isMigrated($app, __col)) { var __d = __L.remove($app, __col, rowIdx); return __d ? e.json(200, __d) : e.json(404, { error: "row not found" }); }\n  }\n'+A5[len('  })[slug] || slug;\n'):])
assert s.count('[260904 통합①]')==5, s.count('[260904 통합①]')
# patchSheet/deleteSheet 분기가 rowIdx 정의 뒤에 있는지
for fn in ('function patchSheet(','function deleteSheet('):
    i0=s.index(fn); assert s.index('var rowIdx = parseInt(', i0) < s.index('[260904 통합①]', i0), fn
io.open(P,'w',encoding='utf-8').write(s)
print('ok', len(s), s.count('ym-programs-lib.js'))
