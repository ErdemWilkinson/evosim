import { Container, Graphics } from "pixi.js";
import { Genome } from "./genome";

/**
 * Faz VII (v3) — Yumurtalama (TASKS.md): `Genome.laysEggs=true` olan bir ebeveynin
 * yavrusu hemen aktif bir birey olarak doğmak yerine önce bir "Egg" nesnesi olarak
 * bir süre bekler, sonra açılıp aktif bir `Creature`'a dönüşür. Basit bir zamanlayıcı +
 * sade bir görsel (küçük oval/daire) — karmaşık bir kuluçka mekaniği YOK (TASKS.md:
 * "basit bir zamanlayıcı + görsel, karmaşık bir kuluçka mekaniği şart değil").
 *
 * Görsel dil ceset/organ diliyle tutarlı: soluk/nötr ton, ince kontur, karikatür değil
 * (bkz. `corpse.ts`/`decomposer.ts`'in aynı ilkesi).
 */
export class Egg extends Container {
  /** Sabit bekleme süresi (saniye) — TASKS.md aralığı: 8-15s. Her yumurta için
   *  rastgele bir değer, tamamen sabit olmasın diye hafif çeşitlilik katıyor. */
  public static readonly MIN_INCUBATION = 8;
  public static readonly MAX_INCUBATION = 15;

  public x2: number;
  public y2: number;
  public readonly genome: Genome;
  public hatched = false;

  private readonly incubationTime: number;
  private elapsed = 0;
  private readonly graphics: Graphics;
  private readonly radius: number;

  constructor(x: number, y: number, genome: Genome) {
    super();
    this.x2 = x;
    this.y2 = y;
    this.genome = genome;
    this.position.set(x, y);
    this.radius = Math.max(2.5, genome.radius * 0.55);
    this.incubationTime =
      Egg.MIN_INCUBATION + Math.random() * (Egg.MAX_INCUBATION - Egg.MIN_INCUBATION);

    this.graphics = new Graphics();
    this.addChild(this.graphics);
    this.redraw();
  }

  /** Kuluçka süresi ilerler; süre dolunca `hatched=true` olur — `Ecosystem` bunu
   *  görüp yumurtayı gerçek bir `Creature`'a dönüştürür. */
  public update(dt: number): void {
    if (this.hatched) return;
    this.elapsed += dt;
    if (this.elapsed >= this.incubationTime) {
      this.hatched = true;
      return;
    }
    // Açılmaya yaklaştıkça hafif bir nabız — abartısız, sadece "yakında açılacak" ipucu.
    const progress = this.elapsed / this.incubationTime;
    this.redraw(progress);
  }

  private redraw(progress = 0): void {
    const g = this.graphics;
    g.clear();
    const pulse = 1 + Math.sin(this.elapsed * 4) * 0.04 * progress;
    const rx = this.radius * 0.8 * pulse;
    const ry = this.radius * pulse;
    // Sade, soluk oval — ceset/organ görsel diliyle tutarlı (nötr renk, ince kontur).
    g.ellipse(0, 0, rx, ry).fill({ color: 0xe8dfc8, alpha: 0.85 });
    g.ellipse(0, 0, rx, ry).stroke({ width: 1, color: 0x8a7f5e, alpha: 0.7 });
  }
}
