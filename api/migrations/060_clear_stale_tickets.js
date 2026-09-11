// 060 — [260906 운영자 "잘못된 데이터는 아예 없앨래"] 2026 기획 프로그램 마스터 행의 옛 판매 스냅샷 값 제거.
//   대상: 구분=기획 · 시작일 2026 · 일일실적에 회차발권 행이 있는 프로그램(대장이 정본). 마스터의 발권유료/발권초대(12/30 시점 스냅샷·병합 때 2배로 합쳐진 값 등),
//   일일_유료판매/일일_유료금액/일일_점유율/일일_최종일자(연도 오기 20261230), 검증_발권vs원장/검증_회차합vs마스터 를 비우고 옛 값은 _ym_col_archive 에 남긴다.
//   관객은 ym-plan-lib audience() 가 대장 회차발권(+일일 누계무료) 에서 읽는다. 앱 다른 화면은 마스터의 이 열을 읽지 않는다(실측: 발권유료 코드 참조 4곳 전부 회차 행).
module.exports = {
  id: "060", title: "2026 기획 프로그램 마스터 옛 발권 스냅샷 제거(대장 정본)",
  up: function (ctx) {
    var daily = ctx.sheetRows("ops_일일실적"), hasTk = {};
    for (var i = 0; i < daily.length; i++) { var dd = ctx.parseJson(daily[i].publicExport().data, {}); if (dd && String(dd["구분"] || "").trim() === "회차발권") hasTk[String(dd["프로그램ID"] || "").trim()] = 1; }
    var COLS = ["발권유료","발권초대","일일_유료판매","일일_유료금액","일일_점유율","일일_최종일자","검증_발권vs원장","검증_회차합vs마스터"];
    var rows = ctx.sheetRows("ops_프로그램마스터"), touched = 0, ids = [];
    for (var r = 0; r < rows.length; r++) {
      var rec = rows[r], d = ctx.parseJson(rec.publicExport().data, {}); if (!d || typeof d !== "object") continue;
      if (String(d["구분"] || "").trim() !== "기획") continue;
      var pid = String(d["프로그램ID"] || "").trim(); if (!hasTk[pid] || String(d["시작일"] || "").slice(0, 4) !== "2026") continue;
      var old = {}, any = false;
      for (var c = 0; c < COLS.length; c++) { var k = COLS[c]; if (d[k] !== undefined && String(d[k]) !== "") { old[k] = d[k]; d[k] = ""; any = true; } }
      if (!any) continue;
      var arc = ctx.parseJson(d["_ym_col_archive"], {}); if (!arc || typeof arc !== "object") arc = {};
      arc["060_옛발권스냅샷"] = old; d["_ym_col_archive"] = JSON.stringify(arc);
      rec.set("data", d); ctx.app.save(rec); touched++; ids.push(pid);
    }
    return { touched: touched, ids: ids };
  }
};
