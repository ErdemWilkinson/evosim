import { Container, Graphics } from "pixi.js";

/**
 * Faz V (v3) — Üreme/büyüme görselliği (TASKS.md): bölünme anında ebeveyn-yavru
 * arasında kısa, hafif bir görsel işaret. Abartısız/karikatür değil — ince bir çizgi
 * (ebeveyni-yavruyu birbirine bağlayan) + ebeveyn etrafında hafifçe genişleyip
 * solan ince bir halka, ~0.5 saniyede tamamen kaybolur. `Container`'ın kendi
 * `update(dt)` metodunu her karede `Ecosystem` çağırır; süre dolunca kendini sahneden
 * kaldırır (self-cleanup, `Ecosystem`'in ayrıca takip etmesine gerek kalmadan tek
 * seferlik bir "iş bitince kendini yok et" deseni).
 */
export class DivisionEffect extends Container {
  private static readonly DURATION = 0.5;
  private elapsed = 0;
  private readonly graphics: Graphics;
  private readonly parentX: number;
  private readonly parentY: number;
  private readonly childX: number;
  private readonly childY: number;
  private readonly ringRadius: number;
  public finished = false;

  constructor(parentX: number, parentY: number, childX: number, childY: number, bodyRadius: number) {
    super();
    this.parentX = parentX;
    this.parentY = parentY;
    this.childX = childX;
    this.childY = childY;
    this.ringRadius = bodyRadius;
    this.graphics = new Graphics();
    this.addChild(this.graphics);
    this.redraw(0);
  }

  public update(dt: number): void {
    this.elapsed += dt;
    if (this.elapsed >= DivisionEffect.DURATION) {
      this.finished = true;
      this.graphics.clear();
      return;
    }
    this.redraw(this.elapsed / DivisionEffect.DURATION);
  }

  private redraw(t: number): void {
    const alpha = 1 - t; // düz/doğrusal solma — sıçramalı değil
    this.graphics.clear();

    // İnce bağlantı çizgisi (ebeveyn -> yavru).
    this.graphics
      .moveTo(this.parentX, this.parentY)
      .lineTo(this.childX, this.childY)
      .stroke({ width: 1, color: 0xdfe8f5, alpha: alpha * 0.5 });

    // Ebeveyn etrafında hafifçe genişleyen ince bir halka.
    const r = this.ringRadius * (1 + t * 1.8);
    this.graphics
      .circle(this.parentX, this.parentY, r)
      .stroke({ width: 1, color: 0xdfe8f5, alpha: alpha * 0.6 });
  }
}
