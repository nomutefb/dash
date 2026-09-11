/* ═══ [260902 고객 관리 허브] 고객 분석(개요)·고객 조건부 검색·회원 조회·예울이를 모달 하나에 좌우 2단으로 ═══
   - 틀 = 기존 고객 분석 모달(.modal.pb-modal · 96vw · 92vh · .mhead 밴드)과 같은 규격. 새 색·새 부품 0.
   - 좌 = 기존 _memOvRender() 그대로(같은 id #mem-ov-body). 그 안의 예울이 승강 카드(#mem-ai-card-m)만 숨기고 도넛 카드가 그 자리까지 씀.
   - 우상 = 「고객 검색」 카드: 조건부(기존 _segViewHtml · #seg-cond/#seg-result) ↔ 명부(기존 회원 조회 · #mem-sub/#mem-q/#mem-body) — 둘 다 미리 그려 두고 표시만 바꾼다.
   - 우하 = 예울이 카드(기존 _memAiCardHtml, 접미사 'h').
   - 전환 규약(좌측 틀 통일과 동일): DOM 한 번 만들고 숨김/보임만 · 로드 뒤 한가할 때 미리 그려 둠(_memberHubPrewarm) · 탭은 자리 고정 카드 안에서 내용만 교체.
   - 끄기: window._MEMBER_HUB_ON=false → 옛 모달 3개 경로 그대로.
   - [260903 페이지화] 기본 = 모달이 아니라 사업현황·판매현황처럼 **메인 화면(#mem-main, _mainView='mem')** 에 그린다. 틀 = 사업현황 좌측 유리 헤더+유리 박스와 같은 인라인 스타일.
     window._MEMBER_HUB_PAGE=false 면 종전 모달 틀. 본체 쪽 연결 = _mvApply(mem-mode 클래스)·_mvSlideLeft·_mvSync·_panelSticky·_bizZoomTarget·buildNav 의 [260903 허브 페이지] 주석 줄. */
