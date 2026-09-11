# -*- coding: utf-8 -*-
# [260902] 실적 표기 개편: 상태 접두([진행 중]) · ● 미기입 → 주황 '추가 기입 필요' · 기입 완료 칸 강조색 30% 음영
p='public/standalone.html'
s=open(p,encoding='utf-8').read()
pairs=[
("""function _finBlank(r){
  if(!r)return [];
  var b=String(r.blank||'').split('|'), ax=_FIN_AXIS[r.cat]||{};
  return _FIN_FILL.filter(function(k){ return !ax[k] && b.indexOf(k)>=0; });
}""","""function _finBlank(r){
  if(!r)return [];
  var b=String(r.blank||'').split('|'), ax=_FIN_AXIS[r.cat]||{};
  return _FIN_FILL.filter(function(k){ return !ax[k] && b.indexOf(k)>=0; });
}
// [260902 운영자] 사업 상태 = 연결된 공연(운영대장) 기간으로 판정: 예정 · 진행 중 · 완료. 연결이 없으면 지난 연도만 완료, 올해는 빈칸(모르는 걸 단정 안 함).
//   「아직 안 끝난 공연은 미기입이 당연하다」 — 그래서 상태를 이름 맨 앞에 세운다(분야별 표·사업 지표 입력 공통).
function _finStatus(r,lm){
  try{
    var names=(lm&&lm.byNo&&lm.byNo[r.no])||[];
    var today=(typeof dk==='function')?dk(new Date()):new Date().toISOString().slice(0,10);
    var best=null;
    names.forEach(function(nm){ var k=_uName(nm); ((typeof PERFS!=='undefined'&&PERFS)||[]).forEach(function(p){ if(p&&p.s&&p.e&&_uName(p.f||p.n)===k){ if(!best||p.e>best.e)best=p; } }); });
    if(!best){ var yr=Number(r.y)||0, cy=new Date().getFullYear(); return (yr&&yr<cy)?{lab:'완료',on:false}:{lab:'',on:false}; }
    if(today<best.s)return {lab:'예정',on:false};
    if(today>best.e)return {lab:'완료',on:false};
    return {lab:'진행 중',on:true};
  }catch(_e){ return {lab:'',on:false}; }
}
function _finStatusTag(st){ return (st&&st.lab)?('<span style=\"font-weight:700;color:'+(st.on?'var(--accent)':'var(--dim)')+'\">['+st.lab+']</span> '):''; }
// 연결 지도 캐시(30초) — 드롭다운은 행마다 부르므로 연도별로 한 번만 만든다
function _finLmOf(y){ var c=_finState._lmc||(_finState._lmc={}); var e=c[y]; if(!e||(Date.now()-e.t)>30000){ e=c[y]={t:Date.now(),m:_finLinkMap(y)}; } return e.m; }"""),
("""+rows.map(function(r){ var b=_finBlank(r).length,ry=r.y||year,val=isAll?String(ry)+'|'+r.no:r.no;
        return '<option value=\"'+escapeHtml(val)+'\"'+(r.no===_finIn.no?' selected':'')+'>'
          +escapeHtml((isAll?'['+ry+'] ':'')+r.name+' · '+r.cat+(r.acct?' · '+r.acct:'')+' · '+r.no+(b?'  ● 미기입 '+b:''))+'</option>'; }).join('')""","""+rows.map(function(r){ var b=_finBlank(r).length,ry=r.y||year,val=isAll?String(ry)+'|'+r.no:r.no;
        var st=_finStatus(r,_finLmOf(ry)), stl=st.lab?'['+st.lab+'] ':'';   /* [260902 운영자] 맨 앞 상태 · ● 제거 → 「추가 기입 필요」(팔레트 주황 --c2) */
        return '<option value=\"'+escapeHtml(val)+'\"'+(r.no===_finIn.no?' selected':'')+(b?' style=\"color:var(--c2);font-weight:600\"':'')+'>'
          +escapeHtml(stl+(isAll?'['+ry+'] ':'')+r.name+' · '+r.cat+(r.acct?' · '+r.acct:'')+' · '+r.no+(b?'  · 추가 기입 필요 '+b:''))+'</option>'; }).join('')"""),
("""+(isBl(k)?' <span style=\"font-weight:700;color:var(--peach-text)\">미입력</span>':'')+'</label>'""","""+(isBl(k)?' <span style=\"font-weight:700;color:var(--c2)\">추가 기입 필요</span>':'')+'</label>'"""),
("""' style=\"border:1px solid var(--border2);background:var(--surface-solid);text-align:right;font-variant-numeric:tabular-nums\"></div>';""","""' style=\"border:1px solid var(--border2);background:'+(isBl(k)?'var(--surface-solid)':'color-mix(in srgb,var(--accent) 30%,transparent)')+';text-align:right;font-variant-numeric:tabular-nums\"></div>';   /* [260902 운영자] 기입 완료 칸 = 강조색 30% 음영 */"""),
("""+'<b>'+escapeHtml(r.no)+'</b> · '+escapeHtml(r.cat)+(r.acct?' · '+escapeHtml(r.acct):'')+' · <b>'+escapeHtml(r.name)+'</b></div>';""","""+_finStatusTag(_finStatus(r,_finLmOf(r.y||year)))+'<b>'+escapeHtml(r.no)+'</b> · '+escapeHtml(r.cat)+(r.acct?' · '+escapeHtml(r.acct):'')+' · <b>'+escapeHtml(r.name)+'</b></div>';"""),
("""'<span style=\"flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\">'+escapeHtml(_finShowName(r,_lm))+'</span>'""","""'<span style=\"flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\">'+_finStatusTag(_finStatus(r,_lm))+escapeHtml(_finShowName(r,_lm))+'</span>'"""),
("""+(_bl.length?'<span style=\"flex:0 0 auto;font-weight:600;color:var(--peach-text);white-space:nowrap\">미기입 '+_bl.length+'</span>':'')""","""+(_bl.length?'<span style=\"flex:0 0 auto;font-weight:600;color:var(--c2);white-space:nowrap\">추가 기입 필요 '+_bl.length+'</span>':'')"""),
("""+'<td style=\"padding:7px 12px;text-align:right;color:var(--peach-text);font-weight:600;font-variant-numeric:tabular-nums\">'+_finMil(c.cost)+'</td>'""","""+'<td style=\"padding:7px 12px;text-align:right;color:var(--peach-text);font-weight:600;font-variant-numeric:tabular-nums'+(_noCost?'':';background:color-mix(in srgb,var(--accent) 30%,transparent)')+'\">'+_finMil(c.cost)+'</td>'"""),
("""+'<td style=\"padding:7px 12px;text-align:right;color:var(--green);font-weight:600;font-variant-numeric:tabular-nums\">'+_finMil(r.rev||0)+'</td>'""","""+'<td style=\"padding:7px 12px;text-align:right;color:var(--green);font-weight:600;font-variant-numeric:tabular-nums'+(_bl.indexOf('rev')>=0?'':';background:color-mix(in srgb,var(--accent) 30%,transparent)')+'\">'+_finMil(r.rev||0)+'</td>'"""),
("""function _finIdxClear(){ _finState._idx=null; _finState._idxY=null; }""","""function _finIdxClear(){ _finState._idx=null; _finState._idxY=null; _finState._lmc=null; }"""),
]
for a,b in pairs:
    assert s.count(a)==1, 'anchor %d: %s'%(s.count(a),a[:40])
for a,b in pairs:
    s=s.replace(a,b,1)
open(p,'w',encoding='utf-8').write(s)
print('replaced ok %d/%d'%(len(pairs),len(pairs)))
