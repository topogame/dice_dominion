/**
 * Dice Dominion - İzometrik Karo Bileşeni
 * Görsel Faz V1-ISO
 *
 * Bu bileşen izometrik (elmas şeklinde) karoları render eder.
 * Her karo 3 yüzeye sahiptir: üst (en açık), sol (orta), sağ (en koyu).
 * Bu 3 yüzey 3D derinlik hissi yaratır.
 *
 * PLACEHOLDER-ISO: Gerçek önceden render edilmiş 3D varlıklarla değiştirilecek.
 */

import React, { memo, useEffect, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Animated, Easing } from 'react-native';
import Svg, { Polygon, Defs, LinearGradient, Stop } from 'react-native-svg';
import { ISO_TILE_WIDTH, ISO_TILE_HEIGHT } from '../../utils/isometric';
import { TerrainColors } from '../../../constants/Colors';
import { CellType } from '../../types/game.types';

interface IsometricTileProps {
  x: number;
  y: number;
  type: CellType;
  ownerId: string | null;
  ownerColor: string | null;
  isCastle?: boolean;
  isHighlighted?: boolean;
  isValidPlacement?: boolean;
  isAttacker?: boolean;
  isTarget?: boolean;
  onPress: (x: number, y: number) => void;
}

// Çim varyantı seçimi (tutarlı rastgelelik için)
const getGrassVariant = (x: number, y: number): number => {
  return (x * 7 + y * 13) % 4;
};

// Renk açıklığını ayarla
const adjustBrightness = (hex: string, factor: number): string => {
  const rgb = hex.replace('#', '');
  const r = Math.min(255, Math.floor(parseInt(rgb.substring(0, 2), 16) * factor));
  const g = Math.min(255, Math.floor(parseInt(rgb.substring(2, 4), 16) * factor));
  const b = Math.min(255, Math.floor(parseInt(rgb.substring(4, 6), 16) * factor));
  return `rgb(${r}, ${g}, ${b})`;
};

// Arazi türüne göre renkleri al
const getTerrainColors = (type: CellType, x: number, y: number, ownerColor: string | null) => {
  let baseColor: string;

  switch (type) {
    case 'river':
      baseColor = TerrainColors.water.base;
      break;
    case 'mountain':
      const rockVar = (x + y) % 3;
      baseColor = rockVar === 0 ? TerrainColors.rock.base
        : rockVar === 1 ? TerrainColors.rock.light
        : TerrainColors.rock.dark;
      break;
    case 'bridge':
      baseColor = TerrainColors.wood.base;
      break;
    case 'unit':
    case 'castle':
      baseColor = ownerColor || TerrainColors.grass.base;
      break;
    case 'chest':
    case 'empty':
    default:
      const grassVar = getGrassVariant(x, y);
      baseColor = grassVar === 0 ? TerrainColors.grass.base
        : grassVar === 1 ? TerrainColors.grass.light
        : grassVar === 2 ? TerrainColors.grass.dark
        : TerrainColors.grass.highlight;
  }

  return {
    top: baseColor,
    left: adjustBrightness(baseColor, 0.8),
    right: adjustBrightness(baseColor, 0.6),
  };
};

