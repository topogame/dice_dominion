/**
 * Dice Dominion - Oyun Ekranı
 * Görsel Faz V13-ISO: Ortaçağ Fantazi Teması
 *
 * Bu dosya ana oyun ekranını içerir.
 * Oyun haritası (ızgara) ve tüm oyun mekanikleri burada gösterilir.
 * HUD elementleri ortaçağ temasıyla stilize edildi.
 */

import React, { useState } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { GridBoard } from '../src/components/Grid';
import { MedievalTheme } from '../constants/Colors';

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Son tıklanan hücre bilgisi
  const [lastTappedCell, setLastTappedCell] = useState<{ x: number; y: number } | null>(null);

  // Hücre tıklama olayı
  const handleCellPress = (x: number, y: number) => {
    setLastTappedCell({ x, y });
  };

  // Ana menüye dön
  const handleBackPress = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      {/* Üst HUD - Ortaçağ temalı */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) }]}>
        {/* Arka plan gradyanı */}
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="headerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="rgba(40, 30, 20, 0.98)" />
              <Stop offset="100%" stopColor="rgba(30, 20, 15, 0.95)" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#headerGrad)" />
        </Svg>

        {/* İçerik */}
        <View style={styles.headerContent}>
          {/* Geri butonu */}
          <Pressable onPress={handleBackPress} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Menü</Text>
          </Pressable>

          {/* Başlık */}
          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle}>⚔ DICE DOMINION ⚔</Text>
          </View>

          {/* Boş alan (simetri için) */}
          <View style={styles.backButton} />
        </View>

        {/* Alt kenarlık */}
        <View style={styles.headerBorder} />
      </View>

      {/* Izgara tahtası */}
      <View style={styles.gridWrapper}>
        <GridBoard onCellPress={handleCellPress} />
      </View>

      {/* Alt HUD - Bilgi paneli */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {/* Arka plan gradyanı */}
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="footerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="rgba(30, 20, 15, 0.95)" />
              <Stop offset="100%" stopColor="rgba(40, 30, 20, 0.98)" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#footerGrad)" />
        </Svg>

        {/* Üst kenarlık */}
        <View style={styles.footerBorder} />

        {/* İçerik */}
        <View style={styles.footerContent}>
          <Text style={styles.footerText}>
            🎯 Hücreye dokunarak birim yerleştirin
          </Text>
          <Text style={styles.footerHint}>
            📱 İki parmakla yakınlaştır • Sürükleyerek kaydır
          </Text>
          {lastTappedCell && (
            <View style={styles.cellInfoBadge}>
              <Text style={styles.cellInfoText}>
                📍 ({lastTappedCell.x}, {lastTappedCell.y})
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  // Header stilleri
  header: {
    position: 'relative',
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 70,
  },
  backButtonText: {
    color: MedievalTheme.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: MedievalTheme.gold,
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  headerBorder: {
    height: 2,
    backgroundColor: MedievalTheme.buttonBorder,
    shadowColor: MedievalTheme.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  // Grid wrapper
  gridWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  // Footer stilleri
  footer: {
    position: 'relative',
    zIndex: 10,
  },
  footerBorder: {
    height: 2,
    backgroundColor: MedievalTheme.buttonBorder,
    shadowColor: MedievalTheme.gold,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  footerContent: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  footerText: {
    fontSize: 14,
    color: MedievalTheme.cream,
    textAlign: 'center',
    fontWeight: '500',
  },
  footerHint: {
    fontSize: 12,
    color: 'rgba(232, 213, 176, 0.6)',
    textAlign: 'center',
  },
  cellInfoBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MedievalTheme.buttonBorder,
    marginTop: 4,
  },
  cellInfoText: {
    fontSize: 12,
    color: MedievalTheme.gold,
    fontWeight: '600',
  },
});
