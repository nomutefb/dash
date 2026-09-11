// ym-db.pb.js — MISO DB 직결 REST bridge
// Reads/writes ymdata + ymmeta collections in PocketBase. Implements the
// response contract from MISO_DB이관_2단계.md §2.
//
// Goja rules: ES5, no async/await, no import/export, no top-level statements
// outside the registered hooks. _runtime_proxy.js is loaded on demand by hooks
// that need outbound HTTP — we don't need it here.
//
// $app, $apis, $os, $security, $filesystem are PB globals.
//
// Conventions:
//   - "row" is the JSON object the front-end receives: Object.assign({}, r.data, { _rowIndex: r.rowIndex })
//   - "ops rows" are returned WITHOUT _rowIndex (per spec §2-2: /api/ops rows).
//   - All writes bump a `lastmod` (collection "ymmeta" row sheet='_lastmod' field value=ISO).
//   - Headers list lives in ymmeta.headers (json array).
//   - 1-C: writes to unknown sheets auto-create the ymmeta row.
//   - 1-D: holidays are stored in ymmeta as { year, days, cachedAt } objects.

function nowIso() {
  return new Date().toISOString();
}

function asString(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  try { return JSON.stringify(v); } catch (e) { return String(v); }
}

function jsonOk(body, status) {
  if (status === undefined) status = 200;
  return e.json(status, body); // not available here; we use e.json
}
function jsonErr(message, status) {
  if (status === undefined) status = 400;
  return e.json(status, { error: message });
}

// ===== [260904 발행관리] 개발(dev) / 발행(prod) 컬렉션 분리 =====
//   각 라우트 핸들러 첫 줄의 __env/__col 이 실제 판정(핸들러는 격리 스코프라 여기 파일 스코프 함수를 못 본다).
//   아래 파일 스코프 __col 은 핸들러 밖 옛 헬퍼가 호출될 때만 쓰이는 안전망(발행본 = 종전 동작).
var __col = function (n) { return $app.findCollectionByNameOrId(String(n)); };

// --- helpers using the PocketBase 0.31 app API ---

function findCollectionByName(name) {
  return $app.findCollectionByNameOrId(name);
}

function listAll(collection, filter) {
  return $app.findRecordsByFilter(collection, filter || "", "", 50000, 0);
}

function quoteFilterValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function findRecordByRowIndex(collection, sheet, rowIndex) {
  var filter = "sheet = '" + quoteFilterValue(sheet) + "' && rowIndex = " + Number(rowIndex);
  var recs = $app.findRecordsByFilter(collection, filter, "", 1, 0);
  return recs && recs.length ? recs[0] : null;
}

function findRecordByDataId(collection, sheet, idValue) {
  // For /api/messages — match data.id field
  var filter = "sheet = '" + quoteFilterValue(sheet) + "' && [data.id] = '" + quoteFilterValue(idValue) + "'";
  var recs = $app.findRecordsByFilter(collection, filter, "", 1, 0);
  return recs && recs.length ? recs[0] : null;
}

function readSheetRows(sheet, includeRowIndex) {
  var col = __col("ymdata");
  var recs = $app.findRecordsByFilter(col, "sheet = '" + quoteFilterValue(sheet) + "'", "rowIndex", 50000, 0);
  var out = [];
  for (var i = 0; i < recs.length; i++) {
    var r = recs[i];
    var exported = r.publicExport();
    var data = exported.data || {};
    var dataObj = {};
    // data is already a map (json field). Iterate and copy.
    var keys = Object.keys(data);
    for (var k = 0; k < keys.length; k++) {
      dataObj[keys[k]] = data[keys[k]];
    }
    if (includeRowIndex === true) {
      dataObj._rowIndex = r.get("rowIndex");
    }
    var hasValue = false;
    var dataKeys = Object.keys(dataObj);
    for (var dk = 0; dk < dataKeys.length; dk++) {
      var value = dataObj[dataKeys[dk]];
      if (value !== null && value !== undefined && String(value).trim() !== "") {
        hasValue = true;
        break;
      }
    }
    if (hasValue) out.push(dataObj);
  }
  return out;
}

function ymmetaGet(sheet) {
  var col = __col("ymmeta");
  var recs = $app.findRecordsByFilter(col, "sheet = '" + quoteFilterValue(sheet) + "'", "", 1, 0);
  return recs && recs.length ? recs[0] : null;
}

function ymmetaUpsert(sheet, headers, source, rowCount, nextRowIndex) {
  var col = __col("ymmeta");
  var existing = ymmetaGet(sheet);
  var rec;
  if (existing) {
    if (headers !== undefined) existing.set("headers", headers);
    if (source !== undefined) existing.set("source", source);
    if (rowCount !== undefined) existing.set("rowCount", rowCount);
    if (nextRowIndex !== undefined) existing.set("nextRowIndex", nextRowIndex);
    $app.save(existing);
    rec = existing;
  } else {
    rec = new Record(col, {
      sheet: sheet,
      headers: headers !== undefined ? headers : [],
      source: source !== undefined ? source : "",
      rowCount: rowCount !== undefined ? rowCount : 0,
      nextRowIndex: nextRowIndex !== undefined ? nextRowIndex : 1
    });
    $app.save(rec);
  }
  return rec;
}

function bumpLastmod() {
  // 2-3: writes must bump /api/lastmod
  ymmetaUpsert("_lastmod", undefined, "", 0, 0);
  var rec = ymmetaGet("_lastmod");
  if (rec) {
    rec.set("source", nowIso()); // we use 'source' field to carry the ISO timestamp
    $app.save(rec);
  }
}

function slugToSheet(slug) {
  var map = {
    platform: "platforms",
    content: "contents",
    manager: "managers",
    program: "programs",
    special: "special",
    applysettings: "applysettings",
    log: "logs"
  };
  return map[slug] || slug;
}

function opsSheetToKey(sh) {
  var map = {"전시일일":"exhib_daily","전시마스터":"exhib_master"};
  return map[sh] || ("ops_" + sh);
}

function valuesToData(headers, values) {
  var data = {};
  if (Array.isArray(values)) {
    for (var i = 0; i < headers.length; i++) {
      data[headers[i]] = i < values.length ? values[i] : "";
    }
  } else if (values && typeof values === "object") {
    // already an object
    var keys = Object.keys(values);
    for (var j = 0; j < keys.length; j++) data[keys[j]] = values[keys[j]];
  }
  return data;
}

function dataToValues(headers, data) {
  var out = [];
  for (var i = 0; i < headers.length; i++) {
    out.push(data[headers[i]] !== undefined ? data[headers[i]] : "");
  }
  return out;
}

function readBody(e) {
  // e.requestInfo().body may be a string or undefined
  try {
    var info = e.requestInfo();
    var b = info && info.body;
    if (!b) return {};
    if (typeof b === "string") {
      try { return JSON.parse(b); } catch (err) { return {}; }
    }
    return b;
  } catch (err) {
    return {};
  }
}

function listSheetsStartingWithOps() {
  var col = __col("ymmeta");
  var recs = $app.findRecordsByFilter(col, "sheet ~ '^ops_'", "", 50000, 0);
  var out = [];
  for (var i = 0; i < recs.length; i++) {
    if (String(recs[i].get("source") || "").indexOf("frozen") === 0) continue;   // [Phase4] 동결 옛 시트 숨김
    var k = recs[i].get("sheet");
    out.push({ name: "운영_" + k.slice(4) });
  }
  return out;
}

function loadHolidaysObject() {
  // returns { "2026": {year, days, cachedAt}, "2027": {year, days, cachedAt}, ... }
  // stored in ymmeta with sheet='_holidays'
  var rec = ymmetaGet("_holidays");
  if (!rec) return {};
  var h = rec.get("headers");
  if (!h || typeof h !== "object") return {};
  // h is { year:2026, days:[{date,name},...], cachedAt:"..." } — read keys
  var out = {};
  var years = Object.keys(h);
  for (var i = 0; i < years.length; i++) {
    var y = years[i];
    out[y] = h[y];
  }
  return out;
}

function saveHolidaysObject(obj) {
  var col = __col("ymmeta");
  var rec = ymmetaGet("_holidays");
  if (rec) {
    rec.set("headers", obj);
    $app.save(rec);
  } else {
    var nr = new Record(col, {
      sheet: "_holidays",
      headers: obj,
      source: "embedded",
      rowCount: Object.keys(obj).length,
      nextRowIndex: Object.keys(obj).length + 1
    });
    $app.save(nr);
  }
}

function shapeHolidaysObject() {
  // 1-D: re-shape the misformed 1단계 data into { year: { year, days, cachedAt } }
  // Read all "_holidays/YYYY" rows, fold into a single object.
  var col = __col("ymmeta");
  var recs = $app.findRecordsByFilter(col, "sheet ~ '^_holidays/'", "", 50000, 0);
  var out = {};
  for (var i = 0; i < recs.length; i++) {
    var r = recs[i];
    var sheet = r.get("sheet"); // "_holidays/2026"
    var year = sheet.split("/")[1];
    var arr = r.get("headers"); // array of {date, name} or legacy {date:'year',name:2026,date:'days',name:[...]}
    var days = [];
    var cachedAt = r.get("source") || "";
    if (Array.isArray(arr)) {
      // detect legacy: items[0].date === 'year'
      if (arr.length > 0 && arr[0] && arr[0].date === "year") {
        // legacy shape — locate 'days' item
        for (var k = 0; k < arr.length; k++) {
          if (arr[k].date === "days" && Array.isArray(arr[k].name)) {
            days = arr[k].name;
          } else if (arr[k].date === "cachedAt") {
            cachedAt = arr[k].name;
          }
        }
      } else {
        for (var kk = 0; kk < arr.length; kk++) {
          if (arr[kk] && arr[kk].date) {
            days.push({ date: arr[kk].date, name: arr[kk].name || "" });
          }
        }
      }
    }
    out[year] = { year: parseInt(year, 10), days: days, cachedAt: cachedAt };
  }
  return out;
}

// --- route handlers ---

function getRecords(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  function jsonValue(raw, fallback) {
    if (raw === null || raw === undefined) return fallback;
    try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
    return raw;
  }
  var metaCol = __col("ymmeta");
  var metaRows = $app.findRecordsByFilter(metaCol, "sheet = 'records'", "", 1, 0);
  var headers = metaRows.length ? jsonValue(metaRows[0].get("headers"), []) : [];
  {   // [260905 통합⑬] 홍보 신청은 ops_캘린더 구분=홍보 행 — 창구로 답한다(옛 28열 + _rowIndex)
    var __R = require(__hooks + "/ym-records-lib.js");
    if (__R.isMigrated($app, __col)) return e.json(200, { records: __R.list($app, __col) });
  }
  var col = __col("ymdata");
  var records = $app.findRecordsByFilter(col, "sheet = 'records'", "rowIndex", 50000, 0);
  var rows = [];
  for (var i = 0; i < records.length; i++) {
    var exported = records[i].publicExport();
    var data = jsonValue(exported.data, {});
    var row = {};
    for (var k = 0; k < headers.length; k++) row[headers[k]] = data[headers[k]] === undefined || data[headers[k]] === null ? "" : String(data[headers[k]]);
    row._rowIndex = records[i].get("rowIndex");
    rows.push(row);
  }
  {   // [260905 통합⑧⑩] 신청자·게시 담당자 계정NO → 이름 · 프로그램ID 를 공연ID 이름으로도(앱은 아직 공연ID 로 읽음)
    var __A = require(__hooks + "/ym-acct-lib.js");
    var __hs = Array.isArray(headers) ? headers : [];
    var __on = __A.isMigrated($app, __col), __am = __on ? __A.maps($app, __col) : null, __pid = __hs.indexOf("프로그램ID") >= 0 && __hs.indexOf("공연ID") < 0;
    for (var __ri = 0; __ri < rows.length; __ri++) { if (__on) __A.namesOut(__am, rows[__ri], ["신청자", "게시 담당자"]); if (__pid) rows[__ri]["공연ID"] = rows[__ri]["프로그램ID"]; }
  }
  return e.json(200, { records: rows });
}

function getPrograms(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  {   // [260904 통합①] programs 시트가 프로그램마스터로 합쳐진 환경이면 마스터 창구로 답한다(앱 무수정)
    var __L = require(__hooks + "/ym-programs-lib.js");
    if (__L.isMigrated($app, __col)) return e.json(200, { programs: __L.list($app, __col, false) });
  }
  function jsonValue(raw, fallback) {
    if (raw === null || raw === undefined) return fallback;
    try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
    return raw;
  }
  var metaCol = __col("ymmeta");
  var metaRows = $app.findRecordsByFilter(metaCol, "sheet = 'programs'", "", 1, 0);
  var headers = metaRows.length ? jsonValue(metaRows[0].get("headers"), []) : [];
  var col = __col("ymdata");
  var records = $app.findRecordsByFilter(col, "sheet = 'programs'", "rowIndex", 50000, 0);
  var rows = [];
  for (var i = 0; i < records.length; i++) {
    var exported = records[i].publicExport();
    var data = jsonValue(exported.data, {});
    var row = {};
    for (var k = 0; k < headers.length; k++) row[headers[k]] = data[headers[k]] === undefined || data[headers[k]] === null ? "" : String(data[headers[k]]);
    rows.push(row);
  }
  return e.json(200, { programs: rows });
}

