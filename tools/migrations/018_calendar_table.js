// 018 — 캘린더 고유 표 ops_캘린더 신설(빈 표). [260905 통합⑫ · 운영자 "캘린더 관련은 캘린더 DB에만 — 홍보 일정·담당자(직원) 일정 같은 캘린더 고유 것만; 프로그램 일정은 마스터를 보고 그려 주기만"]
//   구분=특이일정(직원 일정). 열: 일정ID·구분·시작일·종료일(YYYYMMDD)·시간·유형·내용·담당자·작성자(계정NO)·비고·입력시간·순번.
//   앱의 /api/sheet/special 은 ym-views-lib 창구(special → ops_캘린더 구분=특이일정). 옛 특이일정 33건은 017 에서 운영자 지시로 삭제됨(백업 없음).
module.exports = {
  id: "018",
  title: "ops_캘린더 표 신설(직원 특이일정)",
  up: function (ctx) {
    var TABLE = "ops_캘린더";
    if (ctx.meta(TABLE)) throw new Error(TABLE + " 이미 있음");
    var HEADERS = ["일정ID","구분","시작일","종료일","시간","유형","내용","담당자","작성자","비고","입력시간","순번"];
    ctx.app.save(new Record(ctx.col("ymmeta"), { sheet: TABLE, headers: HEADERS, source: "260905 통합⑫", rowCount: 0, nextRowIndex: 2 }));
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    return { table: TABLE, headers: HEADERS.length };
  }
};
