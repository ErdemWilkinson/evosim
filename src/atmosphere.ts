/**
 * Faz X (v3) — Atmosfer/oksijen seviyesi (TASKS.md): "organlar atmosfere göre
 * gelişecek" hissi. Global, tek bir sayı (0..1, 0.5 = nötr/başlangıç) — gerçek bir
 * hava sirkülasyonu modeli GEREKMİYOR (TASKS.md: "global bir sabit olabilir, veya
 * Faz VIII'in iklim olaylarıyla hafifçe dalgalanabilir"). Burada ikinci seçenek
 * uygulanıyor: seviye simülasyon zamanına bağlı YAVAŞ bir sinüs dalgasıyla kendi
 * başına hafifçe dalgalanır (jeolojik/iklimsel zaman ölçeği hissi — dakikalar
 * mertebesinde bir periyot) VE Faz VIII'in iklim olayı (`WorldEventManager.
 * triggerClimate`) aktifken küçük bir ek ofset uygular ("sıcak dalga" = biraz daha
 * düşük oksijen, "soğuk dalga" = biraz daha yüksek — gerçek dünyada sıcak suyun
 * daha az çözünmüş oksijen tutması sezgisiyle tutarlı bir basitleştirme).
 *
 * ÖLÇÜLEBİLİR SEÇİLİM BASKISI (TASKS.md — "kozmetik olmasın"): bu seviye
 * `Creature.breathingMetabolismMultiplier()` üzerinden gill/lung taşıyan
 * bireylerin metabolizma (enerji tüketim) verimliliğini GERÇEKTEN değiştiriyor —
 * düşük oksijende gill'li bireyler suda daha az enerji harcar/lung'lular biraz
 * daha fazla harcar, yüksek oksijende tam tersi. Hiçbir organ olmayan (v3'ün
 * mikroorganizma varsayılanı) bireyler bu mekanizmadan etkilenmez — atmosfer
 * sadece solunum organı kazanmış bireyler arasında bir fark yaratıyor, kozmetik
 * bir "hava durumu" göstergesi değil.
 */

/** Tam bir dalgalanma döngüsünün süresi (saniye) — yavaş, "jeolojik" bir tempo
 *  (birkaç dakika), sürekli göze çarpan hızlı bir titreşim DEĞİL. */
const OXYGEN_CYCLE_SECONDS = 240;
/** Kendiliğinden dalgalanmanın genliği (±bu kadar, 0.5 nötr etrafında). */
const OXYGEN_BASE_AMPLITUDE = 0.12;
/** İklim olayı aktifken uygulanan ek ofset büyüklüğü. */
const OXYGEN_CLIMATE_OFFSET = 0.1;

export class Atmosphere {
  private climateOffset = 0;

  /** `WorldEventManager` bir iklim olayı tetiklediğinde/bitirdiğinde çağırır —
   *  sıcak dalga sırasında negatif (oksijen biraz düşer), soğuk dalga sırasında
   *  pozitif (oksijen biraz yükselir), olay bitince 0'a döner. */
  public setClimateOffset(offset: number): void {
    this.climateOffset = Math.max(-OXYGEN_CLIMATE_OFFSET, Math.min(OXYGEN_CLIMATE_OFFSET, offset));
  }

  /** 0..1 arası oksijen seviyesi (0.5 = nötr/tarihsel ortalama). Doğrudan
   *  simülasyon zamanından türetiliyor (kendi state'i olan bir zamanlayıcıya
   *  gerek yok — deterministik, kaydet/yükle ile de otomatik tutarlı çünkü
   *  `simulationTime` zaten save'de var). */
  public getOxygenLevel(simTimeSeconds: number): number {
    const phase = (simTimeSeconds / OXYGEN_CYCLE_SECONDS) * Math.PI * 2;
    const base = 0.5 + Math.sin(phase) * OXYGEN_BASE_AMPLITUDE;
    return Math.max(0.1, Math.min(0.9, base + this.climateOffset));
  }
}
