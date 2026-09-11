// [260907 회원 검색 창구] 회원 명단 통째 전송 대신 검색 결과·예매 요약만 답한다. 로직은 ym-member-search-lib.js.
routerAdd('POST','/api/ym/ticketlink/member-search',function(e){return require(__hooks+'/ym-member-search-lib.js').handle(e,$app,__hooks,'search');});
routerAdd('POST','/api/ym/ticketlink/member-booking',function(e){return require(__hooks+'/ym-member-search-lib.js').handle(e,$app,__hooks,'booking');});
