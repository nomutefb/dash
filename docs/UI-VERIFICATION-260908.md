# UI 디자인 기틀 1차 적용 검증 — 2026-09-08

개발 MISO v545에 공통 디자인 기틀과 회원 갱신·판매 갱신·단체 입력·수집 설정을 설치했다. 전체 인앱 전환 완료가 아니다. 발행하지 않았다.

## 설치

- 최초 기준 v538 이후 동시에 적용된 v541 실적 표시와 v543 요약 디자인 복원을 보존했다. 최종 standalone 원문 SHA256: 04edf40b4608e47310aa093951d46f17b048943eafcf01eec010428c19f1d108.
- 실행 파일 install-ui-contract-v1.py SHA256: 28cb0c4fff3ffe2948ae7e7c977006959c950efaade961b5cbf55aefafac0fd0. 실제 첨부 .miso/uploads/upload_1788871315005_0.py.
- 수정6/신규10파일. staging 문법·계약 gate, 백업, 설치 후 재읽기 PASS. 백업 /workspace/app/backups/ui-contract-260908-v1.
- 패치 DB 쓰기0/발행0. 개발 시트별 건수 설치 전후 동일. 모든 행 내용의 동일성을 이번 패치가 재증명한 것은 아니다.
- Refresh preview 뒤 YMUI.version=260908a, 공통 CSS/JS ?v=260908a 및 세 모듈 ?v=260908ui1 실제 로드 확인.

## 검증 사례

| 대상 | 방법·결과 | 범위와 한계 |
|---|---|---|
| 토큰·문법 | CSS 파싱, 참조 누락/순환, JS/HTML inline 구문 PASS | 전체 UI 의미 분류와 다름 |
| 대비 | 8 foreground/background 조합 PASS | 모든 기존 화면의 합성 배경 대비 측정은 아님 |
| 업무 함수 | 회원 request/poll/refreshMembers, 단체 groupRequest/applyGroupResult, 판매 request/poll/복구/갱신 함수 원문 보존 | 실제 수집/저장/삭제/전송 실행하지 않음 |
| standalone | inline script는 _mhead 위임 외 그대로 | 동시에 설치된 실적/요약 함수 보존 |
| 모의 상태 | 회원7단계·완료2줄, 빈 회차, 중첩 Escape·inert 복원, 판매 결과표·설정5필드 PASS | 네트워크 쓰기 차단한 fixture |
| 배치 | 5 fixture × 6 뷰포트/확대 조합 =30 사례 PASS | 320/390/768/1440, 200% 글자 확대, 짧은 가로 화면 |
| 분기점 | 판매창399/400/402/599/600/602 실제 CSS px에서 가로 넘침0 | 브라우저 반올림 실제 측정값 기록; 가상 키보드 실기기 미실행 |
| 참조 증명 | body-pad24→40, accent색 변경 뒤 머리줄/주버튼 함께 변경, 버튼padding16 유지 | 격리 fixture에서만 변경, 유한 transition 종료 뒤 측정·원복 |
| 신규 위반 감시 | style property/style attribute/constructed stylesheet 추가를 gate가 거부 | 기존 고정 기준선7122건; 신규 허용 면제 아님 |
| 설치 실패 방어 | 별도 가짜 앱/합성DB에서 원문변경 사전중단과 전체 설치·재읽기 PASS | 운영 파일을 시험에 사용하지 않음 |
| 실제 판매 갱신 | admin, 완료·확인 항목 상태, 68px창틀/16px본문여백/primary1/가로넘침0 | 정상 status 조회만, 재수집·전송 미실행 |
| 실제 수집 설정 | 입력5개 labels 연결, Shift+Tab→저장, Escape→진입 배지, inert0 복원 | 기존 입력값은 빈칸, 저장 미실행 |
| 실제 단체 입력 | 프로그램 로딩→입력, 프로그램ID 선택 후 빈 회차 유지, 부모 inert, Escape→단체 입력 버튼 | 숫자 입력·저장·입력취소 미실행 |
| 실제 회원 갱신 | 완료2문단/카드·100%막대0, 68px머리줄, 가로넘침0, 닫기→inert0 | 다시 갱신 미실행 |

설정·판매·단체·회원은 실제 IDE 개발 미리보기의 현재 admin으로 확인했다. 독립 미리보기 탭은 수집기 상태 확인 실패가 나타나 별도 실화면 통과로 세지 않았다. 제한 역할·세션 만료·권한별 전 시나리오와 운영 환경은 미검증이다.

## 분모와 잔여 범위

- 코드에서 발견한 renderer 그룹477개, v1로 전환한 세 모듈의 renderer 그룹9개, 기존 _mhead 공통 생성 경로69그룹. 이 숫자는 전체 상호작용 UI 항목의 완성된 분모가 아니다.
- 실제 확인한 화면4개/renderer 연결7개. 나머지470그룹은 해당 사례 기준 실화면 미확인이다. 9개 전환과69개 호환 연결을 전체 화면 전환으로 합산하지 않는다.
- baseline7122개는 임시 미전환/기하 선언 감시 목록이며 승인된 영구 디자인 예외의 개수가 아니다. 영구 예외 검토·승인 목록은 아직 완성하지 않았다.
- 일반 편집·확인·관리, 고객/사업/판매 분석, 일정·홍보/제작, 인증 외곽의 화면별 전환과 전체 진입점 목록 확정이 남아 있다. 제한 역할/오류/재시도/지연/유실/전 상태의 필수 사례 분모도 아직 확정하지 않았다.
- 따라서 전체 필수 사례 통과·미실행 수나 미확인0을 보고하지 않는다. 위 표의 독립적으로 고정한 사례에만 PASS를 적용한다.

## 증거

로컬 workspace ui-system/: local-verification.json, final-layout-verification.json, breakpoint-verification.json, token-reference-verification.json, installer-verification.json, runtime-sales.json, runtime-group.json, runtime-member.json, runtime-settings.json, miso-sales-applied.png, miso-group-applied.png, miso-member-applied.png.

실제 개발 DB의 회원 행·인증정보를 이 문서에 넣지 않았다. 검증 기록 문서 변경은 별도 완료 Python 패치로 설치한다.
