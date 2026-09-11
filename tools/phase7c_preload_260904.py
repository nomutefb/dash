# -*- coding: utf-8 -*-
# [260904 Phase7c] 부팅 예열(_plOne) 목록의 옛 시트 이름 → 통합 시트 이름. 옛 이름 요청이 동결 시트로 가던 마지막 창구 제거.
#   실행: python3 tools/phase7c_preload_260904.py (먼저 backups/ 로 cp)
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
a="      (_w?['일일입력','공연마스터','회차상세','세부운영관리대장(정리)','전시일일','전시마스터','단체']\n         :['세부운영관리대장(정리)','전시일일','전시마스터']).forEach(function(n){_plOne('/api/ops?sheet='+enc(n));});"
b="      (_w?['일일실적','판매설정','회차','세부운영관리대장(정리)','단체']\n         :['세부운영관리대장(정리)','일일실적','판매설정']).forEach(function(n){_plOne('/api/ops?sheet='+enc(n));});   // [260904 Phase7c] 예열도 통합 시트 이름(YMDB 창구와 같은 URL → dedupe 유지). 옛 이름 5개는 동결 시트라 예열 불필요"
assert s.count(a)==1, 'anchor preload: %d'%s.count(a)
s=s.replace(a,b)
import re
left=re.findall(r"_plOne\('/api/ops\?sheet='\+enc\('(전시마스터|전시일일|공연마스터|회차상세|일일입력)'\)",s)
assert not left, left
io.open(P,'w',encoding='utf-8').write(s)
print('OK phase7c', len(s))
