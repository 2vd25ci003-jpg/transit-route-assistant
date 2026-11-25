/**
 * Procedural Web Audio API sound design for TransitAI 3D Intro.
 * Muted by default until the user explicitly enables sound.
 */

class IntroAudioEngine {
  private ctx: AudioContext | null = null;
  private enabled = false;
  private busOsc: OscillatorNode | null = null;
  private busGain: GainNode | null = null;

  public setEnabled(next: boolean): void {
    this.enabled = next;
    if (next) {
      this.ensureContext();
      this.playBusAmbience();
    } else {
      this.stopAll();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playOpeningSwell(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(55, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 1.4);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.85);
  }

  public playBusAmbience(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || this.busOsc) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(48, now);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(140, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.8);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);

    this.busOsc = osc;
    this.busGain = gain;
  }

  public playGpsChime(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + i * 0.09);

      gain.gain.setValueAtTime(0.001, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.06, now + i * 0.09 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.5);
    });
  }

  public playLogoReveal(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [130.81, 196.0, 261.63, 392.0].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.55);
    });
  }

  public stopAll(): void {
    if (this.busOsc && this.busGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.busGain.gain.linearRampToValueAtTime(0.0001, now + 0.15);
        this.busOsc.stop(now + 0.2);
      } catch {
        // Ignore already stopped oscillator
      }
      this.busOsc = null;
      this.busGain = null;
    }
  }
}

export const introAudio = new IntroAudioEngine();
