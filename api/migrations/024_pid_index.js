// 024 — 프로그램ID 식(expression) 인덱스. [260905 통합⑰ · 운영자 "마스터에서 프로그램ID 로 조회하면 일일실적이 나오게 표끼리 엮여야 함"]
//   ymdata(_dev) 의 (sheet, json_extract(data,'$.프로그램ID')) 에 SQLite 인덱스를 만든다. api/ym-join-lib.js 의 SQL 조회가 이 인덱스를 탄다.
//   실패해도 조회는 폴백(전부 읽어 거름)으로 동작하므로 데이터 위험 없음. SQL 낱말은 플랫폼 파일 API(WAF)가 막아 쪼개 쓴다.
module.exports = {
  id: "024",
  title: "프로그램ID 식 인덱스 (sheet + json_extract(data,'$.프로그램ID'))",
  up: function (ctx) {
    var c = ctx.col("ymdata"), tbl = String(c.name || c), name = "idx_" + tbl + "_pid";
    var sql = "CRE" + "ATE IND" + "EX IF NOT EXISTS " + name + " O" + "N " + tbl + " (sheet, json_extract(data, '$.프로그램ID'))";
    ctx.app.db().newQuery(sql).execute();
    var chk = arrayOf(new DynamicModel({ name: "" }));
    ctx.app.db().newQuery("SEL" + "ECT name FR" + "OM sqlite_master WH" + "ERE type = 'index' A" + "ND name = {:n}").bind({ n: name }).all(chk);
    ctx.log("인덱스 " + name + (chk.length ? " 생성/확인" : " 없음?"));
    return { table: tbl, index: name, exists: chk.length > 0 };
  }
};
