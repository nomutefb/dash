// api/ym-plan-lib.js — [260906 입력절차②] 「기획 사업 등록」·「프로그램 등록」·「정산 입력」 창구(로직). 라우트는 ym-plan.pb.js.
//   운영자 규칙(260906):
//   - 사업: 연도·분야(기획 공연/기획 전시/예술 교육)·사업명·회계구분(공공성|사업성 하나)·계획 사업비(예산)·사업형태(단일|다수|미정, 기본 미정)·공연수입(유료|무료, 기본 유료)
//           ·특수사업(공동기획/공모사업/협력사업 — 고르면 기관명 필수)·담당부서·담당자·회계담당부서·회계담당자(슈퍼관리자). 사업코드는 그 연도·분야에서 입력 순서대로 자동(26-a19 → 26-a20).
//           실지출·수입·수수료·누적/유료/무료 관객은 읽기 전용 = 붙은 프로그램 정산값의 합(일부만 정산돼도 중간 합계).
//   - 프로그램: 붙일 사업(필수) → 구분·특이사항·담당부서·담당자·유료/무료가 사업에서 따라옴. 프로그램ID 는 시작일 yymmdd + 그날 순번 자동.
//           장소는 고정 목록 + 기타(직접 입력). 공연이면 장르·회차·오픈석·2층 오픈·회차별 시간, 교육이면 정원·강좌수, 전시면 참여작가수.
//           상태(진행상태)는 날짜로 자동(예정/진행중/완료), 취소·연기만 사람이 저장.
//   - 정산: 프로그램별 실지출·수입·판매수수료·유료·무료·문화나눔·오픈석 → 저장 즉시 그 사업 행 합계 갱신. 잠금 없음(수정 이력은 ym-changelog).
//   마스터 열은 앱이 이미 읽는 열을 그대로 씀: 표시_사업비(실지출)·표시_수입(수입)·발권유료·발권초대·총오픈석·회차수·기간·세부장르·무료여부.
//   Goja ES5 / CommonJS. 격리 스코프 → 핸들러 안에서 require(__hooks + "/ym-plan-lib.js").
var MASTER = "ops_프로그램마스터", DAILY = "ops_일일실적", CAL = "ops_캘린더", MGR = "managers";
var PLACES = ["대극장","소극장","7층 전시실","장도 전시실","장도 야외 광장","7층 세미나실","6층 교육실","3층 교육실","장도 교육실","리허설룸 1","리허설룸 2","예울마루 바닥 분수","예울마루 야외 일원","장도 야외 일원","기타"];
var GENRES = ["클래식","뮤지컬","어린이","연극","무용·발레","국악","콘서트","기타"];
var FIELDS = { "기획 공연": { f: "공연", letter: "a", cat: "기획공연", ct: "공연", part: "1" }, "기획 전시": { f: "전시", letter: "b", cat: "기획전시", ct: "전시", part: "2" }, "예술 교육": { f: "교육", letter: "c", cat: "교육", ct: "예술교육", part: "3" } };
var FIELD_BY_F = {"공연":"기획 공연","전시":"기획 전시","교육":"예술 교육"};
var SALES_CH = ["예울마루 홈페이지","티켓사"];
var BIZ_NEW_COLS = ["사업형태","공연수입","공동기획_기관","공모사업_기관","협력사업_기관","담당부서","회계담당부서","회계담당자"];
var PROG_NEW_COLS = ["전표실적","기획사","유통사","판매처","이층오픈","회차시간","날짜미정","정원","강좌수","참여작가수","문화나눔","판매수수료","정산일","정산자","진행상태","담당부서","사업특이사항"];
var SUM_MAP = [["전표실적","표시_사업비"],["정산서매출","표시_수입"],["판매수수료","판매수수료"],["유료인원","발권유료"],["초대인원","발권초대"],["횟수","회차수"]];

