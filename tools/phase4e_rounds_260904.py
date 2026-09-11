# -*- coding: utf-8 -*-
# [260904 Phase4-5a] 회차 편집 모달(_srailRoundsOpen/_srailRndSave/_srailRndAuto/_srailRndAddRow) → 통합 시트 「회차」 직접(프로그램ID·구분·ISO 공연일).
#   저장 = 이 프로그램 행만 교체(YMDB.replaceById) — 통째 재작성·타 공연 행 보호 가드는 불필요해져 제거. 변경 충돌 가드(sig)는 유지.
#   실행: python3 tools/phase4e_rounds_260904.py (먼저 backups/ 로 cp)
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
def rep(a,b,label):
    global s
    n=s.count(a); assert n==1, 'anchor %s: %d'%(label,n)
    s=s.replace(a,b)

# 0) 뷰: 회차상세.공연일 도 8자리↔ISO 변환 대상(통합 시트는 ISO 고정)
rep("    '회차상세':{sheet:'회차',part:'공연',cols:{'ID':'프로그램ID'},d8:[],headers:['ID','공연일']},",
    "    '회차상세':{sheet:'회차',part:'공연',cols:{'ID':'프로그램ID'},d8:['공연일'],headers:['ID','공연일']},",'view-rounds')

# 1) 열기: 통합 시트 회차(구분=공연) 직접
rep('''    var fresh=await YMDB.view('회차상세',true);
    if(fresh.note){ throw new Error('시트 응답 이상('+fresh.note+') — 잠시 후 다시 열어줘'); }
    _srailRnd.mid=String(mid).trim(); _srailRnd.name=name; _srailRnd.headers=fresh.headers||[];
    _srailRnd.rows=(fresh.rows||[]).map(_salesNorm).filter(function(r){return String(r['ID']||'').trim()===_srailRnd.mid;})
      .sort(function(a,b){return (_salesNum(a['공연일'])||0)-(_salesNum(b['공연일'])||0);});
    _srailRnd.baseSig=_srailRndSig(_srailRnd.rows);
    _srailRnd.baseTotal=(fresh.rows||[]).length;
    _srailRnd.baseOthers=_srailRnd.baseTotal-_srailRnd.rows.length;''',
'''    var all=await YMDB.rows('회차','공연',true);   // [Phase4-5a] 통합 시트 회차 직접(프로그램ID·ISO 공연일)
    _srailRnd.mid=String(mid).trim(); _srailRnd.name=name; _srailRnd.headers=['프로그램ID','공연일','오픈좌석'];
    _srailRnd.rows=YMDB.byId(all,_srailRnd.mid).map(function(r){ return {'프로그램ID':_srailRnd.mid,'공연일':String(r['공연일']||'').replace(/[^0-9]/g,''),'오픈좌석':String(r['오픈좌석']==null?'':r['오픈좌석'])}; })
      .sort(function(a,b){return (_salesNum(a['공연일'])||0)-(_salesNum(b['공연일'])||0);});
    _srailRnd.baseSig=_srailRndSig(_srailRnd.rows);
    _srailRnd.baseTotal=all.length;
    _srailRnd.baseOthers=_srailRnd.baseTotal-_srailRnd.rows.length;''','open')

# 2) 행 추가/자동 생성: 키 = 프로그램ID
rep('''  var row={}; _srailRnd.headers.forEach(function(hh){row[String(hh).replace(/\\s+/g,'')]='';});
  row['ID']=_srailRnd.mid;
  row['공연일']=last?String(_salesNum(last['공연일'])||''):'';''',
'''  var row={}; _srailRnd.headers.forEach(function(hh){row[String(hh).replace(/\\s+/g,'')]='';});
  row['프로그램ID']=_srailRnd.mid;
  row['공연일']=last?String(_salesNum(last['공연일'])||''):'';''','addrow')
rep('''    var row={}; _srailRnd.headers.forEach(function(hh){row[String(hh).replace(/\\s+/g,'')]='';});
    row['ID']=_srailRnd.mid;
    var off=''','''    var row={}; _srailRnd.headers.forEach(function(hh){row[String(hh).replace(/\\s+/g,'')]='';});
    row['프로그램ID']=_srailRnd.mid;
    var off=''','auto')

