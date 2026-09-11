function handle(e,app,hooks){try{
 var env=require(hooks+'/ym-env-lib.js');if(env.envOf(e)!=='dev')return e.json(403,{ok:false,error:'DEV_ONLY'});
 var input=e.requestInfo().body||{},payload=String(input.payload||'');if(payload.length>16000000)return e.json(413,{ok:false,error:'RELAY_TOO_LARGE'});
 var key=require(hooks+'/ym-ticketlink-private.js').key;
 if(!$security.equal($security.hs256(payload,key),String(input.signature||'')))return e.json(403,{ok:false,error:'RELAY_SIGNATURE_INVALID'});
 var task=JSON.parse(payload),allowed=['heartbeat','claim','apply','failure','login-state','member-heartbeat','member-login-state','member-begin','member-chunk','member-commit','member-failure'];
 if(task.id!==input.id||allowed.indexOf(task.action)<0||!task.expires||task.expires<Date.now()||task.expires>Date.now()+100000)return e.json(403,{ok:false,error:'RELAY_TASK_INVALID'});
 var proxy={request:{method:'POST',url:e.request.url,header:{get:function(k){return k==='X-Ym-Collector'?key:e.request.header.get(k);}}},requestInfo:function(){return {body:task.body||{}};},json:function(code,data){return e.json(code,data);}};
 if(task.action.indexOf('member-')===0)return require(hooks+'/ym-member-sync-lib.js').handle(proxy,app,hooks,task.action.slice(7));
 return require(hooks+'/ym-ticketlink-lib.js').handle(proxy,app,hooks,task.action);
}catch(err){return e.json(400,{ok:false,error:String(err.message||err)});}}
module.exports={handle:handle};
