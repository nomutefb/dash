# -*- coding: utf-8 -*-
# [260904 발행관리 Phase8b] 앱이 자기 환경(dev=미리보기 / prod=발행)을 판단해 모든 __runtime/api 요청에 X-Ym-Env 헤더를 붙인다.
#   fetch 를 한 곳에서 감싸므로 본체의 수십 개 요청 지점을 손댈 필요 없음. 훅(ym-db.pb.js)은 이 헤더로 ymdata_dev / ymdata 를 고른다.
#   안전망: 켜진 뒤 서버(/api/ym/env)가 판정한 환경과 다르면 붉은 띠 + 쓰기 요청 차단(프록시가 헤더를 버리는 사고 대비).
#   실행: python3 tools/phase8b_app_env_260904.py (먼저 backups/ 로 cp)
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
assert 'X-Ym-Env' not in s, 'already applied'
tag='''<script>
/* [260904 발행관리] 환경 판정 + 요청 헤더. 미리보기 주소(/service/coder/preview/)면 dev, 그 외(발행 /site/)는 prod.
   훅은 dev 요청을 ymdata_dev/ymmeta_dev 로 보낸다 → 개발 중 구조를 바꿔도 발행본 데이터는 안 다친다. 절차는 docs/발행관리_설계.md · CLAUDE.md */
(function(){
  var env=(location.pathname.indexOf('/service/coder/preview/')>=0)?'dev':'prod';
  window.YM_ENV=env; window.YM_ENV_MISMATCH=false;
  var _fetch=window.fetch;
  window.fetch=function(input,init){
    try{
      var url=(typeof input==='string')?input:((input&&typeof input.url==='string')?input.url:String(input||''));
      if(url.indexOf('__runtime/api')>=0){
        var method=String((init&&init.method)||(input&&input.method)||'GET').toUpperCase();
        if(window.YM_ENV_MISMATCH&&method!=='GET')return Promise.reject(new Error('[YM_ENV] 환경 불일치 — 쓰기 차단'));
        if(typeof input!=='string'&&input&&typeof Request!=='undefined'&&input instanceof Request&&!init){ var h0=new Headers(input.headers); h0.set('X-Ym-Env',env); input=new Request(input,{headers:h0}); }
        else{ init=init?Object.assign({},init):{}; var h=new Headers(init.headers||((typeof input!=='string'&&input&&input.headers)||undefined)); h.set('X-Ym-Env',env); init.headers=h; }
      }
    }catch(_e2){}
    return _fetch.call(this,input,init);
  };
  function bar(msg,color){ try{ var d=document.createElement('div'); d.id='ymEnvBar'; d.textContent=msg; d.style.cssText='position:fixed;left:0;right:0;top:0;z-index:99999;background:'+color+';color:#fff;font:600 12px/1.4 sans-serif;text-align:center;padding:4px 8px'; document.body.appendChild(d); }catch(_e){} }
  document.addEventListener('DOMContentLoaded',function(){
    if(env==='dev'&&document.title.indexOf('[개발]')<0)document.title='[개발] '+document.title;
    var base=(location.pathname.match(/^(\\/service\\/coder\\/preview\\/[^/]+\\/|\\/site\\/[^/]+\\/)/)||['',''])[1];
    _fetch.call(window, base+'__runtime/api/ym/env',{headers:{'X-Ym-Env':env},cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      var here=(j&&j.here)||''; if(!here)return;
      if(here!==env){ window.YM_ENV_MISMATCH=true; bar('환경 불일치: 화면='+env+' / 서버='+here+' — 저장이 차단됩니다. 관리자에게 알려주세요.','#b00020'); console.error('[YM_ENV] mismatch',env,here); }
      else if(env==='dev'){ console.log('[YM_ENV] dev (ymdata_dev)'); }
    }).catch(function(){});
  });
})();
</script>
'''
i=s.find('<head>')
assert i>=0
s=s[:i+len('<head>')]+'\n'+tag+s[i+len('<head>'):]
io.open(P,'w',encoding='utf-8').write(s)
print('OK phase8b app env', len(s))
