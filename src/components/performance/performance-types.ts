/**
 * 판매 현황 카드(공연/전시/noData)에 공통으로 필요한 행 DTO.
 * PerformanceView가 만들어서 SalesDetail로 내려준다.
 *
 * 모든 값은 화면에 직접 표시되는 정본 형태로 미리 가공되어 있다.
 *  - occupancy: nullable % (소수 1자리).  null = noData
 *  - sold: nullable 누적 좌석/관객
 *  - totalSlots: OPEN석 (`회차 × 926` 또는 전시 정원/없음)
 *  - gapPct: 점유율 - 목표 (소수 1자리, 부호). null = 미집계
 *  - sparkVals: 최근 일자 합계 좌석(또는 일일 관객) — 시계 순서.
 *  - attendance: 전시 누계총인원(공연은 0으로 두고 씀)
 *  - paidAttendance: 전시 누계유료
 *  - targetAttendance: 전시 목표관객, 없을 시 null
 */
export type SalesRowDTO = {
  /** 목록에서 클릭 시 행을 식별하는 안정 키 (= 프로그램ID) */
  key: string;
  isExhibition: boolean;
  noData: boolean;
  /** 카드 위 표시되는 풀네임 (React가 안전하게 렌더) */
  displayName: string;
  /** 메타 라인 전체 텍스트. CSS가 모양만 잡는다. */
  metaLine: string;
  /** D-day 라벨 — 공연: `D-N`, 전시: `종료 D-N` */
  ddayLabel: string;
  /** 점유율 % (1자리) — noData면 null */
  occupancy: number | null;
  /** 점유 - 목표 = 음/양 부호 포함 소수 1자리 p. null이면 미표시 */
  gapPct: number | null;
  /** 어제대비 %p. ±기호 없음. null = 수집전. 임계 ±0.04 */
  yoyDeltaPct: number | null;
  /** 누적 판매 (좌석 또는 관객) — noData면 0 */
  sold: number | null;
  /** OPEN슬롯 (회차 × 기준석) — noData여도 표시용으로 채움 */
  totalSlots: number;
  /** 목표 점유율 %. 없으면 null (브런치 III는 opsMaster가 없으므로 → 정책 50%) */
  targetOccupancy: number | null;
  /** sparkline용 시계열 (마지막 점 = 오늘) */
  sparkVals: number[];
  /** 전시 누적 관객 */
  attendance?: number;
  /** 전시 유료 관객 */
  paidAttendance?: number;
  /** 전시 목표 관객 (없으면 null) */
  targetAttendance?: number | null;
  /** AI forecast의 단위('석'|'명'). noData면 빈 텍스트 */
  forecastUnit?: "석" | "명" | "";
  /** [v45 정본] 전 기간 일평균 %p/일 (0~100). fcRate = (마지막 점유율 - 시작 점유율) / 경과일. fcRate != null + totalOpen > 0 일 때 forecast 외삽에 사용. */
  fcRate?: number | null;
  /** [v45 정본] OPEN슬롯. 공연 = 회차 × 926, 전시 = 0(null 가능). */
  totalOpen?: number;
  /** 예매자 집계는 원천 ops_예매/ops_회원이 있을 때만 채워진다. */
  booking?: BookingStats;
  sparkDates?: string[];
};

export type BookingStats = {
  count: number;
  tickets: number;
  ages: Record<string, number>;
  residences: Array<{ label: string; value: number }>;
  channels: Array<{ label: string; value: number }>;
  topPrograms: Array<{ label: string; value: number }>;
};
