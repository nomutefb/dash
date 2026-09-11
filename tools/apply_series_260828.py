# -*- coding: utf-8 -*-
# 260828 후속7: 시리즈 분할 사업(브런치류) — 사업비 G/N 균등, 수입은 판매실측 비례(전 회차 실측 있을 때) 또는 J/N
import json, sys
P="public/data/db_v46/programs.json"; T="tools/patch_series_260828.json"
rows=json.load(open(P,encoding="utf-8")); patch=json.load(open(T,encoding="utf-8"))
byid={str(r.get("사업ID")): r for r in rows}
missing=[k for k in patch if k not in byid]
if missing:
    print("ABORT missing:",missing[:5]); sys.exit(1)
for k,v in patch.items():
    byid[k].update(v)
json.dump(rows,open(P,"w",encoding="utf-8"),ensure_ascii=False,separators=(",",":"))
print("OK rows:",len(json.load(open(P,encoding="utf-8"))),"patched:",len(patch))