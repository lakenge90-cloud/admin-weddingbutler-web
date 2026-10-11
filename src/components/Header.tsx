"use client";

import { useState, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";

export default function Header({
  mobile, userName, onToggleNav,
}: {
  mobile: boolean;
  userName: string;
  onToggleNav: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const onReservations = pathname?.startsWith("/reservations");
  const [query, setQuery] = useState(onReservations ? searchParams.get("q") ?? "" : "");
  const initial = userName.trim().slice(0, 1) || "관";

  function updateQuery(value: string) {
    setQuery(value);
    if (onReservations) {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("q", value);
      else params.delete("q");
      router.replace(`/reservations?${params.toString()}`);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !onReservations) {
      router.push(`/reservations?q=${encodeURIComponent(query)}`);
    }
  }

  return (
    <header
      style={{
        minHeight: mobile ? "auto" : 78,
        display: "flex",
        flexWrap: mobile ? "wrap" : "nowrap",
        alignItems: "center",
        gap: "12px 16px",
        padding: mobile ? "12px 16px" : "0 28px",
      }}
    >
      <button
        onClick={onToggleNav}
        title="메뉴"
        style={{
          width: 42, height: 42, flex: "0 0 42px", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 4, border: 0, borderRadius: 12,
          background: "#F6F3F5",
        }}
      >
        <span style={{ width: 16, height: 2, borderRadius: 1, background: "#6E646A" }} />
        <span style={{ width: 16, height: 2, borderRadius: 1, background: "#6E646A" }} />
        <span style={{ width: 16, height: 2, borderRadius: 1, background: "#6E646A" }} />
      </button>
      <div
        style={{
          flex: "1 1 220px", minWidth: 180, maxWidth: 660, display: "flex", alignItems: "center",
          gap: 10, height: 48, padding: "0 18px", borderRadius: 14, background: "#F6F3F5",
        }}
      >
        <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
          <circle cx="9" cy="9" r="6.2" stroke="#9E9399" strokeWidth="1.8" />
          <rect x="13.2" y="14" width="5.4" height="2" rx="1" transform="rotate(40 13.2 14)" fill="#9E9399" />
        </svg>
        <input
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="예약 전체 검색"
          style={{ flex: 1, border: 0, background: "transparent", fontSize: 14.5, color: "#1E1A1C" }}
        />
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontSize: 13.5, color: "#6E646A" }}>{userName}</span>
        <div
          style={{
            width: 36, height: 36, borderRadius: "50%", background: "#F5E4EC", color: "#8A3F61",
            fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {initial}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          style={{ height: 34, padding: "0 14px", border: 0, borderRadius: 10, background: "#F6F3F5", color: "#6E646A", fontSize: 13, fontWeight: 600 }}
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
