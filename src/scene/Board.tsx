import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../state/game';
import { COLS, KINGDOMS, ROWS, cellToWorld, mulberry32 } from '../theme';
import { MAP_TYPE } from '../config';
import { COARSE_POINTER, useView } from './view';
import { CUSTOM_CASTLES } from './customModels';
import { ISLAND_D, ISLAND_W, islandFor } from './island';
import { rockMaterial } from './rocks';

/** Half-width of the river channel, in world units. */
export const RIVER_HALF = 1.06;

const tmpObj = new THREE.Object3D();
const tint = new THREE.Color();

interface Cell {
  x: number;
  y: number;
}

/**
 * On touch screens a tile is smaller than a fingertip. If a tap lands just
 * outside a legal tile, treat it as a tap on the nearest legal one.
 */
function snapToValid(point: THREE.Vector3, valid: Set<string>): Cell | undefined {
  const gx = point.x + COLS / 2 - 0.5;
  const gy = point.z + ROWS / 2 - 0.5;
  let best: Cell | undefined;
  let bestDist = 0.95;
  for (const key of valid) {
    const [x, y] = key.split(',').map(Number);
    const d = Math.hypot(x - gx, y - gy);
    if (d < bestDist) {
      bestDist = d;
      best = { x, y };
    }
  }
  return best;
}

/** Hover / click handling shared by every pickable cell mesh. */
function useCellHandlers(cells: Cell[]) {
  return useMemo(() => {
    const cellOf = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
      e.instanceId != null ? cells[e.instanceId] : undefined;
    return {
      onPointerMove: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        const c = cellOf(e);
        if (c) useGame.getState().setHover(`${c.x},${c.y}`);
      },
      onPointerOut: () => useGame.getState().setHover(null),
      onClick: (e: ThreeEvent<MouseEvent>) => {
        // A drag that pans the camera must not count as a tile click.
        if (e.delta > (COARSE_POINTER ? 12 : 6)) return;
        e.stopPropagation();
        let c = cellOf(e);
        if (!c) return;
        const { tappable, tapCell } = useGame.getState();
        if (COARSE_POINTER && !tappable.has(`${c.x},${c.y}`)) c = snapToValid(e.point, tappable) ?? c;
        tapCell(c.x, c.y);
      },
    };
  }, [cells]);
}

// ── Grass ──────────────────────────────────────────────────────────────
/**
 * A tileable patch of lawn painted on a canvas: soft light and dark patches
 * under a scatter of short blades, so the ground reads as grass rather than
 * a flat green sheet.
 */
