# -*- coding: utf-8 -*-
# [260903] v305: 허브 우측 칸이 좁을 때 조건 낱말(.ry-yr-tg)이 글자 단위로 꺾이던 것 — CSS 한 줄 추가
import io,json
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
a=json.loads('"    +\'#member-hub #seg-result .bizm-card{margin-bottom:0}\'\\n"')
b=json.loads('"    +\'#member-hub #seg-cond > *{flex:0 0 auto;white-space:nowrap}\'                       /* 좁은 우측 칸에서 조건 낱말이 글자 단위로 꺾이던 것 → 한 줄(가로 스크롤은 원래 있음) */\\n"')+a
assert s.count(a)==1,('anchor',s.count(a))
s=s.replace(a,b)
io.open(P,'w',encoding='utf-8').write(s)
print('OK v305',len(s))
