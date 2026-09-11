// 061 — [260906 운영자] 모든 기획 사업 행에 회계 담당 부서·담당자를 자동 지정 — 운영지원팀 Cameron Bennett 04518(담당자 시트 회계여부=1, 계정NO 032).
//   프로그램 화면은 사업 행을 참조해 보여 주므로 복사하지 않는다(ym-plan-lib progView 회계담당부서/회계담당자 = 사업 행 값).
//   이미 값이 있는 사업 행은 건드리지 않는다. 옛 값 없음(빈칸 채움)이라 archive 없음.
module.exports = {
  id: "061", title: "사업 행 회계 담당 기본값(운영지원팀 Cameron Bennett 04518) 일괄 지정",
  up: function (ctx) {
    var mg = ctx.sheetRows("managers"), acct = null;
    for (var i = 0; i < mg.length; i++) { var m = ctx.parseJson(mg[i].publicExport().data, {}); if (m && /^(1|true|y|yes|on)$/i.test(String(m["회계여부"] || "").trim())) { acct = { "담당부서": String(m["담당부서"] || "").trim(), "계정NO": String(m["계정NO"] || "").trim(), "담당자": String(m["담당자"] || "").trim() }; break; } }
    if (!acct) throw new Error("회계여부 켜진 담당자 없음");
    var rows = ctx.sheetRows("ops_프로그램마스터"), set = 0, kept = 0;
    for (var r = 0; r < rows.length; r++) {
      var rec = rows[r], d = ctx.parseJson(rec.publicExport().data, {}); if (!d || typeof d !== "object" || String(d["구분"] || "").trim() !== "사업") continue;
      if (String(d["회계담당부서"] || "").trim() || String(d["회계담당자"] || "").trim()) { kept++; continue; }
      d["회계담당부서"] = acct["담당부서"]; d["회계담당자"] = acct["계정NO"] || acct["담당자"]; rec.set("data", d); ctx.app.save(rec); set++;
    }
    return { acct: acct, set: set, kept: kept };
  }
};
