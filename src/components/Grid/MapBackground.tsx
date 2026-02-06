/**
 * Dice Dominion - Harita Arka Plan Bileşeni
 * Görsel Faz V1
 *
 * Bu bileşen harita türüne göre ortaçağ temalı arka plan gösterir.
 * Düz harita: Yeşil çayır ve tepeler
 * Nehir haritası: Nehir vadisi ve köprüler
 * Dağ haritası: Kayalık arazi ve bulutlar
 *
 * PLACEHOLDER: Gradyan dolgular gerçek piksel sanat varlıkları ile değiştirilecek.
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Easing, Dimensions, Platform } from 'react-native';
import { MapBackgrounds, TerrainColors } from '../../../constants/Colors';

// Harita türü
type MapType = 'flat' | 'river' | 'mountain';

interface MapBackgroundProps {
  mapType: MapType;
  width: number;
  height: number;
  children?: React.ReactNode;
}

// Bulut bileşeni (dağ haritası için)
// PLACEHOLDER: Gerçek bulut sprite'ı ile değiştirilecek
const Cloud: React.FC<{ delay: number; top: number; size: number }> = ({ delay, top, size }) => {
  const translateX = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    const screenWidth = Dimensions.get('window').width;
    const animate = () => {
      translateX.setValue(-100);
      Animated.timing(translateX, {
        toValue: screenWidth + 100,
        duration: 30000 + Math.random() * 10000,
        delay: delay,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(() => animate());
    };
    animate();
  }, [delay, translateX]);

  return (
    <Animated.View
      style={[
        styles.cloud,
        {
          top: top,
          transform: [{ translateX }],
          width: size,
          height: size * 0.4,
          opacity: 0.3,
        },
      ]}
    />
  );
};

// Kuş silüeti bileşeni (ara sıra uçar)
// PLACEHOLDER: Gerçek kuş sprite'ı ile değiştirilecek
const Bird: React.FC<{ delay: number }> = ({ delay }) => {
  const translateX = useRef(new Animated.Value(-50)).current;
  const translateY = useRef(new Animated.Value(50)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const baseY = useRef(30 + Math.random() * 40);

  useEffect(() => {
    const screenWidth = Dimensions.get('window').width;
    let timeoutId: ReturnType<typeof setTimeout>;

    const animate = () => {
      // Her 15-25 saniyede bir kuş uçuşu
      const waitTime = 15000 + Math.random() * 10000;
      baseY.current = 30 + Math.random() * 40;

      timeoutId = setTimeout(() => {
        translateX.setValue(-50);
        translateY.setValue(baseY.current);
        opacity.setValue(1);

        Animated.parallel([
          Animated.timing(translateX, {
            toValue: screenWidth + 50,
            duration: 8000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(translateY, {
              toValue: baseY.current - 20,
              duration: 2000,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: baseY.current + 10,
              duration: 2000,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: baseY.current - 15,
              duration: 2000,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: baseY.current,
              duration: 2000,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        ]).start(() => {
          opacity.setValue(0);
          animate();
        });
      }, waitTime + delay);
    };

    animate();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [delay, translateX, translateY, opacity]);

  return (
    <Animated.View
      style={[
        styles.bird,
        {
          opacity,
          transform: [{ translateX }, { translateY }],
        },
      ]}
    >
      {/* Basit V şeklinde kuş silüeti */}
      <View style={styles.birdWingLeft} />
      <View style={styles.birdWingRight} />
    </Animated.View>
  );
};

