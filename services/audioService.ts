
// A lightweight retro sound synthesizer using Web Audio API
// No external assets required.

class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private initialized: boolean = false;

  constructor() {
    // Lazy init handled in interaction
  }

  // Initialize on first user interaction (required by browsers)
  public init() {
    if (this.initialized) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 0.3; // Default volume (30%)
      this.initialized = true;
    } catch (e) {
      console.error("Web Audio API not supported", e);
    }
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.3, this.ctx?.currentTime || 0);
    }
    return this.isMuted;
  }

  public getMuteState() {
    return this.isMuted;
  }

  private createOscillator(type: OscillatorType, freq: number) {
    if (!this.ctx || !this.masterGain) return null;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.connect(gain);
    gain.connect(this.masterGain);
    return { osc, gain };
  }

  // --- PRESETS ---

  // Jump / Move Up: Slide frequency up
  public playJump() {
    if (this.isMuted || !this.ctx) return;
    const { osc, gain } = this.createOscillator('square', 150) || {};
    if (!osc || !gain) return;

    const now = this.ctx.currentTime;
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Score / Collect: High pitched ping
  public playScore() {
    if (this.isMuted || !this.ctx) return;
    // Two tones for a coin sound
    const now = this.ctx.currentTime;
    
    const note1 = this.createOscillator('sine', 1200);
    if (note1) {
        note1.gain.gain.setValueAtTime(0.5, now);
        note1.gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        note1.osc.start(now);
        note1.osc.stop(now + 0.1);
    }

    setTimeout(() => {
        const note2 = this.createOscillator('sine', 1800);
        if (note2) {
            const t = this.ctx!.currentTime;
            note2.gain.gain.setValueAtTime(0.5, t);
            note2.gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
            note2.osc.start(t);
            note2.osc.stop(t + 0.15);
        }
    }, 50);
  }

  // Step / Tick: Short noise or blip
  public playStep() {
    if (this.isMuted || !this.ctx) return;
    const { osc, gain } = this.createOscillator('triangle', 300) || {};
    if (!osc || !gain) return;

    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    
    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Crash / Game Over: Low frequency slide down + noise
  public playGameOver() {
    if (this.isMuted || !this.ctx) return;
    const { osc, gain } = this.createOscillator('sawtooth', 200) || {};
    if (!osc || !gain) return;

    const now = this.ctx.currentTime;
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
    
    // Wobble effect
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 20;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 500;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(now);
    lfo.stop(now + 0.5);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    
    osc.start(now);
    osc.stop(now + 0.5);
  }

  // Shoot: Fast slide down
  public playShoot() {
    if (this.isMuted || !this.ctx) return;
    const { osc, gain } = this.createOscillator('square', 800) || {};
    if (!osc || !gain) return;

    const now = this.ctx.currentTime;
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    
    osc.start(now);
    osc.stop(now + 0.1);
  }
}

export const audio = new AudioService();
