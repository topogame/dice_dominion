import * as THREE from 'three';
import { ROWS } from '../theme';
import type { View } from './view';

/** Camera pitch above the horizon, the classic top-down strategy angle. */
const PITCH = THREE.MathUtils.degToRad(48);
/** A little steeper on phones, where the long board runs up the screen. */
const PITCH_PORTRAIT = THREE.MathUtils.degToRad(52);

/**
 * A long lens, far away: the far edge of the board then looks almost as wide
 * as the near edge, as in the concept picture, and the castles at its four
 * corners line up one above the other.
 */
export const CAMERA_FOV = 12;
export const MAX_DISTANCE = 220;
/** As close as the player may zoom in. */
export const MIN_DISTANCE = 30;
/** Height of the view at distance 1, from the field of view. */
export const SPAN = 2 * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV) / 2);

/**
 * What a view has to show, in tiles. `depth` is measured along the line of
 * sight from the middle of the board: how far the island reaches away from the
 * camera and towards it. `tall` is the height of what stands at the far edge
 * (castles, crags, the waiting die), `cliff` how much of the cliff under the
 * near edge to include, `across` the width to fit on a narrow screen, and
 * `top` and `bottom` the share of the screen's height the HUD bars cover.
 */
interface Subject {
  far: number;
  near: number;
  tall: number;
  cliff: number;
  across: number;
  top: number;
  bottom: number;
}

const WIDE: Subject = { far: 9.2, near: 8.8, tall: 5.2, cliff: 2.2, across: 33, top: 0.085, bottom: 0.13 };
// On an upright phone the board runs up the screen. Width is what is scarce
// there, so only the board itself must fit across; the far castles must still
// clear the top bar.
const UPRIGHT: Subject = { far: 14.9, near: 14.7, tall: 4.2, cliff: 0.5, across: ROWS + 2.6, top: 0.09, bottom: 0.13 };

export interface Pose {
  target: THREE.Vector3;
  distance: number;
}

export interface Framing extends Pose {
  /** Unit vector from the focus point to the camera; fixed for a view because rotation is off. */
  dir: THREE.Vector3;
  pitch: number;
}

/**
 * The camera position that shows the whole board for a screen of the given
 * shape. The game starts every match here, and painted backdrops are drawn
 * for exactly this view.
 */
export function overviewFraming(view: View, aspect: number): Framing {
  const portrait = view === 'portrait';
  const pitch = portrait ? PITCH_PORTRAIT : PITCH;

  // Landscape looks from the front edge (+Z); portrait from the blue/green end (-X).
  const dir = portrait
    ? new THREE.Vector3(-Math.cos(pitch), Math.sin(pitch), 0)
    : new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch));

  // Seen from this angle, a tile of ground takes sin(pitch) of its depth up
  // the screen and anything standing on it takes cos(pitch) of its height.
  // The island with what stands on it must fit between the two HUD bars
  // whatever the shape of the screen, and across it on a narrow one.
  const s = portrait ? UPRIGHT : WIDE;
  const sin = Math.sin(pitch);
  const cos = Math.cos(pitch);
  const tall = (s.far + s.near) * sin + (s.tall + s.cliff) * cos;
  const span = Math.max(tall / (1 - s.top - s.bottom), s.across / aspect);
  const distance = THREE.MathUtils.clamp(span / SPAN, 20, MAX_DISTANCE);

  // Aim at the point on the ground that puts the middle of all that in the
  // middle of the clear part of the screen, which lies a little above centre.
  // `away` is how far that point lies beyond the middle of the board.
  const middle = ((s.bottom - s.top) / 2) * span;
  const away = (s.far - s.near) / 2 - (middle - ((s.tall - s.cliff) / 2) * cos) / sin;
  const target = portrait ? new THREE.Vector3(away, 0, 0) : new THREE.Vector3(0, 0, -away);
  return { target, distance, dir, pitch };
}

/** A stand-alone camera placed at the overview, for projecting a backdrop painted from it. */
export function overviewCamera(view: View, aspect: number): THREE.PerspectiveCamera {
  const f = overviewFraming(view, aspect);
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, aspect, 1, 400);
  camera.position.copy(f.target).addScaledVector(f.dir, f.distance);
  camera.lookAt(f.target);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
}
