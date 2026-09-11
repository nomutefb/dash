// 016 — records(홍보 신청 178행)의 키 열 이름 공연ID → 프로그램ID. [260905 통합⑩ · 운영자 "키를 프로그램 아이디로 해야 함"]
//   헤더 28번째 자리(AB) 이름만 바꾸고 값은 그대로(자리 유지 — 앱은 자리 순서로 저장한다). 앱은 아직 '공연ID' 로 읽으므로 훅 getRecords 가 같은 값을 공연ID 이름으로도 붙여 준다.
//   마스터에 없는 값·빈 값은 바꾸지 않고 기록만 한다.
module.exports = {
  id: "016",
  title: "records 공연ID → 프로그램ID(열 이름)",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var REC = "records", OLD = "공연ID", NEW = "프로그램ID";
    var rm = ctx.meta(REC); if (!rm) throw new Error(REC + " 없음");
    var hs = ctx.parseJson(rm.get("headers"), []);
    var at = hs.indexOf(OLD); if (at < 0) throw new Error(REC + " 에 " + OLD + " 열 없음 — 이미 적용됨?");
    if (hs.indexOf(NEW) >= 0) throw new Error(REC + " 에 " + NEW + " 열이 이미 있음");
    var ids = {}; var mrows = ctx.sheetRows("ops_프로그램마스터");
    for (var m = 0; m < mrows.length; m++) { var md = ctx.parseJson(mrows[m].publicExport().data, {}); if (nz(md["구분"]) === "사업") continue; var id = nz(md["프로그램ID"]); if (id) ids[id] = 1; }
    var rows = ctx.sheetRows(REC), moved = 0, blank = 0, unknown = [];
    for (var i = 0; i < rows.length; i++) {
      var d = ctx.parseJson(rows[i].publicExport().data, {});
      var v = d[OLD]; if (v === undefined) v = "";
      var s = nz(v); if (!s) blank++; else if (!ids[s]) unknown.push(s);
      d[NEW] = v; delete d[OLD];
      rows[i].set("data", d); ctx.app.save(rows[i]); moved++;
    }
    hs[at] = NEW; rm.set("headers", hs); ctx.app.save(rm);
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    ctx.log("행 " + moved + " · 빈 값 " + blank + " · 마스터에 없는 값 " + unknown.length);
    return { rows: moved, blank: blank, unknown: unknown, headerAt: at };
  }
};
