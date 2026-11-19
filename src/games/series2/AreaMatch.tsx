import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MiniGameProps } from '../../types/game';
import { createRng, randInt } from '../../utils/prng';
import { scoreAreaMatch } from '../../utils/scoring';
import { soundEngine } from '../../utils/audio';
import { GhostRevealBar } from '../../components/GhostRevealBar';

export function AreaMatch({ seed, onComplete }: MiniGameProps) {
  const { squareSide, targetRadius, initialRadius } = useMemo(() => {
    const rng = createRng(seed);
    const side = randInt(rng, 58, 108);
    // Exact radius where pi * r^2 = side^2 => r = side / sqrt(pi)
    const exactR = side / Math.sqrt(Math.PI);
    const initR = rng() > 0.5 ? randInt(rng, 18, 28) : randInt(rng, 68, 78);
    return { squareSide: side, targetRadius: exactR, initialRadius: initR };
  }, [seed]);

  const [radius, setRadius] = useState<number>(initialRadius);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleLockIn = useCallback(() => {
    if (submitted) return;
    const finalScore = scoreAreaMatch(radius, squareSide);
    const areaPct = Math.round(((Math.PI * radius * radius) / (squareSide * squareSide)) * 100);
    setSubmitted(true);
    setScore(finalScore);
    soundEngine.playReveal(finalScore);

    timeoutRef.current = window.setTimeout(() => {
      onComplete({
        score: finalScore,
        userLabel: `${areaPct}% area`,
        targetLabel: '100% match',
      });
    }, 1500);
  }, [submitted, radius, squareSide, onComplete]);

  const areaRatioPct = Math.round(
    ((Math.PI * radius * radius) / (squareSide * squareSide)) * 100
  );

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto">
      <div className="text-center space-y-1">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Resize the circle until its area equals the square
        </p>
      </div>

      <div className="w-full bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6 space-y-5 select-none">
        <svg
          viewBox="0 0 360 190"
          data-testid="area-match-svg"
          className="w-full h-auto max-h-[220px] rounded-xl bg-[#FAFAFA] dark:bg-[#0B0F17] border border-neutral-100 dark:border-neutral-800"
        >
          {/* Divider */}
          <line
            x1="180"
            y1="20"
            x2="180"
            y2="170"
            className="stroke-[#E5E7EB] dark:stroke-neutral-800"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* Reference Square (Left) */}
          <rect
            x={90 - squareSide / 2}
            y={95 - squareSide / 2}
            width={squareSide}
            height={squareSide}
            rx="3"
            className="fill-[#111827] dark:fill-neutral-100"
          />
          <text
            x="90"
            y="176"
            textAnchor="middle"
            className="fill-[#6B7280] dark:fill-neutral-400"
            fontSize="11"
            fontWeight="500"
          >
            Reference Square
          </text>

          {/* Adjustable Circle (Right) */}
          <circle
            cx="270"
            cy="95"
            r={radius}
            fill="rgba(59, 130, 246, 0.85)"
          />

          {/* Ghost Target Circle Overlay */}
          {submitted && (
            <circle
              cx="270"
              cy="95"
              r={targetRadius}
              fill="none"
              stroke="#10B981"
              strokeWidth="3"
              strokeDasharray="6 3"
            />
          )}

          <text
            x="270"
            y="176"
            textAnchor="middle"
            className="fill-[#6B7280] dark:fill-neutral-400"
            fontSize="11"
            fontWeight="500"
          >
            Your Circle
          </text>
        </svg>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-600 dark:text-neutral-300">
            <label htmlFor="circle-radius-slider">Circle Radius</label>
            <span className="text-neutral-400 dark:text-neutral-500">Smaller ↔ Larger</span>
          </div>
          <input
            id="circle-radius-slider"
            type="range"
            min={16}
            max={82}
            step={0.5}
            disabled={submitted}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full precision-slider min-h-[36px]"
          />
        </div>
      </div>

      {submitted && score !== null ? (
        <GhostRevealBar
          score={score}
          userLabel={`${areaRatioPct}% area`}
          targetLabel="100% area"
          detailText={
            areaRatioPct === 100
              ? 'Exact match!'
              : `${areaRatioPct > 100 ? '+' : ''}${areaRatioPct - 100}% size`
          }
        />
      ) : (
        <button
          type="button"
          onClick={handleLockIn}
          className="w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold text-base transition-all cursor-pointer"
        >
          Lock In Area
        </button>
      )}
    </div>
  );
}
