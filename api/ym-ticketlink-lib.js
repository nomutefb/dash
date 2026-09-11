// Ticketlink integration, development environment only. PocketBase / Goja ES5.
var MASTER='ops_프로그램마스터',DAILY='ops_일일실적',STATE='_ticketlink_state',BATCHES='_ticketlink_batches';
var SEED={'65259':'261203_01','65230':'261106_01','65101':'260904_01','65002':'261022_01','64979':'261009_01','64814':'260910_01','64667':'261014_01','64586':'260918_01','64514':'261027_01','64425':'261126_01','64328':'261001_01','64270':'260912_01','64250':'260721_01'};
function nz(x){return String(x==null?'':x).trim();}
function jv(x,f){try{if(x&&typeof x.string==='function')return JSON.parse(x.string());if(typeof x==='string')return JSON.parse(x);return x==null?f:x;}catch(e){return f;}}
function data(r){return jv(r.publicExport().data,{});}
function q(s){return nz(s).split('\\').join('\\\\').split("'").join("\\'");}
function rows(app,col,sheet){return app.findRecordsByFilter(col('ymdata'),"sheet = '"+q(sheet)+"'",'rowIndex',50000,0);}
function meta(app,col,sheet,headers){var a=app.findRecordsByFilter(col('ymmeta'),"sheet = '"+q(sheet)+"'",'',1,0);if(a.length)return a[0];var r=new Record(col('ymmeta'),{sheet:sheet,headers:headers||[],rowCount:0,nextRowIndex:2,source:''});app.save(r);return r;}
function addHeaders(app,m,keys){var h=jv(m.get('headers'),[]);if(!Array.isArray(h))h=[];var changed=false;keys.forEach(function(k){if(h.indexOf(k)<0){h.push(k);changed=true;}});if(changed){m.set('headers',h);app.save(m);}}
function insert(app,col,sheet,d){var m=meta(app,col,sheet,Object.keys(d)),ri=Number(m.get('nextRowIndex'))||2;addHeaders(app,m,Object.keys(d));var r=new Record(col('ymdata'),{sheet:sheet,rowIndex:ri,data:d});app.save(r);m.set('nextRowIndex',ri+1);m.set('rowCount',(Number(m.get('rowCount'))||0)+1);app.save(m);return r;}
function loadState(app,col){var m=meta(app,col,STATE,{}),s=jv(m.get('headers'),{});if(!s||Array.isArray(s))s={};if(!s.mappings)s.mappings=JSON.parse(JSON.stringify(SEED));if(!s.intervalMinutes)s.intervalMinutes=60;return {rec:m,s:s};}
function saveState(app,st){st.rec.set('headers',st.s);app.save(st.rec);}
function safeInt(x){if(x===null||x===undefined||nz(x)===''||!/^\d+$/.test(nz(x)))throw Error('매수 또는 금액 형식 오류');var n=Number(x);if(!isFinite(n)||n>9007199254740991)throw Error('숫자 범위 초과');return n;}
function money(x){var s=nz(x).replace(/,/g,'');if(s===''||!/^\d+(?:\.\d+)?$/.test(s))return null;var n=Number(s);return isFinite(n)?n:null;}
function date8(x){return nz(x).replace(/[^0-9]/g,'').slice(0,8);}
function canceled(d){return nz(d['진행상태']||d['상태'])==='취소';}
// Explicit settlement (including zero) wins. A final historical ledger must not
// be replaced with an older pre-show daily snapshot. Otherwise latest sales wins.
// Ticket-sale amounts are gross. Entered settlement amounts are already net.
function revenueShare(d){
 var org=nz(d['공동기획_기관']),special=nz(d['사업특이사항']);
 return org||/(^|\s*\/\s*)공동\s*기획_[^/\s]+/.test(special)?0.5:1;
}
function resolveRevenue(d,last,group){
 if(nz(d['정산일']))return {amount:money(d['표시_수입']),source:'정산',asOf:date8(d['정산일']),basis:'정산 순수입'};
 var ledgerDate=date8(d['원장_끝판매일']),ledger=money(d['원장_금액']),gross=null,source='',asOf='';
 if(ledger!==null&&ledgerDate&&(!last||ledgerDate>=last.day)){gross=ledger;source='판매원장';asOf=ledgerDate;}
 else if(last){gross=last.amount;source=nz(last.row['수집원'])==='ticketlink'?'티켓링크 판매':'판매실적';asOf=last.day;}
 if(source){
  var share=revenueShare(d),basis=share===0.5?'티켓 총액 × 50%':'티켓 총액';
  // A final ledger, like a settlement, remains authoritative. Only the separate
  // personal daily feed receives incremental manual group bookings.
  if(source!=='판매원장'&&group&&group.count){gross+=group.amount;source+=' + 단체';asOf=asOf>group.day?asOf:group.day;basis=(share===0.5?'(개인 + 단체) 총액 × 50%':'개인 + 단체 총액')+(group.missing?' · 단체 금액 미입력 '+group.missing+'건':'');}
  return {amount:gross===null?null:gross*share,gross:gross,share:share,source:source,asOf:asOf,basis:basis};
 }
 var base=d._salesRevenueBase;
 var original=money(base?base.income:d['표시_수입']);
 if(group&&group.count){var share=revenueShare(d);return {amount:original===null?(group.missing?null:group.amount*share):original+group.amount*share,source:'기존 실적 + 단체',asOf:group.day,basis:'기존 확정 순수입 + 단체 총액'+(share===0.5?' × 50%':'')+(group.missing?' · 단체 금액 미입력 '+group.missing+'건':'')};}
 // Undo of the last group must restore the captured base, even without daily data.
 if(nz(d['수입출처'])==='기존 실적 + 단체')return {amount:original,source:'단체 취소 후 기존 실적',asOf:'',basis:'기존 확정값 복원'};
 return {amount:original,source:'기존 실적',asOf:'',basis:'기존 확정값'};
}

