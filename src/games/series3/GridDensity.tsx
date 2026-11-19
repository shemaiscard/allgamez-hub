import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { MiniGameProps } from '../../types/game';
import { createRng, randInt, shuffleArray } from '../../utils/prng';
import { scoreGridDensity } from '../../utils/scoring';
import { soundEngine } from '../../utils/audio';
import { GhostRevealBar } from '../../components/GhostRevealBar';

const GRID_SIDE = 12;
const TOTAL_CELLS = GRID_SIDE * GRID_SIDE; // 144 cells — breaks 10x10 row-counting shortcuts
const MAX_TIME_SEC = 10;

export function GridDensity({ seed, onComplete }: MiniGameProps) {
  const { targetPct, pinnedMask, pinnedCount } = useMemo(() => {
    const rng = createRng(seed);

    // Avoid trivial round multiples of 5 (like 50%, 65%) so players judge true visual density
    let pct = randInt(rng, 32, 78);
    if (pct % 5 === 0) {
      pct = pct < 75 ? pct + randInt(rng, 1, 3) : pct - randInt(rng, 1, 3);
    }

    // Pre-scatter 12%–22% pinned cells randomly across the 12x12 board (strictly below target)
    const minPinned = Math.round(TOTAL_CELLS * 0.12);
    const maxPinned = Math.min(
      Math.round(TOTAL_CELLS * 0.22),
      Math.max(minPinned, Math.round((pct / 100) * TOTAL_CELLS) - 14)
    );
    const count = randInt(rng, minPinned, maxPinned);
    const indices = Array.from({ length: TOTAL_CELLS }, (_, i) => i);
    const chosen = new Set(shuffleArray(rng, indices).slice(0, count));
    const mask = indices.map((i) => chosen.has(i));

    return {
      targetPct: pct,
      pinnedMask: mask,
      pinnedCount: count,
    };
  }, [seed]);

  const [userCells, setUserCells] = useState<boolean[]>(() =>
    Array(TOTAL_CELLS).fill(false)
  );
  const [timeLeft, setTimeLeft] = useState<number>(MAX_TIME_SEC);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const paintingRef = useRef<boolean>(false);
  const paintModeRef = useRef<boolean>(true);
  const submittedRef = useRef<boolean>(false);
  const userCellsRef = useRef<boolean[]>(userCells);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    userCellsRef.current = userCells;
  }, [userCells]);

  const commitDensity = useCallback(
    (cellsSnapshot: boolean[]) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      const userPaintedCount = cellsSnapshot.reduce(
        (acc, v, i) => acc + (v && !pinnedMask[i] ? 1 : 0),
        0
      );
      const totalShaded = pinnedCount + userPaintedCount;
      const shadedPct = Math.round((totalShaded / TOTAL_CELLS) * 1000) / 10;
      const finalScore = scoreGridDensity(shadedPct, targetPct);

      setSubmitted(true);
      setScore(finalScore);
      soundEngine.playReveal(finalScore);

      timeoutRef.current = window.setTimeout(() => {
        onComplete({
          score: finalScore,
          userLabel: `${Math.round(shadedPct)}%`,
          targetLabel: `${targetPct}%`,
        });
      }, 1500);
    },
    [pinnedMask, pinnedCount, targetPct, onComplete]
  );

  // Unmount cleanup
  useEffect(() => {
    const stopPainting = () => {
      paintingRef.current = false;
    };
    window.addEventListener('pointerup', stopPainting);
    window.addEventListener('pointercancel', stopPainting);
    return () => {
      window.removeEventListener('pointerup', stopPainting);
      window.removeEventListener('pointercancel', stopPainting);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  // 10-second visual estimation timer prevents tedious 1-by-1 cell counting
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      if (submittedRef.current) return;
      const elapsed = (now - start) / 1000;
      const rem = Math.max(0, MAX_TIME_SEC - elapsed);
      setTimeLeft(rem);
      if (rem <= 0) {
        commitDensity(userCellsRef.current);
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [commitDensity]);

  const setCellAt = useCallback(
    (index: number, value: boolean) => {
      if (pinnedMask[index]) return;
      setUserCells((prev) => {
        if (prev[index] === value) return prev;
        const next = [...prev];
        next[index] = value;
        return next;
      });
    },
    [pinnedMask]
  );

  const totalShadedCount = useMemo(
    () =>
      pinnedCount +
      userCells.reduce((acc, v, i) => acc + (v && !pinnedMask[i] ? 1 : 0), 0),
    [pinnedCount, userCells, pinnedMask]
  );
  const shadedPct = (totalShadedCount / TOTAL_CELLS) * 100;
  const targetCellCount = Math.round((targetPct / 100) * TOTAL_CELLS);

  const handleLockIn = useCallback(() => {
    commitDensity(userCellsRef.current);
  }, [commitDensity]);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-lg mx-auto">
      <div className="text-center space-y-1">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Paint the 12×12 grid to reach total density
        </p>
        <div className="font-mono text-4xl sm:text-5xl font-bold tracking-tight tabular-nums text-neutral-900 dark:text-white">
          {targetPct}%
        </div>
      </div>

      <div className="w-full bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-5 space-y-3.5 select-none">
        {/* 10s visual timer strip */}
        <div className="max-w-[336px] mx-auto space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
            <span>Scattered cells count toward total</span>
            <span
              className={
                timeLeft <= 3 && !submitted
                  ? 'text-rose-600 dark:text-rose-400 font-bold'
                  : ''
              }
            >
              {timeLeft.toFixed(1)}s
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-colors ${
                timeLeft <= 3 ? 'bg-rose-500' : 'bg-amber-500'
              }`}
              style={{ width: `${(timeLeft / MAX_TIME_SEC) * 100}%` }}
            />
          </div>
        </div>

        <div
          data-testid="grid-density-board"
          className="grid grid-cols-12 gap-[3px] w-full max-w-[336px] mx-auto aspect-square touch-none"
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
          {userCells.map((userShaded, idx) => {
            const isPinned = pinnedMask[idx];
            const shaded = isPinned || userShaded;
            const inTargetBand = submitted && idx < targetCellCount;
            return (
              <button
                key={idx}
                type="button"
                data-cell-index={idx}
                aria-label={`Cell ${idx + 1}${isPinned ? ' pinned shaded' : shaded ? ' shaded' : ''}`}
                disabled={submitted || isPinned}
                onPointerDown={(e) => {
                  if (submitted || isPinned) return;
                  e.preventDefault();
                  const nextMode = !userCells[idx];
                  paintingRef.current = true;
                  paintModeRef.current = nextMode;
                  setCellAt(idx, nextMode);
                }}
                className={`w-full h-full rounded-[3px] border transition-colors ${
                  isPinned
                    ? submitted
                      ? 'bg-blue-700/85 border-blue-800 cursor-default'
                      : 'bg-amber-700/85 dark:bg-amber-600/80 border-amber-800 dark:border-amber-500 cursor-default'
                    : shaded
                      ? submitted
                        ? 'bg-blue-500 border-blue-600 cursor-default'
                        : 'bg-amber-500 border-amber-600 cursor-pointer'
                      : 'bg-neutral-50 dark:bg-[#0B0F17] border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer disabled:cursor-default'
                } ${inTargetBand ? 'ring-1.5 ring-emerald-500/85 ring-inset' : ''}`}
              />
            );
          })}
        </div>

        {/* Ghost visual density bar on reveal */}
        {submitted ? (
          <div className="max-w-[336px] mx-auto space-y-1.5">
            <div className="relative h-3 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-blue-600/80 dark:bg-blue-500/80 rounded-full"
                style={{ width: `${Math.min(100, shadedPct)}%` }}
              />
              <div
                className="absolute inset-y-0 w-1 bg-emerald-500 -translate-x-1/2"
                style={{ left: `${targetPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
              <span>
                Shaded: {totalShadedCount}/{TOTAL_CELLS} ({Math.round(shadedPct)}%)
              </span>
              <span>Target: {targetPct}%</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs text-neutral-400 dark:text-neutral-500 max-w-[336px] mx-auto">
            <span>Drag to paint · No live count shown</span>
            <button
              type="button"
              onClick={() => {
                setUserCells(Array(TOTAL_CELLS).fill(false));
                soundEngine.playTap();
              }}
              className="inline-flex items-center gap-1 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white font-medium cursor-pointer min-h-[32px] px-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Strokes
            </button>
          </div>
        )}
      </div>

      {submitted && score !== null ? (
        <GhostRevealBar
          score={score}
          userLabel={`${Math.round(shadedPct)}%`}
          targetLabel={`${targetPct}%`}
          detailText={`Δ ${Math.abs(Math.round(shadedPct) - targetPct)}%`}
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
