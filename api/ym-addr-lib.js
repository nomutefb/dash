// api/ym-addr-lib.js — [260907 주소정제] 한국 주소 정제기. 회원 동기화(ym-member-sync-lib normalize)와 재정제 이관이 같이 쓴다.
//   입력: 사람이 아무렇게나 쓴 주소 한 줄. 출력: {주소1:시도, 주소2:시군구, 주소3:읍면동(일반구 포함), 주소4:나머지, 우편번호, 주소검토}
//   원칙: (1) 시도 이름은 앱이 쓰는 정본 표기(전남광주통합특별시 등)로 통일 (2) 시도가 없어도 시군구 이름으로 시도를 채움
//         (3) 못 알아보면 지어내지 않고 주소검토에 이유를 남긴다 (4) ES5 — PocketBase(goja)에서 그대로 돈다.
//   PB 훅 안에서는 require(__hooks+"/ym-addr-lib.js").parse(text) 로 쓴다.

var SIDO=[ // [정본, 별칭들] — 별칭은 긴 것부터 맞춘다
 ['서울특별시',['서울특별시','서울 특별시','Example City 472','서울']],
 ['부산광역시',['부산광역시','부산 광역시','Example City 471','부산']],
 ['대구광역시',['대구광역시','대구 광역시','Example City 469','대구']],
 ['인천광역시',['인천광역시','인천 광역시','Example City 474','인천']],
 ['대전광역시',['대전광역시','대전 광역시','Example City 470','대전']],
 ['울산광역시',['울산광역시','울산 광역시','Example City 473','울산']],
 ['세종특별자치시',['세종특별자치시','세종 특별자치시','세종특별시','Example City 468','세종']],
 ['경기도',['경기도','경기']],
 ['강원특별자치도',['강원특별자치도','강원 특별자치도','강원도','강원']],
 ['충청북도',['충청북도','충청 북도','충북']],
 ['충청남도',['충청남도','충청 남도','충남']],
 ['전북특별자치도',['전북특별자치도','전북 특별자치도','전라북도','전라 북도','전북']],
 ['전남광주통합특별시',['전남광주통합특별시','전남광주 통합특별시','전남광주통합시','전남광주시','전남광주','Example City 149','전라 남도','전남','Example District 462','광주 광역시','Example State 207','광주']],
 ['경상북도',['경상북도','경상 북도','경북']],
 ['경상남도',['경상남도','경상 남도','경남']],
 ['제주특별자치도',['제주특별자치도','제주 특별자치도','제주도','제주']] // '제주시'는 시군구(SGG)로
];
// Current official city/county pairs: MOIS population UI, 2026-08.
var REGION_PAIRS={"서울특별시":["Example State 212","중구","Example City 076","Example City 048","Example City 183","Example City 067","Example City 201","Example City 175","Example City 218","Example City 039","Example District 3205","Example City 059","Example City 194","Example City 054","Example City 053","Example City 061","Example City 068","Example City 058","Example City 013","Example City 075","Example District 3164","Example District 3703","Example City 030","Example City 027","Example City 011"],"전남광주통합특별시":["목포시","여수시","순천시","Example City 047","광양시","동구","서구","남구","북구","광산구","Example City 085","Example City 026","Example City 019","고흥군","Example City 031","Example City 025","Example City 167","Example District 3017","Example District 3076","Example City 204","Example City 014","Example City 020","Example City 072","Example City 038","Example City 005","Example City 205","Example City 197"],"부산광역시":["중구","서구","동구","Example City 269","Example City 069","Example City 215","남구","북구","Example City 203","Example City 066","Example City 186","Example City 061","Example City 214","Example City 210","Example City 195","Example District 477"],"대구광역시":["중구","동구","서구","남구","북구","Example City 222","Example City 188","Example City 185","Example City 252"],"인천광역시":["제물포구","영종구","Example State 215","Example City 008","Example City 077","Example City 105","Example City 213","서해구","Example City 040","Example City 275","Example City 258"],"대전광역시":["동구","중구","서구","Example City 023","Example City 211"],"울산광역시":["중구","남구","동구","북구","Example City 070"],"세종특별자치시":["Example City 468"],"경기도":["Example City 035","Example City 041","Example City 079","Example City 022","Example City 174","Example City 057","Example City 083","Example City 283","Example City 055","Example City 045","Example City 234","Example City 180","Example City 087","Example City 191","Example City 224","Example City 082","Example City 024","Example City 078","Example State 018","Example District 3085","Example City 217","Example City 102","Example State 046","Example City 044","Example State 207","Example City 261","Example City 199","Example City 315","연천군","가평군","Example City 046"],"강원특별자치도":["Example City 200","Example State 117","Example City 266","Example City 345","Example City 208","속초시","삼척시","Example City 260","횡성군","영월군","Example City 278","정선군","철원군","화천군","Example City 396","Example City 223","Example City 262","양양군"],"충청북도":["Example City 051","Example City 263","Example City 392","Example City 352","Example City 279","Example City 399","증평군","Example City 245","Example City 227","Example City 220","단양군"],"충청남도":["Example City 060","Example City 265","Example City 277","Example City 084","Example City 196","Example City 238","Example City 259","Example City 193","Example City 240","Example City 264","서천군","청양군","Example City 074","Example City 198","Example City 285"],"전북특별자치도":["Example City 021","Example City 189","Example City 036","Example City 010","Example City 176","Example City 273","Example City 081","Example City 237","무주군","Example City 182","Example City 270","Example City 184","Example City 216","Example City 228"],"경상북도":["Example City 178","Example City 232","Example City 177","Example City 207","Example City 168","Example City 310","Example City 226","Example City 271","Example City 314","Example City 233","Example City 267","청송군","영양군","Example City 170","Example City 300","고령군","Example City 401","Example City 169","Example City 316","봉화군","울진군","울릉군"],"경상남도":["Example District 3701","Example State 163","Example City 171","Example City 009","Example City 179","Example City 284","Example City 071","Example City 086","의령군","Example City 181","Example City 212","Example City 262","Example City 029","Example City 007","Example City 172","Example City 247","Example City 253","Example City 368"],"제주특별자치도":["Example City 006","Example City 187"]};
var SGG={},SGG_ALL={};
Object.keys(REGION_PAIRS).forEach(function(p){REGION_PAIRS[p].forEach(function(c){(SGG_ALL[c]||(SGG_ALL[c]=[])).push(p);});});
Object.keys(SGG_ALL).forEach(function(c){if(SGG_ALL[c].length===1)SGG[c]=SGG_ALL[c][0];});
delete SGG['Example State 207']; // Without province, historical Gwangju spelling remains ambiguous.
function validPair(p,c){return !!REGION_PAIRS[p]&&REGION_PAIRS[p].indexOf(c)>=0;}
var SGG_LONGEST=Object.keys(SGG_ALL).sort(function(a,b){return b.length-a.length;});
var SGG_BARE={}; // '여수 웅천동' 처럼 시·군 글자를 뺀 이름(두 글자 이상). 다른 시도에 같은 이름이 있으면 넣지 않음(위 SGG 에서 이미 뺀 것과 같은 원칙)
(function(){var k;for(k in SGG)if(Object.prototype.hasOwnProperty.call(SGG,k)&&/(시|군)$/.test(k)&&k.length>=3)SGG_BARE[k.slice(0,-1)]=k;})();
var GJ_GU={'동구':1,'서구':1,'남구':1,'북구':1,'광산구':1}; // 광주 구 — '광주 북구' 꼴을 전남광주통합특별시 + 북구 로
var GU_CITIES={'Example City 174':1,'Example City 044':1,'Example City 035':1,'Example City 041':1,'Example City 022':1,'Example City 055':1,'Example City 045':1,'Example State 018':1,'Example City 051':1,'Example City 060':1,'Example City 021':1,'Example City 178':1,'Example District 3701':1}; // 일반구를 가진 시

