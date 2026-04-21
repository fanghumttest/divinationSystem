"use client";

import React, { useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import * as THREE from "three";

import { numToChinese, getTimeIndex } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ParallaxLayers } from "./ninghui/ParallaxLayers";

// ========== 場景內容控制器（Canvas 內部）==========

type SceneContentProps = {
  hideFortuneTube?: boolean;
  fortuneIdleBaseX?: number;
  fortuneIdleBaseY?: number;
  fortuneIdleScale?: number;
  isTestMode?: boolean;
  testSceneIndex?: number;
  isMobile?: boolean;
  jumpToTubeCloseup?: boolean;
  onClearJumpToTubeCloseup?: () => void;
  jumpToFifthLayerTest?: boolean;
  onClearJumpToFifthLayerTest?: () => void;
  jumpToSixthLayerTest?: boolean;
  onClearJumpToSixthLayerTest?: () => void;
  onPickedStickChange?: (stickId: number | null) => void;
  onPickedLabelInFourthLayer?: (value: boolean) => void;
  onRewindingStickChange?: (rewinding: boolean) => void;
  onJiaoActiveChange?: (active: boolean) => void;
  onSixthLayerChange?: (active: boolean) => void;
};

const SceneContent: React.FC<SceneContentProps> = ({
  hideFortuneTube = false,
  fortuneIdleBaseX = -18,
  fortuneIdleBaseY = -38,
  fortuneIdleScale = 1,
  isTestMode = false,
  testSceneIndex = 0,
  isMobile = false,
  jumpToTubeCloseup = false,
  onClearJumpToTubeCloseup,
  jumpToFifthLayerTest = false,
  onClearJumpToFifthLayerTest,
  jumpToSixthLayerTest = false,
  onClearJumpToSixthLayerTest,
  onPickedStickChange,
  onPickedLabelInFourthLayer,
  onRewindingStickChange,
  onJiaoActiveChange,
  onSixthLayerChange,
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
        isTestMode={isTestMode}
        testSceneIndex={testSceneIndex}
        isMobile={isMobile}
        jumpToTubeCloseup={jumpToTubeCloseup}
        onClearJumpToTubeCloseup={onClearJumpToTubeCloseup}
        jumpToFifthLayerTest={jumpToFifthLayerTest}
        onClearJumpToFifthLayerTest={onClearJumpToFifthLayerTest}
        jumpToSixthLayerTest={jumpToSixthLayerTest}
        onClearJumpToSixthLayerTest={onClearJumpToSixthLayerTest}
        onPickedStickChange={onPickedStickChange}
        onPickedLabelInFourthLayer={onPickedLabelInFourthLayer}
        onRewindingStickChange={onRewindingStickChange}
        onJiaoActiveChange={onJiaoActiveChange}
        onSixthLayerChange={onSixthLayerChange}
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
}: NinghuiSceneProps) {
  const [isTestMode, setIsTestMode] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(getTimeIndex());
  const [jumpToTubeCloseup, setJumpToTubeCloseup] = useState(false);
  const [jumpToFifthLayerTest, setJumpToFifthLayerTest] = useState(false);
  const [jumpToSixthLayerTest, setJumpToSixthLayerTest] = useState(false);

  const onClearJumpToTubeCloseup = React.useCallback(() => setJumpToTubeCloseup(false), []);
  const onClearJumpToFifthLayerTest = React.useCallback(() => setJumpToFifthLayerTest(false), []);
  const onClearJumpToSixthLayerTest = React.useCallback(() => setJumpToSixthLayerTest(false), []);

  const isMobile = useIsMobile();
  const { active, progress } = useProgress();
  const readyNotifiedRef = useRef(false);

  React.useEffect(() => {
    if (readyNotifiedRef.current) return;
    if (!active && progress >= 100) {
      readyNotifiedRef.current = true;
      onReady?.();
    }
  }, [active, progress, onReady]);

  React.useEffect(() => {
    onProgress?.(Math.max(0, Math.min(100, progress)));
  }, [progress, onProgress]);

  const [pickedStickIdForLabel, setPickedStickIdForLabel] = useState<number | null>(null);
  const [labelFadeOpacity, setLabelFadeOpacity] = useState(0);
  const [isPickedLabelFourthLayer, setPickedLabelFourthLayer] = useState(false);

  React.useEffect(() => {
    if (pickedStickIdForLabel !== null) {
      setLabelFadeOpacity(0);
      const t = requestAnimationFrame(() => {
        requestAnimationFrame(() => setLabelFadeOpacity(1));
      });
      return () => cancelAnimationFrame(t);
    }
    setLabelFadeOpacity(0);
  }, [pickedStickIdForLabel]);

  const handleRewindingStickChange = React.useCallback((rewinding: boolean) => {
    if (rewinding) setLabelFadeOpacity(0);
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [0, 0, isMobile ? 110 : 100], fov: 45 }}
        gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}
        dpr={isMobile ? [1, 1.5] : [1, 2]}
      >
        <color attach="background" args={["#1a1410"]} />
        <React.Suspense fallback={null}>
          <SceneContent
            hideFortuneTube={hideFortuneTube}
            fortuneIdleBaseX={fortuneIdleBaseX}
            fortuneIdleBaseY={fortuneIdleBaseY}
            fortuneIdleScale={fortuneIdleScale}
            isTestMode={isTestMode}
            testSceneIndex={currentSceneIndex}
            isMobile={isMobile}
            jumpToTubeCloseup={jumpToTubeCloseup}
            onClearJumpToTubeCloseup={onClearJumpToTubeCloseup}
            jumpToFifthLayerTest={jumpToFifthLayerTest}
            onClearJumpToFifthLayerTest={onClearJumpToFifthLayerTest}
            jumpToSixthLayerTest={jumpToSixthLayerTest}
            onClearJumpToSixthLayerTest={onClearJumpToSixthLayerTest}
            onPickedStickChange={setPickedStickIdForLabel}
            onPickedLabelInFourthLayer={setPickedLabelFourthLayer}
            onRewindingStickChange={handleRewindingStickChange}
            onJiaoActiveChange={onJiaoActiveChange}
            onSixthLayerChange={onSixthLayerChange}
          />
        </React.Suspense>
      </Canvas>

      {/* 抽籤時「第 N 首」標籤（Canvas 外，永遠可見） */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1000, pointerEvents: "none" }}>
        {pickedStickIdForLabel !== null && (
          <div
            style={{
              position: "absolute",
              top: isPickedLabelFourthLayer
                ? (isMobile ? "74%" : "76%")
                : (isMobile ? "66%" : "70%"),
              left: isPickedLabelFourthLayer
                ? (isMobile ? "58%" : "66%")
                : (isMobile ? "54%" : "62.3%"),
              transform: "translate(-50%, -50%) rotate(-8deg)",
              fontFamily: "var(--font-noto-serif-tc), Noto Serif TC, serif",
              fontSize: isPickedLabelFourthLayer
                ? (isMobile ? 11 : 15)
                : (isMobile ? 13 : 18),
              fontWeight: 700,
              color: "#2c1810",
              writingMode: "vertical-rl",
              letterSpacing: "0.2em",
              opacity: labelFadeOpacity,
              transition: "opacity 0.4s ease-out, top 0.35s ease-out, left 0.35s ease-out",
            }}
          >
            第{numToChinese(pickedStickIdForLabel)}首
          </div>
        )}
      </div>

    </div>
  );
}
