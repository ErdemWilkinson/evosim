import { rng } from "./rng";

/**
 * Açık organ havuzu. Her organın `description` metni, `sim.ts` içindeki `derive()`
 * fonksiyonunda (ya da orada adı geçen sabitlerde) uygulanan GERÇEK mekanik etkiyi
 * anlatır — metin ile kod ayrışırsa hata metindedir. Sabit bir evrim sırası yoktur;
 * tek yapısal kısıt, bazı organların belli bir örgütlenme düzeyini gerektirmesidir
 * (`stage`: 0 tek hücre, 1 koloni, 2 çok hücreli).
 */

export type OrganCategory = "movement" | "sense" | "feeding" | "defense" | "physiology";

export type OrganType =
  | "tentacle"
  | "fin"
  | "leg"
  | "wing"
  | "sucker"
  | "sprint_muscle"
  | "thicket_cutter"
  | "eyespot"
  | "eye"
  | "bioluminescence"
  | "olfactory"
  | "lateral_line"
  | "electroreceptor"
  | "mouth"
  | "stomach"
  | "symbiotic_gut_flora"
  | "sulfur_vent_organ"
  | "filter_comb"
  | "pigment"
  | "shell"
  | "spike"
  | "camouflage"
  | "chromatophore"
  | "venom"
  | "claw"
  | "regeneration"
  | "ink_sac"
  | "mucus_coat"
  | "gill"
  | "lung"
  | "heart"
  | "torpor"
  | "blubber"
  | "nitrogen_sac"
  | "fat_store"
  | "swim_bladder"
  | "brood_pouch"
  | "immune_gland";

export interface Organ {
  type: OrganType;
  /** 0.05–1 arası göreli güç; mutasyonla hafifçe kayar. */
  power: number;
}

export interface OrganDefinition {
  category: OrganCategory;
  label: string;
  /** İlk kez kazanılma ağırlığı (havuzdan seçilirken). */
  weight: number;
  /** Gereken en düşük örgütlenme düzeyi. */
  stage: 0 | 1 | 2;
  description: string;
  /** Yalnızca belirli gezegen kimyasında ortaya çıkabilen organlar. */
  planet?: "nitrogen" | "sulfur";
}

const o = (category: OrganCategory, label: string, weight: number, stage: 0 | 1 | 2, description: string, planet?: "nitrogen" | "sulfur"): OrganDefinition => ({ category, label, weight, stage, description, planet });

