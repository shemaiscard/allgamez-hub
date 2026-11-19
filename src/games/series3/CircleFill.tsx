import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MiniGameProps } from '../../types/game';
import { createRng, randInt } from '../../utils/prng';
import { scoreCircleFill } from '../../utils/scoring';
import { soundEngine } from '../../utils/audio';
import { GhostRevealBar } from '../../components/GhostRevealBar';

const OUTER_R = 104;
const FILL_RATE_PCT_PER_SEC = 28; // ~3.5s from 0% to 100% area

export function CircleFill({ seed, onComplete }: MiniGameProps) {
  const targetPct = useMemo(() => {
    const rng = createRng(seed);
    return randInt(rng, 20, 82);
  }, [seed]);

  const [areaPct, setAreaPct] = useState<number>(0);
  const [holding, setHolding] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const areaRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const holdStartRef = useRef<number>(0);
  const timeoutRef = useRef<number | null>(null);
  const submittedRef = useRef(false);

  const lockIn = useCallback(
    (finalAreaPct: number) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setHolding(false);

      const rounded = Math.round(finalAreaPct * 10) / 10;
      const finalScore = scoreCircleFill(rounded, targetPct);
      setAreaPct(rounded);
      setSubmitted(true);
      setScore(finalScore);
      soundEngine.playReveal(finalScore);

      timeoutRef.current = window.setTimeout(() => {
        onComplete({
          score: finalScore,
          userLabel: `${Math.round(rounded)}%`,
          targetLabel: `${targetPct}%`,
        });
      }, 1500);
    },
    [targetPct, onComplete]
  );

  const startHold = useCallback(() => {
    if (submittedRef.current || holding) return;
    setHolding(true);
    holdStartRef.current = performance.now();
    lastFrameRef.current = performance.now();
    soundEngine.playTap();

    const step = (now: number) => {
      if (submittedRef.current) return;
      const dt = Math.min((now - lastFrameRef.current) / 1000, 0.05);
      lastFrameRef.current = now;
      const nextArea = Math.min(100, areaRef.current + FILL_RATE_PCT_PER_SEC * dt);
      areaRef.current = nextArea;
      setAreaPct(nextArea);

      if (nextArea >= 100) {
        lockIn(100);
      } else {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, [holding, lockIn]);

  const endHold = useCallback(() => {
    if (!holding || submittedRef.current) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const heldMs = performance.now() - holdStartRef.current;
    // Allow brief accidental click to commit cleanly if > 60ms
    if (heldMs >= 60 || areaRef.current >= 1) {
      lockIn(areaRef.current);
    } else {
      setHolding(false);
    }
  }, [holding, lockIn]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !submittedRef.current) {
        e.preventDefault();
        startHold();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !submittedRef.current) {
        e.preventDefault();
        endHold();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [startHold, endHold]);

  // Area % -> Radius: r = R * sqrt(pct / 100)
  const innerRadius = OUTER_R * Math.sqrt(Math.max(0, areaPct) / 100);
  const targetRadius = OUTER_R * Math.sqrt(targetPct / 100);

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto">
      <div className="text-center space-y-1">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Hold to inflate until the circle fills this much area
        </p>
        <div className="font-mono text-4xl sm:text-5xl font-bold tracking-tight tabular-nums text-neutral-900 dark:text-white">
          {targetPct}%
        </div>
      </div>

      <div className="w-full bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 flex flex-col items-center gap-4 select-none">
        <svg
          viewBox="0 0 240 240"
          data-testid="circle-fill-svg"
          className="w-56 h-56 sm:w-60 sm:h-60"
        >
          {/* Outer target ring */}
          <circle
            cx="120"
            cy="120"
            r={OUTER_R}
            className="fill-[#FAFAFA] dark:fill-[#0B0F17] stroke-[#111827] dark:stroke-neutral-100"
            strokeWidth="2.5"
          />

          {/* User inflating circle */}
          <circle
            cx="120"
            cy="120"
            r={innerRadius}
            fill={submitted ? 'rgba(59, 130, 246, 0.78)' : 'rgba(217, 119, 6, 0.85)'}
          />

          {/* Ghost Target Area Ring */}
          {submitted && (
            <circle
              cx="120"
              cy="120"
              r={targetRadius}
              fill="none"
              stroke="#10B981"
              strokeWidth="3.5"
              strokeDasharray="6 4"
            />
          )}

          {/* Center dot */}
          <circle cx="120" cy="120" r="3" fill="#FFFFFF" />
        </svg>

        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          {submitted
            ? 'Dashed green ring shows exact target area.'
            : 'Remember: area grows with the square of the radius.'}
        </p>
      </div>

      {submitted && score !== null ? (
        <GhostRevealBar
          score={score}
          userLabel={`${Math.round(areaPct)}%`}
          targetLabel={`${targetPct}%`}
          detailText={`Δ ${Math.abs(Math.round(areaPct) - targetPct)}%`}
        />
      ) : (
        <button
          type="button"
          data-testid="circle-hold-button"
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            startHold();
          }}
          onPointerUp={() => endHold()}
          onPointerCancel={() => endHold()}
          className={`w-full min-h-[54px] rounded-xl font-semibold text-base transition-all touch-none select-none cursor-pointer ${
            holding
              ? 'bg-amber-700 text-white scale-[0.99]'
              : 'bg-amber-600 hover:bg-amber-700 text-white'
          }`}
        >
          {holding ? 'Inflating... Release to Lock In' : 'Press & Hold to Inflate'}
        </button>
      )}
    </div>
  );
}
