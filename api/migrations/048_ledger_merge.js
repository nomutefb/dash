// 048 — 운영관리대장(세부운영관리대장 시트) 대조로 확인된 같은 공연 두 행 병합(260905). 병합 규칙·보관 방식은 035와 같음(대표 행에 날짜 min/max·빈 칸 보충·병합_ID, 일일실적 이동, 삭제 행은 _ym_col_archive 이관=048).
//   1) 난타 2016.10.27~29: 대장은 "난타 여수공연" 6회차 하나 → 161027_02 난타(NANTA) 흡수, 이름은 연차보고서 "난타(NANTA)".
//   2) 루미아플룻콰이어 2023.10.29: 대장 1행 → 231029_02(Re:本[리:본]) 흡수, 이름은 연차보고서 것.
//   3) 마음톡톡 2019.12.14: 대장 "마음톡톡발표회" 1행(소극장) → 191214_02 흡수, 이름은 연차보고서 "2019 마음톡톡 뮤직힐링 콘서트".
var ACTS = [{"n":1,"rep":"161027_01","mem":["161027_02"],"name":"난타(NANTA)"},{"n":2,"rep":"231029_01","mem":["231029_02"],"name":"Re: 本[리:본]-딸과 함께 듣고 싶은 감성콘서트"},{"n":3,"rep":"191214_01","mem":["191214_02"],"name":"2019 마음톡톡 뮤직힐링 콘서트"}];
module.exports = {
  id: "048",
  title: "운영관리대장 대조 중복 병합(" + ACTS.length + "묶음)",
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
    var archive = function (kind, id, d, note) { ctx.app.save(new Record(dc, { sheet: ARCH, rowIndex: ari, data: { "프로그램ID": id, "구분": kind, "이관": "048", "기준명": note, "원본": JSON.stringify(d) } })); ari++; };
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
