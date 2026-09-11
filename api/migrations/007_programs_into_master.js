// 007 — programs(프로그램 관리, 올해 운영 명단) 시트를 프로그램마스터에 합친다. [260904 통합① · 운영자 결정 "유사한 표는 열로 합친다"]
//   - 프로그램마스터에 열 12개 추가(NO·콘텐츠구분·줄임말·담당자·URL·장르구분·공동기획여부·지원사업여부·GS아트센터협업여부·수익성·홍보노출·장르주관식)
//   - programs 각 행을 프로그램ID 로 마스터 행에 얹는다(programs 값 우선 — 앱의 _pmOverlayPrograms 가 이미 그렇게 보고 있던 값들). programs 공란은 마스터 값을 지우지 않는다.
//     마스터에 없는 ID 는 새 행(파생 열: 연도·구분·카테고리·부문코드·표시_*·상태·매칭근거·출처). 날짜는 마스터 규칙(YYYYMMDD).
//   - 덮어쓴 옛 값은 결과 changes(diff/kept) 에 남긴다(되돌리기 자료 · _ym_migrations 에 저장됨). programs 시트(행+목록)는 삭제 — 백업 backups/programs-260904-2300.json.
//   - 앱은 안 고친다: 훅 창구(api/ym-programs-lib.js) 가 /api/programs · /api/sheet/program 을 마스터 행으로 번역한다.
module.exports = {
  id: "007",
  title: "programs 시트 → 프로그램마스터 열 통합(12열 추가, 36행 얹기, programs 삭제)",
  up: function (ctx) {
    // ── 창구 lib(api/ym-programs-lib.js) 와 같은 표·함수를 인라인(이관은 require 없이 자기완결) ──
    var MASTER = "ops_프로그램마스터";
    // [옛 programs 열, 프로그램마스터 열, 날짜여부]
    var MAP = [["NO","NO"],["콘텐츠구분","콘텐츠구분"],["풀네임","정본명"],["줄임말","줄임말"],["판매시작일","판매시작일",1],["판매종료일","판매종료일",1],["시작일","시작일",1],["종료일","종료일",1],["담당자","담당자"],["장소","장소"],["URL","URL"],["프로그램ID","프로그램ID"],["홍보시작일","홍보시작일",1],["구분","장르구분"],["공동기획여부","공동기획여부"],["지원사업여부","지원사업여부"],["GS아트센터협업여부","GS아트센터협업여부"],["회차","회차수"],["수익성","수익성"],["홍보노출","홍보노출"],["장르","장르주관식"],["사업코드","사업코드"]];
    var HEADERS = MAP.map(function (m) { return m[0]; });
    var NEW_MASTER_COLS = ["NO","콘텐츠구분","줄임말","담당자","URL","장르구분","공동기획여부","지원사업여부","GS아트센터협업여부","수익성","홍보노출","장르주관식"];

    function jsonValue(raw, fallback) {
      if (raw === null || raw === undefined) return fallback;
      try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
      if (typeof raw === "string") { try { return JSON.parse(raw); } catch (err2) { return fallback; } }
      return raw;
    }
    function nz(v) { return String(v === undefined || v === null ? "" : v).trim(); }
    // 화면/입력 날짜 → YYYYMMDD 문자열('' 이면 '')
    function toD8(v) {
      var s = nz(v);
      if (!s) return "";
      var m = s.match(/^(\d{4})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})/) || s.match(/^(\d{4})(\d{2})(\d{2})$/);
      if (m) return m[1] + ("0" + m[2]).slice(-2) + ("0" + m[3]).slice(-2);
      var n = Number(s);
      if (n > 20000 && n < 80000) { var d = new Date(Math.round((n - 25569) * 86400000)); var p = function (x) { return (x < 10 ? "0" : "") + x; }; return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()); }
      return "";
    }
    // YYYYMMDD → YYYY-MM-DD
    function toIso(v) { var d = toD8(v); return d ? (d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8)) : ""; }

    // body → {마스터열: 값}. values 가 배열이면 HEADERS 순서. promoFlag/sideCells(옛 규약)도 흡수.
    function fromBody(body) {
      var vals = {};
      var values = body && body.values;
      var i;
      if (Array.isArray(values)) { for (i = 0; i < HEADERS.length && i < values.length; i++) vals[HEADERS[i]] = values[i]; }
      else if (values && typeof values === "object") { var ks = Object.keys(values); for (i = 0; i < ks.length; i++) vals[ks[i]] = values[ks[i]]; }
      var ek = Object.keys(body || {});
      for (i = 0; i < ek.length; i++) {
        var k = ek[i];
        if (k === "values" || k === "headers") continue;
        if (k === "promoFlag") { vals["홍보노출"] = body[k]; continue; }
        if (k === "sideCells" && body[k] && typeof body[k] === "object") { var sk = Object.keys(body[k]); for (var j = 0; j < sk.length; j++) vals[sk[j]] = body[k][sk[j]]; continue; }
        vals[k] = body[k];
      }
      var out = {};
      for (i = 0; i < MAP.length; i++) {
        var vk = MAP[i][0];
        if (!Object.prototype.hasOwnProperty.call(vals, vk)) continue;
        var v = vals[vk]; v = (v === undefined || v === null) ? "" : v;
        if (MAP[i][2]) v = toD8(v);
        out[MAP[i][1]] = (typeof v === "number") ? String(v) : String(v);
      }
      return out;
    }
    var BUN = {"공연":["기획공연","공연","1"],"전시":["기획전시","전시","2"],"예술교육":["교육","교육","3"],"대관":["대관공연","공연","1"],"기타":["기타","기타","6"]};
    // 파생 열 채움(새 행) / 갱신(연도·별칭)
    function derive(d, isNew) {
      var s = nz(d["시작일"]);
      if (s.length >= 4) d["연도"] = s.slice(0, 4);
      var ct = nz(d["콘텐츠구분"]);
      if (isNew) {
        var b = BUN[ct] || BUN["기타"];
        if (!nz(d["구분"])) d["구분"] = (ct === "대관") ? "대관" : "기획";
        if (!nz(d["카테고리"])) d["카테고리"] = (ct === "대관" && nz(d["장르구분"]) === "전시") ? "대관전시" : b[0];
        if (!nz(d["표시_구분"])) d["표시_구분"] = d["구분"];
        if (!nz(d["표시_분야"])) d["표시_분야"] = b[1];
        if (!nz(d["부문코드"])) d["부문코드"] = b[2];
        if (!nz(d["상태"])) d["상태"] = "정상";
        if (!nz(d["매칭근거"])) d["매칭근거"] = "프로그램관리";
        if (!nz(d["출처"])) d["출처"] = "programs";
      }
      var short = nz(d["줄임말"]);
      if (short) {
        var al = d["별칭"]; if (typeof al === "string") { var raw = al; try { al = JSON.parse(al); } catch (e) { al = nz(raw) ? [nz(raw)] : []; } }
        if (!Array.isArray(al)) al = [];
        if (al.indexOf(short) < 0) al.push(short);
        d["별칭"] = JSON.stringify(al);
      }
      return d;
    }

    var L = { MASTER: MASTER, NEW_MASTER_COLS: NEW_MASTER_COLS, fromBody: fromBody, derive: derive };
    var progMeta = ctx.meta("programs");
    if (!progMeta) throw new Error("programs 시트 없음 — 이미 통합됐거나 대상 아님");
    var masterMeta = ctx.meta(L.MASTER);
    if (!masterMeta) throw new Error("프로그램마스터 시트 없음");
    // 1) 마스터 헤더 확장
    var hs = ctx.parseJson(masterMeta.get("headers"), []), addedCols = [];
    for (var i = 0; i < L.NEW_MASTER_COLS.length; i++) if (hs.indexOf(L.NEW_MASTER_COLS[i]) < 0) { hs.push(L.NEW_MASTER_COLS[i]); addedCols.push(L.NEW_MASTER_COLS[i]); }
    masterMeta.set("headers", hs); ctx.app.save(masterMeta);
    // 2) 마스터 행 색인
    var mrows = ctx.sheetRows(L.MASTER), byId = {};
    var dupIds = [];
    for (var m = 0; m < mrows.length; m++) { var md = ctx.parseJson(mrows[m].publicExport().data, {}); var id = nz(md["프로그램ID"]); if (!id) continue; if (byId[id]) dupIds.push(id); else byId[id] = mrows[m]; }
    if (dupIds.length) throw new Error("프로그램마스터에 같은 프로그램ID 가 둘 이상: " + dupIds.join(", ") + " — 정리 후 실행");
    // 3) programs 행 얹기
    var prows = ctx.sheetRows("programs"), updated = 0, added = 0, skipped = 0, changes = [];
    var nri = masterMeta.get("nextRowIndex") || 2;
    for (var p = 0; p < prows.length; p++) {
      var pd = ctx.parseJson(prows[p].publicExport().data, {});
      var pid = nz(pd["프로그램ID"]);
      if (!pid) { skipped++; ctx.log("건너뜀(ID 없음): " + JSON.stringify(pd).slice(0, 120)); continue; }
      var patch = L.fromBody({ values: pd });
      var rec = byId[pid];
      if (rec) {
        var d = ctx.parseJson(rec.publicExport().data, {}), before = JSON.parse(JSON.stringify(d)), diff = {}, kept = {};
        var ks = Object.keys(patch);
        for (var k = 0; k < ks.length; k++) { var key = ks[k], nv = patch[key], ov = (d[key] === undefined || d[key] === null) ? "" : String(d[key]);
          if (nv === "" && ov !== "") { kept[key] = ov; continue; }        // programs 공란은 마스터 값을 지우지 않는다(내용 보존)
          if (ov !== nv) d[key] = nv; }
        L.derive(d, false);
        var bk = Object.keys(d); for (var b2 = 0; b2 < bk.length; b2++) { var ovv = (before[bk[b2]] === undefined || before[bk[b2]] === null) ? "" : String(before[bk[b2]]), nvv = String(d[bk[b2]]); if (ovv !== nvv) diff[bk[b2]] = [ovv, nvv]; }
        rec.set("data", d); ctx.app.save(rec); updated++;
        if (Object.keys(diff).length || Object.keys(kept).length) changes.push({ id: pid, rowIndex: rec.get("rowIndex"), diff: diff, kept: kept });
      } else {
        var nd = {}; for (var h = 0; h < hs.length; h++) nd[hs[h]] = "";
        var pk = Object.keys(patch); for (var q = 0; q < pk.length; q++) nd[pk[q]] = patch[pk[q]];
        L.derive(nd, true);
        ctx.app.save(new Record(ctx.col("ymdata"), { sheet: L.MASTER, rowIndex: nri, data: nd }));
        changes.push({ id: pid, rowIndex: nri, added: true });
        nri++; added++;
      }
      ctx.log(pid + (rec ? " 갱신" : " 추가"));
    }
    masterMeta.set("rowCount", (masterMeta.get("rowCount") || 0) + added); masterMeta.set("nextRowIndex", nri); ctx.app.save(masterMeta);
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    // 4) programs 시트 삭제(행 + 목록)
    var removed = 0;
    for (var r = 0; r < prows.length; r++) { ctx.app.delete(prows[r]); removed++; }
    ctx.app.delete(progMeta);
    return { addedCols: addedCols, programs: prows.length, updated: updated, added: added, skipped: skipped, programsRemoved: removed, changes: changes };
  }
};