function getSheet(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  function quote(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }
  function jsonValue(raw, fallback) {
    if (raw === null || raw === undefined) return fallback;
    try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
    return raw;
  }
  var requestInfo = e.requestInfo();
  var slug = e.request && typeof e.request.pathValue === "function" ? e.request.pathValue("slug") : "";
  if (!slug) {
    var requestPath = requestInfo.path || requestInfo.url || "/api/sheet/";
    var parts = String(requestPath).split("?")[0].split("/");
    slug = parts[parts.length - 1];
  }
  var sheet = ({
    platform: "platforms",
    content: "contents",
    manager: "managers",
    program: "programs",
    special: "special",
    applysettings: "applysettings",
    log: "logs"
  })[slug] || slug;
  if (sheet === "programs") {   // [260904 통합①]
    var __L = require(__hooks + "/ym-programs-lib.js");
    if (__L.isMigrated($app, __col)) return e.json(200, { headers: __L.HEADERS.slice(), rows: __L.list($app, __col, true) });
  }
  {   // [260904 통합④] 코드표 창구
    var __V = require(__hooks + "/ym-views-lib.js");
    if (__V.has(sheet) && __V.isMigrated($app, __col, sheet)) return e.json(200, { headers: __V.headersOf(sheet), rows: __V.list($app, __col, sheet, true) });
  }
  var metaCol = __col("ymmeta");
  var metaRows = $app.findRecordsByFilter(metaCol, "sheet = '" + quote(sheet) + "'", "", 1, 0);
  if (!metaRows.length) {
    return e.json(200, {
      ok: true,
      sheet: "운영_" + slug,
      headers: [],
      rows: [],
      count: 0,
      note: "시트 없음: " + slug + " (찾은 경로: ymmeta.sheet=" + sheet + ", ymdata.sheet=" + sheet + ", api/data/" + sheet + ".csv)"
    });
  }
  var headers = jsonValue(metaRows[0].get("headers"), []);
  var dataCol = __col("ymdata");
  var records = $app.findRecordsByFilter(dataCol, "sheet = '" + quote(sheet) + "'", "rowIndex", 50000, 0);
  var rows = [];
  for (var i = 0; i < records.length; i++) {
    var exported = records[i].publicExport();
    var data = jsonValue(exported.data, {});
    var row = {};
    var hasValue = false;
    for (var k = 0; k < headers.length; k++) {
      var value = data[headers[k]];
      row[headers[k]] = value === undefined || value === null ? "" : String(value);
      if (row[headers[k]].trim() !== "") hasValue = true;
    }
    if (hasValue) {
      row._rowIndex = records[i].get("rowIndex");
      rows.push(row);
    }
  }
  return e.json(200, { headers: headers, rows: rows });
}

function getCalendarJoin(e) {   // [260905 통합⑲] 캘린더 행 하나 → 프로그램(마스터) + 담당자·작성자 이름 + 코드표 행 (api/ym-join-lib.js)
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };
  var q = e.requestInfo().query || {}, id = String(q.id || q["일정ID"] || "").trim();
  var r = require(__hooks + "/ym-join-lib.js").calendar($app, __col, id);
  return e.json(r.status || 200, r);
}
function postCodesReindex(e) {   // [260905 통합⑲] 코드표가 바뀐 뒤 캘린더 홍보 행의 코드 칸을 이름 칸으로 다시 채운다(이름은 안 건드림)
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };
  var C = require(__hooks + "/ym-codes-lib.js"); if (!C.isMigrated($app, __col)) return e.json(409, { error: "코드표 재편(이관 025) 전" });
  var r = C.reindexCalendar($app, __col); r.ok = true; return e.json(200, r);
}

function getProgramJoin(e) {   // [260905 통합⑰] 프로그램 하나의 모든 것: 마스터 행 + 사업 행 + 일일실적 + 캘린더 홍보 + 담당자 이름 (api/ym-join-lib.js)
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };
  var q = e.requestInfo().query || {}, id = String(q.id || q["프로그램ID"] || "").trim();
  var r = require(__hooks + "/ym-join-lib.js").program($app, __col, id);
  return e.json(r.status || 200, r);
}

function getOps(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  function quote(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }
  function parseCsvLine(line) {
    var out = [], value = "", quoted = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (ch === '"') {
        if (quoted && line.charAt(i + 1) === '"') { value += '"'; i++; }
        else quoted = !quoted;
      } else if (ch === ',' && !quoted) {
        out.push(value); value = "";
      } else value += ch;
    }
    out.push(value);
    return out;
  }
  function readMembersFallback() {
    if (sh !== "회원") return null;
    try {
      var raw = $os.readFile(__hooks + "/data/ops_회원.csv");
      var text = typeof raw === "string" ? raw : toString(raw);
      var lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(function (line) { return line.trim() !== ""; });
      if (!lines.length) return null;
      var headers = parseCsvLine(lines[0]);
      var rows = [];
      for (var i = 1; i < lines.length; i++) {
        var values = parseCsvLine(lines[i]), row = {}, hasValue = false;
        for (var j = 0; j < headers.length; j++) {
          row[headers[j]] = j < values.length ? values[j] : "";
          if (String(row[headers[j]]).trim() !== "") hasValue = true;
        }
        if (hasValue) rows.push(row);
      }
      return { sheet: "운영_회원", headers: headers, rows: rows, count: rows.length, source: "api/data/ops_회원.csv" };
    } catch (err) {
      console.log("[ym-db] member csv fallback failed: " + err);
      return null;
    }
  }
  function readBookingFallback() {
    if (sh !== "예매") return null;
    try {
      var raw = $os.readFile(__hooks + "/data/ops_예매.csv");
      var csvText = typeof raw === "string" ? raw : toString(raw);
      var lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/).filter(function (line) { return line.trim() !== ""; });
      if (!lines.length) return null;
      var headers = parseCsvLine(lines[0]), rows = [];
      for (var i = 1; i < lines.length; i++) {
        var values = parseCsvLine(lines[i]), row = {}, hasValue = false;
        for (var j = 0; j < headers.length; j++) {
          row[headers[j]] = j < values.length ? values[j] : "";
          if (String(row[headers[j]]).trim() !== "") hasValue = true;
        }
        if (hasValue && String(row["이용일시"] || "").indexOf("2026") === 0) rows.push(row);
      }
      return { sheet: "운영_예매", headers: headers, rows: rows, count: rows.length, source: "api/data/ops_예매.csv" };
    } catch (err) {
      console.log("[ym-db] booking csv fallback failed: " + err);
      return null;
    }
  }
  function jsonValue(raw, fallback) {
    if (raw === null || raw === undefined) return fallback;
    try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
    return raw;
  }
  function metaFor(sheet) {
    var metaCol = __col("ymmeta");
    var rows = $app.findRecordsByFilter(metaCol, "sheet = '" + quote(sheet) + "'", "", 1, 0);
    return rows && rows.length ? rows[0] : null;
  }
  function rowsFor(sheet, headers) {
    var dataCol = __col("ymdata");
    var documents;
    try { var selected=(sheet==="ops_프로그램마스터"&&String(q.projection||"")==="dashboard"&&String(q.full||"")!=="1")?["공동기획", "공동기획_기관", "구ID", "구분", "무료여부", "별칭", "보고서_관객", "보고서명", "부문코드", "비고", "사업비_분할N", "사업코드", "사업특이사항", "상태", "세부장르", "수입_분할N", "시작일", "연도", "웹_게시일", "장르", "장소", "재무_수강인원", "정본명", "종료일", "출처", "카테고리", "판매시작일", "표시_구분", "표시_분야", "표시_사업비", "표시_수익률", "표시_수입", "프로그램ID", "홍보시작일", "회차수", "캘린더ID"]:null; if(sheet==="ops_일일실적"&&String(q.projection||"")==="salesdaily")selected=["구분","프로그램ID","명칭","기준일자","누계유료","누계무료","누계총인원","누계금액","유료금액","점유율","전일대비(석)","예측제외","FIELD단체석","FIELD판매완료석","FIELD결제예정석","개인총인원","단체분리상태","단체기준일자","단체유료","단체무료","수집원","일일유료","일일무료","일일총인원","일일금액","사업코드"]; documents = require(__hooks + "/ym-read-rows-lib.js").read($app, __col, sheet, selected, sheet==="ops_일일실적"&&String(q.projection||"")==="salesdaily"?["공연","전시"]:null); e.response.header().set("X-Ym-Read", "bulk"); }
    catch (bulkError) { e.response.header().set("X-Ym-Read", "fallback"); e.response.header().set("X-Ym-Read-Reason", String(bulkError).replace(/[^\x20-\x7e]/g,"?").slice(0,140)); var records = $app.findRecordsByFilter(dataCol, "sheet = '" + quote(sheet) + "'", "rowIndex", 50000, 0); documents = []; for(var ri=0;ri<records.length;ri++)documents.push(jsonValue(records[ri].publicExport().data, {})); }
    var rows = [];
    var sparse=sheet==="ops_프로그램마스터"&&String(q.full||"")!=="1", allowed={};
    for(var hi=0;hi<headers.length;hi++)allowed[headers[hi]]=true;
    for (var i = 0; i < documents.length; i++) {
      var data = documents[i]||{}, keys=sparse?Object.keys(data).filter(function(key){return allowed[key];}):headers;
      var row = {};
      var hasValue = false;
      for (var k = 0; k < keys.length; k++) {
        var value = data[keys[k]], text=value === undefined || value === null ? "" : String(value);
        if(!sparse||(keys[k]!=="_json"&&(text!==""||keys[k]==="프로그램ID")))row[keys[k]]=text;
        if (text.trim() !== "") hasValue = true;
      }
      if(sparse&&allowed["프로그램ID"]&&!Object.prototype.hasOwnProperty.call(row,"프로그램ID"))row["프로그램ID"]="";
      if (sheet === "ops_회원" && row["연령대"] === "") {
        var birth = String(data["생년월일"] || "").replace(/[^0-9]/g, "");
        var birthYear = parseInt(birth.slice(0, 4), 10), nowYear = new Date().getFullYear();
        if (birthYear > 1900 && birthYear <= nowYear) row["연령대"] = Math.max(0, Math.floor((nowYear - birthYear) / 10) * 10) + "대";
      }
      if (hasValue) rows.push(row);
    }
    return rows;
  }
  var q = e.requestInfo().query || {};
  var sh = q.sheet;
  if (!sh) {
    var metaCol = __col("ymmeta");
    var metaRows = $app.findRecordsByFilter(metaCol, "sheet ~ '^ops_'", "", 50000, 0);
    var sheets = [];
    for (var si = 0; si < metaRows.length; si++) { if (String(metaRows[si].get("source") || "").indexOf("frozen") === 0) continue; sheets.push({ name: "운영_" + String(metaRows[si].get("sheet")).slice(4) }); }   // [Phase4] 동결 옛 시트 숨김
    return e.json(200, { sheets: sheets });
  }
  function normalizeOpsName(value) {
    return String(value || "").replace(/[()]/g, "").replace(/\s+/g, "").replace(/^ops_/, "");
  }
  var __alias = require(__hooks + "/ym-ops-alias-lib.js");   // [260903 Phase4] 옛 시트 이름 → 통합 시트 번역표(임시 발판)
  var alias = null;   // [Phase4-4] 옛 이름 번역표 폐기(앱은 통합 이름만 요청)
  if (alias) {
    var aHeaders = alias.oldHeaders();
    var aRecs = alias.findRows(__col("ymdata"));
    var aRows = [], orphan = 0;
    for (var ai = 0; ai < aRecs.length; ai++) {
      var aData = jsonValue(aRecs[ai].publicExport().data, {});
      if (!alias.isPart(aData)) { orphan++; continue; }
      var aRow = alias.rowToOld(aData, aHeaders), aHas = false;
      for (var ak = 0; ak < aHeaders.length; ak++) if (aRow[aHeaders[ak]].trim() !== "") { aHas = true; break; }
      if (aHas) aRows.push(aRow);
    }
    return e.json(200, { sheet: "운영_" + sh, headers: aHeaders, rows: aRows, count: aRows.length, via: alias.phys, orphan: orphan });
  }
  var sheetKey = ({ "전시일일": "exhib_daily", "전시마스터": "exhib_master" })[sh] || ("ops_" + normalizeOpsName(sh));
  // [260906 운영자 "판매현황 로딩 너무 느림"] 시트 응답 캐시 — 실측: 일일실적 3.2MB 서버 14.6초·프로그램마스터 1.5MB 15.3초(전송은 0.3~0.7초). 병목은 매 요청마다 전 행 publicExport+조인+직렬화.
  //   $app.store() 에 완성된 JSON 문자열을 두고, ymdata/ymmeta(각 _dev) 레코드가 하나라도 바뀌면 판(ym_ver_<env>)이 올라가 다음 요청이 새로 만든다(api/ym-cache.pb.js). fresh=1 은 앱이 브라우저 쪽 합치기를 피하려 붙이는 표시라 서버 캐시는 그대로 쓴다(판이 같으면 내용도 같다). 강제 재생성은 nocache=1.
  var __cenv = __env || "prod", __ck = "opscache:" + __cenv + ":" + String(sh) + ":" + String(q["프로그램ID"] || q.pid || "") + ":" + String(q.summary || "") + ":" + String(q.full || "") + ":" + String(q.projection || "") + ":salesfast260909v1";
  var __ver = String($app.store().get("ym_ver_" + __cenv) || "0");
  if (String(q.nocache || "") !== "1") { try { var __hv = $app.store().get(__ck + ":ver"), __hb = $app.store().get(__ck + ":body"); if (__hv === __ver && __hb) { e.response.header().set("X-Ym-Cache", "hit"); return e.string(200, __hb); } } catch (__ce) {} }
  function __send(obj) { var __body = JSON.stringify(obj); try { if (obj && obj.rows && obj.rows.length) { $app.store().set(__ck + ":ver", __ver); $app.store().set(__ck + ":body", __body); } } catch (__se) {} try { e.response.header().set("X-Ym-Cache", "miss"); } catch (__he) {} return e.string(200, __body); }
  if(sheetKey==="ops_일일실적"&&String(q.summary||"")==="asof"){
    var day=require(__hooks+"/ym-read-rows-lib.js").asOf($app,__col);
    return __send({sheet:"운영_일일실적",headers:["기준일자"],rows:day?[{"기준일자":day}]:[],count:day?1:0});
  }
  if (String(sh).replace(/[()\s]/g, "") === "세부운영관리대장정리") {   // [260905 통합⑥] 회차 대장은 일일실적 구분 행
    var __V6 = require(__hooks + "/ym-views-lib.js");
    if (__V6.isMigrated($app, __col, "세부운영관리대장정리")) return __send(__V6.opsView($app, __col, "세부운영관리대장정리"));
  }
  if (sh === "장도" || sh === "카페일정" || sh === "대관일정") {   // [260904 통합③·260905 통합⑤] 운영일정 표의 구분 행
    var __V = require(__hooks + "/ym-views-lib.js");
    if (__V.isMigrated($app, __col, sh)) return __send(__V.opsView($app, __col, sh));
  }
  if (sh === "사업비") {   // [260905 통합⑦] 사업비는 프로그램마스터 사업 행 — 창구로 답한다
    var __B = require(__hooks + "/ym-biz-lib.js");
    if (__B.isMigrated($app, __col)) return __send(__B.opsView($app, __col));
  }
  if (sh === "판매설정") {   // [260904 통합②] 판매설정은 프로그램마스터 열 — 창구로 답한다
    var __S = require(__hooks + "/ym-sales-lib.js");
    if (__S.isMigrated($app, __col)) return __send(__S.opsView($app, __col));
  }
  var __pid17 = String(q["프로그램ID"] || q.pid || "").trim();   // [260905 통합⑰] 일일실적을 프로그램 하나 것만(마스터 → 일일실적 참조 조회)
  if (sheetKey === "ops_일일실적" && __pid17) {
    var __J = require(__hooks + "/ym-join-lib.js"), __jm = metaFor(sheetKey); if (!__jm) return e.json(404, { error: "sheet not found: " + sh });
    var __jh = jsonValue(__jm.get("headers"), []), __jd = __J.dailyOf($app, __col, __pid17), __jr = [];
    for (var __ji = 0; __ji < __jd.rows.length; __ji++) { var __row = __J.shape(__jd.rows[__ji], __jh, false); delete __row._rowIndex; __jr.push(__row); }
    var __DJ2 = require(__hooks + "/ym-daily-join-lib.js"); if (__DJ2.isMigrated($app, __col)) { __DJ2.fillDaily($app, __col, __jr); __jh = __DJ2.withCols(__jh); }   // [260905 통합㉓]
    return __send({ sheet: "운영_" + sh, headers: __jh, rows: __jr, count: __jr.length, 프로그램ID: __pid17, via: __jd.via });
  }
  var meta = metaFor(sheetKey);
  if (!meta) {
    var fallback = readMembersFallback();
    if (fallback) return __send(fallback);
    var bookingFallback = readBookingFallback();
    if (bookingFallback) return __send(bookingFallback);
    return __send({
      ok: true,
      sheet: "운영_" + sh,
      headers: [],
      rows: [],
      count: 0,
      note: "시트 없음: " + sh + " (찾은 경로: ymmeta.sheet=" + sheetKey + ", ymdata.sheet=" + sheetKey + ", api/data/" + sheetKey + ".csv)"
    });
  }
  var headers = jsonValue(meta.get("headers"), []);
  if (sh === "회원" && headers.indexOf("연령대") < 0) headers = headers.concat(["연령대"]);
  if (sh === "회원" && String(q.summary || "") === "1") return __send(require(__hooks + "/ym-member-summary-lib.js").getOrBuild(__env));
  // ops rows: NO _rowIndex
  if(sheetKey==="ops_일일실적"&&String(q.projection||"")==="salesdaily")headers=headers.filter(function(k){return ["구분", "프로그램ID", "명칭", "기준일자", "누계유료", "누계무료", "누계총인원", "누계금액", "유료금액", "점유율", "전일대비(석)", "예측제외", "FIELD단체석", "FIELD판매완료석", "FIELD결제예정석", "개인총인원", "단체분리상태", "단체기준일자", "단체유료", "단체무료", "수집원", "일일유료", "일일무료", "일일총인원", "일일금액", "사업코드"].indexOf(k)>=0;});
  var rows = rowsFor(sheetKey, headers);
  if(sheetKey==="ops_일일실적"&&String(q.projection||"")==="salesdaily")rows=rows.filter(function(x){return ["공연","전시"].indexOf(String(x["구분"]||"").trim())>=0;});
  if (sheetKey === "ops_일일실적") {   // [260905 통합㉓] 명칭·사업코드는 저장하지 않고 마스터(정본명·사업코드)에서 붙인다(이관 031 뒤). 응답 열 이름은 그대로.
    var __DJ = require(__hooks + "/ym-daily-join-lib.js");
    if (__DJ.isMigrated($app, __col)) { __DJ.fillDaily($app, __col, rows); headers = __DJ.withCols(headers); }
  }
  if (sheetKey === "ops_프로그램마스터") {   // [260905 통합⑦⑧] 앱에는 사업 행을 빼고 보여 주고, 담당자는 계정NO → 이름
    var __B2 = require(__hooks + "/ym-biz-lib.js"), __A2 = require(__hooks + "/ym-acct-lib.js");
    if (__B2.isMigrated($app, __col)) rows = rows.filter(function (r) { return String(r["구분"] || "").trim() !== "사업" && !(String(r["캘린더ID"] || "").trim() !== "" && String(r["출처"] || "").trim() === "캘린더"); });   // [260905 대관 병합 3] 숨기는 것 = 캘린더에만 있는 대관(출처=캘린더). 프로그램 행에 합쳤진 캘린더(이관 032)는 보인다 [260905 통합⑪] 캘린더 대관 행도 숨김(대관일정 창구로 봄)
    if (String(q.projection||"")!=="dashboard" && __A2.isMigrated($app, __col) && headers.indexOf("담당자") >= 0) { var __am = __A2.maps($app, __col); for (var __ai = 0; __ai < rows.length; __ai++) rows[__ai]["담당자"] = __A2.toName(__am, rows[__ai]["담당자"]); }
    if (String(q.full || "") !== "1") {   // [260905 통합⑯] 빈 칸·_json 생략 — 응답 4.5MB→약 1.2MB(504 방지). 앱 _pmSheetRows 는 빈 칸·_json 을 버리므로 결과 동일. full=1 이면 옛 모양
      var __rc = []; for (var __ri2 = 0; __ri2 < rows.length; __ri2++) { var __r = rows[__ri2], __o = {}, __ks = Object.keys(__r); for (var __k = 0; __k < __ks.length; __k++) { var __key = __ks[__k]; if (__key === "_json") continue; if (__r[__key] === "" && __key !== "프로그램ID") continue; __o[__key] = __r[__key]; } __rc.push(__o); } rows = __rc;
    }
  }
  if(sheetKey==="ops_프로그램마스터"&&String(q.projection||"")==="dashboard"&&String(q.full||"")!=="1"){
    var dashboardCols=["공동기획","공동기획_기관","구ID","구분","무료여부","별칭","보고서_관객","보고서명","부문코드","비고","사업비_분할N","사업코드","사업특이사항","상태","세부장르","수입_분할N","시작일","연도","웹_게시일","장르","장소","재무_수강인원","정본명","종료일","출처","카테고리","판매시작일","표시_구분","표시_분야","표시_사업비","표시_수익률","표시_수입","프로그램ID","홍보시작일","회차수"], dashboardSet={};for(var ci=0;ci<dashboardCols.length;ci++)dashboardSet[dashboardCols[ci]]=true;
    headers=headers.filter(function(key){return !!dashboardSet[key];});
    rows=rows.map(function(row){var out={};for(var pi=0;pi<headers.length;pi++){var key=headers[pi];if(Object.prototype.hasOwnProperty.call(row,key))out[key]=row[key];}return out;});
  }
  if (sh === "회원" && !rows.length) {
    var memberFallback = readMembersFallback();
    if (memberFallback) return __send(memberFallback);
  }
  return __send({ sheet: "운영_" + sh, headers: headers, rows: rows, count: rows.length });
}

