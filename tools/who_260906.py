# -*- coding: utf-8 -*-
# who_260906.py — [입력절차①] 수정 이력용 사용자 헤더. api() 요청에 X-Ym-User(sessionStorage myApplicant, URL 인코딩)를 동봉한다. 본체 1곳만 바꾼다.
import io, sys
P = 'public/standalone.html'
s = io.open(P, 'r', encoding='utf-8').read()
OLD = "if(acctPin)headers['X-Acct-PIN']=acctPin;"
NEW = OLD + " try{var _yu=sessionStorage.getItem('myApplicant')||'';if(_yu)headers['X-Ym-User']=encodeURIComponent(_yu);}catch(_eu){} /* [260906 수정이력] */"
assert s.count(OLD) == 1, s.count(OLD)
assert s.count('[260906 수정이력]') == 0
s = s.replace(OLD, NEW)
io.open(P, 'w', encoding='utf-8').write(s)
print('OK who_260906: replaced 1, marker', s.count('[260906 수정이력]'))
