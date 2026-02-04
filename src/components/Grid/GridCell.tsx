/**
 * Dice Dominion - Izgara Hücresi Bileşeni
 * Görsel Faz V1 Güncellemesi
 *
 * Bu dosya tek bir ızgara hücresini render eder.
 * Hücre tıklanabilir ve farklı durumları görsel olarak gösterir.
 * Faz 3: Kale hücreleri kalın kenarlıkla gösterilir.
 * Görsel Faz V1: Ortaçağ temalı arazi dokuları ve animasyonlar eklendi.
 *
 * PLACEHOLDER: Gradyan dolgular gerçek piksel sanat varlıkları ile değiştirilecek.
 */

import React, { memo, useCallback, useState, useEffect, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Platform, Animated, Easing } from 'react-native';
import { GameColors, TerrainColors } from '../../../constants/Colors';
import { CellType } from '../../types/game.types';

interface GridCellProps {
  x: number;
  y: number;
  size: number;
  type: CellType;
  ownerId: string | null;
  ownerColor: string | null;
  isCastle?: boolean;
  castleHP?: number | null;
  isHighlighted: boolean;
  isValidPlacement?: boolean;  // Geçerli yerleştirme hücresi mi?
  isAttacker?: boolean;        // Saldırabilecek birim mi? (turuncu)
  isTarget?: boolean;          // Hedef düşman birimi mi? (kırmızı)
  onPress: (x: number, y: number) => void;
}

// Çim varyant seçimi (pozisyona göre tutarlı)
const getGrassVariant = (x: number, y: number): number => {
  return (x * 7 + y * 13) % 4;
};

// Hücre türüne göre arazi arka plan rengi
const getTerrainBackgroundColor = (type: CellType, x: number, y: number, ownerColor: string | null): string => {
  switch (type) {
    case 'river':
      return TerrainColors.water.base;
    case 'mountain':
      // Dağ dokusu varyasyonu
      const rockVariant = (x + y) % 3;
      return rockVariant === 0
        ? TerrainColors.rock.base
        : rockVariant === 1
        ? TerrainColors.rock.light
        : TerrainColors.rock.dark;
    case 'bridge':
      return TerrainColors.wood.base;
    case 'chest':
      // Sandık altında çim
      const chestGrass = getGrassVariant(x, y);
      return chestGrass === 0
        ? TerrainColors.grass.base
        : chestGrass === 1
        ? TerrainColors.grass.light
        : chestGrass === 2
        ? TerrainColors.grass.dark
        : TerrainColors.grass.highlight;
    case 'unit':
    case 'castle':
      return ownerColor || TerrainColors.grass.base;
    case 'empty':
    default:
      // Çim varyasyonu ile boş hücreler
      const grassVariant = getGrassVariant(x, y);
      return grassVariant === 0
        ? TerrainColors.grass.base
        : grassVariant === 1
        ? TerrainColors.grass.light
        : grassVariant === 2
        ? TerrainColors.grass.dark
        : TerrainColors.grass.highlight;
  }
};

