"use client";

import React from "react";
import * as THREE from "three";
import { assetUrl, renshengCardAssetPath } from "@/lib/asset";

type PoemCardProps = {
  poemType: "rensheng" | "xiudao";
  poemId: number;
  visible?: boolean;
};

/** 襯底比例：寬向對齊神像區 28px；僅上下改為 20px（左右維持 28） */
const DEITY_STAGE4_REF_WIDTH = 420;
const DEITY_STAGE4_PADDING_X = 28;
const DEITY_STAGE4_PADDING_Y = 20;
const DEITY_STAGE4_RADIUS = 28;
const DEITY_BG_OPACITY = 0.4;
/** 襯底／貼圖略抬高 renderOrder，減少與天空、霧層透明排序錯亂 */
const POEM_CARD_BACKING_RENDER_ORDER = 900;
const POEM_CARD_FACE_RENDER_ORDER = 901;

const INNER_FRAC_W =
  (DEITY_STAGE4_REF_WIDTH - DEITY_STAGE4_PADDING_X * 2) / DEITY_STAGE4_REF_WIDTH;
const INNER_FRAC_H =
  (DEITY_STAGE4_REF_WIDTH - DEITY_STAGE4_PADDING_Y * 2) / DEITY_STAGE4_REF_WIDTH;

function createDeityPanelMapTexture(panelW: number, panelH: number) {
  const wPx = 512;
  const hPx = Math.max(64, Math.round(wPx * (panelH / Math.max(0.001, panelW))));
  const rPx = DEITY_STAGE4_RADIUS * (wPx / DEITY_STAGE4_REF_WIDTH);
  const canvas = document.createElement("canvas");
  canvas.width = wPx;
  canvas.height = hPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallback = new THREE.Texture();
    fallback.needsUpdate = true;
    return fallback;
  }
  ctx.clearRect(0, 0, wPx, hPx);
  ctx.fillStyle = `rgba(255,255,255,${DEITY_BG_OPACITY})`;
  ctx.beginPath();
  ctx.roundRect(0, 0, wPx, hPx, Math.min(rPx, wPx / 2 - 1, hPx / 2 - 1));
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const PoemCard = React.forwardRef<THREE.Group, PoemCardProps>(
  ({ poemType, poemId, visible = true }, ref) => {
    const src =
      poemType === "rensheng"
        ? assetUrl(renshengCardAssetPath(poemId))
        : assetUrl(`/v1/cards/xiudao/${poemId}.webp`);

    const [poemMap, setPoemMap] = React.useState<THREE.Texture | null>(null);

    React.useEffect(() => {
      let alive = true;
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin("anonymous");
      loader.load(
        src,
        (tex) => {
          if (!alive) {
            tex.dispose();
            return;
          }
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.needsUpdate = true;
          setPoemMap((prev) => {
            if (prev) prev.dispose();
            return tex;
          });
        },
        undefined,
        () => {
          console.error("[PoemCard] 貼圖載入失敗，請確認 R2 上是否存在此物件鍵：", src);
        }
      );
      return () => {
        alive = false;
        setPoemMap((prev) => {
          if (prev) prev.dispose();
          return null;
        });
      };
    }, [src]);

    const H = 8.5;
    const W = poemType === "xiudao" ? H * (963 / 1488) : 6;

    /** 內層為詩籤圖 W×H；外襯寬／高分別依左右 28、上下 20 的比例放大 */
    const panelW = W / INNER_FRAC_W;
    const panelH = H / INNER_FRAC_H;

    const panelMap = React.useMemo(
      () => createDeityPanelMapTexture(panelW, panelH),
      [panelW, panelH]
    );

    React.useEffect(() => {
      return () => {
        panelMap.dispose();
      };
    }, [panelMap]);

    return (
      <group ref={ref} visible={visible}>
        {/* 圓角襯底：RGBA 已含 0.4 alpha，用 map + 高 renderOrder 兼顧霧白與排序 */}
        <mesh position={[0, 0, -0.32]} renderOrder={POEM_CARD_BACKING_RENDER_ORDER}>
          <planeGeometry args={[panelW, panelH]} />
          <meshBasicMaterial
            map={panelMap}
            transparent
            depthWrite={false}
            depthTest
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
        {poemMap ? (
          <mesh position={[0, 0, 0.06]} renderOrder={POEM_CARD_FACE_RENDER_ORDER}>
            <planeGeometry args={[W, H]} />
            <meshBasicMaterial
              map={poemMap}
              transparent
              depthTest
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        ) : null}
      </group>
    );
  }
);
PoemCard.displayName = "PoemCard";

export { PoemCard };
