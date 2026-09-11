import type { OpsPerformanceMaster } from "@/types/domain";
import { toIsoDate } from "@/lib/date";

type RawRow = [string, string, string, string, string, string, string, string, string, string, string];

const RAW: RawRow[] = [
  ["어린이 뮤지컬 100층짜리 집", "260514_01", "926", "6", "5556", "60", "상업성", "2026-01-29", "2026-05-16", "2026-05-14", "판매중"],
  ["2026 실내악페스티벌", "260416_01", "926", "4", "3704", "20", "공공성", "2026-02-06", "2026-04-19", "2026-04-16", "판매중"],
  ["2026 브런치 콘서트 Ⅰ", "260409_01", "926", "1", "926", "60", "상업성", "2026-02-12", "2026-04-09", "2026-04-09", "판매중"],
  ["한국페스티발앙상블", "260523_01", "926", "1", "926", "20", "공공성", "", "2026-05-23", "2026-05-23", "판매중"],
  ["국립심포니오케스트라", "260530_01", "926", "1", "926", "20", "공공성", "2026-03-06", "2026-05-30", "2026-05-30", "판매중"],
  ["김영욱×콜레기움", "260507_01", "926", "1", "926", "20", "공공성", "2026-03-20", "2026-05-07", "2026-05-07", "판매중"],
  ["2026 브런치 콘서트 Ⅱ", "260604_01", "926", "1", "926", "", "", "", "2026-06-04", "2026-06-04", "판매중"],
  ["연극 노인의 꿈", "260613_01", "977", "2", "1954", "", "", "", "2026-06-13", "2026-06-13", "판매중"],
  ["2026 헬로!오페라 세비야의 이발사", "260619_01", "926", "2", "1852", "", "", "", "2026-06-20", "2026-06-19", "판매중"],
];

function numOrNull(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export const opsPerfMaster: OpsPerformanceMaster[] = RAW.map((r) => ({
  bizName: r[0],
  id: r[1],
  baseSeats: numOrNull(r[2]) ?? 0,
  totalSessions: numOrNull(r[3]) ?? 0,
  totalOpenSeats: numOrNull(r[4]) ?? 0,
  targetOccupancy: numOrNull(r[5]),
  profitability: r[6],
  ticketOpenDate: toIsoDate(r[7]),
  endDate: toIsoDate(r[8]) ?? r[8],
  startDate: toIsoDate(r[9]) ?? r[9],
  status: r[10],
}));
