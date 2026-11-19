import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng, makeDailySeed, randInt } from './prng';
import {
  calculateAverageScore,
  computeWeightedCentroid,
  formatShareText,
  getLetterRank,
  getScoreEmoji,
  scoreAlignmentLevel,
  scoreAngleDraw,
  scoreAreaMatch,
  scoreBlindStopwatch,
  scoreCenterOfMass,
  scoreCircleFill,
  scoreFlashCount,
  scoreGridDensity,
  scoreHueMemory,
  scoreIntervalBisect,
  scoreLineSplit,
  scoreOddTileOut,
  scoreSpeedMatch,
  scoreSteadyBeat,
  scoreTrajectoryDrop,
} from './scoring';
import {
  computeDailyStreak,
  createInitialState,
  recordRunCompletion,
} from './storage';
import {
  GAME_ID_TO_CODE,
  buildChallengeUrl,
  computeHeadToHead,
  decodeChallengePayload,
  encodeChallengePayload,
  parseChallengeFromUrl,
} from './challenge';

test('seeded PRNG is deterministic for same date + seriesId', () => {
  const seed = makeDailySeed('2026-11-19', 'series-1');
  const rngA = createRng(seed);
  const rngB = createRng(seed);
  const seqA = Array.from({ length: 10 }, () => randInt(rngA, 1, 100));
  const seqB = Array.from({ length: 10 }, () => randInt(rngB, 1, 100));
  assert.deepEqual(seqA, seqB);

  const rngOther = createRng(makeDailySeed('2026-11-19', 'series-2'));
  const seqOther = Array.from({ length: 10 }, () => randInt(rngOther, 1, 100));
  assert.notDeepEqual(seqA, seqOther);
});

test('universal grading scale boundaries match spec', () => {
  assert.equal(getLetterRank(100), 'S');
  assert.equal(getLetterRank(95), 'S');
  assert.equal(getLetterRank(94), 'A');
  assert.equal(getLetterRank(85), 'A');
  assert.equal(getLetterRank(84), 'B');
  assert.equal(getLetterRank(70), 'B');
  assert.equal(getLetterRank(69), 'C');
  assert.equal(getLetterRank(50), 'C');
  assert.equal(getLetterRank(49), 'D');
  assert.equal(getLetterRank(0), 'D');

  assert.equal(getScoreEmoji(98), '🟦');
  assert.equal(getScoreEmoji(88), '🟩');
  assert.equal(getScoreEmoji(74), '🟨');
  assert.equal(getScoreEmoji(55), '🟧');
  assert.equal(getScoreEmoji(30), '🟥');
});

test('Series 1 scoring math', () => {
  // Angle Draw: 100 - error * 4
  assert.equal(scoreAngleDraw(42, 42), 100);
  assert.equal(scoreAngleDraw(47, 42), 80);
  assert.equal(scoreAngleDraw(90, 20), 0);

  // Line Split
  assert.equal(scoreLineSplit(37, 37), 100);
  assert.ok(scoreLineSplit(40, 37) >= 85);
  assert.equal(scoreLineSplit(90, 10), 0);

  // Flash Count
  assert.equal(scoreFlashCount(19, 19), 100);
  assert.equal(scoreFlashCount(20, 19), 86);
  assert.equal(scoreFlashCount(30, 12), 0);

  // Trajectory Drop
  assert.equal(scoreTrajectoryDrop(120, 120, 200), 100);
  assert.equal(scoreTrajectoryDrop(130, 120, 200), 75);

  // Steady Beat
  assert.equal(scoreSteadyBeat([4, -6, 8, -5]), 100);
  assert.ok(scoreSteadyBeat([35, -35, 35, -35]) >= 85);
  assert.equal(scoreSteadyBeat([400, 400, 400, 400]), 0);
});

