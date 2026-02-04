/**
 * Dice Dominion - Ana Izgara Tahtası Bileşeni
 *
 * Faz 3: Köşelerde kaleler ve oyuncu renkleri.
 * Faz 4: Zar atma ve birim yerleştirme mekaniği.
 * Faz 5: Tur sistemi ve sıra belirleme.
 * Faz 6: Savaş sistemi - Seçenek A/B/C ve zar savaşları.
 * Faz 7: Kale saldırısı, HP azaltma, yenilenme, ele geçirme ve zafer.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  Platform,
  TouchableOpacity,
  Modal,
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
const GRID_WIDTH = 24;
const GRID_HEIGHT = 12;
const CELL_SIZE = 35;
const CASTLE_SIZE = 2;
const CASTLE_MAX_HP = 4;

// Oyuncu bilgileri
interface PlayerInfo {
  id: string;
  color: PlayerColor;
  colorHex: string;
  castleCorner: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  castlePosition: { x: number; y: number };
  hp: number;
  isActive: boolean;
  isAlive: boolean;  // Oyuncu hala oyunda mı?
  castleFirstDamageTurn: number | null;  // HP yenilenme zamanlayıcısı için
  turnOrderRoll?: number;
}

// Tur seçenekleri
type TurnOption = 'A' | 'B' | 'C' | null;

// Oyun fazları
type GamePhase =
  | 'setup'
  | 'turnOrderRoll'
  | 'selectOption'      // Seçenek A/B/C seçimi
  | 'waiting'
  | 'rolling'
  | 'placing'
  | 'selectAttacker'    // Saldıran birimi seç
  | 'selectTarget'      // Hedef seç
  | 'combat'            // Savaş animasyonu
  | 'turnComplete'
  | 'gameOver';         // Oyun bitti - kazanan var

// Savaş durumu
interface CombatState {
  attackerPos: { x: number; y: number } | null;
  defenderPos: { x: number; y: number } | null;
  attackerRoll: number | null;
  defenderRoll: number | null;
  result: 'win' | 'lose' | 'tie' | null;
  attacksRemaining: number;  // Option C için
  isAttackingCastle: boolean;  // Kale saldırısı mı?
  defenderId: string | null;   // Savunan oyuncu ID'si
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
    isAlive: index < playerCount,
    castleFirstDamageTurn: null,
    turnOrderRoll: undefined,
  }));
};

// Oyuncularla birlikte ızgara oluştur
const createInitialGrid = (players: PlayerInfo[]): GridCellType[][] => {
  const grid: GridCellType[][] = [];

  for (let y = 0; y < GRID_HEIGHT; y++) {
    const row: GridCellType[] = [];
    for (let x = 0; x < GRID_WIDTH; x++) {
      row.push({ x, y, type: 'empty', ownerId: null, isCastle: false });
    }
    grid.push(row);
  }

  players.forEach((player) => {
    if (!player.isActive) return;
    const { x: startX, y: startY } = player.castlePosition;
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

// 4 yönlü komşuluk kontrolü
const getAdjacentCells = (x: number, y: number): { x: number; y: number }[] => {
  const adjacent: { x: number; y: number }[] = [];
  if (y > 0) adjacent.push({ x, y: y - 1 });
  if (y < GRID_HEIGHT - 1) adjacent.push({ x, y: y + 1 });
  if (x > 0) adjacent.push({ x: x - 1, y });
  if (x < GRID_WIDTH - 1) adjacent.push({ x: x + 1, y });
  return adjacent;
};

// Geçerli yerleştirme hücrelerini bul
const findValidPlacementCells = (grid: GridCellType[][], playerId: string): Set<string> => {
  const validCells = new Set<string>();
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const cell = grid[y][x];
      if (cell.ownerId === playerId) {
        const adjacentCells = getAdjacentCells(x, y);
        for (const adj of adjacentCells) {
          const adjCell = grid[adj.y][adj.x];
          if (adjCell.type === 'empty' && adjCell.ownerId === null) {
            validCells.add(`${adj.x},${adj.y}`);
          }
        }
      }
    }
  }
  return validCells;
};

// Saldırabilecek birimleri bul (düşman komşusu olan kendi birimleri)
const findAttackerUnits = (grid: GridCellType[][], playerId: string): Set<string> => {
  const attackers = new Set<string>();
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const cell = grid[y][x];
      if (cell.ownerId === playerId && cell.type === 'unit') {
        const adjacentCells = getAdjacentCells(x, y);
        for (const adj of adjacentCells) {
          const adjCell = grid[adj.y][adj.x];
          if (adjCell.ownerId && adjCell.ownerId !== playerId && (adjCell.type === 'unit' || adjCell.type === 'castle')) {
            attackers.add(`${x},${y}`);
            break;
          }
        }
      }
    }
  }
  return attackers;
};

// Hedef düşman birimlerini bul (seçili birime komşu)
const findTargetEnemies = (grid: GridCellType[][], attackerX: number, attackerY: number, playerId: string): Set<string> => {
  const targets = new Set<string>();
  const adjacentCells = getAdjacentCells(attackerX, attackerY);
  for (const adj of adjacentCells) {
    const adjCell = grid[adj.y][adj.x];
    if (adjCell.ownerId && adjCell.ownerId !== playerId && (adjCell.type === 'unit' || adjCell.type === 'castle')) {
      targets.add(`${adj.x},${adj.y}`);
    }
  }
  return targets;
};

// Zar atma fonksiyonu
const rollDice = (): number => Math.floor(Math.random() * 6) + 1;

const GridBoard: React.FC<GridBoardProps> = ({ onCellPress }) => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Oyuncu sayısı (2-4)
  const [playerCount, setPlayerCount] = useState(4);
  const [players, setPlayers] = useState<PlayerInfo[]>(() => createPlayers(playerCount));
  const [grid, setGrid] = useState<GridCellType[][]>(() => createInitialGrid(players));

  // Oyun durumu
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');
  const [turnOrder, setTurnOrder] = useState<number[]>([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [turnNumber, setTurnNumber] = useState(1);
  const [selectedOption, setSelectedOption] = useState<TurnOption>(null);
  const [diceResult, setDiceResult] = useState<number | null>(null);
  const [remainingPlacements, setRemainingPlacements] = useState(0);
  const [isRolling, setIsRolling] = useState(false);

  // Sıra belirleme
  const [turnOrderRolls, setTurnOrderRolls] = useState<{ playerId: string; roll: number }[]>([]);
  const [currentRollingPlayerIndex, setCurrentRollingPlayerIndex] = useState(0);

  // Savaş durumu
  const [combat, setCombat] = useState<CombatState>({
    attackerPos: null,
    defenderPos: null,
    attackerRoll: null,
    defenderRoll: null,
    result: null,
    attacksRemaining: 0,
    isAttackingCastle: false,
    defenderId: null,
  });
  const [showCombatResult, setShowCombatResult] = useState(false);

  // Kazanan oyuncu (oyun bittiğinde)
  const [winner, setWinner] = useState<PlayerInfo | null>(null);

  // Elenen oyuncu bildirimi
  const [eliminatedPlayer, setEliminatedPlayer] = useState<PlayerInfo | null>(null);

  // Aktif oyuncular
  const activePlayers = useMemo(() => players.filter(p => p.isActive), [players]);

  // Mevcut oyuncu
  const currentPlayer = useMemo(() => {
    if (turnOrder.length === 0) return activePlayers[0];
    return activePlayers[turnOrder[currentTurnIndex % turnOrder.length]];
  }, [activePlayers, turnOrder, currentTurnIndex]);

  // Geçerli yerleştirme hücreleri
  const validPlacementCells = useMemo(() => {
    if (gamePhase !== 'placing' || !currentPlayer) return new Set<string>();
    return findValidPlacementCells(grid, currentPlayer.id);
  }, [grid, gamePhase, currentPlayer]);

  // Saldırabilecek birimler
  const attackerUnits = useMemo(() => {
    if (gamePhase !== 'selectAttacker' || !currentPlayer) return new Set<string>();
    return findAttackerUnits(grid, currentPlayer.id);
  }, [grid, gamePhase, currentPlayer]);

  // Hedef düşman birimleri
  const targetEnemies = useMemo(() => {
    if (gamePhase !== 'selectTarget' || !combat.attackerPos || !currentPlayer) return new Set<string>();
    return findTargetEnemies(grid, combat.attackerPos.x, combat.attackerPos.y, currentPlayer.id);
  }, [grid, gamePhase, combat.attackerPos, currentPlayer]);

  // Zoom ve pan için animated değerler
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const gridTotalWidth = CELL_SIZE * GRID_WIDTH;
  const gridTotalHeight = CELL_SIZE * GRID_HEIGHT;

  // Oyuncu sayısı değiştiğinde
  const handlePlayerCountChange = useCallback((count: number) => {
    setPlayerCount(count);
    const newPlayers = createPlayers(count);
    setPlayers(newPlayers);
    setGrid(createInitialGrid(newPlayers));
    setGamePhase('setup');
    setTurnOrder([]);
    setCurrentTurnIndex(0);
    setTurnNumber(1);
    setSelectedOption(null);
    setDiceResult(null);
    setRemainingPlacements(0);
    setTurnOrderRolls([]);
    setCurrentRollingPlayerIndex(0);
    setCombat({ attackerPos: null, defenderPos: null, attackerRoll: null, defenderRoll: null, result: null, attacksRemaining: 0, isAttackingCastle: false, defenderId: null });
  }, []);

  // Oyunu başlat
  const handleStartGame = useCallback(() => {
    setGamePhase('turnOrderRoll');
    setTurnOrderRolls([]);
    setCurrentRollingPlayerIndex(0);
  }, []);

  // Sıra belirleme zarı at
  const handleTurnOrderRoll = useCallback(() => {
    if (isRolling) return;
    setIsRolling(true);
    const currentRoller = activePlayers[currentRollingPlayerIndex];

    let rollCount = 0;
    const maxRolls = 10;

    const rollInterval = setInterval(() => {
      setDiceResult(rollDice());
      rollCount++;

      if (rollCount >= maxRolls) {
        clearInterval(rollInterval);
        const finalRoll = rollDice();
        setDiceResult(finalRoll);

        const newRolls = [...turnOrderRolls, { playerId: currentRoller.id, roll: finalRoll }];
        setTurnOrderRolls(newRolls);

        if (newRolls.length >= activePlayers.length) {
          const sortedRolls = [...newRolls].sort((a, b) => b.roll - a.roll);
          const order = sortedRolls.map(r => activePlayers.findIndex(p => p.id === r.playerId));
          setTurnOrder(order);

          setTimeout(() => {
            setGamePhase('selectOption');
            setDiceResult(null);
            setIsRolling(false);
          }, 1500);
        } else {
          setTimeout(() => {
            setCurrentRollingPlayerIndex(currentRollingPlayerIndex + 1);
            setDiceResult(null);
            setIsRolling(false);
          }, 1000);
        }
      }
    }, 100);
  }, [isRolling, activePlayers, currentRollingPlayerIndex, turnOrderRolls]);

  // Seçenek seç (A/B/C)
  const handleSelectOption = useCallback((option: TurnOption) => {
    setSelectedOption(option);
    if (option === 'A') {
      setGamePhase('waiting');
    } else if (option === 'B' || option === 'C') {
      const attacksRemaining = option === 'C' ? 2 : 1;
      setCombat(prev => ({ ...prev, attacksRemaining }));
      setGamePhase('selectAttacker');
    }
  }, []);

  // Normal zar at (birim yerleştirme için)
  const handleRollDice = useCallback(() => {
    if (isRolling) return;
    setIsRolling(true);
    setGamePhase('rolling');

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

  // Savaş zarları at
  const executeCombat = useCallback(() => {
    setGamePhase('combat');
    setShowCombatResult(false);

    let rollCount = 0;
    const maxRolls = 8;

    const rollInterval = setInterval(() => {
      setCombat(prev => ({
        ...prev,
        attackerRoll: rollDice(),
        defenderRoll: rollDice(),
      }));
      rollCount++;

      if (rollCount >= maxRolls) {
        clearInterval(rollInterval);
        const attackerFinal = rollDice();
        const defenderFinal = rollDice();

        // Beraberlik savunana gider
        let result: 'win' | 'lose' | 'tie';
        if (attackerFinal > defenderFinal) {
          result = 'win';
        } else if (attackerFinal < defenderFinal) {
          result = 'lose';
        } else {
          result = 'tie'; // Beraberlik = savunan kazanır
        }

        setCombat(prev => ({
          ...prev,
          attackerRoll: attackerFinal,
          defenderRoll: defenderFinal,
          result,
        }));
        setShowCombatResult(true);
      }
    }, 150);
  }, []);

  // Savaş sonucunu uygula
  const applyCombatResult = useCallback(() => {
    const { attackerPos, defenderPos, result, attacksRemaining, isAttackingCastle, defenderId } = combat;
    if (!attackerPos || !defenderPos || !result) return;

    let playerEliminated: PlayerInfo | null = null;
    let gameWinner: PlayerInfo | null = null;

    if (result === 'win') {
      if (isAttackingCastle && defenderId) {
        // Kale saldırısı kazanıldı - HP azalt
        setPlayers(prevPlayers => {
          const newPlayers = prevPlayers.map(p => {
            if (p.id === defenderId) {
              const newHP = p.hp - 1;
              const firstDamageTurn = p.castleFirstDamageTurn ?? turnNumber;

              if (newHP <= 0) {
                // Oyuncu elendi!
                playerEliminated = { ...p, hp: 0, isAlive: false };
                return { ...p, hp: 0, isAlive: false, castleFirstDamageTurn: firstDamageTurn };
              }
              return { ...p, hp: newHP, castleFirstDamageTurn: firstDamageTurn };
            }
            return p;
          });

          // Kazanan kontrolü - hayatta kalan oyuncu sayısı
          const alivePlayers = newPlayers.filter(p => p.isActive && p.isAlive);
          if (alivePlayers.length === 1) {
            gameWinner = alivePlayers[0];
          }

          return newPlayers;
        });

        // Elenen oyuncunun tüm birimlerini ve kalesini sil
        if (playerEliminated) {
          setGrid(prevGrid => {
            const newGrid = prevGrid.map(row => row.map(c => {
              if (c.ownerId === defenderId) {
                if (c.isCastle) {
                  // Kaleyi saldırana ver
                  return { ...c, ownerId: currentPlayer.id };
                } else {
                  // Birimleri sil
                  return { ...c, type: 'empty' as const, ownerId: null };
                }
              }
              return c;
            }));
            return newGrid;
          });
          setEliminatedPlayer(playerEliminated);
        }
      } else {
        // Normal birim saldırısı - hücreyi al
        setGrid(prevGrid => {
          const newGrid = prevGrid.map(row => row.map(c => ({ ...c })));
          const defenderCell = newGrid[defenderPos.y][defenderPos.x];
          defenderCell.ownerId = currentPlayer.id;
          defenderCell.type = 'unit';
          return newGrid;
        });
      }
    } else {
      // Saldıran kaybetti veya berabere (berabere = savunan kazanır)
      // Saldıranın birimi ölür
      setGrid(prevGrid => {
        const newGrid = prevGrid.map(row => row.map(c => ({ ...c })));
        const attackerCell = newGrid[attackerPos.y][attackerPos.x];
        attackerCell.type = 'empty';
        attackerCell.ownerId = null;
        return newGrid;
      });
    }

    // Oyun bitti mi kontrol et
    if (gameWinner) {
      setWinner(gameWinner);
      setGamePhase('gameOver');
      setCombat({ attackerPos: null, defenderPos: null, attackerRoll: null, defenderRoll: null, result: null, attacksRemaining: 0, isAttackingCastle: false, defenderId: null });
      setShowCombatResult(false);
      return;
    }

    // Sonraki adım
    if (result === 'win') {
      const remainingAttacks = attacksRemaining - 1;
      if (selectedOption === 'B') {
        // Option B: 1 saldırı + genişleme
        setGamePhase('waiting');
        setCombat({ attackerPos: null, defenderPos: null, attackerRoll: null, defenderRoll: null, result: null, attacksRemaining: 0, isAttackingCastle: false, defenderId: null });
      } else if (selectedOption === 'C' && remainingAttacks > 0) {
        // Option C: 2. saldırı hakkı
        setCombat({ attackerPos: null, defenderPos: null, attackerRoll: null, defenderRoll: null, result: null, attacksRemaining: remainingAttacks, isAttackingCastle: false, defenderId: null });
        setGamePhase('selectAttacker');
      } else {
        // Option C: saldırılar bitti, genişleme yok
        setGamePhase('turnComplete');
        setCombat({ attackerPos: null, defenderPos: null, attackerRoll: null, defenderRoll: null, result: null, attacksRemaining: 0, isAttackingCastle: false, defenderId: null });
      }
    } else {
      // Kaybettiyse tur biter
      setGamePhase('turnComplete');
      setCombat({ attackerPos: null, defenderPos: null, attackerRoll: null, defenderRoll: null, result: null, attacksRemaining: 0, isAttackingCastle: false, defenderId: null });
    }

    setShowCombatResult(false);
  }, [combat, currentPlayer, selectedOption, turnNumber]);

  // Turu bitir
  const handleEndTurn = useCallback(() => {
    // Kale HP yenilenmesi kontrolü (her 3 turda bir, ilk hasar aldıktan sonra)
    setPlayers(prevPlayers => {
      return prevPlayers.map(p => {
        if (p.isAlive && p.castleFirstDamageTurn !== null && p.hp < CASTLE_MAX_HP) {
          const turnsSinceFirstDamage = turnNumber - p.castleFirstDamageTurn;
          if (turnsSinceFirstDamage > 0 && turnsSinceFirstDamage % 3 === 0) {
            return { ...p, hp: Math.min(p.hp + 1, CASTLE_MAX_HP) };
          }
        }
        return p;
      });
    });

    // Sonraki oyuncuyu bul (elenen oyuncuları atla)
    let nextIndex = (currentTurnIndex + 1) % turnOrder.length;
    let attempts = 0;
    const alivePlayers = players.filter(p => p.isActive && p.isAlive);

    while (attempts < turnOrder.length) {
      const nextPlayer = activePlayers[turnOrder[nextIndex]];
      if (nextPlayer && nextPlayer.isAlive) {
        break;
      }
      nextIndex = (nextIndex + 1) % turnOrder.length;
      attempts++;
    }

    setCurrentTurnIndex(nextIndex);

    if (nextIndex === 0) {
      setTurnNumber(prev => prev + 1);
    }

    // Elenen oyuncu bildirimini temizle
    setEliminatedPlayer(null);

    setGamePhase('selectOption');
    setSelectedOption(null);
    setDiceResult(null);
    setRemainingPlacements(0);
    setCombat({ attackerPos: null, defenderPos: null, attackerRoll: null, defenderRoll: null, result: null, attacksRemaining: 0, isAttackingCastle: false, defenderId: null });
  }, [currentTurnIndex, turnOrder.length, turnNumber, players, activePlayers, turnOrder]);

  // Hücreye tıklandığında
  const handleCellPress = useCallback((x: number, y: number) => {
    const cell = grid[y][x];
    const cellKey = `${x},${y}`;

    // Saldıran birim seçimi
    if (gamePhase === 'selectAttacker') {
      if (attackerUnits.has(cellKey)) {
        setCombat(prev => ({ ...prev, attackerPos: { x, y } }));
        setGamePhase('selectTarget');
      }
      return;
    }

    // Hedef seçimi
    if (gamePhase === 'selectTarget') {
      if (targetEnemies.has(cellKey)) {
        const targetCell = grid[y][x];
        const isAttackingCastle = targetCell.isCastle;
        const defenderId = targetCell.ownerId;
        setCombat(prev => ({ ...prev, defenderPos: { x, y }, isAttackingCastle, defenderId }));
        executeCombat();
      }
      return;
    }

    // Yerleştirme
    if (gamePhase === 'placing') {
      if (cell.isCastle) return;
      if (remainingPlacements <= 0) return;
      if (!validPlacementCells.has(cellKey)) return;

      setGrid(prevGrid => {
        const newGrid = prevGrid.map(row => row.map(c => ({ ...c })));
        const targetCell = newGrid[y][x];
        targetCell.type = 'unit';
        targetCell.ownerId = currentPlayer.id;
        return newGrid;
      });

      const newRemaining = remainingPlacements - 1;
      setRemainingPlacements(newRemaining);

      if (newRemaining === 0) {
        setGamePhase('turnComplete');
      }
    }

    onCellPress?.(x, y);
  }, [grid, gamePhase, remainingPlacements, validPlacementCells, attackerUnits, targetEnemies, currentPlayer, executeCombat, onCellPress]);

  // İptal (geri dön)
  const handleCancel = useCallback(() => {
    if (gamePhase === 'selectTarget') {
      setCombat(prev => ({ ...prev, attackerPos: null }));
      setGamePhase('selectAttacker');
    } else if (gamePhase === 'selectAttacker') {
      setGamePhase('selectOption');
      setSelectedOption(null);
      setCombat({ attackerPos: null, defenderPos: null, attackerRoll: null, defenderRoll: null, result: null, attacksRemaining: 0, isAttackingCastle: false, defenderId: null });
    }
  }, [gamePhase]);

  // Oyuncu rengini al
  const getOwnerColor = (ownerId: string | null): string | null => {
    if (!ownerId) return null;
    const player = players.find(p => p.id === ownerId);
    if (player) return player.colorHex;
    if (ownerId === 'rebel') return PlayerColors.rebel;
    return null;
  };

  // Kale HP'sini al
  const getCastleHP = (ownerId: string | null): number | null => {
    if (!ownerId) return null;
    const player = players.find(p => p.id === ownerId);
    return player?.hp ?? null;
  };

  // Oyuncu sayısı seçici
  const renderPlayerCountSelector = () => (
    <View style={styles.selectorContainer}>
      <Text style={styles.selectorLabel}>Oyuncu:</Text>
      <View style={styles.selectorButtons}>
        {[2, 3, 4].map(count => (
          <TouchableOpacity
            key={count}
            style={[styles.selectorButton, playerCount === count && styles.selectorButtonActive]}
            onPress={() => handlePlayerCountChange(count)}
            disabled={gamePhase !== 'setup'}
          >
            <Text style={[styles.selectorButtonText, playerCount === count && styles.selectorButtonTextActive]}>{count}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {gamePhase === 'setup' && (
        <TouchableOpacity style={styles.startButton} onPress={handleStartGame}>
          <Text style={styles.startButtonText}>Başlat</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Sıra belirleme UI
  const renderTurnOrderRoll = () => {
    if (gamePhase !== 'turnOrderRoll') return null;
    const currentRoller = activePlayers[currentRollingPlayerIndex];

    return (
      <View style={styles.turnOrderContainer}>
        <Text style={styles.turnOrderTitle}>Sıra Belirleme</Text>
        <View style={styles.rollResults}>
          {turnOrderRolls.map(roll => {
            const player = activePlayers.find(p => p.id === roll.playerId);
            return (
              <View key={roll.playerId} style={styles.rollResultItem}>
                <View style={[styles.rollResultColor, { backgroundColor: player?.colorHex }]} />
                <Text style={styles.rollResultText}>{roll.roll}</Text>
              </View>
            );
          })}
        </View>
        {currentRollingPlayerIndex < activePlayers.length && (
          <View style={styles.currentRollContainer}>
            <View style={[styles.currentRollerIndicator, { backgroundColor: currentRoller?.colorHex }]} />
            {diceResult !== null && (
              <View style={styles.diceDisplayLarge}>
                <Text style={styles.diceNumberLarge}>{diceResult}</Text>
              </View>
            )}
            <TouchableOpacity style={[styles.rollButton, isRolling && styles.rollButtonDisabled]} onPress={handleTurnOrderRoll} disabled={isRolling}>
              <Text style={styles.rollButtonText}>{isRolling ? '...' : '🎲 At'}</Text>
            </TouchableOpacity>
          </View>
        )}
        {turnOrderRolls.length >= activePlayers.length && (
          <Text style={styles.turnOrderResultTitle}>Başlıyor...</Text>
        )}
      </View>
    );
  };

  // Seçenek menüsü (A/B/C)
  const renderOptionMenu = () => {
    if (gamePhase !== 'selectOption') return null;
    const hasAttackers = findAttackerUnits(grid, currentPlayer?.id || '').size > 0;

    return (
      <View style={styles.optionMenuContainer}>
        <View style={styles.optionPlayerIndicator}>
          <View style={[styles.optionPlayerColor, { backgroundColor: currentPlayer?.colorHex }]} />
          <Text style={styles.optionMenuTitle}>Seçenek Seç</Text>
        </View>
        <View style={styles.optionButtons}>
          <TouchableOpacity style={styles.optionButton} onPress={() => handleSelectOption('A')}>
            <Text style={styles.optionButtonLabel}>A</Text>
            <Text style={styles.optionButtonDesc}>Genişle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, !hasAttackers && styles.optionButtonDisabled]}
            onPress={() => handleSelectOption('B')}
            disabled={!hasAttackers}
          >
            <Text style={styles.optionButtonLabel}>B</Text>
            <Text style={styles.optionButtonDesc}>1 Saldırı + Genişle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, !hasAttackers && styles.optionButtonDisabled]}
            onPress={() => handleSelectOption('C')}
            disabled={!hasAttackers}
          >
            <Text style={styles.optionButtonLabel}>C</Text>
            <Text style={styles.optionButtonDesc}>2 Saldırı</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Savaş UI
  const renderCombatUI = () => {
    if (gamePhase === 'selectAttacker') {
      return (
        <View style={styles.combatUIContainer}>
          <Text style={styles.combatUIText}>Saldıracak birimi seç (turuncu)</Text>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelButtonText}>İptal</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (gamePhase === 'selectTarget') {
      return (
        <View style={styles.combatUIContainer}>
          <Text style={styles.combatUIText}>Hedef seç (kırmızı)</Text>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelButtonText}>Geri</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (gamePhase === 'combat') {
      return (
        <View style={styles.combatUIContainer}>
          <View style={styles.combatDiceRow}>
            <View style={styles.combatDiceBox}>
              <Text style={styles.combatDiceLabel}>Saldıran</Text>
              <Text style={styles.combatDiceNumber}>{combat.attackerRoll || '?'}</Text>
            </View>
            <Text style={styles.combatVS}>VS</Text>
            <View style={styles.combatDiceBox}>
              <Text style={styles.combatDiceLabel}>Savunan</Text>
              <Text style={styles.combatDiceNumber}>{combat.defenderRoll || '?'}</Text>
            </View>
          </View>
          {showCombatResult && (
            <View style={styles.combatResultContainer}>
              <Text style={[
                styles.combatResultText,
                combat.result === 'win' ? styles.combatWin : styles.combatLose
              ]}>
                {combat.result === 'win' ? '✓ KAZANDIN!' : combat.result === 'tie' ? '= BERABERLİK (Savunan kazanır)' : '✗ KAYBETTİN!'}
              </Text>
              <TouchableOpacity style={styles.continueButton} onPress={applyCombatResult}>
                <Text style={styles.continueButtonText}>Devam →</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    }
    return null;
  };

  // Zafer ekranı
  const renderGameOver = () => {
    if (gamePhase !== 'gameOver' || !winner) return null;

    return (
      <View style={styles.gameOverContainer}>
        <Text style={styles.gameOverTitle}>🏆 OYUN BİTTİ!</Text>
        <View style={[styles.winnerIndicator, { backgroundColor: winner.colorHex }]} />
        <Text style={styles.winnerText}>{winner.color.toUpperCase()} KAZANDI!</Text>
        <TouchableOpacity style={styles.restartButton} onPress={() => handlePlayerCountChange(playerCount)}>
          <Text style={styles.restartButtonText}>Yeniden Başlat</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Elenen oyuncu bildirimi
  const renderEliminatedNotification = () => {
    if (!eliminatedPlayer) return null;

    return (
      <View style={styles.eliminatedContainer}>
        <View style={[styles.eliminatedPlayerColor, { backgroundColor: eliminatedPlayer.colorHex }]} />
        <Text style={styles.eliminatedText}>{eliminatedPlayer.color.toUpperCase()} ELENDİ!</Text>
      </View>
    );
  };

  // Oyun kontrolleri
  const renderGameControls = () => {
    if (gamePhase === 'setup' || gamePhase === 'turnOrderRoll' || gamePhase === 'selectOption' || gamePhase === 'gameOver') return null;
    if (gamePhase === 'selectAttacker' || gamePhase === 'selectTarget' || gamePhase === 'combat') return renderCombatUI();

    return (
      <View style={styles.controlsContainer}>
        <View style={styles.turnInfo}>
          <Text style={styles.turnNumber}>Tur {turnNumber}</Text>
          <View style={styles.currentPlayerInfo}>
            <View style={[styles.playerColorIndicator, { backgroundColor: currentPlayer?.colorHex }]} />
            <Text style={styles.currentPlayerText}>{selectedOption && `[${selectedOption}]`}</Text>
          </View>
        </View>
        <View style={styles.diceContainer}>
          {gamePhase === 'waiting' && (
            <TouchableOpacity style={styles.rollButton} onPress={handleRollDice}>
              <Text style={styles.rollButtonText}>🎲 Zar At</Text>
            </TouchableOpacity>
          )}
          {gamePhase === 'rolling' && (
            <View style={styles.diceDisplay}>
              <Text style={styles.diceNumber}>{diceResult || '?'}</Text>
            </View>
          )}
          {gamePhase === 'placing' && (
            <View style={styles.placementInfo}>
              <View style={styles.diceDisplay}>
                <Text style={styles.diceNumber}>{diceResult}</Text>
              </View>
              <Text style={styles.placementText}>Kalan: {remainingPlacements}</Text>
            </View>
          )}
          {gamePhase === 'turnComplete' && (
            <TouchableOpacity style={styles.endTurnButton} onPress={handleEndTurn}>
              <Text style={styles.endTurnButtonText}>Sonraki →</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // HP göstergesi
  const renderHPIndicators = () => (
    <View style={styles.hpContainer}>
      {activePlayers.map(player => {
        const isCurrentPlayer = currentPlayer?.id === player.id;
        return (
          <View key={player.id} style={[styles.hpItem, isCurrentPlayer && styles.hpItemActive]}>
            <View style={[styles.hpColorDot, { backgroundColor: player.colorHex }]} />
            <Text style={styles.hpText}>{'❤️'.repeat(player.hp)}</Text>
          </View>
        );
      })}
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
            const isAttacker = attackerUnits.has(cellKey);
            const isTarget = targetEnemies.has(cellKey);
            const isSelectedAttacker = combat.attackerPos?.x === x && combat.attackerPos?.y === y;

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
                isAttacker={isAttacker || isSelectedAttacker}
                isTarget={isTarget}
                onPress={handleCellPress}
              />
            );
          })}
        </View>
      ))}
    </View>
  );

  // Web için
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {renderPlayerCountSelector()}
        {renderTurnOrderRoll()}
        {renderOptionMenu()}
        {renderGameOver()}
        {renderEliminatedNotification()}
        {renderGameControls()}
        {gamePhase !== 'setup' && gamePhase !== 'turnOrderRoll' && gamePhase !== 'gameOver' && renderHPIndicators()}
        <View style={{ flex: 1, overflow: 'auto' as any, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          {renderGridContent()}
        </View>
      </View>
    );
  }

  // Mobil için
  const pinchGesture = Gesture.Pinch()
    .onStart(() => { savedScale.value = scale.value; })
    .onUpdate(event => { scale.value = Math.min(Math.max(savedScale.value * event.scale, 0.5), 3); })
    .onEnd(() => { if (scale.value < 0.8) scale.value = withSpring(0.8); });

  const panGesture = Gesture.Pan()
    .onStart(() => { savedTranslateX.value = translateX.value; savedTranslateY.value = translateY.value; })
    .onUpdate(event => { translateX.value = savedTranslateX.value + event.translationX; translateY.value = savedTranslateY.value + event.translationY; })
    .onEnd(() => {
      const maxX = (gridTotalWidth * scale.value - screenWidth) / 2;
      const maxY = (gridTotalHeight * scale.value - screenHeight) / 2;
      if (translateX.value > maxX) translateX.value = withSpring(maxX);
      else if (translateX.value < -maxX) translateX.value = withSpring(-maxX);
      if (translateY.value > maxY) translateY.value = withSpring(maxY);
      else if (translateY.value < -maxY) translateY.value = withSpring(-maxY);
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }] }));

  return (
    <GestureHandlerRootView style={styles.container}>
      {renderPlayerCountSelector()}
      {renderTurnOrderRoll()}
      {renderOptionMenu()}
      {renderGameOver()}
      {renderEliminatedNotification()}
      {renderGameControls()}
      {gamePhase !== 'setup' && gamePhase !== 'turnOrderRoll' && gamePhase !== 'gameOver' && renderHPIndicators()}
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.gridContainer, animatedStyle]}>
          {renderGridContent()}
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  selectorContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#2a2a4a', flexWrap: 'wrap', gap: 8 },
  selectorLabel: { color: '#f0f0f5', fontSize: 12, marginRight: 6 },
  selectorButtons: { flexDirection: 'row', gap: 4 },
  selectorButton: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4, backgroundColor: '#3a3a5a' },
  selectorButtonActive: { backgroundColor: '#4A90D9' },
  selectorButtonText: { color: '#888', fontSize: 12, fontWeight: '600' },
  selectorButtonTextActive: { color: '#fff' },
  startButton: { backgroundColor: '#4AD97A', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 },
  startButtonText: { color: '#1a1a2e', fontSize: 12, fontWeight: '700' },
  turnOrderContainer: { backgroundColor: '#252540', padding: 12, alignItems: 'center' },
  turnOrderTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  rollResults: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 12 },
  rollResultItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#3a3a5a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  rollResultColor: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  rollResultText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  currentRollContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  currentRollerIndicator: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#fff' },
  diceDisplayLarge: { backgroundColor: '#3a3a5a', width: 50, height: 50, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  diceNumberLarge: { color: '#fff', fontSize: 28, fontWeight: '900' },
  turnOrderResultTitle: { color: '#90EE90', fontSize: 14, fontWeight: '700', marginTop: 8 },
  optionMenuContainer: { backgroundColor: '#252540', padding: 12, alignItems: 'center' },
  optionPlayerIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  optionPlayerColor: { width: 24, height: 24, borderRadius: 12, borderWidth: 3, borderColor: '#fff' },
  optionMenuTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  optionButtons: { flexDirection: 'row', gap: 10 },
  optionButton: { backgroundColor: '#4A90D9', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignItems: 'center', minWidth: 90 },
  optionButtonDisabled: { backgroundColor: '#3a3a5a', opacity: 0.5 },
  optionButtonLabel: { color: '#fff', fontSize: 20, fontWeight: '900' },
  optionButtonDesc: { color: '#ddd', fontSize: 10, marginTop: 2 },
  combatUIContainer: { backgroundColor: '#252540', padding: 12, alignItems: 'center' },
  combatUIText: { color: '#fff', fontSize: 14, marginBottom: 8 },
  cancelButton: { backgroundColor: '#666', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 },
  cancelButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  combatDiceRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  combatDiceBox: { alignItems: 'center', backgroundColor: '#3a3a5a', padding: 12, borderRadius: 8 },
  combatDiceLabel: { color: '#888', fontSize: 10, marginBottom: 4 },
  combatDiceNumber: { color: '#fff', fontSize: 32, fontWeight: '900' },
  combatVS: { color: '#fff', fontSize: 18, fontWeight: '700' },
  combatResultContainer: { marginTop: 12, alignItems: 'center' },
  combatResultText: { fontSize: 18, fontWeight: '900' },
  combatWin: { color: '#90EE90' },
  combatLose: { color: '#FF6B6B' },
  continueButton: { backgroundColor: '#4AD97A', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 6, marginTop: 8 },
  continueButtonText: { color: '#1a1a2e', fontSize: 14, fontWeight: '700' },
  controlsContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#252540' },
  turnInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  turnNumber: { color: '#888', fontSize: 11, fontWeight: '600' },
  currentPlayerInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  playerColorIndicator: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#fff' },
  currentPlayerText: { color: '#f0f0f5', fontSize: 12, fontWeight: '600' },
  diceContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rollButton: { backgroundColor: '#4A90D9', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  rollButtonDisabled: { opacity: 0.6 },
  rollButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  diceDisplay: { alignItems: 'center', backgroundColor: '#3a3a5a', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
  diceNumber: { color: '#fff', fontSize: 18, fontWeight: '900' },
  placementInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  placementText: { color: '#90EE90', fontSize: 12, fontWeight: '600' },
  endTurnButton: { backgroundColor: '#4AD97A', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  endTurnButtonText: { color: '#1a1a2e', fontSize: 12, fontWeight: '700' },
  hpContainer: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#1f1f35', gap: 10 },
  hpItem: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  hpItemActive: { backgroundColor: 'rgba(144, 238, 144, 0.2)', borderWidth: 1, borderColor: '#90EE90' },
  hpColorDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
  hpText: { fontSize: 10 },
  gridContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  grid: { backgroundColor: GameColors.grid, borderWidth: 2, borderColor: GameColors.gridBorder, borderRadius: 4 },
  row: { flexDirection: 'row' },
  // Oyun bitti stili
  gameOverContainer: { backgroundColor: '#252540', padding: 24, alignItems: 'center', borderRadius: 12, margin: 12 },
  gameOverTitle: { color: '#FFD700', fontSize: 24, fontWeight: '900', marginBottom: 16 },
  winnerIndicator: { width: 60, height: 60, borderRadius: 30, borderWidth: 4, borderColor: '#fff', marginBottom: 12 },
  winnerText: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 20 },
  restartButton: { backgroundColor: '#4A90D9', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  restartButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  // Elenen oyuncu stili
  eliminatedContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 107, 107, 0.3)', padding: 8, gap: 8 },
  eliminatedPlayerColor: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#fff' },
  eliminatedText: { color: '#FF6B6B', fontSize: 14, fontWeight: '700' },
});

export default GridBoard;
