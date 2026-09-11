# -*- coding: utf-8 -*-
# tools/chartfix_260828.py - 2026 예상 기둥: 누적 스택 -> 각 분야 개별값 높이(0 기준, 실제 스케일)
import shutil, os, sys, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SH = os.path.join(ROOT, 'public', 'standalone.html')
BK = os.path.join(ROOT, 'backups')
STAMP = time.strftime('%m%d-%H%M')
def abort(msg):
    print('ABORT: ' + msg); sys.exit(1)
html = open(SH, encoding='utf-8').read()

OLD = "var _hx=col[c],_y0=_cum/_sc;_cum+=_fc.v;var _y1=_cum/_sc;"
NEW = "var _hx=col[c],_y0=0;_cum+=_fc.v;var _y1=_fc.v/_sc;   /* [260829 운영자 「실제(개별값) 높이로」] 누적 스택 → 각자 0 기준 */"

c = html.count(OLD)
if c != 1: abort('anchor count=%d (expect 1)' % c)
if '_y1=_fc.v/_sc' in html: abort('already patched')

os.makedirs(BK, exist_ok=True)
bk = os.path.join(BK, 'standalone-' + STAMP + '-chartfix전.html')
shutil.copy2(SH, bk)

html2 = html.replace(OLD, NEW)
if html2.count('_y1=_fc.v/_sc') != 1: abort('post check fail')

open(SH, 'w', encoding='utf-8').write(html2)
print('OK chartfix: 2026 예상 기둥 누적→개별값 높이(0 기준)')
print('backup:', os.path.basename(bk))
print('size:', os.path.getsize(SH))
