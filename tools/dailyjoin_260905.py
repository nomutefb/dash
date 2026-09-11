# dailyjoin_260905.py — [260905 통합㉓] 일일실적 명칭·사업코드를 저장 대신 마스터에서 붙인다(창구 조인, api/ym-daily-join-lib.js). 훅 3파일 앵커 치환. 이관 031 과 한 벌.
import io
def patch(P, pairs, marker, want):
    s=io.open(P,encoding='utf-8').read()
    for old,new in pairs:
        n=s.count(old); assert n==1, ('anchor count', P, n, old[:60])
        s=s.replace(old,new)
    assert s.count(marker)==want, (P, marker, s.count(marker))
    io.open(P,'w',encoding='utf-8').write(s)
    print('ok', P, len(s))

DJ = 'require(__hooks + "/ym-daily-join-lib.js")'
# 1) ym-db.pb.js getOps: 일일실적 통째 읽기 + 프로그램ID 필터 읽기
A1 = '  var rows = rowsFor(sheetKey, headers);\n'
B1 = A1 + '  if (sheetKey === "ops_일일실적") {   // [260905 통합㉓] 명칭·사업코드는 저장하지 않고 마스터(정본명·사업코드)에서 붙인다(이관 031 뒤). 응답 열 이름은 그대로.\n    var __DJ = ' + DJ + ';\n    if (__DJ.isMigrated($app, __col)) { __DJ.fillDaily($app, __col, rows); headers = __DJ.withCols(headers); }\n  }\n'
A2 = '    return e.json(200, { sheet: "운영_" + sh, headers: __jh, rows: __jr, count: __jr.length, 프로그램ID: __pid17, via: __jd.via });\n'
B2 = '    var __DJ2 = ' + DJ + '; if (__DJ2.isMigrated($app, __col)) { __DJ2.fillDaily($app, __col, __jr); __jh = __DJ2.withCols(__jh); }   // [260905 통합㉓]\n' + A2
patch('api/ym-db.pb.js', [(A1,B1),(A2,B2)], '통합㉓', 2)

# 2) ym-views-lib.js list(): 세부운영관리대장정리(표 = 일일실적) 행에 붙인다
A3 = '  var out = [];\n  if (v.sort)'
B3 = '  var out = [];\n  var __dj = (v.table === "ops_일일실적") ? ' + DJ + ' : null, __djm = null;   // [260905 통합㉓] 명칭·사업코드는 마스터에서\n  if (__dj && __dj.isMigrated(app, col)) __djm = __dj.masterMap(app, col).map;\n  if (v.sort)'
A4 = '    var d = rowData(recs[i]);\n'
B4 = A4 + '    if (__djm) __dj.fill([d], __djm);   // [260905 통합㉓]\n'
patch('api/ym-views-lib.js', [(A3,B3),(A4,B4)], '통합㉓', 2)

# 3) ym-compact.pb.js: 저장 훅에서 두 칸·두 헤더를 버린다(031 적용 환경만)
A5 = 'onRecordUpdate(function (e) { require(__hooks + "/ym-compact-lib.js").onSave(e); e.next(); }, "ymdata", "ymdata_dev");\n'
reg = lambda ev, fn, a, b: ev + '(function (e) { ' + DJ + '.' + fn + '(e); e.next(); }, "' + a + '", "' + b + '");\n'
B5 = A5 + '// [260905 통합㉓] 일일실적 명칭·사업코드는 저장하지 않는다(읽을 때 마스터에서 붙임, api/ym-daily-join-lib.js). 목록(ymmeta) 헤더에 다시 들어와도 버린다. 031 적용된 환경만.\n' + reg('onRecordCreate','stripOnSave','ymdata','ymdata_dev') + reg('onRecordUpdate','stripOnSave','ymdata','ymdata_dev') + reg('onRecordCreate','stripMetaOnSave','ymmeta','ymmeta_dev') + reg('onRecordUpdate','stripMetaOnSave','ymmeta','ymmeta_dev')
patch('api/ym-compact.pb.js', [(A5,B5)], '통합㉓', 1)
print('done dailyjoin')
