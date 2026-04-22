"use client";

import React, { useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const GLB_URL = "/models/ninghui/fortune_set_v11.glb?v=1";

export type JiaoResultType = "聖杯" | "笑杯" | "陰杯" | null;

const JiaoPairFromGLB: React.FC<{ result: JiaoResultType }> = ({ result }) => {
  const gltf = useGLTF(GLB_URL);

  const { leftGroup, rightGroup, hasGLB } = React.useMemo(() => {
    let leftSrc: THREE.Object3D | null = gltf.scene.getObjectByName("Jiao_01_L") as THREE.Object3D | null;
    let rightSrc: THREE.Object3D | null = gltf.scene.getObjectByName("Jiao_01_R") as THREE.Object3D | null;
    if (!leftSrc || !rightSrc) {
      gltf.scene.traverse((obj) => {
        const p = obj.parent;
        if (!p?.name?.startsWith("Jiao_")) return;
        if (p.name === "Jiao_01_L") leftSrc = p;
        if (p.name === "Jiao_01_R") rightSrc = p;
      });
    }

    if (!leftSrc || !rightSrc) {
      const jiaoNames: string[] = [];
      gltf.scene.traverse((obj) => {
        if (obj.name && obj.name.includes("Jiao")) jiaoNames.push(obj.name);
      });
      console.warn(
        "[Ninghui] Jiao pair not found (Jiao_01_L / Jiao_01_R). Names containing 'Jiao':",
        [...new Set(jiaoNames)],
        "→ using placeholder."
      );
      return { leftGroup: new THREE.Group(), rightGroup: new THREE.Group(), hasGLB: false };
    }

    const leftClone = (leftSrc as THREE.Object3D).clone(true);
    const rightClone = (rightSrc as THREE.Object3D).clone(true);
    leftClone.position.set(0, 0, 0);
    rightClone.position.set(0, 0, 0);
    leftClone.rotation.set(0, 0, 0);
    rightClone.rotation.set(0, 0, 0);
    leftClone.scale.set(1, 1, 1);
    rightClone.scale.set(1, 1, 1);

    return { leftGroup: leftClone, rightGroup: rightClone, hasGLB: true };
  }, [gltf]);

  // 待機姿勢：兩顆筊合在一起，平面垂直、彎曲面朝上
  useEffect(() => {
    if (!hasGLB || result) return;
    const uprightZ = Math.PI / 2;
    const rightTiltX = (230 * Math.PI) / 180;
    leftGroup.position.set(0, 0, 0);
    rightGroup.position.set(0, 0, 0);
    leftGroup.rotation.set(0, 0, uprightZ);
    rightGroup.rotation.set(rightTiltX, Math.PI, uprightZ);
  }, [hasGLB, result, leftGroup, rightGroup]);

  // 落地姿勢：X 軸 0 / π 決定正反面
  useEffect(() => {
    if (!result || !hasGLB) return;
    leftGroup.position.set(-0.08, 0, 0);
    rightGroup.position.set(0.08, 0, 0);
    const flip = Math.PI;
    if (result === "陰杯") {
      leftGroup.rotation.set(0, 0, 0);
      rightGroup.rotation.set(0, 0, 0);
    } else if (result === "笑杯") {
      leftGroup.rotation.set(flip, 0, 0);
      rightGroup.rotation.set(flip, 0, 0);
    } else {
      // 聖杯：左 0、右 π
      leftGroup.rotation.set(0, 0, 0);
      rightGroup.rotation.set(flip, 0, 0);
    }
  }, [result, hasGLB, leftGroup, rightGroup]);

  if (hasGLB) {
    return (
      <>
        <group position={[-0.04, 0, 0]}>
          <primitive object={leftGroup} />
        </group>
        <group position={[0.04, 0, 0]}>
          <primitive object={rightGroup} />
        </group>
      </>
    );
  }

  // 找不到 GLB 時顯示簡化筊杯
  const r = result ? (result === "笑杯" ? Math.PI : 0) : Math.PI * 0.06;
  const zL = result === "聖杯" ? 0 : Math.PI * 0.16;
  const zR = result === "聖杯" ? Math.PI : -Math.PI * 0.16;
  return (
    <>
      <mesh position={[-1.6, 0, 0]} rotation={[r, 0, zL]}>
        <cylinderGeometry args={[0.1, 0.1, 0.12, 24, 1, true, 0, Math.PI]} />
        <meshStandardMaterial color="#facc6b" roughness={0.45} metalness={0.15} />
      </mesh>
      <mesh position={[1.6, 0, 0]} rotation={[r, 0, zR]}>
        <cylinderGeometry args={[0.1, 0.1, 0.12, 24, 1, true, 0, Math.PI]} />
        <meshStandardMaterial color="#facc6b" roughness={0.45} metalness={0.15} />
      </mesh>
    </>
  );
};

export { JiaoPairFromGLB };
