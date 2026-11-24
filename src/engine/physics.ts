import {
  AFTERTOUCH_WINDOW,
  BALL_RADIUS,
  COMMENTARY_LINES,
  FORMATION_5V5,
  FORMATIONS_11V11,
  GRAVITY,
  PITCH_DIMENSIONS,
  PLAYER_NAMES_AWAY,
  PLAYER_NAMES_HOME,
  PLAYER_RADIUS,
} from '../constants';
import type {
  BallState,
  CardType,
  CommentatorEvent,
  GameState,
  MatchConfig,
  MudPatchState,
  PlayerEntityState,
  PlayerInputState,
  RefereeState,
  TeamSide,
} from '../types';

export function createEmptyInput(): PlayerInputState {
  return {
    moveX: 0,
    moveZ: 0,
    shootHeld: false,
    shootJustReleased: false,
    passJustPressed: false,
    tackleJustPressed: false,
  };
}

function pickLine(lines: string[], seq: number): string {
  return lines[Math.abs(seq) % lines.length];
}

function createPlayersForMatch(config: MatchConfig): PlayerEntityState[] {
  const dims = PITCH_DIMENSIONS[config.mode];
  const halfLen = dims.length * 0.5;
  const halfWid = dims.width * 0.5;
  const slots =
    config.mode === 'arena5v5'
      ? FORMATION_5V5
      : FORMATIONS_11V11[config.formation];

  const players: PlayerEntityState[] = [];

  // Home team (attacks +X, starts on -X half)
  slots.forEach((slot, i) => {
    const hx = slot.nx * halfLen;
    const hz = slot.nz * halfWid;
    players.push({
      id: `home-${i}`,
      name: PLAYER_NAMES_HOME[i % PLAYER_NAMES_HOME.length],
      number: i + 1,
      team: 'home',
      role: slot.role,
      x: hx,
      z: hz,
      vx: 0,
      vz: 0,
      facingX: 1,
      facingZ: 0,
      homeX: hx,
      homeZ: hz,
      stamina: 1,
      slideTimer: 0,
      slideCooldown: 0,
      kickCooldown: 0,
      kickAnimTimer: 0,
      diveTimer: 0,
      diveDirZ: 0,
      stunTimer: 0,
      card: 'none',
      sinBinTimer: 0,
      gaitPhase: 0,
    });
  });

  // Away team (attacks -X, starts on +X half)
  slots.forEach((slot, i) => {
    const hx = -slot.nx * halfLen;
    const hz = -slot.nz * halfWid;
    players.push({
      id: `away-${i}`,
      name: PLAYER_NAMES_AWAY[i % PLAYER_NAMES_AWAY.length],
      number: i + 1,
      team: 'away',
      role: slot.role,
      x: hx,
      z: hz,
      vx: 0,
      vz: 0,
      facingX: -1,
      facingZ: 0,
      homeX: hx,
      homeZ: hz,
      stamina: 1,
      slideTimer: 0,
      slideCooldown: 0,
      kickCooldown: 0,
      kickAnimTimer: 0,
      diveTimer: 0,
      diveDirZ: 0,
      stunTimer: 0,
      card: 'none',
      sinBinTimer: 0,
      gaitPhase: 0,
    });
  });

  return players;
}

function createBallAtCenter(): BallState {
  return {
    x: 0,
    y: BALL_RADIUS,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    spinX: 0,
    spinZ: 0,
    aftertouchTimer: 0,
    aftertouchTeam: null,
    shotDirX: 1,
    shotDirZ: 0,
    lastTouchTeam: null,
    lastTouchPlayerId: null,
    lastKickPower: 0,
    postHitCooldown: 0,
  };
}

function createReferee(config: MatchConfig): RefereeState | null {
  if (config.mode !== 'classic11v11') return null;
  return {
    x: 0,
    z: -8,
    vx: 0,
    vz: 0,
    facingX: 0,
    facingZ: 1,
    cardAnimTimer: 0,
    shownCard: 'none',
    gaitPhase: 0,
  };
}

export function createInitialGameState(
  config: MatchConfig,
  initialPhase: 'title' | 'kickoff' | 'playing' = 'title'
): GameState {
  const players = createPlayersForMatch(config);
  const mudPatches =
    config.surface === 'mud'
      ? [
          {
            id: 'mud-1',
            x: 0,
            z: 0,
            radius: config.mode === 'arena5v5' ? 2.4 : 3.8,
          },
          {
            id: 'mud-2',
            x: -PITCH_DIMENSIONS[config.mode].length * 0.22,
            z: PITCH_DIMENSIONS[config.mode].width * 0.18,
            radius: config.mode === 'arena5v5' ? 1.8 : 3.0,
          },
          {
            id: 'mud-3',
            x: PITCH_DIMENSIONS[config.mode].length * 0.22,
            z: -PITCH_DIMENSIONS[config.mode].width * 0.18,
            radius: config.mode === 'arena5v5' ? 1.8 : 3.0,
          },
          {
            id: 'mud-4',
            x: -PITCH_DIMENSIONS[config.mode].length * 0.14,
            z: -PITCH_DIMENSIONS[config.mode].width * 0.24,
            radius: config.mode === 'arena5v5' ? 1.6 : 2.6,
          },
          {
            id: 'mud-5',
            x: PITCH_DIMENSIONS[config.mode].length * 0.14,
            z: PITCH_DIMENSIONS[config.mode].width * 0.24,
            radius: config.mode === 'arena5v5' ? 1.6 : 2.6,
          },
        ]
      : [];

  // Default active player: outfield player closest to center spot
  const homeKicker =
    players
      .filter((p) => p.team === 'home' && p.role !== 'GK')
      .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0] ?? players[1];
  const awayKicker =
    players
      .filter((p) => p.team === 'away' && p.role !== 'GK')
      .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0] ?? players[players.length - 1];

  if (initialPhase === 'kickoff') {
    homeKicker.x = -0.9;
    homeKicker.z = 0;
  }

  return {
    config: { ...config },
    phase: initialPhase,
    half: 1,
    clockSeconds: 0,
    homeScore: 0,
    awayScore: 0,
    ball: createBallAtCenter(),
    players,
    referee: createReferee(config),
    mudPatches,
    activeHomePlayerId: homeKicker.id,
    activeAwayPlayerId: awayKicker.id,
    shotCharge: 0,
    isChargingShot: false,
    phaseTimer: initialPhase === 'kickoff' ? 0.35 : 0,
    lastScoringTeam: null,
    lastScorerName: null,
    setPiece: null,
    possessionTeam: null,
    stats: {
      homePossessionTime: 0,
      awayPossessionTime: 0,
      homeShots: 0,
      awayShots: 0,
      homeShotsOnTarget: 0,
      awayShotsOnTarget: 0,
      homeFouls: 0,
      awayFouls: 0,
      homeYellowCards: 0,
      awayYellowCards: 0,
      homeRedCards: 0,
      awayRedCards: 0,
    },
    commentary: {
      id: 1,
      text: pickLine(COMMENTARY_LINES.kickoff, 0),
      tone: 'neutral',
      timestamp: 0,
    },
    cameraTrauma: 0,
    pendingSounds: initialPhase === 'kickoff' ? [{ type: 'whistle', kind: 'kickoff' }] : [],
    eventSeq: 1,
  };
}