// Su parıltısı animasyonu bileşeni
// PLACEHOLDER: Gerçek su animasyonu sprite'ı ile değiştirilecek
const WaterShimmer: React.FC<{ size: number }> = memo(({ size }) => {
  const shimmerOpacity = useRef(new Animated.Value(0.3)).current;
  const shimmerTranslate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Parıltı animasyonu
    const opacityAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerOpacity, {
          toValue: 0.7,
          duration: 1000 + Math.random() * 500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerOpacity, {
          toValue: 0.3,
          duration: 1000 + Math.random() * 500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // Dalga hareketi
    const waveAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerTranslate, {
          toValue: 3,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerTranslate, {
          toValue: -3,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    opacityAnim.start();
    waveAnim.start();

    return () => {
      opacityAnim.stop();
      waveAnim.stop();
    };
  }, [shimmerOpacity, shimmerTranslate]);

  return (
    <Animated.View
      style={[
        styles.waterShimmer,
        {
          opacity: shimmerOpacity,
          transform: [{ translateY: shimmerTranslate }],
          width: size * 0.6,
          height: size * 0.15,
        },
      ]}
    />
  );
});

// Çim sallanma animasyonu bileşeni
// PLACEHOLDER: Gerçek çim animasyonu sprite'ı ile değiştirilecek
const GrassSway: React.FC<{ x: number; y: number; size: number }> = memo(({ x, y, size }) => {
  const swayRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = (x * 100 + y * 50) % 2000;

    const timer = setTimeout(() => {
      const swayAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(swayRotate, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(swayRotate, {
            toValue: -1,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      swayAnim.start();
    }, delay);

    return () => clearTimeout(timer);
  }, [swayRotate, x, y]);

  const rotation = swayRotate.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-3deg', '3deg'],
  });

  // Her hücrede 2-3 çim yaprağı
  const grassCount = 2 + (x + y) % 2;
  const grassBlades: React.ReactNode[] = [];

  for (let i = 0; i < grassCount; i++) {
    const offsetX = (i * 8 - 4) + (x % 3);
    const height = 4 + (i % 2) * 2;

    grassBlades.push(
      <Animated.View
        key={`grass-${i}`}
        style={[
          styles.grassBlade,
          {
            left: size * 0.3 + offsetX,
            height: height,
            transform: [{ rotate: rotation }],
          },
        ]}
      />
    );
  }

  return <View style={styles.grassContainer}>{grassBlades}</View>;
});

// Köprü tahta dokusu
// PLACEHOLDER: Gerçek köprü sprite'ı ile değiştirilecek
const BridgePlanks: React.FC<{ size: number }> = memo(({ size }) => {
  return (
    <View style={styles.bridgeContainer}>
      <View style={[styles.bridgePlank, { width: size * 0.9, top: size * 0.15 }]} />
      <View style={[styles.bridgePlank, { width: size * 0.9, top: size * 0.4 }]} />
      <View style={[styles.bridgePlank, { width: size * 0.9, top: size * 0.65 }]} />
      {/* Köprü yan rayları */}
      <View style={[styles.bridgeRail, { left: 2 }]} />
      <View style={[styles.bridgeRail, { right: 2 }]} />
    </View>
  );
});

// Dağ kaya dokusu
// PLACEHOLDER: Gerçek dağ sprite'ı ile değiştirilecek
const MountainRocks: React.FC<{ x: number; y: number; size: number }> = memo(({ x, y, size }) => {
  const variant = (x * 3 + y * 5) % 4;

  return (
    <View style={styles.mountainContainer}>
      {/* Ana kaya */}
      <View
        style={[
          styles.rock,
          {
            width: size * 0.4,
            height: size * 0.3,
            left: variant * 3,
            top: size * 0.35,
            backgroundColor: TerrainColors.rock.dark,
          },
        ]}
      />
      {/* Kar parçası (üstte) */}
      {variant % 2 === 0 && (
        <View
          style={[
            styles.snowCap,
            {
              width: size * 0.25,
              height: size * 0.15,
              left: size * 0.2 + variant * 2,
              top: size * 0.15,
            },
          ]}
        />
      )}
    </View>
  );
});

const GridCell: React.FC<GridCellProps> = ({
  x,
  y,
  size,
  type,
  ownerId,
  ownerColor,
  isCastle = false,
  castleHP = null,
  isHighlighted,
  isValidPlacement = false,
  isAttacker = false,
  isTarget = false,
  onPress,
}) => {
  // Hover durumu (web için)
  const [isHovered, setIsHovered] = useState(false);

  // Hücre tıklandığında
  const handlePress = useCallback(() => {
    onPress(x, y);
  }, [x, y, onPress]);

  // Arazi arka plan rengi
  let backgroundColor = getTerrainBackgroundColor(type, x, y, ownerColor);

  // Saldırı durumları için özel arka plan
  if (isTarget) {
    backgroundColor = 'rgba(255, 107, 107, 0.5)';
  } else if (isAttacker) {
    backgroundColor = 'rgba(255, 165, 0, 0.5)';
  } else if (isValidPlacement) {
    backgroundColor = 'rgba(144, 238, 144, 0.4)';
  }

  // Hover efekti
  let finalBackgroundColor = backgroundColor;
  if ((!isCastle || isTarget) && isHovered) {
    if (isTarget) {
      finalBackgroundColor = 'rgba(255, 107, 107, 0.7)';
    } else if (isAttacker) {
      finalBackgroundColor = 'rgba(255, 165, 0, 0.7)';
    } else if (isValidPlacement) {
      finalBackgroundColor = 'rgba(144, 238, 144, 0.6)';
    } else {
      finalBackgroundColor = adjustColorBrightness(backgroundColor, 0.85);
    }
  }

  // Görsel Faz V1: İnce kenarlıklar (arazi odaklı görünüm için)
  // Kale için kalın kenarlık, özel durumlar için orta, normal için çok ince
  const borderWidth = isCastle
    ? 3
    : (isTarget || isAttacker || isValidPlacement)
    ? 2
    : 0.5;  // Normal hücreler için çok ince kenarlık

  const borderColor = isCastle
    ? '#ffffff'
    : isTarget
    ? GameColors.attackHighlight
    : isAttacker
    ? '#FFA500'
    : isValidPlacement
    ? GameColors.highlight
    : isHighlighted
    ? GameColors.highlight
    : 'rgba(58, 58, 90, 0.3)';  // Çok açık, yarı şeffaf kenarlık

  // Arazi dokusu katmanları
  const renderTerrainTexture = () => {
    switch (type) {
      case 'river':
        return <WaterShimmer size={size} />;
      case 'mountain':
        return <MountainRocks x={x} y={y} size={size} />;
      case 'bridge':
        return <BridgePlanks size={size} />;
      case 'empty':
        // Boş hücrelerde çim animasyonu
        return <GrassSway x={x} y={y} size={size} />;
      default:
        return null;
    }
  };

  // Hücre içeriği
  const cellContent = (
    <>
      {/* Arazi dokusu */}
      {renderTerrainTexture()}

      {/* Birim göstergesi (X işareti) */}
      {type === 'unit' && (
        <View style={styles.unitMarker}>
          <View style={[styles.unitLine, styles.unitLine1]} />
          <View style={[styles.unitLine, styles.unitLine2]} />
        </View>
      )}

      {/* Kale göstergesi (kule ikonu) */}
      {isCastle && (
        <View style={styles.castleMarker}>
          <View style={styles.castleTower} />
          <View style={[styles.castleTower, styles.castleTowerMiddle]} />
          <View style={styles.castleTower} />
        </View>
      )}

      {/* Hazine sandığı göstergesi - Görsel Faz V1 geliştirilmiş */}
      {type === 'chest' && (
        <View style={styles.chestContainer}>
          <View style={styles.chestBody}>
            {/* Sandık kapağı */}
            <View style={styles.chestLid} />
            {/* Sandık kilidi */}
            <View style={styles.chestLock} />
          </View>
          {/* Parıltı efekti */}
          <ChestSparkle size={size} />
        </View>
      )}
    </>
  );

  // Kale tıklanabilirliği
  const isDisabled = isCastle && !isTarget;

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={isDisabled ? 1 : 0.7}
      disabled={isDisabled}
      // @ts-ignore - web-specific props
      onMouseEnter={Platform.OS === 'web' && !isDisabled ? () => setIsHovered(true) : undefined}
      onMouseLeave={Platform.OS === 'web' && !isDisabled ? () => setIsHovered(false) : undefined}
      style={[
        styles.cell,
        {
          width: size,
          height: size,
          backgroundColor: finalBackgroundColor,
          borderWidth,
          borderColor,
        },
        isHighlighted && !isCastle && styles.highlighted,
      ]}
    >
      {cellContent}
    </TouchableOpacity>
  );
};

