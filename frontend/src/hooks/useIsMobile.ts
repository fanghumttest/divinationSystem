"use client";

import { useState, useEffect } from "react";

function useIsNarrow(breakpoint: number): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return narrow;
}

export function useIsMobile(): boolean {
  return useIsNarrow(768);
}

/** 手機與平板（視窗寬度小於 1024px，與 Tailwind lg 斷點一致） */
export function useIsMobileOrTablet(): boolean {
  return useIsNarrow(1024);
}
