# -*- coding: utf-8 -*-
# [260904 Phase9b] 로그인 화면은 원래 양식(Microsoft 카드) 그대로 두고, 개발 미리보기(dev+iframe)에서만 MS 인증 단계를 건너뛰어 전처럼 들어가게.
#   - v351 이 첫 화면에 띄우던 담당자 선택 카드는 제거(양식 유지). 담당자 선택은 마지막 로그인 이메일이 없을 때만 폴백으로.
#   - Microsoft 버튼(msLogin) : dev+iframe 이면 마지막 로그인 이메일로 PIN 단계 직행(없으면 담당자 선택).
#   - goToPinStep : dev+iframe 이면 MS 토큰 재검증 생략(iframe 에서는 popup/redirect 가 막혀 검증 자체가 불가).
#   발행본(/site/)·새 탭(top window)은 종전 그대로. 실행: python3 tools/phase9b_devlogin_260904.py (먼저 backups/ 로 cp)
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
assert '_devFrameLogin' in s, 'phase9 not applied'
assert '_devFrameShortcut' not in s, 'already applied'
# (1) 첫 화면 dev 카드 제거 → 원래 양식
a1="""  // [260904 Phase9] 개발 미리보기(IDE 액자)에서는 MS 인증이 구조적으로 불가(redirect·popup 차단) → dev 환경 + iframe 일 때만 담당자 선택 + PIN 으로 진입.
  //   살아있는 MS 세션이 있으면 종전 자동 진입 그대로. 발행본(/site/, YM_ENV==='prod')은 이 분기를 절대 타지 않는다.
  if(window.YM_ENV==='dev' && typeof _msalInFrame==='function' && _msalInFrame()){
    let _liveDev=false; try{ _liveDev=await _msalHasLiveSession(); }catch(e){}
    if(!_liveDev){ try{ if(await _devFrameLogin()) return; }catch(e){ console.warn('[devFrameLogin]',e); } }
  }
"""
assert s.count(a1)==1, 'anchor v351 block'
s=s.replace(a1,'')
# (2) msLogin: dev+iframe 지름길
a2="""async function msLogin(){
  // iframe 안에서는 MSAL popup/redirect를 호출하지 않는다. 링크 클릭이 최상위 창으로 인증을 넘긴다.
  if(_msalInFrame()){
    _showMsalTopFramePrompt(document.getElementById('account-step'));
    return;
  }"""
assert s.count(a2)==1, 'anchor msLogin'
b2="""async function msLogin(){
  // iframe 안에서는 MSAL popup/redirect를 호출하지 않는다(MISO 미리보기가 둘 다 막음).
  //   [260904 Phase9b] 개발 미리보기(dev)면 원래 버튼 그대로 눌러서 PIN 단계로 직행(마지막 로그인 이메일, 없으면 담당자 선택). 발행본은 종전 안내.
  if(_msalInFrame()){
    if(window.YM_ENV==='dev'){ _devFrameShortcut(); return; }
    _showMsalTopFramePrompt(document.getElementById('account-step'));
    return;
  }"""
s=s.replace(a2,b2)
# (3) goToPinStep: dev+iframe 이면 MS 재검증 생략
a3="""async function goToPinStep(skipEnsure){
  try{
"""
assert s.count(a3)==1, 'anchor goToPinStep'
b3="""async function goToPinStep(skipEnsure){
  try{
  if(!skipEnsure && window.YM_ENV==='dev' && typeof _msalInFrame==='function' && _msalInFrame()) skipEnsure=true;   // [260904 Phase9b] 개발 미리보기(iframe)는 MS 재검증 불가 → 생략(발행본은 그대로)
"""
s=s.replace(a3,b3)
# (4) 지름길 함수
a4="function _devFrameGo(){"
assert s.count(a4)==1, 'anchor devFrameGo'
b4="""function _devFrameShortcut(){
  var last=''; try{ last=String(localStorage.getItem('lastLoginEmail')||'').trim().toLowerCase(); }catch(e){}
  if(last){ _loginEmail=last; if(typeof goToPinStep==='function')goToPinStep(true); return; }
  _devFrameLogin().then(function(ok){ if(!ok && typeof initLoginScreen==='function')initLoginScreen(); });
}
"""+a4
s=s.replace(a4,b4)
io.open(P,'w',encoding='utf-8').write(s)
print('OK phase9b devlogin', len(s))
