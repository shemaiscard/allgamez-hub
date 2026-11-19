import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Lock,
  RefreshCw,
  Share2,
  SlidersHorizontal,
  Swords,
  X,
} from 'lucide-react';
import {
  ALL_MINI_GAMES,
  SERIES_CONFIG,
  buildDailyShuffleSeries,
} from '../config/seriesConfig';
import {
  type ChallengeEditRule,
  type ChallengePayload,
  buildChallengeUrl,
  getRuleCopy,
  sanitizeChallengerName,
} from '../utils/challenge';
import { makePracticeSeed } from '../utils/prng';
import { soundEngine } from '../utils/audio';

interface ChallengeModalProps {
  /** Pre-populated game IDs (from a completed run or default Hub selection) */
  initialGameIds: string[];
  /** Seed to embed in the link (same seed as completed run so friend gets identical targets) */
  initialSeed: string;
  /** Optional 5-round scores from the sender's completed run */
  senderScores?: number[];
  /** Optional label like "Series 1" or "Counter-Challenge" */
  seriesLabel?: string;
  /** Whether the sender can edit the 5-game lineup right inside this modal (true from Hub, false from Summary) */
  allowLineupSelection?: boolean;
  /** True when sending a counter-challenge back after playing a friend's link */
  isCounterChallenge?: boolean;
  initialPlayerName: string;
  dateStr: string;
  onSavePlayerName: (name: string) => void;
  onPreviewChallenge: (payload: ChallengePayload) => void;
  onClose: () => void;
}

const RULES: ChallengeEditRule[] = ['swap1', 'lock', 'free'];

