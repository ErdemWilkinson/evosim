import { rng } from "./rng";
import { ORGANS, ORGAN_SLOTS, Organ, OrganType, pickOrganType } from "./organs";
import { CATALYSTS, Chemistry, ENERGIES, GENETICS, MEMBRANES, Option, WALLS } from "./chemistry";

export type Diet = "phototroph" | "herbivore" | "parasite" | "filter_feeder" | "omnivore" | "scavenger" | "carnivore" | "chemotroph";

/** Grafik/yığın sırası — renk ataması bu sıraya göre doğrulandı, değiştirme. Yeni biçimler sona
 *  eklenir: kayıtlardaki ve geçmiş örneklerindeki sayılar bu sıraya göre dizilidir. */
export const DIETS: readonly Diet[] = ["phototroph", "herbivore", "parasite", "filter_feeder", "omnivore", "scavenger", "carnivore", "chemotroph"];

export const DIET_LABEL: Record<Diet, string> = {
  phototroph: "Fotosentetik",
  herbivore: "Otçul",
  parasite: "Parazit",
  filter_feeder: "Süzücü",
  omnivore: "Hepçil",
  scavenger: "Çürükçül",
  carnivore: "Etçil",
  chemotroph: "Kemotrof",
};

export const DIET_DESCRIPTION: Record<Diet, string> = {
  phototroph: "Gündüz ışıktan pasif enerji üretir; karada ve sığ suda verimli, kalabalıkta birbirini gölgeler. Çevresine yerleşik üretici öbekleri (bitki örtüsü) bırakır.",
  herbivore: "Bitki örtüsünü arayıp yer; bitki örtüsü ancak fotosentetik canlılar ortaya çıktıktan sonra var olur.",
  parasite: "Başka türden bir konağa tutunur ve onun enerjisini emer; konak ölünce yenisini arar.",
  filter_feeder: "Suda, çevresindeki bitki yoğunluğuyla orantılı hızda süzerek beslenir; aramak zorunda değildir ama seyrek bitkide aç kalır.",
  omnivore: "Kendinden küçük canlıları avlar, bulamazsa bitki yer; ikisinde de uzmanlardan verimsizdir.",
  scavenger: "Cesetleri bulup yer; ceset yoksa düşük verimle bitki yer.",
  carnivore: "Başka türlerin bireylerini avlar; bitki yiyemez.",
  chemotroph: "Sıvıda çözünmüş kimyasal besini bulunduğu yerden emer; ilk yaşamın beslenme biçimidir. Besin bulunduğu yerde tükenir ve yavaşça yenilenir, karada yoktur.",
};

// ---------------------------------------------------------------- karar ağı

/** Davranış seçimi için tek katmanlı bir algılayıcı: her eylemin puanı, duyusal
 *  girdilerin ağırlıklı toplamıdır; en yüksek puanlı (ve o an mümkün olan) eylem
 *  seçilir. Ağırlıklar genomdadır ve mutasyona uğrar: davranışın yalnızca
 *  parametreleri değil, hangi durumda neyin yapılacağı da evrimleşir. */
export const BRAIN_INPUTS = ["sabit", "açlık", "tehdit", "besin", "av", "kalabalık", "ışık", "yara", "hafıza", "çağrı"] as const;
/** Son satır ("hafıza") bir eylem değil: ağın bir sonraki karardaki hafıza değerini hesaplayan doğrusal birimdir. */
export const BRAIN_ACTIONS = ["kaç", "beslen", "avlan", "dinlen", "keşfet", "çağır", "hafıza"] as const;
export const IN = BRAIN_INPUTS.length;
export const ACT = { flee: 0, forage: 1, hunt: 2, rest: 3, explore: 4, call: 5, memory: 6 } as const;
/** Eski kayıtlardaki ağ düzeni: 5 eylem × 8 girdi. */
const OLD_IN = 8;
const OLD_ACTIONS = 5;

