import * as THREE from 'three';
import { COLS, ROWS } from '../theme';
import type { View } from './view';

/** Camera pitch above the horizon, the classic top-down strategy angle. */
const PITCH = THREE.MathUtils.degToRad(48);
/** Steeper on phones, so the far end of the long board does not shrink too much. */
const PITCH_PORTRAIT = THREE.MathUtils.degToRad(60);

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

/** Shifted towards the camera so the cliff under the near edge shows above the HUD. */
const FOCUS: [number, number, number] = [0, 0, 2.6];
/** Shifted towards the camera so the board sits above the taller bottom HUD. */
const FOCUS_PORTRAIT: [number, number, number] = [-2.7, 0, 0];

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

  // World units that must fit across the screen and up the screen. The extra
  // rows leave room for the HUD bars above and below the board. The width is
  // generous because the edge nearest the camera looks wider than the middle,
  // and the corner castles sit right on it.
  const across = portrait ? ROWS + 2.6 : COLS + 12;
  const upScreen = portrait ? COLS + 6.5 : ROWS + 11;
  const distance = THREE.MathUtils.clamp(
    Math.max(across / (SPAN * aspect), (upScreen * Math.sin(pitch)) / SPAN),
    20,
    MAX_DISTANCE,
  );

  // Landscape looks from the front edge (+Z); portrait from the blue/green end (-X).
  const dir = portrait
    ? new THREE.Vector3(-Math.cos(pitch), Math.sin(pitch), 0)
    : new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch));

  return { target: new THREE.Vector3(...(portrait ? FOCUS_PORTRAIT : FOCUS)), distance, dir, pitch };
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