function getHolidays(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  var q = e.requestInfo().query || {}, year = parseInt(q.year || "", 10);
  if (!year) return e.json(400, { year: null, days: [] });
  var days = [];
  if (year === 2026) days = [
    { date: "2026-01-01", name: "신정" }, { date: "2026-02-16", name: "설날" }, { date: "2026-02-17", name: "설날" }, { date: "2026-02-18", name: "설날" },
    { date: "2026-03-01", name: "삼일절" }, { date: "2026-03-02", name: "대체공휴일" }, { date: "2026-05-05", name: "어린이날" },
    { date: "2026-05-24", name: "부처님오신날" }, { date: "2026-05-25", name: "대체공휴일" }, { date: "2026-06-03", name: "전국동시지방선거" },
    { date: "2026-06-06", name: "현충일" }, { date: "2026-07-17", name: "제헌절" }, { date: "2026-08-15", name: "광복절" },
    { date: "2026-08-17", name: "대체공휴일" }, { date: "2026-09-24", name: "추석" }, { date: "2026-09-25", name: "추석" },
    { date: "2026-09-26", name: "추석" }, { date: "2026-10-03", name: "개천절" }, { date: "2026-10-05", name: "대체공휴일" },
    { date: "2026-10-09", name: "한글날" }, { date: "2026-12-25", name: "기독탄신일" }
  ];
  return e.json(200, { year: year, days: days, source: "fallback" });
}

function getConfig(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  try {
    var mc = __col("ymmeta");
    var found = $app.findRecordsByFilter(mc, "sheet = '_config'", "", 1, 0);
    var rec = found.length ? found[0] : null;
    if (!rec) return e.json(200, { pets_visible: false, lock_minutes: 240 });
    var raw = rec.get("headers") || {};
    // Older _config records were created with an empty array in the JSON field;
    // normalize that legacy shape before reading named settings.
    var h = raw;
    try { if (h && typeof h.string === "function") h = JSON.parse(h.string()); } catch (normalizeErr0) { h = {}; }
    if (Array.isArray(h)) h = {};
    return e.json(200, {
      pets_visible: h.pets_visible === true,
      lock_minutes: typeof h.lock_minutes === "number" ? h.lock_minutes : 240,
      auth_required: h.auth_required === true
    });
  } catch (err) {
    return e.json(500, { pets_visible: false, lock_minutes: 240, auth_required: false, error: String(err) });
  }
}

function getMessages(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  try {
    var mc = __col("ymmeta"), mm = $app.findRecordsByFilter(mc, "sheet = 'messages'", "", 1, 0), headers = mm.length ? (mm[0].get("headers") || []) : [];
    if (headers && typeof headers.string === "function") { try { headers = JSON.parse(headers.string()); } catch (err0) {} }
    var col = __col("ymdata"), recs = $app.findRecordsByFilter(col, "sheet = 'messages'", "rowIndex", 50000, 0), out = [];
    for (var i = 0; i < recs.length; i++) { var data = recs[i].publicExport().data || {}; if (data && typeof data.string === "function") { try { data = JSON.parse(data.string()); } catch (err1) {} } var row = {}, has = false, dataKeys = Object.keys(data); for (var k = 0; k < dataKeys.length; k++) { row[dataKeys[k]] = data[dataKeys[k]] == null ? "" : String(data[dataKeys[k]]); if (row[dataKeys[k]].trim()) has = true; } if (has) { row._rowIndex = recs[i].get("rowIndex"); out.push(row); } }
    return e.json(200, { messages: out });
  }
  catch (err) { return e.json(500, { messages: [], error: String(err) }); }
}

function getLastmod(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  var rec;
  try { var mc = __col("ymmeta"), found = $app.findRecordsByFilter(mc, "sheet = '_lastmod'", "", 1, 0); rec = found.length ? found[0] : null; } catch (err) { return e.json(500, { lastModified: "", eTag: "miso-ymdb", serverTs: Date.now(), error: String(err) }); }
  var lastModified = rec ? (rec.get("source") || "") : "";
  if (!lastModified) {
    // fallback: max(updated) across ymdata
    var col = __col("ymdata");
    var recs = $app.findRecordsByFilter(col, "", "", 50000, 0);
    var max = "";
    for (var i = 0; i < recs.length; i++) {
      var u = recs[i].get("updated") || "";
      if (u > max) max = u;
    }
    lastModified = max;
  }
  return e.json(200, { lastModified: lastModified, eTag: "miso-ymdb", serverTs: Date.now() });
}

function getPresence(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  return e.json(200, { now: Date.now(), users: [] });
}

