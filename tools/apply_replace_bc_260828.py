# -*- coding: utf-8 -*-
# 260828 후속4: 2017~2025 기획 전시·교육 레코드를 정본 워크북 01_개요 항목으로 전면 교체
import json
P="public/data/db_v46/programs.json"; T="tools/replace_bc_260828.json"
rows=json.load(open(P,encoding="utf-8")); rep=json.load(open(T,encoding="utf-8"))
def is_target(r):
    try:
        y=int(r.get("연도") or 0); b=int(r.get("부문코드") or 0); g=str(r.get("사업ID"))[12:13]
    except Exception:
        return False
    return 2017<=y<=2025 and b in (2,3) and g=="a"
before=len(rows)
kept=[r for r in rows if not is_target(r)]
removed=before-len(kept)
ids={str(r.get("사업ID")) for r in kept}
dup=[str(r.get("사업ID")) for r in rep if str(r.get("사업ID")) in ids]
if dup:
    print("ABORT id collision:",dup[:5]); raise SystemExit(1)
kept.extend(rep)
json.dump(kept,open(P,"w",encoding="utf-8"),ensure_ascii=False,separators=(",",":"))
chk=json.load(open(P,encoding="utf-8"))
print("OK before:",before,"removed:",removed,"inserted:",len(rep),"after:",len(chk))