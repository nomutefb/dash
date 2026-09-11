// 062 — [260907 주소정제] ops_회원 30,950명의 주소를 새 정제기(api/ym-addr-lib.js + ym-addr-map.js)로 다시 나눈다.
//   왜: 종전 normalize()는 공백으로 잘라 첫 토큰=시도·둘째=시군구·셋째=읍면동으로 넣어서 '[우편번호] 주소' 꼴·시도 생략·붙여쓰기·옛 6자리 우편번호가 다 틀어졌다.
//   무엇을: 주소1(시도)·주소2(시군구)·주소3(읍면동, 일반구 포함)·주소4(나머지)·우편번호·주소검토 를 다시 채우고 주소정제판='260907' 표시.
//   안 건드리는 것: 주소원본(원본 그대로)·이름·연락처 등 나머지 필드. 빈 값은 저장하지 않는다(ym-member-sync packed 규칙과 같음).
//   저장: 행마다 SQL UPDATE(레코드 훅을 안 타므로 /api/ops 캐시 판(ym_ver_<env>)과 _member_summary·_lastmod 를 직접 갱신).
module.exports = {
  id: "062", title: "회원 주소 재정제(시도·시군구·읍면동·우편번호)",
  up: function (ctx) {
    var H = (typeof __hooks !== 'undefined') ? __hooks : '/pb_hooks';
    var A = require(H + '/ym-addr-lib.js'), M = require(H + '/ym-addr-map.js');
    var VER = '260907b', /* b = 불분명 묶음 + 우편번호 자동 채움 */ KEYS = ['주소1', '주소2', '주소3', '주소4', '우편번호', '주소검토'];
    var rows = ctx.sheetRows('ops_회원'), table = ctx.col('ymdata').name, stamp = new Date().toISOString().replace('T', ' ');
    var n = 0, changed = 0, flagged = 0, noSido = 0, noSgg = 0, zip = 0, i, k;
    for (i = 0; i < rows.length; i++) {
      var rec = rows[i], d = ctx.parseJson(rec.publicExport().data, {});
      if (!d || typeof d !== 'object') continue;
      n++;
      var raw = String(d['주소원본'] || d['주소'] || ''), a = A.parse(raw, M), diff = false;
      for (k = 0; k < KEYS.length; k++) {
        var key = KEYS[k], nv = String(a[key] || ''), ov = String(d[key] || '');
        if (nv !== ov) diff = true;
        if (nv) d[key] = nv; else delete d[key];
      }
      if (String(d['주소정제판'] || '') !== VER) { d['주소정제판'] = VER; diff = true; }
      if (a['주소검토']) flagged++;
      if (!a['주소1']) noSido++;
      if (!a['주소2']) noSgg++;
      if (a['우편번호']) zip++;
      if (!diff) continue;
      ctx.app.db().newQuery('UPDATE "' + table + '" SET "data"={:d}, "updated"={:s} WHERE "id"={:id}').bind({ d: JSON.stringify(d), s: stamp, id: rec.id }).execute();
      changed++;
    }
    // 시트 머리(headers)에 주소정제판 추가
    var m = ctx.meta('ops_회원');
    if (m) { var headers = ctx.parseJson(m.get('headers'), []); if (!Array.isArray(headers)) headers = []; if (headers.indexOf('주소정제판') < 0) { headers.push('주소정제판'); m.set('headers', headers); ctx.app.save(m); } }
    // 회원 요약 캐시·마지막 수정 시각·/api/ops 응답 캐시 판 갱신(레코드 훅을 안 탔으므로 직접)
    var sm = ctx.meta('_member_summary'); if (sm) { sm.set('headers', {}); ctx.app.save(sm); }
    var lm = ctx.meta('_lastmod'); if (lm) { lm.set('source', new Date().toISOString()); ctx.app.save(lm); }
    try { $app.store().set('ym_ver_' + (ctx.env || ''), Date.now() + '-addr062'); } catch (e) { ctx.log('cache bump failed: ' + e); }
    return { rows: n, changed: changed, flagged: flagged, noSido: noSido, noSgg: noSgg, zip: zip, ver: VER };
  }
};
