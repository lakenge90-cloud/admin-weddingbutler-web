export const BADGE: Record<string, { bg: string; color: string; dot: string }> = {
  신규요청: { bg: "#A8416C", color: "#FFFFFF", dot: "#A8416C" },
  협의중: { bg: "#FBEFD9", color: "#8A5A00", dot: "#D9A441" },
  확정: { bg: "#E3F1E8", color: "#2B6A45", dot: "#4F9A72" },
  취소: { bg: "#EEECED", color: "#8A8487", dot: "#C4BFC1" },
};

/**
 * 예약 목록 카드의 상태별 스타일. 처리해야 할 건(신규요청·협의중)은 눈에 띄게,
 * 확정은 완료 느낌(초록), 취소는 흐리게(딤) 보이도록 구분한다.
 */
export const CARD: Record<string, { bg: string; accent: string; ring: string; dim: boolean }> = {
  신규요청: { bg: "#FFF5F9", accent: "#A8416C", ring: "#EBC2D3", dim: false },
  협의중: { bg: "#FFFBF2", accent: "#D9A441", ring: "#F0DDB3", dim: false },
  확정: { bg: "#F8F6F7", accent: "#4F9A72", ring: "transparent", dim: false },
  취소: { bg: "#F4F3F3", accent: "#D4CFD1", ring: "transparent", dim: true },
};

export const STATUS_LIST = ["신규요청", "협의중", "확정", "취소"] as const;
export type Status = (typeof STATUS_LIST)[number];
