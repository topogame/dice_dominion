/**
 * Dice Dominion - 404 Sayfa Bulunamadı Ekranı
 *
 * Geçersiz bir rotaya gidildiğinde gösterilen ekran.
 */

import { Link, Stack } from 'expo-router';
import { StyleSheet, View, Text } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';

export default function NotFoundScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <>
      <Stack.Screen options={{ title: 'Hata!' }} />
      <View style={[styles.container, isDark && styles.containerDark]}>
        <Text style={[styles.title, isDark && styles.titleDark]}>
          Sayfa bulunamadı
        </Text>
        <Link href="/" style={[styles.link, isDark && styles.linkDark]}>
          Ana menüye dön
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f0f0f5',
  },
  containerDark: {
    backgroundColor: '#1a1a2e',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  titleDark: {
    color: '#f0f0f5',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
    color: '#4A90D9',
    fontSize: 16,
  },
  linkDark: {
    color: '#6BA3E0',
  },
});
