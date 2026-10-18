import type { Reservation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { planMeta, won } from "@/lib/pricing";
import { formatWishDateLabel } from "@/lib/format";
import { sendCancelAlimtalk } from "@/lib/alimtalk";
import { sendNewReservationKakaoWorkNotice } from "@/lib/kakaowork";

export type CancelBy = "admin" | "customer";

const CLAIM_STALE_MS = 2 * 60 * 1000;

// 취소 요청이 겹쳐(버튼 두 번, 어드민·고객 동시) 결제가 두 번 환불되지 않도록, 결제취소 전에
// cancelledAt을 먼저 찍어 한 요청만 통과시킨다. 취소 전 예약의 cancelledAt은 화면에 쓰이지 않는다.
// 2분 넘게 남은 표시는 중간에 끊긴 요청으로 보고 다시 잡을 수 있다.
export async function claimCancel(id: string): Promise<boolean> {
  const { count } = await prisma.reservation.updateMany({
    where: {
      id,
      status: { not: "취소" },
      OR: [{ cancelledAt: null }, { cancelledAt: { lt: new Date(Date.now() - CLAIM_STALE_MS) } }],
    },
    data: { cancelledAt: new Date() },
  });
  return count === 1;
}

/** 결제취소가 실패했을 때 claimCancel 표시를 지운다 */
export async function releaseCancel(id: string) {
  await prisma.reservation.updateMany({ where: { id, status: { not: "취소" } }, data: { cancelledAt: null } });
}

export interface FinishCancelInput {
  reason: string;
  refundAmount: number;
  /** 홈페이지(이니시스) 결제취소를 했는지. false면 예약만 취소 */
  paymentCancelled: boolean;
  by: CancelBy;
}

// 어드민 "예약 취소"와 홈페이지 예약 조회의 고객 취소가 함께 쓰는 마무리 단계:
// 상태 "취소" 저장 → 고객 알림톡 → 협의 기록 → 운영팀 카카오워크 알림.
// 결제취소는 호출하는 쪽에서 먼저 끝낸다. 알림톡·카카오워크가 실패해도 취소는 유지된다.
export async function finishCancel(r: Reservation, input: FinishCancelInput): Promise<{ alimtalk: string }> {
  await prisma.reservation.update({
    where: { id: r.id },
    data: { status: "취소", cancelReason: input.reason, cancelledAt: new Date(), refundAmount: input.refundAmount },
  });

  const wishDateLabel = r.confirmDate ? formatWishDateLabel(r.confirmDate, r.confirmTime) : r.wishDateLabel;
  const alimtalk = await sendCancelAlimtalk({
    reservationId: r.id,
    customer: r.customer,
    couple: r.couple,
    phone: r.phone,
    wishDateLabel,
    venueLabel: r.confirmVenue || r.venueLabel,
    guestsLabel: r.guestsLabel,
    requestedPlan: r.confirmPlan || r.requestedPlan,
    planAmount: planMeta(r.confirmPlan || r.requestedPlan).base,
    paidAmount: r.paidAmount,
    confirmAmount: 0,
    balanceAmount: 0,
    refundAmount: input.refundAmount,
    cancelReason: input.reason,
  });

  const who = input.by === "customer" ? "고객이 홈페이지에서 예약 취소" : "예약 취소";
  const payment = input.paymentCancelled ? `결제 ${won(input.refundAmount)} 환불 요청` : "결제취소 없음";
  await prisma.note.create({
    data: { reservationId: r.id, text: `${who} · ${payment} · 사유: ${input.reason} · 취소 알림톡 ${alimtalk.detail}` },
  });

  await sendNewReservationKakaoWorkNotice(
    [
      `${input.by === "customer" ? "고객 예약 취소 (홈페이지)" : "예약 취소 (어드민)"} (${r.id})`,
      `고객: ${r.customer} (${r.couple}) · ${r.phone}`,
      `예식: ${wishDateLabel} · ${r.confirmVenue || r.venueLabel}`,
      `결제 ${won(r.paidAmount)} · 환불 ${input.paymentCancelled ? won(input.refundAmount) : "없음"}`,
      `사유: ${input.reason}`,
      `고객 알림톡: ${alimtalk.detail}`,
    ].join("\n")
  );

  return { alimtalk: alimtalk.detail };
}
