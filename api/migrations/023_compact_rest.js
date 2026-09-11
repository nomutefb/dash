// 023 — 나머지 표 저장 다이어트(022 마스터와 같은 규칙). [260905 통합⑯-3 · 운영자 "같은 개념으로"]
//   ymdata 의 모든 행(일일실적·캘린더·코드표·managers·messages·시스템 행)에서 빈 칸("")·_json 을 뺀다. 프로그램ID 는 남긴다. 값이 있는 칸은 그대로.
module.exports = {
  id: "023",
  title: "전 표 저장 다이어트(빈 칸 제거) — 마스터 제외 나머지",
  up: function (ctx) {
    var C = require(__hooks + "/ym-compact-lib.js");
    var recs = ctx.app.findRecordsByFilter(ctx.col("ymdata"), "sheet != 'ops_프로그램마스터'", "sheet,rowIndex", 100000, 0);
    var per = {}, touched = 0, removed = 0, before = 0, after = 0;
    for (var i = 0; i < recs.length; i++) {
      var sh = String(recs[i].get("sheet")), d = ctx.parseJson(recs[i].publicExport().data, {});
      var b = JSON.stringify(d).length; before += b;
      var r = C.compact(d); var a = JSON.stringify(r.data).length; after += a;
      if (!per[sh]) per[sh] = { rows: 0, touched: 0, removed: 0, before: 0, after: 0 };
      per[sh].rows++; per[sh].before += b; per[sh].after += a;
      if (r.changed) { recs[i].set("data", r.data); ctx.app.save(recs[i]); touched++; removed += r.removed; per[sh].touched++; per[sh].removed += r.removed; }
    }
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    ctx.log("행 " + recs.length + " · 정리 " + touched + " · 빈 칸 " + removed + " · 저장 문자 " + before + " → " + after);
    return { rows: recs.length, touched: touched, removed: removed, charsBefore: before, charsAfter: after, per: per };
  }
};
