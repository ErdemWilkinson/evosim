import { rng } from "./rng";
import { ACT, BRAIN_ACTIONS, Diet, DIETS, DIET_LABEL, Genome, IN, cloneGenome, crossoverGenomes, divideGenome, fitToStage, geneticDistance, randomGenome, sanitizeGenome, stressFactor } from "./genome";
import { ORGANS, ORGAN_TYPES, Organ, OrganType, STAGE_LABEL, canHostOrgan, organPower, setForbiddenOrgans } from "./organs";
import { Band, MAP_H, MAP_W, World } from "./world";
import { PlanetProfile, generatePlanetProfile } from "./planet";
import { makeEpithet, makeGenus } from "./taxonomy";

/**
 * Simülasyon çekirdeği. DOM'a ya da çizime hiç dokunmaz: tarayıcıda bir Web Worker
 * içinde, Node'da ise doğrudan (bkz. scripts/balance.mjs) aynı kod çalışır.
 * Sabit adımlıdır (`STEP` saniye).
 */

export const STEP = 1 / 30;
export const MAX_CREATURES = 480;
/** Bütün yaşam tek bir ortak atadan türer. */
const INITIAL_CREATURES = 1;

// --- Zaman: gün ve yıl ---
export const DAY_LENGTH = 90;
export const YEAR_LENGTH = 480;
export const SEASON_LABEL = ["İlkbahar", "Yaz", "Sonbahar", "Kış"] as const;
const NIGHT_LIGHT = 0.25;
const SEASON_GROWTH_SWING = 0.4;
const WINTER_COLD_STRESS = 0.12;

// --- Bitki örtüsü (birincil üretim): yerel lojistik büyüme + tohum yağmuru ---
const PLANT_ENERGY = 14;
const PLANT = {
  water: { capacity: 620, growth: 0.1, seed: 6 },
  land: { capacity: 420, growth: 0.09, seed: 3 },
};
const PLANT_SPREAD: [number, number] = [16, 70];
/** Yerel taşıma kapasitesi: bu yarıçapta bu kadar bitki varsa yenisi tutunamaz. */
const PLANT_CROWD_RADIUS = 40;
const PLANT_CROWD_LIMIT = 2;
const DEEP_WATER_PLANT_CHANCE = 0.35;

// --- Üreme ---
const DIVIDE_COOLDOWN: [number, number] = [4, 8];
const DIVIDE_COST = 0.5;
const NEWBORN_ENERGY = 0.5;
const JUVENILE_AGE = 10;
const MATING_RADIUS = 70;
const MATE_WAIT_BEFORE_SELFING = 12;
const FEMALE_COST = 0.4;
const MALE_COST = 0.1;
const ORNAMENT_METABOLISM = 0.15;
const ORNAMENT_VISIBILITY = 0.4;
const EGG_INCUBATION: [number, number] = [8, 15];
/** r/K: avcılar daha yüksek eşikte ve daha seyrek ürer. */
const DIET_DIVIDE_THRESHOLD: Record<Diet, number> = { carnivore: 1.15, omnivore: 1.05, scavenger: 1.05, parasite: 1, herbivore: 1, filter_feeder: 1, phototroph: 1 };
const DIET_DIVIDE_COOLDOWN: Record<Diet, number> = { carnivore: 2.5, omnivore: 1.2, scavenger: 1.1, parasite: 1.4, herbivore: 1, filter_feeder: 1, phototroph: 1.3 };
const STAGE_COOLDOWN = 0.25;
const STAGE_METABOLISM = 0.05;
const PARENTAL_CARE_RADIUS = 50;
const PARENTAL_CARE_SECONDS = 20;
const PARENTAL_CARE_DISCOUNT = 0.3;

// --- Beslenme biçimleri ---
const FILTER_RADIUS = 70;
const FILTER_RATE = 3;
const FILTER_SATURATION = 4;
/** Süzücü, kazandığı her bu kadar enerji için çevresinden bir bitki tüketir. */
const FILTER_ENERGY_PER_PLANT = 13;
const PHOTO_RATE = 3;
const PHOTO_SHADE_RADIUS = 110;
const PHOTO_SHADE_PER_NEIGHBOR = 0.6;
const PHOTO_LIGHT = { land: 1, shallow: 0.75, deep: 0.2 };
const SCAVENGE_RATE = 14;
const SCAVENGE_EFFICIENCY = 0.7;
const SCAVENGER_PLANT_EFFICIENCY = 0.45;
const OMNIVORE_PLANT_EFFICIENCY = 0.65;
const OMNIVORE_ATTACK = 0.7;
const CHEMO_RATE = [0.25, 0.35];
const PARASITE_DRAIN = 1.5;
const PARASITE_EFFICIENCY = 0.7;
const PARASITES_PER_HOST = 3;
/** Konak, tutunan paraziti bu kadar saniye sonra atar; bağışıklık organı süreyi kısaltır. */
const PARASITE_HOLD = 60;
/** Parazitini atan konak bu süre boyunca yeniden tutunmaya dirençlidir. */
const PARASITE_RESISTANCE = 45;
const PARASITE_REATTACH_DELAY = 3;
const REST_METABOLISM = 0.85;

// --- Avlanma ---
const ATTACK_INTERVAL = 0.8;
const HUNT_METABOLISM = 1.5;
const HANDLING_TIME = 5;
const ALARM_DISTANCE = 30;
const PREY_SIZE_LIMIT: Record<"carnivore" | "omnivore", number> = { carnivore: 1.35, omnivore: 0.9 };
const CANNIBALISM_ENERGY = 0.2;
const TERRITORY_RADIUS = 100;
const TERRITORY_COST_PER_RIVAL = 0.25;
const TERRITORY_COST_MAX = 1.25;
const PACK_RADIUS = 80;
const PACK_BONUS_PER_ALLY = 0.08;
const PACK_BONUS_MAX = 0.35;
/** Bir canlının bedeni, enerjisine ek olarak bu kadar (maxEnergy oranı) yapısal
 *  biyokütle taşır. Avcı öldürdüğü avın biyokütlesinin en çok %40'ını alır; kalanı
 *  ceset olur. Trofik piramit, avın yediğinin çoğunu yakmış olmasından doğar. */
const STRUCTURAL_BIOMASS = 0.25;
const ASSIMILATION = 0.4;

// --- Hastalık (konağa özgü, yoğunluğa bağlı) ---
const OUTBREAK_CHECK = 5;
const OUTBREAK_DENSITY = 90;
const INFECTION_RADIUS = 16;
const INFECTION_CHANCE = 0.22;
const INFECTION_DURATION = 30;
const INFECTION_METABOLISM = 1.5;
const IMMUNITY_DURATION = 90;

// --- Ölüm, ceset, yatay gen transferi ---
const SENESCENCE_START = 0.8;
const SENESCENCE_MAX_RATE = 0.002;
const CORPSE_LIFETIME = 30;
const CORPSE_PLANT_CHANCE = 0.4;
const HGT_RADIUS = 18;
const HGT_INTERVAL = 1;
const HGT_CHANCE = 0.01;
const HGT_COOLDOWN = 25;

// --- Türleşme ---
export const SPECIATION_DISTANCE = 0.45;
const SISTER_JOIN_DISTANCE = 0.27;
const ESTABLISHED_COUNT = 5;

// --- Dünya olayları ---
const EVENT_CHECK_INTERVAL = 8;
const EVENT_CHANCE = { meteor: 0.018, climate: 0.02, wind: 0.03, quake: 0.015 };

// --- Kurtarma etkisi (metapopülasyon) ---
const RESCUE_THRESHOLD = 8;
const RESCUE_INTERVAL = 15;
const RESCUE_GROUP = 5;

const THINK_INTERVAL = 0.22;
const HISTORY_CAP = 720;
const LINEAGE_CAP = 9000;
const EVENT_LOG_CAP = 240;
const SERIES_CAP = 240;

export type Behavior = "wander" | "seek" | "flee" | "hunt" | "scavenge" | "graze" | "bask" | "escape" | "rest" | "attached";
export type DeathCause = "starvation" | "old_age" | "predation" | "venom" | "meteor" | "disease" | "removed";
export type WorldEventKind = "meteor" | "climate" | "wind" | "quake";
export type EventKind = "organ" | "diet" | "species" | "world" | "population" | "gene" | "stage" | "disease";

export const BEHAVIORS: readonly Behavior[] = ["wander", "seek", "flee", "hunt", "scavenge", "graze", "bask", "escape", "rest", "attached"];

export const BEHAVIOR_LABEL: Record<Behavior, string> = {
  wander: "keşfediyor",
  seek: "besine gidiyor",
  flee: "kaçıyor",
  hunt: "avlanıyor",
  scavenge: "ceset yiyor",
  graze: "süzüyor",
  bask: "ışık topluyor",
  escape: "elverişsiz araziden çıkıyor",
  rest: "dinleniyor",
  attached: "konağa tutunmuş",
};

export const DEATH_LABEL: Record<DeathCause, string> = {
  starvation: "açlık",
  old_age: "yaşlılık",
  predation: "avlandı",
  venom: "zehirlendi",
  meteor: "meteor",
  disease: "hastalık",
  removed: "elle kaldırıldı",
};

/** Organlardan ve genlerden türetilen değerler. Organ açıklamalarının tek kaynağı. */
export interface Derived {
  base: number;
  swim: number;
  walk: number;
  sense: number;
  eyes: number;
  biolum: number;
  smell: number;
  lateral: number;
  electro: boolean;
  feed: number;
  meta: number;
  attack: number;
  resist: number;
  venom: number;
  miss: number;
  ink: number;
  mucus: number;
  camo: number;
  regen: number;
  chemo: number;
  filter: number;
  photo: number;
  sprint: number;
  windGrip: number;
  immune: number;
  bladder: number;
  brood: number;
  canLand: boolean;
  canDeep: boolean;
  wing: boolean;
}

/** Gezegen kimyasının çarpanları (bkz. chemistry.ts); simülasyon kurulurken atanır. */
let chemMods = { metabolism: 1, speed: 1, hp: 1, plant: 1 };

export function derive(g: Genome): Derived {
  const p = (t: OrganType): number | undefined => organPower(g.organs, t);
  const fin = p("fin");
  const leg = p("leg");
  const wing = p("wing");
  const shell = p("shell");
  const heart = p("heart");
  const nitro = p("nitrogen_sac");
  const mouth = p("mouth");
  const stomach = p("stomach");
  const gut = p("symbiotic_gut_flora");
  const regen = p("regeneration");
  const val = (v: number | undefined, a: number, b: number): number => (v === undefined ? 0 : a + v * b);

  // Pleiotropi: büyük beden yavaştır (üs −0,2) ama Kleiber yasasıyla birim kütle
  // başına daha az harcar (üs −0,25). İkisi aynı referans yarıçapı (5,5) kullanır.
  const base = g.moveSpeed * Math.pow(g.radius / 5.5, -0.2) * chemMods.speed;
  let meta = Math.pow(g.radius / 5.5, -0.25) * (1 + STAGE_METABOLISM * g.stage) * chemMods.metabolism;
  if (shell !== undefined) meta *= 1 + shell * 0.2;
  if (heart !== undefined) meta *= 1 - (0.1 + heart * 0.15);
  if (nitro !== undefined) meta *= 1 - (0.08 + nitro * 0.12);
  if (g.reproductionStrategy === "sexual" && g.sex === "m") meta *= 1 + ORNAMENT_METABOLISM * g.ornament;

  let feed = 1;
  if (mouth !== undefined) feed *= 1.2 + mouth * 0.4;
  if (stomach !== undefined) feed *= 1.1 + stomach * 0.2;
  if (gut !== undefined) feed *= 1.05 + gut * 0.1;

  return {
    base,
    swim: base * (1 + (fin ?? 0) * 0.9 + (p("tentacle") ?? 0) * 0.3),
    walk: leg !== undefined ? base * (0.6 + leg * 1.1) * (1 + (wing ?? 0) * 0.25) : 0,
    sense: g.senseRadius,
    eyes: val(p("eyespot"), 15, 20) + val(p("eye"), 35, 55),
    biolum: val(p("bioluminescence"), 20, 30),
    smell: 1 + val(p("olfactory"), 0.4, 0.6),
    lateral: 1 + val(p("lateral_line"), 0.5, 0.5),
    electro: p("electroreceptor") !== undefined,
    feed,
    meta: Math.max(0.15, meta),
    attack: 2.5 + g.radius * 0.25 + (p("claw") ?? 0) * 5,
    resist: Math.max(0.3, 1 - Math.min(0.7, (shell ?? 0) * 0.3 + (p("spike") ?? 0) * 0.25)),
    venom: val(p("venom"), 0.8, 2.2),
    miss: val(p("chromatophore"), 0.15, 0.3),
    ink: val(p("ink_sac"), 0.3, 0.3),
    mucus: val(p("mucus_coat"), 0.4, 0.4),
    camo: val(p("camouflage"), 0.2, 0.3),
    regen: regen === undefined ? 1 : 2 + regen * 3,
    chemo: val(p("sulfur_vent_organ"), CHEMO_RATE[0], CHEMO_RATE[1]),
    filter: 1 + val(p("filter_comb"), 0.4, 0.6),
    photo: 1 + val(p("pigment"), 0.25, 0.35),
    sprint: val(p("sprint_muscle"), 0.2, 0.3),
    windGrip: val(p("sucker"), 0.6, 0.4),
    immune: val(p("immune_gland"), 0.4, 0.4),
    bladder: val(p("swim_bladder"), 0.1, 0.15),
    brood: val(p("brood_pouch"), 0.2, 0.3),
    canLand: leg !== undefined,
    canDeep: leg === undefined || fin !== undefined || p("gill") !== undefined,
    wing: wing !== undefined,
  };
}

