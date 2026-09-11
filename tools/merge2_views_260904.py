# merge2_views_260904.py — [260904 통합③④] 훅 ym-db.pb.js 에 옛 시트 이름 → 합쳐진 표 창구 분기(ym-views-lib.js) 삽입.
#   getOps(장도·카페일정) / getSheet·postSheet·patchSheet·deleteSheet(platforms·contents·applysettings). 통합① 블록 바로 뒤에 붙인다.
import io
P='api/ym-db.pb.js'
s=io.open(P,encoding='utf-8').read()
def rep(old,new):
    global s
    n=s.count(old); assert n==1, ('anchor count',n,old[:80])
    s=s.replace(old,new)
V='    var __V = require(__hooks + "/ym-views-lib.js");'
# getOps: sheetKey 계산 직후
rep('  var meta = metaFor(sheetKey);\n  if (!meta) {\n    var fallback = readMembersFallback();\n',
    '  if (sh === "장도" || sh === "카페일정") {   // [260904 통합③] 운영일정 표의 구분 행\n'+V+'\n    if (__V.isMigrated($app, __col, sh)) return e.json(200, __V.opsView($app, __col, sh));\n  }\n  var meta = metaFor(sheetKey);\n  if (!meta) {\n    var fallback = readMembersFallback();\n')
# getSheet
rep('    if (__L.isMigrated($app, __col)) return e.json(200, { headers: __L.HEADERS.slice(), rows: __L.list($app, __col, true) });\n  }\n',
    '    if (__L.isMigrated($app, __col)) return e.json(200, { headers: __L.HEADERS.slice(), rows: __L.list($app, __col, true) });\n  }\n  {   // [260904 통합④] 코드표 창구\n'+V+'\n    if (__V.has(sheet) && __V.isMigrated($app, __col, sheet)) return e.json(200, { headers: __V.headersOf(sheet), rows: __V.list($app, __col, sheet, true) });\n  }\n')
# postSheet
rep('    if (__L.isMigrated($app, __col)) { var __c = __L.create($app, __col, body); return e.json(__c.status || 200, __c); }\n  }\n',
    '    if (__L.isMigrated($app, __col)) { var __c = __L.create($app, __col, body); return e.json(__c.status || 200, __c); }\n  }\n  {   // [260904 통합④]\n'+V+'\n    if (__V.has(sheet) && __V.isMigrated($app, __col, sheet)) { var __vc = __V.create($app, __col, sheet, body); return e.json(__vc.status || 200, __vc); }\n  }\n')
# patchSheet
rep('    if (__L.isMigrated($app, __col)) { var __r = __L.patch($app, __col, rowIdx, body); return __r ? e.json(__r.status || 200, __r) : e.json(404, { error: "row not found" }); }\n  }\n',
    '    if (__L.isMigrated($app, __col)) { var __r = __L.patch($app, __col, rowIdx, body); return __r ? e.json(__r.status || 200, __r) : e.json(404, { error: "row not found" }); }\n  }\n  {   // [260904 통합④]\n'+V+'\n    if (__V.has(sheet) && __V.isMigrated($app, __col, sheet)) { var __vr = __V.patch($app, __col, sheet, rowIdx, body); return __vr ? e.json(200, __vr) : e.json(404, { error: "row not found" }); }\n  }\n')
# deleteSheet
rep('    if (__L.isMigrated($app, __col)) { var __d = __L.remove($app, __col, rowIdx); return __d ? e.json(200, __d) : e.json(404, { error: "row not found" }); }\n  }\n',
    '    if (__L.isMigrated($app, __col)) { var __d = __L.remove($app, __col, rowIdx); return __d ? e.json(200, __d) : e.json(404, { error: "row not found" }); }\n  }\n  {   // [260904 통합④]\n'+V+'\n    if (__V.has(sheet) && __V.isMigrated($app, __col, sheet)) { var __vd = __V.remove($app, __col, sheet, rowIdx); return __vd ? e.json(200, __vd) : e.json(404, { error: "row not found" }); }\n  }\n')
assert s.count('ym-views-lib.js')==5, s.count('ym-views-lib.js')
io.open(P,'w',encoding='utf-8').write(s)
print('ok', len(s))
