import { Container, Sprite, Texture, Graphics } from "pixi.js";

/**
 * Faz I (v3) — Düz harita. Dairesel gezegen (`planet.ts`, kaldırıldı) yerine sabit
 * boyutlu, dikdörtgen bir dünya: su ve kara bölgeleri, BAŞLANGIÇTA bir kez üretilir
 * ve simülasyon boyunca sabit kalır (TASKS.md v3 — "Dünya Modeli" bölümü).
 *
 * Noise fonksiyonu kasıtlı olarak basit tutuldu: ekstra bir kütüphane (simplex-noise
 * vb.) GEREKMİYOR — birkaç sin/cos dalgasının (farklı frekans/faz/genlikte, "value
 * noise" mantığıyla) toplamı + bir eşikleme (su/kara ayrımı) yeterli. Deterministik bir
 * PRNG (`mulberry32`, bkz. `rng.ts`) ile dalga parametreleri sabitleniyor ki harita her
 * sayfa yüklemesinde (aynı `MAP_SEED` ile) hep aynı çıksın.
 */

export const MAP_WIDTH = 1600;
export const MAP_HEIGHT = 1000;

/**
 * Faz VIII (v3) — Rastgele harita (TASKS.md). Önceden `MAP_SEED` sabitti (her
 * sayfa yüklemesinde AYNI kıta/okyanus deseni) — kullanıcı isteği: "her yeni
 * simülasyon başlangıcında farklı bir su/kara deseni üretilsin". `World` artık
 * seed'i DIŞARIDAN alıyor (opsiyonel parametre): `main.ts` yeni bir simülasyon
 * başlatırken rastgele bir seed üretip geçiyor, bir kayıt yüklenirken ise o
 * kayıtta saklanan seed'i geri geçiyor (bkz. `savegame.ts` `mapSeed` alanı) —
 * aksi halde kaydedilen canlı konumları yeni haritada anlamsız olurdu (karada
 * kaydedilen bir birey yeni haritada su altında kalabilirdi). Harita YİNE
 * deterministik: aynı seed her zaman aynı deseni üretir (kayıt/yükle arasında
 * tutarlılık için gerekli), sadece seed artık sabit değil.
 */
