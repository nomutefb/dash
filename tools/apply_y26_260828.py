# -*- coding: utf-8 -*-
# 260828 후속6: 2026 기획 전시·교육을 01_개요로 교체 + 전시·교육 비고=장소 + 연중사업 날짜 + 입주작가 프로그램 무료여부
import json
P="public/data/db_v46/programs.json"; T="tools/replace_y26_260828.json"
rows=json.load(open(P,encoding="utf-8")); rep=json.load(open(T,encoding="utf-8"))
DEL={"202602131000a2","202602271000a2","202603271000a2a","202607211000a2","202608251000a2","202612311000a2h","202612312359a3c"}
before=len(rows)
rows=[r for r in rows if str(r.get("사업ID")) not in DEL]
removed=before-len(rows)
ids={str(r.get("사업ID")) for r in rows}
dup=[str(r.get("사업ID")) for r in rep if str(r.get("사업ID")) in ids]
if dup:
    print("ABORT id collision:",dup); raise SystemExit(1)
rows.extend(rep)
fixdate=0; fixplace=0; fixfree=0
for r in rows:
    if str(r.get("표시_출처") or "").startswith("정본 워크북") and int(r.get("부문코드") or 0) in (2,3):
        y=int(r.get("연도") or 0)
        if not r.get("시작일"):
            r["시작일"]=y*10000+101; r["종료일"]=y*10000+1231; r["기간"]=365; fixdate+=1
        if r.get("장소") and not r.get("비고"):
            r["비고"]=r["장소"]; fixplace+=1
        if "입주작가 프로그램" in str(r.get("정본명") or ""):
            r["무료여부"]=1; fixfree+=1
json.dump(rows,open(P,"w",encoding="utf-8"),ensure_ascii=False,separators=(",",":"))
print("OK before:",before,"removed:",removed,"inserted:",len(rep),"dates:",fixdate,"places:",fixplace,"free:",fixfree,"after:",len(json.load(open(P,encoding="utf-8"))))