function refreshRevenue(app,col,options){
 var masters=rows(app,col,MASTER),daily=rows(app,col,DAILY),last={},changed=0,biz={},activeCodes={},year=String(new Date().getFullYear()),groups={};
 rows(app,col,'ops_단체').forEach(function(r){var d=data(r),id=nz(d['공연ID']);if(!id)return;var g=groups[id]||(groups[id]={amount:0,count:0,missing:0,day:''}),amount=money(d['금액']),day=date8(d['기준일자']);g.count++;if(amount===null)g.missing++;else g.amount+=amount;if(day>g.day)g.day=day;});
 daily.forEach(function(r){var d=data(r),id=nz(d['프로그램ID']),part=nz(d['구분']);if(part!=='공연'&&part!=='전시'&&part!=='교육')return;var amount=money(nz(d['누계금액'])!==''?d['누계금액']:d['유료금액']),day=date8(d['기준일자']);if(!id||amount===null||day.length!==8)return;var rank=day+'|'+nz(d['수집시각']);if(!last[id]||rank>=last[id].rank)last[id]={row:d,amount:amount,day:day,rank:rank};});
 masters.forEach(function(r){var d=data(r);if(nz(d['구분'])==='사업')return;var id=nz(d['프로그램ID']),code=nz(d['사업코드']);if(options&&options.onlyBusinessCodes&&options.businessCodes.indexOf(code)<0)return;if(!(options&&options.businessCodes&&options.businessCodes.indexOf(code)>=0)&&nz(d['연도'])!==year&&date8(d['시작일']).slice(0,4)!==year&&(!last[id]||last[id].day.slice(0,4)!==year))return;var v=resolveRevenue(d,last[id],groups[id]);
  if(v.source!=='기존 실적'&&code)activeCodes[code]=true;
  if(code&&!canceled(d)&&v.amount!==null){var b=biz[code]||(biz[code]={amount:0,count:0});b.amount+=v.amount;b.count++;}
  if(v.source==='기존 실적'||(v.amount===null&&v.source!=='단체 취소 후 기존 실적'))return;
  var before=JSON.stringify(d);if(!d._salesRevenueBase)d._salesRevenueBase={income:nz(d['표시_수입']),roi:nz(d['표시_수익률']),original:before};
  d['표시_수입']=v.amount===null?'':String(v.amount);d['수입출처']=v.source;d['수입기준일']=v.asOf;d['수입계산기준']=v.basis;if(v.gross!==undefined){d['배분전_티켓수입']=String(v.gross);d['수입배분율']=String(v.share);}else{delete d['배분전_티켓수입'];delete d['수입배분율'];}
  var cost=money(d['표시_사업비']);d['표시_수익률']=v.amount!==null&&cost>0?String(Math.round(v.amount/cost*1000)/10):'';
  if(last[id]){d['일일_유료금액']=String(last[id].amount);d['일일_유료판매']=nz(last[id].row['누계유료']);d['일일_최종일자']=last[id].day;}
  if(JSON.stringify(d)!==before){r.set('data',d);app.save(r);changed++;}
 });
 masters.forEach(function(r){var d=data(r);if(nz(d['구분'])!=='사업')return;var code=nz(d['사업코드'])||nz(d['프로그램ID']),b=biz[code];if(!activeCodes[code])return;var value=String(b?b.amount:0);if(nz(d['정산서매출'])===value&&d['수입출처']==='프로그램 합계')return;if(!d._salesRevenueBase)d._salesRevenueBase={income:nz(d['정산서매출']),display:nz(d['표시_수입'])};d['정산서매출']=value;d['표시_수입']=value;d['수입출처']='프로그램 합계';r.set('data',d);app.save(r);changed++;});
 addHeaders(app,meta(app,col,MASTER),['수입계산기준','배분전_티켓수입','수입배분율','수입출처','수입기준일','_salesRevenueBase','일일_유료금액','일일_유료판매','일일_최종일자']);
 if(changed){var lm=meta(app,col,'_lastmod');lm.set('source',new Date().toISOString());app.save(lm);}return {changed:changed};
}
function publicStatus(s){var out={};['phase','heartbeatAt','lastAppliedAt','lastCompleteAt','lastCollectedAt','nextDueAt','lastResult','lastError','requestAt','intervalMinutes','lastBatchId','publicKey','keyId','settingsUpdatedAt','windowNo','progressAt','stageMessage','collectionProgress','preparationStartedAt','preparationId','openedAt','loginReady','workerProtocol'].forEach(function(k){if(s[k]!==undefined)out[k]=s[k];});out.manualMode=true;out.credentialsConfigured=!!s.credentials&&s.credentials.keyId===s.keyId;out.active=s.active?{id:s.active.id,startedAt:s.active.startedAt}:null;out.online=!!s.heartbeatAt&&Date.now()-Date.parse(s.heartbeatAt)<90000&&s.phase!=='offline';return out;}
function expireManual(s,now){
 var time=Date.parse(now),age=function(v){var n=Date.parse(v||'');return isFinite(n)?time-n:Infinity;},code='';
 if(s.active){if(age(s.heartbeatAt)>=90000)code='COLLECTOR_DISCONNECTED';else if(age(s.active.startedAt)>=900000)code='COLLECTION_TIMEOUT';}
 else if(s.phase==='queued'&&age(s.requestAt)>=60000)code='COLLECTOR_REQUEST_TIMEOUT';
 else if(s.phase==='opening'&&age(s.progressAt)>=60000)code='COLLECTOR_OPEN_TIMEOUT';
 else if(['awaiting_login','login_ready'].indexOf(s.phase)>=0&&age(s.preparationStartedAt||s.openedAt)>=600000)code='LOGIN_WAIT_TIMEOUT';
 if(!code)return false;
 s.active=null;s.phase='error';s.lastError=code;s.requestAt=null;s.preparationId=null;s.openedAt=null;s.loginReady=false;s.credentialsBlocked=true;s.progressAt=now;s.stageMessage='갱신이 중단됐습니다. 연결 확인 후 수집기를 다시 열어 주세요';return true;
}
function manualAction(s,action,body,now){
 expireManual(s,now);
 s.manualMode=true;
 if(action==='prepare'){
  if(!s.active&&s.phase!=='queued'){s.preparationId='login_'+Date.now()+'_'+Math.random().toString(36).slice(2,10);s.phase='opening';s.preparationStartedAt=now;s.collectionProgress=null;s.openedAt=null;s.loginReady=false;s.requestAt=null;s.lastError='';s.credentialsBlocked=true;s.stageMessage='수집기 창을 열고 있습니다';s.progressAt=now;}
 }else if(action==='login-state'){
  if(!s.active&&body.preparationId===s.preparationId&&['opening','awaiting_login','login_ready'].indexOf(s.phase)>=0){s.openedAt=s.openedAt||now;s.loginReady=body.ready===true;s.phase=s.loginReady?'login_ready':'awaiting_login';s.stageMessage=s.loginReady?'미소에서 전송을 누르면 실적을 수집합니다':'수집기에서 셀러 로그인과 창구 선택 후 미소의 전송을 눌러 주세요';s.progressAt=now;}
 }else if(action==='request'){
  if(!s.active&&s.phase!=='queued'){
   if(!s.preparationId||!s.openedAt)throw Error('COLLECTOR_NOT_OPEN');
   if(s.loginReady!==true)throw Error('MANUAL_LOGIN_REQUIRED');
   if(!s.heartbeatAt||Date.parse(now)-Date.parse(s.heartbeatAt)>=90000||s.phase==='offline'||s.workerProtocol!==2)throw Error('COLLECTOR_OFFLINE');
   if(body.preparationId!==s.preparationId)throw Error('LOGIN_REQUEST_EXPIRED');
   s.requestAt=now;s.credentialsBlocked=false;s.phase='queued';s.lastError='';s.stageMessage='전송 요청을 받았습니다';
  }
 }else if(action==='heartbeat'){
  s.heartbeatAt=now;s.workerProtocol=Number(body.protocol)||1;
  // A delayed heartbeat must not revive an expired or already applied job.
  if(body.phase&&body.phase!=='starting'&&s.active){if(s.phase!==nz(body.phase)){s.phase=nz(body.phase);s.progressAt=now;}if(body.stageMessage)s.stageMessage=nz(body.stageMessage).slice(0,160);
   if(body.jobId===s.active.id&&body.collectionProgress){var p=body.collectionProgress,out={};if(['sales','group','validate','apply'].indexOf(p.stage)>=0){out.stage=p.stage;['done','total','rounds','personalCount','groupCount','groupPending'].forEach(function(k){var n=Number(p[k]);if(p[k]!==undefined&&isFinite(n)&&n>=0&&Math.floor(n)===n&&n<=9007199254740991)out[k]=n;});s.collectionProgress=out;}}}
  if(body.publicKey&&/^-----BEGIN PUBLIC KEY-----/.test(body.publicKey)&&body.publicKey.length<3000){s.publicKey=body.publicKey;s.keyId=nz(body.keyId);}
 }else if(action==='claim'){
  if(s.active&&Date.now()-Date.parse(s.active.startedAt)>900000){s.active=null;s.phase='error';s.lastError='수집이 중단됐습니다. 전송을 다시 눌러 주세요';s.credentialsBlocked=true;}
  var job=null;
  // Manual MVP: elapsed time and old queued requests never trigger collection.
  if(Number(body.protocol)===2&&!s.active&&!s.credentialsBlocked&&s.phase==='queued'&&s.requestAt&&s.preparationId&&s.openedAt){job={id:'tl_'+Date.now()+'_'+Math.random().toString(36).slice(2,10),startedAt:now,mode:'manual'};s.active=job;s.phase='connecting';s.progressAt=now;s.stageMessage='완료된 셀러 로그인을 확인합니다';s.lastError='';}
  return {ok:true,job:job};
 }else if(action==='failure'){
  if(!s.active&&body.preparationId&&body.preparationId===s.preparationId){s.phase='error';s.lastError=nz(body.error).slice(0,300);s.preparationId=null;s.openedAt=null;s.loginReady=false;s.credentialsBlocked=true;s.stageMessage='수집기 창을 다시 열어 로그인해 주세요';}
  if(s.active&&s.active.id===body.jobId){s.active=null;s.loginReady=false;s.phase=/LOGIN_REQUIRED/.test(nz(body.error))?'awaiting_login':'error';s.credentialsBlocked=true;s.lastError=nz(body.error).slice(0,300);s.stageMessage=s.phase==='awaiting_login'?'셀러 로그인 후 전송을 다시 눌러 주세요':'수집을 완료하지 못했습니다';}
 }
 return {ok:true,status:publicStatus(s)};
}
function applyBatch(app,col,body,options){
 var bid=nz(body.batchId);if(!/^[a-zA-Z0-9_-]{8,100}$/.test(bid))throw Error('batchId 오류');
 var previous=rows(app,col,BATCHES).filter(function(r){return nz(data(r).batchId)===bid;});if(previous.length)return data(previous[0]).result;
 var st=loadState(app,col),s=st.s;if(options&&options.developerSnapshot){if(s.active||['queued','opening','connecting','sales_query','applying'].indexOf(s.phase)>=0)throw Error('COLLECTOR_BUSY');}else if(!s.active||s.active.id!==body.jobId)throw Error('실행 중인 수집 작업과 일치하지 않습니다');
 var when=Date.parse(body.collectedAt);if(!isFinite(when)||when>Date.now()+60000||when<Date.now()-86400000)throw Error('수집시각 오류 또는 만료');
 if(s.lastCollectedAt&&when<Date.parse(s.lastCollectedAt))throw Error('더 오래된 수집 결과는 반영하지 않습니다');
 var products=body.products,records=body.records;if(!Array.isArray(products)||!products.length||products.length>1000||!Array.isArray(records))throw Error('수집 상품 목록 오류');
 var byProduct={},byId={},masterRows=rows(app,col,MASTER),issues=[],applied=[],seen={},pids={};
 masterRows.forEach(function(r){var d=data(r);if(nz(d['구분'])!=='사업')byId[nz(d['프로그램ID'])]={rec:r,d:d};});
 products.forEach(function(p){var id=nz(p.id);if(!/^\d+$/.test(id)||byProduct[id])throw Error('중복 또는 잘못된 상품ID');if(id==='64410'||/교육실\s*대관/.test(nz(p.name)))throw Error('교육실 대관은 수집 대상이 아닙니다');if(p.status!=='판매중')throw Error('판매중이 아닌 상품');byProduct[id]=p;});
 var roundMap={},roundCount=0,roundProgramCount=0;if(body.roundProtocol!==undefined&&body.roundProtocol!==1)throw Error('ROUND_PROTOCOL');(body.roundReports||[]).forEach(function(r){var id=nz(r.productId);if(!byProduct[id]||roundMap[id])throw Error('ROUND_PRODUCT_INVALID');roundMap[id]=r;});
 var fieldLib=require(__hooks+'/ym-ticketlink-field-lib.js'),fieldMap={};
 if(body.fieldProtocol!==undefined&&body.fieldProtocol!==1)throw Error('FIELD_PROTOCOL');
 (body.fieldReports||[]).forEach(function(f){var fid=nz(f.productId);if(!byProduct[fid]||fieldMap[fid])throw Error('FIELD_PRODUCT_INVALID');fieldMap[fid]=f;});
 var daily=rows(app,col,DAILY),kst=new Date(when+32400000).toISOString().slice(0,10).replace(/-/g,'');
 records.forEach(function(x){var id=nz(x.productId),p=byProduct[id];if(!p||seen[id])throw Error('예상하지 않은 또는 중복 결과');seen[id]=true;
  var count=safeInt(x.count),amount=safeInt(x.amount),paid=safeInt(x.paid),free=safeInt(x.free);if(paid+free!==count)throw Error('유료+무료 매수 불일치');
  var pid=s.mappings[id],P=byId[pid];if(!P){issues.push({productId:id,name:p.name,reason:'프로그램 연결 필요'});return;}
  if(pids[pid])throw Error('여러 상품이 같은 프로그램에 연결됨: '+pid);pids[pid]=true;
  if(date8(p.start)!==date8(P.d['시작일'])){issues.push({productId:id,name:p.name,reason:'프로그램 시작일 불일치'});return;}
  var part=nz(P.d['콘텐츠구분'])||nz(P.d['표시_분야']);if(['공연','전시','교육','예술교육'].indexOf(part)<0)throw Error('지원하지 않는 프로그램 분야');if(part==='예술교육')part='교육';
  var matches=daily.filter(function(r){var d=data(r);return nz(d['프로그램ID'])===pid&&date8(d['기준일자'])===kst&&nz(d['구분'])===part;});if(matches.length>1)throw Error('같은 날 실적 중복: '+pid);
  var prior=daily.map(data).filter(function(x){return nz(x['프로그램ID'])===pid&&nz(x['구분'])===part&&date8(x['기준일자'])<=kst;}).sort(function(a,b){return (date8(a['기준일자'])+'|'+nz(a['수집시각'])).localeCompare(date8(b['기준일자'])+'|'+nz(b['수집시각']));});
  var old=prior.length?prior[prior.length-1]:null,previous=old?{amount:money(nz(old['누계금액'])!==''?old['누계금액']:old['유료금액']),paid:money(old['누계유료']),free:money(old['누계무료']),asOf:date8(old['기준일자'])}:null;
  var delta=previous?{amount:previous.amount===null?null:amount-previous.amount,paid:previous.paid===null?null:paid-previous.paid,free:previous.free===null?null:free-previous.free}:null;
  var changed=!previous||previous.amount!==amount||previous.paid!==paid||previous.free!==free;
  var noRounds=require(__hooks+'/ym-round-applicability-lib.js').isExhibition(P.d);if(noRounds)P.d['회차적용여부']='해당없음';
  var prepared=!noRounds&&roundMap[id]?require(__hooks+'/ym-ticketlink-round-lib.js').prepare(pid,id,roundMap[id],x,bid,body.collectedAt):null;
  var d=matches.length?data(matches[0]):{};
  if(matches.length&&nz(d['수집원'])!=='ticketlink'&&!d._ticketlinkPrevious)d._ticketlinkPrevious=JSON.parse(JSON.stringify(d));
  d['실적ID']=pid+'_'+kst+'_'+part;d['프로그램ID']=pid;d['구분']=part;d['명칭']=P.d['정본명'];d['기준일자']=kst;d['누계금액']=String(amount);d['유료금액']=String(amount);d['누계유료']=String(paid);d['누계무료']=String(free);d['누계총인원']=String(count);d['사업코드']=nz(P.d['사업코드']);d['수집원']='ticketlink';d['티켓링크상품ID']=id;d['수집시각']=body.collectedAt;d['수집작업ID']=bid;
  d['집계범위']='프로그램';d['회차완전성']=noRounds?'해당없음':(prepared?'완전':'미지정');if(noRounds)d['회차적용여부']='해당없음';
  if(fieldLib.eligible(P.d)){
   if(body.fieldProtocol===1){
    if(!fieldMap[id]||!prepared)throw Error('FIELD_SNAPSHOT_REQUIRED '+id);
    fieldLib.apply(app,col,P.d,id,fieldMap[id],prepared,d,bid,body.collectedAt);
   }else if(d['단체수집작업ID']){d['단체분리상태']='갱신 필요';delete d['개인총인원'];}
  }else if(fieldMap[id])throw Error('FIELD_PERFORMANCE_ONLY');
  if(prepared){roundCount+=require(__hooks+'/ym-ticketlink-round-lib.js').write(app,col,pid,id,prepared);roundProgramCount++;}
  if(matches.length){matches[0].set('data',d);app.save(matches[0]);addHeaders(app,meta(app,col,DAILY),Object.keys(d));}else insert(app,col,DAILY,d);
  P.d['티켓링크상품ID']=id;P.rec.set('data',P.d);app.save(P.rec);applied.push({productId:id,programId:pid,name:P.d['정본명'],amount:amount,paid:paid,free:free,count:count,personalCount:d['단체분리상태']==='확인'?Number(d['개인총인원']):null,groupCount:d['단체분리상태']==='확인'?Number(d['FIELD단체석']):null,groupPending:d['단체분리상태']==='확인'?Number(d['FIELD결제예정석']):null,previous:previous,delta:delta,changed:changed});
 });
 products.forEach(function(p){if(!seen[p.id])issues.push({productId:nz(p.id),name:p.name,reason:'판매 집계 미반환 · 기존 값 유지'});});
 var dailyHistoryResult=tdApply(app,col,body,s.mappings,applied,byId);
 var summary=refreshRevenue(app,col),now=new Date().toISOString();
 var result={ok:true,complete:issues.length===0,applied:applied.length,requested:products.length,issues:issues,records:applied,batchId:bid,collectedAt:body.collectedAt,appliedAt:applied.length?now:null,changed:summary.changed,roundPrograms:roundProgramCount,rounds:roundCount,roundIssues:body.roundIssues||[],dailyHistory:dailyHistoryResult};
 s.active=null;s.phase=result.complete?'idle':'partial';s.lastCollectedAt=body.collectedAt;s.lastResult=result;s.lastError='';s.nextDueAt=new Date(Date.now()+3600000).toISOString();
 if(applied.length){s.lastAppliedAt=now;s.lastBatchId=bid;}if(result.complete)s.lastCompleteAt=now;
 saveState(app,st);insert(app,col,BATCHES,{batchId:bid,collectedAt:body.collectedAt,period:body.period||{},products:products,records:records,result:result});return result;
}
function saveGroups(app,col,body){
 if(col('ymdata').name!=='ymdata_dev'||col('ymmeta').name!=='ymmeta_dev')throw Error('DEV_ONLY');
 var requestId=nz(body.requestId),entries=body.entries;
 if(!/^group_[a-zA-Z0-9_]{8,100}$/.test(requestId)||!Array.isArray(entries)||!entries.length||entries.length>100)throw Error('단체 입력 요청 오류');
 var sheet='ops_단체',stored=rows(app,col,sheet),existing=stored.map(data),previous=existing.filter(function(r){return r['입력요청ID']===requestId;}),masters={},codes=[],programIds=[];
 rows(app,col,MASTER).forEach(function(r){var d=data(r);if(nz(d['구분'])!=='사업')masters[nz(d['프로그램ID'])]=d;});
 function affect(id){var p=masters[id],code=p&&nz(p['사업코드']);if(!p||!code)throw Error('프로그램ID 및 사업코드를 확인하세요');if(codes.indexOf(code)<0)codes.push(code);if(programIds.indexOf(id)<0)programIds.push(id);}
 function finish(extra){
  var revenue=codes.length?refreshRevenue(app,col,{businessCodes:codes,onlyBusinessCodes:true}):{changed:0};
  var lm=meta(app,col,'_lastmod');lm.set('source',new Date().toISOString());app.save(lm);
  var out={ok:true,rows:existing,headers:jv(meta(app,col,sheet).get('headers'),[]),programIds:programIds,revenue:revenue};Object.keys(extra||{}).forEach(function(k){out[k]=extra[k];});return out;
 }
 if(body.undo===true){previous.forEach(function(d){affect(nz(d['공연ID']));});stored.forEach(function(r){if(data(r)['입력요청ID']===requestId)app.delete(r);});existing=existing.filter(function(r){return r['입력요청ID']!==requestId;});var m=meta(app,col,sheet);m.set('rowCount',existing.length);app.save(m);return finish({undone:true});}
 var prepared=entries.map(function(x,i){
  var id=nz(x.programId),p=masters[id];if(!p||nz(p['티켓링크상품ID'])==='64410'||/교육실\s*대관/.test(nz(p['정본명'])))throw Error('프로그램을 확인하세요');affect(id);
  var count=safeInt(x.count);if(count<1)throw Error('인원은 1명 이상이어야 합니다');var day=date8(x.date);if(day.length!==8)throw Error('기준일자 오류');var amount=nz(x.amount)===''?'':String(safeInt(x.amount)),round=nz(x.round),roundId=nz(x.roundId),kind=nz(x.audienceType);if(kind&&kind!=='유료'&&kind!=='무료')throw Error('유무료구분 오류');
  if(!round&&(roundId||nz(x.roundDate)||nz(x.roundTime)))throw Error('회차 미정에는 회차ID·공연일·공연시간을 지정할 수 없습니다');
  return {'공연명':nz(p['정본명']),'공연ID':id,'기준일자':day,'좌석':String(count),'금액':amount,'단체명':nz(x.groupName).slice(0,100),'회차':round,'회차ID':roundId,'공연일':nz(x.roundDate),'공연시간':nz(x.roundTime),'유무료구분':kind,'입력요청ID':requestId,'입력ID':requestId+'_'+i};
 });
 if(previous.length){
  if(previous.length!==prepared.length)throw Error('이전 요청과 내용이 다릅니다');
  prepared.forEach(function(d){var old=previous.filter(function(r){return nz(r['입력ID'])===d['입력ID'];});if(old.length!==1||Object.keys(d).some(function(k){return k!=='공연명'&&nz(old[0][k])!==nz(d[k]);}))throw Error('이전 요청과 내용이 다릅니다');});
  return finish({replayed:true});
 }
 prepared.forEach(function(d){insert(app,col,sheet,d);existing.push(d);});
 return finish({});
}
function handle(e,app,hooks,action){try{
 var env=require(hooks+'/ym-env-lib.js');if(env.envOf(e)!=='dev')return e.json(403,{ok:false,error:'개발본에서만 사용할 수 있습니다'});
 var col=function(n){return env.col(app,n,'dev');},info=e.requestInfo()||{},body=info.body||{};if(typeof body==='string')body=JSON.parse(body);
 if(['heartbeat','claim','apply','failure','reconcile','worker-settings','login-state'].indexOf(action)>=0){var key=nz(e.request.header.get('X-Ym-Collector'));if(key!==require(hooks+'/ym-ticketlink-private.js').key)return e.json(403,{ok:false,error:'수집기 연결 인증 실패'});}
 var result;
 app.runInTransaction(function(tx){var tc=function(n){return env.col(tx,n,'dev');};
  if(action==='group-save'){result=saveGroups(tx,tc,body);return;}
  if(action==='apply'){result=applyBatch(tx,tc,body);return;}
  if(action==='reconcile'){result={ok:true,result:refreshRevenue(tx,tc)};return;}
  var st=loadState(tx,tc),s=st.s,now=new Date().toISOString();
  if(action==='status'){if(expireManual(s,now))saveState(tx,st);result={ok:true,status:publicStatus(s)};return;}
  if(['prepare','login-state','request','heartbeat','claim','failure'].indexOf(action)>=0){result=manualAction(s,action,body,now);
   // FIELD_PRODUCT_LIST_V1: server master and current mappings determine scope.
   if(action==='claim'&&result.job){
    var fl=require(hooks+'/ym-ticketlink-field-lib.js'),eligibleIds={};
    rows(tx,tc,MASTER).forEach(function(rec){var d=data(rec);if(fl.eligible(d))eligibleIds[nz(d['프로그램ID'])]=true;});
    result.job.fieldProductIds=Object.keys(s.mappings).filter(function(id){return eligibleIds[nz(s.mappings[id])]===true;});
    result.job.fieldProtocol=1;
    result.job.dailyProtocol=1;result.job.dailyCoverage=tdCoverage(tx,tc);result.job.dailyProductIds=Object.keys(s.mappings);
    var noRoundPrograms={};rows(tx,tc,MASTER).forEach(function(rec){var d=data(rec);if(require(hooks+'/ym-round-applicability-lib.js').isExhibition(d))noRoundPrograms[nz(d['프로그램ID'])]=true;});
    result.job.dailyNoRoundIds=Object.keys(s.mappings).filter(function(id){return noRoundPrograms[nz(s.mappings[id])]===true;});
   }
}
  else if(action==='settings'){if(body.credentials){var c=body.credentials;if(c.v!==1||c.keyId!==s.keyId||!nz(c.wrappedKey)||!nz(c.iv)||!nz(c.cipher)||JSON.stringify(c).length>10000)throw Error('암호화된 연결 설정을 확인해 주세요');s.credentials=c;}if(body.windowNo!==undefined){var wn=Number(body.windowNo);if(wn<1||wn>10||Math.floor(wn)!==wn)throw Error('창구는 1부터 10까지 선택할 수 있습니다');s.windowNo=wn;}if(body.credentials||body.windowNo!==undefined){s.settingsUpdatedAt=now;s.credentialsBlocked=false;}result={ok:true,status:publicStatus(s)};}
  else if(action==='worker-settings'){result={ok:true,credentials:s.credentials||null,windowNo:s.windowNo||8,updatedAt:s.settingsUpdatedAt||null};}
  else if(action==='mappings'){
   if(body.productId){var id=nz(body.productId),pid=nz(body.programId);if(id==='64410'||!/^\d+$/.test(id))throw Error('잘못된 상품ID');var found=rows(tx,tc,MASTER).filter(function(r){var d=data(r);return nz(d['프로그램ID'])===pid&&nz(d['구분'])!=='사업';});if(found.length!==1)throw Error('프로그램ID 확인 필요');s.mappings[id]=pid;}
   result={ok:true,mappings:s.mappings,programs:rows(tx,tc,MASTER).map(data).filter(function(d){return nz(d['구분'])!=='사업'&&nz(d['연도'])===String(new Date().getFullYear());}).map(function(d){return {id:d['프로그램ID'],name:d['정본명'],start:d['시작일']};})};
  }else throw Error('알 수 없는 수집 요청');saveState(tx,st);
 });return e.json(200,result);
}catch(err){return e.json(400,{ok:false,error:nz(err.message||err)});}}
module.exports={applyDeveloperSnapshot:function(app,col,body){if(col('ymdata').name!=='ymdata_dev'||col('ymmeta').name!=='ymmeta_dev')throw Error('DEV_ONLY');return applyBatch(app,col,body,{developerSnapshot:true});},handle:handle,saveGroups:saveGroups,refreshRevenue:refreshRevenue,resolveRevenue:resolveRevenue,manualAction:manualAction,expireManual:expireManual};

