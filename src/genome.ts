import { mulberry32, randRange } from "./rng";
import { hslToHex, shade } from "./color";
import { Organ, OrganType, pickRandomOrganType } from "./organs";

/**
 * Faz I (v3) — Mikroorganizma genomu. Başlangıçta genomda organ/uzuv YOK (TASKS.md v3:
 * "Tüm canlılar en başta tek hücreli/organsız mikroorganizmalar olarak başlar").
 *
 * Faz II (v3) — Açık organ sistemi eklendi: genoma açık uçlu bir `organs: Organ[]`
 * alanı geldi (TASKS.md — "Açık organ havuzu"). Bölünme sırasında düşük bir olasılıkla
 * yeni bir organ tipi kazanılabilir (sabit bir sıra/ağaç YOK, tamamen fırsatçı/rastgele
 * — bkz. `maybeGainOrgan`). Organ tanımları/çizimleri `organs.ts`'te ayrı tutuluyor.
 */

/**
 * Her genoma benzersiz, artan bir kimlik atar (nesil/soy takibi için — v2'den
 * korunan kavram, bkz. TASKS.md "Nesil/genetik takibi"). Sayfa yenilenince/yeniden
 * başlatılınca sıfırlanır.
 */
let nextGenomeId = 1;

export function resetGenomeIdCounter(): void {
  nextGenomeId = 1;
}

export function ensureGenomeIdCounterAbove(id: number): void {
  if (id >= nextGenomeId) nextGenomeId = id + 1;
}

/**
 * Tek hücreli bir mikroorganizmanın genomu. Görünüş: basit bir daire/nokta (organ/uzuv
 * YOK). Hayatta kalma parametreleri (metabolizma, bölünme eşiği, hız, algı) v2'nin
 * temel canlı genlerinden ilham alıyor ama uzuv/diyet ayrımı olmadan.
 */
export interface Genome {
  seed: number;
  id: number;
  parentIds: [number, number] | null;

  // --- Gövde: basit bir daire, sadece yarıçap ---
  radius: number; // px

  // --- Renk (görsel çeşitlilik için, organ/tür anlamı taşımıyor) ---
  hue: number; // 0-360
  saturation: number; // 0-100
  lightness: number; // 0-100

  // --- Hayatta kalma / davranış ---
  moveSpeed: number; // px/saniye, temel hareket hızı
  senseRadius: number; // px, besin fark edebildiği menzil
  metabolism: number; // saniyede kaybedilen temel enerji

  // --- Bölünme (mikroorganizmalar "üreme" yerine bölünerek çoğalır) ---
  /** Enerjisi bu eşiğe ulaştığında ikiye bölünür (bkz. Ecosystem.updateReproduction). */
  divideEnergyFraction: number;

  // --- Faz IX — Gerçek yaşam döngüsü (kullanıcı isteği, 2026-09-02): sadece açlıktan
  // değil, YAŞLANDIKÇA da ölüm. Açık organ havuzu felsefesiyle tutarlı, mutasyonla
  // hafifçe değişebilen bir gen (sabit bir global sabit yerine) — bkz. `NUMERIC_BOUNDS`
  // ve `mutateGenome`. Bir birey `age` (zaten var, Faz V büyüme animasyonunda kullanılan
  // alan) bu değeri aştığında "yaşlılıktan" ölür (bkz. Ecosystem.updateCreatures). */
  /** saniye — bu yaşa ulaşınca birey enerjisi ne olursa olsun ölür. */
  maxLifespan: number;

  // --- Nesil ---
  generation: number;

  // --- Organlar (Faz II — açık uçlu, başlangıçta boş) ---
  organs: Organ[];

  // --- Faz VII — Üreme stratejisi genleri (TASKS.md: "açık organ havuzu felsefesiyle
  // tutarlı, mutasyonla ortaya çıkabilen bir üreme stratejisi geni"). Başlangıçta hepsi
  // "asexual"/false — mikroorganizmalar hâlâ öncelikle bölünerek çoğalır (Faz I-VI
  // davranışı DEĞİŞMEDİ), bu genler sadece mutasyonla fırsatçı bir şekilde ortaya
  // çıkabilir. ---
  /** "asexual" (varsayılan, mevcut `divideGenome` davranışı) veya "sexual" (iki birey
   *  eşleşip `crossoverGenomes` ile yavru üretebilir, bkz. Ecosystem.updateSexualReproduction). */
  reproductionStrategy: "asexual" | "sexual";
  /** true ise yavru hemen aktif bir birey olarak doğmak yerine önce bir Egg nesnesi
   *  olarak bir süre bekleyip açılır (bkz. `egg.ts`). Üreme stratejisinden bağımsız
   *  ayrı bir gen — hem aseksüel hem cinsel üremede geçerli olabilir. */
  laysEggs: boolean;

