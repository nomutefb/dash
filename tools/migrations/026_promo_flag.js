// 026 — 캘린더 홍보 행에 프로그램홍보(Y/N) 열. [260905 통합⑳ · 운영자 "프로그램 홍보 여부에 따라 프로그램ID 참조 여부가 결정"]
//   Y = 프로그램ID 가 있는 홍보(프로그램 홍보) · N = 프로그램 없는 일반 홍보(월간 일정·채용 공고 등, 프로그램 칸 '기타'/빈 값). 쓰기 때 창구가 채우고, 재색인(POST /api/ym/codes/reindex)도 채운다.
module.exports = {
  id: "026",
  title: "캘린더 프로그램홍보(Y/N) 열",
  up: function (ctx) {
    var C = require(__hooks + "/ym-codes-lib.js"), km = ctx.meta("ops_캘린더"); if (!km) throw new Error("ops_캘린더 없음");
    var kh = ctx.parseJson(km.get("headers"), []); if (kh.indexOf("프로그램홍보") < 0) { kh.push("프로그램홍보"); km.set("headers", kh); ctx.app.save(km); }
    var ri = C.reindexCalendar(ctx.app, ctx.col);
    var rows = ctx.sheetRows("ops_캘린더"), y = 0, n = 0, odd = [];
    for (var i = 0; i < rows.length; i++) { var d = ctx.parseJson(rows[i].publicExport().data, {}); if (String(d["구분"] || "") !== "홍보") continue; if (d["프로그램홍보"] === "Y") y++; else { n++; var p = String(d["프로그램"] || "").trim(); if (p && p !== "기타") odd.push(String(d["일정ID"]) + " 프로그램=" + p); } }
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    ctx.log("프로그램홍보 Y " + y + " · N " + n + " · N 인데 프로그램 칸에 이름이 있는 옛 행 " + odd.length);
    return { Y: y, N: n, nameButNoId: odd, reindex: ri };
  }
};
