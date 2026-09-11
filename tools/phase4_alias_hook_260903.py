# -*- coding: utf-8 -*-
# [260903 Phase4-2 v2] 훅 번역표 — 평의회 8인 검토 반영판.
#   번역표 본체는 api/ym-ops-alias-lib.js (require 1벌). 여기서는 getOps/opsRow/postOps 에 alias 분기 + 목록 동결 숨김 + lastmod.
import io
P='api/ym-db.pb.js'
s=io.open(P,encoding='utf-8').read()
def rep(a,b,label):
    global s
    n=s.count(a); assert n==1, 'anchor %s: %d'%(label,n)
    s=s.replace(a,b)

REQ='  var __alias = require(__hooks + "/ym-ops-alias-lib.js");   // [260903 Phase4] 옛 시트 이름 → 통합 시트 번역표(임시 발판)\n'

# ---- 시트 목록: 동결(frozen) 메타는 숨김 (getOps sheet 없음 경로 + listSheetsStartingWithOps)
rep('''    for (var si = 0; si < metaRows.length; si++) sheets.push({ name: "운영_" + String(metaRows[si].get("sheet")).slice(4) });
''','''    for (var si = 0; si < metaRows.length; si++) { if (String(metaRows[si].get("source") || "").indexOf("frozen") === 0) continue; sheets.push({ name: "운영_" + String(metaRows[si].get("sheet")).slice(4) }); }   // [Phase4] 동결 옛 시트 숨김
''','list-getOps')
rep('''  for (var i = 0; i < recs.length; i++) {
    var k = recs[i].get("sheet");
    out.push({ name: "운영_" + k.slice(4) });
  }
''','''  for (var i = 0; i < recs.length; i++) {
    if (String(recs[i].get("source") || "").indexOf("frozen") === 0) continue;   // [Phase4] 동결 옛 시트 숨김
    var k = recs[i].get("sheet");
    out.push({ name: "운영_" + k.slice(4) });
  }
''','list-fn')

# ---- getOps: 별칭이면 통합 시트에서 구분 행만 옛 모양으로
rep('''  var sheetKey = ({ "전시일일": "exhib_daily", "전시마스터": "exhib_master" })[sh] || ("ops_" + normalizeOpsName(sh));
  var meta = metaFor(sheetKey);
''', REQ + '''  var alias = __alias.opsAlias(sh, $app);
  if (alias) {
    var aHeaders = alias.oldHeaders();
    var aRecs = alias.findRows($app.findCollectionByNameOrId("ymdata"));
    var aRows = [], orphan = 0;
    for (var ai = 0; ai < aRecs.length; ai++) {
      var aData = jsonValue(aRecs[ai].publicExport().data, {});
      if (!alias.isPart(aData)) { orphan++; continue; }
      var aRow = alias.rowToOld(aData, aHeaders), aHas = false;
      for (var ak = 0; ak < aHeaders.length; ak++) if (aRow[aHeaders[ak]].trim() !== "") { aHas = true; break; }
      if (aHas) aRows.push(aRow);
    }
    return e.json(200, { sheet: "운영_" + sh, headers: aHeaders, rows: aRows, count: aRows.length, via: alias.phys, orphan: orphan });
  }
  var sheetKey = ({ "전시일일": "exhib_daily", "전시마스터": "exhib_master" })[sh] || ("ops_" + normalizeOpsName(sh));
  var meta = metaFor(sheetKey);
''', 'getOps')

