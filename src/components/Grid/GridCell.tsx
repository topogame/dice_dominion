/**
 * Dice Dominion - Izgara Hücresi Bileşeni
 *
 * Bu dosya tek bir ızgara hücresini render eder.
 * Hücre tıklanabilir ve farklı durumları görsel olarak gösterir.
 * Faz 3: Kale hücreleri kalın kenarlıkla gösterilir.
 */

import React, { memo, useCallback, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Platform } from 'react-native';
import { GameColors } from '../../../constants/Colors';
import { CellType } from '../../types/game.types';

interface GridCellProps {
  x: number;
  y: number;
  size: number;
  type: CellType;
  ownerId: string | null;
  ownerColor: string | null;
  isCastle?: boolean;
  castleHP?: number | null;
  isHighlighted: boolean;
  isValidPlacement?: boolean;  // Geçerli yerleştirme hücresi mi?
  isAttacker?: boolean;        // Saldırabilecek birim mi? (turuncu)
  isTarget?: boolean;          // Hedef düşman birimi mi? (kırmızı)
  onPress: (x: number, y: number) => void;
}

// Hücre türüne göre arka plan rengi
const getCellBackgroundColor = (type: CellType, ownerColor: string | null): string => {
  switch (type) {
    case 'river':
      return GameColors.river;
    case 'mountain':
      return GameColors.mountain;
    case 'bridge':
      return GameColors.bridge;
    case 'chest':
      return GameColors.chest;
    case 'unit':
    case 'castle':
      return ownerColor || GameColors.grid;
    default:
      return GameColors.grid;
  }
};

const GridCell: React.FC<GridCellProps> = ({
  x,
  y,
  size,
  type,
  ownerId,
  ownerColor,
  isCastle = false,
  castleHP = null,
  isHighlighted,
  isValidPlacement = false,
  isAttacker = false,
  isTarget = false,
  onPress,
}) => {
  // Hover durumu (web için)
  const [isHovered, setIsHovered] = useState(false);

  // Hücre tıklandığında
  const handlePress = useCallback(() => {
    onPress(x, y);
  }, [x, y, onPress]);

  // Arka plan rengi
  let backgroundColor = getCellBackgroundColor(type, ownerColor);

  // Saldırı durumları için özel arka plan
  if (isTarget) {
    // Hedef düşman: kırmızı vurgu
    backgroundColor = 'rgba(255, 107, 107, 0.5)';
  } else if (isAttacker) {
    // Saldıran birim: turuncu vurgu
    backgroundColor = 'rgba(255, 165, 0, 0.5)';
  } else if (isValidPlacement) {
    // Geçerli yerleştirme hücresi için yeşil arka plan
    backgroundColor = 'rgba(144, 238, 144, 0.4)';
  }

  // Hover ile birleştirilmiş arka plan (kaleler için hover yok, hedef kaleler hariç)
  let finalBackgroundColor = backgroundColor;
  if ((!isCastle || isTarget) && isHovered) {
    if (isTarget) {
      finalBackgroundColor = 'rgba(255, 107, 107, 0.7)';
    } else if (isAttacker) {
      finalBackgroundColor = 'rgba(255, 165, 0, 0.7)';
    } else if (isValidPlacement) {
      finalBackgroundColor = 'rgba(144, 238, 144, 0.6)';
    } else {
      finalBackgroundColor = adjustColorBrightness(backgroundColor, 0.8);
    }
  }

  // Kale için kalın kenarlık, saldırı/hedef/yerleştirme için özel kenarlıklar
  const borderWidth = isCastle ? 3 : (isTarget || isAttacker || isValidPlacement) ? 2 : 1;
  const borderColor = isCastle
    ? '#ffffff'
    : isTarget
    ? GameColors.attackHighlight  // Kırmızı kenarlık (hedef)
    : isAttacker
    ? '#FFA500'  // Turuncu kenarlık (saldıran)
    : isValidPlacement
    ? GameColors.highlight
    : isHighlighted
    ? GameColors.highlight
    : GameColors.gridBorder;

  // Hücre içeriği
  const cellContent = (
    <>
      {/* Birim göstergesi (X işareti) */}
      {type === 'unit' && (
        <View style={styles.unitMarker}>
          <View style={[styles.unitLine, styles.unitLine1]} />
          <View style={[styles.unitLine, styles.unitLine2]} />
        </View>
      )}

      {/* Kale göstergesi (kule ikonu) */}
      {isCastle && (
        <View style={styles.castleMarker}>
          <View style={styles.castleTower} />
          <View style={[styles.castleTower, styles.castleTowerMiddle]} />
          <View style={styles.castleTower} />
        </View>
      )}

      {/* Hazine sandığı göstergesi */}
      {type === 'chest' && (
        <View style={styles.chestMarker} />
      )}
    </>
  );

  // Kale tıklanabilirliği: hedef olarak işaretlenmiş kaleler tıklanabilir olmalı
  const isCastleClickable = isCastle && isTarget;
  const isDisabled = isCastle && !isTarget;

  // Web ve mobil için aynı TouchableOpacity kullan
  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={isDisabled ? 1 : 0.7}
      disabled={isDisabled}
      // @ts-ignore - web-specific props
      onMouseEnter={Platform.OS === 'web' && !isDisabled ? () => setIsHovered(true) : undefined}
      onMouseLeave={Platform.OS === 'web' && !isDisabled ? () => setIsHovered(false) : undefined}
      style={[
        styles.cell,
        {
          width: size,
          height: size,
          backgroundColor: finalBackgroundColor,
          borderWidth,
          borderColor,
        },
        isHighlighted && !isCastle && styles.highlighted,
      ]}
    >
      {cellContent}
    </TouchableOpacity>
  );
};

// Renk parlaklığını ayarla (hover efekti için)
function adjustColorBrightness(color: string, factor: number): string {
  // Hex rengi RGB'ye çevir
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Parlaklığı ayarla
  const newR = Math.min(255, Math.round(r + (255 - r) * (1 - factor)));
  const newG = Math.min(255, Math.round(g + (255 - g) * (1 - factor)));
  const newB = Math.min(255, Math.round(b + (255 - b) * (1 - factor)));

  // RGB'yi hex'e çevir
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  cell: {
    justifyContent: 'center',
    alignItems: 'center',
    // @ts-ignore - web style
    cursor: 'pointer',
  },
  highlighted: {
    borderWidth: 2,
    borderColor: GameColors.highlight,
    backgroundColor: 'rgba(144, 238, 144, 0.3)',
  },
  unitMarker: {
    width: '60%',
    height: '60%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unitLine: {
    position: 'absolute',
    width: '100%',
    height: 3,
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
  unitLine1: {
    transform: [{ rotate: '45deg' }],
  },
  unitLine2: {
    transform: [{ rotate: '-45deg' }],
  },
  castleMarker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: '70%',
    height: '60%',
  },
  castleTower: {
    width: '25%',
    height: '70%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  castleTowerMiddle: {
    height: '100%',
  },
  chestMarker: {
    width: '50%',
    height: '40%',
    backgroundColor: '#8B4513',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
});

export default memo(GridCell);
