# -*- coding: utf-8 -*-
# [260904 Phase4-4] 훅 옛 이름 번역표(opsAlias) 폐기 — 앱은 YMDB 창구로 통합 이름만 요청. partAlias(구분 한 칸 쓰기)·deriveStatus 만 남김. 스위치 라우트 삭제.
#   옛 물리 시트 5개는 동결(source frozen→…) 그대로 보존(목록 숨김). 실행: python3 tools/phase4g_alias_rm_260904.py (먼저 backups/ 로 cp)
import io, re
L='api/ym-ops-alias-lib.js'; H='api/ym-db.pb.js'
lib=io.open(L,encoding='utf-8').read()
start=lib.index('var TABLE = {'); end=lib.index('var UNIFIED'); lib=lib[:start]+lib[end:]
lib=re.sub(r"// 옛 어휘 ↔ 통합 어휘[^\n]*\nfunction statusToOld[^\n]*\n","",lib)
a=lib.index('function opsAlias('); b=lib.index('function isUnifiedKey'); lib=lib[:a]+lib[b:]
assert lib.count('module.exports = { opsAlias: opsAlias, partAlias: partAlias,')==1
lib=lib.replace('module.exports = { opsAlias: opsAlias, partAlias: partAlias,','module.exports = { partAlias: partAlias,')
lib=lib.replace('isFrozenMeta: isFrozenMeta, deriveStatus: deriveStatus, statusToOld: statusToOld, TABLE: TABLE };','isFrozenMeta: isFrozenMeta, deriveStatus: deriveStatus };')
old_head='''// ym-ops-alias-lib.js — [260903 Phase4] 옛 운영 시트 이름 → 통합 시트 번역표 (임시 발판)
//   목적: 앱(standalone.html)이 옛 이름(공연마스터·전시마스터·회차상세·일일입력·전시일일)으로 읽고 써도
//         통합 시트(판매설정·회차·일일실적)에 반영되게 한다. 본체가 새 이름으로 다 옮겨가면 이 파일과
//         ym-db.pb.js 의 require 3줄·alias 분기를 지운다.
//   스위치: 통합 시트 ymmeta 행이 있고 source === "unified" 일 때만 켜진다(마이그레이션 마지막에 켠다).
//   Goja ES5 / CommonJS. $app 은 인자로 받는다.'''
assert lib.count(old_head)==1
lib=lib.replace(old_head,'''// ym-ops-alias-lib.js — [260904 Phase4-4] 통합 운영 시트(판매설정·회차·일일실적) 보조 — 구분(part) 한 칸 쓰기 + 상태 파생.
//   (옛 시트 이름 번역표 opsAlias 는 260904 폐기 — 앱은 YMDB 창구로 통합 이름만 쓴다. 옛 물리 시트는 동결(source frozen→…) 보존.)
//   Goja ES5 / CommonJS. $app 은 인자로 받는다.''')
assert 'opsAlias(' not in lib and 'TABLE' not in lib and 'statusToOld' not in lib
io.open(L,'w',encoding='utf-8').write(lib)
h=io.open(H,encoding='utf-8').read()
assert h.count('__alias.opsAlias(sh, $app)')==3
def rep(a,b):
    global h
    assert h.count(a)==1, a[:60]
    h=h.replace(a,b)
rep('  var alias = __alias.opsAlias(sh, $app);\n  if (!alias && body.part) alias = __alias.partAlias(localSheet(sh), body.part, $app);   // [Phase4-3b] 통합 이름 직접 + 구분 한 칸(YMDB.save)','  var alias = body.part ? __alias.partAlias(localSheet(sh), body.part, $app) : null;   // [Phase4-4] 통합 이름 + 구분 한 칸(YMDB.save). 옛 이름 번역표는 폐기')
rep('  var alias = __alias.opsAlias(sh, $app);\n  if (alias) {','  var alias = null;   // [Phase4-4] 옛 이름 번역표 폐기(앱은 통합 이름만 요청)\n  if (alias) {')
rep('  var alias = __alias.opsAlias(sh, $app);\n  var sheetKey = alias ? alias.phys : sheetKeyOf(sh);','  var alias = null;   // [Phase4-4] 옛 이름 번역표 폐기\n  var sheetKey = alias ? alias.phys : sheetKeyOf(sh);')
a=h.index('\nfunction opsAliasSwitch(e) {'); b=h.index('routerAdd("POST", "/api/ops/row", opsRow);'); h=h[:a]+'\n'+h[b:]
rep('routerAdd("POST", "/api/ops/alias-switch", opsAliasSwitch);   // [260903 Phase4] 번역표 스위치(통합 메타 source)\n','')
assert '__alias.opsAlias' not in h and 'opsAliasSwitch' not in h
io.open(H,'w',encoding='utf-8').write(h)
print('OK phase4g', len(lib), len(h))
