import { pad2 } from "@/lib/format";

// 홈페이지 이용약관 제14조 ①: 취소 요청일(한국 날짜) 기준 결제금액 환불 비율.
//   예식 7일 전까지 전액 · 6~3일 전 50% · 2일 전~당일 30%. 예식일이 지나면 고객이 직접 취소할 수 없다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface RefundQuote {
  /** 예식일까지 남은 날 (당일 0). 예식일을 모르면 null */
  daysLeft: number | null;
  /** 0~1 */
  rate: number;
  amount: number;
  /** 고객이 홈페이지에서 직접 취소할 수 있는지 */
  selfCancellable: boolean;
  label: string;
}

export function kstToday(now = new Date()) {
  const k = new Date(now.getTime() + KST_OFFSET_MS);
  return `${k.getUTCFullYear()}-${pad2(k.getUTCMonth() + 1)}-${pad2(k.getUTCDate())}`;
}

function daysBetween(from: string, to: string) {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS);
}

export function refundQuote(ceremonyDate: string, paidAmount: number, now = new Date()): RefundQuote {
  const paid = Math.max(0, paidAmount);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ceremonyDate)) {
    return { daysLeft: null, rate: 1, amount: paid, selfCancellable: false, label: "예식일 미정" };
  }
  const daysLeft = daysBetween(kstToday(now), ceremonyDate);
  if (daysLeft < 0) return { daysLeft, rate: 0, amount: 0, selfCancellable: false, label: "예식일 지남" };
  const rate = daysLeft >= 7 ? 1 : daysLeft >= 3 ? 0.5 : 0.3;
  const label = daysLeft >= 7 ? "예식 7일 전까지 · 전액 환불" : daysLeft >= 3 ? "예식 6일 전~3일 전 · 50% 환불" : "예식 2일 전~당일 · 30% 환불";
  return { daysLeft, rate, amount: Math.floor(paid * rate), selfCancellable: true, label };
}
