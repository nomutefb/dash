// api/ym-cache.pb.js — [260906 운영자 "판매현황 로딩 너무 느림"] /api/ops 응답 캐시의 판(version). 자료 표 레코드가 바뀔 때마다 환경별 판을 올린다 → ym-db.pb.js getOps 가 판이 같을 때만 캐시를 쓴다.
//   판 = $app.store() "ym_ver_dev" / "ym_ver_prod". 서버 재시작이면 store 가 비어 0 → 첫 요청이 새로 만든다. 캐시 본문도 store 에 있어 재시작 때 같이 사라진다(무해).
//   훅 핸들러는 격리 스코프라 파일 스코프 함수를 못 쓴다 → 세 훅에 같은 코드를 그대로 넣는다(실패해도 삼켜서 저장은 막지 않는다).
onRecordCreate(function (e) { e.next(); try { var n = String(e.record.collection().name || ""); $app.store().set("ym_ver_" + (/_dev$/.test(n) ? "dev" : "prod"), String(Date.now()) + "-" + Math.floor(Math.random() * 1e6)); } catch (err) {} }, "ymdata", "ymdata_dev", "ymmeta", "ymmeta_dev");
onRecordUpdate(function (e) { e.next(); try { var n = String(e.record.collection().name || ""); $app.store().set("ym_ver_" + (/_dev$/.test(n) ? "dev" : "prod"), String(Date.now()) + "-" + Math.floor(Math.random() * 1e6)); } catch (err) {} }, "ymdata", "ymdata_dev", "ymmeta", "ymmeta_dev");
onRecordDelete(function (e) { e.next(); try { var n = String(e.record.collection().name || ""); $app.store().set("ym_ver_" + (/_dev$/.test(n) ? "dev" : "prod"), String(Date.now()) + "-" + Math.floor(Math.random() * 1e6)); } catch (err) {} }, "ymdata", "ymdata_dev", "ymmeta", "ymmeta_dev");
// gzip 미들웨어($apis.gzip)는 실측상 MISO 프록시를 지나면 content-encoding 이 사라져(프록시가 풀어 보냄) 이득이 없어 안 건다(260906).
