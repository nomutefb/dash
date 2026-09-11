// 049 — 장소 빈칸 채움 3차(260905): 세부운영관리대장 같은 날·같은 이름 행. 빈칸일 때만.
var DATA = [["200314_01","대극장"],["240130_01","소극장"]];
module.exports = { id: "049", title: "장소 빈칸 채움 3차(2건)", up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var rows = ctx.sheetRows("ops_프로그램마스터"), byId = {};
    for (var i = 0; i < rows.length; i++) { var d0 = ctx.parseJson(rows[i].publicExport().data, {}); var id0 = nz(d0["프로그램ID"]); if (id0) byId[id0] = { rec: rows[i], d: d0 }; }
    var changed = 0, skipped = [];
    for (var k = 0; k < DATA.length; k++) { var it = DATA[k], R = byId[it[0]]; if (!R || nz(R.d["장소"])) { skipped.push(it[0]); continue; } R.d["장소"] = it[1]; R.rec.set("data", R.d); ctx.app.save(R.rec); changed++; }
    return { changed: changed, skipped: skipped }; } };
