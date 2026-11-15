import * as THREE from 'three';
import { mulberry32 } from '../theme';

/**
 * The shape of the floating island, shared by everything that stands on it
 * or hangs from it. The board is 24x12 tiles centred on the origin; the
 * island is a rounded rectangle around it, pulled in along the middle of
 * each side and roughened, so the castles stand on headlands at the corners.
 */
const HX = 15.4;
const HZ = 9.4;
const CORNER = 2.0;

/** Where the river runs off the island, front and back. */
export const RIVER_END = 7.3;
/** Overall size of the island, for laying out scenery. */
export const ISLAND_W = HX * 2;
export const ISLAND_D = HZ * 2;

export interface EdgePoint {
  x: number;
  z: number;
  /** Unit vector pointing out of the island at this point. */
  nx: number;
  nz: number;
}

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A point on the plain rounded rectangle, `s` units round its perimeter. */
function roundedRect(s: number): EdgePoint {
  const ex = HX - CORNER;
  const ez = HZ - CORNER;
  const arc = (Math.PI / 2) * CORNER;
  // Right side, then each corner and side in turn, going round towards the front.
  const pieces: [number, (t: number) => EdgePoint][] = [
    [2 * ez, (t) => ({ x: HX, z: -ez + t, nx: 1, nz: 0 })],
    [arc, (t) => corner(ex, ez, 0, t)],
    [2 * ex, (t) => ({ x: ex - t, z: HZ, nx: 0, nz: 1 })],
    [arc, (t) => corner(-ex, ez, Math.PI / 2, t)],
    [2 * ez, (t) => ({ x: -HX, z: ez - t, nx: -1, nz: 0 })],
    [arc, (t) => corner(-ex, -ez, Math.PI, t)],
    [2 * ex, (t) => ({ x: -ex + t, z: -HZ, nx: 0, nz: -1 })],
    [arc, (t) => corner(ex, -ez, (3 * Math.PI) / 2, t)],
  ];
  let left = s;
  for (const [length, at] of pieces) {
    if (left <= length) return at(left);
    left -= length;
  }
  return pieces[0][1](0);
}

function corner(cx: number, cz: number, from: number, t: number): EdgePoint {
  const a = from + t / CORNER;
  return { x: cx + Math.cos(a) * CORNER, z: cz + Math.sin(a) * CORNER, nx: Math.cos(a), nz: Math.sin(a) };
}

const PERIMETER = 4 * (HX - CORNER) + 4 * (HZ - CORNER) + 2 * Math.PI * CORNER;
const EDGE_POINTS = 132;

/** The island's edge at grass level, as a closed loop of points. */
export const OUTLINE: EdgePoint[] = Array.from({ length: EDGE_POINTS }, (_, i) => {
  const s = (i / EDGE_POINTS) * PERIMETER;
  const p = roundedRect(s);
  const alongFront = Math.abs(p.nz) > 0.9;
  const alongSide = Math.abs(p.nx) > 0.9;
  // The long sides bow inwards between the castles, the short sides a little.
  let inward = 0;
  // The front bows in a long way, to show its cliff; the back hardly at all, to leave room for a wood.
  if (alongFront) inward = (p.nz > 0 ? 2.1 : 0.45) * (1 - smooth(4.5, 10.5, Math.abs(p.x)));
  if (alongSide) inward = 0.95 * (1 - smooth(1.5, 5, Math.abs(p.z)));
  // A ragged edge, except where the river leaves the island.
  const calm = alongFront ? smooth(1.4, 3.2, Math.abs(p.x)) : 1;
  const rough = (0.26 * Math.sin(s * 1.31 + 0.7) + 0.17 * Math.sin(s * 2.9 + 2.0) + 0.1 * Math.sin(s * 6.1 + 4.1)) * calm;
  const out = rough - inward;
  return { x: p.x + p.nx * out, z: p.z + p.nz * out, nx: p.nx, nz: p.nz };
});

/** True if the point lies on the island, at least `pad` units from its edge. */
export function insideIsland(x: number, z: number, pad = 0): boolean {
  let inside = false;
  let nearest = Infinity;
  for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
    const a = OUTLINE[i];
    const b = OUTLINE[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
    // Distance from the point to this stretch of the edge.
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    nearest = Math.min(nearest, Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)));
  }
  return inside && nearest >= pad;
}

