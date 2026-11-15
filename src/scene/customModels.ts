import type { PlayerColor } from '../types/GameTypes';
import { COLS, ROWS } from '../theme';

/**
 * A castle made for one kingdom, shown in place of the stock model. The files
 * live in public/models/custom and are prepared by scripts/prepare-custom-model.mjs.
 */
export interface CustomCastle {
  /** File name inside public/models/custom. */
  file: string;
  /** Size of the model's longest side on the ground, in tiles. The plot itself is 2x2. */
  size: number;
  /** Turn about the vertical axis that brings the gate round to the model's own front, in radians. */
  yaw: number;
  /**
   * The ground its walls cover, across the gate front and from front to back,
   * as fractions of `size`. Banners and flags that stick out are not counted.
   */
  walls: [number, number];
  /** Strength of the glow given to lit windows and flames painted into the texture. */
  glow: number;
  /** The kingdom whose colours the model wears as made; for any other it is repainted. */
  paintedFor: PlayerColor;
}

const BLUE_CASTLE: CustomCastle = {
  file: 'castle_blue.glb',
  size: 4.6,
  yaw: 0,
  walls: [0.918, 0.702],
  glow: 1.3,
  paintedFor: 'blue',
};

/**
 * Kingdoms without an entry keep the stock castle. Until the other three
 * kingdoms have castles of their own, they borrow the blue one, repainted.
 */
export const CUSTOM_CASTLES: Partial<Record<PlayerColor, CustomCastle>> = {
  blue: BLUE_CASTLE,
  yellow: BLUE_CASTLE,
  green: BLUE_CASTLE,
  red: BLUE_CASTLE,
};

/** The castle the scenery makes room for at every corner, whichever kingdom stands there. */
export const TYPICAL_CASTLE = BLUE_CASTLE;

/**
 * A squad of soldiers made as one piece, standing on a tile in place of the
 * stock knight: a tabletop miniature, with no skeleton to animate.
 */
export interface CustomSquad {
  /** File name inside public/models/custom. */
  file: string;
  /** Size of the model's longest side on the ground, in tiles. */
  size: number;
  /** Turn about the vertical axis that brings the squad round to face the model's own front, in radians. */
  yaw: number;
  /** The kingdom whose colours the model wears as made; for any other it is repainted. */
  paintedFor: PlayerColor;
}

/** A generated tree for the woods. */
export interface CustomTree {
  /** File name inside public/models/custom. */
  file: string;
  kind: 'pine' | 'broadleaf';
}

/**
 * Generated trees, scattered through the woods in place of the ones made in
 * code. A kind with no model of its own borrows the other kind's.
 */
export const CUSTOM_TREES: CustomTree[] = [{ file: 'tree_pine_1.glb', kind: 'pine' }];

/** Null until a squad model has been made; the stock knight is used meanwhile. */
export const CUSTOM_SQUAD: CustomSquad | null = null;

/** Size of a custom castle on an upright phone, relative to its size on a wide screen. */
export const PORTRAIT_FIT = 0.72;
/**
 * How far a castle's wall stands in from the diagonal across its plot, towards
 * the board: enough to cover the three tiles it takes up and to set its foot on
 * the corner of the fourth.
 */
export const CASTLE_FORWARD = 0.32;

/** Where a custom castle stands, and which way. Pairs of numbers are [x, z] on the ground. */
export interface CastleSeat {
  /** Centre of the castle. */
  x: number;
  z: number;
  /** Turn of the model about the vertical axis. */
  turn: number;
  /** Unit vectors: the way the gate faces, and along the gate front. */
  gate: [number, number];
  along: [number, number];
  halfAcross: number;
  halfDeep: number;
  /** Middle of the 2x2 plot, and the unit vector from there to the middle of the board. */
  plot: [number, number];
  inward: [number, number];
  /** Half the length of the wall the castle shows the board, and how far it reaches back from it. */
  wallHalf: number;
  reach: number;
  /** True for the two castles on the far side of the board from the camera. */
  far: boolean;
  /** Size of the castle here relative to the size its model was given. */
  scale: number;
}

/**
 * How much larger the two far castles are built than the near ones. The far
 * edge of the board is a little further from the camera than the near edge,
 * which would otherwise leave them looking small.
 */
const FAR_SCALE = 1.1;
const FAR_SCALE_PORTRAIT = 1.07;

/**
 * A custom castle stands across its corner of the board, turned an eighth of
 * a circle so its gate looks at the camera and in towards the field. It covers
 * three tiles of its 2x2 plot (the corner tile and the two beside it) with one
 * wall across them (the gate front for the far castles, a side wall for the
 * near ones); the fourth tile lies open before it. The board draws the
 * kingdom's border round the castle in steps, along the edges of those tiles.
 * `sx` and `sz` are -1 or 1 and say which corner.
 */
export function castleSeat(spec: CustomCastle, portrait: boolean, sx: number, sz: number): CastleSeat {
  const far = portrait ? sx > 0 : sz < 0;
  // The far castles are built larger, so that from the camera all four look the same size.
  const scale = (portrait ? PORTRAIT_FIT : 1) * (far ? (portrait ? FAR_SCALE_PORTRAIT : FAR_SCALE) : 1);
  const size = spec.size * scale;
  const halfAcross = (size * spec.walls[0]) / 2;
  const halfDeep = (size * spec.walls[1]) / 2;
  const k = Math.SQRT1_2;
  const plot: [number, number] = [sx * (COLS / 2 - 1), sz * (ROWS / 2 - 1)];
  const inward: [number, number] = [-sx * k, -sz * k];
  // Landscape looks from +z, portrait from -x.
  const gate: [number, number] = portrait ? [-k, -sz * k] : [-sx * k, k];
  const wallHalf = far ? halfAcross : halfDeep;
  const reach = far ? halfDeep : halfAcross;
  return {
    x: plot[0] - inward[0] * (reach - CASTLE_FORWARD),
    z: plot[1] - inward[1] * (reach - CASTLE_FORWARD),
    turn: Math.atan2(gate[0], gate[1]),
    gate,
    along: [gate[1], -gate[0]],
    halfAcross,
    halfDeep,
    plot,
    inward,
    wallHalf,
    reach,
    far,
    scale,
  };
}
