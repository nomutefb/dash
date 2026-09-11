# -*- coding: utf-8 -*-
# [260902 좌측 틀 통일 6단계] 표 위치 기억값을 두 면이 공유(판매현황 확정값 우선, 없으면 사업현황 확정값) → 처음 여는 면도 첫 프레임부터 제자리 · 두 면 표 위치 동일
import io
P='public/standalone.html'
s=io.open(P,'r',encoding='utf-8').read(); n0=len(s)
A="var _ref=(src==='biz'&&_perfTblSpec.sales&&_perfTblSpec.sales.vw===window.innerWidth&&_perfTblSpec.sales.z===z&&_perfTblSpec.sales.ml)?_perfTblSpec.sales:slot;"
N="var _okg=function(x){return !!(x&&x.vw===window.innerWidth&&x.z===z&&x.ml&&x.w);}; var _ref=_okg(_perfTblSpec.sales)?_perfTblSpec.sales:(_okg(_perfTblSpec.biz)?_perfTblSpec.biz:slot);   /* [260902 좌측 틀 통일] 두 면이 같은 틀이므로 확정된 표 위치를 공유(판매현황 우선) — 처음 여는 면도 첫 프레임부터 제자리 */"
c=s.count(A); assert c==1, 'anchor count %d'%c
s=s.replace(A,N); io.open(P,'w',encoding='utf-8').write(s); print('OK ref shared', n0,'->',len(s))
