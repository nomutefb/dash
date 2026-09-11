// 022 — 프로그램마스터 저장 다이어트. [260905 통합⑯-2 · 운영자 "방금 작업만 진행" = 응답 경량화(훅 v371)에 이어 저장 자체를 줄인다]
//   행마다 빈 칸("")인 열과 _json 열(훅·앱 어디서도 안 읽음, 실측 0건)을 지운다. 읽는 쪽은 훅 rowsFor/창구가 없는 열을 "" 로 채워 돌려주므로 결과 동일.
//   프로그램ID 는 빈 값이어도 남긴다(키). 목록(headers)에서 _json 을 뺀다. 값이 있는 칸은 하나도 건드리지 않는다.
module.exports = {
  id: "022",
  title: "프로그램마스터 저장 다이어트(빈 칸·_json 제거)",
  up: function (ctx) {
    var MASTER = "ops_프로그램마스터";
    var mm = ctx.meta(MASTER); if (!mm) throw new Error(MASTER + " 없음");
    var hs = ctx.parseJson(mm.get("headers"), []), hadJson = hs.indexOf("_json") >= 0;
    var rows = ctx.sheetRows(MASTER), touched = 0, emptyCells = 0, jsonCells = 0, before = 0, after = 0, kept = 0;
    for (var i = 0; i < rows.length; i++) {
      var d = ctx.parseJson(rows[i].publicExport().data, {}), o = {}, changed = false, ks = Object.keys(d);
      before += JSON.stringify(d).length;
      for (var k = 0; k < ks.length; k++) {
        var key = ks[k], v = d[key];
        if (key === "_json") { jsonCells++; changed = true; continue; }
        if ((v === "" || v === null || v === undefined) && key !== "프로그램ID") { emptyCells++; changed = true; continue; }
        o[key] = v; kept++;
      }
      if (!Object.prototype.hasOwnProperty.call(o, "프로그램ID")) o["프로그램ID"] = String(d["프로그램ID"] === undefined || d["프로그램ID"] === null ? "" : d["프로그램ID"]);
      after += JSON.stringify(o).length;
      if (changed) { rows[i].set("data", o); ctx.app.save(rows[i]); touched++; }
    }
    if (hadJson) { hs = hs.filter(function (h) { return h !== "_json"; }); mm.set("headers", hs); ctx.app.save(mm); }
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    ctx.log("마스터 " + rows.length + "행 중 " + touched + "행 정리 · 빈 칸 " + emptyCells + " · _json " + jsonCells + " · 저장 문자 " + before + " → " + after);
    return { rows: rows.length, touched: touched, emptyCells: emptyCells, jsonCells: jsonCells, keptCells: kept, charsBefore: before, charsAfter: after, headers: hs.length, jsonHeaderRemoved: hadJson };
  }
};
