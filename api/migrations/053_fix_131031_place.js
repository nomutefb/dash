// 053 — 052 보충: 131031_02(합창페스티벌 2회)는 분리 뒤 대극장 단독인데 051이 넣은 "대 · 소극장"이 남아 있어 대극장으로. 옛 값은 _ym_col_archive(이관=053).
module.exports = {
  id: "053",
  title: "052 보충 — 131031_02 장소 대극장",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var rows = ctx.sheetRows("ops_프로그램마스터"), R = null;
    for (var i = 0; i < rows.length; i++) { var d = ctx.parseJson(rows[i].publicExport().data, {}); if (nz(d["프로그램ID"]) === "131031_02") { R = { rec: rows[i], d: d }; break; } }
    if (!R) throw new Error("131031_02 없음");
    var old = nz(R.d["장소"]); if (old === "대극장") return { changed: 0 };
    var am = ctx.meta("_ym_col_archive"), ari = am.get("nextRowIndex") || 2;
    ctx.app.save(new Record(ctx.col("ymdata"), { sheet: "_ym_col_archive", rowIndex: ari, data: { "프로그램ID": "131031_02", "구분": nz(R.d["구분"]), "이관": "053", "기준명": nz(R.d["정본명"]), "원본": JSON.stringify({ "장소": old }) } }));
    am.set("rowCount", (am.get("rowCount") || 0) + 1); am.set("nextRowIndex", ari + 1); ctx.app.save(am);
    R.d["장소"] = "대극장"; R.rec.set("data", R.d); ctx.app.save(R.rec);
    return { changed: 1, old: old };
  }
};
