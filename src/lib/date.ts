export type DateInput = string | number | null | undefined;

const EMPTY = "";

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function toIsoDate(input: DateInput): string | null {
  if (input === null || input === undefined || input === EMPTY) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    return excelSerialToIso(input);
  }
  const s = String(input).trim();
  if (!s) return null;
  if (s.includes("T")) {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return formatYmd(d);
  }
  if (s.includes("-")) {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  if (s.includes(".")) {
    const m = s.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/);
    if (m) {
      return `${m[1]}-${pad2(Number(m[2]))}-${pad2(Number(m[3]))}`;
    }
  }
  if (s.includes("/")) {
    const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (m) {
      return `${m[1]}-${pad2(Number(m[2]))}-${pad2(Number(m[3]))}`;
    }
  }
  if (/^\d{4,6}$/.test(s)) {
    const n = Number(s);
    if (n >= 20000 && n <= 80000) {
      return excelSerialToIso(n);
    }
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return formatYmd(d);
  }
  return null;
}

export function excelSerialToIso(serial: number): string {
  const ms = (serial - 25569) * 86400 * 1000;
  const d = new Date(ms);
  return formatYmd(d);
}

export function formatYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function todayIso(): string {
  const d = new Date();
  return formatYmd(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
}

export function isEmpty(input: DateInput): boolean {
  if (input === null || input === undefined) return true;
  if (typeof input === "number") return false;
  return String(input).trim() === "";
}

export function isInRange(
  date: string,
  start: string | null,
  end: string | null,
): boolean {
  if (!start && !end) return false;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

export function compareIso(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

export function buildMonthGrid(year: number, month1to12: number): {
  cells: Array<{ date: string | null; dayOfMonth: number | null }>;
  firstDow: number;
} {
  const first = new Date(Date.UTC(year, month1to12 - 1, 1));
  const firstDow = first.getUTCDay();
  const dim = daysInMonth(year, month1to12);
  const cells: Array<{ date: string | null; dayOfMonth: number | null }> = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push({ date: null, dayOfMonth: null });
  }
  for (let d = 1; d <= dim; d++) {
    cells.push({
      date: `${year}-${pad2(month1to12)}-${pad2(d)}`,
      dayOfMonth: d,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, dayOfMonth: null });
  }
  return { cells, firstDow };
}

export function monthLabel(year: number, month1to12: number): string {
  return `${year}년 ${month1to12}월`;
}

export function addMonths(
  year: number,
  month1to12: number,
  delta: number,
): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month1to12 - 1 + delta, 1));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
  };
}

export function thisMonth(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function dowShort(iso: string): "일" | "월" | "화" | "수" | "목" | "금" | "토" {
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return ["일", "월", "화", "수", "목", "금", "토"][day] as
    | "일"
    | "월"
    | "화"
    | "수"
    | "목"
    | "금"
    | "토";
}

export function formatYmdKr(iso: string | null | undefined): string {
  if (!iso) return "-";
  return iso.split("-").join(".");
}

export function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) return "-";
  if (start && end && start === end) return formatYmdKr(start);
  if (start && !end) return `${formatYmdKr(start)} ~`;
  if (!start && end) return `~ ${formatYmdKr(end)}`;
  return `${formatYmdKr(start)} ~ ${formatYmdKr(end)}`;
}
