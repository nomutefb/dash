# -*- coding: utf-8 -*-
# [260902 좌측 틀 통일 2단계] 사업현황 실적표(3행)가 판매현황 실적표(4행)와 같은 높이를 갖게 한다 — 좁은 화면(차트 축소 상태)에서도.
#  S1 _bizSyncYrmTblNat: 사업현황 실적표 예약 높이 = 자기 자연 높이 + 행 1개(판매현황 표는 4행, 나머지 마크업 동일)
#  S2 _bizFitViewport 예약 루프: 사업현황 실적표는 S1 값 유지(공용 값으로 덮지 않음)
#  S3 _srailAlignTop fill 패스: 사업현황 실적표도 판매현황 표처럼 박스 안선까지 늘림
#  S4 사업현황 실적표 카드에 data-bizmreserve 복원(1단계에서 뺐던 것)
#  S5 .ct min-height:43px 규칙에서 사업현황 실적표 제외(판매현황 .ct 는 42px — 1px 어긋남 원인)
#  S6 _bizOvAnnualFill 신설 + _bizFitViewport 끝에서 호출(리사이즈 뒤 정렬→fit 순서 때문에 fill 이 풀리는 경우 보정)
# 되돌리기: backups/standalone-260902-2031.html(1단계 전) 복원
import io, json
P='public/standalone.html'
s=io.open(P,'r',encoding='utf-8').read()
n0=len(s)
def rep(anchor, new):
    global s
    c=s.count(anchor)
    assert c==1, ('anchor count %d: %s' % (c, anchor[:60]))
    s=s.replace(anchor,new)
    print('OK', anchor[:50].replace('\n',' '))
# S1
A1="""function _bizSyncYrmTblNat(skipFit){
  var before=_yrmTblNatH;
  var card=document.querySelector('#yrm-tbl .bizm-card');
  if(card&&card.offsetParent!==null){var min=card.style.minHeight,max=card.style.maxHeight;card.style.minHeight='';card.style.maxHeight='';_yrmTblNatH=card.offsetHeight;card.style.minHeight=min;card.style.maxHeight=max;}
  var next=_yrmTblNatH||302;
  document.querySelectorAll('[data-bizmreserve]').forEach(function(e){e.style.minHeight=next+'px';});
  if(!skipFit&&next!==before)try{_bizFitViewport();}catch(_e){}
  return next;
}"""
N1="""function _bizSyncYrmTblNat(skipFit){
  var before=_yrmTblNatH;
  var card=document.querySelector('#yrm-tbl .bizm-card');
  if(card&&card.offsetParent!==null){var min=card.style.minHeight,max=card.style.maxHeight;card.style.minHeight='';card.style.maxHeight='';_yrmTblNatH=card.offsetHeight;card.style.minHeight=min;card.style.maxHeight=max;}
  var next=_yrmTblNatH||302;
  /* [260902 좌측 틀 통일] 사업현황 실적표(3행)는 판매현황 실적표(4행, 나머지 마크업 동일)와 같은 높이를 예약 = 자기 자연 높이 + 행 1개 */
  var _ac=document.querySelector('#bizov-annual-table > .bizm-card'), _est=0;
  if(_ac&&_ac.offsetParent!==null){var _amin=_ac.style.minHeight,_amax=_ac.style.maxHeight;_ac.style.minHeight='';_ac.style.maxHeight='';var _row=_ac.querySelector('tbody tr');_est=_ac.offsetHeight+(_row?_row.offsetHeight:0);_ac.style.minHeight=_amin;_ac.style.maxHeight=_amax;}
  document.querySelectorAll('[data-bizmreserve]').forEach(function(e){e.style.minHeight=((_est&&e===_ac)?_est:next)+'px';});
  if(!skipFit&&next!==before)try{_bizFitViewport();}catch(_e){}
  return next;
}
function _bizOvAnnualFill(){   /* [260902 좌측 틀 통일] fit 뒤 사업현황 실적표를 박스 안선까지 채운다(판매현황 표의 data-bizmfill 규약과 같은 계산) */
  try{
    var _ac=document.querySelector('#bizov-annual-table > .bizm-card'); if(!_ac||_ac.offsetParent===null)return;
    var _bx=_ac.closest('[data-bizmbox]'); if(!_bx||!_bx.style.height)return;
    var _cs=getComputedStyle(_bx), _z=_bizZ();
    var _line=_bx.getBoundingClientRect().bottom-(parseFloat(_cs.borderBottomWidth)||0)-(parseFloat(_cs.paddingBottom)||0);
    var _r=_ac.getBoundingClientRect(), _room=(_line-_r.bottom)/_z;
    if(_room>1)_ac.style.minHeight=Math.round(_r.height/_z+_room)+'px';
  }catch(_e){}
}"""
rep(A1,N1)
# S2
A2="document.querySelectorAll('[data-bizmreserve]').forEach(function(e){_alignStyle(e,'minHeight',_yrmReserveH+'px');});"
N2="document.querySelectorAll('[data-bizmreserve]').forEach(function(e){if(e.parentNode&&e.parentNode.id==='bizov-annual-table')return;_alignStyle(e,'minHeight',_yrmReserveH+'px');});   /* [260902 좌측 틀 통일] 사업현황 실적표 예약값은 _bizSyncYrmTblNat 가 직접 정한다 */"
rep(A2,N2)
# S3
A3="if(_f.hasAttribute('data-bizmreserve'))continue;"
N3="if(_f.hasAttribute('data-bizmreserve')&&!(_f.parentNode&&_f.parentNode.id==='bizov-annual-table'))continue;   /* [260902 좌측 틀 통일] 사업현황 실적표는 판매현황 표처럼 박스 안선까지 늘린다 */"
rep(A3,N3)
# S4
A4='<div class="bizm-card" data-bizmfill><div class="ct" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px 8px"><span><span class="ct-bul"></span>실적표</span><span class="bizm-yrnav"><button type="button" aria-label="이전 연도" onclick="_bizOvWin(-1)"'
N4=A4.replace('data-bizmfill><div class="ct"','data-bizmfill data-bizmreserve><div class="ct"')
assert N4!=A4
rep(A4,N4)
# S5
A5=".bizm-card.bizov-mtbl>.ct,#bizov-annual-table .bizm-card>.ct{min-height:43px}"
N5=".bizm-card.bizov-mtbl>.ct{min-height:43px}"
rep(A5,N5)
# S6 fit 끝 호출
A6="    if(shrink()<=2)return;                        // ② 차트만 줄여서 들어오면 끝"
N6="    if(shrink()<=2){_bizOvAnnualFill();return;}   // ② 차트만 줄여서 들어오면 끝 · [260902 좌측 틀 통일] 사업현황 실적표 fill"
rep(A6,N6)
A7="    if(app){ app.classList.add('biz-fit'); setH(_BIZ_CHART_MAX); shrink(); }   // ③ 그래도 넘치면 여백 압축 단계 + 재축소\n  }catch(_e){ console.warn('[biz fit]',_e); }\n}"
N7="    if(app){ app.classList.add('biz-fit'); setH(_BIZ_CHART_MAX); shrink(); }   // ③ 그래도 넘치면 여백 압축 단계 + 재축소\n    _bizOvAnnualFill();   /* [260902 좌측 틀 통일] */\n  }catch(_e){ console.warn('[biz fit]',_e); }\n}"
rep(A7,N7)
io.open(P,'w',encoding='utf-8').write(s)
print('DONE', n0, '->', len(s))
