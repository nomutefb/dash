# -*- coding: utf-8 -*-
# [260904 Phase9c] 개발 미리보기(dev+iframe)에서 원래 Microsoft 카드가 그대로 뜨고, "다른 계정으로 전환"은 담당자 선택으로 가게.
#   실행: python3 tools/phase9c_devlogin_260904.py (먼저 backups/ 로 cp)
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
assert '_devFrameShortcut' in s, 'phase9b not applied'
assert 'Phase9c' not in s, 'already applied'
a1="    // MISO 미리보기 iframe은 redirect와 popup 인증을 모두 막는다. 네이티브 링크로 최상위 창에서 시작한다.\n    if(_msalInFrame()){\n      _showMsalTopFramePrompt(step);\n      return;\n    }"
assert s.count(a1)==1, 'anchor initLogin else'
b1="    // MISO 미리보기 iframe은 redirect와 popup 인증을 모두 막는다. 발행본이면 최상위 창 안내, 개발(dev)이면 원래 Microsoft 카드를 그대로 보여준다(버튼 → PIN 직행). [260904 Phase9c]\n    if(_msalInFrame() && window.YM_ENV!=='dev'){\n      _showMsalTopFramePrompt(step);\n      return;\n    }"
s=s.replace(a1,b1)
a2="async function switchMsAccount(){\n  if(_loggingIn)return; _loggingIn=true;\n  try{\n    const email=await _msalLoginEmail();"
assert s.count(a2)==1, 'anchor switch'
b2="async function switchMsAccount(){\n  if(_msalInFrame() && window.YM_ENV==='dev'){ try{ localStorage.removeItem('lastLoginEmail'); }catch(e){} _devFrameLogin().then(function(ok){ if(!ok && typeof initLoginScreen==='function')initLoginScreen(); }); return; }   // [260904 Phase9c] 개발 미리보기: 계정 전환 = 담당자 선택\n  if(_loggingIn)return; _loggingIn=true;\n  try{\n    const email=await _msalLoginEmail();"
s=s.replace(a2,b2)
io.open(P,'w',encoding='utf-8').write(s)
print('OK phase9c devlogin', len(s))
