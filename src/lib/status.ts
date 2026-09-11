export type StatusClass =
  | "completed"
  | "cancelled"
  | "pending"
  | "approved"
  | "special"
  | "hidden";

export function statusClass(raw: string): StatusClass {
  const s = (raw || "").trim();
  if (!s) return "hidden";
  if (s === "임시") return "hidden";
  if (s === "완료") return "completed";
  if (s === "취소" || s === "반려") return "cancelled";
  if (s === "신청 중" || s === "보류") return "pending";
  if (s === "예정" || s === "승인") return "approved";
  if (s.includes("완료")) return "completed";
  if (s.includes("취소") || s.includes("반려")) return "cancelled";
  if (s.includes("신청") || s.includes("보류")) return "pending";
  if (s.includes("예정") || s.includes("승인")) return "approved";
  return "hidden";
}

export function isVisibleStatus(raw: string): boolean {
  return statusClass(raw) !== "hidden";
}

export const STATUS_LABELS: Record<StatusClass, string> = {
  completed: "완료",
  cancelled: "취소·반려",
  pending: "신청 중·보류",
  approved: "예정·승인",
  special: "특별일정",
  hidden: "임시(숨김)",
};
