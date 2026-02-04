/**
 * Dice Dominion - Ana Menü Ekranı
 *
 * Bu dosya oyunun ana menü ekranını içerir.
 * Kullanıcı buradan oyuna başlayabilir.
 */

import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function MainMenuScreen() {
  // Güvenli alan kenar boşlukları (notch vb.)
  const insets = useSafeAreaInsets();
  // Cihaz renk teması
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Arka plan */}
      <View style={[styles.background, isDark ? styles.backgroundDark : styles.backgroundLight]}>
        {/* Dekoratif elementler */}
        <View style={[styles.decorCircle, styles.decorCircle1, isDark && styles.decorCircleDark]} />
        <View style={[styles.decorCircle, styles.decorCircle2, isDark && styles.decorCircleDark]} />
      </View>

      {/* İçerik */}
      <View style={styles.content}>
        {/* Logo/Başlık Alanı */}
        <View style={styles.header}>
          {/* Zar İkonu */}
          <View style={[styles.logoContainer, isDark && styles.logoContainerDark]}>
            <FontAwesome name="cube" size={60} color={isDark ? '#6BA3E0' : '#4A90D9'} />
          </View>
          {/* Oyun Adı */}
          <Text style={[styles.title, isDark && styles.titleDark]}>DICE</Text>
          <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>DOMINION</Text>
          {/* Slogan */}
          <Text style={[styles.tagline, isDark && styles.taglineDark]}>
            Zar at, fethet, kazan!
          </Text>
        </View>

        {/* Buton Alanı */}
        <View style={styles.buttonContainer}>
          {/* Oynat Butonu - Link ile sarılmış */}
          <Link href="./game" asChild>
            <Pressable
              style={({ pressed }) => [
                styles.playButton,
                isDark && styles.playButtonDark,
                pressed && styles.playButtonPressed,
              ]}
            >
              <FontAwesome name="play" size={24} color="#ffffff" style={styles.playIcon} />
              <Text style={styles.playButtonText}>OYNA</Text>
            </Pressable>
          </Link>
        </View>

        {/* Alt Bilgi */}
        <View style={styles.footer}>
          <Text style={[styles.version, isDark && styles.versionDark]}>v1.0.0</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundLight: {
    backgroundColor: '#f0f0f5',
  },
  backgroundDark: {
    backgroundColor: '#1a1a2e',
  },
  // Dekoratif daireler
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.1,
  },
  decorCircle1: {
    width: 300,
    height: 300,
    backgroundColor: '#4A90D9',
    top: -100,
    right: -100,
  },
  decorCircle2: {
    width: 200,
    height: 200,
    backgroundColor: '#D94A4A',
    bottom: -50,
    left: -50,
  },
  decorCircleDark: {
    opacity: 0.2,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: 'rgba(74, 144, 217, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(74, 144, 217, 0.3)',
  },
  logoContainerDark: {
    backgroundColor: 'rgba(107, 163, 224, 0.1)',
    borderColor: 'rgba(107, 163, 224, 0.3)',
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    color: '#4A90D9',
    letterSpacing: 8,
    textShadowColor: 'rgba(74, 144, 217, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  titleDark: {
    color: '#6BA3E0',
    textShadowColor: 'rgba(107, 163, 224, 0.3)',
  },
  subtitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#D94A4A',
    letterSpacing: 12,
    marginTop: -5,
  },
  subtitleDark: {
    color: '#E06B6B',
  },
  tagline: {
    fontSize: 14,
    color: '#666',
    marginTop: 15,
    letterSpacing: 2,
  },
  taglineDark: {
    color: '#888',
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  playButton: {
    flexDirection: 'row',
    backgroundColor: '#4A90D9',
    paddingVertical: 18,
    paddingHorizontal: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4A90D9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    cursor: 'pointer',
  },
  playButtonDark: {
    backgroundColor: '#6BA3E0',
    shadowColor: '#6BA3E0',
  },
  playButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  playIcon: {
    marginRight: 12,
  },
  playButtonText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 4,
  },
  footer: {
    paddingTop: 20,
  },
  version: {
    fontSize: 12,
    color: '#999',
  },
  versionDark: {
    color: '#666',
  },
});
