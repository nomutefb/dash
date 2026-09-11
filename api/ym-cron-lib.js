// Shared implementation for ym-crons.pb.js. Loaded with require() by handlers.
var proxy = require(__hooks + "/_runtime_proxy.js");
var env = require(__hooks + "/_runtime_env.js");
var OPUS = { registeredProviderId: "bea96bff-f8d2-4c04-bfbb-52a51d59d9f1", modelId: "global.anthropic.claude-opus-4-8" };

function now() { return new Date().toISOString(); }
function text(v) { return v === null || v === undefined ? "" : String(v); }
function objectValue(v, fallback) {
  if (v && typeof v.string === "function") { try { return JSON.parse(v.string()); } catch (err0) {} }
  if (v && typeof v === "object") return v;
  if (typeof v === "string") { try { return JSON.parse(v); } catch (err) {} }
  return fallback;
}
function meta(sheet) {
  var rows = $app.findRecordsByFilter("ymmeta", "id != ''", "", 50000, 0);
  for (var i = 0; i < rows.length; i++) if (String(rows[i].get("sheet")) === String(sheet)) return rows[i];
  // The monitor state row is created once during migration; direct lookup
  // keeps it visible across isolated required-module contexts.
  if (String(sheet) === "_monitor") {
    try { return $app.findRecordById($app.findCollectionByNameOrId("ymmeta"), "1cvr0br28a48ini"); } catch (err) {}
  }
  return null;
}
function state(sheet, fallback) {
  var row = meta(sheet);
  return row ? objectValue(row.get("headers"), fallback) : fallback;
}
function saveState(sheet, value) {
  var col = $app.findCollectionByNameOrId("ymmeta"), row = meta(sheet);
  if (!row) row = new Record(col, { sheet: sheet, headers: value, source: "cron", rowCount: 1, nextRowIndex: 1 });
  else row.set("headers", value);
  $app.save(row);
}
function decode(v) { return text(v).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim(); }
function tag(block, name) { var m = text(block).match(new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "i")); return m ? decode(m[1]) : ""; }
function put(rows) {
  var old = state("_monitor", { rows: [], last: null, judge: null }), all = (old.rows || []).concat(rows || []), seen = {}, out = [];
  for (var i = all.length - 1; i >= 0; i--) { var r = all[i] || {}, key = text(r.id || r.link || r.title); if (!key || seen[key]) continue; seen[key] = 1; out.push(r); }
  out.sort(function(a, b) { return text(b.seenAt || b.date).localeCompare(text(a.seenAt || a.date)); });
  saveState("_monitor", { rows: out.slice(0, 300), last: { at: now(), count: out.length }, judge: old.judge || null });
  return out.length;
}
function scan() {
  var at = now(), rows = [], feeds = text(env.GALERT_RSS).split(/\s+/).filter(function(v) { return v; });
  for (var i = 0; i < feeds.length; i++) {
    try {
      var r = proxy.proxyFetch({ url: feeds[i], method: "GET", headers: { Accept: "application/atom+xml,application/xml,text/xml" }, timeout: 20 });
      if (r.statusCode < 200 || r.statusCode >= 300) continue;
      var entries = text(r.text).match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
      for (var j = 0; j < entries.length; j++) { var e = entries[j], lm = e.match(/<link[^>]+href=["']([^"']+)["']/i), link = lm ? decode(lm[1]) : tag(e, "link"), title = tag(e, "title"); if (title || link) rows.push({ id: "google:" + (link || title), src: "google", title: title || link, link: link, date: tag(e, "published") || tag(e, "updated"), seenAt: at, kind: "검색 결과" }); }
    } catch (err) { console.log("[ym-cron] google feed: " + String(err)); }
  }
  try {
    if (text(env.KAKAO_REST_KEY)) {
      var k = proxy.proxyFetch({ url: "https://dapi.kakao.com/v2/search/web?query=" + encodeURIComponent("예울마루") + "&size=50", method: "GET", headers: { Authorization: "KakaoAK " + env.KAKAO_REST_KEY, Accept: "application/json" }, timeout: 20 });
      if (k.statusCode >= 200 && k.statusCode < 300) { var docs = (JSON.parse(k.text || "{}").documents || []); for (var ki = 0; ki < docs.length; ki++) rows.push({ id: "kakao:" + (docs[ki].url || docs[ki].title), src: "kakao", title: decode(docs[ki].title), link: docs[ki].url || "", date: docs[ki].datetime || "", seenAt: at, kind: "다음 검색", extra: decode(docs[ki].contents) }); }
    }
  } catch (err2) { console.log("[ym-cron] kakao search: " + String(err2)); }
  try {
    if (text(env.KOPIS_KEY)) {
      var dt = new Date(), y = dt.getUTCFullYear(), md = String(dt.getUTCMonth() + 1).padStart(2, "0") + String(dt.getUTCDate()).padStart(2, "0"), p = proxy.proxyFetch({ url: "https://www.kopis.or.kr/openApi/restful/pblprfr?service=" + encodeURIComponent(env.KOPIS_KEY) + "&stdate=" + y + md + "&eddate=" + y + "1231&cpage=1&rows=100&shprfnm=" + encodeURIComponent("예울마루"), method: "GET", headers: { Accept: "application/xml,text/xml" }, timeout: 30 });
      if (p.statusCode >= 200 && p.statusCode < 300) { var dbs = text(p.text).match(/<db\b[\s\S]*?<\/db>/gi) || []; for (var pi = 0; pi < dbs.length; pi++) { var db = dbs[pi], id = tag(db, "mt20id"), name = tag(db, "prfnm"), from = tag(db, "prfpdfrom"), to = tag(db, "prfpdto"); if (name) rows.push({ id: "kopis:" + (id || name + from), src: "kopis", title: name, link: id ? "https://www.kopis.or.kr/por/db/pblprfr/pblprfrView.do?mt20Id=" + id : "", date: from, seenAt: at, kind: "KOPIS 공연", rel: 1, extra: tag(db, "fcltynm") + (to ? " · " + to : "") }); } }
    }
  } catch (err3) { console.log("[ym-cron] kopis search: " + String(err3)); }
  return put(rows);
}
function promo() {
  var col = $app.findCollectionByNameOrId("ymdata"), rows = $app.findRecordsByFilter(col, "sheet = 'records'", "rowIndex", 50000, 0), pending = 0;
  for (var i = 0; i < rows.length; i++) if (text((rows[i].get("data") || {})["진행 상태"]).trim() === "신청 중") pending++;
  saveState("_promo_scan", { at: now(), pending: pending, notifications: "muted" });
  return pending;
}
function holdCancel() {
  var col = $app.findCollectionByNameOrId("ymdata"), rows = $app.findRecordsByFilter(col, "sheet = 'records'", "rowIndex", 50000, 0), changed = 0;
  for (var i = 0; i < rows.length; i++) { var d = rows[i].get("data") || {}; if (text(d["진행 상태"]).trim() !== "보류" || !text(d["재신청사유"]).trim()) continue; d["진행 상태"] = "취소"; d["취소사유"] = "재신청 후 다시 보류되어 자동 취소되었습니다."; rows[i].set("data", d); $app.save(rows[i]); changed++; }
  saveState("_hold_cancel", { at: now(), changed: changed });
  return changed;
}
function judgeRows(rows) {
  var candidates = [];
  for (var i = 0; i < rows.length; i++) if (rows[i].src !== "kopis" && rows[i].rel !== 0 && rows[i].rel !== 1) candidates.push({ id: rows[i].id, title: rows[i].title, link: rows[i].link, extra: rows[i].extra || "" });
  if (!candidates.length) return { rows: rows, count: 0, skipped: true };
  var sm = $os.getenv("SM_INTERNAL_URL"); if (!sm) throw new Error("SM_INTERNAL_URL missing");
  var cfg = proxy.proxyFetch({ url: sm.replace(/\/$/, "") + "/__api/llm/config", method: "GET", headers: { Accept: "application/json" } }), selected = (JSON.parse(cfg.text || "{}").selected_models || []), enabled = false;
  for (var si = 0; si < selected.length; si++) if (String(selected[si].registered_provider_id || selected[si].registeredProviderId) === OPUS.registeredProviderId && String(selected[si].model_id || selected[si].modelId) === OPUS.modelId) enabled = true;
  if (!enabled) throw new Error("Claude Opus 4.8 is not enabled in selected_models");
   var c = proxy.proxyFetch({ url: sm.replace(/\/$/, "") + "/__api/llm/completions", method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ target_model: { registered_provider_id: OPUS.registeredProviderId, model_id: OPUS.modelId }, messages: [{ role: "system", content: [{ type: "text", text: "한국어 검색 결과 분류기입니다. JSON 배열만 반환하세요." }] }, { role: "user", content: [{ type: "text", text: "각 항목을 {id,rel,why,kw}로 판정하세요. rel은 관련 1/무관 0입니다.\n" + JSON.stringify(candidates) }] }] }) });
  var raw = JSON.parse(c.text || "{}"), answer = raw.text || raw.answer || "[]", verdicts = JSON.parse(String(answer).replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()), by = {};
  for (var vi = 0; vi < verdicts.length; vi++) by[String(verdicts[vi].id)] = verdicts[vi];
  for (var ri = 0; ri < rows.length; ri++) if (by[String(rows[ri].id)]) { var v = by[String(rows[ri].id)]; rows[ri].rel = Number(v.rel) === 1 ? 1 : 0; rows[ri].relWhy = text(v.why); rows[ri].kw = text(v.kw); }
  return { rows: rows, count: verdicts.length, model: OPUS.modelId };
}
function judge() {
  var s = state("_monitor", { rows: [], last: null, judge: null }), result = judgeRows(s.rows || []);
  saveState("_monitor", { rows: result.rows, last: s.last, judge: { at: now(), count: result.count, model: result.model, skipped: result.skipped || false } });
  return result.count;
}
function fallbackRows(rows) {
  var count = 0, terms = /예울마루|GS칼텍스|공연|전시|장도|티켓|여수/i;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].src === "kopis" || rows[i].rel === 0 || rows[i].rel === 1) continue;
    var hay = text(rows[i].title) + " " + text(rows[i].extra);
    rows[i].rel = terms.test(hay) ? 1 : 0;
    rows[i].relWhy = "Opus bridge unavailable; deterministic fallback";
    rows[i].kw = rows[i].rel ? "예울마루" : "";
    count++;
  }
  return { rows: rows, count: count, model: "deterministic-fallback" };
}
module.exports = { scan: scan, promo: promo, holdCancel: holdCancel, judge: judge, judgeRows: judgeRows, fallbackRows: fallbackRows, state: state };
