# -*- coding: utf-8 -*-
# [260903 Phase3 M-6/M-7] 프로그램 폼 「판매/전시 지표」 단계 + 회계구분 선택지 공공성/사업성.
#   tools/salesmeta_module.js 를 openProgramForm 앞에 삽입, 폼 마크업·저장 앵커 치환.
#   실행: python3 tools/phase3_salesmeta_260903.py  (먼저 backups/ 로 cp)
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
MOD=io.open('tools/salesmeta_module.js',encoding='utf-8').read()
assert 'function _progMetaRead(' in MOD
assert 'function _progMetaRead(' not in s, 'module already present'
def rep(a,b,label):
    global s
    assert s.count(a)==1, 'anchor %s not unique (%d)'%(label, s.count(a))
    s=s.replace(a,b)

rep('function openProgramForm(rowIndex){\n', MOD+'\nfunction openProgramForm(rowIndex){\n', 'openProgramForm')
a_biz="  html+=_progBizHtml(existing);   // [260903 Phase2 M-4] 사업 연결(기존/신규/없음)\n"
rep(a_biz, a_biz+"  html+=_progMetaHtml(existing);   // [260903 Phase3 M-6] 판매/전시 지표(공연마스터·회차상세·전시마스터)\n", 'biz')
rep('onchange="_progSyncSpan();_progBizRefresh()">', 'onchange="_progSyncSpan();_progBizRefresh();_progMetaRefresh()">', 'start')
rep('onchange="refreshManagerOptions(this.value);_progBizRefresh()">', 'onchange="refreshManagerOptions(this.value);_progBizRefresh();_progMetaRefresh()">', 'ct')
rep('<input id="prog-end" name="종료일" type="date" value="\'+v.종료+\'" required onchange="_progSyncSpan()">', '<input id="prog-end" name="종료일" type="date" value="\'+v.종료+\'" required onchange="_progSyncSpan();_progMetaRefresh()">', 'end')
rep('placeholder="예: 5" oninput="_progSyncSpan()">', 'placeholder="예: 5" oninput="_progSyncSpan();_progMetaSync()">', 'rounds')
rep('<input name="장소" type="text" value="\'+escapeHtml(v.장소)+\'">', '<input name="장소" type="text" value="\'+escapeHtml(v.장소)+\'" oninput="_progMetaSync()">', 'place')
a_bz="  if(_bz&&_bz.mode!=='skip')values['사업코드']=_bz.code||'';\n"
rep(a_bz, a_bz+"  // [260903 Phase3 M-6] 판매/전시 지표 읽기·검증(형식·기간 밖 회차일)\n  var _mt=_progMetaRead(fd,values);\n  if(_mt&&_mt.err){ showToast('저장할 수 없어요 · '+_mt.err,'error'); return; }\n", 'bz')
a_cm="    try{ await _progBizCommit(_bz,values); }catch(_be){ showToast('프로그램은 저장됐지만 사업비 행 생성 실패: '+(_be&&_be.message||_be),'error'); }   // [260903 Phase2] 신규 사업 → 사업비 append(H-4)\n"
rep(a_cm, a_cm+"    try{ await _progMetaCommit(_mt,values); }catch(_me){ showToast('프로그램은 저장됐지만 지표 저장 실패: '+(_me&&_me.message||_me),'error'); }   // [260903 Phase3] 공연마스터·회차상세 / 전시마스터 upsert(H-4)\n", 'commit')
# 회계구분 선택지 (운영자 260903: 공공성/사업성 체계)
rep('<option value="">—</option><option>예술성</option><option>상업성</option><option>공공성</option>', '<option value="">—</option><option>공공성</option><option>사업성</option>', 'acct')
io.open(P,'w',encoding='utf-8').write(s)
print('OK phase3 applied', len(s))
