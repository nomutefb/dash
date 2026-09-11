# -*- coding: utf-8 -*-
# [260902 좌측 틀 통일] 사업현황/판매현황 좌측(지표 띠·차트·실적표) 높이를 두 면에서 같게 만든다.
#  1) 지표 띠 .val 을 2줄 높이로 고정(판매현황 4번째 칸 부연 문구가 2줄이라 띠가 16px 더 컸음)
#  2) 사업현황 실적표 카드에서 data-bizmreserve 제거 -> 판매현황 카드와 같은 data-bizmfill 규약(박스 안선까지 채움)
#  3) 그 카드를 198px 로 못박던 !important CSS 제거(인라인 min-height 가 무시되던 원인)
# 되돌리기: backups/standalone-260902-HHMM.html 복원
import io, sys, json
P='public/standalone.html'
s=io.open(P,'r',encoding='utf-8').read()
n0=len(s)
def rep(anchor, new):
    global s
    c=s.count(anchor)
    assert c==1, ('anchor count %d: %s' % (c, anchor[:60]))
    s=s.replace(anchor,new)
    print('OK', anchor[:50].replace('\n',' '))
A1='#bizov-annual-table > .bizm-card[data-bizmreserve]{min-height:198px !important}'
N1='#bizov-annual-table > .bizm-card{min-height:198px}/* [260902 좌측 틀 통일] !important 제거 = 인라인 fill 값이 살아난다 */#biz-main .bizm-strip .cell .val{min-height:2em}/* [260902 좌측 틀 통일] 지표 띠 2줄 고정 = 두 면 띠 높이 동일 */'
rep(A1,N1)
A2='.bizm-card.bizov-mtbl>.ct,#bizov-annual-table .bizm-card[data-bizmreserve]>.ct{min-height:43px}'
N2='.bizm-card.bizov-mtbl>.ct,#bizov-annual-table .bizm-card>.ct{min-height:43px}'
rep(A2,N2)
A3=json.loads('"<div class=\\"bizm-card\\" data-bizmfill data-bizmreserve style=\\"min-height:302px\\"><div class=\\"ct\\" style=\\"display:flex;align-items:center;justify-content:space-between;padding:12px 14px 8px\\"><span><span class=\\"ct-bul\\"></span>실적표</span><span class=\\"bizm-yrnav\\"><button type=\\"button\\" aria-label=\\"이전 연도\\" onclick=\\"_bizOvWin(-1)\\""')
N3=A3.replace(' data-bizmreserve style="min-height:302px"','')
assert N3!=A3
rep(A3,N3)
io.open(P,'w',encoding='utf-8').write(s)
print('DONE', n0, '->', len(s))