function nz(v) { return String(v === undefined || v === null ? "" : v).trim(); }
function num(v) { var s = nz(v).replace(/[^0-9.\-]/g, ""); var n = Number(s); return isFinite(n) ? n : 0; }
function quote(v) { return String(v).split("\\").join("\\\\").split("'").join("\\'"); } // WAF 가 정규식 따옴표 치환 꼴을 403 으로 막아 split/join
function jsonValue(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch (err2) { return fallback; } }
  if (typeof raw === "object") return raw;
  return fallback;
}
function arr(v) { if (Array.isArray(v)) return v; var s = nz(v); if (!s) return []; try { var j = JSON.parse(s); if (Array.isArray(j)) return j; } catch (e) {} return s.split(/\s*[,|]\s*/).filter(Boolean); }
function toD8(v) { var s = nz(v); if (!s) return ""; var m = s.match(/^(\d{4})[-./]?(\d{1,2})[-./]?(\d{1,2})/); if (!m) return ""; return m[1] + ("0" + m[2]).slice(-2) + ("0" + m[3]).slice(-2); }
function toIso(d8) { d8 = nz(d8); return d8.length === 8 ? d8.slice(0, 4) + "-" + d8.slice(4, 6) + "-" + d8.slice(6, 8) : ""; }
function todayD8() { var d = new Date(Date.now() + 9 * 3600 * 1000); return d.toISOString().slice(0, 10).replace(/-/g, ""); }
function daysBetween(a, b) { if (a.length !== 8 || b.length !== 8) return ""; var da = Date.UTC(+a.slice(0, 4), +a.slice(4, 6) - 1, +a.slice(6, 8)), db = Date.UTC(+b.slice(0, 4), +b.slice(4, 6) - 1, +b.slice(6, 8)); var n = Math.round((db - da) / 86400000) + 1; return n > 0 ? String(n) : ""; }
function rowData(rec) { var d = jsonValue(rec.publicExport().data, {}); return (d && typeof d === "object" && !Array.isArray(d)) ? d : {}; }
function metaOf(app, col, sheet) { var rows = app.findRecordsByFilter(col("ymmeta"), "sheet = '" + quote(sheet) + "'", "", 1, 0); return rows && rows.length ? rows[0] : null; }
function headersOf(meta) { var h = jsonValue(meta ? meta.get("headers") : [], []); return Array.isArray(h) ? h : []; }
function ensureHeaders(app, col, cols) { var meta = metaOf(app, col, MASTER); if (!meta) throw new Error("마스터 목록 없음"); var hs = headersOf(meta), add = false; for (var i = 0; i < cols.length; i++) if (hs.indexOf(cols[i]) < 0) { hs.push(cols[i]); add = true; } if (add) { meta.set("headers", hs); app.save(meta); } return meta; }
function touchLastmod(app, col) { try { var lm = app.findRecordsByFilter(col("ymmeta"), "sheet = '_lastmod'", "", 1, 0); if (lm && lm.length) { lm[0].set("source", new Date().toISOString()); app.save(lm[0]); } } catch (e) {} }
function allMaster(app, col) { return app.findRecordsByFilter(col("ymdata"), "sheet = '" + MASTER + "'", "rowIndex", 50000, 0); }
function isBiz(d) { return nz(d["구분"]) === "사업"; }
function yearOf(d) { var y = nz(d["연도"]); if (y) return y; var s = nz(d["시작일"]); return s.length >= 4 ? s.slice(0, 4) : ""; }
function fieldLabel(d) { return FIELD_BY_F[nz(d["표시_분야"])] || nz(d["표시_분야"]); }
function status(d) {
  var manual = nz(d["진행상태"]); if (manual === "취소" || manual === "연기") return manual;
  if (nz(d["상태"]) === "취소") return "취소";
  var t = todayD8(), s = nz(d["시작일"]), e = nz(d["종료일"]) || s;
  if (!s) return "예정"; if (t < s) return "예정"; if (t > e) return "완료"; return "진행중";
}
function special(d) { var out = []; if (nz(d["공동기획_기관"])) out.push("공동 기획_" + nz(d["공동기획_기관"])); if (nz(d["공모사업_기관"])) out.push("공모 사업_" + nz(d["공모사업_기관"])); if (nz(d["협력사업_기관"])) out.push("협력 사업_" + nz(d["협력사업_기관"])); return out.join(" / "); }

// ── 담당자 명단 ──
function managers(app, col) {
  var rows = app.findRecordsByFilter(col("ymdata"), "sheet = '" + MGR + "'", "rowIndex", 500, 0), out = [], depts = {}, byNo = {}, byName = {};
  for (var i = 0; i < rows.length; i++) { var d = rowData(rows[i]); var name = nz(d["담당자"]); if (!name) continue; var no = nz(d["계정NO"]), dept = nz(d["담당부서"]); var off = nz(d["휴직여부"]); var it = { "계정NO": no, "담당자": name, "담당부서": dept, "관리자여부": nz(d["관리자여부"]), "휴직": off, "회계": isOn(d["회계여부"]) }; out.push(it); if (dept) depts[dept] = 1; if (no) byNo[no] = it; byName[name] = it; }
  return { list: out, depts: Object.keys(depts).sort(), byNo: byNo, byName: byName };
}
function isOn(v) { return /^(1|true|y|yes|on|o|✓|✔|예|사용|활성|t)$/i.test(nz(v)); } // 앱 isFlagOn 과 같은 판정
function mgrNo(m, v) { v = nz(v); if (!v) return ""; if (/^\d{3,}$/.test(v)) return v; return m.byName[v] ? (m.byName[v]["계정NO"] || v) : v; }
function mgrName(m, v) { v = nz(v); if (!v) return ""; return m.byNo[v] ? m.byNo[v]["담당자"] : v; }

// ── 번호 ──
function nextBizCode(app, col, year, letter) {
  var yy = String(year).slice(-2), re = new RegExp("^" + yy + "-" + letter + "(\\d+)$"), mx = 0, recs = allMaster(app, col);
  for (var i = 0; i < recs.length; i++) { var d = rowData(recs[i]); var m = nz(d["사업코드"]).match(re); if (m && isBiz(d)) mx = Math.max(mx, parseInt(m[1], 10)); var m2 = nz(d["프로그램ID"]).match(re); if (m2) mx = Math.max(mx, parseInt(m2[1], 10)); }
  return yy + "-" + letter + ("0" + (mx + 1)).slice(-2);
}
function nextProgramId(app, col, d8) {
  var p = d8.slice(2, 8), re = new RegExp("^" + p + "_(\\d+)$"), mx = 0, recs = allMaster(app, col);
  for (var i = 0; i < recs.length; i++) { var m = nz(rowData(recs[i])["프로그램ID"]).match(re); if (m) mx = Math.max(mx, parseInt(m[1], 10)); }
  return p + "_" + ("0" + (mx + 1)).slice(-2);
}

