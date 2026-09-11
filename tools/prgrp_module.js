/* ═══ [260903 Phase1 M-3] 프로그램 레일 — 사업코드 그룹(부모/자식) 토글 ═══
   원칙(청사진 §0-3·§2): 사업비는 사업(사업코드) 단위로 통, 객체(관객·기간)는 프로그램ID 단위로 개별.
   같은 연도 안에서 같은 사업코드를 2건 이상 공유하는 행(브런치 4회·결과발표전 5인 등)은 부모 행 1개로 접고,
   부모를 누르면 자식이 펼쳐진다. 부모 지표 = ov 면: 사업비 시트 그 코드 행(없으면 자식 합) · sales 면: 자식 관객·오픈석 합.
   두 면이 같은 함수·같은 키(`grp:코드|연도`)를 쓰므로 덱 전환 시 스크롤 복원(_progRailScrollSet)도 그대로 맞물린다.
   끄기: window._PROG_RAIL_GRP=false. 펼침 상태: _progRailGrpOpen[코드|연도]. */
var _progRailGrpOpen={};
function _prRailToggle(kind,key){
 var table=document.querySelector('#ym-programs-mobile table[data-prog-rail]')||document.querySelector('#rail-yrm table[data-prog-rail]');
 var sc=table&&table.closest('.ry-grp-bd'),top=sc?sc.scrollTop:0,left=sc?sc.scrollLeft:0;
 var pageY=window.scrollY,mode=table&&table.getAttribute('data-prog-rail');
 if(kind==='group')_progRailGrpOpen[key]=!_progRailGrpOpen[key];else _progRailFold[key]=!_progRailFold[key];
 try{if(table&&table.closest('#ym-programs-mobile')){table.parentElement.innerHTML=_progRailTableHtml('ov');}else if(mode==='ov'||(!mode&&typeof _bizDeck!=='undefined'&&_bizDeck==='ov'))_bizOVReRender();else _bizSalesDetailRefresh();}catch(e){console.warn('[program toggle]',e);}
 requestAnimationFrame(function(){var next=document.querySelector('#ym-programs-mobile table[data-prog-rail]')||document.querySelector('#rail-yrm table[data-prog-rail]'),box=next&&next.closest('.ry-grp-bd');if(box){box.scrollTop=top;box.scrollLeft=left;}window.scrollTo(window.scrollX,pageY);
 if(next){var attr=kind==='group'?'data-pgrp':'data-y';var row=Array.prototype.find.call(next.querySelectorAll('tr['+attr+']'),function(r){return r.getAttribute(attr)===String(key);});var button=row&&row.querySelector('button');if(button)button.focus({preventScroll:true});}});
}
function _progRailGrpToggle(k){_prRailToggle('group',k);}
function _prGrpFinance(f,status){
 if(!f)return null;
 var budget=(f.bud!==null&&f.bud!==undefined&&String(f.bud).trim()!==''&&isFinite(Number(f.bud)))?Number(f.bud):null;
 var planned=status!=='완료'&&budget!==null;
 return {cost:planned?budget:_finCalc(f).cost,rev:Number(f.rev)||0,basis:planned?'전체 예산':'전체 집행액·수수료'};
}
function _prGrpCode(r){ return (r&&r.pm)?String(r.pm.사업코드||'').trim():''; }
function _prGroupRows(sorted){
  if(window._PROG_RAIL_GRP===false)return sorted.map(function(r){return {row:r};});
  var cnt={}; sorted.forEach(function(r){ var c=_prGrpCode(r); if(c)cnt[c]=(cnt[c]||0)+1; });
  var out=[],done={};
  sorted.forEach(function(r){ var c=_prGrpCode(r); if(!c||cnt[c]<2){ out.push({row:r}); return; } if(done[c])return; done[c]=1; out.push({grp:{code:c,rows:sorted.filter(function(x){return _prGrpCode(x)===c;})}}); });
  return out;
}
function _prGrpName(code,y,rows){
  var f=null; try{ f=_finRowByNo(code,y); }catch(_e){}
  if(f&&f.name)return String(f.name);
  var names=rows.map(function(r){return String(r.name||'');});
  var pre=names[0]||'';
  names.forEach(function(n){ var i=0; while(i<pre.length&&i<n.length&&pre.charAt(i)===n.charAt(i))i++; pre=pre.slice(0,i); });
  pre=pre.replace(/[\s<〈(\[_:·-]+$/,'').trim();
  return (pre.length>=4)?pre:(names[0]+' 외 '+(names.length-1));
}
function _prGrpStatus(rows){
  var st=rows.map(function(r){return r._st||'';});
  if(st.indexOf('판매 중')>=0)return '판매 중';
  if(st.indexOf('진행 중')>=0||st.indexOf('홍보 중')>=0)return '진행 중';
  if(st.length&&st.every(function(s){return s==='완료';}))return '완료';
  return st.indexOf('계획')>=0?'계획':(st[0]||'계획');
}
function _prGroupParentHtml(mode,grp,y,i){
  var rows=grp.rows, code=grp.code, gk=code+'|'+y, open=!!_progRailGrpOpen[gk];
  rows.forEach(function(r){ if(!r._st)_prSharedCells(r); });   /* 자식 상태 확정(접혀 있어도 부모 상태 집계에 필요) */
  var _nameHdPad=_BIZ_HALL_BADGE_L+_BIZ_HALL_BADGE_W+_BIZ_HALL_BADGE_GAP, _colGap=22;
  var s=Math.min.apply(null,rows.map(function(r){return Number(r.pm._s)||99999999;})), e=Math.max.apply(null,rows.map(function(r){return Number(r.pm._e)||0;}));
  function d8(v){ v=String(v||''); return v.length>=8?v.slice(4,6)+'.'+v.slice(6,8):''; }
  var sch=(d8(e)&&d8(e)!==d8(s))?(d8(s)+'~'+d8(e)):d8(s);
  var dateTxt=(sch?_pmScheduleText(sch):'')||'—';
  var gu=rows[0].gu, bun=rows[0].bun, guColor=(gu==='기획')?'var(--accent)':'var(--neutral-text)';
  var name=_prGrpName(code,y,rows), st=_prGrpStatus(rows);
  var shared='<td style="padding:7px '+_BIZ_LIST_TEXT_PAD+'px;padding-left:14px;color:var(--neutral-text);white-space:nowrap;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis">'+escapeHtml(dateTxt)+'</td>'
    +'<td style="padding:7px '+_BIZ_LIST_TEXT_PAD+'px;color:'+guColor+';white-space:nowrap">'+escapeHtml(gu)+'</td>'
    +'<td style="padding:7px '+_BIZ_LIST_TEXT_PAD+'px;color:var(--neutral-text);white-space:nowrap">'+escapeHtml(bun==='교육'?'예술교육':bun)+'</td>'
    +'<td class="pr-group-name" style="padding:7px '+_BIZ_LIST_TEXT_PAD+'px 7px '+_nameHdPad+'px;position:relative;overflow:hidden" title="'+escapeHtml(name+' · '+code+' · '+rows.length+'건')+'"><button type="button" class="pr-group-toggle" aria-expanded="'+open+'" aria-label="'+escapeHtml(y+'년 '+name+' 프로그램 '+rows.length+'개 '+(open?'접기':'펼치기'))+'" onclick="event.stopPropagation();_progRailGrpToggle(this.closest(&quot;tr&quot;).getAttribute(&quot;data-pgrp&quot;))"><span class="pr-grp-caret" aria-hidden="true">›</span><span class="pr-group-label">'+escapeHtml(name)+'</span><span class="rail-yrm-gc">'+rows.length+'</span></button></td>'
    +_progStatusCell(st);
  var metric='';
  if(mode==='ov'){
    var dash='<span style="color:var(--dim)">—</span>';
    var finMil1=function(v){if(v==null||!isFinite(v))return '—';return (Number(v)/1e6).toLocaleString(undefined,{minimumFractionDigits:1,maximumFractionDigits:1});};
    var f=null; try{ f=_finRowByNo(code,(y==='미정'?null:y)); }catch(_e){}
    var c=null,v=null;
    var finance=_prGrpFinance(f,st); if(finance){ c=finance.cost; v=finance.rev; }
    else { c=0; v=0; var any=false; rows.forEach(function(r){ var p=r.pm; if(p&&p.사업비!=null&&isFinite(Number(p.사업비))){c+=Number(p.사업비);any=true;} if(p&&p.수입!=null&&isFinite(Number(p.수입))){v+=Number(p.수입);any=true;} }); if(!any){c=null;v=null;} }
    var m=(c!=null&&isFinite(c)&&c>0&&v>0)?Math.round(v/c*100)+'%':'—';
    metric='<td title="'+escapeHtml((finance?finance.basis:'프로그램 합계')+(c==null?'':': '+Number(c).toLocaleString()+'원'))+'" style="padding:7px 10px 7px '+_colGap+'px;text-align:right;color:var(--peach-text);font-weight:700;font-variant-numeric:tabular-nums">'+(c==null?dash:finMil1(c))+'</td>'
      +'<td style="padding:7px 10px 7px '+_colGap+'px;text-align:right;color:var(--green);font-weight:700;font-variant-numeric:tabular-nums">'+(v==null?dash:finMil1(v))+'</td>'
      +'<td style="padding:7px 10px 7px '+_colGap+'px;text-align:right;color:var(--accent);font-weight:700;font-variant-numeric:tabular-nums">'+m+'</td>'
      +'<td style="padding:7px 14px 7px '+_colGap+'px;text-align:right;color:var(--neutral-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11.5px">'+''+'</td>';
  } else {
    var mute='<span style="color:var(--muted);font-weight:500">—</span>';
    var paid=0,open_=0,cnt=0,anyG=false,genre='-',isEx=false;
    rows.forEach(function(r){ var g=r.g; if(!g)return; anyG=true; if(genre==='-'&&g.genre)genre=g.genre; if(g.genre==='전시')isEx=true; if(g._st==='planned'||g._dbOnly)return; var p=(g._sold!=null&&g._sold>0)?g._sold:(g.paid||0); paid+=p; open_+=(g.open||0); cnt+=(g.cnt||0); });
    var paidTxt=!anyG?mute:(paid>0?Math.round(paid).toLocaleString():mute);
    var openTxt=(!anyG||isEx)?mute:((open_>0?Math.round(open_).toLocaleString():mute)+'('+cnt+')');
    var avgTxt=(!anyG||isEx||!(open_>0))?'—':(paid/open_*100).toFixed(1);
    metric='<td style="padding:7px 12px 7px '+_colGap+'px;text-align:right;color:var(--neutral-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escapeHtml(genre)+'</td>'
      +'<td style="padding:7px 12px 7px '+_colGap+'px;text-align:right;color:var(--peach-text);font-weight:700;font-variant-numeric:tabular-nums">'+paidTxt+'</td>'
      +'<td style="padding:7px 12px 7px '+_colGap+'px;text-align:right;color:var(--neutral-text);white-space:nowrap;font-variant-numeric:tabular-nums">'+openTxt+'</td>'
      +'<td style="padding:7px 12px 7px '+_colGap+'px;text-align:right;color:var(--accent);font-weight:700;font-variant-numeric:tabular-nums">'+avgTxt+'</td>';
  }
  return '<tr class="pr-grp" data-pkey="grp:'+escapeHtml(gk)+'" data-pgrp="'+escapeHtml(gk)+'" onclick="_progRailGrpToggle(\''+escapeHtml(gk)+'\')" title="'+escapeHtml(name+' · 사업 '+code+' — 눌러서 '+(open?'접기':'펼치기'))+'" style="border-bottom:1px solid var(--border);cursor:pointer;'+(i%2?'background:var(--past-bg);':'')+'">'+shared+metric+'</tr>';
}
(function(){var st=document.getElementById('pr-grp-css');if(!st){st=document.createElement('style');st.id='pr-grp-css';document.head.appendChild(st);}st.textContent="table[data-prog-rail] .pr-group-toggle{display:flex;align-items:center;gap:8px;min-height:0;width:100%;padding:0;border:0;background:none;color:var(--text);font:inherit;font-weight:700;text-align:left;cursor:pointer}table[data-prog-rail] .pr-group-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}table[data-prog-rail] .pr-grp-caret{display:inline-flex;align-items:center;justify-content:center;flex:0 0 16px;height:14px;border-radius:6px;background:var(--surface-solid);color:var(--accent);font-size:18px;transition:transform .16s ease}table[data-prog-rail] [aria-expanded=\"true\"]>.pr-grp-caret{transform:rotate(90deg)}table[data-prog-rail] .pr-group-toggle:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:5px}table[data-prog-rail] tr.pr-grp:hover{filter:brightness(.98)}table[data-prog-rail] .pr-cost-basis{font-size:10px;color:var(--dim);margin-top:3px}table[data-prog-rail] tr.pr-child td:nth-child(4){padding-left:84px!important;box-shadow:inset 3px 0 0 var(--border)}table[data-prog-rail] tr.pr-child td:nth-child(4)::before{content:none}table[data-prog-rail] .pr-year-toggle{display:flex;align-items:center;gap:8px;width:100%;border:0;background:none;color:inherit;font:inherit;font-weight:inherit;text-align:left;cursor:pointer;min-height:36px;padding:0}table[data-prog-rail] .pr-year-toggle:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}@media(prefers-reduced-motion:reduce){table[data-prog-rail] .pr-grp-caret{transition:none}}table[data-prog-rail] tr.pr-child td:nth-child(4)>span[aria-label]{left:60px!important}";})();
