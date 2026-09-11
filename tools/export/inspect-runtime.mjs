// Read-only deployment inventory. Never loads secrets or executes application hooks.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const hash=p=>crypto.createHash('sha256').update(read(p)).digest('hex');
const hooks=fs.readdirSync(path.join(root,'api')).filter(p=>p.endsWith('.pb.js')).sort();
const routes=[],crons=[];
for(const name of hooks){
  const source=read('api/'+name);
  for(const match of source.matchAll(/routerAdd\(\s*['"]([A-Z]+)['"]\s*,\s*['"]([^'"]+)['"]/g))routes.push({method:match[1],path:match[2],file:'api/'+name});
  for(const match of source.matchAll(/cronAdd\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/g))crons.push({name:match[1],schedule:match[2],file:'api/'+name});
}
const schema=JSON.parse(read('data/database/schema.json'));
const collections=Object.entries(schema).map(([name,definition])=>({name,columns:(definition.columns||[]).map(c=>({name:c.name,type:c.data_type,nullable:c.is_nullable})),dataExportPresent:fs.existsSync(path.join(root,'data/database',name+'.jsonl'))}));
const required=['api/_runtime_proxy.js','api/_runtime_env.js','api/ym-auth-initial-private.js','api/ym-ticketlink-private.js'];
const auth=read('api/ym-auth-lib.js'),env=read('api/ym-env-lib.js');
const result={
  checkedAt:new Date().toISOString(),scope:'Local exported snapshot only; live MISO editor blocked by its internal-network policy.',
  deployReady:false,
  entry:'public/standalone.html',hookFiles:hooks.length,routeCount:routes.length,routes,cronCount:crons.length,crons,collections,
  requirements:required.map(p=>({path:p,present:fs.existsSync(path.join(root,p))})),
  authentication:{customGuardDevOnly:auth.includes("envOf(e)!=='dev')return e.next()"),devPreviewEntryEnabled:/var DEV_PREVIEW_DIRECT_ENTRY\s*=\s*true/.test(auth),sourceHash:hash('api/ym-auth-lib.js')},
  environment:{clientHeaderSelectsDev:env.includes('X-Ym-Env'),defaultUsesProductionCollections:env.includes('return env === "dev" ? "dev" : ""'),sourceHash:hash('api/ym-env-lib.js')},
  blockers:[
    'Live Code/Database Workbench cannot be inspected until the authorized company network is restored.',
    'GitHub Pages serves static files; no PocketBase runtime is deployed for this copy.',
    'Platform gateway authentication, runtime proxy and managed environment are not included in the export.',
    'The custom session guard only covers dev requests; a trusted server boundary is required before exposing this backend.',
    'Actual authentication secrets, auth records and collector connector key are intentionally absent.',
    'MISO LLM routes depend on its internal Session Manager and registered model provider.',
    'Collection columns alone are not a complete PocketBase collection/rule/credential restoration definition.'
  ],
  nextChecks:['Read current MISO Code and Database Workbench','Confirm supported gateway/runtime deployment contract','Provision a separate persistent backend with server-side authentication','Import pseudonymized data into isolated collections and verify IDs/joins/totals','Configure user-entered authentication and external-service settings','Verify unauthenticated rejection, role boundaries and actual UI CRUD before switching the public URL']
};
fs.writeFileSync(path.join(root,'migration/runtime-readiness.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({deployReady:result.deployReady,hookFiles:hooks.length,routes:routes.length,crons:crons.length,collections:collections.length,missingFiles:result.requirements.filter(x=>!x.present).map(x=>x.path),authentication:result.authentication,blockers:result.blockers},null,2));
