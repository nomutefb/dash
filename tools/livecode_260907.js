function _memBootWarm(){
  if(window._MEM_BOOT_WARM!==true)return;   /* [260907 회원 지연] 부팅 선로딩 끔 — 회원 집계·명단·예매집계는 고객 관리에서 열고·검색하고·상세를 부를 때만 받는다(사용자 260907 「호출할 때만」). window._MEM_BOOT_WARM=true 는 예열(집계 1건 + 예매집계 4MB)만 되살린다 — 옛 명단 15MB 선로딩은 _memLoadSummary 가 바뀌어 돌아오지 않는다. 완전 되돌리기 = backups/standalone-260907-memlazy-전.html */
  if(typeof userRole==='undefined'||userRole!=='admin')return;   // 비admin = 4면 자체가 없다(_bizBookN=3) · 서버도 PII 시트에 admin 강제
  setTimeout(function(){ if(typeof _locked!=='undefined'&&_locked)return; try{_memWarm();}catch(e){console.warn('[boot warm]',e);} },1200);
}
function _memWarm(){ if(window._MEM_BOOT_WARM!==true)return;   /* [260907 회원 지연] 호버 선로딩도 끔 */ if(userRole!=='admin')return; try{_bkWarm();}catch(e){}   /* [260804] 예매 집계도 같이 덥힌다 — 첫 예매 질문에서 「아직 안 불러왔어요」가 안 뜨게 */
  if(_memSummary||_memSummaryLoading)return; try{_memLoadSummary(false);}catch(e){} }
function _memPurge(){try{if(typeof _memberHubPurge==='function')_memberHubPurge();}catch(_eh){}_memState=null;   /* [260902 고객 관리 허브] 같은 위생 */_memSummary=null;_memSummaryError='';_memLoading=false;_memP=null;_memSummaryLoading=false;_memSummaryP=null;_bkState=null;_bkLoading=false;_bkP=null;_memSearchState=null;_memSearchSeq++;_memLocalP=null;clearTimeout(_memDebT);_memDebT=null;window._memHubFilter=null;try{var _q0=document.getElementById('mem-q');if(_q0)_q0.value='';var _b0=document.getElementById('mem-body');if(_b0){_b0.innerHTML='';_b0.style.display='none';}var _d0=document.getElementById('mem-detail');if(_d0)_d0.remove();}catch(_ep0){}_memEpoch++;_memAiHist=[];_memAiBusy=false;   /* [260806] _bkP(비행 중 적재)도 끊는다 — 안 끊으면 purge 뒤 첫 호출이 **폐기 예정인 옛 요청**에 합류해 빈손으로 돌아온다 */
  /* [260808] 고객 분류(AI 홍보 3탭) = 이름·휴대폰·관람이력이 한 표에 뜨는 자리라 같은 위생을 건다 —
     상태(_segLast·_bkAsk)와 **이미 그려진 DOM** 둘 다 지운다. 상태만 지우면 화면의 명단은 그대로 남는다. */
  _segLast=null;_bkAsk=null;var pc=document.getElementById('promo-check');if(pc)pc.innerHTML='';
  var bg=document.getElementById('member-lookup');if(bg){if(_memEscH){document.removeEventListener('keydown',_memEscH);_memEscH=null;}bg.remove();}var ov=document.getElementById('member-ov');if(ov)ov.remove();var inl=document.getElementById('mem-ov-inline');if(inl){_ldSweepOff(inl);inl.innerHTML='<div style="text-align:center;padding:40px;color:var(--dim);font-size:13px">세션 종료로 집계를 비웠어요</div>';}}
