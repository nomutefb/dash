/* ═══ [260903 Phase2 M-4/M-5/M-13] 프로그램 등록 폼 「사업 연결」 단계 + 사업코드 우선 조인 ═══
   원칙(청사진 §0-3·§0-8·§3.2): 사업명(1) – 사업코드(1) – 프로그램(n). 등록·변경 때 반드시 ① 기존 사업 선택 / ② 신규 사업(사업명+사업코드 새로) / ③ 사업 없음(대관·기타) 중 하나.
   ①·③ = programs.사업코드 만 기록 · ② = 사업비 시트에 행 1건 append(`POST /api/ops/row`, H-4) + programs.사업코드.
   사업코드 자동 제안 = `YY-부문NN`(같은 연도·부문의 사업비·프로그램 관리·프로그램마스터 최대 NN + 1). 부문 = 공연 a / 전시 b / 예술교육 c.
   권한: 신규 사업(예산 입력)은 회계 담당자(_isAcct) 또는 관리자만. 끄기: window._PROG_BIZ_ON=false (폼에 단계 미표시, 저장은 종전대로). */
var _PROG_BIZ_PART={'공연':'a','전시':'b','예술교육':'c'};
function _progBizYear(){ var el=document.getElementById('prog-start'); var v=el?String(el.value||''):''; var m=v.match(/^(\d{4})/); return m?Number(m[1]):(new Date()).getFullYear(); }
function _progBizCt(){ var el=document.querySelector('#prog-form select[name="콘텐츠구분"]'); return el?String(el.value||''):''; }
function _progBizAllCodes(year){
  var set={};
  try{ _finRows(year).forEach(function(r){ if(r.no)set[String(r.no)]=1; }); }catch(_e){}
  try{ (_finState.rows||[]).forEach(function(r){ var no=String(r['사업NO']||'').trim(); if(no)set[no]=1; }); }catch(_e){}
  try{ (typeof _programsCache!=='undefined'?_programsCache:[]).forEach(function(p){ var c=String(p['사업코드']||'').trim(); if(c)set[c]=1; }); }catch(_e){}
  try{ (typeof _PM!=='undefined'&&_PM?_PM:[]).forEach(function(p){ var c=String(p.사업코드||'').trim(); if(c)set[c]=1; }); }catch(_e){}
  return set;
}
function _progBizNextCode(year,ct){
  var part=_PROG_BIZ_PART[ct]; if(!part)return '';
  var yy=String(year).slice(2), re=new RegExp('^'+yy+'-'+part+'(\\d{2})$'), max=0;
  Object.keys(_progBizAllCodes(year)).forEach(function(c){ var m=c.match(re); if(m){ var n=parseInt(m[1],10); if(n>max)max=n; } });
  return yy+'-'+part+String(max+1).padStart(2,'0');
}
function _progBizOptions(year,ct,selected){
  var part=_PROG_BIZ_PART[ct]||'';
  var rows=[]; try{ rows=_finRows(year); }catch(_e){}
  var cnt={}; try{ (typeof _programsCache!=='undefined'?_programsCache:[]).forEach(function(p){ var c=String(p['사업코드']||'').trim(); if(c)cnt[c]=(cnt[c]||0)+1; }); }catch(_e){}
  var list=rows.filter(function(r){ return !part||String(r.no||'').charAt(3)===part; });
  if(selected&&!list.some(function(r){return r.no===selected;})){ var any=rows.filter(function(r){return r.no===selected;})[0]; if(any)list.unshift(any); }
  var h='<option value="">— 사업 선택 —</option>';
  list.forEach(function(r){ h+='<option value="'+escapeHtml(r.no)+'"'+(r.no===selected?' selected':'')+'>'+escapeHtml(r.no+' · '+(r.name||'(사업명 없음)')+(cnt[r.no]?' · '+cnt[r.no]+'건':''))+'</option>'; });
  if(selected&&!list.length)h+='<option value="'+escapeHtml(selected)+'" selected>'+escapeHtml(selected)+' (사업비 시트에 없음)</option>';
  return h;
}
function _progBizHtml(existing){
  if(window._PROG_BIZ_ON===false)return '';
  var code=existing?String(existing['사업코드']||'').trim():'';
  var ct=existing?String(existing['콘텐츠구분']||''):'';
  var noneCt=(ct==='대관'||ct==='기타');
  var mode=code?'existing':(noneCt?'none':'new');
  var canNew=(typeof _isAcct==='function')?_isAcct():true;
  var h='<div id="prog-biz" style="background:#F2FAF8;border:1px solid rgba(15,110,110,0.18);border-radius:10px;padding:10px 12px">';
  h+='<div style="font-size:11.5px;color:var(--accent);font-weight:700;margin-bottom:6px">🧾 사업 연결 <span style="font-weight:400;color:#888">— 사업명(1) · 사업코드(1) · 프로그램(n). 예산·실적은 사업 단위로 묶이고, 시리즈(브런치 4회 등)는 같은 사업코드를 공유해요.</span></div>';
  h+='<div style="display:flex;gap:14px;font-size:12px;margin-bottom:8px;flex-wrap:wrap">'
    +'<label style="display:flex;gap:4px;align-items:center;cursor:pointer"><input type="radio" name="사업연결" value="existing"'+(mode==='existing'?' checked':'')+' onchange="_progBizMode()"> 기존 사업에 추가</label>'
    +'<label style="display:flex;gap:4px;align-items:center;cursor:'+(canNew?'pointer':'not-allowed')+'"><input type="radio" name="사업연결" value="new"'+(mode==='new'?' checked':'')+(canNew?'':' disabled')+' onchange="_progBizMode()"> 신규 사업'+(canNew?'':' <span style="color:#888;font-size:10px">(회계·관리자만)</span>')+'</label>'
    +'<label style="display:flex;gap:4px;align-items:center;cursor:pointer"><input type="radio" name="사업연결" value="none"'+(mode==='none'?' checked':'')+' onchange="_progBizMode()"> 사업 없음</label></div>';
  h+='<div id="prog-biz-existing"><label>사업 선택 <span style="font-size:10px;color:var(--dim);font-weight:400">(같은 연도·부문의 사업비 시트)</span></label><select name="사업선택" id="prog-biz-sel" data-sel="'+escapeHtml(code)+'"><option value="">— 사업비 불러오는 중 —</option></select></div>';
  h+='<div id="prog-biz-new" style="display:none;flex-direction:column;gap:8px">'
    +'<div style="display:flex;gap:10px"><div style="flex:0 0 110px"><label>사업코드<span class="req">*</span></label><input name="신규사업코드" id="prog-biz-code" type="text" pattern="\\d{2}-[abc]\\d{2}" placeholder="26-a24" style="font-family:monospace"></div>'
    +'<div style="flex:1"><label>사업명<span class="req">*</span> <span style="font-size:10px;color:var(--dim);font-weight:400">(시리즈/사업 단위 정식 명칭)</span></label><input name="신규사업명" id="prog-biz-name" type="text" placeholder="예: 브런치 콘서트 시리즈"></div></div>'
    +'<div style="display:flex;gap:10px"><div style="flex:1"><label>회계구분</label><select name="신규회계구분"><option value="">—</option><option>공공성</option><option>사업성</option></select></div>'
    +'<div style="flex:1"><label>예산(원)</label><input name="신규예산" type="number" min="0" step="1" placeholder="0"></div>'
    +'<div style="flex:1"><label>진행월</label><input name="신규진행월" type="text" placeholder="예: 9월"></div></div>'
    +'<div style="font-size:10.5px;color:#888">저장하면 사업비 시트에 이 사업이 한 줄 추가되고(실적 칸은 비움), 이 프로그램이 그 코드에 붙어요.</div></div>';
  h+='<div id="prog-biz-none" style="display:none;font-size:11px;color:#888">사업코드 없이 등록해요(대관·기타·아직 사업이 정해지지 않은 경우). 나중에 「변경」에서 붙일 수 있어요.</div>';
  h+='</div>';
  setTimeout(function(){ try{ if(!_finState.rows){ _finLoad().then(function(){ _progBizRefresh(); }); } _progBizMode(); _progBizRefresh(); }catch(_e){} },0);
  return h;
}
function _progBizMode(){
  var r=document.querySelector('#prog-form input[name="사업연결"]:checked'); var mode=r?r.value:'existing';
  var ex=document.getElementById('prog-biz-existing'), nw=document.getElementById('prog-biz-new'), no=document.getElementById('prog-biz-none');
  if(ex)ex.style.display=(mode==='existing')?'':'none';
  if(nw)nw.style.display=(mode==='new')?'flex':'none';
  if(no)no.style.display=(mode==='none')?'':'none';
  if(mode==='new'){ var c=document.getElementById('prog-biz-code'); if(c&&!c.dataset.touched)c.value=_progBizNextCode(_progBizYear(),_progBizCt()); var n=document.getElementById('prog-biz-name'); var f=document.querySelector('#prog-form input[name="풀네임"]'); if(n&&!n.value&&f&&f.value)n.placeholder=f.value; }
}
function _progBizRefresh(){
  var sel=document.getElementById('prog-biz-sel'); if(!sel)return;
  var cur=sel.value||sel.getAttribute('data-sel')||'';
  sel.innerHTML=_progBizOptions(_progBizYear(),_progBizCt(),cur);
  var c=document.getElementById('prog-biz-code'); if(c&&!c.dataset.touched){ var r=document.querySelector('#prog-form input[name="사업연결"]:checked'); if(r&&r.value==='new')c.value=_progBizNextCode(_progBizYear(),_progBizCt()); }
  var cc=document.getElementById('prog-biz-code'); if(cc&&!cc._bound){ cc._bound=1; cc.addEventListener('input',function(){ cc.dataset.touched='1'; }); }
}
/* 폼 → {mode, code, name, acct, bud, month, err} */
function _progBizRead(fd,values){
  if(window._PROG_BIZ_ON===false||!document.getElementById('prog-biz'))return {mode:'skip',code:String((values&&values['사업코드'])||'')};
  var mode=String(fd.get('사업연결')||'existing');
  var year=_progBizYear(), ct=String(fd.get('콘텐츠구분')||'');
  if(mode==='none')return {mode:mode,code:''};
  if(mode==='existing'){ var c=String(fd.get('사업선택')||'').trim(); if(!c)return {err:'사업 연결: 기존 사업을 고르거나 「신규 사업」/「사업 없음」을 선택하세요'}; return {mode:mode,code:c}; }
  var code=String(fd.get('신규사업코드')||'').trim(), name=String(fd.get('신규사업명')||'').trim();
  if(!/^\d{2}-[abc]\d{2}$/.test(code))return {err:'사업코드 형식은 YY-부문NN (예: 26-a24)'};
  if(code.slice(0,2)!==String(year).slice(2))return {err:'사업코드 앞 두 자리('+code.slice(0,2)+')가 시작일 연도('+year+')와 달라요'};
  var part=_PROG_BIZ_PART[ct]; if(part&&code.charAt(3)!==part)return {err:'콘텐츠구분 '+ct+' 의 사업코드는 '+code.slice(0,3)+part+'NN 이어야 해요'};
  if(_progBizAllCodes(year)[code])return {err:'사업코드 '+code+' 은 이미 있어요 — 「기존 사업에 추가」로 고르세요'};
  if(!name)return {err:'신규 사업명을 입력하세요'};
  if(typeof _isAcct==='function'&&!_isAcct())return {err:'신규 사업(예산) 등록은 회계 담당자 또는 관리자만 할 수 있어요'};
  var bud=String(fd.get('신규예산')||'').replace(/[^0-9]/g,'');
  return {mode:mode,code:code,name:name,acct:String(fd.get('신규회계구분')||'').trim(),bud:bud,month:String(fd.get('신규진행월')||'').trim(),year:year,ct:ct};
}
/* 신규 사업 → 사업비 시트 행 1건 append(H-4). 프로그램 저장 성공 뒤에 호출. */
async function _progBizCommit(bz,values){
  if(!bz||bz.mode!=='new')return null;
  var bun=(bz.ct==='예술교육')?'교육':(bz.ct||'');
  var rounds=String((values&&values['회차'])||'').trim();
  var who=''; try{ who=sessionStorage.getItem('myApplicant')||''; }catch(_e){}
  var row={'사업NO':bz.code,'연도':String(bz.year),'분야':bun,'회계구분':bz.acct||'','사업명':bz.name,'연결키':'','진행월':bz.month||'','횟수':rounds,'예산':bz.bud||'','전표실적':'','판매수수료':'','정산서매출':'','유료인원':'','초대인원':'','비고':'','수정자':who,'수정일시':(typeof _finStamp==='function'?_finStamp():''),'미기입':'','구NO':''};
  var r=await api('POST','/api/ops/row',{sheet:(typeof _FIN_SHEET!=='undefined'?_FIN_SHEET:'사업비'),row:row});
  try{ _finState.rows=null; _finState._p=null; if(typeof _finIdxClear==='function')_finIdxClear(); _finLoad(true); }catch(_e){}
  return r;
}
/* [M-5] 이름 → 사업코드 (프로그램 관리 PERFS.bc → 프로그램마스터 명칭 일치). _finOf 가 이름 매칭보다 먼저 본다. */
function _finCodeOfName(name,year){
  try{
    var p=(typeof _findPerfByName==='function')?_findPerfByName(name):null;
    if(p&&p.bc)return String(p.bc);
    if(p&&p.id&&typeof _PM_BY_ID!=='undefined'&&_PM_BY_ID&&_PM_BY_ID[p.id]&&_PM_BY_ID[p.id].사업코드)return String(_PM_BY_ID[p.id].사업코드);
    if(typeof _PM!=='undefined'&&_PM&&_PM.length){ var u=_uName(name); for(var i=0;i<_PM.length;i++){ var m=_PM[i]; if((!year||Number(m.연도)===Number(year))&&m.사업코드&&_uName(m.명칭)===u)return String(m.사업코드); } }
  }catch(_e){}
  return '';
}
