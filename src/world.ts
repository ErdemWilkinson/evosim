import { Chemistry, generateChemistry } from "./chemistry";
import { makeRng } from "./rng";

/**
 * Düz harita (1600×1000). Bir kez, tohumdan deterministik üretilir: rastgele yönlü
 * sinüs dalgalarının toplamı bir yükseklik alanı verir; su seviyesi, tohumdan seçilen
 * hedef su oranının yüzdelik dilimine oturtulur (her tohum oynanabilir bir harita
 * verir). Kıyıya uzaklık alanı (chamfer dönüşümü) sığ/derin su ve kumsal bantlarını
 * belirler ve haritanın eş-derinlik çizgileriyle çizilmesini sağlar. İkinci bir
 * gürültü alanının sıfır çizgileri karayı bölen sıradağları oluşturur: kanatsız
 * canlılar için geçilmezdirler, yani kara popülasyonlarını coğrafi olarak yalıtırlar.
 */

export const MAP_W = 1600;
export const MAP_H = 1000;
export const GRID_COLS = 320;
export const GRID_ROWS = 200;
const CELL = MAP_W / GRID_COLS; // 5 px

/** Kıyıdan bu kadar hücre içeride su "derin" sayılır (70 px). */
const SHALLOW_CELLS = 14;
const BEACH_CELLS = 2.2;
const MOUNTAIN_MIN_COAST_CELLS = 5;

export const enum Band {
  DeepWater = 0,
  ShallowWater = 1,
  Beach = 2,
  Plain = 3,
  Mountain = 4,
}

export const BAND_LABEL = ["Derin sıvı", "Sığ sıvı", "Kıyı", "Ova", "Dağ"] as const;

interface Quake {
  gx: number;
  gy: number;
  gr: number;
  toWater: boolean;
}

export class World {
  public readonly seed: number;
  /** Gezegenin kimyası: arazinin engebesini, sıvı oranını ve dağ payını belirler. */
  public readonly chem: Chemistry;
  /** Sıradağ gürültüsünün |değeri| bunun altındaysa orası sırttır. */
  public readonly ridgeWidth: number;
  /** Ham yükseklik alanı; `seaLevel` altı sudur. */
  public readonly height: Float32Array;
  /** Karşı arazi türüne (su için karaya, kara için suya) hücre cinsinden uzaklık. */
  public readonly coast: Float32Array;
  /** Sık örtü alanı: değeri `thicketLevel` üstünde olan yer sığınaktır (sazlık, yosun ormanı, çalılık). */
  public readonly thicket: Float32Array;
  public readonly thicketLevel: number;
  /** Sıradağ alanı: 0 sırtın tam üstü, büyüdükçe uzak. */
  public readonly ridge: Float32Array;
  public readonly seaLevel: number;
  public readonly mountainLevel: number;
  public readonly waterFraction: number;
  public readonly bandFractions: number[];
  /** Deprem bölgeleri değiştiğinde artar; çizici arazi dokusunu yeniden boyar. */
  public version = 0;
  public readonly quakes: Quake[] = [];

