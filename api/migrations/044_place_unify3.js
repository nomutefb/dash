// 044 — 장소 표기 3차(260905, 운영자가 프로그램 보고 지정): 아카펠라 메이트리=예울마루 바닥 분수, 2019 야외콘서트·2022 G페스티벌 프린지=장도 야외 광장(공연 야외=광장 규칙), 여수필 34회(연기)=대극장. 옛 값 _ym_col_archive(이관=044).
var DATA = [["140531_02","야외공연장","예울마루 바닥 분수"],["191005_03","야외","장도 야외 광장"],["220913_01","야외","장도 야외 광장"],["221101_01","연기","대극장"]];
module.exports = { id: "044", title: "장소 표기 3차(" + DATA.length + "건)", up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var rows = ctx.sheetRows("ops_프로그램마스터"), byId = {};
    for (var i = 0; i < rows.length; i++) { var d0 = ctx.parseJson(rows[i].publicExport().data, {}); var id0 = nz(d0["프로그램ID"]); if (id0) byId[id0] = { rec: rows[i], d: d0 }; }
    var am = ctx.meta("_ym_col_archive"), dc = ctx.col("ymdata"), ari = am.get("nextRowIndex") || 2, ari0 = ari, changed = 0, skipped = [];
    for (var k = 0; k < DATA.length; k++) { var it = DATA[k], R = byId[it[0]]; if (!R || nz(R.d["장소"]) !== it[1]) { skipped.push(it[0]); continue; }
      ctx.app.save(new Record(dc, { sheet: "_ym_col_archive", rowIndex: ari, data: { "프로그램ID": it[0], "구분": nz(R.d["구분"]), "이관": "044", "기준명": nz(R.d["정본명"]), "원본": JSON.stringify({ "장소": it[1], "새장소": it[2] }) } })); ari++;
      R.d["장소"] = it[2]; R.rec.set("data", R.d); ctx.app.save(R.rec); changed++; }
    am.set("rowCount", (am.get("rowCount") || 0) + (ari - ari0)); am.set("nextRowIndex", ari); ctx.app.save(am);
    return { changed: changed, skipped: skipped, total: DATA.length }; } };
