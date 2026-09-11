import data from "./yeulmaru.json";

export type RecordsStatus =
  | "완료"
  | "취소"
  | "보류"
  | "예정"
  | string;

export type RecordRow = {
  No: string;
  "입력시간(KST)": string;
  "날짜": string | null;
  "연도": string;
  "월": string;
  "일": string;
  "요일": string;
  "플랫폼 1": string;
  "플랫폼 2": string;
  "콘텐츠 구분": string;
  "프로그램": string;
  "담당 부서": string;
  "콘텐츠 제목": string;
  "콘텐츠 형식": string;
  "콘텐츠 내용": string;
  "게시 담당자": string;
  "진행 상태": RecordsStatus;
  비고: string;
  신청자: string;
  결과_링크?: string;
  결과_첨부URL?: string;
  결과_비고?: string;
  "직전 상태"?: string;
  "상태 변경 KST"?: string;
  보류사유?: string;
  재신청사유?: string;
  취소사유?: string;
  공연ID?: string;
};

export type Program = {
  NO: number;
  콘텐츠구분: string;
  풀네임: string;
  줄임말: string;
  판매시작일: string | null;
  판매종료일: string | null;
  시작일: string | null;
  종료일: string | null;
  담당자: string;
  장소: string;
  URL: string;
  프로그램ID: string;
  홍보시작일: string | null;
  구분: string;
  공동기획여부: string;
  지원사업여부: string;
  GS아트센터협업여부: string;
  회차: number;
  수익성: string;
  홍보노출: string;
};

export type SpecialRow = {
  시작일: string;
  종료일: string;
  시간: string;
  유형: string;
  내용: string;
  담당자: string;
};

export type OpsMasterRow = {
  사업명: string;
  ID: string;
  기준석: number;
  총회차: number;
  총오픈석: number;
  목표점유율: number | null;
  수익성: string;
  티켓오픈일: string | null;
  종료일: string;
  시작일: string;
  상태: string;
};

export type OpsDailyRow = {
  기준일자: string;
  공연명: string;
  유료좌석: number;
  유료금액: number;
  무료좌석: number;
  합계좌석: number;
  합계금액: number;
  점유율: number;
  "전일대비(석)": number;
  공연ID: string;
  예측제외: string;
};

export type ExhibMasterRow = {
  전시ID: string;
  전시명: string;
  연도: string;
  시작일: string;
  종료일: string;
  운영일수: number;
  목표관객: number;
  목표금액: number;
  최종유료: number;
  최종무료: number;
  최종총인원: number;
  최종매출: number;
  최종점유율: number;
  수익성: string;
  상태: string;
};

export type ExhibDailyRow = {
  기준일자: string;
  전시ID: string;
  전시명: string;
  일일유료: number;
  일일무료: number;
  일일총인원: number;
  일일금액: number;
  누계유료: number;
  누계무료: number;
  누계총인원: number;
  누계금액: number;
  점유율: number;
};

export type AnnualCategory = {
  tok: string;
  rows: Array<{
    sub: string;
    key: string;
    v: Array<number | null>;
    q: number;
    sum: number;
  }>;
};

export type AnnualData = {
  years: number[];
  total: Record<string, { sub: string; key: string; v: Array<number | null>; q: number; sum: number }>;
  cats: {
    공연: AnnualCategory;
    전시: AnnualCategory;
    교육: AnnualCategory;
  };
  jangdo?: { v: Array<number | null>; sum: number };
  grand?: number;
};

export const records = (data.records ?? []) as unknown as RecordRow[];
export const programs = (data.programs ?? []) as unknown as Program[];
export const special = (data.special ?? []) as unknown as SpecialRow[];
export const opsMaster = (data.opsMaster ?? []) as unknown as OpsMasterRow[];
export const opsDaily = (data.opsDaily ?? []) as unknown as OpsDailyRow[];
export const exhibMaster = (data.exhibMaster ?? []) as unknown as ExhibMasterRow[];
export const exhibDaily = (data.exhibDaily ?? []) as unknown as ExhibDailyRow[];
export const platforms = (data.platforms ?? []) as unknown[];
export const contents = (data.contents ?? []) as unknown[];
export const applySettings = (data.applySettings ?? {}) as Record<string, unknown>;
export const annual = (data.annual ?? {}) as unknown as AnnualData;

export const all = data as unknown as Record<string, unknown>;

export const STATUS_LABELS: Record<string, string> = {
  완료: "완료",
  취소: "취소",
  보류: "보류",
  예정: "예정",
  "신청 중": "신청 중",
  반려: "반려",
  임시: "임시",
  승인: "승인",
};

export function isVisibleStatus(s: string | undefined | null): boolean {
  if (!s) return false;
  return s !== "임시";
}
