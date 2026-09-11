# -*- coding: utf-8 -*-
# [260903] v311 카운트업 원문 캐시 = 진행 중일 때만(값이 제자리에서 갱신되면 옛 값으로 덮지 않게) — 본체+참조본
import io,json
A=json.loads("\"  var txt=(el.__cuText!=null)?el.__cuText:tgt.textContent; el.__cuText=txt; if(minV==null)minV=100;\"")
B=json.loads("\"  var txt=(el.__cuRaf&&el.__cuText!=null)?el.__cuText:tgt.textContent; el.__cuText=txt; if(minV==null)minV=100;   /* 원문 캐시는 애니메이션 진행 중(재호출)일 때만 — 앱이 값을 제자리에서 바꾸면 새 값을 쓴다 */\"")
for P in ['public/standalone.html','tools/memberhub_module.js']:
    s=io.open(P,encoding='utf-8').read(); c=s.count(A); assert c==1,(P,'anchor',c)
    s=s.replace(A,B); io.open(P,'w',encoding='utf-8').write(s); print('OK v311',P,len(s))
