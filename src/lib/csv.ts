import type { DailyOps, RecordRow } from "@/types/domain";
import { toIsoDate } from "@/lib/date";

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      cur.push(field);
      field = "";
      continue;
    }
    if (ch === "\r") {
      continue;
    }
    if (ch === "\n") {
      cur.push(field);
      if (cur.some((c) => c !== "")) {
        rows.push(cur);
      }
      cur = [];
      field = "";
      continue;
    }
    field += ch;
  }
  if (field !== "" || cur.length > 0) {
    cur.push(field);
    if (cur.some((c) => c !== "")) {
      rows.push(cur);
    }
  }
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((key, idx) => {
      obj[key] = (row[idx] ?? "").trim();
    });
    return obj;
  });
}

function pick(obj: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== "") return obj[k];
  }
  return "";
}

export async function fetchRecordsCsv(
  sources: string[],
): Promise<RecordRow[]> {
  for (const url of sources) {
    try {
      const res = await fetchWithTimeout(url, 5000);
      if (!res || !res.ok) continue;
      const text = await res.text();
      const rows = parseCsv(text);
      return rows.map((r) => mapRecordRow(r));
    } catch {
      continue;
    }
  }
  return [];
}

export async function fetchDailyOpsCsv(
  sources: string[],
): Promise<DailyOps[]> {
  for (const url of sources) {
    try {
      const res = await fetchWithTimeout(url, 5000);
      if (!res || !res.ok) continue;
      const text = await res.text();
      const rows = parseCsv(text);
      return rows.map((r) => mapDailyOps(r));
    } catch {
      continue;
    }
  }
  return [];
}

function fetchWithTimeout(url: string, ms: number): Promise<Response | null> {
  return Promise.race<Response | null>([
    fetch(url, { cache: "no-cache" }).catch(() => null),
    new Promise<Response | null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}


function mapRecordRow(r: Record<string, string>): RecordRow {
  const dateRaw = pick(r, ["날짜", "게시일", "일자"]);
  const inputTimeRaw = pick(r, ["입력시간(KST)", "입력시간", "입력시간KST"]);
  let date = toIsoDate(dateRaw);
  if (!date && inputTimeRaw) {
    const m = inputTimeRaw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      date = `${m[1]}-${m[2]}-${m[3]}`;
    } else {
      date = toIsoDate(inputTimeRaw);
    }
  }
  return {
    no: pick(r, ["No", "no", "NO"]),
    inputTimeKst: inputTimeRaw,
    date,
    year: pick(r, ["연도"]),
    month: pick(r, ["월"]),
    day: pick(r, ["일"]),
    weekday: pick(r, ["요일"]),
    platform1: pick(r, ["플랫폼 1", "플랫폼1", "플랫폼"]),
    platform2: pick(r, ["플랫폼 2", "플랫폼2"]),
    category: pick(r, ["콘텐츠 구분", "콘텐츠구분", "구분"]),
    program: pick(r, ["프로그램"]),
    dept: pick(r, ["담당 부서", "담당부서", "부서"]),
    contentTitle: pick(r, ["콘텐츠 제목", "콘텐츠제목"]),
    contentFormat: pick(r, ["콘텐츠 형식", "콘텐츠형식"]),
    contentBody: pick(r, ["콘텐츠 내용", "콘텐츠내용", "내용"]),
    postedManager: pick(r, ["게시 담당자", "게시담당자"]),
    status: filterStatusField(r),
    note: pick(r, ["비고"]),
    applicant: pick(r, ["신청자"]),
    performanceId: pick(r, ["공연ID", "공연 ID", "programId"]),
    _raw: r,
  };
}

function filterStatusField(r: Record<string, string>): string {
  const keys = Object.keys(r);
  const candidates = keys.filter((k) => {
    const norm = k.replace(/\s/g, "");
    return norm === "진행상태" || norm === "진행상태2";
  });
  for (const k of candidates) {
    if (r[k]) return r[k];
  }
  return pick(r, ["상태"]);
}

function mapDailyOps(r: Record<string, string>): DailyOps {
  return {
    date: toIsoDate(pick(r, ["기준일자", "일자", "날짜"])) ?? "",
    performanceName: pick(r, ["공연명", "사업명"]),
    paidSeats: Number(pick(r, ["유료좌석"])) || 0,
    paidAmount: Number(pick(r, ["유료금액"])) || 0,
    freeSeats: Number(pick(r, ["무료좌석"])) || 0,
    totalSeats: Number(pick(r, ["합계좌석", "유료좌석"])) || 0,
    totalAmount: Number(pick(r, ["합계금액"])) || 0,
    occupancy: Number(pick(r, ["점유율"])) || 0,
    prevDayDelta: Number(pick(r, ["전일대비(석)", "전일대비"])) || 0,
    performanceId: pick(r, ["공연ID", "공연 ID"]),
    excluded: pick(r, ["예측제외"]),
  };
}