export function generateMapSeed(): number {
  // Date.now() + Math.random() karışımı — her sayfa yüklemesinde farklı, ama
  // basit/bağımlılıksız (ekstra bir kütüphane gerekmiyor, TASKS.md ilkesiyle
  // tutarlı). 32-bit tam sayıya sıkıştırılıyor (mulberry32 seed'i böyle bekliyor).
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

export type TerrainKind = "water" | "land";

/** Faz XVII Madde 3 — görsel/kategorik arazi çeşidi (bkz. `World.getElevationBand`).
 *  `TerrainKind`'ın (su/kara, tüm hareket/spawn mantığının dayandığı ikili ayrım)
 *  YERİNE değil, ÜSTÜNE bir katman — "deep_water"/"shallow_water" hâlâ `water`,
 *  "beach"/"plain"/"mountain" hâlâ `land` sayılır. */
export type ElevationBand = "deep_water" | "shallow_water" | "beach" | "plain" | "mountain";

/** `elevationGrid`'te kompakt (Uint8Array) saklamak için sayısal kodlama. */
const ELEVATION_BAND_LIST: ElevationBand[] = ["deep_water", "shallow_water", "beach", "plain", "mountain"];
const ELEVATION_BAND_CODE: Record<ElevationBand, number> = {
  deep_water: 0,
  shallow_water: 1,
  beach: 2,
  plain: 3,
  mountain: 4,
};

/** Faz XVII Madde 3 — nötr/bilimsel renk dili (v3'ün "tatlı değil" ilkesiyle
 *  tutarlı, mevcut su/kara paletinin (koyu lacivert/yeşil-gri) doğal bir
 *  genişlemesi): derin su en koyu lacivert, sığ su biraz daha açık/camsı; kumsal
 *  soluk kum tonu; ova mevcut yeşil-gri; dağ daha açık/gri-kahve (kayalık hissi). */
const ELEVATION_COLORS: Record<ElevationBand, { r: number; g: number; b: number }> = {
  deep_water: { r: 0x0f, g: 0x22, b: 0x33 },
  shallow_water: { r: 0x1c, g: 0x3c, b: 0x54 },
  beach: { r: 0x8a, g: 0x82, b: 0x5f },
  plain: { r: 0x3a, g: 0x42, b: 0x33 },
  mountain: { r: 0x5c, g: 0x58, b: 0x50 },
};

interface Wave {
  /** Dalganın yayılma yönü (radyan) — nx/ny üzerine izdüşümü alınıp bu yönde bir sinüs
   *  değerlendirilir. Aynı freqX/freqY ORANINI kullanan dalgaların hepsi aynı köşegen
   *  yönünde bantlar üretip gözle görülür bir "çizgili kumaş" deseni yarattığı için
   *  (ilk denemede TÜM dalgalar 45°'ye yakın yönlerde toplanmıştı) her dalga BAĞIMSIZ,
   *  tam 0..2π aralığında rastgele bir yöne sahip.
   */
  angle: number;
  freq: number;
  phase: number;
  amplitude: number;
}

/** Birkaç sin dalgasının ağırlıklı toplamı ile basit bir "value noise" alanı üretir.
 *  Kütüphane gerekmiyor — sadece deterministik rastgele yön/frekans/faz/genlik.
 *  Her dalga rastgele bir YÖNDE (açı) ilerleyen düzlemsel bir sinüs dalgasıdır — bu,
 *  sabit eksen-hizalı (freqX,freqY) dalgalardan farklı olarak belirgin bir köşegen
 *  "çizgili kumaş" deseni değil, çok yönlü girişimden doğan organik ada/kıta şekilleri
 *  üretir (klasik "Perlin'siz value noise" tekniklerinden biri).
 */
function buildWaves(seed: number, count: number): Wave[] {
  // mulberry32 burada import edilmiyor (world.ts rng.ts'e bağımlı olmasın diye basit
  // bir yerel LCG yeterli) — ama tutarlılık için rng.ts'teki ile aynı tarz.
  let t = seed;
  const rand = () => {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  rand(); // ısınma çağrısı (bkz. rng.ts'teki aynı notun gerekçesi)

  const waves: Wave[] = [];
  for (let i = 0; i < count; i++) {
    // Frekanslar birkaç "oktav" halinde dağıtılıyor (kaba kıta şekli + orta ölçekli
    // körfez/yarımada girintileri + ince kıyı pürüzlülüğü) — hepsi aynı ortalama
    // frekansta olsaydı sonuç ya çok pürüzsüz/yuvarlak ya da çok "gürültülü" kalırdı.
    const octave = i % 3; // 0: kaba, 1: orta, 2: ince
    const baseFreq = octave === 0 ? 1.2 : octave === 1 ? 2.6 : 4.5;
    waves.push({
      angle: rand() * Math.PI * 2,
      freq: baseFreq + rand() * 0.8,
      phase: rand() * Math.PI * 2,
      amplitude: octave === 0 ? 1 : octave === 1 ? 0.55 : 0.3,
    });
  }
  return waves;
}

/** (nx, ny) — [0,1] aralığında normalize koordinat — için ham (normalize edilmemiş)
 *  noise değeri döndürür. */
function sampleRawNoise(waves: Wave[], nx: number, ny: number): number {
  let sum = 0;
  for (const w of waves) {
    const projected = nx * Math.cos(w.angle) + ny * Math.sin(w.angle);
    sum += Math.sin(projected * w.freq * Math.PI * 2 + w.phase) * w.amplitude;
  }
  return sum;
}

/**
 * Dünyanın su/kara haritasını temsil eder. Genişlik/yükseklik sabit; `terrainAt`
 * herhangi bir dünya koordinatı için "water" veya "land" döndürür (canlıların
 * spawn/hareket mantığı bunu kullanır). Harita bir kez üretilip bir Pixi dokusuna
 * bake edilir — render döngüsünde ekstra maliyeti yoktur (statik bir Sprite).
 */
export class World extends Container {
  public readonly width_: number = MAP_WIDTH;
  public readonly height_: number = MAP_HEIGHT;

  /** Su eşiği: noise değeri bunun altındaysa su, üstündeyse kara. Değer, yaklaşık
   *  %55 su / %45 kara oranı hedeflenerek deneysel olarak seçildi (aşağıdaki
   *  `computeWaterFraction` ile doğrulanabilir). */
  private readonly waterThreshold = -0.05;
  private readonly waves: Wave[];
  /** Hızlı sorgu için düşük çözünürlüklü bir örnekleme ızgarası (her piksel için sin
   *  toplamı hesaplamak yerine, bake sırasında zaten üretilen değerleri yeniden
   *  kullanıyoruz). */
  private readonly grid: Float32Array;
  private readonly gridCols: number;
  private readonly gridRows: number;
  /** Faz XVII Madde 3 — arazi çeşidi ÖNBELLEĞİ (bkz. `getElevationBand`). `grid` ile
   *  AYNI 320×200 çözünürlükte, bir kez (constructor'da) hesaplanır — `isDeepWater`
   *  mesafe araması (halka taraması) tam 1.6M piksel için değil, sadece 64.000 hücre
   *  için bir kez çalışsın diye (`buildTexture` her pikseli boyarken bunu tekrar
   *  hesaplamak yerine burada okuyor — performans, `grid`'in kendisiyle aynı ilke). */
  private readonly elevationGrid: Uint8Array;

  public waterFraction = 0;
  /** Faz VIII — bu haritayı üreten seed (kaydet/yükle ile geri yüklenebilmesi için
   *  dışarı açık). */
  public readonly seed: number;

  /** Faz VIII — Deprem olayı (`worldevents.ts`): kara/su sınırında KÜÇÜK, LOKAL,
   *  GEÇİCİ bir değişiklik. Büyük bir jeolojik yeniden-üretim yerine, ızgara
   *  üzerinde küçük bir daire içindeki hücrelerin eşik değerine (`waterThreshold`)
   *  bir ofset ekleyip (su<->kara geçici geçişi) bir süre sonra geri alıyoruz —
   *  temel `grid`/`waves` HİÇ değişmiyor, sadece bu geçici katman sorgulanıyor.
   *  Aynı anda birden fazla aktif deprem "bölgesi" olabilir (nadiren üst üste
   *  binebilir), basit bir liste yeterli. */
  private readonly quakeOverrides: { gx: number; gy: number; gr: number; toWater: boolean }[] = [];
  private texture: Texture | null = null;
  private sprite: Sprite | null = null;

  constructor(seed: number = generateMapSeed()) {
    super();
    this.seed = seed;
    this.waves = buildWaves(seed, 9);

    // Sorgu ızgarası: gerçek piksel çözünürlüğünden daha kaba (performans), ama
    // canlı hareketi için yeterince ince (bkz. terrainAt bilinear olmayan en-yakın
    // örnekleme — Faz I'de bu kabul edilebilir, kıyı çizgisi net olmasa da "su/kara"
    // ayrımı doğru çalışıyor).
    this.gridCols = 320;
    this.gridRows = 200;
    this.grid = new Float32Array(this.gridCols * this.gridRows);

    let waterCount = 0;
    for (let gy = 0; gy < this.gridRows; gy++) {
      for (let gx = 0; gx < this.gridCols; gx++) {
        const nx = gx / (this.gridCols - 1);
        const ny = gy / (this.gridRows - 1);
        const value = sampleRawNoise(this.waves, nx, ny);
        this.grid[gy * this.gridCols + gx] = value;
        if (value < this.waterThreshold) waterCount++;
      }
    }
    this.waterFraction = waterCount / (this.gridCols * this.gridRows);

    // Faz XVII Madde 3 — elevation önbelleğini `grid` DOLDUKTAN sonra (isWater/
    // isDeepWater `grid`'e bağımlı) ama doku BOYANMADAN önce bir kez hesapla.
    this.elevationGrid = new Uint8Array(this.gridCols * this.gridRows);
    for (let gy = 0; gy < this.gridRows; gy++) {
      for (let gx = 0; gx < this.gridCols; gx++) {
        const worldX = ((gx + 0.5) / this.gridCols) * MAP_WIDTH;
        const worldY = ((gy + 0.5) / this.gridRows) * MAP_HEIGHT;
        this.elevationGrid[gy * this.gridCols + gx] = ELEVATION_BAND_CODE[this.computeElevationBand(worldX, worldY)];
      }
    }

    this.texture = this.buildTexture();
    this.sprite = new Sprite(this.texture);
    this.addChild(this.sprite);

    // İnce bir dış çerçeve — haritanın sınırını netleştirir (dekoratif değil, salt
    // okunabilirlik).
    const border = new Graphics();
    border.rect(0, 0, MAP_WIDTH, MAP_HEIGHT).stroke({ width: 2, color: 0x2a2f3a, alpha: 0.8 });
    this.addChild(border);
  }

  /** Faz VIII — Deprem: `worldevents.ts` bu metodu çağırıp ızgara üzerinde küçük,
   *  dairesel bir bölgede geçici bir su<->kara "override" ekler ve dokuyu (o bölge
   *  kadar küçük bir alanda) yeniden boyayıp gösterir. `durationSeconds` sonra
   *  `worldevents.ts` `clearQuakeOverride` çağırarak geri alır. */
  public applyQuakeOverride(worldX: number, worldY: number, radiusPx: number, toWater: boolean): void {
    const nx = clamp01(worldX / MAP_WIDTH);
    const ny = clamp01(worldY / MAP_HEIGHT);
    const gx = Math.min(this.gridCols - 1, Math.floor(nx * this.gridCols));
    const gy = Math.min(this.gridRows - 1, Math.floor(ny * this.gridRows));
    const gr = Math.max(1, Math.round((radiusPx / MAP_WIDTH) * this.gridCols));
    this.quakeOverrides.push({ gx, gy, gr, toWater });
    this.repaintRegion(gx, gy, gr);
  }

  public clearQuakeOverrides(): void {
    if (this.quakeOverrides.length === 0) return;
    const regions = this.quakeOverrides.splice(0, this.quakeOverrides.length);
    for (const r of regions) this.repaintRegion(r.gx, r.gy, r.gr);
  }

  private isInQuakeOverride(gx: number, gy: number): boolean | null {
    for (const r of this.quakeOverrides) {
      const dx = gx - r.gx;
      const dy = gy - r.gy;
      if (dx * dx + dy * dy <= r.gr * r.gr) return r.toWater;
    }
    return null;
  }

  /** Etkilenen ızgara bölgesinin karşılık geldiği doku alanını yeniden boyar —
   *  TÜM haritayı değil, sadece küçük bir dikdörtgeni (performans + "büyük jeolojik
   *  değişim değil, küçük/lokal" ilkesiyle tutarlı). */
  private repaintRegion(gx: number, gy: number, gr: number): void {
    if (!this.texture || !this.sprite) return;
    const source = this.texture.source as unknown as { resource?: HTMLCanvasElement };
    const canvas = source.resource;
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pad = 2;
    const pxPerGx = MAP_WIDTH / this.gridCols;
    const pxPerGy = MAP_HEIGHT / this.gridRows;
    const px0 = Math.max(0, Math.floor((gx - gr - pad) * pxPerGx));
    const py0 = Math.max(0, Math.floor((gy - gr - pad) * pxPerGy));
    const px1 = Math.min(MAP_WIDTH, Math.ceil((gx + gr + pad) * pxPerGx));
    const py1 = Math.min(MAP_HEIGHT, Math.ceil((gy + gr + pad) * pxPerGy));
    const w = px1 - px0;
    const h = py1 - py0;
    if (w <= 0 || h <= 0) return;

    const image = ctx.createImageData(w, h);
    const data = image.data;

    for (let py = 0; py < h; py++) {
      const worldY = py0 + py;
      for (let px = 0; px < w; px++) {
        const worldX = px0 + px;
        const c = this.colorForRepaint(worldX, worldY);
        const idx = (py * w + px) * 4;
        data[idx] = c.r;
        data[idx + 1] = c.g;
        data[idx + 2] = c.b;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(image, px0, py0);
    this.texture.source.update();
  }

  /** Faz XVII Madde 3 — `repaintRegion` SADECE deprem override'larıyla çağrılıyor
   *  (bkz. `applyQuakeOverride`/`clearQuakeOverrides`), bu yüzden `getElevationBand`
   *  (override'ları KASITLI yok sayan önbellek okuması) burada YETERSİZ — aktif bir
   *  override varken görsel, `terrainAt`'ın (override-farkında) su/kara durumunu
   *  YANSITMALI, aksi halde deprem "görünmez" olurdu. Override'lı hücrelerde basit/
   *  nötr bir renk (sığ su veya ova) yeterli — geçici bir jeolojik olay için gerçek
   *  bir "yükseklik" anlamı yok. Override'sız hücrelerde normal önbellek kullanılır. */
  private colorForRepaint(x: number, y: number): { r: number; g: number; b: number } {
    const nx = clamp01(x / MAP_WIDTH);
    const ny = clamp01(y / MAP_HEIGHT);
    const gx = Math.min(this.gridCols - 1, Math.floor(nx * this.gridCols));
    const gy = Math.min(this.gridRows - 1, Math.floor(ny * this.gridRows));
    if (this.quakeOverrides.length > 0) {
      const override = this.isInQuakeOverride(gx, gy);
      if (override !== null) return override ? ELEVATION_COLORS.shallow_water : ELEVATION_COLORS.plain;
    }
    return ELEVATION_COLORS[this.getElevationBand(x, y)];
  }

  /** Verilen dünya koordinatındaki arazi türünü döndürür (en-yakın ızgara örneklemesi).
   *  Faz VIII — bir deprem override'ı bu hücreyi kapsıyorsa onun değeri geçerlidir. */
  public terrainAt(x: number, y: number): TerrainKind {
    const nx = clamp01(x / MAP_WIDTH);
    const ny = clamp01(y / MAP_HEIGHT);
    const gx = Math.min(this.gridCols - 1, Math.floor(nx * this.gridCols));
    const gy = Math.min(this.gridRows - 1, Math.floor(ny * this.gridRows));

    if (this.quakeOverrides.length > 0) {
      const override = this.isInQuakeOverride(gx, gy);
      if (override !== null) return override ? "water" : "land";
    }

    const value = this.grid[gy * this.gridCols + gx];
    return value < this.waterThreshold ? "water" : "land";
  }

  /** Ham (eşiklenmemiş) ızgara değerini döndürür — Faz XVII Madde 3'ün yükseklik
   *  bandı sınıflandırması bunu kullanıyor (bkz. `getElevationBand`). Deprem
   *  override'ları burada KASITLI olarak yok sayılıyor (`terrainAt`'ın aksine) —
   *  bir deprem sadece su/kara ikili durumunu geçici değiştiriyor (TASKS.md, Faz
   *  VIII: "küçük/lokal ve nadir"), arazi ÇEŞİDİ (kumsal/ova/dağ) gibi görsel/
   *  jeolojik bir özelliği aynı geçicilikte değiştirmek kapsam dışı bırakıldı. */
  private rawGridValueAt(x: number, y: number): number {
    const nx = clamp01(x / MAP_WIDTH);
    const ny = clamp01(y / MAP_HEIGHT);
    const gx = Math.min(this.gridCols - 1, Math.floor(nx * this.gridCols));
    const gy = Math.min(this.gridRows - 1, Math.floor(ny * this.gridRows));
    return this.grid[gy * this.gridCols + gx];
  }

  /**
   * Faz XVII Madde 3 — Arazi çeşitleri (TASKS.md): "iz düşüm yöntemi" (height-map
   * projeksiyonu) ile derin su/sığ su/kumsal/ova/dağ. Karmaşık, AYRI bir yükseklik
   * katmanı YOK — zaten var olan (su/kara ayrımını üreten) ham noise değeri
   * (`rawGridValueAt`) doğrudan "yükseklik" olarak yeniden kullanılıyor, sadece
   * eşik sayısı ikiden (su/kara) beşe çıkıyor. Su tarafında Faz X'in MEVCUT
   * mesafe-tabanlı sığ/derin su sorgusu (`isShallowWater`/`isDeepWater`) AYNEN
   * kullanılıyor (tutarlılık için — iki farklı "sığ su" tanımı olmasın); kara
   * tarafında ham değere göre YENİ eşikler (kumsal: su eşiğine yakın bir bant,
   * dağ: yüksek bir eşiğin üstü, ova: ikisi arası) ekleniyor. `terrainAt`/
   * `isWater`/su→kara geçiş mantığı HİÇ değişmedi — bu tamamen görsel/kategorik
   * bir üst katman (Faz X'in şeklinin aynısı).
   */
  private static readonly BEACH_BAND = 0.05;
  private static readonly MOUNTAIN_THRESHOLD = 2.5;

  /** Gerçek hesaplama — SADECE constructor'da (`elevationGrid` doldurulurken, hücre
   *  başına bir kez) çağrılır. Diğer her yerden `getElevationBand` (önbellek okuması)
   *  kullanılmalı — bkz. `elevationGrid` alanındaki performans notu. */
  private computeElevationBand(x: number, y: number): ElevationBand {
    if (this.isWater(x, y)) {
      return this.isDeepWater(x, y) ? "deep_water" : "shallow_water";
    }
    const value = this.rawGridValueAt(x, y);
    if (value < this.waterThreshold + World.BEACH_BAND) return "beach";
    if (value > World.MOUNTAIN_THRESHOLD) return "mountain";
    return "plain";
  }

  /** Verilen dünya koordinatındaki arazi ÇEŞİDİNİ (Faz XVII Madde 3) döndürür —
   *  `elevationGrid` önbelleğinden okur (en-yakın ızgara örneklemesi, `terrainAt`
   *  ile aynı yaklaşım). Deprem override'ları bunu ETKİLEMEZ (bkz. yukarıdaki
   *  `rawGridValueAt` notu — kasıtlı bir kapsam kararı). */
  public getElevationBand(x: number, y: number): ElevationBand {
    const nx = clamp01(x / MAP_WIDTH);
    const ny = clamp01(y / MAP_HEIGHT);
    const gx = Math.min(this.gridCols - 1, Math.floor(nx * this.gridCols));
    const gy = Math.min(this.gridRows - 1, Math.floor(ny * this.gridRows));
    return ELEVATION_BAND_LIST[this.elevationGrid[gy * this.gridCols + gx]];
  }

  public isWater(x: number, y: number): boolean {
    return this.terrainAt(x, y) === "water";
  }

  /**
   * Faz X (v3) — Sığ/derin su ayrımı (TASKS.md): kıyıya yakın "sığ su" bandı ile
   * açık denizdeki "derin su" arasında basit bir mesafe eşiği. Mevcut su/kara
   * mekaniğinin (Faz II'den beri sabit, ASLA bozulmadı) üstüne İNCE bir katman —
   * `terrainAt`/`isWater`/`randomWaterPoint` hiç değişmedi, bu sadece "bu su
   * noktası kıyıya ne kadar yakın" sorusuna cevap veren AYRI bir sorgu.
   *
   * Karmaşık bir gerçek derinlik haritası GEREKMİYOR (TASKS.md) — en yakın kara
   * hücresine olan mesafeyi, zaten var olan düşük-çözünürlüklü ızgara üzerinde
   * genişleyen bir "halka" araması ile buluyoruz (ızgara sadece 320×200, birkaç
   * halka adımı yeterince hızlı — her canlı için her karede çağrılabilir).
   * Kara üzerinde bir noktada mesafe 0 sayılır (tanım gereği kıyıya bitişik).
   */
  private static readonly SHALLOW_WATER_BAND_PX = 70;
  /** Işıma yarıçapını piksellerden ızgara hücresine çevirip yukarı yuvarlayan bir
   *  üst sınır — bandın biraz ötesini tarasak yeterli, tüm haritayı taramaya gerek yok. */
  private static readonly MAX_SEARCH_RING = 6;

  /** En yakın kara hücresine olan YAKLAŞIK mesafe (px). Arama yarıçapı sınırlı
   *  (`MAX_SEARCH_RING`) — bu yarıçap içinde kara bulunamazsa (açık denizin ortası)
   *  büyük bir değer (kesinlikle "derin su" sayılacak kadar) döndürülür; kesin
   *  mesafe önemli değil, sadece sığ/derin eşiğinin doğru tarafında olması yeterli
   *  (TASKS.md: "basit bir mesafe eşiği yeterli, karmaşık bir gerçek derinlik
   *  haritası gerekmiyor"). */
  private approxDistanceToLandPx(x: number, y: number): number {
    const nx = clamp01(x / MAP_WIDTH);
    const ny = clamp01(y / MAP_HEIGHT);
    const gx = Math.min(this.gridCols - 1, Math.floor(nx * this.gridCols));
    const gy = Math.min(this.gridRows - 1, Math.floor(ny * this.gridRows));

    if (this.terrainAt(x, y) === "land") return 0;

    const pxPerGx = MAP_WIDTH / this.gridCols;
    const pxPerGy = MAP_HEIGHT / this.gridRows;
    const cellPx = Math.min(pxPerGx, pxPerGy);

    for (let ring = 1; ring <= World.MAX_SEARCH_RING; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        const oy = gy + dy;
        if (oy < 0 || oy >= this.gridRows) continue;
        // Sadece halkanın dış çeperini tara (içi zaten önceki halkalarda tarandı).
        const xStep = Math.abs(dy) === ring ? 1 : ring * 2;
        for (let dx = -ring; dx <= ring; dx += xStep) {
          const ox = gx + dx;
          if (ox < 0 || ox >= this.gridCols) continue;
          const value = this.grid[oy * this.gridCols + ox];
          const isLand = value >= this.waterThreshold;
          if (isLand) {
            return Math.hypot(dx, dy) * cellPx;
          }
        }
      }
    }
    // Arama yarıçapında kara bulunamadı — kesinlikle bandın çok ötesinde (derin su).
    return World.SHALLOW_WATER_BAND_PX * 4;
  }

  /** Su VE kıyıya yakınsa true (TASKS.md — "sığ su"). Kara üzerinde false döner
   *  (bu sorgu sadece su noktaları için anlamlı). */
  public isShallowWater(x: number, y: number): boolean {
    if (!this.isWater(x, y)) return false;
    return this.approxDistanceToLandPx(x, y) <= World.SHALLOW_WATER_BAND_PX;
  }

  /** Su VE kıyıdan uzaksa true (TASKS.md — "açık denizdeki derin su"). */
  public isDeepWater(x: number, y: number): boolean {
    if (!this.isWater(x, y)) return false;
    return !this.isShallowWater(x, y);
  }

  /** Rastgele bir su koordinatı bulur (reddetme örneklemesi — birkaç denemede
   *  bulunamazsa yine de bir koordinat döner, sonsuz döngü riski yok). Mikroorganizma
   *  spawn'ı için kullanılır (TASKS.md: "ilk yaşam suda başlar"). */
  public randomWaterPoint(): { x: number; y: number } {
    for (let attempt = 0; attempt < 200; attempt++) {
      const x = Math.random() * MAP_WIDTH;
      const y = Math.random() * MAP_HEIGHT;
      if (this.isWater(x, y)) return { x, y };
    }
    // Bulunamadıysa (aşırı uçta bir eşik/harita ile teorik olarak mümkün) merkezi döndür.
    return { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
  }

  /** Faz II — Su→kara geçişi: karada da (bacaklı bireyler için) besin belirebilmesi
   *  için rastgele bir kara koordinatı bulur (aynı reddetme-örneklemesi mantığı). */
  public randomLandPoint(): { x: number; y: number } {
    for (let attempt = 0; attempt < 200; attempt++) {
      const x = Math.random() * MAP_WIDTH;
      const y = Math.random() * MAP_HEIGHT;
      if (!this.isWater(x, y)) return { x, y };
    }
    return { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
  }

  private buildTexture(): Texture {
    const canvas = document.createElement("canvas");
    canvas.width = MAP_WIDTH;
    canvas.height = MAP_HEIGHT;
    const ctx = canvas.getContext("2d")!;
    const image = ctx.createImageData(MAP_WIDTH, MAP_HEIGHT);
    const data = image.data;

    // Faz XVII Madde 3 — nötr/bilimsel arazi paleti (bkz. `ELEVATION_COLORS`). Kara
    // tarafı (kumsal/ova/dağ) ham noise değerinden TAM PİKSEL çözünürlüğünde
    // (kıyı çizgisi eskisi gibi keskin kalsın) hesaplanıyor — ring-search GEREKMİYOR.
    // Su tarafı (derin/sığ) `elevationGrid` ÖNBELLEĞİNDEN (320×200) okunuyor — sığ su
    // bandı zaten geniş (70px) bir "yumuşak" bölge olduğundan bu çözünürlük yeterli,
    // aksi halde 1.6M piksel için mesafe araması (ring-search) yapmak sayfa
    // yüklenişini gözle görülür şekilde yavaşlatırdı.
    for (let py = 0; py < MAP_HEIGHT; py++) {
      const ny = py / (MAP_HEIGHT - 1);
      for (let px = 0; px < MAP_WIDTH; px++) {
        const nx = px / (MAP_WIDTH - 1);
        const value = sampleRawNoise(this.waves, nx, ny);
        const isWater = value < this.waterThreshold;
        let c: { r: number; g: number; b: number };
        if (isWater) {
          c = ELEVATION_COLORS[this.getElevationBand(px, py)];
        } else if (value < this.waterThreshold + World.BEACH_BAND) {
          c = ELEVATION_COLORS.beach;
        } else if (value > World.MOUNTAIN_THRESHOLD) {
          c = ELEVATION_COLORS.mountain;
        } else {
          c = ELEVATION_COLORS.plain;
        }
        const idx = (py * MAP_WIDTH + px) * 4;
        data[idx] = c.r;
        data[idx + 1] = c.g;
        data[idx + 2] = c.b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(image, 0, 0);
    return Texture.from(canvas);
  }
}

function clamp01(v: number): number {
  return Math.min(0.999999, Math.max(0, v));
}
