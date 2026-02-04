/**
 * Dice Dominion - Renk Sabitleri
 *
 * Bu dosya oyunun tüm renk paletini içerir.
 * Oyuncu renkleri, arayüz renkleri ve tema renkleri burada tanımlanır.
 * Görsel Faz V1: Ortaçağ teması için arazi ve arka plan renkleri eklendi.
 */

// Ana oyuncu renkleri (kaleler ve birimler için)
export const PlayerColors = {
  blue: '#4A90D9',    // Mavi oyuncu
  red: '#D94A4A',     // Kırmızı oyuncu
  green: '#4AD97A',   // Yeşil oyuncu
  yellow: '#D9C74A',  // Sarı oyuncu
  rebel: '#8B4A8B',   // İsyancı rengi (mor)
};

// Oyun arayüzü renkleri
export const GameColors = {
  grid: '#2a2a4a',           // Izgara hücre rengi
  gridBorder: '#3a3a5a',     // Izgara kenar rengi
  river: '#4A90D9',          // Nehir rengi
  mountain: '#6B6B6B',       // Dağ rengi
  bridge: '#8B7355',         // Köprü rengi
  chest: '#FFD700',          // Hazine sandığı rengi
  highlight: '#90EE90',      // Geçerli hücre vurgusu (yeşil)
  attackHighlight: '#FF6B6B', // Saldırı hedefi vurgusu (kırmızı)
};

// Arazi renkleri - Görsel Faz V1
// PLACEHOLDER: Gerçek piksel sanat varlıkları ile değiştirilecek
export const TerrainColors = {
  // Çim varyantları (düz harita için)
  grass: {
    base: '#4A7C34',      // Ana çim rengi
    light: '#5A8C44',     // Açık çim
    dark: '#3A6C24',      // Koyu çim
    highlight: '#6A9C54', // Vurgulu çim
  },
  // Toprak varyantları
  dirt: {
    base: '#8B6B4A',      // Ana toprak rengi
    light: '#9B7B5A',     // Açık toprak
    dark: '#7B5B3A',      // Koyu toprak
  },
  // Su renkleri (nehir haritası için)
  water: {
    base: '#3A7CA5',      // Derin su
    light: '#5A9CC5',     // Sığ su
    foam: '#8ABCD5',      // Köpük/dalga
    shimmer: '#AADCF5',   // Su parıltısı
  },
  // Dağ renkleri (dağ haritası için)
  rock: {
    base: '#5A5A6A',      // Ana kaya rengi
    light: '#7A7A8A',     // Açık kaya
    dark: '#3A3A4A',      // Koyu kaya
    snow: '#E8E8F0',      // Kar
  },
  // Köprü renkleri
  wood: {
    base: '#8B7355',      // Ana tahta rengi
    plank: '#A08060',     // Tahta döşeme
    dark: '#6B5335',      // Koyu tahta
  },
};

// Harita arka plan gradyanları - Görsel Faz V1
// PLACEHOLDER: Gerçek arka plan görselleri ile değiştirilecek
export const MapBackgrounds = {
  flat: {
    // Yeşil çayır gradyanı
    colors: ['#4A7C34', '#3A6C24', '#5A8C44', '#4A7C34'],
    sky: '#87CEEB',
  },
  river: {
    // Nehir vadisi gradyanı
    colors: ['#4A7C34', '#3A7CA5', '#4A7C34'],
    sky: '#87CEEB',
  },
  mountain: {
    // Kayalık arazi gradyanı
    colors: ['#5A5A6A', '#3A3A4A', '#7A7A8A'],
    sky: '#B8C8D8',
  },
};

// Tema renkleri
const tintColorLight = '#4A90D9';
const tintColorDark = '#6BA3E0';

export default {
  light: {
    text: '#1a1a2e',
    background: '#f0f0f5',
    tint: tintColorLight,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorLight,
    card: '#ffffff',
    border: '#e0e0e5',
  },
  dark: {
    text: '#f0f0f5',
    background: '#1a1a2e',
    tint: tintColorDark,
    tabIconDefault: '#666',
    tabIconSelected: tintColorDark,
    card: '#2a2a4a',
    border: '#3a3a5a',
  },
};
