// api/ym-compact-lib.js — [260905 통합⑯-3] 저장 다이어트. ymdata(_dev) 행이 저장될 때 빈 칸("")과 _json 열을 빼고 저장한다.
//   읽는 쪽(훅 rowsFor · 각 창구)은 없는 열을 "" 로 채워 돌려주므로 결과는 같다. 프로그램ID 는 빈 값이어도 남긴다(키).
//   PB 레코드 훅(api/ym-compact.pb.js)에서 require 해 쓴다. 이관 022(마스터)·023(나머지 표)이 기존 행을 같은 규칙으로 정리했다.
function parse(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw.string === "function") { try { return JSON.parse(raw.string()); } catch (err) { return null; } }
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch (err2) { return null; } }
  return raw;
}
function compact(d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) return { data: d, changed: false, removed: 0 };
  var o = {}, ks = Object.keys(d), removed = 0;
  for (var i = 0; i < ks.length; i++) {
    var k = ks[i], v = d[k];
    if (k === "_json") { removed++; continue; }
    if ((v === "" || v === null || v === undefined) && k !== "프로그램ID") { removed++; continue; }
    o[k] = v;
  }
  return { data: o, changed: removed > 0, removed: removed };
}
function onSave(e) {
  try {
    var rec = e.record; if (!rec) return;
    var r = compact(parse(rec.get("data")));
    if (r.changed) rec.set("data", r.data);
  } catch (err) { console.log("[ym-compact] " + err); }
}
module.exports = { parse: parse, compact: compact, onSave: onSave };
