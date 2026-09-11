module.exports={id:'065',title:'회차별 실적 저장 기반과 프로그램 총계 분리',up:function(ctx){
 if(ctx.env!=='dev'||ctx.col('ymdata').name!=='ymdata_dev'||ctx.col('ymmeta').name!=='ymmeta_dev')throw Error('DEV_ONLY');
 var schemas=require(__hooks+'/ym-round-metrics-lib.js').SCHEMA;
 var before={},counts={},newSheets=[];
 Object.keys(schemas).forEach(function(sh){var m=ctx.meta(sh);counts[sh]=ctx.sheetRows(sh).length;if(m)before[sh]={headers:ctx.parseJson(m.get('headers'),[]),source:m.get('source'),rowCount:m.get('rowCount'),nextRowIndex:m.get('nextRowIndex')};else if(sh==='ops_일일실적'||sh==='ops_단체')throw Error('REQUIRED_SHEET_MISSING');else if(counts[sh])throw Error('ROWS_WITHOUT_META');});
 if(ctx.meta('_round_foundation_260908'))throw Error('BACKUP_EXISTS');
 ctx.app.save(new Record(ctx.col('ymmeta'),{sheet:'_round_foundation_260908',headers:{before:before,counts:counts,version:1},rowCount:0,nextRowIndex:2,source:'schema-backup'}));
 Object.keys(schemas).forEach(function(sh){var m=ctx.meta(sh);if(!m){m=new Record(ctx.col('ymmeta'),{sheet:sh,headers:schemas[sh],source:'round-foundation-v1',rowCount:0,nextRowIndex:2});newSheets.push(sh);}else{var h=ctx.parseJson(m.get('headers'),[]);if(!Array.isArray(h))throw Error('INVALID_HEADERS');h=h.slice();schemas[sh].forEach(function(k){if(h.indexOf(k)<0)h.push(k);});m.set('headers',h);}ctx.app.save(m);});
 ctx.app.db().newQuery("CREATE UNIQUE INDEX idx_ymdata_dev_round_id ON ymdata_dev (json_extract(data, '$.회차ID')) WHERE sheet = 'ops_실적회차'").execute();
 ctx.app.db().newQuery("CREATE INDEX idx_ymdata_dev_round_program ON ymdata_dev (json_extract(data, '$.프로그램ID'), json_extract(data, '$.회차순번')) WHERE sheet = 'ops_실적회차'").execute();
 ctx.app.db().newQuery("CREATE UNIQUE INDEX idx_ymdata_dev_round_daily ON ymdata_dev (json_extract(data, '$.프로그램ID'), json_extract(data, '$.기준일자'), json_extract(data, '$.회차ID')) WHERE sheet = 'ops_회차별일일실적'").execute();
 Object.keys(counts).forEach(function(sh){if(ctx.sheetRows(sh).length!==counts[sh])throw Error('ROW_COUNT_CHANGED');});
 return {version:1,newSheets:newSheets,legacyRowsUnchanged:counts['ops_일일실적'],indexes:3,collectorConnected:false};
}};
