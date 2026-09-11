# -*- coding: utf-8 -*-
# [260904 Phase9d] 개발 미리보기(dev+iframe)에서 [Microsoft 계정으로 로그인] 버튼 → 곧장 PIN (기존 흐름과 동일한 단계 수).
#   iframe 에선 MS 창을 못 여니 신원은 ① 마지막 로그인 이메일 ② 없으면 개발 기본 계정(window.YM_DEV_LOGIN_EMAIL, 앱 머리 스크립트에서 설정) 순.
#   담당자 선택 카드는 "다른 Microsoft 계정으로 전환" 에서만. 발행본(/site/)은 변화 없음. 실행: python3 tools/phase9d_devlogin_260904.py (먼저 backups/ 로 cp)
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
assert 'YM_DEV_LOGIN_EMAIL' not in s, 'already applied'
a="function _devFrameShortcut(){\n  var last=''; try{ last=String(localStorage.getItem('lastLoginEmail')||'').trim().toLowerCase(); }catch(e){}\n  if(last){ _loginEmail=last; if(typeof goToPinStep==='function')goToPinStep(true); return; }\n  _devFrameLogin().then(function(ok){ if(!ok && typeof initLoginScreen==='function')initLoginScreen(); });\n}"
assert s.count(a)==1, 'anchor shortcut'
b="function _devFrameShortcut(){   // [260904 Phase9d] 버튼 → 곧장 PIN. 신원 = 마지막 로그인 이메일 → 없으면 개발 기본 계정\n  var last=''; try{ last=String(localStorage.getItem('lastLoginEmail')||'').trim().toLowerCase(); }catch(e){}\n  if(!last) last=String(window.YM_DEV_LOGIN_EMAIL||'').trim().toLowerCase();\n  if(last){ _loginEmail=last; try{ localStorage.setItem('lastLoginEmail',last); }catch(e){} if(typeof goToPinStep==='function')goToPinStep(true); return; }\n  _devFrameLogin().then(function(ok){ if(!ok && typeof initLoginScreen==='function')initLoginScreen(); });\n}"
s=s.replace(a,b)
a2="  window.YM_ENV=env; window.YM_ENV_MISMATCH=false;"
assert s.count(a2)==1, 'anchor env tag'
b2="  window.YM_ENV=env; window.YM_ENV_MISMATCH=false;\n  window.YM_DEV_LOGIN_EMAIL='contact0029932@example.invalid';   // 개발 미리보기(iframe) 전용 기본 계정 — MS 창을 못 여는 곳에서 [Microsoft 계정으로 로그인] 을 누르면 이 계정으로 PIN 단계 진입. 발행본에선 안 쓰임"
s=s.replace(a2,b2)
io.open(P,'w',encoding='utf-8').write(s)
print('OK phase9d devlogin', len(s))