function getGcal(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  var runtimeProxy, env, q = e.requestInfo().query || {}, from = String(q.from || ""), to = String(q.to || ""), start, end;
  function gcalText(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/\\N/g, "\n")
      .replace(/\\,/g, ",")
      .replace(/\\;/g, ";")
      .replace(/\\\\/g, "\\");
  }
  function gcalDate(value) {
    var s = String(value || "").replace(/[^0-9TZ:+-]/g, ""), m;
    if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return new Date(+m[1], +m[2] - 1, +m[3]);
    if ((m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(?:\d{2})?/))) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    return null;
  }
  function gcalIsoDate(date) {
    return date.getFullYear() + "-" + ("0" + (date.getMonth() + 1)).slice(-2) + "-" + ("0" + date.getDate()).slice(-2);
  }
  function gcalTime(value) {
    var m = String(value || "").match(/T(\d{2})(\d{2})/);
    return m ? m[1] + ":" + m[2] : "";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return e.json(400, { ok: false, error: "from/to는 YYYY-MM-DD 형식이어야 합니다.", days: [] });
  start = new Date(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  end = new Date(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  if (end < start) return e.json(400, { ok: false, error: "to는 from보다 빠를 수 없습니다.", days: [] });
  try {
    env = require(__hooks + "/_runtime_env.js");
    if (!env.GC_ICAL_KEY) return e.json(503, { ok: false, error: "iCal URL 환경변수 GC_ICAL_KEY가 없습니다.", days: [] });
    runtimeProxy = require(__hooks + "/_runtime_proxy.js");
    var response = runtimeProxy.proxyFetch({
      url: String(env.GC_ICAL_KEY),
      method: "GET",
      headers: { Accept: "text/calendar,text/plain;q=0.9,*/*;q=0.8" },
      timeout: 30
    });
    if (!response || response.statusCode < 200 || response.statusCode >= 300) return e.json(502, { ok: false, error: "iCal 피드를 불러오지 못했습니다.", upstreamStatus: response ? response.statusCode : null, days: [] });
    var lines = String(response.text || "").replace(/^\uFEFF/, "").replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
    var events = [], current = null, i, line, pair, key, value;
    for (i = 0; i < lines.length; i++) {
      line = lines[i];
      if (line === "BEGIN:VEVENT") { current = {}; continue; }
      if (line === "END:VEVENT") { if (current) events.push(current); current = null; continue; }
      if (!current) continue;
      pair = line.indexOf(":"); if (pair < 0) continue;
      key = line.slice(0, pair).split(";")[0].toUpperCase(); value = line.slice(pair + 1);
      if (key === "UID" || key === "SUMMARY" || key === "LOCATION" || key === "DTSTART" || key === "DTEND") current[key] = value;
      if (key === "DTSTART") current.allDay = line.indexOf("VALUE=DATE") >= 0 || /^\d{8}$/.test(value);
    }
    var days = [];
    events.forEach(function (event) {
      var ds = gcalDate(event.DTSTART), de = gcalDate(event.DTEND || event.DTSTART), allDay = !!event.allDay;
      if (!ds) return;
      if (allDay && event.DTEND) de = new Date(de.getFullYear(), de.getMonth(), de.getDate() - 1);
      if (!de || de < start || ds > end) return;
      var first = ds < start ? new Date(start.getTime()) : new Date(ds.getTime());
      var last = de > end ? new Date(end.getTime()) : new Date(de.getTime());
      var uid = gcalText(event.UID || event.SUMMARY || (gcalIsoDate(ds) + ":" + event.LOCATION));
      for (var day = first; day <= last; day.setDate(day.getDate() + 1)) {
        var d = gcalIsoDate(day);
        days.push({ id: "gc:" + uid + ":" + d, d: d, title: gcalText(event.SUMMARY), place: gcalText(event.LOCATION), allday: allDay, st: allDay ? "" : gcalTime(event.DTSTART), et: allDay ? "" : gcalTime(event.DTEND) });
      }
    });
    days.sort(function (a, b) { return a.d === b.d ? String(a.id).localeCompare(String(b.id)) : a.d.localeCompare(b.d); });
    return e.json(200, { ok: true, days: days, count: days.length });
  } catch (err) {
    console.log("[gcal] iCal fetch/parse failed: " + String(err && err.message ? err.message : err));
    return e.json(502, { ok: false, error: "iCal 피드 처리에 실패했습니다.", days: [] });
  }
}

function getVisitors(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  return e.json(200, { ok: false, cities: {}, dow: [], from: "", to: "", lagDays: null });
}

function getMonitorFeed(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  var recs = $app.findRecordsByFilter("ymmeta", "sheet = '_monitor'", "", 1, 0), rec = recs && recs.length ? recs[0] : null;
  var state = rec ? (rec.get("headers") || {}) : { rows: [], last: null, judge: null };
  if (state && typeof state.string === "function") {
    try { state = JSON.parse(state.string()); } catch (err) { state = { rows: [], last: null, judge: null }; }
  }
  if (!state || typeof state !== "object") state = { rows: [], last: null, judge: null };
  var rows = Array.isArray(state.rows) ? state.rows : [];
  var q = e.requestInfo().query || {}, limit = parseInt(q.limit || "300", 10);
  if (!limit || limit < 1) limit = 300;
  return e.json(200, { rows: rows.slice(0, Math.min(limit, 300)), last: state.last || null, judge: state.judge || null });
}

function getMemo(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  var q = e.requestInfo().query || {};
  var user = q.user || "";
  var mc = __col("ymmeta"), found = $app.findRecordsByFilter(mc, "sheet = '_memo'", "", 1, 0), rec = found.length ? found[0] : null;
  if (!rec) return e.json(200, { user: user, text: "" });
  var h = rec.get("headers") || {};
  return e.json(200, { user: user, text: h[user] || "" });
}

function getChatbotFaq(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  var col = __col("ymdata"), recs = $app.findRecordsByFilter(col, "sheet = 'chatbot_faq'", "rowIndex", 50000, 0), out = [];
  for (var i = 0; i < recs.length; i++) out.push(recs[i].publicExport().data || {});
  return e.json(200, { faq: out });
}

function getChatbotRules(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  var col = __col("ymdata"), recs = $app.findRecordsByFilter(col, "sheet = 'rules'", "rowIndex", 50000, 0), out = [];
  for (var i = 0; i < recs.length; i++) out.push(recs[i].publicExport().data || {});
  return e.json(200, { rules: out });
}

function getQa(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  var mc = __col("ymmeta"), mm = $app.findRecordsByFilter(mc, "sheet = 'qa_complaints'", "", 1, 0), headers = mm.length ? (mm[0].get("headers") || []) : [];
  if (headers && typeof headers.string === "function") { try { headers = JSON.parse(headers.string()); } catch (err0) {} }
  var col = __col("ymdata"), recs = $app.findRecordsByFilter(col, "sheet = 'qa_complaints'", "rowIndex", 50000, 0), out = [];
  for (var i = 0; i < recs.length; i++) { var data = recs[i].publicExport().data || {}, row = {}; for (var k = 0; k < headers.length; k++) row[headers[k]] = data[headers[k]] == null ? "" : String(data[headers[k]]); row._rowIndex = recs[i].get("rowIndex"); out.push(row); }
  return e.json(200, { qa: out });
}

function getDiagrams(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  var q = e.requestInfo().query || {};
  var user = q.user;
  var col = __col("ymdata"), recs = $app.findRecordsByFilter(col, "sheet = 'diagrams'", "rowIndex", 50000, 0), rows = [];
  var mm = $app.findRecordsByFilter(__col("ymmeta"), "sheet = 'diagrams'", "", 1, 0), headers = mm.length ? (mm[0].get("headers") || []) : [];
  if (headers && typeof headers.string === "function") { try { headers = JSON.parse(headers.string()); } catch (err0) {} }
  for (var i = 0; i < recs.length; i++) { var data = recs[i].publicExport().data || {}, row = {}; for (var k = 0; k < headers.length; k++) row[headers[k]] = data[headers[k]] == null ? "" : String(data[headers[k]]); row._rowIndex = recs[i].get("rowIndex"); rows.push(row); }
  if (user) {
    rows = rows.filter(function (r) { return r.user === user || r._user === user; });
  }
  return e.json(200, { diagrams: rows });
}

function getHealth(e) {
  return e.json(200, { status: "ok", ts: Date.now() });
}

// --- write handlers ---

function ensureSheetMeta(sheet, headers) {
  var meta = ymmetaGet(sheet);
  if (!meta) {
    ymmetaUpsert(sheet, headers || [], "", 0, 2);
  } else if (headers && JSON.stringify(meta.get("headers")) !== JSON.stringify(headers)) {
    meta.set("headers", headers);
    $app.save(meta);
  }
  return ymmetaGet(sheet);
}

function postRecords(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  function localMeta(sheet, headers) {
    var mc = __col("ymmeta");
    var found = $app.findRecordsByFilter(mc, "sheet = '" + String(sheet).replace(/'/g, "\\'") + "'", "", 1, 0);
    if (found.length) return found[0];
    var created = new Record(mc, { sheet: sheet, headers: headers || [], source: "", rowCount: 0, nextRowIndex: 2 });
    $app.save(created);
    return created;
  }
  function localValues(headers, values) {
    var out = {};
    if (Array.isArray(values)) for (var vi = 0; vi < headers.length; vi++) out[headers[vi]] = vi < values.length ? values[vi] : "";
    else if (values && typeof values === "object") { var vk = Object.keys(values); for (var vj = 0; vj < vk.length; vj++) out[vk[vj]] = values[vk[vj]]; }
    return out;
  }
  var body = {};
  try { var info = e.requestInfo(); body = info && info.body ? info.body : {}; if (typeof body === "string") body = JSON.parse(body); } catch (bodyErr) { body = {}; }
  var values = body.values;
  var sheet = "records";
  {   // [260905 통합⑬] ops_캘린더 구분=홍보 행으로 추가(옛 records 시트를 다시 만들지 않게 localMeta 앞에서)
    var __R = require(__hooks + "/ym-records-lib.js");
    if (__R.isMigrated($app, __col)) { var __rc = __R.create($app, __col, body); return e.json(__rc.status || 200, __rc); }
  }
  var meta = localMeta(sheet, body.headers);
  if (!meta) return e.json(500, { error: "meta ensure failed" });
  var nri = meta.get("nextRowIndex") || 2;
  var headers = (function (raw) { if (raw === null || raw === undefined) return []; try { if (typeof raw.string === "function") { var parsed = JSON.parse(raw.string()); return Array.isArray(parsed) ? parsed : []; } } catch (hErr) {} return Array.isArray(raw) ? raw : []; })(meta.get("headers"));   // [260901] ymmeta.headers = JSON raw — 파싱 없인 length가 없어 빈 행만 저장되던 버그 수정 (WA93-v1 postSheet와 같은 축)
  var data = localValues(headers, values);
  // also preserve any extra fields beyond values
  var extras = body;
  var extraKeys = Object.keys(extras);
  for (var i = 0; i < extraKeys.length; i++) {
    var k = extraKeys[i];
    if (k !== "values" && k !== "headers") data[k] = extras[k];
  }
  {   // [260905 통합⑧⑩] 이름 → 계정NO · 공연ID 키가 따로 오면 프로그램ID 로(옛 규칙대로 나중 키가 이긴다)
    var __A = require(__hooks + "/ym-acct-lib.js");
    var __hs = Array.isArray(headers) ? headers : [];
    if (__A.isMigrated($app, __col)) __A.nosIn(__A.maps($app, __col), data, ["신청자", "게시 담당자"]);
    if (__hs.indexOf("프로그램ID") >= 0 && __hs.indexOf("공연ID") < 0 && Object.prototype.hasOwnProperty.call(data, "공연ID")) { data["프로그램ID"] = data["공연ID"]; delete data["공연ID"]; }
  }
  var col = __col("ymdata");
  var rec = new Record(col, { sheet: sheet, rowIndex: nri, data: data });
  $app.save(rec);
  meta.set("rowCount", (meta.get("rowCount") || 0) + 1);
  meta.set("nextRowIndex", nri + 1);
  $app.save(meta);
  return e.json(200, { ok: true, rowIndex: nri });
}

function patchRecords(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  // [260901] WA93-v1(postSheet/patchSheet)과 같은 수정 2종:
  //   ① 라우트 핸들러 = 격리 Goja 스코프 — 종전 코드가 외부 헬퍼(ymmetaGet/valuesToData/findRecordByRowIndex/bumpLastmod)를
  //      참조해 ReferenceError → 무조건 400 이던 것을 전부 로컬화.
  //   ② ymmeta.headers = JSON raw — JSON.parse 없이는 배열이 아니라 매핑이 빈 객체가 됨(postRecords와 같은 축).
  function jsonValue(raw, fallback) {
    if (raw === null || raw === undefined) return fallback;
    try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
    return raw;
  }
  var rowValue = e.request && typeof e.request.pathValue === "function" ? e.request.pathValue("rowIndex") : "";
  var parts = String((e.requestInfo() || {}).path || "").split("/");
  var rowIdx = parseInt(rowValue || parts[parts.length - 1], 10);
  if (!rowIdx) return e.json(400, { error: "invalid rowIndex" });
  var body = {};
  try { var info = e.requestInfo(); body = info && info.body ? info.body : {}; if (typeof body === "string") body = JSON.parse(body); } catch (bodyErr) { body = {}; }
  var values = body.values;
  {   // [260905 통합⑬]
    var __R = require(__hooks + "/ym-records-lib.js");
    if (__R.isMigrated($app, __col)) { var __rp = __R.patch($app, __col, rowIdx, body); return __rp ? e.json(__rp.status || 200, __rp) : e.json(404, { error: "row not found" }); }   // [통합⑲] 409 전달
  }
  var mc = __col("ymmeta");
  var metas = $app.findRecordsByFilter(mc, "sheet = 'records'", "", 1, 0);
  var headers = metas.length ? jsonValue(metas[0].get("headers"), []) : [];
  if (!Array.isArray(headers)) headers = [];
  var data = {};
  if (Array.isArray(values)) { for (var vi = 0; vi < headers.length; vi++) data[headers[vi]] = vi < values.length ? values[vi] : ""; }
  else if (values && typeof values === "object") { var vk = Object.keys(values); for (var vj = 0; vj < vk.length; vj++) data[vk[vj]] = values[vk[vj]]; }
  var extraKeys = Object.keys(body);
  for (var i = 0; i < extraKeys.length; i++) {
    var k = extraKeys[i];
    if (k !== "values" && k !== "headers") data[k] = body[k];
  }
  {   // [260905 통합⑧⑩] 이름 → 계정NO · 공연ID 키가 따로 오면 프로그램ID 로(옛 규칙대로 나중 키가 이긴다)
    var __A = require(__hooks + "/ym-acct-lib.js");
    var __hs = Array.isArray(headers) ? headers : [];
    if (__A.isMigrated($app, __col)) __A.nosIn(__A.maps($app, __col), data, ["신청자", "게시 담당자"]);
    if (__hs.indexOf("프로그램ID") >= 0 && __hs.indexOf("공연ID") < 0 && Object.prototype.hasOwnProperty.call(data, "공연ID")) { data["프로그램ID"] = data["공연ID"]; delete data["공연ID"]; }
  }
  var col = __col("ymdata");
  var recs = $app.findRecordsByFilter(col, "sheet = 'records' && rowIndex = " + rowIdx, "", 1, 0);
  var rec = recs && recs.length ? recs[0] : null;
  if (!rec) return e.json(404, { error: "row not found" });
  rec.set("data", data);
  $app.save(rec);
  return e.json(200, { ok: true });
}

function deleteRecords(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  var rowValue = e.request && typeof e.request.pathValue === "function" ? e.request.pathValue("rowIndex") : "";
  var requestInfo = e.requestInfo() || {};
  var query = requestInfo.query || {};
  var body = requestInfo.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (err) { body = {}; } }
  var parts = String(requestInfo.path || requestInfo.url || "").split("/");
  if (!rowValue && query.rowIndex) rowValue = query.rowIndex;
  if (!rowValue && body.rowIndex) rowValue = body.rowIndex;
  var rowIdx = parseInt(rowValue || parts[parts.length - 1], 10);
  if (!rowIdx) return e.json(400, { error: "invalid rowIndex" });
  var sheet = "records";
  {   // [260905 통합⑬]
    var __R = require(__hooks + "/ym-records-lib.js");
    if (__R.isMigrated($app, __col)) { var __rd = __R.remove($app, __col, rowIdx); return __rd ? e.json(200, __rd) : e.json(404, { error: "row not found" }); }
  }
  var col = __col("ymdata");
  var recs = $app.findRecordsByFilter(col, "sheet = 'records' && rowIndex = " + rowIdx, "", 1, 0);
  var rec = recs && recs.length ? recs[0] : null;
  if (!rec) return e.json(404, { error: "row not found" });
  $app.delete(rec);
  var metaCol = __col("ymmeta");
  var metas = $app.findRecordsByFilter(metaCol, "sheet = 'records'", "", 1, 0);
  if (metas.length) {
    metas[0].set("rowCount", Math.max(0, (metas[0].get("rowCount") || 0) - 1));
    $app.save(metas[0]);
  }
  return e.json(200, { ok: true });
}

function postSheet(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  // [WA93-v1] Route handlers run in an isolated Goja scope (same as patchSheet) — keep every dependency local.
  // [260903 Phase0 H-1/H-2/H-3/H-6] 헤더 전체를 '' 로 초기화한 뒤 채움 · promoFlag/sideCells 를 열 이름으로 매핑 · 날짜 시리얼 정규화.
  function quote(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }
  function jsonValue(raw, fallback) {
    if (raw === null || raw === undefined) return fallback;
    try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
    return raw;
  }
  function isDateCol(h) { return /(일|일자|오픈일)$/.test(String(h)); }
  function normDate(v) {
    var n = (typeof v === "number") ? v : ((typeof v === "string" && /^\d{5}$/.test(v)) ? parseInt(v, 10) : NaN);
    if (!(n > 20000 && n < 80000)) return v;
    var d = new Date(Math.round((n - 25569) * 86400000));
    var p = function (x) { return (x < 10 ? "0" : "") + x; };
    return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate());
  }
  function applyBody(data, headers, body) {
    var values = body.values;
    var i;
    if (Array.isArray(values)) {
      for (i = 0; i < headers.length && i < values.length; i++) data[headers[i]] = values[i];
    } else if (values && typeof values === "object") {
      var valueKeys = Object.keys(values);
      for (i = 0; i < valueKeys.length; i++) data[valueKeys[i]] = values[valueKeys[i]];
    }
    var extraKeys = Object.keys(body);
    for (i = 0; i < extraKeys.length; i++) {
      var key = extraKeys[i];
      if (key === "values" || key === "headers") continue;
      if (key === "promoFlag") { data["홍보노출"] = body[key]; continue; }            // [260903] 옛 Worker 규약 → 열
      if (key === "sideCells" && body[key] && typeof body[key] === "object") {        // {회차, 장르, …} → 각 열
        var sk = Object.keys(body[key]);
        for (var j = 0; j < sk.length; j++) data[sk[j]] = body[key][sk[j]];
        continue;
      }
      data[key] = body[key];
    }
    for (i = 0; i < headers.length; i++) {
      if (data[headers[i]] === undefined || data[headers[i]] === null) data[headers[i]] = "";
      if (isDateCol(headers[i])) data[headers[i]] = normDate(data[headers[i]]);
    }
    return data;
  }
  var info = e.requestInfo() || {};
  var parts = String(info.path || info.url || "").split("?")[0].split("/");
  var slugValue = e.request && typeof e.request.pathValue === "function" ? e.request.pathValue("slug") : "";
  var slug = slugValue || parts[parts.length - 1];
  if (!slug) return e.json(400, { error: "invalid sheet" });
  var sheet = ({
    platform: "platforms",
    content: "contents",
    manager: "managers",
    program: "programs",
    special: "special",
    applysettings: "applysettings",
    log: "logs"
  })[slug] || slug;
  var body = info.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (bodyErr) { body = {}; }
  }
  if (sheet === "programs") {   // [260904 통합①]
    var __L = require(__hooks + "/ym-programs-lib.js");
    if (__L.isMigrated($app, __col)) { var __c = __L.create($app, __col, body); return e.json(__c.status || 200, __c); }
  }
  {   // [260904 통합④]
    var __V = require(__hooks + "/ym-views-lib.js");
    if (__V.has(sheet) && __V.isMigrated($app, __col, sheet)) { var __vc = __V.create($app, __col, sheet, body); return e.json(__vc.status || 200, __vc); }
  }
  var bodyHeaders = Array.isArray(body.headers) ? body.headers : null;
  var metaCol = __col("ymmeta");
  var metaRows = $app.findRecordsByFilter(metaCol, "sheet = '" + quote(sheet) + "'", "", 1, 0);
  var meta = metaRows.length ? metaRows[0] : null;
  if (!meta) {
    meta = new Record(metaCol, { sheet: sheet, headers: bodyHeaders || [], source: "", rowCount: 0, nextRowIndex: 2 });
    $app.save(meta);
  } else if (bodyHeaders && JSON.stringify(jsonValue(meta.get("headers"), [])) !== JSON.stringify(bodyHeaders)) {
    meta.set("headers", bodyHeaders);
    $app.save(meta);
  }
  var nri = meta.get("nextRowIndex") || 2;
  var headers = jsonValue(meta.get("headers"), []);
  if (!Array.isArray(headers)) headers = [];
  var data = {};
  for (var h = 0; h < headers.length; h++) data[headers[h]] = "";
  data = applyBody(data, headers, body);
  if (sheet === "managers") {   // [260905 통합⑧] 같은 이름 두 명이면 계정NO 가 갈라지지 않는다 → 거부
    var __A = require(__hooks + "/ym-acct-lib.js");
    if (__A.isMigrated($app, __col) && __A.nameTaken($app, __col, data["담당자"], 0)) return e.json(409, { error: "같은 이름의 담당자가 이미 있습니다: " + String(data["담당자"]).trim() });
  }
  var col = __col("ymdata");
  var rec = new Record(col, { sheet: sheet, rowIndex: nri, data: data });
  $app.save(rec);
  meta.set("rowCount", (meta.get("rowCount") || 0) + 1);
  meta.set("nextRowIndex", nri + 1);
  $app.save(meta);
  if (sheet === "managers") { try { require(__hooks + "/ym-acct-lib.js").assignMissing($app, __col); } catch (__ae) { console.log("[ym-db] 계정NO 부여 실패: " + __ae); } }   // [260905 통합⑧]
  var lastmodRows = $app.findRecordsByFilter(metaCol, "sheet = '_lastmod'", "", 1, 0);
  var lastmod = lastmodRows && lastmodRows.length ? lastmodRows[0] : null;
  if (lastmod) {
    lastmod.set("source", new Date().toISOString());
    $app.save(lastmod);
  } else {
    $app.save(new Record(metaCol, { sheet: "_lastmod", headers: [], source: new Date().toISOString(), rowCount: 0, nextRowIndex: 0 }));
  }
  return e.json(200, { ok: true, rowIndex: nri });
}

function patchSheet(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  // Route handlers run in an isolated Goja scope. Keep all dependencies local
  // so PATCH writes do not fail before the record is saved.
  // [260903 Phase0 H-1/H-2/H-6] 부분 갱신: 기존 data 위에 보낸 값만 덮음(배열이면 보낸 길이까지만) — 나머지 열 보존.
  //   promoFlag→홍보노출, sideCells→각 열. 날짜 시리얼 → 'YYYY-MM-DD'. (종전: 행 전체 교체 → 뒤 9열 소실)
  function quote(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }
  function jsonValue(raw, fallback) {
    if (raw === null || raw === undefined) return fallback;
    try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
    return raw;
  }
  function isDateCol(h) { return /(일|일자|오픈일)$/.test(String(h)); }
  function normDate(v) {
    var n = (typeof v === "number") ? v : ((typeof v === "string" && /^\d{5}$/.test(v)) ? parseInt(v, 10) : NaN);
    if (!(n > 20000 && n < 80000)) return v;
    var d = new Date(Math.round((n - 25569) * 86400000));
    var p = function (x) { return (x < 10 ? "0" : "") + x; };
    return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate());
  }
  function applyBody(data, headers, body) {
    var values = body.values;
    var i;
    if (Array.isArray(values)) {
      for (i = 0; i < headers.length && i < values.length; i++) data[headers[i]] = values[i];
    } else if (values && typeof values === "object") {
      var valueKeys = Object.keys(values);
      for (i = 0; i < valueKeys.length; i++) data[valueKeys[i]] = values[valueKeys[i]];
    }
    var extraKeys = Object.keys(body);
    for (i = 0; i < extraKeys.length; i++) {
      var key = extraKeys[i];
      if (key === "values" || key === "headers") continue;
      if (key === "promoFlag") { data["홍보노출"] = body[key]; continue; }
      if (key === "sideCells" && body[key] && typeof body[key] === "object") {
        var sk = Object.keys(body[key]);
        for (var j = 0; j < sk.length; j++) data[sk[j]] = body[key][sk[j]];
        continue;
      }
      data[key] = body[key];
    }
    for (i = 0; i < headers.length; i++) {
      if (data[headers[i]] === undefined || data[headers[i]] === null) data[headers[i]] = "";
      if (isDateCol(headers[i])) data[headers[i]] = normDate(data[headers[i]]);
    }
    return data;
  }
  var info = e.requestInfo() || {};
  var parts = String(info.path || info.url || "").split("/");
  var rowIdxValue = e.request && typeof e.request.pathValue === "function" ? e.request.pathValue("rowIndex") : "";
  var slugValue = e.request && typeof e.request.pathValue === "function" ? e.request.pathValue("slug") : "";
  var rowIdx = parseInt(rowIdxValue || parts[parts.length - 1], 10);
  var slug = slugValue || parts[parts.length - 2];
  if (!rowIdx || !slug) return e.json(400, { error: "invalid sheet row" });
  var sheet = ({
    platform: "platforms",
    content: "contents",
    manager: "managers",
    program: "programs",
    special: "special",
    applysettings: "applysettings",
    log: "logs"
  })[slug] || slug;
  var body = info.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (bodyErr) { body = {}; }
  }
  if (sheet === "programs") {   // [260904 통합①]
    var __L = require(__hooks + "/ym-programs-lib.js");
    if (__L.isMigrated($app, __col)) { var __r = __L.patch($app, __col, rowIdx, body); return __r ? e.json(__r.status || 200, __r) : e.json(404, { error: "row not found" }); }
  }
  {   // [260904 통합④]
    var __V = require(__hooks + "/ym-views-lib.js");
    if (__V.has(sheet) && __V.isMigrated($app, __col, sheet)) { var __vr = __V.patch($app, __col, sheet, rowIdx, body); return __vr ? e.json(__vr.status || 200, __vr) : e.json(404, { error: "row not found" }); }   // [통합⑮] 409 전달
  }
  var metaCol = __col("ymmeta");
  var metaRows = $app.findRecordsByFilter(metaCol, "sheet = '" + quote(sheet) + "'", "", 1, 0);
  var meta = metaRows.length ? metaRows[0] : null;
  var headers = jsonValue(meta ? meta.get("headers") : [], []);
  if (!Array.isArray(headers)) headers = [];
  var col = __col("ymdata");
  var records = $app.findRecordsByFilter(col, "sheet = '" + quote(sheet) + "' && rowIndex = " + rowIdx, "", 1, 0);
  var rec = records && records.length ? records[0] : null;
  if (!rec) return e.json(404, { error: "row not found" });
  var existing = jsonValue(rec.get("data"), {});
  if (!existing || typeof existing !== "object" || Array.isArray(existing)) existing = {};
  var data = {};
  var ek = Object.keys(existing);
  for (var x = 0; x < ek.length; x++) data[ek[x]] = existing[ek[x]];
  data = applyBody(data, headers, body);
  if (sheet === "managers") {   // [260905 통합⑧] 계정NO 는 몸통이 뭘 보내든 지키고, 같은 이름으로 바꾸는 건 거부
    var __A = require(__hooks + "/ym-acct-lib.js");
    if (__A.isMigrated($app, __col)) {
      var __old = String(existing["계정NO"] === undefined || existing["계정NO"] === null ? "" : existing["계정NO"]).trim(); if (__old) data["계정NO"] = __old;
      if (__A.nameTaken($app, __col, data["담당자"], rowIdx)) return e.json(409, { error: "같은 이름의 담당자가 이미 있습니다: " + String(data["담당자"]).trim() });
    }
  }
  rec.set("data", data);
  $app.save(rec);
  if (sheet === "managers") { try { require(__hooks + "/ym-acct-lib.js").assignMissing($app, __col); } catch (__ae2) { console.log("[ym-db] 계정NO 부여 실패: " + __ae2); } }   // [260905 통합⑧]
  var lastmodRows = $app.findRecordsByFilter(metaCol, "sheet = '_lastmod'", "", 1, 0);
  var lastmod = lastmodRows && lastmodRows.length ? lastmodRows[0] : null;
  if (lastmod) {
    lastmod.set("source", new Date().toISOString());
    $app.save(lastmod);
  } else {
    $app.save(new Record(metaCol, {
      sheet: "_lastmod",
      headers: [],
      source: new Date().toISOString(),
      rowCount: 0,
      nextRowIndex: 0
    }));
  }
  return e.json(200, { ok: true });
}

