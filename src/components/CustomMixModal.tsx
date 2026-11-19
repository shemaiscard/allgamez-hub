import { useEffect, useState } from 'react';
import { Check, Shuffle, X } from 'lucide-react';
import { ALL_MINI_GAMES, SERIES_CONFIG } from '../config/seriesConfig';
import { soundEngine } from '../utils/audio';

interface CustomMixModalProps {
  onClose: () => void;
  onStartMix: (selectedGameIds: string[]) => void;
}

export function CustomMixModal({ onClose, onStartMix }: CustomMixModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([
    's1-angle-draw',
    's2-hue-memory',
    's3-blind-stopwatch',
    's1-trajectory-drop',
    's2-center-of-mass',
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const toggleGame = (id: string) => {
    soundEngine.playTap();
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  const handleRandomize = () => {
    soundEngine.playTap();
    const copy = [...ALL_MINI_GAMES];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    setSelectedIds(copy.slice(0, 5).map((g) => g.id));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-mix-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-neutral-200 dark:border-neutral-800 w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4">
          <div>
            <h2
              id="custom-mix-title"
              className="text-xl font-bold text-neutral-900 dark:text-white"
            >
              Build Custom Mix
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Select any 5 perceptual tests across all 3 Series ({selectedIds.length}/5 selected)
            </p>
          </div>
          <button
            type="button"
            aria-label="Close Custom Mix dialog"
            onClick={onClose}
            className="w-10 h-10 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-500 dark:text-neutral-400 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Game Picker */}
        <div className="p-6 overflow-y-auto space-y-6">
          {SERIES_CONFIG.map((series) => (
            <div key={series.id} className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                <span
                  className="w-2.5 h-2.5 rounded-xs"
                  style={{ backgroundColor: series.accentColor }}
                />
                <span>
                  {series.numberLabel} · {series.title}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {series.games.map((game) => {
                  const isSelected = selectedIds.includes(game.id);
                  const disabled = !isSelected && selectedIds.length >= 5;
                  return (
                    <button
                      key={game.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleGame(game.id)}
                      className={`text-left px-3.5 py-3 rounded-xl border transition-colors flex items-start justify-between gap-3 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                        isSelected
                          ? 'border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-800/80'
                          : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0B0F17] hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                          {game.name}
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">
                          {game.shortDesc}
                        </div>
                      </div>
                      <span
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? 'bg-neutral-900 dark:bg-white border-neutral-900 dark:border-white text-white dark:text-neutral-900'
                            : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#0B0F17] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleRandomize}
            className="min-h-[44px] px-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#111827] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
          >
            <Shuffle className="w-4 h-4" />
            <span>Randomize 5</span>
          </button>

          <button
            type="button"
            disabled={selectedIds.length !== 5}
            onClick={() => {
              soundEngine.playTap();
              onStartMix(selectedIds);
            }}
            className="min-h-[44px] px-6 rounded-xl bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white dark:text-neutral-900 text-sm font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            Start 5-Round Mix ({selectedIds.length}/5)
          </button>
        </div>
      </div>
    </div>
  );
}
