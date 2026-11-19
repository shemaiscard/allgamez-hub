import { haptics } from './haptics';

/**
 * Procedural Web Audio API sound engine + synchronized tactile haptics.
 * Synthesizes crisp metronome ticks, tactile UI clicks, and score reveal chimes
 * without requiring any external audio assets.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  public setMuted(muted: boolean) {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioCtx();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock() {
    this.getContext();
  }

  /** Crisp percussive woodblock / clave metronome click for Steady Beat */
  public playMetronomeClick(accent = false) {
    haptics.beat(accent);
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(accent ? 1320 : 880, now);
    osc.frequency.exponentialRampToValueAtTime(accent ? 660 : 440, now + 0.045);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(accent ? 0.32 : 0.22, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.065);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.075);
  }

  /** Subtle tactile click for buttons and canvas taps */
  public playTap() {
    haptics.tap();
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.025);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.036);
  }

  /** Score-scaled reveal chime when locking in a round */
  public playReveal(score: number) {
    haptics.reveal(score);
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes =
      score >= 95
        ? [523.25, 659.25, 783.99, 1046.5] // C major 7-ish arpeggio
        : score >= 85
          ? [440, 554.37, 659.25] // A major triad
          : score >= 70
            ? [392, 493.88] // G-B fifth/third
            : score >= 50
              ? [329.63, 293.66] // gentle step down
              : [220, 196]; // low muted two-note

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + idx * 0.055;

      osc.type = score >= 70 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  /** Warm resolution chord on series summary */
  public playSeriesComplete(avgScore: number) {
    haptics.complete(avgScore);
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const chord =
      avgScore >= 85
        ? [261.63, 329.63, 392.0, 523.25]
        : [261.63, 311.13, 392.0];

    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + idx * 0.04;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.09, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.6);
    });
  }
}

export const soundEngine = new SoundEngine();