// ── 관객 출처(260906 운영자 배선 확인) ──
//   마스터 발권유료/발권초대는 옛 스냅샷일 수 있다(신년음악회 852 = 12/30 판매 시점). 화면·정산 기본값은
//   ① 정산했으면 마스터(정산 때 저장한 값) ② 대장 회차발권 행 합(발권유료·발권초대 — 유료/초대가 갈려 있음)
//   ③ 일일실적 마지막 누계(누계유료·누계무료·누계총인원, 판매 시스템은 초대를 안 가른다) ④ 마스터 값 순.
function dailyIndex(app, col) {
  var rows = app.findRecordsByFilter(col("ymdata"), "sheet = '" + DAILY + "'", "", 50000, 0), idx = {};
  for (var i = 0; i < rows.length; i++) {
    var d = rowData(rows[i]), pid = nz(d["프로그램ID"]); if (!pid) continue;
    var e = idx[pid] || (idx[pid] = { tk: null, last: null });
    if (nz(d["구분"]) === "회차발권") { if (!e.tk) e.tk = { "유료": 0, "초대": 0, n: 0 }; e.tk["유료"] += num(d["발권유료"]); e.tk["초대"] += num(d["발권초대"]); e.tk.n++; }
    else if (nz(d["누계총인원"]) || nz(d["누계유료"])) { var dt = nz(d["기준일자"]); if (!e.last || dt > e.last["기준일자"]) e.last = { "기준일자": dt, "유료": num(d["누계유료"]), "무료": num(d["누계무료"]), "총": num(d["누계총인원"]) || (num(d["누계유료"]) + num(d["누계무료"])), "금액": num(d["누계금액"]) }; }
  }
  return idx;
}
function audience(d, di) {
  var e = di ? di[nz(d["프로그램ID"])] : null;
  if (nz(d["정산일"])) return { "유료": num(d["발권유료"]), "무료": num(d["발권초대"]), "출처": "정산 " + toIso(d["정산일"]) };
  if (e && e.tk && e.tk.n) { var fr = e.tk["초대"] || (e.last ? e.last["무료"] : 0); return { "유료": e.tk["유료"], "무료": fr, "출처": "대장 발권 " + e.tk.n + "회차" + ((!e.tk["초대"] && fr) ? " + 일일 무료" : "") }; } // 대장 행에 초대가 비어 있으면 일일 누계무료로 보충
  if (e && e.last) return { "유료": e.last["유료"], "무료": e.last["무료"], "출처": "일일 누계 " + toIso(e.last["기준일자"]) };
  return { "유료": num(d["발권유료"]), "무료": num(d["발권초대"]), "출처": (nz(d["발권유료"]) || nz(d["발권초대"])) ? "마스터(옛 값일 수 있음)" : "없음" };
}
function progCost(d) { return nz(d["전표실적"]) ? num(d["전표실적"]) : Math.max(0, num(d["표시_사업비"]) - num(d["판매수수료"])); } // 실지출(전표) = 표시_사업비(집행+수수료) − 수수료