function grassTexture(): THREE.CanvasTexture {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const rng = mulberry32(41);
  ctx.fillStyle = '#3d7226';
  ctx.fillRect(0, 0, S, S);

  /** Draws at every wrapped position, so the texture has no seams when repeated. */
  const wrapped = (x: number, y: number, r: number, draw: (px: number, py: number) => void) => {
    for (const dx of [-S, 0, S])
      for (const dy of [-S, 0, S]) {
        const px = x + dx;
        const py = y + dy;
        if (px > -r && px < S + r && py > -r && py < S + r) draw(px, py);
      }
  };

  const patches = ['#5b9a33', '#6dab3b', '#2e5f1f', '#4b882d', '#86b943', '#27521b'];
  for (let i = 0; i < 240; i++) {
    const r = 26 + rng() * 80;
    const colour = patches[Math.floor(rng() * patches.length)];
    wrapped(rng() * S, rng() * S, r, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, colour);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = g;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }

  const blades = ['#7fbd49', '#98cf58', '#27541b', '#62a136', '#b5dc6c'];
  ctx.lineCap = 'round';
  for (let i = 0; i < 9000; i++) {
    const len = 2.5 + rng() * 5;
    const angle = -Math.PI / 2 + (rng() - 0.5) * 1.1;
    ctx.strokeStyle = blades[Math.floor(rng() * blades.length)];
    ctx.globalAlpha = 0.22 + rng() * 0.3;
    ctx.lineWidth = 0.8 + rng() * 0.8;
    wrapped(rng() * S, rng() * S, 8, (px, py) => {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(angle) * len, py + Math.sin(angle) * len);
      ctx.stroke();
    });
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/** World units covered by one repeat of the grass texture. */
const GRASS_TILE = 5;

// ── The floating island the board sits on ──────────────────────────────
export function Island() {
  // On the river map the lawn is two pieces with the channel between them.
  const channel = MAP_TYPE === 'river' ? RIVER_HALF : 0;
  const island = islandFor(useView());
  const lawns = useMemo(() => island.lawns(channel), [island, channel]);
  const rock = useMemo(() => island.rock(), [island]);

  const lawn = useMemo(() => {
    const map = grassTexture();
    // The lawn's texture coordinates are in world units.
    map.repeat.set(1 / GRASS_TILE, 1 / GRASS_TILE);
    return new THREE.MeshStandardMaterial({ map, roughness: 1 });
  }, []);

  return (
    <group>
      {/* One continuous lawn: the board is drawn on it, not raised from it. */}
      {lawns.map((geometry, i) => (
        <mesh key={i} geometry={geometry} material={lawn} receiveShadow />
      ))}
      {/* The cliffs under it, drawing in to a point far below. */}
      <mesh geometry={rock} material={rockMaterial} castShadow receiveShadow />
    </group>
  );
}

// ── Tile picking ───────────────────────────────────────────────────────
/** Invisible pads, one per grass tile, that catch hover and taps. */
export function TilePicker() {
  const terrain = useGame((s) => s.terrain);
  const ref = useRef<THREE.InstancedMesh>(null!);

  const cells = useMemo(() => {
    const list: Cell[] = [];
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) if (terrain[y][x] === 'grass') list.push({ x, y });
    return list;
  }, [terrain]);

  const handlers = useCellHandlers(cells);

  useLayoutEffect(() => {
    cells.forEach((c, i) => {
      const [wx, wz] = cellToWorld(c.x, c.y);
      tmpObj.position.set(wx, -0.04, wz);
      tmpObj.rotation.set(0, 0, 0);
      tmpObj.scale.setScalar(1);
      tmpObj.updateMatrix();
      ref.current.setMatrixAt(i, tmpObj.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [cells]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, cells.length]} {...handlers}>
      <boxGeometry args={[1, 0.08, 1]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </instancedMesh>
  );
}

// ── Grid and territory ─────────────────────────────────────────────────
const overlayVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const overlayFragment = /* glsl */ `
  uniform sampler2D uOwners;
  uniform sampler2D uGround;
  uniform vec2 uGrid;
  uniform float uTime;
  // Which corners of the board a castle stands across: far-left, far-right, near-left, near-right.
  uniform vec4 uCut;
  varying vec2 vUv;

  vec4 ownerAt(vec2 cell) {
    if (cell.x < 0.0 || cell.y < 0.0 || cell.x >= uGrid.x || cell.y >= uGrid.y) return vec4(0.0);
    return texture2D(uOwners, (cell + 0.5) / uGrid);
  }

  /**
   * True for the three tiles of a corner plot that a castle standing across
   * the corner covers: the corner tile and the two beside it. The fourth tile
   * of the plot stays open in front of the gate.
   */
  bool castleGround(vec2 cell) {
    vec2 q = cell + 0.5;
    float cut = q.x < uGrid.x * 0.5
      ? (q.y < uGrid.y * 0.5 ? uCut.x : uCut.z)
      : (q.y < uGrid.y * 0.5 ? uCut.y : uCut.w);
    vec2 steps = floor(min(q, uGrid - q));
    return cut > 0.5 && steps.x + steps.y < 1.5;
  }

  /** 1 where the neighbouring tile belongs to someone else (or no one), else 0. */
  float foreign(vec4 mine, vec2 neighbour) {
    // The border steps round a castle's ground as it would round another kingdom's.
    if (castleGround(neighbour)) return 1.0;
    vec4 other = ownerAt(neighbour);
    return (other.a > 0.5 && distance(other.rgb, mine.rgb) < 0.04) ? 0.0 : 1.0;
  }

  void main() {
    // Row 0 of the board is the far edge, which is the top of this plane.
    vec2 g = vec2(vUv.x, 1.0 - vUv.y) * uGrid;
    vec2 cell = floor(g);
    vec2 f = fract(g);
    if (texture2D(uGround, (cell + 0.5) / uGrid).r < 0.5) discard;

    // Nothing is drawn on the tiles a castle stands on.
    if (castleGround(cell)) discard;

    vec4 mine = ownerAt(cell);
    float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));

    // The playing field is ruled into tiles: a dark seam between them, and a
    // faint lit bevel just inside each one.
    float line = 1.0 - smoothstep(0.02, 0.055, edge);
    float bevel = (1.0 - smoothstep(0.055, 0.15, edge)) * (1.0 - line);
    vec3 colour = mix(vec3(0.86, 1.0, 0.5), vec3(0.03, 0.09, 0.02), line);
    float alpha = max(line * 0.5, bevel * 0.07);

    if (mine.a > 0.5) {
      // Distance to the nearest side that borders someone else's ground.
      float d = 9.0;
      d = mix(d, min(d, f.x), foreign(mine, cell + vec2(-1.0, 0.0)));
      d = mix(d, min(d, 1.0 - f.x), foreign(mine, cell + vec2(1.0, 0.0)));
      d = mix(d, min(d, f.y), foreign(mine, cell + vec2(0.0, -1.0)));
      d = mix(d, min(d, 1.0 - f.y), foreign(mine, cell + vec2(0.0, 1.0)));

      float core = 1.0 - smoothstep(0.025, 0.07, d);
      float halo = 1.0 - smoothstep(0.0, 0.38, d);
      float breathe = 0.85 + 0.15 * sin(uTime * 2.0);
      // A wash of the kingdom's colour, a soft halo inside the border, and a bright line on it.
      colour = mine.rgb * (1.0 + core * 2.6 * breathe);
      alpha = max(max(0.2, halo * 0.5), core);
    }
    gl_FragColor = vec4(colour, alpha);
  }
`;

/**
 * The board drawn over the lawn: a thin grid, and for every kingdom a wash
 * of its colour over the tiles it holds with a glowing line around the lot.
 */
export function Territory() {
  const grid = useGame((s) => s.grid);
  const gs = useGame((s) => s.gs);
  const terrain = useGame((s) => s.terrain);
  const version = useGame((s) => s.version);

  const textures = useMemo(() => {
    const make = () => {
      const texture = new THREE.DataTexture(new Uint8Array(COLS * ROWS * 4), COLS, ROWS, THREE.RGBAFormat);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      return texture;
    };
    return { owners: make(), ground: make() };
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: overlayVertex,
        fragmentShader: overlayFragment,
        uniforms: {
          uOwners: { value: textures.owners },
          uGround: { value: textures.ground },
          uGrid: { value: new THREE.Vector2(COLS, ROWS) },
          uTime: { value: 0 },
          uCut: { value: new THREE.Vector4() },
        },
        transparent: true,
        depthWrite: false,
      }),
    [textures],
  );

  // Where there is ground to draw on: everything except open water.
  useLayoutEffect(() => {
    const data = textures.ground.image.data as Uint8Array;
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) data[(y * COLS + x) * 4] = terrain[y][x] === 'river' ? 0 : 255;
    textures.ground.needsUpdate = true;
  }, [terrain, textures]);

  useLayoutEffect(() => {
    const data = textures.owners.image.data as Uint8Array;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const owner = grid[y][x].ownerId;
        const player = owner ? gs.players[owner] : undefined;
        const i = (y * COLS + x) * 4;
        if (player) {
          tint.set(KINGDOMS[player.color].color);
          data[i] = tint.r * 255;
          data[i + 1] = tint.g * 255;
          data[i + 2] = tint.b * 255;
          data[i + 3] = 255;
        } else {
          data[i + 3] = 0;
        }
      }
    }
    textures.owners.needsUpdate = true;

    // Corners where a standing castle of the diagonal kind cuts its plot.
    const cut = material.uniforms.uCut.value as THREE.Vector4;
    cut.set(0, 0, 0, 0);
    for (const player of Object.values(gs.players)) {
      if (!player.isAlive || !CUSTOM_CASTLES[player.color]) continue;
      const corner = (player.castlePosition.x > COLS / 2 ? 1 : 0) + (player.castlePosition.y > ROWS / 2 ? 2 : 0);
      cut.setComponent(corner, 1);
    }
  }, [grid, gs, version, textures, material]);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.008, 0]} material={material} renderOrder={1}>
      <planeGeometry args={[COLS, ROWS]} />
    </mesh>
  );
}

