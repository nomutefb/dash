# -*- coding: utf-8 -*-
# tools/divmark_260828.py - 브런치 /N 분할표기 필드 주입 + 오류 2건 교정 + 렌더 3곳 치환
# 실행: python3 tools/divmark_260828.py  (검증 실패 시 ABORT 출력 후 무변경 종료)
import json, shutil, os, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PJ = os.path.join(ROOT, 'public', 'data', 'db_v46', 'programs.json')
SH = os.path.join(ROOT, 'public', 'standalone.html')
BK = os.path.join(ROOT, 'backups')
STAMP = time.strftime('%m%d-%H%M')

def abort(msg):
    print('ABORT: ' + msg)
    sys.exit(1)

try:
    data = json.load(open(PJ, encoding='utf-8'))
except Exception as e:
    abort('programs.json load fail: ' + repr(e))
if not isinstance(data, list):
    abort('programs.json root not list: ' + str(type(data)))
html = open(SH, encoding='utf-8').read()

# id: (사업비N, 수입N(0=미적용), 현재 표시_사업비 기대값)
DIV = {
 '201803151100a1':(4,0,7892250), '201806281100a1':(4,0,7892250), '201809201100a1':(4,0,7892250), '201812061100a1':(4,0,7892250),
 '201904181100a1':(4,4,7918997), '201906271100a1':(4,4,7918997), '201909191100a1':(4,4,7918997), '201912051100a1':(4,4,7918997),
 '202006191100a1':(2,2,9196695), '202012021100a1':(2,2,9196695),
 '202103251100a1':(4,4,8529800), '202106171100a1':(4,4,8529800), '202109091100a1':(4,4,8529800), '202112021100a1':(4,4,8529800),
 '202203241100a1':(4,4,9746636), '202206161100a1':(4,4,9746636), '202209011100a1':(4,4,9746636), '202212081100a1':(4,4,9746636),
 '202303231100a1':(4,4,36879900), '202306221100a1':(4,4,10259533), '202309211100a1':(4,4,10259533), '202312141100a1':(4,4,10259533),
 '202403201100a1':(4,4,9612397), '202406051100a1':(4,4,9612397), '202409041100a1':(4,4,129000000), '202412041100a1':(4,4,9612397),
 '202503271100a1':(5,5,9574200), '202503282359a1':(5,5,9574200), '202507101100a1':(5,5,9574200), '202509111100a1':(5,5,9574200), '202512041100a1':(5,5,9574200),
}
by_id = {}
for p in data:
    k = str(p.get('사업ID',''))
    if k in DIV:
        if k in by_id: abort('duplicate id ' + k)
        by_id[k] = p
miss = [k for k in DIV if k not in by_id]
if miss: abort('missing ids: ' + ','.join(miss))
for k in DIV:
    cn, rn, exp = DIV[k]
    cur = by_id[k].get('표시_사업비')
    if cur != exp: abort('cost mismatch %s: cur=%r exp=%r' % (k, cur, exp))
f1 = by_id['202303231100a1']
if f1.get('표시_수입') != 39291000: abort('2023-0323 rev mismatch: %r' % f1.get('표시_수입'))
f2 = by_id['202409041100a1']
if f2.get('표시_수입') != 10153000: abort('2024-0904 rev mismatch: %r' % f2.get('표시_수입'))
if '사업비분할' in html: abort('html already patched')

OLD1 = '무료여부:(p.무료여부==null?null:p.무료여부),'
NEW1 = OLD1 + '사업비분할:(p.사업비_분할N==null?null:p.사업비_분할N),수입분할:(p.수입_분할N==null?null:p.수입_분할N),'
OLD2 = """finMil1(cost)))+'</td>'"""
NEW2 = """finMil1(cost)+((r.__pm&&r.__pm.사업비분할)?'<span style="font-weight:400;color:var(--neutral-text);display:inline-block;width:0;white-space:nowrap">/'+r.__pm.사업비분할+'</span>':'')))+'</td>'"""
OLD3 = """:finMil1(rev)))+'</td>'"""
NEW3 = """:finMil1(rev)+((r.__pm&&r.__pm.수입분할)?'<span style="font-weight:400;color:var(--neutral-text);display:inline-block;width:0;white-space:nowrap">/'+r.__pm.수입분할+'</span>':'')))+'</td>'"""
for nm, od in (('OLD1', OLD1), ('OLD2', OLD2), ('OLD3', OLD3)):
    c = html.count(od)
    if c != 1: abort('anchor %s count=%d (must be 1)' % (nm, c))

os.makedirs(BK, exist_ok=True)
bk1 = os.path.join(BK, 'programs_db_v46-' + STAMP + '-divmark전.json')
bk2 = os.path.join(BK, 'standalone-' + STAMP + '-divmark전.html')
shutil.copy2(PJ, bk1)
shutil.copy2(SH, bk2)

nC = 0; nR = 0
for k in DIV:
    cn, rn, exp = DIV[k]
    by_id[k]['사업비_분할N'] = cn; nC += 1
    if rn:
        by_id[k]['수입_분할N'] = rn; nR += 1
f1['표시_사업비'] = 10259533; f1['표시_수입'] = 9822750; f1['표시_수익률'] = 95.7
f2['표시_사업비'] = 9612397; f2['표시_수익률'] = 105.6

html2 = html.replace(OLD1, NEW1).replace(OLD2, NEW2).replace(OLD3, NEW3)
if html2.count('사업비분할') != 3 or html2.count('수입분할') != 3: abort('post-replace check fail')

json.dump(data, open(PJ, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
open(SH, 'w', encoding='utf-8').write(html2)

print('OK divmark: 분할필드 사업비=%d건 수입=%d건, 교정 2건 적용' % (nC, nR))
print('fix1 2023-0323 ->', f1.get('표시_사업비'), f1.get('표시_수입'), f1.get('표시_수익률'))
print('fix2 2024-0904 ->', f2.get('표시_사업비'), f2.get('표시_수익률'))
print('backups:', os.path.basename(bk1), os.path.basename(bk2))
print('sizes:', os.path.getsize(PJ), os.path.getsize(SH))
