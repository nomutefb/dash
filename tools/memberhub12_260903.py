import io
# [260903 v313] 판매현황 본화면(_yrmRender) 관객 추이 차트의 fadeUp 제거 — v312 는 월별 본문(_salesMonthBody) 쪽만 지웠음
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
OLD='<div id="yrm-chart" style="margin:0 6px 6px;animation:fadeUp .45s ease"></div>'
NEW='<div id="yrm-chart" style="margin:0 6px 6px"></div>'
n=s.count(OLD); assert n==1,n
s=s.replace(OLD,NEW)
io.open(P,'w',encoding='utf-8').write(s)
print('OK v313',len(s),s.count('id="yrm-chart" style="margin:0 6px 6px"'),s.count('animation:fadeUp'))
