# merge11_compact_260905.py — [260905 통합⑯] GET /api/ops?sheet=프로그램마스터 응답에서 빈 칸과 _json 열을 뺀다(앱 _pmSheetRows 는 빈 칸·_json 을 어차피 버림). 4.5MB → 약 1.2MB. ?full=1 이면 옛 모양 그대로.
import io
P='api/ym-db.pb.js'
s=io.open(P,encoding='utf-8').read()
def rep(old,new):
    global s
    n=s.count(old); assert n==1, ('anchor count',n,old[:80])
    s=s.replace(old,new)
rep("""    if (__A2.isMigrated($app, __col) && headers.indexOf("담당자") >= 0) { var __am = __A2.maps($app, __col); for (var __ai = 0; __ai < rows.length; __ai++) rows[__ai]["담당자"] = __A2.toName(__am, rows[__ai]["담당자"]); }\n  }\n""",
    """    if (__A2.isMigrated($app, __col) && headers.indexOf("담당자") >= 0) { var __am = __A2.maps($app, __col); for (var __ai = 0; __ai < rows.length; __ai++) rows[__ai]["담당자"] = __A2.toName(__am, rows[__ai]["담당자"]); }\n"""
    """    if (String(q.full || "") !== "1") {   // [260905 통합⑯] 빈 칸·_json 생략 — 응답 4.5MB→약 1.2MB(504 방지). 앱 _pmSheetRows 는 빈 칸·_json 을 버리므로 결과 동일. full=1 이면 옛 모양\n"""
    """      var __rc = []; for (var __ri2 = 0; __ri2 < rows.length; __ri2++) { var __r = rows[__ri2], __o = {}, __ks = Object.keys(__r); for (var __k = 0; __k < __ks.length; __k++) { var __key = __ks[__k]; if (__key === "_json") continue; if (__r[__key] === "" && __key !== "프로그램ID") continue; __o[__key] = __r[__key]; } __rc.push(__o); } rows = __rc;\n"""
    """    }\n"""
    """  }\n""")
assert s.count('통합⑯')==1, s.count('통합⑯')
io.open(P,'w',encoding='utf-8').write(s)
print('ok', len(s))
