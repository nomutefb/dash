# -*- coding: utf-8 -*-
# [260902 좌측 틀 통일 5단계] 전환 직후 표 7px 튐 · 우측 흰 박스 간헐 튐 · 우측 두 면 틀 통일
#  F1~F3 _bizAlignPerfTables(마지막 정의): 수렴한 표 위치(margin-left·width)를 기억해 전환 때 그대로 적용 + 보정을 동기로 수행
#        → 전환 첫 프레임부터 표가 제자리(전엔 7px 밀린 채 그려진 뒤 다음 틱에 보정 = 글자 튐). 사업현황 표는 판매현황 표의 확정 위치를 그대로 씀.
#  R1   우측 「프로그램」 흰 카드: 사업현황 면 래퍼를 판매현황 면과 같은 마크업으로(둥글기 12·테두리·상한 고정 data-bizmcap·하단 페이드)
#  R2   하단 페이드 CSS를 #bizov-year-list 에도 적용
#  D1   면을 새로 그리는 경로(첫 진입·데이터 갱신 뒤)에서 정렬·fit 을 같은 작업 안에서 즉시 실행 → 첫 프레임부터 상한 적용
#  FP   fill 패스: 넓은 화면에서 이젤 판정이 잠깐 실패해도 상한(data-bizmcap)을 풀지 않는다 → 462행 표가 자연 높이로 튀었다 줄어드는 간헐 깜빡임 차단
import io, re
P='public/standalone.html'
s=io.open(P,'r',encoding='utf-8').read()
n0=len(s)
def rep(anchor, new, count=1):
    global s
    c=s.count(anchor)
    assert c==count, ('anchor count %d (want %d): %s' % (c, count, anchor[:60]))
    s=s.replace(anchor,new)
    print('OK', anchor[:50].replace('\n',' '))
# F1
rep("var pass=0,done=false,finish=function(){_perfTblSpec[src]={left:targetLeft,right:targetRight,src:src,vw:window.innerWidth,z:z};",
    "var pass=0,done=false,finish=function(){_perfTblSpec[src]={left:targetLeft,right:targetRight,src:src,vw:window.innerWidth,z:z,ml:table.style.marginLeft,w:table.style.width};   /* [260902 좌측 틀 통일] 수렴한 표 위치 기억 */")
# F2
rep("if(slot&&slot.vw===window.innerWidth&&slot.z===z)apply(slot.left,slot.right);else apply(targetLeft,targetRight);",
    "var _ref=(src==='biz'&&_perfTblSpec.sales&&_perfTblSpec.sales.vw===window.innerWidth&&_perfTblSpec.sales.z===z&&_perfTblSpec.sales.ml)?_perfTblSpec.sales:slot;   /* [260902 좌측 틀 통일] 사업현황 표 = 판매현황 표의 확정 위치 그대로(틀이 같으므로) */\n      if(_ref&&_ref.vw===window.innerWidth&&_ref.z===z&&_ref.ml&&_ref.w){_alignStyle(table,'marginLeft',_ref.ml);_alignStyle(table,'width',_ref.w);_alignStyle(table,'tableLayout','fixed');_alignStyle(table,'marginRight','0px');}\n      else if(slot&&slot.vw===window.innerWidth&&slot.z===z)apply(slot.left,slot.right);else apply(targetLeft,targetRight);")
# F3 (2곳 — 마지막 정의 안의 보정 호출을 동기로)
rep("setTimeout(function(){try{correct();}finally{if(done)table._wa6fCorrBusy=false;}},0);",
    "(function(){try{correct();}finally{if(done)table._wa6fCorrBusy=false;}})();   /* [260902 좌측 틀 통일] 보정을 같은 작업 안에서 — 첫 프레임부터 제자리 */", count=2)
# R1
OLD_WRAP='<div class="bizm-card" data-bizmfill style="display:flex;flex-direction:column;margin-bottom:0"><div id="bizov-year-list" class="ry-grp-bd" style="min-height:0;overflow-y:auto;overflow-x:hidden;padding:0 0 4px">'
NEW_WRAP='<div data-bizmfill data-bizmcap style="min-height:0;border:1px solid var(--border);border-radius:12px;background:var(--surface-solid);display:flex;flex-direction:column;overflow:hidden"><div id="bizov-year-list" class="ry-grp-bd" style="min-height:0;overflow-x:auto;overflow-y:auto">'
A_R1="'"+OLD_WRAP+"'\n    +_progRailTableHtml('ov')"
N_R1="'"+NEW_WRAP+"'   /* [260902 좌측 틀 통일] 판매현황 면 래퍼와 동일 마크업(둥글기·테두리·상한 고정·페이드) */\n    +_progRailTableHtml('ov')"
rep(A_R1,N_R1)
# R2
rep(".biz-detail-scroll::after{content:'';position:absolute;", ".biz-detail-scroll::after,#bizov-year-list::after{content:'';position:absolute;")
# D1
rep("    _bizDeckCacheClear(k);\n    try{ if(typeof _bizInlineRender==='function')_bizInlineRender(); }catch(_e){}\n    try{ if(typeof _railYrmRender==='function'&&document.getElementById('rail-yrm'))_railYrmRender(); }catch(_e){}\n  }",
    "    _bizDeckCacheClear(k);\n    try{ if(typeof _bizInlineRender==='function')_bizInlineRender(); }catch(_e){}\n    try{ if(typeof _railYrmRender==='function'&&document.getElementById('rail-yrm'))_railYrmRender(); }catch(_e){}\n    try{_srailAlignTop();}catch(_e){} try{_bizFitViewport();}catch(_e){}   /* [260902 좌측 틀 통일] 새로 그린 뒤 정렬·fit 을 같은 작업 안에서 — 첫 프레임부터 상한·높이 확정 */\n  }")
# FP
rep("           var _f=_fls[_fi]; if(!_f.hasAttribute('data-bizmreserve'))_alignStyle(_f,'minHeight',''); if(_f.hasAttribute('data-bizmcap'))_alignStyle(_f,'maxHeight','');\n          if(!_easelOn)continue;",
    "           var _f=_fls[_fi];\n          if(!_easelOn&&_f.hasAttribute('data-bizmcap')&&(typeof _bizBookWide==='function')&&_bizBookWide())continue;   /* [260902 좌측 틀 통일] 넓은 화면에서 이젤 판정이 잠깐 실패한 호출(전환 도중 등)엔 상한을 풀지 않는다 — 풀리면 462행 표가 자연 높이로 튀었다가 다음 호출에 줄어드는 간헐 깜빡임 */\n          if(!_f.hasAttribute('data-bizmreserve'))_alignStyle(_f,'minHeight',''); if(_f.hasAttribute('data-bizmcap'))_alignStyle(_f,'maxHeight','');\n          if(!_easelOn)continue;")
io.open(P,'w',encoding='utf-8').write(s)
print('DONE', n0, '->', len(s))
# 모듈 원본도 같이(있으면)
try:
    M='tools/prograil_module.js'; m=io.open(M,'r',encoding='utf-8').read()
    if m.count(A_R1)==1:
        m=m.replace(A_R1,N_R1); io.open(M,'w',encoding='utf-8').write(m); print('module OK')
    else:
        print('module skip', m.count(A_R1))
except Exception as e:
    print('module err', e)
