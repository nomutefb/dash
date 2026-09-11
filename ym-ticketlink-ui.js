/* Development collector UI. No seller credentials or worker keys in this file. */
(function(){
 'use strict';
 if(location.pathname.indexOf('/service/coder/preview/')!==0)return;
 var base=location.pathname.match(/^(\/service\/coder\/preview\/[^/]+\/)/)[1]+'__runtime';
 var state=null,seenBatch='',polling=false,error='',refreshing=false,submitting=false,requestBaseline=null,statusEpoch=0;
 var phaseNames={opening:'수집기 창 여는 중',awaiting_login:'셀러 로그인 대기',login_ready:'로그인 확인 · 전송 대기',starting:'연결 중',connecting:'로그인 상태 확인 중',payco_login:'PAYCO 로그인 중',seller_auth:'셀러 인증 중',window_select:'창구 선택 중',product_list:'판매중 상품 확인 중',sales_query:'판매 실적 조회 중',applying:'웹앱에 실적 반영 중',login_required:'로그인 연결 확인 필요',credentials_required:'계정 설정 또는 추가 인증 필요',queued:'수집 대기',collecting:'판매 데이터 수집 중',validating:'이전 실적과 비교 중',idle:'갱신 완료',partial:'갱신 완료 · 확인할 항목 있음',error:'갱신 실패',offline:'연결 끊김'};
 async function request(action,body){var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},20000);try{var response=await fetch(base+'/api/ym/ticketlink/'+action,{method:'POST',credentials:'include',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json','X-Ym-Env':'dev'},body:JSON.stringify(body||{})});var data;try{data=await response.json();}catch(e){throw Error('MISO_CONNECTION_FAILED');}if(!response.ok||data.ok===false)throw Error(data.error||'MISO_HTTP_'+response.status);return data;}catch(e){if(e.name==='AbortError')throw Error('MISO_TIMEOUT');throw e;}finally{clearTimeout(timer);}}
 function age(value){if(!value)return '갱신 기록 없음';var mins=Math.max(0,Math.floor((Date.now()-Date.parse(value))/60000));return mins<1?'방금 갱신':mins<60?mins+'분 전 갱신':mins<1440?Math.floor(mins/60)+'시간 전 갱신':Math.floor(mins/1440)+'일 전 갱신';}
 function text(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 function online(){return !!state&&state.phase!=='offline'&&Date.now()-Date.parse(state.heartbeatAt||'')<90000;}
 function stalled(){var s=state||{},age=function(v){var n=Date.parse(v||'');return isFinite(n)?Date.now()-n:Infinity;};if(s.active)return age(s.heartbeatAt)>=90000?'COLLECTOR_DISCONNECTED':age(s.active.startedAt)>=900000?'COLLECTION_TIMEOUT':'';if(s.phase==='queued'&&age(s.requestAt)>=60000)return 'COLLECTOR_REQUEST_TIMEOUT';if(s.phase==='opening'&&age(s.progressAt)>=60000)return 'COLLECTOR_OPEN_TIMEOUT';return '';}
 function busy(){return !stalled()&&!!(state&&(state.active||state.phase==='queued'));}
 function completed(){return !!(state&&state.lastAppliedAt&&!state.active&&!state.lastError&&['idle','partial'].indexOf(state.phase)>=0);}
 function statusLabel(){return stalled()?'갱신 중단 · 연결 확인 필요':error?'수집기 상태 확인 실패':!state?'수집기 연결 확인 중':!online()?'수집기 연결 끊김':(phaseNames[state.phase]||'연결됨');}
 function draw(){
  var badge=document.getElementById('sales-asof-badge');if(badge){
  var host=document.getElementById('ym-ticketlink-controls');if(!host){host=document.createElement('span');host.id='ym-ticketlink-controls';badge.insertAdjacentElement('afterend',host);host.innerHTML='<button type="button" class="ym-ui-button" data-ui-density="compact" id="ym-ticketlink-status" aria-label="판매 데이터 갱신 상태"></button>';host.querySelector('button').onclick=function(){open(false);};}
  var label=age(state&&state.lastAppliedAt);
  var dot=online()?(state.phase==='login_required'||state.phase==='credentials_required'||state.phase==='error'?'warning':'success'):'offline';
  var status=host.querySelector('#ym-ticketlink-status');status.innerHTML='<span class="ym-tl-dot" data-ui-state="'+dot+'"></span>판매 데이터 · '+text(label);status.title=statusLabel()+(state&&state.lastAppliedAt?' · '+new Date(state.lastAppliedAt).toLocaleString('ko-KR'):'');status.setAttribute('aria-label',status.title+' · '+label);
  if(state&&state.lastAppliedAt)badge.style.display='none';
  }
  var detail=document.getElementById('ym-ticketlink-detail');if(detail){var expanded={};detail.querySelectorAll('details[open]').forEach(function(d){expanded[d.dataset.section]=true;});detail.innerHTML=detailHtml();detail.querySelectorAll('details').forEach(function(d){d.open=!!expanded[d.dataset.section];});updateClocks();}
  var retry=document.getElementById('ym-tl-request');if(retry){retry.disabled=submitting||busy();retry.textContent=state&&state.preparationId?'수집기 다시 열기':'수집기 열기';}var send=document.getElementById('ym-tl-send');if(send){send.textContent=completed()?'확인':'전송';send.disabled=completed()?false:submitting||busy()||!!stalled()||!!error||!online()||!state.openedAt||state.loginReady!==true||state.workerProtocol!==2;}
  ['ym-tl-group','ym-tl-settings'].forEach(function(id){var b=document.getElementById(id);if(b)b.disabled=submitting||busy();});
  mountAction();
  var action=document.getElementById('ym-ticketlink-open');if(action)action.textContent=busy()?'갱신 중 · 진행 보기':'실적 갱신';
 }
 function mountAction(){
  // Sales refresh is available from the sales menu; remove the duplicate panel action.
  var action=document.getElementById('ym-ticketlink-open');if(action)action.remove();
 }
 function detailHtml(){
  var s=state||{},r=s.lastResult||{},issues=r.issues||[],records=r.records||[];
  var h='<p class="ym-tl-state" role="status">'+text(statusLabel())+'</p>';
  if(completed())h+='<p class="ym-tl-complete">실적 반영이 완료되었습니다. 아래 <strong>확인</strong>을 누르면 창이 닫힙니다. 추가 전송은 필요하지 않습니다.</p>';
  if(!completed()&&!s.active&&s.phase!=='queued'){h+='<ol class="ym-tl-manual"><li>수집기 열기를 누르고 로그인하기</li><li>수집기에서 PAYCO → 셀러 인증 → 창구 선택</li><li>미소로 돌아와 <strong>전송</strong> 누르기</li></ol>';if(['opening','awaiting_login','login_ready'].indexOf(s.phase)>=0)h+='<div class="ym-tl-live"><span class="ym-tl-pulse"></span><span>'+text(s.stageMessage||'수집기 응답을 기다리고 있습니다.')+'</span><span data-tl-clock="heartbeat" data-at="'+text(s.heartbeatAt)+'"></span></div>';h+='<p class="ym-tl-subtle ym-ui-meta">전송 전에는 판매 데이터를 수집하거나 변경하지 않습니다. 이미 로그인되어 있으면 바로 전송하세요.</p>'; }
  if(busy()){
   var phases=['로그인','판매 조회','단체 좌석','검증','반영'],pg=s.collectionProgress||{},idx={connecting:0,payco_login:0,seller_auth:0,window_select:0,product_list:1,collecting:1,sales_query:pg.stage==='group'?2:1,validating:3,applying:4}[s.phase];if(idx===undefined)idx=-1;
   h+='<ol class="ym-tl-steps ym-ui-steps">'+phases.map(function(name,i){return '<li class="'+(i<idx?'done':i===idx?'current':'')+'"><span>'+(i<idx?'✓':i+1)+'</span>'+name+'</li>';}).join('')+'</ol><p>'+text(s.stageMessage||'수집기 응답을 기다리고 있습니다.')+'</p><div class="ym-tl-live"><span class="ym-tl-pulse"></span><span data-tl-clock="elapsed" data-at="'+text(s.active?s.active.startedAt:s.requestAt)+'"></span><span data-tl-clock="heartbeat" data-at="'+text(s.heartbeatAt)+'"></span></div><p class="ym-tl-subtle ym-ui-meta">이 갱신 창을 닫거나 메뉴를 이동해도 수집은 계속됩니다. 미소 브라우저 탭과 수집기 창은 열어 두세요. 미소 탭을 닫거나 PC가 절전되면 연결이 끊길 수 있습니다. 다시 접속한 뒤 진행 상태와 마지막 반영 시각을 먼저 확인하세요.</p>';
  }
  h+=collectionInfo(s,completed());
  var problem=stalled()||error||s.lastError;
  if(problem||!online()){var info=recovery(problem,s);h+='<div class="ym-tl-recovery"><strong>'+text(info.title)+'</strong><p>'+text(info.help)+'</p>'+(problem?'<details data-section="error"><summary>오류 세부 정보</summary><code>'+text(problem)+'</code></details>':'')+'</div>';}
  h+='<dl><dt>마지막 반영</dt><dd>'+text(s.lastAppliedAt?new Date(s.lastAppliedAt).toLocaleString('ko-KR'):'아직 없음')+'</dd><dt>갱신 방식</dt><dd>수동 전송 · 교육실 대관 제외</dd></dl>';
  var currentResult=requestBaseline!==null&&s.lastBatchId&&s.lastBatchId!==requestBaseline&&!busy()&&!s.lastError;
  if(records.length&&!currentResult)h+='<details class="ym-tl-history" data-section="history"><summary>이전 갱신 내역 · '+text(s.lastAppliedAt?new Date(s.lastAppliedAt).toLocaleString('ko-KR'):'반영 시각 없음')+'</summary>';
  if(records.length){
   var comparable=records.every(function(x){return typeof x.changed==='boolean';}),changed=records.filter(function(x){return x.changed!==false;}),same=records.filter(function(x){return x.changed===false;});
   if(currentResult)h+='<p class="ym-tl-complete" role="status"><strong>'+(changed.length?'반영 완료 · 변경된 프로그램 '+changed.length+'개':'갱신 완료 · 변동 사항 없음')+'</strong></p>';h+='<div class="ym-tl-result"><strong>'+(s.active||problem?'직전 갱신 결과':!comparable?'마지막 반영 내역':changed.length?'변경된 프로그램 '+changed.length+'개':'변동 사항 없음')+'</strong><p class="ym-tl-subtle ym-ui-meta">'+(!comparable?'다음 갱신부터 이전 실적과의 증감을 표시합니다.':changed.length?'판매 수입과 유료·무료 매수의 변동을 표시합니다.':'판매중 상품을 확인했습니다. 실적 값은 유지하고 갱신 시각을 업데이트했습니다.')+'</p>';
   if(changed.length)h+=resultTable(changed,true);
   if(same.length)h+='<details data-section="unchanged"><summary>변동 없는 프로그램 '+same.length+'개</summary>'+resultTable(same,false)+'</details>';
   h+='</div>';
  }
  if(issues.length)h+='<details class="ym-tl-issues" data-section="issues"><summary>확인이 필요한 항목 '+issues.length+'개</summary><p>집계가 확인되지 않은 항목의 기존 실적은 유지했습니다.</p><ul>'+issues.map(function(x){return '<li>'+text(x.name)+': '+text(x.reason)+'</li>';}).join('')+'</ul></details>';
  if(records.length&&!currentResult)h+='</details>';
  h+='<p class="ym-tl-subtle ym-ui-meta">정산 전에는 판매 누계가 프로그램 수입에 반영되며, 정산 저장 후에는 정산 수입이 우선합니다.</p>';
  return h;
 }
 function collectionInfo(s,done){
  var p=s.collectionProgress||{},h='<p class="ym-ui-meta">판매 보고서와 공연 회차별 단체 좌석을 함께 조회합니다. 개인 인원은 판매 보고서에서 결제 완료 단체를 제외해 계산하고, 결제 예정 단체는 별도로 합산합니다.</p>';
  if(s.active&&p.stage==='group'&&p.total>0){var n=Math.min(p.total,p.done||0);h+='<p class="ym-ui-meta">단체 좌석 조회 '+Math.floor(n/p.total*100)+'% · 공연 '+n+'/'+p.total+'개 · '+Number(p.rounds||0).toLocaleString()+'회차 확인 (DB 반영 전)</p>';}
  if(s.active&&p.personalCount!==undefined)h+='<p class="ym-ui-meta">확인한 공연: 개인 '+Number(p.personalCount).toLocaleString()+'석 · 단체 '+Number(p.groupCount||0).toLocaleString()+'석 (결제 예정 '+Number(p.groupPending||0).toLocaleString()+'석). 최종 검증 후 함께 반영합니다.</p>';
  if(done){var rows=((s.lastResult||{}).records||[]).filter(function(x){return x.personalCount!==null&&x.personalCount!==undefined&&x.groupCount!==null&&x.groupCount!==undefined;});if(rows.length){var sum=function(k){return rows.reduce(function(n,x){return n+Number(x[k]||0);},0);};h+='<p class="ym-ui-meta">반영 완료 공연 '+rows.length+'개 · 개인 '+sum('personalCount').toLocaleString()+'석 · 단체 '+sum('groupCount').toLocaleString()+'석 (결제 예정 '+sum('groupPending').toLocaleString()+'석)</p>';}}
  return h;
 }
 function recovery(code,s){
  if(/LOGIN_WAIT_TIMEOUT/.test(code))return {title:'로그인 대기 시간이 지났습니다',help:'10분 동안 전송하지 않아 준비 요청을 종료했습니다. 수집기 열기부터 다시 진행하세요. 기존 실적은 유지됩니다.'};
  if(/FIELD|집계 시점 불일치/.test(code))return {title:'개인·단체 좌석 검증을 완료하지 못했습니다',help:'이번 수집은 반영하지 않았습니다. 수집기 열기 후 다시 전송해 주세요. 반복되면 오류 세부 정보를 확인하세요.'};
  if(/COLLECTOR_WINDOW_CLOSED|SELLER_PAGE_CHANGED/.test(code))return {title:'수집기 창이 닫혔거나 페이지가 변경됐습니다',help:'수집기 다시 열기를 누르고 셀러 로그인과 창구 선택을 확인한 뒤 전송하세요. 이번 요청의 반영 여부는 마지막 반영 시각에서 확인할 수 있습니다.'};
  if(/COLLECTOR_REQUEST_TIMEOUT|COLLECTOR_OPEN_TIMEOUT|COLLECTOR_DISCONNECTED|COLLECTION_TIMEOUT/.test(code))return {title:'수집기 응답이 없어 갱신을 중단했습니다',help:'내부망 PC와 수집기 연결을 확인한 뒤 수집기 열기부터 다시 진행해 주세요. 만료된 요청은 재연결되어도 자동 실행되지 않습니다. 마지막 반영 결과는 아래에서 확인할 수 있습니다.'};
  if(/MANUAL_LOGIN_REQUIRED|TICKETLINK_LOGIN_REQUIRED/.test(code))return {title:'셀러 로그인을 마쳐 주세요',help:'수집기 창에서 로그인과 창구 선택을 마친 뒤 전송을 다시 누르세요. 기존 판매 실적은 유지됩니다.'};
  if(/COLLECTOR_NOT_OPEN|LOGIN_REQUEST_EXPIRED/.test(code))return {title:'수집기 창을 먼저 열어 주세요',help:'수집기 열기를 누르고 로그인 후 전송해 주세요.'};
  if(/COLLECTOR_OFFLINE/.test(code))return {title:'수집기 연결을 기다려 주세요',help:'내부망 PC가 켜져 있고 Windows에 로그인되어 있는지 확인해 주세요. 연결된 다음 전송할 수 있습니다.'};
  if(/MISO|Failed to fetch|Failed to reach/.test(code))return {title:'미소 서버 연결을 확인하고 있습니다',help:'요청이 접수되었는지 확인 중입니다. 연결이 복구되면 진행 상태와 마지막 반영 시각을 확인한 뒤 다시 진행해 주세요.'};
  if(/ADDITIONAL_AUTH|CONFIRMATION_REQUIRED/.test(code))return {title:'추가 확인이 필요합니다',help:'수집기 PC의 기존 Chrome 창에서 인증 안내를 확인한 뒤 다시 시도를 눌러 주세요. 저장된 계정 정보는 유지됩니다.'};
  if(/CREDENTIALS|SETTINGS_REQUIRED/.test(code))return {title:'로그인 설정을 확인해 주세요',help:'연결 설정에서 PAYCO 계정, 셀러 인증번호, 사용자명과 창구를 확인한 뒤 다시 시도하세요.'};
  if(!online())return {title:'수집기 PC 연결이 끊겼습니다',help:'내부망 PC가 켜져 있고 Windows에 로그인되어 있는지 확인해 주세요. 연결을 확인한 뒤 수집기를 다시 열고 전송하세요.'};
  return {title:'이번 갱신을 완료하지 못했습니다',help:'기존 실적을 유지했습니다. 다시 시도로 재조회할 수 있으며, 반복되면 오류 세부 정보를 확인해 주세요.'};
 }
 function signed(n){return n==null?'—':(n>0?'+':'')+Number(n).toLocaleString('ko-KR');}
 function resultTable(rows,diffs){return '<div class="ym-tl-table"><table class="ym-ui-table" data-ui-density="compact"><thead><tr><th>프로그램</th><th>판매 수입</th><th>유료 / 무료</th></tr></thead><tbody>'+rows.map(function(x){var d=x.delta,p=x.previous;return '<tr><td>'+text(x.name)+(diffs&&p===null?'<small>새로 반영</small>':'')+'</td><td>'+Number(x.amount).toLocaleString('ko-KR')+'원'+(diffs&&d?'<small class="ym-tl-delta">'+signed(d.amount)+'원'+(p&&p.amount!==null?' · 이전 '+Number(p.amount).toLocaleString('ko-KR')+'원':'')+'</small>':'')+'</td><td>'+Number(x.paid).toLocaleString('ko-KR')+' / '+Number(x.free).toLocaleString('ko-KR')+(diffs&&d?'<small>'+signed(d.paid)+' / '+signed(d.free)+'</small>':'')+'</td></tr>';}).join('')+'</tbody></table></div>';}
 function updateClocks(){document.querySelectorAll('[data-tl-clock]').forEach(function(el){var secs=Math.max(0,Math.floor((Date.now()-Date.parse(el.dataset.at||''))/1000));if(!isFinite(secs)){el.textContent='응답 확인 중';return;}el.textContent=el.dataset.tlClock==='elapsed'?'경과 '+Math.floor(secs/60)+'분 '+secs%60+'초':'최근 응답 '+secs+'초 전'+(secs>90?' · 연결 확인 필요':'');});}
 function close(){var el=document.getElementById('ym-ticketlink-modal');if(el){YMUI.release(el);el.remove();}}
 function open(start){
  close();var wrap=document.createElement('div');wrap.id='ym-ticketlink-modal';wrap.innerHTML='<div class="modal-bg show ym-ui-overlay"><section class="modal ym-tl-modal ym-ui-dialog" data-ui-contract="v1" data-ui-size="multi" data-ui-id="sales-sync" role="dialog" aria-modal="true" aria-labelledby="ym-tl-title"><button class="modal-x" id="ym-tl-close" aria-label="닫기">✕</button>'+YMUI.head('판매 실적 갱신',null,null,'ym-tl-title')+'<div class="ym-ui-body"><div id="ym-ticketlink-detail">'+detailHtml()+'</div></div><div class="ym-tl-actions ym-ui-footer"><span class="ym-ui-secondary-actions"><button class="ym-ui-button" type="button" id="ym-tl-group">단체 입력</button><button class="ym-ui-button" data-ui-tone="ghost" type="button" id="ym-tl-settings">연결 설정</button></span><button class="ym-ui-button" type="button" id="ym-tl-request">수집기 열기</button><button class="ym-ui-button" data-ui-tone="primary" type="button" id="ym-tl-send">전송</button><span id="ym-tl-request-result" role="status"></span></div></section></div>';document.body.appendChild(wrap);YMUI.mount(wrap,close);
  wrap.querySelector('#ym-tl-group').onclick=function(){if(window.ymGroupOpen)window.ymGroupOpen();};wrap.querySelector('#ym-tl-close').onclick=close;wrap.querySelector('.modal-bg').onclick=function(e){if(e.target===this)close();};wrap.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
  wrap.querySelector('#ym-tl-settings').onclick=settings;
  async function submit(action){
   if(submitting||busy())return;
   statusEpoch++;
   if(action==='request'&&(!online()||stalled()||!state||!state.openedAt||state.loginReady!==true)){error=stalled()||'COLLECTOR_OFFLINE';draw();return;}
   requestBaseline=action==='request'?(state&&state.lastBatchId||''):null;
   submitting=true;draw();var out=wrap.querySelector('#ym-tl-request-result');out.textContent=action==='prepare'?'수집기 창을 열고 있습니다…':'전송 요청을 보내고 있습니다…';
   try{if(action==='prepare')await window.ymCollectorConnect();var r=await request(action,action==='request'?{preparationId:state&&state.preparationId}:{});state=r.status;error='';out.textContent='';}catch(e){error=e.message;out.textContent='응답을 확인하지 못했습니다. 진행 상태와 마지막 반영 시각을 확인해 주세요.';}finally{submitting=false;draw();poll();}
  }
  wrap.querySelector('#ym-tl-request').onclick=function(){submit('prepare');};
  wrap.querySelector('#ym-tl-send').onclick=function(){if(completed()){close();return;}submit('request');};
  draw();wrap.querySelector('#ym-tl-request').focus();if(start===true&&!busy())submit('prepare');else poll();
 }
 function b64(bytes){return btoa(String.fromCharCode.apply(null,new Uint8Array(bytes)));}
 async function seal(value){
  if(!state||!state.publicKey)throw Error('수집기 연결을 확인한 뒤 다시 저장해 주세요.');
  var bytes=Uint8Array.from(atob(state.publicKey.replace(/-----[^-]+-----|\s/g,'')),function(x){return x.charCodeAt(0);});
  var rsa=await crypto.subtle.importKey('spki',bytes,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);
  var key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt']),iv=crypto.getRandomValues(new Uint8Array(12));
  var cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv:iv},key,new TextEncoder().encode(JSON.stringify(value)));
  var wrapped=await crypto.subtle.encrypt({name:'RSA-OAEP'},rsa,await crypto.subtle.exportKey('raw',key));
  return {v:1,keyId:state.keyId,wrappedKey:b64(wrapped),iv:b64(iv),cipher:b64(cipher)};
 }
 async function settings(){
  try{var latest=await request('status');state=latest.status;error='';}catch(e){error=e.message;open(false);return;}close();var wrap=document.createElement('div');wrap.id='ym-ticketlink-modal';
  var configured=state&&state.credentialsConfigured;
  wrap.innerHTML='<div class="modal-bg show ym-ui-overlay"><section class="modal ym-tl-modal ym-ui-dialog" data-ui-contract="v1" data-ui-size="form" data-ui-id="collector-settings" role="dialog" aria-modal="true" aria-labelledby="ym-tl-title"><button class="modal-x" id="ym-tl-close" aria-label="닫기">✕</button>'+YMUI.head('티켓링크 수집 설정',null,null,'ym-tl-title')+'<div class="ym-ui-body"><p>현재는 수동 로그인 후 전송 방식입니다. 저장된 자동 로그인 설정은 향후 기능을 위해 유지됩니다.</p><p>'+(configured?'로그인 정보 4개가 저장되어 있습니다. 창구만 변경할 때는 빈칸으로 두세요.':'로그인 정보를 처음 한 번 입력해 주세요.')+'</p><form id="ym-tl-config" autocomplete="off"><label>1. PAYCO 아이디<input name="account" type="text" maxlength="150" autocomplete="off"></label><label>2. PAYCO 비밀번호<input name="secret" type="password" maxlength="200" autocomplete="new-password"></label><label>3. 셀러 인증번호<input name="sellerCode" type="password" maxlength="100" autocomplete="new-password"></label><label>4. 사용자명<input name="operatorName" type="text" maxlength="60"></label><label>5. 창구 선택<select name="windowNo">'+Array.from({length:10},function(_,i){return '<option value="'+(i+1)+'"'+((i+1)===Number(state&&state.windowNo||8)?' selected':'')+'>'+(i+1)+'</option>';}).join('')+'</select></label><p>계정 정보는 수집기에서만 해독할 수 있도록 암호화해 저장합니다. 자동 수집은 꺼져 있으며 전송을 눌렀을 때만 갱신합니다.</p><div class="ym-tl-actions ym-ui-footer"><button class="ym-ui-button" data-ui-tone="primary" type="submit">설정 저장</button><span id="ym-tl-save-result" role="status"></span></div></form></div></section></div>';
  document.body.appendChild(wrap);YMUI.mount(wrap,close);wrap.querySelectorAll('input').forEach(function(i){i.required=!configured;});wrap.querySelector('#ym-tl-close').focus();
  wrap.querySelector('#ym-tl-close').onclick=close;wrap.querySelector('form').onsubmit=async function(e){e.preventDefault();var form=this,btn=form.querySelector('button[type=submit]'),out=form.querySelector('#ym-tl-save-result');btn.disabled=true;try{var values={account:form.elements.account.value.trim(),secret:form.elements.secret.value,sellerCode:form.elements.sellerCode.value.trim(),operatorName:form.elements.operatorName.value.trim()},payload={windowNo:Number(form.elements.windowNo.value)};if(Object.keys(values).some(function(k){return !!values[k];})||!configured){if(Object.keys(values).some(function(k){return !values[k];}))throw Error('로그인 정보를 변경할 때는 1~4번을 모두 입력해 주세요.');payload.credentials=await seal(values);}var saved=await request('settings',payload);state=saved.status;form.querySelectorAll('input').forEach(function(i){i.value='';i.required=false;});configured=true;out.textContent='설정을 저장했습니다. 현재는 직접 로그인 후 전송하는 방식입니다.';}catch(e){out.textContent=e.message;}finally{btn.disabled=false;}};
 }
 async function refreshViews(){if(refreshing)return;refreshing=true;try{
  if(typeof _ymInvalidateViews==='function')_ymInvalidateViews('/api/ops',{sheet:'일일실적'});
  if(typeof _finState!=='undefined'){_finState.rows=null;_finState._p=null;_finState.busy=0;}
  if(typeof _finLoad==='function')await _finLoad(true);
  if(typeof _pmLoad==='function')await _pmLoad();
  if(typeof _bizInlineRender==='function')_bizInlineRender();
 }catch(e){error='저장 완료 · 화면 갱신 실패: '+e.message;}finally{refreshing=false;}}
 async function poll(){if(polling||submitting)return;polling=true;var epoch=statusEpoch;try{var r=await request('status');if(epoch!==statusEpoch)return;state=r.status;error='';if(state.lastBatchId&&seenBatch!==state.lastBatchId){var firstPoll=(seenBatch==='');seenBatch=state.lastBatchId;if(!firstPoll)refreshViews();}   /* [260907] 첫 상태 조회는 기준선만 잡는다 — 부팅 직후 시트 4개(일일실적 3.6MB 등 7MB)를 한 번 더 받던 원인 */}catch(e){error=e.message;}finally{polling=false;draw();}}
 // UI-CONTRACT-V1: collector components use common CSS.
 // UI-CONTRACT-V1: collector components use common CSS.
 // UI-CONTRACT-V1: collector components use common CSS.
 document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('button');if(!b||b.id||!(b.getAttribute('onclick')||'').includes('ymTicketlinkOpen'))return;e.preventDefault();e.stopImmediatePropagation();if(typeof _ddCloseAll==='function')_ddCloseAll();open(false);},true);
 window.ymTicketlinkOpen=open;
 window.ymTicketlinkSettings=settings;
 if(typeof _adminGroups!=='undefined'&&_adminGroups[0]&&!_adminGroups[0].items.some(function(x){return x[0]==='ticketlink';}))_adminGroups[0].items.push(['ticketlink','티켓링크 수집 설정']);
 if(typeof adminRoute==='function'){var originalRoute=adminRoute;adminRoute=function(id){if(id==='ticketlink')return settings();return originalRoute.apply(this,arguments);};}
 if(typeof _updateSalesAsOfBadge==='function'){var original=_updateSalesAsOfBadge;_updateSalesAsOfBadge=function(d){original(d);draw();};}
 var actionObserver=new MutationObserver(mountAction);['rail-yrm','biz-main'].forEach(function(id){var el=document.getElementById(id);if(el)actionObserver.observe(el,{childList:true,subtree:true});});window.addEventListener('resize',mountAction);
 window.addEventListener('online',poll);window.addEventListener('focus',poll);
 window.addEventListener('beforeunload',function(e){if(submitting||busy()){e.preventDefault();e.returnValue='';}});
 setInterval(poll,15000);setInterval(function(){if(state&&(state.active||['opening','awaiting_login','login_ready','queued'].indexOf(state.phase)>=0))poll();},3000);setInterval(updateClocks,1000);setInterval(draw,30000);poll();
})();

