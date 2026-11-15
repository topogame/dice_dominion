import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { PlayerColor } from '../types/GameTypes';
import { LUNGE_IMPACT_MS, fx, useGame } from '../state/game';
import { COLS, KINGDOMS, ROWS, cellToWorld } from '../theme';
import { CUSTOM_SQUAD, type CustomSquad } from './customModels';
import { KNIGHT_SCALE, TEAMS, useKnight } from './knight';
import { modelUrl } from './models';
import { paintedMaterial } from './painted';
import { VIEW_YAW, useView } from './view';

/** Room for every tile plus the soldiers that are still playing their death animation. */
const MAX_GHOSTS = 96;
const MAX = COLS * ROWS + MAX_GHOSTS;

/** Seconds from spawn until the figure touches the ground. */
const DROP_TIME = 0.34;
const DROP_HEIGHT = 2.6;
/** Figures are drawn larger than life so they read clearly from the strategy camera. */
const FIGURE_SCALE = 1.3;
/** Height of the disc the figure stands on. */
const BASE_TOP = 0.06;

/** Matches the length of the sword-swing clips. */
const LUNGE_TIME = 1.05;
/** Fraction of the lunge at which the blow lands. */
const LUNGE_IMPACT = LUNGE_IMPACT_MS / 1000 / LUNGE_TIME;
const LUNGE_REACH = 0.46;
const CAPTURE_TIME = 0.7;
const BLOCK_TIME = 0.4;
const DEATH_TIME = 0.75;

// Each soldier stands on a disc in its kingdom's colour, like a tabletop
// miniature, so its side reads at a glance even from far away.
const baseGeometry = new THREE.CylinderGeometry(0.3, 0.34, 0.07, 24).translate(0, 0.035, 0);
const baseMaterial = new THREE.MeshStandardMaterial({ roughness: 0.75 });
/** Places the knight model on the disc at miniature size. */
const knightLocal = new THREE.Matrix4().compose(
  new THREE.Vector3(0, BASE_TOP, 0),
  new THREE.Quaternion(),
  new THREE.Vector3(KNIGHT_SCALE, KNIGHT_SCALE, KNIGHT_SCALE),
);

interface UnitInfo {
  key: string;
  x: number;
  y: number;
  team: PlayerColor;
  seed: number;
}

/** A one-off move played on top of a soldier's idle stance. */
type Action =
  | { kind: 'lunge'; t0: number; dx: number; dz: number }
  | { kind: 'capture'; t0: number }
  | { kind: 'block'; t0: number };

/** A soldier that has left the board but is still being knocked away. */
interface Ghost {
  wx: number;
  wz: number;
  team: PlayerColor;
  dx: number;
  dz: number;
  yaw: number;
  t0: number;
}

// ── Animated stand-ins ─────────────────────────────────────────────────
// The army is drawn as frozen instances. While a soldier fights, a fully
// rigged copy takes its place and plays the real sword, shield and death clips.
const ACTORS = 3;
const SWINGS = ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal'];
const DIE_TIME = 1.0;

type Role = 'attack' | 'guard' | 'recoil' | 'cheer' | 'die';

interface Actor {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  clips: Map<string, THREE.AnimationAction>;
  /** Cell this actor stands in for, or null when it is free. */
  key: string | null;
  role: Role;
  t0: number;
  until: number;
  /** Facing for roles that do not take it from the lunge. */
  yaw: number;
  dx: number;
  dz: number;
  origin: THREE.Vector3;
}

const unitMatrix = new THREE.Matrix4();
const partMatrix = new THREE.Matrix4();
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scl = new THREE.Vector3();
const euler = new THREE.Euler();
const tint = new THREE.Color();
const baseTint = new THREE.Color();
const black = new THREE.Color('#000000');

/** Smoothly eases 0 → 1. */
const smooth = (k: number) => k * k * (3 - 2 * k);

/** Kingdom colour names by their hex value, to map effect events back to a team. */
const TEAM_BY_COLOR = new Map(TEAMS.map((team) => [KINGDOMS[team].color, team]));

