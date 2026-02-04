/**
 * Dice Dominion - Ana Izgara Tahtası Bileşeni
 *
 * Bu dosya oyun haritasının ana ızgara tahtasını render eder.
 * Yakınlaştırma (pinch-to-zoom) ve kaydırma (pan) desteği içerir.
 * Faz 3: Köşelerde kaleler ve oyuncu renkleri eklendi.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  Platform,
  TouchableOpacity,
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
import { GridCell as GridCellType, PlayerColor } from '../../types/game.types';
import { GameColors, PlayerColors } from '../../../constants/Colors';

// Izgara sabitleri
const GRID_WIDTH = 24;  // Sütun sayısı
const GRID_HEIGHT = 12; // Satır sayısı
const CELL_SIZE = 35;   // Sabit hücre boyutu
const CASTLE_SIZE = 2;  // Kale boyutu (2x2)
const CASTLE_MAX_HP = 4; // Maksimum kale HP

// Oyuncu bilgileri
interface PlayerInfo {
  id: string;
  color: PlayerColor;
  colorHex: string;
  castleCorner: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  castlePosition: { x: number; y: number };
  hp: number;
  isActive: boolean;
}

// 4 köşedeki kale pozisyonları
const CASTLE_POSITIONS = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: GRID_WIDTH - CASTLE_SIZE, y: 0 },
  bottomLeft: { x: 0, y: GRID_HEIGHT - CASTLE_SIZE },
  bottomRight: { x: GRID_WIDTH - CASTLE_SIZE, y: GRID_HEIGHT - CASTLE_SIZE },
};

// Oyuncu renk sıralaması
const PLAYER_COLORS: { color: PlayerColor; hex: string; corner: keyof typeof CASTLE_POSITIONS }[] = [
  { color: 'blue', hex: PlayerColors.blue, corner: 'topLeft' },
  { color: 'red', hex: PlayerColors.red, corner: 'topRight' },
  { color: 'green', hex: PlayerColors.green, corner: 'bottomLeft' },
  { color: 'yellow', hex: PlayerColors.yellow, corner: 'bottomRight' },
];

interface GridBoardProps {
  onCellPress?: (x: number, y: number) => void;
}

// Oyuncu sayısına göre başlangıç oyuncu listesini oluştur
const createPlayers = (playerCount: number): PlayerInfo[] => {
  return PLAYER_COLORS.map((p, index) => ({
    id: `player${index + 1}`,
    color: p.color,
    colorHex: p.hex,
    castleCorner: p.corner,
    castlePosition: CASTLE_POSITIONS[p.corner],
    hp: CASTLE_MAX_HP,
    isActive: index < playerCount,
  }));
};

// Oyuncularla birlikte ızgara oluştur
const createInitialGrid = (players: PlayerInfo[]): GridCellType[][] => {
  const grid: GridCellType[][] = [];

  // Boş ızgara oluştur
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

  // Aktif oyuncuların kalelerini yerleştir
  players.forEach((player) => {
    if (!player.isActive) return;

    const { x: startX, y: startY } = player.castlePosition;

    // 2x2 kale hücrelerini işaretle
    for (let dy = 0; dy < CASTLE_SIZE; dy++) {
      for (let dx = 0; dx < CASTLE_SIZE; dx++) {
        const cell = grid[startY + dy][startX + dx];
        cell.type = 'castle';
        cell.ownerId = player.id;
        cell.isCastle = true;
      }
    }
  });

  return grid;
};

const GridBoard: React.FC<GridBoardProps> = ({ onCellPress }) => {
  // Ekran boyutları
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Oyuncu sayısı (2-4)
  const [playerCount, setPlayerCount] = useState(4);

  // Oyuncu bilgileri
  const players = useMemo(() => createPlayers(playerCount), [playerCount]);

  // Izgara durumu
  const [grid, setGrid] = useState<GridCellType[][]>(() => createInitialGrid(players));
  const [highlightedCell, setHighlightedCell] = useState<{ x: number; y: number } | null>(null);

  // Oyuncu sayısı değiştiğinde ızgarayı yeniden oluştur
  const handlePlayerCountChange = useCallback((count: number) => {
    setPlayerCount(count);
    const newPlayers = createPlayers(count);
    setGrid(createInitialGrid(newPlayers));
  }, []);

  // Zoom ve pan için animated değerler
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Toplam ızgara boyutları
  const gridTotalWidth = CELL_SIZE * GRID_WIDTH;
  const gridTotalHeight = CELL_SIZE * GRID_HEIGHT;

  // Hücreye tıklandığında
  const handleCellPress = useCallback((x: number, y: number) => {
    // Kale hücrelerine tıklanamaz
    const cell = grid[y][x];
    if (cell.isCastle) return;

    // Izgara durumunu güncelle
    setGrid((prevGrid) => {
      const newGrid = prevGrid.map((row) => row.map((c) => ({ ...c })));
      const targetCell = newGrid[y][x];

      // Hücre türünü döngüsel olarak değiştir (test için)
      if (targetCell.type === 'empty') {
        targetCell.type = 'unit';
        targetCell.ownerId = 'player1';
      } else if (targetCell.type === 'unit') {
        targetCell.type = 'empty';
        targetCell.ownerId = null;
      }

      return newGrid;
    });

    // Vurgulanan hücreyi güncelle
    setHighlightedCell({ x, y });

    // Dış callback'i çağır
    onCellPress?.(x, y);
  }, [grid, onCellPress]);

  // Oyuncu rengini al
  const getOwnerColor = (ownerId: string | null): string | null => {
    if (!ownerId) return null;
    const player = players.find((p) => p.id === ownerId);
    if (player) return player.colorHex;
    if (ownerId === 'rebel') return PlayerColors.rebel;
    return null;
  };

  // Kale HP'sini al
  const getCastleHP = (ownerId: string | null): number | null => {
    if (!ownerId) return null;
    const player = players.find((p) => p.id === ownerId);
    return player?.hp ?? null;
  };

  // Oyuncu sayısı seçici
  const renderPlayerCountSelector = () => (
    <View style={styles.selectorContainer}>
      <Text style={styles.selectorLabel}>Oyuncu Sayısı:</Text>
      <View style={styles.selectorButtons}>
        {[2, 3, 4].map((count) => (
          <TouchableOpacity
            key={count}
            style={[
              styles.selectorButton,
              playerCount === count && styles.selectorButtonActive,
            ]}
            onPress={() => handlePlayerCountChange(count)}
          >
            <Text
              style={[
                styles.selectorButtonText,
                playerCount === count && styles.selectorButtonTextActive,
              ]}
            >
              {count}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // HP göstergesi
  const renderHPIndicators = () => (
    <View style={styles.hpContainer}>
      {players.filter((p) => p.isActive).map((player) => (
        <View key={player.id} style={styles.hpItem}>
          <View style={[styles.hpColorDot, { backgroundColor: player.colorHex }]} />
          <Text style={styles.hpText}>
            {'❤️'.repeat(player.hp)}{'🖤'.repeat(CASTLE_MAX_HP - player.hp)}
          </Text>
        </View>
      ))}
    </View>
  );

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
              size={CELL_SIZE}
              type={cell.type}
              ownerId={cell.ownerId}
              ownerColor={getOwnerColor(cell.ownerId)}
              isCastle={cell.isCastle}
              castleHP={cell.isCastle ? getCastleHP(cell.ownerId) : null}
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

  // Web için basit scrollable container
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {renderPlayerCountSelector()}
        {renderHPIndicators()}
        <View
          // @ts-ignore - web style
          style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          {renderGridContent()}
        </View>
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
      {renderPlayerCountSelector()}
      {renderHPIndicators()}
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
  },
  selectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#2a2a4a',
  },
  selectorLabel: {
    color: '#f0f0f5',
    fontSize: 14,
    marginRight: 10,
  },
  selectorButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  selectorButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#3a3a5a',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectorButtonActive: {
    backgroundColor: '#4A90D9',
    borderColor: '#6BA3E0',
  },
  selectorButtonText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
  selectorButtonTextActive: {
    color: '#fff',
  },
  hpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#252540',
    gap: 16,
  },
  hpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hpColorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  hpText: {
    fontSize: 14,
  },
  gridContainer: {
    flex: 1,
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