/** Cuts a polygon down to the part where `keep` holds, along the line x = `at`. */
function clipAtX(points: [number, number][], at: number, keepRight: boolean): [number, number][] {
  const keep = (p: [number, number]) => (keepRight ? p[0] >= at : p[0] <= at);
  const out: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (keep(a)) out.push(a);
    if (keep(a) !== keep(b)) {
      const t = (at - a[0]) / (b[0] - a[0]);
      out.push([at, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/**
 * The lawn on top of the island. With a river, it comes in two pieces with
 * the channel between them. Texture coordinates are in world units.
 */
export function lawnGeometries(riverHalf: number): THREE.BufferGeometry[] {
  const loop = OUTLINE.map((p): [number, number] => [p.x, p.z]);
  const pieces = riverHalf > 0 ? [clipAtX(loop, -riverHalf, false), clipAtX(loop, riverHalf, true)] : [loop];
  return pieces.map((piece) => {
    const shape = new THREE.Shape(piece.map(([x, z]) => new THREE.Vector2(x, -z)));
    return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  });
}

// Rings of the rock the island is made of, from the turf at the top down to
// the point it tapers to. Each is the edge loop drawn in towards the middle.
const RINGS = [
  { y: 0, scale: 1, out: 0, wobble: 0, drop: 0 },
  { y: -0.4, scale: 1, out: 0.2, wobble: 0.05, drop: 0.08 },
  // The cliffs stand a little proud of the turf, so they face the camera above them.
  { y: -3.0, scale: 1, out: 0.55, wobble: 0.32, drop: 0.45 },
  { y: -5.8, scale: 0.975, out: 0.25, wobble: 0.5, drop: 0.6 },
  { y: -8.2, scale: 0.72, out: 0, wobble: 0.6, drop: 0.9 },
  { y: -10.4, scale: 0.36, out: 0, wobble: 0.5, drop: 0.8 },
];
const TIP_Y = -12.6;

const TURF = new THREE.Color('#6a7a3c');
const ROCK_HIGH = new THREE.Color('#9c9586');
const ROCK_DEEP = new THREE.Color('#3a4670');

/**
 * The body of the island: faceted cliffs under the lawn that draw in to a
 * point far below, which is what makes it read as floating.
 */
export function rockGeometry(): THREE.BufferGeometry {
  const rng = mulberry32(977);
  const n = OUTLINE.length;
  const rings = RINGS.map((ring) =>
    OUTLINE.map((p) => {
      // The lip stays tidy where the waterfall goes over it.
      const calm = Math.abs(p.nz) > 0.9 ? smooth(1.2, 2.6, Math.abs(p.x)) : 1;
      const r = ring.out * calm + (rng() - 0.5) * 2 * ring.wobble;
      return new THREE.Vector3(
        (p.x + p.nx * r) * ring.scale,
        ring.y + (rng() - 0.5) * 2 * ring.drop,
        (p.z + p.nz * r) * ring.scale,
      );
    }),
  );

  const positions: number[] = [];
  const colours: number[] = [];
  const shade = new THREE.Color();
  const face = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, turf: boolean) => {
    const depth = Math.min(1, Math.max(0, -(a.y + b.y + c.y) / 3 / 11.5));
    if (turf) shade.copy(TURF);
    else shade.copy(ROCK_HIGH).lerp(ROCK_DEEP, Math.pow(depth, 1.6));
    shade.multiplyScalar(0.8 + rng() * 0.36);
    for (const v of [a, b, c]) {
      positions.push(v.x, v.y, v.z);
      colours.push(shade.r, shade.g, shade.b);
    }
  };

  for (let k = 0; k < rings.length - 1; k++) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = rings[k][i];
      const b = rings[k][j];
      const c = rings[k + 1][i];
      const d = rings[k + 1][j];
      // Wound so the faces look outwards.
      face(a, b, c, k === 0);
      face(b, d, c, k === 0);
    }
  }
  const tip = new THREE.Vector3(0.6, TIP_Y, 0.3);
  const last = rings[rings.length - 1];
  for (let i = 0; i < n; i++) face(last[i], last[(i + 1) % n], tip, false);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  return geometry;
}