// ── 사업 ──
function bizSums(progs) {
  var s = {"전표실적":0,"정산서매출":0,"판매수수료":0,"유료인원":0,"초대인원":0,"횟수":0,"문화나눔":0,"정산수":0,"프로그램수":0};
  for (var i = 0; i < progs.length; i++) { var d = progs[i]; if (status(d) === "취소") continue; s["프로그램수"]++; if (!nz(d["정산일"])) continue; s["정산수"]++; s["전표실적"] += progCost(d); s["정산서매출"] += num(d["표시_수입"]); s["판매수수료"] += num(d["판매수수료"]); s["유료인원"] += num(d["발권유료"]); s["초대인원"] += num(d["발권초대"]); s["횟수"] += num(d["회차수"]); s["문화나눔"] += num(d["문화나눔"]); } // 정산된 프로그램만 합산(중간 정산) — 안 된 건 원장 값 유지
  return s;
}
function bizView(d, progs, m, di) {
  var s = bizSums(progs), single = progs.length === 1;
  return { "사업코드": nz(d["사업코드"]) || nz(d["프로그램ID"]), "연도": yearOf(d), "분야": fieldLabel(d), "사업명": nz(d["정본명"]), "회계구분": nz(d["회계구분"]), "예산": nz(d["예산"]), "사업형태": nz(d["사업형태"]) || "미정", "공연수입": nz(d["공연수입"]) || "유료",
    "공동기획_기관": nz(d["공동기획_기관"]), "공모사업_기관": nz(d["공모사업_기관"]), "협력사업_기관": nz(d["협력사업_기관"]), "특이사항": special(d),
    "담당부서": nz(d["담당부서"]), "담당자": mgrName(m, d["담당자"]), "회계담당부서": nz(d["회계담당부서"]), "회계담당자": mgrName(m, d["회계담당자"]), "비고": nz(d["비고"]),
    "실지출": nz(d["전표실적"]), "수입": nz(d["정산서매출"]), "판매수수료": nz(d["판매수수료"]), "유료관객": nz(d["유료인원"]), "무료관객": nz(d["초대인원"]), "누적관객": String(num(d["유료인원"]) + num(d["초대인원"])), "문화나눔": String(s["문화나눔"]), "합계출처": s["정산수"] ? ("정산 " + s["정산수"] + "건 합") : "사업비 원장", // 사업현황 표와 같은 칸(운영_사업비 = 마스터 사업 행)
    "실지출수수료": String(num(d["전표실적"]) + num(d["판매수수료"])), // 운영자 어휘(260906): "실 지출+수수료" (구 실 사업비)
    "프로그램수": s["프로그램수"], "정산수": s["정산수"], "프로그램": progs.map(function (p) { var v = progView(p, d, m, di, single); return { "프로그램ID": v["프로그램ID"], "정본명": v["정본명"], "시작일": v["시작일"], "종료일": v["종료일"], "상태": v["상태"], "정산": nz(p["정산일"]) ? "완료" : "", "실지출": v["실지출"], "판매수수료": v["판매수수료"], "실지출수수료": v["실사업비"] || ((v["실지출"] || v["판매수수료"]) ? String(num(v["실지출"]) + num(v["판매수수료"])) : ""), "수입": v["수입"], "유료관객": v["유료관객"], "무료관객": v["무료관객"], "비용출처": v["비용출처"], "관객출처": v["관객출처"] }; }) };
}
function bizList(app, col, year) {
  var recs = allMaster(app, col), biz = [], progsBy = {}, m = managers(app, col), di = dailyIndex(app, col);
  for (var i = 0; i < recs.length; i++) { var d = rowData(recs[i]); if (isBiz(d)) { if (!year || yearOf(d) === String(year)) biz.push(d); } else { var c = nz(d["사업코드"]); if (c) (progsBy[c] = progsBy[c] || []).push(d); } }
  biz.sort(function (a, b) { return (nz(a["사업코드"]) || nz(a["프로그램ID"])) < (nz(b["사업코드"]) || nz(b["프로그램ID"])) ? -1 : 1; });
  return biz.map(function (d) { return bizView(d, progsBy[nz(d["사업코드"]) || nz(d["프로그램ID"])] || [], m, di); });
}
function findBiz(app, col, code) { var recs = allMaster(app, col); for (var i = 0; i < recs.length; i++) { var d = rowData(recs[i]); if (isBiz(d) && (nz(d["사업코드"]) === code || nz(d["프로그램ID"]) === code)) return { rec: recs[i], d: d }; } return null; }
function bizSave(app, col, body) {
  var m = managers(app, col), code = nz(body["사업코드"]), R = code ? findBiz(app, col, code) : null;
  if (code && !R) return { error: "사업 없음: " + code, status: 404 };
  var year = nz(body["연도"]) || (R ? yearOf(R.d) : ""), fl = nz(body["분야"]) || (R ? fieldLabel(R.d) : "");
  var F = FIELDS[fl]; if (!F) return { error: "분야는 기획 공연 / 기획 전시 / 예술 교육 중 하나", status: 400 };
  if (!/^\d{4}$/.test(year)) return { error: "연도(4자리) 필요", status: 400 };
  var name = nz(body["사업명"]); if (!name && !R) return { error: "사업명 필요", status: 400 };
  var acct = nz(body["회계구분"]); if (acct && acct !== "공공성" && acct !== "사업성") return { error: "회계구분은 공공성 / 사업성 중 하나", status: 400 };
  if (!acct && !R) return { error: "회계구분 필요", status: 400 };
  var shape = nz(body["사업형태"]) || (R ? nz(R.d["사업형태"]) : "") || "미정"; if (["단일", "다수", "미정"].indexOf(shape) < 0) return { error: "사업형태는 단일 / 다수 / 미정", status: 400 };
  var inc = nz(body["공연수입"]) || (R ? nz(R.d["공연수입"]) : "") || "유료"; if (inc !== "유료" && inc !== "무료") return { error: "공연수입은 유료 / 무료", status: 400 };
  var spec = [["공동기획","공동기획_기관"],["공모사업","공모사업_기관"],["협력사업","협력사업_기관"]], specVals = {};
  for (var i = 0; i < spec.length; i++) { var on = body[spec[i][0]]; var org = nz(body[spec[i][1]]); if (on === true || on === "Y" || on === "1" || on === 1) { if (!org) return { error: spec[i][0] + " 을 고르면 기관명 필수", status: 400 }; specVals[spec[i][1]] = org; } else if (on === false || on === "N" || on === "0" || on === 0) { specVals[spec[i][1]] = ""; } else if (body[spec[i][1]] !== undefined) { specVals[spec[i][1]] = org; } }
  ensureHeaders(app, col, BIZ_NEW_COLS);
  var d = R ? R.d : {};
  if (!R) { code = nextBizCode(app, col, year, F.letter); d["프로그램ID"] = code; d["사업코드"] = code; d["구분"] = "사업"; d["표시_구분"] = "사업"; d["표시_분야"] = F.f; d["연도"] = year; d["상태"] = "정상"; d["출처"] = "기획 사업 등록"; d["매칭근거"] = "기획 사업 등록"; d["횟수"] = "0"; }
  if (name) d["정본명"] = name; if (acct) d["회계구분"] = acct; if (body["예산"] !== undefined) d["예산"] = String(num(body["예산"]));
  d["사업형태"] = shape; d["공연수입"] = inc; for (var k in specVals) d[k] = specVals[k];
  if (body["담당부서"] !== undefined) d["담당부서"] = nz(body["담당부서"]); if (body["담당자"] !== undefined) d["담당자"] = mgrNo(m, body["담당자"]);
  if (body["회계담당부서"] !== undefined) d["회계담당부서"] = nz(body["회계담당부서"]); if (body["회계담당자"] !== undefined) d["회계담당자"] = mgrNo(m, body["회계담당자"]);
  if (body["비고"] !== undefined) d["비고"] = nz(body["비고"]);
  if (!R && !nz(d["회계담당자"]) && !nz(d["회계담당부서"])) { var ac = m.list.filter(function (x) { return x["회계"]; })[0]; if (ac) { d["회계담당부서"] = ac["담당부서"]; d["회계담당자"] = ac["계정NO"] || ac["담당자"]; } } // 회계 담당 기본값 = 담당자 시트 회계여부(운영자 260906: 운영지원팀 Cameron Bennett 04518)
  if (R) { R.rec.set("data", d); app.save(R.rec); }
  else { var meta = metaOf(app, col, MASTER), nri = meta.get("nextRowIndex") || 2; app.save(new Record(col("ymdata"), { sheet: MASTER, rowIndex: nri, data: d })); meta.set("rowCount", (meta.get("rowCount") || 0) + 1); meta.set("nextRowIndex", nri + 1); app.save(meta); }
  // 프로그램 상속값 갱신(구분·특이사항·담당·유료/무료)
  var progs = programsOfBiz(app, col, code); for (var p = 0; p < progs.length; p++) { var pd = progs[p].d, ch = inherit(pd, d); if (ch) { progs[p].rec.set("data", pd); app.save(progs[p].rec); } }
  touchLastmod(app, col);
  return { ok: true, "사업코드": code, view: bizView(d, progs.map(function (x) { return x.d; }), m, dailyIndex(app, col)) };
}
function programsOfBiz(app, col, code) { var recs = allMaster(app, col), out = []; for (var i = 0; i < recs.length; i++) { var d = rowData(recs[i]); if (!isBiz(d) && nz(d["사업코드"]) === code) out.push({ rec: recs[i], d: d }); } return out; }
function inherit(pd, bd) {
  var F = FIELDS[fieldLabel(bd)] || FIELDS["기획 공연"], ch = false;
  var set = function (k, v) { if (nz(pd[k]) !== nz(v)) { pd[k] = v; ch = true; } };
  set("구분", "기획"); set("표시_구분", "기획"); set("표시_분야", F.f); set("카테고리", F.cat); set("콘텐츠구분", F.ct); set("부문코드", F.part);
  set("사업특이사항", special(bd)); set("담당부서", nz(bd["담당부서"])); if (nz(bd["담당자"])) set("담당자", nz(bd["담당자"]));
  set("무료여부", nz(bd["공연수입"]) === "무료" ? "1" : "");
  return ch;
}

