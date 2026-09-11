from pathlib import Path
import base64,zlib,re
p=Path('tools/plan_ui5_260906.py')
s=p.read_text(encoding='utf-8')
m=re.search(r'b64decode\("([A-Za-z0-9+/=]+)"\)',s)
old=m.group(1)
module=zlib.decompress(base64.b64decode(old)).decode('utf-8')
live=Path('public/standalone.html').read_text(encoding='utf-8')
a=live.index('/* ═══ [260906 입력절차③]')
b=live.index('function backToAdminMenu(){openAdminPanel();}')
updated=live[a:b].strip()
assert '_yp._bizRequest' in updated and '_yp.env' in updated
assert s.count(old)==1
encoded=base64.b64encode(zlib.compress(updated.encode('utf-8'))).decode()
with Path('backups/codex-integrity-260906/plan_ui5-before-sync.py').open('x',encoding='utf-8') as f:f.write(s)
p.write_text(s.replace(old,encoded),encoding='utf-8')
assert zlib.decompress(base64.b64decode(encoded)).decode()==updated
p=Path('tools/codex_integrity_260906.py')
s=p.read_text(encoding='utf-8')
anchor='original = s'+chr(10)
assert s.count(anchor)==1
p.write_text(s.replace(anchor,anchor+"assert '[codex-integrity-260906]' not in s, 'already applied; no files changed'"+chr(10)),encoding='utf-8')
print('PASS UI source and rebuild script synchronized; first patch repeat guard strengthened')
