from pathlib import Path
import re,json
s=Path('public/standalone.html').read_text(encoding='utf-8')
lines=s.splitlines()
terms=[r'function api\(',r'function _pmSheetRows\(',r'function _pmLoad\(',r'function _v46SalesMergeTick\(',r'최종유료',r'판매명칭',r'정본명',r'function _biz.*Load',r'function _.*Purge']
selected=set()
for i,line in enumerate(lines):
 if len(line)<4000 and any(re.search(term,line) for term in terms):
  selected.update(range(max(0,i-3),min(len(lines),i+12)))
out='\n'.join(str(i+1)+': '+lines[i] for i in sorted(selected) if len(lines[i])<5000)
Path('tools/codex_consistency_read_260906.txt').write_text(out,encoding='utf-8')
print('READ_ONLY source excerpt chars',len(out))
