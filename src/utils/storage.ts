import type {
  BadgeDef,
  DailyCompletionRecord,
  GameMode,
  PersistedState,
  RoundResult,
} from '../types/game';
import { calculateAverageScore, getLetterRank } from './scoring';

const STORAGE_KEY = 'perceptle_collection_v1';

export const BADGE_DEFINITIONS: readonly BadgeDef[] = [
  {
    id: 'first-calibration',
    title: 'First Calibration',
    description: 'Complete your first 5-round AllGamez Hub series.',
  },
  {
    id: 's-rank-round',
    title: 'Surgical Eye',
    description: 'Score 95 or higher (S Rank) on any individual test.',
  },
  {
    id: 's-rank-series',
    title: 'Master Calibrator',
    description: 'Achieve an S Rank (95+ average) across a full 5-round series.',
  },
  {
    id: 'daily-sweep',
    title: 'Daily Sweep',
    description: 'Complete Series 1, Series 2, and Series 3 in a single day.',
  },
  {
    id: 'streak-3',
    title: 'Three-Day Cadence',
    description: 'Maintain a 3-day Daily Mode completion streak.',
  },
  {
    id: 'shuffle-complete',
    title: 'Cross-Discipline',
    description: 'Finish a Daily Shuffle or Custom Mix gauntlet.',
  },
];

export function createInitialState(): PersistedState {
  return {
    dailyCompletions: {},
    highScores: {},
    completedDates: [],
    totalRunsCompleted: 0,
    totalSRankRounds: 0,
    unlockedBadges: [],
    muted: false,
    theme: 'light',
    playerName: '',
  };
}

export function loadPersistedState(): PersistedState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createInitialState();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      dailyCompletions: parsed.dailyCompletions ?? {},
      highScores: parsed.highScores ?? {},
      completedDates: Array.isArray(parsed.completedDates) ? parsed.completedDates : [],
      totalRunsCompleted: typeof parsed.totalRunsCompleted === 'number' ? parsed.totalRunsCompleted : 0,
      totalSRankRounds: typeof parsed.totalSRankRounds === 'number' ? parsed.totalSRankRounds : 0,
      unlockedBadges: Array.isArray(parsed.unlockedBadges) ? parsed.unlockedBadges : [],
      muted: Boolean(parsed.muted),
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
      playerName: typeof parsed.playerName === 'string' ? parsed.playerName.slice(0, 24) : '',
    };
  } catch {
    return createInitialState();
  }
}

export function savePersistedState(state: PersistedState): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota errors in restricted sandboxes
  }
}

function addDays(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Computes current active daily streak ending today (or yesterday if today isn't completed yet).
 */
export function computeDailyStreak(completedDates: readonly string[], todayStr: string): number {
  if (completedDates.length === 0) return 0;
  const dateSet = new Set(completedDates);
  let cursor = todayStr;
  if (!dateSet.has(cursor)) {
    cursor = addDays(todayStr, -1);
    if (!dateSet.has(cursor)) return 0;
  }
  let streak = 0;
  while (dateSet.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function getDailyCompletionKey(dateStr: string, seriesId: string): string {
  return `${dateStr}::${seriesId}`;
}

export function recordRunCompletion(
  prevState: PersistedState,
  params: {
    seriesId: string;
    dateStr: string;
    mode: GameMode;
    rounds: RoundResult[];
  }
): { nextState: PersistedState; newlyUnlockedBadges: BadgeDef[] } {
  const avgScore = calculateAverageScore(params.rounds);
  const rank = getLetterRank(avgScore);
  const sRounds = params.rounds.filter((r) => r.score >= 95).length;

  const dailyCompletions = { ...prevState.dailyCompletions };
  const completedDatesSet = new Set(prevState.completedDates);

  if (params.mode === 'daily') {
    const key = getDailyCompletionKey(params.dateStr, params.seriesId);
    const existing = dailyCompletions[key];
    // Keep highest daily record if replayed, or set first completion
    if (!existing || avgScore >= existing.averageScore) {
      const record: DailyCompletionRecord = {
        date: params.dateStr,
        seriesId: params.seriesId,
        averageScore: avgScore,
        rank,
        rounds: params.rounds,
        completedAt: new Date().toISOString(),
      };
      dailyCompletions[key] = record;
    }
    completedDatesSet.add(params.dateStr);
  }

  const highScores = { ...prevState.highScores };
  highScores[params.seriesId] = Math.max(highScores[params.seriesId] ?? 0, avgScore);

  const completedDates = Array.from(completedDatesSet).sort();
  const totalRunsCompleted = prevState.totalRunsCompleted + 1;
  const totalSRankRounds = prevState.totalSRankRounds + sRounds;

  const badgeSet = new Set(prevState.unlockedBadges);
  const beforeCount = badgeSet.size;

  badgeSet.add('first-calibration');
  if (sRounds > 0 || totalSRankRounds > 0) {
    badgeSet.add('s-rank-round');
  }
  if (avgScore >= 95) {
    badgeSet.add('s-rank-series');
  }
  if (params.seriesId === 'daily-shuffle' || params.seriesId === 'custom-mix') {
    badgeSet.add('shuffle-complete');
  }

  // Check daily sweep for today
  const s1Done = Boolean(dailyCompletions[getDailyCompletionKey(params.dateStr, 'series-1')]);
  const s2Done = Boolean(dailyCompletions[getDailyCompletionKey(params.dateStr, 'series-2')]);
  const s3Done = Boolean(dailyCompletions[getDailyCompletionKey(params.dateStr, 'series-3')]);
  if (s1Done && s2Done && s3Done) {
    badgeSet.add('daily-sweep');
  }

  if (computeDailyStreak(completedDates, params.dateStr) >= 3) {
    badgeSet.add('streak-3');
  }

  const unlockedBadges = Array.from(badgeSet);
  const newlyUnlockedBadges =
    unlockedBadges.length > beforeCount
      ? BADGE_DEFINITIONS.filter(
          (b) => badgeSet.has(b.id) && !prevState.unlockedBadges.includes(b.id)
        )
      : [];

  const nextState: PersistedState = {
    ...prevState,
    dailyCompletions,
    highScores,
    completedDates,
    totalRunsCompleted,
    totalSRankRounds,
    unlockedBadges,
  };

  return { nextState, newlyUnlockedBadges };
}
