# -*- coding: utf-8 -*-
# tools/memlazy_260907.py — [260907 회원 지연 로딩 + 부팅 낭비 제거] 본체·외부 스크립트 패치
#   고치는 파일 3개: public/standalone.html · public/ym-ticketlink-ui.js · public/ym-member-sync-ui.js
#   무엇: (1) 부팅·호버 때 회원 명단(member-rows 15MB)·예매집계(booking_agg.json 4MB) 선로딩 끔
#         (2) members.js(6.7MB) 부팅 로드 제거 → 오프라인 폴백·서버 검색 실패 폴백이 실제로 필요할 때만 한 번 로드
#         (3) 고객 관리 집계(도넛)는 서버 집계 API(summary=1)만 사용, 명단 안 받음
#         (4) 명부 검색 = 서버 검색(/api/ym/ticketlink/member-search) 결과만 표시 · 회원 상세 예매 = 서버 한 명 조회(member-booking)
#         (5) sw.js 등록(파일 없음) 제거
#         (6) ym-ticketlink-ui.js 첫 상태 조회가 시트 4개(7MB)를 다시 받던 것 제거 · ym-member-sync-ui.js 갱신 완료 뒤 명단 15MB 재수신 제거
#   되돌리기: backups/standalone-260907-memlazy-전.html · backups/ym-ticketlink-ui-260907-memlazy-전.js · backups/ym-member-sync-ui-260907-memlazy-전.js 를 제자리에 복사
#   실행: python3 tools/memlazy_260907.py   (전부 적용된 상태에서 다시 실행하면 NOTHING TO DO. 일부만 되돌린 상태는 지원하지 않음 — 백업으로 완전 복원 뒤 실행)
#   검증·백업·쓰기 순서: 모든 치환·검증이 끝난 뒤에만 파일 3개를 한꺼번에 쓴다(중간 실패 시 아무 파일도 안 바뀜).
import io, os, sys, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'standalone.html')
TL = os.path.join(ROOT, 'public', 'ym-ticketlink-ui.js')
MS = os.path.join(ROOT, 'public', 'ym-member-sync-ui.js')
BAK_DIR = os.path.join(ROOT, 'backups')
BAK = os.path.join(BAK_DIR, 'standalone-260907-memlazy-전.html')
TL_BAK = os.path.join(BAK_DIR, 'ym-ticketlink-ui-260907-memlazy-전.js')
MS_BAK = os.path.join(BAK_DIR, 'ym-member-sync-ui-260907-memlazy-전.js')

