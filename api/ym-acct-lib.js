// api/ym-acct-lib.js — [260905 통합⑧] 담당자 명단(managers)의 계정NO 창구.
//   managers 시트에 계정NO 열(001, 002 …)을 두고, records 의 신청자·게시 담당자, 프로그램마스터의 담당자 칸에는 이름 대신 계정NO 를 저장한다.
//   앱은 이름만 안다 → 훅이 읽을 때 계정NO→이름, 쓸 때 이름→계정NO 로 바꾼다. 명단에 없는 값(예울마루 · 상관 없음 · 빈칸)은 그대로 둔다.
//   isMigrated(=managers 목록에 계정NO 열이 있음)가 false 인 환경(발행본)은 옛 경로 그대로(호환 다리).
//   PB 라우트 핸들러는 격리 스코프 → 핸들러 안에서 require(__hooks + "/ym-acct-lib.js") 로만 쓴다.
var SHEET = "managers";
var NO_COL = "계정NO";
var NAME_COL = "담당자";
var SEQ_SHEET = "_acctseq";   // 번호 발급 이력(ymmeta 행, source = 마지막 번호). 담당자를 지워도 번호는 다시 쓰지 않는다.
var NO_RE = /^\d{3,}$/;      // 계정NO 모양. 이름 칸에 이 모양이 오면 번호로, 아니면 이름으로만 본다(방향 고정).
function nz(v) { return String(v === undefined || v === null ? "" : v).trim(); }
function jsonValue(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch (err2) { return fallback; } }
  return raw;
}
function metaOf(app, col) { var rows = app.findRecordsByFilter(col("ymmeta"), "sheet = '" + SHEET + "'", "", 1, 0); return rows && rows.length ? rows[0] : null; }
function headersOf(meta) { var h = jsonValue(meta ? meta.get("headers") : [], []); return Array.isArray(h) ? h : []; }
function isMigrated(app, col) { var meta = metaOf(app, col); return !!meta && headersOf(meta).indexOf(NO_COL) >= 0; }
function rowData(rec) { var d = jsonValue(rec.publicExport().data, {}); return (d && typeof d === "object" && !Array.isArray(d)) ? d : {}; }
function pad3(n) { var s = String(n); while (s.length < 3) s = "0" + s; return s; }
// 명단 → { byNo: {계정NO: 이름}, byName: {이름: 계정NO}, max: 가장 큰 번호 }
function maps(app, col) {
  var recs = app.findRecordsByFilter(col("ymdata"), "sheet = '" + SHEET + "'", "rowIndex", 50000, 0);
  var m = { byNo: {}, byName: {}, max: 0 };
  for (var i = 0; i < recs.length; i++) {
    var d = rowData(recs[i]), no = nz(d[NO_COL]), name = nz(d[NAME_COL]);
    if (no) { if (name) m.byNo[no] = name; var n = parseInt(no, 10); if (n > m.max) m.max = n; }   // 이름 없는 번호는 표에 안 넣는다(빈 이름으로 번역되지 않게)
    if (no && name && !m.byName[name]) m.byName[name] = no;
  }
  return m;
}
// 계정NO → 이름(모르면 그대로). 화면으로 나갈 때.
function toName(m, v) { var s = nz(v); if (!s) return ""; if (!NO_RE.test(s)) return String(v); return Object.prototype.hasOwnProperty.call(m.byNo, s) ? m.byNo[s] : String(v); }
// 이름 → 계정NO(명단에 없으면 그대로). 저장할 때.
function toNo(m, v) { var s = nz(v); if (!s) return ""; if (NO_RE.test(s)) return s; return Object.prototype.hasOwnProperty.call(m.byName, s) ? m.byName[s] : String(v); }
// 객체의 지정 열들을 한꺼번에 바꾼다(제자리)
function namesOut(m, row, cols) { for (var i = 0; i < cols.length; i++) if (row && Object.prototype.hasOwnProperty.call(row, cols[i])) row[cols[i]] = toName(m, row[cols[i]]); return row; }
function nosIn(m, row, cols) { for (var i = 0; i < cols.length; i++) if (row && Object.prototype.hasOwnProperty.call(row, cols[i])) row[cols[i]] = toNo(m, row[cols[i]]); return row; }
function seqOf(app, col) { var rows = app.findRecordsByFilter(col("ymmeta"), "sheet = '" + SEQ_SHEET + "'", "", 1, 0); return rows && rows.length ? rows[0] : null; }
function seqSet(app, col, n) { var r = seqOf(app, col); if (r) { r.set("source", String(n)); app.save(r); } else app.save(new Record(col("ymmeta"), { sheet: SEQ_SHEET, headers: [], source: String(n), rowCount: 0, nextRowIndex: 0 })); }
// 계정NO 가 없는 명단 행에 다음 번호를 준다(새 담당자 등록·수정 뒤 호출). 번호 = max(발급 이력, 현재 최대) + 1. 헤더에 계정NO 가 없으면 아무것도 안 한다.
function assignMissing(app, col) {
  var meta = metaOf(app, col); if (!meta || headersOf(meta).indexOf(NO_COL) < 0) return 0;
  var m = maps(app, col), sq = seqOf(app, col), last = sq ? parseInt(nz(sq.get("source")), 10) : 0; if (!(last > 0)) last = 0;
  var next = Math.max(last, m.max) + 1, done = 0;
  var recs = app.findRecordsByFilter(col("ymdata"), "sheet = '" + SHEET + "'", "rowIndex", 50000, 0);
  for (var i = 0; i < recs.length; i++) {
    var d = rowData(recs[i]);
    if (nz(d[NO_COL]) || !nz(d[NAME_COL])) continue;
    d[NO_COL] = pad3(next); next++; recs[i].set("data", d); app.save(recs[i]); done++;
  }
  if (done || Math.max(last, m.max) !== last) seqSet(app, col, next - 1);
  return done;
}
// 같은 이름이 이미 명단에 있는지(등록·개명 때 중복 막기). exceptRowIndex 는 자기 행 제외.
function nameTaken(app, col, name, exceptRowIndex) {
  name = nz(name); if (!name) return false;
  var recs = app.findRecordsByFilter(col("ymdata"), "sheet = '" + SHEET + "'", "rowIndex", 50000, 0);
  for (var i = 0; i < recs.length; i++) { if (exceptRowIndex && recs[i].get("rowIndex") === exceptRowIndex) continue; if (nz(rowData(recs[i])[NAME_COL]) === name) return true; }
  return false;
}
module.exports = { SHEET: SHEET, NO_COL: NO_COL, NAME_COL: NAME_COL, SEQ_SHEET: SEQ_SHEET, NO_RE: NO_RE, isMigrated: isMigrated, maps: maps, toName: toName, toNo: toNo, namesOut: namesOut, nosIn: nosIn, assignMissing: assignMissing, nameTaken: nameTaken, seqSet: seqSet, pad3: pad3, rowData: rowData, nz: nz };
