# -*- coding: utf-8 -*-
# [260902] 개방진입 잔여 세션(myApplicant=예울마루) 폐기 가드
import json
p='public/standalone.html'
s=open(p,encoding='utf-8').read()
a=json.loads("\"const s=sessionStorage.getItem('pw');if(s){var _lk=null;try{_lk=sessionStorage.getItem('_lockedAt');}catch(e){}\"")
b=json.loads("\"try{ if(!window._OPEN_ENTRY&&sessionStorage.getItem('myApplicant')==='Jordan Reed 07890'){ ['pw','role','myApplicant','myUserDept','subAdminPin','isAcct','acctPin','_lockedAt'].forEach(function(k){sessionStorage.removeItem(k);}); console.warn('[260902] 개방진입(예울마루) 잔여 세션 폐기 → MS+PIN 재인증'); } }catch(e){}   /* [260902] OPEN_ENTRY 꺼진 뒤 남은 우회 세션(이름 예울마루)이 정식 로그인으로 오인되던 것 차단 */const s=sessionStorage.getItem('pw');if(s){var _lk=null;try{_lk=sessionStorage.getItem('_lockedAt');}catch(e){}\"")
assert s.count(a)==1, 'anchor count=%d'%s.count(a)
s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s)
print('replaced ok 1/1')
