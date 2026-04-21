import { NextResponse } from "next/server";

const R2_BASE_URL = (process.env.NEXT_PUBLIC_R2_BASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

export async function GET(
  request: Request,
  context: { params: Promise<{ assetPath: string[] }> }
) {
  if (!R2_BASE_URL) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_R2_BASE_URL is not configured" },
      { status: 500 }
    );
  }

  const { assetPath } = await context.params;
  const targetPath = Array.isArray(assetPath) ? assetPath.join("/") : "";
  if (!targetPath) {
    return NextResponse.json({ error: "Missing asset path" }, { status: 400 });
  }

  const { search } = new URL(request.url);
  const targetUrl = `${R2_BASE_URL}/${targetPath}${search}`;
  // 保持 no-store 可避免 Next 伺服器端 data cache 對大檔限制；
  // 真正的快取交給下方回應標頭（瀏覽器/CDN）控制。
  const upstream = await fetch(targetUrl, { cache: "no-store" });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Upstream asset not found: ${targetPath}` },
      { status: upstream.status }
    );
  }

  const contentType =
    upstream.headers.get("content-type") ?? "application/octet-stream";
  const hasVersion = /(?:\?|&)v=/.test(search);
  const cacheControl = hasVersion
    ? "public, max-age=31536000, s-maxage=31536000, immutable"
    : upstream.headers.get("cache-control") ??
      "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400";
  const body = await upstream.arrayBuffer();

  const etag = upstream.headers.get("etag");
  const lastModified = upstream.headers.get("last-modified");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": cacheControl,
      ...(etag ? { etag } : {}),
      ...(lastModified ? { "last-modified": lastModified } : {}),
    },
  });
}
