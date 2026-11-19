import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Compass,
  Eye,
  Flame,
  Moon,
  Shuffle,
  SlidersHorizontal,
  Sun,
  Swords,
  Timer,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  DailyCompletionRecord,
  GameMode,
  PersistedState,
  SeriesDef,
} from '../types/game';
import { SERIES_CONFIG, buildDailyShuffleSeries } from '../config/seriesConfig';
import { formatDisplayDate, makeDailySeed } from '../utils/prng';
import {
  BADGE_DEFINITIONS,
  computeDailyStreak,
  getDailyCompletionKey,
} from '../utils/storage';
import { soundEngine } from '../utils/audio';
import { CalibrationEmblem } from './CalibrationEmblem';
import { PWAInstallButton } from './PWAInstallButton';

interface HubScreenProps {
  dateStr: string;
  mode: GameMode;
  persisted: PersistedState;
  onModeChange: (mode: GameMode) => void;
  onToggleMute: () => void;
  onToggleTheme: () => void;
  onStartSeries: (series: SeriesDef, overrideMode?: GameMode) => void;
  onViewCompletedSummary: (series: SeriesDef, record: DailyCompletionRecord) => void;
  onOpenCustomMix: () => void;
  onOpenChallengeBuilder: () => void;
}

function SeriesIcon({
  name,
  color,
}: {
  name: SeriesDef['iconName'];
  color: string;
}) {
  const props = { className: 'w-5 h-5', style: { color } };
  switch (name) {
    case 'compass':
      return <Compass {...props} />;
    case 'eye':
      return <Eye {...props} />;
    case 'timer':
      return <Timer {...props} />;
    case 'shuffle':
      return <Shuffle {...props} />;
    case 'sliders':
      return <SlidersHorizontal {...props} />;
    case 'swords':
      return <Swords {...props} />;
  }
}

