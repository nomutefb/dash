// 037 — 036에서 건너뛴 6건(현재 이름 글자 코드가 파일과 미세하게 달라 안전장치에 걸림). ID로만 찾아 정본명을 보고서 이름으로 바꾼다. 옛 이름은 _ym_col_archive(이관=037)에 보관.
var DATA = [["211127_01","여문 樂 페스티벌"],["211219_01","피아졸라 퀵텟 100주년 콘서트"],["190627_01","피아니스트 강현주의 브런치콘서트 <음악가들의 뮤즈들Ⅱ> - 비엔나의 팬믈파탈, 알마와 말러"],["190926_01","트리오제이 창단연주회 1ST concert"],["180719_01","에스챔버소사이어티 제2회 정기연주회"],["181214_01","여수심포니오케스트라 멘델스졸의 밤"]]; // [프로그램ID, 새 정본명]
module.exports = {
  id: "037",
  title: "보고서 기준 이름 통일 보충(6건)",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var MASTER = "ops_프로그램마스터", ARCH = "_ym_col_archive";
    var rows = ctx.sheetRows(MASTER), byId = {};
    for (var i = 0; i < rows.length; i++) { var d0 = ctx.parseJson(rows[i].publicExport().data, {}); var id0 = nz(d0["프로그램ID"]); if (id0) byId[id0] = { rec: rows[i], d: d0 }; }
    var am = ctx.meta(ARCH), dc = ctx.col("ymdata");
    var ari = am.get("nextRowIndex") || 2, ari0 = ari, changed = 0, missing = [];
    for (var k = 0; k < DATA.length; k++) {
      var it = DATA[k], R = byId[it[0]];
      if (!R) { missing.push(it[0]); continue; }
      var cur = nz(R.d["정본명"]); if (cur === nz(it[1])) continue;
      ctx.app.save(new Record(dc, { sheet: ARCH, rowIndex: ari, data: { "프로그램ID": it[0], "구분": nz(R.d["구분"]), "이관": "037", "기준명": cur, "원본": JSON.stringify({ "정본명": cur, "새이름": it[1] }) } })); ari++;
      R.d["정본명"] = it[1]; R.rec.set("data", R.d); ctx.app.save(R.rec); changed++;
    }
    am.set("rowCount", (am.get("rowCount") || 0) + (ari - ari0)); am.set("nextRowIndex", ari); ctx.app.save(am);
    return { changed: changed, missing: missing };
  }
};
