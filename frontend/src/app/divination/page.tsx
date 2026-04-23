"use client";

import React from "react";
import dynamic from "next/dynamic";
import { MAIN_BG_TEXTURE as fallbackBgUrl } from "@/lib/asset";

const NinghuiScene = dynamic(() => import("@/components/NinghuiScene"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: "#1a1410",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ color: "rgba(253,230,138,0.7)", letterSpacing: "0.12em" }}>
        求籤擲筊・載入中...
      </span>
    </div>
  ),
});

// 主要按鈕元件（含 hover / pressed 狀態）
type PrimaryButtonProps = {
  onClick: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
};

function PrimaryButton({ onClick, children, style }: PrimaryButtonProps) {
  const [hovered, setHovered] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);

  const base: React.CSSProperties = {
    border: "1px solid rgba(170,210,255,0.85)",
    borderRadius: 999,
    color: "#f5faff",
    textShadow: "0 1px 3px rgba(0,0,0,0.45)",
    cursor: "pointer",
    fontFamily: '"Noto Serif TC", serif',
    userSelect: "none",
    transition: "background 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease",
    outline: "none",
    // 依狀態切換
    background: pressed
      ? "rgba(9,58,120,0.97)"
      : hovered
      ? "rgba(22,112,204,0.97)"
      : "rgba(16,90,173,0.85)",
    boxShadow: pressed
      ? "0 2px 6px rgba(16,90,173,0.25), inset 0 2px 5px rgba(0,0,0,0.22)"
      : hovered
      ? "0 12px 30px rgba(16,90,173,0.55), inset 0 1px 0 rgba(255,255,255,0.38)"
      : "0 8px 22px rgba(16,90,173,0.35), inset 0 1px 0 rgba(255,255,255,0.28)",
    transform: pressed ? "translateY(2px) scale(0.97)" : hovered ? "translateY(-1px)" : "none",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => { setPressed(false); onClick(); }}
      onTouchCancel={() => setPressed(false)}
      style={{ ...base, ...style }}
    >
      {children}
    </button>
  );
}