export function HubScreen({
  dateStr,
  mode,
  persisted,
  onModeChange,
  onToggleMute,
  onToggleTheme,
  onStartSeries,
  onViewCompletedSummary,
  onOpenCustomMix,
  onOpenChallengeBuilder,
}: HubScreenProps) {
  const [showBadges, setShowBadges] = useState(false);

  const dailyShuffleSeries = useMemo(
    () => buildDailyShuffleSeries(makeDailySeed(dateStr, 'daily-shuffle')),
    [dateStr]
  );

  const streak = useMemo(
    () => computeDailyStreak(persisted.completedDates, dateStr),
    [persisted.completedDates, dateStr]
  );

  const allCards: SeriesDef[] = [...SERIES_CONFIG, dailyShuffleSeries];

  const completedTodayCount = allCards.filter((s) =>
    Boolean(persisted.dailyCompletions[getDailyCompletionKey(dateStr, s.id)])
  ).length;

  const isDark = persisted.theme === 'dark';

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0F17] text-[#111827] dark:text-[#F3F4F6] transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-5">
        {/* Top Bar */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3.5">
            <CalibrationEmblem className="w-10 h-10 shrink-0" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white leading-none">
                Gamez
              </h1>
              <div className="mt-1 flex items-center gap-2 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                <span>{formatDisplayDate(dateStr)}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-mono tabular-nums text-neutral-700 dark:text-neutral-200 font-medium">
                  <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span data-testid="daily-streak">{streak}</span> day streak
                </span>
              </div>
            </div>
          </div>

          {/* Mode Toggle + Theme + Sound Controls */}
          <div className="flex items-center justify-between sm:justify-end gap-2.5">
            <div
              role="group"
              aria-label="Challenge Mode"
              className="inline-flex items-center p-1 rounded-xl bg-neutral-200/75 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700"
            >
              <button
                type="button"
                aria-pressed={mode === 'daily'}
                onClick={() => {
                  soundEngine.playTap();
                  onModeChange('daily');
                }}
                className={`min-h-[38px] px-3.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  mode === 'daily'
                    ? 'bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                Daily Mode
              </button>
              <button
                type="button"
                aria-pressed={mode === 'practice'}
                onClick={() => {
                  soundEngine.playTap();
                  onModeChange('practice');
                }}
                className={`min-h-[38px] px-3.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  mode === 'practice'
                    ? 'bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                Endless Practice
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <PWAInstallButton />
              <button
                type="button"
                data-testid="theme-toggle"
                aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                onClick={onToggleTheme}
                className="w-11 h-11 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111827] hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 cursor-pointer shrink-0 transition-colors"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                aria-label={persisted.muted ? 'Unmute audio' : 'Mute audio'}
                onClick={onToggleMute}
                className="w-11 h-11 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111827] hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 cursor-pointer shrink-0 transition-colors"
              >
                {persisted.muted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Sub-header context line */}
        <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1 max-w-2xl">
            <h2 className="text-lg sm:text-xl font-semibold text-neutral-900 dark:text-white text-balance">
              {mode === 'daily'
                ? 'Today’s Calibrated Perceptual Series'
                : 'Endless Practice — Randomized Targets'}
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {mode === 'daily'
                ? 'Every player gets the exact same seeded targets today. Five fast rounds per series, scored 0–100 with instant ghost overlays.'
                : 'Train any discipline indefinitely with fresh random seeds. Practice runs update your personal bests without affecting daily records.'}
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums text-neutral-500 dark:text-neutral-400 whitespace-nowrap shrink-0">
            {mode === 'daily'
              ? `${completedTodayCount} / 4 daily sets done`
              : `${persisted.totalRunsCompleted} total runs`}
          </div>
        </section>

        {/* 2x2 Series + Daily Shuffle Grid */}
        <main className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {allCards.map((series, index) => {
            const dailyRecord =
              persisted.dailyCompletions[getDailyCompletionKey(dateStr, series.id)];
            const bestScore = persisted.highScores[series.id];
            const isDailyCompleted = mode === 'daily' && Boolean(dailyRecord);

            return (
              <article
                key={series.id}
                data-testid={`series-card-${series.id}`}
                className="bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-5 flex flex-col justify-between gap-4 transition-shadow hover:shadow-sm"
              >
                <div className="space-y-3">
                  {/* Top row: Icon + Series Identifier + Status Text */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: isDark
                            ? `${series.accentColor}24`
                            : series.accentLight,
                        }}
                      >
                        <SeriesIcon name={series.iconName} color={series.accentColor} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                          <span
                            className="font-mono font-semibold"
                            style={{ color: isDark ? undefined : series.accentColor }}
                          >
                            {series.numberLabel}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{series.subtitle}</span>
                        </div>
                        <h3 className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight truncate">
                          {series.title}
                        </h3>
                      </div>
                    </div>

                    {/* Unboxed Status Metadata */}
                    <div className="text-right shrink-0">
                      {isDailyCompleted && dailyRecord ? (
                        <div className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            {dailyRecord.averageScore} ({dailyRecord.rank})
                          </span>
                        </div>
                      ) : typeof bestScore === 'number' ? (
                        <div className="text-xs font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
                          Best {bestScore}
                        </div>
                      ) : (
                        <div className="text-xs font-mono text-neutral-400 dark:text-neutral-500">
                          5 rounds
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description of the 5 tests */}
                  <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    {series.description}
                  </p>
                </div>

                {/* Action Footer */}
                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    data-start={index === 0 ? 'true' : undefined}
                    onClick={() => {
                      soundEngine.unlock();
                      soundEngine.playTap();
                      // First daily run uses today's seeded targets; replays automatically roll fresh targets
                      onStartSeries(series, isDailyCompleted ? 'practice' : undefined);
                    }}
                    className="flex-1 min-h-[46px] px-4 rounded-xl text-sm font-semibold text-white inline-flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer whitespace-nowrap"
                    style={{ backgroundColor: series.accentColor }}
                  >
                    <span>
                      {mode === 'practice'
                        ? `Practice ${series.numberLabel}`
                        : isDailyCompleted
                          ? 'Play Again'
                          : 'Play Now'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {isDailyCompleted && dailyRecord && (
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playTap();
                        onViewCompletedSummary(series, dailyRecord);
                      }}
                      className="min-h-[46px] px-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-100 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      View Score
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </main>

        {/* Secondary Row: Challenge a Friend + Custom Mix + Badges */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {/* Challenge a Friend Card */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 flex flex-col justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 text-xs font-mono text-violet-600 dark:text-violet-400 font-semibold">
                <span>Head-to-Head</span>
                <span aria-hidden="true">·</span>
                <span>Seeded Link</span>
              </div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Challenge a Friend
              </h3>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                Send 5 games with swap rules and compare scores.
              </p>
            </div>
            <button
              type="button"
              data-testid="hub-challenge-btn"
              onClick={() => {
                soundEngine.unlock();
                soundEngine.playTap();
                onOpenChallengeBuilder();
              }}
              className="w-full min-h-[44px] px-4 rounded-xl bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
            >
              <Swords className="w-4 h-4" />
              <span>Challenge Link</span>
            </button>
          </div>

          {/* Custom Mix Builder Card */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 flex flex-col justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 dark:text-neutral-400">
                <span>Custom Mix</span>
                <span aria-hidden="true">·</span>
                <span>15 Tests</span>
              </div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Build Your Own Mix
              </h3>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                Cherry-pick any 5 tests across Spatial, Color, and Time.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                soundEngine.unlock();
                soundEngine.playTap();
                onOpenCustomMix();
              }}
              className="w-full min-h-[44px] px-4 rounded-xl bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 active:scale-[0.99] text-white dark:text-neutral-900 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Custom Mix</span>
            </button>
          </div>

          {/* Badges & Mastery Summary Card */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 flex flex-col justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 dark:text-neutral-400 tabular-nums">
                <span>
                  {persisted.unlockedBadges.length}/{BADGE_DEFINITIONS.length} Badges
                </span>
                <span aria-hidden="true">·</span>
                <span>{persisted.totalSRankRounds} S-Ranks</span>
              </div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Calibration Milestones
              </h3>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                Saved locally on your device — works fully offline.
              </p>
            </div>
            <button
              type="button"
              aria-expanded={showBadges}
              onClick={() => {
                soundEngine.playTap();
                setShowBadges((v) => !v);
              }}
              className="w-full min-h-[44px] px-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-100 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>{showBadges ? 'Hide Badges' : 'View Badges'}</span>
            </button>
          </div>
        </section>

        {/* Expandable Badges Grid */}
        {showBadges && (
          <section className="bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                Unlocked Mastery Badges
              </h3>
              <span className="text-xs font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
                {persisted.unlockedBadges.length} of {BADGE_DEFINITIONS.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {BADGE_DEFINITIONS.map((badge) => {
                const unlocked = persisted.unlockedBadges.includes(badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`rounded-xl border p-3.5 space-y-1 ${
                      unlocked
                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/30'
                        : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/50 opacity-65'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                        {badge.title}
                      </span>
                      <span
                        className={`text-[11px] font-mono font-semibold ${
                          unlocked
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-neutral-400 dark:text-neutral-500'
                        }`}
                      >
                        {unlocked ? 'Unlocked' : 'Locked'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      {badge.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
