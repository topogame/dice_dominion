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

// All grass tiles use grass3 for a uniform look
export const getGrassTileImage = (_x: number, _y: number): ImageSourcePropType => {
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