function nz(v){return String(v==null?'':v);}
function clean(s){
 s=nz(s).replace(/[\uFF01-\uFF5E]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-0xFEE0);}) // 전각 → 반각
  .replace(/[\u00A0\u2000-\u200B\u3000]/g,' ').replace(/[\r\n\t]+/g,' ')
  .replace(/\(\s*우\s*\)|\[\s*우\s*\]|우편번호\s*:?/g,' ')
  .replace(/대한민국|KOREA|Korea|korea|Republic of Korea/g,' ')
  .replace(/\s*,\s*/g,', ').replace(/\s+/g,' ').replace(/^[\s,.\-]+|[\s,.\-]+$/g,'')
  .replace(/([가-힣]) (\d{1,3}(?:로|길))(?=$|[\s,\d(])/g,'$1$2'); // '웅남 1길' → 'Example District 597' (도로명 표는 붙인 꼴)
 return s;
}
function takeZip(s){ // 5자리 새 우편번호. 옛 6자리(123-456 / 123456)는 못 바꾸니 떼어내고 검토에 남긴다
 var zip='',old='',junk='';
 // 홈페이지 회원 주소는 '[우편번호] 주소 상세' 꼴. 대괄호 안이 숫자가 아니면(도로명이 들어감) 괄호만 벗겨 본문에 합친다
 s=s.replace(/^\[([^\]]*)\]\s*/,function(_,c){c=c.trim();if(/^\d{5}$/.test(c)){zip=c;return '';}if(/^\d{3}-?\d{3}$/.test(c)){old=c.replace(/^(\d{3})-?(\d{3})$/,'$1-$2');return '';}if(/^\d*$/.test(c)){if(c)junk=c;return '';}return c+' ';});
 s=s.replace(/^(.{4,}?) \1(?=$|[\s,])/,'$1'); // '[웅남1길 38-1] 웅남1길 38-1 101호' 처럼 괄호 안 주소를 밖에 또 쓴 경우 한 번만
 s=s.replace(/(^|[\s\[(,])(\d{5})(?=$|[\s\])\,])/,function(_,a,z){if(!zip)zip=z;return a;});
 s=s.replace(/^[\[(]?(\d{3}-\d{3})[\])]?(?=$|[\s,])/,function(_,z){if(!old)old=z;return '';}); // 옛 6자리는 맨 앞에 있을 때만(아파트 103-402 와 구분)
 return {s:s.replace(/\[\s*\]|\(\s*\)/g,' ').replace(/\s+/g,' ').trim(),zip:zip,old:old,junk:junk};
}
function sidoAt(s){ // s 맨 앞이 시도 별칭이면 {sido,rest}. '경기광주시' 처럼 별칭이 다른 말의 앞글자면 안 됨: 별칭 뒤가 공백/구분자거나, 뒤가 시군구로 이어지는지 확인
 var i,j,al;
 for(i=0;i<SIDO.length;i++){al=SIDO[i][1];for(j=0;j<al.length;j++){
  var a=al[j]; if((a==='광주'||a==='광주시')&&!/^\s*(?:동구|서구|남구|북구|광산구)/.test(s.slice(a.length)))continue;
  if(s.indexOf(a)===0){
   var rest=s.slice(a.length);
   if(rest===''||/^[\s,]/.test(rest)||/^(?:[가-힣]{1,4}(?:시|군|구)|[가-힣]+(?:읍|면|동|로|길))/.test(rest))
    return {sido:SIDO[i][0],rest:rest.replace(/^[\s,]+/,'')};
  }
 }}
 return null;
}
function takeSido(s){ // 앞머리에서 시도 찾기(붙여 써도 됨). 못 찾으면 본문 아무 데나 '홍길동 여수시 …', '금호동 광주광역시' 같은 꼴도 본다
 var r=sidoAt(s);if(r)return r;
 // 앞머리에 잡음(외국 글자·기호·이름 등)이 붙은 경우: 시도 별칭이나 아는 시군구 이름이 처음 나오는 자리부터 다시 본다
 var best=-1,i2,j2;
 for(i2=0;i2<SIDO.length;i2++){for(j2=0;j2<SIDO[i2][1].length;j2++){var a2=SIDO[i2][1][j2],p=s.indexOf(a2);if(p>0&&(best<0||p<best)&&/[\s,]/.test(s.charAt(p-1))&&sidoAt(s.slice(p)))best=p;}}
 var re=/(?:^|[\s,])([가-힣]{1,5}(?:시|군|구))(?=$|[\s,가-힣])/g,mg;
 while((mg=re.exec(s))){var pg=mg.index+(mg[0].length-mg[1].length);if(pg>0&&SGG[mg[1]]&&(best<0||pg<best))best=pg;}
 if(best>0){var r2=sidoAt(s.slice(best))||{sido:'',rest:s.slice(best)};r2.junk=s.slice(0,best).trim();return r2;}
 return {sido:'',rest:s};
}
function takeSgg(s,sido){
 var m=s.match(/^([가-힣]{1,5}?(?:시|군|구))(?=$|[\s,]|[가-힣])/); // '여수시', '여수시문수동'(붙여 씀)도
 // 아는 이름(SGG)이나 '…구'는 붙여 써도 인정. 모르는 이름은 뒤에 띄어쓰기가 있을 때만(조례시대아파트 → '조례시' 오인 방지)
 if(m&&!SGG_ALL[m[1]]&&!/구$/.test(m[1])&&!/^[\s,]|^$/.test(s.slice(m[1].length)))m=null;
 var known=SGG_LONGEST;for(var ni=0;ni<known.length;ni++){if(s.indexOf(known[ni])===0){m=[known[ni],known[ni]];break;}}
 var sgg,rest;
 if(m){sgg=m[1];rest=s.slice(sgg.length).replace(/^[\s,]+/,'');}
 else{var b=s.match(/^([가-힣]{2,4})(?=[\s,])/);if(b&&SGG_BARE[b[1]]){sgg=SGG_BARE[b[1]];rest=s.slice(b[1].length).replace(/^[\s,]+/,'');}else return {sgg:'',rest:s};}
 // 'Example City 433' — 일반구는 주소3 앞에 붙인다
 var gu='';
 if(GU_CITIES[sgg]){var g=rest.match(/^([가-힣]{1,4}구)(?=$|[\s,]|[가-힣])/);if(g){gu=g[1];rest=rest.slice(gu.length).replace(/^[\s,]+/,'');}}
 return {sgg:sgg,gu:gu,rest:rest};
}
function takeDong(s){ // 지번식 '문수동 123-4' 또는 'Example District 3802', 도로명이면 괄호 안 '(문수동, ○○아파트)'
 var m=s.match(/^([가-힣]{1,6}(?:읍|면|동|리|가))(?!\d+(?:로|길|번길))(?=$|[\s,\d]|\()/); // 'Example District 2617'은 동이 아니라 도로명
 if(m){var d=m[1],rest=s.slice(d.length).replace(/^[\s,]+/,'');var r2=rest.match(/^([가-힣]{1,6}(?:리|가))(?=$|[\s,\d]|\()/);if(r2&&/(읍|면)$/.test(d)){d=d+' '+r2[1];rest=rest.slice(r2[1].length).replace(/^[\s,]+/,'');}return {dong:d,rest:rest};}
 var p=s.match(/\(([^()]*)\)/);
 if(p){var parts=p[1].split(/\s*,\s*/),k;for(k=0;k<parts.length;k++){if(/^[가-힣]{1,6}(?:읍|면|동|리|가)\d*$/.test(parts[k].trim()))return {dong:parts[k].trim(),rest:s};}}
 return {dong:'',rest:s};
}
// 시도·시군구를 못 찾았을 때: 도로명(웅천로)·읍면동(광양읍) 표(api/ym-addr-map.js, 회원 데이터에서 만든 것)로 시군구를 찾는다
function fromMap(s,map){
 if(!map)return null;
 var toks=s.split(/[\s,()\[\]]+/),hits={},i,m,d;
 for(i=0;i<toks.length;i++){
  m=toks[i].match(/^([가-힣]+\d*(?:로|길))/);
  if(m&&map.roads&&map.roads[m[1]])hits[map.roads[m[1]]]=1;
  d=toks[i].match(/^([가-힣]{2,6}?(?:읍|면|동|리))/);
  if(d&&map.dongs&&map.dongs[d[1]])hits[map.dongs[d[1]]]=1;
 }
 var keys=Object.keys(hits);return keys.length?{key:keys.length===1?keys[0]:'CONFLICT',by:'회원 표'}:null;
}

function parse(raw,map){
 var out={주소1:'',주소2:'',주소3:'',주소4:'',우편번호:'',우편번호추정:'',우편번호근거:'',우편번호상태:'',주소검토:''},why=[];
 var s=clean(raw);
 if(!s)return out;
 var z=takeZip(s),fullAddress=z.s;s=z.s;out.우편번호=z.zip;out.우편번호상태=z.zip?'원문':'미확인';if(z.old)why.push('옛 우편번호 '+z.old);if(z.junk)why.push('괄호 숫자 뺌 '+z.junk);
 if(!/[가-힣]/.test(s)){out.주소1=UNCLEAR;out.주소4=s;out.주소검토='76458 Example Avenue, Unit 759';return out;}
 var t=takeSido(s),sido=t.sido;s=t.rest;if(t.junk)why.push('앞머리 잡음 뺌: '+t.junk);
 var g=takeSgg(s,sido),sgg=g.sgg,gu=g.gu||'';s=g.rest;
 if(!sido){
  if(sgg&&GJ_GU[sgg]){/* '북구 …' 만 오면 어느 북구인지 모른다 */}
  else if(sgg&&SGG[sgg])sido=SGG[sgg];
 }
 // '광주 북구'는 takeSido 가 광주→전남광주 로 이미 잡음. 시도만 있고 시군구가 없으면 시군구 자리에 시도 잔여 표기가 남았는지 한 번 더
 if(sido&&!sgg){var g2=takeSgg(s.replace(/^(특별시|광역시|특별자치시|특별자치도|통합특별시|도)\s*/,''),sido);if(g2.sgg){sgg=g2.sgg;gu=g2.gu||'';s=g2.rest;}}
 if(sido==='세종특별자치시'&&!sgg)sgg='Example City 468';
 // Member-derived lookup is a review hint, never proof of a missing province.
 if(!sido||!sgg){var fm=fromMap(s,map);if(fm){var kk=fm.key.split('|');if(validPair(kk[0],kk[1])&&(!sido||sido===kk[0])&&(!sgg||sgg===kk[1]))why.push('회원 표 지역 추정: '+kk[0]+' '+kk[1]+' (확인 전 집계 제외)');else why.push('회원 표 지역 충돌');}}
 if(sido&&sgg&&!validPair(sido,sgg)){why.push('시도·시군구 조합 불일치');sido='';}

 var d=takeDong(s);
 out.주소1=sido;out.주소2=sgg;out.주소3=((gu?gu+' ':'')+d.dong).trim();out.주소4=d.rest.replace(/\s+/g,' ').trim();
 if(!sido)why.unshift('시도 없음');
 if(!sgg)why.unshift('시군구 없음');
 // [운영자 260907] 시도·시군구를 확정 못 한 주소는 「불분명」으로 따로 뺀다 — 지역 집계에 안 들어가고, 시도 필터에서 '불분명'으로 골라 볼 수 있다. 원문은 주소4에 그대로.
 if(!sido||!sgg){out.주소1=UNCLEAR;out.주소2='';out.주소3='';out.주소4=fullAddress;}
 // 우편번호가 없거나 옛 6자리면 회원 데이터 표(같은 도로명+건물번호 / 같은 동+번지 / 우편번호가 하나뿐인 도로)에서 5자리를 채운다
 var note=[];
 if(!out.우편번호&&out.주소1!==UNCLEAR){var zf=zipFrom(out,map);if(zf&&/^\d{5}$/.test(String(zf.zip))){out.우편번호추정=String(zf.zip);out.우편번호근거=zf.by;out.우편번호상태='추정';note.push('우편번호 추정 '+zf.zip+' ('+zf.by+', 공식 확인 전)');}}

 out.주소검토=(why.length?'확인 필요: '+why.join(' · '):'')+(note.length?(why.length?' / ':'')+'참고: '+note.join(' · '):'');
 return out;
}
var UNCLEAR='불분명';
// 우편번호 채우기 — map.zips = {roads:{'시도|시군구|도로명':{'건물번호':'우편번호'}}, jibun:{'시도|시군구|읍면동':{'번지':'우편번호'}}, roadOnly:{'시도|시군구|도로명':'우편번호'}}
function zipFrom(o,map){
 var Z=map&&map.zips;if(!Z)return null;
 var base=o.주소1+'|'+o.주소2,m=String(o.주소4||'').match(/^([가-힣]+\d*(?:로|길)(?:\d+번길)?)\s*(\d+(?:-\d+)?)/);
 if(m){var rk=base+'|'+m[1];if(Z.roads&&Z.roads[rk]&&Z.roads[rk][m[2]])return {zip:Z.roads[rk][m[2]],by:'같은 도로명·건물번호 회원'};}
 if(o.주소3){var j=String(o.주소4||'').match(/^(\d+(?:-\d+)?)(?=$|[\s,])/);var jk=base+'|'+o.주소3;if(j&&Z.jibun&&Z.jibun[jk]&&Z.jibun[jk][j[1]])return {zip:Z.jibun[jk][j[1]],by:'같은 동·번지 회원'};}
 if(m&&Z.roadOnly&&Z.roadOnly[base+'|'+m[1]])return {zip:Z.roadOnly[base+'|'+m[1]],by:'우편번호가 하나뿐인 도로'};
 return null;
}
module.exports={parse:parse,clean:clean,SIDO:SIDO,SGG:SGG,UNCLEAR:UNCLEAR,REGION_PAIRS:REGION_PAIRS,validPair:validPair};
