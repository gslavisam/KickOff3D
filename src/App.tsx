import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CommentatorBar } from './components/CommentatorBar';
import { MatchModal } from './components/MatchModal';
import { MiniRadar } from './components/MiniRadar';
import { ScoreboardHUD } from './components/ScoreboardHUD';
import { TitleScreen } from './components/TitleScreen';
import { TouchControls } from './components/TouchControls';
import { type CameraZoomLevel, KickOffEngine } from './engine/kickOffEngine';
import { createInitialGameState } from './engine/physics';
import { soundService } from './services/soundService';
import type { GameState, MatchConfig } from './types';

const DEFAULT_CONFIG: MatchConfig = {
  mode: 'arena5v5',
  surface: 'dry',
  formation: '4-4-2',
  homeTeamId: 'crveni_zmaj',
  awayTeamId: 'plavi_talas',
  halfDurationSeconds: 90,
};

function mapPhaseToBodyState(phase: GameState['phase']): string {
  if (phase === 'title') return 'title';
  if (phase === 'paused' || phase === 'halftime') return 'paused';
  if (phase === 'gameover') return 'gameover';
  return 'playing';
}

export const App: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<KickOffEngine | null>(null);

  const [config, setConfig] = useState<MatchConfig>(DEFAULT_CONFIG);
  const configRef = useRef<MatchConfig>(DEFAULT_CONFIG);
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialGameState(DEFAULT_CONFIG, 'title')
  );
  const [zoomLevel, setZoomLevel] = useState<CameraZoomLevel>(0);
  const [muted, setMuted] = useState<boolean>(false);
  const [showTouchControls, setShowTouchControls] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
  });

  // Mount Three.js engine once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new KickOffEngine(container, configRef.current, {
      onStateUpdate: (nextState) => {
        document.body.dataset.state = mapPhaseToBodyState(nextState.phase);
        setGameState(nextState);
      },
      onZoomChange: (zoom) => {
        setZoomLevel(zoom);
      },
    });
    engineRef.current = engine;
    document.body.dataset.state = 'title';

    // Support ?autostart=1 for instant gameplay verification
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.startMatch(configRef.current);
      document.body.dataset.state = 'playing';
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStartMatch = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    soundService.unlock();
    document.body.dataset.state = 'playing';
    engineRef.current?.startMatch(configRef.current);
  }, []);

  const handleConfigChange = useCallback((next: MatchConfig) => {
    configRef.current = next;
    setConfig(next);
    engineRef.current?.previewConfig(next);
  }, []);

  const handleToggleMute = useCallback(() => {
    soundService.unlock();
    const nextMuted = soundService.toggleMute();
    setMuted(nextMuted);
  }, []);

  // Global keyboard shortcuts for Title start (Enter/Space) & Mute (M)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') {
        handleToggleMute();
      }
      if (
        gameState.phase === 'title' &&
        (e.code === 'Enter' || e.code === 'Space') &&
        !(e.target instanceof HTMLSelectElement)
      ) {
        e.preventDefault();
        handleStartMatch();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState.phase, handleStartMatch, handleToggleMute]);

  const isTitle = gameState.phase === 'title';

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#09110d]">
      {/* Isolated 3D WebGL Viewport */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full"
        aria-label="3D fudbalski teren"
      />

      {/* Title Screen */}
      {isTitle && (
        <TitleScreen
          config={config}
          zoomLevel={zoomLevel}
          muted={muted}
          onConfigChange={handleConfigChange}
          onSelectZoom={(level) => engineRef.current?.setZoomLevel(level)}
          onStart={handleStartMatch}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Active Gameplay HUD */}
      {!isTitle && (
        <>
          <ScoreboardHUD
            gameState={gameState}
            zoomLevel={zoomLevel}
            muted={muted}
            showTouchControls={showTouchControls}
            onCycleZoom={() => engineRef.current?.cycleCameraZoom()}
            onToggleMute={handleToggleMute}
            onToggleTouchControls={() => setShowTouchControls((v) => !v)}
            onPause={() => engineRef.current?.pauseMatch()}
          />
          <MiniRadar gameState={gameState} />
          <CommentatorBar gameState={gameState} />
          <TouchControls
            visible={showTouchControls && gameState.phase === 'playing'}
            onJoystickMove={(x, z) => engineRef.current?.setTouchJoystick(x, z)}
            onShootHold={(held) => engineRef.current?.setTouchShoot(held)}
            onPass={() => engineRef.current?.triggerTouchPass()}
            onTackle={() => engineRef.current?.triggerTouchTackle()}
          />
          <MatchModal
            gameState={gameState}
            onResume={() => engineRef.current?.resumeMatch()}
            onContinueSecondHalf={() => engineRef.current?.continueSecondHalf()}
            onRematch={handleStartMatch}
            onReturnToTitle={() => {
              document.body.dataset.state = 'title';
              engineRef.current?.returnToTitle(configRef.current);
            }}
          />
        </>
      )}
    </div>
  );
};

export default App;
