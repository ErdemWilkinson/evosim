import { mulberry32, randRange } from "./rng";

/**
 * Faz XVI Madde 2 (v3, TASKS.md) — "Gezegen oluşumu" özeti. Simülasyon başlamadan
 * hemen önce, kullanıcıya gezegenin NEDEN bu şekilde oluştuğunu anlatan kısa, TEK
 * EKRANLIK bir özet (büyük bir cutscene DEĞİL — TASKS.md v3'ün "minimal/sade" ilkesi).
 *
 * Determinizm (TASKS.md — "aynı seed = aynı oluşum özeti"): burada üretilen HER
 * değer, `World.seed` (Faz VIII, `generateMapSeed`) ve haritanın gerçek su/kara
 * oranından (`World.waterFraction`, zaten var olan gerçek ölçüm) TÜRETİLİYOR —
 * `mulberry32(seed)` ile aynı seed HER ZAMAN aynı "oluşum profilini" üretir (bir
 * kayıt yüklenince de aynı `mapSeed` geri kullanıldığı için özet otomatik tutarlı
 * kalır, bkz. `world.ts`/`savegame.ts`).
 *
 * Kurgusal ama "olsaydı böyle olurdu" tarzında makul tutuluyor (TASKS.md — "gerçek
 * dünya ilhamı"): atmosfer bileşimi gerçek gezegen bilimi kategorileriyle (azot/
 * oksijen/karbondioksit/metan) ifade ediliyor, oranlar suya/karaya göre hafifçe
 * kayıyor (örn. su oranı yüksek gezegenlerde metan/karbondioksit biraz daha yüksek
 * — okyanus tabanı organik ayrışması ilhamlı bir sezgisel bağ, TASKS.md'nin "Faz
 * XIV'teki gibi" ilkesiyle tutarlı bir basitleştirme, gerçek bir iklim modeli DEĞİL).
 * "Bio maddeler" tamamen kurgusal ama kimyasal/mineral isimlendirmesiyle bilimsel-
 * hissi veren bir liste (örn. "zengin organik çözelti", "yüksek kükürt konsantrasyonu")
 * — bu liste `organs.ts`'teki gezegene-özgü organ filtrelemesi (Faz XVI Madde 3) için
 * de girdi olarak kullanılıyor (bkz. `PlanetProfile.nitrogenLevel` -> "azot deposu"
 * organının uygunluğu).
 *
 * Gerçek oksijen seviyesi (`atmosphere.ts` `Atmosphere.getOxygenLevel`) burada
 * TEKRARLANMIYOR/ÇAKIŞTIRILMIYOR — o zaten simülasyon zamanına göre dinamik/
 * dalgalanan bir değer (Faz X). Buradaki "oksijen" sadece BAŞLANGIÇ/ortalama
 * atmosfer bileşimini anlatan statik bir yüzde (oluşum hikâyesinin bir parçası),
 * ikisi arasında bir çakışma/çelişki riski yok çünkü bu ekran SADECE bir kerelik,
 * simülasyon başlamadan önceki bir özet — simülasyon başladıktan sonra HUD'daki
 * gerçek dinamik oksijen değeri (Faz X) devam ediyor.
 */

export type NitrogenLevel = "low" | "moderate" | "high";

export interface PlanetProfile {
  seed: number;
  /** Yüzde (0-100), toplamı ~100 olacak şekilde normalize edilmiş 4 bileşen. */
  atmosphere: {
    nitrogen: number;
    oxygen: number;
    carbonDioxide: number;
    methane: number;
  };
  /** Faz XVI Madde 3 — azot seviyesinin kaba/kategorik hali, organ filtrelemesi
   *  bu kategoriye bakıyor (ham yüzdeye değil — eşik netliği için). */
  nitrogenLevel: NitrogenLevel;
  /** Kurgusal ama bilimsel-hissi veren "bio madde" bileşenleri — yaşamın başlangıcı
   *  için gerekli kimyasal/mineral zenginlik listesi. */
  bioSubstances: string[];
  /** Faz XVI Madde 3 — `bioSubstances` içinde kükürt/sülfür temalı bir bileşen
   *  (bkz. `SULFUR_SUBSTANCE_INDICES`) gerçekten seçildiyse true. `organs.ts`'teki
   *  gezegene-özgü organ filtrelemesi (`sulfur_vent_organ`) bu alana bakıyor — metin
   *  eşleştirmesi (string matching) yerine EXPLICIT bir boolean, narrative metni
   *  ileride değişse bile filtreleme mantığı kırılmasın diye. */
  hasSulfurRichSubstance: boolean;
  /** Su/kara oranıyla ilişkisini anlatan kısa (2-4 cümlelik) anlatı — TASKS.md
   *  "büyük bir cutscene değil, kısa bir özet". */
  narrative: string;
  waterPercent: number;
  landPercent: number;
}

const BIO_SUBSTANCE_POOL: readonly string[] = [
  "Zengin organik çözelti",
  "Yüksek kükürt konsantrasyonu",
  "İz demir-sülfür kristalleri",
  "Alkali mineral tortusu",
  "Fosfat açısından zengin tortul katman",
  "Yoğun amino asit izleri",
  "Volkanik silikat tozu",
  "Karbonat kayaç tortusu",
  "Hafif radyoaktif iz elementler (jeotermal enerji kaynağı)",
  "Kristalize metan hidrat cepleri",
  "Amonyak izli buzul kalıntıları",
  "Bakır-çinko iz mineralleri",
];

