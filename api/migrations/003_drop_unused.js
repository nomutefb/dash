// 003 — 앱·훅이 읽지 않는 시트 삭제. 근거(260904 실측): 개발본 5개 탭 실행 요청 기록 + standalone.html·api/*.js 이름 검색 → 아래 시트 호출 0건.
//   동결 5(frozen→ 통합 시트로 이전 완료) · 이력 2(판매설정·일일실적에 합류 완료) · 명단 2(사업마스터·공연색인: 코드 참조 0) · 기타 5(괄호 이름 중복 0행, 기획공연판매현황, 전시일일입력, 테스트 잔재 2).
//   개발본에서 먼저 실행해 검증한 뒤, 새 빌드 발행 후에 발행본에 실행한다(발행본 옛 빌드는 동결 시트를 읽으므로 그 전에 발행본에 돌리면 안 됨).
module.exports = {
  id: "003",
  title: "미사용 시트 14개 삭제(동결5·이력2·명단2·기타5)",
  up: function (ctx) {
    var targets = ["ops_공연마스터","ops_회차상세","ops_일일입력","exhib_master","exhib_daily","ops_공연마스터_이력","ops_일일입력_이력","ops_사업마스터","ops_공연색인","ops_세부운영관리대장(정리)","ops_기획공연판매현황","ops_전시일일입력","ztest_p0","ops_ztest_ops"];
    var out = {}, totalRows = 0, metas = 0;
    for (var i = 0; i < targets.length; i++) {
      var name = targets[i], rows = ctx.sheetRows(name), n = 0;
      for (var j = 0; j < rows.length; j++) { ctx.app.delete(rows[j]); n++; }
      var meta = ctx.meta(name), hadMeta = false;
      if (meta) { ctx.app.delete(meta); hadMeta = true; metas++; }
      totalRows += n;
      out[name] = { rows: n, meta: hadMeta };
      ctx.log(name + ": 행 " + n + (hadMeta ? ", 목록 삭제" : ", 목록 없음"));
    }
    return { sheets: metas, rows: totalRows, detail: out };
  }
};
