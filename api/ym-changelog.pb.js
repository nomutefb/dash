// api/ym-changelog.pb.js — [260906 입력절차①] 수정 이력 훅 등록(로직은 ym-changelog-lib.js). 실패해도 저장을 막지 않는다.
//   routerUse: 요청마다 사용자(X-Ym-User 헤더)·경로를 $app.store() 에 적어 두어 레코드 훅이 "누가" 를 알 수 있게 한다.
//     (PB 레코드 훅엔 요청 정보가 없다. store 는 앱 전역이라 동시 요청이면 섞일 수 있음 — 사용자 몇 명 규모라 감수, 이력에 경로가 같이 남아 대조 가능.)
routerUse(function (e) {
  // GET(화면 폴링 /api/messages·/api/logs 등)은 건너뛴다 — 안 그러면 쓰기 요청과 레코드 훅 사이에 폴링이 끼어 store 를 덮어씀(실측: 경로가 /api/messages 로 찍힘).
  try {
    var method = ""; try { method = String(e.request.method || "").toUpperCase(); } catch (e0) {}
    if (method && method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      var who = "", path = "";
      try { who = String(e.request.header.get("X-Ym-User") || ""); } catch (e1) {}
      try { path = String(e.request.url.path || ""); } catch (e2) {}
      try { who = decodeURIComponent(who); } catch (e3) {}
      // 화면이 주기적으로 보내는 POST(/api/presence 접속 신호)도 건너뛴다 — 실측: 프로그램 추가 이력의 경로가 /api/presence 로 찍힘(260906).
      if (path.indexOf("/api/presence") < 0) { $app.store().set("ym_who", who); $app.store().set("ym_route", path); }
    }
  } catch (err) {}
  return e.next();
});
onRecordCreate(function (e) { e.next(); require(__hooks + "/ym-changelog-lib.js").onChange(e, "create"); }, "ymdata", "ymdata_dev");
onRecordUpdate(function (e) { require(__hooks + "/ym-changelog-lib.js").onChange(e, "update"); e.next(); }, "ymdata", "ymdata_dev");
onRecordDelete(function (e) { require(__hooks + "/ym-changelog-lib.js").onChange(e, "delete"); e.next(); }, "ymdata", "ymdata_dev");
// 이력 조회: GET /api/ym/changelog?key=260109_01&limit=100  (환경은 X-Ym-Env / 미리보기 Referer 로 판정)
routerAdd("GET", "/api/ym/changelog", function (e) {
  try {
    var envLib = require(__hooks + "/ym-env-lib.js"), env = envLib.envOf(e);
    var dc = envLib.col($app, "ymdata", env).name;
    var q = e.requestInfo().query || {}, key = String(q.key || "").trim(), limit = parseInt(q.limit || "200", 10) || 200;
    var rows = require(__hooks + "/ym-changelog-lib.js").listFor($app, dc, key, Math.min(limit, 1000));
    return e.json(200, { ok: true, env: env || "prod", key: key, count: rows.length, rows: rows });
  } catch (err) { return e.json(500, { ok: false, error: String(err && err.message ? err.message : err) }); }
});