export function serializeGameState(state: GameState): GameState {
  // Clean JSON-safe snapshot ready for React HUD or WebSocket transport
  return {
    config: { ...state.config },
    phase: state.phase,
    half: state.half,
    clockSeconds: state.clockSeconds,
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    ball: { ...state.ball },
    players: state.players.map((p) => ({ ...p })),
    referee: state.referee ? { ...state.referee } : null,
    mudPatches: state.mudPatches.map((m) => ({ ...m })),
    activeHomePlayerId: state.activeHomePlayerId,
    activeAwayPlayerId: state.activeAwayPlayerId,
    shotCharge: state.shotCharge,
    isChargingShot: state.isChargingShot,
    phaseTimer: state.phaseTimer,
    lastScoringTeam: state.lastScoringTeam,
    lastScorerName: state.lastScorerName,
    setPiece: state.setPiece ? { ...state.setPiece } : null,
    possessionTeam: state.possessionTeam,
    stats: { ...state.stats },
    commentary: { ...state.commentary },
    cameraTrauma: state.cameraTrauma,
    pendingSounds: [],
    eventSeq: state.eventSeq,
  };
}

function pushCommentary(
  state: GameState,
  text: string,
  tone: CommentatorEvent['tone'] = 'neutral'
): void {
  state.eventSeq += 1;
  state.commentary = {
    id: state.eventSeq,
    text,
    tone,
    timestamp: state.clockSeconds,
  };
}

export function isPointInMud(state: GameState, x: number, z: number): boolean {
  if (state.config.surface !== 'mud') return false;
  for (const patch of state.mudPatches) {
    const dx = x - patch.x;
    const dz = z - patch.z;
    if (dx * dx + dz * dz <= patch.radius * patch.radius) {
      return true;
    }
  }
  return false;
}

export function isPlayerAvailable(p: PlayerEntityState): boolean {
  return p.card !== 'red' && p.sinBinTimer <= 0;
}

function resetPositionsForKickoff(state: GameState, kickoffTeam: TeamSide): void {
  const dims = PITCH_DIMENSIONS[state.config.mode];
  const halfLen = dims.length * 0.5;
  const halfWid = dims.width * 0.5;

  for (const p of state.players) {
    if (!isPlayerAvailable(p)) {
      // Keep sent-off / sin-binned players parked off-pitch
      p.x = 0;
      p.z = halfWid + 3.2;
      p.vx = 0;
      p.vz = 0;
      continue;
    }
    p.x = p.homeX;
    p.z = p.homeZ;
    p.vx = 0;
    p.vz = 0;
    p.facingX = p.team === 'home' ? 1 : -1;
    p.facingZ = 0;
    p.slideTimer = 0;
    p.slideCooldown = 0;
    p.kickCooldown = 0;
    p.stunTimer = 0;
    p.diveTimer = 0;
  }

  // Place closest striker near center spot for kickoff team
  const kicker = state.players
    .filter((p) => p.team === kickoffTeam && p.role !== 'GK' && isPlayerAvailable(p))
    .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
  if (kicker) {
    kicker.x = kickoffTeam === 'home' ? -0.9 : 0.9;
    kicker.z = 0;
    if (kickoffTeam === 'home') state.activeHomePlayerId = kicker.id;
    else state.activeAwayPlayerId = kicker.id;
  }

  state.ball = createBallAtCenter();
  state.shotCharge = 0;
  state.isChargingShot = false;
  state.setPiece = null;
  if (state.referee) {
    state.referee.x = 0;
    state.referee.z = -Math.min(10, halfWid * 0.45);
    state.referee.vx = 0;
    state.referee.vz = 0;
    state.referee.cardAnimTimer = 0;
  }
  // Ensure midfielders aren't offside across center line on kickoff
  for (const p of state.players) {
    if (!isPlayerAvailable(p)) continue;
    if (p.team === 'home' && p.x > -0.8) p.x = Math.min(p.x, -0.8);
    if (p.team === 'away' && p.x < 0.8) p.x = Math.max(p.x, 0.8);
    if (Math.abs(p.x) > halfLen - 0.5) {
      p.x = Math.sign(p.x) * (halfLen - 0.5);
    }
  }
}

export function startSecondHalf(state: GameState): void {
  if (state.phase !== 'halftime') return;
  state.half = 2;
  state.clockSeconds = state.config.halfDurationSeconds;
  state.phase = 'kickoff';
  state.phaseTimer = 0.35;
  resetPositionsForKickoff(state, 'away');
  state.pendingSounds.push({ type: 'whistle', kind: 'kickoff' });
  pushCommentary(
    state,
    'Počinje drugo poluvreme! Sve karte su na stolu — ko ima više snage?',
    'neutral'
  );
}

function findClosestOutfieldPlayer(
  state: GameState,
  team: TeamSide,
  x: number,
  z: number,
  excludeId?: string
): PlayerEntityState | null {
  let best: PlayerEntityState | null = null;
  let bestDistSq = Infinity;
  for (const p of state.players) {
    if (p.team !== team || p.role === 'GK' || !isPlayerAvailable(p)) continue;
    if (excludeId && p.id === excludeId) continue;
    const dx = p.x - x;
    const dz = p.z - z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestDistSq) {
      bestDistSq = d2;
      best = p;
    }
  }
  return best;
}

function findPassTarget(
  state: GameState,
  passer: PlayerEntityState
): PlayerEntityState | null {
  let best: PlayerEntityState | null = null;
  let bestScore = -Infinity;
  for (const mate of state.players) {
    if (mate.team !== passer.team || mate.id === passer.id || !isPlayerAvailable(mate)) {
      continue;
    }
    const dx = mate.x - passer.x;
    const dz = mate.z - passer.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.5 || dist > 32) continue;
    const dot = (dx / dist) * passer.facingX + (dz / dist) * passer.facingZ;
    // Prefer teammates ahead of facing direction at reasonable distance
    const score = dot * 2.2 - dist * 0.045 + (mate.role === 'GK' ? -0.9 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = mate;
    }
  }
  return best;
}

