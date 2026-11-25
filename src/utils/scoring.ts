import type { LetterRank, RoundResult } from '../types/game';

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getLetterRank(score: number): LetterRank {
  const rounded = Math.round(score);
  if (rounded >= 95) return 'S';
  if (rounded >= 85) return 'A';
  if (rounded >= 70) return 'B';
  if (rounded >= 50) return 'C';
  return 'D';
}

export function getScoreEmoji(score: number): string {
  const rank = getLetterRank(score);
  switch (rank) {
    case 'S':
      return '🟦';
    case 'A':
      return '🟩';
    case 'B':
      return '🟨';
    case 'C':
      return '🟧';
    case 'D':
      return '🟥';
  }
}

export function getRankStyle(rank: LetterRank): {
  text: string;
  bg: string;
  border: string;
  label: string;
} {
  switch (rank) {
    case 'S':
      return {
        text: 'text-indigo-700 dark:text-indigo-300',
        bg: 'bg-indigo-50 dark:bg-indigo-950/60',
        border: 'border-indigo-200 dark:border-indigo-800',
        label: 'Calibrated',
      };
    case 'A':
      return {
        text: 'text-emerald-700 dark:text-emerald-300',
        bg: 'bg-emerald-50 dark:bg-emerald-950/60',
        border: 'border-emerald-200 dark:border-emerald-800',
        label: 'Sharp',
      };
    case 'B':
      return {
        text: 'text-amber-700 dark:text-amber-300',
        bg: 'bg-amber-50 dark:bg-amber-950/60',
        border: 'border-amber-200 dark:border-amber-800',
        label: 'Steady',
      };
    case 'C':
      return {
        text: 'text-orange-700 dark:text-orange-300',
        bg: 'bg-orange-50 dark:bg-orange-950/60',
        border: 'border-orange-200 dark:border-orange-800',
        label: 'Developing',
      };
    case 'D':
      return {
        text: 'text-rose-700 dark:text-rose-300',
        bg: 'bg-rose-50 dark:bg-rose-950/60',
        border: 'border-rose-200 dark:border-rose-800',
        label: 'Off-Axis',
      };
  }
}

export function calculateAverageScore(rounds: readonly Pick<RoundResult, 'score'>[]): number {
  if (rounds.length === 0) return 0;
  const total = rounds.reduce((sum, r) => sum + r.score, 0);
  return Math.round(total / rounds.length);
}

export function formatShareText(params: {
  seriesTitle: string;
  seriesNumberLabel: string;
  dateStr: string;
  mode: 'daily' | 'practice';
  rounds: readonly RoundResult[];
}): string {
  const avg = calculateAverageScore(params.rounds);
  const rank = getLetterRank(avg);
  const emojis = params.rounds.map((r) => getScoreEmoji(r.score)).join('');
  const label =
    params.seriesNumberLabel.startsWith('Series')
      ? params.seriesNumberLabel
      : params.seriesTitle;
  const dateTag = params.mode === 'daily' ? params.dateStr : 'Practice';
  return `AllGamez Hub ${label} • ${dateTag} • Score: ${avg}/100 (${rank}) ${emojis}`;
}

/* ============================================================================
 * INDIVIDUAL MINI-GAME SCORING FUNCTIONS (Pure, unit-tested)
 * ============================================================================ */

// Series 1 - Game 1: Angle Draw (spec: 100 - error * 4)
export function scoreAngleDraw(guessDeg: number, targetDeg: number): number {
  const err = Math.abs(guessDeg - targetDeg);
  return clampScore(100 - err * 4);
}

// Series 1 - Game 2: Line Split (percentage error)
export function scoreLineSplit(guessPct: number, targetPct: number): number {
  const err = Math.abs(guessPct - targetPct);
  return clampScore(100 - err * 4.5);
}

// Series 1 - Game 3: Flash Count (count error)
export function scoreFlashCount(guessCount: number, targetCount: number): number {
  const err = Math.abs(guessCount - targetCount);
  return clampScore(100 - err * 14);
}

// Series 1 - Game 4: Trajectory Drop (landing X error as % of floor width)
export function scoreTrajectoryDrop(
  guessX: number,
  targetX: number,
  floorWidth: number
): number {
  if (floorWidth <= 0) return 0;
  const errPct = (Math.abs(guessX - targetX) / floorWidth) * 100;
  return clampScore(100 - errPct * 5);
}

// Series 1 - Game 5: Steady Beat (average ms drift across beats 5-8)
export function scoreSteadyBeat(driftsMs: readonly number[]): number {
  if (driftsMs.length === 0) return 0;
  const avgDrift =
    driftsMs.reduce((acc, d) => acc + Math.abs(d), 0) / driftsMs.length;
  // Grace window of 10ms for human hardware latency
  return clampScore(100 - Math.max(0, avgDrift - 10) * 0.55);
}

