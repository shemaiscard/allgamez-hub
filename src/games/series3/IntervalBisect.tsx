import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MiniGameProps } from '../../types/game';
import { createRng, randInt, randRange } from '../../utils/prng';
import { scoreIntervalBisect } from '../../utils/scoring';
import { soundEngine } from '../../utils/audio';
import { GhostRevealBar } from '../../components/GhostRevealBar';

export function IntervalBisect({ seed, onComplete }: MiniGameProps) {
  const { targetPct, cycleDurationSec } = useMemo(() => {
    const rng = createRng(seed);
    // Pick an asymmetric target outside 45..55
    const leftSide = rng() > 0.5;
    const pct = leftSide ? randInt(rng, 18, 42) : randInt(rng, 58, 84);
    const dur = randRange(rng, 2.0, 2.9);
    return { targetPct: pct, cycleDurationSec: dur };
  }, [seed]);

  const [pulsePct, setPulsePct] = useState<number>(0);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const pulseRef = useRef<number>(0);
  const dirRef = useRef<1 | -1>(1);
  const submittedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let last = performance.now();
    const step = (now: number) => {
      if (submittedRef.current) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const speedPctPerSec = 100 / cycleDurationSec;
      let next = pulseRef.current + dirRef.current * speedPctPerSec * dt;
      if (next >= 100) {
        next = 100 - (next - 100);
        dirRef.current = -1;
      } else if (next <= 0) {
        next = -next;
        dirRef.current = 1;
      }
      pulseRef.current = next;
      setPulsePct(next);
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [cycleDurationSec]);

  const handleTap = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const captured = Math.round(pulseRef.current * 10) / 10;
    const finalScore = scoreIntervalBisect(captured, targetPct);
    setPulsePct(captured);
    setSubmitted(true);
    setScore(finalScore);
    soundEngine.playReveal(finalScore);

    timeoutRef.current = window.setTimeout(() => {
      onComplete({
        score: finalScore,
        userLabel: `${captured.toFixed(1).replace(/\.0$/, '')}%`,
        targetLabel: `${targetPct}%`,
      });
    }, 1500);
  }, [targetPct, onComplete]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !submittedRef.current) {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTap]);

  const minPct = Math.min(pulsePct, targetPct);
  const gapPct = Math.abs(pulsePct - targetPct);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
      <div className="text-center space-y-1">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Tap when the moving pulse crosses
        </p>
        <div className="font-mono text-4xl sm:text-5xl font-bold tracking-tight tabular-nums text-neutral-900 dark:text-white">
          {targetPct}%
        </div>
      </div>

      <div className="w-full bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 px-6 py-12 sm:px-8 select-none">
        <div className="flex justify-between text-xs font-mono text-neutral-500 dark:text-neutral-400 mb-4">
          <span>0% (Start)</span>
          <span>100% (End)</span>
        </div>

        {/* Horizontal interval track */}
        <div
          data-testid="interval-track"
          onPointerDown={() => {
            if (!submitted) handleTap();
          }}
          className="relative h-14 w-full flex items-center cursor-pointer touch-manipulation"
        >
          {/* Baseline */}
          <div className="w-full h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700" />

          {/* Start marker (0%) */}
          <div className="absolute left-0 top-1 bottom-1 w-1 bg-neutral-900 dark:bg-neutral-100 rounded-full" />

          {/* End marker (100%) */}
          <div className="absolute right-0 top-1 bottom-1 w-1 bg-neutral-900 dark:bg-neutral-100 rounded-full" />

          {/* Error span highlight on reveal */}
          {submitted && (
            <div
              className="absolute h-3 bg-emerald-500/25 rounded-xs"
              style={{ left: `${minPct}%`, width: `${gapPct}%` }}
            />
          )}

          {/* Ghost Target Vertical Marker */}
          {submitted && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-emerald-500 rounded-full -translate-x-1/2"
              style={{ left: `${targetPct}%` }}
            >
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                {targetPct}%
              </span>
            </div>
          )}

          {/* Moving / Frozen Pulse Marker */}
          <div
            className={`absolute top-1/2 w-5 h-5 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-sm border-2 border-white dark:border-[#111827] ${
              submitted ? 'bg-blue-500' : 'bg-amber-600'
            }`}
            style={{ left: `${pulsePct}%` }}
          >
            {submitted && (
              <span className="absolute top-6 left-1/2 -translate-x-1/2 text-[11px] font-mono font-semibold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                {pulsePct.toFixed(1).replace(/\.0$/, '')}%
              </span>
            )}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-neutral-400 dark:text-neutral-500">
          {submitted
            ? 'Green vertical line shows exact target position.'
            : 'Tap anywhere on the track, click the button, or press Spacebar.'}
        </p>
      </div>

      {submitted && score !== null ? (
        <GhostRevealBar
          score={score}
          userLabel={`${pulsePct.toFixed(1).replace(/\.0$/, '')}%`}
          targetLabel={`${targetPct}%`}
          detailText={`Δ ${gapPct.toFixed(1).replace(/\.0$/, '')}%`}
        />
      ) : (
        <button
          type="button"
          data-testid="bisect-tap-button"
          onPointerDown={(e) => {
            e.preventDefault();
            handleTap();
          }}
          className="w-full min-h-[54px] rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white font-semibold text-base transition-all cursor-pointer"
        >
          Tap at {targetPct}%
        </button>
      )}
    </div>
  );
}
