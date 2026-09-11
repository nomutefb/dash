// YM_BOOT_FAST_GLASS_260909. Read only, no persistence, no cross-request cache.
function read(app,col,sheet,columns,parts){
  var c=col('ymdata'),table=String(c.name||c);
  if(table!=='ymdata'&&table!=='ymdata_dev')throw Error('Unexpected data collection');
  var params={sheet:String(sheet)},select='data';
  if(Array.isArray(columns)&&columns.length){
    var columnPairs=[];for(var ci=0;ci<columns.length;ci++){var key=columns[ci];if(typeof key!=='string')throw Error('Invalid column');params['k'+ci]=key;params['p'+ci]='$.'+key;columnPairs.push('{:k'+ci+'},json_extract(data,{:p'+ci+'})');}
    select='json_object('+columnPairs.join(',')+')';
  }
  var partSql='';
  if(Array.isArray(parts)&&parts.length){var pks=[];for(var pi=0;pi<parts.length;pi++){params['part'+pi]=String(parts[pi]);pks.push('{:part'+pi+'}');}partSql=" AND trim(COALESCE(json_extract(data,'$.구분'),'')) IN ("+pks.join(',')+')';}
  var sql='SEL'+"ECT COALESCE(json_group_array(json(doc)),'[]') AS payload FR"+'OM (SEL'+'ECT '+select+' AS doc FR'+'OM "'+table+'" WH'+'ERE sheet={:sheet}'+partSql+' OR'+'DER BY rowIndex LIMIT 50000)';
  var result=arrayOf(new DynamicModel({payload:''}));
  app.db().newQuery(sql).bind(params).all(result);
  if(result.length!==1)throw Error('Invalid bulk read result');
  var rows=JSON.parse(String(result[0].payload));
  if(!Array.isArray(rows))throw Error('Invalid bulk JSON');
  return rows;
}
function asOf(app,col){
  var c=col('ymdata'),table=String(c.name||c);
  if(table!=='ymdata'&&table!=='ymdata_dev')throw Error('Unexpected data collection');
  var sql="SEL"+"ECT COALESCE(json_group_array(json_extract(data,'$.기준일자')),'[]') AS payload FR"+"OM (SEL"+"ECT data FR"+"OM \""+table+"\" WH"+"ERE sheet={:sheet} AND json_extract(data,'$.구분')={:part} OR"+"DER BY rowIndex LIMIT 50000)";
  var result=arrayOf(new DynamicModel({payload:''}));
  app.db().newQuery(sql).bind({sheet:'ops_일일실적',part:'공연'}).all(result);
  var days=JSON.parse(String(result[0].payload)),latest='';
  for(var i=0;i<days.length;i++){var d=String(days[i]||'').replace(/[^0-9]/g,'');if(/^\d{8}$/.test(d)&&d>latest)latest=d;}
  return latest;
}
module.exports={read:read,asOf:asOf};
