# -*- coding: utf-8 -*-
# [260903 Phase2 M-4/M-5/M-13] 프로그램 폼 「사업 연결」 단계 + 사업코드 우선 조인.
#   tools/bizlink_module.js 를 openProgramForm 앞에 삽입, 폼 마크업·저장·programToPerf·_finOf 앵커 치환.
#   실행: python3 tools/phase2_bizlink_260903.py  (먼저 backups/ 로 cp)
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
MOD=io.open('tools/bizlink_module.js',encoding='utf-8').read()
assert 'function _progBizRead(' in MOD
assert 'function _progBizRead(' not in s, 'module already present'
def rep(a,b,label):
    global s
    assert s.count(a)==1, 'anchor %s not unique (%d)'%(label, s.count(a))
    s=s.replace(a,b)

# 1) 모듈 삽입
rep('function openProgramForm(rowIndex){\n', MOD+'\nfunction openProgramForm(rowIndex){\n', 'openProgramForm')

# 2) 폼: URL 칸 다음에 사업 연결 단계
a_url="html+='<div><label>URL <span style=\"font-size:10px;color:var(--dim);font-weight:400\">(예매·상세 링크 · 선택)</span></label><input name=\"URL\" type=\"url\" value=\"'+escapeHtml(v.URL)+'\" placeholder=\"https://www.yeulmaru.org/...\"></div>';\n"
rep(a_url, a_url+"  html+=_progBizHtml(existing);   // [260903 Phase2 M-4] 사업 연결(기존/신규/없음)\n", 'url')

# 3) 시작일·콘텐츠구분 바뀌면 사업 목록·자동 코드 갱신
rep('<input id="prog-start" name="시작일" type="date" value="\'+v.시작+\'" required onchange="_progSyncSpan()">',
    '<input id="prog-start" name="시작일" type="date" value="\'+v.시작+\'" required onchange="_progSyncSpan();_progBizRefresh()">', 'start')
rep('onchange="refreshManagerOptions(this.value)">', 'onchange="refreshManagerOptions(this.value);_progBizRefresh()">', 'ct')

# 4) 저장: 값 객체 뒤에 사업 연결 읽기·검증 → 사업코드 기록, 저장 성공 뒤 신규 사업이면 사업비 행 append
a_vals="    '장르':_sideCells['장르']\n  };\n"
rep(a_vals, a_vals+"  // [260903 Phase2 M-4] 사업 연결 — 기존 선택 / 신규(사업비 행 생성) / 없음. 검증 실패면 저장 중단.\n  var _bz=_progBizRead(fd,values);\n  if(_bz&&_bz.err){ showToast('저장할 수 없어요 · '+_bz.err,'error'); return; }\n  if(_bz&&_bz.mode!=='skip')values['사업코드']=_bz.code||'';\n", 'values')
a_post="      await api('POST','/api/sheet/program',{values});\n    }\n"
rep(a_post, a_post+"    try{ await _progBizCommit(_bz,values); }catch(_be){ showToast('프로그램은 저장됐지만 사업비 행 생성 실패: '+(_be&&_be.message||_be),'error'); }   // [260903 Phase2] 신규 사업 → 사업비 append(H-4)\n", 'post')

# 5) PERFS 에 사업코드 실어 보내기 (이름→코드 조인용)
a_id="id:String(p['프로그램ID']||p['공연ID']||'').trim(),"
rep(a_id, a_id+"\n    bc:String(p['사업코드']||'').trim(),   // [260903 Phase2 M-5] 사업코드 — _finOf 가 이름보다 먼저 본다", 'p2p')

# 6) _finOf: 사업코드 우선, 이름 매칭은 폴백
a_fin="function _finOf(name,year){\n  if(!name)return null;\n  var ix=_finIdx(year),k=_uName(name);"
rep(a_fin, "function _finOf(name,year){\n  if(!name)return null;\n  var ix=_finIdx(year),k=_uName(name);\n  try{ var _bc=_finCodeOfName(name,year); if(_bc&&ix.byNo[_bc])return ix.byNo[_bc]; }catch(_e){}   // [260903 Phase2 M-5] 사업코드 우선(이름 폴백은 Phase 6 에서 제거)", 'finOf')

io.open(P,'w',encoding='utf-8').write(s)
print('OK phase2 bizlink applied', len(s))
