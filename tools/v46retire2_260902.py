# -*- coding: utf-8 -*-
# [260902] v46retire 보정: 이력 마스터 _base = 기준명
import json
p='public/standalone.html'
s=open(p,encoding='utf-8').read()
a=json.loads("\"o._base=String(m['사업명']||'');\"")
b=json.loads("\"o._base=String(m['기준명']||m['사업명']||'');   /* 기준명 = v46 _base(연도 접미 없는 이름) — 실시간 시트 중복 판정 키 */\"")
assert s.count(a)==1, 'anchor count=%d'%s.count(a)
s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s)
print('replaced ok 1/1')
