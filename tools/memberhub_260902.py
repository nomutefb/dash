# -*- coding: utf-8 -*-
# [260902 고객 관리 허브] 고객 분석·조건부 검색·회원 조회·예울이를 모달 하나(좌우 2단)로 — 모듈 tools/memberhub_module.js 삽입 + 진입 함수 3개 리다이렉트 + 잠금 위생 연결
#   되돌리기: window._MEMBER_HUB_ON=false(옛 모달 3개 경로 그대로) 또는 백업 복원
import io
P='public/standalone.html'; M='tools/memberhub_module.js'
s=io.open(P,'r',encoding='utf-8').read(); n0=len(s)
mod=io.open(M,'r',encoding='utf-8').read()
def rep(anchor,new,count=1):
    global s
    c=s.count(anchor); assert c==count, ('anchor count %d (want %d): %s'%(c,count,anchor[:60]))
    s=s.replace(anchor,new); print('OK',anchor[:50].replace('\n',' '))
assert s.count('function _memberHubBuild(')==0, 'already inserted'
rep("function _aipromoMenuBuild(menu){", mod+"\nfunction _aipromoMenuBuild(menu){")
rep("function openMemberOverview(){\n  if(userRole!=='admin'){showToast('고객 분석은 관리자 전용이에요','error');return;}\n",
    "function openMemberOverview(){\n  if(userRole!=='admin'){showToast('고객 분석은 관리자 전용이에요','error');return;}\n  if(window._MEMBER_HUB_ON!==false&&typeof openMemberHub==='function')return openMemberHub('ov');   /* [260902 고객 관리 허브] */\n")
rep("function openCustomerSegment(){\n  if(userRole!=='admin'){showToast('고객 분류는 관리자 전용이에요','error');return;}\n",
    "function openCustomerSegment(){\n  if(userRole!=='admin'){showToast('고객 분류는 관리자 전용이에요','error');return;}\n  if(window._MEMBER_HUB_ON!==false&&typeof openMemberHub==='function')return openMemberHub('seg');   /* [260902 고객 관리 허브] */\n")
rep("function openMemberLookup(){\n  if(userRole!=='admin'){showToast('회원 조회는 관리자 전용이에요','error');return;}\n",
    "function openMemberLookup(){\n  if(userRole!=='admin'){showToast('회원 조회는 관리자 전용이에요','error');return;}\n  if(window._MEMBER_HUB_ON!==false&&typeof openMemberHub==='function')return openMemberHub('lookup');   /* [260902 고객 관리 허브] */\n")
rep("function _memPurge(){_memState=null;", "function _memPurge(){try{if(typeof _memberHubPurge==='function')_memberHubPurge();}catch(_eh){}_memState=null;   /* [260902 고객 관리 허브] 같은 위생 */")
io.open(P,'w',encoding='utf-8').write(s); print('DONE',n0,'->',len(s))
