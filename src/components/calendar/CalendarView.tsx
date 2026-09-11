import { useMemo, useState } from "react";
import { records, special, isVisibleStatus } from "@/data";
import { DetailModal } from "@/components/common/DetailModal";

const CAL_DEFAULT = { year: 2026, month: 6 };

type CalendarViewProps = {
  /**
   * 단일 소스 — 부모(App.tsx)에서 들고 nav 월 피커와 캘린더 내부 ‹›가
   * 같은 상태를 읽고 쓴다(양방향). 미지정 시 stand-alone CAL_DEFAULT 유지(기존 단독 사용 케이스 보존).
   */
  currentMonth?: { year: number; month: number };
  onMonthChange?: (m: { year: number; month: number }) => void;
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
function todayIso(): string {
  return "2026-07-30";
}
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function buildMonthGrid(year: number, month: number): Array<{
  date: string | null;
  day: number | null;
}> {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstDow = first.getUTCDay();
  const dim = daysInMonth(year, month);
  const cells: Array<{ date: string | null; day: number | null }> = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push({ date: null, day: null });
  }
  for (let d = 1; d <= dim; d++) {
    cells.push({
      date: `${year}-${pad2(month)}-${pad2(d)}`,
      day: d,
    });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null });
  return cells;
}

type RecordRow = (typeof records)[number];
type SpecialRow = (typeof special)[number];

function statusClass(s: string): string {
  if (s === "완료") return "ev done";
  if (s === "취소" || s === "반려") return "ev rejected";
  if (s === "보류") return "ev ev-pending";
  if (s === "예정") return "ev ev-approved";
  if (s.includes("신청")) return "ev ev-pending";
  return "ev ev-approved";
}

