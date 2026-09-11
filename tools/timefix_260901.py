# -*- coding: utf-8 -*-
# [260901] 캘린더 시간 표시 hh:mm 통일 — 초(:ss) 제거 (표시만 수정, 정렬키·저장값 무접촉)
p='public/standalone.html'
s=open(p,encoding='utf-8').read()
pairs=[
("if(typeof ts==='string'&&ts.indexOf(' ')>-1)hhmm=ts.split(' ')[1];",
 "if(typeof ts==='string'&&ts.indexOf(' ')>-1)hhmm=(ts.split(' ')[1]||'').slice(0,5);   /* [260901] 캘린더 셀 hh:mm까지만 */"),
("mh=ts.split(' ')[1];",
 "mh=(ts.split(' ')[1]||'').slice(0,5);"),
("timeStr = startRaw.split(' ')[1] || '';",
 "timeStr = (startRaw.split(' ')[1] || '').slice(0,5);"),
("const endTime = endRaw.split(' ')[1] || '';",
 "const endTime = (endRaw.split(' ')[1] || '').slice(0,5);"),
]
for a,b in pairs:
    assert s.count(a)==1, 'anchor %d: %s'%(s.count(a),a[:40])
for a,b in pairs:
    s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s)
print('replaced ok 4/4')
