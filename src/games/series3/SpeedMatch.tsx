import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MiniGameProps } from '../../types/game';
import { createRng, randInt } from '../../utils/prng';
import { scoreSpeedMatch } from '../../utils/scoring';
import { soundEngine } from '../../utils/audio';
import { GhostRevealBar } from '../../components/GhostRevealBar';

const TRACK_W = 340;
const BAR_W = 34;
const WATCH_MS = 3000;

export function SpeedMatch({ seed, onComplete }: MiniGameProps) {
  const { targetSpeed, initialSpeed } = useMemo(() => {
    const rng = createRng(seed);
    const tSpeed = randInt(rng, 95, 255); // px per second
    const iSpeed = tSpeed > 175 ? randInt(rng, 70, 120) : randInt(rng, 220, 290);
    return { targetSpeed: tSpeed, initialSpeed: iSpeed };
  }, [seed]);

  const [phase, setPhase] = useState<'observe' | 'match' | 'reveal'>('observe');
  const [guessSpeed, setGuessSpeed] = useState<number>(initialSpeed);
  const [posA, setPosA] = useState(0);
  const [posB, setPosB] = useState(0);
  const [observePct, setObservePct] = useState(100);
  const [score, setScore] = useState<number | null>(null);

  const speedRef = useRef(initialSpeed);
  const phaseRef = useRef<'observe' | 'match' | 'reveal'>('observe');
  const posARef = useRef(0);
  const posBRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    speedRef.current = guessSpeed;
  }, [guessSpeed]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const observeStart = performance.now();
    let last = observeStart;

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const curPhase = phaseRef.current;
      if (curPhase === 'observe') {
        const elapsed = now - observeStart;
        setObservePct(Math.max(0, 100 - (elapsed / WATCH_MS) * 100));
        posARef.current = (posARef.current + targetSpeed * dt) % (TRACK_W + BAR_W);
        setPosA(posARef.current);

        if (elapsed >= WATCH_MS) {
          phaseRef.current = 'match';
          setPhase('match');
          posBRef.current = 0;
        }
      } else if (curPhase === 'match') {
        posBRef.current = (posBRef.current + speedRef.current * dt) % (TRACK_W + BAR_W);
        setPosB(posBRef.current);
      } else if (curPhase === 'reveal') {
        // Side-by-side comparison moving together!
        posARef.current = (posARef.current + targetSpeed * dt) % (TRACK_W + BAR_W);
        posBRef.current = (posBRef.current + speedRef.current * dt) % (TRACK_W + BAR_W);
        setPosA(posARef.current);
        setPosB(posBRef.current);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [targetSpeed]);

  const handleLockIn = useCallback(() => {
    if (phase !== 'match') return;
    const finalScore = scoreSpeedMatch(guessSpeed, targetSpeed);
    setScore(finalScore);
    // Reset both bars to 0 so user sees live velocity divergence immediately
    posARef.current = 0;
    posBRef.current = 0;
    setPosA(0);
    setPosB(0);
    setPhase('reveal');
    soundEngine.playReveal(finalScore);

    timeoutRef.current = window.setTimeout(() => {
      onComplete({
        score: finalScore,
        userLabel: `${guessSpeed} u/s`,
        targetLabel: `${targetSpeed} u/s`,
      });
    }, 1500);
  }, [phase, guessSpeed, targetSpeed, onComplete]);

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto">
      <div className="text-center space-y-1">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {phase === 'observe'
            ? 'Memorize Track A’s exact speed...'
            : phase === 'match'
              ? 'Adjust Track B’s velocity to match Track A'
              : 'Live side-by-side speed comparison'}
        </p>
      </div>

      <div className="w-full bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 sm:p-6 space-y-5 select-none">
        {/* Track A */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-600 dark:text-neutral-300">
            <span>Track A (Reference)</span>
            <span className="font-mono text-neutral-400 dark:text-neutral-500">
              {phase === 'observe'
                ? 'Active'
                : phase === 'match'
                  ? 'Hidden'
                  : `${targetSpeed} u/s`}
            </span>
          </div>
          <div className="relative h-12 w-full rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            {phase === 'match' ? (
              <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-neutral-400 dark:text-neutral-500">
                Reference Hidden
              </div>
            ) : (
              <div
                className={`absolute top-2 bottom-2 rounded-md ${
                  phase === 'reveal'
                    ? 'bg-emerald-500'
                    : 'bg-neutral-900 dark:bg-neutral-100'
                }`}
                style={{
                  width: `${(BAR_W / TRACK_W) * 100}%`,
                  transform: `translateX(${((posA - BAR_W) / BAR_W) * 100}%)`,
                }}
              />
            )}
          </div>
          {phase === 'observe' && (
            <div className="w-full h-1 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-amber-600"
                style={{ width: `${observePct}%` }}
              />
            </div>
          )}
        </div>

        {/* Track B */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-600 dark:text-neutral-300">
            <span>Track B (Adjustable)</span>
            <span className="font-mono text-neutral-400 dark:text-neutral-500">
              {phase === 'observe'
                ? 'Waiting...'
                : phase === 'match'
                  ? 'Tuning'
                  : `${guessSpeed} u/s`}
            </span>
          </div>
          <div className="relative h-12 w-full rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            {phase !== 'observe' && (
              <div
                className={`absolute top-2 bottom-2 rounded-md ${
                  phase === 'reveal' ? 'bg-blue-500' : 'bg-amber-600'
                }`}
                style={{
                  width: `${(BAR_W / TRACK_W) * 100}%`,
                  transform: `translateX(${((posB - BAR_W) / BAR_W) * 100}%)`,
                }}
              />
            )}
          </div>
        </div>

        {/* Speed slider */}
        {phase === 'match' && (
          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-neutral-600 dark:text-neutral-300">
              <label htmlFor="speed-slider">Track B Velocity</label>
              <span className="text-neutral-400 dark:text-neutral-500">Slower ↔ Faster</span>
            </div>
            <input
              id="speed-slider"
              type="range"
              min={50}
              max={320}
              step={1}
              value={guessSpeed}
              onChange={(e) => setGuessSpeed(Number(e.target.value))}
              className="w-full precision-slider min-h-[36px]"
            />
          </div>
        )}
      </div>

      {phase === 'match' && (
        <button
          type="button"
          onClick={handleLockIn}
          className="w-full min-h-[48px] rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white font-semibold text-base transition-all cursor-pointer"
        >
          Lock In Speed
        </button>
      )}

      {phase === 'reveal' && score !== null && (
        <GhostRevealBar
          score={score}
          userLabel={`${guessSpeed} u/s`}
          targetLabel={`${targetSpeed} u/s`}
          detailText={`${guessSpeed >= targetSpeed ? '+' : ''}${Math.round(((guessSpeed - targetSpeed) / targetSpeed) * 100)}%`}
        />
      )}
    </div>
  );
}