var _hubEscH=null;
function _memberHubIsPage(){ return window._MEMBER_HUB_PAGE!==false && !!document.getElementById('mem-main'); }
function _memberHubCss(){
  if(document.getElementById('member-hub-css'))return;
  var st=document.createElement('style'); st.id='member-hub-css';
  st.textContent=
     '#member-hub .modal{width:96vw;max-width:1800px;height:92vh;max-height:92vh;overflow:hidden;--mpad-y:0;--mpad-x:0;position:relative;display:flex;flex-direction:column}'
    +'#hub-body{flex:1 1 auto;min-height:0;display:flex;gap:24px;padding:25px 29px;text-align:left;color:var(--text)}'
    +'#hub-left{flex:0 0 58%;min-width:0;display:flex;flex-direction:column;min-height:0}'
    +'#hub-right{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;min-height:0;gap:14px}'
    +'#member-hub #mem-ov-body{flex:1 1 auto;min-height:0;overflow:auto;padding:0}'
    +'#member-hub #mem-ai-card-m{display:none!important}'                                  /* 좌측 안 예울이 승강 카드 = 우하 카드로 이동 */
    +'#member-hub .cb-rise-col{padding-bottom:0!important}'                                 /* 승강 카드 몫으로 비워 두던 아래 여백 회수 → 도넛 카드가 끝까지 */
    +'#member-hub svg[aria-label$="도넛 차트"]{max-height:240px!important}'                 /* 도넛 폭맞춤(운영자 260902) — 기존 149 상한만 완화 */
    +'#hub-search{flex:0 0 55%;min-height:0;background:var(--surface-solid);border:1px solid var(--border);border-radius:var(--radius);padding:13px 17px;display:flex;flex-direction:column;overflow:hidden}'
    +'#hub-search .hub-pane{flex:1 1 auto;min-height:0;overflow:auto;display:flex;flex-direction:column}'
    +'#member-hub #seg-cond > *{flex:0 0 auto;white-space:nowrap}'                       /* 좁은 우측 칸에서 조건 낱말이 글자 단위로 꺾이던 것 → 한 줄(가로 스크롤은 원래 있음) */
    +'#member-hub #seg-result .bizm-card{margin-bottom:0}'
    +'#member-hub #mem-body{height:auto!important;max-height:none!important;flex:1 1 auto;min-height:0}'
    +'#hub-chat{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}'
    +'#hub-chat > div{flex:1 1 auto!important;min-height:0;width:100%!important;margin-top:0!important}'
    +'#hub-chat #mem-ai-log-h{flex:1 1 auto!important;min-height:0;height:auto!important}'
    +'@media (max-width:1100px){#hub-body{flex-direction:column;overflow:auto}#hub-left,#hub-right,#hub-search{flex:0 0 auto}#hub-search{min-height:360px}#hub-chat{min-height:320px}}'
    /* [260903 페이지화] 메인 화면 모드 — 사업현황(#app.biz-mode)과 같은 문법으로 캘린더 부품을 숨기고 #mem-main 만 보인다 */
    +'#mem-main{display:none}'
    +'#app.mem-mode #mem-main{display:flex;flex-direction:column;position:relative}'
    +'#app.mem-mode #chips,#app.mem-mode #cal-head-wrap,#app.mem-mode #cal,#app.mem-mode .cal-arrow,#app.mem-mode .pet,#app.mem-mode .crablane{display:none!important}'
    +'#app.mem-mode .nav-mnav{opacity:.82;pointer-events:none}'
    +'#app.mem-mode #main-area{min-width:0}'
    +'#member-hub.mem-page{display:flex;flex-direction:column;flex:1 1 auto;min-height:0}'
    +'#member-hub.mem-page [data-memhead]{display:flex;align-items:center;gap:10px;min-height:47px;padding:1px 18px 0;background:rgba(255,255,255,.9);backdrop-filter:blur(11px);-webkit-backdrop-filter:blur(11px);border:1px solid var(--glass-border);border-bottom:1px solid var(--line);border-radius:var(--radius-lg) var(--radius-lg) 0 0;box-shadow:inset 0 1px 0 rgba(255,255,255,.6);overflow:hidden;flex:0 0 auto}'
    +'#member-hub.mem-page [data-membox]{position:relative;box-sizing:border-box;flex:1 1 auto;min-height:0;overflow:hidden;background:rgba(255,255,255,.15);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);border:1px solid rgba(255,255,255,.7);border-top:0;border-radius:0 0 var(--radius-lg) var(--radius-lg);box-shadow:var(--glass-shadow);padding:18px;display:flex;flex-direction:column}'
    +'#member-hub.mem-page #hub-body{padding:0;flex:1 1 auto;min-height:0}'
    /* [260903 운영자 「줄간격·여백 활용」→「글자 1.5배·간격 확보」→「범례를 우측 여백 쪽으로」→「범례 높이 = 도넛의 8.5~9」]
       도넛 옆 범례 — 한 열, 크기는 카드 폭(cqw)에 비례해 잘림 없이. 도넛 = 40cqw(상한 260) · 범례 행 = 5.8cqw(6행 = 도넛 높이의 0.87) ·
       글자 이름 2.8cqw(상한 18.5)/값 2.7cqw(상한 17.5) · 도넛과 범례를 space-evenly 로 벌려 오른쪽 빈 여백 해소.
       실측 카드 458px(1920 창): 도넛 183 · 행 26.5 · 글자 12.8/12.4 · 잘림 0 | 카드 640px(운영자 화면): 도넛 256 · 행 37 · 글자 18/17.4. 원래 = 11~21px 행·2열·12/11px. */
    +'#member-hub .cb-rise-col > div{container-type:inline-size}'
    +'#member-hub svg[aria-label$="도넛 차트"]{height:auto!important;max-height:none!important;width:min(260px,40cqw)!important;aspect-ratio:1}'
    +'#member-hub .cb-rise-col div:has(> svg[aria-label$="도넛 차트"]){justify-content:space-evenly!important;gap:clamp(12px,3cqw,28px)!important}'
    +'#member-hub .cb-rise-col svg + div{flex:0 1 auto!important;width:clamp(200px,52cqw,360px)!important;grid-template-columns:1fr!important;grid-auto-rows:clamp(22px,5.8cqw,38px)!important;column-gap:0!important;padding-left:clamp(4px,1.5cqw,10px)}'
    +'#member-hub .cb-rise-col svg + div > div{gap:clamp(8px,1.9cqw,12px)!important}'
    +'#member-hub .cb-rise-col svg + div > div > span:first-child{width:clamp(10px,2cqw,13px)!important;height:clamp(10px,2cqw,13px)!important;border-radius:4px!important}'
    +'#member-hub .cb-rise-col svg + div > div > span:nth-child(2){flex-basis:clamp(80px,18cqw,120px)!important;font-size:clamp(12.5px,2.8cqw,18.5px)!important;letter-spacing:.01em}'
    +'#member-hub .cb-rise-col svg + div > div > span:nth-child(3){font-size:clamp(12px,2.7cqw,17.5px)!important;letter-spacing:.02em}';
  document.head.appendChild(st);
}
function _memberHubBuild(){
  var bg=document.getElementById('member-hub'); if(bg)return bg;
  _memberHubCss();
  /* 같은 id를 쓰는 옛 모달 잔재 정리(getElementById 충돌 방지) */
  try{ var lg=document.getElementById('member-lookup'); if(lg)lg.remove(); }catch(_e){}
  try{ var ov=document.getElementById('member-ov'); if(ov)ov.remove(); }catch(_e){}
  try{ if(typeof closePromoCheck==='function')closePromoCheck(); }catch(_e){}
  var page=_memberHubIsPage();
  bg=document.createElement('div'); bg.id='member-hub';
  if(page){ bg.className='mem-page'; }
  else { bg.className='modal-bg'; bg.style.zIndex='var(--z-modal)'; bg.onclick=function(ev){ if(ev.target===bg)closeMemberHub(); }; }
  var inputCss='flex:1;width:100%;box-sizing:border-box;min-width:180px;padding:9px 12px;border:1px solid var(--border2);border-radius:var(--r-btn);font-size:13px;font-family:inherit;background:var(--surface-solid);color:var(--text)';
  /* 페이지 = 사업현황 좌측과 같은 유리 헤더([data-bizmhead] 문법) + 유리 박스([data-bizmbox] 문법) · 모달 = 종전 .modal.pb-modal + .mhead */
  var openTag=page
    ?('<div data-memhead><span style="font-size:14.5px;font-weight:800;color:var(--accent);white-space:nowrap;letter-spacing:-.01em;flex-shrink:0">고객 관리</span>'
      +'<span style="font-size:12px;font-weight:600;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">회원 명부를 지역·연령으로 훑어보고, 오른쪽에서 찾고 물어봐요</span></div>'
      +'<div data-membox>')
    :('<div class="modal pb-modal">'
      +'<button class="modal-x" onclick="closeMemberHub()" title="닫기" aria-label="닫기">✕</button>'
      +_mhead('고객 관리','회원 명부를 지역·연령으로 훑어보고, 오른쪽에서 찾고 물어봐요'));
  bg.innerHTML=openTag
    +'<div id="hub-body">'
      +'<div id="hub-left"><div id="mem-ov-body" style="text-align:center;color:var(--dim);padding:25px 29px">'+_ldHtml(16)+'회원 데이터 불러오는 중…</div></div>'
      +'<div id="hub-right">'
        +'<div id="hub-search">'
          +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;flex:0 0 auto"><span style="font-size:14px;font-weight:800">고객 검색</span>'
            +'<span style="display:inline-flex;gap:6px;align-items:center" role="radiogroup" aria-label="검색 방식">'
            +'<button type="button" class="ry-live-tg" role="radio" aria-checked="true" data-hubtab="seg" onclick="_memberHubTab(\'seg\')">조건부</button><span class="ry-hd-div" aria-hidden="true"></span>'
            +'<button type="button" class="ry-live-tg" role="radio" aria-checked="false" data-hubtab="lookup" onclick="_memberHubTab(\'lookup\')">명부</button></span>'
            +'<span id="hub-search-note" style="margin-left:auto;font-size:11px;color:var(--dim);white-space:nowrap"></span></div>'
          +'<div id="hub-pane-seg" class="hub-pane">'+_segViewHtml()+'</div>'
          +'<div id="hub-pane-lookup" class="hub-pane" style="display:none">'
            +'<div id="mem-sub" style="font-size:11.5px;color:var(--dim);margin-bottom:10px;flex:0 0 auto">불러오는 중…</div>'
            +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center;flex:0 0 auto">'
            +'<input id="mem-q" placeholder="이름 · 휴대폰 · 주소 검색" oninput="_memRenderDeb()" onsearch="_memRenderDeb()" style="'+inputCss+'">'
            +'<label style="display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--muted);cursor:pointer;white-space:nowrap"><input id="mem-mask" type="checkbox" checked onchange="_memRender()" style="accent-color:var(--accent);width:14px;height:14px;margin:0">마스킹</label>'
            +'</div>'
            +'<div id="mem-body" style="display:none;overflow:auto;border:1px solid var(--border);border-radius:var(--r-btn)"></div>'
          +'</div>'
        +'</div>'
        +'<div id="hub-chat">'+_memAiCardHtml('h',true,false)+'</div>'
      +'</div>'
    +'</div></div>';
  if(page){ document.getElementById('mem-main').appendChild(bg); }
  else { document.body.appendChild(bg); }
  try{ _memAiPaint('h'); }catch(_e){}
  return bg;
}
function _memberHubTab(t){
  t=(t==='lookup')?'lookup':'seg';
  var a=document.getElementById('hub-pane-seg'), b=document.getElementById('hub-pane-lookup');
  if(a)a.style.display=(t==='seg')?'':'none'; if(b)b.style.display=(t==='lookup')?'':'none';
  document.querySelectorAll('#hub-search [data-hubtab]').forEach(function(x){ var on=(x.getAttribute('data-hubtab')===t); x.setAttribute('aria-checked',on?'true':'false'); x.style.color=on?'var(--accent)':'var(--muted)'; });
  if(t==='lookup'){ try{ if(!_memState){ var p=_memLoad(false); if(p&&p.catch)p.catch(function(){}); } else { _memRender(); } }catch(_e){} var q=document.getElementById('mem-q'); if(q)try{q.focus();}catch(_e2){} }
}
function _memberHubFill(){
  /* 데이터 채우기 — 이미 있으면 즉시, 없으면 받아서. 화면은 미리 만들어 둔 카드 안에서만 바뀐다. */
  try{ var p=_memLoadSummary(false); (p&&p.then?p:Promise.resolve()).then(function(){ try{_memOvRender();}catch(_e){} try{_memberHubReveal();}catch(_e){} }).catch(function(){ try{_memOvRender();}catch(_e){} }); }catch(_e0){ try{_memOvRender();}catch(_e){} }
  try{ _bkLoad(false).catch(function(){}); }catch(_e){}
}
async function openMemberHub(tab){
  if(userRole!=='admin'){showToast('고객 관리는 관리자 전용이에요','error');return;}
  var bg=_memberHubBuild();
  if(!window._memberHubFilled){ window._memberHubFilled=1; _memberHubFill(); }
  _memberHubTab(tab==='lookup'?'lookup':'seg');
  if(tab==='seg'||tab==='lookup'){ try{ if(!_memState){ var mp=_memLoad(false); if(mp&&mp.catch)mp.catch(function(){}); } }catch(_e){} }   /* 검색으로 들어오면 명부 선적재(옛 openCustomerSegment 와 동일) */
  if(bg.classList.contains('mem-page')){ var _was=(typeof _mainView!=='undefined'&&_mainView==='mem'); _memPageMeasure(); if(typeof setMainView==='function')setMainView('mem'); _memPageFit(); if(!_was)_memberHubReveal(); return; }   /* 화면에 들어올 때마다 결·카운트(같은 화면 안 탭 전환은 제외) */   /* [260903 페이지화] 화면 전환 = 사업현황·캘린더와 같은 setMainView */
  bg.classList.add('show'); _memberHubReveal();
  if(!_hubEscH){ _hubEscH=function(e){ if(e.key==='Escape'&&!e.defaultPrevented)closeMemberHub(); }; document.addEventListener('keydown',_hubEscH); }
}
function closeMemberHub(){
  var bg=document.getElementById('member-hub');
  if(bg&&bg.classList.contains('mem-page')){ try{ if(typeof _mainView!=='undefined'&&_mainView==='mem'&&typeof setMainView==='function')setMainView('biz'); }catch(_e){} }
  else if(bg)bg.classList.remove('show');
  try{ if(typeof _segModalClose==='function')_segModalClose(); }catch(_e){}
  if(_hubEscH){ document.removeEventListener('keydown',_hubEscH); _hubEscH=null; }
}
function _memberHubShown(){ var bg=document.getElementById('member-hub'); if(!bg)return false; return bg.classList.contains('mem-page')?(typeof _mainView!=='undefined'&&_mainView==='mem'):bg.classList.contains('show'); }
/* 페이지 높이 = 사업현황 좌측 틀(#biz-main)과 같은 높이. 대시보드에서 넘어올 때 그 높이를 재 두고(_memPageH) 그대로 쓴다 —
   두 화면의 헤더·박스 세로변이 같아야 전환 때 어긋남이 없다. 잴 수 없으면(캘린더에서 진입·첫 로드) 같은 규칙으로 계산: (뷰포트−nav 56)÷줌 − 상하 여백 42. */
