import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Lock,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Swords,
  X,
} from 'lucide-react';
import { ALL_MINI_GAMES, SERIES_CONFIG } from '../config/seriesConfig';
import {
  type ActiveChallengeContext,
  type ChallengePayload,
  getRuleCopy,
} from '../utils/challenge';
import {
  getLetterRank,
  getRankStyle,
  getScoreEmoji,
} from '../utils/scoring';
import { soundEngine } from '../utils/audio';

interface ChallengeLobbyProps {
  payload: ChallengePayload;
  onStartChallenge: (context: ActiveChallengeContext) => void;
  onBackToHub: () => void;
}

export function ChallengeLobby({
  payload,
  onStartChallenge,
  onBackToHub,
}: ChallengeLobbyProps) {
  const [lineup, setLineup] = useState<string[]>(payload.gameIds);
  const [swappingSlot, setSwappingSlot] = useState<number | null>(null);
  const [replacingAll, setReplacingAll] = useState(false);
  const [replaceDraft, setReplaceDraft] = useState<string[]>(payload.gameIds);

  const gameMap = useMemo(
    () => new Map(ALL_MINI_GAMES.map((g) => [g.id, g])),
    []
  );

  const swappedIndices = useMemo(() => {
    const indices: number[] = [];
    lineup.forEach((id, idx) => {
      if (id !== payload.gameIds[idx]) {
        indices.push(idx);
      }
    });
    return indices;
  }, [lineup, payload.gameIds]);

  const ruleCopy = getRuleCopy(payload.rule);
  const canSwapMore =
    payload.rule === 'free' ||
    (payload.rule === 'swap1' && swappedIndices.length < 1);

  const challengerAvg = useMemo(() => {
    if (!payload.challengerScores || payload.challengerScores.length !== 5) {
      return null;
    }
    return Math.round(
      payload.challengerScores.reduce((acc, s) => acc + s, 0) / 5
    );
  }, [payload.challengerScores]);

  const challengerRank =
    challengerAvg !== null ? getLetterRank(challengerAvg) : null;
  const challengerRankStyle = challengerRank
    ? getRankStyle(challengerRank)
    : null;

  const handleSelectReplacement = (slotIdx: number, newGameId: string) => {
    soundEngine.playTap();
    setLineup((prev) => {
      const next = [...prev];
      next[slotIdx] = newGameId;
      return next;
    });
    setSwappingSlot(null);
  };

  const handleUndoSlot = (slotIdx: number) => {
    soundEngine.playTap();
    setLineup((prev) => {
      const next = [...prev];
      next[slotIdx] = payload.gameIds[slotIdx];
      return next;
    });
    if (swappingSlot === slotIdx) setSwappingSlot(null);
  };

  const handleResetAll = () => {
    soundEngine.playTap();
    setLineup(payload.gameIds);
    setSwappingSlot(null);
  };

  const toggleDraftGame = (id: string) => {
    soundEngine.playTap();
    setReplaceDraft((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  const applyReplaceAll = () => {
    if (replaceDraft.length !== 5) return;
    soundEngine.playTap();
    setLineup(replaceDraft);
    setReplacingAll(false);
  };

  const handleStart = () => {
    soundEngine.unlock();
    soundEngine.playTap();
    onStartChallenge({
      payload,
      swappedIndices,
      playedGameIds: lineup,
    });
  };

  const RuleIcon =
    payload.rule === 'lock'
      ? Lock
      : payload.rule === 'swap1'
        ? RefreshCw
        : SlidersHorizontal;

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0F17] text-[#111827] dark:text-[#F3F4F6] py-6 sm:py-10 px-4 sm:px-6 transition-colors">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Top Navigation */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              soundEngine.playTap();
              onBackToHub();
            }}
            className="inline-flex items-center gap-1.5 min-h-[40px] text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Hub</span>
          </button>
          <span className="font-mono text-xs text-violet-600 dark:text-violet-400 font-semibold">
            {ruleCopy.shortLabel}
          </span>
        </div>

        {/* Challenger Hero Card */}
        <section
          data-testid="challenge-lobby-hero"
          className="bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="space-y-1.5 min-w-0">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-violet-600 dark:text-violet-400">
              <Swords className="w-3.5 h-3.5" />
              <span>Incoming Challenge</span>
              {payload.seriesLabel && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{payload.seriesLabel}</span>
                </>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
              {payload.challengerName} challenged you
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {challengerAvg !== null
                ? 'Play the exact same seeded targets to compare head-to-head.'
                : 'Open duel — complete all 5 rounds and send your score back.'}
            </p>
          </div>

          {challengerAvg !== null && challengerRank && challengerRankStyle && (
            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 border-t sm:border-t-0 pt-3 sm:pt-0 border-neutral-100 dark:border-neutral-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="text-right">
                  <div className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
                    Score to Beat
                  </div>
                  <div
                    data-testid="challenger-target-avg"
                    className="font-mono text-3xl font-bold tabular-nums text-neutral-900 dark:text-white leading-none"
                  >
                    {challengerAvg}
                    <span className="text-sm font-normal text-neutral-400 dark:text-neutral-500">
                      /100
                    </span>
                  </div>
                </div>
                <div
                  className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center font-display text-xl font-bold ${challengerRankStyle.bg} ${challengerRankStyle.text} ${challengerRankStyle.border}`}
                >
                  {challengerRank}
                </div>
              </div>
              {payload.challengerScores && (
                <div className="text-sm tracking-wider" aria-label="Challenger round strip">
                  {payload.challengerScores.map((s) => getScoreEmoji(s)).join('')}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Permission Rule Notice Bar */}
        <div
          data-testid="challenge-rule-banner"
          className="rounded-xl border border-violet-200 dark:border-violet-900/60 bg-violet-50/70 dark:bg-violet-950/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-start sm:items-center gap-2.5 text-xs sm:text-sm text-violet-950 dark:text-violet-100">
            <RuleIcon className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5 sm:mt-0" />
            <span>{ruleCopy.recipientBanner}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {payload.rule === 'swap1' && (
              <span
                data-testid="swap-counter"
                className="font-mono text-xs font-semibold text-violet-700 dark:text-violet-300"
              >
                {swappedIndices.length}/1 swapped
              </span>
            )}
            {payload.rule === 'free' && (
              <button
                type="button"
                data-testid="replace-all-btn"
                onClick={() => {
                  soundEngine.playTap();
                  setReplaceDraft(lineup);
                  setReplacingAll(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                Replace Entire Lineup
              </button>
            )}
            {swappedIndices.length > 0 && (
              <button
                type="button"
                onClick={handleResetAll}
                className="px-2.5 py-1.5 rounded-lg border border-violet-300 dark:border-violet-700 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-100/60 dark:hover:bg-violet-900/40 inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* 5-Game Lineup Card */}
        <section className="bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
              5-Round Lineup
            </h2>
            <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500">
              {swappedIndices.length > 0
                ? `${swappedIndices.length} modified`
                : 'Original 5'}
            </span>
          </div>

          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {lineup.map((gameId, idx) => {
              const game = gameMap.get(gameId);
              const originalGame = gameMap.get(payload.gameIds[idx]);
              const isSwapped = gameId !== payload.gameIds[idx];
              const isEditingThis = swappingSlot === idx;
              const otherIds = new Set(lineup.filter((_, i) => i !== idx));

              return (
                <li
                  key={`slot-${idx}`}
                  data-testid={`challenge-slot-${idx}`}
                  className="px-5 py-3.5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500 tabular-nums">
                          0{idx + 1}
                        </span>
                        <span className="font-semibold text-sm text-neutral-900 dark:text-white truncate">
                          {game?.name ?? gameId}
                        </span>
                        {isSwapped && (
                          <span className="text-[11px] font-mono font-semibold text-violet-600 dark:text-violet-400">
                            Swapped
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 pl-6 text-xs text-neutral-500 dark:text-neutral-400">
                        {isSwapped && originalGame
                          ? `Replaced ${originalGame.name} — send back after playing so ${payload.challengerName} tries this too.`
                          : game?.shortDesc}
                      </p>
                    </div>

                    {payload.rule !== 'lock' && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isSwapped && (
                          <button
                            type="button"
                            data-testid={`undo-swap-${idx}`}
                            onClick={() => handleUndoSlot(idx)}
                            className="min-h-[36px] px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                          >
                            Undo
                          </button>
                        )}
                        <button
                          type="button"
                          data-testid={`swap-slot-${idx}`}
                          disabled={!isSwapped && !canSwapMore}
                          onClick={() => {
                            soundEngine.playTap();
                            setSwappingSlot(isEditingThis ? null : idx);
                          }}
                          className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                            isEditingThis
                              ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                              : !isSwapped && !canSwapMore
                                ? 'border border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-600 opacity-50 cursor-not-allowed'
                                : 'border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-100'
                          }`}
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>{isEditingThis ? 'Cancel' : 'Swap'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Inline Replacement Picker for this slot */}
                  {isEditingThis && (
                    <div
                      data-testid={`swap-picker-${idx}`}
                      className="pl-6 pt-1 space-y-2"
                    >
                      <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                        Pick a replacement game for Round {idx + 1}:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                        {ALL_MINI_GAMES.filter((g) => !otherIds.has(g.id)).map(
                          (candidate) => {
                            const isCurrent = candidate.id === gameId;
                            return (
                              <button
                                key={candidate.id}
                                type="button"
                                data-testid={`swap-option-${candidate.id}`}
                                onClick={() =>
                                  handleSelectReplacement(idx, candidate.id)
                                }
                                className={`px-3 py-2 rounded-lg border text-left text-xs flex items-center justify-between gap-2 cursor-pointer transition-all ${
                                  isCurrent
                                    ? 'border-violet-600 dark:border-violet-400 bg-violet-50/70 dark:bg-violet-950/40 text-neutral-900 dark:text-white font-semibold'
                                    : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-violet-400 text-neutral-800 dark:text-neutral-200'
                                }`}
                              >
                                <span className="truncate">{candidate.name}</span>
                                {isCurrent && (
                                  <Check className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                                )}
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Primary Launch CTA */}
        <button
          type="button"
          data-testid="start-challenge-btn"
          onClick={handleStart}
          className="w-full min-h-[52px] rounded-xl bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-white font-semibold text-base inline-flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
        >
          <span>
            {swappedIndices.length > 0
              ? 'Start Modified 5-Round Challenge'
              : 'Accept & Start 5-Round Challenge'}
          </span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Replace Entire Lineup Modal (when rule === 'free') */}
      {replacingAll && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Replace Entire Challenge Lineup"
          data-testid="replace-all-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 dark:bg-black/75 backdrop-blur-xs p-4"
        >
          <div className="bg-white dark:bg-[#111827] w-full max-w-2xl max-h-[88vh] rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                  Replace Entire Lineup
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Choose any 5 games ({replaceDraft.length}/5 selected)
                </p>
              </div>
              <button
                type="button"
                aria-label="Close Replace All Modal"
                onClick={() => setReplacingAll(false)}
                className="w-9 h-9 rounded-lg border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {SERIES_CONFIG.map((series) => (
                <div key={series.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-xs"
                      style={{ backgroundColor: series.accentColor }}
                    />
                    <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      {series.numberLabel} · {series.title}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {series.games.map((g) => {
                      const selected = replaceDraft.includes(g.id);
                      const disabled = !selected && replaceDraft.length >= 5;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          disabled={disabled}
                          data-testid={`replace-all-option-${g.id}`}
                          onClick={() => toggleDraftGame(g.id)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            selected
                              ? 'border-violet-600 dark:border-violet-400 bg-violet-50/60 dark:bg-violet-950/40'
                              : disabled
                                ? 'border-neutral-100 dark:border-neutral-800/60 opacity-45 cursor-not-allowed'
                                : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                              {g.name}
                            </div>
                            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                              {g.shortDesc}
                            </div>
                          </div>
                          {selected && (
                            <Check className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setReplaceDraft([])}
                className="min-h-[42px] px-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#111827] text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                Clear All
              </button>
              <button
                type="button"
                disabled={replaceDraft.length !== 5}
                data-testid="apply-replace-all-btn"
                onClick={applyReplaceAll}
                className="min-h-[42px] px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold cursor-pointer disabled:opacity-40 transition-colors"
              >
                Apply New 5 Games ({replaceDraft.length}/5)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
