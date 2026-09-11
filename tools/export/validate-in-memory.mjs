export function validateCapture(s) {
  const issues=[];let protectedValues=0,csvRows=0;
  const protectedKey=/금액|매수|매출|사업비|수입|수익|예산|지출|좌석|인원|관객|점유율|판매율|수수료|총구매|^(공연ID|프로그램ID|사업코드|사업ID|상품명|공연명|정본명|이용일시|판매일|총매수|총금액|knownAddress|unknownAddress)$/;
  function compare(a,b,path,key='') {
    if(typeof a==='string'&&/^[\s]*[\[{]/.test(a)){try{return compare(JSON.parse(a),typeof b==='string'?JSON.parse(b):b,path,key);}catch{}}
    if(a===null||typeof a!=='object'){
      if(protectedKey.test(key)){protectedValues++;if(a!==b)issues.push({path,check:'protected-value-changed'});}return;
    }
    if(Array.isArray(a)){if(!Array.isArray(b)||a.length!==b.length){issues.push({path,check:'array-length'});return;}a.forEach((x,i)=>compare(x,b[i],path+'[]',key));return;}
    if(/^(sidoCounts|cityCounts|geoCounts|regionCounts)$/.test(key)){
      const before=Object.values(a).sort((x,y)=>x-y),after=Object.values(b||{}).sort((x,y)=>x-y);protectedValues+=before.length;
      if(JSON.stringify(before)!==JSON.stringify(after))issues.push({path,check:'geographic-group-counts'});return;
    }
    for(const [k,v]of Object.entries(a))compare(v,b?.[k],path+'.'+k,k);
  }
  for(const [t,rows]of Object.entries(s.tables)){
    const clean=s.safeTables[t];if(rows.length!==clean.length)issues.push({path:t,check:'table-count'});
    if(new Set(clean.map(r=>r.id)).size!==clean.length)issues.push({path:t,check:'duplicate-id'});
    rows.forEach((r,i)=>compare(r,clean[i],t+'.'+(r.sheet||'')));
  }
  for(const [p,f]of Object.entries(s.files))if(p.endsWith('.csv')&&s.safeFiles[p]){
    const raw=s.parseCsv(f.content),clean=s.parseCsv(s.safeFiles[p].content);csvRows+=raw.length-1;
    if(raw.length!==clean.length)issues.push({path:p,check:'csv-count'});
    for(let i=1;i<raw.length;i++)for(let j=0;j<raw[0].length;j++)if(protectedKey.test(raw[0][j])){
      protectedValues++;if(raw[i][j]!==clean[i]?.[j])issues.push({path:p+'.'+raw[0][j],check:'csv-protected-value'});
    }
  }
  function csvKeys(file,clean,key){const rows=s.parseCsv((clean?s.safeFiles:s.files)[file].content),col=rows[0].indexOf(key);if(col<0)throw Error('Missing join column: '+key);return rows.slice(1).map(r=>String(r[col]).replace(/\D/g,''));}
  const sourceMembers=csvKeys('api/data/ops_회원.csv',false,'휴대폰정규화'),cleanMembers=csvKeys('api/data/ops_회원.csv',true,'휴대폰정규화');
  const sourceBookings=csvKeys('api/data/ops_예매.csv',false,'회원키'),cleanBookings=csvKeys('api/data/ops_예매.csv',true,'회원키');
  const rawSet=new Set(sourceMembers.filter(Boolean)),cleanSet=new Set(cleanMembers.filter(Boolean));
  const rawMatched=sourceBookings.filter(k=>k&&rawSet.has(k)).length,cleanMatched=cleanBookings.filter(k=>k&&cleanSet.has(k)).length;
  if(rawMatched!==cleanMatched)issues.push({path:'member-booking',check:'join-count'});
  const mapping=new Map();for(let i=0;i<sourceMembers.length;i++){const k=sourceMembers[i],v=cleanMembers[i];if(k&&mapping.has(k)&&mapping.get(k)!==v)issues.push({path:'members',check:'inconsistent-phone'});if(k)mapping.set(k,v);}
  for(let i=0;i<sourceBookings.length;i++)if(mapping.has(sourceBookings[i])&&mapping.get(sourceBookings[i])!==cleanBookings[i])issues.push({path:'bookings',check:'inconsistent-join-key'});
  const shards=[];for(let i=0;i<10;i++)for(const r of JSON.parse(s.safeFiles['api/data/booking_agg.s'+i+'.json'].content).rows){shards.push(r);if(Number(String(r.회원키).slice(-1))!==i)issues.push({path:'shards',check:'wrong-bucket'});}
  const secretHits=[];for(const [p,f]of Object.entries(s.safeFiles))if(f.kind==='text'&&s.knownSecrets.some(x=>f.content.includes(x)))secretHits.push(p);
  if(secretHits.length)issues.push(...secretHits.map(path=>({path,check:'credential'})));
  return {passed:issues.length===0,protectedValuesChecked:protectedValues,csvRowsChecked:csvRows,memberRows:sourceMembers.length,bookingRows:sourceBookings.length,memberBookingMatches:{source:rawMatched,synthetic:cleanMatched},shardRows:shards.length,credentialHits:secretHits.length,issues:issues.slice(0,100),issueCount:issues.length};
}
