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

/** 신규예약 고객 알림톡의 "결제금액" 값. 템플릿을 다시 검수받지 않으려고 기존 #{paidAmount} 값 뒤에
 * 결제 유형을 붙인다 — 전액결제면 "(전액결제)", 아니면 현장결제 금액.
 * 이 값은 템플릿의 아이템 항목이라 카카오가 23자를 넘으면 거절한다(3076). 넘으면 금액만 보낸다. */
export function paidAmountWithOnsite(paidAmount: number, balanceAmount: number): string {
  const paid = `${paidAmount.toLocaleString("ko-KR")}원`;
  const text = balanceAmount > 0 ? `${paid} (현장 ${balanceAmount.toLocaleString("ko-KR")}원)` : `${paid} (전액결제)`;
  return text.length <= 23 ? text : paid;
}

/** 예약 확정 알림톡의 "현장결제금액"(#{balanceAmount}) 값 — 전액결제면 하객 수 초과 시 변동 안내, 아니면 현금 결제 안내. */
export function onsiteAmountText(balanceAmount: number): string {
  return balanceAmount > 0
    ? `${balanceAmount.toLocaleString("ko-KR")}원 (현금)`
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
        variables: {
          ...buildVariables(payload),
          "#{paidAmount}": `${payload.paidAmount.toLocaleString("ko-KR")}원`,
          "#{balanceAmount}": onsiteAmountText(payload.balanceAmount),
        },
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
  const customerTemplateId = process.env.SOLAPI_TEMPLATE_NEW_CUSTOMER;
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
  const customerVariables: Record<string, string> = {
    ...variables,
    "#{planAmount}": `${payload.planAmount.toLocaleString("ko-KR")}원`,
    "#{paidAmount}": paidAmountWithOnsite(payload.paidAmount, payload.balanceAmount),
  };

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

export type ReminderKind = "7d" | "day";

/** 예식 7일 전 / 당일 리마인더 알림톡. 변수는 확정 알림톡과 같은 값을 보낸다. */
export async function sendReminderAlimtalk(kind: ReminderKind, payload: AlimtalkFields): Promise<{ sent: boolean; detail: string }> {
  const svc = client();
  const from = process.env.SOLAPI_SENDER_PHONE;
  const pfId = process.env.SOLAPI_PF_ID;
  const templateId = kind === "7d" ? process.env.SOLAPI_TEMPLATE_REMIND_7D : process.env.SOLAPI_TEMPLATE_REMIND_DAY;
  if (!svc || !from || !pfId || !templateId) {
    console.warn(`[alimtalk] Solapi env vars not fully set — skipping ${kind} reminder for ${payload.reservationId}.`);
    return { sent: false, detail: "미설정" };
  }
  try {
    const result = await svc.send({
      to: digitsOnly(payload.phone),
      from,
      kakaoOptions: {
        pfId,
        templateId,
        variables: {
          ...buildVariables(payload),
          "#{paidAmount}": `${payload.paidAmount.toLocaleString("ko-KR")}원`,
          "#{balanceAmount}": onsiteAmountText(payload.balanceAmount),
        },
      },
    });
    logSendResult(payload.reservationId, result);
    if (result.failedMessageList.length > 0) return { sent: false, detail: "전송 실패" };
    return { sent: true, detail: "전송 완료" };
  } catch (err) {
    console.error(`[alimtalk] Solapi ${kind} reminder failed for ${payload.reservationId}`, err);
    return { sent: false, detail: "전송 실패" };
  }
}

/** 예약 취소 알림톡. #{refundAmount}에는 실제 환불(결제취소)한 금액, #{cancelReason}에는 취소 사유를 보낸다. */
export async function sendCancelAlimtalk(
  payload: AlimtalkFields & { refundAmount: number; cancelReason: string }
): Promise<{ sent: boolean; detail: string }> {
  const svc = client();
  const from = process.env.SOLAPI_SENDER_PHONE;
  const pfId = process.env.SOLAPI_PF_ID;
  const templateId = process.env.SOLAPI_TEMPLATE_CANCELLED;
  if (!svc || !from || !pfId || !templateId) {
    console.warn(`[alimtalk] Solapi env vars not fully set — skipping cancel send for ${payload.reservationId}.`);
    return { sent: false, detail: "미설정" };
  }
  try {
    const result = await svc.send({
      to: digitsOnly(payload.phone),
      from,
      kakaoOptions: {
        pfId,
        templateId,
        // 카카오 아이템 리스트 값은 23자까지라(초과 시 3076 오류) 표에 들어갈 수 있는 값은 잘라 보낸다.
        variables: Object.fromEntries(
          Object.entries({
            ...buildVariables(payload),
            "#{planAmount}": `${payload.planAmount.toLocaleString("ko-KR")}원`,
            "#{paidAmount}": `${payload.paidAmount.toLocaleString("ko-KR")}원`,
            "#{refundAmount}": `${payload.refundAmount.toLocaleString("ko-KR")}원`,
            "#{cancelReason}": payload.cancelReason,
          }).map(([k, v]) => [k, Array.from(v).length > 23 ? `${Array.from(v).slice(0, 22).join("")}…` : v])
        ),
      },
    });
    logSendResult(payload.reservationId, result);
    if (result.failedMessageList.length > 0) return { sent: false, detail: "전송 실패" };
    return { sent: true, detail: "전송 완료" };
  } catch (err) {
    console.error(`[alimtalk] Solapi cancel send failed for ${payload.reservationId}`, err);
    return { sent: false, detail: "전송 실패" };
  }
}
