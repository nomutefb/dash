# -*- coding: utf-8 -*-
# [260901 v2] 덱 캐시 재설계: 면 도장 기반 오염 차단 + 자기스왑/detached 결함 수정
p='public/standalone.html'
s=open(p,encoding='utf-8').read()
oldSave='''function _bizDeckCacheSave(deck){
  var c=_bizDeckDomCache[deck],main=document.getElementById('biz-main'),rail=document.getElementById('rail-yrm'); if(!c||!main||!rail)return;
  /* [260901 버그수정] 연타 전환 시 라벨과 다른 면(DOM)이 캐시에 저장돼 판매현황에 사업현황이 남던 오염 차단 —
     저장 직전 내용 서명(판매=ana-tbl.mv-tbl / 개요=bizm-ctbl) 검사, 안 맞으면 캐시 안 함(복원 실패 → 정상 재렌더 폴백). */
  var _sigOk=(deck==='sales')?!!main.querySelector('table.ana-tbl.mv-tbl'):!!main.querySelector('table.bizm-ctbl');
  if(!_sigOk){ try{_bizDeckCacheClear(deck);}catch(_e){} return; }
  c.left=main;c.right=rail;
  main.id='biz-deck-cache-'+deck+'-left';main.style.display='none';
  rail.id='biz-deck-cache-'+deck+'-right';rail.style.display='none';
  var ml=main.cloneNode(false),rr=rail.cloneNode(false);ml.id='biz-main';rr.id='rail-yrm';ml.style.display='';rr.style.display='';
  main.parentNode.insertBefore(ml,main.nextSibling);rail.parentNode.insertBefore(rr,rail.nextSibling);
  if(deck==='sales')c.version=_bizDeckDataVersion();
}
'''
newSave='''function _bizDeckCacheSave(deck){
  var c=_bizDeckDomCache[deck],main=document.getElementById('biz-main'),rail=document.getElementById('rail-yrm'); if(!c||!main||!rail)return;
  /* [260901 버그수정 v2] 면 도장(dataset.face = _bizInlineRender가 찍음)이 라벨과 다르면 캐시하지 않는다 —
     연타 전환 중 다른 면이 그 라벨로 저장돼 판매현황에 사업현황이 남던 오염 차단(복원 실패 → 재렌더 폴백). */
  if(!(main.dataset&&main.dataset.face===deck)){ try{_bizDeckCacheClear(deck);}catch(_e){} return; }
  c.left=main;c.right=rail;
  main.id='biz-deck-cache-'+deck+'-left';main.style.display='none';
  rail.id='biz-deck-cache-'+deck+'-right';rail.style.display='none';
  var ml=main.cloneNode(false),rr=rail.cloneNode(false);ml.id='biz-main';rr.id='rail-yrm';ml.style.display='';rr.style.display='';
  try{ml.removeAttribute('data-face');}catch(_e){}   /* 빈 클론이 도장까지 복제하면 다음 Save가 빈 판을 캐시한다 — 도장 제거 */
  main.parentNode.insertBefore(ml,main.nextSibling);rail.parentNode.insertBefore(rr,rail.nextSibling);
  if(deck==='sales')c.version=_bizDeckDataVersion();
}
'''
oldRest='''function _bizDeckCacheRestore(deck){
  var c=_bizDeckDomCache[deck]; if(!c||!c.left||!c.right)return false;
  if(deck==='sales'){
    var now=_bizDeckDataVersion(),old=c.version||[];
    for(var i=0;i<now.length;i++)if(now[i]!==old[i]){_bizDeckCacheClear(deck);return false;}
  }
  /* [260901 버그수정] 캐시된 면이 이 덱의 서명 표를 안 갖고 있으면(오염·빈 캐시) 버리고 재렌더 폴백 */
  var _sigOk=(deck==='sales')?!!c.left.querySelector('table.ana-tbl.mv-tbl'):!!c.left.querySelector('table.bizm-ctbl');
  if(!_sigOk){ _bizDeckCacheClear(deck); return false; }
  var main=document.getElementById('biz-main'),rail=document.getElementById('rail-yrm');
  if(!main||!rail)return false;
  /* [260901 버그수정] 물러나는 노드는 Save가 방금 만든 빈 클론이라 보존 가치 0 — 이름만 바꿔 숨겨 전환마다 유령 노드가
     무한 누적되던 것을 제거로 교체하고, 과거에 쌓인 유령(biz-deck-active-slot-*)도 함께 청소. */
  main.remove(); rail.remove();
  try{ document.querySelectorAll('[id^="biz-deck-active-slot-"]').forEach(function(n){n.remove();}); }catch(_e){}
  c.left.id='biz-main';c.left.style.display='';c.right.id='rail-yrm';c.right.style.display='';return true;
}
'''
newRest='''function _bizDeckCacheRestore(deck){
  var c=_bizDeckDomCache[deck]; if(!c||!c.left||!c.right)return false;
  /* [260901 버그수정 v2] 떨어진(detached) 캐시·면 도장 불일치 = 폐기 후 재렌더 폴백 */
  if(!c.left.isConnected||!c.right.isConnected||!(c.left.dataset&&c.left.dataset.face===deck)){ try{_bizDeckCacheClear(deck);}catch(_e){} c.left=null;c.right=null;c.version=null; return false; }
  if(deck==='sales'){
    var now=_bizDeckDataVersion(),old=c.version||[];
    for(var i=0;i<now.length;i++)if(now[i]!==old[i]){_bizDeckCacheClear(deck);return false;}
  }
  var main=document.getElementById('biz-main'),rail=document.getElementById('rail-yrm');
  if(!main||!rail)return false;
  /* [260901 버그수정 v2] 자기 자신과의 스왑(main===c.left)이면 제거 없이 표시만 복구 — remove()가 pane을 통째로 지우던 결함 수정 */
  if(main===c.left||rail===c.right){ main.style.display='';rail.style.display=''; c.left=null;c.right=null;c.version=null; return true; }
  /* 물러나는 노드(Save가 만든 빈 클론)는 이름만 바꿔 숨겨 유령이 쌓이던 종전 방식 대신 제거 + 과거 유령 청소 */
  main.remove(); rail.remove();
  try{ document.querySelectorAll('[id^="biz-deck-active-slot-"]').forEach(function(n){n.remove();}); }catch(_e){}
  c.left.id='biz-main';c.left.style.display='';c.right.id='rail-yrm';c.right.style.display='';
  /* 복원으로 캐시 소비 — 지난 참조가 살아있는 pane을 물고 있다 지우는 사고 차단 */
  c.left=null;c.right=null;c.version=null;
  return true;
}
'''
oldIR='''function _bizInlineRender(){
  var el=document.getElementById('biz-main'); if(!el)return;
  if(typeof _mainView==='undefined'||_mainView!=='biz')return;'''
newIR='''function _bizInlineRender(){
  var el=document.getElementById('biz-main'); if(!el)return;
  if(typeof _mainView==='undefined'||_mainView!=='biz')return;
  try{ el.dataset.face=(typeof _bizDeck!=='undefined'&&_bizDeck==='ov')?'ov':'sales'; }catch(_e){}   /* [260901 버그수정 v2] 면 도장 — 덱 캐시 오염 판별 기준 */'''
assert s.count(oldSave)==1, 'save %d'%s.count(oldSave)
assert s.count(oldRest)==1, 'rest %d'%s.count(oldRest)
assert s.count(oldIR)==1, 'ir %d'%s.count(oldIR)
s=s.replace(oldSave,newSave).replace(oldRest,newRest).replace(oldIR,newIR)
open(p,'w',encoding='utf-8').write(s)
print('replaced ok 3/3')
