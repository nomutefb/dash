import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const state=path.join(root,'runtime/.local');
const plan=JSON.parse(fs.readFileSync(path.join(state,'import-plan.json'),'utf8'));
const db=new DatabaseSync(path.join(state,'pb_data/data.db'),{readOnly:true});
const results=[];
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
function normalize(row,columns){const out={};for(const c of columns){let v=row[c.name]??null;if(c.type==='json'&&typeof v==='string'&&v!==''){v=JSON.parse(v);}if(c.type==='bool'&&v!==null)v=!!v;out[c.name]=v;}return JSON.stringify(canonical(out));}
try{
 for(const table of plan.imports){
  const source=fs.readFileSync(table.file);
  if(crypto.createHash('sha256').update(source).digest('hex')!==table.sha256)throw Error('Source changed after preparation: '+table.name);
  const expected=source.toString('utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const actual=db.prepare('SELECT * FROM "'+table.name+'" ORDER BY id').all();
  const byId=new Map(actual.map(r=>[r.id,r]));
  let mismatchedRows=0;
  for(const row of expected){const restored=byId.get(row.id);if(!restored||normalize(row,table.columns)!==normalize(restored,table.columns))mismatchedRows++;}
  results.push({table:table.name,expectedRows:expected.length,restoredRows:actual.length,mismatchedRows,passed:expected.length===actual.length&&mismatchedRows===0});
 }
 const collections=db.prepare('SELECT name,listRule,viewRule,createRule,updateRule,deleteRule FROM _collections').all().filter(c=>!c.name.startsWith('_'));
 const locked=collections.every(c=>['listRule','viewRule','createRule','updateRule','deleteRule'].every(k=>c[k]===null));
 const result={checkedAt:new Date().toISOString(),scope:'Isolated local PocketBase import; original MISO not contacted',passed:results.every(t=>t.passed)&&locked,allCollectionCrudRulesLocked:locked,collections:collections.map(c=>c.name),tables:results,applicationReady:false,notVerified:['MISO collection rules and indexes','application login and runtime hooks','external integrations','UI behavior parity']};
 fs.writeFileSync(path.join(root,'migration/local-db-verification.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;
}finally{db.close();}
