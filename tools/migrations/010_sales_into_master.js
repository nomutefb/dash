// 010 — 판매설정(1,250행 27열, 공연/전시 프로그램당 1행) → 프로그램마스터 열 통합. [260904 통합② · 운영자 "유사한 표는 열로 합친다"]
//   - 마스터에 열 18개 추가(판매구분·판매명칭·기준석·총회차·총오픈석·목표점유율·티켓오픈일·판매상태·운영일수·목표관객·목표금액·최종유료·최종무료·최종총인원·최종매출·최종점유율·기준명·공연일목록)
//   - 프로그램ID 로 마스터 행에 얹는다(전부 마스터에 있음 — 없으면 중단). 규칙:
//       정본명 = 마스터 유지, 판매설정 명칭이 다르면 판매명칭 열에 보존 · 사업코드 = 마스터 유지(다르면 conflicts 기록)
//       종료일 = 판매설정 값이 더 늦으면 판매설정(회차 대장과 일치 — 마스터가 첫날만 적힌 행), 기록
//       시작일·연도·장소·구ID·수익성·무료여부 = 마스터 비어 있으면 채움(fills 기록), 다르면 마스터 유지·기록
//       새 열 = 그대로 복사(티켓오픈일은 YYYYMMDD, 날짜가 아니면 원문 보존·기록)
//   - 판매설정 시트(행+목록) 삭제. 백업 backups/ops-판매설정-260905-p0~3.json. 앱 무수정(창구 api/ym-sales-lib.js).
module.exports = {
  id: "010",
  title: "판매설정 → 프로그램마스터 열 통합(18열 추가, 1,250행 얹기, 판매설정 삭제)",
  up: function (ctx) {
    var MASTER = "ops_프로그램마스터", SRC = "ops_판매설정", PART_COL = "판매구분";
    var MAP = [["프로그램ID","프로그램ID"],["구분","판매구분"],["명칭","정본명"],["기준석","기준석"],["총회차","총회차"],["총오픈석","총오픈석"],["목표점유율","목표점유율"],["수익성","수익성"],["티켓오픈일","티켓오픈일",1],["종료일","종료일",1],["시작일","시작일",1],["상태","판매상태"],["사업코드","사업코드"],["연도","연도"],["운영일수","운영일수"],["목표관객","목표관객"],["목표금액","목표금액"],["최종유료","최종유료"],["최종무료","최종무료"],["최종총인원","최종총인원"],["최종매출","최종매출"],["최종점유율","최종점유율"],["무료여부","무료여부"],["장소","장소"],["구ID","구ID"],["기준명","기준명"],["공연일목록","공연일목록"]];
    var NEW_COLS = ["판매구분","판매명칭","기준석","총회차","총오픈석","목표점유율","티켓오픈일","판매상태","운영일수","목표관객","목표금액","최종유료","최종무료","최종총인원","최종매출","최종점유율","기준명","공연일목록"];
    var KEEP_MASTER = {"정본명":1,"사업코드":1};
    var TAKE_SRC_IF_DIFF = {"종료일":1};
    var FILL_ONLY = {"시작일":1,"연도":1,"장소":1,"구ID":1,"수익성":1,"무료여부":1};
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    function toD8(v) { var s = nz(v); if (!s) return ""; var m = s.match(/^(\d{4})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})/) || s.match(/^(\d{4})(\d{2})(\d{2})$/); if (m) return m[1] + ("0" + m[2]).slice(-2) + ("0" + m[3]).slice(-2); var n = Number(s); if (n > 20000 && n < 80000) { var d = new Date(Math.round((n - 25569) * 86400000)); var p = function (x) { return (x < 10 ? "0" : "") + x; }; return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()); } return ""; }
    var srcMeta = ctx.meta(SRC); if (!srcMeta) throw new Error(SRC + " 없음 — 이미 통합됐거나 대상 아님");
    var mm = ctx.meta(MASTER); if (!mm) throw new Error(MASTER + " 없음");
    var hs = ctx.parseJson(mm.get("headers"), []), added = [];
    for (var i = 0; i < NEW_COLS.length; i++) if (hs.indexOf(NEW_COLS[i]) < 0) { hs.push(NEW_COLS[i]); added.push(NEW_COLS[i]); }
    if (added.length !== NEW_COLS.length) throw new Error("마스터에 이미 있는 열: " + NEW_COLS.filter(function (c) { return added.indexOf(c) < 0; }).join(",") + " — 중단");
    mm.set("headers", hs); ctx.app.save(mm);
    var mrows = ctx.sheetRows(MASTER), byId = {}, dup = [];
    for (var m = 0; m < mrows.length; m++) { var md = ctx.parseJson(mrows[m].publicExport().data, {}); var id = nz(md["프로그램ID"]); if (!id) continue; if (byId[id]) dup.push(id); else byId[id] = mrows[m]; }
    if (dup.length) throw new Error("마스터 중복 프로그램ID: " + dup.join(","));
    var srows = ctx.sheetRows(SRC), missing = [], conflicts = [], fills = [], endFixed = 0, updated = 0, nameKept = 0;
    for (var s = 0; s < srows.length; s++) {
      var sd = ctx.parseJson(srows[s].publicExport().data, {}), sid = nz(sd["프로그램ID"]);
      if (!sid) { ctx.log("ID 없는 판매설정 행 건너뜀"); continue; }
      var rec = byId[sid]; if (!rec) { missing.push(sid); continue; }
      var d = ctx.parseJson(rec.publicExport().data, {});
      for (var c = 0; c < MAP.length; c++) {
        var sk = MAP[c][0], mk = MAP[c][1], v = sd[sk]; v = (v === undefined || v === null) ? "" : v;
        if (MAP[c][2]) { var d8 = toD8(v); if (nz(v) && !d8) { conflicts.push({ id: sid, col: mk, sales: v, kept: "raw(날짜 아님)" }); d8 = v; } v = d8; }
        var sv = nz(v), ov = nz(d[mk]);
        if (sk === "프로그램ID") continue;
        if (NEW_COLS.indexOf(mk) >= 0) { d[mk] = v; continue; }
        if (mk === "정본명") { if (sv && sv !== ov) { d["판매명칭"] = v; nameKept++; conflicts.push({ id: sid, col: mk, master: ov, sales: sv, kept: "판매명칭 열" }); } continue; }
        if (KEEP_MASTER[mk]) { if (sv && sv !== ov) conflicts.push({ id: sid, col: mk, master: ov, sales: sv, kept: "master" }); continue; }
        if (TAKE_SRC_IF_DIFF[mk]) { if (sv && sv > ov) { conflicts.push({ id: sid, col: mk, master: ov, sales: sv, kept: "sales" }); d[mk] = v; endFixed++; } else if (sv && sv !== ov) conflicts.push({ id: sid, col: mk, master: ov, sales: sv, kept: "master" }); continue; }
        if (FILL_ONLY[mk]) { if (sv && !ov) { d[mk] = v; fills.push({ id: sid, col: mk, sales: sv }); } else if (sv && sv !== ov) conflicts.push({ id: sid, col: mk, master: ov, sales: sv, kept: "master" }); continue; }
        d[mk] = v;
      }
      if (!nz(d[PART_COL])) throw new Error("판매설정 구분 없음: " + sid);
      rec.set("data", d); ctx.app.save(rec); updated++;
    }
    if (missing.length) throw new Error("마스터에 없는 판매설정 프로그램ID " + missing.length + "건: " + missing.slice(0, 10).join(","));
    var removed = 0; for (var r = 0; r < srows.length; r++) { ctx.app.delete(srows[r]); removed++; }
    ctx.app.delete(srcMeta);
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    ctx.log("갱신 " + updated + " · 빈칸 채움 " + fills.length + " · 종료일 교정 " + endFixed + " · 판매명칭 보존 " + nameKept + " · 충돌 기록 " + conflicts.length);
    return { addedCols: added, sales: srows.length, updated: updated, fills: fills, endFixed: endFixed, nameKept: nameKept, removed: removed, conflicts: conflicts };
  }
};
