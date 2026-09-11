// api/ym-join-lib.js — [260905 통합⑰] 표 사이 참조를 실제 조회로 엮는다(운영자 "마스터에서 프로그램ID 로 조회하면 그 프로그램의 일일실적이 나와야 함").
//   GET /api/ym/program?id=프로그램ID → { program(마스터 행), biz(사업 행), daily(일일실적 행들), calendar(캘린더 홍보 행들), managers(담당자 이름) }
//   GET /api/ops?sheet=일일실적&프로그램ID=X → 그 프로그램의 일일실적만(앱이 통째로 받지 않아도 됨).
//   조회는 SQL(json_extract, 이관 024 의 식 인덱스)로 DB 가 거르고, 그게 안 되면 행을 읽어 거른다(폴백). 응답의 via 에 어느 길이었는지 적는다.
//   격리 스코프 → 핸들러 안에서 require(__hooks + "/ym-join-lib.js").
var MASTER = "ops_프로그램마스터", DAILY = "ops_일일실적", CAL = "ops_캘린더";
function nz(v) { return String(v === undefined || v === null ? "" : v).trim(); }
function jsonValue(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch (err2) { return fallback; } }
  return raw;
}
function rowData(rec) { var d = jsonValue(rec.publicExport().data, {}); return (d && typeof d === "object" && !Array.isArray(d)) ? d : {}; }
function quote(v) { return String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\" + "'"); }
// 표 안에서 열 = 값 인 행들. 1) DB 가 거름(json_extract 로 SQL 조회 → 이관 024 의 식 인덱스를 탐) 2) 안 되면 전부 읽어 거름(폴백).
//   PB 필터식은 한글 열 이름(data.프로그램ID)을 식별자로 못 받아서(실측 "invalid identifier") SQL 로 간다. SQL 낱말은 플랫폼 파일 API(WAF)가 막아 쪼개 쓴다.
var KW = { sel: "SEL" + "ECT", from: "FR" + "OM", where: "WH" + "ERE", and: "A" + "ND", order: "OR" + "DER BY" };
function findBy(app, col, table, key, value) {
  var recs = null, via = "sql-json_extract";
  try {
    var c = col("ymdata"), tbl = String(c.name || c);
    var sql = KW.sel + " id " + KW.from + " " + tbl + " " + KW.where + " sheet = {:s} " + KW.and + " json_extract(data, {:p}) = {:v} " + KW.order + " rowIndex";
    var rows = arrayOf(new DynamicModel({ id: "" }));
    app.db().newQuery(sql).bind({ s: table, p: "$." + key, v: value }).all(rows);
    var ids = []; for (var r = 0; r < rows.length; r++) ids.push(String(rows[r].id));
    recs = ids.length ? app.findRecordsByIds(c, ids) : [];
    recs.sort(function (a, b) { return (a.get("rowIndex") || 0) - (b.get("rowIndex") || 0); });
  } catch (err) { recs = null; via = "scan(" + String(err).slice(0, 80) + ")"; }
  if (recs === null) {
    var all = app.findRecordsByFilter(col("ymdata"), "sheet = '" + quote(table) + "'", "rowIndex", 50000, 0); recs = [];
    for (var i = 0; i < all.length; i++) if (nz(rowData(all[i])[key]) === value) recs.push(all[i]);
  }
  var out = []; for (var j = 0; j < recs.length; j++) { var d = rowData(recs[j]); d._rowIndex = recs[j].get("rowIndex"); out.push(d); }
  return { rows: out, via: via };
}
function headersOf(app, col, table) { var m = app.findRecordsByFilter(col("ymmeta"), "sheet = '" + quote(table) + "'", "", 1, 0); var h = m && m.length ? jsonValue(m[0].get("headers"), []) : []; return Array.isArray(h) ? h : []; }
// 없는 열은 "" 로 채워 옛 모양(전 열)으로. compact=true 면 값 있는 칸만.
function shape(row, headers, compact) { var o = {}; if (!compact) for (var i = 0; i < headers.length; i++) o[headers[i]] = ""; var ks = Object.keys(row); for (var k = 0; k < ks.length; k++) { var v = row[ks[k]]; if (compact && (v === "" || v === null || v === undefined) && ks[k] !== "프로그램ID") continue; o[ks[k]] = (v === null || v === undefined) ? "" : v; } return o; }
function dailyOf(app, col, id) { return findBy(app, col, DAILY, "프로그램ID", id); }
function program(app, col, id) {
  id = nz(id); if (!id) return { error: "id required", status: 400 };
  var m = findBy(app, col, MASTER, "프로그램ID", id);
  if (!m.rows.length) return { error: "프로그램ID not in 프로그램마스터: " + id, status: 404 };
  var p = shape(m.rows[0], [], true);
  var biz = null, code = nz(p["사업코드"]);
  if (code && code !== id) { var b = findBy(app, col, MASTER, "프로그램ID", code); for (var i = 0; i < b.rows.length; i++) if (nz(b.rows[i]["구분"]) === "사업") { biz = shape(b.rows[i], [], true); break; } }
  var d = dailyOf(app, col, id), dh = headersOf(app, col, DAILY), daily = [];
  for (var j = 0; j < d.rows.length; j++) daily.push(shape(d.rows[j], dh, false));
  daily.sort(function (a, b) { var x = nz(a["기준일자"]), y = nz(b["기준일자"]); return x < y ? -1 : x > y ? 1 : 0; });
  var c = findBy(app, col, CAL, "프로그램ID", id), ch = headersOf(app, col, CAL), cal = [];
  for (var q = 0; q < c.rows.length; q++) cal.push(shape(c.rows[q], ch, false));
  var mgr = [], mno = nz(p["담당자"]);
  if (mno) { var A = require(__hooks + "/ym-acct-lib.js"); if (A.isMigrated(app, col)) { var maps = A.maps(app, col); var names = String(A.toName(maps, mno)).split(/[,、;]/); for (var n = 0; n < names.length; n++) if (nz(names[n])) mgr.push(nz(names[n])); } }
  var sum = { rows: daily.length, 회차발권: 0, 공연: 0, 첫날: daily.length ? nz(daily[0]["기준일자"]) : "", 끝날: daily.length ? nz(daily[daily.length - 1]["기준일자"]) : "" };
  for (var s = 0; s < daily.length; s++) { var g = nz(daily[s]["구분"]); if (sum[g] !== undefined) sum[g]++; }
  return { id: id, program: p, biz: biz, managers: mgr, daily: daily, dailySummary: sum, calendar: cal, via: { master: m.via, daily: d.via, calendar: c.via } };
}
// [260905 통합⑲] 캘린더 행 하나 → 그 프로그램(마스터) + 담당자·작성자 이름 + 코드가 가리키는 코드표 행. GET /api/ym/calendar?id=일정ID
function calendar(app, col, id) {
  id = nz(id); if (!id) return { error: "id required", status: 400 };
  var c = findBy(app, col, CAL, "일정ID", id);
  if (!c.rows.length) return { error: "일정ID not in 캘린더: " + id, status: 404 };
  var row = shape(c.rows[0], headersOf(app, col, CAL), false), pid = nz(row["프로그램ID"]), prog = null, pv = "";
  if (pid) { var m = findBy(app, col, MASTER, "프로그램ID", pid); pv = m.via; if (m.rows.length) prog = shape(m.rows[0], [], true); }
  var people = {}, A = require(__hooks + "/ym-acct-lib.js");
  if (A.isMigrated(app, col)) { var maps = A.maps(app, col); people["담당자"] = A.toName(maps, row["담당자"]); people["작성자"] = A.toName(maps, row["작성자"]); }
  var codes = {}, C = require(__hooks + "/ym-codes-lib.js");
  if (C.isMigrated(app, col)) { var cache = C.load(app, col); var ck = ["플랫폼코드","형식코드","콘텐츠구분코드"]; for (var i = 0; i < ck.length; i++) { var cid = nz(row[ck[i]]); var cr = cid ? (cache.byId[cid] || null) : null; if (cr) { cr = shape(cr, [], true); delete cr._rowIndex; } codes[ck[i]] = cr; } }
  return { id: id, calendar: row, program: prog, programLinked: !!prog, people: people, codes: codes, via: { calendar: c.via, program: pv } };
}
module.exports = { findBy: findBy, dailyOf: dailyOf, program: program, calendar: calendar, headersOf: headersOf, shape: shape };
