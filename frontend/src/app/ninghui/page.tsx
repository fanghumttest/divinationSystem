"use client";

import React from 'react';
import dynamic from 'next/dynamic';

// 動態載入凝輝殿場景（Three.js 需要 browser API，關閉 SSR）
const NinghuiScene = dynamic(() => import('@/components/NinghuiScene'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-[#1a1410] flex items-center justify-center">
      <span className="text-amber-100/70 font-serif tracking-widest animate-pulse">
        凝輝殿・開門中...
      </span>
    </div>
  ),
});

export default function NinghuiPage() {
  return (
    <main className="relative w-full h-[100dvh] bg-[#1a1410] overflow-hidden">
      <NinghuiScene />
    </main>
  );
}
