# -*- coding: utf-8 -*-
# [260901] 덱 전환 캐시 오염·유령 노드 누적 버그 수정 (Claude 세션 작성)
# 실행: python3 tools/deckfix_260901.py  (워크스페이스 루트에서)
p='public/standalone.html'
s=open(p,encoding='utf-8').read()

oldSave='''function _bizDeckCacheSave(deck){
  var c=_bizDeckDomCache[deck],main=document.getElementById('biz-main'),rail=document.getElementById('rail-yrm'); if(!c||!main||!rail)return;
  c.left=main;c.right=rail;'''
newSave='''function _bizDeckCacheSave(deck){
  var c=_bizDeckDomCache[deck],main=document.getElementById('biz-main'),rail=document.getElementById('rail-yrm'); if(!c||!main||!rail)return;
  /* [260901 버그수정] 연타 전환 시 라벨과 다른 면(DOM)이 캐시에 저장돼 판매현황에 사업현황이 남던 오염 차단 —
     저장 직전 내용 서명(판매=ana-tbl.mv-tbl / 개요=bizm-ctbl) 검사, 안 맞으면 캐시 안 함(복원 실패 → 정상 재렌더 폴백). */
  var _sigOk=(deck==='sales')?!!main.querySelector('table.ana-tbl.mv-tbl'):!!main.querySelector('table.bizm-ctbl');
  if(!_sigOk){ try{_bizDeckCacheClear(deck);}catch(_e){} return; }
  c.left=main;c.right=rail;'''

oldRest='''  var main=document.getElementById('biz-main'),rail=document.getElementById('rail-yrm');
  if(!main||!rail)return false;
  main.id='biz-deck-active-slot-left';main.style.display='none';rail.id='biz-deck-active-slot-right';rail.style.display='none';
  c.left.id='biz-main';c.left.style.display='';c.right.id='rail-yrm';c.right.style.display='';return true;'''
newRest='''  /* [260901 버그수정] 캐시된 면이 이 덱의 서명 표를 안 갖고 있으면(오염·빈 캐시) 버리고 재렌더 폴백 */
  var _sigOk=(deck==='sales')?!!c.left.querySelector('table.ana-tbl.mv-tbl'):!!c.left.querySelector('table.bizm-ctbl');
  if(!_sigOk){ _bizDeckCacheClear(deck); return false; }
  var main=document.getElementById('biz-main'),rail=document.getElementById('rail-yrm');
  if(!main||!rail)return false;
  /* [260901 버그수정] 물러나는 노드는 Save가 방금 만든 빈 클론이라 보존 가치 0 — 이름만 바꿔 숨겨 전환마다 유령 노드가
     무한 누적되던 것을 제거로 교체하고, 과거에 쌓인 유령(biz-deck-active-slot-*)도 함께 청소. */
  main.remove(); rail.remove();
  try{ document.querySelectorAll('[id^="biz-deck-active-slot-"]').forEach(function(n){n.remove();}); }catch(_e){}
  c.left.id='biz-main';c.left.style.display='';c.right.id='rail-yrm';c.right.style.display='';return true;'''

assert s.count(oldSave)==1, 'save anchor %d'%s.count(oldSave)
assert s.count(oldRest)==1, 'restore anchor %d'%s.count(oldRest)
s=s.replace(oldSave,newSave).replace(oldRest,newRest)
open(p,'w',encoding='utf-8').write(s)
print('replaced ok 2/2')