function _memPageMeasure(){
  try{ var bm=document.getElementById('biz-main'); if(bm&&bm.offsetParent!==null&&bm.offsetHeight>0){ var z=(typeof _bizZ==='function')?(_bizZ()||1):1; window._memPageH=Math.round(bm.getBoundingClientRect().height/z); } }catch(_e){}
}
function _memPageFit(){
  try{
    var el=document.getElementById('mem-main'); if(!el)return;
    var z=1; try{ z=(typeof _bizZ==='function')?(_bizZ()||1):1; }catch(_e){}
    var h=window._memPageH||0;
    if(!h){ h=Math.floor((window.innerHeight-56)/z)-42; }
    if(h<420)h=420;
    el.style.height=h+'px';
  }catch(_e){}
}
(function(){ try{ window.addEventListener('resize',function(){ window._memPageH=0; if(typeof _mainView!=='undefined'&&_mainView==='mem')_memPageFit(); }); }catch(_e){} })();
/* [260903 운영자 「물결치듯 애니메이션 · 숫자 카운트」] 고객 분석 등장 모션 = 앱 공용 부품만 재사용:
   - 결(.rv / _rvOn — 2026 UIUX 표준 55ms 간격·420ms) : 지표 4칸 → 지도 카드 → 도넛 카드 → 범례 줄 하나씩(물결). 순번 상한 8 = 총 0.74s.
   - 숫자 = 연간 실적의 _yrCountUp 과 같은 감속 곡선(1−(1−p)³) — 단위·소수·천단위 쉼표는 지키고 숫자만 올라간다.
     100 미만이면서 % 도 아닌 값(「30대」「40대」 같은 구분 이름)은 세지 않는다. 화면에 들어올 때마다 다시(창 전환 = 사업현황 전환과 같은 결).
   - 접근성: prefers-reduced-motion 이면 둘 다 없음(_rvOff). */
