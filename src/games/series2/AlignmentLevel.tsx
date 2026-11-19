import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, RotateCw } from 'lucide-react';
import type { MiniGameProps } from '../../types/game';
import { createRng, randRange } from '../../utils/prng';
import { scoreAlignmentLevel } from '../../utils/scoring';
import { soundEngine } from '../../utils/audio';
import { GhostRevealBar } from '../../components/GhostRevealBar';

interface AlignmentChallenge {
  mode: 'axis' | 'parallel';
  targetAngle: number;
  initialAngle: number;
  sliderMin: number;
  sliderMax: number;
  prompt: string;
}

const PURE_AXES: readonly { angle: number; prompt: string }[] = [
  { angle: 0, prompt: 'Rotate the bar until it is perfectly horizontal (0.0°)' },
  { angle: 90, prompt: 'Rotate the bar until it is perfectly vertical (90.0°)' },
  { angle: 45, prompt: 'Rotate the bar to a true +45.0° diagonal (↘)' },
  { angle: -45, prompt: 'Rotate the bar to a true -45.0° diagonal (↗)' },
];

function formatDeg(val: number): string {
  const normalized = Math.abs(val) < 0.05 ? 0 : val;
  return `${normalized > 0 ? '+' : ''}${normalized.toFixed(1)}°`;
}

