// api/ym-codes-lib.js — [260905 통합⑲] 코드표(ops_코드표) 한 행 = 코드 하나. 캘린더 홍보 행의 플랫폼·형식·콘텐츠구분을 코드로 색인한다.
//   운영자: "캘린더에 신청 가능한 플랫폼은 언제나 자유자재로 바뀔 수 있으니 캘린더 DB 의 인덱싱이 유동적으로 바뀔 수 있어야 함".
//   원칙(평의회3): 이름 칸(플랫폼1·플랫폼2·형식·콘텐츠구분)이 원본, 코드 칸(플랫폼코드·형식코드·콘텐츠구분코드)은 파생 색인.
//     - 쓰기 때 이름 → 코드(정규화 키로 찾음, 정확히 맞을 때만). 모르는 이름 = 코드 빈 칸(거부도 자동 추가도 안 함).
//     - 읽기 때 이름은 저장된 원문 그대로. 코드에서 이름을 만들어 내지 않는다.
//     - 코드ID 는 영구(재사용 금지, ymmeta _codeseq 순번). 코드 삭제 대신 사용여부=중지. 목록 화면은 순서 열로 정렬, 중지는 숨김.
//   코드표 열: 코드ID · 구분(목록: 플랫폼/콘텐츠구분/콘텐츠형식/진행상태/신청설정) · 값 · 세부 · 짧은이름 · 순서 · 사용여부 · 별칭 · 비고
var TABLE = "ops_코드표", SEQ = "_codeseq";
var HEADERS = ["코드ID","구분","값","세부","짧은이름","순서","사용여부","별칭","비고"];
var PREFIX = {"플랫폼":"PF","콘텐츠구분":"CG","콘텐츠형식":"CF","진행상태":"ST","신청설정":"AS"};
var LIST_ALIAS = {"platforms":"플랫폼","applysettings":"신청설정","contents":""};   // 옛 구분 이름이 오면 새 목록 이름으로(contents 는 목록 3개라 하나로 못 정함)
function listName(v) { var s = nz(v); if (PREFIX[s]) return s; if (LIST_ALIAS[s]) return LIST_ALIAS[s]; return ""; }
function nz(v) { return String(v === undefined || v === null ? "" : v).trim(); }
function jsonValue(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch (err2) { return fallback; } }
  return raw;
}
function rowData(rec) { var d = jsonValue(rec.publicExport().data, {}); return (d && typeof d === "object" && !Array.isArray(d)) ? d : {}; }
function metaOf(app, col, sheet) { var rows = app.findRecordsByFilter(col("ymmeta"), "sheet = '" + sheet + "'", "", 1, 0); return rows && rows.length ? rows[0] : null; }
function isMigrated(app, col) { var m = metaOf(app, col, TABLE); if (!m) return false; var h = jsonValue(m.get("headers"), []); return Array.isArray(h) && h.indexOf("사용여부") >= 0; }
// 매칭용 키: 앞뒤 공백 제거 → 연속 공백 1칸 → 영문 소문자 → 가운뎃점 종류 통일 → "-" 와 "" 는 같은 것(세부 없음)
function key(v) {
  var s = nz(v); if (s === "-" || s === "–" || s === "—") return "";
  try { if (typeof s.normalize === "function") s = s.normalize("NFC"); } catch (err) {}
  return s.replace(/\s+/g, " ").toLowerCase().replace(/[·ㆍ・•]/g, "·").replace(/\s*·\s*/g, "·").replace(/\s*\/\s*/g, "·");
}
// 표 읽기: { 구분 → [행…](순서순) , byId }
function load(app, col) {
  var recs = app.findRecordsByFilter(col("ymdata"), "sheet = '" + TABLE + "'", "rowIndex", 50000, 0), lists = {}, byId = {};
  for (var i = 0; i < recs.length; i++) { var d = rowData(recs[i]); d._rowIndex = recs[i].get("rowIndex"); var g = nz(d["구분"]); if (!lists[g]) lists[g] = []; lists[g].push(d); if (nz(d["코드ID"])) byId[nz(d["코드ID"])] = d; }
  var ks = Object.keys(lists);
  for (var k = 0; k < ks.length; k++) lists[ks[k]].sort(function (a, b) { var x = parseFloat(a["순서"]), y = parseFloat(b["순서"]); if (isNaN(x)) x = 1e9; if (isNaN(y)) y = 1e9; return x !== y ? x - y : (a._rowIndex - b._rowIndex); });
  return { lists: lists, byId: byId };
}
function active(rows) { var o = []; for (var i = 0; i < rows.length; i++) if (nz(rows[i]["사용여부"]) !== "중지") o.push(rows[i]); return o; }
// 이름 → 코드ID. 값(+세부) 이 정확히 맞는 행. 별칭(쉼표 구분)도 본다. 못 찾으면 "".
function codeOf(cache, list, value, detail) {
  var all = cache.lists[list] || [], kv = key(value), kd = key(detail);
  if (!kv) return "";
  var pools = [active(all), all];   // 사용 중인 코드 먼저, 없으면 중지된 것도(옛 행 색인용)
  for (var pi = 0; pi < pools.length; pi++) {
    var rows = pools[pi];
    for (var i = 0; i < rows.length; i++) { var r = rows[i]; if (key(r["값"]) === kv && key(r["세부"]) === kd) return nz(r["코드ID"]); }
    for (var j = 0; j < rows.length; j++) { var al = nz(rows[j]["별칭"]); if (!al) continue; var parts = al.split(","); for (var p = 0; p < parts.length; p++) if (key(parts[p]) === kv && key(rows[j]["세부"]) === kd) return nz(rows[j]["코드ID"]); }
    if (kd === "") { var cand = []; for (var q = 0; q < rows.length; q++) if (key(rows[q]["값"]) === kv) cand.push(nz(rows[q]["코드ID"])); if (cand.length === 1) return cand[0]; if (cand.length > 1) return ""; }   // 세부 없이 왔는데 값만 같은 행이 딱 하나면 그것, 여럿이면 못 정함
  }
  return "";
}
// 캘린더 홍보 행 하나의 코드 칸 채우기(이름 칸은 건드리지 않음). 돌려주는 값: 못 찾은 이름 목록
function stampCalendar(cache, d) {
  var miss = [];
  var pc = codeOf(cache, "플랫폼", d["플랫폼1"], d["플랫폼2"]); d["플랫폼코드"] = pc; if (!pc && nz(d["플랫폼1"])) miss.push("플랫폼:" + nz(d["플랫폼1"]) + "/" + nz(d["플랫폼2"]));
  var fc = codeOf(cache, "콘텐츠형식", d["형식"], ""); d["형식코드"] = fc; if (!fc && nz(d["형식"])) miss.push("형식:" + nz(d["형식"]));
  var gc = codeOf(cache, "콘텐츠구분", d["콘텐츠구분"], ""); d["콘텐츠구분코드"] = gc; if (!gc && nz(d["콘텐츠구분"])) miss.push("콘텐츠구분:" + nz(d["콘텐츠구분"]));
  return miss;
}
// 코드ID 발급: 접두어 + 3자리 순번(ymmeta _codeseq headers = {PF: n, …}). 한 번 쓴 번호는 다시 안 쓴다.
function nextId(app, col, list) {
  var ln = listName(list); if (!ln) throw new Error("코드표 목록 이름이 아님: " + nz(list) + " (플랫폼/콘텐츠구분/콘텐츠형식/진행상태/신청설정)");
  var pre = PREFIX[ln], mc = col("ymmeta"), rows = app.findRecordsByFilter(mc, "sheet = '" + SEQ + "'", "", 1, 0), rec, seq;
  if (rows && rows.length) { rec = rows[0]; seq = jsonValue(rec.get("headers"), {}); if (!seq || typeof seq !== "object" || Array.isArray(seq)) seq = {}; }
  else { rec = new Record(mc, { sheet: SEQ, headers: {}, source: "codeseq", rowCount: 0, nextRowIndex: 0 }); seq = {}; }
  var n = parseInt(seq[pre], 10); if (!(n >= 0)) n = 0;
  // 표에 이미 있는 가장 큰 번호보다 작으면 거기서 이어간다(순번 기록이 비어 있어도 재사용 안 되게)
  var recs = app.findRecordsByFilter(col("ymdata"), "sheet = '" + TABLE + "'", "", 50000, 0);
  for (var i = 0; i < recs.length; i++) { var id = nz(rowData(recs[i])["코드ID"]); if (id.indexOf(pre) === 0) { var m = parseInt(id.slice(pre.length), 10); if (m > n) n = m; } }
  n += 1; seq[pre] = n; rec.set("headers", seq); app.save(rec);
  return pre + (n < 10 ? "00" + n : n < 100 ? "0" + n : String(n));
}
// 새 코드 행 채우기(코드ID 없으면 발급, 순서 없으면 목록 끝, 사용여부 없으면 사용)
function stampCode(app, col, d) {
  var ln = listName(d["구분"]); if (!ln) throw new Error("코드표 목록 이름이 아님: " + nz(d["구분"])); d["구분"] = ln;
  if (!nz(d["코드ID"])) d["코드ID"] = nextId(app, col, d["구분"]);
  if (!nz(d["사용여부"])) d["사용여부"] = "사용";
  if (!nz(d["순서"])) { var c = load(app, col), rows = c.lists[nz(d["구분"])] || [], mx = 0; for (var i = 0; i < rows.length; i++) { var o = parseFloat(rows[i]["순서"]); if (o > mx) mx = o; } d["순서"] = String(mx + 10); }
  return d;
}
// 캘린더 홍보 행 전부 다시 색인(코드표가 바뀐 뒤 부르는 입구). 이름 칸은 그대로.
function reindexCalendar(app, col) {
  var cache = load(app, col), recs = app.findRecordsByFilter(col("ymdata"), "sheet = 'ops_캘린더'", "rowIndex", 50000, 0), touched = 0, rows = 0, missing = {};
  for (var i = 0; i < recs.length; i++) {
    var d = rowData(recs[i]); if (nz(d["구분"]) !== "홍보") continue; rows++;
    var before = nz(d["플랫폼코드"]) + "|" + nz(d["형식코드"]) + "|" + nz(d["콘텐츠구분코드"]) + "|" + nz(d["프로그램홍보"]);
    var miss = stampCalendar(cache, d); for (var m = 0; m < miss.length; m++) missing[miss[m]] = (missing[miss[m]] || 0) + 1;
    d["프로그램홍보"] = nz(d["프로그램ID"]) ? "Y" : "N";   // [통합⑳] 프로그램 홍보 표시
    var after = nz(d["플랫폼코드"]) + "|" + nz(d["형식코드"]) + "|" + nz(d["콘텐츠구분코드"]) + "|" + nz(d["프로그램홍보"]);
    if (before !== after) { recs[i].set("data", d); app.save(recs[i]); touched++; }
  }
  return { rows: rows, touched: touched, missing: missing };
}
// 신청설정 목록의 설정값(값=키, 세부=설정값). 없으면 ""
function setting(cache, k) { var rows = cache.lists["신청설정"] || []; for (var i = 0; i < rows.length; i++) if (nz(rows[i]["값"]) === k && nz(rows[i]["사용여부"]) !== "중지") return nz(rows[i]["세부"]); return ""; }
module.exports = { setting: setting, listName: listName, TABLE: TABLE, HEADERS: HEADERS, PREFIX: PREFIX, key: key, load: load, active: active, codeOf: codeOf, stampCalendar: stampCalendar, nextId: nextId, stampCode: stampCode, reindexCalendar: reindexCalendar, isMigrated: isMigrated };
