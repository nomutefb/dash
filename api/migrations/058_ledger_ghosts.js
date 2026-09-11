// 058 — 예매자원장 "무후보 승격"(상태 원장추가) 유령 행 정리(260906, 운영자 "정리 ㄱㄱ"). 057의 241031_01과 같은 부류: 티켓 판매 시작일이 시작일로 들어가고 이름이 원장 상품명(손열음·문지영·오월애·한페앙…)인 행.
//   ① 실제 프로그램이 있는 12건은 그 행에 병합(대표 값 유지, 빈 칸만 보충, 원장_* 열은 안 옮김, 유령 행 이름은 별칭으로, 일일실적·캘린더 이동, 병합_ID 기록).
//   ② 짝이 없거나 여러 공연에 걸친 3건(161231_14 책갈피1, 170417_01 헬로우! 오페라 여수(사랑의 묘약+마술피리 판매 합산), 181231_01 상품명)은 보관 후 삭제.
//   ③ 200729_01 국립현대무용단 <스윙>은 2020 보고서의 코로나 취소 사업(한문연 방방곡곡, 20-a14) — 201231_02~05와 같은 꼴로 남김(사업코드 20-a14, 상태 취소).
//   ④ 170414_01 CLASSIC MONTH 패키지 티켓은 17-a15의 실제 프로그램(2017 보고서 ⑮)이라 그대로 둠. 옛 값은 _ym_col_archive(이관=058).
var ACTS = [["150924_01","151231_20"],["160304_01","161231_13"],["160421_01","161231_15"],["160427_01","161231_16"],["160513_01","161231_17"],["160527_02","161231_18"],["160714_01","161231_20"],["170928_01","170724_01"],["201022_01","200701_01"],["240817_01","240718_03"],["241101_02","240913_01"],["241206_01","241017_01"]]; // [대표, 유령]
var DELS = ["161231_14","170417_01","181231_01"];
module.exports = {
  id: "058",
  title: "예매원장 유령 행 정리(병합 12·삭제 3·취소 표시 1)",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var MASTER = "ops_프로그램마스터", DAILY = "ops_일일실적", CAL = "ops_캘린더", ARCH = "_ym_col_archive";
    var KEEP = {"프로그램ID":1,"구ID":1,"병합_ID":1,"매칭근거":1,"출처":1,"시작일":1,"종료일":1,"회차수":1,"_rowIndex":1,"상태":1,"카테고리":1,"표시_구분":1,"표시_분야":1,"매칭":1,"부문코드":1,"판매시작일":1,"판매종료일":1,"티켓오픈일":1,"기간":1};
    var rows = ctx.sheetRows(MASTER), byId = {};
    for (var i = 0; i < rows.length; i++) { var d0 = ctx.parseJson(rows[i].publicExport().data, {}); var id0 = nz(d0["프로그램ID"]); if (id0) byId[id0] = { rec: rows[i], d: d0, dirty: false }; }
    var am = ctx.meta(ARCH), dc = ctx.col("ymdata"), ari = am.get("nextRowIndex") || 2, ari0 = ari;
    var archive = function (kind, id, d, note) { ctx.app.save(new Record(dc, { sheet: ARCH, rowIndex: ari, data: { "프로그램ID": id, "구분": kind, "이관": "058", "기준명": note, "원본": JSON.stringify(d) } })); ari++; };
    var drows = ctx.sheetRows(DAILY), dById = {}, keys = {};
    for (var j = 0; j < drows.length; j++) { var dd = ctx.parseJson(drows[j].publicExport().data, {}); var pid = nz(dd["프로그램ID"]); (dById[pid] = dById[pid] || []).push({ rec: drows[j], d: dd }); keys[nz(dd["실적ID"])] = 1; }
    var crows = ctx.sheetRows(CAL), cById = {};
    for (var c = 0; c < crows.length; c++) { var cd = ctx.parseJson(crows[c].publicExport().data, {}); var cp = nz(cd["프로그램ID"]); if (cp) (cById[cp] = cById[cp] || []).push({ rec: crows[c], d: cd }); }
    var removed = 0, dailyMoved = 0, dailyArchived = 0, calMoved = 0, log = [];
    var moveDaily = function (from, to) { var dl = dById[from] || [], repDates = {}; (dById[to] || []).forEach(function (r) { var g = nz(r.d["구분"]); if (g === "공연" || g === "전시") repDates[nz(r.d["기준일자"]) + "|" + g] = 1; });
      for (var di = 0; di < dl.length; di++) { var dx = dl[di].d, g2 = nz(dx["구분"]), dk = nz(dx["기준일자"]) + "|" + g2;
        if ((g2 === "공연" || g2 === "전시") && repDates[dk]) { archive("일일실적", nz(dx["실적ID"]), dx, "대표 " + to + " 에 같은 날 누계 있음"); delete keys[nz(dx["실적ID"])]; ctx.app.delete(dl[di].rec); dailyArchived++; continue; }
        dx["프로그램ID"] = to; var base = to + "_" + nz(dx["기준일자"]).replace(/[^0-9]/g, "") + "_" + g2, nk = base, sfx = 2; while (keys[nk]) { nk = base + "-" + sfx; sfx++; } delete keys[nz(dx["실적ID"])]; keys[nk] = 1; dx["실적ID"] = nk; dl[di].rec.set("data", dx); ctx.app.save(dl[di].rec); dailyMoved++; (dById[to] = dById[to] || []).push(dl[di]); }
      delete dById[from];
      var cl = cById[from] || []; for (var ci = 0; ci < cl.length; ci++) { cl[ci].d["프로그램ID"] = to; cl[ci].rec.set("data", cl[ci].d); ctx.app.save(cl[ci].rec); calMoved++; } };
    for (var k = 0; k < ACTS.length; k++) {
      var rep = ACTS[k][0], mem = ACTS[k][1], RP = byId[rep], RM = byId[mem];
      if (!RP) { log.push("대표 없음 " + rep); continue; } if (!RM) { log.push("이미 없음 " + mem); continue; }
      var rd = RP.d, md = RM.d;
      var ks = Object.keys(md); for (var kk = 0; kk < ks.length; kk++) { var key = ks[kk]; if (KEEP[key] || key.indexOf("원장_") === 0) continue; if (!nz(rd[key]) && nz(md[key])) rd[key] = md[key]; }
      var al = []; try { al = JSON.parse(nz(rd["별칭"]) || "[]"); if (!Array.isArray(al)) al = []; } catch (e) { al = []; }
      var addA = function (x) { x = nz(x); if (x && al.indexOf(x) < 0 && x !== nz(rd["정본명"])) al.push(x); };
      addA(md["정본명"]); try { var mal = JSON.parse(nz(md["별칭"]) || "[]"); if (Array.isArray(mal)) mal.forEach(addA); } catch (e3) {}
      rd["별칭"] = JSON.stringify(al);
      var merged = []; try { merged = JSON.parse(nz(rd["병합_ID"]) || "[]"); if (!Array.isArray(merged)) merged = []; } catch (e0) { merged = []; } merged.push(mem); rd["병합_ID"] = JSON.stringify(merged);
      moveDaily(mem, rep);
      archive(nz(md["구분"]), mem, md, "→ " + rep); ctx.app.delete(RM.rec); delete byId[mem]; removed++; RP.dirty = true; log.push(rep + "<=" + mem);
    }
    for (var dI = 0; dI < DELS.length; dI++) { var id = DELS[dI], RD = byId[id]; if (!RD) { log.push("이미 없음 " + id); continue; }
      var dl2 = dById[id] || []; for (var z = 0; z < dl2.length; z++) { archive("일일실적", nz(dl2[z].d["실적ID"]), dl2[z].d, "프로그램 삭제(" + id + ")"); ctx.app.delete(dl2[z].rec); dailyArchived++; }
      if ((cById[id] || []).length) throw new Error("삭제 대상에 캘린더 참조 있음: " + id);
      archive(nz(RD.d["구분"]), id, RD.d, "삭제(유령 행)"); ctx.app.delete(RD.rec); delete byId[id]; removed++; log.push("del " + id); }
    var SW = byId["200729_01"]; if (SW && nz(SW.d["상태"]) !== "취소") { archive(nz(SW.d["구분"]), "200729_01", SW.d, "취소 표시 전"); SW.d["사업코드"] = "20-a14"; SW.d["정본명"] = "국립현대무용단 <스윙> (코로나19 취소)"; SW.d["상태"] = "취소"; SW.d["표시_구분"] = "기획"; SW.d["표시_분야"] = "공연"; SW.d["카테고리"] = "기획공연"; SW.d["비고"] = "2020 사업운영결과보고서: 한문연 방방곡곡 사업, 코로나19로 취소"; SW.dirty = true; log.push("200729_01 취소 표시"); }
    var saved = 0; var ids = Object.keys(byId); for (var s = 0; s < ids.length; s++) { var X = byId[ids[s]]; if (X.dirty) { X.rec.set("data", X.d); ctx.app.save(X.rec); saved++; } }
    am.set("rowCount", (am.get("rowCount") || 0) + (ari - ari0)); am.set("nextRowIndex", ari); ctx.app.save(am);
    var mm = ctx.meta(MASTER); mm.set("rowCount", Math.max(0, (mm.get("rowCount") || 0) - removed)); ctx.app.save(mm);
    if (dailyArchived) { var dm = ctx.meta(DAILY); dm.set("rowCount", Math.max(0, (dm.get("rowCount") || 0) - dailyArchived)); ctx.app.save(dm); }
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    return { removed: removed, dailyMoved: dailyMoved, dailyArchived: dailyArchived, calMoved: calMoved, saved: saved, log: log };
  }
};
