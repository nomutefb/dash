# -*- coding: utf-8 -*-
# [260902] 사업NO 체계 통일(YY-aNN): 씨앗은 시트가 비어있는 연도에만 발화
import json
p='public/standalone.html'
s=open(p,encoding='utf-8').read()
a=json.loads("\"  _finSeed(year).forEach(function(s){ if(!seen[s.no])out.push(_finFromSeed(s,year)); });\\n\"")
b=json.loads("\"  if(!out.length)_finSeed(year).forEach(function(s){ if(!seen[s.no])out.push(_finFromSeed(s,year)); });   /* [260902] 시트가 그 연도를 한 줄이라도 가지면 씨앗 무발화 — 사업NO 체계 통일(YY-aNN) 뒤 구형 씨앗 NO가 중복으로 되살아나는 것 차단 */\\n\"")
assert s.count(a)==1, 'anchor count=%d'%s.count(a)
s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s)
print('replaced ok 1/1')
