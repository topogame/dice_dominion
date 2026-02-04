/**
 * Dice Dominion - Ana Menü Ekranı
 * Görsel Faz V13-ISO: Ortaçağ Fantazi Teması
 *
 * Bu dosya oyunun ana menü ekranını içerir.
 * Atmosferik gökyüzü gradyanı, animasyonlu bulutlar,
 * parçacık efektleri ve ortaçağ temalı butonlar.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect, RadialGradient, Ellipse } from 'react-native-svg';
import { MedievalTheme } from '../constants/Colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================
// Animasyonlu Bulut Bileşeni
// ============================================
const AnimatedCloud: React.FC<{
  delay: number;
  y: number;
  size: number;
  speed: number;
}> = ({ delay, y, size, speed }) => {
  const translateX = useRef(new Animated.Value(-size * 2)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = () => {
      translateX.setValue(-size * 2);
      opacity.setValue(0);

      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0.3,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: SCREEN_WIDTH + size,
            duration: speed,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => animate());
    };

    animate();
  }, [delay, size, speed, translateX, opacity]);

  return (
    <Animated.View
      style={[
        styles.cloud,
        {
          top: y,
          width: size * 2,
          height: size * 0.6,
          opacity,
          transform: [{ translateX }],
        },
      ]}
    >
      <Svg width={size * 2} height={size * 0.6}>
        <Ellipse cx={size * 0.4} cy={size * 0.35} rx={size * 0.35} ry={size * 0.2} fill="rgba(255,255,255,0.4)" />
        <Ellipse cx={size * 0.8} cy={size * 0.25} rx={size * 0.4} ry={size * 0.22} fill="rgba(255,255,255,0.5)" />
        <Ellipse cx={size * 1.2} cy={size * 0.3} rx={size * 0.35} ry={size * 0.18} fill="rgba(255,255,255,0.35)" />
        <Ellipse cx={size} cy={size * 0.4} rx={size * 0.5} ry={size * 0.15} fill="rgba(255,255,255,0.3)" />
      </Svg>
    </Animated.View>
  );
};

// ============================================
// Animasyonlu Toz/Kıvılcım Parçacığı
// ============================================
const DustParticle: React.FC<{
  delay: number;
  startX: number;
  startY: number;
}> = ({ delay, startX, startY }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const animate = () => {
      translateY.setValue(0);
      translateX.setValue(0);
      opacity.setValue(0);
      scale.setValue(0.5);

      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -100 - Math.random() * 100,
            duration: 4000 + Math.random() * 2000,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: (Math.random() - 0.5) * 60,
            duration: 4000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0.6,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 3500,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(scale, {
            toValue: 0.2,
            duration: 4000,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => animate());
    };

    animate();
  }, [delay, translateY, translateX, opacity, scale]);

  return (
    <Animated.View
      style={[
        styles.dustParticle,
        {
          left: startX,
          top: startY,
          opacity,
          transform: [
            { translateY },
            { translateX },
            { scale },
          ],
        },
      ]}
    />
  );
};

// ============================================
// Ortaçağ Temalı Buton
// ============================================
const MedievalButton: React.FC<{
  onPress?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({ children, disabled = false }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={({ pressed }) => [
          styles.medievalButton,
          pressed && styles.medievalButtonPressed,
          disabled && styles.medievalButtonDisabled,
        ]}
      >
        {/* Üst kenar parlaklığı */}
        <View style={styles.buttonHighlight} />
        {/* İçerik */}
        <View style={styles.buttonContent}>
          {children}
        </View>
        {/* Alt kenar gölgesi */}
        <View style={styles.buttonShadowLine} />
      </Pressable>
    </Animated.View>
  );
};

// ============================================
// Başlık Parıltı Animasyonu
// ============================================
const GlowingTitle: React.FC = () => {
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [glowAnim]);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  return (
    <View style={styles.titleContainer}>
      {/* Glow efekti */}
      <Animated.View style={[styles.titleGlow, { opacity: glowOpacity }]} />
      {/* Ana başlık */}
      <Text style={styles.title}>⚔ DICE DOMINION ⚔</Text>
    </View>
  );
};

