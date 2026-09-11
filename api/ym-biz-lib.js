// api/ym-biz-lib.js — [260905 통합⑦] 사업비 시트 → 프로그램마스터 '사업' 행 창구(번역표).
//   사업비 1행 = 사업 1개(예산 단위, 사업NO 26-a09). 프로그램 여러 개가 한 사업에 걸치므로(62건) 프로그램 행에 열로 얹지 않고
//   마스터에 구분='사업' 인 행으로 둔다(프로그램ID 칸 = 사업NO, 사업코드 = 사업NO). 프로그램 행은 사업코드로 그 사업 행을 가리킨다.
//   앱이 부르는 GET /api/ops?sheet=사업비 · POST /api/ops {sheet:'사업비', rows}(통째 저장) · POST/PATCH/DELETE /api/ops/row {sheet:'사업비'}
//   는 여기서 마스터 사업 행만 옛 19열 모양으로 보여 주고 같은 행에 쓴다. 앱 코드는 안 고친다.
//   isMigrated(=마스터 목록에 회계구분 열이 있음)가 false 인 환경(발행본)은 옛 경로 그대로(호환 다리).
//   격리 스코프 → 핸들러 안에서 require(__hooks + "/ym-biz-lib.js").
var MASTER = "ops_프로그램마스터";
var PART_COL = "구분";
var PART = "사업";
var KEY = "사업NO";
// [옛 사업비 열, 마스터 열] — 옛 헤더 순서 그대로
var MAP = [["사업NO","프로그램ID"],["연도","연도"],["분야","표시_분야"],["회계구분","회계구분"],["사업명","정본명"],["연결키","연결키"],["진행월","진행월"],["횟수","횟수"],["예산","예산"],["전표실적","전표실적"],["판매수수료","판매수수료"],["정산서매출","정산서매출"],["유료인원","유료인원"],["초대인원","초대인원"],["비고","비고"],["수정자","수정자"],["수정일시","수정일시"],["미기입","미기입"],["구NO","구NO"]];
var HEADERS = MAP.map(function (m) { return m[0]; });
var NEW_MASTER_COLS = ["회계구분","연결키","진행월","횟수","예산","전표실적","판매수수료","정산서매출","유료인원","초대인원","수정자","수정일시","미기입","구NO"];
function quote(v) { return String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\" + "'"); }
function nz(v) { return String(v === undefined || v === null ? "" : v).trim(); }
function jsonValue(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch (err2) { return fallback; } }
  return raw;
}
function metaOf(app, col, sheet) { var rows = app.findRecordsByFilter(col("ymmeta"), "sheet = '" + quote(sheet) + "'", "", 1, 0); return rows && rows.length ? rows[0] : null; }
function headersOf(meta) { var h = jsonValue(meta ? meta.get("headers") : [], []); return Array.isArray(h) ? h : []; }
function isMigrated(app, col) { var meta = metaOf(app, col, MASTER); return !!meta && headersOf(meta).indexOf("회계구분") >= 0 && !metaOf(app, col, "ops_사업비"); }   // 열이 생겼고 옛 시트가 없어졌을 때만(013 이 한 트랜잭션에서 둘 다 바꾼다)
function rowData(rec) { var d = jsonValue(rec.publicExport().data, {}); return (d && typeof d === "object" && !Array.isArray(d)) ? d : {}; }
function isPart(d) { return nz(d[PART_COL]) === PART; }
function toView(d) { var o = {}; for (var i = 0; i < MAP.length; i++) { var v = d[MAP[i][1]]; o[MAP[i][0]] = (v === undefined || v === null) ? "" : String(v); } return o; }
function allMaster(app, col) { return app.findRecordsByFilter(col("ymdata"), "sheet = '" + MASTER + "'", "rowIndex", 50000, 0); }
// 사업 행만 (withRec 면 [{rec,d}])
function partRecs(app, col) { var recs = allMaster(app, col), out = []; for (var i = 0; i < recs.length; i++) { var d = rowData(recs[i]); if (isPart(d)) out.push({ rec: recs[i], d: d }); } return out; }
function list(app, col) {
  var documents;
  try { documents=require(__hooks+"/ym-read-rows-lib.js").read(app,col,MASTER,MAP.map(function(m){return m[1];}).concat([PART_COL])).filter(isPart); }
  catch(bulkError){documents=partRecs(app,col).map(function(item){return item.d;});}
  var out = [];
  for (var i = 0; i < documents.length; i++) { var row = toView(documents[i]), any = false; for (var k in row) if (row[k].trim() !== "") { any = true; break; } if (any) out.push(row); }
  return out;
}
function opsView(app, col) { var rows = list(app, col); return { sheet: "운영_사업비", headers: HEADERS.slice(), rows: rows, count: rows.length, via: MASTER }; }
// 옛 열 이름 객체 → 마스터 열 객체(모르는 열은 버린다 — 마스터 목록에 열이 늘지 않게)
function toMaster(obj) {
  var out = {}, idx = {}; for (var i = 0; i < MAP.length; i++) idx[MAP[i][0]] = MAP[i][1];
  var ks = Object.keys(obj || {});
  for (var j = 0; j < ks.length; j++) { var k = ks[j]; if (!idx[k]) continue; var v = obj[k]; out[idx[k]] = (v === undefined || v === null) ? "" : v; }
  return out;
}
function ensureHeaders(app, col) {
  var meta = metaOf(app, col, MASTER); if (!meta) throw new Error("프로그램마스터 시트 없음");
  var hs = headersOf(meta), changed = false;
  for (var i = 0; i < NEW_MASTER_COLS.length; i++) if (hs.indexOf(NEW_MASTER_COLS[i]) < 0) { hs.push(NEW_MASTER_COLS[i]); changed = true; }
  if (changed) { meta.set("headers", hs); app.save(meta); }
  return meta;
}
function touchLastmod(app, col) { var rows = app.findRecordsByFilter(col("ymmeta"), "sheet = '_lastmod'", "", 1, 0); if (rows && rows.length) { rows[0].set("source", new Date().toISOString()); app.save(rows[0]); } }
// 새 사업 행의 뼈대(마스터 식별 열)
function stamp(d, no) { d["프로그램ID"] = no; d[PART_COL] = PART; d["사업코드"] = no; if (!nz(d["출처"])) d["출처"] = "사업비"; if (!nz(d["매칭근거"])) d["매칭근거"] = "사업비"; if (!nz(d["상태"])) d["상태"] = "정상"; if (!nz(d["표시_구분"])) d["표시_구분"] = PART; return d; }
function findByNo(app, col, no) { var ps = partRecs(app, col); for (var i = 0; i < ps.length; i++) if (nz(ps[i].d["프로그램ID"]) === no) return ps[i]; return null; }
// 색인 한 번: 사업 행(byNo) + 프로그램 행의 프로그램ID(progIds). 통째 저장이 273행을 보내도 마스터를 한 번만 읽는다.
function indexMaster(app, col) {
  var meta = ensureHeaders(app, col), hs = headersOf(meta), recs = allMaster(app, col), byNo = {}, progIds = {}, parts = [];
  for (var i = 0; i < recs.length; i++) { var d = rowData(recs[i]), id = nz(d["프로그램ID"]); if (isPart(d)) { var it = { rec: recs[i], d: d }; parts.push(it); if (id && !byNo[id]) byNo[id] = it; } else if (id) progIds[id] = 1; }
  return { meta: meta, hs: hs, byNo: byNo, progIds: progIds, parts: parts, dirtyMeta: false };
}
// 사업NO 로 사업 행을 찾아 덮는다(없으면 새 행). 옛 열 이름 객체를 받는다. ctx(indexMaster) 를 주면 그 색인을 쓰고 메타 저장·lastmod 는 호출자가 한다.
function upsert(app, col, row, ctx) {
  var p = toMaster(row), no = nz(p["프로그램ID"]); if (!no) return { error: KEY + " required", status: 400 };
  var own = !ctx; if (own) ctx = indexMaster(app, col);
  if (ctx.progIds[no]) return { error: "프로그램ID 와 겹치는 " + KEY + ": " + no, status: 409 };
  var hit = ctx.byNo[no], d, created = false;
  if (hit) d = hit.d; else { d = {}; for (var i = 0; i < ctx.hs.length; i++) d[ctx.hs[i]] = ""; created = true; }
  var pk = Object.keys(p); for (var j = 0; j < pk.length; j++) d[pk[j]] = p[pk[j]];
  stamp(d, no);
  var rowIndex;
  if (hit) { hit.rec.set("data", d); app.save(hit.rec); rowIndex = hit.rec.get("rowIndex"); }
  else { rowIndex = ctx.meta.get("nextRowIndex") || 2; var rec = new Record(col("ymdata"), { sheet: MASTER, rowIndex: rowIndex, data: d }); app.save(rec); ctx.meta.set("rowCount", (ctx.meta.get("rowCount") || 0) + 1); ctx.meta.set("nextRowIndex", rowIndex + 1); ctx.dirtyMeta = true; ctx.byNo[no] = { rec: rec, d: d }; }
  if (own) { if (ctx.dirtyMeta) app.save(ctx.meta); touchLastmod(app, col); }
  return { ok: true, rowIndex: rowIndex, created: created };
}
// 자리 배열 행([...]) 이면 헤더 순서로 객체를 만든다
function rowObj(r, hs) { if (!Array.isArray(r)) return r || {}; hs = (Array.isArray(hs) && hs.length) ? hs : HEADERS; var o = {}; for (var i = 0; i < hs.length && i < r.length; i++) o[hs[i]] = r[i]; return o; }
function normRows(rows, hs) { rows = Array.isArray(rows) ? rows : []; var out = []; for (var i = 0; i < rows.length; i++) out.push(rowObj(rows[i], hs)); return out; }
// 통째 저장(YMDB.save → POST /api/ops {sheet:'사업비', headers, rows}). 옛 훅은 시트 전체를 지우고 다시 넣었다 → 여기서는 사업 행만 같은 뜻으로:
//   보낸 행은 사업NO 로 덮고(없으면 추가), 보내지 않은 사업 행은 지운다. 빈 rows 로 전부 지우는 건 거부(allowEmpty:true 면 허용).
function replaceAll(app, col, rows, allowEmpty, hs) {
  rows = normRows(rows, hs);
  var ctx = indexMaster(app, col), cur = ctx.parts;
  if (!rows.length && cur.length && allowEmpty !== true) return { error: "empty replace refused (allowEmpty:true to confirm)", existing: cur.length, status: 409 };
  var seen = {}, i;
  for (i = 0; i < rows.length; i++) { var no = nz(rows[i][KEY]); if (!no) return { error: KEY + " required (row " + i + ")", status: 400 }; if (seen[no]) return { error: "duplicate " + KEY + ": " + no, status: 409 }; if (ctx.progIds[no]) return { error: "프로그램ID 와 겹치는 " + KEY + ": " + no, status: 409 }; seen[no] = 1; }
  var inserted = 0, updated = 0, removed = 0;
  for (i = 0; i < rows.length; i++) { var r = upsert(app, col, rows[i], ctx); if (r.error) return r; if (r.created) inserted++; else updated++; }
  for (i = 0; i < cur.length; i++) { if (seen[nz(cur[i].d["프로그램ID"])]) continue; app.delete(cur[i].rec); removed++; }
  if (removed) { ctx.meta.set("rowCount", Math.max(0, (ctx.meta.get("rowCount") || 0) - removed)); ctx.dirtyMeta = true; }
  if (ctx.dirtyMeta) app.save(ctx.meta);
  touchLastmod(app, col);
  return { ok: true, inserted: inserted, updated: updated, removed: removed, via: MASTER };
}
// 행마다 추가/덮기(mode:'append'|'upsert') — 지우지 않는다
function appendRows(app, col, rows, hs) {
  rows = normRows(rows, hs); var ctx = indexMaster(app, col), inserted = 0, updated = 0;
  for (var i = 0; i < rows.length; i++) { var r = upsert(app, col, rows[i], ctx); if (r.error) return r; if (r.created) inserted++; else updated++; }
  if (ctx.dirtyMeta) app.save(ctx.meta); touchLastmod(app, col);
  return { ok: true, inserted: inserted, updated: updated, removed: 0, via: MASTER };
}
// 새 사업 1건(POST /api/ops/row) — 옛 훅은 그냥 append 였다. 같은 사업NO 가 이미 있으면 덮지 않고 409(빈 폼이 기존 예산을 지우지 않게).
function createOne(app, col, row) {
  var no = nz((row || {})[KEY]); if (!no) return { error: KEY + " required", status: 400 };
  if (findByNo(app, col, no)) return { error: "duplicate " + KEY + ": " + no, status: 409 };
  return upsert(app, col, row);
}
// PATCH /api/ops/row {keyCol:'사업NO', key, patch} — 보낸 열만 덮는다
function patchByNo(app, col, no, patch) {
  var hit = findByNo(app, col, no); if (!hit) return null;
  var p = toMaster(patch), pk = Object.keys(p); ensureHeaders(app, col);   // 사업NO(프로그램ID) 는 바꾸지 않는다
  for (var i = 0; i < pk.length; i++) { if (pk[i] === "프로그램ID") continue; hit.d[pk[i]] = p[pk[i]]; }
  stamp(hit.d, no); hit.rec.set("data", hit.d); app.save(hit.rec); touchLastmod(app, col);
  return { ok: true, patched: pk.length };
}
function removeByNo(app, col, no) {
  var hit = findByNo(app, col, no); if (!hit) return null;
  app.delete(hit.rec);
  var meta = metaOf(app, col, MASTER); if (meta) { meta.set("rowCount", Math.max(0, (meta.get("rowCount") || 0) - 1)); app.save(meta); }
  touchLastmod(app, col);
  return { ok: true, deleted: 1 };
}
module.exports = { MASTER: MASTER, PART: PART, PART_COL: PART_COL, KEY: KEY, MAP: MAP, HEADERS: HEADERS, NEW_MASTER_COLS: NEW_MASTER_COLS, isMigrated: isMigrated, isPart: isPart, list: list, opsView: opsView, toMaster: toMaster, upsert: upsert, createOne: createOne, replaceAll: replaceAll, appendRows: appendRows, patchByNo: patchByNo, removeByNo: removeByNo, findByNo: findByNo, indexMaster: indexMaster };
