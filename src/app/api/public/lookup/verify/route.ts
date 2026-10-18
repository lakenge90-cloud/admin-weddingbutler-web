import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRecordApiKey } from "@/lib/publicApi";
import { LOOKUP_OTP_MAX_ATTEMPTS, lookupOtpMatches, normalizePhone } from "@/lib/lookup";

export const dynamic = "force-dynamic";

// 그 번호의 가장 최근 인증번호와 비교. 5회 틀리면 새 번호를 받아야 한다.
// 맞으면 홈페이지가 조회 세션 쿠키를 만든다.
export async function POST(req: NextRequest) {
  const denied = requireRecordApiKey(req);
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as { phone?: unknown; code?: unknown };
  const phone = normalizePhone(body.phone);
  const code = typeof body.code === "string" ? body.code.replace(/[^0-9]/g, "") : "";
  if (!phone) return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  if (code.length !== 6) return NextResponse.json({ error: "mismatch" }, { status: 400 });

  const otp = await prisma.lookupOtp.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } });
  if (!otp || otp.verifiedAt || otp.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "expired" }, { status: 400 });
  }
  if (otp.attempts >= LOOKUP_OTP_MAX_ATTEMPTS) return NextResponse.json({ error: "locked" }, { status: 429 });

  if (!lookupOtpMatches(phone, code, otp.codeHash)) {
    await prisma.lookupOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return NextResponse.json({ error: "mismatch", remaining: LOOKUP_OTP_MAX_ATTEMPTS - otp.attempts - 1 }, { status: 400 });
  }

  await prisma.lookupOtp.update({ where: { id: otp.id }, data: { verifiedAt: new Date() } });
  return NextResponse.json({ ok: true, phone });
}
