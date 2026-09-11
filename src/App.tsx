import type { CSSProperties } from "react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { PinGate } from "@/components/gate/PinGate";
import { AppShell, type Nav } from "@/components/layout/AppShell";
import { CalendarView } from "@/components/calendar/CalendarView";
import { ProgramsView } from "@/components/programs/ProgramsView";
import { PerformanceView } from "@/components/performance/PerformanceView";
import bgPhotoUrl from "@/assets/bg-yeulmaru.webp";

const PIN = "REQUIRES_LOCAL_CONFIGURATION";

function App() {
  const devUnlock =
    typeof window !== "undefined" &&
    (window.location.hash.includes("dev") ||
      window.location.search.includes("dev"));
  const [unlocked, setUnlocked] = useState(devUnlock);
  const [nav, setNav] = useState<Nav>("performance");
  /* 상단 nav 월 피커 = 캘린더 동기 — 기본 7월 2026 (정본 ‹ 7 2026 ›) */
  const [calMonth, setCalMonth] = useState<{ year: number; month: number }>({
    year: 2026,
    month: 7,
  });

/* 사진 슬롯 — 고정 빈 레이어(추후 전경 사진 삽입용), PIN 게이트 위/아래 모두 항상 마운트.
     v37-1차: bgPhoto 위치 #bg-photo(형제)→ 변수가 #body-wrap까지 cascade 안 됨, 폴백. v38-픽스:
     --bg-photo-url을 #bg-photo가 아니라 #app 부착 → #app은 #body-wrap의 직접 조상이므로 inline ::before까지 inherit. */
  const bgPhoto = <div id="bg-photo" aria-hidden="true" />;

  /* 채팅 FAB — 우하단 고정. document.body 직속 포털로 마운트하여 어떤 React 친족 트리/포함 블록 영향을 우회.
     PIN 게이트 위/아래 모두 항상 마운트 (클릭 비워 둠) */
  const cbFab = (
    <button
      type="button"
      id="cb-fab"
      className="cb-fab"
      title="예울이"
      aria-label="예울이"
    >
      <svg
        width={26}
        height={26}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    </button>
  );

  /* SSR/early-mount 가드: window 없으면 빈 노드, 있으면 document.body에 토탈로 전송 */
  const cbFabPortal =
    typeof document !== "undefined"
      ? createPortal(cbFab, document.body)
      : null;

  if (!unlocked) {
    return (
      <>
        {bgPhoto}
        <PinGate expectedPin={PIN} onSuccess={() => setUnlocked(true)} />
      </>
    );
  }

  /* 월 피커 흐림 + 클릭 무시 = 대시보드(사업 실적) view에서만.
     캘린더/프로그램 화면 = 정상 활성(.cal-mode/.prog-mode 일명) */
  const appMode = nav === "performance" ? "biz-mode" : nav === "calendar" ? "cal-mode" : "prog-mode";

  return (
    <>
      {bgPhoto}
      <div id="app" className={appMode} style={{ "--bg-photo-url": `url(${bgPhotoUrl})` } as CSSProperties}>
        <AppShell
          active={nav}
          onNavigate={setNav}
          calMonth={calMonth}
          onCalMonthChange={setCalMonth}
        >
          {nav === "performance" && <PerformanceView />}
          {nav === "calendar" && (
            <CalendarView
              currentMonth={calMonth}
              onMonthChange={setCalMonth}
            />
          )}
          {nav === "programs" && <ProgramsView />}
        </AppShell>
      </div>
      {cbFabPortal}
    </>
  );
}

export default App;
