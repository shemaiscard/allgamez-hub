import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MiniGameProps } from '../../types/game';
import { createRng, randInt } from '../../utils/prng';
import { scoreHueMemory } from '../../utils/scoring';
import { soundEngine } from '../../utils/audio';
import { GhostRevealBar } from '../../components/GhostRevealBar';

const SATURATION = 72;
const MEMORIZE_MS = 2500;

export function HueMemory({ seed, onComplete }: MiniGameProps) {
  const { targetH, targetL, initialH, initialL } = useMemo(() => {
    const rng = createRng(seed);
    const tH = randInt(rng, 0, 359);
    const tL = randInt(rng, 30, 70);
    // Start user sliders far enough away so they must actively dial it in
    const iH = (tH + randInt(rng, 90, 270)) % 360;
    const iL = tL > 50 ? randInt(rng, 30, 44) : randInt(rng, 56, 70);
    return { targetH: tH, targetL: tL, initialH: iH, initialL: iL };
  }, [seed]);

  const [phase, setPhase] = useState<'memorize' | 'recreate' | 'reveal'>('memorize');
  const [countdownPct, setCountdownPct] = useState(100);
  const [guessH, setGuessH] = useState(initialH);
  const [guessL, setGuessL] = useState(initialL);
  const [score, setScore] = useState<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const remaining = Math.max(0, 100 - (elapsed / MEMORIZE_MS) * 100);
      setCountdownPct(remaining);
      if (elapsed < MEMORIZE_MS) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setPhase('recreate');
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleLockIn = useCallback(() => {
    if (phase !== 'recreate') return;
    const finalScore = scoreHueMemory(guessH, guessL, targetH, targetL);
    setScore(finalScore);
    setPhase('reveal');
    soundEngine.playReveal(finalScore);

    timeoutRef.current = window.setTimeout(() => {
      onComplete({
        score: finalScore,
        userLabel: `H${guessH}° L${guessL}%`,
        targetLabel: `H${targetH}° L${targetL}%`,
      });
    }, 1500);
  }, [phase, guessH, guessL, targetH, targetL, onComplete]);

  const targetColor = `hsl(${targetH}, ${SATURATION}%, ${targetL}%)`;
  const userColor = `hsl(${guessH}, ${SATURATION}%, ${guessL}%)`;

  const rawHueDiff = Math.abs(guessH - targetH) % 360;
  const hueErr = Math.min(rawHueDiff, 360 - rawHueDiff);
  const lightErr = Math.abs(guessL - targetL);

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto">
      <div className="text-center space-y-1">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {phase === 'memorize'
            ? 'Memorize this exact color swatch...'
            : phase === 'recreate'
              ? 'Recreate the color from memory using Hue & Lightness'
              : 'Side-by-side color comparison'}
        </p>
      </div>

      <div className="w-full bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 space-y-5">
        {/* Swatch Display */}
        {phase === 'memorize' && (
          <div className="space-y-3">
            <div
              data-testid="hue-target-swatch"
              className="w-full h-44 sm:h-52 rounded-xl border border-black/10 dark:border-white/10 transition-colors"
              style={{ backgroundColor: targetColor }}
            />
            <div className="w-full h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-none"
                style={{ width: `${countdownPct}%` }}
              />
            </div>
          </div>
        )}

        {phase === 'recreate' && (
          <div className="space-y-5">
            <div
              data-testid="hue-user-swatch"
              className="w-full h-40 sm:h-44 rounded-xl border border-black/10 dark:border-white/10"
              style={{ backgroundColor: userColor }}
            />

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-neutral-600 dark:text-neutral-300">
                  <label htmlFor="hue-slider">Hue</label>
                  <span className="font-mono tabular-nums text-neutral-400 dark:text-neutral-500">0° – 360°</span>
                </div>
                <input
                  id="hue-slider"
                  type="range"
                  min={0}
                  max={359}
                  value={guessH}
                  onChange={(e) => setGuessH(Number(e.target.value))}
                  className="w-full precision-slider hue-slider min-h-[36px]"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-neutral-600 dark:text-neutral-300">
                  <label htmlFor="lightness-slider">Lightness</label>
                  <span className="font-mono tabular-nums text-neutral-400 dark:text-neutral-500">Dark – Light</span>
                </div>
                <input
                  id="lightness-slider"
                  type="range"
                  min={20}
                  max={80}
                  value={guessL}
                  onChange={(e) => setGuessL(Number(e.target.value))}
                  className="w-full precision-slider min-h-[36px]"
                  style={{
                    background: `linear-gradient(to right, hsl(${guessH}, ${SATURATION}%, 20%), hsl(${guessH}, ${SATURATION}%, 50%), hsl(${guessH}, ${SATURATION}%, 80%))`,
                    height: '12px',
                    borderRadius: '9999px',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {phase === 'reveal' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <div
                className="w-full h-44 rounded-xl border-2 border-emerald-500"
                style={{ backgroundColor: targetColor }}
              />
              <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                Target Swatch
              </div>
            </div>
            <div className="space-y-2">
              <div
                className="w-full h-44 rounded-xl border-2 border-blue-600 dark:border-blue-500"
                style={{ backgroundColor: userColor }}
              />
              <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 dark:bg-blue-500" />
                Your Match
              </div>
            </div>
          </div>
        )}
      </div>

      {phase === 'recreate' && (
        <button
          type="button"
          onClick={handleLockIn}
          className="w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold text-base transition-all cursor-pointer"
        >
          Lock In Color
        </button>
      )}

      {phase === 'reveal' && score !== null && (
        <GhostRevealBar
          score={score}
          userLabel={`H${guessH}° L${guessL}%`}
          targetLabel={`H${targetH}° L${targetL}%`}
          detailText={`ΔH ${hueErr}° · ΔL ${lightErr}%`}
        />
      )}
    </div>
  );
}
