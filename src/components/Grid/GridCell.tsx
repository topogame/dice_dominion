/**
 * Dice Dominion - Izgara Hücresi Bileşeni
 *
 * Bu dosya tek bir ızgara hücresini render eder.
 * Hücre tıklanabilir ve farklı durumları görsel olarak gösterir.
 */

import React, { memo } from 'react';
import { StyleSheet, View, Pressable, Platform } from 'react-native';
import { GameColors } from '../../../constants/Colors';
import { CellType } from '../../types/game.types';

interface GridCellProps {
  x: number;
  y: number;
  size: number;
  type: CellType;
  ownerId: string | null;
  ownerColor: string | null;
  isHighlighted: boolean;
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
  isHighlighted,
  onPress,
}) => {
  // Hücre tıklandığında
  const handlePress = () => {
    onPress(x, y);
  };

  // Arka plan rengi
  const backgroundColor = getCellBackgroundColor(type, ownerColor);

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.cell,
        {
          width: size,
          height: size,
          backgroundColor,
        },
        isHighlighted && styles.highlighted,
      ]}
    >
      {/* Birim göstergesi (X işareti) */}
      {type === 'unit' && (
        <View style={styles.unitMarker}>
          <View style={[styles.unitLine, styles.unitLine1]} />
          <View style={[styles.unitLine, styles.unitLine2]} />
        </View>
      )}

      {/* Kale göstergesi */}
      {type === 'castle' && (
        <View style={styles.castleMarker}>
          <View style={styles.castleTower} />
          <View style={styles.castleTower} />
          <View style={styles.castleTower} />
        </View>
      )}

      {/* Hazine sandığı göstergesi */}
      {type === 'chest' && (
        <View style={styles.chestMarker} />
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  cell: {
    borderWidth: 1,
    borderColor: GameColors.gridBorder,
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer' as any,
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
    height: '100%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
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
