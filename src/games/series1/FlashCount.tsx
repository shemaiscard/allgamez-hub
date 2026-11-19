import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { MiniGameProps } from '../../types/game';
import { createRng, randInt, randRange } from '../../utils/prng';
import { scoreFlashCount } from '../../utils/scoring';
import { soundEngine } from '../../utils/audio';
import { GhostRevealBar } from '../../components/GhostRevealBar';

interface DotPoint {
  x: number;
  y: number;
  r: number;
}

export function FlashCount({ seed, onComplete }: MiniGameProps) {
  const { targetCount, dots } = useMemo(() => {
    const rng = createRng(seed);
    const count = randInt(rng, 12, 28);
    const generated: DotPoint[] = [];
    const minDist = 26;
    let attempts = 0;

    while (generated.length < count && attempts < 2000) {
      attempts++;
      const x = randRange(rng, 28, 292);
      const y = randRange(rng, 28, 212);
      const tooClose = generated.some((d) => Math.hypot(d.x - x, d.y - y) < minDist);
      if (!tooClose) {
        generated.push({ x, y, r: 7.5 });
      }
    }

    return { targetCount: generated.length, dots: generated };
  }, [seed]);

  const [phase, setPhase] = useState<'ready' | 'flash' | 'input' | 'reveal'>('ready');
  const [guess, setGuess] = useState<number>(20);
  const [score, setScore] = useState<number | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const t1 = window.setTimeout(() => {
      setPhase('flash');
      soundEngine.playTap();
      const t2 = window.setTimeout(() => {
        setPhase('input');
      }, 600);
      timersRef.current.push(t2);
    }, 650);
    timersRef.current.push(t1);

    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, []);

  const handleSubmit = useCallback(() => {
    if (phase !== 'input') return;
    const finalScore = scoreFlashCount(guess, targetCount);
    setScore(finalScore);
    setPhase('reveal');
    soundEngine.playReveal(finalScore);

    const t = window.setTimeout(() => {
      onComplete({
        score: finalScore,
        userLabel: `${guess} dots`,
        targetLabel: `${targetCount} dots`,
      });
    }, 1500);
    timersRef.current.push(t);
  }, [phase, guess, targetCount, onComplete]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'input') return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        setGuess((g) => Math.min(40, g + 1));
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setGuess((g) => Math.max(1, g - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, handleSubmit]);

  const quickNumbers = [12, 15, 18, 20, 22, 25, 28];

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto">
      <div className="text-center space-y-1">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {phase === 'ready'
            ? 'Focus on the field — dots flash for 0.6s'
            : phase === 'flash'
              ? 'Count the dots!'
              : phase === 'input'
                ? 'How many dots did you see?'
                : `Exact count: ${targetCount} dots`}
        </p>
      </div>

      <div className="w-full bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 select-none">
        <svg
          viewBox="0 0 320 240"
          data-testid="flash-count-field"
          className="w-full h-auto max-h-[250px] rounded-xl bg-[#FAFAFA] dark:bg-[#0B0F17] border border-neutral-100 dark:border-neutral-800"
        >
          {phase === 'ready' && (
            <text
              x="160"
              y="125"
              textAnchor="middle"
              className="fill-neutral-400 dark:fill-neutral-500 text-sm font-medium"
            >
              Get ready...
            </text>
          )}

          {phase === 'flash' &&
            dots.map((d, idx) => (
              <circle
                key={idx}
                cx={d.x}
                cy={d.y}
                r={d.r}
                className="fill-[#111827] dark:fill-neutral-100"
              />
            ))}

          {phase === 'input' && (
            <text
              x="160"
              y="125"
              textAnchor="middle"
              className="fill-neutral-300 dark:fill-neutral-600 text-sm font-mono"
            >
              Hidden — Enter your estimate
            </text>
          )}

          {phase === 'reveal' &&
            dots.map((d, idx) => (
              <g key={idx}>
                <circle
                  cx={d.x}
                  cy={d.y}
                  r={9.5}
                  fill="#10B981"
                />
                <text
                  x={d.x}
                  y={d.y + 3.2}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="8.5"
                  fontWeight="700"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {idx + 1}
                </text>
              </g>
            ))}
        </svg>
      </div>

      {phase === 'input' && (
        <div className="w-full space-y-4">
          {/* Ergonomic stepper */}
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              aria-label="Decrease dot count"
              onClick={() => {
                setGuess((g) => Math.max(1, g - 1));
                soundEngine.playTap();
              }}
              className="w-12 h-12 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111827] hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-900 dark:text-white cursor-pointer active:scale-95 transition-transform"
            >
              <Minus className="w-5 h-5" />
            </button>

            <div className="min-w-[96px] text-center">
              <div
                data-testid="flash-count-value"
                className="font-mono text-4xl font-bold tabular-nums text-neutral-900 dark:text-white"
              >
                {guess}
              </div>
              <div className="text-xs text-neutral-400 dark:text-neutral-500">estimated dots</div>
            </div>

            <button
              type="button"
              aria-label="Increase dot count"
              onClick={() => {
                setGuess((g) => Math.min(40, g + 1));
                soundEngine.playTap();
              }}
              className="w-12 h-12 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111827] hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-900 dark:text-white cursor-pointer active:scale-95 transition-transform"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Quick jump presets */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {quickNumbers.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => {
                  setGuess(num);
                  soundEngine.playTap();
                }}
                className={`min-w-[44px] min-h-[40px] px-3 rounded-lg font-mono text-sm font-medium border transition-colors cursor-pointer ${
                  guess === num
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white'
                    : 'bg-white dark:bg-[#111827] text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                {num}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            className="w-full min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-semibold text-base transition-all cursor-pointer"
          >
            Lock In Count ({guess})
          </button>
        </div>
      )}

      {phase === 'reveal' && score !== null && (
        <GhostRevealBar
          score={score}
          userLabel={`${guess}`}
          targetLabel={`${targetCount}`}
          detailText={
            guess === targetCount
              ? 'Exact!'
              : `Off by ${Math.abs(guess - targetCount)}`
          }
        />
      )}
    </div>
  );
}
