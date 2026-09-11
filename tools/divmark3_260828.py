# -*- coding: utf-8 -*-
# tools/divmark3_260828.py - 2026 브런치 4건 표시_사업비를 10,000,000 으로 (총액 표시 40.0/4)
import json, shutil, os, sys, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PJ = os.path.join(ROOT, 'public', 'data', 'db_v46', 'programs.json')
BK = os.path.join(ROOT, 'backups')
STAMP = time.strftime('%m%d-%H%M')
def abort(msg):
    print('ABORT: ' + msg); sys.exit(1)
data = json.load(open(PJ, encoding='utf-8'))
if not isinstance(data, list): abort('root not list')
IDS = ['202604091100a1','202606041100a1','202609032359a1','202612032359a1']
by = {}
for p in data:
    k = str(p.get('사업ID',''))
    if k in IDS: by[k] = p
if len(by) != 4: abort('found=%d' % len(by))
for k in IDS:
    c = by[k].get('표시_사업비')
    if c not in (5538325, 5538326): abort('unexpected cost %s: %r' % (k, c))
    if by[k].get('사업비_분할N') != 4: abort('divN missing on ' + k)
os.makedirs(BK, exist_ok=True)
bk = os.path.join(BK, 'programs_db_v46-' + STAMP + '-divmark3전.json')
shutil.copy2(PJ, bk)
for k in IDS:
    by[k]['표시_사업비'] = 10000000
json.dump(data, open(PJ, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('OK divmark3: 2026 브런치 4건 표시_사업비=10,000,000 (표시 40.0/4)')
print('backup:', os.path.basename(bk))
print('size:', os.path.getsize(PJ))
