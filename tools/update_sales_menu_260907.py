from pathlib import Path
import re, datetime, os
p=Path('public/standalone.html')
s=p.read_text()
assert 'ym-ticketlink-ui.js' in s, 'collector UI required'
label='일일 판매 입력'
assert label in s, 'menu label not found; do not modify'
pattern=r'''(['"])([^'"\n]*\bopenDailyInput\(\)[^'"\n]*)\1'''
def replace(m):
    return m[1]+m[2].replace('openDailyInput()', 'ymTicketlinkOpen(true)')+m[1]
changed,n=re.subn(pattern,replace,s)
assert n>=1, 'quoted menu action not found; do not modify'
changed=changed.replace(label,'판매 실적 갱신')
backup=Path('backups')/('sales-menu-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
backup.mkdir(parents=True,exist_ok=False)
(backup/'standalone.html').write_bytes(p.read_bytes())
tmp=p.with_name('standalone.html.tmp');tmp.write_text(changed);os.replace(tmp,p)
print('SALES_MENU_UPDATED: labels='+str(s.count(label))+', actions='+str(n)+'; existing data unchanged; NOT PUBLISHED')
