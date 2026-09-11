/* Manual group entries use the existing 단체 sheet, independently of Ticketlink snapshots. */
(function(){
 'use strict';
 var session=null;
 async function groupRequest(payload){
  var match=location.pathname.match(/^(\/service\/coder\/preview\/[^/]+\/)/);
  if(!match)throw Error('개발 미리보기에서만 입력할 수 있습니다.');
  var ctl=new AbortController(),timer=setTimeout(function(){ctl.abort();},20000);
  try{
   var response=await fetch(match[1]+'__runtime/api/ym/ticketlink/group-save',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Ym-Env':'dev'},body:JSON.stringify(payload),signal:ctl.signal});
   var out;try{out=await response.json();}catch(e){throw Error('서버 응답을 확인할 수 없습니다.');}
   if(!response.ok||!out.ok)throw Error(out.error||'요청 처리 실패');
   return out;
  }finally{clearTimeout(timer);}
 }
 async function applyGroupResult(out){
  if(typeof _ymInvalidateViews!=='function')throw Error('저장 후 화면 갱신 함수가 없습니다. 새로고침해 주세요.');
  _ymInvalidateViews('/api/ops',{sheet:'프로그램마스터'});
  _salesState.group={headers:out.headers,rows:out.rows};_salesBuildMemo=null;window._bizSDRowsMemo=null;
  if(window.YMDB&&YMDB.invalidate)YMDB.invalidate('단체');
  try{if(typeof _srailInit==='function')_srailInit();}catch(e){console.warn('group sales refresh',e);}
  if(typeof _pmLoad==='function')await _pmLoad();
  try{if(typeof _bizInlineRender==='function')_bizInlineRender();}catch(e){console.warn('group overview refresh',e);}
 }
 function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 function close(){if(session&&session.busy)return;var el=document.getElementById('ym-group-modal');if(el){YMUI.release(el);el.remove();}session=null;var b=document.getElementById('ym-tl-group');if(b)b.focus();}
 function row(){var el=document.createElement('div');el.className='ym-gr-row';el.innerHTML='<label>프로그램<select class="ym-gr-program"><option value="">프로그램 선택</option>'+session.programs.map(function(p){return '<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>';}).join('')+'</select></label><label>회차<select class="ym-gr-round" disabled><option value="">프로그램을 먼저 선택하세요</option></select></label><label>인원 (명)<input class="ym-gr-count" type="number" min="1" step="1" inputmode="numeric"></label><label>금액 (원, 선택)<input class="ym-gr-money" type="number" min="0" step="1" inputmode="numeric"></label><label>단체명<input class="ym-gr-name" type="text" maxlength="100" placeholder="단체명 입력"></label><button type="button" class="ym-gr-remove ym-ui-button" data-ui-tone="ghost" aria-label="입력 행 삭제">×</button>';
 el.querySelector('.ym-gr-program').onchange=function(){var p=session.programs.find(function(p){return p.id===el.querySelector('.ym-gr-program').value;});var select=el.querySelector('.ym-gr-round');select.disabled=!p;select.innerHTML=!p?'<option value="">프로그램을 먼저 선택하세요</option>':p.rounds.length?'<option value="">회차 미정</option>'+p.rounds.map(function(r){return '<option value="'+esc(r.key)+'">'+esc(r.label)+'</option>';}).join(''):'<option value="">회차 미정</option>';};
 el.querySelector('.ym-gr-remove').onclick=function(){el.remove();if(!document.querySelector('.ym-gr-row'))row();};document.getElementById('ym-gr-rows').appendChild(el);return el;
 }
 async function open(){
  if(session)return;
  if(typeof userRole!=='undefined'&&userRole!=='admin'){showToast('관리자만 입력할 수 있습니다','error');return;}
  var token={busy:false,programs:[],requestId:null,payload:null};session=token;
  var wrap=document.createElement('div');wrap.id='ym-group-modal';wrap.innerHTML='<div class="modal-bg show ym-ui-overlay"><section class="modal ym-gr-dialog ym-ui-dialog" data-ui-contract="v1" data-ui-size="multi" data-ui-id="group-input" role="dialog" aria-modal="true" aria-labelledby="ym-gr-title"><button class="ym-gr-close modal-x" aria-label="단체 입력 닫기">✕</button>'+YMUI.head('단체 입력',null,null,'ym-gr-title')+'<div class="ym-ui-body"><p>담당자가 확인한 단체 실적을 추가합니다. 개인 실적 갱신과 별도로 보존됩니다. 회차 미정으로도 저장할 수 있으며 누계와 사업 수입에 반영됩니다.</p><div id="ym-gr-content">판매중 프로그램 불러오는 중…</div><div id="ym-gr-status" class="ym-ui-message" role="status"></div></div><footer class="ym-ui-footer"><button class="ym-ui-button" type="button" id="ym-gr-cancel">취소</button><button class="ym-ui-button" data-ui-tone="primary" type="button" id="ym-gr-save" disabled>저장</button></footer></section></div>';document.body.appendChild(wrap);YMUI.mount(wrap,close);
  wrap.querySelector('.ym-gr-close').onclick=close;wrap.querySelector('#ym-gr-cancel').onclick=close;
  wrap.addEventListener('keydown',function(e){if(e.key==='Escape'){e.stopPropagation();close();}if(e.key==='Tab'){var a=Array.from(wrap.querySelectorAll('button:not(:disabled):not([hidden]),input:not(:disabled):not([hidden]),select:not(:disabled):not([hidden])'));var first=a[0],last=a[a.length-1];if(!first){e.preventDefault();return;}if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  try{
   var res=await Promise.all([YMDB.view('공연마스터',true),api('GET','/api/programs'),YMDB.rows('회차',null,true),YMDB.view('일일입력',true)]);if(session!==token)return;
   _salesState.master=res[0];_salesState.daily=res[3];_salesBuildMemo=null;_dailyState.master=res[0];_dailyState.programs=res[1].programs||[];
   token.programs=_dailyMasters().filter(function(p){return p.id&&!p.back&&!/교육실\s*대관/.test(p.name)&&p.id!=='64410';}).map(function(p){var rounds=(res[2]||[]).filter(function(r){return String(r['프로그램ID'])===p.id;});p.rounds=rounds.map(function(r,i){var date=String(r['공연일']||''),time=String(r['공연시간']||r['시간']||'');return {key:String(i+1),label:(i+1)+'회차'+(date?' · '+date:'')+(time?' '+time:''),date:date,time:time};});if(!p.rounds.length&&p.rc>1){for(var i=1;i<=p.rc;i++)p.rounds.push({key:String(i),label:i+'회차',date:'',time:''});}return p;});
   document.getElementById('ym-gr-content').innerHTML=token.programs.length?'<label class="ym-gr-date">기준일자<input id="ym-gr-date" type="date" value="'+_dailyToday()+'"></label><div id="ym-gr-rows"></div><button class="ym-ui-button" data-ui-tone="ghost" type="button" id="ym-gr-add">＋ 회차·단체 추가</button>':'현재 판매중인 프로그램이 없습니다.';
   if(token.programs.length){row();document.getElementById('ym-gr-add').onclick=row;document.getElementById('ym-gr-save').disabled=false;document.getElementById('ym-gr-save').onclick=save;wrap.querySelector('select').focus();}
  }catch(e){if(session===token)document.getElementById('ym-gr-content').textContent='목록을 불러오지 못했습니다. 창을 닫고 다시 열어 주세요. '+e.message;}
 }
 async function save(){
  var s=session;if(!s||s.busy)return;var msg=document.getElementById('ym-gr-status');
  try{
   if(!s.payload){var date=document.getElementById('ym-gr-date').value;if(!date)throw Error('기준일자를 선택하세요.');var entries=Array.from(document.querySelectorAll('.ym-gr-row')).map(function(el){var id=el.querySelector('.ym-gr-program').value,p=s.programs.find(function(p){return p.id===id;});if(!p)throw Error('프로그램을 선택하세요.');var key=el.querySelector('.ym-gr-round').value,r=p.rounds.find(function(r){return r.key===key;});if(key&&!r)throw Error(p.name+'의 회차를 확인하세요.');var count=el.querySelector('.ym-gr-count').value,money=el.querySelector('.ym-gr-money').value;if(!/^\d+$/.test(count)||!Number.isSafeInteger(Number(count))||Number(count)<1)throw Error('인원은 1 이상의 정수로 입력하세요.');if(money!==''&&(!/^\d+$/.test(money)||!Number.isSafeInteger(Number(money))))throw Error('금액은 0 이상의 정수로 입력하세요.');return {programId:id,date:date,count:count,amount:money,groupName:el.querySelector('.ym-gr-name').value.trim(),round:r?r.key:'',roundDate:r?r.date:'',roundTime:r?r.time:''};});s.payload={requestId:'group_'+Date.now()+'_'+Math.random().toString(36).slice(2),entries:entries};}
   s.busy=true;document.querySelectorAll('#ym-gr-content input,#ym-gr-content select,#ym-gr-content button,#ym-gr-save,#ym-gr-cancel,.ym-gr-close').forEach(function(el){el.disabled=true;});msg.textContent='단체 실적 저장 중…';
   var out=await groupRequest(s.payload);
   await applyGroupResult(out);
   msg.textContent='반영 완료 · '+s.payload.entries.length+'건, '+s.payload.entries.reduce(function(n,r){return n+Number(r.count);},0)+'명';msg.className='ym-gr-success';try{var ids=s.payload.entries.map(function(r){return r.programId;});var totals=_salesBuild().filter(function(p){return ids.indexOf(p._mid)>=0;});if(totals.length)msg.textContent+=' · '+totals.map(function(p){return p.name+' 총 '+p.seats.toLocaleString()+'명 (단체 '+p.groupSeats.toLocaleString()+'명)';}).join(' / ');}catch(e){} 
   document.getElementById('ym-gr-save').textContent='확인';document.getElementById('ym-gr-save').onclick=close;var cancel=document.getElementById('ym-gr-cancel');cancel.textContent='입력 취소';cancel.setAttribute('data-ui-tone','danger');cancel.onclick=async function(){if(s.busy)return;s.busy=true;cancel.disabled=true;document.getElementById('ym-gr-save').disabled=true;try{var r=await groupRequest(Object.assign({},s.payload,{undo:true}));await applyGroupResult(r);msg.textContent='방금 입력한 단체 실적을 취소했습니다.';cancel.hidden=true;}catch(e){msg.textContent=(e.name==='AbortError'?'취소 응답을 확인하지 못했습니다.':'입력 취소 결과를 확인하지 못했습니다: '+e.message)+' 입력 취소를 다시 눌러 같은 요청의 결과를 확인하세요.';cancel.disabled=false;}finally{s.busy=false;document.getElementById('ym-gr-save').disabled=false;}};
  }catch(e){msg.className='';msg.textContent=s.payload?(e.name==='AbortError'?'저장 응답을 확인하지 못했습니다.':e.message)+' 입력 내용은 유지됩니다. 이 창에서 저장을 다시 눌러 같은 요청의 결과를 확인하세요.':e.message;}
  finally{s.busy=false;document.getElementById('ym-gr-save').disabled=false;document.getElementById('ym-gr-cancel').disabled=false;document.querySelector('.ym-gr-close').disabled=false;}
 }
 window.ymGroupOpen=open;
 // UI-CONTRACT-V1: common CSS owns the group form.
})();
