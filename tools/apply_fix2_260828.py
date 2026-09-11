# -*- coding: utf-8 -*-
# 260828 후속2: 2025 브런치 3/27 레코드 수입 이중계상 보정(기존 v55 오류 — 이관과 무관)
import json, sys
P="public/data/db_v46/programs.json"; T="tools/patch_fix2_260828.json"
rows=json.load(open(P,encoding="utf-8")); patch=json.load(open(T,encoding="utf-8"))
byid={str(r.get("사업ID")): r for r in rows}
missing=[k for k in patch if k not in byid]
if missing:
    print("ABORT missing:", missing); sys.exit(1)
for k,v in patch.items():
    byid[k].update(v)
json.dump(rows, open(P,"w",encoding="utf-8"), ensure_ascii=False, separators=(",",":"))
print("OK rows:",len(json.load(open(P,encoding="utf-8"))),"fixed:",len(patch))