// Sandık parıltı animasyonu
// PLACEHOLDER: Gerçek parıltı sprite'ı ile değiştirilecek
const ChestSparkle: React.FC<{ size: number }> = memo(({ size }) => {
  const sparkleOpacity = useRef(new Animated.Value(0)).current;
  const sparkleScale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const sparkleAnim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(sparkleOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(sparkleScale, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(sparkleOpacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(sparkleScale, {
            toValue: 0.5,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(1500), // Parıltılar arası bekleme
      ])
    );
    sparkleAnim.start();
    return () => sparkleAnim.stop();
  }, [sparkleOpacity, sparkleScale]);

  return (
    <Animated.View
      style={[
        styles.sparkle,
        {
          opacity: sparkleOpacity,
          transform: [{ scale: sparkleScale }],
        },
      ]}
    />
  );
});

// Renk parlaklığını ayarla
function adjustColorBrightness(color: string, factor: number): string {
  if (color.startsWith('rgba')) return color;

  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const newR = Math.min(255, Math.round(r + (255 - r) * (1 - factor)));
  const newG = Math.min(255, Math.round(g + (255 - g) * (1 - factor)));
  const newB = Math.min(255, Math.round(b + (255 - b) * (1 - factor)));

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  cell: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    // @ts-ignore - web style
    cursor: 'pointer',
  },
  highlighted: {
    borderWidth: 2,
    borderColor: GameColors.highlight,
    backgroundColor: 'rgba(144, 238, 144, 0.3)',
  },
  // Arazi dokuları
  waterShimmer: {
    position: 'absolute',
    backgroundColor: TerrainColors.water.shimmer,
    borderRadius: 10,
    top: '40%',
  },
  grassContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
  },
  grassBlade: {
    position: 'absolute',
    bottom: 2,
    width: 2,
    backgroundColor: '#2A5C14',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  bridgeContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bridgePlank: {
    position: 'absolute',
    height: 4,
    backgroundColor: TerrainColors.wood.plank,
    left: '5%',
    borderRadius: 1,
  },
  bridgeRail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: TerrainColors.wood.dark,
  },
  mountainContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  rock: {
    position: 'absolute',
    borderRadius: 4,
  },
  snowCap: {
    position: 'absolute',
    backgroundColor: TerrainColors.rock.snow,
    borderRadius: 6,
  },
  // Birim göstergeleri
  unitMarker: {
    width: '60%',
    height: '60%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unitLine: {
    position: 'absolute',
    width: '100%',
    height: 3,
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
  unitLine1: {
    transform: [{ rotate: '45deg' }],
  },
  unitLine2: {
    transform: [{ rotate: '-45deg' }],
  },
  castleMarker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: '70%',
    height: '60%',
  },
  castleTower: {
    width: '25%',
    height: '70%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  castleTowerMiddle: {
    height: '100%',
  },
  // Sandık göstergesi - Görsel Faz V1 geliştirilmiş
  chestContainer: {
    width: '60%',
    height: '50%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chestBody: {
    width: '100%',
    height: '100%',
    backgroundColor: '#8B4513',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#FFD700',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  chestLid: {
    width: '110%',
    height: '30%',
    backgroundColor: '#A0522D',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#6B3510',
    marginTop: -1,
  },
  chestLock: {
    width: 6,
    height: 6,
    backgroundColor: '#FFD700',
    borderRadius: 3,
    marginTop: 2,
  },
  sparkle: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 8,
    height: 8,
    backgroundColor: '#FFD700',
    borderRadius: 4,
  },
});

export default memo(GridCell);
