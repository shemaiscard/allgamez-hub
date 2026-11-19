import type { MiniGameDef, SeriesDef } from '../types/game';
import { createRng, shuffleArray } from '../utils/prng';

import { AngleDraw } from '../games/series1/AngleDraw';
import { LineSplit } from '../games/series1/LineSplit';
import { FlashCount } from '../games/series1/FlashCount';
import { TrajectoryDrop } from '../games/series1/TrajectoryDrop';
import { SteadyBeat } from '../games/series1/SteadyBeat';

import { HueMemory } from '../games/series2/HueMemory';
import { OddTileOut } from '../games/series2/OddTileOut';
import { AreaMatch } from '../games/series2/AreaMatch';
import { CenterOfMass } from '../games/series2/CenterOfMass';
import { AlignmentLevel } from '../games/series2/AlignmentLevel';

import { BlindStopwatch } from '../games/series3/BlindStopwatch';
import { CircleFill } from '../games/series3/CircleFill';
import { SpeedMatch } from '../games/series3/SpeedMatch';
import { GridDensity } from '../games/series3/GridDensity';
import { IntervalBisect } from '../games/series3/IntervalBisect';

export const SERIES_CONFIG: readonly SeriesDef[] = [
  {
    id: 'series-1',
    numberLabel: 'Series 1',
    title: 'Classic Instinct',
    subtitle: 'Spatial & Motion',
    description: 'Angle Draw, Line Split, Flash Count, Trajectory Drop, and Steady Beat.',
    accentColor: '#4F46E5',
    accentLight: '#EEF2FF',
    iconName: 'compass',
    games: [
      {
        id: 's1-angle-draw',
        name: 'Angle Draw',
        shortDesc: 'Draw a target angle on an unmarked protractor.',
        seriesId: 'series-1',
        component: AngleDraw,
      },
      {
        id: 's1-line-split',
        name: 'Line Split',
        shortDesc: 'Divide a horizontal bar at an exact percentage.',
        seriesId: 'series-1',
        component: LineSplit,
      },
      {
        id: 's1-flash-count',
        name: 'Flash Count',
        shortDesc: 'Estimate a 0.6s flash of scattered dots.',
        seriesId: 'series-1',
        component: FlashCount,
      },
      {
        id: 's1-trajectory-drop',
        name: 'Trajectory Drop',
        shortDesc: 'Predict where an occluded parabolic arc lands.',
        seriesId: 'series-1',
        component: TrajectoryDrop,
      },
      {
        id: 's1-steady-beat',
        name: 'Steady Beat',
        shortDesc: 'Keep an internal metronome across 4 silent beats.',
        seriesId: 'series-1',
        component: SteadyBeat,
      },
    ],
  },
  {
    id: 'series-2',
    numberLabel: 'Series 2',
    title: 'Color & Visual Acuity',
    subtitle: 'Chroma & Geometry',
    description: 'Hue Memory, Odd Tile Out, Area Match, Center of Mass, and Alignment Level.',
    accentColor: '#059669',
    accentLight: '#ECFDF5',
    iconName: 'eye',
    games: [
      {
        id: 's2-hue-memory',
        name: 'Hue Memory',
        shortDesc: 'Recreate a hidden color swatch from memory.',
        seriesId: 'series-2',
        component: HueMemory,
      },
      {
        id: 's2-odd-tile-out',
        name: 'Odd Tile Out',
        shortDesc: 'Spot the subtle shade difference in a 5×5 grid.',
        seriesId: 'series-2',
        component: OddTileOut,
      },
      {
        id: 's2-area-match',
        name: 'Area Match',
        shortDesc: 'Match a circle’s area to a reference square.',
        seriesId: 'series-2',
        component: AreaMatch,
      },
      {
        id: 's2-center-of-mass',
        name: 'Center of Mass',
        shortDesc: 'Locate the weighted centroid of 7 varied dots.',
        seriesId: 'series-2',
        component: CenterOfMass,
      },
      {
        id: 's2-alignment-level',
        name: 'Alignment Level',
        shortDesc: 'Fine-tune a tilted line to exactly 0.0° level.',
        seriesId: 'series-2',
        component: AlignmentLevel,
      },
    ],
  },
  {
    id: 'series-3',
    numberLabel: 'Series 3',
    title: 'Time & Proportion',
    subtitle: 'Tempo & Ratios',
    description: 'Blind Stopwatch, Circle Fill, Speed Match, Grid Density, and Interval Bisect.',
    accentColor: '#D97706',
    accentLight: '#FFFBEB',
    iconName: 'timer',
    games: [
      {
        id: 's3-blind-stopwatch',
        name: 'Blind Stopwatch',
        shortDesc: 'Stop a hidden clock at an exact target time.',
        seriesId: 'series-3',
        component: BlindStopwatch,
      },
      {
        id: 's3-circle-fill',
        name: 'Circle Fill',
        shortDesc: 'Hold to inflate an inner circle to a target area %.',
        seriesId: 'series-3',
        component: CircleFill,
      },
      {
        id: 's3-speed-match',
        name: 'Speed Match',
        shortDesc: 'Match Track B’s velocity to a hidden Track A.',
        seriesId: 'series-3',
        component: SpeedMatch,
      },
      {
        id: 's3-grid-density',
        name: 'Grid Density',
        shortDesc: 'Shade a target percentage of a 10×10 grid blindly.',
        seriesId: 'series-3',
        component: GridDensity,
      },
      {
        id: 's3-interval-bisect',
        name: 'Interval Bisect',
        shortDesc: 'Tap a moving pulse at an asymmetric percentage.',
        seriesId: 'series-3',
        component: IntervalBisect,
      },
    ],
  },
];

