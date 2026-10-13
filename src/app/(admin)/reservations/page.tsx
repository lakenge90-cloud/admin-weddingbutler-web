import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { toRow } from "@/lib/view";
import { formatStamp } from "@/lib/format";
import ReservationListControls from "@/components/ReservationListControls";
import ReservationDetail, { type DetailReservation } from "@/components/ReservationDetail";

export const dynamic = "force-dynamic";

function buildDetail(r: NonNullable<Awaited<ReturnType<typeof loadReservation>>>): DetailReservation {
  return {
    id: r.id,
    customer: r.customer,
    couple: r.couple,
    phone: r.phone,
    createdAtLabel: formatStamp(r.requestedAt),
    wishDateLabel: r.wishDateLabel,
    venueLabel: r.venueLabel,
    guestsLabel: r.guestsLabel,
    memo: r.memo,
    status: r.status,
    requestedPlan: r.requestedPlan,
    paidAmount: r.paidAmount,
    paymentType: r.paymentType,
    alimtalkLabel: r.alimtalkAt ? formatStamp(r.alimtalkAt) : "이력 없음",
    cancel: r.status === "취소"
      ? { reason: r.cancelReason, atLabel: r.cancelledAt ? formatStamp(r.cancelledAt) : "", refundAmount: r.refundAmount }
      : null,
    recordStatus: recordStatusOf(r.recordLink?.status),
    notes: r.notes.map((n) => ({ id: n.id, when: formatStamp(n.createdAt), text: n.text })),
    confirm: {
      plan: r.confirmPlan,
      date: r.confirmDate,
      time: r.confirmTime,
      venue: r.confirmVenue,
      butlers: r.confirmButlers,
      extraGuests: r.confirmExtraGuests,
      discount: r.confirmDiscount,
      hours: r.confirmHours,
      note: r.confirmNote,
    },
  };
}

function recordStatusOf(status: string | undefined): DetailReservation["recordStatus"] {
  return status === "draft" || status === "published" || status === "revoked" ? status : "none";
}

async function loadReservation(id: string) {
  return prisma.reservation.findUnique({
    where: { id },
    include: { notes: { orderBy: { createdAt: "asc" } }, recordLink: { select: { status: true } } },
  });
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: { filter?: string; q?: string; id?: string };
}) {
  const filter = searchParams.filter && ["신규요청", "협의중", "확정", "취소"].includes(searchParams.filter) ? searchParams.filter : "전체";
  const q = (searchParams.q ?? "").trim();

  const all = await prisma.reservation.findMany({ orderBy: { requestedAt: "desc" } });
  const filtered = all.filter((it) => {
    const matchesFilter = filter === "전체" || it.status === filter;
    const matchesQuery = !q || `${it.customer}${it.confirmVenue}${it.id}`.toLowerCase().includes(q.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  const explicitlyOpened = Boolean(searchParams.id);
  const selectedId = searchParams.id ?? filtered[0]?.id ?? all[0]?.id;
  const selected = selectedId ? await loadReservation(selectedId) : null;

  const listParams = new URLSearchParams();
  if (filter !== "전체") listParams.set("filter", filter);
  if (q) listParams.set("q", q);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", flex: 1, minWidth: 0 }}>
      {/* List pane: hidden on mobile once a reservation is opened (id param present).
          The 340px cap only applies on desktop (CSS) - on mobile the detail pane is
          hidden entirely, so the list should use the full width instead of leaving
          a blank gap where the (invisible) detail pane would have sat. */}
      <main
        className={[explicitlyOpened ? "wb-list-pane-hidden" : "", selected ? "wb-list-pane-capped" : ""].filter(Boolean).join(" ") || undefined}
        style={{ flex: "1 1 240px", minWidth: 0, boxSizing: "border-box", padding: "6px 28px 48px" }}
      >
        <ReservationListControls currentFilter={filter} />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.length === 0 && <div style={{ fontSize: 13.5, color: "#8C8188", padding: "24px 4px" }}>조건에 맞는 예약이 없습니다.</div>}
          {filtered.map((it) => {
            const row = toRow(it);
            const isSelected = it.id === selectedId;
            const rowParams = new URLSearchParams(listParams);
            rowParams.set("id", it.id);
            return (
              <Link
                key={it.id}
                href={`/reservations?${rowParams.toString()}`}
                style={{
                  display: "flex", flexDirection: "column", gap: 8, padding: "16px 18px", borderRadius: 16,
                  background: isSelected ? "#F9EFF4" : "#F8F6F7",
                  boxShadow: `inset 0 0 0 1px ${isSelected ? "#E3BCCE" : "transparent"}`,
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 8px" }}>
                  <span style={{ width: 8, height: 8, flex: "0 0 8px", borderRadius: "50%", background: row.badgeColor }} />
                  <span style={{ flex: "1 1 auto", minWidth: 0, fontSize: 14.5, fontWeight: 700, wordBreak: "keep-all" }}>{row.customer} 님</span>
                  <span style={{ flex: "0 0 auto", padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: row.badgeBg, color: row.badgeColor }}>{row.status}</span>
                </div>
                <div style={{ fontSize: 13, color: "#6E646A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.venueLine}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", fontSize: 12.5, color: "#8C8188" }}>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{row.dateLine}</span>
                  <span style={{ color: "#B0567E", fontWeight: 600 }}>{row.id}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", fontSize: 12.5, color: "#8C8188" }}>
                  <span>{row.staffLine}</span>
                  <span style={{ marginLeft: "auto", fontWeight: 700, color: "#413A3E", fontVariantNumeric: "tabular-nums" }}>{row.amountLine}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", fontSize: 12, color: "#A79BA1" }}>
                  <span>플랜 {row.planAmountLine}</span>
                  <span style={{ marginLeft: "auto" }}>{row.paymentTypeLine} · 결제 {row.paidAmountLine} · 현장 {row.onsiteAmountLine}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      {selected && (
        <ReservationDetail
          reservation={buildDetail(selected)}
          backHref={`/reservations?${listParams.toString()}`}
          className={explicitlyOpened ? undefined : "wb-detail-pane-closed"}
        />
      )}
    </div>
  );
}
