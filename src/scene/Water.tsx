import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mulberry32 } from '../theme';
import { RIVER_HALF } from './Board';
import { RIVER_END } from './island';
import { useSceneryModel } from './models';
import { rockMaterial } from './rocks';
import { cloudTexture } from './Sky';

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
`;

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// uv.x runs bank to bank, uv.y runs downstream → upstream.
const riverFragment = /* glsl */ `
  uniform float uTime;
  uniform vec2 uSize;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uFoam;
  varying vec2 vUv;
  ${NOISE}
  void main() {
    vec2 p = vUv * uSize;
    float flow = uTime * 0.6;
    float n1 = noise(vec2(p.x * 2.4, p.y * 1.1 + flow * 1.5));
    float n2 = noise(vec2(p.x * 5.0 + 3.1, p.y * 2.6 + flow * 2.4));
    float n = n1 * 0.6 + n2 * 0.4;
    float edge = min(vUv.x, 1.0 - vUv.x);
    // Bright shallows by the banks, deep blue down the middle.
    float depth = smoothstep(0.0, 0.42, edge);
    vec3 col = mix(uShallow, uDeep, depth * 0.75 + n * 0.25);
    float streak = smoothstep(0.62, 0.82, n) * depth;
    col += uFoam * streak * 0.16;
    // Foam where the water meets the stones.
    float foam = 1.0 - smoothstep(0.0, 0.13, edge - n * 0.08);
    col = mix(col, uFoam, foam * 0.85);
    gl_FragColor = vec4(col, 0.9);
  }
`;

const fallFragment = /* glsl */ `
  uniform float uTime;
  uniform vec2 uSize;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uFoam;
  varying vec2 vUv;
  ${NOISE}
  void main() {
    vec2 p = vUv * uSize;
    float n = noise(vec2(p.x * 7.0, p.y * 1.3 + uTime * 3.2));
    float n2 = noise(vec2(p.x * 14.0 + 2.0, p.y * 2.2 + uTime * 4.6));
    float streak = smoothstep(0.35, 0.9, n * 0.65 + n2 * 0.35);
    vec3 col = mix(uShallow, uFoam, streak * 0.85);
    float lip = smoothstep(0.93, 1.0, vUv.y);
    col = mix(col, uFoam, lip);
    // The fall thins out into spray before it reaches the bottom.
    float fade = smoothstep(0.0, 0.6, vUv.y);
    float sides = smoothstep(0.0, 0.08, min(vUv.x, 1.0 - vUv.x));
    gl_FragColor = vec4(col * 1.1, fade * sides * (0.6 + streak * 0.4));
  }