function executeKick(
  state: GameState,
  kicker: PlayerEntityState,
  dirX: number,
  dirZ: number,
  power: number,
  isPass: boolean
): void {
  const len = Math.hypot(dirX, dirZ) || 1;
  const nx = dirX / len;
  const nz = dirZ / len;
  const ball = state.ball;

  if (isPass) {
    const passSpeed = 11.5 + power * 7.5;
    ball.vx = nx * passSpeed;
    ball.vz = nz * passSpeed;
    ball.vy = 0.8;
    ball.aftertouchTimer = 0;
    ball.aftertouchTeam = null;
    state.pendingSounds.push({ type: 'pass' });
  } else {
    // Shot with authentic Kick Off loft & aftertouch window (350ms)
    const shotSpeed = 13.5 + power * 13.0;
    const loftVy = 2.4 + power * 7.2;
    ball.vx = nx * shotSpeed + kicker.vx * 0.18;
    ball.vz = nz * shotSpeed + kicker.vz * 0.18;
    ball.vy = loftVy;
    ball.shotDirX = nx;
    ball.shotDirZ = nz;
    ball.aftertouchTimer = AFTERTOUCH_WINDOW;
    ball.aftertouchTeam = kicker.team;
    ball.lastKickPower = power;
    state.pendingSounds.push({ type: 'kick', power });

    // Track shots & shots on target
    const dims = PITCH_DIMENSIONS[state.config.mode];
    const targetGoalX = kicker.team === 'home' ? dims.length * 0.5 : -dims.length * 0.5;
    const aimingTowardGoal =
      (targetGoalX - ball.x) * nx > 0 && Math.abs(targetGoalX - ball.x) < dims.length * 0.65;
    if (aimingTowardGoal) {
      if (kicker.team === 'home') state.stats.homeShots += 1;
      else state.stats.awayShots += 1;
      // Project Z at goal line
      const tToGoal = (targetGoalX - ball.x) / (nx * shotSpeed || 1);
      const predictedZ = ball.z + nz * shotSpeed * tToGoal;
      if (Math.abs(predictedZ) <= dims.goalWidth * 0.65) {
        if (kicker.team === 'home') state.stats.homeShotsOnTarget += 1;
        else state.stats.awayShotsOnTarget += 1;
      }
    }
  }

  ball.lastTouchTeam = kicker.team;
  ball.lastTouchPlayerId = kicker.id;
  kicker.kickCooldown = 0.28;
  kicker.kickAnimTimer = 0.26;
}

function applyAftertouch(
  ball: BallState,
  input: PlayerInputState,
  dt: number
): void {
  if (ball.aftertouchTimer <= 0 || !ball.aftertouchTeam) return;
  ball.aftertouchTimer = Math.max(0, ball.aftertouchTimer - dt);

  const mag = Math.hypot(input.moveX, input.moveZ);
  if (mag < 0.2) return;
  const inX = input.moveX / mag;
  const inZ = input.moveZ / mag;

  // Dot with shot direction (forward/backward) and cross (left/right curve)
  const forwardDot = inX * ball.shotDirX + inZ * ball.shotDirZ;
  const lateralCross = ball.shotDirX * inZ - ball.shotDirZ * inX;

  // Lateral perpendicular vector to shot direction
  const perpX = -ball.shotDirZ;
  const perpZ = ball.shotDirX;

  // Magnus curve into top corners ("rašlje")
  const curveStrength = 20.0;
  ball.vx += perpX * lateralCross * curveStrength * dt;
  ball.vz += perpZ * lateralCross * curveStrength * dt;
  ball.spinZ = lateralCross * 12;

  // Pulling backward adds lob over the goalkeeper!
  if (forwardDot < -0.35) {
    ball.vy += 12.5 * Math.abs(forwardDot) * dt;
    ball.vx *= 1 - 0.55 * dt;
    ball.vz *= 1 - 0.55 * dt;
  } else if (forwardDot > 0.45) {
    // Pushing forward dips / drives the shot low
    ball.vy -= 7.0 * forwardDot * dt;
  }
}

function checkFoulAndApplyCard(
  state: GameState,
  tackler: PlayerEntityState,
  victim: PlayerEntityState
): void {
  const dims = PITCH_DIMENSIONS[state.config.mode];
  // Check if tackle is from behind: tackler facing similar direction as victim
  const fromBehind =
    tackler.facingX * victim.facingX + tackler.facingZ * victim.facingZ > 0.32;

  if (state.config.mode === 'arena5v5') {
    // In 5v5, only harsh tackles from behind trigger 20s sin-bin exclusion
    if (!fromBehind) return;
    tackler.sinBinTimer = 20.0;
    tackler.slideTimer = 0;
    victim.stunTimer = 0.7;
    if (tackler.team === 'home') state.stats.homeFouls += 1;
    else state.stats.awayFouls += 1;

    state.pendingSounds.push({ type: 'whistle', kind: 'foul' });
    pushCommentary(state, pickLine(COMMENTARY_LINES.sinBin5v5, state.eventSeq), 'card');

    // Quick free-kick spot
    state.phase = 'setpiece';
    state.phaseTimer = 0.85;
    state.setPiece = {
      kind: 'freekick',
      team: victim.team,
      x: victim.x,
      z: victim.z,
      timer: 0.85,
    };
    state.ball.x = victim.x;
    state.ball.z = victim.z;
    state.ball.y = BALL_RADIUS;
    state.ball.vx = 0;
    state.ball.vy = 0;
    state.ball.vz = 0;
    return;
  }

  // 11v11 mode: referee whistles foul & gives yellow/red card
  if (tackler.team === 'home') state.stats.homeFouls += 1;
  else state.stats.awayFouls += 1;

  victim.stunTimer = 0.85;
  tackler.slideTimer = 0;

  let issuedCard: CardType = 'yellow';
  if (fromBehind && tackler.card === 'yellow') {
    issuedCard = 'red';
  } else if (fromBehind && Math.abs(victim.x) > dims.length * 0.28) {
    // Cynical tackle from behind near box
    issuedCard = tackler.card === 'yellow' ? 'red' : 'yellow';
  } else if (tackler.card === 'yellow') {
    issuedCard = 'red';
  }

  if (issuedCard === 'yellow') {
    tackler.card = 'yellow';
    if (tackler.team === 'home') state.stats.homeYellowCards += 1;
    else state.stats.awayYellowCards += 1;
    pushCommentary(state, pickLine(COMMENTARY_LINES.yellowCard, state.eventSeq), 'card');
  } else {
    tackler.card = 'red';
    tackler.sinBinTimer = 9999;
    if (tackler.team === 'home') state.stats.homeRedCards += 1;
    else state.stats.awayRedCards += 1;
    pushCommentary(state, pickLine(COMMENTARY_LINES.redCard, state.eventSeq), 'card');
  }

  if (state.referee) {
    state.referee.shownCard = issuedCard;
    state.referee.cardAnimTimer = 1.6;
  }
  state.pendingSounds.push({ type: 'whistle', kind: 'foul' });

  // Check if inside penalty box of tackler's team
  const defendingGoalX = tackler.team === 'home' ? -dims.length * 0.5 : dims.length * 0.5;
  const inPenaltyBox =
    Math.abs(victim.x - defendingGoalX) <= dims.penaltyBoxDepth &&
    Math.abs(victim.z) <= dims.penaltyBoxWidth * 0.5;

  const spotX = inPenaltyBox
    ? defendingGoalX + (tackler.team === 'home' ? 7.5 : -7.5)
    : victim.x;
  const spotZ = inPenaltyBox ? 0 : victim.z;

  state.phase = 'setpiece';
  state.phaseTimer = 1.0;
  state.setPiece = {
    kind: inPenaltyBox ? 'penalty' : 'freekick',
    team: victim.team,
    x: spotX,
    z: spotZ,
    timer: 1.0,
  };
  state.ball.x = spotX;
  state.ball.z = spotZ;
  state.ball.y = BALL_RADIUS;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.ball.vz = 0;
}

