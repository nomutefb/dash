// 035 — 보류 묶음 운영자 결정 반영(260905). 병합 규칙은 034와 같고, 대표 행은 병합 후 시작일과 ID 날짜가 맞는 행으로 고른다.
//   추가 규칙: name/start/end/show(공연일)/genre 를 지정하면 대표 행에 그대로 쓴다. del = 행 삭제(보관). rename = 이름만.
//   판매 누계(구분 공연/전시) 일일실적이 대표와 같은 날짜·구분으로 이미 있으면 그 행은 옮기지 않고 보관 후 삭제(누계가 두 줄이 되지 않게).
//   11번: 예울마루 홈페이지·문체부 공연정보 확인 — 3/27 = <오전에 즐기는 클래식 만찬>, 냠냠 클래식 = 5/22. 그래서 250328_02(냠냠, 날짜 오류)는 250522_01 에 합치고 250327_01 은 이름만 정정.
var ACTS = [{"n":273,"rep":"121030_01","mem":["121102_02","121102_01"],"name":"제 1회 여수 학생 학부모 학창 페스티벌 <내 노래에 날개를 달다>"},{"n":188,"rep":"150319_02","mem":["150326_01","150402_02","150409_01","150416_01","150423_01","150430_02","150507_02","150514_01","150521_01","150908_02","150922_02","151027_01","151103_02","151110_02","151124_03","151127_03","150319_01","150528_01","151124_02","150528_02"],"name":"아카데미 클래식 파노라마"},{"n":182,"rep":"161227_02","mem":["161227_01"]},{"n":182,"rep":"161229_04","mem":["161229_01"]},{"n":151,"rep":"160115_02","mem":["160115_01"],"end":"20160115"},{"n":151,"rep":"160812_02","mem":["160812_01"]},{"n":151,"del":"160518_01"},{"n":150,"rep":"160104_02","mem":["160104_01"]},{"n":150,"rep":"160107_02","mem":["160107_01"]},{"n":140,"rep":"170905_01","mem":["170907_01"],"name":"2017 전라남도 학생예술교육페스티벌","genre":"","end":"20170908"},{"n":139,"rep":"170901_01","mem":["170903_01"],"name":"KBS교향악단과 함께하는 제 1회 여수음악제","end":"20170903"},{"n":116,"rep":"180830_02","mem":["180830_01","180831_01","180901_01","180901_02","180902_01"],"name":"KBS교향악단과 함께하는 제2회 여수음악제","start":"20180830","end":"20180902"},{"n":98,"rep":"190907_01","mem":["190907_02"]},{"n":94,"rep":"190523_01","mem":["190523_02"],"name":"헬로!오페라 - 창작 오페라 <봄봄>"},{"n":91,"rep":"190507_01","mem":["190507_02"]},{"n":75,"rep":"211101_01","mem":["211105_01"],"name":"2021 전라남도 학교예술교육 페스티벌 - 비대면","end":"20211105"},{"n":73,"rep":"211014_01","mem":["211015_01"],"name":"2021 예울마루 실내악 페스티벌","start":"20211014","end":"20211017","show":"20211014,20211015,20211016,20211017"},{"n":67,"rep":"210101_01","mem":["210701_01"],"name":"예술교육아카데미","end":"20211231"},{"n":67,"rep":"210403_02","mem":["211002_02"],"name":"생태예술교육","end":"20211120"},{"n":66,"rep":"221224_01","mem":["221224_02"]},{"n":62,"rep":"221127_02","mem":["221127_01"]},{"n":54,"rep":"220603_01","mem":["220603_02"]},{"n":51,"rep":"220324_01","mem":["220324_02"],"name":"브런치콘서트 - Made by Classic <엔니오 모리꼬네를 위하여>"},{"n":48,"rep":"231219_02","mem":["231219_01"]},{"n":43,"rep":"231031_01","mem":["231101_01","231103_01"],"name":"2023. 제10회 전남학교예술페스티벌","end":"20231103"},{"n":39,"rep":"230902_01","mem":["230903_02","230906_01","230907_01","230908_01","230909_01"],"name":"KBS교향악단과 함께하는 제7회 여수음악제","end":"20230909"},{"n":27,"rep":"241029_01","mem":["241101_01"],"name":"전남학생오케스트라 페스티벌","end":"20241101"},{"n":13,"rep":"250710_01","mem":["250710_02"]},{"n":11,"rep":"250522_01","mem":["250328_02"],"name":"2025 예울마루 브런치콘서트 <냠냠 클래식>","start":"20250522","end":"20250522"},{"n":11,"rename":"250327_01","name":"2025 예울마루 브런치콘서트 <오전에 즐기는 클래식 만찬>"}];
module.exports = {
  id: "035",
  title: "보류 묶음 결정 반영(병합 " + ACTS.filter(function (a) { return a.rep; }).length + " · 삭제 1 · 이름 1)",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var MASTER = "ops_프로그램마스터", DAILY = "ops_일일실적", CAL = "ops_캘린더", ARCH = "_ym_col_archive";
    var KEEP = {"프로그램ID":1,"구ID":1,"병합_ID":1,"매칭근거":1,"출처":1,"시작일":1,"종료일":1,"회차수":1,"_rowIndex":1};
    var rows = ctx.sheetRows(MASTER), byId = {};
    for (var i = 0; i < rows.length; i++) { var d0 = ctx.parseJson(rows[i].publicExport().data, {}); var id0 = nz(d0["프로그램ID"]); if (id0) byId[id0] = { rec: rows[i], d: d0 }; }
    var drows = ctx.sheetRows(DAILY), dById = {}, keys = {};
    for (var j = 0; j < drows.length; j++) { var dd = ctx.parseJson(drows[j].publicExport().data, {}); var pid = nz(dd["프로그램ID"]); (dById[pid] = dById[pid] || []).push({ rec: drows[j], d: dd }); keys[nz(dd["실적ID"])] = 1; }
    var crows = ctx.sheetRows(CAL), cById = {};
    for (var c = 0; c < crows.length; c++) { var cd = ctx.parseJson(crows[c].publicExport().data, {}); var cp = nz(cd["프로그램ID"]); if (cp) (cById[cp] = cById[cp] || []).push({ rec: crows[c], d: cd }); }
    for (var p = 0; p < ACTS.length; p++) { var A = ACTS[p]; var ids = (A.rep ? [A.rep].concat(A.mem) : []).concat(A.del ? [A.del] : []).concat(A.rename ? [A.rename] : []); for (var q = 0; q < ids.length; q++) { if (!byId[ids[q]]) throw new Error("묶음 " + A.n + " 행 없음: " + ids[q] + " — 이미 적용됨?"); } }
    var am = ctx.meta(ARCH), mc = ctx.col("ymmeta"), dc = ctx.col("ymdata");
    var ah = ctx.parseJson(am.get("headers"), []); if (ah.indexOf("원본") < 0) { ah.push("원본"); am.set("headers", ah); ctx.app.save(am); }
    var ari = am.get("nextRowIndex") || 2, removed = 0, dailyMoved = 0, dailyArchived = 0, calMoved = 0, log = [];
    var archive = function (kind, id, d, note) { ctx.app.save(new Record(dc, { sheet: ARCH, rowIndex: ari, data: { "프로그램ID": id, "구분": kind, "이관": "035", "기준명": note, "원본": JSON.stringify(d) } })); ari++; };
    for (var k = 0; k < ACTS.length; k++) {
      var A2 = ACTS[k];
      if (A2.rename) { var RR = byId[A2.rename]; RR.d["정본명"] = A2.name; RR.rec.set("data", RR.d); ctx.app.save(RR.rec); log.push(A2.n + ": rename " + A2.rename); continue; }
      if (A2.del) { var DD = byId[A2.del]; if ((cById[A2.del] || []).length) throw new Error("삭제 대상에 캘린더 참조 있음: " + A2.del); var ddl = dById[A2.del] || []; for (var dz = 0; dz < ddl.length; dz++) { archive("일일실적", nz(ddl[dz].d["실적ID"]), ddl[dz].d, "프로그램 삭제(" + A2.del + ")에 따른 삭제"); ctx.app.delete(ddl[dz].rec); dailyArchived++; } delete dById[A2.del]; archive(nz(DD.d["구분"]), A2.del, DD.d, "삭제"); ctx.app.delete(DD.rec); delete byId[A2.del]; removed++; log.push(A2.n + ": del " + A2.del + " (+일일실적 " + ddl.length + ")"); continue; }
      var rep = A2.rep, mem = A2.mem, R = byId[rep], rd = R.d, ids2 = [rep].concat(mem);
      var smin = "", emax = "", cntSum = 0, cntAny = false;
      for (var a = 0; a < ids2.length; a++) { var x = byId[ids2[a]].d, s = nz(x["시작일"]), e = nz(x["종료일"]) || s; if (s && (!smin || s < smin)) smin = s; if (e && (!emax || e > emax)) emax = e; var cn = Number(nz(x["회차수"])); if (nz(x["회차수"]) && isFinite(cn)) { cntSum += cn; cntAny = true; } }
      var merged = []; try { merged = JSON.parse(nz(rd["병합_ID"]) || "[]"); if (!Array.isArray(merged)) merged = []; } catch (e0) { merged = []; }
      var repDates = {}; (dById[rep] || []).forEach(function (r) { var g = nz(r.d["구분"]); if (g === "공연" || g === "전시") repDates[nz(r.d["기준일자"]) + "|" + g] = 1; });
      for (var m = 0; m < mem.length; m++) {
        var M = byId[mem[m]], md = M.d;
        var ks = Object.keys(md); for (var kk = 0; kk < ks.length; kk++) { var key = ks[kk]; if (KEEP[key]) continue; if (!nz(rd[key]) && nz(md[key])) rd[key] = md[key]; }
        merged.push(mem[m]); if (nz(md["병합_ID"])) { try { var mm2 = JSON.parse(nz(md["병합_ID"])); if (Array.isArray(mm2)) merged = merged.concat(mm2); } catch (e1) {} }
        var dl = dById[mem[m]] || [], keep = [];
        for (var di = 0; di < dl.length; di++) { var dx = dl[di].d, g2 = nz(dx["구분"]), dk = nz(dx["기준일자"]) + "|" + g2;
          if ((g2 === "공연" || g2 === "전시") && repDates[dk]) { archive("일일실적", nz(dx["실적ID"]), dx, "대표 " + rep + " 에 같은 날 누계 있음"); delete keys[nz(dx["실적ID"])]; ctx.app.delete(dl[di].rec); dailyArchived++; continue; }
          dx["프로그램ID"] = rep; var base = rep + "_" + nz(dx["기준일자"]).replace(/[^0-9]/g, "") + "_" + g2, nk = base, sfx = 2; while (keys[nk]) { nk = base + "-" + sfx; sfx++; } delete keys[nz(dx["실적ID"])]; keys[nk] = 1; dx["실적ID"] = nk; dl[di].rec.set("data", dx); ctx.app.save(dl[di].rec); dailyMoved++; if (g2 === "공연" || g2 === "전시") repDates[dk] = 1; keep.push(dl[di]); }
        (dById[rep] = dById[rep] || []).push.apply(dById[rep], keep); delete dById[mem[m]];
        var cl = cById[mem[m]] || []; for (var ci = 0; ci < cl.length; ci++) { cl[ci].d["프로그램ID"] = rep; cl[ci].rec.set("data", cl[ci].d); ctx.app.save(cl[ci].rec); calMoved++; }
        archive(nz(md["구분"]), mem[m], md, "→ " + rep); ctx.app.delete(M.rec); delete byId[mem[m]]; removed++;
      }
      if (smin) rd["시작일"] = smin; if (emax) rd["종료일"] = emax;
      if (A2.start) rd["시작일"] = A2.start; if (A2.end) rd["종료일"] = A2.end; if (A2.name) rd["정본명"] = A2.name; if (A2.show) rd["공연일"] = A2.show; if (A2.genre !== undefined) rd["장르"] = A2.genre;
      rd["병합_ID"] = JSON.stringify(merged);
      var rounds = 0, all = dById[rep] || []; for (var ri = 0; ri < all.length; ri++) if (nz(all[ri].d["구분"]) === "회차발권") rounds++;
      if (rounds > 0) rd["회차수"] = String(rounds); else if (cntAny) rd["회차수"] = String(cntSum);
      R.rec.set("data", rd); ctx.app.save(R.rec);
      log.push(A2.n + ":" + rep + "<=" + mem.join(","));
    }
    am.set("rowCount", (am.get("rowCount") || 0) + (ari - (am.get("nextRowIndex") || 2))); am.set("nextRowIndex", ari); ctx.app.save(am);
    var mm = ctx.meta(MASTER); mm.set("rowCount", Math.max(0, (mm.get("rowCount") || 0) - removed)); ctx.app.save(mm);
    var dm = ctx.meta(DAILY); if (dailyArchived) { dm.set("rowCount", Math.max(0, (dm.get("rowCount") || 0) - dailyArchived)); ctx.app.save(dm); }
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    ctx.log("마스터 삭제 " + removed + " · 일일실적 이동 " + dailyMoved + " · 일일실적 보관·삭제(중복 누계) " + dailyArchived + " · 캘린더 이동 " + calMoved);
    return { removed: removed, dailyMoved: dailyMoved, dailyArchived: dailyArchived, calMoved: calMoved, log: log };
  }
};
