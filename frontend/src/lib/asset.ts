const R2_BASE_URL = (process.env.NEXT_PUBLIC_R2_BASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

const R2_USE_PROXY =
  (process.env.NEXT_PUBLIC_R2_USE_PROXY ?? "true").toLowerCase() !== "false";

const USE_LOCAL_ASSETS =
  process.env.NEXT_PUBLIC_USE_LOCAL_ASSETS === "1" ||
  process.env.NEXT_PUBLIC_USE_LOCAL_ASSETS === "true";

export function assetUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (USE_LOCAL_ASSETS || !R2_BASE_URL) return normalized;
  if (R2_USE_PROXY) return `/api/r2${normalized}`;
  return `${R2_BASE_URL}${normalized}`;
}

/** 問人事（49 首）卡片檔名：R2／本機皆為兩位數，例如 04.webp */
export function renshengCardAssetPath(poemId: number): string {
  return `/v1/cards/rensheng/${String(poemId).padStart(2, "0")}.webp`;
}

const MAIN_BG_VERSION = (process.env.NEXT_PUBLIC_MAIN_BG_VERSION ?? "").trim();
export const MAIN_BG_TEXTURE = assetUrl(
  MAIN_BG_VERSION
    ? `/v1/backgrounds/main-bg.png?v=${encodeURIComponent(MAIN_BG_VERSION)}`
    : "/v1/backgrounds/main-bg.png"
);
