# -*- coding: utf-8 -*-
# tools/divmark2_260828.py - /N 표시를 '총액/N'으로 변경(렌더 x N 복원) + 2026 브런치 사업비 분할필드 4건 추가
import json, shutil, os, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PJ = os.path.join(ROOT, 'public', 'data', 'db_v46', 'programs.json')
SH = os.path.join(ROOT, 'public', 'standalone.html')
BK = os.path.join(ROOT, 'backups')
STAMP = time.strftime('%m%d-%H%M')

def abort(msg):
    print('ABORT: ' + msg)
    sys.exit(1)

data = json.load(open(PJ, encoding='utf-8'))
if not isinstance(data, list): abort('root not list')
html = open(SH, encoding='utf-8').read()

Y26 = {'202604091100a1':5538326, '202606041100a1':5538326, '202609032359a1':5538325, '202612032359a1':5538325}
by = {}
for p in data:
    k = str(p.get('사업ID',''))
    if k in Y26: by[k] = p
if len(by) != 4: abort('2026 brunch ids found=%d' % len(by))
for k, exp in Y26.items():
    if by[k].get('표시_사업비') != exp: abort('cost mismatch %s: %r' % (k, by[k].get('표시_사업비')))
    if by[k].get('사업비_분할N') is not None: abort('already has div field: ' + k)

OLD_A = """finMil1(cost)+((r.__pm&&r.__pm.사업비분할)?'<span style="font-weight:400;color:var(--neutral-text);display:inline-block;width:0;white-space:nowrap">/'+r.__pm.사업비분할+'</span>':'')"""
NEW_A = """((r.__pm&&r.__pm.사업비분할)?finMil1(cost*r.__pm.사업비분할)+'<span style="font-weight:400;color:var(--neutral-text);display:inline-block;width:0;white-space:nowrap">/'+r.__pm.사업비분할+'</span>':finMil1(cost))"""
OLD_B = """:finMil1(rev)+((r.__pm&&r.__pm.수입분할)?'<span style="font-weight:400;color:var(--neutral-text);display:inline-block;width:0;white-space:nowrap">/'+r.__pm.수입분할+'</span>':'')"""
NEW_B = """:((r.__pm&&r.__pm.수입분할)?finMil1(rev*r.__pm.수입분할)+'<span style="font-weight:400;color:var(--neutral-text);display:inline-block;width:0;white-space:nowrap">/'+r.__pm.수입분할+'</span>':finMil1(rev))"""
for nm, od in (('OLD_A', OLD_A), ('OLD_B', OLD_B)):
    c = html.count(od)
    if c != 1: abort('anchor %s count=%d (must be 1)' % (nm, c))
if html.count('finMil1(cost*') != 0 or html.count('finMil1(rev*') != 0: abort('already patched v2')

os.makedirs(BK, exist_ok=True)
bk1 = os.path.join(BK, 'programs_db_v46-' + STAMP + '-divmark2전.json')
bk2 = os.path.join(BK, 'standalone-' + STAMP + '-divmark2전.html')
shutil.copy2(PJ, bk1)
shutil.copy2(SH, bk2)

for k in Y26:
    by[k]['사업비_분할N'] = 4

html2 = html.replace(OLD_A, NEW_A).replace(OLD_B, NEW_B)
if html2.count('finMil1(cost*r.__pm.사업비분할)') != 1 or html2.count('finMil1(rev*r.__pm.수입분할)') != 1: abort('post check fail')

json.dump(data, open(PJ, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
open(SH, 'w', encoding='utf-8').write(html2)

print('OK divmark2: 렌더=총액/N 방식 치환 2곳, 2026 브런치 사업비_분할N=4 x 4건')
print('backups:', os.path.basename(bk1), os.path.basename(bk2))
print('sizes:', os.path.getsize(PJ), os.path.getsize(SH))