  // --- Faz IX — Diyet sistemi (TASKS.md madde 3): "hangi canlının ne olduğu
  // anlaşılmıyor" geri bildirimine çözüm. Açık organ havuzu felsefesiyle tutarlı bir
  // gen — mutasyonla ortaya çıkabilir/değişebilir (bkz. `mutateDietGene`). Başlangıç
  // popülasyonu her zaman "herbivore" (TASKS.md: "sabit bir evrim sırası yok", ama
  // etçillik de tıpkı organlar gibi fırsatçı bir kazanım olsun, en baştan yarı yarıya
  // dağılmasın). Otçullar mevcut nutrient sistemini kullanmaya devam eder; etçiller
  // diğer canlıları avlar (bkz. Ecosystem.updateCarnivoreHunting). */
  diet: "herbivore" | "carnivore";

  // --- Faz XVII Madde 2 — Sürü davranışı (TASKS.md): "bazı etçiller tekli avcı,
  // bazıları sürü avcısı olabilsin, yakındaki aynı-tip etçil sayısı avlanma
  // başarısını artırsın" — mutasyonla ortaya çıkan, davranış-geni felsefesine
  // (reproductionStrategy/laysEggs ile aynı desen) uygun ayrı bir boolean gen.
  // Sadece diet==="carnivore" bireylerde ANLAMLI (bkz. Creature.packHuntBonus),
  // ama otçullarda da tutulabilir (gen kaybolmaz, sadece etkisiz kalır — diyet
  // de zaten mutasyonla değişebiliyor). Başlangıç popülasyonu her zaman false
  // (fırsatçı kazanım, TASKS.md — "sabit bir evrim sırası yok"). */
  packHunter: boolean;
}

export function randomGenome(seed: number = Math.floor(Math.random() * 1_000_000)): Genome {
  const rng = mulberry32(seed);

  return {
    seed,
    id: nextGenomeId++,
    parentIds: null,

    radius: randRange(rng, 4, 7),

    hue: randRange(rng, 0, 360),
    saturation: randRange(rng, 45, 75),
    lightness: randRange(rng, 45, 65),

    moveSpeed: randRange(rng, 18, 38),
    senseRadius: randRange(rng, 40, 90),
    metabolism: randRange(rng, 0.8, 1.6),

    divideEnergyFraction: randRange(rng, 0.85, 0.98),

    // Faz IX — Gerçek yaşam döngüsü: 180-320s arası (Faz IV'ün denge testlerinde
    // popülasyon zaten bu mertebede — birkaç dakikalık koşularda birkaç nesil geçiyor —
    // bu yüzden bu aralık "hiçbirey hiç ölmüyor" hissini kırar ama popülasyonu ani
    // çökertecek kadar agresif değil).
    maxLifespan: randRange(rng, 180, 320),

    generation: 0,

    // Mikroorganizmalar organsız başlar (TASKS.md v3 — "Başlangıç").
    organs: [],

    // Faz VII — başlangıç popülasyonu her zaman aseksüel/yumurtasız (fırsatçı genler
    // sadece mutasyonla ortaya çıkar, TASKS.md — "sabit bir evrim sırası yok").
    reproductionStrategy: "asexual",
    laysEggs: false,

    // Faz IX — başlangıç popülasyonu her zaman otçul (etçillik mutasyonla fırsatçı
    // olarak ortaya çıkar, organ kazanımıyla aynı ruhta).
    diet: "herbivore",

    // Faz XVII Madde 2 — başlangıçta hiç sürü avcısı yok, tamamen fırsatçı kazanım.
    packHunter: false,
  };
}

const NUMERIC_BOUNDS: Record<string, [number, number]> = {
  radius: [3, 10],
  saturation: [25, 90],
  lightness: [30, 78],
  moveSpeed: [10, 55],
  senseRadius: [25, 130],
  metabolism: [0.5, 2.2],
  divideEnergyFraction: [0.7, 0.99],
  // Faz IX — yaşam süresi de diğer sürekli genler gibi hafifçe mutasyona uğrayabilir
  // (uzun ömürlü/kısa ömürlü soylar fırsatçı şekilde ortaya çıkabilir), ama makul bir
  // aralıkta tutuluyor (çok kısa: anlık ölüm sarmalı; çok uzun: yaşlanma etkisiz kalır).
  maxLifespan: [90, 500],
};