/** Başlangıç ağırlıkları: tehdit varsa kaç, acıkınca beslen/avlan, yoksa keşfet. */
export function defaultBrain(): number[] {
  const w = new Array<number>(IN * BRAIN_ACTIONS.length).fill(0);
  const set = (action: number, input: number, value: number): void => void (w[action * IN + input] = value);
  set(ACT.flee, 2, 6);
  set(ACT.flee, 1, -1);
  set(ACT.forage, 0, 0.6);
  set(ACT.forage, 1, 2);
  set(ACT.forage, 3, 0.6);
  set(ACT.hunt, 1, 2);
  set(ACT.hunt, 4, 0.8);
  set(ACT.hunt, 7, -1);
  set(ACT.rest, 0, -0.4);
  set(ACT.rest, 7, 1.2);
  set(ACT.explore, 0, 0.4);
  return w;
}

// ---------------------------------------------------------------- hücrenin kimyası

/**
 * Her hücrenin duvarı, zarı, kalıtım polimeri, enerji taşıyıcısı ve katalizör merkezi kendi genomundadır.
 * İlk hücre gezegenin seçtiği yapıyla başlar; uzun sürede yavrular, gezegenin elementlerinin kurmaya
 * yettiği başka bir seçeneğe geçebilir (gezegende bulunmayan elementi isteyen seçenek hiçbir zaman çıkmaz).
 * Etkiler verideki gerçek farklardan gelir: duvar can, hız ve metabolizmayı, kalıtım polimeri kopyalama
 * hatasını (mutasyon sıklığını) değiştirir; zar, enerji ve katalizör farkı ise nötrdür, yalnızca sürüklenir.
 */
export const CELL_KINDS = ["wall", "membrane", "genetic", "energy", "catalyst"] as const;
export type CellKind = (typeof CELL_KINDS)[number];

const CELL_TABLE: Record<CellKind, readonly Option[]> = { wall: WALLS, membrane: MEMBRANES, genetic: GENETICS, energy: ENERGIES, catalyst: CATALYSTS };

interface PlanetCell {
  def: Record<CellKind, string>;
  options: Record<CellKind, string[]>;
  error: number;
}
let planetCell: PlanetCell = {
  def: { wall: "none", membrane: "phospholipid", genetic: "phosphodiester", energy: "polyphosphate", catalyst: "fes" },
  options: { wall: ["none"], membrane: ["phospholipid"], genetic: ["phosphodiester"], energy: ["polyphosphate"], catalyst: ["fes"] },
  error: 0.9,
};

/** Gezegenin elementlerinin (ana ve iz) kurmaya yettiği seçenekleri ve ilk hücrenin yapısını belirler. */
export function setPlanetCell(chem: Chemistry): void {
  const syms = new Set<string>(["H", ...chem.elements.map((e) => e.sym), ...chem.trace.map((t) => t.sym)]);
  const fits = (o: Option): boolean => o.needs.every((n) => syms.has(n));
  const ids = (list: readonly Option[], extra: (o: Option) => boolean = () => true): string[] => list.filter((o) => fits(o) && extra(o)).map((o) => o.id);
  const def: Record<CellKind, string> = { wall: "none", membrane: chem.membrane.id, genetic: chem.genetic.id, energy: chem.energy.id, catalyst: chem.catalyst.id };
  const options: Record<CellKind, string[]> = {
    wall: ids(WALLS),
    membrane: ids(MEMBRANES, (o) => {
      const m = o as (typeof MEMBRANES)[number];
      return (m.polar === null || m.polar === chem.solvent.polar) && (m.scaffold === undefined || m.scaffold === chem.scaffold.id || (chem.scaffold.id === "boron" && m.scaffold === "carbon" && syms.has("C")));
    }),
    genetic: ids(GENETICS, (o) => (chem.scaffold.id === "silicon" ? o.id === "polysilane" || o.id === "clay" || o.id === "compositional" : o.id !== "polysilane")),
    energy: ids(ENERGIES),
    catalyst: ids(CATALYSTS),
  };
  for (const k of CELL_KINDS) if (!options[k].includes(def[k])) options[k].push(def[k]);
  planetCell = { def, options, error: chem.genetic.error };
}