function updateGoalkeeperAI(
  state: GameState,
  gk: PlayerEntityState,
  dt: number
): void {
  const dims = PITCH_DIMENSIONS[state.config.mode];
  const goalX = gk.team === 'home' ? -dims.length * 0.5 : dims.length * 0.5;
  const advanceSign = gk.team === 'home' ? 1 : -1;
  const ball = state.ball;

  if (gk.diveTimer > 0) {
    gk.diveTimer = Math.max(0, gk.diveTimer - dt);
    gk.z += gk.diveDirZ * 6.5 * dt;
    gk.z = Math.max(-dims.goalWidth * 0.55, Math.min(dims.goalWidth * 0.55, gk.z));
    return;
  }

  const targetX = goalX + advanceSign * 1.15;
  const clampedBallZ = Math.max(
    -dims.goalWidth * 0.48,
    Math.min(dims.goalWidth * 0.48, ball.z)
  );

  // Trigger dive if fast shot is coming close
  const ballApproachingGoal =
    (goalX - ball.x) * ball.vx > 0 && Math.abs(ball.x - goalX) < 11.0;
  const ballSpeed = Math.hypot(ball.vx, ball.vz);

  if (ballApproachingGoal && ballSpeed > 11.0 && Math.abs(ball.x - gk.x) < 4.5) {
    const dz = ball.z - gk.z;
    if (Math.abs(dz) > 0.6 && Math.abs(dz) < dims.goalWidth * 0.65) {
      gk.diveTimer = 0.42;
      gk.diveDirZ = Math.sign(dz);
    }
  }

  const dx = targetX - gk.x;
  const dz = clampedBallZ - gk.z;
  const dist = Math.hypot(dx, dz);
  const gkSpeed = state.config.mode === 'arena5v5' ? 6.2 : 6.8;

  if (dist > 0.1) {
    const step = Math.min(dist, gkSpeed * dt);
    gk.vx = (dx / dist) * (step / dt);
    gk.vz = (dz / dist) * (step / dt);
    gk.x += (dx / dist) * step;
    gk.z += (dz / dist) * step;
    gk.gaitPhase += step * 2.4;
  } else {
    gk.vx = 0;
    gk.vz = 0;
  }
  gk.facingX = advanceSign;
  gk.facingZ = 0;

  // GK clears/passes ball if it touches him
  const ballDist = Math.hypot(ball.x - gk.x, ball.z - gk.z);
  if (ballDist < PLAYER_RADIUS + BALL_RADIUS + 0.35 && ball.y < dims.goalHeight + 0.2 && gk.kickCooldown <= 0) {
    const targetMate = findPassTarget(state, gk);
    if (targetMate) {
      executeKick(state, gk, targetMate.x - gk.x, targetMate.z - gk.z, 0.55, true);
    } else {
      executeKick(state, gk, advanceSign, (gk.z > 0 ? -0.35 : 0.35), 0.72, false);
    }
    state.cameraTrauma = Math.min(1, state.cameraTrauma + 0.15);
  }
}

function computeAIInput(
  state: GameState,
  player: PlayerEntityState,
  isPrimaryPresser: boolean
): PlayerInputState {
  const input = createEmptyInput();
  const dims = PITCH_DIMENSIONS[state.config.mode];
  const ball = state.ball;
  const attackSign = player.team === 'home' ? 1 : -1;
  const oppGoalX = attackSign * dims.length * 0.5;
  const distToBall = Math.hypot(ball.x - player.x, ball.z - player.z);

  if (player.stunTimer > 0 || player.slideTimer > 0) {
    return input;
  }

  // If this AI player is right on the ball, decide dribble / pass / shoot
  if (distToBall < 1.05 && ball.y < 1.1 && player.kickCooldown <= 0) {
    const distToGoal = Math.hypot(oppGoalX - player.x, 0 - player.z);
    if (distToGoal < (state.config.mode === 'arena5v5' ? 13 : 19)) {
      // Aim toward corners of goal
      const aimZ = player.z > 0 ? -dims.goalWidth * 0.28 : dims.goalWidth * 0.28;
      const dx = oppGoalX - player.x;
      const dz = aimZ - player.z;
      const len = Math.hypot(dx, dz) || 1;
      input.moveX = dx / len;
      input.moveZ = dz / len;
      input.shootJustReleased = true;
      return input;
    }

    // Check if an opponent is pressing closely -> pass to open teammate
    let closeOpponent = false;
    for (const other of state.players) {
      if (other.team !== player.team && isPlayerAvailable(other)) {
        if (Math.hypot(other.x - player.x, other.z - player.z) < 2.4) {
          closeOpponent = true;
          break;
        }
      }
    }
    if (closeOpponent) {
      const mate = findPassTarget(state, player);
      if (mate) {
        const dx = mate.x - player.x;
        const dz = mate.z - player.z;
        const len = Math.hypot(dx, dz) || 1;
        input.moveX = dx / len;
        input.moveZ = dz / len;
        input.passJustPressed = true;
        return input;
      }
    }

    // Dribble toward opponent goal with slight lateral weave
    const dx = oppGoalX - player.x;
    const dz = -player.z * 0.25;
    const len = Math.hypot(dx, dz) || 1;
    input.moveX = dx / len;
    input.moveZ = dz / len;
    return input;
  }

  if (isPrimaryPresser) {
    // Pursue ball (anticipate slightly)
    const targetX = ball.x + ball.vx * 0.14;
    const targetZ = ball.z + ball.vz * 0.14;
    const dx = targetX - player.x;
    const dz = targetZ - player.z;
    const len = Math.hypot(dx, dz) || 1;
    input.moveX = dx / len;
    input.moveZ = dz / len;

    // Occasional clean tackle if opponent has ball close in front
    if (
      distToBall < 1.95 &&
      state.possessionTeam &&
      state.possessionTeam !== player.team &&
      player.slideCooldown <= 0 &&
      Math.abs(ball.x) < dims.length * 0.42
    ) {
      // Only tackle cleanly from front/side most of the time
      const ballOwner = state.players.find((o) => o.id === ball.lastTouchPlayerId);
      if (ballOwner) {
        const dot = player.facingX * ballOwner.facingX + player.facingZ * ballOwner.facingZ;
        if (dot < 0.15 && ((state.eventSeq + player.number) % 7 === 0)) {
          input.tackleJustPressed = true;
        }
      }
    }
    return input;
  }

  // Otherwise hold formation anchor shifted dynamically with ball position
  const ballShiftX = (ball.x / (dims.length * 0.5)) * (dims.length * 0.24);
  const ballShiftZ = (ball.z / (dims.width * 0.5)) * (dims.width * 0.14);
  const anchorX = Math.max(
    -dims.length * 0.46,
    Math.min(dims.length * 0.46, player.homeX + ballShiftX)
  );
  const anchorZ = Math.max(
    -dims.width * 0.45,
    Math.min(dims.width * 0.45, player.homeZ + ballShiftZ)
  );
  const dx = anchorX - player.x;
  const dz = anchorZ - player.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 0.75) {
    input.moveX = dx / dist;
    input.moveZ = dz / dist;
  }
  return input;
}