// ── Bridges ────────────────────────────────────────────────────────────
export function Bridges() {
  const terrain = useGame((s) => s.terrain);
  const deckRef = useRef<THREE.InstancedMesh>(null!);

  const cells = useMemo(() => {
    const list: Cell[] = [];
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) if (terrain[y][x] === 'bridge') list.push({ x, y });
    return list;
  }, [terrain]);

  const rows = useMemo(() => [...new Set(cells.map((c) => c.y))], [cells]);
  const handlers = useCellHandlers(cells);

  useLayoutEffect(() => {
    cells.forEach((c, i) => {
      const [wx, wz] = cellToWorld(c.x, c.y);
      tmpObj.position.set(wx, -0.07, wz);
      tmpObj.rotation.set(0, 0, 0);
      tmpObj.scale.setScalar(1);
      tmpObj.updateMatrix();
      deckRef.current.setMatrixAt(i, tmpObj.matrix);
    });
    deckRef.current.instanceMatrix.needsUpdate = true;
    deckRef.current.computeBoundingSphere();
  }, [cells]);

  const planks = Array.from({ length: 9 }, (_, i) => -1.04 + i * 0.26);
  const posts = [-1.14, -0.57, 0, 0.57, 1.14];

  return (
    <group>
      <instancedMesh ref={deckRef} args={[undefined, undefined, cells.length]} receiveShadow castShadow {...handlers}>
        <boxGeometry args={[1.04, 0.1, 0.92]} />
        <meshStandardMaterial color="#7a5030" roughness={0.9} />
      </instancedMesh>
      {rows.map((row) => {
        const z = row - ROWS / 2 + 0.5;
        return (
          <group key={row} position={[0, 0, z]}>
            {planks.map((px, i) => (
              <mesh key={i} position={[px, 0.0, 0]} receiveShadow castShadow>
                <boxGeometry args={[0.235, 0.05, 1.0]} />
                <meshStandardMaterial color={i % 2 ? '#b07a44' : '#9c693a'} roughness={0.85} />
              </mesh>
            ))}
            {[-0.5, 0.5].map((side) => (
              <group key={side} position={[0, 0, side]}>
                {/* Two rails on turned posts, like a footbridge. */}
                <mesh position={[0, 0.36, 0]} castShadow>
                  <boxGeometry args={[2.42, 0.06, 0.07]} />
                  <meshStandardMaterial color="#7b4f2b" roughness={0.9} />
                </mesh>
                <mesh position={[0, 0.2, 0]} castShadow>
                  <boxGeometry args={[2.36, 0.045, 0.05]} />
                  <meshStandardMaterial color="#7b4f2b" roughness={0.9} />
                </mesh>
                {posts.map((px) => (
                  <mesh key={px} position={[px, 0.2, 0]} castShadow>
                    <boxGeometry args={[0.1, 0.46, 0.1]} />
                    <meshStandardMaterial color="#62401f" roughness={0.9} />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
        );
      })}
    </group>
  );
}

// ── Legal-move highlights and hover marker ─────────────────────────────
const highlightVertex = /* glsl */ `
  varying vec2 vUv;
  varying float vSeed;
  void main() {
    vUv = uv;
    #ifdef USE_INSTANCING
      vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    #else
      vec4 wp = modelMatrix * vec4(position, 1.0);
    #endif
    vSeed = wp.x * 0.37 + wp.z * 0.53;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const highlightFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uStrength;
  varying vec2 vUv;
  varying float vSeed;
  void main() {
    vec2 q = abs(vUv - 0.5) * 2.0;
    float d = max(q.x, q.y);
    float inside = 1.0 - smoothstep(0.88, 0.93, d);
    float border = smoothstep(0.70, 0.80, d) * inside;
    float pulse = 0.5 + 0.5 * sin(uTime * 3.2 + vSeed * 2.0);
    float fill = (0.14 + 0.14 * pulse) * inside;
    float alpha = max(border * (0.7 + 0.3 * pulse), fill) * uStrength;
    vec3 col = uColor * (1.25 + border * 1.5);
    gl_FragColor = vec4(col, alpha);
  }
`;

const flatPlane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const EMPTY: Set<string> = new Set();

interface MarksProps {
  cells: Set<string>;
  color: string;
  strength?: number;
  /** Pulse rate relative to the placement highlight. */
  speed?: number;
  order?: number;
}

/** A pulsing outlined square on each of the given tiles. */
function CellMarks({ cells, color, strength = 1, speed = 1, order = 20 }: MarksProps) {
  const ref = useRef<THREE.InstancedMesh>(null!);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: highlightVertex,
        fragmentShader: highlightFragment,
        uniforms: {
          uColor: { value: new THREE.Color('#ffffff') },
          uTime: { value: 0 },
          uStrength: { value: 1 },
        },
        transparent: true,
        depthWrite: false,
        // Drawn over everything: a castle or soldier must never hide a marked tile behind it.
        depthTest: false,
      }),
    [],
  );

  useLayoutEffect(() => {
    let i = 0;
    for (const key of cells) {
      const [x, y] = key.split(',').map(Number);
      const [wx, wz] = cellToWorld(x, y);
      tmpObj.position.set(wx, 0.02, wz);
      tmpObj.rotation.set(0, 0, 0);
      tmpObj.scale.setScalar(1);
      tmpObj.updateMatrix();
      ref.current.setMatrixAt(i++, tmpObj.matrix);
    }
    ref.current.count = i;
    ref.current.instanceMatrix.needsUpdate = true;
    // `material` is listed because a new material means a new instanced mesh to fill.
  }, [cells, material]);

  useLayoutEffect(() => {
    material.uniforms.uColor.value.set(color);
    material.uniforms.uStrength.value = strength;
  }, [color, strength, material]);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime * speed;
  });

  return (
    <instancedMesh ref={ref} args={[flatPlane, material, COLS * ROWS]} frustumCulled={false} renderOrder={order} />
  );
}