/** Bu gezegende bir yapı türü için seçilebilen seçenekler. */
export function cellChoices(kind: CellKind): readonly string[] {
  return planetCell.options[kind];
}

export function cellOption(kind: CellKind, id: string): Option | undefined {
  return CELL_TABLE[kind].find((o) => o.id === id);
}

/** Bir hücrenin duvarının çarpanları (verideki gerçek farklar). */
export function wallStats(g: { wall: string }): { hp: number; speed: number; meta: number } {
  const w = WALLS.find((o) => o.id === g.wall);
  return w ? { hp: w.hp, speed: w.speed, meta: w.meta } : { hp: 1, speed: 1, meta: 1 };
}

/** Bir hücrenin kopyalama hatasının gezegenin ilk polimerine oranı: mutasyon sıklığını ölçekler. */
function copyErrorRatio(g: { genetic: string }): number {
  const o = GENETICS.find((x) => x.id === g.genetic);
  return o ? o.error / planetCell.error : 1;
}

/** Tek bir mutasyonda yapı değiştirme olasılığı: yapısal yeniliklerin en nadirlerindendir. */
const CELL_SWITCH_CHANCE = 0.004;

// ---------------------------------------------------------------- genom

export interface Genome {
  id: number;
  parentIds: [number, number] | null;
  generation: number;
  speciesId: number;

  /** Örgütlenme düzeyi: 0 tek hücre, 1 koloni, 2 çok hücreli. */
  stage: number;
  radius: number;
  hue: number;
  saturation: number;
  lightness: number;

  moveSpeed: number;
  senseRadius: number;
  metabolism: number;
  divideEnergyFraction: number;
  maxLifespan: number;
  /** Erkekte ifade edilen süs: eş seçiminde çekicilik, karşılığında maliyet. */
  ornament: number;
  /** Parazitin emiş gücü çarpanı: çok emen konağını tüketir ve erken atılır, az emen aç kalır. */
  virulence: number;
  /** Hepçil ve çürükçülde sindirimin yönü: 0 ete, 1 bitkiye uzmanlaşmış; ikisi birden en iyi olamaz. */
  gutBias: number;

  /** Hücre kimyası: seçenek kimlikleri (bkz. CELL_KINDS). */
  wall: string;
  membrane: string;
  genetic: string;
  energy: string;
  catalyst: string;

  organs: Organ[];
  brain: number[];
  reproductionStrategy: "asexual" | "sexual";
  /** Kalıtılmaz; her doğumda rastgele atanır. Yalnızca eşeyli türlerde anlamlıdır. */
  sex: "f" | "m";
  laysEggs: boolean;
  diet: Diet;
  packHunter: boolean;
}

type NumericGene = "radius" | "saturation" | "lightness" | "moveSpeed" | "senseRadius" | "metabolism" | "divideEnergyFraction" | "maxLifespan" | "ornament" | "virulence" | "gutBias";

export const GENE_BOUNDS: Record<NumericGene, [number, number]> = {
  radius: [3, 12],
  saturation: [25, 90],
  lightness: [30, 78],
  moveSpeed: [10, 55],
  senseRadius: [25, 130],
  metabolism: [0.5, 2.2],
  divideEnergyFraction: [0.7, 0.99],
  maxLifespan: [90, 500],
  ornament: [0, 1],
  virulence: [0.3, 2.5],
  gutBias: [0, 1],
};
const NUMERIC_GENES = Object.keys(GENE_BOUNDS) as NumericGene[];