def read(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def write(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def fail(msg):
    print('FAIL ' + msg)
    sys.exit(1)

def fn_body(text, head):
    """function 머리(head)부터 짝이 맞는 } 까지 원문. head 는 정확히 1번 있어야 한다."""
    n = text.count(head)
    if n != 1:
        fail('fn_body %r count=%d (expected 1)' % (head, n))
    i = text.find(head)
    j = text.find('{', i)
    depth = 0
    k = j
    while k < len(text):
        c = text[k]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return text[i:k + 1]
        k += 1
    fail('fn_body %r unbalanced' % head)

html = read(SRC)
tl = read(TL)
ms = read(MS)
orig_len = len(html)
if '\r\n' in html or '\r\n' in tl or '\r\n' in ms:
    fail('CRLF 파일 — 이 스크립트는 LF 파일만 다룬다')
applied = []
skipped = []
ALREADY = 'function _memRenderTable(shown){' in html

def rep(name, old, new, marker=None):
    """old 가 정확히 1번 있어야 치환. marker(새 코드의 표식)가 이미 있으면 건너뜀."""
    global html
    if marker and marker in html:
        skipped.append(name)
        return
    n = html.count(old)
    if n != 1:
        fail('%s: anchor count=%d (expected 1)' % (name, n))
    html = html.replace(old, new, 1)
    applied.append(name)

# 새로 만드는 이름이 이미 본체에 있으면 조용히 덮어써지므로 먼저 막는다
if not ALREADY:
    for sym in ['_memRenderTable', '_memSearch', '_memBookingOf', '_memBookingRow', '_memSearchState', '_memSearchSeq', '_memLocalP', '__loadMembersJs']:
        if sym in html:
            fail('name collision: %s already in standalone.html' % sym)

# ── (2) members.js 지연 ────────────────────────────────────────────
old = """var _memberReady=Promise.resolve();
  try{
    _memberReady=new Promise(function(resolve){
    var memberScript=document.createElement('script');
    memberScript.src='./members.js';
    memberScript.async=true;
    memberScript.onload=function(){
      try{ if(window.__MEMBERS__) DB.datasets['ops_회원']=window.__MEMBERS__; }
      catch(e){ console.error('[MISO] 회원 데이터 주입 실패',e); }
      resolve();
    };
    memberScript.onerror=function(){ resolve(); };
    document.head.appendChild(memberScript);
    });
  }catch(e){ console.error('[MISO] 회원 데이터 로드 실패',e); }
  window.__MEMBER_READY__=_memberReady;"""
new = """var _memberReady=null;   /* [260907 회원 지연] members.js(6.7MB)는 부팅 때 안 받는다 — 회원 시트 오프라인 폴백(offlineReady)·서버 검색 폴백(_memSearchLocal)이 실제로 필요할 때 처음 한 번만 받는다 */
  window.__loadMembersJs=function(){
    if(_memberReady)return _memberReady;
    _memberReady=new Promise(function(resolve){
      try{
        var memberScript=document.createElement('script');
        memberScript.src='./members.js';
        memberScript.async=true;
        memberScript.onload=function(){
          try{ if(window.__MEMBERS__) DB.datasets['ops_회원']=window.__MEMBERS__; }
          catch(e){ console.error('[MISO] 회원 데이터 주입 실패',e); }
          resolve();
        };
        memberScript.onerror=function(){ resolve(); };
        document.head.appendChild(memberScript);
      }catch(e){ console.error('[MISO] 회원 데이터 로드 실패',e); resolve(); }
    });
    return _memberReady;
  };
  window.__MEMBER_READY__=null;   /* 값 읽기만으로 6.7MB 가 시작되지 않게 — 필요한 곳(offlineReady)이 __loadMembersJs() 를 직접 부른다 */"""
rep('members.js lazy', old, new, marker='window.__loadMembersJs=function(){')

old = """       if(method==='GET'&&x.pathname==='/api/ops'&&x.searchParams.get('sheet')==='회원'&&!ds('ops_회원'))return (window.__MEMBER_READY__||Promise.resolve()).then(function(){return offline(u,method);});"""
new = """       if(method==='GET'&&x.pathname==='/api/ops'&&x.searchParams.get('sheet')==='회원'&&x.searchParams.get('summary')!=='1'&&!ds('ops_회원'))return (typeof window.__loadMembersJs==='function'?window.__loadMembersJs():Promise.resolve()).then(function(){return offline(u,method);});   /* [260907 회원 지연] 집계(summary=1)는 명단이 필요 없다 · 명단은 이때 처음 받는다 */"""
rep('offlineReady loadMembersJs', old, new, marker="x.searchParams.get('summary')!=='1'&&!ds('ops_회원')")

# ── (1) 부팅·호버 선로딩 끔 ───────────────────────────────────────
old = """function _memBootWarm(){
  if(typeof userRole==='undefined'||userRole!=='admin')return;"""
new = """function _memBootWarm(){
  if(window._MEM_BOOT_WARM!==true)return;   /* [260907 회원 지연] 부팅 선로딩 끔 — 회원 집계·명단·예매집계는 고객 관리에서 열고·검색하고·상세를 부를 때만 받는다(사용자 260907 「호출할 때만」). window._MEM_BOOT_WARM=true 는 예열(집계 1건 + 예매집계 4MB)만 되살린다 — 옛 명단 15MB 선로딩은 _memLoadSummary 가 바뀌어 돌아오지 않는다. 완전 되돌리기 = backups/standalone-260907-memlazy-전.html */
  if(typeof userRole==='undefined'||userRole!=='admin')return;"""
rep('_memBootWarm off', old, new, marker='[260907 회원 지연] 부팅 선로딩 끔')

old = """function _memWarm(){ if(userRole!=='admin')return; try{_bkWarm();}catch(e){}"""
new = """function _memWarm(){ if(window._MEM_BOOT_WARM!==true)return;   /* [260907 회원 지연] 호버 선로딩도 끔 */ if(userRole!=='admin')return; try{_bkWarm();}catch(e){}"""
rep('_memWarm off', old, new, marker='[260907 회원 지연] 호버 선로딩도 끔')

# ── (3) 집계는 서버 집계 API 만 ───────────────────────────────────
old = """async function _memLoadSummary(force){
if(window.ymMemberSyncReady&&await window.ymMemberSyncReady()){await _memLoad(force);return null;}

if(window.__MEMBERS__&&window.__MEMBERS__.rows&&window.__MEMBERS__.rows.length){ // [WA30b-v1] 내장 회원 우선 — 집계 API 생략, 렌더러가 rows에서 직접 계산
  if(!_memState||!_memState.rows||!_memState.rows.length)_memState={headers:window.__MEMBERS__.headers,rows:window.__MEMBERS__.rows,note:'내장 members.js'};
  return null;
}
  if(_memSummaryLoading)return _memSummaryP||Promise.resolve(_memSummary);"""
new = """async function _memLoadSummary(force){
  /* [260907 회원 지연] 집계(거주지·연령 도넛)는 항상 서버 집계 API(/api/ops?sheet=회원&summary=1, 서버가 스냅샷으로 답함)만 쓴다.
     구판: 회원 갱신 이력이 있으면 명단 전체(member-rows 15MB)를 받아 화면에서 세었다 → 부팅·화면 열기마다 15MB. 명단은 분류·예울이가 필요할 때만 _memLoad 로. */
  if(_memSummaryLoading)return _memSummaryP||Promise.resolve(_memSummary);"""
rep('_memLoadSummary summary-only', old, new, marker='[260907 회원 지연] 집계(거주지·연령 도넛)')

old = """      var _wa9Timeout=new Promise(function(_,reject){setTimeout(function(){reject(new Error('회원 API 응답 시간 초과(12초)'));},12000);});"""
new = """      var _wa9Timeout=new Promise(function(_,reject){setTimeout(function(){reject(new Error('회원 API 응답 시간 초과(30초)'));},30000);});   /* [260907] 첫 집계는 서버가 3만 행을 한 번 세므로 30초까지 기다린다(이후는 스냅샷) */"""
rep('summary timeout 30s', old, new, marker='회원 API 응답 시간 초과(30초)')

# ── 고객 관리 허브: 열 때 명단·예매장부 안 받음, 집계 실패했으면 다시 열 때 재시도 ─────
hub_fill = fn_body(html, 'function _memberHubFill(){')
old = """  try{ _bkLoad(false).catch(function(){}); }catch(_e){}
}"""
if '[260907 회원 지연] 예매집계' in hub_fill:
    skipped.append('_memberHubFill no bkLoad')
else:
    if hub_fill.count(old) != 1:
        fail('_memberHubFill anchor')
    html = html.replace(hub_fill, hub_fill.replace(old, """  /* [260907 회원 지연] 예매집계(booking_agg.json 4MB)는 화면을 연다고 받지 않는다 — 회원 상세·분류·예울이가 필요할 때 _bkLoad */
}""", 1), 1)
    applied.append('_memberHubFill no bkLoad')

open_hub = fn_body(html, 'function openMemberHub(tab){')
old = """  if(!window._memberHubFilled){ window._memberHubFilled=1; _memberHubFill(); }"""
new = """  if(!window._memberHubFilled||!_memSummary){ window._memberHubFilled=1; _memberHubFill(); }   /* [260907] 집계가 실패했으면(타임아웃·세션) 다시 열 때 한 번 더 받는다 */"""
if '[260907] 집계가 실패했으면' in open_hub:
    skipped.append('openMemberHub refill')
else:
    if open_hub.count(old) != 1:
        fail('openMemberHub refill anchor')
    html = html.replace(open_hub, open_hub.replace(old, new, 1), 1)
    applied.append('openMemberHub refill')

old = """  if(tab==='seg'||tab==='lookup'){ try{ if(!_memState){ var mp=_memLoad(false); if(mp&&mp.catch)mp.catch(function(){}); } }catch(_e){} }   /* 검색으로 들어오면 명부 선적재(옛 openCustomerSegment 와 동일) */"""
new = """  /* [260907 회원 지연] 명부 선적재 없음 — 검색은 서버 검색(_memSearch)으로 결과만, 분류·예울이는 실행할 때 _memLoad */"""
rep('openMemberHub no preload', old, new, marker='[260907 회원 지연] 명부 선적재 없음')

old = """  if(t==='lookup'){ try{ if(!_memState){ var p=_memLoad(false); if(p&&p.catch)p.catch(function(){}); } else { _memRender(); } }catch(_e){} var q=document.getElementById('mem-q'); if(q)try{q.focus();}catch(_e2){} }"""
new = """  if(t==='lookup'){ try{ _memRender(); }catch(_e){} var q=document.getElementById('mem-q'); if(q)try{q.focus();}catch(_e2){} }   /* [260907 회원 지연] 명부 탭 = 검색창만, 명단 선적재 없음(같은 검색어면 서버를 다시 안 부른다) */"""
rep('_memberHubTab lookup', old, new, marker='[260907 회원 지연] 명부 탭 = 검색창만')

# ── 분류·예울이가 명단을 받는 동안 명부 검색 결과를 지우지 않는다 ─────
old = """  if(sub)sub.textContent='불러오는 중… (첫 로드는 수 초 걸릴 수 있어요)';
  if(body)body.innerHTML='';
  if(rf){rf.disabled=true;rf.style.opacity='.5';}"""
new = """  var _keep=!!(_memSearchState&&_memSearchState.rows&&_memSearchState.rows.length);   /* [260907 회원 지연] 분류·예울이가 명단을 받는 동안 명부 서버 검색 결과는 그대로 둔다 */
  if(sub&&!_keep)sub.textContent='불러오는 중… (첫 로드는 수 초 걸릴 수 있어요)';
  if(body&&!_keep)body.innerHTML='';
  if(rf){rf.disabled=true;rf.style.opacity='.5';}"""
rep('_memLoadCore keep', old, new, marker='[260907 회원 지연] 분류·예울이가 명단을 받는 동안')

# ── (4) 명부 검색 = 서버 검색 ─────────────────────────────────────
if not ALREADY:
    mem_render = fn_body(html, 'function _memRender(){')
    A1 = "  var qd=q.replace(/\\D/g,'');"
    A2 = "  var th='padding:7px 10px;"
    for a in [A1, A2, 'var LIM=200,shown=rows.slice(0,LIM);', "body.innerHTML='<table"]:
        if mem_render.count(a) != 1:
            fail('_memRender inner anchor %r count=%d' % (a, mem_render.count(a)))
    old_filter = mem_render[mem_render.index(A1):mem_render.index(A2)]   # rows 필터 + sub 문구
    old_table = mem_render[mem_render.index(A2):-1]                       # 표 HTML (마지막 } 제외)
    if not old_table.rstrip().endswith("결과가 없어요</div>');"):
        fail('_memRender table tail: %r' % old_table[-60:])
    old_filter = old_filter.replace("  var f1='',f2='',f3='',_hf=(window._memHubFilter||null); if(_hf&&_hf.sido)f1=_hf.sido;", "  var f1='',f2='',f3=''; if(_hf&&_hf.sido)f1=_hf.sido;", 1)
    if "var f1='',f2='',f3=''; if(_hf&&_hf.sido)f1=_hf.sido;" not in old_filter:
        fail('_memRender filter _hf line')
    new_render = """var _memSearchState=null,_memSearchSeq=0,_memLocalP=null;   /* [260907 회원 지연] 서버 검색 결과(명단 통째 없음) — {key,q,rows,total,approx,sub,ts} */
function _memRenderTable(shown){   /* 표 그리기 — 명단 필터·서버 검색 둘 다 이 표를 쓴다(구 _memRender 표 부분 그대로) */
  var body=document.getElementById('mem-body'); if(!body)return;
""" + old_table + """
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
    var _key=q+'\\u0001'+(((_hf&&_hf.ages)||[]).join(','))+'\\u0001'+((_hf&&_hf.city)||'')+'\\u0001'+((_hf&&_hf.sido)||'');
    if(_memSearchState&&_memSearchState.key===_key){ if(sub)sub.textContent=_memSearchState.sub||''; _memRenderTable(_memSearchState.rows); return; }   /* 마스킹 토글·탭 전환·다시 열기 = 서버 재호출 없음 */
    var _qd0=q.replace(/\\D/g,''),_num0=!!q&&_qd0.length>=3&&_qd0===q.replace(/[\\s\\-().+]/g,'');
    if(q&&!_hfOn&&(_num0?_qd0.length<4:q.replace(/[%_]/g,'').length<2)){ _memSearchSeq++; body.innerHTML=''; if(sub)sub.textContent=_num0?'번호는 네 자리 이상 입력하면 검색해요':'두 글자 이상 입력하면 검색해요'; return; }
    _memSearch(q,_hf,_key); return;
  }
  _memSearchSeq++;   /* 명단이 메모리에 있으면(분류·예울이가 받은 뒤) 진행 중 서버 검색은 버리고 화면 필터 */
""" + old_filter + """  _memRenderTable(shown);
}"""
    html = html.replace(mem_render, new_render, 1)
    applied.append('_memRender server search')
else:
    skipped.append('_memRender server search')

old = """function _memRenderDeb(){clearTimeout(_memDebT);_memDebT=setTimeout(_memRender,150);}"""
new = """function _memRenderDeb(){clearTimeout(_memDebT);_memDebT=setTimeout(_memRender,(_memState&&_memState.rows&&_memState.rows.length)?150:400);}   /* [260907] 서버 검색은 타자 멈춘 뒤 400ms */"""
rep('_memRenderDeb', old, new, marker='서버 검색은 타자 멈춘 뒤 400ms')

# ── 회원 상세: 검색 결과에서 찾고, 예매 요약은 서버 한 명 조회 ────────
old = """    var r=((_memState||{}).rows||[]).find(function(x){return String(x['휴대폰정규화']||x['휴대폰번호']||'').replace(/\\D/g,'')===ph;});
    if(!r)return;
    var old=document.getElementById('mem-detail');if(old)old.remove();"""
new = """    var _src=((_memState&&_memState.rows)||[]).concat((_memSearchState&&_memSearchState.rows)||[]);   /* [260907 회원 지연] 검색 결과에서도 찾는다 */
    var r=_src.find(function(x){return String(x['휴대폰정규화']||x['휴대폰번호']||'').replace(/\\D/g,'')===ph;});
    if(!r)return;
    var old=document.getElementById('mem-detail');if(old)old.remove();"""
rep('_memDetail source', old, new, marker='[260907 회원 지연] 검색 결과에서도 찾는다')

old = """    var bk=null; try{ await _bkLoad(false); bk=(_bkState&&_bkState.by)?(_bkState.by[ph]||null):null; }catch(_e){}"""
new = """    var bk=null; try{ bk=await _memBookingOf(ph); }catch(_e){}   /* [260907 회원 지연] 이 회원 한 명의 예매 요약만 서버에서(장부 4MB 통째 없음) · 서버가 파일을 못 읽거나 경로가 없으면 종전 _bkLoad 폴백 */"""
rep('_memDetail booking', old, new, marker='이 회원 한 명의 예매 요약만 서버에서')

old = """async function _memDetail(ph){"""
new = """function _memBookingRow(r){   /* [260907] 예매집계 행 하나 → _bkFetch 와 같은 모양 {n,tix,amt,first,last,d} */
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
async function _memDetail(ph){"""
rep('_memBookingOf', old, new, marker='async function _memBookingOf(ph){')

old = """_memEpoch++;_memAiHist=[];"""
new = """_memSearchState=null;_memSearchSeq++;_memLocalP=null;clearTimeout(_memDebT);_memDebT=null;window._memHubFilter=null;try{var _q0=document.getElementById('mem-q');if(_q0)_q0.value='';var _b0=document.getElementById('mem-body');if(_b0){_b0.innerHTML='';_b0.style.display='none';}var _d0=document.getElementById('mem-detail');if(_d0)_d0.remove();}catch(_ep0){}_memEpoch++;_memAiHist=[];"""
rep('_memPurge search state', old, new, marker='_memSearchState=null;_memSearchSeq++;_memLocalP=null;')

# ── sw.js 등록 제거(파일 없음 → 매번 콘솔 에러) ─────────────────────
old = """<script>
if('serviceWorker' in navigator){
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'}).catch(function(){});
  });
}
</script>"""
new = """<!-- [260907] sw.js 등록 제거 — 파일이 없어 매 부팅 'unsupported MIME type' 에러만 남기던 죽은 코드 -->"""
rep('sw.js register', old, new, marker='[260907] sw.js 등록 제거')

# ── 부팅 8초 뒤 시트 전체 재수신 원인 제거: ym-ticketlink-ui.js 첫 상태 조회가 "새 배치"로 오인해 refreshViews() ──
tl_old = """if(state.lastBatchId&&seenBatch!==state.lastBatchId){seenBatch=state.lastBatchId;refreshViews();}"""
tl_new = """if(state.lastBatchId&&seenBatch!==state.lastBatchId){var firstPoll=(seenBatch==='');seenBatch=state.lastBatchId;if(!firstPoll)refreshViews();}   /* [260907] 첫 상태 조회는 기준선만 잡는다 — 부팅 직후 시트 4개(일일실적 3.6MB 등 7MB)를 한 번 더 받던 원인 */"""
tl_marker = '[260907] 첫 상태 조회는 기준선만 잡는다'
tl_out = None
if tl_marker in tl:
    skipped.append('ticketlink-ui firstPoll')
else:
    if tl.count(tl_old) != 1:
        fail('ticketlink-ui anchor count=%d' % tl.count(tl_old))
    if tl.count('seenBatch=') != 2:   # 선언 1 + poll 1
        fail('ticketlink-ui seenBatch assignments=%d (expected 2)' % tl.count('seenBatch='))
    tl_out = tl.replace(tl_old, tl_new, 1)
    applied.append('ticketlink-ui firstPoll')
rep('ticketlink-ui script tag v3', """<script src="ym-ticketlink-ui.js?v=2"></script>""", """<script src="ym-ticketlink-ui.js?v=3"></script>""", marker='ym-ticketlink-ui.js?v=3')

# ── 회원 갱신 완료 뒤 refreshMembers 가 명단 15MB 를 다시 받던 것 제거(집계만 새로, 검색 결과는 비움) ──
ms_old = """if(typeof _memLoad==='function')await _memLoad(true);if(typeof _memberHubFill==='function')_memberHubFill();"""
ms_new = """if(typeof _memSearchState!=='undefined')_memSearchState=null;if(typeof _memberHubFill==='function')_memberHubFill();if(typeof _memRender==='function')try{_memRender();}catch(_er){}   /* [260907 회원 지연] 갱신 뒤 명단 15MB 재수신 없음 — 집계는 _memberHubFill 이 새로 받고, 검색은 다음 입력 때 서버에서 */"""
ms_marker = '[260907 회원 지연] 갱신 뒤 명단 15MB 재수신 없음'
ms_out = None
if ms_marker in ms:
    skipped.append('member-sync-ui no reload')
else:
    if ms.count(ms_old) != 1:
        fail('member-sync-ui anchor count=%d' % ms.count(ms_old))
    ms_out = ms.replace(ms_old, ms_new, 1)
    applied.append('member-sync-ui no reload')
rep('member-sync-ui script tag v2', """<script src="ym-member-sync-ui.js?v=1"></script>""", """<script src="ym-member-sync-ui.js?v=2"></script>""", marker='ym-member-sync-ui.js?v=2')

# ── 검증(쓰기 전) ───────────────────────────────────────────────
if not applied:
    print('NOTHING TO DO (already applied): skipped=%s' % ','.join(skipped))
    sys.exit(0)
MUST1 = ['window.__loadMembersJs=function(){', "x.searchParams.get('summary')!=='1'&&!ds('ops_회원')", '[260907 회원 지연] 부팅 선로딩 끔', '[260907 회원 지연] 호버 선로딩도 끔',
         '[260907 회원 지연] 집계(거주지·연령 도넛)', '회원 API 응답 시간 초과(30초)', '[260907 회원 지연] 예매집계', '[260907] 집계가 실패했으면', '[260907 회원 지연] 명부 선적재 없음',
         '[260907 회원 지연] 명부 탭 = 검색창만', '[260907 회원 지연] 분류·예울이가 명단을 받는 동안', 'function _memRenderTable(shown){', 'function _memSearchLocal(reason){', 'function _memSearch(q,hf,key){',
         'function _memRender(){', '서버 검색은 타자 멈춘 뒤 400ms', '[260907 회원 지연] 검색 결과에서도 찾는다', '이 회원 한 명의 예매 요약만 서버에서', 'async function _memBookingOf(ph){',
         '_memSearchState=null;_memSearchSeq++;_memLocalP=null;', '[260907] sw.js 등록 제거', 'ym-ticketlink-ui.js?v=3', 'ym-member-sync-ui.js?v=2']
GONE = ['await window.ymMemberSyncReady()){await _memLoad(force);return null;}', "navigator.serviceWorker.register('sw.js'", 'ym-ticketlink-ui.js?v=2', 'ym-member-sync-ui.js?v=1',
        '회원 API 응답 시간 초과(12초)', '명부 선적재(옛 openCustomerSegment', '[WA30b-v1]', "window.__MEMBER_READY__=_memberReady;"]
bad = 0
for m in MUST1:
    c = html.count(m)
    if c != 1:
        print('VERIFY FAIL %d %s' % (c, m)); bad += 1
for m in GONE:
    c = html.count(m)
    if c != 0:
        print('VERIFY FAIL(gone) %d %s' % (c, m)); bad += 1
if tl_out is not None and tl_out.count(tl_marker) != 1:
    print('VERIFY FAIL tl'); bad += 1
if ms_out is not None and ms_out.count(ms_marker) != 1:
    print('VERIFY FAIL ms'); bad += 1
if bad:
    fail('verify %d — 아무 파일도 쓰지 않음' % bad)
if abs(len(html) - orig_len) > 20000:
    fail('size delta %d too big — 아무 파일도 쓰지 않음' % (len(html) - orig_len))

# ── 백업 → 쓰기(마지막에 한꺼번에) ─────────────────────────────────
if not os.path.isdir(BAK_DIR):
    os.makedirs(BAK_DIR)
if not os.path.exists(BAK):
    shutil.copyfile(SRC, BAK)
if tl_out is not None and not os.path.exists(TL_BAK):
    shutil.copyfile(TL, TL_BAK)
if ms_out is not None and not os.path.exists(MS_BAK):
    shutil.copyfile(MS, MS_BAK)
write(SRC, html)
if tl_out is not None:
    write(TL, tl_out)
if ms_out is not None:
    write(MS, ms_out)
print('OK applied=%d: %s' % (len(applied), ','.join(applied)))
print('skipped=%s' % ','.join(skipped))
print('size %d -> %d' % (orig_len, len(html)))
print('backup %s' % BAK)
chk = read(SRC)
for m in MUST1:
    print('verify %d %s' % (chk.count(m), m))
print('verify-tl %d %s' % (read(TL).count(tl_marker), tl_marker))
print('verify-ms %d %s' % (read(MS).count(ms_marker), ms_marker))
