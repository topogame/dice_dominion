/**
 * Dice Dominion - İzometrik Izgara Bileşeni
 * Görsel Faz V1-ISO
 *
 * Bu bileşen ızgarayı izometrik görünümde render eder.
 * Tüm oyun mantığı değişmeden kalır, sadece görsel sunum değişir.
 *
 * Özellikler:
 * - Elmas şeklinde ızgara
 * - Painter's algorithm (arkadan öne render)
 * - 3D derinlik efektleri
 * - Atmosfer efektleri (gökyüzü, sis, vinyet)
 */

import React, { useMemo, useCallback } from 'react';
import { StyleSheet, View, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Polygon, Rect, Defs, LinearGradient, Stop, RadialGradient } from 'react-native-svg';
import {
  gridToIso,
  isoToGrid,
  getIsoMapDimensions,
  getIsoCenterOffset,
  getDepthValue,
  isValidGridPosition,
  ISO_TILE_WIDTH,
  ISO_TILE_HEIGHT,
  GRID_WIDTH,
  GRID_HEIGHT,
} from '../../utils/isometric';
import { TerrainColors, MapBackgrounds } from '../../../constants/Colors';
import { GridCell as GridCellType } from '../../types/game.types';

interface IsometricGridProps {
  grid: GridCellType[][];
  mapType: 'flat' | 'river' | 'mountain';
  validPlacementCells: Set<string>;
  attackerUnits: Set<string>;
  targetEnemies: Set<string>;
  selectedAttacker: { x: number; y: number } | null;
  onCellPress: (x: number, y: number) => void;
  getOwnerColor: (ownerId: string | null) => string | null;
  getCastleHP: (ownerId: string | null) => number | null;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 3D derinlik
const TILE_DEPTH = 8;

// Renk parlaklığını ayarla
const adjustBrightness = (hex: string, factor: number): string => {
  if (!hex || !hex.startsWith('#')) return hex;
  const rgb = hex.replace('#', '');
  const r = Math.min(255, Math.floor(parseInt(rgb.substring(0, 2), 16) * factor));
  const g = Math.min(255, Math.floor(parseInt(rgb.substring(2, 4), 16) * factor));
  const b = Math.min(255, Math.floor(parseInt(rgb.substring(4, 6), 16) * factor));
  return `rgb(${r}, ${g}, ${b})`;
};

// Çim varyantı
const getGrassVariant = (x: number, y: number): string => {
  const variant = (x * 7 + y * 13) % 4;
  return variant === 0 ? TerrainColors.grass.base
    : variant === 1 ? TerrainColors.grass.light
    : variant === 2 ? TerrainColors.grass.dark
    : TerrainColors.grass.highlight;
};

// Kaya varyantı
const getRockVariant = (x: number, y: number): string => {
  const variant = (x + y) % 3;
  return variant === 0 ? TerrainColors.rock.base
    : variant === 1 ? TerrainColors.rock.light
    : TerrainColors.rock.dark;
};

const IsometricGrid: React.FC<IsometricGridProps> = ({
  grid,
  mapType,
  validPlacementCells,
  attackerUnits,
  targetEnemies,
  selectedAttacker,
  onCellPress,
  getOwnerColor,
  getCastleHP,
}) => {
  // Harita boyutları
  const mapDimensions = useMemo(() => getIsoMapDimensions(), []);
  // Merkez offset'i harita boyutlarına göre hesapla (ekran değil)
  const containerWidth = mapDimensions.width + 100;
  const containerHeight = mapDimensions.height + 150;
  const centerOffset = useMemo(
    () => ({
      offsetX: containerWidth / 2,
      offsetY: 50, // Üstten biraz boşluk
    }),
    [containerWidth]
  );

  // Hücreleri derinliğe göre sırala (painter's algorithm)
  const sortedCells = useMemo(() => {
    const cells: Array<{ x: number; y: number; depth: number; cell: GridCellType }> = [];

    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        cells.push({
          x,
          y,
          depth: getDepthValue(x, y),
          cell: grid[y][x],
        });
      }
    }

    // Arkadan öne sırala
    return cells.sort((a, b) => a.depth - b.depth);
  }, [grid]);

  // Tek bir izometrik karo render et
  const renderIsoTile = useCallback(
    (x: number, y: number, cell: GridCellType) => {
      const { screenX, screenY } = gridToIso(x, y);
      const posX = screenX + centerOffset.offsetX - ISO_TILE_WIDTH / 2;
      const posY = screenY + centerOffset.offsetY;

      const cellKey = `${x},${y}`;
      const isValidPlacement = validPlacementCells.has(cellKey);
      const isAttacker = attackerUnits.has(cellKey);
      const isTarget = targetEnemies.has(cellKey);
      const isSelected = selectedAttacker?.x === x && selectedAttacker?.y === y;
      const ownerColor = getOwnerColor(cell.ownerId);

      // Temel renk
      let baseColor: string;
      switch (cell.type) {
        case 'river':
          baseColor = TerrainColors.water.base;
          break;
        case 'mountain':
          baseColor = getRockVariant(x, y);
          break;
        case 'bridge':
          baseColor = TerrainColors.wood.base;
          break;
        case 'unit':
        case 'castle':
          baseColor = ownerColor || getGrassVariant(x, y);
          break;
        case 'chest':
        default:
          baseColor = getGrassVariant(x, y);
      }

      // 3D yüzey renkleri
      const topColor = baseColor;
      const leftColor = adjustBrightness(baseColor, 0.75);
      const rightColor = adjustBrightness(baseColor, 0.55);

      // Vurgu
      let highlightColor = 'transparent';
      let highlightOpacity = 0;

      if (isTarget) {
        highlightColor = '#FF6B6B';
        highlightOpacity = 0.5;
      } else if (isAttacker || isSelected) {
        highlightColor = '#FFA500';
        highlightOpacity = 0.5;
      } else if (isValidPlacement) {
        highlightColor = '#90EE90';
        highlightOpacity = 0.4;
      }

      // Karo noktaları
      const hw = ISO_TILE_WIDTH / 2;
      const hh = ISO_TILE_HEIGHT / 2;

      const topFace = `${hw},0 ${ISO_TILE_WIDTH},${hh} ${hw},${ISO_TILE_HEIGHT} 0,${hh}`;
      const leftFace = `0,${hh} ${hw},${ISO_TILE_HEIGHT} ${hw},${ISO_TILE_HEIGHT + TILE_DEPTH} 0,${hh + TILE_DEPTH}`;
      const rightFace = `${hw},${ISO_TILE_HEIGHT} ${ISO_TILE_WIDTH},${hh} ${ISO_TILE_WIDTH},${hh + TILE_DEPTH} ${hw},${ISO_TILE_HEIGHT + TILE_DEPTH}`;

      const isCastle = cell.isCastle;
      const isDisabled = isCastle && !isTarget;

      return (
        <TouchableOpacity
          key={cellKey}
          onPress={() => !isDisabled && onCellPress(x, y)}
          activeOpacity={0.8}
          disabled={isDisabled}
          style={[
            styles.tile,
            {
              left: posX,
              top: posY,
              width: ISO_TILE_WIDTH,
              height: ISO_TILE_HEIGHT + TILE_DEPTH + (cell.type === 'mountain' ? 20 : 0),
              zIndex: getDepthValue(x, y),
            },
          ]}
        >
          <Svg
            width={ISO_TILE_WIDTH}
            height={ISO_TILE_HEIGHT + TILE_DEPTH + (cell.type === 'mountain' ? 25 : 0)}
            viewBox={`0 0 ${ISO_TILE_WIDTH} ${ISO_TILE_HEIGHT + TILE_DEPTH + (cell.type === 'mountain' ? 25 : 0)}`}
          >
            {/* Dağ için özel render */}
            {cell.type === 'mountain' ? (
              <>
                {/* Dağ tabanı */}
                <Polygon points={topFace} fill={TerrainColors.rock.dark} />
                <Polygon points={leftFace} fill={adjustBrightness(TerrainColors.rock.dark, 0.6)} />
                <Polygon points={rightFace} fill={adjustBrightness(TerrainColors.rock.dark, 0.4)} />

                {/* Dağ gövdesi */}
                <Polygon
                  points={`${hw},${-15} ${hw + 18},${hh - 5} ${hw},${hh + 5} ${hw - 18},${hh - 5}`}
                  fill={getRockVariant(x, y)}
                />
                <Polygon
                  points={`${hw - 18},${hh - 5} ${hw},${hh + 5} ${hw},${ISO_TILE_HEIGHT} 0,${hh}`}
                  fill={adjustBrightness(getRockVariant(x, y), 0.7)}
                />
                <Polygon
                  points={`${hw},${hh + 5} ${hw + 18},${hh - 5} ${ISO_TILE_WIDTH},${hh} ${hw},${ISO_TILE_HEIGHT}`}
                  fill={adjustBrightness(getRockVariant(x, y), 0.5)}
                />

                {/* Kar tepesi */}
                <Polygon
                  points={`${hw},${-18} ${hw + 8},${-8} ${hw},${-3} ${hw - 8},${-8}`}
                  fill={TerrainColors.rock.snow}
                />
              </>
            ) : (
              <>
                {/* Normal karo - 3 yüzey */}
                <Polygon points={leftFace} fill={leftColor} />
                <Polygon points={rightFace} fill={rightColor} />
                <Polygon points={topFace} fill={topColor} />

                {/* Nehir için su efekti */}
                {cell.type === 'river' && (
                  <Polygon
                    points={topFace}
                    fill={TerrainColors.water.shimmer}
                    opacity={0.3}
                  />
                )}

                {/* Köprü tahta efekti */}
                {cell.type === 'bridge' && (
                  <>
                    <Polygon
                      points={`${hw - 12},${hh - 4} ${hw + 12},${hh - 4} ${hw + 10},${hh - 2} ${hw - 10},${hh - 2}`}
                      fill={TerrainColors.wood.plank}
                    />
                    <Polygon
                      points={`${hw - 10},${hh + 1} ${hw + 10},${hh + 1} ${hw + 8},${hh + 3} ${hw - 8},${hh + 3}`}
                      fill={TerrainColors.wood.plank}
                    />
                    <Polygon
                      points={`${hw - 8},${hh + 6} ${hw + 8},${hh + 6} ${hw + 6},${hh + 8} ${hw - 6},${hh + 8}`}
                      fill={TerrainColors.wood.plank}
                    />
                  </>
                )}

                {/* Vurgu katmanı */}
                {highlightOpacity > 0 && (
                  <Polygon
                    points={topFace}
                    fill={highlightColor}
                    opacity={highlightOpacity}
                  />
                )}

                {/* İnce kenarlık */}
                <Polygon
                  points={topFace}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="0.5"
                />
              </>
            )}
          </Svg>

          {/* Sandık */}
          {cell.type === 'chest' && (
            <View style={styles.chestContainer}>
              <View style={styles.chestBody}>
                <View style={styles.chestLid} />
                <View style={styles.chestLock} />
              </View>
              <View style={styles.chestShadow} />
            </View>
          )}

          {/* Birim */}
          {cell.type === 'unit' && ownerColor && (
            <View style={styles.unitContainer}>
              <View style={[styles.unitBody, { backgroundColor: ownerColor }]}>
                <View style={styles.unitHead} />
              </View>
              <View style={styles.unitShadow} />
            </View>
          )}

          {/* Kale */}
          {cell.isCastle && ownerColor && (
            <View style={styles.castleContainer}>
              <View style={[styles.castleBody, { backgroundColor: adjustBrightness(ownerColor, 0.9) }]}>
                <View style={[styles.castleTurret, { backgroundColor: ownerColor }]} />
                <View style={[styles.castleTurret, styles.castleTurretRight, { backgroundColor: ownerColor }]} />
                <View style={styles.castleGate} />
                <View style={[styles.castleFlag, { backgroundColor: ownerColor }]} />
              </View>
              <View style={styles.castleShadow} />
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [centerOffset, validPlacementCells, attackerUnits, targetEnemies, selectedAttacker, onCellPress, getOwnerColor]
  );

  // Gökyüzü gradyanı
  const skyGradient = useMemo(() => MapBackgrounds[mapType], [mapType]);

  return (
    <View style={styles.container}>
      {/* Gökyüzü arka planı */}
      <Svg style={styles.skyBackground} width="100%" height="100%">
        <Defs>
          <LinearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={skyGradient.sky} />
            <Stop offset="100%" stopColor={adjustBrightness(skyGradient.sky, 0.85)} />
          </LinearGradient>
          <RadialGradient id="vignette" cx="50%" cy="50%" r="70%">
            <Stop offset="60%" stopColor="transparent" />
            <Stop offset="100%" stopColor="rgba(0,0,0,0.4)" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#skyGrad)" />
      </Svg>

      {/* Izometrik ızgara */}
      <View style={styles.gridWrapper}>
        <View style={[styles.gridContainer, { width: mapDimensions.width + 100, height: mapDimensions.height + 150 }]}>
          {sortedCells.map(({ x, y, cell }) => renderIsoTile(x, y, cell))}
        </View>
      </View>

      {/* Vinyet efekti */}
      <Svg style={styles.vignetteOverlay} width="100%" height="100%">
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#vignette)" />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  skyBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridContainer: {
    position: 'relative',
  },
  vignetteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  tile: {
    position: 'absolute',
  },
  // Sandık stilleri
  chestContainer: {
    position: 'absolute',
    top: '15%',
    left: '25%',
    alignItems: 'center',
  },
  chestBody: {
    width: 18,
    height: 12,
    backgroundColor: '#8B4513',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#FFD700',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  chestLid: {
    width: 20,
    height: 5,
    backgroundColor: '#A0522D',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    position: 'absolute',
    top: -3,
  },
  chestLock: {
    width: 4,
    height: 4,
    backgroundColor: '#FFD700',
    borderRadius: 2,
    marginTop: 4,
  },
  chestShadow: {
    width: 16,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    marginTop: 2,
  },
  // Birim stilleri
  unitContainer: {
    position: 'absolute',
    top: '-10%',
    left: '20%',
    alignItems: 'center',
  },
  unitBody: {
    width: 14,
    height: 20,
    borderRadius: 7,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 2,
  },
  unitHead: {
    width: 8,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 4,
  },
  unitShadow: {
    width: 12,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 6,
    marginTop: 2,
  },
  // Kale stilleri
  castleContainer: {
    position: 'absolute',
    top: '-50%',
    left: '5%',
    alignItems: 'center',
  },
  castleBody: {
    width: 50,
    height: 40,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  castleTurret: {
    position: 'absolute',
    width: 14,
    height: 25,
    top: -10,
    left: 2,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  castleTurretRight: {
    left: undefined,
    right: 2,
  },
  castleGate: {
    width: 14,
    height: 18,
    backgroundColor: '#2a2a2a',
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    marginBottom: -1,
  },
  castleFlag: {
    position: 'absolute',
    top: -20,
    width: 12,
    height: 8,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  castleShadow: {
    width: 55,
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 27,
    marginTop: 4,
  },
});

export default IsometricGrid;