type Knight = ReturnType<typeof useKnight>;

/** What stands on a tile: one shape, in each kingdom's colours. */
interface Figure {
  geometry: THREE.BufferGeometry;
  materials: Record<PlayerColor, THREE.Material>;
  /** Places the shape on its tile at the right size. */
  local: THREE.Matrix4;
  /** Whether the figure stands on a disc in its kingdom's colour. */
  onDisc: boolean;
}

/** The stock army: knights, with rigged stand-ins that fight. */
function KnightArmy() {
  const knight = useKnight();
  const figure = useMemo<Figure>(
    () => ({ geometry: knight.idle, materials: knight.materials, local: knightLocal, onDisc: true }),
    [knight],
  );
  return <Army figure={figure} knight={knight} />;
}

/** An army of generated squad pieces: miniatures that lunge and tumble, but do not swing a sword. */
function SquadArmy({ spec }: { spec: CustomSquad }) {
  const gltf = useGLTF(modelUrl(`custom/${spec.file}`));
  const figure = useMemo<Figure>(() => {
    gltf.scene.updateMatrixWorld(true);
    let mesh: THREE.Mesh | undefined;
    gltf.scene.traverse((o) => {
      if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
    });
    if (!mesh) throw new Error(`Squad model ${spec.file} has no mesh`);
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    // Stand it on the ground, centred, at the requested size (the army is drawn larger than life).
    geometry.translate(-centre.x, -box.min.y, -centre.z);
    const scale = spec.size / Math.max(size.x, size.z) / FIGURE_SCALE;
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spec.yaw),
      new THREE.Vector3(scale, scale, scale),
    );
    const source = mesh.material as THREE.MeshStandardMaterial;
    const materials = Object.fromEntries(
      TEAMS.map((team) => [team, paintedMaterial(source, 0, { from: spec.paintedFor, to: team })]),
    ) as unknown as Record<PlayerColor, THREE.Material>;
    return { geometry, materials, local, onDisc: false };
  }, [gltf, spec]);
  return <Army figure={figure} />;
}

export function Units() {
  return CUSTOM_SQUAD ? <SquadArmy spec={CUSTOM_SQUAD} /> : <KnightArmy />;
}

