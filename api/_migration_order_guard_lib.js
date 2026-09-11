// PlaiMaker Coder 플랫폼 관리 파일 — DO NOT EDIT / DELETE
// PB automigrate 파일명은 초 단위 타임스탬프라, 같은 초에 배치 생성된 컬렉션들의
// relation 의존 순서가 replay(파일명 정렬)에서 뒤집힐 수 있다. 순서 위반이 있을 때만
// stable topological 순서로 타임스탬프를 재배열(기준 초 유지, 이후 +1)하고
// _migrations 북키핑을 함께 갱신한다. 위반이 없으면 아무 것도 하지 않는다.

var MIGRATION_ORDER_DIR = "/pb_migrations";
var MIGRATION_ORDER_MAX_FILE_BYTES = 1024 * 1024;

function migrationOrderParseName(name) {
  var m = /^([0-9]+)_(.+)\.js$/.exec(name);
  if (!m) return null;
  return { ts: parseInt(m[1], 10), rest: m[2] };
}

function migrationOrderExtractMeta(rest, content) {
  // created_* 파일만 컬렉션을 정의한다. down()의 findCollectionByNameOrId 인자가
  // 정의 id다 (top-level "id"는 필드 id들과 섞여 취약). updated_/deleted_ 파일의
  // 같은 호출은 "그 컬렉션이 먼저 존재해야 한다"는 참조로 취급한다.
  var definesId = null;
  var refs = {};
  var target = /app\.findCollectionByNameOrId\("([^"]+)"\)/.exec(content);
  if (target) {
    if (rest.indexOf("created_") === 0) definesId = target[1];
    else refs[target[1]] = true;
  }
  var re = /"collectionId":\s*"([^"]+)"/g;
  var m;
  while ((m = re.exec(content)) !== null) refs[m[1]] = true;
  if (definesId && refs[definesId]) delete refs[definesId];
  var refList = [];
  for (var key in refs) refList.push(key);
  return { definesId: definesId, refs: refList };
}

// files: [{ name, ts, rest, definesId, refs }] (파일명 정렬 순). 현재 순서가 의존을
// 위반할 때만 [{ from, to }] rename 목록을 반환한다. 사이클이면 건드리지 않는다.
function migrationOrderPlan(files) {
  var definerIndex = {};
  var i;
  for (i = 0; i < files.length; i++) {
    if (files[i].definesId) definerIndex[files[i].definesId] = i;
  }
  var deps = [];
  var violated = false;
  for (i = 0; i < files.length; i++) {
    var list = [];
    var refs = files[i].refs || [];
    for (var r = 0; r < refs.length; r++) {
      var d = definerIndex[refs[r]];
      if (d === undefined || d === i) continue;
      list.push(d);
      if (d > i) violated = true;
    }
    deps.push(list);
  }
  if (!violated) return [];

  var indegree = [];
  for (i = 0; i < files.length; i++) indegree.push(deps[i].length);
  var dependents = [];
  for (i = 0; i < files.length; i++) dependents.push([]);
  for (i = 0; i < files.length; i++) {
    for (var d2 = 0; d2 < deps[i].length; d2++) dependents[deps[i][d2]].push(i);
  }
  var order = [];
  var done = [];
  for (i = 0; i < files.length; i++) done.push(false);
  while (order.length < files.length) {
    var pick = -1;
    for (i = 0; i < files.length; i++) {
      if (!done[i] && indegree[i] === 0) { pick = i; break; }
    }
    if (pick === -1) return []; // 사이클 — 안전하게 무개입
    done[pick] = true;
    order.push(pick);
    for (var j = 0; j < dependents[pick].length; j++) indegree[dependents[pick][j]]--;
  }

  var renames = [];
  var last = 0;
  for (i = 0; i < order.length; i++) {
    var f = files[order[i]];
    var ts = f.ts > last ? f.ts : last + 1;
    last = ts;
    if (ts !== f.ts) {
      renames.push({ from: f.name, to: String(ts) + "_" + f.rest + ".js" });
    }
  }
  return renames;
}

function migrationOrderNormalize() {
  var entries;
  try {
    entries = $os.readDir(MIGRATION_ORDER_DIR);
  } catch (err) {
    return; // migrations dir 없음 (로컬 등) — no-op
  }
  var files = [];
  for (var i = 0; i < entries.length; i++) {
    var name = entries[i].name();
    var parsed = migrationOrderParseName(name);
    if (!parsed) continue;
    var content;
    try {
      content = toString($os.readFile(MIGRATION_ORDER_DIR + "/" + name));
    } catch (err) {
      continue;
    }
    if (content.length > MIGRATION_ORDER_MAX_FILE_BYTES) continue;
    var meta = migrationOrderExtractMeta(parsed.rest, content);
    files.push({
      name: name,
      ts: parsed.ts,
      rest: parsed.rest,
      definesId: meta.definesId,
      refs: meta.refs,
    });
  }
  files.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
  var renames = migrationOrderPlan(files);
  for (var r = 0; r < renames.length; r++) {
    var mv = renames[r];
    $os.rename(MIGRATION_ORDER_DIR + "/" + mv.from, MIGRATION_ORDER_DIR + "/" + mv.to);
    // 이미 적용된 DB의 북키핑도 함께 이동해야 재적용 크래시가 없다. 미적용이면 0행.
    $app.db()
      .newQuery("UPDATE _migrations SET file = {:to} WHERE file = {:from}")
      .bind({ from: mv.from, to: mv.to })
      .execute();
    console.log("[MigrationOrderGuard] reordered:", mv.from, "->", mv.to);
  }
}

if (typeof module !== "undefined" && module) {
  module.exports = {
    parseName: migrationOrderParseName,
    extractMeta: migrationOrderExtractMeta,
    plan: migrationOrderPlan,
    normalize: migrationOrderNormalize,
  };
}
