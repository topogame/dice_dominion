/**
 * Dice Dominion - Tile Asset Management
 * Phase 2 V1-ISO: AI-generated terrain tile integration
 *
 * This module manages the loading and selection of terrain tile images.
 * Images are clipped into isometric diamond shapes in the grid renderer.
 */

import { ImageSourcePropType } from 'react-native';

// Tile image imports
export const TileImages = {
  grass1: require('../../assets/tiles/grass1.jpg') as ImageSourcePropType,
  grass2: require('../../assets/tiles/grass2.jpg') as ImageSourcePropType,
  grass3: require('../../assets/tiles/grass3.jpg') as ImageSourcePropType,
  water: require('../../assets/tiles/water.jpg') as ImageSourcePropType,
  edge: require('../../assets/tiles/edge.jpg') as ImageSourcePropType,
  dirt: require('../../assets/tiles/dirt.jpg') as ImageSourcePropType,
};

// Grid dimensions (must match isometric.ts)
const GRID_WIDTH = 24;
const GRID_HEIGHT = 12;

// Cluster centers for natural grass distribution
// Each cluster has: x, y (center), type (0=grass1, 1=grass2, 2=grass3), radius
interface GrassCluster {
  x: number;
  y: number;
  type: 0 | 1 | 2;
  radius: number;
}

// Pre-defined cluster centers for natural look
// grass3 = base (covers most of the map - mushroom/path style)
// grass1 = bushy grass clusters scattered around
// grass2 = flowery patches scattered around
const grassClusters: GrassCluster[] = [
  // Medium grass1 bushy clusters scattered around
  { x: 5, y: 3, type: 0, radius: 4 },
  { x: 18, y: 8, type: 0, radius: 4 },
  { x: 11, y: 6, type: 0, radius: 3 },
  { x: 21, y: 2, type: 0, radius: 3 },
  { x: 2, y: 9, type: 0, radius: 3 },

  // Medium grass2 flowery patches scattered around
  { x: 8, y: 2, type: 1, radius: 4 },
  { x: 15, y: 10, type: 1, radius: 4 },
  { x: 22, y: 5, type: 1, radius: 3 },
  { x: 4, y: 6, type: 1, radius: 3 },
  { x: 14, y: 4, type: 1, radius: 2 },
];

// Calculate squared distance (avoid sqrt for performance)
const distanceSquared = (x1: number, y1: number, x2: number, y2: number): number => {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
};

// Grass variant selection using cluster-based distribution for natural look
export const getGrassTileImage = (x: number, y: number): ImageSourcePropType => {
  // Find the cluster that most strongly influences this tile
  // Priority: smaller clusters override larger ones (more specific)
  let bestCluster: GrassCluster | null = null;
  let bestScore = -1;

  for (const cluster of grassClusters) {
    const dist = Math.sqrt(distanceSquared(x, y, cluster.x, cluster.y));

    // Score: how "inside" the cluster this tile is (1.0 = center, 0 = edge)
    // Smaller clusters get priority when overlapping
    if (dist <= cluster.radius) {
      const normalizedDist = dist / cluster.radius;
      const insideScore = 1 - normalizedDist;
      // Boost score for smaller clusters (they should override larger ones)
      const sizeBonus = 1 / cluster.radius;
      const score = insideScore + sizeBonus * 2;

      if (score > bestScore) {
        bestScore = score;
        bestCluster = cluster;
      }
    }
  }

  // If inside a cluster, use that type
  if (bestCluster) {
    switch (bestCluster.type) {
      case 0: return TileImages.grass1;  // Bushy grass cluster
      case 1: return TileImages.grass2;  // Flowery grass cluster
      case 2: return TileImages.grass3;  // (not used as cluster, it's the base)
    }
  }

  // Default: grass3 is the base terrain for tiles not in any cluster
  return TileImages.grass3;
};

// Get tile image based on terrain type (always returns valid image)
export const getTileImage = (
  type: 'grass' | 'water' | 'river' | 'edge' | 'dirt' | 'bridge' | 'mountain' | 'unit' | 'castle' | 'chest' | 'empty',
  x: number,
  y: number
): ImageSourcePropType => {
  switch (type) {
    case 'water':
    case 'river':
      return TileImages.water;
    case 'edge':
      return TileImages.edge;
    case 'dirt':
    case 'bridge':
      return TileImages.dirt;
    case 'mountain':
      // Mountains use dirt as base, with rock overlay rendered separately
      return TileImages.dirt;
    case 'grass':
    case 'unit':
    case 'castle':
    case 'chest':
    case 'empty':
    default:
      // Default to grass variants for most tiles
      return getGrassTileImage(x, y);
  }
};
