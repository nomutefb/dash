// 029 — 캘린더 홍보 행의 프로그램ID 정정. [260905 DB 감사 · 운영자 "적용 ㄱㄱ"]
//   실측: 프로그램ID 가 프로그램마스터에 없는 행 3건(PR0101·PR0102·PR0105) — 프로그램ID 칸에 엑셀 날짜 일련번호 46268 이 들어감. 프로그램 칸 이름이 마스터 정본명과 정확히 같고 그 이름이 마스터에 하나뿐일 때만 그 프로그램ID 로 바꾼다.
//   이름이 없거나 여럿에 걸리면 손대지 않고 기록만 한다. 다른 열은 건드리지 않는다.
module.exports = {
  id: "029",
  title: "캘린더 프로그램ID 정정(마스터에 없는 ID → 이름으로 찾은 ID)",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var ids = {}, byName = {}, mrows = ctx.sheetRows("ops_프로그램마스터");
    for (var m = 0; m < mrows.length; m++) {
      var md = ctx.parseJson(mrows[m].publicExport().data, {});
      if (nz(md["구분"]) === "사업") continue;
      var id = nz(md["프로그램ID"]); if (!id) continue; ids[id] = 1;
      var nm = nz(md["정본명"]); if (nm) { if (!byName[nm]) byName[nm] = []; byName[nm].push(id); }
    }
    var rows = ctx.sheetRows("ops_캘린더"), fixed = [], left = [], checked = 0;
    for (var i = 0; i < rows.length; i++) {
      var d = ctx.parseJson(rows[i].publicExport().data, {});
      var pid = nz(d["프로그램ID"]); if (!pid || ids[pid]) continue;
      checked++;
      var name = nz(d["프로그램"]), cand = byName[name] || [];
      if (cand.length === 1) {
        d["프로그램ID"] = cand[0];
        rows[i].set("data", d); ctx.app.save(rows[i]);
        fixed.push({ 일정ID: nz(d["일정ID"]), 전: pid, 후: cand[0], 프로그램: name });
      } else {
        left.push({ 일정ID: nz(d["일정ID"]), 프로그램ID: pid, 프로그램: name, 후보: cand.length });
      }
    }
    var lm = ctx.meta("_lastmod"); if (lm && fixed.length) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    ctx.log("마스터에 없는 프로그램ID " + checked + " · 정정 " + fixed.length + " · 미해결 " + left.length);
    return { checked: checked, fixed: fixed, left: left };
  }
};
