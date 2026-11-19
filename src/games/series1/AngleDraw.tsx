import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MiniGameProps } from '../../types/game';
import { createRng, randInt } from '../../utils/prng';
import { scoreAngleDraw } from '../../utils/scoring';
import { soundEngine } from '../../utils/audio';
import { GhostRevealBar } from '../../components/GhostRevealBar';

export function AngleDraw({ seed, onComplete }: MiniGameProps) {
  const targetAngle = useMemo(() => {
    const rng = createRng(seed);
    return randInt(rng, 16, 164);
  }, [seed]);

  const [guessAngle, setGuessAngle] = useState<number>(90);
  const [hasInteracted, setHasInteracted] = useState(false);
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

  const updateAngleFromPointer = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // Vertex is at (160, 174) in a 320x196 viewBox (shifted from y=36..232)
    const vx = rect.left + (160 / 320) * rect.width;
    const vy = rect.top + ((210 - 52) / 184) * rect.height;
    const dx = clientX - vx;
    const dy = vy - clientY; // Invert Y so upward is positive
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (deg < 0) {
      deg = dx >= 0 ? 0 : 180;
    }
    const clamped = Math.max(2, Math.min(178, Math.round(deg * 2) / 2));
    setGuessAngle(clamped);
    setHasInteracted(true);
  }, []);

  const handleLockIn = useCallback(() => {
    if (submitted) return;
    const finalScore = scoreAngleDraw(guessAngle, targetAngle);
    setSubmitted(true);
    setScore(finalScore);
    soundEngine.playReveal(finalScore);

    timeoutRef.current = window.setTimeout(() => {
      onComplete({
        score: finalScore,
        userLabel: `${guessAngle.toFixed(1).replace(/\.0$/, '')}°`,
        targetLabel: `${targetAngle}°`,
      });
    }, 1500);
  }, [guessAngle, targetAngle, submitted, onComplete]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (submitted) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setGuessAngle((a) => Math.min(178, a + 1));
        setHasInteracted(true);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setGuessAngle((a) => Math.max(2, a - 1));
        setHasInteracted(true);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleLockIn();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submitted, handleLockIn]);

  const cx = 160;
  const cy = 210;
  const radius = 128;

  const toCoords = (deg: number, r = radius) => {
    const rad = (deg * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy - r * Math.sin(rad),
    };
  };

  const makeWedgePath = (deg: number, r: number) => {
    const end = toCoords(deg, r);
    const startX = cx + r;
    const startY = cy;
    const largeArc = deg > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
  };

  const userEnd = toCoords(guessAngle, radius);
  const targetEnd = toCoords(targetAngle, radius);
  const errDeg = Math.abs(guessAngle - targetAngle);

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto">
      <div className="text-center space-y-1">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Set the angle to match</p>
        <div className="font-mono text-4xl sm:text-5xl font-bold tracking-tight tabular-nums text-neutral-900 dark:text-white">
          {targetAngle}°
        </div>
      </div>

      <div className="w-full bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6 select-none">
        <svg
          ref={svgRef}
          viewBox="0 52 320 184"
          data-testid="angle-canvas"
          className="w-full h-auto max-h-[260px] touch-none cursor-crosshair"
          onPointerDown={(e) => {
            if (submitted) return;
            draggingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            updateAngleFromPointer(e.clientX, e.clientY);
            soundEngine.playTap();
          }}
          onPointerMove={(e) => {
            if (!draggingRef.current || submitted) return;
            updateAngleFromPointer(e.clientX, e.clientY);
          }}
          onPointerUp={() => {
            draggingRef.current = false;
          }}
          onPointerCancel={() => {
            draggingRef.current = false;
          }}
        >
          {/* Protractor outer semicircle (unmarked) */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            className="fill-[#FAFAFA] dark:fill-[#0B0F17] stroke-[#E5E7EB] dark:stroke-neutral-700"
            strokeWidth="2"
          />
          {/* Subtle inner concentric guide */}
          <path
            d={`M ${cx - radius * 0.55} ${cy} A ${radius * 0.55} ${radius * 0.55} 0 0 1 ${cx + radius * 0.55} ${cy}`}
            fill="none"
            className="stroke-[#F3F4F6] dark:stroke-neutral-800"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Baseline (0° reference ray) */}
          <line
            x1={cx - radius}
            y1={cy}
            x2={cx + radius}
            y2={cy}
            className="stroke-[#D1D5DB] dark:stroke-neutral-700"
            strokeWidth="1.5"
          />
          <line
            x1={cx}
            y1={cy}
            x2={cx + radius}
            y2={cy}
            className="stroke-[#111827] dark:stroke-neutral-100"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* User angle wedge */}
          <path
            d={makeWedgePath(guessAngle, 56)}
            fill="rgba(59, 130, 246, 0.18)"
          />

          {/* Ghost Overlay: Target angle wedge & ray */}
          {submitted && (
            <>
              <path
                d={makeWedgePath(targetAngle, 72)}
                fill="rgba(16, 185, 129, 0.18)"
              />
              <line
                x1={cx}
                y1={cy}
                x2={targetEnd.x}
                y2={targetEnd.y}
                stroke="#10B981"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <circle cx={targetEnd.x} cy={targetEnd.y} r="5.5" fill="#10B981" />
            </>
          )}

          {/* User adjustable ray */}
          <line
            x1={cx}
            y1={cy}
            x2={userEnd.x}
            y2={userEnd.y}
            stroke="#3B82F6"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Drag handle on arc */}
          <circle
            cx={userEnd.x}
            cy={userEnd.y}
            r={submitted ? 5 : 10}
            className="fill-white dark:fill-[#111827]"
            stroke="#3B82F6"
            strokeWidth="3"
          />

          {/* Center pivot */}
          <circle cx={cx} cy={cy} r="5" className="fill-[#111827] dark:fill-neutral-100" />
        </svg>

        <p className="mt-2 text-center text-xs text-neutral-400 dark:text-neutral-500">
          {submitted
            ? 'Green shows the exact target angle.'
            : hasInteracted
              ? 'Drag along the arc or use arrow keys to fine-tune.'
              : 'Click or drag anywhere on the protractor arc.'}
        </p>
      </div>

      {submitted && score !== null ? (
        <GhostRevealBar
          score={score}
          userLabel={`${guessAngle.toFixed(1).replace(/\.0$/, '')}°`}
          targetLabel={`${targetAngle}°`}
          detailText={`Δ ${errDeg.toFixed(1).replace(/\.0$/, '')}°`}
        />
      ) : (
        <button
          type="button"
          onClick={handleLockIn}
          className="w-full min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-semibold text-base transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Lock In Angle
        </button>
      )}
    </div>
  );
}
