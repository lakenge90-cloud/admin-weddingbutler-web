export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 서버(Vercel)는 UTC로 돌기 때문에 getHours()를 그대로 쓰면 9시간 이르게 보인다 — 한국 시간으로 맞춘다.
export function formatStamp(d: Date) {
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  return `${pad2(k.getUTCMonth() + 1)}.${pad2(k.getUTCDate())} ${pad2(k.getUTCHours())}:${pad2(k.getUTCMinutes())}`;
}

export function toNum(v: string | number) {
  return Number(String(v).replace(/[^0-9]/g, "")) || 0;
}

const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

// dateStr: "YYYY-MM-DD", timeStr: "HH:MM" -> "2026년 9월 19일 (토) 12:00"
export function formatWishDateLabel(dateStr: string, timeStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekday = WEEKDAYS_KO[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}년 ${m}월 ${d}일 (${weekday}) ${timeStr}`;
}
