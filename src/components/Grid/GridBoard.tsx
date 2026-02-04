/**
 * Dice Dominion - Ana Izgara Tahtası Bileşeni
 *
 * Faz 3: Köşelerde kaleler ve oyuncu renkleri.
 * Faz 4: Zar atma ve birim yerleştirme mekaniği.
 * Faz 5: Tur sistemi ve sıra belirleme.
 * Faz 6: Savaş sistemi - Seçenek A/B/C ve zar savaşları.
 * Faz 7: Kale saldırısı, HP azaltma, yenilenme, ele geçirme ve zafer.
 * Faz 8: Bonus sandık sistemi - sandık toplama ve bonus efektleri.
 * Faz 9: Arazi haritaları - Nehir ve Dağ haritaları, köprüler ve geçitler.
 * Faz 10: İsyancı istilası - AI kontrollü isyancı birimleri.
 * Faz 11: Tur zamanlayıcısı ve UI geliştirmeleri.
 * Görsel Faz V1: Harita arka planı ve arazi dokuları.
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
import MapBackground from './MapBackground';
import IsometricGrid from './IsometricGrid';
import { GridCell as GridCellType, PlayerColor } from '../../types/game.types';
import { GameColors, PlayerColors, TerrainColors } from '../../../constants/Colors';
import { getIsoMapDimensions, ISO_TILE_WIDTH, ISO_TILE_HEIGHT } from '../../utils/isometric';

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
  activeBonuses: ActiveBonus[];  // Aktif bonuslar
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

// Bonus türleri
type BonusType = 'attack' | 'defense' | 'speed' | 'bridge';

// Aktif bonus durumu
interface ActiveBonus {
  type: BonusType;
  turnsRemaining: number;
  usesRemaining?: number;  // Sadece 'bridge' için (max 2 kullanım)
}

// Sandık durumu
interface ChestState {
  x: number;
  y: number;
  bonusType: BonusType;
  isCollected: boolean;
}

// Harita türleri
type MapType = 'flat' | 'river' | 'mountain';

// İsyancı durumu
interface RebelState {
  units: { x: number; y: number }[];
  activeBonuses: ActiveBonus[];
}

// İsyancı sabitleri
const REBEL_SPAWN_INTERVAL = 3;  // Her 3 turda bir isyancı spawn olur
const REBEL_COLOR = PlayerColors.rebel;  // Mor renk

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
    activeBonuses: [],
  }));
};

// Rastgele bonus türü seç
const getRandomBonusType = (): BonusType => {
  const types: BonusType[] = ['attack', 'defense', 'speed', 'bridge'];
  return types[Math.floor(Math.random() * types.length)];
};

// Bonus türüne göre ikon ve açıklama
const getBonusInfo = (type: BonusType): { icon: string; name: string; desc: string } => {
  switch (type) {
    case 'attack':
      return { icon: '⚔️', name: 'Saldırı', desc: '+1 saldırı zarı' };
    case 'defense':
      return { icon: '🛡️', name: 'Savunma', desc: '+1 savunma zarı' };
    case 'speed':
      return { icon: '💨', name: 'Hız', desc: '+1 yerleştirme' };
    case 'bridge':
      return { icon: '🌉', name: 'Köprü', desc: '2 köprü inşa' };
  }
};

// Sandıkları oyunun başında oluştur (köşelerden eşit mesafede)
const createInitialChests = (playerCount: number): ChestState[] => {
  const chests: ChestState[] = [];

  // Haritanın merkezine yakın pozisyonlar (köşelerden eşit mesafede)
  const centerX = Math.floor(GRID_WIDTH / 2);
  const centerY = Math.floor(GRID_HEIGHT / 2);

  // Oyuncu sayısına göre sandık pozisyonları
  const chestPositions: { x: number; y: number }[] = [];

  if (playerCount >= 2) {
    // İlk 2 sandık: merkeze yakın, yatay eksende
    chestPositions.push({ x: centerX - 4, y: centerY });
    chestPositions.push({ x: centerX + 3, y: centerY - 1 });
  }
  if (playerCount >= 3) {
    // 3. sandık: merkeze yakın, alt kısımda
    chestPositions.push({ x: centerX, y: centerY + 3 });
  }
  if (playerCount >= 4) {
    // 4. sandık: merkeze yakın, üst kısımda
    chestPositions.push({ x: centerX - 1, y: centerY - 4 });
  }

  for (let i = 0; i < playerCount; i++) {
    chests.push({
      x: chestPositions[i].x,
      y: chestPositions[i].y,
      bonusType: getRandomBonusType(),
      isCollected: false,
    });
  }

  return chests;
};

// Nehir haritası için nehir ve köprü hücrelerini oluştur
const createRiverTerrain = (grid: GridCellType[][]): void => {
  const centerX = Math.floor(GRID_WIDTH / 2);

  // Nehir: merkez sütunlarında dikey çizgi (2 hücre genişliğinde)
  for (let y = 0; y < GRID_HEIGHT; y++) {
    grid[y][centerX - 1].type = 'river';
    grid[y][centerX].type = 'river';
  }

  // Köprüler: 2x2 kare, nehir üzerinde (üst ve alt bölgede)
  // Üst köprü (y=2-3)
  grid[2][centerX - 1].type = 'bridge';
  grid[2][centerX].type = 'bridge';
  grid[3][centerX - 1].type = 'bridge';
  grid[3][centerX].type = 'bridge';

  // Alt köprü (y=8-9)
  grid[8][centerX - 1].type = 'bridge';
  grid[8][centerX].type = 'bridge';
  grid[9][centerX - 1].type = 'bridge';
  grid[9][centerX].type = 'bridge';
};

// Dağ haritası için dağ ve geçit hücrelerini oluştur
const createMountainTerrain = (grid: GridCellType[][]): void => {
  const centerX = Math.floor(GRID_WIDTH / 2);

  // Dağlar: merkez sütunlarında dikey çizgi (4 hücre genişliğinde)
  for (let y = 0; y < GRID_HEIGHT; y++) {
    grid[y][centerX - 2].type = 'mountain';
    grid[y][centerX - 1].type = 'mountain';
    grid[y][centerX].type = 'mountain';
    grid[y][centerX + 1].type = 'mountain';
  }

  // Dar geçitler: tam genişlikte geçit (dağ boyunca), üst ve alt bölgede
  // Üst geçit (y=2-3, tüm dağ hücreleri temizlenir)
  for (let x = centerX - 2; x <= centerX + 1; x++) {
    grid[2][x].type = 'empty';
    grid[3][x].type = 'empty';
  }

  // Alt geçit (y=8-9, tüm dağ hücreleri temizlenir)
  for (let x = centerX - 2; x <= centerX + 1; x++) {
    grid[8][x].type = 'empty';
    grid[9][x].type = 'empty';
  }
};

// Oyuncularla birlikte ızgara oluştur
const createInitialGrid = (players: PlayerInfo[], chests: ChestState[], mapType: MapType): GridCellType[][] => {
  const grid: GridCellType[][] = [];

  for (let y = 0; y < GRID_HEIGHT; y++) {
    const row: GridCellType[] = [];
    for (let x = 0; x < GRID_WIDTH; x++) {
      row.push({ x, y, type: 'empty', ownerId: null, isCastle: false });
    }
    grid.push(row);
  }

  // Arazi türüne göre nehir/dağ ekle
  if (mapType === 'river') {
    createRiverTerrain(grid);
  } else if (mapType === 'mountain') {
    createMountainTerrain(grid);
  }

  // Kaleleri yerleştir
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

  // Sandıkları yerleştir (nehir/dağ üzerine yerleşmemeye dikkat et)
  chests.forEach((chest) => {
    if (!chest.isCollected) {
      const cell = grid[chest.y][chest.x];
      if (cell.type === 'empty') {
        cell.type = 'chest';
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
          // Boş, sandık veya köprü hücreleri geçerli yerleştirme hücreleri
          // Nehir ve dağ hücreleri GEÇERSİZ (geçilemez)
          const isValidType = adjCell.type === 'empty' || adjCell.type === 'chest' || adjCell.type === 'bridge';
          if (isValidType && adjCell.ownerId === null) {
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

// İsyancı spawn hücresi bul (rastgele boş hücre)
const findRebelSpawnCell = (grid: GridCellType[][]): { x: number; y: number } | null => {
  const emptyCells: { x: number; y: number }[] = [];

  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const cell = grid[y][x];
      // Boş, nehir/dağ olmayan, kale olmayan hücre
      if (cell.type === 'empty' && cell.ownerId === null && !cell.isCastle) {
        emptyCells.push({ x, y });
      }
    }
  }

  if (emptyCells.length === 0) return null;
  return emptyCells[Math.floor(Math.random() * emptyCells.length)];
};

// İsyancı için en yakın oyuncu birimini bul
const findNearestPlayerUnit = (
  grid: GridCellType[][],
  fromX: number,
  fromY: number
): { x: number; y: number } | null => {
  let nearest: { x: number; y: number } | null = null;
  let minDistance = Infinity;

  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const cell = grid[y][x];
      // Oyuncu birimi veya kalesi (rebel değil)
      if (cell.ownerId && cell.ownerId !== 'rebel' && (cell.type === 'unit' || cell.type === 'castle')) {
        const distance = Math.abs(x - fromX) + Math.abs(y - fromY);  // Manhattan mesafesi
        if (distance < minDistance) {
          minDistance = distance;
          nearest = { x, y };
        }
      }
    }
  }

  return nearest;
};

// İsyancı için genişleme yönünü bul (en yakın oyuncu birimine doğru)
const findRebelExpansionCell = (
  grid: GridCellType[][],
  rebelUnits: { x: number; y: number }[]
): { x: number; y: number } | null => {
  let bestCell: { x: number; y: number } | null = null;
  let bestDistance = Infinity;

  for (const unit of rebelUnits) {
    const adjacentCells = getAdjacentCells(unit.x, unit.y);
    for (const adj of adjacentCells) {
      const cell = grid[adj.y][adj.x];
      // Geçerli yerleştirme hücresi (boş veya sandık, nehir/dağ değil)
      const isValidType = cell.type === 'empty' || cell.type === 'chest' || cell.type === 'bridge';
      if (isValidType && cell.ownerId === null) {
        // En yakın oyuncu birimine olan mesafeyi hesapla
        const nearestPlayer = findNearestPlayerUnit(grid, adj.x, adj.y);
        if (nearestPlayer) {
          const distance = Math.abs(nearestPlayer.x - adj.x) + Math.abs(nearestPlayer.y - adj.y);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestCell = { x: adj.x, y: adj.y };
          }
        }
      }
    }
  }

  return bestCell;
};

// İsyancı için saldırı hedefi bul (komşu oyuncu birimi)
const findRebelAttackTarget = (
  grid: GridCellType[][],
  rebelUnits: { x: number; y: number }[]
): { attacker: { x: number; y: number }; target: { x: number; y: number } } | null => {
  const possibleAttacks: { attacker: { x: number; y: number }; target: { x: number; y: number } }[] = [];

  for (const unit of rebelUnits) {
    const adjacentCells = getAdjacentCells(unit.x, unit.y);
    for (const adj of adjacentCells) {
      const cell = grid[adj.y][adj.x];
      // Oyuncu birimi veya kalesi (rebel değil)
      if (cell.ownerId && cell.ownerId !== 'rebel' && (cell.type === 'unit' || cell.type === 'castle')) {
        possibleAttacks.push({ attacker: { x: unit.x, y: unit.y }, target: { x: adj.x, y: adj.y } });
      }
    }
  }

  if (possibleAttacks.length === 0) return null;
  // Rastgele bir saldırı seç
  return possibleAttacks[Math.floor(Math.random() * possibleAttacks.length)];
};

// İsyancı için sandık hedefi bul (2 hücre içinde ulaşılabilir)
const findRebelChestTarget = (
  grid: GridCellType[][],
  rebelUnits: { x: number; y: number }[],
  chests: ChestState[]
): { x: number; y: number } | null => {
  for (const chest of chests) {
    if (chest.isCollected) continue;

    for (const unit of rebelUnits) {
      const distance = Math.abs(chest.x - unit.x) + Math.abs(chest.y - unit.y);
      if (distance <= 2) {
        // Sandığa doğru genişleme hücresi bul
        const adjacentCells = getAdjacentCells(unit.x, unit.y);
        for (const adj of adjacentCells) {
          const cell = grid[adj.y][adj.x];
          const isValidType = cell.type === 'empty' || cell.type === 'chest' || cell.type === 'bridge';
          if (isValidType && cell.ownerId === null) {
            const newDistance = Math.abs(chest.x - adj.x) + Math.abs(chest.y - adj.y);
            if (newDistance < distance) {
              return { x: adj.x, y: adj.y };
            }
          }
        }
      }
    }
  }

  return null;
};

const GridBoard: React.FC<GridBoardProps> = ({ onCellPress }) => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Oyuncu sayısı (2-4) ve harita türü
  const [playerCount, setPlayerCount] = useState(4);
  const [mapType, setMapType] = useState<MapType>('flat');
  const [players, setPlayers] = useState<PlayerInfo[]>(() => createPlayers(playerCount));
  const [chests, setChests] = useState<ChestState[]>(() => createInitialChests(playerCount));
  const [grid, setGrid] = useState<GridCellType[][]>(() => createInitialGrid(createPlayers(playerCount), createInitialChests(playerCount), 'flat'));

  // Bonus toplandığında gösterilen bildirim
  const [collectedBonus, setCollectedBonus] = useState<{ type: BonusType; playerId: string } | null>(null);

  // Köprü inşa modu (bridge bonusu kullanıldığında)
  const [isBuildingBridge, setIsBuildingBridge] = useState(false);

  // İsyancı durumu
  const [rebels, setRebels] = useState<RebelState | null>(null);
  const [rebelSpawnCountdown, setRebelSpawnCountdown] = useState(REBEL_SPAWN_INTERVAL);
  const [isRebelTurn, setIsRebelTurn] = useState(false);
  const [rebelCombatLog, setRebelCombatLog] = useState<string | null>(null);

  // Tur zamanlayıcısı
  const [turnTimerSetting, setTurnTimerSetting] = useState<10 | 15>(15);  // 10 veya 15 saniye
  const [turnTimeRemaining, setTurnTimeRemaining] = useState<number>(15);
  const [isTimerWarning, setIsTimerWarning] = useState(false);
  const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // İzometrik harita boyutları
  const isoMapDimensions = useMemo(() => getIsoMapDimensions(), []);
  const gridTotalWidth = isoMapDimensions.width + 100;  // Ekstra padding
  const gridTotalHeight = isoMapDimensions.height + 150;  // Ekstra padding

  // Animasyon stili (hook, platform check'ten ÖNCE çağrılmalı)
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Tur zamanlayıcısı efekti
  useEffect(() => {
    // Sadece aktif oyun fazlarında zamanlayıcıyı çalıştır
    const activePhases: GamePhase[] = ['selectOption', 'waiting', 'rolling', 'placing', 'selectAttacker', 'selectTarget'];

    if (activePhases.includes(gamePhase) && !isRebelTurn && !showCombatResult) {
      // Zamanlayıcıyı başlat
      if (turnTimerRef.current) {
        clearInterval(turnTimerRef.current);
      }

      turnTimerRef.current = setInterval(() => {
        setTurnTimeRemaining(prev => {
          if (prev <= 1) {
            // Süre doldu - turu atla
            if (turnTimerRef.current) {
              clearInterval(turnTimerRef.current);
            }
            setIsTimerWarning(true);

            // 1.5 saniye uyarı göster, sonra turu bitir
            setTimeout(() => {
              setIsTimerWarning(false);
              setGamePhase('turnComplete');
            }, 1500);

            return 0;
          }

          // Son 5 saniyede uyarı
          if (prev <= 6) {
            setIsTimerWarning(true);
          }

          return prev - 1;
        });
      }, 1000);
    } else {
      // Zamanlayıcıyı durdur
      if (turnTimerRef.current) {
        clearInterval(turnTimerRef.current);
        turnTimerRef.current = null;
      }
    }

    return () => {
      if (turnTimerRef.current) {
        clearInterval(turnTimerRef.current);
      }
    };
  }, [gamePhase, isRebelTurn, showCombatResult]);

  // Oyunu sıfırla (oyuncu sayısı veya harita türü değiştiğinde)
  const resetGame = useCallback((count: number, map: MapType) => {
    const newPlayers = createPlayers(count);
    const newChests = createInitialChests(count);
    setPlayers(newPlayers);
    setChests(newChests);
    setGrid(createInitialGrid(newPlayers, newChests, map));
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
    setCollectedBonus(null);
    setWinner(null);
    setEliminatedPlayer(null);
    setIsBuildingBridge(false);
    setRebels(null);
    setRebelSpawnCountdown(REBEL_SPAWN_INTERVAL);
    setIsRebelTurn(false);
    setRebelCombatLog(null);
    setTurnTimeRemaining(turnTimerSetting);
    setIsTimerWarning(false);
    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current);
      turnTimerRef.current = null;
    }
  }, [turnTimerSetting]);

  // Oyuncu sayısı değiştiğinde
  const handlePlayerCountChange = useCallback((count: number) => {
    setPlayerCount(count);
    resetGame(count, mapType);
  }, [mapType, resetGame]);

  // Harita türü değiştiğinde
  const handleMapTypeChange = useCallback((map: MapType) => {
    setMapType(map);
    resetGame(playerCount, map);
  }, [playerCount, resetGame]);

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

    // Hız bonusu kontrolü
    const speedBonus = currentPlayer?.activeBonuses.find(b => b.type === 'speed') ? 1 : 0;

    let rollCount = 0;
    const maxRolls = 10;

    const rollInterval = setInterval(() => {
      setDiceResult(rollDice());
      rollCount++;

      if (rollCount >= maxRolls) {
        clearInterval(rollInterval);
        const baseResult = rollDice();
        const finalResult = baseResult + speedBonus;
        setDiceResult(finalResult);
        setRemainingPlacements(finalResult);
        setGamePhase('placing');
        setIsRolling(false);
      }
    }, 100);
  }, [isRolling, currentPlayer]);

  // Savaş zarları at
  const executeCombat = useCallback(() => {
    setGamePhase('combat');
    setShowCombatResult(false);

    // Bonus etkileri hesapla
    const attackBonus = currentPlayer?.activeBonuses.find(b => b.type === 'attack') ? 1 : 0;
    const defenderPos = combat.defenderPos;
    const defenderId = defenderPos ? grid[defenderPos.y][defenderPos.x].ownerId : null;
    const defender = defenderId ? players.find(p => p.id === defenderId) : null;
    const defenseBonus = defender?.activeBonuses.find(b => b.type === 'defense') ? 1 : 0;

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
        const attackerBase = rollDice();
        const defenderBase = rollDice();

        // Bonusları uygula
        const attackerFinal = attackerBase + attackBonus;
        const defenderFinal = defenderBase + defenseBonus;

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
  }, [currentPlayer, combat.defenderPos, grid, players]);

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

  // İsyancı turunu çalıştır
  const executeRebelTurn = useCallback(() => {
    if (!rebels || rebels.units.length === 0) {
      setIsRebelTurn(false);
      setRebelCombatLog(null);
      return;
    }

    setIsRebelTurn(true);

    // İsyancı AI mantığı:
    // 1. Komşu oyuncu birimi varsa saldır
    // 2. 2 hücre içinde sandık varsa sandığa doğru ilerle
    // 3. Aksi halde en yakın oyuncu birimine doğru genişle

    // 1. Saldırı kontrolü
    const attackTarget = findRebelAttackTarget(grid, rebels.units);
    if (attackTarget) {
      // Zar savaşı
      const rebelRoll = rollDice();
      const defenderCell = grid[attackTarget.target.y][attackTarget.target.x];
      const defenderId = defenderCell.ownerId;
      const defender = players.find(p => p.id === defenderId);
      const defenseBonus = defender?.activeBonuses.find(b => b.type === 'defense') ? 1 : 0;
      const defenderRoll = rollDice() + defenseBonus;

      if (rebelRoll > defenderRoll) {
        // İsyancı kazandı
        setRebelCombatLog(`İsyancı saldırdı! (${rebelRoll} vs ${defenderRoll}) - Kazandı!`);

        // Hedef hücreyi isyancıya çevir
        setGrid(prevGrid => {
          const newGrid = prevGrid.map(row => row.map(c => ({ ...c })));
          const targetCell = newGrid[attackTarget.target.y][attackTarget.target.x];

          // Kale saldırısı mı kontrol et
          if (targetCell.isCastle && defenderId) {
            // Kale HP'sini azalt
            setPlayers(prevPlayers => prevPlayers.map(p => {
              if (p.id === defenderId) {
                const newHP = p.hp - 1;
                return { ...p, hp: newHP, isAlive: newHP > 0 };
              }
              return p;
            }));
          } else {
            // Normal birim - isyancıya çevir
            targetCell.ownerId = 'rebel';
            targetCell.type = 'unit';
            setRebels(prev => prev ? {
              ...prev,
              units: [...prev.units, { x: attackTarget.target.x, y: attackTarget.target.y }]
            } : null);
          }

          return newGrid;
        });
      } else {
        // İsyancı kaybetti
        setRebelCombatLog(`İsyancı saldırdı! (${rebelRoll} vs ${defenderRoll}) - Kaybetti!`);

        // Saldıran isyancı birimini kaldır
        setGrid(prevGrid => {
          const newGrid = prevGrid.map(row => row.map(c => ({ ...c })));
          const attackerCell = newGrid[attackTarget.attacker.y][attackTarget.attacker.x];
          attackerCell.ownerId = null;
          attackerCell.type = 'empty';
          return newGrid;
        });

        setRebels(prev => prev ? {
          ...prev,
          units: prev.units.filter(u => u.x !== attackTarget.attacker.x || u.y !== attackTarget.attacker.y)
        } : null);
      }
    } else {
      // 2. Sandık kontrolü
      let expansionCell = findRebelChestTarget(grid, rebels.units, chests);

      // 3. Genişleme (sandık yoksa en yakın oyuncuya doğru)
      if (!expansionCell) {
        expansionCell = findRebelExpansionCell(grid, rebels.units);
      }

      if (expansionCell) {
        const cellAtExpansion = grid[expansionCell.y][expansionCell.x];

        // Sandık toplama kontrolü
        if (cellAtExpansion.type === 'chest') {
          const chest = chests.find(c => c.x === expansionCell!.x && c.y === expansionCell!.y && !c.isCollected);
          if (chest) {
            setChests(prevChests => prevChests.map(c =>
              c.x === expansionCell!.x && c.y === expansionCell!.y ? { ...c, isCollected: true } : c
            ));
            // İsyancıya bonus ekle
            setRebels(prev => prev ? {
              ...prev,
              activeBonuses: [...prev.activeBonuses, { type: chest.bonusType, turnsRemaining: 2, usesRemaining: chest.bonusType === 'bridge' ? 2 : undefined }]
            } : null);
            setRebelCombatLog(`İsyancı sandık topladı! (${getBonusInfo(chest.bonusType).name})`);
          }
        } else {
          setRebelCombatLog(`İsyancı genişledi.`);
        }

        // Genişleme hücresini isyancıya çevir
        setGrid(prevGrid => {
          const newGrid = prevGrid.map(row => row.map(c => ({ ...c })));
          newGrid[expansionCell!.y][expansionCell!.x].ownerId = 'rebel';
          newGrid[expansionCell!.y][expansionCell!.x].type = 'unit';
          return newGrid;
        });

        setRebels(prev => prev ? {
          ...prev,
          units: [...prev.units, { x: expansionCell!.x, y: expansionCell!.y }]
        } : null);
      } else {
        setRebelCombatLog(`İsyancı hareket edemedi.`);
      }
    }

    // İsyancı turu 1.5 saniye sonra biter
    setTimeout(() => {
      setIsRebelTurn(false);
      setRebelCombatLog(null);
    }, 1500);
  }, [rebels, grid, players, chests]);

  // Turu bitir
  const handleEndTurn = useCallback(() => {
    // Bonus sürelerini azalt (sadece mevcut oyuncu için)
    setPlayers(prevPlayers => {
      return prevPlayers.map(p => {
        // Kale HP yenilenmesi kontrolü (her 3 turda bir, ilk hasar aldıktan sonra)
        let updatedPlayer = { ...p };
        if (p.isAlive && p.castleFirstDamageTurn !== null && p.hp < CASTLE_MAX_HP) {
          const turnsSinceFirstDamage = turnNumber - p.castleFirstDamageTurn;
          if (turnsSinceFirstDamage > 0 && turnsSinceFirstDamage % 3 === 0) {
            updatedPlayer.hp = Math.min(p.hp + 1, CASTLE_MAX_HP);
          }
        }

        // Bonus sürelerini azalt (mevcut oyuncu)
        if (p.id === currentPlayer?.id) {
          updatedPlayer.activeBonuses = p.activeBonuses
            .map(b => ({ ...b, turnsRemaining: b.turnsRemaining - 1 }))
            .filter(b => b.turnsRemaining > 0);
        }

        return updatedPlayer;
      });
    });

    // İsyancı bonuslarını azalt
    if (rebels) {
      setRebels(prev => prev ? {
        ...prev,
        activeBonuses: prev.activeBonuses
          .map(b => ({ ...b, turnsRemaining: b.turnsRemaining - 1 }))
          .filter(b => b.turnsRemaining > 0)
      } : null);
    }

    // Tur 10'dan sonra, tüm sandıklar toplandıysa yeni sandık spawn et
    const allChestsCollected = chests.every(c => c.isCollected);
    if (turnNumber >= 10 && allChestsCollected) {
      // Boş bir hücre bul
      let emptyCell: { x: number; y: number } | null = null;
      for (let attempts = 0; attempts < 50; attempts++) {
        const randX = Math.floor(Math.random() * (GRID_WIDTH - 4)) + 2;
        const randY = Math.floor(Math.random() * (GRID_HEIGHT - 2)) + 1;
        const cell = grid[randY][randX];
        if (cell.type === 'empty' && !cell.isCastle) {
          emptyCell = { x: randX, y: randY };
          break;
        }
      }
      if (emptyCell) {
        const newChest: ChestState = {
          x: emptyCell.x,
          y: emptyCell.y,
          bonusType: getRandomBonusType(),
          isCollected: false,
        };
        setChests(prev => [...prev, newChest]);
        setGrid(prevGrid => {
          const newGrid = prevGrid.map(row => row.map(c => ({ ...c })));
          newGrid[emptyCell!.y][emptyCell!.x].type = 'chest';
          return newGrid;
        });
      }
    }

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

    // Tur sayısını güncelle (herkes oynadıysa)
    let newTurnNumber = turnNumber;
    if (nextIndex === 0) {
      newTurnNumber = turnNumber + 1;
      setTurnNumber(newTurnNumber);

      // İsyancı spawn sayacını güncelle
      const newCountdown = rebelSpawnCountdown - 1;
      if (newCountdown <= 0) {
        // İsyancı spawn et
        const spawnCell = findRebelSpawnCell(grid);
        if (spawnCell) {
          setGrid(prevGrid => {
            const newGrid = prevGrid.map(row => row.map(c => ({ ...c })));
            newGrid[spawnCell.y][spawnCell.x].ownerId = 'rebel';
            newGrid[spawnCell.y][spawnCell.x].type = 'unit';
            return newGrid;
          });

          if (rebels) {
            // Mevcut isyancılara ekle
            setRebels(prev => prev ? {
              ...prev,
              units: [...prev.units, { x: spawnCell.x, y: spawnCell.y }]
            } : null);
          } else {
            // Yeni isyancı oluştur
            setRebels({
              units: [{ x: spawnCell.x, y: spawnCell.y }],
              activeBonuses: [],
            });
          }

          setRebelCombatLog(`Yeni isyancı belirdi! (${spawnCell.x}, ${spawnCell.y})`);
        }

        // Sayacı sıfırla
        setRebelSpawnCountdown(REBEL_SPAWN_INTERVAL);
      } else {
        setRebelSpawnCountdown(newCountdown);
      }
    }

    // Elenen oyuncu bildirimini temizle
    setEliminatedPlayer(null);

    // İsyancı turu (varsa)
    if (rebels && rebels.units.length > 0 && nextIndex === 0) {
      // Bir sonraki tur başlamadan önce isyancı turunu çalıştır
      setTimeout(() => {
        executeRebelTurn();
      }, 500);
    }

    // Zamanlayıcıyı sıfırla
    setTurnTimeRemaining(turnTimerSetting);
    setIsTimerWarning(false);

    setGamePhase('selectOption');
    setSelectedOption(null);
    setDiceResult(null);
    setRemainingPlacements(0);
    setCombat({ attackerPos: null, defenderPos: null, attackerRoll: null, defenderRoll: null, result: null, attacksRemaining: 0, isAttackingCastle: false, defenderId: null });
  }, [currentTurnIndex, turnOrder.length, turnNumber, players, activePlayers, turnOrder, chests, grid, currentPlayer, rebels, rebelSpawnCountdown, executeRebelTurn, turnTimerSetting]);

  // Köprü inşa etmeyi başlat
  const handleStartBuildBridge = useCallback(() => {
    setIsBuildingBridge(true);
  }, []);

  // Köprü inşa etmeyi iptal et
  const handleCancelBuildBridge = useCallback(() => {
    setIsBuildingBridge(false);
  }, []);

  // Köprü inşa et (nehir hücresine tıklandığında)
  const handleBuildBridge = useCallback((x: number, y: number) => {
    const cell = grid[y][x];
    if (cell.type !== 'river') return;

    // Köprü bonusunu bul ve kullanım hakkını azalt
    setPlayers(prevPlayers => prevPlayers.map(p => {
      if (p.id === currentPlayer?.id) {
        const updatedBonuses = p.activeBonuses.map(b => {
          if (b.type === 'bridge' && b.usesRemaining && b.usesRemaining > 0) {
            return { ...b, usesRemaining: b.usesRemaining - 1 };
          }
          return b;
        }).filter(b => b.type !== 'bridge' || (b.usesRemaining && b.usesRemaining > 0));
        return { ...p, activeBonuses: updatedBonuses };
      }
      return p;
    }));

    // Hücreyi köprüye çevir
    setGrid(prevGrid => {
      const newGrid = prevGrid.map(row => row.map(c => ({ ...c })));
      newGrid[y][x].type = 'bridge';
      return newGrid;
    });

    setIsBuildingBridge(false);
  }, [grid, currentPlayer]);

  // Hücreye tıklandığında
  const handleCellPress = useCallback((x: number, y: number) => {
    const cell = grid[y][x];
    const cellKey = `${x},${y}`;

    // Köprü inşa modu
    if (isBuildingBridge) {
      if (cell.type === 'river') {
        handleBuildBridge(x, y);
      }
      return;
    }

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

      // Sandık var mı kontrol et
      const chestAtCell = chests.find(c => c.x === x && c.y === y && !c.isCollected);
      if (chestAtCell) {
        // Sandığı topla
        setChests(prevChests => prevChests.map(c =>
          c.x === x && c.y === y ? { ...c, isCollected: true } : c
        ));

        // Bonusu oyuncuya ekle
        setPlayers(prevPlayers => prevPlayers.map(p => {
          if (p.id === currentPlayer.id) {
            const newBonus: ActiveBonus = {
              type: chestAtCell.bonusType,
              turnsRemaining: 2,
              usesRemaining: chestAtCell.bonusType === 'bridge' ? 2 : undefined,
            };
            return { ...p, activeBonuses: [...p.activeBonuses, newBonus] };
          }
          return p;
        }));

        // Bonus bildirimini göster
        setCollectedBonus({ type: chestAtCell.bonusType, playerId: currentPlayer.id });
        setTimeout(() => setCollectedBonus(null), 2000);
      }

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
  }, [grid, gamePhase, remainingPlacements, validPlacementCells, attackerUnits, targetEnemies, currentPlayer, executeCombat, onCellPress, chests, isBuildingBridge, handleBuildBridge]);

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

  // Harita türü etiketleri
  const mapTypeLabels: Record<MapType, string> = {
    flat: 'Düz',
    river: 'Nehir',
    mountain: 'Dağ',
  };

  // Oyuncu sayısı, harita türü ve zamanlayıcı seçici
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
      <Text style={styles.selectorLabel}>Harita:</Text>
      <View style={styles.selectorButtons}>
        {(['flat', 'river', 'mountain'] as MapType[]).map(map => (
          <TouchableOpacity
            key={map}
            style={[styles.selectorButton, mapType === map && styles.selectorButtonActive]}
            onPress={() => handleMapTypeChange(map)}
            disabled={gamePhase !== 'setup'}
          >
            <Text style={[styles.selectorButtonText, mapType === map && styles.selectorButtonTextActive]}>{mapTypeLabels[map]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.selectorLabel}>Süre:</Text>
      <View style={styles.selectorButtons}>
        {([10, 15] as const).map(seconds => (
          <TouchableOpacity
            key={seconds}
            style={[styles.selectorButton, turnTimerSetting === seconds && styles.selectorButtonActive]}
            onPress={() => {
              setTurnTimerSetting(seconds);
              setTurnTimeRemaining(seconds);
            }}
            disabled={gamePhase !== 'setup'}
          >
            <Text style={[styles.selectorButtonText, turnTimerSetting === seconds && styles.selectorButtonTextActive]}>{seconds}s</Text>
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

    // Kazananın birim sayısını hesapla
    let winnerUnitCount = 0;
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        if (grid[y][x].ownerId === winner.id && grid[y][x].type === 'unit') {
          winnerUnitCount++;
        }
      }
    }

    return (
      <View style={styles.gameOverContainer}>
        <Text style={styles.gameOverTitle}>🏆 OYUN BİTTİ!</Text>
        <View style={[styles.winnerIndicator, { backgroundColor: winner.colorHex }]} />
        <Text style={styles.winnerText}>{winner.color.toUpperCase()} KAZANDI!</Text>

        {/* Oyun istatistikleri */}
        <View style={styles.gameStatsContainer}>
          <View style={styles.gameStatItem}>
            <Text style={styles.gameStatLabel}>Toplam Tur</Text>
            <Text style={styles.gameStatValue}>{turnNumber}</Text>
          </View>
          <View style={styles.gameStatItem}>
            <Text style={styles.gameStatLabel}>Kalan Birimler</Text>
            <Text style={styles.gameStatValue}>{winnerUnitCount}</Text>
          </View>
          <View style={styles.gameStatItem}>
            <Text style={styles.gameStatLabel}>Kale HP</Text>
            <Text style={styles.gameStatValue}>{winner.hp}/4</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.restartButton} onPress={() => handlePlayerCountChange(playerCount)}>
          <Text style={styles.restartButtonText}>🔄 Yeniden Başlat</Text>
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

  // Bonus toplama bildirimi
  const renderBonusCollectedNotification = () => {
    if (!collectedBonus) return null;
    const bonusInfo = getBonusInfo(collectedBonus.type);

    return (
      <View style={styles.bonusCollectedContainer}>
        <Text style={styles.bonusCollectedIcon}>{bonusInfo.icon}</Text>
        <Text style={styles.bonusCollectedText}>{bonusInfo.name} Bonusu Toplandı!</Text>
        <Text style={styles.bonusCollectedDesc}>{bonusInfo.desc}</Text>
      </View>
    );
  };

  // Aktif bonusları göster (sadece mevcut oyuncu)
  const renderActiveBonuses = () => {
    if (!currentPlayer || currentPlayer.activeBonuses.length === 0) return null;
    if (gamePhase === 'setup' || gamePhase === 'turnOrderRoll' || gamePhase === 'gameOver') return null;

    const bridgeBonus = currentPlayer.activeBonuses.find(b => b.type === 'bridge' && b.usesRemaining && b.usesRemaining > 0);

    return (
      <View style={styles.activeBonusesContainer}>
        {currentPlayer.activeBonuses.map((bonus, index) => {
          const bonusInfo = getBonusInfo(bonus.type);
          return (
            <View key={`${bonus.type}-${index}`} style={styles.activeBonusItem}>
              <Text style={styles.activeBonusIcon}>{bonusInfo.icon}</Text>
              <View style={styles.activeBonusInfo}>
                <Text style={styles.activeBonusName}>{bonusInfo.name}</Text>
                <Text style={styles.activeBonusTurns}>
                  {bonus.type === 'bridge' ? `${bonus.usesRemaining} kullanım` : `${bonus.turnsRemaining} tur`}
                </Text>
              </View>
            </View>
          );
        })}
        {/* Köprü inşa butonu (sadece nehir haritasında ve bridge bonusu varsa) */}
        {mapType === 'river' && bridgeBonus && !isBuildingBridge && (
          <TouchableOpacity style={styles.buildBridgeButton} onPress={handleStartBuildBridge}>
            <Text style={styles.buildBridgeButtonText}>🌉 Köprü İnşa Et</Text>
          </TouchableOpacity>
        )}
        {isBuildingBridge && (
          <View style={styles.buildingBridgeContainer}>
            <Text style={styles.buildingBridgeText}>Nehir hücresine tıkla</Text>
            <TouchableOpacity style={styles.cancelBuildButton} onPress={handleCancelBuildBridge}>
              <Text style={styles.cancelBuildButtonText}>İptal</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Zamanlayıcı uyarısı
  const renderTimerWarning = () => {
    if (!isTimerWarning || gamePhase === 'turnComplete' || gamePhase === 'gameOver') return null;

    return (
      <View style={styles.timerWarningContainer}>
        <Text style={styles.timerWarningIcon}>⏰</Text>
        <Text style={styles.timerWarningText}>
          {turnTimeRemaining === 0 ? 'SÜRE DOLDU!' : `Süre azalıyor! ${turnTimeRemaining}s`}
        </Text>
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
          {/* Zamanlayıcı */}
          <View style={[styles.timerContainer, isTimerWarning && styles.timerContainerWarning]}>
            <Text style={[styles.timerText, isTimerWarning && styles.timerTextWarning]}>
              ⏱️ {turnTimeRemaining}s
            </Text>
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

  // İsyancı sayacı ve durumu
  const renderRebelInfo = () => {
    // Setup ve turnOrderRoll fazlarında gösterme
    if (gamePhase === 'setup' || gamePhase === 'turnOrderRoll' || gamePhase === 'gameOver') return null;

    const rebelUnitCount = rebels?.units.length || 0;

    return (
      <View style={styles.rebelInfoContainer}>
        {/* Spawn sayacı */}
        <View style={styles.rebelCountdownContainer}>
          <Text style={styles.rebelCountdownIcon}>👿</Text>
          <Text style={styles.rebelCountdownText}>
            İsyancı: {rebelSpawnCountdown} tur
          </Text>
        </View>

        {/* İsyancı birim sayısı (varsa) */}
        {rebelUnitCount > 0 && (
          <View style={styles.rebelUnitCountContainer}>
            <View style={[styles.rebelColorDot, { backgroundColor: REBEL_COLOR }]} />
            <Text style={styles.rebelUnitCountText}>{rebelUnitCount} birim</Text>
          </View>
        )}
      </View>
    );
  };

  // İsyancı turu göstergesi
  const renderRebelTurnIndicator = () => {
    if (!isRebelTurn) return null;

    return (
      <View style={styles.rebelTurnContainer}>
        <Text style={styles.rebelTurnIcon}>👿</Text>
        <Text style={styles.rebelTurnText}>İSYANCI TURU</Text>
        {rebelCombatLog && (
          <Text style={styles.rebelCombatLog}>{rebelCombatLog}</Text>
        )}
      </View>
    );
  };

  // Grid içeriği - Görsel Faz V1-ISO: İzometrik görünüm
  const renderGridContent = () => (
    <IsometricGrid
      grid={grid}
      mapType={mapType}
      validPlacementCells={validPlacementCells}
      attackerUnits={attackerUnits}
      targetEnemies={targetEnemies}
      selectedAttacker={combat.attackerPos}
      onCellPress={handleCellPress}
      getOwnerColor={getOwnerColor}
      getCastleHP={getCastleHP}
    />
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
        {renderBonusCollectedNotification()}
        {renderRebelTurnIndicator()}
        {renderTimerWarning()}
        {renderGameControls()}
        {gamePhase !== 'setup' && gamePhase !== 'turnOrderRoll' && gamePhase !== 'gameOver' && renderHPIndicators()}
        {renderRebelInfo()}
        {renderActiveBonuses()}
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

  return (
    <GestureHandlerRootView style={styles.container}>
      {renderPlayerCountSelector()}
      {renderTurnOrderRoll()}
      {renderOptionMenu()}
      {renderGameOver()}
      {renderEliminatedNotification()}
      {renderBonusCollectedNotification()}
      {renderRebelTurnIndicator()}
      {renderTimerWarning()}
      {renderGameControls()}
      {gamePhase !== 'setup' && gamePhase !== 'turnOrderRoll' && gamePhase !== 'gameOver' && renderHPIndicators()}
      {renderRebelInfo()}
      {renderActiveBonuses()}
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
  // Görsel Faz V1: Arazi dokuları görünür olması için arka plan kaldırıldı
  grid: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(58, 58, 90, 0.5)', borderRadius: 4 },
  row: { flexDirection: 'row' },
  // Oyun bitti stili
  gameOverContainer: { backgroundColor: '#252540', padding: 24, alignItems: 'center', borderRadius: 12, margin: 12 },
  gameOverTitle: { color: '#FFD700', fontSize: 24, fontWeight: '900', marginBottom: 16 },
  winnerIndicator: { width: 60, height: 60, borderRadius: 30, borderWidth: 4, borderColor: '#fff', marginBottom: 12 },
  winnerText: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  gameStatsContainer: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  gameStatItem: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  gameStatLabel: { color: '#888', fontSize: 10, fontWeight: '600', marginBottom: 4 },
  gameStatValue: { color: '#fff', fontSize: 18, fontWeight: '900' },
  restartButton: { backgroundColor: '#4A90D9', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  restartButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  // Elenen oyuncu stili
  eliminatedContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 107, 107, 0.3)', padding: 8, gap: 8 },
  eliminatedPlayerColor: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#fff' },
  eliminatedText: { color: '#FF6B6B', fontSize: 14, fontWeight: '700' },
  // Bonus toplama bildirimi stili
  bonusCollectedContainer: { backgroundColor: 'rgba(255, 215, 0, 0.3)', padding: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderBottomWidth: 2, borderBottomColor: '#FFD700' },
  bonusCollectedIcon: { fontSize: 24 },
  bonusCollectedText: { color: '#FFD700', fontSize: 14, fontWeight: '700' },
  bonusCollectedDesc: { color: '#ddd', fontSize: 11 },
  // Aktif bonuslar stili
  activeBonusesContainer: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#1f1f35', gap: 8 },
  activeBonusItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 215, 0, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#FFD700', gap: 6 },
  activeBonusIcon: { fontSize: 18 },
  activeBonusInfo: { alignItems: 'flex-start' },
  activeBonusName: { color: '#FFD700', fontSize: 10, fontWeight: '700' },
  activeBonusTurns: { color: '#aaa', fontSize: 9 },
  // Köprü inşa stili
  buildBridgeButton: { backgroundColor: '#8B7355', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#FFD700' },
  buildBridgeButtonText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  buildingBridgeContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(139, 115, 85, 0.3)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  buildingBridgeText: { color: '#8B7355', fontSize: 11, fontWeight: '600' },
  cancelBuildButton: { backgroundColor: '#666', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  cancelBuildButtonText: { color: '#fff', fontSize: 10 },
  // İsyancı stilleri
  rebelInfoContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#1f1f35', gap: 16 },
  rebelCountdownContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(139, 74, 139, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#8B4A8B' },
  rebelCountdownIcon: { fontSize: 16 },
  rebelCountdownText: { color: '#8B4A8B', fontSize: 11, fontWeight: '600' },
  rebelUnitCountContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rebelColorDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff' },
  rebelUnitCountText: { color: '#8B4A8B', fontSize: 11, fontWeight: '600' },
  rebelTurnContainer: { backgroundColor: 'rgba(139, 74, 139, 0.4)', padding: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#8B4A8B' },
  rebelTurnIcon: { fontSize: 28 },
  rebelTurnText: { color: '#fff', fontSize: 16, fontWeight: '900', marginTop: 4 },
  rebelCombatLog: { color: '#ddd', fontSize: 12, marginTop: 6, textAlign: 'center' },
  // Zamanlayıcı stilleri
  timerContainer: { backgroundColor: 'rgba(74, 144, 217, 0.3)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginLeft: 10 },
  timerContainerWarning: { backgroundColor: 'rgba(255, 107, 107, 0.4)', borderWidth: 1, borderColor: '#FF6B6B' },
  timerText: { color: '#4A90D9', fontSize: 12, fontWeight: '700' },
  timerTextWarning: { color: '#FF6B6B' },
  timerWarningContainer: { backgroundColor: 'rgba(255, 107, 107, 0.5)', padding: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderBottomWidth: 2, borderBottomColor: '#FF6B6B' },
  timerWarningIcon: { fontSize: 20 },
  timerWarningText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default GridBoard;
