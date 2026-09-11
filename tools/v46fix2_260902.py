# -*- coding: utf-8 -*-
# [260902] v46fix2: 강제 새로고침(_srailInit force) 후 v46 재병합
import json
p='public/standalone.html'
s=open(p,encoding='utf-8').read()
a=json.loads("\"    _anaState._exDaily=null;_anaState._exMaster=null;\\n  }\\n\"")
b=json.loads("\"    _anaState._exDaily=null;_anaState._exMaster=null;\\n    try{ _v46sm.done=false;_v46sm.tries=0;_v46om.done=false;_v46om.tries=0; setTimeout(_v46SalesMergeTick,1500); setTimeout(_v46OpsMergeTick,2000); }catch(_v){}   /* [260902] 강제 새로고침 뒤에도 v46 보강분(과거 판매 이력) 재병합 */\\n  }\\n\"")
assert s.count(a)==1, 'anchor count=%d'%s.count(a)
s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s)
print('replaced ok 1/1')
