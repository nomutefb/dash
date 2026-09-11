# -*- coding: utf-8 -*-
# [260903 DB우선 보정] _canonPerf: 장르·장소는 호출측 행의 값(판매 원장 장르1 / programs 장르·구분)을 우선, 비었을 때만 programs 표로 보완.
#   이유: 판매 장르 체계(어린이·가족·청소년…)와 programs 구분(뮤지컬(어린이)…)은 축이 달라 표가 덮어쓰면 판매현황 장르가 바뀜(100층짜리 집 실측).
#   이름은 계속 programs 풀네임이 정본. 실행: python3 tools/phase3d_canon_genre_260903.py (먼저 backups/ 로 cp)
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
a="return {name:hit?hit[0]:n,genre:(hit&&hit[1])?hit[1]:String(genre||''),place:(hit&&hit[2])?hit[2]:String(place||'')};}\n"
b="return {name:hit?hit[0]:n,genre:String(genre||'').trim()||((hit&&hit[1])||''),place:String(place||'').trim()||((hit&&hit[2])||'')};}   // [260903 DB우선 보정] 행 값 우선, 공란만 programs 표로 보완\n"
assert s.count(a)==1, 'anchor canonPerf-return not unique: %d'%s.count(a)
s=s.replace(a,b)
io.open(P,'w',encoding='utf-8').write(s)
print('OK phase3d applied', len(s))
