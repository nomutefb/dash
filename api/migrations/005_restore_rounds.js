// 005 — 004 되돌리기. 판매설정.공연일목록 문자열을 다시 ops_회차 행(프로그램ID·구분·공연일·오픈좌석)으로 만들고, 공연일목록 열·값을 지운다. [260904 어제 세션 판정: 정본 3표(판매설정·회차·일일실적) 유지]
module.exports = {
  id: "005",
  title: "회차 표 복원(004 되돌리기) — 판매설정.공연일목록 → ops_회차, 열 삭제",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var dc = ctx.col("ymdata"), mc = ctx.col("ymmeta");
    if (ctx.meta("ops_회차")) throw new Error("ops_회차 시트가 이미 있음 — 복원 중단");
    var sales = ctx.sheetRows("ops_판매설정"), rows = [], programs = 0, cleared = 0;
    for (var i = 0; i < sales.length; i++) {
      var rec = sales[i], d = ctx.parseJson(rec.publicExport().data, {});
      if (!Object.prototype.hasOwnProperty.call(d, "공연일목록")) continue;
      var str = nz(d["공연일목록"]), id = nz(d["프로그램ID"]), part = nz(d["구분"]) || "공연";
      if (str) {
        programs++;
        var parts = str.split("|");
        for (var j = 0; j < parts.length; j++) {
          var t = nz(parts[j]); if (!t) continue;
          var p = t.split(":");
          rows.push({ "프로그램ID": id, "구분": part, "공연일": nz(p[0]), "오픈좌석": nz(p[1]) });
        }
        ctx.log(id + "|" + part + " → " + parts.length + "회차");
      }
      delete d["공연일목록"];
      rec.set("data", d); ctx.app.save(rec); cleared++;
    }
    var hdr = ["프로그램ID","구분","공연일","오픈좌석"];
    for (var k = 0; k < rows.length; k++) { ctx.app.save(new Record(dc, { sheet: "ops_회차", rowIndex: k + 2, data: rows[k] })); }
    ctx.app.save(new Record(mc, { sheet: "ops_회차", headers: hdr, source: "unified", rowCount: rows.length, nextRowIndex: rows.length + 2 }));
    var sm = ctx.meta("ops_판매설정");
    if (sm) { var hs = ctx.parseJson(sm.get("headers"), []), out = []; for (var h = 0; h < hs.length; h++) { if (hs[h] !== "공연일목록") out.push(hs[h]); } sm.set("headers", out); ctx.app.save(sm); }
    return { programs: programs, roundsRestored: rows.length, salesRowsCleared: cleared };
  }
};
