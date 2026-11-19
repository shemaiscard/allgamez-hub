import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MiniGameProps } from '../../types/game';
import { createRng, randInt } from '../../utils/prng';
import { scoreOddTileOut } from '../../utils/scoring';
import { soundEngine } from '../../utils/audio';
import { GhostRevealBar } from '../../components/GhostRevealBar';

const MAX_TIME_SEC = 10;

export function OddTileOut({ seed, onComplete }: MiniGameProps) {
  const puzzle = useMemo(() => {
    const rng = createRng(seed);
    const baseH = randInt(rng, 0, 359);
    const baseS = randInt(rng, 52, 74);
    const baseL = randInt(rng, 42, 58);
    const targetRow = randInt(rng, 0, 4);
    const targetCol = randInt(rng, 0, 4);
    const direction = rng() > 0.5 ? 1 : -1;
    // Subtle but reliably perceptible delta
    const deltaL = direction * randInt(rng, 7, 10);
    const deltaS = direction * randInt(rng, 4, 7);

    return {
      baseColor: `hsl(${baseH}, ${baseS}%, ${baseL}%)`,
      oddColor: `hsl(${baseH}, ${Math.max(25, Math.min(95, baseS + deltaS))}%, ${Math.max(20, Math.min(82, baseL + deltaL))}%)`,
      targetRow,
      targetCol,
    };
  }, [seed]);

  const [timeLeft, setTimeLeft] = useState(MAX_TIME_SEC);
  const [picked, setPicked] = useState<{ row: number; col: number } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [elapsedAtPick, setElapsedAtPick] = useState(0);

  const startRef = useRef<number>(performance.now());
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const submittedRef = useRef(false);

  const finishRound = useCallback(
    (pickedRow: number | null, pickedCol: number | null, elapsedSec: number) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      const finalScore = scoreOddTileOut({
        pickedRow,
        pickedCol,
        targetRow: puzzle.targetRow,
        targetCol: puzzle.targetCol,
        elapsedSec,
        maxSec: MAX_TIME_SEC,
      });

      setSubmitted(true);
      setScore(finalScore);
      setElapsedAtPick(elapsedSec);
      soundEngine.playReveal(finalScore);

      const coordStr = (r: number, c: number) => `R${r + 1}C${c + 1}`;
      const userLabel =
        pickedRow === null || pickedCol === null
          ? 'Timed out'
          : pickedRow === puzzle.targetRow && pickedCol === puzzle.targetCol
            ? `${coordStr(pickedRow, pickedCol)} (${elapsedSec.toFixed(1)}s)`
            : coordStr(pickedRow, pickedCol);

      timeoutRef.current = window.setTimeout(() => {
        onComplete({
          score: finalScore,
          userLabel,
          targetLabel: coordStr(puzzle.targetRow, puzzle.targetCol),
        });
      }, 1500);
    },
    [puzzle, onComplete]
  );

  useEffect(() => {
    startRef.current = performance.now();
    const tick = (now: number) => {
      if (submittedRef.current) return;
      const elapsed = (now - startRef.current) / 1000;
      const rem = Math.max(0, MAX_TIME_SEC - elapsed);
      setTimeLeft(rem);
      if (rem <= 0) {
        finishRound(null, null, MAX_TIME_SEC);
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [finishRound]);

  const handleTileClick = (row: number, col: number) => {
    if (submittedRef.current) return;
    const elapsed = (performance.now() - startRef.current) / 1000;
    setPicked({ row, col });
    finishRound(row, col, elapsed);
  };

  const coordLabel = (r: number, c: number) => `R${r + 1}C${c + 1}`;

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto">
      <div className="text-center space-y-1">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Tap the single tile with a slightly different shade
        </p>
        <div className="font-mono text-2xl font-bold tabular-nums text-neutral-900 dark:text-white">
          {timeLeft.toFixed(1)}s
        </div>
      </div>

      <div className="w-full bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6 space-y-4">
        <div className="w-full h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
          <div
            className="h-full bg-emerald-600 transition-none"
            style={{ width: `${(timeLeft / MAX_TIME_SEC) * 100}%` }}
          />
        </div>

        <div
          data-testid="odd-tile-grid"
          className="grid grid-cols-5 gap-2 sm:gap-2.5 w-full max-w-[360px] mx-auto aspect-square"
        >
          {Array.from({ length: 25 }, (_, idx) => {
            const row = Math.floor(idx / 5);
            const col = idx % 5;
            const isTarget = row === puzzle.targetRow && col === puzzle.targetCol;
            const isPicked = picked?.row === row && picked?.col === col;

            return (
              <button
                key={idx}
                type="button"
                aria-label={`Grid tile row ${row + 1} column ${col + 1}`}
                disabled={submitted}
                onClick={() => handleTileClick(row, col)}
                className="relative w-full h-full rounded-lg transition-transform active:scale-95 cursor-pointer disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-white"
                style={{
                  backgroundColor: isTarget ? puzzle.oddColor : puzzle.baseColor,
                }}
              >
                {submitted && isTarget && (
                  <span className="absolute inset-0 rounded-lg ring-4 ring-emerald-500 ring-offset-2 dark:ring-offset-[#111827] pointer-events-none" />
                )}
                {submitted && isPicked && !isTarget && (
                  <span className="absolute inset-0 rounded-lg ring-4 ring-blue-500 ring-offset-2 dark:ring-offset-[#111827] pointer-events-none" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {submitted && score !== null && (
        <GhostRevealBar
          score={score}
          userLabel={
            picked
              ? coordLabel(picked.row, picked.col)
              : 'Timed out'
          }
          targetLabel={coordLabel(puzzle.targetRow, puzzle.targetCol)}
          detailText={
            picked &&
            picked.row === puzzle.targetRow &&
            picked.col === puzzle.targetCol
              ? `Found in ${elapsedAtPick.toFixed(2)}s`
              : 'Missed target tile'
          }
        />
      )}
    </div>
  );
}