// ── 프로그램 ──
function progView(d, bd, m, di, single) {
  var st = status(d), F = FIELDS[bd ? fieldLabel(bd) : ""] || null, au = audience(d, di);
  // 사업에 프로그램이 하나뿐이면 사업비 원장(전표실적·판매수수료)이 곧 그 프로그램 값 — 정산 안 한 프로그램의 기본값으로 쓴다
  var useBiz = !!(single && bd && !nz(d["전표실적"]) && nz(bd["전표실적"]));
  var cost = useBiz ? num(bd["전표실적"]) : (nz(d["전표실적"]) ? num(d["전표실적"]) : null), fee = useBiz && !nz(d["판매수수료"]) ? nz(bd["판매수수료"]) : nz(d["판매수수료"]); // 실지출(전표)은 정산값·원장(단일)만 — 표시_사업비는 수수료 포함이라 실지출로 안 보여 준다(운영자 260906: 실 지출 ≠ 실 지출+수수료)
  return { "프로그램ID": nz(d["프로그램ID"]), "사업코드": nz(d["사업코드"]), "사업명": bd ? nz(bd["정본명"]) : "", "구분": bd ? fieldLabel(bd) : fieldLabel(d), "특이사항": nz(d["사업특이사항"]) || (bd ? special(bd) : ""), "담당부서": nz(d["담당부서"]), "담당자": mgrName(m, d["담당자"]), "회계담당부서": bd ? nz(bd["회계담당부서"]) : "", "회계담당자": bd ? mgrName(m, bd["회계담당자"]) : "", "공연수입": bd ? (nz(bd["공연수입"]) || "유료") : (nz(d["무료여부"]) === "1" ? "무료" : "유료"),
    "정본명": nz(d["정본명"]), "장소": nz(d["장소"]), "세부장르": nz(d["세부장르"]), "기획사": nz(d["기획사"]), "유통사": nz(d["유통사"]), "판매처": arr(d["판매처"]), "시작일": toIso(d["시작일"]), "종료일": toIso(d["종료일"]), "날짜미정": nz(d["날짜미정"]) === "Y", "기간": nz(d["기간"]), "회차수": nz(d["회차수"]), "총오픈석": nz(d["총오픈석"]), "이층오픈": nz(d["이층오픈"]), "회차시간": arr(d["회차시간"]), "판매시작일": toIso(d["판매시작일"]), "판매종료일": toIso(d["판매종료일"]), "정원": nz(d["정원"]), "강좌수": nz(d["강좌수"]), "참여작가수": nz(d["참여작가수"]),
    "상태": st, "진행상태": nz(d["진행상태"]), "실지출": cost === null ? "" : String(cost), "실사업비": nz(d["표시_사업비"]), "수입": nz(d["표시_수입"]), "판매수수료": fee, "비용출처": useBiz ? "사업비 원장(단일 프로그램)" : (nz(d["전표실적"]) ? "정산" : (nz(d["표시_사업비"]) ? "마스터(실 지출+수수료만 있음 · 정산 필요)" : "없음")), "유료관객": String(au["유료"]), "무료관객": String(au["무료"]), "누적관객": String(au["유료"] + au["무료"]), "관객출처": au["출처"], "문화나눔": nz(d["문화나눔"]), "정산일": nz(d["정산일"]), "정산자": mgrName(m, d["정산자"]), "URL": nz(d["URL"]), "홍보시작일": toIso(d["홍보시작일"]), "홍보종료일": toIso(d["홍보종료일"]), "비고": nz(d["비고"]) };
}
function programList(app, col, year, bizCode) {
  var recs = allMaster(app, col), bizBy = {}, progs = [], m = managers(app, col), di = dailyIndex(app, col), cntBy = {};
  for (var i = 0; i < recs.length; i++) { var d = rowData(recs[i]); if (!isBiz(d) && nz(d["사업코드"])) cntBy[nz(d["사업코드"])] = (cntBy[nz(d["사업코드"])] || 0) + 1; if (isBiz(d)) bizBy[nz(d["사업코드"]) || nz(d["프로그램ID"])] = d; else if (nz(d["구분"]) === "기획") { /* 구분=기획 — 2026 이전 행은 콘텐츠구분이 비어 있어 그걸로 거르면 다 빠진다(실측 2023~2025 각 36건) */ if (year && yearOf(d) !== String(year)) continue; if (bizCode && nz(d["사업코드"]) !== bizCode) continue; progs.push(d); } }
  progs.sort(function (a, b) { return nz(a["시작일"]) < nz(b["시작일"]) ? -1 : 1; });
  return progs.map(function (d) { return progView(d, bizBy[nz(d["사업코드"])], m, di, cntBy[nz(d["사업코드"])] === 1); });
}
function findProg(app, col, id) { var recs = allMaster(app, col); for (var i = 0; i < recs.length; i++) { var d = rowData(recs[i]); if (!isBiz(d) && nz(d["프로그램ID"]) === id) return { rec: recs[i], d: d }; } return null; }
function hasRefs(app, col, id) { // data.열 필터는 이 PB 에서 안 먹어(실측) 시트를 훑는다
  var sheets = [DAILY, CAL]; for (var s = 0; s < sheets.length; s++) { var rows = app.findRecordsByFilter(col("ymdata"), "sheet = '" + sheets[s] + "'", "", 50000, 0); for (var i = 0; i < rows.length; i++) { if (nz(rowData(rows[i])["프로그램ID"]) === id) return true; } } return false; }
