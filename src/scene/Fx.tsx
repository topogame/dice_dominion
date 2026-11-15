import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { fx, useGame } from '../state/game';
import { cellToWorld } from '../theme';

const RINGS = 16;
const RING_LIFE = 0.5;
const EMITTERS = 6;
const PARTICLES = 72;
const STARS = 3;
const STAR_LIFE = 0.28;
const LABELS = 5;
const LABEL_LIFE = 1.3;

const ringGeo = new THREE.RingGeometry(0.3, 0.42, 28).rotateX(-Math.PI / 2);

/** A four-pointed flash with a soft core, used where a blow lands. */
function starTexture(): THREE.CanvasTexture {
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const glow = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, S, S);
  ctx.translate(S / 2, S / 2);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 4);
    const reach = i % 2 === 0 ? S * 0.48 : S * 0.3;
    ctx.beginPath();
    ctx.moveTo(0, -reach);
    ctx.lineTo(S * 0.035, 0);
    ctx.lineTo(0, reach);
    ctx.lineTo(-S * 0.035, 0);
    ctx.closePath();
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

const LABEL_W = 512;
const LABEL_H = 128;
const WHITE = new THREE.Color('#ffffff');

/** Short-lived effects: dust rings, particle bursts, impact flashes and floating words. */
export function Effects() {
  const clock = useRef(0);

  // Landing dust rings
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const ringStart = useRef(new Float32Array(RINGS).fill(-10));
  const nextRing = useRef(0);
  const ringMats = useMemo(
    () =>
      Array.from(
        { length: RINGS },
        () => new THREE.MeshBasicMaterial({ color: '#fff3d0', transparent: true, opacity: 0, depthWrite: false }),
      ),
    [],
  );

  // Particle bursts
  const emitters = useMemo(
    () =>
      Array.from({ length: EMITTERS }, () => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PARTICLES * 3), 3));
        geometry.setDrawRange(0, 0);
        const material = new THREE.PointsMaterial({
          size: 0.15,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        });
        return { geometry, material, velocity: new Float32Array(PARTICLES * 3), t0: -10, life: 1 };
      }),
    [],
  );
  const nextEmitter = useRef(0);

  // Impact flashes
  const stars = useRef<(THREE.Sprite | null)[]>([]);
  const starStart = useRef(new Float32Array(STARS).fill(-10));
  const nextStar = useRef(0);
  const starMats = useMemo(() => {
    const map = starTexture();
    return Array.from(
      { length: STARS },
      () =>
        new THREE.SpriteMaterial({
          map,
          color: new THREE.Color(2.6, 2.2, 1.3),
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
    );
  }, []);

  // Floating words
  const labels = useRef<(THREE.Sprite | null)[]>([]);
  const labelState = useRef(Array.from({ length: LABELS }, () => ({ t0: -10, y: 0 })));
  const nextLabel = useRef(0);
  const labelMats = useMemo(
    () =>
      Array.from({ length: LABELS }, () => {
        const canvas = document.createElement('canvas');
        canvas.width = LABEL_W;
        canvas.height = LABEL_H;
        const map = new THREE.CanvasTexture(canvas);
        map.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.SpriteMaterial({
          map,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: false,
        });
        return { canvas, map, material };
      }),
    [],
  );

  useEffect(
    () =>
      fx.on((e) => {
        const t = clock.current;
        if (e.type === 'land') {
          const i = nextRing.current++ % RINGS;
          const mesh = rings.current[i];
          if (!mesh) return;
          const [wx, wz] = cellToWorld(e.x, e.y);
          mesh.position.set(wx, 0.03, wz);
          ringMats[i].color.set(e.color).lerp(WHITE, 0.7);
          ringStart.current[i] = t;
        } else if (e.type === 'burst') {
          const em = emitters[nextEmitter.current++ % EMITTERS];
          const n = Math.min(PARTICLES, e.count);
          const pos = em.geometry.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < n; i++) {
            pos.setXYZ(i, e.at[0], e.at[1], e.at[2]);
            const angle = Math.random() * Math.PI * 2;
            const speed = e.speed * (0.35 + Math.random() * 0.65);
            em.velocity[i * 3] = Math.cos(angle) * speed;
            em.velocity[i * 3 + 1] = e.lift * (0.45 + Math.random() * 0.55);
            em.velocity[i * 3 + 2] = Math.sin(angle) * speed;
          }
          pos.needsUpdate = true;
          em.geometry.setDrawRange(0, n);
          // Lifted above 1 so the sparks pick up bloom.
          em.material.color.set(e.color).multiplyScalar(2.2);
          em.t0 = t;
          em.life = e.life;
        } else if (e.type === 'clash') {
          const i = nextStar.current++ % STARS;
          const sprite = stars.current[i];
          if (!sprite) return;
          sprite.position.set(...e.at);
          starMats[i].rotation = Math.random() * Math.PI;
          starStart.current[i] = t;
        } else if (e.type === 'text') {
          const i = nextLabel.current++ % LABELS;
          const sprite = labels.current[i];
          if (!sprite) return;
          const { canvas, map } = labelMats[i];
          const ctx = canvas.getContext('2d')!;
          ctx.clearRect(0, 0, LABEL_W, LABEL_H);
          ctx.font = '84px "IM Fell English SC", Georgia, serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineJoin = 'round';
          ctx.lineWidth = 14;
          ctx.strokeStyle = 'rgba(26,14,5,0.92)';
          ctx.strokeText(e.text, LABEL_W / 2, LABEL_H / 2 + 4);
          ctx.fillStyle = e.color;
          ctx.fillText(e.text, LABEL_W / 2, LABEL_H / 2 + 4);
          map.needsUpdate = true;
          sprite.position.set(...e.at);
          labelState.current[i] = { t0: t, y: e.at[1] };
        }
      }),
    [ringMats, emitters, starMats, labelMats],
  );

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    clock.current = t;

    rings.current.forEach((mesh, i) => {
      if (!mesh) return;
      const k = (t - ringStart.current[i]) / RING_LIFE;
      mesh.visible = k >= 0 && k < 1;
      if (!mesh.visible) return;
      mesh.scale.setScalar(0.7 + k * 1.5);
      ringMats[i].opacity = 0.6 * (1 - k) * (1 - k);
    });

    for (const em of emitters) {
      const k = (t - em.t0) / em.life;
      if (k < 0 || k >= 1) {
        em.material.opacity = 0;
        continue;
      }
      const pos = em.geometry.attributes.position as THREE.BufferAttribute;
      const n = em.geometry.drawRange.count;
      for (let i = 0; i < n; i++) {
        em.velocity[i * 3 + 1] -= 6.5 * delta;
        pos.setXYZ(
          i,
          pos.getX(i) + em.velocity[i * 3] * delta,
          pos.getY(i) + em.velocity[i * 3 + 1] * delta,
          pos.getZ(i) + em.velocity[i * 3 + 2] * delta,
        );
      }
      pos.needsUpdate = true;
      em.material.opacity = 1 - k * k;
    }

    stars.current.forEach((sprite, i) => {
      if (!sprite) return;
      const k = (t - starStart.current[i]) / STAR_LIFE;
      sprite.visible = k >= 0 && k < 1;
      if (!sprite.visible) return;
      sprite.scale.setScalar(0.6 + k * 2.2);
      starMats[i].opacity = 1 - k * k;
    });

    labels.current.forEach((sprite, i) => {
      if (!sprite) return;
      const st = labelState.current[i];
      const k = (t - st.t0) / LABEL_LIFE;
      sprite.visible = k >= 0 && k < 1;
      if (!sprite.visible) return;
      // Pop in, drift upwards, fade out over the last third.
      const pop = Math.min(1, k * 7);
      sprite.position.y = st.y + (1 - (1 - k) * (1 - k)) * 1.1;
      sprite.scale.set(3 * pop, 0.75 * pop, 1);
      labelMats[i].material.opacity = k < 0.66 ? 1 : 1 - (k - 0.66) / 0.34;
    });
  });

  return (
    <group>
      {ringMats.map((material, i) => (
        <mesh
          key={i}
          ref={(m) => {
            rings.current[i] = m;
          }}
          geometry={ringGeo}
          material={material}
          visible={false}
          renderOrder={4}
        />
      ))}
      {emitters.map((em, i) => (
        <points key={i} geometry={em.geometry} material={em.material} frustumCulled={false} />
      ))}
      {starMats.map((material, i) => (
        <sprite
          key={i}
          ref={(m) => {
            stars.current[i] = m;
          }}
          material={material}
          visible={false}
          renderOrder={30}
        />
      ))}
      {labelMats.map((l, i) => (
        <sprite
          key={i}
          ref={(m) => {
            labels.current[i] = m;
          }}
          material={l.material}
          visible={false}
          renderOrder={31}
        />
      ))}
    </group>
  );
}

