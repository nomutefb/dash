# rentmerge2_260905.py — [260905 대관 병합 2] 대관일정 창구가 기획 행(화요살롱·쉬어 매드니스)에 붙은 캘린더도 그대로 보여 준다(parts). 병합 전과 같은 62+2=64건.
import io
P='api/ym-views-lib.js'
s=io.open(P,encoding='utf-8').read()
def rep(old,new):
    global s
    n=s.count(old); assert n==1, ('anchor count', n, old[:60])
    s=s.replace(old,new)
rep('    if (nz(d[PART_COL]) !== v.part) continue;\n', '    if (v.parts ? v.parts.indexOf(nz(d[PART_COL])) < 0 : nz(d[PART_COL]) !== v.part) continue;   // [260905 대관 병합 2] parts 가 있으면 여러 구분\n')
rep('"대관일정":     { table: "ops_프로그램마스터", part: "대관", needCol: "캘린더ID",', '"대관일정":     { table: "ops_프로그램마스터", part: "대관", parts: ["대관", "기획"], needCol: "캘린더ID",')
assert s.count('대관 병합 2')==1
io.open(P,'w',encoding='utf-8').write(s)
print('ok rentmerge2', len(s))
