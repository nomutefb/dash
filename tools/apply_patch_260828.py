# -*- coding: utf-8 -*-
# 260828 정본 워크북 01_개요 → programs.json 표시_* 이관 패치 (1회용)
import json, sys
P="public/data/db_v46/programs.json"; T="tools/patch_programs_260828.json"
rows=json.load(open(P,encoding="utf-8")); patch=json.load(open(T,encoding="utf-8"))
byid={str(r.get("사업ID")): r for r in rows}
missing=[k for k in patch if k not in byid]
if missing:
    print("ABORT missing ids:", missing); sys.exit(1)
for k,v in patch.items():
    byid[k].update(v)
json.dump(rows, open(P,"w",encoding="utf-8"), ensure_ascii=False, separators=(",",":"))
chk=json.load(open(P,encoding="utf-8"))
print("OK rows:",len(chk),"patched:",len(patch))