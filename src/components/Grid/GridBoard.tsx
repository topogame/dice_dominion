/**
 * Dice Dominion - Ana Izgara Tahtası Bileşeni
 *
 * Bu dosya oyun haritasının ana ızgara tahtasını render eder.
 * Yakınlaştırma (pinch-to-zoom) ve kaydırma (pan) desteği içerir.
 */

import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import {
  GestureHandlerRootView,
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import GridCell from './GridCell';
import { GridCell as GridCellType } from '../../types/game.types';
import { GameColors, PlayerColors } from '../../../constants/Colors';

// Izgara sabitleri
const GRID_WIDTH = 24;  // Sütun sayısı
const GRID_HEIGHT = 12; // Satır sayısı
const MIN_CELL_SIZE = 30;
const MAX_CELL_SIZE = 60;

interface GridBoardProps {
  onCellPress?: (x: number, y: number) => void;
}

// Başlangıç ızgara durumunu oluştur
const createInitialGrid = (): GridCellType[][] => {
  const grid: GridCellType[][] = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    const row: GridCellType[] = [];
    for (let x = 0; x < GRID_WIDTH; x++) {
      row.push({
        x,
        y,
        type: 'empty',
        ownerId: null,
        isCastle: false,
      });
    }
    grid.push(row);
  }
  return grid;
};

const GridBoard: React.FC<GridBoardProps> = ({ onCellPress }) => {
  // Ekran boyutları
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Izgara durumu
  const [grid, setGrid] = useState<GridCellType[][]>(createInitialGrid);
  const [highlightedCell, setHighlightedCell] = useState<{ x: number; y: number } | null>(null);

  // Zoom ve pan için animated değerler
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Hücre boyutunu hesapla (ekrana sığacak şekilde)
  const baseCellSize = Math.min(
    (screenWidth - 20) / GRID_WIDTH,
    (screenHeight - 200) / GRID_HEIGHT,
    MAX_CELL_SIZE
  );
  const cellSize = Math.max(baseCellSize, MIN_CELL_SIZE);

  // Toplam ızgara boyutları
  const gridTotalWidth = cellSize * GRID_WIDTH;
  const gridTotalHeight = cellSize * GRID_HEIGHT;

  // Test için: Hücreye tıklandığında rengini değiştir
  const handleCellPress = useCallback((x: number, y: number) => {
    // Izgara durumunu güncelle
    setGrid((prevGrid) => {
      const newGrid = prevGrid.map((row) => row.map((cell) => ({ ...cell })));
      const cell = newGrid[y][x];

      // Hücre türünü döngüsel olarak değiştir (test için)
      if (cell.type === 'empty') {
        cell.type = 'unit';
        cell.ownerId = 'player1';
      } else if (cell.type === 'unit') {
        cell.type = 'empty';
        cell.ownerId = null;
      }

      return newGrid;
    });

    // Vurgulanan hücreyi güncelle
    setHighlightedCell({ x, y });

    // Dış callback'i çağır
    onCellPress?.(x, y);
  }, [onCellPress]);

  // Oyuncu rengini al
  const getOwnerColor = (ownerId: string | null): string | null => {
    if (!ownerId) return null;
    switch (ownerId) {
      case 'player1':
        return PlayerColors.blue;
      case 'player2':
        return PlayerColors.red;
      case 'player3':
        return PlayerColors.green;
      case 'player4':
        return PlayerColors.yellow;
      case 'rebel':
        return PlayerColors.rebel;
      default:
        return PlayerColors.blue;
    }
  };

  // Grid içeriği
  const renderGridContent = () => (
    <View style={[styles.grid, { width: gridTotalWidth, height: gridTotalHeight }]}>
      {grid.map((row, y) => (
        <View key={`row-${y}`} style={styles.row}>
          {row.map((cell, x) => (
            <GridCell
              key={`cell-${x}-${y}`}
              x={x}
              y={y}
              size={cellSize}
              type={cell.type}
              ownerId={cell.ownerId}
              ownerColor={getOwnerColor(cell.ownerId)}
              isHighlighted={
                highlightedCell?.x === x && highlightedCell?.y === y
              }
              onPress={handleCellPress}
            />
          ))}
        </View>
      ))}
    </View>
  );

  // Web için ScrollView
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={styles.scrollContent}
        >
          <ScrollView
            showsVerticalScrollIndicator
            contentContainerStyle={styles.scrollContent}
          >
            {renderGridContent()}
          </ScrollView>
        </ScrollView>
      </View>
    );
  }

  // Mobil için gesture desteği
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      const newScale = savedScale.value * event.scale;
      scale.value = Math.min(Math.max(newScale, 0.5), 3);
    })
    .onEnd(() => {
      if (scale.value < 0.8) {
        scale.value = withSpring(0.8);
      }
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      const maxTranslateX = (gridTotalWidth * scale.value - screenWidth) / 2;
      const maxTranslateY = (gridTotalHeight * scale.value - screenHeight) / 2;

      if (translateX.value > maxTranslateX) {
        translateX.value = withSpring(maxTranslateX);
      } else if (translateX.value < -maxTranslateX) {
        translateX.value = withSpring(-maxTranslateX);
      }

      if (translateY.value > maxTranslateY) {
        translateY.value = withSpring(maxTranslateY);
      } else if (translateY.value < -maxTranslateY) {
        translateY.value = withSpring(-maxTranslateY);
      }
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.gridContainer, animatedStyle]}>
          {renderGridContent()}
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  gridContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  grid: {
    backgroundColor: GameColors.grid,
    borderWidth: 2,
    borderColor: GameColors.gridBorder,
    borderRadius: 4,
  },
  row: {
    flexDirection: 'row',
  },
});

export default GridBoard;
