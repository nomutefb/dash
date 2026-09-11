export type ContentCategory =
  | "공연"
  | "전시"
  | "예술교육"
  | "대관"
  | "기타";

export type Program = {
  no: number;
  category: ContentCategory | string;
  fullName: string;
  shortName: string;
  saleStart: string | null;
  saleEnd: string | null;
  startDate: string | null;
  endDate: string | null;
  manager: string;
  venue: string;
  url: string;
  programId: string;
  promoStart: string | null;
  subCategory: string;
  coPlan: boolean;
  supportedBiz: boolean;
  gsArtCenter: boolean;
  sessions: string;
  profitability: string;
  promoExposure: boolean;
};

export type SpecialEntry = {
  startDate: string;
  endDate: string;
  time: string;
  type: string;
  content: string;
  manager: string;
};

export type OpsPerformanceMaster = {
  bizName: string;
  id: string;
  baseSeats: number;
  totalSessions: number;
  totalOpenSeats: number;
  targetOccupancy: number | null;
  profitability: string;
  ticketOpenDate: string | null;
  endDate: string;
  startDate: string;
  status: string;
};

export type ExhibMaster = {
  exhibId: string;
  exhibName: string;
  year: string;
  startDate: string;
  endDate: string;
  operatingDays: number;
  targetAudience: number;
  targetRevenue: number;
  finalAttendance: number;
  finalRevenue: number;
  finalOccupancy: number;
  status: string;
};

export type RecordRow = {
  no: string;
  inputTimeKst: string;
  date: string | null;
  year: string;
  month: string;
  day: string;
  weekday: string;
  platform1: string;
  platform2: string;
  category: string;
  program: string;
  dept: string;
  contentTitle: string;
  contentFormat: string;
  contentBody: string;
  postedManager: string;
  status: string;
  note: string;
  applicant: string;
  performanceId: string;
  _raw: Record<string, string>;
};

export type DailyOps = {
  date: string;
  performanceName: string;
  paidSeats: number;
  paidAmount: number;
  freeSeats: number;
  totalSeats: number;
  totalAmount: number;
  occupancy: number;
  prevDayDelta: number;
  performanceId: string;
  excluded: string;
};

export type RecordStatus =
  | "신청 중"
  | "예정"
  | "완료"
  | "보류"
  | "취소"
  | "반려"
  | "임시"
  | "승인"
  | string;