export function maxEnergyOf(g: Genome): number {
  const fat = organPower(g.organs, "fat_store");
  return (40 + g.radius * 8) * (fat === undefined ? 1 : 1.2 + fat * 0.3);
}

export function maxHpOf(g: Genome): number {
  return (g.radius * 1.6 + (organPower(g.organs, "shell") ?? 0) * 4) * chemMods.hp;
}

export interface Creature {
  id: number;
  g: Genome;
  /** Genom yaşarken değiştiğinde (yatay gen transferi, elle düzenleme) artar. */
  gv: number;
  d: Derived;
  x: number;
  y: number;
  heading: number;
  energy: number;
  maxEnergy: number;
  hp: number;
  maxHp: number;
  age: number;
  alive: boolean;
  onLand: boolean;
  state: Behavior;
  tC: Creature | null;
  tN: Nutrient | null;
  tK: Corpse | null;
  host: Creature | null;
  hostAngle: number;
  parasites: number;
  attachT: number;
  resistT: number;
  passive: number;
  filterDebt: number;
  crowd: number;
  senseNow: number;
  thinkT: number;
  wanderT: number;
  blockedT: number;
  divideCd: number;
  attackCd: number;
  hgtCd: number;
  readyT: number;
  careT: number;
  infectedT: number;
  immuneT: number;
  parent: Creature | null;
  bornT: number;
  flashT: number;
  hurtT: number;
}

export interface Nutrient {
  x: number;
  y: number;
  land: boolean;
  age: number;
  dead: boolean;
}

export interface Corpse {
  x: number;
  y: number;
  r: number;
  hue: number;
  energy: number;
  energy0: number;
  age: number;
  life: number;
  organs: Organ[];
  stage: number;
}

export interface Egg {
  x: number;
  y: number;
  g: Genome;
  t: number;
  parentIds: [number, number];
  parentGenomes: Genome[];
  bonus: number;
}

export interface Species {
  id: number;
  name: string;
  genus: string;
  parentId: number;
  born: number;
  extinct: number;
  count: number;
  peak: number;
  total: number;
  established: boolean;
  /** Tip örneği: kurucunun genomu. Türe aidiyet buna uzaklıkla ölçülür. */
  type: Genome;
  reason: string;
  /** Popülasyon serisi: [zaman, birey] çiftleri düz dizide. */
  series: number[];
  infected: number;
}

export interface LineageRec {
  id: number;
  p1: number;
  p2: number;
  gen: number;
  sp: number;
  born: number;
  died: number;
  cause: DeathCause | "";
  diet: Diet;
  organs: OrganType[];
  notes: string[];
}

export interface SimEvent {
  seq: number;
  t: number;
  kind: EventKind;
  text: string;
}

export interface HistorySample {
  t: number;
  diets: number[];
  nutrients: number;
  species: number;
  oxygen: number;
}

export interface Flash {
  x: number;
  y: number;
  r: number;
  kind: WorldEventKind;
  age: number;
}

export interface SpeciesStats {
  id: number;
  members: number;
  radius: number;
  speed: number;
  sense: number;
  metabolism: number;
  generation: [number, number];
  onLand: number;
  sexual: number;
  males: number;
  ornament: number;
  infected: number;
  organs: { type: OrganType; count: number; power: number }[];
  brain: number[];
  series: number[];
  children: number[];
}

export interface Inspection {
  id: number;
  alive: boolean;
  rec: LineageRec | null;
  chain: number;
  oldestBorn: number;
  history: { gen: number; notes: string[] }[];
  means: { speed: number; sense: number; metabolism: number; radius: number } | null;
}

class Hash<T extends { x: number; y: number }> {
  private readonly cols: number;
  private readonly rows: number;
  private readonly cells: T[][];
  constructor(private readonly size: number) {
    this.cols = Math.ceil(MAP_W / size);
    this.rows = Math.ceil(MAP_H / size);
    this.cells = Array.from({ length: this.cols * this.rows }, () => []);
  }
  public clear(): void {
    for (const c of this.cells) c.length = 0;
  }
  public add(item: T): void {
    const cx = Math.min(this.cols - 1, Math.max(0, (item.x / this.size) | 0));
    const cy = Math.min(this.rows - 1, Math.max(0, (item.y / this.size) | 0));
    this.cells[cy * this.cols + cx].push(item);
  }
  public query(x: number, y: number, r: number, fn: (item: T) => void): void {
    const x0 = Math.max(0, ((x - r) / this.size) | 0);
    const x1 = Math.min(this.cols - 1, ((x + r) / this.size) | 0);
    const y0 = Math.max(0, ((y - r) / this.size) | 0);
    const y1 = Math.min(this.rows - 1, ((y + r) / this.size) | 0);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const cell = this.cells[cy * this.cols + cx];
        for (let i = 0; i < cell.length; i++) fn(cell[i]);
      }
    }
  }
}

function pct(v: number): string {
  return `%${Math.round(v * 100)}`;
}

const lower = (s: string): string => s.toLocaleLowerCase("tr");

export class Sim {
  public readonly world: World;
  public readonly planet: PlanetProfile;
  public time = 0;

  public creatures: Creature[] = [];
  public nutrients: Nutrient[] = [];
  public corpses: Corpse[] = [];
  public eggs: Egg[] = [];
  public flashes: Flash[] = [];

  public readonly species = new Map<number, Species>();
  public readonly lineage = new Map<number, LineageRec>();
  private lineageOrder: number[] = [];
  public events: SimEvent[] = [];
  public eventSeq = 0;
  public history: HistorySample[] = [];
  public sampleInterval = 2;

  public autoEvents = true;
  public rescueEnabled = true;
  public nutrientMultiplier = 1;
  public climate: { warm: boolean; meta: number; nutrient: number; left: number } | null = null;
  public wind: { vx: number; vy: number; angle: number; left: number } | null = null;
  public quakeLeft = 0;

  public births = 0;
  public immigrants = 0;
  public deaths: Record<DeathCause, number> = { starvation: 0, old_age: 0, predation: 0, venom: 0, meteor: 0, disease: 0, removed: 0 };
  public maxGeneration = 0;
  public extinct = false;

  private nextId = 1;
  private nextSpeciesId = 1;
  private plantAcc = { water: 0, land: 0 };
  private sampleT = 0;
  private evolutionT = 0;
  private hgtT = 0;
  private outbreakT = OUTBREAK_CHECK;
  private eventT = EVENT_CHECK_INTERVAL;
  private rescueT = RESCUE_INTERVAL;
  private newborns: Creature[] = [];
  private readonly cHash = new Hash<Creature>(64);
  private readonly nHash = new Hash<Nutrient>(64);
  /** Adım başına bir kez hesaplanan ortam değerleri. */
  private env = { light: 1, night: false, warmth: 0, oxygen: 0.5, cold: 0 };

  private flags: Record<string, boolean> = {};
  private organPeak: Partial<Record<OrganType, number>> = {};
  private organMilestone: Partial<Record<OrganType, number>> = {};

  constructor(seed: number, populate = true) {
    this.world = new World(seed);
    this.planet = generatePlanetProfile(this.world);
    setForbiddenOrgans(this.planet.forbiddenOrgans);
    chemMods = this.world.chem.mods;
    rng.seed(this.world.seed ^ 0x51ed270b);
    this.updateEnv();
    if (populate) this.populate();
  }

  // ------------------------------------------------------------------ ortam

  /** 0..1 gün ışığı: 90 saniyelik gün, kısa alacakaranlık geçişleri. */
  public light(): number {
    return Math.min(1, Math.max(0, 0.5 + 0.85 * Math.sin((this.time / DAY_LENGTH) * Math.PI * 2)));
  }

  /** −1 (kış ortası) … +1 (yaz ortası). Yıl ilkbaharla başlar. */
  public warmth(): number {
    return Math.sin((this.time / YEAR_LENGTH) * Math.PI * 2);
  }

  public season(): number {
    return Math.floor((((this.time / YEAR_LENGTH) % 1) + 0.125) * 4) % 4;
  }

  /** 0..1 oksijen seviyesi (0,5 nötr): 240 sn'lik yavaş bir salınım + iklim ofseti. */
  public oxygen(): number {
    const base = 0.5 + Math.sin((this.time / 240) * Math.PI * 2) * 0.12;
    const offset = this.climate ? (this.climate.warm ? -0.08 : 0.08) : 0;
    return Math.min(0.9, Math.max(0.1, base + offset));
  }

  private updateEnv(): void {
    const light = this.light();
    const warmth = this.warmth();
    this.env = { light, night: light < NIGHT_LIGHT, warmth, oxygen: this.oxygen(), cold: warmth < -0.3 ? ((-warmth - 0.3) / 0.7) * WINTER_COLD_STRESS : 0 };
  }

  // ------------------------------------------------------------------ kurulum

  private populate(): void {
    const founders: Genome[] = [];
    for (let i = 0; i < INITIAL_CREATURES; i++) founders.push(randomGenome(this.nextId++));
    // Köken senaryosu ilk hücrenin genlerine küçük bir iz bırakır (bkz. chemistry.ts).
    const tweak = this.world.chem.origin.founder;
    for (const g of founders) {
      g.radius *= tweak.radius ?? 1;
      g.moveSpeed *= tweak.moveSpeed ?? 1;
      g.senseRadius *= tweak.senseRadius ?? 1;
      g.maxLifespan *= tweak.maxLifespan ?? 1;
      g.metabolism = Math.min(g.metabolism * (tweak.metabolism ?? 1), 1);
    }
    const sp = this.createSpecies(founders[0], null, "ilk yaşam");
    sp.established = true;
    for (const g of founders) {
      g.speciesId = sp.id;
      const pos = this.randomPoint((x, y) => this.world.band(x, y) === Band.ShallowWater) ?? this.randomPoint((x, y) => this.world.isWater(x, y)) ?? { x: MAP_W / 2, y: MAP_H / 2 };
      const c = this.makeCreature(g, pos.x, pos.y, null);
      // İlk hücre dolu enerjiyle, besince zengin bir köşede ve ölçülü bir
      // metabolizmayla başlar: soyun ilk bölünmeye ulaşması şansa kalmasın.
      c.energy = c.maxEnergy;
      c.divideCd = 3;
      this.creatures.push(c);
      this.record(c, ["ilk canlı"]);
      this.addPlants(pos.x, pos.y, 14, 70);
      sp.count++;
      sp.total++;
    }
    sp.peak = sp.count;
    for (let i = 0; i < 130; i++) this.seedPlant(false);
    for (let i = 0; i < 60; i++) this.seedPlant(true);
    this.pushEvent("population", `İlk canlı sığ suda belirdi: organsız tek bir hücre (${sp.name}). Bundan sonraki bütün yaşam onun soyundan gelecek.`);
    this.sample();
  }

  private randomPoint(ok: (x: number, y: number) => boolean, tries = 60): { x: number; y: number } | null {
    for (let i = 0; i < tries; i++) {
      const x = rng.range(8, MAP_W - 8);
      const y = rng.range(8, MAP_H - 8);
      if (ok(x, y)) return { x, y };
    }
    return null;
  }

  private makeCreature(g: Genome, x: number, y: number, parent: Creature | null): Creature {
    const maxEnergy = maxEnergyOf(g);
    const maxHp = maxHpOf(g);
    return {
      id: g.id,
      g,
      gv: 0,
      d: derive(g),
      x,
      y,
      heading: rng.range(0, Math.PI * 2),
      energy: maxEnergy * NEWBORN_ENERGY,
      maxEnergy,
      hp: maxHp,
      maxHp,
      age: 0,
      alive: true,
      onLand: !this.world.isWater(x, y),
      state: "wander",
      tC: null,
      tN: null,
      tK: null,
      host: null,
      hostAngle: 0,
      parasites: 0,
      attachT: 0,
      resistT: 0,
      passive: 0,
      filterDebt: 0,
      crowd: 1,
      senseNow: g.senseRadius,
      thinkT: rng.range(0, THINK_INTERVAL),
      wanderT: rng.range(0.5, 2),
      blockedT: 0,
      divideCd: this.cooldown(g),
      attackCd: 0,
      hgtCd: 0,
      readyT: 0,
      careT: parent ? PARENTAL_CARE_SECONDS : 0,
      infectedT: 0,
      immuneT: 0,
      parent,
      bornT: 0.6,
      flashT: 0,
      hurtT: 0,
    };
  }

