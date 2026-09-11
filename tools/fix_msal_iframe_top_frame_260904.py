from pathlib import Path
from shutil import copy2

root = Path(__file__).resolve().parents[1]
page = root / "public" / "standalone.html"
backup = root / "backups" / "standalone-260904-0121-before-msal-top-frame.html"

replacements = [
    (
        """  }else{
    _loginEmail='';
    // [260710] 운영자: 관문 카드에서 클릭 없이 곧장 MS 로그인 화면으로(자동 진입).""",
        """  }else{
    _loginEmail='';
    // MISO 미리보기 iframe은 redirect와 popup 인증을 모두 막는다. 네이티브 링크로 최상위 창에서 시작한다.
    if(_msalInFrame()){
      _showMsalTopFramePrompt(step);
      return;
    }
    // [260710] 운영자: 관문 카드에서 클릭 없이 곧장 MS 로그인 화면으로(자동 진입).""",
    ),
    (
        """async function msLogin(){
  if(_loggingIn) return;
  _loggingIn = true;""",
        """async function msLogin(){
  // iframe 안에서는 MSAL popup/redirect를 호출하지 않는다. 링크 클릭이 최상위 창으로 인증을 넘긴다.
  if(_msalInFrame()){
    _showMsalTopFramePrompt(document.getElementById('account-step'));
    return;
  }
  if(_loggingIn) return;
  _loggingIn = true;""",
    ),
    (
        """async function _msalEnsureToken(hintEmail){
  const inst=await _msalGet(); if(!inst) return null;""",
        """async function _msalEnsureToken(hintEmail){
  if(_msalInFrame()){
    _showMsalTopFramePrompt(document.getElementById('account-step'));
    return null;
  }
  const inst=await _msalGet(); if(!inst) return null;""",
    ),
    (
        """async function _msalLoginEmail(){
  const inst = await _msalGet();""",
        """function _msalInFrame(){
  try{return window.parent!==window;}catch(e){return true;}
}
function _showMsalTopFramePrompt(step){
  if(!step)return;
  var href='';
  try{href=escapeHtml(window.location.href);}catch(e){}
  step.innerHTML='<div style=\"font-size:12px;color:var(--text);margin-bottom:18px;line-height:1.6\">미리보기에서는 새 화면에서<br>Microsoft 계정 인증을 진행해요</div>'
    +'<a href=\"'+href+'\" target=\"_top\" style=\"width:100%;box-sizing:border-box;padding:12px;background:var(--glass-surface);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid var(--glass-bd);color:var(--text);box-shadow:var(--glass-shadow);border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none\">Microsoft 로그인 계속</a>';
}
async function _msalLoginEmail(){
  if(_msalInFrame()){
    _showMsalTopFramePrompt(document.getElementById('account-step'));
    return null;
  }
  const inst = await _msalGet();""",
    ),
    (
        """function _msalPrefetch(){
  try {""",
        """function _msalPrefetch(){
  if(_msalInFrame())return;
  try {""",
    ),
]

text = page.read_text(encoding="utf-8")
for old, _ in replacements:
    assert text.count(old) == 1, "Expected MSAL anchor exactly once"

backup.parent.mkdir(parents=True, exist_ok=True)
if not backup.exists():
    copy2(page, backup)
for old, new in replacements:
    text = text.replace(old, new, 1)
page.write_text(text, encoding="utf-8")
print("OK msal iframe top-frame", page.stat().st_size)
