import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(process.argv[2]||path.join(path.dirname(fileURLToPath(import.meta.url)),'../..'));
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name==='.git'||e.name==='node_modules'||e.name==='migration'||e.name==='tools')continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(html|css|[cm]?js|tsx?)$/.test(p))files.push(p);}}
walk(root);const refs=[];
function test(file,ref,kind,base){
  if(!ref||/^(?:https?:|data:|blob:|#|mailto:|javascript:)/.test(ref)||/[{}<>+`]/.test(ref))return;
  ref=ref.split(/[?#]/)[0];if(!ref)return;
  const filePath=ref.startsWith('@/')?path.join(root,'src',ref.slice(2)):ref.startsWith('/src/')?path.join(root,ref.slice(1)):ref.startsWith('/')?path.join(root,'public',ref.slice(1)):path.resolve(base||path.dirname(file),ref);
  const exists=[filePath,...['.ts','.tsx','.js','.jsx','.json','/index.ts','/index.tsx','/index.js'].map(x=>filePath+x)].some(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
  refs.push({from:path.relative(root,file).replaceAll('\\','/'),ref,kind,resolved:path.relative(root,filePath).replaceAll('\\','/'),exists});
}
for(const file of files){const s=fs.readFileSync(file,'utf8');
  for(const m of s.matchAll(/\b(?:from\s*|import\s*)["']([^"'\n]+)["']/g))if(m[1].startsWith('.')||m[1].startsWith('@/'))test(file,m[1],'import');
  for(const m of s.matchAll(/require\(\s*__hooks\s*\+\s*["']([^"']+)["']/g))test(file,m[1].replace(/^\//,''),'pocketbase-hook',path.join(root,'api'));
  if(file.endsWith('.html'))for(const m of s.matchAll(/<(?:script|link|img)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)){
    const ref=m[1].replace('%BASE_URL%','');if(!/\.(?:js|css|png|jpg|jpeg|webp|svg|ico|woff2?|json|webmanifest|tsx?)(?:[?#]|$)/.test(ref))continue;
    test(file,ref,'html-resource',file.endsWith(path.sep+'index.html')?path.join(root,'public'):undefined);
  }
  if(file.endsWith('.css'))for(const m of s.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g))test(file,m[1],'css-resource');
}
const unique=[...new Map(refs.map(r=>[r.from+'|'+r.ref,r])).values()];
const result={filesScanned:files.length,references:unique.length,resolved:unique.filter(r=>r.exists).length,unresolved:unique.filter(r=>!r.exists)};
fs.writeFileSync(path.join(root,'migration/audit-references.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
