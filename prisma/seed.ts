import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const RESERVATIONS = [
  {
    id: "WB-20260901", customer: "이서연", couple: "박준호 · 이서연", phone: "010-2847-1103",
    requestedAt: "2026-09-01T14:00:00+09:00",
    wishDateLabel: "2026년 9월 19일 (토) 12:00", venueLabel: "더채플앳청담 · 그랜드홀", guestsLabel: "약 350명",
    memo: "양가 축의대 분리 운영 희망. 봉투 정리 및 명부 작성까지 부탁드립니다.",
    status: "신규요청", requestedPlan: "프리미엄",
    notes: [
      { text: "신랑측 2명, 신부측 2명으로 나눠서 진행 가능할까요?", createdAt: "2026-09-01T14:22:00+09:00" },
      { text: "4인 배치 가능합니다. 예식 1시간 전 도착 기준으로 안내드렸습니다.", createdAt: "2026-09-01T16:40:00+09:00" },
    ],
    confirm: { plan: "프리미엄", date: "2026-09-19", time: "12:00", venue: "더채플앳청담 그랜드홀", butlers: 4, extraGuests: 0, discount: 0, hours: "11:00 - 14:00", note: "양가 축의대 분리 · 명부 2부 작성" },
  },
  {
    id: "WB-20260902", customer: "정하린", couple: "김도윤 · 정하린", phone: "010-5521-8890",
    requestedAt: "2026-09-02T10:00:00+09:00",
    wishDateLabel: "2026년 9월 26일 (토) 14:30", venueLabel: "소노펠리체 컨벤션 · 아모리스홀", guestsLabel: "약 220명",
    memo: "혼주 두 분 모두 지방에서 오셔서 축의대 전담이 필요합니다.",
    status: "협의중", requestedPlan: "프리미엄",
    notes: [
      { text: "2명이면 충분할까요? 예상 하객 220명입니다.", createdAt: "2026-09-02T10:05:00+09:00" },
      { text: "200명 내외는 2인 권장드립니다. 금액은 24만원입니다.", createdAt: "2026-09-02T11:12:00+09:00" },
      { text: "네 2명으로 진행할게요. 시간은 13:30 도착으로 부탁드립니다.", createdAt: "2026-09-03T09:30:00+09:00" },
    ],
    confirm: { plan: "스탠다드", date: "2026-09-26", time: "14:30", venue: "소노펠리체 컨벤션 아모리스홀", butlers: 2, extraGuests: 0, discount: 0, hours: "13:30 - 16:00", note: "" },
  },
  {
    id: "WB-20260903", customer: "문지우", couple: "문지우 · 강예린", phone: "010-3320-4417",
    requestedAt: "2026-09-03T15:00:00+09:00",
    wishDateLabel: "2026년 9월 12일 (토) 11:00", venueLabel: "라온제나 웨딩홀 · 로즈홀", guestsLabel: "약 180명",
    memo: "축의금 즉시 입금 대행까지 가능한지 문의드립니다.",
    status: "확정", requestedPlan: "스몰케어",
    notes: [
      { text: "입금 대행은 혼주 동행 시에만 가능합니다.", createdAt: "2026-09-03T15:00:00+09:00" },
      { text: "혼주 동행으로 진행하겠습니다. 확정 부탁드려요.", createdAt: "2026-09-04T09:10:00+09:00" },
    ],
    confirm: { plan: "스몰케어", date: "2026-09-12", time: "11:00", venue: "라온제나 웨딩홀 로즈홀", butlers: 2, extraGuests: 0, discount: 0, hours: "10:00 - 12:30", note: "혼주 동행 입금 대행 포함" },
  },
  {
    id: "WB-20260904", customer: "한수아", couple: "오시현 · 한수아", phone: "010-7788-2044",
    requestedAt: "2026-09-04T18:00:00+09:00",
    wishDateLabel: "2026년 9월 20일 (일) 13:00", venueLabel: "그랜드하얏트 서울 · 그랜드볼룸", guestsLabel: "약 400명",
    memo: "VIP 하객 응대 경험 있는 인원으로 요청드립니다.",
    status: "확정", requestedPlan: "프리미엄",
    notes: [
      { text: "정장 착용 가능한 분들로 부탁드립니다.", createdAt: "2026-09-04T18:20:00+09:00" },
      { text: "블랙 포멀 복장으로 5인 배치하겠습니다.", createdAt: "2026-09-05T10:02:00+09:00" },
    ],
    confirm: { plan: "프리미엄", date: "2026-09-20", time: "13:00", venue: "그랜드하얏트 서울 그랜드볼룸", butlers: 5, extraGuests: 0, discount: 0, hours: "11:30 - 15:00", note: "블랙 포멀 복장 · VIP 동선 별도 안내" },
  },
  {
    id: "WB-20260905", customer: "배유진", couple: "임태경 · 배유진", phone: "010-9911-3376",
    requestedAt: "2026-09-05T20:00:00+09:00",
    wishDateLabel: "2026년 10월 3일 (토) 12:30", venueLabel: "아펠가모 잠실 · 루체홀", guestsLabel: "약 250명",
    memo: "축의대 2곳 + 방명록 담당 1명 필요합니다.",
    status: "신규요청", requestedPlan: "스탠다드",
    notes: [
      { text: "방명록까지 포함해서 견적 부탁드립니다.", createdAt: "2026-09-05T20:41:00+09:00" },
    ],
    confirm: { plan: "스탠다드", date: "2026-10-03", time: "12:30", venue: "아펠가모 잠실 루체홀", butlers: 3, extraGuests: 0, discount: 0, hours: "11:30 - 14:30", note: "" },
  },
  {
    id: "WB-20260906", customer: "조민서", couple: "조민서 · 윤가영", phone: "010-4402-7781",
    requestedAt: "2026-09-06T13:00:00+09:00",
    wishDateLabel: "2026년 9월 27일 (일) 16:00", venueLabel: "웨딩시티 신도림 · 펄홀", guestsLabel: "약 150명",
    memo: "소규모라 2명이면 충분할 것 같습니다.",
    status: "협의중", requestedPlan: "스몰케어",
    notes: [
      { text: "150명 기준 2인 배치로 안내드립니다.", createdAt: "2026-09-06T13:30:00+09:00" },
    ],
    confirm: { plan: "스몰케어", date: "2026-09-27", time: "16:00", venue: "웨딩시티 신도림 펄홀", butlers: 2, extraGuests: 0, discount: 0, hours: "15:00 - 17:30", note: "" },
  },
  {
    id: "WB-20260907", customer: "신다은", couple: "류현우 · 신다은", phone: "010-6612-5509",
    requestedAt: "2026-09-07T11:00:00+09:00",
    wishDateLabel: "2026년 9월 13일 (일) 14:00", venueLabel: "더컨벤션 영등포 · 다이아몬드홀", guestsLabel: "약 300명",
    memo: "축의금 집계표 엑셀 파일로 전달 부탁드립니다.",
    status: "확정", requestedPlan: "프리미엄",
    notes: [
      { text: "집계표 양식 따로 있으신가요?", createdAt: "2026-09-07T11:18:00+09:00" },
      { text: "표준 양식으로 예식 후 2시간 내 전달드립니다.", createdAt: "2026-09-07T12:00:00+09:00" },
    ],
    confirm: { plan: "프리미엄", date: "2026-09-13", time: "14:00", venue: "더컨벤션 영등포 다이아몬드홀", butlers: 4, extraGuests: 0, discount: 0, hours: "13:00 - 16:00", note: "축의금 집계표 엑셀 전달" },
  },
  {
    id: "WB-20260908", customer: "권나연", couple: "허준영 · 권나연", phone: "010-2233-6647",
    requestedAt: "2026-09-08T22:00:00+09:00",
    wishDateLabel: "2026년 10월 10일 (토) 11:30", venueLabel: "노블발렌티 대치 · 그랜드홀", guestsLabel: "약 280명",
    memo: "부모님 없이 진행되어 전 과정 대행이 필요합니다.",
    status: "신규요청", requestedPlan: "스탠다드",
    notes: [
      { text: "축의금 보관 및 전달까지 모두 대행 가능할까요?", createdAt: "2026-09-08T22:05:00+09:00" },
    ],
    confirm: { plan: "스탠다드", date: "2026-10-10", time: "11:30", venue: "노블발렌티 대치 그랜드홀", butlers: 3, extraGuests: 0, discount: 0, hours: "10:30 - 13:30", note: "" },
  },
];

async function main() {
  const passwordHash = await bcrypt.hash("wb1234", 10);
  await prisma.adminUser.upsert({
    where: { username: "thisriver" },
    update: {},
    create: { username: "thisriver", name: "이강", passwordHash },
  });

  for (const r of RESERVATIONS) {
    const { confirm, notes, ...rest } = r;
    await prisma.reservation.upsert({
      where: { id: r.id },
      update: {},
      create: {
        ...rest,
        requestedAt: new Date(r.requestedAt),
        confirmPlan: confirm.plan,
        confirmDate: confirm.date,
        confirmTime: confirm.time,
        confirmVenue: confirm.venue,
        confirmButlers: confirm.butlers,
        confirmExtraGuests: confirm.extraGuests,
        confirmDiscount: confirm.discount,
        confirmHours: confirm.hours,
        confirmNote: confirm.note,
        notes: { create: notes.map((n) => ({ text: n.text, createdAt: new Date(n.createdAt) })) },
      },
    });
  }

  console.log(`Seeded ${RESERVATIONS.length} reservations and admin user "admin".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
