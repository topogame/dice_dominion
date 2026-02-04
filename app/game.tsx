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
      {/* Grid fills entire screen - terrain always visible */}
      <View style={styles.gridWrapper}>
        <GridBoard onCellPress={handleCellPress} />
      </View>

      {/* Minimal back button in top-left corner */}
      <View style={[styles.backButtonContainer, { top: Math.max(insets.top, 10) }]}>
        <Pressable onPress={handleBackPress} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Menü</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  // Grid fills entire screen
  gridWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  // Minimal back button
  backButtonContainer: {
    position: 'absolute',
    left: 16,
    zIndex: 100,
  },
  backButton: {
    backgroundColor: 'rgba(40, 30, 20, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: MedievalTheme.buttonBorder,
  },
  backButtonText: {
    color: MedievalTheme.gold,
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});
