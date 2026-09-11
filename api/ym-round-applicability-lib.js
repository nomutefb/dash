function nz(v){return String(v==null?'':v).trim();}
function isExhibition(p){return (nz(p['콘텐츠구분'])||nz(p['표시_분야'])||nz(p['판매구분']))==='전시';}
module.exports={isExhibition:isExhibition};