function _memHubRv(el,i){ if(!el||typeof _rvOff!=='function'||_rvOff())return; el.classList.remove('rv'); el.__rv=0; void el.offsetWidth; el.style.setProperty('--rv-i',Math.min(i||0,8)); el.classList.add('rv'); el.__rv=1; }
function _memHubCountUp(el,dur,minV){
  if(!el||typeof _rvOff!=='function'||_rvOff())return;
  /* 값 칸 안에 부연 <span>(「(잠정)」「(3년 대비 90% 수준)」)이 있으면 숫자가 든 첫 글자 노드만 센다 — 마크업 보존 */
  var tgt=el; if(el.nodeType===1&&el.children.length){ tgt=null; for(var ci=0;ci<el.childNodes.length;ci++){ var cn=el.childNodes[ci]; if(cn.nodeType===3&&/\d/.test(cn.nodeValue)){ tgt=cn; break; } } if(!tgt)return; }
  var txt=(el.__cuRaf&&el.__cuText!=null)?el.__cuText:tgt.textContent; el.__cuText=txt; if(minV==null)minV=100;   /* 원문 캐시는 애니메이션 진행 중(재호출)일 때만 — 앱이 값을 제자리에서 바꾸면 새 값을 쓴다 */
  var toks=[],re=/\d[\d,]*(?:\.\d+)?/g,m; while((m=re.exec(txt))){ var raw=m[0],v=parseFloat(raw.replace(/,/g,'')),dec=(raw.split('.')[1]||'').length,pct=txt.charAt(m.index+raw.length)==='%'; if(!(v>=minV||pct))continue; toks.push({s:m.index,e:m.index+raw.length,v:v,dec:dec,comma:raw.indexOf(',')>=0}); }
  if(!toks.length)return;
  dur=dur||900; var t0=performance.now(); if(el.__cuRaf)cancelAnimationFrame(el.__cuRaf);
  function fmt(n,t){ var x=n.toFixed(t.dec); if(t.comma||t.dec===0&&n>=1000){ var p=x.split('.'); p[0]=p[0].replace(/\B(?=(\d{3})+(?!\d))/g,','); x=p.join('.'); } return x; }
  (function step(now){ var p=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-p,3), out='',pos=0; toks.forEach(function(t){ out+=txt.slice(pos,t.s)+fmt(t.v*e,t); pos=t.e; }); out+=txt.slice(pos); tgt.textContent=out; if(p<1)el.__cuRaf=requestAnimationFrame(step); else el.__cuRaf=0; })(t0);
  setTimeout(function(){ if(el.__cuRaf){ cancelAnimationFrame(el.__cuRaf); el.__cuRaf=0; } tgt.textContent=txt; },dur+80);   /* 탭이 가려져 rAF 가 멈춰도 최종값은 반드시 쓴다 */
}
function _memberHubReveal(){
  try{
    var ov=document.getElementById('mem-ov-body'); if(!ov||!_memberHubShown())return;
    var kids=Array.prototype.slice.call(ov.children); var kpiRow=kids[2], sect=kids[kids.length-1]; if(!kpiRow||!sect||kids.length<4)return;
    var i=0;
    Array.prototype.forEach.call(kpiRow.children,function(c){ _memHubRv(c,i++); var v=c.children[1], sub=c.children[2]; _memHubCountUp(v,900); if(sub)_memHubCountUp(sub,900); });
    var map=sect.children[0], donutCol=sect.children[1]; _memHubRv(map,2); if(donutCol)_memHubRv(donutCol,3);
    if(donutCol){ var li=4; donutCol.querySelectorAll('svg + div > div').forEach(function(row){ _memHubRv(row,li++); var val=row.children[2]; if(val)_memHubCountUp(val,900); }); }
  }catch(_e){}
}
/* [260903 운영자 「숫자 카운트를 사업현황·판매현황 지표 띠에도」] 덱 전환·대시보드 진입 때 보이는 면의 지표 띠 값 4칸을 같은 곡선으로.
   호출 = _bizDeckGo(캐시 복원·새로 그림 두 경로)·_mvApply(biz 진입). 예열(_bizDeckPrewarmBusy) 중엔 안 한다. 「18.0건」「9.3억」처럼 100 미만도 센다(minV 0). */
