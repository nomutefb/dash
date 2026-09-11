// Compare source structure without storing original personal values.
import crypto from 'node:crypto';
export const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const ignored = new Set(['start','end','loc','extra','leadingComments','trailingComments','innerComments','comments','tokens','errors']);
export function compareAst(source, local, parse) {
  const options={sourceType:'unambiguous',plugins:['typescript','jsx'],errorRecovery:false};
  const a=parse(source,options), b=parse(local,options);
  const counts={}, samples=[];
  function visit(x,y,trail='',parentType='') {
    if(x===y)return;
    if(x===null||y===null||typeof x!==typeof y) {add('structure',trail,parentType,y);return;}
    if(typeof x!=='object') {add(parentType==='StringLiteral'?'string':parentType==='NumericLiteral'?'number':parentType==='Identifier'?'identifier':'other',trail,parentType,y);return;}
    if(Array.isArray(x)){if(!Array.isArray(y)||x.length!==y.length){add('array-length',trail,parentType,Array.isArray(y)?y.length:null);return;}for(let i=0;i<x.length;i++)visit(x[i],y[i],trail+'['+i+']',parentType);return;}
    const keys=new Set([...Object.keys(x),...Object.keys(y)]);
    for(const k of keys)if(!ignored.has(k))visit(x[k],y[k],trail+'.'+k,x.type||parentType);
  }
  function add(kind,trail,type,localValue){counts[kind]=(counts[kind]||0)+1;if(samples.length<35)samples.push({kind,trail,type,local:typeof localValue==='string'?localValue.slice(0,120):localValue});}
  visit(a,b);
  return {counts,samples,structurePreserved:!Object.keys(counts).some(k=>!['string','number'].includes(k))};
}
export function htmlParts(text){
  const scripts=[],styles=[];
  const shell=text.replace(/<!--[\s\S]*?-->|<script\b([^>]*)>([\s\S]*?)<\/script\s*>|<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi,(all,attributes,script,style)=>{
    if(all.startsWith('<!--'))return '';
    if(script!==undefined){scripts.push({attributes,text:script});return '<script></script>';}
    styles.push(style);return '<style></style>';
  });
  return {scripts,styles,shell};
}
export function compareHtml(source,local,parse){
  const a=htmlParts(source),b=htmlParts(local);
  return {
    styleCount:{source:a.styles.length,local:b.styles.length},
    stylesIdentical:JSON.stringify(a.styles)===JSON.stringify(b.styles),
    shellIdentical:a.shell===b.shell,
    scriptCount:{source:a.scripts.length,local:b.scripts.length},
    scripts:a.scripts.map((s,i)=>({index:i,attributesIdentical:s.attributes===b.scripts[i]?.attributes,identical:s.text===b.scripts[i]?.text,...(s.text!==b.scripts[i]?.text&&s.text.trim()&&!/application\/(?:json|ld\+json)/.test(s.attributes)?compareAst(s.text,b.scripts[i]?.text||'',parse):{})}))
  };
}
