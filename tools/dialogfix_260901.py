# -*- coding: utf-8 -*-
# [260901] 홍보 신청 닫기 대화상자 2지선다 + 버튼 줄바꿈 금지(.c-btn/.m-btn nowrap)
p='public/standalone.html'
s=open(p,encoding='utf-8').read()
pairs=[
('''  // 신청/이어쓰기 작성 중 → 한 창에서 3지선다: 계속 작성 | 임시 저장 | 닫기
  const choice=await showChoice('작성 중인 내용을 어떻게 할까요?',[
    {label:'계속 작성',value:'continue'},
    {label:'임시 저장',value:'save'},
    {label:'닫기',value:'close',danger:true}
  ],{title:'임시저장'});
  if(choice==='save'){ if(await _pwSaveDraft())_doClose(); return; }
  if(choice==='close'){ _doClose(); return; }''',
 '''  // [260901 운영자] 2지선다: 계속 작성 | 닫기(폐기) — 임시 저장 버튼 제거, 닫기 = 기록 없이 폐기(위저드는 열 때마다 초기화되므로 닫는 즉시 내용 소멸)
  const choice=await showChoice('작성 중인 내용은 기록되지 않습니다. 닫을까요?',[
    {label:'계속 작성',value:'continue'},
    {label:'닫기',value:'close',danger:true}
  ],{title:'안내'});
  if(choice==='close'){ _doClose(); return; }'''),
('''.c-btn{padding:11px 26px;border-radius:12px;font-size:13.5px;border:none;cursor:pointer;transition:all .15s;min-width:90px;font-family:inherit}''',
 '''.c-btn{padding:11px 26px;border-radius:12px;font-size:13.5px;border:none;cursor:pointer;transition:all .15s;min-width:90px;font-family:inherit;white-space:nowrap}'''),
('''.m-btn{padding:10px 22px;border-radius:12px;font-size:13px;font-weight:600;border:none;transition:all .2s}''',
 '''.m-btn{padding:10px 22px;border-radius:12px;font-size:13px;font-weight:600;border:none;transition:all .2s;white-space:nowrap}'''),
]
for a,b in pairs:
    assert s.count(a)==1, 'anchor %d'%s.count(a)
for a,b in pairs:
    s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s)
print('replaced ok 3/3')
