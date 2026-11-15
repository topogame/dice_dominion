import { create } from 'zustand';
import type { BonusType, GameState, GridCell, PlayerColor } from '../types/GameTypes';
import { createInitialGameState } from '../core/GameStateFactory';
import { calculateValidPlacements } from '../core/GridLogic';
import { calculatePlacementPoints, placeUnit } from '../core/PlacementSystem';
import { decrementBonuses, findChestSpawnPosition, hasActiveBonus } from '../core/ChestSystem';
import { advanceToNextPlayer, calculateAttackableEnemies } from '../core/TurnManager';
import { applyCombatResult, determineNextPhaseAfterCombat, resolveCombatRolls } from '../core/CombatSystem';
import { checkVictory } from '../core/PlayerManager';
import { COLS, KINGDOMS, ROWS, cellToWorld } from '../theme';
import type { SoundName } from '../audio/recipes';
import { MAP_TYPE, SKIRMISH } from '../config';

export const HUMAN_ID = 'player1';

/** How long the placement die tumbles before its value counts. */
export const DICE_TUMBLE_MS = 1500;
const DICE_HOLD_MS = 550;

// Combat beats: dice roll, the strike lands, then a pause to read the outcome.
const COMBAT_ROLL_MS = 1150;
const COMBAT_STRIKE_MS = 420;
/** Delay between the lunge starting and the blow landing. Shared with the Units component. */
export const LUNGE_IMPACT_MS = 450;
const COMBAT_AFTERMATH_MS = 1250;

export type Terrain = 'grass' | 'river' | 'bridge' | 'mountain';
export type TurnOption = 'A' | 'B' | 'C';
export type Phase =
  | 'ready' // human, nothing to attack: roll for placement
  | 'choosing' // human picks expand / strike + expand / double strike
  | 'attacking' // human picks an attacker, then a target
  | 'combat' // a fight is being played out
  | 'rolling'
  | 'placing'
  | 'waiting' // a computer kingdom is acting, or the turn is changing
  | 'over';

export interface Cell {
  x: number;
  y: number;
}

// ── Visual-effect bus: game → scene, without React re-renders ──────────
export type FxEvent =
  | { type: 'land'; x: number; y: number; color: string }
  /** A die touches down. `main` is the big placement die, which also shakes the board. */
  | { type: 'diceLand'; strength: number; main: boolean }
  /** A sound that no visual effect already stands for. */
  | { type: 'cue'; name: SoundName }
  | { type: 'shake'; strength: number }
  | { type: 'burst'; at: [number, number, number]; color: string; count: number; speed: number; lift: number; life: number }
  | { type: 'clash'; at: [number, number, number] }
  | { type: 'text'; at: [number, number, number]; text: string; color: string }
  | { type: 'attack'; from: Cell; to: Cell }
  | { type: 'block'; x: number; y: number }
  | { type: 'capture'; x: number; y: number; fromColor: string }
  | { type: 'unitDeath'; x: number; y: number; color: string; dx: number; dz: number }
  | { type: 'castleHit'; playerId: string }
  | { type: 'castleFall'; playerId: string; x: number; y: number; color: string };

const fxListeners = new Set<(e: FxEvent) => void>();
export const fx = {
  emit(e: FxEvent) {
    fxListeners.forEach((l) => l(e));
  },
  on(l: (e: FxEvent) => void) {
    fxListeners.add(l);
    return () => {
      fxListeners.delete(l);
    };
  },
};

export interface Banner {
  id: number;
  text: string;
  sub?: string;
  color: string;
}

export type DieId = 'main' | 'atk' | 'def';

export interface DieState {
  value: number;
  /** Bumped to start a new throw. */
  rollId: number;
  visible: boolean;
  color: string;
  /** World x/z the die comes to rest above. */
  at: [number, number];
  size: number;
  /** Height of the invisible surface it bounces on. */
  floor: number;
  /** Seconds from release to rest. */
  duration: number;
}

