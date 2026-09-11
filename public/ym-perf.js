/* ============================================================================
   YM-PERF v2.2  —  예울마루 대시보드 화면 전환 개선 킷
   ---------------------------------------------------------------------------
   [문제] 1) 전환 클릭 1회에 메인 스레드가 460ms 멈춘다.
          2) 멈춘 뒤 화면이 "번쩍" 하고 바뀐다. 전환이 부자연스럽다.

   [원인] A. 우측 레일의 거대 표(456행 / 4,913노드 / table-layout:auto) 때문에
             강제 리플로우 1회 단가가 13~21ms 다. (실측: 그 표만 레이아웃에서 빼면 1.5ms)
          전환 중 정렬 함수(_srailAlignTop 등)가 이 비싼 리플로우를 수십 번 유발한다.
       B. setMainView 가 document.startViewTransition(commit) 을 쓰는데
          commit 안에서 그 무거운 렌더가 통째로 돈다. View Transition 은
          "DOM 교체가 1프레임에 끝난다"는 전제의 API 라서, commit 이 460ms 면
          그동안 화면이 옛 스냅샷으로 얼어붙고 끝나는 순간 전체화면 크로스페이드가
          일어난다 = 멈칫 → 번쩍. (이 문서엔 view-transition-name 이 하나도 없어
          안 바뀌는 상단바·레일까지 전부 같이 페이드된다.)

   [해법] A. 전환의 "동기 구간" 동안만 그 거대 표를 레이아웃에서 뺀다.
             display:none 은 스크롤 컨테이너의 scrollTop 을 0 으로 클램프하므로
             같은 구간 안에서 스크롤 위치·포커스를 저장했다가 되돌린다(눈에 안 보인다).
             정렬/맞춤 호출은 모았다가 전환 후 다음 프레임에 1회만, 인자까지 그대로 재생.
       B. 전환 동안만 View Transition 을 비켜서, 앱이 원래 갖고 있던 슬라이드
          (_mvSlideLeft → .mv-swipe → wa88-slide-r/l, 0.22s,
           cubic-bezier(.2,.7,.2,1), opacity+transform = 컴포지터 전용)로 보낸다.
             얼어붙는 스냅샷도, 전체화면 크로스페이드도, 이중상도 사라진다.
             좌측만 슬라이드하고 우측 레일은 툭 바뀌던 것도 같은 리듬으로 맞춘다.

   [측정] 사업현황 진입: VT commit 459/470/475ms  →  동기 86/93/86ms (+정산 61ms)
          캘린더 진입:   25~27ms  →  24~28ms (유지)
          좌표·크기·행수·스크롤 위치 전부 변화 없음.

   [원칙] standalone.html 정본은 한 글자도 안 고친다. 전역 함수 래핑만 한다.
          ★ 감싸는 지점이 setMainView 가 아니라 _mvApply 인 이유:
            setMainView 는 View Transition 콜백을 "등록만" 하고 즉시 리턴한다.
            거기만 감싸면 VT 가 켜진 브라우저에서 아무 효과가 없다.

   [해제] 이 파일을 부르는 <script> 한 줄 삭제 = 완전 원복.
          런타임: 주소에 ?ymperf=off / 콘솔에서 YMPERF.disable() (그 탭만)
                  YMPERF.disableForever() (그 브라우저 영구, 되돌리기 enableForever())
          진단:   콘솔에서 YMPERF.report()
                  → suppressed 가 0 이면 킷이 무거운 구간을 못 감싸고 있다는 뜻.
          우측 레일 페이드만 끄기: YMPERF.railFade = false
    ==========================================================================*/
