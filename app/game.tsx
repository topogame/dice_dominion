/**
 * Dice Dominion - Oyun Ekranı
 *
 * Bu dosya ana oyun ekranını içerir.
 * Oyun haritası ve tüm oyun mekanikleri burada gösterilecek.
 */

import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function GameScreen() {
  // Güvenli alan kenar boşlukları
  const insets = useSafeAreaInsets();
  // Cihaz renk teması
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.container, isDark ? styles.containerDark : styles.containerLight]}>
      {/* Oyun alanı placeholder */}
      <View style={styles.content}>
        {/* Zar ikonu */}
        <View style={[styles.iconContainer, isDark && styles.iconContainerDark]}>
          <FontAwesome name="cube" size={80} color={isDark ? '#6BA3E0' : '#4A90D9'} />
        </View>

        {/* Başlık */}
        <Text style={[styles.title, isDark && styles.titleDark]}>
          Oyun Burada Başlayacak
        </Text>

        {/* Açıklama */}
        <Text style={[styles.description, isDark && styles.descriptionDark]}>
          Izgara haritası, kaleler ve birimler{'\n'}
          sonraki aşamada eklenecek.
        </Text>

        {/* Bilgi kutusu */}
        <View style={[styles.infoBox, isDark && styles.infoBoxDark]}>
          <FontAwesome
            name="info-circle"
            size={20}
            color={isDark ? '#6BA3E0' : '#4A90D9'}
            style={styles.infoIcon}
          />
          <Text style={[styles.infoText, isDark && styles.infoTextDark]}>
            Faz 1 tamamlandı!{'\n'}
            Navigasyon sistemi çalışıyor.
          </Text>
        </View>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  iconContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(74, 144, 217, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 3,
    borderColor: 'rgba(74, 144, 217, 0.2)',
    borderStyle: 'dashed',
  },
  iconContainerDark: {
    backgroundColor: 'rgba(107, 163, 224, 0.1)',
    borderColor: 'rgba(107, 163, 224, 0.2)',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a2e',
    textAlign: 'center',
    marginBottom: 12,
  },
  titleDark: {
    color: '#f0f0f5',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  descriptionDark: {
    color: '#888',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(74, 144, 217, 0.1)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 217, 0.2)',
    alignItems: 'center',
  },
  infoBoxDark: {
    backgroundColor: 'rgba(107, 163, 224, 0.1)',
    borderColor: 'rgba(107, 163, 224, 0.2)',
  },
  infoIcon: {
    marginRight: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#4A90D9',
    lineHeight: 20,
  },
  infoTextDark: {
    color: '#6BA3E0',
  },
});
