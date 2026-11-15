import * as THREE from 'three';
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
 * What a view has to show, in tiles, measured along the line of sight from
 * the middle of the board. `near` is how far the island reaches towards the
 * camera, `cliff` how much of the cliff under that edge to include, `across`
 * the width to fit on a narrow screen, and `bottom` the share of the screen's
 * height the bottom HUD covers.
 */
interface Subject {
  /**
   * The things at the far end that reach highest up the screen: how far beyond
   * the middle of the board each stands, how tall it is, and the share of the
   * screen's height that must stay clear above it for the HUD.
   */
  tops: { away: number; height: number; clear: number }[];
  near: number;
  cliff: number;
  across: number;
  bottom: number;
}

const WIDE: Subject = {
  tops: [
    // The waiting die, which hangs under the crest in the middle of the top bar.
    { away: 6.9, height: 5.3, clear: 0.095 },
    // The crags behind the far castles, under the buttons in the top corners.
    { away: 8.8, height: 4.0, clear: 0.065 },
  ],
  near: 8.8,
  cliff: 2.2,
  across: 33,
  bottom: 0.13,
};
// On an upright phone the board runs up the screen. Width is what is scarce
// there, so only the board itself must fit across; the far castles must still
// clear the top bar.
const UPRIGHT: Subject = {
  tops: [
    // The two far castles with their hit-point gems, and the die between them.
    // The crags behind them may run up under the top bar: they are only rock.
    { away: 12.2, height: 3.4, clear: 0.065 },
    { away: 12.4, height: 3.2, clear: 0.065 },
  ],
  near: 14.7,
  cliff: 0.5,
  // The island from its wooded edge to its cliff edge, with a sliver of sky each side.
  across: 16.6,
  bottom: 0.13,
};
/**
 * The island is deeper behind the board, where the wood is, than in front of
 * it, where the cliff is (island.ts: 8.95 tiles against 7.3). On an upright
 * phone those are the left and right of the screen, so the camera aims this
 * far off the middle of the board to keep the island in the middle of the screen.
 */
const UPRIGHT_ASIDE = (7.3 - 8.95) / 2;

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
  // How far the island reaches down the screen from the middle of the board,
  // and how far each tall thing at the far end reaches up it.
  const low = s.near * sin + s.cliff * cos;
  const highs = s.tops.map((t) => ({ reach: t.away * sin + t.height * cos, clear: t.clear }));
  const span = Math.max(...highs.map((h) => (h.reach + low) / (1 - h.clear - s.bottom)), s.across / aspect);
  const distance = THREE.MathUtils.clamp(span / SPAN, 20, MAX_DISTANCE);

  // Where to aim. Aiming further away slides everything down the screen. The
  // aim point may lie anywhere between the place that brings the near cliff
  // down to the bottom bar and the place that brings the tallest thing up to
  // its limit; on a screen with room to spare, take the middle of the two.
  // `away` is how far that point lies beyond the middle of the board.
  const forCliff = (0.5 - s.bottom) * span - low;
  const forTops = Math.max(...highs.map((h) => h.reach - (0.5 - h.clear) * span));
  const away = (forCliff + forTops) / 2 / sin;
  const target = portrait ? new THREE.Vector3(away, 0, UPRIGHT_ASIDE) : new THREE.Vector3(0, 0, -away);
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
