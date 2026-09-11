import { useLayoutEffect, useMemo, useRef, useState } from "react";
import "./YeulmaruNav.css";

/* ── 정본 nav — 운영자 1679px 실측값 ──────────────────────────────────
   · 배경 --accent (#4A4DE7) · 높이 56px · sticky
   · 좌: 월 피커 ‹ 7 2026 ›       · 중앙: 메뉴 7개 + 호버 pill
   · 우: 프레즌스 아바타 뱃지(.pres-ava.live + .pres-dot)
   · "Avery Foster 07920" 텍스트 = 정본에 없음 → 제거
   · 서브 보유 메뉴 4개 (서브 1·3·3·8개) — 호버 드롭다운
   · 미구현 메뉴 클릭 = 조용히 무시 (토스트·콘솔 경고 0)
   ──────────────────────────────────────────────────────────────────── */

export type Nav3 = "performance" | "calendar" | "programs";

/* 정본 원문 메뉴 — 한 글자도 안 바꿈. 가운뎃점·번호까지 그대로 */
type MenuRow = {
  /** 라벨 = 정본 그대로 */
  label: string;
  /** 서브 (있으면 = 정본 순서·문구 그대로) */
  sub?: string[];
  /** 클릭 시 라우팅. 없음 = no-op (조용히 무시) */
  route?: Nav3;
};

const MENUS: MenuRow[] = [
  { label: "대시보드", route: "performance" },
  { label: "캘린더", route: "calendar" },
  {
    label: "상품 등록·변경",
    sub: ["상품 등록 및 변경"],
    route: "programs",
  },
  {
    label: "홍보 신청·확인",
    sub: ["홍보 일괄 신청기본", "온라인 홍보 현황", "오프라인 홍보 현황"],
  },
  {
    label: "사업 실적",
    sub: ["판매 실적 조회", "연간 실적 분석", "연간 일정"],
    route: "performance",
  },
  { label: "사업 현황" },
  {
    label: "콘텐츠 제작",
    sub: [
      "네이버 블로그",
      "링크 자료수집",
      "누끼따기",
      "1. 영상 편집",
      "2. 자막 삽입",
      "3. 영상 프롬프팅",
      "도화지",
      "에니어그램",
    ],
  },
];

type Props = {
  active: Nav3;
  onNavigate: (n: Nav3) => void;
  /** 캘린더 ↔ nav 양방향 동기 */
  calMonth: { year: number; month: number };
  onCalMonthChange: (m: { year: number; month: number }) => void;
  /** 동시접속자 수 (pres-dot 숫자) — 운영자 실측 동적값 자리 */
  presenceCount?: number;
};

