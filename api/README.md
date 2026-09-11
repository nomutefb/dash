# Backend API (PocketBase Hooks)

PocketBase Hooks를 사용한 서버사이드 로직을 이 디렉토리에 작성합니다.

## 규칙
- 파일 확장자: `*.pb.js` (Go Goja ES5 런타임)
- CommonJS만 지원 (import/export 불가)
- npm 패키지 사용 불가, async/await 불가
- 외부 HTTP 호출: runtime proxy helper 사용 (`$http.send()` 직접 사용 금지 — 플랫폼 proxy/SSRF/header 정책 우회)
- proxyFetch()는 import 대상이 아닙니다. `api/_runtime_proxy.js`를 수정/삭제하지 말고 handler 안에서 ``require(`${__hooks}/_runtime_proxy.js`)``로 불러와 사용하세요.
- JSON/text body와 FormData 업로드는 `proxyFetch()`로 처리하세요.
- `_runtime_proxy.js`: 플랫폼 관리 파일 — 수정/삭제 금지
- 앱 환경변수: handler 안에서 ``require(`${__hooks}/_runtime_env.js`)``로 읽으세요. 시크릿 값은 placeholder이며 `proxyFetch` 경유 외부호출에서만 실제 값으로 치환됩니다. `$os.getenv()`로는 앱 env를 못 읽습니다.
- `_runtime_env.js`: 플랫폼 관리 파일 — 수정/삭제 금지
- Custom route auth middleware는 PocketBase 0.31 기준 `$apis.requireGuestOnly()`, `$apis.requireAuth()`, `$apis.requireSuperuserAuth()`만 사용하세요. `$apis.requireGuestAuth()`는 존재하지 않아 hook load 실패를 일으킵니다.

자세한 작성법은 MUST read `.miso/skills/miso-coder-platform/SKILL.md` before making PocketBase hook changes or giving implementation steps. PocketBase runtime guidance lives under `miso-coder-platform` references and recipes.
