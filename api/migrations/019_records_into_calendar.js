// 019 — records(홍보 신청 178행 28열) → ops_캘린더 구분='홍보' 행. [260905 통합⑬ · 운영자 "레코드랑 캘린더랑 합쳐주고, 홍보일정인지 직원일정인지 구분자 하나"]
//   구분 열이 그 구분자(홍보 / 특이일정). 열 대응은 api/ym-records-lib.js MAP 과 같다: No→순번, 입력시간(KST)→입력시간, 날짜→시작일=종료일(YYYYMMDD),
//   연도·월·일·요일은 저장하지 않고 읽을 때 만든다(실측: 178행 전부 날짜와 일치), 게시 담당자→담당자, 신청자→작성자, 그 외는 띄어쓰기·밑줄 뺀 이름. 일정ID = "PR"+4자리(새 rowIndex).
//   옛 records 시트는 행+목록 삭제(운영자: 백업 불필요). 앱 무수정 — /api/records 는 창구가 옛 28열로 답한다.
module.exports = {
  id: "019",
  title: "records → ops_캘린더 구분=홍보(17열 추가, 178행 이동, records 삭제)",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var pad = function (n, w) { var s = String(n); while (s.length < w) s = "0" + s; return s; };
    var TABLE = "ops_캘린더", SRC = "records", PART = "홍보";
    var MAP = {"No":"순번","입력시간(KST)":"입력시간","날짜":null,"연도":null,"월":null,"일":null,"요일":null,"플랫폼 1":"플랫폼1","플랫폼 2":"플랫폼2","콘텐츠 구분":"콘텐츠구분","프로그램":"프로그램","담당 부서":"담당부서","콘텐츠 제목":"제목","콘텐츠 형식":"형식","콘텐츠 내용":"내용","게시 담당자":"Jordan Foster 23154","진행 상태":"상태","비고":"비고","신청자":"Morgan Foster 23153","결과_링크":"결과링크","결과_첨부URL":"https://example.invalid/synthetic-attachment","결과_비고":"결과비고","직전 상태":"직전상태","상태 변경 KST":"상태변경시각","보류사유":"보류사유","재신청사유":"재신청사유","취소사유":"취소사유","프로그램ID":"프로그램ID"};
    var NEW_COLS = ["프로그램ID","플랫폼1","플랫폼2","콘텐츠구분","프로그램","담당부서","제목","형식","상태","결과링크","결과첨부URL","결과비고","직전상태","상태변경시각","보류사유","재신청사유","취소사유"];
    function toD8(v) { var s = nz(v); if (!s) return ""; var m = s.match(/^(\d{4})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})/) || s.match(/^(\d{4})(\d{2})(\d{2})$/); if (m) return m[1] + pad(m[2], 2) + pad(m[3], 2); var n = Number(s); if (/^\d{5}$/.test(s) && n > 20000 && n < 80000) { var d = new Date(Math.round((n - 25569) * 86400000)); return d.getUTCFullYear() + pad(d.getUTCMonth() + 1, 2) + pad(d.getUTCDate(), 2); } return s; }
    var tm = ctx.meta(TABLE); if (!tm) throw new Error(TABLE + " 없음 — 018 먼저");
    var sm = ctx.meta(SRC); if (!sm) throw new Error(SRC + " 없음 — 이미 통합됐거나 대상 아님");
    var oh = ctx.parseJson(sm.get("headers"), []);
    for (var x = 0; x < oh.length; x++) { var hh = nz(oh[x]); if (hh && !Object.prototype.hasOwnProperty.call(MAP, hh)) throw new Error(SRC + " 미매핑 열: " + hh); }
    var hs = ctx.parseJson(tm.get("headers"), []), added = [];
    for (var a = 0; a < NEW_COLS.length; a++) { if (hs.indexOf(NEW_COLS[a]) >= 0) throw new Error(TABLE + " 에 이미 있는 열: " + NEW_COLS[a]); hs.push(NEW_COLS[a]); added.push(NEW_COLS[a]); }
    tm.set("headers", hs); ctx.app.save(tm);
    var rows = ctx.sheetRows(SRC), dc = ctx.col("ymdata"), nri = tm.get("nextRowIndex") || 2, moved = 0, badDate = [], derivedMismatch = [];
    var DN = ["일","월","화","수","목","금","토"];
    for (var i = 0; i < rows.length; i++) {
      var d = ctx.parseJson(rows[i].publicExport().data, {}), o = {};
      for (var h = 0; h < hs.length; h++) o[hs[h]] = "";
      var ks = Object.keys(d); for (var k = 0; k < ks.length; k++) { var t = MAP[ks[k]]; if (t === undefined || t === null) continue; var raw = d[ks[k]]; o[t] = (raw === undefined || raw === null) ? "" : raw; }
      var d8 = toD8(d["날짜"]); o["시작일"] = d8; o["종료일"] = d8;
      if (!/^\d{8}$/.test(d8)) badDate.push(rows[i].get("rowIndex") + ":" + nz(d["날짜"]));
      else { var dt = new Date(+d8.slice(0, 4), +d8.slice(4, 6) - 1, +d8.slice(6, 8)); if (String(dt.getFullYear()) !== nz(d["연도"]) || String(dt.getMonth() + 1) !== String(+nz(d["월"])) || String(dt.getDate()) !== String(+nz(d["일"])) || (DN[dt.getDay()] + "요일") !== nz(d["요일"])) derivedMismatch.push(rows[i].get("rowIndex") + ":" + nz(d["날짜"]) + "/" + nz(d["연도"]) + "-" + nz(d["월"]) + "-" + nz(d["일"]) + " " + nz(d["요일"])); }
      o[PART_COL_NAME()] = PART; o["일정ID"] = "PR" + pad(nri, 4);
      ctx.app.save(new Record(dc, { sheet: TABLE, rowIndex: nri, data: o })); nri++; moved++;
    }
    function PART_COL_NAME() { return "구분"; }
    for (var r = 0; r < rows.length; r++) ctx.app.delete(rows[r]);
    ctx.app.delete(sm);
    tm.set("rowCount", (tm.get("rowCount") || 0) + moved); tm.set("nextRowIndex", nri); ctx.app.save(tm);
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    ctx.log("홍보 행 " + moved + " · 날짜 못 읽음 " + badDate.length + " · 연도/월/일/요일 불일치 " + derivedMismatch.length);
    return { addedCols: added, src: rows.length, moved: moved, badDate: badDate, derivedMismatch: derivedMismatch, headers: hs.length };
  }
};