/** Brighter outline under the pointer, shown only on tiles that can be acted on. */
function HoverMark() {
  const ref = useRef<THREE.Mesh>(null!);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: highlightVertex,
        fragmentShader: highlightFragment,
        uniforms: {
          uColor: { value: new THREE.Color('#fff6d8') },
          uTime: { value: 0 },
          uStrength: { value: 1.6 },
        },
        transparent: true,
        depthWrite: false,
        depthTest: false,
      }),
    [],
  );

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime * 1.6;
    const { hover, tappable } = useGame.getState();
    const show = hover != null && tappable.has(hover);
    ref.current.visible = show;
    if (show && hover) {
      const [x, y] = hover.split(',').map(Number);
      const [wx, wz] = cellToWorld(x, y);
      ref.current.position.set(wx, 0.035, wz);
    }
    document.body.style.cursor = show ? 'pointer' : '';
  });

  return <mesh ref={ref} geometry={flatPlane} material={material} scale={1.06} renderOrder={24} />;
}

const ringFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float a = atan(p.y, p.x);
    float ring = 1.0 - smoothstep(0.0, 0.05, abs(r - 0.8));
    float dashes = (1.0 - smoothstep(0.0, 0.03, abs(r - 0.63))) * step(0.5, fract(a * 6.0 / 6.2831 + uTime * 0.25));
    float glow = (1.0 - smoothstep(0.25, 0.95, r)) * 0.3;
    float alpha = clamp(ring + dashes * 0.8 + glow, 0.0, 1.0);
    gl_FragColor = vec4(uColor * (1.4 + ring * 1.8), alpha);
  }
