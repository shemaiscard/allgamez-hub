import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, RotateCw } from 'lucide-react';
import type { MiniGameProps } from '../../types/game';
import { createRng, randRange } from '../../utils/prng';
import { scoreAlignmentLevel } from '../../utils/scoring';
import { soundEngine } from '../../utils/audio';
import { GhostRevealBar } from '../../components/GhostRevealBar';

export function AlignmentLevel({ seed, onComplete }: MiniGameProps) {
  const initialTilt = useMemo(() => {
    const rng = createRng(seed);
    const sign = rng() > 0.5 ? 1 : -1;
    const magnitude = Math.round(randRange(rng, 2.2, 6.4) * 10) / 10;
    return sign * magnitude;
  }, [seed]);

  const [angle, setAngle] = useState<number>(initialTilt);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const nudge = useCallback((delta: number) => {
    setAngle((a) => {
      const next = Math.round((a + delta) * 10) / 10;
      return Math.max(-10, Math.min(10, next));
    });
    soundEngine.playTap();
  }, []);

  const handleLockIn = useCallback(() => {
    if (submitted) return;
    const finalScore = scoreAlignmentLevel(angle);
    setSubmitted(true);
    setScore(finalScore);
    soundEngine.playReveal(finalScore);

    const formatted = `${angle > 0 ? '+' : ''}${angle.toFixed(1)}°`;
    timeoutRef.current = window.setTimeout(() => {
      onComplete({
        score: finalScore,
        userLabel: formatted,
        targetLabel: '0.0°',
      });
    }, 1500);
  }, [submitted, angle, onComplete]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (submitted) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nudge(-0.1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nudge(0.1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleLockIn();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submitted, nudge, handleLockIn]);

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto">
      <div className="text-center space-y-1">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Rotate the bar until it is perfectly level (0.0°)
        </p>
      </div>

      <div className="w-full bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 sm:p-6 space-y-6 select-none">
        {/* Clean un-gridded level field so user relies purely on eye */}
        <svg
          viewBox="0 0 360 150"
          data-testid="alignment-svg"
          className="w-full h-auto max-h-[160px] rounded-xl bg-[#FAFAFA] dark:bg-[#0B0F17]"
        >
          {/* Ghost true 0.0° horizontal level line */}
          {submitted && (
            <line
              x1="28"
              y1="75"
              x2="332"
              y2="75"
              stroke="#10B981"
              strokeWidth="2.5"
              strokeDasharray="6 4"
            />
          )}

          {/* User adjustable bar */}
          <g transform={`rotate(${angle}, 180, 75)`}>
            <line
              x1="36"
              y1="75"
              x2="324"
              y2="75"
              className={
                submitted
                  ? 'stroke-blue-600 dark:stroke-blue-400'
                  : 'stroke-[#111827] dark:stroke-neutral-100'
              }
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle
              cx="180"
              cy="75"
              r="5"
              fill={submitted ? '#3B82F6' : '#059669'}
            />
          </g>
        </svg>

        {/* Fine-tune controls */}
        <div className="space-y-4">
          <input
            type="range"
            aria-label="Tilt angle fine adjustment"
            min={-9}
            max={9}
            step={0.1}
            disabled={submitted}
            value={angle}
            onChange={(e) => setAngle(Math.round(Number(e.target.value) * 10) / 10)}
            className="w-full precision-slider min-h-[36px]"
          />

          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              disabled={submitted}
              onClick={() => nudge(-0.5)}
              className="min-h-[44px] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0B0F17] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs sm:text-sm font-mono font-medium text-neutral-800 dark:text-neutral-100 inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              0.5°
            </button>
            <button
              type="button"
              disabled={submitted}
              onClick={() => nudge(-0.1)}
              className="min-h-[44px] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0B0F17] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs sm:text-sm font-mono font-medium text-neutral-800 dark:text-neutral-100 inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
            >
              <RotateCcw className="w-3 h-3" />
              0.1°
            </button>
            <button
              type="button"
              disabled={submitted}
              onClick={() => nudge(0.1)}
              className="min-h-[44px] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0B0F17] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs sm:text-sm font-mono font-medium text-neutral-800 dark:text-neutral-100 inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
            >
              0.1°
              <RotateCw className="w-3 h-3" />
            </button>
            <button
              type="button"
              disabled={submitted}
              onClick={() => nudge(0.5)}
              className="min-h-[44px] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0B0F17] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs sm:text-sm font-mono font-medium text-neutral-800 dark:text-neutral-100 inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
            >
              0.5°
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {submitted && score !== null ? (
        <GhostRevealBar
          score={score}
          userLabel={`${angle > 0 ? '+' : ''}${angle.toFixed(1)}°`}
          targetLabel="0.0°"
          detailText={Math.abs(angle) < 0.05 ? 'Dead level!' : `Off by ${Math.abs(angle).toFixed(1)}°`}
        />
      ) : (
        <button
          type="button"
          onClick={handleLockIn}
          className="w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold text-base transition-all cursor-pointer"
        >
          Lock In Level
        </button>
      )}
    </div>
  );
}
