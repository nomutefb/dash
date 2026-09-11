// Installed only into the development checkout. Never publish automatically.
onBootstrap(function(e){e.next();try{require(__hooks+'/ym-auth-lib.js').setup(e.app);}catch(err){console.log('[ym-auth] migration blocked; existing rows retained; authentication closed');}});
routerUse(function(e){return require(__hooks+'/ym-auth-lib.js').guard(e,$app);});
routerAdd('POST','/api/ym/auth/{action}',function(e){return require(__hooks+'/ym-auth-lib.js').handle(e,$app,e.request.pathValue('action'));});