`;

const chevronFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    // x runs along the arrow, y is the distance from its centre line.
    float y = abs(vUv.y - 0.5) * 2.0;
    float s = fract((vUv.x + y * 0.24) * 3.0 - uTime * 1.5);
    float band = smoothstep(0.0, 0.14, s) * (1.0 - smoothstep(0.36, 0.5, s));
    float mask = (1.0 - smoothstep(0.72, 0.95, y)) * smoothstep(0.0, 0.14, vUv.x) * (1.0 - smoothstep(0.86, 1.0, vUv.x));
    gl_FragColor = vec4(uColor * 2.3, band * mask);
  }
`;

const overlay = (fragmentShader: string) =>
  new THREE.ShaderMaterial({
    vertexShader: highlightVertex,
    fragmentShader,
    uniforms: { uColor: { value: new THREE.Color('#ffffff') }, uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });

/**
 * The chosen attacker: a glowing ring under its feet, and a run of chevrons
 * flowing towards each tile it can strike.
 */
function SelectionMarks({ selected, targets, color }: { selected: string | null; targets: Set<string>; color: string }) {
  const ring = useRef<THREE.Mesh>(null!);
  const arrows = useRef<THREE.InstancedMesh>(null!);
  const ringMaterial = useMemo(() => overlay(ringFragment), []);
  const arrowMaterial = useMemo(() => overlay(chevronFragment), []);

  useLayoutEffect(() => {
    ringMaterial.uniforms.uColor.value.set(color);
    arrowMaterial.uniforms.uColor.value.set(color);
  }, [color, ringMaterial, arrowMaterial]);

  useLayoutEffect(() => {
    ring.current.visible = selected != null;
    let i = 0;
    if (selected) {
      const [sx, sy] = selected.split(',').map(Number);
      const [x0, z0] = cellToWorld(sx, sy);
      ring.current.position.set(x0, 0.03, z0);
      for (const key of targets) {
        const [tx, ty] = key.split(',').map(Number);
        const [x1, z1] = cellToWorld(tx, ty);
        // The arrow lies between the two tiles and points at the target.
        tmpObj.position.set((x0 + x1) / 2, 0.04, (z0 + z1) / 2);
        tmpObj.rotation.set(0, Math.atan2(-(z1 - z0), x1 - x0), 0);
        tmpObj.scale.set(Math.hypot(x1 - x0, z1 - z0) * 0.92, 1, 0.5);
        tmpObj.updateMatrix();
        arrows.current.setMatrixAt(i++, tmpObj.matrix);
      }
    }
    arrows.current.count = i;
    arrows.current.instanceMatrix.needsUpdate = true;
  }, [selected, targets, arrowMaterial]);

  useFrame((state) => {
    ringMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    arrowMaterial.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <>
      <mesh ref={ring} geometry={flatPlane} material={ringMaterial} scale={1.75} renderOrder={23} visible={false} />
      <instancedMesh ref={arrows} args={[flatPlane, arrowMaterial, 16]} frustumCulled={false} renderOrder={24} />
    </>
  );
}

export function Highlights() {
  const phase = useGame((s) => s.phase);
  const valid = useGame((s) => s.valid);
  const attackers = useGame((s) => s.attackers);
  const targets = useGame((s) => s.targets);
  const selected = useGame((s) => s.selected);
  const turnColor = useGame((s) => s.turnColor);

  const placeColor = useMemo(
    () => `#${new THREE.Color(turnColor).lerp(new THREE.Color('#ffffff'), 0.25).getHexString()}`,
    [turnColor],
  );
  return (
    <group>
      <CellMarks cells={phase === 'placing' ? valid : EMPTY} color={placeColor} />
      {/* Attack phase: your units that can strike, the one you picked, and what it can hit. */}
      <CellMarks cells={attackers} color="#ffe9a8" strength={0.85} order={21} />
      <CellMarks cells={targets} color="#ff4530" strength={1.6} speed={1.7} order={22} />
      <SelectionMarks selected={selected} targets={targets} color={placeColor} />
      <HoverMark />
    </group>
  );
}

export { ISLAND_D, ISLAND_W };
