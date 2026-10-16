"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcConfirm, isPaymentType, isSide, onsiteAmount, paymentTypeName, planMeta, won } from "@/lib/pricing";
import { formatWishDateLabel } from "@/lib/format";
import { sendConfirmAlimtalk } from "@/lib/alimtalk";
import { sendNewReservationKakaoWorkNotice } from "@/lib/kakaowork";
import { requestPaymentCancel } from "@/lib/paymentCancel";

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("로그인이 필요합니다.");
  return session;
}

function revalidateAll() {
  revalidatePath("/reservations");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
}

export interface ConfirmFieldsInput {
  date: string;
  time: string;
  venue: string;
  butlers: number;
  extraGuests: number;
  discount: number;
  hours: string;
  note: string;
  paidAmount: number;
  paymentType: string;
}

export async function saveConfirmFields(id: string, fields: ConfirmFieldsInput) {
  await requireSession();
  // 확정된 예약은 재협의로 되돌린 뒤에만 고칠 수 있다
  await prisma.reservation.updateMany({
    where: { id, status: { not: "확정" } },
    data: {
      confirmDate: fields.date,
      confirmTime: fields.time,
      confirmVenue: fields.venue,
      confirmButlers: fields.butlers,
      confirmExtraGuests: fields.extraGuests,
      confirmDiscount: fields.discount,
      confirmHours: fields.hours,
      confirmNote: fields.note,
      paidAmount: fields.paidAmount,
      paymentType: isPaymentType(fields.paymentType) ? fields.paymentType : "",
    },
  });
  revalidateAll();
}

export async function confirmReservation(id: string, fields: ConfirmFieldsInput) {
  await requireSession();
  const existing = await prisma.reservation.findUniqueOrThrow({ where: { id } });
  const wasConfirmed = existing.status === "확정";

  const updated = await prisma.reservation.update({
    where: { id },
    data: {
      status: "확정",
      confirmDate: fields.date,
      confirmTime: fields.time,
      confirmVenue: fields.venue,
      confirmButlers: fields.butlers,
      confirmExtraGuests: fields.extraGuests,
      confirmDiscount: fields.discount,
      confirmHours: fields.hours,
      confirmNote: fields.note,
      paidAmount: fields.paidAmount,
      paymentType: isPaymentType(fields.paymentType) ? fields.paymentType : "",
    },
  });

  const price = calcConfirm({ plan: updated.confirmPlan, butlers: updated.confirmButlers, extraGuests: updated.confirmExtraGuests, discount: updated.confirmDiscount });
  const result = await sendConfirmAlimtalk({
    reservationId: updated.id,
    customer: updated.customer,
    couple: updated.couple,
    phone: updated.phone,
    wishDateLabel: formatWishDateLabel(updated.confirmDate, updated.confirmTime),
    venueLabel: updated.confirmVenue,
    guestsLabel: updated.guestsLabel,
    requestedPlan: updated.confirmPlan,
    planAmount: planMeta(updated.confirmPlan).base,
    paidAmount: updated.paidAmount,
    confirmAmount: price.total,
    balanceAmount: Math.max(0, price.total - updated.paidAmount),
  });
  await prisma.reservation.update({ where: { id }, data: { alimtalkAt: new Date() } });

  // 운영팀 카카오워크 알림방(신규 예약 알림과 같은 방)에도 확정 사실을 알린다. 실패해도 확정은 유지된다.
  const onsite = onsiteAmount(price.total, updated.paidAmount);
  await sendNewReservationKakaoWorkNotice(
    [
      `${wasConfirmed ? "확정 내용 변경" : "예약 확정"} (${updated.id})`,
      `고객: ${updated.customer} (${updated.couple}) · ${updated.phone}`,
      `예식: ${formatWishDateLabel(updated.confirmDate, updated.confirmTime)} · ${updated.confirmVenue}`,
      `플랜: ${updated.confirmPlan} · 버틀러 ${updated.confirmButlers}명`,
      `결제: ${paymentTypeName(updated.paymentType, updated.paidAmount, price.total)} · 결제 ${won(updated.paidAmount)} · 현장(현금) ${won(onsite)}`,
      `고객 알림톡: ${result.detail}`,
    ].join("\n")
  );

  revalidateAll();
  return {
    message: wasConfirmed
      ? "확정 내용이 저장되었습니다."
      : `${updated.customer} 님 예약이 확정되어 캘린더에 등록되었습니다.`,
    alimtalk: result,
  };
}

/** 확정된 예약을 협의중으로 되돌려 확정 내용을 다시 고칠 수 있게 한다 */
export async function reopenReservation(id: string) {
  await requireSession();
  const { count } = await prisma.reservation.updateMany({ where: { id, status: "확정" }, data: { status: "협의중" } });
  revalidateAll();
  return { message: count ? "재협의 상태로 바꿨습니다. 내용을 고친 뒤 다시 확정해 주세요." : "확정된 예약이 아닙니다." };
}

export async function holdReservation(id: string) {
  await requireSession();
  const updated = await prisma.reservation.update({ where: { id }, data: { status: "협의중" } });
  revalidateAll();
  return { message: "협의 중 상태로 변경했습니다.", id: updated.id };
}

