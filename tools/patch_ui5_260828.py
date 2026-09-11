# -*- coding: utf-8 -*-
# PA6: 사업개요 전체/연도 토글 시 좌열 구역(차트/실적표) 경계 고정 — 260828 밤
import json,io,sys
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
m='[PA6'+'-v1]'
if m in s:
    print('[PA6] ABORT: already applied');sys.exit(1)
E=json.loads(r'''[["<div class=\"bizm-card\" data-bizmfill data-bizmreserve style=\"min-height:302px\"><div class=\"ct\"><span class=\"ct-bul\"></span>실적표 <span class=\"sub\">'+year+'년 월별 사업 지표","<div class=\"bizm-card bizov-mtbl\" data-bizmfill data-bizmreserve style=\"min-height:302px\"><div class=\"ct\"><span class=\"ct-bul\"></span>실적표 <span class=\"sub\">'+year+'년 월별 사업 지표"],[".ry-back-inline:hover{filter:brightness(1.12)}/* [PA5-v1] */",".ry-back-inline:hover{filter:brightness(1.12)}/* [PA5-v1] */.bizm-card.bizov-mtbl{min-height:198px !important;max-height:none !important}.bizm-card.bizov-mtbl>.ct,#bizov-annual-table .bizm-card[data-bizmreserve]>.ct{min-height:43px}/* [PA6-v1] */"]]''')
for f,r in E:
    n=s.count(f)
    if n!=1:
        print('[PA6] ABORT: anchor count',n);sys.exit(1)
for f,r in E:
    s=s.replace(f,r)
io.open(P,'w',encoding='utf-8').write(s)
print('[PA6] OK bytes',len(s))