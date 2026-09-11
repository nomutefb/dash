// 020 — 표마다 키 한 열. [260905 통합⑭ · 운영자 "각 시트 키를 하나씩으로"]
//   일일실적: 기준일자 YYYY-MM-DD → YYYYMMDD(앱은 숫자만 남겨 읽으므로 무영향), 실적ID = 프로그램ID_YYYYMMDD_구분(같은 키가 여럿이면 -2, -3 … 회차발권은 하루 2회차가 흔함). 프로그램ID 없는 행은 NOID.
//   코드표: 코드ID = 구분 + 2자리 순번(rowIndex 순).
//   새 행은 훅(postOps·opsRow)과 창구(ym-views-lib dailyStamp/codeStamp)가 채운다. 값 유실 0(열 추가·형식 변환만).
module.exports = {
  id: "020",
  title: "일일실적 실적ID + 기준일자 YYYYMMDD · 코드표 코드ID",
  up: function (ctx) {
    var nz = function (v) { return String(v === undefined || v === null ? "" : v).trim(); };
    var out = {};
    // 일일실적
    var DT = "ops_일일실적", dm = ctx.meta(DT); if (!dm) throw new Error(DT + " 없음");
    var dh = ctx.parseJson(dm.get("headers"), []); if (dh.indexOf("실적ID") >= 0) throw new Error(DT + " 에 실적ID 이미 있음");
    dh.unshift("실적ID"); dm.set("headers", dh); ctx.app.save(dm);
    var rows = ctx.sheetRows(DT), ids = {}, dateFixed = 0, badDate = [], dupSuffix = 0, noId = 0;
    for (var i = 0; i < rows.length; i++) {
      var d = ctx.parseJson(rows[i].publicExport().data, {});
      var raw = nz(d["기준일자"]), d8 = raw.replace(/[^0-9]/g, "");
      if (/^\d{8}$/.test(d8)) { if (d8 !== raw) { d["기준일자"] = d8; dateFixed++; } } else if (raw) badDate.push(rows[i].get("rowIndex") + ":" + raw);
      var pid = nz(d["프로그램ID"]); if (!pid) noId++;
      var base = (pid || "NOID") + "_" + nz(d["기준일자"]) + "_" + nz(d["구분"]), id = base, n = 2;
      while (ids[id]) { id = base + "-" + n; n++; }
      if (id !== base) dupSuffix++;
      ids[id] = 1; d["실적ID"] = id;
      rows[i].set("data", d); ctx.app.save(rows[i]);
    }
    out.daily = { rows: rows.length, dateFixed: dateFixed, badDate: badDate, dupSuffix: dupSuffix, noId: noId };
    // 코드표
    var CT = "ops_코드표", cm = ctx.meta(CT); if (!cm) throw new Error(CT + " 없음");
    var ch = ctx.parseJson(cm.get("headers"), []); if (ch.indexOf("코드ID") >= 0) throw new Error(CT + " 에 코드ID 이미 있음");
    ch.unshift("코드ID"); cm.set("headers", ch); ctx.app.save(cm);
    var crows = ctx.sheetRows(CT), seq = {}, coded = 0;
    for (var c = 0; c < crows.length; c++) {
      var cd = ctx.parseJson(crows[c].publicExport().data, {}), part = nz(cd["구분"]);
      seq[part] = (seq[part] || 0) + 1; cd["코드ID"] = part + ("0" + seq[part]).slice(-2);
      crows[c].set("data", cd); ctx.app.save(crows[c]); coded++;
    }
    out.code = { rows: coded, perPart: seq };
    var lm = ctx.meta("_lastmod"); if (lm) { lm.set("source", new Date().toISOString()); ctx.app.save(lm); }
    ctx.log("일일실적 " + rows.length + "행 실적ID(겹침 접미 " + dupSuffix + ", 날짜 변환 " + dateFixed + ", 못 읽음 " + badDate.length + ") · 코드표 " + coded + "행 코드ID");
    return out;
  }
};
