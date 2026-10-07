/**
 * Ambiyans müziği: tamamen WebAudio ile üretilir, dosya içermez. Simülasyondan bağımsızdır
 * (simülasyonun rastgelelik kaynağına dokunmaz), bu yüzden simülasyonun belirlenimini bozmaz.
 * Gezegenin tohumu anahtarı ve modu seçer; yavaşça değişen akorlar bir pad üzerinde çalar,
 * aralarda seyrek çan sesleri duyulur. Gece süzgeç kapanır ve ses kısılır.
 */

const KEY = "evosim-sound";
const MODES: readonly (readonly number[])[] = [
  [0, 2, 3, 5, 7, 8, 10],
  [0, 2, 3, 5, 7, 9, 10],
  [0, 2, 4, 7, 9],
];
const CHORD_SECONDS = 14;
const LOOKAHEAD = 1.2;

export type SoundEvent = "birth" | "hunt" | "species" | "extinct";
/** Olay sesleri arasındaki en kısa süre (sn); yüksek hızda orantılı uzar. */
const EVENT_GAP: Record<SoundEvent, number> = { birth: 0.5, hunt: 0.7, species: 1.6, extinct: 3 };
const EVENT_BUDGET = { span: 2, count: 4 };

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const freq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

export class Music {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private bells: GainNode | null = null;
  private fx: GainNode | null = null;
  private fxLast: Record<SoundEvent, number> = { birth: -9, hunt: -9, species: -9, extinct: -9 };
  private fxTimes: number[] = [];
  private fxPick = 0;
  private seed = 1;
  private rnd = mulberry(1);
  private root = 40;
  private mode: readonly number[] = MODES[0];
  private nextChord = 0;
  private nextBell = 0;
  private light = 1;
  private on = true;
  private armed = false;

  constructor() {
    try {
      this.on = localStorage.getItem(KEY) !== "0";
    } catch {
      this.on = true;
    }
  }

  public isOn(): boolean {
    return this.on;
  }

  public setOn(value: boolean): void {
    this.on = value;
    try {
      localStorage.setItem(KEY, value ? "1" : "0");
    } catch {
      // Depolama kapalıysa tercih yalnızca bu oturumda geçerli kalır.
    }
    if (value) this.begin();
    this.applyLevel();
  }

