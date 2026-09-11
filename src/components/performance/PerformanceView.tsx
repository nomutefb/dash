import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  annual,
  exhibDaily,
  exhibMaster,
  opsDaily,
  opsMaster,
  programs,
  type Program,
} from "@/data";
import { SalesDetail } from "./SalesDetail";
import type { BookingStats, SalesRowDTO } from "./performance-types";

const TODAY = "2026-07-30";
const BASE_SEATS = 926;

/* 정본 매출 카드 메타 문자열 빌더 — 공연 / 전시 / noData */
function cardMetaLine(p: Program, isExhibition: boolean, _noData: boolean): string {
  if (isExhibition) return `${fmtMD(p.시작일)}~${fmtMD(p.종료일)} · ${p.장소 || "장소 미정"} · ${parenGenre(p.구분, true)}`;
  const dayLabel = p.시작일 ? `${fmtMD(p.시작일)}${요일Char(p.시작일)}` : "-";
  return `${dayLabel} · ${p.장소 || "장소 미정"} · ${parenGenre(p.구분, false)}`;
}

function fmtMD(iso: string | null): string {
  if (!iso) return "-";
  const [, m, d] = iso.split("-");
  return `${Number(m)}.${Number(d)}`;
}

function 요일Char(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return ["일", "월", "화", "수", "목", "금", "토"][dt.getUTCDay()] ?? "";
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000,
  );
}

function ddayLabel(p: Program, isExhibition: boolean): string {
  if (isExhibition && p.종료일) {
    const d = daysBetween(TODAY, p.종료일!);
    if (d >= 0) return `종료 D-${d}`;
    return `종료 D+${Math.abs(d)}`;
  }
  if (p.시작일) {
    const d = daysBetween(TODAY, p.시작일!);
    if (d >= 0) return `D-${d}`;
    return `D+${Math.abs(d)}`;
  }
  return "-";
}

const TARGET_FALLBACK_PERCENT = 50;

const PALETTE = {
  performance: "#4A4DE7",
  exhibition: "#D88455",
  education: "#1A6B3C",
};

function fmtKr(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("ko-KR");
}

function bump(list: Array<{ label: string; value: number }>, label: string): void {
  const found = list.find((item) => item.label === label);
  if (found) found.value += 1;
  else list.push({ label, value: 1 });
}

/* v33 §1 — 사업성격 변환. 전시=원시 무관 항상 예술성. 상업성→사업성. 공공성/빈값→예술성
   출력 가능한 값은 2종("사업성"/"예술성") 한정 */
function mapBiz(raw: string | null | undefined, isExhibition: boolean): "사업성" | "예술성" {
  if (isExhibition) return "예술성";
  if (raw === "상업성") return "사업성";
  return "예술성";
}

/* v33 §2 — 장르 괄호 추출: 뮤지컬(어린이) → "어린이". 빈값=공연기타/전시시즌 기본 */
function parenGenre(raw: string | null | undefined, isExhibition: boolean): string {
  if (!raw) return isExhibition ? "시즌" : "공연 기타";
  const m = String(raw).match(/[(\uff08](.+?)[)\uff09]/);
  if (m) return m[1];
  return String(raw);
}

function dateDowShort(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [yStr, mStr, dStr] = iso.split("-");
  if (!yStr || !mStr || !dStr) return null;
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const labels = ["일","월","화","수","목","금","토"];
  return labels[dow];
}

function shortDate(iso: string | null | undefined): {
  text: string;
  dow: string;
} | null {
  if (!iso) return null;
  const [, mStr, dStr] = iso.split("-");
  if (!mStr || !dStr) return null;
  const m = Number(mStr);
  const d = Number(dStr);
  const dow = dateDowShort(iso) ?? "";
  return { text: `${m}.${d}`, dow };
}

function daysInclusive(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = end.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return null;
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const diff = Math.floor((b - a) / 86400000) + 1;
  return diff > 0 ? diff : null;
}

/** 사업 성격 — 공연은 programs.수익성을 그대로, 전시는 항상 '예술성' */
function bizLabel(program: Program): string {
  if (program.콘텐츠구분 === "전시") return "예술성";
  return program.수익성 ?? "—";
}

