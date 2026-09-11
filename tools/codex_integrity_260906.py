from pathlib import Path
import json, subprocess, hashlib
spec = json.loads("{\"file\":\"api/ym-plan-lib.js\",\"replacements\":[[\"(\\\"0\\\" + (mx + 1)).slice(-2)\",\"(mx + 1 < 10 ? \\\"0\\\" : \\\"\\\") + String(mx + 1)\",2],[\"var d = R ? R.d : {}, isNew = !R;\",\"var d = R ? R.d : {}, isNew = !R, oldBizCode = R ? nz(R.d[\\\"사업코드\\\"]) : \\\"\\\";\",1],[\"if (R && nz(R.d[\\\"사업코드\\\"]) && nz(R.d[\\\"사업코드\\\"]) !== code) recomputeBiz(app, col, nz(R.d[\\\"사업코드\\\"]));\",\"if (oldBizCode && oldBizCode !== code) recomputeBiz(app, col, oldBizCode);\",1]]}")
p = Path(spec['file'])
s = p.read_text(encoding='utf-8')
original = s
assert '[codex-integrity-260906]' not in s, 'already applied; no files changed'
for old, new, count in spec['replacements']:
    assert s.count(old) == count, ('anchor mismatch', old, s.count(old), count)
    s = s.replace(old, new)
subprocess.run(['node', '--check'], input=s, text=True, check=True)
checks = """const vm=require('vm');const fs=require('fs');const ctx={module:{exports:{}},console};vm.runInNewContext(fs.readFileSync(0,'utf8'),ctx);const rec=d=>({publicExport:()=>({data:d})});const app={findRecordsByFilter:()=>[rec({'프로그램ID':'26-a99','사업코드':'26-a99','구분':'사업'}),rec({'프로그램ID':'261220_99'})]};const col=x=>x;const b=ctx.nextBizCode(app,col,'2026','a');const p=ctx.nextProgramId(app,col,'20261220');if(b!=='26-a100'||p!=='261220_100')throw Error(JSON.stringify({b,p}));console.log('PASS sequence 99 -> 100');"""
subprocess.run(['node','-e',checks], input=s, text=True, check=True)
out = Path('tools/codex_plan_candidate_260906.js')
out.write_text(s,encoding='utf-8')
print('CHECK_ONLY no app files or DB changed')
print('SOURCE_SHA256',hashlib.sha256(original.encode()).hexdigest())
print('CANDIDATE_SHA256',hashlib.sha256(s.encode()).hexdigest())
print('PATCH_COUNTS', [x[2] for x in spec['replacements']])

# Regression: a program moving from A to B must recompute both A and B.
move_check = "const vm=require('vm'),fs=require('fs'),assert=require('assert');const c={module:{exports:{}},console};vm.runInNewContext(fs.readFileSync(0,'utf8'),c);let row={'프로그램ID':'261220_01','사업코드':'26-a01','정본명':'test','시작일':'20261220','종료일':'20261220'};let updated;const calls=[];c.managers=()=>({});c.findProg=()=>({d:row,rec:{set:(k,v)=>{updated=v;}}});c.findBiz=()=>({d:{'표시_분야':'공연'}});c.ensureHeaders=()=>({});c.recomputeBiz=(app,col,code)=>calls.push(code);c.touchLastmod=()=>{};c.dailyIndex=()=>({});c.programsOfBiz=()=>[];c.progView=()=>({});const r=c.programSave({save:()=>{}},()=>({}),{'프로그램ID':'261220_01','사업코드':'26-a02','시작일':'2026-12-20','종료일':'2026-12-20'});assert(r.ok);assert.equal(updated['사업코드'],'26-a02');assert.deepEqual(calls,['26-a02','26-a01']);console.log('PASS move recomputes both businesses');"
subprocess.run(['node','-e',move_check], input=s, text=True, check=True)
import sys, os
if '--apply-dev' in sys.argv:
    # Preserve the production implementation; dispatch only preview requests.
    anchor = '    var info = e.requestInfo() || {}, q = info.query || {}, body = info.body || {};'
    assert original.count(anchor) == 1, 'dispatch anchor mismatch'
    gate = "    if (ev === \"dev\") return require(hooks + \"/ym-plan-dev-lib.js\").handle(e, app, hooks, name); // [codex-integrity-260906]" + chr(10)
    routed = original.replace(anchor, gate + anchor)
    subprocess.run(['node','--check'], input=routed, text=True, check=True)
    assert p.read_text(encoding='utf-8') == original, 'source changed during preparation'
    dev = Path('api/ym-plan-dev-lib.js')
    assert not dev.exists(), 'dev module already exists; inspect before retry'
    backup = Path('backups/codex-integrity-260906')
    backup.mkdir(parents=True, exist_ok=True)
    with (backup/'ym-plan-lib.js').open('x',encoding='utf-8') as f: f.write(original)
    dev.write_text(s,encoding='utf-8')
    p.write_text(routed,encoding='utf-8')
    print('APPLIED_DEV_ONLY sequence and business move; no DB rows changed')
    print('ROUTED_SHA256', hashlib.sha256(routed.encode()).hexdigest())
