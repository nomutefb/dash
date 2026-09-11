# -*- coding: utf-8 -*-
# [260903] v308: 카운트업 최종값 보장(탭이 가려져 rAF 가 멈춰도 dur+80ms 뒤 최종값 기록) — 모듈 안 1줄
import io,json
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
a=json.loads("\"  (function step(now){ var p=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-p,3), out='',pos=0; toks.forEach(function(t){ out+=txt.slice(pos,t.s)+fmt(t.v*e,t); pos=t.e; }); out+=txt.slice(pos); el.textContent=out; if(p<1)el.__cuRaf=requestAnimationFrame(step); else el.__cuRaf=0; })(t0);\\n}\"")
b=json.loads("\"  (function step(now){ var p=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-p,3), out='',pos=0; toks.forEach(function(t){ out+=txt.slice(pos,t.s)+fmt(t.v*e,t); pos=t.e; }); out+=txt.slice(pos); el.textContent=out; if(p<1)el.__cuRaf=requestAnimationFrame(step); else el.__cuRaf=0; })(t0);\\n  setTimeout(function(){ if(el.__cuRaf){ cancelAnimationFrame(el.__cuRaf); el.__cuRaf=0; } el.textContent=txt; },dur+80);   /* \ud0ed\uc774 \uac00\ub824\uc838 rAF \uac00 \uba48\ucdb0\ub3c4 \ucd5c\uc885\uac12\uc740 \ubc18\ub4dc\uc2dc \uc4f4\ub2e4 */\\n}\"")
assert s.count(a)==1,('anchor',s.count(a))
s=s.replace(a,b)
io.open(P,'w',encoding='utf-8').write(s)
print('OK v308',len(s))