export interface CombatView {
  attacker: { name: string; color: string; roll: number; bonus: number };
  defender: { name: string; color: string; roll: number; bonus: number; isCastle: boolean };
  /** `rolling` while the dice tumble; afterwards the outcome from the attacker's side. */
  stage: 'rolling' | 'won' | 'lost';
  isTie: boolean;
  outcome: string;
}

interface GameStore {
  grid: GridCell[][];
  gs: GameState;
  /** Fixed terrain layout, captured before any unit overwrites a cell type. */
  terrain: Terrain[][];
  /** Bumped after every mutation of grid / gs so React re-reads them. */
  version: number;
  phase: Phase;
  dice: Record<DieId, DieState>;
  /** Colour of the kingdom whose turn it is. */
  turnColor: string;

  placementsLeft: number;
  placementsTotal: number;
  /** Legal placement tiles. */
  valid: Set<string>;

  turnOption: TurnOption | null;
  attacksLeft: number;
  /** True once an attack has been made this turn, after which the choice cannot be undone. */
  committed: boolean;
  /** The player's units that have an enemy next to them. */
  attackers: Set<string>;
  selected: string | null;
  /** Enemy tiles the selected unit can strike. */
  targets: Set<string>;
  /** Everything a tap can act on in the current phase. */
  tappable: Set<string>;
  combat: CombatView | null;
  winner: string | null;

  hover: string | null;
  banner: Banner | null;

  roll: () => void;
  chooseOption: (option: TurnOption) => void;
  cancelAttack: () => void;
  tapCell: (x: number, y: number) => void;
  setHover: (key: string | null) => void;
  /** Begins the first turn. Called once the 3D scene has drawn its first frames. */
  start: () => void;
  restart: () => void;
}

const BONUS_LABEL: Record<BonusType, string> = {
  defense: 'Defense Shield',
  attack: 'Attack Boost',
  speed: 'Speed Bonus',
  bridge: 'Bridge Builder',
};

const NAMES: Record<string, PlayerColor> = {
  player1: 'blue',
  player2: 'yellow',
  player3: 'green',
  player4: 'red',
};

const cellOf = (key: string): Cell => {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
};

// Timers are tied to a generation so a restart cancels everything in flight.
let generation = 0;
function later(ms: number, fn: () => void) {
  const g = generation;
  setTimeout(() => {
    if (g === generation) fn();
  }, ms);
}

let bannerId = 0;

/**
 * Add `?skirmish` to the URL to start with armies already in contact, so
 * combat can be tried without playing the opening turns: blue faces yellow
 * soldiers beside its castle and has one soldier at the gates of a green
 * castle that is down to its last hit point.
 */

function seedSkirmish(grid: GridCell[][], gameState: GameState) {
  const put = (x: number, y: number, id: string) => {
    grid[y][x].type = 'unit';
    grid[y][x].ownerId = id;
    gameState.players[id].unitCount++;
  };
  put(2, 0, 'player1');
  put(2, 1, 'player1');
  put(3, 0, 'player2');
  put(3, 1, 'player2');
  put(2, ROWS - 2, 'player1');
  gameState.players.player3.castleHP = 1;
}

function buildMatch() {
  const { grid, gameState } = createInitialGameState(4, MAP_TYPE, COLS, ROWS, 0);

  for (const p of Object.values(gameState.players)) {
    p.displayName = KINGDOMS[NAMES[p.id]].name;
  }

  const terrain: Terrain[][] = grid.map((row) =>
    row.map((c) =>
      c.type === 'river' || c.type === 'bridge' || c.type === 'mountain' ? c.type : 'grass',
    ),
  );

  if (SKIRMISH) seedSkirmish(grid, gameState);

  const bonuses: BonusType[] = ['speed', 'attack', 'defense', 'speed'];
  for (const bonusType of bonuses) {
    const pos = findChestSpawnPosition(grid, gameState.players, COLS, ROWS, 3, Math.random);
    if (!pos) continue;
    grid[pos.y][pos.x].type = 'chest';
    gameState.chests.push({ x: pos.x, y: pos.y, bonusType, isCollected: false });
  }

  return { grid, gs: gameState, terrain };
}

