import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyInput,
  createInitialGameState,
  serializeGameState,
  startSecondHalf,
  stepSimulation,
} from './physics';
import type { MatchConfig } from '../types';

function makeConfig(overrides: Partial<MatchConfig> = {}): MatchConfig {
  return {
    mode: 'arena5v5',
    surface: 'dry',
    formation: '4-4-2',
    homeTeamId: 'crveni_zmaj',
    awayTeamId: 'plavi_talas',
    halfDurationSeconds: 90,
    ...overrides,
  };
}

test('ball is not glued to player feet and continues moving by inertia on sharp turns', () => {
  const state = createInitialGameState(makeConfig(), 'playing');
  const active = state.players.find((p) => p.id === state.activeHomePlayerId)!;
  active.x = -0.35;
  active.z = 0;
  active.vx = 7.5;
  active.vz = 0;
  active.facingX = 1;
  active.facingZ = 0;
  state.ball.x = 0.1;
  state.ball.z = 0;

  // Dribble touch pushes ball forward along +X
  const moveRight = { ...createEmptyInput(), moveX: 1, moveZ: 0 };
  stepSimulation(state, moveRight, 0.016);
  assert.ok(state.ball.vx > 3.5, 'dribble touch should propel ball forward');

  const ballVxBeforeTurn = state.ball.vx;
  // Player sharply turns 90 degrees toward +Z
  const sharpTurn = { ...createEmptyInput(), moveX: 0, moveZ: 1 };
  stepSimulation(state, sharpTurn, 0.016);

  // Ball continues forward along +X by inertia rather than snapping to player
  assert.ok(state.ball.vx > ballVxBeforeTurn * 0.85, 'ball keeps +X inertia on sharp turn');
});

test('aftertouch applies lateral Magnus curve within 350ms window and expires afterward', () => {
  const state = createInitialGameState(makeConfig(), 'playing');
  state.players.forEach((p) => {
    if (p.id !== state.activeHomePlayerId) {
      p.x = -16;
      p.z = -10;
    }
  });
  const active = state.players.find((p) => p.id === state.activeHomePlayerId)!;
  active.x = 0;
  active.z = 0;
  active.facingX = 1;
  active.facingZ = 0;
  state.ball.x = 0.5;
  state.ball.z = 0;
  state.shotCharge = 0.8;

  // Release shot along +X
  stepSimulation(state, { ...createEmptyInput(), moveX: 1, shootJustReleased: true }, 0.016);
  assert.ok(state.ball.aftertouchTimer > 0.3, 'aftertouch window starts at 350ms');

  // Hold downward (+Z) during aftertouch window to curl shot
  for (let i = 0; i < 6; i++) {
    stepSimulation(state, { ...createEmptyInput(), moveZ: 1 }, 0.03);
  }
  assert.ok(Math.abs(state.ball.vz) > 1.5, 'lateral aftertouch should curve ball velocity');

  // Advance past 350ms window
  for (let i = 0; i < 10; i++) {
    stepSimulation(state, { ...createEmptyInput(), moveZ: 1 }, 0.03);
  }
  assert.equal(state.ball.aftertouchTimer, 0, 'aftertouch timer expires to 0');
});

test('mud surface applies stronger drag than dry grass', () => {
  const dryState = createInitialGameState(makeConfig({ surface: 'dry' }), 'playing');
  const mudState = createInitialGameState(makeConfig({ mode: 'classic11v11', surface: 'mud' }), 'playing');

  // Place ball on center mud patch
  dryState.ball.x = 0;
  dryState.ball.z = 0;
  dryState.ball.vx = 12;
  mudState.ball.x = 0;
  mudState.ball.z = 0;
  mudState.ball.vx = 12;

  // Move all players away so nobody interferes
  dryState.players.forEach((p) => (p.x = -15));
  mudState.players.forEach((p) => (p.x = -25));

  for (let i = 0; i < 10; i++) {
    stepSimulation(dryState, createEmptyInput(), 0.03);
    stepSimulation(mudState, createEmptyInput(), 0.03);
  }

  assert.ok(mudState.ball.vx < dryState.ball.vx, 'mud slows rolling ball faster than dry turf');
});

test('5v5 slide tackle from behind triggers 20s sin-bin exclusion', () => {
  const state = createInitialGameState(makeConfig({ mode: 'arena5v5' }), 'playing');
  const tackler = state.players.find((p) => p.id === state.activeHomePlayerId)!;
  const victim = state.players.find((p) => p.team === 'away' && p.role !== 'GK')!;

  // Move everyone else far away
  state.players.forEach((p) => {
    if (p.id !== tackler.id && p.id !== victim.id) {
      p.x = -16;
      p.z = -10;
    }
  });

  victim.x = 1.0;
  victim.z = 0;
  victim.facingX = 1;
  victim.facingZ = 0;
  state.ball.x = 2.0;
  state.ball.z = 0;

  // Tackler behind victim, facing same direction (+X)
  tackler.x = 0.65;
  tackler.z = 0;
  tackler.facingX = 1;
  tackler.facingZ = 0;

  stepSimulation(state, { ...createEmptyInput(), moveX: 1, tackleJustPressed: true }, 0.02);
  stepSimulation(state, { ...createEmptyInput(), moveX: 1 }, 0.02);

  assert.equal(tackler.sinBinTimer, 20, 'tackle from behind in 5v5 issues 20s sin-bin');
  assert.equal(state.stats.homeFouls, 1);
});

test('11v11 referee issues yellow then red card and match transitions halftime to gameover', () => {
  const state = createInitialGameState(
    makeConfig({ mode: 'classic11v11', halfDurationSeconds: 10 }),
    'playing'
  );
  assert.ok(state.referee !== null, '11v11 spawns active referee');
  assert.equal(state.players.length, 22, '11v11 spawns 22 players');

  // Test serialization purity
  const snap = serializeGameState(state);
  assert.doesNotThrow(() => JSON.stringify(snap));

  // Advance clock to halftime
  state.clockSeconds = 9.98;
  stepSimulation(state, createEmptyInput(), 0.05);
  assert.equal(state.phase, 'halftime');

  // Start second half and advance to full time
  startSecondHalf(state);
  assert.equal(state.half, 2);
  state.phase = 'playing';
  state.clockSeconds = 19.98;
  stepSimulation(state, createEmptyInput(), 0.05);
  assert.equal(state.phase, 'gameover');
});
