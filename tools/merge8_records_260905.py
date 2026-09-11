# merge8_records_260905.py — [260905 통합⑬] /api/records 4개 핸들러(getRecords·postRecords·patchRecords·deleteRecords)에 ops_캘린더 창구 분기 삽입(api/ym-records-lib.js).
#   isMigrated(ops_캘린더 에 상태변경시각 열) 가 true 일 때만 → 발행본은 옛 records 시트 경로 그대로. postRecords 는 localMeta(빈 records 시트 재생성) 보다 앞에서 분기한다.
import io
P='api/ym-db.pb.js'
s=io.open(P,encoding='utf-8').read()
def rep(old,new):
    global s
    n=s.count(old); assert n==1, ('anchor count',n,old[:80])
    s=s.replace(old,new)
R='    var __R = require(__hooks + "/ym-records-lib.js");\n'
rep("""  var headers = metaRows.length ? jsonValue(metaRows[0].get("headers"), []) : [];\n  var col = __col("ymdata");\n  var records = $app.findRecordsByFilter(col, "sheet = 'records'", "rowIndex", 50000, 0);\n""",
    """  var headers = metaRows.length ? jsonValue(metaRows[0].get("headers"), []) : [];\n"""
    """  {   // [260905 통합⑬] 홍보 신청은 ops_캘린더 구분=홍보 행 — 창구로 답한다(옛 28열 + _rowIndex)\n"""+R+
    """    if (__R.isMigrated($app, __col)) return e.json(200, { records: __R.list($app, __col) });\n  }\n"""
    """  var col = __col("ymdata");\n  var records = $app.findRecordsByFilter(col, "sheet = 'records'", "rowIndex", 50000, 0);\n""")
rep("""  var values = body.values;\n  var sheet = "records";\n  var meta = localMeta(sheet, body.headers);\n""",
    """  var values = body.values;\n  var sheet = "records";\n"""
    """  {   // [260905 통합⑬] ops_캘린더 구분=홍보 행으로 추가(옛 records 시트를 다시 만들지 않게 localMeta 앞에서)\n"""+R+
    """    if (__R.isMigrated($app, __col)) { var __rc = __R.create($app, __col, body); return e.json(__rc.status || 200, __rc); }\n  }\n"""
    """  var meta = localMeta(sheet, body.headers);\n""")
rep("""  var values = body.values;\n  var mc = __col("ymmeta");\n  var metas = $app.findRecordsByFilter(mc, "sheet = 'records'", "", 1, 0);\n""",
    """  var values = body.values;\n"""
    """  {   // [260905 통합⑬]\n"""+R+
    """    if (__R.isMigrated($app, __col)) { var __rp = __R.patch($app, __col, rowIdx, body); return __rp ? e.json(200, __rp) : e.json(404, { error: "row not found" }); }\n  }\n"""
    """  var mc = __col("ymmeta");\n  var metas = $app.findRecordsByFilter(mc, "sheet = 'records'", "", 1, 0);\n""")
rep("""  var sheet = "records";\n  var col = __col("ymdata");\n  var recs = $app.findRecordsByFilter(col, "sheet = 'records' && rowIndex = " + rowIdx, "", 1, 0);\n""",
    """  var sheet = "records";\n"""
    """  {   // [260905 통합⑬]\n"""+R+
    """    if (__R.isMigrated($app, __col)) { var __rd = __R.remove($app, __col, rowIdx); return __rd ? e.json(200, __rd) : e.json(404, { error: "row not found" }); }\n  }\n"""
    """  var col = __col("ymdata");\n  var recs = $app.findRecordsByFilter(col, "sheet = 'records' && rowIndex = " + rowIdx, "", 1, 0);\n""")
assert s.count('ym-records-lib.js')==4, s.count('ym-records-lib.js')
io.open(P,'w',encoding='utf-8').write(s)
print('ok', len(s))
