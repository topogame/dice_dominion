import type { PlayerColor } from './types/GameTypes';

/** Board dimensions (mirrors shared/src/game.ts). */
export const COLS = 24;
export const ROWS = 12;

/** Extra decorative land around the playable grid, in tiles. */
export const MARGIN = 2.8;

/** World-space centre of a grid cell. Tile tops sit at y = 0. */
export function cellToWorld(x: number, y: number): [number, number] {
  return [x - COLS / 2 + 0.5, y - ROWS / 2 + 0.5];
}

export interface KingdomMeta {
  name: string;
  short: string;
  /** Saturated colour used on 3D pieces. */
  color: string;
  /** Muted tabletop colour used in the HUD (design tokens). */
  ui: string;
}

export const KINGDOMS: Record<PlayerColor, KingdomMeta> = {
  blue: { name: 'Blue Kingdom', short: 'Blue', color: '#3d7be0', ui: '#3b5b8a' },
  yellow: { name: 'Yellow Empire', short: 'Yellow', color: '#f0b030', ui: '#c89a3c' },
  green: { name: 'Green Alliance', short: 'Green', color: '#46a84a', ui: '#5a7a3a' },
  red: { name: 'Red Dynasty', short: 'Red', color: '#d9452f', ui: '#a83a2c' },
};

/** Design tokens from the wood / parchment / brass handoff. */
export const UI = {
  wood: '#3d2817',
  woodDeep: '#251609',
  woodDeepest: '#1a0e05',
  woodLight: '#5a3d22',
  parchment: '#e8d9b8',
  parchmentDark: '#c2ad7e',
  ink: '#2a1d0e',
  brass: '#c9a35c',
  brassDeep: '#7d5e2a',
  brassLight: '#f0d893',
  wax: '#8b1a1a',
} as const;

/** Deterministic RNG so the scenery is identical on every load. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
