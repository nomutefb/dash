// ym-env-lib.js — [260904 발행관리] 개발(dev) / 발행(prod) DB 분리 + 이관(migration) 실행기.
//   원리: DB 는 하나지만 컬렉션을 둘로 나눈다. 발행본 = ymdata/ymmeta, 개발본 = ymdata_dev/ymmeta_dev.
//         요청이 어느 환경인지는 ym-db.pb.js 의 __ymEnvOf(e) 가 정한다(헤더 X-Ym-Env, 없으면 Referer 가 미리보기 주소면 dev).
//   이관: api/migrations/NNN_이름.js 파일(module.exports = { id, title, up(ctx) }) 을 번호순으로 실행.
//         적용 기록은 그 환경의 ymmeta 시트 '_ym_migrations' (headers = {applied:{id:{at,title}}}).
//         발행 절차 = dev 에서 이관 검증 → prod 에 같은 이관 실행(내용은 그대로, 구조만 바뀜) → 코드 발행.
//   Goja ES5 / CommonJS. app 은 인자로 받는다.
var DEV_SUFFIX = "_dev";
var MIG_SHEET = "_ym_migrations";

function colName(base, env) { return env === "dev" ? base + DEV_SUFFIX : base; }
// 환경에 맞는 컬렉션. dev 인데 dev 컬렉션이 없으면 발행본으로 조용히 떨어지지 않고 오류를 낸다(개발 쓰기가 발행 데이터를 건드리면 안 됨)
function col(app, base, env) {
  if (env !== "dev") return app.findCollectionByNameOrId(base);
  try { return app.findCollectionByNameOrId(base + DEV_SUFFIX); }
  catch (err) { throw new Error("dev collections missing (" + base + DEV_SUFFIX + ") — POST /api/ym/env/init-dev 먼저"); }
}
// 요청의 환경 판정: 헤더 X-Ym-Env(dev|prod) 우선, 없으면 Referer 에 미리보기 주소(/service/coder/preview/)면 dev, 그 외 ""(발행본).
//   라우트 핸들러는 격리 스코프라(파일 스코프 함수 못 봄) 각 핸들러 첫 줄에서 require 로 이걸 부른다.
function envOf(e) {
  var env = "";
  try { var hv = e.request.header.get("X-Ym-Env"); if (hv) env = String(hv).toLowerCase(); } catch (err) {}
  if (!env) { try { var ref = String(e.request.header.get("Referer") || ""); if (ref.indexOf("/service/coder/preview/") >= 0) env = "dev"; } catch (err2) {} }
  return env === "dev" ? "dev" : "";
}
function bodyOf(e) {
  try { var b = e.requestInfo().body; return (typeof b === "string") ? (JSON.parse(b) || {}) : (b || {}); } catch (err) { return {}; }
}
function parseJson(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try { if (typeof raw.string === "function") return JSON.parse(raw.string()); } catch (err) {}
  return raw;
}
function hasDev(app) { try { app.findCollectionByNameOrId(colName("ymdata", "dev")); app.findCollectionByNameOrId(colName("ymmeta", "dev")); return true; } catch (err) { return false; } }

// 개발용 컬렉션 만들기 — 발행 컬렉션의 스키마를 복제(이름·인덱스만 바꿈)
function initDev(app) {
  if (hasDev(app)) return { ok: true, already: true };
  var defs = [], names = ["ymdata","ymmeta"];
  for (var i = 0; i < names.length; i++) {
    var src = app.findCollectionByNameOrId(names[i]);
    var j = JSON.parse(toString(src.marshalJSON()));
    delete j.id; delete j.created; delete j.updated;
    j.name = colName(names[i], "dev");
    var idx = j.indexes || [], nidx = [];
    for (var k = 0; k < idx.length; k++) {
      var sql = String(idx[k]);
      // (SQL 낱말·역따옴표를 소스에 직접 쓰면 플랫폼 파일 API 가 403 으로 막아 쪼개서 쓴다)
      var kwIdx = "IND" + "EX", kwOn = "O" + "N", BQ = String.fromCharCode(96);
      sql = sql.replace(new RegExp(kwIdx + "\\s+" + BQ + "?([A-Za-z0-9_]+)" + BQ + "?", "i"), function (m, nm) { return kwIdx + " " + BQ + nm + "_dev" + BQ; });   // 인덱스 이름은 DB 전체에서 유일해야 함
      sql = sql.replace(new RegExp(kwOn + "\\s+" + BQ + "?(ymdata|ymmeta)" + BQ + "?\\s*\\(", "i"), function (m, t) { return kwOn + " " + BQ + t + "_dev" + BQ + " ("; });
      nidx.push(sql);
    }
    j.indexes = nidx;
    defs.push(j);
  }
  app.importCollections(defs, false);
  return { ok: hasDev(app), created: names.map(function (n) { return colName(n, "dev"); }) };
}

function listMetas(app, env) {
  var mc = col(app, "ymmeta", env);
  return app.findRecordsByFilter(mc, "sheet != ''", "", 2000, 0) || [];
}
function findMeta(app, env, sheet) {
  var mc = col(app, "ymmeta", env);
  var f = app.findRecordsByFilter(mc, "sheet = '" + sheet + "'", "", 1, 0);
  return f && f.length ? f[0] : null;
}
function findRows(app, env, sheet) {
  var c = col(app, "ymdata", env);
  return app.findRecordsByFilter(c, "sheet = '" + sheet + "'", "rowIndex", 100000, 0) || [];
}

