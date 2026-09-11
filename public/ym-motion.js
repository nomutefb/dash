/* ================================================================
   YM-MOTION v1.0  —  예울마루 대시보드 모션 확장 킷
   ----------------------------------------------------------------
   목적 : 화면 진입·모달 열림 때 (1) KPI 숫자 카운트업 (2) 차트 리빌
   원칙 : 기존 디자인 정본을 바꾸지 않는다. 색·좌표·글꼴·레이아웃 무변경.
          모션 문법도 정본을 따른다 — easing cubic-bezier(.4,0,.2,1),
          거리 6~12px, 지속 0.22~0.42s (모달 0.22s / ae-in 0.42s 와 동일 계열)
   성능 : clip-path 리빌 = 애니메이션 노드 1개.
          카운트업은 20fps로 제한(사람 눈은 그 이상 못 읽는다).
          느린 PC·백그라운드 탭·모션최소화 설정이면 자동으로 끈다.
   ================================================================ */
(function () {
  'use strict';
  if (window.YMFX) return;

  var EASE = 'cubic-bezier(.4,0,.2,1)';

  /* ---- 환경 판정 : 여기서 걸리면 애니메이션을 아예 안 만든다 ---- */
  var REDUCE = false;
  try { REDUCE = matchMedia('(prefers-reduced-motion:reduce)').matches; } catch (e) {}
  var CORES = navigator.hardwareConcurrency || 8;
  var MEM   = navigator.deviceMemory || 8;
  var LOWEND = (CORES <= 2 || MEM <= 2);          // 진짜 저사양 = 더 짧고 성기게
  var OFF    = REDUCE;                             // 완전 정지

  /* ---- 스타일 1회 주입 ---- */
  function css() {
    if (document.getElementById('ymfx-css')) return;
    var s = document.createElement('style');
    s.id = 'ymfx-css';
    /* 키프레임만 스타일시트에 둔다. 실제 재생은 인라인 style 로 건다 —
       앱 CSS와 우선순위 다툼이 아예 생기지 않게 하려는 것. (실측에서 클래스 방식이 앱 규칙에 밀렸다) */
    s.textContent = [
      '@keyframes ymfxReveal{0%{clip-path:inset(0 100% 0 0)}100%{clip-path:inset(0)}}',
      '@keyframes ymfxDot{0%{opacity:0;transform:scale(.35)}100%{opacity:1;transform:scale(1)}}',
      '.ymfx-dot{transform-box:fill-box;transform-origin:50% 50%}',
      '.ymfx-num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum"}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  /* ---- 공통 : 애니 끝나면 흔적 제거 (GPU 레이어 반환) ---- */
  function cleanup(el, cls) {
    var h = function () {
      el.removeEventListener('animationend', h);
      if (cls) el.classList.remove(cls);
      el.style.animation = '';
      el.style.animationDelay = '';
      el.style.animationPlayState = '';
      el.style.willChange = '';
    };
    el.addEventListener('animationend', h);
    setTimeout(h, 2500);                       // 안전망: 이벤트 유실 대비
  }
  function onScreen(el) {
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < (window.innerHeight || 900);
  }
  var DEGRADE = false;                        // 실측 자동 강등 스위치
  function skip() { return OFF || document.hidden; }

  /* 첫 재생 때 실제 프레임을 재서, 이 PC가 버거우면 다음부터 숫자 카운트업을 끈다.
     하드웨어 사양만 보고 판단하지 않는다 — 원격데스크톱·화면공유 중일 수도 있다. */
  function watch(ms) {
    if (DEGRADE) return;
    var t0 = null, prev = null, bad = 0;
    function f(t) {
      if (t0 === null) t0 = t;
      if (prev !== null && t - prev > 50) bad++;
      prev = t;
      if (t - t0 < (ms || 1600)) requestAnimationFrame(f);
      else if (bad >= 5) DEGRADE = true;
    }
    requestAnimationFrame(f);
  }

  /* ================================================================
     1) 차트 리빌 — 왼쪽에서 오른쪽으로 그려지듯 드러남
        컨테이너 1개만 애니메이션한다. 차트 안 요소는 건드리지 않는다.
     ================================================================ */
  function reveal(host, opt) { return false; } // 차트는 로딩 애니메이션 없이 즉시 표시합니다.

  /* ================================================================
     2) 숫자 카운트업 — 20fps 로 값만 갱신. 폭은 미리 고정해서 흔들림 0.
     ================================================================ */
  function parse(el) {
    var raw = (el.getAttribute('data-ymfx') || el.textContent || '').trim();
    var m = raw.match(/^([^\d\-]*)(-?[\d,]+(?:\.\d+)?)([\s\S]*)$/);
    if (!m) return null;
    var target = parseFloat(m[2].replace(/,/g, ''));
    if (!isFinite(target)) return null;
    el.setAttribute('data-ymfx', raw);
    return { el: el, raw: raw, pre: m[1], suf: m[3], target: target,
             dec: (m[2].split('.')[1] || '').length, comma: m[2].indexOf(',') > -1 };
  }
  function fmt(j, v) {
    var s = v.toFixed(j.dec);
    if (j.comma) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return j.pre + s + j.suf;
  }

  /* 핵심: 요소마다 루프를 돌리지 않는다. 루프 하나에서 전부 갱신 →
     한 프레임에 다시 그리는 횟수가 1회로 묶여 느린 PC에서 끊김이 사라진다. */
  function count(sel, opt) {
    opt = opt || {};
    var max = opt.max || 8, stag = (opt.stagger == null ? 40 : opt.stagger);
    var dur = opt.dur || (LOWEND ? 520 : 640);
    var jobs = [];
    [].slice.call(document.querySelectorAll(sel)).forEach(function (el) {
      if (el.children.length || jobs.length >= max) return;
      var j = parse(el);
      if (!j) return;
      if (skip() || DEGRADE || !onScreen(el)) { el.textContent = j.raw; return; }
      j.delay = jobs.length * stag;
      el.classList.add('ymfx-num');
      var w = el.getBoundingClientRect().width;
      if (w) el.style.minWidth = Math.ceil(w) + 'px';   // 폭 점프 차단
      el.textContent = fmt(j, 0);
      jobs.push(j);
    });
    if (!jobs.length) return 0;

    var step = 1000 / (LOWEND ? 12 : 20), t0 = null, last = -1e9;
    function tick(t) {
      if (t0 === null) t0 = t;
      var el = t - t0, paint = (t - last >= step), all = true;
      for (var i = 0; i < jobs.length; i++) {
        var j = jobs[i], e = el - j.delay;
        var p = e <= 0 ? 0 : Math.min(1, e / dur);
        if (p < 1) all = false;
        if (!paint && p < 1) continue;
        var k = p >= 1 ? 1 : 1 - Math.pow(2, -10 * p);   // easeOutExpo
        if (j.fin) continue;
        j.el.textContent = p >= 1 ? j.raw : fmt(j, j.target * k);
        if (p >= 1) { j.fin = 1; j.el.style.minWidth = ''; }
      }
      if (paint) last = t;
      if (!all) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    return jobs.length;
  }
  function countOne(el, opt) {
    var id = el.id || ('ymfx' + Math.random().toString(36).slice(2, 8));
    el.id = id;
    return count('#' + id, opt) ? true : false;
  }

  /* ================================================================
     3) Plotly 차트 (#yrm-chart 등) — 컨테이너 리빌로 동일 처리.
        Plotly 내부 API를 건드리지 않으므로 버전 올려도 안 깨진다.
     ================================================================ */
  function plotly(id, opt) { return reveal(id, opt || {}); }

  /* ================================================================
     4) 화면 진입 조합 — 숫자 먼저, 400ms 뒤 차트. 겹침을 줄여 부하 분산.
     ================================================================ */
  function enter(cfg) {
    cfg = cfg || {};
    if (skip()) return 0;
    var n = 0;
    watch(1600);
    if (cfg.nums) n += count(cfg.nums, { dur: 640, stagger: 40 });
    var charts = cfg.charts || [];
    if (typeof charts === 'string') charts = [charts];
    charts.forEach(function (c, i) {
      if (reveal(c, { delay: (cfg.chartDelay == null ? 560 : cfg.chartDelay) + i * 120 })) n++;
    });
    return n;
  }

  /* ================================================================
     5) 화면 자동 처리 — 호출한 쪽이 아무 정보도 안 줘도 된다.
        지금 화면에 실제로 붙어 있는 대상만 골라서 재생한다.
        (없는 화면에서 불러도 아무 일도 일어나지 않는다)
     ================================================================ */
  var TARGETS = {
    nums:   '.bizm-strip .val',            // KPI 숫자 띠
    charts: ['bizov-chart', 'yrm-chart']  // 사업 현황·판매 현황 차트: 컨테이너만 리빌
  };
  function screen(opt) {
    opt = opt || {};
    if (skip()) return 0;
    var list = [];
    (opt.charts || TARGETS.charts).forEach(function (id) {
      var el = document.getElementById(id);
      if (el && onScreen(el)) list.push(id);
    });
    return enter({ nums: opt.nums || TARGETS.nums, charts: list, chartDelay: opt.chartDelay });
  }

  /* 모달 안에 차트가 있을 때만 리빌. 모달 자체 열림 효과는 이미 있으므로 건드리지 않는다. */
  function modal(root) {
    var el = (typeof root === 'string') ? document.getElementById(root) : root;
    if (!el || skip()) return 0;
    var n = 0;
    [].slice.call(el.querySelectorAll('svg')).forEach(function (svg) {
      var r = svg.getBoundingClientRect();
      if (r.width > 160 && r.height > 90 && n < 3) { if (reveal(svg.parentElement, { delay: 120 })) n++; }
    });
    return n;
  }

  /* ---- 1회성 가드 : 같은 화면을 다시 그려도 두 번 재생하지 않는다 ---- */
  var seen = {};
  function once(key, fn) { if (seen[key]) return false; seen[key] = 1; fn(); return true; }
  function reset(key) { if (key) delete seen[key]; else seen = {}; }

  /* ---- 최초 진입 1회 자동 실행 : 기존 진입 스태거(ae-in 0.42s)가 끝난 뒤 ---- */
  function boot() { setTimeout(function () { try { screen(); } catch (e) {} }, 700); }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot, { once: true });

  window.YMFX = {
    reveal: reveal, count: count, countOne: countOne, plotly: plotly,
    enter: enter, screen: screen, modal: modal, once: once, reset: reset, css: css,
    targets: TARGETS,
    get degraded() { return DEGRADE; },
    env: { reduce: REDUCE, lowEnd: LOWEND, cores: CORES, mem: MEM }
  };
  css();
})();