export function YeulmaruNav({
  active,
  onNavigate,
  calMonth,
  onCalMonthChange,
  presenceCount: _presenceCount = 3,
}: Props) {
  /* 호버 pill = .nav-hover-bg (정본 그대로) — 버튼 위치·폭에 맞춰 이동 */
  const centerRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [openSubIdx, setOpenSubIdx] = useState<number | null>(null);
  /* §1.JS — ≤768 햄버거 시트 토글 */
  const [mobileOpen, setMobileOpen] = useState(false);

  useLayoutEffect(() => {
    const root = centerRef.current;
    const pill = pillRef.current;
    if (!root || !pill) return;
    if (hoverIdx == null) {
      pill.style.opacity = "0";
      return;
    }
    const btn = root.querySelectorAll<HTMLButtonElement>(".nav-btn")[hoverIdx];
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const cr = root.getBoundingClientRect();
    pill.style.opacity = "1";
    pill.style.left = `${r.left - cr.left}px`;
    pill.style.top = `${r.top - cr.top}px`;
    pill.style.width = `${r.width}px`;
    pill.style.height = `${r.height}px`;
  }, [hoverIdx, openSubIdx]);

  /* Active 메뉴 인덱스 (= .on 부착 대상) */
  const activeIdx = useMemo(() => {
    if (active === "performance") return 0;
    if (active === "calendar") return 1;
    if (active === "programs") return 2;
    return -1;
  }, [active]);

  /* 대시보드(사업 실적) view = biz-mode → 월 피커 `.82` 흐림 + 클릭 무시 + button disabled */
  const isBizMode = active === "performance";

  /* 월 피커 */
  const stepMonth = (delta: number) => {
    const d = new Date(Date.UTC(calMonth.year, calMonth.month - 1 + delta, 1));
    onCalMonthChange({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  };

  function onMenuClick(idx: number) {
    const m = MENUS[idx];
    if (!m) return;
    setOpenSubIdx(null);
    if (m.route) onNavigate(m.route);
    /* route 없는 메뉴 = 조용히 무시 (토스트·콘솔 경고 0) */
  }

  function onSubClick(idx: number) {
    /* 서브 클릭 — 부모 route 와 같은 라우팅 따름. route 없으면 무시 */
    setOpenSubIdx(null);
    const m = MENUS[idx];
    if (!m?.route) return;
    onNavigate(m.route);
  }

  return (
    <nav className="nav" role="navigation" aria-label="주 네비게이션">
      {/* ── §1.JS ≤768 햄버거 — display:none 기본, ≤768에서 inline-flex · 클릭시 mobileOpen 토글 ── */}
      <button
        type="button"
        className={"hamburger" + (mobileOpen ? " is-open" : "")}
        aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((v) => !v)}
      >
        <span className="hamburger-ico" aria-hidden="true">
          <span />
          <span />
        </span>
      </button>
      {/* ── 좌측: 텍스트 로고("GS Caltex" / "YEULMARU") + 월 피커 ═ */}
      <div className="nav-left">
        {/* ── 텍스트 로고 — 운영자 260730 v29: 2-line GS Caltex / YEULMARU, 흰색, 34px ── */}
        <div
          className="nav-logo"
          aria-label="GS Caltex YEULMARU"
        >
          <span className="nl-line1">
            <b>GS</b> <span className="nl-caltex">Caltex</span>
          </span>
          <span className="nl-line2">YEULMARU</span>
        </div>
        <div className="month-nav nav-mnav">
          <button
            type="button"
            className="arrow"
            aria-label="이전 달"
            disabled={isBizMode}
            onClick={() => stepMonth(-1)}
          >
            ‹
          </button>
          <div>
            <span className="month-text" aria-live="polite">
              {calMonth.month}
            </span>
            <span className="year-text">{calMonth.year}</span>
          </div>
          <button
            type="button"
            className="arrow"
            aria-label="다음 달"
            disabled={isBizMode}
            onClick={() => stepMonth(1)}
          >
            ›
          </button>
        </div>
      </div>

      {/* ── 중앙: 메뉴 7개 ── */}
      <div className="nav-center" ref={centerRef} data-mobile-open={mobileOpen ? "1" : undefined}>
        <div
          className="nav-hover-bg"
          ref={pillRef}
          aria-hidden="true"
        />
        {MENUS.map((m, idx) => {
          const isActive = idx === activeIdx;
          const isOpen = openSubIdx === idx;
          return (
            <div
              key={m.label}
              className="nav-dd-host"
              style={{ position: "relative" }}
              onMouseEnter={() => {
                setHoverIdx(idx);
                if (m.sub?.length) setOpenSubIdx(idx);
              }}
              onMouseLeave={() => {
                if (openSubIdx === idx) setOpenSubIdx(null);
                setHoverIdx((cur) => (cur === idx ? null : cur));
              }}
            >
              <button
                type="button"
                className={`nav-btn ${isActive ? "on" : ""}`}
                aria-expanded={m.sub?.length ? isOpen : undefined}
                data-menu-id={m.label}
                onClick={() => onMenuClick(idx)}
              >
                {m.label}
              </button>

              {m.sub?.length && isOpen && (
                <div
                  className="dd-menu"
                  role="menu"
                  aria-label={`${m.label} 하위 메뉴`}
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    minWidth: 200,
                    background: "rgba(255,255,255,0.96)",
                    backdropFilter: "blur(11px) saturate(150%)",
                    WebkitBackdropFilter: "blur(11px) saturate(150%)",
                    border: "1px solid rgba(0,0,0,0.06)",
                    borderRadius: 14,
                    boxShadow: "0 14px 38px rgba(74,77,231,0.18), 0 2px 8px rgba(0,0,0,0.08)",
                    padding: "8px 0",
                    zIndex: 100000,
                  }}
                >
                  {m.sub.map((label, j) => (
                    <button
                      key={`${label}-${j}`}
                      type="button"
                      role="menuitem"
                      className="dd-pill is-visible"
                      data-sub-id={label}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSubClick(idx);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 18px",
                        background: "transparent",
                        border: "none",
                        color: "var(--accent)",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontSize: 13.5,
                        fontWeight: 600,
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(74,77,231,0.06)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <span className="dd-pill" aria-hidden="true" style={{ display: "none" }}>
                        ·
                      </span>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 우측: 메시지함 → 이름 → 역할태그 → 아바타(관리자) → 메모 버튼 → 톱니(관리자) ── */}
      <div className="nav-right">
        {/* ① 메시지함 — 봉투 아이콘 + 배지(메시지 0 = display:none) */}
        <button
          type="button"
          className="msgbox-btn"
          title="메시지함"
          aria-label="메시지함"
        >
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <span
            className="msgbox-count"
            aria-hidden="true"
            style={{ display: "none" }}
          >
            0
          </span>
        </button>

        {/* ② 사용자 이름(spans.welcome-msg) */}
        <span
          className="welcome-msg"
          title="계정 메뉴 (설정·로그아웃)"
        >
          관리자
        </span>

        {/* ③ 역할 태그 — 기본 display:none */}
        <span
          className="role-tag admin"
          style={{ display: "none" }}
        >
          ADMIN
        </span>

        {/* ④ 접속자 아바타(관리자만) */}
        <span
          className="role-tag admin"
          style={{ display: "inline-block" }}
        >
          관리자
        </span>

        {/* ⑤ 메모 버튼 — 전원 상시 노출 */}
        <button
          type="button"
          className="icon-btn"
          title="내 일정 메모"
          aria-label="내 일정 메모"
        >
          <svg
            width={17}
            height={17}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        {/* ⑥ 톱니(관리자만) — 관리자 세션이라 노출 */}
        <button
          type="button"
          className="icon-btn"
          title="관리"
          aria-label="관리"
        >
          <svg
            width={17}
            height={17}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx={12} cy={12} r={3} />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
