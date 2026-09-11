# -*- coding: utf-8 -*-
# 회원 조회 mem-body 고정 높이(56vh) — 검색 중 모달 통통 튐 제거
import base64, io, sys
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
o=base64.b64decode('PGRpdiBpZD0ibWVtLWJvZHkiIHN0eWxlPSJtYXgtaGVpZ2h0OjU2dmg7b3ZlcmZsb3c6YXV0bzs=').decode('utf-8')
nw=base64.b64decode('PGRpdiBpZD0ibWVtLWJvZHkiIHN0eWxlPSJkaXNwbGF5Om5vbmU7aGVpZ2h0OjU2dmg7bWF4LWhlaWdodDo1NnZoO292ZXJmbG93OmF1dG87').decode('utf-8')
c=s.count(o)
print('anchor count',c)
if c!=1:
    print('ABORT: anchor count mismatch — nothing written'); sys.exit(1)
s=s.replace(o,nw,1)
io.open(P,'w',encoding='utf-8').write(s)
print('APPLIED. new_len',len(s))
