import { Genome } from "./genome";
import { ALL_ORGAN_TYPES, OrganType } from "./organs";

/**
 * Faz I (v3) — Kaydet/Yükle, mikroorganizma genomuna ve düz-harita (x,y) konumuna göre
 * güncellendi. Sağlamlık felsefesi v2'den korunuyor: **ya tam kabul ya tam red**
 * (`isValidSaveData` tüm şekli tek seferde doğrular; herhangi bir alan beklenmedik/
 * eksik/bozuksa TÜM kayıt reddedilir, çağıran taraf sessizce yeni rastgele bir
 * popülasyonla başlar).
 *
 * Faz II (v3) — genoma `organs: Organ[]` eklendi. Save-key sürümü v3'e çıkarıldı —
 * eski v2 kayıtları (organsız genom şekli) otomatik reddediliyor (aynı "ya tam kabul
 * ya tam red" felsefesi).
 *
 * Faz VII (v3) — genoma `reproductionStrategy`/`laysEggs` eklendi. Save-key sürümü
 * v4'e çıkarıldı — eski v3 kayıtları (bu alanlar olmadan) otomatik reddediliyor.
 *
 * Faz IX (v3) — genoma `diet` (otçul/etçil) eklendi. Save-key sürümü v5'e çıkarıldı —
 * eski v4 kayıtları (bu alan olmadan) otomatik reddediliyor (aynı "ya tam kabul ya tam
 * red" felsefesi).
 *
 * Faz IX (v3, devam) — kullanıcı isteğiyle genoma `maxLifespan` (yaşlanma ölümü)
 * eklendi. Save-key sürümü v6'ya çıkarıldı — eski v5 kayıtları otomatik reddediliyor.
 *
 * Faz VIII (v3) — Rastgele harita (TASKS.md): `World`'ün artık sabit değil,
 * rastgele/değişken bir seed'i var (`generateMapSeed`, bkz. `world.ts`). Bir kayıt
 * yüklenirken haritanın da AYNI seed ile yeniden üretilmesi gerekiyor — aksi halde
 * kaydedilen canlı konumları yeni (farklı) bir haritada anlamsız olurdu (karada
 * kaydedilen bir birey yeni haritada su altında kalabilirdi). `SaveData`'ya
 * `mapSeed: number` eklendi, save-key sürümü v7'ye çıkarıldı — eski v6 kayıtları
 * (bu alan olmadan) otomatik reddediliyor (aynı "ya tam kabul ya tam red" felsefesi).
 *
 * ÖNEMLİ (kullanıcı notu, bu turun görevi): `SAVE_VERSION` değiştiğinde main.ts'teki
 * TÜM save-YAZMA noktalarının (otomatik kayıt + `beforeunload`) senkron olması
 * ZORUNLU — geçmişte biri güncellenip diğeri unutulunca (sabit `version: 6` gibi)
 * `isValidSaveData`'nın `d.version !== SAVE_VERSION` kontrolü kendi yazdığı kaydı
 * reddedip kaydet/yükle'yi görünmez şekilde bozuyordu. Bu yüzden `main.ts` artık
 * `version: 6` gibi bir SAYI LİTERALİ YAZMIYOR — `SAVE_VERSION`'ı buradan import
 * edip kullanıyor, aynı hatanın tekrarı yapısal olarak engellenmiş oluyor.
 *
 * Not (2026-09-03): Faz XI'de eklenen çoklu kayıt slotu özelliği kullanıcı isteğiyle
 * TAMAMEN KALDIRILDI — `loadSaveData`/`writeSaveData`/`clearSaveData` artık parametre
 * almıyor, tek/varsayılan localStorage anahtarını (`SAVE_KEY`) kullanıyor. Dışa/İçe
 * Aktarma (`exportimport.ts`) bu özellikten bağımsızdı ve değişmedi.
 */

const SAVE_KEY = "evrimsel-gezegen-save-v8"; // Faz XVII Madde 2 (packHunter geni) ile format değişti — eski v7 kayıtları artık geçersiz/reddedilir
export const SAVE_VERSION = 8;

export interface SavedCreature {
  genome: Genome;
  x: number;
  y: number;
  energy: number;
  age: number;
}

export interface SaveData {
  version: number;
  creatures: SavedCreature[];
  totalBirths: number;
  historicalMaxGeneration: number;
  simulationTime: number;
  /** Faz VIII — bu kayıtta kullanılan harita seed'i (bkz. `world.ts` `generateMapSeed`).
   *  Yükleme sırasında `World` bu seed ile yeniden üretilir ki canlı konumları
   *  anlamsız hale gelmesin. */
  mapSeed: number;
}

const GENOME_NUMERIC_FIELDS: (keyof Genome)[] = [
  "seed",
  "id",
  "radius",
  "hue",
  "saturation",
  "lightness",
  "moveSpeed",
  "senseRadius",
  "metabolism",
  "divideEnergyFraction",
  "generation",
  "maxLifespan",
];

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isValidOrgan(o: unknown): boolean {
  if (!o || typeof o !== "object") return false;
  const organ = o as Record<string, unknown>;
  if (typeof organ.type !== "string" || !ALL_ORGAN_TYPES.includes(organ.type as OrganType)) return false;
  if (!isFiniteNumber(organ.power)) return false;
  return true;
}

function isValidGenome(g: unknown): g is Genome {
  if (!g || typeof g !== "object") return false;
  const genome = g as Record<string, unknown>;
  for (const key of GENOME_NUMERIC_FIELDS) {
    if (!isFiniteNumber(genome[key])) return false;
  }
  const parentIds = genome.parentIds;
  if (parentIds !== null) {
    if (!Array.isArray(parentIds) || parentIds.length !== 2) return false;
    if (!isFiniteNumber(parentIds[0]) || !isFiniteNumber(parentIds[1])) return false;
  }
  if (!Array.isArray(genome.organs) || !genome.organs.every(isValidOrgan)) return false;
  if (genome.reproductionStrategy !== "asexual" && genome.reproductionStrategy !== "sexual") return false;
  if (typeof genome.laysEggs !== "boolean") return false;
  if (genome.diet !== "herbivore" && genome.diet !== "carnivore") return false;
  if (typeof genome.packHunter !== "boolean") return false;
  return true;
}

function isValidSavedCreature(entry: unknown): entry is SavedCreature {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  if (!isFiniteNumber(e.x) || !isFiniteNumber(e.y) || !isFiniteNumber(e.energy) || !isFiniteNumber(e.age)) return false;
  return isValidGenome(e.genome);
}

/** Faz XI — Dışa/İçe aktarma (TASKS.md): localStorage yükleme (`loadSaveData`) VE
 *  dosyadan içe aktarma (`exportimport.ts`) AYNI "ya tam kabul ya tam red" doğrulama
 *  mantığını kullansın diye export edildi. Davranış değişmedi, sadece görünürlük. */
export function isValidSaveData(data: unknown): data is SaveData {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (d.version !== SAVE_VERSION) return false;
  if (!Array.isArray(d.creatures)) return false;
  if (!isFiniteNumber(d.totalBirths) || !isFiniteNumber(d.historicalMaxGeneration)) return false;
  if (!isFiniteNumber(d.simulationTime)) return false;
  if (!isFiniteNumber(d.mapSeed)) return false;
  return d.creatures.every(isValidSavedCreature);
}

export function loadSaveData(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidSaveData(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSaveData(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Kaydetme başarısız oldu (localStorage), devam ediliyor:", err);
  }
}

export function clearSaveData(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Yok sayılır.
  }
}
