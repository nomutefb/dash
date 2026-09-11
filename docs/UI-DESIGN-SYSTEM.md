# 예울마루 UI 정본 — v1 / 2026-09-08

사용자 승인: 디자인 기틀 통합 지시안을 미소 개발본에 반영. 발행 금지. 이 규약은 UI 표현만 다루며 저장/API/권한/회원 원본/개인·단체 실적 계산을 바꾸지 않는다.

## 참조 경로

`public/ym-ui-tokens.css` → `public/ym-ui-components.css`, `public/ym-ui-components.js` → 화면의 `data-ui-contract="v1"`/등록 variant → 실제 조작 항목.

기존 `_mhead(title, sub, extra)`는 `YMUI.head(title, sub, extra)`로 위임한다. 제목과 부제는 escape한다. `extra`는 기존 애플리케이션이 만든 신뢰된 버튼 마크업만 허용한다. 사용자 입력을 `extra`에 직접 전달하지 않는다. 새 모달 제목은 `YMUI.head(title, null, null, titleId)`로 만들고 `aria-labelledby`를 연결한다. 독립 복제 생성 함수나 h2 기반 새 창틀을 만들지 않는다.

순수 classic script를 유지한다. 견본 페이지는 실제 공통 CSS/JS만 불러오고 인증·업무 API·수집·폴링을 시작하지 않는다. 세 자산의 버전은 동시에 변경한다. CSS는 기존 공통 선언을 이관한 호환 구역 다음에 v1 스코프를 둔다. `data-ui-contract`가 없는 기존 셸은 호환 규칙으로 관리하며 기존 모달 전체 전환 완료로 보지 않는다.

## 역할과 표준 변형

- `data-ui-size`: small 400px, form 640px, multi 900px, analysis 1200px의 rem 기준. 실제 너비는 viewport와 여백으로 제한된다.
- `.ym-ui-overlay` / `.ym-ui-dialog[data-ui-contract="v1"]` / `.mhead` / `.ym-ui-body` / `.ym-ui-footer`를 조합한다. body만 스크롤하며 짧은 화면에서는 셸 단일 스크롤로 전환한다.
- `.ym-ui-button`의 `data-ui-tone`: primary, danger, ghost, 생략(중립 보조). 한 액션 묶음의 primary는 하나. `data-ui-density="compact"`는 도구막대만 사용한다.
- 버튼·입력의 min-height는 기본40px/좁은 화면44px, 제목16px/700, 본문14px/400, 버튼·라벨13px/600, 보조12px/400이다. 임의의 650/750/800 굵기와 화면별 자간을 만들지 않는다.
- `.ym-ui-meta`, `.ym-ui-message`, `.ym-ui-error`, `.ym-ui-card`, `.ym-ui-steps`를 사용한다. `.ym-ui-table`은 숫자를 `.ym-ui-number`로 오른쪽 정렬한다. compact는12px, 기본13px이다.
- 모달 mount 전에 기존 활성 요소를 확보한다. `YMUI.mount(root, existingClose, returnFocus)` 호출 후 기존 초기 초점을 지정한다. 제거 시 `YMUI.release(root)`를 먼저 호출한다. 기존 close 함수가 busy/미저장 정책을 계속 소유한다. 최상위 모달만 Tab/Escape를 처리하고 배경 inert 상태는 원래 값으로 복원한다.
- readonly는 복사 가능한 읽기 전용이고 disabled와 다르다. 실제 저장 데이터를 철회하는 '입력 취소'만 danger로 표시한다. 일반 창 닫기·미저장 취소·편집기 undo는 자동 위험 처리하지 않는다.

## 보존 결정

회원 완료 본문은 ‘갱신이 완료된 상태입니다.’와 ‘최근 반영: 날짜·시간’ 두 줄이다. 회원 수 카드·100% 완료 막대를 복구하지 않는다. 수신100%는 DB 반영 완료와 구분한다.

기존 accent #4A4DE7, 종료/현황 의미, 차트의 수치/단위, 프로그램ID/사업코드 연결, 고객 마스킹, PIN 두 번 입력과 반투명 흰 입력, 콘텐츠 산출물 폰트·이미지·출력 치수는 보존한다. 원문 토큰의 호환 별칭과 신규 의미 토큰을 구분한다. 카드/영상/문서/로고 제작물 자체를 UI 타이포로 덮지 않는다.

## 검사와 기준선

`python3 tools/check_ui_contract.py`는 읽기 전용으로 실행한다. JS는 Acorn, HTML은 parse5, CSS는 PostCSS로 분석한다. CSS/인라인 style/문자열 템플릿/element.style/cssText/setAttribute/style sheet API를 검사한다. 값 계산이 정적으로 해석되지 않는 스타일 생성은 내용 지문으로 별도 추적한다. 이름 색상과 축약 선언도 원문 선언 기준으로 추적한다.

`tools/ui-contract-baseline.json`은 초기 이관 시의 경로·소유 함수·selector·속성·정규화 선언 지문·중복 개수로 고정한다. 새 위반, 기존 지문 복제, 미등록 renderer, 새 public UI 파일은 실패한다. 자동 기준선 갱신 명령은 제공하지 않는다. 전환한 세 모듈에 style 주입·인라인 스타일이 다시 생기면 별도 실패한다. 현재 남은 호환 선언은 제거할 때마다 기준선에서 삭제한다. 알 수 없는 새 스타일 생성 경로를 통과시키기 위해 baseline에 추가하지 않는다.

초기 기준선과 registry는 자동 수집 초안을 Codex가 동결한 변경 감시 자료다. 코드 내 UI 생성 위치는 식별하지만 실제 진입 경로·사용 여부·권한별 조합을 모두 증명하지 않는다. JS 문자열 이어붙임·동적 경로·외부 iframe 내부는 정적 전수 증명 대상에서 한계가 있으며, `UI-SCREEN-MATRIX.md`의 미확인 항목을 실화면으로 해소해야 한다. 데이터 파일·정적 회원 명부·미사용 React src는 이번 로드 그래프 조사에서 UI 소스로 읽지 않았다. 이것을 앱 전체 누락 없음으로 표현하지 않는다.

## 적용 및 검증 상태

공통 기틀과 첫 전환 묶음: 회원 갱신, 판매 갱신, 단체 입력, 수집 설정. 기존 창틀 호출 경로와 공통 모달/버튼 CSS는 호환 연결한다. 전체 renderer 조사 초안은 matrix에 있고, 모든 세부 항목·권한·오류·모바일 전면형·보조 기능 전환은 미완료다.

모의 검증, 개발 실제 화면, 운영 검증을 분리한다. 현재 프로그램 데이터로 저장/삭제/전송/수집을 실행하는 시험을 시각 확인에 포함하지 않는다. 소스 버전과 실제 로드 자산 버전, 필수 사례 통과/실패/미실행을 기록한다. 배포·발행은 별도 사용자 요청 없이는 수행하지 않는다.

## v545 개발 실제 확인

네 화면의 개발 admin 사례 검증을 완료했다. 실제 진입점과 제한은 `UI-SCREEN-MATRIX.md` 및 `UI-VERIFICATION-260908.md`에 기록한다. 전체 화면군 이관·전 권한/상태 검증은 미완료다.
