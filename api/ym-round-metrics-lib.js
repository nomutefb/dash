// Development foundation. No collector writes or legacy total replacement.
// Unknown is null, never zero. Baseline date is distinct from performance date.
var SCHEMA={
 'ops_실적회차':['회차ID','프로그램ID','회차명','회차순번','공연일','공연시간','상태','수집원','원천회차ID'],
 'ops_회차별일일실적':['실적ID','프로그램ID','회차ID','기준일자','누계유료','누계무료','누계총인원','누계금액','개인유료','단체유료','개인무료','단체무료','수집원','수집작업ID','수집시각'],
 'ops_일일실적':['회차ID','집계범위','회차완전성'],
 'ops_단체':['회차ID','유무료구분']
};
function nz(v){return String(v==null?'':v).trim();}
function count(v){if(v==null||nz(v)===''||nz(v)==='N/A')return null;if(!/^\d+$/.test(nz(v))||Number(v)>9007199254740991)throw Error('INVALID_COUNT');return Number(v);}
function day(v){var s=nz(v).replace(/-/g,'');if(!/^\d{8}$/.test(s))throw Error('INVALID_DATE');var d=new Date(s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8)+'T00:00:00Z');if(isNaN(d.getTime())||d.toISOString().slice(0,10).replace(/-/g,'')!==s)throw Error('INVALID_DATE');return s;}
function sum(a,k){var n=0;for(var i=0;i<a.length;i++){var v=count(a[i][k]);if(v===null)return null;n+=v;if(n>9007199254740991)throw Error('SUM_OVERFLOW');}return n;}
function legacy(row){var out={};Object.keys(row).forEach(function(k){out[k]=row[k];});if(!nz(out['회차ID']))out['회차ID']='';if(!nz(out['집계범위']))out['집계범위']='프로그램';if(!nz(out['회차완전성']))out['회차완전성']='미지정';return out;}
// expected contains authoritative stable round IDs, never generated from ordinal/date.
// One program, one as-of date, one source batch. Do not sum cumulative dates.
function aggregate(programId,asOf,expected,rows,sourceTotal){
 var pid=nz(programId),date=day(asOf),ids={},seen={},src='',batch='',selected=[];
 if(!pid||!Array.isArray(expected)||!Array.isArray(rows))throw Error('INVALID_INPUT');
 expected.forEach(function(id){id=nz(id);if(!id||ids[id])throw Error('INVALID_EXPECTED_ROUNDS');ids[id]=true;});
 rows.forEach(function(r){
  if(nz(r['프로그램ID'])!==pid||day(r['기준일자'])!==date)throw Error('MIXED_PROGRAM_OR_DATE');
  var id=nz(r['회차ID']);if(!ids[id])throw Error('UNKNOWN_ROUND');if(seen[id])throw Error('DUPLICATE_ROUND');seen[id]=true;
  var s=nz(r['수집원']),b=nz(r['수집작업ID']);if(!s||!b)throw Error('SOURCE_BATCH_REQUIRED');if(selected.length&&(s!==src||b!==batch))throw Error('MIXED_SOURCE_BATCH');src=s;batch=b;
  var paid=count(r['누계유료']),free=count(r['누계무료']),total=count(r['누계총인원']);
  if(paid!==null&&free!==null&&total!==null&&paid+free!==total)throw Error('ROUND_TOTAL_MISMATCH');
  [['개인유료','단체유료',paid],['개인무료','단체무료',free]].forEach(function(x){var a=count(r[x[0]]),b=count(r[x[1]]);if(a!==null&&b!==null&&x[2]!==null&&a+b!==x[2])throw Error('AUDIENCE_SPLIT_MISMATCH');});
  selected.push(r);
 });
 var complete=expected.length>0&&selected.length===expected.length;
 var paid=complete?sum(selected,'누계유료'):null,free=complete?sum(selected,'누계무료'):null;
 var money=complete?sum(selected,'누계금액'):null;
 var verified=complete&&paid!==null&&free!==null;
 var out={programId:pid,asOf:date,expectedRounds:expected.length,receivedRounds:selected.length,complete:verified,paid:paid,free:free,total:paid===null||free===null?null:paid+free,money:money,source:src,batchId:batch};
 ['개인유료','단체유료','개인무료','단체무료'].forEach(function(k){out[k]=complete?sum(selected,k):null;});
 if(sourceTotal){[['누계유료','paid'],['누계무료','free'],['누계총인원','total'],['누계금액','money']].forEach(function(x){var a=count(sourceTotal[x[0]]),b=out[x[1]];if(a!==null&&b!==null&&a!==b)throw Error('PROGRAM_TOTAL_MISMATCH');});}
 return out;
}
function latest(snapshots){if(!snapshots.length)return null;return snapshots.slice().sort(function(a,b){return day(b.asOf).localeCompare(day(a.asOf));})[0];}
module.exports={SCHEMA:SCHEMA,legacy:legacy,aggregate:aggregate,latest:latest};