/** Nudges the whole world when something heavy lands, instead of fighting the camera controls. */
export function Shaker({ target }: { target: RefObject<THREE.Group | null> }) {
  const energy = useRef(0);

  useEffect(
    () =>
      fx.on((e) => {
        // Only the big die shakes the table; the clash of a fight does that for the small ones.
        const jolt = e.type === 'shake' || (e.type === 'diceLand' && e.main);
        if (jolt) energy.current = Math.max(energy.current, e.strength);
      }),
    [],
  );

  useFrame((state, delta) => {
    const g = target.current;
    if (!g) return;
    energy.current = Math.max(0, energy.current - delta * 3.2);
    const e = energy.current * energy.current;
    const t = state.clock.elapsedTime;
    g.position.set(Math.sin(t * 61) * 0.05 * e, Math.sin(t * 47) * 0.09 * e, Math.cos(t * 53) * 0.04 * e);
  });

  return null;
}

// ── Treasure braziers ──────────────────────────────────────────────────
// Each bonus on the board burns in a stone brazier; taking the tile takes the prize.
const brazierStone = new THREE.MeshStandardMaterial({ color: '#9a9aa2', roughness: 0.9, flatShading: true });
const brazierBowl = new THREE.MeshStandardMaterial({ color: '#6f6f78', roughness: 0.85, flatShading: true });
// Brighter than white, so the bloom pass turns the embers into light.
const emberMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.5, 0.35), toneMapped: false });
const pedestalGeo = new THREE.CylinderGeometry(0.17, 0.25, 0.36, 8);
const bowlGeo = new THREE.CylinderGeometry(0.29, 0.18, 0.13, 8);
const emberGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.02, 8);