export function CalendarView({ currentMonth, onMonthChange }: CalendarViewProps = {}) {
  const today = todayIso();
  /* [v38] §1 오늘 요일 → .p-on 강조. 화~일 정배열, 일요일은 .p-sun 안에, 월요일은 .p-mon 안에. */
  const todayDow = ["일","월","화","수","목","금","토"][
    new Date(today).getDay()
  ] ?? "";
  /* 양방향 동기 — currentMonth를 외부 단일 소스로 사용. prop이 없으면 기존 단독 동작 보존. */
  const isControlled = currentMonth != null;
  const [localYear, setLocalYear] = useState<number>(CAL_DEFAULT.year);
  const [localMonth, setLocalMonth] = useState<number>(CAL_DEFAULT.month);
  const year = isControlled ? currentMonth!.year : localYear;
  const month = isControlled ? currentMonth!.month : localMonth;

  const visibleRecords = useMemo(
    () => records.filter((r) => r["날짜"] && isVisibleStatus(r["진행 상태"])),
    [],
  );

  const recordsByDate = useMemo(() => {
    const m = new Map<string, RecordRow[]>();
    for (const r of visibleRecords) {
      const d = r["날짜"];
      if (!d) continue;
      const arr = m.get(d) ?? [];
      arr.push(r);
      m.set(d, arr);
    }
    return m;
  }, [visibleRecords]);

  const specialByDate = useMemo(() => {
    const m = new Map<string, SpecialRow[]>();
    for (const s of special) {
      const d = s["시작일"];
      if (!d) continue;
      const arr = m.get(d) ?? [];
      arr.push(s);
      m.set(d, arr);
    }
    return m;
  }, []);

  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const [modal, setModal] = useState<
    null
    | { kind: "record"; rec: RecordRow }
    | { kind: "special"; entry: SpecialRow }
    | { kind: "day"; date: string }
    | { kind: "view"; recs: RecordRow[]; ix: number }
  >(null);
  const [viewIx, setViewIx] = useState(0);

  function go(delta: number) {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    const ny = d.getUTCFullYear();
    const nm = d.getUTCMonth() + 1;
    if (isControlled) {
      /* controlled — 부모에게 단일 쓰기, 로컬 상태는 손대지 않음 */
      onMonthChange?.({ year: ny, month: nm });
    } else {
      /* stand-alone — 기존 내부 상태 유지 */
      setLocalYear(ny);
      setLocalMonth(nm);
    }
  }

  const monthLabelStr = `${year}년 ${month}월`;
  void monthLabelStr;
  const todayCount = records.filter(
    (r) => r["날짜"] && r["날짜"].startsWith(`${year}-${pad2(month)}`),
  ).length;
  void todayCount;
  const specialCount = special.filter((s) => s["시작일"]?.startsWith(`${year}-${pad2(month)}`)).length;
  void specialCount;

  return (
    /* §1 + §2 정본 — #body-wrap flex container, 캘린더 모드는 full-width (rail 안 띄움 → sales-rail padding-right:0 안 그대로, .cal 6-col화 nominal) */
    <div id="body-wrap" style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 56px)", isolation: "isolate" }}>
    <div id="main-area" style={{ flex: "1 1 100%", padding: "18px 20px 24px 20px" }}>
    <div className="ym-fade-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 헤더 = 정본 .cal-head-wrap — sticky top:56px · blur(11px) · 위 모서리 라운드.
         [v38] 월 타이틀 + 집계(홍보 신청 N건/특별일정 N건) + 상태 색 범례 제거.
         월·연 표기는 상단 nav 월 피커에만 존재; 그 자리는 비운다. */}
      <div
        className="cal-head-wrap"
        style={{
          padding: "0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="ym-btn" onClick={() => go(-1)} aria-label="이전 달" style={{ width: 36, height: 36, padding: 0 }}>
              ‹
            </button>
            <button className="ym-btn" onClick={() => go(1)} aria-label="다음 달" style={{ width: 36, height: 36, padding: 0 }}>
              ›
            </button>
          </div>
        </div>
      </div>

      {/* 본체 = 정본 .cal — blur(7px) · 아래 모서리 라운드 */}
      <div
        className="cal"
        style={{
          padding: 12,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 0,
            marginBottom: 0,
          }}
        >
          {(
            // [v38] §1 정본 — 6열 그리드 · 요일 배열 [화,수,목,금,토,일] + 마지막 칸 분할
            [
              { k: "화", css: "sat" },
              { k: "수", css: "" },
              { k: "목", css: "" },
              { k: "금", css: "" },
              { k: "토", css: "sat" },
              { k: "일", css: "sun dh-split" },
            ] as Array<{ k: string; css: string }>
          ).map((d, i) => (
            <div
              key={d.k}
              data-day={i}
              className={`dh ${d.css}`.trim()}
            >
              {d.k === "일" ? (
                /* dh-split: <i class="p-sun">일</i><i class="p-mon">월</i> (75% / 25%) */
                <>
                  <i className="p-sun">{d.k}</i>
                  <i
                    className={`p-mon${todayDow === "일" ? " p-on" : ""}`}
                  >
                    월
                  </i>
                </>
              ) : (
                <i className={todayDow === d.k ? "p-on" : undefined}>
                  {d.k}
                </i>
              )}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 6,
          }}
        >
          {cells.map((cell, idx) => {
            if (!cell.date) {
              return (
                <div
                  key={idx}
                  className="c ym-day-cell ym-day-empty"
                  aria-hidden="true"
                  style={{ height: 123 }}
                />
              );
            }
            const cellDate = cell.date;
            const isToday = cellDate === today;
            const past = cellDate < today;
            const recordsOnDay = recordsByDate.get(cellDate) ?? [];
            const specialOnDay = specialByDate.get(cellDate) ?? [];
            const dow = ["일","월","화","수","목","금","토"][
              new Date(cellDate).getDay()
            ] ?? "";
            const isSat = dow === "토";
            const isSun = dow === "일";
            /* §2 정본 — .c-count(N/M 형식) 우상단. 완료/전체 카운트.
                완료 = records에서 진행상태가 '완료' 카운트 (없으면 0). */
            const doneCount = recordsOnDay.filter(
              (r) => (r["진행 상태"] ?? "") === "완료",
            ).length;
            const totalCount = recordsOnDay.length;
            return (
              <div
                key={cellDate}
                role="button"
                tabIndex={0}
                className={[
                  "c",
                  isToday ? "today" : "",
                  past && !isToday ? "past" : "",
                  isSat ? "sat-c" : "",
                  isSun ? "sunmon" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-today={isToday ? "true" : undefined}
                data-past={past && !isToday ? "true" : undefined}
                style={{
                  height: 123,
                  cursor: "pointer",
                }}
                onClick={() => setModal({ kind: "day", date: cellDate })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setModal({ kind: "day", date: cellDate });
                  }
                }}
                aria-label={`${cellDate} 일정`}
              >
                {totalCount > 0 && (
                  <span className="c-count" aria-hidden="true">
                    {doneCount}/{totalCount}
                  </span>
                )}
                <div className="dn">
                  <span
                    className={[
                      "dn-num",
                      isToday ? "today" : "",
                      isSat ? "sat" : "",
                      isSun ? "sun" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {cell.day}
                  </span>
                </div>
                <div className="c-inner">
                  {recordsOnDay.slice(0, 3).map((r, i) => {
                    /* §2 정본 — 이벤트 = 한 줄 텍스트 [HH:MM][플랫폼][제목] */
                    const status = r["진행 상태"] ?? "";
                    const platform =
                      [r["플랫폼 1"], r["플랫폼 2"]]
                        .filter((x) => !!x)
                        .join("/") || "기타";
                    const title = r["콘텐츠 제목"] || r["프로그램"] || "—";
                    return (
                      <button
                        key={i}
                        type="button"
                        className={["ev", `ev-${statusClass(r["진행 상태"] ?? "")}`]
                          .filter(Boolean)
                          .join(" ")}
                        data-platform={platform}
                        title={`${status} · ${platform} · ${title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          /* §2조회 3섹션 모달 — 같은 날짜 내 레코드 prev/next 순환 */
                          setModal({
                            kind: "view",
                            recs: recordsOnDay,
                            ix: recordsOnDay.indexOf(r),
                          });
                        }}
                      >
                        <span className="ev-time">
                          {(r["날짜"] ?? "").slice(11, 16) || ""}
                        </span>
                        <span className="ev-plat">{platform}</span>
                        <span className="ev-title">{title}</span>
                      </button>
                    );
                  })}
                  {/* §2 '+N건 더보기' 없음 — 대신 .c-inner 자체 가로 스크롤 */}
                </div>
                {/* §2 정본 — .sp-area (담당자/특별일정 19px 1줄 슬라이드, 셀 하단) */}
                {specialOnDay.length > 0 && (
                  <div className="sp-area" aria-hidden="false">
                    <span className="sp-line">
                      {specialOnDay[0]["내용"] ?? ""}
                    </span>
                  </div>
                )}
                {/* 셀 클릭 자동 팝업용 */}
                {modal?.kind === "day" && modal.date === cellDate && (
                  <div className="panel" role="dialog" aria-label="일정 패널">
                    <DayPanel
                      date={cellDate}
                      records={recordsOnDay}
                      special={specialOnDay}
                      onClose={() => setModal(null)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {modal?.kind === "record" && (
        <DetailModal
          open
          title={modal.rec["콘텐츠 제목"] || modal.rec["프로그램"] || "(제목 없음)"}
          subtitle={`홍보 신청 · ${modal.rec["날짜"] ?? "-"}${modal.rec["요일"] ? ` (${modal.rec["요일"]})` : ""}`}
          rows={[
            { key: "프로그램", value: modal.rec["프로그램"] ?? "-" },
            { key: "콘텐츠 구분", value: modal.rec["콘텐츠 구분"] ?? "-" },
            { key: "콘텐츠 형식", value: modal.rec["콘텐츠 형식"] ?? "-" },
            { key: "콘텐츠 내용", value: modal.rec["콘텐츠 내용"] ?? "-" },
            {
              key: "플랫폼",
              value:
                [modal.rec["플랫폼 1"], modal.rec["플랫폼 2"]]
                  .filter((x) => !!x && x !== "")
                  .join(" · ") || "-",
            },
            { key: "게시일", value: modal.rec["날짜"] ?? "-" },
            {
              key: "입력시간(KST)",
              value: (modal.rec["입력시간(KST)"] ?? "").replace("T", " ").slice(0, 16) || "-",
            },
            { key: "담당 부서", value: modal.rec["담당 부서"] ?? "-" },
            { key: "게시 담당자", value: modal.rec["게시 담당자"] ?? "-" },
            { key: "진행 상태", value: modal.rec["진행 상태"] ?? "-" },
            { key: "신청자", value: modal.rec["신청자"] ?? "-" },
            { key: "공연ID", value: modal.rec["공연ID"] ?? "-" },
            { key: "비고", value: modal.rec["비고"] ?? "-" },
          ]}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === "view" && (
        <ReadonlyModal
          recs={modal.recs}
          ix={viewIx}
          setIx={(n) => setViewIx(Math.max(0, Math.min(n, modal.recs.length - 1)))}
          onClose={() => {
            setModal(null);
            setViewIx(0);
          }}
        />
      )}

      {modal?.kind === "special" && (
        <DetailModal
          open
          title={modal.entry["내용"] ?? "(제목 없음)"}
          subtitle={`특별일정 · ${modal.entry["유형"] ?? ""}`}
          rows={[
            { key: "유형", value: modal.entry["유형"] ?? "-" },
            { key: "시작일", value: modal.entry["시작일"] ?? "-" },
            { key: "종료일", value: modal.entry["종료일"] ?? "-" },
            { key: "시간", value: modal.entry["시간"] ?? "-" },
            { key: "내용", value: modal.entry["내용"] ?? "-" },
            { key: "담당자", value: modal.entry["담당자"] ?? "-" },
          ]}
          onClose={() => setModal(null)}
        />
      )}
    </div>
    </div>
    </div>
  );
}

/* §2 정본 .panel — 셀 우상단 360px 깅기 패널. slideIn .35s는 추후 라운드.
   현 라운드: day-summary (오늘 일정·홍보·특별일정) + 닫기. */
function DayPanel({
  date,
  records,
  special,
  onClose,
}: {
  date: string;
  records: RecordRow[];
  special: SpecialRow[];
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        top: 56,
        right: 0,
        width: 360,
        height: "calc(100vh - 56px)",
        background: "rgba(255,255,255,0.40)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        borderLeft: "1px solid var(--glass-border)",
        boxShadow: "-8px 0 32px rgba(26,26,46,0.03)",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        animation: "panelSlideIn .35s ease",
      }}
    >
      <div
        style={{
          padding: "20px 22px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>
            {date} 일정
          </div>
          <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>
            홍보 {records.length}건 · 특별 {special.length}건
          </div>
        </div>
        <button
          type="button"
          className="modal-x"
          aria-label="닫기"
          title="닫기"
          onClick={onClose}
          style={{
            background: "transparent",
            border: 0,
            fontSize: 18,
            color: "var(--dim)",
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "14px 18px" }}>
        <div className="panel-sp-section" style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--dim)",
              marginBottom: 6,
            }}
          >
            홍보 일정 ({records.length})
          </div>
          {records.length === 0 ? (
            <div
              style={{
                color: "var(--dim)",
                fontSize: 12,
                padding: "14px 0",
                textAlign: "center",
              }}
            >
              📭 등록된 콘텐츠가 없습니다
            </div>
          ) : (
            records.map((r, i) => {
              const status = r["진행 상태"] ?? "";
              const plat =
                [r["플랫폼 1"], r["플랫폼 2"]]
                  .filter((x) => !!x)
                  .join("/") || "기타";
              return (
                <div
                  key={i}
                  className={`p-card ${statusClass(r["진행 상태"] ?? "")}`}
                  style={{
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.55)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    marginBottom: 8,
                    cursor: "pointer",
                  }}
                  title={`${status} · ${plat}`}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--text)",
                      marginBottom: 6,
                    }}
                  >
                    {r["콘텐츠 제목"] || r["프로그램"] || "—"}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--dim)",
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <span className={`meta-chip ${statusClass(r["진행 상태"] ?? "")}`}>
                      {status}
                    </span>
                    <span>· {plat}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {special.length > 0 && (
          <div className="panel-sp-section">
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--dim)",
                marginBottom: 6,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>담당자 일정</span>
              <span
                style={{
                  background: "#D88455",
                  color: "#fff",
                  borderRadius: 999,
                  padding: "1px 8px",
                  fontSize: 10,
                  fontWeight: 800,
                }}
              >
                {special.length}
              </span>
            </div>
            {special.map((s, i) => (
              <div
                key={i}
                className="sp-card"
                style={{
                  padding: "8px 12px",
                  background: "rgba(255,255,255,0.55)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  marginBottom: 6,
                }}
              >
                <span style={{ fontWeight: 700, color: "#D88455", marginRight: 8 }}>
                  {s["유형"] ?? "일정"}
                </span>
                <span style={{ fontSize: 12, color: "var(--text)" }}>
                  {s["내용"] ?? "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* §2 조회 모달 (read-only view) — 3섹션:
   ◎ 📍 홍보 현황  = 신청자/일시/진행 상태/비고
   ◎ 📍 홍보 주제 및 내용 = 플랫폼/프로그램/구분/내용 + 자료 경로 인라인 펼침
   ◎ 📍 게시자 = 담당 부서/담당자
   ◀ / ▶: 같은 날짜 내 레코드 순환. 자료 경로 = 결과_링크 / 결과_첨부URL 인라인 펼침 + 라벨 ↗ + ⧉ 복사 */
function ReadonlyModal({
  recs,
  ix,
  setIx,
  onClose,
}: {
  recs: RecordRow[];
  ix: number;
  setIx: (n: number) => void;
  onClose: () => void;
}) {
  const r = recs[ix];
  if (!r) return null;
  const step = (d: 1 | -1) => {
    setIx(((ix + d) % recs.length + recs.length) % recs.length);
  };
  return (
    <div className="modal-bg show" role="dialog" aria-label="홍보 조회">
      <div
        className="ym-modal"
        style={{ width: 560, maxWidth: "calc(100vw - 32px)", animation: "modalIn .25s ease" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 22px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "var(--text)",
              }}
            >
              {r["콘텐츠 제목"] || r["프로그램"] || "—"}
            </div>
            <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>
              {recs.length > 1
                ? `${ix + 1} / ${recs.length} 건`
                : "단일 건"}
              {r["날짜"] && (
                <span style={{ marginLeft: 8 }}>
                  · {r["날짜"]} {r["요일"] ? `(${r["요일"]})` : ""}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {recs.length > 1 && (
              <>
                <button
                  type="button"
                  className="c-btn no"
                  aria-label="이전 건"
                  style={{ minWidth: 32 }}
                  onClick={() => step(-1)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="c-btn no"
                  aria-label="다음 건"
                  style={{ minWidth: 32 }}
                  onClick={() => step(1)}
                >
                  ›
                </button>
              </>
            )}
            <button
              type="button"
              className="c-btn cancel"
              aria-label="닫기"
              onClick={onClose}
              style={{ marginLeft: 4 }}
            >
              ✕
            </button>
          </div>
        </div>

        <div style={{ padding: "16px 22px", maxHeight: 480, overflow: "auto" }}>
          {/* ── §2 조회 섹션 1: 📍 홍보 현황 ── */}
          <Section title="📍 홍보 현황">
            <Kvr k="신청자" v={r["신청자"] ?? "-"} />
            <Kvr k="일시" v={r["날짜"] ?? "-"} />
            <Kvr
              k="진행 상태"
              v={r["진행 상태"] ?? "-"}
              accent={statusClass(r["진행 상태"] ?? "")}
            />
            {r["비고"] && <Kvr k="비고" v={r["비고"]} multiline />}
            {r["직전 상태"] && <Kvr k="직전 상태" v={r["직전 상태"]} />}
            {r["상태 변경 KST"] && (
              <Kvr k="상태 변경 KST" v={r["상태 변경 KST"]} />
            )}
            {r["취소사유"] && (
              <Kvr k="취소사유" v={r["취소사유"]} multiline />
            )}
            {r["보류사유"] && (
              <Kvr k="보류사유" v={r["보류사유"]} multiline />
            )}
          </Section>

          {/* ── §2 조회 섹션 2: 📍 홍보 주제 및 내용 ── */}
          <Section title="📍 홍보 주제 및 내용">
            <Kvr
              k="플랫폼"
              v={
                [r["플랫폼 1"], r["플랫폼 2"]]
                  .filter((x) => !!x)
                  .join(" · ") || "-"
              }
            />
            <Kvr k="프로그램" v={r["프로그램"] ?? "-"} />
            <Kvr k="콘텐츠 구분" v={r["콘텐츠 구분"] ?? "-"} />
            <Kvr k="콘텐츠 제목" v={r["콘텐츠 제목"] ?? "-"} />
            <Kvr k="콘텐츠 형식" v={r["콘텐츠 형식"] ?? "-"} />
            {r["콘텐츠 내용"] && (
              <Kvr k="콘텐츠 내용" v={r["콘텐츠 내용"]} multiline />
            )}
            {/* ── 자료 경로 = 결과_링크(별칭 자료경로) + 결과_첨부URL
                  인라인 펼침 + 라벨 ↗(외부 열기) + ⧉(복사) ── */}
            {(r["결과_링크"] || r["결과_첨부URL"] || r["결과_비고"]) && (
              <ResourceFolder
                r={r}
                fallbackLabel={
                  r["콘텐츠 제목"]?.slice(0, 30) || "자료"
                }
              />
            )}
          </Section>

          {/* ── §2 조회 섹션 3: 📍 게시자 ── */}
          <Section title="📍 게시자">
            <Kvr k="담당 부서" v={r["담당 부서"] ?? "-"} />
            <Kvr k="게시 담당자" v={r["게시 담당자"] ?? "-"} />
          </Section>
        </div>

        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "12px 22px",
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            className="c-btn cancel"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        marginTop: 4,
        marginBottom: 14,
        padding: "12px 14px",
        background: "rgba(255,255,255,0.40)",
        borderRadius: 12,
        border: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "var(--accent)",
          letterSpacing: 0.2,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

function Kvr({
  k,
  v,
  multiline,
  accent,
}: {
  k: string;
  v: string;
  multiline?: boolean;
  accent?: string;
}) {
  return (
    <div
      className="ym-keyval"
      style={{
        display: "grid",
        gridTemplateColumns: "110px 1fr",
        gap: 8,
        padding: "6px 0",
        fontSize: 13,
      }}
    >
      <span className="k" style={{ color: "var(--ym-ink-soft)", fontWeight: 600 }}>
        {k}
      </span>
      <span
        className="v"
        style={{
          color: accent ? "var(--accent)" : "var(--text)",
          fontWeight: accent ? 700 : 500,
          whiteSpace: multiline ? "pre-wrap" : undefined,
        }}
      >
        {v}
      </span>
    </div>
  );
}

/* §2 조회 모달 내 — 자료 경로 인라인 펼침 (라벨 ↗ + ⧉ 복사)
   우리 data shape는 별도 "자료경로" 컬럼이 없으므로 결과_링크 / 결과_첨부URL / 결과_비고를
   이 항목에 매핑해 표시. 추후 자료경로 컬럼 추가 시 자동 반영. */
function ResourceFolder({
  r,
  fallbackLabel,
}: {
  r: RecordRow;
  fallbackLabel: string;
}) {
  const items = [
    { label: fallbackLabel + " · 결과 링크", url: r["결과_링크"] },
    { label: fallbackLabel + " · 첨부", url: r["결과_첨부URL"] },
    { label: "비고", url: r["결과_비고"] },
  ].filter((x) => !!x.url && x.url !== "");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "transparent",
          border: 0,
          padding: 0,
          fontSize: 12,
          color: "var(--accent)",
          cursor: "pointer",
          fontWeight: 600,
        }}
        aria-expanded={open}
      >
        📁 자료 경로 · {items.length}개 {open ? "닫기" : "펼치기"}
      </button>
      {open && (
        <div style={{ marginTop: 6 }}>
          {items.map((it, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 6px",
                border: "1px solid var(--border)",
                borderRadius: 6,
                marginBottom: 4,
                background: "rgba(255,255,255,0.55)",
              }}
            >
              <a
                href={it.url}
                target="_blank"
                rel="noreferrer"
                title="외부 링크 열기"
                style={{
                  color: "var(--accent)",
                  textDecoration: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                ↗ {it.label}
              </a>
              <button
                type="button"
                title="URL 복사"
                aria-label="URL 복사"
                onClick={() => {
                  try {
                    navigator.clipboard
                      ? navigator.clipboard.writeText(it.url ?? "")
                      : void 0;
                  } catch {
                    /* 일부 브라우저 권한 거부 — 무시 */
                  }
                  setCopied(i);
                  window.setTimeout(() => setCopied(null), 1400);
                }}
                style={{
                  padding: "2px 6px",
                  fontSize: 11,
                  background: copied === i ? "var(--accent)" : "transparent",
                  color: copied === i ? "#fff" : "var(--dim)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                {copied === i ? "✓" : "⧉"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


