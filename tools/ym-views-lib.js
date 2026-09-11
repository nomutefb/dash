// api/ym-views-lib.js — [260904 통합③④·260905 통합⑤⑥] 옛 시트 이름 → 합쳐진 표의 "구분 한 칸" 창구(번역표).
//   합쳐진 표 두 개:
//     ops_운영일정 (날짜·구분·시간)            ← ops_장도(입도가능시간) + ops_카페일정(운영시간)
//     ops_코드표   (구분 + 각 시트의 원래 열)   ← platforms(플랫폼1~3) + contents(콘텐츠구분·콘텐츠형식·진행상태) + applysettings(키·값)
//   앱은 옛 이름(/api/ops?sheet=장도, /api/sheet/platform …)을 그대로 부르고, 훅이 여기서 합쳐진 표의 구분 행만 옛 모양으로 보여 주고 같은 곳에 쓴다.
//   isMigrated(=합쳐진 표의 목록이 있음)가 false 인 환경(발행본)은 옛 경로 그대로(호환 다리).
//   PB 라우트 핸들러는 격리 스코프 → 핸들러 안에서 require(__hooks + "/ym-views-lib.js") 로만 쓴다.
var PART_COL = "구분";
var VIEWS = {
  "장도":         { table: "ops_운영일정", part: "장도", cols: [["날짜", "날짜"], ["입도가능시간", "시간"]] },
  "카페일정":     { table: "ops_운영일정", part: "카페", cols: [["날짜", "날짜"], ["운영시간", "시간"]] },
  "platforms":    { table: "ops_코드표", part: "platforms", cols: [["플랫폼1", "플랫폼1"], ["플랫폼2", "플랫폼2"], ["플랫폼3", "플랫폼3"]] },
  "contents":     { table: "ops_코드표", part: "contents", cols: [["콘텐츠구분", "콘텐츠구분"], ["콘텐츠형식", "콘텐츠형식"], ["진행상태", "진행상태"]] },
  "applysettings":{ table: "ops_코드표", part: "applysettings", cols: [["키", "키"], ["값", "값"]] },
  // [260905 통합⑤] 대관일정(구글 캘린더 편입 대관 292행) · special(직원 특이일정 33행) → 운영일정의 구분 행(열은 원래 이름 그대로 합집합)
  "대관일정":     { table: "ops_운영일정", part: "대관", cols: [["일정ID","일정ID"],["명칭","명칭"],["구분","구분"],["장소","장소"],["시작일","시작일"],["종료일","종료일"],["공연일","공연일"],["리허설일","리허설일"],["종일","종일"],["시작시간","시작시간"],["종료시간","종료시간"],["비고","비고"],["출처","출처"],["원제목","원제목"],["입력시간(KST)","입력시간(KST)"],["작성자","작성자"]] },
  "special":      { table: "ops_운영일정", part: "특이일정", cols: [["#","#"],["입력시간(KST)","입력시간(KST)"],["시리얼","시리얼"],["시작일","시작일"],["종료일","종료일"],["시간","시간"],["유형","유형"],["내용","내용"],["담당자","담당자"],["작성자","작성자"],["비고","비고"]] },
  // [260905 통합⑥] 세부운영관리대장정리(2012~ 회차별 발권 2,294행) → 일일실적의 구분 행(회차발권). 년도·월·일 은 기준일자(YYYY-MM-DD) 한 칸으로 저장, 뷰에서 다시 펼침.
  "세부운영관리대장정리": { table: "ops_일일실적", part: "회차발권", cols: [["전체순번","전체순번"],["공연명","명칭"],["사업구분","사업구분"],["공연구분","공연구분"],["장르1","장르1"],["티켓구분","티켓구분"],["기본좌석","기본좌석"],["발권유료","발권유료"],["년도","기준일자"],["월","기준일자"],["일","기준일자"],["상태","상태"],["공연ID","프로그램ID"],["발권초대","발권초대"],["사업코드","사업코드"]],
    read: function (d, row) { var k = String(d["기준일자"] || ""); var m = k.match(/^(\d{4})-(\d{2})-(\d{2})/); row["년도"] = m ? String(+m[1]) : ""; row["월"] = m ? String(+m[2]) : ""; row["일"] = m ? String(+m[3]) : ""; },
    write: function (vals, out) { var y = String(vals["년도"] || "").trim(), mo = String(vals["월"] || "").trim(), da = String(vals["일"] || "").trim(); if (y && mo && da) out["기준일자"] = y + "-" + ("0" + mo).slice(-2) + "-" + ("0" + da).slice(-2); else delete out["기준일자"]; } }
};
var TABLE_HEADERS = {"ops_운영일정":["날짜","구분","시간","일정ID","명칭","장소","시작일","종료일","공연일","리허설일","종일","시작시간","종료시간","비고","출처","원제목","입력시간(KST)","작성자","#","시리얼","유형","내용","담당자"],"ops_코드표":["구분","플랫폼1","플랫폼2","플랫폼3","콘텐츠구분","콘텐츠형식","진행상태","키","값"],"ops_일일실적":["프로그램ID","구분","명칭","기준일자","누계유료","유료금액","누계무료","누계총인원","누계금액","점유율","전일대비(석)","예측제외","일일유료","일일무료","일일총인원","일일금액","전체순번","사업구분","공연구분","장르1","티켓구분","기본좌석","발권유료","발권초대","상태","사업코드"]};
function quote(v) { return String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\" + "'"); }
function nz(v) { return String(v === undefined || v === null ? "" : v).trim(); }
function jsonValue(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch (err2) { return fallback; } }
  return raw;
}
function has(name) { return Object.prototype.hasOwnProperty.call(VIEWS, name); }
function metaOf(app, col, sheet) {
  var rows = app.findRecordsByFilter(col("ymmeta"), "sheet = '" + quote(sheet) + "'", "", 1, 0);
  return rows && rows.length ? rows[0] : null;
}
function isMigrated(app, col, name) { var v = VIEWS[name]; return !!(v && metaOf(app, col, v.table)); }
function rowData(rec) { var d = jsonValue(rec.publicExport().data, {}); return (d && typeof d === "object" && !Array.isArray(d)) ? d : {}; }
function headersOf(name) { return VIEWS[name].cols.map(function (c) { return c[0]; }); }
function toView(name, d) { var v = VIEWS[name], o = {}, cs = v.cols; for (var i = 0; i < cs.length; i++) { var x = d[cs[i][1]]; o[cs[i][0]] = (x === undefined || x === null) ? "" : String(x); } if (typeof v.read === "function") v.read(d, o); return o; }
// 옛 시트 모양 목록(구분 행만). withIndex 면 _rowIndex(합쳐진 표의 rowIndex).
function list(app, col, name, withIndex) {
  var v = VIEWS[name];
  var recs = app.findRecordsByFilter(col("ymdata"), "sheet = '" + v.table + "'", "rowIndex", 50000, 0);
  var out = [];
  for (var i = 0; i < recs.length; i++) {
    var d = rowData(recs[i]);
    if (nz(d[PART_COL]) !== v.part) continue;
    var row = toView(name, d), any = false;
    for (var k in row) if (row[k].trim() !== "") { any = true; break; }
    if (!any) continue;
    if (withIndex) row._rowIndex = recs[i].get("rowIndex");
    out.push(row);
  }
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
  for (i = 0; i < v.cols.length; i++) { var vk = v.cols[i][0]; if (!Object.prototype.hasOwnProperty.call(vals, vk)) continue; var x = vals[vk]; out[v.cols[i][1]] = (x === undefined || x === null) ? "" : x; }
  if (typeof v.write === "function") v.write(vals, out);
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
  var hs = jsonValue(meta.get("headers"), []); if (!Array.isArray(hs)) hs = TABLE_HEADERS[v.table];
  var d = {}; for (var i = 0; i < hs.length; i++) d[hs[i]] = "";
  var p = fromBody(name, body); var pk = Object.keys(p); for (var j = 0; j < pk.length; j++) d[pk[j]] = p[pk[j]];
  d[PART_COL] = v.part;
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
  return nz(rowData(recs[0])[PART_COL]) === v.part ? recs[0] : null;
}
function patch(app, col, name, rowIdx, body) {
  var rec = findRow(app, col, name, rowIdx); if (!rec) return null;
  var d = rowData(rec), p = fromBody(name, body), ks = Object.keys(p);
  for (var i = 0; i < ks.length; i++) d[ks[i]] = p[ks[i]];
  d[PART_COL] = VIEWS[name].part;
  rec.set("data", d); app.save(rec); touchLastmod(app, col);
  return { ok: true };
}
function remove(app, col, name, rowIdx) {
  var rec = findRow(app, col, name, rowIdx); if (!rec) return null;
  app.delete(rec);
  var meta = metaOf(app, col, VIEWS[name].table); if (meta) { meta.set("rowCount", Math.max(0, (meta.get("rowCount") || 0) - 1)); app.save(meta); }
  touchLastmod(app, col);
  return { ok: true };
}
module.exports = { VIEWS: VIEWS, TABLE_HEADERS: TABLE_HEADERS, PART_COL: PART_COL, has: has, isMigrated: isMigrated, headersOf: headersOf, list: list, opsView: opsView, fromBody: fromBody, create: create, patch: patch, remove: remove };
