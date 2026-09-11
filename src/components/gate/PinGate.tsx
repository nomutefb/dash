import { useEffect, useRef, useState } from "react";
import "./PinGate.css";

const PIN_LENGTH = 4;

type PinGateProps = {
  expectedPin: string;
  onSuccess: () => void;
  onRecover?: () => void;
};

export function PinGate({ expectedPin, onSuccess, onRecover }: PinGateProps) {
  /* 동작 불변식 (운영자 260730 v4):
   *  ① 클릭/타이핑 어느 경로로든 → 첫 빈 칸에 항상 쓰기
   *  ② 채움 좌→우 연속 — (1,_,3) 어떤 경로로도 불가능
   *  ③ Backspace = 마지막 채운 칸 삭제 + 그 칸 포커스
   *  ④ 4자리 입력 즉시 자동 검증 (확인 버튼 없음)
   */
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [litFlags, setLitFlags] = useState<number[]>([0, 0, 0, 0]);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);

  const ref0 = useRef<HTMLInputElement | null>(null);
  const ref1 = useRef<HTMLInputElement | null>(null);
  const ref2 = useRef<HTMLInputElement | null>(null);
  const ref3 = useRef<HTMLInputElement | null>(null);
  const refs = [ref0, ref1, ref2, ref3];

  /* 마운트 시점 — 항상 첫 빈 칸 = 0번(또는 현재 first empty)으로 포커스 */
  useEffect(() => {
    ref0.current?.focus();
  }, [ref0]);

  function focusSlot(i: number) {
    refs[i]?.current?.focus();
  }

  function firstEmptyIndex(digs: string[]): number {
    if (digs[0] === "") return 0;
    if (digs[1] === "") return 1;
    if (digs[2] === "") return 2;
    if (digs[3] === "") return 3;
    return -1;
  }

  function lastFilledIndex(digs: string[]): number {
    for (let i = digs.length - 1; i >= 0; i--) {
      if (digs[i] !== "") return i;
    }
    return -1;
  }

  function triggerLit(idx: number) {
    setLitFlags((prev) => {
      const next = [...prev];
      next[idx] = (next[idx] ?? 0) + 1;
      return next;
    });
  }

  function tryAutoSubmit(next: string[]) {
    const attempt = next.join("");
    if (attempt.length < PIN_LENGTH) return;
    if (attempt === expectedPin) {
      setError(false);
      setSuccess(true);
      window.setTimeout(() => onSuccess(), 900);
    } else {
      setError(true);
      setShake(true);
      window.setTimeout(() => setShake(false), 600);
      window.setTimeout(() => {
        setDigits(["", "", "", ""]);
        setLitFlags([0, 0, 0, 0]);
        ref0.current?.focus();
      }, 700);
    }
  }

  /** 어떤 칸에서 onChange가 와도 → 첫 빈 칸에 쓴다.
   *  (1,_,3) 같은 skip-채움은 구조적으로 발생할 수 없다. */
  function handleChange(
    _idx: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const raw = e.target.value;
    e.target.value = ""; // React controlled — 다음 렌더에서 자동 정정

    if (digits.every((d) => d !== "")) return; // 4자리 풀 → 무시
    const char = raw.replace(/\D/g, "").slice(-1); // 마지막 1자리 숫자만
    if (!char) return;

    const j = firstEmptyIndex(digits);
    if (j === -1) return;
    const next = [...digits];
    next[j] = char;
    setDigits(next);
    triggerLit(j);

    if (next.every((d) => d !== "")) {
      window.setTimeout(() => tryAutoSubmit(next), 50);
    } else {
      const nextFocus = Math.min(j + 1, PIN_LENGTH - 1);
      window.setTimeout(() => focusSlot(nextFocus), 0);
    }
  }

  /** 어느 칸을 클릭해도 → 첫 빈 칸 = 강제 포커스. */
  function handleClickIdx(_idx: number) {
    const j = firstEmptyIndex(digits);
    const target = j === -1 ? PIN_LENGTH - 1 : j;
    window.setTimeout(() => focusSlot(target), 0);
  }

  function handleKey(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const last = lastFilledIndex(digits);
      if (last === -1) return;
      const next = [...digits];
      next[last] = "";
      setDigits(next);
      window.setTimeout(() => focusSlot(last), 0);
    } else if (e.key === "ArrowLeft" && idx > 0) {
      e.preventDefault();
      focusSlot(idx - 1);
    } else if (e.key === "ArrowRight" && idx < PIN_LENGTH - 1) {
      e.preventDefault();
      focusSlot(idx + 1);
    }
  }

  /** 페이스트 = 좌측부터 연속으로 밀어넣는다. */
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (!text) return;
    e.preventDefault();
    const chars = text.replace(/\D/g, "").slice(0, PIN_LENGTH).split("");
    const next: string[] = ["","","",""];
    for (let i = 0; i < chars.length; i++) next[i] = chars[i]!;
    setDigits(next);
    if (next.every((d) => d !== "")) {
      window.setTimeout(() => tryAutoSubmit(next), 50);
    } else {
      const lastFilled = lastFilledIndex(next);
      const nextFocus =
        lastFilled + 1 >= PIN_LENGTH ? PIN_LENGTH - 1 : lastFilled + 1;
      window.setTimeout(() => focusSlot(nextFocus), 0);
    }
  }

  const hintText = error ? "PIN이 올바르지 않습니다" : "PIN 번호를 입력해주세요";
  const allEmpty = digits.every((d) => d === "") && !success;

  return (
    <div className="pin-stage">
      {/* [v42 운영자] §3 게이트 배경=살몬 단색조 + 좌측 연한 인디고 기운 추가 (블루→살몬 대각).
         WebGL 메쉬 대체 = 고정 CSS 그라디언트(인디고→살몬 대각) + 살몬 단색조.
         opacity .41 유지· 새 hex 금지 — 기존 토큰만. */}
      <div className="login-bg-gradient" aria-hidden="true" />
      <div
        className="login-card"
        data-shake={shake ? "on" : undefined}
      >
        <div className="login-welcome" aria-label="GS Caltex YEULMARU">
          <b>GS</b> <span className="lw-thin">Caltex</span>{" "}
          <b className="lw-ac">YEULMARU</b>
        </div>
        {/* [v42 운영자] 「MISO 이식판」 살몬 라벨 = 박스 안 「미소 이관」 라벨로 이동 · 중복 회피 — 제거. */}

        <div
          className="pin-wrap"
          data-hint={allEmpty ? "on" : "off"}
          data-success={success ? "on" : "off"}
        >
          {/* [v41 운영자] 핀박스 상단 — 살몬 "미소 이관" 라벨 (원본 이메일 표시 자리를 대체, 박스 내부 상단 중앙) */}
          <div className="miso-tag">미소 이관</div>
          <div className="pin-row">
            {[0, 1, 2, 3].map((i) => {
              const filled = digits[i] !== "";
              const errCls = error && filled ? "is-err" : "";
              return (
                <div
                  key={i}
                  className={[
                    "pin-slot",
                    filled ? "is-filled" : "",
                    errCls,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ ["--i" as never]: i }}
                >
                  <input
                    ref={refs[i] as React.RefObject<HTMLInputElement>}
                    className="pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d{1}"
                    maxLength={1}
                    value={digits[i]}
                    onChange={(e) => handleChange(i, e)}
                    onClick={() => handleClickIdx(i)}
                    onKeyDown={(e) => handleKey(i, e)}
                    onPaste={handlePaste}
                    aria-label={`PIN ${i + 1}자리`}
                  />
                  <svg
                    key={`ring-${i}-${litFlags[i]}-${success ? 1 : 0}`}
                    className="dot-ring"
                    viewBox="0 0 26 26"
                    aria-hidden="true"
                  >
                    <circle cx="13" cy="13" r="11" pathLength="100" />
                  </svg>
                </div>
              );
            })}
          </div>
        </div>

        <div className="login-hint" data-err={error ? "on" : undefined}>
          {hintText}
        </div>

        <button
          type="button"
          className="login-recover"
          onClick={() => onRecover?.()}
        >
          계정 다시 선택
        </button>
      </div>
    </div>
  );
}

