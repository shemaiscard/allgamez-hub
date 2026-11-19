import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { MiniGameProps } from '../../types/game';
import { createRng, randInt } from '../../utils/prng';
import { scoreGridDensity } from '../../utils/scoring';
import { soundEngine } from '../../utils/audio';
import { GhostRevealBar } from '../../components/GhostRevealBar';

export function GridDensity({ seed, onComplete }: MiniGameProps) {
  const targetPct = useMemo(() => {
    const rng = createRng(seed);
    return randInt(rng, 18, 78);
  }, [seed]);

  const [cells, setCells] = useState<boolean[]>(() => Array(100).fill(false));
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const paintingRef = useRef<boolean>(false);
  const paintModeRef = useRef<boolean>(true);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const stopPainting = () => {
      paintingRef.current = false;
    };
    window.addEventListener('pointerup', stopPainting);
    window.addEventListener('pointercancel', stopPainting);
    return () => {
      window.removeEventListener('pointerup', stopPainting);
      window.removeEventListener('pointercancel', stopPainting);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const setCellAt = useCallback((index: number, value: boolean) => {
    setCells((prev) => {
      if (prev[index] === value) return prev;
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const shadedCount = useMemo(() => cells.filter(Boolean).length, [cells]);

  const handleLockIn = useCallback(() => {
    if (submitted) return;
    const finalScore = scoreGridDensity(shadedCount, targetPct);
    setSubmitted(true);
    setScore(finalScore);
    soundEngine.playReveal(finalScore);

    timeoutRef.current = window.setTimeout(() => {
      onComplete({
        score: finalScore,
        userLabel: `${shadedCount}%`,
        targetLabel: `${targetPct}%`,
      });
    }, 1500);
  }, [submitted, shadedCount, targetPct, onComplete]);

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto">
      <div className="text-center space-y-1">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Shade cells across the 10×10 grid to cover
        </p>
        <div className="font-mono text-4xl sm:text-5xl font-bold tracking-tight tabular-nums text-neutral-900 dark:text-white">
          {targetPct}%
        </div>
      </div>

      <div className="w-full bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-5 space-y-4 select-none">
        <div
          data-testid="grid-density-board"
          className="grid grid-cols-10 gap-1 w-full max-w-[330px] mx-auto aspect-square touch-none"
          onPointerMove={(e) => {
            if (!paintingRef.current || submitted) return;
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const idxAttr = el?.getAttribute('data-cell-index');
            if (idxAttr !== null && idxAttr !== undefined) {
              const idx = Number(idxAttr);
              if (!Number.isNaN(idx)) {
                setCellAt(idx, paintModeRef.current);
              }
            }
          }}
        >
          {cells.map((shaded, idx) => {
            // In ghost reveal, highlight cells 0..targetPct-1 outline in emerald to visualize target fill proportion
            const inTargetBand = submitted && idx < targetPct;
            return (
              <button
                key={idx}
                type="button"
                data-cell-index={idx}
                aria-label={`Cell ${idx + 1}${shaded ? ' shaded' : ''}`}
                disabled={submitted}
                onPointerDown={(e) => {
                  if (submitted) return;
                  e.preventDefault();
                  const nextMode = !cells[idx];
                  paintingRef.current = true;
                  paintModeRef.current = nextMode;
                  setCellAt(idx, nextMode);
                }}
                className={`w-full h-full rounded-[4px] border transition-colors cursor-pointer disabled:cursor-default ${
                  shaded
                    ? submitted
                      ? 'bg-blue-600 border-blue-700'
                      : 'bg-amber-500 border-amber-600'
                    : 'bg-neutral-50 dark:bg-[#0B0F17] border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                } ${inTargetBand ? 'ring-2 ring-emerald-500/80 ring-inset' : ''}`}
              />
            );
          })}
        </div>

        {/* Ghost visual density bar on reveal */}
        {submitted ? (
          <div className="max-w-[330px] mx-auto space-y-1.5">
            <div className="relative h-3 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-blue-600/80 dark:bg-blue-500/80 rounded-full"
                style={{ width: `${shadedCount}%` }}
              />
              <div
                className="absolute inset-y-0 w-1 bg-emerald-500 -translate-x-1/2"
                style={{ left: `${targetPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
              <span>Shaded: {shadedCount}/100 cells</span>
              <span>Target: {targetPct}/100</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs text-neutral-400 dark:text-neutral-500 max-w-[330px] mx-auto">
            <span>Click or drag to shade · No live count shown</span>
            <button
              type="button"
              onClick={() => {
                setCells(Array(100).fill(false));
                soundEngine.playTap();
              }}
              className="inline-flex items-center gap-1 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white font-medium cursor-pointer min-h-[32px] px-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        )}
      </div>

      {submitted && score !== null ? (
        <GhostRevealBar
          score={score}
          userLabel={`${shadedCount}%`}
          targetLabel={`${targetPct}%`}
          detailText={`Δ ${Math.abs(shadedCount - targetPct)} cells`}
        />
      ) : (
        <button
          type="button"
          onClick={handleLockIn}
          className="w-full min-h-[48px] rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white font-semibold text-base transition-all cursor-pointer"
        >
          Lock In Density
        </button>
      )}
    </div>
  );
}
