# tools/addr_unclear_260907.py — [260907 주소정제] 고객 분석 화면: 주소1이 「불분명」인 회원은 지역 집계에서 빼고(미상 취급), 문구를 '미상' → '불분명'으로.
#   서버 집계(api/ym-member-summary-lib.js)는 이미 같은 규칙. 여기는 집계 응답이 없을 때 화면이 직접 세는 경로 + 문구 2곳.
#   두 번 실행해도 안전(표식 있으면 건너뜀). 다른 파일은 건드리지 않는다.
import io, sys
P = "public/standalone.html"
s = io.open(P, encoding="utf-8").read()
MARK = "[260907 주소정제 불분명]"
if MARK in s:
    print("이미 적용됨 — 건너뜀"); sys.exit(0)
def once(hay, needle):
    c = hay.count(needle)
    if c != 1:
        print("앵커 %d개(1개여야 함): %r" % (c, needle[:80])); sys.exit(1)
A1 = "if(s1){sido[s1]=(sido[s1]||0)+1;}else{unloc++;}"
once(s, A1)
s = s.replace(A1, "if(s1&&s1!=='Example State 350'){sido[s1]=(sido[s1]||0)+1;}else{unloc++;s1='';} /* " + MARK + " 불분명 = 시도·시군구 확정 못 한 주소(ym-addr-lib) → 집계 제외 */")
A2 = "(주소 확인 '+known.toLocaleString()+'명 · 미상 '+unloc.toLocaleString()+'명 제외)"
once(s, A2)
s = s.replace(A2, "(주소 확인 '+known.toLocaleString()+'명 · 불분명 '+unloc.toLocaleString()+'명 제외)")
io.open(P, "w", encoding="utf-8", newline="").write(s)
print("적용 완료: 집계 제외 1곳 + 문구 1곳, 총 %d자" % len(s))
