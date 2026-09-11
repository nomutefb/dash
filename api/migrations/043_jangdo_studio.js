// 043 — 041에서 장도 창작스튜디오를 장도 전시실로 합친 것을 되돌림(운영자: "장도 창작 스튜디오는 그 자체가 장소"). 표기 = 장도 창작 스튜디오. 옛 값은 _ym_col_archive(이관=043).
var DATA = [["200601_01","장도 전시실","장도 창작 스튜디오, 장도 전시실"],["230101_01","장도 전시실","장도 창작 스튜디오"],["240101_01","장도 전시실","장도 창작 스튜디오"],["250101_01","장도 전시실","장도 창작 스튜디오"]];
module.exports = { id: "043", title: "장소: 장도 창작 스튜디오 복원(" + DATA.length + "건)", up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var rows = ctx.sheetRows("ops_프로그램마스터"), byId = {};
    for (var i = 0; i < rows.length; i++) { var d0 = ctx.parseJson(rows[i].publicExport().data, {}); var id0 = nz(d0["프로그램ID"]); if (id0) byId[id0] = { rec: rows[i], d: d0 }; }
    var am = ctx.meta("_ym_col_archive"), dc = ctx.col("ymdata"), ari = am.get("nextRowIndex") || 2, ari0 = ari, changed = 0, skipped = [];
    for (var k = 0; k < DATA.length; k++) { var it = DATA[k], R = byId[it[0]]; if (!R || nz(R.d["장소"]) !== it[1]) { skipped.push(it[0]); continue; }
      ctx.app.save(new Record(dc, { sheet: "_ym_col_archive", rowIndex: ari, data: { "프로그램ID": it[0], "구분": nz(R.d["구분"]), "이관": "043", "기준명": nz(R.d["정본명"]), "원본": JSON.stringify({ "장소": it[1], "새장소": it[2] }) } })); ari++;
      R.d["장소"] = it[2]; R.rec.set("data", R.d); ctx.app.save(R.rec); changed++; }
    am.set("rowCount", (am.get("rowCount") || 0) + (ari - ari0)); am.set("nextRowIndex", ari); ctx.app.save(am);
    return { changed: changed, skipped: skipped, total: DATA.length }; } };
