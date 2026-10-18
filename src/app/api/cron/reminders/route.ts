import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcConfirm, planMeta } from "@/lib/pricing";
import { formatWishDateLabel, pad2 } from "@/lib/format";
import { sendReminderAlimtalk, type ReminderKind } from "@/lib/alimtalk";
import { sendNewReservationKakaoWorkNotice } from "@/lib/kakaowork";

export const dynamic = "force-dynamic";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 한국 날짜 기준으로 오늘 + days 를 "YYYY-MM-DD"로.
function kstDate(days: number) {
  const k = new Date(Date.now() + KST_OFFSET_MS + days * 24 * 60 * 60 * 1000);
  return `${k.getUTCFullYear()}-${pad2(k.getUTCMonth() + 1)}-${pad2(k.getUTCDate())}`;
}

// 보낸 기록은 예약 메모(Note)로 남기고, 같은 메모가 있으면 다시 보내지 않는다 (DB 변경 없이 중복 방지).
const NOTE_PREFIX: Record<ReminderKind, string> = {
  "7d": "[자동] 예식 7일 전 안내 알림톡",
  day: "[자동] 예식 당일 안내 알림톡",
};

// Vercel Cron이 매일 호출한다 (vercel.json). ?type=7d 는 7일 뒤 예식, ?type=day 는 오늘 예식.
// Vercel은 CRON_SECRET이 설정돼 있으면 Authorization: Bearer <CRON_SECRET> 을 붙여 보낸다.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type");
  if (type !== "7d" && type !== "day") return NextResponse.json({ error: "type must be 7d or day" }, { status: 400 });
  const kind: ReminderKind = type;
  const targetDate = kstDate(kind === "7d" ? 7 : 0);
  const prefix = NOTE_PREFIX[kind];

  const reservations = await prisma.reservation.findMany({
    where: { status: "확정", confirmDate: targetDate },
    include: { notes: { where: { text: { startsWith: prefix } }, select: { id: true } } },
  });

  const lines: string[] = [];
  for (const r of reservations) {
    if (r.notes.length > 0) continue;
    const price = calcConfirm({ plan: r.confirmPlan, butlers: r.confirmButlers, extraGuests: r.confirmExtraGuests, discount: r.confirmDiscount });
    const result = await sendReminderAlimtalk(kind, {
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
    // 실패한 건은 메모를 남기지 않아 다음 호출 때 다시 시도된다.
    if (result.sent) await prisma.note.create({ data: { reservationId: r.id, text: `${prefix} 발송` } });
    lines.push(`${r.id} ${r.customer} · ${result.detail}`);
  }

  if (lines.length > 0) {
    await sendNewReservationKakaoWorkNotice(
      [`${kind === "7d" ? "예식 7일 전" : "예식 당일"} 안내 알림톡 (${targetDate})`, ...lines].join("\n")
    );
  }
  return NextResponse.json({ kind, targetDate, results: lines });
}