test('Series 2 scoring math', () => {
  // Hue Memory circular wraparound (355° vs 5° is only 10° apart!)
  assert.equal(scoreHueMemory(120, 50, 120, 50), 100);
  assert.equal(scoreHueMemory(355, 50, 5, 50), 86);

  // Odd Tile Out
  assert.equal(
    scoreOddTileOut({ pickedRow: 2, pickedCol: 3, targetRow: 2, targetCol: 3, elapsedSec: 0.8 }),
    100
  );
  assert.ok(
    scoreOddTileOut({ pickedRow: 2, pickedCol: 3, targetRow: 2, targetCol: 3, elapsedSec: 4.0 }) >= 80
  );
  assert.equal(
    scoreOddTileOut({ pickedRow: null, pickedCol: null, targetRow: 2, targetCol: 3, elapsedSec: 10 }),
    0
  );

  // Area Match: exact circle radius r = side / sqrt(pi)
  const exactR = 80 / Math.sqrt(Math.PI);
  assert.equal(scoreAreaMatch(exactR, 80), 100);

  // Center of Mass weighted centroid
  const centroid = computeWeightedCentroid([
    { x: 0, y: 0, r: 10 }, // weight 100
    { x: 100, y: 0, r: 10 }, // weight 100
  ]);
  assert.equal(centroid.x, 50);
  assert.equal(centroid.y, 0);
  assert.equal(scoreCenterOfMass(50, 0, 50, 0, 300), 100);

  // Alignment Level
  assert.equal(scoreAlignmentLevel(0), 100);
  assert.equal(scoreAlignmentLevel(0.5), 91);
  assert.equal(scoreAlignmentLevel(6.0), 0);
});

test('Series 3 scoring math', () => {
  assert.equal(scoreBlindStopwatch(4.65, 4.65), 100);
  assert.ok(scoreBlindStopwatch(4.85, 4.65) >= 85);

  assert.equal(scoreCircleFill(68, 68), 100);
  assert.equal(scoreSpeedMatch(160, 160), 100);
  assert.equal(scoreGridDensity(45, 45), 100);
  assert.equal(scoreGridDensity(47, 45), 89);
  assert.equal(scoreIntervalBisect(72, 72), 100);
});

test('share text formatting and streak/badge persistence', () => {
  const rounds = [
    { gameId: '1', gameName: 'G1', seriesId: 'series-2', score: 90, userLabel: 'A', targetLabel: 'A' },
    { gameId: '2', gameName: 'G2', seriesId: 'series-2', score: 78, userLabel: 'B', targetLabel: 'B' },
    { gameId: '3', gameName: 'G3', seriesId: 'series-2', score: 91, userLabel: 'C', targetLabel: 'C' },
    { gameId: '4', gameName: 'G4', seriesId: 'series-2', score: 88, userLabel: 'D', targetLabel: 'D' },
    { gameId: '5', gameName: 'G5', seriesId: 'series-2', score: 98, userLabel: 'E', targetLabel: 'E' },
  ];

  assert.equal(calculateAverageScore(rounds), 89);
  const share = formatShareText({
    seriesTitle: 'Color & Visual Acuity',
    seriesNumberLabel: 'Series 2',
    dateStr: '2026-11-19',
    mode: 'daily',
    rounds,
  });
  assert.equal(share, 'Gamez Series 2 • 2026-11-19 • Score: 89/100 (A) 🟩🟨🟩🟩🟦');

  // Streak computation
  assert.equal(
    computeDailyStreak(['2026-11-17', '2026-11-18', '2026-11-19'], '2026-11-19'),
    3
  );
  assert.equal(
    computeDailyStreak(['2026-11-15', '2026-11-19'], '2026-11-19'),
    1
  );

  // Record completion unlocks first-calibration and s-rank-round (round 5 = 98)
  const initial = createInitialState();
  const { nextState, newlyUnlockedBadges } = recordRunCompletion(initial, {
    seriesId: 'series-2',
    dateStr: '2026-11-19',
    mode: 'daily',
    rounds,
  });
  assert.equal(nextState.totalRunsCompleted, 1);
  assert.equal(nextState.highScores['series-2'], 89);
  assert.ok(newlyUnlockedBadges.some((b) => b.id === 'first-calibration'));
  assert.ok(newlyUnlockedBadges.some((b) => b.id === 's-rank-round'));
});