# ---- opsRow
rep('''  var sh = body.sheet;
  if (!sh) return e.json(400, { error: "sheet required" });
  var sheetKey = sheetKeyOf(sh);
  var metaCol = $app.findCollectionByNameOrId("ymmeta");
  var col = $app.findCollectionByNameOrId("ymdata");
  var metas = $app.findRecordsByFilter(metaCol, "sheet = '" + quote(sheetKey) + "'", "", 1, 0);
  var meta = metas && metas.length ? metas[0] : null;
  if (!meta) return e.json(404, { error: "sheet not found: " + sh });
  var headers = jsonValue(meta.get("headers"), []);
  if (!Array.isArray(headers)) headers = [];
  var i, k;

  if (method === "POST") {
    var row = body.row || {};
    if (typeof row !== "object" || Array.isArray(row)) return e.json(400, { error: "row object required" });
''', REQ + '''  var sh = body.sheet;
  if (!sh) return e.json(400, { error: "sheet required" });
  var alias = __alias.opsAlias(sh, $app);
  var sheetKey = alias ? alias.phys : sheetKeyOf(sh);
  var metaCol = $app.findCollectionByNameOrId("ymmeta");
  var col = $app.findCollectionByNameOrId("ymdata");
  var metas = alias ? [alias.meta] : $app.findRecordsByFilter(metaCol, "sheet = '" + quote(sheetKey) + "'", "", 1, 0);
  var meta = metas && metas.length ? metas[0] : null;
  if (!meta) return e.json(404, { error: "sheet not found: " + sh });
  var headers = jsonValue(meta.get("headers"), []);
  if (!Array.isArray(headers)) headers = [];
  var i, k;

  if (method === "POST") {
    var row = body.row || {};
    if (typeof row !== "object" || Array.isArray(row)) return e.json(400, { error: "row object required" });
    if (alias) row = alias.rowToPhys(row);   // [Phase4] 옛 열 → 통합 열 + 구분
    else if (__alias.isUnifiedKey(sheetKey) && String(row["구분"] || "").trim() === "") return e.json(400, { error: "구분 required for unified sheet " + sh });
    if (sheetKey === "ops_판매설정" && String(row["프로그램ID"] || "").trim() !== "") {
      // [Phase4] 판매설정은 프로그램ID 1행 — 다른 구분으로 남아 있던 같은 ID 행은 지운다(콘텐츠구분 변경 케이스)
      var dupAll = $app.findRecordsByFilter(col, "sheet = 'ops_판매설정'", "rowIndex", 50000, 0), dupDel = 0;
      for (i = 0; i < dupAll.length; i++) { var dd = jsonValue(dupAll[i].publicExport().data, {}); if (dd && String(dd["프로그램ID"] || "").trim() === String(row["프로그램ID"]).trim()) { $app.delete(dupAll[i]); dupDel++; } }
      if (dupDel) meta.set("rowCount", Math.max(0, (meta.get("rowCount") || 0) - dupDel));
    }
''', 'opsRow-post')

rep('''  var keyCol = String(body.keyCol || "").trim(), key = String(body.key === undefined ? "" : body.key).trim();
  if (!keyCol || !key) return e.json(400, { error: "keyCol/key required" });
  var records = $app.findRecordsByFilter(col, "sheet = '" + quote(sheetKey) + "'", "rowIndex", 50000, 0);
  var target = null, tdata = null;
  for (i = 0; i < records.length; i++) {
    var d = jsonValue(records[i].publicExport().data, {});
    if (d && String(d[keyCol] === undefined ? "" : d[keyCol]).trim() === key) { target = records[i]; tdata = d; break; }
  }
''', '''  var keyCol = String(body.keyCol || "").trim(), key = String(body.key === undefined ? "" : body.key).trim();
  if (!keyCol || !key) return e.json(400, { error: "keyCol/key required" });
  if (alias) keyCol = alias.toPhys(keyCol);   // [Phase4] ID/공연ID/전시ID → 프로그램ID
  var records = alias ? alias.findRows(col) : $app.findRecordsByFilter(col, "sheet = '" + quote(sheetKey) + "'", "rowIndex", 50000, 0);
  var target = null, tdata = null;
  for (i = 0; i < records.length; i++) {
    var d = jsonValue(records[i].publicExport().data, {});
    if (alias && !alias.isPart(d)) continue;   // [Phase4] 같은 구분 안에서만
    if (d && String(d[keyCol] === undefined ? "" : d[keyCol]).trim() === key) { target = records[i]; tdata = d; break; }
  }
''', 'opsRow-find')

rep('''  var patch = body.patch || {};
  if (typeof patch !== "object" || Array.isArray(patch)) return e.json(400, { error: "patch object required" });
  var out = {};
''', '''  var patch = body.patch || {};
  if (typeof patch !== "object" || Array.isArray(patch)) return e.json(400, { error: "patch object required" });
  if (alias) { patch = alias.rowToPhys(patch); delete patch["구분"]; }   // [Phase4] 열 이름·값 번역(구분은 못 바꿈)
  var out = {};
''', 'opsRow-patch')

