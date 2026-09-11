# -*- coding: utf-8 -*-
# [260902 좌측 틀 통일 4단계] 두 면 사이 "글자 위치가 아주 약간 다름" + 전환 잔여 깜빡임
#  P1 판매현황 지표 띠 라벨 인라인 font-weight:700 제거 → 두 면 모두 스타일시트 기본(600). 굵기 차이 = 글자 폭 차이였다.
#  P2 fit 차트 높이 데드밴드 2px → 0.5px (면마다 ±1px 잔차가 남아 아래 표가 1px 어긋나던 원인)
#  P3 fit 이 차트를 매번 최대(560)로 올렸다 줄이던 왕복 제거 — 이미 높이가 있으면 현재값에서 출발(Plotly 재배치 2회·정지 시간 감소). window._BIZ_FIT_FROM_CUR=false 면 종전.
#  P4 전환 페이드 기본 끔(하드 컷) — window._DECK_FADE=true 면 내용 페이드
#  P5 사업현황 실적표 예약 높이 = 판매현황 표 실측값을 같은 창 조건(폭·높이·줌·biz-fit)에서 재사용 → 두 면 차트·표 높이가 정수까지 같아짐. 실측값 없을 때만 추정(자연 높이+행 1개).
import io
P='public/standalone.html'
s=io.open(P,'r',encoding='utf-8').read()
n0=len(s)
def rep(anchor, new):
    global s
    c=s.count(anchor)
    assert c==1, ('anchor count %d: %s' % (c, anchor[:60]))
    s=s.replace(anchor,new)
    print('OK', anchor[:50].replace('\n',' '))
# P1
rep("""var cell=function(lab,val,col,ls){return '<div class="cell"><div class="lab"'+(ls?' style="'+ls+'"':'')+'>'+lab+'</div><div class="val" style="color:var('+col+')">'+val+'</div></div>';};""",
    """var cell=function(lab,val,col,ls){ls=(ls||'').replace(/font-weight:700;?/,'');/* [260902 좌측 틀 통일] 라벨 굵기 = 스타일시트 기본(600)으로 두 면 통일 */return '<div class="cell"><div class="lab"'+(ls?' style="'+ls+'"':'')+'>'+lab+'</div><div class="val" style="color:var('+col+')">'+val+'</div></div>';};""")
# P2
rep("""// gBCR 시각좌표 → 디자인(레이아웃) 단위로 환산해 style px와 동단위 비교
      if(Math.abs(px-cur)<2)return false;""",
    """// gBCR 시각좌표 → 디자인(레이아웃) 단위로 환산해 style px와 동단위 비교
      if(Math.abs(px-cur)<0.5)return false;   /* [260902 좌측 틀 통일] 2→0.5: 면마다 ±1px 잔차가 남던 원인 */""")
# P3
rep("""    setH(_BIZ_CHART_MAX);
    if(shrink()<=2){_bizOvAnnualFill();return;}""",
    """    if(!(window._BIZ_FIT_FROM_CUR!==false&&ch.style.height))setH(_BIZ_CHART_MAX);   /* [260902 좌측 틀 통일] 이미 높이가 있으면 현재값에서 출발 — 최대로 갔다 돌아오는 왕복(Plotly 재배치 2회) 제거 */
    if(shrink()<=2){_bizOvAnnualFill();return;}""")
# P4
rep("if(window._DECK_FADE===false)return;", "if(window._DECK_FADE!==true)return;   /* [260902 좌측 틀 통일] 기본 = 하드 컷(페이드 없음) */")
# P5
rep("var _yrmTblNatH=0;", "var _yrmTblNatH=0, _yrmTblNatCtx='';   /* [260902 좌측 틀 통일] 실측 당시 창 조건 */")
rep("""if(card&&card.offsetParent!==null){var min=card.style.minHeight,max=card.style.maxHeight;card.style.minHeight='';card.style.maxHeight='';_yrmTblNatH=card.offsetHeight;card.style.minHeight=min;card.style.maxHeight=max;}
  var next=_yrmTblNatH||302;
  /* [260902 좌측 틀 통일]""",
    """var _ctx=(function(){try{var _a=document.getElementById('app');return window.innerWidth+'x'+window.innerHeight+'x'+(typeof _bizZ==='function'?_bizZ():1)+'x'+(_a&&_a.classList.contains('biz-fit')?'f':'');}catch(_e){return '';}})();
  if(card&&card.offsetParent!==null){var min=card.style.minHeight,max=card.style.maxHeight;card.style.minHeight='';card.style.maxHeight='';_yrmTblNatH=card.offsetHeight;_yrmTblNatCtx=_ctx;card.style.minHeight=min;card.style.maxHeight=max;}
  var next=_yrmTblNatH||302;
  /* [260902 좌측 틀 통일]""")
rep("var _row=_ac.querySelector('tbody tr');_est=_ac.offsetHeight+(_row?_row.offsetHeight:0);",
    "var _row=_ac.querySelector('tbody tr');_est=(_yrmTblNatH&&_yrmTblNatCtx===_ctx)?_yrmTblNatH:(_ac.offsetHeight+(_row?_row.offsetHeight:0));   /* 같은 창 조건의 판매현황 실측값 우선 → 두 면 정수까지 동일 */")
io.open(P,'w',encoding='utf-8').write(s)
print('DONE', n0, '->', len(s))
