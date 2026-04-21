"use client";

import React from "react";
import * as THREE from "three";
import { assetUrl } from "@/lib/asset";

type PoemCardProps = {
  poemType: "rensheng" | "xiudao";
  poemId: number;
  visible?: boolean;
};

const PoemCard = React.forwardRef<THREE.Group, PoemCardProps>(
  ({ poemType, poemId, visible = true }, ref) => {
    const src =
      poemType === "rensheng"
        ? assetUrl(`/v1/cards/rensheng/${poemId}.webp`)
        : assetUrl(`/v1/cards/xiudao/${poemId}.webp`);

    // 不使用 useTexture（會觸發 Suspense），改用 TextureLoader 以避免第六層開始時黑屏閃爍
    const texture = React.useMemo(() => {
      const loader = new THREE.TextureLoader();
      const tex = loader.load(src);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }, [src]);

    // 四聖真君靈籤 vs 修道真言（963×1488）長寬比不同
    const isXiudao = poemType === "xiudao";
    const H = 8.5;
    const W = isXiudao ? H * (963 / 1488) : 6;
    const PAD = 0.4;

    return (
      <group ref={ref} visible={visible}>
        {/* 深色半透明背景（僅四聖真君靈籤；修道真言不加） */}
        {!isXiudao && (
          <mesh position={[0, 0, -0.08]} renderOrder={-1}>
            <planeGeometry args={[W + PAD, H + PAD]} />
            <meshBasicMaterial
              color="#0a0a0a"
              transparent
              opacity={0.75}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        )}
        <mesh renderOrder={0}>
          <planeGeometry args={[W, H]} />
          <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} />
        </mesh>
      </group>
    );
  }
);
PoemCard.displayName = "PoemCard";

export { PoemCard };
