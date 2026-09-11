# -*- coding: utf-8 -*-
# PA8: 사업개요 차트 y축 최상단 3자리 라벨(120/110) 잘림 해소 — svg overflow visible (축 숫자열 오른끝 일자 정렬 유지)
import json,io,sys
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
m='[PA8'+'-v1]'
if m in s:
    print('[PA8] ABORT: already applied');sys.exit(1)
E=json.loads(r'''[[".bizm-card:has(> #yrm-chart){height:auto !important}/* [PA7-v1] */",".bizm-card:has(> #yrm-chart){height:auto !important}/* [PA7-v1] */#bizov-chart svg{overflow:visible}/* [PA8-v1] */"]]''')
for f,r in E:
    n=s.count(f)
    if n!=1:
        print('[PA8] ABORT: anchor count',n);sys.exit(1)
for f,r in E:
    s=s.replace(f,r)
io.open(P,'w',encoding='utf-8').write(s)
print('[PA8] OK bytes',len(s))