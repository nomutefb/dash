from pathlib import Path
import subprocess
p=Path('api/ym-changelog-lib.js')
s=p.read_text(encoding='utf-8')
old="function listFor(app, dc, key, limit) {\n"
new="function listFor(app, dc, key, limit) {\n  if (String(dc) === \"ymdata_dev\") {\n    var wanted = Math.max(1, Math.min(500, Math.floor(Number(limit) || 200))), pageSize = 200, offset = 0, found = [];\n    while (found.length < wanted) {\n      var page = app.findRecordsByFilter(dc, \"sheet = '\" + LOG + \"'\", \"-rowIndex,-id\", pageSize, offset);\n      for (var j = 0; j < page.length && found.length < wanted; j++) { var item = jsonValue(page[j].get(\"data\"), {}) || {}; if (!key || nz(item[\"키\"]) === key) found.push(item); }\n      if (page.length < pageSize) break;\n      offset += page.length;\n    }\n    return found;\n  }\n"
assert s.count(old)==1 and 'var wanted = Math.max' not in s
candidate=s.replace(old,new)
subprocess.run(['node','--check'],input=candidate,text=True,check=True)
subprocess.run(['node','-e',"const c={module:{exports:{}},console};require('vm').runInNewContext(require('fs').readFileSync(0,'utf8'),c);const a=require('assert');const records=Array.from({length:450},(_,i)=>({get:()=>({'키':i>=420?'target':'other',n:i})}));const app={findRecordsByFilter:(dc,f,s,l,o)=>records.slice(o,o+l)};let r=c.listFor(app,'ymdata_dev','target',2);a.equal(r.length,2);a.equal(r[0].n,420);a.equal(c.listFor(app,'ymdata_dev','missing',2).length,0);a.equal(c.listFor(app,'ymdata','target',2).length,0);console.log('PASS dev history finds matching rows beyond initial limit; prod path unchanged');"],input=candidate,text=True,check=True)
with Path('backups/codex-integrity-260906/ym-changelog-before-phase3.js').open('x',encoding='utf-8') as f: f.write(s)
assert p.read_text(encoding='utf-8')==s
p.write_text(candidate,encoding='utf-8')
print('APPLIED history pagination dev only; no DB writes')
