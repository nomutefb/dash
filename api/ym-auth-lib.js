// Development-only authentication. No credential values are logged or exported.
var STATE='ym_auth_state_dev', CREDS='ym_auth_credentials_dev', VERSION='email-pin-260907-v1';
var SUPER_ID='r00000000009231', ACCT_ID='r00000000025937', DEV_ADMIN_ID='r00000000049400';
function devAdmin(r){return !!r&&r.id===DEV_ADMIN_ID&&address(data(r))==='contact0030457@example.invalid'&&active(data(r));}
function isSuper(r){return !!r&&(r.id===SUPER_ID||devAdmin(r));}
var WORK=['기관여부','공연여부','전시여부','예술교육여부','대관여부'];
var FLAGS=WORK.concat(['홍보여부','관리자여부','회계여부','계정여부','휴직여부']);
function nz(x){return String(x==null?'':x).trim();}
function flag(x){return /^(true|1|y|yes|o|on|active|✓|✔|활성|예|사용|가능|t)$/i.test(nz(x));}
function jv(x,d){if(x==null)return d;try{if(typeof x.string==='function')return JSON.parse(x.string());if(typeof x==='string')return JSON.parse(x);}catch(e){return d;}return x;}
function data(r){return jv(r.get('data'),{});}
function q(x){return nz(x).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
function first(a,c,f){var rs=a.findRecordsByFilter(c,f,'',1,0);return rs.length?rs[0]:null;}
function state(a,k){var r=first(a,STATE,"key = '"+q(k)+"'");return {r:r,v:r?jv(r.get('value'),{}):{}};}
function put(a,k,v){var s=state(a,k),r=s.r||new Record(a.findCollectionByNameOrId(STATE),{key:k});r.set('value',v);a.save(r);return r;}
function digest(x){return $security.sha256(String(x));}
function allManagers(a){return a.findRecordsByFilter('ymdata_dev',"sheet = 'managers'",'rowIndex',10000,0);}
function manager(a,id){var r=a.findRecordById('ymdata_dev',id);if(nz(r.get('sheet'))!=='managers')throw Error('ACCOUNT_UNAVAILABLE');return r;}
function active(d){return flag(d['계정여부'])&&!flag(d['휴직여부']);}
function address(d){return nz(d['이메일']).toLowerCase();}
function byEmail(a,email){email=nz(email).toLowerCase();if(!email||email.length>254)return null;var rs=allManagers(a).filter(function(r){return address(data(r))===email;});return rs.length===1&&active(data(rs[0]))?rs[0]:null;}
function revision(a,r){var d=data(r);return digest(JSON.stringify([r.id,address(d),FLAGS.map(function(k){return flag(d[k]);}),state(a,'rev:'+r.id).v.n||0,state(a,'company-code').v.n||0]));}
function principal(r){var d=data(r),p={id:r.id,email:address(d),name:nz(d['담당자']),department:nz(d['담당부서']),accountNO:nz(d['계정NO']),devAutoLogin:devAdmin(r),superadmin:isSuper(r),admin:isSuper(r)||flag(d['관리자여부']),accountant:flag(d['회계여부']),flags:{}};FLAGS.forEach(function(k){p.flags[k]=flag(d[k]);});return p;}
function credential(a,id,kind){return first(a,CREDS,"managerId = '"+q(id)+"' && kind = '"+q(kind)+"'");}
function issue(a,r,kind,ttl){var token=$security.randomString(64);put(a,'token:'+digest(token),{kind:kind,managerId:r.id,revision:revision(a,r),expires:Date.now()+ttl});return token;}
function issuePin(a,r,ttl,trustToken){var token=issue(a,r,'pin',ttl),prior=resolve(a,trustToken,'trust');if(prior&&prior.r.id===r.id){var challenge=state(a,'token:'+digest(token));challenge.v.parentTrust=prior.s.r.get('key');put(a,'token:'+digest(token),challenge.v);}return token;}
function resolve(a,token,kind){if(!/^[A-Za-z0-9]{64}$/.test(nz(token)))return null;var s=state(a,'token:'+digest(token));if(!s.r||s.v.kind!==kind||s.v.expires<=Date.now())return null;if(s.v.parentTrust){var parent=state(a,s.v.parentTrust);if(!parent.r||parent.v.kind!=='trust'||parent.v.managerId!==s.v.managerId||parent.v.expires<=Date.now())return null;}try{var r=manager(a,s.v.managerId);if(!active(data(r))||revision(a,r)!==s.v.revision)return null;return {s:s,r:r};}catch(e){return null;}}
function consume(a,token){var s=state(a,'token:'+digest(token));if(s.r){s.v.expires=0;put(a,'token:'+digest(token),s.v);}}
function revoke(a,id){var s=state(a,'rev:'+id);put(a,'rev:'+id,{n:(Number(s.v.n)||0)+1});}
function rate(a,key,limit){var s=state(a,'rate:'+digest(key)),now=Date.now(),v=s.v;if(!v.until||v.until<=now)v={n:0,until:now+15*60000};v.n=(v.n||0)+1;put(a,'rate:'+digest(key),v);return v.n<=limit;}
function validPassword(s){return typeof s==='string'&&s.length>=8&&s.length<=64&&/[a-z]/.test(s)&&/[^a-zA-Z0-9\s]/.test(s);}
function validPin(s){return typeof s==='string'&&/^\d{4}$/.test(s);}
function setCredential(a,r,kind,password){var c=credential(a,r.id,kind)||new Record(a.findCollectionByNameOrId(CREDS),{managerId:r.id,kind:kind});c.setEmail(r.id+'.'+kind+'@auth.example.invalid');c.setPassword(password);a.save(c);}
function pinPassword(id,pin){return 'YM-PIN:'+id+':'+pin;}
function config(a,account){var r=first(a,'ymmeta_dev',"sheet = '_config'"),h=r?jv(r.get('headers'),{}):{};return {lock_minutes:devAdmin(account)?0:typeof h.lock_minutes==='number'?Math.max(0,Math.min(240,h.lock_minutes)):30,auth_required:true,pin_required:!devAdmin(account),company_autofill:state(a,'company-prefill').v.enabled===true,pets_visible:h.pets_visible===true};}
function finish(a,r,remember){return {ok:true,principal:principal(r),session:issue(a,r,'session',12*3600000),trust:remember?issue(a,r,'trust',30*86400000):null,config:config(a,r)};}
function schema(a,name,type,fields,indexes){try{return a.findCollectionByNameOrId(name);}catch(e){}var c=new Collection({name:name,type:type,listRule:null,viewRule:null,createRule:null,updateRule:null,deleteRule:null,authRule:null,manageRule:null,fields:fields,indexes:indexes||[]});if(type==='auth'){c.passwordAuth={enabled:false,identityFields:['email']};c.oauth2={enabled:false};c.otp={enabled:false};c.mfa={enabled:false};}a.save(c);return c;}
function setup(a){
 a.findCollectionByNameOrId('ymdata_dev');a.findCollectionByNameOrId('ymmeta_dev');
 schema(a,STATE,'base',[{name:'key',type:'text',required:true,max:200},{name:'value',type:'json',maxSize:500000}],['CREATE UNIQUE INDEX idx_ym_auth_state_key ON '+STATE+' (key)']);
 schema(a,CREDS,'auth',[{name:'managerId',type:'text',required:true},{name:'kind',type:'text',required:true}],['CREATE UNIQUE INDEX idx_ym_auth_credentials_owner ON '+CREDS+' (managerId,kind)']);
 if(!state(a,'company-prefill').r){var initial='REQUIRES_LOCAL_CONFIGURATION';var current=state(a,'company-code').v.digest||require(__hooks+'/ym-auth-initial-private.js').organizationDigest;if(digest(initial)===current)put(a,'company-prefill',{enabled:true,value:initial});}
 if(state(a,'migration').v.version===VERSION)return;
 a.runInTransaction(function(tx){
  if(state(tx,'migration').v.version===VERSION)return;
  var rs=allManagers(tx),sr=rs.filter(function(r){var d=data(r);return r.id===SUPER_ID&&nz(d['담당자'])==='Avery Reed 08336'&&nz(d['계정NO'])==='807';}),ar=rs.filter(function(r){var d=data(r);return r.id===ACCT_ID&&nz(d['담당자'])==='Cameron Bennett 04518'&&nz(d['담당부서'])==='운영지원팀'&&nz(d['계정NO'])==='801';});
  if(sr.length!==1||ar.length!==1)throw Error('AUTH_MIGRATION_IDENTITY_PRECONDITION');
  var seen={};rs.forEach(function(r){var d=data(r),em=address(d);if(active(d)&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)||seen[em]))throw Error('AUTH_MIGRATION_EMAIL_PRECONDITION');if(active(d))seen[em]=true;});
  var assignments={},typeFlag={'공연':'공연여부','전시':'전시여부','예술교육':'예술교육여부','대관':'대관여부'};
  tx.findRecordsByFilter('ymdata_dev',"sheet = 'ops_프로그램마스터'",'rowIndex',50000,0).forEach(function(r){var d=data(r),f=typeFlag[nz(d['콘텐츠구분'])],owner=nz(d['담당자']);if(f&&/^\d{3,}$/.test(owner)){if(!assignments[owner])assignments[owner]={};assignments[owner][f]=true;}});
  rs.forEach(function(r){var d=data(r);put(tx,'backup:manager:'+r.id,{rowIndex:r.get('rowIndex'),data:d});var n=JSON.parse(JSON.stringify(d));delete n.PIN;delete n['비밀번호'];n['관리자여부']='';n['회계여부']=r.id===ACCT_ID?'1':'';n['홍보여부']='';var assigned=assignments[nz(n['계정NO'])]||{};WORK.forEach(function(f){if(assigned[f])n[f]='1';});if(r.id===SUPER_ID||r.id===ACCT_ID){n['계정여부']='1';n['휴직여부']='';}r.set('data',n);tx.save(r);});
  ['ymdata_dev','ymmeta_dev'].forEach(function(name){var c=tx.findCollectionByNameOrId(name);put(tx,'backup:rules:'+name,{list:c.listRule,view:c.viewRule,create:c.createRule,update:c.updateRule,delete:c.deleteRule});c.listRule=null;c.viewRule=null;c.createRule=null;c.updateRule=null;c.deleteRule=null;tx.save(c);});
  put(tx,'migration',{version:VERSION,managers:rs.length,completedAt:new Date().toISOString()});
 });
}
function ready(a){return state(a,'migration').v.version===VERSION;}
function body(e){return jv((e.requestInfo()||{}).body,{})||{};}
function session(a,e){return resolve(a,nz(e.request.header.get('X-Ym-Session')),'session');}
// YM_PREVIEW_DIRECT_ENTRY_260908: user-authorized development preview only.
// Set false to restore normal sign-in; never publish this development setting.
var DEV_PREVIEW_DIRECT_ENTRY=true;
function previewEntryAllowed(e){
 if(!DEV_PREVIEW_DIRECT_ENTRY)return false;
 var ref=String(e.request.header.get('Referer')||'');
 var origin=String(e.request.header.get('Origin')||'');
 return origin==='https://gscyeulmaru.miso.gs'&&/^https:\/\/gscyeulmaru\.miso\.gs\/service\/coder\/preview\/9b659b4f-08bb-4d94-adb5-57b9cf9be52e\/standalone\.html(?:[?#].*)?$/.test(ref);
}
function handle(e,a,action){
 if(require(__hooks+'/ym-env-lib.js').envOf(e)!=='dev')return e.json(403,{ok:false,error:'개발본 전용입니다'});
 e.response.header().set('Cache-Control','no-store');
 try{
  if(!ready(a))return e.json(503,{ok:false,error:'인증 전환 준비 중입니다'});
  setupDevAdmin(a);
  var b=body(e),result,status=200;
  if(action==='company-prefill'){var pref=state(a,'company-prefill').v;return e.json(200,{ok:true,enabled:pref.enabled===true,value:pref.enabled===true?nz(pref.value):''});}
  if(action==='policy')return e.json(200,{ok:true,config:config(a),version:VERSION});
  if(action==='me'){var ss=session(a,e);return ss?e.json(200,{ok:true,principal:principal(ss.r),config:config(a,ss.r)}):e.json(401,{ok:false,error:'다시 로그인해 주세요'});}
  a.runInTransaction(function(tx){
   var r,c,x,p;
   if(action==='preview-entry'){
    if(!previewEntryAllowed(e)){status=403;result={ok:false,error:'자동 진입을 사용할 수 없는 경로입니다'};return;}
    r=manager(tx,DEV_ADMIN_ID);
    if(!devAdmin(r)){status=403;result={ok:false,error:'개발 관리자 계정을 확인해 주세요'};return;}
    result=finish(tx,r,false);return;
   }
   if(action==='login'){
    var em=nz(b.email).toLowerCase();if(!rate(tx,'ip:'+e.realIP(),120)||!rate(tx,'login:'+em,10)){status=429;result={ok:false,error:'시도가 많습니다. 15분 후 다시 시도해 주세요'};return;}
    if(typeof b.companyCode!=='string'||digest(b.companyCode)!==(state(tx,'company-code').v.digest||require(__hooks+'/ym-auth-initial-private.js').organizationDigest)){status=401;result={ok:false,error:'회사코드를 확인해 주세요'};return;}
    r=byEmail(tx,em);c=r?credential(tx,r.id,'password'):null;
    var ok=r&&typeof b.password==='string'&&b.password.length<=128&&(c?c.validatePassword(b.password):digest(b.password)===require(__hooks+'/ym-auth-initial-private.js').digest);
    if(!ok){status=401;result={ok:false,error:'이메일 또는 비밀번호를 확인해 주세요'};return;}
    var kind=c?(credential(tx,r.id,'pin')?'pin':'reset-pin'):(credential(tx,r.id,'pin')?'reset-password':'enroll');result={ok:true,stage:kind,challenge:issue(tx,r,kind,5*60000),email:address(data(r))};return;
   }
   if(action==='resume'){x=resolve(tx,b.trust,'trust');if(!x||!credential(tx,x.r.id,'password')||!credential(tx,x.r.id,'pin')){status=401;result={ok:false,error:'이메일과 비밀번호로 로그인해 주세요'};return;}if(devAdmin(x.r)){result=finish(tx,x.r,false);return;}result={ok:true,stage:'pin',challenge:issuePin(tx,x.r,5*60000,b.trust),email:address(data(x.r))};return;}
   if(action==='enroll'){
    x=resolve(tx,b.challenge,'enroll');if(!x||credential(tx,x.r.id,'password')){status=401;result={ok:false,error:'처음부터 로그인해 주세요'};return;}
    if(!validPassword(b.password)||b.password!==b.confirmPassword||!validPin(b.pin)||(b.confirmPin!==undefined&&b.pin!==b.confirmPin)){status=400;result={ok:false,error:'소문자·특수문자 포함 8자 이상 비밀번호와 4자리 PIN의 확인값을 확인해 주세요'};return;}
    if(digest(b.password)===require(__hooks+'/ym-auth-initial-private.js').digest){status=400;result={ok:false,error:'초기 비밀번호와 다른 개인 비밀번호를 설정해 주세요'};return;}
    setCredential(tx,x.r,'password',b.password);setCredential(tx,x.r,'pin',pinPassword(x.r.id,b.pin));consume(tx,b.challenge);revoke(tx,x.r.id);result=finish(tx,x.r,b.remember===true);return;
   }
   if(action==='set-reset-password'){
    x=resolve(tx,b.challenge,'reset-password');if(!x||credential(tx,x.r.id,'password')||!credential(tx,x.r.id,'pin')){status=401;result={ok:false,error:'처음부터 로그인해 주세요'};return;}
    if(!validPassword(b.password)||b.password!==b.confirmPassword||digest(b.password)===require(__hooks+'/ym-auth-initial-private.js').digest){status=400;result={ok:false,error:'새 비밀번호와 확인값을 확인해 주세요'};return;}
    setCredential(tx,x.r,'password',b.password);consume(tx,b.challenge);revoke(tx,x.r.id);result={ok:true,stage:'pin',email:address(data(x.r)),challenge:issue(tx,x.r,'pin',5*60000)};return;
   }
   if(action==='set-reset-pin'){
    x=resolve(tx,b.challenge,'reset-pin');if(!x||credential(tx,x.r.id,'pin')){status=401;result={ok:false,error:'이메일과 비밀번호로 다시 로그인해 주세요'};return;}
    if(!validPin(b.pin)||(b.confirmPin!==undefined&&b.pin!==b.confirmPin)){status=400;result={ok:false,error:'4자리 PIN과 확인값을 확인해 주세요'};return;}
    setCredential(tx,x.r,'pin',pinPassword(x.r.id,b.pin));consume(tx,b.challenge);revoke(tx,x.r.id);result=finish(tx,x.r,b.remember===true);return;
   }
   if(action==='pin'){
    x=resolve(tx,b.challenge,'pin');if(!x){status=401;result={ok:false,error:'인증 시간이 만료되었습니다. 다시 로그인해 주세요'};return;}
    if(!rate(tx,'pin:'+x.r.id,10)){status=429;result={ok:false,error:'PIN 시도가 많습니다. 15분 후 다시 시도해 주세요'};return;}
    c=credential(tx,x.r.id,'pin');if(!validPin(b.pin)||!c||!c.validatePassword(pinPassword(x.r.id,b.pin))){status=401;result={ok:false,error:'PIN을 확인해 주세요',retryPin:true};return;}
    if(x.s.v.parentTrust){var previous=state(tx,x.s.v.parentTrust);if(previous.r){previous.v.expires=0;put(tx,x.s.v.parentTrust,previous.v);}}
    consume(tx,b.challenge);result=finish(tx,x.r,b.remember===true);return;
   }
   x=session(tx,e);
   if(action==='logout'){if(x)consume(tx,nz(e.request.header.get('X-Ym-Session')));if(b.trust)consume(tx,b.trust);result={ok:true};return;}
   if(!x){status=401;result={ok:false,error:'다시 로그인해 주세요'};return;}
   if(action==='set-company-prefill'){
    if(!isSuper(x.r)){status=403;result={ok:false,error:'슈퍼관리자만 설정할 수 있습니다'};return;}
    if(typeof b.enabled!=='boolean'){status=400;result={ok:false,error:'설정값을 확인해 주세요'};return;}
    var pref=state(tx,'company-prefill').v;if(b.enabled&&!/^\d{6}$/.test(nz(pref.value))){status=400;result={ok:false,error:'회사코드를 먼저 설정해 주세요'};return;}pref.enabled=b.enabled;put(tx,'company-prefill',pref);result={ok:true,enabled:pref.enabled};return;
   }
   if(action==='set-company-code'){
    if(!isSuper(x.r)){status=403;result={ok:false,error:'슈퍼관리자만 회사코드를 변경할 수 있습니다'};return;}
    if(typeof b.companyCode!=='string'||!/^\d{6}$/.test(b.companyCode)||b.companyCode!==b.confirmCompanyCode){status=400;result={ok:false,error:'회사코드 6자리와 확인값을 확인해 주세요'};return;}
    var pref=state(tx,'company-prefill').v;pref.value=b.companyCode;put(tx,'company-prefill',pref);var oldCode=state(tx,'company-code').v;put(tx,'company-code',{digest:digest(b.companyCode),n:(Number(oldCode.n)||0)+1,changedBy:x.r.id,changedAt:new Date().toISOString()});result={ok:true,reauthenticate:true};return;
   }
   if(action==='lock'){consume(tx,nz(e.request.header.get('X-Ym-Session')));if(devAdmin(x.r)){result=finish(tx,x.r,false);return;}result={ok:true,challenge:issuePin(tx,x.r,12*3600000,b.trust),email:address(data(x.r))};return;}
   if(action==='reset-pin'||action==='reset-password'){
    var actor=principal(x.r);if(!actor.superadmin){status=403;result={ok:false,error:'슈퍼관리자 권한이 필요합니다'};return;}
    r=b.targetId?manager(tx,b.targetId):byEmail(tx,b.targetEmail);
    if(!r||r.id===SUPER_ID||r.id===x.r.id){status=403;result={ok:false,error:'해당 계정은 초기화할 수 없습니다'};return;}
    var target=principal(r);if(!actor.superadmin&&(target.admin||target.accountant||target.flags['홍보여부'])){status=403;result={ok:false,error:'보호된 계정은 슈퍼관리자만 초기화할 수 있습니다'};return;}
    var resetKind=action==='reset-password'?'password':'pin';c=credential(tx,r.id,resetKind);if(c)tx.delete(c);revoke(tx,r.id);put(tx,resetKind+'-reset:'+r.id,{required:true,actor:x.r.id,at:new Date().toISOString()});result={ok:true};return;
   }
   status=404;result={ok:false,error:'지원하지 않는 인증 요청입니다'};
  });return e.json(status,result);
 }catch(err){return e.json(500,{ok:false,error:'인증 처리에 실패했습니다. 다시 시도해 주세요'});}
}
function safeManagers(e,a){var rs=allManagers(a),meta=first(a,'ymmeta_dev',"sheet = 'managers'"),headers=meta?jv(meta.get('headers'),[]):[];headers=headers.filter(function(k){return !/^(PIN|비밀번호)$/i.test(k);});if(headers.indexOf('계정NO')<0)headers.push('계정NO');return e.json(200,{headers:headers,rows:rs.map(function(r){var d=data(r),o={_rowIndex:r.get('rowIndex'),_id:r.id,_superadmin:isSuper(r),_pinConfigured:!!credential(a,r.id,'pin'),_passwordConfigured:!!credential(a,r.id,'password')};headers.forEach(function(k){o[k]=d[k]==null?'':d[k];});return o;})});}
function managerWrite(e,a,method,rowIndex){
 var only=session(a,e);if(!only||!isSuper(only.r))return e.json(403,{ok:false,error:'사용자 관리는 슈퍼관리자만 가능합니다'});
 var ss=session(a,e);if(!ss)return e.json(401,{ok:false,error:'로그인이 필요합니다'});var actor=principal(ss.r),b=body(e),v=b.values;
 if(!v||typeof v!=='object'||Array.isArray(v)||b.headers)return e.json(400,{ok:false,error:'사용자 필드명 기반 요청이 필요합니다'});
 if(method==='DELETE')return e.json(403,{ok:false,error:'사용자 삭제 대신 활성 계정을 해제해 주세요'});
 var result,status=200;
 try{a.runInTransaction(function(tx){
  var r=method==='PATCH'?first(tx,'ymdata_dev',"sheet = 'managers' && rowIndex = "+Number(rowIndex)):null;if(method==='PATCH'&&!r)throw Error('사용자를 찾을 수 없습니다');var old=r?data(r):{},n=JSON.parse(JSON.stringify(old));
  var keys=Object.keys(v),allowed=['담당자','담당부서','직위','이메일'].concat(FLAGS);
  keys.forEach(function(k){if(k==='PIN'||k==='비밀번호'||k==='계정NO'||k.charAt(0)==='_')return;if(allowed.indexOf(k)<0)throw Error('지원하지 않는 사용자 필드');if(String(v[k]==null?'':v[k])===String(old[k]==null?'':old[k]))return;if(!actor.superadmin&&(!actor.admin||!r||r.id===SUPER_ID||WORK.indexOf(k)<0))throw Error('슈퍼관리자만 변경할 수 있는 항목입니다');n[k]=FLAGS.indexOf(k)>=0?(flag(v[k])?'1':''):nz(v[k]);});
  if(!actor.superadmin&&!actor.admin)throw Error('권한이 없습니다');if(!r&&!actor.superadmin)throw Error('슈퍼관리자만 사용자를 등록할 수 있습니다');
  n['이메일']=address(n);if(!nz(n['담당자'])||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n['이메일']))throw Error('이름과 이메일을 확인해 주세요');
  if(r&&r.id===SUPER_ID&&(!active(n)||n['이메일']!==address(old)||n['담당자']!==old['담당자']||flag(n['관리자여부'])))throw Error('고정 슈퍼관리자의 계정과 권한은 변경할 수 없습니다');
  allManagers(tx).forEach(function(other){if(r&&other.id===r.id)return;var d=data(other);if(address(d)===n['이메일']||nz(d['담당자'])===nz(n['담당자']))throw Error('동일한 이름 또는 이메일이 이미 등록되어 있습니다');});
  delete n.PIN;delete n['비밀번호'];
  if(!r){var meta=first(tx,'ymmeta_dev',"sheet = 'managers'");if(!meta)throw Error('사용자 메타데이터 누락');var next=Number(meta.get('nextRowIndex'))||2;var nums=allManagers(tx).map(function(m){return Number(data(m)['계정NO'])||0;});n['계정NO']=String(Math.max.apply(Math,[0].concat(nums))+1).padStart(3,'0');r=new Record(tx.findCollectionByNameOrId('ymdata_dev'),{sheet:'managers',rowIndex:next});meta.set('nextRowIndex',next+1);meta.set('rowCount',(Number(meta.get('rowCount'))||0)+1);tx.save(meta);}
  r.set('data',n);tx.save(r);if(address(old)!==address(n)||active(old)!==active(n))revoke(tx,r.id);result={ok:true,rowIndex:r.get('rowIndex')};
 });return e.json(status,result);}catch(err){return e.json(403,{ok:false,error:nz(err.message)});}
}
function businessAllowed(p,field){if(p.superadmin||p.admin)return true;var key={'공연':'공연여부','기획 공연':'공연여부','전시':'전시여부','기획 전시':'전시여부','교육':'예술교육여부','예술교육':'예술교육여부','예술 교육':'예술교육여부'}[nz(field)];return !!key&&p.flags[key]===true;}
function businessWriteAllowed(a,p,path,b){
 if(p.superadmin||p.admin)return true;
 var rows=a.findRecordsByFilter('ymdata_dev',"sheet = 'ops_프로그램마스터'",'',50000,0).map(data);
 function find(k,v){return rows.filter(function(d){return nz(d[k])===nz(v);})[0];}
 var biz=b['사업코드']?find('사업코드',b['사업코드']):null;if(biz&&nz(biz['구분'])!=='사업')biz=rows.filter(function(d){return nz(d['구분'])==='사업'&&nz(d['사업코드'])===nz(b['사업코드']);})[0];
 var prog=b['프로그램ID']?find('프로그램ID',b['프로그램ID']):null;
 if(prog&&!businessAllowed(p,prog['표시_분야']))return false;
 if(biz&&!businessAllowed(p,biz['표시_분야']))return false;
 if(/\/biz$/.test(path))return businessAllowed(p,b['분야']||(biz&&biz['표시_분야']));
 if(/\/program$/.test(path)){if(!biz&&prog)biz=rows.filter(function(d){return nz(d['구분'])==='사업'&&nz(d['사업코드'])===nz(prog['사업코드']);})[0];return !!biz&&businessAllowed(p,biz['표시_분야']);}
 return !!(biz||prog)&&businessAllowed(p,(biz||prog)['표시_분야']);
}
function promoWriteAllowed(a,p,path,method,b,physical){
 if(p.superadmin||p.admin||p.flags['홍보여부'])return true;
 var R=require(__hooks+'/ym-records-lib.js'),col=function(n){return n+'_dev';},incoming=physical?b:R.toTable(a,col,R.fromBody(b));
 var idx=Number(path.split('/').pop()),rec=idx?first(a,'ymdata_dev',"sheet = 'ops_캘린더' && rowIndex = "+idx):null,old=rec?data(rec):null;
 if(old&&nz(old['구분'])!=='홍보')return false;
 var mine=old&&nz(old['작성자'])===p.accountNO,next=nz(incoming['상태']),prior=old?nz(old['상태']):'';
 if(!old){return method==='POST'&&nz(incoming['작성자'])===p.accountNO&&['','초안','임시','임시저장','신청 중'].indexOf(next)>=0;}
 if(!mine)return false;
 if(method==='DELETE')return ['초안','임시','임시저장','신청 중','보류','취소'].indexOf(prior)>=0;
 if(incoming['작성자']!==undefined&&nz(incoming['작성자'])!==p.accountNO)return false;
 if(incoming['담당자']!==undefined&&nz(incoming['담당자'])!==nz(old['담당자']))return false;
 if(prior==='예정'){
  if(next!=='완료')return false;
  return Object.keys(incoming).every(function(k){return ['상태','결과링크','결과첨부URL','결과비고'].indexOf(k)>=0||nz(incoming[k])===nz(old[k]);});
 }
 if(['완료'].indexOf(prior)>=0)return false;
 return ['','초안','임시','임시저장','신청 중','취소'].indexOf(next)>=0;
}

function rawBusinessAllowed(a,p,old,row,method,sheet){
 if(p.superadmin||p.admin)return true;
 var merged=Object.assign({},old||{},row||{}),before=old&&(old['표시_분야']||old['콘텐츠구분']),after=merged['표시_분야']||merged['콘텐츠구분'];
 if(sheet==='사업비'&&p.accountant&&old&&method!=='DELETE')return ['프로그램ID','사업코드','분야','표시_분야','콘텐츠구분','구분'].every(function(k){return row[k]===undefined||nz(row[k])===nz(old[k]);});
 if(old&&!businessAllowed(p,before))return false;if(!businessAllowed(p,after))return false;
 if(merged['사업코드'])return businessWriteAllowed(a,p,'/api/ym/plan/program',{'사업코드':merged['사업코드'],'프로그램ID':old?old['프로그램ID']:''});
 return true;
}
function rawOpsAllowed(a,p,path,method,b,sheet){
 if(p.superadmin||p.admin)return true;
 if(['프로그램마스터','사업비','판매설정','캘린더'].indexOf(sheet)<0)return true;
 var physical=sheet==='캘린더'?'ops_캘린더':'ops_프로그램마스터',records=a.findRecordsByFilter('ymdata_dev',"sheet = '"+physical+"'",'',50000,0);
 function existing(k,v){return records.filter(function(r){return nz(data(r)[k])===nz(v);})[0];}
 function check(rec,row){var old=rec?data(rec):null;if(sheet!=='캘린더')return rawBusinessAllowed(a,p,old,row,method,sheet);if(nz(row['구분']||b.part||(old&&old['구분']))!=='홍보'&&!(old&&nz(old['구분'])==='홍보'))return true;return promoWriteAllowed(a,p,'/api/records'+(rec?'/'+rec.get('rowIndex'):''),rec?(method==='DELETE'?'DELETE':'PATCH'):'POST',row,true);}
 if(/\/ops\/row$/.test(path)){var rec=method==='POST'?null:existing(nz(b.keyCol)==='사업NO'?'프로그램ID':nz(b.keyCol),b.key);if(method!=='POST'&&!rec)return false;return check(rec,b.row||b.patch||{});}
 if(b.mode!=='append'&&b.mode!=='upsert')return false;
 if(!Array.isArray(b.rows))return false;
 return b.rows.every(function(row){if(!row||Array.isArray(row)||typeof row!=='object')return false;var key=sheet==='캘린더'?'일정ID':'프로그램ID',rec=row[key]?existing(key,row[key]):null;return check(rec,row);});
}

function guard(e,a){
 var path=String(e.request.url.path||''),method=String(e.request.method||'GET');
 // Private collections have locked API rules; built-in dashboard authentication stays independent.
 if(path.indexOf('/api/collections/')===0||path.indexOf('/api/health')===0||path.indexOf('/api/realtime')===0)return e.next();
 if(path.indexOf('/api/')!==0||require(__hooks+'/ym-env-lib.js').envOf(e)!=='dev')return e.next();
 if(path.indexOf('/api/ym/auth/')===0)return e.next();
 if(/^\/api\/ym\/ticketlink\/(?:heartbeat|claim|apply|failure|reconcile|worker-settings|login-state|member-heartbeat|member-login-state|member-begin|member-chunk|member-commit|member-failure)$/.test(path))return e.next();
 if(path.indexOf('/api/auth/')===0)return e.json(410,{ok:false,error:'이메일 로그인 화면을 이용해 주세요'});
 var ss=session(a,e);if(!ss)return e.json(401,{ok:false,error:'이메일 로그인과 PIN 인증이 필요합니다'});
 e.response.header().set('Cache-Control','no-store');var p=principal(ss.r);
 if((/^\/api\/ym\/(?:env\/|migrate(?:\/|$)|migrations(?:\/|$))|^\/api\/ym-db\//.test(path)&&!p.superadmin)||(/^\/api\/ym\/codes\//.test(path)&&!p.admin&&!p.superadmin))return e.json(403,{ok:false,error:'시스템 관리는 슈퍼관리자만 가능합니다'});
 if(/^\/api\/sheet\/(manager|managers)(\/|$)/.test(path)){
  if(method==='GET')return safeManagers(e,a);return managerWrite(e,a,method,path.split('/').pop());
 }
 if(method!=='GET'&&/^\/api\/(?:ym\/)?config$/.test(path)){
  var b=body(e);if(!p.superadmin)return e.json(403,{ok:false,error:'보안 설정은 슈퍼관리자만 변경할 수 있습니다'});
  if(b.auth_required===false||b.lock_minutes!==undefined&&(!Number.isInteger(b.lock_minutes)||b.lock_minutes<0||b.lock_minutes>240))return e.json(400,{ok:false,error:'PIN 인증은 항상 필수이며 잠금 시간은 0~240분 정수입니다'});
 }
 var customerRead=method==='POST'&&/^\/api\/ym\/ticketlink\/member-(?:search|booking|rows)$/.test(path);
 if(/^\/api\/ym\/ticketlink\//.test(path)&&!customerRead&&!p.superadmin&&!p.admin&&!p.accountant)return e.json(403,{ok:false,error:'담당 권한이 필요합니다'});
 var info=e.requestInfo()||{},payload=body(e),query=info.query||{},sheet=nz(payload.sheet||query.sheet).replace(/^ops_/,'').replace(/[()\s]/g,'');
 var finance=p.superadmin||p.admin||p.accountant,admin=p.superadmin||p.admin;
 if(method!=='GET'&&/^\/api\/ops(?:\/|$)/.test(path)&&!rawOpsAllowed(a,p,path,method,payload,sheet))return e.json(403,{ok:false,error:'사업 분야 또는 홍보 관리 권한이 필요합니다'});
 if((/^\/api\/ym\/plan\/settle$/.test(path)||method!=='GET'&&sheet==='사업비')&&!finance)return e.json(403,{ok:false,error:'회계 권한이 필요합니다'});
 if(((/^(회원|예매)$/.test(sheet)&&method!=='GET')||(/^\/api\/ym\/ticketlink\/member-/.test(path)&&!customerRead))&&!admin)return e.json(403,{ok:false,error:'고객 관리 권한이 필요합니다'});
 if(method!=='GET'&&/^\/api\/ym\/plan\/(?:biz|program|delete)$/.test(path)&&!businessWriteAllowed(a,p,path,payload))return e.json(403,{ok:false,error:'해당 분야 사업 담당 권한이 필요합니다'});
 if(method!=='GET'&&/^\/api\/sheet\/(?:platform|content|applysettings)(?:\/|$)/.test(path)&&!p.superadmin&&!p.admin&&!p.flags['홍보여부'])return e.json(403,{ok:false,error:'홍보 관리 권한이 필요합니다'});

 if(method!=='GET'&&/^\/api\/records(?:\/|$)/.test(path)&&!promoWriteAllowed(a,p,path,method,payload))return e.json(403,{ok:false,error:'홍보 승인·타인 일정 관리는 홍보 권한이 필요합니다'});
 return e.next();
}

function setupDevAdmin(a){
 var marker='dev-admin-account-260908';if(state(a,marker).v.done)return;
 a.runInTransaction(function(tx){
  if(state(tx,marker).v.done)return;
  var rows=allManagers(tx);if(rows.some(function(r){return r.id===DEV_ADMIN_ID||address(data(r))==='contact0030457@example.invalid';}))throw Error('DEV_ADMIN_IDENTITY_COLLISION');
  try{tx.findRecordById('ymdata_dev',DEV_ADMIN_ID);throw Error('DEV_ADMIN_ID_COLLISION');}catch(e){if(String(e.message).indexOf('DEV_ADMIN_ID_COLLISION')>=0)throw e;}
  var meta=first(tx,'ymmeta_dev',"sheet = 'managers'");if(!meta)throw Error('MANAGERS_META_MISSING');
  var next=Math.max(Number(meta.get('nextRowIndex'))||2,rows.reduce(function(n,r){return Math.max(n,Number(r.get('rowIndex'))+1);},2));
  var no=String(rows.reduce(function(n,r){return Math.max(n,Number(data(r)['계정NO'])||0);},0)+1).padStart(3,'0');
  var d={'담당자':'Rowan Ellis 22959','담당부서':'개발','직위':'개발용','이메일':'contact0030457@example.invalid','계정NO':no};FLAGS.forEach(function(k){d[k]=k==='휴직여부'?'':'1';});
  var rec=new Record(tx.findCollectionByNameOrId('ymdata_dev'),{id:DEV_ADMIN_ID,sheet:'managers',rowIndex:next,data:d});tx.save(rec);
  meta.set('nextRowIndex',next+1);meta.set('rowCount',rows.length+1);tx.save(meta);put(tx,marker,{done:true,at:new Date().toISOString(),managerId:DEV_ADMIN_ID});
 });
}
module.exports={setup:function(a){setup(a);setupDevAdmin(a);},handle:handle,guard:guard,validPassword:validPassword,validPin:validPin,flag:flag};