test('Challenge-a-Friend URL round-trip across all 3 rules and 15 games', () => {
  assert.equal(Object.keys(GAME_ID_TO_CODE).length, 15);

  const payload = {
    v: 1 as const,
    seed: '2026-11-19::series-1',
    gameIds: [
      's1-angle-draw',
      's1-line-split',
      's1-flash-count',
      's1-trajectory-drop',
      's1-steady-beat',
    ],
    rule: 'swap1' as const,
    challengerName: 'Alex',
    challengerScores: [92, 85, 78, 90, 95],
    seriesLabel: 'Classic Instinct',
  };

  const url = buildChallengeUrl(payload, 'https://gamez.example/');
  assert.ok(url.startsWith('https://gamez.example/?c='));

  const parsed = parseChallengeFromUrl(url);
  assert.deepEqual(parsed, payload);

  // Also test lock and free rules without scores
  const lockToken = encodeChallengePayload({
    ...payload,
    rule: 'lock',
    challengerScores: undefined,
  });
  const decodedLock = decodeChallengePayload(lockToken);
  assert.equal(decodedLock?.rule, 'lock');
  assert.equal(decodedLock?.challengerScores, undefined);

  const freeToken = encodeChallengePayload({ ...payload, rule: 'free' });
  assert.equal(decodeChallengePayload(freeToken)?.rule, 'free');

  // Corrupt tokens safely return null
  assert.equal(decodeChallengePayload('not-valid-base64!!!'), null);
  assert.equal(parseChallengeFromUrl('?c=abc123'), null);
});

test('Head-to-Head comparison handles kept rounds, swapped rounds, and full remix', () => {
  const payload = {
    v: 1 as const,
    seed: 'test-seed-1',
    gameIds: [
      's1-angle-draw',
      's1-line-split',
      's1-flash-count',
      's1-trajectory-drop',
      's1-steady-beat',
    ],
    rule: 'swap1' as const,
    challengerName: 'Alex',
    challengerScores: [80, 75, 90, 85, 70],
  };

  // Recipient swapped Round 3 (index 2) from s1-flash-count to s3-blind-stopwatch
  const myRounds = [
    { gameId: 's1-angle-draw', gameName: 'Angle Draw', seriesId: 'series-1', score: 90, userLabel: '42°', targetLabel: '42°' },
    { gameId: 's1-line-split', gameName: 'Line Split', seriesId: 'series-1', score: 75, userLabel: '50%', targetLabel: '50%' },
    { gameId: 's3-blind-stopwatch', gameName: 'Blind Stopwatch', seriesId: 'series-3', score: 95, userLabel: '4.0s', targetLabel: '4.0s' },
    { gameId: 's1-trajectory-drop', gameName: 'Trajectory Drop', seriesId: 'series-1', score: 80, userLabel: '10', targetLabel: '12' },
    { gameId: 's1-steady-beat', gameName: 'Steady Beat', seriesId: 'series-1', score: 88, userLabel: '20ms', targetLabel: '0ms' },
  ];

  const h2h = computeHeadToHead(myRounds, {
    payload,
    swappedIndices: [2],
    playedGameIds: myRounds.map((r) => r.gameId),
  });

  assert.equal(h2h.matchedCount, 4);
  assert.equal(h2h.wins, 2); // R1 (90>80), R5 (88>70)
  assert.equal(h2h.ties, 1); // R2 (75=75)
  assert.equal(h2h.losses, 1); // R4 (80<85)
  assert.equal(h2h.rounds[2].status, 'swapped');
  assert.equal(h2h.rounds[2].challengerScore, null);
  assert.equal(h2h.verdict, 'win'); // matched avg: (90+75+80+88)/4 = 83 vs (80+75+85+70)/4 = 78

  // Full remix (all 5 swapped) yields verdict === 'remixed'
  const fullRemixRounds = [
    { gameId: 's2-hue-memory', gameName: 'Hue Memory', seriesId: 'series-2', score: 85, userLabel: 'A', targetLabel: 'A' },
    { gameId: 's2-odd-tile-out', gameName: 'Odd Tile Out', seriesId: 'series-2', score: 90, userLabel: 'B', targetLabel: 'B' },
    { gameId: 's2-area-match', gameName: 'Area Match', seriesId: 'series-2', score: 88, userLabel: 'C', targetLabel: 'C' },
    { gameId: 's2-center-of-mass', gameName: 'Center of Mass', seriesId: 'series-2', score: 92, userLabel: 'D', targetLabel: 'D' },
    { gameId: 's2-alignment-level', gameName: 'Alignment Level', seriesId: 'series-2', score: 86, userLabel: 'E', targetLabel: 'E' },
  ];
  const fullRemix = computeHeadToHead(fullRemixRounds, {
    payload: { ...payload, rule: 'free' },
    swappedIndices: [0, 1, 2, 3, 4],
    playedGameIds: fullRemixRounds.map((r) => r.gameId),
  });
  assert.equal(fullRemix.matchedCount, 0);
  assert.equal(fullRemix.verdict, 'remixed');
});
