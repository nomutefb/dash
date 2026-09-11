# -*- coding: utf-8 -*-
# place_260905.py — 장소 표기 통일(이관 041·042) 반영: 판매 배지 「야」 판정 정규식에 테라스·바닥 분수 추가. 본체 1곳만 바꾼다.
import io, sys
P = 'public/standalone.html'
s = io.open(P, 'r', encoding='utf-8').read()
OLD = "var _od=(/야외|광장|데크|옥외|잔디/.test(_L))"
NEW = "var _od=(/야외|광장|데크|옥외|잔디|테라스|바닥 ?분수/.test(_L)) /* [260905 장소통일] */"
assert s.count(OLD) == 1, s.count(OLD)
assert s.count('[260905 장소통일]') == 0
s = s.replace(OLD, NEW)
io.open(P, 'w', encoding='utf-8').write(s)
print('OK place_260905: replaced 1, marker', s.count('[260905 장소통일]'))
