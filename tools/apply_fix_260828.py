# -*- coding: utf-8 -*-
# 260828 이관 후속: 번들→개별회차 오배정 3건을 이관 전 값으로 원복
import json, sys
P="public/data/db_v46/programs.json"; T="tools/patch_fix_260828.json"
rows=json.load(open(P,encoding="utf-8")); patch=json.load(open(T,encoding="utf-8"))
byid={str(r.get("사업ID")): r for r in rows}
missing=[k for k in patch if k not in byid]
if missing:
    print("ABORT missing:", missing); sys.exit(1)
for k,v in patch.items():
    byid[k].update(v)
json.dump(rows, open(P,"w",encoding="utf-8"), ensure_ascii=False, separators=(",",":"))
print("OK rows:",len(json.load(open(P,encoding="utf-8"))),"reverted:",len(patch))