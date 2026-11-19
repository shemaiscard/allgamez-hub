import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { soundEngine } from '../utils/audio';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (!showIOSGuide) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowIOSGuide(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showIOSGuide]);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        data-testid="pwa-install-btn"
        onClick={() => {
          soundEngine.playTap();
          void install();
        }}
        className="h-11 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer shrink-0 whitespace-nowrap"
      >
        <Download className="w-4 h-4" />
        <span>Install</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          data-testid="pwa-install-ios-btn"
          onClick={() => {
            soundEngine.playTap();
            setShowIOSGuide(true);
          }}
          className="h-11 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111827] hover:bg-neutral-50 dark:hover:bg-neutral-800 active:scale-[0.98] text-neutral-700 dark:text-neutral-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer shrink-0 whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Install Gamez on iOS"
            className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 dark:bg-black/70 backdrop-blur-xs p-4"
          >
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#111827] border border-neutral-200 dark:border-neutral-800 p-6 shadow-xl space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                  Install Gamez on iOS
                </h3>
                <button
                  type="button"
                  aria-label="Close install instructions"
                  onClick={() => setShowIOSGuide(false)}
                  className="w-8 h-8 rounded-lg border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="text-sm text-neutral-600 dark:text-neutral-300 space-y-2.5 list-decimal list-inside">
                <li>
                  Tap the{' '}
                  <span className="inline-flex items-center gap-1 font-semibold text-neutral-900 dark:text-white">
                    <Share className="w-3.5 h-3.5" /> Share
                  </span>{' '}
                  button in Safari.
                </li>
                <li>
                  Scroll down and tap{' '}
                  <strong className="text-neutral-900 dark:text-white">
                    Add to Home Screen
                  </strong>
                  .
                </li>
                <li>Launch Gamez anytime — even completely offline.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[44px] rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