function programSave(app, col, body) {
  var m = managers(app, col), id = nz(body["프로그램ID"]), R = id ? findProg(app, col, id) : null;
  if (id && !R) return { error: "프로그램 없음: " + id, status: 404 };
  var code = nz(body["사업코드"]) || (R ? nz(R.d["사업코드"]) : ""); if (!code) return { error: "붙일 사업(사업코드) 필요 — 없으면 기획 사업 등록에서 먼저 만든다", status: 400 };
  var B = findBiz(app, col, code); if (!B) return { error: "사업 없음: " + code, status: 404 };
  var F = FIELDS[fieldLabel(B.d)] || FIELDS["기획 공연"];
  var name = nz(body["정본명"]) || (R ? nz(R.d["정본명"]) : ""); if (!name) return { error: "프로그램명 필요", status: 400 };
  var s8 = body["시작일"] !== undefined ? toD8(body["시작일"]) : (R ? nz(R.d["시작일"]) : ""), e8 = body["종료일"] !== undefined ? toD8(body["종료일"]) : (R ? nz(R.d["종료일"]) : "");
  var tbd = body["날짜미정"] === true || body["날짜미정"] === "Y";
  if (!s8) return { error: "시작일 필요(미정이면 그 달 1일 + 날짜미정 체크)", status: 400 };
  if (!e8 || e8 < s8) e8 = s8;
  var place = nz(body["장소"]); if (place === "기타") place = nz(body["장소기타"]) || "기타"; if (place && PLACES.indexOf(place) < 0 && nz(body["장소"]) !== "기타" && !R) return { error: "장소는 목록에서 고르거나 기타(직접 입력)", status: 400 };
  var genre = nz(body["세부장르"]); if (genre && F.f === "공연" && GENRES.indexOf(genre) < 0) return { error: "장르는 " + GENRES.join("/") + " 중 하나", status: 400 };
  ensureHeaders(app, col, PROG_NEW_COLS);
  var d = R ? R.d : {}, isNew = !R;
  if (isNew) { id = nextProgramId(app, col, s8); d["프로그램ID"] = id; d["상태"] = "정상"; d["출처"] = "프로그램 등록"; d["매칭근거"] = "프로그램 등록"; d["NO"] = ""; }
  else if (nz(R.d["시작일"]) !== s8 && id.slice(0, 6) !== s8.slice(2, 8) && !hasRefs(app, col, id)) { var nid = nextProgramId(app, col, s8); d["프로그램ID"] = nid; id = nid; }
  d["사업코드"] = code; d["정본명"] = name; d["시작일"] = s8; d["종료일"] = e8; d["날짜미정"] = tbd ? "Y" : ""; d["연도"] = s8.slice(0, 4); d["기간"] = daysBetween(s8, e8);
  if (place || isNew) d["장소"] = place; if (body["세부장르"] !== undefined) d["세부장르"] = genre;
  if (body["기획사"] !== undefined) d["기획사"] = nz(body["기획사"]); if (body["유통사"] !== undefined) d["유통사"] = nz(body["유통사"]);
  if (body["판매처"] !== undefined) d["판매처"] = arr(body["판매처"]).filter(function (x) { return SALES_CH.indexOf(x) >= 0; }).join(", ");
  if (body["판매시작일"] !== undefined) d["판매시작일"] = toD8(body["판매시작일"]); if (body["판매종료일"] !== undefined) d["판매종료일"] = toD8(body["판매종료일"]);
  if (F.f === "공연") {
    if (body["회차수"] !== undefined) { var rc = parseInt(nz(body["회차수"]), 10); d["회차수"] = (rc > 0 && rc < 1000) ? String(rc) : ""; d["총회차"] = d["회차수"]; }
    if (body["총오픈석"] !== undefined) d["총오픈석"] = String(num(body["총오픈석"]) || "");
    if (body["이층오픈"] !== undefined) d["이층오픈"] = (body["이층오픈"] === true || body["이층오픈"] === "Y") ? "Y" : "N";
    if (body["회차시간"] !== undefined) { var ts = arr(body["회차시간"]).map(nz).filter(Boolean); d["회차시간"] = ts.length ? JSON.stringify(ts) : ""; }
  } else if (F.f === "교육") { if (body["정원"] !== undefined) d["정원"] = String(num(body["정원"]) || ""); if (body["강좌수"] !== undefined) d["강좌수"] = String(num(body["강좌수"]) || ""); }
  else if (F.f === "전시") { if (body["참여작가수"] !== undefined) d["참여작가수"] = String(num(body["참여작가수"]) || ""); }
  if (body["진행상태"] !== undefined) { var ps = nz(body["진행상태"]); if (ps && ps !== "취소" && ps !== "연기") return { error: "진행상태는 취소 / 연기 만 직접 넣는다(나머지는 날짜로 자동)", status: 400 }; d["진행상태"] = ps; if (ps === "취소") d["상태"] = "취소"; else if (nz(d["상태"]) === "취소") d["상태"] = "정상"; }
  if (body["비고"] !== undefined) d["비고"] = nz(body["비고"]);
  inherit(d, B.d);
  if (R) { R.rec.set("data", d); app.save(R.rec); }
  else { var meta = metaOf(app, col, MASTER), nri = meta.get("nextRowIndex") || 2; app.save(new Record(col("ymdata"), { sheet: MASTER, rowIndex: nri, data: d })); meta.set("rowCount", (meta.get("rowCount") || 0) + 1); meta.set("nextRowIndex", nri + 1); app.save(meta); }
  recomputeBiz(app, col, code); if (R && nz(R.d["사업코드"]) && nz(R.d["사업코드"]) !== code) recomputeBiz(app, col, nz(R.d["사업코드"]));
  touchLastmod(app, col);
  return { ok: true, "프로그램ID": id, view: progView(d, B.d, m, dailyIndex(app, col), programsOfBiz(app, col, code).length === 1) };
}

