import json,io
# [260903 v312] (a) _yrCountUp -> 공용 _memHubCountUp 위임  (b) 판매현황 차트 fadeUp 제거  (c) ym-perf 화면전환 페이드를 틀 제외·내용만
P='public/standalone.html'; Q='public/ym-perf.js'
s=io.open(P,encoding='utf-8').read(); q=io.open(Q,encoding='utf-8').read()

A_OLD=json.loads('"function _yrCountUp(el,to,dur){\\n  if(!el)return;to=Number(to)||0;dur=dur||900;var t0=performance.now();\\n  (function step(now){var p=Math.min(1,(now-t0)/dur);var e=1-Math.pow(1-p,3);el.textContent=Math.round(to*e).toLocaleString();if(p<1)requestAnimationFrame(step);})(t0);\\n}"')
A_NEW=json.loads('"function _yrCountUp(el,to,dur){\\n  /* [260903 카운트업 통일] 최종값을 먼저 써 두고 공용 _memHubCountUp(고객 관리·지표 띠와 같은 부품)에 맡긴다. 공용이 없으면 옛 방식. */\\n  if(!el)return;to=Number(to)||0;dur=dur||900;el.textContent=Math.round(to).toLocaleString();\\n  if(typeof _memHubCountUp===\'function\'){try{_memHubCountUp(el,dur,0);return;}catch(_e){}}\\n  var t0=performance.now();\\n  (function step(now){var p=Math.min(1,(now-t0)/dur);var e=1-Math.pow(1-p,3);el.textContent=Math.round(to*e).toLocaleString();if(p<1)requestAnimationFrame(step);})(t0);\\n}"')
B_OLD='id="yrm-chart" style="height:268px;margin:0 6px 6px;animation:fadeUp .45s ease"'
B_NEW='id="yrm-chart" style="height:268px;margin:0 6px 6px"'
C_OLD="'html .ymperf-view-fade{animation:ymperfViewFade .2s ease-out both}',"
C_NEW=("/* [260903 틀 유지] #main-area 통째(유리틀 포함) 0→1 페이드가 「번쩍」의 원인. 틀은 두고 틀 안 내용만 페이드. */\n"
       "    'html .ymperf-view-fade [data-bizmhead]>*,html .ymperf-view-fade [data-bizmbox]>*,html .ymperf-view-fade [data-memhead]>*,html .ymperf-view-fade [data-membox]>*,html .ymperf-view-fade #cal-head-wrap>*,html .ymperf-view-fade #cal>*{animation:ymperfViewFade .2s ease-out both}',")

for name,src,old in (('A',s,A_OLD),('B',s,B_OLD),('C',q,C_OLD)):
    n=src.count(old); assert n==1,(name,n)
s=s.replace(A_OLD,A_NEW).replace(B_OLD,B_NEW); q=q.replace(C_OLD,C_NEW)
io.open(P,'w',encoding='utf-8').write(s); io.open(Q,'w',encoding='utf-8').write(q)
print('OK v312', len(s), len(q), s.count('_memHubCountUp(el,dur,0)'), s.count('animation:fadeUp'), q.count('[data-membox]>*'))
