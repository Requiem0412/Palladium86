/**
 * Web Audio API Retro Sound Synthesizer
 * Generates authentic arcade & cash register sound effects without external assets.
 */

class RetroSoundEffects {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Classic mechanical + neon Cash Register "Ka-Ching!" sound for the Cashier Time-Jump.
   */
  public playKaChing(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. "Ka-" (Short mechanical drawer latch click/thud)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(190, now);
    osc1.frequency.exponentialRampToValueAtTime(520, now + 0.065);
    gain1.gain.setValueAtTime(0.26, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.08);

    // 2. "-Ching!" (Bright metallic bell harmonic pair)
    const bellFreqs = [1567.98, 2093.0, 2637.02, 3135.96]; // G6, C7, E7, G7
    bellFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      const startTime = now + 0.085 + idx * 0.02;
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.16 / (idx * 0.5 + 1), startTime);
      gain.gain.exponentialRampToValueAtTime(0.0008, startTime + 0.75);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.78);
    });
  }

  /**
   * Sparkling 80s synth arpeggio when redeeming a Slush-Puppie Speed Boost token.
   */
  public playSlushBoost(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5 E5 G5 C6 E6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const t = now + i * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  /**
   * Playful whoosh sound when triggering a 360° spin.
   */
  public playSpin360(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.22);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.42);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  /**
   * Short chime when a lap is completed or Slush token recharges.
   */
  public playTokenRecharged(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [880, 1174.66].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.08;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.13, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  }
}

export const soundFX = new RetroSoundEffects();
