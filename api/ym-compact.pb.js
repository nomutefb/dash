// api/ym-compact.pb.js — [260905 통합⑯-3] ymdata/ymdata_dev 행이 저장되기 직전에 빈 칸("")·_json 열을 뺀다(로직은 ym-compact-lib.js, 이관 022·023 과 같은 규칙).
//   읽는 쪽(훅 rowsFor · 창구)은 없는 열을 "" 로 채우므로 결과는 같다. PB 레코드 훅은 핸들러 안에서 require 한다(격리 스코프).
onRecordCreate(function (e) { require(__hooks + "/ym-compact-lib.js").onSave(e); e.next(); }, "ymdata", "ymdata_dev");
onRecordUpdate(function (e) { require(__hooks + "/ym-compact-lib.js").onSave(e); e.next(); }, "ymdata", "ymdata_dev");
// [260905 통합㉓] 일일실적 명칭·사업코드는 저장하지 않는다(읽을 때 마스터에서 붙임, api/ym-daily-join-lib.js). 목록(ymmeta) 헤더에 다시 들어와도 버린다. 031 적용된 환경만.
onRecordCreate(function (e) { require(__hooks + "/ym-daily-join-lib.js").stripOnSave(e); e.next(); }, "ymdata", "ymdata_dev");
onRecordUpdate(function (e) { require(__hooks + "/ym-daily-join-lib.js").stripOnSave(e); e.next(); }, "ymdata", "ymdata_dev");
onRecordCreate(function (e) { require(__hooks + "/ym-daily-join-lib.js").stripMetaOnSave(e); e.next(); }, "ymmeta", "ymmeta_dev");
onRecordUpdate(function (e) { require(__hooks + "/ym-daily-join-lib.js").stripMetaOnSave(e); e.next(); }, "ymmeta", "ymmeta_dev");
