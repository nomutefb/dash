# tools/mgrcols_260906.py — [260906 운영자] 사용자 관리 표: 권한 열(홍보·관리자·회계)을 오른쪽으로 빼고 세로 구분선으로 가른다.
#   프로그램 담당 영역(기관·공연·전시·교육·대관)과 권한 영역은 다른 성격이라는 운영자 지시.
#   열 순서 변경이 안전한 이유: 저장은 이제 열 이름(_sheetValuesObj, v390)으로 보내므로 위치와 무관.
#   두 번 실행해도 안전(표식 있으면 건너뜀). 다른 파일은 건드리지 않는다.
import io, sys
P = "public/standalone.html"
s = io.open(P, encoding="utf-8").read()
MARK = "[260906 권한열분리]"
if MARK in s:
    print("이미 적용됨 — 건너뜀"); sys.exit(0)
def once(hay, needle):
    c = hay.count(needle)
    if c != 1:
        print("앵커 %d개(1개여야 함): %r" % (c, needle[:80])); sys.exit(1)
# 1) 열 순서: 홍보를 앞에서 빼고, 이메일 뒤에 홍보(구분선)·관리자·회계
A1 = "      {key:'홍보여부',label:'홍보',type:'checkbox'},\n      {key:'기관여부',label:'기관',type:'checkbox'},"
once(s, A1)
s = s.replace(A1, "      {key:'기관여부',label:'기관',type:'checkbox'},")
A2 = "      {key:'계정여부',label:'활성',type:'checkbox'},\n      {key:'관리자여부',label:'관리자',type:'checkbox'},\n      {key:'이메일',label:'이메일',type:'text'},\n      {key:'회계여부',label:'회계',type:'checkbox'}\n    ]"
once(s, A2)
s = s.replace(A2, "      {key:'계정여부',label:'활성',type:'checkbox'},\n      {key:'이메일',label:'이메일',type:'text'},\n      // " + MARK + " 권한 열은 오른쪽 묶음(세로 구분선) — 프로그램 담당 열(기관·공연·전시·교육·대관)과 성격이 다르다. sep = 구분선 시작 열.\n      {key:'홍보여부',label:'홍보',type:'checkbox',sep:true},\n      {key:'관리자여부',label:'관리자',type:'checkbox'},\n      {key:'회계여부',label:'회계',type:'checkbox'}\n    ]")
# 2) 표 머리·셀에 구분선
SEP = "(c.sep?'border-left:2px solid var(--border);padding-left:12px;':'')"
A3 = "cfg.columns.forEach(c=>{if(c.hidden)return;html+='<th'+(c.type==='checkbox'?' style=\"width:46px;padding:11px 3px;text-align:center\"':'')+'>'+escapeHtml(c.label)+'</th>';});"
once(s, A3)
s = s.replace(A3, "cfg.columns.forEach(c=>{if(c.hidden)return;html+='<th style=\"'+(c.type==='checkbox'?'width:46px;padding:11px 3px;text-align:center;':'')+" + SEP + "+'\">'+escapeHtml(c.label)+'</th>';});")
A4 = "html+='<td style=\"text-align:center;width:46px;padding-left:3px;padding-right:3px\"><input type=\"checkbox\" class=\"inl-cb\""
once(s, A4)
s = s.replace(A4, "html+='<td style=\"text-align:center;width:46px;padding-left:3px;padding-right:3px;'+" + SEP + "+'\"><input type=\"checkbox\" class=\"inl-cb\"")
A5 = "html+='<td><input type=\"text\" class=\"inl-input\" data-key=\"'+escapeHtml(c.key)+'\" value=\"'+escapeHtml(raw||'')+'\" oninput=\"markRowDirty(\\''+slug+'\\','+r._rowIndex+')\"></td>';"
once(s, A5)
s = s.replace(A5, "html+='<td style=\"'+" + SEP + "+'\"><input type=\"text\" class=\"inl-input\" data-key=\"'+escapeHtml(c.key)+'\" value=\"'+escapeHtml(raw||'')+'\" oninput=\"markRowDirty(\\''+slug+'\\','+r._rowIndex+')\"></td>';")
A6 = "        html+='<td>'+val+'</td>';\n      }\n    });"
once(s, A6)
s = s.replace(A6, "        html+='<td style=\"'+" + SEP + "+'\">'+val+'</td>';\n      }\n    });")
io.open(P, "w", encoding="utf-8", newline="").write(s)
print("적용 완료: 열 순서 변경 + 구분선 4곳, 총 %d자" % len(s))