function deleteSheet(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  // [WA93-v1] isolated-scope rewrite (same reason as postSheet).
  function quote(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }
  var info = e.requestInfo() || {};
  var parts = String(info.path || info.url || "").split("?")[0].split("/");
  var rowIdxValue = e.request && typeof e.request.pathValue === "function" ? e.request.pathValue("rowIndex") : "";
  var slugValue = e.request && typeof e.request.pathValue === "function" ? e.request.pathValue("slug") : "";
  var rowIdx = parseInt(rowIdxValue || parts[parts.length - 1], 10);
  var slug = slugValue || parts[parts.length - 2];
  if (!rowIdx || !slug) return e.json(400, { error: "invalid sheet row" });
  var sheet = ({
    platform: "platforms",
    content: "contents",
    manager: "managers",
    program: "programs",
    special: "special",
    applysettings: "applysettings",
    log: "logs"
  })[slug] || slug;
  if (sheet === "managers") {   // [260905 통합⑧] 계정NO 가 붙은 담당자는 지우지 않고 휴직 처리(records·마스터가 번호로 가리킨다)
    var __A = require(__hooks + "/ym-acct-lib.js");
    if (__A.isMigrated($app, __col)) {
      var __mr = $app.findRecordsByFilter(__col("ymdata"), "sheet = 'managers' && rowIndex = " + rowIdx, "", 1, 0);
      if (__mr && __mr.length) { var __md = __A.rowData(__mr[0]); if (__A.nz(__md["계정NO"])) { __md["휴직여부"] = "1"; __mr[0].set("data", __md); $app.save(__mr[0]); return e.json(200, { ok: true, retired: true, rowIndex: rowIdx }); } }
    }
  }
  if (sheet === "programs") {   // [260904 통합①] 폼에서 만든 행은 삭제, 이력 행은 명단에서만 뺀다(콘텐츠구분·NO 비움)
    var __L = require(__hooks + "/ym-programs-lib.js");
    if (__L.isMigrated($app, __col)) { var __d = __L.remove($app, __col, rowIdx); return __d ? e.json(200, __d) : e.json(404, { error: "row not found" }); }
  }
  {   // [260904 통합④]
    var __V = require(__hooks + "/ym-views-lib.js");
    if (__V.has(sheet) && __V.isMigrated($app, __col, sheet)) { var __vd = __V.remove($app, __col, sheet, rowIdx); return __vd ? e.json(200, __vd) : e.json(404, { error: "row not found" }); }
  }
  var col = __col("ymdata");
  var records = $app.findRecordsByFilter(col, "sheet = '" + quote(sheet) + "' && rowIndex = " + rowIdx, "", 1, 0);
  var rec = records && records.length ? records[0] : null;
  if (!rec) return e.json(404, { error: "row not found" });
  $app.delete(rec);
  var metaCol = __col("ymmeta");
  var metaRows = $app.findRecordsByFilter(metaCol, "sheet = '" + quote(sheet) + "'", "", 1, 0);
  if (metaRows.length) {
    metaRows[0].set("rowCount", Math.max(0, (metaRows[0].get("rowCount") || 0) - 1));
    $app.save(metaRows[0]);
  }
  var lastmodRows = $app.findRecordsByFilter(metaCol, "sheet = '_lastmod'", "", 1, 0);
  var lastmod = lastmodRows && lastmodRows.length ? lastmodRows[0] : null;
  if (lastmod) {
    lastmod.set("source", new Date().toISOString());
    $app.save(lastmod);
  } else {
    $app.save(new Record(metaCol, { sheet: "_lastmod", headers: [], source: new Date().toISOString(), rowCount: 0, nextRowIndex: 0 }));
  }
  return e.json(200, { ok: true });
}

