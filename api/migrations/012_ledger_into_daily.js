// 012 — ops_세부운영관리대장정리(2012~ 회차별 발권 2,294행 15열) → ops_일일실적 구분 행(회차발권). [260905 통합⑥ · 운영자 "유사한 표는 열로 합친다"]
//   열 대응: 공연명→명칭, 공연ID→프로그램ID, 년도·월·일→기준일자(YYYY-MM-DD), 그 외는 원래 이름(일일실적 열에 합집합으로 추가).
//   옛 시트는 행+목록 삭제(백업 backups/ops-세부운영관리대장정리-260905-0130-p*.json). 앱 무수정 — 창구 api/ym-views-lib.js(VIEWS 세부운영관리대장정리).
module.exports = {
  id: "012",
  title: "세부운영관리대장정리 → 일일실적(구분 회차발권)",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var TABLE = "ops_일일실적", SRC = "ops_세부운영관리대장정리", PART = "회차발권";
    var ADD = ["전체순번","사업구분","공연구분","장르1","티켓구분","기본좌석","발권유료","발권초대","상태","사업코드"];
    var MAP = {"공연명":"명칭","공연ID":"프로그램ID","전체순번":"전체순번","사업구분":"사업구분","공연구분":"공연구분","장르1":"장르1","티켓구분":"티켓구분","기본좌석":"기본좌석","발권유료":"발권유료","발권초대":"발권초대","상태":"상태","사업코드":"사업코드"};
    var tm = ctx.meta(TABLE); if (!tm) throw new Error(TABLE + " 없음");
    var sm = ctx.meta(SRC); if (!sm) throw new Error(SRC + " 없음 — 이미 통합됐거나 대상 아님");
    var oh = ctx.parseJson(sm.get("headers"), []);
    for (var x = 0; x < oh.length; x++) { var hh = nz(oh[x]); if (hh && !MAP[hh] && ["년도", "월", "일"].indexOf(hh) < 0) throw new Error(SRC + " 미매핑 열: " + hh); }
    var hs = ctx.parseJson(tm.get("headers"), []); for (var a = 0; a < ADD.length; a++) if (hs.indexOf(ADD[a]) < 0) hs.push(ADD[a]);
    tm.set("headers", hs); ctx.app.save(tm);
    var rows = ctx.sheetRows(SRC), dc = ctx.col("ymdata"), nri = tm.get("nextRowIndex") || 2, moved = 0, badDate = 0, noId = 0;
    for (var i = 0; i < rows.length; i++) {
      var d = ctx.parseJson(rows[i].publicExport().data, {}), o = {}, any = false;
      for (var h = 0; h < hs.length; h++) o[hs[h]] = "";
      var mk = Object.keys(MAP); for (var c = 0; c < mk.length; c++) { var raw = d[mk[c]]; if (raw === undefined || raw === null) raw = ""; o[MAP[mk[c]]] = raw; if (nz(raw)) any = true; }
      var y = nz(d["년도"]), mo = nz(d["월"]), da = nz(d["일"]);
      if (y && mo && da && +mo >= 1 && +mo <= 12 && +da >= 1 && +da <= 31) o["기준일자"] = y + "-" + ("0" + mo).slice(-2) + "-" + ("0" + da).slice(-2); else if (y || mo || da) { badDate++; o["기준일자"] = ""; ctx.log("날짜 불량: " + y + "/" + mo + "/" + da + " " + nz(d["공연명"])); }
      if (!nz(o["프로그램ID"])) noId++;
      if (!any) continue;
      o["구분"] = PART;
      ctx.app.save(new Record(dc, { sheet: TABLE, rowIndex: nri, data: o })); nri++; moved++;
    }
    for (var r = 0; r < rows.length; r++) ctx.app.delete(rows[r]);
    ctx.app.delete(sm);
    tm.set("rowCount", (tm.get("rowCount") || 0) + moved); tm.set("nextRowIndex", nri); ctx.app.save(tm);
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    return { table: TABLE, src: rows.length, moved: moved, badDate: badDate, noId: noId, headers: hs.length };
  }
};
