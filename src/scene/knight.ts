import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import type { PlayerColor } from '../types/GameTypes';
import { modelUrl } from './models';

const KNIGHT_URL = modelUrl('knight.glb');

/** The model is about 2.3 units tall; this brings it to a little under one tile. */
export const KNIGHT_SCALE = 0.37;

export const TEAMS: PlayerColor[] = ['blue', 'yellow', 'green', 'red'];

/** Hue of each kingdom's cloth, in degrees. The model ships in red. */
const TEAM_HUE: Record<PlayerColor, number> = { blue: 216, yellow: 46, green: 128, red: 357 };
const SOURCE_HUE = 357;

// The knight is textured from a palette of 8x4 gradient swatches.
/** The red of the cape and tunic: turned to the team's hue, shading kept. */
const CLOTH_SWATCHES: [column: number, row: number][] = [
  [0, 1],
  [2, 2],
];
/**
 * The brown of the shield rim and sword grip: painted in the team's colour as
 * well, because the cape is hidden when the knight is seen from the front.
 */
const TRIM_SWATCHES: [column: number, row: number][] = [
  [5, 1],
  [6, 1],
];

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

/** A copy of the knight's palette with the cloth swatches turned to the team's hue. */
function teamPalette(source: THREE.Texture, team: PlayerColor): THREE.CanvasTexture {
  const SIZE = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source.image as CanvasImageSource, 0, 0, SIZE, SIZE);

  const cw = SIZE / 8;
  const ch = SIZE / 4;
  const repaint = (col: number, row: number, recolor: (h: number, s: number, l: number) => [number, number, number]) => {
    const img = ctx.getImageData(col * cw, row * ch, cw, ch);
    const px = img.data;
    for (let i = 0; i < px.length; i += 4) {
      const [h, s, l] = recolor(...rgbToHsl(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255));
      const [r, g, b] = hslToRgb(h, s, l);
      px[i] = Math.round(r * 255);
      px[i + 1] = Math.round(g * 255);
      px[i + 2] = Math.round(b * 255);
    }
    ctx.putImageData(img, col * cw, row * ch);
  };
  // Yellow has to be lighter than the red it replaces to read as yellow.
  const lift = (l: number) => (team === 'yellow' ? Math.min(0.92, l * 1.12 + 0.03) : l);

  if (team !== 'red') {
    for (const [col, row] of CLOTH_SWATCHES) {
      repaint(col, row, (h, s, l) => {
        // Keep each pixel's offset from the base red, so the gradient survives.
        let offset = h - SOURCE_HUE;
        if (offset > 180) offset -= 360;
        if (offset < -180) offset += 360;
        return [(TEAM_HUE[team] + offset * 0.5 + 360) % 360, s, lift(l)];
      });
    }
  }
  for (const [col, row] of TRIM_SWATCHES) {
    repaint(col, row, (_h, s, l) => [TEAM_HUE[team], Math.max(s, 0.72), lift(l)]);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // glTF textures are stored top row first.
  texture.flipY = false;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

const p = new THREE.Vector3();
const q = new THREE.Vector3();

/**
 * Freezes one moment of an animation into plain geometry, so a whole army
 * can be drawn with instancing instead of one skeleton per soldier.
 */
function bakePose(source: THREE.Object3D, clip: THREE.AnimationClip, time: number): THREE.BufferGeometry {
  const root = cloneSkinned(source);
  const mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(clip).play();
  mixer.setTime(time);
  root.updateMatrixWorld(true);

  const pieces: THREE.BufferGeometry[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const skinned = (o as THREE.SkinnedMesh).isSkinnedMesh ? (o as THREE.SkinnedMesh) : null;
    skinned?.skeleton.update();

    const src = mesh.geometry;
    const position = src.attributes.position;
    const normal = src.attributes.normal;
    const outPos = new Float32Array(position.count * 3);
    const outNor = new Float32Array(position.count * 3);

    for (let i = 0; i < position.count; i++) {
      // Carry the normal along by posing a second point a hair above the surface.
      p.fromBufferAttribute(position, i);
      q.fromBufferAttribute(normal, i).multiplyScalar(0.01).add(p);
      if (skinned) {
        skinned.applyBoneTransform(i, p);
        skinned.applyBoneTransform(i, q);
      }
      p.applyMatrix4(mesh.matrixWorld);
      q.applyMatrix4(mesh.matrixWorld).sub(p).normalize();
      outPos.set([p.x, p.y, p.z], i * 3);
      outNor.set([q.x, q.y, q.z], i * 3);
    }

    const piece = new THREE.BufferGeometry();
    piece.setAttribute('position', new THREE.BufferAttribute(outPos, 3));
    piece.setAttribute('normal', new THREE.BufferAttribute(outNor, 3));
    piece.setAttribute('uv', src.attributes.uv.clone());
    piece.setIndex(src.index ? src.index.clone() : [...Array(position.count).keys()]);
    pieces.push(piece);
  });

  const merged = mergeGeometries(pieces, false);
  if (!merged) throw new Error('Could not merge the knight geometry');
  merged.computeBoundingSphere();
  return merged;
}

export interface Knight {
  /** The idle stance as static geometry, for instanced crowds. */
  idle: THREE.BufferGeometry;
  materials: Record<PlayerColor, THREE.MeshStandardMaterial>;
  clips: Map<string, THREE.AnimationClip>;
  /** A fresh, independently animated copy; dress it with `dress` before showing it. */
  spawn: () => THREE.Object3D;
  /** Puts a team's colours on an animated copy. */
  dress: (figure: THREE.Object3D, team: PlayerColor) => void;
}

export function useKnight(): Knight {
  const gltf = useGLTF(KNIGHT_URL);

  return useMemo(() => {
    let base: THREE.MeshStandardMaterial | undefined;
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        base ??= mesh.material as THREE.MeshStandardMaterial;
        mesh.castShadow = true;
      }
    });
    if (!base?.map) throw new Error('The knight model has no palette texture');

    const materials = {} as Record<PlayerColor, THREE.MeshStandardMaterial>;
    for (const team of TEAMS) {
      const material = base.clone();
      material.map = teamPalette(base.map, team);
      material.metalness = 0;
      material.roughness = 0.75;
      material.color.setScalar(1.15);
      materials[team] = material;
    }

    const clips = new Map(gltf.animations.map((clip) => [clip.name, clip]));
    const idleClip = clips.get('Idle');
    if (!idleClip) throw new Error('The knight model has no Idle animation');

    return {
      idle: bakePose(gltf.scene, idleClip, 0.4),
      materials,
      clips,
      spawn: () => {
        const copy = cloneSkinned(gltf.scene);
        copy.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            // Skinned meshes are culled by their bind-pose bounds, which are wrong once posed.
            mesh.frustumCulled = false;
          }
        });
        return copy;
      },
      dress: (figure, team) => {
        figure.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) mesh.material = materials[team];
        });
      },
    };
  }, [gltf]);
}

useGLTF.preload(KNIGHT_URL);
