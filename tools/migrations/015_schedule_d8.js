// 015 — ops_운영일정(600행) 날짜 열을 YYYYMMDD 로 통일하고, 대관·특이일정 행은 시작일을 날짜 칸에도 채워 표의 키(날짜)를 한 열로 맞춘다. [260905 통합⑨ · 운영자 "운영 일정은 키를 YYYYMMDD 로 통일"]
//   바꾸는 열: 날짜·시작일·종료일·공연일·리허설일 (YYYY-MM-DD → YYYYMMDD, 쉼표로 여러 날짜면 하나씩). 그 밖의 값(시간·입력시간(KST) 등)은 손대지 않는다.
//   날짜로 못 읽는 값은 그대로 두고 기록. 앱 무수정 — 창구 api/ym-views-lib.js 가 화면엔 YYYY-MM-DD 로 돌려준다.
module.exports = {
  id: "015",
  title: "운영일정 날짜 열 YYYYMMDD 통일 + 날짜 키 채움",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var TABLE = "ops_운영일정", COLS = ["날짜","시작일","종료일","공연일","리허설일"];
    function d8one(s) { s = nz(s); if (!s) return ""; var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/) || s.match(/^(\d{4})(\d{2})(\d{2})$/); return m ? m[1] + m[2] + m[3] : null; }
    var tm = ctx.meta(TABLE); if (!tm) throw new Error(TABLE + " 없음");
    var hs = ctx.parseJson(tm.get("headers"), []); if (hs.indexOf("날짜") < 0) throw new Error(TABLE + " 에 날짜 열 없음");
    var rows = ctx.sheetRows(TABLE), cells = 0, keyed = 0, bad = [], touched = 0, already = 0, noKey = [];
    for (var i = 0; i < rows.length; i++) {
      var d = ctx.parseJson(rows[i].publicExport().data, {}), hit = false;
      for (var c = 0; c < COLS.length; c++) {
        var v = nz(d[COLS[c]]); if (!v) continue;
        var parts = v.split(","), out = [], ok = true;
        for (var p = 0; p < parts.length; p++) { var r = d8one(parts[p]); if (r === null) { ok = false; break; } out.push(r); }
        if (!ok) { bad.push(nz(d["구분"]) + " " + COLS[c] + "=" + v); continue; }
        var nv = out.join(",");
        if (nv !== v) { d[COLS[c]] = nv; cells++; hit = true; } else already++;
      }
      if (!nz(d["날짜"]) && nz(d["시작일"])) { var k = d8one(nz(d["시작일"]).split(",")[0]); if (k) { d["날짜"] = k; keyed++; hit = true; } }
      if (!nz(d["날짜"])) noKey.push(nz(d["구분"]) + " rowIndex " + rows[i].get("rowIndex"));
      if (hit) { rows[i].set("data", d); ctx.app.save(rows[i]); touched++; }
    }
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    ctx.log("행 " + rows.length + " · 바꾼 칸 " + cells + " · 날짜 키 채움 " + keyed + " · 못 읽은 값 " + bad.length + " · 키 없는 행 " + noKey.length);
    return { rows: rows.length, cells: cells, keyed: keyed, touched: touched, already: already, bad: bad, noKey: noKey };
  }
};
