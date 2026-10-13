"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PAYMENT_TYPES, PLANS, type PaymentType } from "@/lib/pricing";
import { createReservation } from "@/lib/actions";
import { toNum } from "@/lib/format";
import { useToast } from "./ToastContext";
import { useIsMobile } from "@/lib/useIsMobile";

const FILTERS = ["전체", "신규요청", "협의중", "확정", "취소"];

export default function ReservationListControls({ currentFilter }: { currentFilter: string }) {
  const mobile = useIsMobile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const showToast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    customer: string; couple: string; phone: string; wishDateLabel: string; venueLabel: string; guestsLabel: string; memo: string; requestedPlan: string; paidAmount: string; paymentType: string;
  }>({
    customer: "", couple: "", phone: "", wishDateLabel: "", venueLabel: "", guestsLabel: "", memo: "", requestedPlan: PLANS[1].key, paidAmount: "0", paymentType: "",
  });

  function filterHref(label: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("id");
    if (label === "전체") params.delete("filter");
    else params.set("filter", label);
    return `/reservations?${params.toString()}`;
  }

  async function onSubmit() {
    if (!form.customer.trim() || !form.phone.trim()) {
      showToast("고객명과 연락처를 입력해 주세요.");
      return;
    }
    setSaving(true);
    const res = await createReservation({ ...form, paidAmount: toNum(form.paidAmount) });
    setSaving(false);
    setOpen(false);
    setForm({ customer: "", couple: "", phone: "", wishDateLabel: "", venueLabel: "", guestsLabel: "", memo: "", requestedPlan: PLANS[1].key, paidAmount: "0", paymentType: "" });
    showToast("새 예약이 등록되었습니다.");
    router.push(`/reservations?id=${res.id}`);
  }

  const inputStyle: React.CSSProperties = { border: 0, background: "#F6F3F5", borderRadius: 12, padding: "12px 14px", fontSize: 13.5, color: "#1E1A1C", width: "100%", boxSizing: "border-box" };

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 14 }}>
        {FILTERS.map((label) => {
          const active = currentFilter === label;
          return (
            <Link
              key={label}
              href={filterHref(label)}
              style={{
                height: 44, padding: "0 22px", borderRadius: 999, display: "flex", alignItems: "center",
                border: `1px solid ${active ? "#B0567E" : "#E8E2E5"}`,
                background: active ? "#B0567E" : "#FFFFFF",
                color: active ? "#FFFFFF" : "#7A6F75",
                fontSize: 14.5, fontWeight: 700,
              }}
            >
              {label}
            </Link>
          );
        })}
        <button onClick={() => setOpen(true)} style={{ marginLeft: mobile ? 0 : "auto", height: 44, padding: "0 20px", border: 0, borderRadius: 14, background: "#B0567E", color: "#fff", fontSize: 14.5, fontWeight: 700 }}>
          새 예약 등록
        </button>
      </div>

      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(40,26,33,0.32)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto", background: "#FFFFFF", borderRadius: 18, padding: 24 }}>
            <h2 style={{ margin: "0 0 18px", fontSize: 17, fontWeight: 800 }}>새 예약 등록</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#6E646A", display: "flex", flexDirection: "column", gap: 6 }}>
                예약자(신부/신랑) <input style={inputStyle} value={form.couple} onChange={(e) => setForm((f) => ({ ...f, couple: e.target.value }))} placeholder="박준호 · 이서연" />
              </label>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#6E646A", display: "flex", flexDirection: "column", gap: 6 }}>
                고객명(대표) <input style={inputStyle} value={form.customer} onChange={(e) => setForm((f) => ({ ...f, customer: e.target.value }))} placeholder="이서연" />
              </label>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#6E646A", display: "flex", flexDirection: "column", gap: 6 }}>
                연락처 <input style={inputStyle} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="010-0000-0000" />
              </label>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#6E646A", display: "flex", flexDirection: "column", gap: 6 }}>
                예식 일시 <input style={inputStyle} value={form.wishDateLabel} onChange={(e) => setForm((f) => ({ ...f, wishDateLabel: e.target.value }))} placeholder="2026년 9월 19일 (토) 12:00" />
              </label>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#6E646A", display: "flex", flexDirection: "column", gap: 6 }}>
                예식장 <input style={inputStyle} value={form.venueLabel} onChange={(e) => setForm((f) => ({ ...f, venueLabel: e.target.value }))} placeholder="더채플앳청담 · 그랜드홀" />
              </label>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#6E646A", display: "flex", flexDirection: "column", gap: 6 }}>
                예상 하객 <input style={inputStyle} value={form.guestsLabel} onChange={(e) => setForm((f) => ({ ...f, guestsLabel: e.target.value }))} placeholder="약 300명" />
              </label>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#6E646A", display: "flex", flexDirection: "column", gap: 6 }}>
                요금제
                <select style={inputStyle} value={form.requestedPlan} onChange={(e) => setForm((f) => ({ ...f, requestedPlan: e.target.value }))}>
                  {PLANS.map((p) => <option key={p.key} value={p.key}>{p.key} ({p.desc})</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#6E646A", display: "flex", flexDirection: "column", gap: 6 }}>
                결제 방식
                <select style={inputStyle} value={form.paymentType} onChange={(e) => setForm((f) => ({ ...f, paymentType: e.target.value }))}>
                  <option value="">미지정</option>
                  {(Object.keys(PAYMENT_TYPES) as PaymentType[]).map((t) => <option key={t} value={t}>{PAYMENT_TYPES[t].name}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#6E646A", display: "flex", flexDirection: "column", gap: 6 }}>
                결제한 금액 <input style={inputStyle} value={form.paidAmount} onChange={(e) => setForm((f) => ({ ...f, paidAmount: e.target.value }))} placeholder="0" />
              </label>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#6E646A", display: "flex", flexDirection: "column", gap: 6 }}>
                요청 사항 <textarea rows={3} style={{ ...inputStyle, resize: "vertical" }} value={form.memo} onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setOpen(false)} style={{ flex: 1, height: 48, border: 0, borderRadius: 12, background: "#F6F3F5", color: "#6E646A", fontSize: 14, fontWeight: 700 }}>취소</button>
              <button disabled={saving} onClick={onSubmit} style={{ flex: 1, height: 48, border: 0, borderRadius: 12, background: "#B0567E", color: "#fff", fontSize: 14, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>등록</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
