# MISO 동일 동작 연결 조사 — 2026-09-11

## 현재 확인 상태

사용자는 GitHub 이전본에 로그인·데이터·외부 기능을 연결해 MISO와 동일하게 동작하도록 요청했다. 실제 MISO 편집기를 열었지만 사내망 접속 제한 화면이 표시되어 현재 Code/Database Workbench는 읽지 못했다. 네트워크 제한을 우회하지 않았다.

이 문서의 구조는 로컬 이전본에서 확인한 내용이다. 현재 MISO와의 동등성이나 외부 서버 연결 완료를 의미하지 않는다. 상세 목록은 `runtime-readiness.json`, 재생성 명령은 `node tools/export/inspect-runtime.mjs`다. 이 도구는 파일을 읽을 뿐 서버를 시작하거나 DB를 변경하지 않는다.

## 확인한 실행 경로

```text
브라우저 standalone.html
  -> MISO의 같은 출처 인증/경로 처리
  -> /__runtime/api/* 또는 /site/<code>/__runtime/api/*
  -> PocketBase의 api/*.pb.js 훅
  -> ymdata / ymmeta 또는 ymdata_dev / ymmeta_dev
  -> 플랫폼 runtime proxy -> 외부 API / Session Manager의 LLM

별도 티켓링크·회원 수집기
  -> 서명/수집기 인증을 거친 전용 API
  -> 스테이징과 커밋 -> 수집 상태·실적·회원 데이터
```

정적 검사에서 훅 파일 20개, 문자열로 선언된 라우트 99개, cron 선언 6개, 저장된 스키마 8개를 찾았다. 동적 등록과 실제 서버 동작까지 검사한 수치는 아니다.

## 기능별 연결 항목

| 기능 | 로컬 근거 | 필요한 구성과 검증 |
|---|---|---|
| 화면과 자산 | public/standalone.html 및 공통 UI 모듈 | 별도 백엔드와 같은 출처에서 제공하고 실제 메뉴·반응형·복귀 상태 검증 |
| 로그인과 권한 | api/ym-auth-lib.js, public/ym-auth-ui.js | 플랫폼 앞단 인증 계약 확인, 서버가 환경을 결정하도록 구성, 이메일/PIN·역할별 쓰기 제한 검증 |
| 사업·판매·회원 DB | data/database, api/ym-db.pb.js | PocketBase 컬렉션 정의·규칙·인덱스·가명 데이터 복구, 행·키·금액·연결 대조 |
| 초기 설정과 인증값 | private.example.js 파일 | 실제 값은 사용자 전용 설정으로 입력, 비밀번호·키를 Git이나 로그에 저장하지 않음 |
| 티켓링크·회원 수집 | ym-ticketlink, ym-member-sync, ym-local-relay | 수집기 실행 환경과 별도 키, 서명·유효시간·중복 방지·스테이징 커밋 검증 |
| AI 기능 | miso-llm-adapter.pb.js, miso-llm-bridge.pb.js | MISO 내부 Session Manager/등록 모델 의존성을 공식 지원 연결로 해결 |
| 검색·휴일 등 외부 API | api/KEYS.md, ym-cron-lib.js | 지원되는 외부 요청 중계와 비밀 설정, 각 응답과 실패 처리 확인 |
| 예약 실행 | ym-crons.pb.js 등 | 서버 상시 실행·영속 저장소·시간대·중복 실행 방지 확인 |

## 현재 서버 공개를 막는 조건

- GitHub Pages에는 이 앱의 PocketBase 서버가 없다.
- `_runtime_proxy.js`, `_runtime_env.js`, 실제 인증/수집기 private 파일은 의도적으로 이전되지 않았다.
- 현재 세션 guard는 dev 요청에만 적용된다. 환경은 X-Ym-Env/Referer를 사용하며 그 외는 운영 컬렉션 경로다. MISO 앞단 인증 없이 이 훅을 그대로 인터넷에 노출하면 동일한 권한 보호가 보장되지 않는다.
- 개발 preview-entry는 특정 MISO 출처와 경로에 한정돼 있다. 외부 사이트가 이를 흉내 내거나 인증 헤더·Referer를 조작하도록 만들지 않는다.
- schema.json은 컬럼 조사 자료이며 PocketBase 컬렉션 API 규칙/인증 레코드를 완전히 복원하는 정의로 검증되지 않았다.
- 훅 변경 전 확인해야 할 `.miso/skills/miso-coder-platform/SKILL.md`가 로컬 이전본에 없다. MISO 접속 복구 후 현재 공식 실행 계약과 함께 확인해야 한다.

## 이어서 수행할 순서

1. 사용자가 허용된 사내망/회사 VPN에 연결하면 MISO Code와 Database Workbench를 읽고 현재 실행 계약·DB 정의·인증/외부 연결 설정의 존재 여부를 확인한다. 비밀 값은 출력하지 않는다.
2. 원본 운영 DB와 분리된 환경에 영속 PocketBase 서버와 인증 게이트웨이를 준비한다. 기존 가명 이전 데이터를 사용하며 원본에 덮어쓰지 않는다.
3. 미인증 요청 거부, 개발/운영 구분, 역할별 조회·저장 제한을 확인한 뒤 화면·DB CRUD·수집·AI·예약 실행을 순서대로 연결한다.
4. 브라우저에서 로그인부터 메뉴 이동·조회·저장·재조회까지 검사하고 합계/행수/키를 대조한다.
5. 검증된 서버 주소로 미리보기 링크를 전환한다. 사내망 접근 제한과 서버 호스팅/실제 로그인 설정이 해결되기 전에는 완료로 표시하지 않는다.

이번 조사에서는 원본 MISO, 운영 DB, 기존 GitHub Pages의 인증을 변경하지 않았다.
