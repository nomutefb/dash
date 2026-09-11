// 046 — 장소 빈칸 채움(260905): yeulmaru.org 검색으로 같은 이름·같은 날짜 페이지를 찾은 14행. 장도 잔디광장 → 장도 야외 광장(공연 규칙). 빈칸일 때만 채운다.
var DATA = [["190321_02","7층 전시실"],["220701_02","7층 전시실"],["250522_01","대극장"],["161027_01","대극장"],["210910_02","7층 전시실"],["210923_01","7층 전시실"],["211118_02","소극장"],["221127_02","대극장"],["250517_02","장도 야외 광장"],["171216_01","대극장"],["200718_02","대극장"],["200710_01","대극장"],["250116_01","대극장"],["200215_01","대극장"]];
module.exports = { id: "046", title: "장소 빈칸 채움(홈페이지, " + DATA.length + "건)", up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var rows = ctx.sheetRows("ops_프로그램마스터"), byId = {};
    for (var i = 0; i < rows.length; i++) { var d0 = ctx.parseJson(rows[i].publicExport().data, {}); var id0 = nz(d0["프로그램ID"]); if (id0) byId[id0] = { rec: rows[i], d: d0 }; }
    var changed = 0, skipped = [];
    for (var k = 0; k < DATA.length; k++) { var it = DATA[k], R = byId[it[0]]; if (!R || nz(R.d["장소"])) { skipped.push(it[0]); continue; } R.d["장소"] = it[1]; R.rec.set("data", R.d); ctx.app.save(R.rec); changed++; }
    return { changed: changed, skipped: skipped, total: DATA.length }; } };
