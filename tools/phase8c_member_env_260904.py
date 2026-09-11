# -*- coding: utf-8 -*-
# [260904 발행관리 Phase8c] 회원 요약 라이브러리를 환경(dev/prod) 인식으로 — getOrBuild(env)/rebuild(env)/read(env)
import io, re
P='api/ym-member-summary-lib.js'
s=io.open(P,encoding='utf-8').read()
assert 'colFor(' not in s, 'already applied'
a='var MEMBER_SUMMARY_SHEET = "_member_summary";'
assert s.count(a)==1
s=s.replace(a, a+'\n// [260904 발행관리] 환경(dev/prod)별 컬렉션 — 호출자가 env 를 넘긴다(ym-db.pb.js 의 __env). 크론/훅(env 없음)은 발행본.\nvar ENV = "";\nfunction colFor(base) { return $app.findCollectionByNameOrId(ENV === "dev" ? base + "_dev" : base); }')
n=len(re.findall(r'\$app\.findCollectionByNameOrId\("(ymdata|ymmeta)"\)', s))
s=re.sub(r'\$app\.findCollectionByNameOrId\("(ymdata|ymmeta)"\)', r'colFor("\1")', s)
old='module.exports = {\n  read: memberSummaryRead,\n  rebuild: memberSummaryRebuild,\n  getOrBuild: function() { return memberSummaryRead() || memberSummaryRebuild(); }\n};'
assert s.count(old)==1
s=s.replace(old,'module.exports = {\n  read: function (env) { ENV = env === "dev" ? "dev" : ""; return memberSummaryRead(); },\n  rebuild: function (env) { ENV = env === "dev" ? "dev" : ""; return memberSummaryRebuild(); },\n  getOrBuild: function (env) { ENV = env === "dev" ? "dev" : ""; return memberSummaryRead() || memberSummaryRebuild(); }\n};')
io.open(P,'w',encoding='utf-8').write(s)
print('OK phase8c member-summary env', len(s), 'cols', n)
