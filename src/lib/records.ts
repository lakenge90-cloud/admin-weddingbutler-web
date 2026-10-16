import crypto from "crypto";
import type { RecordEntry, RecordLink, Reservation } from "@prisma/client";
import { EXTRA_GUEST_FEE, planMeta } from "@/lib/pricing";

// 고객 축의 기록 공용 로직 (서버 전용). 홈페이지 /r/[token]이 /api/public/records/* 로 읽어 간다.

export const RETENTION_DAYS = 90;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_SENDS_PER_HOUR = 5;

export type RecordStatus = "draft" | "published" | "revoked";
export type RecordMode = "opened" | "sealed";
export type Side = "신랑측" | "신부측";

const PLAN_CODE: Record<string, "small" | "standard" | "premium"> = {
  스몰케어: "small",
  스탠다드: "standard",
  프리미엄: "premium",
};

export function planCode(planKey: string) {
  return PLAN_CODE[planKey] ?? "standard";
}

/** 추측할 수 없는 24자 URL 토큰 */
export function newToken() {
  return crypto.randomBytes(18).toString("base64url");
}

export function homepageUrl() {
  return (process.env.HOMEPAGE_URL || "https://weddingbutler.co.kr").replace(/\/$/, "");
}

/** 홈페이지와 공유하는 키. 별도 키가 없으면 예약 연동 키를 그대로 쓴다. */
export function recordApiKey() {
  return process.env.RECORD_API_KEY || process.env.RESERVATION_API_KEY || "";
}

/** 고객 기록 페이지 도메인. 홈페이지가 report.weddingbutler.co.kr/<토큰> 을 기록 화면으로 연결한다. */
export function reportUrl() {
  return (process.env.REPORT_URL || "https://report.weddingbutler.co.kr").replace(/\/$/, "");
}

export function customerUrl(token: string) {
  return `${reportUrl()}/${token}`;
}

function hmac(value: string) {
  return crypto.createHmac("sha256", recordApiKey()).update(value).digest("base64url");
}

/** 관리자가 문자 인증 없이 고객 화면을 여는 10분짜리 서명 링크 (홈페이지가 같은 키로 검증) */
export function adminPreviewUrl(token: string): string | null {
  if (!recordApiKey()) return null;
  const exp = Math.floor(Date.now() / 1000) + 600;
  return `${customerUrl(token)}?admin=${exp}.${hmac(`admin.${token}.${exp}`)}`;
}

export function maskPhone(phone: string) {
  const digits = phone.replace(/[^0-9]/g, "");
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

export function hashOtp(recordLinkId: string, code: string) {
  return crypto.createHash("sha256").update(`${recordLinkId}:${code}`).digest("hex");
}

export function otpMatches(recordLinkId: string, code: string, codeHash: string) {
  const a = Buffer.from(hashOtp(recordLinkId, code));
  const b = Buffer.from(codeHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function isExpired(link: Pick<RecordLink, "expiresAt">, now = new Date()) {
  return Boolean(link.expiresAt && link.expiresAt.getTime() < now.getTime());
}

export function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

/** "2026-10-25T15:10" (KST 입력) ↔ Date */
export function fromKstInput(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  return new Date(`${v}:00+09:00`);
}

export function toKstInput(d: Date | null) {
  if (!d) return "";
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

/** 홈페이지 RecordView에 그대로 넘길 payload. 밀봉이면 amount 키 자체를 뺀다. */
export function buildRecordPayload(link: RecordLink & { reservation: Reservation; entries: RecordEntry[] }) {
  const r = link.reservation;
  const meta = planMeta(r.confirmPlan);
  const sealed = link.recordMode === "sealed";
  const time = /^\d{2}:\d{2}$/.test(r.confirmTime) ? r.confirmTime : "00:00";
  const publishedAt = link.publishedAt ?? new Date();

  return {
    meta: {
      bookingNo: r.id,
      coupleName: r.couple,
      weddingAt: `${r.confirmDate}T${time}:00+09:00`,
      venueName: r.confirmVenue,
      plan: planCode(r.confirmPlan),
      recordMode: sealed ? "sealed" : "opened",
      publishedAt: publishedAt.toISOString(),
      handoverAt: (link.handoverAt ?? publishedAt).toISOString(),
      handoverEnvelopeCount: link.handoverEnvelopeCount,
      receiverLabel: link.receiverLabel,
      staffCount: link.staffCount || r.confirmButlers,
      version: Math.max(1, link.version),
      expiresAt: (link.expiresAt ?? addDays(publishedAt, RETENTION_DAYS)).toISOString(),
      baseGuests: meta.guestLimit,
      extraGuestFee: EXTRA_GUEST_FEE,
      ...(link.videoUrl ? { videoUrl: link.videoUrl } : {}),
    },
    entries: link.entries
      .slice()
      .sort((a, b) => a.envelopeNo - b.envelopeNo)
      .map((e) => ({
        envelopeNo: e.envelopeNo,
        side: e.side,
        name: e.name,
        ...(e.relation ? { relation: e.relation } : {}),
        ...(!sealed && e.amount != null ? { amount: e.amount } : {}),
        tickets: e.tickets,
        ...(e.memo ? { memo: e.memo } : {}),
      })),
  };
}
