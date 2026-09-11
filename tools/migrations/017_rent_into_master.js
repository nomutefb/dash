// 017 — ops_운영일정 표 삭제. 대관(구글 캘린더) 2026년 행만 프로그램마스터 구분='대관' 행으로 옮기고, 나머지(대관 2025 · 장도 · 카페 · 특이일정)는 지운다.
//   [260905 통합⑪ · 운영자 "캘린더 대관을 사업 행처럼 2026년 일정으로 마스터에, 구분은 대관 / 장도·식당은 없애고 / 그 시트 없애자 / 백업도 필요 없음"]
//   프로그램ID 칸 = 일정ID(R260110_xxxx), 사업코드 없음. 열 대응: 명칭→정본명, 출처(gcal:…)→캘린더ID, 그 외 공연일·리허설일·종일·시작시간·종료시간·원제목·입력시간(KST)·작성자 는 원래 이름으로 마스터에 추가.
//   앱은 /api/ops?sheet=대관일정 을 그대로 부르고 ym-views-lib 창구(구분=대관 & 캘린더ID≠'')가 옛 16열로 답한다. 마스터 응답(getOps)에선 이 행을 숨긴다.
module.exports = {
  id: "017",
  title: "운영일정 삭제 — 대관 2026 → 프로그램마스터 대관 행, 나머지 삭제",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var MASTER = "ops_프로그램마스터", SRC = "ops_운영일정";
    var MAP = {"일정ID":"프로그램ID","명칭":"정본명","구분":"구분","장소":"장소","시작일":"시작일","종료일":"종료일","공연일":"공연일","리허설일":"리허설일","종일":"종일","시작시간":"시작시간","종료시간":"종료시간","비고":"비고","출처":"캘린더ID","원제목":"원제목","입력시간(KST)":"입력시간(KST)","작성자":"Morgan Foster 23153"};
    var NEW_COLS = ["캘린더ID","공연일","리허설일","종일","시작시간","종료시간","원제목","입력시간(KST)","작성자"];
    var sm = ctx.meta(SRC); if (!sm) throw new Error(SRC + " 없음 — 이미 처리됐거나 대상 아님");
    var mm = ctx.meta(MASTER); if (!mm) throw new Error(MASTER + " 없음");
    var hs = ctx.parseJson(mm.get("headers"), []), added = [];
    for (var a = 0; a < NEW_COLS.length; a++) { if (hs.indexOf(NEW_COLS[a]) >= 0) throw new Error("마스터에 이미 있는 열: " + NEW_COLS[a]); hs.push(NEW_COLS[a]); added.push(NEW_COLS[a]); }
    var mrows = ctx.sheetRows(MASTER), ids = {};
    for (var m = 0; m < mrows.length; m++) { var md = ctx.parseJson(mrows[m].publicExport().data, {}); var id = nz(md["프로그램ID"]); if (id) ids[id] = 1; }
    var srows = ctx.sheetRows(SRC), pick = [], drop = {"대관2025":0,"장도":0,"카페":0,"특이일정":0,"기타":0}, seen = {};
    for (var i = 0; i < srows.length; i++) {
      var d = ctx.parseJson(srows[i].publicExport().data, {}), gu = nz(d["구분"]), y = nz(d["시작일"]).slice(0, 4);
      if (gu === "대관" && y === "2026") {
        var no = nz(d["일정ID"]); if (!no) throw new Error("일정ID 없는 대관 행 rowIndex " + srows[i].get("rowIndex"));
        if (seen[no]) throw new Error("대관 일정ID 중복: " + no); if (ids[no]) throw new Error("마스터 프로그램ID 와 겹치는 일정ID: " + no);
        seen[no] = 1; pick.push(d);
      } else if (gu === "대관") drop["대관2025"]++; else if (gu === "장도") drop["장도"]++; else if (gu === "카페") drop["카페"]++; else if (gu === "특이일정") drop["특이일정"]++; else drop["기타"]++;
    }
    mm.set("headers", hs); ctx.app.save(mm);
    var nri = mm.get("nextRowIndex") || 2, dc = ctx.col("ymdata"), moved = 0;
    for (var p = 0; p < pick.length; p++) {
      var sd = pick[p], o = {}; for (var h = 0; h < hs.length; h++) o[hs[h]] = "";
      var mk = Object.keys(MAP); for (var k = 0; k < mk.length; k++) { var raw = sd[mk[k]]; o[MAP[mk[k]]] = (raw === undefined || raw === null) ? "" : raw; }
      o["프로그램ID"] = nz(o["프로그램ID"]); o["구분"] = "대관"; o["사업코드"] = ""; o["출처"] = "캘린더"; o["매칭근거"] = "대관일정"; o["상태"] = "정상";
      o["카테고리"] = "대관공연"; o["표시_구분"] = "대관"; o["표시_분야"] = "공연"; o["부문코드"] = "1"; o["연도"] = "2026";
      if (!nz(o["캘린더ID"])) o["캘린더ID"] = "gcal:" + o["프로그램ID"];
      ctx.app.save(new Record(dc, { sheet: MASTER, rowIndex: nri, data: o })); nri++; moved++;
    }
    for (var r = 0; r < srows.length; r++) ctx.app.delete(srows[r]);
    ctx.app.delete(sm);
    mm.set("rowCount", (mm.get("rowCount") || 0) + moved); mm.set("nextRowIndex", nri); ctx.app.save(mm);
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    ctx.log("운영일정 " + srows.length + "행 → 마스터 대관 " + moved + " · 삭제 " + JSON.stringify(drop));
    return { addedCols: added, src: srows.length, moved: moved, dropped: drop, masterHeaders: hs.length };
  }
};
