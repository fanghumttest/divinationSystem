import type { Metadata, Viewport } from "next";
import { Noto_Serif_TC } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const notoSerifTC = Noto_Serif_TC({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-noto-serif-tc",
  display: "swap",
});

export const metadata: Metadata = {
  title: "遇事不決，方壺解疑",
  description: "遇事徬徨，可向方壺主神南斗六司延壽星君禀告，誦讀南斗寶誥後誠心發問，求取詩籤。",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "方壺解疑",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/intro/deity.jpg",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1410",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ?? "";

  return (
    <html lang="zh-TW" className={notoSerifTC.variable} suppressHydrationWarning>
      <body
        className="antialiased overflow-hidden bg-slate-900 text-slate-100"
        suppressHydrationWarning
      >
        <Suspense fallback={null}>
          <GoogleAnalytics measurementId={gaMeasurementId} />
        </Suspense>
        <ServiceWorkerRegister />
        {children}
        <div
          className="hidden lg:block"
          style={{
            position: "fixed",
            left: "50%",
            bottom: "max(8px, env(safe-area-inset-bottom, 0px))",
            transform: "translateX(-50%)",
            zIndex: 5000,
            textAlign: "center",
            pointerEvents: "none",
            lineHeight: 1.4,
            userSelect: "none",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#1e3a5f",
              fontFamily: "var(--font-noto-serif-tc), Noto Serif TC, serif",
            }}
          >
            Copyright © 2026 A某. All rights reserved.
          </div>
          <div
            style={{
              fontSize: "10px",
              opacity: 0.3,
              color: "#0f172a",
              fontFamily: "var(--font-noto-serif-tc), Noto Serif TC, serif",
            }}
          >
            本網站使用 Google Analytics 進行匿名的流量統計以優化體驗，不收集任何個人識別資料
          </div>
        </div>
      </body>
    </html>
  );
}
