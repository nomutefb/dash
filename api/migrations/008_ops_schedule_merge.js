// 008 — ops_장도(날짜·입도가능시간 214행) + ops_카페일정(날짜·운영시간 61행) → ops_운영일정(날짜·구분·시간). [260904 통합③ · 운영자 "유사한 표는 열로 합친다"]
//   옛 시트는 행+목록 삭제(백업 backups/ops-장도-260904-2350.json · ops-카페일정-260904-2350.json). 앱은 무수정 — 훅 창구(api/ym-views-lib.js)가 /api/ops?sheet=장도|카페일정 를 구분 행으로 번역.
module.exports = {
  id: "008",
  title: "장도+카페일정 → 운영일정(날짜·구분·시간)",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var TABLE = "ops_운영일정", HDR = ["날짜","구분","시간"];
    var SRC = [ { sheet: "ops_장도", part: "장도", cols: [["날짜", "날짜"], ["입도가능시간", "시간"]] }, { sheet: "ops_카페일정", part: "카페", cols: [["날짜", "날짜"], ["운영시간", "시간"]] } ];
    if (ctx.meta(TABLE)) throw new Error(TABLE + " 이 이미 있음 — 중단");
    var dc = ctx.col("ymdata"), mc = ctx.col("ymmeta"), n = 0, detail = {};
    for (var s = 0; s < SRC.length; s++) {
      var src = SRC[s], meta = ctx.meta(src.sheet); if (!meta) { detail[src.sheet] = "없음"; continue; }
      var oh = ctx.parseJson(meta.get("headers"), []), okc = src.cols.map(function (c) { return c[0]; });
      for (var x = 0; x < oh.length; x++) if (nz(oh[x]) && okc.indexOf(oh[x]) < 0) throw new Error(src.sheet + " 미매핑 열: " + oh[x]);
      var rows = ctx.sheetRows(src.sheet), moved = 0;
      for (var i = 0; i < rows.length; i++) {
        var d = ctx.parseJson(rows[i].publicExport().data, {}), o = {}, any = false;
        for (var h = 0; h < HDR.length; h++) o[HDR[h]] = "";
        for (var c = 0; c < src.cols.length; c++) { var raw = d[src.cols[c][0]]; o[src.cols[c][1]] = (raw === undefined || raw === null) ? "" : raw; if (nz(raw)) any = true; }
        if (!any) continue;
        o["구분"] = src.part;
        ctx.app.save(new Record(dc, { sheet: TABLE, rowIndex: n + 2, data: o })); n++; moved++;
      }
      for (var r = 0; r < rows.length; r++) ctx.app.delete(rows[r]);
      ctx.app.delete(meta);
      detail[src.sheet] = { rows: rows.length, moved: moved };
      ctx.log(src.sheet + " → " + moved + "행");
    }
    ctx.app.save(new Record(mc, { sheet: TABLE, headers: HDR, source: "unified", rowCount: n, nextRowIndex: n + 2 }));
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    return { table: TABLE, rows: n, detail: detail };
  }
};
