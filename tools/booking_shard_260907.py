# -*- coding: utf-8 -*-
# tools/booking_shard_260907.py — 예매집계 조각 파일 만들기
#   읽기: public/data/db_v46/booking_agg.json  ({sheet, rows:[{회원키,분포,총구매,총매수,총금액,첫구매일,최근구매일},…]})
#   쓰기: api/data/booking_agg.s0.json … s9.json  (회원키 끝자리로 10등분, 각 {builtAt, srcRows, rows:[…]})
#   왜: 회원 상세의 예매 요약을 서버 훅(api/ym-member-search-lib.js member-booking)이 조각 하나만 읽어 답하려고.
#       훅 프로세스는 public/ 폴더를 못 읽으므로 api/data/ 아래 사본을 둔다. 원본 booking_agg.json 이 바뀌면 이 스크립트를 다시 돌린다.
#   실행: python3 tools/booking_shard_260907.py
import io, os, json, datetime, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'data', 'db_v46', 'booking_agg.json')
OUT_DIR = os.path.join(ROOT, 'api', 'data')

with io.open(SRC, 'r', encoding='utf-8') as f:
    d = json.load(f)
rows = d.get('rows') if isinstance(d, dict) else d
if not isinstance(rows, list) or not rows:
    print('FAIL booking_agg.json rows 없음'); sys.exit(1)
shards = {str(i): [] for i in range(10)}
skipped = 0
for r in rows:
    k = ''.join(ch for ch in str(r.get('회원키', '')) if ch.isdigit())
    if not k:
        skipped += 1; continue
    shards[k[-1]].append(r)
stamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
total = 0
for i in range(10):
    p = os.path.join(OUT_DIR, 'booking_agg.s%d.json' % i)
    body = json.dumps({'builtAt': stamp, 'srcRows': len(rows), 'rows': shards[str(i)]}, ensure_ascii=False)
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(body)
    total += len(shards[str(i)])
    print('s%d %5d rows %7d bytes -> %s' % (i, len(shards[str(i)]), len(body.encode('utf-8')), p))
print('OK total=%d skipped=%d builtAt=%s' % (total, skipped, stamp))
