import { SolapiMessageService } from "solapi";

function logSendResult(reservationId: string, result: { failedMessageList: readonly unknown[]; groupInfo: { count: Record<string, number> } }) {
  if (result.failedMessageList.length > 0) {
    console.error(`[alimtalk] Solapi rejected send for ${reservationId}:`, JSON.stringify(result.failedMessageList));
  } else {
    console.log(`[alimtalk] Solapi accepted send for ${reservationId}:`, JSON.stringify(result.groupInfo.count));
  }
}

function client(): SolapiMessageService | null {
  const key = process.env.SOLAPI_API_KEY;
  const secret = process.env.SOLAPI_API_SECRET;
  if (!key || !secret) return null;
  return new SolapiMessageService(key, secret);
}

function digitsOnly(phone: string) {
  return phone.replace(/[^0-9]/g, "");
}

export interface AlimtalkFields {
  reservationId: string;
  customer: string;
  couple: string;
  phone: string;
  wishDateLabel: string;
  venueLabel: string;
  guestsLabel: string;
  requestedPlan: string;
  planAmount: number;
  paidAmount: number;
  confirmAmount: number;
  balanceAmount: number;
}

function buildVariables(f: AlimtalkFields): Record<string, string> {
  return {
    "#{customer}": f.customer,
    "#{couple}": f.couple,
    "#{phone}": f.phone,
    "#{wishDateLabel}": f.wishDateLabel,
    "#{venueLabel}": f.venueLabel,
    "#{guestLabel}": f.guestsLabel,
    "#{requestedPlan}": f.requestedPlan,
    "#{planAmount}": f.planAmount.toLocaleString("ko-KR"),
    "#{paidAmount}": f.paidAmount.toLocaleString("ko-KR"),
    "#{confirmAmount}": f.confirmAmount.toLocaleString("ko-KR"),
    "#{balanceAmount}": f.balanceAmount.toLocaleString("ko-KR"),
  };
}

/** 새 신규예약 템플릿(v2)의 #{onsiteText} — 전액결제면 0원에 초과 하객 안내, 아니면 현장 현금 결제 금액. */
export function onsiteText(balanceAmount: number): string {
  return balanceAmount > 0
    ? `${balanceAmount.toLocaleString("ko-KR")}원 (현금 결제)`
    : "0원 (하객 수 초과 시 변동)";
}

export async function sendConfirmAlimtalk(payload: AlimtalkFields): Promise<{ sent: boolean; detail: string }> {
  const svc = client();
  const from = process.env.SOLAPI_SENDER_PHONE;
  const templateId = process.env.SOLAPI_TEMPLATE_CONFIRMED;
  if (!svc || !from || !templateId) {
    console.warn(`[alimtalk] Solapi env vars not fully set — skipping confirm send for ${payload.reservationId}.`);
    return { sent: false, detail: "미설정 (로컬 기록만 저장됨)" };
  }
  try {
    const result = await svc.send({
      to: digitsOnly(payload.phone),
      from,
      kakaoOptions: {
        pfId: process.env.SOLAPI_PF_ID!,
        templateId,
        variables: buildVariables(payload),
      },
    });
    logSendResult(payload.reservationId, result);
    if (result.failedMessageList.length > 0) {
      return { sent: false, detail: "전송 실패" };
    }
    return { sent: true, detail: "전송 완료" };
  } catch (err) {
    console.error(`[alimtalk] Solapi confirm send failed for ${payload.reservationId}`, err);
    return { sent: false, detail: "전송 실패" };
  }
}

export async function sendNewReservationAlimtalk(payload: AlimtalkFields): Promise<void> {
  const svc = client();
  const from = process.env.SOLAPI_SENDER_PHONE;
  const pfId = process.env.SOLAPI_PF_ID;
  // v2 템플릿(#{onsiteText} 포함)이 카카오 검수를 통과해 등록되면 그것을 쓰고, 없으면 기존 템플릿.
  const customerTemplateV2 = process.env.SOLAPI_TEMPLATE_NEW_CUSTOMER_V2;
  const customerTemplateId = customerTemplateV2 || process.env.SOLAPI_TEMPLATE_NEW_CUSTOMER;
  const staffTemplateId = process.env.SOLAPI_TEMPLATE_NEW_STAFF;
  const staffPhones = (process.env.SOLAPI_STAFF_PHONES ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (!svc || !from || !pfId || !customerTemplateId) {
    console.warn(`[alimtalk] Solapi env vars not fully set — skipping new-reservation send for ${payload.reservationId}.`);
    return;
  }

  const variables = buildVariables(payload);
  const customerVariables = customerTemplateV2
    ? { ...variables, "#{onsiteText}": onsiteText(payload.balanceAmount) }
    : variables;

  const messages = [
    {
      to: digitsOnly(payload.phone),
      from,
      kakaoOptions: {
        pfId,
        templateId: customerTemplateId,
        variables: customerVariables,
      },
    },
  ];

  if (staffTemplateId && staffPhones.length > 0) {
    messages.push(
      ...staffPhones.map((phone) => ({
        to: digitsOnly(phone),
        from,
        kakaoOptions: {
          pfId,
          templateId: staffTemplateId,
          variables,
        },
      }))
    );
  } else {
    console.warn(`[alimtalk] SOLAPI_TEMPLATE_NEW_STAFF/SOLAPI_STAFF_PHONES not set — staff Kakao notice skipped for ${payload.reservationId} (Slack 연동 예정).`);
  }

  try {
    const result = await svc.send(messages);
    logSendResult(payload.reservationId, result);
  } catch (err) {
    console.error(`[alimtalk] Solapi new-reservation send failed for ${payload.reservationId}`, err);
  }
}
