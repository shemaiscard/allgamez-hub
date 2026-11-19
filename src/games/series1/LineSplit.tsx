import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MiniGameProps } from '../../types/game';
import { createRng, randInt } from '../../utils/prng';
import { scoreLineSplit } from '../../utils/scoring';
import { soundEngine } from '../../utils/audio';
import { GhostRevealBar } from '../../components/GhostRevealBar';

export function LineSplit({ seed, onComplete }: MiniGameProps) {
  const targetPct = useMemo(() => {
    const rng = createRng(seed);
    return randInt(rng, 14, 86);
  }, [seed]);

  const [guessPct, setGuessPct] = useState<number>(50);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = barRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    const clamped = Math.max(1, Math.min(99, Math.round(pct * 2) / 2));
    setGuessPct(clamped);
  }, []);

  const handleLockIn = useCallback(() => {
    if (submitted) return;
    const finalScore = scoreLineSplit(guessPct, targetPct);
    setSubmitted(true);
    setScore(finalScore);
    soundEngine.playReveal(finalScore);

    timeoutRef.current = window.setTimeout(() => {
      onComplete({
        score: finalScore,
        userLabel: `${guessPct.toFixed(1).replace(/\.0$/, '')}%`,
        targetLabel: `${targetPct}%`,
      });
    }, 1500);
  }, [guessPct, targetPct, submitted, onComplete]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (submitted) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setGuessPct((p) => Math.max(1, p - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setGuessPct((p) => Math.min(99, p + 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleLockIn();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submitted, handleLockIn]);

  const minPct = Math.min(guessPct, targetPct);
  const gapPct = Math.abs(guessPct - targetPct);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
      <div className="text-center space-y-1">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Split the bar from the left at</p>
        <div className="font-mono text-4xl sm:text-5xl font-bold tracking-tight tabular-nums text-neutral-900 dark:text-white">
          {targetPct}%
        </div>
      </div>

      <div className="w-full bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 px-5 py-10 sm:px-8 sm:py-12 select-none">
        <div className="flex justify-between text-xs font-mono text-neutral-400 dark:text-neutral-500 mb-3">
          <span>0%</span>
          <span>100%</span>
        </div>

        <div
          ref={barRef}
          data-testid="line-split-bar"
          className="relative h-20 w-full rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 cursor-ew-resize touch-none overflow-visible"
          onPointerDown={(e) => {
            if (submitted) return;
            draggingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            updateFromClientX(e.clientX);
            soundEngine.playTap();
          }}
          onPointerMove={(e) => {
            if (!draggingRef.current || submitted) return;
            updateFromClientX(e.clientX);
          }}
          onPointerUp={() => {
            draggingRef.current = false;
          }}
          onPointerCancel={() => {
            draggingRef.current = false;
          }}
        >
          {/* Left shaded portion for user split */}
          <div
            className="absolute inset-y-0 left-0 rounded-l-xl bg-blue-600/20 dark:bg-blue-500/25 pointer-events-none"
            style={{ width: `${guessPct}%` }}
          />

          {/* Ghost error gap highlight */}
          {submitted && (
            <div
              className="absolute inset-y-0 bg-emerald-500/25 pointer-events-none"
              style={{ left: `${minPct}%`, width: `${gapPct}%` }}
            />
          )}

          {/* Target Ghost Line */}
          {submitted && (
            <div
              className="absolute -top-3 -bottom-3 w-1 bg-emerald-500 rounded-full pointer-events-none -translate-x-1/2"
              style={{ left: `${targetPct}%` }}
            >
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                {targetPct}%
              </span>
            </div>
          )}

          {/* User Divider Line */}
          <div
            className="absolute -top-2 -bottom-2 w-1 bg-blue-600 dark:bg-blue-500 rounded-full pointer-events-none -translate-x-1/2"
            style={{ left: `${guessPct}%` }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-10 rounded-md bg-white dark:bg-[#111827] border-2 border-blue-600 dark:border-blue-500 shadow-xs flex items-center justify-center">
              <div className="w-0.5 h-4 bg-blue-600 dark:bg-blue-500 rounded-full" />
            </div>
            {submitted && (
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[11px] font-mono font-semibold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                {guessPct.toFixed(1).replace(/\.0$/, '')}%
              </span>
            )}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-neutral-400 dark:text-neutral-500">
          {submitted
            ? 'Green marker shows the exact split point.'
            : 'Click or drag the divider horizontally to set your split.'}
        </p>
      </div>

      {submitted && score !== null ? (
        <GhostRevealBar
          score={score}
          userLabel={`${guessPct.toFixed(1).replace(/\.0$/, '')}%`}
          targetLabel={`${targetPct}%`}
          detailText={`Δ ${gapPct.toFixed(1).replace(/\.0$/, '')}%`}
        />
      ) : (
        <button
          type="button"
          onClick={handleLockIn}
          className="w-full min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-semibold text-base transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Lock In Split
        </button>
      )}
    </div>
  );
}
