// 027 — 프로그램마스터에서 값이 하나도 없는 열 5개 제거(목표관객·수정자·수정일시·시작시간·종료시간). [260905 통합㉑ · 운영자 "마스터 다시 보면서 적용"]
//   실측: 2,445행 전부 빈 값. 앱·훅 참조는 있지만 값이 없어 결과 동일(없는 열은 "" 로 읽힘). 값이 있는 열은 건드리지 않는다.
module.exports = {
  id: "027",
  title: "마스터 빈 열 5개 제거",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var DROP = ["목표관객","수정자","수정일시","시작시간","종료시간"], mm = ctx.meta("ops_프로그램마스터"); if (!mm) throw new Error("마스터 없음");
    var rows = ctx.sheetRows("ops_프로그램마스터"), used = {};
    for (var i = 0; i < rows.length; i++) { var d = ctx.parseJson(rows[i].publicExport().data, {}); for (var k = 0; k < DROP.length; k++) if (nz(d[DROP[k]])) used[DROP[k]] = (used[DROP[k]] || 0) + 1; }
    if (Object.keys(used).length) throw new Error("값이 있는 열은 못 지움: " + JSON.stringify(used));
    var hs = ctx.parseJson(mm.get("headers"), []), kept = [], removed = [];
    for (var h = 0; h < hs.length; h++) { if (DROP.indexOf(hs[h]) >= 0) removed.push(hs[h]); else kept.push(hs[h]); }
    mm.set("headers", kept); ctx.app.save(mm);
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    ctx.log("열 " + hs.length + " → " + kept.length + " (" + removed.join(",") + ")");
    return { removed: removed, headers: kept.length };
  }
};
