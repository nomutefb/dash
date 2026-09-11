# -*- coding: utf-8 -*-
# tools/kpifix_260828.py - (1) 실적표(월별+연도별) 1의자리 수직 정렬 (2) 연도 KPI = 겉면 대표값 (3) 좌측 타일 = 선택자별 사업 수
import shutil, os, sys, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SH = os.path.join(ROOT, 'public', 'standalone.html')
BK = os.path.join(ROOT, 'backups')
STAMP = time.strftime('%m%d-%H%M')
def abort(msg):
    print('ABORT: ' + msg); sys.exit(1)
html = open(SH, encoding='utf-8').read()

H_OLD = r'''function _eokCell(v){v=String(v==null?'':v);return /^[\d,.]+$/.test(v)?v+'<span style="display:inline-block;width:1.1em;text-align:left">억</span>':v;}
function _pctCell(v){v=String(v==null?'':v);return /%$/.test(v)?v.slice(0,-1)+'<span style="display:inline-block;width:1.1em;text-align:left">%</span>':v;}
'''
H_NEW = r'''function _eokCell(v){v=String(v==null?'':v);var m=/^(\d[\d,]*)(\.\d+)?억?$/.exec(v);if(!m)return v;return m[1]+'<span style="display:inline-block;width:1.9em;text-align:left">'+(m[2]||'')+'억</span>';}
function _pctCell(v){v=String(v==null?'':v);var m=/^(-?[\d,]+)(\.\d+)?%$/.exec(v);if(!m)return v;return m[1]+'<span style="display:inline-block;width:1.9em;text-align:left">'+(m[2]||'')+'%</span>';}
function _numCell(v){v=String(v==null?'':v);var m=/^(-?\d[\d,]*)(\.\d+)?$/.exec(v);if(!m)return v;return m[1]+'<span style="display:inline-block;width:1.9em;text-align:left">'+(m[2]||'')+'</span>';}
'''
M1_OLD = r"""'N/A':(r&&r[key]!=null&&isFinite(Number(r[key]))?_finEok(r[key]):'—')"""
M1_NEW = r"""'N/A':(r&&r[key]!=null&&isFinite(Number(r[key]))?_numCell(_finEok(r[key])):'—')"""
M2_OLD = r"""'N/A':(r&&r.margin!=null&&isFinite(Number(r.margin))?Math.round(Number(r.margin))+'%':'—')"""
M2_NEW = r"""'N/A':(r&&r.margin!=null&&isFinite(Number(r.margin))?_pctCell(Math.round(Number(r.margin))+'%'):'—')"""
K_OLD = r"""else if(Number(year)>=2024){var _ys=_bizOvSum(_finRows(year).filter(function(r){return r.cat===cat;}));t={bud:_ys.bud,cost:_ys.cost,rev:_ys.rev,margin:_ys.margin};}
  else {var _old=_bizOvYearSummary(year)||{};t={bud:null,cost:_old.cost,rev:_old.rev,margin:_old.margin};}"""
K_NEW = r"""else {var _ar9=_bizOvAnnualRowsFor(cat),_cr9=null;for(var _i9=0;_i9<_ar9.length;_i9++){if(Number(_ar9[_i9].year)===Number(year)){_cr9=_ar9[_i9];break;}}t=_cr9?{bud:null,cost:_cr9.cost,rev:_cr9.rev,margin:_cr9.margin}:{bud:null,cost:null,rev:null,margin:null};}"""
N_OLD = r"""else n=_finRows(year).length;"""
N_NEW = r"""else n=_finRows(year).filter(function(r){return r.cat===cat;}).length;"""
C_OLD = r"""var caption=all?'사업지표 등록 기준':'';"""
C_NEW = r"""var caption='사업지표 등록 기준';"""
T_OLD = r"""_bizOvKpi(all?'연 평균 사업 수':'총예산',all?n.toFixed(1):_finEok(t.bud),all?'건': '억',caption,all?'--accent':'--neutral-text')"""
T_NEW = r"""_bizOvKpi(all?'연 평균 사업 수':'사업 수',all?n.toFixed(1):String(n),'건',caption,all?'--accent':'--neutral-text')"""

checks = [('H',H_OLD,1),('M1',M1_OLD,1),('M2',M2_OLD,1),('K',K_OLD,1),('N',N_OLD,1),('C',C_OLD,1),('T',T_OLD,1)]
for nm,od,exp in checks:
    c = html.count(od)
    if c != exp: abort('anchor %s count=%d (expect %d)' % (nm,c,exp))
if '_numCell' in html: abort('already patched')

os.makedirs(BK, exist_ok=True)
bk = os.path.join(BK, 'standalone-' + STAMP + '-kpifix전.html')
shutil.copy2(SH, bk)

html2 = html.replace(H_OLD,H_NEW).replace(M1_OLD,M1_NEW).replace(M2_OLD,M2_NEW).replace(K_OLD,K_NEW).replace(N_OLD,N_NEW).replace(C_OLD,C_NEW).replace(T_OLD,T_NEW)
if html2.count('_numCell') != 2: abort('post _numCell=%d' % html2.count('_numCell'))
if html2.count('_ar9') != 4: abort('post _ar9=%d' % html2.count('_ar9'))
if '총예산' in html2: abort('총예산 still present')

open(SH, 'w', encoding='utf-8').write(html2)
print('OK kpifix: 정렬 헬퍼 3종 교체, 월별 셀 2곳, KPI 소스 교체 1곳, 건수 타일 1곳')
print('backup:', os.path.basename(bk))
print('size:', os.path.getsize(SH))
