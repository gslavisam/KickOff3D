export type GameMode = 'arena5v5' | 'classic11v11';
export type PitchSurface = 'dry' | 'mud';
export type Formation = '4-4-2' | '4-3-3' | '4-2-4' | '5-3-2';
export type TeamSide = 'home' | 'away';
export type PlayerRole = 'GK' | 'DEF' | 'MID' | 'FWD';
export type CardType = 'none' | 'yellow' | 'red';

export type MatchPhase =
  | 'title'
  | 'kickoff'
  | 'playing'
  | 'goal'
  | 'setpiece'
  | 'halftime'
  | 'paused'
  | 'gameover';

export interface TeamPreset {
  id: string;
  name: string;
  shortCode: string;
  primaryColor: string;
  secondaryColor: string;
  shortsColor: string;
  accentColor: string;
  gkColor: string;
}

export interface MatchConfig {
  mode: GameMode;
  surface: PitchSurface;
  formation: Formation;
  homeTeamId: string;
  awayTeamId: string;
  halfDurationSeconds: number;
}

export interface PlayerInputState {
  moveX: number; // -1..1 (pitch X: left/right toward goals)
  moveZ: number; // -1..1 (pitch Z: up/down across pitch)
  shootHeld: boolean;
  shootJustReleased: boolean;
  passJustPressed: boolean;
  tackleJustPressed: boolean;
}

export interface BallState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spinX: number;
  spinZ: number;
  aftertouchTimer: number;
  aftertouchTeam: TeamSide | null;
  shotDirX: number;
  shotDirZ: number;
  lastTouchTeam: TeamSide | null;
  lastTouchPlayerId: string | null;
  lastKickPower: number;
  /** Used to trigger post clang cooldown */
  postHitCooldown: number;
}

export interface PlayerEntityState {
  id: string;
  name: string;
  number: number;
  team: TeamSide;
  role: PlayerRole;
  x: number;
  z: number;
  vx: number;
  vz: number;
  facingX: number;
  facingZ: number;
  homeX: number;
  homeZ: number;
  stamina: number;
  /** Seconds remaining for slide tackle lunge */
  slideTimer: number;
  /** Seconds remaining before another slide tackle or action */
  slideCooldown: number;
  /** Seconds remaining after kicking */
  kickCooldown: number;
  /** Kick animation timer (0..0.28s) */
  kickAnimTimer: number;
  /** Goalkeeper dive timer */
  diveTimer: number;
  diveDirZ: number;
  /** Stun/knockdown timer after being fouled */
  stunTimer: number;
  /** Card status in 11v11 */
  card: CardType;
  /** Sin-bin remaining seconds in 5v5 (or sent-off in 11v11 if > 999) */
  sinBinTimer: number;
  /** Distance-synced walk cycle phase */
  gaitPhase: number;
}

export interface RefereeState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  facingX: number;
  facingZ: number;
  cardAnimTimer: number;
  shownCard: CardType;
  gaitPhase: number;
}

export interface MudPatchState {
  id: string;
  x: number;
  z: number;
  radius: number;
}

export interface MatchStats {
  homePossessionTime: number;
  awayPossessionTime: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeFouls: number;
  awayFouls: number;
  homeYellowCards: number;
  awayYellowCards: number;
  homeRedCards: number;
  awayRedCards: number;
}

export interface CommentatorEvent {
  id: number;
  text: string;
  tone: 'neutral' | 'hype' | 'card' | 'goal' | 'woodwork';
  timestamp: number;
}

export type EngineSoundEvent =
  | { type: 'kick'; power: number }
  | { type: 'pass' }
  | { type: 'post' }
  | { type: 'whistle'; kind: 'kickoff' | 'foul' | 'fulltime' }
  | { type: 'tackle'; muddy: boolean }
  | { type: 'goal' }
  | { type: 'crowd_ooh' };

export interface SetPieceState {
  kind: 'throwin' | 'corner' | 'goalkick' | 'freekick' | 'penalty';
  team: TeamSide;
  x: number;
  z: number;
  timer: number;
}

export interface GameState {
  config: MatchConfig;
  phase: MatchPhase;
  half: 1 | 2;
  clockSeconds: number;
  homeScore: number;
  awayScore: number;
  ball: BallState;
  players: PlayerEntityState[];
  referee: RefereeState | null;
  mudPatches: MudPatchState[];
  activeHomePlayerId: string;
  activeAwayPlayerId: string;
  shotCharge: number;
  isChargingShot: boolean;
  /** Seconds remaining in goal/kickoff/setpiece pause */
  phaseTimer: number;
  lastScoringTeam: TeamSide | null;
  lastScorerName: string | null;
  setPiece: SetPieceState | null;
  possessionTeam: TeamSide | null;
  stats: MatchStats;
  commentary: CommentatorEvent;
  cameraTrauma: number;
  /** Transient sound cues emitted during current step (not needed for state sync) */
  pendingSounds: EngineSoundEvent[];
  /** Incrementing event counter */
  eventSeq: number;
}
