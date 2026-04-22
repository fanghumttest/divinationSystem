"use client";

import React, { useRef, useState, useEffect, useLayoutEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { useTexture, Sparkles, Cloud, Html } from "@react-three/drei";
import * as THREE from "three";

import { assetUrl, renshengCardAssetPath, MAIN_BG_TEXTURE } from "@/lib/asset";
import { numToChinese, getTimeIndex } from "@/lib/utils";
import { Hotspot } from "./Hotspot";
import { PoemCard } from "./PoemCard";
import { FortuneSet } from "./FortuneSet";
import { SingleStickFromGLB } from "./SingleStick";
import { JiaoPairFromGLB } from "./JiaoPair";

/** 籤停妥後停留多久再開始淡出 3D 模型 */
const STICK_HOLD_BEFORE_FADE = 0.3;
/** 3D 籤淡出時長（秒） */
const STICK_FADE_OUT_DURATION = 0.55;

function applyDrawnStickMeshOpacity(root: THREE.Object3D | null, opacity: number) {
  if (!root) return;
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((mat) => {
      if (opacity < 1) {
        mat.transparent = true;
        mat.depthWrite = opacity > 0.92;
        mat.alphaTest = 0;
      }
      mat.opacity = opacity;
    });
  });
}

function restoreDrawnStickMeshOpaque(root: THREE.Object3D | null) {
  if (!root) return;
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((mat) => {
      mat.transparent = false;
      mat.opacity = 1;
      mat.depthWrite = true;
      mat.depthTest = true;
      mat.alphaTest = 0.01;
    });
  });
}

const BLANK_TEXTURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7YxWQAAAAASUVORK5CYII=";

const skyBgPaths   = [MAIN_BG_TEXTURE, MAIN_BG_TEXTURE, MAIN_BG_TEXTURE];
const bgPaths      = [BLANK_TEXTURE, BLANK_TEXTURE, BLANK_TEXTURE];
const leftLightPaths  = [BLANK_TEXTURE, BLANK_TEXTURE, BLANK_TEXTURE];
const rightLightPaths = [BLANK_TEXTURE, BLANK_TEXTURE, BLANK_TEXTURE];
const altarPaths   = [BLANK_TEXTURE, BLANK_TEXTURE, BLANK_TEXTURE];
const bookCabinetPath = BLANK_TEXTURE;
const cushionPath     = BLANK_TEXTURE;

/** 「慢慢抽出」階段：沿此向量從籤筒移出（上 5、往鏡頭 2） */
const PULL_OUT_OFFSET = new THREE.Vector3(0, 5, 2);

/** 擲筊預覽筊杯的待機位置（第一層擲筊 / 求籤流程）。
 *  與結果浮動停靠點 x=9 對齊，讓瞄準位置和結果展示位置一致。 */
const JIAO_BASE_X = 9;
const JIAO_BASE_Y = -6;
const JIAO_BASE_Z = 12;
/** 第四層：「確認詩籤」與第二輪擲筊筊杯群組共用高度（與下方 group position[1] 一致） */
const JIAO_FOURTH_LAYER_GROUP_Y = -14;

/** 所有籤筒上方熱點（求籤/擲筊/結束求籤/問修道/問人事/再問一題）共用的 x 偏移，
 *  用來對齊籤筒 GLB 實際視覺中央。若還沒對齊，調整此值即可：
 *  正值＝整組熱點往右、負值＝往左。*/
const TUBE_LABEL_OFFSET_X = -4;
/** 手機＋平板 stage4：籤筒下方整排熱點共用此 y，與擲筊／選單狀態無關，避免忽高忽低 */
const TUBE_HOTSPOT_ROW_Y_NARROW = 10;
/** 第五層籤筒本地縮放（原 1.4×1.5；略縮以利窄視窗構圖，須與進場動畫 target 一致） */
const FIFTH_LAYER_TUBE_SCALE = 1.4 * 1.5 * 0.97;