/** Beden büyüklüğü örgütlenme düzeyiyle sınırlıdır. */
export const STAGE_RADIUS: readonly [number, number][] = [
  [3, 6.5],
  [4, 9],
  [5.5, 12],
];

// Taban oranlar "Hızlı" evrim kademesidir. Sayısal kaymalar (beden, hız, karar ağı) ve
// yapısal yenilikler (yeni organ, beslenme biçimi, örgütlenme düzeyi, üreme biçimi) ayrı
// ölçeklenir: yavaş kademeler yapısal değişiklikleri sayısal kaymalardan daha çok kısar.
const MUTATION_CHANCE = 0.25;
const MUTATION_STRENGTH = 0.12;
const NEW_ORGAN_CHANCE = 0.05;
const ORGAN_LOSS_CHANCE = 0.006;
const ORGAN_POWER_MUTATION_CHANCE = 0.3;
const ORGAN_POWER_MUTATION_STRENGTH = 0.15;
const STRATEGY_FLIP_CHANCE = 0.03;
const LAYS_EGGS_FLIP_CHANCE = 0.03;
const DIET_FLIP_CHANCE = 0.035;
const PACK_HUNTER_FLIP_CHANCE = 0.035;
const STAGE_UP_CHANCE = 0.014;
const STAGE_DOWN_CHANCE = 0.002;
const BRAIN_MUTATION_CHANCE = 0.06;
const BRAIN_MUTATION_STRENGTH = 0.35;

export type EvolutionSpeed = "fast" | "medium" | "slow";
export const EVOLUTION_SPEEDS: readonly EvolutionSpeed[] = ["fast", "medium", "slow"];
export const EVOLUTION_LABEL: Record<EvolutionSpeed, string> = { fast: "Hızlı", medium: "Orta", slow: "Gerçekçi (yavaş)" };
/** Kademe çarpanları: [sayısal kaymanın sıklığı, sayısal kaymanın büyüklüğü, yapısal değişikliğin sıklığı]. */
const EVOLUTION_SCALE: Record<EvolutionSpeed, [number, number, number]> = { fast: [1, 1, 1], medium: [0.7, 0.75, 0.5], slow: [0.5, 0.5, 0.2] };

/**
 * Mutasyon ölçeği iki kaynağın çarpımıdır: seçilen evrim kademesi ve gezegenin kalıtım
 * polimerinin kopyalama hatası (bkz. chemistry.ts). Hata çarpanı sıklıkları ölçekler,
 * kaymanın büyüklüğünü değiştirmez.
 */
let numericScale = 1;
let strengthScale = 1;
let structuralScale = 1;
export function setMutationScale(speed: EvolutionSpeed, copyError: number): void {
  const [chance, strength, structural] = EVOLUTION_SCALE[speed];
  numericScale = chance * copyError;
  strengthScale = strength;
  structuralScale = structural * copyError;
}

const STRESS_ENERGY_THRESHOLD = 0.3;
const STRESS_MUTATION_BOOST = 1.0;

/** Stres altındaki ebeveynin yavrusunda diyet değişirse hangi diyete kayacağının
 *  ağırlıkları. Gerçek biyolojide karşılığı olan bir mekanizma DEĞİLDİR (mutasyonun
 *  yönü ihtiyaca göre belirlenmez); özgün projedeki bilinçli bir simülasyon tercihinin
 *  devamıdır. Stressiz ebeveynde tüm diyetler eşit olasılıklıdır. */
