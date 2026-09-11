// FIELD seats: replace current group rows in the same development transaction.
// Reported sales already include sold FIELD seats. Only pending seats are additive.
var SOURCE='ticketlink-field',GROUP='ops_단체',ARCHIVE='_ticketlink_group_archive';
function nz(v){return String(v==null?'':v).trim();}
function obj(v){if(typeof v==='string')return JSON.parse(v);if(v&&typeof v.string==='function')return JSON.parse(v.string());return v||{};}
function data(r){return obj(r.publicExport().data);}
function rows(app,col,sh){return app.findRecordsByFilter(col('ymdata'),"sheet = '"+sh+"'",'rowIndex',50000,0);}
function meta(app,col,sh){var a=app.findRecordsByFilter(col('ymmeta'),"sheet = '"+sh+"'",'',2,0);if(a.length>1)throw Error('FIELD_META_DUPLICATE');if(a.length)return a[0];var m=new Record(col('ymmeta'),{sheet:sh,headers:[],rowCount:0,nextRowIndex:2});app.save(m);return m;}
function headers(app,col,sh,keys){var m=meta(app,col,sh),h=obj(m.get('headers'));if(!Array.isArray(h))h=[];keys.forEach(function(k){if(h.indexOf(k)<0)h.push(k);});m.set('headers',h);app.save(m);return m;}
function insert(app,col,sh,d){var m=headers(app,col,sh,Object.keys(d)),ri=Number(m.get('nextRowIndex'))||2;app.save(new Record(col('ymdata'),{sheet:sh,rowIndex:ri,data:d}));m.set('nextRowIndex',ri+1);m.set('rowCount',(Number(m.get('rowCount'))||0)+1);app.save(m);}
function num(v){if(v===null||v===undefined||!/^\d+$/.test(nz(v))||Number(v)>9007199254740991)throw Error('FIELD_NUMBER_INVALID');return Number(v);}
function eligible(master){return nz(master['구분'])!=='사업'&&nz(master['구분'])!=='대관'&&!/대관/.test(nz(master['카테고리']))&&nz(master['콘텐츠구분']||master['표시_분야'])==='공연';}
function prepare(master,productId,packet,prepared){
 if(!eligible(master))throw Error('FIELD_PERFORMANCE_ONLY');
 if(!packet||packet.protocol!==1||nz(packet.productId)!==nz(productId)||!Array.isArray(packet.rounds)||!prepared||packet.rounds.length!==prepared.length)throw Error('FIELD_ROUND_COVERAGE');
 var seen={},out=[],total={total:0,sold:0,pending:0,personal:0},freeShow=/^(Y|true|1|무료)$/.test(nz(master['무료여부']));
 packet.rounds.forEach(function(f){var sid=nz(f.scheduleId),rs=prepared.filter(function(r){return r.sourceRound===sid;});if(seen[sid]||rs.length!==1)throw Error('FIELD_ROUND_MAPPING');seen[sid]=true;var r=rs[0];
  if(nz(f.date)!==r.date||nz(f.time)!==r.time||nz(f.round)!==r.round||!/^\d+$/.test(nz(f.logicalPlanId)))throw Error('FIELD_SCHEDULE_MISMATCH');
  var ss={},count=0,sold=0,pending=0;if(!Array.isArray(f.seats))throw Error('FIELD_SEATS_REQUIRED');
  f.seats.forEach(function(s){var id=nz(s.logicalSeatId),n=num(s.seatCount);if(!/^\d+$/.test(id)||ss[id]||n<1||s.allotmentCompanyCode!=='FIELD'||typeof s.able!=='boolean')throw Error('FIELD_SEAT_INVALID');ss[id]=true;count+=n;if(s.able)pending+=n;else sold+=n;});
  if(count!==num(f.fieldTotal)||sold!==num(f.fieldSold)||pending!==num(f.fieldPending)||sold>num(r.data['누계총인원']))throw Error('FIELD_COUNTS_MISMATCH');
  var personal=num(r.data['누계총인원'])-sold;
  if(num(f.personalCount)!==personal||num(f.reportCount)!==num(r.data['누계총인원'])||num(f.reportAmount)!==num(r.data['누계금액']))throw Error('FIELD_REPORT_MISMATCH');
  total.total+=count;total.sold+=sold;total.pending+=pending;total.personal+=personal;
  out.push({r:r,f:f,total:count,sold:sold,pending:pending,personal:personal,freeShow:freeShow});
 });return {rounds:out,total:total,freeShow:freeShow};
}
function annotate(d,x,day,at,bid){
 d['FIELD단체석']=String(x.total);d['FIELD판매완료석']=String(x.sold);d['FIELD결제예정석']=String(x.pending);
 d['개인총인원']=String(x.personal);d['단체분리상태']='확인';d['단체기준일자']=day;d['단체수집시각']=at;d['단체수집작업ID']=bid;
 d['전체예정포함인원']=String(num(d['누계총인원'])+x.pending);
}
function apply(app,col,master,productId,packet,prepared,d,bid,at){
 if(col('ymdata').name!=='ymdata_dev'||col('ymmeta').name!=='ymmeta_dev')throw Error('FIELD_DEV_ONLY');
 var ready=prepare(master,productId,packet,prepared),pid=nz(d['프로그램ID']),day=nz(d['기준일자']);
 // User instructed replacing the previous manual group entries. Keep exact
 // archived records for recovery before replacing the active sheet rows.
 var old=rows(app,col,GROUP).filter(function(r){return nz(data(r)['공연ID'])===pid;});
 old.forEach(function(r){var v=data(r);if(v['수집원']!==SOURCE)insert(app,col,ARCHIVE,{programId:pid,archivedAt:at,batchId:bid,originalId:r.id,originalRowIndex:r.get('rowIndex'),originalData:v});app.delete(r);});
 var gm=meta(app,col,GROUP);gm.set('rowCount',rows(app,col,GROUP).length);app.save(gm);
 ready.rounds.forEach(function(x){var r=x.r,f=x.f;annotate(r.data,x,day,at,bid);
  r.data['논리좌석도ID']=nz(f.logicalPlanId);r.data['회차원천필드']=JSON.stringify(f.scheduleSource||{});r.data['할당처코드']='FIELD';
  // Store source identifiers and allocation audit data with the daily round.
  r.data['FIELD원천좌석']=JSON.stringify(f.seats.map(function(s){return {logicalSeatId:s.logicalSeatId,allotmentCompanyCode:s.allotmentCompanyCode,able:s.able,gradeId:s.gradeId,physicalSeatId:s.physicalSeatId,seatCount:s.seatCount};}));
  // Full source split into bounded records below the database JSON field limit.
  var rawSheet='_ticketlink_field_source',chunkSize=150;
  for(var off=0;off<f.seats.length;off+=chunkSize){
   insert(app,col,rawSheet,{programId:pid,roundId:r.roundId,scheduleId:nz(f.scheduleId),date:r.date,time:r.time,asOf:day,collectedAt:at,batchId:bid,chunkIndex:off/chunkSize,seats:f.seats.slice(off,off+chunkSize)});
  }
  r.data['FIELD원천수집ID']=bid;r.data['FIELD원천시트']=rawSheet;
r.data['할당처별수량']=JSON.stringify(f.allocations||{});r.data['비지정구역원천']=JSON.stringify(f.zones||[]);
  if(x.freeShow){r.data['단체무료']=String(x.total);r.data['단체유료']='0';r.data['개인무료']=String(x.personal);r.data['개인유료']='0';}
  else if(num(r.data['누계무료'])===0){r.data['단체유료']=String(x.total);r.data['단체무료']='0';r.data['개인유료']=String(x.personal);r.data['개인무료']='0';}
  else{r.data['단체유료']='';r.data['단체무료']='';r.data['개인유료']='';r.data['개인무료']='';}
  headers(app,col,'ops_회차별일일실적',Object.keys(r.data));
  insert(app,col,GROUP,{'공연명':nz(master['정본명']),'공연ID':pid,'기준일자':day,'좌석':String(x.pending),'금액':x.pending&&!x.freeShow?'':'0','단체명':'Example Group 1','회차':r.round,'회차ID':r.roundId,'공연일':r.date,'공연시간':r.time,'유무료구분':x.freeShow?'무료':'유료','수집원':SOURCE,'수집작업ID':bid,'수집시각':at,'입력ID':'field_'+r.roundId,'티켓링크상품ID':productId,'단체총좌석':String(x.total),'판매완료좌석':String(x.sold),'결제예정좌석':String(x.pending),'금액상태':x.pending&&!x.freeShow?'미확인':'판매보고서 포함','할당처코드':'FIELD'});
 });annotate(d,ready.total,day,at,bid);
 d['단체유료']=ready.freeShow?'0':String(ready.total.total);d['단체무료']=ready.freeShow?String(ready.total.total):'0';
 return ready.total;
}
module.exports={eligible:eligible,prepare:prepare,apply:apply};