const MapBackground: React.FC<MapBackgroundProps> = ({ mapType, width, height, children }) => {
  // Harita türüne göre arka plan renkleri
  const bgConfig = MapBackgrounds[mapType];

  // Gradyan efekti için katmanlar
  const renderGradientLayers = () => {
    const colors = bgConfig.colors;
    const layerHeight = height / colors.length;

    return colors.map((color, index) => (
      <View
        key={`gradient-${index}`}
        style={[
          styles.gradientLayer,
          {
            backgroundColor: color,
            height: layerHeight,
            top: index * layerHeight,
            opacity: 0.9 - index * 0.1,
          },
        ]}
      />
    ));
  };

  // Çim doku efekti (düz harita için)
  const renderGrassTexture = () => {
    if (mapType !== 'flat') return null;

    const dots: React.ReactNode[] = [];
    const spacing = 40;
    const rows = Math.ceil(height / spacing);
    const cols = Math.ceil(width / spacing);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const variant = (row + col) % 3;
        const colorVariant = variant === 0
          ? TerrainColors.grass.light
          : variant === 1
          ? TerrainColors.grass.dark
          : TerrainColors.grass.highlight;

        dots.push(
          <View
            key={`grass-${row}-${col}`}
            style={[
              styles.grassDot,
              {
                left: col * spacing + Math.random() * 10,
                top: row * spacing + Math.random() * 10,
                backgroundColor: colorVariant,
                opacity: 0.3 + Math.random() * 0.2,
              },
            ]}
          />
        );
      }
    }

    return <View style={styles.textureLayer}>{dots}</View>;
  };

  // Nehir dalgası efekti (nehir haritası için)
  const WaveEffect: React.FC = () => {
    const waveOpacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
      const animate = () => {
        Animated.sequence([
          Animated.timing(waveOpacity, {
            toValue: 0.6,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(waveOpacity, {
            toValue: 0.3,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]).start(() => animate());
      };
      animate();
    }, [waveOpacity]);

    return (
      <Animated.View
        style={[
          styles.waterShimmer,
          {
            opacity: waveOpacity,
            left: '40%',
            width: '20%',
            height: '100%',
          },
        ]}
      />
    );
  };

  // Bulutlar (dağ haritası için)
  const renderClouds = () => {
    if (mapType !== 'mountain') return null;

    return (
      <View style={styles.cloudLayer}>
        <Cloud delay={0} top={20} size={120} />
        <Cloud delay={5000} top={60} size={80} />
        <Cloud delay={10000} top={40} size={100} />
      </View>
    );
  };

  // Kuşlar (tüm haritalar için)
  const renderBirds = () => {
    return (
      <View style={styles.birdLayer}>
        <Bird delay={0} />
        <Bird delay={20000} />
      </View>
    );
  };

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Gökyüzü */}
      <View style={[styles.sky, { backgroundColor: bgConfig.sky }]} />

      {/* Gradyan arka plan */}
      <View style={styles.gradientContainer}>
        {renderGradientLayers()}
      </View>

      {/* Çim dokusu (düz harita) */}
      {renderGrassTexture()}

      {/* Nehir dalga efekti */}
      {mapType === 'river' && <WaveEffect />}

      {/* Bulutlar (dağ haritası) */}
      {renderClouds()}

      {/* Kuşlar */}
      {renderBirds()}

      {/* Grid içeriği */}
      <View style={styles.contentLayer}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  sky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '30%',
    opacity: 0.3,
  },
  gradientContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  textureLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  grassDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  waterShimmer: {
    position: 'absolute',
    backgroundColor: TerrainColors.water.shimmer,
  },
  cloudLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    pointerEvents: 'none',
  },
  cloud: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: 50,
    // PLACEHOLDER: Gerçek bulut sprite'ı ile değiştirilecek
  },
  birdLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    pointerEvents: 'none',
  },
  bird: {
    position: 'absolute',
    flexDirection: 'row',
  },
  birdWingLeft: {
    width: 8,
    height: 2,
    backgroundColor: '#333',
    transform: [{ rotate: '-30deg' }],
    // PLACEHOLDER: Gerçek kuş sprite'ı ile değiştirilecek
  },
  birdWingRight: {
    width: 8,
    height: 2,
    backgroundColor: '#333',
    transform: [{ rotate: '30deg' }],
    marginLeft: -2,
    // PLACEHOLDER: Gerçek kuş sprite'ı ile değiştirilecek
  },
  contentLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default MapBackground;
