// 011 — ops_대관일정(292행 16열) + special(33행 11열) → ops_운영일정 구분 행(열은 원래 이름 그대로 합집합 23열). [260905 통합⑤ · 운영자 "유사한 표는 열로 합친다"]
//   옛 시트는 행+목록 삭제(백업 backups/ops-대관일정-260905-0110.json · sheet-special-260905-0110.json). 앱 무수정 — 창구 api/ym-views-lib.js(VIEWS 대관일정·special).
module.exports = {
  id: "011",
  title: "대관일정+special → 운영일정(구분 행, 합집합 열)",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var TABLE = "ops_운영일정";
    var HDR = ["날짜","구분","시간","일정ID","명칭","장소","시작일","종료일","공연일","리허설일","종일","시작시간","종료시간","비고","출처","원제목","입력시간(KST)","작성자","#","시리얼","유형","내용","담당자"];
    var SRC = [ { sheet: "ops_대관일정", part: "대관", cols: ["일정ID","명칭","구분","장소","시작일","종료일","공연일","리허설일","종일","시작시간","종료시간","비고","출처","원제목","입력시간(KST)","작성자"] },
                { sheet: "special", part: "특이일정", cols: ["#","입력시간(KST)","시리얼","시작일","종료일","시간","유형","내용","담당자","작성자","비고"] } ];
    var tm = ctx.meta(TABLE); if (!tm) throw new Error(TABLE + " 없음(008 먼저)");
    var hs = ctx.parseJson(tm.get("headers"), []); for (var h0 = 0; h0 < HDR.length; h0++) if (hs.indexOf(HDR[h0]) < 0) hs.push(HDR[h0]);
    tm.set("headers", hs); ctx.app.save(tm);
    var dc = ctx.col("ymdata"), nri = tm.get("nextRowIndex") || 2, n = 0, detail = {};
    for (var s = 0; s < SRC.length; s++) {
      var src = SRC[s], meta = ctx.meta(src.sheet); if (!meta) { detail[src.sheet] = "없음"; continue; }
      var oh = ctx.parseJson(meta.get("headers"), []);
      for (var x = 0; x < oh.length; x++) if (nz(oh[x]) && src.cols.indexOf(oh[x]) < 0) throw new Error(src.sheet + " 미매핑 열: " + oh[x]);
      var rows = ctx.sheetRows(src.sheet), moved = 0;
      for (var i = 0; i < rows.length; i++) {
        var d = ctx.parseJson(rows[i].publicExport().data, {}), o = {}, any = false;
        for (var h = 0; h < hs.length; h++) o[hs[h]] = "";
        for (var c = 0; c < src.cols.length; c++) { var raw = d[src.cols[c]]; o[src.cols[c]] = (raw === undefined || raw === null) ? "" : raw; if (nz(raw)) any = true; }
        if (!any) continue;
        o["구분"] = src.part;
        ctx.app.save(new Record(dc, { sheet: TABLE, rowIndex: nri, data: o })); nri++; n++; moved++;
      }
      for (var r = 0; r < rows.length; r++) ctx.app.delete(rows[r]);
      ctx.app.delete(meta);
      detail[src.sheet] = { rows: rows.length, moved: moved };
      ctx.log(src.sheet + " → " + moved + "행");
    }
    tm.set("rowCount", (tm.get("rowCount") || 0) + n); tm.set("nextRowIndex", nri); ctx.app.save(tm);
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    return { table: TABLE, added: n, detail: detail, headers: hs.length };
  }
};
