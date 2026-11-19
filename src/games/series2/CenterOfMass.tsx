import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MiniGameProps } from '../../types/game';
import { createRng, randRange } from '../../utils/prng';
import {
  computeWeightedCentroid,
  scoreCenterOfMass,
  type WeightedDot,
} from '../../utils/scoring';
import { soundEngine } from '../../utils/audio';
import { GhostRevealBar } from '../../components/GhostRevealBar';

const BOX_SIZE = 300;

export function CenterOfMass({ seed, onComplete }: MiniGameProps) {
  const { dots, centroid } = useMemo(() => {
    const rng = createRng(seed);
    const list: WeightedDot[] = [];
    let attempts = 0;

    while (list.length < 7 && attempts < 1000) {
      attempts++;
      const r = randRange(rng, 7, 19);
      const margin = r + 18;
      const x = randRange(rng, margin, BOX_SIZE - margin);
      const y = randRange(rng, margin, BOX_SIZE - margin);
      const overlaps = list.some((d) => Math.hypot(d.x - x, d.y - y) < d.r + r + 14);
      if (!overlaps) {
        list.push({ x, y, r });
      }
    }

    const c = computeWeightedCentroid(list);
    return { dots: list, centroid: c };
  }, [seed]);

  const [guess, setGuess] = useState<{ x: number; y: number }>({
    x: BOX_SIZE / 2,
    y: BOX_SIZE / 2,
  });
  const [hasMoved, setHasMoved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const updatePoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = Math.max(8, Math.min(BOX_SIZE - 8, ((clientX - rect.left) / rect.width) * BOX_SIZE));
    const y = Math.max(8, Math.min(BOX_SIZE - 8, ((clientY - rect.top) / rect.height) * BOX_SIZE));
    setGuess({ x, y });
    setHasMoved(true);
  }, []);

  const handleLockIn = useCallback(() => {
    if (submitted) return;
    const finalScore = scoreCenterOfMass(
      guess.x,
      guess.y,
      centroid.x,
      centroid.y,
      BOX_SIZE
    );
    setSubmitted(true);
    setScore(finalScore);
    soundEngine.playReveal(finalScore);

    const errPx = Math.round(Math.hypot(guess.x - centroid.x, guess.y - centroid.y));

    timeoutRef.current = window.setTimeout(() => {
      onComplete({
        score: finalScore,
        userLabel: `${errPx}px off`,
        targetLabel: 'Centroid',
      });
    }, 1500);
  }, [submitted, guess, centroid, onComplete]);

  const errPx = Math.round(Math.hypot(guess.x - centroid.x, guess.y - centroid.y));

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto">
      <div className="text-center space-y-1">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Place the crosshair at the weighted center of mass (larger dots weigh more)
        </p>
      </div>

      <div className="w-full bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-5 flex flex-col items-center select-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${BOX_SIZE} ${BOX_SIZE}`}
          data-testid="centroid-canvas"
          className="w-full max-w-[310px] aspect-square rounded-xl bg-[#FAFAFA] dark:bg-[#0B0F17] border border-neutral-200 dark:border-neutral-800 touch-none cursor-crosshair"
          onPointerDown={(e) => {
            if (submitted) return;
            draggingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            updatePoint(e.clientX, e.clientY);
            soundEngine.playTap();
          }}
          onPointerMove={(e) => {
            if (!draggingRef.current || submitted) return;
            updatePoint(e.clientX, e.clientY);
          }}
          onPointerUp={() => {
            draggingRef.current = false;
          }}
          onPointerCancel={() => {
            draggingRef.current = false;
          }}
        >
          {/* Subtle grid lines */}
          {[75, 150, 225].map((pos) => (
            <g key={pos}>
              <line x1={pos} y1="0" x2={pos} y2={BOX_SIZE} className="stroke-[#F3F4F6] dark:stroke-neutral-800/80" strokeWidth="1" />
              <line x1="0" y1={pos} x2={BOX_SIZE} y2={pos} className="stroke-[#F3F4F6] dark:stroke-neutral-800/80" strokeWidth="1" />
            </g>
          ))}

          {/* Ghost reveal: radial force lines to true centroid */}
          {submitted &&
            dots.map((d, idx) => (
              <line
                key={`ray-${idx}`}
                x1={d.x}
                y1={d.y}
                x2={centroid.x}
                y2={centroid.y}
                stroke="rgba(16, 185, 129, 0.35)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
            ))}

          {/* 7 Weighted Dots */}
          {dots.map((d, idx) => (
            <circle
              key={idx}
              cx={d.x}
              cy={d.y}
              r={d.r}
              className="fill-[#111827] dark:fill-neutral-100"
              fillOpacity={0.88}
            />
          ))}

          {/* Error line on reveal */}
          {submitted && (
            <line
              x1={guess.x}
              y1={guess.y}
              x2={centroid.x}
              y2={centroid.y}
              stroke="#10B981"
              strokeWidth="2"
            />
          )}

          {/* True Weighted Centroid Ghost Marker */}
          {submitted && (
            <g>
              <circle
                cx={centroid.x}
                cy={centroid.y}
                r="10"
                fill="rgba(16, 185, 129, 0.2)"
                stroke="#10B981"
                strokeWidth="2.5"
              />
              <line
                x1={centroid.x - 14}
                y1={centroid.y}
                x2={centroid.x + 14}
                y2={centroid.y}
                stroke="#10B981"
                strokeWidth="2"
              />
              <line
                x1={centroid.x}
                y1={centroid.y - 14}
                x2={centroid.x}
                y2={centroid.y + 14}
                stroke="#10B981"
                strokeWidth="2"
              />
            </g>
          )}

          {/* User Crosshair */}
          <g>
            <circle
              cx={guess.x}
              cy={guess.y}
              r="9"
              fill="rgba(59, 130, 246, 0.16)"
              stroke="#3B82F6"
              strokeWidth="2.5"
            />
            <line
              x1={guess.x - 15}
              y1={guess.y}
              x2={guess.x + 15}
              y2={guess.y}
              stroke="#3B82F6"
              strokeWidth="2"
            />
            <line
              x1={guess.x}
              y1={guess.y - 15}
              x2={guess.x}
              y2={guess.y + 15}
              stroke="#3B82F6"
              strokeWidth="2"
            />
          </g>
        </svg>

        <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
          {submitted
            ? 'Green crosshair marks the exact weighted geometric centroid.'
            : hasMoved
              ? 'Drag to fine-tune the balance point.'
              : 'Tap or drag the blue crosshair anywhere in the box.'}
        </p>
      </div>

      {submitted && score !== null ? (
        <GhostRevealBar
          score={score}
          userLabel={`${errPx}px off`}
          targetLabel="Exact Center"
        />
      ) : (
        <button
          type="button"
          onClick={handleLockIn}
          className="w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold text-base transition-all cursor-pointer"
        >
          Lock In Centroid
        </button>
      )}
    </div>
  );
}