// ── [260903 Phase2 H-4] ops 시트 행 단위 쓰기 — 통째 POST(/api/ops) 없이 행 1건만 append·부분 갱신·삭제.
//   POST   /api/ops/row  {sheet, row:{...}}                       → append 1행 (헤더에 없는 키는 헤더에 추가)
//   PATCH  /api/ops/row  {sheet, keyCol, key, patch:{...}}        → keyCol==key 인 첫 행에 patch 키만 덮어씀 (없으면 404)
//   DELETE /api/ops/row  {sheet, keyCol, key}                     → keyCol==key 인 첫 행 삭제
//   시트명 정규화·rowIndex 부여는 postOps 와 동일. 라우트 핸들러 = 격리 스코프(모든 헬퍼 로컬).
function opsRow(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  function quote(value) { return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'"); }
  function jsonValue(raw, fallback) {
    if (raw === null || raw === undefined) return fallback;
    try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
    return raw;
  }
  function sheetKeyOf(sh) { return ({ "전시일일": "exhib_daily", "전시마스터": "exhib_master" })[sh] || "ops_" + String(sh || "").replace(/[()]/g, "").replace(/\s+/g, "").replace(/^ops_/, ""); }
  function bumpLastmod(metaCol) {
    var lm = $app.findRecordsByFilter(metaCol, "sheet = '_lastmod'", "", 1, 0);
    if (lm && lm.length) { lm[0].set("source", new Date().toISOString()); $app.save(lm[0]); }
  }
  var info = e.requestInfo() || {};
  var method = String(info.method || (e.request && e.request.method) || "").toUpperCase();
  var body = info.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (bodyErr) { body = {}; } }
  var __alias = require(__hooks + "/ym-ops-alias-lib.js");   // [260903 Phase4] 옛 시트 이름 → 통합 시트 번역표(임시 발판)
  var sh = body.sheet;
  if (!sh) return e.json(400, { error: "sheet required" });
  if (sh === "사업비") {   // [260905 통합⑦] 행 단위 = 마스터 사업 행(사업NO 키). POST 는 새 사업만(같은 사업NO 는 409)
    var __B = require(__hooks + "/ym-biz-lib.js");
    if (__B.isMigrated($app, __col)) {
      if (method === "POST") { var __row = body.row || {}; if (typeof __row !== "object" || Array.isArray(__row)) return e.json(400, { error: "row object required" }); var __u = __B.createOne($app, __col, __row); return e.json(__u.status || 200, __u); }
      var __kc = String(body.keyCol || "").trim(), __k = String(body.key === undefined ? "" : body.key).trim();
      if (!__kc || !__k) return e.json(400, { error: "keyCol/key required" });
      if (__kc !== "사업NO" && __kc !== "프로그램ID") return e.json(400, { error: "사업비 keyCol must be 사업NO(=프로그램ID)" });
      if (method === "DELETE") { var __dd = __B.removeByNo($app, __col, __k); return __dd ? e.json(200, __dd) : e.json(404, { error: "row not found: 사업NO=" + __k }); }
      var __pt = body.patch || {}; if (typeof __pt !== "object" || Array.isArray(__pt)) return e.json(400, { error: "patch object required" });
      var __pr = __B.patchByNo($app, __col, __k, __pt); return __pr ? e.json(200, __pr) : e.json(404, { error: "row not found: 사업NO=" + __k });
    }
  }
  if (sh === "판매설정") {   // [260904 통합②]
    var __S = require(__hooks + "/ym-sales-lib.js");
    if (__S.isMigrated($app, __col)) {
      if (method === "POST") { var __row = body.row || {}; if (typeof __row !== "object" || Array.isArray(__row)) return e.json(400, { error: "row object required" }); var __u = __S.upsert($app, __col, __row["구분"], __row); return e.json(__u.status || 200, __u); }
      var __kc = String(body.keyCol || "").trim(), __k = String(body.key === undefined ? "" : body.key).trim();
      if (!__kc || !__k) return e.json(400, { error: "keyCol/key required" });
      if (__kc !== "프로그램ID") return e.json(400, { error: "판매설정 keyCol must be 프로그램ID" });
      if (method === "DELETE") { var __dd = __S.removeById($app, __col, __k); return __dd ? e.json(200, __dd) : e.json(404, { error: "row not found: 프로그램ID=" + __k }); }
      var __pt = body.patch || {}; if (typeof __pt !== "object" || Array.isArray(__pt)) return e.json(400, { error: "patch object required" });
      var __pr = __S.patchById($app, __col, __k, __pt); return __pr ? e.json(200, __pr) : e.json(404, { error: "row not found: 프로그램ID=" + __k });
    }
  }
  var alias = null;   // [Phase4-4] 옛 이름 번역표 폐기
  var sheetKey = alias ? alias.phys : sheetKeyOf(sh);
  var metaCol = __col("ymmeta");
  var col = __col("ymdata");
  var metas = alias ? [alias.meta] : $app.findRecordsByFilter(metaCol, "sheet = '" + quote(sheetKey) + "'", "", 1, 0);
  var meta = metas && metas.length ? metas[0] : null;
  if (!meta) return e.json(404, { error: "sheet not found: " + sh });
  var headers = jsonValue(meta.get("headers"), []);
  if (!Array.isArray(headers)) headers = [];
  var i, k;

  if (method === "POST") {
    var row = body.row || {};
    if (typeof row !== "object" || Array.isArray(row)) return e.json(400, { error: "row object required" });
    if (alias) row = alias.rowToPhys(row);   // [Phase4] 옛 열 → 통합 열 + 구분
    else if (__alias.isUnifiedKey(sheetKey) && String(row["구분"] || "").trim() === "") return e.json(400, { error: "구분 required for unified sheet " + sh });
    if (sheetKey === "ops_판매설정" && String(row["프로그램ID"] || "").trim() !== "") {
      // [Phase4] 판매설정은 프로그램ID 1행 — 다른 구분으로 남아 있던 같은 ID 행은 지운다(콘텐츠구분 변경 케이스)
      var dupAll = $app.findRecordsByFilter(col, "sheet = 'ops_판매설정'", "rowIndex", 50000, 0), dupDel = 0;
      for (i = 0; i < dupAll.length; i++) { var dd = jsonValue(dupAll[i].publicExport().data, {}); if (dd && String(dd["프로그램ID"] || "").trim() === String(row["프로그램ID"]).trim()) { $app.delete(dupAll[i]); dupDel++; } }
      if (dupDel) meta.set("rowCount", Math.max(0, (meta.get("rowCount") || 0) - dupDel));
    }
    var data = {};
    for (i = 0; i < headers.length; i++) data[headers[i]] = "";
    var rk = Object.keys(row), hAdded = false;
    for (i = 0; i < rk.length; i++) { k = rk[i]; data[k] = row[k]; if (headers.indexOf(k) < 0) { headers.push(k); hAdded = true; } }
    if (sheetKey === "ops_일일실적") require(__hooks + "/ym-views-lib.js").dailyStamp($app, __col, data, null); else if (sheetKey === "ops_코드표") require(__hooks + "/ym-views-lib.js").codeStamp($app, __col, data, null);   // [260905 통합⑭]
    if (sheetKey === "ops_일일실적") { var __re15 = require(__hooks + "/ym-views-lib.js").dailyRefError($app, __col, data, null); if (__re15) return e.json(409, { error: __re15 }); }   // [260905 통합⑮]
    var nri = meta.get("nextRowIndex") || 2;
    var rec = new Record(col, { sheet: sheetKey, rowIndex: nri, data: data });
    $app.save(rec);
    if (hAdded) meta.set("headers", headers);
    meta.set("rowCount", (meta.get("rowCount") || 0) + 1);
    meta.set("nextRowIndex", nri + 1);
    $app.save(meta);
    if(__env==='dev'&&sheetKey==='ops_일일실적')require(__hooks+'/ym-ticketlink-lib.js').refreshRevenue($app,__col);
    bumpLastmod(metaCol);
    return e.json(200, { ok: true, rowIndex: nri, headersAdded: hAdded });
  }

  var keyCol = String(body.keyCol || "").trim(), key = String(body.key === undefined ? "" : body.key).trim();
  if (!keyCol || !key) return e.json(400, { error: "keyCol/key required" });
  if (alias) keyCol = alias.toPhys(keyCol);   // [Phase4] ID/공연ID/전시ID → 프로그램ID
  var records = alias ? alias.findRows(col) : $app.findRecordsByFilter(col, "sheet = '" + quote(sheetKey) + "'", "rowIndex", 50000, 0);
  var target = null, tdata = null;
  for (i = 0; i < records.length; i++) {
    var d = jsonValue(records[i].publicExport().data, {});
    if (alias && !alias.isPart(d)) continue;   // [Phase4] 같은 구분 안에서만
    if (d && String(d[keyCol] === undefined ? "" : d[keyCol]).trim() === key) { target = records[i]; tdata = d; break; }
  }
  if (!target) return e.json(404, { error: "row not found: " + keyCol + "=" + key });

  if (method === "DELETE") {
    $app.delete(target);
    meta.set("rowCount", Math.max(0, (meta.get("rowCount") || 0) - 1));
    $app.save(meta);
    if(__env==='dev'&&sheetKey==='ops_일일실적')require(__hooks+'/ym-ticketlink-lib.js').refreshRevenue($app,__col);
    bumpLastmod(metaCol);
    return e.json(200, { ok: true, deleted: 1 });
  }

  // PATCH — 보낸 키만 갱신, 나머지 열 보존
  var patch = body.patch || {};
  if (typeof patch !== "object" || Array.isArray(patch)) return e.json(400, { error: "patch object required" });
  if (alias) { patch = alias.rowToPhys(patch); delete patch["구분"]; }   // [Phase4] 열 이름·값 번역(구분은 못 바꿈)
  var out = {};
  var ek = Object.keys(tdata || {});
  for (i = 0; i < ek.length; i++) out[ek[i]] = tdata[ek[i]];
  var pk = Object.keys(patch), hAdded2 = false;
  for (i = 0; i < pk.length; i++) { k = pk[i]; out[k] = patch[k]; if (headers.indexOf(k) < 0) { headers.push(k); hAdded2 = true; } }
  for (i = 0; i < headers.length; i++) if (out[headers[i]] === undefined || out[headers[i]] === null) out[headers[i]] = "";
  if (sheetKey === "ops_일일실적" && Object.prototype.hasOwnProperty.call(patch, "프로그램ID")) { var __re15p = require(__hooks + "/ym-views-lib.js").dailyRefError($app, __col, out, null); if (__re15p) return e.json(409, { error: __re15p }); }   // [260905 통합⑮]
  target.set("data", out);
  $app.save(target);
  if (hAdded2) { meta.set("headers", headers); $app.save(meta); }
  if(__env==='dev'&&sheetKey==='ops_일일실적')require(__hooks+'/ym-ticketlink-lib.js').refreshRevenue($app,__col);
  bumpLastmod(metaCol);
  return e.json(200, { ok: true, patched: pk.length });
}

