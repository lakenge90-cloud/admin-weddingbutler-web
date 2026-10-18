import crypto from "crypto";
import type { Reservation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatWishDateLabel } from "@/lib/format";
import { refundQuote } from "@/lib/refundPolicy";

// 홈페이지 "예약 조회": 예약자 휴대폰 번호 + 문자 인증번호로 본인 확인 후 그 번호의 예약을 보여 준다.

export const LOOKUP_OTP_TTL_MS = 5 * 60 * 1000;
export const LOOKUP_OTP_MAX_ATTEMPTS = 5;
export const LOOKUP_OTP_MAX_SENDS_PER_HOUR = 5;

/** 010으로 시작하는 휴대폰 번호면 숫자만 돌려준다 */
export function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const d = value.replace(/[^0-9]/g, "");
  return /^01[016789]\d{7,8}$/.test(d) ? d : null;
}

// 예약의 phone은 입력 그대로 저장돼 있어 하이픈 있는/없는 형식을 모두 찾는다.
function phoneVariants(d: string) {
  const v = new Set([d]);
  if (d.length === 11) v.add(`${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`);
  if (d.length === 10) v.add(`${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`);
  return Array.from(v);
}

export function findReservationsByPhone(phone: string) {
  return prisma.reservation.findMany({
    where: { phone: { in: phoneVariants(phone) } },
    orderBy: { confirmDate: "asc" },
  });
}

export function hashLookupOtp(phone: string, code: string) {
  return crypto.createHash("sha256").update(`lookup:${phone}:${code}`).digest("hex");
}

export function lookupOtpMatches(phone: string, code: string, codeHash: string) {
  const a = Buffer.from(hashLookupOtp(phone, code));
  const b = Buffer.from(codeHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** 홈페이지 조회 화면에 보내는 예약 한 건 */
export function toLookupItem(r: Reservation) {
  const cancelled = r.status === "취소";
  const quote = refundQuote(r.confirmDate, r.paidAmount);
  return {
    id: r.id,
    status: r.status,
    plan: r.confirmPlan || r.requestedPlan,
    dateLabel: r.confirmDate ? formatWishDateLabel(r.confirmDate, r.confirmTime) : r.wishDateLabel,
    venue: r.confirmVenue || r.venueLabel,
    customer: r.customer,
    paidAmount: r.paidAmount,
    cancel: cancelled
      ? { reason: r.cancelReason, refundAmount: r.refundAmount, cancelledAt: r.cancelledAt?.toISOString() ?? null }
      : null,
    refund: cancelled ? null : { cancellable: quote.selfCancellable, amount: quote.amount, rate: quote.rate, label: quote.label },
  };
}