const STRESS_DIET_WEIGHT: Record<Diet, number> = { carnivore: 3, omnivore: 3, scavenger: 2, parasite: 2, herbivore: 1, filter_feeder: 1, phototroph: 1, chemotroph: 1 };

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function randomGenome(id: number): Genome {
  return {
    id,
    parentIds: null,
    generation: 0,
    speciesId: 0,
    stage: 0,
    radius: rng.range(4, 6),
    hue: rng.range(0, 360),
    saturation: rng.range(45, 75),
    lightness: rng.range(45, 65),
    moveSpeed: rng.range(18, 38),
    senseRadius: rng.range(40, 90),
    metabolism: rng.range(0.8, 1.6),
    divideEnergyFraction: rng.range(0.85, 0.98),
    maxLifespan: rng.range(180, 320),
    ornament: rng.range(0, 0.2),
    virulence: 1,
    gutBias: 0.5,
    ...planetCell.def,
    organs: [],
    brain: defaultBrain(),
    reproductionStrategy: "asexual",
    sex: rng.chance(0.5) ? "f" : "m",
    laysEggs: false,
    diet: "chemotroph",
    packHunter: false,
  };
}

/** Bakteri SOS yanıtı benzeri: enerji oranı %30'un altındayken sayısal genlerin
 *  mutasyon olasılığı ve şiddeti doğrusal olarak en çok 2 katına çıkar. */
export function stressFactor(energy: number, maxEnergy: number): number {
  if (maxEnergy <= 0) return 1;
  const ratio = clamp(energy / maxEnergy, 0, 1);
  if (ratio >= STRESS_ENERGY_THRESHOLD) return 1;
  return 1 + ((STRESS_ENERGY_THRESHOLD - ratio) / STRESS_ENERGY_THRESHOLD) * STRESS_MUTATION_BOOST;
}

function pickOtherDiet(current: Diet, stressed: boolean): Diet {
  const candidates = DIETS.filter((d) => d !== current);
  let total = 0;
  for (const d of candidates) total += stressed ? STRESS_DIET_WEIGHT[d] : 1;
  let roll = rng.next() * total;
  for (const d of candidates) {
    roll -= stressed ? STRESS_DIET_WEIGHT[d] : 1;
    if (roll <= 0) return d;
  }
  return candidates[candidates.length - 1];
}

/** Genomu düzeyinin kısıtlarına uydurur: beden aralığı, organ düzeyi ve yuva sayısı. */
export function fitToStage(g: Genome): void {
  const [min, max] = STAGE_RADIUS[g.stage];
  g.radius = clamp(g.radius, min, max);
  g.organs = g.organs.filter((organ) => ORGANS[organ.type].stage <= g.stage);
  if (g.organs.length > ORGAN_SLOTS[g.stage]) g.organs.length = ORGAN_SLOTS[g.stage];
}

