import { Container, Graphics } from "pixi.js";

/**
 * Faz I (v3) — Basit besin/enerji parçacığı. v2'nin `Plant` sınıfının yerini alıyor:
 * mikroorganizmalar suda bu parçacıkları "yiyerek" enerji kazanır (TASKS.md v3 —
 * "basit bir besin/enerji mekaniği yeterli"). Karmaşık bir bitki büyüme/ekosistem
 * zinciri YOK, sadece su bölgelerinde periyodik olarak beliren küçük enerji noktaları.
 */
export class Nutrient extends Container {
  public readonly energyValue = 14;
  public x2: number;
  public y2: number;

  constructor(x: number, y: number) {
    super();
    this.x2 = x;
    this.y2 = y;
    this.position.set(x, y);

    const g = new Graphics();
    g.circle(0, 0, 2.5).fill({ color: 0x6fae6a, alpha: 0.85 });
    this.addChild(g);
  }
}
