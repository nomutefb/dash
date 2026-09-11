(function(){
 if(location.pathname.indexOf('/service/coder/preview/9b659b4f-08bb-4d94-adb5-57b9cf9be52e/')!==0||window.__ymRelayPermissionUi)return;window.__ymRelayPermissionUi=true;
 var box;
 function remove(){if(box){box.remove();box=null;}}
 async function inspect(){
  if(typeof userRole==='undefined'||!userRole)return;
  if(window.__ymLocalRelay&&window.__ymLocalRelay.connected){remove();return;}
  var permission;try{permission=await navigator.permissions.query({name:'local-network-access'});}catch{return;}
  if(permission.state==='granted'){remove();return;}
  if(box)return;
  box=document.createElement('div');box.id='ym-relay-permission';box.style.cssText='position:fixed;bottom:22px;right:22px;z-index:12000;max-width:330px;padding:16px;background:#fff;border:1px solid #d5dfdb;border-radius:12px;box-shadow:0 4px 18px #0002;font-size:13px;line-height:1.6;color:#234';
  var text=document.createElement('div');text.textContent=permission.state==='denied'?'수집기 연결이 차단되어 있습니다. 브라우저 사이트 설정에서 로컬 네트워크 접근을 허용해 주세요.':'이 PC의 수집기에 연결하려면 브라우저에서 로컬 네트워크 접근을 한 번 허용해 주세요. 수집기에서는 셀러만 로그인합니다.';box.appendChild(text);
  var button=document.createElement('button');button.textContent='수집기 연결 허용';button.style.cssText='margin-top:10px;padding:8px 12px;border:0;border-radius:8px;background:#08785d;color:white;cursor:pointer';
  button.onclick=function(){button.disabled=true;button.textContent='브라우저 권한 창에서 허용해 주세요';fetch('http://127.0.0.1:19741/next',{method:'POST',headers:{'Content-Type':'application/json','X-Ym-Relay':'1'},body:'{"clientId":""}',signal:AbortSignal.timeout(60000)}).then(function(r){if(r.status===400){remove();return;}throw Error('CONNECT');}).catch(function(){button.disabled=false;button.textContent='수집기 연결 다시 확인';text.textContent='수집기가 실행 중인지 확인하고 브라우저의 로컬 네트워크 접근을 허용해 주세요.';});};box.appendChild(button);document.body.appendChild(box);
 }
 setInterval(inspect,3000);inspect();
})();