function Army({ figure, knight }: { figure: Figure; knight?: Knight }) {
  const grid = useGame((s) => s.grid);
  const gs = useGame((s) => s.gs);
  const version = useGame((s) => s.version);

  const viewYaw = VIEW_YAW[useView()];
  const figures = useRef<Partial<Record<PlayerColor, THREE.InstancedMesh | null>>>({});
  const bases = useRef<THREE.InstancedMesh>(null!);
  /** Spawn time per cell, so each figure plays its own drop animation. */
  const born = useRef(new Map<string, number>());
  const landed = useRef(new Set<string>());
  const actions = useRef(new Map<string, Action>());
  const ghosts = useRef<Ghost[]>([]);
  const clock = useRef(0);

  const actors = useMemo<Actor[]>(
    () =>
      Array.from({ length: knight ? ACTORS : 0 }, () => {
        const root = knight!.spawn();
        root.visible = false;
        const mixer = new THREE.AnimationMixer(root);
        const clips = new Map<string, THREE.AnimationAction>();
        for (const [name, clip] of knight!.clips) {
          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
          clips.set(name, action);
        }
        return { root, mixer, clips, key: null, role: 'attack', t0: 0, until: 0, yaw: 0, dx: 0, dz: 0, origin: new THREE.Vector3() };
      }),
    [knight],
  );

  const units = useMemo(() => {
    const list: UnitInfo[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = grid[y][x];
        if (cell.type !== 'unit' || !cell.ownerId) continue;
        const player = gs.players[cell.ownerId];
        if (!player) continue;
        const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        list.push({ key: `${x},${y}`, x, y, team: player.color, seed: s - Math.floor(s) });
      }
    }
    return list;
    // `version` is what actually changes when the grid is mutated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, gs, version]);

  useEffect(() => {
    const actorAt = (key: string) => actors.find((a) => a.key === key);
    const teamAt = (x: number, y: number): PlayerColor | undefined => {
      const s = useGame.getState();
      const owner = s.grid[y][x].ownerId;
      return owner ? s.gs.players[owner]?.color : undefined;
    };
    const play = (actor: Actor, clip: string) => {
      actor.mixer.stopAllAction();
      actor.clips.get(clip)?.reset().play();
    };
    /** Hands a free actor (or the one closest to finishing) the given cell. */
    const cast = (key: string, team: PlayerColor, role: Role, clip: string, until: number) => {
      if (!knight) return undefined;
      const actor = actors.find((a) => a.key === null) ?? [...actors].sort((a, b) => a.until - b.until)[0];
      actor.key = key;
      actor.role = role;
      actor.t0 = clock.current;
      actor.until = until;
      knight.dress(actor.root, team);
      actor.root.visible = true;
      play(actor, clip);
      return actor;
    };

    return fx.on((e) => {
      const t = clock.current;
      if (e.type === 'attack') {
        const len = Math.hypot(e.to.x - e.from.x, e.to.y - e.from.y) || 1;
        const dx = (e.to.x - e.from.x) / len;
        const dz = (e.to.y - e.from.y) / len;
        const fromKey = `${e.from.x},${e.from.y}`;
        actions.current.set(fromKey, { kind: 'lunge', t0: t, dx, dz });

        const attacker = teamAt(e.from.x, e.from.y);
        if (attacker) cast(fromKey, attacker, 'attack', SWINGS[Math.floor(Math.random() * SWINGS.length)], t + LUNGE_TIME);

        // A soldier under attack raises its shield towards the attacker.
        const target = useGame.getState().grid[e.to.y][e.to.x];
        const defender = teamAt(e.to.x, e.to.y);
        if (target.type === 'unit' && defender) {
          const guard = cast(`${e.to.x},${e.to.y}`, defender, 'guard', 'Block', t + 3);
          if (guard) guard.yaw = Math.atan2(-dx, -dz);
        }
      } else if (e.type === 'capture') {
        const key = `${e.x},${e.y}`;
        actions.current.set(key, { kind: 'capture', t0: t });
        const actor = actorAt(key);
        const team = teamAt(e.x, e.y);
        if (actor && team) {
          // Beaten, it changes colours and salutes its new kingdom.
          knight?.dress(actor.root, team);
          actor.role = 'cheer';
          actor.until = t + 1.5;
          play(actor, 'Cheer');
        }
      } else if (e.type === 'block') {
        const key = `${e.x},${e.y}`;
        actions.current.set(key, { kind: 'block', t0: t });
        const actor = actorAt(key);
        if (actor) {
          actor.role = 'recoil';
          actor.until = t + 0.9;
          play(actor, 'Block_Hit');
        }
      } else if (e.type === 'unitDeath') {
        const len = Math.hypot(e.dx, e.dz) || 1;
        const actor = actorAt(`${e.x},${e.y}`);
        if (actor) {
          // The attacker was beaten back: it falls where it stands.
          actor.role = 'die';
          actor.t0 = t;
          actor.until = t + DIE_TIME;
          actor.dx = e.dx / len;
          actor.dz = e.dz / len;
          actor.origin.copy(actor.root.position);
          actor.yaw = actor.root.rotation.y;
          play(actor, 'Death_A');
          return;
        }
        const [wx, wz] = cellToWorld(e.x, e.y);
        if (ghosts.current.length >= MAX_GHOSTS) ghosts.current.shift();
        ghosts.current.push({
          wx,
          wz,
          team: TEAM_BY_COLOR.get(e.color) ?? 'blue',
          dx: e.dx / len,
          dz: e.dz / len,
          yaw: Math.random() * Math.PI * 2,
          t0: t,
        });
      }
    });
  }, [actors, knight]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    clock.current = t;
    const alive = new Set<string>();
    const counts: Record<PlayerColor, number> = { blue: 0, yellow: 0, green: 0, red: 0 };
    let total = 0;

    /** Writes the figure whose transform is in `unitMatrix`. `flash` brightens it towards white. */
    const write = (team: PlayerColor, flash: number, drawn: boolean) => {
      const mesh = figures.current[team];
      if (drawn && mesh) {
        partMatrix.multiplyMatrices(unitMatrix, figure.local);
        mesh.setMatrixAt(counts[team], partMatrix);
        // Instance colours multiply the texture, so values above 1 act as a flash.
        mesh.setColorAt(counts[team], tint.setScalar(1 + flash * 2.5));
        counts[team]++;
      }
      if (!figure.onDisc) return;
      bases.current.setMatrixAt(total, unitMatrix);
      bases.current.setColorAt(total, baseTint.set(KINGDOMS[team].color).lerp(black, 0.3));
      total++;
    };

    for (const u of units) {
      alive.add(u.key);
      let t0 = born.current.get(u.key);
      if (t0 === undefined) {
        t0 = t;
        born.current.set(u.key, t0);
      }
      const age = t - t0;
      const [wx, wz] = cellToWorld(u.x, u.y);
      const actor = actors.find((a) => a.key === u.key && a.role !== 'die');

      let ox = 0;
      let oy = 0;
      let oz = 0;
      let sy = 1;
      let sxz = 1;
      let yaw = viewYaw + (u.seed - 0.5) * 0.7 + Math.sin(t * 1.1 + u.seed * 9) * 0.06;
      let pitch = 0;
      let flash = 0;

      if (age < DROP_TIME) {
        const k = age / DROP_TIME;
        oy = DROP_HEIGHT * (1 - k * k);
        sy = 1.12;
        sxz = 0.92;
      } else {
        if (!landed.current.has(u.key)) {
          landed.current.add(u.key);
          fx.emit({ type: 'land', x: u.x, y: u.y, color: KINGDOMS[u.team].color });
        }
        // Squash on impact, then settle like a damped spring.
        const s = age - DROP_TIME;
        const wobble = Math.exp(-s * 8) * Math.cos(s * 24);
        sy = 1 - 0.3 * wobble;
        sxz = 1 + 0.18 * wobble;
        // A slow breath keeps the standing army from looking frozen.
        sy *= 1 + Math.sin(t * 2.1 + u.seed * 6.28) * 0.012;
      }

      const action = actions.current.get(u.key);
      if (action) {
        const a = t - action.t0;
        if (action.kind === 'lunge') {
          const k = a / LUNGE_TIME;
          if (k >= 1) actions.current.delete(u.key);
          else {
            // Step back, close in for the swing, then return to the tile.
            let reach: number;
            if (k < LUNGE_IMPACT * 0.45) reach = -0.12 * smooth(k / (LUNGE_IMPACT * 0.45));
            else if (k < LUNGE_IMPACT) {
              const u2 = (k - LUNGE_IMPACT * 0.45) / (LUNGE_IMPACT * 0.55);
              reach = -0.12 + (LUNGE_REACH + 0.12) * u2 * u2;
            } else reach = LUNGE_REACH * (1 - smooth((k - LUNGE_IMPACT) / (1 - LUNGE_IMPACT)));
            ox = action.dx * reach;
            oz = action.dz * reach;
            yaw = Math.atan2(action.dx, action.dz);
            // The frozen stand-in leans into the blow; the rigged one swings its sword instead.
            if (!actor) pitch = reach * 0.7;
          }
        } else if (action.kind === 'capture') {
          const k = a / CAPTURE_TIME;
          if (k >= 1) actions.current.delete(u.key);
          else {
            flash = Math.max(0, 1 - k * 3);
            if (!actor) {
              // Tossed up, it spins once and lands in its new colours.
              oy += Math.sin(k * Math.PI) * 0.55;
              yaw += k * Math.PI * 2;
              const pulse = 1 + Math.sin(k * Math.PI) * 0.18;
              sy *= pulse;
              sxz *= pulse;
            }
          }
        } else {
          const k = a / BLOCK_TIME;
          if (k >= 1) actions.current.delete(u.key);
          else if (!actor) {
            // Brace behind the shield and bounce back up.
            const brace = Math.sin(k * Math.PI);
            sy *= 1 - 0.2 * brace;
            sxz *= 1 + 0.14 * brace;
          }
        }
      }

      if (actor && (actor.role === 'guard' || actor.role === 'recoil')) yaw = actor.yaw;

      euler.set(pitch, yaw, 0, 'YXZ');
      pos.set(wx + ox, oy, wz + oz);
      quat.setFromEuler(euler);
      scl.set(sxz * FIGURE_SCALE, sy * FIGURE_SCALE, sxz * FIGURE_SCALE);
      unitMatrix.compose(pos, quat, scl);
      write(u.team, flash, !actor);

      if (actor) {
        actor.root.position.set(pos.x, pos.y + BASE_TOP * FIGURE_SCALE, pos.z);
        actor.root.rotation.set(0, yaw, 0);
        actor.root.scale.setScalar(KNIGHT_SCALE * FIGURE_SCALE);
      }
    }

    for (const actor of actors) {
      if (actor.key === null) continue;
      actor.mixer.update(delta);
      if (actor.role === 'die') {
        // Staggers back from the blow, falls, and sinks away.
        const k = Math.min(1, (t - actor.t0) / DIE_TIME);
        const slide = 1 - (1 - k) * (1 - k);
        actor.root.position.set(
          actor.origin.x + actor.dx * slide * 0.45,
          actor.origin.y - smooth(Math.max(0, (k - 0.72) / 0.28)) * 0.5,
          actor.origin.z + actor.dz * slide * 0.45,
        );
        actor.root.rotation.set(0, actor.yaw, 0);
      }
      if (t > actor.until) {
        actor.key = null;
        actor.root.visible = false;
      }
    }

    // Soldiers swept away with a fallen castle: tumbling and shrinking.
    ghosts.current = ghosts.current.filter((g) => t - g.t0 < DEATH_TIME);
    for (const g of ghosts.current) {
      const k = (t - g.t0) / DEATH_TIME;
      const fly = 1 - (1 - k) * (1 - k);
      euler.set(k * 5.5, g.yaw + k * 3, k * 2.2, 'YXZ');
      pos.set(g.wx + g.dx * fly * 1.1, Math.sin(k * Math.PI) * 0.9, g.wz + g.dz * fly * 1.1);
      quat.setFromEuler(euler);
      const s = FIGURE_SCALE * (1 - k * k);
      scl.set(s, s, s);
      unitMatrix.compose(pos, quat, scl);
      write(g.team, Math.max(0, 1 - k * 5), true);
    }

    for (const team of TEAMS) {
      const mesh = figures.current[team];
      if (!mesh) continue;
      mesh.count = counts[team];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    bases.current.count = total;
    bases.current.instanceMatrix.needsUpdate = true;
    if (bases.current.instanceColor) bases.current.instanceColor.needsUpdate = true;

    for (const key of born.current.keys()) {
      if (!alive.has(key)) {
        born.current.delete(key);
        landed.current.delete(key);
        actions.current.delete(key);
      }
    }
  });

  return (
    <>
      {/* One instanced mesh per kingdom: the whole army shares a frozen idle stance. */}
      {TEAMS.map((team) => (
        <instancedMesh
          key={team}
          ref={(m) => {
            figures.current[team] = m;
          }}
          args={[figure.geometry, figure.materials[team], MAX]}
          count={0}
          castShadow
          receiveShadow
          frustumCulled={false}
        />
      ))}
      <instancedMesh
        ref={bases}
        args={[baseGeometry, baseMaterial, MAX]}
        count={0}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      {actors.map((actor, i) => (
        <primitive key={i} object={actor.root} />
      ))}
    </>
  );
}
