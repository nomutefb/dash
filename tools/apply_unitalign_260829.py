# -*- coding: utf-8 -*-
# 사업개요 실적표 단위(억/%) 수직정렬: 소수부를 슬롯 밖으로, 단위만 1.1em 고정슬롯
import base64,sys
P='public/standalone.html'
PAIRS=[
('ZnVuY3Rpb24gX2Vva0NlbGwodil7dj1TdHJpbmcodj09bnVsbD8nJzp2KTt2YXIgbT0vXihcZFtcZCxdKikoXC5cZCspP+yWtT8kLy5leGVjKHYpO2lmKCFtKXJldHVybiB2O3JldHVybiBtWzFdKyc8c3BhbiBzdHlsZT0iZGlzcGxheTppbmxpbmUtYmxvY2s7d2lkdGg6MS45ZW07dGV4dC1hbGlnbjpsZWZ0Ij4nKyhtWzJdfHwnJykrJ+yWtTwvc3Bhbj4nO30=','ZnVuY3Rpb24gX2Vva0NlbGwodil7dj1TdHJpbmcodj09bnVsbD8nJzp2KTt2YXIgbT0vXihcZFtcZCxdKikoXC5cZCspP+yWtT8kLy5leGVjKHYpO2lmKCFtKXJldHVybiB2O3JldHVybiBtWzFdKyhtWzJdfHwnJykrJzxzcGFuIHN0eWxlPSJkaXNwbGF5OmlubGluZS1ibG9jazt3aWR0aDoxLjFlbTt0ZXh0LWFsaWduOmxlZnQiPuyWtTwvc3Bhbj4nO30='),
('ZnVuY3Rpb24gX3BjdENlbGwodil7dj1TdHJpbmcodj09bnVsbD8nJzp2KTt2YXIgbT0vXigtP1tcZCxdKykoXC5cZCspPyUkLy5leGVjKHYpO2lmKCFtKXJldHVybiB2O3JldHVybiBtWzFdKyc8c3BhbiBzdHlsZT0iZGlzcGxheTppbmxpbmUtYmxvY2s7d2lkdGg6MS45ZW07dGV4dC1hbGlnbjpsZWZ0Ij4nKyhtWzJdfHwnJykrJyU8L3NwYW4+Jzt9','ZnVuY3Rpb24gX3BjdENlbGwodil7dj1TdHJpbmcodj09bnVsbD8nJzp2KTt2YXIgbT0vXigtP1tcZCxdKykoXC5cZCspPyUkLy5leGVjKHYpO2lmKCFtKXJldHVybiB2O3JldHVybiBtWzFdKyhtWzJdfHwnJykrJzxzcGFuIHN0eWxlPSJkaXNwbGF5OmlubGluZS1ibG9jazt3aWR0aDoxLjFlbTt0ZXh0LWFsaWduOmxlZnQiPiU8L3NwYW4+Jzt9'),
('ZnVuY3Rpb24gX251bUNlbGwodil7dj1TdHJpbmcodj09bnVsbD8nJzp2KTt2YXIgbT0vXigtP1xkW1xkLF0qKShcLlxkKyk/JC8uZXhlYyh2KTtpZighbSlyZXR1cm4gdjtyZXR1cm4gbVsxXSsnPHNwYW4gc3R5bGU9ImRpc3BsYXk6aW5saW5lLWJsb2NrO3dpZHRoOjEuOWVtO3RleHQtYWxpZ246bGVmdCI+JysobVsyXXx8JycpKyc8L3NwYW4+Jzt9','ZnVuY3Rpb24gX251bUNlbGwodil7dj1TdHJpbmcodj09bnVsbD8nJzp2KTt2YXIgbT0vXigtP1xkW1xkLF0qKShcLlxkKyk/JC8uZXhlYyh2KTtpZighbSlyZXR1cm4gdjtyZXR1cm4gbVsxXSsobVsyXXx8JycpKyc8c3BhbiBzdHlsZT0iZGlzcGxheTppbmxpbmUtYmxvY2s7d2lkdGg6MS4xZW07dGV4dC1hbGlnbjpsZWZ0Ij48L3NwYW4+Jzt9'),
]
s=open(P,encoding='utf-8').read()
d=lambda b:base64.b64decode(b).decode('utf-8')
ok=True
for i,(o,n) in enumerate(PAIRS):
    c=s.count(d(o))
    print('pair',i,'count',c)
    if c!=1: ok=False
if not ok:
    print('ABORT: anchor mismatch, nothing written');sys.exit(1)
for o,n in PAIRS:
    s=s.replace(d(o),d(n))
open(P,'w',encoding='utf-8').write(s)
print('APPLIED',len(PAIRS),'pairs. new_len',len(s))
