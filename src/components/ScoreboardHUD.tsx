import React from 'react';
import { TEAM_PRESETS } from '../constants';
import type { CameraZoomLevel } from '../engine/kickOffEngine';
import type { GameState } from '../types';

interface ScoreboardHUDProps {
  gameState: GameState;
  zoomLevel: CameraZoomLevel;
  muted: boolean;
  showTouchControls: boolean;
  onCycleZoom: () => void;
  onToggleMute: () => void;
  onToggleTouchControls: () => void;
  onPause: () => void;
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const ZOOM_LABELS: Record<CameraZoomLevel, string> = {
  0: 'Srednje',
  1: 'Odozgo (D)',
  2: 'Odozgo+ (D)',
  3: 'Blizu',
  4: 'Široko',
  5: 'Odozgo (Š)',
  6: 'Odozgo+ (Š)',
};

export const ScoreboardHUD: React.FC<ScoreboardHUDProps> = ({
  gameState,
  zoomLevel,
  muted,
  showTouchControls,
  onCycleZoom,
  onToggleMute,
  onToggleTouchControls,
  onPause,
}) => {
  const home = TEAM_PRESETS.find((t) => t.id === gameState.config.homeTeamId) ?? TEAM_PRESETS[0];
  const away = TEAM_PRESETS.find((t) => t.id === gameState.config.awayTeamId) ?? TEAM_PRESETS[1];
  const activePlayer = gameState.players.find((p) => p.id === gameState.activeHomePlayerId);

  const sinBinCount = gameState.players.filter(
    (p) => p.sinBinTimer > 0 && p.card !== 'red'
  ).length;

  return (
    <div className="fixed inset-x-0 top-0 z-10 pointer-events-none px-2.5 pt-2.5 sm:px-5 sm:pt-4 flex flex-col items-center gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      {/* Top-Left: Active Player & Mode Readout (unboxed clean metadata) */}
      <div className="hidden sm:flex flex-col gap-0.5 bg-[#09110d]/85 border border-white/10 rounded-lg px-3 py-1.5">
        <div className="text-[11px] font-semibold tracking-wider text-emerald-300">
          {activePlayer ? `#${activePlayer.number} ${activePlayer.name}` : 'Igrač'}
        </div>
        <div className="text-[11px] text-slate-300/85 flex items-center gap-1.5">
          <span>{gameState.config.mode === 'arena5v5' ? 'Arena 5v5' : `Klasik ${gameState.config.formation}`}</span>
          <span aria-hidden="true">·</span>
          <span>
            Posed:{' '}
            {gameState.possessionTeam === 'home'
              ? home.shortCode
              : gameState.possessionTeam === 'away'
                ? away.shortCode
                : '—'}
          </span>
          {sinBinCount > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-400">Kazna: {sinBinCount}</span>
            </>
          )}
        </div>
      </div>

      {/* Top-Center: Retro-Arcade Broadcast Scoreboard */}
      <div className="flex items-center bg-[#09120e]/95 border border-white/15 rounded-lg shadow-[0_6px_22px_rgba(0,0,0,0.55)] overflow-hidden shrink-0">
        {/* Home Team */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 border-r border-white/10">
          <span
            className="w-2.5 sm:w-3 h-4 sm:h-5 rounded-sm border border-white/30 shrink-0"
            style={{ backgroundColor: home.primaryColor }}
            aria-hidden="true"
          />
          <span className="font-display text-base sm:text-xl font-bold tracking-wide text-white">
            {home.shortCode}
          </span>
          <span
            data-testid="home-score"
            className="font-mono-tabular text-lg sm:text-2xl font-bold text-amber-300 pl-0.5 sm:pl-1"
          >
            {gameState.homeScore}
          </span>
        </div>

        {/* Clock & Half */}
        <div className="flex flex-col items-center justify-center px-2.5 sm:px-3 py-0.5 sm:py-1 bg-[#112119] min-w-[68px] sm:min-w-[82px]">
          <span className="text-[9px] sm:text-[10px] font-bold tracking-wider text-emerald-300 leading-none">
            {gameState.half}. POL
          </span>
          <span
            data-testid="match-clock"
            className="font-mono-tabular text-sm sm:text-lg font-bold text-white leading-tight mt-0.5"
          >
            {formatClock(gameState.clockSeconds)}
          </span>
        </div>

        {/* Away Team */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 border-l border-white/10">
          <span
            data-testid="away-score"
            className="font-mono-tabular text-lg sm:text-2xl font-bold text-amber-300 pr-0.5 sm:pr-1"
          >
            {gameState.awayScore}
          </span>
          <span className="font-display text-base sm:text-xl font-bold tracking-wide text-white">
            {away.shortCode}
          </span>
          <span
            className="w-2.5 sm:w-3 h-4 sm:h-5 rounded-sm border border-white/30 shrink-0"
            style={{ backgroundColor: away.primaryColor }}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Top-Right: Compact Utility Icon Buttons */}
      <div className="pointer-events-auto flex items-center gap-1.5">
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onCycleZoom();
          }}
          aria-label={`Zum kamere: ${ZOOM_LABELS[zoomLevel]} (C)`}
          title={`Kamera: ${ZOOM_LABELS[zoomLevel]} [C]`}
          className="h-10 sm:h-9 px-2.5 rounded-lg bg-[#09120e]/90 border border-white/15 text-xs font-semibold text-slate-200 hover:bg-[#13251d] hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
            <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <span className="hidden md:inline">{ZOOM_LABELS[zoomLevel]} [C]</span>
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleTouchControls();
          }}
          aria-label="Kontrole na ekranu"
          title="Džojstik na ekranu"
          className={`w-10 h-10 sm:w-9 sm:h-9 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
            showTouchControls
              ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
              : 'bg-[#09120e]/90 border-white/15 text-slate-200 hover:bg-[#13251d]'
          }`}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
            <path d="M15 7.5V2H9v5.5l3 3 3-3zM7.5 9H2v6h5.5l3-3-3-3zM9 16.5V22h6v-5.5l-3-3-3 3zM16.5 9l-3 3 3 3H22V9h-5.5z" />
          </svg>
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={muted ? 'Uključi zvuk' : 'Isključi zvuk'}
          title={muted ? 'Uključi zvuk [M]' : 'Isključi zvuk [M]'}
          className="w-10 h-10 sm:w-9 sm:h-9 rounded-lg bg-[#09120e]/90 border border-white/15 text-slate-200 hover:bg-[#13251d] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
            {muted ? (
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
            ) : (
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
            )}
          </svg>
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onPause();
          }}
          aria-label="Pauza (P)"
          title="Pauza [P / Esc]"
          className="w-10 h-10 sm:w-9 sm:h-9 rounded-lg bg-[#09120e]/90 border border-white/15 text-slate-200 hover:bg-[#13251d] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        </button>
      </div>
    </div>
  );
};