const ParallaxLayers = ({
  mouseRef,
  rawPointerRef,
  pointerDownRef,
  hideFortuneTube = false,
  fortuneIdleBaseX = -18,
  fortuneIdleBaseY = -38,
  fortuneIdleScale = 4,
  isTestMode = false,
  testSceneIndex = 0,
  isMobile = false,
  isNarrowViewport = false,
  jumpToTubeCloseup = false,
  onClearJumpToTubeCloseup,
  jumpToFifthLayerTest = false,
  onClearJumpToFifthLayerTest,
  jumpToSixthLayerTest = false,
  onClearJumpToSixthLayerTest,
  onPickedStickChange,
  onPickedLabelInFourthLayer,
  onFourthLayerPoemDisplayChange,
  onRewindingStickChange,
  onJiaoActiveChange,
  onSixthLayerChange,
  onFifthLayerChange,
}: {
  mouseRef: React.MutableRefObject<THREE.Vector2>;
  /** 直接指標 NDC（不經過 scrollPos 累加），手機擲筊瞄準用 */
  rawPointerRef?: React.MutableRefObject<THREE.Vector2>;
  /** 指標是否按下（觸控中／滑鼠左鍵按住），手機擲筊 shake 偵測只在按下時啟用 */
  pointerDownRef?: React.MutableRefObject<boolean>;
  hideFortuneTube?: boolean;
  fortuneIdleBaseX?: number;
  fortuneIdleBaseY?: number;
  fortuneIdleScale?: number;
  isTestMode?: boolean;
  testSceneIndex?: number;
  isMobile?: boolean;
  /** 手機＋平板（寬度小於 1024px）：與 isMobile 分離，供底部熱點統一高度 */
  isNarrowViewport?: boolean;
  jumpToTubeCloseup?: boolean;
  onClearJumpToTubeCloseup?: () => void;
  /** 測試用：一鍵進入第五層（固定第 N 首，可拖移找抽屜＋點擊打開） */
  jumpToFifthLayerTest?: boolean;
  onClearJumpToFifthLayerTest?: () => void;
  /** 測試用：一鍵進入第六層（直接展示卡面） */
  jumpToSixthLayerTest?: boolean;
  onClearJumpToSixthLayerTest?: () => void;
  onPickedStickChange?: (stickId: number | null) => void;
  /** 第四層時為 true，用於外層「第 N 首」overlay 位置 */
  onPickedLabelInFourthLayer?: (value: boolean) => void;
  /** 第四層顯示用的籤／詩編號（人事＝籤號；修道＝60 首對應）；null 表示隱藏 */
  onFourthLayerPoemDisplayChange?: (n: number | null) => void;
  /** 倒放詩籤動畫開始／結束，外層用來淡出「第 N 首」標籤 */
  onRewindingStickChange?: (rewinding: boolean) => void;
  /** 擲筊流程啟動（aiming/flying/result）／結束，外層用來調整神像卡位置 */
  onJiaoActiveChange?: (active: boolean) => void;
  /** 第六層開始／結束，外層用來隱藏神像卡 */
  onSixthLayerChange?: (active: boolean) => void;
  /** 第五層（旋轉籤筒／開抽屜）開始／結束，外層可隱藏 DOM 神像、調整 canvas mask */
  onFifthLayerChange?: (active: boolean) => void;
}) => {
  // --- 時段狀態 ---
  const [currentIdx, setCurrentIdx] = useState(getTimeIndex());
  const [nextIdx, setNextIdx]       = useState((getTimeIndex() + 1) % 3);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [fadeOpacity, setFadeOpacity] = useState(1);
  const fadeRef    = useRef(1);
  const transRef   = useRef(0);
  const switchedRef = useRef(false);

  // 籤筒互動熱點顯示狀態
  const [isTubeMenuVisible, setIsTubeMenuVisible] = React.useState(true);
  const [isTubeHovered, setIsTubeHovered] = React.useState(false); // hover 籤筒時，同時顯示兩個熱點

  // 擲筊流程狀態
  type JiaoResult = "聖杯" | "笑杯" | "陰杯";
  // idle：未啟動；aiming：中央跟隨滑鼠瞄準；flying：已擲出、往地面掉落；result：已落地顯示結果
  const [jiaoPhase, setJiaoPhase] = React.useState<"idle" | "aiming" | "flying" | "result">("idle");
  const [jiaoResult, setJiaoResult] = React.useState<JiaoResult | null>(null);

  // 求籤流程：throw_only = 只擲筊；fortune = 求籤（擲筊→聖杯→點籤筒→抽籤）
  const [flowMode, setFlowMode] = React.useState<"idle" | "throw_only" | "fortune">("idle");
  // 求籤流程中是否已得過聖杯（不侷限次數，有過就可點籤筒）
  const [shengBeiInFortuneFlow, setShengBeiInFortuneFlow] = React.useState(false);
  // 抽籤階段：idle / closeup（籤筒已拉到面前）/ picked（已抽出一支）
  const [drawingPhase, setDrawingPhase] = React.useState<"idle" | "closeup" | "picked">("idle");
  const [pickedStickId, setPickedStickId] = React.useState<number | null>(null);
  const closeupProgressRef = useRef(0);
  const closeupStartRef = useRef<{ x: number; y: number; z: number; scale: number } | null>(null);
  /** 第二層籤筒動畫改用「經過時間」驅動，避免 delta 累加造成卡頓 */
  const closeupStartTimeRef = useRef<number | null>(null);
  /** 第三層籤抽出時，籤筒退回 Stage 4 idle 的專屬退場動畫 */
  const pickedRetreatRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startZ: number;
    startScale: number;
    progress: number;
  } | null>(null);
  const tubeRotationYRef = useRef(0); // closeup 時使用者拖曳旋轉籤筒
  const tubeDragRef = useRef<{ active: boolean; startX: number; startRotationY: number; moved: boolean; pointerId: number }>({ active: false, startX: 0, startRotationY: 0, moved: false, pointerId: -1 });
  const hintCounterRotateRef = useRef<THREE.Group>(null); // 提示文字不隨籤筒旋轉，用反轉抵消
  const [showRetryButton, setShowRetryButton] = React.useState(false);
  // 第四階段會放大籤筒，熱點與 hover 區位置需反向補償，才會維持在籤筒上方。
  const uiAnchorScale = Math.max(1, fortuneIdleScale);
  // 手機＋平板 stage 4：籤筒在下半部，底部整排熱點同一高度（fortuneIdleBaseY 與 stage4 一致時 > -55）
  const narrowBottomHotspotLayout = isNarrowViewport && fortuneIdleBaseY > -55;
  // 窄視窗 stage 4：擲筊流程中隱藏 3D 籤桶（筊杯／結束求籤等熱點仍保留，y 與 idle 相同）
  const mobileJiaoHidden =
    narrowBottomHotspotLayout && jiaoPhase !== "idle" && drawingPhase === "idle";
  // 熱點 y（local space）：窄視窗整排固定 TUBE_HOTSPOT_ROW_Y_NARROW；桌機預設 25、第六層區塊另用 27
  // 注意：hotspot 位於 z=22（group z=8 + local z=7.78），比 z=0 更靠近相機，
  // 透視半高 ≈ 36.44，若 world y 太負（< -36）會被畫面底邊裁掉
  const tubeHotspotRowY = narrowBottomHotspotLayout ? TUBE_HOTSPOT_ROW_Y_NARROW : 25;
  // 垂直／窄視窗下補正 TUBE_LABEL_OFFSET_X(-4)，使熱點置中
  const tubeLabelXAdj = narrowBottomHotspotLayout ? 4 : 0;
  const uiPos = React.useCallback(
    (x: number, y: number, z: number): [number, number, number] => [
      x / uiAnchorScale,
      y,
      z / uiAnchorScale,
    ],
    [uiAnchorScale]
  );
  /** 籤筒正上方「置中」的熱點用：在 uiPos 上再加 TUBE_LABEL_OFFSET_X 對齊 GLB 視覺中心。 */
  const tubeTopPos = React.useCallback(
    (x: number, y: number, z: number): [number, number, number] =>
      uiPos(x + TUBE_LABEL_OFFSET_X, y, z),
    [uiPos]
  );
  /** 第六層工具列：桌機 y=-20；儲存＋± 整組右移（桌機定稿） */
  const sixthLayerDesktopSavePos = React.useMemo((): [number, number, number] => [6, -20, 35], []);
  const sixthLayerDesktopZoomPos = React.useMemo((): [number, number, number] => [16, -20, 35], []);
  /** 窄視窗（含手機）：第六層工具列 y 對齊「結束求籤」實際畫面高度
   *  結束求籤為籤筒 group 內部 hotspot：worldY = tubeEndY(-38) + rowY(10) = -28
   */
  const sixthLayerNarrowToolbarY = React.useMemo(
    () => -38 + TUBE_HOTSPOT_ROW_Y_NARROW + 10,
    []
  );
  /** 手機第六層：獨立 action row，放在「儲存圖片＋縮放」下方 */
  const sixthLayerMobileActionY = React.useMemo(
    () => sixthLayerNarrowToolbarY - 8,
    [sixthLayerNarrowToolbarY]
  );
  const sixthLayerMobileEndFortunePos = React.useMemo(
    (): [number, number, number] => [-5.5, sixthLayerMobileActionY, 31],
    [sixthLayerMobileActionY]
  );
  const sixthLayerMobileAskAgainPos = React.useMemo(
    (): [number, number, number] => [5.5, sixthLayerMobileActionY, 31],
    [sixthLayerMobileActionY]
  );
  /** 手機（<768）：底部工具列左右置中；平板窄視窗維持既有窄視窗座標 */
  const sixthLayerMobileSavePos = React.useMemo(
    (): [number, number, number] => [-6, sixthLayerNarrowToolbarY, 31],
    [sixthLayerNarrowToolbarY]
  );
  const sixthLayerMobileZoomPos = React.useMemo(
    (): [number, number, number] => [6, sixthLayerNarrowToolbarY, 31],
    [sixthLayerNarrowToolbarY]
  );
  const sixthLayerNarrowSavePos = React.useMemo(
    (): [number, number, number] =>
      isMobile ? sixthLayerMobileSavePos : [0, sixthLayerNarrowToolbarY, 31],
    [isMobile, sixthLayerMobileSavePos, sixthLayerNarrowToolbarY]
  );
  const sixthLayerNarrowZoomPos = React.useMemo(
    (): [number, number, number] =>
      isMobile ? sixthLayerMobileZoomPos : [12, sixthLayerNarrowToolbarY, 31],
    [isMobile, sixthLayerMobileZoomPos, sixthLayerNarrowToolbarY]
  );
  const sixthLayerSavePos = React.useMemo(
    (): [number, number, number] =>
      isNarrowViewport ? sixthLayerNarrowSavePos : sixthLayerDesktopSavePos,
    [isNarrowViewport, sixthLayerNarrowSavePos, sixthLayerDesktopSavePos]
  );
  const sixthLayerZoomPos = React.useMemo(
    (): [number, number, number] =>
      isNarrowViewport ? sixthLayerNarrowZoomPos : sixthLayerDesktopZoomPos,
    [isNarrowViewport, sixthLayerNarrowZoomPos, sixthLayerDesktopZoomPos]
  );
  /** 第六層詩籤定點 world X：手機置中；桌機維持定稿位置 */
  const sixthLayerCardRestX = React.useMemo(() => (isMobile ? 0 : 10), [isMobile]);
  /** 第五層籤筒定點：桌機維持右側；窄視窗水平置中並沿用 stage4 的 fortuneIdleBaseY，避免貼右裁切 */
  const fifthLayerTubeRest = React.useMemo(
    () => ({
      x: isNarrowViewport ? 0 : 22,
      y: isNarrowViewport ? fortuneIdleBaseY : -40,
      z: 28,
    }),
    [isNarrowViewport, fortuneIdleBaseY]
  );
  /** 第五層：確認詩籤後的最終展示狀態（籤筒移到中央、無抽籤提示、籤不再隨滑鼠滑動） */
  const [isFifthLayer, setIsFifthLayer] = React.useState(false);
  /** 第五層：當前旋轉對應的抽屜是否為目標詩籤（用於顯示「點擊打開抽屜」） */
  const atTargetDrawerRef = useRef(false);
  const [atTargetDrawer, setAtTargetDrawer] = React.useState(false);
  /** 第五層：要播放打開動畫的抽屜索引 0–49 */
  const [openDrawerIndex, setOpenDrawerIndex] = React.useState<number | null>(null);
  /** 第五層：FortuneSet 從 GLB 幾何算出的每個抽屜實際角度（弧度），用於旋轉對齊 */
  const drawerAnglesRef = useRef<number[] | null>(null);
  /** 第五層：目前正對鏡頭的籤號（1–49 或 1–60），供 UI 顯示「目前：第 X 首」 */
  const currentDisplayPoemIdRef = useRef<number>(1);
  const [currentDisplayPoemId, setCurrentDisplayPoemId] = React.useState<number>(1);
  /** 第五層進場時的籤筒平滑轉場動畫（從第四層位置慢慢移到第二層結構位置） */
  const fifthLayerAnimRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startZ: number;
    startScale: number;
    progress: number;
  } | null>(null);

  /** 第六層：展示詩籤卡面（卡片從抽屜飛出到中央，籤筒同時往左縮小） */
  const [isSixthLayer, setIsSixthLayer] = React.useState(false);
  const sixthLayerAnimRef = useRef<{
    active: boolean;
    progress: number;
    // 籤筒起點（第五層中央狀態）與終點（左下角小尺寸）
    tubeStartX: number; tubeStartY: number; tubeStartZ: number; tubeStartScale: number;
    tubeEndX: number; tubeEndY: number; tubeEndZ: number; tubeEndScale: number;
    // 卡片貝茲曲線控制點（世界座標）
    cardP0: THREE.Vector3; // 起點：抽屜口
    cardP1: THREE.Vector3; // 控制點：中間偏上
    cardP2: THREE.Vector3; // 終點：畫面中央
    // 卡片 scale
    cardStartScale: number;
    cardEndScale: number;
  } | null>(null);

  const poemCardGroupRef = useRef<THREE.Group>(null);
  const sixthLayerTimerRef = useRef<number | null>(null);
  /** 第六層：詩籤放大縮小（動畫結束後可調整） */
  const sixthLayerCardScaleRef = useRef(3.5);

  // 「第 N 首」：籤到位前不顯示，只在動畫結束後由 useFrame 通知；離開 picked 時隱藏
  React.useEffect(() => {
    if (drawingPhase !== "picked" || pickedStickId === null) {
      onPickedStickChange?.(null);
      labelNotifiedRef.current = false;
      drawnStickSettledAtRef.current = null;
      poemHtmlOpacityRef.current = 0;
      onFourthLayerPoemDisplayChange?.(null);
      // 若提前離開 picked，取消第三層自動收場計時
      if (postDisplayTimerRef.current !== null) {
        window.clearTimeout(postDisplayTimerRef.current);
        postDisplayTimerRef.current = null;
      }
    } else {
      labelNotifiedRef.current = false; // 剛進入 picked，等 useFrame 裡 progress>=1 再通知
      onPickedStickChange?.(null); // 先隱藏，到位後再顯示
      drawnStickSettledAtRef.current = null;
      poemHtmlOpacityRef.current = 0;
      onFourthLayerPoemDisplayChange?.(null);
    }
  }, [drawingPhase, pickedStickId, onPickedStickChange, onFourthLayerPoemDisplayChange]);

  useLayoutEffect(() => {
    if (spotLightRef.current && spotTargetRef.current) spotLightRef.current.target = spotTargetRef.current;
  }, []);

  // 測試模式：一鍵進入「求籤聖杯後，點擊完抽籤進入籤筒放大」階段，並顯示聖杯筊杯
  React.useEffect(() => {
    if (!jumpToTubeCloseup) return;
    setFlowMode("fortune");
    setShengBeiInFortuneFlow(true);
    setDrawingPhase("closeup");
    setJiaoPhase("result");
    setJiaoResult("聖杯");
    closeupProgressRef.current = 1;
    const ty = -44;
    const tz = 28;
    const tScale = 1.4;
    closeupStartRef.current = { x: 0, y: ty, z: tz, scale: tScale };
    if (fortuneGroupRef.current) {
      fortuneGroupRef.current.position.set(0, ty, tz);
      fortuneGroupRef.current.scale.setScalar(tScale);
    }
    if (jiaoPreviewRef.current) {
      jiaoPreviewRef.current.position.set(JIAO_BASE_X, JIAO_BASE_Y, JIAO_BASE_Z);
    }
    onClearJumpToTubeCloseup?.();
  }, [jumpToTubeCloseup, onClearJumpToTubeCloseup]);

  // 測試模式：一鍵進入第五層（固定第 N 首，籤筒在中央、可拖移找抽屜＋點擊打開）
  const FIFTH_LAYER_TEST_POEM_ID = 13;
  React.useEffect(() => {
    if (!jumpToFifthLayerTest) return;
    setFlowMode("fortune");
    setIsFifthLayer(true);
    setDrawingPhase("closeup");
    setPickedStickId(null);
    setConfirmStickId(FIFTH_LAYER_TEST_POEM_ID);
    setConfirmPoemId(FIFTH_LAYER_TEST_POEM_ID);
    setPoemType("rensheng");
    drawnStickProgressRef.current = 0;
    atTargetDrawerRef.current = false;
    setAtTargetDrawer(false);
    setOpenDrawerIndex(null);
    if (fortuneGroupRef.current) {
      fortuneGroupRef.current.position.set(
        fifthLayerTubeRest.x,
        fifthLayerTubeRest.y,
        fifthLayerTubeRest.z
      );
      fortuneGroupRef.current.scale.setScalar(FIFTH_LAYER_TUBE_SCALE);
      fortuneGroupRef.current.rotation.set(0, 0, 0);
    }
    fifthLayerAnimRef.current = {
      active: false,
      startX: fifthLayerTubeRest.x,
      startY: fifthLayerTubeRest.y,
      startZ: fifthLayerTubeRest.z,
      startScale: FIFTH_LAYER_TUBE_SCALE,
      progress: 1,
    };
    setJiaoPhase("idle");
    setJiaoResult(null);
    setSecondJiaoStarted(false);
    onPickedStickChange?.(null);
    onPickedLabelInFourthLayer?.(false);
    onClearJumpToFifthLayerTest?.();
  }, [
    jumpToFifthLayerTest,
    onClearJumpToFifthLayerTest,
    onPickedStickChange,
    onPickedLabelInFourthLayer,
    fifthLayerTubeRest.x,
    fifthLayerTubeRest.y,
    fifthLayerTubeRest.z,
  ]);

  // 測試模式：一鍵進入第六層（跳過第五層旋轉，直接打開抽屜並展示卡面）
  const SIXTH_LAYER_TEST_POEM_ID = 13;
  React.useEffect(() => {
    if (!jumpToSixthLayerTest) return;
    setFlowMode("fortune");
    setIsFifthLayer(true);
    setIsSixthLayer(false);
    setDrawingPhase("closeup");
    setPickedStickId(null);
    setConfirmStickId(SIXTH_LAYER_TEST_POEM_ID);
    setConfirmPoemId(SIXTH_LAYER_TEST_POEM_ID);
    setPoemType("rensheng");
    drawnStickProgressRef.current = 0;
    atTargetDrawerRef.current = false;
    setAtTargetDrawer(false);
    if (fortuneGroupRef.current) {
      fortuneGroupRef.current.position.set(
        fifthLayerTubeRest.x,
        fifthLayerTubeRest.y,
        fifthLayerTubeRest.z
      );
      fortuneGroupRef.current.scale.setScalar(FIFTH_LAYER_TUBE_SCALE);
      fortuneGroupRef.current.rotation.set(0, 0, 0);
    }
    fifthLayerAnimRef.current = {
      active: false,
      startX: fifthLayerTubeRest.x,
      startY: fifthLayerTubeRest.y,
      startZ: fifthLayerTubeRest.z,
      startScale: FIFTH_LAYER_TUBE_SCALE,
      progress: 1,
    };
    setJiaoPhase("idle");
    setJiaoResult(null);
    setSecondJiaoStarted(false);
    onPickedStickChange?.(null);
    onPickedLabelInFourthLayer?.(false);
    // 立即打開目標抽屜，觸發 6th layer
    const tIdx = SIXTH_LAYER_TEST_POEM_ID - 1;
    setOpenDrawerIndex(tIdx);
    onClearJumpToSixthLayerTest?.();
  }, [
    jumpToSixthLayerTest,
    onClearJumpToSixthLayerTest,
    onPickedStickChange,
    onPickedLabelInFourthLayer,
    fifthLayerTubeRest.x,
    fifthLayerTubeRest.y,
    fifthLayerTubeRest.z,
  ]);

  // 笑杯／陰杯時延遲顯示「再試一次」，先讓使用者看到結果。
  // 第二輪時仍會更新 showRetryButton，但實際按鈕會再以 confirmStickId === null 判斷是否顯示。
  React.useEffect(() => {
    if (jiaoPhase === "result" && (jiaoResult === "笑杯" || jiaoResult === "陰杯")) {
      setShowRetryButton(false);
      const t = setTimeout(() => setShowRetryButton(true), 1400);
      return () => clearTimeout(t);
    } else {
      setShowRetryButton(false);
    }
  }, [jiaoPhase, jiaoResult]);

  // 擲筊搖動與下落模擬
  const jiaoLastTyRef = useRef(0);
  const jiaoShakeRef = useRef(0); // 滑鼠上下晃動累積值
  const jiaoVyRef = useRef(0); // 筊杯下落速度
  // 手機：用於判斷「剛按下」那幀，避免從舊 ty 計算出的 dy 誤觸發擲出
  const jiaoPrevPointerDownRef = useRef(false);

  /** 進入 aiming 時與瞄準用同一套 Y（手機用 rawPointer，桌機用 mouseRef） */
  const resetJiaoAimBaseline = React.useCallback(() => {
    if (isMobile && rawPointerRef) {
      jiaoLastTyRef.current = rawPointerRef.current.y;
    } else {
      jiaoLastTyRef.current = mouseRef.current.y;
    }
  }, [isMobile, rawPointerRef, mouseRef]);

  const handleRetryRef = useRef<() => void>(() => {});
  handleRetryRef.current = () => {
    setIsFifthLayer(false);
    setJiaoPhase("aiming");
    setJiaoResult(null);
    setShowRetryButton(false);
    resetJiaoAimBaseline();
    jiaoShakeRef.current = 0;
    jiaoVyRef.current = 0;
    if (jiaoPreviewRef.current) {
      jiaoPreviewRef.current.position.set(JIAO_BASE_X, JIAO_BASE_Y, JIAO_BASE_Z);
    }
  };

  // 求籤：彈出筊（不讓使用者選哪一對），直接進入擲筊
  const handleClickQiuqian = React.useCallback(() => {
    setIsFifthLayer(false);
    setIsSixthLayer(false); // 確保再次求籤時 closeup 動畫可正常執行
    rejectedStickIdsRef.current.clear();
    setFlowMode("fortune");
    setShengBeiInFortuneFlow(false);
    setDrawingPhase("idle");
    setPickedStickId(null);
    setJiaoPhase("aiming");
    setJiaoResult(null);
    resetJiaoAimBaseline();
    jiaoShakeRef.current = 0;
    jiaoVyRef.current = 0;
    if (jiaoPreviewRef.current) {
      jiaoPreviewRef.current.position.set(JIAO_BASE_X, JIAO_BASE_Y, JIAO_BASE_Z);
    }
    onJiaoActiveChange?.(true);
  }, [onJiaoActiveChange, resetJiaoAimBaseline]);

  // 第六層「再問一題」：返回第一層且進入第一次擲筊狀態（等同剛點過求籤）
  const handleAskAgain = React.useCallback(() => {
    setConfirmStickId(null);
    setConfirmPoemId(null);
    setPoemType(null);
    setDrawingPhase("idle");
    setPickedStickId(null);
    setIsFifthLayer(false);
    setIsSixthLayer(false);
    rejectedStickIdsRef.current.clear();
    drawnStickProgressRef.current = 0;
    if (pickedStickMeshRef.current) {
      (pickedStickMeshRef.current as THREE.Mesh).visible = true;
      pickedStickMeshRef.current = null;
    }
    onPickedStickChange?.(null);
    setSecondJiaoStarted(false);
    setFlowMode("fortune");
    setShengBeiInFortuneFlow(false);
    setJiaoPhase("aiming");
    setJiaoResult(null);
    resetJiaoAimBaseline();
    jiaoShakeRef.current = 0;
    jiaoVyRef.current = 0;
    if (jiaoPreviewRef.current) {
      jiaoPreviewRef.current.position.set(JIAO_BASE_X, JIAO_BASE_Y, JIAO_BASE_Z);
    }
    onJiaoActiveChange?.(true);
  }, [onPickedStickChange, onJiaoActiveChange, resetJiaoAimBaseline]);

  const handleEndFortune = React.useCallback(() => {
    setConfirmStickId(null);
    setConfirmPoemId(null);
    setPoemType(null);
    setFlowMode("idle");
    setShengBeiInFortuneFlow(false);
    setJiaoPhase("idle");
    setJiaoResult(null);
    setDrawingPhase("idle");
    setPickedStickId(null);
    setIsFifthLayer(false);
    setIsSixthLayer(false); // 第六層結束後點「結束求籤」須重置，否則再次求籤時 closeup 動畫不會跑
    rejectedStickIdsRef.current.clear();
    drawnStickProgressRef.current = 0;
    if (pickedStickMeshRef.current) {
      (pickedStickMeshRef.current as THREE.Mesh).visible = true;
      pickedStickMeshRef.current = null;
    }
    onPickedStickChange?.(null);
    setSecondJiaoStarted(false);
  }, [onPickedStickChange]);

  // 第四層：使用者按下「確認詩籤」後，啟動第二輪擲筊（不改變抽籤層級）
  const handleStartSecondJiao = React.useCallback(() => {
    setIsFifthLayer(false);
    if (secondJiaoSuccessTimerRef.current !== null) {
      window.clearTimeout(secondJiaoSuccessTimerRef.current);
      secondJiaoSuccessTimerRef.current = null;
    }
    setSecondJiaoStarted(true);
    setJiaoPhase("aiming");
    setJiaoResult(null);
    setShowRetryButton(false);
    resetJiaoAimBaseline();
    jiaoShakeRef.current = 0;
    jiaoVyRef.current = 0;
    if (jiaoPreviewRef.current) {
      // 第二輪：與「確認詩籤」筊杯同一高度；x 略左避免壓到畫面元素
      jiaoPreviewRef.current.position.set(-2, JIAO_FOURTH_LAYER_GROUP_Y, JIAO_BASE_Z);
    }
    // 直接通知外層：第二輪擲筊開始，讓神像卡往左讓位
    onJiaoActiveChange?.(true);
  }, [onJiaoActiveChange, resetJiaoAimBaseline]);

  const handleClickThrowBlocks = React.useCallback(() => {
    setIsFifthLayer(false);
    setFlowMode("throw_only");
    setJiaoPhase((prev) => (prev === "flying" ? prev : "aiming"));
    setJiaoResult(null);
    resetJiaoAimBaseline();
    jiaoShakeRef.current = 0;
    jiaoVyRef.current = 0;
    if (jiaoPreviewRef.current) {
      jiaoPreviewRef.current.position.set(JIAO_BASE_X, JIAO_BASE_Y, JIAO_BASE_Z);
    }
    onJiaoActiveChange?.(true);
  }, [onJiaoActiveChange, resetJiaoAimBaseline]);

  /** 手機版：明確「擲出」熱點（與拖移甩杯同等效果，方便觸控／DevTools 模擬測試） */
  const handleMobileExplicitThrow = React.useCallback(() => {
    if (jiaoPhase !== "aiming") return;
    jiaoShakeRef.current = 0;
    jiaoVyRef.current = 22;
    setJiaoPhase("flying");
  }, [jiaoPhase]);

  // 求籤聖杯後：點「抽籤」或籤筒本體 → 籤筒拉近進入 closeup（問修道 60 首 / 問人事 49 首）
  const handleEnterCloseup = React.useCallback((type?: "rensheng" | "xiudao") => {
    if (flowMode !== "fortune" || !shengBeiInFortuneFlow || drawingPhase !== "idle") return;
    if (type) setPoemType(type);
    if (fortuneGroupRef.current) {
      closeupStartRef.current = {
        x: fortuneGroupRef.current.position.x,
        y: fortuneGroupRef.current.position.y,
        z: fortuneGroupRef.current.position.z,
        scale: fortuneGroupRef.current.scale.x,
      };
    }
    closeupProgressRef.current = 0;
    closeupStartTimeRef.current = null; // 下一幀 useFrame 會用 clock 寫入開始時間
    tubeRotationYRef.current = 0;
    setDrawingPhase("closeup");
  }, [flowMode, shengBeiInFortuneFlow, drawingPhase]);

  const handlePickStick = React.useCallback((num: number, stickMesh: THREE.Object3D) => {
    // 起點＝被點到的那支籤的世界座標；抽出終點＝起點＋沿「上、往鏡頭」方向偏移
    const worldPos = new THREE.Vector3();
    stickMesh.getWorldPosition(worldPos);
    drawnStickStartRef.current.copy(worldPos);
    drawnStickPullOutEndRef.current.copy(worldPos).add(PULL_OUT_OFFSET);
    drawnStickProgressRef.current = 0;
    pickedStickMeshRef.current = stickMesh;
    (stickMesh as THREE.Mesh).visible = false;
    mobilePickedTubeRetreatDoneRef.current = false;
    // 啟動籤筒退場動畫：從目前位置（closeup 放大狀態）平滑回到 Stage 4 idle
    if (fortuneGroupRef.current) {
      const fg = fortuneGroupRef.current;
      fg.visible = true;
      pickedRetreatRef.current = {
        active: true,
        startX: fg.position.x,
        startY: fg.position.y,
        startZ: fg.position.z,
        startScale: fg.scale.x,
        progress: 0,
      };
    }
    setPickedStickId(num);
    setDrawingPhase("picked");
    // 籤抽出時神像往左讓位，和擲筊時行為一致
    onJiaoActiveChange?.(true);
  }, [onJiaoActiveChange]);

  const size = useThree((state) => state.size);

  // --- 載入所有紋理（當前 + 下一時段 + 靜態）---
  const [
    curSky,  nxtSky,
    curBg,   nxtBg,
    curLL,   nxtLL,
    curRL,   nxtRL,
    curAltar, nxtAltar,
    bookCabinet, cushion,
  ] = useTexture([
    skyBgPaths[currentIdx],      skyBgPaths[nextIdx],
    bgPaths[currentIdx],         bgPaths[nextIdx],
    leftLightPaths[currentIdx],  leftLightPaths[nextIdx],
    rightLightPaths[currentIdx], rightLightPaths[nextIdx],
    altarPaths[currentIdx],      altarPaths[nextIdx],
    bookCabinetPath,             cushionPath,
  ]);

  // 背景採用「中心滿版（cover）」；月亮在上方，焦點略往上避免被裁切。
  React.useEffect(() => {
    const applySkyCover = (tex: THREE.Texture | null, focusY = 0.72) => {
      if (!tex || !tex.image || !size.width || !size.height) return;
      const img = tex.image as { width?: number; height?: number };
      const imgW = img.width;
      const imgH = img.height;
      if (!imgW || !imgH) return;

      const viewportAspect = size.width / size.height;
      const imageAspect = imgW / imgH;

      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.repeat.set(1, 1);
      tex.offset.set(0, 0);

      if (viewportAspect > imageAspect) {
        const repeatY = imageAspect / viewportAspect;
        tex.repeat.set(1, repeatY);
        tex.offset.set(0, (1 - repeatY) * focusY);
      } else if (viewportAspect < imageAspect) {
        const repeatX = viewportAspect / imageAspect;
        tex.repeat.set(repeatX, 1);
        tex.offset.set((1 - repeatX) * 0.5, 0);
      }

      tex.needsUpdate = true;
    };

    applySkyCover(curSky);
    applySkyCover(nxtSky);
  }, [curSky, nxtSky, size.width, size.height]);

  // --- Mesh refs ---
  const skyMeshRef     = useRef<THREE.Mesh>(null);
  const nxtSkyMeshRef  = useRef<THREE.Mesh>(null);
  const bgMeshRef      = useRef<THREE.Mesh>(null);
  const nxtBgMeshRef   = useRef<THREE.Mesh>(null);
  const llMeshRef      = useRef<THREE.Mesh>(null);
  const nxtLlMeshRef   = useRef<THREE.Mesh>(null);
  const rlMeshRef      = useRef<THREE.Mesh>(null);
  const nxtRlMeshRef   = useRef<THREE.Mesh>(null);
  const altarMeshRef   = useRef<THREE.Mesh>(null);
  const nxtAltarMeshRef= useRef<THREE.Mesh>(null);
  const cabinetMeshRef = useRef<THREE.Mesh>(null);
  const cushionMeshRef = useRef<THREE.Mesh>(null);
  const fortuneGroupRef = useRef<THREE.Group>(null);
  const fortuneLabelGroupRef = useRef<THREE.Group | null>(null);
  /** 第六層：目前打開抽屜「抽屜口」的世界座標（由 FortuneSet 回報） */
  const drawerMouthWorldPosRef = useRef<THREE.Vector3 | null>(null);
  const sticksGroupRef = useRef<THREE.Group>(null); // 籤束 group，closeup 時用滑鼠 X 搓圈
  const isOverSticksRef = useRef(false);
  const lastSticksMoveTimeRef = useRef(0); // 籤上最近一次滑鼠移動時間，只有滑動時才動
  const spotTargetRef = useRef<THREE.Group>(null);
  const spotLightRef = useRef<THREE.SpotLight>(null);
  const jiaoPreviewRef = useRef<THREE.Group>(null);
  const jiaoInnerRef = useRef<THREE.Group>(null);
  const drawnStickStartRef = useRef(new THREE.Vector3());
  // 以第24首位置為準，第1～49首皆用此展示點。相機在 +Z 看 -Z，Z 越大越靠前
  const DRAWN_STICK_REF_POSITION = { x: 10, y: -52, z: 34 };
  /** 第四層右側詩籤展示位置（縮小後往上移，Y 較大） */
  const DRAWN_STICK_REF_POSITION_FOURTH = { x: 14.5, y: -42, z: 34 };
  /** 窄視窗：展示終點 X≈0 與畫面水平置中（相機 +Z 朝 -Z，+X 為畫面右側） */
  const DRAWN_STICK_REF_POSITION_MOBILE = { x: 0, y: -50.5, z: 34 };
  const DRAWN_STICK_REF_POSITION_FOURTH_MOBILE = { x: 0, y: -40.5, z: 34 };
  const drawnStickEndRef = useRef(new THREE.Vector3(DRAWN_STICK_REF_POSITION.x, DRAWN_STICK_REF_POSITION.y, DRAWN_STICK_REF_POSITION.z));
  const drawnStickAnimEndScratchRef = useRef(new THREE.Vector3());
  const drawnStickPullOutEndRef = useRef(new THREE.Vector3());
  const drawnStickProgressRef = useRef(0);
  /** 籤動畫到位後才通知主組件顯示「第 N 首」，避免動畫過程中就出現 */
  const labelNotifiedRef = useRef(false);
  /** 第三層展示結束後短暫停留再自動收場（設 confirmStickId）用的計時器 */
  const postDisplayTimerRef = useRef<number | null>(null);
  /** 第四層（第二輪擲筊確認）所用的候選籤號：第 N 首 */
  const [confirmStickId, setConfirmStickId] = useState<number | null>(null);
  /** 問人事 49 首 vs 問修道 60 首（決定第五層抽屜對應格數） */
  const [poemType, setPoemType] = React.useState<"rensheng" | "xiudao" | null>(null);
  /** 確認的詩籤編號：問人事 1–49，問修道 1–60（第五層找抽屜用） */
  const [confirmPoemId, setConfirmPoemId] = React.useState<number | null>(null);

  // 第四層：候選籤（confirmStickId）確定後才通知 Canvas 外顯示，時機與 0.3s 收場計時一致
  React.useEffect(() => {
    if (!onFourthLayerPoemDisplayChange) return;
    if (
      drawingPhase !== "picked" ||
      pickedStickId === null ||
      confirmStickId === null ||
      flowMode !== "fortune" ||
      isFifthLayer ||
      isSixthLayer
    ) {
      onFourthLayerPoemDisplayChange(null);
      return;
    }
    const n =
      poemType === "xiudao"
        ? (confirmPoemId ?? pickedStickId)
        : confirmStickId;
    onFourthLayerPoemDisplayChange(n);
  }, [
    drawingPhase,
    pickedStickId,
    confirmStickId,
    confirmPoemId,
    poemType,
    flowMode,
    isFifthLayer,
    isSixthLayer,
    onFourthLayerPoemDisplayChange,
  ]);

  const handleDownloadCard = React.useCallback(async () => {
    if (confirmPoemId == null || !poemType) return;
    const src =
      poemType === "rensheng"
        ? assetUrl(renshengCardAssetPath(confirmPoemId))
        : assetUrl(`/v1/cards/xiudao/${confirmPoemId}.webp`);
    const name =
      poemType === "rensheng"
        ? `四聖真君靈籤-第${numToChinese(confirmPoemId)}首.png`
        : `修道真言-第${numToChinese(confirmPoemId)}首.png`;
    try {
      const res = await fetch(src, { cache: "force-cache" });
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas ctx unavailable");
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close?.();
      const pngBlob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob null"))),
          "image/png"
        );
      });
      const url = URL.createObjectURL(pngBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("[poem-card] PNG 下載失敗，改直接下載原檔", err);
      const a = document.createElement("a");
      a.href = src;
      a.download = name.replace(/\.png$/i, ".webp");
      a.click();
    }
  }, [confirmPoemId, poemType]);

  /** 第五層：目標抽屜索引（0–49）。問人事直接 = poemId-1；問修道找最接近虛擬角度的實體抽屜。 */
  const targetDrawerIndex = React.useMemo<number | null>(() => {
    if (confirmPoemId == null || !poemType) return null;
    if (poemType === "rensheng") return confirmPoemId - 1;
    // 問修道：虛擬角度 → 找最近的實體抽屜
    const angles = drawerAnglesRef.current;
    if (!angles || angles.length < 50) {
      return Math.round(((confirmPoemId - 1) / 60) * 50) % 50; // fallback
    }
    const twoPi = 2 * Math.PI;
    const targetVirtualAngle = ((confirmPoemId - 1) / 60) * twoPi;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < 50; i++) {
      const a = ((angles[i] % twoPi) + twoPi) % twoPi;
      let d = ((a - targetVirtualAngle) % twoPi + twoPi + Math.PI) % twoPi - Math.PI;
      if (Math.abs(d) < bestDist) {
        bestDist = Math.abs(d);
        bestIdx = i;
      }
    }
    return bestIdx;
  }, [confirmPoemId, poemType]);

  // 第六層觸發：抽屜打開後等待 1 秒，再讓紙張飛出＋抽屜關上＋籤筒往左縮回原位
  React.useEffect(() => {
    if (sixthLayerTimerRef.current !== null) {
      window.clearTimeout(sixthLayerTimerRef.current);
      sixthLayerTimerRef.current = null;
    }
    if (openDrawerIndex == null || !isFifthLayer || confirmPoemId == null || !poemType) return;
    sixthLayerTimerRef.current = window.setTimeout(() => {
      const fg = fortuneGroupRef.current;
      if (!fg) return;
      const tubeStartX = fg.position.x;
      const tubeStartY = fg.position.y;
      const tubeStartZ = fg.position.z;
      const tubeStartScale = fg.scale.x;
      // 第六層：籤筒在左側的尺寸與位置（手機版縮減 x 偏移與縮放）
      const tubeEndX = isMobile ? -14 : -25;
      const tubeEndY = -38;
      const tubeEndZ = 28;
      const tubeEndScale = isMobile ? 1.2 : 1.4;
      // 卡片起點：抽屜口（若有來自 FortuneSet 的世界座標，就用那個；否則退回籤筒前方預設點）
      const fallbackP0 = new THREE.Vector3(tubeStartX, tubeStartY + 16, tubeStartZ + 12);
      const cardP0 = drawerMouthWorldPosRef.current
        ? drawerMouthWorldPosRef.current.clone()
        : fallbackP0;
      // 控制點：往上拱（x 與終點對齊，貝茲弧線自然往右）
      const cardP1 = new THREE.Vector3(
        sixthLayerCardRestX * 0.55,
        isMobile ? 8 : 10,
        isMobile ? 26 : 30
      );
      // 終點：畫面偏右、略上（手機靠近鏡頭、縮小以符合視錐）
      const cardP2 = new THREE.Vector3(
        sixthLayerCardRestX,
        isMobile ? 4 : 2,
        isMobile ? 30 : 34
      );

      sixthLayerAnimRef.current = {
        active: true,
        progress: 0,
        tubeStartX, tubeStartY, tubeStartZ, tubeStartScale,
        tubeEndX, tubeEndY, tubeEndZ, tubeEndScale,
        cardP0,
        cardP1,
        cardP2,
        cardStartScale: 0.05,
        cardEndScale: isMobile ? 3.6 : 4,
      };
      // 啟動第六層時，同步關上抽屜（FortuneSet 會偵測 openDrawerIndex 變回 null 自行推回）
      setOpenDrawerIndex(null);
      setIsSixthLayer(true);
    }, 1000);
    return () => {
      if (sixthLayerTimerRef.current !== null) {
        window.clearTimeout(sixthLayerTimerRef.current);
        sixthLayerTimerRef.current = null;
      }
    };
  }, [openDrawerIndex, isFifthLayer, confirmPoemId, poemType, sixthLayerCardRestX, isMobile]);

  /** 是否已啟動第二輪擲筊（第四層） */
  const [secondJiaoStarted, setSecondJiaoStarted] = React.useState(false);
  /** 第二輪擲筊失敗時顯示「不是這首，請再抽一次」提示 */
  const [secondJiaoMessageVisible, setSecondJiaoMessageVisible] = React.useState(false);
  /** 第二輪擲筊失敗後，等待約 1.5 秒再啟動抽出籤「倒放」動畫用的計時器 */
  const secondJiaoFailTimerRef = useRef<number | null>(null);
  /** 第二輪擲筊聖杯後，等待約 1.5 秒再進入第五層用的計時器 */
  const secondJiaoSuccessTimerRef = useRef<number | null>(null);
  /** 是否正在將抽出的籤倒放回籤筒（第二輪擲筊失敗後啟動；聖杯成功時也先倒放再進入第五層） */
  const [isRewindingStick, setIsRewindingStick] = React.useState(false);
  /** 倒放完成後要進入第五層（聖杯成功）；若 false 則為笑杯／陰杯，回到第二層 */
  const rewindForFifthLayerRef = useRef(false);
  /** 第二輪擲筊笑杯／陰杯時「不是這首」的籤號，再抽時排除，直到聖杯為止 */
  const rejectedStickIdsRef = useRef<Set<number>>(new Set());
  /** 第一層求籤：聖杯後，等待使用者選擇「抽籤」或結束前的中間狀態 */
  const [isWaitingQuestionType, setIsWaitingQuestionType] = React.useState(false);
  /** 動畫總時長約 1.2 秒；前 40% 為「慢慢抽出」，後 60% 為「移到展示點」 */
  const DRAWN_STICK_PHASE1_RATIO = 0.4;
  const DRAWN_STICK_SPEED = 0.85;
  /** 籤筒的 scale，抽出時籤要與筒內同大小才不會「浮一隻巨籤」 */
  const TUBE_SCALE = 8.5;
  /** 第三層展示時的 scale（右側大籤） */
  const DISPLAY_SCALE = 30;
  /** 第四層展示時的 scale（右側大籤縮小版） */
  const DISPLAY_SCALE_FOURTH = 22;
  /** 手機：抽出後詩籤縮放（第三段終點／await 確認前／第四層終點） */
  const DISPLAY_SCALE_MOBILE = 23;
  const DISPLAY_SCALE_FOURTH_MOBILE = 17;
  const drawnStickGroupRef = useRef<THREE.Group>(null);
  /** 僅包住抽出的一支 3D 籤，供淡出時改透明度／隱藏 */
  const drawnStickModelRef = useRef<THREE.Group>(null);
  /** 籤動畫第一次 t>=1 的時間，用於 0.3s 後開始淡出 */
  const drawnStickSettledAtRef = useRef<number | null>(null);
  const pickedStickMeshRef = useRef<THREE.Object3D | null>(null); // 抽出的那支籤，picked 時隱藏原籤
  /** 手機：picked 籤筒右移退場動畫跑完後隱藏籤筒（進第五層／倒放時再顯示） */
  const mobilePickedTubeRetreatDoneRef = useRef(false);
  const { raycaster, camera, gl, clock } = useThree();
  /** 內部用：3D 籤淡出階段與 mesh 還原判斷（標籤改由 Canvas 外 DOM 顯示） */
  const poemHtmlOpacityRef = useRef(0);

  // 離開第四層（或清掉候選籤）時，重置第二輪擲筊狀態
  React.useEffect(() => {
    if (confirmStickId === null || drawingPhase !== "picked") {
      setSecondJiaoStarted(false);
    }
  }, [confirmStickId, drawingPhase]);

  React.useEffect(() => {
    if (drawingPhase !== "picked") {
      mobilePickedTubeRetreatDoneRef.current = false;
      if (fortuneGroupRef.current) fortuneGroupRef.current.visible = true;
    }
  }, [drawingPhase]);

  React.useEffect(() => {
    if (isFifthLayer && fortuneGroupRef.current) {
      fortuneGroupRef.current.visible = true;
    }
  }, [isFifthLayer]);

  // 倒放詩籤時通知外層淡出「第 N 首」標籤，不要留在原地
  React.useEffect(() => {
    onRewindingStickChange?.(isRewindingStick);
  }, [isRewindingStick, onRewindingStickChange]);

  // 擲筊流程啟動／結束通知外層（用於讓神像卡在擲筊時再向左讓位）
  // 只在 jiaoPhase 回到 idle 時呼叫 false（回原位），啟動時由各 handler 直接呼叫 true
  React.useEffect(() => {
    if (jiaoPhase === "idle") {
      onJiaoActiveChange?.(false);
    }
  }, [jiaoPhase, onJiaoActiveChange]);

  // 第六層開始／結束通知外層（用於隱藏神像卡）
  React.useEffect(() => {
    onSixthLayerChange?.(isSixthLayer);
  }, [isSixthLayer, onSixthLayerChange]);

  // 第五層開始／結束通知外層（用於隱藏 DOM 神像，只留 3D 籤筒）
  React.useEffect(() => {
    onFifthLayerChange?.(isFifthLayer);
  }, [isFifthLayer, onFifthLayerChange]);

  // 通知外層：右側「第 N 首」overlay 是否要用第四層位置（詩籤縮小上移）
  React.useEffect(() => {
    const inFourth =
      drawingPhase === "picked" && pickedStickId !== null && confirmStickId !== null;
    onPickedLabelInFourthLayer?.(inFourth);
  }, [drawingPhase, pickedStickId, confirmStickId, onPickedLabelInFourthLayer]);

  // 一進入 picked 就寫入起始點與 scale，避免第一幀錯位或巨籤
  useLayoutEffect(() => {
    if (drawingPhase !== "picked" || pickedStickId === null) return;
    if (drawnStickGroupRef.current) {
      drawnStickGroupRef.current.position.copy(drawnStickStartRef.current);
      drawnStickGroupRef.current.scale.setScalar(TUBE_SCALE);
    }
  }, [drawingPhase, pickedStickId]);

  // --- Material refs（控制透明度）---
  const skyMatRef      = useRef<THREE.MeshBasicMaterial>(null);
  const nxtSkyMatRef   = useRef<THREE.MeshBasicMaterial>(null);
  const bgMatRef       = useRef<THREE.MeshBasicMaterial>(null);
  const nxtBgMatRef    = useRef<THREE.MeshBasicMaterial>(null);
  const llMatRef       = useRef<THREE.MeshBasicMaterial>(null);
  const nxtLlMatRef    = useRef<THREE.MeshBasicMaterial>(null);
  const rlMatRef       = useRef<THREE.MeshBasicMaterial>(null);
  const nxtRlMatRef    = useRef<THREE.MeshBasicMaterial>(null);
  const altarMatRef    = useRef<THREE.MeshBasicMaterial>(null);
  const nxtAltarMatRef = useRef<THREE.MeshBasicMaterial>(null);

  // 窗外雲朵群組 ref（用來做水平方向飄移）
  const skyCloudFarRef = useRef<THREE.Group>(null);
  const skyCloudNearRef = useRef<THREE.Group>(null);

  // --- 測試模式：手動切換時段 ---
  useEffect(() => {
    if (isTestMode && !isTransitioning && currentIdx !== testSceneIndex) {
      setNextIdx(testSceneIndex);
      setIsTransitioning(true);
      fadeRef.current = 1;
      transRef.current = 0;
      switchedRef.current = false;
    }
  }, [isTestMode, testSceneIndex, currentIdx, isTransitioning]);

  // --- 自動時段切換（非測試模式）---
  const lastHourRef = useRef(-1);
  useEffect(() => {
    if (isTestMode) return;
    const check = () => {
      if (isTransitioning) return;
      const hour = new Date().getHours();
      const target = getTimeIndex();
      if (currentIdx !== target && lastHourRef.current !== hour) {
        lastHourRef.current = hour;
        setNextIdx(target);
        setIsTransitioning(true);
        fadeRef.current = 1;
        transRef.current = 0;
        switchedRef.current = false;
      }
    };
    check();
    lastHourRef.current = new Date().getHours();
    const timer = setInterval(check, 60_000);
    return () => clearInterval(timer);
  }, [isTransitioning, currentIdx, isTestMode]);

  // --- 每幀更新：視差 + 過渡 + 光牆閃爍 ---
  useFrame((state, delta) => {
    const tx = mouseRef.current.x;
    const ty = mouseRef.current.y;
    const time = state.clock.elapsedTime;

    // ===== 時段過渡動畫 =====
    if (isTransitioning) {
      if (transRef.current === 0) transRef.current = time;
      const elapsed = time - transRef.current;
      const duration = 2; // 2 秒過渡
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress * progress * (3 - 2 * progress);
      fadeRef.current = 1 - eased;
      setFadeOpacity(fadeRef.current);

      if (progress >= 1 && !switchedRef.current) {
        switchedRef.current = true;
        transRef.current = 0;
        const target = nextIdx;
        setCurrentIdx(target);

        // 計算下一個時段
        let nxt: number;
        if (isTestMode) {
          nxt = (target + 1) % 3;
        } else {
          const h = new Date().getHours();
          if (h >= 5 && h < 16) nxt = 1;
          else if (h >= 16 && h < 18) nxt = 2;
          else nxt = 0;
        }
        setNextIdx(nxt);

        requestAnimationFrame(() => {
          fadeRef.current = 1;
          setFadeOpacity(1);
          // 重置所有「當前」圖層為不透明、「下一」圖層為透明
          [bgMatRef, llMatRef, rlMatRef, altarMatRef].forEach(r => { if (r.current) r.current.opacity = 1; });
          [nxtBgMatRef, nxtLlMatRef, nxtRlMatRef, nxtAltarMatRef].forEach(r => { if (r.current) r.current.opacity = 0; });
          setIsTransitioning(false);
          switchedRef.current = false;
        });
      }
    } else {
      transRef.current = 0;
      if (fadeRef.current !== 1) { fadeRef.current = 1; setFadeOpacity(1); }
    }

    // ===== 同步透明度 =====
    const curOp = fadeRef.current;
    const nxtOp = 1 - curOp;

    // 光牆閃爍效果：模擬燭光
    const flicker = 0.94 + Math.sin(time * 3.1) * 0.03 + Math.sin(time * 7.7) * 0.02 + Math.sin(time * 13.3) * 0.01;

    if (skyMatRef.current)      skyMatRef.current.opacity = curOp;
    if (nxtSkyMatRef.current)   nxtSkyMatRef.current.opacity = nxtOp;
    // 將殿內透明度恢復為正常
    if (bgMatRef.current)       bgMatRef.current.opacity = curOp;
    if (nxtBgMatRef.current)    nxtBgMatRef.current.opacity = nxtOp;
    if (llMatRef.current)       llMatRef.current.opacity = curOp * flicker;
    if (nxtLlMatRef.current)    nxtLlMatRef.current.opacity = nxtOp * flicker;
    if (rlMatRef.current)       rlMatRef.current.opacity = curOp * flicker;
    if (nxtRlMatRef.current)    nxtRlMatRef.current.opacity = nxtOp * flicker;
    if (altarMatRef.current)    altarMatRef.current.opacity = curOp;
    if (nxtAltarMatRef.current) nxtAltarMatRef.current.opacity = nxtOp;

    // ===== 視差移動（室內場景：幅度較小）=====
    const lerp = THREE.MathUtils.lerp;
    const mMul = isMobile ? 0.4 : 1.0; // 手機版視差稍微減弱

    // 1. 背景層：固定不動
    // （不做視差移動，背景保持原位）

    // 2. 左右光牆：中景（左牆基礎 x=3.5, y=-1，右牆基礎 x=-3, y=-1）
    //    視差幅度再縮小到非常細微；第二層/第三層/第四層時凍結位置，避免籤筒 closeup 被滑鼠帶動造成視覺卡頓
    if (llMeshRef.current) {
      const baseX = 3.5;
      const baseY = -1;
      const enableParallax = drawingPhase === "idle" && jiaoPhase === "idle";
      const targetX = enableParallax ? baseX + tx * 0.4 * mMul : baseX;
      const targetY = enableParallax ? baseY + ty * 0.15 * mMul : baseY;
      llMeshRef.current.position.x = lerp(llMeshRef.current.position.x, targetX, 0.06);
      llMeshRef.current.position.y = lerp(llMeshRef.current.position.y, targetY, 0.06);
    }
    if (nxtLlMeshRef.current && llMeshRef.current) {
      nxtLlMeshRef.current.position.x = llMeshRef.current.position.x;
      nxtLlMeshRef.current.position.y = llMeshRef.current.position.y;
    }
    if (rlMeshRef.current) {
      const baseX = -3;
      const baseY = -1;
      const enableParallax = drawingPhase === "idle" && jiaoPhase === "idle";
      const targetX = enableParallax ? baseX + tx * 0.4 * mMul : baseX;
      const targetY = enableParallax ? baseY + ty * 0.15 * mMul : baseY;
      rlMeshRef.current.position.x = lerp(rlMeshRef.current.position.x, targetX, 0.06);
      rlMeshRef.current.position.y = lerp(rlMeshRef.current.position.y, targetY, 0.06);
    }
    if (nxtRlMeshRef.current && rlMeshRef.current) {
      nxtRlMeshRef.current.position.x = rlMeshRef.current.position.x;
      nxtRlMeshRef.current.position.y = rlMeshRef.current.position.y;
    }

    // 3. 香案香爐：前景（基礎位置 x=0, y=-22）
    //    擲筊流程進行中時，固定在基礎位置，不再跟隨視差
    if (altarMeshRef.current) {
      const baseX = 0;
      const baseY = -22;
      const targetX = jiaoPhase === "idle" ? baseX + tx * 2.0 * mMul : baseX;
      const targetY = jiaoPhase === "idle" ? baseY + ty * 0.8 * mMul : baseY;
      altarMeshRef.current.position.x = lerp(
        altarMeshRef.current.position.x,
        targetX,
        0.08
      );
      altarMeshRef.current.position.y = lerp(
        altarMeshRef.current.position.y,
        targetY,
        0.08
      );
    }
    if (nxtAltarMeshRef.current && altarMeshRef.current) {
      nxtAltarMeshRef.current.position.x = altarMeshRef.current.position.x;
      nxtAltarMeshRef.current.position.y = altarMeshRef.current.position.y;
    }

    // 4. 書櫃（基礎位置 x=17, y=-22）
    //    擲筊流程進行中時，固定在基礎位置，不再跟隨視差
    if (cabinetMeshRef.current) {
      const baseX = 17;
      const baseY = -22;
      const targetX =
        jiaoPhase === "idle" ? baseX + tx * 2.5 * mMul : baseX;
      const targetY =
        jiaoPhase === "idle" ? baseY + ty * 1.0 * mMul : baseY;
      cabinetMeshRef.current.position.x = lerp(
        cabinetMeshRef.current.position.x,
        targetX,
        0.09
      );
      cabinetMeshRef.current.position.y = lerp(
        cabinetMeshRef.current.position.y,
        targetY,
        0.09
      );
    }
    // 5. 跪墊（基礎位置 x=16, y=-34）
    //    擲筊流程進行中時，固定在基礎位置，不再跟隨視差
    if (cushionMeshRef.current) {
      const baseX = 16;
      const baseY = -34;
      const targetX =
        jiaoPhase === "idle" ? baseX + tx * 2.2 * mMul : baseX;
      const targetY =
        jiaoPhase === "idle" ? baseY + ty * 0.9 * mMul : baseY;
      cushionMeshRef.current.position.x = lerp(
        cushionMeshRef.current.position.x,
        targetX,
        0.09
      );
      cushionMeshRef.current.position.y = lerp(
        cushionMeshRef.current.position.y,
        targetY,
        0.09
      );
    }

    // 6. 籤筒 3D 求籤組：可由外層調整基礎 x（例如第四階段放在神像卡右側）
    //    closeup 時不更新（由 6.5 控制）；picked 時一律不在此用視差 lerp（改由 useFrame 末端 PICKED_TARGET 專管），
    //    否則抽出完成後 stickStillDrawing 變 false，會與末端覆寫競爭並導致籤筒旁 Html 投影異常。
    const stickStillDrawing = drawingPhase === "picked" && drawnStickProgressRef.current < 1;
    if (
      fortuneGroupRef.current &&
      drawingPhase !== "closeup" &&
      drawingPhase !== "picked" &&
      !stickStillDrawing
    ) {
      const baseX = fortuneIdleBaseX;
      const baseY = fortuneIdleBaseY;
      // 擲筊流程中：籤筒大幅縮小＋往右推＋再往下壓，讓筊杯幾乎佔據籤筒原本的位置
      const inJiao = jiaoPhase !== "idle" && drawingPhase === "idle";
      // 手機擲筊隱藏籤桶時，tube 本身不位移 / 不縮小，讓熱點相對座標保持穩定
      const skipJiaoShift = mobileJiaoHidden;
      const targetX = jiaoPhase === "idle"
        ? baseX + tx * 2.2 * mMul
        : (inJiao && !skipJiaoShift) ? baseX + (narrowBottomHotspotLayout ? 8 : 24) : baseX;
      const targetY = jiaoPhase === "idle"
        ? baseY + ty * 0.9 * mMul
        : (inJiao && !skipJiaoShift) ? baseY - (narrowBottomHotspotLayout ? 6 : 12) : baseY;
      fortuneGroupRef.current.position.x = lerp(
        fortuneGroupRef.current.position.x,
        targetX,
        0.09
      );
      fortuneGroupRef.current.position.y = lerp(
        fortuneGroupRef.current.position.y,
        targetY,
        0.09
      );
      if (drawingPhase === "idle") {
        fortuneGroupRef.current.position.z = lerp(fortuneGroupRef.current.position.z, 8, 0.09);
        const targetScale = (inJiao && !skipJiaoShift) ? fortuneIdleScale * 0.24 : fortuneIdleScale;
        fortuneGroupRef.current.scale.setScalar(
          lerp(fortuneGroupRef.current.scale.x, targetScale, 0.09)
        );
      }
    }
    // 籤抽出時籤筒退場：統一移到第一個 useFrame 最末端處理，避免被中間邏輯蓋掉

    // 6. 擲筊筊杯預覽
    if (jiaoPreviewRef.current) {
      // 第二輪（確認詩籤後）筊杯往左偏，避免壓住右側「第N首」標籤
      const isSecondRoundAiming = confirmStickId !== null && secondJiaoStarted;
      const isFourthSecondRound =
        drawingPhase === "picked" && isSecondRoundAiming;
      // 手機擲筊隱藏籤桶：筊杯置中並下移 10（x=0, y=-10）；第四層第二輪則與「確認詩籤」同高
      const baseX = isSecondRoundAiming ? -2 : (mobileJiaoHidden ? 0 : JIAO_BASE_X);
      const baseY = isFourthSecondRound
        ? JIAO_FOURTH_LAYER_GROUP_Y
        : mobileJiaoHidden
          ? -10
          : JIAO_BASE_Y;

      if (jiaoPhase === "aiming") {
        // 手機：用原始指標 NDC（不經過 scrollPos 累加）使筊杯正確追蹤手指位置
        // 桌機：維持原本的 mouseRef 行為（滑鼠移動即時追蹤）
        const aimX = (isMobile && rawPointerRef != null) ? rawPointerRef.current.x : tx;
        const aimY = (isMobile && rawPointerRef != null) ? rawPointerRef.current.y : ty;

        // 筊杯位置：進入 aiming 就跟隨，不強制要求 pointerDown
        // （點擊 Html 熱點進入 aiming 後，不需要再次按下 canvas 才能追蹤）
        const targetX = baseX + aimX * 12 * mMul;
        const targetY = baseY + aimY * 10 * mMul;
        jiaoPreviewRef.current.position.x = lerp(
          jiaoPreviewRef.current.position.x,
          targetX,
          0.25
        );
        jiaoPreviewRef.current.position.y = lerp(
          jiaoPreviewRef.current.position.y,
          targetY,
          0.25
        );

        // 瞄準時內層旋轉歸 0
        if (jiaoInnerRef.current) {
          jiaoInnerRef.current.rotation.x = lerp(jiaoInnerRef.current.rotation.x, 0, 0.2);
        }

        // 擲出判定：桌機維持隨時可搖；手機須按住場景 canvas 拖移才累積（避免點 Html「求籤」後誤觸）
        const isDown = pointerDownRef?.current === true;
        const wasDown = jiaoPrevPointerDownRef.current;
        jiaoPrevPointerDownRef.current = isDown;

        const threshold = 0.42;
        const instantFlickDy = 0.32;

        if (isMobile && rawPointerRef) {
          if (!isDown) {
            jiaoLastTyRef.current = aimY;
            jiaoShakeRef.current = 0;
          } else if (!wasDown) {
            jiaoLastTyRef.current = aimY;
            jiaoShakeRef.current = 0;
          } else {
            const dy = aimY - jiaoLastTyRef.current;
            jiaoLastTyRef.current = aimY;
            jiaoShakeRef.current = jiaoShakeRef.current * 0.86 + Math.abs(dy);
            if (jiaoShakeRef.current > threshold || Math.abs(dy) > instantFlickDy) {
              jiaoShakeRef.current = 0;
              jiaoVyRef.current = 22;
              setJiaoPhase("flying");
            }
          }
        } else {
          const dy = aimY - jiaoLastTyRef.current;
          jiaoLastTyRef.current = aimY;
          jiaoShakeRef.current = jiaoShakeRef.current * 0.86 + Math.abs(dy);
          if (jiaoShakeRef.current > threshold || Math.abs(dy) > instantFlickDy) {
            jiaoShakeRef.current = 0;
            jiaoVyRef.current = 22;
            setJiaoPhase("flying");
          }
        }
      } else if (jiaoPhase === "result") {
        // 筊杯落地顯示結果後，緩緩浮到畫面中央，方便使用者看結果／點中央的按鈕。
        const isSecondRound = confirmStickId !== null && secondJiaoStarted;
        if (!isSecondRound) {
          // 第一輪：浮到神像卡與籤筒的等距中央（x ≈ 9 or 22）；手機擲筊隱藏籤桶時置中
          const jiaoResultX = drawingPhase === "picked" ? 22 : (mobileJiaoHidden ? 0 : 9);
          // 手機擲筊隱藏籤桶時，結果也保持下移後的位置；桌機維持 y=0
          const jiaoResultY = mobileJiaoHidden ? -10 : 0;
          jiaoPreviewRef.current.position.x = lerp(
            jiaoPreviewRef.current.position.x,
            jiaoResultX,
            0.08
          );
          jiaoPreviewRef.current.position.y = lerp(
            jiaoPreviewRef.current.position.y,
            jiaoResultY,
            0.08
          );
          jiaoPreviewRef.current.position.z = lerp(
            jiaoPreviewRef.current.position.z,
            6,
            0.08
          );
        } else {
          // 第二輪（確認詩籤後）：第四層時維持與「確認詩籤」筊杯相同高度；窄視窗筊杯／提示水平置中
          const fourthPicked = drawingPhase === "picked";
          const targetX = isNarrowViewport ? 0 : fourthPicked ? -2 : -1;
          const targetY = fourthPicked ? JIAO_FOURTH_LAYER_GROUP_Y : 0;
          jiaoPreviewRef.current.position.x = lerp(
            jiaoPreviewRef.current.position.x,
            targetX,
            0.08
          );
          jiaoPreviewRef.current.position.y = lerp(
            jiaoPreviewRef.current.position.y,
            targetY,
            0.08
          );
          jiaoPreviewRef.current.position.z = lerp(
            jiaoPreviewRef.current.position.z,
            6,
            0.08
          );
        }
        // 不論第幾輪，結果展示時內層 group 一律繞 X 軸轉 +90°，讓筊杯弧面朝向鏡頭
        if (jiaoInnerRef.current) {
          jiaoInnerRef.current.rotation.x = lerp(
            jiaoInnerRef.current.rotation.x,
            +Math.PI / 2,
            0.06
          );
        }
      } else if (jiaoPhase === "flying") {
        // 簡單的拋物線下落：往上帶一點弧度再落到地面
        const gravity = 40; // 重力加速度
        jiaoVyRef.current -= gravity * delta;
        jiaoPreviewRef.current.position.y += jiaoVyRef.current * delta;

        // 筊杯微微往前拋
        jiaoPreviewRef.current.position.z = THREE.MathUtils.lerp(
          jiaoPreviewRef.current.position.z,
          6,
          0.15
        );

        // 地面高度（視覺上接近地板，再往下微調一點，避免太靠近香爐）
        const groundY = -32;
        if (jiaoPreviewRef.current.position.y <= groundY) {
          jiaoPreviewRef.current.position.y = groundY;
          jiaoVyRef.current = 0;

          // 落地時決定結果（完全隨機，三個結果機率約各 1/3）
          const r = Math.random();
          let result: JiaoResult;
          if (r < 1 / 3) result = "聖杯";
          else if (r < 2 / 3) result = "笑杯";
          else result = "陰杯";
          setJiaoResult(result);
          setJiaoPhase("result");

          const isSecondRound = confirmStickId !== null && secondJiaoStarted;

          // 第一輪求籤：尚未有候選籤時，聖杯代表可進入抽籤流程
          if (result === "聖杯" && confirmStickId === null && flowMode === "fortune") {
            setShengBeiInFortuneFlow((prev) => prev || true); // 求籤流程中得聖杯即可點籤筒（不侷限次數）
            setIsWaitingQuestionType(true); // 等待使用者在筊杯中間點擊「抽籤」
          }

          // 第二輪擲筊（第四層）：若已有候選籤，依結果決定是否確認或退回
          if (isSecondRound) {
            if (result === "聖杯") {
              // 第二輪擲筊聖杯：先讓使用者看到結果約 1.5 秒，再進入第五層
              if (secondJiaoSuccessTimerRef.current !== null) {
                window.clearTimeout(secondJiaoSuccessTimerRef.current);
              }
                secondJiaoSuccessTimerRef.current = window.setTimeout(() => {
                secondJiaoSuccessTimerRef.current = null;
                // 聖杯成功：清空拒絕清單（本輪已確認）
                rejectedStickIdsRef.current.clear();
                // 1. 先隱藏中央筊杯組
                setSecondJiaoStarted(false);
                setJiaoPhase("idle");
                setJiaoResult(null);
                // 2. 同時啟動：詩籤倒放插回籤筒 ＋ 籤筒由左側放大並移到中央（並行播放，籤才會真的插進筒裡）
                rewindForFifthLayerRef.current = true;
                setIsRewindingStick(true);
                setIsFifthLayer(true);
                if (fortuneGroupRef.current) {
                  const fg = fortuneGroupRef.current;
                  fifthLayerAnimRef.current = {
                    active: true,
                    startX: fg.position.x,
                    startY: fg.position.y,
                    startZ: fg.position.z,
                    startScale: fg.scale.x,
                    progress: 0,
                  };
                }
              }, 1500);
            } else {
              // 笑杯 / 陰杯：暫記此籤號，再抽時排除，直到聖杯為止
              if (confirmStickId !== null) {
                rejectedStickIdsRef.current.add(confirmStickId);
              }
              setSecondJiaoMessageVisible(true);
              if (secondJiaoFailTimerRef.current !== null) {
                window.clearTimeout(secondJiaoFailTimerRef.current);
              }
              if (secondJiaoSuccessTimerRef.current !== null) {
                window.clearTimeout(secondJiaoSuccessTimerRef.current);
                secondJiaoSuccessTimerRef.current = null;
              }
              secondJiaoFailTimerRef.current = window.setTimeout(() => {
                secondJiaoFailTimerRef.current = null;
                setSecondJiaoMessageVisible(false);
                // 籤筒位置由 useFrame isRewindingStick 分支平滑 lerp 回 closeup，不再即時 teleport
                setIsFifthLayer(false);
                setIsRewindingStick(true);
                setJiaoPhase("idle");
                setJiaoResult(null);
                setSecondJiaoStarted(false);
                // 收掉中央筊杯與右側「第 N 首」overlay
                onPickedStickChange?.(null);
              }, 1500);
            }
          }
        }
      }
    }

    // 6.5 求籤：聖杯時籤筒微搖 + 拉近動畫（第四層確認詩籤時不再搖晃）
    const tubeClickable =
      flowMode === "fortune" &&
      shengBeiInFortuneFlow &&
      drawingPhase === "idle" &&
      confirmStickId === null;
    if (fortuneGroupRef.current) {
      if (tubeClickable) {
        // 微搖：小幅度週期擺動
        const shake = Math.sin(time * 4) * 0.012;
        fortuneGroupRef.current.rotation.z = shake;
      } else if (drawingPhase === "idle") {
        fortuneGroupRef.current.rotation.z = THREE.MathUtils.lerp(fortuneGroupRef.current.rotation.z, 0, 0.08);
      }

      if (drawingPhase === "closeup") {
        const start = closeupStartRef.current;
        const fifthAnim = fifthLayerAnimRef.current;
        if (isSixthLayer && !sixthLayerAnimRef.current?.active) {
          // 第六層動畫結束後：固定維持籤筒位置與大小（左側）
          fortuneGroupRef.current.position.set(-25, -38, 28);
          fortuneGroupRef.current.scale.setScalar(1.4);
          fortuneGroupRef.current.rotation.set(0, 0, 0);
        } else if (isFifthLayer && !fifthAnim?.active) {
          // 第五層且進場動畫已結束：桌機右側；窄視窗與 stage4 同軸置中
          fortuneGroupRef.current.position.set(
            fifthLayerTubeRest.x,
            fifthLayerTubeRest.y,
            fifthLayerTubeRest.z
          );
          fortuneGroupRef.current.scale.setScalar(FIFTH_LAYER_TUBE_SCALE);
        } else if (start && !isFifthLayer && !isSixthLayer) {
          // 用經過時間驅動，避免 delta 不穩造成卡頓
          if (closeupStartTimeRef.current === null) closeupStartTimeRef.current = state.clock.elapsedTime;
          const elapsed = state.clock.elapsedTime - closeupStartTimeRef.current;
          const CLOSEUP_DURATION = 0.65;
          const t = Math.min(elapsed / CLOSEUP_DURATION, 1);
          closeupProgressRef.current = t;
          const eased = t * t * (3 - 2 * t);
          // 抽籤 closeup：停在 stage 4 idle 的右側位置，並稍微放大，讓視覺和閒置時一致
          // 手機版 fortuneIdleBaseX=0，不再額外 -2，確保籤桶完全置中
          const targetX = fortuneIdleBaseX + (isMobile ? 0 : -2);
          const targetY = fortuneIdleBaseY -2;
          const targetZ = 20;
          const targetScale = fortuneIdleScale +0;
          fortuneGroupRef.current.position.x = start.x + (targetX - start.x) * eased;
          fortuneGroupRef.current.position.y = start.y + (targetY - start.y) * eased;
          fortuneGroupRef.current.position.z = start.z + (targetZ - start.z) * eased;
          const s = start.scale + (targetScale - start.scale) * eased;
          fortuneGroupRef.current.scale.setScalar(s);
        }
        if (!isSixthLayer) {
          fortuneGroupRef.current.rotation.y = tubeRotationYRef.current;
          if (hintCounterRotateRef.current) hintCounterRotateRef.current.rotation.y = -tubeRotationYRef.current;
        }
        if (sticksGroupRef.current) {
          const over = isOverSticksRef.current;
          const allowSliding = !isFifthLayer;
          const sliding =
            allowSliding && over && (state.clock.elapsedTime - lastSticksMoveTimeRef.current) < 0.22;
          if (sliding) {
            sticksGroupRef.current.rotation.y = mouseRef.current.x * (Math.PI * 1.02);
            const t = state.clock.elapsedTime;
            sticksGroupRef.current.children.forEach((stick, i) => {
              if (!stick.userData.restPosition) {
                stick.userData.restPosition = {
                  x: stick.position.x,
                  y: stick.position.y,
                  z: stick.position.z,
                };
              }
              const r = stick.userData.restPosition;
              const phase = i * 0.42;
              const wy = Math.sin(t * 2.2 + phase) * 0.02 + Math.sin(t * 1.3 + phase * 1.7) * 0.01;
              const wx = Math.sin(t * 1.8 + phase * 0.9) * 0.005;
              const wz = Math.sin(t * 1.5 + phase * 1.1) * 0.005;
              stick.position.set(r.x + wx, r.y + wy, r.z + wz);
            });
          } else {
            sticksGroupRef.current.rotation.y = THREE.MathUtils.lerp(sticksGroupRef.current.rotation.y, 0, 0.08);
            sticksGroupRef.current.children.forEach((stick) => {
              if (stick.userData.restPosition) {
                const r = stick.userData.restPosition;
                stick.position.x = THREE.MathUtils.lerp(stick.position.x, r.x, 0.1);
                stick.position.y = THREE.MathUtils.lerp(stick.position.y, r.y, 0.1);
                stick.position.z = THREE.MathUtils.lerp(stick.position.z, r.z, 0.1);
              }
            });
          }
        }
      } else if (drawingPhase === "idle") {
        if (fortuneGroupRef.current.scale.x !== fortuneIdleScale) {
          fortuneGroupRef.current.scale.setScalar(fortuneIdleScale);
        }
        tubeRotationYRef.current = THREE.MathUtils.lerp(tubeRotationYRef.current, 0, 0.08);
        if (sticksGroupRef.current) {
          sticksGroupRef.current.rotation.y = THREE.MathUtils.lerp(sticksGroupRef.current.rotation.y, 0, 0.08);
          sticksGroupRef.current.children.forEach((stick) => {
            if (stick.userData.restPosition) {
              const r = stick.userData.restPosition;
              stick.position.x = THREE.MathUtils.lerp(stick.position.x, r.x, 0.1);
              stick.position.y = THREE.MathUtils.lerp(stick.position.y, r.y, 0.1);
              stick.position.z = THREE.MathUtils.lerp(stick.position.z, r.z, 0.1);
            }
          });
        }
      }

      // 第五層進場：從第四層的位置/縮放，平滑移動到第二層結構位置，籤筒再放大 0.5 倍
      if (isFifthLayer && fifthLayerAnimRef.current?.active && fortuneGroupRef.current) {
        const anim = fifthLayerAnimRef.current;
        const duration = 0.9; // 秒
        anim.progress = Math.min(anim.progress + delta / duration, 1);
        const t = anim.progress;
        const eased = t * t * (3 - 2 * t);
        const targetX = fifthLayerTubeRest.x;
        const targetY = fifthLayerTubeRest.y;
        const targetZ = fifthLayerTubeRest.z;
        const targetScale = FIFTH_LAYER_TUBE_SCALE; // 與第五層 idle setScalar 一致
        const fg = fortuneGroupRef.current;
        fg.position.x = anim.startX + (targetX - anim.startX) * eased;
        fg.position.y = anim.startY + (targetY - anim.startY) * eased;
        fg.position.z = anim.startZ + (targetZ - anim.startZ) * eased;
        const s = anim.startScale + (targetScale - anim.startScale) * eased;
        fg.scale.setScalar(s);
        if (anim.progress >= 1) {
          fifthLayerAnimRef.current = { ...anim, active: false };
        }
      }

      // 第五層：用 GLB 實際角度判斷「目前正對鏡頭的抽屜」，不再用 offset 魔術數字（第六層時不再執行）
      if (isFifthLayer && !isSixthLayer && confirmPoemId != null && poemType) {
        const r = tubeRotationYRef.current;
        const twoPi = 2 * Math.PI;
        let atTarget = false;
        let currentPoemId = 1;

        if (poemType === "rensheng" && drawerAnglesRef.current && drawerAnglesRef.current.length >= 49) {
          const angles = drawerAnglesRef.current;
          // 算出「鏡頭方向」在世界座標中的角度
          const cylWorld = fortuneGroupRef.current
            ? new THREE.Vector3().setFromMatrixPosition(fortuneGroupRef.current.matrixWorld)
            : new THREE.Vector3();
          const camAngle = Math.atan2(
            camera.position.x - cylWorld.x,
            camera.position.z - cylWorld.z,
          );
          // 找出最接近「正對鏡頭」的抽屜（只看前 49 格）
          let bestIdx = 0;
          let bestDist = Infinity;
          for (let i = 0; i < 49; i++) {
            let d = ((angles[i] + r - camAngle) % twoPi + twoPi + Math.PI) % twoPi - Math.PI;
            if (Math.abs(d) < bestDist) {
              bestDist = Math.abs(d);
              bestIdx = i;
            }
          }
          currentPoemId = bestIdx + 1;
          atTarget = currentPoemId === confirmPoemId;

          // 輕微吸附：未拖曳且接近目標抽屜時，緩慢轉到精確角度
          if (!tubeDragRef.current.active) {
            const targetIdx = confirmPoemId - 1;
            const targetR = camAngle - angles[targetIdx];
            let diff = ((targetR - r) % twoPi + twoPi + Math.PI) % twoPi - Math.PI;
            const SNAP_THRESHOLD = 0.25;
            const SNAP_STRENGTH = 0.06;
            if (Math.abs(diff) < SNAP_THRESHOLD && Math.abs(diff) > 0.002) {
              tubeRotationYRef.current += diff * SNAP_STRENGTH;
            }
          }
        } else if (poemType === "xiudao" && drawerAnglesRef.current && drawerAnglesRef.current.length >= 50) {
          const angles = drawerAnglesRef.current;
          // 算出鏡頭方向角度
          const cylWorld = fortuneGroupRef.current
            ? new THREE.Vector3().setFromMatrixPosition(fortuneGroupRef.current.matrixWorld)
            : new THREE.Vector3();
          const camAngle = Math.atan2(
            camera.position.x - cylWorld.x,
            camera.position.z - cylWorld.z,
          );
          // 用目前的旋轉角度，在 360° 中切 60 等分，算出目前對應的虛擬詩籤編號
          const facingLocalAngle = ((camAngle - r) % twoPi + twoPi) % twoPi;
          const virtualIdx = Math.round((facingLocalAngle / twoPi) * 60) % 60;
          currentPoemId = virtualIdx + 1; // 1–60

          // 判斷是否對準目標：目標詩籤的虛擬角度
          const targetVirtualAngle = ((confirmPoemId - 1) / 60) * twoPi;
          let diffToTarget = ((facingLocalAngle - targetVirtualAngle) % twoPi + twoPi + Math.PI) % twoPi - Math.PI;
          atTarget = Math.abs(diffToTarget) < (twoPi / 60 / 2); // 半格以內算對準

          // 輕微吸附：未拖曳且接近目標時，緩慢轉到精確角度
          if (!tubeDragRef.current.active) {
            const targetR = camAngle - targetVirtualAngle;
            let diff = ((targetR - r) % twoPi + twoPi + Math.PI) % twoPi - Math.PI;
            const SNAP_THRESHOLD = 0.25;
            const SNAP_STRENGTH = 0.06;
            if (Math.abs(diff) < SNAP_THRESHOLD && Math.abs(diff) > 0.002) {
              tubeRotationYRef.current += diff * SNAP_STRENGTH;
            }
          }
        }

        if (currentPoemId !== currentDisplayPoemIdRef.current) {
          currentDisplayPoemIdRef.current = currentPoemId;
          setCurrentDisplayPoemId(currentPoemId);
        }
        if (atTarget !== atTargetDrawerRef.current) {
          atTargetDrawerRef.current = atTarget;
          setAtTargetDrawer(atTarget);
        }
      } else if (!isFifthLayer && atTargetDrawerRef.current) {
        atTargetDrawerRef.current = false;
        setAtTargetDrawer(false);
      }
    }

    // 第六層動畫：卡片沿二次貝茲曲線飛出 ＋ 籤筒往左下縮小（3 秒）
    // 卡片軌跡不可與 fortuneGroupRef 綁在同一條件：籤筒 group 尚未掛載時，卡片會永遠停在 (0,0,0) 而看不見（與 main 分離後較易發生）。
    if (isSixthLayer && sixthLayerAnimRef.current?.active) {
      const anim = sixthLayerAnimRef.current;
      const DURATION = 3; // 秒
      anim.progress = Math.min(anim.progress + delta / DURATION, 1);
      const t = anim.progress;
      // smoothstep ease
      const eased = t * t * (3 - 2 * t);

      // 籤筒移動到左下角（有 ref 時才更新）
      if (fortuneGroupRef.current) {
        const fg = fortuneGroupRef.current;
        fg.position.x = anim.tubeStartX + (anim.tubeEndX - anim.tubeStartX) * eased;
        fg.position.y = anim.tubeStartY + (anim.tubeEndY - anim.tubeStartY) * eased;
        fg.position.z = anim.tubeStartZ + (anim.tubeEndZ - anim.tubeStartZ) * eased;
        const s = anim.tubeStartScale + (anim.tubeEndScale - anim.tubeStartScale) * eased;
        fg.scale.setScalar(s);
      }

      // 卡片沿二次貝茲曲線飛行：B(t) = (1-t)²·P0 + 2(1-t)t·P1 + t²·P2
      if (poemCardGroupRef.current) {
        const u = eased;
        const u1 = 1 - u;
        const bx = u1 * u1 * anim.cardP0.x + 2 * u1 * u * anim.cardP1.x + u * u * anim.cardP2.x;
        const by = u1 * u1 * anim.cardP0.y + 2 * u1 * u * anim.cardP1.y + u * u * anim.cardP2.y;
        const bz = u1 * u1 * anim.cardP0.z + 2 * u1 * u * anim.cardP1.z + u * u * anim.cardP2.z;
        poemCardGroupRef.current.position.set(bx, by, bz);
        const cs = anim.cardStartScale + (anim.cardEndScale - anim.cardStartScale) * eased;
        poemCardGroupRef.current.scale.setScalar(cs);
        poemCardGroupRef.current.visible = true;
      }

      if (anim.progress >= 1) {
        anim.active = false;
        sixthLayerCardScaleRef.current = anim.cardEndScale;
        if (poemCardGroupRef.current) {
          poemCardGroupRef.current.position.copy(anim.cardP2);
        }
        // 第六層結束後，回到「左側小籤筒＋中央詩籤」狀態（不再是第五層 closeup）
        if (isFifthLayer) {
          setIsFifthLayer(false);
        }
      }
    }

    // 第六層動畫結束後：維持詩籤位置與 scale（含使用者放大縮小）並確保可見
    if (isSixthLayer && !sixthLayerAnimRef.current?.active && poemCardGroupRef.current) {
      poemCardGroupRef.current.visible = true;
      poemCardGroupRef.current.scale.setScalar(sixthLayerCardScaleRef.current);
      // 防呆：與觸發 sixth 層時的 cardP2 一致（動畫若未寫入過位置，不會卡在場景原點）
      const restZ = isMobile ? 30 : 34;
      if (poemCardGroupRef.current.position.z < restZ - 0.5) {
        poemCardGroupRef.current.position.set(sixthLayerCardRestX, isMobile ? 4 : 2, restZ);
      }
    }


    // 6.6 抽出的籤：兩階段——先慢慢從籤筒抽出（與筒同 scale），再移到展示點並放大；
    // 第二輪擲筊失敗時，會啟動「倒放」動畫，沿原路徑把籤放回籤筒。
    if (drawingPhase === "picked" && pickedStickId !== null && drawnStickGroupRef.current) {
      const start = drawnStickStartRef.current;
      const pullOutEnd = drawnStickPullOutEndRef.current;
      const end = drawnStickAnimEndScratchRef.current;
      if (isNarrowViewport) {
        end.set(
          DRAWN_STICK_REF_POSITION_MOBILE.x,
          DRAWN_STICK_REF_POSITION_MOBILE.y,
          DRAWN_STICK_REF_POSITION_MOBILE.z
        );
      } else {
        end.copy(drawnStickEndRef.current);
      }
      const g = drawnStickGroupRef.current;
      if (isRewindingStick && drawnStickSettledAtRef.current !== null) {
        drawnStickSettledAtRef.current = null;
        if (drawnStickModelRef.current) {
          drawnStickModelRef.current.visible = true;
          restoreDrawnStickMeshOpaque(drawnStickModelRef.current);
        }
        if (poemHtmlOpacityRef.current !== 0) {
          poemHtmlOpacityRef.current = 0;
        }
      }
      if (drawnStickProgressRef.current === 0 && !isRewindingStick) {
        g.position.copy(start);
        g.scale.setScalar(TUBE_SCALE); // 抽出時與籤筒同大小，才不會浮一隻巨籤
      }
      if (isRewindingStick) {
        drawnStickProgressRef.current = Math.max(
          drawnStickProgressRef.current - delta * DRAWN_STICK_SPEED,
          0
        );
      } else {
        drawnStickProgressRef.current = Math.min(
          drawnStickProgressRef.current + delta * DRAWN_STICK_SPEED,
          1
        );
      }
      const t = drawnStickProgressRef.current;
      const ease = (x: number) => x * x * (3 - 2 * x);
      if (t >= 1) {
        const scaleFourth = isNarrowViewport ? DISPLAY_SCALE_FOURTH_MOBILE : DISPLAY_SCALE_FOURTH;
        const scaleMain = isNarrowViewport ? DISPLAY_SCALE_MOBILE : DISPLAY_SCALE;
        if (confirmStickId !== null) {
          if (isNarrowViewport) {
            g.position.set(
              DRAWN_STICK_REF_POSITION_FOURTH_MOBILE.x,
              DRAWN_STICK_REF_POSITION_FOURTH_MOBILE.y,
              DRAWN_STICK_REF_POSITION_FOURTH_MOBILE.z
            );
          } else {
            g.position.set(
              DRAWN_STICK_REF_POSITION_FOURTH.x,
              DRAWN_STICK_REF_POSITION_FOURTH.y,
              DRAWN_STICK_REF_POSITION_FOURTH.z
            );
          }
          g.scale.setScalar(scaleFourth);
        } else {
          g.position.copy(end);
          g.scale.setScalar(scaleMain);
        }
        if (!labelNotifiedRef.current) {
          // 1) 通知主組件顯示右側「第 N 首」（窄視窗第四層改 Canvas 外橫排）
          onPickedStickChange?.(pickedStickId);
          labelNotifiedRef.current = true;
          // 2) 啟動第三層 → 第四層的自動收場流程（停留約 0.3 秒）
          if (postDisplayTimerRef.current === null && pickedStickId !== null) {
            const pickedIdAtEnd = pickedStickId;
            postDisplayTimerRef.current = window.setTimeout(() => {
              postDisplayTimerRef.current = null;
              // 第四層候選籤：記住本次抽出的第 N 首（維持 drawingPhase=\"picked\" 結構不變）
              setConfirmStickId(pickedIdAtEnd);
              // 確認詩籤編號：問人事 1–49 = 籤號；問修道 1–60 = 49 支籤線性對應到 60 首
              setConfirmPoemId(
                poemType === "xiudao"
                  ? Math.min(60, Math.round((pickedIdAtEnd - 1) * (60 / 49)) + 1)
                  : pickedIdAtEnd
              );
              // 還原籤筒裡原本那支籤（避免一直隱藏）
              if (pickedStickMeshRef.current) {
                (pickedStickMeshRef.current as THREE.Mesh).visible = true;
                pickedStickMeshRef.current = null;
              }
            }, 300);
          }
        }
      } else if (t <= DRAWN_STICK_PHASE1_RATIO) {
        const localT = ease(t / DRAWN_STICK_PHASE1_RATIO);
        g.position.lerpVectors(start, pullOutEnd, localT);
        g.scale.setScalar(TUBE_SCALE); // 抽出階段維持與筒同大
      } else {
        const localT = ease((t - DRAWN_STICK_PHASE1_RATIO) / (1 - DRAWN_STICK_PHASE1_RATIO));
        g.position.lerpVectors(pullOutEnd, end, localT);
        const scaleTarget = isNarrowViewport ? DISPLAY_SCALE_MOBILE : DISPLAY_SCALE;
        const s = THREE.MathUtils.lerp(TUBE_SCALE, scaleTarget, localT);
        g.scale.setScalar(s); // 移到展示點時漸漸放大
      }

      if (t >= 1 && !isRewindingStick) {
        if (drawnStickSettledAtRef.current === null) {
          drawnStickSettledAtRef.current = state.clock.elapsedTime;
        }
        const t0 = drawnStickSettledAtRef.current;
        const elapsed = state.clock.elapsedTime - t0;
        let stickOp = 1;
        let textOp = 0;
        if (elapsed <= STICK_HOLD_BEFORE_FADE) {
          stickOp = 1;
          textOp = 0;
        } else if (elapsed <= STICK_HOLD_BEFORE_FADE + STICK_FADE_OUT_DURATION) {
          const u = (elapsed - STICK_HOLD_BEFORE_FADE) / STICK_FADE_OUT_DURATION;
          const e = u * u * (3 - 2 * u);
          stickOp = 1 - e;
          textOp = e;
        } else {
          stickOp = 0;
          textOp = 1;
        }
        if (drawnStickModelRef.current) {
          if (stickOp <= 0.02) {
            drawnStickModelRef.current.visible = false;
          } else {
            drawnStickModelRef.current.visible = true;
            applyDrawnStickMeshOpacity(drawnStickModelRef.current, stickOp);
          }
        }
        poemHtmlOpacityRef.current = textOp;
      } else {
        drawnStickSettledAtRef.current = null;
        if (drawnStickModelRef.current) {
          if (!drawnStickModelRef.current.visible || poemHtmlOpacityRef.current > 0) {
            drawnStickModelRef.current.visible = true;
            restoreDrawnStickMeshOpaque(drawnStickModelRef.current);
          }
        }
        if (poemHtmlOpacityRef.current !== 0) {
          poemHtmlOpacityRef.current = 0;
        }
      }

      // 第二輪擲筊：「倒放」動畫結束後，依結果分流——聖杯→第五層（籤筒放大到中間）；笑杯／陰杯→第二層 closeup
      if (isRewindingStick && t <= 0) {
        setIsRewindingStick(false);
        drawnStickProgressRef.current = 0;
        if (pickedStickMeshRef.current) {
          (pickedStickMeshRef.current as THREE.Mesh).visible = true;
          pickedStickMeshRef.current = null;
        }
        if (rewindForFifthLayerRef.current) {
          rewindForFifthLayerRef.current = false;
          // 聖杯成功：籤筒轉場已在倒放時同步進行，此處僅收掉詩籤與狀態
          setDrawingPhase("closeup");
          setPickedStickId(null);
          onPickedStickChange?.(null);
        } else {
          // 笑杯／陰杯：回到第二層 closeup 抽籤狀態
          setDrawingPhase("closeup");
          setPickedStickId(null);
          setConfirmStickId(null);
          setConfirmPoemId(null);
        }
      }
    }

    // 手機＋第四層（已確認候選籤）：淡出與直書完畢後改由畫面底部橫排，此處才隱藏整個抽出籤群組
    if (drawnStickGroupRef.current && drawingPhase === "picked" && pickedStickId !== null) {
      const settled = drawnStickSettledAtRef.current;
      const elapsed =
        settled != null ? state.clock.elapsedTime - settled : 0;
      const fadeHandoffDone =
        settled != null &&
        elapsed >= STICK_HOLD_BEFORE_FADE + STICK_FADE_OUT_DURATION;
      const hideDrawnStickMobile =
        isNarrowViewport &&
        confirmStickId !== null &&
        !isRewindingStick &&
        fadeHandoffDone;
      drawnStickGroupRef.current.visible = !hideDrawnStickMobile;
    }

    // 7. 窗外雲朵水平飄移（只做 X 軸向右流動，循環）
    if (skyCloudFarRef.current) {
      const speed = 3.0 * (isMobile ? 0.7 : 1.0); // 單位 / 秒
      const limit = 90;
      let x = skyCloudFarRef.current.position.x + speed * delta;
      if (x > limit) x = -limit;
      skyCloudFarRef.current.position.x = x;
    }
    if (skyCloudNearRef.current) {
      const speed = 4.2 * (isMobile ? 0.7 : 1.0);
      const limit = 95;
      let x = skyCloudNearRef.current.position.x + speed * delta;
      if (x > limit) x = -limit;
      skyCloudNearRef.current.position.x = x;
    }

    // ★ 最終覆寫：picked 階段（非第五/六層）時，籤筒退到右下角固定位置
    // 比 Stage 4 idle 更往右 (+20) 且往下 (-18)，讓抽出的籤有充裕的展示空間
    const PICKED_TARGET_X = fortuneIdleBaseX + 25;   // 右移 20
    const PICKED_TARGET_Y = fortuneIdleBaseY - 14;   // 下移 18
    const PICKED_TARGET_Z = 4;                        // 稍微推遠（縮小）
    const PICKED_TARGET_SCALE = fortuneIdleScale *1.1 ; // 縮小 15%
    if (
      fortuneGroupRef.current &&
      drawingPhase === "picked" &&
      !isFifthLayer &&
      !fifthLayerAnimRef.current?.active
    ) {
      const fg = fortuneGroupRef.current;
      const retreat = pickedRetreatRef.current;
      if (retreat?.active) {
        const RETREAT_DURATION = 0.55;
        retreat.progress = Math.min(retreat.progress + delta / RETREAT_DURATION, 1);
        const t = retreat.progress;
        const eased = t * t * (3 - 2 * t);
        fg.position.x = retreat.startX + (PICKED_TARGET_X - retreat.startX) * eased;
        fg.position.y = retreat.startY + (PICKED_TARGET_Y - retreat.startY) * eased;
        fg.position.z = retreat.startZ + (PICKED_TARGET_Z - retreat.startZ) * eased;
        fg.scale.setScalar(
          retreat.startScale + (PICKED_TARGET_SCALE - retreat.startScale) * eased
        );
        if (retreat.progress >= 1) {
          pickedRetreatRef.current = { ...retreat, active: false };
          if (isNarrowViewport) {
            mobilePickedTubeRetreatDoneRef.current = true;
          }
        }
      } else if (isRewindingStick) {
        // 退抽籤動畫時籤筒跟著往 closeup 位置滑回，讓籤有地方插回去
        // 目標與 closeup 一致：窄視窗 fortuneIdleBaseX 已置中，不可再 -2（否則會偏左）
        const closeupTargetX = fortuneIdleBaseX + (isNarrowViewport ? 0 : -2);
        const closeupTargetY = fortuneIdleBaseY - 2;
        const closeupTargetZ = 20;
        const closeupTargetScale = fortuneIdleScale; // 不乘倍數，與 closeup targetScale 相同
        const rewindLerp = isNarrowViewport ? 0.04 : 0.06;
        fg.position.x = THREE.MathUtils.lerp(fg.position.x, closeupTargetX, rewindLerp);
        fg.position.y = THREE.MathUtils.lerp(fg.position.y, closeupTargetY, rewindLerp);
        fg.position.z = THREE.MathUtils.lerp(fg.position.z, closeupTargetZ, rewindLerp);
        fg.scale.setScalar(THREE.MathUtils.lerp(fg.scale.x, closeupTargetScale, rewindLerp));
      } else {
        fg.position.set(PICKED_TARGET_X, PICKED_TARGET_Y, PICKED_TARGET_Z);
        fg.scale.setScalar(PICKED_TARGET_SCALE);
      }
      // 重置籤筒旋轉
      fg.rotation.y = THREE.MathUtils.lerp(fg.rotation.y, 0, 0.15);
      fg.rotation.z = THREE.MathUtils.lerp(fg.rotation.z, 0, 0.15);
      tubeRotationYRef.current = THREE.MathUtils.lerp(tubeRotationYRef.current, 0, 0.15);
      if (hintCounterRotateRef.current) {
        hintCounterRotateRef.current.rotation.y = -tubeRotationYRef.current;
      }
      if (sticksGroupRef.current) {
        sticksGroupRef.current.rotation.y = THREE.MathUtils.lerp(
          sticksGroupRef.current.rotation.y, 0, 0.15
        );
        sticksGroupRef.current.children.forEach((stick) => {
          if (stick.userData.restPosition) {
            const r = stick.userData.restPosition;
            stick.position.x = THREE.MathUtils.lerp(stick.position.x, r.x, 0.15);
            stick.position.y = THREE.MathUtils.lerp(stick.position.y, r.y, 0.15);
            stick.position.z = THREE.MathUtils.lerp(stick.position.z, r.z, 0.15);
          }
        });
      }
      const hideFortuneTubeMobilePicked =
        isNarrowViewport &&
        mobilePickedTubeRetreatDoneRef.current &&
        !isRewindingStick &&
        !isFifthLayer;
      fg.visible = !hideFortuneTubeMobilePicked;
    }
  });

  // 第四層香爐上方「第 N 首」標籤：輕微上下晃動
  useFrame((state) => {
    if (
      !fortuneLabelGroupRef.current ||
      confirmStickId === null ||
      drawingPhase !== "idle" ||
      flowMode !== "fortune"
    ) {
      return;
    }
    const t = state.clock.elapsedTime;
    const baseY = -16;
    const amp = 0.4;
    const speed = 0.8;
    fortuneLabelGroupRef.current.position.y =
      baseY + Math.sin(t * speed) * amp;
  });

  // --- 圖層尺寸（之後可依實際圖片比例微調）---
  const layerSize: [number, number] = [220, 90];
  const altarSize: [number, number] = [24, 24];    // 香案香爐（稍微縮小）
  const cabinetSize: [number, number] = [21, 21];  // 書櫃（稍微縮小）
  const cushionSize: [number, number] = [12.5, 12.5];  // 跪墊（稍微縮小）

  // 天空背景以中心為基準，依相機視野自動滿版。
  const skyPlaneZ = -20;
  const skyDistance = Math.max(0.1, camera.position.z - skyPlaneZ);
  const cameraFov =
    camera instanceof THREE.PerspectiveCamera ? camera.fov : 45;
  const fovRad = (cameraFov * Math.PI) / 180;
  const skyHeight = 2 * Math.tan(fovRad / 2) * skyDistance;
  const skyWidth = skyHeight * (size.width / Math.max(1, size.height));
  const skyPlaneSize: [number, number] = [skyWidth * 1.02, skyHeight * 1.02];

  return (
    <>
      {/* 暖色環境光（室內殿堂感），再亮一倍 */}
      <ambientLight intensity={3.7} color="#ffe8cc" />

      {/* ===== 0. 最遠天空背景（與殿內同尺寸，固定不動）===== */}
      <mesh ref={skyMeshRef} position={[0, 0, skyPlaneZ]}>
        <planeGeometry args={skyPlaneSize} />
        <meshBasicMaterial
          ref={skyMatRef}
          map={curSky}
          transparent
          toneMapped={false}
          opacity={fadeRef.current}
        />
      </mesh>
      <mesh ref={nxtSkyMeshRef} position={[0, 0, skyPlaneZ - 0.1]}>
        <planeGeometry args={skyPlaneSize} />
        <meshBasicMaterial
          ref={nxtSkyMatRef}
          map={nxtSky}
          transparent
          toneMapped={false}
          opacity={0}
        />
      </mesh>

      {/* ===== 0.5 雲霧層（貼近使用者，營造霧感）===== */}
      {/* 遠層霧雲 */}
      <group ref={skyCloudFarRef} position={[-60, 8, -12.5]}>
        <Cloud
          opacity={0.2}
          speed={0.08}
          bounds={[180, 56, 20]}
          position={[0, 0, 0]}
          segments={60}
          color="#eaf2ff"
        />
      </group>
      {/* 近層霧雲（更靠近鏡頭） */}
      <group ref={skyCloudNearRef} position={[35, 1, -9.5]}>
        <Cloud
          opacity={0.14}
          speed={0.06}
          bounds={[150, 48, 18]}
          position={[0, 0, 0]}
          segments={55}
          color="#dbeafe"
        />
      </group>

      {/* ===== 1. 背景層（牆面、神像、天花板）===== */}
      <mesh ref={bgMeshRef} position={[0, 0, -10]}>
        <planeGeometry args={layerSize} />
        <meshBasicMaterial ref={bgMatRef} map={curBg} transparent toneMapped={false} opacity={fadeRef.current} />
      </mesh>
      <mesh ref={nxtBgMeshRef} position={[0, 0, -10.1]}>
        <planeGeometry args={layerSize} />
        <meshBasicMaterial ref={nxtBgMatRef} map={nxtBg} transparent toneMapped={false} opacity={0} />
      </mesh>

      {/* ===== 2. 左側光牆 ===== */}
      <mesh ref={llMeshRef} position={[3.5, -1, -4]} scale={[0.95, 0.95, 1]}>
        <planeGeometry args={layerSize} />
        <meshBasicMaterial ref={llMatRef} map={curLL} transparent toneMapped={false} opacity={fadeRef.current} />
      </mesh>
      <mesh ref={nxtLlMeshRef} position={[3.5, -1, -4.1]} scale={[0.95, 0.95, 1]}>
        <planeGeometry args={layerSize} />
        <meshBasicMaterial ref={nxtLlMatRef} map={nxtLL} transparent toneMapped={false} opacity={0} />
      </mesh>

      {/* ===== 3. 右側光牆 ===== */}
      <mesh ref={rlMeshRef} position={[-3, -1, -3]} scale={[0.95, 0.95, 1]}>
        <planeGeometry args={layerSize} />
        <meshBasicMaterial ref={rlMatRef} map={curRL} transparent toneMapped={false} opacity={fadeRef.current} />
      </mesh>
      <mesh ref={nxtRlMeshRef} position={[-3, -1, -3.1]} scale={[0.95, 0.95, 1]}>
        <planeGeometry args={layerSize} />
        <meshBasicMaterial ref={nxtRlMatRef} map={nxtRL} transparent toneMapped={false} opacity={0} />
      </mesh>

      {/* ===== 4. 香案＋香爐（抽籤 closeup 時隱藏）===== */}
      <mesh ref={altarMeshRef} position={[0, -22, -3]} visible={drawingPhase === "idle"}>
        <planeGeometry args={altarSize} />
        <meshBasicMaterial ref={altarMatRef} map={curAltar} transparent toneMapped={false} opacity={fadeRef.current} />
      </mesh>
      <mesh ref={nxtAltarMeshRef} position={[0, -22, -2.1]} visible={drawingPhase === "idle"}>
        <planeGeometry args={altarSize} />
        <meshBasicMaterial ref={nxtAltarMatRef} map={nxtAltar} transparent toneMapped={false} opacity={0} />
      </mesh>

      {/* 第四層：香爐上方「第 N 首」標籤（與熱點一模一樣樣式） */}
      {confirmStickId !== null && drawingPhase === "idle" && flowMode === "fortune" && (
        <group ref={fortuneLabelGroupRef} position={[0, -20, 0]}>
          <Html
            center
            position={[0, 6, 0]}
            zIndexRange={[3000, 0]}
            pointerEvents="none"
          >
            <div
              className="bg-black/60 text-amber-100 px-4 py-2 tracking-widest backdrop-blur-md whitespace-nowrap pointer-events-none select-none shadow-lg"
              style={{
                fontSize: "24px",
                fontFamily: "var(--font-moe-li), serif",
                writingMode: "vertical-rl",
                opacity: 1,
                textShadow:
                  "0 0 12px rgba(252, 211, 77, 1), 0 0 22px rgba(252, 211, 77, 0.95), 0 0 36px rgba(252, 211, 77, 0.9), 0 0 52px rgba(251, 191, 36, 0.85), 0 0 72px rgba(248, 250, 252, 0.8)",
              }}
            >
              第{numToChinese(confirmStickId)}首
            </div>
          </Html>
        </group>
      )}

      {/* ===== 5. 書櫃／小立櫃（抽籤 closeup 時隱藏）===== */}
      <mesh ref={cabinetMeshRef} position={[17, -22, -3]} visible={drawingPhase === "idle"}>
        <planeGeometry args={cabinetSize} />
        <meshBasicMaterial map={bookCabinet} transparent toneMapped={false} />
      </mesh>

      {/* ===== 6. 跪墊（抽籤 closeup 時隱藏）===== */}
      <mesh ref={cushionMeshRef} position={[16, -34, 1]} visible={drawingPhase === "idle"}>
        <planeGeometry args={cushionSize} />
        <meshBasicMaterial map={cushion} transparent toneMapped={false} />
      </mesh>

      {/* ===== 7. 3D 求籤組 ===== */}
      {!hideFortuneTube && <group
        ref={fortuneGroupRef}
        position={[fortuneIdleBaseX, fortuneIdleBaseY, 8]}
        scale={[fortuneIdleScale, fortuneIdleScale, fortuneIdleScale]}
        onPointerOver={() => { if (drawingPhase === "closeup") isOverSticksRef.current = true; }}
        onPointerOut={() => { isOverSticksRef.current = false; }}
        onPointerMove={() => {
          if (drawingPhase === "closeup" && isOverSticksRef.current) lastSticksMoveTimeRef.current = clock.getElapsedTime();
        }}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          if (drawingPhase !== "closeup" || isSixthLayer) return;
          e.stopPropagation();
          const pointerId = e.pointerId;
          const startX = e.pointer.x;
          gl.domElement.setPointerCapture(pointerId);
          tubeDragRef.current = {
            active: true,
            startX,
            startRotationY: tubeRotationYRef.current,
            moved: false,
            pointerId,
          };
          const el = gl.domElement;
          const onMove = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId || !tubeDragRef.current.active) return;
            if (ev.buttons !== 1) {
              el.releasePointerCapture(pointerId);
              el.removeEventListener("pointermove", onMove);
              el.removeEventListener("pointerup", onUp);
              el.removeEventListener("pointercancel", onUp);
              tubeDragRef.current.active = false;
              return;
            }
            const ndcX = (ev.clientX / window.innerWidth) * 2 - 1;
            const dx = ndcX - tubeDragRef.current.startX;
            if (Math.abs(dx) > 0.01) tubeDragRef.current.moved = true;
            tubeRotationYRef.current = tubeDragRef.current.startRotationY + dx * 3.2;
          };
          const onUp = (ev: PointerEvent) => {
            if (ev.pointerId !== pointerId) return;
            el.releasePointerCapture(pointerId);
            el.removeEventListener("pointermove", onMove);
            el.removeEventListener("pointerup", onUp);
            el.removeEventListener("pointercancel", onUp);
            const wasDrag = tubeDragRef.current.moved;
            tubeDragRef.current.active = false;
            if (wasDrag) return;
            // 第五層僅保留「點擊打開抽屜」，不觸發點籤抽籤
            if (isFifthLayer) return;
            if (!fortuneGroupRef.current) return;
            const ndcX = (ev.clientX / window.innerWidth) * 2 - 1;
            const ndcY = -(ev.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
            const hits = raycaster.intersectObject(fortuneGroupRef.current, true);
            const stickHit = hits.find((h) => h.object.name.startsWith("Stick_"));
            if (stickHit) {
              const name = stickHit.object.name;
              const num = parseInt(name.replace("Stick_", ""), 10);
              if (!Number.isNaN(num) && num >= 1 && num <= 49 && !rejectedStickIdsRef.current.has(num)) {
                handlePickStick(num, stickHit.object);
              }
            }
          };
          el.addEventListener("pointermove", onMove);
          el.addEventListener("pointerup", onUp);
          el.addEventListener("pointercancel", onUp);
        }}
      >
        {/* 籤筒：點光源＋展燈，再亮一倍 */}
        <pointLight
          position={[0, 12, 8]}
          intensity={isFifthLayer ? 24 : 10}
          color="#f8ead0"
          distance={55}
          decay={2}
          visible={!mobileJiaoHidden}
        />
        <pointLight
          position={[0, 28, 6]}
          intensity={
            isFifthLayer
              ? 26
              : flowMode === "fortune" && shengBeiInFortuneFlow && drawingPhase === "idle"
              ? 12
              : 8.4
          }
          color="#f5e4cc"
          distance={48}
          decay={2}
          visible={!mobileJiaoHidden}
        />
        {/* 展燈：前上方柔光 */}
        <group ref={spotTargetRef} position={[0, 12, 0]} />
        <spotLight
          ref={spotLightRef}
          position={[0, 36, 16]}
          angle={0.65}
          penumbra={0.7}
          intensity={18.4}
          distance={60}
          decay={2}
          color="#fff5e0"
          castShadow={false}
          visible={!mobileJiaoHidden}
        />

        {/* 手機擲筊流程隱藏 3D 籤桶（僅視覺，熱點仍保留）*/}
        <group visible={!mobileJiaoHidden}>
        <FortuneSet
          position={[0, 0, 0]}
          scale={8.5}
          sticksGroupRef={sticksGroupRef}
          openDrawerIndex={isFifthLayer ? openDrawerIndex : null}
          highlightDrawerIndex={
            isFifthLayer && !isSixthLayer && openDrawerIndex == null ? targetDrawerIndex : null
          }
          drawerAnglesRef={drawerAnglesRef}
          onDrawerMouthWorldPositionChange={(pos) => {
            drawerMouthWorldPosRef.current = pos ? pos.clone() : null;
          }}
          onDrawerClick={(idx) => {
            if (!isFifthLayer || isSixthLayer) return;
            if (targetDrawerIndex == null) return;
            if (idx !== targetDrawerIndex) return;
            setOpenDrawerIndex(idx);
          }}
        />
        </group>

        {/* closeup 時：籤滑動感應區往外擴一圈，較大好用（透明平面，不擋點籤） */}
        {drawingPhase === "closeup" && (
          <mesh
            position={[0, 24, 16]}
            onPointerOver={() => { isOverSticksRef.current = true; }}
            onPointerOut={() => { isOverSticksRef.current = false; }}
            onPointerMove={() => { lastSticksMoveTimeRef.current = clock.getElapsedTime(); }}
          >
            <planeGeometry args={[26, 22]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}

        {/* 熱點放在籤筒「前面」一層（z 較大），確保 raycast 先打到熱點，點擊與 hover 才不會被筒身擋住 */}
        {/* 第一層：點「求籤」或「擲筊」後，籤筒上方改顯示「結束擲筊」（常駐顯示）；求籤若得聖杯則再額外顯示「抽籤」。
            第四層：顯示「結束求籤」，點擊回到第一層；第五層不顯示「結束求籤」；closeup/picked 時不顯示熱點。 */}
        {confirmStickId !== null && flowMode === "fortune" && !isRewindingStick && !isFifthLayer ? (
          <>
            {/** 手機（useIsMobile，視窗寬度小於 768）：第四層 picked 不顯示；第六層改用獨立 action row（在儲存工具列下方） */}
            {!(isMobile && (drawingPhase === "picked" || isSixthLayer)) && (
            <Hotspot
              label="結束求籤"
              position={tubeTopPos(
                isSixthLayer
                  ? (isNarrowViewport ? -4 : -7)
                  : tubeLabelXAdj,
                isSixthLayer
                  ? (narrowBottomHotspotLayout ? TUBE_HOTSPOT_ROW_Y_NARROW : 27)
                  : tubeHotspotRowY,
                14
              )}
              size={[10, 12]}
              onClick={handleEndFortune}
              forceVisible={true}
            />
            )}
            {/* 第六層：結束求籤右邊加「再問一題」，點擊後返回第一層並進入第一次擲筊狀態 */}
            {isSixthLayer && !isMobile && (
              <Hotspot
                label="再問一題"
                position={tubeTopPos(
                  isNarrowViewport ? 9 : 13,
                  narrowBottomHotspotLayout ? TUBE_HOTSPOT_ROW_Y_NARROW : 27,
                  14
                )}
                size={[10, 12]}
                onClick={handleAskAgain}
                forceVisible={true}
              />
            )}
          </>
        ) : drawingPhase === "idle" ? (
          <>
            {/* 第一層：單純擲筊流程中（throw_only）→ 顯示「結束擲筊」 */}
            {flowMode === "throw_only" && jiaoPhase !== "idle" && (
              <Hotspot
                label="結束擲筊"
                position={tubeTopPos(tubeLabelXAdj, tubeHotspotRowY, 14)}
                size={[10, 12]}
                onClick={() => {
                  setFlowMode("idle");
                  setJiaoPhase("idle");
                  setJiaoResult(null);
                  setShowRetryButton(false);
                }}
                forceVisible={true}
              />
            )}

            {/* 第一層：求籤流程擲筊中（fortune，尚未有候選籤）→ 顯示「結束求籤」；得聖杯且已點擊筊杯「抽籤」後，改顯示「問修道」「問人事」 */}
            {flowMode === "fortune" && confirmStickId === null && jiaoPhase !== "idle" && (
              <>
                {!shengBeiInFortuneFlow || isWaitingQuestionType ? (
                  <Hotspot
                    label="結束求籤"
                    position={tubeTopPos(tubeLabelXAdj, tubeHotspotRowY, 14)}
                    size={[12, 14]}
                    onClick={() => {
                      setFlowMode("idle");
                      setJiaoPhase("idle");
                      setJiaoResult(null);
                      setShowRetryButton(false);
                      setShengBeiInFortuneFlow(false);
                      setIsWaitingQuestionType(false);
                    }}
                    forceVisible={true}
                  />
                ) : (
                  <>
                    <Hotspot
                      label="問修道"
                      position={tubeTopPos((narrowBottomHotspotLayout ? -6 : -10) + tubeLabelXAdj, tubeHotspotRowY, 14)}
                      size={[10, 12]}
                      onClick={() => handleEnterCloseup("xiudao")}
                      forceVisible={true}
                    />
                    <Hotspot
                      label="問人事"
                      position={tubeTopPos((narrowBottomHotspotLayout ? 6 : 2) + tubeLabelXAdj, tubeHotspotRowY, 14)}
                      size={[10, 12]}
                      onClick={() => handleEnterCloseup("rensheng")}
                      forceVisible={true}
                    />
                  </>
                )}
              </>
            )}

            {/* 初始狀態：顯示「求籤」「擲筊」，並列於籤筒正上方 */}
            {flowMode === "idle" && jiaoPhase === "idle" && isTubeMenuVisible && (
              <>
                <Hotspot
                  label="求籤"
                  position={tubeTopPos(-6 + tubeLabelXAdj, tubeHotspotRowY, 14)}
                  size={[24, 28]}
                  onClick={handleClickQiuqian}
                  forceVisible={true}
                />
                <Hotspot
                  label="擲筊"
                  position={tubeTopPos(6 + tubeLabelXAdj, tubeHotspotRowY, 14)}
                  size={[24, 28]}
                  onClick={handleClickThrowBlocks}
                  forceVisible={true}
                />
              </>
            )}
          </>
        ) : null}

        {/* 籤筒本體 hover / 點擊區：在熱點「後面」（z 較小），聖杯後可點擊進入抽籤 closeup */}
        <mesh
          position={uiPos(0, 8, 8)}
          onPointerOver={(e) => {
            e.stopPropagation();
            setIsTubeHovered(true);
            document.body.style.cursor =
              flowMode === "fortune" && shengBeiInFortuneFlow && drawingPhase === "idle"
                ? "pointer"
                : "default";
          }}
          onPointerOut={() => {
            setIsTubeHovered(false);
            document.body.style.cursor = "default";
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (!isFifthLayer) handleEnterCloseup();
          }}
          raycast={drawingPhase === "closeup" ? () => null : undefined}
        >
          <cylinderGeometry args={[9, 9, 26, 16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* 求籤 closeup：左右兩側提示文字，不隨籤筒旋轉（子 group 反轉抵消），樣式與熱點一致，金色光暈較強 */}
        {drawingPhase === "closeup" && (
          <group ref={hintCounterRotateRef}>
            {/* 左側中間提示：
                - 第二層（非第五層）：顯示「點擊抽籤」
                - 第五層：顯示「點擊拖移旋轉籤筒」，對準抽屜時改為可點擊「點擊打開抽屜」，樣式與第一層 Hotspot 相同 */}
            <Html
              position={uiPos(isMobile ? -8 : -14, 18, 10)}
              center
              style={{
                pointerEvents:
                  isFifthLayer && !isSixthLayer && atTargetDrawer && confirmPoemId != null && poemType ? "auto" : "none",
                opacity: isSixthLayer ? 0 : 1,
                transition: "opacity 0.5s ease",
              }}
            >
              {isFifthLayer && !isSixthLayer ? (
                atTargetDrawer && confirmPoemId != null && poemType ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (targetDrawerIndex != null) setOpenDrawerIndex(targetDrawerIndex);
                    }}
                    className="whitespace-nowrap border-0 cursor-pointer bg-transparent px-3 py-2"
                    style={{
                      fontSize: "22px",
                      fontFamily: "var(--font-noto-serif-tc), Noto Serif TC, serif",
                      color: "#fffbeb",
                      fontWeight: 600,
                      letterSpacing: "0.15em",
                      writingMode: "vertical-rl",
                      textOrientation: "upright",
                      textShadow:
                        "0 0 10px rgba(250, 204, 21, 0.9), 0 0 22px rgba(234, 179, 8, 0.55)",
                      padding: "10px 18px",
                      borderRadius: "999px",
                      transition:
                        "opacity 0.25s ease, transform 0.25s ease, text-shadow 0.25s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textShadow =
                        "0 0 14px rgba(253, 224, 71, 0.95), 0 0 28px rgba(250, 204, 21, 0.65)";
                      e.currentTarget.style.transform = "scale(1.08)";
                      document.body.style.cursor = "pointer";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.textShadow =
                        "0 0 10px rgba(250, 204, 21, 0.9), 0 0 22px rgba(234, 179, 8, 0.55)";
                      e.currentTarget.style.transform = "scale(1)";
                      document.body.style.cursor = "default";
                    }}
                  >
                    點擊打開抽屜
                  </button>
                ) : (
                  <div
                    className="text-white tracking-widest whitespace-nowrap pointer-events-none select-none"
                    style={{
                      fontSize: "18px",
                      fontFamily: "var(--font-noto-serif-tc), Noto Serif TC, serif",
                      writingMode: "vertical-rl",
                      textOrientation: "upright",
                      letterSpacing: "0.15em",
                      textShadow: "0 0 6px rgba(0, 0, 0, 0.9)",
                    }}
                  >
                    點住拖移旋轉籤筒
                  </div>
                )
              ) : (
                <div
                  className="bg-black/60 text-amber-100 px-4 py-2 tracking-widest backdrop-blur-md whitespace-nowrap select-none shadow-lg"
                  style={{
                    fontSize: isMobile ? "18px" : "24px",
                    fontFamily: "var(--font-noto-serif-tc), Noto Serif TC, serif",
                    writingMode: "vertical-rl",
                    textOrientation: "upright",
                    letterSpacing: "0.15em",
                    textShadow: "0 0 8px rgba(0,0,0,0.6)",
                  }}
                >
                  點擊抽籤
                </div>
              )}
            </Html>
            {/* 第五層：右側顯示抽到的籤數（確認詩籤的籤號） */}
            {isFifthLayer && !isSixthLayer && confirmPoemId != null && poemType && (
              <Html position={[4.5, 18, 6]} center style={{ pointerEvents: "none" }} zIndexRange={[3000, 0]}>
                <div
                  className="text-white tracking-widest whitespace-nowrap pointer-events-none select-none"
                  style={{
                    fontSize: "22px",
                    fontFamily: "var(--font-noto-serif-tc), Noto Serif TC, serif",
                    writingMode: "vertical-rl",
                    textOrientation: "upright",
                    letterSpacing: "0.2em",
                    textShadow: "0 0 6px rgba(0, 0, 0, 0.9)",
                  }}
                >
                  第{numToChinese(confirmPoemId)}首
                </div>
              </Html>
            )}
          </group>
        )}

      </group>}

      {/* 抽出的籤：scale 在 useFrame 依階段從 TUBE_SCALE 動畫到 DISPLAY_SCALE */}
      {drawingPhase === "picked" && pickedStickId !== null && (
        <group ref={drawnStickGroupRef} layers={1} position={[0, 0, 0]} renderOrder={10}>
          <group position={[0, -0.5, 0]}>
            <group ref={drawnStickModelRef}>
              <SingleStickFromGLB stickId={pickedStickId} />
            </group>
          </group>
        </group>
      )}

      {/* 第四層：尚未開始第二輪擲筊時，中央顯示立杯＋「確認詩籤」按鈕。
          第二輪擲筊是否可以開始，已由前面的求籤聖杯流程決定，這裡不再依賴 jiaoPhase/jiaoResult，
          只要目前有候選詩籤（confirmStickId）且尚未進入第二輪（secondJiaoStarted === false），
          且沒有在執行倒放動畫（isRewindingStick === false）即可顯示。 */}
      {drawingPhase === "picked" &&
        confirmStickId !== null &&
        flowMode === "fortune" &&
        !secondJiaoStarted &&
        !isRewindingStick && (
          <group position={[0, JIAO_FOURTH_LAYER_GROUP_Y, 12]} scale={6.6}>
            <group scale={12.5}>
              <JiaoPairFromGLB result={null} />
            </group>
            <Html
              position={[0, 0, 0]}
              center
              style={{ pointerEvents: "auto" }}
              zIndexRange={[100000, 0]}
            >
              <div
                onClick={handleStartSecondJiao}
                className="bg-black/60 text-amber-100 tracking-widest backdrop-blur-md whitespace-nowrap select-none shadow-lg cursor-pointer"
                style={{
                  fontSize: isNarrowViewport ? "20px" : "24px",
                  fontFamily: "var(--font-noto-serif-tc), Noto Serif TC, serif",
                  padding: "14px 40px",
                  textShadow: "0 0 8px rgba(0,0,0,0.6)",
                  transition: "opacity 0.25s ease, transform 0.25s ease, text-shadow 0.25s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textShadow = "0 0 16px rgba(255,255,255,0.9)";
                  e.currentTarget.style.transform = "scale(1.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textShadow = "0 0 8px rgba(0,0,0,0.6)";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                確認詩籤
              </div>
            </Html>
          </group>
        )}

      {/* 第二輪擲筊：笑杯／陰杯時，中央顯示提示文字（樣式與熱點一樣），約 1.5 秒後啟動「倒放」動畫 */}
      {/* ===== 8. 擲筊：中央跟隨滑鼠移動的筊杯（第一輪＆第二輪）===== */}
      {jiaoPhase !== "idle" &&
        (drawingPhase === "idle" ||
          (drawingPhase === "picked" && confirmStickId !== null && secondJiaoStarted)) && (
          <group
            ref={jiaoPreviewRef}
            position={
              drawingPhase === "picked" && confirmStickId !== null && secondJiaoStarted
                ? [
                    isNarrowViewport ? 0 : -2,
                    JIAO_FOURTH_LAYER_GROUP_Y,
                    12,
                  ] // 窄視窗筊杯組水平置中；「不是這首」Html 同群組原點，落在兩杯之間
                : [JIAO_BASE_X, JIAO_BASE_Y, JIAO_BASE_Z]
            }
            scale={6.6}
          >
            <group ref={jiaoInnerRef} scale={12.5}>
              <JiaoPairFromGLB
                result={jiaoPhase === "result" ? jiaoResult : null}
              />
            </group>
            {secondJiaoMessageVisible && (
              <Html
                position={[0, 0, 0]}
                center
                style={{ pointerEvents: "none" }}
                zIndexRange={[100000, 0]}
              >
                <div
                  className="bg-black/60 text-amber-100 tracking-widest backdrop-blur-md whitespace-nowrap pointer-events-none select-none shadow-lg"
                  style={{
                    fontSize: isNarrowViewport ? 20 : 24,
                    fontFamily: "var(--font-noto-serif-tc), Noto Serif TC, serif",
                    letterSpacing: "0.2em",
                    padding: "14px 40px",
                    textShadow: "0 0 8px rgba(0, 0, 0, 0.6)",
                  }}
                >
                  不是這首，請再抽一次
                </div>
              </Html>
            )}
            {/* 手機：瞄準中於兩杯之間顯示「擲出」。須用父層 isMobile（useIsMobile 首輪 false），勿在 render 讀 window，否則 SSR/hydration 不一致。Html 座標與「再試一次」同為群組原點 [0,0,0]，才會落在兩杯正中。 */}
            {jiaoPhase === "aiming" && isMobile && (
                <Html
                  position={[0, 0, 0]}
                  center
                  style={{ pointerEvents: "auto" }}
                  zIndexRange={[100000, 0]}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMobileExplicitThrow();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleMobileExplicitThrow();
                      }
                    }}
                    className="bg-black/60 text-amber-100 tracking-widest backdrop-blur-md whitespace-nowrap select-none shadow-lg cursor-pointer"
                    style={{
                      fontSize: "22px",
                      fontFamily: "var(--font-noto-serif-tc), Noto Serif TC, serif",
                      padding: "14px 40px",
                      textShadow: "0 0 8px rgba(0, 0, 0, 0.6)",
                      transition:
                        "opacity 0.25s ease, transform 0.25s ease, text-shadow 0.25s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textShadow =
                        "0 0 16px rgba(255,255,255,0.9)";
                      e.currentTarget.style.transform = "scale(1.12)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.textShadow = "0 0 8px rgba(0,0,0,0.6)";
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    擲出
                  </div>
                </Html>
              )}
            {/* 第一輪：笑杯／陰杯「再問一題 / 再試一次」按鈕（擲筊熱點：再問一題；求籤流程：再試一次；第二輪不顯示任何按鈕） */}
            {jiaoPhase === "result" &&
              (jiaoResult === "笑杯" || jiaoResult === "陰杯") &&
              showRetryButton &&
              confirmStickId === null &&
              !secondJiaoStarted && (
                <Html
                  position={[0, 0, 0]}
                  center
                  style={{ pointerEvents: "auto" }}
                  zIndexRange={[100000, 0]}
                >
                  <div
                    onClick={() => handleRetryRef.current()}
                    className="bg-black/60 text-amber-100 px-4 py-2 tracking-widest backdrop-blur-md whitespace-nowrap select-none shadow-lg cursor-pointer"
                    style={{
                      fontSize: "22px",
                      fontFamily: "var(--font-noto-serif-tc), Noto Serif TC, serif",
                      textShadow: "0 0 8px rgba(0,0,0,0.6)",
                      transition: "opacity 0.25s ease, transform 0.25s ease, text-shadow 0.25s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textShadow = "0 0 16px rgba(255,255,255,0.9)";
                      e.currentTarget.style.transform = "scale(1.12)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.textShadow = "0 0 8px rgba(0,0,0,0.6)";
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    {flowMode === "throw_only" ? "再問一題" : "再試一次"}
                  </div>
                </Html>
              )}

            {/* 第一輪：聖杯時顯示「再問一題」按鈕（擲筊模式專用，樣式與「再試一次」相同） */}
            {jiaoPhase === "result" &&
              jiaoResult === "聖杯" &&
              confirmStickId === null &&
              flowMode === "throw_only" &&
              !secondJiaoStarted && (
                <Html
                  position={[0, 0, 0]}
                  center
                  style={{ pointerEvents: "auto" }}
                  zIndexRange={[100000, 0]}
                >
                  <div
                    onClick={() => handleRetryRef.current()}
                    className="bg-black/60 text-amber-100 px-4 py-2 tracking-widest backdrop-blur-md whitespace-nowrap select-none shadow-lg cursor-pointer"
                    style={{
                      fontSize: "24px",
                      fontFamily: "var(--font-noto-serif-tc), Noto Serif TC, serif",
                      textShadow: "0 0 8px rgba(0,0,0,0.6)",
                      transition: "opacity 0.25s ease, transform 0.25s ease, text-shadow 0.25s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textShadow = "0 0 16px rgba(255,255,255,0.9)";
                      e.currentTarget.style.transform = "scale(1.12)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.textShadow = "0 0 8px rgba(0,0,0,0.6)";
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    再問一題
                  </div>
                </Html>
              )}

            {/* 第一層求籤：聖杯時，筊杯中央顯示「抽籤」按鈕（進入選類型階段） */}
            {jiaoPhase === "result" &&
              jiaoResult === "聖杯" &&
              confirmStickId === null &&
              flowMode === "fortune" &&
              shengBeiInFortuneFlow &&
              isWaitingQuestionType &&
              !secondJiaoStarted && (
                <Html
                  position={[0, 0, 0]}
                  center
                  style={{ pointerEvents: "auto" }}
                  zIndexRange={[100000, 0]}
                >
                  <div
                    onClick={() => { setIsWaitingQuestionType(false); }}
                    className="bg-black/60 text-amber-100 tracking-widest backdrop-blur-md whitespace-nowrap select-none shadow-lg cursor-pointer"
                    style={{
                  fontSize: "24px",
                  fontFamily: "var(--font-noto-serif-tc), Noto Serif TC, serif",
                  padding: "14px 40px",
                  textShadow: "0 0 8px rgba(0,0,0,0.6)",
                  transition: "opacity 0.25s ease, transform 0.25s ease, text-shadow 0.25s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textShadow = "0 0 16px rgba(255,255,255,0.9)";
                  e.currentTarget.style.transform = "scale(1.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textShadow = "0 0 8px rgba(0,0,0,0.6)";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                抽籤
              </div>
                </Html>
              )}
          </group>
        )}

      {/* ===== 第六層：詩籤卡面 ===== */}
      {/* 提前掛載讓 ref 在動畫啟動前就位；visible 由 isSixthLayer 控制，避免與 useFrame 衝突 */}
      {confirmPoemId != null && poemType && (
        <PoemCard
          ref={poemCardGroupRef}
          poemType={poemType}
          poemId={confirmPoemId}
          visible={isSixthLayer}
        />
      )}
      {isSixthLayer && confirmPoemId != null && poemType && (
        <>
          {/* 詩籤下方：儲存圖片（Hotspot 同款元件） */}
          <Hotspot
            label="儲存圖片"
            position={sixthLayerSavePos}
            size={[10, 12]}
            onClick={handleDownloadCard}
            forceVisible={true}
          />
          {/* 放大縮小按鈕（桌機與窄視窗分開 world position，避免與「儲存圖片」重疊） */}
          <Html
            position={sixthLayerZoomPos}
            center
            zIndexRange={[4000, 0]}
            style={{ pointerEvents: "auto" }}
          >
            <div
              style={{
                display: "flex",
                gap: isNarrowViewport ? "12px" : "14px",
                alignItems: "center",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  sixthLayerCardScaleRef.current = Math.min(
                    sixthLayerCardScaleRef.current + 0.35,
                    5.2
                  );
                }}
                style={{
                  width: "44px",
                  height: "44px",
                  fontSize: "22px",
                  color: "#fff",
                  background: "transparent",
                  border: "2px solid rgba(255,255,255,0.9)",
                  borderRadius: "10px",
                  cursor: "pointer",
                }}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => {
                  sixthLayerCardScaleRef.current = Math.max(
                    sixthLayerCardScaleRef.current - 0.35,
                    1.2
                  );
                }}
                style={{
                  width: "44px",
                  height: "44px",
                  fontSize: "22px",
                  color: "#fff",
                  background: "transparent",
                  border: "2px solid rgba(255,255,255,0.9)",
                  borderRadius: "10px",
                  cursor: "pointer",
                }}
              >
                −
              </button>
            </div>
          </Html>
          {isMobile && (
            <>
              <Hotspot
                label="結束求籤"
                position={sixthLayerMobileEndFortunePos}
                size={[10, 12]}
                onClick={handleEndFortune}
                forceVisible={true}
              />
              <Hotspot
                label="再問一題"
                position={sixthLayerMobileAskAgainPos}
                size={[10, 12]}
                onClick={handleAskAgain}
                forceVisible={true}
              />
            </>
          )}
        </>
      )}

      {/* ===== 氛圍粒子（模擬燭光塵埃飄浮）===== */}
      <Sparkles
        count={40}
        scale={80}
        size={2.5}
        speed={0.12}
        opacity={0.25}
        color="#fbbf24"
        position={[0, 5, 8]}
      />
      <Sparkles
        count={20}
        scale={40}
        size={1.8}
        speed={0.08}
        opacity={0.15}
        color="#ff9f43"
        position={[0, -5, 6]}
      />

      {/* ===== 香爐上方煙霧粒子（placeholder，之後可換成煙霧 shader）===== */}
      <Sparkles
        count={15}
        scale={[8, 20, 4]}
        size={3}
        speed={0.06}
        opacity={0.18}
        color="#d4c5a9"
        position={[0, 8, 3]}
      />
    </>
  );
};


export { ParallaxLayers };
