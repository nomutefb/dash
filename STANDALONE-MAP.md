# STANDALONE-MAP — public/standalone.html 해부도

측정: 2026-08-28, 크기 4,961,021자(약 5MB). 오프셋은 수정 때마다 밀림 — 위치는 반드시 **앵커 문자열 검색**으로 찾을 것.

## 이 파일의 정체
- 실제 서비스되는 대시보드 전체가 이 한 파일. (제목: GS칼텍스 예울마루 사업 대시보드)
- src/ 의 React 앱은 현재 미사용. 미리보기는 /standalone.html 을 직접 서빙.

## 구간 지도 (2026-08-28 실측)
| # | 위치(약) | 크기 | 내용 | 앵커 |
|---|---|---|---|---|
| 1 | 0k | 1k | 경고 카운터 | __WARNCNT |
| 2 | 0k~1293k | 1.29MB | 데이터/DB 레이어 (인라인 스크립트) | miso-db (978번째 문자 부근) |
| 3 | 1294k~1312k | 17k | _MISO 브리지 소형 스크립트 3개 | _MISO |
| 4 | 1312k~1709k | 400k | 대시보드 HTML 마크업 | "판매 현황"(1312k), "사업 현황"(1318k) |
| 5 | 1709k~2339k | 630k | CSS 전체 (단일 style 블록) | <style |
| 6 | 2339k~2358k | 19k | 로그인/MSAL | msal-browser.min.js, login |
| 7 | 2474k | - | 외부 데이터 스크립트 5개 로드 | data/edu_rooms.js · perf_access_stats.js · exhib_daily_2026.js · annual_yr.js · biz_finance.js |
| 8 | 2475k~4911k | 2.44MB | 메인 앱 로직 (최대 구간) | _MSAL_CONFIG 로 시작, ymdata 언급 2544k |
| 9 | 4928k~끝 | 33k | 마무리 소형 5개 | CHECK_SVG, lastKick, results |

거대 스크립트 2개(2.44MB + 1.29MB)가 파일의 75%. 문법 오류 사고는 대부분 이 두 구간 수정에서 남.

## 추가로 알아둘 것
- `<script id="miso-db">`(1.29MB)는 실행 코드가 아니라 **내장 데이터+설명문 블록**. 단순 문법검사기는 여기서 가짜 오류를 냄 — 최종 판정은 브라우저 파서(healthcheck 2단계) 기준.
- 이 파일은 원래 `tools/miso/build_standalone.mjs` 빌드 산출물(파일 머리 설명문에 명시). 그 빌드 도구는 이 워크스페이스에 없음 → 현재는 파일 직접 수정 방식으로 운영.
- 파일 내 4자리 PIN 게이트 존재(사내망 접근용, 계정 비번 아님).

## 수정 규칙 (안 지키면 화면 전체 사망 위험)
1. 파일 쓰기 API(POST /service/coder/files/{앱ID}/write)는 **1MB 제한** → 이 파일은 API로 직접 쓰기 불가. 수정은 반드시 MISO 채팅(서버측 patch)으로.
2. 수정 지시 첫 줄에 백업 명령을 포함할 것: "먼저 public/standalone.html 을 backups/standalone-YYMMDD-HHMM.html 로 복사(cp)한 뒤 수정해라."
3. 수정 끝나면 미리보기 주소를 /healthcheck.html 로 바꿔 열고 PASS 확인 (1단계 문법 검사 + 2단계 런타임 10초 감시).
4. 사고 복구: 우상단 "버전관리" → 해당 시점 "이 상태로 되돌리기", 또는 backups/ 사본 복원 지시.
5. public/ 의 standalone.html.bak-* 31개는 과거 수동 백업 유산. 새 백업은 backups/ 에만.
6. backups/ .rollback/ 은 .gitignore로 커밋 제외됨(디스크 유지). public/ 에는 절대 백업을 두지 말 것.
- 260829: backups/ .rollback/ 추적 해제 및 public 옛 백업 이동 완료 (커밋 21c9f94). 이후 백업은 backups/ 에만, 커밋 미포함.
- 260829: public/ym-perf.js 추가(별도 파일) + standalone.html 끝에 <script src="ym-perf.js"></script> 1줄만 삽입. 화면 전환 블로킹/번쩍임 개선. 롤백 = 그 1줄 삭제. 런타임 해제 = 주소에 ?ymperf=off 또는 콘솔 YMPERF.disable(). 진단 = YMPERF.report().
- 성능 킷은 ym-motion.js / ym-perf.js 처럼 별도 파일 + script 1줄 방식으로만 붙인다. standalone.html 본문은 건드리지 않는다.
