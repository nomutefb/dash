// api/ym-sales-lib.js — [260904 통합②] 판매설정 시트 → 프로그램마스터 열 창구(번역표).
//   판매설정(프로그램당 1행, 공연/전시)을 프로그램마스터에 열로 합친 뒤, 앱이 부르는
//     GET  /api/ops?sheet=판매설정                      → 마스터 중 판매구분≠'' 행을 옛 27열 모양으로
//     POST/PATCH/DELETE /api/ops/row {sheet:'판매설정'}  → 같은 마스터 행에 쓰기(프로그램ID 키)
//     POST /api/ops {sheet:'판매설정', mode:'upsert'|'append'} → 행마다 위와 같음
//   앱 코드는 안 고친다. 마스터에 판매구분 열이 없는 환경(발행본)은 isMigrated=false → 옛 경로(호환 다리).
//   날짜: 마스터 YYYYMMDD ↔ 화면 YYYY-MM-DD. 격리 스코프 → 핸들러 안에서 require(__hooks + "/ym-sales-lib.js").
var MASTER = "ops_프로그램마스터";
var PART_COL = "판매구분";
// [옛 판매설정 열, 마스터 열, 날짜여부, 읽기전용] — 옛 헤더 순서 그대로. 읽기전용(4번째 1) 은 화면엔 내보내되 쓰기는 무시.
//   [260905 통합㉒ · 이관 028] 기준명 → 정본명(중복 열 삭제), 목표관객 → 마스터 열 없음(027 에서 빈 열 삭제; 화면엔 "" 유지).
var MAP = [["프로그램ID","프로그램ID"],["구분","판매구분"],["명칭","정본명"],["기준석","기준석"],["총회차","총회차"],["총오픈석","총오픈석"],["목표점유율","목표점유율"],["수익성","수익성"],["티켓오픈일","티켓오픈일",1],["종료일","종료일",1],["시작일","시작일",1],["상태","판매상태"],["사업코드","사업코드"],["연도","연도"],["운영일수","운영일수"],["목표관객",null,0,1],["목표금액","목표금액"],["최종유료","최종유료"],["최종무료","최종무료"],["최종총인원","최종총인원"],["최종매출","최종매출"],["최종점유율","최종점유율"],["무료여부","무료여부"],["장소","장소"],["구ID","구ID"],["기준명","정본명",0,1],["공연일목록","공연일목록"]];
var HEADERS = MAP.map(function (m) { return m[0]; });
// 판매설정 전용 열(마스터 본래 열 아님) — ensureHeaders 가 보장하고 removeById 가 비운다. 마스터 본래 열(정본명·시작일·종료일·장소·연도…)은 여기 넣지 않는다.
var NEW_MASTER_COLS = ["판매구분","판매명칭","기준석","총회차","총오픈석","목표점유율","티켓오픈일","판매상태","운영일수","목표금액","최종유료","최종무료","최종총인원","최종매출","최종점유율","공연일목록"];
function quote(v) { return String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\" + "'"); }
function nz(v) { return String(v === undefined || v === null ? "" : v).trim(); }
function jsonValue(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch (err2) { return fallback; } }
  return raw;
}
function toD8(v) {
  var s = nz(v); if (!s) return "";
  var m = s.match(/^(\d{4})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})/) || s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return m[1] + ("0" + m[2]).slice(-2) + ("0" + m[3]).slice(-2);
  var n = Number(s);
  if (n > 20000 && n < 80000) { var d = new Date(Math.round((n - 25569) * 86400000)); var p = function (x) { return (x < 10 ? "0" : "") + x; }; return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()); }
  return "";
}
function toIso(v) { var d = toD8(v); return d ? (d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8)) : ""; }
function metaOf(app, col, sheet) { var rows = app.findRecordsByFilter(col("ymmeta"), "sheet = '" + quote(sheet) + "'", "", 1, 0); return rows && rows.length ? rows[0] : null; }
function headersOf(meta) { var h = jsonValue(meta ? meta.get("headers") : [], []); return Array.isArray(h) ? h : []; }
function isMigrated(app, col) { var meta = metaOf(app, col, MASTER); return !!meta && headersOf(meta).indexOf(PART_COL) >= 0; }
function rowData(rec) { var d = jsonValue(rec.publicExport().data, {}); return (d && typeof d === "object" && !Array.isArray(d)) ? d : {}; }
function toView(d, canonical) {
  var o = {};
  for (var i = 0; i < MAP.length; i++) { var v = MAP[i][1] ? d[MAP[i][1]] : ""; if (MAP[i][0] === "명칭" && nz(d["판매명칭"]) && (!canonical || !nz(d["정본명"]))) v = d["판매명칭"]; v = (v === undefined || v === null) ? "" : ((typeof v === "object") ? v : String(v)); if (MAP[i][2]) v = toIso(v); o[MAP[i][0]] = v; }
  if (canonical && nz(d["회차수"]) !== "") o["총회차"] = String(d["회차수"]);
  return o;
}
function allMaster(app, col) { return app.findRecordsByFilter(col("ymdata"), "sheet = '" + MASTER + "'", "rowIndex", 50000, 0); }
function list(app, col) {
  var docs,out=[],dc=col("ymdata"),canonical=String(dc.name||dc)==="ymdata_dev";
  try{var keys=MAP.map(function(m){return m[1];}).filter(Boolean).concat([PART_COL,"판매명칭","회차수"]);docs=require(__hooks+"/ym-read-rows-lib.js").read(app,col,MASTER,keys.filter(function(k,i,a){return a.indexOf(k)===i;}));}
  catch(e){docs=allMaster(app,col).map(rowData);}
  for(var i=0;i<docs.length;i++){var d=docs[i];if(!nz(d[PART_COL]))continue;out.push(toView(d,canonical));}
  return out;
}
function opsView(app, col) { var rows = list(app, col); return { sheet: "운영_판매설정", headers: HEADERS.slice(), rows: rows, count: rows.length, via: MASTER }; }
// 옛 열 이름 객체 → 마스터 열 객체(날짜 D8). 모르는 열·읽기전용 열은 버린다(마스터 헤더 오염 방지). 명칭이 빈 값이면 정본명을 지우지 않는다.
function toMaster(obj) {
  var out = {}, idx = {}; for (var i = 0; i < MAP.length; i++) idx[MAP[i][0]] = MAP[i];
  var ks = Object.keys(obj || {});
  for (var j = 0; j < ks.length; j++) { var k = ks[j], v = obj[k]; v = (v === undefined || v === null) ? "" : v; var m = idx[k]; if (!m || !m[1] || m[3]) continue; if (k === "명칭" && !nz(v)) continue; if (m[2]) { var d8 = toD8(v); if (nz(v) && !d8) d8 = v; v = d8; } out[m[1]] = v; if (k === "명칭") out["판매명칭"] = ""; }
  return out;
}
function findById(app, col, id) { var recs = allMaster(app, col); for (var i = 0; i < recs.length; i++) { var d = rowData(recs[i]); if (nz(d["구분"]) === "사업") continue; if (nz(d["프로그램ID"]) === id) return recs[i]; } return null; }   // [260905 통합⑦] 사업 행(사업NO) 은 판매설정 대상이 아니다
function ensureHeaders(app, col) {
  var meta = metaOf(app, col, MASTER); if (!meta) throw new Error("프로그램마스터 시트 없음");
  var hs = headersOf(meta), changed = false, want = NEW_MASTER_COLS;
  if (hs.indexOf(PART_COL) < 0) throw new Error("판매설정 창구: 마스터 미이관 환경에서는 쓰지 않는다");
  for (var i = 0; i < want.length; i++) if (hs.indexOf(want[i]) < 0) { hs.push(want[i]); changed = true; }
  if (changed) { meta.set("headers", hs); app.save(meta); }
  return meta;
}
function touchLastmod(app, col) {
  var metaCol = col("ymmeta"), rows = app.findRecordsByFilter(metaCol, "sheet = '_lastmod'", "", 1, 0);
  if (rows && rows.length) { rows[0].set("source", new Date().toISOString()); app.save(rows[0]); }
}
function deriveYear(d) { var s = nz(d["시작일"]); if (s.length >= 4 && !nz(d["연도"])) d["연도"] = s.slice(0, 4); }
// 프로그램ID 로 행을 찾아 판매 열을 덮는다(없으면 새 마스터 행). part 는 판매구분.
function upsert(app, col, part, row) {
  var p = toMaster(row); var id = nz(p["프로그램ID"]); if (!id) return { error: "프로그램ID required", status: 400 };
  if (nz(part)) p[PART_COL] = nz(part);
  var pk = Object.keys(p); var meta = ensureHeaders(app, col); var hs = headersOf(meta);
  var rec = findById(app, col, id), created = false;
  var d;
  if (rec) { d = rowData(rec); } else { d = {}; for (var i = 0; i < hs.length; i++) d[hs[i]] = ""; d["프로그램ID"] = id; d["구분"] = "기획"; d["매칭근거"] = "판매설정"; d["출처"] = "판매설정"; d["상태"] = "정상"; created = true; }
  for (var j = 0; j < pk.length; j++) d[pk[j]] = p[pk[j]];
  if (!nz(d[PART_COL])) return { error: "구분 required for unified sheet 판매설정", status: 400 };
  if (created) { var ex = (nz(d[PART_COL]) === "전시"); d["카테고리"] = ex ? "기획전시" : "기획공연"; d["표시_구분"] = "기획"; d["표시_분야"] = ex ? "전시" : "공연"; d["부문코드"] = ex ? "2" : "1"; }
  deriveYear(d);
  if (rec) { rec.set("data", d); app.save(rec); }
  else { var nri = meta.get("nextRowIndex") || 2; app.save(new Record(col("ymdata"), { sheet: MASTER, rowIndex: nri, data: d })); meta.set("rowCount", (meta.get("rowCount") || 0) + 1); meta.set("nextRowIndex", nri + 1); app.save(meta); }
  touchLastmod(app, col);
  return { ok: true, rowIndex: rec ? rec.get("rowIndex") : (meta.get("nextRowIndex") - 1), created: created };
}
// PATCH: keyCol 은 프로그램ID 만 지원(옛 훅도 판매설정은 ID 1행). 보낸 키만 덮는다.
function patchById(app, col, id, patch) {
  var rec = findById(app, col, id); if (!rec) return null;
  var d = rowData(rec); if (!nz(d[PART_COL])) return null;   // 판매설정에 없던 프로그램 → 옛 동작(404) 과 같게
  var p = toMaster(patch); if (!nz(p[PART_COL])) delete p[PART_COL];   // 빈 구분은 무시, 값이 오면 옛 훅처럼 덮는다
  var pk = Object.keys(p); ensureHeaders(app, col);
  for (var i = 0; i < pk.length; i++) d[pk[i]] = p[pk[i]];
  deriveYear(d); rec.set("data", d); app.save(rec); touchLastmod(app, col);
  return { ok: true, patched: pk.length };
}
// DELETE: 마스터 행은 남기고 판매 명단에서만 뺀다(판매구분 비움 → 뷰에서 사라짐, 마스터 본래 열 값 보존)
function removeById(app, col, id) {
  var rec = findById(app, col, id); if (!rec) return null;
  var d = rowData(rec); if (!nz(d[PART_COL])) return null;
  for (var i = 0; i < NEW_MASTER_COLS.length; i++) d[NEW_MASTER_COLS[i]] = "";   // 판매 전용 열만 비움(마스터 식별·이력 열은 보존)
  rec.set("data", d); app.save(rec); touchLastmod(app, col);
  return { ok: true, deleted: 1, unlisted: true };
}
module.exports = { MASTER: MASTER, PART_COL: PART_COL, MAP: MAP, HEADERS: HEADERS, NEW_MASTER_COLS: NEW_MASTER_COLS, toD8: toD8, toIso: toIso, isMigrated: isMigrated, list: list, opsView: opsView, toMaster: toMaster, upsert: upsert, patchById: patchById, removeById: removeById, findById: findById };
