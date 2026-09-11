from pathlib import Path
from shutil import copy2

root = Path(__file__).resolve().parents[1]
page = root / "public" / "standalone.html"
backup = root / "backups" / "standalone-260904-0104-before-msal-iframe.html"

old = """  cache: {
    cacheLocation: 'localStorage',
    // [260710 운영자 \"복귀 후 자동 PIN 안 됨\"] 리다이렉트 왕복 중 임시 상태(sessionStorage) 유실 환경(인앱 웹뷰·일부 브라우저)에서
    // handleRedirectPromise가 state를 못 찾아 계정 캐시가 비던 문제의 백업 — 쿠키에 상태 이중 저장(MSAL 공식 폴백)
    storeAuthStateInCookie: true
  }
};"""
new = """  cache: {
    cacheLocation: 'localStorage',
    // [260710 운영자 \"복귀 후 자동 PIN 안 됨\"] 리다이렉트 왕복 중 임시 상태(sessionStorage) 유실 환경(인앱 웹뷰·일부 브라우저)에서
    // handleRedirectPromise가 state를 못 찾아 계정 캐시가 비던 문제의 백업 — 쿠키에 상태 이중 저장(MSAL 공식 폴백)
    storeAuthStateInCookie: true
  },
  // MISO 미리보기는 iframe 안에서 실행된다. 팝업은 호스트 정책으로 차단되므로, MSAL의 iframe 리다이렉트 차단만 해제한다.
  system: {
    allowRedirectInIframe: true
  }
};"""

text = page.read_text(encoding="utf-8")
assert text.count(old) == 1, "MSAL config anchor must occur exactly once"
backup.parent.mkdir(parents=True, exist_ok=True)
if not backup.exists():
    copy2(page, backup)
page.write_text(text.replace(old, new, 1), encoding="utf-8")
print("OK msal iframe redirect", page.stat().st_size)
