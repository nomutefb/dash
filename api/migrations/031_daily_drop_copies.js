// 031 — 일일실적의 명칭·사업코드 열 삭제(마스터 복사본). [260905 통합㉓ · 운영자 "같은 결인데 따로 노는 데이터가 있으면 안 됨"]
//   실측: 5,405행 중 명칭이 마스터 정본명과 다른 행 1,374 · 사업코드가 다른 행 18(9/3 병합 뒤 옛 코드). 앞으로는 저장하지 않고 읽을 때 프로그램ID 로 마스터에서 붙인다(api/ym-daily-join-lib.js).
//   지운 값은 ymmeta _ym_archive_031 한 건에 보관(headers.rows = [{실적ID, 명칭, 사업코드}]) = 되돌리기 근거. 값이 있는 다른 칸은 손대지 않는다.
//   전제: 일일실적 전 행의 프로그램ID 가 마스터에 있어야(021). 없는 행이 있으면 실패(롤백).
module.exports = {
  id: "031",
  title: "일일실적 명칭·사업코드 열 삭제(마스터에서 조인) + 보관",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var DAILY = "ops_일일실적", MASTER = "ops_프로그램마스터", ARCH = "_ym_archive_031", DROP = ["명칭","사업코드"];
    var dm = ctx.meta(DAILY); if (!dm) throw new Error(DAILY + " 없음");
    var hs = ctx.parseJson(dm.get("headers"), []);
    var ids = {}, mrows = ctx.sheetRows(MASTER);
    for (var m = 0; m < mrows.length; m++) { var md = ctx.parseJson(mrows[m].publicExport().data, {}); var id = nz(md["프로그램ID"]); if (id) ids[id] = 1; }
    var rows = ctx.sheetRows(DAILY), missing = [];
    for (var c = 0; c < rows.length; c++) { var cd = ctx.parseJson(rows[c].publicExport().data, {}); var pid = nz(cd["프로그램ID"]); if (!pid || !ids[pid]) missing.push(nz(cd["실적ID"]) + " " + pid); }
    if (missing.length) throw new Error("마스터에 없는 프로그램ID 가 있는 일일실적 행 " + missing.length + "건: " + missing.slice(0, 5).join(", "));
    // 보관 = ymmeta 한 건(_ym_archive_031, headers.rows = [{실적ID, 명칭, 사업코드}]) — 행마다 보관 행을 만들면(4천 건) 트랜잭션이 플랫폼 시간제한에 걸려 롤백됐다(260905 실측).
    var mc = ctx.col("ymmeta"), keepRows = [], touched = 0, cells = 0;
    for (var i = 0; i < rows.length; i++) {
      var d = ctx.parseJson(rows[i].publicExport().data, {}), keep = { "실적ID": nz(d["실적ID"]) }, has = false, changed = false;
      for (var k = 0; k < DROP.length; k++) { var key = DROP[k]; if (Object.prototype.hasOwnProperty.call(d, key)) { if (nz(d[key])) { keep[key] = d[key]; has = true; cells++; } delete d[key]; changed = true; } }
      if (has) keepRows.push(keep);
      if (changed) { rows[i].set("data", d); ctx.app.save(rows[i]); touched++; }
    }
    var old = ctx.meta(ARCH); if (old) throw new Error(ARCH + " 이미 있음 — 이미 적용됨?");
    ctx.app.save(new Record(mc, { sheet: ARCH, headers: { 이관: "031", 열: DROP, rows: keepRows }, source: "archive-031", rowCount: 0, nextRowIndex: 0 }));
    var archived = keepRows.length;
    var present = hs.filter(function (h) { return DROP.indexOf(h) >= 0; });
    if (present.length) { hs = hs.filter(function (h) { return DROP.indexOf(h) < 0; }); dm.set("headers", hs); ctx.app.save(dm); }
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    ctx.log("일일실적 " + rows.length + "행 · 칸 " + cells + " 삭제(보관 " + archived + "행) · 헤더 " + present.length + "열 삭제 → " + hs.length + "열");
    return { rows: rows.length, touched: touched, cellsRemoved: cells, archived: archived, headersRemoved: present, headers: hs.length };
  }
};
