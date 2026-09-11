# -*- coding: utf-8 -*-
# [PA4-v1] 예울이 답변의 '명단 보기' 버튼(미작동) + 회색 하한/환산 주석 제거 (운영자 260828)
import json,sys
F='public/standalone.html'
s=open(F,encoding='utf-8').read()
if '[PA4-v1]' in s:
    print('ABORT: 이미 패치됨'); sys.exit(1)
f=json.loads(r'''"+(hit&&userRole==='admin'?'<br><button type=\"button\" class=\"btn btn--primary btn--sm\" style=\"margin-top:9px\" onclick=\"_segFromAsk()\">명단 보기</button>':'')\n    +'<br><span style=\"font-size:11px;color:var(--dim)\">※ 예매기록에 회원이 확정 연결된 '+_memAiFmt(_bkState.n)+'명 기준이라 <b>하한</b>이에요 '\n    +'· 전체 구매회원으로 환산하면 약 '+_memAiFmt(est)+'명(×'+_BK_SCALE+')</span>';"''')
c=s.count(f)
if c!=1:
    print('ABORT (파일 미변경): count=%d'%c); sys.exit(1)
before=len(s)
s=s.replace(f,';   /* [PA4-v1] 명단보기·하한주석 제거 (운영자 260828) */')
open(F,'w',encoding='utf-8').write(s)
print('PA4-v1 ok · chars %d -> %d'%(before,len(s)))
