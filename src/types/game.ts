import type { ComponentType } from 'react';

export type GameMode = 'daily' | 'practice';

export type ThemeMode = 'light' | 'dark';

export type LetterRank = 'S' | 'A' | 'B' | 'C' | 'D';

export interface MiniGameOutcome {
  score: number;
  userLabel: string;
  targetLabel: string;
}

export interface RoundResult extends MiniGameOutcome {
  gameId: string;
  gameName: string;
  seriesId: string;
}

export interface MiniGameProps {
  seed: string;
  accentColor: string;
  onComplete: (outcome: MiniGameOutcome) => void;
}

export interface MiniGameDef {
  id: string;
  name: string;
  shortDesc: string;
  seriesId: string;
  component: ComponentType<MiniGameProps>;
}

export interface SeriesDef {
  id: string;
  numberLabel: string;
  title: string;
  subtitle: string;
  description: string;
  accentColor: string;
  accentLight: string;
  iconName: 'compass' | 'eye' | 'timer' | 'shuffle' | 'sliders' | 'swords';
  games: MiniGameDef[];
}

export interface DailyCompletionRecord {
  date: string;
  seriesId: string;
  averageScore: number;
  rank: LetterRank;
  rounds: RoundResult[];
  completedAt: string;
}

export interface BadgeDef {
  id: string;
  title: string;
  description: string;
}

export interface PersistedState {
  // Keyed by `${date}::${seriesId}`
  dailyCompletions: Record<string, DailyCompletionRecord>;
  // Keyed by seriesId -> best average score (across daily or practice)
  highScores: Record<string, number>;
  // Dates (`YYYY-MM-DD`) on which at least one daily series was completed
  completedDates: string[];
  // Total completed runs
  totalRunsCompleted: number;
  // Total individual rounds with S rank (95-100)
  totalSRankRounds: number;
  // Unlocked badge IDs
  unlockedBadges: string[];
  // Audio preference
  muted: boolean;
  // Color theme preference
  theme: ThemeMode;
  // Optional saved display name for Challenge-a-Friend links
  playerName: string;
}