function mutate(g: Genome, stress: number): Genome {
  // Kopyalama hatası hücrenin kendi polimerine bağlıdır (gezegenin ilk polimerine göre oran).
  const k = copyErrorRatio(g);
  const nScale = numericScale * k;
  const chance = Math.min(1, MUTATION_CHANCE * stress * nScale);
  const strength = MUTATION_STRENGTH * stress * strengthScale;
  const rare = (p: number): boolean => rng.chance(Math.min(1, p * structuralScale * k));

  for (const key of NUMERIC_GENES) {
    if (rng.next() > chance) continue;
    const [min, max] = GENE_BOUNDS[key];
    g[key] = clamp(g[key] + (rng.next() - 0.5) * 2 * (max - min) * strength, min, max);
  }
  if (rng.next() < chance * 1.3) g.hue = (((g.hue + (rng.next() - 0.5) * 50) % 360) + 360) % 360;

  for (let i = 0; i < g.brain.length; i++) {
    if (rng.next() < BRAIN_MUTATION_CHANCE * nScale) g.brain[i] = clamp(g.brain[i] + (rng.next() - 0.5) * 2 * BRAIN_MUTATION_STRENGTH * strengthScale, -8, 8);
  }

  // Örgütlenme düzeyi: nadir, büyük bir geçiş. Geri dönüş daha da nadirdir.
  if (g.stage < 2 && rare(STAGE_UP_CHANCE)) g.stage++;
  else if (g.stage > 0 && rare(STAGE_DOWN_CHANCE)) g.stage--;

  for (const organ of g.organs) {
    if (rng.next() > ORGAN_POWER_MUTATION_CHANCE * nScale) continue;
    organ.power = clamp(organ.power + (rng.next() - 0.5) * 2 * ORGAN_POWER_MUTATION_STRENGTH * strengthScale, 0.05, 1);
  }
  // Organ kaybı: kullanılmayan yapıların körelmesi.
  if (g.organs.length > 0 && rare(ORGAN_LOSS_CHANCE)) g.organs.splice(rng.int(g.organs.length), 1);
  fitToStage(g);
  if (rare(NEW_ORGAN_CHANCE)) {
    const type = pickOrganType(g.organs, g.stage);
    if (type) g.organs.push({ type, power: rng.range(0.25, 0.6) });
  }

  if (rare(STRATEGY_FLIP_CHANCE)) g.reproductionStrategy = g.reproductionStrategy === "asexual" ? "sexual" : "asexual";
  // Yumurta, dış kabuklu ve besin depolu çok hücreli bir yapıdır: yalnızca çok hücreli
  // canlıda ortaya çıkabilir; düzey gerilerse kaybolur. Sürü avcılığı da öyle.
  if (g.stage < 2) {
    g.laysEggs = false;
    g.packHunter = false;
  } else {
    if (rare(LAYS_EGGS_FLIP_CHANCE)) g.laysEggs = !g.laysEggs;
    if (rare(PACK_HUNTER_FLIP_CHANCE)) g.packHunter = !g.packHunter;
  }
  if (rare(DIET_FLIP_CHANCE)) g.diet = pickOtherDiet(g.diet, stress > 1);
  for (const kind of CELL_KINDS) {
    if (!rare(CELL_SWITCH_CHANCE)) continue;
    const others = planetCell.options[kind].filter((id) => id !== g[kind]);
    if (others.length > 0) g[kind] = others[rng.int(others.length)];
  }
  g.sex = rng.chance(0.5) ? "f" : "m";
  return g;
}

/** Yaşayan bir bireyin genomunu yerinde mutasyona uğratır (radyasyon aracı): kimlik, soy ve tür korunur. */
export function irradiateGenome(g: Genome, stress = 3): Genome {
  const mutated = mutate(cloneGenome(g), stress);
  return { ...mutated, id: g.id, parentIds: g.parentIds, generation: g.generation, speciesId: g.speciesId, sex: g.sex };
}

/** Eşeysiz bölünme: ebeveynin kopyası + mutasyon. */
export function divideGenome(parent: Genome, id: number, stress = 1): Genome {
  return mutate({ ...cloneGenome(parent), id, parentIds: [parent.id, parent.id], generation: parent.generation + 1 }, stress);
}

/** Eşeyli üreme: sayısal genlerde ve karar ağında tekdüze çaprazlama, organlarda
 *  birleşim (ortak tiplerde güç ortalaması); sonra mutasyon. */
