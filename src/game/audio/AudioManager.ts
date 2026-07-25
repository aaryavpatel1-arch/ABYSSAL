/**
 * AudioManager — fully synthesized audio via the Web Audio API.
 * No external files: combat SFX, enemy vocalizations, ambience, and UI
 * sounds are all generated procedurally so the game stays self-contained
 * and GitHub-Pages-friendly.
 */
import type { Settings } from '@/game/types';

type NoiseBuffer = AudioBuffer;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: NoiseBuffer;

  private settings: Settings;
  private started = false;
  private ambienceNodes: AudioNode[] = [];
  private musicTimer: number | null = null;

  // Spatial listener position (updated by player)
  private listenerPos = { x: 0, z: 0 };
  private listenerForward = { x: 0, z: -1 };

  constructor(settings: Settings) {
    this.settings = settings;
  }

  /** Must be called from a user gesture (click) to satisfy autoplay rules. */
  resume(): void {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.started = true;
  }

  setSettings(s: Settings): void {
    this.settings = s;
    if (this.master) {
      this.master.gain.value = s.masterVolume;
      this.sfxBus.gain.value = s.sfxVolume;
      this.musicBus.gain.value = s.musicVolume;
    }
  }

  private init(): void {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.master.gain.value = this.settings.masterVolume;
    this.sfxBus.gain.value = this.settings.sfxVolume;
    this.musicBus.gain.value = this.settings.musicVolume;

    // Pre-render a noise buffer for reuse
    const len = this.ctx.sampleRate * 1.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  private ensure(): boolean {
    if (!this.ctx || !this.started) return false;
    return true;
  }

  // ---- Listener / spatial -------------------------------------------------

  updateListener(x: number, z: number, fwdX: number, fwdZ: number): void {
    if (!this.ctx) return;
    this.listenerPos = { x, z };
    this.listenerForward = { x: fwdX, z: fwdZ };
    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = x;
      l.positionY.value = 1.6;
      l.positionZ.value = z;
      if (l.forwardX) {
        l.forwardX.value = fwdX;
        l.forwardY.value = 0;
        l.forwardZ.value = fwdZ;
      }
    } else {
      // Older API
      (l as unknown as { setPosition: (x: number, y: number, z: number) => void }).setPosition(x, 1.6, z);
    }
  }

  private panner(x: number, z: number): PannerNode | null {
    if (!this.ctx) return null;
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 2;
    p.maxDistance = 40;
    p.rolloffFactor = 1.4;
    if (p.positionX) {
      p.positionX.value = x;
      p.positionY.value = 1.3;
      p.positionZ.value = z;
    } else {
      (p as unknown as { setPosition: (x: number, y: number, z: number) => void }).setPosition(x, 1.3, z);
    }
    return p;
  }

  // ---- Primitive helpers --------------------------------------------------

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    dest: AudioNode,
    freqEnd?: number,
  ): void {
    if (!this.ctx || !this.ensure()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(
    dur: number,
    gain: number,
    dest: AudioNode,
    filterType: BiquadFilterType = 'lowpass',
    freq: number = 800,
    q: number = 1,
  ): void {
    if (!this.ctx || !this.ensure()) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ---- Jumpscare / horror SFX --------------------------------------------

  jumpscareStinger(): void {
    if (!this.ensure() || !this.ctx) return;
    const dest = this.sfxBus;
    // Sharp high screech + low boom
    this.tone(1800, 0.35, 'sawtooth', 0.35, dest, 400);
    this.tone(90, 0.5, 'square', 0.3, dest, 38);
    this.noise(0.4, 0.4, dest, 'highpass', 3000, 0.4);
    this.noise(0.5, 0.2, dest, 'lowpass', 120, 0.6);
  }

  whisper(): void {
    if (!this.ensure() || !this.ctx) return;
    const dest = this.sfxBus;
    this.noise(0.6, 0.08, dest, 'bandpass', 1200, 3);
    this.tone(300, 0.5, 'sine', 0.04, dest, 200);
  }

  electricalBuzz(): void {
    if (!this.ensure() || !this.ctx) return;
    const dest = this.sfxBus;
    this.tone(120, 0.8, 'sawtooth', 0.1, dest, 60);
    this.noise(0.6, 0.06, dest, 'bandpass', 200, 2);
  }

  /** Energy blast fired by a ranged Sentry. */
  enemyShootBlast(x: number, z: number): void {
    if (!this.ensure() || !this.ctx) return;
    const p = this.panner(x, z);
    if (!p) return;
    p.connect(this.sfxBus);
    this.tone(800, 0.18, 'square', 0.12, p, 300);
    this.noise(0.12, 0.08, p, 'highpass', 1500, 0.5);
  }

  /** Acid spit glob landing. */
  acidSplash(x: number, z: number): void {
    if (!this.ensure() || !this.ctx) return;
    const p = this.panner(x, z);
    if (!p) return;
    p.connect(this.sfxBus);
    this.noise(0.3, 0.2, p, 'lowpass', 500, 1);
    this.tone(200, 0.25, 'sawtooth', 0.08, p, 80);
  }

  /** Keycard pickup chime. */
  keycardPickup(): void {
    if (!this.ensure() || !this.ctx) return;
    [659, 784, 988].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.2, 'triangle', 0.12, this.sfxBus), i * 80),
    );
  }

  /** Lore / collectible pickup. */
  lorePickup(): void {
    if (!this.ensure() || !this.ctx) return;
    this.tone(440, 0.15, 'sine', 0.1, this.sfxBus, 660);
    setTimeout(() => this.tone(660, 0.2, 'sine', 0.08, this.sfxBus, 880), 100);
  }

  /** Descending elevator hum. */
  elevatorDescend(): void {
    if (!this.ensure() || !this.ctx) return;
    const dest = this.musicBus;
    this.tone(60, 2.0, 'sine', 0.15, dest, 40);
    this.noise(1.5, 0.06, dest, 'lowpass', 100, 0.5);
  }

  /** Boss weapon unlock fanfare. */
  bossWeaponUnlock(): void {
    if (!this.ensure() || !this.ctx) return;
    [330, 392, 523, 659].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.4, 'triangle', 0.14, this.musicBus), i * 120),
    );
  }

  // ---- Combat SFX ---------------------------------------------------------

  /** whoosh of a swung blade. */
  swing(comboIndex = 0): void {
    if (!this.ensure() || !this.ctx) return;
    const dest = this.sfxBus;
    this.noise(0.18, 0.18, dest, 'bandpass', 700 + comboIndex * 120, 1.4);
    this.tone(520 - comboIndex * 40, 0.16, 'triangle', 0.05, dest, 220);
  }

  /** meaty impact when blade hits flesh. */
  hit(): void {
    if (!this.ensure() || !this.ctx) return;
    const dest = this.sfxBus;
    this.noise(0.16, 0.5, dest, 'lowpass', 420, 2);
    this.tone(140, 0.18, 'sine', 0.4, dest, 60);
    this.tone(70, 0.22, 'sine', 0.3, dest, 40);
  }

  /** Sharp clang of a parried blow. */
  parry(): void {
    if (!this.ensure() || !this.ctx) return;
    const dest = this.sfxBus;
    this.tone(2400, 0.12, 'square', 0.12, dest, 1400);
    this.tone(1800, 0.18, 'triangle', 0.18, dest, 900);
    this.noise(0.08, 0.2, dest, 'highpass', 3000, 0.5);
  }

  dodge(): void {
    if (!this.ensure() || !this.ctx) return;
    this.noise(0.26, 0.14, this.sfxBus, 'bandpass', 500, 1.2);
  }

  playerHurt(): void {
    if (!this.ensure() || !this.ctx) return;
    const dest = this.sfxBus;
    this.tone(220, 0.3, 'sawtooth', 0.18, dest, 90);
    this.noise(0.2, 0.18, dest, 'lowpass', 600, 1);
  }

  footstep(running: boolean): void {
    if (!this.ensure() || !this.ctx) return;
    const dest = this.sfxBus;
    this.noise(0.08, running ? 0.12 : 0.07, dest, 'lowpass', 380, 1);
  }

  flashlightClick(): void {
    if (!this.ensure() || !this.ctx) return;
    this.tone(1800, 0.04, 'square', 0.06, this.sfxBus, 1200);
  }

  // ---- Enemy SFX (spatial) ------------------------------------------------

  enemyGrowl(x: number, z: number, kind: 'grunt' | 'stalker' | 'brute' = 'grunt'): void {
    if (!this.ensure() || !this.ctx) return;
    const p = this.panner(x, z);
    if (!p) return;
    p.connect(this.sfxBus);
    const base = kind === 'brute' ? 70 : kind === 'stalker' ? 160 : 110;
    this.tone(base, 0.6, 'sawtooth', 0.18, p, base * 0.5);
    this.noise(0.5, 0.12, p, 'lowpass', 300, 0.7);
  }

  enemyAttack(x: number, z: number): void {
    if (!this.ensure() || !this.ctx) return;
    const p = this.panner(x, z);
    if (!p) return;
    p.connect(this.sfxBus);
    this.noise(0.3, 0.3, p, 'lowpass', 500, 1);
    this.tone(180, 0.25, 'sawtooth', 0.14, p, 90);
  }

  enemyDeath(x: number, z: number): void {
    if (!this.ensure() || !this.ctx) return;
    const p = this.panner(x, z);
    if (!p) return;
    p.connect(this.sfxBus);
    this.tone(240, 0.5, 'sawtooth', 0.22, p, 50);
    this.noise(0.4, 0.25, p, 'lowpass', 400, 1);
  }

  bossRoar(x: number, z: number): void {
    if (!this.ensure() || !this.ctx) return;
    const p = this.panner(x, z);
    if (!p) return;
    p.connect(this.sfxBus);
    this.tone(60, 1.4, 'sawtooth', 0.4, p, 28);
    this.tone(90, 1.2, 'square', 0.18, p, 40);
    this.noise(1.0, 0.3, p, 'lowpass', 220, 0.8);
  }

  // ---- UI / wave ----------------------------------------------------------

  uiClick(): void {
    if (!this.ensure() || !this.ctx) return;
    this.tone(900, 0.06, 'square', 0.07, this.sfxBus, 600);
  }

  uiHover(): void {
    if (!this.ensure() || !this.ctx) return;
    this.tone(1400, 0.03, 'sine', 0.03, this.sfxBus);
  }

  waveStart(): void {
    if (!this.ensure() || !this.ctx) return;
    const dest = this.musicBus;
    this.tone(110, 1.2, 'sawtooth', 0.16, dest, 70);
    this.noise(1.0, 0.12, dest, 'lowpass', 200, 0.7);
  }

  waveCleared(): void {
    if (!this.ensure() || !this.ctx) return;
    [440, 660, 880].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.5, 'triangle', 0.12, this.musicBus), i * 120),
    );
  }

  upgradeSelect(): void {
    if (!this.ensure() || !this.ctx) return;
    [523, 659, 784].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.3, 'triangle', 0.1, this.sfxBus), i * 80),
    );
  }

  gameOver(): void {
    if (!this.ensure() || !this.ctx) return;
    const dest = this.musicBus;
    this.tone(220, 2.0, 'sawtooth', 0.2, dest, 55);
    this.tone(110, 2.4, 'sine', 0.25, dest, 40);
  }

  victory(): void {
    if (!this.ensure() || !this.ctx) return;
    [392, 523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.5, 'triangle', 0.16, this.musicBus), i * 140),
    );
  }

  // ---- Ambience -----------------------------------------------------------

  startAmbience(): void {
    if (!this.ctx || !this.ensure()) return;
    this.stopAmbience();
    const ctx = this.ctx;
    // Low drone
    const drone = ctx.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.value = 42;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.06;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 120;
    drone.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(this.musicBus);
    drone.start();

    // Slow LFO on drone pitch for unease
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 4;
    lfo.connect(lfoGain);
    lfoGain.connect(drone.frequency);
    lfo.start();

    // Wind noise
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuf;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 220;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.025;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.musicBus);
    wind.start();

    // Distant heartbeat via scheduled pulses
    const beat = (): void => {
      if (!this.ctx) return;
      this.tone(48, 0.22, 'sine', 0.09, this.musicBus, 38);
      setTimeout(() => this.ctx && this.tone(46, 0.16, 'sine', 0.07, this.musicBus, 36), 240);
    };
    const tick = (): void => {
      beat();
      this.musicTimer = window.setTimeout(tick, 2200 + Math.random() * 800);
    };
    tick();

    this.ambienceNodes = [drone, lfo, wind];
  }

  stopAmbience(): void {
    this.ambienceNodes.forEach((n) => {
      try {
        (n as OscillatorNode).stop?.();
      } catch {
        /* already stopped */
      }
      n.disconnect();
    });
    this.ambienceNodes = [];
    if (this.musicTimer !== null) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  dispose(): void {
    this.stopAmbience();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
