// api/ym-records-lib.js — [260905 통합⑬] 홍보 신청(records 시트) → ops_캘린더 구분='홍보' 행 창구(번역표).
//   캘린더 표 하나에 홍보 일정(구분=홍보)과 직원 일정(구분=특이일정)을 같이 둔다. 앱은 /api/records 를 옛 28열 모양으로 그대로 쓴다.
//   날짜 = 시작일(YYYYMMDD) 한 칸만 저장하고 연도·월·일·요일·"YYYY-MM-DD 00:00:00" 은 읽을 때 만든다(옛 시트는 전부 00:00:00, 요일도 날짜와 일치 — 260905 실측).
//   사람 칸(신청자→작성자, 게시 담당자→담당자)은 계정NO 로 저장(ym-acct-lib 규칙). 일정ID = "PR" + 4자리(표 rowIndex).
//   isMigrated(=ops_캘린더 목록에 상태변경시각 열이 있음)가 false 인 환경(발행본)은 옛 경로 그대로. 격리 스코프 → 핸들러 안에서 require.
var TABLE = "ops_캘린더";
var PART_COL = "구분";
var PART = "홍보";
var MARK = "상태변경시각";
// [옛 records 열, 표 열] — 옛 헤더 28개 순서 그대로. 표 열이 null 이면 읽을 때 만드는 파생 열.
var MAP = [["No","순번"],["입력시간(KST)","입력시간"],["날짜","시작일"],["연도",null],["월",null],["일",null],["요일",null],["플랫폼 1","플랫폼1"],["플랫폼 2","플랫폼2"],["콘텐츠 구분","콘텐츠구분"],["프로그램","프로그램"],["담당 부서","담당부서"],["콘텐츠 제목","제목"],["콘텐츠 형식","형식"],["콘텐츠 내용","내용"],["게시 담당자","담당자"],["진행 상태","상태"],["비고","비고"],["신청자","작성자"],["결과_링크","결과링크"],["결과_첨부URL","결과첨부URL"],["결과_비고","결과비고"],["직전 상태","직전상태"],["상태 변경 KST","상태변경시각"],["보류사유","보류사유"],["재신청사유","재신청사유"],["취소사유","취소사유"],["프로그램ID","프로그램ID"]];
var HEADERS = MAP.map(function (m) { return m[0]; });
var NEW_TABLE_COLS = ["프로그램ID","플랫폼1","플랫폼2","콘텐츠구분","프로그램","담당부서","제목","형식","상태","결과링크","결과첨부URL","결과비고","직전상태","상태변경시각","보류사유","재신청사유","취소사유"];
var PEOPLE = ["담당자","작성자"];
var DN = ["일","월","화","수","목","금","토"];
function nz(v) { return String(v === undefined || v === null ? "" : v).trim(); }
function jsonValue(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch (err2) { return fallback; } }
  return raw;
}
function pad(n, w) { var s = String(n); while (s.length < w) s = "0" + s; return s; }
function toD8(v) {
  var s = nz(v); if (!s) return "";
  var m = s.match(/^(\d{4})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})/) || s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return m[1] + pad(m[2], 2) + pad(m[3], 2);
  var n = Number(s);
  if (/^\d{5}$/.test(s) && n > 20000 && n < 80000) { var d = new Date(Math.round((n - 25569) * 86400000)); return d.getUTCFullYear() + pad(d.getUTCMonth() + 1, 2) + pad(d.getUTCDate(), 2); }
  return s;   // 못 읽는 값은 그대로(유실 0)
}
function metaOf(app, col, sheet) { var rows = app.findRecordsByFilter(col("ymmeta"), "sheet = '" + sheet + "'", "", 1, 0); return rows && rows.length ? rows[0] : null; }
function headersOf(meta) { var h = jsonValue(meta ? meta.get("headers") : [], []); return Array.isArray(h) ? h : []; }
function isMigrated(app, col) { var m = metaOf(app, col, TABLE); return !!m && headersOf(m).indexOf(MARK) >= 0; }
function rowData(rec) { var d = jsonValue(rec.publicExport().data, {}); return (d && typeof d === "object" && !Array.isArray(d)) ? d : {}; }
// 계정NO ↔ 이름 (ym-acct-lib 과 같은 규칙)
var NO_RE = /^\d{3,}$/;
function acctMaps(app, col) {
  var m = { on: false, byNo: {}, byName: {} };
  var mm = metaOf(app, col, "managers"); if (!mm || headersOf(mm).indexOf("계정NO") < 0) return m;
  m.on = true;
  var recs = app.findRecordsByFilter(col("ymdata"), "sheet = 'managers'", "rowIndex", 50000, 0);
  for (var i = 0; i < recs.length; i++) { var d = rowData(recs[i]); var no = nz(d["계정NO"]), name = nz(d["담당자"]); if (no && name) { m.byNo[no] = name; if (!m.byName[name]) m.byName[name] = no; } }
  return m;
}
function acctName(m, v) { var raw = (v === undefined || v === null) ? "" : String(v); if (!m.on) return raw; var s = nz(raw); if (!s || !NO_RE.test(s)) return raw; return Object.prototype.hasOwnProperty.call(m.byNo, s) ? m.byNo[s] : raw; }
function acctNo(m, v) { var raw = (v === undefined || v === null) ? "" : String(v); if (!m.on) return raw; var s = nz(raw); if (!s) return ""; if (NO_RE.test(s)) return s; return Object.prototype.hasOwnProperty.call(m.byName, s) ? m.byName[s] : raw; }
// 표 행 → 옛 28열 행(파생 열 포함)
function toView(d, am) {
  var o = {}, d8 = nz(d["시작일"]), iso = /^\d{8}$/.test(d8) ? d8.slice(0, 4) + "-" + d8.slice(4, 6) + "-" + d8.slice(6, 8) : d8;
  var dt = /^\d{8}$/.test(d8) ? new Date(+d8.slice(0, 4), +d8.slice(4, 6) - 1, +d8.slice(6, 8)) : null;
  for (var i = 0; i < MAP.length; i++) {
    var k = MAP[i][0], t = MAP[i][1], v;
    if (k === "날짜") v = iso ? iso + " 00:00:00" : "";
    else if (k === "연도") v = dt ? String(dt.getFullYear()) : "";
    else if (k === "월") v = dt ? String(dt.getMonth() + 1) : "";
    else if (k === "일") v = dt ? String(dt.getDate()) : "";
    else if (k === "요일") v = dt ? DN[dt.getDay()] + "요일" : "";
    else { v = d[t]; v = (v === undefined || v === null) ? "" : String(v); if (PEOPLE.indexOf(t) >= 0 && am) v = acctName(am, v); }
    o[k] = v;
  }
  o["공연ID"] = o["프로그램ID"];   // 앱은 r['공연ID'] 로 읽는다(옛 이름 별칭) — [통합⑬] (260905 저녁 서버본 덮어쓰기로 빠졌던 것 복구)
  return o;
}
function partRecs(app, col) { var recs = app.findRecordsByFilter(col("ymdata"), "sheet = '" + TABLE + "'", "rowIndex", 50000, 0), out = []; for (var i = 0; i < recs.length; i++) { var d = rowData(recs[i]); if (nz(d[PART_COL]) === PART) out.push({ rec: recs[i], d: d }); } return out; }
function list(app, col) {
  var ps = partRecs(app, col), am = acctMaps(app, col), out = [];
  for (var i = 0; i < ps.length; i++) { var row = toView(ps[i].d, am); row._rowIndex = ps[i].rec.get("rowIndex"); out.push(row); }
  return out;
}
// 옛 이름 객체(values 배열은 HEADERS 순서) → 표 열 객체. 파생 열(연도·월·일·요일)은 버리고, 날짜 → 시작일=종료일(YYYYMMDD), 사람은 계정NO.
function toTable(app, col, obj) {
  var am = acctMaps(app, col), out = {}, idx = {}; for (var i = 0; i < MAP.length; i++) idx[MAP[i][0]] = MAP[i][1];
  var ks = Object.keys(obj || {});
  for (var j = 0; j < ks.length; j++) {
    var k = ks[j], t = idx[k]; if (t === undefined || t === null) continue;
    var v = obj[k]; v = (v === undefined || v === null) ? "" : v;
    if (k === "날짜") { var d8 = toD8(v); out["시작일"] = d8; out["종료일"] = d8; continue; }
    if (PEOPLE.indexOf(t) >= 0) v = acctNo(am, v);
    out[t] = v;
  }
  return out;
}
function fromBody(body) {
  var vals = {}, values = body && body.values, i;
  if (Array.isArray(values)) { for (i = 0; i < HEADERS.length; i++) vals[HEADERS[i]] = i < values.length ? values[i] : ""; }
  else if (values && typeof values === "object") { var vk = Object.keys(values); for (i = 0; i < vk.length; i++) vals[vk[i]] = values[vk[i]]; }
  var ek = Object.keys(body || {}); for (i = 0; i < ek.length; i++) { var k = ek[i]; if (k === "values" || k === "headers") continue; if (k === "공연ID") { vals["프로그램ID"] = body[k]; continue; } vals[k] = body[k]; }
  return vals;
}
function touchLastmod(app, col) { var rows = app.findRecordsByFilter(col("ymmeta"), "sheet = '_lastmod'", "", 1, 0); if (rows && rows.length) { rows[0].set("source", new Date().toISOString()); app.save(rows[0]); } }
// [260905 통합⑲] 홍보 행은 프로그램ID 로 마스터를 가리켜야 한다(운영자 "캘린더 > 프로그램ID > 프로그램 연결"). 새 신청은 필수, 수정은 값이 있으면 마스터에 있어야.
// [260905 통합⑳] 프로그램 홍보인지(프로그램 칸이 실제 프로그램 이름) 아닌지('기타'·빈 값 = 월간 일정·채용 공고 같은 일반 홍보)에 따라 프로그램ID 를 요구한다(운영자 "프로그램 홍보 여부에 따라 참조하냐 마냐가 결정").
function isProgramPromo(d) { var p = nz(d["프로그램"]); return !!p && p !== "기타"; }
function promoFlag(d) { d["프로그램홍보"] = nz(d["프로그램ID"]) ? "Y" : "N"; return d; }
function programCheck(app, col, d, required) {
  var id = nz(d["프로그램ID"]);
  if (!id) {
    if (!required) return null;
    var C = require(__hooks + "/ym-codes-lib.js"), force = C.isMigrated(app, col) && /^(TRUE|1|Y|예)$/i.test(C.setting(C.load(app, col), "홍보_프로그램ID_필수"));
    if (force) return "프로그램ID required (신청설정 홍보_프로그램ID_필수=TRUE)";
    if (isProgramPromo(d)) return "프로그램ID required (프로그램 홍보 '" + nz(d["프로그램"]) + "' 는 프로그램마스터의 프로그램을 가리켜야 함; 프로그램이 없는 일반 홍보면 프로그램 칸을 '기타' 로)";
    return null;
  }
  var f = require(__hooks + "/ym-join-lib.js").findBy(app, col, "ops_프로그램마스터", "프로그램ID", id);
  return f.rows.length ? null : "프로그램ID not in 프로그램마스터: " + id;
}
// [통합⑲] 이름 칸(플랫폼1·플랫폼2·형식·콘텐츠구분) → 코드 칸(플랫폼코드·형식코드·콘텐츠구분코드). 이름은 그대로, 모르는 이름은 코드 빈 칸.
function codeStamp(app, col, d) { var C = require(__hooks + "/ym-codes-lib.js"); if (!C.isMigrated(app, col)) return; C.stampCalendar(C.load(app, col), d); }
function create(app, col, body) {
  var meta = metaOf(app, col, TABLE); if (!meta) return { error: "표 없음: " + TABLE, status: 500 };
  var hs = headersOf(meta), d = {}; for (var i = 0; i < hs.length; i++) d[hs[i]] = "";
  var p = toTable(app, col, fromBody(body)); var pk = Object.keys(p); for (var j = 0; j < pk.length; j++) d[pk[j]] = p[pk[j]];
  var pe = programCheck(app, col, d, true); if (pe) return { error: pe, status: 409 };
  codeStamp(app, col, d); promoFlag(d);
  var nri = meta.get("nextRowIndex") || 2;
  d[PART_COL] = PART; d["일정ID"] = "PR" + pad(nri, 4);
  app.save(new Record(col("ymdata"), { sheet: TABLE, rowIndex: nri, data: d }));
  meta.set("rowCount", (meta.get("rowCount") || 0) + 1); meta.set("nextRowIndex", nri + 1); app.save(meta);
  touchLastmod(app, col);
  return { ok: true, rowIndex: nri };
}
function findRow(app, col, rowIdx) {
  var n = parseInt(rowIdx, 10); if (!(n > 0)) return null;
  var recs = app.findRecordsByFilter(col("ymdata"), "sheet = '" + TABLE + "' && rowIndex = " + n, "", 1, 0);
  if (!(recs && recs.length)) return null;
  return nz(rowData(recs[0])[PART_COL]) === PART ? recs[0] : null;
}
// 옛 patchRecords 는 행 전체 교체(28열 다 보냄). 같은 뜻: 옛 열에 대응하는 표 열은 전부 덮고, 식별 열(일정ID·구분)은 지킨다.
function patch(app, col, rowIdx, body) {
  var rec = findRow(app, col, rowIdx); if (!rec) return null;
  var d = rowData(rec), p = toTable(app, col, fromBody(body)), pk = Object.keys(p);
  for (var i = 0; i < pk.length; i++) d[pk[i]] = p[pk[i]];
  var pe = Object.prototype.hasOwnProperty.call(p, "프로그램ID") ? programCheck(app, col, d, false) : null; if (pe) return { error: pe, status: 409 };   // [통합⑲] 이번에 프로그램ID 를 보냈을 때만 검사(옛 행 상태 변경은 막지 않음)
  codeStamp(app, col, d); promoFlag(d);
  d[PART_COL] = PART; if (!nz(d["일정ID"])) d["일정ID"] = "PR" + pad(rec.get("rowIndex"), 4);
  rec.set("data", d); app.save(rec); touchLastmod(app, col);
  return { ok: true };
}
function remove(app, col, rowIdx) {
  var rec = findRow(app, col, rowIdx); if (!rec) return null;
  app.delete(rec);
  var meta = metaOf(app, col, TABLE); if (meta) { meta.set("rowCount", Math.max(0, (meta.get("rowCount") || 0) - 1)); app.save(meta); }
  touchLastmod(app, col);
  return { ok: true };
}
module.exports = { isProgramPromo: isProgramPromo, promoFlag: promoFlag, programCheck: programCheck, TABLE: TABLE, PART: PART, MARK: MARK, MAP: MAP, HEADERS: HEADERS, NEW_TABLE_COLS: NEW_TABLE_COLS, toD8: toD8, isMigrated: isMigrated, list: list, create: create, patch: patch, remove: remove, toTable: toTable, fromBody: fromBody };
