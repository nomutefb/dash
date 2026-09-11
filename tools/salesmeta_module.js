/* ═══ [260903 Phase3 M-6/M-7] 프로그램 등록 폼 「판매/전시 지표」 단계 ═══
   원칙(청사진 §0-4·§3.3): 지금 시트에 입력값으로 들어가 있는 지표(공연마스터 기준석·총회차·총오픈석·목표점유율·수익성·티켓오픈일,
   회차상세 공연일, 전시마스터 목표관객·목표금액·운영일수·무료여부)는 전부 웹앱 폼에서 넣는다. 상태(판매중/예정/진행중/종료)는 날짜에서 파생(C-8).
   저장 = 프로그램 저장 성공 뒤 `_progMetaCommit`: 공연 → 공연마스터 upsert(PATCH ops/row → 404면 POST) + 회차상세 교체(바뀐 경우만) ·
   전시 → 전시마스터 upsert. 예술교육·대관·기타는 단계 생략. 끄기: window._PROG_META_ON=false. */
var _PROG_META_SEATS={'대극장':926,'소극장':304};
var _progMetaCache={perf:null,exhib:null,rounds:null,at:0};
function _progMetaLoad(force){
  var now=Date.now();
  if(!force&&_progMetaCache.perf&&(now-_progMetaCache.at)<60000)return Promise.resolve(_progMetaCache);
  return Promise.all([
    api('GET','/api/ops?sheet='+encodeURIComponent('공연마스터')+(force?'&fresh=1':'')).catch(function(){return null;}),
    api('GET','/api/ops?sheet='+encodeURIComponent('전시마스터')+(force?'&fresh=1':'')).catch(function(){return null;}),
    api('GET','/api/ops?sheet='+encodeURIComponent('회차상세')+(force?'&fresh=1':'')).catch(function(){return null;})
  ]).then(function(r){ _progMetaCache={perf:(r[0]&&r[0].rows)||[],exhib:(r[1]&&r[1].rows)||[],rounds:(r[2]&&r[2].rows)||[],at:Date.now()}; return _progMetaCache; });
}
function _progMetaIso(v){ var s=String(v==null?'':v).trim(); var m=s.match(/^(\d{4})[-./]?(\d{2})[-./]?(\d{2})/); return m?(m[1]+'-'+m[2]+'-'+m[3]):''; }
function _progMetaToday(){ return new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}); }
/* 상태 파생(C-8): 공연마스터 = 종료일 지나면 종료, 아니면 판매중 · 전시마스터 = 예정/진행중/종료 */
function _progMetaStatus(kind,s,e){ var t=_progMetaToday(); if(kind==='perf')return (e&&e<t)?'종료':'판매중'; if(!s||t<s)return '예정'; if(e&&t>e)return '종료'; return '진행중'; }
function _progMetaDays(s,e){ if(!s||!e)return ''; var a=new Date(s+'T00:00:00Z'),b=new Date(e+'T00:00:00Z'); var n=Math.round((b-a)/86400000)+1; return n>0?String(n):''; }
function _progMetaDateList(s,e,max){ var out=[]; if(!s||!e)return out; var a=new Date(s+'T00:00:00Z'),b=new Date(e+'T00:00:00Z'); for(var d=a;d<=b&&out.length<(max||60);d=new Date(d.getTime()+86400000))out.push(d.toISOString().slice(0,10)); return out; }
function _progMetaKind(ct){ return ct==='공연'?'perf':(ct==='전시'?'exhib':'none'); }
function _progMetaHtml(existing){
  if(window._PROG_META_ON===false)return '';
  var id=existing?String(existing['프로그램ID']||existing['공연ID']||'').trim():'';
  var h='<div id="prog-meta" data-id="'+escapeHtml(id)+'" style="background:#FFF8F0;border:1px solid rgba(180,83,9,0.18);border-radius:10px;padding:10px 12px">';
  h+='<div style="font-size:11.5px;color:#b45309;font-weight:700;margin-bottom:6px">📊 판매/전시 지표 <span style="font-weight:400;color:#888">— 객체(프로그램ID) 단위. 공연은 공연마스터·회차상세, 전시는 전시마스터에 저장돼요. 상태는 날짜로 자동.</span></div>';
  h+='<div id="prog-meta-body"><div style="font-size:11px;color:#888">콘텐츠구분에 따라 칸이 바뀌어요.</div></div></div>';
  setTimeout(function(){ try{ _progMetaRefresh(); _progMetaLoad().then(function(){ _progMetaRefresh(true); }); }catch(_e){} },0);
  return h;
}
function _progMetaCurrent(kind,id){
  if(!id)return null;
  if(kind==='perf')return (_progMetaCache.perf||[]).filter(function(r){return String(r['ID']||'').trim()===id;})[0]||null;
  if(kind==='exhib')return (_progMetaCache.exhib||[]).filter(function(r){return String(r['전시ID']||'').trim()===id;})[0]||null;
  return null;
}
function _progMetaRounds(id){ return (_progMetaCache.rounds||[]).filter(function(r){return String(r['ID']||'').trim()===id;}).map(function(r){return _progMetaIso(r['공연일']);}).filter(Boolean); }
function _progMetaRefresh(fromLoad){
  var box=document.getElementById('prog-meta'), body=document.getElementById('prog-meta-body'); if(!box||!body)return;
  var f=document.getElementById('prog-form'); if(!f)return;
  var ct=String((f.querySelector('select[name="콘텐츠구분"]')||{}).value||''), kind=_progMetaKind(ct);
  var id=box.getAttribute('data-id')||'';
  var s=String((f.querySelector('#prog-start')||{}).value||''), e=String((f.querySelector('#prog-end')||{}).value||'');
  var place=String((f.querySelector('input[name="장소"]')||{}).value||'').trim();
  var rounds=parseInt(String((f.querySelector('#prog-rounds')||{}).value||'').replace(/[^0-9]/g,''),10)||0;
  var saleS=String((f.querySelector('#prog-sale-start')||{}).value||'');
  if(body.getAttribute('data-kind')===kind&&!fromLoad){ _progMetaSync(); return; }   // 같은 종류면 값만 동기화
  var cur=_progMetaCurrent(kind,id), g=function(k){ return cur?String(cur[k]==null?'':cur[k]).trim():''; };
  var h='';
  if(kind==='perf'){
    var seat=g('기준석')||String(_PROG_META_SEATS[place]||''), rc=g('총회차')||(rounds||''), open=g('총오픈석')||((seat&&rc)?String(Number(seat)*Number(rc)):'');
    var prof=g('수익성'); if(prof==='상업성')prof='사업성';
    var dates=_progMetaRounds(id); if(!dates.length)dates=_progMetaDateList(s,e,60);
    h+='<div style="display:flex;gap:10px"><div style="flex:1"><label>기준석 <span style="font-size:10px;color:var(--dim);font-weight:400">(대극장 926·소극장 304)</span></label><input name="m_기준석" id="prog-m-seat" type="number" min="0" value="'+escapeHtml(seat)+'" oninput="_progMetaSync(true)"></div>'
      +'<div style="flex:1"><label>총회차 <span style="font-size:10px;color:var(--dim);font-weight:400">(위 공연 회차와 같음)</span></label><input name="m_총회차" id="prog-m-rounds" type="number" min="0" value="'+escapeHtml(String(rc))+'" oninput="_progMetaSync(true)"></div>'
      +'<div style="flex:1"><label>총오픈석 <span style="font-size:10px;color:var(--dim);font-weight:400">(기준석×회차, 수정 가능)</span></label><input name="m_총오픈석" id="prog-m-open" type="number" min="0" value="'+escapeHtml(open)+'" oninput="this.dataset.touched=1"></div></div>';
    h+='<div style="display:flex;gap:10px"><div style="flex:1"><label>목표점유율(%)</label><input name="m_목표점유율" type="number" min="0" max="100" value="'+escapeHtml(g('목표점유율'))+'" placeholder="예: 60"></div>'
      +'<div style="flex:1"><label>수익성</label><select name="m_수익성"><option value=""'+(prof===''?' selected':'')+'>—</option><option'+(prof==='공공성'?' selected':'')+'>공공성</option><option'+(prof==='사업성'?' selected':'')+'>사업성</option></select></div>'
      +'<div style="flex:1"><label>티켓오픈일 <span style="font-size:10px;color:var(--dim);font-weight:400">(비우면 판매시작일)</span></label><input name="m_티켓오픈일" id="prog-m-open-date" type="date" value="'+escapeHtml(_progMetaIso(g('티켓오픈일'))||saleS)+'"></div></div>';
    h+='<div><label>회차 공연일 <span style="font-size:10px;color:var(--dim);font-weight:400">(한 줄에 하나, YYYY-MM-DD · 같은 날 2회면 두 줄 · 비우면 회차상세 안 씀)</span></label><textarea name="m_공연일" id="prog-m-dates" rows="3" oninput="this.dataset.touched=1;_progMetaSync(true)" style="width:100%;font-family:monospace;font-size:12px">'+escapeHtml(dates.join('\n'))+'</textarea></div>';
    h+='<div id="prog-meta-hint" style="font-size:11px;color:#888"></div>';
  } else if(kind==='exhib'){
    var free=g('무료여부'); var isFree=/^(y|yes|true|1|무료|o)$/i.test(free);
    h+='<div style="display:flex;gap:10px"><div style="flex:1"><label>목표관객(명)</label><input name="m_목표관객" type="number" min="0" value="'+escapeHtml(g('목표관객'))+'"></div>'
      +'<div style="flex:1"><label>목표금액(원)</label><input name="m_목표금액" type="number" min="0" value="'+escapeHtml(g('목표금액'))+'"></div>'
      +'<div style="flex:0 0 120px"><label>운영일수 <span style="font-size:10px;color:var(--dim);font-weight:400">(기간 자동)</span></label><input name="m_운영일수" id="prog-m-days" type="number" min="0" value="'+escapeHtml(g('운영일수')||_progMetaDays(s,e))+'"></div></div>';
    h+='<div style="display:flex;gap:14px;align-items:center;font-size:12px"><label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" name="m_무료여부" value="Y"'+(isFree?' checked':'')+'> 무료 전시(판매 축 제외)</label><span style="color:#888;font-size:11px">상태: '+escapeHtml(_progMetaStatus('exhib',s,e))+' (자동)</span></div>';
  } else {
    h+='<div style="font-size:11px;color:#888">'+escapeHtml(ct||'—')+' 은 판매/전시 지표 단계가 없어요(예술교육 지표 열은 확정 전 · 대관/기타는 대상 아님).</div>';
  }
  body.setAttribute('data-kind',kind); body.innerHTML=h;
  _progMetaSync();
}
/* 폼 위쪽 값(회차·장소·기간·판매시작일) → 지표 칸 동기화 */
function _progMetaSync(fromMeta){
  var f=document.getElementById('prog-form'); if(!f)return;
  var kind=(document.getElementById('prog-meta-body')||{}).getAttribute?document.getElementById('prog-meta-body').getAttribute('data-kind'):'';
  var s=String((f.querySelector('#prog-start')||{}).value||''), e=String((f.querySelector('#prog-end')||{}).value||'');
  if(kind==='perf'){
    var seat=document.getElementById('prog-m-seat'), rc=document.getElementById('prog-m-rounds'), open=document.getElementById('prog-m-open');
    var place=String((f.querySelector('input[name="장소"]')||{}).value||'').trim();
    if(seat&&!seat.value&&_PROG_META_SEATS[place])seat.value=_PROG_META_SEATS[place];
    var topRc=parseInt(String((f.querySelector('#prog-rounds')||{}).value||'').replace(/[^0-9]/g,''),10)||0;
    if(rc&&!fromMeta&&topRc)rc.value=topRc;
    if(open&&!open.dataset.touched){ var a=Number(seat&&seat.value)||0,b=Number(rc&&rc.value)||0; open.value=(a&&b)?String(a*b):''; }
    var ta=document.getElementById('prog-m-dates'); if(ta&&!ta.dataset.touched&&!ta.value.trim()&&s&&e){ ta.value=_progMetaDateList(s,e,60).join('\n'); }   /* [260903 Phase3b] 기간 자동 채움 */
    var hint=document.getElementById('prog-meta-hint'); if(hint){ var n=(document.getElementById('prog-m-dates')||{value:''}).value.split(/\n/).map(function(x){return x.trim();}).filter(Boolean).length; hint.textContent='회차 공연일 '+n+'줄 · 상태 '+_progMetaStatus('perf',s,e)+'(자동)'+((rc&&Number(rc.value)&&n&&Number(rc.value)!==n)?' · ⚠ 총회차('+rc.value+')와 공연일 줄 수('+n+')가 달라요':''); }
  } else if(kind==='exhib'){
    var d=document.getElementById('prog-m-days'); if(d&&!d.dataset.touched){ d.value=_progMetaDays(s,e); }
  }
}
/* 폼 → {kind, id, fields, dates, err} */
function _progMetaRead(fd,values){
  if(window._PROG_META_ON===false||!document.getElementById('prog-meta'))return {kind:'skip'};
  var ct=String(fd.get('콘텐츠구분')||''), kind=_progMetaKind(ct);
  if(kind==='none')return {kind:'none'};
  var id=String((values&&values['프로그램ID'])||'').trim();
  if(!id)return {err:'프로그램ID가 없어 지표를 저장할 수 없어요(시작일을 넣어주세요)'};
  var s=String(fd.get('시작일')||'').trim(), e=String(fd.get('종료일')||'').trim();
  if(kind==='perf'){
    var dates=String(fd.get('m_공연일')||'').split(/\n/).map(function(x){return x.trim();}).filter(Boolean);
    for(var i=0;i<dates.length;i++){ if(!/^\d{4}-\d{2}-\d{2}$/.test(dates[i]))return {err:'회차 공연일 형식 오류: '+dates[i]}; if((s&&dates[i]<s)||(e&&dates[i]>e))return {err:'회차 공연일 '+dates[i]+' 이 진행 기간 밖이에요'}; }
    var prof=String(fd.get('m_수익성')||'').trim();
    return {kind:kind,id:id,s:s,e:e,dates:dates,fields:{'기준석':String(fd.get('m_기준석')||'').trim(),'총회차':String(fd.get('m_총회차')||'').trim(),'총오픈석':String(fd.get('m_총오픈석')||'').trim(),'목표점유율':String(fd.get('m_목표점유율')||'').trim(),'수익성':prof,'티켓오픈일':String(fd.get('m_티켓오픈일')||fd.get('판매시작일')||'').trim(),'상태':_progMetaStatus('perf',s,e)}};
  }
  return {kind:kind,id:id,s:s,e:e,fields:{'목표관객':String(fd.get('m_목표관객')||'').trim(),'목표금액':String(fd.get('m_목표금액')||'').trim(),'운영일수':String(fd.get('m_운영일수')||'').trim()||_progMetaDays(s,e),'무료여부':(fd.get('m_무료여부')?'Y':''),'상태':_progMetaStatus('exhib',s,e)}};
}
async function _progMetaUpsert(sheet,keyCol,id,patch,fullRow){
  try{ return await api('PATCH','/api/ops/row',{sheet:sheet,keyCol:keyCol,key:id,patch:patch}); }
  catch(e){ if(!/404/.test(String(e&&e.message||e)))throw e; return await api('POST','/api/ops/row',{sheet:sheet,row:fullRow}); }
}
/* 프로그램 저장 성공 뒤 호출. 실패는 throw → 호출측이 토스트. */
async function _progMetaCommit(meta,values){
  if(!meta||meta.kind==='skip'||meta.kind==='none')return null;
  var id=meta.id, name=String((values&&values['풀네임'])||''), code=String((values&&values['사업코드'])||'');
  var yr=(meta.s||'').slice(0,4);
  if(meta.kind==='perf'){
    var patch=Object.assign({'사업명':name,'시작일':meta.s,'종료일':meta.e,'사업코드':code},meta.fields);
    var full=Object.assign({'ID':id},patch);
    await _progMetaUpsert('공연마스터','ID',id,patch,full);
    var cur=_progMetaRounds(id).slice().sort(), want=meta.dates.slice().sort();
    if(meta.dates.length&&cur.join('|')!==want.join('|')){
      for(var k=0;k<80;k++){ try{ await api('DELETE','/api/ops/row',{sheet:'회차상세',keyCol:'ID',key:id}); }catch(e){ break; } }
      for(var i=0;i<meta.dates.length;i++)await api('POST','/api/ops/row',{sheet:'회차상세',row:{'ID':id,'공연일':meta.dates[i]}});
    }
    try{ if(typeof _salesState!=='undefined'&&_salesState){ _salesState.master=null; _salesState.rounds=null; } if(typeof _srailInit==='function')_srailInit(true); }catch(_e){}
  } else {
    var patch2=Object.assign({'전시명':name,'연도':yr,'시작일':meta.s,'종료일':meta.e,'장소':String((values&&values['장소'])||''),'사업코드':code},meta.fields);
    var full2=Object.assign({'전시ID':id},patch2);
    await _progMetaUpsert('전시마스터','전시ID',id,patch2,full2);
    try{ if(typeof _anaState!=='undefined'&&_anaState){ _anaState._exMaster=null; } if(typeof _dailyState!=='undefined'&&_dailyState)_dailyState.exMaster=null; window._bizmExFail=0; if(typeof _bizExhibEnsure==='function')_bizExhibEnsure(); if(typeof _exMasterFallback!=='undefined'){ _exMasterFallback=null; if(typeof _exMasterLoad==='function')_exMasterLoad(); } }catch(_e){}
  }
  _progMetaCache.at=0;
  return true;
}
