import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRecordApiKey } from "@/lib/publicApi";
import { sendSms } from "@/lib/sms";
import { LOOKUP_OTP_MAX_SENDS_PER_HOUR, LOOKUP_OTP_TTL_MS, findReservationsByPhone, hashLookupOtp, normalizePhone } from "@/lib/lookup";

export const dynamic = "force-dynamic";

// 홈페이지 예약 조회: 예약이 있는 번호로 6자리 인증번호 문자 발송. 번호당 1시간에 5회까지.
export async function POST(req: NextRequest) {
  const denied = requireRecordApiKey(req);
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as { phone?: unknown };
  const phone = normalizePhone(body.phone);
  if (!phone) return NextResponse.json({ error: "invalid_phone" }, { status: 400 });

  const reservations = await findReservationsByPhone(phone);
  if (reservations.length === 0) return NextResponse.json({ error: "no_reservation" }, { status: 404 });

  const recentSends = await prisma.lookupOtp.count({
    where: { phone, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recentSends >= LOOKUP_OTP_MAX_SENDS_PER_HOUR) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.lookupOtp.create({
    data: { phone, codeHash: hashLookupOtp(phone, code), expiresAt: new Date(Date.now() + LOOKUP_OTP_TTL_MS) },
  });

  const sent = await sendSms(phone, `[웨딩버틀러] 예약 조회 인증번호는 ${code} 입니다. 5분 안에 입력해 주세요.`, `lookup ${phone.slice(-4)}`);
  if (!sent) return NextResponse.json({ error: "sms_failed" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
