# -*- coding: utf-8 -*-
# [260903 Phase1 M-3] 프로그램 레일 사업코드 그룹 토글 — tools/prgrp_module.js 삽입 + _progRailTableHtml 행 루프 교체
#   + M-2 오버레이 보정(전시 _g2 는 '전시' 유지). 실행: python3 tools/phase1_prgrp_260903.py (먼저 backups/ 로 cp)
import io
P='public/standalone.html'
s=io.open(P,encoding='utf-8').read()
MOD=io.open('tools/prgrp_module.js',encoding='utf-8').read()
assert 'function _prGroupParentHtml(' in MOD
def one(a):
    assert s.count(a)==1, 'anchor not unique: %r (%d)'%(a[:60], s.count(a))

# 1) 모듈 삽입
a1='function _progRailTableHtml(mode,opt){\n'
one(a1)
assert 'function _prGroupParentHtml(' not in s, 'module already present'
s=s.replace(a1, MOD+'\n'+a1)

# 2) 행 루프 교체
fn0=s.index('function _progRailTableHtml(mode,opt){\n')
A='    sorted.forEach(function(r,i){\n      var shared=_prSharedCells(r);'
a=s.index(A, fn0)
assert s.count(A)==1
B="\n    });\n  });\n  h+='</tbody></table>';"
b=s.index(B, a)
assert b-a<3000
body=s[a+len('    sorted.forEach(function(r,i){'):b]
assert body.count("h+='<tr data-pkey=")==1
body=body.replace("h+='<tr data-pkey=","h+='<tr'+cls+' data-pkey=")
repl=("    /* [260903 M-3] 사업코드 그룹 — 같은 코드 2건 이상이면 부모 행 + (펼침 시) 자식 행. 끄기 window._PROG_RAIL_GRP=false */\n"
      "    var _rowHtml=function(r,i,cls){"+body+"\n    };\n"
      "    var _items=_prGroupRows(sorted), _ri=-1;\n"
      "    _items.forEach(function(it){\n"
      "      if(it.grp){ _ri++; h+=_prGroupParentHtml(mode,it.grp,y,_ri); if(!_progRailGrpOpen[it.grp.code+'|'+y])return; it.grp.rows.forEach(function(r){ _ri++; _rowHtml(r,_ri,' class=\"pr-child\"'); }); return; }\n"
      "      _ri++; _rowHtml(it.row,_ri,'');\n"
      "    });")
s=s[:a]+repl+s[b+len("\n    });"):]

# 3) M-2 오버레이 보정: 전시는 장르 축이 '전시' 고정(판매 레일의 g.genre==='전시' 판정·오픈석 뮤트가 이 값을 본다)
o1="      _g2:String(p['장르']||p['구분']||'').trim()||null,\n"
one(o1)
s=s.replace(o1, "      _g2:(bun==='전시')?'전시':(String(p['장르']||p['구분']||'').trim()||null),   /* [260903] 전시는 '전시' 고정 */\n")

io.open(P,'w',encoding='utf-8').write(s)
print('OK phase1 M-3 applied', len(s))