export const ALL_MINI_GAMES: readonly MiniGameDef[] = SERIES_CONFIG.flatMap(
  (series) => series.games
);

/**
 * Generates a deterministic 5-round "Daily Shuffle" gauntlet:
 * Pulls 1 game from each of the 3 Series + 2 distinct bonus picks from the remaining pool.
 */
export function buildDailyShuffleSeries(seed: string): SeriesDef {
  const rng = createRng(`${seed}::shuffle-picker`);
  const picked: MiniGameDef[] = [];
  const usedIds = new Set<string>();

  for (const series of SERIES_CONFIG) {
    const shuffled = shuffleArray(rng, series.games);
    const chosen = shuffled[0];
    picked.push(chosen);
    usedIds.add(chosen.id);
  }

  const remaining = ALL_MINI_GAMES.filter((g) => !usedIds.has(g.id));
  const bonus = shuffleArray(rng, remaining).slice(0, 2);
  const gauntlet = shuffleArray(rng, [...picked, ...bonus]);

  return {
    id: 'daily-shuffle',
    numberLabel: 'Bonus Mix',
    title: 'Daily Shuffle',
    subtitle: 'Cross-Series Gauntlet',
    description: gauntlet.map((g) => g.name).join(', ') + '.',
    accentColor: '#E11D48',
    accentLight: '#FFF1F2',
    iconName: 'shuffle',
    games: gauntlet,
  };
}

export function buildCustomMixSeries(gameIds: readonly string[]): SeriesDef {
  const map = new Map(ALL_MINI_GAMES.map((g) => [g.id, g]));
  const games = gameIds
    .map((id) => map.get(id))
    .filter((g): g is MiniGameDef => Boolean(g))
    .slice(0, 5);

  return {
    id: 'custom-mix',
    numberLabel: 'Custom Mix',
    title: 'Custom Mix',
    subtitle: 'Handpicked 5-Round Gauntlet',
    description: games.map((g) => g.name).join(', ') + '.',
    accentColor: '#0F172A',
    accentLight: '#F1F5F9',
    iconName: 'sliders',
    games,
  };
}

export function buildChallengeSeries(
  gameIds: readonly string[],
  challengerName?: string
): SeriesDef {
  const map = new Map(ALL_MINI_GAMES.map((g) => [g.id, g]));
  const games = gameIds
    .map((id) => map.get(id))
    .filter((g): g is MiniGameDef => Boolean(g))
    .slice(0, 5);

  const label = challengerName
    ? `${challengerName}'s Challenge`
    : 'Friend Challenge';

  return {
    id: 'friend-challenge',
    numberLabel: 'Challenge',
    title: label,
    subtitle: 'Head-to-Head 5-Round Duel',
    description: games.map((g) => g.name).join(', ') + '.',
    accentColor: '#7C3AED',
    accentLight: '#F5F3FF',
    iconName: 'swords',
    games,
  };
}
