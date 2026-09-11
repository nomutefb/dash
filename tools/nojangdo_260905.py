# nojangdo_260905.py — [260905 운영자 "장도랑 식당 이런거는 아예 없애고, 나오는 부분도 없애줘"] 본체에서 장도 입도시간·카페 운영시간 안내와 카페 운영 일정 반영 메뉴를 뺀다.
#   ① 날짜 패널 서비스 블록: 장도·카페 두 줄 제거(여수시 방문객 수 줄은 그대로, 없으면 블록 자체를 안 그림) ② 부팅 시 카페일정·장도 시트 불러오기 제거
#   ③ 프리로드 목록에서 제거 ④ 관리 메뉴 '일정 반영'(카페 운영 일정) 항목 제거(함수는 남김). CSS·다른 코드는 무접촉.
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
def rep(a,b):
    global s
    n=s.count(a); assert n==1, ('anchor',n,a[:80]); s=s.replace(a,b)
rep("""  h+='<div class="panel-svc"><div class="panel-svc-row">• 장도 입도 가능 시간 : <span class="panel-svc-val">'+escapeHtml((window._jangdoHours&&_jangdoHours[dKey])||'-')+'</span></div><div class="panel-svc-row">• 카페 운영 시간 : '+_cfCell+'</div>'+_visRow+'</div>';\n""",
    """  h+=_visRow?('<div class="panel-svc">'+_visRow+'</div>'):'';   // [260905 운영자] 장도 입도시간·카페 운영시간 줄 제거(시트 삭제) — 방문객 수 줄만, 없으면 블록 생략\n""")
rep("""    loadCafeJangdo().catch(function(e){console.warn('[initApp loadCafeJangdo]',e);}),\n""", "")
rep("""    '/api/ops?sheet='+enc('카페일정'),'/api/ops?sheet='+enc('장도'),\n""", "")
rep("""['qa','불편사항 관리'],['schedsync','일정 반영']];""", """['qa','불편사항 관리']];   // [260905 운영자] 일정 반영(카페 운영 일정) 메뉴 제거""")
rep("""    {id:'qa',label:'불편사항 관리',desc:'접수된 불편사항 확인·처리'},\n    {id:'schedsync',label:'일정 반영',desc:'받은 일정표를 앱 데이터로'}   // [260804 운영자] 신설 — 톱니(관리) 드롭다운 items 배열과 같은 순서로 유지\n""",
    """    {id:'qa',label:'불편사항 관리',desc:'접수된 불편사항 확인·처리'}   // [260905 운영자] 일정 반영(카페) 항목 제거\n""")
io.open(P,'w',encoding='utf-8').write(s)
print('OK nojangdo', len(s))
