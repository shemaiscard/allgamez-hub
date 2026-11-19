import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { MiniGameProps } from '../../types/game';
import { createRng, randRange } from '../../utils/prng';
import { scoreTrajectoryDrop } from '../../utils/scoring';
import { soundEngine } from '../../utils/audio';
import { GhostRevealBar } from '../../components/GhostRevealBar';

const VIEW_W = 400;
const VIEW_H = 240;
const FLOOR_Y = 212;
const WALL_X = 200;
const START_X = 28;
const START_Y = 170;

export function TrajectoryDrop({ seed, onComplete }: MiniGameProps) {
  // Deterministic parabolic trajectory that lands cleanly behind the wall (between x=235 and x=372)
  const physics = useMemo(() => {
    const rng = createRng(seed);
    const targetX = randRange(rng, 236, 370);
    const flightDuration = randRange(rng, 1.15, 1.45);
    const g = randRange(rng, 340, 440);
    const vx = (targetX - START_X) / flightDuration;
    // y(T) = START_Y + vy0 * T + 0.5 * g * T^2 = FLOOR_Y
    const vy0 = (FLOOR_Y - START_Y - 0.5 * g * flightDuration * flightDuration) / flightDuration;
    // Ensure apex stays comfortably inside viewBox
    return { targetX, flightDuration, g, vx, vy0 };
  }, [seed]);

  const [ballPos, setBallPos] = useState<{ x: number; y: number; visible: boolean }>({
    x: START_X,
    y: START_Y,
    visible: true,
  });
  const [animFinished, setAnimFinished] = useState(false);
  const [replaysLeft, setReplaysLeft] = useState(1);
  const [guessX, setGuessX] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const draggingRef = useRef(false);

  const runAnimation = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setAnimFinished(false);
    const startTime = performance.now();

    const step = (now: number) => {
      const t = (now - startTime) / 1000;
      if (t >= physics.flightDuration) {
        setBallPos({ x: physics.targetX, y: FLOOR_Y, visible: false });
        setAnimFinished(true);
        return;
      }
      const x = START_X + physics.vx * t;
      const y = START_Y + physics.vy0 * t + 0.5 * physics.g * t * t;
      setBallPos({ x, y, visible: x < WALL_X });
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
  }, [physics]);

  useEffect(() => {
    const startDelay = window.setTimeout(() => {
      runAnimation();
    }, 350);

    return () => {
      window.clearTimeout(startDelay);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [runAnimation]);

  const updateGuessFromClientX = useCallback((clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * VIEW_W;
    const clamped = Math.max(WALL_X + 6, Math.min(VIEW_W - 12, x));
    setGuessX(clamped);
  }, []);

  const handleLockIn = useCallback(() => {
    if (submitted || guessX === null) return;
    const floorSpan = VIEW_W - WALL_X;
    const finalScore = scoreTrajectoryDrop(guessX, physics.targetX, floorSpan);
    setSubmitted(true);
    setScore(finalScore);
    soundEngine.playReveal(finalScore);

    const userPct = Math.round(((guessX - WALL_X) / floorSpan) * 100);
    const targetPct = Math.round(((physics.targetX - WALL_X) / floorSpan) * 100);

    timeoutRef.current = window.setTimeout(() => {
      onComplete({
        score: finalScore,
        userLabel: `${userPct}% zone`,
        targetLabel: `${targetPct}% zone`,
      });
    }, 1500);
  }, [submitted, guessX, physics.targetX, onComplete]);

  // Precompute full trajectory path for ghost reveal and visible arc hint
  const fullPathD = useMemo(() => {
    const steps = 40;
    const pts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * physics.flightDuration;
      const x = START_X + physics.vx * t;
      const y = START_Y + physics.vy0 * t + 0.5 * physics.g * t * t;
      pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return pts.join(' ');
  }, [physics]);

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto">
      <div className="text-center space-y-1">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Predict where the ball lands on the floor behind the wall
        </p>
      </div>

      <div className="w-full bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 select-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          data-testid="trajectory-canvas"
          className="w-full h-auto rounded-xl bg-[#FAFAFA] dark:bg-[#0B0F17] border border-neutral-100 dark:border-neutral-800 touch-none cursor-crosshair"
          onPointerDown={(e) => {
            if (submitted) return;
            draggingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            updateGuessFromClientX(e.clientX);
            soundEngine.playTap();
          }}
          onPointerMove={(e) => {
            if (!draggingRef.current || submitted) return;
            updateGuessFromClientX(e.clientX);
          }}
          onPointerUp={() => {
            draggingRef.current = false;
          }}
          onPointerCancel={() => {
            draggingRef.current = false;
          }}
        >
          {/* Launch pad */}
          <circle cx={START_X} cy={START_Y} r="4" fill="#9CA3AF" />

          {/* Floor line */}
          <line
            x1="12"
            y1={FLOOR_Y}
            x2={VIEW_W - 12}
            y2={FLOOR_Y}
            className="stroke-[#111827] dark:stroke-neutral-100"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Ghost full trajectory on submit */}
          {submitted && (
            <path
              d={fullPathD}
              fill="none"
              stroke="#10B981"
              strokeWidth="2.5"
              strokeDasharray="6 4"
            />
          )}

          {/* Active ball before wall */}
          {ballPos.visible && !submitted && (
            <circle cx={ballPos.x} cy={ballPos.y} r="7.5" fill="#6366F1" />
          )}

          {/* Opaque wall covering right half (becomes translucent on reveal) */}
          <rect
            x={WALL_X}
            y="14"
            width={VIEW_W - WALL_X - 10}
            height={FLOOR_Y - 14}
            rx="6"
            className={
              submitted
                ? 'fill-neutral-900/10 dark:fill-neutral-100/10 stroke-neutral-300 dark:stroke-neutral-700'
                : 'fill-neutral-800 dark:fill-neutral-800 stroke-neutral-900 dark:stroke-neutral-700'
            }
            strokeWidth="1.5"
          />

          {!submitted && (
            <text
              x={WALL_X + (VIEW_W - WALL_X - 10) / 2}
              y={FLOOR_Y / 2 + 4}
              textAnchor="middle"
              fill="#9CA3AF"
              fontSize="11"
              fontWeight="500"
            >
              Tap floor line below
            </text>
          )}

          {/* Clickable landing zone highlight along floor */}
          <rect
            x={WALL_X}
            y={FLOOR_Y - 10}
            width={VIEW_W - WALL_X - 10}
            height="20"
            fill="rgba(99, 102, 241, 0.14)"
          />

          {/* True landing marker on submit */}
          {submitted && (
            <g>
              <line
                x1={physics.targetX}
                y1={FLOOR_Y - 22}
                x2={physics.targetX}
                y2={FLOOR_Y + 6}
                stroke="#10B981"
                strokeWidth="3"
              />
              <circle cx={physics.targetX} cy={FLOOR_Y} r="6.5" fill="#10B981" />
            </g>
          )}

          {/* User predicted landing marker */}
          {guessX !== null && (
            <g>
              <line
                x1={guessX}
                y1={FLOOR_Y - 18}
                x2={guessX}
                y2={FLOOR_Y + 8}
                stroke="#3B82F6"
                strokeWidth="3"
              />
              <polygon
                points={`${guessX},${FLOOR_Y - 2} ${guessX - 7},${FLOOR_Y + 11} ${guessX + 7},${FLOOR_Y + 11}`}
                fill="#3B82F6"
              />
            </g>
          )}
        </svg>

        <div className="mt-3 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <span>
            {guessX === null
              ? 'Click or drag on the right-side floor line.'
              : 'Drag to refine your landing spot.'}
          </span>
          {!submitted && (
            <button
              type="button"
              disabled={!animFinished || replaysLeft <= 0}
              onClick={() => {
                if (replaysLeft <= 0) return;
                setReplaysLeft((r) => r - 1);
                runAnimation();
              }}
              className="inline-flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:text-neutral-300 dark:disabled:text-neutral-700 cursor-pointer disabled:cursor-not-allowed min-h-[32px] px-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Replay ({replaysLeft})
            </button>
          )}
        </div>
      </div>

      {submitted && score !== null ? (
        <GhostRevealBar
          score={score}
          userLabel={`${Math.round(((guessX ?? WALL_X) - WALL_X) / (VIEW_W - WALL_X) * 100)}%`}
          targetLabel={`${Math.round(((physics.targetX - WALL_X) / (VIEW_W - WALL_X)) * 100)}%`}
          detailText={`Δ ${Math.round(Math.abs((guessX ?? WALL_X) - physics.targetX))}px`}
        />
      ) : (
        <button
          type="button"
          disabled={guessX === null}
          onClick={handleLockIn}
          className="w-full min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-200 dark:disabled:bg-neutral-800 disabled:text-neutral-400 dark:disabled:text-neutral-600 active:scale-[0.99] text-white font-semibold text-base transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          {guessX === null ? 'Place Marker on Floor First' : 'Lock In Landing Spot'}
        </button>
      )}
    </div>
  );
}
