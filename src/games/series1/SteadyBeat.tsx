import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MiniGameProps } from '../../types/game';
import { createRng, randInt } from '../../utils/prng';
import { scoreSteadyBeat } from '../../utils/scoring';
import { soundEngine } from '../../utils/audio';
import { GhostRevealBar } from '../../components/GhostRevealBar';

export function SteadyBeat({ seed, onComplete }: MiniGameProps) {
  const bpm = useMemo(() => {
    const rng = createRng(seed);
    return randInt(rng, 84, 124);
  }, [seed]);

  const intervalMs = 60000 / bpm;

  const [phase, setPhase] = useState<'listening' | 'tapping' | 'reveal'>('listening');
  const [activeListenBeat, setActiveListenBeat] = useState<number>(0); // 1..4
  const [pulseKey, setPulseKey] = useState<number>(0);
  const [userTaps, setUserTaps] = useState<number[]>([]);
  const [drifts, setDrifts] = useState<number[]>([]);
  const [score, setScore] = useState<number | null>(null);

  const beatOneTimeRef = useRef<number>(0);
  const timersRef = useRef<number[]>([]);
  const submittedRef = useRef(false);

  const finishWithDrifts = useCallback(
    (finalDrifts: number[]) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      const finalScore = scoreSteadyBeat(finalDrifts);
      const avgDrift =
        finalDrifts.length > 0
          ? Math.round(
              finalDrifts.reduce((s, d) => s + Math.abs(d), 0) / finalDrifts.length
            )
          : 999;

      setDrifts(finalDrifts);
      setScore(finalScore);
      setPhase('reveal');
      soundEngine.playReveal(finalScore);

      const t = window.setTimeout(() => {
        onComplete({
          score: finalScore,
          userLabel: `±${avgDrift}ms avg`,
          targetLabel: `${bpm} BPM`,
        });
      }, 1500);
      timersRef.current.push(t);
    },
    [bpm, onComplete]
  );

  // Schedule 4 audible + visual metronome beats
  useEffect(() => {
    const initialDelay = 550;
    const t0 = performance.now() + initialDelay;
    beatOneTimeRef.current = t0;

    for (let i = 0; i < 4; i++) {
      const fireDelay = initialDelay + i * intervalMs;
      const id = window.setTimeout(() => {
        setActiveListenBeat(i + 1);
        setPulseKey((k) => k + 1);
        soundEngine.playMetronomeClick(i === 0);
        if (i === 3) {
          // Immediately transition to tapping phase right after beat 4 fires
          setPhase('tapping');
        }
      }, fireDelay);
      timersRef.current.push(id);
    }

    // Safety timeout if user never taps all 4 beats (beats 5-8 + 2.5s grace)
    const maxTimeout = window.setTimeout(() => {
      if (!submittedRef.current) {
        finishWithDrifts([300, 300, 300, 300]);
      }
    }, initialDelay + intervalMs * 9.5 + 2500);
    timersRef.current.push(maxTimeout);

    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, [intervalMs, finishWithDrifts]);

  const handleTap = useCallback(() => {
    if (phase !== 'tapping' || submittedRef.current) return;
    const now = performance.now();
    soundEngine.playTap();
    setPulseKey((k) => k + 1);

    setUserTaps((prev) => {
      if (prev.length >= 4) return prev;
      const beatIndex = 4 + prev.length; // 4, 5, 6, 7 => Beats 5, 6, 7, 8
      const expectedTime = beatOneTimeRef.current + beatIndex * intervalMs;
      const drift = now - expectedTime;
      const nextTaps = [...prev, drift];

      if (nextTaps.length === 4) {
        finishWithDrifts(nextTaps);
      }
      return nextTaps;
    });
  }, [phase, intervalMs, finishWithDrifts]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && phase === 'tapping') {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, handleTap]);

  const avgDriftMs =
    drifts.length > 0
      ? Math.round(drifts.reduce((s, d) => s + Math.abs(d), 0) / drifts.length)
      : 0;

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto">
      <div className="text-center space-y-1">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {phase === 'listening'
            ? 'Listen and watch the 4-beat tempo...'
            : phase === 'tapping'
              ? 'Metronome muted — tap beats 5, 6, 7, and 8 on time'
              : 'Rhythm accuracy revealed'}
        </p>
        <div className="font-mono text-2xl font-bold tabular-nums text-neutral-900 dark:text-white">
          {bpm} BPM
        </div>
      </div>

      {/* 8-beat visual tracker */}
      <div className="w-full bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col items-center gap-6 select-none">
        <div className="grid grid-cols-8 gap-2 w-full max-w-sm">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((beatNum) => {
            const isListen = beatNum <= 4;
            const isLit = isListen
              ? activeListenBeat >= beatNum
              : userTaps.length >= beatNum - 4;
            return (
              <div key={beatNum} className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-semibold transition-colors ${
                    isListen
                      ? isLit
                        ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500'
                      : isLit
                        ? 'bg-indigo-600 text-white'
                        : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                  }`}
                >
                  {beatNum}
                </div>
              </div>
            );
          })}
        </div>

        {/* Center pulse pad or Ghost Drift Timeline */}
        {phase !== 'reveal' ? (
          <div className="relative flex items-center justify-center py-4">
            {pulseKey > 0 && (
              <div
                key={pulseKey}
                className={`absolute w-32 h-32 rounded-full border-2 pointer-events-none animate-beat-ring ${
                  phase === 'listening'
                    ? 'border-neutral-900 dark:border-white'
                    : 'border-indigo-600 dark:border-indigo-400'
                }`}
              />
            )}
            <button
              type="button"
              data-testid="beat-tap-button"
              disabled={phase === 'listening'}
              onPointerDown={(e) => {
                if (phase !== 'tapping') return;
                e.preventDefault();
                handleTap();
              }}
              className={`relative w-32 h-32 rounded-full font-display font-bold text-lg transition-all touch-manipulation select-none ${
                phase === 'listening'
                  ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border-2 border-neutral-200 dark:border-neutral-700 cursor-default'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-md cursor-pointer'
              }`}
            >
              {phase === 'listening'
                ? activeListenBeat === 0
                  ? 'Listen'
                  : `Beat ${activeListenBeat}`
                : `Tap (${userTaps.length}/4)`}
            </button>
          </div>
        ) : (
          /* Ghost Overlay: Beat 5-8 Target ticks vs User tap markers */
          <div className="w-full py-4 space-y-4">
            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 text-center">
              Timing drift per beat (Green = exact beat · Blue = your tap)
            </div>
            <div className="space-y-2.5">
              {drifts.map((drift, i) => {
                // Map -200ms..+200ms to 5%..95%
                const clampedMs = Math.max(-200, Math.min(200, drift));
                const posPct = 50 + (clampedMs / 200) * 44;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-12 text-xs font-mono text-neutral-500 dark:text-neutral-400">
                      Beat {i + 5}
                    </span>
                    <div className="relative flex-1 h-6 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                      {/* Center exact target tick */}
                      <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-emerald-500 -translate-x-1/2" />
                      {/* User tap dot */}
                      <div
                        className="absolute top-1/2 w-3 h-3 rounded-full bg-blue-600 dark:bg-blue-400 -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${posPct}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-xs font-mono tabular-nums text-neutral-600 dark:text-neutral-300">
                      {drift >= 0 ? `+${Math.round(drift)}` : Math.round(drift)}ms
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          {phase === 'tapping'
            ? 'Tap the button or press Spacebar on beats 5, 6, 7, and 8.'
            : phase === 'listening'
              ? 'First 4 beats establish the tempo.'
              : 'Closer to center green line = higher accuracy.'}
        </p>
      </div>

      {phase === 'reveal' && score !== null && (
        <GhostRevealBar
          score={score}
          userLabel={`±${avgDriftMs}ms`}
          targetLabel={`${bpm} BPM`}
        />
      )}
    </div>
  );
}
