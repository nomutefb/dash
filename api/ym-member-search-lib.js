// ym-member-search-lib.js — [260907 회원 검색 창구] 회원 명단을 통째로 내려보내지 않고,
//   검색어에 맞는 행(최대 200)과 회원 한 명의 예매 요약만 돌려준다.
//   호출: POST /api/ym/ticketlink/member-search  {q, ages[], city, sido, limit}
//         POST /api/ym/ticketlink/member-booking {ph}
//   권한: 개발본(dev) 전용. dev 가 아니면 handle 이 404. dev 에서는 ym-auth-lib guard 가
//         /api/ym/ticketlink/member- 접두 경로를 세션+admin 전용으로 막는다(guard 는 dev 가 아니면 통과시키므로 여기서 닫는다).
//   환경: ym-env-lib envOf(e) → dev 면 ymdata_dev.
//   Goja ES5 / CommonJS. (파일 내용에 「replace 열괄호 슬래시 홑따옴표 슬래시 g」 꼴을 쓰면 플랫폼 WAF 가 막는다 — 쓰지 말 것)
var MEMBERS = 'ops_회원';
var GJ_GU = { '동구': 1, '서구': 1, '남구': 1, '북구': 1, '광산구': 1 };
var PAGE = 2000, MAX_PAGES = 20;   // DB 에서 후보를 2,000행씩 가져오고, 표에 보일 만큼(limit) 맞으면 멈춘다(넓은 검색어가 3만 행을 메모리에 올리지 않게)
function nz(v) { return String(v == null ? '' : v).trim(); }
function json(v, f) { try { if (v && typeof v.string === 'function') return JSON.parse(v.string()); if (typeof v === 'string') return JSON.parse(v); return v == null ? f : v; } catch (e) { return f; } }
function data(r) { var v = json(r.get('data'), {}); return (v && typeof v === 'object') ? v : {}; }
function digits(s) { return nz(s).replace(/\D/g, ''); }
// LIKE 값 정리 — % 와 _ 는 SQLite LIKE 와일드카드라 뺀다(정확한 대조는 뒤의 rowMatch 가 원문 검색어로 한다)
function likeSafe(s) { return nz(s).replace(/[%_]/g, ''); }
// 앱의 _memCityName 과 같은 규칙(시군구 이름)
function cityName(s1, s2) {
  if (s1 === '전남광주통합특별시') return GJ_GU[s2] ? 'Example State 207' : s2;
  var m = s1.match(/^(.+?)(특별시|광역시|특별자치시)$/);
  if (m) return m[1] + '시';
  return s2;
}
// 숫자만 있는 검색어 — 저장된 번호(휴대폰정규화)는 '00000002264'(3-4-4) 또는 '00000038572'(3-3-4) 꼴.
//   글자 사이에 % 를 넣는 느슨한 LIKE 는 후보가 1~2만 행이라 느렸다(실측 4~7초) → 두 묶음 규칙에 맞는 자리에만 하이픈을 넣은 모양을 OR 로 묶는다.
function phoneVariants(qd) {
  var n = qd.length, out = [], seen = {}, i;
  function add(s) { if (!seen[s]) { seen[s] = 1; out.push(s); } }
  add(qd); // Raw digits are also a valid stored phone representation.
  if (n === 11) { add('"' + qd.slice(0, 3) + '-' + qd.slice(3, 7) + '-' + qd.slice(7) + '"'); return out; }
  if (n === 10) add('"' + qd.slice(0, 3) + '-' + qd.slice(3, 6) + '-' + qd.slice(6) + '"');
  if (n <= 4) add(qd);
  // 3-4-4: 경계 하나(앞≤3|뒤≤4 또는 앞≤4|뒤≤4) · 경계 둘(앞≤3 - 가운데 4 - 뒤≤4)
  for (i = Math.max(1, n - 4); i <= Math.min(4, n - 1); i++) add(qd.slice(0, i) + '-' + qd.slice(i));
  for (i = Math.max(1, n - 8); i <= Math.min(3, n - 5); i++) add(qd.slice(0, i) + '-' + qd.slice(i, i + 4) + '-' + qd.slice(i + 4));
  // 3-3-4: 경계 하나(앞≤3|뒤≤3 또는 앞≤3|뒤≤4) · 경계 둘(앞≤3 - 가운데 3 - 뒤≤4)
  for (i = Math.max(1, n - 4); i <= Math.min(3, n - 1); i++) add(qd.slice(0, i) + '-' + qd.slice(i));
  for (i = Math.max(1, n - 7); i <= Math.min(3, n - 4); i++) add(qd.slice(0, i) + '-' + qd.slice(i, i + 3) + '-' + qd.slice(i + 3));
  return out.length ? out : [qd];
}
function rowMatch(d, q, qd, ages, city, sido) {
  if (ages.length && ages.indexOf(nz(d['연령대']) || '미상') < 0) return false;
  var s1 = nz(d['주소1']), s2 = nz(d['주소2']);
  if (city && cityName(s1, s2) !== city) return false;
  if (sido && s1 !== sido) return false;
  if (!q) return true;
  var name = nz(d['이름']).toLowerCase();
  var addr = (s1 + ' ' + s2 + ' ' + nz(d['주소3']) + ' ' + nz(d['주소4'])).toLowerCase();
  var ph = digits(d['휴대폰정규화'] || d['휴대폰번호']);
  if (qd.length >= 3 && ph.indexOf(qd) >= 0) return true;
  // 낱말 AND — '순천시 왕조로' 처럼 칸이 다른 주소(주소3 이 비어 두 칸 띄어짐 포함)도 걸리게. 이름+주소를 한 줄로 합쳐 낱말마다 대조.
  var hay = (name + ' ' + addr).replace(/\s+/g, ' '), toks = q.split(/\s+/), i;
  for (i = 0; i < toks.length; i++) { if (toks[i] && hay.indexOf(toks[i]) < 0) return false; }
  return true;
}
// 응답 행 = 화면(명부 표·상세)이 실제로 읽는 열만. 이메일·생년월일·주소원본·아이디는 보내지 않는다.
var OUT_COLS = ['이름', '휴대폰정규화', '휴대폰번호', '주소1', '주소2', '주소3', '주소4', '우편번호', '연령대'];
function pick(d) {
  var o = {}, i, k;
  for (i = 0; i < OUT_COLS.length; i++) { k = OUT_COLS[i]; o[k] = (d[k] === undefined || d[k] === null) ? '' : d[k]; }
  if (o['휴대폰정규화']) o['휴대폰번호'] = '';   // 화면은 정규화본만 쓴다 — 원본 번호는 안 보낸다
  return o;
}
function runFilter(app, col, filter, params, limit, offset) {
  try { return app.findRecordsByFilter(col('ymdata'), filter, 'rowIndex', limit, offset, params); }
  catch (e) {
    var m = nz(e && e.message || e);
    if (m.indexOf('no rows') >= 0 || m.indexOf('not found') >= 0 || m.indexOf('missing') >= 0) return [];
    throw new Error('회원 조회 실패: ' + m);   // 필터 문법·DB 오류는 숨기지 않는다(400 으로 올라감)
  }
}
function search(app, col, body) {
  var q = nz(body.q).toLowerCase(), qd = digits(q);
  var ages = (Array.isArray(body.ages) ? body.ages : []).map(nz).filter(function (x) { return !!x; }).slice(0, 12);
  var city = nz(body.city), sido = nz(body.sido);
  var limit = Math.min(Math.max(Number(body.limit) || 200, 1), 200);
  var hasFilter = !!(ages.length || city || sido);
  if (!q && !hasFilter) return { ok: true, rows: [], total: 0, note: '검색어 없음' };
  var digitsOnly = qd.length >= 3 && qd === q.replace(/[\s\-().+]/g, '');
  var ql = likeSafe(q);
  // 너무 짧은 검색어는 3만 행 전수 조회가 되므로 거절(글자 2자 이상, 번호 4자리 이상). 예울이 조건(필터)이 있으면 검색어 없이도 된다.
  if (q && !hasFilter && (digitsOnly ? qd.length < 4 : ql.length < 2)) return { ok: true, rows: [], total: 0, tooShort: true, note: digitsOnly ? '번호는 네 자리 이상' : '두 글자 이상' };
  var filter = 'sheet = {:sh}', params = { sh: MEMBERS }, i;
  // DB 쪽에서 먼저 거른다(LIKE) — 후보만 JS 로 정확히 대조.
  if (q && digitsOnly) {
    var pv = phoneVariants(qd), pors = [];
    for (i = 0; i < pv.length; i++) { pors.push('data ~ {:v' + i + '}'); params['v' + i] = pv[i]; }
    filter += ' && (' + pors.join(' || ') + ')';
  } else if (q) {
    var toks = ql.split(/\s+/).filter(function (t) { return t.length >= 1; }).slice(0, 4), ands = [];   // '순천시 조례동' 처럼 칸이 다른 주소도 걸리게 낱말 AND
    if (!toks.length) toks = [ql];
    for (i = 0; i < toks.length; i++) { ands.push('data ~ {:t' + i + '}'); params['t' + i] = toks[i]; }
    filter += ' && (' + ands.join(' && ') + ')';
  } else if (ages.length) {
    var ors = [];
    for (i = 0; i < ages.length; i++) { ors.push('data ~ {:a' + i + '}'); params['a' + i] = likeSafe(ages[i]); }
    filter += ' && (' + ors.join(' || ') + ')';
  } else if (sido) { filter += ' && data ~ {:p}'; params.p = likeSafe(sido); }
  else if (city) { filter += ' && data ~ {:p}'; params.p = likeSafe(city).replace(/시$/, ''); }
  var countTotal = body.countTotal === true, matched = 0; // YM_YEULI_FAST_260909: count on server, return at most 200 rows
  var out = [], scanned = 0, candidates = 0, off = 0, p, page, stopped = false, exhausted = false;
  for (p = 0; p < MAX_PAGES; p++) {
    page = runFilter(app, col, filter, params, PAGE, off);
    if (!page.length) { exhausted = true; break; }
    candidates += page.length; off += page.length;
    for (i = 0; i < page.length; i++) {
      scanned++;
      var d = data(page[i]);
      if (rowMatch(d, q, qd, ages, city, sido)) { matched++; if (out.length < limit) out.push(pick(d)); if (!countTotal && out.length >= limit) { stopped = true; break; } }
    }
    if (stopped) break;
    if (page.length < PAGE) { exhausted = true; break; }
  }
  var approx = stopped || !exhausted;   // 200 을 채워 멈췄거나 페이지 상한에 걸렸으면 정확한 수를 모른다
  return { ok: true, rows: out, total: countTotal ? matched : out.length, approx: approx, limit: limit, counted: countTotal };
}
// 예매 요약 — 예매집계(public/data/db_v46/booking_agg.json 22,630행)를 회원키 끝자리(0~9)로 10조각 낸 사본
//   api/data/booking_agg.s{0..9}.json(각 ~280KB, 260907 업로드) 중 한 조각만 읽는다(훅 프로세스는 public/ 폴더를 못 읽는 것으로 실측돼 api/data/ 에 사본을 둔다).
//   프로세스 캐시는 두지 않는다 — 조각을 새로 올리면 재시작 없이 바로 반영되게. 원본 booking_agg.json 이 바뀌면 조각도 다시 만든다(tools/booking_shard_260907.py).
function bookingOf(app, hooks, body) {
  var ph = digits(body.ph);
  if (ph.length < 9) return { ok: false, error: '휴대폰 번호가 필요합니다' };
  var digit = ph.charAt(ph.length - 1), txt = null, d = null;
  try { var raw = $os.readFile(hooks + '/data/booking_agg.s' + digit + '.json'); txt = (typeof raw === 'string') ? raw : String(toString(raw)); } catch (e0) { txt = null; }
  if (!txt) return { ok: true, found: false, source: null, note: '예매집계 조각 파일을 읽을 수 없음' };
  try { d = JSON.parse(txt); } catch (e1) { return { ok: true, found: false, source: null, note: '예매집계 조각 파일 해석 실패' }; }
  var rows = (d && d.rows) || [], i;
  for (i = 0; i < rows.length; i++) {
    if (nz(rows[i]['회원키']) === ph) return { ok: true, found: true, source: 'shard', builtAt: d.builtAt || '', row: rows[i] };
  }
  return { ok: true, found: false, source: 'shard', builtAt: d.builtAt || '' };
}
function handle(e, app, hooks, action) {
  var st = 200, payload;
  try { e.response.header().set('Cache-Control', 'no-store'); } catch (eh) {}
  try {
    var env = require(hooks + '/ym-env-lib.js');
    var envName = env.envOf(e);
    if (envName !== 'dev') { st = 404; payload = { ok: false, error: '없는 경로' }; }   // 개발본 전용 — 발행본에서는 guard 가 인증을 안 보므로 여기서 닫는다
    else {
      var col = function (n) { return env.col(app, n, envName); };
      var body = env.bodyOf(e) || {};
      if (action === 'search') payload = search(app, col, body);
      else if (action === 'booking') payload = bookingOf(app, hooks, body);
      else { st = 404; payload = { ok: false, error: '지원하지 않는 요청' }; }
    }
  } catch (err) { st = 400; payload = { ok: false, error: nz(err && err.message || err) }; }
  return e.json(st, payload);
}
module.exports = { handle: handle, search: search, bookingOf: bookingOf, cityName: cityName, phoneVariants: phoneVariants };
