// 052 — 병합행 분리 2건 + 행 신설 1건(260905, 운영자 지시: "장소 대·소극장 다르면 프로그램 2개로 분리, 관객은 각각 대장에서").
//   1) 121030_01: 연극페스티벌 1회(소극장 10/30~31, 발권초대 467) + 합창페스티벌 1회(대극장 11/2~3, 발권초대 590)가 한 행 → 121030_01은 연극제로 남기고 121102_01(합창제, 연차보고서 이름) 신설. 일일실적 11/2·11/3 행은 121102_01로 옮김.
//   2) 131031_02: 연극페스티벌 2회(소극장 10/30, 298) + 합창페스티벌 2회(대극장 10/31, 888) → 131031_02는 합창제(10/31)로 고치고 131030_01(연극제) 신설. 일일실적 10/30 행은 131030_01로 옮기고, 합창제 10/31 누계(888) 행은 없어서 새로 만듦.
//   3) 120510_02 배병우展 <대양을 향하여> 신설: 2012 연차보고서 기획전시, 05.10~06.30, 7층 전시실(개관 기념 전시, 운영자 확인).
//   관객 수는 세부운영관리대장 "발권" 유료/초대 열(DB 발권유료/발권초대와 같은 기준). 옛 값은 _ym_col_archive(이관=052)에 보관.
module.exports = {
  id: "052",
  title: "병합행 분리(연극·합창 페스티벌 2012·2013) + 배병우展 신설",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var MASTER = "ops_프로그램마스터", DAILY = "ops_일일실적", ARCH = "_ym_col_archive";
    var rows = ctx.sheetRows(MASTER), byId = {};
    for (var i = 0; i < rows.length; i++) { var d0 = ctx.parseJson(rows[i].publicExport().data, {}); var id0 = nz(d0["프로그램ID"]); if (id0) byId[id0] = { rec: rows[i], d: d0 }; }
    ["121030_01", "131031_02"].forEach(function (id) { if (!byId[id]) throw new Error("행 없음: " + id); });
    ["121102_01", "131030_01", "120510_02"].forEach(function (id) { if (byId[id]) throw new Error("이미 있음: " + id + " — 이미 적용됨?"); });
    var drows = ctx.sheetRows(DAILY), dByKey = {}, dKeys = {};
    for (var j = 0; j < drows.length; j++) { var dd = ctx.parseJson(drows[j].publicExport().data, {}); var k0 = nz(dd["실적ID"]); dByKey[k0] = { rec: drows[j], d: dd }; dKeys[k0] = 1; }
    var am = ctx.meta(ARCH), mm = ctx.meta(MASTER), dm = ctx.meta(DAILY), dc = ctx.col("ymdata");
    var ari = am.get("nextRowIndex") || 2, ari0 = ari;
    var archive = function (kind, id, d, note) { ctx.app.save(new Record(dc, { sheet: ARCH, rowIndex: ari, data: { "프로그램ID": id, "구분": kind, "이관": "052", "기준명": note, "원본": JSON.stringify(d) } })); ari++; };
    var mri = mm.get("nextRowIndex") || 2, mri0 = mri, dri = dm.get("nextRowIndex") || 2, dri0 = dri, log = [];
    var addMaster = function (d) { ctx.app.save(new Record(dc, { sheet: MASTER, rowIndex: mri, data: d })); mri++; log.push("신설 " + d["프로그램ID"] + " " + d["정본명"]); };
    var addDaily = function (d) { if (dKeys[d["실적ID"]]) throw new Error("실적ID 중복: " + d["실적ID"]); ctx.app.save(new Record(dc, { sheet: DAILY, rowIndex: dri, data: d })); dri++; dKeys[d["실적ID"]] = 1; log.push("일일실적 신설 " + d["실적ID"]); };
    var moveDaily = function (oldKey, newPid) { var D = dByKey[oldKey]; if (!D) { log.push("일일실적 없음(건너뜀) " + oldKey); return; } var dx = D.d; var newKey = oldKey.replace(/^[^_]+_[^_]+/, newPid); if (dKeys[newKey]) throw new Error("실적ID 중복: " + newKey); archive("일일실적", oldKey, dx, "→ " + newPid); dx["프로그램ID"] = newPid; dx["실적ID"] = newKey; D.rec.set("data", dx); ctx.app.save(D.rec); delete dKeys[oldKey]; dKeys[newKey] = 1; log.push("일일실적 이동 " + oldKey + " → " + newKey); };
    var setMany = function (R, upd) { var ks = Object.keys(upd); for (var q = 0; q < ks.length; q++) { if (upd[ks[q]] === null) delete R.d[ks[q]]; else R.d[ks[q]] = upd[ks[q]]; } R.rec.set("data", R.d); ctx.app.save(R.rec); };

    // 1) 2012
    var A = byId["121030_01"]; archive(nz(A.d["구분"]), "121030_01", A.d, "분리 전(연극+합창 1회)");
    var B = JSON.parse(JSON.stringify(A.d)); // 합창제 1회 밑그림
    setMany(A, { "정본명": "제1회 여수학생연극페스티벌", "장소": "소극장", "시작일": "20121030", "종료일": "20121031", "기간": "2", "기본좌석": "302", "기준석": "302", "총오픈석": "604", "회차수": "2", "총회차": "2", "발권유료": "0", "발권초대": "467", "세부장르": "연극", "판매시작일": "20121025", "판매종료일": "20121031", "티켓오픈일": "20121030", "별칭": JSON.stringify(["여수 초중학생 연극페스티벌", "여수학생연극페스티벌_제1회"]), "병합_ID": null, "대장_관람객": null, "매칭근거": "회차대장·이관052 분리", "비고": "재무_수입 1,202,520원은 분리 전 합산값(연극+합창) 그대로 둠" });
    var drop = ["_rowIndex","구ID","병합_ID","대장_관람객","재무_수입","표시_수입","비고"]; for (var z = 0; z < drop.length; z++) delete B[drop[z]];
    B["프로그램ID"] = "121102_01"; B["정본명"] = "제 1회 여수 학생 학부모 학창 페스티벌 <내 노래에 날개를 달다>"; B["장소"] = "대극장"; B["시작일"] = "20121102"; B["종료일"] = "20121103"; B["기간"] = "2"; B["기본좌석"] = "948"; B["기준석"] = "948"; B["총오픈석"] = "1896"; B["회차수"] = "2"; B["총회차"] = "2"; B["발권유료"] = "0"; B["발권초대"] = "590"; B["세부장르"] = "클래식"; B["판매시작일"] = "20121102"; B["판매종료일"] = "20121103"; B["티켓오픈일"] = "20121102"; B["별칭"] = JSON.stringify(["여수 학생.학부모 합창페스티벌\"내노래에 날개를 달다\"_제1회"]); B["출처"] = "연차보고서 개최현황"; B["매칭근거"] = "이관052 분리(121030_01에서)"; B["데이터_원천수"] = "2";
    addMaster(B);
    moveDaily("121030_01_20121103_공연", "121102_01"); moveDaily("121030_01_20121102_회차발권", "121102_01"); moveDaily("121030_01_20121103_회차발권", "121102_01");

    // 2) 2013
    var C = byId["131031_02"]; archive(nz(C.d["구분"]), "131031_02", C.d, "분리 전(연극+합창 2회)");
    var D2 = JSON.parse(JSON.stringify(C.d));
    setMany(C, { "시작일": "20131031", "종료일": "20131031", "기간": "1", "기본좌석": "1021", "기준석": "1021", "총오픈석": "1021", "회차수": "1", "총회차": "1", "발권유료": "0", "발권초대": "888", "세부장르": "클래식", "병합_ID": null, "대장_관람객": null, "매칭근거": "연차보고서·이관052 분리", "비고": "재무_수입 1,353,600원은 분리 전 합산값(연극+합창) 그대로 둠" });
    for (var z2 = 0; z2 < drop.length; z2++) delete D2[drop[z2]];
    D2["프로그램ID"] = "131030_01"; D2["정본명"] = "제2회 여수학생연극페스티벌"; D2["장소"] = "소극장"; D2["시작일"] = "20131030"; D2["종료일"] = "20131030"; D2["기간"] = "1"; D2["기본좌석"] = "302"; D2["기준석"] = "302"; D2["총오픈석"] = "302"; D2["회차수"] = "1"; D2["총회차"] = "1"; D2["발권유료"] = "0"; D2["발권초대"] = "298"; D2["세부장르"] = "연극"; D2["판매시작일"] = "20131004"; D2["판매종료일"] = "20131030"; D2["티켓오픈일"] = "20131004"; D2["별칭"] = JSON.stringify(["여수학생연극페스티벌_제2회"]); D2["출처"] = "공연장운영관리대장(세부운영관리대장)"; D2["매칭근거"] = "이관052 분리(131031_02에서)"; D2["데이터_원천수"] = "1";
    addMaster(D2);
    moveDaily("131031_02_20131030_공연", "131030_01"); moveDaily("131031_02_20131030_회차발권", "131030_01");
    addDaily({ "구분": "공연", "기준일자": "20131031", "누계무료": "888", "누계유료": "0", "누계총인원": "888", "실적ID": "131031_02_20131031_공연", "예측제외": "Y", "점유율": "0", "프로그램ID": "131031_02" });

    // 3) 배병우展
    addMaster({ "프로그램ID": "120510_02", "정본명": "배병우展 <대양을 향하여>", "구분": "기획", "표시_구분": "기획", "표시_분야": "전시", "카테고리": "기획전시", "부문코드": "2", "장소": "7층 전시실", "시작일": "20120510", "종료일": "20120630", "기간": "52", "연도": "2012", "상태": "정상", "매칭": "미매칭", "매칭근거": "이관052 신설", "데이터_원천수": "1", "출처": "연차보고서 개최현황(2012)", "별칭": JSON.stringify(["배병우展 대양을 향하여"]), "비고": "개관 기념 전시(운영자 확인 260905). 관객·사업비 미확인" });

    am.set("rowCount", (am.get("rowCount") || 0) + (ari - ari0)); am.set("nextRowIndex", ari); ctx.app.save(am);
    mm.set("rowCount", (mm.get("rowCount") || 0) + (mri - mri0)); mm.set("nextRowIndex", mri); ctx.app.save(mm);
    dm.set("rowCount", (dm.get("rowCount") || 0) + (dri - dri0)); dm.set("nextRowIndex", dri); ctx.app.save(dm);
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    return { masterAdded: mri - mri0, dailyAdded: dri - dri0, archived: ari - ari0, log: log };
  }
};
