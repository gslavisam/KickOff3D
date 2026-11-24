import React from 'react';
import { TEAM_PRESETS } from '../constants';
import type { GameState } from '../types';

interface MatchModalProps {
  gameState: GameState;
  onResume: () => void;
  onContinueSecondHalf: () => void;
  onRematch: () => void;
  onReturnToTitle: () => void;
}

export const MatchModal: React.FC<MatchModalProps> = ({
  gameState,
  onResume,
  onContinueSecondHalf,
  onRematch,
  onReturnToTitle,
}) => {
  const { phase, homeScore, awayScore, stats } = gameState;
  if (phase !== 'paused' && phase !== 'halftime' && phase !== 'gameover') {
    return null;
  }

  const home = TEAM_PRESETS.find((t) => t.id === gameState.config.homeTeamId) ?? TEAM_PRESETS[0];
  const away = TEAM_PRESETS.find((t) => t.id === gameState.config.awayTeamId) ?? TEAM_PRESETS[1];

  const totalPoss = stats.homePossessionTime + stats.awayPossessionTime;
  const homePossPct = totalPoss > 0.1 ? Math.round((stats.homePossessionTime / totalPoss) * 100) : 50;
  const awayPossPct = 100 - homePossPct;

  const titleText =
    phase === 'paused'
      ? 'PAUZA'
      : phase === 'halftime'
        ? 'POLUVREME'
        : homeScore > awayScore
          ? `POBEDA · ${home.name.toUpperCase()}`
          : awayScore > homeScore
            ? `POBEDA · ${away.name.toUpperCase()}`
            : 'NEREŠENO';

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#060d0a]/82 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titleText}
        className="w-full max-w-md bg-[#0d1b15] border border-white/15 rounded-xl p-6 shadow-2xl flex flex-col gap-5"
      >
        {/* Header & Score Summary */}
        <div className="text-center">
          <div className="text-xs font-semibold tracking-widest text-emerald-300 mb-1">
            {phase === 'paused'
              ? 'MEČ JE ZAUSTAVLJEN'
              : phase === 'halftime'
                ? 'PREGLED PRVOG POLUVREMENA'
                : 'KRAJ UTAKMICE'}
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-wide">
            {titleText}
          </h2>
          <div className="mt-3 flex items-center justify-center gap-4 bg-[#12241c] border border-white/10 rounded-lg py-2.5 px-4">
            <span className="font-display text-xl font-bold text-white">{home.shortCode}</span>
            <span className="font-mono-tabular text-3xl font-bold text-amber-300">
              {homeScore} : {awayScore}
            </span>
            <span className="font-display text-xl font-bold text-white">{away.shortCode}</span>
          </div>
        </div>

        {/* Tabular Stats (shown in halftime & gameover) */}
        {(phase === 'halftime' || phase === 'gameover') && (
          <div className="flex flex-col gap-2.5 text-sm border-y border-white/10 py-3.5">
            <div className="grid grid-cols-3 items-center text-center">
              <span className="font-mono-tabular font-bold text-white">{homePossPct}%</span>
              <span className="text-xs text-slate-300/80">Posed lopte</span>
              <span className="font-mono-tabular font-bold text-white">{awayPossPct}%</span>
            </div>
            <div className="grid grid-cols-3 items-center text-center">
              <span className="font-mono-tabular font-bold text-white">
                {stats.homeShots} ({stats.homeShotsOnTarget})
              </span>
              <span className="text-xs text-slate-300/80">Šutevi (u okvir)</span>
              <span className="font-mono-tabular font-bold text-white">
                {stats.awayShots} ({stats.awayShotsOnTarget})
              </span>
            </div>
            <div className="grid grid-cols-3 items-center text-center">
              <span className="font-mono-tabular font-bold text-white">{stats.homeFouls}</span>
              <span className="text-xs text-slate-300/80">Prekršaji</span>
              <span className="font-mono-tabular font-bold text-white">{stats.awayFouls}</span>
            </div>
            {gameState.config.mode === 'classic11v11' && (
              <div className="grid grid-cols-3 items-center text-center">
                <span className="font-mono-tabular font-bold text-amber-300">
                  {stats.homeYellowCards} Ž / {stats.homeRedCards} C
                </span>
                <span className="text-xs text-slate-300/80">Kartoni</span>
                <span className="font-mono-tabular font-bold text-amber-300">
                  {stats.awayYellowCards} Ž / {stats.awayRedCards} C
                </span>
              </div>
            )}
          </div>
        )}

        {/* Primary & Secondary Actions */}
        <div className="flex flex-col gap-2.5">
          {phase === 'paused' && (
            <button
              type="button"
              onClick={onResume}
              className="w-full py-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-display text-xl font-extrabold tracking-wide cursor-pointer"
            >
              NASTAVI MEČ
            </button>
          )}
          {phase === 'halftime' && (
            <button
              type="button"
              onClick={onContinueSecondHalf}
              className="w-full py-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-display text-xl font-extrabold tracking-wide cursor-pointer"
            >
              NASTAVI 2. POLUVREME
            </button>
          )}
          {phase === 'gameover' && (
            <button
              type="button"
              data-start="true"
              onClick={onRematch}
              className="w-full py-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-display text-xl font-extrabold tracking-wide cursor-pointer"
            >
              IGRAJ REVANŠ
            </button>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            {phase !== 'gameover' && (
              <button
                type="button"
                onClick={onRematch}
                className="py-2.5 rounded-lg bg-[#14281f] hover:bg-[#1c382c] border border-white/15 text-xs font-semibold text-white cursor-pointer"
              >
                PONOVI MEČ
              </button>
            )}
            <button
              type="button"
              onClick={onReturnToTitle}
              className={`py-2.5 rounded-lg bg-[#14281f] hover:bg-[#1c382c] border border-white/15 text-xs font-semibold text-slate-200 cursor-pointer ${
                phase === 'gameover' ? 'col-span-2' : ''
              }`}
            >
              GLAVNI MENI
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
