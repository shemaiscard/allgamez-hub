import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Home,
  RotateCcw,
  Share2,
  Swords,
  Trophy,
} from 'lucide-react';
import type { BadgeDef, GameMode, RoundResult, SeriesDef } from '../types/game';
import {
  calculateAverageScore,
  formatShareText,
  getLetterRank,
  getRankStyle,
  getScoreEmoji,
} from '../utils/scoring';
import {
  type ActiveChallengeContext,
  computeHeadToHead,
} from '../utils/challenge';
import { soundEngine } from '../utils/audio';

interface SummaryScreenProps {
  series: SeriesDef;
  rounds: RoundResult[];
  mode: GameMode;
  dateStr: string;
  nextSeries: SeriesDef | null;
  newlyUnlockedBadges: BadgeDef[];
  activeChallenge?: ActiveChallengeContext | null;
  onOpenChallengeModal: () => void;
  onPlayNextSeries: (next: SeriesDef) => void;
  onReplayPractice: () => void;
  onBackToHub: () => void;
}

export function SummaryScreen({
  series,
  rounds,
  mode,
  dateStr,
  nextSeries,
  newlyUnlockedBadges,
  activeChallenge = null,
  onOpenChallengeModal,
  onPlayNextSeries,
  onReplayPractice,
  onBackToHub,
}: SummaryScreenProps) {
  const [copied, setCopied] = useState(false);

  const avgScore = calculateAverageScore(rounds);
  const rank = getLetterRank(avgScore);
  const rankStyle = getRankStyle(rank);

  const h2h = useMemo(
    () => (activeChallenge ? computeHeadToHead(rounds, activeChallenge) : null),
    [activeChallenge, rounds]
  );

  useEffect(() => {
    soundEngine.playSeriesComplete(avgScore);
  }, [avgScore]);

  const shareString = formatShareText({
    seriesTitle: series.title,
    seriesNumberLabel: series.numberLabel,
    dateStr,
    mode,
    rounds,
  });

  const handleCopyShare = async () => {
    soundEngine.playTap();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareString);
      } else {
        const area = document.createElement('textarea');
        area.value = shareString;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0F17] text-[#111827] dark:text-[#F3F4F6] py-5 sm:py-7 px-4 sm:px-6 transition-colors">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Top Meta Header */}
        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <span>
            {series.numberLabel === series.title
              ? series.title
              : `${series.numberLabel} · ${series.title}`}{' '}
            · {activeChallenge ? 'Friend Duel' : mode === 'daily' ? dateStr : 'Practice Mode'}
          </span>
          <span className="font-mono">5 Rounds Complete</span>
        </div>

        {/* Head-to-Head Duel Verdict Card (when playing a Friend Challenge) */}
        {h2h && (
          <section
            data-testid="h2h-verdict-card"
            className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              h2h.verdict === 'win'
                ? 'bg-emerald-50/80 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-800'
                : h2h.verdict === 'loss'
                  ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
                  : 'bg-violet-50/70 dark:bg-violet-950/35 border-violet-200 dark:border-violet-800'
            }`}
          >
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-neutral-600 dark:text-neutral-300">
                <Trophy className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                <span>Head-to-Head vs {h2h.challengerName}</span>
              </div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                {h2h.verdict === 'win'
                  ? `You beat ${h2h.challengerName}!`
                  : h2h.verdict === 'loss'
                    ? `${h2h.challengerName} took this round`
                    : h2h.verdict === 'tie'
                      ? `Dead heat with ${h2h.challengerName}!`
                      : h2h.verdict === 'remixed'
                        ? `Full remix complete: send it back to ${h2h.challengerName}!`
                        : `Score set: send back to ${h2h.challengerName}!`}
              </h2>
              {h2h.hasChallengerScores && h2h.matchedCount > 0 && (
                <p className="text-xs text-neutral-600 dark:text-neutral-300">
                  Matched rounds ({h2h.matchedCount}/5): You{' '}
                  <strong className="font-mono">{h2h.myMatchedAvg}</strong> vs{' '}
                  {h2h.challengerName}{' '}
                  <strong className="font-mono">{h2h.challengerMatchedAvg}</strong>{' '}
                  ({h2h.wins}W · {h2h.losses}L
                  {h2h.ties > 0 ? ` · ${h2h.ties}T` : ''})
                </p>
              )}
            </div>

            {h2h.hasChallengerScores && h2h.challengerOverallAvg !== null && (
              <div className="flex items-center gap-3 shrink-0 font-mono">
                <div className="text-center px-3 py-1.5 rounded-xl bg-white/80 dark:bg-[#111827]/80 border border-neutral-200/80 dark:border-neutral-800">
                  <div className="text-[10px] text-neutral-400">YOU</div>
                  <div className="text-lg font-bold text-neutral-900 dark:text-white tabular-nums">
                    {h2h.myOverallAvg}
                  </div>
                </div>
                <span className="text-xs text-neutral-400">vs</span>
                <div className="text-center px-3 py-1.5 rounded-xl bg-white/80 dark:bg-[#111827]/80 border border-neutral-200/80 dark:border-neutral-800">
                  <div className="text-[10px] text-neutral-400 truncate max-w-[70px]">
                    {h2h.challengerName.toUpperCase()}
                  </div>
                  <div className="text-lg font-bold text-neutral-900 dark:text-white tabular-nums">
                    {h2h.challengerOverallAvg}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Hero Score Card */}
        <section className="bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Final Average Score
            </p>
            <div className="flex items-baseline gap-2">
              <span
                data-testid="summary-final-score"
                className="font-mono text-5xl sm:text-6xl font-bold tracking-tight tabular-nums text-neutral-900 dark:text-white"
              >
                {avgScore}
              </span>
              <span className="font-mono text-lg text-neutral-400 dark:text-neutral-500">/100</span>
            </div>
            <div
              className="text-base tracking-wider pt-0.5"
              aria-label="Emoji score strip"
            >
              {rounds.map((r) => getScoreEmoji(r.score)).join('')}
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 border-t sm:border-t-0 pt-3 sm:pt-0 border-neutral-100 dark:border-neutral-800">
            <div
              data-testid="summary-rank-badge"
              className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center font-display text-3xl font-bold ${rankStyle.bg} ${rankStyle.text} ${rankStyle.border}`}
            >
              {rank}
            </div>
            <span className="text-xs sm:text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              Rank {rank} · {rankStyle.label}
            </span>
          </div>
        </section>

        {/* Newly Unlocked Badges Notification */}
        {newlyUnlockedBadges.length > 0 && (
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-emerald-200 dark:border-emerald-800 px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
            <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
              Badge{newlyUnlockedBadges.length > 1 ? 's' : ''} Unlocked:
            </span>
            {newlyUnlockedBadges.map((b) => (
              <span key={b.id} className="font-medium text-neutral-800 dark:text-neutral-200">
                {b.title}:{' '}
                <span className="text-neutral-500 dark:text-neutral-400 font-normal">
                  {b.description}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* 5-Round Breakdown Table */}
        <section className="bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div className="px-5 py-2.5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
              Round-by-Round Calibration
            </h2>
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              {h2h ? `Target vs. Yours vs. ${h2h.challengerName}` : 'Target vs. Yours'}
            </span>
          </div>

          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {rounds.map((r, idx) => {
              const rRank = getLetterRank(r.score);
              const rStyle = getRankStyle(rRank);
              const h2hRound = h2h?.rounds[idx];
              return (
                <li
                  key={`${r.gameId}-${idx}`}
                  className="px-5 py-2.5 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500 tabular-nums">
                        0{idx + 1}
                      </span>
                      <span className="font-semibold text-sm text-neutral-900 dark:text-white truncate">
                        {r.gameName}
                      </span>
                      {h2hRound?.status === 'swapped' && (
                        <span className="text-[11px] font-mono font-semibold text-violet-600 dark:text-violet-400">
                          Swapped in
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 pl-6 text-xs text-neutral-500 dark:text-neutral-400 flex flex-wrap items-center gap-x-2">
                      <span>
                        Target:{' '}
                        <strong className="font-mono font-medium text-neutral-800 dark:text-neutral-200">
                          {r.targetLabel}
                        </strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Yours:{' '}
                        <strong className="font-mono font-medium text-neutral-800 dark:text-neutral-200">
                          {r.userLabel}
                        </strong>
                      </span>
                      {h2hRound && h2hRound.challengerScore !== null && h2hRound.delta !== null && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-mono font-semibold ${
                              h2hRound.delta > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : h2hRound.delta < 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-neutral-500 dark:text-neutral-400'
                            }`}
                          >
                            vs {h2hRound.challengerScore} (
                            {h2hRound.delta > 0 ? `+${h2hRound.delta}` : h2hRound.delta})
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-mono text-sm font-bold tabular-nums text-neutral-900 dark:text-white">
                      {r.score}
                    </span>
                    <span
                      className={`w-6 h-6 rounded-md border flex items-center justify-center font-mono text-xs font-bold ${rStyle.bg} ${rStyle.text} ${rStyle.border}`}
                    >
                      {rRank}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Share Card Preview + Action Buttons */}
        <div className="space-y-2.5">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#111827] px-4 py-2.5 font-mono text-xs text-neutral-600 dark:text-neutral-300 break-words">
            {shareString}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              data-testid="summary-challenge-friend-btn"
              onClick={() => {
                soundEngine.playTap();
                onOpenChallengeModal();
              }}
              className="min-h-[46px] rounded-xl bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Swords className="w-4 h-4" />
              <span>
                {activeChallenge
                  ? 'Send Counter-Challenge'
                  : 'Challenge a Friend'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleCopyShare}
              className="min-h-[46px] rounded-xl bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 active:scale-[0.99] text-white dark:text-neutral-900 font-semibold text-sm inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>Share Result</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {!activeChallenge && nextSeries && mode === 'daily' ? (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playTap();
                  onPlayNextSeries(nextSeries);
                }}
                className="min-h-[44px] rounded-xl text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99]"
                style={{ backgroundColor: nextSeries.accentColor }}
              >
                <span>Play Next: {nextSeries.numberLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : null}

            {!activeChallenge && (
              <button
                type="button"
                data-testid="summary-replay-new-btn"
                onClick={() => {
                  soundEngine.playTap();
                  onReplayPractice();
                }}
                className={`${
                  nextSeries && mode === 'daily'
                    ? 'border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#111827] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-900 dark:text-white'
                    : 'text-white'
                } min-h-[44px] rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99]`}
                style={
                  nextSeries && mode === 'daily'
                    ? undefined
                    : { backgroundColor: series.accentColor }
                }
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play Again (New Targets)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                soundEngine.playTap();
                onBackToHub();
              }}
              className={`${
                !activeChallenge && (!nextSeries || mode !== 'daily')
                  ? ''
                  : 'sm:col-span-2'
              } min-h-[44px] rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111827] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 font-medium text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer`}
            >
              <Home className="w-4 h-4" />
              <span>Back to Collection Hub</span>
            </button>
          </div>
        </div>
      </div>

      {/* Accessible Copied Toast anchored safely at top-center */}
      {copied && (
        <div
          role="status"
          aria-live="polite"
          data-testid="copied-toast"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-4 py-2.5 text-sm font-medium shadow-lg flex items-center gap-2"
        >
          <Check className="w-4 h-4 text-emerald-500" />
          <span>Result copied to clipboard!</span>
        </div>
      )}
    </div>
  );
}
