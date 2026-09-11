# -*- coding: utf-8 -*-
# [260903 Phase3b] 신규 등록 때 회차 공연일 칸이 비어 있으면 기간으로 자동 채움(손대기 전까지). 본체 + tools/salesmeta_module.js 동시 치환.
import io
for P in ('public/standalone.html','tools/salesmeta_module.js'):
    s=io.open(P,encoding='utf-8').read()
    a1='<textarea name="m_공연일" id="prog-m-dates" rows="3" style="width:100%;font-family:monospace;font-size:12px">'
    assert s.count(a1)==1, P+' a1'
    s=s.replace(a1,'<textarea name="m_공연일" id="prog-m-dates" rows="3" oninput="this.dataset.touched=1;_progMetaSync(true)" style="width:100%;font-family:monospace;font-size:12px">')
    a2="    var hint=document.getElementById('prog-meta-hint'); if(hint){"
    assert s.count(a2)==1, P+' a2'
    s=s.replace(a2,"    var ta=document.getElementById('prog-m-dates'); if(ta&&!ta.dataset.touched&&!ta.value.trim()&&s&&e){ ta.value=_progMetaDateList(s,e,60).join('\\n'); }   /* [260903 Phase3b] 기간 자동 채움 */\n"+a2)
    io.open(P,'w',encoding='utf-8').write(s)
    print('OK',P,len(s))
