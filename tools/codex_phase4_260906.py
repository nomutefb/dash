from pathlib import Path
import json,subprocess,base64,zlib,re
p=Path('public/standalone.html')
s=p.read_text(encoding='utf-8')
source=Path('tools/plan_ui5_260906.py').read_text(encoding='utf-8')
encoded=re.search(r'b64decode\("([A-Za-z0-9+/=]+)"\)',source).group(1)
module=zlib.decompress(base64.b64decode(encoded)).decode('utf-8')
assert s.count(module.strip())==1, 'live UI differs from inspected module'
updated=module
for old,new in json.loads("[[\"_yp.meta=d.meta||{};\",\"_yp.env=d.env||\\\"prod\\\"; _yp.meta=d.meta||{};\"],[\"function _ypFmt(v){ var n=_ypN(v); return n?n.toLocaleString('ko-KR'):\",\"function _ypFmt(v){ var n=_ypN(v); return (_yp.env==='dev'?nzs(v)!=='':!!n)?n.toLocaleString('ko-KR'):\"],[\"async function _ypLoadBiz(){ var d=await api('GET','/api/ym/plan/biz?year='+_ypYear()+'&fresh=1'); _yp.biz=d.rows||[]; return _yp.biz; }\",\"async function _ypLoadBiz(){ var requestId=(_yp._bizRequest||0)+1; _yp._bizRequest=requestId; var d=await api('GET','/api/ym/plan/biz?year='+_ypYear()+'&fresh=1'); if(_yp.env!=='dev'||requestId===_yp._bizRequest)_yp.biz=d.rows||[]; return _yp.biz; }\"],[\"async function _ypLoadProgs(){ var d=await api('GET','/api/ym/plan/programs?year='+_ypYear()+(_yp.bizSel?'&biz='+encodeURIComponent(_yp.bizSel):'')+'&fresh=1'); _yp.progs=d.rows||[]; return _yp.progs; }\",\"async function _ypLoadProgs(){ var requestId=(_yp._progRequest||0)+1; _yp._progRequest=requestId; var d=await api('GET','/api/ym/plan/programs?year='+_ypYear()+(_yp.bizSel?'&biz='+encodeURIComponent(_yp.bizSel):'')+'&fresh=1'); if(_yp.env!=='dev'||requestId===_yp._progRequest)_yp.progs=d.rows||[]; return _yp.progs; }\"],[\"if(s&&(!e.value||e.value<s))e.value=s;\",\"if(s&&(!e.value||(_yp.env!==\\\"dev\\\"&&e.value<s)))e.value=s;\"]]"):
 assert updated.count(old)==1
 updated=updated.replace(old,new)
subprocess.run(['node','--check'],input=updated,text=True,check=True)
subprocess.run(['node','-e',"const vm=require('vm'),fs=require('fs'),a=require('assert');const c={console};vm.runInNewContext(fs.readFileSync(0,'utf8'),c);(async()=>{c._yp.env='dev';a.equal(c._ypFmt('0'),'0');a(c._ypFmt('').includes('<span'));c._yp.env='prod';a(c._ypFmt('0').includes('<span'));c._yp.env='dev';c._yp.year=2026;let jobs=[];c.api=()=>new Promise(resolve=>jobs.push(resolve));const first=c._ypLoadBiz();c._yp.year=2025;const second=c._ypLoadBiz();jobs[1]({rows:['new']});await second;jobs[0]({rows:['stale']});await first;a.equal(c._yp.biz[0],'new');jobs=[];const p1=c._ypLoadProgs(),p2=c._ypLoadProgs();jobs[1]({rows:['newP']});await p2;jobs[0]({rows:['staleP']});await p1;a.equal(c._yp.progs[0],'newP');console.log('PASS dev zero display, stale response isolation, prod zero display unchanged');})().catch(e=>{console.error(e);process.exit(1)});"],input=updated,text=True,check=True)
assert p.read_text(encoding='utf-8')==s
with Path('backups/codex-integrity-260906/standalone-before-phase4.html').open('x',encoding='utf-8') as f:f.write(s)
p.write_text(s.replace(module.strip(),updated.strip()),encoding='utf-8')
print('APPLIED dev UI zero and request race guards; no DB writes')
