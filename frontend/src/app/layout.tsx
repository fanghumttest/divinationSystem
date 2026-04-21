import type { Metadata } from "next";
import { Noto_Serif_TC } from "next/font/google";
import "./globals.css";

const notoSerifTC = Noto_Serif_TC({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-noto-serif-tc",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Divination System",
  description: "Ninghui divination flow standalone frontend",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-TW" className={notoSerifTC.variable}>
      <body className="antialiased overflow-hidden bg-slate-900 text-slate-100">
        {children}
      </body>
    </html>
  );
}