/** A teardrop of fire on a transparent ground, for the flame sprites. */
function flameTexture(): THREE.CanvasTexture {
  const W = 128;
  const H = 192;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(W / 2, H * 0.7, 0, W / 2, H * 0.62, W * 0.52);
  g.addColorStop(0, 'rgba(255,255,235,1)');
  g.addColorStop(0.3, 'rgba(255,205,95,0.95)');
  g.addColorStop(0.7, 'rgba(255,115,25,0.5)');
  g.addColorStop(1, 'rgba(255,60,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(W / 2, H * 0.03);
  ctx.bezierCurveTo(W * 0.8, H * 0.4, W * 0.97, H * 0.63, W / 2, H * 0.98);
  ctx.bezierCurveTo(W * 0.03, H * 0.63, W * 0.2, H * 0.4, W / 2, H * 0.03);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
let flameCache: THREE.CanvasTexture | null = null;

function Chest({ x, y }: { x: number; y: number }) {
  const flames = useRef<THREE.Group>(null!);
  const light = useRef<THREE.PointLight>(null!);
  const [wx, wz] = cellToWorld(x, y);
  const phase = x * 0.7 + y * 1.3;
  const flame = (flameCache ??= flameTexture());

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Two tongues of flame that lick and lean out of step with each other.
    flames.current.children.forEach((sprite, i) => {
      const lick = Math.sin(t * (9 + i * 4) + phase * (i + 1)) * 0.5 + Math.sin(t * (17 + i * 3) + phase) * 0.5;
      const size = i === 0 ? 0.62 : 0.4;
      sprite.scale.set(size * (0.82 + lick * 0.08), size * 1.5 * (1 + lick * 0.14), 1);
      sprite.position.x = Math.sin(t * 5 + phase + i) * 0.025;
    });
    light.current.intensity = 3.4 + Math.sin(t * 11 + phase) * 0.5 + Math.sin(t * 23 + phase * 2) * 0.3;
  });

  return (
    <group position={[wx, 0, wz]}>
      <mesh geometry={pedestalGeo} material={brazierStone} position={[0, 0.18, 0]} castShadow receiveShadow />
      <mesh geometry={bowlGeo} material={brazierBowl} position={[0, 0.42, 0]} castShadow />
      <mesh geometry={emberGeo} material={emberMat} position={[0, 0.49, 0]} />
      <group ref={flames} position={[0, 0.5, 0]}>
        {[0, 1].map((i) => (
          <sprite key={i} center={[0.5, 0.05]}>
            <spriteMaterial
              map={flame}
              color={i === 0 ? '#ffb060' : '#fff3c4'}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
              fog={false}
            />
          </sprite>
        ))}
      </group>
      <pointLight ref={light} color="#ffae52" distance={4.5} decay={1.6} position={[0, 0.9, 0]} />
    </group>
  );
}

export function Chests() {
  const gs = useGame((s) => s.gs);
  useGame((s) => s.version);
  return (
    <>
      {gs.chests
        .filter((c) => !c.isCollected)
        .map((c) => (
          <Chest key={`${c.x},${c.y}`} x={c.x} y={c.y} />
        ))}
    </>
  );
}
