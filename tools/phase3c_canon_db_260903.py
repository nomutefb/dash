# -*- coding: utf-8 -*-
# [260903 DB우선] 2026 공연 표시명·장르·장소 하드코딩 표(_CANON_2026 26건 + _CANON_2026_ALIAS 8건) 제거.
#   → programs 시트(풀네임·장르/구분·장소)에서 런타임에 표를 만든다(_canonFromPrograms). 운영자 지시: "무조건 db가 우선, 하드코딩 없어야 함".
#   실행: python3 tools/phase3c_canon_db_260903.py  (먼저 backups/ 로 cp)
import io, re
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
def rep(a,b,label,count=1):
    global s
    n=s.count(a); assert n==count, 'anchor %s: expected %d found %d'%(label,count,n)
    s=s.replace(a,b)

# 1) 하드코딩 표 → 빈 배열
m=re.search(r"var _CANON_2026=\[\n.*?\n\];\n", s, re.S)
assert m and m.group(0).count("['")>=20, 'canon table not found'
s=s[:m.start()]+"var _CANON_2026=[];   // [260903 DB우선] 하드코딩 표 제거 — loadPrograms 가 _canonFromPrograms(programs 시트)로 채운다\n"+s[m.end():]
m=re.search(r"var _CANON_2026_ALIAS=\{.*?\};\n", s, re.S)
assert m and m.group(0).count("':'")>=5, 'alias table not found'
s=s[:m.start()]+"var _CANON_2026_ALIAS={};   // [260903 DB우선] 별칭 표 제거 — 판매 원장 공연명은 _canonKey(연도·로마숫자·기호 무시)로 DB 풀네임과 직접 매칭(2026 11건 실측 전부 일치)\n"+s[m.end():]

# 2) _canonPerf: 표 값이 비면 인자값 유지 + 표 빌더
old_cp="return {name:hit?hit[0]:n,genre:hit?hit[1]:String(genre||''),place:hit?hit[2]:String(place||'')};}\n"
new_cp=("return {name:hit?hit[0]:n,genre:(hit&&hit[1])?hit[1]:String(genre||''),place:(hit&&hit[2])?hit[2]:String(place||'')};}\n"
 "// [260903 DB우선] programs 시트 → 정규화 표. 풀네임(정본)·장르(장르열, 없으면 구분열)·장소. 대관(R*)·NO 공란 제외 = programToPerf/_pmOverlayPrograms 와 같은 규칙.\n"
 "function _canonFromPrograms(progs){\n"
 "  if(!Array.isArray(progs))return 0;\n"
 "  var t=[];\n"
 "  progs.forEach(function(p){ if(!p)return; var id=String(p['프로그램ID']||p['공연ID']||'').trim(); if(!id||/^R/i.test(id))return; if(p['NO']===''||p['NO']==null)return;\n"
 "    var nm=String(p['풀네임']||'').trim(); if(!nm)return;\n"
 "    t.push([nm,String(p['장르']||p['구분']||'').trim(),String(p['장소']||'').trim()]); });\n"
 "  _CANON_2026=t;\n"
 "  try{ _uNameMemo=Object.create(null); }catch(_e){}   // 이름 정규화 메모 무효화(표가 바뀌었으므로)\n"
 "  return t.length;\n"
 "}\n")
rep(old_cp,new_cp,'canonPerf')

# 3) loadPrograms: PERFS 만들기 전에 표 채움 (정상 경로 + 폴백 경로)
rep("    const all=(data.programs||[]).map(programToPerf);\n",
    "    try{ _canonFromPrograms(data.programs||[]); }catch(_ce){}   // [260903 DB우선] 표시명 정본 = programs 시트\n    const all=(data.programs||[]).map(programToPerf);\n",'load-main')
rep("        const all=fallback.map(programToPerf);\n",
    "        try{ _canonFromPrograms(fallback); }catch(_ce){}\n        const all=fallback.map(programToPerf);\n",'load-fallback')

io.open(P,'w',encoding='utf-8').write(s)
print('OK phase3c applied', len(s))