function clamp(value: number, [min, max]: [number, number]): number {
  return Math.min(max, Math.max(min, value));
}

/** Bölünme (aseksüel çoğalma) sonucu üretilen çocuk genomu: ebeveynin bir kopyası +
 *  küçük mutasyonlar. Mikroorganizmalar eşleşerek değil bölünerek çoğaldığı için
 *  crossover yok — v2'deki `crossoverGenomes` bu fazda gerekmiyor. */
export function divideGenome(parent: Genome): Genome {
  const child: Genome = {
    ...parent,
    id: nextGenomeId++,
    parentIds: [parent.id, parent.id],
    generation: parent.generation + 1,
    organs: parent.organs.map((o) => ({ ...o })),
  };
  return mutateGenome(child);
}

const MUTATION_CHANCE = 0.25;
const MUTATION_STRENGTH = 0.12;

/** Faz II — yeni bir organ TİPİ kazanma olasılığı (bölünme başına). Düşük tutuluyor:
 *  TASKS.md "mutasyon, zamanla genoma yeni bir organ/uzuv TİPİ ekleme şansı verir" —
 *  sık olursa açık uçlu evrim yerine anlık "organ yağmuru" hissi verir. */
const NEW_ORGAN_CHANCE = 0.045;
/** Bir canlı en fazla bu kadar farklı organ TİPİNE sahip olabilir (kontrolsüz büyümeyi
 *  önlemek için gevşek bir üst sınır — TASKS.md'de sayısal bir sınır verilmiyor ama
 *  "açık uçlu" ilkesi sonsuz organ biriktirme anlamına gelmiyor). */
const MAX_ORGAN_TYPES = 6;

/** Faz VII — üreme stratejisi/yumurtalama genlerinin bölünme başına flip olasılığı.
 *  Düşük tutuluyor (TASKS.md: "rastgele/fırsatçı: bazı bireyler bu stratejiyi
 *  'kazanır'") — `NEW_ORGAN_CHANCE` ile aynı mertebede, açık uçlu evrim hissi
 *  organ kazanımıyla tutarlı kalsın diye. Bu genler tek yönlü DEĞİL — mutasyon
 *  stratejiyi geri de çevirebilir (gerçek evrimde de sabit bir "kazanım" yok).
 */
const REPRODUCTION_STRATEGY_FLIP_CHANCE = 0.03;
const LAYS_EGGS_FLIP_CHANCE = 0.03;

/** Faz IX — Diyet geninin bölünme başına flip olasılığı (TASKS.md: "mutasyonla
 *  ortaya çıkabilir/değişebilir"). Organ kazanımıyla aynı mertebede tutuluyor —
 *  ne çok nadir (görsel çeşitliliğe hiç ulaşmaz) ne çok sık (rastgele gürültü hissi
 *  verir). İki yönlü: bir etçil soyu da tekrar otçula dönebilir (gerçek evrimde
 *  sabit bir "kazanım" yok, TASKS.md'nin genel felsefesiyle tutarlı). */
const DIET_FLIP_CHANCE = 0.035;

function mutateDietGene(genome: Genome): void {
  if (Math.random() < DIET_FLIP_CHANCE) {
    genome.diet = genome.diet === "herbivore" ? "carnivore" : "herbivore";
  }
}

/** Faz XVII Madde 2 — Sürü davranışı geninin flip olasılığı, diğer davranış
 *  genleriyle (diyet/üreme) aynı mertebede — ne çok nadir ne çok sık. İki
 *  yönlü: bir soy tekrar "tekli avcı"ya dönebilir (sabit bir kazanım yok). */
const PACK_HUNTER_FLIP_CHANCE = 0.035;

function mutatePackHunterGene(genome: Genome): void {
  if (Math.random() < PACK_HUNTER_FLIP_CHANCE) {
    genome.packHunter = !genome.packHunter;
  }
}

/** Faz VII — Gemini'nin hafif yönlendirmesi (TASKS.md): "sexual" stratejisine flip
 *  olma olasılığı için sınırlı bir çarpan — `organs.ts`'teki `applyOrganWeightSuggestion`
 *  ile AYNI sınır felsefesi (±%20 aralığı, birikimli sınırsız büyüme yok). Gemini hiç
 *  öneri yapmadıysa 1 (nötr) kalır, mevcut sabit oran korunur. */
const MIN_STRATEGY_MULTIPLIER = 0.8;
const MAX_STRATEGY_MULTIPLIER = 1.2;
let sexualStrategyMultiplier = 1;

