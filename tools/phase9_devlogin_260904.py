# -*- coding: utf-8 -*-
# [260904 Phase9] 개발 미리보기(IDE 액자 iframe)에서 로그인이 항상 되게: MS 인증은 iframe 에서 구조적으로 불가(redirect·popup 차단) →
#   YM_ENV==='dev' 이고 iframe 일 때만 "담당자 선택 → PIN" 으로 진입. 살아있는 MS 세션이 있으면 종전대로 자동 진입. 발행본(/site/)은 이 분기를 절대 안 탐.
#   실행: python3 tools/phase9_devlogin_260904.py (먼저 backups/ 로 cp)
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
assert '_devFrameLogin' not in s, 'already applied'
a1="  if(window._pinActive){console.log('[initLogin] blocked: pin active');return;}\n  const step=document.getElementById('account-step');\n  if(!step)return;\n"
assert s.count(a1)==1, 'anchor initLogin'
b1=a1+"""  // [260904 Phase9] 개발 미리보기(IDE 액자)에서는 MS 인증이 구조적으로 불가(redirect·popup 차단) → dev 환경 + iframe 일 때만 담당자 선택 + PIN 으로 진입.
  //   살아있는 MS 세션이 있으면 종전 자동 진입 그대로. 발행본(/site/, YM_ENV==='prod')은 이 분기를 절대 타지 않는다.
  if(window.YM_ENV==='dev' && typeof _msalInFrame==='function' && _msalInFrame()){
    let _liveDev=false; try{ _liveDev=await _msalHasLiveSession(); }catch(e){}
    if(!_liveDev){ try{ if(await _devFrameLogin()) return; }catch(e){ console.warn('[devFrameLogin]',e); } }
  }
"""
s=s.replace(a1,b1)
a2="function _showMsalTopFramePrompt(step){"
assert s.count(a2)==1, 'anchor prompt'
b2="""// [260904 Phase9] 개발 미리보기 전용 로그인 카드 — 담당자(이메일) 선택 → PIN. MS 인증 생략은 dev(ymdata_dev) 에서만.
async function _devFrameLogin(){
  const step=document.getElementById('account-step'); if(!step)return false;
  step.innerHTML='<div style="color:#999;font-size:13px;padding:10px 0">'+_ldHtml(12)+'개발 미리보기 — 담당자 목록 불러오는 중</div>';
  if(!MANAGERS||!MANAGERS.length){ password='REQUIRES_LOCAL_CONFIGURATION'; try{ await loadManagers(); }catch(e){ console.error('[devFrameLogin] loadManagers',e); } password=''; }
  const list=(MANAGERS||[]).map(function(m){ return {email:String(_authGetCol(m,_EMAIL_KEYS)||'').trim().toLowerCase(), name:String(m['담당자']||'').trim()}; }).filter(function(x){return x.email;});
  if(!list.length) return false;
  var last=''; try{ last=String(localStorage.getItem('lastLoginEmail')||'').toLowerCase(); }catch(e){}
  var opts=list.map(function(x){ return '<option value="'+escapeHtml(x.email)+'"'+(x.email===last?' selected':'')+'>'+escapeHtml(x.name||x.email)+(x.name?' · '+escapeHtml(x.email):'')+'</option>'; }).join('');
  step.innerHTML='<div style="font-size:12px;color:var(--text);margin-bottom:12px;line-height:1.6">개발 미리보기 — Microsoft 인증 생략<br><span style="color:var(--muted);font-size:11px">발행본에서는 Microsoft 로그인이 그대로 필요해요</span></div>'
    +'<select id="devFrameEmail" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--glass-bd);border-radius:12px;background:var(--glass-surface);color:var(--text);font-size:13px;margin-bottom:10px">'+opts+'</select>'
    +'<button type="button" onclick="_devFrameGo()" style="width:100%;padding:12px;background:var(--glass-surface);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid var(--glass-bd);color:var(--text);box-shadow:var(--glass-shadow);border-radius:12px;font-size:14px;font-weight:600;cursor:pointer">PIN 입력으로 계속</button>'
    +'<a href="'+escapeHtml(location.href)+'" target="_blank" rel="noopener" style="display:block;margin-top:10px;font-size:11px;color:var(--muted);text-decoration:underline">새 탭에서 Microsoft 로그인으로 진입</a>';
  return true;
}
function _devFrameGo(){
  var sel=document.getElementById('devFrameEmail'); var em=sel?String(sel.value||'').trim().toLowerCase():''; if(!em)return;
  _loginEmail=em; try{ localStorage.setItem('lastLoginEmail',em); }catch(e){}
  if(typeof goToPinStep==='function')goToPinStep(true);
}
"""+a2
s=s.replace(a2,b2)
io.open(P,'w',encoding='utf-8').write(s)
print('OK phase9 devlogin', len(s))