  private cooldown(g: Genome): number {
    return rng.range(DIVIDE_COOLDOWN[0], DIVIDE_COOLDOWN[1]) * DIET_DIVIDE_COOLDOWN[g.diet] * (1 + STAGE_COOLDOWN * g.stage);
  }

  /** Genom yaşarken değiştiyse türetilmiş değerleri yeniler. */
  private rederive(c: Creature): void {
    c.d = derive(c.g);
    c.maxEnergy = maxEnergyOf(c.g);
    c.maxHp = maxHpOf(c.g);
    c.energy = Math.min(c.energy, c.maxEnergy);
    c.hp = Math.min(c.hp, c.maxHp);
    c.gv++;
    const rec = this.lineage.get(c.id);
    if (rec) rec.organs = c.g.organs.map((organ) => organ.type);
  }

  // ------------------------------------------------------------------ olay günlüğü

  private pushEvent(kind: EventKind, text: string): void {
    this.events.push({ seq: ++this.eventSeq, t: this.time, kind, text });
    if (this.events.length > EVENT_LOG_CAP) this.events.splice(0, this.events.length - EVENT_LOG_CAP);
  }

  private once(flag: string, kind: EventKind, text: () => string): void {
    if (this.flags[flag]) return;
    this.flags[flag] = true;
    this.pushEvent(kind, text());
  }

  // ------------------------------------------------------------------ türler ve soy kaydı

  private createSpecies(founder: Genome, parent: Species | null, reason: string): Species {
    const id = this.nextSpeciesId++;
    const genus = parent && parent.type.diet === founder.diet ? parent.genus : makeGenus(this.world.seed, id);
    const taken = new Set<string>();
    for (const s of this.species.values()) taken.add(s.name);
    const name = `${genus} ${makeEpithet(this.world.seed, id, founder, parent ? parent.type : null, taken, genus)}`;
    const sp: Species = { id, name, genus, parentId: parent ? parent.id : 0, born: this.time, extinct: -1, count: 0, peak: 0, total: 0, established: false, type: cloneGenome(founder), reason, series: [], infected: 0 };
    this.species.set(id, sp);
    return sp;
  }

