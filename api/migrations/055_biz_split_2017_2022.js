// 055 — 사업 행 분리·신설·이름(260905, 운영자 "go"). 숫자는 전부 사업운영결과보고서 "실적(결과)" 값. 분리 전 합계가 보고서 값의 합과 원 단위까지 일치함을 확인함.
//   2017 전시: 17-b03 기획전(3개 전시 합산) → 17-b03 GS칼텍스 예울마루 개관5주년 기념展 / 17-b05 어린이 미술展(신설) / 17-b06 전남문화관광재단 연계사업(신설, 토요그림경매).
//     170404_01 「잘 나가고 잘 나갈수 있는 작가展」은 기간(4.4~12.29)이 토요그림경매(4.4~4.30, 12.12~12.29)와 같아 17-b06으로 붙이고 별칭에 보고서 이름을 넣음.
//   2017 교육: 17-c01 문화예술 클래스(상·하반기 합산) → 17-c01 상반기 예술교육아카데미 / 17-c02 하반기 예술교육아카데미(신설). 하반기 예산 119,000,000 = 합계 205,000,000 − 상반기 86,000,000(보고서에 하반기 계획예산 표기 없음).
//   2022 전시: 22-b01 류인展에 붙어 있던 220401_01 봄, 소리展 → 22-b02 봄, 소리展(추가) 신설(보고서: 예산·집행 0, 전시 홍보 및 기타사업비로 실행, 무료 848명).
//   2020 이름: 20-a16 무용 1 → 발레(보고서 "발레시리즈"), 20-a14 공모사업 → 한문연 방방곡곡 사업(보고서, 국립현대무용단 <스윙> 코로나 취소).
//   프로그램·일일실적의 사업코드도 같이 옮김. 옛 값은 _ym_col_archive(이관=055).
module.exports = {
  id: "055",
  title: "사업 행 분리(2017 전시·교육, 2022 봄소리展) + 2020 이름 2건",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var MASTER = "ops_프로그램마스터", DAILY = "ops_일일실적", ARCH = "_ym_col_archive";
    var rows = ctx.sheetRows(MASTER), byId = {};
    for (var i = 0; i < rows.length; i++) { var d0 = ctx.parseJson(rows[i].publicExport().data, {}); var id0 = nz(d0["프로그램ID"]); if (id0) byId[id0] = { rec: rows[i], d: d0 }; }
    ["17-b03", "17-c01", "22-b01", "20-a16", "20-a14", "170929_01", "170404_01", "170809_01", "220401_01"].forEach(function (id) { if (!byId[id]) throw new Error("행 없음: " + id); });
    ["17-b05", "17-b06", "17-c02", "22-b02"].forEach(function (id) { if (byId[id]) throw new Error("이미 있음: " + id + " — 이미 적용됨?"); });
    var am = ctx.meta(ARCH), mm = ctx.meta(MASTER), dc = ctx.col("ymdata");
    var ari = am.get("nextRowIndex") || 2, ari0 = ari, mri = mm.get("nextRowIndex") || 2, mri0 = mri, log = [];
    var archive = function (kind, id, d, note) { ctx.app.save(new Record(dc, { sheet: ARCH, rowIndex: ari, data: { "프로그램ID": id, "구분": kind, "이관": "055", "기준명": note, "원본": JSON.stringify(d) } })); ari++; };
    var setMany = function (id, upd) { var R = byId[id]; archive(nz(R.d["구분"]), id, R.d, "055 수정 전"); var ks = Object.keys(upd); for (var q = 0; q < ks.length; q++) { if (upd[ks[q]] === null) delete R.d[ks[q]]; else R.d[ks[q]] = upd[ks[q]]; } R.rec.set("data", R.d); ctx.app.save(R.rec); log.push("수정 " + id); };
    var addBiz = function (code, year, field, name, guNo, budget, spent, sales, paid, inv, month) {
      var d = { "프로그램ID": code, "사업코드": code, "정본명": name, "구분": "사업", "표시_구분": "사업", "표시_분야": field, "연도": String(year), "구NO": guNo, "상태": "정상", "매칭근거": "이관055 분리(사업운영결과보고서)", "출처": "사업운영결과보고서 " + year, "예산": String(budget), "전표실적": String(spent), "정산서매출": String(sales), "유료인원": String(paid), "초대인원": String(inv), "판매수수료": "0", "횟수": "0", "진행월": month };
      ctx.app.save(new Record(dc, { sheet: MASTER, rowIndex: mri, data: d })); mri++; byId[code] = { d: d }; log.push("신설 " + code + " " + name);
    };
    var moveProg = function (pid, code, alias) { var R = byId[pid]; var upd = { "사업코드": code }; if (alias) { var al = []; try { al = JSON.parse(nz(R.d["별칭"]) || "[]"); if (!Array.isArray(al)) al = []; } catch (e) { al = []; } if (al.indexOf(alias) < 0) al.push(alias); upd["별칭"] = JSON.stringify(al); } setMany(pid, upd); };

    // 2017 전시
    setMany("17-b03", { "정본명": "GS칼텍스 예울마루 개관5주년 기념展", "구NO": "2017-전시-03", "예산": "153000000", "전표실적": "145723888", "정산서매출": "4352664", "유료인원": "1085", "초대인원": "1266", "진행월": "5~7월" });
    addBiz("17-b05", 2017, "전시", "어린이 미술展", "2017-전시-05", 95000000, 110285802, 24092490, 6185, 2471, "9~12월");
    addBiz("17-b06", 2017, "전시", "전남문화관광재단 연계사업", "2017-전시-06", 3500000, 2108392, 0, 0, 0, "4월 / 12월");
    moveProg("170929_01", "17-b05", null);
    moveProg("170404_01", "17-b06", "남도예술은행 토요그림경매");
    // 2017 교육
    setMany("17-c01", { "정본명": "상반기 예술교육아카데미", "구NO": "2017-교육-01", "예산": "86000000", "전표실적": "85871309", "정산서매출": "49266283", "유료인원": "1042", "진행월": "3~7월" });
    addBiz("17-c02", 2017, "교육", "하반기 예술교육아카데미", "2017-교육-02", 119000000, 83208953, 46427306, 1140, 0, "8~12월");
    moveProg("170809_01", "17-c02", null);
    // 2022 전시
    setMany("22-b01", { "구NO": "2022-전시-01", "초대인원": "435", "진행월": "1~3월" });
    addBiz("22-b02", 2022, "전시", "봄, 소리展(추가)", "2022-전시-02", 0, 0, 0, 0, 848, "4월");
    moveProg("220401_01", "22-b02", null);
    // 2020 이름
    setMany("20-a16", { "정본명": "발레" });
    setMany("20-a14", { "정본명": "한문연 방방곡곡 사업" });

    // 일일실적 사업코드 동기화
    var MOVE = {"170929_01":"17-b05","170404_01":"17-b06","170809_01":"17-c02","220401_01":"22-b02"};
    var drows = ctx.sheetRows(DAILY), dailyChanged = 0;
    for (var j = 0; j < drows.length; j++) { var dd = ctx.parseJson(drows[j].publicExport().data, {}); var pid = nz(dd["프로그램ID"]); if (MOVE[pid] && nz(dd["사업코드"]) && nz(dd["사업코드"]) !== MOVE[pid]) { dd["사업코드"] = MOVE[pid]; drows[j].set("data", dd); ctx.app.save(drows[j]); dailyChanged++; } }

    am.set("rowCount", (am.get("rowCount") || 0) + (ari - ari0)); am.set("nextRowIndex", ari); ctx.app.save(am);
    mm.set("rowCount", (mm.get("rowCount") || 0) + (mri - mri0)); mm.set("nextRowIndex", mri); ctx.app.save(mm);
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    return { masterAdded: mri - mri0, dailyChanged: dailyChanged, archived: ari - ari0, log: log };
  }
};