function updatePlayerMovementAndActions(
  state: GameState,
  player: PlayerEntityState,
  input: PlayerInputState,
  isHumanControlled: boolean,
  dt: number
): void {
  const dims = PITCH_DIMENSIONS[state.config.mode];
  const ball = state.ball;

  player.slideCooldown = Math.max(0, player.slideCooldown - dt);
  player.kickCooldown = Math.max(0, player.kickCooldown - dt);
  player.kickAnimTimer = Math.max(0, player.kickAnimTimer - dt);
  player.stunTimer = Math.max(0, player.stunTimer - dt);

  if (player.stunTimer > 0) {
    player.vx *= Math.max(0, 1 - 6 * dt);
    player.vz *= Math.max(0, 1 - 6 * dt);
    player.x += player.vx * dt;
    player.z += player.vz * dt;
    return;
  }

  // Handle slide tackle activation
  if (input.tackleJustPressed && player.slideCooldown <= 0 && player.slideTimer <= 0) {
    const inX = Math.abs(input.moveX) + Math.abs(input.moveZ) > 0.1 ? input.moveX : player.facingX;
    const inZ = Math.abs(input.moveX) + Math.abs(input.moveZ) > 0.1 ? input.moveZ : player.facingZ;
    const len = Math.hypot(inX, inZ) || 1;
    player.facingX = inX / len;
    player.facingZ = inZ / len;
    player.vx = player.facingX * 11.8;
    player.vz = player.facingZ * 11.8;
    player.slideTimer = 0.38;
    player.slideCooldown = 0.95;
    const muddy = isPointInMud(state, player.x, player.z);
    state.pendingSounds.push({ type: 'tackle', muddy });
  }

  if (player.slideTimer > 0) {
    player.slideTimer = Math.max(0, player.slideTimer - dt);
    const drag = isPointInMud(state, player.x, player.z) ? 4.8 : 2.9;
    player.vx *= Math.max(0, 1 - drag * dt);
    player.vz *= Math.max(0, 1 - drag * dt);
    player.x += player.vx * dt;
    player.z += player.vz * dt;

    // Check ball poke during slide
    const bDist = Math.hypot(ball.x - player.x, ball.z - player.z);
    if (bDist < PLAYER_RADIUS + BALL_RADIUS + 0.16 && ball.y < 0.75 && player.kickCooldown <= 0) {
      ball.vx = player.facingX * 11.0;
      ball.vz = player.facingZ * 11.0;
      ball.vy = 1.1;
      ball.lastTouchTeam = player.team;
      ball.lastTouchPlayerId = player.id;
      player.kickCooldown = 0.35;
      state.pendingSounds.push({ type: 'pass' });
    } else {
      // Check opponent foul collision if we didn't win the ball
      for (const other of state.players) {
        if (other.team === player.team || !isPlayerAvailable(other) || other.stunTimer > 0) continue;
        const pDist = Math.hypot(other.x - player.x, other.z - player.z);
        if (pDist < PLAYER_RADIUS * 2.15) {
          const oppNearBall = Math.hypot(ball.x - other.x, ball.z - other.z) < 2.2;
          if (oppNearBall || pDist < PLAYER_RADIUS * 1.75) {
            checkFoulAndApplyCard(state, player, other);
            break;
          }
        }
      }
    }
  } else {
    // Standard sprint / run movement
    const inMud = isPointInMud(state, player.x, player.z);
    const baseSpeed = state.config.mode === 'arena5v5' ? 7.9 : 7.4;
    const speedLimit = baseSpeed * (inMud ? 0.7 : 1.0) * (isHumanControlled ? 1.04 : 0.96);

    const mag = Math.hypot(input.moveX, input.moveZ);
    if (mag > 0.08) {
      const dirX = input.moveX / Math.max(1, mag);
      const dirZ = input.moveZ / Math.max(1, mag);
      const accel = 36.0;
      player.vx += (dirX * speedLimit - player.vx) * Math.min(1, accel * dt * 0.25);
      player.vz += (dirZ * speedLimit - player.vz) * Math.min(1, accel * dt * 0.25);
      player.facingX = dirX;
      player.facingZ = dirZ;
    } else {
      const decel = 12.0;
      player.vx *= Math.max(0, 1 - decel * dt);
      player.vz *= Math.max(0, 1 - decel * dt);
    }

    player.x += player.vx * dt;
    player.z += player.vz * dt;
    const movedDist = Math.hypot(player.vx, player.vz) * dt;
    player.gaitPhase += movedDist * 2.6;
  }

  // Clamp players inside stadium apron
  const maxX = dims.length * 0.5 + 2.0;
  const maxZ = dims.width * 0.5 + 2.0;
  player.x = Math.max(-maxX, Math.min(maxX, player.x));
  player.z = Math.max(-maxZ, Math.min(maxZ, player.z));

  // Shot & pass interactions with ball
  const distToBall = Math.hypot(ball.x - player.x, ball.z - player.z);
  const canReachBall = distToBall <= 1.18 && ball.y < 1.25 && player.kickCooldown <= 0;

  if (isHumanControlled) {
    if (input.shootHeld) {
      state.isChargingShot = true;
      state.shotCharge = Math.min(1, state.shotCharge + dt / 0.55);
    }
    if (input.shootJustReleased) {
      const power = Math.max(0.28, state.shotCharge);
      state.isChargingShot = false;
      state.shotCharge = 0;
      if (canReachBall) {
        executeKick(state, player, player.facingX, player.facingZ, power, false);
        return;
      }
    }
    if (input.passJustPressed) {
      if (canReachBall) {
        const mate = findPassTarget(state, player);
        if (mate) {
          executeKick(state, player, mate.x - player.x, mate.z - player.z, 0.5, true);
        } else {
          executeKick(state, player, player.facingX, player.facingZ, 0.45, true);
        }
        return;
      } else {
        // Switch active home player to closest to ball!
        const nextActive = findClosestOutfieldPlayer(
          state,
          'home',
          ball.x,
          ball.z,
          player.id
        );
        if (nextActive) {
          state.activeHomePlayerId = nextActive.id;
        }
      }
    }
  } else {
    // AI kick/pass triggers
    if (canReachBall && input.shootJustReleased) {
      executeKick(state, player, input.moveX || player.facingX, input.moveZ || player.facingZ, 0.72, false);
      return;
    }
    if (canReachBall && input.passJustPressed) {
      executeKick(state, player, input.moveX || player.facingX, input.moveZ || player.facingZ, 0.5, true);
      return;
    }
  }

  // Authentic Kick Off Dribbling: ball is pushed in front of running player, NEVER glued!
  const touchDist = PLAYER_RADIUS + BALL_RADIUS + 0.14;
  if (distToBall < touchDist && ball.y < 0.78 && player.kickCooldown <= 0 && player.slideTimer <= 0) {
    const playerSpeed = Math.hypot(player.vx, player.vz);
    if (playerSpeed > 0.35) {
      // Nudge ball forward along player's facing direction + inertia blend
      const pushSpeed = Math.max(3.6, playerSpeed * 1.24);
      ball.vx = player.facingX * pushSpeed;
      ball.vz = player.facingZ * pushSpeed;
      ball.vy = Math.max(ball.vy, 0.18);
      // Place ball just clear of player collision radius
      ball.x = player.x + player.facingX * (touchDist + 0.04);
      ball.z = player.z + player.facingZ * (touchDist + 0.04);
      ball.aftertouchTimer = 0;
      ball.aftertouchTeam = null;
      ball.lastTouchTeam = player.team;
      ball.lastTouchPlayerId = player.id;
      player.kickCooldown = 0.11; // short touch cadence so ball bounces organically ahead
    } else {
      // Gentle separation when standing still
      const sepX = (ball.x - player.x) / (distToBall || 1);
      const sepZ = (ball.z - player.z) / (distToBall || 1);
      ball.x = player.x + sepX * (touchDist + 0.02);
      ball.z = player.z + sepZ * (touchDist + 0.02);
      ball.vx += sepX * 1.2;
      ball.vz += sepZ * 1.2;
    }
  }
}

