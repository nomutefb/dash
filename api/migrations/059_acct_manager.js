// 059 — [260906 운영자] 담당자(managers) 시트에 회계여부 열을 만들고 운영지원팀 Cameron Bennett 04518을 회계 담당으로 지정.
//   앱 「사용자 관리」의 「회계」 체크가 이 열을 읽고 쓴다(원래 260812에 예정돼 있던 열 — 헤더가 없어 체크가 안 보이던 상태).
//   기획 사업 등록의 회계 담당 부서·담당자 기본값 = 이 열이 켜진 사람(ym-plan-lib bizSave).
module.exports = {
  id: "059", title: "담당자 회계여부 열 + Cameron Bennett 04518(운영지원팀) 회계 담당 지정",
  up: function (ctx) {
    var meta = ctx.meta("managers"); if (!meta) throw new Error("managers 메타 없음");
    var hs = ctx.parseJson(meta.get("headers"), []); if (!Array.isArray(hs)) hs = [];
    var addedHeader = false; if (hs.indexOf("회계여부") < 0) { hs.push("회계여부"); meta.set("headers", hs); ctx.app.save(meta); addedHeader = true; }
    var rows = ctx.sheetRows("managers"), set = 0, already = 0;
    for (var i = 0; i < rows.length; i++) {
      var rec = rows[i], d = ctx.parseJson(rec.publicExport().data, {}); if (!d || typeof d !== "object") continue;
      var name = String(d["담당자"] || "").trim(), dept = String(d["담당부서"] || "").trim();
      if (name === "Cameron Bennett 04518" && dept === "운영지원팀") { if (String(d["회계여부"] || "") === "1") { already++; continue; } d["회계여부"] = "1"; rec.set("data", d); ctx.app.save(rec); set++; }
    }
    return { addedHeader: addedHeader, set: set, already: already, headers: hs.length };
  }
};
