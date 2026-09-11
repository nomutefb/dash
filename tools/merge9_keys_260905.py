# merge9_keys_260905.py — [260905 통합⑭] 훅 postOps·opsRow 가 일일실적 새 행에 실적ID(+기준일자 YYYYMMDD), 코드표 새 행에 코드ID 를 채운다(ym-views-lib dailyStamp/codeStamp).
import io
P='api/ym-db.pb.js'
s=io.open(P,encoding='utf-8').read()
def rep(old,new):
    global s
    n=s.count(old); assert n==1, ('anchor count',n,old[:80])
    s=s.replace(old,new)
# postOps: 행마다 기준일자 정규화(upsert 키 매칭이 YYYYMMDD 로 맞게) + 새로 넣는 행에만 키 부여
rep("""    var src = alias ? alias.rowToPhys(rows[i] || {}) : (rows[i] || {});\n    var keys = Object.keys(src);\n    for (var ki = 0; ki < keys.length; ki++) data[keys[ki]] = src[keys[ki]];\n""",
    """    var src = alias ? alias.rowToPhys(rows[i] || {}) : (rows[i] || {});\n    var keys = Object.keys(src);\n    for (var ki = 0; ki < keys.length; ki++) data[keys[ki]] = src[keys[ki]];\n"""
    """    if (sheetKey === "ops_일일실적" && Object.prototype.hasOwnProperty.call(data, "기준일자")) data["기준일자"] = require(__hooks + "/ym-views-lib.js").d8raw(data["기준일자"]);   // [260905 통합⑭]\n""")
rep("""    var rec = new Record(col, { sheet: sheetKey, rowIndex: nri, data: data });\n    $app.save(rec);\n    if (upKeys && kkOk) upIdx[kkey] = rec;\n""",
    """    if (sheetKey === "ops_일일실적") { var __V14 = require(__hooks + "/ym-views-lib.js"); if (!window_seen14) window_seen14 = {}; __V14.dailyStamp($app, __col, data, window_seen14); }   // [260905 통합⑭] 새 행에 실적ID\n"""
    """    else if (sheetKey === "ops_코드표") { var __V14c = require(__hooks + "/ym-views-lib.js"); if (!window_seen14) window_seen14 = {}; __V14c.codeStamp($app, __col, data, window_seen14); }\n"""
    """    var rec = new Record(col, { sheet: sheetKey, rowIndex: nri, data: data });\n    $app.save(rec);\n    if (upKeys && kkOk) upIdx[kkey] = rec;\n""")
rep("""  var nri = meta.get("nextRowIndex") || 2;\n  var inserted = 0, updated = 0;\n""",
    """  var nri = meta.get("nextRowIndex") || 2;\n  var inserted = 0, updated = 0, window_seen14 = null;   // [260905 통합⑭] 한 요청 안에서 키 겹침 방지용 집합\n""")
# opsRow POST
rep("""    var rk = Object.keys(row), hAdded = false;\n    for (i = 0; i < rk.length; i++) { k = rk[i]; data[k] = row[k]; if (headers.indexOf(k) < 0) { headers.push(k); hAdded = true; } }\n""",
    """    var rk = Object.keys(row), hAdded = false;\n    for (i = 0; i < rk.length; i++) { k = rk[i]; data[k] = row[k]; if (headers.indexOf(k) < 0) { headers.push(k); hAdded = true; } }\n"""
    """    if (sheetKey === "ops_일일실적") require(__hooks + "/ym-views-lib.js").dailyStamp($app, __col, data, null); else if (sheetKey === "ops_코드표") require(__hooks + "/ym-views-lib.js").codeStamp($app, __col, data, null);   // [260905 통합⑭]\n""")
assert s.count('통합⑭')==4, s.count('통합⑭')
io.open(P,'w',encoding='utf-8').write(s)
print('ok', len(s))