export function crossoverGenomes(a: Genome, b: Genome, id: number, stress = 1): Genome {
  const pick = <T,>(x: T, y: T): T => (rng.next() < 0.5 ? x : y);
  const byType = new Map<OrganType, Organ>();
  for (const organ of a.organs) byType.set(organ.type, { ...organ });
  for (const organ of b.organs) {
    const existing = byType.get(organ.type);
    byType.set(organ.type, existing ? { type: organ.type, power: (existing.power + organ.power) / 2 } : { ...organ });
  }
  const organs = Array.from(byType.values());
  for (let i = organs.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [organs[i], organs[j]] = [organs[j], organs[i]];
  }
  const child: Genome = {
    id,
    parentIds: [a.id, b.id],
    generation: Math.max(a.generation, b.generation) + 1,
    speciesId: a.speciesId,
    stage: pick(a.stage, b.stage),
    radius: pick(a.radius, b.radius),
    hue: pick(a.hue, b.hue),
    saturation: pick(a.saturation, b.saturation),
    lightness: pick(a.lightness, b.lightness),
    moveSpeed: pick(a.moveSpeed, b.moveSpeed),
    senseRadius: pick(a.senseRadius, b.senseRadius),
    metabolism: pick(a.metabolism, b.metabolism),
    divideEnergyFraction: pick(a.divideEnergyFraction, b.divideEnergyFraction),
    maxLifespan: pick(a.maxLifespan, b.maxLifespan),
    ornament: pick(a.ornament, b.ornament),
    virulence: pick(a.virulence, b.virulence),
    gutBias: pick(a.gutBias, b.gutBias),
    wall: pick(a.wall, b.wall),
    membrane: pick(a.membrane, b.membrane),
    genetic: pick(a.genetic, b.genetic),
    energy: pick(a.energy, b.energy),
    catalyst: pick(a.catalyst, b.catalyst),
    organs,
    brain: a.brain.map((w, i) => pick(w, b.brain[i] ?? w)),
    reproductionStrategy: pick(a.reproductionStrategy, b.reproductionStrategy),
    sex: "f",
    laysEggs: pick(a.laysEggs, b.laysEggs),
    diet: pick(a.diet, b.diet),
    packHunter: pick(a.packHunter, b.packHunter),
  };
  fitToStage(child);
  return mutate(child, stress);
}

const DISTANCE_GENES: NumericGene[] = ["radius", "moveSpeed", "senseRadius", "metabolism", "maxLifespan", "virulence", "gutBias"];

/**
 * İki genom arasındaki genetik uzaklık (0 = özdeş). Tür kavramının tek ölçütü:
 * bir yavru, türünün tip örneğinden `SPECIATION_DISTANCE`'tan daha uzaksa yeni bir
 * tür kurar; farklı türler çiftleşemez (üreme izolasyonu).
 *  - sayısal genler: sınır aralığına oranlanmış ortalama mutlak fark
 *  - organlar: yalnızca birinde bulunan her tip için 0,10
 *  - diyet farkı 0,50 · örgütlenme düzeyi farkı 0,50 (her biri tek başına türleşme)
 *  - karar ağı: ağırlıkların ortalama mutlak farkı × 0,5 (en çok 0,2)
 *  - üreme stratejisi 0,08 · yumurtlama 0,05
 */
export function geneticDistance(a: Genome, b: Genome): number {
  let d = 0;
  for (const k of DISTANCE_GENES) {
    const [min, max] = GENE_BOUNDS[k];
    d += Math.abs(a[k] - b[k]) / (max - min);
  }
  d /= DISTANCE_GENES.length;
  let organDiff = 0;
  for (const organ of a.organs) if (!b.organs.some((p) => p.type === organ.type)) organDiff++;
  for (const organ of b.organs) if (!a.organs.some((p) => p.type === organ.type)) organDiff++;
  d += organDiff * 0.1;
  let brainDiff = 0;
  for (let i = 0; i < a.brain.length; i++) brainDiff += Math.abs(a.brain[i] - (b.brain[i] ?? 0));
  d += Math.min(0.2, (brainDiff / a.brain.length) * 0.5);
  if (a.diet !== b.diet) d += 0.5;
  d += Math.abs(a.stage - b.stage) * 0.5;
  if (a.reproductionStrategy !== b.reproductionStrategy) d += 0.08;
  if (a.laysEggs !== b.laysEggs) d += 0.05;
  for (const kind of CELL_KINDS) if (a[kind] !== b[kind]) d += 0.04;
  return d;
}

/**
 * Dışarıdan gelen (kayıt dosyası, yapıştırılan metin) bir genomu güvenli hâle
 * getirir: her alan beklenen türe ve aralığa zorlanır, tanınmayan değerler atılır.
 * Kayıtlar güvenilmez girdidir; arayüz bu değerleri sayfaya yazar.
 */
