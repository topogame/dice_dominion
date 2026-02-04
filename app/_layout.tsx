/**
 * Dice Dominion - Ana Uygulama Düzeni
 *
 * Bu dosya uygulamanın ana navigasyon yapısını tanımlar.
 * Tüm ekranlar arasındaki geçişler burada yönetilir.
 */

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';

export {
  // Hata yakalama için ErrorBoundary
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ana ekran olarak index ayarla
  initialRouteName: 'index',
};

// Açılış ekranını fontlar yüklenene kadar göster
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Font yükleme
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Font yükleme hatası kontrolü
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // Fontlar yüklendiğinde açılış ekranını gizle
  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  // Cihaz renk teması
  const colorScheme = useColorScheme();

  // Koyu tema için özel renkler
  const DiceDominionDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: '#1a1a2e',
      card: '#2a2a4a',
      border: '#3a3a5a',
    },
  };

  // Açık tema için özel renkler
  const DiceDominionLightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#f0f0f5',
    },
  };

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DiceDominionDarkTheme : DiceDominionLightTheme}>
      <StatusBar style="auto" />
      <Stack>
        {/* Ana Menü Ekranı */}
        <Stack.Screen
          name="index"
          options={{
            title: 'Dice Dominion',
            headerShown: false,
          }}
        />
        {/* Oyun Ekranı */}
        <Stack.Screen
          name="game"
          options={{
            title: 'Oyun',
            headerBackTitle: 'Geri',
            headerStyle: {
              backgroundColor: colorScheme === 'dark' ? '#2a2a4a' : '#ffffff',
            },
            headerTintColor: colorScheme === 'dark' ? '#f0f0f5' : '#1a1a2e',
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
