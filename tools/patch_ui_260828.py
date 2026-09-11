# -*- coding: utf-8 -*-
# [PA2-v1] 고객분석 헤더버튼 통일 + 조건부조회 겉박스 제거·row 정리 + 조회버튼만 갱신
import json,sys
F='public/standalone.html'
s=open(F,encoding='utf-8').read()
E=[('E1버튼',json.loads(r'''"padding:9px 13px;border:1.5px solid var(--surface-solid);background:var(--glass-surface);color:var(--surface-solid);border-radius:var(--r-btn);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px"'''),json.loads(r'''"height:32px;padding:0 14px;border:0;background:rgba(255,255,255,.12);color:#fff;border-radius:16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px"'''),2),
   ('E2겉박스',json.loads(r'''"<div class=\"bizm-card\" style=\"padding:14px 16px;margin-bottom:21px\">'\n    + '<div id=\"seg-cond\""'''),json.loads(r'''"<div style=\"padding:0\">'\n    + '<div id=\"seg-cond\""'''),1),
   ('E3조건row',json.loads(r'''"<div id=\"seg-cond\" style=\"display:flex;gap:4px;align-items:center;flex-wrap:nowrap;overflow-x:auto;padding-top:24px\">"'''),json.loads(r'''"<div id=\"seg-cond\" style=\"display:flex;gap:6px;align-items:center;flex-wrap:nowrap;overflow-x:auto;padding:6px 2px 16px\">"'''),1),
   ('E4자동재조회',json.loads(r'''"if(_segLast)_segRun();"'''),json.loads(r'''"/* [PA2-v1] 자동 재조회 제거 — 조회 버튼을 눌러야 갱신 (운영자 260828) */"'''),1)]
if '[PA2-v1]' in s:
    print('ABORT: 이미 패치됨'); sys.exit(1)
for name,f,r,want in E:
    c=s.count(f)
    if c!=want:
        print('ABORT (파일 미변경): %s count=%d want=%d'%(name,c,want)); sys.exit(1)
before=len(s)
for name,f,r,want in E: s=s.replace(f,r)
open(F,'w',encoding='utf-8').write(s)
print('PA2-v1 ok · chars %d -> %d'%(before,len(s)))