export function PerformanceView() {
  /* ── 클릭 → 판매현황 상세 (책장 넘김) ── */
  const [drillKey, setDrillKey] = useState<string | null>(null);
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const [bookingByProgram, setBookingByProgram] = useState<Record<string, BookingStats>>({});
  /* 실적표 6년 창 — ‹ / › 페이저로 1년씩 이동, 끝은 자동 클램프. 초기값 = 마지막 6년이 보이도록 */
  const [tableWinStart, setTableWinStart] = useState(() =>
    Math.max(0, (annual?.years ?? []).length - 6),
  );
  /* v32 §3 — 대시보드 좌·우 카드 2면 셸 페이지 컨트롤(좌·우 동일 .bizm-pgctl 부품 = #bizmLeftDots / #bizmRightDots).
     양끝 disabled 금지. 도트 같은 면이면 no-op. 다음 면 .bizm-page, 이전 면 .bizm-page.rev. */
  const [bizLeftPage, setBizLeftPage] = useState<0 | 1>(0);
  const [bizRightPage, setBizRightPage] = useState<0 | 1>(0);
  const [bizLeftDir, setBizLeftDir] = useState<"fwd" | "rev">("fwd");
  const [bizRightDir, setBizRightDir] = useState<"fwd" | "rev">("fwd");
  const leftBoxRef = useRef<HTMLDivElement | null>(null);
  const rightBoxRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function loadBookingStats() {
      try {
        const [bookingRes, memberRes] = await Promise.all([
          fetch("/api/ops?sheet=%EC%98%88%EB%A7%A4", { cache: "no-cache" }),
          fetch("/api/ops?sheet=%ED%9A%8C%EC%9B%90", { cache: "no-cache" }),
        ]);
        if (!bookingRes.ok) return;
        const bookingJson = await bookingRes.json() as { rows?: Record<string, string>[] };
        const memberJson = memberRes.ok ? await memberRes.json() as { rows?: Record<string, string>[] } : {};
        const members = new Map<string, Record<string, string>>();
        for (const member of memberJson.rows ?? []) {
          for (const key of [member["아이디"], member["휴대폰정규화"], member["휴대폰번호(원본)"]]) {
            if (key) members.set(String(key), member);
          }
        }
        const built: Record<string, BookingStats> = {};
        const membersByProgram: Record<string, Record<string, boolean>> = {};
        const productsByMember: Record<string, Record<string, number>> = {};
        const productByProgram: Record<string, string> = {};
        for (const raw of bookingJson.rows ?? []) {
          const id = raw["공연ID"];
          if (!id || !String(raw["이용일시"] ?? "").startsWith("2026")) continue;
          const stat = built[id] ??= { count: 0, tickets: 0, ages: {}, residences: [], channels: [], topPrograms: [] };
          if (raw["상품명"]) productByProgram[id] = raw["상품명"];
          const memberKey = raw["회원키"];
          if (memberKey && raw["상품명"]) {
            (membersByProgram[id] ??= {})[memberKey] = true;
            (productsByMember[memberKey] ??= {})[raw["상품명"]] = (productsByMember[memberKey]?.[raw["상품명"]] || 0) + 1;
          }
          stat.count += 1;
          stat.tickets += Number(raw["총매수"] || 0) || 0;
          const member = members.get(raw["회원키"] || "");
          const birth = String(member?.["생년월일"] ?? "").replace(/[^0-9]/g, "");
          const age = birth.length >= 4 ? 2026 - Number(birth.slice(0, 4)) : null;
          const ageLabel = age == null || age < 10 ? null : age < 20 ? "10대" : age < 40 ? "20/30대" : age < 50 ? "40대" : age < 60 ? "50대" : "60대 이상";
          if (ageLabel) stat.ages[ageLabel] = (stat.ages[ageLabel] || 0) + 1;
          const residence = member?.["주소2"] || member?.["주소1"];
          if (residence) bump(stat.residences, residence);
          const channel = raw["판매처"];
          if (channel) bump(stat.channels, channel);
        }
        for (const stat of Object.values(built)) {
          stat.residences.sort((a, b) => b.value - a.value);
          stat.channels.sort((a, b) => b.value - a.value);
          const coPurchased: Record<string, number> = {};
          for (const memberKey of Object.keys(membersByProgram[Object.keys(built).find((key) => built[key] === stat) || ""] || {})) {
            for (const label of Object.keys(productsByMember[memberKey] || {})) coPurchased[label] = (coPurchased[label] || 0) + 1;
          }
          stat.topPrograms = Object.entries(coPurchased).filter(([label]) => label !== productByProgram[Object.keys(built).find((key) => built[key] === stat) || ""]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label, value]) => ({ label, value }));
        }
        if (!cancelled) setBookingByProgram(built);
      } catch {
        // 상세의 예매자 섹션은 원천 데이터가 없으면 표시하지 않는다.
      }
    }
    void loadBookingStats();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const box = leftBoxRef.current;
    if (!box) return;
    const target = box.querySelector(`.bizmbox[data-page="${bizLeftPage}"]`) as HTMLElement | null;
    if (!target) return;
    target.classList.remove("bizm-page", "rev");
    void target.offsetWidth;
    target.classList.add("bizm-page");
    if (bizLeftDir === "rev") target.classList.add("rev");
  }, [bizLeftPage, bizLeftDir]);
  useEffect(() => {
    const box = rightBoxRef.current;
    if (!box) return;
    const target = box.querySelector(`.bizmbox[data-page="${bizRightPage}"]`) as HTMLElement | null;
    if (!target) return;
    target.classList.remove("bizm-page", "rev");
    void target.offsetWidth;
    target.classList.add("bizm-page");
    if (bizRightDir === "rev") target.classList.add("rev");
  }, [bizRightPage, bizRightDir]);
  function shiftLeft(delta: 1 | -1) {
    setBizLeftDir(delta === 1 ? "fwd" : "rev");
    setBizLeftPage((p) => (((p + delta) % 2) + 2) % 2 as 0 | 1);
  }
  function shiftRight(delta: 1 | -1) {
    setBizRightDir(delta === 1 ? "fwd" : "rev");
    setBizRightPage((p) => (((p + delta) % 2) + 2) % 2 as 0 | 1);
  }
  function onPickRow(k: string) {
    /* [v45 §4] 같은 행 재클릭 = 목록 복귀. drillIdx === k 동치면 close. */
    if (drillKey === k) {
      setDrillKey(null);
      setPickedKey(null);
      return;
    }
    setPickedKey(k);
    setDrillKey(k);
  }

  const years = annual?.years ?? [];
  const grandTotal = annual?.grand ?? 0;
  const annualInwonSum = annual?.total?.["2"]?.sum ?? 0;
  const annualInwon = annual?.total?.["2"]?.v ?? [];
  const perfInwon = annual?.cats?.공연?.rows?.find((r) => r.key === "인원")?.v ?? [];
  const exhInwon = annual?.cats?.전시?.rows?.find((r) => r.key === "인원")?.v ?? [];
  const eduInwon = annual?.cats?.교육?.rows?.find((r) => r.key === "인원")?.v ?? [];
  const perfSum =
    annual?.cats?.공연?.rows?.find((r) => r.key === "인원")?.sum ?? 0;
  const exhSum =
    annual?.cats?.전시?.rows?.find((r) => r.key === "인원")?.sum ?? 0;
  const eduSum =
    annual?.cats?.교육?.rows?.find((r) => r.key === "인원")?.sum ?? 0;

  const latestYear = years.length ? years[years.length - 1] : 0;
  const latestIdx = years.length - 1;
  const prevIdx = years.length - 2;
  void latestIdx; void prevIdx;

  /* 차트 데이터 — 만명 단위(값 자체가 만명이라 YAxis 0–11 눈금과 1:1 매칭).
     정렬 = 연도 오름차순, 중복 제거. x축 카테고리는 이 배열의 year 순서를 그대로 따름. */

  /* 차트 데이터 — 만명 단위(값 자체가 만명이라 YAxis 0–11 눈금과 1:1 매칭).
     정렬 = 연도 오름차순, 중복 제거. x축 카테고리는 이 배열의 year 순서를 그대로 따름. */
  const chartData = useMemo(() => {
    const sortedYears = Array.from(new Set(years.map(Number))).sort((a, b) => a - b);
    return sortedYears.map((y) => {
      const i = years.indexOf(y);
      return {
        year: String(y),
        performance: roundTo1((perfInwon[i] ?? 0) / 10000),
        exhibition: roundTo1((exhInwon[i] ?? 0) / 10000),
        education: roundTo1((eduInwon[i] ?? 0) / 10000),
      };
    });
  }, [years, perfInwon, exhInwon, eduInwon]);

  /* 주석 배지 명세(연도 → 시리즈 → 라벨 → 테두리색).
     위치는 chartData[X].{series}에서 자동 계산(recharts ReferenceDot).
     정렬 기준은 chartData의 year 인덱스(연도 순차 = 인덱스 순차)와 일치 */
  const annotations = useMemo(() => {
    const yi = (year: number) => years.indexOf(year);
    return [
      { year: 2013, series: "performance" as const, text: "최고 10.2", border: "var(--accent)",       fill: "#ffffff" },
      { year: 2019, series: "exhibition" as const,  text: "최고 7.7",  border: "var(--peach-text)",  fill: "#ffffff" },
      { year: 2018, series: "performance" as const, text: "최저 1.9",  border: "#9aa0b4",             fill: "#ffffff" },
      { year: 2020, series: "exhibition" as const,  text: "최저 1.8",  border: "#9aa0b4",             fill: "#ffffff" },
      { year: 2022, series: "education" as const,   text: "최고 1.1",  border: "var(--c3)",           fill: "#ffffff" },
      { year: 2013, series: "education" as const,   text: "최저 0.0",  border: "var(--c3)",           fill: "#ffffff" },
    ].filter((a) => yi(a.year) >= 0);
  }, [years]);

  /* 2021→2025 점선 추세선 좌표(ReferenceLine.segment용) */
  const trendSegment = useMemo(() => {
    const sx = years.indexOf(2021);
    const ex = years.indexOf(2025);
    if (sx < 0 || ex < 0) return null;
    return [
      { x: String(years[sx]), y: roundTo1((annualInwon[sx] ?? 0) / 10000) },
      { x: String(years[ex]), y: roundTo1((annualInwon[ex] ?? 0) / 10000) },
    ];
  }, [years, annualInwon]);

  /* 증감률 — 근 4개년 시작=years[len-5], 끝=years[len-1], 만명 비교 */
  const trendPctLast5 = useMemo(() => {
    if (years.length < 5) return null;
    const startIdx = years.length - 5;
    const endIdx = years.length - 1;
    const a = (annualInwon[startIdx] ?? 0) / 10000;
    const b = (annualInwon[endIdx] ?? 0) / 10000;
    if (a === 0) return null;
    return ((b - a) / a) * 100;
  }, [years, annualInwon]);

  /* 실적표 6년 창 — 페이저 state 따라 마지막 6년이 이동 */
  const windowRows = useMemo(() => {
    const maxStart = Math.max(0, years.length - 6);
    const start = Math.min(Math.max(0, tableWinStart), maxStart);
    const idx = years.slice(start, start + 6).map((y) => years.indexOf(y));
    return [
      { label: "공연", cells: idx.map((i) => perfInwon[i] ?? 0), sum: perfSum },
      { label: "전시", cells: idx.map((i) => exhInwon[i] ?? 0), sum: exhSum },
      { label: "교육", cells: idx.map((i) => eduInwon[i] ?? 0), sum: eduSum },
      { label: "계",  cells: idx.map((i) => annualInwon[i] ?? 0), sum: annualInwonSum },
    ];
  }, [years, tableWinStart, perfInwon, exhInwon, eduInwon, annualInwon, perfSum, exhSum, eduSum, annualInwonSum]);

  const windowColumns = useMemo(() => {
    const maxStart = Math.max(0, years.length - 6);
    const start = Math.min(Math.max(0, tableWinStart), maxStart);
    return [...years.slice(start, start + 6).map((y) => String(y)), "누계"];
  }, [years, tableWinStart]);

  /* ----- 판매현황 ----- */
  const opsByPerf = useMemo(() => {
    const m: Record<string, Array<typeof opsDaily[number]>> = {};
    for (const d of opsDaily) {
      if (!d.공연ID) continue;
      (m[d.공연ID] ||= []).push(d);
    }
    for (const arr of Object.values(m)) {
      arr.sort((a, b) => a.기준일자.localeCompare(b.기준일자));
    }
    return m;
  }, [opsDaily]);

  const exhByExh = useMemo(() => {
    const m: Record<string, Array<typeof exhibDaily[number]>> = {};
    for (const d of exhibDaily) {
      if (!d.전시ID) continue;
      (m[d.전시ID] ||= []).push(d);
    }
    for (const arr of Object.values(m)) {
      arr.sort((a, b) => a.기준일자.localeCompare(b.기준일자));
    }
    return m;
  }, [exhibDaily]);

  /** 영업중(공연): 판매 시작/종료일이 모두 있고, 오늘이 그 범위 안에 있는 것만 */
  const visiblePerformances = useMemo(() => {
    return (programs as Program[])
      .filter(
        (p) =>
          p.콘텐츠구분 === "공연" &&
          !!p.판매시작일 &&
          p.판매시작일 <= TODAY &&
          (opsByPerf[p.프로그램ID]?.length ?? 0) > 0,
      )
      .sort((a, b) => (a.시작일 ?? "").localeCompare(b.시작일 ?? ""));
  }, [opsByPerf]);

  /** 영업중(전시): 판매시작일·판매종료일 둘 다 있고, 오늘이 그 범위 안 */
  const visibleExhibitions = useMemo(() => {
    return (programs as Program[])
      .filter(
        (p) =>
          p.콘텐츠구분 === "전시" &&
          !!p.판매시작일 &&
          p.판매시작일 <= TODAY &&
          (exhByExh[p.프로그램ID]?.length ?? 0) > 0,
      )
      .sort((a, b) => (a.시작일 ?? "").localeCompare(b.시작일 ?? ""));
  }, [exhByExh]);

  /* ── opsMaster 사전 인덱스 (목록→상세 join key: opsMaster.ID === programs.프로그램ID) ── */
  const opsMasterByID = useMemo(() => {
    const m = new Map<string, (typeof opsMaster)[number]>();
    for (const x of opsMaster) m.set(x.ID, x);
    return m;
  }, [opsMaster]);

  /* ── expos_master 사전 인덱스 (전시 목표관객 — exhibMaster는 전시명 매칭) ── */
  const exhibMasterByName = useMemo(() => {
    const m = new Map<string, (typeof exhibMaster)[number]>();
    for (const x of exhibMaster) m.set(x.전시명, x);
    return m;
  }, [exhibMaster]);

  /* ── 클릭 → 상세 카드에 내려줄 SalesRowDTO 만들기 ──
     DOM 순서: 공연 먼저 (visiblePerformances) → 전시 다음 (visibleExhibitions).
     React는 DOM에서 순서를 읽지 않으므로 memo 결과를 곧 순서로 삼는다. */
  const salesRows = useMemo<SalesRowDTO[]>(() => {
    const buildPerfRow = (p: Program): SalesRowDTO => {
      const daily = (opsDaily as OpsDailyRow[])
        .filter((x) => x.공연ID === p.프로그램ID && x.기준일자 <= TODAY)
        .slice();
      daily.sort((a, b) => a.기준일자.localeCompare(b.기준일자));
      const last = daily.length > 0 ? daily[daily.length - 1] : null;
      const opsRow = opsMasterByID.get(p.프로그램ID);
      const sessions = p.회차 && p.회차 > 0 ? p.회차 : 0;
      const totalSlots = sessions * BASE_SEATS;
      const noData = !last;
      const sold = last?.합계좌석 ?? null;
      const occupancy =
        sold !== null && totalSlots > 0 ? (sold / totalSlots) * 100 : null;
      const targetOccupancy =
        opsRow?.목표점유율 != null && Number.isFinite(opsRow.목표점유율)
          ? opsRow.목표점유율
          : TARGET_FALLBACK_PERCENT;
      const gapPct =
        occupancy !== null
          ? Math.round((occupancy - targetOccupancy) * 10) / 10
          : null;
      const lastN = last ? Number(last["전일대비(석)"] ?? 0) : 0;
      const yoyDeltaPct =
        !noData && sold !== null && lastN !== 0 && totalSlots > 0
          ? Math.round((lastN / totalSlots) * 1000) / 10
          : null;
      const cumArr = noData
        ? []
         : (() => {
             const tail = daily.slice(-8);
             return tail.map((r) => r["합계좌석"] ?? 0);
          })();
      /* [v45 정본 §1] fcRate = 전 기간 일평균 %p/일. 시작 점유율 / 끝 점유율 / 경과일.
         원본: p.fcRate / (p.totalOpen||926) * 100 → 즉 daily의 (occ_diff / 일수) 를 * 100 (%p) 로 환산. */
      const fcRate = (() => {
        if (noData || daily.length < 2 || totalSlots <= 0) return null;
        const first = daily[0]?.합계좌석 ?? 0;
        const lastV = last?.합계좌석 ?? 0;
        const firstOcc = (first / totalSlots) * 100;
        const lastOcc = (lastV / totalSlots) * 100;
        const days = Math.max(1, daily.length - 1);
        return (lastOcc - firstOcc) / days;
      })();
      return {
        key: p.프로그램ID,
        isExhibition: false,
        noData,
        displayName: p.풀네임,
        metaLine: cardMetaLine(p, false, noData),
        ddayLabel: ddayLabel(p, false),
        occupancy,
        gapPct,
        yoyDeltaPct,
        sold,
        totalSlots,
        targetOccupancy,
        sparkVals: cumArr,
        sparkDates: noData ? [] : daily.slice(-8).map((r) => r.기준일자),
        booking: bookingByProgram[p.프로그램ID],
        forecastUnit: noData ? "" : "석",
        fcRate,
        totalOpen: totalSlots || 926,
      };
    };

    const buildExhRow = (p: Program): SalesRowDTO => {
      const daily = (exhibDaily as ExhibDailyRow[])
        .filter((x) => x.전시ID === p.프로그램ID && x.기준일자 <= TODAY)
        .slice();
      daily.sort((a, b) => a.기준일자.localeCompare(b.기준일자));
      const last = daily.length > 0 ? daily[daily.length - 1] : null;
      const masterRow = exhibMasterByName.get(p.풀네임);
      const noData = !last;
      const attendance = last?.누계총인원 ?? 0;
       const paidAttendance = last?.누계유료 ?? 0;
       const targetAttendance = masterRow?.목표관객 ?? null;
       const occupancy = last?.점유율 == null ? null : (last.점유율 <= 1 ? last.점유율 * 100 : last.점유율);
      const cumArr = noData
        ? []
        : (() => {
            const tail = daily.slice(-8);
             return tail.map((r) => r.누계총인원 ?? 0);
          })();
      /* [v45 정본 §1] 전시는 totalOpen=0(불명), fcRate = null → 외삽 클램프는 (paidAttendance / totalOpen)*100 불가.
         단 원본 로직: totalOpen 없으면 fallback = 마지막 3건 점유율 평균 차(공연과 동일 분기). 정본 그대로 보존. */
      const fcRate = (() => {
        if (noData || daily.length < 3) return null;
        const a = daily[daily.length - 1]?.일일총인원 ?? 0;
        const b = daily[daily.length - 3]?.일일총인원 ?? 0;
        return (a - b) / 2;
      })();
      return {
        key: p.프로그램ID,
        isExhibition: true,
        noData,
        displayName: p.풀네임,
        metaLine: cardMetaLine(p, true, noData),
        ddayLabel: ddayLabel(p, true),
        occupancy,
        gapPct: null,
        yoyDeltaPct: null,
        sold: noData ? 0 : attendance,
        totalSlots: 0,
        targetOccupancy: null,
        sparkVals: cumArr,
        sparkDates: noData ? [] : daily.slice(-8).map((r) => r.기준일자),
        booking: undefined,
        attendance,
        paidAttendance,
        targetAttendance,
        forecastUnit: noData ? "" : "명",
        fcRate,
        totalOpen: 0,
      };
    };

    const out: SalesRowDTO[] = [];
    for (const p of visiblePerformances) out.push(buildPerfRow(p));
    for (const p of visibleExhibitions) out.push(buildExhRow(p));
    return out;
  }, [
    visiblePerformances,
    visibleExhibitions,
    opsMasterByID,
    exhibMasterByName,
    bookingByProgram,
    opsDaily,
    exhibDaily,
  ]);

  const drillIdx = drillKey
    ? salesRows.findIndex((r) => r.key === drillKey)
    : -1;

  function shiftDrill(delta: number) {
    if (drillIdx < 0 || salesRows.length === 0) return;
    const n = salesRows.length;
    const next = ((drillIdx + delta) % n + n) % n;
    setDrillKey(salesRows[next]!.key);
  }

  function goDrill(i: number) {
    if (i < 0 || i >= salesRows.length) return;
    setDrillKey(salesRows[i]!.key);
  }

  return (
    <div
      id="body-wrap"
      style={{
        /* §1 정본 — body-wrap = nav 아래 좌우 flex container, 좌우 패딩은 안쪽 #main-area / #sales-rail로 분리 */
        position: "relative",
        minHeight: "calc(100vh - 56px)",
        isolation: "isolate",
        display: "flex",
      }}
    >
      {/* ===================== 좌측 — #main-area 연간 실적 ===================== */}
      <section
        id="main-area"
        style={{
          /* §1 #main-area — flex 1:1 좌측(padding 자체는 #main-area에 부착) */
          flex: "1 1 50%",
          minWidth: 0,
          padding: "18px 20px 24px 20px",
        }}
      >
      {/* ── 좌 보드 페이지 컨테이너 = reflow 트리거(.bizm-page) + 양면 ── */}
      <div
        ref={leftBoxRef}
        style={{
          display: "flex",
          flexDirection: "column",
          flex: "1 1 auto",
          minHeight: 320,
          position: "relative",
        }}
      >
        {/* ── 1면: 연간 실적 (현행 차트·표 그대로 — v31 무접촉) ── */}
        <div
          className={`bizmbox${bizLeftPage === 0 ? " bizm-page" : ""}`}
          data-bizmbox
          data-page="0"
          style={{
            background: "rgba(255,255,255,.35)",
            backdropFilter: "blur(7px)",
            WebkitBackdropFilter: "blur(7px)",
            border: "1px solid rgba(255,255,255,.7)",
            borderRadius: 20,
            boxShadow: "var(--ym-glass-shadow)",
            padding: 0,
            display: bizLeftPage === 0 ? "flex" : "none",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* 1면 헤더 — v32 §3 정의 그대로(min-h:47px / glass 90% / radius 20 20 0 0 / inset 1px 흰빛) */}
          <div
            style={{
              minHeight: 47,
              padding: "1px 18px 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(255,255,255,.9)",
              backdropFilter: "blur(11px)",
              WebkitBackdropFilter: "blur(11px)",
              border: "1px solid rgba(255,255,255,.55)",
              borderBottom: "1px solid rgba(0,0,0,.07)",
              borderRadius: "20px 20px 0 0",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.6)",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span
                style={{
                  fontSize: 14.5,
                  fontWeight: 800,
                  color: "#4A4DE7",
                  letterSpacing: "-.01em",
                  lineHeight: 1,
                }}
              >
                연간 실적
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "#bbb",
                }}
              >
                2012~2026.1Q
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "#6B6B7B" }}>
                누적{" "}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "#4A4DE7",
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                }}
              >
                3,690,031명
              </span>
            </div>
          </div>
          {/* 1면 유리통(본문) */}
          <div
            style={{
              background: "rgba(255,255,255,.15)",
              backdropFilter: "blur(7px)",
              WebkitBackdropFilter: "blur(7px)",
              border: "1px solid rgba(255,255,255,.7)",
              borderTop: "none",
              borderRadius: "0 0 20px 20px",
              padding: 18,
            }}
          >
      <section
        style={{
          background: "rgba(255,255,255,0.35)",
          backdropFilter: "blur(7px)",
          WebkitBackdropFilter: "blur(7px)",
          border: "1px solid rgba(255,255,255,0.7)",
          borderRadius: 20,
          boxShadow: "var(--ym-glass-shadow)",
          padding: 22,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div>
            <div className="ym-card-title">
              <span className="ct-bul" />
              연간 실적
            </div>
            <div className="ym-card-sub" style={{ marginTop: 4 }}>
              2012~{latestYear || "2026"}
            </div>
          </div>
          <div style={{ fontSize: 13 }}>
            <span style={{ color: "var(--ym-ink-soft)" }}>누적 </span>
            <span
              style={{
                color: "var(--accent)",
                fontWeight: 800,
                fontSize: 16,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmtKr(grandTotal)}
            </span>
            <span style={{ color: "var(--ym-ink-soft)" }}> 명</span>
          </div>
        </div>

        {/* KPI 스트립 — 현행 구조 4칸 유지, 클래스만 ym-strip → bizm-strip, 값 색만 정정(v32 §5) */}
        <div className="bizm-strip" style={{ marginBottom: 14 }}>
          <div className="cell">
            <div className="lab">누계 관람·수강</div>
            <div className="val" style={{ color: "var(--accent)" }}>1,505,706</div>
          </div>
          <div className="cell">
            <div className="lab">최고 연도 (2019)</div>
            <div className="val" style={{ color: "var(--text)" }}>158,259</div>
          </div>
          <div className="cell">
            <div className="lab">연평균</div>
            <div className="val" style={{ color: "var(--text)" }}>107,550</div>
          </div>
          <div className="cell">
            <div className="lab">전년 대비</div>
            <div className="val" style={{ color: "var(--c3)" }}>+2.6%</div>
          </div>
        </div>

        {/* 차트 카드 */}
        <div
          className="ym-card"
          style={{ padding: 18, marginBottom: 14 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <div className="ym-card-title">
              <span className="ct-bul" />
              연도별 관람·수강 추이
            </div>
            {/* 우상단 = (단위: 만명) */}
            <div className="ym-card-sub" style={{ fontWeight: 600 }}>(단위: 만명)</div>
          </div>
          <div style={{ width: "100%", height: 300, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 24, right: 24, bottom: 4, left: -16 }}
              >
                <CartesianGrid stroke="#e9e9ee" strokeDasharray="2 3" />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11, fill: "var(--ym-ink-soft)" }}
                  stroke="rgba(0,0,0,0.18)"
                />
                <YAxis
                  domain={[0, 11]}
                  ticks={[0, 2, 4, 6, 8, 10]}
                  tick={{ fontSize: 11, fill: "var(--ym-ink-soft)" }}
                  stroke="rgba(0,0,0,0.18)"
                  width={36}
                />
                <Tooltip
                  cursor={{ fill: "rgba(74,77,231,0.06)" }}
                  contentStyle={{
                    background: "rgba(255,255,255,0.95)",
                    border: "1px solid rgba(74,77,231,0.2)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--text)", fontWeight: 700 }}
                  formatter={(v: number, name: string) => {
                    const labels: Record<string, string> = {
                      performance: "공연",
                      exhibition: "전시",
                      education: "교육",
                    };
                    return [`${v.toFixed(2)} 만명`, labels[name] ?? name];
                  }}
                />
                {/* 범례 = 숨김(자동 중복 표시). 카드 위쪽 인라인 3색 범례로 대체. */}
                <Legend content={() => null} />

                {/* ── 막대 3종 = 얇고 반투명 파스텔 ── */}
                <Bar
                  dataKey="performance"
                  fill="rgba(74,77,231,0.42)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={14}
                  legendType="none"
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="exhibition"
                  fill="rgba(216,132,85,0.42)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={14}
                  legendType="none"
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="education"
                  fill="rgba(26,107,60,0.42)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={14}
                  legendType="none"
                  isAnimationActive={false}
                />

                {/* ── 추세선 3종 = 동일 색상 솔리드, 마커 없음 ── */}
                <Line
                  type="monotone"
                  dataKey="performance"
                  stroke={PALETTE.performance}
                  strokeWidth={1.5}
                  dot={false}
                  legendType="none"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="exhibition"
                  stroke={PALETTE.exhibition}
                  strokeWidth={1.5}
                  dot={false}
                  legendType="none"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="education"
                  stroke={PALETTE.education}
                  strokeWidth={1.5}
                  dot={false}
                  legendType="none"
                  isAnimationActive={false}
                />

                {/* ── 2021→2025 점선 추세선(ReferenceLine.segment) ── */}
                {trendSegment && (
                  <ReferenceLine
                    segment={trendSegment}
                    stroke="var(--ym-ink-soft)"
                    strokeDasharray="5 4"
                    strokeWidth={1.4}
                    ifOverflow="extendDomain"
                  />
                )}

                {/* ── 6개 주석 배지(테두리 박스) ── */}
                {annotations.map((a, i) => {
                  const idx = years.indexOf(a.year);
                  const v =
                    a.series === "performance"
                      ? chartData[idx]?.performance
                      : a.series === "exhibition"
                        ? chartData[idx]?.exhibition
                        : chartData[idx]?.education;
                  return (
                    <ReferenceDot
                      key={`${a.year}-${a.series}-${i}`}
                      x={String(a.year)}
                      y={v}
                      r={0}
                      isFront
                      label={({ viewBox }) => {
                        const cx = viewBox?.x ?? 0;
                        const cy = viewBox?.y ?? 0;
                        return (
                          <g transform={`translate(${cx}, ${cy - 28})`}>
                            <rect
                              x={-44}
                              y={-12}
                              width={88}
                              height={22}
                              rx={4}
                              fill={a.fill}
                              stroke={a.border}
                              strokeWidth={1}
                            />
                            <text
                              x={0}
                              y={3}
                              textAnchor="middle"
                              fontSize={11}
                              fontWeight={700}
                              fill={a.border}
                            >
                              {a.text}
                            </text>
                          </g>
                        );
                      }}
                    />
                  );
                })}
              </ComposedChart>
            </ResponsiveContainer>

            {/* 차트 위 인라인 3색 범례 + 우상단 "근 4개년" 점선 박스 */}
            <div
              style={{
                position: "absolute",
                top: 6,
                left: 16,
                display: "flex",
                alignItems: "center",
                gap: 14,
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text)",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: "rgba(74,77,231,0.42)", display: "inline-block" }} />
                공연
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: "rgba(216,132,85,0.42)", display: "inline-block" }} />
                전시
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: "rgba(26,107,60,0.42)", display: "inline-block" }} />
                교육
              </span>
            </div>

            {/* 우상단 "근 4개년" 점선 박스 배지 */}
            {trendPctLast5 !== null && (
              <div
                style={{
                  position: "absolute",
                  top: 4,
                  right: 14,
                  padding: "6px 12px",
                  borderRadius: 10,
                  border: "1.4px dashed var(--ym-ink-soft)",
                  background: "rgba(255,255,255,0.6)",
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "var(--text)",
                  letterSpacing: 0.2,
                  pointerEvents: "none",
                }}
              >
                <span style={{ color: "var(--accent)" }}>근 4개년</span>
                {" "}
                ({years[years.length - 5]}→{years[years.length - 1]}) 관람 추이
                {" "}
                <span style={{ color: trendPctLast5 >= 0 ? "var(--c3)" : "var(--danger)" }}>
                  {trendPctLast5 >= 0 ? "▲" : "▼"} {trendPctLast5 >= 0 ? "+" : ""}
                  {trendPctLast5.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 전체 실적표 */}
        <div className="ym-card" style={{ padding: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <div className="ym-card-title">
              <span className="ct-bul" />
              전체 실적표
              <span className="ym-card-sub" style={{ marginLeft: 10 }}>
                · 인원 기준
              </span>
            </div>
            {/* ‹ 2020–2025 › 페이저 — 26×26 r10 */}
            <div className="uit-pager" style={{ display: "inline-flex", alignItems: "center" }}>
              <button
                type="button"
                aria-label="이전 6년"
                disabled={tableWinStart === 0}
                onClick={() => setTableWinStart((s) => Math.max(0, s - 1))}
              >
                ‹
              </button>
              <span className="uit-pager-window">
                {windowColumns.slice(0, -1)[0]}–{windowColumns.slice(0, -1)[windowColumns.slice(0, -1).length - 1]}
              </span>
              <button
                type="button"
                aria-label="다음 6년"
                disabled={tableWinStart >= Math.max(0, years.length - 6)}
                onClick={() =>
                  setTableWinStart((s) => Math.min(Math.max(0, years.length - 6), s + 1))
                }
              >
                ›
              </button>
            </div>
          </div>
          <table className="ym-table">
            <thead>
              <tr>
                <th>구분</th>
                {windowColumns.map((c, ci) => {
                  const isLastYear = c !== "누계" && ci === windowColumns.length - 2;
                  return (
                    <th
                      key={c}
                      style={{ textAlign: "right" }}
                      className={isLastYear ? "th-year-last" : undefined}
                    >
                      {c}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {windowRows.map((row) => {
                const rowCls =
                  row.label === "공연"
                    ? "row-perf"
                    : row.label === "전시"
                      ? "row-exh"
                      : row.label === "교육"
                        ? "row-edu"
                        : "row-total";
                const sumColor =
                  row.label === "공연"
                    ? "var(--accent)"
                    : row.label === "전시"
                      ? "var(--peach-text)"
                      : row.label === "교육"
                        ? "var(--c3)"
                        : "var(--accent)";
                return (
                  <tr key={row.label} className={rowCls}>
                    <td className="td-label" style={{ fontWeight: 700 }}>
                      {row.label}
                    </td>
                    {row.cells.map((v, i) => {
                      const isLastYear = i === row.cells.length - 1;
                      return (
                        <td
                          key={i}
                          className={`td-num${isLastYear ? " td-year-last" : ""}`}
                        >
                          {v ? v.toLocaleString("ko-KR") : "—"}
                        </td>
                      );
                    })}
                    <td
                      className="td-num"
                      style={{ fontWeight: row.label === "계" ? 700 : 700, color: sumColor }}
                    >
                      {row.sum.toLocaleString("ko-KR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
          </div>
        </div>

        {/* ── 2면: 사업 현황 (셸) ── */}
        <div
          className={`bizmbox${bizLeftPage === 1 ? " bizm-page" : ""}`}
          data-bizmbox
          data-page="1"
          style={{
            display: bizLeftPage === 1 ? "flex" : "none",
            flexDirection: "column",
            background: "rgba(255,255,255,.35)",
            backdropFilter: "blur(7px)",
            WebkitBackdropFilter: "blur(7px)",
            border: "1px solid rgba(255,255,255,.7)",
            borderRadius: 20,
            boxShadow: "var(--ym-glass-shadow)",
            overflow: "hidden",
          }}
        >
          {/* 2면 헤더 — v32 §3 정의 그대로 */}
          <div
            style={{
              minHeight: 47,
              padding: "1px 18px 0",
              display: "flex",
              alignItems: "center",
              background: "rgba(255,255,255,.9)",
              backdropFilter: "blur(11px)",
              WebkitBackdropFilter: "blur(11px)",
              border: "1px solid rgba(255,255,255,.55)",
              borderBottom: "1px solid rgba(0,0,0,.07)",
              borderRadius: "20px 20px 0 0",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.6)",
            }}
          >
            <span
              style={{
                fontSize: 14.5,
                fontWeight: 800,
                color: "#4A4DE7",
                letterSpacing: "-.01em",
                lineHeight: 1,
              }}
            >
              사업 현황
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "#bbb",
                marginLeft: 8,
              }}
            >
              · 연간 누적 실적 (운영대장)
            </span>
          </div>
          {/* 2면 유리통 — 로딩 상태만 (200px min-h, 14px / #4A4DE7 / opacity .75) */}
          <div
            style={{
              background: "rgba(255,255,255,.15)",
              backdropFilter: "blur(7px)",
              border: "1px solid rgba(255,255,255,.7)",
              borderTop: "none",
              borderRadius: "0 0 20px 20px",
              padding: 18,
              flex: 1,
              minHeight: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                color: "#4A4DE7",
                opacity: 0.75,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              운영 데이터 불러오는 중
            </div>
          </div>
        </div>
      </div>

      {/* 좌 보드 페이지 컨트롤(좌 유리박스 바깥 아래) */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          margin: "16px 0 2px",
        }}
      >
        <span
          className="bizm-pgctl"
          role="group"
          aria-label="좌 보드 페이지 넘김"
        >
          <button
            type="button"
            className="nav"
            aria-label="이전 면"
            onClick={() => shiftLeft(-1)}
          >
            ‹
          </button>
          <span className="dots">
            <button
              type="button"
              className={`dot${bizLeftPage === 0 ? " on" : ""}`}
              aria-label="1페이지"
              aria-pressed={bizLeftPage === 0}
              onClick={() => {
                if (bizLeftPage !== 0) {
                  setBizLeftDir(bizLeftPage > 0 ? "rev" : "fwd");
                  setBizLeftPage(0);
                }
              }}
            />
            <button
              type="button"
              className={`dot${bizLeftPage === 1 ? " on" : ""}`}
              aria-label="2페이지"
              aria-pressed={bizLeftPage === 1}
              onClick={() => {
                if (bizLeftPage !== 1) {
                  setBizLeftDir(bizLeftPage < 1 ? "fwd" : "rev");
                  setBizLeftPage(1);
                }
              }}
            />
          </span>
          <button
            type="button"
            className="nav"
            aria-label="다음 면"
            onClick={() => shiftLeft(1)}
          >
            ›
          </button>
        </span>
      </div>
      </section>

      {/* ===================== 우측 — #sales-rail 판매 현황 ===================== */}
      <aside
        id="sales-rail"
        style={{
          /* §1 #sales-rail — 우측 50%, min-width 300px, padding:18 20 24 0 */
          width: "50%",
          minWidth: 300,
          flexShrink: 0,
          padding: "18px 20px 24px 0",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* 우 보드 페이지 컨테이너 */}
        <div
          ref={rightBoxRef}
          style={{
            display: "flex",
            flexDirection: "column",
            flex: "1 1 auto",
            minHeight: 320,
            position: "relative",
          }}
        >
          {/* 1면 — 판매 현황(현행, v31 무접촉) */}
          <div
            className={`bizmbox${bizRightPage === 0 ? " bizm-page" : ""}`}
            data-bizmbox
            data-page="0"
            style={{
              display: bizRightPage === 0 ? "flex" : "none",
              flexDirection: "column",
              background: "rgba(255,255,255,.35)",
              backdropFilter: "blur(7px)",
              WebkitBackdropFilter: "blur(7px)",
              border: "1px solid rgba(255,255,255,.7)",
              borderRadius: 20,
              boxShadow: "var(--ym-glass-shadow)",
              padding: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div className="ym-card-title">
                <span className="ct-bul" />
                판매 현황
              </div>
              <div className="ym-card-sub">프로그램 별 판매 추이</div>
              {drillIdx >= 0 && (
                <button
                  type="button"
                  className="modal-x ry-back-x"
                  title="목록으로"
                  aria-label="목록으로"
                  onClick={() => setDrillKey(null)}
                >
                  ‹
                </button>
              )}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                flex: 1,
                overflow: "auto",
              }}
            >
              {drillIdx >= 0 ? (
                <SalesDetail
                  row={salesRows[drillIdx]!}
                  index={drillIdx}
                  total={salesRows.length}
                  onStep={shiftDrill}
                  onTo={goDrill}
                />
              ) : (
                <>
                  <SalesGroup
                    title="공연"
                    count={visiblePerformances.length}
                    color={PALETTE.performance}
                    pickedKey={pickedKey}
                    onPick={onPickRow}
                    rows={visiblePerformances
                      .map((p) => buildPerformanceRow(p, opsByPerf[p.프로그램ID] ?? []))
                      .filter((x): x is NonNullable<typeof x> => x !== null)}
                  />

                  <SalesGroup
                    title="전시"
                    count={visibleExhibitions.length}
                    color={PALETTE.exhibition}
                    pickedKey={pickedKey}
                    onPick={onPickRow}
                    rows={visibleExhibitions
                      .map((p) => buildExhibitionRow(p, exhByExh[p.프로그램ID] ?? [], exhibMaster))
                      .filter((x): x is NonNullable<typeof x> => x !== null)}
                  />
                </>
              )}
            </div>
          </div>

          {/* 2면 — 셸(후속 발주) */}
          <div
            className={`bizmbox${bizRightPage === 1 ? " bizm-page" : ""}`}
            data-bizmbox
            data-page="1"
            style={{
              display: bizRightPage === 1 ? "flex" : "none",
              flexDirection: "column",
              background: "rgba(255,255,255,.35)",
              backdropFilter: "blur(7px)",
              WebkitBackdropFilter: "blur(7px)",
              border: "1px solid rgba(255,255,255,.7)",
              borderRadius: 20,
              boxShadow: "var(--ym-glass-shadow)",
              padding: 18,
              alignItems: "center",
              justifyContent: "center",
              minHeight: 300,
            }}
          >
            <div
              style={{
                color: "#4A4DE7",
                opacity: 0.75,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              운영 데이터 불러오는 중
            </div>
          </div>
        </div>

        {/* 우 보드 페이지 컨트롤(판매현황 카드 하단, 배경·보더 없음) */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px 0 2px",
          }}
        >
          <span
            className="bizm-pgctl"
            role="group"
            aria-label="우 보드 페이지 넘김"
          >
            <button
              type="button"
              className="nav"
              aria-label="이전 면"
              onClick={() => shiftRight(-1)}
            >
              ‹
            </button>
            <span className="dots">
              <button
                type="button"
                className={`dot${bizRightPage === 0 ? " on" : ""}`}
                aria-label="1페이지"
                aria-pressed={bizRightPage === 0}
                onClick={() => {
                  if (bizRightPage !== 0) {
                    setBizRightDir(bizRightPage > 0 ? "rev" : "fwd");
                    setBizRightPage(0);
                  }
                }}
              />
              <button
                type="button"
                className={`dot${bizRightPage === 1 ? " on" : ""}`}
                aria-label="2페이지"
                aria-pressed={bizRightPage === 1}
                onClick={() => {
                  if (bizRightPage !== 1) {
                    setBizRightDir(bizRightPage < 1 ? "fwd" : "rev");
                    setBizRightPage(1);
                  }
                }}
              />
            </span>
            <button
              type="button"
              className="nav"
              aria-label="다음 면"
              onClick={() => shiftRight(1)}
            >
              ›
            </button>
          </span>
        </div>
      </aside>
    </div>
  );
}

function roundTo1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** 가용 조각이 없으면 그 조각 생략 — 'null' 절대 출력 안 함 */
function buildSubline(
  periodDays: number | null,
  sessions: number | null,
  venue: string | null | undefined,
): string {
  const parts: string[] = [];
  if (periodDays !== null) parts.push(`${periodDays}일`);
  if (sessions !== null && sessions > 0 && Number.isFinite(sessions)) {
    parts.push(`${sessions}회`);
  }
  let meta = parts.join(" ");
  const cleanVenue = venue?.trim();
  if (cleanVenue) {
    meta = meta ? `${meta} | ${cleanVenue}` : cleanVenue;
  }
  return meta;
}

function buildPerformanceRow(
  program: Program,
  daily: Array<{
    기준일자: string;
    합계좌석: number;
    "전일대비(석)": number;
  }>,
) {
  const sessions = program.회차 && program.회차 > 0 ? program.회차 : null;
  const totalSlots = sessions !== null ? sessions * BASE_SEATS : null;

  const date = program.시작일 ? shortDate(program.시작일) : null;
  const subline = buildSubline(
    daysInclusive(program.시작일, program.종료일),
    sessions,
    program.장소,
  );

if (daily.length === 0) {
    return {
      programId: program.프로그램ID,
      dateText: date ? `${date.text} ${date.dow}` : "—",
      name: program.풀네임,
      subline,
      ratioText: "—",
      ratioTotalText: "—",
      ratioStrong: false,
      trend: { text: "오픈 예정", delta: null, sparkVals: [] as number[] },
      business: bizLabel(program),
      genre: program.구분 || "",
    };
  }
  const last = daily[daily.length - 1];
  const sold = last.합계좌석;
  const ratio =
    totalSlots !== null && totalSlots > 0 ? (sold / totalSlots) * 100 : null;
  const ratioRounded = ratio !== null ? Math.round(ratio) : null;

  const last7 = daily.slice(-7);
  const sparkVals = last7.map((d) => d["전일대비(석)"] || 0);
  const sparkSum = sparkVals.reduce((acc, v) => acc + v, 0);

  return {
    programId: program.프로그램ID,
    dateText: date ? `${date.text} ${date.dow}` : "—",
    name: program.풀네임,
    subline,
    ratioText:
      ratioRounded !== null ? `${ratioRounded}%` : "—",
    ratioTotalText:
      ratioRounded !== null && totalSlots !== null
        ? `(${sold.toLocaleString("ko-KR")}/${totalSlots.toLocaleString("ko-KR")})`
        : "—",
    ratioStrong: ratioRounded !== null,
    trend: {
      text: sparkSum !== 0 ? `${sparkSum >= 0 ? "+" : ""}${sparkSum}석` : "+0석",
      delta: last["전일대비(석)"] ?? 0,
      sparkVals,
    },
    business: bizLabel(program),
    genre: program.구분 || "",
  };
}

function buildExhibitionRow(
  program: Program,
  daily: Array<{
    기준일자: string;
    일일총인원: number;
    누계총인원: number;
  }>,
  masters: typeof exhibMaster,
) {
  const master = masters.find((m) => m.전시명 === program.풀네임);
  const operatingDays = master?.운영일수 ?? null;
  const date = program.시작일 ? shortDate(program.시작일) : null;

  // 전시는 일수=운영일수, 회차=없음, 장소=program.장소
  const subline = buildSubline(operatingDays, null, program.장소);

if (daily.length === 0) {
    return {
      programId: program.프로그램ID,
      dateText: date ? `${date.text} ${date.dow}` : "—",
      name: program.풀네임,
      subline,
      cumText: "—",
      ratioStrong: false,
      trend: { text: "데이터 부족", delta: null, sparkVals: [] as number[] },
      business: bizLabel(program),
      genre: program.구분 || "",
      isExhibition: true,
    };
  }
  const last = daily[daily.length - 1];
  const last7 = daily.slice(-7);
  const sparkVals = last7.map((d) => d.일일총인원 || 0);
  const sparkSum = sparkVals.reduce((acc, v) => acc + v, 0);

  return {
    programId: program.프로그램ID,
    dateText: date ? `${date.text} ${date.dow}` : "—",
    name: program.풀네임,
    subline,
    cumText: `${(last.누계총인원 ?? 0).toLocaleString("ko-KR")}명`,
    ratioStrong: true,
    trend: {
      text:
        sparkSum !== 0
          ? `${sparkSum >= 0 ? "+" : ""}${sparkSum}명`
          : "+0명",
      delta: last.일일총인원 ?? 0,
      sparkVals,
    },
    business: bizLabel(program),
    genre: program.구분 || "",
    isExhibition: true,
  };
}

type RowBase = {
  /** programs.프로그램ID — 클릭 시 drill 라우팅 키로 사용 */
  programId: string;
  dateText: string;
  name: string;
  subline: string;
  ratioStrong: boolean;
  trend: {
    text: string;
    delta: number | null;
    sparkVals: number[];
  };
  business: string;
  genre: string;
  isExhibition?: boolean;
};
type PerfRow = RowBase & { ratioText: string; ratioTotalText: string };
type ExhRow = RowBase & { cumText: string };
type SalesRow = PerfRow | ExhRow;

/* ────────────────────────────────────────────────────────────────────────
   상세 카드용 SalesRowDTO 빌더 (정본 .srail-* 셀렉터에 맞춤).
   표 행용 SalesRow 빌더와는 별개로 운영 — 표는 목록 그대로 두고
   카드는 풀 메타·점유·AI예약까지 모두 표시.
   빌더는 useMemo 내부에 closure로 두어 현재 컴포넌트의
   opsMasterByID / exhibMasterByName 인덱스에 접근한다.
   ──────────────────────────────────────────────────────────────────────── */
// type OpsMasterRow = (typeof opsMaster)[number];
// type ExhibMasterRow = (typeof exhibMaster)[number];
type OpsDailyRow = (typeof opsDaily)[number];
type ExhibDailyRow = (typeof exhibDaily)[number];

function SalesGroup({
  title,
  count,
  color,
  rows,
  pickedKey,
  onPick,
}: {
  title: string;
  count: number;
  color: string;
  rows: SalesRow[];
  pickedKey: string | null;
  onPick: (k: string) => void;
}) {
  return (
    <section>
      <div className="ym-rail-hd">
        <span className="grp-dot" style={{ background: color }} />
        <span>{title}</span>
        <span className="grp-count">{count}</span>
      </div>
      <table className="ym-table" style={{ tableLayout: "fixed", width: "100%" }}>
        {/* colgroup 단독 소유 (v33 §3-b) */}
        <colgroup>
          <col style={{ width: "10%" }} />
          <col style={{ width: "24%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "24%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "11%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>일자</th>
            <th>프로그램</th>
            <th>{title === "전시" ? "누적 관객수" : "판매율"}</th>
            <th>최근 7일 추이</th>
            <th>사업 성격</th>
            <th>장르</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const bizShown = mapBiz(r.business, r.isExhibition ?? false);
            const genreShown = parenGenre(r.genre, r.isExhibition ?? false);
            return (
              <tr
                key={i}
                className={
                  pickedKey && (r.isExhibition ? `exh-${r.name}` : `perf-${r.name}`) === pickedKey
                    ? "clk on ctk-sel"
                    : "clk"
                }
                role="button"
                tabIndex={0}
                data-uhakey={r.programId}
                onClick={() => onPick(r.programId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onPick(r.programId);
                  }
                }}
              >
                <td className="td-muted" style={{ paddingLeft: 14 }}>{r.dateText}</td>
                <td style={{ overflow: "hidden" }}>
                  <div
                    title={`${r.name} · ${(r.subline || "").replace(/\|.*$/, "").trim()}`}
                    style={{
                      fontWeight: 700,
                      color: "var(--text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.name}
                  </div>
                  {r.subline && (
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 500,
                        color: "#888",
                        marginTop: 4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.subline}
                    </div>
                  )}
                </td>
                <td
                  className={r.ratioStrong ? "td-strong" : "td-muted"}
                  style={{ whiteSpace: "nowrap", verticalAlign: "top" }}
                >
                  {r.isExhibition ? (
                    <>
                      <b style={{ color: "#4A4DE7", fontWeight: 800 }}>{(r as ExhRow).cumText}</b>
                      <span style={{ color: "#888", fontSize: 11.5 }}>명</span>
                    </>
                  ) : (
                    <>
                      {(r as PerfRow).ratioText ? (
                        <>
                          <b style={{ color: "#4A4DE7", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                            {(r as PerfRow).ratioText}
                          </b>
                          {(r as PerfRow).ratioTotalText ? (
                            <span style={{ color: "#888", fontSize: 11.5, marginLeft: 4 }}>
                              {(r as PerfRow).ratioTotalText}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span style={{ color: "#bbb", fontSize: 12 }}>—</span>
                      )}
                    </>
                  )}
                </td>
                <td>
                  <Sparkline
                    vals={r.trend.sparkVals}
                    unit={r.isExhibition ? "명" : "석"}
                    delta={r.trend.delta}
                  />
                </td>
                <td style={{ paddingRight: 14, verticalAlign: "top" }}>
                  <span
                    style={{
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                      color: bizShown === "사업성" ? "#4A4DE7" : "#D88455",
                    }}
                  >
                    {bizShown}
                  </span>
                </td>
                <td style={{ paddingRight: 14, verticalAlign: "top" }}>
                  <span
                    style={{
                      color: "#6B6B7B",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {genreShown}
                  </span>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={6}
                style={{ padding: "22px 8px", textAlign: "center", color: "#888", fontSize: 12.5 }}
              >
                🎫 지금 판매·진행중인 프로그램이 없어요
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
/* v35 §4 — 미니차트
   컨테이너 display:inline-flex; align-items:flex-end; justify-content:flex-end; gap:3px; height:28px
   막대 flex:0 0 7px; border-radius:2px; height:max(12%, 값/최대값*100%)
   색 2종만: 최신(맨 오른쪽) #4A4DE7, 나머지 #E8E8FD.
   막대 = 최근 7일 일별 증분(누계 인접 차, 음수는 0). 1일치면 1개.
   우측 요약: 1행 +{7일합}{단위}/#4A4DE7/800/13px, 2행 어제 {부호}{값}/#888/11px (0 이상은 + 필수).
   오픈 전/무데이터: #bbb 12px 1행만 표시(3열은 —). */
function Sparkline({
  vals,
  unit,
  delta,
  isOpen,
  noData,
}: {
  vals: number[];
  unit: "석" | "명";
  delta: number | null;
  isOpen?: boolean;
  noData?: boolean;
}) {
  const raw = (vals || []).slice(-7);
  const incs: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (i === 0) {
      incs.push(Math.max(0, raw[i]));
    } else {
      incs.push(Math.max(0, raw[i] - raw[i - 1]));
    }
  }
  const sum7 = incs.reduce((a, v) => a + v, 0);
  const maxV = Math.max(1, ...incs);

  if (noData || (vals || []).length === 0) {
    return (
      <div style={{ fontSize: 12, color: "#bbb" }}>데이터 부족</div>
    );
  }
  if (isOpen) {
    return (
      <div style={{ fontSize: 12, color: "#bbb" }}>오픈 예정</div>
    );
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, height: 28 }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "flex-end",
          justifyContent: "flex-end",
          gap: 3,
          height: 28,
        }}
      >
        {incs.length === 0 ? null : incs.map((v, i) => {
          const isLast = i === incs.length - 1;
          const pct = (v / maxV) * 100;
          const h = Math.max(12, pct);
          return (
            <span
              key={i}
              style={{
                flex: "0 0 7px",
                width: 7,
                height: `${h}%`,
                borderRadius: 2,
                background: isLast ? "#4A4DE7" : "#E8E8FD",
                display: "inline-block",
              }}
            />
          );
        })}
      </div>
      <div style={{ marginLeft: 10, textAlign: "right", minWidth: 56 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: "#4A4DE7" }}>
          +{sum7.toLocaleString("ko-KR")}{unit}
        </div>
        <div style={{ fontWeight: 400, fontSize: 11, color: "#888", marginTop: 2 }}>
          어제 {delta === null ? "—" : `${delta >= 0 ? "+" : ""}${delta.toLocaleString("ko-KR")}`}
        </div>
      </div>
    </div>
  );
}
