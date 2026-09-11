# -*- coding: utf-8 -*-
# [260902] v46 병합 타이머 수정: 실시트 도착 전 빈 통 생성 금지(다웃파이어 수치 소실·그날들 2줄 원인)
import json
p='public/standalone.html'
s=open(p,encoding='utf-8').read()
P=json.loads("[[\"  if(!st.daily)st.daily={rows:[]}; if(!st.daily.rows)st.daily.rows=[];\\n  if(!st.master)st.master={rows:[]}; if(!st.master.rows)st.master.rows=[];\\n\",\"  if(!st.daily||!st.daily.rows||!st.master||!st.master.rows)return false;   /* [260902] 실시트 도착 전엔 빈 통을 만들지 않는다 — 빈 통이 생기면 이후 로더가 시트 fetch를 건너뛰어 v46 파일(8/25)만 남던 버그(다웃파이어 수치 소실·그날들 2줄) */\\n\"],[\"  if(_v46sm.tries>150){ _v46sm.done=true; return; }\\n  var st=window._salesState;\\n  if((!st||!st.daily||!st.daily.rows)&&_v46sm.tries<=60){ setTimeout(_v46SalesMergeTick,1000); return; }\\n\",\"  if(_v46sm.tries>3000){ _v46sm.done=true; return; }\\n  var st=window._salesState;\\n  if(!st||!st.daily||!st.daily.rows||!st.master||!st.master.rows){ setTimeout(_v46SalesMergeTick,_v46sm.tries<60?1000:5000); return; }   /* [260902] 실시트 도착까지 계속 대기(60초 포기 후 빈 통 생성 금지) */\\n\"],[\"  if(!bs.raw)bs.raw={rows:[]}; if(!bs.raw.rows)bs.raw.rows=[];\\n\",\"  if(!bs.raw||!bs.raw.rows||!bs.raw.rows.length)return false;   /* [260902] 실시트 도착 전엔 빈 통을 만들지 않는다(위 sales merge와 같은 축) */\\n\"],[\"  if(_v46om.tries>150){ _v46om.done=true; return; }\\n  var bs=window._bizState;\\n  if((!bs||!bs.raw||!bs.raw.rows||!bs.raw.rows.length)&&_v46om.tries<=60){ setTimeout(_v46OpsMergeTick,1000); return; }\\n\",\"  if(_v46om.tries>3000){ _v46om.done=true; return; }\\n  var bs=window._bizState;\\n  if(!bs||!bs.raw||!bs.raw.rows||!bs.raw.rows.length){ setTimeout(_v46OpsMergeTick,_v46om.tries<60?1000:5000); return; }   /* [260902] 실시트 도착까지 계속 대기 */\\n\"]]")
ok=0
for a,b in P:
    n=s.count(a)
    assert n==1, 'anchor count=%d: %s'%(n,a[:60])
    s=s.replace(a,b); ok+=1
open(p,'w',encoding='utf-8').write(s)
print('replaced ok %d/%d'%(ok,len(P)))
