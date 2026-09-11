// ym-env.pb.js — [260904 발행관리] 개발/발행 DB 분리 라우트. 구현은 ym-env-lib.js.
//   환경 판정은 ym-db.pb.js 와 같은 규칙(헤더 X-Ym-Env: dev|prod, 없으면 Referer 에 미리보기 주소면 dev).
//   - GET  /api/ym/env               내가 어느 환경인지 + 양쪽 시트 수 + 이관 적용 현황
//   - POST /api/ym/env/init-dev      개발용 컬렉션(ymdata_dev·ymmeta_dev) 생성(스키마 복제). 이미 있으면 그대로
//   - POST /api/ym/env/refresh-dev   {sheets?:[…]} 발행 → 개발 데이터 복사(개발 쪽 덮어씀). 발행본은 읽기만
//   - GET  /api/ym/migrations        이관 파일 목록 + 적용 여부(요청 환경 기준)
//   - POST /api/ym/migrate           {only?:'002', force?:bool} 미적용 이관 실행(요청 환경 기준). 발행 절차 = prod 로 호출

// 라우트 핸들러는 격리 스코프(파일 스코프 함수 못 봄) — 환경 판정·본문 파싱도 lib 에서 require 한다.

routerAdd("GET", "/api/ym/env", function (e) {
  var lib = require(__hooks + "/ym-env-lib.js"), env = lib.envOf(e);
  try { var s = lib.envSummary($app, __hooks); s.here = env || "prod"; return e.json(200, s); }
  catch (err) { return e.json(500, { error: String(err), here: env || "prod" }); }
});

routerAdd("POST", "/api/ym/env/init-dev", function (e) {
  var lib = require(__hooks + "/ym-env-lib.js");
  try { return e.json(200, lib.initDev($app)); }
  catch (err) { return e.json(500, { ok: false, error: String(err) }); }
});

routerAdd("POST", "/api/ym/env/refresh-dev", function (e) {
  var lib = require(__hooks + "/ym-env-lib.js"), body = lib.bodyOf(e);
  try { return e.json(200, { ok: true, result: lib.refreshDev($app, Array.isArray(body.sheets) && body.sheets.length ? body.sheets : null) }); }
  catch (err) { return e.json(500, { ok: false, error: String(err) }); }
});

routerAdd("GET", "/api/ym/migrations", function (e) {
  var lib = require(__hooks + "/ym-env-lib.js"), env = lib.envOf(e);
  try { return e.json(200, { env: env || "prod", migrations: lib.migStatus($app, __hooks, env) }); }
  catch (err) { return e.json(500, { error: String(err) }); }
});

routerAdd("POST", "/api/ym/migrate", function (e) {
  var lib = require(__hooks + "/ym-env-lib.js"), env = lib.envOf(e), body = lib.bodyOf(e);
  if (env !== "dev" && body.confirmProd !== true) return e.json(409, { error: "prod migrate requires confirmProd:true", env: "prod" });
  try { return e.json(200, { env: env || "prod", result: lib.runMigrations($app, __hooks, env, { only: body.only ? String(body.only) : null, force: body.force === true }) }); }
  catch (err) { return e.json(500, { ok: false, error: String(err) }); }
});
