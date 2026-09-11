import { useEffect } from "react";

type DetailModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  rows: Array<{ key: string; value: string | null | undefined }>;
  onClose: () => void;
};

export function DetailModal({
  open,
  title,
  subtitle,
  rows,
  onClose,
}: DetailModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ym-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="ym-modal" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 8,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="ym-modal-title">{title}</h2>
            {subtitle && <div className="ym-modal-sub">{subtitle}</div>}
          </div>
          <button className="ym-btn" onClick={onClose} style={{ height: 32, padding: "0 14px" }}>
            닫기
          </button>
        </div>
        <div style={{ margin: "14px 0", borderTop: "1px solid rgba(0,0,0,0.06)" }} />
        {rows.length === 0 ? (
          <div style={{ padding: "28px 0", textAlign: "center", color: "var(--ym-ink-soft)", fontSize: 13 }}>
            표시할 정보가 없습니다
          </div>
        ) : (
          <div>
            {rows.map((r) => (
              <div key={r.key} className="ym-keyval">
                <span className="k">{r.key}</span>
                <span className="v">
                  {r.value === "" || r.value === null || r.value === undefined ? (
                    <span style={{ color: "var(--dim)" }}>-</span>
                  ) : (
                    r.value
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
