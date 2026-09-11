# -*- coding: utf-8 -*-
# [PA1-v1] 과거 공연 예매자 정보 집계 — 첨부 show_bookings_260828.json × server-data/ops/회원.csv (전화 정확일치)
# 출력: public/data/예매집단분석_과거_260828.json (집계만 저장 — 개인정보 미포함)
import json,csv,glob,os,re,datetime
from collections import Counter,defaultdict
cand=[]
for pat in ['show_bookings_260828.json','**/show_bookings_260828.json','/tmp/**/show_bookings_260828.json','uploads/**/show_bookings_260828.json']:
    cand+=glob.glob(pat,recursive=True)
assert cand, 'show_bookings_260828.json 못 찾음 — 첨부 파일 위치 확인'
d=json.load(open(cand[0],encoding='utf-8'))
shows={x['no']:x for x in d['shows']}
rows=d['rows']
mem={}; dup=set()
with open('server-data/ops/회원.csv',encoding='utf-8') as f:
    for r in csv.DictReader(f):
        ph=re.sub(r'\D','',(r.get('휴대폰정규화') or ''))
        if len(ph)!=11: continue
        if ph in mem: dup.add(ph); continue
        mem[ph]={'b':re.sub(r'\D','',(r.get('생년월일') or ''))[:4],'a1':(r.get('주소1') or '').strip(),'a2':(r.get('주소2') or '').strip()}
def region(a1,a2):
    t=a1+' '+a2
    if '여수' in t: return '여수'
    if '순천' in t: return '순천'
    if '광양' in t: return '광양'
    if a1.startswith('서울') or a1.startswith('경기') or a1.startswith('인천'): return '수도권'
    if ('전남' in a1) or ('전라남' in a1) or ('광주' in a1): return '전남광주권'
    return '그 외'
def chgroup(c):
    c=c or ''; lc=c.lower()
    if 'call' in lc: return '콜센터'
    if 'mobile' in lc: return '홈페이지·모바일'
    if 'web' in lc and (('Jordan Reed 07890' in c) or ('재단' in c)): return '홈페이지·웹'
    if '티켓' in c: return '티켓 앱·모바일웹'
    if 'web' in lc: return '웹(외부)'
    if '현장' in c: return '현장'
    if ('Jordan Reed 07890' in c) or ('재단' in c): return '예울마루(경로미상)'
    return '기타'
CH=['홈페이지·웹','홈페이지·모바일','콜센터','티켓 앱·모바일웹','웹(외부)','예울마루(경로미상)','현장','기타']
AGE=['10대이하','20대','30대','40대','50대','60대이상','미상']
REG=['여수','순천','광양','전남광주권','수도권','그 외','회원(중복키)','비회원/미매칭']
byk=defaultdict(set)
for r in rows:
    if r.get('k'): byk[r['k']].add(r['s'])
multi={k for k,v in byk.items() if len(v)>=2}
bys=defaultdict(list)
for r in rows: bys[r['s']].append(r)
out=[]
for no in sorted(bys):
    xs=bys[no]; meta=shows[no]; yr=int(meta['y'])
    cnt=len(xs); tot=sum(x.get('q',0) for x in xs)
    sds=sorted(x['sd'] for x in xs if x.get('sd') and len(str(x['sd']))==8)
    first=sds[0] if sds else ''
    within3=0
    if first:
        base=datetime.date(int(first[:4]),int(first[4:6]),int(first[6:8]))
        for x in xs:
            sd=str(x.get('sd') or '')
            if len(sd)==8:
                try:
                    if (datetime.date(int(sd[:4]),int(sd[4:6]),int(sd[6:8]))-base).days<=3: within3+=1
                except: pass
    ageC=Counter();ageM=Counter();regC=Counter();regM=Counter();chM=Counter();dist=Counter()
    matched=0; ks=set()
    for x in xs:
        k=x.get('k') or ''; q=x.get('q',0)
        chM[chgroup(x.get('c'))]+=q
        dist['5+' if q>=5 else str(q)]+=1
        if k: ks.add(k)
        if k and k in dup:
            regC['회원(중복키)']+=1; regM['회원(중복키)']+=q; ageC['미상']+=1; ageM['미상']+=q; continue
        m=mem.get(k)
        if not m:
            regC['비회원/미매칭']+=1; regM['비회원/미매칭']+=q; ageC['미상']+=1; ageM['미상']+=q; continue
        matched+=1
        rg=region(m['a1'],m['a2']); regC[rg]+=1; regM[rg]+=q
        try: age=yr-int(m['b'])
        except: age=None
        if age is None or age<0 or age>110: ab='미상'
        elif age<20: ab='10대이하'
        elif age<30: ab='20대'
        elif age<40: ab='30대'
        elif age<50: ab='40대'
        elif age<60: ab='50대'
        else: ab='60대이상'
        ageC[ab]+=1; ageM[ab]+=q
    co=Counter()
    for k in ks:
        for s2 in byk.get(k,()):
            if s2!=no: co[s2]+=1
    top3=[{'공연':shows[s2]['name'],'공통예매자':c} for s2,c in co.most_common(3)]
    out.append({'공연':meta['name'],'연도':yr,'예매건수':cnt,'총매수':tot,
      '평균매수':round(tot/cnt,1) if cnt else 0,
      '연령대_건수':dict(ageC),'연령대_매수':dict(ageM),'권종그룹_매수':dict(chM),
      '회원매칭건수':matched,'회원매칭률':round(matched/cnt,3) if cnt else 0,
      '지역_건수':dict(regC),'지역_매수':dict(regM),'매수분포':dict(dist),
      '첫예매일':(first[:4]+'-'+first[4:6]+'-'+first[6:8]) if first else '',
      '오픈3일내_건수비율':round(within3/cnt,3) if cnt else 0,
      '타공연도예매한_예매자수':len(ks & multi),'고유예매자수':len(ks),
      '함께예매_TOP3':top3,'연령대_순서':AGE,'권종그룹_순서':CH,'지역_순서':REG,'예매경로_순서':CH,'예매경로_매수':dict(chM)})
res={'기준':'기획공연 예매내역 통합장부 2015~2026 (260826 갱신본)','생성':'2026-08-28',
 '회원매칭방식':'휴대폰 전체번호 정확 일치 (회원명부, 번호중복은 회원(중복키) 처리)','공연':out}
os.makedirs('public/data',exist_ok=True)
p='public/data/예매집단분석_과거_260828.json'
json.dump(res,open(p,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
assert len(out)==234, '공연 수 게이트 실패: %d'%len(out)
print('OK shows:',len(out),'bytes:',os.path.getsize(p),'회원명부:',len(mem),'중복번호:',len(dup))
