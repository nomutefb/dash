// ym-crons.pb.js — Worker cron replacements on the PocketBase scheduler.
// The implementation is required inside each handler because PocketBase
// isolates hook handler scopes.

routerAdd("POST", "/api/monitor/scan", function(e) {
  try { return e.json(200, { ok: true, count: require(__hooks + "/ym-cron-lib.js").scan() }); }
  catch (err) { console.log("[ym-cron] manual scan failed: " + String(err)); return e.json(200, { ok: false, error: String(err) }); }
});

routerAdd("GET", "/api/monitor/kopis-related", function(e) {
  return e.json(200, { rows: [], note: "KOPIS related lookup is available after the next monitor scan" });
});

routerAdd("POST", "/api/monitor/judge", function(e) {
  try {
    var metaCol = $app.findCollectionByNameOrId("ymmeta"), row = $app.findRecordById(metaCol, "1cvr0br28a48ini"), raw = row.get("headers");
    if (raw && typeof raw.string === "function") raw = JSON.parse(raw.string());
    var lib = require(__hooks + "/ym-cron-lib.js"), result;
    try { result = lib.judgeRows((raw && raw.rows) || []); } catch (judgeErr) { result = lib.fallbackRows((raw && raw.rows) || []); }
    row.set("headers", { rows: result.rows, last: raw.last || null, judge: { at: new Date().toISOString(), count: result.count, model: result.model, skipped: result.skipped || false } });
    $app.save(row);
    return e.json(200, { ok: true, count: result.count });
  }
  catch (err) { console.log("[ym-cron] manual judge failed: " + String(err)); return e.json(200, { ok: false, error: String(err) }); }
});

cronAdd("ym-promo-alert-scan", "*/10 * * * *", function() {
  try { console.log("[ym-cron] promo alert scan pending=" + require(__hooks + "/ym-cron-lib.js").promo() + " notifications=muted"); }
  catch (err) { console.log("[ym-cron] promo scan failed: " + String(err)); }
});

cronAdd("ym-hold-auto-cancel", "5 0 * * *", function() {
  try { console.log("[ym-cron] hold auto-cancel changed=" + require(__hooks + "/ym-cron-lib.js").holdCancel()); }
  catch (err) { console.log("[ym-cron] hold cancel failed: " + String(err)); }
});

cronAdd("ym-monitor-scan", "0 * * * *", function() {
  try { console.log("[ym-cron] monitor scan rows=" + require(__hooks + "/ym-cron-lib.js").scan()); }
  catch (err) { console.log("[ym-cron] monitor failed: " + String(err)); }
});

// KST 08/11/14/17 = UTC 23/02/05/08.
cronAdd("ym-monitor-judge", "0 23,2,5,8 * * *", function() {
  try {
    var metaCol = $app.findCollectionByNameOrId("ymmeta"), row = $app.findRecordById(metaCol, "1cvr0br28a48ini"), raw = row.get("headers");
    if (raw && typeof raw.string === "function") raw = JSON.parse(raw.string());
    var lib = require(__hooks + "/ym-cron-lib.js"), result;
    try { result = lib.judgeRows((raw && raw.rows) || []); } catch (judgeErr) { result = lib.fallbackRows((raw && raw.rows) || []); }
    row.set("headers", { rows: result.rows, last: raw.last || null, judge: { at: new Date().toISOString(), count: result.count, model: result.model, skipped: result.skipped || false } });
    $app.save(row);
    console.log("[ym-cron] judge count=" + result.count);
  }
  catch (err) { console.log("[ym-cron] judge failed: " + String(err)); }
});

// KST 03:00 = UTC 18:00. 일 1회 회원 요약 스냅샷을 보정한다.
cronAdd("ym-member-summary-refresh", "0 18 * * *", function() {
  try {
    var summary = require(__hooks + "/ym-member-summary-lib.js").rebuild();
    console.log("[ym-cron] member summary refreshed total=" + summary.total + " updatedAt=" + summary.updatedAt);
  }
  catch (err) { console.log("[ym-cron] member summary refresh failed: " + String(err)); }
});
