import type { EngineSoundEvent } from '../types';

class SoundService {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  public playEvents(events: EngineSoundEvent[]): void {
    if (this.muted || !events.length) return;
    if (!this.ctx) this.unlock();
    if (!this.ctx || this.ctx.state === 'suspended') return;

    for (const ev of events) {
      switch (ev.type) {
        case 'kick':
          this.playKick(ev.power);
          break;
        case 'pass':
          this.playKick(0.32);
          break;
        case 'post':
          this.playPostHit();
          break;
        case 'whistle':
          this.playWhistle(ev.kind);
          break;
        case 'tackle':
          this.playTackle(ev.muddy);
          break;
        case 'goal':
          this.playCrowdGoal();
          break;
        case 'crowd_ooh':
          this.playCrowdOoh();
          break;
      }
    }
  }

  public playKick(power = 0.7): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    const startFreq = 135 + power * 45;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.11);

    gain.gain.setValueAtTime(0.28 + power * 0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);

    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 900;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.12 + power * 0.08, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + 0.06);
    }
  }

  public playPostHit(): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [415, 790, 1260];
    freqs.forEach((f, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, now);
      gain.gain.setValueAtTime(0.16 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.45);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.48);
    });
  }

  public playWhistle(kind: 'kickoff' | 'foul' | 'fulltime'): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    const triggerPeaBurst = (startOffset: number, duration: number, freq: number) => {
      if (!this.ctx) return;
      const t0 = now + startOffset;
      const osc = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);

      // Pea-whistle trill modulation
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(38, t0);
      lfoGain.gain.setValueAtTime(145, t0);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(0.15, t0 + 0.02);
      gain.gain.setValueAtTime(0.15, t0 + duration - 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t0);
      lfo.start(t0);
      osc.stop(t0 + duration + 0.02);
      lfo.stop(t0 + duration + 0.02);
    };

    if (kind === 'kickoff') {
      triggerPeaBurst(0, 0.34, 2850);
    } else if (kind === 'foul') {
      triggerPeaBurst(0, 0.16, 3050);
      triggerPeaBurst(0.2, 0.28, 2900);
    } else {
      triggerPeaBurst(0, 0.18, 2850);
      triggerPeaBurst(0.23, 0.18, 2850);
      triggerPeaBurst(0.46, 0.55, 2950);
    }
  }

  public playTackle(muddy: boolean): void {
    if (this.muted || !this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(muddy ? 420 : 1200, now);
    filter.frequency.exponentialRampToValueAtTime(muddy ? 180 : 500, now + 0.25);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(muddy ? 0.22 : 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.3);
  }

  public playCrowdGoal(): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Crowd roar swell
    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(520, now);
      filter.Q.value = 0.7;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.26, now + 0.22);
      gain.gain.setValueAtTime(0.22, now + 1.0);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.1);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      src.start(now);
      src.stop(now + 2.15);
    }

    // Retro Amiga arcade goal fanfare arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      if (!this.ctx) return;
      const t = now + i * 0.085;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.055, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  }

  public playCrowdOoh(): void {
    if (this.muted || !this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(620, now);
    filter.frequency.linearRampToValueAtTime(380, now + 0.65);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.72);
  }
}

export const soundService = new SoundService();
