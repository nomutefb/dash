// Browser-compatible, memory-only pseudonymization. Never persist the lookup maps.
export function parseCsv(text) {
  const rows=[]; let row=[],value='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) { const c=text[i];
    if(quoted) { if(c==='"'&&text[i+1]==='"'){value+='"';i++;}else if(c==='"')quoted=false;else value+=c; }
    else if(c==='"'&&value==='')quoted=true;
    else if(c===','){row.push(value);value='';}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);rows.push(row);row=[];value='';}
    else value+=c;
  }
  if(quoted)throw Error('Unclosed CSV quote');
  if(value||row.length){row.push(value);rows.push(row);}
  return rows;
}
export function writeCsv(rows) {
  return rows.map(row=>row.map(v=>{v=String(v??'');return /[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}).join(',')).join('\n')+'\n';
}
export function createSanitizer() {
  const maps=new Map(), originals=new Map(), stats={fields:0,freeText:0};
  const protectedStrings=new Set(['미상','기타','없음','정상','개인','단체','관리자','관리','회원','담당자','미정','완료','대기','취소','예정','공연','전시','교육','대관','예울마루','GS칼텍스 예울마루','이미지','상관 없음','불분명','이슬비','유보석','대학로']);
  const publicValueKey=/^(정본명|짧은이름|공연명|프로그램명|사업명|사업명칭|장르|분야|표시_분야|판매구분|구분|상태|장소|권한)$/;
  const missingLabels=new Set(['미상','미정','상관 없음','없음','불분명']);
  function mapped(kind,value,make) {
    const key=String(value); let map=maps.get(kind); if(!map)maps.set(kind,map=new Map());
    if(!map.has(key)) {const n=map.size+1;const fake=make(n);map.set(key,fake);if(key.length>=3)originals.set(key,String(fake));}
    return map.get(key);
  }
  function phone(v){const d=String(v).replace(/\D/g,'');if(!d)return v;const z=mapped('phone',d,n=>'000'+String(n).padStart(8,'0'));originals.set(String(v),z);return String(v).includes('-')?z.slice(0,3)+'-'+z.slice(3,7)+'-'+z.slice(7):z;}
  function personId(v){if(/^\d{9,12}$/.test(String(v)))return phone(v);return mapped('personId',v,n=>'person'+String(n).padStart(7,'0'));}
  function name(v){return mapped('name',v,n=>['Avery','Morgan','Jordan','Riley','Taylor','Casey','Cameron','Rowan'][n%8]+' '+['Brooks','Parker','Reed','Hayes','Bennett','Ellis','Foster','Lane'][Math.floor(n/8)%8]+' '+String(n).padStart(5,'0'));}
  function staff(v){return mapped('staff',v,n=>String(800+n).padStart(3,'0'));}
  function text(v) {
    if(typeof v!=='string')return v;
    return v.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,m=>/@example\.invalid$/i.test(m)?m:mapped('email',m.toLowerCase(),n=>'contact'+String(n).padStart(7,'0')+'@example.invalid'))
      .replace(/(?<!\d)(?:\+82[- .]?)?0(?:1[016789]|2|[3-6][1-5]|70)[- .]?\d{3,4}[- .]?\d{4}(?!\d)/g,m=>phone(m));
  }
  function category(key,ctx,obj) {
    const k=key.replace(/[\s_()（）-]/g,'').toLowerCase();
    if(/^(knownaddress|unknownaddress|snapshot|地址count)$/.test(k))return '';
    if(/(?:상태|여부|중복|count|dup|status|flag|visibility|정제판|근거|agegroup)/i.test(k)&&!/^token/.test(k))return '';
    if(/^(password|passwd|secret|tokenkey|accesstoken|refreshtoken|sessiontoken|apikey|authorization|cookie|digest|organizationdigest|pin|passwordhash|credentials|publickey|privatekey|keyid)$/.test(k))return 'secret';
    if(/(?:phone|mobile|telephone|^tel$|^전화$|전화번호|휴대폰|휴대전화|핸드폰|연락처|내선번호)/.test(k))return 'phone';
    if(/(?:email|이메일|메일주소)/.test(k))return 'email';
    if(/(?:birth|생년월일|생일|주민등록|주민번호)/.test(k))return 'birth';
    if(/(?:postcode|zipcode|^zip$|우편번호)/.test(k))return 'zip';
    if(/^(주소1|addr1|sido|시도)$/.test(k))return 'region';
    if(/^(주소2|addr2|city|시군구)$/.test(k))return 'city';
    if(/^(주소3|addr3|dong|읍면동)$/.test(k))return 'district';
    if(/(?:address|^addr|주소)/.test(k))return 'address';
    if(/^(계정no|담당자|회계담당자|게시담당자|작성자|수정자|사용자|신청자|등록자|registermemberno)$/.test(k))return /^(\d{1,5})$/.test(String(obj?.[key]??''))?'staff':'name';
    if(/^(주문자명|예매자명|예약자명|고객명|회원명|수령인|성명|이름|담당자명|customername|membername|buyername|username)$/.test(k))return 'name';
    if(k==='name'&&/(?:members|회원|contacts|users|managers)/i.test(ctx)&&!/(?:program|product|show)/i.test(ctx))return 'name';
    if(/^(회원키|회원id|고객id|회원번호|아이디|userid|memberid|memberno|customerid|loginid|registermemberno)$/.test(k))return 'personId';
    if(k==='id'&&/(?:members|회원)/i.test(ctx)&&!obj?.sheet)return 'personId';
    if(k==='k'&&/show_bookings/.test(ctx))return 'personId';
    if(/^(대표티켓번호|티켓번호|판매순번|주문번호|예매번호|예약번호|waitingreservationno|orderid|bookingid|reservationno)$/.test(k))return 'ticket';
    if(/^(단체명|할당처명|companyname|groupname)$/.test(k))return 'group';
    if(/^(allotmentcompanycode|할당처코드)$/.test(k))return 'groupId';
    if(/^(결과첨부url|첨부url|avatar|사진|프로필사진)$/.test(k))return 'privateUrl';
    if(/^(문의내용|질문|답변|메시지|불편사항|historyseatdescription|ip|ipaddress|useragent)$/.test(k))return 'freeText';
    return '';
  }
  function field(key,value,ctx,obj) {
    if(value===null||value===undefined||value==='')return value;
    const cat=category(key,ctx,obj);if(!cat)return undefined;stats.fields++;
    if(['name','staff','region','city','district'].includes(cat)&&missingLabels.has(String(value)))return value;
    let out;
    if(cat==='secret')out='';
    if(cat==='phone')out=phone(value);
    if(cat==='personId')out=personId(value);
    if(cat==='name')out=name(value);
    if(cat==='staff')out=staff(value);
    if(cat==='email')out=mapped('email',String(value).toLowerCase(),n=>'contact'+String(n).padStart(7,'0')+'@example.invalid');
    if(cat==='ticket')out=mapped('ticket',value,n=>'9'+String(n).padStart(12,'0'));
    if(cat==='groupId')out=mapped('groupId',value,n=>String(90000+n));
    if(cat==='group')out=mapped('group',value,n=>'Example Group '+n);
    if(cat==='region'||cat==='city'||cat==='district')out=mapped(cat,value,n=>({region:'Example State ',city:'Example City ',district:'Example District '}[cat])+String(n).padStart(3,'0'));
    if(cat==='zip')out=mapped('zip',value,n=>String(n).padStart(5,'0'));
    if(cat==='address')out=mapped('address',value,n=>(100+n)+' Example Avenue, Unit '+((n%900)+1));
    if(cat==='birth')out=mapped('birth',value,n=>{const m=String(value).match(/^(19\d{2}|20\d{2})/);if(!m)return '0000-00-00';const y=Number(m[1]);let fake=String(y)+'-'+String((n%12)+1).padStart(2,'0')+'-'+String((n%27)+1).padStart(2,'0');if(fake===value)fake=fake.slice(0,8)+String((n%27)+2).padStart(2,'0');return fake;});
    if(cat==='privateUrl')out='https://example.invalid/synthetic-attachment';
    if(cat==='freeText'){out='Synthetic record';stats.freeText++;}
    return typeof value==='number'&&/^\d+$/.test(out)?Number(out):out;
  }
  function structured(v,ctx='',key='',parent) {
    if(v===null||v===undefined)return v;
    if(typeof v==='string'&&/^[\s]*[\[{]/.test(v)){try{return JSON.stringify(structured(JSON.parse(v),ctx+'.'+key));}catch{}}
    if(Array.isArray(v))return v.map(x=>structured(x,ctx+'[]'));
    if(typeof v==='object'){
      for(const k of Object.keys(v)){protectedStrings.add(k);if(publicValueKey.test(k)&&typeof v[k]==='string')protectedStrings.add(v[k]);}
      if(Array.isArray(v.headers)&&v.headers.every(h=>typeof h==='string')&&Array.isArray(v.rows)&&v.rows.some(Array.isArray)){
        v.headers.forEach(h=>protectedStrings.add(h));
        v.headers.forEach((h,i)=>{if(publicValueKey.test(h))for(const row of v.rows)if(Array.isArray(row)&&typeof row[i]==='string')protectedStrings.add(row[i]);});
        const out={...v};out.rows=v.rows.map(r=>Array.isArray(r)?v.headers.map((h,i)=>field(h,r[i],ctx,Object.fromEntries(v.headers.map((a,j)=>[a,r[j]])))??structured(r[i],ctx,h)):structured(r,ctx));return out;
      }
      if(typeof v.열==='string'&&('전'in v||'후'in v)){const out={...v};for(const k of ['전','후'])if(k in v)out[k]=field(v.열,v[k],ctx,v)??structured(v[k],ctx,k,v);return out;}
      const out={};const next=ctx+(v.sheet?'.'+v.sheet:'');
      for(const [k,x]of Object.entries(v)){
        let newKey=k;
        if(/^0\d{9,10}$/.test(k))newKey=phone(k);
        if(/(?:sidoCounts|cityCounts|geoCounts|regionCounts)/.test(ctx))newKey=k.split('|').map((z,i)=>mapped(i===0?'region':i===1?'city':'district',z,n=>(i===0?'Example State ':i===1?'Example City ':'Example District ')+String(n).padStart(3,'0'))).join('|');
        if(category(k,next,v)==='secret'){out[newKey]=typeof x==='object'?null:'';continue;}
        out[newKey]=(typeof x==='object'&&x!==null)?structured(x,next+'.'+k):field(k,x,next,v)??structured(x,next,k,v);
      }
      return out;
    }
    return text(v);
  }
  function csv(content,ctx) {
    const rows=parseCsv(content),headers=rows.shift()||[];
    const out=rows.map(r=>{const o=Object.fromEntries(headers.map((h,i)=>[h,r[i]??'']));const clean=structured(o,ctx);return headers.map(h=>clean[h]);});
    return {content:writeCsv([headers,...out]),rows:out.length,headers};
  }
  function replaceKnown(input,code=false){
    // Exact literals preserve source syntax; free text replaces long identifiers too.
    const pattern=/(["'])([^"'\r\n\\]{3,300})\1/g;
    let out=input.replace(pattern,(whole,q,v)=>{const fake=protectedStrings.has(v)||/^\d+$/.test(v)||(code&&/^[A-Za-z_-]+$/.test(v))?undefined:originals.get(v);return fake===undefined?whole:q+fake+q;});
    if(!code)out=out.replace(/[\p{L}\p{N}_@.+-]{3,}/gu,v=>/^\d+$/.test(v)?v:(originals.get(v)??v));
    return text(out);
  }
  function summary(){return {fields:stats.fields,freeText:stats.freeText,namespaces:Object.fromEntries([...maps].map(([k,v])=>[k,v.size]))};}
  return {structured,csv,field,category,replaceKnown,text,phone,personId,summary,originals,maps};
}
