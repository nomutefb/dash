// Called only against a previously authorized, read-only capture in memory.
// This module does not fetch, save, publish, or mutate the source application.
export async function prepareInMemory(s,helpers) {
  const {createSanitizer,parseCsv,transformEmbedded,scrubCredentials}=helpers;
  s.sanitizer=createSanitizer();s.parseCsv=parseCsv;s.safeFiles={};s.safeTables={};
  s.exportReport={files:[],tables:{},excluded:[],errors:[]};s.prepareDone=0;s.prepareComplete=false;
  const delay=()=>new Promise(r=>setTimeout(r,0));
  s.recordIds=new Map();for(const rows of Object.values(s.tables))for(const r of rows)if(!s.recordIds.has(r.id))s.recordIds.set(r.id,'r'+String(s.recordIds.size+1).padStart(14,'0'));
  function fixRecords(v){
    if(typeof v==='string'){if(s.recordIds.has(v))return s.recordIds.get(v);if(/^[\s]*[\[{]/.test(v)){try{return JSON.stringify(fixRecords(JSON.parse(v)));}catch{}}return v;}
    if(Array.isArray(v))return v.map(fixRecords);
    if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,fixRecords(x)]));return v;
  }
  const secrets=[];
  for(const p of ['api/ym-auth-initial-private.js','api/ym-ticketlink-private.js'])for(const m of s.files[p].content.matchAll(/['"]([^'"\r\n]{8,})['"]/g))secrets.push(m[1]);
  s.knownSecrets=secrets;
  const structured=Object.keys(s.files).filter(p=>/\.(csv|json)$/.test(p));
  for(const p of structured){try{
    const f=s.files[p];let clean;
    if(p.endsWith('.csv')){const d=s.sanitizer.csv(f.content,p);clean=d.content;s.exportReport.files.push({path:p,rows:d.rows,format:'csv'});}
    else {clean=JSON.stringify(s.sanitizer.structured(JSON.parse(f.content),p))+'\n';s.exportReport.files.push({path:p,format:'json'});}
    s.safeFiles[p]={...f,content:clean};
  }catch(e){s.exportReport.errors.push({path:p,error:String(e)});}s.prepareDone++;await delay();}
  for(const [t,rows]of Object.entries(s.tables)){
    const counts={};s.safeTables[t]=rows.map(r=>{
      const data=typeof r.data==='string'?JSON.parse(r.data):r.data;
      const input={...r,...('data'in r?{data}:{})};delete input.collectionId;delete input.collectionName;
      const out=fixRecords(s.sanitizer.structured(input,t));if('rowIndex'in out)out.rowIndex=Number(out.rowIndex);
      counts[r.sheet||t]=(counts[r.sheet||t]||0)+1;return out;
    });s.exportReport.tables[t]={rows:rows.length,sheets:counts};await delay();
  }
  for(const [p,f]of Object.entries(s.files)){
    if(s.safeFiles[p])continue;
    if(p.endsWith('-private.js')||p.endsWith('.xlsx')||p==='--viewport')continue;
    try{
      if(f.kind==='text'){const d=transformEmbedded(f.content,s.sanitizer,p);s.safeFiles[p]={...f,content:d.content};s.exportReport.files.push({path:p,format:'source',embeddedBlocks:d.blocks});}
      else {s.safeFiles[p]=f;s.exportReport.files.push({path:p,format:'asset'});}
    }catch(e){s.exportReport.errors.push({path:p,error:String(e)});}s.prepareDone++;await delay();
  }
  function cleanStrings(v){if(typeof v==='string')return scrubCredentials(s.sanitizer.replaceKnown(v,true),secrets);if(Array.isArray(v))return v.map(cleanStrings);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,cleanStrings(x)]));return v;}
  for(const [p,f]of Object.entries(s.safeFiles)){
    if(f.kind!=='text')continue;
    if(p.endsWith('.json'))f.content=JSON.stringify(cleanStrings(JSON.parse(f.content)))+'\n';
    else {
      f.content=scrubCredentials(s.sanitizer.replaceKnown(f.content,true),secrets);
      f.content=f.content.replace(/(["'])([a-z0-9]{15})\1/g,(all,q,id)=>s.recordIds.has(id)?q+s.recordIds.get(id)+q:all);
      if(p==='api/ym-auth-lib.js'){
        f.content=f.content.replace(/(var initial=)(['"])[^'"]+\2/,"$1'REQUIRES_LOCAL_CONFIGURATION'");
        f.content=f.content.replace(/(\['계정NO'\]\)===)(['"])(\d+)\2/g,(all,prefix,q,value)=>prefix+q+s.sanitizer.field('계정NO',value,'managers',{'계정NO':value})+q);
      }
    }
    await delay();
  }
  const buckets=Array.from({length:10},()=>[]);
  for(let i=0;i<10;i++){const d=JSON.parse(s.safeFiles['api/data/booking_agg.s'+i+'.json'].content);for(const r of d.rows){const n=Number(String(r['회원키']).slice(-1));if(!Number.isInteger(n))throw Error('Invalid shard key');buckets[n].push(r);}}
  for(let i=0;i<10;i++)s.safeFiles['api/data/booking_agg.s'+i+'.json'].content=JSON.stringify({rows:buckets[i]})+'\n';
  s.exportReport.shards={rebucketed:true,rows:buckets.reduce((n,b)=>n+b.length,0),counts:buckets.map(b=>b.length)};
  s.exportReport.excluded.push({path:'.env',reason:'Live environment secrets'},{path:'api/ym-auth-initial-private.js',reason:'Real credential digests'},{path:'api/ym-ticketlink-private.js',reason:'Real encryption key'},{path:'--viewport',reason:'Diagnostic screenshot'},{path:'.coder/**,.opencode/**,.rollback/**,backups/**',reason:'Runtime state and superseded backups'});
  s.prepareComplete=true;
}
