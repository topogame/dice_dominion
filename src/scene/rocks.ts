import * as THREE from 'three';
import { mulberry32 } from '../theme';

/** Cheap lumpy noise over a direction, enough to knock a sphere out of shape. */
function lumps(x: number, y: number, z: number, s: number): number {
  return (
    Math.sin(x * 1.9 + s) * Math.sin(y * 2.3 + s * 1.7) * Math.sin(z * 2.1 + s * 0.6) +
    0.5 * Math.sin(x * 4.3 + s * 2.1) * Math.sin(y * 3.7 + s) * Math.sin(z * 4.9 + s * 1.3)
  );
}

const STONE = new THREE.Color('#989aa1');
const STONE_WARM = new THREE.Color('#b3a892');
const MOSS = new THREE.Color('#5f7d36');

/**
 * A faceted boulder, one unit tall, standing on y = 0. Its upward faces are
 * mossy and the rest is grey stone, each face a slightly different shade so
 * the facets catch the eye. `detail` 1 gives a chunky rock, 2 a craggier one.
 */
export function rockGeometry(seed: number, detail: 1 | 2 = 1): THREE.BufferGeometry {
  const rng = mulberry32(seed * 7919 + 13);
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).normalize();
    // Displacement depends only on direction, so the copies of a shared corner stay together.
    // Stepping the bulge leaves flat planes with hard breaks between them, like split stone.
    const r = 1 + (0.36 * Math.round(lumps(v.x, v.y, v.z, seed) * 2.2)) / 2.2;
    v.multiplyScalar(r);
    // A flat underside to sit on.
    v.y = Math.max(v.y, -0.5);
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const height = box.max.y - box.min.y;
  geometry.translate(0, -box.min.y, 0).scale(1 / height, 1 / height, 1 / height);
  geometry.computeVertexNormals();

  const normal = geometry.getAttribute('normal') as THREE.BufferAttribute;
  const colours = new Float32Array(position.count * 3);
  const shade = new THREE.Color();
  for (let i = 0; i < position.count; i += 3) {
    // One colour per triangle: the three corners of a face share a normal.
    const up = normal.getY(i);
    const y = (position.getY(i) + position.getY(i + 1) + position.getY(i + 2)) / 3;
    // Moss only on the flattest tops.
    if (up > 0.9 && y > 0.6) shade.copy(MOSS).multiplyScalar(0.85 + rng() * 0.35);
    else shade.copy(STONE).lerp(STONE_WARM, rng() * 0.6).multiplyScalar((0.68 + rng() * 0.42) * (0.78 + 0.22 * Math.min(1, y * 2.2)));
    for (let k = 0; k < 3; k++) colours.set([shade.r, shade.g, shade.b], (i + k) * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geometry;
}

/** The handful of boulder shapes the scenery is built from. */
export const ROCK_SHAPES: { seed: number; detail: 1 | 2 }[] = [
  { seed: 3, detail: 1 },
  { seed: 11, detail: 1 },
  { seed: 19, detail: 1 },
  { seed: 27, detail: 2 },
  { seed: 41, detail: 2 },
];

export const rockMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.95,
  metalness: 0,
});