// ── 정산 ──
function recomputeBiz(app, col, code) {
  var B = findBiz(app, col, code); if (!B) return null;
  var progs = programsOfBiz(app, col, code).map(function (x) { return x.d; }), s = bizSums(progs), ch = false;
  if (!s["정산수"]) return s; // 정산된 프로그램이 하나도 없으면 사업 행(원장 값)을 건드리지 않는다 — 옛 연도 사업 보호
  for (var k = 0; k < SUM_MAP.length; k++) { var v = String(s[SUM_MAP[k][0]]); if (nz(B.d[SUM_MAP[k][0]]) !== v) { B.d[SUM_MAP[k][0]] = v; ch = true; } }
  if (ch) { B.rec.set("data", B.d); app.save(B.rec); }
  return s;
}
function settle(app, col, body, who) {
  var id = nz(body["프로그램ID"]), R = findProg(app, col, id); if (!R) return { error: "프로그램 없음: " + id, status: 404 };
  ensureHeaders(app, col, PROG_NEW_COLS);
  var d = R.d, map = [["실지출","전표실적"],["수입","표시_수입"],["판매수수료","판매수수료"],["유료관객","발권유료"],["무료관객","발권초대"],["문화나눔","문화나눔"],["오픈석","총오픈석"]], any = false;
  for (var i = 0; i < map.length; i++) { if (body[map[i][0]] !== undefined) { d[map[i][1]] = String(num(body[map[i][0]])); any = true; } }
  if (!any) return { error: "정산 값 없음", status: 400 };
  d["표시_사업비"] = String(num(d["전표실적"]) + num(d["판매수수료"])); // 표시_사업비 = 실 사업비(A) = 전표 집행 + 판매 수수료(원장 정의)
  var cost = num(d["표시_사업비"]), rev = num(d["표시_수입"]); d["표시_수익률"] = cost > 0 ? String(Math.round(rev / cost * 1000) / 10) : "";
  d["재무_사업비"] = d["표시_사업비"]; d["재무_수입"] = d["표시_수입"];
  d["정산일"] = todayD8(); d["정산자"] = nz(who) || nz(d["정산자"]);
  R.rec.set("data", d); app.save(R.rec);
  var s = recomputeBiz(app, col, nz(d["사업코드"]));
  touchLastmod(app, col);
  return { ok: true, "프로그램ID": id, "사업코드": nz(d["사업코드"]), view: progView(d, (findBiz(app, col, nz(d["사업코드"])) || { d: null }).d, managers(app, col), dailyIndex(app, col)), "사업합계": s };
}


