import { NextResponse } from "next/server";

const R2_BASE_URL = (
  process.env.R2_BASE_URL ??
  process.env.NEXT_PUBLIC_R2_BASE_URL ??
  ""
)
  .trim()
  .replace(/\/+$/, "");
const UPSTREAM_TIMEOUT_MS = 20000;

/** 物件在桶內若帶有額外根路徑（例如 fanghunts-divination-assets），設此變數；應用內仍用 /v1/... */
function r2ObjectKeyFromProxyPath(proxyPath: string): string {
  // 此專案 R2 物件鍵即為 v1/...，不再拼接任何 prefix（避免部署環境誤設導致 404）
  return proxyPath;
}

function isAllowedTargetPath(targetPath: string): boolean {
  // 僅允許代理專案靜態資產路徑，避免被濫用成任意公開檔案代理
  return (
    targetPath.startsWith("v1/cards/") ||
    targetPath.startsWith("v1/backgrounds/") ||
    targetPath.startsWith("v1/models/") ||
    targetPath.startsWith("v1/sounds/")
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ assetPath: string[] }> }
) {
  if (!R2_BASE_URL) {
    return NextResponse.json(
      { error: "R2_BASE_URL / NEXT_PUBLIC_R2_BASE_URL is not configured" },
      { status: 500 }
    );
  }

  const { assetPath } = await context.params;
  const targetPath = Array.isArray(assetPath) ? assetPath.join("/") : "";
  if (!targetPath) {
    return NextResponse.json({ error: "Missing asset path" }, { status: 400 });
  }
  if (!isAllowedTargetPath(targetPath)) {
    return NextResponse.json({ error: "Path is not allowed" }, { status: 403 });
  }

  const { search } = new URL(request.url);
  const objectKey = r2ObjectKeyFromProxyPath(targetPath);
  const targetUrl = `${R2_BASE_URL}/${objectKey}${search}`;
  // 保持 no-store 可避免 Next 伺服器端 data cache 對大檔限制；
  // 真正的快取交給下方回應標頭（瀏覽器/CDN）控制。
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), UPSTREAM_TIMEOUT_MS);
  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      cache: "no-store",
      signal: abortController.signal,
    });
  } catch {
    return NextResponse.json({ error: "Upstream fetch failed" }, { status: 504 });
  } finally {
    clearTimeout(timeout);
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Asset fetch failed" },
      { status: upstream.status }
    );
  }

  if (!upstream.body) {
    return NextResponse.json({ error: "Upstream body is empty" }, { status: 502 });
  }

  const contentType =
    upstream.headers.get("content-type") ?? "application/octet-stream";
  const hasVersion = /(?:\?|&)v=/.test(search);
  const cacheControl = hasVersion
    ? "public, max-age=31536000, s-maxage=31536000, immutable"
    : upstream.headers.get("cache-control") ??
      "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400";

  const etag = upstream.headers.get("etag");
  const lastModified = upstream.headers.get("last-modified");
  const contentLength = upstream.headers.get("content-length");

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": cacheControl,
      ...(etag ? { etag } : {}),
      ...(lastModified ? { "last-modified": lastModified } : {}),
      ...(contentLength ? { "content-length": contentLength } : {}),
    },
  });
}
