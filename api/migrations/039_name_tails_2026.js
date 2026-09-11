// 039 — 038에서 미뤘던 2026 행 4건(판매 조인 _uName 이 "- 여수" 를 이미 무시하는 것 확인 후 적용). 규칙·보관 방식은 038과 같고 이관 번호만 039.
var DATA = [["26-c01","2026 화요살롱 이낙준(한산이가) - 여수","2026 화요살롱 이낙준(한산이가)"],["260404_01","가족뮤지컬 <에그박사 : 해적 보물섬의 비밀> - 여수","가족뮤지컬 <에그박사 : 해적 보물섬의 비밀>"],["260404_02","지브리와 사랑에 빠지다 : 지브리 영화음악 콘서트 2026 - 여수","지브리와 사랑에 빠지다 : 지브리 영화음악 콘서트 2026"],["260425_01","쇼뮤지컬 <프린세스 캐치!티니핑> - 여수","쇼뮤지컬 <프린세스 캐치!티니핑>"]]; // [프로그램ID, 현재 정본명, 새 정본명]
module.exports = {
  id: "039",
  title: "이름 꾸리표 정리 2026 보충(" + DATA.length + "건)",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var MASTER = "ops_프로그램마스터", ARCH = "_ym_col_archive";
    var rows = ctx.sheetRows(MASTER), byId = {};
    for (var i = 0; i < rows.length; i++) { var d0 = ctx.parseJson(rows[i].publicExport().data, {}); var id0 = nz(d0["프로그램ID"]); if (id0) byId[id0] = { rec: rows[i], d: d0 }; }
    var am = ctx.meta(ARCH), dc = ctx.col("ymdata");
    var ari = am.get("nextRowIndex") || 2, ari0 = ari, changed = 0, skipped = [], missing = [];
    for (var k = 0; k < DATA.length; k++) {
      var it = DATA[k], R = byId[it[0]];
      if (!R) { missing.push(it[0]); continue; }
      var cur = String(R.d["정본명"] === undefined || R.d["정본명"] === null ? "" : R.d["정본명"]);
      if (cur !== it[1]) { skipped.push(it[0]); continue; }
      if (cur === it[2]) continue;
      ctx.app.save(new Record(dc, { sheet: ARCH, rowIndex: ari, data: { "프로그램ID": it[0], "구분": nz(R.d["구분"]), "이관": "039", "기준명": cur, "원본": JSON.stringify({ "정본명": cur, "새이름": it[2] }) } })); ari++;
      R.d["정본명"] = it[2]; R.rec.set("data", R.d); ctx.app.save(R.rec); changed++;
    }
    am.set("rowCount", (am.get("rowCount") || 0) + (ari - ari0)); am.set("nextRowIndex", ari); ctx.app.save(am);
    return { changed: changed, skipped: skipped, missing: missing, total: DATA.length };
  }
};
