# -*- coding: utf-8 -*-
# [260902] 프로그램 레일 통합 — 사업현황·판매현황 우측 프로그램 표를 한 모듈(_progRail*)로 통일
#   모듈 삽입 1곳 + 치환 4곳. 되돌리기: window._PROG_RAIL_ON=false 한 줄(옛 렌더 경로 보존) 또는 backups/ 복원
import json
p='public/standalone.html'
s=open(p,encoding='utf-8').read()
MOD=open('tools/prograil_module.js',encoding='utf-8').read()
assert 'data-prog-rail' in MOD and len(MOD)>10000, 'module file bad'
def rep(a,b):
    global s
    n=s.count(a); assert n==1, ('anchor count=%d'%n, a[:60])
    s=s.replace(a,b)
H1a=json.loads("\"function _bizOvYearRail(el){window._bizOVEl=el;\"")
H1b=json.loads("\"function _bizOvYearRail(el){ if(window._PROG_RAIL_ON&&typeof _progRailRender==='function'){ return _progRailRender(el); }   /* [260902 프로그램 레일 통합] */\\n  window._bizOVEl=el;\"")
rep(H1a, MOD+'\n'+H1b)
rep(json.loads("\"'+_bizListTable(_detailRows,true,_ryYearSel())+'\""), json.loads("\"'+((window._PROG_RAIL_ON&&typeof _progRailTableHtml==='function')?_progRailTableHtml('sales',{yearSel:_ryYearSel()}):_bizListTable(_detailRows,true,_ryYearSel()))+'\""))
rep(json.loads("\"host.innerHTML=_bizListTable(_bizSalesDetailRows(),true,_ryYearSel());\""), json.loads("\"host.innerHTML=(window._PROG_RAIL_ON&&typeof _progRailTableHtml==='function')?_progRailTableHtml('sales',{yearSel:_ryYearSel()}):_bizListTable(_bizSalesDetailRows(),true,_ryYearSel());\""))
rep(json.loads("\"    _fadeTimer=setTimeout(_fadeRender,300);\\n     _fadeRender(); /* WA56 즉시 렌더 */\\n    try{ _deckIn(['biz-main','rail-yrm']); }catch(_e){}   /* [WA88-v1] 즉시 렌더 뒤 내용만 180ms 페이드인(딱딱한 컷 완화) */\""), json.loads("\"    _fadeTimer=setTimeout(_fadeRender,300);\\n    var _prSaved=(window._PROG_RAIL_ON&&typeof _progRailScrollGet==='function')?_progRailScrollGet():null;   /* [260902 프로그램 레일 통합] 전환 전 스크롤·행 지문 */\\n     _fadeRender(); /* WA56 즉시 렌더 */\\n    try{ _deckIn(window._PROG_RAIL_ON?['biz-main']:['biz-main','rail-yrm']); }catch(_e){}   /* [WA88-v1] 즉시 렌더 뒤 내용만 180ms 페이드인 · [260902] 레일은 같은 표라 페이드 제외 */\\n    if(_prSaved){ try{ _progRailScrollSet(_prSaved); }catch(_e){} setTimeout(function(){ try{ _progRailScrollSet(_prSaved); }catch(_e){} },60); setTimeout(function(){ try{ _progRailScrollSet(_prSaved); }catch(_e){} },400); }\""))
assert s.count('data-prog-rail')>=1 and s.count('_PROG_RAIL_ON')>=6
open(p,'w',encoding='utf-8').write(s)
print('prograil ok: module inserted + 4 replaced; size', len(s))
