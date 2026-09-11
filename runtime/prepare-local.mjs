// Prepare an isolated PocketBase import for verification. Does not connect to MISO.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const state=path.join(root,'runtime/.local');
const schema=JSON.parse(fs.readFileSync(path.join(root,'data/database/schema.json'),'utf8'));
const exported=JSON.parse(fs.readFileSync(path.join(root,'migration/export-report.json'),'utf8'));
const migrationDir=path.join(state,'import-migrations');
fs.mkdirSync(migrationDir,{recursive:true});
fs.mkdirSync(path.join(state,'empty-hooks'),{recursive:true});
fs.mkdirSync(path.join(state,'empty-public'),{recursive:true});
const definitions=[];
const authFields=new Set(['id','password','tokenKey','email','emailVisibility','verified']);
for(const [name,def] of Object.entries(schema)){
  const isAuth=['users','ym_auth_credentials_dev'].includes(name);
  const fields=def.columns.filter(c=>c.name!=='id'&&!(isAuth&&authFields.has(c.name))).map(c=>{
    const f={name:c.name,type:c.data_type,required:!c.is_nullable};
    if(f.type==='json')f.maxSize=100_000_000;
    if(f.type==='autodate'){f.onCreate=true;f.onUpdate=c.name==='updated';}
    if(f.type==='file')f.maxSize=10_000_000;
    return f;
  });
  const d={name,type:isAuth?'auth':'base',fields,listRule:null,viewRule:null,createRule:null,updateRule:null,deleteRule:null};
  if(isAuth){d.authRule=null;d.manageRule=null;d.passwordAuth={enabled:false,identityFields:['email']};d.oauth2={enabled:false};d.otp={enabled:false};d.mfa={enabled:false};}
  // These are verification indexes, not a claim to have recovered MISO's rules/indexes.
  if(name.startsWith('ymdata'))d.indexes=[`CREATE INDEX "idx_${name}_sheet_row" ON "${name}" (sheet,rowIndex)`];
  if(name.startsWith('ymmeta'))d.indexes=[`CREATE INDEX "idx_${name}_sheet" ON "${name}" (sheet)`];
  definitions.push(d);
}
const imports=[];
for(const [name,expected] of Object.entries(exported.tables)){
  const file=path.join(root,'data/database',name+'.jsonl');
  const content=fs.readFileSync(file);
  const lines=content.toString('utf8').split(/\r?\n/).filter(Boolean);
  if(lines.length!==expected.rows)throw Error('Export row count mismatch: '+name);
  for(const line of lines){const row=JSON.parse(line);if(!/^[a-z0-9]{15}$/.test(row.id))throw Error('Invalid PocketBase id in '+name);}
  imports.push({name,file:file.replaceAll('\\','/'),rows:lines.length,sha256:crypto.createHash('sha256').update(content).digest('hex'),columns:schema[name].columns.map(c=>({name:c.name,type:c.data_type}))});
}
const migration=`// Isolated verification database only. The transaction rolls back on any error.
migrate(function(app){
 var definitions=${JSON.stringify(definitions)};
 app.importCollections(definitions,false);
 var imports=${JSON.stringify(imports)};
 imports.forEach(function(t){
  var content=toString($os.readFile(t.file));
  if($security.sha256(content)!==t.sha256)throw Error('SOURCE_CHANGED: '+t.name);
  var rows=content.split(/\\r?\\n/).filter(function(s){return s.length>0;});
  if(rows.length!==t.rows)throw Error('ROW_COUNT_CHANGED: '+t.name);
  var cols=t.columns.map(function(c){return '"'+c.name+'"';}).join(',');
  var params=t.columns.map(function(c,i){return '{:p'+i+'}';}).join(',');
  var sql='INSERT INTO "'+t.name+'" ('+cols+') VALUES ('+params+')';
  rows.forEach(function(line){
   var row=JSON.parse(line),bindings={};
   t.columns.forEach(function(c,i){var v=row[c.name];if(v===undefined)v=null;if(c.type==='json'&&v!==null&&typeof v!=='string')v=JSON.stringify(v);bindings['p'+i]=v;});
   app.db().newQuery(sql).bind(bindings).execute();
  });
  console.log('IMPORTED '+t.name+' '+rows.length);
 });
});
`;
const migrationFile=path.join(migrationDir,'1789084800_isolated_export.js');
if(fs.existsSync(migrationFile)&&fs.readFileSync(migrationFile,'utf8')!==migration&&fs.existsSync(path.join(state,'pb_data/data.db'))){
  const existingDb=new DatabaseSync(path.join(state,'pb_data/data.db'),{readOnly:true});
  try{if(existingDb.prepare('SELECT file FROM _migrations WHERE file=?').get(path.basename(migrationFile)))throw Error('Prepared source changed; existing verification DB is preserved. Use a new verified snapshot directory.');}finally{existingDb.close();}
}
fs.writeFileSync(migrationFile,migration);
fs.writeFileSync(path.join(state,'import-plan.json'),JSON.stringify({preparedAt:new Date().toISOString(),scope:'Isolated import verification; no MISO API hooks, login, cron or connectors enabled',imports},null,2)+'\n');
console.log(JSON.stringify({prepared:true,collections:definitions.length,tablesWithExports:imports.length,rows:imports.reduce((n,t)=>n+t.rows,0),migrationFile,sourceUnchanged:true,applicationReady:false},null,2));
