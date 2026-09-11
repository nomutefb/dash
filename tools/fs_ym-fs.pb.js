// ym-fs.pb.js — [260904 정본=파일] DB ↔ server-data/db/<sheet>.json 동기화 라우트·크론·부팅 시딩.
//   규칙(api/README.md): Goja ES5, CommonJS, handler 안에서 require. 구현은 ym-fs-lib.js.
//   - GET  /api/ym/fs/status            파일 vs DB 행 수 + 미반영(dirty) 목록
//   - POST /api/ym/fs/export {sheet}    DB → 파일 (sheet 없으면 전체)
//   - POST /api/ym/fs/import {sheet, force}  파일 → DB (force 아니면 DB에 행 있을 때 건너뜀)
//   - 레코드 저장/삭제 훅: ymdata·ymmeta 변경 시트를 .dirty 로 표시 → 크론(1분)이 파일로 내보냄
//   - 부팅: 파일은 있는데 DB에 없는 시트를 채움(앱 복제·재생성 직후)

routerAdd("GET", "/api/ym/fs/status", function (e) {
  try { return e.json(200, require(__hooks + "/ym-fs-lib.js").status($app, __hooks)); }
  catch (err) { return e.json(500, { error: String(err) }); }
});

routerAdd("POST", "/api/ym/fs/export", function (e) {
  var lib = require(__hooks + "/ym-fs-lib.js"), body = {};
  try { var __b = e.requestInfo().body; body = (typeof __b === "string") ? (JSON.parse(__b) || {}) : (__b || {}); } catch (err0) { body = {}; }   // 0.23+ 는 이미 객체
  try {
    var sheet = String(body.sheet || "").trim();
    var out = sheet ? lib.exportSheet($app, __hooks, sheet) : lib.exportAll($app, __hooks);
    return e.json(200, { ok: true, result: out });
  } catch (err) { return e.json(500, { ok: false, error: String(err) }); }
});

routerAdd("POST", "/api/ym/fs/import", function (e) {
  var lib = require(__hooks + "/ym-fs-lib.js"), body = {};
  try { var __b = e.requestInfo().body; body = (typeof __b === "string") ? (JSON.parse(__b) || {}) : (__b || {}); } catch (err0) { body = {}; }   // 0.23+ 는 이미 객체
  var sheet = String(body.sheet || "").trim();
  if (!sheet) return e.json(400, { error: "sheet required" });
  try {
    var out = null;
    $app.runInTransaction(function (txApp) { out = lib.importSheet(txApp, __hooks, sheet, { force: body.force === true }); });
    return e.json(200, { ok: true, result: out });
  } catch (err) { return e.json(500, { ok: false, error: String(err) }); }
});

// DB 변경 → dirty 표시 (프로그램 저장($app.save)도 이 훅을 탄다)
function __ymFsMark(e) {
  try {
    var rec = e.record, sheet = rec ? rec.get("sheet") : "";
    if (sheet) require(__hooks + "/ym-fs-lib.js").markDirty(__hooks, String(sheet));
  } catch (err) {}
  e.next();
}
onRecordAfterCreateSuccess(__ymFsMark, "ymdata", "ymmeta");
onRecordAfterUpdateSuccess(__ymFsMark, "ymdata", "ymmeta");
onRecordAfterDeleteSuccess(__ymFsMark, "ymdata", "ymmeta");

cronAdd("ym-fs-flush", "* * * * *", function () {
  try {
    var done = require(__hooks + "/ym-fs-lib.js").flushDirty($app, __hooks);
    if (done.length) console.log("[ym-fs] flushed " + done.length + " sheet(s): " + done.map(function (d) { return d.sheet + (d.error ? "!" : "(" + d.rows + ")"); }).join(", "));
  } catch (err) { console.log("[ym-fs] flush failed: " + String(err)); }
});

onBootstrap(function (e) {
  e.next();
  var lib = require(__hooks + "/ym-fs-lib.js");
  try {
    var out = lib.seedMissing($app, __hooks);
    if (out.length) console.log("[ym-fs] seeded " + out.length + " sheet(s) from files: " + JSON.stringify(out));
  } catch (err) { console.log("[ym-fs] seed failed: " + String(err)); }
  try {   // 파일이 DB보다 낡은 시트는 dirty 로 표시 → 다음 크론이 내보냄(재시작 중 표시 유실 대비)
    var stale = lib.reconcile($app, __hooks);
    if (stale.length) console.log("[ym-fs] stale files re-marked: " + stale.join(", "));
  } catch (err2) { console.log("[ym-fs] reconcile failed: " + String(err2)); }
});
