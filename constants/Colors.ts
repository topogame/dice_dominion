/**
 * Dice Dominion - Renk Sabitleri
 *
 * Bu dosya oyunun tüm renk paletini içerir.
 * Oyuncu renkleri, arayüz renkleri ve tema renkleri burada tanımlanır.
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
