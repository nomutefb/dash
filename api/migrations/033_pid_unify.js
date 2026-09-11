// 033 — 프로그램ID 형식 통일. [260905 · 운영자 "프로그램 id를 동일한 형태로 통일, 같은 날이면 뒤만 다르게"]
//   구글 캘린더에서 온 대관 행 46건은 일정ID(R260428_em5q) 가 프로그램ID 칸에 들어 있었다 → 다른 프로그램과 같은 규칙 YYMMDD_NN(시작일 + 그날 미사용 순번)으로.
//   옛 일정ID 는 구ID 칸에 보존(캘린더ID gcal:… 는 그대로). 일일실적·캘린더가 옛 ID 를 가리키면 실패(실측 0건).
module.exports = {
  id: "033",
  title: "프로그램ID 통일 — 캘린더 대관 R… → YYMMDD_NN",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var MASTER = "ops_프로그램마스터";
    var rows = ctx.sheetRows(MASTER), used = {}, targets = [];
    for (var i = 0; i < rows.length; i++) { var d = ctx.parseJson(rows[i].publicExport().data, {}); var id = nz(d["프로그램ID"]); if (id) used[id] = 1; if (nz(d["구분"]) !== "사업" && /^R\d{6}_/.test(id)) targets.push({ rec: rows[i], d: d, old: id }); }
    var check = function (sheet) { var rs = ctx.sheetRows(sheet), hit = []; for (var j = 0; j < rs.length; j++) { var x = ctx.parseJson(rs[j].publicExport().data, {}); if (/^R\d{6}_/.test(nz(x["프로그램ID"]))) hit.push(nz(x["프로그램ID"])); } return hit; };
    var dh = check("ops_일일실적"), ch = check("ops_캘린더");
    if (dh.length || ch.length) throw new Error("옛 ID 를 가리키는 행: 일일실적 " + dh.length + " · 캘린더 " + ch.length);
    targets.sort(function (a, b) { return a.old < b.old ? -1 : a.old > b.old ? 1 : 0; });
    var map = [];
    for (var t = 0; t < targets.length; t++) {
      var T = targets[t], s = nz(T.d["시작일"]).replace(/[^0-9]/g, "");
      if (!/^\d{8}$/.test(s)) throw new Error("시작일 없음: " + T.old);
      var pre = s.slice(2), n = 1, nid = "";
      while (n < 100) { nid = pre + "_" + (n < 10 ? "0" + n : String(n)); if (!used[nid]) break; n++; }
      if (used[nid]) throw new Error("순번 소진: " + pre);
      used[nid] = 1;
      T.d["프로그램ID"] = nid; if (!nz(T.d["구ID"])) T.d["구ID"] = T.old;
      T.rec.set("data", T.d); ctx.app.save(T.rec);
      map.push(T.old + " → " + nid);
    }
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    ctx.log("ID 바꾼 행 " + map.length);
    return { renamed: map };
  }
};
