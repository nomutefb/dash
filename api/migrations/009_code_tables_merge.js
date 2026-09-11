// 009 — platforms(플랫폼1~3, 10행) + contents(콘텐츠구분·콘텐츠형식·진행상태, 5행) + applysettings(키·값, 12행) → ops_코드표(구분 + 원래 열). [260904 통합④]
//   옛 시트는 행+목록 삭제(백업 backups/sheet-{platforms,contents,applysettings}-260904-2350.json). 앱 무수정 — 훅 창구(api/ym-views-lib.js)가 /api/sheet/platform|content|applysettings 를 구분 행으로 번역.
module.exports = {
  id: "009",
  title: "platforms+contents+applysettings → 코드표(구분 + 원래 열)",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var TABLE = "ops_코드표", HDR = ["구분","플랫폼1","플랫폼2","플랫폼3","콘텐츠구분","콘텐츠형식","진행상태","키","값"];
    var SRC = [ { sheet: "platforms", part: "platforms", cols: ["플랫폼1", "플랫폼2", "플랫폼3"] }, { sheet: "contents", part: "contents", cols: ["콘텐츠구분", "콘텐츠형식", "진행상태"] }, { sheet: "applysettings", part: "applysettings", cols: ["키", "값"] } ];
    if (ctx.meta(TABLE)) throw new Error(TABLE + " 이 이미 있음 — 중단");
    var dc = ctx.col("ymdata"), mc = ctx.col("ymmeta"), n = 0, detail = {};
    for (var s = 0; s < SRC.length; s++) {
      var src = SRC[s], meta = ctx.meta(src.sheet); if (!meta) { detail[src.sheet] = "없음"; continue; }
      var oh = ctx.parseJson(meta.get("headers"), []);
      for (var x = 0; x < oh.length; x++) if (nz(oh[x]) && src.cols.indexOf(oh[x]) < 0) throw new Error(src.sheet + " 미매핑 열: " + oh[x]);
      var rows = ctx.sheetRows(src.sheet), moved = 0;
      for (var i = 0; i < rows.length; i++) {
        var d = ctx.parseJson(rows[i].publicExport().data, {}), o = {}, any = false;
        for (var h = 0; h < HDR.length; h++) o[HDR[h]] = "";
        for (var c = 0; c < src.cols.length; c++) { var raw = d[src.cols[c]]; o[src.cols[c]] = (raw === undefined || raw === null) ? "" : raw; if (nz(raw)) any = true; }
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
