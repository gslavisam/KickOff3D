import React from 'react';
import type { GameState } from '../types';

interface CommentatorBarProps {
  gameState: GameState;
}

export const CommentatorBar: React.FC<CommentatorBarProps> = ({ gameState }) => {
  const { commentary, isChargingShot, shotCharge, ball } = gameState;
  const aftertouchActive = ball.aftertouchTimer > 0 && ball.aftertouchTeam === 'home';

  const toneAccent =
    commentary.tone === 'goal'
      ? 'border-amber-400/70 text-amber-200'
      : commentary.tone === 'card'
        ? 'border-rose-400/70 text-rose-200'
        : commentary.tone === 'woodwork'
          ? 'border-orange-400/70 text-orange-200'
          : 'border-emerald-400/40 text-slate-100';

  const toneLabel =
    commentary.tone === 'goal'
      ? 'GOOOL!'
      : commentary.tone === 'card'
        ? 'KARTON'
        : commentary.tone === 'woodwork'
          ? 'OKVIR GOLA'
          : 'PRENOS';

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none flex flex-col items-center gap-2 w-[min(640px,92vw)]">
      {/* Shot Power / Aftertouch Indicator */}
      {(isChargingShot || aftertouchActive) && (
        <div className="bg-[#09120e]/95 border border-white/15 rounded-lg px-3.5 py-1.5 flex items-center gap-3 shadow-lg">
          <span className="text-[11px] font-bold tracking-wider text-amber-300 whitespace-nowrap">
            {aftertouchActive ? 'EFE U LETU (LEVO/DESNO/NAZAD)' : 'JAČINA ŠUTA'}
          </span>
          <div className="w-36 h-2.5 bg-slate-800 rounded-sm overflow-hidden">
            <div
              className={`h-full transition-none ${
                aftertouchActive ? 'bg-sky-400' : 'bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500'
              }`}
              style={{
                width: `${Math.round(
                  (aftertouchActive ? ball.aftertouchTimer / 0.35 : shotCharge) * 100
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Goal Banner */}
      {gameState.phase === 'goal' && (
        <div className="animate-goal-banner bg-amber-400 text-slate-950 font-display text-3xl sm:text-4xl font-extrabold tracking-wide px-6 py-1.5 rounded-lg shadow-[0_8px_28px_rgba(250,204,21,0.45)]">
          GOOOOL! {gameState.lastScorerName ? `· ${gameState.lastScorerName}` : ''}
        </div>
      )}

      {/* Serbian Sports Commentator Ticker */}
      <div
        key={commentary.id}
        data-testid="commentary-bar"
        className={`animate-ticker-in w-full bg-[#09120e]/92 border ${toneAccent} rounded-lg px-4 py-2 shadow-xl flex items-center gap-3`}
      >
        <span className="font-display text-sm font-extrabold tracking-wider text-amber-300 shrink-0">
          {toneLabel}
        </span>
        <span className="text-xs sm:text-sm font-medium leading-snug truncate">
          {commentary.text}
        </span>
      </div>
    </div>
  );
};
