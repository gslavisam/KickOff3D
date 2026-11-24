import React from 'react';
import { TEAM_PRESETS } from '../constants';
import type { CameraZoomLevel } from '../engine/kickOffEngine';
import type { Formation, GameMode, MatchConfig, PitchSurface } from '../types';

interface TitleScreenProps {
  config: MatchConfig;
  zoomLevel: CameraZoomLevel;
  muted: boolean;
  onConfigChange: (next: MatchConfig) => void;
  onSelectZoom: (level: CameraZoomLevel) => void;
  onStart: () => void;
  onToggleMute: () => void;
}

const FORMATIONS: Formation[] = ['4-4-2', '4-3-3', '4-2-4', '5-3-2'];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  config,
  zoomLevel,
  muted,
  onConfigChange,
  onSelectZoom,
  onStart,
  onToggleMute,
}) => {
  const setMode = (mode: GameMode) => {
    onConfigChange({
      ...config,
      mode,
      halfDurationSeconds: mode === 'arena5v5' ? 90 : 120,
      surface: mode === 'arena5v5' ? 'dry' : config.surface,
    });
  };

  const setSurface = (surface: PitchSurface) => {
    onConfigChange({ ...config, surface });
  };

  const setFormation = (formation: Formation) => {
    onConfigChange({ ...config, formation });
  };

  const setHomeTeam = (homeTeamId: string) => {
    let awayTeamId = config.awayTeamId;
    if (awayTeamId === homeTeamId) {
      awayTeamId = TEAM_PRESETS.find((t) => t.id !== homeTeamId)?.id ?? awayTeamId;
    }
    onConfigChange({ ...config, homeTeamId, awayTeamId });
  };

  const setAwayTeam = (awayTeamId: string) => {
    if (awayTeamId === config.homeTeamId) return;
    onConfigChange({ ...config, awayTeamId });
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between bg-gradient-to-b from-[#07110c]/85 via-[#07110c]/60 to-[#07110c]/92 px-4 py-4 sm:px-8 sm:py-6 overflow-y-auto">
      {/* Top Bar: Sound Toggle */}
      <div className="flex items-center justify-between max-w-6xl w-full mx-auto">
        <div className="text-xs tracking-wider text-emerald-300/90 font-semibold">
          AMIGA 500 OMAŽ · 3D ARKADNI FUDBAL
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={muted ? 'Uključi zvuk' : 'Isključi zvuk'}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#112119] border border-white/15 text-xs font-semibold text-slate-100 hover:bg-[#1a3126] transition-colors whitespace-nowrap shrink-0"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
            {muted ? (
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
            ) : (
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            )}
          </svg>
          <span>{muted ? 'Zvuk isključen' : 'Zvuk uključen'}</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl w-full mx-auto my-auto py-3 flex flex-col lg:flex-row items-center lg:items-stretch gap-6 lg:gap-8">
        {/* Left: Bespoke SVG Emblem & Primary CTA */}
        <div className="flex-1 flex flex-col justify-center items-center lg:items-start text-center lg:text-left">
          <div className="mb-3">
            <svg
              viewBox="0 0 380 112"
              className="w-76 sm:w-96 h-auto drop-shadow-[0_6px_20px_rgba(0,0,0,0.65)]"
              role="img"
              aria-label="Kick Off 3D"
            >
              {/* Crest Shield */}
              <path
                d="M14 14 L82 14 L82 62 C82 86 48 100 48 100 C48 100 14 86 14 62 Z"
                fill="#0f291e"
                stroke="#facc15"
                strokeWidth="3.5"
              />
              <path
                d="M22 22 L74 22 L74 59 C74 77 48 89 48 89 C48 89 22 77 22 59 Z"
                fill="#16a34a"
                opacity="0.32"
              />
              {/* Classic Ball inside Shield */}
              <circle cx="48" cy="52" r="20" fill="#f8fafc" stroke="#0f172a" strokeWidth="2.5" />
              <polygon points="48,40 58,47 54,59 42,59 38,47" fill="#0f172a" />
              <line x1="48" y1="40" x2="48" y2="32" stroke="#0f172a" strokeWidth="2.5" />
              <line x1="58" y1="47" x2="67" y2="44" stroke="#0f172a" strokeWidth="2.5" />
              <line x1="54" y1="59" x2="61" y2="67" stroke="#0f172a" strokeWidth="2.5" />
              <line x1="42" y1="59" x2="35" y2="67" stroke="#0f172a" strokeWidth="2.5" />
              <line x1="38" y1="47" x2="29" y2="44" stroke="#0f172a" strokeWidth="2.5" />

              {/* Bold Arcade Title Typography */}
              <text
                x="100"
                y="57"
                fill="#f8fafc"
                fontFamily="Barlow Condensed, sans-serif"
                fontWeight="800"
                fontStyle="italic"
                fontSize="52"
                letterSpacing="1"
              >
                KICK OFF
              </text>
              <text
                x="276"
                y="57"
                fill="#facc15"
                fontFamily="Barlow Condensed, sans-serif"
                fontWeight="800"
                fontStyle="italic"
                fontSize="52"
              >
                3D
              </text>
              <rect x="100" y="69" width="228" height="3.5" fill="#facc15" rx="1.75" />
              <text
                x="100"
                y="93"
                fill="#cbd5e1"
                fontFamily="Plus Jakarta Sans, sans-serif"
                fontWeight="600"
                fontSize="13.5"
                letterSpacing="1.6"
              >
                PTIČJA PERSPEKTIVA · AFTERTOUCH
              </text>
            </svg>
          </div>

          <p className="text-slate-200/90 text-sm sm:text-base max-w-md mb-5 leading-relaxed">
            Lopta nije zalepljena za nogu — vodi je kratkim dodirima, zakrivi šut u rašlje efeom u letu i oseti pravi duh Amige 500.
          </p>

          <button
            type="button"
            data-start="true"
            onClick={onStart}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-slate-950 font-display text-2xl font-extrabold tracking-wide shadow-[0_8px_28px_rgba(250,204,21,0.35)] transition-all cursor-pointer whitespace-nowrap"
          >
            ZAPOČNI MEČ
          </button>
        </div>

        {/* Right: Match Configuration Panel */}
        <div className="w-full max-w-md bg-[#0d1b15]/95 border border-white/15 rounded-xl p-5 shadow-2xl flex flex-col gap-4">
          {/* Mode Selector */}
          <div>
            <div className="text-xs font-semibold tracking-wider text-slate-300 mb-2">
              IZBOR REŽIMA
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setMode('arena5v5')}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                  config.mode === 'arena5v5'
                    ? 'bg-emerald-500/20 border-emerald-400 text-white'
                    : 'bg-[#12241c] border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                <div className="font-display text-xl font-bold leading-tight">
                  Brza Arena 5v5
                </div>
                <div className="text-[11px] text-slate-300/85 mt-0.5">
                  90s · Bez ofsajda · 20s kazna
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode('classic11v11')}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                  config.mode === 'classic11v11'
                    ? 'bg-emerald-500/20 border-emerald-400 text-white'
                    : 'bg-[#12241c] border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                <div className="font-display text-xl font-bold leading-tight">
                  Amiga Klasik 11v11
                </div>
                <div className="text-[11px] text-slate-300/85 mt-0.5">
                  Sudija · Kartoni · Aut/Korner
                </div>
              </button>
            </div>
          </div>

          {/* 11v11 Options: Surface & Formation */}
          {config.mode === 'classic11v11' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-white/10">
              <div>
                <div className="text-xs font-semibold tracking-wider text-slate-300 mb-1.5">
                  PODLOGA TERENA
                </div>
                <div className="grid grid-cols-2 gap-1.5 bg-[#12241c] p-1 rounded-lg border border-white/10">
                  <button
                    type="button"
                    onClick={() => setSurface('dry')}
                    className={`py-1.5 px-2 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      config.surface === 'dry'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Suva trava
                  </button>
                  <button
                    type="button"
                    onClick={() => setSurface('mud')}
                    className={`py-1.5 px-2 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      config.surface === 'mud'
                        ? 'bg-amber-600 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Blato
                  </button>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold tracking-wider text-slate-300 mb-1.5">
                  FORMACIJA
                </div>
                <div className="grid grid-cols-4 gap-1 bg-[#12241c] p-1 rounded-lg border border-white/10">
                  {FORMATIONS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormation(f)}
                      className={`py-1.5 rounded text-[11px] font-mono-tabular font-bold transition-colors cursor-pointer ${
                        config.formation === f
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Camera Perspective Selector */}
          <div className="pt-1 border-t border-white/10">
            <div className="text-xs font-semibold tracking-wider text-slate-300 mb-1.5">
              POGLED KAMERE
            </div>
            <div className="grid grid-cols-3 gap-1 bg-[#12241c] p-1 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => onSelectZoom(0)}
                className={`py-1.5 px-1.5 rounded text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  zoomLevel === 0 || zoomLevel === 3 || zoomLevel === 4
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Sa strane
              </button>
              <button
                type="button"
                onClick={() => onSelectZoom(1)}
                className={`py-1.5 px-1.5 rounded text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  zoomLevel === 1 || zoomLevel === 2
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Odozgo (Dužina)
              </button>
              <button
                type="button"
                onClick={() => onSelectZoom(5)}
                className={`py-1.5 px-1.5 rounded text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  zoomLevel === 5 || zoomLevel === 6
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Odozgo (Širina)
              </button>
            </div>
          </div>

          {/* Team Selectors */}
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-white/10">
            <div>
              <label
                htmlFor="home-team-select"
                className="block text-xs font-semibold tracking-wider text-slate-300 mb-1.5"
              >
                TVOJ TIM (DOMAĆI)
              </label>
              <select
                id="home-team-select"
                value={config.homeTeamId}
                onChange={(e) => setHomeTeam(e.target.value)}
                className="w-full bg-[#12241c] border border-white/15 rounded-lg px-2.5 py-2 text-sm font-medium text-white focus:outline-none focus:border-amber-400"
              >
                {TEAM_PRESETS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.shortCode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="away-team-select"
                className="block text-xs font-semibold tracking-wider text-slate-300 mb-1.5"
              >
                PROTIVNIK (GOSTI)
              </label>
              <select
                id="away-team-select"
                value={config.awayTeamId}
                onChange={(e) => setAwayTeam(e.target.value)}
                className="w-full bg-[#12241c] border border-white/15 rounded-lg px-2.5 py-2 text-sm font-medium text-white focus:outline-none focus:border-amber-400"
              >
                {TEAM_PRESETS.filter((t) => t.id !== config.homeTeamId).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.shortCode})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Clean Control Hint */}
      <div className="text-center text-xs text-slate-300/80 tracking-wide">
        WASD / Strelice Kretanje · Space / J Šut + Efe · K Dodavanje / Promena igrača · L Klizeći start · C Zum · V Ptičja odozgo · P Pauza
      </div>
    </div>
  );
};
