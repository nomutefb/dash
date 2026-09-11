import { useEffect } from "react";
import type { ReactNode } from "react";
import { YeulmaruNav, type Nav3 } from "./YeulmaruNav";

export type Nav = Nav3;

type AppShellProps = {
  active: Nav3;
  onNavigate: (n: Nav3) => void;
  calMonth: { year: number; month: number };
  onCalMonthChange: (m: { year: number; month: number }) => void;
  children: ReactNode;
};

export function AppShell({
  active,
  onNavigate,
  calMonth,
  onCalMonthChange,
  children,
}: AppShellProps) {
  /* §1.JS — ① innerWidth≤1200 캐러셀/레일 sentinel, ② bizFitViewport()
     "폭 기준 아님"(세로 넘침 차트 높이 조정 — 폭 미디어쿼리 교체 아님) */
  useEffect(() => {
    /* ① 1200px sentinel : resize 시 #sales-rail data-state 갱신
       — active="performance"일 때만 innerWidth<=1200이면 데이터 fetch/캐러셀 일시정지 */
    function onResize() {
      if (typeof window === "undefined") return;
      const w = window.innerWidth;
      const rail = document.getElementById("sales-rail");
      if (rail) {
        rail.dataset.state = w <= 1200 ? "compact" : "full";
      }
      if (active === "performance" && w <= 1200) {
        document.documentElement.dataset.railPaused = "1";
      } else {
        document.documentElement.dataset.railPaused = "";
      }
    }
    onResize();
    window.addEventListener("resize", onResize);
    /* ② bizFitViewport — biz 모드에서 차트 높이 180~560px 조절 */
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        if (active !== "performance") return;
        const app = document.getElementById("app");
        const main = document.getElementById("main-area");
        if (!app || !main) return;
        const overflow = main.scrollHeight - main.clientHeight;
        if (overflow > 0) {
          app.classList.add("biz-fit");
        } else {
          app.classList.remove("biz-fit");
        }
      });
      const main = document.getElementById("main-area");
      if (main) ro.observe(main);
    }
    return () => {
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, [active]);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <YeulmaruNav
        active={active}
        onNavigate={onNavigate}
        calMonth={calMonth}
        onCalMonthChange={onCalMonthChange}
      />
      {/* §1 정본 — body-wrap은 자식 뷰(PerformanceView / CalendarView / ProgramsView) 자체 렌더.
         AppShell은 nav 만 마운트, 그 아레 자식 그대로 흐르게 함 (정의 안에서 padding을 잡지 않음). */}
      <div style={{ flex: 1, background: "var(--content-canvas)" }}>{children}</div>
    </div>
  );
}
