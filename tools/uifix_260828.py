# -*- coding: utf-8 -*-
# tools/uifix_260828.py - (1) 사업현황 '기획' 토글 비활성(대관 전환 차단) (2) 실적표 억/% 접미사 정렬
import shutil, os, sys, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SH = os.path.join(ROOT, 'public', 'standalone.html')
BK = os.path.join(ROOT, 'backups')
STAMP = time.strftime('%m%d-%H%M')
def abort(msg):
    print('ABORT: ' + msg); sys.exit(1)
html = open(SH, encoding='utf-8').read()

OLD_R = """onclick="_bizOVRentTg()" title="'+(window._bizOVRentOn?'대관 보는 중 — 누르면 기획':'기획 보는 중 — 누르면 대관')+'" style="color:'+(window._bizOVRentOn?'#7c3aed':'var(--accent)')+'">'+(window._bizOVRentOn?'대관':'기획')+'</button>'"""
NEW_R = """title="기획" style="color:var(--accent);pointer-events:none;cursor:default">기획</button>'"""
HELP_A = "function _bizOvMetricControls(){"
HELPERS = """function _eokCell(v){v=String(v==null?'':v);return /^[\d,.]+$/.test(v)?v+'<span style="display:inline-block;width:1.1em;text-align:left">억</span>':v;}
function _pctCell(v){v=String(v==null?'':v);return /%$/.test(v)?v.slice(0,-1)+'<span style="display:inline-block;width:1.1em;text-align:left">%</span>':v;}
"""
P1o = "+cell(r,row[1])+";            P1n = "+_eokCell(cell(r,row[1]))+"
P2o = "+rate(r)+";                  P2n = "+_pctCell(rate(r))+"
P3o = "(total('cost')?Math.round(total('rev')/total('cost')*100)+'%':'—')"
P3n = "_pctCell(total('cost')?Math.round(total('rev')/total('cost')*100)+'%':'—')"
P4o = "_finEok(total(row[1]))";     P4n = "_eokCell(_finEok(total(row[1])))"

checks = [('OLD_R',OLD_R,1),('HELP_A',HELP_A,1),('P1',P1o,2),('P2',P2o,2),('P3',P3o,2),('P4',P4o,2)]
for nm,od,exp in checks:
    c = html.count(od)
    if c != exp: abort('anchor %s count=%d (expect %d)' % (nm,c,exp))
if '_eokCell' in html: abort('already patched')

os.makedirs(BK, exist_ok=True)
bk = os.path.join(BK, 'standalone-' + STAMP + '-uifix전.html')
shutil.copy2(SH, bk)

html2 = html.replace(OLD_R, NEW_R)
html2 = html2.replace(P4o, P4n)
html2 = html2.replace(P1o, P1n).replace(P2o, P2n).replace(P3o, P3n)
html2 = html2.replace(HELP_A, HELPERS + HELP_A)
ok = (html2.count('_eokCell(') == 4+1 and html2.count('_pctCell(') == 4+1 and html2.count('_bizOVRentTg()') >= 1)
# _eokCell: 정의1 + P1(2) + P4(2) = 5회 등장(정의 포함), _pctCell: 정의1 + P2(2) + P3(2) = 5회
if html2.count('_eokCell') != 5 or html2.count('_pctCell') != 5: abort('post count fail e=%d p=%d' % (html2.count('_eokCell'), html2.count('_pctCell')))
if html2.count(OLD_R) != 0: abort('rent still there')

open(SH, 'w', encoding='utf-8').write(html2)
print('OK uifix: 기획토글 비활성 1곳, 실적표 억/% 접미사 8곳(+헬퍼 2개)')
print('backup:', os.path.basename(bk))
print('size:', os.path.getsize(SH))
