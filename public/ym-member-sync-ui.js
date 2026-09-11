(function(){
 'use strict';
 if(location.pathname.indexOf('/service/coder/preview/')<0)return;
 // UI-CONTRACT-V1: styles are loaded from the common stylesheet.
 var state=null,lastPoll=0,timer=null,loading=false,rowsCache=null,version='',focusBack=null,dialogEpoch=0,dialogJobId=null;
 var labels={idle:'갱신 준비',opening:'관리자 창 여는 중',awaiting_login:'로그인 대기 중',collecting:'전체 회원 정보 수신 중',staging:'회원 정보 검증 중',complete:'반영 완료',error:'갱신 실패'};
 var requestedHere=false;try{requestedHere=sessionStorage.getItem('ym-member-sync-requested')==='1';}catch(e){}
 var root=location.pathname.split('/standalone.html')[0]+'/__runtime/api/ym/ticketlink/member-';
 function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 async function request(action,body){var c=new AbortController(),t=setTimeout(function(){c.abort();},30000);try{var r=await fetch(root+action,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Ym-Env':'dev'},signal:c.signal,body:JSON.stringify(body||{})}),j=await r.json();if(!r.ok||!j.ok)throw Error(j.error||'회원 갱신 응답 오류');return j;}finally{clearTimeout(t);}}
 async function poll(force){if(!force&&state&&Date.now()-lastPoll<5000)return state;var r=await request('status');state=r.status;lastPoll=Date.now();return state;}
 window.ymMemberSyncReady=async function(){return !!(await poll(false)).lastCompleteAt;};
 var rowsJob=null;
 window.ymMemberSyncRows=function(){
  if(rowsJob)return rowsJob;
  var epoch=typeof _memEpoch==='undefined'?0:_memEpoch,start=Date.now();
  function active(){if((typeof _memEpoch!=='undefined'&&epoch!==_memEpoch)||Date.now()-start>85000)throw Error('회원 조회가 종료되었거나 지연되었습니다. 다시 조회해 주세요');}
  var job=(async function(){
    var s=await poll(false);active();
    if(!s.lastCompleteAt)throw Error('회원 갱신 이력이 없습니다');
    if(rowsCache&&version===s.lastJobId)return rowsCache;
    var rows=[],offset=0;
    do{
      active();var r=await request('rows',{offset:offset,compact:true});active();
      if(!r.ready||r.version!==s.lastJobId||!Array.isArray(r.rows))throw Error('회원 정보가 갱신되었습니다. 다시 조회해 주세요');
      if(r.next!==null&&(!Number.isInteger(r.next)||r.next<=offset||r.next!==offset+r.rows.length))throw Error('회원 명부 페이지가 올바르지 않습니다');
      rows=rows.concat(r.rows);offset=r.next;
      var progress=document.getElementById('seg-result');
      if(progress&&progress.querySelector('[role="status"]'))progress.querySelector('[role="status"]').textContent='회원 명부 '+rows.length.toLocaleString()+'명 확인 중';
    }while(offset!==null);
    active();version=s.lastJobId;rowsCache={headers:rows[0]?Object.keys(rows[0]):[],rows:rows,note:'홈페이지 회원 DB'};return rowsCache;
  })();
  rowsJob=job;var done=function(){if(rowsJob===job)rowsJob=null;};job.then(done,done);return job;
 };
 if(typeof _memPurge==='function'){var purge=_memPurge;_memPurge=function(){rowsJob=null;rowsCache=null;version='';state=null;lastPoll=0;close();return purge.apply(this,arguments);};}
 async function refreshMembers(){rowsJob=null;rowsCache=null;try{if(typeof _memEpoch!=='undefined')_memEpoch++;if(typeof _memSummaryP!=='undefined')_memSummaryP=null;if(typeof _memSummaryLoading!=='undefined')_memSummaryLoading=false;if(typeof _segRunSeq!=='undefined')_segRunSeq++;if(typeof _segLast!=='undefined')_segLast=null;if(typeof _memState!=='undefined')_memState=null;if(typeof _memSummary!=='undefined')_memSummary=null;if(typeof _memLoading!=='undefined')_memLoading=false;if(typeof _memP!=='undefined')_memP=null;if(typeof _memSearchState!=='undefined')_memSearchState=null;if(typeof _memberHubFill==='function')_memberHubFill();if(typeof _memRender==='function')try{_memRender();}catch(_er){}   /* [260907 회원 지연] 갱신 뒤 명단 15MB 재수신 없음 — 집계는 _memberHubFill 이 새로 받고, 검색은 다음 입력 때 서버에서 */}catch(e){var el=document.getElementById('ym-ms-message');if(el)el.textContent='저장 완료 · 화면을 새로고침해 주세요';}}
 function draw(){
  var el=document.getElementById('ym-ms-body');if(!el)return;
  var s=state||{},r=s.result,active=['opening','awaiting_login','collecting','staging'].indexOf(s.phase)>=0;
  var finishing=s.phase==='staging'&&s.expected>0&&s.received===s.expected;
  if(active&&s.jobId)dialogJobId=s.jobId;
  var complete=s.phase==='complete',fresh=complete&&!!dialogJobId&&dialogJobId===(s.lastJobId||s.jobId);
  if(complete){
   el.innerHTML='<p role="status">갱신이 완료된 상태입니다.</p>'+(s.lastCompleteAt?'<p class="ym-ui-meta">최근 반영: '+esc(new Date(s.lastCompleteAt).toLocaleString('ko-KR'))+'</p>':'');
   document.getElementById('ym-ms-done').textContent=fresh?'확인':'닫기';
   var doneStart=document.getElementById('ym-ms-start');doneStart.disabled=false;doneStart.textContent='다시 갱신';
   return;
  }
  var count=function(v){return Number(v||0).toLocaleString('ko-KR');};
  var h='';
  if(active){
   var step=s.phase==='opening'?0:s.phase==='awaiting_login'?1:s.phase==='staging'&&finishing?3:2;
   h+='<ol class="ym-ms-steps ym-ui-steps" aria-label="회원 갱신 단계">'+['수집기 열기','로그인 확인','데이터 수신','반영'].map(function(label,i){return '<li class="'+(i===step?'current':i<step?'passed':'')+'"'+(i===step?' aria-current="step"':'')+'>'+String(i+1)+' · '+label+'</li>';}).join('')+'</ol>';
  }
  var title=complete?(fresh?'회원 정보 갱신 완료':'최근 갱신 내역'):finishing?'수신 완료 · 반영 마무리 중':labels[s.phase]||'갱신 준비';
  h+='<p role="status"><strong>'+esc(title)+'</strong></p>';
  if(complete){
   h+='<p>'+(fresh?'회원 정보를 반영했습니다.':'이전 갱신이 완료된 상태입니다.')+' 새 정보를 가져오려면 <b>다시 갱신</b>을 눌러 주세요.</p>';
  }else{
   h+='<p>'+esc(s.phase==='awaiting_login'?'수집기 창에서 예울마루 관리자 로그인을 완료해 주세요. 최대 10분 동안 대기하며, 로그인하면 자동으로 수집을 시작합니다.':finishing?'전체 회원 데이터를 받았습니다. 기존 회원과 대조하고 저장을 마무리하고 있습니다.':s.message||'갱신을 누르면 수집기가 열립니다. 관리자 로그인 후 회원 정보를 자동으로 가져옵니다.')+'</p>';
  }
  if(s.phase==='staging'){
   var percent=Math.min(100,Math.floor(Number(s.received||0)/Math.max(1,Number(s.expected||1))*100));
   h+='<div class="ym-ms-progress"><div class="ym-ms-progress-head"><span class="ym-ms-percent">수신 '+percent+'%</span><span class="ym-ms-count">'+count(s.received)+' / '+count(s.expected)+'명</span></div><progress aria-label="회원 데이터 수신률" max="'+Number(s.expected||1)+'" value="'+Number(s.received||0)+'"></progress></div>';
  }
  if(s.lastCompleteAt)h+='<p class="ym-ui-meta">최근 반영: '+esc(new Date(s.lastCompleteAt).toLocaleString('ko-KR'))+'</p>';
  if(complete&&r){
   h+='<div class="ym-ms-last-result ym-ui-card"><strong>전체 회원 '+count(r.total)+'명</strong><p class="ym-ui-meta">신규 '+count(r.inserted)+'명 · 변경 '+count(r.updated)+'명 · 동일 '+count(r.unchanged)+'명'+(r.retained?' · 기존 유지 '+count(r.retained)+'명':'')+'</p></div>';
  }
  if(!s.online)h+='<p class="ym-ui-meta">'+(active?'수집기 연결을 기다리고 있습니다.':'새로 갱신하려면 수집기 연결이 필요합니다.')+' 내부망 PC에서 수집기를 실행해 주세요.</p>';
  if(s.error)h+='<p class="ym-ui-error">'+esc(s.error)+'</p>';
  if(active)h+='<p class="ym-ui-meta">이 화면을 닫아도 수집은 계속됩니다. 다시 열면 진행 상태를 확인할 수 있습니다.</p>';
  h+='<p class="ym-ui-meta">홈페이지 회원 정보를 가져와 예매 데이터 대조에 사용합니다.</p>';
  el.innerHTML=h;
  document.getElementById('ym-ms-done').textContent=fresh?'확인':'닫기';
  var b=document.getElementById('ym-ms-start');b.disabled=active;
  b.textContent=active?(s.phase==='opening'?'수집기 여는 중…':finishing?'마무리 중…':'갱신 진행 중'):(s.lastCompleteAt||requestedHere?'다시 갱신':'갱신');
 }
 function close(){dialogEpoch++;dialogJobId=null;if(timer)clearInterval(timer);timer=null;var el=document.getElementById('ym-member-sync-modal');if(el){YMUI.release(el);el.remove();}if(focusBack&&focusBack.isConnected)focusBack.focus();}
 window.ymMemberSyncOpen=async function(){
  if(typeof userRole==='undefined'||userRole!=='admin'){if(typeof showToast==='function')showToast('회원 정보 갱신은 관리자 전용입니다','error');return;}
  close();focusBack=document.activeElement;var el=document.createElement('div');el.id='ym-member-sync-modal';el.className='modal-bg show ym-ui-overlay';el.innerHTML='<section class="modal ym-ui-dialog" data-ui-contract="v1" data-ui-size="form" data-ui-id="member-sync" role="dialog" aria-modal="true" aria-labelledby="ym-ms-title"><button class="modal-x" id="ym-ms-close" aria-label="회원 정보 갱신 닫기">✕</button>'+YMUI.head('회원 정보 갱신',null,null,'ym-ms-title')+'<div class="ym-ui-body"><div id="ym-ms-body">연결 확인 중…</div><p id="ym-ms-message" class="ym-ui-message" role="status"></p></div><div class="ym-ui-footer"><button class="ym-ui-button" id="ym-ms-done" type="button">확인</button><button class="ym-ui-button" data-ui-tone="primary" id="ym-ms-start" type="button">갱신</button></div></section>';document.body.appendChild(el);YMUI.mount(el,close,focusBack);
  el.querySelector('#ym-ms-close').onclick=close;el.querySelector('#ym-ms-done').onclick=close;el.onclick=function(e){if(e.target===el)close();};el.onkeydown=function(e){if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){var f=Array.from(el.querySelectorAll('button:not(:disabled)'));if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f[f.length-1].focus();}else if(!e.shiftKey&&document.activeElement===f[f.length-1]){e.preventDefault();f[0].focus();}}};
  var epoch=dialogEpoch,seen=state&&state.lastJobId;async function update(){if(loading||epoch!==dialogEpoch)return;loading=true;try{await poll(true);if(epoch!==dialogEpoch)return;var message=document.getElementById('ym-ms-message');if(message)message.textContent='';draw();if(state.lastJobId&&seen!==state.lastJobId){seen=state.lastJobId;await refreshMembers();}}catch(e){if(epoch!==dialogEpoch)return;var msg=document.getElementById('ym-ms-message');if(msg)msg.textContent='연결 확인이 지연되고 있습니다. 저장 실패로 확정된 것은 아닙니다';}finally{loading=false;}}
  el.querySelector('#ym-ms-start').onclick=async function(){this.disabled=true;this.textContent='수집기 여는 중…';el.querySelector('#ym-ms-message').textContent='수집기 연결을 요청하고 있습니다';try{var r=await request('prepare');requestedHere=true;try{sessionStorage.setItem('ym-member-sync-requested','1');}catch(e){}state=r.status;draw();}catch(e){el.querySelector('#ym-ms-message').textContent='수집기 연결 요청에 실패했습니다. 잠시 후 다시 시도해 주세요';this.disabled=false;this.textContent=requestedHere?'다시 갱신':'갱신';}};
  el.querySelector('#ym-ms-done').textContent=state&&['opening','awaiting_login','collecting','staging'].indexOf(state.phase)>=0?'닫기':'확인';el.querySelector('#ym-ms-done').focus();await update();if(epoch===dialogEpoch&&el.isConnected)timer=setInterval(update,3000);
 };
})();
