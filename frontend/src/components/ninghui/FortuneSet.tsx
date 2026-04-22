"use client";

import React, { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const GLB_URL = "/models/ninghui/fortune_set_v11.glb?v=1";

export type FortuneSetProps = {
  position?: [number, number, number];
  scale?: number;
  /** closeup 時用滑鼠左右搓籤：傳入 ref 會把籤束包成 group 並寫入此 ref */
  sticksGroupRef?: React.MutableRefObject<THREE.Group | null>;
  /** 第五層：要播放打開動畫的抽屜索引 0–49 */
  openDrawerIndex?: number | null;
  /** 第五層：要高亮提示的抽屜索引 */
  highlightDrawerIndex?: number | null;
  /** 點到任一抽屜時的回呼 */
  onDrawerClick?: (index: number) => void;
  /** 第五層：每個抽屜的實際角度（弧度），供外層做旋轉對齊 */
  drawerAnglesRef?: React.MutableRefObject<number[] | null>;
  /** 第六層：通知外層目前開啟抽屜的「抽屜口」世界座標 */
  onDrawerMouthWorldPositionChange?: (pos: THREE.Vector3 | null) => void;
};

type FortuneSetParts = {
  sticks: THREE.Mesh[];
  drawers: THREE.Mesh[];
  tubeBody: THREE.Object3D | null;
  colliderBody: THREE.Object3D | null;
  blocksByPair: Record<string, { left: THREE.Object3D[]; right: THREE.Object3D[] }>;
};

const FortuneSet: React.FC<FortuneSetProps> = ({
  position = [0, 0, 0],
  scale = 1,
  sticksGroupRef,
  openDrawerIndex = null,
  highlightDrawerIndex = null,
  onDrawerClick,
  drawerAnglesRef,
  onDrawerMouthWorldPositionChange,
}) => {
  const gltf = useGLTF(GLB_URL);
  const sceneClone = React.useMemo(() => gltf.scene.clone(true), [gltf]);

  const parts = React.useMemo<FortuneSetParts>(() => {
    const sticks: THREE.Mesh[] = [];
    const drawers: THREE.Mesh[] = [];
    let tubeBody: THREE.Object3D | null = null;
    let colliderBody: THREE.Object3D | null = null;
    const blocksByPair: Record<string, { left: THREE.Object3D[]; right: THREE.Object3D[] }> = {};

    sceneClone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      const name = mesh.name;

      if (mesh.isMesh && name.startsWith("Stick_")) sticks.push(mesh);
      if (mesh.isMesh && name.startsWith("Drawer_")) drawers.push(mesh);

      if (name === "MainBody" || name.startsWith("MainBody")) {
        if (!tubeBody || name.length > (tubeBody.name?.length ?? 0)) tubeBody = obj;
      }

      if (name === "Collider_Body") {
        colliderBody = obj;
      } else if (name === "Collider" && !colliderBody) {
        colliderBody = obj;
      }

      const parentName = obj.parent?.name ?? "";
      if (parentName.startsWith("Jiao_")) {
        const [, pairId, side] = parentName.split("_");
        if (!pairId || !side) return;
        if (!blocksByPair[pairId]) blocksByPair[pairId] = { left: [], right: [] };
        if (side === "L") blocksByPair[pairId].left.push(obj);
        if (side === "R") blocksByPair[pairId].right.push(obj);
      }
    });

    sticks.sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
    drawers.sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));

    return { sticks, drawers, tubeBody, colliderBody, blocksByPair };
  }, [sceneClone]);

  // closeup 搓籤：把全部籤包進一個 group，方便外層用滑鼠 X 驅動 rotation.y
  useEffect(() => {
    if (!sticksGroupRef || parts.sticks.length === 0) return;
    const first = parts.sticks[0];
    const originalParent = first.parent;
    if (!originalParent) return;
    const group = new THREE.Group();
    group.name = "SticksBundle";
    parts.sticks.forEach((stick) => {
      originalParent.remove(stick);
      group.add(stick);
    });
    originalParent.add(group);
    sticksGroupRef.current = group;
    return () => {
      if (sticksGroupRef.current !== group) return;
      const children = group.children.slice();
      originalParent.remove(group);
      children.forEach((child) => {
        group.remove(child);
        originalParent.add(child);
      });
      sticksGroupRef.current = null;
    };
  }, [sceneClone, parts.sticks.length, sticksGroupRef]);

  // 初始化：顯示筒身、隱藏碰撞體
  useEffect(() => {
    const toShow = parts.tubeBody;
    const toHide = parts.colliderBody;
    if (toShow) {
      toShow.visible = true;
      toShow.traverse((child) => { child.visible = true; });
    }
    if (toHide) {
      toHide.traverse((child) => { child.visible = false; });
      toHide.visible = false;
    }
  }, [sceneClone, parts]);

  // 計算每個抽屜的實際角度（弧度），寫入 drawerAnglesRef 供外層使用
  // 角度相對於 sceneClone 本地座標，與父層世界位置無關，useEffect 即可正確計算
  useEffect(() => {
    if (!drawerAnglesRef || parts.drawers.length === 0) return;
    sceneClone.updateMatrixWorld(true);
    const rootInv = new THREE.Matrix4().copy(sceneClone.matrixWorld).invert();
    drawerAnglesRef.current = parts.drawers.map((drawer) => {
      const pos = new THREE.Vector3()
        .setFromMatrixPosition(drawer.matrixWorld)
        .applyMatrix4(rootInv);
      return Math.atan2(pos.x, pos.z);
    });
  }, [sceneClone, parts, drawerAnglesRef]);

  const lastOpenIndexRef = React.useRef<number | null>(null);

  useFrame(({ clock }) => {
    if (openDrawerIndex != null && openDrawerIndex >= 0 && openDrawerIndex < parts.drawers.length) {
      lastOpenIndexRef.current = openDrawerIndex;
    }

    // 抽屜打開動畫：沿徑向方向拉出
    if (openDrawerIndex != null && openDrawerIndex >= 0 && openDrawerIndex < parts.drawers.length) {
      const drawer = parts.drawers[openDrawerIndex];
      if (drawer) {
        if (!drawer.userData._pullInited) {
          drawer.userData._pullInited = true;
          drawer.userData._restX = drawer.position.x;
          drawer.userData._restZ = drawer.position.z;
          sceneClone.updateMatrixWorld(true);
          const rootInv = new THREE.Matrix4().copy(sceneClone.matrixWorld).invert();
          const posInRoot = new THREE.Vector3()
            .setFromMatrixPosition(drawer.matrixWorld)
            .applyMatrix4(rootInv);
          const radLen = Math.sqrt(posInRoot.x ** 2 + posInRoot.z ** 2);
          const rdx = radLen > 0.001 ? posInRoot.x / radLen : 0;
          const rdz = radLen > 0.001 ? posInRoot.z / radLen : 1;
          if (drawer.parent) {
            const worldDir = new THREE.Vector3(rdx, 0, rdz).transformDirection(sceneClone.matrixWorld);
            const localDir = worldDir.transformDirection(
              new THREE.Matrix4().copy(drawer.parent.matrixWorld).invert()
            );
            drawer.userData._pullDirX = localDir.x;
            drawer.userData._pullDirZ = localDir.z;
          } else {
            drawer.userData._pullDirX = rdx;
            drawer.userData._pullDirZ = rdz;
          }
        }
        const restX = drawer.userData._restX as number;
        const restZ = drawer.userData._restZ as number;
        const pdx = drawer.userData._pullDirX as number;
        const pdz = drawer.userData._pullDirZ as number;
        const PULL_DIST = 0.6;
        drawer.position.x = THREE.MathUtils.lerp(drawer.position.x, restX + pdx * PULL_DIST, 0.18);
        drawer.position.z = THREE.MathUtils.lerp(drawer.position.z, restZ + pdz * PULL_DIST, 0.18);

        if (onDrawerMouthWorldPositionChange) {
          const worldPos = new THREE.Vector3();
          drawer.getWorldPosition(worldPos);
          worldPos.y += 1.2;
          onDrawerMouthWorldPositionChange(worldPos);
        }
      }
    }

    // 抽屜關閉動畫
    if (openDrawerIndex == null && lastOpenIndexRef.current != null) {
      const idx = lastOpenIndexRef.current;
      if (idx >= 0 && idx < parts.drawers.length) {
        const drawer = parts.drawers[idx];
        if (drawer && drawer.userData._pullInited) {
          const restX = drawer.userData._restX as number;
          const restZ = drawer.userData._restZ as number;
          drawer.position.x = THREE.MathUtils.lerp(drawer.position.x, restX, 0.24);
          drawer.position.z = THREE.MathUtils.lerp(drawer.position.z, restZ, 0.24);
          const dx = drawer.position.x - restX;
          const dz = drawer.position.z - restZ;
          if (Math.sqrt(dx * dx + dz * dz) < 0.002) {
            drawer.position.x = restX;
            drawer.position.z = restZ;
            drawer.userData._pullInited = false;
            lastOpenIndexRef.current = null;
            onDrawerMouthWorldPositionChange?.(null);
          }
        } else {
          lastOpenIndexRef.current = null;
        }
      } else {
        lastOpenIndexRef.current = null;
      }
    }

    // 抽屜高亮：金色脈動發光
    if (
      highlightDrawerIndex != null &&
      highlightDrawerIndex >= 0 &&
      highlightDrawerIndex < parts.drawers.length
    ) {
      const drawer = parts.drawers[highlightDrawerIndex];
      if (drawer && drawer.material) {
        if (!drawer.userData._highlightMatCloned && !Array.isArray(drawer.material)) {
          drawer.material = (drawer.material as THREE.MeshStandardMaterial).clone();
          drawer.userData._highlightMatCloned = true;
        }
        if (!Array.isArray(drawer.material)) {
          const mat = drawer.material as THREE.MeshStandardMaterial;
          const pulse = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 2.5);
          mat.emissive = mat.emissive || new THREE.Color();
          mat.emissive.setRGB(0.85 * pulse, 0.55 * pulse, 0.1 * pulse);
          mat.emissiveIntensity = 0.6 + 0.4 * pulse;
        }
      }
    } else {
      // 恢復所有被高亮的抽屜
      parts.drawers.forEach((drawer) => {
        if (!Array.isArray(drawer.material) && drawer.userData._highlightMatCloned) {
          const mat = drawer.material as THREE.MeshStandardMaterial;
          mat.emissive = mat.emissive || new THREE.Color();
          mat.emissive.setRGB(0, 0, 0);
          mat.emissiveIntensity = 0;
        }
      });
    }
  });

  return (
    <group position={position} scale={scale}>
      <primitive
        object={sceneClone}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (!onDrawerClick) return;
          e.stopPropagation();
          let obj: THREE.Object3D | null = e.object;
          while (obj && !obj.name.startsWith("Drawer_")) obj = obj.parent;
          if (!obj) return;
          const idx = parts.drawers.findIndex((d) => d === obj);
          if (idx >= 0) onDrawerClick(idx);
        }}
      />
    </group>
  );
};

// 預先載入 3D 模型
useGLTF.preload(GLB_URL);

export { FortuneSet };