export function AlignmentLevel({ seed, onComplete }: MiniGameProps) {
  const challenge = useMemo<AlignmentChallenge>(() => {
    const rng = createRng(seed);
    const useParallel = rng() < 0.55;

    let mode: 'axis' | 'parallel';
    let targetAngle: number;
    let prompt: string;

    if (useParallel) {
      mode = 'parallel';
      // Pick a non-cardinal angle between 12° and 68° (either sign), avoiding 42°..48°
      const sign = rng() > 0.5 ? 1 : -1;
      let mag = Math.round(randRange(rng, 12, 68) * 2) / 2;
      if (Math.abs(mag - 45) < 4) {
        mag = mag >= 45 ? 50.5 : 39.5;
      }
      targetAngle = sign * mag;
      prompt = 'Rotate the bar until it is parallel to the reference line';
    } else {
      mode = 'axis';
      const picked = PURE_AXES[Math.floor(rng() * PURE_AXES.length)];
      targetAngle = picked.angle;
      prompt = picked.prompt;
    }

    const tiltSign = rng() > 0.5 ? 1 : -1;
    const tiltMag = Math.round(randRange(rng, 3.2, 8.6) * 10) / 10;
    const initialAngle = Math.round((targetAngle + tiltSign * tiltMag) * 10) / 10;

    // Asymmetric slider range so the dead-center of the slider is NEVER the answer
    const biasSign = rng() > 0.5 ? 1 : -1;
    const biasMag = Math.round(randRange(rng, 2.5, 5.5) * 10) / 10;
    const sliderCenter = targetAngle + biasSign * biasMag;
    const sliderMin = Math.round((sliderCenter - 16) * 10) / 10;
    const sliderMax = Math.round((sliderCenter + 16) * 10) / 10;

    return {
      mode,
      targetAngle,
      initialAngle,
      sliderMin,
      sliderMax,
      prompt,
    };
  }, [seed]);

  const [angle, setAngle] = useState<number>(challenge.initialAngle);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const nudge = useCallback(
    (delta: number) => {
      setAngle((a) => {
        const next = Math.round((a + delta) * 10) / 10;
        return Math.max(challenge.sliderMin, Math.min(challenge.sliderMax, next));
      });
      soundEngine.playTap();
    },
    [challenge.sliderMin, challenge.sliderMax]
  );

  const handleLockIn = useCallback(() => {
    if (submitted) return;
    const deviation = Math.round((angle - challenge.targetAngle) * 10) / 10;
    const finalScore = scoreAlignmentLevel(deviation);
    setSubmitted(true);
    setScore(finalScore);
    soundEngine.playReveal(finalScore);

    timeoutRef.current = window.setTimeout(() => {
      onComplete({
        score: finalScore,
        userLabel: formatDeg(angle),
        targetLabel: formatDeg(challenge.targetAngle),
      });
    }, 1500);
  }, [submitted, angle, challenge.targetAngle, onComplete]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (submitted) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nudge(-0.1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nudge(0.1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleLockIn();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submitted, nudge, handleLockIn]);

  // Perpendicular offset for the parallel reference bar inside the circular lens
  const targetRad = (challenge.targetAngle * Math.PI) / 180;
  const refCx = 120 + 56 * Math.sin(targetRad);
  const refCy = 120 - 56 * Math.cos(targetRad);
  const deviation = Math.round((angle - challenge.targetAngle) * 10) / 10;

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto">
      <div className="text-center space-y-1">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {challenge.prompt}
        </p>
        <div
          data-testid="alignment-target-badge"
          className="font-mono text-lg font-bold tabular-nums text-neutral-900 dark:text-white"
        >
          {challenge.mode === 'parallel'
            ? 'Match Reference Angle'
            : `Target: ${formatDeg(challenge.targetAngle)}`}
        </div>
      </div>

      <div className="w-full bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 sm:p-6 space-y-5 select-none">
        {/* Circular un-bordered lens so rectangular edges cannot be used as a ruler */}
        <div className="flex justify-center">
          <svg
            viewBox="0 0 240 240"
            data-testid="alignment-svg"
            data-mode={challenge.mode}
            data-target={challenge.targetAngle}
            className="w-52 h-52 sm:w-56 sm:h-56"
          >
            <circle
              cx="120"
              cy="120"
              r="112"
              className="fill-[#FAFAFA] dark:fill-[#0B0F17] stroke-neutral-200 dark:stroke-neutral-800"
              strokeWidth="1.5"
            />

            {/* Optional offset reference line for Parallel Match rounds */}
            {challenge.mode === 'parallel' && (
              <g transform={`translate(${refCx}, ${refCy}) rotate(${challenge.targetAngle})`}>
                <line
                  x1="-46"
                  y1="0"
                  x2="46"
                  y2="0"
                  className="stroke-emerald-600/70 dark:stroke-emerald-400/70"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="0" cy="0" r="2.5" className="fill-emerald-600 dark:fill-emerald-400" />
              </g>
            )}

            {/* Ghost true target alignment line on reveal */}
            {submitted && (
              <g transform={`rotate(${challenge.targetAngle}, 120, 120)`}>
                <line
                  x1="28"
                  y1="120"
                  x2="212"
                  y2="120"
                  stroke="#10B981"
                  strokeWidth="2.5"
                  strokeDasharray="6 4"
                />
              </g>
            )}

            {/* User adjustable bar */}
            <g transform={`rotate(${angle}, 120, 120)`}>
              <line
                x1="36"
                y1="120"
                x2="204"
                y2="120"
                className={
                  submitted
                    ? 'stroke-blue-600 dark:stroke-blue-400'
                    : 'stroke-[#111827] dark:stroke-neutral-100'
                }
                strokeWidth="4"
                strokeLinecap="round"
              />
              <circle
                cx="120"
                cy="120"
                r="5"
                fill={submitted ? '#3B82F6' : '#059669'}
              />
            </g>
          </svg>
        </div>

        {/* Fine-tune controls (asymmetric slider range) */}
        <div className="space-y-4">
          <input
            type="range"
            aria-label="Tilt angle fine adjustment"
            min={challenge.sliderMin}
            max={challenge.sliderMax}
            step={0.1}
            disabled={submitted}
            value={angle}
            onChange={(e) => setAngle(Math.round(Number(e.target.value) * 10) / 10)}
            className="w-full precision-slider min-h-[36px]"
          />

          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              disabled={submitted}
              onClick={() => nudge(-0.5)}
              className="min-h-[44px] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0B0F17] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs sm:text-sm font-mono font-medium text-neutral-800 dark:text-neutral-100 inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              0.5°
            </button>
            <button
              type="button"
              disabled={submitted}
              onClick={() => nudge(-0.1)}
              className="min-h-[44px] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0B0F17] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs sm:text-sm font-mono font-medium text-neutral-800 dark:text-neutral-100 inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
            >
              <RotateCcw className="w-3 h-3" />
              0.1°
            </button>
            <button
              type="button"
              disabled={submitted}
              onClick={() => nudge(0.1)}
              className="min-h-[44px] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0B0F17] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs sm:text-sm font-mono font-medium text-neutral-800 dark:text-neutral-100 inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
            >
              0.1°
              <RotateCw className="w-3 h-3" />
            </button>
            <button
              type="button"
              disabled={submitted}
              onClick={() => nudge(0.5)}
              className="min-h-[44px] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0B0F17] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs sm:text-sm font-mono font-medium text-neutral-800 dark:text-neutral-100 inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
            >
              0.5°
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {submitted && score !== null ? (
        <GhostRevealBar
          score={score}
          userLabel={formatDeg(angle)}
          targetLabel={formatDeg(challenge.targetAngle)}
          detailText={
            Math.abs(deviation) < 0.05
              ? 'Dead on!'
              : `Off by ${Math.abs(deviation).toFixed(1)}°`
          }
        />
      ) : (
        <button
          type="button"
          onClick={handleLockIn}
          className="w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold text-base transition-all cursor-pointer"
        >
          Lock In Alignment
        </button>
      )}
    </div>
  );
}
