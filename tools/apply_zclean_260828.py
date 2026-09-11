# -*- coding: utf-8 -*-
# 260828 후속5: 개요 삽입분과 중복인 잔존 레코드 3건 삭제(z-ID 유형)
import json
P="public/data/db_v46/programs.json"
rows=json.load(open(P,encoding="utf-8"))
DEL={"201701010000z01","201912310000z02","202412310000z08"}
before=len(rows)
rows=[r for r in rows if str(r.get("사업ID")) not in DEL]
json.dump(rows,open(P,"w",encoding="utf-8"),ensure_ascii=False,separators=(",",":"))
print("OK before:",before,"after:",len(json.load(open(P,encoding="utf-8"))))