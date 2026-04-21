"use client";

import React from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const GLB_URL = "/models/ninghui/fortune_set_v11.glb?v=1";

/** 跟第 31 籤的角度一致，避免部分籤尾部破圖 */
const REF_STICK_ID = 31;
/** 以第 24 首為基準固定展示位置 */
const REF_STICK_POSITION_ID = 24;

function makeStickMaterialsOpaque(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.material) return;
    child.renderOrder = 2;
    const arr = Array.isArray(child.material) ? child.material : [child.material];
    const newMats = arr.map((m) => (m.clone ? m.clone() : m));
    newMats.forEach((mat) => {
      mat.depthWrite = true;
      mat.depthTest = true;
      mat.transparent = false;
      mat.opacity = 1;
      mat.alphaTest = 0.01;
      if ("polygonOffset" in mat) {
        (mat as THREE.Material).polygonOffset = true;
        (mat as THREE.Material).polygonOffsetFactor = 2;
        (mat as THREE.Material).polygonOffsetUnits = 2;
      }
    });
    child.material = newMats.length === 1 ? newMats[0] : newMats;
  });
}

const SingleStickFromGLB: React.FC<{ stickId: number }> = ({ stickId }) => {
  const gltf = useGLTF(GLB_URL);
  const stickClone = React.useMemo(() => {
    const name = `Stick_${String(stickId).padStart(2, "0")}`;
    const src = gltf.scene.getObjectByName(name) ?? gltf.scene.getObjectByName(`Stick_${stickId}`);
    if (!src) return null;
    const clone = src.clone(true);

    const refStick =
      gltf.scene.getObjectByName(`Stick_${String(REF_STICK_ID).padStart(2, "0")}`) ??
      gltf.scene.getObjectByName(`Stick_${REF_STICK_ID}`);
    if (refStick) {
      clone.quaternion.copy(refStick.quaternion);
      clone.rotation.order = refStick.rotation.order;
    }

    const refPos =
      gltf.scene.getObjectByName(`Stick_${String(REF_STICK_POSITION_ID).padStart(2, "0")}`) ??
      gltf.scene.getObjectByName(`Stick_${REF_STICK_POSITION_ID}`);
    if (refPos) {
      clone.position.copy(refPos.position);
      clone.scale.copy(refPos.scale);
    }

    makeStickMaterialsOpaque(clone);
    return clone;
  }, [gltf, stickId]);

  if (!stickClone) return null;
  return <primitive object={stickClone} />;
};

export { SingleStickFromGLB };