// DAILY_HISTORY_V1. Separate transaction-day facts from collection-day snapshots.
var TD='ops_거래일별회차실적',TC='ops_일별수집상태';
function tdRows(app,col,sheet){var out=[],page,offset=0;do{page=app.findRecordsByFilter(col('ymdata'),"sheet = '"+sheet+"'",'rowIndex,id',1000,offset);out=out.concat(page);offset+=page.length;}while(page.length===1000);return out;}
function tdInt(x){if(typeof x!=='number'||!isFinite(x)||Math.floor(x)!==x||Math.abs(x)>9007199254740991)throw Error('DAILY_NUMBER');return x;}
function tdDate(x){if(!/^\d{4}-\d{2}-\d{2}$/.test(nz(x))||new Date(x+'T00:00:00Z').toISOString().slice(0,10)!==x)throw Error('DAILY_DATE');return x;}
function tdCoverage(app,col){return tdRows(app,col,TC).map(data).map(function(x){return {productId:nz(x['티켓링크상품ID']),date:x['거래일자'],start:x['조회시작일'],final:x['마감여부']==='완료',count:Number(x['순판매매수']),amount:Number(x['순판매금액'])};});}
function tdApply(app,col,body,mappings,applied,masters){
 if(body.dailyProtocol===undefined)return null;
 if(body.dailyProtocol!==1||!Array.isArray(body.dailyHistory))throw Error('DAILY_PROTOCOL');
 var today=new Date(Date.parse(body.collectedAt)+32400000).toISOString().slice(0,10),old=tdRows(app,col,TC),stored=tdRows(app,col,TD),cm={},rm={},allowed={},reports={},staged={},seen={};
 applied.forEach(function(x){allowed[x.productId]=x;});
 (body.roundReports||[]).forEach(function(p){var m={};p.rounds.forEach(function(r){m[nz(r.scheduleId)]=r;});reports[nz(p.productId)]=m;});
 Object.keys(allowed).forEach(function(id){var master=masters[mappings[id]].d;if(require(__hooks+'/ym-round-applicability-lib.js').isExhibition(master)){var v=date8(master['시작일']);reports[id]={NA:{date:v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6,8),time:'',round:''}};}});
 old.forEach(function(r){var x=data(r),k=nz(x['티켓링크상품ID'])+'|'+x['거래일자'];if(cm[k])throw Error('DAILY_DUPLICATE_STORED');cm[k]=r;staged[k]=x;});
 stored.forEach(function(r){var x=data(r),k=x['실적ID'];if(rm[k])throw Error('DAILY_DUPLICATE_FACT');rm[k]=r;});
 var puts=[],marks=[];
 body.dailyHistory.forEach(function(d){
  var id=nz(d.productId),pid=mappings[id],date=tdDate(d.date),start=tdDate(d.start),key=id+'|'+date,source=reports[id];
  if(!pid||!allowed[id]||!source||seen[key]||date>today||start>date||typeof d.final!=='boolean'||d.final!==(date<today))throw Error('DAILY_SCOPE');seen[key]=true;
  if(!isFinite(Date.parse(d.fetchedAt))||new Date(Date.parse(d.fetchedAt)+32400000).toISOString().slice(0,10)!==today)throw Error('DAILY_FETCH_DATE');
  if(cm[key]&&data(cm[key])['마감여부']==='완료')throw Error('DAILY_ALREADY_FINAL');
  if(!Array.isArray(d.rounds)||d.rounds.length!==Object.keys(source).length)throw Error('DAILY_ROUND_COVERAGE');
  stored.forEach(function(rec){var f=data(rec);if(nz(f['티켓링크상품ID'])===id&&f['거래일자']===date&&!source[nz(f['원천회차ID'])])throw Error('DAILY_STORED_ROUND_CHANGED '+id);});
  var ids={},count=0,amount=0;
  d.rounds.forEach(function(g){var sid=nz(g.scheduleId),r=source[sid];if(!r||ids[sid]||g.date!==date||g.performanceDate!==r.date||g.time!==r.time||nz(g.round)!==nz(r.round))throw Error('DAILY_ROUND_MAPPING');ids[sid]=true;
   ['count','amount','paid','free','reportRows'].forEach(function(k){tdInt(g[k]);});
   if(g.reportRows<0||g.paid+g.free!==g.count)throw Error('DAILY_FACT_TOTAL');
   count+=g.count;amount+=g.amount;
   puts.push({'실적ID':'deal_'+id+'_'+sid+'_'+date,'프로그램ID':pid,'티켓링크상품ID':id,'회차ID':'tl_'+id+'_'+sid,'원천회차ID':sid,'거래일자':date,'공연일':r.date,'공연시간':r.time,'회차':nz(r.round),'순유료매수':g.paid,'순무료매수':g.free,'순판매매수':g.count,'순판매금액':g.amount,'원천집계행수':g.reportRows,'집계기준':'거래일','개인단체구분':'미분리','수집원':'ticketlink-deal-grade','수집시각':d.fetchedAt,'수집작업ID':body.batchId});
  });
  if(count!==tdInt(d.count)||amount!==tdInt(d.amount))throw Error('DAILY_PROGRAM_TOTAL');
  var mark={'프로그램ID':pid,'티켓링크상품ID':id,'거래일자':date,'조회시작일':start,'마감여부':d.final?'완료':'당일','순판매매수':count,'순판매금액':amount,'회차수':d.rounds.length,'수집시각':d.fetchedAt,'수집작업ID':body.batchId};staged[key]=mark;marks.push({key:key,data:mark});
 });
 Object.keys(allowed).forEach(function(id){var days=Object.keys(staged).filter(function(k){return k.indexOf(id+'|')===0;}).map(function(k){return staged[k];}).sort(function(a,b){return a['거래일자'].localeCompare(b['거래일자']);});
  if(!days.length)throw Error('DAILY_HISTORY_REQUIRED '+id);
  var start=tdDate(days[0]['조회시작일']),expected=Date.parse(start+'T00:00:00Z'),count=0,amount=0;
  days.forEach(function(d){if(d['프로그램ID']!==mappings[id]||d['조회시작일']!==start||Date.parse(d['거래일자']+'T00:00:00Z')!==expected)throw Error('DAILY_HISTORY_GAP '+id);if(d['거래일자']<today&&d['마감여부']!=='완료')throw Error('DAILY_UNFINALIZED_DATE '+id);expected+=86400000;count+=tdInt(d['순판매매수']);amount+=tdInt(d['순판매금액']);});
  if(days[days.length-1]['거래일자']!==today||count!==allowed[id].count||amount!==allowed[id].amount)throw Error('DAILY_CUMULATIVE_MISMATCH '+id);
 });

 var merged={};stored.forEach(function(r){var f=data(r);merged[f['실적ID']]=f;});puts.forEach(function(f){merged[f['실적ID']]=f;});
 Object.keys(allowed).forEach(function(id){var totals={},days={},paid=0,free=0;
  Object.keys(merged).forEach(function(k){var f=merged[k];if(nz(f['티켓링크상품ID'])!==id)return;var sid=nz(f['원천회차ID']),date=f['거래일자'],mark=staged[id+'|'+date],source=reports[id][sid];if(!mark||f['프로그램ID']!==mappings[id]||!source)throw Error('DAILY_ORPHAN_FACT '+id);if(f['공연일']!==source.date||f['공연시간']!==source.time||nz(f['회차'])!==nz(source.round))throw Error('DAILY_STORED_SCHEDULE_CHANGED '+id);
   var t=totals[sid]||(totals[sid]={count:0,amount:0,paid:0,free:0}),d=days[date]||(days[date]={count:0,amount:0,rounds:0});
   var c=tdInt(f['순판매매수']),a=tdInt(f['순판매금액']),p=tdInt(f['순유료매수']),fr=tdInt(f['순무료매수']);if(p+fr!==c)throw Error('DAILY_FACT_TOTAL');t.count+=c;t.amount+=a;t.paid+=p;t.free+=fr;d.count+=c;d.amount+=a;d.rounds++;paid+=p;free+=fr;
  });
  Object.keys(staged).forEach(function(k){var m=staged[k];if(nz(m['티켓링크상품ID'])!==id)return;var d=days[m['거래일자']];if(!d||d.count!==m['순판매매수']||d.amount!==m['순판매금액']||d.rounds!==m['회차수'])throw Error('DAILY_FACT_MARKER_MISMATCH '+id);});
  if(paid!==allowed[id].paid||free!==allowed[id].free)throw Error('DAILY_PAID_FREE_MISMATCH '+id);
  Object.keys(reports[id]).forEach(function(sid){if(sid==='NA')return;var r=reports[id][sid],t=totals[sid];if(!t||t.count!==r.count||t.amount!==r.amount||t.paid!==r.paid||t.free!==r.free)throw Error('DAILY_ROUND_CUMULATIVE_MISMATCH '+id+' '+sid);});
 });
 puts.forEach(function(d){var r=rm[d['실적ID']];if(r){r.set('data',d);app.save(r);}else insert(app,col,TD,d);});
 marks.forEach(function(m){var r=cm[m.key];if(r){r.set('data',m.data);app.save(r);}else insert(app,col,TC,m.data);});
 return {days:marks.length,roundDays:puts.length,dateBasis:'DEAL',verified:true};
}
