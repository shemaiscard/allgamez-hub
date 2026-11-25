import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MiniGameProps } from '../../types/game';
import { createRng, randInt } from '../../utils/prng';
import { scoreSteadyBeat } from '../../utils/scoring';
import { soundEngine } from '../../utils/audio';
import { GhostRevealBar } from '../../components/GhostRevealBar';

const BEATS_PER_BAR = 4;
const LISTEN_BARS = 2;
const LISTEN_BEATS = BEATS_PER_BAR * LISTEN_BARS; // 8 beats (2 full 4-beat bars)
const TAP_BEATS = 4;

export function SteadyBeat({ seed, onComplete }: MiniGameProps) {
  const bpm = useMemo(() => {
    const rng = createRng(seed);
    return randInt(rng, 84, 124);
  }, [seed]);

  const intervalMs = 60000 / bpm;

  const [phase, setPhase] = useState<'listening' | 'tapping' | 'reveal'>('listening');
  const [activeListenBeat, setActiveListenBeat] = useState<number>(0); // 1..8
  const [pulseKey, setPulseKey] = useState<number>(0);
  const [userTaps, setUserTaps] = useState<number[]>([]);
  const [drifts, setDrifts] = useState<number[]>([]);
  const [score, setScore] = useState<number | null>(null);

  const beatOneTimeRef = useRef<number>(0);
  const timersRef = useRef<number[]>([]);
  const userTapsRef = useRef<number[]>([]);
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

  // Schedule 2 full 4-beat audible + visual metronome bars (8 beats total)
  useEffect(() => {
    const initialDelay = 550;
    const t0 = performance.now() + initialDelay;
    beatOneTimeRef.current = t0;

    for (let i = 0; i < LISTEN_BEATS; i++) {
      const fireDelay = initialDelay + i * intervalMs;
      const id = window.setTimeout(() => {
        setActiveListenBeat(i + 1);
        setPulseKey((k) => k + 1);
        soundEngine.playMetronomeClick(i % BEATS_PER_BAR === 0);
        if (i === LISTEN_BEATS - 1) {
          // Immediately transition to tapping phase right after bar 2 beat 4 fires
          setPhase('tapping');
        }
      }, fireDelay);
      timersRef.current.push(id);
    }

    // Safety timeout if user never taps all 4 silent beats (+ 2.5s grace)
    const maxTimeout = window.setTimeout(() => {
      if (!submittedRef.current) {
        finishWithDrifts([300, 300, 300, 300]);
      }
    }, initialDelay + intervalMs * (LISTEN_BEATS + TAP_BEATS + 1.5) + 2500);
    timersRef.current.push(maxTimeout);

    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, [intervalMs, finishWithDrifts]);

  const handleTap = useCallback(() => {
    if (phase !== 'tapping' || submittedRef.current) return;
    if (userTapsRef.current.length >= TAP_BEATS) return;

    const now = performance.now();
    soundEngine.playTap();
    setPulseKey((k) => k + 1);

    const beatIndex = LISTEN_BEATS + userTapsRef.current.length; // 8, 9, 10, 11
    const expectedTime = beatOneTimeRef.current + beatIndex * intervalMs;
    const drift = now - expectedTime;
    const nextTaps = [...userTapsRef.current, drift];
    userTapsRef.current = nextTaps;
    setUserTaps(nextTaps);

    if (nextTaps.length === TAP_BEATS) {
      finishWithDrifts(nextTaps);
    }
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

  const currentListenBar =
    activeListenBeat > 0 ? Math.ceil(activeListenBeat / BEATS_PER_BAR) : 1;
  const currentBeatInBar =
    activeListenBeat > 0 ? ((activeListenBeat - 1) % BEATS_PER_BAR) + 1 : 0;

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto">
      <div className="text-center space-y-1">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {phase === 'listening'
            ? 'Listen & watch: metronome plays 2 bars (8 beats)...'
            : phase === 'tapping'
              ? 'Metronome muted: tap the next 4 beats on time'
              : 'Rhythm accuracy revealed'}
        </p>
        <div className="font-mono text-2xl font-bold tabular-nums text-neutral-900 dark:text-white">
          {bpm} BPM
        </div>
      </div>

      {/* 3-bar visual tracker: Listen Bar 1, Listen Bar 2, Your Turn */}
      <div
        data-testid="steady-beat-card"
        data-phase={phase}
        data-listen-beat={activeListenBeat}
        className="w-full bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 sm:p-6 flex flex-col items-center gap-6 select-none"
      >
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 w-full">
          {/* Bar 1 (Beats 1-4) */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Bar 1
            </span>
            <div className="flex items-center justify-center gap-1 sm:gap-1.5">
              {[1, 2, 3, 4].map((n) => {
                const isLit = activeListenBeat >= n;
                return (
                  <div
                    key={n}
                    className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-mono text-[11px] font-semibold transition-colors ${
                      isLit
                        ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500'
                    }`}
                  >
                    {n}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bar 2 (Beats 5-8) */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Bar 2
            </span>
            <div className="flex items-center justify-center gap-1 sm:gap-1.5">
              {[1, 2, 3, 4].map((n) => {
                const isLit = activeListenBeat >= BEATS_PER_BAR + n;
                return (
                  <div
                    key={n}
                    className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-mono text-[11px] font-semibold transition-colors ${
                      isLit
                        ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500'
                    }`}
                  >
                    {n}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tap Bar (User's 4 silent beats) */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Tap
            </span>
            <div className="flex items-center justify-center gap-1 sm:gap-1.5">
              {[1, 2, 3, 4].map((n) => {
                const isLit = userTaps.length >= n;
                return (
                  <div
                    key={n}
                    className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-mono text-[11px] font-semibold transition-colors ${
                      isLit
                        ? 'bg-indigo-600 text-white'
                        : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                    }`}
                  >
                    {n}
                  </div>
                );
              })}
            </div>
          </div>
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
              className={`relative w-32 h-32 rounded-full font-display font-bold text-lg transition-all touch-manipulation select-none flex flex-col items-center justify-center leading-tight ${
                phase === 'listening'
                  ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border-2 border-neutral-200 dark:border-neutral-700 cursor-default'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-md cursor-pointer'
              }`}
            >
              {phase === 'listening' ? (
                activeListenBeat === 0 ? (
                  <span>Listen</span>
                ) : (
                  <>
                    <span className="text-[11px] font-mono font-medium uppercase tracking-wider opacity-75">
                      Bar {currentListenBar}/{LISTEN_BARS}
                    </span>
                    <span>Beat {currentBeatInBar}</span>
                  </>
                )
              ) : (
                <span>Tap ({userTaps.length}/4)</span>
              )}
            </button>
          </div>
        ) : (
          /* Ghost Overlay: 4 silent tap Target ticks vs User tap markers */
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
                      Tap {i + 1}
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

        <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center">
          {phase === 'tapping'
            ? 'Tap the button or press Spacebar for the next 4 beats.'
            : phase === 'listening'
              ? 'Two 4-beat bars establish the tempo before muting.'
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