function _bizStripCountUp(){
  try{
    if(window._bizDeckPrewarmBusy)return; if(typeof _mainView!=='undefined'&&_mainView!=='biz')return;
    var main=document.getElementById('biz-main'); if(!main||main.offsetParent===null)return;
    main.querySelectorAll('.bizm-strip .cell .val').forEach(function(v){ if(v.offsetParent===null)return; _memHubCountUp(v,900,0); });
  }catch(_e){}
}
function _memberHubPurge(){
  /* 유휴 잠금·로그아웃(_memPurge)과 같은 위생: 그려진 명단·결과·대화를 지우고 닫는다. 틀은 남긴다(다음 열기 즉시). */
  closeMemberHub();
  ['seg-result','mem-body'].forEach(function(id){ var e=document.getElementById(id); if(e)e.innerHTML=''; });
  var mb=document.getElementById('mem-body'); if(mb)mb.style.display='none';
  var ms=document.getElementById('mem-sub'); if(ms)ms.textContent='불러오는 중…';
  var q=document.getElementById('mem-q'); if(q)q.value='';
  var log=document.getElementById('mem-ai-log-h'); if(log)log.innerHTML='';
  window._memHubFilter=null; var nt=document.getElementById('hub-search-note'); if(nt)nt.innerHTML='';
  window._memberHubFilled=0;
}
/* [260903 허브 연결] 예울이 답 → 우상 검색 결과에 자동 반영 (_memAiSend 가 로컬 답 뒤에 호출).
   - 관람·구매 조건 질문(_bkIsQ) → 「조건부」 탭에 같은 조건(_bkAsk)을 폼에 넣고(_segQToForm) 바로 검색(_segRun). 같은 판정 한 벌이라 답과 명단 수가 일치한다.
   - 지역·연령 질문 → 「명부」 탭에 필터(window._memHubFilter {city|sido, ages})를 걸고 _memRender. 도시 판정은 _memCityName(집계와 같은 축).
   - 둘 다 아니면 아무 것도 안 한다. 상단 안내(#hub-search-note)의 ✕ 로 해제. */
