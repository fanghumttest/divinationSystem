"use client";

import React, { useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import * as THREE from "three";

import { numToChinese, getTimeIndex } from "@/lib/utils";
import { useIsMobile, useIsMobileOrTablet } from "@/hooks/useIsMobile";
import { ParallaxLayers } from "./ninghui/ParallaxLayers";

// ========== 工具 Hook ==========

function useFadeIn(trigger: number | null): [number, () => void] {
  const [opacity, setOpacity] = useState(0);
  React.useEffect(() => {
    if (trigger !== null) {
      setOpacity(0);
      const t = requestAnimationFrame(() => {
        requestAnimationFrame(() => setOpacity(1));
      });
      return () => cancelAnimationFrame(t);
    }
    setOpacity(0);
  }, [trigger]);
  const reset = React.useCallback(() => setOpacity(0), []);
  return [opacity, reset];
}

// ========== 場景內容控制器（Canvas 內部）==========

type SceneContentProps = {
  hideFortuneTube?: boolean;
  fortuneIdleBaseX?: number;
  fortuneIdleBaseY?: number;
  fortuneIdleScale?: number;
  testSceneIndex?: number;
  isMobile?: boolean;
  isNarrowViewport?: boolean;
  onPickedStickChange?: (stickId: number | null) => void;
  onPickedLabelInFourthLayer?: (value: boolean) => void;
  onFourthLayerPoemDisplayChange?: (n: number | null) => void;
  onRewindingStickChange?: (rewinding: boolean) => void;
  onJiaoActiveChange?: (active: boolean) => void;
  onSixthLayerChange?: (active: boolean) => void;
  onFifthLayerChange?: (active: boolean) => void;
};

const SceneContent: React.FC<SceneContentProps> = ({
  hideFortuneTube = false,
  fortuneIdleBaseX = -18,
  fortuneIdleBaseY = -38,
  fortuneIdleScale = 1,
  testSceneIndex = 0,
  isMobile = false,
  isNarrowViewport = false,
  onPickedStickChange,
  onPickedLabelInFourthLayer,
  onFourthLayerPoemDisplayChange,
  onRewindingStickChange,
  onJiaoActiveChange,
  onSixthLayerChange,
  onFifthLayerChange,
}) => {
  const mouseRef = useRef(new THREE.Vector2(0, 0));
  const startPosRef = useRef({ x: 0, y: 0 });
  const scrollPosRef = useRef(0);
  const lastClientXRef = useRef(0);
  // 直接指標 NDC（不經過 scrollPos 累加），供擲筊瞄準用
  const rawPointerRef = useRef(new THREE.Vector2(0, 0));
  // 指標是否按下（觸控中／滑鼠左鍵按住），手機擲筊 shake 偵測只在按下時啟用
  const pointerDownRef = useRef(false);

  const updateRawPointer = (cx: number, cy: number) => {
    rawPointerRef.current.set(
      (cx / window.innerWidth) * 2 - 1,
      -(cy / window.innerHeight) * 2 + 1
    );
  };

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    const cx = e.clientX;
    const cy = e.clientY;
    startPosRef.current = { x: cx, y: cy };
    lastClientXRef.current = cx;
    pointerDownRef.current = true;
    updateRawPointer(cx, cy);
  };

  const handlePointerUp = () => {
    pointerDownRef.current = false;
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    const cx = e.clientX;
    const cy = e.clientY;
    updateRawPointer(cx, cy);

    if (isMobile) {
      const deltaX = cx - lastClientXRef.current;
      lastClientXRef.current = cx;

      const totalDx = Math.abs(cx - startPosRef.current.x);
      const totalDy = Math.abs(cy - startPosRef.current.y);
      if (totalDx > 10 || totalDy > 10) {
        // drag detected — used by caller if needed
      }

      const sensitivity = 8.0;
      scrollPosRef.current += (deltaX / window.innerWidth) * sensitivity;
      scrollPosRef.current = Math.max(-1, Math.min(1, scrollPosRef.current));
      mouseRef.current.x = scrollPosRef.current;
      mouseRef.current.y = -(cy / window.innerHeight) * 2 + 1;
    } else {
      mouseRef.current.set(
        (cx / window.innerWidth) * 2 - 1,
        -(cy / window.innerHeight) * 2 + 1
      );
    }
  };

  return (
    <group>
      <ParallaxLayers
        mouseRef={mouseRef}
        rawPointerRef={rawPointerRef}
        pointerDownRef={pointerDownRef}
        hideFortuneTube={hideFortuneTube}
        fortuneIdleBaseX={fortuneIdleBaseX}
        fortuneIdleBaseY={fortuneIdleBaseY}
        fortuneIdleScale={fortuneIdleScale}
        testSceneIndex={testSceneIndex}
        isMobile={isMobile}
        isNarrowViewport={isNarrowViewport}
        onPickedStickChange={onPickedStickChange}
        onPickedLabelInFourthLayer={onPickedLabelInFourthLayer}
        onFourthLayerPoemDisplayChange={onFourthLayerPoemDisplayChange}
        onRewindingStickChange={onRewindingStickChange}
        onJiaoActiveChange={onJiaoActiveChange}
        onSixthLayerChange={onSixthLayerChange}
        onFifthLayerChange={onFifthLayerChange}
      />

      {/* 全螢幕透明面板：攔截滑鼠/觸控事件 */}
      <mesh
        position={[0, 0, -15]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <planeGeometry args={[300, 200]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
};

/** 必須在 Canvas 內：drei 的 useProgress 才會接到 R3F 的 LoadingManager */
function SceneLoadReporter({
  onReady,
  onProgress,
}: {
  onReady?: () => void;
  onProgress?: (progress: number) => void;
}) {
  const { active, progress } = useProgress();
  const readyNotifiedRef = useRef(false);
  const onProgressRef = useRef(onProgress);
  const onReadyRef = useRef(onReady);
  onProgressRef.current = onProgress;
  onReadyRef.current = onReady;

  // 用 ref 避免 effect 依賴函式身分；雙重 rAF 把 setState 推到下一個繪製後，
  // 避開 drei / R3F 在 ForwardRef render 途中更新 LoadingManager 時觸發的連鎖更新。
  React.useEffect(() => {
    const p = Math.max(0, Math.min(100, progress));
    let cancelled = false;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (!cancelled) onProgressRef.current?.(p);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [progress]);

  React.useEffect(() => {
    if (readyNotifiedRef.current) return;
    if (!active && progress >= 100) {
      readyNotifiedRef.current = true;
      let cancelled = false;
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          if (!cancelled) onReadyRef.current?.();
        });
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
  }, [active, progress]);

  // 保底：若 progress 到 100 後 2 秒 active 仍未清除（部分瀏覽器／SW 啟動後偶發），強制通知 ready
  React.useEffect(() => {
    if (readyNotifiedRef.current || progress < 100) return;
    const t = window.setTimeout(() => {
      if (!readyNotifiedRef.current) {
        readyNotifiedRef.current = true;
        onReadyRef.current?.();
      }
    }, 2000);
    return () => window.clearTimeout(t);
  }, [progress]);

  return null;
}

// ========== 主組件 ==========

type NinghuiSceneProps = {
  hideFortuneTube?: boolean;
  fortuneIdleBaseX?: number;
  fortuneIdleBaseY?: number;
  fortuneIdleScale?: number;
  onReady?: () => void;
  onProgress?: (progress: number) => void;
  onJiaoActiveChange?: (active: boolean) => void;
  onSixthLayerChange?: (active: boolean) => void;
  onFifthLayerChange?: (active: boolean) => void;
};

export default function NinghuiScene({
  hideFortuneTube = false,
  fortuneIdleBaseX = -18,
  fortuneIdleBaseY = -38,
  fortuneIdleScale = 1,
  onReady,
  onProgress,
  onJiaoActiveChange,
  onSixthLayerChange,
  onFifthLayerChange,
}: NinghuiSceneProps) {
  const [currentSceneIndex] = useState(getTimeIndex);

  const isMobile = useIsMobile();
  const isNarrowViewport = useIsMobileOrTablet();

  const [pickedStickIdForLabel, setPickedStickIdForLabel] = useState<number | null>(null);
  const [isPickedLabelFourthLayer, setPickedLabelFourthLayer] = useState(false);
  /** 第四層候選確定後的顯示編號（人事＝籤號；修道＝詩首），Canvas 外 DOM 顯示以避免被 page z-1200 覆層蓋住 */
  const [fourthLayerPoemDisplayNum, setFourthLayerPoemDisplayNum] = useState<number | null>(null);

  const [labelFadeOpacity, resetLabelFade] = useFadeIn(pickedStickIdForLabel);
  const [fourthLayerPoemLabelOpacity, resetFourthLayerFade] = useFadeIn(fourthLayerPoemDisplayNum);

  const handleRewindingStickChange = React.useCallback((rewinding: boolean) => {
    if (rewinding) {
      resetLabelFade();
      resetFourthLayerFade();
    }
  }, [resetLabelFade, resetFourthLayerFade]);

  /** 與 ParallaxLayers 的 isNarrowViewport（<1024）一致：第四層確認後隱藏 3D 籤，窄視窗由此橫排顯示第 N 首 */
  const mobileFourthPoemBar = isNarrowViewport && isPickedLabelFourthLayer;

  const poemLabelNum = fourthLayerPoemDisplayNum ?? pickedStickIdForLabel;
  const showFourthPoemLabelDesktop = !isNarrowViewport && fourthLayerPoemDisplayNum !== null;
  const showFourthPoemLabelMobile = isNarrowViewport && pickedStickIdForLabel !== null && mobileFourthPoemBar;
  const showFourthPoemLabel = poemLabelNum !== null && (showFourthPoemLabelDesktop || showFourthPoemLabelMobile);
  const poemLabelOpacity = isNarrowViewport ? labelFadeOpacity : fourthLayerPoemLabelOpacity;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [0, 0, isMobile ? 110 : 100], fov: 45 }}
        gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}
        dpr={isMobile ? [1, 1.5] : [1, 2]}
      >
        <color attach="background" args={["#1a1410"]} />
        {/* 在 Suspense 外，避免子樹 suspend 時進度 hook 卸載；仍須在 Canvas 內才接得到 LoadingManager */}
        <SceneLoadReporter onReady={onReady} onProgress={onProgress} />
        <React.Suspense fallback={null}>
          <SceneContent
            hideFortuneTube={hideFortuneTube}
            fortuneIdleBaseX={fortuneIdleBaseX}
            fortuneIdleBaseY={fortuneIdleBaseY}
            fortuneIdleScale={fortuneIdleScale}
            testSceneIndex={currentSceneIndex}
            isMobile={isMobile}
            isNarrowViewport={isNarrowViewport}
            onPickedStickChange={setPickedStickIdForLabel}
            onPickedLabelInFourthLayer={setPickedLabelFourthLayer}
            onFourthLayerPoemDisplayChange={setFourthLayerPoemDisplayNum}
            onRewindingStickChange={handleRewindingStickChange}
            onJiaoActiveChange={onJiaoActiveChange}
            onSixthLayerChange={onSixthLayerChange}
            onFifthLayerChange={onFifthLayerChange}
          />
        </React.Suspense>
      </Canvas>

      {/* 第四層「第 N 首」：桌機／平板窄視窗直書；手機（<768）底部置中＋橫書 */}
      <div style={{ position: "absolute", inset: 0, zIndex: 3400, pointerEvents: "none" }}>
        {showFourthPoemLabel && (
          <div
            className="text-white tracking-widest whitespace-nowrap pointer-events-none select-none"
            style={{
              position: "absolute",
              ...(isMobile
                ? {
                    left: "50%",
                    right: "auto",
                    top: "auto",
                    bottom: "max(100px, calc(16px + env(safe-area-inset-bottom, 0px)))",
                    transform: "translateX(-50%)",
                    writingMode: "horizontal-tb",
                    letterSpacing: "0.12em",
                  }
                : {
                    right: isNarrowViewport ? "clamp(28%, 34vw, 48%)" : "clamp(20%, 25vw, 38%)",
                    top: isNarrowViewport ? "48%" : "58%",
                    transform: "translate(-80px, -50%)",
                    writingMode: "vertical-rl",
                    textOrientation: "upright",
                    letterSpacing: "0.2em",
                  }),
              fontSize: "22px",
              fontFamily: "var(--font-noto-serif-tc), Noto Serif TC, serif",
              textShadow: "0 0 6px rgba(0, 0, 0, 0.9)",
              opacity: poemLabelOpacity,
              transition: "opacity 0.4s ease-out",
              userSelect: "none",
            }}
          >
            第{numToChinese(poemLabelNum!)}首
          </div>
        )}
      </div>
    </div>
  );
}