export default function DivinationPage() {
  const [stage, setStage] = React.useState<1 | 2 | 3 | 4>(1);
  const [nameAnimPhase, setNameAnimPhase] = React.useState<"pre" | "enter" | "hold" | "exit">("pre");
  const [bgReady, setBgReady] = React.useState(false);
  const [sceneReady, setSceneReady] = React.useState(false);
  const [sceneProgress, setSceneProgress] = React.useState(0);
  const [displayProgress, setDisplayProgress] = React.useState(0);
  const [isNarrowLayout, setIsNarrowLayout] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [isJiaoActive, setIsJiaoActive] = React.useState(false);
  const [isSixthLayer, setIsSixthLayer] = React.useState(false);
  const [isFifthLayer, setIsFifthLayer] = React.useState(false);

  const readyToEnter = bgReady && sceneReady;
  const rawPercent = Math.min(100, sceneProgress * 0.9 + (bgReady ? 10 : 0));
  const loadPercent = Math.round(displayProgress);

  const reportSceneReady = React.useCallback(() => {
    setSceneReady(true);
  }, []);
  const reportSceneProgress = React.useCallback((p: number) => {
    setSceneProgress(p);
  }, []);

  // 預載背景圖
  React.useEffect(() => {
    let alive = true;
    const img = new window.Image();
    img.decoding = "async";
    img.onload = () => { if (alive) setBgReady(true); };
    img.onerror = () => { if (alive) setBgReady(true); };
    img.src = fallbackBgUrl;
    return () => { alive = false; };
  }, []);

  // 第一階段標題動畫
  React.useEffect(() => {
    if (!readyToEnter || stage !== 1) return;
    setNameAnimPhase("pre");
    const ENTER_MS = 950;
    const HOLD_MS = 1000;
    const EXIT_MS = 650;
    const raf = window.requestAnimationFrame(() => setNameAnimPhase("enter"));
    const t1 = window.setTimeout(() => setNameAnimPhase("hold"), ENTER_MS);
    const t2 = window.setTimeout(() => setNameAnimPhase("exit"), ENTER_MS + HOLD_MS);
    const t3 = window.setTimeout(() => setStage(2), ENTER_MS + HOLD_MS + EXIT_MS);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [readyToEnter, stage]);

  // RWD 斷點
  React.useEffect(() => {
    const updateLayout = () => {
      const w = window.innerWidth;
      setIsNarrowLayout(w < 980);
      setIsMobile(w < 768);
    };
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  // 視覺進度條平滑追蹤
  React.useEffect(() => {
    const ref = { id: 0 };
    ref.id = window.setInterval(() => {
      setDisplayProgress((prev) => {
        if (readyToEnter) {
          const next = Math.min(100, prev + 2.5);
          if (next >= 100) clearInterval(ref.id);
          return next;
        }
        if (prev < rawPercent) {
          const gap = rawPercent - prev;
          return Math.min(rawPercent, prev + Math.max(0.4, gap * 0.12));
        }
        if (prev < 95) return Math.min(95, prev + 0.12);
        return prev;
      });
    }, 80);
    return () => clearInterval(ref.id);
  }, [rawPercent, readyToEnter]);

  const toStage3 = React.useCallback(() => setStage(3), []);
  const toStage4 = React.useCallback(() => setStage(4), []);

  React.useEffect(() => {
    if (stage !== 4) setIsFifthLayer(false);
  }, [stage]);

  // 第四階段籤筒位置
  // 手機：垂直排版 → 籤筒置中、在畫面下半（x=0, y=-15），神像卡片在上方 DOM 層
  // 桌機：水平排版 → 籤筒在右側
  const tubeIdleX = stage === 4 ? (isMobile ? 0 : 26) : -18;
  const tubeIdleY = stage === 4 ? (isMobile ? -45 : -46) : -38;
  const tubeIdleScale = stage === 4 ? (isMobile ? 1.8 : 2.5) : 1;

  return (
    <main
      style={{
        position: "relative",
        width: "100%",
        height: "100dvh",
        background: "#1a1410",
        overflow: "hidden",
      }}
    >
      {/* 載入畫面 */}
      {!readyToEnter && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 3000,
            background: "#0b1220",
            display: "grid",
            placeItems: "center",
          }}
        >
          <div
            style={{
              textAlign: "center",
              color: "rgba(255,255,255,0.9)",
              fontFamily: 'MoeLI, "Noto Serif TC", serif',
              letterSpacing: "0.12em",
            }}
          >
            <div style={{ fontSize: isNarrowLayout ? 26 : 38, marginBottom: 10, animation: "pulse 1.2s ease-in-out infinite" }}>
              方壺解疑
            </div>
            <div style={{ fontSize: isNarrowLayout ? 16 : 24, opacity: 0.8, marginBottom: 8 }}>
              載入場景中... {loadPercent}%
            </div>
            <div
              style={{
                width: isNarrowLayout ? 160 : 220,
                height: 6,
                margin: "0 auto",
                borderRadius: 999,
                background: "rgba(255,255,255,0.18)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${loadPercent}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, rgba(16,185,129,0.9), rgba(59,130,246,0.9))",
                  transition: "width 200ms linear",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 背景保底圖 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          backgroundImage: `url("${fallbackBgUrl}")`,
          backgroundSize: "cover",
          backgroundPosition: "center 38%",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* 3D 場景 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          transition: "transform 700ms ease-out, opacity 500ms ease",
          opacity: readyToEnter ? 1 : 0,
          pointerEvents: readyToEnter ? "auto" : "none",
          // 手機 stage 4：有 DOM 神像時用漸層橋接；第五／六層只留 3D 籤筒，改滿版不遮
          maskImage:
            isMobile && stage === 4 && !isFifthLayer && !isSixthLayer
              ? "linear-gradient(to bottom, transparent 0%, transparent 38%, black 50%)"
              : undefined,
          WebkitMaskImage:
            isMobile && stage === 4 && !isFifthLayer && !isSixthLayer
              ? "linear-gradient(to bottom, transparent 0%, transparent 38%, black 50%)"
              : undefined,
        }}
      >
        <NinghuiScene
          hideFortuneTube={stage !== 4}
          fortuneIdleBaseX={tubeIdleX}
          fortuneIdleBaseY={tubeIdleY}
          fortuneIdleScale={tubeIdleScale}
          onReady={reportSceneReady}
          onProgress={reportSceneProgress}
          onJiaoActiveChange={setIsJiaoActive}
          onSixthLayerChange={setIsSixthLayer}
          onFifthLayerChange={setIsFifthLayer}
        />
      </div>

      {/* 第一階段：標題動畫 */}
      {readyToEnter && stage === 1 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1200,
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(34px, 11vw, 150px)",
              letterSpacing: "0.2em",
              lineHeight: "normal",
              textAlign: "center",
              color: "rgba(255,255,255,0.72)",
              fontFamily: 'MoeLI, "Noto Serif TC", serif',
              fontWeight: 400,
              textShadow: "0 4px 24px rgba(0,0,0,0.2)",
              transform: nameAnimPhase === "pre" ? "translateY(42%)" : "translateY(4%)",
              opacity: nameAnimPhase === "pre" || nameAnimPhase === "exit" ? 0 : 1,
              transition:
                nameAnimPhase === "pre"
                  ? "none"
                  : nameAnimPhase === "enter"
                  ? "transform 900ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity 200ms linear"
                  : "opacity 650ms ease, transform 650ms ease",
            }}
          >
            方壺解疑
          </h1>
        </div>
      )}

      {/* 第二階段：簡介卡 */}
      {readyToEnter && stage === 2 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1200,
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {/* 內層 flex 置中：minHeight 確保短內容仍置中，長內容可從頂部正常捲動 */}
          <div
            style={{
              minHeight: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: isMobile ? "4vw" : 20,
            }}
          >
          <section
            style={{
              width: "100%",
              maxWidth: 920,
              borderRadius: 28,
              background: "rgba(255,255,255,0.85)",
              padding: isMobile ? "16px" : isNarrowLayout ? "20px" : "32px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.28)",
              backdropFilter: "blur(6px)",
              color: "#334155",
              fontFamily: '"Noto Serif TC", serif',
            }}
          >
            <p style={{ margin: "0 0 8px", color: "#64748b", letterSpacing: "0.12em", fontSize: isMobile ? 12 : 14 }}>
              那座空島的場外應援
            </p>
            <h2 style={{ margin: "0 0 12px", color: "#0f172a", fontSize: isMobile ? 18 : "clamp(20px, 3vw, 28px)" }}>
              《遇事不決，方壺解決》
            </h2>
            <p style={{ margin: "0 0 20px", lineHeight: 1.9, fontSize: isMobile ? 14 : 18 }}>
              遇事徬徨，可至下頁向方壺主神「南斗六司延壽星君」禀告，誦讀南斗寶誥後誠心發問，抽到給予詩籤，即是提醒。
            </p>
            <PrimaryButton onClick={toStage3} style={{ fontSize: isMobile ? 14 : 18, padding: isMobile ? "10px 24px" : "12px 36px" }}>
              誠心祈求・星君慈悲
            </PrimaryButton>
          </section>
          </div>
        </div>
      )}

      {/* 第六層詩籤「神像同款」外框已改在 PoemCard 3D 內繪製；DOM 放 Canvas 下會被 WebGL 完全遮住故移除 */}

      {/* 手機 stage 4：神像卡獨立定位在頂端（不在 flex 流內）
          z=2000：高於背景與 3D canvas，但低於熱點標籤（z=3000） → 熱點永遠在最上層 */}
      {readyToEnter && isMobile && stage === 4 && (
        <div
          style={{
            position: "absolute",
            top: "calc(4vw + 20px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2000,
            pointerEvents: "none",
            opacity: isSixthLayer || isFifthLayer ? 0 : 1,
            transition: "opacity 0.5s ease",
          }}
        >
          <div
            style={{
              width: "min(52vw, 190px)",
              borderRadius: 28,
              background: "rgba(255,255,255,0.40)",
              boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
              backdropFilter: "blur(6px)",
              padding: 8,
            }}
          >
            <img
              src="/intro/deity.jpg"
              alt="南斗星君"
              style={{
                width: "100%",
                borderRadius: 20,
                userSelect: "none",
                display: "block",
              }}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
        </div>
      )}

      {/* 第三、四階段（桌機 stage 4 / 全裝置 stage 3）：寶誥 + 星君圖 */}
      {readyToEnter && (stage === 3 || (stage === 4 && !isMobile)) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1200,
            overflowY: stage === 3 ? "auto" : "hidden",
            overflowX: "hidden",
            pointerEvents: stage === 4 ? "none" : "auto",
          }}
        >
          {/* 內層 flex 置中：長內容可從頂部正常捲動 */}
          <div
            style={{
              minHeight: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: isMobile ? "4vw" : 16,
              gap: stage === 4 ? 20 : 0,
              pointerEvents: stage === 4 ? "none" : "auto",
            }}
          >
          <section
            style={{
              width: stage === 4
                ? "min(92vw, 420px)"
                : isMobile ? "100%" : "min(92vw, 880px)",
              minHeight: "auto",
              borderRadius: 28,
              background: stage === 4 ? "rgba(255,255,255,0.40)" : "rgba(255,255,255,0.82)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.28)",
              backdropFilter: "blur(6px)",
              color: "#334155",
              fontFamily: '"Noto Serif TC", serif',
              pointerEvents: stage === 4 ? "none" : "auto",
              transform: stage === 4
                ? isJiaoActive ? "translateX(-250px)" : "translateX(-20px)"
                : undefined,
              opacity:
                isSixthLayer || (isFifthLayer && isMobile) ? 0 : 1,
              transition: "transform 0.45s ease, background 0.45s ease, opacity 0.5s ease",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  stage === 4 ? "1fr" : isNarrowLayout ? "1fr" : "minmax(280px, 340px) 1fr",
                alignItems: "center",
                gap: isNarrowLayout ? (isMobile ? 12 : 20) : 36,
                padding: stage === 4
                  ? 28
                  : isNarrowLayout
                  ? (isMobile ? "20px 10px" : 20)
                  : 36,
                minHeight: "auto",
              }}
            >
              <div>
                <img
                  src="/intro/deity.jpg"
                  alt="南斗星君"
                  style={{
                    width: "100%",
                    maxWidth: isMobile ? 300 : 360,
                    margin: "0 auto",
                    borderRadius: 26,
                    boxShadow: isMobile ? "0 6px 16px rgba(0,0,0,0.18)" : "0 18px 50px rgba(0,0,0,0.28)",
                    userSelect: "none",
                    display: "block",
                  }}
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                />
              </div>

              {stage === 3 && (
                <div style={
                  isNarrowLayout
                    ? {
                        maxWidth: isMobile ? 300 : 360,
                        margin: "0 auto",
                        padding: "6px 0 0 0",
                        width: "100%",
                      }
                    : { padding: "8px 24px 0 24px" }
                }>
                  <h3 style={{ margin: "0 0 12px", color: "#0f172a", fontSize: isMobile ? 18 : "clamp(20px, 3vw, 30px)" }}>
                    《南斗寶誥》
                  </h3>
                  <div style={isNarrowLayout ? { paddingLeft: 10 } : undefined}>
                    <p style={{ margin: "0 0 10px", lineHeight: 1.9, fontSize: isMobile ? 13 : 18 }}>
                      斗臨箕尾，旋六曜以經天；<br />
                      位正丑宮，總七星而御世。
                    </p>
                    <p style={{ margin: "0 0 10px", lineHeight: 1.9, fontSize: isMobile ? 13 : 18 }}>
                      同陽德輝華於兩極，運陰精覆育於群倫，<br />
                      ，赫赫丹靈而變體。
                    </p>
                    <p style={{ margin: "0 0 10px", lineHeight: 1.9, fontSize: isMobile ? 13 : 18 }}>
                      陶鎔品彙，當萬物相應於離宮；<br />
                      鼓鑄生成，保億劫無窮之天運。
                    </p>
                    <p style={{ margin: "0 0 20px", lineHeight: 1.9, fontSize: isMobile ? 13 : 18 }}>
                      大悲大願、大聖大慈，南斗六司延壽星君。
                    </p>
                  </div>
                  <PrimaryButton onClick={toStage4} style={{ fontSize: isMobile ? 14 : 18, padding: isMobile ? "10px 28px" : "12px 42px" }}>
                    心誠則靈
                  </PrimaryButton>
                </div>
              )}
            </div>
          </section>

          {/* 桌機 stage 4：右側空白讓位給 3D 籤筒 */}
          {stage === 4 && (
            <div
              style={{
                width: "min(42vw, 460px)",
                minHeight: "min(72dvh, 560px)",
                background: "transparent",
                pointerEvents: "none",
                flexShrink: 0,
              }}
            />
          )}
          </div>
        </div>
      )}
    </main>
  );
}
