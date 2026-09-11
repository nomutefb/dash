# -*- coding: utf-8 -*-
# [260902 예열] 앱이 뜬 뒤 한가할 때 반대편 면(사업현황↔판매현황)을 같은 작업 안에서 그렸다가 되돌려 덱 캐시에 넣어 둔다
#   → 처음 누르는 면도 즉시 전환(첫 전환 ~600ms 새로 그리기 → ~130ms 캐시 복원). 두 _bizDeckGo 가 한 작업 안에서 끝나므로 화면엔 안 그려진다.
#   + 사업현황 우측 레일이 판매 데이터 도착 전에 그려져 행이 모자라면(306 vs 462) 같은 작업 안에서 다시 그린다.
#   끄기: window._DECK_PREWARM=false
# [260902 정렬 기억값 초기화 버그] _bizAlignPerfTables 가 두 면 중 하나라도 기억값이 없으면 매 호출마다 전체를 비우던 것 → 키가 없을 때만 초기화
import io
P='public/standalone.html'
s=io.open(P,'r',encoding='utf-8').read(); n0=len(s)
def rep(anchor,new,count=1):
    global s
    c=s.count(anchor); assert c==count, ('anchor count %d (want %d): %s'%(c,count,anchor[:60]))
    s=s.replace(anchor,new); print('OK',anchor[:50].replace('\n',' '))
A1="""   if(k==='ov')setTimeout(function(){try{_srailAlignTop();}catch(_e4){}} ,0);
 }

// === 플랫폼 트리 데이터 (Phase A1) ==="""
N1="""   if(k==='ov')setTimeout(function(){try{_srailAlignTop();}catch(_e4){}} ,0);
 }
/* [260902 예열] 반대편 면을 미리 그려 덱 캐시에 넣어 둔다 — 두 _bizDeckGo 가 한 작업 안에서 끝나 화면엔 안 그려진다. window._DECK_PREWARM=false 면 끔 */
function _bizDeckPrewarm(){
  try{
    if(window._DECK_PREWARM===false)return 'off';
    if(window._bizDeckPrewarmDone)return 'done';
    if(typeof _mainView==='undefined'||_mainView!=='biz')return 'noview';
    if(typeof _bizBookWide!=='function'||!_bizBookWide())return 'narrow';
    if(typeof _bizPerfModal!=='undefined'&&_bizPerfModal&&_bizPerfModal.root)return 'modal';
    var cur=_bizDeck, other=(cur==='ov')?'sales':'ov';
    var s=(typeof _salesState!=='undefined'&&_salesState)||{}; if(!(s.daily&&s.master&&s.rounds&&s.ops&&s.group))return 'notready';
    if(typeof _YR==='undefined'||!_YR||!_YR.total)return 'noYR';
    if(typeof _PM==='undefined'||!_PM||_PM.length<1000)return 'noPM';
    if(typeof _srailBusy!=='undefined'&&_srailBusy)return 'busy';
    var main=document.getElementById('biz-main'); if(!main||main.offsetParent===null||!(main.dataset&&main.dataset.face===cur))return 'noface';
    var c=_bizDeckDomCache&&_bizDeckDomCache[other]; var need=!(c&&c.left);
    window._bizDeckPrewarmBusy=1;
    try{
      var railRows=function(){ return document.querySelectorAll('#rail-yrm tbody tr').length; };
      var mine=railRows();
      if(need){ _bizDeckGo(other); }
      var theirs=need?railRows():null;
      if(need){ _bizDeckGo(cur); }
      /* 사업현황 레일이 판매 데이터 도착 전에 그려져 행이 모자라면 같은 작업 안에서 다시 그린다(행 수 = 두 면 동일이 정상) */
      if(cur==='ov'&&theirs!==null&&theirs!==mine&&typeof _bizOVReRender==='function'){ _bizOVReRender(); try{_srailAlignTop();}catch(_e1){} }
    } finally { window._bizDeckPrewarmBusy=0; }
    window._bizDeckPrewarmDone=1; return 'done';
  }catch(_e){ return 'err'; }
}
(function(){ try{ var n=0; var t=setInterval(function(){ n++; var r=null; try{ r=_bizDeckPrewarm(); }catch(_e){} if(r==='done'||r==='off'||n>60)clearInterval(t); },1500); }catch(_e){} })();

// === 플랫폼 트리 데이터 (Phase A1) ==="""
rep(A1,N1)
rep("if(!_perfTblSpec||!_perfTblSpec.sales||!_perfTblSpec.biz)_perfTblSpec={sales:null,biz:null};",
    "if(!_perfTblSpec||typeof _perfTblSpec.sales==='undefined'||typeof _perfTblSpec.biz==='undefined')_perfTblSpec={sales:null,biz:null};   /* [260902] 한쪽만 비어도 전체를 지우던 버그 */", count=3)
io.open(P,'w',encoding='utf-8').write(s); print('DONE',n0,'->',len(s))
