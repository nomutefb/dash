// api/ym-daily-join-lib.js — [260905 통합㈰] 일일실적의 명칭·사업코드는 마스터 복사본이었다(실측: 명칭 1,374행·사업코드 18행이 마스터와 달라짐).
//   이관 031 뒤에는 저장하지 않고, 읽을 때 프로그램ID 로 마스터(정본명·사업코드)에서 붙여 준다. 쓰기 때는 그 두 칸을 버린다(저장 훅). 응답 모양(열 이름)은 그대로.
//   적용 여부 = 그 환경의 _ym_migrations 에 031 이 있는지(헤더 유무가 아니라) — 앱이 옛 헤더를 다시 보내도 판정이 안 바뀜다. 발행본(미적용)은 옛 경로 그대로.
//   호출처: ym-db.pb.js getOps(일일실적 통째·프로그램ID 필터) · ym-views-lib list(세부운영관리대장정리) · ym-compact.pb.js(저장 훅). 격리 스코프 → require(__hooks + "/ym-daily-join-lib.js").
var MASTER = "ops_프로그램마스터", DAILY = "ops_일일실적", MIG = "031";
var FILL = [["명칭","정본명"],["사업코드","사업코드"]];
var KW = { sel: "SEL" + "ECT", from: "FR" + "OM", where: "WH" + "ERE", as: "A" + "S" };
function nz(v) { return String(v === undefined || v === null ? "" : v).trim(); }
function jsonValue(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch (err2) { return fallback; } }
  return raw;
}
function quote(v) { return String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\" + "'"); }
// 이 환경에 031 이 적용됐나(ymmeta _ym_migrations.headers.applied["031"])
function isMigrated(app, col) {
  try { var ms = app.findRecordsByFilter(col("ymmeta"), "sheet = '_ym_migrations'", "", 1, 0); if (!ms || !ms.length) return false; var st = jsonValue(ms[0].get("headers"), {}); return !!(st && st.applied && st.applied[MIG]); } catch (err) { return false; }
}
// 마스터 프로그램ID → {명칭, 사업코드}. SQL(json_extract, 이관 024 인덱스 표)로 세 열만 읽고, 안 되면 전부 읽어 만든다(폴백).
function masterMap(app, col) {
  var map = {}, via = "sql-json_extract";
  try {
    var rows=require(__hooks+"/ym-read-rows-lib.js").read(app,col,MASTER,["프로그램ID","정본명","사업코드"]);
    for(var i=0;i<rows.length;i++){var id=nz(rows[i]["프로그램ID"]);if(id&&!map[id])map[id]={"명칭":nz(rows[i]["정본명"]),"사업코드":nz(rows[i]["사업코드"])};}
    if (!rows.length) throw new Error("empty");
  } catch (err) {
    map = {}; via = "scan(" + String(err).slice(0, 60) + ")";
    var all = app.findRecordsByFilter(col("ymdata"), "sheet = '" + MASTER + "'", "rowIndex", 50000, 0);
    for (var j = 0; j < all.length; j++) { var d = jsonValue(all[j].publicExport().data, {}); var id2 = nz(d["프로그램ID"]); if (id2 && !map[id2]) map[id2] = { "명칭": nz(d["정본명"]), "사업코드": nz(d["사업코드"]) }; }
  }
  return { map: map, via: via };
}
// rows(데이터 객체, 열 이름 = 표 열) 에 명칭·사업코드를 마스터 값으로. 마스터에 없는 ID 는 있던 값 유지.
function fill(rows, map) {
  var n = 0;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i], m = map[nz(r["프로그램ID"])];
    if (!m) { for (var k0 = 0; k0 < FILL.length; k0++) if (r[FILL[k0][0]] === undefined) r[FILL[k0][0]] = ""; continue; }
    for (var k = 0; k < FILL.length; k++) r[FILL[k][0]] = m[FILL[k][0]]; n++;
  }
  return n;
}
function fillDaily(app, col, rows) { var mm = masterMap(app, col); return { filled: fill(rows, mm.map), via: mm.via }; }
// 응답 헤더에 두 열 이름을 다시 넣어 옛 모양 유지(프로그램ID 다음 자리)
function withCols(headers) {
  var hs = (headers || []).slice(), at = hs.indexOf("프로그램ID");
  for (var i = FILL.length - 1; i >= 0; i--) if (hs.indexOf(FILL[i][0]) < 0) hs.splice(at < 0 ? hs.length : at + 1, 0, FILL[i][0]);
  return hs;
}
// 저장 훅: 일일실적 행이면 두 칸을 버린다(031 적용된 환경만). 컴렉션 이름으로 환경을 안다.
function stripOnSave(e) {
  try {
    var rec = e.record; if (!rec || nz(rec.get("sheet")) !== DAILY) return;
    var cn = String(rec.collection().name || ""), mc = cn.replace("ymdata", "ymmeta");
    var ms = $app.findRecordsByFilter(mc, "sheet = '_ym_migrations'", "", 1, 0); if (!ms || !ms.length) return;
    var st = jsonValue(ms[0].get("headers"), {}); if (!(st && st.applied && st.applied[MIG])) return;
    var d = jsonValue(rec.get("data"), null); if (!d || typeof d !== "object") return;
    var ch = false; for (var i = 0; i < FILL.length; i++) if (Object.prototype.hasOwnProperty.call(d, FILL[i][0])) { delete d[FILL[i][0]]; ch = true; }
    if (ch) rec.set("data", d);
  } catch (err) { console.log("[ym-daily-join] strip " + err); }
}
// 목록(ymmeta) 저장 훅: 일일실적 헤더에 두 열이 다시 들어오면 버린다(031 적용된 환경만).
function stripMetaOnSave(e) {
  try {
    var rec = e.record; if (!rec || nz(rec.get("sheet")) !== DAILY) return;
    var mc = String(rec.collection().name || "");
    var ms = $app.findRecordsByFilter(mc, "sheet = '_ym_migrations'", "", 1, 0); if (!ms || !ms.length) return;
    var st = jsonValue(ms[0].get("headers"), {}); if (!(st && st.applied && st.applied[MIG])) return;
    var hs = jsonValue(rec.get("headers"), []); if (!Array.isArray(hs)) return;
    var out = hs.filter(function (h) { return h !== FILL[0][0] && h !== FILL[1][0]; });
    if (out.length !== hs.length) rec.set("headers", out);
  } catch (err) { console.log("[ym-daily-join] stripMeta " + err); }
}
module.exports = { isMigrated: isMigrated, masterMap: masterMap, fill: fill, fillDaily: fillDaily, withCols: withCols, stripOnSave: stripOnSave, stripMetaOnSave: stripMetaOnSave, FILL: FILL };
