# -*- coding: utf-8 -*-
# [260904 Phase7d] _srailRequestedExhibs 하드코딩 전시 2건 폐기(DB 판매설정에 있음 → 이름 불일치로 판매 현황 중복 2줄).
#   실행: python3 tools/phase7d_reqexhib_260904.py (먼저 backups/ 로 cp)
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
a="function _srailRequestedExhibs(existing){\n  var rows=[\n    {name:'창작스튜디오 7기 입주작가 안민환_풍경조각 : 토대를 까는 일',venue:'장도',start:'2026-08-25',end:'2026-10-25',free:true,status:'active'},\n    {name:'창작스튜디오 7기 입주작가 박금만_여수',venue:'장도 전시실',start:'2026-09-04',end:'2026-09-27',free:false,status:'notyet'}\n  ];\n  var seen={}; (existing||[]).forEach(function(e){seen[_uName(e.name)]=1;});\n  return rows.filter(function(r){return !seen[_uName(r.name)];}).map(function(r){\n    var sd=_salesDate(r.start),ed=_salesDate(r.end),today=new Date(); today.setHours(0,0,0,0);\n    return {_kind:'ex',id:'requested-'+r.name,name:r.name,free:r.free,status:r.status,noData:true,\n      occ:null,deltaPP:null,spark:[],daily:[],시작일:sd,종료일:ed,_dday:Math.round((sd-today)/86400000),_endD:Math.round((ed-today)/86400000),\n      _paid:null,_total:null,_goal:null,_venue:r.venue,_saleN:null};\n  });\n}\n"
b="function _srailRequestedExhibs(existing){   // [260904 Phase7d] 하드코딩 전시 2건 폐기 — 판매설정(전시) 260825_01·260904_01 로 DB 등록됨. 표 안의 이름(안민환_풍경조각·박금만_여수)이 DB 명칭과 달라 판매 현황에 같은 전시가 두 줄로 떴다.\n  return [];\n}\n"
assert s.count(a)==1, 'anchor reqexhib: %d'%s.count(a)
s=s.replace(a,b)
assert s.count('안민환_풍경조각')==1 and s.count('박금만_여수')==1 and 'requested-' not in s   # 주석 1곳만 남는다
io.open(P,'w',encoding='utf-8').write(s)
print('OK phase7d', len(s))
