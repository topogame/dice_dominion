/**
 * Dice Dominion - İzometrik Dönüşüm Yardımcıları
 * Görsel Faz V1-ISO
 *
 * Bu dosya ızgara koordinatlarını izometrik ekran koordinatlarına
 * ve tersine dönüştüren fonksiyonları içerir.
 *
 * İzometrik görünüm, haritaya açılı bir bakış sağlayarak
 * 3D derinlik hissi yaratır.
 */

// İzometrik karo boyutları (piksel)
export const ISO_TILE_WIDTH = 64;   // Karo genişliği
export const ISO_TILE_HEIGHT = 32;  // Karo yüksekliği (genişliğin yarısı)

// Izgara boyutları
export const GRID_WIDTH = 24;
export const GRID_HEIGHT = 12;

/**
 * Izgara koordinatlarını izometrik ekran koordinatlarına dönüştürür.
 * @param gridX - Izgara X koordinatı
 * @param gridY - Izgara Y koordinatı
 * @returns Ekran koordinatları { screenX, screenY }
 */
export function gridToIso(gridX: number, gridY: number): { screenX: number; screenY: number } {
  const screenX = (gridX - gridY) * (ISO_TILE_WIDTH / 2);
  const screenY = (gridX + gridY) * (ISO_TILE_HEIGHT / 2);
  return { screenX, screenY };
}

/**
 * İzometrik ekran koordinatlarını ızgara koordinatlarına dönüştürür.
 * @param screenX - Ekran X koordinatı
 * @param screenY - Ekran Y koordinatı
 * @returns Izgara koordinatları { gridX, gridY }
 */
export function isoToGrid(screenX: number, screenY: number): { gridX: number; gridY: number } {
  const gridX = Math.floor((screenX / (ISO_TILE_WIDTH / 2) + screenY / (ISO_TILE_HEIGHT / 2)) / 2);
  const gridY = Math.floor((screenY / (ISO_TILE_HEIGHT / 2) - screenX / (ISO_TILE_WIDTH / 2)) / 2);
  return { gridX, gridY };
}

/**
 * İzometrik haritanın toplam boyutlarını hesaplar.
 * @returns Harita boyutları { width, height }
 */
export function getIsoMapDimensions(): { width: number; height: number } {
  // İzometrik harita elmas şeklindedir
  // Genişlik: (GRID_WIDTH + GRID_HEIGHT) * TILE_WIDTH / 2
  // Yükseklik: (GRID_WIDTH + GRID_HEIGHT) * TILE_HEIGHT / 2
  const width = (GRID_WIDTH + GRID_HEIGHT) * ISO_TILE_WIDTH / 2;
  const height = (GRID_WIDTH + GRID_HEIGHT) * ISO_TILE_HEIGHT / 2;
  return { width, height };
}

/**
 * Render sırası için derinlik değerini hesaplar (painter's algorithm).
 * Daha yüksek değerler önde render edilir.
 * @param gridX - Izgara X koordinatı
 * @param gridY - Izgara Y koordinatı
 * @returns Derinlik değeri
 */
export function getDepthValue(gridX: number, gridY: number): number {
  return gridX + gridY;
}

/**
 * İzometrik haritanın merkez offsetini hesaplar.
 * Haritayı ekranın ortasına yerleştirmek için kullanılır.
 * @param containerWidth - Konteyner genişliği
 * @param containerHeight - Konteyner yüksekliği
 * @returns Offset değerleri { offsetX, offsetY }
 */
export function getIsoCenterOffset(
  containerWidth: number,
  containerHeight: number
): { offsetX: number; offsetY: number } {
  const mapDimensions = getIsoMapDimensions();
  const offsetX = containerWidth / 2;
  const offsetY = (containerHeight - mapDimensions.height) / 2 + ISO_TILE_HEIGHT;
  return { offsetX, offsetY };
}

/**
 * Izgara koordinatının geçerli olup olmadığını kontrol eder.
 * @param gridX - Izgara X koordinatı
 * @param gridY - Izgara Y koordinatı
 * @returns Geçerli mi?
 */
export function isValidGridPosition(gridX: number, gridY: number): boolean {
  return gridX >= 0 && gridX < GRID_WIDTH && gridY >= 0 && gridY < GRID_HEIGHT;
}

/**
 * İki hücre arasındaki izometrik yönü hesaplar (4 yön).
 * @param fromX - Başlangıç X
 * @param fromY - Başlangıç Y
 * @param toX - Hedef X
 * @param toY - Hedef Y
 * @returns Yön: 'NE' | 'NW' | 'SE' | 'SW'
 */
export function getIsoDirection(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): 'NE' | 'NW' | 'SE' | 'SW' {
  const dx = toX - fromX;
  const dy = toY - fromY;

  if (dx >= 0 && dy < 0) return 'NE';
  if (dx < 0 && dy < 0) return 'NW';
  if (dx >= 0 && dy >= 0) return 'SE';
  return 'SW';
}