function updateBallPhysicsAndBoundaries(
  state: GameState,
  humanInput: PlayerInputState,
  remoteAwayInput: PlayerInputState | undefined,
  dt: number
): void {
  const dims = PITCH_DIMENSIONS[state.config.mode];
  const halfLen = dims.length * 0.5;
  const halfWid = dims.width * 0.5;
  const halfGoalW = dims.goalWidth * 0.5;
  const ball = state.ball;

  ball.postHitCooldown = Math.max(0, ball.postHitCooldown - dt);

  // Apply Aftertouch if within 350ms window after kick
  if (ball.aftertouchTimer > 0 && ball.aftertouchTeam) {
    const activeInput =
      ball.aftertouchTeam === 'home'
        ? humanInput
        : remoteAwayInput ?? createEmptyInput();
    applyAftertouch(ball, activeInput, dt);
  }

  // Gravity & vertical motion
  ball.vy -= GRAVITY * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.z += ball.vz * dt;

  const inMud = isPointInMud(state, ball.x, ball.z);

  // Ground bounce & rolling friction
  if (ball.y <= BALL_RADIUS) {
    ball.y = BALL_RADIUS;
    if (ball.vy < -1.1) {
      const restitution = inMud ? 0.30 : 0.62;
      ball.vy = -ball.vy * restitution;
      if (inMud && Math.hypot(ball.vx, ball.vz) > 4) {
        // Mud slows ball on impact
        ball.vx *= 0.72;
        ball.vz *= 0.72;
      }
    } else {
      ball.vy = 0;
    }

    const friction = state.config.surface === 'mud' ? (inMud ? 3.8 : 2.25) : 1.45;
    const damp = Math.max(0, 1 - friction * dt);
    ball.vx *= damp;
    ball.vz *= damp;
  } else {
    // Subtle air drag
    const airDrag = Math.max(0, 1 - 0.18 * dt);
    ball.vx *= airDrag;
    ball.vz *= airDrag;
  }

  // Update spin visual decay
  ball.spinX *= Math.max(0, 1 - 2.5 * dt);
  ball.spinZ *= Math.max(0, 1 - 2.5 * dt);

  // Goalpost & Crossbar collisions (left goal -halfLen, right goal +halfLen)
  const posts = [
    { x: -halfLen, z: -halfGoalW },
    { x: -halfLen, z: halfGoalW },
    { x: halfLen, z: -halfGoalW },
    { x: halfLen, z: halfGoalW },
  ];
  const postRadius = 0.14;
  for (const post of posts) {
    if (ball.y <= dims.goalHeight + postRadius) {
      const dx = ball.x - post.x;
      const dz = ball.z - post.z;
      const d = Math.hypot(dx, dz);
      const minDist = BALL_RADIUS + postRadius;
      if (d < minDist && d > 0.0001) {
        const nx = dx / d;
        const nz = dz / d;
        ball.x = post.x + nx * minDist;
        ball.z = post.z + nz * minDist;
        const vn = ball.vx * nx + ball.vz * nz;
        if (vn < 0) {
          ball.vx -= 1.85 * vn * nx;
          ball.vz -= 1.85 * vn * nz;
          if (ball.postHitCooldown <= 0) {
            ball.postHitCooldown = 0.4;
            state.pendingSounds.push({ type: 'post' });
            state.pendingSounds.push({ type: 'crowd_ooh' });
            state.cameraTrauma = Math.min(1, state.cameraTrauma + 0.45);
            pushCommentary(state, pickLine(COMMENTARY_LINES.woodwork, state.eventSeq), 'woodwork');
          }
        }
      }
    }
  }

  // Crossbar check at -halfLen and +halfLen
  for (const goalX of [-halfLen, halfLen]) {
    if (Math.abs(ball.z) <= halfGoalW + BALL_RADIUS) {
      const dx = ball.x - goalX;
      const dy = ball.y - dims.goalHeight;
      const d = Math.hypot(dx, dy);
      const minDist = BALL_RADIUS + postRadius;
      if (d < minDist && d > 0.0001) {
        const nx = dx / d;
        const ny = dy / d;
        ball.x = goalX + nx * minDist;
        ball.y = dims.goalHeight + ny * minDist;
        const vn = ball.vx * nx + ball.vy * ny;
        if (vn < 0) {
          ball.vx -= 1.85 * vn * nx;
          ball.vy -= 1.85 * vn * ny;
          if (ball.postHitCooldown <= 0) {
            ball.postHitCooldown = 0.4;
            state.pendingSounds.push({ type: 'post' });
            state.pendingSounds.push({ type: 'crowd_ooh' });
            state.cameraTrauma = Math.min(1, state.cameraTrauma + 0.5);
            pushCommentary(state, pickLine(COMMENTARY_LINES.woodwork, state.eventSeq), 'woodwork');
          }
        }
      }
    }
  }

  // Goal detection!
  const inGoalMouthZ = Math.abs(ball.z) < halfGoalW - BALL_RADIUS * 0.35;
  const underCrossbar = ball.y < dims.goalHeight - BALL_RADIUS * 0.25;

  if (inGoalMouthZ && underCrossbar && Math.abs(ball.x) > halfLen + BALL_RADIUS * 0.8) {
    const scoringTeam: TeamSide = ball.x > 0 ? 'home' : 'away';
    if (scoringTeam === 'home') state.homeScore += 1;
    else state.awayScore += 1;

    const scorer = state.players.find((p) => p.id === ball.lastTouchPlayerId);
    state.lastScoringTeam = scoringTeam;
    state.lastScorerName = scorer ? `${scorer.name} (#${scorer.number})` : null;
    state.phase = 'goal';
    state.phaseTimer = 2.2;
    state.cameraTrauma = Math.min(1, state.cameraTrauma + 0.65);
    state.pendingSounds.push({ type: 'goal' });
    state.pendingSounds.push({ type: 'whistle', kind: 'kickoff' });

    const lines = scoringTeam === 'home' ? COMMENTARY_LINES.goalHome : COMMENTARY_LINES.goalAway;
    pushCommentary(state, pickLine(lines, state.eventSeq), 'goal');

    // Clamp ball inside goal net
    const goalBackX = Math.sign(ball.x) * (halfLen + dims.goalDepth - BALL_RADIUS);
    if (Math.abs(ball.x) > Math.abs(goalBackX)) {
      ball.x = goalBackX;
      ball.vx *= -0.25;
      ball.vz *= 0.3;
    }
    return;
  }

  // Side & end boundaries
  if (state.config.mode === 'arena5v5') {
    // Fast cushioned perimeter bounce in 5v5 Arena
    if (ball.z > halfWid - BALL_RADIUS) {
      ball.z = halfWid - BALL_RADIUS;
      ball.vz = -Math.abs(ball.vz) * 0.82;
    } else if (ball.z < -halfWid + BALL_RADIUS) {
      ball.z = -halfWid + BALL_RADIUS;
      ball.vz = Math.abs(ball.vz) * 0.82;
    }

    if (Math.abs(ball.x) > halfLen - BALL_RADIUS && !inGoalMouthZ) {
      ball.x = Math.sign(ball.x) * (halfLen - BALL_RADIUS);
      ball.vx = -ball.vx * 0.82;
      if (Math.abs(ball.z) < halfGoalW + 2.4 && Math.abs(ball.vx) > 7) {
        state.pendingSounds.push({ type: 'crowd_ooh' });
        pushCommentary(state, pickLine(COMMENTARY_LINES.missedSitter, state.eventSeq), 'hype');
      }
    }
  } else {
    // 11v11 Classic rules: Aut (Throw-in), Korner, Gol-aut
    if (Math.abs(ball.z) > halfWid + BALL_RADIUS) {
      const throwTeam: TeamSide = ball.lastTouchTeam === 'home' ? 'away' : 'home';
      const clampedX = Math.max(-halfLen + 1, Math.min(halfLen - 1, ball.x));
      const edgeZ = Math.sign(ball.z) * (halfWid - 0.3);
      state.phase = 'setpiece';
      state.phaseTimer = 0.75;
      state.setPiece = {
        kind: 'throwin',
        team: throwTeam,
        x: clampedX,
        z: edgeZ,
        timer: 0.75,
      };
      ball.x = clampedX;
      ball.z = edgeZ;
      ball.y = BALL_RADIUS;
      ball.vx = 0;
      ball.vy = 0;
      ball.vz = 0;
      state.pendingSounds.push({ type: 'whistle', kind: 'foul' });
      pushCommentary(state, pickLine(COMMENTARY_LINES.throwIn, state.eventSeq), 'neutral');
      return;
    }

    if (Math.abs(ball.x) > halfLen + BALL_RADIUS && !inGoalMouthZ) {
      const defendingTeam: TeamSide = ball.x > 0 ? 'away' : 'home';
      const attackingTeam: TeamSide = defendingTeam === 'home' ? 'away' : 'home';

      if (Math.abs(ball.z) < halfGoalW + 3.0 && Math.hypot(ball.vx, ball.vz) > 10) {
        state.pendingSounds.push({ type: 'crowd_ooh' });
        pushCommentary(state, pickLine(COMMENTARY_LINES.missedSitter, state.eventSeq), 'hype');
      }

      if (ball.lastTouchTeam === defendingTeam) {
        // Corner kick
        const cornerX = Math.sign(ball.x) * (halfLen - 0.6);
        const cornerZ = Math.sign(ball.z || 1) * (halfWid - 0.6);
        state.phase = 'setpiece';
        state.phaseTimer = 0.85;
        state.setPiece = {
          kind: 'corner',
          team: attackingTeam,
          x: cornerX,
          z: cornerZ,
          timer: 0.85,
        };
        ball.x = cornerX;
        ball.z = cornerZ;
        ball.y = BALL_RADIUS;
        ball.vx = 0;
        ball.vy = 0;
        ball.vz = 0;
        state.pendingSounds.push({ type: 'whistle', kind: 'foul' });
        pushCommentary(state, pickLine(COMMENTARY_LINES.corner, state.eventSeq), 'hype');
      } else {
        // Goal kick
        const gkX = Math.sign(ball.x) * (halfLen - 4.2);
        const gkZ = Math.sign(ball.z || 1) * 2.5;
        state.phase = 'setpiece';
        state.phaseTimer = 0.8;
        state.setPiece = {
          kind: 'goalkick',
          team: defendingTeam,
          x: gkX,
          z: gkZ,
          timer: 0.8,
        };
        ball.x = gkX;
        ball.z = gkZ;
        ball.y = BALL_RADIUS;
        ball.vx = 0;
        ball.vy = 0;
        ball.vz = 0;
        state.pendingSounds.push({ type: 'whistle', kind: 'foul' });
        pushCommentary(state, pickLine(COMMENTARY_LINES.goalKick, state.eventSeq), 'neutral');
      }
    }
  }
}