export function sanitizeGenome(raw: unknown): Genome {
  const r = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown, min: number, max: number, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? clamp(v, min, max) : fallback);
  const int = (v: unknown, max = 2 ** 31): number => Math.floor(num(v, 0, max, 0));
  const organs: Organ[] = [];
  if (Array.isArray(r.organs)) {
    for (const o of r.organs as Record<string, unknown>[]) {
      const type = o && typeof o.type === "string" && Object.prototype.hasOwnProperty.call(ORGANS, o.type) ? (o.type as OrganType) : null;
      if (type && !organs.some((x) => x.type === type)) organs.push({ type, power: num(o.power, 0.05, 1, 0.3) });
    }
  }
  const cellId = (kind: CellKind, v: unknown): string => (typeof v === "string" && CELL_TABLE[kind].some((o) => o.id === v) ? v : planetCell.def[kind]);
  const brain = defaultBrain();
  if (Array.isArray(r.brain) && r.brain.length === OLD_IN * OLD_ACTIONS) {
    // Eski düzen (sürüm 8 öncesi): ağırlıklar yeni ızgaraya taşınır; yeni girdi ve satırlar 0 kalır.
    for (let a = 0; a < OLD_ACTIONS; a++) for (let i = 0; i < OLD_IN; i++) brain[a * IN + i] = num(r.brain[a * OLD_IN + i], -8, 8, brain[a * IN + i]);
  } else if (Array.isArray(r.brain)) for (let i = 0; i < brain.length; i++) brain[i] = num(r.brain[i], -8, 8, brain[i]);
  const parents = Array.isArray(r.parentIds) && r.parentIds.length === 2 ? ([int(r.parentIds[0]), int(r.parentIds[1])] as [number, number]) : null;
  const g: Genome = {
    id: int(r.id),
    parentIds: parents,
    generation: int(r.generation),
    speciesId: int(r.speciesId),
    stage: int(r.stage, 2),
    radius: num(r.radius, ...GENE_BOUNDS.radius, 5),
    hue: num(r.hue, 0, 360, 180),
    saturation: num(r.saturation, ...GENE_BOUNDS.saturation, 60),
    lightness: num(r.lightness, ...GENE_BOUNDS.lightness, 55),
    moveSpeed: num(r.moveSpeed, ...GENE_BOUNDS.moveSpeed, 28),
    senseRadius: num(r.senseRadius, ...GENE_BOUNDS.senseRadius, 65),
    metabolism: num(r.metabolism, ...GENE_BOUNDS.metabolism, 1),
    divideEnergyFraction: num(r.divideEnergyFraction, ...GENE_BOUNDS.divideEnergyFraction, 0.9),
    maxLifespan: num(r.maxLifespan, ...GENE_BOUNDS.maxLifespan, 250),
    ornament: num(r.ornament, ...GENE_BOUNDS.ornament, 0),
    virulence: num(r.virulence, ...GENE_BOUNDS.virulence, 1),
    gutBias: num(r.gutBias, ...GENE_BOUNDS.gutBias, 0.5),
    wall: cellId("wall", r.wall),
    membrane: cellId("membrane", r.membrane),
    genetic: cellId("genetic", r.genetic),
    energy: cellId("energy", r.energy),
    catalyst: cellId("catalyst", r.catalyst),
    organs,
    brain,
    reproductionStrategy: r.reproductionStrategy === "sexual" ? "sexual" : "asexual",
    sex: r.sex === "m" ? "m" : "f",
    laysEggs: r.laysEggs === true,
    diet: DIETS.includes(r.diet as Diet) ? (r.diet as Diet) : "herbivore",
    packHunter: r.packHunter === true,
  };
  fitToStage(g);
  return g;
}

export function cloneGenome(g: Genome): Genome {
  return { ...g, parentIds: g.parentIds ? [g.parentIds[0], g.parentIds[1]] : null, organs: g.organs.map((organ) => ({ ...organ })), brain: g.brain.slice() };
}