(function(){
 'use strict';
 if(location.pathname.indexOf('/service/coder/preview/9b659b4f-08bb-4d94-adb5-57b9cf9be52e/')!==0||window.__ymLocalRelay)return;
 var status=window.__ymLocalRelay={connected:false,error:''},clientId=crypto.randomUUID(),busy=false;
 var base='/service/coder/preview/9b659b4f-08bb-4d94-adb5-57b9cf9be52e/__runtime';
 async function local(path,body){var r=await fetch('http://127.0.0.1:19741'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Ym-Relay':'1'},body:JSON.stringify(Object.assign({clientId:clientId},body||{})),signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('LOCAL_RELAY_'+r.status);return r.json();}
 async function tick(){
  if(busy)return;busy=true;
  try{
   if(typeof userRole==='undefined'||!userRole)return;
   try{var permission=await navigator.permissions.query({name:'local-network-access'});if(permission.state!=='granted'){status.connected=false;status.error='LOCAL_PERMISSION_REQUIRED';return;}}catch(e){}
   var next=await local('/next');status.connected=true;status.error='';if(!next.task)return;
   var result,error;
   try{var r=await fetch(base+'/api/ym/ticketlink/relay',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Ym-Env':'dev'},body:JSON.stringify(next.task),signal:AbortSignal.timeout(50000)});result=await r.json();if(!r.ok||result.ok===false)throw Error(result.error||'MISO_RELAY_'+r.status);}catch(e){error=e.message;}
   await local('/result',{id:next.task.id,result:result,error:error});if(error)status.error=error;
  }catch(e){status.connected=false;status.error=e.message;}finally{busy=false;}
 }
 setInterval(tick,1000);tick();
})();

(function(){
 'use strict';
 if(location.pathname.indexOf('/service/coder/preview/9b659b4f-08bb-4d94-adb5-57b9cf9be52e/')!==0)return;
 function note(preview){
  var modal=document.querySelector('#ym-ticketlink-modal .ym-tl-modal');if(!modal)return;
  var el=document.getElementById('ym-tl-network-help');if(!el){el=document.createElement('div');el.id='ym-tl-network-help';el.setAttribute('role','status');el.className='ym-ui-message';modal.querySelector('.ym-ui-body').prepend(el);}
  el.innerHTML='<strong class="ym-ui-block-heading">'+(preview?'처음 연결할 때 표시되는 안내':'브라우저 상단에서 연결 권한을 허용해 주세요')+'</strong><span>요청 권한: <b>로컬 네트워크 접근</b></span><br>미소가 이 PC에서 실행 중인 수집기와 연결하는 데 사용합니다.<br>브라우저의 권한 요청에서 <b>허용</b>을 선택하면 수집기 열기가 이어집니다.<div class="ym-ui-meta">한 번 허용하면 다음부터는 바로 연결됩니다. 수집기에서는 티켓셀러만 로그인해 주세요.</div>';
 }
 window.ymCollectorPermissionPreview=function(){note(true);};
 window.ymCollectorConnect=async function(){
  // Start fetch in the original button gesture. Browser owns the permission prompt.
  var pending=fetch('http://127.0.0.1:19741/next',{method:'POST',headers:{'Content-Type':'application/json','X-Ym-Relay':'1'},body:'{"clientId":""}',signal:AbortSignal.timeout(60000)});
  note(false);
  try{var r=await pending;if(r.status!==400)throw Error('LOCAL_COLLECTOR_UNAVAILABLE');var el=document.getElementById('ym-tl-network-help');if(el)el.remove();return true;}
  catch(e){var el=document.getElementById('ym-tl-network-help');if(el)el.innerHTML='<strong>수집기 연결을 확인해 주세요</strong><br>이 PC의 수집기가 실행 중인지 확인해 주세요.<br>로컬 네트워크 접근을 차단했다면 브라우저 사이트 설정에서 허용한 뒤 <b>수집기 열기</b>를 다시 누르세요.';throw Error('수집기 연결 또는 브라우저 로컬 네트워크 권한을 확인해 주세요');}
 };
})();

(function(){
 if(window.__ymAutoDataRefresh||location.pathname.indexOf('/service/coder/preview/')!==0)return;
 var s=window.__ymAutoDataRefresh={pending:false,running:false,lastError:'',lastAppliedAt:null};
 async function apply(){
  if(!s.pending||s.running||typeof userRole==='undefined'||!userRole||!_designSafeNow())return;
  s.running=true;s.pending=false;var target=s.targetMod;
  try{
   var data=await api('GET','/api/records');
   if(!_designSafeNow()){s.pending=true;return;}
   var all=(data.records||[]).map(function(r,i){return Object.assign({},r,{_rowIndex:r._rowIndex!==undefined?r._rowIndex:i+2});});
   _DRAFTS=all.filter(_isDraftRec);records=all.filter(function(r){return !_isDraftRec(r);});
   if(typeof _ymInvalidateViews==='function')_ymInvalidateViews('/api/ops',{sheet:'일일실적'});
   render();
   if(typeof loadPromoSpecial==='function')await loadPromoSpecial();
   if(typeof _finLoad==='function')await _finLoad(true);
   if(typeof _pmLoad==='function')await _pmLoad();
   if(_designSafeNow()){if(typeof renderPromoBoard==='function')renderPromoBoard();if(typeof _bizInlineRender==='function')_bizInlineRender();}
   // Use the version observed before fetching: later changes remain detectable.
   if(target)_lastSeenMod=target;
   s.lastAppliedAt=new Date().toISOString();s.lastError='';
  }catch(e){s.pending=true;s.lastError=e.message;}finally{s.running=false;}
 }
 var original=_showUpdateBadge;
 _showUpdateBadge=function(kind){if(kind==='design')return original(kind);s.pending=true;s.targetMod=window.__ymDetectedMod||null;var el=document.getElementById('update-badge');if(el&&el.classList.contains('ub-data'))el.style.display='none';if(_updateBadgeShown==='data')_updateBadgeShown=false;apply();};
 window.ymAutoDataRefreshRun=apply;setInterval(apply,3000);
})();