export function applySexualStrategyWeightSuggestion(delta: number): void {
  if (!Number.isFinite(delta)) return;
  const clampedDelta = Math.min(0.2, Math.max(-0.2, delta));
  sexualStrategyMultiplier = Math.min(
    MAX_STRATEGY_MULTIPLIER,
    Math.max(MIN_STRATEGY_MULTIPLIER, sexualStrategyMultiplier + clampedDelta)
  );
}

export function getSexualStrategyMultiplier(): number {
  return sexualStrategyMultiplier;
}

export function resetSexualStrategyMultiplier(): void {
  sexualStrategyMultiplier = 1;
}

/** Faz VII — mutasyonla üreme stratejisi/yumurtalama genlerini fırsatçı şekilde
 *  değiştirir (organ kazanımıyla aynı ruhta: sabit bir sıra yok, düşük olasılıkla
 *  rastgele flip). Aseksüelden cinselliğe geçiş Gemini'nin (sınırlı) önerisiyle
 *  hafifçe kaydırılabilir; cinsellikten aseksüele dönüş sabit oranda kalır (Gemini
 *  sadece "sexual"ı teşvik/caydırma yönünde etki eder, TASKS.md örneğiyle tutarlı). */
function mutateReproductionGenes(genome: Genome): void {
  if (genome.reproductionStrategy === "asexual") {
    if (Math.random() < REPRODUCTION_STRATEGY_FLIP_CHANCE * sexualStrategyMultiplier) {
      genome.reproductionStrategy = "sexual";
    }
  } else if (Math.random() < REPRODUCTION_STRATEGY_FLIP_CHANCE) {
    genome.reproductionStrategy = "asexual";
  }
  if (Math.random() < LAYS_EGGS_FLIP_CHANCE) {
    genome.laysEggs = !genome.laysEggs;
  }
}
/** Zaten sahip olunan bir organın güç/boyutunun hafifçe mutasyona uğrama olasılığı. */
const ORGAN_POWER_MUTATION_CHANCE = 0.3;
const ORGAN_POWER_MUTATION_STRENGTH = 0.15;

/** Yeni bir organ TİPİ kazanımı — tamamen fırsatçı/rastgele (TASKS.md: "sabit/önceden
 *  tanımlı bir evrim ağacı sırası YOK"). Havuzdan (organs.ts) ağırlıklı rastgele seçim
 *  yapılır, zaten sahip olunan tipler hariç tutulur. */
function maybeGainOrgan(organs: Organ[]): Organ[] {
  if (organs.length >= MAX_ORGAN_TYPES) return organs;
  if (Math.random() > NEW_ORGAN_CHANCE) return organs;

  const existingTypes = organs.map((o) => o.type);
  const newType: OrganType = pickRandomOrganType(existingTypes);
  const newOrgan: Organ = { type: newType, power: randRange(Math.random, 0.25, 0.6) };
  return [...organs, newOrgan];
}

function mutateOrganPowers(organs: Organ[]): Organ[] {
  return organs.map((o) => {
    if (Math.random() > ORGAN_POWER_MUTATION_CHANCE) return o;
    const delta = (Math.random() - 0.5) * 2 * ORGAN_POWER_MUTATION_STRENGTH;
    return { ...o, power: clamp(o.power + delta, [0.05, 1]) };
  });
}

export function mutateGenome(genome: Genome): Genome {
  const mutated: Genome = { ...genome, organs: genome.organs.map((o) => ({ ...o })) };

  for (const key of Object.keys(NUMERIC_BOUNDS) as (keyof typeof NUMERIC_BOUNDS)[]) {
    if (Math.random() > MUTATION_CHANCE) continue;
    const bounds = NUMERIC_BOUNDS[key];
    const range = bounds[1] - bounds[0];
    const delta = (Math.random() - 0.5) * 2 * range * MUTATION_STRENGTH;
    (mutated as unknown as Record<string, number>)[key] = clamp(
      (genome as unknown as Record<string, number>)[key] + delta,
      bounds
    );
  }

  if (Math.random() < MUTATION_CHANCE * 1.3) {
    mutated.hue = (((genome.hue + (Math.random() - 0.5) * 50) % 360) + 360) % 360;
  }

  mutated.organs = mutateOrganPowers(mutated.organs);
  mutated.organs = maybeGainOrgan(mutated.organs);
  mutateReproductionGenes(mutated);
  mutateDietGene(mutated);
  mutatePackHunterGene(mutated);

  return mutated;
}

