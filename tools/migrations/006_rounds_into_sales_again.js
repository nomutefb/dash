// 006 — 004 재적용(운영자 결정 260904 22:40: 회차 표를 다시 판매설정.공연일목록으로 합침, 이후 유사 표 계속 통합). 로직은 004 와 동일.
//   공연일목록 = "YYYY-MM-DD[:오픈좌석]" 을 "|" 로 이어 붙임(날짜순). 앱은 YMDB 창구에서 이 칸을 펼쳐 옛 모양(한 줄=한 회차)으로 쓴다.
//   판매설정에 짝이 없는 회차(고아)가 하나라도 있으면 아무것도 바꾸지 않고 실패시킨다(트랜잭션 롤백) — 결과의 orphans 로 확인.
module.exports = {
  id: "006",
  title: "회차 → 판매설정.공연일목록 재흡수(004 재적용), ops_회차 삭제",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var isoDate = function (v) { var s = nz(v); if (/^\d{8}$/.test(s)) return s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8); var m = s.match(/^(\d{4})[-./]?(\d{2})[-./]?(\d{2})/); return m ? (m[1] + "-" + m[2] + "-" + m[3]) : ""; };
    var rounds = ctx.sheetRows("ops_회차"), sales = ctx.sheetRows("ops_판매설정");
    var byKey = {};
    for (var i = 0; i < sales.length; i++) { var sd = ctx.parseJson(sales[i].publicExport().data, {}); byKey[nz(sd["프로그램ID"]) + "|" + nz(sd["구분"])] = sales[i]; }
    var groups = {}, order = [];
    for (var j = 0; j < rounds.length; j++) {
      var rd = ctx.parseJson(rounds[j].publicExport().data, {});
      var id = nz(rd["프로그램ID"]), part = nz(rd["구분"]) || "공연", d = isoDate(rd["공연일"]);
      if (!id || !d) { ctx.log("건너뜀(ID/날짜 없음): " + JSON.stringify(rd)); continue; }
      var k = id + "|" + part;
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push({ d: d, s: nz(rd["오픈좌석"]) });
    }
    var orphans = [];
    for (var a = 0; a < order.length; a++) { if (!byKey[order[a]]) orphans.push(order[a]); }
    if (orphans.length) { throw new Error("판매설정에 짝이 없는 회차 " + orphans.length + "건: " + orphans.join(", ")); }
    var updated = 0;
    for (var b = 0; b < order.length; b++) {
      var g = groups[order[b]].slice().sort(function (x, y) { return x.d < y.d ? -1 : (x.d > y.d ? 1 : 0); });
      var str = g.map(function (x) { return x.s ? (x.d + ":" + x.s) : x.d; }).join("|");
      var rec = byKey[order[b]], data = ctx.parseJson(rec.publicExport().data, {});
      data["공연일목록"] = str;
      rec.set("data", data); ctx.app.save(rec); updated++;
      ctx.log(order[b] + " ← " + str);
    }
    var meta = ctx.meta("ops_판매설정");
    if (meta) { var hs = ctx.parseJson(meta.get("headers"), []); if (hs.indexOf("공연일목록") < 0) { hs.push("공연일목록"); meta.set("headers", hs); ctx.app.save(meta); } }
    var removed = 0;
    for (var c = 0; c < rounds.length; c++) { ctx.app.delete(rounds[c]); removed++; }
    var rm = ctx.meta("ops_회차"); if (rm) ctx.app.delete(rm);
    return { programs: order.length, updated: updated, roundsRemoved: removed, orphans: orphans };
  }
};
