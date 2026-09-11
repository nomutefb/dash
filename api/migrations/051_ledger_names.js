// 051 — 세부운영관리대장 대조 보정(260905). 대장과 같은 날 행인데 이름·날짜·장소가 대장과 어긋난 6건. 옛 값은 _ym_col_archive(이관=051)에 보관.
//   131115_02: 병합_ID에 131119_01(여도오케 15회)이 들어 있고, 교원 6회 진짜 행은 131123_01에 따로 있음 → 이 행은 여도오케스트라 제15회(2013.11.19)로 고침.
//   130614_01: 6/11~17 여수세계합창제 전체(개막식·시리즈1~4·폐막식)를 한 행이 덮는데 이름이 "시리즈 3"만 가리킴 → "2013 여수세계합창제".
//   201120_01: 별칭 "클래식산책<해설이 있는 갈라콘서트>", 베토벤 250은 11/19 여수심포니 9회(201119_01)의 부제 → 대장 이름으로.
//   121030_01·131031_02: 연극페스티벌(소극장)+합창페스티벌(대극장)이 한 행에 병합돼 있어 장소를 "대 · 소극장"으로.
var DATA = [["131115_02",{"정본명":"여도오케스트라 제15회 정기연주회","시작일":"20131119"}],["130614_01",{"정본명":"2013 여수세계합창제"}],["201120_01",{"정본명":"클래식 산책 해설이 있는 오페라 갈라 콘서트 '라 트라비아타'"}],["121030_01",{"장소":"대 · 소극장"}],["131031_02",{"장소":"대 · 소극장"}]]; // [프로그램ID, {열: 새 값}]
module.exports = {
  id: "051",
  title: "세부운영관리대장 대조 보정(이름 3·날짜 1·장소 2)",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var MASTER = "ops_프로그램마스터", ARCH = "_ym_col_archive";
    var rows = ctx.sheetRows(MASTER), byId = {};
    for (var i = 0; i < rows.length; i++) { var d0 = ctx.parseJson(rows[i].publicExport().data, {}); var id0 = nz(d0["프로그램ID"]); if (id0) byId[id0] = { rec: rows[i], d: d0 }; }
    var am = ctx.meta(ARCH), dc = ctx.col("ymdata");
    var ari = am.get("nextRowIndex") || 2, ari0 = ari, changed = 0, missing = [], log = [];
    for (var k = 0; k < DATA.length; k++) {
      var id = DATA[k][0], upd = DATA[k][1], R = byId[id];
      if (!R) { missing.push(id); continue; }
      var old = {}, diff = false;
      for (var key in upd) { old[key] = nz(R.d[key]); if (old[key] !== nz(upd[key])) diff = true; }
      if (!diff) continue;
      ctx.app.save(new Record(dc, { sheet: ARCH, rowIndex: ari, data: { "프로그램ID": id, "구분": nz(R.d["구분"]), "이관": "051", "기준명": nz(R.d["정본명"]), "원본": JSON.stringify({ old: old, "new": upd }) } })); ari++;
      for (var key2 in upd) R.d[key2] = upd[key2];
      R.rec.set("data", R.d); ctx.app.save(R.rec); changed++; log.push(id + ": " + JSON.stringify(old) + " -> " + JSON.stringify(upd));
    }
    am.set("rowCount", (am.get("rowCount") || 0) + (ari - ari0)); am.set("nextRowIndex", ari); ctx.app.save(am);
    return { changed: changed, missing: missing, log: log };
  }
};
