import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Models come from the KayKit packs by Kay Lousberg (CC0); see
 * public/models/CREDITS.txt. scripts/prepare-models.mjs puts them there.
 */
export const modelUrl = (name: string) => `${import.meta.env.BASE_URL}models/${name}`;

// Every scenery model samples the same small gradient atlas. The loader builds
// a separate material and texture for each file, so the first one loaded is
// kept and reused, and only one copy of the atlas reaches the GPU.
let atlasMaterial: THREE.MeshStandardMaterial | null = null;

function sharedAtlasMaterial(from: THREE.Material): THREE.MeshStandardMaterial {
  if (!atlasMaterial) {
    atlasMaterial = (from as THREE.MeshStandardMaterial).clone();
    atlasMaterial.metalness = 0;
    atlasMaterial.roughness = 0.82;
    // The atlas is painted for a brighter rig than this scene's; lift it a little.
    atlasMaterial.color.setScalar(1.18);
  }
  return atlasMaterial;
}

export interface SceneryModel {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  /** Size of the model in its own units. */
  size: THREE.Vector3;
}

/** Loads a single-mesh scenery model such as a castle, a tree or a rock. */
export function useSceneryModel(name: string): SceneryModel {
  const gltf = useGLTF(modelUrl(`${name}.gltf`));
  return useMemo(() => {
    let mesh: THREE.Mesh | undefined;
    gltf.scene.traverse((o) => {
      if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
    });
    if (!mesh) throw new Error(`Model ${name} has no mesh`);
    const geometry = mesh.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    return {
      geometry,
      material: sharedAtlasMaterial(mesh.material as THREE.Material),
      size: geometry.boundingBox!.getSize(new THREE.Vector3()),
    };
  }, [gltf, name]);
}
