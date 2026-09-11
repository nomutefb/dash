// ym-ops-alias-lib.js — [260904 Phase4-4] 통합 운영 시트(판매설정·회차·일일실적) 보조 — 구분(part) 한 칸 쓰기 + 상태 파생.
//   (옛 시트 이름 번역표 opsAlias 는 260904 폐기 — 앱은 YMDB 창구로 통합 이름만 쓴다. 옛 물리 시트는 동결(source frozen→…) 보존.)
//   Goja ES5 / CommonJS. $app 은 인자로 받는다.
var UNIFIED = {"ops_판매설정":1,"ops_회차":1,"ops_일일실적":1};
// [260903 운영자] 상태 어휘 한 체계: 예정(시작 전·판매 전) · 판매중(시작 전·티켓 오픈) · 진행중(시작일≤오늘≤종료일) · 종료(종료일 지남). 날짜에서 파생.
function todayKst() { var d = new Date(Date.now() + 9 * 3600 * 1000); return d.toISOString().slice(0, 10); }
function isoDate(v) { var s = String(v === undefined || v === null ? "" : v).trim(); if (/^\d{8}$/.test(s)) return s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : ""; }
function deriveStatus(row) {
  var s = isoDate(row["시작일"]), e = isoDate(row["종료일"]) || s, t = isoDate(row["티켓오픈일"]), today = todayKst();
  if (!s) return "";
  if (today > e) return "종료";
  if (today >= s) return "진행중";
  return (t && t <= today) ? "판매중" : "예정";
}

function normalize(sh) {
  return String(sh || "").replace(/[()]/g, "").replace(/\s+/g, "").replace(/^ops_/, "").replace(/^운영_/, "");
}
function parseJson(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
  return raw;
}
function isUnifiedKey(sheetKey) { return Object.prototype.hasOwnProperty.call(UNIFIED, sheetKey); }
// [260904 Phase4-3b] 통합 시트를 새 이름으로 직접 쓰되 구분(part) 한 칸만 다루는 유사 별칭 — 열 이름 번역 없음(항등). 앱 창구 YMDB.save 가 {sheet:'일일실적', part:'공연', rows} 로 부른다.
function partAlias(sheetKey, part, app, metaCol) {   // [260904 발행관리] metaCol = 환경(dev/prod)에 맞는 ymmeta 컬렉션(ym-db.pb.js 의 __ymCol). 없으면 발행본
  if (!isUnifiedKey(sheetKey)) return null;
  part = String(part || "").trim(); if (!part) return null;
  var mc = metaCol || app.findCollectionByNameOrId("ymmeta");
  var found = app.findRecordsByFilter(mc, "sheet = '" + sheetKey + "'", "", 1, 0);
  if (!found || !found.length) return null;
  var a = { name: sheetKey, phys: sheetKey, part: part, oldKey: null, meta: found[0], cols: {}, dateCols: [], iso: false, direct: true };
  a.toPhys = function (col) { return col; };
  a.toOld = function (col) { return col; };
  a.filter = "sheet = '" + sheetKey + "' && data.구분 = '" + part + "'";
  a.isPart = function (d) { return !!d && String(d["구분"] === undefined || d["구분"] === null ? "" : d["구분"]).trim() === part; };
  a.rowToPhys = function (row) { var o = {}, ks = Object.keys(row || {}); for (var i = 0; i < ks.length; i++) o[ks[i]] = row[ks[i]]; o["구분"] = part; if (sheetKey === "ops_판매설정" && (o["상태"] !== undefined || (o["시작일"] !== undefined && o["종료일"] !== undefined))) { var ds = deriveStatus(o); o["상태"] = ds || String(o["상태"] || "").trim(); } return o; };
  a.rowToOld = function (data, headers) { var o = {}; for (var i = 0; i < headers.length; i++) { var v = data[headers[i]]; o[headers[i]] = (v === undefined || v === null) ? "" : String(v); } return o; };
  a.oldHeaders = function () { return parseJson(a.meta.get("headers"), []); };
  a.findRows = function (col) {
    var recs = null;
    try { recs = app.findRecordsByFilter(col, a.filter, "rowIndex", 50000, 0); } catch (err) { recs = null; }
    if (recs && recs.length) return recs;
    var all = app.findRecordsByFilter(col, "sheet = '" + sheetKey + "'", "rowIndex", 50000, 0), out = [];
    for (var i = 0; i < all.length; i++) { if (a.isPart(parseJson(all[i].publicExport().data, {}))) out.push(all[i]); }
    return out;
  };
  return a;
}
function isFrozenMeta(rec) { return String((rec && rec.get("source")) || "").indexOf("frozen") === 0; }

module.exports = { partAlias: partAlias, normalize: normalize, parseJson: parseJson, isUnifiedKey: isUnifiedKey, isFrozenMeta: isFrozenMeta, deriveStatus: deriveStatus };
