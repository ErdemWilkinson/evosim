import { rng } from "./rng";

/**
 * Açık organ havuzu. Her organın `description` metni, `sim.ts` içindeki `derive()`
 * fonksiyonunda (ya da orada adı geçen sabitlerde) uygulanan GERÇEK mekanik etkiyi
 * anlatır — metin ile kod ayrışırsa hata metindedir. Sabit bir evrim sırası yoktur;
 * tek yapısal kısıt, bazı organların belli bir örgütlenme düzeyini gerektirmesidir
 * (`stage`: 0 tek hücre, 1 koloni, 2 çok hücreli; 3 süperorganizma organ gerektirmez, çok hücrelinin üstüne kurulur).
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
  | "ganglion"
  | "magnetosome"
  | "pit_organ"
  | "mouth"
  | "stomach"
  | "symbiotic_gut_flora"
  | "sulfur_vent_organ"
  | "filter_comb"
  | "pigment"
  | "kleptoplast"
  | "shell"
  | "spike"
  | "camouflage"
  | "chromatophore"
  | "venom"
  | "claw"
  | "regeneration"
  | "ink_sac"
  | "mucus_coat"
  | "electric_organ"
  | "gill"
  | "lung"
  | "heart"
  | "torpor"
  | "blubber"
  | "nitrogen_sac"
  | "fat_store"
  | "swim_bladder"
  | "brood_pouch"
  | "immune_gland"
  | "gas_vesicle";

export interface Organ {
  type: OrganType;
  /**
   * 0.05–1 arası gelişmişlik. Yeni organ ~0,1 ile tomurcuk olarak doğar (küçük çizilir, az iş görür, az enerji yer);
   * soydan soya mutasyonla büyüyebilir, 1'de tam gelişmiş organ olur (en büyük ve en güçlü, en pahalı).
   */
  power: number;
}

/** Yeni ortaya çıkan (mutasyon ya da yatay gen transferi) organın başlangıç gücü aralığı. */
export const ORGAN_BIRTH_POWER: [number, number] = [0.07, 0.14];

/** Tam gelişmiş (güç 1) bir organın metabolizmaya eklediği oran; güçle doğru orantılıdır. */
export const ORGAN_UPKEEP = 0.04;

export interface OrganDefinition {
  category: OrganCategory;
  label: string;
  /** İlk kez kazanılma ağırlığı (havuzdan seçilirken). */
  weight: number;
  /** Gereken en düşük örgütlenme düzeyi. */
  stage: 0 | 1 | 2;
  description: string;
  /** Yalnızca belirli gezegen kimyasında ortaya çıkabilen organlar (bkz. planet.ts). */
  planet?: "nitrogen" | "sulfur" | "iron" | "ionic";
}

