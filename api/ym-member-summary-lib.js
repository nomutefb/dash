// 회원 요약 스냅샷 공용 계산기.
// ymmeta의 _member_summary 행에 저장해 /api/ops?summary=1은 행 스캔 없이 반환한다.

var MEMBER_SUMMARY_SHEET = "_member_summary";
// [260904 발행관리] 환경(dev/prod)별 컬렉션 — 호출자가 env 를 넘긴다(ym-db.pb.js 의 __env). 크론/훅(env 없음)은 발행본.
var ENV = "";
function colFor(base) { return $app.findCollectionByNameOrId(ENV === "dev" ? base + "_dev" : base); }

function memberSummaryJsonValue(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch (err2) {} }
  return raw;
}

function memberSummaryMeta() {
  var col = colFor("ymmeta");
  var rows = $app.findRecordsByFilter(col, "sheet = '_member_summary'", "", 1, 0);
  return rows && rows.length ? rows[0] : null;
}

function memberSummaryRead() {
  var row = memberSummaryMeta();
  if (!row) return null;
  var value = memberSummaryJsonValue(row.get("headers"), null);
  if (!value || value.snapshot !== true) return null;
  // v150 클라이언트의 성공 판정 계약을 유지한다. 기존 저장본도 재계산 없이 복구한다.
  value.summary = true;
  return value;
}

function memberSummarySave(value) {
  var col = colFor("ymmeta"), row = memberSummaryMeta();
  if (!row) row = new Record(col, { sheet: MEMBER_SUMMARY_SHEET, headers: value, source: "member-summary", rowCount: 1, nextRowIndex: 1 });
  else row.set("headers", value);
  row.set("source", "member-summary");
  row.set("rowCount", 1);
  $app.save(row);
  return value;
}

function memberSummaryRebuild() {
  var dataCol = colFor("ymdata");
  var records = $app.findRecordsByFilter(dataCol, "sheet = 'ops_회원'", "rowIndex", 50000, 0);
  var sido = {}, city = {}, region = {"여수":0,"순천":0,"광양":0,"전남광주권":0,"수도권":0,"그 외":0};
  var rawAge = {}, geo = {}, total = 0, unknownAddress = 0;
  var gjGu = {"동구":1,"서구":1,"남구":1,"북구":1,"광산구":1};
  var geoKeys = {"서울특별시":1,"인천광역시":1,"경기도":1,"강원특별자치도":1,"충청북도":1,"충청남도":1,"세종특별자치시":1,"대전광역시":1,"전북특별자치도":1,"경상북도":1,"대구광역시":1,"울산광역시":1,"부산광역시":1,"경상남도":1,"제주특별자치도":1,"여수시":1,"순천시":1,"광양시":1,"목포시":1,"고흥군":1,"광주":1};
  function dataValue(raw) { return memberSummaryJsonValue(raw, {}) || {}; }
  function cityName(s1, s2) {
    if (s1 === "전남광주통합특별시") return gjGu[s2] ? "Example State 207" : s2;
    var match = String(s1).match(/^(.+?)(특별시|광역시|특별자치시)$/);
    return match ? match[1] + "시" : s2;
  }
  function ageName(data) {
    var value = String(data["연령대"] || "").trim();
    if (value) return value;
    var birth = String(data["생년월일"] || "").replace(/[^0-9]/g, "");
    var birthYear = parseInt(birth.slice(0, 4), 10), nowYear = new Date().getFullYear();
    return birthYear > 1900 && birthYear <= nowYear ? Math.max(0, Math.floor((nowYear - birthYear) / 10) * 10) + "대" : "미상";
  }
  for (var i = 0; i < records.length; i++) {
    var data = dataValue(records[i].get("data"));
    var s1 = String(data["주소1"] || "").trim(), s2 = String(data["주소2"] || "").trim(), age = ageName(data);
    total++;
    rawAge[age] = (rawAge[age] || 0) + 1;
    if (!s1 || s1 === "불분명") { unknownAddress++; continue; } // [260907 주소정제] 「불분명」(ym-addr-lib UNCLEAR)은 미상으로 — 지역 집계 제외
    sido[s1] = (sido[s1] || 0) + 1;
    var cityNameValue = cityName(s1, s2), cityKey = s1 + "|" + cityNameValue;
    city[cityKey] = (city[cityKey] || 0) + 1;
    if (cityNameValue === "여수시") region["여수"]++;
    else if (cityNameValue === "순천시") region["순천"]++;
    else if (cityNameValue === "광양시") region["광양"]++;
    else if (s1 === "전남광주통합특별시") region["전남광주권"]++;
    else if (s1 === "서울특별시" || s1 === "경기도" || s1 === "인천광역시") region["수도권"]++;
    else region["그 외"]++;
    var geoKey = s1 === "전남광주통합특별시" ? (gjGu[s2] ? "전남광주통합특별시|광주" : (geoKeys[cityNameValue] ? "전남광주통합특별시|" + cityNameValue : "전남광주통합특별시")) : (geoKeys[s1] ? s1 : null);
    if (geoKey) geo[geoKey] = (geo[geoKey] || 0) + 1;
  }
  var ageBands = {
    "10·20대": (rawAge["10세 미만"] || 0) + (rawAge["10대"] || 0) + (rawAge["20대"] || 0),
    "30대": rawAge["30대"] || 0,
    "40대": rawAge["40대"] || 0,
    "50대": rawAge["50대"] || 0,
    "60대 이상": (rawAge["60대"] || 0) + (rawAge["70대"] || 0) + (rawAge["80대"] || 0) + (rawAge["90대"] || 0) + (rawAge["100대"] || 0),
    "미상": rawAge["미상"] || 0
  };
  return memberSummarySave({
    summary: true,
    snapshot: true,
    total: total,
    knownAddress: total - unknownAddress,
    unknownAddress: unknownAddress,
    sidoCounts: sido,
    cityCounts: city,
    regionCounts: region,
    ageCounts: ageBands,
    rawAgeCounts: rawAge,
    geoCounts: geo,
    updatedAt: new Date().toISOString()
  });
}

module.exports = {
  read: function (env) { ENV = env === "dev" ? "dev" : ""; return memberSummaryRead(); },
  rebuild: function (env) { ENV = env === "dev" ? "dev" : ""; return memberSummaryRebuild(); },
  getOrBuild: function (env) { ENV = env === "dev" ? "dev" : ""; return memberSummaryRead() || memberSummaryRebuild(); }
};