// Series 2 - Game 1: Hue Memory (circular hue distance + lightness distance)
export function scoreHueMemory(
  guessH: number,
  guessL: number,
  targetH: number,
  targetL: number
): number {
  const rawHueDiff = Math.abs(guessH - targetH) % 360;
  const hueErr = Math.min(rawHueDiff, 360 - rawHueDiff);
  const lightErr = Math.abs(guessL - targetL);
  return clampScore(100 - (hueErr * 1.4 + lightErr * 1.8));
}

// Series 2 - Game 2: Odd Tile Out (speed + accuracy on 5x5 grid)
export function scoreOddTileOut(params: {
  pickedRow: number | null;
  pickedCol: number | null;
  targetRow: number;
  targetCol: number;
  elapsedSec: number;
  maxSec?: number;
}): number {
  const { pickedRow, pickedCol, targetRow, targetCol, elapsedSec } = params;
  if (pickedRow === null || pickedCol === null) return 0;
  if (pickedRow === targetRow && pickedCol === targetCol) {
    // Correct tile: 100 if under 1s, smoothly scaling down to 60 at 10s
    return clampScore(Math.max(60, 100 - Math.max(0, elapsedSec - 1.0) * 4.5));
  }
  const dist = Math.abs(pickedRow - targetRow) + Math.abs(pickedCol - targetCol);
  return clampScore(Math.max(0, 28 - dist * 7));
}

// Series 2 - Game 3: Area Match (circle area vs reference square area)
export function scoreAreaMatch(circleRadius: number, squareSide: number): number {
  const targetArea = squareSide * squareSide;
  if (targetArea <= 0) return 0;
  const circleArea = Math.PI * circleRadius * circleRadius;
  const pctErr = (Math.abs(circleArea - targetArea) / targetArea) * 100;
  return clampScore(100 - pctErr * 2.5);
}

// Series 2 - Game 4: Center of Mass (weighted centroid Euclidean error)
export interface WeightedDot {
  x: number;
  y: number;
  r: number;
}

export function computeWeightedCentroid(dots: readonly WeightedDot[]): {
  x: number;
  y: number;
} {
  let totalWeight = 0;
  let sumX = 0;
  let sumY = 0;
  for (const d of dots) {
    // Visual mass proportional to area (r^2)
    const w = d.r * d.r;
    totalWeight += w;
    sumX += d.x * w;
    sumY += d.y * w;
  }
  if (totalWeight === 0) return { x: 0.5, y: 0.5 };
  return { x: sumX / totalWeight, y: sumY / totalWeight };
}

export function scoreCenterOfMass(
  guessX: number,
  guessY: number,
  targetX: number,
  targetY: number,
  boxSize: number
): number {
  if (boxSize <= 0) return 0;
  const dist = Math.hypot(guessX - targetX, guessY - targetY);
  const distPct = (dist / boxSize) * 100;
  return clampScore(100 - distPct * 4.2);
}

// Series 2 - Game 5: Alignment Level (deviation from 0.0 degrees)
export function scoreAlignmentLevel(finalAngleDeg: number): number {
  const err = Math.abs(finalAngleDeg);
  return clampScore(100 - err * 18);
}

// Series 3 - Game 1: Blind Stopwatch (error relative to target duration)
export function scoreBlindStopwatch(guessSec: number, targetSec: number): number {
  if (targetSec <= 0) return 0;
  const errSec = Math.abs(guessSec - targetSec);
  const relErr = errSec / targetSec;
  return clampScore(100 - relErr * 260);
}

// Series 3 - Game 2: Circle Fill (area % error)
export function scoreCircleFill(guessAreaPct: number, targetAreaPct: number): number {
  const err = Math.abs(guessAreaPct - targetAreaPct);
  return clampScore(100 - err * 3.8);
}

// Series 3 - Game 3: Speed Match (percentage velocity error)
export function scoreSpeedMatch(guessSpeed: number, targetSpeed: number): number {
  if (targetSpeed <= 0) return 0;
  const pctErr = (Math.abs(guessSpeed - targetSpeed) / targetSpeed) * 100;
  return clampScore(100 - pctErr * 2.5);
}

// Series 3 - Game 4: Grid Density (shaded cell count out of 100 vs target %)
export function scoreGridDensity(shadedCells: number, targetPct: number): number {
  const err = Math.abs(shadedCells - targetPct);
  return clampScore(100 - err * 5.5);
}

// Series 3 - Game 5: Interval Bisect (position % error)
export function scoreIntervalBisect(guessPct: number, targetPct: number): number {
  const err = Math.abs(guessPct - targetPct);
  return clampScore(100 - err * 4.5);
}