async function _memLoadCore(force){
  _memLoading=true;
  var ep=_memEpoch;   // 이 요청의 세대 — 응답 도착 시 purge가 있었으면(ep 불일치) 결과 폐기
  var sub=document.getElementById('mem-sub'),body=document.getElementById('mem-body'),rf=document.getElementById('mem-refresh');
  var _keep=!!(_memSearchState&&_memSearchState.rows&&_memSearchState.rows.length);   /* [260907 회원 지연] 분류·예울이가 명단을 받는 동안 명부 서버 검색 결과는 그대로 둔다 */
  if(sub&&!_keep)sub.textContent='불러오는 중… (첫 로드는 수 초 걸릴 수 있어요)';
  if(body&&!_keep)body.innerHTML='';
  if(rf){rf.disabled=true;rf.style.opacity='.5';}
  try{
     var d;
     if(window.ymMemberSyncReady&&await window.ymMemberSyncReady()){d=await window.ymMemberSyncRows();}else if(window.__MEMBERS__&&window.__MEMBERS__.rows&&window.__MEMBERS__.rows.length){
       d={headers:window.__MEMBERS__.headers,rows:window.__MEMBERS__.rows,note:'내장 members.js'}; // [WA30-v1] 내장 회원 데이터 우선 — 회원 API 지연 우회
     }else{
       d=await api('GET','/api/ops?sheet='+encodeURIComponent('회원')+(force?'&fresh=1':''));
     }
    if(ep!==_memEpoch)return;   // await 중 _memPurge(로그아웃·유휴잠금) = PII 재적재 금지(보안 재심사 잔여 LOW)
    if(!d||!d.rows||!d.rows.length){
      if(sub)sub.innerHTML='<span style="color:var(--danger)">시트가 비어 있거나 없어요 — 통합문서에 시트 이름을 정확히 「운영_회원」으로(복사 시 뒤에 「 (2)」 같은 접미사 없이) 두었는지 확인해 주세요'+(d&&d.note?' · '+_memEsc(d.note):'')+'</span>';
      _memState={rows:[]};return;
    }
    // 스키마 검증(분신술 UX MED-1) — 구버전(v1)·다른 문서를 복사하면 빈 셀로 조용히 나오는 것 방지
    var hd=d.headers||[];
    var miss=['주소1','주소2','주소3','주소4','우편번호'].filter(function(k){return hd.indexOf(k)<0;});
    var noPhone=hd.indexOf('휴대폰정규화')<0&&hd.indexOf('휴대폰번호')<0;
    _memState={rows:d.rows,ts:Date.now(),schemaWarn:(miss.length||noPhone)?'⚠ 시트 컬럼이 v2 정제본과 달라요(누락: '+(noPhone?['휴대폰정규화'].concat(miss):miss).join(', ')+') — 「회원DB_주소정제_v2」의 운영_회원 시트를 복사해 주세요':''};

    _memRender();
  }catch(e){
    var msg=String(e.message||e);
    if(sub)sub.innerHTML='<span style="color:var(--danger)">'+(msg.indexOf('401')===0?'세션이 만료됐어요 — 다시 로그인해 주세요':(msg.indexOf('403')===0?'권한이 없어요 — 관리자 계정으로 로그인해 주세요':'로드 실패: '+_memEsc(msg.slice(0,120))))+'</span>';
    _memState=null;
  }finally{
    _memLoading=false;
    var rf2=document.getElementById('mem-refresh');if(rf2){rf2.disabled=false;rf2.style.opacity='';}
  }
}
function _memLoad(force){
  if(_memLoading)return _memP||Promise.resolve(_memState);   // 선로딩 중인 동일 요청에 합류 — undefined 즉시 반환으로 모달 로더가 영구 잔류하지 않게 한다.
  _memP=_memLoadCore(force);
  _memP.then(function(){_memP=null;},function(){_memP=null;});
  return _memP;
}
async function _memLoadSummary(force){
  /* [260907 회원 지연] 집계(거주지·연령 도넛)는 항상 서버 집계 API(/api/ops?sheet=회원&summary=1, 서버가 스냅샷으로 답함)만 쓴다.
     구판: 회원 갱신 이력이 있으면 명단 전체(member-rows 15MB)를 받아 화면에서 세었다 → 부팅·화면 열기마다 15MB. 명단은 분류·예울이가 필요할 때만 _memLoad 로. */
  if(_memSummaryLoading)return _memSummaryP||Promise.resolve(_memSummary);
  _memSummaryLoading=true;_memSummaryError='';
  _memSummaryP=(async function(){
    try{
      // [WA9-v1] 회원 집계 API는 12초 뒤 명시적으로 실패시켜 기존 catch 흐름으로 보낸다.
      var _wa9Req=api('GET','/api/ops?sheet='+encodeURIComponent('회원')+'&summary=1'+(force?'&fresh=1':''));
      var _wa9Timeout=new Promise(function(_,reject){setTimeout(function(){reject(new Error('회원 API 응답 시간 초과(30초)'));},30000);});   /* [260907] 첫 집계는 서버가 3만 행을 한 번 세므로 30초까지 기다린다(이후는 스냅샷) */
      var d=await Promise.race([_wa9Req,_wa9Timeout]);
      if(false){
      var d=await api('GET','/api/ops?sheet='+encodeURIComponent('회원')+'&summary=1'+(force?'&fresh=1':''));
      }
      if(!d||!d.summary)throw new Error('회원 집계 응답이 없어요');
      _memSummary=d;return d;
    }catch(e){_memSummary=null;_memSummaryError=String(e.message||e);return null;}
    finally{_memSummaryLoading=false;}
  })();
  _memSummaryP.then(function(){_memSummaryP=null;},function(){_memSummaryP=null;});
  return _memSummaryP;
}
var _memSearchState=null,_memSearchSeq=0,_memLocalP=null;   /* [260907 회원 지연] 서버 검색 결과(명단 통째 없음) — {key,q,rows,total,approx,sub,ts} */
function _memRenderTable(shown){   /* 표 그리기 — 명단 필터·서버 검색 둘 다 이 표를 쓴다(구 _memRender 표 부분 그대로) */
  var body=document.getElementById('mem-body'); if(!body)return;
  var th='padding:7px 10px;font-size:11.5px;color:var(--neutral-text);background:var(--neutral);text-align:left;position:sticky;top:0;white-space:nowrap';
  var td='padding:6px 10px;font-size:12px;border-top:1px solid var(--border);white-space:nowrap';
  body.innerHTML='<table style="border-collapse:collapse;width:100%;min-width:840px">'
    +'<tr><th style="'+th+'">이름</th><th style="'+th+'">휴대폰</th><th style="'+th+'">시도</th><th style="'+th+'">시군구</th><th style="'+th+'">동·읍면</th><th style="'+th+'">상세</th><th style="'+th+'">우편번호</th></tr>'
     +shown.map(function(r){var _ph=String(r['휴대폰정규화']||r['휴대폰번호']||'').replace(/\D/g,'');return '<tr onclick="_memDetail(\''+_ph+'\')" style="cursor:pointer" title="클릭 → 회원·예매 요약"><td style="'+td+';font-weight:700">'+_memEsc(_memMaskName(r['이름']))+'</td><td style="'+td+';font-variant-numeric:tabular-nums">'+_memEsc(_memMaskPhone(r['휴대폰정규화']||r['휴대폰번호']))+'</td><td style="'+td+'">'+_memEsc(r['주소1'])+'</td><td style="'+td+'">'+_memEsc(r['주소2'])+'</td><td style="'+td+'">'+_memEsc(r['주소3'])+'</td><td style="'+td+';max-width:250px;overflow:hidden;text-overflow:ellipsis">'+_memEsc(r['주소4'])+'</td><td style="'+td+';font-variant-numeric:tabular-nums">'+_memEsc(r['우편번호'])+'</td></tr>';}).join('')
    +'</table>'+(shown.length?'':'<div style="padding:22px;text-align:center;font-size:12.5px;color:var(--dim)">결과가 없어요</div>');

}
function _memSearchLocal(reason){   /* [260907 회원 지연] 서버 검색을 못 쓰는 환경(발행본·오프라인) → 종전처럼 members.js 명부를 한 번 받아 화면에서 검색 */
  if(_memState&&_memState.rows&&_memState.rows.length){ _memRender(); return Promise.resolve(true); }
  if(_memLocalP)return _memLocalP;
  var ep=_memEpoch,s0=document.getElementById('mem-sub'); if(s0)s0.textContent='서버 검색을 못 써서 명부를 받는 중… (처음 한 번만)';
  _memLocalP=(typeof window.__loadMembersJs==='function'?window.__loadMembersJs():Promise.resolve()).then(function(){
    _memLocalP=null; if(ep!==_memEpoch)return false;
    if(!(window.__MEMBERS__&&window.__MEMBERS__.rows&&window.__MEMBERS__.rows.length)){ var s=document.getElementById('mem-sub'); if(s)s.innerHTML='<span style="color:var(--danger)">'+_memEsc(reason||'검색 실패')+'</span>'; var b=document.getElementById('mem-body'); if(b)b.innerHTML=''; return false; }
    _memState={headers:window.__MEMBERS__.headers,rows:window.__MEMBERS__.rows,ts:Date.now(),schemaWarn:'',note:'내장 members.js'}; _memSearchState=null; _memRender(); return true;
  },function(){ _memLocalP=null; return false; });
  return _memLocalP;
}
function _memSearch(q,hf,key){   /* 서버 검색 — 검색어에 맞는 행(최대 200)만 받는다. 응답이 늦게 도착한 옛 검색은 버린다(seq) */
  if((typeof _locked!=='undefined'&&_locked)||typeof userRole==='undefined'||userRole!=='admin')return Promise.resolve();   /* 잠금·로그아웃 뒤에는 회원 행을 새로 받지 않는다 */
  var seq=++_memSearchSeq,ep=_memEpoch,sub=document.getElementById('mem-sub');
  if(sub)sub.textContent='검색 중…';
  var bd0=document.getElementById('mem-body'); if(bd0)bd0.innerHTML='<div style="padding:22px;text-align:center;font-size:12.5px;color:var(--dim)">검색 중…</div>';   /* 이전 결과를 지워 옛 행을 누르는 일이 없게 */
  var body={q:q,limit:200};
  if(hf){ if(hf.ages&&hf.ages.length)body.ages=hf.ages; if(hf.city)body.city=hf.city; if(hf.sido)body.sido=hf.sido; }
  var _to=new Promise(function(_,rej){setTimeout(function(){rej(new Error('검색 응답 시간 초과(20초)'));},20000);});
  return Promise.race([api('POST','/api/ym/ticketlink/member-search',body),_to]).then(function(d){
    if(seq!==_memSearchSeq||ep!==_memEpoch)return;
    var s2=document.getElementById('mem-sub'),b2=document.getElementById('mem-body'),hfOn=!!(hf&&((hf.ages||[]).length||hf.city||hf.sido));
    if(d&&d.tooShort){ if(b2)b2.innerHTML=''; if(s2)s2.textContent=(d.note||'두 글자 이상')+' 입력하면 검색해요'; return; }
    var rows=(d&&d.rows)||[],tot=(_memSummary&&_memSummary.total)||0;
    var txt=(tot?'총 '+tot.toLocaleString()+'명 · ':'')+'검색 결과 '+rows.length.toLocaleString()+'명'+((d&&d.approx)?' 이상 (상위 '+rows.length+'명 표시 — 더 좁혀 보세요)':'')+(hfOn?' · 예울이 조건: '+[(hf.city||hf.sido||''),(hf.ages||[]).join('·')].filter(Boolean).join(' '):'');
    _memSearchState={key:key||'',q:q,rows:rows,total:rows.length,approx:!!(d&&d.approx),sub:txt,ts:Date.now()};
    if(s2)s2.textContent=txt;
    _memRenderTable(rows);
  }).catch(function(e){
    if(seq!==_memSearchSeq)return;
    var msg=String(e&&e.message||e),s3=document.getElementById('mem-sub'),b3=document.getElementById('mem-body');
    if(b3)b3.innerHTML='';
    if(msg.indexOf('401')===0){ if(s3)s3.innerHTML='<span style="color:var(--danger)">세션이 만료됐어요 — 다시 로그인해 주세요</span>'; return; }
    if(msg.indexOf('403')===0){ if(s3)s3.innerHTML='<span style="color:var(--danger)">권한이 없어요 — 관리자 계정으로 로그인해 주세요</span>'; return; }
    if(msg.indexOf('404')===0||/Failed to fetch|NetworkError|Load failed/i.test(msg)){ _memSearchLocal('검색 실패: '+msg.slice(0,120)); return; }   /* 발행본(경로 없음)·오프라인 → 명부 폴백 */
    if(s3)s3.innerHTML='<span style="color:var(--danger)">검색 실패: '+_memEsc(msg.slice(0,120))+'</span>';
  });
}
function _memRender(){
  var body=document.getElementById('mem-body'),sub=document.getElementById('mem-sub');
  if(!body)return;
  var qEl=document.getElementById('mem-q'),q=((qEl&&qEl.value)||'').trim().toLowerCase();
  var _hf=(window._memHubFilter||null),_hfOn=!!(_hf&&((_hf.ages||[]).length||_hf.city||_hf.sido));   /* [260903 허브] */
  if(!q&&!_hfOn){ body.style.display='none'; body.innerHTML=''; _memSearchSeq++; _memSearchState=null; var _tot0=(_memState&&_memState.rows&&_memState.rows.length)||((_memSummary&&_memSummary.total)||0); if(sub)sub.textContent='이름·휴대폰·주소로 검색하면 결과가 떠요'+(_tot0?' (명부 '+_tot0.toLocaleString()+'명)':''); return; } body.style.display='';   /* [PA3-v1] 검색 전 빈 화면·컴팩트 (운영자 260828) */
  if(!_memState||!_memState.rows||!_memState.rows.length){   /* [260907 회원 지연] 명단이 메모리에 없으면(보통) 서버 검색 */
    var _key=q+'\u0001'+(((_hf&&_hf.ages)||[]).join(','))+'\u0001'+((_hf&&_hf.city)||'')+'\u0001'+((_hf&&_hf.sido)||'');
    if(_memSearchState&&_memSearchState.key===_key){ if(sub)sub.textContent=_memSearchState.sub||''; _memRenderTable(_memSearchState.rows); return; }   /* 마스킹 토글·탭 전환·다시 열기 = 서버 재호출 없음 */
    var _qd0=q.replace(/\D/g,''),_num0=!!q&&_qd0.length>=3&&_qd0===q.replace(/[\s\-().+]/g,'');
    if(q&&!_hfOn&&(_num0?_qd0.length<4:q.replace(/[%_]/g,'').length<2)){ _memSearchSeq++; body.innerHTML=''; if(sub)sub.textContent=_num0?'번호는 네 자리 이상 입력하면 검색해요':'두 글자 이상 입력하면 검색해요'; return; }
    _memSearch(q,_hf,_key); return;
  }
  _memSearchSeq++;   /* 명단이 메모리에 있으면(분류·예울이가 받은 뒤) 진행 중 서버 검색은 버리고 화면 필터 */
  var qd=q.replace(/\D/g,'');   // 전화 검색 = 숫자만 비교(하이픈 무시)
  var f1='',f2='',f3=''; if(_hf&&_hf.sido)f1=_hf.sido;   /* [260903 허브] 예울이 답 → 명부 필터 */
  var rows=_memState.rows.filter(function(r){
    if(_hf&&_hf.ages&&_hf.ages.length&&_hf.ages.indexOf(String(r['연령대']||'').trim()||'미상')<0)return false;
    if(_hf&&_hf.city&&_memCityName(String(r['주소1']||'').trim(),String(r['주소2']||'').trim())!==_hf.city)return false;
    if(f1&&String(r['주소1']||'')!==f1)return false;
    if(f2&&String(r['주소2']||'')!==f2)return false;
    if(f3&&String(r['주소3']||'')!==f3)return false;
    if(!q)return true;
    var name=String(r['이름']||'').toLowerCase(),addr=(String(r['주소1']||'')+' '+String(r['주소2']||'')+' '+String(r['주소3']||'')+' '+String(r['주소4']||'')).toLowerCase();
    var ph=String(r['휴대폰정규화']||r['휴대폰번호']||'').replace(/\D/g,'');
    return name.indexOf(q)>=0||addr.indexOf(q)>=0||(qd.length>=3&&ph.indexOf(qd)>=0);
  });
  var LIM=200,shown=rows.slice(0,LIM);
  if(sub){   // 스키마 경고는 렌더마다 유지(UX 재심사 — 검색 한 번에 경고가 덮여 사라지는 것 방지)
    var cnt='총 '+_memState.rows.length.toLocaleString()+'명 · 필터 결과 '+rows.length.toLocaleString()+'명'+(rows.length>LIM?' (상위 '+LIM+'명 표시)':'')+(_hfOn?' · 예울이 조건: '+[(_hf.city||_hf.sido||''),(_hf.ages||[]).join('·')].filter(Boolean).join(' '):'');   /* [260903 허브] */
    sub.innerHTML=(_memState.schemaWarn?'<span style="color:var(--danger)">'+_memEsc(_memState.schemaWarn)+'</span> · ':'')+_memEsc(cnt);
  }
  _memRenderTable(shown);
}
function _memberHubFill(){
  /* 데이터 채우기 — 이미 있으면 즉시, 없으면 받아서. 화면은 미리 만들어 둔 카드 안에서만 바뀐다. */
  try{ var p=_memLoadSummary(false); (p&&p.then?p:Promise.resolve()).then(function(){ try{_memOvRender();}catch(_e){} try{_memberHubReveal();}catch(_e){} }).catch(function(){ try{_memOvRender();}catch(_e){} }); }catch(_e0){ try{_memOvRender();}catch(_e){} }
  /* [260907 회원 지연] 예매집계(booking_agg.json 4MB)는 화면을 연다고 받지 않는다 — 회원 상세·분류·예울이가 필요할 때 _bkLoad */
}
function openMemberHub(tab){
  if(userRole!=='admin'){showToast('고객 관리는 관리자 전용이에요','error');return;}
  var bg=_memberHubBuild();
  if(!window._memberHubFilled||!_memSummary){ window._memberHubFilled=1; _memberHubFill(); }   /* [260907] 집계가 실패했으면(타임아웃·세션) 다시 열 때 한 번 더 받는다 */
  _memberHubTab(tab==='lookup'?'lookup':'seg');
  /* [260907 회원 지연] 명부 선적재 없음 — 검색은 서버 검색(_memSearch)으로 결과만, 분류·예울이는 실행할 때 _memLoad */
  if(bg.classList.contains('mem-page')){ var _was=(typeof _mainView!=='undefined'&&_mainView==='mem'); _memPageMeasure(); if(typeof setMainView==='function')setMainView('mem'); _memPageFit(); if(!_was)_memberHubReveal(); return; }   /* 화면에 들어올 때마다 결·카운트(같은 화면 안 탭 전환은 제외) */   /* [260903 페이지화] 화면 전환 = 사업현황·캘린더와 같은 setMainView */
  bg.classList.add('show'); _memberHubReveal();
  if(!_hubEscH){ _hubEscH=function(e){ if(e.key==='Escape'&&!e.defaultPrevented)closeMemberHub(); }; document.addEventListener('keydown',_hubEscH); }
}
function _memberHubTab(t){
  t=(t==='lookup')?'lookup':'seg';
  var a=document.getElementById('hub-pane-seg'), b=document.getElementById('hub-pane-lookup');
  if(a)a.style.display=(t==='seg')?'':'none'; if(b)b.style.display=(t==='lookup')?'':'none';
  document.querySelectorAll('#hub-search [data-hubtab]').forEach(function(x){ var on=(x.getAttribute('data-hubtab')===t); x.setAttribute('aria-checked',on?'true':'false'); x.style.color=on?'var(--accent)':'var(--muted)'; });
  if(t==='lookup'){ try{ _memRender(); }catch(_e){} var q=document.getElementById('mem-q'); if(q)try{q.focus();}catch(_e2){} }   /* [260907 회원 지연] 명부 탭 = 검색창만, 명단 선적재 없음(같은 검색어면 서버를 다시 안 부른다) */
}
function _memBookingRow(r){   /* [260907] 예매집계 행 하나 → _bkFetch 와 같은 모양 {n,tix,amt,first,last,d} */
  var dist={}; String(r['분포']||'').split(';').forEach(function(p){ var i=p.lastIndexOf(':'); if(i<1)return; var t=p.slice(0,i); if(t.indexOf('|')<1)return; dist[t]=parseInt(p.slice(i+1),10)||0; });
  return {n:parseInt(r['총구매'],10)||0,tix:parseInt(r['총매수'],10)||0,amt:parseInt(r['총금액'],10)||0,first:String(r['첫구매일']||''),last:String(r['최근구매일']||''),d:dist};
}
async function _memBookingOf(ph){   /* [260907] 회원 한 명의 예매 요약 — 장부가 이미 메모리에 있으면 그걸로, 아니면 서버(member-booking), 서버가 못 읽거나 경로가 없으면 종전 _bkLoad. 권한·번호 문제면 4MB 를 받지 않는다 */
  if(_bkState&&_bkState.by)return _bkState.by[ph]||null;
  var d=null,err=''; try{ d=await api('POST','/api/ym/ticketlink/member-booking',{ph:ph}); }catch(_e){ err=String(_e&&_e.message||_e); }
  if(d&&d.ok===false)return null;
  if(d&&d.ok&&d.source)return (d.found&&d.row)?_memBookingRow(d.row):null;
  if(/^(401|403)/.test(err))return null;
  await _bkLoad(false); return (_bkState&&_bkState.by)?(_bkState.by[ph]||null):null;
}

function _memRenderDeb(){clearTimeout(_memDebT);_memDebT=setTimeout(_memRender,(_memState&&_memState.rows&&_memState.rows.length)?150:400);}   /* [260907] 서버 검색은 타자 멈춘 뒤 400ms */