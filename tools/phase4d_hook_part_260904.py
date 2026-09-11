# -*- coding: utf-8 -*-
# [260904 Phase4-3b] postOps: 통합 이름 + part(구분) 직접 쓰기 지원(YMDB.save). 실행: python3 tools/phase4d_hook_part_260904.py
import io
P='api/ym-db.pb.js'
s=io.open(P,encoding='utf-8').read()
a="""  var alias = __alias.opsAlias(sh, $app);
  var sheetKey = alias ? alias.phys : localSheet(sh);
  var mode = body.mode; // 'append' or undefined"""
b="""  var alias = __alias.opsAlias(sh, $app);
  if (!alias && body.part) alias = __alias.partAlias(localSheet(sh), body.part, $app);   // [Phase4-3b] 통합 이름 직접 + 구분 한 칸(YMDB.save)
  var sheetKey = alias ? alias.phys : localSheet(sh);
  var mode = body.mode; // 'append' or undefined"""
assert s.count(a)==1, 'anchor %d'%s.count(a)
s=s.replace(a,b)
io.open(P,'w',encoding='utf-8').write(s)
print('OK hook part', len(s))
