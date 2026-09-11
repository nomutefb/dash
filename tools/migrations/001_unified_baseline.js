// 001 — 통합 시트 기준선. 260903~04 청사진 작업(판매설정·회차·일일실적 통합, 하드코딩 폐기)이 이미 적용된 DB 인지 확인만 한다.
//   구조 변경 자체는 tools/phase*.py + /api/ops 로 이미 끝났으므로 여기선 검증 후 "적용됨" 도장만 찍는다.
//   (이 파일이 이관 체계의 0번 기준점. 이후 구조 변경은 002, 003… 으로 추가한다.)
module.exports = {
  id: "001",
  title: "통합 시트 기준선(판매설정·회차·일일실적)",
  up: function (ctx) {
    var need = ["ops_판매설정","ops_회차","ops_일일실적"], missing = [];
    for (var i = 0; i < need.length; i++) if (!ctx.meta(need[i])) missing.push(need[i]);
    if (missing.length) throw new Error("통합 시트 없음: " + missing.join(", ") + " — 청사진 이관(tools/phase*)이 먼저 필요");
    var n = ctx.sheetRows("ops_판매설정").length;
    ctx.log("판매설정 " + n + "행 확인");
    return { 판매설정: n };
  }
};
