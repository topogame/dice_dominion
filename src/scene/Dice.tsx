import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { fx, useGame, type DieId } from '../state/game';
import { COLS, ROWS } from '../theme';
import { useView, type View } from './view';

/** Height at which the golden die waits between throws. */
const HOVER_HEIGHT = 3.6;
/** Edge length of the waiting die, in tiles. */
const HOVER_SIZE = 2.15;

/**
 * Where the golden die waits: just beyond the far edge of the board as the
 * camera sees it, so it hangs over the trees and hides no tile worth tapping.
 */
function hoverSpot(view: View): [number, number] {
  return view === 'portrait' ? [COLS / 2 + 0.4, 0] : [0, -ROWS / 2 - 0.9];
}

/**
 * How high it waits. Lower on an upright phone, where it hangs between the
 * two far castles rather than above them, so it needs no sky of its own.
 */
const hoverHeight = (view: View) => (view === 'portrait' ? 2.3 : HOVER_HEIGHT);

// Landing times of the three bounces and the moment of rest, as fractions of a throw.
const T1 = 0.33;
const T2 = 0.6;
const T3 = 0.77;
const T_REST = 0.9;

// BoxGeometry face order is +X, -X, +Y, -Y, +Z, -Z. Opposite faces sum to 7.
const FACE_VALUES = [2, 5, 1, 6, 3, 4];

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.28, 0.23], [0.72, 0.23], [0.28, 0.5], [0.72, 0.5], [0.28, 0.77], [0.72, 0.77]],
};

