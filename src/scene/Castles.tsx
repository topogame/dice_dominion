import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { PlayerColor } from '../types/GameTypes';
import { fx, useGame } from '../state/game';
import { KINGDOMS, cellToWorld } from '../theme';
import { CUSTOM_CASTLES, castleSeat, type CustomCastle } from './customModels';
import { modelUrl, useSceneryModel } from './models';
import { paintedMaterial } from './painted';
import { VIEW_YAW, useView, type View } from './view';

const gemOff = new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.6 });
const gemGeo = new THREE.OctahedronGeometry(0.11, 0);

/**
 * The stock castle stands about 4 units tall on a 2x2.3 base; scaled down
 * slightly it sits inside its 2x2 plot.
 */
const CASTLE_SCALE = 0.9;
/** Height at which the hit-point gems float over the stock castle. */
const GEM_HEIGHT = 3.95;

const HIT_TIME = 0.55;
const FALL_TIME = 1.7;

interface CastleProps {
  playerId: string;
  team: PlayerColor;
  x: number;
  y: number;
  color: string;
  hp: number;
  view: View;
  /** Set once the castle has been destroyed and is sinking into the ground. */
  falling?: boolean;
}

interface ShellProps extends CastleProps {
  /** Height of the floating hit-point gems above the ground. */
  gemHeight: number;
  /** Shift of the whole castle from the centre of its plot, in world units. */
  offset?: [number, number];
  /** Turn of the building about the vertical axis. */
  turn: number;
  children: ReactNode;
}

/** Everything the castles share: the hit-point gems, the rattle when hit, the collapse. */
function CastleShell({ playerId, x, y, color, hp, view, falling = false, gemHeight, offset = [0, 0], turn, children }: ShellProps) {
  const body = useRef<THREE.Group>(null!);
  /** Clock times of the last hit and of the collapse; -1 until the first frame stamps them. */
  const hitAt = useRef(-10);
  const hitPending = useRef(false);
  const fallAt = useRef(-1);

  useEffect(
    () =>
      fx.on((e) => {
        if (e.type === 'castleHit' && e.playerId === playerId) hitPending.current = true;
      }),
    [playerId],
  );

  const gems = useRef<THREE.Group>(null!);

  const gemOn = useMemo(() => {
    const c = new THREE.Color(color);
    return new THREE.MeshStandardMaterial({
      color: c,
      emissive: c,
      emissiveIntensity: 2.4,
      roughness: 0.2,
      toneMapped: false,
    });
  }, [color]);

  const [wx, wz] = cellToWorld(x, y);
  const phase = x * 1.7 + y * 0.9;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    gems.current.position.y = gemHeight + Math.sin(t * 1.6 + phase) * 0.06;

    if (hitPending.current) {
      hitPending.current = false;
      hitAt.current = t;
    }
    // A hit rattles the walls; a destroyed castle tilts and sinks out of sight.
    const rattle = Math.max(0, 1 - (t - hitAt.current) / HIT_TIME);
    let sink = 0;
    if (falling) {
      if (fallAt.current < 0) fallAt.current = t;
      sink = Math.min(1, (t - fallAt.current) / FALL_TIME);
    }
    const shake = rattle * rattle * 0.07 + (falling ? (1 - sink) * 0.05 : 0);
    body.current.position.set(Math.sin(t * 71) * shake, -sink * sink * (gemHeight - 0.7), Math.cos(t * 59) * shake);
    body.current.rotation.set(sink * 0.16, 0, Math.sin(t * 83) * shake * 0.6 + sink * 0.22);
    body.current.scale.setScalar(1 - sink * 0.25);
    gems.current.children.forEach((g, i) => {
      g.rotation.y = t * 1.4 + i;
    });
  });

  return (
    <group position={[wx + 0.5 + offset[0], 0, wz + 0.5 + offset[1]]}>
      <group ref={body}>
        <group rotation-y={turn}>{children}</group>
        <group ref={gems} position={[0, gemHeight, 0]} rotation-y={VIEW_YAW[view]}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} geometry={gemGeo} material={i < hp ? gemOn : gemOff} position={[(i - 1.5) * 0.3, 0, 0]} />
          ))}
        </group>
      </group>
    </group>
  );
}