`;

/** How far the water's surface lies below the lawn, and the stream bed below that. */
const SURFACE = -0.46;
const BED = -0.98;
const WIDTH = RIVER_HALF * 2;
const LENGTH = RIVER_END * 2;
const FALL_H = 6.2;

const BANK_TOP = new THREE.Color('#7d735f');
const BANK_WET = new THREE.Color('#33424a');

/**
 * One bank of the channel: a rough stone slope from the edge of the lawn down
 * to the stream bed, faceted like the cliffs.
 */
function bankGeometry(side: number): THREE.BufferGeometry {
  const rng = mulberry32(side > 0 ? 311 : 173);
  const steps = Math.round(LENGTH / 0.55);
  // Three lines of points run the length of the bank: lawn edge, waterline, bed.
  const lines = [
    { x: RIVER_HALF + 0.05, y: 0.02, wobble: 0 },
    { x: RIVER_HALF - 0.22, y: SURFACE + 0.05, wobble: 0.08 },
    { x: RIVER_HALF - 0.5, y: BED, wobble: 0.06 },
  ].map((line) =>
    Array.from({ length: steps + 1 }, (_, i) =>
      new THREE.Vector3(
        side * (line.x + (rng() - 0.5) * 2 * line.wobble),
        line.y + (rng() - 0.5) * line.wobble,
        -RIVER_END + (i / steps) * LENGTH,
      ),
    ),
  );

  const positions: number[] = [];
  const colours: number[] = [];
  const shade = new THREE.Color();
  const face = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, wet: number) => {
    shade.copy(BANK_TOP).lerp(BANK_WET, wet).multiplyScalar(0.85 + rng() * 0.3);
    for (const v of [a, b, c]) {
      positions.push(v.x, v.y, v.z);
      colours.push(shade.r, shade.g, shade.b);
    }
  };
  for (let k = 0; k < lines.length - 1; k++) {
    for (let i = 0; i < steps; i++) {
      const a = lines[k][i];
      const b = lines[k][i + 1];
      const c = lines[k + 1][i];
      const d = lines[k + 1][i + 1];
      face(a, b, c, k * 0.7);
      face(b, d, c, k * 0.7 + 0.15);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// Lily pads drifting in the slack water, clear of the bridges.
const LILIES: [number, number, number][] = [
  [-0.42, 3.9, 0.3],
  [0.38, 5.3, 1.9],
  [-0.2, 6.5, 4.1],
  [0.45, -4.4, 2.6],
  [-0.4, -5.7, 0.9],
];

export function Water() {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#1561a6') },
      uShallow: { value: new THREE.Color('#48d3f0') },
      uFoam: { value: new THREE.Color('#f2fdff') },
    }),
    [],
  );

  const river = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: riverFragment,
        uniforms: { ...uniforms, uSize: { value: new THREE.Vector2(WIDTH, LENGTH) } },
        transparent: true,
      }),
    [uniforms],
  );
  const fall = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fallFragment,
        uniforms: { ...uniforms, uSize: { value: new THREE.Vector2(WIDTH, FALL_H) } },
        transparent: true,
        depthWrite: false,
      }),
    [uniforms],
  );

  const banks = useMemo(() => [bankGeometry(-1), bankGeometry(1)], []);
  // The banks are seen from the stream side, whichever way their faces were wound.
  const bankMaterial = useMemo(() => {
    const material = rockMaterial.clone();
    material.side = THREE.DoubleSide;
    return material;
  }, []);

  const lilyA = useSceneryModel('waterlily_A');
  const lilyB = useSceneryModel('waterlily_B');
  const spray = useMemo(() => cloudTexture(57), []);
  const mist = useRef<THREE.Group>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    uniforms.uTime.value = t;
    mist.current.children.forEach((sprite, i) => {
      const material = (sprite as THREE.Sprite).material;
      material.opacity = 0.34 + 0.14 * Math.sin(t * 0.9 + i * 2.1);
      sprite.position.y = SURFACE - FALL_H + 1.5 + i * 0.5 + Math.sin(t * 0.6 + i) * 0.2;
    });
  });

  return (
    <group>
      {/* The channel: a dark bed, stone banks, and the water between them. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, BED, 0]} receiveShadow>
        <planeGeometry args={[WIDTH - 0.6, LENGTH]} />
        <meshStandardMaterial color="#123c52" roughness={1} />
      </mesh>
      {banks.map((geometry, i) => (
        <mesh key={i} geometry={geometry} material={bankMaterial} receiveShadow />
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[0, SURFACE, 0]} material={river}>
        <planeGeometry args={[WIDTH - 0.34, LENGTH]} />
      </mesh>

      {LILIES.map(([x, z, turn], i) => {
        const lily = i % 2 ? lilyB : lilyA;
        return (
          <mesh
            key={i}
            geometry={lily.geometry}
            material={lily.material}
            position={[x, SURFACE + 0.012, z]}
            rotation-y={turn}
            scale={0.55}
          />
        );
      })}

      {/* The waterfall off the front edge of the island, and the spray it falls into. */}
      <mesh position={[0, SURFACE - FALL_H / 2, RIVER_END + 0.14]} material={fall}>
        <planeGeometry args={[WIDTH - 0.24, FALL_H]} />
      </mesh>
      <group ref={mist}>
        {[-0.9, 0.5, 1.4].map((x, i) => (
          <sprite key={i} position={[x, SURFACE - FALL_H + 1.5, RIVER_END + 0.9]} scale={[5.5, 3.4, 1]}>
            <spriteMaterial map={spray} color="#e8f4ff" transparent opacity={0.4} depthWrite={false} fog={false} />
          </sprite>
        ))}
      </group>
    </group>
  );
}
