import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../theme';

const TRUNK = new THREE.Color('#5a3d24');
const PINE_DEEP = new THREE.Color('#1c4f2a');
const PINE_LIT = new THREE.Color('#57a03f');
const LEAF_DEEP = new THREE.Color('#4a7426');
const LEAF_LIT = new THREE.Color('#a3b94a');

/**
 * Gives a shape one flat colour per face, chosen from the height of the face,
 * so the foliage is dark underneath and catches light on top.
 */
function paint(shape: THREE.BufferGeometry, colour: (y: number, into: THREE.Color) => void, rng: () => number) {
  const geometry = shape.toNonIndexed();
  geometry.deleteAttribute('uv');
  const position = geometry.getAttribute('position');
  const colours = new Float32Array(position.count * 3);
  const shade = new THREE.Color();
  for (let i = 0; i < position.count; i += 3) {
    colour((position.getY(i) + position.getY(i + 1) + position.getY(i + 2)) / 3, shade);
    shade.multiplyScalar(0.86 + rng() * 0.28);
    for (let k = 0; k < 3; k++) colours.set([shade.r, shade.g, shade.b], (i + k) * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Joins the parts of a tree and stands it on y = 0, one unit tall. */
function finish(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const tree = mergeGeometries(parts)!;
  tree.computeBoundingBox();
  const box = tree.boundingBox!;
  const height = box.max.y - box.min.y;
  return tree.translate(0, -box.min.y, 0).scale(1 / height, 1 / height, 1 / height);
}

/** A pine: skirts of needles stacked up a short trunk, each a little smaller than the one below. */
function pine(seed: number, tiers: number, girth: number): THREE.BufferGeometry {
  const rng = mulberry32(seed);
  const parts = [paint(new THREE.CylinderGeometry(0.05, 0.085, 0.3, 6).translate(0, 0.15, 0), (_, c) => c.copy(TRUNK), rng)];
  const rise = 0.9 / tiers;
  for (let i = 0; i < tiers; i++) {
    const k = i / (tiers - 1);
    const radius = girth * (1 - k * 0.68);
    const height = rise * 1.75;
    const base = 0.2 + i * rise;
    const skirt = new THREE.ConeGeometry(radius, height, 7, 1)
      .rotateY(rng() * Math.PI)
      .translate((rng() - 0.5) * 0.04, base + height / 2, (rng() - 0.5) * 0.04);
    // Lighter towards the tip of each skirt, and towards the top of the tree.
    parts.push(paint(skirt, (y, c) => c.copy(PINE_DEEP).lerp(PINE_LIT, Math.min(1, ((y - base) / height) * 0.75 + k * 0.4)), rng));
  }
  return finish(parts);
}

/** A broadleaf tree: a few rounded masses of leaves on a taller trunk. */
function broadleaf(seed: number): THREE.BufferGeometry {
  const rng = mulberry32(seed);
  const parts = [paint(new THREE.CylinderGeometry(0.055, 0.09, 0.5, 6).translate(0, 0.25, 0), (_, c) => c.copy(TRUNK), rng)];
  const masses: [number, number, number, number][] = [
    [0, 0.72, 0, 0.36],
    [0.22, 0.6, 0.06, 0.26],
    [-0.2, 0.62, -0.08, 0.27],
    [0.02, 0.58, 0.22, 0.24],
    [-0.04, 0.9, -0.04, 0.24],
  ];
  for (const [x, y, z, r] of masses) {
    const mass = new THREE.IcosahedronGeometry(r, 1).rotateY(rng() * Math.PI).scale(1, 0.82, 1).translate(x, y, z);
    parts.push(paint(mass, (h, c) => c.copy(LEAF_DEEP).lerp(LEAF_LIT, Math.min(1, Math.max(0, (h - 0.42) / 0.6))), rng));
  }
  return finish(parts);
}

/** The trees the woods are made of: two pines and a broadleaf. */
export const TREE_SHAPES: THREE.BufferGeometry[] = [pine(5, 5, 0.36), pine(17, 4, 0.42), broadleaf(31)];

export const foliageMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.95,
  metalness: 0,
});