export type CancelResult =
  | { ok: true; message: string }
  | { ok: false; needsNoPaymentConfirm: boolean; message: string };

// 예약 취소. 기본은 홈페이지를 통해 이니시스 결제를 전액 취소한 뒤 상태를 "취소"로 바꾼다.
// 홈페이지에 결제 완료 기록이 없으면(수동 등록 건 등) needsNoPaymentConfirm으로 알려 주고,
// 운영자가 다시 확인하면 skipPayment로 결제취소 없이 예약만 취소한다.
export async function cancelReservation(id: string, reason: string, skipPayment = false): Promise<CancelResult> {
  await requireSession();
  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, needsNoPaymentConfirm: false, message: "취소 사유를 입력해 주세요." };

  const existing = await prisma.reservation.findUniqueOrThrow({ where: { id } });
  if (existing.status === "취소") return { ok: false, needsNoPaymentConfirm: false, message: "이미 취소된 예약입니다." };

  let refundAmount = 0;
  if (!skipPayment) {
    const result = await requestPaymentCancel(id, trimmed);
    if (result.state === "error") return { ok: false, needsNoPaymentConfirm: false, message: result.message };
    if (result.state === "no_payment") return { ok: false, needsNoPaymentConfirm: true, message: result.message };
    refundAmount = result.refundAmount;
  }

  await prisma.reservation.update({
    where: { id },
    data: { status: "취소", cancelReason: trimmed, cancelledAt: new Date(), refundAmount },
  });
  await prisma.note.create({
    data: {
      reservationId: id,
      text: skipPayment
        ? `예약 취소 (결제취소 없음) · 사유: ${trimmed}`
        : `예약 취소 · 결제 ${refundAmount.toLocaleString("ko-KR")}원 환불 요청 · 사유: ${trimmed}`,
    },
  });
  revalidateAll();
  return {
    ok: true,
    message: skipPayment ? "예약을 취소했습니다." : "예약을 취소하고 이니시스에 결제취소를 요청했습니다.",
  };
}

export async function addNote(id: string, text: string) {
  await requireSession();
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, message: "협의 내용을 입력해 주세요." };

  const existing = await prisma.reservation.findUniqueOrThrow({ where: { id } });
  await prisma.note.create({ data: { reservationId: id, text: trimmed } });
  if (existing.status === "신규요청") {
    await prisma.reservation.update({ where: { id }, data: { status: "협의중" } });
  }
  revalidateAll();
  return { ok: true, message: "고객 요청 기록이 추가되었습니다." };
}

export interface NewReservationInput {
  customer: string;
  couple: string;
  side?: string;
  phone: string;
  wishDateLabel: string;
  venueLabel: string;
  guestsLabel: string;
  memo: string;
  requestedPlan: string;
  paidAmount?: number;
  paymentType?: string;
}

function generateId() {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `WB-${datePart}-${suffix}`;
}

export async function createReservation(input: NewReservationInput) {
  await requireSession();
  const id = generateId();
  const now = new Date();
  await prisma.reservation.create({
    data: {
      id,
      customer: input.customer,
      couple: input.couple,
      side: isSide(input.side) ? input.side : "",
      phone: input.phone,
      requestedAt: now,
      wishDateLabel: input.wishDateLabel,
      venueLabel: input.venueLabel,
      guestsLabel: input.guestsLabel,
      memo: input.memo,
      status: "신규요청",
      requestedPlan: input.requestedPlan,
      confirmPlan: input.requestedPlan,
      confirmDate: now.toISOString().slice(0, 10),
      confirmTime: "12:00",
      confirmVenue: input.venueLabel,
      confirmButlers: 2,
      confirmExtraGuests: 0,
      confirmDiscount: 0,
      confirmHours: "",
      confirmNote: "",
      paidAmount: input.paidAmount ?? 0,
      paymentType: isPaymentType(input.paymentType) ? input.paymentType : "",
    },
  });
  revalidateAll();
  return { id };
}

export async function resendAlimtalk(id: string) {
  await requireSession();
  const r = await prisma.reservation.findUniqueOrThrow({ where: { id } });
  const price = calcConfirm({ plan: r.confirmPlan, butlers: r.confirmButlers, extraGuests: r.confirmExtraGuests, discount: r.confirmDiscount });
  const result = await sendConfirmAlimtalk({
    reservationId: r.id,
    customer: r.customer,
    couple: r.couple,
    phone: r.phone,
    wishDateLabel: formatWishDateLabel(r.confirmDate, r.confirmTime),
    venueLabel: r.confirmVenue,
    guestsLabel: r.guestsLabel,
    requestedPlan: r.confirmPlan,
    planAmount: planMeta(r.confirmPlan).base,
    paidAmount: r.paidAmount,
    confirmAmount: price.total,
    balanceAmount: Math.max(0, price.total - r.paidAmount),
  });
  await prisma.reservation.update({ where: { id }, data: { alimtalkAt: new Date() } });
  revalidateAll();
  return { message: result.sent ? "확정 알림톡을 재발송했습니다." : `확정 알림톡 재발송 요청을 기록했습니다 (${result.detail}).` };
}
