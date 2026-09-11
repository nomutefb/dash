// PlaiMaker Coder 플랫폼 관리 파일 — DO NOT EDIT / DELETE
// PB jsvm 은 onBootstrap/cron 핸들러를 직렬화해 별도 VM 에서 실행하므로 파일 스코프
// 함수를 볼 수 없다. 로직은 lib 파일에 두고 핸들러 안에서 __hooks 전역으로 require 한다.

if (typeof onBootstrap === "function") {
  onBootstrap(function (e) {
    e.next();
    try {
      require(__hooks + "/_migration_order_guard_lib.js").normalize();
    } catch (err) {
      console.log("[MigrationOrderGuard] normalize failed:", err);
    }
  });
  cronAdd("__migration_order_guard", "* * * * *", function () {
    try {
      require(__hooks + "/_migration_order_guard_lib.js").normalize();
    } catch (err) {}
  });
}
