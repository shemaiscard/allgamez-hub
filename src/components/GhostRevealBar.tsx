import { getLetterRank, getRankStyle } from '../utils/scoring';

interface GhostRevealBarProps {
  score: number;
  userLabel: string;
  targetLabel: string;
  detailText?: string;
}

export function GhostRevealBar({
  score,
  userLabel,
  targetLabel,
  detailText,
}: GhostRevealBarProps) {
  const rank = getLetterRank(score);
  const style = getRankStyle(rank);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="ghost-reveal"
      className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111827] px-4 py-3 flex items-center justify-between gap-4 shadow-xs"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 font-medium">
          <span className="inline-block w-2.5 h-2.5 rounded-xs bg-emerald-500" aria-hidden="true" />
          Target:{' '}
          <strong className="font-mono tabular-nums text-neutral-900 dark:text-white">
            {targetLabel}
          </strong>
        </span>
        <span className="inline-flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 font-medium">
          <span className="inline-block w-2.5 h-2.5 rounded-xs bg-blue-600 dark:bg-blue-500" aria-hidden="true" />
          Yours:{' '}
          <strong className="font-mono tabular-nums text-neutral-900 dark:text-white">
            {userLabel}
          </strong>
        </span>
        {detailText && (
          <span className="text-xs font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
            {detailText}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <span className="font-mono text-lg font-bold tabular-nums text-neutral-900 dark:text-white">
          {score}
          <span className="text-xs font-normal text-neutral-400 dark:text-neutral-500">/100</span>
        </span>
        <span
          className={`inline-flex items-center justify-center w-7 h-7 rounded-md border text-xs font-bold font-mono ${style.bg} ${style.text} ${style.border}`}
        >
          {rank}
        </span>
      </div>
    </div>
  );
}
