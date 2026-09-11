# -*- coding: utf-8 -*-
# [260902 고객 관리 허브 보강] 런타임에 window._MEMBER_HUB_ON=false 로 옛 모달로 되돌릴 때 허브 DOM(같은 id: mem-ov-body/mem-q/mem-body/seg-*)을 먼저 치운다 — 안 치우면 옛 모달이 허브 쪽 요소에 그린다
import io
P='public/standalone.html'
s=io.open(P,'r',encoding='utf-8').read(); n0=len(s)
A="if(window._MEMBER_HUB_ON!==false&&typeof openMemberHub==='function')return openMemberHub("
N="if(window._MEMBER_HUB_ON===false){var _hb=document.getElementById('member-hub');if(_hb)_hb.remove();}else if(typeof openMemberHub==='function')return openMemberHub("
c=s.count(A); assert c==3, 'count %d'%c
s=s.replace(A,N); io.open(P,'w',encoding='utf-8').write(s); print('OK x3', n0,'->',len(s))
