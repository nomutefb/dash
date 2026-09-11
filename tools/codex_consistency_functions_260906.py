from pathlib import Path
import re
s=Path('public/standalone.html').read_text(encoding='utf-8')
pattern=re.compile(r'^(?:async )?function ([A-Za-z_$][\w$]*)\(',re.M)
matches=list(pattern.finditer(s))
names=['api','_pmSheetRows','_pmLoad','_pmOverlayPrograms','_anaExhibBuild','_salesBuild','syncReload','_srailInit']
out=[]
for i,m in enumerate(matches):
 name=m.group(1)
 if re.search(r'^(?:_sales|_biz).*?(?:Load|Reload|Build)|^_ym|^syncReload',name):out.append('FUNCTION '+name)
 if name in names:out.append('SOURCE '+name+'\n'+s[m.start():(matches[i+1].start() if i+1<len(matches) else len(s))])
Path('tools/codex_consistency_functions_260906.txt').write_text('\n'.join(out),encoding='utf-8')
print('READ_ONLY function chars',sum(map(len,out)))
