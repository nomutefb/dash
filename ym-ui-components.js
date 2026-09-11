/* SQUARE_UI_260910_BEGIN - original Switch only */
/* Original Square UI Switch only. Existing theme and all other controls are unchanged. */
(function(g){
 'use strict';
 if(g.YMSquareUI)return;
 var templates={"switch":"<button type=\"button\" role=\"switch\" aria-checked=\"false\" data-state=\"unchecked\" value=\"on\" data-slot=\"switch\" class=\"peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50\" aria-label=\"판매 중\"><span data-state=\"unchecked\" data-slot=\"switch-thumb\" class=\"bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0\"></span></button><input type=\"checkbox\" aria-hidden=\"true\" style=\"transform:translateX(-100%);position:absolute;pointer-events:none;opacity:0;margin:0\" tabindex=\"-1\" value=\"on\"/>"};
 function switchHtml(checked){
  var t=document.createElement('template');t.innerHTML=templates.switch;
  var button=t.content.querySelector('[data-slot="switch"]');
  button.setAttribute('aria-checked',String(checked));button.dataset.state=checked?'checked':'unchecked';
  button.setAttribute('onclick','_programSalesToggle(this.getAttribute("aria-checked")!=="true")');
  button.setAttribute('aria-labelledby','ym-sales-switch-label');button.type='button';button.classList.add('ym-sales-switch');
  var thumb=button.querySelector('[data-slot="switch-thumb"]');if(thumb)thumb.dataset.state=checked?'checked':'unchecked';
  return '<span class="ym-sales-filter" data-active="'+checked+'">'+button.outerHTML+'<span id="ym-sales-switch-label" class="ym-sales-switch-label" onclick="_programSalesToggle()">판매 중</span></span>';
 }
 function syncSales(){document.querySelectorAll('.ym-sales-filter').forEach(function(el){
  var on=!!g._programSalesMode;el.dataset.active=String(on);
  var control=el.querySelector('[role="switch"]');if(control){control.setAttribute('aria-checked',String(on));control.dataset.state=on?'checked':'unchecked';var thumb=control.querySelector('[data-slot="switch-thumb"]');if(thumb)thumb.dataset.state=on?'checked':'unchecked';}
 });}
 g.YMSquareUI={version:'c216c47110cbd92b3eb1996e016f95d298da4c40',switchHtml:switchHtml,syncSales:syncSales};
})(window);

/* SQUARE_UI_260910_END */
/* Pure classic-script components; no authentication, polling or business API. */
(function (global) {
  'use strict';
  if (global.YMUI) throw new Error('YMUI_DUPLICATE_LOAD');
  var stack = [], restored = new Map();
  function escapeText(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  // extra is existing trusted application markup. Title/subtitle/id are escaped.
  function head(title, sub, extra, titleId) {
    return '<div class="mhead"><span' + (titleId ? ' id="' + escapeText(titleId) + '"' : '') + '>' + escapeText(title) + '</span>'
      + (sub ? '<span class="sub">' + escapeText(sub) + '</span>' : '')
      + (extra ? '<span class="ym-ui-head-extra">' + extra + '</span>' : '') + '</div>';
  }
  function inertBackground() {
    restored.forEach(function (value, el) { el.inert = value; });
    restored.clear();
    if (!stack.length) return;
    var node = stack[stack.length - 1].root;
    while (node && node !== document.body) {
      var parent = node.parentElement;
      if (!parent) break;
      Array.from(parent.children).forEach(function (other) {
        if (other === node || /^(SCRIPT|STYLE|LINK)$/.test(other.tagName)) return;
        if (!restored.has(other)) restored.set(other, other.inert);
        other.inert = true;
      });
      node = parent;
    }
  }
  function focusable(root) {
    return Array.from(root.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')).filter(function (el) {
      return !el.disabled && !el.hidden && !el.closest('[hidden],[inert]') && el.tabIndex >= 0 && el.getClientRects().length;
    });
  }
  function release(root) {
    var index = stack.findIndex(function (item) { return item.root === root; });
    if (index < 0) return;
    var item = stack[index], wasTop = index === stack.length - 1;
    stack.splice(index, 1);
    inertBackground();
    if (wasTop && item.returnFocus && item.returnFocus.isConnected && !item.returnFocus.closest('[inert]')) item.returnFocus.focus();
  }
  function mount(root, onClose, returnFocus) {
    if (!root || !root.isConnected) throw new Error('YMUI_DIALOG_NOT_CONNECTED');
    if (stack.some(function (item) { return item.root === root; })) return;
    stack.push({root:root, onClose:onClose, returnFocus:returnFocus || document.activeElement});
    inertBackground();
  }
  document.addEventListener('keydown', function (event) {
    var item = stack[stack.length - 1];
    if (!item) return;
    if (!item.root.isConnected) { release(item.root); return; }
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation();
      item.onClose(); // Existing close function owns busy/unsaved guards.
      return;
    }
    if (event.key !== 'Tab') return;
    var items = focusable(item.root), active = document.activeElement;
    if (!items.length) { event.preventDefault(); return; }
    if (!item.root.contains(active) || (event.shiftKey ? active === items[0] : active === items[items.length - 1])) {
      event.preventDefault(); (event.shiftKey ? items[items.length - 1] : items[0]).focus();
    }
    // Only the manager owns the trap. Preserve default navigation inside it.
    event.stopImmediatePropagation();
  }, true);
  global.YMUI = Object.freeze({version:'260908a', head:head, mount:mount, release:release, escapeText:escapeText});
})(window);