function postOps(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  function localMeta(sheet, headers, source, rowCount, nextRowIndex) {
    var mc = __col("ymmeta");
    var found = $app.findRecordsByFilter(mc, "sheet = '" + String(sheet).replace(/'/g, "\\'") + "'", "", 1, 0);
    var rec = found.length ? found[0] : new Record(mc, { sheet: sheet, headers: headers || [], source: source || "", rowCount: rowCount || 0, nextRowIndex: nextRowIndex || 2 });
    if (headers) rec.set("headers", headers);
    if (source !== undefined) rec.set("source", source);
    if (rowCount !== undefined) rec.set("rowCount", rowCount);
    if (nextRowIndex !== undefined) rec.set("nextRowIndex", nextRowIndex);
    $app.save(rec);
    return rec;
  }
  function localMetaGet(sheet) {
    var mc = __col("ymmeta");
    var found = $app.findRecordsByFilter(mc, "sheet = '" + String(sheet).replace(/'/g, "\\'") + "'", "", 1, 0);
    return found.length ? found[0] : null;
  }
  function localBody() { var info = e.requestInfo(); var body = info && info.body ? info.body : {}; return typeof body === "string" ? JSON.parse(body) : body; }
  function localSheet(sh) { return ({ "전시일일": "exhib_daily", "전시마스터": "exhib_master" })[sh] || "ops_" + String(sh || "").replace(/[()]/g, "").replace(/\s+/g, "").replace(/^ops_/, ""); }   /* [260902] getOps와 같은 정규화 — 괄호 든 시트명(세부운영관리대장(정리))을 POST하면 별도 시트에 쓰이던 버그 */
  function localQuote(value) { return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'"); }
  var __alias = require(__hooks + "/ym-ops-alias-lib.js");   // [260903 Phase4] 옛 시트 이름 → 통합 시트 번역표(임시 발판)
  var body = localBody();
  var sh = body.sheet;
  if (!sh) return e.json(400, { error: "sheet required" });
  if (sh === "판매설정") {   // [260904 통합②] 행마다 마스터 upsert(통째 교체는 거부)
    var __S = require(__hooks + "/ym-sales-lib.js");
    if (__S.isMigrated($app, __col)) {
      var __rows = body.rows || [], __mode = body.mode, __part = body.part || "";
      if (__mode !== "upsert" && __mode !== "append") return e.json(409, { error: "판매설정 is merged into 프로그램마스터 — use mode:'upsert' or /api/ops/row" });
      var __ins = 0, __upd = 0;
      for (var __i = 0; __i < __rows.length; __i++) { var __r = __S.upsert($app, __col, __part || ((__rows[__i] || {})["구분"]), __rows[__i] || {}); if (__r.error) return e.json(__r.status || 400, __r); if (__r.created) __ins++; else __upd++; }
      return e.json(200, { ok: true, inserted: __ins, updated: __upd, removed: 0, via: __S.MASTER });
    }
  }
  if (sh === "사업비") {   // [260905 통합⑦] 통째 저장 = 사업 행만 같은 뜻으로 덮기/추가/지우기(빈 저장은 거부). 한 트랜잭션.
    var __B = require(__hooks + "/ym-biz-lib.js");
    if (__B.isMigrated($app, __col)) {
      var __br = null, __bx = null;
      try {
        $app.runInTransaction(function (__tx) {
          __br = (body.mode === "append" || body.mode === "upsert") ? __B.appendRows(__tx, __col, body.rows || [], body.headers) : __B.replaceAll(__tx, __col, body.rows || [], body.allowEmpty === true, body.headers);
          if (__br && __br.error) throw new Error("__rollback__");
        });
      } catch (__te) { __bx = __te; }
      if (__br && __br.error) return e.json(__br.status || 400, __br);
      if (__bx) return e.json(500, { error: "사업비 저장 실패: " + __bx });
      return e.json(200, __br);
    }
  }
  if (localSheet(sh) === "ops_프로그램마스터" && body.mode !== "append" && body.mode !== "upsert" && !body.part && body.force !== true) {   // [260905 통합⑦] 앱은 사업 행을 못 보므로 통째 교체하면 사업 행이 사라진다
    var __B3 = require(__hooks + "/ym-biz-lib.js");
    if (__B3.isMigrated($app, __col)) return e.json(409, { error: "프로그램마스터 whole-replace refused (사업 행 보호) — use mode:'upsert', part, or force:true" });
  }
  var alias = body.part ? __alias.partAlias(localSheet(sh), body.part, $app, __col("ymmeta")) : null;   // [Phase4-4] 통합 이름 + 구분 한 칸(YMDB.save). 옛 이름 번역표는 폐기
  var sheetKey = alias ? alias.phys : localSheet(sh);
  var mode = body.mode; // 'append' or undefined
  var col = __col("ymdata");
  var rows = body.rows || [];
  var bulkMemberImport = body.bulkImport === true && sheetKey === "ops_회원";
  if (bulkMemberImport) ymmetaUpsert("_member_importing", { active: true }, "member-import", 1, 1);
  var removed = 0;
  if (!alias && __alias.isUnifiedKey(sheetKey) && mode !== "append" && mode !== "upsert" && body.force !== true && localMetaGet(sheetKey)) {
    return e.json(409, { error: "unified sheet whole-replace refused (use old sheet name, mode:'append', or force:true): " + sh });   // [Phase4] 통합 시트 통째 삭제 사고 방지
  }
  if (mode === "upsert" && !alias) return e.json(400, { error: "upsert requires part (unified sheet)" });   // [260904 upsert]
  var __seen15 = null;
  if (sheetKey === "ops_일일실적") {   // [260905 통합⑮] 일일실적.프로그램ID 는 마스터에 있어야 한다 — 쓰기 전에 전부 검사
    var __V15 = require(__hooks + "/ym-views-lib.js"), __bad15 = []; __seen15 = {};
    for (var __ri = 0; __ri < rows.length; __ri++) { var __pr = alias ? alias.rowToPhys(rows[__ri] || {}) : (rows[__ri] || {}); if (mode === "upsert" && !Object.prototype.hasOwnProperty.call(__pr, "프로그램ID")) continue; var __re = __V15.dailyRefError($app, __col, __pr, __seen15); if (__re && __bad15.indexOf(__re) < 0) __bad15.push(__re); }
    if (__bad15.length) return e.json(409, { error: "일일실적 프로그램ID 가 프로그램마스터에 없음 (" + __bad15.length + "건)", details: __bad15.slice(0, 20) });
  }
  if (mode !== "append" && mode !== "upsert") {
    // full replace: delete existing rows for this sheet (별칭이면 같은 구분의 행만)
    var existing = alias ? alias.findRows(col) : $app.findRecordsByFilter(col, "sheet = '" + localQuote(sheetKey) + "'", "", 50000, 0);
    if (alias && rows.length === 0 && existing.length > 0 && body.allowEmpty !== true) {
      return e.json(409, { error: "empty replace refused (allowEmpty:true to confirm)", existing: existing.length });   // [Phase4] 빈 저장으로 구분 통째 삭제 방지
    }
    for (var di = 0; di < existing.length; di++) {
      if (alias && !alias.isPart(__alias.parseJson(existing[di].publicExport().data, {}))) continue;
      $app.delete(existing[di]); removed++;
    }
  }
  // ensure meta with headers
  var headers = body.headers || [];
  var meta;
  if (alias) {
    // [Phase4] 통합 시트 헤더는 보존, 앱이 보낸 옛 헤더 중 새 열만 통합 이름으로 추가(빈 이름 제외)
    meta = alias.meta;
    var pH = __alias.parseJson(meta.get("headers"), []); if (!Array.isArray(pH)) pH = ["프로그램ID","구분","명칭"];
    var pAdded = false;
    for (var hi = 0; hi < headers.length; hi++) { var pc = alias.toPhys(headers[hi]); if (!pc || !String(pc).trim()) continue; if (pH.indexOf(pc) < 0) { pH.push(pc); pAdded = true; } }
    if (pAdded) meta.set("headers", pH);
  } else if (mode === "append") {
    meta = localMetaGet(sheetKey) || localMeta(sheetKey, headers, "", 0, 2);
    if (headers.length) {
      meta.set("headers", headers);
      $app.save(meta);
    }
  } else {
    meta = localMeta(sheetKey, headers, "", 0, 2);
  }
  var nri = meta.get("nextRowIndex") || 2;
  var inserted = 0, updated = 0, window_seen14 = __seen15;   // [260905 통합⑭] 한 요청 안에서 키 겹침 방지용 집합 [⑮] 마스터 ID 집합도 같이 캐시
  // [260904 upsert] mode:'upsert' + keyCols:[…] (통합 시트·구분 한 칸) — 키가 같은 행이 있으면 갱신, 없으면 추가. 재시도해도 중복 행이 안 생긴다.
  var upKeys = (mode === "upsert" && alias && Array.isArray(body.keyCols) && body.keyCols.length) ? body.keyCols : null;
  var upIdx = {};
  if (upKeys) {
    var cur = alias.findRows(col);
    for (var ui = 0; ui < cur.length; ui++) { var ud = __alias.parseJson(cur[ui].publicExport().data, {}); if (!alias.isPart(ud)) continue; var uk = []; for (var uj = 0; uj < upKeys.length; uj++) uk.push(String(ud[upKeys[uj]] === undefined || ud[upKeys[uj]] === null ? "" : ud[upKeys[uj]]).trim()); var ukOk = true; for (var uq = 0; uq < uk.length; uq++) if (uk[uq] === "") ukOk = false; if (!ukOk) continue; upIdx[uk.join("\u0001")] = cur[ui]; }
  }
  for (var i = 0; i < rows.length; i++) {
    var data = {};
    var src = alias ? alias.rowToPhys(rows[i] || {}) : (rows[i] || {});
    var keys = Object.keys(src);
    for (var ki = 0; ki < keys.length; ki++) data[keys[ki]] = src[keys[ki]];
    if (sheetKey === "ops_일일실적" && Object.prototype.hasOwnProperty.call(data, "기준일자")) data["기준일자"] = require(__hooks + "/ym-views-lib.js").d8raw(data["기준일자"]);   // [260905 통합⑭]
    if (upKeys) {
      var kk = []; for (var kj = 0; kj < upKeys.length; kj++) kk.push(String(data[upKeys[kj]] === undefined || data[upKeys[kj]] === null ? "" : data[upKeys[kj]]).trim());
      var kkey = kk.join("\u0001"), kkOk = true; for (var kq = 0; kq < kk.length; kq++) if (kk[kq] === "") kkOk = false;
      if (kkOk && upIdx[kkey]) {
        var tgt = upIdx[kkey], td = __alias.parseJson(tgt.publicExport().data, {}), merged = {};
        var tk = Object.keys(td || {}); for (var mi = 0; mi < tk.length; mi++) merged[tk[mi]] = td[tk[mi]];
        var dk = Object.keys(data); for (var mj = 0; mj < dk.length; mj++) merged[dk[mj]] = data[dk[mj]];
        tgt.set("data", merged); $app.save(tgt); updated++;
        continue;
      }
    }
    if (sheetKey === "ops_일일실적") { var __V14 = require(__hooks + "/ym-views-lib.js"); if (!window_seen14) window_seen14 = {}; __V14.dailyStamp($app, __col, data, window_seen14); }   // [260905 통합⑭] 새 행에 실적ID
    else if (sheetKey === "ops_코드표") { var __V14c = require(__hooks + "/ym-views-lib.js"); if (!window_seen14) window_seen14 = {}; __V14c.codeStamp($app, __col, data, window_seen14); }
    var rec = new Record(col, { sheet: sheetKey, rowIndex: nri, data: data });
    $app.save(rec);
    if (upKeys && kkOk) upIdx[kkey] = rec;
    nri++;
    inserted++;
  }
  if (alias) {
    // [Phase4] rowCount 는 실제 행 수로 다시 센다(구분 공유 시트라 가감 누적 대신 재계산)
    meta.set("rowCount", $app.findRecordsByFilter(col, "sheet = '" + localQuote(sheetKey) + "'", "", 50000, 0).length);
  } else {
    meta.set("rowCount", (meta.get("rowCount") || 0) + inserted);
  }
  meta.set("nextRowIndex", nri);
  $app.save(meta);
  try { var lmc = __col("ymmeta"); var lm = $app.findRecordsByFilter(lmc, "sheet = '_lastmod'", "", 1, 0); if (lm && lm.length) { lm[0].set("source", new Date().toISOString()); $app.save(lm[0]); } } catch (lmErr) {}   // [Phase4] 통째 저장도 lastmod 갱신
  if (bulkMemberImport) {
    var importingMeta = ymmetaGet("_member_importing");
    if (importingMeta) $app.delete(importingMeta);
    require(__hooks + "/ym-member-summary-lib.js").rebuild(__env);
  }
  if(__env==='dev'&&sheetKey==='ops_일일실적')require(__hooks+'/ym-ticketlink-lib.js').refreshRevenue($app,__col);
  return e.json(200, { ok: true, inserted: inserted, updated: updated, removed: removed, via: sheetKey });
}

function postQa(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  var body = readBody(e);
  var sheet = "qa_complaints";
  var meta = ensureSheetMeta(sheet, ["status", "memo", "payload"]);
  if (!meta) return e.json(500, { error: "meta ensure failed" });
  var nri = meta.get("nextRowIndex") || 2;
  var data = {};
  var keys = Object.keys(body);
  for (var i = 0; i < keys.length; i++) data[keys[i]] = body[keys[i]];
  var col = __col("ymdata");
  var rec = new Record(col, { sheet: sheet, rowIndex: nri, data: data });
  $app.save(rec);
  meta.set("rowCount", (meta.get("rowCount") || 0) + 1);
  meta.set("nextRowIndex", nri + 1);
  $app.save(meta);
  bumpLastmod();
  return e.json(200, { ok: true, rowIndex: nri });
}

function patchQa(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  var body = readBody(e);
  var rowIndex = body.rowIndex;
  if (!rowIndex) return e.json(400, { error: "rowIndex required" });
  var sheet = "qa_complaints";
  var col = __col("ymdata");
  var rec = findRecordByRowIndex(col, sheet, rowIndex);
  if (!rec) return e.json(404, { error: "row not found" });
  var data = rec.get("data") || {};
  if (body.status !== undefined) data.status = body.status;
  if (body.memo !== undefined) data.memo = body.memo;
  rec.set("data", data);
  $app.save(rec);
  bumpLastmod();
  return e.json(200, { ok: true });
}

function patchMessages(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  // [260901] 격리 Goja 스코프 로컬화 + data JSON 파싱 (patchRecords 수정과 같은 축) — 알림 읽음/삭제 표시가 400 나던 것 수정
  var id = e.request && typeof e.request.pathValue === "function" ? e.request.pathValue("id") : "";
  if (!id) { var parts = String((e.requestInfo() || {}).path || (e.requestInfo() || {}).url || "").split("?")[0].split("/"); id = parts[parts.length - 1]; }
  try { id = decodeURIComponent(id); } catch (dErr) {}
  var body = {};
  try { var info = e.requestInfo(); body = info && info.body ? info.body : {}; if (typeof body === "string") body = JSON.parse(body); } catch (bodyErr) { body = {}; }
  var col = __col("ymdata");
  var recs = $app.findRecordsByFilter(col, "sheet = 'messages'", "rowIndex", 50000, 0);
  var rec = null, data = null;
  for (var i = 0; i < recs.length; i++) {
    var d = recs[i].publicExport().data || {};
    if (d && typeof d.string === "function") { try { d = JSON.parse(d.string()); } catch (pErr) { d = {}; } }
    if (d && String(d.id || "") === id) { rec = recs[i]; data = d; break; }
  }
  if (!rec) return e.json(404, { error: "message not found" });
  if (body.read === true) data.read = true;
  if (body.deleted === true) data.deleted = true;
  rec.set("data", data);
  $app.save(rec);
  return e.json(200, { ok: true });
}

function deleteMessages(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  // [260901] 격리 Goja 스코프 로컬화 — 외부 헬퍼 참조 ReferenceError로 항상 400 나던 것 수정
  var id = e.request && typeof e.request.pathValue === "function" ? e.request.pathValue("id") : "";
  if (!id) { var parts = String((e.requestInfo() || {}).path || (e.requestInfo() || {}).url || "").split("?")[0].split("/"); id = parts[parts.length - 1]; }
  try { id = decodeURIComponent(id); } catch (dErr) {}
  var col = __col("ymdata");
  var recs = $app.findRecordsByFilter(col, "sheet = 'messages'", "rowIndex", 50000, 0);
  var rec = null;
  for (var i = 0; i < recs.length; i++) {
    var d = recs[i].publicExport().data || {};
    if (d && typeof d.string === "function") { try { d = JSON.parse(d.string()); } catch (pErr) { d = {}; } }
    if (d && String(d.id || "") === id) { rec = recs[i]; break; }
  }
  if (!rec) return e.json(404, { error: "message not found" });
  $app.delete(rec);
  var mc = $app.findRecordsByFilter(__col("ymmeta"), "sheet = 'messages'", "", 1, 0);
  if (mc.length) { mc[0].set("rowCount", Math.max(0, (mc[0].get("rowCount") || 0) - 1)); $app.save(mc[0]); }
  return e.json(200, { ok: true });
}

function postConfig(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  var body = {};
  try { var info = e.requestInfo(); body = info && info.body ? info.body : {}; if (typeof body === "string") body = JSON.parse(body); } catch (bodyErr) { body = {}; }
  var col = __col("ymmeta");
  var found = $app.findRecordsByFilter(col, "sheet = '_config'", "", 1, 0);
  var rec = found.length ? found[0] : null;
  var h;
  if (rec) {
    var raw = rec.get("headers") || {};
    // PocketBase may return the legacy empty JSON array as a Go slice. Copy only
    // object-shaped values so new named settings can be persisted safely.
    h = raw;
    try { if (h && typeof h.string === "function") h = JSON.parse(h.string()); } catch (normalizeErr0) { h = {}; }
    if (Array.isArray(h)) h = {};
  } else {
    h = {};
  }
  if (body.pets_visible !== undefined) h.pets_visible = !!body.pets_visible;
  if (body.lock_minutes !== undefined) h.lock_minutes = parseInt(body.lock_minutes, 10) || 0;
  if (body.auth_required !== undefined) h.auth_required = !!body.auth_required;
  if (rec) {
    rec.set("headers", h);
    $app.save(rec);
  } else {
    var nr = new Record(col, { sheet: "_config", headers: h, source: "", rowCount: 0, nextRowIndex: 1 });
    $app.save(nr);
  }
  return e.json(200, { ok: true });
}

function postMemo(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  var body = {};
  try { var info = e.requestInfo(); body = info && info.body ? info.body : {}; if (typeof body === "string") body = JSON.parse(body); } catch (bodyErr) { body = {}; }
  var user = body.user;
  if (!user) return e.json(400, { error: "user required" });
  var col = __col("ymmeta");
  var found = $app.findRecordsByFilter(col, "sheet = '_memo'", "", 1, 0);
  var rec = found.length ? found[0] : null;
  var h;
  if (rec) {
    h = rec.get("headers") || {};
  } else {
    h = {};
  }
  h[user] = body.text || "";
  if (rec) {
    rec.set("headers", h);
    $app.save(rec);
  } else {
    var nr = new Record(col, { sheet: "_memo", headers: h, source: "", rowCount: 0, nextRowIndex: 1 });
    $app.save(nr);
  }
  return e.json(200, { ok: true });
}

function postPresence(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  // 2-3: presence writes only need {ok:true}
  return e.json(200, { ok: true });
}

function managerByEmail(email) {
  var col = __col("ymdata");
  var rows = $app.findRecordsByFilter(col, "sheet = 'managers'", "rowIndex", 50000, 0);
  var target = String(email || "").trim().toLowerCase();
  for (var i = 0; i < rows.length; i++) {
    var data = rows[i].get("data") || {};
    if (String(data["이메일"] || "").trim().toLowerCase() === target) return { record: rows[i], data: data };
  }
  return null;
}

function authVerifyPin(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  try {
  var body = {};
  try { var info = e.requestInfo(); body = info && info.body ? info.body : {}; if (typeof body === "string") body = JSON.parse(body); } catch (bodyErr) { body = {}; }
  var managerRows = $app.findRecordsByFilter(__col("ymdata"), "sheet = 'managers'", "rowIndex", 50000, 0);
  var found = null, targetEmail = String(body.email || "").trim().toLowerCase();
  for (var mi = 0; mi < managerRows.length; mi++) {
    var managerData = managerRows[mi].publicExport().data || {};
    try { if (typeof managerData === "string") managerData = JSON.parse(managerData); else if (managerData && typeof managerData.string === "function") managerData = JSON.parse(managerData.string()); } catch (dataErr) { managerData = {}; }
    if (String(managerData["이메일"] || "").trim().toLowerCase() === targetEmail) { found = { record: managerRows[mi], data: managerData }; break; }
  }
  if (!found) return e.json(403, { ok: false, error: "manager not found" });
  var data = found.data;
  if (String(data["휴직여부"] || "").toUpperCase() === "Y" || String(data["휴직여부"] || "") === "1") return e.json(403, { ok: false, error: "manager inactive" });
  if (!(String(data["계정여부"] || "").toUpperCase() === "Y" || String(data["계정여부"] || "") === "1" || data["계정여부"] === true)) return e.json(403, { ok: false, error: "account inactive" });
  var stored = String(data.PIN || data["비밀번호"] || "").trim();
  var supplied = String(body.pin || "").trim();
  while (stored.length < 4) stored = "0" + stored;
  while (supplied.length < 4) supplied = "0" + supplied;
  if (!/^\d{4}$/.test(stored) || stored !== supplied) return e.json(403, { ok: false, error: "invalid pin" });
  return e.json(200, { ok: true, manager: data["담당자"] || "", department: data["담당부서"] || "", admin: data["관리자여부"] === true || String(data["관리자여부"] || "").toUpperCase() === "Y" || String(data["관리자여부"] || "") === "1", accountant: data["회계여부"] === true || String(data["회계여부"] || "").toUpperCase() === "Y" || String(data["회계여부"] || "") === "1" });
  } catch (err) { return e.json(500, { ok: false, error: String(err && err.message ? err.message : err) }); }
}

function authSetPin(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  try {
  var body = {};
  try { var info = e.requestInfo(); body = info && info.body ? info.body : {}; if (typeof body === "string") body = JSON.parse(body); } catch (bodyErr) { body = {}; }
  var pin = String(body.pin || "").trim();
  if (!/^\d{4}$/.test(pin)) return e.json(400, { ok: false, error: "pin must be four digits" });
  var managerRows = $app.findRecordsByFilter(__col("ymdata"), "sheet = 'managers'", "rowIndex", 50000, 0);
  var found = null, targetEmail = String(body.email || "").trim().toLowerCase();
  for (var mi = 0; mi < managerRows.length; mi++) {
    var managerData = managerRows[mi].publicExport().data || {};
    try { if (typeof managerData === "string") managerData = JSON.parse(managerData); else if (managerData && typeof managerData.string === "function") managerData = JSON.parse(managerData.string()); } catch (dataErr) { managerData = {}; }
    if (String(managerData["이메일"] || "").trim().toLowerCase() === targetEmail) { found = { record: managerRows[mi], data: managerData }; break; }
  }
  if (!found) return e.json(403, { ok: false, error: "manager not found" });
  var data = found.data;
  data.PIN = pin;
  data["비밀번호"] = pin;
  found.record.set("data", data);
  $app.save(found.record);
  return e.json(200, { ok: true });
  } catch (err) { return e.json(500, { ok: false, error: String(err && err.message ? err.message : err) }); }
}

// 1-D: an admin route to trigger a re-shape from legacy _holidays/YYYY rows
function fixHolidays(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  var obj = shapeHolidaysObject();
  if (Object.keys(obj).length > 0) {
    saveHolidaysObject(obj);
    return e.json(200, { ok: true, years: Object.keys(obj) });
  }
  return e.json(200, { ok: true, years: [], note: "no legacy rows found" });
}

// [260901] MISO 이식판에 빠져 있던 POST /api/messages — 상태 변경 시 신청자 알림(pushMessage)이
// 서버에 저장되지 못해 크로스 유저 알림이 localStorage 폴백으로만 남던 것 복구. 저장 형태 = getMessages와 동일(data에 메시지 객체 그대로).
function postMessages(e) {
  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션
  var body = {};
  try { var info = e.requestInfo(); body = info && info.body ? info.body : {}; if (typeof body === "string") body = JSON.parse(body); } catch (bodyErr) { body = {}; }
  if (!body || !body.recipient) return e.json(400, { ok: false, error: "recipient required" });
  var mc = __col("ymmeta");
  var found = $app.findRecordsByFilter(mc, "sheet = 'messages'", "", 1, 0);
  var meta = found.length ? found[0] : null;
  if (!meta) { meta = new Record(mc, { sheet: "messages", headers: [], source: "", rowCount: 0, nextRowIndex: 2 }); $app.save(meta); }
  var nri = meta.get("nextRowIndex") || 2;
  var col = __col("ymdata");
  var rec = new Record(col, { sheet: "messages", rowIndex: nri, data: body });
  $app.save(rec);
  meta.set("rowCount", (meta.get("rowCount") || 0) + 1);
  meta.set("nextRowIndex", nri + 1);
  $app.save(meta);
  return e.json(200, { ok: true, rowIndex: nri });
}

// --- routes ---
// Runtime reload marker: re-register the existing route set after a recovered hook-load failure.

routerAdd("GET", "/api/records", getRecords);
routerAdd("GET", "/api/programs", getPrograms);
routerAdd("GET", "/api/sheet/{slug}", getSheet);
routerAdd("GET", "/api/ops", getOps);
routerAdd("GET", "/api/ym/program", getProgramJoin);   // [260905 통합⑰]
routerAdd("GET", "/api/ym/calendar", getCalendarJoin);   // [260905 통합⑲]
routerAdd("POST", "/api/ym/codes/reindex", postCodesReindex);
routerAdd("GET", "/api/holidays", getHolidays);
routerAdd("GET", "/api/config", getConfig);
routerAdd("GET", "/api/messages", getMessages);
routerAdd("GET", "/api/lastmod", getLastmod);
// These aliases avoid collisions with reserved runtime proxy paths.
routerAdd("GET", "/api/ym/holidays", getHolidays);
routerAdd("GET", "/api/ym/config", getConfig);
routerAdd("GET", "/api/ym/messages", getMessages);
routerAdd("GET", "/api/ym/lastmod", getLastmod);
routerAdd("GET", "/api/presence", getPresence);
routerAdd("GET", "/api/gcal", getGcal);
routerAdd("GET", "/api/monitor/feed", getMonitorFeed);
routerAdd("GET", "/api/visitors", getVisitors);
routerAdd("GET", "/api/memo", getMemo);
routerAdd("GET", "/api/chatbot/faq", getChatbotFaq);
routerAdd("GET", "/api/chatbot/rules", getChatbotRules);
routerAdd("GET", "/api/qa", getQa);
routerAdd("GET", "/api/diagrams", getDiagrams);
routerAdd("POST", "/api/records", postRecords);
routerAdd("PATCH", "/api/records/{rowIndex}", patchRecords);
routerAdd("DELETE", "/api/records/{rowIndex}", deleteRecords);
routerAdd("DELETE", "/api/records", deleteRecords);
routerAdd("DELETE", "/api/records-delete", deleteRecords);
// The runtime proxy rejects custom DELETE verbs on this reserved route family.
// Keep deletion server-side with an explicit action endpoint and rowIndex body.
routerAdd("POST", "/api/records-delete", deleteRecords);
// `/api/records/{rowIndex}` collides with PocketBase's built-in collection route.
// Keep the explicit app-owned path for browser deletes.
routerAdd("POST", "/api/sheet/{slug}", postSheet);
routerAdd("PATCH", "/api/sheet/{slug}/{rowIndex}", patchSheet);
routerAdd("DELETE", "/api/sheet/{slug}/{rowIndex}", deleteSheet);
routerAdd("POST", "/api/ops", postOps);

routerAdd("POST", "/api/ops/row", opsRow);     // [260903 H-4]
routerAdd("PATCH", "/api/ops/row", opsRow);
routerAdd("DELETE", "/api/ops/row", opsRow);
routerAdd("POST", "/api/qa", postQa);
routerAdd("PATCH", "/api/qa", patchQa);
routerAdd("POST", "/api/messages", postMessages);   // [260901] 알림 저장 복구
routerAdd("PATCH", "/api/messages/{id}", patchMessages);
routerAdd("DELETE", "/api/messages/{id}", deleteMessages);
routerAdd("POST", "/api/config", postConfig);
routerAdd("POST", "/api/memo", postMemo);
routerAdd("POST", "/api/presence", postPresence);
routerAdd("POST", "/api/auth/verify-pin", authVerifyPin);
routerAdd("POST", "/api/auth/set-pin", authSetPin);
routerAdd("POST", "/api/ym-db/fix-holidays", fixHolidays);
