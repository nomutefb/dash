/* ═══ [260902 프로그램 레일 통합] 사업현황(ov)·판매현황(sales) 우측 「프로그램」 표 = 행·열·순서 하나, 지표 4칸만 다르게.
   - 행 원천 = 운영_프로그램마스터(_PM, 프로그램ID) + 판매 원천(_bizSalesDetailRows, 프로그램ID/이름으로 조인). 판매에만 있는 행은 연도 끝에 덧붙임.
   - 공통 5칸(일자·구분·분야·제목·상태) 마크업 동일 · colgroup 고정폭 → 두 면에서 열 경계가 같다.
   - 지표 4칸: ov = 사업비·수입·수익률·비고(기존 _bizOvYearRail 계산 그대로) / sales = 장르·관객수·오픈석·점유율(기존 _bizListTable 계산 그대로).
   - 덱 전환 시 표를 다시 그리지 않고(캐시 DOM 교체는 그대로) 스크롤 위치를 넘겨받고, 레일에는 페이드를 걸지 않는다.
   - 끄기: window._PROG_RAIL_ON=false 로 두면 구 렌더러(_bizOvYearRail 본문·_bizListTable) 그대로. */
window._PROG_RAIL_ON=true;
var _progRailFold={};
var _PR_COLS=[108,51,51,null,53,92,88,96,80];   /* 일자·구분·분야·제목(가변)·상태 | 지표 4칸(두 면 공통 폭) */
function _prColgroup(){ return '<colgroup>'+_PR_COLS.map(function(w){return w?('<col style="width:'+w+'px">'):'<col>';}).join('')+'</colgroup>'; }
function _prKeyOf(name,y){ return _uName(String(name||''))+'|'+y; }
/* 판매 행의 연도 — 구 _bizListTable과 같은 규칙(start → _salesDate → end → '미정') */
function _prYearOf(g){ if(!g)return null; var d=g.start; if(!(d&&d.getFullYear))d=_salesDate(d); if(!(d&&d.getFullYear)){ d=g.end; if(!(d&&d.getFullYear))d=_salesDate(d); } return (d&&d.getFullYear)?d.getFullYear():'미정'; }
function _prDate8(g){ var d=g&&g.start; if(!(d&&d.getFullYear))d=_salesDate(d); if(!(d&&d.getFullYear))d=g&&g.end; if(!(d&&d.getFullYear))d=_salesDate(d); return (d&&d.getFullYear)?(d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate()):99999999; }
/* 판매 원천 행에 프로그램ID를 붙인다 — 운영대장 공연ID(이름|연도 색인) 또는 판매축 마스터 ID */
function _prSalesIndex(cats,rent){
  var rows=[];
  var svR=window._progRentOn, svT=null;
  try{
    if(typeof _programTypes!=='undefined'&&_programTypes){ svT={}; Object.keys(_programTypes).forEach(function(k){svT[k]=_programTypes[k];}); ['공연','전시','예술교육'].forEach(function(t){ _programTypes[t]=(cats.indexOf(t)>=0)||(t==='예술교육'&&cats.indexOf('교육')>=0); }); }
    window._progRentOn=!!rent;
    try{ rows=_bizSalesDetailRows()||[]; }catch(_e){ rows=[]; }
  }finally{
    window._progRentOn=svR;
    if(svT){ Object.keys(svT).forEach(function(k){_programTypes[k]=svT[k];}); }
  }
  var byId={},byKey={};
  var raw=(typeof _bizState!=='undefined'&&_bizState&&_bizState.raw&&_bizState.raw.rows)||[];
  var ledger={}; for(var i=0;i<raw.length;i++){ var r=raw[i]; var id=String(r['공연ID']||''); if(!/^\d{6}_\d{2}/.test(id))continue; var k=_prKeyOf(r['공연명'],Number(r['년도']!=null?r['년도']:r['연도'])); if(!ledger[k])ledger[k]=id; }
  rows.forEach(function(g){ var y=_prYearOf(g); if(!y||y==='미정')return; var k=_prKeyOf(g.name,y); var pid=g._pid||ledger[k]||''; g._pid=pid; if(pid&&!byId[pid])byId[pid]=g; if(!byKey[k])byKey[k]=g; });
  return {rows:rows,byId:byId,byKey:byKey};
}
/* 연도별 행 모델 — 두 면 공통 */
function _prModel(opt){
  opt=opt||{};
  var years=opt.years||[], cats=opt.cats||[opt.cat||'공연'], rent=!!opt.rent, cat=cats[0]||'공연';
  var pm=(typeof _PM!=='undefined'&&_PM&&_PM.length)?_PM:[];
  var S=_prSalesIndex(cats,rent);
  var wantBun=[]; cats.forEach(function(c){ ((c==='예술교육'||c==='교육')?['교육']:((c==='전시')?['전시']:['공연','기타'])).forEach(function(b){ if(wantBun.indexOf(b)<0)wantBun.push(b); }); });
  var ORD={'공연':0,'전시':1,'교육':2,'기타':3};
  var ix=(typeof _pmUnIdx==='function')?_pmUnIdx():null;
  S.rows.forEach(function(g){ if(g)g._prUsedY=null; });
  var groups=[];
  years.forEach(function(y){
    var rows=[];
    pm.forEach(function(p){
      if(y==='미정'||Number(p.연도)!==y||wantBun.indexOf(p.분야)<0)return;
      var isRent=(String(p.구분2||'')==='대관'); if(rent?!isRent:isRent)return;
      var g=S.byId[String(p.id)]||S.byKey[_prKeyOf(p.명칭,y)]||null;
      if(!g&&p.별칭&&p.별칭.length){ for(var a=0;a<p.별칭.length&&!g;a++)g=S.byKey[_prKeyOf(p.별칭[a],y)]||null; }
      if(g)g._prUsedY=y;
      rows.push({key:((p.id!=null&&p.id!=='')?String(p.id):_prKeyOf(p.명칭,y)),pid:String(p.id||''),name:String(p.명칭||''),y:y,gu:p.구분2||'—',bun:p.분야||(cat==='예술교육'?'교육':cat),pm:p,g:g,_s:Number(p._s)||99999999,ord:ORD[p.분야]||3});
    });
    rows.sort(function(a,b){ return (a._s-b._s)||(a.ord-b.ord); });
    /* 판매에만 있는 행(프로그램마스터에 없음) — 연도 끝에 날짜순으로 덧붙임 */
    var extra=[];
    S.rows.forEach(function(g){
      if(!g||_prYearOf(g)!==y||g._prUsedY===y)return;
      var gu=(g._gu||(rent?'대관':'기획')); if(rent?gu!=='대관':gu==='대관')return;
      var bun=(g._cat==='예술교육')?'교육':(g._cat||'공연'); if(wantBun.indexOf(bun)<0)return;
      var pmx=ix?(ix[_prKeyOf(g.name,y)]||null):null; if(pmx&&wantBun.indexOf(pmx.분야)>=0&&Number(pmx.연도)===y)return;   /* 이미 위에서 그린 프로그램 */
      var s=_prDate8(g);
      extra.push({key:g._pid||_prKeyOf(g.name,y),pid:g._pid||'',name:String(g.name||''),y:y,gu:gu,bun:bun,pm:null,g:g,_s:s,ord:9});
    });
    extra.sort(function(a,b){return a._s-b._s;});
    rows=rows.concat(extra);
    if(rows.length)groups.push({y:y,rows:rows});
  });
  return groups;
}
/* 공통 5칸 */
function _prSharedCells(r){
  var _nameHdPad=_BIZ_HALL_BADGE_L+_BIZ_HALL_BADGE_W+_BIZ_HALL_BADGE_GAP;
  var dateTxt='—';
  if(r.pm&&r.pm['일정']!=null&&String(r.pm['일정'])!=='')dateTxt=_pmScheduleText(r.pm['일정'])||'—';
  else if(r.g&&r.g.start)dateTxt=_bizDateCell(r.g.start,r.g.end,r.g.start.getTime()===r.g.end.getTime());
  var guColor=(r.gu==='기획')?'var(--accent)':'var(--neutral-text)';
  var st=r.pm?_progStatus({s:r.pm._s,e:r.pm._e,ps:r.pm._ps,hs:r.pm._hs,wg:r.pm._wg,st:r.pm._st,sale:!!(r.g&&(r.g._sold!=null||r.g._rev!=null)),acct:/^(망마_|장도_)/.test(r.name)})
                :_progStatusOf(r.name,r.y,r.g&&r.g.start,r.g&&r.g.end,!!(r.g&&(r.g._sold!=null||r.g._rev!=null)));
  r._st=st;
  var end=(r.g&&r.g.end)||new Date(r.y,11,31);
  return '<td style="padding:7px '+_BIZ_LIST_TEXT_PAD+'px;padding-left:14px;color:var(--neutral-text);white-space:nowrap;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis">'+escapeHtml(dateTxt)+'</td>'
    +'<td style="padding:7px '+_BIZ_LIST_TEXT_PAD+'px;color:'+guColor+';white-space:nowrap">'+escapeHtml(r.gu)+'</td>'
    +'<td style="padding:7px '+_BIZ_LIST_TEXT_PAD+'px;color:var(--neutral-text);white-space:nowrap">'+escapeHtml(r.bun==='교육'?'예술교육':r.bun)+'</td>'
    +'<td style="padding:7px '+_BIZ_LIST_TEXT_PAD+'px 7px '+_nameHdPad+'px;position:relative;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;color:var(--text)" title="'+escapeHtml(r.name)+'">'+_bizHallBadge(_bizHallOf({name:r.name,end:end}))+escapeHtml(r.name)+'</td>'
    +_progStatusCell(st);
}
/* ov 지표 4칸 — 기존 _bizOvYearRail의 v46 분기 계산을 그대로 옮김 */
function _prOvCells(r){
  var _colGap=22, dash='<span style="color:var(--dim)">—</span>';
  var finMil1=function(v){if(v==null||!isFinite(v))return '—';return (Number(v)/1e6).toLocaleString(undefined,{minimumFractionDigits:1,maximumFractionDigits:1});};
  var p=r.pm, y=(r.y==='미정'?null:r.y), gu=r.gu, isRent=(gu==='대관');
  if(!p){ /* 프로그램마스터에 없는 판매 전용 행 — 사업비는 운영_사업비에서 이름으로 */
    var f=null; try{ f=_finOf(r.name,y); }catch(_e){}
    var c=f?_finCalc(f).cost:null, v=f?(Number(f.rev)||0):null, m=(isFinite(c)&&c>0&&v>0)?Math.round(v/c*100)+'%':'—';
    return '<td style="padding:7px 10px 7px '+_colGap+'px;text-align:right;color:var(--peach-text);font-weight:600;font-variant-numeric:tabular-nums">'+(isRent||c==null?dash:finMil1(c))+'</td>'
      +'<td style="padding:7px 10px 7px '+_colGap+'px;text-align:right;color:var(--green);font-weight:600;font-variant-numeric:tabular-nums">'+(v==null?dash:finMil1(v))+'</td>'
      +'<td style="padding:7px 10px 7px '+_colGap+'px;text-align:right;color:var(--accent);font-weight:700;font-variant-numeric:tabular-nums">'+(isRent?dash:m)+'</td>'
      +'<td style="padding:7px 14px 7px '+_colGap+'px;text-align:right;color:var(--neutral-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11.5px">&nbsp;</td>';
  }
  var cost=(p.사업비==null?null:(isFinite(Number(p.사업비))?Number(p.사업비):String(p.사업비)));
  var rev=(p.수입==null?null:Number(p.수입));
  var margin=(p.수익률!=null)?(isFinite(Number(p.수익률))?Number(p.수익률):String(p.수익률)):null;
  var _pstv=r._st||_progStatus({s:p._s,e:p._e,ps:p._ps,hs:p._hs,wg:p._wg,st:p._st,acct:/^(망마_|장도_)/.test(r.name)});
  var _lrev=0;
  if(gu==='기획'&&Number(rev)===0&&(_pstv==='판매 중'||_pstv==='진행 중'||_pstv==='홍보 중')){
    try{ var _si=_bizSalesIdx(y); var _sp=_si&&_si[_uName(r.name)]; _lrev=_sp?(Number(_sp.money)||0):0; }catch(_e){}
    if(!_lrev&&r.g&&r.g._rev!=null)_lrev=Number(r.g._rev)||0;
  }
  var _mrg=null; var _c=Number(cost), _v=(Number(rev)>0?Number(rev):_lrev); if(isFinite(_c)&&_c>0&&_v>0)_mrg=_v/_c*100;
  var costHtml=isRent?dash:(typeof cost==='string'?cost:((p.사업비분할)?finMil1(cost*p.사업비분할)+'<span style="font-weight:400;color:var(--neutral-text);display:inline-block;width:0;white-space:nowrap">/'+p.사업비분할+'</span>':finMil1(cost)));
  var revHtml=(Number(p.무료여부)===1)?'무료':((gu==='기획'&&Number(rev)===0)?((_pstv==='완료')?'무료':((_pstv==='취소'||_pstv==='—')?'—':finMil1(_lrev))):((p.수입분할)?finMil1(rev*p.수입분할)+'<span style="font-weight:400;color:var(--neutral-text);display:inline-block;width:0;white-space:nowrap">/'+p.수입분할+'</span>':finMil1(rev)));
  var mrgHtml=isRent?dash:(typeof margin==='string'?margin:(_mrg==null?'—':Math.round(_mrg)+'%'));
  var note=p.비고?escapeHtml(String(p.비고).slice(0,20)):'&nbsp;';
  return '<td style="padding:7px 10px 7px '+_colGap+'px;text-align:right;color:var(--peach-text);font-weight:600;font-variant-numeric:tabular-nums">'+costHtml+'</td>'
    +'<td style="padding:7px 10px 7px '+_colGap+'px;text-align:right;color:var(--green);font-weight:600;font-variant-numeric:tabular-nums">'+revHtml+'</td>'
    +'<td style="padding:7px 10px 7px '+_colGap+'px;text-align:right;color:var(--accent);font-weight:700;font-variant-numeric:tabular-nums">'+mrgHtml+'</td>'
    +'<td style="padding:7px 14px 7px '+_colGap+'px;text-align:right;color:var(--neutral-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11.5px" title="'+(p.비고?escapeHtml(String(p.비고)):'')+'">'+note+'</td>';
}
/* sales 지표 4칸 — 기존 _bizListTable 계산 그대로 */
function _prSalesCells(r){
  var _colGap=22, g=r.g, mute='<span style="color:var(--muted);font-weight:500">—</span>';
  var genre=g?(g.genre||'-'):((r.pm&&(r.pm._g2||''))||'-');
  var paid=!g?mute:(g._st==='planned'?'<span style="color:var(--muted);font-weight:500">오픈 전</span>':((g._dbOnly||(g._sold==null&&!(g.paid>0)&&!(g.seat>0)&&!(g.open>0)))?mute:Math.round((g._sold!=null&&g._sold>0)?g._sold:g.paid).toLocaleString()));
  var open=!g?mute:(g.genre==='전시'?mute:((g.open>0?Math.round(g.open).toLocaleString():mute)+'('+g.cnt+')'));
  var avg=!g?'—':((g.genre==='전시'||g._st==='planned'||g._dbOnly||!(g.open>0))?'—':g.avg.toFixed(1));
  return '<td style="padding:7px 12px 7px '+_colGap+'px;text-align:right;color:var(--neutral-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escapeHtml(genre)+'</td>'
    +'<td style="padding:7px 12px 7px '+_colGap+'px;text-align:right;color:var(--peach-text);font-weight:600;font-variant-numeric:tabular-nums">'+paid+'</td>'
    +'<td style="padding:7px 12px 7px '+_colGap+'px;text-align:right;color:var(--neutral-text);white-space:nowrap;font-variant-numeric:tabular-nums">'+open+'</td>'
    +'<td style="padding:7px 12px 7px '+_colGap+'px;text-align:right;color:var(--accent);font-weight:700;font-variant-numeric:tabular-nums">'+avg+'</td>';
}
function _prHeadCell(label,unit,i,mode){
  var sortable=(i>=5&&i<=7), st=(mode==='ov')?_bizOV:_bizLT;
  var keyOf=(mode==='ov')?{5:'cost',6:'rev',7:'margin'}:{6:'paid',7:'open',8:'avg'};
  var isSort=(mode==='ov')?sortable:(i>=6&&i<=8);
  var click=(i===0)?(mode==='ov'?'_bizOVDate()':'_bizLTDate()'):(isSort?(mode==='ov'?'_bizOVHead('+(i-1)+')':'_bizLTHead('+(i-3)+')'):'');
  var arrow=(i===0)?(st.yearDesc?' ∨':' ∧'):((isSort&&st.key===keyOf[i])?(st.dir>0?' ∧':' ∨'):'');
  return '<td'+(click?' onclick="'+click+'"':'')+' style="padding:8px 12px;position:sticky;top:0;z-index:1;background:var(--surface-solid);box-shadow:inset 0 -2px 0 var(--border);vertical-align:middle;'+((i===0||isSort)?'cursor:pointer;':'')+(i>=5?'text-align:right;padding-left:22px;':'')+(i===0?'padding-left:14px;':'')+(i===3?'padding-left:'+(_BIZ_HALL_BADGE_L+_BIZ_HALL_BADGE_W+_BIZ_HALL_BADGE_GAP)+'px;':'')+(i===8?'padding-right:14px;':'')+'white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+label+arrow+(unit?'<div style="font-size:10.5px;font-weight:400;margin-top:2px">(단위: '+unit+')</div>':'')+'</td>';
}
/* 표 HTML (두 면 공용). mode='ov'|'sales' */
function _progRailTableHtml(mode,opt){
  mode=(mode==='ov')?'ov':'sales';
  var years=[],cat,rent,st;
  if(mode==='ov'){ var ys=_bizOvDataYears(),pick=_bizOvYearPick(); years=(pick==='all'?ys:[pick]).filter(function(y){return ys.indexOf(y)>=0;}); cat=_bizOvAnnualCat==='교육'?'예술교육':(_bizOvAnnualCat==='전시'?'전시':'공연'); rent=!!window._bizOVRentOn; st=_bizOV; years=years.slice().sort(function(a,b){return st.yearDesc?b-a:a-b;}); }
  else { var sel=(opt&&opt.yearSel!==undefined)?opt.yearSel:_ryYearSel(); var on=(typeof _programTypesOn==='function')?_programTypesOn():[_programTypeFilter||'공연']; cat=on[0]||'공연'; var cats=on.slice(); rent=!!window._progRentOn; st=_bizLT; var S0=_prSalesIndex(cats,rent); var ySet={}; S0.rows.forEach(function(g){ var yy=_prYearOf(g); if(yy)ySet[yy]=1; }); ((typeof _PM!=='undefined'&&_PM)||[]).forEach(function(p){ if(Number(p.연도))ySet[Number(p.연도)]=1; }); var all=Object.keys(ySet).map(function(k){return k==='미정'?k:Number(k);}); years=(sel===_RY_YEAR_ALL?all:all.filter(function(y){return String(y)===String(sel);})); years=years.slice().sort(function(a,b){ if(a==='미정')return 1; if(b==='미정')return -1; return st.yearDesc?b-a:a-b; }); }
  try{ _finWarm(); }catch(_e){}
  var groups=_prModel({years:years,cats:(mode==='ov')?[cat]:cats,rent:rent});
  var heads=(mode==='ov')?[['일자',''],['구분',''],['분야',''],['제목',''],['상태',''],['사업비','백만원'],['수입','백만원'],['수익률','%'],['비고','']]
                         :[['일자',''],['구분',''],['분야',''],['제목',''],['상태',''],['장르',''],['관객수','명'],['오픈석','명, 회'],['점유율','%']];
  var h='<table data-prog-rail="'+mode+'" style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:13px">'+_prColgroup()+'<thead><tr style="color:var(--dim);font-size:12px;text-align:left">'+heads.map(function(c,i){return _prHeadCell(c[0],c[1],i,mode);}).join('')+'</tr></thead><tbody>';
  var tok=(cat==='전시'?'--peach-text':cat==='예술교육'?'--green':'--accent');
  groups.forEach(function(grp){
    var y=grp.y, rows=grp.rows, n=rows.length, folded=!!_progRailFold[y];
    var sorted=rows;
    if(!folded&&st.key){
      var f=(mode==='ov')?function(r){ var p=r.pm; var v=!p?null:(st.key==='cost'?p.사업비:(st.key==='rev'?p.수입:p.수익률)); var nn=Number(v); return (v!=null&&v!==''&&isFinite(nn))?nn:-1; }
                          :function(r){ var g=r.g; if(!g)return -1; return st.key==='paid'?((g._sold!=null&&g._sold>0)?g._sold:(g.paid||0)):(st.key==='open'?(g.open||0):((g.avg!=null&&isFinite(g.avg))?g.avg:-1)); };
      sorted=rows.slice().sort(function(a,b){ return (f(a)-f(b))*st.dir; });
    }
    h+='<tr data-y="'+y+'" onclick="_progRailFoldToggle(\''+y+'\')" style="cursor:pointer"><td colspan="9" style="padding:0;position:sticky;top:44px;z-index:2;background:var(--surface-solid)"><div class="ry-grp-hd" style="--gtok:var('+tok+')">'+(folded?'› ':'')+(y==='미정'?'연도 미상':y+'년')+' <span class="rail-yrm-gc">'+n+'</span></div></td></tr>';
    if(folded)return;
    sorted.forEach(function(r,i){
      var shared=_prSharedCells(r);
      var metric=(mode==='ov')?_prOvCells(r):_prSalesCells(r);
      var title=(mode==='ov')?'':(function(){ var _fy=r.y, _fn=null; try{_fn=_finOf(r.name,_fy);}catch(_e){} return _fn?(' title="'+escapeHtml('사업비 '+_fn.no+' — 전표실적 '+(_fn.vou||0).toLocaleString()+'원 · 판매수수료 '+(_fn.fee||0).toLocaleString()+'원 · 정산서매출 '+(_fn.rev||0).toLocaleString()+'원 (눌러서 보기)')+'"'):''; })();
      var _cy=(r.g&&r.g.end&&r.g.end.getFullYear)?r.g.end.getFullYear():r.y;
      h+='<tr data-pkey="'+escapeHtml(r.key)+'" data-pname="'+escapeHtml(r.name)+'" data-pyear="'+_cy+'" data-pst="'+escapeHtml(r._st||'')+'" onclick="_progRailRowClick(this)"'+title+' style="border-bottom:1px solid var(--border);cursor:pointer;'+(i%2?'background:var(--past-bg);':'')+'">'+shared+metric+'</tr>';
    });
  });
  h+='</tbody></table>';
  return h;
}
function _progRailFoldToggle(y){ _progRailFold[y]=!_progRailFold[y]; try{ if(typeof _bizDeck!=='undefined'&&_bizDeck==='ov'){ _bizOVReRender(); } else { _bizSalesDetailRefresh(); } }catch(_e){} }
function _progRailRowClick(tr){
  var name=tr.getAttribute('data-pname'), y=Number(tr.getAttribute('data-pyear')), st=tr.getAttribute('data-pst');
  if(typeof _bizDeck!=='undefined'&&_bizDeck==='ov'){ try{ _finOpen(name,y); }catch(_e){} return; }
  if(st==='판매 중'){ try{ _bizSalesRowPick(name); }catch(_e){} } else { try{ _pastAudOpen(name,y); }catch(_e){} }
}
/* ov 면 레일 — 기존 틀(머리줄·카드·#bizov-year-list·#rail-yrm-uha)은 그대로, 표만 공용 */
function _progRailRender(el){
  window._bizOVEl=el;
  _bizOvDetailLoad();
  _pmLoad().then(function(){ if((typeof _PM!=='undefined')&&_PM&&_PM.length>1600&&el&&el.isConnected&&el.getAttribute('data-v46')!=='1'){ _bizOvYearRail(el); } }).catch(function(){});
  var h='<div style="position:relative">'+_bizmHead('','프로그램',' ')+_BIZM_BOX
    +'<div data-bizmfill data-bizmcap style="min-height:0;border:1px solid var(--border);border-radius:12px;background:var(--surface-solid);display:flex;flex-direction:column;overflow:hidden"><div id="bizov-year-list" class="ry-grp-bd" style="min-height:0;overflow-x:auto;overflow-y:auto">'   /* [260902 좌측 틀 통일] 판매현황 면 래퍼와 동일 마크업(둥글기·테두리·상한 고정·페이드) */
    +_progRailTableHtml('ov')
    +'</div></div><div id="rail-yrm-uha"></div></div></div>';
  el.innerHTML=h;
  _bizOvUhaPark();
  el.setAttribute('data-v46',(((typeof _PM!=='undefined')&&_PM&&_PM.length>1600)?'1':'0'));
  setTimeout(function(){try{_srailAlignTop();}catch(_e){}},0);
}
/* 덱 전환 — 같은 행 목록이면 스크롤 위치를 넘겨받는다 */
function _progRailScrollGet(){ try{ var t=document.querySelector('#rail-yrm table[data-prog-rail]'); var sc=t&&t.closest?t.closest('.ry-grp-bd'):null; if(!sc)return null; var keys=Array.prototype.map.call(sc.querySelectorAll('tr[data-pkey]'),function(t){return t.getAttribute('data-pkey');}); return {top:sc.scrollTop,keys:keys}; }catch(_e){ return null; } }
function _progRailScrollSet(saved){ try{ if(!saved)return; var t=document.querySelector('#rail-yrm table[data-prog-rail]'); var sc=t&&t.closest?t.closest('.ry-grp-bd'):null; if(!sc)return; var keys=Array.prototype.map.call(sc.querySelectorAll('tr[data-pkey]'),function(t){return t.getAttribute('data-pkey');}); if(keys.length!==saved.keys.length)return; for(var i=0;i<keys.length;i+=Math.max(1,Math.floor(keys.length/20))){ if(keys[i]!==saved.keys[i])return; } sc.scrollTop=saved.top; }catch(_e){} }
