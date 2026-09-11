import { useMemo, useState } from "react";
import { programs, type Program } from "@/data";
import { DetailModal } from "@/components/common/DetailModal";

const TODAY = "2026-07-30";

function isSaleActive(start: string | null, end: string | null): boolean {
  return !!start && !!end && start <= TODAY && TODAY <= end;
}
function dateLabel(iso: string | null): string {
  if (!iso) return "-";
  return iso.split("-").join(".");
}
function rangeLabel(start: string | null, end: string | null): string {
  const a = dateLabel(start);
  const b = dateLabel(end);
  if (a === "-" && b === "-") return "-";
  if (a === b) return a;
  if (a === "-") return `~ ${b}`;
  if (b === "-") return `${a} ~`;
  return `${a} ~ ${b}`;
}

export function ProgramsView() {
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of programs) set.add(p.콘텐츠구분 || "기타");
    return ["전체", ...Array.from(set)];
  }, []);

  const [active, setActive] = useState<string>("전체");

  const visible = useMemo(() => {
    return (programs as Program[]).filter((p) => {
      return active === "전체" ? true : p.콘텐츠구분 === active;
    });
  }, [active]);

  const [modal, setModal] = useState<Program | null>(null);

  return (
    /* §1 정본 — body-wrap / main-area 단독(레일 없음) */
    <div id="body-wrap" style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 56px)", isolation: "isolate" }}>
    <div id="main-area" style={{ flex: "1 1 100%", padding: "18px 20px 24px 20px" }}>
    <div className="ym-fade-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          background: "rgba(255,255,255,0.6)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "var(--ym-glass-shadow)",
          borderRadius: 16,
          padding: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div>
            <div className="ym-card-title">
              <span className="ct-bul" /> 프로그램
            </div>
            <div className="ym-card-sub" style={{ marginTop: 4 }}>
              {visible.length}건 표시 중 · 전체 {programs.length}건
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {categories.map((c) => (
              <button
                key={c}
                className="ym-tab-pill"
                data-active={active === c}
                onClick={() => setActive(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 12,
        }}
      >
        {visible.map((p) => {
          const onSale = isSaleActive(p.판매시작일, p.판매종료일);
          return (
            <button
              key={p.프로그램ID}
              type="button"
              onClick={() => setModal(p)}
              style={{
                textAlign: "left",
                cursor: "pointer",
                background: "#fff",
                border: "1px solid rgba(0,0,0,0.09)",
                boxShadow: "rgba(74,77,231,0.04) 0px 2px 10px 0px",
                borderRadius: 16,
                padding: 18,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: "var(--accent-light)",
                    color: "var(--accent)",
                    padding: "2px 8px",
                    borderRadius: 6,
                  }}
                >
                  {p.콘텐츠구분 || "기타"}
                </span>
                {onSale && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: "var(--peach-text)",
                      color: "#fff",
                      padding: "2px 8px",
                      borderRadius: 6,
                    }}
                  >
                    판매중
                  </span>
                )}
                {p.홍보노출 === "Y" && !onSale && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: "rgba(74,77,231,0.12)",
                      color: "var(--accent)",
                      padding: "2px 8px",
                      borderRadius: 6,
                    }}
                  >
                    홍보중
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 15.5,
                  fontWeight: 700,
                  color: "var(--text)",
                  lineHeight: 1.35,
                }}
              >
                {p.풀네임}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--ym-ink-soft)",
                  fontWeight: 600,
                }}
              >
                {p.줄임말}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--ym-ink-soft)",
                  marginTop: 4,
                }}
              >
                <div>
                  <span style={{ color: "var(--dim)" }}>기간 </span>
                  {rangeLabel(p.시작일, p.종료일)}
                </div>
                <div>
                  <span style={{ color: "var(--dim)" }}>장소 </span>
                  {p.장소 || "-"}
                </div>
                <div>
                  <span style={{ color: "var(--dim)" }}>담당 </span>
                  {p.담당자 || "-"}
                </div>
                {p.URL && (
                  <a
                    href={p.URL}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      color: "var(--accent)",
                      textDecoration: "none",
                      fontSize: 11.5,
                      fontWeight: 600,
                      display: "inline-block",
                      marginTop: 4,
                      pointerEvents: "auto",
                    }}
                  >
                    {p.URL.length > 40 ? `${p.URL.slice(0, 40)}…` : p.URL} ↗
                  </a>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div
          style={{
            background: "rgba(255,255,255,0.6)",
            border: "1px dashed rgba(0,0,0,0.1)",
            borderRadius: 16,
            padding: 32,
            textAlign: "center",
            color: "var(--ym-ink-soft)",
            fontSize: 13,
          }}
        >
          선택한 구분에 해당하는 프로그램이 없습니다.
        </div>
      )}

      {modal && (
        <DetailModal
          open
          title={modal.풀네임}
          subtitle={modal.줄임말}
          rows={[
            { key: "콘텐츠 구분", value: modal.콘텐츠구분 || "-" },
            { key: "구분", value: modal.구분 || "-" },
            { key: "시작일", value: dateLabel(modal.시작일) },
            { key: "종료일", value: dateLabel(modal.종료일) },
            { key: "판매시작일", value: dateLabel(modal.판매시작일) },
            { key: "판매종료일", value: dateLabel(modal.판매종료일) },
            { key: "홍보시작일", value: dateLabel(modal.홍보시작일) },
            { key: "장소", value: modal.장소 || "-" },
            { key: "담당자", value: modal.담당자 || "-" },
            { key: "공동기획", value: modal["공동기획여부"] === "1" || modal["공동기획여부"] === "Y" ? "예" : "아니오" },
            { key: "지원사업", value: modal["지원사업여부"] === "1" || modal["지원사업여부"] === "Y" ? "예" : "아니오" },
            { key: "GS아트센터 협업", value: modal["GS아트센터협업여부"] === "1" || modal["GS아트센터협업여부"] === "Y" ? "예" : "아니오" },
            { key: "회차", value: modal.회차 ? `${modal.회차}회` : "-" },
            { key: "수익성", value: modal.수익성 || "-" },
            { key: "홍보노출", value: modal.홍보노출 === "Y" ? "예" : "아니오" },
            { key: "프로그램ID", value: modal.프로그램ID },
            { key: "URL", value: modal.URL || "-" },
          ]}
          onClose={() => setModal(null)}
        />
      )}
    </div>
    </div>
    </div>
  );
}
