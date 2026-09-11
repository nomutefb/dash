// 025 — 코드표 재편(한 행 = 코드 하나) + 캘린더 홍보 행 코드 색인. [260905 통합⑲ · 운영자 "캘린더 인덱싱이 코드표를 따라 유동적으로 바뀌어야 함"]
//   코드표: platforms 10행(플랫폼1/2/3) → 구분=플랫폼 (값·세부·짧은이름) PF001~ · contents 5행의 세 열은 독립 목록이므로 콘텐츠구분 CG·콘텐츠형식 CF·진행상태 ST 로 쪼갬 ·
//         applysettings 12행(키/값) → 구분=신청설정 AS (값=키, 세부=설정값). 순서 10,20,… · 사용여부=사용. 옛 코드ID(platforms01…) 는 아무도 안 참조(020 에서 오늘 만든 것)해 버림.
//   캘린더: 플랫폼코드·형식코드·콘텐츠구분코드 열 추가, 홍보 행마다 이름 칸으로 코드를 찾아 채움(이름 칸은 그대로). 못 찾은 이름은 결과에 목록.
//   프로그램ID 가 비었거나 마스터에 없는 홍보 행은 고치지 않고 목록만 낸다(앞으로의 쓰기는 창구가 막음).
module.exports = {
  id: "025",
  title: "코드표 재편(코드ID 영구·순서·사용여부) + 캘린더 코드 색인",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var C = require(__hooks + "/ym-codes-lib.js"), J = require(__hooks + "/ym-join-lib.js");
    var CODE = "ops_코드표", CAL = "ops_캘린더";
    var cm = ctx.meta(CODE); if (!cm) throw new Error(CODE + " 없음");
    var oh = ctx.parseJson(cm.get("headers"), []), already = oh.indexOf("사용여부") >= 0;
    var OLD = ["platforms","contents","applysettings"], NEW = ["플랫폼","콘텐츠구분","콘텐츠형식","진행상태","신청설정"];
    var recs = ctx.sheetRows(CODE), old = [], oldRecs = [], leftover = 0;
    for (var i = 0; i < recs.length; i++) { var od = ctx.parseJson(recs[i].publicExport().data, {}), og = nz(od["구분"]); if (OLD.indexOf(og) >= 0) { old.push(od); oldRecs.push(recs[i]); } else if (NEW.indexOf(og) >= 0 || !og) leftover++; else throw new Error("코드표에 모르는 구분 행: " + og); }
    // 재실행 안전: 이미 재편됐고 옛 행이 없으면 코드표는 건너뛰고 캘린더 색인만
    var byPart = function (p) { var o = []; for (var k = 0; k < old.length; k++) if (nz(old[k]["구분"]) === p) o.push(old[k]); return o; };
    var rows = [], seq = {};
    if (already && !old.length) { rows = null; }
    else {
    var add = function (list, val, detail, short, extra) { var pre = C.PREFIX[list]; seq[pre] = (seq[pre] || 0) + 1; var n = seq[pre]; var r = { "코드ID": pre + (n < 10 ? "00" + n : n < 100 ? "0" + n : String(n)), "구분": list, "값": val, "세부": detail || "", "짧은이름": short || "", "순서": String(n * 10), "사용여부": "사용", "별칭": "", "비고": extra || "" }; rows.push(r); return r; };
    var pf = byPart("platforms"); for (var a = 0; a < pf.length; a++) add("플랫폼", nz(pf[a]["플랫폼1"]), nz(pf[a]["플랫폼2"]), nz(pf[a]["플랫폼3"]), "");   // 세부 "-" 는 그대로(앱이 그 모양으로 씀; 매칭 키는 "-" 를 빈 것으로 봄)
    var ct = byPart("contents"), seen = {};
    var lists = [["콘텐츠구분","콘텐츠구분"],["콘텐츠형식","콘텐츠형식"],["진행상태","진행상태"]];
    for (var l = 0; l < lists.length; l++) for (var b = 0; b < ct.length; b++) { var v = nz(ct[b][lists[l][1]]); if (!v || seen[lists[l][0] + "|" + v]) continue; seen[lists[l][0] + "|" + v] = 1; add(lists[l][0], v, "", "", ""); }
    var as = byPart("applysettings"); for (var c = 0; c < as.length; c++) add("신청설정", nz(as[c]["키"]), nz(as[c]["값"]), "", "");
    add("신청설정", "홍보_프로그램ID_필수", "FALSE", "", "TRUE 로 바꾸면 홍보 신청에 프로그램ID 없으면 409(앱이 프로그램 이름을 못 찾으면 빈 값으로 보내므로 지금은 FALSE)");
    // 갈아끼우기 순서(중간 실패 대비): 새 행 먼저 저장 → 목록(headers)·순번 → 옛 행 삭제. 재실행하면 남은 옛 행만 다시 처리.
    var dc = ctx.col("ymdata"), nri = 2;
    if (already) { nri = cm.get("nextRowIndex") || 2; }
    for (var w = 0; w < rows.length; w++) { ctx.app.save(new Record(dc, { sheet: CODE, rowIndex: nri, data: rows[w] })); nri++; }
    cm.set("headers", C.HEADERS.slice()); cm.set("rowCount", rows.length + (already ? leftover : 0)); cm.set("nextRowIndex", nri); ctx.app.save(cm);
    var sm = ctx.meta("_codeseq"), mc = ctx.col("ymmeta");
    if (sm) { sm.set("headers", seq); ctx.app.save(sm); } else ctx.app.save(new Record(mc, { sheet: "_codeseq", headers: seq, source: "codeseq", rowCount: 0, nextRowIndex: 0 }));
    for (var d = 0; d < oldRecs.length; d++) ctx.app.delete(oldRecs[d]);
    }
    // 캘린더 열 추가 + 색인
    var km = ctx.meta(CAL); if (!km) throw new Error(CAL + " 없음");
    var kh = ctx.parseJson(km.get("headers"), []), addCols = ["플랫폼코드","형식코드","콘텐츠구분코드"], added = [];
    for (var x = 0; x < addCols.length; x++) if (kh.indexOf(addCols[x]) < 0) { kh.push(addCols[x]); added.push(addCols[x]); }
    km.set("headers", kh); ctx.app.save(km);
    var ri = C.reindexCalendar(ctx.app, ctx.col);
    // 프로그램ID 점검(고치지 않음)
    var crows = ctx.sheetRows(CAL), blank = [], unknown = [];
    for (var y = 0; y < crows.length; y++) { var cd = ctx.parseJson(crows[y].publicExport().data, {}); if (nz(cd["구분"]) !== "홍보") continue; var pid = nz(cd["프로그램ID"]); if (!pid) { blank.push(nz(cd["일정ID"]) + " " + nz(cd["제목"]).slice(0, 20)); continue; } if (!J.findBy(ctx.app, ctx.col, "ops_프로그램마스터", "프로그램ID", pid).rows.length) unknown.push(nz(cd["일정ID"]) + " " + pid + " " + nz(cd["제목"]).slice(0, 20)); }
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    ctx.log("코드표 " + old.length + " → " + (rows ? rows.length : leftover) + "행 " + JSON.stringify(seq) + " · 캘린더 색인 " + ri.rows + "행(바뀜 " + ri.touched + ") · 미매핑 " + JSON.stringify(ri.missing) + " · 프로그램ID 빈 " + blank.length + " 없는 " + unknown.length);
    return { codes: rows ? rows.length : leftover, skippedRebuild: !rows, seq: seq, calendarCols: added, reindex: ri, programBlank: blank, programUnknown: unknown };
  }
};
