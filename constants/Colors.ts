/**
 * Dice Dominion - Renk Sabitleri
 *
 * Bu dosya oyunun tüm renk paletini içerir.
 * Oyuncu renkleri, arayüz renkleri ve tema renkleri burada tanımlanır.
 * Görsel Faz V1: Ortaçağ teması için arazi ve arka plan renkleri eklendi.
 * Görsel Faz V13-ISO: Ortaçağ fantazi teması ana menü renkleri.
 */

// Ortaçağ tema renkleri (V13-ISO)
export const MedievalTheme = {
  // Ana renkler
  gold: '#FFD700',           // Altın - başlıklar, vurgular
  darkBrown: '#281e14',      // Koyu kahverengi - arka planlar
  cream: '#E8D5B0',          // Krem - alt yazılar
  parchment: '#D4C4A8',      // Parşömen - paneller

  // Buton renkleri
  buttonBg: 'rgba(40, 30, 20, 0.95)',      // Buton arka planı
  buttonBorder: 'rgba(255, 215, 0, 0.3)',   // Buton kenarlığı
  buttonBorderHover: 'rgba(255, 215, 0, 0.8)', // Hover kenarlık
  buttonHighlight: 'rgba(255, 255, 255, 0.1)', // Üst kenar parlaklığı
  buttonShadow: 'rgba(0, 0, 0, 0.5)',       // Alt kenar gölgesi

  // Gökyüzü gradyanı
  skyTop: '#1a3a5c',         // Koyu mavi (üst)
  skyMid: '#4a6a8c',         // Orta mavi
  skyBottom: '#8aa0b8',      // Açık mavi-gri (ufuk)

  // Atmosfer
  vignette: 'rgba(0, 0, 0, 0.6)',  // Vinyet gölgesi
  fog: 'rgba(180, 180, 200, 0.1)', // Atmosferik sis

  // Parçacık renkleri
  ember: '#FF6B35',          // Kıvılcım
  dust: 'rgba(255, 220, 180, 0.3)', // Toz parçacıkları
};

// Ana oyuncu renkleri (kaleler ve birimler için)
export const PlayerColors = {
  blue: '#4488FF',    // Mavi oyuncu (daha canlı)
  red: '#FF4444',     // Kırmızı oyuncu (daha canlı)
  green: '#44CC44',   // Yeşil oyuncu (daha canlı)
  yellow: '#FFCC00',  // Sarı oyuncu (daha canlı)
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