/**
 * Faz VII — Çiftleşme (cinsel üreme, TASKS.md): iki ebeveynin genomlarını basit bir
 * crossover ile karıştırıp bir çocuk genomu üretir. v2'deki eski `crossoverGenomes`
 * mantığından ilham alındı (TASKS.md notu) ama v3'ün sade genom şekline uyarlandı:
 * her sayısal alan için ebeveynlerden biri rastgele seçilir (uniform crossover),
 * organ listesi iki ebeveynin organ tiplerinin BİRLEŞİMİnden (union, tekrarsız)
 * oluşur — açık organ havuzu felsefesiyle tutarlı: cinsel üreme organ çeşitliliğini
 * birleştirip yeni kombinasyonlar üretebilir. Sonda normal `mutateGenome` de
 * uygulanır (crossover + mutasyon, iki ayrı çeşitlilik kaynağı).
 */
export function crossoverGenomes(a: Genome, b: Genome): Genome {
  const pickFrom = <T,>(av: T, bv: T): T => (Math.random() < 0.5 ? av : bv);

  const organsByType = new Map<OrganType, Organ>();
  for (const o of a.organs) organsByType.set(o.type, o);
  for (const o of b.organs) {
    const existing = organsByType.get(o.type);
    // Her iki ebeveynde de varsa güçlerinin ortalaması, tek birinde varsa direkt o.
    organsByType.set(o.type, existing ? { type: o.type, power: (existing.power + o.power) / 2 } : { ...o });
  }
  // Bug-avı düzeltmesi (tester bulgusu, 2026-09-10, PM onaylı): `Map` insertion-order
  // (a.organs önce eklendiği için `a` hep önce geliyordu) + `.slice(0, MAX_ORGAN_TYPES)`
  // birleşim 6'yı aşınca SİSTEMATİK olarak `a`'yı (çağrı yerinde her zaman "arayan"
  // taraf, ecosystem.ts `updateSexualReproduction`) `b`'ye tercih ediyordu — yorumun
  // iddia ettiği "adil birleşim" değildi. Düzeltme: kesmeden ÖNCE Fisher-Yates ile
  // karıştır — hangi organların hayatta kaldığı artık rastgele (istenen davranış
  // değişikliği), her iki ebeveyn de eşit şansa sahip.
  const combinedOrgansList = Array.from(organsByType.values());
  for (let i = combinedOrgansList.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combinedOrgansList[i], combinedOrgansList[j]] = [combinedOrgansList[j], combinedOrgansList[i]];
  }
  const combinedOrgans = combinedOrgansList.slice(0, MAX_ORGAN_TYPES);

  const child: Genome = {
    seed: pickFrom(a.seed, b.seed),
    id: nextGenomeId++,
    parentIds: [a.id, b.id],

    radius: pickFrom(a.radius, b.radius),
    hue: pickFrom(a.hue, b.hue),
    saturation: pickFrom(a.saturation, b.saturation),
    lightness: pickFrom(a.lightness, b.lightness),

    moveSpeed: pickFrom(a.moveSpeed, b.moveSpeed),
    senseRadius: pickFrom(a.senseRadius, b.senseRadius),
    metabolism: pickFrom(a.metabolism, b.metabolism),

    divideEnergyFraction: pickFrom(a.divideEnergyFraction, b.divideEnergyFraction),
    maxLifespan: pickFrom(a.maxLifespan, b.maxLifespan),

    generation: Math.max(a.generation, b.generation) + 1,

    organs: combinedOrgans,

    reproductionStrategy: pickFrom(a.reproductionStrategy, b.reproductionStrategy),
    laysEggs: pickFrom(a.laysEggs, b.laysEggs),
    diet: pickFrom(a.diet, b.diet),
    packHunter: pickFrom(a.packHunter, b.packHunter),
  };

  return mutateGenome(child);
}

export interface Palette {
  body: number;
  bodyDark: number;
  bodyLight: number;
}

/** Genomdan sade bir renk paleti türetir — mikroorganizma tek bir daire olarak
 *  çizildiği için sadece gövde rengi + kontur/vurgu tonu yeterli. */
export function genomeToPalette(genome: Genome): Palette {
  const sat = Math.min(60, genome.saturation * 0.6);
  const light = 40 + (genome.lightness - 50) * 0.3;
  const body = hslToHex(genome.hue, sat, light);
  const bodyDark = shade(body, -0.35);
  const bodyLight = shade(body, 0.2);
  return { body, bodyDark, bodyLight };
}
