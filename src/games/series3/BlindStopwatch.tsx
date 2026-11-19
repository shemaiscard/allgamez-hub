import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MiniGameProps } from '../../types/game';
import { createRng, randRange } from '../../utils/prng';
import { scoreBlindStopwatch } from '../../utils/scoring';
import { soundEngine } from '../../utils/audio';
import { GhostRevealBar } from '../../components/GhostRevealBar';

export function BlindStopwatch({ seed, onComplete }: MiniGameProps) {
  const targetSec = useMemo(() => {
    const rng = createRng(seed);
    return Math.round(randRange(rng, 2.5, 6.2) * 20) / 20; // nearest 0.05s
  }, [seed]);

  const [phase, setPhase] = useState<'idle' | 'running' | 'reveal'>('idle');
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [score, setScore] = useState<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleStart = useCallback(() => {
    if (phase !== 'idle') return;
    startTimeRef.current = performance.now();
    setPhase('running');
    soundEngine.playTap();
  }, [phase]);

  const handleStop = useCallback(() => {
    if (phase !== 'running') return;
    const elapsed = (performance.now() - startTimeRef.current) / 1000;
    const finalScore = scoreBlindStopwatch(elapsed, targetSec);
    setElapsedSec(elapsed);
    setScore(finalScore);
    setPhase('reveal');
    soundEngine.playReveal(finalScore);

    timeoutRef.current = window.setTimeout(() => {
      onComplete({
        score: finalScore,
        userLabel: `${elapsed.toFixed(2)}s`,
        targetLabel: `${targetSec.toFixed(2)}s`,
      });
    }, 1500);
  }, [phase, targetSec, onComplete]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        if (phase === 'idle') handleStart();
        else if (phase === 'running') handleStop();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, handleStart, handleStop]);

  const maxScale = Math.max(targetSec, elapsedSec, 1) * 1.12;
  const targetBarPct = (targetSec / maxScale) * 100;
  const userBarPct = (elapsedSec / maxScale) * 100;
  const deltaSec = elapsedSec - targetSec;

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto">
      <div className="text-center space-y-1">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Stop the blind timer at exactly</p>
        <div className="font-mono text-4xl sm:text-5xl font-bold tracking-tight tabular-nums text-neutral-900 dark:text-white">
          {targetSec.toFixed(2)}s
        </div>
      </div>

      <div className="w-full bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 sm:p-8 flex flex-col items-center gap-6 select-none">
        {/* Blind stopwatch readout */}
        <div className="w-full rounded-xl bg-[#FAFAFA] dark:bg-[#0B0F17] border border-neutral-200 dark:border-neutral-800 py-8 px-4 text-center">
          {phase === 'idle' && (
            <div className="font-mono text-4xl font-bold tabular-nums text-neutral-300 dark:text-neutral-600">
              0.00s
            </div>
          )}
          {phase === 'running' && (
            <div className="space-y-2">
              <div className="font-mono text-3xl font-bold tracking-widest text-amber-600 dark:text-amber-400">
                •••
              </div>
              <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Timer running — count internally
              </div>
            </div>
          )}
          {phase === 'reveal' && (
            <div className="space-y-4">
              <div className="font-mono text-4xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                {elapsedSec.toFixed(2)}s
              </div>

              {/* Ghost visual comparison bars */}
              <div className="max-w-sm mx-auto space-y-2 text-left">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                    <span>Target</span>
                    <span>{targetSec.toFixed(2)}s</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${targetBarPct}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                    <span>Yours</span>
                    <span>{elapsedSec.toFixed(2)}s</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 dark:bg-blue-500 rounded-full"
                      style={{ width: `${userBarPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {phase !== 'reveal' && (
          <button
            type="button"
            data-testid="stopwatch-action"
            onClick={phase === 'idle' ? handleStart : handleStop}
            className={`w-full min-h-[56px] rounded-xl font-semibold text-base transition-all active:scale-[0.99] cursor-pointer ${
              phase === 'idle'
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-900'
            }`}
          >
            {phase === 'idle' ? 'Start Blind Timer' : 'Stop Now'}
          </button>
        )}

        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          {phase === 'idle'
            ? 'Click Start or press Spacebar to begin.'
            : phase === 'running'
              ? 'Click Stop or press Spacebar when you think time is up.'
              : 'Green bar shows target time; blue shows your elapsed time.'}
        </p>
      </div>

      {phase === 'reveal' && score !== null && (
        <GhostRevealBar
          score={score}
          userLabel={`${elapsedSec.toFixed(2)}s`}
          targetLabel={`${targetSec.toFixed(2)}s`}
          detailText={`${deltaSec >= 0 ? '+' : ''}${deltaSec.toFixed(2)}s`}
        />
      )}
    </div>
  );
}
