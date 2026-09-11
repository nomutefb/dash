// 057 — 운영자 정정본(예울마루_사업명정정_260906_v3.xlsx 돌려받은 것) 반영(260906).
//   ① 사업 행 회계구분 51건(2022~2024 공연: 공공성/사업성). ② 사업명 7건(헬로!오페라→헬로시리즈 ×3, 발레→무용 1 ×3, 22-a14 G페스티벌 1→야외콘서트).
//   ③ 프로그램명 221203_01 "뮤지컬<킹키부츠>"→"뮤지컬 <킹키부츠>". ④ 2024 발레는 프로그램 1개(운영자): 241031_01(예매자원장 무후보 승격, 원장 금액 108,194,900 = 54,097,450×2 이중)을 241224_01 발레 <호두까기 인형>(12/24~25)에 병합. 원장_*·표시_수입은 대표 값 유지.
//   옛 값은 _ym_col_archive(이관=057).
var ACCT = [["24-a01","예술성","공공성"],["24-a02","예술성","공공성"],["24-a03","예술성","공공성"],["24-a04","","공공성"],["24-a05","예술성","공공성"],["24-a06","","공공성"],["24-a07","상업성","사업성"],["24-a08","상업성","사업성"],["24-a09","상업성","사업성"],["24-a10","상업성","사업성"],["24-a11","상업성","사업성"],["24-a12","상업성","사업성"],["24-a13","상업성","사업성"],["24-a14","예술성","사업성"],["24-a15","상업성","사업성"],["24-a16","예술성","공공성"],["24-a17","상업성","사업성"],["24-a18","","공공성"],["23-a01","","공공성"],["23-a02","","공공성"],["23-a03","","공공성"],["23-a04","","공공성"],["23-a05","","공공성"],["23-a06","","사업성"],["23-a07","","사업성"],["23-a08","","사업성"],["23-a09","","사업성"],["23-a10","","사업성"],["23-a11","","사업성"],["23-a12","","공공성"],["23-a13","","공공성"],["23-a14","","공공성"],["23-a15","","공공성"],["23-a16","","공공성"],["23-a17","","공공성"],["22-a01","","공공성"],["22-a02","","공공성"],["22-a03","","공공성"],["22-a04","","공공성"],["22-a05","","공공성"],["22-a06","","사업성"],["22-a07","","사업성"],["22-a08","","사업성"],["22-a09","","사업성"],["22-a10","","사업성"],["22-a11","","사업성"],["22-a12","","사업성"],["22-a13","","사업성"],["22-a14","","공공성"],["22-a17","","공공성"],["22-a18","","공공성"]]; // [사업코드, 현재, 새 값]
var NAMES = [["24-a03","헬로!오페라","헬로시리즈"],["23-a03","헬로!오페라","헬로시리즈"],["23-a12","발레","무용 1"],["22-a03","헬로!오페라","헬로시리즈"],["22-a11","발레","무용 1"],["22-a14","G페스티벌 1","야외콘서트"],["21-a15","발레","무용 1"]]; // [사업코드, 현재, 새 이름]
var PROG = [["221203_01","뮤지컬<킹키부츠>","뮤지컬 <킹키부츠>"]];
var MERGE = { rep: "241224_01", mem: "241031_01" };
module.exports = {
  id: "057",
  title: "정정본 반영(회계구분 51·사업명 7·프로그램명 1·발레 병합 1)",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var MASTER = "ops_프로그램마스터", DAILY = "ops_일일실적", CAL = "ops_캘린더", ARCH = "_ym_col_archive";
    var rows = ctx.sheetRows(MASTER), byId = {};
    for (var i = 0; i < rows.length; i++) { var d0 = ctx.parseJson(rows[i].publicExport().data, {}); var id0 = nz(d0["프로그램ID"]); if (id0) byId[id0] = { rec: rows[i], d: d0, dirty: false }; }
    var am = ctx.meta(ARCH), dc = ctx.col("ymdata"), ari = am.get("nextRowIndex") || 2, ari0 = ari;
    var archive = function (kind, id, d, note) { ctx.app.save(new Record(dc, { sheet: ARCH, rowIndex: ari, data: { "프로그램ID": id, "구분": kind, "이관": "057", "기준명": note, "원본": JSON.stringify(d) } })); ari++; };
    var acct = 0, names = 0, skipped = [], missing = [];
    for (var a = 0; a < ACCT.length; a++) { var it = ACCT[a], R = byId[it[0]]; if (!R) { missing.push(it[0]); continue; } if (nz(R.d["회계구분"]) === it[2]) continue; if (nz(R.d["회계구분"]) !== it[1]) { skipped.push(it[0] + " 회계구분:" + nz(R.d["회계구분"])); continue; } archive("사업", it[0], { "회계구분": nz(R.d["회계구분"]) }, "회계구분"); R.d["회계구분"] = it[2]; R.dirty = true; acct++; }
    for (var n = 0; n < NAMES.length; n++) { var it2 = NAMES[n], R2 = byId[it2[0]]; if (!R2) { missing.push(it2[0]); continue; } if (nz(R2.d["정본명"]) === it2[2]) continue; if (nz(R2.d["정본명"]) !== it2[1]) { skipped.push(it2[0] + " 정본명:" + nz(R2.d["정본명"])); continue; } archive("사업", it2[0], { "정본명": it2[1] }, it2[1]); R2.d["정본명"] = it2[2]; R2.dirty = true; names++; }
    for (var p = 0; p < PROG.length; p++) { var it3 = PROG[p], R3 = byId[it3[0]]; if (!R3) { missing.push(it3[0]); continue; } if (nz(R3.d["정본명"]) === it3[2]) continue; if (nz(R3.d["정본명"]) !== it3[1]) { skipped.push(it3[0] + " 정본명:" + nz(R3.d["정본명"])); continue; } archive(nz(R3.d["구분"]), it3[0], { "정본명": it3[1] }, it3[1]); R3.d["정본명"] = it3[2]; R3.dirty = true; names++; }
    // ④ 병합
    var removed = 0, dailyMoved = 0, dailyArchived = 0, calMoved = 0, mlog = "";
    var RP = byId[MERGE.rep], RM = byId[MERGE.mem];
    if (RP && RM) {
      var rd = RP.d, md = RM.d, KEEP = {"프로그램ID":1,"구ID":1,"병합_ID":1,"매칭근거":1,"출처":1,"시작일":1,"종료일":1,"회차수":1,"_rowIndex":1,"표시_수입":1,"상태":1,"카테고리":1,"표시_구분":1,"표시_분야":1,"매칭":1,"부문코드":1};
      var ks = Object.keys(md); for (var kk = 0; kk < ks.length; kk++) { var key = ks[kk]; if (KEEP[key] || key.indexOf("원장_") === 0) continue; if (!nz(rd[key]) && nz(md[key])) rd[key] = md[key]; }
      var al = []; try { al = JSON.parse(nz(rd["별칭"]) || "[]"); if (!Array.isArray(al)) al = []; } catch (e) { al = []; }
      var addA = function (x) { x = nz(x); if (x && al.indexOf(x) < 0 && x !== nz(rd["정본명"])) al.push(x); };
      addA(md["정본명"]); try { var mal = JSON.parse(nz(md["별칭"]) || "[]"); if (Array.isArray(mal)) mal.forEach(addA); } catch (e3) {}
      rd["별칭"] = JSON.stringify(al);
      var merged = []; try { merged = JSON.parse(nz(rd["병합_ID"]) || "[]"); if (!Array.isArray(merged)) merged = []; } catch (e0) { merged = []; } merged.push(MERGE.mem); rd["병합_ID"] = JSON.stringify(merged);
      var drows = ctx.sheetRows(DAILY), keys = {}, repDates = {}, memRows = [];
      for (var j = 0; j < drows.length; j++) { var dd = ctx.parseJson(drows[j].publicExport().data, {}); keys[nz(dd["실적ID"])] = 1; var pid = nz(dd["프로그램ID"]); if (pid === MERGE.rep) { var g = nz(dd["구분"]); if (g === "공연" || g === "전시") repDates[nz(dd["기준일자"]) + "|" + g] = 1; } if (pid === MERGE.mem) memRows.push({ rec: drows[j], d: dd }); }
      for (var di = 0; di < memRows.length; di++) { var dx = memRows[di].d, g2 = nz(dx["구분"]), dk = nz(dx["기준일자"]) + "|" + g2;
        if ((g2 === "공연" || g2 === "전시") && repDates[dk]) { archive("일일실적", nz(dx["실적ID"]), dx, "대표에 같은 날 누계 있음"); ctx.app.delete(memRows[di].rec); dailyArchived++; continue; }
        dx["프로그램ID"] = MERGE.rep; var base = MERGE.rep + "_" + nz(dx["기준일자"]).replace(/[^0-9]/g, "") + "_" + g2, nk = base, sfx = 2; while (keys[nk]) { nk = base + "-" + sfx; sfx++; } keys[nk] = 1; dx["실적ID"] = nk; memRows[di].rec.set("data", dx); ctx.app.save(memRows[di].rec); dailyMoved++; }
      var crows = ctx.sheetRows(CAL); for (var c = 0; c < crows.length; c++) { var cd = ctx.parseJson(crows[c].publicExport().data, {}); if (nz(cd["프로그램ID"]) === MERGE.mem) { cd["프로그램ID"] = MERGE.rep; crows[c].set("data", cd); ctx.app.save(crows[c]); calMoved++; } }
      archive(nz(md["구분"]), MERGE.mem, md, "→ " + MERGE.rep); ctx.app.delete(RM.rec); delete byId[MERGE.mem]; removed++; RP.dirty = true; mlog = MERGE.rep + "<=" + MERGE.mem;
      var mm = ctx.meta(MASTER); mm.set("rowCount", Math.max(0, (mm.get("rowCount") || 0) - removed)); ctx.app.save(mm);
      if (dailyArchived) { var dm = ctx.meta(DAILY); dm.set("rowCount", Math.max(0, (dm.get("rowCount") || 0) - dailyArchived)); ctx.app.save(dm); }
    } else { mlog = "병합 대상 없음(이미 적용?)"; }
    var saved = 0; var ids = Object.keys(byId); for (var s = 0; s < ids.length; s++) { var X = byId[ids[s]]; if (X.dirty) { X.rec.set("data", X.d); ctx.app.save(X.rec); saved++; } }
    am.set("rowCount", (am.get("rowCount") || 0) + (ari - ari0)); am.set("nextRowIndex", ari); ctx.app.save(am);
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    return { acct: acct, names: names, removed: removed, dailyMoved: dailyMoved, dailyArchived: dailyArchived, calMoved: calMoved, merge: mlog, skipped: skipped, missing: missing, saved: saved };
  }
};
