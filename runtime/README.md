# 로컬 이관 검증

현재 MISO 개발 미리보기의 화면과 동작을 이관본에서 재현하는 것이 완료 기준이다. 정적 파일 검사, 데이터 가져오기, 실제 앱 동작 검증을 구분한다.

`prepare-local.mjs`는 기존 가명 이전 데이터만 사용해 별도 PocketBase DB 가져오기 마이그레이션을 만든다. MISO에 요청하지 않으며 원본 DB를 변경하지 않는다. 원본 컬렉션의 모든 규칙과 인덱스가 확보된 것은 아니므로 검증 DB의 직접 조회·쓰기 권한은 잠근다. 로그인·수집기·AI·예약 작업을 자동으로 활성화하지 않는다.

PocketBase 버전은 기존 api/README.md에서 확인한 0.31 계열에 맞춰 공식 v0.31.0 배포본으로 고정했다. ZIP SHA-256: `a63af6376534d8af8565e559cb8899f2d6dfaae35d8ca48410231a04f8f05220`. 로컬 바이너리와 DB는 `runtime/.local/`에 보관하며 Git에 포함하지 않는다.

자료: [공식 배포본](https://github.com/pocketbase/pocketbase/releases/tag/v0.31.0), [마이그레이션 문서](https://pocketbase.io/docs/js-migrations/). 온라인 최신 문서는 버전이 다를 수 있으므로 실제 0.31 바이너리와 생성된 타입을 함께 확인한다.

실행 순서:

1. Node로 `runtime/prepare-local.mjs` 실행.
2. 공식 PocketBase 바이너리에서 `migrate up`을 실행하되 `--dir runtime/.local/pb_data --migrationsDir runtime/.local/import-migrations --hooksDir runtime/.local/empty-hooks`를 지정.
3. `runtime/verify-local-db.mjs`로 전체 행의 ID·컬럼·JSON 값과 행수 및 잠긴 CRUD 규칙을 다시 대조.

이 검사가 통과해도 앱 이관 완료가 아니다. 동일한 환경에서 인증, 메뉴, 필터, 차트, 상세 복귀, 저장 후 재조회, 재시작 후 유지, 판매·회원 수집, AI, 파일 연동, 자동 실행과 오류 처리를 각각 검증해야 한다.
