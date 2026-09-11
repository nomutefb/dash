/* Development email/PIN UI adapter. Existing PIN circles, shader and entry animation remain in standalone.html. */
(function(){
 'use strict';
 if(location.pathname.indexOf('/service/coder/preview/')<0)return;
 var A=window.YMAuth={session:'',principal:null,challenge:'',stage:'password',email:'',remember:true,started:false,busy:false};
 var STORE='ym.auth.trust.9b659b4f-08bb-4d94-adb5-57b9cf9be52e', savedPassword='';
 var nativeFetch=window.fetch.bind(window);
 function $(id){return document.getElementById(id);}
 function text(id,value){var el=$(id);if(el)el.textContent=value;}
 function show(id,on){var el=$(id);if(el)el.style.display=on?'':'none';}
 function clearOld(){['pw','role','subAdminPin','acctPin','isAcct','myEmail','myApplicant','myUserDept','_lockedAt'].forEach(function(k){sessionStorage.removeItem(k);});localStorage.removeItem('_resumePin');localStorage.removeItem('_msAutoRedirAt');}
 function trust(){try{return JSON.parse(localStorage.getItem(STORE)||'null');}catch(e){return null;}}
 function clearTrust(){localStorage.removeItem(STORE);}
 function rememberEmail(){if(A.email)localStorage.setItem(STORE+'.email',A.email);}
 function message(value){text('ym-auth-msg',value);text('login-msg',value);text('login-load','');}
 // YM_AUTH_BOOT_260910: Initial protected requests wait for the server-issued session. Auth endpoints stay available.
 var initialSessionReady=false,sessionWaiters=[];
 function releaseSessionWaiters(){initialSessionReady=true;sessionWaiters.splice(0).forEach(function(done){done();});}
 function waitForInitialSession(signal){
  if(A.session||initialSessionReady)return Promise.resolve();
  return new Promise(function(resolve,reject){
   function remove(){var i=sessionWaiters.indexOf(done);if(i>=0)sessionWaiters.splice(i,1);if(signal)signal.removeEventListener('abort',abort);}
   function done(){remove();resolve();}
   function abort(){remove();reject(signal.reason||new DOMException('The operation was aborted.','AbortError'));}
   if(signal&&signal.aborted){abort();return;}
   sessionWaiters.push(done);if(signal)signal.addEventListener('abort',abort,{once:true});
  });
 }
 // Inject only into same-origin MISO app APIs. Do not transmit session tokens to other origins.
 window.fetch=function authenticatedFetch(input,init){
  var url=new URL(typeof input==='string'?input:input.url,location.href),opts=Object.assign({},init||{});
  var appApi=url.origin===location.origin&&(/\/api\//.test(url.pathname)||/\/_runtime\/api\//.test(url.pathname));
  var protectedApi=appApi&&!/\/ym\/auth\//.test(url.pathname);
  if(protectedApi&&!A.session&&!initialSessionReady)return waitForInitialSession(opts.signal||(input instanceof Request?input.signal:undefined)).then(function(){return authenticatedFetch(input,init);});
  var requestSession=A.session;
  if(appApi){
   var headers=new Headers(opts.headers||(input instanceof Request?input.headers:undefined));headers.set('X-Ym-Env','dev');headers.delete('X-Sub-Admin-PIN');headers.delete('X-Acct-PIN');
   if(requestSession)headers.set('X-Ym-Session',requestSession);else headers.delete('X-Ym-Session');opts.headers=headers;
  }
  return nativeFetch(input,opts).then(function(response){
   // An old or unauthenticated response must never invalidate a newer login.
   if(protectedApi&&response.status===401&&requestSession&&A.session===requestSession){A.session='';A.principal=null;clearOld();clearTrust();A.started=false;A.start().catch(function(){A.passwordForm();message('인증을 다시 확인해 주세요');});}
   return response;
  });
 };
 async function request(action,body){
  var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},20000);
  try{var r=await window.fetch(new URL('__runtime/api/ym/auth/'+action,location.href).href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{}),signal:controller.signal});var result;try{result=await r.json();}catch(e){throw Error('로그인을 완료하지 못했습니다. 다시 시도해 주세요');}if(!r.ok||result.ok===false){var error=Error(result.error||'요청 실패');error.status=r.status;error.retryPin=result.retryPin;throw error;}return result;}finally{clearTimeout(timer);}
 }
 function formBase(title,fields,button,handler){
  window._pinActive=false;show('bottom-nav',false);document.querySelectorAll('.modal-bg').forEach(function(el){if(!el.closest('#login'))el.remove();});show('app',false);show('login',true);show('account-step',true);show('pin-step',false);
  var root=$('account-step');if(!root)throw Error('LOGIN_DOM_MISSING');
  root.innerHTML='<style>#ym-auth-form .iobtn{display:none!important}#ym-auth-form input{padding:10px 12px!important}#ym-auth-form input::placeholder{color:var(--dim);opacity:.65}#ym-auth-msg:empty{display:none}#ym-auth-form .ym-field-label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}</style><form id="ym-auth-form" style="display:grid;gap:12px;text-align:left">'+(title?'<h2 style="font-size:18px;margin:0 0 6px;color:var(--accent);text-align:center">'+title+'</h2>':'')+fields+'<p id="ym-auth-msg" role="alert" style="color:var(--danger,#c83434);font-size:12px;margin:0"></p><button type="submit" class="btn btn-primary" style="width:100%">'+button+'</button><button type="button" id="ym-auth-switch" class="btn" style="display:none">사용자 전환</button></form>';
  $('ym-auth-form').onsubmit=function(e){e.preventDefault();if(A.busy)return;A.busy=true;var btn=this.querySelector('button[type=submit]');btn.disabled=true;Promise.resolve().then(handler).catch(function(err){message(err.name==='AbortError'?'잠시 후 다시 시도해 주세요':err.message);}).finally(function(){A.busy=false;btn.disabled=false;});};
  $('ym-auth-switch').onclick=A.logout;
  var style=document.createElement('style');style.textContent='#ym-auth-form input{height:46px;border-radius:10px!important;font:inherit;font-size:14px;line-height:22px;transition:border-color .15s,box-shadow .15s}#ym-auth-form input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 18%,transparent)}#ym-auth-form .ym-password-field{position:relative;display:block}#ym-auth-form .ym-password-field input{padding-right:44px!important}#ym-auth-form .ym-auth-eye{position:absolute;right:5px;top:4px;width:38px;height:38px;border:0;background:transparent;color:var(--dim);display:grid;place-items:center;cursor:pointer;border-radius:7px}#ym-auth-form .ym-auth-eye:hover{color:var(--text)}#ym-auth-form button[type=submit]{height:44px;border-radius:10px;margin-top:4px}';root.appendChild(style);
  var finishStyle=document.createElement('style');finishStyle.textContent='#ym-auth-form .ym-field-shell{display:block;position:relative}#ym-auth-form .ym-field-icon{position:absolute;left:15px;top:50%;transform:translateY(-50%);display:flex;z-index:2;color:var(--dim);pointer-events:none;transition:color .18s}#ym-auth-form .ym-field-shell:focus-within .ym-field-icon{color:var(--accent)}#ym-auth-form .ym-field-shell input{height:48px;padding-left:44px!important;padding-right:44px!important;transition:border-color .18s,background .18s,box-shadow .18s,color .18s}#ym-auth-form input:focus{outline:none}#ym-auth-form input::placeholder{font-size:13px;font-weight:400}#ym-auth-form .ym-password-field{display:block}#ym-auth-form{gap:16px!important}#ym-auth-form input{background:rgba(255,255,255,.55)!important;border:1px solid rgba(255,255,255,.42)!important;border-radius:10px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.2)!important;backdrop-filter:blur(12px);caret-color:var(--accent)}#ym-auth-form input:hover{background:rgba(255,255,255,.65)!important;border-color:var(--accent)!important}#ym-auth-form input:focus{color:var(--accent)!important;border-color:var(--accent)!important;box-shadow:0 0 0 2px rgba(74,77,231,.18)!important}#ym-auth-form input::placeholder{color:var(--text);opacity:.48}#ym-auth-form button[type=submit]{margin-top:12px;border:1px solid rgba(255,255,255,.38);background:linear-gradient(120deg,rgb(103,107,238),rgb(137,105,217));backdrop-filter:blur(16px);color:#fff;font-size:14px;font-weight:600;line-height:22px;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 4px 14px rgba(74,77,231,.14);transition:opacity .15s,transform .15s}#ym-auth-form button[type=submit]:hover{opacity:.9}#ym-auth-form button[type=submit]:active{transform:translateY(1px)}#ym-auth-form button[type=submit]:disabled{opacity:.55;cursor:wait}';finishStyle.textContent+='#ym-auth-form input{background:rgba(255,255,255,.55)!important}#ym-auth-form input.ym-remembered-email{background:rgba(255,255,255,.55)!important;color:var(--accent)!important;font-weight:700!important}#ym-auth-form input:-webkit-autofill{-webkit-text-fill-color:var(--text);transition:background-color 999999s;box-shadow:inset 0 1px 0 rgba(255,255,255,.2)!important}#ym-auth-form input.ym-remembered-email:-webkit-autofill{-webkit-text-fill-color:var(--accent);transition:background-color 999999s;box-shadow:inset 0 1px 0 rgba(255,255,255,.2)!important}';finishStyle.textContent+='#ym-auth-form input.ym-company-readonly,#ym-auth-form input.ym-company-readonly:hover,#ym-auth-form input.ym-company-readonly:focus{background:rgba(220,223,230,.58)!important;color:var(--dim)!important;border-color:rgba(255,255,255,.42)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.2)!important;cursor:default}';root.appendChild(finishStyle);
  root.querySelectorAll('.ym-auth-eye').forEach(function(button){button.onclick=function(e){e.preventDefault();var input=$(button.getAttribute('data-input')),visible=input.type==='password';input.type=visible?'text':'password';button.setAttribute('aria-label',visible?'비밀번호 숨기기':'비밀번호 보기');button.setAttribute('aria-pressed',String(visible));button.innerHTML=eyeIcon(visible);input.closest('.ym-field-shell').querySelector('.ym-field-icon').innerHTML=fieldIcon(input.id,'password',visible);};});
  bindPasswordFeedback(root);text('login-msg','');text('login-load','');try{startLoginShader();}catch(e){}
 }
 function bindPasswordFeedback(root){
  var css=document.createElement('style');css.textContent='#ym-auth-form input[data-match="yes"]{border-color:var(--success,var(--green,#2e9d66))!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--success,var(--green,#2e9d66)) 15%,transparent)!important}#ym-auth-form input[data-match="no"]{border-color:var(--danger,var(--red,#d84949))!important;box-shadow:none!important}.ym-password-shake{animation:ym-password-shake .3s ease-in-out}.ym-caps-note{font-size:11px;font-weight:600;color:var(--accent2,var(--accent));margin:5px 0 0}.ym-caps-note[hidden]{display:none}@keyframes ym-password-shake{0%,100%{transform:translateX(0)}25%,75%{transform:translateX(-4px)}50%{transform:translateX(4px)}}@media(prefers-reduced-motion:reduce){.ym-password-shake{animation:none}}';root.appendChild(css);
  root.querySelectorAll('.ym-password-field input').forEach(function(input){var note=document.createElement('span');note.className='ym-caps-note';note.id=input.id+'-caps';note.hidden=true;note.setAttribute('role','status');note.textContent='Caps Lock이 켜져 있습니다';input.closest('label').appendChild(note);input.setAttribute('aria-describedby',note.id);function caps(e){if(e.getModifierState)note.hidden=!e.getModifierState('CapsLock');}input.addEventListener('keydown',caps);input.addEventListener('keyup',caps);input.addEventListener('blur',function(){note.hidden=true;});});
  var first=$('ym-new-password'),confirm=$('ym-confirm-password');if(!first||!confirm)return;
  function compare(){var p=first.value,c=confirm.value,match=!!c&&p===c,bad=!!c&&c.length>=p.length&&!match,old=confirm.dataset.match;confirm.dataset.match=match?'yes':bad?'no':'';confirm.setCustomValidity(c&&p!==c?'비밀번호 확인이 일치하지 않습니다':'');confirm.setAttribute('aria-invalid',bad?'true':'false');if(bad&&old!=='no'){var shell=confirm.closest('.ym-field-shell');shell.classList.remove('ym-password-shake');void shell.offsetWidth;shell.classList.add('ym-password-shake');}root.querySelector('button[type=submit]').disabled=!(match&&p.length>=8&&p.length<=64&&/[a-z]/.test(p)&&/[^a-zA-Z0-9\s]/.test(p));}
  first.addEventListener('input',compare);confirm.addEventListener('input',compare);compare();
 }

 function eyeIcon(visible){return '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'+(visible?'<path d="M3 3l18 18"/>':'')+'</svg>';}
 function fieldIcon(id,type,visible){var path=id==='ym-company'?'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 21v-4h6v4M8 7h1m6 0h1M8 11h1m6 0h1"/>':type==='email'?'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>':'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>';if(visible)path='<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 7.5-2M12 14v3"/>';return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg>';}
 function field(id,label,type,auto,extra){var input='<input id="'+id+'" name="'+id+'" placeholder="'+label+'" type="'+type+'" autocomplete="'+auto+'" autocapitalize="none" spellcheck="false" required '+(extra||'')+' style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-solid);color:var(--text)">';if(type==='password')input='<span class="ym-password-field">'+input+'<button class="ym-auth-eye" type="button" data-input="'+id+'" aria-label="비밀번호 보기" aria-pressed="false">'+eyeIcon(false)+'</button></span>';input='<span class="ym-field-shell"><span class="ym-field-icon" aria-hidden="true">'+fieldIcon(id,type)+'</span>'+input+'</span>';return '<label style="display:grid;font-size:12px" for="'+id+'"><span class="ym-field-label">'+label+'</span>'+input+'</label>';}
 A.passwordForm=function(){
  A.stage='password';A.challenge='';A.pinSetup=null;savedPassword='';
  formBase('',field('ym-company','회사코드','text','off','inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6"')+field('ym-email','이메일','email','username','maxlength="254"')+field('ym-password','비밀번호','password','current-password','maxlength="128"'),'Sign in',async function(){
   var email=$('ym-email').value.trim().toLowerCase(),password=$('ym-password').value;A.remember=true;
   var result;try{result=await request('login',{companyCode:$('ym-company').value.trim(),email:email,password:password});}finally{$('ym-password').value='';password='';}
   A.email=result.email;rememberEmail();_loginEmail=A.email;A.challenge=result.challenge;A.stage=result.stage;
   if(result.stage==='enroll'||result.stage==='reset-password')A.enrollPassword();else if(result.stage==='reset-pin')A.enrollPin();else A.pinScreen();
  });
  if(!A.email)A.email=localStorage.getItem(STORE+'.email')||'';if(A.email)$('ym-email').value=A.email;
  ['ym-password'].forEach(function(id){var input=$(id);input.value='';input.setAttribute('autocomplete',id==='ym-password'?'new-password':'off');input.readOnly=true;input.addEventListener('focus',function(){input.value='';input.readOnly=false;},{once:true});});
  $('ym-email').classList.toggle('ym-remembered-email',!!A.email);
  $('ym-auth-switch').style.display='none';var company=$('ym-company');company.value='';var edited=false;company.addEventListener('input',function(){edited=true;});company.focus();
  request('company-prefill',{}).then(function(r){if(A.stage!=='password'||$('ym-company')!==company||edited)return;if(r.enabled&&/^\d{6}$/.test(r.value)){company.value=r.value;company.readOnly=true;company.classList.add('ym-company-readonly');if(document.activeElement===company)$('ym-email').focus();}}).catch(function(){});
 };
 A.enrollPassword=function(){
  formBase('개인 비밀번호 설정',field('ym-new-password','새 비밀번호','password','new-password','minlength="8" maxlength="64"')+field('ym-confirm-password','새 비밀번호 확인','password','new-password','minlength="8" maxlength="64"')+'<p style="font-size:12px;color:var(--dim)"><strong><span style="color:var(--accent)">소문자</span>와 <span style="color:var(--accent)">특수문자</span>를 포함해 <span style="color:var(--accent)">최소 8자</span>로 설정해 주세요.</strong></p>',A.stage==='reset-password'?'비밀번호 설정':'PIN 설정으로',async function(){
   var p=$('ym-new-password').value,c=$('ym-confirm-password').value;if(p.length<8||p.length>64||!/[a-z]/.test(p)||!/[^a-zA-Z0-9\s]/.test(p))throw Error('소문자와 특수문자를 포함한 8자 이상 비밀번호를 입력해 주세요');if(p!==c)throw Error('비밀번호 확인이 일치하지 않습니다');if(A.stage==='reset-password'){var result=await request('set-reset-password',{challenge:A.challenge,password:p,confirmPassword:c});A.challenge=result.challenge;A.stage='pin';savedPassword='';A.pinSetup=null;A.pinScreen();return;}savedPassword=p;A.enrollPin();
  });$('ym-new-password').focus();
 };
 A.enrollPin=function(){
  A.pinSetup={mode:A.stage==='reset-pin'?'set-reset-pin':'enroll',first:null};A.pinScreen();text('login-msg','새 PIN 입력');text('login-load','');
 };
 A.paintSetupPin=function(){var done=$('ym-pin-complete');if(done)done.remove();Array.from(pins).forEach(function(input){input.style.removeProperty('border-color');input.style.removeProperty('box-shadow');input.removeAttribute('aria-invalid');});};
 A.submitSetupPin=async function(pin){
  var setup=A.pinSetup;if(!setup||A.busy||!/^\d{4}$/.test(pin))return;A.busy=true;
  try{
   if(setup.first===null){setup.first=pin;_pinClear(false);text('login-msg','같은 PIN을 한 번 더 입력하세요');text('login-load','');_pinFocusFirst();return;}
   if(pin!==setup.first){setup.first=null;_pinClear(true);text('login-msg','PIN이 일치하지 않습니다. 처음부터 새 PIN을 설정하세요');text('login-load','');_pinFocusFirst();return;}
   text('login-load','설정 중');var result=await request(setup.mode,{challenge:A.challenge,password:savedPassword,confirmPassword:savedPassword,pin:pin,confirmPin:setup.first,remember:true});setup.first=null;savedPassword='';A.pinSetup=null;A.paintSetupPin();await A.accept(result);}
  catch(e){setup.first=null;text('login-load','');_pinClear(true);text('login-msg',e.message+' · 새 PIN을 처음부터 입력하세요');_pinFocusFirst();if(e.status===401){A.pinSetup=null;savedPassword='';A.passwordForm();message(e.message);}}
  finally{A.busy=false;}
 };
 A.pinScreen=function(){
  _loginEmail=A.email;show('bottom-nav',false);window._pinActive=true;show('app',false);show('login',true);show('account-step',false);show('pin-step',true);
  try{_enterPinInputStep();}catch(e){_pinClear(false);_pinFocusFirst();}
  text('pin-account',A.pinSetup?'새 PIN 설정':'2차 PIN');if($('pin-account')){$('pin-account').style.color='var(--accent)';$('pin-account').style.textAlign='center';}text('login-msg',A.pinSetup?'새 PIN 입력':'');
  var back=$('ym-pin-switch');if(!back){back=document.createElement('button');back.id='ym-pin-switch';back.type='button';back.className='ym-pin-switch';back.style.cssText='display:block;width:auto;margin:18px auto 0;padding:4px 8px;background:transparent;border:0;color:var(--dim);font:inherit;font-size:12px;text-decoration:underline;text-underline-offset:3px;cursor:pointer';back.textContent='사용자 전환';$('pin-step').appendChild(back);}back.onclick=A.logout;back.style.display=A.pinSetup?'none':'block';
 };
 A.submitPin=async function(){
  if(A.busy)return;var pin=Array.from(pins).map(function(p){return p.value;}).join('');if(!/^\d{4}$/.test(pin))return;if(A.pinSetup)return A.submitSetupPin(pin);A.busy=true;text('login-load','확인 중');text('login-msg','');
  try{var result=await request('pin',{challenge:A.challenge,pin:pin,remember:A.remember});pin='';await A.accept(result);}catch(e){text('login-load','');text('login-msg',e.message);try{_pinClear(true);_pinFocusFirst();}catch(ignore){}if(e.status===401&&!e.retryPin){A.passwordForm();message(e.message);}}finally{A.busy=false;}
 };
 A.accept=async function(result){
  if(!result.session||!result.principal)throw Error('인증 응답을 확인하지 못했습니다');
  A.session=result.session;A.principal=result.principal;A.email=result.principal.email;A.challenge='';A.stage='authenticated';releaseSessionWaiters();
  rememberEmail();if(result.trust)localStorage.setItem(STORE,JSON.stringify({token:result.trust,email:A.email}));
  clearOld();var p=A.principal;password='REQUIRES_LOCAL_CONFIGURATION';userRole=p.admin?'admin':'user';_loginEmail=p.email;
  sessionStorage.setItem('pw','authenticated');sessionStorage.setItem('role',userRole);sessionStorage.setItem('isAcct',p.accountant?'1':'');sessionStorage.setItem('myEmail',p.email);sessionStorage.setItem('myApplicant',p.name);sessionStorage.setItem('myUserDept',p.department);
  show('bottom-nav',true);if(result.config)_applyLockMin(result.config.lock_minutes);A.updateSettings();if(!A.can('businessView'))_mainView='cal';
  show('account-step',false);show('pin-step',true);text('pin-account',p.email);text('login-load','');text('login-msg','');
  var pinMotionDelay=0;
  try{if(!p.devAutoLogin){if(typeof _pinFirstHintStop==='function')_pinFirstHintStop();var wrap=document.querySelector('#pin-step .pin-wrap');Array.from(pins).forEach(function(el){clearTimeout(el._at);el.value='';el.type='password';el.classList.remove('lit','err');el.classList.add('filled');});if(wrap){wrap.classList.remove('success');void wrap.offsetWidth;wrap.classList.add('success');pinMotionDelay=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:1250;}}}catch(e){}
  if(A.policyTimer)clearInterval(A.policyTimer);A.lastLockMinutes=result.config&&result.config.lock_minutes;A.policyTimer=setInterval(async function(){if(!A.session)return;try{var current=await request('me',{});A.principal=current.principal;if(current.config&&current.config.lock_minutes!==A.lastLockMinutes){A.lastLockMinutes=current.config.lock_minutes;_applyLockMin(current.config.lock_minutes);resetIdleTimer();}}catch(e){if(e.status===401){clearInterval(A.policyTimer);A.session='';A.principal=null;clearOld();clearTrust();A.started=false;await A.start();}}},60000);
  if(pinMotionDelay)await new Promise(function(r){setTimeout(r,pinMotionDelay);});if(A.session===result.session&&A.stage==='authenticated')_enterApp();
 };
 A.rememberedForm=function(){
  formBase('',field('ym-known-email','이메일','email','off','readonly'),'Sign in',async function(){
   var t=trust();if(!t||!t.token){A.passwordForm();return;}
   try{var result=await request('resume',{trust:t.token});if(result.session){await A.accept(result);return;}A.challenge=result.challenge;A.email=result.email;A.stage='pin';A.pinScreen();}catch(e){if(e.status===401||e.status===403){clearTrust();A.passwordForm();}throw e;}
  });
  $('ym-known-email').value=A.email;$('ym-known-email').classList.add('ym-remembered-email');
  var sw=$('ym-auth-switch');sw.style.cssText='display:block;width:auto;justify-self:center;border:0;background:transparent;font-size:12px;color:var(--dim);padding:4px 8px;text-decoration:underline;text-underline-offset:3px';
 };
 A.start=async function(){
  if(A.started)return;A.started=true;A.session='';A.principal=null;clearOld();window._OPEN_ENTRY=false;window._QA=false;show('app',false);
  // YM_PREVIEW_DIRECT_ENTRY_260908: server validates exact preview route and active dev principal.
  show('login',false);
  try{var direct=await request('preview-entry',{});if(direct.session){await A.accept(direct);return;}}catch(directError){}
  var t=trust();if(t&&t.token){A.email=t.email||'';A.remember=true;try{var result=await request('resume',{trust:t.token});if(result.session){await A.accept(result);return;}A.challenge=result.challenge;A.email=result.email;A.stage='remembered';A.rememberedForm();return;}catch(e){clearTrust();}}
  A.passwordForm();
 };
 A.logout=async function(){
  if(A.busy)return;A.busy=true;if(A.policyTimer)clearInterval(A.policyTimer);var t=trust();
  try{await request('logout',{trust:t&&t.token});}catch(e){}
  rememberEmail();clearTrust();clearOld();A.session='';A.principal=null;savedPassword='';A.challenge='';A.remember=false;
  try{_stopIdleTimer();_memPurge();}catch(e){}location.reload();
 };
 A.lock=async function(){
  if(!A.session||A.stage==='locked')return;A.stage='locked';show('app',false);show('bottom-nav',false);document.querySelectorAll('.modal-bg').forEach(function(el){if(!el.closest('#login'))el.remove();});try{_ddCloseAll();closeAdminPanel();}catch(ignore){}var login=$('login'),card=document.querySelector('.login-card');if(login)login.classList.remove('login-leave');if(card)card.classList.remove('lc-lift');try{_memPurge();_stopIdleTimer();}catch(e){}
  try{var result=await request('lock',{trust:(trust()||{}).token||''});if(result.session){await A.accept(result);return;}A.session='';A.principal=null;clearOld();A.challenge=result.challenge;A.email=result.email;A.pinScreen();}catch(e){A.session='';A.principal=null;clearOld();A.passwordForm();message('인증을 다시 진행해 주세요');}
 };
 A.isSuper=function(){return !!(A.principal&&A.principal.superadmin);};
 A.resetPin=async function(email){try{await request('reset-pin',{targetEmail:email});showToast('다음 이메일·비밀번호 로그인 후 새 PIN을 설정합니다','success');}catch(e){showToast(e.message,'error');}};
 A.saveEmail=async function(rowIndex){var e1=$('er-email1').value.trim().toLowerCase(),e2=$('er-email2').value.trim().toLowerCase();if(e1!==e2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e1)){showToast('이메일과 확인값을 확인해 주세요','error');return;}try{await api('PATCH','/api/sheet/manager/'+rowIndex,{values:{'이메일':e1}});await renderSheetList('manager');closeEmailReset();showToast('이메일 변경 완료. 기존 인증은 해제되었습니다','success');}catch(e){showToast(e.message,'error');}};
 A.managerList=function(rows){
  A.updateSettings();var cols=SHEET_CONFIG.manager.columns;
  var out='<p style="font-size:12px;color:var(--dim)">슈퍼관리자: Avery Reed 08336 · 권한 지정과 사용자 관리는 슈퍼관리자만 가능합니다. 사용 중지는 활성 해제로 처리합니다.</p><div style="overflow:auto"><table class="sheet-table"><thead><tr>'+cols.map(function(c){return '<th>'+escapeHtml(c.label)+'</th>';}).join('')+'<th>인증</th><th>저장</th></tr></thead><tbody>';
  rows.forEach(function(r){var idx=Number(r._rowIndex),fixed=r._superadmin===true;out+='<tr data-row="'+idx+'">';cols.forEach(function(c){var locked=(!A.isSuper()&&(fixed||WORK.indexOf(c.key)<0))||(fixed&&['계정여부','휴직여부','관리자여부','담당자','이메일'].indexOf(c.key)>=0);out+='<td><input data-key="'+c.key+'" '+(locked?'disabled ':'')+(c.type==='checkbox'?'type="checkbox" '+(isFlagOn(r[c.key])?'checked':''):'type="text" value="'+escapeHtml(String(r[c.key]||''))+'"')+' style="'+(c.type==='checkbox'?'':'min-width:80px;max-width:180px;')+'" onchange="document.getElementById(\'save-manager-'+idx+'\').disabled=false"></td>';});out+='<td>'+ A.resetButtons(r)+'</td><td><button class="btn" id="save-manager-'+idx+'" disabled onclick="saveInlineRow(\'manager\','+idx+')">저장</button></td></tr>';});return out+'</tbody></table></div>';
 };
 A.resetButtons=function(r){
  var idx=Number(r._rowIndex),allowed=A.principal&&A.principal.superadmin&&!r._superadmin&&r._id!==A.principal.id&&(A.isSuper()||!['관리자여부','회계여부','홍보여부'].some(function(k){return isFlagOn(r[k]);}));
  return ['password','pin'].map(function(kind){var configured=kind==='password'?r._passwordConfigured:r._pinConfigured,label=kind==='password'?'비밀번호':'PIN',icon=kind==='password'?fieldIcon('','password'):'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="4"/><path d="m11 11 10 10m-5-5 3-3m-6 0 3-3"/></svg>';return '<button type="button" class="btn" style="padding:7px;display:inline-flex;vertical-align:middle;margin-right:5px" title="'+label+(configured?' 초기화':' 설정 대기')+'" aria-label="'+label+' 초기화" '+(!allowed||!configured?'disabled':'')+' data-reset-kind="'+kind+'" data-reset-row="'+idx+'">'+icon+'</button>';}).join('');
 };
 document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('button[data-reset-kind]');if(b&&!b.disabled)A.confirmCredentialReset(Number(b.dataset.resetRow),b.dataset.resetKind);});
 A.confirmCredentialReset=function(idx,kind){
  var row=(_sheetCache.manager||[]).find(function(r){return Number(r._rowIndex)===idx;});if(!row||['password','pin'].indexOf(kind)<0)return;
  var label=kind==='password'?'비밀번호':'PIN',root=document.createElement('div');root.className='modal-bg show';root.style.zIndex='10000';root.innerHTML='<div class="modal" style="max-width:380px"><h3>'+escapeHtml(row['담당자']||'사용자')+'님의 '+label+'를 초기화하시겠습니까?</h3><p>다음 접속 시 '+label+'만 다시 설정합니다.</p><div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn" data-no>아니요</button><button class="btn btn-primary" data-yes>예</button></div><p role="alert" style="color:var(--danger)"></p></div>';document.body.appendChild(root);root.querySelector('[data-no]').onclick=function(){root.remove();};root.querySelector('[data-yes]').onclick=async function(){this.disabled=true;try{await request('reset-'+kind,{targetId:row._id});root.remove();await renderSheetList('manager');showToast(label+' 초기화 완료','success');}catch(e){root.querySelector('[role=alert]').textContent=e.message;this.disabled=false;}};
 };
 A.resetRowPin=function(idx){A.confirmCredentialReset(idx,'pin');};

 A.securitySettings=function(){
  if(!A.isSuper()){showToast('슈퍼관리자만 보안 설정을 변경할 수 있습니다','error');return;}
  var root=$('admin-panel');if(!root){root=document.createElement('div');root.id='admin-panel';document.body.appendChild(root);}var on=!_idleLockDisabled,minutes=Math.max(1,Math.min(240,Math.round(IDLE_MS/60000)||30));
  root.innerHTML='<div class="modal-bg show"><div class="modal" style="width:420px;position:relative"><button class="modal-x" onclick="closeLockSettings()" aria-label="닫기">✕</button>'+_mhead('보안 관리','전체 사용자에게 적용')+'<label style="display:flex;justify-content:space-between">자동 잠금<input id="lock-enabled" type="checkbox" '+(on?'checked':'')+' onchange="_lockEnableChange(this.checked)"></label><div '+(on?'':'hidden')+' style="margin-top:16px"><label for="lock-min-input">잠금까지 대기 시간 (분)</label><input id="lock-min-input" type="number" min="1" max="240" value="'+minutes+'" onchange="_lockMinChange(Number(this.value))"></div><p style="font-size:12px;color:var(--dim);margin-top:20px">2차 PIN은 항상 필요합니다. 자동 잠금을 꺼도 로그인할 때는 PIN을 입력합니다.</p></div></div>';
  var panel=root.querySelector('.modal'),section=document.createElement('section');section.style.cssText='border-top:1px solid var(--border);padding-top:16px;margin-top:20px;display:grid;gap:10px';section.innerHTML='<h3 style="font-size:14px;margin:0 0 2px">회사코드 변경</h3><input id="ym-company-new" aria-label="새 회사코드" placeholder="새 회사코드 (6자리)" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"><input id="ym-company-confirm" aria-label="새 회사코드 확인" placeholder="새 회사코드 확인" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"><p style="font-size:12px;color:var(--dim);margin:0">변경하면 현재 계정을 포함한 모든 사용자가 다시 로그인합니다.</p><button id="ym-company-save" type="button" class="btn btn-primary">회사코드 변경</button>';panel.appendChild(section);$('ym-company-save').onclick=A.saveCompanyCode;
  var toggle=document.createElement('label');toggle.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:16px';toggle.innerHTML='회사코드 자동 입력<input type="checkbox" role="switch" aria-label="회사코드 자동 입력" disabled>';section.insertBefore(toggle,section.firstChild);var control=toggle.querySelector('input');request('company-prefill',{}).then(function(r){control.checked=r.enabled;control.disabled=false;}).catch(function(){showToast('회사코드 설정을 불러오지 못했습니다','error');});control.onchange=async function(){var desired=this.checked;this.disabled=true;try{await request('set-company-prefill',{enabled:desired});showToast('회사코드 자동 입력 '+(desired?'켜짐':'꺼짐'),'success');}catch(e){this.checked=!desired;showToast(e.message,'error');}finally{this.disabled=false;}};

 };
 A.saveCompanyCode=async function(){var code=$('ym-company-new').value,confirmation=$('ym-company-confirm').value;if(!/^\d{6}$/.test(code)||code!==confirmation){showToast('회사코드 6자리와 확인값을 확인해 주세요','error');return;}var button=$('ym-company-save');button.disabled=true;try{await request('set-company-code',{companyCode:code,confirmCompanyCode:confirmation});$('ym-company-new').value='';$('ym-company-confirm').value='';await A.logout();}catch(e){showToast(e.message,'error');button.disabled=false;}};
 A.userForm=function(rowIndex){
  if(!A.isSuper()){showToast('사용자 등록과 계정 정보 변경은 슈퍼관리자만 가능합니다','error');return;}
  A.updateSettings();var existing=rowIndex?(_sheetCache.manager||[]).find(function(r){return r._rowIndex===rowIndex;}):null;
  var html='<div class="modal-bg show" style="z-index:9500"><div class="modal" style="width:440px;max-height:88vh;overflow:auto;position:relative"><button class="modal-x" onclick="closeSheetForm()" aria-label="닫기">✕</button>'+_mhead(existing?'사용자 변경':'사용자 등록','등록 이메일로 최초 로그인합니다')+'<form id="sheet-form" onsubmit="event.preventDefault();saveSheetRow(\'manager\','+(rowIndex||'null')+')" style="display:grid;gap:12px">';
  SHEET_CONFIG.manager.columns.forEach(function(c){var value=existing?existing[c.key]:(c.key==='계정여부'?'1':'');html+='<label style="display:flex;justify-content:space-between;gap:12px">'+escapeHtml(c.label)+'<input name="'+c.key+'" '+(c.type==='checkbox'?'type="checkbox" '+(isFlagOn(value)?'checked':''):'type="'+(c.key==='이메일'?'email':'text')+'" value="'+escapeHtml(String(value||''))+'" '+(['이메일','담당자'].indexOf(c.key)>=0?'required':''))+'></label>';});html+='<button class="btn btn-primary" type="submit">저장</button></form></div></div>';
  var root=$('sheet-form-modal');if(!root){root=document.createElement('div');root.id='sheet-form-modal';document.body.appendChild(root);}root.innerHTML=html;
 };
 A.updateSettings=function(){
  if(typeof SHEET_CONFIG==='undefined')return;
  SHEET_CONFIG.manager.columns=SHEET_CONFIG.manager.columns.filter(function(c){return c.key!=='PIN'&&c.key!=='비밀번호';});
  var root=$('sheet-list');if(!root)return;
  root.querySelectorAll('[data-key]').forEach(function(el){var k=el.getAttribute('data-key');if(!A.isSuper())el.disabled=true;});
 };
 A.canBusinessField=function(field){var p=A.principal;if(!p||!A.session)return false;if(p.superadmin||p.admin)return true;var key={'기획 공연':'공연여부','공연':'공연여부','기획 전시':'전시여부','전시':'전시여부','예술 교육':'예술교육여부','교육':'예술교육여부'}[field];return !!key&&p.flags[key]===true;};
 A.businessFields=function(){return ['기획 공연','기획 전시','예술 교육'].filter(A.canBusinessField);};
 A.can=function(cap){
  var p=A.principal;if(!p||!A.session)return false;if(cap==='businessView'||cap==='customers'||cap==='contentView')return true;if(p.superadmin)return true;
  if(cap==='security'||cap==='users')return false;if(p.admin===true)return true;
  if(cap==='system')return false;
  if(cap==='finance')return p.accountant===true;
  if(cap==='promo')return p.flags['홍보여부']===true;
  if(cap==='salesUpdate')return p.admin===true||p.accountant===true;
  if(cap==='business')return p.admin===true||p.accountant===true||['공연여부','전시여부','예술교육여부'].some(function(k){return p.flags[k]===true;});
  if(cap==='settings')return p.flags['홍보여부']===true;
  return false;
 };
 A.visibleMenu=function(id){if(!A.principal||!A.session)return false;if(id==='aipromo')return A.can('customers');if(id==='biz'||id==='bizov'||id==='sales')return A.can('businessView');if(id==='content')return A.can('contentView');if(id==='admin')return A.can('settings');return ['cal','annual','platform','playzone','promo'].indexOf(id)>=0;};
 A.adminRouteAllowed=function(id){if(['security'].indexOf(id)>=0)return A.can('security');if(['logs','platform'].indexOf(id)>=0)return A.can('system');if(id==='users')return A.can('users');if(id==='applysettings')return A.can('promo');return !!(A.principal&&A.principal.admin);};
 A.adminGroups=function(groups){return groups.map(function(g){return {name:g.name,items:g.items.filter(function(it){return A.adminRouteAllowed(it[0]);})};}).filter(function(g){return g.items.length;});};
 A.roleTag=function(){var el=$('role-tag');if(!el)return;var p=A.principal;el.className='role-tag '+(p&&p.admin?'admin':'user');el.textContent=p&&p.superadmin?'슈퍼관리자':p&&p.admin?'관리자':p&&p.accountant?'회계':p&&p.flags['홍보여부']?'홍보':'사용자';el.title=el.textContent;el.onclick=null;};
 A.filterBusinessMenu=function(menu){if(!A.can('finance'))menu.querySelectorAll('button').forEach(function(b){if((b.getAttribute('onclick')||'').indexOf('openBizFinInput(')>=0)b.remove();});};

 var WORK=['기관여부','공연여부','전시여부','예술교육여부','대관여부'];
})();
