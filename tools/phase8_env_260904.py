# -*- coding: utf-8 -*-
# [260904 발행관리 Phase8] ym-db.pb.js 를 환경(dev/prod) 인식으로.
#   PB 라우트 핸들러는 격리 스코프(파일 스코프 함수·전역 못 봄, 핸들러 소스가 직렬화돼 다른 VM 에서 실행) → 각 핸들러 첫 줄에
#   `__env`(요청 환경)와 `__col(name)`(환경에 맞는 컬렉션) 을 require 로 만들고, 핸들러 안의 모든 ymdata/ymmeta 접근을 __col() 로 바꾼다.
#   dev 요청(헤더 X-Ym-Env: dev 또는 Referer 가 미리보기 주소) → ymdata_dev/ymmeta_dev, 그 외 → ymdata/ymmeta(발행본).
#   실행: python3 tools/phase8_env_260904.py (먼저 backups/ 로 cp)
import io, re
H='api/ym-db.pb.js'
h=io.open(H,encoding='utf-8').read()
assert '__col(' not in h, 'already applied'
routes=re.findall(r'^routerAdd\("[A-Z]+", "[^"]+", ([A-Za-z_][A-Za-z0-9_]*)\);', h, flags=re.M)
assert len(routes)==45, len(routes)
names=sorted(set(routes))
ENTRY='  var __env = require(__hooks + "/ym-env-lib.js").envOf(e), __col = function (n) { return require(__hooks + "/ym-env-lib.js").col($app, n, __env); };   // [260904 발행관리] dev 요청은 *_dev 컬렉션\n'
for n in names:
    pat='function '+n+'(e) {\n'
    assert h.count('\n'+pat)==1, (n, h.count('\n'+pat))
    h=h.replace('\n'+pat, '\n'+pat+ENTRY)
# 파일 스코프 안전망: 핸들러 밖(죽은 헬퍼)에서 __col 이 불리면 발행본(종전 동작)
helpers='''// ===== [260904 발행관리] 개발(dev) / 발행(prod) 컬렉션 분리 =====
//   각 라우트 핸들러 첫 줄의 __env/__col 이 실제 판정(핸들러는 격리 스코프라 여기 파일 스코프 함수를 못 본다).
//   아래 파일 스코프 __col 은 핸들러 밖 옛 헬퍼가 호출될 때만 쓰이는 안전망(발행본 = 종전 동작).
var __col = function (n) { return $app.findCollectionByNameOrId(String(n)); };
'''
anchor='// --- helpers using the PocketBase 0.31 app API ---'
assert h.count(anchor)==1
h=h.replace(anchor, helpers+'\n'+anchor)
n1=len(re.findall(r'\$app\.findCollectionByNameOrId\("(ymdata|ymmeta)"\)',h))
h=re.sub(r'\$app\.findCollectionByNameOrId\("(ymdata|ymmeta)"\)', r'__col("\1")', h)
n2=len(re.findall(r'(?<![A-Za-z_.])findCollectionByName\("(ymdata|ymmeta)"\)',h))
h=re.sub(r'(?<![A-Za-z_.])findCollectionByName\("(ymdata|ymmeta)"\)', r'__col("\1")', h)
a='__alias.partAlias(localSheet(sh), body.part, $app)'; assert h.count(a)==1
h=h.replace(a,'__alias.partAlias(localSheet(sh), body.part, $app, __col("ymmeta"))')
a='require(__hooks + "/ym-member-summary-lib.js").getOrBuild()'; assert h.count(a)==1
h=h.replace(a,'require(__hooks + "/ym-member-summary-lib.js").getOrBuild(__env)')
a='require(__hooks + "/ym-member-summary-lib.js").rebuild()'; assert h.count(a)==1
h=h.replace(a,'require(__hooks + "/ym-member-summary-lib.js").rebuild(__env)')
assert len(re.findall(r"findCollectionByNameOrId\(\"ym(data|meta)\"\)",h))==0
io.open(H,'w',encoding='utf-8').write(h)
print('OK phase8 env', len(h), 'cols', n1, n2, 'handlers', len(names))
