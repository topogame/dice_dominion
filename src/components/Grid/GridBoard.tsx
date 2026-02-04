/**
 * Dice Dominion - Ana Izgara Tahtası Bileşeni
 *
 * Bu dosya oyun haritasının ana ızgara tahtasını render eder.
 * Yakınlaştırma (pinch-to-zoom) ve kaydırma (pan) desteği içerir.
 * Faz 3: Köşelerde kaleler ve oyuncu renkleri.
 * Faz 4: Zar atma ve birim yerleştirme mekaniği.
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
  withSequence,
  withTiming,
  useAnimatedProps,
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

// Oyun durumu
type GamePhase = 'waiting' | 'rolling' | 'placing' | 'turnComplete';

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

// 4 yönlü komşuluk kontrolü (yukarı, aşağı, sol, sağ)
const getAdjacentCells = (x: number, y: number): { x: number; y: number }[] => {
  const adjacent: { x: number; y: number }[] = [];

  // Yukarı
  if (y > 0) adjacent.push({ x, y: y - 1 });
  // Aşağı
  if (y < GRID_HEIGHT - 1) adjacent.push({ x, y: y + 1 });
  // Sol
  if (x > 0) adjacent.push({ x: x - 1, y });
  // Sağ
  if (x < GRID_WIDTH - 1) adjacent.push({ x: x + 1, y });

  return adjacent;
};

// Geçerli yerleştirme hücrelerini bul
const findValidPlacementCells = (
  grid: GridCellType[][],
  playerId: string
): Set<string> => {
  const validCells = new Set<string>();

  // Tüm hücreleri tara
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const cell = grid[y][x];

      // Oyuncunun kalesine veya birimine ait mi?
      if (cell.ownerId === playerId) {
        // Komşu hücreleri kontrol et
        const adjacentCells = getAdjacentCells(x, y);

        for (const adj of adjacentCells) {
          const adjCell = grid[adj.y][adj.x];
          // Sadece boş hücreler geçerli
          if (adjCell.type === 'empty' && adjCell.ownerId === null) {
            validCells.add(`${adj.x},${adj.y}`);
          }
        }
      }
    }
  }

  return validCells;
};

// Zar atma fonksiyonu
const rollDice = (): number => {
  return Math.floor(Math.random() * 6) + 1;
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

  // Oyun durumu
  const [gamePhase, setGamePhase] = useState<GamePhase>('waiting');
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [diceResult, setDiceResult] = useState<number | null>(null);
  const [remainingPlacements, setRemainingPlacements] = useState(0);
  const [isRolling, setIsRolling] = useState(false);

  // Mevcut oyuncu
  const currentPlayer = useMemo(() => {
    const activePlayers = players.filter(p => p.isActive);
    return activePlayers[currentPlayerIndex % activePlayers.length];
  }, [players, currentPlayerIndex]);

  // Geçerli yerleştirme hücreleri
  const validPlacementCells = useMemo(() => {
    if (gamePhase !== 'placing' || !currentPlayer) {
      return new Set<string>();
    }
    return findValidPlacementCells(grid, currentPlayer.id);
  }, [grid, gamePhase, currentPlayer]);

  // Zoom ve pan için animated değerler
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Zar animasyonu için
  const diceScale = useSharedValue(1);

  // Toplam ızgara boyutları
  const gridTotalWidth = CELL_SIZE * GRID_WIDTH;
  const gridTotalHeight = CELL_SIZE * GRID_HEIGHT;

  // Oyuncu sayısı değiştiğinde ızgarayı yeniden oluştur
  const handlePlayerCountChange = useCallback((count: number) => {
    setPlayerCount(count);
    const newPlayers = createPlayers(count);
    setGrid(createInitialGrid(newPlayers));
    setGamePhase('waiting');
    setCurrentPlayerIndex(0);
    setDiceResult(null);
    setRemainingPlacements(0);
  }, []);

  // Zar at
  const handleRollDice = useCallback(() => {
    if (isRolling) return;

    setIsRolling(true);
    setGamePhase('rolling');

    // Zar animasyonu
    let rollCount = 0;
    const maxRolls = 10;

    const rollInterval = setInterval(() => {
      setDiceResult(rollDice());
      rollCount++;

      if (rollCount >= maxRolls) {
        clearInterval(rollInterval);
        const finalResult = rollDice();
        setDiceResult(finalResult);
        setRemainingPlacements(finalResult);
        setGamePhase('placing');
        setIsRolling(false);
      }
    }, 100);
  }, [isRolling]);

  // Turu bitir
  const handleEndTurn = useCallback(() => {
    const activePlayers = players.filter(p => p.isActive);
    const nextIndex = (currentPlayerIndex + 1) % activePlayers.length;
    setCurrentPlayerIndex(nextIndex);
    setGamePhase('waiting');
    setDiceResult(null);
    setRemainingPlacements(0);
  }, [players, currentPlayerIndex]);

  // Hücreye tıklandığında
  const handleCellPress = useCallback((x: number, y: number) => {
    const cell = grid[y][x];

    // Kale hücrelerine tıklanamaz
    if (cell.isCastle) return;

    // Yerleştirme aşamasında değilsek çık
    if (gamePhase !== 'placing' || remainingPlacements <= 0) return;

    // Geçerli hücre mi kontrol et
    const cellKey = `${x},${y}`;
    if (!validPlacementCells.has(cellKey)) {
      console.log('Geçersiz yerleştirme - sadece komşu boş hücrelere yerleştirilebilir');
      return;
    }

    // Birim yerleştir
    setGrid((prevGrid) => {
      const newGrid = prevGrid.map((row) => row.map((c) => ({ ...c })));
      const targetCell = newGrid[y][x];
      targetCell.type = 'unit';
      targetCell.ownerId = currentPlayer.id;
      return newGrid;
    });

    // Kalan yerleştirme sayısını azalt
    const newRemaining = remainingPlacements - 1;
    setRemainingPlacements(newRemaining);

    // Tüm yerleştirmeler bittiyse
    if (newRemaining === 0) {
      setGamePhase('turnComplete');
    }

    // Dış callback'i çağır
    onCellPress?.(x, y);
  }, [grid, gamePhase, remainingPlacements, validPlacementCells, currentPlayer, onCellPress]);

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

  // Oyun kontrolleri
  const renderGameControls = () => (
    <View style={styles.controlsContainer}>
      {/* Mevcut oyuncu bilgisi */}
      <View style={styles.currentPlayerInfo}>
        <View style={[styles.playerColorIndicator, { backgroundColor: currentPlayer?.colorHex }]} />
        <Text style={styles.currentPlayerText}>
          Sıra: {currentPlayer?.color.toUpperCase()}
        </Text>
      </View>

      {/* Zar ve yerleştirme kontrolleri */}
      <View style={styles.diceContainer}>
        {gamePhase === 'waiting' && (
          <TouchableOpacity style={styles.rollButton} onPress={handleRollDice}>
            <Text style={styles.rollButtonText}>🎲 Zar At</Text>
          </TouchableOpacity>
        )}

        {gamePhase === 'rolling' && (
          <View style={styles.diceDisplay}>
            <Text style={styles.diceNumber}>{diceResult || '?'}</Text>
            <Text style={styles.diceLabel}>Atılıyor...</Text>
          </View>
        )}

        {gamePhase === 'placing' && (
          <View style={styles.placementInfo}>
            <View style={styles.diceDisplay}>
              <Text style={styles.diceNumber}>{diceResult}</Text>
            </View>
            <Text style={styles.placementText}>
              Kalan: {remainingPlacements} birim
            </Text>
            <Text style={styles.hintText}>
              Yeşil hücrelere tıklayın
            </Text>
          </View>
        )}

        {gamePhase === 'turnComplete' && (
          <View style={styles.turnCompleteContainer}>
            <Text style={styles.turnCompleteText}>Tur Tamamlandı!</Text>
            <TouchableOpacity style={styles.endTurnButton} onPress={handleEndTurn}>
              <Text style={styles.endTurnButtonText}>Sonraki Oyuncu →</Text>
            </TouchableOpacity>
          </View>
        )}
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
          {row.map((cell, x) => {
            const cellKey = `${x},${y}`;
            const isValidPlacement = validPlacementCells.has(cellKey);

            return (
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
                isHighlighted={isValidPlacement}
                isValidPlacement={isValidPlacement}
                onPress={handleCellPress}
              />
            );
          })}
        </View>
      ))}
    </View>
  );

  // Web için basit scrollable container
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {renderPlayerCountSelector()}
        {renderGameControls()}
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
      {renderGameControls()}
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
    paddingVertical: 8,
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
    paddingVertical: 6,
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
    fontSize: 14,
    fontWeight: '600',
  },
  selectorButtonTextActive: {
    color: '#fff',
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#252540',
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a5a',
  },
  currentPlayerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerColorIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  currentPlayerText: {
    color: '#f0f0f5',
    fontSize: 16,
    fontWeight: '600',
  },
  diceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rollButton: {
    backgroundColor: '#4A90D9',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  rollButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  diceDisplay: {
    alignItems: 'center',
    backgroundColor: '#3a3a5a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 50,
  },
  diceNumber: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  diceLabel: {
    color: '#888',
    fontSize: 10,
  },
  placementInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  placementText: {
    color: '#90EE90',
    fontSize: 14,
    fontWeight: '600',
  },
  hintText: {
    color: '#888',
    fontSize: 12,
  },
  turnCompleteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  turnCompleteText: {
    color: '#90EE90',
    fontSize: 14,
    fontWeight: '600',
  },
  endTurnButton: {
    backgroundColor: '#4AD97A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  endTurnButtonText: {
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: '700',
  },
  hpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#1f1f35',
    gap: 16,
  },
  hpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hpColorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  hpText: {
    fontSize: 12,
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