const o = (category: OrganCategory, label: string, weight: number, stage: 0 | 1 | 2, description: string, planet?: OrganDefinition["planet"]): OrganDefinition => ({ category, label, weight, stage, description, planet });

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
  magnetosome: o("sense", "Manyetozom", 0.3, 0, "Manyetik alana göre yön tutar: çözünmüş besinin ve av izinin yönünü 1,5–2 kat uzaktan örnekler ve bulduğu yönü 1,5–2 kat uzun izler. Yalnızca demirli gezegenlerde ortaya çıkar.", "iron"),
  pit_organ: o("sense", "Kızılötesi Çukuru", 0.25, 2, "Yalnızca karada: avı ısısından 25–60 birim daha uzaktan fark eder (sıvı kızılötesini emdiği için suda işe yaramaz)."),
  ganglion: o("sense", "Beyin", 0.5, 2, "Karar ağına ortam bağlamı ekler: derin suda, sığ suda, karada ve gece ayrı ağırlık katmanları, gücüne göre %50–100 oranında temel ağırlıklara eklenir. Uyaranları tek yerde topladığı için kararlar %20–40 daha sık verilir. Pahalı dokudur: metabolizmayı ayrıca %8'e kadar artırır."),
  mouth: o("feeding", "Ağız/Çene", 1, 0, "Besinden alınan enerjiyi %20–60 artırır."),
  stomach: o("feeding", "Mide", 0.45, 1, "Besinden alınan enerjiyi ağızdan bağımsız olarak %10–30 artırır."),
  symbiotic_gut_flora: o("feeding", "Bağırsak Florası", 0.35, 0, "Besinden alınan enerjiyi %5–15 artırır."),
  sulfur_vent_organ: o("feeding", "Kemosentez Organı", 0.4, 0, "Derin suda kükürt bileşiklerinden pasif enerji üretir. Yalnızca kükürtçe zengin gezegenlerde ortaya çıkar.", "sulfur"),
  filter_comb: o("feeding", "Süzgeç Tarağı", 0.4, 0, "Süzerek beslenmenin verimini %40–100 artırır (yalnızca süzücülerde etkili)."),
  pigment: o("feeding", "Işık Pigmenti", 0.4, 0, "Fotosentez verimini %25–60 artırır (yalnızca fotosentetiklerde etkili)."),
  kleptoplast: o("feeding", "Çalıntı Kloroplast", 0.3, 0, "Otçul ve hepçillerde: yediği üreticilerin kloroplastlarını saklar; enerjisi dolana dek ışıktan, bir fotosentetiğin aldığının %8–20'si kadar pasif enerji alır."),
  shell: o("defense", "Kabuk", 0.6, 0, "Alınan hasarı %30'a kadar azaltır ve canı artırır; karşılığında metabolizmayı %20'ye kadar yükseltir."),
  spike: o("defense", "Diken", 0.6, 0, "Alınan hasarı %25'e kadar azaltır."),
  camouflage: o("defense", "Kamuflaj", 0.8, 0, "Avcılar bu bireyi %20–50 daha kısa mesafeden fark eder."),
  chromatophore: o("defense", "Kromatofor", 0.35, 1, "Üzerine gelen saldırıların %15–45'i ıskalar."),
  venom: o("defense", "Zehir Bezi", 0.35, 0, "Her saldırıda saldırgana karşı hasar verir; zayıf bir avcıyı öldürebilir."),
  claw: o("defense", "Pençe", 0.55, 1, "Saldırı hasarını gücüne göre belirgin biçimde artırır."),
  regeneration: o("defense", "Rejenerasyon", 0.35, 0, "Yaralar 2–5 kat hızlı iyileşir."),
  ink_sac: o("defense", "Mürekkep Kesesi", 0.3, 1, "İsabet alınca %30–60 olasılıkla saldırganı 2,5 saniye saldıramaz hâle getirir."),
  electric_organ: o("defense", "Elektrik Organı", 0.25, 2, "Yalnızca sıvıda: saldırı hasarını %20–50 artırır; isabet alınca %20–50 olasılıkla saldırganı 1,5 saniye saldıramaz hâle getirir. Yalnızca sodyumlu ya da potasyumlu gezegenlerde ortaya çıkar.", "ionic"),
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
  gas_vesicle: o("physiology", "Gaz Vezikülü", 0.35, 0, "Derin sıvıda ışığa yakın yüzer: orada aldığı ışığı, sığ sıvıyla aradaki farkın %40–80'i kadar artırır (yalnızca fotosentezde ve çalıntı kloroplastta etkili)."),
};

export const ORGAN_TYPES = Object.keys(ORGANS) as OrganType[];

/** Davranışın ve örgütlenmenin dayandığı yayınlar (Kaynakça penceresinde ayrı grup). */
export const ORGANISATION_REFS: readonly { name: string; ref: string }[] = [
  { name: "Beyin: av riskine göre davranış ve ortam seçimi", ref: "Lima & Dill 1990, Can. J. Zool. 68:619" },
  { name: "Beyin: korku manzarası (ortama göre değişen tehlike)", ref: "Brown, Laundré & Gurung 1999, J. Mammal. 80:385" },
  { name: "Beyin: av riskine göre ortam değiştirme (deneysel)", ref: "Werner, Gilliam, Hall & Mittelbach 1983, Ecology 64:1540" },
  { name: "Beyin: merkezi sinir sisteminin erken evrimi", ref: "Holland 2003, Nat. Rev. Neurosci. 4:617" },
  { name: "Beyin: sinir dokusunun enerji bedeli", ref: "Aiello & Wheeler 1995, Curr. Anthropol. 36:199" },
  { name: "Beyin: bilgi işlemenin enerji bedeli", ref: "Niven & Laughlin 2008, J. Exp. Biol. 211:1792" },
  { name: "Süperorganizma: eusosyalliğin kökeni ve yuva koşulu", ref: "Wilson & Hölldobler 2005, PNAS 102:13367" },
  { name: "Süperorganizma: eusosyalliğin evrimi", ref: "Nowak, Tarnita & Wilson 2010, Nature 466:1057" },
  { name: "Süperorganizma: karşı görüş (akraba seçilimi savunusu)", ref: "Abbot ve ark. 2011, Nature 471:E1" },
  { name: "Süperorganizma: akraba seçilimi", ref: "Hamilton 1964, J. Theor. Biol. 7:1" },
  { name: "Süperorganizma: büyük evrimsel geçişler", ref: "Szathmáry 2015, PNAS 112:10104" },
  { name: "Süperorganizma: ağızdan ağıza besin paylaşımı (trofalaksi)", ref: "LeBoeuf ve ark. 2016, eLife 5:e20375" },
];

/** Örgütlenme düzeyine göre taşınabilecek en çok organ tipi. */
export const ORGAN_SLOTS = [3, 5, 7, 7] as const;
export const STAGE_LABEL = ["Tek hücreli", "Koloni", "Çok hücreli", "Süperorganizma"] as const;
/** En yüksek örgütlenme düzeyi: süperorganizma (iş bölümü yapan, besin paylaşan akraba topluluğu). */
export const MAX_STAGE = 3;

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
