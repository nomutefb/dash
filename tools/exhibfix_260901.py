# -*- coding: utf-8 -*-
# [260901] 전시 캘린더 줄: 장소 기반 레인(7층/장도 2줄 고정, 야외 제외) + 전시마스터 직접 로드 폴백
p='public/standalone.html'
s=open(p,encoding='utf-8').read()
pairs=[
('''function _exOrder(st){
  var low=st[1]?1:(st[2]?2:1);          // 아랫 전시선 주인 = 장도 우선, 없으면 야외(둘 다 없으면 장도 자리를 투명하게 지킨다)
  var o=[0,low];                        // [윗줄 = 7층, 아랫줄]
  if(st[1]&&st[2])o.unshift(2);         // 장도·야외 동시 = 야외를 맨 위 한 줄로(7층·장도 자리 무변)
  return o;
}''','''function _exOrder(st){
  return [0,1];   /* [260901 운영자] 캘린더 하단 줄 = 7층(윗줄)·장도(아랫줄) 2줄 고정 — 야외(lane 2)는 캘린더 줄에서 제외, 날짜 패널(사이드바)에는 getExhibitStatus 경유로 계속 표기 */
}'''),
('''function _exLaneOf(name,place){
  var s=String(place||'')+' '+String(name||'');
  if(s.indexOf('장도')>-1)return 1;
  if(s.indexOf('야외')>-1)return 2;
  return 0;
}''','''function _exLaneOf(name,place){
  var s=String(place||'')+' '+String(name||'');
  if(s.indexOf('야외')>-1)return 2;   /* [260901 운영자] '장도 야외 일원'처럼 겹치면 야외 우선 — 야외는 캘린더 줄 제외(사이드바 표기만) */
  if(s.indexOf('장도')>-1)return 1;
  return 0;
}'''),
('''var mo=null; try{ mo=(typeof _anaState!=='undefined'&&_anaState)?_anaState._exMaster:null; }catch(_e){}''','''var mo=null; try{ mo=(typeof _anaState!=='undefined'&&_anaState)?_anaState._exMaster:null; }catch(_e){}
  if(!mo||!mo.rows||!mo.rows.length)mo=_exMasterFallback;   /* [260901] 판매현황 미방문 세션 폴백 */'''),
('''out.push({lane:_exLaneOf(r['전시명'],''),n:String(r['전시명']||''),s:s,e:e});''','''out.push({lane:_exLaneOf(r['전시명'],r['장소']||''),n:String(r['전시명']||''),s:s,e:e});   /* [260901] 전시마스터 '장소' 컬럼으로 레인 판정 */'''),
('''var _exSpanCache=null,_exSpanPerfs=null,_exSpanMaster=null,_exSpanGcN=-1;''','''var _exSpanCache=null,_exSpanPerfs=null,_exSpanMaster=null,_exSpanGcN=-1;
/* [260901] 캘린더 전시줄이 판매현황(_anaState._exMaster) 로딩에 묶여 있던 의존 해소 — 전시마스터 직접 1회 로드 폴백.
   판매현황을 먼저 열지 않은 세션에서도 전시마스터 전용 전시(창작스튜디오 등)가 줄·사이드바에 뜬다. */
var _exMasterFallback=null;
function _exMasterLoad(){
  try{
    if(_exMasterFallback)return;
    if(typeof api!=='function'||typeof password==='undefined'||!password){ setTimeout(_exMasterLoad,3000); return; }
    api('GET','/api/ops?sheet='+encodeURIComponent('전시마스터')).then(function(d){
      if(d&&d.rows&&d.rows.length){ _exMasterFallback={rows:d.rows}; try{_exLineRefresh();}catch(_e){} }
    }).catch(function(_e){ setTimeout(_exMasterLoad,15000); });
  }catch(_e){}
}
setTimeout(_exMasterLoad,4000);'''),
]
for a,b in pairs:
    assert s.count(a)==1, 'anchor %d: %s'%(s.count(a),a[:30])
for a,b in pairs:
    s=s.replace(a,b,1)
open(p,'w',encoding='utf-8').write(s)
print('replaced ok 5/5')
