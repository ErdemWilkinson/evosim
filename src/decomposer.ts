import { Container, Graphics } from "pixi.js";

/**
 * Faz VI (v3) — Ayrıştırıcı bakteriler (TASKS.md): ölen canlıların ceset/iskeletlerini
 * "yiyen", ayrı ve BASİT bir mikroorganizma öğesi. TASKS.md kasıtlı olarak kapsamı
 * hafif tutmayı öneriyor: "hareket edip cesetlere gitmek yerine doğrudan ceset
 * üzerinde/yakınında belirip bir süre sonra cesedi tüketip kaybolabilir — ayrı bir
 * hareket/AI sistemi şart değil". Bu sınıf tam olarak bunu yapıyor: bir cesede
 * bağlanır (kendi konumu cesedin konumuna sabit bir ofsetle yapışık), sabit bir süre
 * sonra hem kendini hem bağlı olduğu cesedi tüketip kaybolur.
 */
export class Decomposer extends Container {
  /** Bir cesedi tüketmek için geçen süre (saniye) — Corpse.LIFETIME'dan belirgin
   *  kısa tutuluyor ki "bakteriler cesedi daha erken temizler" gözle görülsün. */
  public static readonly CONSUME_DURATION = 4;

  public finished = false;
  private elapsed = 0;
  private readonly graphics: Graphics;
  private readonly offsetX: number;
  private readonly offsetY: number;

  constructor(corpseX: number, corpseY: number, corpseRadius: number) {
    super();
    // Cesedin hemen yakınında sabit, küçük bir ofset — TASKS.md "üzerinde/yakınında
    // belirir" ifadesine uygun, ayrı bir hareket sistemi yok.
    const angle = Math.random() * Math.PI * 2;
    const dist = corpseRadius * (0.5 + Math.random() * 0.6);
    this.offsetX = Math.cos(angle) * dist;
    this.offsetY = Math.sin(angle) * dist;
    this.position.set(corpseX + this.offsetX, corpseY + this.offsetY);

    this.graphics = new Graphics();
    this.addChild(this.graphics);
    this.redraw(0);
  }

  public update(dt: number): void {
    if (this.finished) return;
    this.elapsed += dt;
    const t = Math.min(1, this.elapsed / Decomposer.CONSUME_DURATION);
    this.redraw(t);
    if (t >= 1) this.finished = true;
  }

  /** Tüketimin ne kadarının tamamlandığını (0..1) döndürür — `Ecosystem` bunu
   *  bağlı cesedin solma hızını hızlandırmak için kullanabilir. */
  public get progress(): number {
    return Math.min(1, this.elapsed / Decomposer.CONSUME_DURATION);
  }

  private redraw(t: number): void {
    const g = this.graphics;
    g.clear();
    // Hafif nabız/titreşim — karmaşık animasyon değil, sadece "aktif/canlı" hissi.
    const pulse = 0.85 + 0.15 * Math.sin(this.elapsed * 6);
    const radius = 2.2 * pulse;
    const alpha = 0.75 * (1 - t * 0.3);
    // Soluk/nötr yeşilimsi-gri ton — ayrıştırıcı/organik ama v3'ün bilimsel diline
    // uygun, parlak/oyuncu değil.
    g.circle(0, 0, radius).fill({ color: 0x7d9468, alpha });
    g.circle(0, 0, radius).stroke({ width: 0.6, color: 0x4d5a3f, alpha: alpha * 0.8 });
  }
}
