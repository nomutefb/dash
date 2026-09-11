// ym-ops-alias-lib.js — [260903 Phase4] 옛 운영 시트 이름 → 통합 시트 번역표 (임시 발판)
//   목적: 앱(standalone.html)이 옛 이름(공연마스터·전시마스터·회차상세·일일입력·전시일일)으로 읽고 써도
//         통합 시트(판매설정·회차·일일실적)에 반영되게 한다. 본체가 새 이름으로 다 옮겨가면 이 파일과
//         ym-db.pb.js 의 require 3줄·alias 분기를 지운다.
//   스위치: 통합 시트 ymmeta 행이 있고 source === "unified" 일 때만 켜진다(마이그레이션 마지막에 켠다).
//   Goja ES5 / CommonJS. $app 은 인자로 받는다.
var TABLE = {
  "공연마스터": { phys: "ops_판매설정", part: "공연", oldKey: "ops_공연마스터", cols: { "ID": "프로그램ID", "사업명": "명칭" }, dateCols: ["시작일", "종료일", "티켓오픈일"] },
  "전시마스터": { phys: "ops_판매설정", part: "전시", oldKey: "exhib_master",  cols: { "전시ID": "프로그램ID", "전시명": "명칭" }, dateCols: [] },
  "회차상세":   { phys: "ops_회차",     part: "공연", oldKey: "ops_회차상세",   cols: { "ID": "프로그램ID" }, dateCols: [] },
  "일일입력":   { phys: "ops_일일실적", part: "공연", oldKey: "ops_일일입력",   cols: { "공연ID": "프로그램ID", "공연명": "명칭", "유료좌석": "누계유료", "무료좌석": "누계무료", "합계좌석": "누계총인원", "합계금액": "누계금액" }, dateCols: ["기준일자"] },
  "전시일일":   { phys: "ops_일일실적", part: "전시", oldKey: "exhib_daily",   cols: { "전시ID": "프로그램ID", "전시명": "명칭" }, dateCols: ["기준일자"] }
};
// 값 표준화 스위치: true 면 공연 쪽 8자리 날짜(20261001)를 통합 시트에는 ISO(2026-10-01)로 저장하고, 옛 이름으로 읽을 땐 8자리로 돌려준다.
var ISO_DATES = true;
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
// 옛 어휘 ↔ 통합 어휘. 공연 옛 앱: 판매중/종료('' = 미정) · 전시 옛 앱: 예정/진행중/종료
function statusToOld(part, v) { v = String(v || "").trim(); if (part === "공연") return v === "진행중" ? "판매중" : v; if (part === "전시") return v === "판매중" ? "예정" : v; return v; }