// ============================================
// Ana Menü Ekranı
// ============================================
export default function MainMenuScreen() {
  const insets = useSafeAreaInsets();

  // Toz parçacıkları için pozisyonlar
  const dustParticles = useMemo(() => {
    const particles = [];
    for (let i = 0; i < 15; i++) {
      particles.push({
        id: i,
        delay: Math.random() * 5000,
        x: Math.random() * SCREEN_WIDTH,
        y: SCREEN_HEIGHT * 0.5 + Math.random() * SCREEN_HEIGHT * 0.4,
      });
    }
    return particles;
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Gökyüzü Gradyan Arka Plan */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={MedievalTheme.skyTop} />
            <Stop offset="50%" stopColor={MedievalTheme.skyMid} />
            <Stop offset="100%" stopColor={MedievalTheme.skyBottom} />
          </LinearGradient>
          <RadialGradient id="vignette" cx="50%" cy="50%" r="70%">
            <Stop offset="50%" stopColor="transparent" />
            <Stop offset="100%" stopColor={MedievalTheme.vignette} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#skyGradient)" />
      </Svg>

      {/* Animasyonlu Bulutlar */}
      <AnimatedCloud delay={0} y={60} size={80} speed={25000} />
      <AnimatedCloud delay={8000} y={120} size={100} speed={30000} />
      <AnimatedCloud delay={15000} y={80} size={60} speed={20000} />
      <AnimatedCloud delay={5000} y={180} size={90} speed={28000} />

      {/* Toz Parçacıkları */}
      {dustParticles.map((particle) => (
        <DustParticle
          key={particle.id}
          delay={particle.delay}
          startX={particle.x}
          startY={particle.y}
        />
      ))}

      {/* Vinyet Efekti */}
      <Svg style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]} width="100%" height="100%">
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#vignette)" />
      </Svg>

      {/* İçerik */}
      <View style={styles.content}>
        {/* Başlık Alanı */}
        <View style={styles.header}>
          <GlowingTitle />
          {/* Alt başlık */}
          <Text style={styles.subtitle}>Zar At, Fethet, Hükümdar Ol!</Text>
        </View>

        {/* Buton Alanı */}
        <View style={styles.buttonContainer}>
          {/* Hızlı Maç Butonu */}
          <Link href="./game" asChild>
            <Pressable>
              {({ pressed }) => (
                <View style={[
                  styles.medievalButton,
                  pressed && styles.medievalButtonPressed,
                ]}>
                  <View style={styles.buttonHighlight} />
                  <View style={styles.buttonContent}>
                    <Text style={styles.buttonIcon}>⚔️</Text>
                    <Text style={styles.buttonText}>HIZLI MAÇ</Text>
                  </View>
                  <View style={styles.buttonShadowLine} />
                </View>
              )}
            </Pressable>
          </Link>

          {/* Özel Lobi Butonu (devre dışı) */}
          <View style={[styles.medievalButton, styles.medievalButtonDisabled]}>
            <View style={styles.buttonHighlight} />
            <View style={styles.buttonContent}>
              <Text style={[styles.buttonIcon, { opacity: 0.5 }]}>🏰</Text>
              <Text style={[styles.buttonText, { opacity: 0.5 }]}>ÖZEL LOBİ</Text>
            </View>
            <View style={styles.buttonShadowLine} />
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Yakında</Text>
            </View>
          </View>
        </View>

        {/* Alt Bilgi */}
        <View style={styles.footer}>
          <Text style={styles.version}>v1.0.0</Text>
          <Text style={styles.credits}>⚔ Dice Dominion ⚔</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MedievalTheme.skyTop,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 40,
  },
  // Bulut stilleri
  cloud: {
    position: 'absolute',
    zIndex: 1,
  },
  // Toz parçacığı stilleri
  dustParticle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: MedievalTheme.dust,
    zIndex: 2,
  },
  // Başlık stilleri
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
  },
  titleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  titleGlow: {
    position: 'absolute',
    width: 350,
    height: 100,
    backgroundColor: MedievalTheme.gold,
    borderRadius: 50,
    opacity: 0.2,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: MedievalTheme.gold,
    letterSpacing: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: MedievalTheme.cream,
    letterSpacing: 6,
    marginTop: 30,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
    fontStyle: 'italic',
  },
  // Buton alanı
  buttonContainer: {
    width: '100%',
    gap: 20,
    paddingHorizontal: 20,
  },
  // Ortaçağ buton stilleri
  medievalButton: {
    backgroundColor: MedievalTheme.buttonBg,
    borderWidth: 2,
    borderColor: MedievalTheme.buttonBorder,
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 30,
    position: 'relative',
    overflow: 'hidden',
    // Gölge efekti
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  medievalButtonPressed: {
    backgroundColor: 'rgba(50, 40, 30, 0.98)',
    borderColor: MedievalTheme.buttonBorderHover,
    transform: [{ scale: 0.98 }],
  },
  medievalButtonDisabled: {
    opacity: 0.7,
  },
  buttonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: MedievalTheme.buttonHighlight,
  },
  buttonShadowLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: MedievalTheme.buttonShadow,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  buttonIcon: {
    fontSize: 24,
  },
  buttonText: {
    color: MedievalTheme.gold,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 3,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Yakında rozeti
  comingSoonBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#8B4513',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MedievalTheme.gold,
  },
  comingSoonText: {
    color: MedievalTheme.cream,
    fontSize: 10,
    fontWeight: '600',
  },
  // Alt bilgi
  footer: {
    alignItems: 'center',
    gap: 4,
  },
  version: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  credits: {
    fontSize: 14,
    color: MedievalTheme.gold,
    opacity: 0.6,
    letterSpacing: 2,
  },
});