export function ChallengeModal({
  initialGameIds,
  initialSeed,
  senderScores,
  seriesLabel,
  allowLineupSelection = false,
  isCounterChallenge = false,
  initialPlayerName,
  dateStr,
  onSavePlayerName,
  onPreviewChallenge,
  onClose,
}: ChallengeModalProps) {
  const [playerName, setPlayerName] = useState(initialPlayerName);
  const [rule, setRule] = useState<ChallengeEditRule>('swap1');
  const [gameIds, setGameIds] = useState<string[]>(initialGameIds.slice(0, 5));
  const [seed, setSeed] = useState<string>(initialSeed);
  const [label, setLabel] = useState<string>(seriesLabel ?? 'Custom Challenge');
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const gameMap = useMemo(
    () => new Map(ALL_MINI_GAMES.map((g) => [g.id, g])),
    []
  );

  const payload: ChallengePayload = useMemo(
    () => ({
      v: 1,
      seed,
      gameIds,
      rule,
      challengerName: sanitizeChallengerName(playerName),
      challengerScores:
        senderScores && senderScores.length === 5 ? senderScores : undefined,
      seriesLabel: label,
    }),
    [seed, gameIds, rule, playerName, senderScores, label]
  );

  const challengeUrl = useMemo(() => buildChallengeUrl(payload), [payload]);

  const isReady = gameIds.length === 5;

  const handleCopyLink = async () => {
    if (!isReady) return;
    soundEngine.playTap();
    onSavePlayerName(playerName.trim().slice(0, 24));
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(challengeUrl);
      } else {
        const area = document.createElement('textarea');
        area.value = challengeUrl;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    }
  };

  const handleNativeShare = async () => {
    if (!isReady || typeof navigator.share !== 'function') return;
    soundEngine.playTap();
    onSavePlayerName(playerName.trim().slice(0, 24));
    const avg =
      senderScores && senderScores.length === 5
        ? Math.round(senderScores.reduce((a, b) => a + b, 0) / 5)
        : null;
    try {
      await navigator.share({
        title: `Gamez Challenge from ${sanitizeChallengerName(playerName)}`,
        text:
          avg !== null
            ? `I scored ${avg}/100 on Gamez (${label}). Think you can beat me?`
            : `Try my 5-round Gamez perceptual challenge!`,
        url: challengeUrl,
      });
    } catch {
      // User dismissed native share sheet
    }
  };

  const selectPreset = (presetId: string) => {
    soundEngine.playTap();
    setShowCustomPicker(false);
    if (presetId === 'daily-shuffle') {
      const s = makePracticeSeed('challenge-shuffle');
      const shuffle = buildDailyShuffleSeries(s);
      setGameIds(shuffle.games.map((g) => g.id));
      setSeed(s);
      setLabel('Shuffle Duel');
      return;
    }
    const found = SERIES_CONFIG.find((s) => s.id === presetId);
    if (found) {
      setGameIds(found.games.map((g) => g.id));
      setSeed(makePracticeSeed(`challenge-${found.id}-${dateStr}`));
      setLabel(found.title);
    }
  };

  const toggleCustomGame = (id: string) => {
    soundEngine.playTap();
    setGameIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
    setLabel('Custom Duel');
  };

  const hasNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isCounterChallenge ? 'Send Counter-Challenge' : 'Challenge a Friend'}
      data-testid="challenge-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 dark:bg-black/75 backdrop-blur-xs p-4"
    >
      <div className="bg-white dark:bg-[#111827] w-full max-w-xl max-h-[90vh] rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 flex items-center justify-center shrink-0">
              <Swords className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white truncate">
                {isCounterChallenge
                  ? 'Send Counter-Challenge'
                  : 'Challenge a Friend'}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {senderScores
                  ? 'Your exact 5 targets and scores are locked into this link.'
                  : 'Pick 5 games, set edit rules, and send a direct duel link.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close Challenge Modal"
            onClick={() => {
              soundEngine.playTap();
              onClose();
            }}
            className="w-9 h-9 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-500 dark:text-neutral-400 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Sender Display Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="challenger-name-input"
              className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300"
            >
              Your Display Name
            </label>
            <input
              id="challenger-name-input"
              data-testid="challenger-name-input"
              type="text"
              maxLength={24}
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g. Alex (optional)"
              className="w-full h-11 px-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Friend Edit Permission Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Friend Lineup Permission
              </span>
              <span className="text-[11px] font-mono text-neutral-400 dark:text-neutral-500">
                Set by you
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {RULES.map((r) => {
                const copy = getRuleCopy(r);
                const active = rule === r;
                const Icon =
                  r === 'lock'
                    ? Lock
                    : r === 'swap1'
                      ? RefreshCw
                      : SlidersHorizontal;
                return (
                  <button
                    key={r}
                    type="button"
                    data-testid={`rule-${r}`}
                    aria-pressed={active}
                    onClick={() => {
                      soundEngine.playTap();
                      setRule(r);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer space-y-1 ${
                      active
                        ? 'border-violet-600 dark:border-violet-400 bg-violet-50/70 dark:bg-violet-950/40 ring-1 ring-violet-600/30 dark:ring-violet-400/30'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 hover:border-neutral-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          active
                            ? 'text-violet-700 dark:text-violet-300'
                            : 'text-neutral-400 dark:text-neutral-500'
                        }`}
                      />
                      <span
                        className={`text-xs font-bold ${
                          active
                            ? 'text-violet-900 dark:text-violet-100'
                            : 'text-neutral-800 dark:text-neutral-200'
                        }`}
                      >
                        {copy.label}
                      </span>
                    </div>
                    <p className="text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">
                      {copy.senderDescription}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lineup Selection (when opened from Hub) or Compact Preview (from Summary) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                5-Round Lineup ({gameIds.length}/5)
              </span>
              {allowLineupSelection && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playTap();
                    setShowCustomPicker((v) => !v);
                  }}
                  className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                >
                  {showCustomPicker ? 'Done Picking' : 'Customize Games'}
                </button>
              )}
            </div>

            {allowLineupSelection && (
              <div className="flex flex-wrap gap-1.5">
                {SERIES_CONFIG.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectPreset(s.id)}
                    className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer transition-colors"
                  >
                    {s.numberLabel}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => selectPreset('daily-shuffle')}
                  className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer transition-colors"
                >
                  Random 5
                </button>
              </div>
            )}

            {showCustomPicker && allowLineupSelection ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {ALL_MINI_GAMES.map((g) => {
                  const selected = gameIds.includes(g.id);
                  const disabled = !selected && gameIds.length >= 5;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleCustomGame(g.id)}
                      className={`px-3 py-2 rounded-lg border text-left text-xs flex items-center justify-between gap-2 cursor-pointer transition-all ${
                        selected
                          ? 'border-violet-600 dark:border-violet-400 bg-violet-50/70 dark:bg-violet-950/40 text-neutral-900 dark:text-white font-semibold'
                          : disabled
                            ? 'border-neutral-100 dark:border-neutral-800/60 text-neutral-400 dark:text-neutral-600 opacity-50 cursor-not-allowed'
                            : 'border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700'
                      }`}
                    >
                      <span className="truncate">{g.name}</span>
                      {selected && (
                        <Check className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <ol className="rounded-xl border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40">
                {gameIds.map((id, idx) => {
                  const g = gameMap.get(id);
                  return (
                    <li
                      key={`${id}-${idx}`}
                      className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-neutral-400 dark:text-neutral-500">
                          0{idx + 1}
                        </span>
                        <span className="font-semibold text-neutral-800 dark:text-neutral-100 truncate">
                          {g?.name ?? id}
                        </span>
                      </div>
                      {senderScores && typeof senderScores[idx] === 'number' && (
                        <span className="font-mono font-semibold text-neutral-600 dark:text-neutral-300 shrink-0">
                          {senderScores[idx]}/100
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Generated Link Box */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Shareable Challenge Link
            </span>
            <div
              data-testid="challenge-link-preview"
              className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3.5 py-2.5 font-mono text-[11px] text-neutral-600 dark:text-neutral-300 break-all select-all"
            >
              {isReady ? challengeUrl : 'Select 5 games to generate a challenge link.'}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            disabled={!isReady}
            data-testid="preview-challenge-btn"
            onClick={() => {
              if (!isReady) return;
              soundEngine.playTap();
              onSavePlayerName(playerName.trim().slice(0, 24));
              onPreviewChallenge(payload);
            }}
            className="min-h-[44px] px-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#111827] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open Link</span>
          </button>

          <div className="flex items-center gap-2">
            {hasNativeShare && (
              <button
                type="button"
                disabled={!isReady}
                onClick={handleNativeShare}
                className="min-h-[44px] px-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#111827] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>
            )}

            <button
              type="button"
              disabled={!isReady}
              data-testid="copy-challenge-link-btn"
              onClick={handleCopyLink}
              className="min-h-[44px] px-5 rounded-xl bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-40 transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
