# -*- coding: utf-8 -*-
# [260903 DB우선] _SALES_SCHEDULE_OVERRIDES(달 샤베트 회차 하드코딩) 제거. 회차는 DB 회차상세 시트(261001_01 6행) + 공연마스터(총회차 6·총오픈석 5556)가 정본.
#   실행: python3 tools/phase3e_override_rm_260903.py (먼저 backups/ 로 cp)
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
a=s.index('// [260820] 판매중 일정 확정치'); b=s.index('// 운영대장(세부운영관리대장)을 정규화공연명')
assert 0<a<b and 'var _SALES_SCHEDULE_OVERRIDES=' in s[a:b] and 'function _salesOverrideDateStr' in s[a:b] and b-a<2500
s=s[:a]+'// [260903 DB우선] 판매 회차 하드코딩 오버라이드 제거 — 회차상세 시트(ID·공연일)가 정본\n'+s[b:]
c=s.index('  // 확정 일정은 어느 입력 경로'); d=s.index("  perfs.forEach(function(p){var cp=_canonPerf(p.name,p.genre,p.place)")
assert 0<c<d and '_salesScheduleOverride(p.name)' in s[c:d] and d-c<1500
s=s[:c]+s[d:]
for kw in ('_SALES_SCHEDULE_OVERRIDES','_salesScheduleOverride','_salesOverrideDateStr'):
    j=s.find(kw)
    while j>=0:
        print('RESIDUAL',kw,j,repr(s[max(0,j-120):j+80])); j=s.find(kw,j+1)
assert '_SALES_SCHEDULE_OVERRIDES' not in s and '_salesScheduleOverride' not in s and '_salesOverrideDateStr' not in s
io.open(P,'w',encoding='utf-8').write(s)
print('OK phase3e applied', len(s))
