import { Diet, EvolutionSpeed, Genome } from "./genome";
import { OrganType } from "./organs";
import { Behavior, Flash, HistorySample, Inspection, SaveData, SimEvent, SpeciesStats, WorldEventKind } from "./sim";

/**
 * Simülasyon (Web Worker) ile arayüz (ana iş parçacığı) arasındaki mesajlar.
 * Arayüz simülasyon nesnelerine hiç dokunmaz: yalnızca komut gönderir ve kare alır.
 */

/** Kare başına canlı verisi: id, x, y, yön, enerji oranı, can oranı, bayraklar, davranış, olgunluk (0 yeni doğmuş, 1 erişkin). */
export const STRIDE = 9;
export const FLAG = { land: 1, infected: 2, flash: 4, hurt: 8, born: 16, immune: 32, attached: 64, hidden: 128 } as const;
/** Bitki konumları Uint16 çiftleridir: x·8 ve y·8; karadaysa y'nin en üst biti 1. */
export const PLANT_SCALE = 8;
export const PLANT_LAND_BIT = 0x8000;

export type Command =
  | { type: "init"; seed: number }
  | { type: "load"; data: SaveData }
  | { type: "speed"; value: number }
  | { type: "select"; id: number }
  | { type: "species"; id: number }
  | { type: "trigger"; kind: WorldEventKind; x?: number; y?: number }
  | { type: "plants"; x: number; y: number }
  | { type: "place"; x: number; y: number; template: number }
  | { type: "remove"; id: number }
  | { type: "organ"; id: number; organ: OrganType; power: number | null }
  | { type: "stage"; id: number; stage: number }
  | { type: "set"; autoEvents?: boolean; rescueEnabled?: boolean; nutrientMultiplier?: number; evolutionSpeed?: EvolutionSpeed }
  | { type: "save"; req: number }
  | { type: "rewind"; index: number };

export interface SpeciesInfo {
  id: number;
  name: string;
  parentId: number;
  born: number;
  extinct: number;
  count: number;
  peak: number;
  total: number;
  established: boolean;
  reason: string;
  diet: Diet;
  hue: number;
  stage: number;
  infected: number;
}

export interface CreatureDetail {
  id: number;
  alive: boolean;
  gv: number;
  genome: Genome;
  x: number;
  y: number;
  energy: number;
  maxEnergy: number;
  hp: number;
  maxHp: number;
  age: number;
  state: Behavior;
  onLand: boolean;
  infected: number;
  immune: number;
  parasites: number;
  hostId: number;
  sense: number;
  speed: number;
  metabolism: number;
  attack: number;
  inspection: Inspection;
}

export interface UiPayload {
  births: number;
  deaths: Record<string, number>;
  maxGeneration: number;
  immigrants: number;
  extinct: boolean;
  onLand: number;
  eggs: number;
  stages: [number, number, number];
  sexual: number;
  infected: number;
  oxygen: number;
  climate: { warm: boolean; left: number } | null;
  wind: { angle: number; left: number } | null;
  quakeLeft: number;
  diets: number[];
  organs: Record<OrganType, number>;
  species: SpeciesInfo[];
  history: HistorySample[];
  events: SimEvent[];
  snaps: number[];
  autoEvents: boolean;
  rescueEnabled: boolean;
  evolutionSpeed: EvolutionSpeed;
  nutrientMultiplier: number;
  speed: number;
  selected: CreatureDetail | null;
  speciesDetail: (SpeciesStats & { type: Genome }) | null;
  /** Çözünmüş besin: ızgara hücresi başına 0–255 (255 = en zengin bacanın kapasitesi). */
  soup: Uint8Array;
  /** İlk canlının genomu: DNA zinciri karşılaştırması bunun üzerinden yapılır. */
  origin: Genome | null;
  /** Son saniyede gerçekleşen simülasyon hızı (sim-sn / gerçek sn). */
  rate: number;
}

export interface Frame {
  type: "frame";
  epoch: number;
  seed: number;
  time: number;
  light: number;
  n: number;
  c: Float32Array;
  plants: Uint16Array;
  /** x, y, yarıçap, kalan oran, renk tonu */
  corpses: Float32Array;
  eggs: Float32Array;
  flashes: Flash[];
  genomes: [number, number, Genome][];
  worldVersion: number;
  quakes: { x: number; y: number; r: number; toWater: boolean }[];
  ui: UiPayload | null;
}

export type HostMessage = Frame | { type: "ready" } | { type: "saved"; req: number; data: SaveData } | { type: "note"; text: string };
