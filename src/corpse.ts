import { Container, Graphics } from "pixi.js";

/**
 * Faz VI (v3) — Ölüm görünürlüğü (TASKS.md): bir canlı açlıktan öldüğünde artık
 * sessizce kaybolmuyor, geride kısa süreli bir "ceset/iskelet" görsel kalıntısı
 * bırakıyor. v3'ün nötr/şematik diline uygun: soluk/gri, hareketsiz bir daire +
 * üzerine çizilmiş basit bir "iskelet" çizgisi (X şeklinde iki çizgi) — karikatür
 * kafatası/kemik değil, sade bir işaret.
 *
 * Ceset bir süre sonra (LIFETIME) kendiliğinden solup kaybolur — VEYA daha erken,
 * bir ayrıştırıcı bakteri (bkz. `decomposer.ts`) onu "tüketirse" hemen kaybolur.
 * Bu iki bitiş yolunu da `Ecosystem` yönetir (`finished` bayrağı + `consumed`).
 */
export class Corpse extends Container {
  /** Ceset hiç bakteri tarafından tüketilmezse bu süre (saniye) sonunda kendiliğinden
   *  solup kaybolur — kalıntılar sonsuza kadar ekranda birikmesin diye. */
  public static readonly LIFETIME = 22;

  public x2: number;
  public y2: number;
  public finished = false;
  /** Bir ayrıştırıcı bakteri tarafından tüketiliyor mu (bkz. Decomposer) — tüketim
   *  sırasında normal zaman-bazlı solma yerine hızlıca kaybolur. */
  public beingConsumed = false;

  private elapsed = 0;
  private readonly graphics: Graphics;
  private readonly radius: number;

  constructor(x: number, y: number, radius: number) {
    super();
    this.x2 = x;
    this.y2 = y;
    this.radius = radius;
    this.position.set(x, y);

    this.graphics = new Graphics();
    this.addChild(this.graphics);
    this.redraw(1);
  }

  public update(dt: number): void {
    if (this.finished) return;
    this.elapsed += dt;

    if (this.beingConsumed) {
      // Bakteri tarafından tüketilirken normalden hızlı solar (görsel olarak "yeniliyor"
      // hissi versin diye) — basit tutuluyor, karmaşık bir animasyon yok.
      const consumeFraction = Math.min(1, this.elapsed / (Corpse.LIFETIME * 0.18));
      this.redraw(1 - consumeFraction);
      if (consumeFraction >= 1) this.finished = true;
      return;
    }

    const t = Math.min(1, this.elapsed / Corpse.LIFETIME);
    this.redraw(1 - t);
    if (t >= 1) this.finished = true;
  }

  private redraw(lifeFraction: number): void {
    const g = this.graphics;
    g.clear();
    const alpha = Math.max(0, lifeFraction) * 0.9;
    if (alpha <= 0.01) return;

    // Canlıların küçük yarıçapında (bkz. Faz IX kullanıcı geri bildirimi — "ceset
    // mantığı işlemiyor" şikayeti aslında bir görünürlük sorunuydu: 1px kontur çok
    // küçük ölçekte pratikte görünmüyordu) belirgin olsun diye kalın kontur + soluk
    // dolgu birlikte kullanılıyor, hâlâ "boş kabuk/iskelet" hissi korunuyor.
    const minRadius = Math.max(this.radius, 5);
    g.circle(0, 0, minRadius).fill({ color: 0x3a3d45, alpha: alpha * 0.35 });
    g.circle(0, 0, minRadius).stroke({ width: 1.5, color: 0xc7ccd6, alpha });

    // Basit iskelet işareti: gövde içinde bir X çizgisi (karikatür kafatası değil).
    const r = minRadius * 0.6;
    g.moveTo(-r, -r).lineTo(r, r).stroke({ width: 1.5, color: 0xc7ccd6, alpha });
    g.moveTo(-r, r).lineTo(r, -r).stroke({ width: 1.5, color: 0xc7ccd6, alpha });
  }
}