/** The stock low-poly castle, one per kingdom colour. */
function StockCastle(props: CastleProps) {
  const model = useSceneryModel(`building_castle_${props.team}`);
  return (
    <CastleShell {...props} gemHeight={GEM_HEIGHT} turn={VIEW_YAW[props.view]}>
      <mesh geometry={model.geometry} material={model.material} scale={CASTLE_SCALE} castShadow receiveShadow />
    </CastleShell>
  );
}

/** A castle model made for one kingdom, fitted to its corner of the board. */
function CustomCastleView({ spec, ...props }: CastleProps & { spec: CustomCastle }) {
  const gltf = useGLTF(modelUrl(`custom/${spec.file}`));
  const light = useRef<THREE.PointLight>(null!);

  const { holder, height } = useMemo(() => {
    const root = gltf.scene.clone(true);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.material = paintedMaterial(mesh.material as THREE.MeshStandardMaterial, spec.glow, {
        from: spec.paintedFor,
        to: props.team,
      });
    });
    // Stand the model on the ground, centred, at the requested footprint.
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const scale = spec.size / Math.max(size.x, size.z);
    root.position.set(-centre.x, -box.min.y, -centre.z);
    const holder = new THREE.Group();
    holder.add(root);
    holder.scale.setScalar(scale);
    holder.rotation.y = spec.yaw;
    return { holder, height: size.y * scale };
  }, [gltf, spec, props.team]);

  const [wx, wz] = cellToWorld(props.x, props.y);
  const cx = wx + 0.5;
  const cz = wz + 0.5;
  // A phone held upright has no room beside the board, so there the castle is smaller.
  const portrait = props.view === 'portrait';
  // The building stands across its corner of the board, over three tiles of its
  // plot and the island's headland behind them, facing the fourth.
  const seat = useMemo(() => castleSeat(spec, portrait, Math.sign(cx), Math.sign(cz)), [spec, portrait, cx, cz]);
  const fit = seat.scale;
  const offset: [number, number] = [seat.x - cx, seat.z - cz];
  const turn = seat.turn;

  useFrame((state) => {
    // Torchlight never sits still.
    const t = state.clock.elapsedTime;
    light.current.intensity = 2.6 + Math.sin(t * 9 + cx) * 0.3 + Math.sin(t * 23 + cz) * 0.2;
  });

  return (
    <>
      <CastleShell {...props} gemHeight={height * fit + 0.45} offset={offset} turn={turn}>
        <group scale={fit}>
          <primitive object={holder} />
        </group>
        <pointLight ref={light} color="#ffae5c" distance={6.5} decay={1.6} position={[0, 0.8, spec.size * 0.55]} />
      </CastleShell>
    </>
  );
}

function Castle(props: CastleProps) {
  const spec = CUSTOM_CASTLES[props.team];
  return spec ? <CustomCastleView {...props} spec={spec} /> : <StockCastle {...props} />;
}

interface Fallen {
  playerId: string;
  team: PlayerColor;
  x: number;
  y: number;
  color: string;
}

export function Castles() {
  const gs = useGame((s) => s.gs);
  useGame((s) => s.version);
  const view = useView();

  // A destroyed castle leaves the game state at once, so its collapse is played from a local copy.
  const [fallen, setFallen] = useState<Fallen[]>([]);
  useEffect(
    () =>
      fx.on((e) => {
        if (e.type !== 'castleFall') return;
        const team = useGame.getState().gs.players[e.playerId].color;
        const entry: Fallen = { playerId: e.playerId, team, x: e.x, y: e.y, color: e.color };
        setFallen((list) => [...list, entry]);
        setTimeout(() => setFallen((list) => list.filter((f) => f !== entry)), FALL_TIME * 1000 + 100);
      }),
    [],
  );

  return (
    <>
      {fallen.map((f) => (
        <Castle key={`fallen-${f.playerId}`} playerId={f.playerId} team={f.team} x={f.x} y={f.y} color={f.color} hp={0} view={view} falling />
      ))}
      {Object.values(gs.players)
        .filter((p) => p.isAlive)
        .map((p) => (
          <Castle
            key={p.id}
            playerId={p.id}
            team={p.color}
            x={p.castlePosition.x}
            y={p.castlePosition.y}
            color={KINGDOMS[p.color].color}
            hp={p.castleHP}
            view={view}
          />
        ))}
    </>
  );
}
