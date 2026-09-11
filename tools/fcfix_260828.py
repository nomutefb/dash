# -*- coding: utf-8 -*-
# tools/fcfix_260828.py - 올해 예상 관객 상향: 3개년 평균 90% 수준 (공연 x1.234, 전시 x1.304=증가율 1.3배, 교육 유지)
import shutil, os, sys, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SH = os.path.join(ROOT, 'public', 'standalone.html')
BK = os.path.join(ROOT, 'backups')
STAMP = time.strftime('%m%d-%H%M')
def abort(msg):
    print('ABORT: ' + msg); sys.exit(1)
html = open(SH, encoding='utf-8').read()

OLD = "var _YR_FC={'공연':{v:56298,why:'상반기 실측 23,601(유료 22,451 + 초대 1,150 · 환산 없음) + 하반기 24,865(기획 15건 장르 벤치마크 17,261 + 대관 7,604) × 무료 포함 환산 1.315'},'전시':{v:24147,why:'상반기 누적 8,049 × 3'},'교육':{v:917,why:'2025년과 동일 수준'}};"
NEW = "var _YR_FC={'공연':{v:69461,why:'상반기 실측 23,601(유료 22,451 + 초대 1,150 · 환산 없음) + 하반기 24,865(기획 15건 장르 벤치마크 17,261 + 대관 7,604) × 무료 포함 환산 1.315 → ×1.234 상향(260829 운영자: 3개년 평균 90% 목표)'},'전시':{v:31486,why:'상반기 누적 8,049 × 3 → ×1.304 상향(260829 운영자: 공연 상향률의 1.3배)'},'교육':{v:917,why:'2025년과 동일 수준'}};"

c = html.count(OLD)
if c != 1: abort('anchor count=%d (expect 1)' % c)
if 'v:69461' in html: abort('already patched')

os.makedirs(BK, exist_ok=True)
bk = os.path.join(BK, 'standalone-' + STAMP + '-fcfix전.html')
shutil.copy2(SH, bk)

html2 = html.replace(OLD, NEW)
if html2.count('v:69461') != 1 or html2.count('v:31486') != 1: abort('post check fail')

open(SH, 'w', encoding='utf-8').write(html2)
print('OK fcfix: 공연 56298->69461, 전시 24147->31486, 교육 917 유지. 합 101,864 = 3개년 평균 113,181의 90.0%')
print('backup:', os.path.basename(bk))
print('size:', os.path.getsize(SH))
