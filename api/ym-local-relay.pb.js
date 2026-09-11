routerAdd('POST','/api/ym/ticketlink/relay',function(e){
 return require(__hooks+'/ym-local-relay-lib.js').handle(e,$app,__hooks);
});
