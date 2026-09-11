# rentmerge_260905.py — [260905 대관 병합] 캘린더 대관 행과 프로그램 행이 한 행이 된 뒤(이관 032): 대관일정 창구는 대관기간·장소 태그로 답하고, 마스터 응답은 프로그램ID 가 YYMMDD_NN 인 행을 숨기지 않는다.
import io
def patch(P, pairs, marker, want):
    s=io.open(P,encoding='utf-8').read()
    for old,new in pairs:
        n=s.count(old); assert n==1, ('anchor count', P, n, old[:60])
        s=s.replace(old,new)
    assert s.count(marker)==want, (P, marker, s.count(marker))
    io.open(P,'w',encoding='utf-8').write(s)
    print('ok', P, len(s))

A1 = '    dates: ["시작일", "종료일", "공연일", "리허설일"],\n    stamp: function (d) { if (!nz(d["캘린더ID"]))'
B1 = '    dates: ["시작일", "종료일", "공연일", "리허설일"],\n    // [260905 대관 병합] 프로그램 행과 합쳤진 대관(이관 032): 캘린더는 대관기간(셋업 포함) 으로, 장소는 프로그램 장소 이름을 캘린더 태그(장도·7층·야외)로.\n    read: function (d, row) { var sp = nz(d["대관기간"]).split("~"); if (sp.length === 2 && /^\\d{8}$/.test(sp[0]) && /^\\d{8}$/.test(sp[1])) { row["시작일"] = toIso(sp[0]); row["종료일"] = toIso(sp[1]); } var pl = {"장도 전시실":"장도","7층 전시실":"7층","장도 야외":"야외"}; if (pl[nz(row["장소"])]) row["장소"] = pl[nz(row["장소"])]; },\n    stamp: function (d) { if (!nz(d["캘린더ID"]))'
patch('api/ym-views-lib.js', [(A1,B1)], '대관 병합', 1)

A2 = '&& String(r["캘린더ID"] || "").trim() === ""; });   // [260905 통합⑪]'
B2 = '&& (String(r["캘린더ID"] || "").trim() === "" || /^\\d{6}_\\d{2}$/.test(String(r["프로그램ID"] || "").trim())); });   // [260905 대관 병합] 프로그램 행(YYMMDD_NN)은 캘린더ID 가 있어도 보여 준다 [260905 통합⑪]'
patch('api/ym-db.pb.js', [(A2,B2)], '대관 병합', 1)
print('done rentmerge')
