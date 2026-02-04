/**
 * Dice Dominion - Izgara Hücresi Bileşeni
 * Görsel Faz V1 & V2 Güncellemesi
 *
 * Bu dosya tek bir ızgara hücresini render eder.
 * Hücre tıklanabilir ve farklı durumları görsel olarak gösterir.
 * Faz 3: Kale hücreleri kalın kenarlıkla gösterilir.
 * Görsel Faz V1: Ortaçağ temalı arazi dokuları ve animasyonlar eklendi.
 * Görsel Faz V2: Kale görselleri, hasar durumları, bayrak animasyonu.
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

// ============================================
// Görsel Faz V2: Kale Bileşenleri
// ============================================

// Dalgalanan bayrak animasyonu
// PLACEHOLDER: Gerçek bayrak sprite'ı ile değiştirilecek
const AnimatedFlag: React.FC<{ color: string; size: number }> = memo(({ color, size }) => {
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(waveAnim, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [waveAnim]);

  const flagWave = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-5deg', '5deg'],
  });

  const flagWidth = waveAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [size * 0.3, size * 0.35, size * 0.3],
  });

  return (
    <View style={[styles.flagPole, { height: size * 0.4 }]}>
      <Animated.View
        style={[
          styles.flag,
          {
            backgroundColor: color,
            width: flagWidth,
            height: size * 0.15,
            transform: [{ rotate: flagWave }],
          },
        ]}
      />
    </View>
  );
});

// Duman animasyonu (hasar için)
// PLACEHOLDER: Gerçek duman sprite'ı ile değiştirilecek
const SmokeEffect: React.FC<{ intensity: number; size: number }> = memo(({ intensity, size }) => {
  const smokeOpacity = useRef(new Animated.Value(0)).current;
  const smokeTranslate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(smokeOpacity, {
            toValue: 0.3 * intensity,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(smokeOpacity, {
            toValue: 0.1 * intensity,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(smokeTranslate, {
            toValue: -5,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(smokeTranslate, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [smokeOpacity, smokeTranslate, intensity]);

  if (intensity === 0) return null;

  return (
    <Animated.View
      style={[
        styles.smoke,
        {
          width: size * 0.3,
          height: size * 0.3,
          opacity: smokeOpacity,
          transform: [{ translateY: smokeTranslate }],
        },
      ]}
    />
  );
});

// Ateş animasyonu (ağır hasar için)
// PLACEHOLDER: Gerçek ateş sprite'ı ile değiştirilecek
const FireEffect: React.FC<{ size: number }> = memo(({ size }) => {
  const fireScale = useRef(new Animated.Value(0.8)).current;
  const fireOpacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(fireScale, {
            toValue: 1.1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(fireScale, {
            toValue: 0.8,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(fireOpacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(fireOpacity, {
            toValue: 0.7,
            duration: 150,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [fireScale, fireOpacity]);

  return (
    <Animated.View
      style={[
        styles.fire,
        {
          width: size * 0.25,
          height: size * 0.3,
          opacity: fireOpacity,
          transform: [{ scale: fireScale }],
        },
      ]}
    />
  );
});

// Gelişmiş kale görseli (hasar durumları ile)
// PLACEHOLDER: Gerçek kale sprite'ı ile değiştirilecek
const CastleVisual: React.FC<{
  size: number;
  ownerColor: string;
  hp: number;
  maxHP?: number;
}> = memo(({ size, ownerColor, hp, maxHP = 4 }) => {
  // Hasar seviyesi hesapla (0 = sağlam, 3 = yıkık)
  const damageLevel = maxHP - hp;

  // Kale duvar rengi (hasara göre koyulaşır)
  const wallColor = damageLevel >= 3 ? '#4a4a4a' : damageLevel >= 2 ? '#6a6a6a' : '#8a8a8a';

  return (
    <View style={[styles.castleContainer, { width: size * 0.85, height: size * 0.75 }]}>
      {/* Ana kale yapısı */}
      <View style={styles.castleStructure}>
        {/* Sol kule */}
        <View style={[styles.castleTowerV2, { backgroundColor: wallColor }]}>
          <View style={[styles.towerTop, { backgroundColor: ownerColor }]} />
          {/* Çatlaklar (hasar 2+) */}
          {damageLevel >= 2 && <View style={styles.crack1} />}
        </View>

        {/* Orta bölüm (ana duvar) */}
        <View style={[styles.castleMain, { backgroundColor: wallColor }]}>
          {/* Kapı */}
          <View style={styles.castleGate} />
          {/* Çatlaklar (hasar 1+) */}
          {damageLevel >= 1 && <View style={styles.crack2} />}
          {damageLevel >= 3 && <View style={styles.crack3} />}
        </View>

        {/* Sağ kule */}
        <View style={[styles.castleTowerV2, { backgroundColor: wallColor }]}>
          <View style={[styles.towerTop, { backgroundColor: ownerColor }]} />
          {/* Çatlaklar (hasar 3) */}
          {damageLevel >= 3 && <View style={styles.crack1} />}
        </View>
      </View>

      {/* Bayrak (en üstte) */}
      <View style={styles.flagContainer}>
        <AnimatedFlag color={ownerColor} size={size} />
      </View>

      {/* Duman efekti (hasar 1+) */}
      {damageLevel >= 1 && (
        <View style={styles.smokeContainer}>
          <SmokeEffect intensity={damageLevel} size={size} />
        </View>
      )}

      {/* Ateş efekti (hasar 3 = 1 HP kaldı) */}
      {damageLevel >= 3 && (
        <View style={styles.fireContainer}>
          <FireEffect size={size} />
        </View>
      )}
    </View>
  );
});