  /** Ses tarayıcı kuralı gereği ilk dokunuşta başlar. */
  public arm(): void {
    if (this.armed) return;
    this.armed = true;
    const go = (): void => {
      document.removeEventListener("pointerdown", go);
      document.removeEventListener("keydown", go);
      if (this.on) this.begin();
    };
    document.addEventListener("pointerdown", go);
    document.addEventListener("keydown", go);
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else if (this.on) void this.ctx.resume();
    });
  }

  public setSeed(seed: number): void {
    if (seed === this.seed && this.ctx) return;
    this.seed = seed;
    this.rnd = mulberry(seed * 2654435761 + 12345);
    this.root = 38 + (seed % 12);
    this.mode = MODES[(seed >>> 4) % MODES.length];
    if (this.ctx) this.nextChord = this.ctx.currentTime + 0.5;
  }

  public setLight(light: number): void {
    this.light = light;
    if (!this.ctx || !this.filter) return;
    this.filter.frequency.setTargetAtTime(450 + light * 1000, this.ctx.currentTime, 3);
    this.applyLevel();
  }

  private applyLevel(): void {
    if (!this.ctx || !this.master) return;
    const level = this.on ? 0.34 * (0.6 + 0.4 * this.light) : 0;
    this.master.gain.setTargetAtTime(level, this.ctx.currentTime, 0.6);
  }

  private begin(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = 0;
      const squash = ctx.createDynamicsCompressor();
      master.connect(squash);
      squash.connect(ctx.destination);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 450 + this.light * 1000;
      filter.Q.value = 0.4;
      filter.connect(master);
      // Çan sesleri: kuru çıkış ve geri beslemeli gecikme.
      const bells = ctx.createGain();
      bells.gain.value = 0.9;
      const delay = ctx.createDelay(2);
      delay.delayTime.value = 0.52;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.38;
      const wet = ctx.createGain();
      wet.gain.value = 0.45;
      bells.connect(master);
      bells.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(master);
      this.ctx = ctx;
      this.master = master;
      this.filter = filter;
      // Olay sesleri aynı ana kanala girer: Ses düğmesi hepsini birden susturur.
      const fx = ctx.createGain();
      fx.gain.value = 0.9;
      fx.connect(master);
      this.fx = fx;
      this.bells = bells;
      this.nextChord = ctx.currentTime + 0.3;
      this.nextBell = ctx.currentTime + 4;
      window.setInterval(() => this.tick(), 250);
    }
    void this.ctx?.resume();
    this.applyLevel();
  }

  /**
   * Olay sesi. Müzikle aynı dizinin notalarını kullanır; seyrek ve kısadır.
   * Hız arttıkça aralıklar uzar, kısa sürede çok olay gelirse fazlası atlanır.
   */
  public event(kind: SoundEvent, count = 1, speed = 1): void {
    const ctx = this.ctx;
    const bus = this.fx;
    if (!ctx || !bus || !this.on || document.hidden || ctx.state !== "running") return;
    const now = ctx.currentTime;
    if (now - this.fxLast[kind] < EVENT_GAP[kind] * Math.max(1, speed / 2)) return;
    this.fxTimes = this.fxTimes.filter((t) => now - t < EVENT_BUDGET.span);
    if (this.fxTimes.length >= EVENT_BUDGET.count) return;
    this.fxLast[kind] = now;
    this.fxTimes.push(now);
    const pick = this.fxPick++;
    const len = this.mode.length;
    const swell = Math.min(1, 0.55 + count * 0.05);
    const tone = (midi: number, at: number, peak: number, decay: number, type: OscillatorType = "sine", glideTo?: number): void => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq(midi), at);
      if (glideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(freq(glideTo), at + decay * 0.8);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(peak, at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      osc.connect(gain);
      gain.connect(bus);
      osc.start(at);
      osc.stop(at + decay + 0.05);
    };
    if (kind === "birth") tone(this.note(len * 3 + (pick % 4) * 2), now, 0.035 * swell, 0.35);
    else if (kind === "hunt") tone(this.note(-len), now, 0.1 * swell, 0.28, "triangle", this.note(-len) - 12);
    else if (kind === "species") {
      tone(this.note(len * 2), now, 0.06, 1.4);
      tone(this.note(len * 2 + 2), now + 0.18, 0.06, 1.6);
      tone(this.note(len * 3), now + 0.36, 0.05, 2);
    } else {
      tone(this.note(len), now, 0.09, 3.2, "triangle", this.note(len) - 5);
      tone(this.note(len - 2), now + 0.3, 0.07, 3.6, "sine");
    }
  }

  private note(step: number): number {
    const len = this.mode.length;
    const oct = Math.floor(step / len);
    return this.root + 12 * oct + this.mode[((step % len) + len) % len];
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!this.on) {
      this.nextChord = ctx.currentTime + 0.5;
      this.nextBell = ctx.currentTime + 3;
      return;
    }
    while (this.nextChord < ctx.currentTime + LOOKAHEAD) {
      this.chord(this.nextChord);
      this.nextChord += CHORD_SECONDS;
    }
    while (this.nextBell < ctx.currentTime + LOOKAHEAD) {
      this.bell(this.nextBell);
      this.nextBell += 1.8 + this.rnd() * 4.8;
    }
  }

  private chord(at: number): void {
    const ctx = this.ctx;
    const filter = this.filter;
    if (!ctx || !filter) return;
    const len = this.mode.length;
    const bases = [0, 2, 3, 4, 5];
    const base = bases[Math.floor(this.rnd() * bases.length)];
    const steps = [base - len, base, base + 2 + len, base + 4 + len, base + 6 + len];
    const length = CHORD_SECONDS + 7;
    steps.forEach((step, i) => {
      const low = i < 2;
      for (const detune of [-6, 7]) {
        const osc = ctx.createOscillator();
        osc.type = low ? "sine" : "triangle";
        osc.frequency.value = freq(this.note(step));
        osc.detune.value = detune + (this.rnd() - 0.5) * 4;
        const gain = ctx.createGain();
        const peak = low ? 0.075 : 0.042;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(peak, at + 5);
        gain.gain.setValueAtTime(peak, at + CHORD_SECONDS - 1);
        gain.gain.linearRampToValueAtTime(0, at + length);
        osc.connect(gain);
        gain.connect(filter);
        osc.start(at);
        osc.stop(at + length + 0.2);
      }
    });
  }

  private bell(at: number): void {
    const ctx = this.ctx;
    const bus = this.bells;
    if (!ctx || !bus) return;
    const len = this.mode.length;
    const step = len * 2 + Math.floor(this.rnd() * len * 1.5);
    const f = freq(this.note(step));
    const level = 0.05 + this.rnd() * 0.04;
    for (const [mul, vol, decay] of [
      [1, 1, 3.6],
      [2.01, 0.3, 1.8],
      [3.98, 0.1, 0.9],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f * mul;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(level * vol, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      osc.connect(gain);
      gain.connect(bus);
      osc.start(at);
      osc.stop(at + decay + 0.1);
    }
  }
}