# ---- postOps
rep('''  var body = localBody();
  var sh = body.sheet;
  if (!sh) return e.json(400, { error: "sheet required" });
  var sheetKey = localSheet(sh);
  var mode = body.mode; // 'append' or undefined
  var col = $app.findCollectionByNameOrId("ymdata");
  var bulkMemberImport = body.bulkImport === true && sheetKey === "ops_회원";
  if (bulkMemberImport) ymmetaUpsert("_member_importing", { active: true }, "member-import", 1, 1);
  if (mode !== "append") {
    // full replace: delete existing rows for this sheet
    var existing = $app.findRecordsByFilter(col, "sheet = '" + localQuote(sheetKey) + "'", "", 50000, 0);
    for (var di = 0; di < existing.length; di++) {
      $app.delete(existing[di]);
    }
  }
  // ensure meta with headers
  var headers = body.headers || [];
  var meta;
  if (mode === "append") {
    meta = localMetaGet(sheetKey) || localMeta(sheetKey, headers, "", 0, 2);
    if (headers.length) {
      meta.set("headers", headers);
      $app.save(meta);
    }
  } else {
    meta = localMeta(sheetKey, headers, "", 0, 2);
  }
  var nri = meta.get("nextRowIndex") || 2;
  var rows = body.rows || [];
  var inserted = 0;
  for (var i = 0; i < rows.length; i++) {
    var data = {};
    var keys = Object.keys(rows[i] || {});
    for (var ki = 0; ki < keys.length; ki++) data[keys[ki]] = rows[i][keys[ki]];
    var rec = new Record(col, { sheet: sheetKey, rowIndex: nri, data: data });
    $app.save(rec);
    nri++;
    inserted++;
  }
  meta.set("rowCount", (meta.get("rowCount") || 0) + (mode === "append" ? inserted : inserted));
  meta.set("nextRowIndex", nri);
  $app.save(meta);
''', REQ + '''  var body = localBody();
  var sh = body.sheet;
  if (!sh) return e.json(400, { error: "sheet required" });
  var alias = __alias.opsAlias(sh, $app);
  var sheetKey = alias ? alias.phys : localSheet(sh);
  var mode = body.mode; // 'append' or undefined
  var col = $app.findCollectionByNameOrId("ymdata");
  var rows = body.rows || [];
  var bulkMemberImport = body.bulkImport === true && sheetKey === "ops_회원";
  if (bulkMemberImport) ymmetaUpsert("_member_importing", { active: true }, "member-import", 1, 1);
  var removed = 0;
  if (!alias && __alias.isUnifiedKey(sheetKey) && mode !== "append" && body.force !== true && localMetaGet(sheetKey)) {
    return e.json(409, { error: "unified sheet whole-replace refused (use old sheet name, mode:'append', or force:true): " + sh });   // [Phase4] 통합 시트 통째 삭제 사고 방지
  }
  if (mode !== "append") {
    // full replace: delete existing rows for this sheet (별칭이면 같은 구분의 행만)
    var existing = alias ? alias.findRows(col) : $app.findRecordsByFilter(col, "sheet = '" + localQuote(sheetKey) + "'", "", 50000, 0);
    if (alias && rows.length === 0 && existing.length > 0 && body.allowEmpty !== true) {
      return e.json(409, { error: "empty replace refused (allowEmpty:true to confirm)", existing: existing.length });   // [Phase4] 빈 저장으로 구분 통째 삭제 방지
    }
    for (var di = 0; di < existing.length; di++) {
      if (alias && !alias.isPart(__alias.parseJson(existing[di].publicExport().data, {}))) continue;
      $app.delete(existing[di]); removed++;
    }
  }
  // ensure meta with headers
  var headers = body.headers || [];
  var meta;
  if (alias) {
    // [Phase4] 통합 시트 헤더는 보존, 앱이 보낸 옛 헤더 중 새 열만 통합 이름으로 추가(빈 이름 제외)
    meta = alias.meta;
    var pH = __alias.parseJson(meta.get("headers"), []); if (!Array.isArray(pH)) pH = ["프로그램ID","구분","명칭"];
    var pAdded = false;
    for (var hi = 0; hi < headers.length; hi++) { var pc = alias.toPhys(headers[hi]); if (!pc || !String(pc).trim()) continue; if (pH.indexOf(pc) < 0) { pH.push(pc); pAdded = true; } }
    if (pAdded) meta.set("headers", pH);
  } else if (mode === "append") {
    meta = localMetaGet(sheetKey) || localMeta(sheetKey, headers, "", 0, 2);
    if (headers.length) {
      meta.set("headers", headers);
      $app.save(meta);
    }
  } else {
    meta = localMeta(sheetKey, headers, "", 0, 2);
  }
  var nri = meta.get("nextRowIndex") || 2;
  var inserted = 0;
  for (var i = 0; i < rows.length; i++) {
    var data = {};
    var src = alias ? alias.rowToPhys(rows[i] || {}) : (rows[i] || {});
    var keys = Object.keys(src);
    for (var ki = 0; ki < keys.length; ki++) data[keys[ki]] = src[keys[ki]];
    var rec = new Record(col, { sheet: sheetKey, rowIndex: nri, data: data });
    $app.save(rec);
    nri++;
    inserted++;
  }
  if (alias) {
    // [Phase4] rowCount 는 실제 행 수로 다시 센다(구분 공유 시트라 가감 누적 대신 재계산)
    meta.set("rowCount", $app.findRecordsByFilter(col, "sheet = '" + localQuote(sheetKey) + "'", "", 50000, 0).length);
  } else {
    meta.set("rowCount", (meta.get("rowCount") || 0) + inserted);
  }
  meta.set("nextRowIndex", nri);
  $app.save(meta);
  try { var lmc = $app.findCollectionByNameOrId("ymmeta"); var lm = $app.findRecordsByFilter(lmc, "sheet = '_lastmod'", "", 1, 0); if (lm && lm.length) { lm[0].set("source", new Date().toISOString()); $app.save(lm[0]); } } catch (lmErr) {}   // [Phase4] 통째 저장도 lastmod 갱신
''', 'postOps')