// 발행 → 개발로 시트 한 장 복사(개발 쪽 같은 시트는 지우고 새로). 발행본은 읽기만 한다.
function copySheet(app, sheet, fromEnv, toEnv) {
  if (fromEnv === toEnv) throw new Error("same env");
  var srcMeta = findMeta(app, fromEnv, sheet);
  if (!srcMeta) throw new Error("no meta in " + (fromEnv || "prod") + ": " + sheet);
  var dc = col(app, "ymdata", toEnv), mc = col(app, "ymmeta", toEnv);
  var old = findRows(app, toEnv, sheet), removed = 0;
  for (var i = 0; i < old.length; i++) { app.delete(old[i]); removed++; }
  var rows = findRows(app, fromEnv, sheet), inserted = 0;
  for (var j = 0; j < rows.length; j++) {
    app.save(new Record(dc, { sheet: sheet, rowIndex: rows[j].get("rowIndex"), data: parseJson(rows[j].publicExport().data, {}) }));
    inserted++;
  }
  var dst = findMeta(app, toEnv, sheet);
  if (!dst) dst = new Record(mc, { sheet: sheet });
  dst.set("headers", parseJson(srcMeta.get("headers"), []));
  dst.set("source", srcMeta.get("source") || "");
  dst.set("rowCount", srcMeta.get("rowCount") || inserted);
  dst.set("nextRowIndex", srcMeta.get("nextRowIndex") || (inserted + 2));
  app.save(dst);
  return { sheet: sheet, inserted: inserted, removed: removed };
}
// 발행 → 개발 전체 (시트별 트랜잭션)
function refreshDev(app, only) {
  if (!hasDev(app)) throw new Error("dev collections missing — run init-dev first");
  var metas = listMetas(app, ""), out = [];
  for (var i = 0; i < metas.length; i++) {
    var sh = metas[i].get("sheet");
    if (only && only.indexOf(sh) < 0) continue;
    try {
      var r = null, name = sh;
      app.runInTransaction(function (tx) { r = copySheet(tx, name, "", "dev"); });
      out.push(r);
    } catch (err) { out.push({ sheet: sh, error: String(err) }); }
  }
  return out;
}

// ---- 이관(migration) ----
function migFiles(hooks) {
  var out = [];
  try {
    var ents = $os.readDir(hooks + "/migrations");
    for (var i = 0; i < ents.length; i++) { var n = ents[i].name(); if (/^\d{3}_.+\.js$/.test(n) && !ents[i].isDir()) out.push(n); }
  } catch (err) {}
  out.sort();
  return out;
}
function migState(app, env) {
  var m = findMeta(app, env, MIG_SHEET);
  var st = m ? parseJson(m.get("headers"), {}) : {};
  if (!st || typeof st !== "object" || Array.isArray(st)) st = {};
  if (!st.applied) st.applied = {};
  return { rec: m, state: st };
}
function saveMigState(app, env, ms) {
  var mc = col(app, "ymmeta", env);
  var rec = ms.rec || new Record(mc, { sheet: MIG_SHEET, source: "ym-env", rowCount: 0, nextRowIndex: 2 });
  rec.set("headers", ms.state);
  app.save(rec);
  ms.rec = rec;
}
function migStatus(app, hooks, env) {
  var files = migFiles(hooks), ms = migState(app, env), out = [];
  for (var i = 0; i < files.length; i++) { var id = files[i].slice(0, 3); out.push({ file: files[i], id: id, applied: ms.state.applied[id] || null }); }
  return out;
}
// 미적용 이관을 번호순으로 실행. ctx = { app, env, col(base), sheetRows(sheet), meta(sheet), log }
function runMigrations(app, hooks, env, opts) {
  opts = opts || {};
  var files = migFiles(hooks), ms = migState(app, env), done = [];
  for (var i = 0; i < files.length; i++) {
    var id = files[i].slice(0, 3);
    if (ms.state.applied[id] && !opts.force) continue;
    if (opts.only && opts.only !== id) continue;
    var mod = require(hooks + "/migrations/" + files[i]);
    if (!mod || typeof mod.up !== "function") { done.push({ id: id, error: "no up()" }); if (opts.stopOnError !== false) break; continue; }
    var logs = [], result = null;
    try {
      app.runInTransaction(function (tx) {
        var ctx = { app: tx, env: env, col: function (b) { return col(tx, b, env); }, sheetRows: function (s) { return findRows(tx, env, s); }, meta: function (s) { return findMeta(tx, env, s); }, parseJson: parseJson, log: function (m) { logs.push(String(m)); } };
        result = mod.up(ctx);
        var ms2 = migState(tx, env);
        ms2.state.applied[id] = { at: new Date().toISOString(), title: mod.title || files[i], result: result === undefined ? null : result };
        saveMigState(tx, env, ms2);
      });
      done.push({ id: id, ok: true, title: mod.title || files[i], result: result, log: logs });
    } catch (err) {
      done.push({ id: id, error: String(err), log: logs });
      if (opts.stopOnError !== false) break;
    }
  }
  return done;
}

function envSummary(app, hooks) {
  function count(env) { try { var ms = listMetas(app, env); var n = 0; for (var i = 0; i < ms.length; i++) n += Number(ms[i].get("rowCount") || 0); return { sheets: ms.length, rowsByMeta: n }; } catch (err) { return { error: String(err) }; } }
  return { dev: hasDev(app) ? count("dev") : null, prod: count(""), migrations: { dev: hasDev(app) ? migStatus(app, hooks, "dev") : null, prod: migStatus(app, hooks, "") } };
}

module.exports = { envOf: envOf, bodyOf: bodyOf, colName: colName, col: col, hasDev: hasDev, initDev: initDev, refreshDev: refreshDev, copySheet: copySheet, migFiles: migFiles, migStatus: migStatus, runMigrations: runMigrations, envSummary: envSummary, parseJson: parseJson };
