# merge6_keys_260905.py — [260905 통합⑦⑧⑨⑩] 훅 ym-db.pb.js 에 키 통일 창구 분기 삽입. (평의회 8인 반영판)
#   ⑦ 사업비 → 프로그램마스터 사업 행 (api/ym-biz-lib.js): getOps · postOps(트랜잭션) · opsRow, getOps 프로그램마스터에서 사업 행 숨김, 마스터 통째 교체 거부
#   ⑧ 담당자 계정NO (api/ym-acct-lib.js): getRecords/postRecords/patchRecords 신청자·게시 담당자, getOps 프로그램마스터 담당자,
#      postSheet managers(같은 이름 409 + 번호 부여) · patchSheet managers(계정NO 보존 + 같은 이름 409 + 번호 부여) · deleteSheet managers(삭제 대신 휴직 처리)
#   ⑩ records 프로그램ID: getRecords 가 공연ID 이름으로도 붙여 줌, post/patch 는 공연ID 키가 따로 오면 프로그램ID 로(옛 규칙대로 extras 가 이긴다)
#   (⑨ 운영일정 날짜는 api/ym-views-lib.js 안에서 끝남 — 훅 수정 없음)
#   모든 분기는 isMigrated 가 true 일 때만 → 발행본(옛 구조)은 옛 경로 그대로. 라이브러리 파일이 없으면 require 가 throw 하므로 라이브러리를 먼저 올린다.
import io, re
P='api/ym-db.pb.js'
s=io.open(P,encoding='utf-8').read()
def rep(old,new):
    global s
    n=s.count(old); assert n==1, ('anchor count',n,old[:80])
    s=s.replace(old,new)
# 삽입 코드가 기대는 지역 변수 확인(headers · data · rows)
def fnbody(name):
    m=re.search(r'\nfunction '+name+r'\(e\) \{', s); assert m, ('no fn',name)
    nxt=re.search(r'\nfunction \w+\(', s[m.end():]); return s[m.start(): m.end()+(nxt.start() if nxt else len(s))]
for fn in ('getRecords','postRecords','patchRecords'):
    b=fnbody(fn); assert 'var headers' in b, ('headers 변수 없음', fn)
assert 'var data = {}' in fnbody('patchRecords') and 'var data = localValues' in fnbody('postRecords')
B='    var __B = require(__hooks + "/ym-biz-lib.js");\n'
A='    var __A = require(__hooks + "/ym-acct-lib.js");\n'
# 1) getOps: 사업비 창구
rep("""  if (sh === "판매설정") {   // [260904 통합②] 판매설정은 프로그램마스터 열 — 창구로 답한다\n""",
    """  if (sh === "사업비") {   // [260905 통합⑦] 사업비는 프로그램마스터 사업 행 — 창구로 답한다\n"""+B+
    """    if (__B.isMigrated($app, __col)) return e.json(200, __B.opsView($app, __col));\n  }\n"""
    """  if (sh === "판매설정") {   // [260904 통합②] 판매설정은 프로그램마스터 열 — 창구로 답한다\n""")
# 2) getOps: 프로그램마스터 응답에서 사업 행 숨김 + 담당자 계정NO→이름
rep("""  var rows = rowsFor(sheetKey, headers);\n""",
    """  var rows = rowsFor(sheetKey, headers);\n"""
    """  if (sheetKey === "ops_프로그램마스터") {   // [260905 통합⑦⑧] 앱에는 사업 행을 빼고 보여 주고, 담당자는 계정NO → 이름\n"""
    """    var __B2 = require(__hooks + "/ym-biz-lib.js"), __A2 = require(__hooks + "/ym-acct-lib.js");\n"""
    """    if (__B2.isMigrated($app, __col)) rows = rows.filter(function (r) { return String(r["구분"] || "").trim() !== "사업"; });\n"""
    """    if (__A2.isMigrated($app, __col) && headers.indexOf("담당자") >= 0) { var __am = __A2.maps($app, __col); for (var __ai = 0; __ai < rows.length; __ai++) rows[__ai]["담당자"] = __A2.toName(__am, rows[__ai]["담당자"]); }\n"""
    """  }\n""")
# 3) getRecords
rep("""  return e.json(200, { records: rows });""",
    """  {   // [260905 통합⑧⑩] 신청자·게시 담당자 계정NO → 이름 · 프로그램ID 를 공연ID 이름으로도(앱은 아직 공연ID 로 읽음)\n"""+A+
    """    var __hs = Array.isArray(headers) ? headers : [];\n"""
    """    var __on = __A.isMigrated($app, __col), __am = __on ? __A.maps($app, __col) : null, __pid = __hs.indexOf("프로그램ID") >= 0 && __hs.indexOf("공연ID") < 0;\n"""
    """    for (var __ri = 0; __ri < rows.length; __ri++) { if (__on) __A.namesOut(__am, rows[__ri], ["신청자", "게시 담당자"]); if (__pid) rows[__ri]["공연ID"] = rows[__ri]["프로그램ID"]; }\n"""
    """  }\n"""
    """  return e.json(200, { records: rows });""")
