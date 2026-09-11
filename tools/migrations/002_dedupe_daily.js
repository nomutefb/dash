// 002 — 일일실적(공연) 같은 키(프로그램ID+기준일자) 중복 정리.
//   원인: 260904 이력 흡수 때 옛 일일입력(살아있던 값)과 일일입력_이력(예측제외=Y 표시된 값)이 같은 날짜로 둘 다 들어감(273키).
//   규칙: 같은 키 안에 예측제외≠Y 인 행이 정확히 1개면 그 행만 남김(살아있던 값이 정본) /
//         전부 동일하면 1개만 / 값이 서로 다른데 정본을 못 가리면(250327_01, 250710_02) 둘 다 보존하고 보고.
module.exports = {
  id: "002",
  title: "일일실적(공연) 키 중복 정리",
  up: function (ctx) {
    var col = ctx.col("ymdata"), recs = ctx.sheetRows("ops_일일실적");
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var groups = {}, order = [];
    for (var i = 0; i < recs.length; i++) {
      var d = ctx.parseJson(recs[i].publicExport().data, {});
      if (nz(d["구분"]) !== "공연") continue;
      var k = nz(d["프로그램ID"]) + "|" + nz(d["기준일자"]);
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push({ rec: recs[i], d: d });
    }
    var removed = 0, kept = 0, ambiguous = [];
    for (var j = 0; j < order.length; j++) {
      var g = groups[order[j]];
      if (g.length === 1) continue;
      var live = [], allSame = true, s0 = JSON.stringify(g[0].d);
      for (var a = 0; a < g.length; a++) { if (nz(g[a].d["예측제외"]) !== "Y") live.push(g[a]); if (JSON.stringify(g[a].d) !== s0) allSame = false; }
      var keep = null;
      if (live.length === 1) keep = live[0];
      else if (allSame) keep = g[0];
      else { ambiguous.push(order[j]); continue; }
      for (var b = 0; b < g.length; b++) { if (g[b] === keep) continue; ctx.app.delete(g[b].rec); removed++; }
      kept++;
    }
    var meta = ctx.meta("ops_일일실적");
    if (meta) { meta.set("rowCount", recs.length - removed); ctx.app.save(meta); }
    ctx.log("중복 키 " + kept + "개 정리, " + removed + "행 삭제, 보류 " + ambiguous.length + "키");
    return { removed: removed, dedupedKeys: kept, ambiguous: ambiguous, before: recs.length, after: recs.length - removed };
  }
};
