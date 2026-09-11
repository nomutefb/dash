export function transformEmbedded(source,sanitizer,path) {
  const edits=[];
  const re=/(?:=\s*|export\s+default\s+)(\{\s*"|\[\s*(?:\{|\[|"|\d))/g;
  let m;
  while((m=re.exec(source))){
    // This binding is a field-membership map in ym-changelog-lib.js, not a
    // manager record. Its "수정자": 1 flag must never become a staff alias.
    const declaration=source.slice(0,m.index).match(/\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*$/);
    if(declaration?.[1]==='SKIP_COLS')continue;
    const start=m.index+m[0].length-m[1].length;let depth=0,q='',escaped=false,end=-1;
    for(let i=start;i<source.length;i++){
      const c=source[i];if(q){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===q)q='';continue;}
      if(c==='"'||c==="'"||c==='`'){q=c;continue;}
      if(c==='{'||c==='[')depth++;else if(c==='}'||c===']'){depth--;if(depth===0){end=i+1;break;}}
    }
    if(end<0)continue;
    try{const value=JSON.parse(source.slice(start,end));edits.push([start,end,JSON.stringify(sanitizer.structured(value,path))]);re.lastIndex=end;}catch{}
  }
  const jsonScript=/<script\b[^>]*\btype\s*=\s*["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
  while((m=jsonScript.exec(source))){try{const start=m.index+m[0].indexOf('>')+1;const end=start+m[1].length;edits.push([start,end,JSON.stringify(sanitizer.structured(JSON.parse(m[1]),path+'.embedded'))]);}catch{}}
  edits.sort((a,b)=>b[0]-a[0]);let boundary=source.length;
  for(const [start,end,content]of edits){if(end>boundary)continue;source=source.slice(0,start)+content+source.slice(end);boundary=start;}
  return {content:source,blocks:edits.length};
}
export function scrubCredentials(source,knownSecrets=[]) {
  let out=source;
  for(const secret of knownSecrets)if(secret.length>=8)out=out.split(secret).join('REQUIRES_LOCAL_CONFIGURATION');
  out=out.replace(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b/g,'REQUIRES_LOCAL_CONFIGURATION');
  const key='(?:password|passwd|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|pin|MASTER_PIN|SUPER_PIN|ADMIN_PIN)';
  const credentialAssignment=new RegExp('(^|[{,;\\n])(\\s*(?:(?:var|let|const)\\s+)?(?:"'+key+'"|\''+key+'\'|'+key+')\\s*[:=]\\s*)(["\'])([^"\'\\r\\n]+)\\3','gim');
  out=out.replace(credentialAssignment,(all,start,prefix,q,value)=>{
    if(/^(?:undefined|null|password|PIN|pin|api_key|apikey|placeholder|\*+|\[.*\]|REQUIRES_LOCAL_CONFIGURATION)$/i.test(value))return all;
    return start+prefix+q+'REQUIRES_LOCAL_CONFIGURATION'+q;
  });
  return out;
}
