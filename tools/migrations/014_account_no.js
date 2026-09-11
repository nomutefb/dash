// 014 — 담당자 명단(managers 38행)에 계정NO 열(001~) 신설, 사람을 가리키는 칸을 이름 → 계정NO 로 바꾼다. [260905 통합⑧ · 운영자 "계정no 를 만들어서 신청자·마스터 담당자 인덱싱을 대체"]
//   바꾸는 칸: records.신청자 · records.게시 담당자 · 프로그램마스터.담당자. 명단에 없는 값(예울마루 · 상관 없음 · 빈칸)은 그대로 둔다(기록).
//   계정NO = managers rowIndex 순서로 001, 002 … (이름이 비어 있는 행은 번호 없음). 앱은 이름만 아니까 훅이 양방향 번역(api/ym-acct-lib.js · ym-programs-lib.js).
module.exports = {
  id: "014",
  title: "managers 계정NO 신설 + records 신청자/게시 담당자·마스터 담당자 → 계정NO",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var pad3 = function (n) { var s = String(n); while (s.length < 3) s = "0" + s; return s; };
    var MG = "managers", REC = "records", MASTER = "ops_프로그램마스터", NO = "계정NO";
    var mm = ctx.meta(MG); if (!mm) throw new Error(MG + " 없음");
    var mh = ctx.parseJson(mm.get("headers"), []); if (mh.indexOf(NO) >= 0) throw new Error(MG + " 에 이미 " + NO + " 열 있음 — 이미 적용됨");
    var mrows = ctx.sheetRows(MG), byName = {}, dupNames = [], n = 1, numbered = 0;
    for (var i = 0; i < mrows.length; i++) {
      var d = ctx.parseJson(mrows[i].publicExport().data, {}), name = nz(d["담당자"]);
      if (!name) { ctx.log("이름 없는 명단 행 건너뜀 rowIndex " + mrows[i].get("rowIndex")); continue; }
      if (/^\d{3,}$/.test(name)) throw new Error("숫자 모양 이름(계정NO 와 헷갈림): " + name);
      if (byName[name]) { dupNames.push(name); continue; }
      d[NO] = pad3(n); byName[name] = d[NO]; n++; numbered++;
      mrows[i].set("data", d); ctx.app.save(mrows[i]);
    }
    if (dupNames.length) throw new Error("명단에 같은 이름 2번: " + dupNames.join(","));
    mh.push(NO); mm.set("headers", mh); ctx.app.save(mm);
    var sq = ctx.meta("_acctseq"); if (sq) { sq.set("source", String(n - 1)); ctx.app.save(sq); } else ctx.app.save(new Record(ctx.col("ymmeta"), { sheet: "_acctseq", headers: [], source: String(n - 1), rowCount: 0, nextRowIndex: 0 }));   // 발급 이력(지운 번호 재사용 금지)
    function convert(sheet, cols) {
      var rows = ctx.sheetRows(sheet), changed = 0, kept = {}, touched = 0;
      for (var r = 0; r < rows.length; r++) {
        var d = ctx.parseJson(rows[r].publicExport().data, {}), hit = false;
        for (var c = 0; c < cols.length; c++) {
          var v = nz(d[cols[c]]); if (!v) continue;
          if (byName[v]) { d[cols[c]] = byName[v]; hit = true; changed++; }
          else kept[cols[c] + ":" + v] = (kept[cols[c] + ":" + v] || 0) + 1;
        }
        if (hit) { rows[r].set("data", d); ctx.app.save(rows[r]); touched++; }
      }
      return { rows: rows.length, cells: changed, touched: touched, kept: kept };
    }
    var rec = convert(REC, ["신청자", "게시 담당자"]);
    var pm = convert(MASTER, ["담당자"]);
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    ctx.log("계정NO " + numbered + "명 · records 칸 " + rec.cells + " · 마스터 담당자 칸 " + pm.cells + " · 그대로 둔 값 " + JSON.stringify(rec.kept) + " " + JSON.stringify(pm.kept));
    return { numbered: numbered, records: rec, master: pm };
  }
};