function initialDice(): Record<DieId, DieState> {
  const blank = { value: 1, rollId: 0, visible: false, color: KINGDOMS.blue.color };
  return {
    main: { ...blank, at: [0, 1.2], size: 1.05, floor: 2, duration: DICE_TUMBLE_MS / 1000 },
    atk: { ...blank, at: [0, 0], size: 0.6, floor: 1.55, duration: COMBAT_ROLL_MS / 1000 },
    def: { ...blank, at: [0, 0], size: 0.6, floor: 1.55, duration: COMBAT_ROLL_MS / 1000 },
  };
}

const NO_CELLS: Set<string> = new Set();

export const useGame = create<GameStore>((set, get) => {
  const currentId = () => {
    const { gs } = get();
    return gs.turnOrder[gs.currentPlayerIndex];
  };
  const colorOf = (id: string) => KINGDOMS[get().gs.players[id].color].color;
  const isHuman = () => currentId() === HUMAN_ID;

  const showBanner = (text: string, color: string, sub?: string) => {
    const id = ++bannerId;
    set({ banner: { id, text, sub, color } });
    later(1700, () => {
      if (get().banner?.id === id) set({ banner: null });
    });
  };

  const setDie = (id: DieId, patch: Partial<DieState>) =>
    set({ dice: { ...get().dice, [id]: { ...get().dice[id], ...patch } } });

  // ── Attack bookkeeping ───────────────────────────────────────────────
  /** Only soldiers attack; a castle next to an enemy cannot strike on its own. */
  const findAttackers = (playerId: string): Map<string, Set<string>> => {
    const { grid } = get();
    const result = new Map<string, Set<string>>();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = grid[y][x];
        if (cell.type !== 'unit' || cell.ownerId !== playerId) continue;
        const enemies = calculateAttackableEnemies(grid, x, y, playerId, COLS, ROWS);
        if (enemies.size) result.set(`${x},${y}`, enemies);
      }
    }
    return result;
  };

  const clearAttackUi = () =>
    set({ attackers: NO_CELLS, selected: null, targets: NO_CELLS, tappable: NO_CELLS });

  // ── Turn flow ────────────────────────────────────────────────────────
  const beginTurn = () => {
    const id = currentId();
    const player = get().gs.players[id];
    const human = id === HUMAN_ID;
    const canAttack = findAttackers(id).size > 0;
    set({
      phase: human ? (canAttack ? 'choosing' : 'ready') : 'waiting',
      turnColor: colorOf(id),
      valid: NO_CELLS,
      placementsLeft: 0,
      placementsTotal: 0,
      turnOption: null,
      attacksLeft: 0,
      committed: false,
      combat: null,
    });
    clearAttackUi();
    setDie('main', { visible: false, color: colorOf(id) });
    showBanner(player.displayName, colorOf(id), human ? 'Your turn' : undefined);
    fx.emit({ type: 'cue', name: human ? 'yourTurn' : 'turn' });
    if (!human) later(950, aiChoose);
  };

  const endTurn = () => {
    const { gs } = get();
    if (get().phase === 'over') return;
    decrementBonuses(gs.players[currentId()]);
    const next = advanceToNextPlayer(gs.currentPlayerIndex, gs.turnOrder.length, gs.currentTurn);
    gs.currentPlayerIndex = next.nextPlayerIndex;
    gs.currentTurn = next.newTurn;
    set({ version: get().version + 1, phase: 'waiting', valid: NO_CELLS });
    clearAttackUi();
    later(450, beginTurn);
  };

  // ── Placement ────────────────────────────────────────────────────────
  const refreshValid = () => {
    const valid = calculateValidPlacements(get().grid, currentId(), COLS, ROWS);
    set({ valid, tappable: valid });
    return valid;
  };

  const startRoll = () => {
    const id = currentId();
    const value = 1 + Math.floor(Math.random() * 6);
    set({ phase: 'rolling' });
    clearAttackUi();
    fx.emit({ type: 'cue', name: 'rattle' });
    setDie('main', { value, rollId: get().dice.main.rollId + 1, visible: true, color: colorOf(id) });
    later(DICE_TUMBLE_MS + DICE_HOLD_MS, () => {
      const player = get().gs.players[id];
      const points = calculatePlacementPoints(value, hasActiveBonus(player, 'speed'));
      const valid = refreshValid();
      setDie('main', { visible: false });
      if (valid.size === 0) {
        set({ tappable: NO_CELLS });
        endTurn();
        return;
      }
      set({ placementsLeft: points, placementsTotal: points });
      if (id === HUMAN_ID) {
        set({ phase: 'placing' });
      } else {
        set({ phase: 'waiting', valid: NO_CELLS, tappable: NO_CELLS });
        later(250, aiPlace);
      }
    });
  };

  const doPlace = (x: number, y: number) => {
    const { grid, gs } = get();
    const id = currentId();
    const result = placeUnit(grid, gs, x, y, id);
    // The landing dust is emitted by the Units component when the figure touches down.
    if (result.chestCollected && result.chestBonusType) {
      const [wx, wz] = cellToWorld(x, y);
      fx.emit({ type: 'burst', at: [wx, 0.3, wz], color: '#ffd76a', count: 70, speed: 1.6, lift: 3.6, life: 1.1 });
      fx.emit({ type: 'cue', name: 'chest' });
      showBanner(BONUS_LABEL[result.chestBonusType], '#f0d893', `${gs.players[id].displayName} opened a chest`);
    }
    set({ version: get().version + 1, placementsLeft: get().placementsLeft - 1 });
  };

  // ── Combat ───────────────────────────────────────────────────────────
  const enterAttackPhase = () => {
    const attackers = findAttackers(currentId());
    if (attackers.size === 0) {
      // Nothing left in reach: strike + expand still gets its roll, double strike ends.
      clearAttackUi();
      if (get().turnOption === 'B') startRoll();
      else endTurn();
      return;
    }
    const keys = new Set(attackers.keys());
    // With a single candidate, select it straight away to save a tap.
    const only = keys.size === 1 ? [...keys][0] : null;
    const targets = only ? attackers.get(only)! : NO_CELLS;
    set({
      phase: 'attacking',
      attackers: keys,
      selected: only,
      targets,
      tappable: new Set([...keys, ...targets]),
    });
  };

  const startCombat = (from: Cell, to: Cell) => {
    const { grid, gs } = get();
    const attackerId = currentId();
    const defenderCell = grid[to.y][to.x];
    const defenderId = defenderCell.ownerId!;
    const attacker = gs.players[attackerId];
    const defender = gs.players[defenderId];
    const isCastle = defenderCell.isCastle;

    const result = resolveCombatRolls(
      1 + Math.floor(Math.random() * 6),
      1 + Math.floor(Math.random() * 6),
      hasActiveBonus(attacker, 'attack'),
      hasActiveBonus(defender, 'defense'),
    );

    const atkShort = KINGDOMS[attacker.color].short;
    const defShort = KINGDOMS[defender.color].short;
    const atkColor = colorOf(attackerId);
    const defColor = colorOf(defenderId);
    const [ax, az] = cellToWorld(from.x, from.y);
    const [dx, dz] = cellToWorld(to.x, to.y);

    set({
      phase: 'combat',
      committed: true,
      combat: {
        attacker: { name: attacker.displayName, color: atkColor, roll: result.attackerRoll, bonus: result.attackBonus },
        defender: { name: defender.displayName, color: defColor, roll: result.defenderRoll, bonus: result.defenseBonus, isCastle },
        stage: 'rolling',
        isTie: result.isTie,
        outcome: '',
      },
    });
    clearAttackUi();
    fx.emit({ type: 'cue', name: 'rattle' });
    const dice = get().dice;
    set({
      dice: {
        ...dice,
        atk: { ...dice.atk, value: result.attackerRoll, rollId: dice.atk.rollId + 1, visible: true, color: atkColor, at: [ax, az] },
        def: { ...dice.def, value: result.defenderRoll, rollId: dice.def.rollId + 1, visible: true, color: defColor, at: [dx, dz] },
      },
    });

    // Beat 1: the dice have landed, the attacker lunges.
    later(COMBAT_ROLL_MS + COMBAT_STRIKE_MS, () => {
      fx.emit({ type: 'attack', from, to });

      // Beat 2: the blow lands and the board changes.
      later(LUNGE_IMPACT_MS, () => {
        const mid: [number, number, number] = [(ax + dx) / 2, 0.55, (az + dz) / 2];
        fx.emit({ type: 'clash', at: mid });
        fx.emit({ type: 'burst', at: mid, color: '#fff1b8', count: 26, speed: 2.4, lift: 2.2, life: 0.5 });
        fx.emit({ type: 'shake', strength: isCastle && result.attackerWins ? 0.9 : 0.55 });

        // Everything the losing kingdom owns disappears with its castle, so note it first.
        const doomed: Cell[] = [];
        if (isCastle && result.attackerWins && defender.castleHP === 1) {
          for (let y = 0; y < ROWS; y++)
            for (let x = 0; x < COLS; x++)
              if (grid[y][x].type === 'unit' && grid[y][x].ownerId === defenderId) doomed.push({ x, y });
        }

        const outcome = applyCombatResult(grid, gs, from, to, result.attackerWins, attackerId);
        let line: string;

        if (outcome.attackerDestroyed) {
          fx.emit({ type: 'unitDeath', x: from.x, y: from.y, color: atkColor, dx: ax - dx, dz: az - dz });
          if (!isCastle) fx.emit({ type: 'block', x: to.x, y: to.y });
          fx.emit({ type: 'text', at: [ax, 1.3, az], text: 'Repelled', color: '#ff8a7a' });
          line = result.isTie ? `A tie. ${defShort} holds.` : `${defShort} holds. The attacker is lost.`;
        } else if (outcome.unitCaptured) {
          fx.emit({ type: 'capture', x: to.x, y: to.y, fromColor: defColor });
          fx.emit({ type: 'burst', at: [dx, 0.4, dz], color: atkColor, count: 34, speed: 1.5, lift: 2.6, life: 0.7 });
          fx.emit({ type: 'text', at: [dx, 1.3, dz], text: 'Captured', color: '#fff1b8' });
          line = `${atkShort} captures the unit.`;
        } else {
          const [cx, cz] = cellToWorld(defender.castlePosition.x, defender.castlePosition.y);
          const centre: [number, number, number] = [cx + 0.5, 1.2, cz + 0.5];
          fx.emit({ type: 'burst', at: centre, color: '#e8dcc4', count: 60, speed: 2.6, lift: 3, life: 0.9 });
          fx.emit({ type: 'text', at: [centre[0], 3.6, centre[2]], text: '−1', color: '#ff6b5a' });
          if (outcome.eliminatedPlayer) {
            fx.emit({ type: 'castleFall', playerId: defenderId, x: defender.castlePosition.x, y: defender.castlePosition.y, color: defColor });
            fx.emit({ type: 'shake', strength: 1 });
            doomed.forEach((c, i) =>
              later(120 + i * 35, () =>
                fx.emit({ type: 'unitDeath', x: c.x, y: c.y, color: defColor, dx: Math.random() - 0.5, dz: Math.random() - 0.5 }),
              ),
            );
            line = `${defender.displayName} has fallen.`;
          } else {
            fx.emit({ type: 'castleHit', playerId: defenderId });
            line = `${defShort}'s castle is hit: ${outcome.newCastleHP} of 4 left.`;
          }
        }

        set({
          version: get().version + 1,
          attacksLeft: get().attacksLeft - 1,
          combat: { ...get().combat!, stage: result.attackerWins ? 'won' : 'lost', outcome: line },
        });

        later(COMBAT_AFTERMATH_MS, () => afterCombat(result.attackerWins, outcome.eliminatedPlayer));
      });
    });
  };

  const afterCombat = (attackerWon: boolean, eliminated?: string) => {
    const { gs } = get();
    const dice = get().dice;
    set({
      combat: null,
      dice: { ...dice, atk: { ...dice.atk, visible: false }, def: { ...dice.def, visible: false } },
    });

    const winner = checkVictory(gs.turnOrder);
    if (winner) {
      set({ phase: 'over', winner, version: get().version + 1 });
      fx.emit({ type: 'cue', name: winner === HUMAN_ID ? 'victory' : 'defeat' });
      return;
    }
    if (eliminated === HUMAN_ID) {
      showBanner('Your kingdom has fallen', colorOf(HUMAN_ID), 'The war goes on without you');
    }

    const id = currentId();
    const next = determineNextPhaseAfterCombat(
      attackerWon,
      get().turnOption ?? 'B',
      get().attacksLeft,
      findAttackers(id).size > 0,
    );
    if (next === 'placing') {
      set({ phase: 'waiting' });
      later(350, startRoll);
    } else if (next === 'attacking') {
      if (id === HUMAN_ID) enterAttackPhase();
      else {
        set({ phase: 'waiting' });
        later(500, aiAttack);
      }
    } else {
      set({ phase: 'waiting' });
      later(300, endTurn);
    }
  };

  // ── Computer kingdoms ────────────────────────────────────────────────
  const aiChoose = () => {
    const attackers = findAttackers(currentId());
    if (attackers.size === 0) {
      startRoll();
      return;
    }
    const { grid } = get();
    let pairs = 0;
    let castleInReach = false;
    for (const targets of attackers.values()) {
      pairs += targets.size;
      for (const t of targets) {
        const c = cellOf(t);
        if (grid[c.y][c.x].isCastle) castleInReach = true;
      }
    }
    // A castle in reach is always worth a swing; otherwise attack about half the time.
    const r = Math.random();
    let option: TurnOption = 'A';
    if (castleInReach) option = pairs >= 2 && r < 0.5 ? 'C' : 'B';
    else if (r < 0.45) option = 'B';
    else if (r < 0.6 && pairs >= 2) option = 'C';

    if (option === 'A') {
      startRoll();
      return;
    }
    set({ turnOption: option, attacksLeft: option === 'C' ? 2 : 1 });
    aiAttack();
  };

  const aiAttack = () => {
    const attackers = findAttackers(currentId());
    if (attackers.size === 0) {
      if (get().turnOption === 'B') startRoll();
      else endTurn();
      return;
    }
    const { grid, gs } = get();
    let best: { from: Cell; to: Cell } | null = null;
    let bestScore = -Infinity;
    for (const [from, targets] of attackers) {
      for (const t of targets) {
        const to = cellOf(t);
        const cell = grid[to.y][to.x];
        let score = Math.random() * 2;
        if (cell.isCastle) score += 10 + (4 - gs.players[cell.ownerId!].castleHP) * 2;
        else score += 3;
        if (score > bestScore) {
          bestScore = score;
          best = { from: cellOf(from), to };
        }
      }
    }
    if (best) startCombat(best.from, best.to);
  };

  /** Pick the most useful cell for a computer-controlled kingdom. */
  const chooseAiCell = (valid: Set<string>): Cell => {
    const { grid, gs, terrain } = get();
    const chests = gs.chests.filter((c) => !c.isCollected);
    let best: Cell = { x: 0, y: 0 };
    let bestScore = -Infinity;
    for (const key of valid) {
      const { x, y } = cellOf(key);
      let score = Math.random() * 2.5;
      if (grid[y][x].type === 'chest') score += 100;
      if (terrain[y][x] === 'bridge') score += 4;
      const toCentre = Math.abs(x - (COLS - 1) / 2) + Math.abs(y - (ROWS - 1) / 2);
      score -= toCentre * 0.35;
      if (chests.length) {
        const d = Math.min(...chests.map((c) => Math.abs(c.x - x) + Math.abs(c.y - y)));
        score -= d * 0.6;
      }
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
    return best;
  };

  const aiPlace = () => {
    if (get().placementsLeft <= 0) {
      later(500, endTurn);
      return;
    }
    const valid = calculateValidPlacements(get().grid, currentId(), COLS, ROWS);
    if (valid.size === 0) {
      later(400, endTurn);
      return;
    }
    const { x, y } = chooseAiCell(valid);
    doPlace(x, y);
    later(300, aiPlace);
  };

  const initial = buildMatch();
  let started = false;

  const freshTurnState = {
    phase: 'waiting' as Phase,
    turnColor: KINGDOMS.blue.color,
    placementsLeft: 0,
    placementsTotal: 0,
    valid: NO_CELLS,
    turnOption: null,
    attacksLeft: 0,
    committed: false,
    attackers: NO_CELLS,
    selected: null,
    targets: NO_CELLS,
    tappable: NO_CELLS,
    combat: null,
    winner: null,
    hover: null,
    banner: null,
  };

  return {
    ...initial,
    version: 0,
    dice: initialDice(),
    ...freshTurnState,

    roll: () => {
      if (get().phase !== 'ready' || !isHuman()) return;
      startRoll();
    },

    chooseOption: (option) => {
      if (get().phase !== 'choosing' || !isHuman()) return;
      if (option === 'A') {
        set({ turnOption: 'A' });
        startRoll();
        return;
      }
      set({ turnOption: option, attacksLeft: option === 'C' ? 2 : 1 });
      enterAttackPhase();
    },

    cancelAttack: () => {
      const s = get();
      if (s.phase !== 'attacking' || s.committed) return;
      clearAttackUi();
      set({ phase: 'choosing', turnOption: null, attacksLeft: 0 });
    },

    tapCell: (x, y) => {
      const s = get();
      const key = `${x},${y}`;

      if (s.phase === 'placing') {
        if (!s.valid.has(key)) return;
        doPlace(x, y);
        if (get().placementsLeft <= 0) {
          set({ phase: 'waiting', valid: NO_CELLS, tappable: NO_CELLS });
          later(650, endTurn);
          return;
        }
        if (refreshValid().size === 0) {
          set({ phase: 'waiting' });
          later(650, endTurn);
        }
        return;
      }

      if (s.phase === 'attacking') {
        if (s.selected && s.targets.has(key)) {
          startCombat(cellOf(s.selected), { x, y });
          return;
        }
        if (s.attackers.has(key)) {
          const targets = findAttackers(currentId()).get(key) ?? NO_CELLS;
          set({ selected: key, targets, tappable: new Set([...s.attackers, ...targets]) });
          fx.emit({ type: 'cue', name: 'select' });
        }
      }
    },

    setHover: (key) => {
      if (get().hover !== key) set({ hover: key });
    },

    start: () => {
      if (started) return;
      started = true;
      later(350, beginTurn);
    },

    restart: () => {
      generation++;
      const dice = initialDice();
      // Keep the throw counters, so the dice do not replay an old roll.
      (Object.keys(dice) as DieId[]).forEach((id) => (dice[id].rollId = get().dice[id].rollId));
      set({ ...buildMatch(), version: get().version + 1, dice, ...freshTurnState });
      later(500, beginTurn);
    },
  };
});

// Development aid: inspect or nudge the match from the browser console.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __game: unknown }).__game = useGame;
}

export function currentPlayer(gs: GameState) {
  return gs.players[gs.turnOrder[gs.currentPlayerIndex]];
}