function normalize(sh) {
  return String(sh || "").replace(/[()]/g, "").replace(/\s+/g, "").replace(/^ops_/, "").replace(/^운영_/, "");
}
function parseJson(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
  return raw;
}
function opsAlias(sh, app) {
  var key = normalize(sh);
  if (!Object.prototype.hasOwnProperty.call(TABLE, key)) return null;
  var t = TABLE[key];
  var mc = app.findCollectionByNameOrId("ymmeta");
  var found = app.findRecordsByFilter(mc, "sheet = '" + t.phys + "'", "", 1, 0);
  if (!found || !found.length) return null;
  if (String(found[0].get("source") || "") !== "unified") return null;   // 스위치 OFF
  var a = { name: key, phys: t.phys, part: t.part, oldKey: t.oldKey, meta: found[0], cols: t.cols, dateCols: t.dateCols || [], iso: ISO_DATES };
  var rev = {}, c;
  for (c in t.cols) if (Object.prototype.hasOwnProperty.call(t.cols, c)) rev[t.cols[c]] = c;
  a.toPhys = function (col) { return Object.prototype.hasOwnProperty.call(t.cols, col) ? t.cols[col] : col; };
  a.toOld = function (col) { return Object.prototype.hasOwnProperty.call(rev, col) ? rev[col] : col; };
  a.filter = "sheet = '" + t.phys + "' && data.구분 = '" + t.part + "'";
  a.isPart = function (d) { return !!d && String(d["구분"] === undefined || d["구분"] === null ? "" : d["구분"]).trim() === t.part; };
  a.valToPhys = function (col, v) {
    if (a.iso && a.dateCols.indexOf(col) >= 0) { var s = String(v === undefined || v === null ? "" : v).trim(); if (/^\d{8}$/.test(s)) return s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8); }
    return v;
  };
  a.valToOld = function (col, v) {
    if (a.iso && a.dateCols.indexOf(col) >= 0) { var s = String(v === undefined || v === null ? "" : v).trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/-/g, ""); }
    return v;
  };
  // 옛 열 이름 행 → 통합 열 이름 행 (+구분). 같은 통합 열로 두 옛 열이 오면 빈 값이 채워진 값을 덮지 않는다.
  a.rowToPhys = function (row) {
    var o = {}, ks = Object.keys(row || {});
    for (var i = 0; i < ks.length; i++) {
      var k = ks[i]; if (k === "구분") continue;
      var pk = a.toPhys(k), v = a.valToPhys(k, row[k]);
      if (o[pk] === undefined || o[pk] === null || o[pk] === "") o[pk] = v;
    }
    o["구분"] = t.part;
    if (t.phys === "ops_판매설정" && (o["상태"] !== undefined || (o["시작일"] !== undefined && o["종료일"] !== undefined))) {
      var ds = deriveStatus(o); o["상태"] = ds || String(o["상태"] || "").trim();   // [260903] 상태는 날짜 파생 한 체계로 저장
    }
    return o;
  };
  // 통합 행 → 옛 헤더 모양(전부 문자열)
  a.rowToOld = function (data, headers) {
    var o = {};
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i], v = data[a.toPhys(h)];
      v = (v === undefined || v === null) ? "" : String(v);
      if (h === "상태" && t.phys === "ops_판매설정") v = statusToOld(t.part, v);
      o[h] = String(a.valToOld(h, v));
    }
    return o;
  };
  // 옛 헤더 = 옛 ymmeta(동결 보관)의 headers. 없으면 통합 헤더를 옛 이름으로 되돌린 것(다른 구분 전용 열은 뺄 수 없으므로 최후 수단).
  a.oldHeaders = function () {
    var om = app.findRecordsByFilter(mc, "sheet = '" + t.oldKey + "'", "", 1, 0);
    var h = om && om.length ? parseJson(om[0].get("headers"), null) : null;
    if (Array.isArray(h) && h.length) return h.slice();
    var ph = parseJson(a.meta.get("headers"), []), out = [];
    if (Array.isArray(ph)) for (var i = 0; i < ph.length; i++) { if (ph[i] === "구분") continue; out.push(a.toOld(ph[i])); }
    return out;
  };
  // 같은 구분의 행만. DB JSON 필터를 먼저 쓰고, 0건이면 전체 스캔 + isPart 로 재확인(한글 키 필터 미지원 대비).
  a.findRows = function (col) {
    var recs = null;
    try { recs = app.findRecordsByFilter(col, a.filter, "rowIndex", 50000, 0); } catch (err) { recs = null; }
    if (recs && recs.length) return recs;
    var all = app.findRecordsByFilter(col, "sheet = '" + t.phys + "'", "rowIndex", 50000, 0), out = [];
    for (var i = 0; i < all.length; i++) { if (a.isPart(parseJson(all[i].publicExport().data, {}))) out.push(all[i]); }
    return out;
  };
  return a;
}
function isUnifiedKey(sheetKey) { return Object.prototype.hasOwnProperty.call(UNIFIED, sheetKey); }
// [260904 Phase4-3b] 통합 시트를 새 이름으로 직접 쓰되 구분(part) 한 칸만 다루는 유사 별칭 — 열 이름 번역 없음(항등). 앱 창구 YMDB.save 가 {sheet:'일일실적', part:'공연', rows} 로 부른다.
function partAlias(sheetKey, part, app) {
  if (!isUnifiedKey(sheetKey)) return null;
  part = String(part || "").trim(); if (!part) return null;
  var mc = app.findCollectionByNameOrId("ymmeta");
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

module.exports = { opsAlias: opsAlias, partAlias: partAlias, normalize: normalize, parseJson: parseJson, isUnifiedKey: isUnifiedKey, isFrozenMeta: isFrozenMeta, deriveStatus: deriveStatus, statusToOld: statusToOld, TABLE: TABLE };
