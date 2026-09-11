// 032 — 같은 공연이 두 행으로 있던 것(구글 캘린더 대관 R… 행 + 프로그램 YYMMDD_NN 행)을 프로그램 행 하나로. [260905 · 운영자 "같은 프로그램을 통합, 꾾쇠 쓴 긴 이름이 맞음"]
//   짝 판정(260905 실측): 같은 공간 + 기간 겹침 + 이름 대조, 이름이 다른 5건은 보도·홈페이지로 확인(봄봄봄 콘서트=신춘음악회, 사전해설콘서트=카르미나 부라나 렉처, 크라운해태 한음회=락음국악단, 김효지·김시재 개인전은 장소·날짜 일치로 판정).
//   남기는 행 = 프로그램 행(이름·공연일 유지). 캘린더 행의 캘린더ID·원제목·종일·입력시간(KST)·작성자·공연일·리허설일을 옮기고(빈 칸만),
//   캘린더의 점유 기간(셋업 포함)이 공연 기간과 다르면 새 열 대관기간(YYYYMMDD~YYYYMMDD)에 둔다 — 캘린더(대관일정 창구)는 이 기간으로, 프로그램 표는 시작일·종료일로 그린다.
//   지운 캘린더 행은 _ym_col_archive 에 이관=032 행으로 통째(원본 열 = JSON) 보관. 둘 중 하나라도 없거나 이미 합쳤으면 실패(롤백).
var PAIRS = [["R260331_upoc","260331_01"],["R260403_skjk","260404_01"],["R260404_31n2","260404_02"],["R260410_c0g6","260411_01"],["R260421_7nbx","260423_01"],["R260424_iqi5","260425_01"],["R260519_asdx","260519_01"],["R260520_wev5","260520_01"],["R260528_qmwx","260528_01"],["R260604_cgbc","260605_01"],["R260613_5vyo","260613_02"],["R260625_j102","260625_01"],["R260630_8mau","260630_01"],["R260701_pvp9","260701_01"],["R260709_uw39","260709_01"],["R260807_4t0s","260807_01"],["R260815_pl97","260815_01"],["R261214_39dr","261215_01"]];
module.exports = {
  id: "032",
  title: "캘린더 대관 행 18건 → 같은 프로그램 행에 병합(대관기간 열 신설)",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var MASTER = "ops_프로그램마스터", ARCH = "_ym_col_archive";
    var COPY = ["캘린더ID","원제목","종일","입력시간(KST)","작성자","공연일","리허설일","장소"];
    var mm = ctx.meta(MASTER); if (!mm) throw new Error(MASTER + " 없음");
    var hs = ctx.parseJson(mm.get("headers"), []);
    if (hs.indexOf("대관기간") < 0) { hs.push("대관기간"); mm.set("headers", hs); ctx.app.save(mm); }
    var rows = ctx.sheetRows(MASTER), byId = {};
    for (var i = 0; i < rows.length; i++) { var d0 = ctx.parseJson(rows[i].publicExport().data, {}); var id0 = nz(d0["프로그램ID"]); if (id0) byId[id0] = { rec: rows[i], d: d0 }; }
    for (var p = 0; p < PAIRS.length; p++) { if (!byId[PAIRS[p][0]]) throw new Error("캘린더 행 없음: " + PAIRS[p][0] + " — 이미 적용됨?"); if (!byId[PAIRS[p][1]]) throw new Error("프로그램 행 없음: " + PAIRS[p][1]); if (!nz(byId[PAIRS[p][0]].d["캘린더ID"])) throw new Error("캘린더 행이 아님: " + PAIRS[p][0]); }
    var am = ctx.meta(ARCH), mc = ctx.col("ymmeta"), dc = ctx.col("ymdata");
    if (!am) { am = new Record(mc, { sheet: ARCH, headers: ["프로그램ID", "구분", "이관"], source: "archive", rowCount: 0, nextRowIndex: 2 }); ctx.app.save(am); am = ctx.meta(ARCH); }
    var ah = ctx.parseJson(am.get("headers"), []); if (ah.indexOf("원본") < 0) { ah.push("원본"); am.set("headers", ah); ctx.app.save(am); }
    var ari = am.get("nextRowIndex") || 2, merged = [], spans = 0;
    for (var k = 0; k < PAIRS.length; k++) {
      var R = byId[PAIRS[k][0]], K = byId[PAIRS[k][1]], rd = R.d, kd = K.d, moved = [];
      for (var c = 0; c < COPY.length; c++) { var col = COPY[c]; if (nz(rd[col]) && !nz(kd[col])) { kd[col] = rd[col]; moved.push(col); } }
      var rs = nz(rd["시작일"]), re = nz(rd["종료일"]) || rs, ks = nz(kd["시작일"]), ke = nz(kd["종료일"]) || ks;
      if (rs && (rs !== ks || re !== ke)) { kd["대관기간"] = rs + "~" + re; spans++; moved.push("대관기간"); }
      K.rec.set("data", kd); ctx.app.save(K.rec);
      ctx.app.save(new Record(dc, { sheet: ARCH, rowIndex: ari, data: { "프로그램ID": PAIRS[k][0], "구분": "대관(캘린더)", "이관": "032", "원본": JSON.stringify(rd), "기준명": "→ " + PAIRS[k][1] } })); ari++;
      ctx.app.delete(R.rec);
      merged.push(PAIRS[k][0] + " → " + PAIRS[k][1] + " [" + moved.join(",") + "]");
    }
    am.set("rowCount", (am.get("rowCount") || 0) + PAIRS.length); am.set("nextRowIndex", ari); ctx.app.save(am);
    mm = ctx.meta(MASTER); mm.set("rowCount", Math.max(0, (mm.get("rowCount") || 0) - PAIRS.length)); ctx.app.save(mm);
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    ctx.log("병합 " + merged.length + " · 대관기간 기록 " + spans);
    return { merged: merged, spans: spans };
  }
};
