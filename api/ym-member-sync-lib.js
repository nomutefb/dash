// Development-only member sync. Complete staging precedes one atomic commit.
var STATE='_member_sync',MEMBERS='ops_회원';
var ADDR_VER='260908a'; // [260907 주소정제] 정제기 판 — ym-addr-lib 규칙이 바뀌면 올린다(회원 재동기화 때 주소를 다시 나눔). 이관 062와 같은 값
function nz(v){return String(v==null?'':v).trim();}
function json(v,f){try{if(v&&typeof v.string==='function')return JSON.parse(v.string());if(typeof v==='string')return JSON.parse(v);return v==null?f:v;}catch(e){return f;}}
function data(r){return json(r.get('data'),{});}
function esc(v){return nz(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
function find(app,col,sh,limit,offset){return app.findRecordsByFilter(col('ymdata'),"sheet = '"+esc(sh)+"'",'rowIndex',limit||100000,offset||0);}
function meta(app,col,sh){var a=app.findRecordsByFilter(col('ymmeta'),"sheet = '"+esc(sh)+"'",'',1,0);return a[0]||null;}
function state(app,col){var r=meta(app,col,STATE);return {r:r,s:r?json(r.get('headers'),{}):{phase:'idle'}};}
function save(app,col,st){if(!st.r)st.r=new Record(col('ymmeta'),{sheet:STATE,rowCount:0,nextRowIndex:2,source:'member-sync'});st.r.set('headers',st.s);app.save(st.r);}
function expire(s,at){
 var limits={opening:90000,awaiting_login:600000,collecting:180000,staging:900000};if(!limits[s.phase])return s;
 var start=Date.parse(s.phaseStartedAt||s.startedAt),total=Date.parse(s.startedAt),reason='';
 if(!isFinite(start)||at-start>limits[s.phase]||at-total>1800000)reason=s.phase==='awaiting_login'?'로그인 대기 시간이 10분을 넘었습니다. 다시 열어 주세요':'회원 갱신 대기 시간이 초과되었습니다. 다시 열어 주세요';
 if(['opening','awaiting_login'].indexOf(s.phase)>=0&&at-total>90000&&(!s.heartbeatAt||at-Date.parse(s.heartbeatAt)>90000))reason='수집기 연결이 끊겼습니다. 연결 후 다시 열어 주세요';
 if(reason){s.phase='error';s.error=reason;s.message=reason;}return s;
}
function status(s){var out={};['phase','jobId','startedAt','heartbeatAt','message','error','received','expected','lastCompleteAt','lastJobId','result'].forEach(function(k){if(s[k]!==undefined)out[k]=s[k];});out.online=!!s.heartbeatAt&&Date.now()-Date.parse(s.heartbeatAt)<90000;return out;}
function id(d){return nz(d['아이디']||d.ID||d.userId);}
function phone(d){var s=nz(d['휴대폰번호']||d['휴대폰정규화']).replace(/\D/g,'');return s.length===11?s.slice(0,3)+'-'+s.slice(3,7)+'-'+s.slice(7):s.length===10?s.slice(0,3)+'-'+s.slice(3,6)+'-'+s.slice(6):s;}
function packed(d){var out={};Object.keys(d).sort().forEach(function(k){if(k!=='_json'&&d[k]!==''&&d[k]!==null&&d[k]!==undefined)out[k]=d[k];});return out;}
function bulkMembers(app,items){
 var stamp=new Date().toISOString().replace('T',' ');
 for(var start=0;start<items.length;start+=200){var part=items.slice(start,start+200),params={stamp:stamp},values=[];
  part.forEach(function(item,i){params['id'+i]=item.id;params['ri'+i]=item.rowIndex;params['d'+i]=JSON.stringify(item.data);values.push('({:id'+i+"},'ops_회원',{:ri"+i+'},{:d'+i+'},{:stamp},{:stamp})');});
  app.db().newQuery('INSERT INTO "ymdata_dev" ("id","sheet","rowIndex","data","created","updated") VALUES '+values.join(',')+' ON CONFLICT("id") DO UPDATE SET "data"=excluded."data","updated"=excluded."updated" WHERE "ymdata_dev"."sheet"=\'ops_회원\'').bind(params).execute();
 }
}
function normalize(row,old){
 var d={},k;for(k in old)if(Object.prototype.hasOwnProperty.call(old,k))d[k]=old[k];
 ['아이디','이름','생년월일','전화번호','휴대폰번호','이메일','등록일'].forEach(function(key){d[key]=nz(row[key]);});d.ID=d['아이디'];d['휴대폰정규화']=phone(row);
 var address=nz(row['주소']),prior=nz(old['주소원본']||old['원본주소']||old['주소']);
 // [260907 주소정제] 주소 나누기는 api/ym-addr-lib.js(+ym-addr-map.js)가 맡는다. 원본이 바뀌었거나, 정제기 판(ADDR_VER)이 올라갔거나, 아직 안 나눈 행이면 다시 나눈다
 if(address!==prior||!old['주소1']||nz(old['주소정제판'])!==ADDR_VER){
  var H=(typeof __hooks!=='undefined')?__hooks:'/pb_hooks',pa=require(H+'/ym-addr-lib.js').parse(address,require(H+'/ym-addr-map.js'));
  d['주소1']=pa['주소1'];d['주소2']=pa['주소2'];d['주소3']=pa['주소3'];d['주소4']=pa['주소4'];d['우편번호']=pa['우편번호'];d['주소검토']=pa['주소검토'];['우편번호추정','우편번호근거','우편번호상태'].forEach(function(k){d[k]=pa[k];});d['주소정제판']=ADDR_VER;
 }
 d['주소원본']=address;var year=Number(d['생년월일'].slice(0,4)),now=new Date().getFullYear();d['연령대']=year>1900&&year<=now?Math.floor((now-year)/10)*10+'대':'미상';d['수집원']='yeulmaru';return d;
}
function commit(app,col,s,body){
 if(s.lastJobId===body.jobId&&s.result)return s.result;
 if(s.jobId!==body.jobId||s.phase!=='staging'||s.received!==s.expected)throw Error('MEMBER_STAGE_INCOMPLETE');
 var chunks=find(app,col,'_member_stage_'+s.jobId),incoming=[],seen={},i;
 for(i=0;i<chunks.length;i++){var chunk=data(chunks[i]);if(chunk.index!==i)throw Error('MEMBER_STAGE_GAP');incoming=incoming.concat(chunk.rows);}
 if(incoming.length!==s.expected)throw Error('MEMBER_COUNT_MISMATCH');
 incoming.forEach(function(d){var key=id(d);if(!key||seen['$'+key])throw Error('MEMBER_ID_DUPLICATE');seen['$'+key]=true;});
 var existing=find(app,col,MEMBERS),byId={},byLegacy={},max=1;
 existing.forEach(function(r){var d=data(r),key=id(d);max=Math.max(max,Number(r.get('rowIndex'))||1);if(key){if(byId['$'+key])throw Error('MEMBER_EXISTING_ID_DUPLICATE');byId['$'+key]={r:r,d:d};}else{var fk='$'+phone(d)+'|'+nz(d['이름']);if(byLegacy[fk])byLegacy[fk].ambiguous=true;else byLegacy[fk]={r:r,d:d};}});
 var inserted=0,updated=0,unchanged=0,matched={},writes=[];
 incoming.forEach(function(row){var key=id(row),p=byId['$'+key];if(!p){var legacy=byLegacy['$'+phone(row)+'|'+nz(row['이름'])];if(legacy&&!legacy.ambiguous&&!matched[legacy.r.id])p=legacy;}
  var d=packed(normalize(row,p?p.d:{}));if(p){matched[p.r.id]=true;if(JSON.stringify(d)!==JSON.stringify(packed(p.d))){writes.push({id:p.r.id,rowIndex:Number(p.r.get('rowIndex')),data:d});updated++;}else unchanged++;}
  else{max++;writes.push({id:$security.randomString(15),rowIndex:max,data:d});inserted++;}
 });
 bulkMembers(app,writes);
 var m=meta(app,col,MEMBERS)||new Record(col('ymmeta'),{sheet:MEMBERS});var headers=json(m.get('headers'),[]);if(!Array.isArray(headers))headers=[];
 Object.keys(normalize(incoming[0],{})).forEach(function(k){if(headers.indexOf(k)<0)headers.push(k);});m.set('headers',headers);m.set('rowCount',existing.length+inserted);m.set('nextRowIndex',max+1);m.set('source','yeulmaru-member-sync');app.save(m);
 var summary=meta(app,col,'_member_summary');if(summary){summary.set('headers',{});app.save(summary);}
 var lm=meta(app,col,'_lastmod')||new Record(col('ymmeta'),{sheet:'_lastmod',headers:[]});lm.set('source',new Date().toISOString());app.save(lm);
 // Staging rows are temporary; deleting these never deletes a member.
 chunks.forEach(function(r){app.delete(r);});
 var result={total:incoming.length,inserted:inserted,updated:updated,unchanged:unchanged,retained:existing.length-Object.keys(matched).length};
 s.lastCompleteAt=new Date().toISOString();s.lastJobId=s.jobId;s.result=result;s.phase='complete';s.message='회원 정보 반영 완료';s.error='';return result;
}
function handle(e,app,hooks,action){try{
 var env=require(hooks+'/ym-env-lib.js');if(env.envOf(e)!=='dev')return e.json(403,{ok:false,error:'개발본 전용입니다'});
 var col=function(n){return env.col(app,n,'dev');},body=env.bodyOf(e),worker=['heartbeat','login-state','begin','chunk','commit','failure'].indexOf(action)>=0;
 if(worker&&nz(e.request.header.get('X-Ym-Collector'))!==require(hooks+'/ym-ticketlink-private.js').key)return e.json(403,{ok:false,error:'수집기 연결 인증 실패'});
 if(action==='status')return e.json(200,{ok:true,status:status(expire(state(app,col).s,Date.now()))});
 if(action==='rows'){
  var st=state(app,col).s;if(!st.lastCompleteAt)return e.json(200,{ok:true,ready:false});
  var offset=Number(body.offset)||0;if(!isFinite(offset)||offset<0||offset%1000!==0)throw Error('MEMBER_OFFSET_INVALID');
  var compact=body.compact===true,size=compact?4000:1000,list=find(app,col,MEMBERS,size,offset).map(data);
  if(compact){var columns=['이름','휴대폰정규화','휴대폰번호','주소1','주소2','주소3','주소4','우편번호','연령대'];list=list.map(function(d){var out={};columns.forEach(function(k){out[k]=d[k]==null?'':d[k];});if(out['휴대폰정규화'])out['휴대폰번호']='';return out;});}
  return e.json(200,{ok:true,ready:true,version:st.lastJobId,rows:list,next:list.length===size?offset+size:null});
 }
 var result;app.runInTransaction(function(tx){var tc=function(n){return env.col(tx,n,'dev');},st=state(tx,tc),s=st.s,now=new Date().toISOString();
  expire(s,Date.now());var previousPhase=s.phase;
  if(action==='status'){result={ok:true,status:status(s)};return;}
  if(action==='prepare'){if(['opening','awaiting_login','collecting','staging'].indexOf(s.phase)<0){if(s.jobId)find(tx,tc,'_member_stage_'+s.jobId).forEach(function(r){tx.delete(r);});s.jobId='mem_'+Date.now()+'_'+Math.random().toString(36).slice(2,10);s.phase='opening';s.startedAt=now;s.expected=0;s.received=0;s.chunks=[];s.error='';s.message='관리자 로그인 창을 열고 있습니다';}}
  else if(action==='heartbeat'){s.heartbeatAt=now;}
  else if(action==='login-state'){if(s.jobId!==body.jobId)throw Error('MEMBER_JOB_EXPIRED');if(['opening','awaiting_login'].indexOf(s.phase)>=0){s.phase=body.ready===true?'collecting':'awaiting_login';s.message=body.ready===true?'전체 회원 정보를 받고 있습니다':'수집기 창에서 홈페이지 관리자 로그인을 완료해 주세요';}}
  else if(action==='begin'){if(s.jobId!==body.jobId||['collecting','staging'].indexOf(s.phase)<0)throw Error('MEMBER_JOB_EXPIRED');var count=Number(body.count);if(count<1||count>100000||Math.floor(count)!==count)throw Error('MEMBER_COUNT_INVALID');if(s.phase==='staging'&&s.expected!==count)throw Error('MEMBER_COUNT_CHANGED');s.expected=count;s.phase='staging';s.message='회원 정보를 검증하고 반영을 준비합니다';}
  else if(action==='chunk'){if(s.jobId!==body.jobId||s.phase!=='staging')throw Error('MEMBER_JOB_EXPIRED');var idx=Number(body.index),rows=body.rows;if(!Array.isArray(rows)||!rows.length||rows.length>500||Math.floor(idx)!==idx||idx<0)throw Error('MEMBER_CHUNK_INVALID');var sh='_member_stage_'+s.jobId;if(idx<(s.chunks||[]).length){if(s.chunks[idx]!==body.hash)throw Error('MEMBER_CHUNK_CHANGED');result={ok:true,status:status(s)};return;}if(idx!==(s.chunks||[]).length||s.received+rows.length>s.expected)throw Error('MEMBER_CHUNK_ORDER');rows.forEach(function(r){if(!id(r)||!nz(r['이름'])||JSON.stringify(r).length>10000)throw Error('MEMBER_ROW_INVALID');});tx.save(new Record(tc('ymdata'),{sheet:sh,rowIndex:idx+1,data:{index:idx,rows:rows}}));s.chunks.push(nz(body.hash));s.received+=rows.length;s.message=s.received.toLocaleString()+' / '+s.expected.toLocaleString()+'명 준비';}
  else if(action==='commit'){result={ok:true,result:commit(tx,tc,s,body)};}
  else if(action==='failure'){if(s.jobId===body.jobId&&s.phase!=='complete'){s.phase='error';s.error=nz(body.error).slice(0,200);s.message='갱신을 완료하지 못했습니다';find(tx,tc,'_member_stage_'+s.jobId).forEach(function(r){tx.delete(r);});}}
  else throw Error('MEMBER_ACTION_INVALID');if(previousPhase!==s.phase)s.phaseStartedAt=now;save(tx,tc,st);if(!result)result={ok:true,status:status(s)};
 });return e.json(200,result);
}catch(err){return e.json(400,{ok:false,error:nz(err.message||err)});}}
module.exports={handle:handle,normalize:normalize,commit:commit,packed:packed,bulkMembers:bulkMembers,expire:expire};
