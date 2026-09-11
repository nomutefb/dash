# -*- coding: utf-8 -*-
# 회원 조회 검색 디바운스(150ms) — oninput 즉시렌더 → _memRenderDeb
import base64, io, sys
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
pairs=[
(base64.b64decode('b25pbnB1dD0iX21lbVJlbmRlcigpIiBvbnNlYXJjaD0iX21lbVJlbmRlcigpIg==').decode('utf-8'), base64.b64decode('b25pbnB1dD0iX21lbVJlbmRlckRlYigpIiBvbnNlYXJjaD0iX21lbVJlbmRlckRlYigpIg==').decode('utf-8')),
(base64.b64decode('ZnVuY3Rpb24gX21lbVJlbmRlcigpew==').decode('utf-8'), base64.b64decode('dmFyIF9tZW1EZWJUPW51bGw7ZnVuY3Rpb24gX21lbVJlbmRlckRlYigpe2NsZWFyVGltZW91dChfbWVtRGViVCk7X21lbURlYlQ9c2V0VGltZW91dChfbWVtUmVuZGVyLDE1MCk7fQpmdW5jdGlvbiBfbWVtUmVuZGVyKCl7').decode('utf-8')),
]
ok=True
for i,(o,n) in enumerate(pairs):
    c=s.count(o)
    print('pair',i,'count',c)
    if c!=1: ok=False
if not ok:
    print('ABORT: anchor count mismatch — nothing written'); sys.exit(1)
for o,n in pairs: s=s.replace(o,n,1)
io.open(P,'w',encoding='utf-8').write(s)
print('APPLIED 2 pairs. new_len',len(s))
