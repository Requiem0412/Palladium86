/**
 * Web Audio API 80s Retro Sound Synthesizer, Webradio/Mix-Engine & Smoothed Sound-to-Light Analyser
 * (PALLADIUM HANAU • Alpha v0.2 • Aktualisiert am 13.11.2026)
 */

import { DjJingleSlot, RadioTrackItem } from '../config/arenaConfig';

export interface SmoothedAudioBands {
  bass: number; // 0..1 smoothed bass energy
  mid: number; // 0..1 smoothed mid energy
  high: number; // 0..1 smoothed high energy
  energy: number; // 0..1 overall smoothed energy
}

class RetroSoundEffects {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private freqData: Uint8Array | null = null;

  private muted = false;
  private volume = 0.7;

  // Auto-ducking states:
  // 1) When a Twitch/YouTube stream with active audio runs on the Cinema screen, fade hall radio to 0%
  private cinemaStreamAudioActive = false;
  // 2) When a DJ Jingle / Voice Memo plays, dim background music to 20%
  private djVoiceDuckingActive = false;
  private djJingleAudioEl: HTMLAudioElement | null = null;
  private djDuckingFallbackTimer: number | null = null;

  // Webradio / Mix Player state
  private audioEl: HTMLAudioElement | null = null;
  private isRadioPlaying = false;
  private activeTrack: RadioTrackItem | null = null;
  private streamStatus: 'stopped' | 'streaming' | 'synth-fallback' = 'stopped';
  private synthStepTimer: number | null = null;
  private synthStepIndex = 0;
  private statusListeners: Set<() => void> = new Set();

  // Exponential Moving Average (EMA) state for flicker-free Sound-to-Light
  private smoothedBass = 0.22;
  private smoothedMid = 0.18;
  private smoothedHigh = 0.14;
  private lastSynthKickTime = 0;
  private lastSynthSnareTime = 0;

  public onStatusChange(cb: () => void): () => void {
    this.statusListeners.add(cb);
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  private notifyListeners(): void {
    this.statusListeners.forEach((cb) => {
      try {
        cb();
      } catch {
        // ignore
      }
    });
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.syncAudioGain();
    this.notifyListeners();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    this.syncAudioGain();
    this.notifyListeners();
  }

  public getVolume(): number {
    return this.volume;
  }

  /**
   * Auto-Ducking when a live stream (Twitch / YouTube) with audio is active on the Cinema screen:
   * Smoothly fades out the hall radio while the stream is audible, and fades it back in afterwards.
   */
  public setCinemaStreamActiveWithAudio(active: boolean): void {
    if (this.cinemaStreamAudioActive === active) return;
    this.cinemaStreamAudioActive = active;
    this.syncAudioGain();
    this.notifyListeners();
  }

  public isCinemaStreamAudioDucking(): boolean {
    return this.cinemaStreamAudioActive;
  }

  public isDjVoiceDucking(): boolean {
    return this.djVoiceDuckingActive;
  }

  /**
   * Plays a DJ Jingle or Voice Memo (.mp3, .m4a, .wav, .ogg or custom URL) WITHOUT any browser robot voice.
   * Automatically ducks background music to 20% while the jingle/voice memo plays.
   */
  public playDjJingleOrVoiceMemo(
    slot: DjJingleSlot,
    onEnded?: () => void
  ): void {
    this.stopDjJingle();
    this.djVoiceDuckingActive = true;
    this.syncAudioGain();
    this.notifyListeners();

    const finishJingle = () => {
      if (this.djDuckingFallbackTimer !== null && typeof window !== 'undefined') {
        window.clearTimeout(this.djDuckingFallbackTimer);
        this.djDuckingFallbackTimer = null;
      }
      this.djJingleAudioEl = null;
      this.djVoiceDuckingActive = false;
      this.syncAudioGain();
      this.notifyListeners();
      if (onEnded) onEnded();
    };

    if (slot.audioUrl && slot.audioUrl.trim().length > 0 && typeof window !== 'undefined') {
      try {
        const jingleAudio = new Audio(slot.audioUrl.trim());
        jingleAudio.volume = this.muted ? 0 : Math.min(1, this.volume * 1.15);
        jingleAudio.muted = this.muted;
        this.djJingleAudioEl = jingleAudio;

        jingleAudio.onended = finishJingle;
        jingleAudio.onerror = () => {
          this.playDjSynthFanfareOnly(slot.id);
          if (typeof window !== 'undefined') {
            this.djDuckingFallbackTimer = window.setTimeout(finishJingle, 2600);
          } else {
            finishJingle();
          }
        };

        const playProm = jingleAudio.play();
        if (playProm && typeof playProm.catch === 'function') {
          playProm.catch(() => {
            this.playDjSynthFanfareOnly(slot.id);
            if (typeof window !== 'undefined') {
              this.djDuckingFallbackTimer = window.setTimeout(finishJingle, 2600);
            } else {
              finishJingle();
            }
          });
        }
        return;
      } catch {
        // Fallback to musical 80s jingle chord (no robot voice!)
      }
    }

    // Musical 80s Broadcast Jingle Chime (strictly NO window.speechSynthesis!)
    this.playDjSynthFanfareOnly(slot.id);
    if (typeof window !== 'undefined') {
      this.djDuckingFallbackTimer = window.setTimeout(finishJingle, 2800);
    } else {
      finishJingle();
    }
  }

  public stopDjJingle(): void {
    if (this.djDuckingFallbackTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.djDuckingFallbackTimer);
      this.djDuckingFallbackTimer = null;
    }
    if (this.djJingleAudioEl) {
      try {
        this.djJingleAudioEl.pause();
        this.djJingleAudioEl.src = '';
      } catch {
        // ignore
      }
      this.djJingleAudioEl = null;
    }
    if (this.djVoiceDuckingActive) {
      this.djVoiceDuckingActive = false;
      this.syncAudioGain();
      this.notifyListeners();
    }
  }

