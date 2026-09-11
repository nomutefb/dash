// api/ym-programs-lib.js — [260904 통합①] 프로그램 관리(programs 시트) → 프로그램마스터 창구(번역표).
//   programs 시트를 없애고 그 열들을 프로그램마스터에 넣은 뒤, 앱이 부르는 /api/programs · /api/sheet/program(s) 는
//   프로그램마스터의 "콘텐츠구분 이 채워진 행" 을 옛 programs 모양(22열)으로 보여 주고, 저장도 같은 행에 쓴다.
//   앱 코드(standalone.html)는 손대지 않는다. 옛 programs 시트가 아직 있는 환경(발행본)에서는 isMigrated 가 false → 옛 경로 그대로(호환 다리).
//   날짜: 프로그램마스터는 YYYYMMDD, 화면은 YYYY-MM-DD — 여기서 양방향 변환.
//   PB 라우트 핸들러는 격리 스코프이므로 핸들러 안에서 require(__hooks + "/ym-programs-lib.js") 로만 쓴다.
var MASTER = "ops_프로그램마스터";
// [옛 programs 열, 프로그램마스터 열, 날짜여부]
var MAP = [["NO","NO"],["콘텐츠구분","콘텐츠구분"],["풀네임","정본명"],["줄임말","줄임말"],["판매시작일","판매시작일",1],["판매종료일","판매종료일",1],["시작일","시작일",1],["종료일","종료일",1],["담당자","담당자"],["장소","장소"],["URL","URL"],["프로그램ID","프로그램ID"],["홍보시작일","홍보시작일",1],["구분","장르구분"],["공동기획여부","공동기획여부"],["지원사업여부","지원사업여부"],["GS아트센터협업여부","GS아트센터협업여부"],["회차","회차수"],["수익성","수익성"],["홍보노출","홍보노출"],["장르","장르주관식"],["사업코드","사업코드"]];
var HEADERS = MAP.map(function (m) { return m[0]; });
var NEW_MASTER_COLS = ["NO","콘텐츠구분","줄임말","담당자","URL","장르구분","공동기획여부","지원사업여부","GS아트센터협업여부","수익성","홍보노출","장르주관식"];

function quote(v) { return String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\" + "'"); }
function jsonValue(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch (err2) { return fallback; } }
  return raw;
}
function nz(v) { return String(v === undefined || v === null ? "" : v).trim(); }
// 화면/입력 날짜 → YYYYMMDD 문자열('' 이면 '')
function toD8(v) {
  var s = nz(v);
  if (!s) return "";
  var m = s.match(/^(\d{4})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})/) || s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return m[1] + ("0" + m[2]).slice(-2) + ("0" + m[3]).slice(-2);
  var n = Number(s);
  if (n > 20000 && n < 80000) { var d = new Date(Math.round((n - 25569) * 86400000)); var p = function (x) { return (x < 10 ? "0" : "") + x; }; return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()); }
  return "";
}
// YYYYMMDD → YYYY-MM-DD
function toIso(v) { var d = toD8(v); return d ? (d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8)) : ""; }

