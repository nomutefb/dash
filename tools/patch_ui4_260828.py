# -*- coding: utf-8 -*-
# [PA5-v1] 판매추이 상세 '목록으로' 버튼 — 강조색 배경 + 흰 글자 (운영자 260828)
import json,sys
F='public/standalone.html'
s=open(F,encoding='utf-8').read()
if '[PA5-v1]' in s:
    print('ABORT: 이미 패치됨'); sys.exit(1)
E=[(json.loads(r'''".ry-back-inline{display:block;position:relative;left:8px;top:36px;margin:-16px 0 41px;padding:4px 11px;border:1.5px solid var(--glass-bd);border-radius:7px;background:var(--glass-surface);color:var(--text);"'''),json.loads(r'''".ry-back-inline{display:block;position:relative;left:8px;top:36px;margin:-16px 0 41px;padding:4px 11px;border:1.5px solid var(--accent);border-radius:7px;background:var(--accent);color:#fff;"''')),(json.loads(r'''".ry-back-inline:hover{border-color:var(--accent);color:var(--accent)}"'''),json.loads(r'''".ry-back-inline:hover{filter:brightness(1.12)}"'''))]
for f,r in E:
    if s.count(f)!=1:
        print('ABORT (파일 미변경): count=%d'%s.count(f)); sys.exit(1)
before=len(s)
for f,r in E: s=s.replace(f,r)
s=s.replace('.ry-back-inline:hover{filter:brightness(1.12)}','.ry-back-inline:hover{filter:brightness(1.12)}/* [PA5-v1] */',1)
open(F,'w',encoding='utf-8').write(s)
print('PA5-v1 ok · chars %d -> %d'%(before,len(s)))
