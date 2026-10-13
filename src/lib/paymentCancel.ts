import { homepageUrl } from "@/lib/records";

// 결제는 홈페이지(포트원 → KG이니시스)에서 받았으므로, 결제취소도 홈페이지의
// /api/reservations/cancel 에 맡긴다. 포트원 키는 홈페이지에만 있다.
// 키는 예약 연동과 같은 값 (어드민 RESERVATION_API_KEY = 홈페이지 ADMIN_API_KEY).

export type PaymentCancelResult =
  | { state: "cancelled"; refundAmount: number }
  | { state: "no_payment"; message: string }
  | { state: "error"; message: string };

export async function requestPaymentCancel(bookingNo: string, reason: string): Promise<PaymentCancelResult> {
  const apiKey = process.env.RESERVATION_API_KEY;
  if (!apiKey) return { state: "error", message: "RESERVATION_API_KEY가 설정되지 않아 결제취소를 요청할 수 없습니다." };

  let res: Response;
  try {
    res = await fetch(`${homepageUrl()}/api/reservations/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ bookingNo, reason }),
      cache: "no-store",
    });
  } catch (err) {
    console.error(`[paymentCancel] failed to reach homepage for ${bookingNo}`, err);
    return { state: "error", message: "홈페이지에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }

  const data = (await res.json().catch(() => ({}))) as { code?: string; message?: string; refundAmount?: number };
  if (data.code === "cancelled" || data.code === "already_cancelled") {
    return { state: "cancelled", refundAmount: data.refundAmount ?? 0 };
  }
  if (data.code === "not_found" || data.code === "not_paid") {
    return { state: "no_payment", message: data.message ?? "결제 완료된 기록이 없습니다." };
  }
  console.error(`[paymentCancel] homepage responded ${res.status} for ${bookingNo}`, data);
  if (res.status === 401) return { state: "error", message: "홈페이지 연동 키가 맞지 않습니다." };
  return { state: "error", message: data.message ?? `결제취소 요청이 실패했습니다 (${res.status}).` };
}
