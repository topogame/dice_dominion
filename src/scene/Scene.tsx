import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MapControls, Sparkles } from '@react-three/drei';
import {
  Bloom,
  BrightnessContrast,
  EffectComposer,
  HueSaturation,
  TiltShift2,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import type { MapControls as MapControlsImpl } from 'three-stdlib';
import { Bridges, Highlights, Island, Territory, TilePicker } from './Board';
import { Water } from './Water';
import { Castles } from './Castles';
import { Units } from './Units';
import { Dice } from './Dice';
import { Chests, Effects, Shaker } from './Fx';
import { Decor } from './Decor';
import { Sky } from './Sky';
import { MAP_TYPE, POST_FX } from '../config';
import { useGame } from '../state/game';
import { cellToWorld } from '../theme';
import { MAX_DISTANCE, MIN_DISTANCE, SPAN, overviewFraming, type Pose } from './framing';
import { COARSE_POINTER, useView } from './view';


/** On touch screens a tile should be at least this many CSS pixels wide while placing. */
const COMFORT_TILE_PX = 46;

function CameraRig() {
  const controls = useRef<MapControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const get = useThree((s) => s.get);
  const view = useView();

  /** Unit vector from the focus point to the camera; fixed for a view because rotation is off. */
  const dir = useRef(new THREE.Vector3(0, 1, 0));
  const pitch = useRef(0);
  const overview = useRef<Pose>({ target: new THREE.Vector3(), distance: 30 });
  const tween = useRef<{ from: Pose; to: Pose; t0: number } | null>(null);

  const applyPose = (target: THREE.Vector3, distance: number) => {
    camera.position.copy(target).addScaledVector(dir.current, distance);
    camera.lookAt(target);
    controls.current?.target.copy(target);
    controls.current?.update();
  };

  // Frame the whole board. Runs on mount and when the screen flips between
  // wide and tall; in between, the camera belongs to the player.
  useLayoutEffect(() => {
    const { size } = get();
    const framing = overviewFraming(view, size.width / size.height);
    dir.current.copy(framing.dir);
    pitch.current = framing.pitch;
    overview.current = { target: framing.target, distance: framing.distance };
    tween.current = null;
    applyPose(framing.target, framing.distance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, get, view]);

  // Touch screens: when the player has tiles to pick (placing units, or choosing
  // an attacker and target), move in so they are finger-sized, and pull back
  // out when the turn is over.
  useEffect(() => {
    if (!COARSE_POINTER) return;
    const c = controls.current;
    const cancel = () => {
      tween.current = null;
    };
    c?.addEventListener('start', cancel);

    const current = (): Pose => ({
      target: c ? c.target.clone() : overview.current.target.clone(),
      distance: c ? camera.position.distanceTo(c.target) : overview.current.distance,
    });

    /** True while the camera sits where this effect put it, not where the player did. */
    let movedIn = false;

    const unsubscribe = useGame.subscribe((state, prev) => {
      if (state.phase === prev.phase) return;
      // A fight is watched from wherever the attack was chosen.
      if (state.phase === 'combat') return;

      const choosing = state.phase === 'placing' || state.phase === 'attacking';
      if (!choosing) {
        if (movedIn) tween.current = { from: current(), to: overview.current, t0: performance.now() };
        movedIn = false;
        return;
      }

      // Bounding box of the tiles the player can act on, in world units.
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const key of state.tappable) {
        const [x, y] = key.split(',').map(Number);
        const [wx, wz] = cellToWorld(x, y);
        minX = Math.min(minX, wx); maxX = Math.max(maxX, wx);
        minZ = Math.min(minZ, wz); maxZ = Math.max(maxZ, wz);
      }
      if (minX === Infinity) return;

      const { size } = get();
      const aspect = size.width / size.height;
      const portrait = view === 'portrait';
      const boxAcross = portrait ? maxZ - minZ : maxX - minX;
      const boxUp = portrait ? maxX - minX : maxZ - minZ;

      // As close as it takes to show every legal tile, never closer than the
      // comfortable tile size and never further than the overview.
      const comfort = size.width / COMFORT_TILE_PX / (SPAN * aspect);
      const fit = Math.max((boxAcross + 3) / (SPAN * aspect), ((boxUp + 6) * Math.sin(pitch.current)) / SPAN);
      const distance = Math.min(overview.current.distance, Math.max(comfort, fit));

      // Aim a little towards the camera so the tiles clear the bottom HUD.
      const target = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
      target.x += dir.current.x * 1.2;
      target.z += dir.current.z * 1.2;
      tween.current = { from: current(), to: { target, distance }, t0: performance.now() };
      movedIn = true;
    });

    return () => {
      c?.removeEventListener('start', cancel);
      unsubscribe();
    };
  }, [camera, get, view]);

  useFrame(() => {
    const c = controls.current;
    if (!c) return;

    const tw = tween.current;
    if (tw) {
      const k = Math.min(1, (performance.now() - tw.t0) / 650);
      const e = k * k * (3 - 2 * k);
      const target = new THREE.Vector3().lerpVectors(tw.from.target, tw.to.target, e);
      applyPose(target, THREE.MathUtils.lerp(tw.from.distance, tw.to.distance, e));
      if (k >= 1) tween.current = null;
    }

    // Keep the focus point over the island.
    const x = THREE.MathUtils.clamp(c.target.x, -12, 12);
    const z = THREE.MathUtils.clamp(c.target.z, -6.5, 7);
    if (x !== c.target.x || z !== c.target.z) {
      camera.position.x += x - c.target.x;
      camera.position.z += z - c.target.z;
      c.target.x = x;
      c.target.z = z;
    }
  });

  return (
    <MapControls
      ref={controls}
      makeDefault
      enableRotate={false}
      enableDamping
      dampingFactor={0.12}
      minDistance={MIN_DISTANCE}
      maxDistance={MAX_DISTANCE}
      zoomSpeed={0.9}
    />
  );
}

function Lights() {
  return (
    <>
      <hemisphereLight args={['#c3d8ff', '#3d3320', 0.78]} />
      <directionalLight
        position={[-13, 22, 11]}
        intensity={2.6}
        color="#ffdfae"
        castShadow
        shadow-mapSize={COARSE_POINTER ? [1024, 1024] : [2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.035}
      >
        <orthographicCamera attach="shadow-camera" args={[-21, 21, 15, -15, 1, 70]} />
      </directionalLight>
      {/* Soft fill from the camera side so walls and faces turned to the player are not left dim */}
      <directionalLight position={[2, 12, 20]} intensity={0.75} color="#fff4e0" />
      {/* Cool rim light from behind to separate silhouettes from the ground */}
      <directionalLight position={[12, 9, -14]} intensity={0.9} color="#8ec5ff" />
    </>
  );
}

/**
 * Reports once the scene is really on screen. The GPU compiles shaders in the
 * background for several seconds after the first draw calls, and until a
 * program is linked its objects are simply missing, so counting frames is not enough.
 */
function ReadySignal({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  const settled = useRef(0);
  const done = useRef(false);

  useFrame(({ gl }) => {
    if (done.current) return;
    frames.current++;
    // `isReady` exists on three's program wrapper but is missing from its type definitions.
    const programs = (gl.info.programs ?? []) as unknown as { isReady(): boolean }[];
    const compiled = frames.current > 3 && programs.length > 0 && programs.every((p) => p.isReady());
    settled.current = compiled ? settled.current + 1 : 0;
    // A few steady frames after the last program links, or a generous timeout.
    if (settled.current >= 4 || frames.current > 900) {
      done.current = true;
      onReady();
    }
  });
  return null;
}

export function Scene({ onReady }: { onReady: () => void }) {
  const world = useRef<THREE.Group>(null);

  // Development aid: inspect the renderer and scene graph from the browser console.
  const three = useThree();
  if (import.meta.env.DEV) (window as unknown as { __dd: unknown }).__dd = three;

  return (
    <>
      {/* Far enough out to leave the island clear at any zoom; it only softens what lies beyond. */}
      <fog attach="fog" args={['#0d1738', 500, 1000]} />
      <Lights />
      <Sky />

      <group ref={world}>
        <Island />
        {MAP_TYPE === 'river' && <Water />}
        <TilePicker />
        <Territory />
        <Bridges />
        <Decor />
        <Castles />
        <Chests />
        <Units />
        <Highlights />
        <Effects />
        <Dice />
        <Sparkles count={40} speed={0.25} size={3} scale={[30, 5, 18]} position={[0, 3, 0]} color="#ffe9a8" opacity={0.6} noise={1} />
      </group>

      <Shaker target={world} />
      <CameraRig />
      <ReadySignal onReady={onReady} />

      {POST_FX && !COARSE_POINTER && (
        <EffectComposer multisampling={4} enableNormalPass={false}>
          <Bloom mipmapBlur intensity={0.95} luminanceThreshold={0.9} luminanceSmoothing={0.2} radius={0.75} />
          <TiltShift2 blur={0.07} taper={0.55} start={[0, 0.5]} end={[1, 0.5]} />
          {/* Tone mapping first: the colour grading after it expects ordinary 0..1 colours. */}
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <HueSaturation saturation={0.14} />
          <BrightnessContrast contrast={0.06} />
          <Vignette offset={0.24} darkness={0.62} />
        </EffectComposer>
      )}
      {/* Phones get a lighter chain: no tilt-shift blur. */}
      {POST_FX && COARSE_POINTER && (
        <EffectComposer multisampling={4} enableNormalPass={false}>
          <Bloom mipmapBlur intensity={0.95} luminanceThreshold={0.9} luminanceSmoothing={0.2} radius={0.75} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <HueSaturation saturation={0.14} />
          <Vignette offset={0.24} darkness={0.62} />
        </EffectComposer>
      )}
    </>
  );
}
