// 회원 데이터 변경 시 저장된 회원 요약 스냅샷을 즉시 보정한다.
// 스냅샷 자체는 ymmeta 행이므로 ymdata 훅만 감시해 재귀를 피한다.

function refreshMemberSummaryIfNeeded(e) {
  if (!e || !e.record || String(e.record.get("sheet") || "") !== "ops_회원") return;
  try {
    var meta = $app.findCollectionByNameOrId("ymmeta");
    var importing = $app.findRecordsByFilter(meta, "sheet = '_member_importing'", "", 1, 0);
    if (importing && importing.length) return;
    require(__hooks + "/ym-member-summary-lib.js").rebuild();
  } catch (err) {
    console.log("[ym-member-summary] refresh failed: " + String(err));
  }
}

onRecordAfterCreateSuccess(refreshMemberSummaryIfNeeded, "ymdata");
onRecordAfterUpdateSuccess(refreshMemberSummaryIfNeeded, "ymdata");
onRecordAfterDeleteSuccess(refreshMemberSummaryIfNeeded, "ymdata");