function _memberHubOnAnswer(q,ans){
  if(!_memberHubShown())return 'nohub';
  if(typeof _bkIsQ==='function'&&_bkIsQ(q)&&window._bkAsk&&typeof _segQToForm==='function'&&typeof _segRun==='function'){
    _memberHubTab('seg'); try{_segQToForm(_bkAsk);}catch(_e){} try{_segRun();}catch(_e){}
    _memberHubNote('예울이 질문 → 조건 검색'); return 'seg';
  }
  var idx=(typeof _memAiIdx==='function')?_memAiIdx():null; if(!idx)return 'noidx';
  var regs=_memAiRegions(q,idx)||[], ages=_memAiAges(q)||[];
  if(!regs.length&&!ages.length)return 'nocond';
  var f={ages:ages}, city=regs.filter(function(x){return x.kind==='city';})[0], sido=regs.filter(function(x){return x.kind==='sido';})[0];
  if(city)f.city=city.name; else if(sido)f.sido=sido.name;
  window._memHubFilter=f; _memberHubTab('lookup'); try{_memRender();}catch(_e){}
  _memberHubNote('예울이 질문 → 명부: '+[(f.city||f.sido||''),ages.join('·')].filter(Boolean).join(' '));
  return 'lookup';
}
function _memberHubNote(t){
  var note=document.getElementById('hub-search-note'); if(!note)return;
  note.innerHTML=t?('<span>'+t+'</span> <button type="button" onclick="_memberHubLinkClear()" style="border:0;background:none;color:var(--dim);cursor:pointer;font-size:11px;padding:0 2px;font-family:inherit" title="예울이 조건 해제" aria-label="예울이 조건 해제">✕</button>'):'';
}
function _memberHubLinkClear(){ window._memHubFilter=null; _memberHubNote(''); try{_memRender();}catch(_e){} }
/* 예열 — 관리자면 로드 뒤 한가할 때 틀 + 개요(집계, 개인정보 아님)를 미리 그려 둔다. 명부(개인정보)는 열 때만. */
function _memberHubPrewarm(){
  try{
    if(window._MEMBER_HUB_ON===false)return 'off';
    if(window._memberHubPrewarmDone)return 'done';
    if(typeof userRole==='undefined'||userRole!=='admin')return 'notadmin';
    if(typeof _memLoadSummary!=='function'||typeof _memOvRender!=='function'||typeof _segViewHtml!=='function')return 'nofn';
    _memberHubBuild();
    if(!window._memberHubFilled){ window._memberHubFilled=1; _memberHubFill(); }
    window._memberHubPrewarmDone=1; return 'done';
  }catch(_e){ return 'err'; }
}
(function(){ try{ _memberHubCss(); }catch(_e){} })();
(function(){ try{ var n=0; var t=setInterval(function(){ n++; var r=null; try{ r=_memberHubPrewarm(); }catch(_e){} if(r==='done'||r==='off'||n>90)clearInterval(t); },2000); }catch(_e){} })();
