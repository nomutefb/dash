from pathlib import Path
from shutil import copy2

root = Path(__file__).resolve().parents[1]
page = root / "public" / "standalone.html"
backup = root / "backups" / "standalone-260904-0108-before-msal-popup.html"

replacements = [
    (
        """  },
  // MISO 미리보기는 iframe 안에서 실행된다. 팝업은 호스트 정책으로 차단되므로, MSAL의 iframe 리다이렉트 차단만 해제한다.
  system: {
    allowRedirectInIframe: true
  }
};""",
        """  }
};""",
    ),
    (
        """    if(!_autoDone && window.msal){""",
        """    // MISO 미리보기 iframe에서는 redirect API를 호출하면 MSAL이 즉시 거부한다.
    // 자동 인증은 최상위 창에서만 실행하고, iframe에서는 사용자의 버튼 클릭으로 popup 인증을 시작한다.
    if(!_autoDone && window.msal && window.parent===window){""",
    ),
    (
        """    try{
      const _inst=await _msalGet();
      if(_inst){ _msSetRedirGuards(); _msDiag('manual_redirect_fire',''); await _inst.loginRedirect({scopes:_MSAL_SCOPES, prompt:'select_account'}); return; }
    }catch(re){ _msDiag('manual_redirect_err',(re&&(re.errorCode||re.message))||re); console.warn('[msLogin] redirect 실패 → 팝업 폴백:', re&&(re.errorCode||re.message)||re); }
    const email = await _msalLoginEmail();""",
        """    // 최상위 창은 기존 redirect 흐름을 유지한다. iframe에서는 redirect를 시도하지 않는다.
    if(window.parent===window){
      try{
        const _inst=await _msalGet();
        if(_inst){ _msSetRedirGuards(); _msDiag('manual_redirect_fire',''); await _inst.loginRedirect({scopes:_MSAL_SCOPES, prompt:'select_account'}); return; }
      }catch(re){ _msDiag('manual_redirect_err',(re&&(re.errorCode||re.message))||re); console.warn('[msLogin] redirect 실패 → 팝업 폴백:', re&&(re.errorCode||re.message)||re); }
    }
    const email = await _msalLoginEmail();""",
    ),
    (
        """  try {
    _msSetRedirGuards();
    _msDiag('login_email_redirect_fire','');
    await inst.loginRedirect({scopes: _MSAL_SCOPES, prompt: 'select_account'});
    return null;
  } catch(e){""",
        """  try {
    // 이 함수는 버튼 클릭/사용자 전환에서만 호출된다. iframe에서는 popup API가 유일한 허용 인증 경로다.
    const res = await inst.loginPopup({scopes: _MSAL_SCOPES, prompt: 'select_account'});
    if(res && res.account){
      inst.setActiveAccount(res.account);
      return ((res.account.username)||'').trim().toLowerCase();
    }
    return null;
  } catch(e){""",
    ),
]

text = page.read_text(encoding="utf-8")
for old, new in replacements:
    assert text.count(old) == 1, "Expected MSAL anchor exactly once"

backup.parent.mkdir(parents=True, exist_ok=True)
if not backup.exists():
    copy2(page, backup)
for old, new in replacements:
    text = text.replace(old, new, 1)
page.write_text(text, encoding="utf-8")
print("OK msal iframe popup", page.stat().st_size)