  private playDjSynthFanfareOnly(
    slotId: DjJingleSlot['id']
  ): void {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chordMap: Record<DjJingleSlot['id'], number[]> = {
      intro: [261.63, 329.63, 392.0, 523.25, 659.25],
      'last-round': [440.0, 554.37, 659.25, 880.0],
      'jam-battle': [293.66, 369.99, 440.0, 587.33, 739.99],
      'slow-skating': [220.0, 277.18, 329.63, 415.3, 493.88],
    };
    const notes = chordMap[slotId] || chordMap.intro;
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = slotId === 'slow-skating' ? 'sine' : 'sawtooth';
      const t0 = now + idx * 0.08;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(
        (this.volume || 0.7) * 0.14,
        t0 + 0.04
      );
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.68);
    });
  }

  private syncAudioGain(): void {
    const duckMult = this.cinemaStreamAudioActive
      ? 0.0
      : this.djVoiceDuckingActive
        ? 0.2
        : 1.0;
    const effective = this.muted ? 0 : this.volume * duckMult;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        effective,
        this.ctx.currentTime,
        0.08
      );
    }
    if (this.audioEl) {
      this.audioEl.volume = Math.max(0, Math.min(1, effective * 0.75));
      this.audioEl.muted = this.muted || this.cinemaStreamAudioActive;
    }
    if (this.djJingleAudioEl) {
      this.djJingleAudioEl.volume = this.muted
        ? 0
        : Math.min(1, this.volume * 1.15);
      this.djJingleAudioEl.muted = this.muted;
    }
  }

  /** Unlock AudioContext cleanly on user gesture without console errors */
  public unlockAudioContext(): void {
    try {
      const ctx = this.getContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch {
      // ignore
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined' || this.muted) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : this.volume;
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 128;
        this.analyser.smoothingTimeConstant = 0.84;
        this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getOutputNode(): AudioNode | null {
    const ctx = this.getContext();
    if (!ctx) return null;
    return this.masterGain || ctx.destination;
  }

  // ============================================================================
  // 80s WEBRADIO / MIX-PLAYER WITH AUTOMATIC SYNTH-SEQUENCER FALLBACK
  // ============================================================================

  public getRadioState(): {
    isPlaying: boolean;
    activeTrack: RadioTrackItem | null;
    streamStatus: 'stopped' | 'streaming' | 'synth-fallback';
  } {
    return {
      isPlaying: this.isRadioPlaying,
      activeTrack: this.activeTrack,
      streamStatus: this.streamStatus,
    };
  }

  public startRadioTrack(track: RadioTrackItem): void {
    this.activeTrack = track;
    this.isRadioPlaying = true;
    this.stopInternalPlaybackOnly();

    if (track.streamUrl && typeof window !== 'undefined') {
      try {
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.src = track.streamUrl;
        audio.volume = this.muted ? 0 : this.volume * 0.75;
        audio.muted = this.muted;

        const fallbackToSynth = () => {
          if (!this.isRadioPlaying || this.activeTrack?.id !== track.id) return;
          if (this.audioEl) {
            try {
              this.audioEl.pause();
            } catch {
              // ignore
            }
            this.audioEl = null;
          }
          this.startProcedural80sMixLoop(track);
        };

        audio.onerror = fallbackToSynth;
        audio.onstalled = fallbackToSynth;

        this.audioEl = audio;
        this.streamStatus = 'streaming';
        this.notifyListeners();

        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            fallbackToSynth();
          });
        }
        return;
      } catch {
        this.startProcedural80sMixLoop(track);
        return;
      }
    }

    this.startProcedural80sMixLoop(track);
  }

  public stopRadio(): void {
    this.isRadioPlaying = false;
    this.streamStatus = 'stopped';
    this.stopInternalPlaybackOnly();
    this.notifyListeners();
  }

  public toggleRadio(defaultTrack: RadioTrackItem): void {
    if (this.isRadioPlaying) {
      this.stopRadio();
    } else {
      this.startRadioTrack(this.activeTrack || defaultTrack);
    }
  }

  private stopInternalPlaybackOnly(): void {
    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.src = '';
      } catch {
        // ignore
      }
      this.audioEl = null;
    }
    if (this.synthStepTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.synthStepTimer);
      this.synthStepTimer = null;
    }
  }

  private startProcedural80sMixLoop(track: RadioTrackItem): void {
    if (typeof window === 'undefined') return;
    if (this.synthStepTimer !== null) {
      window.clearInterval(this.synthStepTimer);
      this.synthStepTimer = null;
    }
    this.streamStatus = 'synth-fallback';
    this.synthStepIndex = 0;
    this.notifyListeners();

    const bpm = Math.max(95, Math.min(145, track.bpm || 118));
    const sixteenthMs = Math.round((60000 / bpm) / 4);

    // 16-step basslines per style (frequencies in Hz)
    const bassPatterns: Record<RadioTrackItem['synthStyle'], number[]> = {
      'electro-boogie': [
        110, 0, 110, 220, 130.81, 0, 146.83, 0, 164.81, 0, 146.83, 130.81, 110,
        0, 98, 110,
      ],
      'miami-bass': [
        65.41, 65.41, 0, 65.41, 0, 77.78, 87.31, 0, 65.41, 0, 98.0, 0, 87.31,
        77.78, 65.41, 0,
      ],
      'italo-disco': [
        130.81, 261.63, 130.81, 261.63, 146.83, 293.66, 146.83, 293.66, 164.81,
        329.63, 164.81, 329.63, 146.83, 293.66, 196.0, 392.0,
      ],
      'funk-jam': [
        98.0, 0, 196.0, 98.0, 116.54, 130.81, 0, 146.83, 98.0, 0, 174.61,
        146.83, 130.81, 116.54, 98.0, 0,
      ],
    };

    const arpPatterns: Record<RadioTrackItem['synthStyle'], number[]> = {
      'electro-boogie': [440, 523.25, 659.25, 587.33, 440, 659.25, 783.99, 659.25],
      'miami-bass': [523.25, 0, 622.25, 698.46, 0, 783.99, 698.46, 523.25],
      'italo-disco': [523.25, 659.25, 783.99, 1046.5, 987.77, 783.99, 659.25, 587.33],
      'funk-jam': [392.0, 493.88, 587.33, 698.46, 587.33, 493.88, 392.0, 0],
    };

    this.synthStepTimer = window.setInterval(() => {
      if (!this.isRadioPlaying || this.muted) return;
      const ctx = this.getContext();
      const out = this.getOutputNode();
      if (!ctx || !out) return;

      const step = this.synthStepIndex % 16;
      this.synthStepIndex++;
      const now = ctx.currentTime;

      // 1) 808 / Linndrum Kick on steps 0, 4, 8, 12 (plus syncopated step 10 in miami-bass)
      if (
        step % 4 === 0 ||
        (track.synthStyle === 'miami-bass' && step === 10)
      ) {
        this.lastSynthKickTime = performance.now();
        const kickOsc = ctx.createOscillator();
        const kickGain = ctx.createGain();
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(135, now);
        kickOsc.frequency.exponentialRampToValueAtTime(42, now + 0.14);
        kickGain.gain.setValueAtTime(0.16, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        kickOsc.connect(kickGain);
        kickGain.connect(out);
        kickOsc.start(now);
        kickOsc.stop(now + 0.17);
      }

      // 2) Synth Clap / Snare on steps 4 and 12
      if (step === 4 || step === 12) {
        this.lastSynthSnareTime = performance.now();
        const snareOsc = ctx.createOscillator();
        const snareGain = ctx.createGain();
        snareOsc.type = 'triangle';
        snareOsc.frequency.setValueAtTime(290, now);
        snareOsc.frequency.exponentialRampToValueAtTime(110, now + 0.09);
        snareGain.gain.setValueAtTime(0.09, now);
        snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        snareOsc.connect(snareGain);
        snareGain.connect(out);
        snareOsc.start(now);
        snareOsc.stop(now + 0.11);
      }

      // 3) Analog Bassline
      const bassPattern =
        bassPatterns[track.synthStyle] || bassPatterns['electro-boogie'];
      const bassFreq = bassPattern[step];
      if (bassFreq > 0) {
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = track.synthStyle === 'miami-bass' ? 'triangle' : 'sawtooth';
        bassOsc.frequency.setValueAtTime(bassFreq, now);
        bassGain.gain.setValueAtTime(0.065, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        bassOsc.connect(bassGain);
        bassGain.connect(out);
        bassOsc.start(now);
        bassOsc.stop(now + 0.14);
      }

      // 4) 80s Lead Arpeggio on even steps
      if (step % 2 === 0) {
        const arpPattern =
          arpPatterns[track.synthStyle] || arpPatterns['electro-boogie'];
        const arpFreq = arpPattern[(step / 2) % arpPattern.length];
        if (arpFreq > 0) {
          const arpOsc = ctx.createOscillator();
          const arpGain = ctx.createGain();
          arpOsc.type = 'square';
          arpOsc.frequency.setValueAtTime(arpFreq, now);
          arpGain.gain.setValueAtTime(0.032, now);
          arpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
          arpOsc.connect(arpGain);
          arpGain.connect(out);
          arpOsc.start(now);
          arpOsc.stop(now + 0.12);
        }
      }
    }, sixteenthMs);
  }

  /**
   * Flicker-free Exponential Moving Average (EMA) Sound-to-Light bands (0..1).
   * Combines real Web Audio AnalyserNode data with smooth beat envelopes so
   * stage lights, disco spots, and PA woofers pulse musically without harsh strobing.
   */
  public getSmoothedAudioBands(nowMs = performance.now()): SmoothedAudioBands {
    if (this.muted || this.volume <= 0.01) {
      this.smoothedBass *= 0.92;
      this.smoothedMid *= 0.92;
      this.smoothedHigh *= 0.92;
      return {
        bass: this.smoothedBass,
        mid: this.smoothedMid,
        high: this.smoothedHigh,
        energy:
          (this.smoothedBass * 0.5 +
            this.smoothedMid * 0.35 +
            this.smoothedHigh * 0.15) *
          0.5,
      };
    }

    let rawBass = 0;
    let rawMid = 0;
    let rawHigh = 0;

    if (this.analyser && this.freqData && this.ctx?.state === 'running') {
      this.analyser.getByteFrequencyData(
        this.freqData as Uint8Array<ArrayBuffer>
      );
      // Low bins (0..5) -> Bass
      let bSum = 0;
      for (let i = 0; i < 6; i++) bSum += this.freqData[i];
      rawBass = bSum / (6 * 255);

      // Mid bins (6..18) -> Mid
      let mSum = 0;
      for (let i = 6; i < 19; i++) mSum += this.freqData[i];
      rawMid = mSum / (13 * 255);

      // High bins (19..36) -> High
      let hSum = 0;
      for (let i = 19; i < 36; i++) hSum += this.freqData[i];
      rawHigh = hSum / (17 * 255);
    }

    // Add smooth musical beat envelope (works both during CORS-restricted streams and synth loop)
    const bpm = this.activeTrack?.bpm || 118;
    const beatPeriodMs = 60000 / bpm;
    const beatPhase = (nowMs % beatPeriodMs) / beatPeriodMs;
    const smoothKickEnvelope = Math.pow(Math.max(0, 1 - beatPhase * 1.65), 2);
    const halfBeatPhase = ((nowMs + beatPeriodMs * 0.5) % beatPeriodMs) / beatPeriodMs;
    const smoothSnareEnvelope = Math.pow(
      Math.max(0, 1 - halfBeatPhase * 2.1),
      2
    );

    const synthKickBoost =
      Math.max(0, 1 - (nowMs - this.lastSynthKickTime) / 220) * 0.55;
    const synthSnareBoost =
      Math.max(0, 1 - (nowMs - this.lastSynthSnareTime) / 180) * 0.45;

    const targetBass = Math.min(
      1,
      Math.max(rawBass * 1.35, 0.2 + smoothKickEnvelope * 0.52 + synthKickBoost)
    );
    const targetMid = Math.min(
      1,
      Math.max(
        rawMid * 1.3,
        0.18 +
          smoothSnareEnvelope * 0.42 +
          Math.sin(nowMs * 0.0032) * 0.12 +
          synthSnareBoost
      )
    );
    const targetHigh = Math.min(
      1,
      Math.max(
        rawHigh * 1.25,
        0.15 + (0.5 + 0.5 * Math.sin(nowMs * 0.0055)) * 0.32
      )
    );

    // Attack/Release EMA smoothing (prevents any harsh frame-to-frame flicker)
    const attack = 0.16;
    const release = 0.06;
    this.smoothedBass +=
      (targetBass - this.smoothedBass) *
      (targetBass > this.smoothedBass ? attack : release);
    this.smoothedMid +=
      (targetMid - this.smoothedMid) *
      (targetMid > this.smoothedMid ? attack : release);
    this.smoothedHigh +=
      (targetHigh - this.smoothedHigh) *
      (targetHigh > this.smoothedHigh ? attack : release);

    const energy =
      this.smoothedBass * 0.5 +
      this.smoothedMid * 0.35 +
      this.smoothedHigh * 0.15;

    return {
      bass: this.smoothedBass,
      mid: this.smoothedMid,
      high: this.smoothedHigh,
      energy,
    };
  }

  // ============================================================================
  // PROCEDURAL GAMEPLAY SOUND EFFECTS
  // ============================================================================

  /** Warm 80s synth chord when opening the First-Visit Velvet Curtain */
  public playCurtainReveal(): void {
    const ctx = this.getContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25]; // C major 9th synth swell
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const t = now + i * 0.06;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 1.1);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 1.15);
    });
  }

  /** Playful whoosh when triggering a 360° spin (`[Space]` / `[Q]` / `[1]` / Pad-B) */
  public playSpin360(): void {
    const ctx = this.getContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.2);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.4);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.43);
  }

  /** Crisp upward spring sound when jumping (`[J]` / `[Shift]` / `[4]` / Pad-A) */
  public playJump(): void {
    const ctx = this.getContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(590, now + 0.22);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  /** Skate Guard shrill whistle ("Trrriiiiieeeet!") with rapid pea-trill modulation */
  public playSkateGuardWhistle(): void {
    const ctx = this.getContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.055;
      osc.frequency.setValueAtTime(2750 + (i % 2) * 280, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.052);
    }
  }

  /** Refreshing arpeggio for Slush-Puppie or fizzy Bloba Cola pickup */
  public playDrinkRefresh(): void {
    const ctx = this.getContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.28);
    });
  }

  /** Neon Softball throw or hit sound in Ballspiel mode */
  public playBallThrowOrHit(isHit = false): void {
    const ctx = this.getContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isHit ? 'square' : 'sine';
    osc.frequency.setValueAtTime(isHit ? 640 : 420, now);
    osc.frequency.exponentialRampToValueAtTime(isHit ? 180 : 190, now + 0.14);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /** Slalom Gate passed combo chime */
  public playSlalomCombo(comboCount: number): void {
    const ctx = this.getContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const baseFreq = Math.min(1400, 440 + comboCount * 55);
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, now + 0.12);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /** Bump or seat-slide crash sound (plus DJ record scratch on heavy crash) */
  public playCrash(heavyScratch = false): void {
    const ctx = this.getContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    if (heavyScratch) {
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.linearRampToValueAtTime(140, now + 0.16);
      osc.frequency.linearRampToValueAtTime(510, now + 0.32);
      osc.frequency.linearRampToValueAtTime(95, now + 0.55);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.6);
    } else {
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.18);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.21);
    }
  }

  /** Victory jingle when unlocking a Challenge / Pro-Shop Upgrade */
  public playChallengeUnlocked(): void {
    const ctx = this.getContext();
    const out = this.getOutputNode();
    if (!ctx || !out) return;
    const now = ctx.currentTime;
    const notes = [587.33, 783.99, 987.77, 1174.66]; // D5 G5 B5 D6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      const t = now + i * 0.08;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  }
}

export const soundFX = new RetroSoundEffects();
