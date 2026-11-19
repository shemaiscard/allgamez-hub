import { useCallback, useState } from 'react';
import { ArrowLeft, Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import type {
  GameMode,
  MiniGameOutcome,
  RoundResult,
  SeriesDef,
  ThemeMode,
} from '../types/game';
import { soundEngine } from '../utils/audio';

interface GameRunnerProps {
  series: SeriesDef;
  baseSeed: string;
  mode: GameMode;
  muted: boolean;
  theme: ThemeMode;
  onToggleMute: () => void;
  onToggleTheme: () => void;
  onQuitToHub: () => void;
  onFinishSeries: (rounds: RoundResult[]) => void;
}

export function GameRunner({
  series,
  baseSeed,
  mode,
  muted,
  theme,
  onToggleMute,
  onToggleTheme,
  onQuitToHub,
  onFinishSeries,
}: GameRunnerProps) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);

  const activeGame = series.games[roundIndex];
  const totalRounds = series.games.length;
  const isDark = theme === 'dark';

  const handleRoundComplete = useCallback(
    (outcome: MiniGameOutcome) => {
      const roundResult: RoundResult = {
        ...outcome,
        gameId: activeGame.id,
        gameName: activeGame.name,
        seriesId: activeGame.seriesId,
      };

      const nextResults = [...results, roundResult];
      if (roundIndex + 1 >= totalRounds) {
        onFinishSeries(nextResults);
      } else {
        setResults(nextResults);
        setRoundIndex((idx) => idx + 1);
      }
    },
    [activeGame, results, roundIndex, totalRounds, onFinishSeries]
  );

  if (!activeGame) return null;

  const ActiveComponent = activeGame.component;
  const roundSeed = `${baseSeed}::r${roundIndex + 1}::${activeGame.id}`;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] dark:bg-[#0B0F17] text-[#111827] dark:text-[#F3F4F6] transition-colors">
      {/* Unified Top Progress Header */}
      <header className="sticky top-0 z-20 bg-[#FAFAFA]/95 dark:bg-[#0B0F17]/95 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              soundEngine.playTap();
              onQuitToHub();
            }}
            className="inline-flex items-center gap-1.5 min-h-[44px] pr-2 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quit to Hub</span>
          </button>

          {/* Center Series Title & Round Dots */}
          <div className="flex flex-col items-center min-w-0">
            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 truncate max-w-[160px] sm:max-w-none">
              {series.numberLabel === series.title
                ? series.title
                : `${series.numberLabel} · ${series.title}`}
            </div>
            <div
              className="flex items-center gap-2 mt-1.5"
              aria-label={`Round ${roundIndex + 1} of ${totalRounds}`}
            >
              {series.games.map((g, idx) => {
                const done = idx < roundIndex;
                const current = idx === roundIndex;
                return (
                  <div
                    key={g.id}
                    className={`h-2 rounded-full transition-all duration-200 ${
                      current ? 'w-6' : 'w-2'
                    }`}
                    style={{
                      backgroundColor: done
                        ? '#10B981'
                        : current
                          ? series.accentColor
                          : isDark
                            ? '#374151'
                            : '#D1D5DB',
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="hidden sm:inline text-xs font-mono text-neutral-400 dark:text-neutral-500 mr-1">
              {mode === 'daily' ? 'Daily' : 'Practice'}
            </span>
            <button
              type="button"
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={onToggleTheme}
              className="w-10 h-10 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111827] hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 cursor-pointer"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              onClick={onToggleMute}
              className="w-10 h-10 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111827] hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 cursor-pointer"
            >
              {muted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Active Mini-Game Stage */}
      <main className="flex-1 flex flex-col justify-center px-4 sm:px-6 py-6 sm:py-10">
        <div className="w-full max-w-xl mx-auto space-y-5">
          {/* Round Kicker & Game Name */}
          <div className="flex items-baseline justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
            <div>
              <p
                className="text-xs font-mono font-semibold"
                style={{ color: series.accentColor }}
              >
                Round {roundIndex + 1} of {totalRounds}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mt-0.5">
                {activeGame.name}
              </h1>
            </div>
            {results.length > 0 && (
              <div className="text-right text-xs font-mono text-neutral-500 dark:text-neutral-400 tabular-nums">
                Last: {results[results.length - 1].score}/100
              </div>
            )}
          </div>

          {/* Mount each round with a clean key so internal state resets completely */}
          <ActiveComponent
            key={roundSeed}
            seed={roundSeed}
            accentColor={series.accentColor}
            onComplete={handleRoundComplete}
          />
        </div>
      </main>
    </div>
  );
}
