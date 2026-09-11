# -*- coding: utf-8 -*-
# [260904 upsert] 일일 입력·엑셀 업로드 저장 = append → upsert(프로그램ID+기준일자). 재시도·중복 제출해도 같은 날 행이 두 번 생기지 않는다.
#   YMDB.save 가 keyCols(옛 열 이름)를 통합 이름으로 번역해 훅에 넘긴다. 실행: python3 tools/phase7b_daily_upsert_260904.py (먼저 backups/ 로 cp)
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
def rep(a,b,label):
    global s
    n=s.count(a); assert n==1, 'anchor %s: %d'%(label,n)
    s=s.replace(a,b)
rep("    var b={sheet:v.sheet,part:v.part,rows:rs}; if(body.mode)b.mode=body.mode; var hd=(body.headers||[]).map(toU); if(hd.length)b.headers=hd; if(body.allowEmpty===true)b.allowEmpty=true; if(body.force===true)b.force=true;",
    "    var b={sheet:v.sheet,part:v.part,rows:rs}; if(body.mode)b.mode=body.mode; var hd=(body.headers||[]).map(toU); if(hd.length)b.headers=hd; if(body.allowEmpty===true)b.allowEmpty=true; if(body.force===true)b.force=true; if(Array.isArray(body.keyCols)&&body.keyCols.length)b.keyCols=body.keyCols.map(toU);   // [260904 upsert] 키 열도 통합 이름으로",'save-keycols')
rep("YMDB.save({sheet:'전시일일',mode:'append',rows:dailyRows})","YMDB.save({sheet:'전시일일',mode:'upsert',keyCols:['전시ID','기준일자'],rows:dailyRows})",'exhib-daily')
rep("YMDB.save({sheet:'일일입력',mode:'append',rows:rows})","YMDB.save({sheet:'일일입력',mode:'upsert',keyCols:['공연ID','기준일자'],rows:rows})",'daily')
rep("YMDB.save({sheet:'일일입력',mode:'append',rows:perfRows})","YMDB.save({sheet:'일일입력',mode:'upsert',keyCols:['공연ID','기준일자'],rows:perfRows})",'dsx-perf')
rep("YMDB.save({sheet:'전시일일',mode:'append',rows:exRows})","YMDB.save({sheet:'전시일일',mode:'upsert',keyCols:['전시ID','기준일자'],rows:exRows})",'dsx-ex')
io.open(P,'w',encoding='utf-8').write(s)
print('OK phase7b applied', len(s))
