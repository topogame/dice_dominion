/**
 * Dice Dominion - Oyun Ekranı
 *
 * Bu dosya ana oyun ekranını içerir.
 * Oyun haritası (ızgara) ve tüm oyun mekanikleri burada gösterilir.
 */

import React, { useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import { GridBoard } from '../src/components/Grid';

export default function GameScreen() {
  // Güvenli alan kenar boşlukları
  const insets = useSafeAreaInsets();
  // Cihaz renk teması
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Son tıklanan hücre bilgisi
  const [lastTappedCell, setLastTappedCell] = useState<{ x: number; y: number } | null>(null);

  // Hücre tıklama olayı
  const handleCellPress = (x: number, y: number) => {
    setLastTappedCell({ x, y });
  };

  return (
    <View style={[styles.container, isDark ? styles.containerDark : styles.containerLight]}>
      {/* Üst bilgi çubuğu */}
      <View style={[styles.header, { paddingTop: insets.top > 0 ? 0 : 10 }]}>
        <Text style={[styles.headerText, isDark && styles.headerTextDark]}>
          Dice Dominion
        </Text>
        {lastTappedCell && (
          <Text style={[styles.cellInfo, isDark && styles.cellInfoDark]}>
            Son tıklanan: ({lastTappedCell.x}, {lastTappedCell.y})
          </Text>
        )}
      </View>

      {/* Izgara tahtası */}
      <View style={styles.gridWrapper}>
        <GridBoard onCellPress={handleCellPress} />
      </View>

      {/* Alt bilgi çubuğu */}
      <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }]}>
        <Text style={[styles.footerText, isDark && styles.footerTextDark]}>
          Hücreye dokunarak birim yerleştirin
        </Text>
        <Text style={[styles.footerHint, isDark && styles.footerHintDark]}>
          📱 Mobil: İki parmakla yakınlaştır, sürükleyerek kaydır
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLight: {
    backgroundColor: '#f0f0f5',
  },
  containerDark: {
    backgroundColor: '#1a1a2e',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    textAlign: 'center',
  },
  headerTextDark: {
    color: '#f0f0f5',
  },
  cellInfo: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  cellInfoDark: {
    color: '#888',
  },
  gridWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  footerText: {
    fontSize: 14,
    color: '#1a1a2e',
    textAlign: 'center',
  },
  footerTextDark: {
    color: '#f0f0f5',
  },
  footerHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  footerHintDark: {
    color: '#888',
  },
});
