# -*- coding: utf-8 -*-
# [PA3-v1] 예매자 정보 KPI 라벨 교정: '예매자 연 평균 예매율' -> '재방문 예매자 비율' (260829)
# 계산식 불변(revis = 타공연도예매한_예매자수/고유예매자수). 라벨 문자열 1곳만 치환. count!=1 이면 ABORT.
import base64, io, sys
def b64d(x): return base64.b64decode(x).decode('utf-8')
PATH = 'public/standalone.html'
PAIRS = [
  (b64d('PuyYiOunpOyekCDsl7Ag7Y+J6regIOyYiOunpOycqDwvZGl2Pg=='), b64d('PuyerOuwqeusuCDsmIjrp6TsnpAg67mE7JyoPC9kaXY+')),
]
with io.open(PATH, 'r', encoding='utf-8') as f: s = f.read()
old_len = len(s)
for i,(a,b) in enumerate(PAIRS):
    c = s.count(a)
    print('pair %d count %d' % (i, c))
    if c != 1:
        print('ABORT: anchor count != 1'); sys.exit(1)
for a,b in PAIRS:
    s = s.replace(a, b, 1)
with io.open(PATH, 'w', encoding='utf-8') as f: f.write(s)
print('APPLIED old_len %d new_len %d delta %d' % (old_len, len(s), len(s)-old_len))
