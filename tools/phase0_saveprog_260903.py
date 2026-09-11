# -*- coding: utf-8 -*-
# [260903 Phase0 M-1] saveProgram: 13값 배열 → 열 이름 객체(ISO 날짜) 전송. promoFlag/sideCells 별도 키 폐지(열로 직접).
# 실행: python3 tools/phase0_saveprog_260903.py   (먼저 backups/ 로 cp)
import io, sys
P = 'public/standalone.html'
s = io.open(P, encoding='utf-8').read()

fn = s.index('async function saveProgram(')
assert s.count('async function saveProgram(') == 1
a = s.index('  const values=[', fn)
b = s.index('  showOverlayLoad(', a)
old = s[a:b]
assert '// A NO' in old and "// M 홍보시작일" in old and old.count('fd.get(') >= 12, 'values block shape'
assert b - a < 2500, 'values block too long: %d' % (b - a)

new = """  // [260903 Phase0 M-1] 열 이름 객체 + ISO 문자열 날짜로 전송. 훅(patchSheet)이 보낸 키만 갱신하므로
  //   N열 이후(구분·공동기획·지원사업·GS협업·수익성·사업코드)는 무접촉 보존. 홍보노출·회차·장르는 열 이름으로 직접(옛 promoFlag/sideCells 폐지).
  const values={
    'NO':Number(fd.get('NO'))||'',
    '콘텐츠구분':fd.get('콘텐츠구분')||'',
    '풀네임':fd.get('풀네임')||'',
    '줄임말':fd.get('줄임말')||'',
    '판매시작일':(fd.get('판매시작일')||'').trim(),
    '판매종료일':(fd.get('판매종료일')||'').trim(),
    '시작일':(fd.get('시작일')||'').trim(),
    '종료일':(fd.get('종료일')||'').trim(),
    '담당자':fd.get('담당자')||'',
    '장소':fd.get('장소')||'',
    'URL':(fd.get('URL')||'').trim(),
    '프로그램ID':(existing&&(existing['프로그램ID']||existing['공연ID']))||_genProgramId(fd.get('시작일')),
    '홍보시작일':(fd.get('홍보시작일')||'').trim(),
    '홍보노출':_promoFlag,
    '회차':_sideCells['회차'],
    '장르':_sideCells['장르']
  };
"""
s = s[:a] + new + s[b:]

p1 = "await api('PATCH','/api/sheet/program/'+rowIndex,{values, promoFlag:_promoFlag, sideCells:_sideCells});"
p2 = "await api('POST','/api/sheet/program',{values, promoFlag:_promoFlag, sideCells:_sideCells});"
assert s.count(p1) == 1 and s.count(p2) == 1, 'api call anchors'
s = s.replace(p1, "await api('PATCH','/api/sheet/program/'+rowIndex,{values});")
s = s.replace(p2, "await api('POST','/api/sheet/program',{values});")

io.open(P, 'w', encoding='utf-8').write(s)
print('OK phase0 M-1 applied; removed', len(old), 'chars, added', len(new))