function metaOf(app, col, sheet) {
  var rows = app.findRecordsByFilter(col("ymmeta"), "sheet = '" + quote(sheet) + "'", "", 1, 0);
  return rows && rows.length ? rows[0] : null;
}
function headersOf(meta) { var h = jsonValue(meta ? meta.get("headers") : [], []); return Array.isArray(h) ? h : []; }
// 프로그램마스터에 새 열이 있으면 "통합 완료" (발행본처럼 아직 programs 시트를 쓰는 환경은 false)
function isMigrated(app, col) {
  var meta = metaOf(app, col, MASTER);
  if (!meta) return false;
  return headersOf(meta).indexOf("콘텐츠구분") >= 0;
}
function rowData(rec) { var d = jsonValue(rec.publicExport().data, {}); return (d && typeof d === "object" && !Array.isArray(d)) ? d : {}; }
function toView(d) {
  var o = {};
  for (var i = 0; i < MAP.length; i++) { var v = d[MAP[i][1]]; v = (v === undefined || v === null) ? "" : String(v); if (MAP[i][2]) v = toIso(v); o[MAP[i][0]] = v; }
  return o;
}
// 옛 programs 모양 목록. withIndex 면 _rowIndex(프로그램마스터 rowIndex) 포함.
function list(app, col, withIndex) {
  var recs = app.findRecordsByFilter(col("ymdata"), "sheet = '" + MASTER + "'", "rowIndex", 50000, 0);
  var out = [];
  for (var i = 0; i < recs.length; i++) {
    var d = rowData(recs[i]);
    if (!nz(d["콘텐츠구분"])) continue;                 // 올해 운영 명단 = 콘텐츠구분이 있는 행
    var row = toView(d);
    if (withIndex) row._rowIndex = recs[i].get("rowIndex");
    out.push(row);
  }
  out.sort(function (a, b) { var x = Number(a["NO"]) || 0, y = Number(b["NO"]) || 0; return x - y; });
  return out;
}
// body → {마스터열: 값}. values 가 배열이면 HEADERS 순서. promoFlag/sideCells(옛 규약)도 흡수.
function fromBody(body) {
  var vals = {};
  var values = body && body.values;
  var i;
  if (Array.isArray(values)) { for (i = 0; i < HEADERS.length && i < values.length; i++) vals[HEADERS[i]] = values[i]; }
  else if (values && typeof values === "object") { var ks = Object.keys(values); for (i = 0; i < ks.length; i++) vals[ks[i]] = values[ks[i]]; }
  var ek = Object.keys(body || {});
  for (i = 0; i < ek.length; i++) {
    var k = ek[i];
    if (k === "values" || k === "headers") continue;
    if (k === "promoFlag") { vals["홍보노출"] = body[k]; continue; }
    if (k === "sideCells" && body[k] && typeof body[k] === "object") { var sk = Object.keys(body[k]); for (var j = 0; j < sk.length; j++) vals[sk[j]] = body[k][sk[j]]; continue; }
    vals[k] = body[k];
  }
  var out = {};
  for (i = 0; i < MAP.length; i++) {
    var vk = MAP[i][0];
    if (!Object.prototype.hasOwnProperty.call(vals, vk)) continue;
    var v = vals[vk]; v = (v === undefined || v === null) ? "" : v;
    if (MAP[i][2]) v = toD8(v);
    out[MAP[i][1]] = (typeof v === "number") ? String(v) : String(v);
  }
  return out;
}
var BUN = {"공연":["기획공연","공연","1"],"전시":["기획전시","전시","2"],"예술교육":["교육","교육","3"],"대관":["대관공연","공연","1"],"기타":["기타","기타","6"]};
// 파생 열 채움(새 행) / 갱신(연도·별칭)
function derive(d, isNew) {
  var s = nz(d["시작일"]);
  if (s.length >= 4) d["연도"] = s.slice(0, 4);
  var ct = nz(d["콘텐츠구분"]);
  if (isNew) {
    var b = BUN[ct] || BUN["기타"];
    if (!nz(d["구분"])) d["구분"] = (ct === "대관") ? "대관" : "기획";
    if (!nz(d["카테고리"])) d["카테고리"] = (ct === "대관" && nz(d["장르구분"]) === "전시") ? "대관전시" : b[0];
    if (!nz(d["표시_구분"])) d["표시_구분"] = d["구분"];
    if (!nz(d["표시_분야"])) d["표시_분야"] = b[1];
    if (!nz(d["부문코드"])) d["부문코드"] = b[2];
    if (!nz(d["상태"])) d["상태"] = "정상";
    if (!nz(d["매칭근거"])) d["매칭근거"] = "프로그램관리";
    if (!nz(d["출처"])) d["출처"] = "programs";
  }
  var short = nz(d["줄임말"]);
  if (short) {
    var al = d["별칭"]; if (typeof al === "string") { var raw = al; try { al = JSON.parse(al); } catch (e) { al = nz(raw) ? [nz(raw)] : []; } }
    if (!Array.isArray(al)) al = [];
    if (al.indexOf(short) < 0) al.push(short);
    d["별칭"] = JSON.stringify(al);
  }
  return d;
}
function touchLastmod(app, col) {
  var metaCol = col("ymmeta");
  var rows = app.findRecordsByFilter(metaCol, "sheet = '_lastmod'", "", 1, 0);
  if (rows && rows.length) { rows[0].set("source", new Date().toISOString()); app.save(rows[0]); }
  else app.save(new Record(metaCol, { sheet: "_lastmod", headers: [], source: new Date().toISOString(), rowCount: 0, nextRowIndex: 0 }));
}
function ensureHeaders(app, col) {
  var meta = metaOf(app, col, MASTER); if (!meta) throw new Error("프로그램마스터 시트 없음");
  var hs = headersOf(meta), changed = false;
  for (var i = 0; i < NEW_MASTER_COLS.length; i++) if (hs.indexOf(NEW_MASTER_COLS[i]) < 0) { hs.push(NEW_MASTER_COLS[i]); changed = true; }
  if (changed) { meta.set("headers", hs); app.save(meta); }
  return meta;
}
function create(app, col, body) {
  var meta = ensureHeaders(app, col);
  var hs = headersOf(meta);
  var d = {}; for (var i = 0; i < hs.length; i++) d[hs[i]] = "";
  var patch = fromBody(body); var pk = Object.keys(patch); for (var j = 0; j < pk.length; j++) d[pk[j]] = patch[pk[j]];
  if (!nz(d["프로그램ID"])) return { error: "프로그램ID 없음", status: 400 };
  var want = nz(d["프로그램ID"]), dupRec = null;
  var all = app.findRecordsByFilter(col("ymdata"), "sheet = '" + MASTER + "'", "rowIndex", 50000, 0);
  for (var a = 0; a < all.length; a++) { if (nz(rowData(all[a])["프로그램ID"]) === want) { dupRec = all[a]; break; } }
  if (dupRec) {                                         // 같은 ID 가 이미 마스터에 있으면(이력 행) 새 행 대신 그 행을 채운다(빈 값은 덮지 않음)
    var ex = rowData(dupRec);
    if (nz(ex["콘텐츠구분"])) return { error: "이미 명단에 있는 프로그램ID: " + want, status: 409 };
    var ek = Object.keys(patch); for (var q = 0; q < ek.length; q++) { if (nz(patch[ek[q]]) === "" && nz(ex[ek[q]]) !== "") continue; ex[ek[q]] = patch[ek[q]]; }
    derive(ex, false); dupRec.set("data", ex); app.save(dupRec); touchLastmod(app, col);
    return { ok: true, rowIndex: dupRec.get("rowIndex"), merged: true };
  }
  derive(d, true);
  var nri = meta.get("nextRowIndex") || 2;
  app.save(new Record(col("ymdata"), { sheet: MASTER, rowIndex: nri, data: d }));
  meta.set("rowCount", (meta.get("rowCount") || 0) + 1); meta.set("nextRowIndex", nri + 1); app.save(meta);
  touchLastmod(app, col);
  return { ok: true, rowIndex: nri };
}
// 명단 행(콘텐츠구분≠'')만 찾는다 — 옛 programs rowIndex(1~36) 를 아직 들고 있는 브라우저가 이력 행을 건드리지 못하게
function findRow(app, col, rowIdx) {
  var n = parseInt(rowIdx, 10); if (!(n > 0)) return null;
  var recs = app.findRecordsByFilter(col("ymdata"), "sheet = '" + MASTER + "' && rowIndex = " + n, "", 1, 0);
  if (!(recs && recs.length)) return null;
  return nz(rowData(recs[0])["콘텐츠구분"]) ? recs[0] : null;
}
function patch(app, col, rowIdx, body) {
  ensureHeaders(app, col);
  var rec = findRow(app, col, rowIdx); if (!rec) return null;
  var d = rowData(rec); var p = fromBody(body); var ks = Object.keys(p);
  if (nz(p["프로그램ID"]) && nz(p["프로그램ID"]) !== nz(d["프로그램ID"])) return { error: "행 불일치(프로그램ID " + nz(d["프로그램ID"]) + " ≠ " + nz(p["프로그램ID"]) + ") — 목록을 새로고침하세요", status: 409 };
  for (var i = 0; i < ks.length; i++) d[ks[i]] = p[ks[i]];
  derive(d, false); rec.set("data", d); app.save(rec); touchLastmod(app, col);
  return { ok: true };
}
// 삭제: 폼에서 만든 행(출처 programs · 이력 없음)은 행 삭제, 이력 행은 명단에서만 뺀다(콘텐츠구분·NO 비움 → 목록·PERFS 에서 사라짐, 이력 보존)
function remove(app, col, rowIdx) {
  var rec = findRow(app, col, rowIdx); if (!rec) return null;
  var d = rowData(rec);
  if (nz(d["출처"]) === "programs" && nz(d["매칭근거"]) === "프로그램관리") {
    app.delete(rec);
    var meta = metaOf(app, col, MASTER); if (meta) { meta.set("rowCount", Math.max(0, (meta.get("rowCount") || 0) - 1)); app.save(meta); }
    touchLastmod(app, col); return { ok: true, deleted: true };
  }
  d["콘텐츠구분"] = ""; d["NO"] = ""; rec.set("data", d); app.save(rec); touchLastmod(app, col);
  return { ok: true, deleted: false, unlisted: true };
}
module.exports = { MASTER: MASTER, MAP: MAP, HEADERS: HEADERS, NEW_MASTER_COLS: NEW_MASTER_COLS, toD8: toD8, toIso: toIso, isMigrated: isMigrated, list: list, create: create, patch: patch, remove: remove, fromBody: fromBody, derive: derive, ensureHeaders: ensureHeaders };
