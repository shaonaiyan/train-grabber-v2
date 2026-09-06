export class V4Audio {
  private static instance: V4Audio;
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  public static getInstance(): V4Audio {
    if (!V4Audio.instance) {
      V4Audio.instance = new V4Audio();
    }
    return V4Audio.instance;
  }

  constructor() {
    this.initContext();
  }

  private initContext(): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        // Unlock on first interaction
        const unlock = () => {
          if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
          }
          window.removeEventListener('click', unlock);
          window.removeEventListener('keydown', unlock);
        };
        window.addEventListener('click', unlock);
        window.addEventListener('keydown', unlock);
      }
    } catch {
      // Audio not supported in headless environments
    }
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    startGain: number = 0.3,
    endFreq?: number
  ): void {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), now + duration);
      }

      gain.gain.setValueAtTime(startGain, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch {}
  }

  private playNoise(duration: number, startGain: number = 0.3, filterFreq: number = 1000): void {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(startGain, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + duration);
    } catch {}
  }

  // Hook Sounds
  public playHookLaunch(): void {
    this.playTone(600, 0.18, 'sawtooth', 0.25, 200);
  }

  public playHookHit(): void {
    this.playTone(320, 0.08, 'triangle', 0.4, 120);
    this.playNoise(0.06, 0.25, 1800);
  }

  public playChainTighten(): void {
    this.playTone(180, 0.14, 'square', 0.2, 380);
  }

  public playHeavyDrag(): void {
    this.playNoise(0.25, 0.2, 450);
  }

  public playInstallClank(): void {
    this.playTone(480, 0.15, 'triangle', 0.35, 150);
    this.playNoise(0.12, 0.3, 2400);
  }

  public playCouplerSlam(): void {
    this.playTone(110, 0.45, 'sawtooth', 0.6, 40);
    this.playNoise(0.4, 0.5, 800);
  }

  // Sheep Sounds
  public playSheepBaa(): void {
    // Two-tone bleat
    this.playTone(380, 0.3, 'sawtooth', 0.25, 320);
    setTimeout(() => this.playTone(340, 0.2, 'sawtooth', 0.2, 280), 120);
  }

  public playSheepPanic(): void {
    this.playTone(520, 0.15, 'sawtooth', 0.3, 440);
    setTimeout(() => this.playTone(480, 0.15, 'sawtooth', 0.3, 410), 100);
  }

  // Fridge Sounds
  public playFridgeThump(): void {
    this.playTone(95, 0.2, 'triangle', 0.4, 45);
  }

  public playFridgeBang(): void {
    this.playTone(180, 0.3, 'square', 0.5, 50);
    this.playNoise(0.28, 0.4, 1600);
  }

  // Gremlin Sounds
  public playGremlinSqueal(): void {
    this.playTone(850, 0.2, 'sawtooth', 0.3, 1400);
  }

  public playGremlinSabotage(): void {
    this.playNoise(0.15, 0.35, 3200); // Sparks
    this.playTone(320, 0.12, 'square', 0.25, 180);
  }

  // Explosive Sounds
  public playExplosiveFuse(): void {
    this.playNoise(0.08, 0.2, 4000);
  }

  public playExplosion(): void {
    this.playTone(70, 0.5, 'sawtooth', 0.7, 20);
    this.playNoise(0.45, 0.65, 900);
  }

  // Drone Sounds
  public playDroneBuzz(): void {
    this.playTone(280, 0.12, 'sawtooth', 0.15, 310);
  }

  public playDroneFire(): void {
    this.playTone(850, 0.07, 'triangle', 0.25, 200);
  }

  public playDroneCrash(): void {
    this.playTone(140, 0.35, 'sawtooth', 0.5, 40);
    this.playNoise(0.3, 0.45, 1200);
  }

  public playDroneHijack(): void {
    this.playTone(440, 0.15, 'sine', 0.3, 880);
    setTimeout(() => this.playTone(880, 0.25, 'sine', 0.35, 1320), 120);
  }

  // Magnet Sounds
  public playMagnetCharge(): void {
    this.playTone(120, 1.1, 'sine', 0.35, 420);
  }

  public playMagnetHum(): void {
    this.playTone(220, 0.3, 'sine', 0.2, 220);
  }

  public playMagnetOvercharge(): void {
    this.playTone(550, 0.4, 'sawtooth', 0.5, 150);
    this.playNoise(0.35, 0.45, 4500);
  }

  // Bandit Sounds
  public playBanditEngine(): void {
    this.playTone(85, 0.3, 'sawtooth', 0.25, 95);
  }

  public playGunTear(): void {
    this.playTone(350, 0.3, 'sawtooth', 0.5, 120);
    this.playNoise(0.25, 0.45, 3000);
  }

  public playTrainStrain(): void {
    this.playTone(60, 0.35, 'sawtooth', 0.3, 40);
    this.playNoise(0.2, 0.25, 350);
  }
}