  /** Yavrunun türünü belirler: ebeveyn türünün tip örneğine yeterince yakınsa aynı
   *  tür; değilse yakın bir kardeş türe katılır ya da yeni bir tür kurar. */
  private assignSpecies(child: Genome, parentSp: Species, notes: string[]): Species {
    if (geneticDistance(child, parentSp.type) < SPECIATION_DISTANCE) return parentSp;
    let best: Species | null = null;
    let bestD = SISTER_JOIN_DISTANCE;
    for (const s of this.species.values()) {
      if (s.count === 0 || s === parentSp) continue;
      if (s.parentId !== parentSp.id && s.id !== parentSp.parentId) continue;
      const d = geneticDistance(child, s.type);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    if (best) return best;
    return this.createSpecies(child, parentSp, notes.length > 0 ? notes.join(", ") : "birikmiş genetik sürüklenme");
  }

  private record(c: Creature, notes: string[]): void {
    const g = c.g;
    this.lineage.set(g.id, {
      id: g.id,
      p1: g.parentIds ? g.parentIds[0] : 0,
      p2: g.parentIds ? g.parentIds[1] : 0,
      gen: g.generation,
      sp: g.speciesId,
      born: this.time,
      died: -1,
      cause: "",
      diet: g.diet,
      organs: g.organs.map((organ) => organ.type),
      notes,
    });
    this.lineageOrder.push(g.id);
    if (this.lineageOrder.length > LINEAGE_CAP) {
      // En eski ÖLÜ kayıtlar budanır; yaşayanların kaydı asla silinmez.
      const keep: number[] = [];
      let toDrop = this.lineageOrder.length - LINEAGE_CAP + 800;
      for (const id of this.lineageOrder) {
        const rec = this.lineage.get(id);
        if (toDrop > 0 && rec && rec.died >= 0) {
          this.lineage.delete(id);
          toDrop--;
        } else keep.push(id);
      }
      this.lineageOrder = keep;
    }
  }

  /** Bireyden geriye doğru ata zinciri (eşeyli üremede anne izlenir). */
  public ancestry(id: number, limit = 600): LineageRec[] {
    const chain: LineageRec[] = [];
    let rec = this.lineage.get(id);
    while (rec && chain.length < limit) {
      chain.push(rec);
      if (rec.p1 === 0 || rec.p1 === rec.id) break;
      rec = this.lineage.get(rec.p1);
    }
    return chain;
  }

  // ------------------------------------------------------------------ doğum

  private birthNotes(child: Genome, parents: Genome[]): string[] {
    const notes: string[] = [];
    for (const organ of child.organs) {
      if (!parents.some((p) => p.organs.some((q) => q.type === organ.type))) notes.push(`+${ORGANS[organ.type].label}`);
    }
    if (parents.length === 1) {
      for (const organ of parents[0].organs) if (!child.organs.some((q) => q.type === organ.type)) notes.push(`−${ORGANS[organ.type].label}`);
    }
    if (!parents.some((p) => p.stage === child.stage)) notes.push(`düzey → ${lower(STAGE_LABEL[child.stage])}`);
    if (!parents.some((p) => p.diet === child.diet)) notes.push(`diyet → ${lower(DIET_LABEL[child.diet])}`);
    if (!parents.some((p) => p.reproductionStrategy === child.reproductionStrategy)) notes.push(child.reproductionStrategy === "sexual" ? "eşeyli üreme" : "eşeysiz üremeye dönüş");
    if (!parents.some((p) => p.laysEggs === child.laysEggs)) notes.push(child.laysEggs ? "yumurtlama" : "canlı doğuma dönüş");
    if (!parents.some((p) => p.packHunter === child.packHunter) && child.packHunter) notes.push("sürü avcılığı");
    return notes;
  }

  private birth(g: Genome, x: number, y: number, parent: Creature | null, parentGenomes: Genome[], energyBonus = 0): void {
    const notes = this.birthNotes(g, parentGenomes);
    const parentSp = this.species.get(parentGenomes[0].speciesId);
    const sp = parentSp ? this.assignSpecies(g, parentSp, notes) : this.createSpecies(g, null, "bilinmeyen köken");
    g.speciesId = sp.id;

    const c = this.makeCreature(g, x, y, parent);
    c.energy = Math.min(c.maxEnergy, c.energy * (1 + energyBonus));
    this.newborns.push(c);
    this.record(c, notes);
    this.births++;
    if (g.generation > this.maxGeneration) this.maxGeneration = g.generation;
    this.enroll(sp);

    for (const organ of g.organs) {
      this.once(`organ:${organ.type}`, "organ", () => `İlk ${lower(ORGANS[organ.type].label)}: #${g.id} bireyinde mutasyonla ortaya çıktı (${g.generation}. nesil).`);
    }
    if (g.stage === 1) this.once("stage1", "stage", () => `İlk koloni: hücreler bölündükten sonra bir arada kaldı (#${g.id}). Yüzgeç, solungaç, kalp gibi organlar artık mümkün.`);
    if (g.stage === 2) this.once("stage2", "stage", () => `İlk çok hücreli canlı (#${g.id}). Göz, akciğer, bacak ve kanat artık mümkün: kara ulaşılabilir.`);
    if (g.diet !== "herbivore") this.once(`diet:${g.diet}`, "diet", () => `İlk ${lower(DIET_LABEL[g.diet])} birey doğdu (#${g.id}, ${g.generation}. nesil).`);
    if (g.reproductionStrategy === "sexual") this.once("sexual", "gene", () => `Eşeyli üreme ilk kez ortaya çıktı (#${g.id}): bu soyda artık dişiler ve erkekler var.`);
    if (g.laysEggs) this.once("eggs", "gene", () => `Yumurtlama ilk kez ortaya çıktı (#${g.id}).`);
  }

  private enroll(sp: Species): void {
    sp.count++;
    sp.total++;
    if (sp.count > sp.peak) sp.peak = sp.count;
    if (sp.extinct >= 0) sp.extinct = -1;
    if (!sp.established && sp.count >= ESTABLISHED_COUNT) {
      sp.established = true;
      const from = this.species.get(sp.parentId);
      this.pushEvent("species", `Yeni tür yerleşti: ${sp.name}${from ? ` — ${from.name} türünden ayrıldı` : ""} (${sp.reason}).`);
    }
  }

  private offspringSpot(c: Creature): { x: number; y: number } {
    for (let i = 0; i < 6; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = c.g.radius * 2 + rng.range(2, 8);
      const x = c.x + Math.cos(a) * r;
      const y = c.y + Math.sin(a) * r;
      if (this.passable(c, x, y)) return { x, y };
    }
    return { x: c.x, y: c.y };
  }

  private produce(g: Genome, at: Creature, parentGenomes: Genome[]): void {
    const spot = this.offspringSpot(at);
    if (g.laysEggs) {
      this.eggs.push({ x: spot.x, y: spot.y, g, t: rng.range(EGG_INCUBATION[0], EGG_INCUBATION[1]), parentIds: g.parentIds ?? [at.id, at.id], parentGenomes: parentGenomes.map(cloneGenome), bonus: at.d.brood });
    } else {
      this.birth(g, spot.x, spot.y, at, parentGenomes, at.d.brood);
    }
  }

  private divide(c: Creature): void {
    const stress = stressFactor(c.energy, c.maxEnergy);
    c.energy -= c.maxEnergy * DIVIDE_COST;
    c.divideCd = this.cooldown(c.g);
    c.readyT = 0;
    this.produce(divideGenome(c.g, this.nextId++, stress), c, [c.g]);
  }

  /** Anne yavrunun maliyetinin çoğunu üstlenir (ebeveyn yatırımı asimetrisi). */
  private mate(female: Creature, male: Creature): void {
    const stress = (stressFactor(female.energy, female.maxEnergy) + stressFactor(male.energy, male.maxEnergy)) / 2;
    female.energy -= female.maxEnergy * FEMALE_COST;
    male.energy -= male.maxEnergy * MALE_COST;
    female.divideCd = this.cooldown(female.g);
    male.divideCd = this.cooldown(male.g) * 0.4;
    female.readyT = 0;
    this.produce(crossoverGenomes(female.g, male.g, this.nextId++, stress), female, [female.g, male.g]);
  }

  private divideThreshold(c: Creature): number {
    return Math.min(0.99, c.g.divideEnergyFraction * DIET_DIVIDE_THRESHOLD[c.g.diet]) * c.maxEnergy;
  }

  /** Dişi seçimi: menzildeki erkekler arasından süs × kondisyon² ile ağırlıklı seçim. */
  private findMale(female: Creature): Creature | null {
    let total = 0;
    const candidates: Creature[] = [];
    const weights: number[] = [];
    this.cHash.query(female.x, female.y, MATING_RADIUS, (m) => {
      if (m === female || !m.alive || m.g.speciesId !== female.g.speciesId || m.g.reproductionStrategy !== "sexual" || m.g.sex !== "m") return;
      if (m.divideCd > 0 || m.age < JUVENILE_AGE || m.energy < m.maxEnergy * 0.35) return;
      const dx = m.x - female.x;
      const dy = m.y - female.y;
      if (dx * dx + dy * dy > MATING_RADIUS * MATING_RADIUS) return;
      const w = (0.25 + m.g.ornament * 1.75) * Math.pow(m.energy / m.maxEnergy, 2);
      candidates.push(m);
      weights.push(w);
      total += w;
    });
    if (candidates.length === 0) return null;
    let roll = rng.next() * total;
    for (let i = 0; i < candidates.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  // ------------------------------------------------------------------ ölüm

  private biomass(c: Creature): number {
    return Math.max(0, c.energy) + c.maxEnergy * STRUCTURAL_BIOMASS;
  }

  private kill(c: Creature, cause: DeathCause, corpseEnergy?: number): void {
    if (!c.alive) return;
    if (cause === "starvation" && c.infectedT > 0) cause = "disease";
    c.alive = false;
    this.deaths[cause]++;
    const rec = this.lineage.get(c.id);
    if (rec) {
      rec.died = this.time;
      rec.cause = cause;
    }
    const sp = this.species.get(c.g.speciesId);
    if (sp) {
      sp.count--;
      if (sp.count <= 0 && !this.eggs.some((e) => e.g.speciesId === sp.id)) {
        sp.count = 0;
        sp.extinct = this.time;
        if (sp.established) this.pushEvent("species", `${sp.name} türü tükendi (en çok ${sp.peak} birey, ${Math.round(this.time - sp.born)} sn yaşadı).`);
      }
    }
    if (cause === "meteor" || cause === "removed") return;
    const energy = corpseEnergy ?? this.biomass(c);
    if (energy < 3) return;
    const shell = organPower(c.g.organs, "shell");
    this.corpses.push({
      x: c.x,
      y: c.y,
      r: c.g.radius,
      hue: c.g.hue,
      energy,
      energy0: energy,
      age: 0,
      life: CORPSE_LIFETIME * (c.g.radius / 5.5) * (1 + (shell ?? 0) * 0.8),
      organs: c.g.organs.map((organ) => ({ ...organ })),
      stage: c.g.stage,
    });
  }

  // ------------------------------------------------------------------ arazi ve hareket

  public passable(c: Creature, x: number, y: number): boolean {
    if (x < 4 || y < 4 || x > MAP_W - 4 || y > MAP_H - 4) return false;
    const band = this.world.band(x, y);
    if (band === Band.DeepWater) return c.d.canDeep;
    if (band === Band.ShallowWater) return true;
    if (band === Band.Mountain) return c.d.canLand && c.d.wing;
    return c.d.canLand;
  }

  private escapeHeading(c: Creature): number {
    for (let r = 20; r <= 260; r += 30) {
      const start = rng.range(0, Math.PI * 2);
      for (let i = 0; i < 12; i++) {
        const a = start + (i / 12) * Math.PI * 2;
        if (this.passable(c, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r)) return a;
      }
    }
    return rng.range(0, Math.PI * 2);
  }

  private move(c: Creature, heading: number, speed: number, dt: number, free: boolean): void {
    let vx = Math.cos(heading) * speed;
    let vy = Math.sin(heading) * speed;
    if (this.wind && !c.onLand) {
      const drift = 0.6 * (1 - c.d.windGrip);
      vx += this.wind.vx * drift;
      vy += this.wind.vy * drift;
    }
    const nx = c.x + vx * dt;
    const ny = c.y + vy * dt;
    if (free) {
      c.x = Math.min(MAP_W - 4, Math.max(4, nx));
      c.y = Math.min(MAP_H - 4, Math.max(4, ny));
      return;
    }
    if (this.passable(c, nx, ny)) {
      c.x = nx;
      c.y = ny;
    } else if (this.passable(c, nx, c.y)) {
      c.x = nx;
      c.heading = vx >= 0 ? 0 : Math.PI;
      c.blockedT = 0.35;
    } else if (this.passable(c, c.x, ny)) {
      c.y = ny;
      c.heading = vy >= 0 ? Math.PI / 2 : -Math.PI / 2;
      c.blockedT = 0.35;
    } else {
      c.heading = rng.range(0, Math.PI * 2);
      c.blockedT = 0.6;
      c.thinkT = Math.min(c.thinkT, 0.3);
    }
  }

  // ------------------------------------------------------------------ algı

  private canPreyOn(pred: Creature, prey: Creature): boolean {
    const diet = pred.g.diet;
    if (diet !== "carnivore" && diet !== "omnivore") return false;
    if (pred.g.speciesId === prey.g.speciesId && (diet !== "carnivore" || pred.energy > pred.maxEnergy * CANNIBALISM_ENERGY)) return false;
    return prey.g.radius <= pred.g.radius * PREY_SIZE_LIMIT[diet];
  }

  private findThreat(c: Creature, radius: number): Creature | null {
    let best: Creature | null = null;
    let bestD = radius * radius;
    this.cHash.query(c.x, c.y, radius, (o) => {
      if (!o.alive || o === c || !this.canPreyOn(o, c)) return;
      const dx = o.x - c.x;
      const dy = o.y - c.y;
      const d = dx * dx + dy * dy;
      if (o.state !== "hunt" && d > ALARM_DISTANCE * ALARM_DISTANCE) return;
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    });
    return best;
  }

  private findPrey(c: Creature, sense: number): Creature | null {
    let best: Creature | null = null;
    let bestD = Infinity;
    const reachMax = sense * (1 + ORNAMENT_VISIBILITY);
    const seesThrough = c.d.electro && !c.onLand;
    this.cHash.query(c.x, c.y, reachMax, (o) => {
      if (!o.alive || o === c || !this.canPreyOn(c, o)) return;
      const dx = o.x - c.x;
      const dy = o.y - c.y;
      const d = dx * dx + dy * dy;
      // Kamuflaj menzili kısaltır; süslü erkek daha uzaktan görülür.
      let reach = sense * (seesThrough ? 1 : 1 - o.d.camo);
      if (o.g.reproductionStrategy === "sexual" && o.g.sex === "m") reach *= 1 + ORNAMENT_VISIBILITY * o.g.ornament;
      if (d > reach * reach || d >= bestD || !this.passable(c, o.x, o.y)) return;
      bestD = d;
      best = o;
    });
    return best;
  }

  private findHost(c: Creature, sense: number): Creature | null {
    let best: Creature | null = null;
    let bestD = sense * sense;
    this.cHash.query(c.x, c.y, sense, (o) => {
      if (!o.alive || o === c || o.g.speciesId === c.g.speciesId || o.g.diet === "parasite") return;
      if (o.parasites >= PARASITES_PER_HOST || o.resistT > 0 || o.g.radius < c.g.radius * 0.9) return;
      const dx = o.x - c.x;
      const dy = o.y - c.y;
      const d = dx * dx + dy * dy;
      if (d >= bestD || !this.passable(c, o.x, o.y)) return;
      bestD = d;
      best = o;
    });
    return best;
  }

  private findNutrient(c: Creature, radius: number): Nutrient | null {
    let best: Nutrient | null = null;
    let bestD = radius * radius;
    this.nHash.query(c.x, c.y, radius, (n) => {
      if (n.dead) return;
      const dx = n.x - c.x;
      const dy = n.y - c.y;
      const d = dx * dx + dy * dy;
      if (d >= bestD || !this.passable(c, n.x, n.y)) return;
      bestD = d;
      best = n;
    });
    return best;
  }

  private findCorpse(c: Creature, radius: number): Corpse | null {
    let best: Corpse | null = null;
    let bestD = radius * radius;
    for (const k of this.corpses) {
      if (k.energy <= 0.5) continue;
      const dx = k.x - c.x;
      const dy = k.y - c.y;
      const d = dx * dx + dy * dy;
      if (d >= bestD || !this.passable(c, k.x, k.y)) continue;
      bestD = d;
      best = k;
    }
    return best;
  }

  private lightAt(x: number, y: number): number {
    const band = this.world.band(x, y);
    return band === Band.DeepWater ? PHOTO_LIGHT.deep : band === Band.ShallowWater ? PHOTO_LIGHT.shallow : PHOTO_LIGHT.land;
  }

  /** Algıla → karar ağıyla eylem seç → hedefi belirle. */
  private think(c: Creature): void {
    const g = c.g;
    const d = c.d;
    const env = this.env;
    const deep = !c.onLand && this.world.isDeep(c.x, c.y);
    const sense = d.sense + d.eyes * (env.night ? 0.5 : 1) + (deep || env.night ? d.biolum : 0);
    c.senseNow = sense;
    c.tC = null;
    c.tN = null;
    c.tK = null;
    c.passive = deep ? d.chemo : 0;
    c.crowd = 1;

    if (c.host) {
      if (c.host.alive) {
        c.state = "attached";
        return;
      }
      c.host = null;
    }
    if (!this.passable(c, c.x, c.y)) {
      c.state = "escape";
      c.heading = this.escapeHeading(c);
      return;
    }

    // Tek bir komşuluk taramasıyla kalabalık, rakip ve gölge sayıları.
    let kin = 0;
    let rivals = 0;
    let shaders = 0;
    const scan = Math.max(TERRITORY_RADIUS, PHOTO_SHADE_RADIUS);
    this.cHash.query(c.x, c.y, scan, (o) => {
      if (o === c || !o.alive) return;
      const dx = o.x - c.x;
      const dy = o.y - c.y;
      const dist2 = dx * dx + dy * dy;
      if (o.g.speciesId === g.speciesId && dist2 <= 3600) kin++;
      if (g.diet === "carnivore" && o.g.diet === "carnivore" && dist2 <= TERRITORY_RADIUS * TERRITORY_RADIUS && !(g.packHunter && o.g.packHunter && o.g.speciesId === g.speciesId)) rivals++;
      if (g.diet === "phototroph" && o.g.diet === "phototroph" && dist2 <= PHOTO_SHADE_RADIUS * PHOTO_SHADE_RADIUS) shaders++;
      // Hastalık: aynı türden, bağışık olmayan yakın komşuya bulaşır.
      if (c.infectedT > 0 && o.g.speciesId === g.speciesId && o.infectedT <= 0 && o.immuneT <= 0 && dist2 <= INFECTION_RADIUS * INFECTION_RADIUS && rng.chance(INFECTION_CHANCE * (1 - o.d.immune))) {
        o.infectedT = INFECTION_DURATION;
      }
    });
    if (g.diet === "carnivore") c.crowd = 1 + Math.min(TERRITORY_COST_MAX, rivals * TERRITORY_COST_PER_RIVAL);

    if (g.diet === "filter_feeder" && !c.onLand) {
      const plants: Nutrient[] = [];
      this.nHash.query(c.x, c.y, FILTER_RADIUS, (n) => {
        const dx = n.x - c.x;
        const dy = n.y - c.y;
        if (!n.dead && dx * dx + dy * dy <= FILTER_RADIUS * FILTER_RADIUS) plants.push(n);
      });
      const rate = c.energy < c.maxEnergy ? FILTER_RATE * d.filter * Math.min(1, plants.length / FILTER_SATURATION) : 0;
      c.passive += rate;
      // Süzülen enerji bitki örtüsünden gelir: biriken borç kadar bitki tüketilir.
      c.filterDebt += (rate * THINK_INTERVAL) / FILTER_ENERGY_PER_PLANT;
      while (c.filterDebt >= 1 && plants.length > 0) {
        c.filterDebt -= 1;
        plants.splice(rng.int(plants.length), 1)[0].dead = true;
      }
    } else if (g.diet === "phototroph") {
      c.passive += (PHOTO_RATE * d.photo * this.lightAt(c.x, c.y) * env.light * (1 + 0.2 * env.warmth)) / (1 + PHOTO_SHADE_PER_NEIGHBOR * shaders);
    }

    // --- duyusal girdiler ---
    const threatRange = sense * 0.75 * (c.onLand ? 1 : d.lateral);
    const threat = g.diet !== "carnivore" ? this.findThreat(c, threatRange) : null;
    const hunter = g.diet === "carnivore" || g.diet === "omnivore";
    const prey = hunter && c.attackCd <= ATTACK_INTERVAL ? this.findPrey(c, sense) : null;
    let nutrient: Nutrient | null = null;
    let corpse: Corpse | null = null;
    let host: Creature | null = null;
    if (g.diet === "herbivore" || g.diet === "omnivore") nutrient = this.findNutrient(c, sense * d.smell);
    else if (g.diet === "scavenger") {
      corpse = this.findCorpse(c, sense * 1.3 * d.smell);
      if (!corpse) nutrient = this.findNutrient(c, sense * d.smell);
    } else if (g.diet === "parasite" && c.attackCd <= 0) host = this.findHost(c, sense);
    const food: { x: number; y: number } | null = corpse ?? nutrient ?? host;
    const near = (t: { x: number; y: number } | null, range: number): number => (t ? 0.5 + 0.5 * Math.max(0, 1 - Math.hypot(t.x - c.x, t.y - c.y) / range) : 0);
    const inputs = [
      1,
      1 - c.energy / c.maxEnergy,
      near(threat, threatRange),
      g.diet === "filter_feeder" || g.diet === "phototroph" ? Math.min(1, c.passive / 2) : near(food, sense * 1.3),
      near(prey, sense),
      Math.min(1, kin / 6),
      env.light,
      1 - c.hp / c.maxHp,
    ];

    // --- karar ağı: mümkün eylemler arasında en yüksek puanlı olan ---
    const brain = g.brain;
    let best: number = ACT.explore;
    let bestScore = -Infinity;
    for (let a = 0; a < BRAIN_ACTIONS.length; a++) {
      if (a === ACT.flee && !threat) continue;
      if (a === ACT.hunt && !prey) continue;
      let score = 0;
      for (let i = 0; i < IN; i++) score += brain[a * IN + i] * inputs[i];
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }

    switch (best) {
      case ACT.flee:
        c.state = "flee";
        c.tC = threat;
        return;
      case ACT.hunt:
        c.state = "hunt";
        c.tC = prey;
        return;
      case ACT.rest:
        c.state = "rest";
        return;
      case ACT.forage:
        if (corpse) {
          c.tK = corpse;
          c.state = "scavenge";
        } else if (nutrient) {
          c.tN = nutrient;
          c.state = "seek";
        } else if (host) {
          c.tC = host;
          c.state = "seek";
        } else if (g.diet === "filter_feeder") c.state = "graze";
        else if (g.diet === "phototroph") {
          c.state = "bask";
          // Loş yerdeyse daha aydınlık bir yöne döner (fototaksi).
          if (this.lightAt(c.x, c.y) < PHOTO_LIGHT.shallow) {
            let bestLight = 0;
            const start = rng.range(0, Math.PI * 2);
            for (let i = 0; i < 8; i++) {
              const a = start + (i / 8) * Math.PI * 2;
              const x = c.x + Math.cos(a) * 60;
              const y = c.y + Math.sin(a) * 60;
              if (!this.passable(c, x, y)) continue;
              const l = this.lightAt(x, y);
              if (l > bestLight) {
                bestLight = l;
                c.heading = a;
              }
            }
            c.wanderT = 1.5;
          }
        } else c.state = "wander";
        return;
      default:
        c.state = "wander";
    }
  }

  // ------------------------------------------------------------------ eylem

  private eatNutrient(c: Creature, n: Nutrient): void {
    n.dead = true;
    const efficiency = c.g.diet === "omnivore" ? OMNIVORE_PLANT_EFFICIENCY : c.g.diet === "scavenger" ? SCAVENGER_PLANT_EFFICIENCY : 1;
    c.energy = Math.min(c.maxEnergy, c.energy + PLANT_ENERGY * c.d.feed * efficiency);
  }

  private packBonus(c: Creature): number {
    if (!c.g.packHunter) return 0;
    let allies = 0;
    this.cHash.query(c.x, c.y, PACK_RADIUS, (o) => {
      if (o === c || !o.alive || !o.g.packHunter || o.g.speciesId !== c.g.speciesId) return;
      if (Math.hypot(o.x - c.x, o.y - c.y) <= PACK_RADIUS) allies++;
    });
    return Math.min(PACK_BONUS_MAX, allies * PACK_BONUS_PER_ALLY);
  }

  private attack(pred: Creature, prey: Creature): void {
    pred.attackCd = ATTACK_INTERVAL;
    pred.flashT = 0.3;
    if (prey.d.miss > 0 && rng.chance(prey.d.miss)) return;
    const dmg = pred.d.attack * (1 + this.packBonus(pred)) * prey.d.resist * (pred.g.diet === "omnivore" ? OMNIVORE_ATTACK : 1);
    prey.hp -= dmg;
    prey.hurtT = 0.4;
    if (prey.d.venom > 0) {
      pred.hp -= prey.d.venom;
      pred.hurtT = 0.4;
    }
    if (prey.d.ink > 0 && prey.hp > 0 && rng.chance(prey.d.ink)) pred.attackCd = 2.5;
    if (prey.hp <= 0) {
      const mass = this.biomass(prey);
      const gain = Math.sqrt(pred.d.feed);
      const eaten = Math.min(mass * ASSIMILATION, (pred.maxEnergy - pred.energy) / gain);
      pred.energy = Math.min(pred.maxEnergy, pred.energy + eaten * gain);
      this.kill(prey, "predation", mass - eaten);
      pred.attackCd = HANDLING_TIME;
      pred.thinkT = 0;
    }
    if (pred.hp <= 0) {
      this.kill(pred, "venom");
      this.once("venomKill", "organ", () => `Bir avcı, avının zehriyle öldü (#${pred.id}).`);
    }
  }

  private stepCreature(c: Creature, dt: number): void {
    const g = c.g;
    const d = c.d;
    const env = this.env;
    c.age += dt;
    if (c.bornT > 0) c.bornT = Math.max(0, c.bornT - dt);
    if (c.flashT > 0) c.flashT = Math.max(0, c.flashT - dt);
    if (c.hurtT > 0) c.hurtT = Math.max(0, c.hurtT - dt);
    if (c.divideCd > 0) c.divideCd -= dt;
    if (c.attackCd > 0) c.attackCd -= dt;
    if (c.hgtCd > 0) c.hgtCd -= dt;
    if (c.blockedT > 0) c.blockedT -= dt;
    if (c.careT > 0) c.careT -= dt;
    if (c.immuneT > 0) c.immuneT -= dt;
    if (c.resistT > 0) c.resistT -= dt;
    if (c.infectedT > 0 && (c.infectedT -= dt) <= 0) c.immuneT = IMMUNITY_DURATION;

    const wasOnLand = c.onLand;
    c.onLand = !this.world.isWater(c.x, c.y);
    if (c.onLand && !wasOnLand && d.canLand) this.once("land", "population", () => `İlk karaya çıkış: bacaklı bir birey (#${c.id}) sudan ayrıldı.`);

    c.thinkT -= dt;
    if (c.thinkT <= 0) {
      c.thinkT = THINK_INTERVAL + rng.next() * 0.08;
      this.think(c);
    }

    // --- metabolizma ---
    const active = c.state === "flee" || c.state === "hunt";
    let m = g.metabolism * d.meta * c.crowd;
    const torpor = organPower(g.organs, "torpor");
    if (torpor !== undefined && c.energy <= c.maxEnergy * 0.2) m *= 1 - (0.35 + torpor * 0.35);
    const thermal = (this.climate ? this.climate.meta - 1 : 0) + env.cold;
    if (thermal !== 0) {
      const blubber = organPower(g.organs, "blubber");
      m *= 1 + thermal * (blubber === undefined ? 1 : 1 - (0.4 + blubber * 0.4));
    }
    const deviation = env.oxygen - 0.5;
    const gill = organPower(g.organs, "gill");
    const lung = organPower(g.organs, "lung");
    if (gill !== undefined && !c.onLand) m *= 1 - Math.max(0, -deviation) * (0.3 + gill * 0.4);
    if (lung !== undefined && c.onLand) m *= Math.min(1.5, Math.max(0.5, 1 - deviation * (0.3 + lung * 0.4)));
    if (c.careT > 0 && c.parent && c.parent.alive && Math.hypot(c.parent.x - c.x, c.parent.y - c.y) <= PARENTAL_CARE_RADIUS) m *= 1 - PARENTAL_CARE_DISCOUNT;
    if (c.state === "hunt") m *= HUNT_METABOLISM;
    else if (c.state === "escape") m *= 3;
    else if (c.state === "rest") m *= REST_METABOLISM;
    if (active && d.sprint > 0) m *= 1.2;
    if (!active && !c.onLand && d.bladder > 0) m *= 1 - d.bladder;
    if (c.infectedT > 0) m *= INFECTION_METABOLISM;
    c.energy += (c.passive - m) * dt;
    if (c.energy > c.maxEnergy) c.energy = c.maxEnergy;
    if (c.hp < c.maxHp) c.hp = Math.min(c.maxHp, c.hp + c.maxHp * 0.04 * d.regen * dt);

    // --- ölüm ---
    if (c.energy <= 0) return this.kill(c, "starvation");
    const ageRatio = c.age / g.maxLifespan;
    if (ageRatio >= 1) return this.kill(c, "old_age");
    if (ageRatio > SENESCENCE_START && rng.chance(((ageRatio - SENESCENCE_START) / (1 - SENESCENCE_START)) * SENESCENCE_MAX_RATE * dt)) return this.kill(c, "old_age");

    // --- hareket ve eylem ---
    let speed = c.onLand ? (d.walk > 0 ? d.walk : d.base * 0.35) : d.swim;
    if (active) speed *= 1 + d.sprint;
    let heading = c.heading;
    const reach = g.radius + 5;

    switch (c.state) {
      case "attached": {
        const host = c.host;
        if (!host || !host.alive) {
          c.host = null;
          c.thinkT = 0;
          break;
        }
        // Konağın bağışıklığı paraziti bir süre sonra atar ve konak bir süre dirençli kalır.
        c.attachT += dt;
        if (c.attachT >= PARASITE_HOLD * (1 - host.d.immune * 0.6)) {
          host.resistT = PARASITE_RESISTANCE;
          c.host = null;
          c.attackCd = PARASITE_REATTACH_DELAY;
          c.thinkT = 0;
          break;
        }
        // Konağa tutunmuş: onunla taşınır, doyana kadar enerjisini emer. Zayıf konaktan daha az emer.
        const yieldRate = PARASITE_EFFICIENCY * Math.sqrt(d.feed);
        const vigor = Math.min(1, 0.45 + host.energy / host.maxEnergy);
        const drain = Math.max(0, Math.min(host.energy, PARASITE_DRAIN * vigor * dt, (c.maxEnergy - c.energy) / yieldRate));
        host.energy -= drain;
        c.energy += drain * yieldRate;
        const a = host.heading + c.hostAngle;
        c.x = host.x + Math.cos(a) * (host.g.radius + g.radius * 0.5);
        c.y = host.y + Math.sin(a) * (host.g.radius + g.radius * 0.5);
        c.heading = a + Math.PI;
        speed = 0;
        break;
      }
      case "escape":
        this.move(c, c.heading, Math.max(speed, 14), dt, true);
        return;
      case "rest":
        speed = 0;
        break;
      case "flee": {
        const t = c.tC;
        if (!t || !t.alive) {
          c.thinkT = 0;
          break;
        }
        heading = Math.atan2(c.y - t.y, c.x - t.x);
        break;
      }
      case "seek": {
        const target = c.tN ?? c.tC;
        if (!target || (c.tN ? c.tN.dead : !(c.tC as Creature).alive)) {
          c.thinkT = 0;
          speed *= 0.6;
          break;
        }
        const dx = target.x - c.x;
        const dy = target.y - c.y;
        if (c.tN) {
          if (dx * dx + dy * dy <= reach * reach) {
            this.eatNutrient(c, c.tN);
            c.thinkT = 0;
          }
        } else {
          const host = c.tC as Creature;
          const contact = g.radius + host.g.radius + 2;
          if (dx * dx + dy * dy <= contact * contact) {
            // Tutunma girişimi: mukus tabakası boşa çıkarabilir.
            if (host.parasites < PARASITES_PER_HOST && !rng.chance(host.d.mucus)) {
              c.host = host;
              c.hostAngle = rng.range(0, Math.PI * 2);
              c.attachT = 0;
              host.parasites++;
              c.state = "attached";
              this.once("parasite", "diet", () => `İlk parazitlik: #${c.id}, başka türden bir konağa tutundu ve enerjisini emmeye başladı.`);
            } else c.attackCd = 3;
            c.thinkT = 0;
          }
        }
        heading = Math.atan2(dy, dx);
        break;
      }
      case "hunt": {
        const t = c.tC;
        if (!t || !t.alive) {
          c.thinkT = 0;
          break;
        }
        const dx = t.x - c.x;
        const dy = t.y - c.y;
        const contact = g.radius + t.g.radius + 2;
        if (dx * dx + dy * dy <= contact * contact) {
          if (c.attackCd <= 0) this.attack(c, t);
          if (!c.alive) return;
          speed *= 0.3;
        }
        heading = Math.atan2(dy, dx);
        break;
      }
      case "scavenge": {
        const k = c.tK;
        if (!k || k.energy <= 0.5) {
          c.thinkT = 0;
          break;
        }
        const dx = k.x - c.x;
        const dy = k.y - c.y;
        const contact = reach + k.r;
        if (dx * dx + dy * dy <= contact * contact) {
          const bite = Math.min(k.energy, SCAVENGE_RATE * dt);
          k.energy -= bite;
          c.energy = Math.min(c.maxEnergy, c.energy + bite * SCAVENGE_EFFICIENCY * Math.sqrt(d.feed));
          speed = 0;
        }
        heading = Math.atan2(dy, dx);
        break;
      }
      default: {
        c.wanderT -= dt;
        if (c.wanderT <= 0) {
          c.heading += (rng.next() - 0.5) * Math.PI * 0.9;
          c.wanderT = rng.range(0.5, 2);
        }
        heading = c.heading;
        speed *= c.state === "bask" ? 0.3 : c.state === "graze" ? (c.passive >= FILTER_RATE * 0.75 ? 0.15 : 0.9) : 0.6;
      }
    }

    if (c.state !== "attached") {
      if (c.blockedT > 0) heading = c.heading;
      else c.heading = heading;
      if (speed > 0) this.move(c, heading, speed, dt, false);
    }

    // --- üreme ---
    if (c.divideCd <= 0 && c.age >= JUVENILE_AGE && c.energy >= this.divideThreshold(c) && this.creatures.length + this.newborns.length + this.eggs.length < MAX_CREATURES) {
      if (g.reproductionStrategy !== "sexual") this.divide(c);
      else if (g.sex === "f") {
        const male = this.findMale(c);
        if (male) this.mate(c, male);
        else {
          c.readyT += dt;
          // Erkek bulunamazsa dişi bir süre sonra tek başına bölünür (fakültatif partenogenez).
          if (c.readyT >= MATE_WAIT_BEFORE_SELFING) this.divide(c);
        }
      }
    }
  }

  // ------------------------------------------------------------------ bitki örtüsü

  private plantOk(land: boolean, x: number, y: number): boolean {
    if (x < 6 || y < 6 || x > MAP_W - 6 || y > MAP_H - 6) return false;
    const b = this.world.band(x, y);
    if (land) return b === Band.Plain || b === Band.Beach;
    return b === Band.ShallowWater || (b === Band.DeepWater && rng.chance(DEEP_WATER_PLANT_CHANCE));
  }

  private plantCrowded(x: number, y: number): boolean {
    let neighbors = 0;
    this.nHash.query(x, y, PLANT_CROWD_RADIUS, (n) => {
      const dx = n.x - x;
      const dy = n.y - y;
      if (!n.dead && dx * dx + dy * dy <= PLANT_CROWD_RADIUS * PLANT_CROWD_RADIUS) neighbors++;
    });
    return neighbors >= PLANT_CROWD_LIMIT;
  }

  /** Tohum yağmuru: boş bir yere rastgele düşen yeni bitki. */
  private seedPlant(land: boolean, sparse = false): boolean {
    const pos = this.randomPoint((x, y) => this.plantOk(land, x, y), 25);
    if (!pos || (sparse && this.plantCrowded(pos.x, pos.y))) return false;
    this.nutrients.push({ x: pos.x, y: pos.y, land, age: 0, dead: false });
    return true;
  }

  /**
   * Bitkiler gerçek bir üreticidir: var olan bitkilerin yanında çoğalırlar, yer
   * doldukça büyüme durur (yerel lojistik büyüme), hızları mevsimle ve iklimle değişir;
   * aşırı otlanan bölge kenarlardan ve tohum yağmuruyla yeniden yeşerir.
   */
  private stepPlants(dt: number): void {
    const water: Nutrient[] = [];
    const land: Nutrient[] = [];
    for (const n of this.nutrients) {
      n.age += dt;
      (n.land ? land : water).push(n);
    }
    const factor = (1 + SEASON_GROWTH_SWING * this.env.warmth) * (this.climate ? this.climate.nutrient : 1) * this.nutrientMultiplier * chemMods.plant;
    for (const kind of ["water", "land"] as const) {
      const list = kind === "water" ? water : land;
      const p = PLANT[kind];
      const n = list.length;
      // Taşıma kapasitesi yereldir (bkz. plantCrowded): her havza kendi dengesini
      // kurar. `capacity` yalnızca bir güvenlik tavanıdır.
      if (n >= p.capacity) continue;
      this.plantAcc[kind] += (p.growth * n + p.seed) * factor * dt;
      while (this.plantAcc[kind] >= 1) {
        this.plantAcc[kind] -= 1;
        // Çoğu yeni bitki bir komşunun yanında, azı tohum olarak uzakta çıkar.
        const local = n > 0 && rng.chance((p.growth * n) / (p.growth * n + p.seed));
        if (local) {
          const parent = list[rng.int(n)];
          const a = rng.range(0, Math.PI * 2);
          const r = rng.range(PLANT_SPREAD[0], PLANT_SPREAD[1]);
          const x = parent.x + Math.cos(a) * r;
          const y = parent.y + Math.sin(a) * r;
          if (this.plantOk(kind === "land", x, y) && !this.plantCrowded(x, y)) this.nutrients.push({ x, y, land: kind === "land", age: 0, dead: false });
        } else this.seedPlant(kind === "land", true);
      }
    }
  }

  // ------------------------------------------------------------------ ceset, yumurta, YGT, hastalık

  private stepCorpses(dt: number): void {
    for (const k of this.corpses) {
      k.age += dt;
      k.energy -= (k.energy0 / k.life) * dt;
      if (k.energy <= 0.5 || k.age >= k.life) {
        k.energy = 0;
        // Ayrıştırıcılar işini bitirdi: maddenin bir kısmı bitki olarak döner.
        if (rng.chance(CORPSE_PLANT_CHANCE)) this.nutrients.push({ x: k.x, y: k.y, land: !this.world.isWater(k.x, k.y), age: 0, dead: false });
      }
    }
    this.corpses = this.corpses.filter((k) => k.energy > 0);
  }

  private stepEggs(dt: number): void {
    if (this.eggs.length === 0) return;
    const remaining: Egg[] = [];
    for (const e of this.eggs) {
      e.t -= dt;
      if (e.t > 0 || this.creatures.length + this.newborns.length >= MAX_CREATURES) {
        remaining.push(e);
        continue;
      }
      const parent = this.creatures.find((c) => c.id === e.parentIds[0] && c.alive) ?? null;
      this.birth(e.g, e.x, e.y, parent, e.parentGenomes, e.bonus);
    }
    this.eggs = remaining;
  }

  /** Yatay gen transferi (transformasyon): taze bir cesedin yanındaki canlı, küçük
   *  bir olasılıkla cesedin organ tiplerinden birini düşük güçle kazanır. */
  private stepHgt(): void {
    for (const k of this.corpses) {
      if (k.organs.length === 0) continue;
      const chance = HGT_CHANCE * (1 - k.age / k.life);
      if (chance <= 0) continue;
      this.cHash.query(k.x, k.y, HGT_RADIUS + k.r, (c) => {
        if (!c.alive || c.hgtCd > 0) return;
        if (Math.hypot(c.x - k.x, c.y - k.y) > HGT_RADIUS + k.r || !rng.chance(chance)) return;
        const options = k.organs.filter((organ) => organ.type !== "shell" && canHostOrgan(c.g.organs, c.g.stage, organ.type));
        if (options.length === 0) return;
        const type = options[rng.int(options.length)].type;
        c.g.organs.push({ type, power: rng.range(0.15, 0.35) });
        this.rederive(c);
        c.hgtCd = HGT_COOLDOWN;
        this.lineage.get(c.id)?.notes.push(`YGT: +${ORGANS[type].label}`);
        this.once("hgt", "gene", () => `İlk yatay gen transferi: #${c.id} bir cesetten ${lower(ORGANS[type].label)} genini aldı.`);
        this.once(`organ:${type}`, "organ", () => `İlk ${lower(ORGANS[type].label)}: #${c.id} bireyinde ortaya çıktı.`);
      });
    }
  }

  /** Salgın başlangıcı: kalabalık türlerde olasılık yoğunluğun karesiyle artar. */
  private stepOutbreak(): void {
    for (const s of this.species.values()) s.infected = 0;
    for (const c of this.creatures) {
      if (c.alive && c.infectedT > 0) {
        const sp = this.species.get(c.g.speciesId);
        if (sp) sp.infected++;
      }
    }
    for (const s of this.species.values()) {
      if (s.count === 0) continue;
      const key = `outbreak:${s.id}`;
      if (s.infected === 0) {
        this.flags[key] = false;
        if (rng.chance(Math.min(0.5, Math.pow(s.count / OUTBREAK_DENSITY, 2) * 0.25))) {
          const members = this.creatures.filter((c) => c.alive && c.g.speciesId === s.id && c.immuneT <= 0);
          if (members.length > 0) members[rng.int(members.length)].infectedT = INFECTION_DURATION;
        }
      } else if (s.infected >= 6 && !this.flags[key]) {
        this.flags[key] = true;
        this.pushEvent("disease", `Salgın: ${s.name} türünde ${s.infected} birey hasta. Hastalık yalnızca bu türe bulaşıyor ve kalabalıkta hızla yayılıyor.`);
      }
    }
  }

  // ------------------------------------------------------------------ dünya olayları

  private stepWorldEvents(dt: number): void {
    if (this.climate && (this.climate.left -= dt) <= 0) {
      this.pushEvent("world", `${this.climate.warm ? "Sıcak" : "Soğuk"} dalga sona erdi.`);
      this.climate = null;
    }
    if (this.wind && (this.wind.left -= dt) <= 0) this.wind = null;
    if (this.quakeLeft > 0 && (this.quakeLeft -= dt) <= 0) this.world.clearQuakes();
    for (const f of this.flashes) f.age += dt;
    if (this.flashes.length > 0) this.flashes = this.flashes.filter((f) => f.age < 1.6);

    if (!this.autoEvents) return;
    this.eventT -= dt;
    if (this.eventT > 0) return;
    this.eventT = EVENT_CHECK_INTERVAL;
    if (rng.chance(EVENT_CHANCE.meteor)) this.trigger("meteor");
    if (!this.climate && rng.chance(EVENT_CHANCE.climate)) this.trigger("climate");
    if (!this.wind && rng.chance(EVENT_CHANCE.wind)) this.trigger("wind");
    if (this.quakeLeft <= 0 && rng.chance(EVENT_CHANCE.quake)) this.trigger("quake");
  }

  /** Bir dünya olayını tetikler. Süreli olaylar zaten etkinse `false` döner. */
  public trigger(kind: WorldEventKind, at?: { x: number; y: number }): boolean {
    const x = at ? at.x : rng.range(0, MAP_W);
    const y = at ? at.y : rng.range(0, MAP_H);
    switch (kind) {
      case "meteor": {
        const r = rng.range(40, 90);
        let killed = 0;
        let burned = 0;
        for (const c of this.creatures) {
          if (c.alive && Math.hypot(c.x - x, c.y - y) <= r && rng.chance(0.6)) {
            this.kill(c, "meteor");
            killed++;
          }
        }
        for (const n of this.nutrients) {
          if (!n.dead && Math.hypot(n.x - x, n.y - y) <= r && rng.chance(0.6)) {
            n.dead = true;
            burned++;
          }
        }
        this.flashes.push({ x, y, r, kind, age: 0 });
        this.pushEvent("world", killed > 0 ? `Meteor çarptı: ${killed} canlı ve ${burned} bitki yok oldu.` : `Meteor çarptı; bölgede canlı yoktu.`);
        return true;
      }
      case "climate": {
        if (this.climate) return false;
        const warm = rng.chance(0.5);
        const left = rng.range(45, 90);
        this.climate = { warm, meta: warm ? 1.2 - rng.next() * 0.1 : 0.85 + rng.next() * 0.1, nutrient: warm ? 1.3 - rng.next() * 0.15 : 0.7 + rng.next() * 0.15, left };
        this.flashes.push({ x: MAP_W / 2, y: MAP_H / 2, r: MAP_W * 0.42, kind, age: 0 });
        this.pushEvent(
          "world",
          warm
            ? `Sıcak dalga başladı (~${Math.round(left)} sn): metabolizma ${pct(this.climate.meta - 1)} hızlandı, bitki büyümesi ${pct(this.climate.nutrient - 1)} arttı, oksijen düştü.`
            : `Soğuk dalga başladı (~${Math.round(left)} sn): metabolizma ${pct(1 - this.climate.meta)} yavaşladı, bitki büyümesi ${pct(1 - this.climate.nutrient)} azaldı, oksijen yükseldi.`
        );
        return true;
      }
      case "wind": {
        if (this.wind) return false;
        const angle = rng.range(0, Math.PI * 2);
        const strength = rng.range(8, 22);
        const left = rng.range(12, 25);
        this.wind = { vx: Math.cos(angle) * strength, vy: Math.sin(angle) * strength, angle, left };
        const dirs = ["doğuya", "güneydoğuya", "güneye", "güneybatıya", "batıya", "kuzeybatıya", "kuzeye", "kuzeydoğuya"];
        const deg = ((angle * 180) / Math.PI + 360) % 360;
        this.pushEvent("world", `Rüzgâr ${dirs[Math.round(deg / 45) % 8]} doğru esiyor (~${Math.round(left)} sn); sudaki canlılar sürükleniyor.`);
        return true;
      }
      case "quake": {
        if (this.quakeLeft > 0) return false;
        const r = rng.range(14, 30);
        const wasWater = this.world.isWater(x, y);
        this.world.applyQuake(x, y, r, !wasWater);
        this.quakeLeft = rng.range(25, 50);
        this.flashes.push({ x, y, r, kind, age: 0 });
        this.pushEvent("world", `Deprem: küçük bir ${wasWater ? "deniz tabanı yükselip kara oldu" : "kara parçası sular altında kaldı"} (~${Math.round(this.quakeLeft)} sn).`);
        return true;
      }
    }
  }

  // ------------------------------------------------------------------ elle müdahale (sandbox)

  public addPlants(x: number, y: number, count = 10, spread = 34): number {
    let added = 0;
    for (let i = 0; i < count * 3 && added < count; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = Math.sqrt(rng.next()) * spread;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (px < 6 || py < 6 || px > MAP_W - 6 || py > MAP_H - 6) continue;
      const band = this.world.band(px, py);
      if (band === Band.Mountain) continue;
      this.nutrients.push({ x: px, y: py, land: band === Band.Plain || band === Band.Beach, age: 0, dead: false });
      added++;
    }
    return added;
  }

  /** Haritaya canlı yerleştirir: `templateId` verilirse o bireyin kopyası, yoksa
   *  organsız bir mikroorganizma. Yerleştirilemezse `null` döner. */
  public placeCreature(x: number, y: number, templateId = 0): number | null {
    if (this.creatures.length >= MAX_CREATURES) return null;
    const template = templateId ? this.findCreature(templateId) : null;
    const g: Genome = template ? { ...cloneGenome(template.g), id: this.nextId++, parentIds: null } : randomGenome(this.nextId++);
    const c = this.makeCreature(g, x, y, null);
    if (!this.passable(c, x, y)) return null;
    let sp = template ? this.species.get(template.g.speciesId) : undefined;
    if (!sp) {
      for (const s of this.species.values()) if (s.count > 0 && geneticDistance(g, s.type) < SISTER_JOIN_DISTANCE) sp = s;
      if (!sp) sp = this.createSpecies(g, null, "elle yerleştirildi");
    }
    g.speciesId = sp.id;
    c.energy = c.maxEnergy * 0.7;
    this.creatures.push(c);
    this.record(c, ["elle yerleştirildi"]);
    this.enroll(sp);
    return c.id;
  }

  public removeCreature(id: number): boolean {
    const c = this.findCreature(id);
    if (!c) return false;
    this.kill(c, "removed");
    this.creatures = this.creatures.filter((o) => o.alive);
    return true;
  }

  /** Seçili bireyin organını ekler, gücünü değiştirir (`power`) ya da kaldırır (`null`). */
  public editOrgan(id: number, type: OrganType, power: number | null): boolean {
    const c = this.findCreature(id);
    if (!c) return false;
    const index = c.g.organs.findIndex((organ) => organ.type === type);
    if (power === null) {
      if (index < 0) return false;
      c.g.organs.splice(index, 1);
    } else if (index >= 0) c.g.organs[index].power = Math.min(1, Math.max(0.05, power));
    else {
      if (!canHostOrgan(c.g.organs, c.g.stage, type)) return false;
      c.g.organs.push({ type, power: Math.min(1, Math.max(0.05, power)) });
    }
    this.rederive(c);
    this.lineage.get(c.id)?.notes.push(power === null ? `elle: −${ORGANS[type].label}` : index >= 0 ? `elle: ${ORGANS[type].label} gücü` : `elle: +${ORGANS[type].label}`);
    return true;
  }

  public editStage(id: number, stage: number): boolean {
    const c = this.findCreature(id);
    if (!c || stage < 0 || stage > 2 || stage === c.g.stage) return false;
    c.g.stage = stage;
    fitToStage(c.g);
    this.rederive(c);
    this.lineage.get(c.id)?.notes.push(`elle: düzey → ${lower(STAGE_LABEL[stage])}`);
    return true;
  }

  // ------------------------------------------------------------------ evrim olayları ve örnekleme

  public organCounts(): Record<OrganType, number> {
    const counts = {} as Record<OrganType, number>;
    for (const t of ORGAN_TYPES) counts[t] = 0;
    for (const c of this.creatures) for (const organ of c.g.organs) counts[organ.type]++;
    return counts;
  }

  private checkEvolution(): void {
    const pop = this.creatures.length;
    const counts = this.organCounts();
    const MILESTONES = [0.2, 0.4, 0.6, 0.8];
    for (const t of ORGAN_TYPES) {
      const n = counts[t];
      const peak = this.organPeak[t] ?? 0;
      const label = ORGANS[t].label;
      if (n > peak) this.organPeak[t] = n;
      if (n === 0) {
        if (peak >= 3) this.pushEvent("organ", `${label} popülasyondan elendi (en çok ${peak} taşıyıcıya ulaşmıştı).`);
        if (peak > 0) {
          this.organPeak[t] = 0;
          this.organMilestone[t] = 0;
        }
        continue;
      }
      if (pop < 10) continue;
      const fraction = n / pop;
      let reached = this.organMilestone[t] ?? 0;
      while (reached > 0 && fraction < MILESTONES[reached - 1] - 0.1) reached--;
      if (reached < MILESTONES.length && fraction >= MILESTONES[reached]) {
        while (reached < MILESTONES.length && fraction >= MILESTONES[reached]) reached++;
        this.pushEvent("organ", `${label} popülasyonun ${pct(MILESTONES[reached - 1])}'ine yayıldı (${n}/${pop}).${this.energyContext(t)}`);
      }
      this.organMilestone[t] = reached;
    }
  }

  /** Yayılma olayına ölçülmüş bağlam: taşıyıcıların ortalama enerji oranı, taşımayanlarla
   *  karşılaştırılır. Fark küçükse ya da gruplar yetersizse hiçbir şey söylenmez. */
  private energyContext(type: OrganType): string {
    let withSum = 0;
    let withN = 0;
    let withoutSum = 0;
    let withoutN = 0;
    for (const c of this.creatures) {
      const ratio = c.energy / c.maxEnergy;
      if (organPower(c.g.organs, type) !== undefined) {
        withSum += ratio;
        withN++;
      } else {
        withoutSum += ratio;
        withoutN++;
      }
    }
    if (withN < 8 || withoutN < 8) return "";
    const diff = withSum / withN / (withoutSum / withoutN) - 1;
    if (Math.abs(diff) < 0.1) return "";
    return ` Taşıyıcıların ortalama enerjisi diğerlerinden ${pct(Math.abs(diff))} ${diff > 0 ? "yüksek" : "düşük"}.`;
  }

  public dietCounts(): number[] {
    const counts = DIETS.map(() => 0);
    for (const c of this.creatures) counts[DIETS.indexOf(c.g.diet)]++;
    return counts;
  }

  public livingSpecies(): Species[] {
    const list: Species[] = [];
    for (const s of this.species.values()) if (s.count > 0) list.push(s);
    return list.sort((a, b) => b.count - a.count);
  }

  private sample(): void {
    let living = 0;
    for (const s of this.species.values()) {
      if (s.count === 0) continue;
      living++;
      s.series.push(Math.round(this.time), s.count);
      if (s.series.length > SERIES_CAP * 2) {
        const thinned: number[] = [];
        for (let i = 0; i < s.series.length; i += 4) thinned.push(s.series[i], s.series[i + 1]);
        s.series = thinned;
      }
    }
    this.history.push({ t: this.time, diets: this.dietCounts(), nutrients: this.nutrients.length, species: living, oxygen: this.oxygen() });
    if (this.history.length > HISTORY_CAP) {
      this.history = this.history.filter((_, i) => i % 2 === 1);
      this.sampleInterval *= 2;
    }
    // Toplu ölüm: son ~20 sn içinde popülasyonun %35'inden fazlası kaybedildiyse.
    const h = this.history;
    const back = Math.max(1, Math.round(20 / this.sampleInterval));
    if (h.length > back) {
      const before = h[h.length - 1 - back].diets.reduce((a, b) => a + b, 0);
      const now = this.creatures.length;
      if (before >= 30 && now <= before * 0.65) {
        if (!this.flags.dieoff) this.pushEvent("population", `Toplu ölüm: popülasyon kısa sürede ${before} → ${now} bireye düştü.`);
        this.flags.dieoff = true;
      } else if (now >= before * 0.9) this.flags.dieoff = false;
    }
  }

  private immigrate(): void {
    const first = randomGenome(this.nextId++);
    const sp = this.createSpecies(first, null, "harita dışından göç");
    for (let i = 0; i < RESCUE_GROUP; i++) {
      const g = i === 0 ? first : randomGenome(this.nextId++);
      g.speciesId = sp.id;
      const edge = rng.int(4);
      const pos =
        this.randomPoint((x, y) => (edge === 0 ? x < 120 : edge === 1 ? x > MAP_W - 120 : edge === 2 ? y < 120 : y > MAP_H - 120) && this.world.isWater(x, y), 200) ??
        this.randomPoint((x, y) => this.world.isWater(x, y)) ?? { x: MAP_W / 2, y: MAP_H / 2 };
      const c = this.makeCreature(g, pos.x, pos.y, null);
      c.energy = c.maxEnergy * 0.7;
      this.newborns.push(c);
      this.record(c, ["göçmen"]);
      sp.count++;
      sp.total++;
      this.immigrants++;
    }
    sp.peak = sp.count;
    if (!this.flags.rescue) this.pushEvent("population", `Popülasyon çöktü; harita dışından ilkel mikroorganizmalar sürüklenip geliyor (${sp.name}).`);
    this.flags.rescue = true;
  }

  // ------------------------------------------------------------------ ana adım

  public step(dt: number = STEP): void {
    if (this.extinct) return;
    this.time += dt;
    this.updateEnv();

    this.cHash.clear();
    for (const c of this.creatures) {
      c.parasites = 0;
      this.cHash.add(c);
    }
    for (const c of this.creatures) if (c.host && c.host.alive) c.host.parasites++;
    this.nHash.clear();
    for (const n of this.nutrients) this.nHash.add(n);

    this.stepWorldEvents(dt);
    for (const c of this.creatures) if (c.alive) this.stepCreature(c, dt);

    this.hgtT -= dt;
    if (this.hgtT <= 0) {
      this.hgtT = HGT_INTERVAL;
      this.stepHgt();
    }
    this.outbreakT -= dt;
    if (this.outbreakT <= 0) {
      this.outbreakT = OUTBREAK_CHECK;
      this.stepOutbreak();
    }
    this.stepCorpses(dt);
    this.stepEggs(dt);

    let anyDead = false;
    for (const c of this.creatures) if (!c.alive) anyDead = true;
    if (anyDead) this.creatures = this.creatures.filter((c) => c.alive);
    if (this.newborns.length > 0) {
      for (const c of this.newborns) this.creatures.push(c);
      this.newborns = [];
    }
    this.nutrients = this.nutrients.filter((n) => !n.dead);
    this.stepPlants(dt);

    this.evolutionT -= dt;
    if (this.evolutionT <= 0) {
      this.evolutionT = 2;
      this.checkEvolution();
    }
    this.sampleT -= dt;
    if (this.sampleT <= 0) {
      this.sampleT = this.sampleInterval;
      this.sample();
    }

    // Başlangıçtaki tek hücre bir çöküş değildir: göç yalnızca yaşam bir kez
    // yayıldıktan sonra çökerse ya da tümüyle tükenirse gelir.
    const alive = this.creatures.length + this.eggs.length;
    if (alive < RESCUE_THRESHOLD && this.rescueEnabled && (this.births >= 30 || alive === 0)) {
      this.rescueT -= dt;
      if (this.rescueT <= 0) {
        this.rescueT = RESCUE_INTERVAL;
        this.immigrate();
      }
    } else {
      this.rescueT = RESCUE_INTERVAL;
      if (this.creatures.length >= 30) this.flags.rescue = false;
    }

    if (this.creatures.length === 0 && this.eggs.length === 0 && this.newborns.length === 0 && !this.rescueEnabled) {
      this.extinct = true;
      this.pushEvent("population", `Yaşam tükendi (${Math.round(this.time)}. saniye, ${this.maxGeneration} nesil sonra).`);
      this.sample();
    }
  }

  // ------------------------------------------------------------------ sorgular

  public nearestCreature(x: number, y: number, maxDistance: number): Creature | null {
    let best: Creature | null = null;
    let bestD = maxDistance;
    for (const c of this.creatures) {
      const d = Math.hypot(c.x - x, c.y - y) - c.g.radius;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  public findCreature(id: number): Creature | null {
    for (const c of this.creatures) if (c.id === id && c.alive) return c;
    return null;
  }

  private static speedOf(c: Creature): number {
    return c.onLand && c.d.walk > 0 ? c.d.walk : c.d.swim;
  }

  public inspect(id: number): Inspection {
    const chain = this.ancestry(id);
    const pop = this.creatures;
    const mean = (f: (c: Creature) => number): number => pop.reduce((s, c) => s + f(c), 0) / pop.length;
    return {
      id,
      alive: this.findCreature(id) !== null,
      rec: this.lineage.get(id) ?? null,
      chain: chain.length,
      oldestBorn: chain.length > 0 ? chain[chain.length - 1].born : 0,
      history: chain
        .filter((r) => r.notes.length > 0)
        .slice(0, 10)
        .reverse()
        .map((r) => ({ gen: r.gen, notes: r.notes })),
      means: pop.length >= 8 ? { speed: mean(Sim.speedOf), sense: mean((c) => c.senseNow), metabolism: mean((c) => c.g.metabolism * c.d.meta), radius: mean((c) => c.g.radius) } : null,
    };
  }

  public speciesStats(id: number): SpeciesStats | null {
    const sp = this.species.get(id);
    if (!sp) return null;
    const members = this.creatures.filter((c) => c.g.speciesId === id);
    const n = Math.max(1, members.length);
    const sum = (f: (c: Creature) => number): number => members.reduce((s, c) => s + f(c), 0);
    const organs = new Map<OrganType, { count: number; power: number }>();
    for (const c of members) {
      for (const organ of c.g.organs) {
        const e = organs.get(organ.type) ?? { count: 0, power: 0 };
        e.count++;
        e.power += organ.power;
        organs.set(organ.type, e);
      }
    }
    const brain = sp.type.brain.map((_, i) => sum((c) => c.g.brain[i]) / n);
    const sexual = members.filter((c) => c.g.reproductionStrategy === "sexual");
    const children: number[] = [];
    for (const s of this.species.values()) if (s.parentId === id && s.established) children.push(s.id);
    return {
      id,
      members: members.length,
      radius: sum((c) => c.g.radius) / n,
      speed: sum(Sim.speedOf) / n,
      sense: sum((c) => c.senseNow) / n,
      metabolism: sum((c) => c.g.metabolism * c.d.meta) / n,
      generation: members.length > 0 ? [Math.min(...members.map((c) => c.g.generation)), Math.max(...members.map((c) => c.g.generation))] : [0, 0],
      onLand: members.filter((c) => c.onLand).length,
      sexual: sexual.length,
      males: sexual.filter((c) => c.g.sex === "m").length,
      ornament: sexual.length > 0 ? sexual.reduce((s, c) => s + c.g.ornament, 0) / sexual.length : 0,
      infected: members.filter((c) => c.infectedT > 0).length,
      organs: Array.from(organs, ([type, e]) => ({ type, count: e.count, power: e.power / e.count })).sort((a, b) => b.count - a.count),
      brain: members.length > 0 ? brain : sp.type.brain.slice(),
      series: sp.series,
      children,
    };
  }

  // ------------------------------------------------------------------ kaydet / yükle

  public serialize(): SaveData {
    const r1 = (v: number): number => Math.round(v * 10) / 10;
    return {
      version: SAVE_VERSION,
      seed: this.world.seed,
      time: this.time,
      rng: rng.s,
      nextId: this.nextId,
      nextSpeciesId: this.nextSpeciesId,
      creatures: this.creatures.map((c) => ({
        g: c.g,
        x: r1(c.x),
        y: r1(c.y),
        energy: Math.round(c.energy * 100) / 100,
        hp: Math.round(c.hp * 100) / 100,
        age: r1(c.age),
        divideCd: r1(Math.max(0, c.divideCd)),
        parent: c.parent && c.parent.alive ? c.parent.id : 0,
        host: c.host && c.host.alive ? c.host.id : 0,
        infectedT: r1(Math.max(0, c.infectedT)),
        immuneT: r1(Math.max(0, c.immuneT)),
      })),
      nutrients: this.nutrients.map((n) => [Math.round(n.x), Math.round(n.y), n.land ? 1 : 0] as [number, number, number]),
      eggs: this.eggs,
      species: Array.from(this.species.values()),
      lineage: this.lineageOrder
        .slice(-3500)
        .map((id) => this.lineage.get(id))
        .filter((rec): rec is LineageRec => rec !== undefined),
      events: this.events.slice(-120),
      history: this.history,
      sampleInterval: this.sampleInterval,
      flags: this.flags,
      organPeak: this.organPeak,
      organMilestone: this.organMilestone,
      births: this.births,
      deaths: this.deaths,
      maxGeneration: this.maxGeneration,
      autoEvents: this.autoEvents,
      rescueEnabled: this.rescueEnabled,
      immigrants: this.immigrants,
      nutrientMultiplier: this.nutrientMultiplier,
      climate: this.climate,
      wind: this.wind,
    };
  }

  /** Kayıttan simülasyon kurar. Geçersiz veride hata fırlatır (çağıran yakalar). */
  public static load(data: SaveData): Sim {
    if (!data || data.version !== SAVE_VERSION || !Array.isArray(data.creatures) || !Number.isFinite(data.seed)) {
      throw new Error("Bu dosya geçerli bir Evosim kaydı değil ya da eski bir sürüme ait.");
    }
    data = cleanSave(data);
    const sim = new Sim(data.seed, false);
    sim.time = data.time;
    sim.nextId = data.nextId;
    sim.nextSpeciesId = data.nextSpeciesId;
    for (const s of data.species) sim.species.set(s.id, { ...s, series: s.series ?? [], infected: 0 });
    for (const rec of data.lineage) {
      sim.lineage.set(rec.id, rec);
      sim.lineageOrder.push(rec.id);
    }
    const byId = new Map<number, Creature>();
    for (const e of data.creatures) {
      const c = sim.makeCreature(e.g, e.x, e.y, null);
      c.energy = Math.min(c.maxEnergy, Math.max(0.1, e.energy));
      c.hp = Math.min(c.maxHp, Math.max(0.1, e.hp));
      c.age = e.age;
      c.divideCd = e.divideCd;
      c.infectedT = e.infectedT ?? 0;
      c.immuneT = e.immuneT ?? 0;
      c.bornT = 0;
      sim.creatures.push(c);
      byId.set(c.id, c);
    }
    data.creatures.forEach((e, i) => {
      const c = sim.creatures[i];
      const parent = e.parent ? byId.get(e.parent) : undefined;
      if (parent) {
        c.parent = parent;
        c.careT = Math.max(0, PARENTAL_CARE_SECONDS - e.age);
      }
      const host = e.host ? byId.get(e.host) : undefined;
      if (host) {
        c.host = host;
        c.state = "attached";
      }
    });
    sim.nutrients = data.nutrients.map(([x, y, land]) => ({ x, y, land: land === 1, age: 10, dead: false }));
    sim.eggs = data.eggs ?? [];
    sim.events = data.events ?? [];
    sim.eventSeq = sim.events.reduce((m, e) => Math.max(m, e.seq), 0);
    sim.history = data.history ?? [];
    sim.sampleInterval = data.sampleInterval ?? 2;
    sim.flags = data.flags ?? {};
    sim.organPeak = data.organPeak ?? {};
    sim.organMilestone = data.organMilestone ?? {};
    sim.births = data.births ?? 0;
    sim.deaths = { ...sim.deaths, ...data.deaths };
    sim.maxGeneration = data.maxGeneration ?? 0;
    sim.autoEvents = data.autoEvents ?? true;
    sim.rescueEnabled = data.rescueEnabled ?? true;
    sim.immigrants = data.immigrants ?? 0;
    sim.nutrientMultiplier = data.nutrientMultiplier ?? 1;
    sim.climate = data.climate ?? null;
    sim.wind = data.wind ?? null;
    sim.extinct = sim.creatures.length === 0 && sim.eggs.length === 0 && !sim.rescueEnabled;
    sim.updateEnv();
    rng.s = data.rng;
    return sim;
  }
}

/**
 * Kayıt verisi güvenilmez girdidir (dosyadan ya da yapıştırılan metinden gelir) ve
 * içindeki değerler arayüzde sayfaya yazılır. Yüklemeden önce her alan beklenen
 * türe zorlanır: sayılar sayı, metinler kısaltılmış düz metin, sıralı değerler
 * (diyet, organ, olay türü, ölüm nedeni) yalnızca bilinen değerlerden biri olur.
 */
function cleanSave(raw: SaveData): SaveData {
  const num = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  const str = (v: unknown): string => (typeof v === "string" ? v.slice(0, 240) : "");
  const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const organ = (v: unknown): v is OrganType => typeof v === "string" && Object.prototype.hasOwnProperty.call(ORGANS, v);
  const diet = (v: unknown): Diet => (DIETS.includes(v as Diet) ? (v as Diet) : "herbivore");
  const KINDS: EventKind[] = ["organ", "diet", "species", "world", "population", "gene", "stage", "disease"];
  const organRecord = (v: unknown): Partial<Record<OrganType, number>> => {
    const out: Partial<Record<OrganType, number>> = {};
    for (const [k, n] of Object.entries((v ?? {}) as Record<string, unknown>)) if (organ(k)) out[k] = num(n);
    return out;
  };
  const deaths = {} as Record<DeathCause, number>;
  for (const cause of Object.keys(DEATH_LABEL) as DeathCause[]) deaths[cause] = num((raw.deaths as Record<string, unknown> | undefined)?.[cause]);
  const flags: Record<string, boolean> = {};
  for (const [k, v] of Object.entries((raw.flags ?? {}) as Record<string, unknown>)) if (v === true && k.length < 60) flags[k] = true;
  return {
    version: raw.version,
    seed: num(raw.seed) >>> 0,
    time: Math.max(0, num(raw.time)),
    rng: num(raw.rng) >>> 0,
    nextId: Math.max(1, Math.floor(num(raw.nextId, 1))),
    nextSpeciesId: Math.max(1, Math.floor(num(raw.nextSpeciesId, 1))),
    creatures: list<SaveData["creatures"][number]>(raw.creatures)
      .slice(0, MAX_CREATURES)
      .map((e) => ({
        g: sanitizeGenome(e?.g),
        x: Math.min(MAP_W - 4, Math.max(4, num(e?.x, MAP_W / 2))),
        y: Math.min(MAP_H - 4, Math.max(4, num(e?.y, MAP_H / 2))),
        energy: num(e?.energy, 10),
        hp: num(e?.hp, 1),
        age: Math.max(0, num(e?.age)),
        divideCd: Math.max(0, num(e?.divideCd)),
        parent: num(e?.parent),
        host: num(e?.host),
        infectedT: Math.max(0, num(e?.infectedT)),
        immuneT: Math.max(0, num(e?.immuneT)),
      })),
    nutrients: list<[number, number, number]>(raw.nutrients)
      .slice(0, 2000)
      .map((n) => [num(n?.[0]), num(n?.[1]), n?.[2] === 1 ? 1 : 0] as [number, number, number]),
    eggs: list<Egg>(raw.eggs)
      .slice(0, MAX_CREATURES)
      .map((e) => ({
        x: num(e?.x, MAP_W / 2),
        y: num(e?.y, MAP_H / 2),
        g: sanitizeGenome(e?.g),
        t: num(e?.t, 5),
        parentIds: [num(e?.parentIds?.[0]), num(e?.parentIds?.[1])] as [number, number],
        parentGenomes: list<Genome>(e?.parentGenomes).slice(0, 2).map(sanitizeGenome),
        bonus: Math.min(1, Math.max(0, num(e?.bonus))),
      }))
      .filter((e) => e.parentGenomes.length > 0),
    species: list<Species>(raw.species)
      .slice(0, 5000)
      .map((s) => ({
        id: Math.floor(num(s?.id)),
        name: str(s?.name),
        genus: str(s?.genus),
        parentId: Math.floor(num(s?.parentId)),
        born: num(s?.born),
        extinct: num(s?.extinct, -1),
        count: 0,
        peak: Math.floor(num(s?.peak)),
        total: Math.floor(num(s?.total)),
        established: s?.established === true,
        type: sanitizeGenome(s?.type),
        reason: str(s?.reason),
        series: list<number>(s?.series).slice(0, SERIES_CAP * 2).map((v) => num(v)),
        infected: 0,
      })),
    lineage: list<LineageRec>(raw.lineage)
      .slice(-LINEAGE_CAP)
      .map((r) => ({
        id: Math.floor(num(r?.id)),
        p1: Math.floor(num(r?.p1)),
        p2: Math.floor(num(r?.p2)),
        gen: Math.floor(num(r?.gen)),
        sp: Math.floor(num(r?.sp)),
        born: num(r?.born),
        died: num(r?.died, -1),
        cause: Object.prototype.hasOwnProperty.call(DEATH_LABEL, r?.cause ?? "") ? r.cause : "",
        diet: diet(r?.diet),
        organs: list<unknown>(r?.organs).filter(organ),
        notes: list<unknown>(r?.notes).slice(0, 12).map(str),
      })),
    events: list<SimEvent>(raw.events)
      .slice(-EVENT_LOG_CAP)
      .map((e) => ({ seq: Math.floor(num(e?.seq)), t: num(e?.t), kind: KINDS.includes(e?.kind) ? e.kind : "world", text: str(e?.text) })),
    history: list<HistorySample>(raw.history)
      .slice(-HISTORY_CAP)
      .map((h) => ({ t: num(h?.t), diets: DIETS.map((_, i) => Math.floor(num(h?.diets?.[i]))), nutrients: Math.floor(num(h?.nutrients)), species: Math.floor(num(h?.species)), oxygen: num(h?.oxygen, 0.5) })),
    sampleInterval: Math.max(2, num(raw.sampleInterval, 2)),
    flags,
    organPeak: organRecord(raw.organPeak),
    organMilestone: organRecord(raw.organMilestone),
    births: Math.floor(num(raw.births)),
    deaths,
    maxGeneration: Math.floor(num(raw.maxGeneration)),
    autoEvents: raw.autoEvents !== false,
    rescueEnabled: raw.rescueEnabled !== false,
    immigrants: Math.floor(num(raw.immigrants)),
    nutrientMultiplier: Math.min(3, Math.max(0.2, num(raw.nutrientMultiplier, 1))),
    climate: raw.climate ? { warm: raw.climate.warm === true, meta: num(raw.climate.meta, 1), nutrient: num(raw.climate.nutrient, 1), left: num(raw.climate.left) } : null,
    wind: raw.wind ? { vx: num(raw.wind.vx), vy: num(raw.wind.vy), angle: num(raw.wind.angle), left: num(raw.wind.left) } : null,
  };
}

export const SAVE_VERSION = 3;

export interface SaveData {
  version: number;
  seed: number;
  time: number;
  rng: number;
  nextId: number;
  nextSpeciesId: number;
  creatures: { g: Genome; x: number; y: number; energy: number; hp: number; age: number; divideCd: number; parent: number; host: number; infectedT: number; immuneT: number }[];
  nutrients: [number, number, number][];
  eggs: Egg[];
  species: Species[];
  lineage: LineageRec[];
  events: SimEvent[];
  history: HistorySample[];
  sampleInterval: number;
  flags: Record<string, boolean>;
  organPeak: Partial<Record<OrganType, number>>;
  organMilestone: Partial<Record<OrganType, number>>;
  births: number;
  deaths: Record<DeathCause, number>;
  maxGeneration: number;
  autoEvents: boolean;
  rescueEnabled: boolean;
  immigrants: number;
  nutrientMultiplier: number;
  climate: Sim["climate"];
  wind: Sim["wind"];
}
