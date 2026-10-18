import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRecordApiKey } from "@/lib/publicApi";
import { normalizePhone, toLookupItem } from "@/lib/lookup";
import { refundQuote } from "@/lib/refundPolicy";
import { requestPaymentCancel } from "@/lib/paymentCancel";
import { claimCancel, finishCancel, releaseCancel } from "@/lib/cancel";

export const dynamic = "force-dynamic";

// 홈페이지 예약 조회에서 고객이 직접 취소. 환불 금액은 약관 제14조 비율로 여기서 다시 계산한다.
export async function POST(req: NextRequest) {
  const denied = requireRecordApiKey(req);
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as { phone?: unknown; id?: unknown; reason?: unknown };
  const phone = normalizePhone(body.phone);
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : "";
  if (!phone || !id || !reason) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const r = await prisma.reservation.findUnique({ where: { id } });
  if (!r || normalizePhone(r.phone) !== phone) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (r.status === "취소") return NextResponse.json({ error: "already_cancelled" }, { status: 409 });

  const quote = refundQuote(r.confirmDate, r.paidAmount);
  if (!quote.selfCancellable) return NextResponse.json({ error: "not_cancellable" }, { status: 409 });

  if (!(await claimCancel(r.id))) return NextResponse.json({ error: "in_progress" }, { status: 409 });
  const customerReason = `고객 취소: ${reason}`;
  let refunded = 0;
  let paymentCancelled = false;
  if (quote.amount > 0) {
    const result = await requestPaymentCancel(r.id, customerReason, { amount: quote.amount, requester: "CUSTOMER" });
    if (result.state !== "cancelled") await releaseCancel(r.id);
    if (result.state === "error") {
      console.error(`[lookup/cancel] payment cancel failed for ${r.id}: ${result.message}`);
      return NextResponse.json({ error: "payment_failed" }, { status: 502 });
    }
    if (result.state === "no_payment") {
      // 계좌이체 등 홈페이지 밖에서 받은 결제는 직접 환불해야 하므로 고객 취소를 받지 않는다.
      return NextResponse.json({ error: "not_cancellable" }, { status: 409 });
    }
    refunded = result.refundAmount;
    paymentCancelled = true;
  }

  await finishCancel(r, { reason: customerReason, refundAmount: refunded, paymentCancelled, by: "customer" });
  revalidatePath("/reservations");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");

  const updated = await prisma.reservation.findUniqueOrThrow({ where: { id } });
  return NextResponse.json({ ok: true, refundAmount: refunded, reservation: toLookupItem(updated) });
}
