# 다음 세션 인수인계

## 현재 상태

최신 요청은 “MISO와 동일하게 로그인·DB·외부 기능을 모두 연결”하는 것이다. 실제 MISO 편집기는 현재 사내망 제한 화면이라 Code/Database Workbench에 접근하지 못했다. 사용자의 허용된 사내망/VPN 연결을 기다리고 있다. 로컬 구조 조사와 다음 연결 순서는 migration/RUNTIME-CONNECTION.md 및 runtime-readiness.json을 읽는다. 외부 서버 연결은 아직 완료하지 않았으며 미리보기 링크도 로그인 화면 상태다.

작업 폴더는 이 HANDOFF.md가 있는 dash 저장소다. 원격은 https://github.com/nomutefb/dash.git 이다.

2026-09-11에 이전 세션의 오치환 복구를 재검토하고 manifest를 제한적으로 갱신했다. 자유서술형 직원 이름 누락도 기존 가명으로 맞췄다. 정확한 결과와 미검증 범위는 migration/FINAL-AUDIT.md와 README.md를 먼저 읽는다.

## 검증

- DB 70,014행, 회원 30,477행, 예매 40,429행, 연결 23,063개, 샤드 22,630행 유지.
- 구조화 데이터의 행·키·수치 401,356개 유지. 변경은 가명과 미지정 표시 문자열뿐이다.
- 파일 해시, JS와 HTML 인라인 구문 통과. 정적 참조 193개 중 184개 해결.
- 직원 이름 잔존 검사는 공개 공연명/테스트 표현을 제외해 추가 수정 대상 0개. 모든 자유서술 개인정보의 완전한 제거를 보증하는 검사는 아니다.

## GitHub 업로드

사용자는 이전본 GitHub 업로드를 승인했다. 초기 PC Git의 muteno 인증은 403이었지만 공식 브라우저 로그인으로 nomutefb 인증을 완료했고 push dry-run도 통과했다. 이 저장소의 credential username은 nomutefb로 지정한다. 비밀번호/토큰을 대화로 받거나 출력하지 않는다. 원격 최신 SHA를 확인한 뒤 일반 push하며 최종 로컬/원격 SHA 일치를 확인한다.

업로드용 codex/sanitized-import-20260911 브랜치를 사용한다. 원본 이름이 남은 b26d227을 부모로 포함하지 않고, 원격 초기 README 커밋 5d231f4의 자식으로 정리된 파일만 담는다. 이전 로컬 main과 codex/previous-dash-main-20260910210320 백업은 보존한다. main 전체나 백업 브랜치를 --all로 push하지 않는다. 강제 push하지 않는다.

## 실행 제한

웹 미리보기는 https://nomutefb.github.io/dash/ 이다. GitHub Pages의 게시 원본을 gh-pages / (root)로 설정했다. public/index.html은 미연결 상태 안내와 standalone.html 로그인 화면을 보여 주며 인증을 건너뛰지 않는다. public/.nojekyll도 추가했다. gh-pages는 public 트리만 담은 독립 커밋이므로 전체 저장소를 게시하지 않는다. main 변경 시 public 트리를 새 커밋으로 만들되 원격 gh-pages를 부모로 연결해 일반 push한다. 강제 push하지 않는다.

원본 MISO는 수정하지 않았다. src/main.tsx는 과거 MISO 파일 조회에서 403이었다. 플랫폼 _runtime_proxy.js/_runtime_env.js, 실제 인증 설정, PocketBase 구성과 데이터 가져오기는 별도다. 인증을 우회하지 않는다.

로그인 이후 전체 UI/CRUD, DB 재가져오기, 외부 수집기, Microsoft 로그인/PWA 설치는 끝까지 검증하지 않았다. 원격 해시/코드 구조 비교는 과거 캡처이며 이번 세션에서 최신 MISO 전체를 다시 읽은 결과가 아니다.

검증 명령:

    node tools/export/verify-export.mjs
    node tools/export/verify-references.mjs

부모 audit-work 폴더의 로컬 진단 파일은 업로드 대상이 아니다. 부모 폴더에서 git add하지 않는다. 대응표/원본 개인정보/인증값을 저장하거나 커밋하지 않는다.
