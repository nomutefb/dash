// api/ym-views-lib.js — [260904 통합③④·260905 통합⑤⑥] 옛 시트 이름 → 합쳐진 표의 "구분 한 칸" 창구(번역표).
//   합쳐진 표 두 개:
//     ops_운영일정 (날짜·구분·시간)            ← ops_장도(입도가능시간) + ops_카페일정(운영시간)
//     ops_코드표   (구분 + 각 시트의 원래 열)   ← platforms(플랫폼1~3) + contents(콘텐츠구분·콘텐츠형식·진행상태) + applysettings(키·값)
//   앱은 옛 이름(/api/ops?sheet=장도, /api/sheet/platform …)을 그대로 부르고, 훅이 여기서 합쳐진 표의 구분 행만 옛 모양으로 보여 주고 같은 곳에 쓴다.
//   isMigrated(=합쳐진 표의 목록이 있음)가 false 인 환경(발행본)은 옛 경로 그대로(호환 다리).
//   PB 라우트 핸들러는 격리 스코프 → 핸들러 안에서 require(__hooks + "/ym-views-lib.js") 로만 쓴다.
//   [260905 통합⑨] 날짜 열은 표에 YYYYMMDD 로 저장하고, 화면(옛 시트 모양)에는 YYYY-MM-DD 로 돌려준다. 날짜로 못 읽는 값은 그대로 둔다.
//   [260905 통합⑪] 운영일정 표 삭제(이관 017). 장도·카페일정·special 창구는 없앴고(앱도 안 부름), 대관일정(구글 캘린더 대관 2026)은
//     프로그램마스터의 구분=대관 + 캘린더ID≠"" 행이 됐다(프로그램ID 칸 = 일정ID). only 로 그 행만 고르고, stamp 로 새 행의 식별 열을 채운다.
//   [260905 통합⑭] 표마다 키 한 열: 일일실적 실적ID(프로그램ID_YYYYMMDD_구분, 겹치면 -2,-3) · 코드표 코드ID(구분+2자리). 새 행은 dailyStamp/codeStamp 가 채운다(훅 postOps·opsRow·이 창구).
//   [260905 통합⑫] 캘린더 고유 표 ops_캘린더(이관 018): 직원 특이일정(구분=특이일정). 앱의 /api/sheet/special 은 이 표의 창구. 담당자·작성자는 계정NO 로 저장(people).
var PART_COL = "구분";
var VIEWS = {
  // [260905 통합⑲] 코드표 = 한 행 = 코드 하나(구분=목록, 값·세부·짧은이름·순서·사용여부). 목록 화면은 순서로 정렬, 사용여부=중지 는 숨김. 이관 025 뒤(needCol 사용여부)에만 창구.
  "platforms":    { table: "ops_코드표", part: "플랫폼", needCol: "사용여부", cols: [["플랫폼1", "값"], ["플랫폼2", "세부"], ["플랫폼3", "짧은이름"]], autoId: "code", only: function (d) { return nz(d["사용여부"]) !== "중지"; }, sort: "순서" },
  "contents":     { table: "ops_코드표", needCol: "사용여부", zip: [["콘텐츠구분", "콘텐츠구분"], ["콘텐츠형식", "콘텐츠형식"], ["진행상태", "진행상태"]], cols: [["콘텐츠구분", "값"], ["콘텐츠형식", "값"], ["진행상태", "값"]] },   // 옛 시트 모양: 독립 목록 3개를 i번째끼리 나란히
  "applysettings":{ table: "ops_코드표", part: "신청설정", needCol: "사용여부", cols: [["키", "값"], ["값", "세부"]], autoId: "code", only: function (d) { return nz(d["사용여부"]) !== "중지"; }, sort: "순서" },
  // [260905 통합⑪] 대관일정(구글 캘린더 대관, 2026) → 프로그램마스터 구분=대관 행(캘린더ID 가 있는 행만). 옛 16열 모양 그대로.
  "대관일정":     { table: "ops_프로그램마스터", part: "대관", parts: ["대관", "기획"], needCol: "캘린더ID", only: function (d) { return nz(d["캘린더ID"]) !== ""; },
    cols: [["일정ID","프로그램ID"],["명칭","정본명"],["구분","구분"],["장소","장소"],["시작일","시작일"],["종료일","종료일"],["공연일","공연일"],["리허설일","리허설일"],["종일","종일"],["시작시간","시작시간"],["종료시간","종료시간"],["비고","비고"],["출처","캘린더ID"],["원제목","원제목"],["입력시간(KST)","입력시간(KST)"],["작성자","작성자"]],
    dates: ["시작일", "종료일", "공연일", "리허설일"],
    // [260905 대관 병합] 프로그램 행과 합쳤진 대관(이관 032): 캘린더는 대관기간(셋업 포함) 으로, 장소는 프로그램 장소 이름을 캘린더 태그(장도·7층·야외)로.
    read: function (d, row) { var sp = nz(d["대관기간"]).split("~"); if (sp.length === 2 && /^\d{8}$/.test(sp[0]) && /^\d{8}$/.test(sp[1])) { row["시작일"] = toIso(sp[0]); row["종료일"] = toIso(sp[1]); } var pl = {"장도 전시실":"장도","7층 전시실":"7층","장도 야외":"야외","장도 야외 광장":"야외","장도 야외 일원":"야외","예울마루 야외 일원":"야외"}; /* [260905 이관 041] 장소 표기 통일 반영 */ if (pl[nz(row["장소"])]) row["장소"] = pl[nz(row["장소"])]; },
    stamp: function (d) { if (!nz(d["캘린더ID"])) d["캘린더ID"] = "gcal:" + nz(d["프로그램ID"]); d["사업코드"] = nz(d["사업코드"]); if (!nz(d["출처"])) d["출처"] = "캘린더"; if (!nz(d["매칭근거"])) d["매칭근거"] = "대관일정"; if (!nz(d["상태"])) d["상태"] = "정상"; if (!nz(d["카테고리"])) d["카테고리"] = "대관공연"; if (!nz(d["표시_구분"])) d["표시_구분"] = "대관"; if (!nz(d["표시_분야"])) d["표시_분야"] = "공연"; if (!nz(d["부문코드"])) d["부문코드"] = "1"; var y = nz(d["시작일"]).slice(0, 4); if (y.length === 4) d["연도"] = y; } },
  // [260905 통합⑫] special(직원 특이일정) → ops_캘린더 구분=특이일정. 시리얼→일정ID, 날짜 YYYYMMDD, 담당자·작성자는 계정NO.
  "special":      { table: "ops_캘린더", part: "특이일정", cols: [["#","순번"],["입력시간(KST)","입력시간"],["시리얼","일정ID"],["시작일","시작일"],["종료일","종료일"],["시간","시간"],["유형","유형"],["내용","내용"],["담당자","담당자"],["작성자","작성자"],["비고","비고"]], dates: ["시작일", "종료일"], people: ["담당자", "작성자"] },
  // [260905 통합⑥] 세부운영관리대장정리(2012~ 회차별 발권 2,294행) → 일일실적의 구분 행(회차발권). 년도·월·일 은 기준일자(YYYY-MM-DD) 한 칸으로 저장, 뷰에서 다시 펼침.
  "세부운영관리대장정리": { table: "ops_일일실적", part: "회차발권", cols: [["전체순번","전체순번"],["공연명","명칭"],["사업구분","사업구분"],["공연구분","공연구분"],["장르1","장르1"],["티켓구분","티켓구분"],["기본좌석","기본좌석"],["발권유료","발권유료"],["년도","기준일자"],["월","기준일자"],["일","기준일자"],["상태","상태"],["공연ID","프로그램ID"],["발권초대","발권초대"],["사업코드","사업코드"]],
    read: function (d, row) { var k = String(d["기준일자"] || "").replace(/[^0-9]/g, ""); var ok = /^\d{8}$/.test(k); row["년도"] = ok ? String(+k.slice(0, 4)) : ""; row["월"] = ok ? String(+k.slice(4, 6)) : ""; row["일"] = ok ? String(+k.slice(6, 8)) : ""; },
    write: function (vals, out) { var y = String(vals["년도"] || "").trim(), mo = String(vals["월"] || "").trim(), da = String(vals["일"] || "").trim(); if (y && mo && da) out["기준일자"] = y + ("0" + mo).slice(-2) + ("0" + da).slice(-2); else delete out["기준일자"]; },
    autoId: "daily" },
};
var TABLE_HEADERS = {"ops_캘린더":["일정ID","구분","시작일","종료일","시간","유형","내용","담당자","작성자","비고","입력시간","순번","프로그램ID","플랫폼1","플랫폼2","콘텐츠구분","프로그램","담당부서","제목","형식","상태","결과링크","결과첨부URL","결과비고","직전상태","상태변경시각","보류사유","재신청사유","취소사유","플랫폼코드","형식코드","콘텐츠구분코드"],"ops_코드표":["코드ID","구분","값","세부","짧은이름","순서","사용여부","별칭","비고"],"ops_일일실적":["실적ID","프로그램ID","구분","명칭","기준일자","누계유료","유료금액","누계무료","누계총인원","누계금액","점유율","전일대비(석)","예측제외","일일유료","일일무료","일일총인원","일일금액","전체순번","사업구분","공연구분","장르1","티켓구분","기본좌석","발권유료","발권초대","상태","사업코드"]};
function quote(v) { return String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\" + "'"); }
function nz(v) { return String(v === undefined || v === null ? "" : v).trim(); }
function jsonValue(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch (err2) { return fallback; } }
  return raw;
}
// [260905 통합⑨] 날짜 변환. 쉼표로 여러 날짜가 든 칸(공연일)은 하나씩. 못 읽는 값은 그대로.
function d8one(s) { s = nz(s); if (!s) return ""; var m = s.match(/^(\d{4})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})일?$/) || s.match(/^(\d{4})(\d{2})(\d{2})$/); if (m) return m[1] + ("0" + m[2]).slice(-2) + ("0" + m[3]).slice(-2); var n = Number(s); if (/^\d{5}$/.test(s) && n > 20000 && n < 80000) { var d = new Date(Math.round((n - 25569) * 86400000)); var p = function (x) { return (x < 10 ? "0" : "") + x; }; return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()); } return s; }   // 날짜 하나(또는 엑셀 일련번호)만 바꾼다. 시간·범위가 붙은 값은 그대로.
function isoOne(s) { s = nz(s); var m = s.match(/^(\d{4})(\d{2})(\d{2})$/); return m ? m[1] + "-" + m[2] + "-" + m[3] : s; }
function mapList(v, f) { var s = nz(v); if (!s) return ""; return s.split(",").map(function (x) { return f(x); }).join(","); }
function toD8(v) { return mapList(v, d8one); }
function toIso(v) { return mapList(v, isoOne); }
function isDateCol(v, viewCol) { return !!(v.dates && v.dates.indexOf(viewCol) >= 0); }
// [260905 통합⑫] 담당자 명단 계정NO ↔ 이름(ym-acct-lib 과 같은 규칙; 격리 스코프라 여기 둔다)
var ACCT_NO_RE = /^\d{3,}$/;
function acctMaps(app, col) {
  var m = { on: false, byNo: {}, byName: {} };
  var mm = app.findRecordsByFilter(col("ymmeta"), "sheet = 'managers'", "", 1, 0); if (!(mm && mm.length)) return m;
  var mh = jsonValue(mm[0].get("headers"), []); if (!Array.isArray(mh) || mh.indexOf("계정NO") < 0) return m;
  m.on = true;
  var recs = app.findRecordsByFilter(col("ymdata"), "sheet = 'managers'", "rowIndex", 50000, 0);
  for (var i = 0; i < recs.length; i++) { var d = jsonValue(recs[i].publicExport().data, {}) || {}; var no = nz(d["계정NO"]), name = nz(d["담당자"]); if (no && name) { m.byNo[no] = name; if (!m.byName[name]) m.byName[name] = no; } }
  return m;
}
function acctName(m, v) { var raw = (v === undefined || v === null) ? "" : String(v); if (!m.on) return raw; var s = nz(raw); if (!s || !ACCT_NO_RE.test(s)) return raw; return Object.prototype.hasOwnProperty.call(m.byNo, s) ? m.byNo[s] : raw; }
function acctNo(m, v) { var raw = (v === undefined || v === null) ? "" : String(v); if (!m.on) return raw; var s = nz(raw); if (!s) return ""; if (ACCT_NO_RE.test(s)) return s; return Object.prototype.hasOwnProperty.call(m.byName, s) ? m.byName[s] : raw; }
function peopleOut(app, col, name, row) { var v = VIEWS[name]; if (!v.people) return row; var m = acctMaps(app, col); for (var i = 0; i < v.people.length; i++) if (Object.prototype.hasOwnProperty.call(row, v.people[i])) row[v.people[i]] = acctName(m, row[v.people[i]]); return row; }
function peopleIn(app, col, name, out) { var v = VIEWS[name]; if (!v.people) return out; var m = acctMaps(app, col), idx = {}; for (var c = 0; c < v.cols.length; c++) idx[v.cols[c][0]] = v.cols[c][1]; for (var i = 0; i < v.people.length; i++) { var k = idx[v.people[i]]; if (k && Object.prototype.hasOwnProperty.call(out, k)) out[k] = acctNo(m, out[k]); } return out; }
// [260905 통합⑭] 키 한 열 채우기. seen = { ids: {} } 를 넘기면 같은 요청 안에서도 겹치지 않는다(없으면 표를 읽어 만든다).
function d8raw(v) { var s = nz(v).replace(/[^0-9]/g, ""); return /^\d{8}$/.test(s) ? s : nz(v); }
function idSet(app, col, table, idCol, seen) {
  if (seen && seen.ids) return seen.ids;
  var ids = {}, recs = app.findRecordsByFilter(col("ymdata"), "sheet = '" + table + "'", "rowIndex", 50000, 0);
  for (var i = 0; i < recs.length; i++) { var v = nz(rowData(recs[i])[idCol]); if (v) ids[v] = 1; }
  if (seen) seen.ids = ids;
  return ids;
}
// 일일실적: 기준일자 → YYYYMMDD, 실적ID 가 비었으면 프로그램ID_YYYYMMDD_구분(겹치면 -2, -3 …)
function dailyStamp(app, col, d, seen) {
  if (Object.prototype.hasOwnProperty.call(d, "기준일자")) d["기준일자"] = d8raw(d["기준일자"]);
  if (nz(d["실적ID"])) return d;
  var ids = idSet(app, col, "ops_일일실적", "실적ID", seen);
  var base = (nz(d["프로그램ID"]) || "NOID") + "_" + nz(d["기준일자"]) + "_" + nz(d["구분"]), id = base, n = 2;
  while (ids[id]) { id = base + "-" + n; n++; }
  ids[id] = 1; d["실적ID"] = id; return d;
}
// [260905 통합⑮] 일일실적.프로그램ID 는 프로그램마스터에 있어야 한다(운영자 "일일실적 프로그램ID가 마스터랑 참조되게"). seen.master 에 집합을 캐시.
function masterIds(app, col, seen) {
  if (seen && seen.master) return seen.master;
  var ids = {}, recs = app.findRecordsByFilter(col("ymdata"), "sheet = 'ops_프로그램마스터'", "rowIndex", 50000, 0);
  for (var i = 0; i < recs.length; i++) { var v = nz(rowData(recs[i])["프로그램ID"]); if (v) ids[v] = 1; }
  if (seen) seen.master = ids;
  return ids;
}
function dailyRefError(app, col, d, seen) {
  var id = nz(d["프로그램ID"]);
  if (!id) return "프로그램ID required (일일실적 행은 프로그램마스터 행을 가리켜야 함)";
  if (!masterIds(app, col, seen)[id]) return "프로그램ID not in 프로그램마스터: " + id;
  return null;
}
// 코드표: 코드ID(접두어+3자리 영구 순번)·사용여부·순서 채우기 — [통합⑲] ym-codes-lib.stampCode
function codeStamp(app, col, d, seen) { return require(__hooks + "/ym-codes-lib.js").stampCode(app, col, d); }
function has(name) { return Object.prototype.hasOwnProperty.call(VIEWS, name); }
function metaOf(app, col, sheet) {
  var rows = app.findRecordsByFilter(col("ymmeta"), "sheet = '" + quote(sheet) + "'", "", 1, 0);
  return rows && rows.length ? rows[0] : null;
}
function isMigrated(app, col, name) { var v = VIEWS[name]; if (!v) return false; var m = metaOf(app, col, v.table); if (!m) return false; if (v.needCol) { var h = jsonValue(m.get("headers"), []); return Array.isArray(h) && h.indexOf(v.needCol) >= 0; } return true; }   // [통합⑪] needCol: 그 열이 생긴 뒤에만 창구
function rowData(rec) { var d = jsonValue(rec.publicExport().data, {}); return (d && typeof d === "object" && !Array.isArray(d)) ? d : {}; }
function headersOf(name) { return VIEWS[name].cols.map(function (c) { return c[0]; }); }
function toView(name, d) { var v = VIEWS[name], o = {}, cs = v.cols; for (var i = 0; i < cs.length; i++) { var x = d[cs[i][1]]; x = (x === undefined || x === null) ? "" : String(x); if (isDateCol(v, cs[i][0])) x = toIso(x); o[cs[i][0]] = x; } if (typeof v.read === "function") v.read(d, o); return o; }
// 옛 시트 모양 목록(구분 행만). withIndex 면 _rowIndex(합쳐진 표의 rowIndex).
function list(app, col, name, withIndex) {
  var v = VIEWS[name]; v._am = null;
  if (v.zip) return zipList(app, col, name, withIndex);   // [통합⑲] 독립 목록 여러 개를 나란히
  var recs;
  if(name==="세부운영관리대장정리"&&!withIndex){
    try{var keys=v.cols.map(function(c){return c[1];}).concat([PART_COL]);var docs=require(__hooks+"/ym-read-rows-lib.js").read(app,col,v.table,keys.filter(function(k,i,a){return a.indexOf(k)===i;}),[v.part]);recs=docs.map(function(d){return {publicExport:function(){return {data:d};}};});}
    catch(e){recs=app.findRecordsByFilter(col("ymdata"),"sheet = '"+v.table+"'","rowIndex",50000,0);}
  }else recs = app.findRecordsByFilter(col("ymdata"), "sheet = '" + v.table + "'", "rowIndex", 50000, 0);
  var out = [];
  var __dj = (v.table === "ops_일일실적") ? require(__hooks + "/ym-daily-join-lib.js") : null, __djm = null;   // [260905 통합㉓] 명칭·사업코드는 마스터에서
  if (__dj && __dj.isMigrated(app, col)) __djm = __dj.masterMap(app, col).map;
  if (v.sort) { var sk = v.sort; recs = recs.slice().sort(function (a, b) { var x = parseFloat(rowData(a)[sk]), y = parseFloat(rowData(b)[sk]); if (isNaN(x)) x = 1e9; if (isNaN(y)) y = 1e9; return x !== y ? x - y : ((a.get("rowIndex") || 0) - (b.get("rowIndex") || 0)); }); }   // [통합⑲] 순서 열
  for (var i = 0; i < recs.length; i++) {
    var d = rowData(recs[i]);
    if (__djm) __dj.fill([d], __djm);   // [260905 통합㉓]
    if (v.parts ? v.parts.indexOf(nz(d[PART_COL])) < 0 : nz(d[PART_COL]) !== v.part) continue;   // [260905 대관 병합 2] parts 가 있으면 여러 구분
    if (typeof v.only === "function" && !v.only(d)) continue;   // [통합⑪] 같은 구분 안에서 이 창구의 행만
    var row = toView(name, d), any = false;
    for (var k in row) if (row[k].trim() !== "") { any = true; break; }
    if (v.people && any) { if (!v._am) v._am = acctMaps(app, col); for (var pi = 0; pi < v.people.length; pi++) row[v.people[pi]] = acctName(v._am, row[v.people[pi]]); }   // [통합⑫] 계정NO → 이름 (v._am 은 이 호출 안에서만 씀)
    if (!any) continue;
    if (withIndex) row._rowIndex = recs[i].get("rowIndex");
    out.push(row);
  }
  return out;
}
// [통합⑲] zip 창구(contents): 목록마다 사용 중인 코드의 값을 순서대로 뽑아 i번째끼리 한 행. _rowIndex 는 없음(행이 실체가 아니라서 수정·삭제 불가).
function zipList(app, col, name, withIndex) {
  var v = VIEWS[name], C = require(__hooks + "/ym-codes-lib.js"), cache = C.load(app, col), cols = [], maxLen = 0;
  for (var i = 0; i < v.zip.length; i++) { var rows = C.active(cache.lists[v.zip[i][1]] || []), vals = []; for (var r = 0; r < rows.length; r++) { var x = nz(rows[r]["값"]); if (x) vals.push(x); } cols.push(vals); if (vals.length > maxLen) maxLen = vals.length; }
  var out = [];
  for (var k = 0; k < maxLen; k++) { var row = {}; for (var c = 0; c < v.zip.length; c++) row[v.zip[c][0]] = k < cols[c].length ? cols[c][k] : ""; out.push(row); }   // _rowIndex 없음(실체 행이 아님)
  return out;
}
// /api/ops?sheet=옛이름 응답 모양
function opsView(app, col, name) { var rows = list(app, col, name, false); return { sheet: "운영_" + name, headers: headersOf(name), rows: rows, count: rows.length, via: VIEWS[name].table }; }
// body → {합쳐진 표 열: 값}. values 배열이면 옛 헤더 순서. promoFlag/sideCells 는 여기 없음(프로그램 전용).
function fromBody(name, body) {
  var v = VIEWS[name], hs = headersOf(name), vals = {}, i;
  var values = body && body.values;
  if (Array.isArray(values)) { for (i = 0; i < hs.length && i < values.length; i++) vals[hs[i]] = values[i]; }
  else if (values && typeof values === "object") { var ks = Object.keys(values); for (i = 0; i < ks.length; i++) vals[ks[i]] = values[ks[i]]; }
  var ek = Object.keys(body || {});
  for (i = 0; i < ek.length; i++) { var k = ek[i]; if (k === "values" || k === "headers") continue; vals[k] = body[k]; }
  var out = {};
  for (i = 0; i < v.cols.length; i++) { var vk = v.cols[i][0]; if (!Object.prototype.hasOwnProperty.call(vals, vk)) continue; var x = vals[vk]; x = (x === undefined || x === null) ? "" : x; if (isDateCol(v, vk)) x = toD8(x); out[v.cols[i][1]] = x; }
  if (typeof v.write === "function") v.write(vals, out);
  if (v.keyFrom && Object.prototype.hasOwnProperty.call(out, v.keyFrom)) out["날짜"] = toD8(out[v.keyFrom]).split(",")[0];   // [통합⑨] 표의 키(날짜) = 시작일(첫 날짜 하나)
  return out;
}
function touchLastmod(app, col) {
  var metaCol = col("ymmeta");
  var rows = app.findRecordsByFilter(metaCol, "sheet = '_lastmod'", "", 1, 0);
  if (rows && rows.length) { rows[0].set("source", new Date().toISOString()); app.save(rows[0]); }
  else app.save(new Record(metaCol, { sheet: "_lastmod", headers: [], source: new Date().toISOString(), rowCount: 0, nextRowIndex: 0 }));
}
function create(app, col, name, body) {
  var v = VIEWS[name], meta = metaOf(app, col, v.table); if (!meta) return { error: "표 없음: " + v.table, status: 500 };
  if (v.zip) {   // [통합⑲] contents: 보낸 칸마다 그 목록에 코드 행 하나씩(이미 있는 값은 건너뜀)
    var C2 = require(__hooks + "/ym-codes-lib.js"), zc = C2.load(app, col), made = [], hz = jsonValue(meta.get("headers"), []), nz2 = meta.get("nextRowIndex") || 2;
    for (var zi = 0; zi < v.zip.length; zi++) { var val = nz((body && body.values && !Array.isArray(body.values)) ? body.values[v.zip[zi][0]] : (Array.isArray(body && body.values) ? body.values[zi] : (body || {})[v.zip[zi][0]])); if (!val) continue; if (C2.codeOf(zc, v.zip[zi][1], val, "")) continue; var zd = {}; for (var zh = 0; zh < hz.length; zh++) zd[hz[zh]] = ""; zd["구분"] = v.zip[zi][1]; zd["값"] = val; codeStamp(app, col, zd, null); app.save(new Record(col("ymdata"), { sheet: v.table, rowIndex: nz2, data: zd })); made.push(zd["코드ID"]); nz2++; }
    meta.set("rowCount", (meta.get("rowCount") || 0) + made.length); meta.set("nextRowIndex", nz2); app.save(meta); touchLastmod(app, col);
    return { ok: true, created: made, rowIndex: nz2 - 1, row: nz2 - 1 };
  }
  var hs = jsonValue(meta.get("headers"), []); if (!Array.isArray(hs)) hs = TABLE_HEADERS[v.table];
  var d = {}; for (var i = 0; i < hs.length; i++) d[hs[i]] = "";
  var p = peopleIn(app, col, name, fromBody(name, body)); var pk = Object.keys(p); for (var j = 0; j < pk.length; j++) d[pk[j]] = p[pk[j]];   // [통합⑫] 이름 → 계정NO
  d[PART_COL] = v.part;
  if (v.autoId === "daily") { dailyStamp(app, col, d, null); var __re = dailyRefError(app, col, d, null); if (__re) return { error: __re, status: 409 }; } else if (v.autoId === "code") codeStamp(app, col, d, null);   // [통합⑭][통합⑮]
  if (typeof v.stamp === "function") { if (!nz(d["프로그램ID"])) return { error: "일정ID required", status: 400 }; var dupe = app.findRecordsByFilter(col("ymdata"), "sheet = '" + v.table + "'", "rowIndex", 50000, 0); for (var q = 0; q < dupe.length; q++) if (nz(rowData(dupe[q])["프로그램ID"]) === nz(d["프로그램ID"])) return { error: "duplicate 일정ID: " + nz(d["프로그램ID"]), status: 409 }; v.stamp(d); }   // [통합⑪] 마스터 행은 프로그램ID 가 키
  var nri = meta.get("nextRowIndex") || 2;
  app.save(new Record(col("ymdata"), { sheet: v.table, rowIndex: nri, data: d }));
  meta.set("rowCount", (meta.get("rowCount") || 0) + 1); meta.set("nextRowIndex", nri + 1); app.save(meta);
  touchLastmod(app, col);
  return { ok: true, rowIndex: nri, row: nri };
}
// 구분이 맞는 행만 찾는다(옛 rowIndex 로 온 요청이 다른 구분 행을 건드리지 못하게)
function findRow(app, col, name, rowIdx) {
  var v = VIEWS[name], n = parseInt(rowIdx, 10); if (!(n > 0)) return null;
  var recs = app.findRecordsByFilter(col("ymdata"), "sheet = '" + v.table + "' && rowIndex = " + n, "", 1, 0);
  if (!(recs && recs.length)) return null;
  var d0 = rowData(recs[0]); if (nz(d0[PART_COL]) !== v.part) return null; if (typeof v.only === "function" && !v.only(d0)) return null;   // [통합⑪]
  return recs[0];
}
function patch(app, col, name, rowIdx, body) {
  if (VIEWS[name].zip) return { error: name + " 은 목록 3개를 나란히 보여 주는 화면이라 행 단위 수정이 없음 — 코드표(ops_코드표)의 해당 코드 행을 고칠 것", status: 409 };   // [통합⑲]
  var rec = findRow(app, col, name, rowIdx); if (!rec) return null;
  var d = rowData(rec), p = peopleIn(app, col, name, fromBody(name, body)), ks = Object.keys(p);   // [통합⑫]
  for (var i = 0; i < ks.length; i++) d[ks[i]] = p[ks[i]];
  d[PART_COL] = VIEWS[name].part;
  if (VIEWS[name].autoId === "daily") { dailyStamp(app, col, d, null); var __re2 = dailyRefError(app, col, d, null); if (__re2) return { error: __re2, status: 409 }; } else if (VIEWS[name].autoId === "code") codeStamp(app, col, d, null);   // [통합⑭][통합⑮]
  if (typeof VIEWS[name].stamp === "function") VIEWS[name].stamp(d);   // [통합⑪]
  rec.set("data", d); app.save(rec); touchLastmod(app, col);
  return { ok: true };
}
function remove(app, col, name, rowIdx) {
  if (VIEWS[name].zip) return null;   // [통합⑲] contents 행은 실체가 아님 → 404
  var rec = findRow(app, col, name, rowIdx); if (!rec) return null;
  app.delete(rec);
  var meta = metaOf(app, col, VIEWS[name].table); if (meta) { meta.set("rowCount", Math.max(0, (meta.get("rowCount") || 0) - 1)); app.save(meta); }
  touchLastmod(app, col);
  return { ok: true };
}
module.exports = { dailyRefError: dailyRefError, masterIds: masterIds, dailyStamp: dailyStamp, codeStamp: codeStamp, d8raw: d8raw, toD8: toD8, toIso: toIso, VIEWS: VIEWS, TABLE_HEADERS: TABLE_HEADERS, PART_COL: PART_COL, has: has, isMigrated: isMigrated, headersOf: headersOf, list: list, opsView: opsView, fromBody: fromBody, create: create, patch: patch, remove: remove };
