"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function doLogin() {
    if (!username.trim() || !password.trim()) {
      setError("아이디와 비밀번호를 모두 입력해 주세요.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { username, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    doLogin();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") doLogin();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "linear-gradient(160deg, #FDF7FA 0%, #F7E9F0 42%, #EFDCE6 100%)",
        color: "#1E1A1C",
      }}
    >
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 32px" }}>
        <form
          onSubmit={onSubmit}
          style={{ width: "100%", maxWidth: 372, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}
        >
          <Image src="/wb-logo.png" alt="웨딩버틀러" width={64} height={64} style={{ borderRadius: 20, display: "block", marginBottom: 22 }} />
          <h1 style={{ margin: "0 0 8px", fontSize: 27, fontWeight: 800, letterSpacing: "-0.7px" }}>웨딩버틀러 어드민</h1>
          <p style={{ margin: "0 0 34px", fontSize: 14, color: "#8C8188" }}>축의대 대행 예약을 확인하고 확정하세요.</p>

          <label style={{ width: "100%", textAlign: "left", display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, fontWeight: 700, color: "#6E646A", marginBottom: 14 }}>
            아이디
            <input
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              onKeyDown={onKeyDown}
              placeholder="아이디"
              style={{ border: 0, background: "#FFFFFF", borderRadius: 14, padding: "15px 16px", fontSize: 14.5, color: "#1E1A1C" }}
            />
          </label>
          <label style={{ width: "100%", textAlign: "left", display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, fontWeight: 700, color: "#6E646A" }}>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              onKeyDown={onKeyDown}
              placeholder="비밀번호를 입력하세요"
              style={{ border: 0, background: "#FFFFFF", borderRadius: 14, padding: "15px 16px", fontSize: 14.5, color: "#1E1A1C" }}
            />
          </label>

          <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 0 22px" }}>
            <button
              type="button"
              onClick={() => setRemember((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 8, border: 0, background: "transparent", padding: 0, fontSize: 13, color: "#6E646A" }}
            >
              <span
                style={{
                  width: 18, height: 18, borderRadius: 6,
                  border: `1px solid ${remember ? "#B0567E" : "#DDD5D9"}`,
                  background: remember ? "#B0567E" : "#FFFFFF",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 11, fontWeight: 700,
                }}
              >
                {remember ? "✓" : ""}
              </span>
              로그인 상태 유지
            </button>
            <a href="#" style={{ fontSize: 13 }}>비밀번호 찾기</a>
          </div>

          {error && (
            <div style={{ width: "100%", marginBottom: 14, padding: "12px 14px", borderRadius: 12, background: "#FBEEF2", color: "#A8416C", fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", height: 54, border: 0, borderRadius: 14, background: "#B0567E", color: "#fff", fontSize: 15.5, fontWeight: 700, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "로그인 중…" : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
