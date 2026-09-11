// 021 — 일일실적.프로그램ID 가 프로그램마스터를 반드시 가리키게. [260905 통합⑮ · 운영자 "일일실적 프로그램ID가 마스터랑 참조되게" → 선택 A "없는 건 마스터에 행 생성"]
//   마스터에 없는 프로그램ID(2012~2025 회차발권 옛 장부 대부분 + 2025 공연 3건)마다 마스터 행을 하나 만든다(구분: 사업코드 있으면 기획, 아니면 사업구분대로 기획/대관).
//   프로그램ID 가 빈 행은 기준일자(YYMMDD)_NN 으로 새 ID 를 만들어 일일실적 행에도 써 넣고 실적ID 를 다시 만든다.
//   이름으로 짐작해 다른 마스터 행에 붙이는 일은 하지 않는다(운영자가 A 선택). 앞으로의 쓰기는 훅 postOps·opsRow·창구가 마스터에 없는 ID 를 409 로 거부한다.
module.exports = {
  id: "021",
  title: "일일실적 프로그램ID → 프로그램마스터 참조(없는 ID 는 마스터 행 생성)",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var num = function (v) { var n = parseFloat(String(v === undefined || v === null ? "" : v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; };
    var MASTER = "ops_프로그램마스터", DAILY = "ops_일일실적";
    var mm = ctx.meta(MASTER); if (!mm) throw new Error(MASTER + " 없음");
    var dm = ctx.meta(DAILY); if (!dm) throw new Error(DAILY + " 없음");
    var hs = ctx.parseJson(mm.get("headers"), []);
    var need = ["프로그램ID","구분","사업코드","정본명","기준명","연도","시작일","종료일","기간","회차_첫공연일","회차_끝공연일","회차_건수","회차수","부문코드","카테고리","표시_구분","표시_분야","세부장르","기본좌석","판매구분","상태","출처","매칭근거","매칭","데이터_보유원천","데이터_원천수","발권유료","발권초대"];
    for (var q = 0; q < need.length; q++) if (hs.indexOf(need[q]) < 0) throw new Error("마스터에 없는 열: " + need[q]);
    var mrows = ctx.sheetRows(MASTER), ids = {};
    for (var m = 0; m < mrows.length; m++) { var id0 = nz(ctx.parseJson(mrows[m].publicExport().data, {})["프로그램ID"]); if (id0) ids[id0] = 1; }
    var drows = ctx.sheetRows(DAILY), dids = {}, sids = {}, parsed = [];
    for (var i = 0; i < drows.length; i++) { var d0 = ctx.parseJson(drows[i].publicExport().data, {}); parsed.push(d0); var pid = nz(d0["프로그램ID"]); if (pid) dids[pid] = 1; var sid = nz(d0["실적ID"]); if (sid) sids[sid] = 1; }
    // 1) 프로그램ID 빈 행 → 새 ID
    var blank = 0;
    for (var b = 0; b < parsed.length; b++) {
      var db = parsed[b]; if (nz(db["프로그램ID"])) continue;
      var d8 = nz(db["기준일자"]).replace(/[^0-9]/g, ""); if (!/^\d{8}$/.test(d8)) throw new Error("프로그램ID 도 기준일자도 없는 행 rowIndex " + drows[b].get("rowIndex"));
      var base = d8.slice(2), n = 1, nid = base + "_01";
      while (ids[nid] || dids[nid]) { n++; nid = base + "_" + (n < 10 ? "0" + n : String(n)); }
      dids[nid] = 1; db["프로그램ID"] = nid;
      var rb = nid + "_" + d8 + "_" + nz(db["구분"]), rid = rb, k2 = 2; while (sids[rid]) { rid = rb + "-" + k2; k2++; }
      sids[rid] = 1; db["실적ID"] = rid;
      drows[b].set("data", db); ctx.app.save(drows[b]); blank++;
    }
    // 2) 마스터에 없는 ID 묶기
    var g = {}, order = [];
    for (var j = 0; j < parsed.length; j++) {
      var d = parsed[j], id = nz(d["프로그램ID"]); if (ids[id]) continue;
      if (!g[id]) { g[id] = { rows: [] }; order.push(id); }
      g[id].rows.push(d);
    }
    var dc = ctx.col("ymdata"), nri = mm.get("nextRowIndex") || 2, made = 0, byPart = {"기획":0,"대관":0}, sample = [];
    for (var p = 0; p < order.length; p++) {
      var pid2 = order[p], rows = g[pid2].rows, o = {};
      for (var h = 0; h < hs.length; h++) o[hs[h]] = "";
      var name = "", code = "", sg = "", gu1 = "", jr = "", seat = "", cnt = 0, min = "", max = "", fmin = "", fmax = "", paid = 0, invite = 0;
      for (var r = 0; r < rows.length; r++) {
        var x = rows[r];
        if (!name && nz(x["명칭"])) name = nz(x["명칭"]).replace(/\s*\n\s*/g, " ");
        if (!code && nz(x["사업코드"])) code = nz(x["사업코드"]);
        if (!sg && nz(x["공연구분"])) sg = nz(x["공연구분"]);
        if (!gu1 && nz(x["사업구분"])) gu1 = nz(x["사업구분"]);
        if (!jr && nz(x["장르1"])) jr = nz(x["장르1"]);
        if (!seat && nz(x["기본좌석"])) seat = nz(x["기본좌석"]);
        var dt = nz(x["기준일자"]).replace(/[^0-9]/g, "");
        if (/^\d{8}$/.test(dt)) { if (!min || dt < min) min = dt; if (!max || dt > max) max = dt; }
        if (nz(x["구분"]) === "회차발권") { cnt++; paid += num(x["발권유료"]); invite += num(x["발권초대"]); if (/^\d{8}$/.test(dt)) { if (!fmin || dt < fmin) fmin = dt; if (!fmax || dt > fmax) fmax = dt; } }
      }
      if (!min) throw new Error("기준일자 없는 묶음: " + pid2);
      var part = code ? "기획" : (sg === "기획" ? "기획" : "대관");
      var s = fmin || min, e = fmax || max;
      var days = Math.round((Date.UTC(+e.slice(0, 4), +e.slice(4, 6) - 1, +e.slice(6, 8)) - Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8))) / 86400000) + 1;
      var cancel = (gu1 === "취소" || sg === "취소");
      o["프로그램ID"] = pid2; o["구분"] = part; o["사업코드"] = code; o["정본명"] = name; o["기준명"] = name;
      o["연도"] = s.slice(0, 4); o["시작일"] = s; o["종료일"] = e; o["기간"] = String(days);
      o["회차_첫공연일"] = fmin; o["회차_끝공연일"] = fmax; o["회차_건수"] = cnt ? String(cnt) : ""; o["회차수"] = cnt ? String(cnt) : "";
      o["부문코드"] = "1"; o["카테고리"] = cancel ? "취소" : (gu1 === "기타" ? "기타" : (part === "기획" ? "기획공연" : "대관공연"));
      o["표시_구분"] = part; o["표시_분야"] = gu1 === "기타" ? "기타" : "공연"; o["세부장르"] = jr; o["기본좌석"] = seat;
      o["판매구분"] = gu1 === "공연" ? "공연" : ""; o["상태"] = cancel ? "취소" : "정상";
      o["출처"] = "일일실적(회차발권 장부)"; o["매칭근거"] = "일일실적 참조 보정"; o["매칭"] = "대장단독"; o["데이터_보유원천"] = "회차"; o["데이터_원천수"] = "1";
      o["발권유료"] = cnt ? String(paid) : ""; o["발권초대"] = cnt ? String(invite) : "";
      ctx.app.save(new Record(dc, { sheet: MASTER, rowIndex: nri, data: o })); nri++; made++; byPart[part]++; ids[pid2] = 1;
      if (sample.length < 5) sample.push(pid2 + " " + part + " " + name);
    }
    mm.set("rowCount", (mm.get("rowCount") || 0) + made); mm.set("nextRowIndex", nri); ctx.app.save(mm);
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    ctx.log("빈 ID 보정 " + blank + " · 마스터 행 생성 " + made + " " + JSON.stringify(byPart));
    return { blankFixed: blank, created: made, byPart: byPart, sample: sample, masterRows: mm.get("rowCount") };
  }
};
