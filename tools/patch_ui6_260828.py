# -*- coding: utf-8 -*-
# PA7: 판매현황 좌열 연도(월별) 모드를 정본 fit 궤도(yrm-chart)에 편입 — 하단 잘림/빈공간 해소, 전체 모드와 구역 동일
# 주의: 전년비교(cmp) 분기가 부활해 두 차트를 동시에 그리면 id 중복이 되니 그땐 분리할 것 (현재 cmp는 WA80으로 호출 끊김)
import json,io,sys
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
m='[PA7'+'-v1]'
if m in s:
    print('[PA7] ABORT: already applied');sys.exit(1)
E=json.loads(r'''[["var chartInner='<div style=\"height:268px;margin:0 6px 6px;animation:fadeUp .45s ease\">'","var chartInner='<div id=\"yrm-chart\" style=\"height:268px;margin:0 6px 6px;animation:fadeUp .45s ease\">'"],[",unit,'<div style=\"height:268px;margin:0 6px 6px;display:flex",",unit,'<div id=\"yrm-chart\" style=\"height:268px;margin:0 6px 6px;display:flex"],[">월별 렌더 오류: '+String(e&&e.message||e)+'</div>'; } try{_srailAlignTop();}catch(_e){}",">월별 렌더 오류: '+String(e&&e.message||e)+'</div>'; } try{_bizFitViewport();}catch(_e){} try{_srailAlignTop();}catch(_e){}"],[".bizm-card.bizov-mtbl>.ct,#bizov-annual-table .bizm-card[data-bizmreserve]>.ct{min-height:43px}/* [PA6-v1] */",".bizm-card.bizov-mtbl>.ct,#bizov-annual-table .bizm-card[data-bizmreserve]>.ct{min-height:43px}/* [PA6-v1] */.bizm-card:has(> #yrm-chart){height:auto !important}/* [PA7-v1] */"]]''')
for f,r in E:
    n=s.count(f)
    if n!=1:
        print('[PA7] ABORT: anchor count',n);sys.exit(1)
for f,r in E:
    s=s.replace(f,r)
io.open(P,'w',encoding='utf-8').write(s)
print('[PA7] OK bytes',len(s))