rep('''  return e.json(200, { ok: true, inserted: inserted });
}
''', '''  return e.json(200, { ok: true, inserted: inserted, removed: removed, via: sheetKey });
}
''', 'postOps-resp')

io.open(P,'w',encoding='utf-8').write(s)
print('OK v2', len(s))

# ---- 스위치 라우트: POST /api/ops/alias-switch {on:true|false}  → 통합 3 메타 source=unified / 옛 5 메타 source=frozen→…
SWITCH='''
function opsAliasSwitch(e) {
  var __alias = require(__hooks + "/ym-ops-alias-lib.js");
  var info = e.requestInfo() || {}; var body = info.body || {}; if (typeof body === "string") { try { body = JSON.parse(body); } catch (err) { body = {}; } }
  var on = body.on === true;
  var mc = $app.findCollectionByNameOrId("ymmeta"), log = [];
  var T = __alias.TABLE, seen = {};
  for (var k in T) {
    if (!Object.prototype.hasOwnProperty.call(T, k)) continue;
    var t = T[k];
    if (!seen[t.phys]) { seen[t.phys] = 1; var um = $app.findRecordsByFilter(mc, "sheet = '" + t.phys + "'", "", 1, 0); if (um && um.length) { um[0].set("source", on ? "unified" : "unified-off"); $app.save(um[0]); log.push([t.phys, on ? "unified" : "unified-off"]); } else log.push([t.phys, "MISSING"]); }
    var om = $app.findRecordsByFilter(mc, "sheet = '" + t.oldKey + "'", "", 1, 0);
    if (om && om.length) { om[0].set("source", on ? ("frozen→" + t.phys + " 260903") : ""); $app.save(om[0]); log.push([t.oldKey, on ? "frozen" : "restored"]); } else log.push([t.oldKey, "MISSING"]);
  }
  var lm = $app.findRecordsByFilter(mc, "sheet = '_lastmod'", "", 1, 0); if (lm && lm.length) { lm[0].set("source", new Date().toISOString()); $app.save(lm[0]); }
  return e.json(200, { ok: true, on: on, log: log });
}
'''
rep('''routerAdd("POST", "/api/ops/row", opsRow);     // [260903 H-4]
''', SWITCH + '''routerAdd("POST", "/api/ops/row", opsRow);     // [260903 H-4]
routerAdd("POST", "/api/ops/alias-switch", opsAliasSwitch);   // [260903 Phase4] 번역표 스위치(통합 메타 source)
''', 'switch-route')
io.open(P,'w',encoding='utf-8').write(s)
print('OK v2+switch', len(s))
