// 028 — 프로그램마스터 열 정리 1단계. [260905 통합㉒ · 운영자 "중복쌍 합치고 의미 없이 중첩되거나 의미 없는 열은 없앤다" · 평의회4]
//   지우는 열 12: 앱·훅 참조 0인 6(구사업ID·데이터_보유원천·재무_신뢰도·교육_구분·보고서명·표시_출처)
//     + 기준명(정본명과 중복, 앱 참조는 죽은 코드) + 회차_건수·회차_첫공연일·회차_끝공연일·회차_공연횟수·회차_공연인원합(일일실적 표에서 다시 계산되는 집계, 값 읽는 곳 없음).
//   지운 값은 _ym_col_archive 시트에 행마다 보관(되돌리기용). 표시_분야 빈 행은 판매구분 값으로 채움(9행).
//   기준석·총회차(판매 짝, 총오픈석=기준석×총회차)는 운영자 결정 대기 → 이번엔 안 건드림. 값이 있는 다른 칸은 하나도 안 바꿈.
module.exports = {
  id: "028",
  title: "프로그램마스터 열 정리 1단계(12열 삭제 + 보관 + 표시_분야 보정)",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var MASTER = "ops_프로그램마스터", ARCH = "_ym_col_archive";
    var DROP = ["구사업ID","데이터_보유원천","재무_신뢰도","교육_구분","보고서명","표시_출처","기준명","회차_건수","회차_첫공연일","회차_끝공연일","회차_공연횟수","회차_공연인원합"];
    var mm = ctx.meta(MASTER); if (!mm) throw new Error(MASTER + " 없음");
    var hs = ctx.parseJson(mm.get("headers"), []), present = [];
    for (var a = 0; a < DROP.length; a++) if (hs.indexOf(DROP[a]) >= 0) present.push(DROP[a]);
    // 보관 시트 준비(없으면 생성)
    var am = ctx.meta(ARCH), mc = ctx.col("ymmeta"), dc = ctx.col("ymdata");
    var AH = ["프로그램ID","구분","이관"].concat(DROP);
    if (!am) { am = new Record(mc, { sheet: ARCH, headers: AH, source: "archive", rowCount: 0, nextRowIndex: 2 }); ctx.app.save(am); am = ctx.meta(ARCH); }
    var ari = am.get("nextRowIndex") || 2, archived = 0, alreadyArch = 0;
    var arows = ctx.sheetRows(ARCH), archDone = {};
    for (var b = 0; b < arows.length; b++) { var ad = ctx.parseJson(arows[b].publicExport().data, {}); if (nz(ad["이관"]) === "028") { archDone[nz(ad["프로그램ID"])] = 1; alreadyArch++; } }
    var rows = ctx.sheetRows(MASTER), touched = 0, cells = 0, fixedField = 0, dateNotes = [], dateDiff = 0;
    for (var i = 0; i < rows.length; i++) {
      var d = ctx.parseJson(rows[i].publicExport().data, {}), changed = false, keep = {}, hasKeep = false, id = nz(d["프로그램ID"]);
      // 삭제 전 기록: 회차_첫/끝공연일이 시작일/종료일과 다른 행(참고용)
      var f = nz(d["회차_첫공연일"]), e = nz(d["회차_끝공연일"]), s = nz(d["시작일"]), t = nz(d["종료일"]);
      if ((f && s && f !== s) || (e && t && e !== t)) { dateDiff++; if (dateNotes.length < 40) dateNotes.push(id + " 시작 " + s + "/" + f + " 종료 " + t + "/" + e); }
      for (var k = 0; k < DROP.length; k++) {
        var key = DROP[k];
        if (Object.prototype.hasOwnProperty.call(d, key)) { if (nz(d[key])) { keep[key] = d[key]; hasKeep = true; cells++; } delete d[key]; changed = true; }
      }
      if (!nz(d["표시_분야"]) && nz(d["판매구분"])) { d["표시_분야"] = nz(d["판매구분"]); fixedField++; changed = true; }
      if (hasKeep && !archDone[id]) { var ar = { "프로그램ID": id, "구분": nz(d["구분"]), "이관": "028" }; for (var kk in keep) ar[kk] = keep[kk]; ctx.app.save(new Record(dc, { sheet: ARCH, rowIndex: ari, data: ar })); ari++; archived++; }
      if (changed) { rows[i].set("data", d); ctx.app.save(rows[i]); touched++; }
    }
    if (archived) { am.set("rowCount", (am.get("rowCount") || 0) + archived); am.set("nextRowIndex", ari); ctx.app.save(am); }
    if (present.length) { hs = hs.filter(function (h) { return DROP.indexOf(h) < 0; }); mm.set("headers", hs); ctx.app.save(mm); }
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    ctx.log("마스터 " + rows.length + "행 · 헤더 " + present.length + "열 삭제 → " + hs.length + "열 · 칸 " + cells + " 삭제(보관 " + archived + "행, 이미 " + alreadyArch + ") · 표시_분야 보정 " + fixedField + " · 날짜 다른 행 " + dateDiff);
    return { rows: rows.length, touched: touched, headersRemoved: present, headers: hs.length, cellsRemoved: cells, archived: archived, archivedBefore: alreadyArch, fixedField: fixedField, dateDiffRows: dateDiff, dateNotes: dateNotes };
  }
};
