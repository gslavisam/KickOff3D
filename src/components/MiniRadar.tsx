import React from 'react';
import { PITCH_DIMENSIONS, TEAM_PRESETS } from '../constants';
import { isPlayerAvailable } from '../engine/physics';
import type { GameState } from '../types';

interface MiniRadarProps {
  gameState: GameState;
}

export const MiniRadar: React.FC<MiniRadarProps> = ({ gameState }) => {
  if (gameState.config.mode !== 'classic11v11') return null;

  const dims = PITCH_DIMENSIONS.classic11v11;
  const home = TEAM_PRESETS.find((t) => t.id === gameState.config.homeTeamId) ?? TEAM_PRESETS[0];
  const away = TEAM_PRESETS.find((t) => t.id === gameState.config.awayTeamId) ?? TEAM_PRESETS[1];

  const toSvgX = (x: number) => ((x + dims.length * 0.5) / dims.length) * 160 + 10;
  const toSvgY = (z: number) => ((z + dims.width * 0.5) / dims.width) * 100 + 10;

  return (
    <div
      data-testid="mini-radar"
      className="fixed bottom-16 right-3 sm:bottom-4 sm:right-4 z-10 pointer-events-none bg-[#09120e]/92 border border-white/15 rounded-lg p-1.5 shadow-xl hidden sm:block"
    >
      <svg viewBox="0 0 180 120" className="w-40 h-28 block" aria-label="Radar terena">
        {/* Turf */}
        <rect x="10" y="10" width="160" height="100" fill="#184925" stroke="#e2e8f0" strokeWidth="1.2" />
        {/* Halfway & Center circle */}
        <line x1="90" y1="10" x2="90" y2="110" stroke="#e2e8f0" strokeWidth="1" opacity="0.7" />
        <circle cx="90" cy="60" r="14" fill="none" stroke="#e2e8f0" strokeWidth="1" opacity="0.7" />
        {/* Penalty boxes */}
        <rect x="10" y="35" width="24" height="50" fill="none" stroke="#e2e8f0" strokeWidth="1" opacity="0.7" />
        <rect x="146" y="35" width="24" height="50" fill="none" stroke="#e2e8f0" strokeWidth="1" opacity="0.7" />

        {/* Players */}
        {gameState.players.map((p) => {
          if (!isPlayerAvailable(p)) return null;
          const cx = toSvgX(p.x);
          const cy = toSvgY(p.z);
          const isActive = p.id === gameState.activeHomePlayerId;
          return (
            <g key={p.id}>
              {isActive && (
                <circle cx={cx} cy={cy} r="5.2" fill="none" stroke="#facc15" strokeWidth="1.4" />
              )}
              <circle
                cx={cx}
                cy={cy}
                r={p.role === 'GK' ? 2.8 : 3.2}
                fill={p.team === 'home' ? home.primaryColor : away.primaryColor}
                stroke="#ffffff"
                strokeWidth="0.7"
              />
            </g>
          );
        })}

        {/* Referee */}
        {gameState.referee && (
          <circle
            cx={toSvgX(gameState.referee.x)}
            cy={toSvgY(gameState.referee.z)}
            r="2.4"
            fill="#facc15"
            stroke="#000000"
            strokeWidth="0.7"
          />
        )}

        {/* Ball */}
        <circle
          cx={toSvgX(gameState.ball.x)}
          cy={toSvgY(gameState.ball.z)}
          r="3.2"
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
};
