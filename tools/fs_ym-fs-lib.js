// ym-fs-lib.js — [260904 정본=파일] DB(ymdata/ymmeta) ↔ 앱 파일(server-data/db/<sheet>.json) 동기화 보조.
//   왜: PocketBase DB(/workspace/.pocketbase/...)는 앱 폴더 밖이라 앱을 복제·재생성하면 데이터가 안 따라온다.
//       그래서 정본을 앱 안 파일로 두고, DB는 작업용 사본으로 쓴다.
//   흐름: (1) DB 쓰기 → 표시 파일(server-data/db/.dirty/<sheet>) → 1분 크론이 그 시트를 파일로 내보냄(exportSheet)
//         (2) 부팅 때 DB에 없는 시트는 파일에서 채움(seedMissing)  (3) 수동: /api/ym/fs/export · /api/ym/fs/import
//   Goja ES5 / CommonJS. app 은 인자로 받는다. $os 는 전역.
// api/ 밖(server-data/)에 둔다 — api/ 안 파일 변경은 훅 재적재를 부를 수 있고, public/ 은 웹에 노출된다.
// [실측 260904] __hooks 는 /workspace/app/api 가 아니라 플랫폼이 복사해 둔 /tmp/pb_hooks_active 다.
//   그래서 앱 폴더는 고정 경로 /workspace/app 을 먼저 찾고(있으면), 없으면 __hooks/.. 로 떨어진다.
var APP_ROOT_FIXED = "/workspace/app";
var _rootCache = null;
function appRoot(hooks) {
  if (_rootCache) return _rootCache;
  var r = null;
  try { $os.stat(APP_ROOT_FIXED + "/api"); r = APP_ROOT_FIXED; } catch (err) { r = null; }
  if (!r) r = hooks + "/..";
  _rootCache = r;
  return r;
}
function dir(hooks) { return appRoot(hooks) + "/server-data/db"; }
function dirtyDir(hooks) { return appRoot(hooks) + "/server-data/db/.dirty"; }
function ensureDir(p) { try { $os.mkdirAll(p, 493); } catch (err) {} }
function parseJson(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
  return raw;
}
function safeName(sheetKey) { return String(sheetKey || "").replace(/[\/\\:*?"<>|']/g, "_"); }
function keyOk(sheetKey) { var k = String(sheetKey || ""); return k.length > 0 && k.length <= 120 && safeName(k) === k; }   // 필터 문자열에 그대로 넣으므로 따옴표·경로문자 금지
function filePath(hooks, sheetKey) { return dir(hooks) + "/" + safeName(sheetKey) + ".json"; }
// 내보내기 제외: 내부 상태 시트(_ 접두)·동결 시트(frozen)·회원(CSV 원천)
function skipSheet(sheetKey, source) {
  if (!sheetKey) return true;
  if (sheetKey.charAt(0) === "_") return true;
  if (String(source || "").indexOf("frozen") === 0) return true;
  return false;
}
function rowData(rec) {
  try { if (typeof rec.getString === "function") { var t = rec.getString("data"); if (t) return JSON.parse(t); } } catch (err) {}
  var d = parseJson(rec.publicExport().data, {});
  return (d && typeof d === "object") ? d : {};
}
// 임시파일에 쓰고 rename — 쓰는 도중 죽거나 동시에 써도 반쪽 JSON 이 남지 않는다
function writeAtomic(p, text) {
  var tmp = p + "." + Date.now() + "." + Math.floor(Math.random() * 1e6) + ".tmp";
  $os.writeFile(tmp, text, 420);
  try { $os.rename(tmp, p); } catch (err) { try { $os.remove(tmp); } catch (err2) {} throw err; }
}
function fileExists(p) { try { $os.stat(p); return true; } catch (err) { return false; } }
function readText(p) { var raw = $os.readFile(p); return typeof raw === "string" ? raw : toString(raw); }

function findMeta(app, sheetKey) {
  if (!keyOk(sheetKey)) return null;
  var mc = app.findCollectionByNameOrId("ymmeta");
  var found = app.findRecordsByFilter(mc, "sheet = '" + sheetKey + "'", "", 1, 0);
  return found && found.length ? found[0] : null;
}
function findRows(app, sheetKey) {
  if (!keyOk(sheetKey)) return [];
  var col = app.findCollectionByNameOrId("ymdata");
  return app.findRecordsByFilter(col, "sheet = '" + sheetKey + "'", "rowIndex", 100000, 0) || [];
}

// DB → 파일. 반환 {sheet, rows, bytes}
function exportSheet(app, hooks, sheetKey) {
  var meta = findMeta(app, sheetKey);
  if (!meta) {   // 시트가 DB에서 지워짐 → 파일도 치운다(복제본에서 되살아나지 않게). _deleted/ 로 이동
    var fp0 = filePath(hooks, sheetKey);
    if (fileExists(fp0)) { try { ensureDir(dir(hooks) + "/_deleted"); $os.rename(fp0, dir(hooks) + "/_deleted/" + safeName(sheetKey) + "." + Date.now() + ".json"); } catch (err0) {} }
    return { sheet: sheetKey, skipped: "no-meta" };
  }
  var source = meta.get("source");
  if (skipSheet(sheetKey, source)) return { sheet: sheetKey, skipped: "excluded" };
  var recs = findRows(app, sheetKey), rows = [];
  for (var i = 0; i < recs.length; i++) rows.push({ i: recs[i].get("rowIndex"), d: rowData(recs[i]) });
  var doc = { sheet: sheetKey, headers: parseJson(meta.get("headers"), []), source: source || "", rowCount: meta.get("rowCount") || rows.length, nextRowIndex: meta.get("nextRowIndex") || (rows.length + 2), exportedAt: new Date().toISOString(), rows: rows };
  ensureDir(dir(hooks));
  var text = JSON.stringify(doc);
  writeAtomic(filePath(hooks, sheetKey), text);
  return { sheet: sheetKey, rows: rows.length, bytes: text.length };
}

// 파일 → DB. opts.force 가 아니면 DB에 행이 있을 때 건너뜀. 반환 {sheet, inserted, removed}
function importSheet(app, hooks, sheetKey, opts) {
  opts = opts || {};
  if (!keyOk(sheetKey)) throw new Error("bad sheet key");
  var p = filePath(hooks, sheetKey);
  var doc = JSON.parse(readText(p));
  if (!doc || doc.sheet !== sheetKey) throw new Error("file sheet mismatch: " + sheetKey);
  var col = app.findCollectionByNameOrId("ymdata"), mc = app.findCollectionByNameOrId("ymmeta");
  var existing = findRows(app, sheetKey);
  if (existing.length && !opts.force) return { sheet: sheetKey, skipped: "db-has-rows", dbRows: existing.length };
  var removed = 0;
  for (var i = 0; i < existing.length; i++) { app.delete(existing[i]); removed++; }
  var rows = doc.rows || [], inserted = 0, maxIdx = 1;
  for (var j = 0; j < rows.length; j++) {
    var ri = (rows[j] && rows[j].i) ? Number(rows[j].i) : (j + 2);
    if (ri > maxIdx) maxIdx = ri;
    app.save(new Record(col, { sheet: sheetKey, rowIndex: ri, data: (rows[j] && rows[j].d) || {} }));
    inserted++;
  }
  var meta = findMeta(app, sheetKey);
  if (!meta) meta = new Record(mc, { sheet: sheetKey });
  meta.set("headers", doc.headers || []);
  meta.set("source", doc.source || "");
  meta.set("rowCount", inserted);
  meta.set("nextRowIndex", Math.max(maxIdx + 1, doc.nextRowIndex || 2));
  app.save(meta);
  return { sheet: sheetKey, inserted: inserted, removed: removed };
}

function listFiles(hooks) {
  var out = [];
  try {
    var ents = $os.readDir(dir(hooks));
    for (var i = 0; i < ents.length; i++) { var n = ents[i].name(); if (/\.json$/.test(n) && n.charAt(0) !== "_" && !ents[i].isDir()) out.push(n.replace(/\.json$/, "")); }
  } catch (err) {}
  return out;
}
function markDirty(hooks, sheetKey) {
  if (!sheetKey || sheetKey.charAt(0) === "_") return;
  var mp = dirtyDir(hooks) + "/" + safeName(sheetKey);
  if (fileExists(mp)) return;   // 같은 요청 안의 수천 번 저장 → stat 한 번으로 끝
  try { ensureDir(dirtyDir(hooks)); $os.writeFile(mp, "1", 420); } catch (err) { console.log("[ym-fs] markDirty failed " + sheetKey + ": " + String(err)); }
}
function clearDirty(hooks, sheetKey) { try { $os.remove(dirtyDir(hooks) + "/" + safeName(sheetKey)); } catch (err) {} }
function listDirty(hooks) {
  var out = [];
  try { var ents = $os.readDir(dirtyDir(hooks)); for (var i = 0; i < ents.length; i++) if (!ents[i].isDir()) out.push(ents[i].name()); } catch (err) {}
  return out;
}
// 크론: 표시된 시트만 내보내기
function flushDirty(app, hooks) {
  var names = listDirty(hooks), done = [];
  for (var i = 0; i < names.length; i++) {
    clearDirty(hooks, names[i]);   // 먼저 지운다 — 내보내는 동안 들어온 쓰기가 새 표시를 남기게
    try { var r = exportSheet(app, hooks, names[i]); done.push(r); } catch (err) { done.push({ sheet: names[i], error: String(err) }); markDirty(hooks, names[i]); }
  }
  return done;
}
// 컬렉션 스키마(ymdata·ymmeta)도 파일로 — 복제된 앱엔 컬렉션 자체가 없을 수 있다
var SCHEMA_FILE = "_collections.json";
function exportSchema(app, hooks) {
  var names = ["ymdata","ymmeta"], out = [];
  for (var i = 0; i < names.length; i++) {
    var c = app.findCollectionByNameOrId(names[i]);
    var j = null;
    try { j = JSON.parse(toString(c.marshalJSON())); } catch (err) { j = null; }
    if (j) out.push(j);
  }
  if (!out.length) return { skipped: "no-schema" };
  ensureDir(dir(hooks));
  writeAtomic(dir(hooks) + "/" + SCHEMA_FILE, JSON.stringify(out));
  return { schema: out.length };
}
function hasCollections(app) { try { app.findCollectionByNameOrId("ymdata"); app.findCollectionByNameOrId("ymmeta"); return true; } catch (err) { return false; } }
function importSchema(app, hooks) {
  var arr = JSON.parse(readText(dir(hooks) + "/" + SCHEMA_FILE));
  try { app.importCollections(arr, false); } catch (err) { if (!hasCollections(app)) throw err; }
  return hasCollections(app);
}
// 전체 내보내기(제외 규칙 적용)
function exportAll(app, hooks) {
  try { exportSchema(app, hooks); } catch (err0) {}
  var mc = app.findCollectionByNameOrId("ymmeta");
  var metas = app.findRecordsByFilter(mc, "sheet != ''", "", 1000, 0) || [], out = [];
  for (var i = 0; i < metas.length; i++) {
    var sk = metas[i].get("sheet");
    if (skipSheet(sk, metas[i].get("source"))) continue;
    try { out.push(exportSheet(app, hooks, sk)); } catch (err) { out.push({ sheet: sk, error: String(err) }); }
  }
  return out;
}
// 부팅: 파일은 있는데 DB에 메타가 없는 시트만 채움(복제·재생성 직후)
function seedMissing(app, hooks) {
  var out = [];
  if (!hasCollections(app)) {
    try { if (!importSchema(app, hooks)) { out.push({ error: "collections missing and schema import failed" }); writeReport(hooks, out); return out; } out.push({ schema: "imported" }); }
    catch (err0) { out.push({ error: "collections missing: " + String(err0) }); writeReport(hooks, out); return out; }
  }
  var files = listFiles(hooks);
  for (var i = 0; i < files.length; i++) {
    if (files[i].charAt(0) === "_") continue;
    if (findMeta(app, files[i])) continue;
    try {
      var r = null, name = files[i];
      app.runInTransaction(function (tx) { r = importSheet(tx, hooks, name, { force: false }); });
      out.push(r);
    } catch (err) { out.push({ sheet: files[i], error: String(err) }); }
  }
  if (out.length) writeReport(hooks, out);
  return out;
}
var REPORT_FILE = "_seed-report.json";
function writeReport(hooks, out) { try { ensureDir(dir(hooks)); writeAtomic(dir(hooks) + "/" + REPORT_FILE, JSON.stringify({ at: new Date().toISOString(), result: out })); } catch (err) {} }
function readReport(hooks) { try { return JSON.parse(readText(dir(hooks) + "/" + REPORT_FILE)); } catch (err) { return null; } }
// 부팅 정합 검사: 표시 파일이 유실됐어도(내보내는 중 재시작 등) 파일이 DB보다 낡았으면 다시 내보낸다
function reconcile(app, hooks) {
  var mc = app.findCollectionByNameOrId("ymmeta"), col = app.findCollectionByNameOrId("ymdata");
  var metas = app.findRecordsByFilter(mc, "sheet != ''", "", 1000, 0) || [], out = [];
  for (var i = 0; i < metas.length; i++) {
    var sk = metas[i].get("sheet");
    if (skipSheet(sk, metas[i].get("source")) || !keyOk(sk)) continue;
    var fp = filePath(hooks, sk), stale = !fileExists(fp);
    if (!stale) {
      try {
        var doc = JSON.parse(readText(fp)), exp = String(doc.exportedAt || "");
        var last = app.findRecordsByFilter(col, "sheet = '" + sk + "'", "-updated", 1, 0) || [];
        var lu = last.length ? String(last[0].get("updated") || "") : "";
        var mu = String(metas[i].get("updated") || "");
        var isoOf = function (v) { v = String(v || ""); return v ? new Date(v.replace(" ", "T")).getTime() : 0; };
        stale = !exp || isoOf(lu) > isoOf(exp) || isoOf(mu) > isoOf(exp);
      } catch (err) { stale = true; }
    }
    if (stale) markDirty(hooks, sk);
    if (stale) out.push(sk);
  }
  return out;
}
function status(app, hooks) {
  var files = listFiles(hooks), out = [];
  for (var i = 0; i < files.length; i++) {
    var st = { sheet: files[i], dbRows: findRows(app, files[i]).length, fileRows: null, exportedAt: null };
    try { var doc = JSON.parse(readText(filePath(hooks, files[i]))); st.fileRows = (doc.rows || []).length; st.exportedAt = doc.exportedAt || null; } catch (err) { st.error = String(err); }
    out.push(st);
  }
  return { dir: dir(hooks), files: out, dirty: listDirty(hooks), schema: fileExists(dir(hooks) + "/" + SCHEMA_FILE), lastSeed: readReport(hooks) };
}

module.exports = { reconcile: reconcile, exportSchema: exportSchema, exportSheet: exportSheet, importSheet: importSheet, exportAll: exportAll, seedMissing: seedMissing, flushDirty: flushDirty, markDirty: markDirty, listFiles: listFiles, status: status, skipSheet: skipSheet, filePath: filePath };