  constructor(seed: number) {
    this.seed = seed >>> 0;
    const r = makeRng(this.seed);
    const n = GRID_COLS * GRID_ROWS;
    this.chem = generateChemistry(this.seed);
    const terrain = this.chem.terrain;
    this.ridgeWidth = terrain.ridge;
    const rough = Math.min(1.6, Math.max(0.75, terrain.roughness));

    const waves: { cos: number; sin: number; freq: number; phase: number; amp: number }[] = [];
    for (let i = 0; i < 9; i++) {
      const octave = i % 3;
      const angle = r.next() * Math.PI * 2;
      waves.push({
        cos: Math.cos(angle),
        sin: Math.sin(angle),
        freq: ((octave === 0 ? 1.2 : octave === 1 ? 2.6 : 4.5) + r.next() * 0.8) * Math.PI * 2 * rough,
        phase: r.next() * Math.PI * 2,
        amp: octave === 0 ? 1 : octave === 1 ? 0.55 : 0.3,
      });
    }
    const ridgeWaves = waves.slice(0, 5).map((w) => {
      const angle = r.next() * Math.PI * 2;
      return { cos: Math.cos(angle), sin: Math.sin(angle), freq: w.freq * 0.9, phase: r.next() * Math.PI * 2, amp: w.amp };
    });
    this.ridge = new Float32Array(n);
    this.height = new Float32Array(n);
    for (let gy = 0; gy < GRID_ROWS; gy++) {
      const ny = gy / (GRID_ROWS - 1);
      for (let gx = 0; gx < GRID_COLS; gx++) {
        // En-boy oranı korunur (nx 0..1.6): dalgalar yatayda esnemez.
        const nx = (gx / (GRID_COLS - 1)) * (MAP_W / MAP_H);
        let sum = 0;
        for (const w of waves) sum += Math.sin((nx * w.cos + ny * w.sin) * w.freq + w.phase) * w.amp;
        this.height[gy * GRID_COLS + gx] = sum;
        let ridge = 0;
        for (const w of ridgeWaves) ridge += Math.sin((nx * w.cos + ny * w.sin) * w.freq + w.phase) * w.amp;
        this.ridge[gy * GRID_COLS + gx] = Math.abs(ridge);
      }
    }

    // Sık örtü: haritanın yaklaşık beşte biri. Ayrı bir üreteçten gelir; yükseklik alanını etkilemez.
    const tr = makeRng(this.seed ^ 0x7f4a7c15);
    const thicketWaves = Array.from({ length: 6 }, (_, i) => {
      const angle = tr.next() * Math.PI * 2;
      return { cos: Math.cos(angle), sin: Math.sin(angle), freq: (2.4 + tr.next() * 3.6) * Math.PI * 2, phase: tr.next() * Math.PI * 2, amp: 1 / (1 + i * 0.35) };
    });
    this.thicket = new Float32Array(n);
    for (let gy = 0; gy < GRID_ROWS; gy++) {
      const ny = gy / (GRID_ROWS - 1);
      for (let gx = 0; gx < GRID_COLS; gx++) {
        const nx = (gx / (GRID_COLS - 1)) * (MAP_W / MAP_H);
        let sum = 0;
        for (const w of thicketWaves) sum += Math.sin((nx * w.cos + ny * w.sin) * w.freq + w.phase) * w.amp;
        this.thicket[gy * GRID_COLS + gx] = sum;
      }
    }
    this.thicketLevel = Float32Array.from(this.thicket).sort()[Math.floor(0.8 * (n - 1))];

    const sorted = Float32Array.from(this.height).sort();
    const targetWater = terrain.liquid[0] + r.next() * (terrain.liquid[1] - terrain.liquid[0]);
    this.seaLevel = sorted[Math.floor(targetWater * (n - 1))];
    this.mountainLevel = sorted[Math.floor(terrain.mountain * (n - 1))];

    this.coast = new Float32Array(n);
    this.computeCoastDistance();

    const counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) counts[this.bandOfCell(i)]++;
    this.bandFractions = counts.map((c) => c / n);
    this.waterFraction = this.bandFractions[0] + this.bandFractions[1];
  }

  /** İki geçişli 1–√2 chamfer uzaklık dönüşümü, su ve kara için ayrı ayrı. */
  private computeCoastDistance(): void {
    const n = GRID_COLS * GRID_ROWS;
    const INF = 1e6;
    const D = Math.SQRT2;
    const run = (zeroIsWater: boolean): Float32Array => {
      const d = new Float32Array(n);
      for (let i = 0; i < n; i++) d[i] = this.height[i] < this.seaLevel === zeroIsWater ? 0 : INF;
      for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
          const i = y * GRID_COLS + x;
          let v = d[i];
          if (x > 0) v = Math.min(v, d[i - 1] + 1);
          if (y > 0) {
            v = Math.min(v, d[i - GRID_COLS] + 1);
            if (x > 0) v = Math.min(v, d[i - GRID_COLS - 1] + D);
            if (x < GRID_COLS - 1) v = Math.min(v, d[i - GRID_COLS + 1] + D);
          }
          d[i] = v;
        }
      }
      for (let y = GRID_ROWS - 1; y >= 0; y--) {
        for (let x = GRID_COLS - 1; x >= 0; x--) {
          const i = y * GRID_COLS + x;
          let v = d[i];
          if (x < GRID_COLS - 1) v = Math.min(v, d[i + 1] + 1);
          if (y < GRID_ROWS - 1) {
            v = Math.min(v, d[i + GRID_COLS] + 1);
            if (x < GRID_COLS - 1) v = Math.min(v, d[i + GRID_COLS + 1] + D);
            if (x > 0) v = Math.min(v, d[i + GRID_COLS - 1] + D);
          }
          d[i] = v;
        }
      }
      return d;
    };
    const toLand = run(false);
    const toWater = run(true);
    for (let i = 0; i < n; i++) this.coast[i] = Math.min(400, this.height[i] < this.seaLevel ? toLand[i] : toWater[i]);
  }

  private bandOfCell(i: number): Band {
    const h = this.height[i];
    const c = this.coast[i];
    if (h < this.seaLevel) return c > SHALLOW_CELLS ? Band.DeepWater : Band.ShallowWater;
    if (c <= BEACH_CELLS) return Band.Beach;
    if (h > this.mountainLevel && c > MOUNTAIN_MIN_COAST_CELLS) return Band.Mountain;
    if (this.ridge[i] < this.ridgeWidth && c > BEACH_CELLS + 1) return Band.Mountain;
    return Band.Plain;
  }

  private cellIndex(x: number, y: number): number {
    const gx = x <= 0 ? 0 : x >= MAP_W ? GRID_COLS - 1 : (x / CELL) | 0;
    const gy = y <= 0 ? 0 : y >= MAP_H ? GRID_ROWS - 1 : (y / CELL) | 0;
    return gy * GRID_COLS + gx;
  }

  /** Deprem bölgesi bu noktayı kapsıyorsa `true`=su, `false`=kara; yoksa `null`. */
  public quakeAt(x: number, y: number): boolean | null {
    if (this.quakes.length === 0) return null;
    const gx = x / CELL;
    const gy = y / CELL;
    for (const q of this.quakes) {
      const dx = gx - q.gx;
      const dy = gy - q.gy;
      if (dx * dx + dy * dy <= q.gr * q.gr) return q.toWater;
    }
    return null;
  }

  public isWater(x: number, y: number): boolean {
    const q = this.quakeAt(x, y);
    if (q !== null) return q;
    return this.height[this.cellIndex(x, y)] < this.seaLevel;
  }

  public band(x: number, y: number): Band {
    const q = this.quakeAt(x, y);
    if (q !== null) return q ? Band.ShallowWater : Band.Plain;
    return this.bandOfCell(this.cellIndex(x, y));
  }

  /** Sık örtünün içinde mi? Dağda örtü yoktur. */
  public inThicket(x: number, y: number): boolean {
    const i = this.cellIndex(x, y);
    return this.thicket[i] > this.thicketLevel && this.bandOfCell(i) !== Band.Mountain;
  }

  public isDeep(x: number, y: number): boolean {
    return this.band(x, y) === Band.DeepWater;
  }

  public applyQuake(x: number, y: number, radiusPx: number, toWater: boolean): void {
    this.quakes.push({ gx: x / CELL, gy: y / CELL, gr: Math.max(1, radiusPx / CELL), toWater });
    this.version++;
  }

  public clearQuakes(): void {
    if (this.quakes.length === 0) return;
    this.quakes.length = 0;
    this.version++;
  }

  /** Çizim için çift doğrusal örnekleme (hücre merkezleri arasında yumuşak geçiş). */
  public sample(field: Float32Array, x: number, y: number): number {
    const fx = Math.min(GRID_COLS - 1.001, Math.max(0, x / CELL - 0.5));
    const fy = Math.min(GRID_ROWS - 1.001, Math.max(0, y / CELL - 0.5));
    const x0 = fx | 0;
    const y0 = fy | 0;
    const tx = fx - x0;
    const ty = fy - y0;
    const i = y0 * GRID_COLS + x0;
    const a = field[i] + (field[i + 1] - field[i]) * tx;
    const b = field[i + GRID_COLS] + (field[i + GRID_COLS + 1] - field[i + GRID_COLS]) * tx;
    return a + (b - a) * ty;
  }
}
