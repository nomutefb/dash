import io
# [260903 v314] 판매현황 차트 = 모션 완전 제거. fadeUp 을 지우니 _rvChart(MutationObserver) 가 대신 wa88-rise 를 붙여 여전히 한 박자 늦게 떠올랐음.
#   인라인 animation:none 을 두면 _rvChart 의 「인라인 animationName 있으면 건너뜀」 규칙에 걸려 리빌도 안 붙는다.
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
pairs=[('<div id="yrm-chart" style="margin:0 6px 6px"></div>','<div id="yrm-chart" style="margin:0 6px 6px;animation:none"></div>'),
       ('id="yrm-chart" style="height:268px;margin:0 6px 6px"','id="yrm-chart" style="height:268px;margin:0 6px 6px;animation:none"')]
for o,n in pairs:
    c=s.count(o); assert c==1,(o,c)
    s=s.replace(o,n)
io.open(P,'w',encoding='utf-8').write(s)
print('OK v314',len(s),s.count('id="yrm-chart" style="margin:0 6px 6px;animation:none"'),s.count('height:268px;margin:0 6px 6px;animation:none'))
