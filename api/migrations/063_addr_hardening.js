module.exports = {
  id: "063", title: "회원 주소 재정제(시도·시군구·읍면동·우편번호)",
  up: function (ctx) {
    if(ctx.env!=='dev'||ctx.col('ymdata').name!=='ymdata_dev'||ctx.col('ymmeta').name!=='ymmeta_dev')throw Error('DEV_ONLY');
    var H = (typeof __hooks !== 'undefined') ? __hooks : '/pb_hooks';
    var A = require(H + '/ym-addr-lib.js'), M = require(H + '/ym-addr-map.js');
    var VER = '260908a', /* b = 불분명 묶음 + 우편번호 자동 채움 */ KEYS = ['주소1', '주소2', '주소3', '주소4', '우편번호', '주소검토','우편번호추정','우편번호근거','우편번호상태'];
    var rows = ctx.sheetRows('ops_회원'), table = ctx.col('ymdata').name, stamp = new Date().toISOString().replace('T', ' ');
    var inferred=0,unclear=0,invalid=0,originals=[];
    var n = 0, changed = 0, flagged = 0, noSido = 0, noSgg = 0, zip = 0, i, k;
    for (i = 0; i < rows.length; i++) {
      var rec = rows[i], d = ctx.parseJson(rec.publicExport().data, {});
      if (!d || typeof d !== 'object'||Array.isArray(d))throw Error('INVALID_MEMBER_ROW');
      originals.push({id:rec.id,data:JSON.stringify(d)});
      n++;
      var raw = String(d['주소원본'] || d['원본주소'] || d['주소'] || ''), a = A.parse(raw, M), diff = false;
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
      if(a['우편번호추정'])inferred++;if(a['주소1']==='불분명')unclear++;if(a['주소1']&&a['주소1']!=='불분명'&&!A.validPair(a['주소1'],a['주소2']))throw Error('INVALID_REGION_PAIR');
      if (!diff) continue;
      ctx.app.db().newQuery('UPDATE "' + table + '" SET "data"={:d}, "updated"={:s} WHERE "id"={:id}').bind({ d: JSON.stringify(d), s: stamp, id: rec.id }).execute();
      changed++;
    }
    // Re-read inside the transaction: count and every non-derived field must be identical.
    var after=ctx.sheetRows('ops_회원');if(after.length!==originals.length)throw Error('MEMBER_COUNT_CHANGED');
    var beforeById={};originals.forEach(function(o){beforeById[o.id]=JSON.parse(o.data);});
    after.forEach(function(r){var before=beforeById[r.id],afterData=ctx.parseJson(r.publicExport().data,{});if(!before)throw Error('MEMBER_ID_CHANGED');
      KEYS.concat(['주소정제판']).forEach(function(k){delete before[k];delete afterData[k];});
      if(JSON.stringify(before)!==JSON.stringify(afterData))throw Error('NON_DERIVED_FIELD_CHANGED');
    });
    var m=ctx.meta('ops_회원');if(!m)throw Error('MEMBER_META_MISSING');
    var headers=ctx.parseJson(m.get('headers'),[]);if(!Array.isArray(headers))throw Error('INVALID_MEMBER_HEADERS');
    KEYS.concat(['주소정제판']).forEach(function(k){if(headers.indexOf(k)<0)headers.push(k);});m.set('headers',headers);ctx.app.save(m);
    // 회원 요약 캐시·마지막 수정 시각·/api/ops 응답 캐시 판 갱신(레코드 훅을 안 탔으므로 직접)
    var sm = ctx.meta('_member_summary'); if (sm) { sm.set('headers', {}); ctx.app.save(sm); }
    var lm = ctx.meta('_lastmod'); if (lm) { lm.set('source', new Date().toISOString()); ctx.app.save(lm); }
    try { $app.store().set('ym_ver_' + (ctx.env || ''), Date.now() + '-addr063'); } catch (e) { ctx.log('cache bump failed: ' + e); }
    return { rows: n, changed: changed, flagged: flagged, noSido: noSido, noSgg: noSgg, zip: zip, inferredZip: inferred, unclear: unclear, invalidPairs: invalid, originalsPreserved: true, ver: VER };
  }
};
