/**
 * Lightweight tactile haptic feedback helper using the Vibration API.
 * Fails silently on unsupported platforms (desktop browsers, iOS Safari)
 * and respects user prefers-reduced-motion settings.
 */

function canVibrate(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  if (typeof navigator.vibrate !== 'function') {
    return false;
  }
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return false;
    }
  } catch {
    // ignore matchMedia errors
  }
  return true;
}

function pulse(pattern: number | number[]) {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // ignore blocked vibrate calls prior to gesture
  }
}

export const haptics = {
  /** Crisp micro-tap for UI buttons, toggles, and selections */
  tap() {
    pulse(10);
  },

  /** Subtle mechanical detent for slider milestones or steppers */
  tick() {
    pulse(6);
  },

  /** Metronome beat thump for Steady Beat */
  beat(accent = false) {
    pulse(accent ? 22 : 12);
  },

  /** Firm lock-in confirmation */
  lockIn() {
    pulse(18);
  },

  /** Score-scaled feedback on ghost overlay reveal */
  reveal(score: number) {
    if (score >= 95) {
      pulse([16, 35, 24]); // celebratory double-tap for S-rank
    } else if (score >= 70) {
      pulse(16);
    } else {
      pulse([12, 24, 12]);
    }
  },

  /** Series completion cadence */
  complete(avgScore: number) {
    if (avgScore >= 85) {
      pulse([18, 40, 22, 40, 32]);
    } else {
      pulse([16, 35, 22]);
    }
  },
};