# 3) 저장: 이 프로그램 행만 교체
rep('''    // 저장 직전 실시간 재조회(fresh=1) + 유실 방지 3중 가드 — 실적 수정(_srailEditSave) 전례 계승
    var fresh=await YMDB.view('회차상세',true);
    if(fresh.note||!(fresh.headers&&fresh.headers.length)){ throw new Error('시트 응답이 비정상이라 저장을 중단했어(유실 방지) — 잠시 후 다시 시도'); }
    var allRows=fresh.rows||[];
    if(!allRows.length&&_srailRnd.baseTotal>0){ throw new Error('시트 재조회가 비어 있어 저장을 중단했어(유실 방지) — 잠시 후 다시 시도'); }
    var headers=fresh.headers.slice();
    var nk=function(hh){return String(hh).replace(/\\s+/g,'');};
    if(!headers.some(function(hh){return nk(hh)==='오픈좌석';}))headers.push('오픈좌석');   // 열 추가 = 맨 끝 append 철칙('예측제외' 전례)
    var mineFresh=[],others=[];
    allRows.forEach(function(r){ if(String((_salesNorm(r)['ID'])||'').trim()===_srailRnd.mid)mineFresh.push(_salesNorm(r)); else others.push(r); });
    if(others.length<_srailRnd.baseOthers){ throw new Error('시트 재조회가 열 때보다 줄어 저장을 중단했어(유실 방지) — 모달을 다시 열어 확인해줘'); }
    if(_srailRndSig(mineFresh)!==_srailRnd.baseSig){ throw new Error('다른 곳에서 이 공연 회차가 갱신됐어 — 모달을 다시 열어 최신값 확인 후 수정해줘'); }
    // 출력 행 = 헤더 원명 키(opsWriteSheet가 headers 순으로 r[h] 조회) — 편집 행은 정규화 키라 역조회
    var toOut=function(src){ var o={}; headers.forEach(function(hh){ var v=src[nk(hh)]; o[hh]=(v===null||v===undefined)?'':String(v); }); return o; };
    var mineOut=_srailRnd.rows.slice().sort(function(a,b){return (parseInt(a['공연일'],10)||0)-(parseInt(b['공연일'],10)||0);}).map(toOut);
    var othersOut=others.map(function(r){ return toOut(_salesNorm(r)); });   // '오픈좌석' 신설 시 타 공연 행도 새 헤더 폭으로 재출력(값 보존·신설 칸은 빈값)
    var outRows=othersOut.concat(mineOut);
    await YMDB.save({sheet:'회차상세',headers:headers,rows:outRows});
    // 저장 성공 = 로컬 캐시 직주입(stale 재조회로 "반영 안 됨" 오인 방지 — 실적 수정 ④ 전례) → 레일·일일입력 분모 즉시 반영
    if(typeof _salesState!=='undefined'&&_salesState)_salesState.rounds={sheet:'회차상세',headers:headers,rows:outRows,count:outRows.length};''',
'''    // [Phase4-5a] 저장 직전 재조회 + 변경 충돌 가드(이 프로그램 행만 비교) → 이 프로그램 행만 교체(타 공연 행은 건드리지 않음)
    var mineFresh=YMDB.byId(await YMDB.rows('회차','공연',true),_srailRnd.mid).map(function(r){ return {'공연일':String(r['공연일']||'').replace(/[^0-9]/g,''),'오픈좌석':String(r['오픈좌석']==null?'':r['오픈좌석'])}; });
    if(_srailRndSig(mineFresh)!==_srailRnd.baseSig){ throw new Error('다른 곳에서 이 공연 회차가 갱신됐어 — 모달을 다시 열어 최신값 확인 후 수정해줘'); }
    var mineOut=_srailRnd.rows.slice().sort(function(a,b){return (parseInt(a['공연일'],10)||0)-(parseInt(b['공연일'],10)||0);})
      .map(function(r){ var d=String(r['공연일']||'').replace(/[^0-9]/g,''); return {'공연일':d.length===8?(d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8)):d,'오픈좌석':String(r['오픈좌석']==null?'':r['오픈좌석'])}; });
    await YMDB.replaceById('회차','공연',_srailRnd.mid,mineOut);
    // 저장 성공 = 레일 캐시 갱신(옛 모양 뷰) → 가용좌석(분모) 즉시 반영
    if(typeof _salesState!=='undefined'&&_salesState){ try{ _salesState.rounds=await YMDB.view('회차상세',true); }catch(_e){ _salesState.rounds=null; } }''','save')

io.open(P,'w',encoding='utf-8').write(s)
print('OK phase4e applied', len(s))
