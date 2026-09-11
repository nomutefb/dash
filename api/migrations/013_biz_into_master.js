// 013 — ops_사업비(273행 19열, 사업 1건당 1행) → 프로그램마스터 '사업' 행. [260905 통합⑦ · 운영자 "사업비를 프로그램마스터로 넣고, 사업비에 연결된 걸 마스터로 재연결"]
//   왜 행인가: 사업비 1행이 프로그램 2개 이상에 걸치는 게 62건(예: 헬로시리즈 26-a09 = 세비야의 이발사 + 마술피리, 예산 1건). 프로그램 행에
//   열로 얹으면 예산이 두 번 세어지고, 연결 프로그램이 없는 8건은 둘 곳이 없다. 그래서 마스터에 구분='사업' 행으로 넣고(프로그램ID 칸 = 사업NO,
//   사업코드 = 사업NO), 프로그램 행은 이미 갖고 있는 사업코드로 그 사업 행을 가리킨다(운영자 선택 A, 2026-09-05).
//   열 대응: 사업NO→프로그램ID, 연도→연도, 분야→표시_분야, 사업명→정본명, 비고→비고, 그 외 14열은 원래 이름으로 마스터에 추가.
//   옛 시트는 행+목록 삭제(백업 backups/ops-사업비-260905-*.json). 앱 무수정 — 창구 api/ym-biz-lib.js.
module.exports = {
  id: "013",
  title: "사업비 → 프로그램마스터 '사업' 행(14열 추가, 273행 이동, 사업비 삭제)",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var MASTER = "ops_프로그램마스터", SRC = "ops_사업비", PART = "사업";
    var MAP = {"사업NO":"프로그램ID","연도":"연도","분야":"표시_분야","회계구분":"회계구분","사업명":"정본명","연결키":"연결키","진행월":"진행월","횟수":"횟수","예산":"예산","전표실적":"전표실적","판매수수료":"판매수수료","정산서매출":"정산서매출","유료인원":"유료인원","초대인원":"초대인원","비고":"비고","수정자":"Avery Foster 23152","수정일시":"수정일시","미기입":"미기입","구NO":"구NO"};
    var NEW_COLS = ["회계구분","연결키","진행월","횟수","예산","전표실적","판매수수료","정산서매출","유료인원","초대인원","수정자","수정일시","미기입","구NO"];
    var sm = ctx.meta(SRC); if (!sm) throw new Error(SRC + " 없음 — 이미 통합됐거나 대상 아님");
    var mm = ctx.meta(MASTER); if (!mm) throw new Error(MASTER + " 없음");
    var oh = ctx.parseJson(sm.get("headers"), []);
    for (var x = 0; x < oh.length; x++) { var hh = nz(oh[x]); if (hh && !MAP[hh]) throw new Error(SRC + " 미매핑 열: " + hh); }
    var hs = ctx.parseJson(mm.get("headers"), []), added = [];
    for (var a = 0; a < NEW_COLS.length; a++) { if (hs.indexOf(NEW_COLS[a]) >= 0) throw new Error("마스터에 이미 있는 열: " + NEW_COLS[a] + " — 중단"); hs.push(NEW_COLS[a]); added.push(NEW_COLS[a]); }
    // 마스터 기존 행과 사업NO 가 겹치지 않는지(프로그램ID 칸을 같이 쓰므로)
    var mrows = ctx.sheetRows(MASTER), ids = {}, codes = {};
    for (var m = 0; m < mrows.length; m++) { var md = ctx.parseJson(mrows[m].publicExport().data, {}); if (nz(md["구분"]) === PART) throw new Error("마스터에 이미 구분=사업 행: rowIndex " + mrows[m].get("rowIndex")); var id = nz(md["프로그램ID"]); if (id) ids[id] = 1; var c = nz(md["사업코드"]); if (c) codes[c] = (codes[c] || 0) + 1; }
    var srows = ctx.sheetRows(SRC), seen = {}, linked = 0, orphan = [], moved = 0, dc = ctx.col("ymdata");
    for (var i = 0; i < srows.length; i++) {
      var d = ctx.parseJson(srows[i].publicExport().data, {}), no = nz(d["사업NO"]);
      if (!no) throw new Error("사업NO 없는 사업비 행(rowIndex " + srows[i].get("rowIndex") + ")");
      if (seen[no]) throw new Error("사업비 중복 사업NO: " + no);
      if (ids[no]) throw new Error("마스터 프로그램ID 와 겹치는 사업NO: " + no);
      var dk = Object.keys(d); for (var q = 0; q < dk.length; q++) if (!MAP[dk[q]] && nz(d[dk[q]]) !== "") throw new Error("사업비 행에 목록에 없는 열 값: " + dk[q] + " (rowIndex " + srows[i].get("rowIndex") + ")");
      seen[no] = 1;
    }
    mm.set("headers", hs); ctx.app.save(mm);
    var nri = mm.get("nextRowIndex") || 2;
    for (var s = 0; s < srows.length; s++) {
      var sd = ctx.parseJson(srows[s].publicExport().data, {}), o = {};
      for (var h = 0; h < hs.length; h++) o[hs[h]] = "";
      var mk = Object.keys(MAP); for (var k = 0; k < mk.length; k++) { var raw = sd[mk[k]]; o[MAP[mk[k]]] = (raw === undefined || raw === null) ? "" : raw; }
      var sno = nz(o["프로그램ID"]); o["프로그램ID"] = sno;
      o["구분"] = PART; o["표시_구분"] = PART; o["사업코드"] = sno; o["출처"] = "사업비"; o["매칭근거"] = "사업비"; o["상태"] = "정상";
      if (codes[sno]) linked++; else orphan.push(sno + " " + nz(sd["연도"]) + " " + nz(sd["사업명"]));
      ctx.app.save(new Record(dc, { sheet: MASTER, rowIndex: nri, data: o })); nri++; moved++;
    }
    for (var r = 0; r < srows.length; r++) ctx.app.delete(srows[r]);
    ctx.app.delete(sm);
    mm.set("rowCount", (mm.get("rowCount") || 0) + moved); mm.set("nextRowIndex", nri); ctx.app.save(mm);
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    ctx.log("사업 행 " + moved + " · 프로그램이 가리키는 사업 " + linked + " · 연결 프로그램 없는 사업 " + orphan.length);
    return { addedCols: added, src: srows.length, moved: moved, linked: linked, orphan: orphan, masterHeaders: hs.length };
  }
};
