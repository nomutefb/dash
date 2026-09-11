// api/ym-plan.pb.js — [260906 입력절차②] 「기획 사업 등록」·「프로그램 등록」·「정산 입력」 라우트. 로직·요청 처리 전부 ym-plan-lib.js(handle) — 핸들러는 격리 스코프라 파일 스코프 함수를 못 쓴다(실측: 400 generic).
//   GET  /api/ym/plan/meta            장소·장르·분야·판매처·부서·담당자 목록
//   GET  /api/ym/plan/biz?year=2026   사업 목록(+프로그램 수·정산 합계)
//   POST /api/ym/plan/biz             사업 등록/수정 {연도,분야,사업명,회계구분,예산,사업형태,공연수입,공동기획,공동기획_기관,…,담당부서,담당자,회계담당부서,회계담당자,비고 | 사업코드=수정}
//   GET  /api/ym/plan/programs?year=&biz=   프로그램 목록(상속값·상태·정산값)
//   POST /api/ym/plan/program         프로그램 등록/수정 {사업코드,정본명,시작일,종료일,날짜미정,장소,장소기타,세부장르,기획사,유통사,판매처[],회차수,총오픈석,이층오픈,회차시간[],판매시작일,판매종료일,정원,강좌수,참여작가수,진행상태,비고 | 프로그램ID=수정}
//   POST /api/ym/plan/delete          삭제 {프로그램ID | 사업코드} (참조 있으면 거부)
//   POST /api/ym/plan/settle          정산 {프로그램ID,실지출,수입,판매수수료,유료관객,무료관객,문화나눔,오픈석}
routerAdd("GET", "/api/ym/plan/meta", function (e) { return require(__hooks + "/ym-plan-lib.js").handle(e, $app, __hooks, "meta"); });
routerAdd("GET", "/api/ym/plan/biz", function (e) { return require(__hooks + "/ym-plan-lib.js").handle(e, $app, __hooks, "biz"); });
routerAdd("POST", "/api/ym/plan/biz", function (e) { return require(__hooks + "/ym-plan-lib.js").handle(e, $app, __hooks, "bizSave"); });
routerAdd("GET", "/api/ym/plan/programs", function (e) { return require(__hooks + "/ym-plan-lib.js").handle(e, $app, __hooks, "programs"); });
routerAdd("POST", "/api/ym/plan/program", function (e) { return require(__hooks + "/ym-plan-lib.js").handle(e, $app, __hooks, "programSave"); });
routerAdd("POST", "/api/ym/plan/settle", function (e) { return require(__hooks + "/ym-plan-lib.js").handle(e, $app, __hooks, "settle"); });
routerAdd("POST", "/api/ym/plan/delete", function (e) { return require(__hooks + "/ym-plan-lib.js").handle(e, $app, __hooks, "remove"); });
