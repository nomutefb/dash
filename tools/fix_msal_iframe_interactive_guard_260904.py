from pathlib import Path
from shutil import copy2

root = Path(__file__).resolve().parents[1]
page = root / "public" / "standalone.html"
backup = root / "backups" / "standalone-260904-0122-before-msal-interactive-guard.html"

replacements = [
    (
        """  // 2. popup — 첫 로그인 또는 silent 실패
  try {
    const res = await inst.loginPopup({scopes: _MSAL_SCOPES, prompt: 'select_account'});""",
        """  // 2. popup — 첫 로그인 또는 silent 실패. iframe에서는 popup 권한이 없으므로 호출하지 않는다.
  if(_msalInFrame()) return null;
  try {
    const res = await inst.loginPopup({scopes: _MSAL_SCOPES, prompt: 'select_account'});""",
    ),
    (
        """async function _msalLogout(){
  const inst = await _msalGet();""",
        """async function _msalLogout(){
  if(_msalInFrame()) return;
  const inst = await _msalGet();""",
    ),
]

text = page.read_text(encoding="utf-8")
for old, _ in replacements:
    assert text.count(old) == 1, "Expected MSAL interactive anchor exactly once"

backup.parent.mkdir(parents=True, exist_ok=True)
if not backup.exists():
    copy2(page, backup)
for old, new in replacements:
    text = text.replace(old, new, 1)
page.write_text(text, encoding="utf-8")
print("OK msal iframe interactive guard", page.stat().st_size)