export const ORGANS: Record<OrganType, OrganDefinition> = {
  tentacle: o("movement", "Kamçı", 1, 0, "Suda hızı %30'a kadar artırır."),
  fin: o("movement", "Yüzgeç", 1, 1, "Suda hızı %90'a kadar artırır; bacaklı bireyin derin suya girmesini sağlar."),
  leg: o("movement", "Bacak", 0.7, 2, "Karaya çıkmayı sağlar ve karadaki hızı belirler. Yüzgeç ya da solungaç yoksa derin suya girilemez."),
  wing: o("movement", "Kanat", 0.3, 2, "Karada hızı %25'e kadar artırır ve sıradağları aşmayı sağlar (kanatsızlar için dağ geçilmezdir)."),
  sucker: o("movement", "Vantuz", 0.4, 0, "Rüzgârın sürüklemesini %60–100 azaltır."),
  sprint_muscle: o("movement", "Hızlı Kas Lifi", 0.4, 1, "Kaçarken ve avlanırken hızı %20–50 artırır; o sırada metabolizma %20 yükselir."),
  thicket_cutter: o("movement", "Örtü Biçici", 0.35, 1, "Sık örtünün büyük bedeni yavaşlatmasını %50–100 azaltır ve örtüde gizlenen avı o oranda daha uzaktan fark ettirir."),
  eyespot: o("sense", "Işık Noktası", 1, 0, "Algı menzilini 15–35 birim genişletir (gece etkisi yarıya iner)."),
  eye: o("sense", "Göz", 0.5, 2, "Algı menzilini 35–90 birim genişletir (gece etkisi yarıya iner)."),
  bioluminescence: o("sense", "Biyolüminesans", 0.35, 0, "Derin suda ve gece algı menzilini 20–50 birim genişletir."),
  olfactory: o("sense", "Koku Çukuru", 0.5, 0, "Besin ve cesetleri %40–100 daha uzaktan bulur (canlıları algılamayı etkilemez)."),
  lateral_line: o("sense", "Yanal Çizgi", 0.4, 1, "Suda avcıları %50–100 daha uzaktan fark eder."),
  electroreceptor: o("sense", "Elektroreseptör", 0.3, 1, "Suda avın kamuflajını etkisiz kılar."),
  mouth: o("feeding", "Ağız/Çene", 1, 0, "Besinden alınan enerjiyi %20–60 artırır."),
  stomach: o("feeding", "Mide", 0.45, 1, "Besinden alınan enerjiyi ağızdan bağımsız olarak %10–30 artırır."),
  symbiotic_gut_flora: o("feeding", "Bağırsak Florası", 0.35, 0, "Besinden alınan enerjiyi %5–15 artırır."),
  sulfur_vent_organ: o("feeding", "Kemosentez Organı", 0.4, 0, "Derin suda kükürt bileşiklerinden pasif enerji üretir. Yalnızca kükürtçe zengin gezegenlerde ortaya çıkar.", "sulfur"),
  filter_comb: o("feeding", "Süzgeç Tarağı", 0.4, 0, "Süzerek beslenmenin verimini %40–100 artırır (yalnızca süzücülerde etkili)."),
  pigment: o("feeding", "Işık Pigmenti", 0.4, 0, "Fotosentez verimini %25–60 artırır (yalnızca fotosentetiklerde etkili)."),
  shell: o("defense", "Kabuk", 0.6, 0, "Alınan hasarı %30'a kadar azaltır ve canı artırır; karşılığında metabolizmayı %20'ye kadar yükseltir."),
  spike: o("defense", "Diken", 0.6, 0, "Alınan hasarı %25'e kadar azaltır."),
  camouflage: o("defense", "Kamuflaj", 0.8, 0, "Avcılar bu bireyi %20–50 daha kısa mesafeden fark eder."),
  chromatophore: o("defense", "Kromatofor", 0.35, 1, "Üzerine gelen saldırıların %15–45'i ıskalar."),
  venom: o("defense", "Zehir Bezi", 0.35, 0, "Her saldırıda saldırgana karşı hasar verir; zayıf bir avcıyı öldürebilir."),
  claw: o("defense", "Pençe", 0.55, 1, "Saldırı hasarını gücüne göre belirgin biçimde artırır."),
  regeneration: o("defense", "Rejenerasyon", 0.35, 0, "Yaralar 2–5 kat hızlı iyileşir."),
  ink_sac: o("defense", "Mürekkep Kesesi", 0.3, 1, "İsabet alınca %30–60 olasılıkla saldırganı 2,5 saniye saldıramaz hâle getirir."),
  mucus_coat: o("defense", "Mukus Tabakası", 0.4, 0, "Parazitlerin tutunma girişimlerinin %40–80'ini boşa çıkarır."),
  gill: o("physiology", "Solungaç", 0.5, 1, "Oksijen düşükken sudaki metabolizma kaybını azaltır; bacaklı bireyin derin suya girmesini sağlar."),
  lung: o("physiology", "Akciğer", 0.5, 2, "Karada oksijen bolken metabolizmayı düşürür, oksijen azken yükseltir."),
  heart: o("physiology", "Kalp", 0.45, 1, "Metabolizma tüketimini %10–25 azaltır."),
  torpor: o("physiology", "Kışlama Bezi", 0.4, 0, "Enerji %20'nin altına düşünce metabolizmayı %35–70 yavaşlatır."),
  blubber: o("physiology", "İzolasyon Tabakası", 0.4, 1, "İklim dalgalarının ve kışın metabolizmaya etkisini %40–80 sönümler."),
  nitrogen_sac: o("physiology", "Azot Deposu", 0.4, 0, "Metabolizma tüketimini %8–20 azaltır. Yalnızca azotu orta ya da yüksek gezegenlerde ortaya çıkar.", "nitrogen"),
  fat_store: o("physiology", "Yağ Deposu", 0.45, 1, "Depolanabilen en yüksek enerjiyi %20–50 artırır."),
  swim_bladder: o("physiology", "Yüzme Kesesi", 0.4, 1, "Suda gezinirken ya da dinlenirken metabolizmayı %10–25 düşürür."),
  brood_pouch: o("physiology", "Kuluçka Kesesi", 0.35, 1, "Yavrular %20–50 daha fazla enerjiyle doğar."),
  immune_gland: o("physiology", "Bağışıklık Bezi", 0.4, 1, "Hastalığa yakalanma olasılığını %40–80 düşürür."),
};

export const ORGAN_TYPES = Object.keys(ORGANS) as OrganType[];

/** Örgütlenme düzeyine göre taşınabilecek en çok organ tipi. */
export const ORGAN_SLOTS = [3, 5, 7] as const;
export const STAGE_LABEL = ["Tek hücreli", "Koloni", "Çok hücreli"] as const;

export const CATEGORY_LABEL: Record<OrganCategory, string> = {
  movement: "Hareket",
  sense: "Algı",
  feeding: "Beslenme",
  defense: "Savunma/Saldırı",
  physiology: "Fizyoloji",
};

export function organPower(organs: readonly Organ[], type: OrganType): number | undefined {
  for (const organ of organs) if (organ.type === type) return organ.power;
  return undefined;
}

/** Bu gezegende ortaya çıkamayan organlar (bkz. planet.ts). */
let forbidden: ReadonlySet<OrganType> = new Set();

export function setForbiddenOrgans(types: readonly OrganType[]): void {
  forbidden = new Set(types);
}

export function isForbidden(type: OrganType): boolean {
  return forbidden.has(type);
}

/** Bir organ bu düzeydeki, bu organlara sahip bir bireye eklenebilir mi? */
export function canHostOrgan(organs: readonly Organ[], stage: number, type: OrganType): boolean {
  return !forbidden.has(type) && ORGANS[type].stage <= stage && organs.length < ORGAN_SLOTS[stage] && organPower(organs, type) === undefined;
}

/** Sahip olunmayan, düzeye ve gezegene uygun tipler arasından ağırlıklı rastgele seçim. */
export function pickOrganType(organs: readonly Organ[], stage: number): OrganType | null {
  const pool = ORGAN_TYPES.filter((t) => canHostOrgan(organs, stage, t));
  if (pool.length === 0) return null;
  let total = 0;
  for (const t of pool) total += ORGANS[t].weight;
  let roll = rng.next() * total;
  for (const t of pool) {
    roll -= ORGANS[t].weight;
    if (roll <= 0) return t;
  }
  return pool[pool.length - 1];
}
