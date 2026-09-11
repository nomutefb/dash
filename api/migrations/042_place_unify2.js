// 042 — 장소 표기 통일 2차(260905, 운영자 지시): 4층데크·4F로비 → 4층 테라스, 분수광장·분수 광장·야외공연장 바닥분수 → 예울마루 바닥 분수. 옛 값은 _ym_col_archive(이관=042).
var DATA = [["120510_01","분수광장","예울마루 바닥 분수"],["120704_01","분수광장","예울마루 바닥 분수"],["121020_01","분수광장","예울마루 바닥 분수"],["131007_01","분수광장","예울마루 바닥 분수"],["131019_01","분수광장","예울마루 바닥 분수"],["141009_01","분수 광장","예울마루 바닥 분수"],["150930_02","4층데크","4층 테라스"],["160722_01","분수광장","예울마루 바닥 분수"],["180512_01","4층데크","4층 테라스"],["220917_01","분수광장","예울마루 바닥 분수"],["250517_01","야외공연장 바닥분수","예울마루 바닥 분수"]];
module.exports = { id: "042", title: "장소 표기 통일 2차(" + DATA.length + "건)", up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var rows = ctx.sheetRows("ops_프로그램마스터"), byId = {};
    for (var i = 0; i < rows.length; i++) { var d0 = ctx.parseJson(rows[i].publicExport().data, {}); var id0 = nz(d0["프로그램ID"]); if (id0) byId[id0] = { rec: rows[i], d: d0 }; }
    var am = ctx.meta("_ym_col_archive"), dc = ctx.col("ymdata"), ari = am.get("nextRowIndex") || 2, ari0 = ari, changed = 0, skipped = [];
    for (var k = 0; k < DATA.length; k++) { var it = DATA[k], R = byId[it[0]]; if (!R || nz(R.d["장소"]) !== it[1]) { skipped.push(it[0]); continue; }
      ctx.app.save(new Record(dc, { sheet: "_ym_col_archive", rowIndex: ari, data: { "프로그램ID": it[0], "구분": nz(R.d["구분"]), "이관": "042", "기준명": nz(R.d["정본명"]), "원본": JSON.stringify({ "장소": it[1], "새장소": it[2] }) } })); ari++;
      R.d["장소"] = it[2]; R.rec.set("data", R.d); ctx.app.save(R.rec); changed++; }
    am.set("rowCount", (am.get("rowCount") || 0) + (ari - ari0)); am.set("nextRowIndex", ari); ctx.app.save(am);
    return { changed: changed, skipped: skipped, total: DATA.length }; } };
