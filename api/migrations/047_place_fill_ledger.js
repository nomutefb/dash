// 047 — 장소 빈칸 채움 2차(260905): 운영자 제공 「2026 예울마루 공연장 운영 관리대장.xlsx」 세부운영관리대장(가운데 시트)·공연장운영관리대장(첫 시트)에서 같은 날·같은 이름 행의 공연장소. 세빌리아 계획행=대극장(운영자 지시). 빈칸일 때만 채운다.
var DATA = [["211101_01","대극장"],["150908_01","대극장"],["200328_01","대극장"],["200829_01","대극장"],["200920_01","소극장"],["200925_02","대극장"],["200925_03","소극장"],["200927_01","소극장"],["210901_01","대극장"],["200826_01","대극장"],["200908_01","대극장"],["200922_01","대극장"],["200926_01","소극장"],["200325_01","대극장"],["200717_01","소극장"],["191214_02","소극장"],["210711_03","소극장"],["210915_02","대극장"],["180719_01","소극장"],["181222_01","대극장"],["231029_01","소극장"],["171030_01","대극장"]];
module.exports = { id: "047", title: "장소 빈칸 채움(운영관리대장, " + DATA.length + "건)", up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var rows = ctx.sheetRows("ops_프로그램마스터"), byId = {};
    for (var i = 0; i < rows.length; i++) { var d0 = ctx.parseJson(rows[i].publicExport().data, {}); var id0 = nz(d0["프로그램ID"]); if (id0) byId[id0] = { rec: rows[i], d: d0 }; }
    var changed = 0, skipped = [];
    for (var k = 0; k < DATA.length; k++) { var it = DATA[k], R = byId[it[0]]; if (!R || nz(R.d["장소"])) { skipped.push(it[0]); continue; } R.d["장소"] = it[1]; R.rec.set("data", R.d); ctx.app.save(R.rec); changed++; }
    return { changed: changed, skipped: skipped, total: DATA.length }; } };