// İzometrik elmas karosu
const IsometricTile: React.FC<IsometricTileProps> = memo(({
  x,
  y,
  type,
  ownerId,
  ownerColor,
  isCastle = false,
  isHighlighted = false,
  isValidPlacement = false,
  isAttacker = false,
  isTarget = false,
  onPress,
}) => {
  const colors = getTerrainColors(type, x, y, ownerColor);
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // Su parıltısı animasyonu
  useEffect(() => {
    if (type === 'river') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [type, shimmerAnim]);

  const handlePress = () => {
    onPress(x, y);
  };

  // Vurgu renkleri
  let highlightOpacity = 0;
  let highlightColor = 'transparent';

  if (isTarget) {
    highlightOpacity = 0.5;
    highlightColor = '#FF6B6B';
  } else if (isAttacker) {
    highlightOpacity = 0.5;
    highlightColor = '#FFA500';
  } else if (isValidPlacement || isHighlighted) {
    highlightOpacity = 0.4;
    highlightColor = '#90EE90';
  }

  // İzometrik karo noktaları (elmas şekli)
  const tileWidth = ISO_TILE_WIDTH;
  const tileHeight = ISO_TILE_HEIGHT;
  const halfWidth = tileWidth / 2;
  const halfHeight = tileHeight / 2;
  const depth = 8; // 3D derinlik

  // Üst yüzey noktaları
  const topFace = `${halfWidth},0 ${tileWidth},${halfHeight} ${halfWidth},${tileHeight} 0,${halfHeight}`;

  // Sol yan yüzey noktaları
  const leftFace = `0,${halfHeight} ${halfWidth},${tileHeight} ${halfWidth},${tileHeight + depth} 0,${halfHeight + depth}`;

  // Sağ yan yüzey noktaları
  const rightFace = `${halfWidth},${tileHeight} ${tileWidth},${halfHeight} ${tileWidth},${halfHeight + depth} ${halfWidth},${tileHeight + depth}`;

  // Dağ yüksekliği (dağlar için ekstra yükseklik)
  const mountainHeight = type === 'mountain' ? 20 : 0;

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      disabled={isCastle && !isTarget}
      style={[
        styles.container,
        {
          width: tileWidth,
          height: tileHeight + depth + mountainHeight,
        },
      ]}
    >
      <Svg
        width={tileWidth}
        height={tileHeight + depth + mountainHeight}
        viewBox={`0 0 ${tileWidth} ${tileHeight + depth + mountainHeight}`}
      >
        <Defs>
          {/* Su gradyanı */}
          <LinearGradient id={`waterGrad-${x}-${y}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={TerrainColors.water.light} />
            <Stop offset="50%" stopColor={TerrainColors.water.base} />
            <Stop offset="100%" stopColor={TerrainColors.water.shimmer} />
          </LinearGradient>
        </Defs>

        {/* Dağ gövdesi (dağlar için) */}
        {type === 'mountain' && (
          <>
            {/* Dağ sol yüzey */}
            <Polygon
              points={`0,${halfHeight} ${halfWidth},${halfHeight - mountainHeight} ${halfWidth},${tileHeight + depth - mountainHeight} 0,${halfHeight + depth}`}
              fill={TerrainColors.rock.dark}
            />
            {/* Dağ sağ yüzey */}
            <Polygon
              points={`${halfWidth},${halfHeight - mountainHeight} ${tileWidth},${halfHeight} ${tileWidth},${halfHeight + depth} ${halfWidth},${tileHeight + depth - mountainHeight}`}
              fill={TerrainColors.rock.base}
            />
            {/* Dağ üst (kar) */}
            <Polygon
              points={`${halfWidth},${halfHeight - mountainHeight - 5} ${halfWidth + 10},${halfHeight - mountainHeight + 5} ${halfWidth},${halfHeight - mountainHeight + 10} ${halfWidth - 10},${halfHeight - mountainHeight + 5}`}
              fill={TerrainColors.rock.snow}
            />
          </>
        )}

        {/* Sol yan yüzey (en koyu - sağ tarafa kaydırıldı) */}
        {type !== 'mountain' && (
          <Polygon
            points={leftFace}
            fill={colors.right}
          />
        )}

        {/* Sağ yan yüzey (orta karanlık) */}
        {type !== 'mountain' && (
          <Polygon
            points={rightFace}
            fill={colors.left}
          />
        )}

        {/* Üst yüzey (en açık) */}
        {type !== 'mountain' && (
          <Polygon
            points={topFace}
            fill={type === 'river' ? `url(#waterGrad-${x}-${y})` : colors.top}
          />
        )}

        {/* Köprü tahta efekti */}
        {type === 'bridge' && (
          <>
            <Polygon
              points={`${halfWidth - 15},${halfHeight - 5} ${halfWidth + 15},${halfHeight - 5} ${halfWidth + 15},${halfHeight - 2} ${halfWidth - 15},${halfHeight - 2}`}
              fill={TerrainColors.wood.plank}
            />
            <Polygon
              points={`${halfWidth - 15},${halfHeight + 2} ${halfWidth + 15},${halfHeight + 2} ${halfWidth + 15},${halfHeight + 5} ${halfWidth - 15},${halfHeight + 5}`}
              fill={TerrainColors.wood.plank}
            />
            <Polygon
              points={`${halfWidth - 15},${halfHeight + 9} ${halfWidth + 15},${halfHeight + 9} ${halfWidth + 15},${halfHeight + 12} ${halfWidth - 15},${halfHeight + 12}`}
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

        {/* Izgara çizgisi (çok ince) */}
        <Polygon
          points={topFace}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="0.5"
        />
      </Svg>

      {/* Sandık göstergesi */}
      {type === 'chest' && (
        <View style={styles.chestOverlay}>
          <View style={styles.chest}>
            <View style={styles.chestLid} />
            <View style={styles.chestBody} />
            <View style={styles.chestLock} />
          </View>
        </View>
      )}

      {/* Birim göstergesi (basit işaret) */}
      {type === 'unit' && (
        <View style={styles.unitOverlay}>
          <View style={[styles.unitMarker, { backgroundColor: ownerColor || '#fff' }]}>
            <View style={styles.unitInner} />
          </View>
          {/* Gölge */}
          <View style={styles.unitShadow} />
        </View>
      )}

      {/* Kale göstergesi */}
      {isCastle && (
        <View style={styles.castleOverlay}>
          <View style={[styles.castleTower, { backgroundColor: ownerColor || '#888' }]}>
            <View style={styles.castleTop} />
            <View style={styles.castleWindow} />
          </View>
          <View style={styles.castleShadow} />
        </View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
  chestOverlay: {
    position: 'absolute',
    top: '20%',
    left: '30%',
    width: '40%',
    height: '50%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chest: {
    width: 20,
    height: 14,
    position: 'relative',
  },
  chestBody: {
    width: 20,
    height: 10,
    backgroundColor: '#8B4513',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  chestLid: {
    width: 22,
    height: 6,
    backgroundColor: '#A0522D',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    position: 'absolute',
    top: -2,
    left: -1,
  },
  chestLock: {
    width: 4,
    height: 4,
    backgroundColor: '#FFD700',
    borderRadius: 2,
    position: 'absolute',
    bottom: 3,
    left: 8,
  },
  unitOverlay: {
    position: 'absolute',
    top: '10%',
    left: '25%',
    width: '50%',
    height: '80%',
    alignItems: 'center',
  },
  unitMarker: {
    width: 16,
    height: 24,
    borderRadius: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    // 3D efekt için gölge
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  unitInner: {
    width: 6,
    height: 6,
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  unitShadow: {
    width: 14,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 7,
    marginTop: 2,
  },
  castleOverlay: {
    position: 'absolute',
    top: '-20%',
    left: '15%',
    width: '70%',
    height: '120%',
    alignItems: 'center',
  },
  castleTower: {
    width: 30,
    height: 40,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 4,
  },
  castleTop: {
    width: 34,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    position: 'absolute',
    top: -4,
  },
  castleWindow: {
    width: 8,
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    marginTop: 8,
  },
  castleShadow: {
    width: 36,
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 18,
    marginTop: 4,
  },
});

export default IsometricTile;
