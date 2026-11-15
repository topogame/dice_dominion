import { useLayoutEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { COLS, ROWS, mulberry32 } from '../theme';
import { MAP_TYPE } from '../config';
import { RIVER_HALF } from './Board';
import { CUSTOM_TREES, TYPICAL_CASTLE, castleSeat } from './customModels';
import { modelUrl } from './models';
import { paintedMaterial } from './painted';
import { ISLAND_D, ISLAND_W, OUTLINE, RIVER_END, insideIsland } from './island';
import { ROCK_SHAPES, rockGeometry, rockMaterial } from './rocks';
import { TREE_SHAPES, foliageMaterial } from './trees';
import { COARSE_POINTER, useView, type View } from './view';

interface Item {
  position: [number, number, number];
  scale: [number, number, number];
  rotation: number;
  color?: string;
}

const tmp = new THREE.Object3D();
const tmpColor = new THREE.Color();

/** One instanced mesh per kind of prop keeps the scenery to a few draw calls. */
function Instances({
  items,
  geometry,
  material,
  castShadow = true,
}: {
  items: Item[];
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  castShadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((it, i) => {
      tmp.position.set(...it.position);
      tmp.scale.set(...it.scale);
      tmp.rotation.set(0, it.rotation, 0);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      if (it.color) mesh.setColorAt(i, tmpColor.set(it.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  if (items.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={castShadow} receiveShadow />
  );
}

/**
 * The woods drawn from generated tree models. `trees` holds the places for
 * two sorts of pine and one of broadleaf; each goes to a model of its kind,
 * or to the other kind's where there is none.
 */
function GeneratedWood({ trees }: { trees: Item[][] }) {
  const gltfs = useGLTF(CUSTOM_TREES.map((tree) => modelUrl(`custom/${tree.file}`)));

  const models = useMemo(
    () =>
      gltfs.map((gltf) => {
        gltf.scene.updateMatrixWorld(true);
        let mesh: THREE.Mesh | undefined;
        gltf.scene.traverse((o) => {
          if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
        });
        if (!mesh) throw new Error('A tree model has no mesh');
        // Stand it on the ground, centred, one unit tall, like the trees made in code.
        const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const centre = box.getCenter(new THREE.Vector3());
        const height = box.max.y - box.min.y;
        geometry.translate(-centre.x, -box.min.y, -centre.z).scale(1 / height, 1 / height, 1 / height);
        const material = paintedMaterial(mesh.material as THREE.MeshStandardMaterial, 0);
        // The generated trees are painted darker than the scene is lit for.
        material.color.setScalar(1.45);
        // Simplified foliage has gaps; drawing both sides keeps them from showing through.
        material.side = THREE.DoubleSide;
        return { geometry, material };
      }),
    [gltfs],
  );

  const groups = useMemo(() => {
    const ofKind = (kind: 'pine' | 'broadleaf') =>
      CUSTOM_TREES.map((tree, i) => (tree.kind === kind ? i : -1)).filter((i) => i >= 0);
    const pines = ofKind('pine');
    const leaves = ofKind('broadleaf');
    const all = CUSTOM_TREES.map((_, i) => i);
    const sources = [pines.length ? pines : all, pines.length ? pines : all, leaves.length ? leaves : all];
    // Share each sort's places out among the models that can stand in for it.
    const lists: Item[][] = CUSTOM_TREES.map(() => []);
    trees.forEach((items, sort) => {
      const from = sources[sort];
      items.forEach((item, n) => lists[from[(n + sort) % from.length]].push(item));
    });
    // A phone draws every other tree: each one is a detailed model.
    return COARSE_POINTER ? lists.map((list) => list.filter((_, n) => n % 2 === 0)) : lists;
  }, [trees]);

  return (
    <>
      {groups.map((items, i) => (
        <Instances key={i} items={items} geometry={models[i].geometry} material={models[i].material} />
      ))}
    </>
  );
}

const GROUND = -0.01;
const matte = new THREE.MeshStandardMaterial({ roughness: 0.9 });
const leafy = new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true });
const petal = new THREE.MeshStandardMaterial({ roughness: 0.6 });
const tuftGeo = new THREE.ConeGeometry(0.05, 0.16, 4).translate(0, 0.08, 0);
const bushGeo = new THREE.IcosahedronGeometry(0.5, 1);
const flowerGeo = new THREE.SphereGeometry(0.05, 6, 5);
const rockGeos = ROCK_SHAPES.map((shape) => rockGeometry(shape.seed, shape.detail));
/** A boulder one unit tall is about this wide. */
const ROCK_GIRTH = 1.33;

// Each tree is tinted a touch, so no two in a clump are the same green.
const TREE_TINT = '#e3ecdf';
const TUFT_COLOR = '#5d9a3e';
const BUSH = ['#3f8a3a', '#4c9a40', '#357c36'];
const FLOWERS = ['#ffffff', '#f6d7ff', '#ffe27a', '#ff9fc4', '#c9b6ff'];

/**
 * Lays out the island's scenery. Rock does most of the work: boulders break
 * up the rim all the way round, crags rise behind the two far castles and
 * part-way down each side, and stones line the river. Trees fill in behind
 * the board and between the crags. Anything tall keeps to the far edge and
 * the sides as the camera sees them; along the near edge everything stays low.
 */
function buildDecor(view: View) {
  const rng = mulberry32(20261116);
  const jitter = (amount: number) => (rng() - 0.5) * 2 * amount;
  const pick = <T,>(list: T[]) => list[Math.floor(rng() * list.length)];

  const trees: Item[][] = TREE_SHAPES.map(() => []);
  const rocks: Item[][] = ROCK_SHAPES.map(() => []);
  const tufts: Item[] = [];
  const bushes: Item[] = [];
  const flowers: Item[] = [];

  const gridX = COLS / 2;
  const gridZ = ROWS / 2;
  const river = MAP_TYPE === 'river';
  const onRiver = (x: number, pad = 0.9) => river && Math.abs(x) < RIVER_HALF + pad;

  // Screen-relative axes: u runs across the screen, v away from the camera.
  const portrait = view === 'portrait';
  const gridU = portrait ? gridZ : gridX;
  const gridV = portrait ? gridX : gridZ;
  const edgeU = (portrait ? ISLAND_D : ISLAND_W) / 2;
  const edgeV = (portrait ? ISLAND_W : ISLAND_D) / 2;
  const toWorld = (u: number, v: number): [number, number] => (portrait ? [v, u] : [u, -v]);
  /** How far towards the camera a world point lies: 1 at the near edge, -1 at the far edge. */
  const nearness = (x: number, z: number) => (portrait ? -x / (ISLAND_W / 2) : z / (ISLAND_D / 2));

  // Each castle stands across its corner of the board; nothing is planted inside it.
  const seats = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => castleSeat(TYPICAL_CASTLE, portrait, sx, sz)));
  const inCastle = (x: number, z: number, pad = 0.4) =>
    seats.some((s) => {
      const dx = x - s.x;
      const dz = z - s.z;
      return (
        Math.abs(dx * s.along[0] + dz * s.along[1]) < s.halfAcross + pad &&
        Math.abs(dx * s.gate[0] + dz * s.gate[1]) < s.halfDeep + pad
      );
    });
  /** The ground before the wall a castle shows the board, kept clear so the border at its foot is seen. */
  const beforeGate = (x: number, z: number) =>
    seats.some((s) => {
      const dx = x - s.plot[0];
      const dz = z - s.plot[1];
      const out = dx * s.inward[0] + dz * s.inward[1];
      const along = dx * s.inward[1] - dz * s.inward[0];
      return out > -0.5 && out < 2.4 && Math.abs(along) < s.wallHalf + 0.8;
    });

  // ── Rock ──
  /** Ground taken up by the larger rocks, which trees then keep clear of. */
  const stones: { x: number; z: number; r: number }[] = [];
  const rock = (x: number, z: number, width: number, height: number, sink = 0.18, y?: number) => {
    const w = width / ROCK_GIRTH;
    rocks[Math.floor(rng() * rocks.length)].push({
      position: [x, y ?? -sink * height, z],
      scale: [w, height, w * (0.85 + rng() * 0.3)],
      rotation: rng() * Math.PI * 2,
    });
    if (width > 0.9) stones.push({ x, z, r: width * 0.55 });
  };

  // Boulders along the rim: low and mossy nearest the camera, rising to the back.
  OUTLINE.forEach((p, i) => {
    if (i % 2 || rng() < 0.2) return;
    if (river && Math.abs(p.nz) > 0.9 && Math.abs(p.x) < 2.6) return;
    const x = p.x - p.nx * 0.25 + jitter(0.15);
    const z = p.z - p.nz * 0.25 + jitter(0.15);
    if (inCastle(x, z) || beforeGate(x, z)) return;
    const near = nearness(x, z);
    if (near > 0.5) rock(x, z, 0.75 + rng() * 0.45, 0.4 + rng() * 0.35, 0.4);
    else if (near < -0.5) rock(x, z, 1.25 + rng() * 0.8, 1.0 + rng() * 1.3, 0.25);
    else rock(x, z, 1.0 + rng() * 0.6, 0.7 + rng() * 0.9, 0.3);
  });

  // Crags behind and beside each far castle, so it stands against rock, not sky;
  // lower rock round the near ones, which must not hide the board. Places are
  // given as [back from the castle's centre, along its front wall, width, height].
  for (const s of seats) {
    const crags: [number, number, number, number][] = s.far
      ? [
          [s.reach + 0.8, 0, 2.0, 5.4],
          [s.reach * 0.45, s.wallHalf + 0.55, 1.7, 4.2],
          [s.reach * 0.45, -(s.wallHalf + 0.55), 1.7, 3.8],
          [s.reach + 0.3, s.wallHalf * 0.6, 1.5, 3.4],
          [s.reach + 0.3, -s.wallHalf * 0.6, 1.5, 3.1],
          [-s.reach * 0.35, s.wallHalf + 1.1, 1.6, 2.9],
          [-s.reach * 0.35, -(s.wallHalf + 1.1), 1.6, 2.6],
        ]
      : [
          [s.reach + 0.6, 0, 1.6, 1.3],
          [0, s.wallHalf + 0.9, 1.3, 1.5],
          [0, -(s.wallHalf + 0.9), 1.3, 1.2],
        ];
    for (const [back, along, width, height] of crags) {
      rock(
        s.x - s.inward[0] * back + s.inward[1] * along,
        s.z - s.inward[1] * back - s.inward[0] * along,
        width,
        height,
        0.25,
      );
    }
  }
  // An outcrop part-way down each side.
  for (const su of [-1, 1]) {
    const side = su * (edgeU - (portrait ? 1.3 : 0.75));
    const outcrop: [number, number, number, number][] = [
      [0, 0.9, 2.1, 2.7],
      [su * 0.3, -0.8, 1.6, 1.8],
      [-su * 0.7, 2.3, 1.3, 1.2],
    ];
    for (const [du, v, width, height] of outcrop) {
      const [x, z] = toWorld(side + du, v);
      rock(x, z, width, height, 0.25);
    }
  }

  if (river) {
    // Rocks at the head of the river, where it springs from.
    rock(-1.3, -RIVER_END - 0.1, 1.6, 1.6, 0.3);
    rock(1.25, -RIVER_END - 0.2, 1.8, 2.0, 0.3);
    rock(0, -RIVER_END - 0.8, 2.0, 1.4, 0.3);
    // Stones along both banks, clear of the two bridges.
    const bridges = [4, 8].map((row) => row - ROWS / 2 + 0.5);
    for (const side of [-1, 1]) {
      for (let z = -RIVER_END + 0.9; z < RIVER_END - 0.2; z += 0.4 + rng() * 0.4) {
        if (bridges.some((b) => Math.abs(z - b) < 0.8) || rng() < 0.12) continue;
        const size = 0.42 + rng() * 0.36;
        rock(side * (RIVER_HALF - 0.08 + jitter(0.1)), z, size, size * (0.6 + rng() * 0.3), 0, -0.36);
      }
    }
    // A few stones standing in the stream.
    const midstream: [number, number][] = [[-0.35, -3.4], [0.4, 0.6], [-0.2, 4.7], [0.5, 6.3]];
    for (const [x, z] of midstream) rock(x, z, 0.45 + rng() * 0.2, 0.34, 0, -0.66);
  }
  const onStone = (x: number, z: number, pad = 0.25) => stones.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + pad);

  // ── Woodland ──
  // Trees grow the way a wood does: packed at the back, thinning towards
  // the board, in clumps with gaps between them. No two stand closer than
  // overlapping crowns allow, which keeps the clumps from turning into a tangle.
  const stand: { x: number; z: number; r: number }[] = [];
  const shade = new THREE.Color();
  /** Plants a tree at a spot on the ground, if there is room. `amongRocks` lets it stand between the crags. */
  const plant = (x: number, z: number, size: number, amongRocks = false): boolean => {
    // Trees round a castle stand closer together than those in the open wood.
    const r = size * (amongRocks ? 0.13 : 0.17);
    // Never on the playing field, nor so near that the branches hang over its tiles.
    const clear = 0.45 + size * 0.22;
    if (Math.abs(x) < gridX + clear && Math.abs(z) < gridZ + clear) return false;
    if (!insideIsland(x, z, 0.45) || onRiver(x) || inCastle(x, z, amongRocks ? 0.15 : 0.5) || beforeGate(x, z)) return false;
    if (!amongRocks && onStone(x, z, -0.1)) return false;
    if (stand.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + r)) return false;
    stand.push({ x, z, r });
    // Each tree is a slightly different green, as in any real wood.
    shade.set(TREE_TINT).multiplyScalar(0.9 + rng() * 0.18);
    // Mostly pines, with a broadleaf here and there.
    trees[rng() < 0.2 ? 2 : rng() < 0.5 ? 1 : 0].push({
      position: [x, GROUND, z],
      scale: [size, size * (0.94 + rng() * 0.14), size],
      rotation: rng() * Math.PI * 2,
      color: `#${shade.getHexString()}`,
    });
    return true;
  };
  const tree = (u: number, v: number, size: number) => plant(...toWorld(u, v), size);
  /** Roughly bell-shaped random offset, for clumps that are dense in the middle. */
  const spread = (width: number) => (rng() + rng() - 1) * width;

  // The wood behind the board: denser and taller the further back it goes.
  const bandNear = gridV + 0.55;
  const bandDepth = edgeV - bandNear;
  for (let i = 0; i < 2600; i++) {
    const u = (rng() - 0.5) * 2 * edgeU;
    const depth = rng();
    if (rng() > 0.35 + depth * 0.65) continue;
    tree(u, bandNear + depth * bandDepth, 1.3 + depth * 0.9 + jitter(0.22));
  }

  // Down each side: copses with open lawn between them. The one nearest the
  // camera is small and low, a few saplings beside the near castles.
  const sideNear = gridU + 0.8;
  const sideWidth = edgeU - sideNear;
  for (const side of [-1, 1]) {
    for (const copse of [
      { v: gridV * 0.55, count: 34, size: 1.25, vary: 0.8 },
      { v: -gridV * 0.2, count: 30, size: 1.2, vary: 0.7 },
      { v: -gridV * 0.72, count: 10, size: 0.9, vary: 0.35 },
    ]) {
      const at = copse.v + jitter(0.5);
      for (let i = 0; i < copse.count; i++) {
        tree(side * (sideNear + rng() * sideWidth), at + spread(1.25), copse.size + rng() * copse.vary);
      }
    }
  }

  // Pines round each castle, behind it and to its sides, standing among the crags:
  // taller round the far castles, lower round the near ones.
  for (const s of seats) {
    for (let i = 0; i < 420; i++) {
      const across = (rng() - 0.5) * 2 * (s.halfAcross + 3.4);
      const back = -s.halfDeep - 2.8 + rng() * (s.halfDeep * 2 + 3.8);
      plant(
        s.x + s.along[0] * across + s.gate[0] * back,
        s.z + s.along[1] * across + s.gate[1] * back,
        (s.far ? 1.5 : 1.15) + rng() * (s.far ? 0.9 : 0.55),
        true,
      );
    }
  }

  // ── Undergrowth ──
  // Bushes gather at the foot of the rocks and along the edge of the wood.
  const bush = (x: number, z: number, size: number) => {
    if (!insideIsland(x, z, 0.3) || onRiver(x) || inCastle(x, z, 0.1) || beforeGate(x, z)) return;
    bushes.push({
      position: [x, GROUND + size * 0.22, z],
      scale: [size * (0.9 + rng() * 0.5), size * 0.62, size * (0.9 + rng() * 0.5)],
      rotation: rng() * Math.PI,
      color: pick(BUSH),
    });
  };
  for (const s of stones) {
    if (rng() < 0.45) continue;
    const a = rng() * Math.PI * 2;
    bush(s.x + Math.cos(a) * (s.r + 0.2), s.z + Math.sin(a) * (s.r + 0.2), 0.4 + rng() * 0.45);
  }
  for (let i = 0; i < 24; i++) {
    const [x, z] = toWorld((rng() - 0.5) * 2 * edgeU, bandNear - 0.15 + rng() * 0.5);
    bush(x, z, 0.4 + rng() * 0.4);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const [x, z] = toWorld(side * (sideNear + rng() * sideWidth), (rng() - 0.5) * 2 * gridV);
      bush(x, z, 0.38 + rng() * 0.36);
    }
  }

  // ── Grass and flowers ──
  for (let i = 0; i < 320; i++) {
    const x = (rng() - 0.5) * ISLAND_W;
    const z = (rng() - 0.5) * ISLAND_D;
    const inGrid = Math.abs(x) < gridX + 0.4 && Math.abs(z) < gridZ + 0.4;
    if (inGrid || onRiver(x) || !insideIsland(x, z, 0.3) || inCastle(x, z, 0)) continue;
    const s = 0.9 + rng() * 0.8;
    tufts.push({ position: [x, GROUND, z], scale: [s, s, s], rotation: rng() * Math.PI, color: TUFT_COLOR });
  }
  // Small drifts of flowers: some round the edge of the lawn, some on the board itself.
  const drift = (cx: number, cz: number) => {
    if (onRiver(cx, 0.3) || !insideIsland(cx, cz, 0.5) || inCastle(cx, cz, 0)) return;
    const colour = pick(FLOWERS);
    const n = 5 + Math.floor(rng() * 5);
    for (let i = 0; i < n; i++) {
      flowers.push({
        position: [cx + spread(0.34), GROUND + 0.07, cz + spread(0.34)],
        scale: [1, 1, 1],
        rotation: 0,
        color: rng() < 0.75 ? colour : pick(FLOWERS),
      });
    }
  };
  for (let i = 0; i < 26; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    if (rng() < 0.5) drift(side * (gridX + 0.6 + rng() * 1.6), (rng() - 0.5) * ISLAND_D);
    else drift((rng() - 0.5) * ISLAND_W, side * (gridZ + 0.5 + rng() * 1.2));
  }
  for (let i = 0; i < 16; i++) {
    // On the board they sit at tile corners, out from under the pieces.
    const cx = Math.round((rng() - 0.5) * 2 * (gridX - 1));
    const cz = Math.round((rng() - 0.5) * 2 * (gridZ - 1));
    drift(cx + jitter(0.12), cz + jitter(0.12));
  }

  return { trees, rocks, tufts, bushes, flowers };
}

export function Decor() {
  const view = useView();
  const data = useMemo(() => buildDecor(view), [view]);

  return (
    <group>
      {data.rocks.map((items, i) => (
        <Instances key={i} items={items} geometry={rockGeos[i]} material={rockMaterial} />
      ))}
      {CUSTOM_TREES.length > 0 ? (
        <GeneratedWood trees={data.trees} />
      ) : (
        data.trees.map((items, i) => (
          <Instances key={i} items={items} geometry={TREE_SHAPES[i]} material={foliageMaterial} />
        ))
      )}
      <Instances items={data.bushes} geometry={bushGeo} material={leafy} />
      <Instances items={data.tufts} geometry={tuftGeo} material={matte} castShadow={false} />
      <Instances items={data.flowers} geometry={flowerGeo} material={petal} castShadow={false} />
    </group>
  );
}
