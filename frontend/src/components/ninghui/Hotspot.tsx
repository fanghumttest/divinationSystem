"use client";

import React, { useState } from "react";
import { Html } from "@react-three/drei";
import { useIsMobileOrTablet } from "@/hooks/useIsMobile";

type HotspotProps = {
  position: [number, number, number];
  size: [number, number];
  label: string;
  onClick: () => void;
  forceVisible?: boolean;
};

const Hotspot: React.FC<HotspotProps> = ({ position, label, onClick, forceVisible }) => {
  const [hovered, setHovered] = useState(false);
  const isCompact = useIsMobileOrTablet();
  const isVisible = forceVisible === true || hovered;
  const fontSize = isCompact ? 16 : 24;

  return (
    <group position={position}>
      <Html center position={[0, 0, 0]} zIndexRange={[3000, 0]} style={{ pointerEvents: "auto" }}>
        <div
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          onMouseEnter={() => { setHovered(true); document.body.style.cursor = "pointer"; }}
          onMouseLeave={() => { setHovered(false); document.body.style.cursor = "default"; }}
          style={{ cursor: "pointer", userSelect: "none" }}
        >
          <div
            className="bg-black/60 text-amber-100 tracking-widest backdrop-blur-md whitespace-nowrap select-none shadow-lg"
            style={{
              fontSize: `${fontSize}px`,
              padding: isCompact ? "6px 14px" : "8px 16px",
              fontFamily: "var(--font-noto-serif-tc), Noto Serif TC, serif",
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "scale(1.12)" : "scale(1)",
              transition: "opacity 0.25s ease, transform 0.25s ease",
              textShadow: hovered
                ? "0 0 16px rgba(255, 255, 255, 0.9)"
                : "0 0 8px rgba(0, 0, 0, 0.6)",
              pointerEvents: isVisible ? "auto" : "none",
            }}
          >
            {label}
          </div>
        </div>
      </Html>
    </group>
  );
};

export { Hotspot };
