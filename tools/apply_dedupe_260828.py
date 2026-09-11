# -*- coding: utf-8 -*-
# 260828 후속3: 같은 사업의 중복 레코드 5건 삭제 + 지역예술인 발권 병합
import json
P="public/data/db_v46/programs.json"
rows=json.load(open(P,encoding="utf-8"))
DEL={"202012311000a2a","202312311000a2u","202412311000a2z","202512311000a2c","202312021400a1"}
before=len(rows)
rows=[r for r in rows if str(r.get("사업ID")) not in DEL]
for r in rows:
    if str(r.get("사업ID"))=="202311301930a1":
        r["발권유료"]=361
        r["표시_출처"]=str(r.get("표시_출처") or "")+" / 12.02 중복레코드 병합(발권 174+187)"
json.dump(rows,open(P,"w",encoding="utf-8"),ensure_ascii=False,separators=(",",":"))
print("OK before:",before,"after:",len(json.load(open(P,encoding="utf-8"))))