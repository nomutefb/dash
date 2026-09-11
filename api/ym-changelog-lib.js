// api/ym-changelog-lib.js — [260906 입력절차①] 수정 이력. 마스터·일일실적·캘린더 행이 바뀔 때 "누가·언제·어느 칸을·뭐에서 뭐로" 를 같은 환경의 ymdata 시트 '_ym_change_log' 에 남긴다.
//   잠금은 없다(운영자 결정: 안 잠그고 이력만). 기록에 실패해도 저장은 막지 않는다(try/catch, 절대 throw 안 함).
//   누가 = 요청 헤더 X-Ym-User (ym-changelog.pb.js 의 routerUse 가 $app.store() 에 넣어 둔 값). 앱이 아직 그 헤더를 안 보내면 빈 값.
//   이관 실행 중(ym-env-lib 이관 러너가 store 'ym_route' 에 '/api/ym/migrate' 를 남김)엔 경로만 '이관' 으로 적힌다.
//   행 1개 = 저장 1번. 변경 = [{열, 전, 후}] JSON. 프로그램ID/실적ID/일정ID 를 키로 같이 적어 나중에 "이 프로그램 이력" 으로 뽑는다.
var LOG = "_ym_change_log";
var WATCH = {"ops_프로그램마스터":"프로그램ID","ops_일일실적":"실적ID","ops_캘린더":"일정ID"};
var SKIP_COLS = {"수정일시":1,"수정자":1,"입력시간(KST)":1};
var MAX_LEN = 4000;
function nz(v) { return String(v === undefined || v === null ? "" : v).trim(); }
function jsonValue(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch (err2) { return fallback; } }
  if (typeof raw === "object") return raw;
  return fallback;
}
function quote(v) { return String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'"); }
function nowKst() { var d = new Date(Date.now() + 9 * 3600 * 1000); return d.toISOString().replace("T", " ").slice(0, 19); }
function storeGet(k) { try { var v = $app.store().get(k); return v === undefined || v === null ? "" : String(v); } catch (e) { return ""; } }
function diff(before, after) {
  var out = [], keys = {}, k;
  for (k in before) keys[k] = 1; for (k in after) keys[k] = 1;
  var names = Object.keys(keys).sort();
  for (var i = 0; i < names.length; i++) {
    var key = names[i]; if (SKIP_COLS[key] || key.charAt(0) === "_") continue;
    var a = before[key], b = after[key];
    var sa = (a !== null && typeof a === "object") ? JSON.stringify(a) : nz(a);
    var sb = (b !== null && typeof b === "object") ? JSON.stringify(b) : nz(b);
    if (sa === sb) continue;
    out.push({ "열": key, "전": sa.length > MAX_LEN ? sa.slice(0, MAX_LEN) + "…" : sa, "후": sb.length > MAX_LEN ? sb.slice(0, MAX_LEN) + "…" : sb });
  }
  return out;
}
function metaFor(mc) {
  var ms = $app.findRecordsByFilter(mc, "sheet = '" + LOG + "'", "", 1, 0);
  if (ms && ms.length) return ms[0];
  var col = $app.findCollectionByNameOrId(mc);
  var m = new Record(col, { sheet: LOG, headers: ["시각", "사용자", "경로", "시트", "키", "동작", "변경", "변경수"], rowCount: 0, nextRowIndex: 2 });
  $app.save(m); return m;
}
function write(dc, mc, row) {
  var meta = metaFor(mc);
  var ri = meta.get("nextRowIndex") || 2;
  var col = $app.findCollectionByNameOrId(dc);
  $app.save(new Record(col, { sheet: LOG, rowIndex: ri, data: row }));
  meta.set("rowCount", (meta.get("rowCount") || 0) + 1); meta.set("nextRowIndex", ri + 1); $app.save(meta);
}
// e: 레코드 훅 이벤트. action: create|update|delete
function onChange(e, action) {
  try {
    var rec = e.record; if (!rec) return;
    var sheet = nz(rec.get("sheet")); var keyCol = WATCH[sheet]; if (!keyCol) return;
    var dc = String(rec.collection().name || ""); if (dc.indexOf("ymdata") !== 0) return;
    var mc = dc.replace("ymdata", "ymmeta");
    var after = jsonValue(rec.get("data"), {}) || {}, before = {};
    if (action === "update" || action === "delete") {
      var orig = null;
      try { if (typeof rec.original === "function") orig = rec.original(); } catch (e1) { orig = null; }
      if (!orig) { try { orig = $app.findRecordById(dc, rec.id); } catch (e2) { orig = null; } }
      if (orig) before = jsonValue(orig.get("data"), {}) || {};
    }
    if (action === "delete") after = {};
    var ch = (action === "create") ? diff({}, after) : diff(before, after);
    if (action === "update" && !ch.length) return;
    var route = storeGet("ym_route"); if (route.indexOf("/api/ym/migrate") >= 0) route = "이관";
    var key = nz(after[keyCol]) || nz(before[keyCol]);
    var row = { "시각": nowKst(), "사용자": storeGet("ym_who"), "경로": route, "시트": sheet.replace(/^ops_/, ""), "키": key, "동작": action === "create" ? "추가" : action === "delete" ? "삭제" : "수정", "변경": JSON.stringify(action === "create" ? [] : ch), "변경수": String(action === "create" ? Object.keys(after).length : ch.length) };
    if (action === "create") row["변경"] = JSON.stringify([{ "열": "정본명", "전": "", "후": nz(after["정본명"] || after["명칭"] || after["프로그램"] || "") }]);
    write(dc, mc, row);
  } catch (err) { try { console.log("[ym-changelog] " + err); } catch (e3) {} }
}
// 이력 조회: 키(프로그램ID 등)로, 최신순 limit 개
function listFor(app, dc, key, limit) {
  if (String(dc) === "ymdata_dev") {
    var wanted = Math.max(1, Math.min(500, Math.floor(Number(limit) || 200))), pageSize = 200, offset = 0, found = [];
    while (found.length < wanted) {
      var page = app.findRecordsByFilter(dc, "sheet = '" + LOG + "'", "-rowIndex,-id", pageSize, offset);
      for (var j = 0; j < page.length && found.length < wanted; j++) { var item = jsonValue(page[j].get("data"), {}) || {}; if (!key || nz(item["키"]) === key) found.push(item); }
      if (page.length < pageSize) break;
      offset += page.length;
    }
    return found;
  }
  var rows = app.findRecordsByFilter(dc, "sheet = '" + LOG + "'", "-rowIndex", limit || 200, 0), out = [];
  for (var i = 0; i < rows.length; i++) { var d = jsonValue(rows[i].get("data"), {}) || {}; if (!key || nz(d["키"]) === key) out.push(d); }
  return out;
}
module.exports = { LOG: LOG, WATCH: WATCH, onChange: onChange, listFor: listFor, diff: diff };