/* Customer and annual display presentation. YM_DISPLAY_FIX_260910 */
(function(global){
  'use strict';
  function regionPercent(items){
    var total=items.reduce(function(s,x){return s+x.v;},0);
    return function(v){return total>0?(v/total*100).toFixed(1):'—';};
  }
  function installCustomerDonuts(){
    var original=global._memDonutHtml;
    if(typeof original!=='function'||original.ymCategoryPalette)return;
    function render(items,mid,sub,FIT,pct){
      if(sub==='최다 연령대'){
        var ranked=items.filter(function(x){return x.label!=='미상';}).slice().sort(function(a,b){return b.v-a.v;});
        var palette=['var(--accent)','var(--peach-text)','var(--green)','var(--c4)','var(--c5)'];
        items.forEach(function(x){var rank=ranked.indexOf(x);x.c=rank<0?'var(--neutral-text)':palette[rank%palette.length];x.o=rank<0?0.4:rank<3?1:0.65;x.hi=rank>=0&&rank<2;});
      }
      if(sub==='주소 확인'){
        pct=regionPercent(items);items.ymRegionPercent=pct;
        var local=items.reduce(function(sum,x){return sum+(['여수','순천','광양'].indexOf(x.label)>=0?x.v:0);},0);
        mid=pct(local)+'%';sub='여순광';
      }
      return original.call(this,items,mid,sub,FIT,pct);
    }
    render.ymCategoryPalette=true;global._memDonutHtml=render;
    global._memLegendHtml=function(items,pct,FIT){
      pct=items.ymRegionPercent||pct;
      return '<div class="ym-readable-legend">'+items.map(function(x){var ink=x.hi?x.c:'var(--text)';return '<div class="ym-readable-legend-row" style="color:'+ink+'"><span class="ym-readable-dot" style="background:'+x.c+';opacity:'+x.o+'"></span><span class="ym-readable-label">'+global._memEsc(x.label)+'</span><span class="ym-readable-value">'+x.v.toLocaleString()+'명 · '+pct(x.v)+'%</span></div>';}).join('')+'</div>';
    };
    global._memSectHtml=function(inner){return '<div class="ym-readable-section">'+inner+'</div>';};
    var overview=global._memOvRender;
    global._memOvRender=function(targetId){
      var result=overview.apply(this,arguments),root=document.getElementById(targetId||'mem-ov-body');
      if(root){
        var donut=root.querySelector('svg[aria-label="여순광 도넛 차트"]');
        if(donut){var pctText=donut.querySelector('text');root.querySelectorAll('b').forEach(function(b){if(b.parentElement.textContent.indexOf('관내(여수·순천·광양)')===0&&pctText)b.textContent=pctText.textContent;});}
      }
      return result;
    };
    var annual=global._yrRender;
    global._yrRender=function(pfx){
      var result=annual.apply(this,arguments),root=document.getElementById((pfx||'yr')+'-body');
      if(root&&typeof _YR!=='undefined'&&_YR.jangdo&&_YR.years.length){
        var hero=root.querySelector('.bizm-hero'),year=_YR.years[_YR.years.length-1];
        if(hero){var label=hero.querySelector('.lb .sub'),detail=hero.querySelector('.brk');
          if(label)label.textContent=year+'년 현재 포함';
          if(detail){detail.textContent='예울마루 관람 '+(_YR.grand-_YR.jangdo.sum).toLocaleString();detail.appendChild(document.createElement('br'));detail.appendChild(document.createTextNode('+ 장도 방문 '+_YR.jangdo.sum.toLocaleString()));}
        }
      }
      return result;
    };
    if(!document.getElementById('ym-readable-legend-style')){
      var style=document.createElement('style');style.id='ym-readable-legend-style';
      style.textContent='.ym-readable-section{display:flex;flex-wrap:wrap;align-items:center;gap:12px;min-height:0;overflow:auto;flex:1 1 auto}.ym-readable-legend{flex:1 1 200px;min-width:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:8px 14px;align-content:start}.ym-readable-legend-row{display:grid;grid-template-columns:9px minmax(0,1fr);gap:2px 6px;min-width:0;line-height:1.4}.ym-readable-dot{width:9px;height:9px;margin-top:4px;border-radius:3px}.ym-readable-label{font-size:11.5px;font-weight:700;overflow-wrap:anywhere}.ym-readable-value{grid-column:2;font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}#member-hub .cb-rise-col .ym-readable-section svg + .ym-readable-legend{flex:1 1 130px!important;width:auto!important;grid-auto-rows:minmax(38px,auto)!important;grid-template-columns:1fr!important;padding-left:0!important}.ym-readable-legend-row{min-height:38px}';document.head.appendChild(style);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installCustomerDonuts,{once:true});
  else installCustomerDonuts();
})(window);

/* Restore observed-start / recent trend layout without changing recorded sales. */
(function(global){
  function install(){
    if(typeof global._srailTrend!=='function'||global._srailTrend.ymStartRestored)return;
    var restored=function _srailTrend(p){
  var days=((p._mid&&!p._cap)?_ymDisplayDays(p):(p.days||[])).filter(function(d){return d&&d.seat!=null&&!isNaN(d.seat);});
  var firstRecord=false,omitted=false;
  if(p._mid&&!p._cap){
    var history=_ymTotalSeries(p);
    if(history&&history.pts.length){
      var points=history.pts,chosen=points.length>8?[points[0]].concat(points.slice(-7)):points;
      omitted=points.length>8;firstRecord=true;
      days=chosen.map(function(q){return {bd:_ymDayKey(q.bd),seat:q.seats,mny:q.money,occ:q.occ,x:q.x,personalSeat:q.personalSeats};});
    }
  }
  if(days.length<2)return _srailSpark([]);
  var tot=p.totalOpen||926, seatOf=function(o){return Math.round(tot*o/100);};
  // [260731 운영자] 값 상한 — 공연은 점유율이라 100%가 천장. 전시는 절대 관객수(명)라 천장이 없다(_srailTrendEx가 _cap을 크게 넘긴다).
  //   기본값 100 = 공연 호출부 전부 종전과 동일(거동 무변).
  var CAP=(p._cap!=null)?p._cap:Infinity;
  var occ=days.map(function(d){return d.occ;});
  // [260710 운영자] 예측 게이트 — 실측 _SRAIL_FC_MIN(7)건부터만 추이 연장·종료 예상(달력 7일 아님). 미만 = 실측만 그림(days는 상류 slice(-7) 캡이라 length 7 = 실측 7건 이상)
   var fc7=(!p._past)&&days.length>=_SRAIL_FC_MIN;
  var vals=occ.slice();
  // [260710 운영자] 예측 기울기 = 전 기간 일평균 fcRate(첫 실측 기준선 제외 — 첫날 버스트 배제) · %p/일. 미탑재 시 구 최근점 기울기 폴백
  if(fc7){ var g=(p.fcRate!=null&&tot>0)?(p.fcRate/tot*100):((occ.length>=3)?((occ[occ.length-1]-occ[occ.length-3])/2):(occ[occ.length-1]-occ[occ.length-2])); for(var k=1;k<=2;k++)vals.push(Math.max(0,Math.min(CAP,occ[occ.length-1]+g*k))); }   // 예측 2일(운영자 260710 — 그래프만, 예상 요약 문구는 3일 유지)
  var N=occ.length, todayIdx=N-1, T=vals.length;
  function md(bd){var s=String(bd);return s.length===8?(parseInt(s.slice(4,6),10)+'/'+parseInt(s.slice(6,8),10)):'';}
  var ld=_salesDate(String(days[days.length-1].bd));
  var labels=days.map(function(d){return md(d.bd);});
  for(var k2=1;k2<=2;k2++){ if(ld){var nd=new Date(ld.getTime()+k2*86400000);labels.push((nd.getMonth()+1)+'/'+nd.getDate());}else labels.push(''); }   // [260710 운영자] 7건 미만도 동일 골격 — ???존 x라벨용으로 항상 생성
  // [260710 운영자 "차트 늘어짐"] viewBox 폭 = 실측 픽셀 폭(_srailChartW) — 종전 고정 280 + preserveAspectRatio none이
  // 넓은 레일에서 글자를 가로로 잡아 늘이던 왜곡 제거(스케일 ≈ 1:1, 확정 폰트 수치는 그대로 유지)
  var W=Math.max(240,_srailChartW||280),H=177,padX=24,padT=24,padB=28;
  // [260710 운영자] 판매 종료일 예상점 — 예측 2일 뒤 축 중략(⫽) 텀을 두고 종료일 1점만 강조색2(--c2)로 표기
  var endD=(p.endDate instanceof Date)?p.endDate:null;
  var kEnd=(endD&&ld)?Math.round((endD-ld)/86400000):null;
  var _tdy=new Date(); _tdy.setHours(0,0,0,0);
  var showEnd=(fc7&&kEnd!==null&&kEnd>=3&&!p.noData&&endD>=_tdy);   // fc7 = 실측 7건 미만 종료 예상 생략(운영자 260710) · endD>=오늘 = 스테일 종료일 방어(상류 status 필터의 이중 안전 — 분신술 감사3)
  var occEnd=null;
  if(showEnd){
    // [260710 운영자] 종료 예상 기울기 = 전 기간 일평균 fcRate(첫 실측 기준선 제외) — 구 최근 3점 달력일 기울기 대체(막판 스퍼트·주말 스파이크에 널뛰던 것). 미탑재 시 구식 폴백
    var _gDay;
    if(p.fcRate!=null&&tot>0){ _gDay=p.fcRate/tot*100; }
    else{
      var _i0=Math.max(0,days.length-3);
      var _d0=_salesDate(String(days[_i0].bd));
      var _span=(ld&&_d0)?Math.max(1,Math.round((ld-_d0)/86400000)):Math.max(1,(days.length-1)-_i0);
      _gDay=(occ[occ.length-1]-occ[_i0])/_span;
    }
    occEnd=Math.max(0,Math.min(CAP,occ[occ.length-1]+_gDay*kEnd));
  }
  // [260710 운영자 확정] 전 카드 고정 골격 = [과거 6칸][Today][예측 2칸][종료 존] — Today는 항상 같은 세로선(슬롯 6).
  // 실측이 부족하면 왼쪽 과거 칸이 빈 점선으로 남고, 데이터가 쌓일수록 Today 기준 좌측으로 역행하며 채워진다(6칸 완충 = 7건 = 예측 시작).
  var slots=9, offset=0;
  var EZ=(showEnd||!fc7)?74:0;   // 종료 예상 존(중략 텀 + 점·라벨 자리) — 7건 미만은 ???존으로 사용
  var scaleVals=vals.slice(); if(showEnd)scaleVals.push(occEnd);    // [260711 운영자] 빈 과거 칸 = 0석 실값 표기 — 0 라인이 차트 안에 오도록 스케일 포함(offset 카드만, 예측 카드 스케일 불변)
  var mn=Math.min.apply(null,scaleVals),mx=Math.max.apply(null,scaleVals),span=mx-mn;if(span<0.6)span=0.6;mn-=span*.04;mx+=span*.08;   // [260826 3단계] 데이터 min~max 변화가 항상 보이도록 여백 축소
  var yOf=function(v){return padT+(H-padT-padB)*(1-(v-mn)/(mx-mn));};
  var xAt=function(si){return padX+(W-2*padX-EZ)*si/(slots-1);};   // si = 고정 슬롯 인덱스(0~8)
  var pts=vals.map(function(v,i){var slot=i<N?6*i/Math.max(1,N-1):6+(i-N+1);return [xAt(slot),yOf(v),v];});
  function seg(a,b){return pts.slice(a,b).map(function(q,i){return (i?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1);}).join(' ');}
  var solid=seg(0,N),dashed='M'+pts[todayIdx][0].toFixed(1)+' '+pts[todayIdx][1].toFixed(1)+' '+pts.slice(N).map(function(q){return 'L'+q[0].toFixed(1)+' '+q[1].toFixed(1);}).join(' ');
  var skipped='';
  if(omitted&&pts.length>1){
    var first=pts[0],next=pts[1],bx0=(first[0]+next[0])/2,by0=(first[1]+next[1])/2,sl0=(next[1]-first[1])/(next[0]-first[0]);
    solid='M'+first[0].toFixed(1)+' '+first[1].toFixed(1)+' L'+(bx0-7).toFixed(1)+' '+(by0-7*sl0).toFixed(1)+' M'+(bx0+7).toFixed(1)+' '+(by0+7*sl0).toFixed(1)+' L'+next[0].toFixed(1)+' '+next[1].toFixed(1)+pts.slice(2,N).map(function(q){return ' L'+q[0].toFixed(1)+' '+q[1].toFixed(1);}).join('');
    skipped='<text x="'+bx0.toFixed(1)+'" y="'+(by0+4).toFixed(1)+'" text-anchor="middle" font-size="13" fill="var(--accent)">≈<title>첫 기록 이후 중간 기간 생략 · 최근 7개 기록 표시</title></text>';
  }
  var area=seg(0,N)+' L'+pts[todayIdx][0].toFixed(1)+' '+(H-padB)+' L'+pts[0][0].toFixed(1)+' '+(H-padB)+' Z';
  var s='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="height:'+H+'px;width:100%;overflow:visible" aria-hidden="true">';
  s+='<path d="'+area+'" fill="rgba(74,77,231,.09)"/>';
  s+='<path d="'+solid+'" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
  s+=skipped;
  if(T>N)s+='<path d="'+dashed+'" fill="none" stroke="var(--muted)" stroke-width="2.5" stroke-dasharray="3 3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
  // Today 세로 점선 = 운영자 260710 "투데이 뒤 점선 삭제"로 제거(빨간 점·값·날짜가 이미 오늘을 표시)
  // [260710 운영자] 차트 글자 크기 = 어제대비(11.5px)로 전부 통일(점 위 좌석·증감·날짜·Today·종료 예상 — "증감이 중요")
  var R=3.6;
  // T/O(티켓오픈) 라벨 — 차트 창이 실측 전체를 담을 때만(전체 실측 ≤7건 → 첫 점 = 최초 입력 = 판매 개시) 첫 점 위에 표기.
  //   창이 잘린 공연(실측 8건↑)은 첫 점이 개시일이 아니므로 미표기(거짓 개시 방지). 간격 26 = Today 핀↔증감 간격과 통일(운영자).
  var showTO=firstRecord||(p.daysTotal!=null&&p.daysTotal<=days.length&&!p.noData);
  // 📌 Today = 빨강 강조(운영자 260710) + 「Today」 글자만(핀 이모지 제거) · 점 위 값·증감 스택 위에 배치
  // [260711 운영자 확정] Today↔증감 간격 = 15 고정 — 구 38은 클램프(padT-14) 발동 카드(실측만·Today=최고점)에서만 좁아져 카드마다 간격이 달랐음.
  //   운영자가 좋다고 한 게 그 눌린 간격(≈12)이라 12+아주 조금(3)=15를 정본으로. 클램프는 1로 완화 = 새 스택 높이(43.6)에선 최고점(y≈51.6)에도 미발동 → 전 카드 간격 동일(극단 안전망만 잔존).
  var _tdyY=Math.max(pts[todayIdx][1]-R-6-38-15,1);
  s+='<text x="'+pts[todayIdx][0].toFixed(1)+'" y="'+_tdyY.toFixed(1)+'" text-anchor="middle" font-size="14.4" fill="var(--danger)">Today '+Number(days[todayIdx].seat).toLocaleString()+'</text>';
  pts.forEach(function(q,i){
    var future=i>todayIdx,today=(i===todayIdx),recent=(i>=todayIdx-2);
    var seat=i<N?Number(days[i].seat):seatOf(q[2]),prevSeat=(i>0&&i<N)?Number(days[i-1].personalSeat!=null?days[i-1].personalSeat:days[i-1].seat):null,dseat=prevSeat!=null?(Number(days[i].personalSeat!=null?days[i].personalSeat:days[i].seat)-prevSeat):null;
    // [260710 운영자] 예측 제외일(x) = 속빈 점 + 툴팁 · 증감 라벨 회색 — 이 날 증분은 예측 평균에서 빠져 있음을 표시(실측 좌석 표기는 그대로)
    var isX=!future&&days[i]&&days[i].x;
    var dotX='<circle cx="'+q[0].toFixed(1)+'" cy="'+q[1].toFixed(1)+'" r="'+R+'" fill="var(--surface-solid)" stroke="var(--accent)" stroke-width="1.6"><title>예측 제외한 날 (이벤트성 판매 — 예상 계산에서 빠짐)</title></circle>';
    if(today)s+='<circle cx="'+q[0].toFixed(1)+'" cy="'+q[1].toFixed(1)+'" r="'+(R+2.2)+'" fill="var(--muted)"/>'+(isX?dotX:'<circle cx="'+q[0].toFixed(1)+'" cy="'+q[1].toFixed(1)+'" r="'+R+'" fill="var(--danger)"/>');
    else if(future)s+='<circle cx="'+q[0].toFixed(1)+'" cy="'+q[1].toFixed(1)+'" r="'+R+'" fill="var(--surface-solid)" stroke="var(--muted)" stroke-width="1.6"/>';   // [260711 운영자] 예측점 = 속빈 원(실선 테두리 — 작은 원 점선은 지글거려 폐지) + 좌석·증감 무표기(아래 !future 가드) — 실측과 시각 구분, x축 날짜는 유지
    else s+=isX?dotX:'<circle cx="'+q[0].toFixed(1)+'" cy="'+q[1].toFixed(1)+'" r="'+R+'" fill="var(--accent)"/>';
    var col=today?'var(--danger)':'var(--text)',sy=(q[1]-R-6).toFixed(1);
    if(showTO&&i===0)s+='<text x="'+q[0].toFixed(1)+'" y="'+(parseFloat(sy)-26).toFixed(1)+'" text-anchor="start" font-size="11.5" fill="var(--dim)">시작</text>';   // 좌측 정렬 = 시작점 왼쪽으로 안 나감(운영자 260710)
    if(!future)s+='<text x="'+q[0].toFixed(1)+'" y="'+sy+'" text-anchor="middle" font-size="11.5" fill="'+col+'">'+seat+'</text>';
    if(dseat!=null&&recent&&!future)s+='<text x="'+q[0].toFixed(1)+'" y="'+(parseFloat(sy)-19).toFixed(1)+'" text-anchor="middle" font-size="11.5" fill="var('+(isX?'--muted':'--green')+')">'+(dseat>=0?'+':'')+dseat+'</text>';
    if(i===0||today||i===T-1||(W>=600&&i%2===0))s+='<text x="'+q[0].toFixed(1)+'" y="'+(H-7)+'" text-anchor="middle" font-size="11.5" fill="'+(today?'var(--danger)':(future?'var(--muted)':'var(--dim)'))+'">'+labels[i]+'</text>';
  });
  // [260711 운영자] 왼쪽 빈 과거 칸 = 0석 실값으로 표기 — 0 라인 점선 + 슬롯마다 속빈 원(수치 무표기) + 마지막 0에서 첫 실측점으로 상승 연결(전 카드 골격 동형 "차트가 일정해야")
  // [260711 운영자] 7건 미만 = 예측·종료 값을 모름 — 골격은 예측 카드와 완전 동형(회색 점선 + 미래 속빈 원 2 + ≈ 중략 + c2 존 + 종료 속빈 원), 「???」 텍스트 폐지·수치 무표기
  if(!fc7){
    var lq2=pts[N-1], pEnd=W-padX-EZ, ex2=W-padX-6, y2=lq2[1];
    s+='<line x1="'+lq2[0].toFixed(1)+'" y1="'+y2.toFixed(1)+'" x2="'+pEnd.toFixed(1)+'" y2="'+y2.toFixed(1)+'" stroke="var(--muted)" stroke-width="2.5" stroke-dasharray="3 3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
    for(var fj=7;fj<=8;fj++)s+='<circle cx="'+xAt(fj).toFixed(1)+'" cy="'+y2.toFixed(1)+'" r="'+R+'" fill="var(--surface-solid)" stroke="var(--muted)" stroke-width="1.6"/>';   // 미래 슬롯 7·8 = 예측 카드의 예측점과 동형(속빈 원)
    var bx2=(pEnd+ex2)/2;
    s+='<line x1="'+pEnd.toFixed(1)+'" y1="'+y2.toFixed(1)+'" x2="'+(bx2-6).toFixed(1)+'" y2="'+y2.toFixed(1)+'" stroke="var(--c2)" stroke-width="2" stroke-dasharray="3 3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
    s+='<line x1="'+(bx2+6).toFixed(1)+'" y1="'+y2.toFixed(1)+'" x2="'+ex2.toFixed(1)+'" y2="'+y2.toFixed(1)+'" stroke="var(--c2)" stroke-width="2" stroke-dasharray="3 3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
    s+='<text x="'+bx2.toFixed(1)+'" y="'+(y2+4.5).toFixed(1)+'" text-anchor="middle" font-size="13" fill="var(--c2)">≈</text>';
    s+='<circle cx="'+ex2.toFixed(1)+'" cy="'+y2.toFixed(1)+'" r="'+R+'" fill="var(--surface-solid)" stroke="var(--c2)" stroke-width="1.6"/>';   // 종료점 = 값 몰라도 속빈 원은 항상(운영자 "??? 여도 동그라미" · 테두리 실선 = 260711 후속)
    s+='<text x="'+ex2.toFixed(1)+'" y="'+(y2-R-6-26).toFixed(1)+'" text-anchor="end" font-size="11.5" fill="var(--c2)">종료</text>';   // 핀 제거(운영자 260710 "핀 같은 거 다 없애자") — showEnd 확정 라벨 「종료」 미러
    for(var fi2=0;fi2<2;fi2++){ var _si=7+fi2; if((slots-1-_si)%2===0&&labels[N+fi2])s+='<text x="'+xAt(_si).toFixed(1)+'" y="'+(H-7)+'" text-anchor="middle" font-size="11.5" fill="var(--muted)">'+labels[N+fi2]+'</text>'; }   // 미래 라벨 = 고정 슬롯 7·8(라벨 배열은 N 뒤 2개)
    if(endD&&endD>=_tdy)s+='<text x="'+ex2.toFixed(1)+'" y="'+(H-7)+'" text-anchor="end" font-size="11.5" fill="var(--c2)">'+((endD.getMonth()+1)+'/'+endD.getDate())+'</text>';
    // [260714 운영자] 예측 대기 배지 — 실측 7건 미만(추세 예측 미설계)이면 종료 예상 존이 비어 보이지 않게 미래 예측 슬롯(7·8) 위에 살몬 강조 박스로 「예측 대기」 표기(첨부3 지시). 색 전부 토큰(--peach-*)
    var _pwW=56,_pwH=17,_pwCx=(xAt(7)+xAt(8))/2,_pwCy=Math.max(padT+_pwH/2+1,y2-24),_pwX=_pwCx-_pwW/2,_pwY=_pwCy-_pwH/2;
    s+='<rect x="'+_pwX.toFixed(1)+'" y="'+_pwY.toFixed(1)+'" width="'+_pwW+'" height="'+_pwH+'" rx="8" fill="var(--peach-bg)" stroke="var(--peach-text)" stroke-width="1.2"/>';
    s+='<text x="'+_pwCx.toFixed(1)+'" y="'+(_pwCy+3.7).toFixed(1)+'" text-anchor="middle" font-size="10.5" font-weight="700" fill="var(--peach-text)">예측 대기</text>';
  }
  if(showEnd){
    var lastQ=pts[pts.length-1], ex=W-padX-6, ey=yOf(occEnd), seatEnd=seatOf(occEnd);
    var bx=(lastQ[0]+ex)/2, by=(lastQ[1]+ey)/2;   // 중략 표기 위치 = 연결 선분 중앙
    var _sl=(ey-lastQ[1])/((ex-lastQ[0])||1);     // 선분 기울기(중략 양끝 y를 같은 직선 위에)
    // 연결 선분(강조색2 점선) — 중략 자리 12px 비움
    s+='<line x1="'+lastQ[0].toFixed(1)+'" y1="'+lastQ[1].toFixed(1)+'" x2="'+(bx-6).toFixed(1)+'" y2="'+(lastQ[1]+(bx-6-lastQ[0])*_sl).toFixed(1)+'" stroke="var(--c2)" stroke-width="2" stroke-dasharray="3 3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
    s+='<line x1="'+(bx+6).toFixed(1)+'" y1="'+(lastQ[1]+(bx+6-lastQ[0])*_sl).toFixed(1)+'" x2="'+ex.toFixed(1)+'" y2="'+ey.toFixed(1)+'" stroke="var(--c2)" stroke-width="2" stroke-dasharray="3 3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
    // 축 중략 마크 = ≈(물결 2겹 — 운영자 260710 "⫽ 사선 대신 ~ 2개 겹친 모양")
    s+='<text x="'+bx.toFixed(1)+'" y="'+(by+4.5).toFixed(1)+'" text-anchor="middle" font-size="13" fill="var(--c2)">≈</text>';
    s+='<circle cx="'+ex.toFixed(1)+'" cy="'+ey.toFixed(1)+'" r="'+R+'" fill="var(--surface-solid)" stroke="var(--c2)" stroke-width="1.6"/>';   // [260711 운영자] 종료 예상점도 속빈 원 — 예측 = 속빈 원(실선 테두리)으로 전 구간 통일(예상 좌석수 텍스트는 유지)
    s+='<text x="'+ex.toFixed(1)+'" y="'+(ey-R-6).toFixed(1)+'" text-anchor="end" font-size="11.5" fill="var(--c2)">'+seatEnd.toLocaleString()+'</text>';
    // 「종료 예상」 캡션 → 📌 D-day 핀(운영자 260710 — 라벨 밴드의 "종료 예상"과 중복 제거 · Today 핀↔증감과 동일 간격 26)
    s+='<text x="'+ex.toFixed(1)+'" y="'+(ey-R-6-26).toFixed(1)+'" text-anchor="end" font-size="11.5" fill="var(--c2)">종료</text>';   // 끝 라벨 = 종료(운영자 260710 플그 확정) — 우측 정렬 = 마지막 점 안 넘음
    s+='<text x="'+ex.toFixed(1)+'" y="'+(H-7)+'" text-anchor="end" font-size="11.5" fill="var(--c2)">'+((endD.getMonth()+1)+'/'+endD.getDate())+'</text>';
  }
  return s+'</svg>';
};
    restored.ymStartRestored=true;global._srailTrend=restored;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);

/* Transaction-day trend, 20260910. No inferred historical personal/group split. */
(function(g){
 var cache=null,job=null,loaded=0,seq=0;
 function day(d){if(d instanceof Date)return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');var s=String(d||'').replace(/[^0-9]/g,'');return s.length===8?s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6):'';}
 function add(d,n){return new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);}
 function gap(a,b){return Math.round((Date.parse(b)-Date.parse(a))/86400000);}
 function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
 function model(p,rows,today){
  var ds=rows.filter(function(r){return String(r['프로그램ID'])===String(p._mid)&&r['거래일자']<=today;}).sort(function(a,b){return a['거래일자'].localeCompare(b['거래일자']);});
  if(!ds.length)return null;
  var sum=0,seen={},points=[];
  ds.forEach(function(r){var d=r['거래일자'],raw=r['순판매매수'],v=Number(raw);if(raw==null||String(raw).trim()===''||seen[d]||!Number.isSafeInteger(v))throw Error('일별 이력 확인 필요');seen[d]=1;sum+=v;points.push({d:d,v:sum,delta:v,amount:Number(r['순판매금액']),final:r['마감여부']==='완료'});});
  if(points[0].d!==ds[0]['조회시작일']||points.some(function(q,i){return i&&gap(points[i-1].d,q.d)!==1;}))throw Error('일별 이력에 빈 날짜가 있습니다');
  var activity=points.find(function(q){return q.delta!==0||(Number.isFinite(q.amount)&&q.amount!==0);}),first=activity||points[0],last=points[points.length-1],recent=points.filter(function(q){return q.d>=first.d&&q.d>=add(today,-6);}),display=[first];
  recent.forEach(function(q){if(q.d!==display[0].d)display.push(q);});if(!display.some(function(q){return q.d===last.d;}))display.push(last);
  var end=day(p.endDate),future=[];
  if(end&&end>today){[7,14,28].forEach(function(n){var d=add(today,n);if(d<end)future.push({d:d,label:n+'일 후'});});future.push({d:end,label:'판매 종료'});}
  var sample=points.filter(function(q,i){return i>0&&q.final&&q.d>=add(last.d,-28);}).slice(-28),n=sample.length,mean=n?sample.reduce(function(s,q){return s+q.delta;},0)/n:0,sd=n>1?Math.sqrt(sample.reduce(function(s,q){return s+Math.pow(q.delta-mean,2);},0)/(n-1)):0;
  var eligible=n>=7&&gap(last.d,today)<=1;
  future.forEach(function(q){var h=gap(last.d,q.d),v=last.v+mean*h,r=1.96*sd*Math.sqrt(h+h*h/Math.max(1,n));q.v=eligible?Math.max(0,Math.round(v)):null;q.lo=eligible?Math.max(0,Math.floor(v-r)):null;q.hi=eligible?Math.max(q.v,Math.ceil(v+r)):null;});
  return {points:display,first:first,hasActivity:!!activity,historyStart:points[0].d,last:last,future:future,n:n,mean:mean,sd:sd,eligible:eligible,today:today};
 }
 function num(v){return Number(v).toLocaleString();}
 function md(d){return Number(d.slice(5,7))+'/'+Number(d.slice(8));}
 function choose(points,limit){
  if(points.length<=limit)return points;
  var picked=[];
  for(var i=0;i<limit;i++)picked.push(points[Math.round(i*(points.length-1)/(limit-1))]);
  return picked;
 }
 function panel(m,points,future,W){
  var all=points.concat(future),H=176,left=16,right=W-16,base=132,li=points.length-1;
  var full=m.points.concat(m.future),max=Math.max(1,...full.map(function(q){return q.hi==null?(q.v||0):q.hi;})),min=Math.min(0,...m.points.map(function(q){return q.v;}));
  function y(v){return 64+(base-64)*(1-(v-min)/(max-min));}
  function x(i){return left+(right-left)*i/Math.max(1,all.length-1);}
  function text(px,py,t,c,anchor){return '<text x="'+px+'" y="'+py+'" text-anchor="'+(anchor||'middle')+'" fill="'+c+'" font-size="11.5">'+esc(t)+'</text>';}
  var s='<svg role="img" aria-label="티켓셀러 거래일별 누적 순판매'+(future.length?'와 예상 범위':'')+'" viewBox="0 0 '+W+' '+H+'" style="display:block;width:100%;max-width:100%;min-width:0;height:auto">',path='';
  points.forEach(function(q,i){
   var px=x(i),py=y(q.v);
   if(i&&gap(points[i-1].d,q.d)>1){
    var ax=x(i-1),ay=y(points[i-1].v),bx=(ax+px)/2,by=(ay+py)/2,cut=Math.min(19,(px-ax)/3),slope=(py-ay)/(px-ax);
    path+=' M'+px+' '+py;
    s+='<path d="M'+ax+' '+ay+' L'+(bx-cut)+' '+(by-slope*cut)+' M'+(bx+cut)+' '+(by+slope*cut)+' L'+px+' '+py+'" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-dasharray="4 4"/>';
    s+='<text x="'+bx+'" y="'+by+'" dy="-2" dominant-baseline="central" text-anchor="middle" font-size="21" font-weight="700" fill="var(--accent)">≈≈<title>'+esc(points[i-1].d+' ~ '+q.d+' 사이 날짜 생략')+'</title></text>';
   }else path+=(i?' L':'M')+px+' '+py;
  });
  s+='<path d="'+path+'" fill="none" stroke="var(--accent)" stroke-width="2.5"/>';
  if(future.length&&m.eligible){
   var band='M'+x(li)+' '+y(m.last.v),line=band;
   future.forEach(function(q,j){var px=x(li+j+1);band+=' L'+px+' '+y(q.hi);line+=' L'+px+' '+y(q.v);});
   future.slice().reverse().forEach(function(q,j){band+=' L'+x(all.length-1-j)+' '+y(q.lo);});
   s+='<path d="'+band+' Z" fill="var(--c2)" opacity=".12"/><path d="'+line+'" fill="none" stroke="var(--c2)" stroke-width="2" stroke-dasharray="5 5"/>';
  }
  all.forEach(function(q,i){
   var predicted=i>li,known=q.v!=null,px=x(i),py=y(known?q.v:m.last.v),latest=!predicted&&q.d===m.last.d,first=!predicted&&q.d===m.first.d;
   var color=predicted?'var(--peach-text)':latest?'var(--danger)':'var(--accent)',anchor=i===0?'start':i===all.length-1?'end':'middle';
   s+='<circle cx="'+px+'" cy="'+py+'" r="4" stroke="'+color+'" stroke-width="1.7" fill="'+(predicted?'var(--surface-solid)':color)+'"><title>'+esc(q.d+' · '+(known?num(q.v)+'매':'예측 대기')+(predicted&&known?' · 예상 범위 '+num(q.lo)+'–'+num(q.hi)+'매':!predicted?' · 당일 순판매 '+q.delta+'매':''))+'</title></circle>';
   s+=text(px,py-12,known?num(q.v):'예측 대기',color,anchor);
   if(!predicted)s+=text(px,py-30,(q.delta>=0?'+':'')+num(q.delta),'var(--green)',anchor);
   var label=predicted?q.label:first?(m.hasActivity?(q.delta>0?'첫 판매 기록':'첫 변동 기록'):'판매 기록 없음'):latest?(q.d===m.today?'오늘':'최근 수집'):'';
   s+=text(px,20,label,color,anchor)+text(px,159,md(q.d),color,anchor);
   if(first&&latest&&m.hasActivity)s+=text(px,37,q.d===m.today?'오늘':'최근 수집',color,anchor);
  });
  return s+'</svg>';
 }
 function draw(m,width){
  var W=Number(width)>0?Number(width):900,budget=Math.max(2,Math.floor((W-32)/78)+1),split=m.future.length&&m.points.length+m.future.length>budget&&W<420;
  var shown=choose(m.points,Math.max(2,budget-(split?0:m.future.length))),html=panel(m,shown,split?[]:m.future,W);
  if(split){
   for(var i=0;i<m.future.length;i+=budget-1)html+=panel(m,[m.last],m.future.slice(i,i+budget-1),W);
  }
  var note=m.hasActivity?'조회 기간 '+m.historyStart+'부터 · 첫 변동 기록 '+m.first.d+' (등록 오픈일과 다를 수 있습니다)':'조회 기간 '+m.historyStart+'부터 · 수집된 순판매 변동이 없습니다';
  var details='';
  if(shown.length<m.points.length){details='<details class="ym-trend-detail"><summary title="일별 수치 보기" aria-label="일별 수치 보기">⋯</summary><div><table><thead><tr><th>거래일</th><th>누적 매수</th><th>당일 순판매</th></tr></thead><tbody>';m.points.forEach(function(q){details+='<tr><td>'+md(q.d)+'</td><td>'+num(q.v)+'</td><td>'+(q.delta>=0?'+':'')+num(q.delta)+'</td></tr>';});details+='</tbody></table></div></details>';}
  note+=' · 티켓셀러 개인·단체 합산 누적 순판매, 취소 반영 · 기준 '+m.last.d+(m.last.d<m.today?' (오늘 실적 미수집)':'')+' · '+(m.eligible?'완료된 최근 '+m.n+'일 평균 '+m.mean.toFixed(1)+'매/일 · 표준편차 '+m.sd.toFixed(1)+'매 · 음영은 95% 참고 예상 범위 (독립 일별 변동 가정, 보장값 아님)':'예상에는 완료된 일별 실적 7일 이상과 최신 수집 이력이 필요합니다.');
  return '<div data-ym-trend-fit="260910" title="'+esc(note)+'" style="position:relative;width:100%;min-width:0;padding:4px 0">'+html+details+'</div>';
 }
 function recent(p,rows,today){
  var ds=rows.filter(function(r){return String(r['프로그램ID'])===String(p._mid)&&r['거래일자']<=today;}).sort(function(a,b){return a['거래일자'].localeCompare(b['거래일자']);});
  if(!ds.length)return null;
  var last=ds[ds.length-1]['거래일자'],byDate={},start=add(last,-6);
  ds.forEach(function(r){var d=r['거래일자'];if(d<start)return;var raw=r['순판매매수'],v=Number(raw);if(byDate[d]!==undefined||raw==null||String(raw).trim()===''||!Number.isSafeInteger(v))throw Error('일별 이력 확인 필요');byDate[d]=v;});
  var slots=[];for(var i=0;i<7;i++){var d=add(start,i);slots.push({d:d,v:byDate[d]===undefined?null:byDate[d]});}
  return {slots:slots,last:last,today:today,start:start};
 }
 function bars(m){
  if(!m)return '<span class="ym-list-muted">일별 이력 없음</span>';
  var max=Math.max(1,...m.slots.map(function(q){return Math.abs(q.v||0);})),negative=m.slots.some(function(q){return q.v<0;}),base=negative?21:32,scale=negative?14:26;
  var label='최근 7일 순판매 · '+m.start+' ~ '+m.last+(m.last===m.today?' · 오늘':' · 오늘 미수집'),s='<svg data-ym-seven-bars="260910" viewBox="0 0 78 38" role="img" aria-label="'+esc(label)+'"><title>'+esc(label)+'</title>';
  if(negative)s+='<path d="M4 '+base+' H74" stroke="var(--muted)" stroke-width=".6" opacity=".4"/>';
  m.slots.forEach(function(q,i){
   var x=5+i*10,color=i===6?'var(--accent)':'var(--accent-light)',tip=q.d+' · '+(q.v===null?'미수집':(q.v>=0?'+':'')+num(q.v)+'매')+(i===6?(q.d===m.today?' · 오늘':' · 최근 수집'):'');
   s+='<g data-day="'+q.d+'" data-value="'+(q.v===null?'':q.v)+'" data-latest="'+(i===6)+'"><title>'+esc(tip)+'</title>';
   if(q.v===null)s+='<rect x="'+x+'" y="3" width="7" height="32" fill="transparent"/>';
   else if(q.v===0)s+='<path d="M'+x+' '+base+' h7" stroke="'+color+'" stroke-width="2"/>';
   else{var h=Math.max(2,Math.abs(q.v)/max*scale);s+='<rect x="'+x+'" y="'+(q.v>0?base-h:base)+'" width="7" height="'+h+'" rx="2" fill="'+color+'"/>';}
   s+='</g>';
  });
  return s+'</svg>';
 }
 function load(){if(job)return job;if(cache&&Date.now()-loaded<60000)return Promise.resolve(cache);job=api('GET','/api/ops?sheet='+encodeURIComponent('일별수집상태')+'&fresh=1').then(function(r){if(!r||!Array.isArray(r.rows))throw Error('일별 이력 응답 확인 필요');cache=r.rows;loaded=Date.now();return cache;}).finally(function(){job=null;});return job;}
 var resize=null,watched=new Map();
 function paint(node,data){
  function update(n,d){n.innerHTML=draw(d,n.clientWidth);if(g.YMDealSummary)g.YMDealSummary(n,d);}
  update(node,data);
  if(typeof ResizeObserver==='undefined')return;
  if(!resize)resize=new ResizeObserver(function(entries){entries.forEach(function(entry){var n=entry.target,state=watched.get(n);if(!n.isConnected){resize.unobserve(n);watched.delete(n);return;}if(state&&n.clientWidth>0&&Math.abs(n.clientWidth-state.width)>1){state.width=n.clientWidth;update(n,state.data);}});});
  watched.forEach(function(value,n){if(!n.isConnected){resize.unobserve(n);watched.delete(n);}});
  watched.set(node,{data:data,width:node.clientWidth});resize.observe(node);
 }
 function install(){var original=g._srailTrend;if(typeof original!=='function'||original.ymDailyLedger)return;
  function render(p){if(!p._mid)return original(p);var id='ym-deal-trend-'+(++seq);
   var html='<div style="padding:24px;color:var(--dim)">거래일별 판매 이력을 불러오는 중…</div>';
   load().then(function(rows){var node=document.getElementById(id);if(!node)return;try{var data=model(p,rows,day(new Date()));if(data){paint(node,data);}else node.innerHTML='<div style="padding:24px;color:var(--dim)">판매 일자별 이력을 아직 수집하지 않았습니다.</div>';}catch(e){node.innerHTML='<div style="padding:24px;color:var(--dim)">'+esc(e.message)+'</div>';}}).catch(function(){var node=document.getElementById(id);if(node)node.innerHTML='<div style="padding:24px;color:var(--dim)">판매 이력을 불러오지 못했습니다. 화면을 다시 열어주세요.</div>';});
   return '<div id="'+id+'" style="width:100%;min-width:0">'+html+'</div>';
  }render.ymDailyLedger=true;g._srailTrend=render;g.YMDealTrend={model:model,draw:draw,recent:recent,bars:bars,load:load};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);

(function(){var s=document.createElement("style");s.id="ym-detail-balanced";s.textContent="/* YM_DETAIL_SPACING_260910: fill the existing panel without clipping content. */\n#rail-yrm-list:has(.ry-detail){display:block!important;padding:0!important}\n#rail-yrm-list .ry-detail{position:relative;top:0!important;display:flex;flex-direction:column;box-sizing:border-box;zoom:var(--ym-detail-zoom,1);width:100%;max-width:none;height:var(--ym-detail-height,100%);min-height:0;padding:16px 18px 12px;container-type:inline-size}\n#rail-yrm-list .ry-detail-body{flex:1 1 auto;min-height:0;min-width:0}\n#rail-yrm-list .ry-detail-card{display:flex;flex-direction:column;height:100%;min-height:0;margin:0!important;padding:0!important;overflow:visible!important;background:transparent}\n#rail-yrm-list .ym-detail-main{display:flex;flex-direction:column;gap:12px;flex:1 1 auto;min-height:0;min-width:0}\n#rail-yrm-list .ym-detail-main .srail-r1{position:static;gap:10px;padding:0;flex-wrap:wrap;flex:none}\n#rail-yrm-list .ry-detail-card .srail-name{font-size:22px;line-height:1.35;white-space:normal;overflow-wrap:anywhere}\n#rail-yrm-list .ry-detail-card .srail-dday{font-size:12px;line-height:1.4}\n#rail-yrm-list .ym-detail-main .srail-detail-overview{position:static;align-self:flex-start;margin:0;font-size:12px;line-height:1.5;white-space:normal;overflow:visible}\n#rail-yrm-list .ym-detail-main .ym-primary-sales{margin:0;flex:none}\n#rail-yrm-list .ym-detail-main .ym-sales-kpis{gap:16px;margin-bottom:12px}\n#rail-yrm-list .ym-detail-main .ym-sales-kpi>span{margin-bottom:7px}\n#rail-yrm-list .ym-detail-main .srail-spark{display:flex;flex-direction:column;justify-content:center;flex:1 1 160px;min-height:90px;min-width:0;margin:0!important}\n#rail-yrm-list .ym-detail-main .srail-spark>div,#rail-yrm-list .ym-detail-main [data-ym-trend-fit]{display:flex;flex-direction:column;flex:1;min-height:0;width:100%;padding:0!important}\n#rail-yrm-list .ym-detail-main .srail-spark svg{display:block;flex:1;min-height:0;width:100%!important;height:100%!important;max-height:300px}\n#rail-yrm-list .ym-detail-main .srail-fc{flex:none;margin:0;padding:8px 10px;font-size:12px;line-height:1.5}\n#rail-yrm-list .ry-detail-card .bki-section{flex:1 0 auto;margin:18px 0 0;padding:16px 0 0}\n#rail-yrm-list .ry-detail-card .bki-section h3{font-size:18px;line-height:1.35;margin:0 0 12px}\n#rail-yrm-list .ry-detail-card .bki-grid{display:grid;grid-template-columns:minmax(0,.65fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr);gap:10px}\n#rail-yrm-list .bki-box:first-child{grid-row:auto}\n#rail-yrm-list .bki-box{line-height:1.35;min-width:0;overflow:visible;border-radius:8px}\n#rail-yrm-list .bki-tab{font-size:11px;line-height:1.35;white-space:normal;overflow-wrap:anywhere;max-width:100%;box-sizing:border-box}\n#rail-yrm-list .ry-detail-card .bki-box-body{padding:10px}\n#rail-yrm-list .bki-numbers{gap:8px}\n#rail-yrm-list .bki-numbers>div{justify-content:space-between;gap:6px;align-items:baseline}\n#rail-yrm-list .bki-numbers strong{font-size:24px;line-height:1.2;font-variant-numeric:tabular-nums;white-space:normal;overflow:visible;overflow-wrap:anywhere}\n#rail-yrm-list .bki-numbers span{font-size:11px;white-space:nowrap}\n#rail-yrm-list .ry-detail-card .bki-ages,#rail-yrm-list .bki-legend{gap:7px}\n#rail-yrm-list .ry-detail-card .bki-age-row{grid-template-columns:max-content minmax(12px,1fr) max-content;gap:5px;font-size:11px}\n#rail-yrm-list .ry-detail-card .ym-age-label{min-width:0;gap:6px}\n#rail-yrm-list .bki-rank-wrap{grid-template-columns:42px minmax(0,1fr);gap:6px}\n#rail-yrm-list .bki-donut{width:42px;height:42px}\n#rail-yrm-list .bki-donut:after{inset:10px}\n#rail-yrm-list .bki-legend-row span{white-space:normal;overflow:visible;overflow-wrap:anywhere;min-width:0}\n#rail-yrm-list .bki-legend-row b{flex:none;white-space:nowrap}\n#rail-yrm-list .bki-top3{margin-top:10px;font-size:11px;line-height:1.5;white-space:normal;overflow:visible;overflow-wrap:anywhere}\n#rail-yrm-list .ry-nav{flex:none;min-height:28px;padding:0;margin-top:10px}\n@container(max-width:520px){#rail-yrm-list .ry-detail-card .bki-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#rail-yrm-list .bki-box:first-child{grid-row:auto}#rail-yrm-list .ry-detail-card .bki-box-body{padding:7px 9px}#rail-yrm-list .bki-numbers{gap:5px}#rail-yrm-list .bki-numbers strong{font-size:21px}#rail-yrm-list .ry-detail-card .bki-ages,#rail-yrm-list .bki-legend{gap:5px}#rail-yrm-list .ym-detail-main{gap:9px}#rail-yrm-list .ry-detail-card .bki-section{margin-top:12px;padding-top:12px}#rail-yrm-list .ry-detail-card .bki-section h3{margin-bottom:8px}}\n@media(max-height:760px){#rail-yrm-list .ry-detail{height:auto;min-height:100%}#rail-yrm-list .ym-detail-main .srail-spark{flex-basis:130px}}\n\n#rail-yrm-list .ry-detail-card .bki-rank-wrap{grid-template-columns:minmax(64px,.75fr) minmax(0,1fr);gap:10px}\n#rail-yrm-list .ym-square-donut{display:block;width:100%;max-width:112px;height:auto;overflow:visible}\n#rail-yrm-list .ym-donut-total{font-size:17px;font-weight:800;fill:var(--text);font-variant-numeric:tabular-nums}\n#rail-yrm-list .ym-donut-unit{font-size:11px;fill:var(--dim)}\n#rail-yrm-list .ry-detail-card .bki-legend-row{display:grid;grid-template-columns:3px minmax(0,1fr) max-content;align-items:start;gap:6px;line-height:1.4;color:var(--text);font-size:11px}\n#rail-yrm-list .bki-legend-row>i{width:3px;height:14px;margin-top:1px;border-radius:3px}\n#rail-yrm-list .bki-legend-row>b{font-weight:700}\n#rail-yrm-list .bki-numbers strong{font-size:clamp(21px,2.8cqw,28px);white-space:nowrap;overflow-wrap:normal}\n@container(max-width:760px){#rail-yrm-list .ry-detail-card .bki-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}\n\n#rail-yrm-list .ym-trend-detail{position:absolute;right:0;top:0;z-index:3;font-size:11px;color:var(--dim)}#rail-yrm-list .ym-trend-detail>summary{list-style:none;cursor:pointer;padding:0 7px;border-radius:5px;background:var(--surface-solid);font-size:18px;line-height:22px}#rail-yrm-list .ym-trend-detail[open]{background:var(--surface-solid);border:1px solid var(--border);border-radius:8px;padding:8px;box-shadow:0 8px 24px #0f172a20}#rail-yrm-list .ym-trend-detail>div{max-height:230px;max-width:min(360px,70vw);overflow:auto}#rail-yrm-list .ym-trend-detail td,#rail-yrm-list .ym-trend-detail th{padding:5px 8px;white-space:nowrap}\n\n\n/* Consistent quiet hover feedback; keep the existing glass and category colors. */\n#app button,#app [role=\"button\"],#app tr[data-pkey],#app tr[data-y],#app .perf-badge,#app .ev,.ym-period-option{transition:background-color 150ms cubic-bezier(.4,0,.2,1),color 150ms cubic-bezier(.4,0,.2,1),border-color 150ms cubic-bezier(.4,0,.2,1),box-shadow 150ms cubic-bezier(.4,0,.2,1),filter 150ms cubic-bezier(.4,0,.2,1)}\n@media(hover:hover){#app button:not(:disabled):hover,#app [role=\"button\"]:hover{filter:brightness(.96)}#app tr[data-pkey]:hover,#app tr[data-y]:hover,#app .perf-badge:hover,#app .ev:hover,.ym-period-option:hover{box-shadow:inset 0 0 0 999px color-mix(in srgb,var(--accent) 6%,transparent)}.ym-biz-mark:hover .ym-biz-hover{fill:color-mix(in srgb,var(--accent) 5%,transparent)}}\n#app button:focus-visible,.ym-period-option:focus-visible{outline:2px solid var(--accent);outline-offset:3px}\n.ym-period-control{display:inline-flex;align-items:center;gap:3px}.ym-period-option{display:block;border:0;background:transparent;color:var(--text);width:100%;padding:9px 12px;text-align:left;cursor:pointer;border-radius:7px;font:inherit;font-size:12px}.ym-period-option[aria-selected=\"true\"]{color:var(--accent);background:color-mix(in srgb,var(--accent) 8%,transparent);font-weight:700}\n#bizov-chart{margin:6px 10px 4px!important}\n#biz-main .bizm-card:has(#bizov-chart)>.ct{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px 16px 4px}\n.ym-chart-legend{display:flex;align-items:center;gap:16px;font-size:10px;font-weight:400;color:var(--dim)}.ym-chart-legend>span{display:inline-flex;align-items:center;gap:5px}.ym-chart-legend i{height:11px;width:3px;border-radius:2px}.ym-chart-legend .line{height:2px;width:11px}.ym-business-chart text{font-variant-numeric:tabular-nums}.ym-business-chart .ym-biz-hover{transition:fill 150ms ease}\n#bizov-annual-table .ym-period-table[data-columns=\"17\"]{font-size:10px}#bizov-annual-table .ym-period-table[data-columns=\"17\"] td{padding-left:2px!important;padding-right:2px!important}#bizov-annual-table .ym-period-table[data-columns=\"17\"] td span{font-size:9px}\n#program-view-modal .modal-bg{padding:16px!important;display:flex;align-items:stretch;justify-content:flex-end;background:rgba(15,23,42,.14)!important;backdrop-filter:none!important}\n#program-view-modal .modal-bg>.modal{margin:0!important;width:min(480px,calc(100vw - 32px));max-width:560px!important;height:100%;max-height:100%!important;box-sizing:border-box;border:1px solid var(--border);border-radius:16px!important;box-shadow:0 14px 48px rgba(15,23,42,.17);animation:ym-detail-slide 180ms cubic-bezier(.2,.8,.2,1)}\n#program-view-modal .mhead{padding:22px 24px 18px;border-bottom:1px solid var(--border)}#program-view-modal .mv-section{margin-top:22px;margin-bottom:14px}#program-view-modal .mv-row{padding-top:9px;padding-bottom:9px;line-height:1.5}#program-view-modal .modal-x{top:14px;right:14px}\n@keyframes ym-detail-slide{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}\n@media(prefers-reduced-motion:reduce){#app button,#app [role=\"button\"],#app tr,#app .perf-badge,#app .ev,.ym-period-option,.ym-business-chart .ym-biz-hover{transition:none!important}#program-view-modal .modal{animation:none!important}}\n\n#biz-main[data-face=\"ov\"]>div,#rail-yrm>div:has(#bizov-year-list){zoom:var(--ym-business-zoom,1)}\n#bizov-year-list table[data-prog-rail=\"ov\"] col:nth-child(1){width:12%!important}#bizov-year-list table[data-prog-rail=\"ov\"] col:nth-child(2){width:6%!important}#bizov-year-list table[data-prog-rail=\"ov\"] col:nth-child(3){width:7%!important}#bizov-year-list table[data-prog-rail=\"ov\"] col:nth-child(4){width:30%!important}#bizov-year-list table[data-prog-rail=\"ov\"] col:nth-child(5){width:8%!important}#bizov-year-list table[data-prog-rail=\"ov\"] col:nth-child(6),#bizov-year-list table[data-prog-rail=\"ov\"] col:nth-child(7){width:12%!important}#bizov-year-list table[data-prog-rail=\"ov\"] col:nth-child(8){width:8%!important}#bizov-year-list table[data-prog-rail=\"ov\"] col:nth-child(9){width:5%!important}\n#bizov-year-list table[data-prog-rail=\"ov\"] td{padding-left:7px!important;padding-right:7px!important}#bizov-year-list table[data-prog-rail=\"ov\"] td:nth-child(4){padding-left:30px!important;white-space:normal!important;overflow-wrap:anywhere;line-height:1.45}#bizov-year-list table[data-prog-rail=\"ov\"] td:nth-child(4)>span[title]{left:7px!important}\n\n#biz-main[data-face=\"ov\"],#rail-yrm:has(#bizov-year-list){height:var(--ym-biz-shell-height)!important}\n#biz-main[data-face=\"ov\"]>div,#rail-yrm>div:has(#bizov-year-list){height:var(--ym-biz-inner-height)!important;display:flex;flex-direction:column}\n#biz-main[data-face=\"ov\"] [data-bizmhead],#rail-yrm:has(#bizov-year-list) [data-bizmhead]{flex:0 0 auto}\n#biz-main[data-face=\"ov\"] [data-bizmbox],#rail-yrm:has(#bizov-year-list) [data-bizmbox]{height:auto!important;flex:1;min-height:0;display:flex;flex-direction:column;gap:14px;overflow:auto!important;scrollbar-gutter:auto!important}\n#biz-main[data-face=\"ov\"] [data-bizmbox]>.bizm-strip{flex:none;margin:0!important}\n#biz-main[data-face=\"ov\"] .bizm-card:has(#bizov-chart){flex:1;min-height:230px;display:flex;flex-direction:column;margin:0!important}\n#biz-main[data-face=\"ov\"] #bizov-chart{height:auto!important;min-height:170px;flex:1}\n#biz-main[data-face=\"ov\"] #bizov-annual-table,#biz-main[data-face=\"ov\"] [data-bizmbox]>.bizm-card:not(:has(#bizov-chart)){height:auto!important;max-height:none!important;min-height:0!important;overflow:visible!important;flex:none;margin:0!important}\n#bizov-annual-table>.bizm-card{min-height:0!important;margin:0!important}#bizov-tscroll{overflow:visible!important}#bizov-tscroll table{width:calc(100% - 24px)!important;margin:0 12px!important}#bizov-annual-table .bizm-ctbl td{padding-top:12px!important;padding-bottom:12px!important}\n#rail-yrm:has(#bizov-year-list) [data-bizmfill]{flex:1;min-height:0!important;max-height:none!important}#bizov-year-list{flex:1;min-height:0!important;overflow:auto}\n\n.ym-business-chart{display:block}#bizov-annual-table .ym-period-table[data-columns=\"17\"] td{font-size:12px!important}#bizov-annual-table .ym-period-table[data-columns=\"17\"] thead td{font-size:11px!important}\n";document.head.appendChild(s);})();

/* YM_PRIMARY_SALES_260910 */
(function(g){
 function install(){var prev=g._ryDrillCardHtml;if(typeof prev!=='function'||prev.ymPrimarySales)return;
function squareRankBox(title,map,pal){
 var items=Object.keys(map||{}).map(function(k){return {label:k,value:Number(map[k])};}).filter(function(x){return Number.isFinite(x.value)&&x.value>0;}).sort(function(a,b){return b.value-a.value;}),total=items.reduce(function(s,x){return s+x.value;},0),esc=g.YMUI.escapeText;
 if(!total)return '<div class="bki-box"><div class="bki-tab">'+esc(title)+'</div><div class="bki-box-body">자료 없음</div></div>';
 var off=0,arcs='',legend='';items.forEach(function(x,i){var pct=x.value/total*100,color=pal[i]||pal[pal.length-1],gap=Math.min(.6,pct/3);arcs+='<circle cx="60" cy="60" r="44" pathLength="100" fill="none" stroke="'+color+'" stroke-width="18" stroke-dasharray="'+(pct-gap)+' '+(100-pct+gap)+'" stroke-dashoffset="'+(-off)+'" transform="rotate(-90 60 60)"><title>'+esc(x.label)+' '+x.value.toLocaleString()+'매 · '+pct.toFixed(1)+'%</title></circle>';off+=pct;if(i<5)legend+='<div class="bki-legend-row" title="'+esc(x.label)+' '+x.value.toLocaleString()+'매"><i style="background:'+color+'"></i><span>'+esc(x.label)+'</span><b>'+pct.toFixed(1)+'%</b></div>';});
 var center=total.toLocaleString();return '<div class="bki-box"><div class="bki-tab">'+esc(title)+'</div><div class="bki-box-body"><div class="bki-rank-wrap"><svg class="ym-square-donut" viewBox="0 0 120 120" role="img" aria-label="'+esc(title)+' '+center+'매">'+arcs+'<text x="60" y="59" text-anchor="middle" dominant-baseline="middle" class="ym-donut-total">'+center+'</text><text x="60" y="77" text-anchor="middle" class="ym-donut-unit">매</text></svg><div class="bki-legend">'+legend+'</div></div></div></div>';
}
 g._bkiNewRankBox=squareRankBox;
 function render(p){var html=prev(p);if(!html)return html;
 var t=document.createElement('template');t.innerHTML=html;var card=t.content.querySelector('.ry-detail-card');if(!card)return html;
 var group=Number(p.groupSeats),personal=p.personalSeats==null?null:Number(p.personalSeats),total=Number(p.seats),cap=Number(p.totalOpen);
 if(p._kind!=='ex'&&Number.isFinite(group)&&Number.isFinite(personal)&&group>=0&&personal>=0){total=personal+group;var pct=cap>0?total/cap*100:null,box=document.createElement('section');box.className='ym-primary-sales';box.setAttribute('aria-label','개인 단체 총 판매 실적');
 function n(v){return Number(v).toLocaleString();}function item(label,value,unit,cls){return '<div class="ym-sales-kpi '+cls+'"><span>'+label+'</span><div><strong>'+value+'</strong><small>'+unit+'</small></div></div>';}
 box.innerHTML='<div class="ym-sales-kpis">'+item('개인',n(personal),'매','personal')+item('단체',n(group),'매','group')+item('총 판매',n(total),'매','total')+item('판매율',pct===null?'—':pct.toFixed(1),pct===null?'':'%','rate')+'</div><div class="ym-sales-gauge" role="meter" aria-label="단체 포함 판매율" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+(pct===null?0:Math.min(100,pct))+'"><i style="width:'+(pct===null?0:Math.min(100,personal/cap*100))+'%"></i><b style="width:'+(pct===null?0:Math.min(Math.max(0,100-personal/cap*100),group/cap*100))+'%"></b></div><div class="ym-sales-caption"><span>개인 + 단체 · 등록 오픈석 '+n(cap)+'매 기준</span><span>단체 중 결제 예정 '+n(Number(p.groupPending)||0)+'매'+(p.groupAsOf?' · 기준 '+String(p.groupAsOf).replace(/^(....)(..)(..)$/,'$1.$2.$3'):'')+'</span></div>';
 var overview=card.querySelector('.srail-detail-overview');if(overview)overview.after(box);else card.prepend(box);
 card.querySelectorAll(':scope > .ym-ui-meta,:scope > .srail-occrow,:scope > .srail-bar').forEach(function(n){n.remove();});
 }
 var info=typeof _bkiOf==='function'?_bkiOf(p.name):null,ages=info&&info['연령대_매수'];
 if(ages){var data=[['10·20대',(+ages['10대이하']||0)+(+ages['20대']||0)],['30대',+ages['30대']||0],['40대',+ages['40대']||0],['50대',+ages['50대']||0],['60대 이상',+ages['60대이상']||0]],sum=data.reduce(function(s,x){return s+x[1];},0);card.querySelectorAll('.bki-age-row').forEach(function(row,i){var d=data[i];if(!d)return;var pct=sum?d[1]/sum*100:0;row.innerHTML='<span class="ym-age-label">'+d[0]+' <b>'+pct.toFixed(1)+'%</b></span><i><b style="width:'+pct.toFixed(1)+'%"></b></i><strong>'+d[1].toLocaleString()+'<small> 매</small></strong>';});var ab=card.querySelector('.bki-ages')?.previousElementSibling;if(ab)ab.textContent='연령대 · 확인 '+sum.toLocaleString()+'매';}
 
 card.removeAttribute('title');var capNote=card.querySelector('.ym-sales-caption');if(capNote){card.querySelector('.ym-primary-sales').title=capNote.textContent;capNote.remove();}
 var bh=card.querySelector('.bki-section h3');if(bh){bh.title='개인 예매 건 기준 (단체 예매 제외)';var bl=bh.querySelector('span[style]');if(bl)bl.textContent='예매자 정보';}
 var main=document.createElement('div');main.className='ym-detail-main';var bi=card.querySelector('.bki-section');while(card.firstChild&&card.firstChild!==bi)main.appendChild(card.firstChild);card.prepend(main);

 return t.innerHTML;
 }
 render.ymPrimarySales=true;g._ryDrillCardHtml=render;
var detailHost=null,detailFrame=0,detailResize=new ResizeObserver(queueDetailLayout);
 function queueDetailLayout(){if(!detailFrame)detailFrame=requestAnimationFrame(layoutDetail);}
 function layoutDetail(){detailFrame=0;var list=document.getElementById('rail-yrm-list'),d=list&&list.querySelector('.ry-detail');if(!d)return;
 if(detailHost!==list){detailResize.disconnect();detailHost=list;detailResize.observe(list);}
 var rect=list.getBoundingClientRect(),z=list.offsetWidth/rect.width,height=list.clientHeight/z;if(!Number.isFinite(height)||height<=0)return;
 function prop(k,v){if(d.style.getPropertyValue(k)!==v)d.style.setProperty(k,v);}prop('--ym-detail-zoom',String(z));prop('--ym-detail-height',height+'px');
 var card=d.querySelector('.ry-detail-card'),main=card&&card.querySelector('.ym-detail-main'),bki=card&&card.querySelector('.bki-section'),left=document.getElementById('yrm-tbl');if(!main||!bki||!left)return;
 main.style.flex='1 1 auto';var gap=parseFloat(getComputedStyle(main).gap)||0,minMain=Array.from(main.children).reduce(function(s,e){return s+(e.classList.contains('srail-spark')?145:e.offsetHeight);},0)+Math.max(0,main.children.length-1)*gap;
 var pad=parseFloat(getComputedStyle(bki).paddingTop)||0,info=Array.from(bki.children).reduce(function(s,e){var cs=getComputedStyle(e);return s+e.offsetHeight+(parseFloat(cs.marginTop)||0)+(parseFloat(cs.marginBottom)||0);},0)+pad+1,margin=parseFloat(getComputedStyle(bki).marginTop)||0,maxMain=card.clientHeight-info-margin;
 var target=(left.getBoundingClientRect().top+18-card.getBoundingClientRect().top)-margin;
 var mainHeight=Math.max(minMain,Math.min(maxMain,target));main.style.flex='0 0 '+Math.round(mainHeight)+'px';
 var needed=mainHeight+info+margin+height-card.clientHeight;if(needed>height+1)prop('--ym-detail-height',Math.ceil(needed)+'px');
 }
 var detailRoot=document.getElementById('app');if(detailRoot)new MutationObserver(queueDetailLayout).observe(detailRoot,{childList:true,subtree:true});window.addEventListener('resize',queueDetailLayout,{passive:true});queueDetailLayout();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
 var style=document.createElement('style');style.textContent=
 '#rail-yrm-list .ry-back-inline{margin-bottom:22px!important}'+
 '#rail-yrm-list .ry-detail{padding-top:12px;padding-bottom:8px}'+
 '#rail-yrm-list .ym-primary-sales{margin:10px 0 8px}'+
 '#rail-yrm-list .ym-sales-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:8px}'+
 '#rail-yrm-list .ym-sales-kpi>span{display:block;font-size:13px;font-weight:600;color:var(--dim);margin-bottom:4px}'+
 '#rail-yrm-list .ym-sales-kpi>div{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}'+
 '#rail-yrm-list .ym-sales-kpi strong{font-size:clamp(28px,3.2cqw,42px);line-height:1.12;font-variant-numeric:tabular-nums;color:var(--accent);overflow-wrap:anywhere;min-width:0}'+
 '#rail-yrm-list .ym-sales-kpi.group strong{color:var(--peach-text)}'+
 '#rail-yrm-list .ym-sales-kpi small{font-size:13px;color:var(--dim)}'+
 '#rail-yrm-list .ym-sales-gauge{display:flex;height:6px;border-radius:8px;overflow:hidden;background:var(--border)}'+
 '#rail-yrm-list .ym-sales-gauge i{background:var(--accent)}#rail-yrm-list .ym-sales-gauge b{background:var(--peach-text)}'+
 '#rail-yrm-list .ym-sales-caption{display:flex;justify-content:space-between;gap:6px 18px;flex-wrap:wrap;font-size:11px;line-height:1.6;color:var(--dim);margin-top:4px}'+
 '#rail-yrm-list .bki-age-row{grid-template-columns:max-content minmax(22px,1fr) max-content;gap:12px}'+
 '#rail-yrm-list .ym-age-label{display:flex;gap:8px;align-items:baseline;min-width:118px}'+
 '#rail-yrm-list .ym-age-label b{font-variant-numeric:tabular-nums}#rail-yrm-list .bki-age-row strong{white-space:nowrap}#rail-yrm-list .bki-age-row small{font-size:11px;font-weight:400}'+
 '#rail-yrm-list .bki-section{margin-top:10px;padding-top:10px}#rail-yrm-list .bki-section h3{margin-bottom:8px}#rail-yrm-list .bki-box-body{padding:8px 10px}#rail-yrm-list .bki-ages{gap:5px}#rail-yrm-list .ry-nav{padding-top:8px}'+
 '@container(max-width:760px){#rail-yrm-list .bki-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#rail-yrm-list .ym-sales-kpis{gap:12px}#rail-yrm-list .ym-sales-kpi strong{font-size:28px}}'+
 '@media(max-height:850px){#rail-yrm-list .ym-primary-sales{margin:12px 0 8px}#rail-yrm-list .bki-section{margin-top:10px;padding-top:10px}#rail-yrm-list .bki-box-body{padding:8px 10px}#rail-yrm-list .bki-ages{gap:6px}#rail-yrm-list .ry-nav{padding-top:8px}}';style.textContent+='@container(min-width:760px) and (max-width:1000px){#rail-yrm-list .bki-rank-wrap{grid-template-columns:48px minmax(0,1fr);gap:6px}#rail-yrm-list .bki-donut{width:48px;height:48px}#rail-yrm-list .bki-donut:after{inset:11px}}';style.id='ym-primary-sales-style';document.head.appendChild(style);
})(window);

(function(g){g.YMDealSummary=function(node,m){var card=node.closest('.ry-detail-card');if(!card)return;var box=card.querySelector('.srail-fc');if(!box)return;box.replaceChildren();var b=document.createElement('b');b.textContent='판매 예상 ';box.appendChild(b);var text;if(!m.future.length)text='판매 종료일 이후의 예상은 표시하지 않습니다.';else if(!m.eligible)text='예상 계산에 필요한 완료 일별 실적 또는 최신 수집 이력이 부족합니다.';else text=m.future.map(function(q){return q.label+' ('+Number(q.d.slice(5,7))+'/'+Number(q.d.slice(8))+') '+q.v.toLocaleString()+'매';}).join(' · ');box.appendChild(document.createTextNode(text));box.title='차트와 동일한 통계 예상값 · 티켓셀러 개인·단체 합산 순판매 기준';};})(window);

(function(){var s=document.createElement("style");s.textContent="#rail-yrm-list .ym-sales-kpi>span{font-weight:800}#rail-yrm-list .ym-sales-kpi.personal strong,#rail-yrm-list .ym-sales-kpi.personal small{color:var(--accent)}#rail-yrm-list .ym-sales-kpi.group strong,#rail-yrm-list .ym-sales-kpi.group small{color:var(--peach-text)}#rail-yrm-list .ym-sales-kpi.rate strong,#rail-yrm-list .ym-sales-kpi.rate small{color:var(--green)}";document.head.appendChild(s);})();

/* YM_PANEL_AUTO_MODE_260910: automatic date panels belong to calendar mode. */
(function(g){
  function install(){
    var auto=g._panelAutoOpen;
    if(typeof auto!=='function'||auto.ymModeOnly)return;
    function modeOnly(){
      if(typeof _panelSticky!=='function'||!_panelSticky())return;
      return auto.apply(this,arguments);
    }
    modeOnly.ymModeOnly=true;
    g._panelAutoOpen=modeOnly;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);

/* YM_SECONDARY_BACK_260910 */
(function(g){var savedScroll=0;
function mark(b){if(b.dataset.ymBack)return;b.dataset.ymBack='1';b.classList.add('ym-back-readable');b.setAttribute('aria-label','뒤로 · 이전 화면');b.title='뒤로 · 이전 화면';}
function programBoard(root){if(!root)return null;var board=root.querySelector('[data-program-board]')||root.firstElementChild;if(!board||!board.querySelector('#rail-yrm-list'))return null;if(!board.hasAttribute('data-program-board'))board.setAttribute('data-program-board','');return board;}
function scan(){document.querySelectorAll('button.modal-x[title="뒤로"],button.modal-x[aria-label="뒤로"],button.ry-back-x').forEach(function(b){mark(b);if(!b.classList.contains('ry-back-x'))return;var root=b.closest('#rail-yrm'),board=programBoard(root);if(board&&root.querySelector('#rail-yrm-list .ry-detail')){if(!b.classList.contains('ym-edge-back'))b.classList.add('ym-edge-back');if(b.parentElement!==board)board.appendChild(b);}});}
function install(){if(!g._ryBackBtn||g._ryBackBtn.ymReadable)return;var paint=g._ryDrillPaint,close=g._ryDrillClose,home=g._ryRailHome;
g._ryDrillPaint=function(){var b=document.getElementById('rail-yrm-list');if(b&&!_ryDrill.key)savedScroll=b.scrollTop;return paint.apply(this,arguments);};
g._ryDrillClose=function(){var r=close.apply(this,arguments),b=document.getElementById('rail-yrm-list');if(b){b.scrollTop=savedScroll;requestAnimationFrame(function(){if(!_ryDrill.key&&b.isConnected)b.scrollTop=savedScroll;});}return r;};
g._ryRailHome=function(){if(_ryDrill.key)return g._ryDrillClose(1);return home.apply(this,arguments);};
var back=function(box,on){if(!box)return;var root=box.closest('#rail-yrm'),ct=box.parentElement.querySelector(':scope > .ct')||(root&&root.querySelector('[data-bizmhead],.ct'));if(!ct)return;var tools=ct.querySelector('.ry-hd-tools');if(tools)tools.style.display=on?'none':'inline-flex';(root||ct).querySelectorAll('.ry-back-x').forEach(function(b){b.remove();});if(!on)return;var b=document.createElement('button');b.type='button';b.className='modal-x ry-back-x';b.textContent='‹';b.onclick=function(e){e.stopPropagation();g._ryDrillClose(1);};mark(b);var board=programBoard(root);if(board){b.classList.add('ym-edge-back');board.appendChild(b);}else ct.appendChild(b);var title=ct.querySelector('.ry-title-home');if(title){title.setAttribute('role','button');title.tabIndex=0;title.setAttribute('aria-label','프로그램 목록으로');title.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();g._ryRailHome();}};}};back.ymReadable=true;g._ryBackBtn=back;scan();if(_ryDrill.key)back(document.getElementById('rail-yrm-list'),1);}
var s=document.createElement('style');s.textContent='#rail-yrm-list .ry-back-inline{display:none!important}#rail-yrm-list .ry-detail{padding-top:12px!important}.ym-back-readable{overflow:visible!important}.ym-back-readable::after{content:"뒤로";position:absolute;right:calc(100% + 8px);top:50%;transform:translateY(-50%);font-size:12px;font-weight:700;line-height:1.3;font-family:inherit;color:var(--text);white-space:nowrap}.ct>.modal-x.ry-back-x,[data-bizmhead]>.modal-x.ry-back-x{display:inline-flex!important;align-items:center;justify-content:center;top:6px;right:14px;width:36px;height:36px;font-size:26px;line-height:1;z-index:6}.ct:has(>.ry-back-x),[data-bizmhead]:has(>.ry-back-x){position:relative;padding-right:96px!important}.ym-back-readable:focus-visible{outline:2px solid var(--accent);outline-offset:4px}';document.head.appendChild(s);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();var pending=false;new MutationObserver(function(){if(pending)return;pending=true;queueMicrotask(function(){pending=false;scan();});}).observe(document.documentElement,{childList:true,subtree:true});
})(window);

/* YM_LEFT_EDGE_BACK_260910 */
(function(){var s=document.createElement("style");s.textContent="[data-program-board]>.ym-edge-back{position:absolute!important;left:2px!important;right:auto!important;top:50%!important;transform:translateY(-50%)!important;width:40px!important;height:40px!important;display:flex!important;align-items:center;justify-content:center;margin:0!important;font-size:28px!important;line-height:1;z-index:12;background:var(--surface-glass,rgba(255,255,255,.82));backdrop-filter:blur(12px);box-shadow:var(--glass-shadow,0 3px 14px rgba(0,0,0,.12));border:1px solid var(--glass-border,rgba(255,255,255,.7));border-radius:50%}[data-program-board]>.ym-edge-back::after{right:auto;left:50%;top:calc(100% + 6px);transform:translateX(-50%);font-size:11px;line-height:1.3}[data-program-board]:has(>.ym-edge-back) #rail-yrm-list .ry-detail{padding-left:34px}";document.head.appendChild(s);})();

/* YM_SALES_FILTER_260910: one program table; live is a filter, never a second layout. */
(function(g){
function install(){
 if(g.YMSalesFilter)return;
 if(typeof g._progRailTableHtml!=='function'||typeof g._bizCompRender!=='function')return;
 function replaceOne(source,from,to){if(source.split(from).length!==2)throw new Error('Sales filter source mismatch: '+from.slice(0,60));return source.replace(from,to);}
 var source=g._progRailTableHtml.toString();
 source=replaceOne(source,"years=(pick==='all'?ys:[pick]).filter","years=(pick==='all'&&window._bizOvVisibleYears?window._bizOvVisibleYears():pick==='all'?ys:[pick]).filter");
 source=replaceOne(source,"var on=(typeof _programTypesOn==='function')?_programTypesOn():[_programTypeFilter||'공연'];","var on=(opt&&opt.cats)?opt.cats:((typeof _programTypesOn==='function')?_programTypesOn():[_programTypeFilter||'공연']);");
 source=replaceOne(source,'rent=!!window._progRentOn;','rent=(opt&&opt.rent!==undefined)?!!opt.rent:!!window._progRentOn;');
 source=replaceOne(source,"var heads=(mode==='ov')?","if(mode==='sales'&&opt&&opt.liveOnly)groups=window.YMSalesFilter.filterGroups(groups);\n  var heads=(mode==='ov')?");
 source=replaceOne(source,"h+='</tbody></table>';","if(!groups.length)h+='<tr><td colspan=\"9\" class=\"rail-yrm-empty\">'+(opt&&opt.liveOnly?'지금 판매·진행 중인 기획 프로그램이 없습니다.':'표시할 프로그램이 없습니다.')+'</td></tr>';\n  h+='</tbody></table>';");
 source=replaceOne(source,'if(it.grp){ _ri++;','if(it.grp){ window.YMSalesFilter.initGroup(it.grp,y); _ri++;');
 var makeTable=(0,eval)('('+source+')'),boardSource=g._bizCompRender.toString();
 var start=boardSource.indexOf('  if(_salesDeck&&half===2){'),end=boardSource.indexOf('   if(!all.length)',start);
 if(start<0||end<start)throw new Error('Sales board source mismatch');
 boardSource=boardSource.slice(0,start)+'  if(_salesDeck&&half===2)return window.YMSalesFilter.renderBoard(el,TTL,PROGRAM_LEGEND,SUB,DOTS);\n'+boardSource.slice(end);
 var renderBoardBase=(0,eval)('('+boardSource+')');
 var oldTable=g._railYrmTableHtml,oldClick=g._progRailRowClick,scroll=[0,0];
 function isSales(){return g._bizDeck==='sales';}
 function norm(v){return String(v||'').replace(/[\s<>〈〉《》]/g,'').toLowerCase();}
 function candidates(){
  var year=g._ryNowYear(),genre=g._bizmState.genreFilter;
  return (g._railYrmActives||[]).filter(function(p){
   if(!p||p._past)return false;
   var span=g._ryRowSpan(p);if(span&&(span.s>year||span.e<year))return false;
   if(p._kind!=='ex'&&g._ryNotYetSold(p))return false;
   return !genre||(p.genre||'기타')===genre;
  });
 }
 function match(row,items){
  var id=String(row.pid||''),names=[row.name],pm=row.pm;
  if(pm){names.push(pm.앱_프로그램명);if(Array.isArray(pm.별칭))names=names.concat(pm.별칭);}
  names=names.filter(Boolean).map(norm);
  return items.find(function(p){var pid=String(p._mid||p.id||'');return (id&&pid&&id===pid)||names.indexOf(norm(p.name))>=0;});
 }
 function initGroup(group,year){
  var key=group.code+'|'+year,open=g._progRailGrpOpen;
  if(!open||Object.prototype.hasOwnProperty.call(open,key))return;
  if(group.rows.some(function(row){if(typeof g._prSharedCells==='function')g._prSharedCells(row);return row._st==='판매 중'||row._st==='진행 중';}))open[key]=true;
 }
 function exhibitionStatus(exhib,today){
  if(exhib.status!=='notyet')return exhib;
  var start=g._salesDate(exhib.시작일),end=g._salesDate(exhib.종료일);
  if(!start||!end||start>today||end<today)return exhib;
  var measured=(exhib.daily||[]).some(function(row){return ['누계유료','누계총인원','누계금액'].some(function(key){var value=row[key];return value!==null&&value!==undefined&&String(value).trim()!==''&&Number.isFinite(Number(String(value).replace(/,/g,'')));});});
  return measured?Object.assign({},exhib,{status:'active',_statusFromCollectedData:true}):exhib;
 }
 var oldExhibBuild=g._anaExhibBuild;
 if(typeof oldExhibBuild==='function')g._anaExhibBuild=function(){var today=new Date();today.setHours(0,0,0,0);return oldExhibBuild.apply(this,arguments).map(function(exhib){return exhibitionStatus(exhib,today);});};
 function collectedNumber(value){if(value===null||value===undefined||String(value).trim()==='')return null;var n=Number(String(value).replace(/,/g,''));return Number.isFinite(n)?n:null;}
 var oldBizExhibRows=g._bizExhibRows;
 if(typeof oldBizExhibRows==='function')g._bizExhibRows=function(year){
  var rows=oldBizExhibRows.apply(this,arguments);if(!rows)return rows;var exhibs=g._anaExhibBuild();
  return rows.map(function(row){var exhib=exhibs.find(function(e){return e.name===row.name&&e.year===year;});if(!exhib)return row;
   var next=Object.assign({},row,{_pid:exhib.id});
   if(exhib.status!=='active'||!exhib.daily.length)return next;
   var last=exhib.daily[exhib.daily.length-1],total=collectedNumber(last.누계총인원),paid=collectedNumber(last.누계유료),free=collectedNumber(last.누계무료),revenue=collectedNumber(last.누계금액);
   if(total===null&&paid!==null&&free!==null)total=paid+free;
   if(total!==null){next.paid=total;next._sold=total;if(next.seat>0)next.avg=total/next.seat*100;}
   if(revenue!==null)next._rev=revenue;
   return next;
  });
 };
 function filterGroups(groups){
  var items=candidates();
  return groups.map(function(group){return {y:group.y,rows:group.rows.filter(function(row){return row.gu==='기획'&&!!match(row,items);})};}).filter(function(group){return group.rows.length;});
 }
 function table(mode,opt){
  if(mode==='sales'&&isSales()&&g._programSalesMode)opt=Object.assign({},opt,{yearSel:g._ryNowYear(),cats:['공연','전시','예술교육'],rent:false,liveOnly:true});
  return makeTable(mode,opt);
 }
 function html(){return table('sales',{yearSel:g._ryYearSel()});}
 function host(root){return (root||document.getElementById('rail-yrm'))?.querySelector('.biz-detail-scroll')||null;}
 function sync(){if(g.YMSquareUI)g.YMSquareUI.syncSales();document.querySelectorAll('.ym-sales-filter').forEach(function(label){label.dataset.active=g._programSalesMode?'true':'false';var input=label.querySelector('input');if(input)input.checked=!!g._programSalesMode;});}
 function paint(root){
  var box=host(root);if(!box)return false;
  box.id='rail-yrm-list';
  if(g._ryDrill&&g._ryDrill.key){sync();return true;}
  var top=box.scrollTop,left=box.scrollLeft,template=document.createElement('template');template.innerHTML=html();
  var next=template.content.querySelector('table[data-prog-rail]'),current=box.querySelector('table[data-prog-rail]');
  if(current&&next&&current.tBodies[0]&&next.tBodies[0]){
   if(current.tHead.innerHTML!==next.tHead.innerHTML)current.tHead.innerHTML=next.tHead.innerHTML;
   if(current.tBodies[0].innerHTML!==next.tBodies[0].innerHTML)current.tBodies[0].replaceWith(next.tBodies[0]);
  }else box.replaceChildren(template.content);
  box.scrollTop=top;box.scrollLeft=left;sync();return true;
 }
 function renderBoard(el,title,legend,sub,dots){
  if(paint(el))return;
  var body='<div data-bizmfill data-bizmcap style="min-height:0;border:1px solid var(--border);border-radius:12px;background:var(--surface-solid);display:flex;flex-direction:column;overflow:hidden"><div id="rail-yrm-list" class="ry-grp-bd biz-detail-scroll" style="min-height:0;overflow-x:auto;overflow-y:auto">'+html()+'</div></div>';
  g._bizmSwap(el,'<div data-program-board style="position:relative">'+g._bizmHead(legend,title,sub)+g._BIZM_BOX+body+'</div>'+dots+'</div>');
  sync();
 }
 function toggle(checked){
  var next=typeof checked==='boolean'?checked:!g._programSalesMode;if(next===g._programSalesMode)return;
  var box=host();if(box)scroll[g._programSalesMode?1:0]=box.scrollTop;
  if(g._ryDrill&&g._ryDrill.key){g._ryDrill.key='';if(box)g._ryBackBtn(box,0);}
  g._programSalesMode=next;
  if(!paint())g._railYrmRender();
  box=host();if(box)box.scrollTop=scroll[next?1:0];sync();
 }
 function title(text){return '<span class="ry-title-home" role="button" tabindex="0" onclick="_ryRailHome()" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();_ryRailHome();}" title="프로그램 목록으로 돌아가기">'+text+'</span>'+g.YMSquareUI.switchHtml(!!g._programSalesMode);}
 function openRow(tr){
  if(isSales()){
   var name=tr.getAttribute('data-pname'),year=Number(tr.getAttribute('data-pyear'));
   var p=match({pid:tr.getAttribute('data-pkey'),name:name},candidates());
   if(p&&year===g._ryNowYear()&&host()){g._railYrmPick(p._kind==='ex'?'ex':'perf',p._kind==='ex'?(p.id||p.name):p.name);return;}
  }
  return oldClick.apply(this,arguments);
 }
 g.YMSalesFilter={initGroup:initGroup,exhibitionStatus:exhibitionStatus,filterGroups:filterGroups,renderBoard:renderBoard,paint:paint};
 g._progRailTableHtml=table;g._bizCompRender=renderBoardBase;g._programTitle=title;g._programSalesToggle=toggle;
 g._bizSalesDetailRefresh=function(){return paint();};g._progRailRowClick=openRow;
 g._railYrmTableHtml=function(){return isSales()?html():oldTable.apply(this,arguments);};
 g._bizSalesRowPick=function(name){var p=match({name:name},candidates());if(!p)return;if(!host())g._railYrmRender();g._railYrmPick(p._kind==='ex'?'ex':'perf',p._kind==='ex'?(p.id||p.name):p.name);};
 var style=document.createElement('style');style.id='ym-sales-filter-style';style.textContent='#rail-yrm table[data-prog-rail="sales"]{min-width:860px}#rail-yrm table[data-prog-rail="sales"] col:nth-child(9){width:24px!important}#rail-yrm table[data-prog-rail="sales"] td:nth-child(9){padding-left:4px!important;padding-right:4px!important}#rail-yrm table[data-prog-rail="sales"] td:nth-child(4),#rail-yrm table[data-prog-rail="sales"] .pr-group-label{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:anywhere}#rail-yrm .ym-sales-filter{display:inline-flex;align-items:center;gap:7px;margin-left:12px;padding:4px 8px;min-height:30px;box-sizing:border-box;border-radius:7px;color:var(--muted);background:var(--past-bg);font-size:14px;font-weight:700;line-height:1.4;vertical-align:middle;cursor:pointer}#rail-yrm .ym-sales-filter[data-active="true"]{color:var(--green);background:color-mix(in srgb,var(--green) 10%,transparent)}#rail-yrm .ym-sales-filter input{appearance:auto;display:block;flex:0 0 18px;width:18px;height:18px;margin:0;accent-color:var(--green);cursor:pointer}#rail-yrm .ym-sales-filter:focus-within{outline:2px solid var(--green);outline-offset:2px}#rail-yrm .ry-title-home{cursor:pointer}';document.head.appendChild(style);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);

/* YM_CHART_LIFECYCLE_260910: serialize dashboard plots and defer purge until rendering settles. */
(function(){function install(){var P=window.Plotly;if(!P)return false;if(P.ymDashboardLifecycle)return true;var pending=new WeakMap(),base={react:P.react,newPlot:P.newPlot,purge:P.purge};function node(x){return typeof x==='string'?document.getElementById(x):x;}function scoped(n){return n&&/^(yrm-chart|bizov-chart|bizm-chart|bizm-ex-chart|bizm-edu-chart)$/.test(n.id);}
['react','newPlot'].forEach(function(method){P[method]=function(){var args=Array.prototype.slice.call(arguments),n=node(args[0]);if(!scoped(n))return base[method].apply(P,args);var previous=pending.get(n)||Promise.resolve(),next=previous.then(function(){if(!n.isConnected)return n;return base[method].apply(P,args);});var settled=next.catch(function(e){console.warn('[dashboard chart render]',n.id,e);return n;});pending.set(n,settled);settled.then(function(){if(pending.get(n)===settled)pending.delete(n);});return settled;};});
P.purge=function(target){var n=node(target),wait=n&&pending.get(n);if(scoped(n)&&wait){var done=wait.then(function(){base.purge.call(P,n);});pending.set(n,done);done.then(function(){if(pending.get(n)===done)pending.delete(n);});return;}return base.purge.call(P,target);};P.ymDashboardLifecycle=true;return true;}if(!install()){var tries=0,t=setInterval(function(){if(install()||++tries>150)clearInterval(t);},200);}})();


/* YM_BUSINESS_PERIOD_260910: one period for charts, metrics, table and programs. */
(function(g){
 function install(){
 if(g.YMBusinessPeriod||typeof g._bizOvAnnualRowsFor!=='function')return;
 var period=g.YMBusinessPeriod={mode:'window',start:2020,end:2026},rowsFor=g._bizOvAnnualRowsFor,setYear=g._bizOvSetYear,table=g._bizOvAnnualTable;
 function years(){return g._bizOvDataYears().filter(function(y){return period.mode!=='window'||(y>=period.start&&y<=period.end);});}
 g._bizOvVisibleYears=years;
 g._bizOvAnnualRowsFor=function(cat){var rows=rowsFor(cat);return g._bizOvYearPick()==='all'&&period.mode==='window'?rows.filter(function(r){return r.year>=period.start&&r.year<=period.end;}):rows;};
 g._bizOvSetYear=function(y){period.mode=String(y)==='all'?'all':'year';setYear(y);};
 g._bizOvPeriodWindow=function(){period.mode='window';period.start=2020;period.end=2026;setYear('all');};
 g._bizOvYearToggle=function(){g._bizOvSetYear(g._bizOvYearPick()==='all'?2026:'all');};
 g._bizOvYearTrigger=function(){var cur=g._bizOvYearPick(),lab=cur==='all'?(period.mode==='window'?period.start+'–'+period.end:'전체'):cur+'년';return '<span class="ym-period-control"><button class="ry-yr-tg" type="button" onclick="_bizOvYearToggle()" aria-pressed="'+(cur!=='all')+'" title="2026년 월별 / 전체 연도 전환">'+lab+'</button><button class="ry-yr-tg" type="button" aria-haspopup="listbox" onclick="_bizOvYearMenu(this)" aria-label="조회 기간 선택">▾</button></span>';};
 g._bizOvYearMenu=function(btn){var selected=g._bizOvYearPick();g._ddOpen(btn,function(p){var items=[{v:'window',label:'2020–2026',on:period.mode==='window'},{v:'all',label:'전체',on:period.mode==='all'}].concat(g._bizOvDataYears().slice().reverse().map(function(y){return {v:y,label:y+'년',on:selected===y};}));p.innerHTML=items.map(function(it){return '<button type="button" role="option" aria-selected="'+!!it.on+'" class="ym-period-option" onclick="'+(it.v==='window'?'_bizOvPeriodWindow()':"_bizOvSetYear('"+it.v+"')")+'">'+it.label+'</button>';}).join('');},126);};
 g._bizOvWin=function(d){var ys=g._bizOvDataYears(),min=Math.min.apply(null,ys),max=Math.max.apply(null,ys);period.mode='window';period.start=Math.max(min,Math.min(max-6,period.start+Number(d)));period.end=period.start+6;setYear('all');};
 g._bizOvPeriodNav=function(){var ys=g._bizOvDataYears(),lab=period.mode==='all'?'전체':period.start+'–'+period.end;return '<span class="bizm-yrnav"><button type="button" aria-label="이전 연도" onclick="_bizOvWin(-1)"'+(period.mode==='window'&&period.start<=Math.min.apply(null,ys)?' disabled':'')+'>‹</button><span>'+lab+'</span><button type="button" aria-label="다음 연도" onclick="_bizOvWin(1)"'+(period.mode==='window'&&period.end>=Math.max.apply(null,ys)?' disabled':'')+'>›</button></span>';};
 var ts=table.toString();
 var a=ts.indexOf('  var allY=[]'),b=ts.indexOf('   var selected=',a);
 if(a<0||b<0)throw new Error('Business table period source mismatch');
 ts=ts.slice(0,a)+'  var allY=window._bizOvVisibleYears(),years=allY,s=0,max=0;\n'+ts.slice(b);
 a=ts.indexOf('<span class="bizm-yrnav">');b=ts.indexOf('</span></div><div id="bizov-tscroll"',a);
 if(a<0||b<0)throw new Error('Business table navigation source mismatch');
 ts=ts.slice(0,a)+"'+window._bizOvPeriodNav()+'"+ts.slice(b+7);
 ts=ts.replace('var cr=chartRows[i]||{};','var cr=chartRows.filter(function(r){return Number(r.year)===Number(y);})[0]||{};');
 ts=ts.replace('class="bizm-ctbl"','class="bizm-ctbl ym-period-table" data-columns="\'+(years.length+2)+\'"');
 g._bizOvAnnualTable=(0,eval)('('+ts+')');
 var ks=g._bizOvAnnualMetricKpis.toString().replace('_ar.slice(0,Math.min(_yrFullN(),_ar.length))','_ar.filter(function(r){return r.year!==_YR_PARTIAL;})').replace('(_finYears()||[]).forEach','(_finYears()||[]).filter(function(y){return window._bizOvVisibleYears().indexOf(y)>=0;}).forEach').replace('var margin=all?(currentRow?currentRow.margin:null):t.margin;','var margin=t.margin;').replace("(all||Number(year)===currentYear)?'올해 평균 수익률':'수익률'","all?'기간 수익률':'수익률'").replace("(all?'% <span style=\"font-size:75%;font-weight:400\">(잠정)</span>':'%')","'%'").replace("all?'올해 수입합 ÷ 올해 사업비합':''","all?'선택 기간 수입합 ÷ 확인된 사업비합':''");
 g._bizOvAnnualMetricKpis=(0,eval)('('+ks+')');
 g._bizOvAnnualSvg=function(id,cat,height,axisLabels,override){
 var el=document.getElementById(id);if(!el)return;var rows=override||g._bizOvAnnualRowsFor(cat),labels=axisLabels||rows.map(function(r){return r.year;}),W=Math.max(320,el.clientWidth||900),H=Math.max(180,height||330),ml=48,mr=48,mt=30,mb=32,pw=W-ml-mr,ph=H-mt-mb,step=pw/Math.max(1,rows.length),series=g._bizOvChart.series,esc=g.YMUI.escapeText;
 var vals=[];rows.forEach(function(r){if(series.cost&&r.cost!=null)vals.push(Number(r.cost));if(series.rev&&r.rev!=null)vals.push(Number(r.rev));});
 var lo=Math.min.apply(null,[0].concat(vals)),hi=Math.max.apply(null,[1].concat(vals));hi=hi>0?hi*1.12:1;lo=lo<0?lo*1.12:0;
 var rates=rows.filter(function(r){return r.margin!=null&&isFinite(r.margin);}).map(function(r){return Number(r.margin);}),rlo=Math.min.apply(null,[0].concat(rates)),rhi=Math.max.apply(null,[100].concat(rates))*1.08;
 function x(i){return ml+step*(i+.5);}function y(v){return mt+ph-(v-lo)/(hi-lo)*ph;}function ry(v){return mt+ph-(v-rlo)/(rhi-rlo)*ph;}function fmt(v){return v==null?'—':(v/1e8).toLocaleString('ko-KR',{maximumFractionDigits:2});}
 var s='<svg class="ym-business-chart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="100%" height="100%" role="img" aria-label="'+esc(cat+' '+labels[0]+'–'+labels[labels.length-1]+' 사업비, 수입, 수익률')+'">';
 s+='<text x="'+ml+'" y="14" fill="var(--dim)" font-size="10">억원</text>'+(series.margin?'<text x="'+(W-mr)+'" y="14" text-anchor="end" fill="var(--accent)" font-size="10">수익률 %</text>':'');
 for(var t=0;t<=4;t++){var yy=mt+ph-ph*t/4,v=lo+(hi-lo)*t/4;s+='<line x1="'+ml+'" x2="'+(W-mr)+'" y1="'+yy+'" y2="'+yy+'" stroke="var(--border)" stroke-dasharray="3 5" opacity=".65"/><text x="'+(ml-9)+'" y="'+(yy+3)+'" text-anchor="end" fill="var(--dim)" font-size="10">'+fmt(v)+'</text>';if(series.margin)s+='<text x="'+(W-mr+9)+'" y="'+(yy+3)+'" fill="var(--dim)" font-size="10">'+Math.round(rlo+(rhi-rlo)*t/4)+'</text>';}
 var bw=Math.max(3,Math.min(26,step*.27)),gap=Math.min(6,step*.09),base=y(0);
 rows.forEach(function(r,i){var xx=x(i);s+='<g class="ym-biz-mark"><title>'+esc(labels[i]+' · 사업비 '+fmt(r.cost)+'억원 · 수입 '+fmt(r.rev)+'억원 · 수익률 '+(r.margin==null?'—':Number(r.margin).toFixed(1)+'%'))+'</title><rect x="'+(xx-step/2+2)+'" y="'+mt+'" width="'+Math.max(1,step-4)+'" height="'+ph+'" rx="7" fill="transparent" class="ym-biz-hover"/>';
 [['cost',xx-bw-gap/2,'--peach-text'],['rev',xx+gap/2,'--green']].forEach(function(b){if(!series[b[0]]||r[b[0]]==null)return;var yy=y(Number(r[b[0]])),bh=Math.abs(base-yy);s+='<rect x="'+b[1]+'" y="'+Math.min(yy,base)+'" width="'+bw+'" height="'+bh+'" rx="'+Math.min(5,bh/2)+'" fill="var('+b[2]+')" opacity=".78"/>';});s+='</g><text x="'+xx+'" y="'+(H-10)+'" text-anchor="middle" fill="var(--dim)" font-size="10">'+esc(labels[i])+'</text>';});
 if(series.margin){var path='',active=false;rows.forEach(function(r,i){if(r.margin==null){active=false;return;}path+=(active?'L':'M')+x(i)+','+ry(r.margin)+' ';active=true;});s+='<path d="'+path+'" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>';rows.forEach(function(r,i){if(r.margin==null)return;s+='<circle cx="'+x(i)+'" cy="'+ry(r.margin)+'" r="3" fill="var(--surface-solid)" stroke="var(--accent)" stroke-width="2"><title>'+esc(labels[i]+' 수익률 '+Number(r.margin).toFixed(1)+'%')+'</title></circle>';});}
 el.innerHTML=s+'</svg>';el.dataset.plotL=ml;el.dataset.plotR=mr;
 var card=el.closest('.bizm-card'),ct=card&&card.querySelector('.ct');if(ct){ct.innerHTML='<span><span class="ct-bul"></span>'+ (override?'월별':'연도별')+' 사업 지표</span><span class="ym-chart-legend"><span><i style="background:var(--peach-text)"></i>사업비</span><span><i style="background:var(--green)"></i>수입</span><span><i class="line" style="background:var(--accent)"></i>수익률</span></span>';}
 };
 g._bizOvYear='all';

 var businessFrame=0;function fitBusiness(){businessFrame=0;var host=document.getElementById('biz-main');if(!host||!host.querySelector('#bizov-chart'))return;var ratio=host.offsetWidth/host.getBoundingClientRect().width;var root=document.documentElement.style;root.setProperty('--ym-business-zoom',String(ratio));var h=Math.max(580,window.innerHeight-host.getBoundingClientRect().top-52);root.setProperty('--ym-biz-inner-height',h+'px');root.setProperty('--ym-biz-shell-height',h*ratio+'px');try{g._bizFitViewport();g._bizOvAnnualChartsRender();}catch(e){console.error('Business layout',e);}}
 function queueBusiness(){if(!businessFrame)businessFrame=requestAnimationFrame(fitBusiness);}
 var renderBusiness=g._bizOvRender;g._bizOvRender=function(el){var result=renderBusiness(el);queueBusiness();return result;};g.addEventListener('resize',queueBusiness);queueBusiness();

 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