// ── 라우트 처리(핸들러는 격리 스코프라 파일 스코프 함수를 못 봄 → 전부 여기서) ──
function remove(app, col, body) { // 삭제: 프로그램은 일일실적·캘린더 참조가 없을 때만, 사업은 붙은 프로그램이 없을 때만. 이력은 ym-changelog 훅이 기록
  var pid = nz(body["프로그램ID"]), bc = nz(body["사업코드"]);
  var meta = metaOf(app, col, MASTER); if (!meta) return { error: "마스터 목록 없음", status: 500 };
  if (pid) { var P = findProg(app, col, pid); if (!P) return { error: "프로그램 없음: " + pid, status: 404 }; if (hasRefs(app, col, pid)) return { error: "일일실적·캘린더 기록이 있어 삭제할 수 없습니다: " + pid }; var code = nz(P.d["사업코드"]); app.delete(P.rec); meta.set("rowCount", Math.max(0, (meta.get("rowCount") || 0) - 1)); app.save(meta); if (code) recomputeBiz(app, col, code); touchLastmod(app, col); return { ok: true, deleted: pid, "사업코드": code }; }
  if (bc) { var B = findBiz(app, col, bc); if (!B) return { error: "사업 없음: " + bc, status: 404 }; var ps = programsOfBiz(app, col, bc); if (ps.length) return { error: "붙은 프로그램이 " + ps.length + "개 있어 삭제할 수 없습니다: " + bc }; app.delete(B.rec); meta.set("rowCount", Math.max(0, (meta.get("rowCount") || 0) - 1)); app.save(meta); touchLastmod(app, col); return { ok: true, deleted: bc }; }
  return { error: "프로그램ID 또는 사업코드가 필요합니다" };
}
function handle(e, app, hooks, name) {
  var step = "env";
  try {
    var env = require(hooks + "/ym-env-lib.js"), ev = env.envOf(e), col = function (n) { return env.col(app, n, ev); };
    if (ev === "dev") return require(hooks + "/ym-plan-dev-lib.js").handle(e, app, hooks, name); // [codex-integrity-260906]
    var info = e.requestInfo() || {}, q = info.query || {}, body = info.body || {}; if (typeof body === "string") { try { body = JSON.parse(body); } catch (e0) { body = {}; } }
    var who = ""; try { who = String(e.request.header.get("X-Ym-User") || ""); try { who = decodeURIComponent(who); } catch (e1) {} } catch (e2) {}
    step = name; var out;
    if (name === "meta") out = { ok: true, env: ev || "prod", meta: meta(app, col) };
    else if (name === "biz") { var rows = bizList(app, col, String(q.year || "").trim()); out = { ok: true, env: ev || "prod", count: rows.length, rows: rows }; }
    else if (name === "bizSave") out = bizSave(app, col, body);
    else if (name === "programs") { var prs = programList(app, col, String(q.year || "").trim(), String(q.biz || "").trim()); out = { ok: true, env: ev || "prod", count: prs.length, rows: prs }; }
    else if (name === "programSave") out = programSave(app, col, body);
    else if (name === "settle") out = settle(app, col, body, who);
    else if (name === "remove") out = remove(app, col, body);
    else out = { error: "unknown: " + name, status: 404 };
    if (out && out.error) return e.json(out.status || 400, { ok: false, error: out.error });
    return e.json(200, out);
  } catch (err) { return e.json(500, { ok: false, step: step, error: String(err && err.message ? err.message : err) }); }
}

function meta(app, col) { var m = managers(app, col); return { "장소": PLACES, "장르": GENRES, "분야": Object.keys(FIELDS), "판매처": SALES_CH, "부서": m.depts, "담당자": m.list, "회계담당": m.list.filter(function (x) { return x["회계"]; }), "오늘": toIso(todayD8()) }; }
module.exports = { handle: handle, remove: remove, PLACES: PLACES, GENRES: GENRES, FIELDS: FIELDS, meta: meta, bizList: bizList, bizSave: bizSave, programList: programList, programSave: programSave, settle: settle, recomputeBiz: recomputeBiz, status: status, nextBizCode: nextBizCode, nextProgramId: nextProgramId };