FIX=("""  {   // [260905 통합⑧⑩] 이름 → 계정NO · 공연ID 키가 따로 오면 프로그램ID 로(옛 규칙대로 나중 키가 이긴다)\n"""+A+
     """    var __hs = Array.isArray(headers) ? headers : [];\n"""
     """    if (__A.isMigrated($app, __col)) __A.nosIn(__A.maps($app, __col), data, ["신청자", "게시 담당자"]);\n"""
     """    if (__hs.indexOf("프로그램ID") >= 0 && __hs.indexOf("공연ID") < 0 && Object.prototype.hasOwnProperty.call(data, "공연ID")) { data["프로그램ID"] = data["공연ID"]; delete data["공연ID"]; }\n"""
     """  }\n""")
# 4) postRecords
rep("""data[k] = extras[k];\n  }\n  var col = __col("ymdata");\n""",
    """data[k] = extras[k];\n  }\n"""+FIX+"""  var col = __col("ymdata");\n""")
# 5) patchRecords
rep("""data[k] = body[k];\n  }\n  var col = __col("ymdata");\n  var recs = $app.findRecordsByFilter(col, "sheet = 'records' && rowIndex = " + rowIdx""",
    """data[k] = body[k];\n  }\n"""+FIX+"""  var col = __col("ymdata");\n  var recs = $app.findRecordsByFilter(col, "sheet = 'records' && rowIndex = " + rowIdx""")
# 6) postOps: 사업비 통째 저장(트랜잭션) + 프로그램마스터 통째 교체 거부
rep("""  var alias = body.part ? __alias.partAlias(""",
    """  if (sh === "사업비") {   // [260905 통합⑦] 통째 저장 = 사업 행만 같은 뜻으로 덮기/추가/지우기(빈 저장은 거부). 한 트랜잭션.\n"""+B+
    """    if (__B.isMigrated($app, __col)) {\n"""
    """      var __br = null, __bx = null;\n"""
    """      try {\n"""
    """        $app.runInTransaction(function (__tx) {\n"""
    """          __br = (body.mode === "append" || body.mode === "upsert") ? __B.appendRows(__tx, __col, body.rows || [], body.headers) : __B.replaceAll(__tx, __col, body.rows || [], body.allowEmpty === true, body.headers);\n"""
    """          if (__br && __br.error) throw new Error("__rollback__");\n"""
    """        });\n"""
    """      } catch (__te) { __bx = __te; }\n"""
    """      if (__br && __br.error) return e.json(__br.status || 400, __br);\n"""
    """      if (__bx) return e.json(500, { error: "사업비 저장 실패: " + __bx });\n"""
    """      return e.json(200, __br);\n"""
    """    }\n  }\n"""
    """  if (localSheet(sh) === "ops_프로그램마스터" && body.mode !== "append" && body.mode !== "upsert" && !body.part && body.force !== true) {   // [260905 통합⑦] 앱은 사업 행을 못 보므로 통째 교체하면 사업 행이 사라진다\n"""
    """    var __B3 = require(__hooks + "/ym-biz-lib.js");\n"""
    """    if (__B3.isMigrated($app, __col)) return e.json(409, { error: "프로그램마스터 whole-replace refused (사업 행 보호) — use mode:'upsert', part, or force:true" });\n"""
    """  }\n"""
    """  var alias = body.part ? __alias.partAlias(""")
# 7) opsRow: 사업비 행 단위
rep("""  if (!sh) return e.json(400, { error: "sheet required" });\n  if (sh === "판매설정") {   // [260904 통합②]\n""",
    """  if (!sh) return e.json(400, { error: "sheet required" });\n"""
    """  if (sh === "사업비") {   // [260905 통합⑦] 행 단위 = 마스터 사업 행(사업NO 키). POST 는 새 사업만(같은 사업NO 는 409)\n"""+B+
    """    if (__B.isMigrated($app, __col)) {\n"""
    """      if (method === "POST") { var __row = body.row || {}; if (typeof __row !== "object" || Array.isArray(__row)) return e.json(400, { error: "row object required" }); var __u = __B.createOne($app, __col, __row); return e.json(__u.status || 200, __u); }\n"""
    """      var __kc = String(body.keyCol || "").trim(), __k = String(body.key === undefined ? "" : body.key).trim();\n"""
    """      if (!__kc || !__k) return e.json(400, { error: "keyCol/key required" });\n"""
    """      if (__kc !== "사업NO" && __kc !== "프로그램ID") return e.json(400, { error: "사업비 keyCol must be 사업NO(=프로그램ID)" });\n"""
    """      if (method === "DELETE") { var __dd = __B.removeByNo($app, __col, __k); return __dd ? e.json(200, __dd) : e.json(404, { error: "row not found: 사업NO=" + __k }); }\n"""
    """      var __pt = body.patch || {}; if (typeof __pt !== "object" || Array.isArray(__pt)) return e.json(400, { error: "patch object required" });\n"""
    """      var __pr = __B.patchByNo($app, __col, __k, __pt); return __pr ? e.json(200, __pr) : e.json(404, { error: "row not found: 사업NO=" + __k });\n"""
    """    }\n  }\n"""
    """  if (sh === "판매설정") {   // [260904 통합②]\n""")