/** Faz XVI Madde 3 — `BIO_SUBSTANCE_POOL` içindeki kükürt/sülfür temalı bileşenlerin
 *  indeksleri (yukarıdaki listeyle SENKRON tutulmalı — sıra değişirse burası da
 *  güncellenmeli). `hasSulfurRichSubstance` bu indekslerden en az biri seçildiyse
 *  true olur. */
const SULFUR_SUBSTANCE_INDICES = new Set<number>([1, 2]); // "Yüksek kükürt konsantrasyonu", "İz demir-sülfür kristalleri"

/**
 * Faz XVI Madde 2 — `World.seed`/`World.waterFraction`'dan deterministik bir gezegen
 * oluşum profili türetir. Aynı seed + aynı su oranı HER ZAMAN aynı sonucu üretir
 * (mulberry32 deterministik PRNG, world.ts'teki desenle aynı).
 */
export function generatePlanetProfile(seed: number, waterFraction: number): PlanetProfile {
  // `mulberry32` kendi içinde bir ısınma çağrısı yapıyor (bkz. rng.ts) — burada
  // ekstra bir warm-up gerekmiyor, XOR ile farklı bir tuzlama yeterli (aynı seed
  // haritanın kendisiyle aynı sayı dizisini üretmesin diye — bağımsız bir "türetilmiş
  // seed" alanı, world.ts'in kendi `waves` üretimini ETKİLEMİYOR/PAYLAŞMIYOR).
  const rng = mulberry32(seed ^ 0x9e3779b9);

  const waterPercent = waterFraction * 100;
  const landPercent = 100 - waterPercent;

  // --- Atmosfer bileşimi ---
  // Azot her zaman baskın bileşen (gerçek Dünya atmosferiyle tutarlı bir sezgi:
  // %70-85 arası), seed'e göre hafifçe değişir. Oksijen orta düzey rastgele (%12-22
  // arası) — gerçek/dinamik simülasyon oksijeninden (atmosphere.ts) BAĞIMSIZ, sadece
  // "oluşum anındaki" statik bir referans. Karbondioksit/metan kalanı paylaşır, su
  // oranı yüksekse (okyanus tabanı organik ayrışması sezgisi) biraz daha yüksek.
  const nitrogenBase = randRange(rng, 68, 84);
  const oxygenBase = randRange(rng, 12, 22);
  const wetBias = waterFraction; // 0..1 — su oranı arttıkça CO2/CH4'e küçük bir ek pay
  const co2Base = randRange(rng, 2, 8) + wetBias * 3;
  const methaneBase = randRange(rng, 0.5, 4) + wetBias * 2;

  const rawTotal = nitrogenBase + oxygenBase + co2Base + methaneBase;
  const scale = 100 / rawTotal;
  const nitrogen = nitrogenBase * scale;
  const oxygen = oxygenBase * scale;
  const carbonDioxide = co2Base * scale;
  const methane = methaneBase * scale;

  const nitrogenLevel: NitrogenLevel = nitrogen >= 78 ? "high" : nitrogen >= 72 ? "moderate" : "low";

  // --- Bio maddeler: havuzdan seed'e göre 3-5 öğe, tekrarsız ---
  const poolIndices = BIO_SUBSTANCE_POOL.map((_, i) => i);
  const bioCount = 3 + Math.floor(rng() * 3); // 3-5
  const bioSubstances: string[] = [];
  let hasSulfurRichSubstance = false;
  for (let i = 0; i < bioCount && poolIndices.length > 0; i++) {
    const pick = Math.floor(rng() * poolIndices.length);
    const idx = poolIndices.splice(pick, 1)[0];
    bioSubstances.push(BIO_SUBSTANCE_POOL[idx]);
    if (SULFUR_SUBSTANCE_INDICES.has(idx)) hasSulfurRichSubstance = true;
  }

  // --- Anlatı: su/kara oranı + azot seviyesine bağlı kısa bir metin ---
  const waterDesc =
    waterPercent >= 65
      ? "geniş, derin okyanuslarla kaplı bir yüzey"
      : waterPercent >= 45
        ? "dengeli bir su/kara dağılımı"
        : "sınırlı, dağınık su kütleleriyle çevrili geniş kara kütleleri";
  const nitrogenDesc =
    nitrogenLevel === "high"
      ? "atmosferde alışılmadık derecede yoğun bir azot birikimi"
      : nitrogenLevel === "moderate"
        ? "dengeli/orta düzeyde bir azot oranı"
        : "görece düşük bir azot oranı, karbondioksit/metan payının nispeten öne çıktığı bir karışım";
  const narrative =
    `Bu gezegen ${waterDesc} ile şekillendi (%${waterPercent.toFixed(0)} su / %${landPercent.toFixed(0)} kara). ` +
    `Atmosferde ${nitrogenDesc} gözlemleniyor (${nitrogen.toFixed(1)}% azot, ${oxygen.toFixed(1)}% oksijen). ` +
    `${bioSubstances[0]} ve ${bioSubstances.length > 1 ? bioSubstances[1].toLowerCase() : "eşlik eden mineral izleri"} gibi bileşenler, ` +
    `ilk mikroorganizmaların suda ortaya çıkması için elverişli bir kimyasal zemin oluşturdu.`;

  return {
    seed,
    atmosphere: { nitrogen, oxygen, carbonDioxide, methane },
    nitrogenLevel,
    bioSubstances,
    hasSulfurRichSubstance,
    narrative,
    waterPercent,
    landPercent,
  };
}