/** Draws one die face: `glow` produces the emissive mask (bright pips on black). */
function faceTexture(value: number, glow: boolean): THREE.CanvasTexture {
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = glow ? '#000000' : '#ffffff';
  ctx.fillRect(0, 0, S, S);
  if (!glow) {
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, S - 28, S - 28);
  }
  for (const [px, py] of PIPS[value]) {
    ctx.beginPath();
    ctx.arc(px * S, py * S, glow ? 21 : 25, 0, Math.PI * 2);
    ctx.fillStyle = glow ? '#ffffff' : '#20140a';
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// The six face textures are identical for every die, so they are drawn once.
let faceCache: { map: THREE.CanvasTexture; glow: THREE.CanvasTexture }[] | null = null;
function faces() {
  faceCache ??= FACE_VALUES.map((v) => ({ map: faceTexture(v, false), glow: faceTexture(v, true) }));
  return faceCache;
}

/** Faces for the placement die: glowing gold with dark pips. */
function goldMaterials(): THREE.MeshStandardMaterial[] {
  return faces().map(
    (f) =>
      new THREE.MeshStandardMaterial({
        map: f.map,
        color: '#ffc74d',
        // The face texture doubles as the glow mask, so the pips stay dark.
        emissiveMap: f.map,
        emissive: new THREE.Color('#ff9a1c'),
        emissiveIntensity: 0.95,
        roughness: 0.28,
        metalness: 0.2,
      }),
  );
}

/** A soft round glow, drawn once and used as a sprite behind the waiting die. */
function glowTexture(): THREE.CanvasTexture {
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,236,170,1)');
  g.addColorStop(0.25, 'rgba(255,190,80,0.55)');
  g.addColorStop(0.6, 'rgba(255,150,40,0.16)');
  g.addColorStop(1, 'rgba(255,140,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Orientation that turns the face showing `value` towards +Y. */
function faceUp(value: number): THREE.Quaternion {
  const e = new THREE.Euler();
  switch (value) {
    case 2: e.set(0, 0, Math.PI / 2); break;
    case 5: e.set(0, 0, -Math.PI / 2); break;
    case 3: e.set(-Math.PI / 2, 0, 0); break;
    case 4: e.set(Math.PI / 2, 0, 0); break;
    case 6: e.set(Math.PI, 0, 0); break;
    default: e.set(0, 0, 0);
  }
  return new THREE.Quaternion().setFromEuler(e);
}

const runeFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uAlpha;
  uniform float uPulse;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float a = atan(p.y, p.x);
    float ring1 = 1.0 - smoothstep(0.0, 0.03, abs(r - 0.86));
    float ring2 = 1.0 - smoothstep(0.0, 0.02, abs(r - 0.6));
    float dashes = (1.0 - smoothstep(0.0, 0.05, abs(r - 0.73))) * step(0.5, fract(a * 8.0 / 6.2831 + uTime * 0.2));
    float glow = (1.0 - smoothstep(0.0, 1.0, r)) * 0.22;
    float ripple = (1.0 - smoothstep(0.0, 0.07, abs(r - uPulse))) * (1.0 - uPulse);
    float m = ring1 + ring2 * 0.7 + dashes + glow + ripple * 2.0;
    gl_FragColor = vec4(uColor * 1.8, m * uAlpha);
  }
`;
const runeVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const qSpinA = new THREE.Quaternion();
const qSpinB = new THREE.Quaternion();
const qYaw = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const tmpColor = new THREE.Color();
const WHITE = new THREE.Color('#ffffff');
const unitCube = new RoundedBoxGeometry(1, 1, 1, 5, 0.13);
const unitPlane = new THREE.PlaneGeometry(1, 1);

/** One physical die. `main` is the placement roll; `atk` and `def` are the pair thrown in a fight. */
function DieActor({ id }: { id: DieId }) {
  const group = useRef<THREE.Group>(null!);
  const die = useRef<THREE.Mesh>(null!);
  const disc = useRef<THREE.Mesh>(null!);
  const light = useRef<THREE.PointLight>(null!);

  const view = useView();
  const hover = useRef<[number, number]>([0, 0]);
  hover.current = hoverSpot(view);
  const lift = useRef(HOVER_HEIGHT);
  lift.current = hoverHeight(view);

  const materials = useMemo(
    () =>
      id === 'main' ? goldMaterials() : faces().map(
        (f) =>
          new THREE.MeshStandardMaterial({
            map: f.map,
            emissiveMap: f.glow,
            emissive: new THREE.Color('#ffffff'),
            emissiveIntensity: 2.2,
            roughness: 0.32,
            metalness: 0.05,
          }),
      ),
    [id],
  );
  const rune = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: runeVertex,
        fragmentShader: runeFragment,
        uniforms: {
          uColor: { value: new THREE.Color('#ffffff') },
          uTime: { value: 0 },
          uAlpha: { value: 0 },
          uPulse: { value: 1 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const anim = useRef({
    rollId: 0,
    t0: -10,
    final: new THREE.Quaternion(),
    axisA: new THREE.Vector3(1, 0, 0),
    axisB: new THREE.Vector3(0, 0, 1),
    start: [0, 0] as [number, number],
    bounces: 0,
    pulseAt: -10,
    scale: 0,
  });

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const d = useGame.getState().dice[id];
    const a = anim.current;
    const main = id === 'main';

    if (d.rollId !== a.rollId) {
      a.rollId = d.rollId;
      a.t0 = t;
      a.bounces = 0;
      a.final.copy(faceUp(d.value)).premultiply(qYaw.setFromAxisAngle(UP, (Math.random() - 0.5) * 1.2));
      a.axisA.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      a.axisB.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      // The placement die leaps down from where it was waiting; combat dice drop almost straight down.
      a.start = main
        ? [hover.current[0], hover.current[1]]
        : [d.at[0] + (Math.random() - 0.5) * 0.5, d.at[1] + (Math.random() - 0.5) * 0.5];
      tmpColor.set(d.color);
      if (!main) materials.forEach((m) => m.color.copy(tmpColor).lerp(WHITE, 0.12));
      rune.uniforms.uColor.value.copy(tmpColor).lerp(WHITE, 0.3);
      light.current.color.copy(tmpColor);
    }

    // Fade the whole die in and out.
    const target = d.visible ? 1 : 0;
    a.scale += (target - a.scale) * Math.min(1, delta * (target ? 14 : 9));
    group.current.visible = a.scale > 0.01;
    if (!group.current.visible) return;

    const k = (t - a.t0) / d.duration;

    // Vertical motion: a drop followed by three shrinking bounces.
    let h: number;
    if (k < T1) {
      const u = k / T1;
      h = (main ? lift.current / d.size : 4.5) * (1 - u * u);
    } else if (k < T2) {
      const u = (k - T1) / (T2 - T1);
      h = 1.5 * 4 * u * (1 - u);
    } else if (k < T3) {
      const u = (k - T2) / (T3 - T2);
      h = 0.55 * 4 * u * (1 - u);
    } else if (k < T_REST) {
      const u = (k - T3) / (T_REST - T3);
      h = 0.16 * 4 * u * (1 - u);
    } else {
      h = 0.1 + Math.sin((k - T_REST) * d.duration * 2.2) * 0.06;
    }
    h *= d.size;

    const landings = [T1, T2, T3];
    while (a.bounces < landings.length && k >= landings[a.bounces]) {
      fx.emit({ type: 'diceLand', strength: [1, 0.5, 0.25][a.bounces], main });
      a.pulseAt = t;
      a.bounces++;
    }

    const travel = THREE.MathUtils.clamp(k / T_REST, 0, 1);
    const ease = 1 - (1 - travel) * (1 - travel);
    const x = a.start[0] + (d.at[0] - a.start[0]) * ease;
    const z = a.start[1] + (d.at[1] - a.start[1]) * ease;
    die.current.position.set(x, d.floor + d.size / 2 + h, z);

    // Tumble fast at first and decelerate exactly onto the rolled face.
    const remaining = 1 - travel;
    const angle = 17 * remaining * remaining;
    qSpinA.setFromAxisAngle(a.axisA, angle);
    qSpinB.setFromAxisAngle(a.axisB, angle * 0.6);
    die.current.quaternion.copy(a.final).multiply(qSpinA).multiply(qSpinB);
    if (k > T_REST) {
      die.current.quaternion.premultiply(
        qYaw.setFromAxisAngle(UP, Math.sin((k - T_REST) * d.duration * 0.9) * 0.18),
      );
    }
    die.current.scale.setScalar(a.scale * d.size);

    disc.current.position.set(d.at[0], d.floor, d.at[1]);
    disc.current.scale.setScalar(d.size * 3.2);

    light.current.position.set(x, d.floor + 0.2, z);
    light.current.intensity = (main ? 14 : 6) * a.scale;

    rune.uniforms.uTime.value = t;
    rune.uniforms.uAlpha.value = a.scale * (k > T1 ? 0.9 : 0.35);
    rune.uniforms.uPulse.value = Math.min(1, (t - a.pulseAt) * 1.8);
  });

  return (
    <group ref={group} visible={false}>
      <mesh ref={die} geometry={unitCube} material={materials} castShadow />
      <mesh ref={disc} geometry={unitPlane} rotation-x={-Math.PI / 2} material={rune} />
      <pointLight ref={light} distance={7} decay={1.6} intensity={0} />
    </group>
  );
}

const RINGS: { radius: number; tilt: [number, number, number]; speed: number }[] = [
  { radius: 2.25, tilt: [1.25, 0.2, 0], speed: 0.5 },
  { radius: 2.7, tilt: [1.05, -0.5, 0.4], speed: -0.36 },
];
const ringGeometries = RINGS.map((r) => new THREE.TorusGeometry(r.radius, 0.024, 8, 96));
const beadGeometry = new THREE.SphereGeometry(0.07, 10, 8);
// Brighter than white, so the bloom pass turns the rings into light.
const ringMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.75, 0.6), toneMapped: false });

/**
 * The golden die at rest: it hovers over the far end of the board inside two
 * orbiting rings, and leaps down from there when it is thrown.
 */
function WaitingDie() {
  const view = useView();
  const [x, z] = hoverSpot(view);
  // An upright phone shows the far end of the board small; the die shrinks with it.
  const fit = view === 'portrait' ? 0.6 : 1;
  const group = useRef<THREE.Group>(null!);
  const die = useRef<THREE.Mesh>(null!);
  const rings = useRef<THREE.Group>(null!);
  const halo = useRef<THREE.SpriteMaterial>(null!);
  const light = useRef<THREE.PointLight>(null!);
  const shown = useRef(0);

  const materials = useMemo(goldMaterials, []);
  const glow = useMemo(glowTexture, []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const s = useGame.getState();
    const waiting = !s.dice.main.visible && s.phase !== 'over';
    shown.current += ((waiting ? 1 : 0) - shown.current) * Math.min(1, delta * (waiting ? 4 : 14));
    const k = shown.current;
    group.current.visible = k > 0.01;
    if (!group.current.visible) return;

    group.current.position.set(x, hoverHeight(view) + Math.sin(t * 1.3) * 0.12, z);
    group.current.scale.setScalar(k * fit);
    die.current.rotation.set(0.62 + Math.sin(t * 0.5) * 0.08, t * 0.45, 0.5);
    rings.current.children.forEach((ring, i) => {
      ring.children[0].rotation.z = t * RINGS[i].speed;
    });
    rings.current.rotation.y = t * 0.12;
    halo.current.opacity = 0.6 * k * (0.9 + Math.sin(t * 2.1) * 0.1);
    light.current.intensity = 18 * k;
  });

  return (
    <group ref={group} visible={false}>
      <mesh ref={die} geometry={unitCube} material={materials} scale={HOVER_SIZE} castShadow />
      <group ref={rings}>
        {RINGS.map((ring, i) => (
          <group key={i} rotation={ring.tilt}>
            <group>
              <mesh geometry={ringGeometries[i]} material={ringMaterial} />
              <mesh geometry={beadGeometry} material={ringMaterial} position={[ring.radius, 0, 0]} />
              <mesh geometry={beadGeometry} material={ringMaterial} position={[-ring.radius, 0, 0]} scale={0.6} />
            </group>
          </group>
        ))}
      </group>
      <sprite scale={9.5}>
        <spriteMaterial ref={halo} map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </sprite>
      <Sparkles count={32} scale={6} size={5} speed={0.55} color="#ffe2a0" opacity={0.9} noise={0.6} />
      <pointLight ref={light} color="#ffb347" distance={11} decay={1.5} intensity={0} />
    </group>
  );
}

export function Dice() {
  return (
    <>
      <WaitingDie />
      <DieActor id="main" />
      <DieActor id="atk" />
      <DieActor id="def" />
    </>
  );
}
