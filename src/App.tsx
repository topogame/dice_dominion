import { Suspense, useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { connectSound } from './audio/wire';
import { CAMERA_FOV } from './scene/framing';
import { Scene } from './scene/Scene';
import { COARSE_POINTER } from './scene/view';
import { useGame } from './state/game';
import { Hud } from './ui/Hud';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => connectSound(), []);

  const handleReady = useCallback(() => {
    setReady(true);
    useGame.getState().start();
  }, []);

  return (
    <div className="app">
      <Canvas
        // "percentage" = PCFShadowMap. The default ("soft") asks for PCFSoftShadowMap, which
        // this three.js release removed; three then swaps the type and recompiles every material.
        shadows="percentage"
        dpr={COARSE_POINTER ? [1, 1.5] : [1, 1.75]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        camera={{ fov: CAMERA_FOV, near: 10, far: 1200, position: [0, 25, 18] }}
      >
        {/* Nothing is drawn, and the loading screen stays up, until every model has arrived. */}
        <Suspense fallback={null}>
          <Scene onReady={handleReady} />
        </Suspense>
      </Canvas>

      {ready && <Hud />}

      <div className={`loading${ready ? ' is-done' : ''}`} aria-hidden={ready}>
        <div className="loading-mark">
          <span>Dice</span>
          <span>Dominion</span>
        </div>
        <div className="loading-rule" />
        <div className="loading-note">Forging realms…</div>
      </div>
    </div>
  );
}