// Kalp HP göstergesi
// PLACEHOLDER: Gerçek kalp ikonları ile değiştirilecek
const HeartHP: React.FC<{ current: number; max: number; size: number }> = memo(({ current, max, size }) => {
  const hearts: React.ReactNode[] = [];
  const heartSize = size * 0.18;

  for (let i = 0; i < max; i++) {
    const isFull = i < current;
    hearts.push(
      <View
        key={`heart-${i}`}
        style={[
          styles.heart,
          {
            width: heartSize,
            height: heartSize * 0.9,
            backgroundColor: isFull ? '#FF4444' : 'transparent',
            borderColor: isFull ? '#CC0000' : '#666666',
          },
        ]}
      />
    );
  }

  return <View style={styles.heartsContainer}>{hearts}</View>;
});

// Kale yenilenme parıltısı
// PLACEHOLDER: Gerçek parıltı efekti ile değiştirilecek
const RegenGlow: React.FC<{ size: number; active: boolean }> = memo(({ size, active }) => {
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.6,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [active, glowOpacity]);

  if (!active) return null;

  return (
    <Animated.View
      style={[
        styles.regenGlow,
        {
          width: size,
          height: size,
          opacity: glowOpacity,
        },
      ]}
    />
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

      {/* Kale göstergesi - Görsel Faz V2 geliştirilmiş */}
      {isCastle && ownerColor && (
        <View style={styles.castleWrapper}>
          {/* Gelişmiş kale görseli */}
          <CastleVisual
            size={size}
            ownerColor={ownerColor}
            hp={castleHP ?? 4}
            maxHP={4}
          />
          {/* Kalp HP göstergesi */}
          <HeartHP current={castleHP ?? 4} max={4} size={size} />
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
  // ============================================
  // Görsel Faz V2: Kale Stilleri
  // ============================================
  castleWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  castleContainer: {
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  castleStructure: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    width: '100%',
    height: '70%',
  },
  castleTowerV2: {
    width: '28%',
    height: '80%',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    justifyContent: 'flex-start',
    alignItems: 'center',
    overflow: 'hidden',
  },
  towerTop: {
    width: '100%',
    height: '25%',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  castleMain: {
    width: '40%',
    height: '65%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginHorizontal: 1,
    overflow: 'hidden',
  },
  castleGate: {
    width: '50%',
    height: '50%',
    backgroundColor: '#3a3a3a',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginBottom: -1,
  },
  // Çatlak efektleri
  crack1: {
    position: 'absolute',
    width: 2,
    height: '40%',
    backgroundColor: '#2a2a2a',
    top: '30%',
    left: '30%',
    transform: [{ rotate: '15deg' }],
  },
  crack2: {
    position: 'absolute',
    width: 2,
    height: '30%',
    backgroundColor: '#2a2a2a',
    top: '20%',
    right: '25%',
    transform: [{ rotate: '-20deg' }],
  },
  crack3: {
    position: 'absolute',
    width: 3,
    height: '50%',
    backgroundColor: '#1a1a1a',
    top: '10%',
    left: '40%',
    transform: [{ rotate: '5deg' }],
  },
  // Bayrak stilleri
  flagContainer: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
  },
  flagPole: {
    width: 2,
    backgroundColor: '#4a4a4a',
    alignItems: 'flex-start',
  },
  flag: {
    position: 'absolute',
    top: 0,
    left: 2,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  // Duman efekti
  smokeContainer: {
    position: 'absolute',
    top: '10%',
    right: '10%',
  },
  smoke: {
    backgroundColor: 'rgba(100, 100, 100, 0.5)',
    borderRadius: 50,
  },
  // Ateş efekti
  fireContainer: {
    position: 'absolute',
    bottom: '30%',
    left: '15%',
  },
  fire: {
    backgroundColor: '#FF6600',
    borderRadius: 50,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  // Kalp HP göstergesi
  heartsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    gap: 1,
  },
  heart: {
    borderWidth: 1,
    borderRadius: 2,
    // Kalp şekli için özel stil (basitleştirilmiş kare)
    transform: [{ rotate: '45deg' }],
  },
  // Yenilenme parıltısı
  regenGlow: {
    position: 'absolute',
    backgroundColor: '#FFD700',
    borderRadius: 50,
  },
});

export default memo(GridCell);
