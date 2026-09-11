# -*- coding: utf-8 -*-
# [260902] 프로그램 레일 열 폭 — 기존 두 표의 실측 폭(body-wrap zoom .75 기준 환산)으로 맞춤
import json
for p in ('public/standalone.html','tools/prograil_module.js'):
    s=open(p,encoding='utf-8').read()
    a="var _PR_COLS=[82,38,38,null,40,70,64,72,58];"; b="var _PR_COLS=[108,51,51,null,53,92,88,96,80];"
    n=s.count(a); assert n==1, (p,'anchor count=%d'%n)
    open(p,'w',encoding='utf-8').write(s.replace(a,b))
    print('cols ok',p)
