// 040 — 038에서 장도 표시만 떼고 장소가 비어 있던 2행의 장소를 운영자 지시대로 채움(260905).
var DATA = [["211218_02","장도 전시실"],["211015_02","장도 야외 광장"]]; // [프로그램ID, 장소]
module.exports = {
  id: "040",
  title: "장도 행 장소 보충(2건)",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var rows = ctx.sheetRows("ops_프로그램마스터"), byId = {};
    for (var i = 0; i < rows.length; i++) { var d0 = ctx.parseJson(rows[i].publicExport().data, {}); var id0 = nz(d0["프로그램ID"]); if (id0) byId[id0] = { rec: rows[i], d: d0 }; }
    var changed = 0, skipped = [];
    for (var k = 0; k < DATA.length; k++) { var it = DATA[k], R = byId[it[0]]; if (!R) { skipped.push(it[0] + ": 없음"); continue; } if (nz(R.d["장소"])) { skipped.push(it[0] + ": 이미 " + R.d["장소"]); continue; } R.d["장소"] = it[1]; R.rec.set("data", R.d); ctx.app.save(R.rec); changed++; }
    return { changed: changed, skipped: skipped };
  }
};
