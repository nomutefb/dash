// Called inside the existing Ticketlink apply transaction, development only.
function nz(v){return String(v==null?'':v).trim();}
function parse(v){if(typeof v==='string')return JSON.parse(v);if(v&&typeof v.string==='function')return JSON.parse(v.string());return v||{};}
function data(r){return parse(r.publicExport().data);}
function rows(app,col,sh){return app.findRecordsByFilter(col('ymdata'),"sheet = '"+sh+"'",'rowIndex',50000,0);}
function meta(app,col,sh){var a=app.findRecordsByFilter(col('ymmeta'),"sheet = '"+sh+"'",'',1,0);if(a.length!==1)throw Error('ROUND_SCHEMA_REQUIRED');return a[0];}
function put(app,col,sh,rec,d){if(rec){rec.set('data',d);app.save(rec);return;}var m=meta(app,col,sh),i=Number(m.get('nextRowIndex'))||2;app.save(new Record(col('ymdata'),{sheet:sh,rowIndex:i,data:d}));m.set('nextRowIndex',i+1);m.set('rowCount',(Number(m.get('rowCount'))||0)+1);app.save(m);}
function prepare(pid,productId,packet,record,batchId,collectedAt){
 if(!packet||nz(packet.productId)!==nz(productId)||!Array.isArray(packet.rounds)||!packet.rounds.length)throw Error('ROUND_PACKET_INVALID');
 var seen={},asOf=new Date(Date.parse(collectedAt)+32400000).toISOString().slice(0,10).replace(/-/g,'');
 var normalized=packet.rounds.map(function(r){var sid=nz(r.scheduleId);if(!/^\d+$/.test(sid)||seen[sid])throw Error('ROUND_ID_INVALID');seen[sid]=1;if(!/^\d{4}-\d{2}-\d{2}$/.test(nz(r.date))||!/^\d{2}:\d{2}$/.test(nz(r.time)))throw Error('ROUND_SCHEDULE_INVALID');return {roundId:'tl_'+productId+'_'+sid,sourceRound:sid,date:r.date,time:r.time,round:nz(r.round),data:{'프로그램ID':pid,'회차ID':'tl_'+productId+'_'+sid,'기준일자':asOf,'누계유료':r.paid,'누계무료':r.free,'누계총인원':r.count,'누계금액':r.amount,'수집원':'ticketlink','수집작업ID':batchId,'수집시각':collectedAt}};});
 var result=require(__hooks+'/ym-round-metrics-lib.js').aggregate(pid,asOf,normalized.map(function(r){return r.roundId;}),normalized.map(function(r){return r.data;}),{'누계유료':record.paid,'누계무료':record.free,'누계총인원':record.count,'누계금액':record.amount});
 if(!result.complete||result.money===null)throw Error('ROUND_INCOMPLETE');return normalized;
}
function write(app,col,pid,productId,prepared){
 if(col('ymdata').name!=='ymdata_dev'||col('ymmeta').name!=='ymmeta_dev')throw Error('ROUND_DEV_ONLY');
 var master=rows(app,col,'ops_실적회차'),daily=rows(app,col,'ops_회차별일일실적');
 prepared.forEach(function(r){
  var ms=master.filter(function(x){return nz(data(x)['회차ID'])===r.roundId;});if(ms.length>1)throw Error('ROUND_MASTER_DUPLICATE');var m=ms.length?data(ms[0]):{};if(ms.length&&(nz(m['프로그램ID'])!==pid||nz(m['원천회차ID'])!==r.sourceRound))throw Error('ROUND_PARENT_CHANGED');
  m['회차ID']=r.roundId;m['프로그램ID']=pid;m['회차명']=r.date+' '+r.time+' ('+r.round+'회)';m['회차순번']=r.round;m['공연일']=r.date;m['공연시간']=r.time;m['수집원']='ticketlink';m['원천회차ID']=r.sourceRound;m['상태']='확인';put(app,col,'ops_실적회차',ms[0],m);
  var ds=daily.filter(function(x){var d=data(x);return nz(d['회차ID'])===r.roundId&&nz(d['기준일자'])===r.data['기준일자'];});if(ds.length>1)throw Error('ROUND_DAILY_DUPLICATE');if(ds.length&&nz(data(ds[0])['프로그램ID'])!==pid)throw Error('ROUND_DAILY_PARENT_CHANGED');
  var d=r.data;Object.keys(d).forEach(function(k){d[k]=String(d[k]);});d['실적ID']=r.roundId+'_'+d['기준일자'];put(app,col,'ops_회차별일일실적',ds[0],d);
 });return prepared.length;
}
module.exports={prepare:prepare,write:write};
