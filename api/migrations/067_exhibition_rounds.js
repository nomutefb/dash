module.exports={id:'067',title:'전시 회차 해당없음 명시',up:function(ctx){
 if(ctx.env!=='dev'||ctx.col('ymdata').name!=='ymdata_dev')throw Error('DEV_ONLY');
 var lib=require(__hooks+'/ym-round-applicability-lib.js'),ids={},mc=0,dc=0;
 var get=function(r){return ctx.parseJson(r.get('data'),{});};
 ctx.sheetRows('ops_프로그램마스터').forEach(function(r){var d=get(r);if(d['구분']!=='사업'&&lib.isExhibition(d)&&d['프로그램ID'])ids[String(d['프로그램ID'])]=true;});
 ctx.sheetRows('ops_실적회차').forEach(function(r){if(ids[String(get(r)['프로그램ID'])])throw Error('EXHIBITION_EXISTING_ROUNDS_REVIEW_REQUIRED');});
 ['ops_프로그램마스터','ops_일일실적'].forEach(function(sh){var m=ctx.meta(sh);if(!m)throw Error('META_REQUIRED');var h=ctx.parseJson(m.get('headers'),[]).slice();if(h.indexOf('회차적용여부')<0)h.push('회차적용여부');m.set('headers',h);ctx.app.save(m);
 ctx.sheetRows(sh).forEach(function(r){var d=get(r);if(!ids[String(d['프로그램ID'])])return;d['회차적용여부']='해당없음';if(sh==='ops_일일실적'){d['회차완전성']='해당없음';dc++;}else mc++;r.set('data',d);ctx.app.save(r);});});
 return {exhibitionPrograms:mc,dailyRows:dc,roundsCreated:0};
}};
