// 050 — 장소 빈칸 마지막 6행(260905, 운영자 지시 + 세부운영관리대장 확인). 이전 검색이 대장의 월 칸 "7월" 문자열을 숫자로 안 바꿔 정화용·예술영재 행을 놓쳤던 것.
var DATA = [["221001_02","예울마루 야외 일원"],["131211_01","7층 전시실"],["220712_01","7층 전시실"],["200725_01","소극장"],["200731_01","소극장"],["191009_02","대극장"]];
module.exports = { id: "050", title: "장소 빈칸 마무리(6건)", up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var rows = ctx.sheetRows("ops_프로그램마스터"), byId = {};
    for (var i = 0; i < rows.length; i++) { var d0 = ctx.parseJson(rows[i].publicExport().data, {}); var id0 = nz(d0["프로그램ID"]); if (id0) byId[id0] = { rec: rows[i], d: d0 }; }
    var changed = 0, skipped = [];
    for (var k = 0; k < DATA.length; k++) { var it = DATA[k], R = byId[it[0]]; if (!R || nz(R.d["장소"])) { skipped.push(it[0]); continue; } R.d["장소"] = it[1]; R.rec.set("data", R.d); ctx.app.save(R.rec); changed++; }
    return { changed: changed, skipped: skipped }; } };
