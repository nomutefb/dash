# rentmerge3_260905.py — [260905 대관 병합 3] 이관 033(R… → YYMMDD_NN) 뒤에는 ID 형식으로 순수 캘린더 행을 못 가린다 → 마스터 응답에서 숨기는 기준을 출처=캘린더 로.
import io
P='api/ym-db.pb.js'
s=io.open(P,encoding='utf-8').read()
old='&& (String(r["캘린더ID"] || "").trim() === "" || /^\\d{6}_\\d{2}$/.test(String(r["프로그램ID"] || "").trim())); });   // [260905 대관 병합] 프로그램 행(YYMMDD_NN)은 캘린더ID 가 있어도 보여 준다 [260905 통합⑪]'
new='&& !(String(r["캘린더ID"] || "").trim() !== "" && String(r["출처"] || "").trim() === "캘린더"); });   // [260905 대관 병합 3] 숨기는 것 = 캘린더에만 있는 대관(출처=캘린더). 프로그램 행에 합쳤진 캘린더(이관 032)는 보인다 [260905 통합⑪]'
n=s.count(old); assert n==1, ('anchor count', n)
s=s.replace(old,new)
assert s.count('대관 병합 3')==1
io.open(P,'w',encoding='utf-8').write(s)
print('ok rentmerge3', len(s))