# 8) postSheet managers: 같은 이름 거부 + 새 담당자에 계정NO
rep("""  var data = {};\n  for (var h = 0; h < headers.length; h++) data[headers[h]] = "";\n  data = applyBody(data, headers, body);\n  var col = __col("ymdata");\n""",
    """  var data = {};\n  for (var h = 0; h < headers.length; h++) data[headers[h]] = "";\n  data = applyBody(data, headers, body);\n"""
    """  if (sheet === "managers") {   // [260905 통합⑧] 같은 이름 두 명이면 계정NO 가 갈라지지 않는다 → 거부\n"""+A+
    """    if (__A.isMigrated($app, __col) && __A.nameTaken($app, __col, data["담당자"], 0)) return e.json(409, { error: "같은 이름의 담당자가 이미 있습니다: " + String(data["담당자"]).trim() });\n"""
    """  }\n"""
    """  var col = __col("ymdata");\n""")
rep("""  meta.set("nextRowIndex", nri + 1);\n  $app.save(meta);\n  var lastmodRows = $app.findRecordsByFilter(metaCol, "sheet = '_lastmod'", "", 1, 0);\n""",
    """  meta.set("nextRowIndex", nri + 1);\n  $app.save(meta);\n"""
    """  if (sheet === "managers") { try { require(__hooks + "/ym-acct-lib.js").assignMissing($app, __col); } catch (__ae) { console.log("[ym-db] 계정NO 부여 실패: " + __ae); } }   // [260905 통합⑧]\n"""
    """  var lastmodRows = $app.findRecordsByFilter(metaCol, "sheet = '_lastmod'", "", 1, 0);\n""")
# 9) patchSheet managers: 계정NO 보존 + 같은 이름 거부 + 번호 부여
rep("""  data = applyBody(data, headers, body);\n  rec.set("data", data);\n  $app.save(rec);\n""",
    """  data = applyBody(data, headers, body);\n"""
    """  if (sheet === "managers") {   // [260905 통합⑧] 계정NO 는 몸통이 뭘 보내든 지키고, 같은 이름으로 바꾸는 건 거부\n"""+A+
    """    if (__A.isMigrated($app, __col)) {\n"""
    """      var __old = String(existing["계정NO"] === undefined || existing["계정NO"] === null ? "" : existing["계정NO"]).trim(); if (__old) data["계정NO"] = __old;\n"""
    """      if (__A.nameTaken($app, __col, data["담당자"], rowIdx)) return e.json(409, { error: "같은 이름의 담당자가 이미 있습니다: " + String(data["담당자"]).trim() });\n"""
    """    }\n  }\n"""
    """  rec.set("data", data);\n  $app.save(rec);\n"""
    """  if (sheet === "managers") { try { require(__hooks + "/ym-acct-lib.js").assignMissing($app, __col); } catch (__ae2) { console.log("[ym-db] 계정NO 부여 실패: " + __ae2); } }   // [260905 통합⑧]\n""")
# 10) deleteSheet managers: 계정NO 가 붙은 담당자는 지우지 않고 휴직 처리(기록이 번호를 가리킨다)
rep("""  if (sheet === "programs") {   // [260904 통합①] 폼에서 만든 행은 삭제, 이력 행은 명단에서만 뺀다(콘텐츠구분·NO 비움)\n""",
    """  if (sheet === "managers") {   // [260905 통합⑧] 계정NO 가 붙은 담당자는 지우지 않고 휴직 처리(records·마스터가 번호로 가리킨다)\n"""+A+
    """    if (__A.isMigrated($app, __col)) {\n"""
    """      var __mr = $app.findRecordsByFilter(__col("ymdata"), "sheet = 'managers' && rowIndex = " + rowIdx, "", 1, 0);\n"""
    """      if (__mr && __mr.length) { var __md = __A.rowData(__mr[0]); if (__A.nz(__md["계정NO"])) { __md["휴직여부"] = "1"; __mr[0].set("data", __md); $app.save(__mr[0]); return e.json(200, { ok: true, retired: true, rowIndex: rowIdx }); } }\n"""
    """    }\n  }\n"""
    """  if (sheet === "programs") {   // [260904 통합①] 폼에서 만든 행은 삭제, 이력 행은 명단에서만 뺀다(콘텐츠구분·NO 비움)\n""")
assert s.count('[260905 통합⑦')==5, s.count('[260905 통합⑦')
assert s.count('ym-acct-lib.js')==9, s.count('ym-acct-lib.js')
assert s.count('ym-biz-lib.js')==5, s.count('ym-biz-lib.js')
io.open(P,'w',encoding='utf-8').write(s)
print('ok', len(s))
