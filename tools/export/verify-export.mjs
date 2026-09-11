import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Script } from 'node:vm';
import { htmlParts } from './audit-fidelity.mjs';
import { parseCsv, createSanitizer } from './sanitize.mjs';
import { scrubCredentials } from './transform-source.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const issues=[];const report=JSON.parse(fs.readFileSync(path.join(root,'migration/export-report.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'migration/file-manifest.json'),'utf8'));
const localAdjustments=new Set(['.gitignore','api/_runtime_env.js']);
for(const f of manifest){
  if(localAdjustments.has(f.path))continue;
  const bytes=fs.readFileSync(path.join(root,f.path));
  if(bytes.length!==f.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==f.sha256)issues.push({path:f.path,check:'transfer-hash'});
}
let dbRows=0;
for(const [table,expected]of Object.entries(report.tables)){
  const lines=fs.readFileSync(path.join(root,'data/database',table+'.jsonl'),'utf8').split('\n').filter(Boolean);
  if(lines.length!==expected.rows)issues.push({path:table,check:'row-count'});
  const ids=new Set();const sheetCounts={};
  for(const line of lines){const row=JSON.parse(line);ids.add(row.id);sheetCounts[row.sheet||table]=(sheetCounts[row.sheet||table]||0)+1;}
  if(ids.size!==lines.length)issues.push({path:table,check:'duplicate-id'});
  for(const [sheet,count]of Object.entries(expected.sheets))if(sheetCounts[sheet]!==count)issues.push({path:table+'.'+sheet,check:'sheet-count'});
  dbRows+=lines.length;
}
function records(p){const rows=parseCsv(fs.readFileSync(path.join(root,p),'utf8'));const headers=rows.shift();return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])));}
const members=records('api/data/ops_회원.csv'),bookings=records('api/data/ops_예매.csv');
const digits=v=>String(v||'').replace(/\D/g,'');
const memberKeys=new Set(members.map(r=>digits(r['휴대폰정규화'])).filter(Boolean));
const matched=bookings.filter(r=>digits(r['회원키'])&&memberKeys.has(digits(r['회원키']))).length;
if(matched!==report.validation.memberBookingMatches.source)issues.push({path:'member-booking',check:'join-count'});
let shardRows=0;
for(let i=0;i<10;i++)for(const r of JSON.parse(fs.readFileSync(path.join(root,'api/data/booking_agg.s'+i+'.json'),'utf8')).rows){
  shardRows++;if(Number(String(r['회원키']).slice(-1))!==i)issues.push({path:'shard-'+i,check:'bucket'});
}
const sanitizer=createSanitizer();
const example={회원키:'01012345678',휴대폰번호:'010-1234-5678',이메일:'sample@source.test',이름:'테스트회원',금액:123400,프로그램ID:'260910_01',짧은이름:'공연',knownAddress:42};
const synthetic=sanitizer.structured(example,'members');
if(digits(synthetic.회원키)!==digits(synthetic.휴대폰번호)||synthetic.금액!==example.금액||synthetic.프로그램ID!==example.프로그램ID||synthetic.짧은이름!==example.짧은이름||synthetic.knownAddress!==42)issues.push({path:'sanitizer',check:'identity-and-business-values'});
if(sanitizer.text(synthetic.이메일)!==synthetic.이메일)issues.push({path:'sanitizer',check:'email-idempotency'});
sanitizer.structured({담당자:'담당자'},'managers');
if(sanitizer.replaceKnown("d['담당자']",true)!=="d['담당자']")issues.push({path:'sanitizer',check:'source-field-name'});
const pinExpression="return 'YM-PIN:'+id+':'+pin;";
if(scrubCredentials(pinExpression)!==pinExpression)issues.push({path:'sanitizer',check:'preserve-auth-expression'});
const pinCall="if(!rate(tx,'pin:'+r.id,3))return false;";
if(scrubCredentials(pinCall)!==pinCall)issues.push({path:'sanitizer',check:'preserve-auth-call'});
if(scrubCredentials("var apiKey='example-secret-value';").includes('example-secret-value'))issues.push({path:'sanitizer',check:'remove-secret-assignment'});
const publicTerms=createSanitizer();
const sameName=publicTerms.structured({이름:'이미지'},'members');
if(sameName.이름==='이미지'||publicTerms.replaceKnown("format === '이미지'",true)!=="format === '이미지'")issues.push({path:'sanitizer',check:'person-versus-ui-label'});
publicTerms.structured({이름:'김영욱'},'members');
publicTerms.structured({짧은이름:'김영욱'},'programs');
if(publicTerms.replaceKnown("show = '김영욱'",true)!=="show = '김영욱'")issues.push({path:'sanitizer',check:'preserve-public-performance-name'});
const labels=publicTerms.structured({담당자:'상관 없음',주소1:'불분명'},'records');
if(labels.담당자!=='상관 없음'||labels.주소1!=='불분명')issues.push({path:'sanitizer',check:'preserve-missing-labels'});
if(JSON.stringify(parseCsv('a,b\n"x,y","z""q"\n'))!==JSON.stringify([['a','b'],['x,y','z"q']]))issues.push({path:'csv-parser',check:'quoted-fields'});
const sourceFiles=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name==='.git'||e.name==='node_modules')continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(?:[cm]?js)$/.test(e.name))sourceFiles.push(p);}}walk(root);
for(const p of sourceFiles){const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8',maxBuffer:1024*1024});if(r.status!==0)issues.push({path:path.relative(root,p).replaceAll('\\','/'),check:'javascript-syntax'});}
let inlineScriptsChecked=0;
for(const [index,s]of htmlParts(fs.readFileSync(path.join(root,'public/standalone.html'),'utf8')).scripts.entries()){
  if(!s.text.trim()||/application\/(?:json|ld\+json)/.test(s.attributes))continue;
  try{new Script(s.text,{filename:'standalone-inline-'+index});inlineScriptsChecked++;}catch{issues.push({path:'public/standalone.html',check:'inline-script-syntax',index});}
}
const result={passed:issues.length===0,filesCompared:manifest.length-localAdjustments.size,databaseRows:dbRows,memberRows:members.length,bookingRows:bookings.length,memberBookingMatches:matched,shardRows,javascriptFilesChecked:sourceFiles.length,inlineScriptsChecked,sourceComparisonPassed:report.validation.passed,issues};
fs.writeFileSync(path.join(root,'migration/local-verification.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;
