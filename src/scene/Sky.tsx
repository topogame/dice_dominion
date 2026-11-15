import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { mulberry32 } from '../theme';
import { useView } from './view';

/** The painted sky behind everything: clouds and far-off islands round an empty middle. */
const BACKDROP = `${import.meta.env.BASE_URL}backdrop/sky.webp`;
/** Share of the picture on screen; the rest is slack for it to slide in as the map is dragged. */
const ZOOM = 0.9;
/** How far the picture slides per tile the map is dragged: far less than the island moves. */
const SLIDE = 0.0035;

/** A puffy cloud painted on a canvas: lit from above, blue in its underside. */
export function cloudTexture(seed: number): THREE.CanvasTexture {
  const W = 512;
  const H = 320;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const rng = mulberry32(seed);

  // A heap of soft discs, wider at the bottom, makes the cumulus outline.
  for (let i = 0; i < 34; i++) {
    const t = rng();
    const x = W * (0.16 + 0.68 * rng());
    const y = H * (0.34 + 0.4 * t);
    const r = (36 + rng() * 54) * (0.65 + 0.5 * t);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Shade it: bright on top, dusky blue underneath.
  ctx.globalCompositeOperation = 'source-atop';
  const shade = ctx.createLinearGradient(0, H * 0.15, 0, H * 0.95);
  shade.addColorStop(0, 'rgba(255,255,255,0)');
  shade.addColorStop(0.55, 'rgba(126,150,214,0.5)');
  shade.addColorStop(1, 'rgba(52,70,140,0.85)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface CloudSpot {
  /** Across the screen and away from the camera, in landscape units. */
  u: number;
  v: number;
  y: number;
  size: number;
  speed: number;
}

// A few banks of cloud close under the island, between it and the painted
// sky, so its cliffs sink into them. All sit well below the board.
const CLOUD_SPOTS: CloudSpot[] = [
  { u: -25, v: 3, y: -7, size: 15, speed: 0.22 },
  { u: 25, v: 2, y: -7.5, size: 16, speed: 0.18 },
  { u: -19, v: -8, y: -10, size: 16, speed: 0.2 },
  { u: 20, v: -9, y: -10.5, size: 17, speed: 0.17 },
  { u: -7, v: -13, y: -12.5, size: 17, speed: 0.15 },
  { u: 8, v: -14, y: -13, size: 18, speed: 0.19 },
];

export function Sky() {
  const view = useView();
  const scene = useThree((s) => s.scene);
  const backdrop = useTexture(BACKDROP);

  useEffect(() => {
    backdrop.colorSpace = THREE.SRGBColorSpace;
    backdrop.wrapS = backdrop.wrapT = THREE.ClampToEdgeWrapping;
    backdrop.needsUpdate = true;
    scene.background = backdrop;
    // The colour grading after tone mapping darkens it; this puts the light back.
    scene.backgroundIntensity = 1.25;
    return () => {
      scene.background = null;
    };
  }, [scene, backdrop]);

  const textures = useMemo(() => [cloudTexture(3), cloudTexture(11), cloudTexture(29)], []);
  const group = useRef<THREE.Group>(null!);

  const clouds = useMemo(() => {
    const portrait = view === 'portrait';
    return CLOUD_SPOTS.map((c) => {
      // The island is narrower and deeper on screen in portrait.
      const u = c.u * (portrait ? 0.6 : 1);
      const v = c.v * (portrait ? 1.6 : 1);
      return { ...c, x: portrait ? v : u, z: portrait ? u : -v, sway: portrait ? 'z' : 'x' } as const;
    });
  }, [view]);

  useFrame((state) => {
    // Fill the screen with the picture whatever its shape, cropping the overflow.
    const image = backdrop.image as { width: number; height: number };
    const imageAspect = image.width / image.height;
    const aspect = state.size.width / state.size.height;
    let rx = ZOOM;
    let ry = ZOOM;
    if (aspect > imageAspect) ry *= imageAspect / aspect;
    else rx *= aspect / imageAspect;

    // Slide it a little against the map as the player drags, which sets the
    // island in front of the sky rather than on it.
    const target = (state.controls as unknown as { target?: THREE.Vector3 } | null)?.target;
    const across = target ? (view === 'portrait' ? target.z : target.x) : 0;
    const away = target ? (view === 'portrait' ? target.x : -target.z) : 0;
    const sx = THREE.MathUtils.clamp(across * SLIDE, -(1 - rx) / 2, (1 - rx) / 2);
    const sy = THREE.MathUtils.clamp(away * SLIDE, -(1 - ry) / 2, (1 - ry) / 2);
    backdrop.repeat.set(rx, ry);
    backdrop.offset.set((1 - rx) / 2 + sx, (1 - ry) / 2 + sy);

    const t = state.clock.elapsedTime;
    group.current.children.forEach((sprite, i) => {
      const c = clouds[i];
      const drift = Math.sin(t * 0.3 * c.speed + i * 1.9) * 2.4;
      sprite.position.x = c.x + (c.sway === 'x' ? drift : 0);
      sprite.position.z = c.z + (c.sway === 'z' ? drift : 0);
      sprite.position.y = c.y + Math.sin(t * 0.25 + i) * 0.25;
    });
  });

  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <sprite key={i} position={[c.x, c.y, c.z]} scale={[c.size, c.size * 0.62, 1]}>
          <spriteMaterial
            map={textures[i % textures.length]}
            color="#dfe8ff"
            transparent
            opacity={0.9}
            depthWrite={false}
            fog={false}
          />
        </sprite>
      ))}
    </group>
  );
}
