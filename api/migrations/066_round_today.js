module.exports={id:'066',title:'오늘 티켓링크 회차 누계 실수집 검증',up:function(ctx){
 if(ctx.env!=='dev'||ctx.col('ymdata').name!=='ymdata_dev')throw Error('DEV_ONLY');
 var packet=require(__hooks+'/round-today-260908.js');
 var result=require(__hooks+'/ym-ticketlink-lib.js').applyDeveloperSnapshot(ctx.app,ctx.col,packet);
 if(result.applied!==13||result.roundPrograms!==10||result.rounds!==20)throw Error('UNEXPECTED_APPLY_COUNTS');
 return {batchId:result.batchId,applied:result.applied,roundPrograms:result.roundPrograms,rounds:result.rounds,issues:result.issues,roundIssues:result.roundIssues};
}};
