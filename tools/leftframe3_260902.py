# -*- coding: utf-8 -*-
# [260902 좌측 틀 통일 3단계] 덱 전환 페이드를 프레임(글래스 헤더·유리박스)에서 떼고 그 안의 내용에만 건다.
#  원인: _deckIn 이 [data-bizmhead]·[data-bizmbox] 요소 자체에 .deck-in(wa88-fade, opacity 0→1 180ms)을 다시 붙여서
#        전환 때마다 좌측 틀 전체(유리 배경 포함)가 투명→불투명으로 깜빡였다. 마크업의 class="deck-in" 도 첫 렌더 때 같은 효과.
#  수정: 프레임에서 deck-in 제거(재부착 안 함) → 헤더 자식·지표 띠 lab/val·카드 안 내용(.bizm-card > *)만 페이드.
#        window._DECK_FADE=false 면 페이드 없이 즉시 교체(하드 컷).
# 되돌리기: backups/standalone-260902-HHMM.html 복원
import io
P='public/standalone.html'
s=io.open(P,'r',encoding='utf-8').read()
n0=len(s)
A="function _deckIn(cols){ try{ var nodes=(typeof _bizmDzFrames==='function')?(_bizmDzFrames(cols)||[]):[]; if(!nodes.length){ var m=document.getElementById('biz-main'); if(m)nodes=[m]; } nodes.forEach(function(n){ if(!n||!n.classList)return; n.classList.remove('deck-in'); void n.offsetWidth; n.classList.add('deck-in'); }); }catch(_e){} }"
N="""function _deckIn(cols){ try{ var nodes=(typeof _bizmDzFrames==='function')?(_bizmDzFrames(cols)||[]):[]; if(!nodes.length){ var m=document.getElementById('biz-main'); if(m)nodes=[m]; }
  /* [260902 좌측 틀 통일] 프레임(헤더·유리박스)은 페이드에서 제외 — 프레임 자체가 0→1로 깜빡이던 원인. 그 안의 내용(헤더 자식·지표 띠 글자·카드 안 내용)만 페이드. window._DECK_FADE=false 면 즉시 교체. */
  var inner=[]; nodes.forEach(function(n){ if(!n||!n.classList)return; n.classList.remove('deck-in'); var sel=n.hasAttribute('data-bizmhead')?':scope > *':'.bizm-strip .cell > *, .bizm-card > *'; try{ inner=inner.concat([].slice.call(n.querySelectorAll(sel))); }catch(_q){} });
  if(window._DECK_FADE===false)return;
  if(!inner.length)inner=nodes;
  inner.forEach(function(n){ if(!n||!n.classList)return; n.classList.remove('deck-in'); void n.offsetWidth; n.classList.add('deck-in'); }); }catch(_e){} }"""
c=s.count(A); assert c==1, 'anchor count %d'%c
s=s.replace(A,N)
io.open(P,'w',encoding='utf-8').write(s)
print('OK _deckIn', n0, '->', len(s))
