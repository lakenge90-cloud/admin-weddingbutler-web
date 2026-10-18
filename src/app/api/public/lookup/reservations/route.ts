import { NextRequest, NextResponse } from "next/server";
import { requireRecordApiKey } from "@/lib/publicApi";
import { findReservationsByPhone, normalizePhone, toLookupItem } from "@/lib/lookup";

export const dynamic = "force-dynamic";

// 홈페이지가 문자 인증을 마친 번호로만 부른다 (본인 확인은 홈페이지 세션 쿠키가 맡는다).
export async function POST(req: NextRequest) {
  const denied = requireRecordApiKey(req);
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as { phone?: unknown };
  const phone = normalizePhone(body.phone);
  if (!phone) return NextResponse.json({ error: "invalid_phone" }, { status: 400 });

  const reservations = await findReservationsByPhone(phone);
  return NextResponse.json({ reservations: reservations.map(toLookupItem) });
}