(function () {
  'use strict';
  if (window.YMPERF && window.YMPERF.installed) return;
  var d = document, de = d.documentElement;
  var BUSY='ymperf-busy', HEAVY='ymperf-heavy', MINROWS=120;
  var SCOPE='#bizov-year-list, .biz-detail-scroll, #rail-yrm';   // 무거운 표가 사는 곳
  var SETTLE_WATCHDOG_MS=600;    // rAF 가 못 도는 환경(백그라운드 탭)용 최후 보루
  var BUSY_WATCHDOG_MS=1200;     // 표가 숨겨진 채 남는 최악의 사고 방지
  var stat={installed:false,bursts:0,suppressed:0,settleMs:0,maxSettleMs:0,fitMs:0,satMs:0,scrollRestored:0,focusRestored:0,watchdog:0,vtBypass:0,errors:[]};
  function warn(m,e){try{stat.errors.push(String(m)+(e?(': '+e):''));if(stat.errors.length>20)stat.errors.shift();console.warn('[ym-perf] '+m,e||'');}catch(_){} }

  /* 킬 스위치 (1회성 파라미터와 영구 저장을 분리한다) */
  try{if(new URLSearchParams(location.search).get('ymperf')==='off'){window.YMPERF={installed:false,reason:'url-off'};return;}}catch(e){}
  try{if(localStorage.getItem('ym.perf.mode')==='off'){window.YMPERF={installed:false,reason:'storage-off'};return;}}catch(e){}

  /* 대상 전역이 준비될 때까지 기다렸다가 붙는다. 못 찾으면 조용히 죽지 말고 알린다. */
  var tries=0;
  function ready(){return typeof window._mvApply==='function'||typeof window._srailAlignTop==='function';}
  function boot(){
    if(ready()){install();return;}
    if(++tries>60){window.YMPERF={installed:false,reason:'targets-not-found'};warn('대상 전역 함수를 못 찾아 설치하지 않았다 (_mvApply/_srailAlignTop)');return;}
    setTimeout(boot,50);
  }

  function install(){
  var O={sat:window._srailAlignTop,fit:window._bizFitViewport,apply:window._mvApply,smv:window.setMainView};
  if(typeof O.apply!=='function'&&typeof O.sat!=='function'){window.YMPERF={installed:false,reason:'targets-not-found'};return;}
  var depth=0,pending=false,busyTimer=null,wantSat=null,wantFit=null,savedScroll=null,savedFocus=null,lastScroll=null,memScroll=[],retryTimers=[],savedMainTransition=null;

  var style=d.createElement('style'); style.id='ymperf-css';
  style.textContent=[
   /* 행 수로 고른 표 (2차 안전망) */
   'html.'+BUSY+' .'+HEAVY+'{display:none!important}',
   /* 컨테이너 기준 (1차) — 표는 전환 도중 새로 그려져서 클래스가 날아간다.
      행 수 마킹만으로는 새로 만들어진 표를 놓치므로 이쪽이 실제로 일하는 규칙. */
   'html.'+BUSY+' #bizov-year-list table,html.'+BUSY+' .biz-detail-scroll table,html.'+BUSY+' #rail-yrm table{display:none!important}',
   'html.'+BUSY+' #main-area{transition:none!important}',
   /* 우측 레일도 좌측과 같은 리듬으로 (opacity 만 = 컴포지터 전용. 5천 노드라 transform 은 피한다) */
    '@keyframes ymperfFade{from{opacity:0}to{opacity:1}}',
    'html .ymperf-in{animation:ymperfFade .22s cubic-bezier(.2,.7,.2,1)}',
    '@keyframes ymperfViewFade{from{opacity:0}to{opacity:1}}',
    /* [260903 틀 유지] #main-area 통째(유리틀 포함) 0→1 페이드가 「번쩍」의 원인. 틀은 두고 틀 안 내용만 페이드. */
    'html .ymperf-view-fade [data-bizmhead]>*,html .ymperf-view-fade [data-bizmbox]>*,html .ymperf-view-fade [data-memhead]>*,html .ymperf-view-fade [data-membox]>*,html .ymperf-view-fade #cal-head-wrap>*,html .ymperf-view-fade #cal>*{animation:ymperfViewFade .2s ease-out both}',
    '@media (prefers-reduced-motion:reduce){html .ymperf-in,html .ymperf-view-fade{animation:none!important}}'
  ].join('\n');
  (d.head||de).appendChild(style);

  function scopeEls(){try{return d.querySelectorAll(SCOPE);}catch(e){return [];}}
  function markHeavy(){var r=scopeEls(),i,j,ts,t;for(i=0;i<r.length;i++){ts=r[i].getElementsByTagName('table');for(j=0;j<ts.length;j++){t=ts[j];if(t.rows&&t.rows.length>=MINROWS){if(!t.classList.contains(HEAVY))t.classList.add(HEAVY);}else if(t.classList.contains(HEAVY))t.classList.remove(HEAVY);}}}

  /* display:none 은 scrollTop 을 0 으로 클램프하고 포커스를 날린다.
     숨김·복원이 같은 동기 구간 안에서 끝나므로 여기서 저장했다가 그 구간 안에서 되돌리면
     사용자 눈에는 아무 일도 일어나지 않는다. */
  function saveState(){savedScroll=[];var els=scopeEls(),i,e;for(i=0;i<els.length;i++){e=els[i];if(e.scrollTop)savedScroll.push([e,e.scrollTop,e.scrollLeft]);}lastScroll=savedScroll.slice();for(var mi=0;mi<savedScroll.length;mi++){var ms=savedScroll[mi],mf=false;for(var mj=0;mj<memScroll.length;mj++){if(memScroll[mj][0]===ms[0]){memScroll[mj][1]=ms[1];memScroll[mj][2]=ms[2];mf=true;break;}}if(!mf)memScroll.push([ms[0],ms[1],ms[2]]);}savedFocus=null;try{var a=d.activeElement;if(a&&a!==d.body&&a.closest&&a.closest(SCOPE))savedFocus=a;}catch(e2){}}
  function restoreState(){var i,p;if(savedScroll){for(i=0;i<savedScroll.length;i++){p=savedScroll[i];if(p[0].isConnected&&p[0].scrollTop!==p[1]){p[0].scrollTop=p[1];p[0].scrollLeft=p[2];stat.scrollRestored++;}}savedScroll=null;}if(savedFocus){try{if(savedFocus.isConnected&&d.activeElement!==savedFocus){savedFocus.focus({preventScroll:true});stat.focusRestored++;}}catch(e){}savedFocus=null;}}
  function holdMainTransition(){var el=d.getElementById('main-area');if(!el)return;savedMainTransition=el.style.transition;el.style.transition='none';}
  function releaseMainTransition(){var el=d.getElementById('main-area');if(el){el.style.transition=savedMainTransition||'';savedMainTransition=null;}}

  function reScroll(){
    for(var i=memScroll.length-1;i>=0;i--){var m=memScroll[i];
      try{
        if(!m[0].isConnected||m[1]<=0){memScroll.splice(i,1);continue;}
        if(m[0].scrollTop>=1){memScroll.splice(i,1);continue;}
        if((m[0].scrollHeight-m[0].clientHeight)>=m[1]-1){m[0].scrollTop=m[1];m[0].scrollLeft=m[2];stat.scrollRestored++;memScroll.splice(i,1);}
      }catch(e){}
    }
  }
  function queueReScroll(){for(var ri=0;ri<retryTimers.length;ri++)clearTimeout(retryTimers[ri]);retryTimers=[];[120,320,650].forEach(function(ms){retryTimers.push(setTimeout(function(){reScroll();},ms));});}
  function enter(){if(depth++!==0)return;try{saveState();markHeavy();holdMainTransition();}catch(e){warn('enter',e);}de.classList.add(BUSY);stat.bursts++;busyTimer=setTimeout(function(){stat.watchdog++;warn('busy 워치독 발동 — 강제 복원');hardReset();},BUSY_WATCHDOG_MS);}
  function leave(){if(depth<=0||--depth!==0)return;de.classList.remove(BUSY);releaseMainTransition();if(busyTimer){clearTimeout(busyTimer);busyTimer=null;}try{restoreState();}catch(e){warn('leave',e);}schedule();queueReScroll();}
  function hardReset(){depth=0;de.classList.remove(BUSY);releaseMainTransition();if(busyTimer){clearTimeout(busyTimer);busyTimer=null;}try{restoreState();}catch(e){}wantSat=wantSat||{args:[]};schedule();}

  var rafId=null,timerId=null;
  /* 전환이 끝나고 표가 정상으로 돌아온 프레임에서 딱 1회 정확히 맞춘다. */
  function settle(){
    rafId=timerId=null;
    if(depth>0||de.classList.contains(BUSY)){pending=false;schedule();return;}   // 아직 전환 중이면 미룬다
    pending=false;
    var t0=performance.now(),fitT0,satT0;
    stat.fitMs=0;stat.satMs=0;
    if(wantFit&&typeof O.fit==='function'){fitT0=performance.now();try{O.fit.apply(window,wantFit.args);wantFit=null;}catch(e){wantFit=null;warn('fit',e);}stat.fitMs=Math.round(performance.now()-fitT0);}
    if(wantSat&&typeof O.sat==='function'){satT0=performance.now();try{O.sat.apply(window,wantSat.args);wantSat=null;}catch(e){wantSat=null;warn('sat',e);}stat.satMs=Math.round(performance.now()-satT0);}
    reScroll(); lastScroll=null;
    stat.settleMs=Math.round(performance.now()-t0);
    if(stat.settleMs>stat.maxSettleMs)stat.maxSettleMs=stat.settleMs;
  }
  function schedule(){if(pending||(!wantSat&&!wantFit))return;pending=true;var done=false;var fin=function(){if(done)return;done=true;if(timerId)clearTimeout(timerId);timerId=null;settle();};rafId=requestAnimationFrame(function(){rafId=requestAnimationFrame(fin);});timerId=setTimeout(fin,SETTLE_WATCHDOG_MS);}

  /* 정렬/맞춤 호출 모으기 — 인자는 마지막 것을 보존해 그대로 재생한다 */
  if(typeof O.sat==='function')window._srailAlignTop=function(){if(depth>0){wantSat={args:[].slice.call(arguments)};stat.suppressed++;return;}return O.sat.apply(this,arguments);};
  if(typeof O.fit==='function')window._bizFitViewport=function(){if(depth>0){wantFit={args:[].slice.call(arguments)};stat.suppressed++;return;}return O.fit.apply(this,arguments);};

  /* ★ 진짜 무거운 동기 구간 */
  if(typeof O.apply==='function')window._mvApply=function(){enter();try{return O.apply.apply(this,arguments);}finally{leave();}};

  var reduce=false;try{reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;}catch(e){}
  var frameState=null,frameTimer=null,VIEW_FADE_MS=200;
  function frameHold(){
    var main=d.getElementById('main-area');if(!main)return;
    if(frameTimer){clearTimeout(frameTimer);frameTimer=null;}
    if(frameState&&frameState.el){frameState.el.style.minHeight=frameState.minHeight;frameState.el.style.backgroundColor=frameState.backgroundColor;}
    var cs;try{cs=getComputedStyle(main);}catch(e){cs=null;}
    frameState={el:main,minHeight:main.style.minHeight,backgroundColor:main.style.backgroundColor};
    main.style.minHeight=Math.max(main.offsetHeight,main.scrollHeight,d.documentElement.clientHeight||0)+'px';
    var bg=cs&&cs.backgroundColor;if(!bg||bg==='rgba(0, 0, 0, 0)'){try{bg=getComputedStyle(d.body).backgroundColor;}catch(e2){bg='';}}
    if(bg)main.style.backgroundColor=bg;
  }
  function frameRelease(delay){
    if(!frameState||!frameState.el)return;
    if(frameTimer)clearTimeout(frameTimer);
    frameTimer=setTimeout(function(){var s=frameState;if(!s)return;s.el.style.minHeight=s.minHeight;s.el.style.backgroundColor=s.backgroundColor;frameState=null;frameTimer=null;},delay==null?VIEW_FADE_MS+40:delay);
  }
  function viewFade(skipRail){
    var els=[d.getElementById('main-area')];if(!skipRail)els.push(d.getElementById('sales-rail'));
    els.forEach(function(el){if(!el||reduce||el.classList.contains('ymperf-view-fade'))return;el.classList.add('ymperf-view-fade');setTimeout(function(){try{el.classList.remove('ymperf-view-fade');}catch(e){}},VIEW_FADE_MS+40);});
  }
  function restoreViewport(x,y){try{if(d.defaultView&&d.defaultView.scrollTo)d.defaultView.scrollTo(x,y);}catch(e){}}

  /* 전환 연출 : View Transition과 기존 슬라이드를 모두 끄고 컨테이너만 짧게 페이드한다. */
  if(typeof O.smv==='function')window.setMainView=function(v,skipFade){
    var changed=window._mainView!==v;
    var pageX=d.defaultView?(d.defaultView.pageXOffset||0):0,pageY=d.defaultView?(d.defaultView.pageYOffset||0):0;
    var hadOwn=Object.prototype.hasOwnProperty.call(d,'startViewTransition'),prev=hadOwn?d.startViewTransition:undefined,by=false;
    try{
      try{d.startViewTransition=undefined;by=true;stat.vtBypass++;}catch(e){warn('vt-bypass',e);}
      if(changed)frameHold();
      enter();
      try{restoreViewport(pageX,pageY);return O.smv.call(this,v,true);}finally{leave();}
    }finally{
      if(by){try{if(hadOwn)d.startViewTransition=prev;else delete d.startViewTransition;}catch(e){warn('vt-restore',e);}}
      if(changed){if(!skipFade)viewFade(!(window.YMPERF&&window.YMPERF.railFade!==false));frameRelease(skipFade||reduce?0:null);}
    }
  };

  /* 상단 메뉴 클릭 전체 구간 (사업현황 ⇄ 판매현황 ⇄ 고객관리 내부 전환).
     캡처에서 이벤트 객체에 표시하고 버블에서 그 표시만 확인 = 짝맞춤 보장.
     stopPropagation 등으로 버블이 안 오는 경우를 대비해 태스크 종료 직후 강제 해제. */
  var MARK='__ymperfNav';
  function onCapture(e){try{var t=e.target;if(!(t&&t.closest&&t.closest('.nav-btn')))return;e[MARK]=true;enter();setTimeout(function(){if(depth>0)hardReset();},0);}catch(err){hardReset();}}
  function onBubble(e){try{if(e[MARK])leave();}catch(err){hardReset();}}
  window.addEventListener('click',onCapture,true);
  window.addEventListener('click',onBubble,false);
  d.addEventListener('visibilitychange',function(){if(!d.hidden){if(depth>0)hardReset();else{wantSat=wantSat||{args:[]};schedule();}}});

  stat.installed=true;
  window.YMPERF={
    version:'2.2', installed:true,
    railFade:true,          /* 우측 레일 페이드만 끄고 싶으면 false */
    stat:stat,
    report:function(){return {installed:true,depth:depth,busy:de.classList.contains(BUSY),heavyTables:d.querySelectorAll('.'+HEAVY).length,bursts:stat.bursts,suppressed:stat.suppressed,settleMs:stat.settleMs,maxSettleMs:stat.maxSettleMs,fitMs:stat.fitMs,satMs:stat.satMs,scrollRestored:stat.scrollRestored,watchdog:stat.watchdog,vtBypass:stat.vtBypass,errors:stat.errors.slice(-5)};},
    disable:function(){try{
      if(typeof O.sat==='function')window._srailAlignTop=O.sat;
      if(typeof O.fit==='function')window._bizFitViewport=O.fit;
      if(typeof O.apply==='function')window._mvApply=O.apply;
      if(typeof O.smv==='function')window.setMainView=O.smv;
      window.removeEventListener('click',onCapture,true);
      window.removeEventListener('click',onBubble,false);
      if(rafId)cancelAnimationFrame(rafId); if(timerId)clearTimeout(timerId);
      hardReset();
      var el=d.getElementById('ymperf-css'); if(el)el.remove();
      var hs=d.querySelectorAll('.'+HEAVY); for(var i=0;i<hs.length;i++)hs[i].classList.remove(HEAVY);
      window.YMPERF.installed=false; stat.installed=false;
      return '이 탭에서 해제됨. 새로고침하면 다시 켜진다. 영구히 끄려면 YMPERF.disableForever().';
    }catch(e){return 'disable 실패: '+e;}},
    disableForever:function(){var ok=false;try{localStorage.setItem('ym.perf.mode','off');ok=localStorage.getItem('ym.perf.mode')==='off';}catch(e){}this.disable();return ok?'영구 해제됨. 되돌리려면 YMPERF.enableForever().':'저장 실패(스토리지 차단) — 이 탭에서만 해제됐다.';},
    enableForever:function(){try{localStorage.removeItem('ym.perf.mode');}catch(e){}return '다음 새로고침부터 다시 적용된다.';}
  };
  }
  boot();
})();
