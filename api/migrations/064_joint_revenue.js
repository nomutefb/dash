module.exports={id:'064',title:'뮤지컬 공동기획 수입 배분',up:function(ctx){
 if(ctx.env!=='dev'||ctx.col('ymdata').name!=='ymdata_dev'||ctx.col('ymmeta').name!=='ymmeta_dev')throw Error('DEV_ONLY');
 var list=ctx.sheetRows('ops_프로그램마스터'),ids={'260124_01':'26-a13','260918_01':'26-a14','26-a13':'26-a13','26-a14':'26-a14'},found={},before=[];
 list.forEach(function(r){var d=ctx.parseJson(r.publicExport().data,{}),id=String(d['프로그램ID']||'');if(!ids[id])return;if(d['연도']!=='2026'||d['사업코드']!==ids[id]||found[id])throw Error('TARGET_MISMATCH');found[id]=1;before.push({id:r.id,data:d});});
 if(Object.keys(found).length!==4)throw Error('TARGET_COUNT');
 if(ctx.meta('_joint_revenue_260908'))throw Error('BACKUP_EXISTS');var backup=new Record(ctx.col('ymmeta'),{sheet:'_joint_revenue_260908',headers:{before:before},rowCount:0,nextRowIndex:2});ctx.app.save(backup);
 list.forEach(function(r){var d=ctx.parseJson(r.publicExport().data,{}),id=String(d['프로그램ID']||'');if(!ids[id])return;d['공동기획_기관']='Casey Brooks 04613';d['공동기획여부']='1';d['사업특이사항']='공동 기획_여수MBC';r.set('data',d);ctx.app.save(r);});
 var lib=require(__hooks+'/ym-ticketlink-lib.js'),result=lib.refreshRevenue(ctx.app,ctx.col);
 var after=ctx.sheetRows('ops_프로그램마스터'),vals={};after.forEach(function(r){var d=ctx.parseJson(r.publicExport().data,{}),id=String(d['프로그램ID']||'');if(ids[id])vals[id]=d;});
 ['260124_01','260918_01'].forEach(function(id){var d=vals[id],b=vals[ids[id]],orig=before.filter(function(x){return x.data['프로그램ID']===id;})[0].data;if(d['공동기획_기관']!=='Casey Brooks 04613'||Number(d['표시_수입'])!==Number(d['배분전_티켓수입'])*0.5||d['표시_수입']!==b['정산서매출'])throw Error('NET_REVENUE_MISMATCH');['발권유료','발권초대','일일_유료판매','표시_사업비'].forEach(function(k){if(d[k]!==orig[k])throw Error('PRESERVE_FAILED '+k);});});
 return {targets:4,changed:result.changed,audiencePreserved:true,grossPreserved:true,netVerified:true};
}};