function updateReferee(state: GameState, dt: number): void {
  const ref = state.referee;
  if (!ref) return;
  ref.cardAnimTimer = Math.max(0, ref.cardAnimTimer - dt);
  if (ref.cardAnimTimer === 0) ref.shownCard = 'none';

  // Keep referee near play without getting in the direct ball path
  const targetX = state.ball.x * 0.72;
  const targetZ = state.ball.z > 0 ? state.ball.z - 5.5 : state.ball.z + 5.5;
  const dx = targetX - ref.x;
  const dz = targetZ - ref.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 0.5) {
    const speed = Math.min(6.4, dist * 1.6);
    ref.vx = (dx / dist) * speed;
    ref.vz = (dz / dist) * speed;
    ref.x += ref.vx * dt;
    ref.z += ref.vz * dt;
    ref.facingX = dx / dist;
    ref.facingZ = dz / dist;
    ref.gaitPhase += speed * dt * 2.4;
  } else {
    ref.vx = 0;
    ref.vz = 0;
  }
}

export function stepSimulation(
  state: GameState,
  humanInput: PlayerInputState,
  rawDt: number,
  remoteAwayInput?: PlayerInputState
): void {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  state.pendingSounds = [];
  state.cameraTrauma = Math.max(0, state.cameraTrauma - 1.4 * dt);

  if (state.phase === 'title' || state.phase === 'paused' || state.phase === 'halftime' || state.phase === 'gameover') {
    return;
  }

  // Handle kickoff / goal / setpiece transitions
  if (state.phase === 'kickoff') {
    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0) {
      state.phase = 'playing';
      state.phaseTimer = 0;
    }
    return;
  }

  if (state.phase === 'goal') {
    state.phaseTimer -= dt;
    // Let ball settle inside goal net during celebration
    state.ball.x += state.ball.vx * dt * 0.5;
    state.ball.z += state.ball.vz * dt * 0.5;
    state.ball.vx *= Math.max(0, 1 - 5 * dt);
    state.ball.vz *= Math.max(0, 1 - 5 * dt);
    if (state.phaseTimer <= 0) {
      const kickoffTeam: TeamSide = state.lastScoringTeam === 'home' ? 'away' : 'home';
      resetPositionsForKickoff(state, kickoffTeam);
      state.phase = 'kickoff';
      state.phaseTimer = 0.9;
      state.pendingSounds.push({ type: 'whistle', kind: 'kickoff' });
    }
    return;
  }

  if (state.phase === 'setpiece' && state.setPiece) {
    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0) {
      const sp = state.setPiece;
      const taker = findClosestOutfieldPlayer(state, sp.team, sp.x, sp.z);
      if (taker) {
        taker.x = sp.x;
        taker.z = sp.z;
        if (sp.team === 'home') state.activeHomePlayerId = taker.id;
        else state.activeAwayPlayerId = taker.id;

        if (sp.kind === 'throwin' || sp.kind === 'corner' || sp.kind === 'goalkick') {
          const mate = findPassTarget(state, taker);
          const aimX = mate ? mate.x - taker.x : sp.team === 'home' ? 1 : -1;
          const aimZ = mate ? mate.z - taker.z : -Math.sign(sp.z || 1) * 0.4;
          executeKick(
            state,
            taker,
            aimX,
            aimZ,
            sp.kind === 'corner' ? 0.68 : 0.48,
            sp.kind !== 'corner'
          );
        }
      }
      state.setPiece = null;
      state.phase = 'playing';
    }
    return;
  }

  // Active playing phase!
  state.clockSeconds += dt;

  // Sin-bin countdown in 5v5
  for (const p of state.players) {
    if (p.sinBinTimer > 0 && p.card !== 'red') {
      p.sinBinTimer = Math.max(0, p.sinBinTimer - dt);
      if (p.sinBinTimer === 0) {
        p.x = p.homeX;
        p.z = p.homeZ;
        pushCommentary(state, `${p.name} se vraća na teren posle kazne!`, 'neutral');
      }
    }
  }

  // Mud splash commentary cooldown
  if (
    state.config.surface === 'mud' &&
    isPointInMud(state, state.ball.x, state.ball.z) &&
    Math.hypot(state.ball.vx, state.ball.vz) > 9.5 &&
    state.eventSeq % 9 === 0
  ) {
    pushCommentary(state, pickLine(COMMENTARY_LINES.mudSplash, state.eventSeq), 'neutral');
  }

  // Pick closest AI pressers for each team
  const homePresser = findClosestOutfieldPlayer(
    state,
    'home',
    state.ball.x,
    state.ball.z,
    state.activeHomePlayerId
  );
  const awayPresser = findClosestOutfieldPlayer(
    state,
    'away',
    state.ball.x,
    state.ball.z,
    remoteAwayInput ? state.activeAwayPlayerId : undefined
  );

  if (awayPresser && !remoteAwayInput) {
    state.activeAwayPlayerId = awayPresser.id;
  }

  // Update all players
  for (const player of state.players) {
    if (!isPlayerAvailable(player)) continue;

    if (player.role === 'GK') {
      updateGoalkeeperAI(state, player, dt);
      continue;
    }

    const isHuman = player.id === state.activeHomePlayerId;
    const isRemoteAway = Boolean(remoteAwayInput && player.id === state.activeAwayPlayerId);

    let input: PlayerInputState;
    if (isHuman) {
      input = humanInput;
    } else if (isRemoteAway && remoteAwayInput) {
      input = remoteAwayInput;
    } else {
      const isPresser =
        (player.team === 'home' && homePresser?.id === player.id) ||
        (player.team === 'away' && awayPresser?.id === player.id);
      input = computeAIInput(state, player, isPresser);
    }

    updatePlayerMovementAndActions(state, player, input, isHuman, dt);
  }

  // Player-to-player soft separation
  for (let i = 0; i < state.players.length; i++) {
    const a = state.players[i];
    if (!isPlayerAvailable(a)) continue;
    for (let j = i + 1; j < state.players.length; j++) {
      const b = state.players[j];
      if (!isPlayerAvailable(b)) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const minDist = PLAYER_RADIUS * 2;
      if (d < minDist && d > 0.001) {
        const push = (minDist - d) * 0.5;
        const nx = dx / d;
        const nz = dz / d;
        a.x -= nx * push;
        a.z -= nz * push;
        b.x += nx * push;
        b.z += nz * push;
      }
    }
  }

  // Update ball physics & goals/boundaries
  updateBallPhysicsAndBoundaries(state, humanInput, remoteAwayInput, dt);
  updateReferee(state, dt);

  // Track possession by closest outfield player team within 4m
  let closestTeam: TeamSide | null = state.ball.lastTouchTeam;
  let closestD = 4.0;
  for (const p of state.players) {
    if (!isPlayerAvailable(p)) continue;
    const d = Math.hypot(p.x - state.ball.x, p.z - state.ball.z);
    if (d < closestD) {
      closestD = d;
      closestTeam = p.team;
    }
  }
  state.possessionTeam = closestTeam;
  if (closestTeam === 'home') state.stats.homePossessionTime += dt;
  else if (closestTeam === 'away') state.stats.awayPossessionTime += dt;

  // Check Half-Time & Full-Time
  const halfEnd = state.half * state.config.halfDurationSeconds;
  if (state.clockSeconds >= halfEnd && state.phase === 'playing') {
    state.clockSeconds = halfEnd;
    state.isChargingShot = false;
    state.shotCharge = 0;
    if (state.half === 1) {
      state.phase = 'halftime';
      state.pendingSounds.push({ type: 'whistle', kind: 'fulltime' });
      pushCommentary(state, pickLine(COMMENTARY_LINES.halftime, state.eventSeq), 'neutral');
    } else {
      state.phase = 'gameover';
      state.pendingSounds.push({ type: 'whistle', kind: 'fulltime' });
      pushCommentary(state, pickLine(COMMENTARY_LINES.fulltime, state.eventSeq), 'hype');
    }
  }
}
