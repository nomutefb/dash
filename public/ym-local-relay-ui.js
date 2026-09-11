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
