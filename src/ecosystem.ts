import { Container } from "pixi.js";
import { World } from "./world";
import { Creature } from "./creature";
import { Nutrient } from "./nutrient";
import {
  randomGenome,
  divideGenome,
  crossoverGenomes,
  resetGenomeIdCounter,
  ensureGenomeIdCounterAbove,
} from "./genome";
import { SavedCreature } from "./savegame";
import { ALL_ORGAN_TYPES, ORGAN_DEFINITIONS, Organ, OrganType } from "./organs";
import { DivisionEffect } from "./divisioneffect";
import { Corpse } from "./corpse";
import { Decomposer } from "./decomposer";
import { Egg } from "./egg";
import { Atmosphere } from "./atmosphere";

/**
 * Faz I (v3) — Mikroorganizma ekosistemi. v2'nin otçul/etçil/avlanma/uzuv mantığı
 * TAMAMEN kaldırıldı. Bu fazda tek davranış: suda gezin, yakın bir besin parçacığı
 * varsa ona yönel ve ye, enerji yeterince yüksekse ikiye bölün, enerji biterse öl.
 *
 * Faz II (v3) — Su→kara geçişi: bacak organı taşıyan bireyler artık karaya çıkabilir
 * ve orada da (aynı `Nutrient` sistemiyle, ayrı bir kara besin havuzu üzerinden)
 * beslenebilir (TASKS.md — "Su → kara geçişi... orada da hayatta kalabilmeli/
 * beslenebilmeli"). Bacaksız bireyler için kara hâlâ tamamen yasak — `moveWithinWater`
 * artık `moveCreature` olarak genelleşti, ama karaya izin şartı `creature.canWalkOnLand()`.
 */

const BASE_MAX_NUTRIENTS = 120;
const BASE_MAX_LAND_NUTRIENTS = 60;
const NUTRIENT_SPAWN_INTERVAL: [number, number] = [0.25, 0.6];
/**
 * Faz IV düzeltmesi — kök neden analizi (2026-09-01, Playwright ile 4x hızda 240s'lik
 * SENKRON koşularla ölçüldü, bkz. TASKS.md "Faz IV — Detaylar"). İki ayrı bulgu:
 *
 * BULGU 1 (yetersiz ama gerekli düzeltme): Faz II'nin popülasyona göre ölçeklenen
 * üretim HIZI (`nutrientSpawnRateMultiplier`) tek başına yeterli değildi, çünkü besin
 * STOKU (`MAX_NUTRIENTS`) sabit (160) kalıyordu. Popülasyon `MAX_CREATURES` tavanına
 * (140) yapıştığında toplam metabolizma talebi sabit stokun sağlayabileceği akışı
 * aşıyor, stok "dolu" görünse bile marjinal bir dengede kalıyordu — küçük bir
 * dalgalanma enerji oranını düşürmeye başlayınca `nutrientSpawnRateMultiplier`
 * DOĞRUDAN popülasyona bağlı olduğundan üretim de düşüyor, toparlanma imkansızlaşıp
 * tam çöküşe (140→0) gidiyordu. Bunu `nutrientCapacity` (popülasyonla büyüyen tavan)
 * ile düzelttim, AMA ÖLÇÜM GÖSTERDİ Kİ TEK BAŞINA YETERSİZ KALDI: tavanı 160'tan
 * 300+'a çıkarmama rağmen bir sonraki 240s'lik koşuda popülasyon YİNE 140→0 çöktü,
 * üstelik nutrient stoku o sırada 312 (bol) idi — yani "besin miktarı" gerçek kök
 * neden DEĞİLMİŞ.
 *
 * BULGU 2 (gerçek kök neden): Sorun besin MİKTARI değil, besin ERİŞİLEBİLİRLİĞİ.
 * Nutrient'lar `randomWaterPoint()` ile TÜM su alanına (~752.000px², haritanın
 * %47'si) tamamen rastgele saçılıyordu. Birkaç yüz nutrient bu kadar geniş bir alana
 * dağılınca ortalama komşu mesafesi (~sqrt(alan/adet) ≈ 45-50px) canlıların
 * `senseRadius`ı (40-90px) ile aynı mertebede kalıyor — yani "stok bol" görünse de
 * çoğu nutrient hiçbir canlının algı menzilinde değildi, sadece şans eseri rastgele
 * gezinmeyle (`stepWander`) bulunabiliyordu. Popülasyon büyüdükçe bu "kör gezinme"
 * verimliliği daha da düşüyor, enerji oranı marjinal dengeden aniden düşüşe geçip
 * (140→61→2→0 gibi) geri dönüşsüz bir açlık sarmalına giriyordu. 5 bağımsız 240s'lik
 * ölçümden bu iki bulgudan ÖNCE 3'ünde tam çöküş gözlemlendi (yapısal, "nadir seed"
 * değil).
 *
 * Düzeltme (üç parça, hepsi birlikte gerekli — sadece 1) yetersiz kaldığı ölçümle
 * doğrulandı):
 * 1) `MAX_NUTRIENTS`/`MAX_LAND_NUTRIENTS` artık SABİT değil, popülasyonla birlikte
 *    büyüyen bir tavan (`nutrientCapacity`) — TASKS.md talebi: "besin üretim oranını
 *    popülasyon yoğunluğuna karşı dengele".
 * 2) `nutrientSpawnRateMultiplier` popülasyon düşerken üretimi aşırı düşürmüyor
 *    (taban hız korunuyor, toparlanma imkanı kalıyor).
 * 3) **Asıl belirleyici düzeltme**: `spawnPointNear` — yeni nutrient'ların
 *    `NEAR_CREATURE_SPAWN_CHANCE` (%75) ihtimalle TAMAMEN RASTGELE değil, rastgele
 *    seçilen canlı bir bireyin yakınına (20-70px ofsetle, su/kara kısıtına uyarak)
 *    doğması — "besin, canlıların bulunduğu yerde oluşur" sezgisiyle erişilebilirliği
 *    garanti eder. Kalan %25 hâlâ tamamen rastgele haritaya düşüyor ki keşfedilmemiş
 *    bölgelere yayılma teşviki tamamen kaybolmasın. Bu düzeltmeden SONRA yapılan 5
 *    bağımsız 240s'lik koşunun 5'i de (fixed_run2-6) hiç çökmeden/kritik düşüş
 *    yaşamadan dengede kaldı (enerji oranı ~0.5-0.87 aralığında dalgalandı).
 */
function nutrientCapacity(population: number, base: number): number {
  return base + population * 1.4;
}
function nutrientSpawnRateMultiplier(population: number): number {
  return 1 + population / 18;
}

/**
 * Faz XIII — Kök neden analizi (2026-09-03, gerçek kök neden — Faz IV'ün "erişilebilirlik"
 * düzeltmesi bunu ÇÖZMEMİŞTİ). Uzun (5+ dk, 4x hız) bağımsız koşularla ölçüldü: popülasyon
 * 140'ta sabitken (nutrient stoku ~305-316, cap'e yakın/dolu) rastgele küçük bir düşüş
 * (örn. birkaç bireyin aynı anda ölmesi, av/yaşlılık/vs — normal bir dalgalanma) tetiklendi.
 * `nutrientCapacity` ANINDA (aynı karede) popülasyonla orantılı düştüğü için
 * (`base + population*1.4`), stok zaten yeni (küçülmüş) cap'in ÜSTÜNDE kalıyor ve
 * `updateNutrientSpawning`/`updateLandNutrientSpawning`'deki `if (nutrients.length >= cap)
 * return;` kapısı TAMAMEN kapanıyor — YENİ nutrient spawn'ı anında durdu. Var olan stok
 * (305 gibi) SAYICA bol görünüyordu ama coğrafi olarak ÖNCEKİ (daha büyük) popülasyonun
 * konumlarına göre dağılmıştı; hayatta kalan azınlık farklı bir bölgede olabiliyordu ve
 * spawn durduğu için o bölgeye YENİ besin hiç gelmiyordu. Sonuç: enerji oranı gittikçe
 * düşüyor (avgE 0.49→0.00, ~27s içinde), nutrient sayısı ise TAMAMEN SABİT kalıyor
 * (305, hiç değişmiyor — ne tüketiliyor ne üretiliyor) — bu, "besin var ama erişilemiyor
 * VE yeni besin de gelmiyor" imzası, klasik bir GERİ BESLEMELİ ÇÖKÜŞ SARMALI (küçük düşüş
 * → cap düşer → spawn durur → hayatta kalanlar besin bulamaz → daha fazla ölüm → cap daha
 * da düşer → ...). Bunu Faz IV'ün "%75 canlıya yakın doğar" düzeltmesi TEK BAŞINA
 * ÇÖZEMİYORDU çünkü spawn zaten TAMAMEN DURMUŞTU — yakına doğma kuralının hiç çalışma
 * şansı kalmıyordu.
 *
 * DÜZELTME: `nutrientCapacity`/`nutrientSpawnRateMultiplier` artık ANLIK popülasyona değil,
 * YAVAŞ SÖNÜMLENEN (lagging) bir "etkin popülasyon" tahminine (`effectivePopulationForCapacity`)
 * göre hesaplanıyor — popülasyon ANİDEN düşse bile cap birkaç saniye içinde ANINDA
 * çökmüyor, `CAPACITY_LAG_HALFLIFE_SECONDS` yarı ömürlü bir üstel sönümle YUMUŞAK bir
 * geçiş yapıyor. Bu, spawn kapısının bir popülasyon dalgalanmasında anında kapanıp geri
 * dönüşsüz bir sarmalı tetiklemesini önlüyor — cap gerçek popülasyonun biraz "gerisinden"
 * geldiği için, azalan bir popülasyonda bile spawn bir süre daha (eski, daha yüksek cap'e
 * göre) devam edip hayatta kalanların besin bulma şansını koruyor. Popülasyon ARTARKEN de
 * aynı sönüm uygulanıyor (cap'in gereğinden hızlı şişip sonra aniden düşme riskini de
 * simetrik olarak önlüyor) — ama pratikte önemli olan DÜŞÜŞ yönündeki güvenlik.
 */
const CAPACITY_LAG_HALFLIFE_SECONDS = 20;

function decayTowards(current: number, target: number, dt: number, halfLifeSeconds: number): number {
  // Üstel sönüm: her `halfLifeSeconds` saniyede fark yarıya iner (dt küçük substep'lerde
  // bile tutarlı, çerçeve hızından bağımsız bir "yarı ömür" formülü).
  const factor = Math.pow(0.5, dt / halfLifeSeconds);
  return target + (current - target) * factor;
}
/** Yeni bir nutrient'ın rastgele bir canlının yakınına (tamamen rastgele haritaya
 *  değil) doğma olasılığı — erişilebilirliği garanti eder (bkz. `spawnPointNear`). */
const NEAR_CREATURE_SPAWN_CHANCE = 0.75;
const EAT_RADIUS = 10;
const MAX_CREATURES = 140;
const DIVIDE_COOLDOWN: [number, number] = [4, 8];
const DIVIDE_ENERGY_COST_FRACTION = 0.5;
const NEWBORN_ENERGY_FRACTION = 0.5;

/**
 * Faz VII (v3) — Çiftleşme (cinsel üreme, TASKS.md). Mevcut aseksüel `divideGenome`
 * bölünmesinin YANINDA, `Genome.reproductionStrategy==="sexual"` olan iki birey
 * (yakın mesafede, ikisi de üreme eşiğini geçmiş) eşleşip `crossoverGenomes` ile bir
 * yavru üretebilir. Aseksüel bölünme mekaniğine (üstteki sabitler/`updateDivision`)
 * HİÇ dokunulmadı — ikisi paralel/bağımsız çalışıyor, bazı bireyler bir stratejiyi
 * "kazanır", bazıları diğerine devam eder (TASKS.md: "ikisi de var olabilir").
 */
const MATING_RADIUS = 60; // px — TASKS.md "yakın mesafede"
const MATING_COOLDOWN: [number, number] = [5, 9]; // aseksüel bölünmeyle aynı mertebede

/**
 * Faz VII — Yumurtalama (TASKS.md): `Genome.laysEggs===true` olan bir ebeveynin yavrusu
 * hemen aktif doğmak yerine önce bir `Egg` nesnesi olur (bkz. `egg.ts`, süre 8-15s).
 */
/**
 * Faz VII — Yavru bakımı (TASKS.md): yeni doğan bir birey ebeveynine yakınken (basit
 * mesafe kontrolü) hafif bir metabolizma indirimi yaşar — karmaşık bir takip/AI
 * sistemi YOK. TASKS.md aralığı: "40-60px içinde".
 */
const PARENTAL_CARE_RADIUS = 50;
const PARENTAL_CARE_METABOLISM_REDUCTION = 0.3; // %30 daha az temel enerji kaybı

/** Bug-avı düzeltmesi (2026-09-10, PM onaylı): bir bireyin "ana organ tipi" —
 *  EN YÜKSEK `power` değerine sahip organ. Eşitlikte (iki organ aynı power'a sahipse)
 *  EN SON KAZANILAN (dizide daha yüksek indeksli) organ kazanır — `>=` karşılaştırması
 *  bunu sağlıyor (soy sona doğru tarandığı için sonraki eşit-power organ öncekini
 *  ezer), eski "en son kazanılan" davranışıyla tutarlı bir tie-break. */
function computeDominantOrganType(organs: readonly Organ[]): OrganType | null {
  let dominant: Organ | null = null;
  for (const o of organs) {
    if (!dominant || o.power >= dominant.power) dominant = o;
  }
  return dominant ? dominant.type : null;
}

export interface LineageRecord {
  id: number;
  parentIds: [number, number] | null;
  generation: number;
  bornAtSimTime: number;
  diedAtSimTime: number | null;
  /** Faz IX — Soy ağacından canlı seçimi (TASKS.md madde 6): ölmüş bir bireyin temel
   *  bilgilerini gösterebilmek için doğum anındaki organ envanteri ve diyet — bu bir
   *  "anlık görüntü" (birey öldükten sonra da erişilebilir olması için Creature
   *  referansına bağımlı değil, kendi kopyası). Doğum anındaki organlar tutuluyor
   *  (ölüm anında değil) çünkü "evrim geçmişi" ilgisi kazanılan organlar — bir birey
   *  yaşarken organ kazanmaz (organlar sadece bölünme/doğumda belirleniyor, bkz.
   *  genome.ts `divideGenome`/`mutateGenome`), yani doğum anındaki envanter zaten
   *  o bireyin YAŞAM BOYU envanteriyle aynı. */
  organs: OrganType[];
  /** Bug-avı düzeltmesi (2026-09-10, PM onaylı, kullanıcı isteği — "profesyonel
   *  soy ağacı" görünümü): soy ağacındaki düğüm halka rengini belirleyen "ana organ" —
   *  EN YÜKSEK `power` değerine sahip organ (eşitlikte EN SON KAZANILAN organ kazanır,
   *  eski davranışla tutarlı tie-break). `organs` alanı sadece tip listesi tuttuğundan
   *  (power bilgisi YOK) bu değer, `g.organs`'ın (power'lı ham genom verisi) doğum
   *  anında BİR KEZ hesaplanmasıyla ayrıca saklanıyor — `lineagetree.ts` artık kendi
   *  (yanlış belgelenmiş) heuristiğini yeniden hesaplamıyor, doğrudan bunu okuyor. */
  dominantOrganType: OrganType | null;
  diet: "herbivore" | "carnivore";
  /** Bu bireyin doğurduğu yavru sayısı (aseksüel bölünme + cinsel üreme + yumurta
   *  açılışı toplamı) — TASKS.md madde 6: "kaç yavru bıraktı". */
  offspringCount: number;
}

/**
 * Faz XVI Madde 1 (TASKS.md) — "özet düğüm" (summary node): bir soy dalının artık
 * TEK TEK bireyler olarak DEĞİL, tek bir özet kayıt olarak temsil edilmiş hali.
 * Kullanıcı gözlemi: eski FIFO budaması (`this.lineage.splice(0, overflow)`) eski
 * kayıtları TAMAMEN siliyordu — soy ağacında "hiçbir soy tamamen yok olmasın" isteği
 * karşılanmıyordu (ata zinciri bir noktada sessizce kesiliyordu, bkz.
 * `getAncestryChain` yorumu). Karar (gerekçe TASKS.md'de de tekrarlanıyor):
 * - Cap'i büyük ölçüde artırmak (alternatif a) TEK BAŞINA sorunu çözmüyor — sınırsız
 *   büyüyen bir dizi er ya da geç aynı soruna varır, sadece eşiği erteler; uzun bir
 *   oturumda (saatlerce açık kalan bir sekme) yine aynı kayıp yaşanır.
 * - Bunun yerine (alternatif b, SEÇİLEN): cap aşılınca en eski kayıtlar SİLİNMİYOR,
 *   bir "özet düğüm"e SIKIŞTIRILIYOR — birey sayısı, nesil aralığı ve o dönemde
 *   gözlemlenmiş organ tipleri toplamı hâlâ tutuluyor (bkz. `LineageSummaryNode`).
 *   Bu hem belleği sabit bir üst sınırda tutar (canlı ağaç + sınırlı sayıda özet
 *   düğüm — sınırsız büyümez) HEM DE "hiçbir soy tamamen yok olmasın" isteğini
 *   karşılar: özet düğüm ata zincirinin kökünde kalır, soy ağacı görselinde tek bir
 *   (daha büyük, etiketli) düğüm olarak gösterilir, tıklanabilir bir "kaç birey/hangi
 *   nesil aralığı" özeti sunar.
 */
export interface LineageSummaryNode {
  /** Özet düğümün kendi sentetik kimliği — gerçek genom id'leriyle çakışmasın diye
   *  negatif bir sayı kullanılıyor (gerçek genom id'leri hep >=1). */
  id: number;
  /** Bu özete sıkıştırılan gerçek bireylerin toplam sayısı. */
  individualCount: number;
  minGeneration: number;
  maxGeneration: number;
  /** Sıkıştırılan dönemde en az bir birey tarafından gerçekten taşınmış organ tipleri
   *  (birleşim/union) — uydurma yok, sadece "bu dönemde şunlar da vardı" bilgisi. */
  observedOrgans: OrganType[];
  /** Bu özete sıkıştırılan bireylerin (eğer varsa) soyunu devam ettiren, hâlâ
   *  budanmamış kayıtlara bağlanan ÇOCUK id'leri — özet düğüm ağaçta "kesik" bir uç
   *  olarak değil, gerçek torunlarına bağlanan bir kök olarak kalabilsin diye. */
  childIds: number[];
}

/**
 * Faz XVI Madde 1 — cap 500'den 4000'e çıkarıldı (canlı/tam-detaylı kayıt sayısı için
 * yeni üst sınır). Neden hâlâ bir cap var (sınırsız değil): performans testi (bkz.
 * TASKS.md güncellemesi) 4000 kayıtla bile soy ağacı render süresinin makul kaldığını
 * gösterdi, ama asıl koruma artık BU sayı değil — aşımda kayıtlar silinmiyor, özet
 * düğüme taşınıyor (yukarı bakınız). Cap'i çok büyük tutmanın (örn. 50000) tek başına
 * bir faydası yok (madem özetleme zaten var) ama çok küçük tutmak da (örn. 500) sık sık
 * özetleme tetikleyip "detaylı görünen" pencereyi gereksiz daraltırdı — 4000, tek bir
 * oturumda (TASKS.md'nin performans senaryolarında gözlemlenen nesil/birey hacimleri
 * göz önüne alınarak) saatlerce detaylı geçmiş sunacak kadar büyük, yine de bir üst
 * sınırı olan (bellek güvenliği) bir orta nokta.
 */
const MAX_LINEAGE_RECORDS = 4000;
/** Bir seferde budanan blok büyüklüğü — cap aşıldığında bu kadar EN ESKİ kayıt tek bir
 *  özet düğümde toplanır (çok sık, tek tek özetleme yerine, daha az/daha anlamlı özet
 *  düğüm — TASKS.md ruhuna uygun: "N birey, X-Y nesil arası" gibi kaba bir özet). */
const LINEAGE_SUMMARY_BLOCK_SIZE = 1000;

/**
 * Faz III (v3) — Neden/gerekçe şeffaflığı (TASKS.md). Event log'a gerçek, eşik
 * tabanlı gerekçeli olaylar düşürmek için popülasyon genelinde organ dağılımı ve
 * organ-taşıma/enerji ilişkisi periyodik olarak izleniyor. UYDURMA yok: her olay
 * doğrudan ölçülen bir sayıya (oran veya ortalama enerji farkı) dayanıyor, yeterli
 * örneklem olmadan (bkz. `MIN_GROUP_SIZE_FOR_ENERGY_COMPARISON`) karşılaştırma
 * yapılmıyor. Her eşik/kilometre taşı bir kez tetiklenir (bkz. `firedMilestones`/
 * `firedEnergyAdvantage`).
 */
const EVOLUTION_EVENT_CHECK_INTERVAL = 2; // saniye — sık ama sürekli olmayan kontrol
/** Popülasyonda bir organ tipini taşıyanların oranı bu eşiklerden birini ilk kez
 *  geçtiğinde bir olay düşer (TASKS.md örneği: "%20'yi geçti"). */
const PREVALENCE_MILESTONES = [0.2, 0.4, 0.6, 0.8] as const;
/** Oran karşılaştırması için minimum popülasyon (çok küçük popülasyonda %20 gibi
 *  eşikler anlamsız/gürültülü olur). */
const MIN_POPULATION_FOR_PREVALENCE = 10;
/**
 * Faz XI — Sürekli İyileştirme (organ trend oku, 2026-09-10, PM onaylı): inceleme
 * panelinde her organ satırının yanında "yayılıyor/azalıyor/stabil" göstermek için
 * gereken GERÇEK veri — `checkPrevalenceMilestones` SADECE tek yönlü (bir kez artışta
 * tetiklenen) eşik olayları tutuyordu, bir azalışı hiç yakalayamıyordu ve geçmiş
 * hiç saklanmıyordu. Uydurma bir yön göstermek TASKS.md'nin "Neden/gerekçe
 * şeffaflığı... uydurma yok" ilkesine aykırı olurdu — bu yüzden `checkPrevalenceMilestones`
 * ile AYNI 2 saniyelik döngüde (`updateEvolutionEvents`), her organ tipi için son
 * `PREVALENCE_TREND_SAMPLE_COUNT` (10) oranı tutan bir kayan pencere (ring-buffer)
 * eklendi. Yön, ilk yarı ortalaması ile ikinci yarı ortalamasının karşılaştırılmasıyla
 * (basit, sahte hassasiyet iddia etmeyen bir yöntem) türetiliyor. Yeterli örnek
 * birikmeden (`PREVALENCE_TREND_SAMPLE_COUNT`'tan az) `insufficient-data` döner —
 * "stabil" YALANI söylenmiyor, veri eksikliği açıkça belirtiliyor.
 */
const PREVALENCE_TREND_SAMPLE_COUNT = 10;
/** İki yarı ortalaması arasındaki fark bu payın altındaysa "stabil" sayılır (gürültüyü
 *  yanlışlıkla yön olarak yorumlamamak için küçük bir tolerans). */
const PREVALENCE_TREND_STABLE_THRESHOLD = 0.03;

export type OrganPrevalenceTrend = "up" | "down" | "stable" | "insufficient-data";
/** Enerji/hayatta kalma avantajı karşılaştırması için HER İKİ grupta da (taşıyan/
 *  taşımayan) en az bu kadar birey olmalı — TASKS.md "DÜRÜSTLÜK: yeterli örnek yoksa
 *  karşılaştırma yapma". */
const MIN_GROUP_SIZE_FOR_ENERGY_COMPARISON = 12;
/** Ortalama enerji oranı (energy/maxEnergy) farkının bu yüzdenin altında kalması
 *  durumunda olay tetiklenmez (TASKS.md örneği: "%15+"). */
const ENERGY_ADVANTAGE_THRESHOLD = 0.15;

export interface EvolutionEvent {
  simTime: number;
  text: string;
}

/** Faz XIII — İki açı arasında en kısa yoldan (dairesel — 359°→1° gibi durumları
 *  "uzun yoldan" karıştırmaz) `t` oranında bir ara açı hesaplar (0=from, 1=to).
 *  Sınır farkındalığı için kullanılıyor — "hafif yönelme" (TASKS.md), sert bir
 *  yön değişimi değil. */
function blendAngles(from: number, to: number, t: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}

/**
 * Faz XIII (opsiyonel madde 3) — Gemini'nin soy-bazlı davranış eğilimi önerisi.
 * `genome.ts`'teki `sexualStrategyMultiplier` (Faz VII) ile AYNI güvenlik felsefesi/
 * desen: modül seviyesinde küçük, SINIRLI (±0.2, toplamda MIN/MAX ile clamp'li) bir
 * ofset — ana davranış kararı (bkz. `Ecosystem.stepHerbivore`/`stepCarnivore`) HER
 * ZAMAN bu ofseti okuyarak senkron/lokal çalışır, Gemini çağrısının kendisi ASLA
 * karar döngüsünün bir parçası değil (öneri periyodik olarak main.ts'teki MEVCUT
 * düşük-sıklıklı Gemini döngüsünden gelir, gerçek zamanlı hareket kararına senkron
 * bir API çağrısı asla eklenmedi). Gemini hiç öneri yapmadıysa (veya başarısız
 * olduysa) ofsetler 0 kalır — eşikler tam olarak eskisi gibi davranır.
 */
const BEHAVIOR_ADJUSTMENT_MIN = -0.15;
const BEHAVIOR_ADJUSTMENT_MAX = 0.15;
/** Pozitif -> canlılar biraz daha geç "tehdit" sayıp kaçar (daha cesur); negatif ->
 *  daha erken/ürkek kaçar. Doğrudan flee-eşiği gibi kullanılmıyor (flee zaten mesafe
 *  tabanlı) — bunun yerine tokluk eşiklerine küçük bir ofset olarak uygulanıyor. */
let wanderBoldnessOffset = 0;
/** Pozitif -> tokluk eşiği biraz yükselir (besin aramaya daha istekli/geç tok
 *  sayılır); negatif -> tam tersi. */
let foragingPriorityOffset = 0;

export function applyGeminiBehaviorSuggestion(trait: "wanderBoldness" | "foragingPriority", delta: number): void {
  if (!Number.isFinite(delta)) return;
  const clampedDelta = Math.min(0.2, Math.max(-0.2, delta));
  if (trait === "wanderBoldness") {
    wanderBoldnessOffset = Math.min(
      BEHAVIOR_ADJUSTMENT_MAX,
      Math.max(BEHAVIOR_ADJUSTMENT_MIN, wanderBoldnessOffset + clampedDelta)
    );
  } else {
    foragingPriorityOffset = Math.min(
      BEHAVIOR_ADJUSTMENT_MAX,
      Math.max(BEHAVIOR_ADJUSTMENT_MIN, foragingPriorityOffset + clampedDelta)
    );
  }
}

export function getBehaviorAdjustmentOffsets(): { wanderBoldness: number; foragingPriority: number } {
  return { wanderBoldness: wanderBoldnessOffset, foragingPriority: foragingPriorityOffset };
}

export function resetBehaviorAdjustmentOffsets(): void {
  wanderBoldnessOffset = 0;
  foragingPriorityOffset = 0;
}

export class Ecosystem {
  private creatures: Creature[] = [];
  private nutrients: Nutrient[] = [];
  private landNutrients: Nutrient[] = [];
  private nutrientSpawnTimer = 0;
  private landNutrientSpawnTimer = 0;
  /** Faz XIII — kök neden düzeltmesi: nutrient kapasitesi/üretim hızı ANLIK popülasyona
   *  değil bu YAVAŞ SÖNÜMLENEN tahminlere göre hesaplanıyor (bkz. `decayTowards`,
   *  `CAPACITY_LAG_HALFLIFE_SECONDS`) — ani bir popülasyon düşüşünde spawn kapısının
   *  aynı karede kapanıp geri dönüşsüz bir açlık sarmalı başlatmasını önler. Başlangıç
   *  değeri gerçek başlangıç popülasyonuna (`spawnInitialCreatures`/`loadFromSave`
   *  çağrısından hemen sonraki ilk `update` karesinde) hızla yakınsar (`decayTowards`
   *  her zaman gerçek değere doğru hareket eder, sadece ANİ sıçramaları yumuşatır).
   */
  private effectiveWaterPopulation = 0;
  private effectiveLandPopulation = 0;
  private simulationTime = 0;
  private totalBirths = 0;
  private historicalMaxGeneration = 0;
  private lineage: LineageRecord[] = [];
  private readonly lineageIndexById = new Map<number, number>();
  /** Faz XVI Madde 1 — özet düğümler (bkz. `LineageSummaryNode` yorumu). Sıralı
   *  tutuluyor (en eski özet ilk) — soy ağacı görselinde bunlar kökte, canlı ağacın
   *  ÜSTÜNDE (daha düşük nesil) gösterilir. */
  private lineageSummaries: LineageSummaryNode[] = [];
  private nextSummaryId = -1;
  private readonly divideCooldowns = new WeakMap<Creature, number>();
  /** Faz VII — Çiftleşme: aseksüel `divideCooldowns`'tan AYRI bir kuluçka (bir birey
   *  hem cinsel hem aseksüel eşiği aynı anda geçebilir, ikisi birbirini engellemesin
   *  diye bağımsız tutuluyor). */
  private readonly matingCooldowns = new WeakMap<Creature, number>();
  /** Faz VII — Yumurtalama: kuluçka bekleyen yumurtalar (bkz. `Egg`). */
  private eggs: Egg[] = [];
  /** Faz V — Üreme görselliği: aktif bölünme işaretleri (kendi kendini yok eder,
   *  bkz. `DivisionEffect`). */
  private divisionEffects: DivisionEffect[] = [];
  /** Faz VI — Ölüm görünürlüğü: ölen bireylerin geride bıraktığı ceset/iskelet
   *  kalıntıları (bkz. `Corpse`). Kendiliğinden solar veya bir ayrıştırıcı bakteri
   *  tarafından tüketilince erken kaybolur. */
  private corpses: Corpse[] = [];
  /** Faz VI — Ayrıştırıcı bakteriler: her biri tek bir cesede bağlı, basit/hareketsiz
   *  bir mikroorganizma (bkz. `Decomposer`). Ayrı bir AI/hareket sistemi yok. */
  private decomposers: Decomposer[] = [];
  private readonly decomposerTargets = new WeakMap<Decomposer, Corpse>();

  // --- Faz III: neden/gerekçe şeffaflığı ---
  private evolutionEventCheckTimer = 0;
  private readonly pendingEvolutionEvents: EvolutionEvent[] = [];
  /** Organ tipi -> hangi yaygınlık kilometre taşları zaten tetiklendi. */
  private readonly firedPrevalenceMilestones = new Map<OrganType, Set<number>>();
  /** Faz XI — organ trend oku: organ tipi -> son N prevalence oranı (kayan pencere,
   *  en eski ilk). `checkPrevalenceMilestones` ile aynı 2s döngüde dolduruluyor. */
  private readonly prevalenceHistory = new Map<OrganType, number[]>();
  /** Organ tipi -> enerji avantajı/dezavantajı olayı zaten tetiklendi mi (bir kez). */
  private readonly firedEnergyAdvantage = new Set<OrganType>();
  /** Faz VI — Soy tükenmesi takibi (TASKS.md): bir organ tipi daha önce popülasyonda
   *  gerçekten VAR olduysa (en az bir kez >0 taşıyıcı gözlemlendiyse) bu set'e eklenir.
   *  Daha sonra taşıyıcı sayısı 0'a düşerse ve tip bu sette varsa gerçek bir tükenme
   *  olayı üretilir — Faz III'ün "uydurma yok, gerçek veriye dayalı" ilkesiyle aynı:
   *  hiç var olmamış bir organ için sahte bir "tükendi" olayı asla üretilmez. */
  private readonly everObservedOrganTypes = new Set<OrganType>();
  /** Tükenme olayı organ tipi başına en fazla bir kez düşer (tekrar tekrar
   *  "tükendi" demesin diye — TASKS.md dürüstlük/tekrarsızlık ilkesiyle tutarlı). */
  private readonly firedExtinction = new Set<OrganType>();
  /** Faz V — Gemini'ye gönderilecek ham veri için son N event metnini tutan basit bir
   *  kuyruk (Ecosystem'in kendi event geçmişi — Hud'daki DOM listesinden bağımsız,
   *  ki Ecosystem UI'a bağımlı kalmasın). */
  private readonly recentEventTexts: string[] = [];
  private static readonly MAX_RECENT_EVENT_TEXTS = 8;

  /** Faz X — Atmosfer/oksijen seviyesi (TASKS.md): bkz. `atmosphere.ts`. */
  private readonly atmosphere = new Atmosphere();

  /** Faz XIII — Rekabet (TASKS.md madde 2): bu karede zaten bir canlı tarafından "seek"
   *  hedefi olarak seçilmiş nutrient'lar — `updateCreatures` her karenin BAŞINDA
   *  temizler, `stepHerbivore` her canlı için doldurur (sırayla işlendiği için "en
   *  yakın/ilk talep eden kazanır" doğal olarak ortaya çıkıyor). Su ve kara havuzları
   *  ayrı tutulmuyor (aynı Nutrient referansı iki havuzda birden olamaz zaten). */
  private readonly claimedNutrientsThisFrame = new Set<Nutrient>();

  /**
   * Faz XI — Sürekli İyileştirme (performans yeniden-denetimi, 2026-09-09, PM onaylı):
   * `findNearestPrey`/`findNearestThreat`/`packHuntEscapeReduction`/
   * `updateSexualReproduction`'ın komşu-arama döngüleri MAX_CREATURES (140) tavanında
   * O(n²) çalışıyordu — canlı ölçüm (bkz. TASKS.md) bunun henüz kritik bir darboğaz
   * olmadığını gösterdi ama PM onayıyla düşük riskli bir uniform-grid optimizasyonu
   * uygulandı. ÖNEMLİ TASARIM KARARI: grid SADECE aday havuzunu daraltmak için
   * kullanılıyor, tarama SIRASI `this.creatures`'daki orijinal sırayla BİREBİR AYNI
   * kalıyor (grid hücreleri bu sırayla dolduruluyor, `<=` tie-break karşılaştırması
   * hiç değişmedi) — bu yüzden davranış sonucu (kimin avlandığı, kimin eşleştiği)
   * matematiksel olarak eskisiyle TAMAMEN eşdeğer, sadece taranan aday sayısı azalıyor.
   * Hücre boyutu sabit (`CREATURE_GRID_CELL_SIZE`) ama arama yarıçapı organa göre
   * değişken olabildiğinden (bkz. `Creature.effectiveSenseRadius`), sorgu sırasında
   * gereken hücre-yarıçapı DİNAMİK hesaplanıyor (`Math.ceil(radius / cellSize)`) —
   * bu yüzden hiçbir üst sınır varsayımı yapılmıyor, her zaman doğru.
   */
  private static readonly CREATURE_GRID_CELL_SIZE = 64;
  private creatureGrid: Map<string, Creature[]> = new Map();
  private readonly creatureOrderIndex = new Map<Creature, number>();

  private creatureGridKey(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  /** Grid'i verilen listeden (orijinal sırayla) inşa eder — çağıran taraf HANGİ
   *  listeyi/HANGİ anda (pozisyonlar güncel mi) verdiğinden sorumlu; bu fonksiyon
   *  sadece bir anlık görüntü alır, kendiliğinden yenilenmez. */
  private rebuildCreatureGrid(source: readonly Creature[]): void {
    this.creatureGrid.clear();
    this.creatureOrderIndex.clear();
    const cellSize = Ecosystem.CREATURE_GRID_CELL_SIZE;
    let index = 0;
    for (const c of source) {
      this.creatureOrderIndex.set(c, index++);
      const cx = Math.floor(c.x2 / cellSize);
      const cy = Math.floor(c.y2 / cellSize);
      const key = this.creatureGridKey(cx, cy);
      let bucket = this.creatureGrid.get(key);
      if (!bucket) {
        bucket = [];
        this.creatureGrid.set(key, bucket);
      }
      bucket.push(c);
    }
  }

  /** `radius` içindeki tüm canlı adaylarını `this.creatures` SIRASIYLA döndürür (tam
   *  bir küme değil, radius'u kapsayan kare hücre bloğu — arayan taraf zaten kendi
   *  kare-mesafe eşiğiyle filtreliyor, burada sadece aday sayısı daraltılıyor). */
  private candidatesNear(x: number, y: number, radius: number): Creature[] {
    const cellSize = Ecosystem.CREATURE_GRID_CELL_SIZE;
    const minCx = Math.floor((x - radius) / cellSize);
    const maxCx = Math.floor((x + radius) / cellSize);
    const minCy = Math.floor((y - radius) / cellSize);
    const maxCy = Math.floor((y + radius) / cellSize);
    // Grid birden fazla hücreden toplanan adayları `this.creatures`'daki orijinal
    // sırayla döndürmeli (tie-break davranışını korumak için) — `creatureOrderIndex`
    // O(1) bakışla bunu sağlıyor (indexOf O(n) olurdu, O(n²)'yi geri getirirdi).
    const seen = new Set<Creature>();
    const result: Creature[] = [];
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this.creatureGrid.get(this.creatureGridKey(cx, cy));
        if (!bucket) continue;
        for (const c of bucket) {
          if (!seen.has(c)) {
            seen.add(c);
            result.push(c);
          }
        }
      }
    }
    if (result.length <= 1) return result;
    result.sort((a, b) => (this.creatureOrderIndex.get(a) ?? 0) - (this.creatureOrderIndex.get(b) ?? 0));
    return result;
  }

  constructor(private readonly world: World, private readonly stage: Container) {
    this.scheduleNextNutrientSpawn();
    this.scheduleNextLandNutrientSpawn();
  }

  public getCreatures(): readonly Creature[] {
    return this.creatures;
  }

  /** Faz V — Canlı inceleme paneli (TASKS.md): verilen dünya koordinatına en yakın
   *  canlıyı bulur. `maxDistance` içinde hiçbir canlı yoksa `null` döner (rastgele bir
   *  tıklamada uzak bir birey seçilmesin). */
  public findNearestCreature(x: number, y: number, maxDistance: number): Creature | null {
    let best: Creature | null = null;
    let bestDist = maxDistance;
    for (const c of this.creatures) {
      if (!c.alive) continue;
      const dist = Math.hypot(c.x2 - x, c.y2 - y);
      if (dist <= bestDist) {
        best = c;
        bestDist = dist;
      }
    }
    return best;
  }

  public getLineage(): readonly LineageRecord[] {
    return this.lineage;
  }

  /** Faz XVI Madde 1 — bkz. `LineageSummaryNode`. Soy ağacı görseli bunları canlı
   *  ağacın köküne bağlanan ekstra "sıkıştırılmış geçmiş" düğümleri olarak çizer. */
  public getLineageSummaries(): readonly LineageSummaryNode[] {
    return this.lineageSummaries;
  }

  public getLineageRecordById(id: number): LineageRecord | null {
    const idx = this.lineageIndexById.get(id);
    return idx !== undefined ? this.lineage[idx] : null;
  }

  /**
   * Faz IX — Soy ağacından canlı seçimi + evrim geçmişi (TASKS.md madde 6): verilen
   * bireyden başlayarak `parentIds[0]` zincirini takip edip ATALAR listesini (en eski
   * atadan bireyin kendisine doğru sıralı) döndürür.
   *
   * Faz XVI Madde 1 güncellemesi: eskiden `MAX_LINEAGE_RECORDS` budaması bir atanın
   * kaydını TAMAMEN silip zinciri sessizce kesiyordu. Artık budanan bireyler bir
   * `LineageSummaryNode`'a taşınıyor (silinmiyor) — zincir bir gerçek kayda ulaşamazsa
   * (parentId artık `this.lineage` içinde yok) önce "bu id bir özet düğümün ÇOCUKLARI
   * arasında mı" diye bakılır; öyleyse zincirin BAŞINA (gerçek kayıt DEĞİL, sentetik/
   * özet bir "record-benzeri" giriş olarak) o özet eklenir ve zincir orada durur —
   * hâlâ uydurma veri YOK, sadece gerçekten sıkıştırılmış geçmişin bir işareti.
   */
  public getAncestryChain(id: number): LineageRecord[] {
    const chain: LineageRecord[] = [];
    let current: LineageRecord | null = this.getLineageRecordById(id);
    const seen = new Set<number>();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      chain.unshift(current);
      const parentId = current.parentIds ? current.parentIds[0] : null;
      current = parentId !== null ? this.getLineageRecordById(parentId) : null;
    }
    return chain;
  }

  /** Faz XVI Madde 1 — verilen id'nin ata zincirinde bir özet düğüme "çarpıp
   *  çarpmadığını" bulur (o id özetlenmiş bir bireyin doğrudan çocuğuysa). `null`
   *  dönerse zincir tamamen gerçek kayıtlardan oluşuyor demektir (henüz hiç
   *  özetleme tetiklenmemiş VEYA bu soy hattı özetlenen bloktan gelmiyor). */
  public getAncestorSummary(id: number): LineageSummaryNode | null {
    for (const summary of this.lineageSummaries) {
      if (summary.childIds.includes(id)) return summary;
    }
    return null;
  }

  /**
   * Faz IX — Evrim geçmişi (TASKS.md madde 6 örneği: "Nesil 3: bacak kazanıldı, Nesil
   * 7: göz kazanıldı"). Ata zincirini gezip her nesilde bir ÖNCEKİ atada olmayan yeni
   * bir organ tipi ortaya çıktıysa bunu bir "kazanım" olayı olarak kaydeder — gerçek
   * `LineageRecord.organs` verisine dayanıyor, uydurma yok.
   */
  public getEvolutionHistory(id: number): { generation: number; label: string }[] {
    const chain = this.getAncestryChain(id);
    const history: { generation: number; label: string }[] = [];
    let previousOrgans = new Set<OrganType>();
    for (const record of chain) {
      for (const organType of record.organs) {
        if (!previousOrgans.has(organType)) {
          history.push({ generation: record.generation, label: ORGAN_DEFINITIONS[organType].label });
        }
      }
      previousOrgans = new Set(record.organs);
    }
    return history;
  }

  public getSimulationTime(): number {
    return this.simulationTime;
  }

  public getNutrientCounts(): { water: number; land: number } {
    return { water: this.nutrients.length, land: this.landNutrients.length };
  }

  /** Faz VI — Ölüm görünürlüğü/ayrıştırıcılar (test/doğrulama amaçlı kamuya açık
   *  sayaçlar; UI bunları doğrudan göstermiyor ama headless doğrulama için gerekli). */
  public getCorpseCount(): number {
    return this.corpses.length;
  }

  public getDecomposerCount(): number {
    return this.decomposers.length;
  }

  /** Faz VII — test/doğrulama amaçlı: bekleyen yumurta sayısı. */
  public getEggCount(): number {
    return this.eggs.length;
  }

  /**
   * Faz XVI Madde 1 TEST-ONLY: özetleme mekanizmasını (`summarizeOldestBlock`) uzun
   * bir gerçek-zamanlı koşu beklemeden (4000+ doğal doğum) stress-test etmek için —
   * doğrudan `this.lineage`'a sentetik, birbirini ebeveyn-çocuk zinciriyle takip eden
   * `count` adet kayıt ekler (gerçek `Creature` nesnesi YARATMAZ, sahneyi/popülasyonu
   * etkilemez — SADECE soy ağacı veri yapısını doldurur). Üretim kodunda hiçbir yerden
   * çağrılmıyor, main.ts `__debug` köprüsünden headless test scriptleri için açılıyor.
   */
  public __debugForceSyntheticLineageChain(count: number): void {
    let parentId: number | null = null;
    for (let i = 0; i < count; i++) {
      const id = this.nextSyntheticLineageId--;
      const generation = parentId === null ? 0 : (this.lineageIndexById.get(parentId) !== undefined
        ? this.lineage[this.lineageIndexById.get(parentId)!].generation + 1
        : 0);
      const organs: OrganType[] = i % 7 === 0 ? ["fin"] : [];
      const record: LineageRecord = {
        id,
        parentIds: parentId !== null ? [parentId, parentId] : null,
        generation,
        bornAtSimTime: this.simulationTime,
        diedAtSimTime: null,
        organs,
        dominantOrganType: organs.length > 0 ? organs[organs.length - 1] : null,
        diet: "herbivore",
        offspringCount: 0,
      };
      this.lineage.push(record);
      this.lineageIndexById.set(id, this.lineage.length - 1);
      if (parentId !== null) {
        const idx = this.lineageIndexById.get(parentId);
        if (idx !== undefined) this.lineage[idx].offspringCount++;
      }
      parentId = id;
      if (this.lineage.length > MAX_LINEAGE_RECORDS) this.summarizeOldestBlock();
    }
  }
  private nextSyntheticLineageId = -1_000_000;

  public spawnInitialCreatures(count: number): void {
    for (let i = 0; i < count; i++) {
      const genome = randomGenome(Math.floor(Math.random() * 1_000_000));
      const { x, y } = this.world.randomWaterPoint();
      const creature = new Creature(x, y, genome);
      this.stage.addChild(creature);
      this.creatures.push(creature);
      this.recordLineage(creature);
    }
  }

  private recordLineage(creature: Creature): void {
    const g = creature.genome;
    const record: LineageRecord = {
      id: g.id,
      parentIds: g.parentIds,
      generation: g.generation,
      bornAtSimTime: this.simulationTime,
      diedAtSimTime: null,
      organs: g.organs.map((o) => o.type),
      dominantOrganType: computeDominantOrganType(g.organs),
      diet: g.diet,
      offspringCount: 0,
    };
    this.lineage.push(record);
    this.lineageIndexById.set(g.id, this.lineage.length - 1);

    // Faz IX — Soy ağacından canlı seçimi (TASKS.md madde 6): ebeveyn(ler)in yavru
    // sayısını artır. Aseksüel bölünmede parentIds=[p,p] (aynı id iki kez) — burada
    // Set kullanılarak tek ebeveyn bir kez sayılıyor, cinsel üremede iki farklı
    // ebeveyn ayrı ayrı sayılıyor.
    if (g.parentIds) {
      const uniqueParentIds = new Set(g.parentIds);
      for (const parentId of uniqueParentIds) {
        const idx = this.lineageIndexById.get(parentId);
        if (idx !== undefined) this.lineage[idx].offspringCount++;
      }
    }

    if (this.lineage.length > MAX_LINEAGE_RECORDS) {
      this.summarizeOldestBlock();
    }
  }

  /**
   * Faz XVI Madde 1 — cap aşıldığında en eski `LINEAGE_SUMMARY_BLOCK_SIZE` kaydı
   * SİLMEK yerine tek bir `LineageSummaryNode`'a sıkıştırır. Bu, eski FIFO
   * `splice(0, overflow)` davranışının YERİNİ ALIYOR — artık hiçbir birey/soy verisi
   * tamamen kaybolmuyor, sadece detay seviyesi düşüyor (TASKS.md: "N birey, X-Y nesil
   * arası, artık gösterilmiyor ama sayıldı").
   *
   * Uygulama detayları:
   * - Sıkıştırılan blok, mevcut `this.lineage` dizisinin EN BAŞINDAKİ (en eski doğum
   *   zamanlı, zaten doğum sırasına göre push edildiği için) `LINEAGE_SUMMARY_BLOCK_SIZE`
   *   kaydı.
   * - `individualCount`/`minGeneration`/`maxGeneration`/`observedOrgans` doğrudan bu
   *   bloktaki GERÇEK kayıtlardan hesaplanıyor (uydurma yok).
   * - `childIds`: bu bloğun DIŞINDA kalan (silinmeyen) bir kaydın ebeveyni, bloğun
   *   İÇİNDE bir id'yse, o çocuk artık "kökü" (ebeveyni) özet düğüme bağlanmalı —
   *   `lineagetree.ts` bu şekilde özet düğümden gerçek ağaca kesintisiz bir dallanma
   *   çizgisi çizebiliyor. Bloğun içindeki bir kaydın ebeveyni ZATEN önceki bir özet
   *   düğüme aitse (önceki özetleme turundan), o ilişki de yeni özete taşınıyor (özetler
   *   kendi aralarında da zincirlenebilir — ama pratikte çoğu zaman tek bir özet
   *   düğüm birikir, aşağıdaki "önceki özeti birleştir" adımı bunu önlüyor).
   * - Performans: bu O(blockSize + kalan) maliyetli bir işlem ama SADECE blok
   *   dolduğunda (her `LINEAGE_SUMMARY_BLOCK_SIZE`=1000 yeni kayıtta bir) çalışır —
   *   her doğumda değil, bu yüzden ortalama maliyeti ihmal edilebilir.
   */
  private summarizeOldestBlock(): void {
    const blockSize = Math.min(LINEAGE_SUMMARY_BLOCK_SIZE, this.lineage.length);
    const block = this.lineage.splice(0, blockSize);
    const blockIds = new Set(block.map((r) => r.id));

    let minGeneration = Infinity;
    let maxGeneration = -Infinity;
    const observedOrgans = new Set<OrganType>();
    let individualCount = 0;

    // Faz XVI — eğer bu bloğun İÇİNDE önceden var olan bir özet düğüme referans veren
    // bir kayıt varsa (yani bir önceki özetleme turunun "çocuğu" bu blokta kalmıştı),
    // o özet düğümü de bu yeni özete BİRLEŞTİRİYORUZ — özet zincirinin gereksiz yere
    // uzamasını (özet-özet-özet...) engellemek için tek bir kümülatif özet düğüm
    // tutmaya çalışıyoruz.
    const mergedChildIds = new Set<number>();
    const summaryIdsToMerge = new Set<number>();
    for (const summary of this.lineageSummaries) {
      const stillReferenced = summary.childIds.some((cid) => blockIds.has(cid));
      if (stillReferenced) {
        summaryIdsToMerge.add(summary.id);
        individualCount += summary.individualCount;
        if (summary.minGeneration < minGeneration) minGeneration = summary.minGeneration;
        if (summary.maxGeneration > maxGeneration) maxGeneration = summary.maxGeneration;
        for (const o of summary.observedOrgans) observedOrgans.add(o);
      }
    }
    if (summaryIdsToMerge.size > 0) {
      this.lineageSummaries = this.lineageSummaries.filter((s) => !summaryIdsToMerge.has(s.id));
    }

    for (const record of block) {
      individualCount++;
      if (record.generation < minGeneration) minGeneration = record.generation;
      if (record.generation > maxGeneration) maxGeneration = record.generation;
      for (const o of record.organs) observedOrgans.add(o);
    }

    // Çocuklar: kalan (silinmeyen) kayıtlar arasında ebeveyni bu bloğun içinde olanlar,
    // artık ATASI olarak bu özet düğümü göstermeli (bkz. `lineagetree.ts` çizim mantığı
    // — parentId bir gerçek kayıtta bulunamazsa özet düğüm listesinde aranıyor).
    for (const record of this.lineage) {
      const parentId = record.parentIds ? record.parentIds[0] : null;
      if (parentId !== null && blockIds.has(parentId)) {
        mergedChildIds.add(record.id);
      }
    }
    // Bloğun kendi içindeki kayıtların da (silinmeden önce) bu blok dışında kalan bir
    // özete bağlı çocukları olabilirdi (nadir ama mümkün) — bu durumda önceki adımda
    // zaten `summaryIdsToMerge` ile ele alındı, burada tekrar işlemiyoruz.

    const summary: LineageSummaryNode = {
      id: this.nextSummaryId--,
      individualCount,
      minGeneration: Number.isFinite(minGeneration) ? minGeneration : 0,
      maxGeneration: Number.isFinite(maxGeneration) ? maxGeneration : 0,
      observedOrgans: Array.from(observedOrgans),
      childIds: Array.from(mergedChildIds),
    };
    this.lineageSummaries.push(summary);

    this.lineageIndexById.clear();
    this.lineage.forEach((r, i) => this.lineageIndexById.set(r.id, i));
  }

  // --- Kaydet/Yükle ---

  public serialize(): {
    creatures: SavedCreature[];
    totalBirths: number;
    historicalMaxGeneration: number;
    simulationTime: number;
    mapSeed: number;
  } {
    const creatures: SavedCreature[] = [];
    for (const c of this.creatures) {
      if (!c.alive) continue;
      creatures.push({ genome: c.genome, x: c.x2, y: c.y2, energy: c.energy, age: c.age });
    }
    return {
      creatures,
      totalBirths: this.totalBirths,
      historicalMaxGeneration: this.historicalMaxGeneration,
      simulationTime: this.simulationTime,
      // Faz VIII — kaydedilen canlı konumlarının hangi haritaya göre anlamlı olduğunu
      // saklamak için (bkz. `world.ts` `World.seed`).
      mapSeed: this.world.seed,
    };
  }

  public loadFromSave(saved: {
    creatures: SavedCreature[];
    totalBirths: number;
    historicalMaxGeneration: number;
    simulationTime: number;
  }): void {
    this.clearAll();
    this.clearEventTrackingState();

    for (const entry of saved.creatures) {
      const creature = new Creature(entry.x, entry.y, entry.genome);
      creature.energy = Math.min(creature.maxEnergy, Math.max(0, entry.energy));
      creature.age = Math.max(0, entry.age);
      this.stage.addChild(creature);
      this.creatures.push(creature);
      ensureGenomeIdCounterAbove(entry.genome.id);
      this.recordLineage(creature);
    }

    this.totalBirths = Math.max(0, Math.floor(saved.totalBirths));
    this.historicalMaxGeneration = Math.max(0, Math.floor(saved.historicalMaxGeneration));
    this.simulationTime = Math.max(0, saved.simulationTime);
  }

  /**
   * Faz XI — Sürekli İyileştirme (bug-avı bulgusu, 2026-09-10, PM onaylı):
   * `reset()` ve `loadFromSave()` İKİSİ de canlı popülasyonunu tamamen
   * değiştiriyor (bir öncekiyle hiç ilgisi olmayan yeni bir durum) — bu
   * yüzden soy/olay/organ-trend TAKİP durumunun da SIFIRLANMASI gerekiyor,
   * aksi halde eski popülasyondan kalan veri (örn. "X organı zaten tükendi"
   * bayrağı, organ trend oku kayan penceresi) yeniyle SESSİZCE karışır —
   * yanlış/uydurma bir "tükendi" olayı ya da eski veriye dayalı yanlış bir
   * trend oku üretebilir (TASKS.md'nin "uydurma yok" ilkesiyle çelişir).
   * `loadFromSave` daha önce bu temizliği HİÇ yapmıyordu — şu ana kadar
   * ZARARSIZDI çünkü tek çağrı noktası (main.ts) her zaman YENİ inşa
   * edilmiş, zaten boş durumlu bir `Ecosystem` üzerinde çalışıyordu, ama bu
   * varsayım hiçbir yerde belgelenmemiş/garanti edilmemişti — ileride biri
   * `loadFromSave`'i ÇALIŞAN bir ekosistem üzerinde çağırırsa (örn. "sayfa
   * yenilemeden farklı bir kayıt yükle" gibi bir özellik) sessizce hatalı
   * davranış üretebilirdi. Ortak bir yardımcıya çıkarılarak hem bu risk
   * kapatıldı hem `reset()`/`loadFromSave()` arasındaki kod tekrarı önlendi.
   */
  private clearEventTrackingState(): void {
    this.lineage = [];
    this.lineageIndexById.clear();
    this.lineageSummaries = [];
    this.nextSummaryId = -1;
    resetGenomeIdCounter();
    this.evolutionEventCheckTimer = 0;
    this.pendingEvolutionEvents.length = 0;
    this.firedPrevalenceMilestones.clear();
    this.prevalenceHistory.clear();
    this.firedEnergyAdvantage.clear();
    this.everObservedOrganTypes.clear();
    this.firedExtinction.clear();
    this.firedFirstCarnivore = false;
    this.oldAgeDeathCount = 0;
    this.recentEventTexts.length = 0;
  }

  public reset(count: number): void {
    this.clearAll();
    this.simulationTime = 0;
    this.totalBirths = 0;
    this.historicalMaxGeneration = 0;
    this.scheduleNextNutrientSpawn();
    this.scheduleNextLandNutrientSpawn();
    this.clearEventTrackingState();
    this.spawnInitialCreatures(count);
  }

  private clearAll(): void {
    for (const c of this.creatures) {
      this.stage.removeChild(c);
      c.destroy();
    }
    this.creatures = [];
    for (const n of this.nutrients) {
      this.stage.removeChild(n);
      n.destroy();
    }
    this.nutrients = [];
    for (const n of this.landNutrients) {
      this.stage.removeChild(n);
      n.destroy();
    }
    this.landNutrients = [];
    for (const e of this.divisionEffects) {
      this.stage.removeChild(e);
      e.destroy({ children: true });
    }
    this.divisionEffects = [];
    for (const c of this.corpses) {
      this.stage.removeChild(c);
      c.destroy({ children: true });
    }
    this.corpses = [];
    for (const d of this.decomposers) {
      this.stage.removeChild(d);
      d.destroy({ children: true });
    }
    this.decomposers = [];
    for (const egg of this.eggs) {
      this.stage.removeChild(egg);
      egg.destroy({ children: true });
    }
    this.eggs = [];
  }

  public update(dt: number): void {
    this.simulationTime += dt;
    this.updateNutrientSpawning(dt);
    this.updateLandNutrientSpawning(dt);
    this.updateCreatures(dt);
    this.updateDivision(dt);
    this.updateSexualReproduction(dt);
    this.updateEggs(dt);
    this.updateDivisionEffects(dt);
    this.updateCorpsesAndDecomposers(dt);
    this.updateEvolutionEvents(dt);
  }

  /** Faz V — kısa ömürlü bölünme görsel işaretlerini ilerletir, süresi dolanları
   *  sahneden kaldırır. */
  private updateDivisionEffects(dt: number): void {
    if (this.divisionEffects.length === 0) return;
    for (const effect of this.divisionEffects) {
      effect.update(dt);
    }
    const stillActive = this.divisionEffects.filter((e) => !e.finished);
    if (stillActive.length !== this.divisionEffects.length) {
      for (const e of this.divisionEffects) {
        if (e.finished) {
          this.stage.removeChild(e);
          e.destroy({ children: true });
        }
      }
    }
    this.divisionEffects = stillActive;
  }

  // --- Besin üretimi (su bölgelerinde) ---

  /** Faz VIII — İklim değişimi (TASKS.md): geçici olarak besin üretim HIZINI da
   *  (metabolizmaya ek olarak) etkiler — "yavaş bir dalgalanma" (1 = normal). */
  private climateNutrientMultiplier = 1;
  public setClimateNutrientMultiplier(mult: number): void {
    this.climateNutrientMultiplier = mult;
  }
  // Faz XIII TEST-ONLY (kök neden teşhisi, geri alınacak): güncel çarpanları dışarı açar.
  public getClimateNutrientMultiplier(): number {
    return this.climateNutrientMultiplier;
  }

  /** Faz XII — Besin üretim oranı kontrolü (TASKS.md madde 1): kullanıcının HUD'dan
   *  ayarlayabileceği bir çarpan (0.25x-3x aralığında sınırlı — TASKS.md gereksinimi,
   *  popülasyon dengesini [Faz IV/IX] aşırı bozmasın diye). İklim çarpanıyla AYNI
   *  şekilde çarpımsal olarak uygulanıyor (`updateNutrientSpawning`/
   *  `updateLandNutrientSpawning`) — iki çarpan birbirinden bağımsız, biri diğerini
   *  sıfırlamıyor/geçersiz kılmıyor. */
  private userNutrientMultiplier = 1;
  public setUserNutrientMultiplier(mult: number): void {
    this.userNutrientMultiplier = Math.min(3, Math.max(0.25, mult));
  }
  public getUserNutrientMultiplier(): number {
    return this.userNutrientMultiplier;
  }

  /** Faz X — Atmosfer (TASKS.md): iklim olayı sırasında oksijen seviyesine hafif
   *  bir ofset uygulamak için `WorldEventManager`'ın çağırdığı geçiş noktası
   *  (bkz. `atmosphere.ts` `Atmosphere.setClimateOffset`). */
  public setAtmosphereClimateOffset(offset: number): void {
    this.atmosphere.setClimateOffset(offset);
  }

  /** Faz X — HUD'da/Gemini verisinde gösterilecek anlık oksijen seviyesi (0..1). */
  public getOxygenLevel(): number {
    return this.atmosphere.getOxygenLevel(this.simulationTime);
  }

  private scheduleNextNutrientSpawn(): void {
    const [min, max] = NUTRIENT_SPAWN_INTERVAL;
    this.nutrientSpawnTimer = min + Math.random() * (max - min);
  }

  private updateNutrientSpawning(dt: number): void {
    const population = this.creatures.length;
    // Faz XIII — kök neden düzeltmesi: ANLIK popülasyon yerine YAVAŞ SÖNÜMLENEN bir
    // tahmin kullanılıyor (bkz. üstteki büyük yorum/`decayTowards`) — ani bir ölüm
    // dalgasında cap'in aynı karede çökmesini, dolayısıyla spawn'ın aniden tamamen
    // durmasını önler.
    this.effectiveWaterPopulation = decayTowards(
      this.effectiveWaterPopulation,
      population,
      dt,
      CAPACITY_LAG_HALFLIFE_SECONDS
    );
    const baseCap = nutrientCapacity(this.effectiveWaterPopulation, BASE_MAX_NUTRIENTS);
    // Faz XIII — YENİDEN AÇILIŞ kök neden düzeltmesi (2026-09-03, 2. tur): kapasite
    // kontrolü sadece TOPLAM SAYIYA bakıyordu, COĞRAFİ dağılıma değil. Ölçümle
    // doğrulandı (5 bağımsız 4-5dk koşudan 2'sinde tekrarlanan çöküş): stok tam
    // kapasiteye (~cap) yapışık kalırken (`nutrients.length >= cap` kapısı SÜREKLİ
    // kapalı) `medianDistToFood` 123px'ten 591px'e fırlıyordu — yani "besin sayıca
    // yeterli" ama popülasyonun bulunduğu bölgeden UZAK bir yerde donmuş kalıyordu,
    // kapı kapalı olduğu için yeni (aç bireye yakın) besin hiç eklenemiyordu. Bu,
    // Faz XIII'ün ilk turundaki (anlık popülasyon çöküşü) kök nedenden FARKLI bir
    // mekanizma — kapasite kontrolünün SAYI bazlı doğası, coğrafi bir açlık
    // sarmalını engelleyemiyordu. Düzeltme: popülasyonun ortalama enerji oranı
    // düşükse (`averageEnergyRatio` eşiğin altında), kapasite GEÇİCİ olarak
    // genişletiliyor — bu, "besin sayıca dolu ama yanlış yerde" durumunda bile
    // yeni (aç bireye yakın, `spawnPointNear`/`pickHungryWeightedAnchor` ile)
    // besin eklenmesine izin verir. Enerji oranı sağlıklıyken (>eşik) davranış
    // ESKİSİYLE AYNI (ek genişleme sıfır) — bu sadece kıtlık anlarında devreye
    // giren bir güvenlik supabı, normal dengeyi bozmuyor.
    const hungerBoost = this.computeHungerCapacityBoost();
    const cap = baseCap + hungerBoost;
    if (this.nutrients.length >= cap) {
      this.relocateStrandedNutrient(this.nutrients, this.creatures, true);
      return;
    }
    // Faz XIII — YENİDEN AÇILIŞ (3. tur, v6 koşusunda TEKRAR çöküş görülünce):
    // sadece kapasiteyi genişletmek tek başına yetersiz kaldı — kapı açılsa bile
    // spawn HIZI (`nutrientSpawnRateMultiplier`, popülasyona göre kademeli) kıtlık
    // anında toparlanmayı yeterince hızlandırmıyor olabilirdi (her spawn turu en
    // fazla 1 nutrient üretiyor, `NUTRIENT_SPAWN_INTERVAL` 0.25-0.6s). Açlık
    // baskısı varken HIZ çarpanına da orantılı bir ek (`hungerSpawnRateBoost`,
    // ciddiyete göre +0 ile +3x arası) uygulanıyor — kapasitenin dolmasını
    // beklemeden, kıtlık anında besin ÜRETİM HIZI da artıyor.
    const hungerSpawnRateBoost = this.computeHungerSpawnRateBoost();
    const multiplier =
      (nutrientSpawnRateMultiplier(this.effectiveWaterPopulation) + hungerSpawnRateBoost) *
      this.climateNutrientMultiplier *
      this.userNutrientMultiplier;
    this.nutrientSpawnTimer -= dt * multiplier;
    if (this.nutrientSpawnTimer <= 0) {
      const { x, y } = this.spawnPointNear(this.creatures, true);
      const nutrient = new Nutrient(x, y);
      this.stage.addChild(nutrient);
      this.nutrients.push(nutrient);
      this.scheduleNextNutrientSpawn();
    }
  }

  /** Faz XIII — YENİDEN AÇILIŞ (2. tur): ortalama enerji oranı düşükse (popülasyon
   *  genelinde açlık baskısı varsa) besin kapasitesine ek bir "acil durum" payı
   *  ekler — TASKS.md'nin önerdiği "mutlak taban" fikrinin, mevcut adaptif sisteme
   *  entegre, orantılı bir versiyonu. Eşik/aralık: enerji oranı %55'in ALTINDAYKEN
   *  devreye girer (sağlıklı popülasyonlarda tipik ortalama ~0.5-0.9 arası
   *  gözlemlendi, bkz. TASKS.md ölçümleri — %55 eşiği "gerçekten sıkıntılı" anları
   *  hedefliyor, sürekli tetiklenmesin diye), oran düştükçe DOĞRUSAL olarak büyüyen
   *  bir ek pay verir (maks +100, oran 0'a yaklaştıkça). Popülasyon çok küçükse
   *  (<10) atlanır — istatistiksel gürültü/erken aşama dalgalanmalarında gereksiz
   *  yere tetiklenmesin diye (Faz III'ün `MIN_POPULATION_FOR_PREVALENCE` emsaliyle
   *  tutarlı bir güvenlik). */
  private static readonly HUNGER_BOOST_ENERGY_THRESHOLD = 0.55;
  private static readonly HUNGER_BOOST_MAX = 100;
  private static readonly HUNGER_BOOST_MIN_POPULATION = 10;

  /** 0 (sağlıklı) ile 1 (kritik) arası bir "açlık ciddiyeti" — ortalama enerji
   *  oranı `HUNGER_BOOST_ENERGY_THRESHOLD` eşiğinin ne kadar altına düştüğünü
   *  ölçer. Hem kapasite hem spawn-hızı güçlendirmesi bu TEK ortak ölçüme
   *  dayanıyor (tutarlılık — ikisi aynı anda, aynı oranda tetiklenir). */
  private computeHungerSeverity(): number {
    if (this.creatures.length < Ecosystem.HUNGER_BOOST_MIN_POPULATION) return 0;
    let total = 0;
    let count = 0;
    for (const c of this.creatures) {
      if (!c.alive) continue;
      total += c.energy / c.maxEnergy;
      count++;
    }
    if (count === 0) return 0;
    const avgRatio = total / count;
    if (avgRatio >= Ecosystem.HUNGER_BOOST_ENERGY_THRESHOLD) return 0;
    return (Ecosystem.HUNGER_BOOST_ENERGY_THRESHOLD - avgRatio) / Ecosystem.HUNGER_BOOST_ENERGY_THRESHOLD;
  }

  private computeHungerCapacityBoost(): number {
    return this.computeHungerSeverity() * Ecosystem.HUNGER_BOOST_MAX;
  }

  /** Faz XIII — YENİDEN AÇILIŞ (3. tur): açlık ciddiyeti arttıkça besin ÜRETİM
   *  HIZINA da orantılı bir ek çarpan (`0` ile `HUNGER_SPAWN_RATE_BOOST_MAX`
   *  arası) ekler — kapasitenin genişlemesini beklemeden, kıtlık anında besin
   *  daha SIK spawn edilir. `nutrientSpawnRateMultiplier`'ın üstüne toplamsal
   *  olarak eklenir (çarpımsal değil — popülasyon zaten yüksekken orantısız
   *  büyümesin diye). */
  private static readonly HUNGER_SPAWN_RATE_BOOST_MAX = 3;

  private computeHungerSpawnRateBoost(): number {
    return this.computeHungerSeverity() * Ecosystem.HUNGER_SPAWN_RATE_BOOST_MAX;
  }

  /**
   * Faz IV düzeltmesi — ikinci kök neden bulgusu: tavan/hızı düzeltmek tek başına
   * yetmedi (ilk düzeltme sonrası 240s'lik koşuda 312 nutrient STOKTA olduğu halde
   * popülasyon yine çöktü, bkz. TASKS.md). Ölçüm: harita su alanı ~752.000px², birkaç
   * yüz nutrient bu alana tamamen RASTGELE dağılınca ortalama komşu mesafesi
   * (~sqrt(alan/adet)) canlıların `senseRadius`ı (40-90px) ile aynı mertebede kalıyor
   * — yani "stok bol" ama çoğu nutrient hiçbir canlının algı menzilinde değil, sadece
   * şans eseri rastgele gezinmeyle bulunuyor. Düzeltme: nutrient'ların çoğu (bkz.
   * `NEAR_CREATURE_SPAWN_CHANCE`) rastgele seçilen canlı bir bireyin YAKININA
   * (algı menzili civarında bir ofsetle) doğar — "besin, canlıların olduğu yerde
   * oluşur" sezgisiyle erişilebilirliği garanti eder. Küçük bir pay (`1 -
   * NEAR_CREATURE_SPAWN_CHANCE`) hâlâ tamamen rastgele haritaya düşer ki keşfedilmemiş
   * bölgelere göç/yayılma teşviki tamamen kaybolmasın.
   */
  /**
   * Faz XIII — Kök neden düzeltmesi, ikinci bulgu (2026-09-03): stok kısa süreliğine
   * gerçekten neredeyse sıfıra düştüğü (ölçümle doğrulandı: `water_nutr` bir örnekleme
   * aralığında 66'dan 0'a düştü) anlarda, Faz IV'ün "%75 rastgele bir canlının yakınına
   * doğar" düzeltmesi TEK BAŞINA yeterli değildi — anchor TAMAMEN rastgele seçildiğinden
   * (aç/tok ayrımı yok), yeni doğan az sayıdaki nutrient şans eseri zaten TOK olan
   * bireylerin yanına düşebiliyor, aç kalan çoğunluk toparlanma süresince (stok
   * `nutrientCapacity`'ye geri tırmanana kadar, birkaç düzine saniye) besinsiz kalıp
   * kitlesel açlığa gidiyordu (ölçüm: stok 0'a düştükten sonra 140 canlının ~121'i
   * algı menzilinde HİÇ besin bulamıyordu, `medianDistToFood` 644px'e fırlıyordu).
   * Düzeltme: anchor seçimi artık DÜZ RASTGELE değil, enerji oranı DÜŞÜK olan
   * (daha AÇ) bireylere doğru ağırlıklı — "besin en çok ihtiyacı olana yakın oluşur"
   * sezgisiyle, kıtlık anlarında toparlanmayı hızlandırıp açlık sarmalını önler. Tam
   * doygun bireyler hâlâ SIFIR olmayan bir şansla anchor olabilir (ağırlık asla 0'a
   * inmiyor, bkz. `HUNGER_WEIGHT_FLOOR`) — bu sadece bir EĞİLİM, katı bir kural değil.
   */
  private static readonly HUNGER_WEIGHT_FLOOR = 0.15;

  private pickHungryWeightedAnchor(pool: Creature[]): Creature {
    let totalWeight = 0;
    const weights: number[] = new Array(pool.length);
    for (let i = 0; i < pool.length; i++) {
      const ratio = pool[i].energy / pool[i].maxEnergy;
      const weight = Math.max(Ecosystem.HUNGER_WEIGHT_FLOOR, 1 - ratio);
      weights[i] = weight;
      totalWeight += weight;
    }
    let roll = Math.random() * totalWeight;
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  /**
   * Bug-avı düzeltmesi (2026-09-11, PM onaylı): uzun koşuda görülen toplu popülasyon
   * çöküşünün kök nedeni — bir iklim olayı sırasında (nutrient üretim hızı/kapasitesi
   * yüksekken) o anki popülasyon konumlarına göre biriken nutrient stoku, olay
   * bitip popülasyon zamanla YER DEĞİŞTİRDİKÇE eski/artık-boş bölgelerde "donmuş"
   * kalıyordu. Stok SAYICA cap'e yapışık kaldığı için (`nutrients.length >= cap`
   * kapısı sürekli kapalı) yeni nutrient, canlıların GERÇEK güncel konumuna hiç
   * eklenemiyordu — Faz XIII'ün "sayıca dolu ama coğrafi olarak erişilemez" bulgusuyla
   * aynı imza, ama bu kez climate sonrası GECİKMELİ olarak (450-600s sonra) ortaya
   * çıkıyordu (2 bağımsız uzun koşuda reprodüklendi, ölçüm: `killCreature`
   * cause="starvation" sayacı su/kara stoku SABİT kalırken birdenbire patlıyordu).
   * Düzeltme: cap doluyken (yeni SPAWN edilemediği an) TOPLAM SAYIYI değiştirmeden,
   * mevcut bir nutrient'ı (canlılara en uzak/stranded olanı) aç bir bireyin yakınına
   * TAŞIYARAK "coğrafi yeniden dengeleme" yapılıyor — Faz XIII'in sayısal kapasite
   * genişletmesinden (`computeHungerCapacityBoost`) FARKLI, onu tamamlayan bir
   * mekanizma. Her çağrıda TEK bir nutrient taşınır (ucuz, O(n) tarama) ve sadece
   * açlık ciddiyeti sıfırdan büyükken devreye girer (`computeHungerSeverity`) —
   * sağlıklı popülasyonlarda hiçbir davranış değişikliği yok.
   */
  private relocateStrandedNutrient(pool: Nutrient[], creatures: readonly Creature[], water: boolean): void {
    if (this.computeHungerSeverity() <= 0 || pool.length === 0) return;
    const alivePool = creatures.filter(
      (c) => c.alive && this.world.isWater(c.x2, c.y2) === water
    );
    if (alivePool.length === 0) return;

    let strandedIdx = -1;
    let strandedDistSq = -1;
    for (let i = 0; i < pool.length; i++) {
      let nearestSq = Infinity;
      for (const c of alivePool) {
        const dx = pool[i].x2 - c.x2;
        const dy = pool[i].y2 - c.y2;
        const distSq = dx * dx + dy * dy;
        if (distSq < nearestSq) nearestSq = distSq;
      }
      if (nearestSq > strandedDistSq) {
        strandedDistSq = nearestSq;
        strandedIdx = i;
      }
    }
    if (strandedIdx < 0) return;

    const { x, y } = this.spawnPointNear(creatures, water);
    pool[strandedIdx].x2 = x;
    pool[strandedIdx].y2 = y;
    pool[strandedIdx].position.set(x, y);
  }

  private spawnPointNear(
    creatures: readonly Creature[],
    water: boolean
  ): { x: number; y: number } {
    const pool = water
      ? creatures.filter((c) => c.alive && this.world.isWater(c.x2, c.y2))
      : creatures.filter((c) => c.alive && !this.world.isWater(c.x2, c.y2));

    if (pool.length > 0 && Math.random() < NEAR_CREATURE_SPAWN_CHANCE) {
      const anchor = this.pickHungryWeightedAnchor(pool);
      for (let attempt = 0; attempt < 8; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 70;
        const x = anchor.x2 + Math.cos(angle) * dist;
        const y = anchor.y2 + Math.sin(angle) * dist;
        const inBounds = x >= 0 && x <= this.world.width_ && y >= 0 && y <= this.world.height_;
        if (inBounds && this.world.isWater(x, y) === water) {
          return { x, y };
        }
      }
    }

    return water ? this.world.randomWaterPoint() : this.world.randomLandPoint();
  }

  // --- Besin üretimi (kara bölgelerinde — Faz II, bacaklı bireyler için) ---

  private scheduleNextLandNutrientSpawn(): void {
    const [min, max] = NUTRIENT_SPAWN_INTERVAL;
    // Karada henüz kimse olmayabilir; su ile aynı hızda üretmek gereksiz — biraz daha
    // yavaş, ama karaya çıkan bir birey "rakipsiz bir besin kaynağı" bulabilsin diye
    // (TASKS.md örnek olay metni) yine de düzenli birikir.
    this.landNutrientSpawnTimer = (min + Math.random() * (max - min)) * 1.4;
  }

  private updateLandNutrientSpawning(dt: number): void {
    let landPopulation = 0;
    for (const c of this.creatures) {
      if (c.alive && !this.world.isWater(c.x2, c.y2)) landPopulation++;
    }
    // Faz XIII — aynı kök neden düzeltmesi (bkz. `updateNutrientSpawning`), kara
    // nutrient havuzu için de uygulanıyor.
    this.effectiveLandPopulation = decayTowards(
      this.effectiveLandPopulation,
      landPopulation,
      dt,
      CAPACITY_LAG_HALFLIFE_SECONDS
    );
    // Faz XIII — YENİDEN AÇILIŞ (2. tur): su havuzuyla AYNI açlık-tabanlı kapasite
    // genişletmesi (bkz. `computeHungerCapacityBoost`) kara havuzuna da uygulanıyor
    // — tutarlılık için, kara popülasyonu için ayrı bir enerji hesabı GEREKMİYOR
    // (aynı `creatures` listesi kullanılıyor, su/kara ayrımı olmadan genel açlık
    // baskısını yansıtıyor).
    const cap = nutrientCapacity(this.effectiveLandPopulation, BASE_MAX_LAND_NUTRIENTS) + this.computeHungerCapacityBoost();
    if (this.landNutrients.length >= cap) {
      this.relocateStrandedNutrient(this.landNutrients, this.creatures, false);
      return;
    }
    const multiplier =
      (nutrientSpawnRateMultiplier(this.effectiveLandPopulation) + this.computeHungerSpawnRateBoost()) *
      this.climateNutrientMultiplier *
      this.userNutrientMultiplier;
    this.landNutrientSpawnTimer -= dt * multiplier;
    if (this.landNutrientSpawnTimer <= 0) {
      const { x, y } = this.spawnPointNear(this.creatures, false);
      const nutrient = new Nutrient(x, y);
      this.stage.addChild(nutrient);
      this.landNutrients.push(nutrient);
      this.scheduleNextLandNutrientSpawn();
    }
  }

  // --- Canlı davranışı ---

  /** Faz VIII — Dünya olayları (TASKS.md): iklim değişimi geçici olarak metabolizma
   *  oranını hafifçe etkiler (1 = normal). `WorldEventManager` bunu ayarlayıp bir
   *  süre sonra 1'e geri döndürür — `Ecosystem`'in kendisi olayların ZAMANLAMASINI
   *  bilmiyor, sadece "şu an geçerli çarpan bu" sorusuna cevap veriyor (ayrım: dünya
   *  olayı mantığı kendi dosyasında kalıyor). */
  private climateMetabolismMultiplier = 1;
  public setClimateMetabolismMultiplier(mult: number): void {
    this.climateMetabolismMultiplier = mult;
  }
  // Faz XIII TEST-ONLY (kök neden teşhisi, geri alınacak): güncel çarpanları dışarı açar.
  public getClimateMetabolismMultiplier(): number {
    return this.climateMetabolismMultiplier;
  }

  /** Faz VIII — Rüzgar: aktifken tüm canlıların hareketine eklenen sabit bir sapma/
   *  itiş vektörü (px/s cinsinden, `moveCreature`'a normal hareketle BİRLİKTE
   *  eklenir). Küçük/hafif bireyler (küçük yarıçap) orantılı olarak daha çok
   *  etkilenir — TASKS.md: "özellikle küçük/hafif olanların hareketine". */
  private windVx = 0;
  private windVy = 0;
  public setWind(vx: number, vy: number): void {
    this.windVx = vx;
    this.windVy = vy;
  }

  private updateCreatures(dt: number): void {
    // Faz XIII — Rekabet: her karenin başında temizlenir, bu karede işlenen her canlı
    // kendi "seek" hedefini burada işaretler (bkz. `stepHerbivore`).
    this.claimedNutrientsThisFrame.clear();
    for (const creature of this.creatures) {
      if (!creature.alive) continue;

      const onLand = !this.world.isWater(creature.x2, creature.y2);
      // Faz VII — Yavru bakımı (TASKS.md): yeni doğan bir birey ebeveynine yakınken
      // hafif bir metabolizma indirimi yaşar (basit mesafe kontrolü, karmaşık bir
      // takip/AI sistemi yok — bkz. Creature.isNearCaringParent).
      const careMultiplier = creature.isNearCaringParent(PARENTAL_CARE_RADIUS)
        ? 1 - PARENTAL_CARE_METABOLISM_REDUCTION
        : 1;
      // Faz X — Atmosfer/solunum (TASKS.md): gill/lung taşıyan bireylerin
      // metabolizma verimliliği güncel oksijen seviyesine göre gerçekten değişir
      // (bkz. Creature.breathingMetabolismMultiplier) — organsız/solunum organsız
      // bireyler bu çarpandan etkilenmez (nötr, 1 döner).
      const breathingMultiplier = creature.breathingMetabolismMultiplier(onLand, this.getOxygenLevel());
      // Faz XIV — izolasyon tabakası (blubber): global iklim çarpanının bu bireye
      // ETKİSİNİ yumuşatır (organsız/blubber'sız bireyler için hiç fark etmiyor).
      const effectiveClimateMultiplier = creature.climateResistantMultiplier(this.climateMetabolismMultiplier);
      creature.energy -=
        creature.genome.metabolism *
        creature.metabolismMultiplier() *
        breathingMultiplier *
        careMultiplier *
        effectiveClimateMultiplier *
        dt;
      if (creature.energy <= 0) {
        this.killCreature(creature);
        continue;
      }
      // Faz IX — Gerçek yaşam döngüsü (kullanıcı isteği): açlıktan bağımsız, sadece
      // YAŞLANDIKÇA ölüm. `age` zaten Faz V'ten beri var (büyüme animasyonunda
      // kullanılıyordu) — burada ilk kez bir "ölüm nedeni" olarak da kullanılıyor.
      // Mevcut ölüm yoluyla (killCreature) aynı ceset/ayrıştırıcı mekaniğine bağlanıyor.
      if (creature.age >= creature.genome.maxLifespan) {
        this.killCreature(creature, "old_age");
        continue;
      }

      const delta =
        creature.genome.diet === "carnivore"
          ? this.stepCarnivore(creature, onLand, dt)
          : this.stepHerbivore(creature, onLand, dt);

      // Faz VIII — Rüzgar (TASKS.md): normal hareket kararına EKLENEN, hafif bir
      // itiş — davranış kararının kendisini (wander/seek/flee/hunt) değiştirmiyor,
      // sadece gerçekleşen yer değiştirmeyi sapıyor. Küçük gövdeliler (yarıçap
      // düşük) orantılı olarak daha fazla sürüklenir (radius=4 -> ~1.5x, radius=12
      // -> ~0.6x civarı — basit bir ters-orantı, karmaşık bir fizik motoru YOK).
      let windDx = 0;
      let windDy = 0;
      if (this.windVx !== 0 || this.windVy !== 0) {
        const massFactor = 6 / Math.max(2, creature.genome.radius);
        windDx = this.windVx * massFactor * dt;
        windDy = this.windVy * massFactor * dt;
      }

      this.moveCreature(creature, delta.dx + windDx, delta.dy + windDy);
      creature.update(dt);

      const cd = this.divideCooldowns.get(creature) ?? 0;
      if (cd > 0) this.divideCooldowns.set(creature, cd - dt);
      const matingCd = this.matingCooldowns.get(creature) ?? 0;
      if (matingCd > 0) this.matingCooldowns.set(creature, matingCd - dt);
    }

    if (this.creatures.some((c) => !c.alive)) {
      this.creatures = this.creatures.filter((c) => c.alive);
    }
  }

  /**
   * Faz IX — Etoloji (TASKS.md madde 4): otçul davranış durum makinesi —
   * "flee" (algı menzilinde bir etçil varsa öncelik onu kaçmak, TOKLUKTAN BAĞIMSIZ —
   * tok bir birey de tehlikeden kaçmalı), yoksa mevcut Faz I-VIII besin arama mantığı
   * ("seek"/"wander", HİÇ değiştirilmedi — sadece bu fonksiyona taşındı). Faz IX
   * açlık/tokluk eklentisi (kullanıcı isteği): birey TOK ise (bkz. `SATIATION_THRESHOLD`)
   * aktif besin aramayı bırakıp gezinmeye döner — gerçekçilik + gereksiz enerji
   * harcayan sürekli besin takibini azaltan bir güvence.
   */
  /**
   * Faz XIII — Kritik açlık/kaçış çakışması düzeltmesi (kök neden analizi, TASKS.md
   * madde 1): eskiden "flee" durumu enerji seviyesinden TAMAMEN bağımsız olarak her
   * zaman besin aramaya/yemeye öncelikliydi — bir otçul, kıyıya yakın bir bölgede
   * gezinen bir etçilin algı menzilinde SÜREKLİ kalırsa (örn. etçil aynı bölgede
   * avlanıyorsa), o otçul kaçmaktan başka hiçbir şey yapmadan enerjisini tüketip
   * ölebiliyordu — besin BOL ve YAKIN olsa bile. Uzun (5+ dk) koşularda gözlemlenen
   * "besin bol ama popülasyon aniden çöküyor" bulgusunun kök nedeni buydu: bir kıyı
   * kümesindeki onlarca otçul aynı anda/sürekli "flee" durumuna kilitlenip toplu
   * halde açlıktan ölüyordu (bkz. TASKS.md Faz XIII kök neden analizi).
   * Düzeltme: enerji KRİTİK bir eşiğin (`CRITICAL_STARVATION_THRESHOLD`) altındaysa,
   * kaçış davranışı DEVAM EDER (tehlikeden vazgeçilmiyor) ama eğer TAM O ANDA yakın
   * mesafede (EAT_RADIUS içinde) bir nutrient varsa önce onu yer — "kaçarken önüne
   * çıkan yiyeceği kaçırmaz" gerçekçiliği, aktif bir besin ARAYIŞINA dönüşmüyor
   * (TASKS.md'nin "flee her zaman öncelikli kalmalı" ilkesi korunuyor, sadece mutlak
   * açlık durumunda bedava bir hayatta kalma şansı ekleniyor).
   */
  private static readonly CRITICAL_STARVATION_THRESHOLD = 0.12;

  private stepHerbivore(creature: Creature, onLand: boolean, dt: number): { dx: number; dy: number } {
    const predator = this.findNearestThreat(creature, onLand);
    if (predator) {
      const energyRatio = creature.energy / creature.maxEnergy;
      if (energyRatio <= Ecosystem.CRITICAL_STARVATION_THRESHOLD) {
        const nutrientPool = onLand ? this.landNutrients : this.nutrients;
        const nearbyFood = this.findNearestNutrient(nutrientPool, creature.x2, creature.y2, EAT_RADIUS);
        if (nearbyFood) {
          const gained = nearbyFood.energyValue * creature.feedingEfficiency();
          creature.energy = Math.min(creature.maxEnergy, creature.energy + gained);
          this.removeNutrient(nutrientPool, nearbyFood);
        }
      }
      creature.behaviorState = "flee";
      creature.behaviorTarget = predator;
      const delta = creature.steerAway(predator.x2, predator.y2, onLand, dt);
      return this.steerDeltaAwayFromBoundary(creature, onLand, delta);
    }

    const isSatiated = creature.energy / creature.maxEnergy >= this.herbivoreSatiationThreshold();
    if (isSatiated) {
      creature.behaviorState = "wander";
      creature.behaviorTarget = null;
      const delta = creature.stepWander(dt, onLand);
      return this.steerDeltaAwayFromBoundary(creature, onLand, delta);
    }

    const nutrientPool = onLand ? this.landNutrients : this.nutrients;
    // Faz XIII — Gerçek besin arayışı + rekabet (TASKS.md madde 2): en yakın DEĞİL,
    // makul şekilde en iyi (yakın+yoğun) küme; bu karede başka bir canlı tarafından
    // zaten hedeflenmiş nutrient'lar hariç tutuluyor (bkz. `claimedNutrientsThisFrame`).
    const target = this.findBestNutrientCluster(
      nutrientPool,
      creature.x2,
      creature.y2,
      creature.effectiveSenseRadius(),
      this.claimedNutrientsThisFrame
    );
    if (target) {
      creature.behaviorState = "seek";
      creature.behaviorTarget = null;
      const dist = Math.hypot(target.x2 - creature.x2, target.y2 - creature.y2);
      if (dist <= EAT_RADIUS) {
        const gained = target.energyValue * creature.feedingEfficiency();
        creature.energy = Math.min(creature.maxEnergy, creature.energy + gained);
        this.removeNutrient(nutrientPool, target);
        const delta = creature.stepWander(dt, onLand);
        return this.steerDeltaAwayFromBoundary(creature, onLand, delta);
      }
      this.claimedNutrientsThisFrame.add(target);
      creature.steerToward(target.x2, target.y2);
      const step = Math.min(dist, creature.effectiveMoveSpeed(onLand) * dt);
      const angle = Math.atan2(target.y2 - creature.y2, target.x2 - creature.x2);
      const delta = { dx: Math.cos(angle) * step, dy: Math.sin(angle) * step };
      return this.steerDeltaAwayFromBoundary(creature, onLand, delta);
    }

    creature.behaviorState = "wander";
    creature.behaviorTarget = null;
    const delta = creature.stepWander(dt, onLand);
    return this.steerDeltaAwayFromBoundary(creature, onLand, delta);
  }

  /** Faz IX — Açlık/tokluk (kullanıcı isteği, 2026-09-02): enerji oranı bu eşiğin
   *  ÜZERİNDEYSE birey "tok" sayılır. Tok bir etçil aktif olarak avlanmayı BIRAKIP
   *  gezinmeye döner (TASKS.md ruhuyla tutarlı: gerçekçilik + aşırı avlanma baskısını
   *  doğal olarak yumuşatma). Otçullar için tokluk sadece besin ARAMA hevesini azaltır
   *  (flee her zaman öncelikli kalır — tok bir otçul da tehlikeden kaçmalı).
   *
   * Denge düzeltmesi (kullanıcı gözlemi, 2026-09-02, ölçümle doğrulandı): ilk değer
   * (0.75) tek başına yetersiz kaldı — 3 dakikalık bağımsız bir koşuda (RUN2) etçil
   * sayısı 4'ten 32'ye çıkıp otçul popülasyonunu 136'dan 5'e (neredeyse sıfıra)
   * çökertti (t+100-180s arası hızlı bir sarmal). Etçiller için eşik 0.6'ya düşürüldü
   * (daha erken "tok" sayılıp avlanmayı bırakırlar) — TASKS.md'nin "sürdürülebilir
   * av-avcı dengesi" hedefiyle tutarlı. Otçullar için eşik DEĞİŞMEDİ (0.75) — onlar
   * için tokluk sadece besin arama hevesini etkiliyor, avlanma baskısıyla ilgisi yok. */
  private static readonly CARNIVORE_SATIATION_THRESHOLD = 0.6;
  private static readonly HERBIVORE_SATIATION_THRESHOLD = 0.75;

  /** Faz XIII (opsiyonel madde 3) — Gemini'nin `foragingPriority` önerisi bu iki sabit
   *  eşiğe küçük, clamp'li bir ofset ekler (bkz. `getBehaviorAdjustmentOffsets`).
   *  Öneri hiç gelmediyse ofset 0 — eşikler tam olarak sabit değerleriyle çalışır. */
  private herbivoreSatiationThreshold(): number {
    const { foragingPriority } = getBehaviorAdjustmentOffsets();
    return Math.min(0.95, Math.max(0.4, Ecosystem.HERBIVORE_SATIATION_THRESHOLD + foragingPriority));
  }
  private carnivoreSatiationThreshold(): number {
    const { foragingPriority } = getBehaviorAdjustmentOffsets();
    return Math.min(0.9, Math.max(0.3, Ecosystem.CARNIVORE_SATIATION_THRESHOLD + foragingPriority));
  }

  /** Faz IX — Sindirim molası (kullanıcı isteği): bir etçil av yakaladıktan sonra bir
   *  süre tekrar avlanmaz (v2'nin eski `DIGEST_COOLDOWN` deseninden ilham alındı, TASKS.md
   *  notu). Tokluk eşiğiyle BİRLİKTE çalışır — ikisi de aşırı avlanma baskısını önlemeye
   *  yönelik, bağımsız iki mekanizma.
   *
   * Denge düzeltmesi: ilk aralık (10-20s) yetersiz kaldı (RUN2 çöküşü, yukarıdaki
   * nota bkz.) — 20-35s'ye uzatıldı, avlanma sıklığını daha da düşürür. */
  private static readonly DIGEST_COOLDOWN: [number, number] = [20, 35];
  private readonly digestCooldowns = new WeakMap<Creature, number>();

  /** Faz IX — Av sığınağı (kullanıcı isteği, Faz IV'ün "nutrientCapacity" density-
   *  dependent düzeltmesinden ilham alındı): otçul popülasyonu bu eşiğin ALTINA
   *  düşerse etçiller avlanmayı bırakıp sadece gezinir — tüm otçul popülasyonunun
   *  etçiller tarafından silinmesini önleyen bir taban güvence (TASKS.md: "sürdürülebilir
   *  bir av-avcı dengesi").
   *
   * Denge düzeltmesi: sabit eşik (8) çok düşüktü — popülasyon 140'a yakınken 8 neredeyse
   * hiç tetiklenmiyor, hızlı bir çöküş sarmalı sığınağın devreye girmesinden çok önce
   * gerçekleşiyordu (RUN2 ölçümü). Artık toplam popülasyonun bir ORANI (%15) VE mutlak
   * bir taban (12) ile tanımlı — popülasyon büyüdükçe sığınak eşiği de büyüyor (Faz
   * IV'teki density-dependent düzeltmeyle aynı ilke). */
  private static readonly PREY_REFUGE_HERBIVORE_FRACTION = 0.15;
  private static readonly PREY_REFUGE_HERBIVORE_MIN = 12;

  private preyRefugeThreshold(): number {
    const totalPopulation = this.creatures.length;
    return Math.max(
      Ecosystem.PREY_REFUGE_HERBIVORE_MIN,
      Math.round(totalPopulation * Ecosystem.PREY_REFUGE_HERBIVORE_FRACTION)
    );
  }

  /**
   * Faz IX — Diyet sistemi + Etoloji (TASKS.md madde 3-4): etçil davranış —
   * algı menzilinde bir av (SADECE otçul, TASKS.md netleştirmesi: etçil-etçil
   * avlanması YOK — basitlik ve olay karmaşasını önlemek için) varsa kovalar
   * ("hunt"), yakalama mesafesine (`EAT_RADIUS` ile aynı basit mesafe kuralı)
   * ulaşınca avı öldürüp enerji transferi yapar (basit — dövüş sistemi YOK).
   * Tok bir etçil (bkz. `SATIATION_THRESHOLD`), sindirim molasındaki bir etçil
   * (bkz. `DIGEST_COOLDOWN`) veya av sığınağı eşiği altındaki bir popülasyonda
   * (bkz. `PREY_REFUGE_HERBIVORE_THRESHOLD`) avlanmaz, sadece gezinir — bunların
   * hepsi "etçiller herkesi yiyip ekosistemi çökertiyor" sorununu (kullanıcı gözlemi)
   * doğal/gerçekçi bir şekilde yumuşatan, birbirinden bağımsız üç güvence.
   */
  private stepCarnivore(creature: Creature, onLand: boolean, dt: number): { dx: number; dy: number } {
    const digestCd = this.digestCooldowns.get(creature) ?? 0;
    if (digestCd > 0) this.digestCooldowns.set(creature, digestCd - dt);

    const isSatiated = creature.energy / creature.maxEnergy >= this.carnivoreSatiationThreshold();
    const inDigestCooldown = digestCd > 0;
    const herbivoreCount = this.getDietCounts().herbivore;
    const refugeActive = herbivoreCount < this.preyRefugeThreshold();

    if (isSatiated || inDigestCooldown || refugeActive) {
      creature.behaviorState = "wander";
      creature.behaviorTarget = null;
      const delta = creature.stepWander(dt, onLand);
      return this.steerDeltaAwayFromBoundary(creature, onLand, delta);
    }

    const prey = this.findNearestPrey(creature, onLand);
    if (!prey) {
      creature.behaviorState = "wander";
      creature.behaviorTarget = null;
      const delta = creature.stepWander(dt, onLand);
      return this.steerDeltaAwayFromBoundary(creature, onLand, delta);
    }

    creature.behaviorState = "hunt";
    creature.behaviorTarget = prey;
    const dist = Math.hypot(prey.x2 - creature.x2, prey.y2 - creature.y2);
    if (dist <= EAT_RADIUS) {
      this.huntCreature(creature, prey);
      const delta = creature.stepWander(dt, onLand);
      return this.steerDeltaAwayFromBoundary(creature, onLand, delta);
    }
    creature.steerToward(prey.x2, prey.y2);
    const step = Math.min(dist, creature.effectiveMoveSpeed(onLand) * dt);
    const angle = Math.atan2(prey.y2 - creature.y2, prey.x2 - creature.x2);
    const delta = { dx: Math.cos(angle) * step, dy: Math.sin(angle) * step };
    return this.steerDeltaAwayFromBoundary(creature, onLand, delta);
  }

  /** Algı menzilinde en yakın etçili bulur (otçulların "flee" kararı için) — aynı
   *  arazi türünde (su/kara) olmalı, kendisi hariç. */
  private findNearestThreat(creature: Creature, onLand: boolean): Creature | null {
    let best: Creature | null = null;
    // Faz XIII (opsiyonel madde 3) — Gemini'nin `wanderBoldness` önerisi tehdit algı
    // menzilini küçük bir oranda (±%15 sınırında) daraltıp/genişletebilir — pozitif
    // ofset "daha cesur" (tehdidi daha geç fark eder) demek, negatif "daha ürkek".
    // Flee mekanizmasının kendisi (mesafe eşiği, boundary-aware kaçış) HİÇ değişmiyor,
    // sadece ne kadar erken tetiklendiği hafifçe kayıyor — öneri yoksa çarpan 1 (nötr).
    const { wanderBoldness } = getBehaviorAdjustmentOffsets();
    const boldnessFactor = Math.min(1.15, Math.max(0.85, 1 - wanderBoldness));
    let bestDist = creature.effectiveSenseRadius() * boldnessFactor;
    // Faz XV — Performans: `Math.hypot` yerine kare-mesafe karşılaştırması (sqrt yok).
    // Sadece bir eşik karşılaştırması yapıldığı için matematiksel olarak eşdeğer,
    // sonuç (hangi canlının en yakın olduğu) hiç değişmiyor — 140 canlıda bu döngü
    // canlı başına çağrıldığından (O(n²)) sqrt maliyeti popülasyon tavanında ölçülebilir.
    let bestDistSq = bestDist * bestDist;
    for (const other of this.creatures) {
      if (other === creature || !other.alive) continue;
      if (other.genome.diet !== "carnivore") continue;
      const otherOnLand = !this.world.isWater(other.x2, other.y2);
      if (otherOnLand !== onLand) continue;
      const dx = other.x2 - creature.x2;
      const dy = other.y2 - creature.y2;
      const distSq = dx * dx + dy * dy;
      if (distSq <= bestDistSq) {
        best = other;
        bestDistSq = distSq;
      }
    }
    return best;
  }

  /** Algı menzilinde en yakın avı bulur (etçillerin "hunt" kararı için) — SADECE
   *  otçullar (TASKS.md netleştirmesi, kullanıcı isteği: etçil-etçil avlanması YOK,
   *  olay/denge karmaşasını önlemek için), aynı arazi türünde, kendisi hariç. */
  private findNearestPrey(creature: Creature, onLand: boolean): Creature | null {
    let best: Creature | null = null;
    // Faz XV — Performans: bkz. `findNearestThreat`'teki aynı kare-mesafe notu.
    let bestDistSq = creature.effectiveSenseRadius() ** 2;
    for (const other of this.creatures) {
      if (other === creature || !other.alive) continue;
      if (other.genome.diet !== "herbivore") continue;
      const otherOnLand = !this.world.isWater(other.x2, other.y2);
      if (otherOnLand !== onLand) continue;
      const dx = other.x2 - creature.x2;
      const dy = other.y2 - creature.y2;
      const distSq = dx * dx + dy * dy;
      if (distSq <= bestDistSq) {
        best = other;
        bestDistSq = distSq;
      }
    }
    return best;
  }

  /** Faz IX — Basit avlanma mekaniği (TASKS.md madde 3): karmaşık bir dövüş sistemi
   *  yok — yakalama mesafesine ulaşan bir etçil avını doğrudan öldürüp enerjisinin
   *  bir kısmını (`PREY_ENERGY_TRANSFER_FRACTION`) kazanır. Avın kabuk/kamuflaj/diken
   *  gibi savunma organları (`survivalBonus`) bir KAÇIŞ ŞANSI sağlar — avcı her zaman
   *  otomatik kazanmaz, TASKS.md'nin "gerçek seçilim baskısı" ilkesiyle tutarlı bir
   *  şekilde savunma organlarının bir işlevi olsun diye. Başarılı bir avdan sonra
   *  avcı bir SİNDİRİM MOLASINA girer (bkz. `DIGEST_COOLDOWN`) — aşırı avlanma
   *  baskısını yumuşatan bağımsız bir güvence. */
  private static readonly PREY_ENERGY_TRANSFER_FRACTION = 0.6;

  /** Faz XVII Madde 2 — Sürü davranışı (TASKS.md): "yakındaki aynı-tip etçil sayısı
   *  avlanma başarısını artırsın, basit bir mutasyonla ortaya çıkan davranış geni
   *  olarak" — karmaşık bir sürü-AI/flocking algoritması YOK, sadece bir sayım.
   *  Sadece `packHunter` genine sahip bireylerde etkili; sabit bir yarıçap
   *  (`PACK_HUNT_RADIUS`) içindeki aynı-diyet (carnivore) bireyler sayılır (kendisi
   *  hariç), her müttefik `escapeChance`'i küçük bir miktar (`PACK_HUNT_BONUS_PER_ALLY`)
   *  düşürür, toplamda `PACK_HUNT_MAX_BONUS` ile sınırlanır — avın hâlâ tam bir
   *  garantisi yok (sıfıra inmiyor), sadece sürü halinde avlanmak istatistiksel
   *  olarak daha başarılı oluyor. */
  private static readonly PACK_HUNT_RADIUS = 80;
  private static readonly PACK_HUNT_BONUS_PER_ALLY = 0.08;
  private static readonly PACK_HUNT_MAX_BONUS = 0.35;

  private packHuntEscapeReduction(predator: Creature): number {
    if (!predator.genome.packHunter) return 0;
    const radiusSq = Ecosystem.PACK_HUNT_RADIUS * Ecosystem.PACK_HUNT_RADIUS;
    let allyCount = 0;
    for (const other of this.creatures) {
      if (other === predator || !other.alive) continue;
      if (other.genome.diet !== "carnivore") continue;
      const dx = other.x2 - predator.x2;
      const dy = other.y2 - predator.y2;
      if (dx * dx + dy * dy <= radiusSq) allyCount++;
    }
    return Math.min(Ecosystem.PACK_HUNT_MAX_BONUS, allyCount * Ecosystem.PACK_HUNT_BONUS_PER_ALLY);
  }

  private huntCreature(predator: Creature, prey: Creature): void {
    // Savunma organları (kabuk/kamuflaj/diken) avdan kaçma şansı verir — bedava değil,
    // ama tamamen çaresiz de değil (survivalBonus zaten Faz II'den beri var, burada
    // ilk kez gerçek bir "avcı" bağlamında kullanılıyor). Sürü avcısı bir predatörse
    // yakındaki müttefikler bu şansı hafifçe düşürür (bkz. `packHuntEscapeReduction`).
    // Faz XX — kromatofor: `survivalBonus`'un SABİT payına ek, sadece bu yakalanma
    // anında devreye giren AYRI bir tepkisel kaçış şansı (bkz. `chromatophoreReactiveEscapeChance`).
    const escapeChance = Math.max(
      0,
      Math.min(0.6, prey.survivalBonus()) +
        prey.chromatophoreReactiveEscapeChance() -
        this.packHuntEscapeReduction(predator)
    );
    if (Math.random() < escapeChance) return;

    const gained = prey.energy * Ecosystem.PREY_ENERGY_TRANSFER_FRACTION;
    predator.energy = Math.min(predator.maxEnergy, predator.energy + gained);
    predator.triggerHuntFlash();
    this.killCreature(prey, "predation");

    // Faz XXI — Simbiyotik bağırsak florası: sindirim molası süresini kısaltır (bkz.
    // `Creature.digestCooldownMultiplier`) — organ yoksa çarpan 1 (davranış AYNI).
    const [minCd, maxCd] = Ecosystem.DIGEST_COOLDOWN;
    this.digestCooldowns.set(
      predator,
      (minCd + Math.random() * (maxCd - minCd)) * predator.digestCooldownMultiplier()
    );

    // Faz X — Avlanma event log gürültüsü (TASKS.md, kullanıcı geri bildirimi
    // 2026-09-02: "avcıların avlama mesajını gönderme bana"). Faz IX'ta HER
    // avlanmanın %15'i bile (yüzlerce avlanma olan uzun bir koşuda) event log'u
    // hızla domine edip Faz III'ün gerçek eşik-tabanlı organ olaylarını ve Faz
    // VIII'in dünya olaylarını görünmez kılıyordu — tekil av olaylarının kendisi
    // (aksine "ilk etçil ortaya çıktı" gibi TEK SEFERLİK kilometre taşları,
    // bkz. `checkFirstCarnivore`) kullanıcı için tekrarlayan/öngörülebilir bir
    // bilgiydi, "neden evrimleşti" sorusuna organ/tükenme olayları kadar katkı
    // sağlamıyordu. KARAR: tekil avlanma olayları event log'dan TAMAMEN kaldırıldı
    // (özetlenmiş/periyodik bir sayaç yerine tam kaldırma tercih edildi — periyodik
    // bir "son 1 dakikada N avlanma" satırı da düzenli aralıklarla tekrar eden,
    // aynı şekilde bilgi değeri düşük bir gürültü kaynağı olurdu; diyet sayıları
    // zaten HUD'da her zaman görünür — 🌱 N / 🍽️ N — bu da avlanma baskısının
    // dolaylı ama sürekli bir göstergesi). MEKANİK/istatistik HİÇ değişmedi: enerji
    // transferi, sindirim molası, `triggerHuntFlash` görsel vurgusu ve
    // `getDietCounts` sayaçları aynen çalışmaya devam ediyor — sadece tekil log
    // satırı (aşağıdaki eski `pushEvolutionEvent` çağrısı) kaldırıldı.
  }

  /** Canlıyı önerilen (dx,dy) kadar taşımaya çalışır. Faz I'de hedef her zaman su
   *  olmak zorundaydı; Faz II'de bacak organı taşıyan bireyler (`canWalkOnLand()`)
   *  karaya da geçebilir (TASKS.md — "Su → kara geçişi"). Bacaksız bireyler için kara
   *  hâlâ tamamen yasak — hedef nokta kara/sınır dışıysa hareket iptal edilip yön
   *  rastgele çevrilir (basit "geri sekme").
   *
   * Faz IX düzeltmesi (kullanıcı bug raporu, 2026-09-02) — "otçullar kıyıda kümelenip
   * hareketsiz kalıyor": kök neden, "flee" durumunun her karede `steerAway` ile
   * heading'i YENİDEN tehdide göre hesaplaması. Bir otçul su kıyısına sıkışmışsa VE
   * tehditten kaçış yönü karaya (bacaksız için yasak bölge) çıkıyorsa, tam hareket
   * HER KEREDE iptal ediliyordu — `bounceHeading` çağrılsa da bir sonraki karede
   * `steerAway` heading'i hemen tekrar tehdit-karşıtı yöne sabitleyip bu düzeltmeyi
   * anında eziyordu, net sonuç: konum donuyor (sadece enerji azalıyordu, hareket
   * hiç olmuyordu). Düzeltme: tam vektör engellenirse, ekseni AYRI AYRI dene (önce
   * sadece dx, sonra sadece dy) — kıyı boyunca "sıyırarak" kaçmaya izin verir, aksi
   * halde (her iki eksen de engelliyse) eskisi gibi rastgele bir yöne sek. */
  private moveCreature(creature: Creature, dx: number, dy: number): void {
    const w = this.world.width_;
    const h = this.world.height_;

    // Faz XVII — KÖK NEDEN DÜZELTMESİ (donma bug'ı): `nx`/`ny` clamp edilmeden ÖNCE
    // hesaplanan `outOfBounds` bayrağı hareketi TAMAMEN reddediyordu — clamp sonrası
    // konum harita sınırları içinde kalsa bile. Bu, bir canlı (bkz. `spawnOffspring`'teki
    // ikinci kök neden) HERHANGİ bir nedenle zaten sınırın az ötesindeyse (`creature.x2`/
    // `y2` > sınır), `tryMove(0, dy)` gibi bir eksen-only denemede bile `ny` (değişmeyen
    // eksen `creature.y2`'den türediği için) HEP sınır dışı kalıp `outOfBounds` hep
    // `true` döndüğü, dolayısıyla canlının haritaya GERİ DÖNMESİNE izin veren hiçbir
    // hareketin kabul edilmediği (kalıcı/sonsuz kilitlenme) bir kanıtlanmış senaryo
    // yaratıyordu. Düzeltme: artık `outOfBounds` reddi YOK — hedef HER ZAMAN [0,w]x[0,h]
    // aralığına clamp edilir (davranış: harita kenarında "duvara yaslanma" hissi,
    // önceki normal/sınır-içi hareketler için TAMAMEN aynı sonucu üretir, çünkü clamp
    // sınır içindeyken no-op'tur).
    const tryMove = (tdx: number, tdy: number): boolean => {
      let nx = creature.x2 + tdx;
      let ny = creature.y2 + tdy;
      nx = Math.max(0, Math.min(w, nx));
      ny = Math.max(0, Math.min(h, ny));
      const targetIsWater = this.world.isWater(nx, ny);
      const allowed = targetIsWater || creature.canWalkOnLand();
      if (!allowed) return false;
      // Faz X — Sığ/derin su ayrımı (TASKS.md): mevcut su→kara kısıtının (üstteki
      // `allowed`, Faz II'den beri DEĞİŞMEDİ) üstüne İNCE bir katman — bacaklı
      // (kara-uyumlu) ama su-uyumlu bir organı (yüzgeç/solungaç) OLMAYAN bireyler
      // derin suya giremez (sadece sığ su + kara ile sınırlı, "kıyı/amfibi"
      // davranışı). Yüzgeç veya solungaç taşıyan HERHANGİ bir birey (bacaklı olsun
      // olmasın) derin suda rahat — organsız/bacaksız mikroorganizmalar (v3'ün
      // varsayılan, ezici çoğunluk) bu kısıttan HİÇ etkilenmez, her zamanki gibi
      // tüm su alanında serbestçe dolaşır (Faz I'den beri değişmeyen temel davranış).
      if (targetIsWater && this.world.isDeepWater(nx, ny) && !creature.canEnterDeepWater()) {
        return false;
      }
      creature.setPosition(nx, ny);
      return true;
    };

    if (tryMove(dx, dy)) return;
    // Tam vektör engellendi — kıyı boyunca kayabilmek için eksenleri ayrı dene
    // (örn. tehditten dikine kaçmak mümkün olmasa bile paralel kaçmak mümkün olabilir).
    if (dx !== 0 && tryMove(dx, 0)) return;
    if (dy !== 0 && tryMove(0, dy)) return;

    // Hiçbir eksen de işe yaramadıysa (gerçekten sıkışmış/köşede) eskisi gibi rastgele
    // bir yöne sek — bir sonraki karede tekrar denenecek.
    creature.bounceHeading(Math.random() - 0.5, Math.random() - 0.5);
  }

  /**
   * Faz XIII — Sınır farkındalığı (TASKS.md madde 2): "canlı kara/harita sınırına
   * yaklaşırken ÖNCEDEN yön değiştirsin (çarpıp rastgele sekmesin)". Bu, `moveCreature`'ın
   * REAKTİF bounce'unun (çarpışma sonrası düzeltme, Faz I'den beri var, DEĞİŞMEDİ) yerini
   * almıyor — ONA EK olarak, hareket kararı verilmeden ÖNCE çağrılan basit bir "ileride
   * engel var mı" kontrolü. Algı menzilinin bir kısmı kadar ileriye (`LOOKAHEAD_DISTANCE`)
   * bakılır; o nokta bu canlı için geçersizse (harita sınırı dışı, ya da su-uyumsuz kara/
   * derin su), mevcut heading'e küçük bir "kaçınma" bileşeni eklenir — tam bir yön
   * DEĞİŞTİRME değil, hafif bir yönelme (TASKS.md: "kaçınma yönüne hafif yönelme yeterli,
   * karmaşık bir pathfinding gerekmiyor"). Deterministik/lokal — Gemini'ye bağımlı değil.
   */
  private static readonly BOUNDARY_LOOKAHEAD_DISTANCE = 26; // px — ileri bakış mesafesi
  private static readonly BOUNDARY_AVOIDANCE_WEIGHT = 0.55; // 0..1 — kaçınma yönüne ne kadar ağırlık verilsin

  /** Verilen nokta bu canlı için geçerli bir hedef mi (harita sınırları içinde VE
   *  su/kara/derin-su kısıtına uygun) — `moveCreature`'daki `tryMove` ile AYNI kural
   *  seti, ama burada sadece bir SORGU (hareket etmiyor), ileri bakış için kullanılıyor. */
  private isPassablePoint(creature: Creature, x: number, y: number): boolean {
    if (x < 0 || x > this.world.width_ || y < 0 || y > this.world.height_) return false;
    const targetIsWater = this.world.isWater(x, y);
    if (!targetIsWater && !creature.canWalkOnLand()) return false;
    if (targetIsWater && this.world.isDeepWater(x, y) && !creature.canEnterDeepWater()) return false;
    return true;
  }

  /**
   * Mevcut heading'de `BOUNDARY_LOOKAHEAD_DISTANCE` kadar ileride bir engel (harita
   * sınırı veya su/kara uyumsuzluğu) varsa, engelden uzaklaşan bir yöne doğru heading'i
   * HAFİFÇE (tam çevirmeden, karışım ağırlığıyla) kaydırır. Engel yoksa heading'e
   * dokunmaz. `wander`/`seek`/`flee`/`hunt`'ın hepsi bu ortak kontrolü kullanabilir —
   * davranış kararının kendisini (ne yapılacağını) değiştirmiyor, sadece SEÇİLEN yönü
   * çarpışmadan önce hafifçe düzeltiyor.
   */
  private applyBoundaryAwareness(creature: Creature, onLand: boolean, heading: number): number {
    void onLand;
    const lookX = creature.x2 + Math.cos(heading) * Ecosystem.BOUNDARY_LOOKAHEAD_DISTANCE;
    const lookY = creature.y2 + Math.sin(heading) * Ecosystem.BOUNDARY_LOOKAHEAD_DISTANCE;
    if (this.isPassablePoint(creature, lookX, lookY)) return heading;

    // İleride engel var — birkaç aday yön arasından (mevcut heading'e göre sapma
    // açısı artan sırada) İLK geçerli olanı "kaçınma yönü" olarak seç, sonra mevcut
    // heading ile bu yön arasında hafif bir karışım uygula (TASKS.md: "hafif yönelme").
    const candidateOffsets = [
      Math.PI / 6,
      -Math.PI / 6,
      Math.PI / 3,
      -Math.PI / 3,
      Math.PI / 2,
      -Math.PI / 2,
      (2 * Math.PI) / 3,
      -(2 * Math.PI) / 3,
      Math.PI,
    ];
    for (const offset of candidateOffsets) {
      const candidateHeading = heading + offset;
      const cx = creature.x2 + Math.cos(candidateHeading) * Ecosystem.BOUNDARY_LOOKAHEAD_DISTANCE;
      const cy = creature.y2 + Math.sin(candidateHeading) * Ecosystem.BOUNDARY_LOOKAHEAD_DISTANCE;
      if (this.isPassablePoint(creature, cx, cy)) {
        // Hafif karışım: tam bu yöne dönmüyor, mevcut niyetle (avlanma/kaçış/arayış
        // hedefi) kaçınma yönü arasında bir ara açı seçiyor — ani/karikatür bir dönüş
        // yerine yumuşak bir sapma (TASKS.md: "hafif yönelme").
        return blendAngles(heading, candidateHeading, Ecosystem.BOUNDARY_AVOIDANCE_WEIGHT);
      }
    }
    // Hiçbir aday yön de geçerli değilse (gerçekten köşeye sıkışmış) heading'e
    // dokunma — `moveCreature`'ın reaktif bounce'u zaten devrede kalıyor (güvenlik ağı).
    return heading;
  }

  /** `stepWander`/`steerToward`/`steerAway` gibi mevcut `Creature` metodları zaten bir
   *  `{dx, dy}` deltası hesaplıyor — `Creature`'ın iç `heading` alanına dokunmadan
   *  (yeni bir public API eklemeye gerek kalmadan), bu deltanın açısını/uzunluğunu
   *  çıkarıp `applyBoundaryAwareness` ile düzeltilmiş açıya göre YENİDEN oluşturur.
   *  Delta sıfır vektörse (ör. tam hedefte) dokunmadan döner. */
  private steerDeltaAwayFromBoundary(
    creature: Creature,
    onLand: boolean,
    delta: { dx: number; dy: number }
  ): { dx: number; dy: number } {
    const dist = Math.hypot(delta.dx, delta.dy);
    if (dist < 0.0001) return delta;
    const heading = Math.atan2(delta.dy, delta.dx);
    const corrected = this.applyBoundaryAwareness(creature, onLand, heading);
    if (corrected === heading) return delta;
    return { dx: Math.cos(corrected) * dist, dy: Math.sin(corrected) * dist };
  }

  private findNearestNutrient(pool: Nutrient[], x: number, y: number, radius: number): Nutrient | undefined {
    let best: Nutrient | undefined;
    // Faz XV — Performans: kare-mesafe (bkz. `findNearestThreat`'teki not) — `pool`
    // popülasyon tavanında yüzlerce nutrient içerebiliyor, bu tam tarama her çağrıda
    // (canlı başına) tekrarlanıyor.
    let bestDistSq = Infinity;
    const radiusSq = radius * radius;
    for (const n of pool) {
      const dx = n.x2 - x;
      const dy = n.y2 - y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= radiusSq && distSq < bestDistSq) {
        best = n;
        bestDistSq = distSq;
      }
    }
    return best;
  }

  /**
   * Faz XIII — Gerçek besin arayışı (TASKS.md madde 2): "en yakın DEĞİL, makul şekilde
   * en iyi (yakın + yoğun besin kümesi) yöne git" hissi. Basit bir yerel yoğunluk
   * tahmini: algı menzilindeki her nutrient için "bu noktanın SENSE_CLUSTER_RADIUS
   * içinde kaç komşusu var" sayılır (aday sayısı azsa — tipik durum, birkaç düzine —
   * O(n²) burada sorun değil), bir skor = komşu_sayısı / (1 + mesafe/ölçek) hesaplanır
   * ve en yüksek skorlu nutrient hedef seçilir. Karmaşık bir grid/quadtree kümeleme
   * sistemi GEREKMİYOR (TASKS.md: "basit bir yerel yoğunluk tahmini yeterli") — aday
   * havuzu zaten senseRadius ile sınırlı, birkaç düzine nutrient'ı aşmıyor.
   *
   * Faz XIII — Rekabet (TASKS.md madde 2): aynı nutrient'a birden fazla canlı
   * yönelmesin diye `claimedNutrients` (bu karede zaten bir başka canlı tarafından
   * hedef seçilmiş nutrient'lar) parametre olarak alınır ve aday havuzundan çıkarılır
   * — "en yakın kazanır" ilkesi doğal olarak ortaya çıkıyor çünkü canlılar sırayla
   * işleniyor (bkz. `updateCreatures` — creatures listesi sırayla taranıyor) ve ilk
   * talep eden nutrient'ı claim ediyor, sıradaki canlı otomatik olarak başka bir
   * hedefe yönelmek zorunda kalıyor (aynı hedefe "boşuna üşüşme" önleniyor).
   */
  private static readonly SENSE_CLUSTER_RADIUS = 55; // px — yoğunluk tahmini için komşuluk yarıçapı
  private static readonly CLUSTER_DISTANCE_SCALE = 60; // px — mesafe cezasının ölçeği

  private findBestNutrientCluster(
    pool: Nutrient[],
    x: number,
    y: number,
    radius: number,
    claimed: Set<Nutrient>
  ): Nutrient | undefined {
    // Faz XIII — REGRESYON DÜZELTMESİ (kök neden analizi sırasında bulundu, 2026-09-03):
    // İlk sürüm, algı menzilindeki TÜM nutrient'lar claim edilmişse (küçük bir popülasyonda
    // veya nutrient yoğunluğunun düşük olduğu bir bölgede kolayca olabiliyor) `undefined`
    // döndürüyordu — bu, canlının "wander"a düşüp YAKININDA GERÇEKTEN BESİN VARKEN
    // yemeyi bırakması demekti. Uzun koşularda gözlemlenen ikinci bir çöküş deseni
    // (nutrient stoku BOL VE BÜYÜYOR olduğu halde popülasyon yine de eriyordu, "seek"
    // sayısı neredeyse sıfıra düşüyordu) bu regresyonla açıklandı. Düzeltme: önce
    // claim edilMEMİŞ adaylar arasında en iyi kümeyi ara (rekabet/"boşuna üşüşmeme"
    // hissi korunuyor); HİÇBİRİ yoksa (algı menzilindeki her şey zaten claim edilmiş)
    // claim'i YOK SAYIP en yakın nutrient'a yönel — iki canlının aynı hedefe gitmesi
    // (eski, Faz XIII öncesi davranış) kesinlikle "hiç yememe"den daha iyi bir sonuç.
    const unclaimed = this.bestClusterAmong(pool, x, y, radius, claimed);
    if (unclaimed) return unclaimed;
    return this.bestClusterAmong(pool, x, y, radius, null);
  }

  private bestClusterAmong(
    pool: Nutrient[],
    x: number,
    y: number,
    radius: number,
    claimed: Set<Nutrient> | null
  ): Nutrient | undefined {
    let best: Nutrient | undefined;
    let bestScore = -Infinity;

    // Aday havuzu: algı menzili içinde VE (claimed verildiyse) henüz bu karede başka
    // bir canlı tarafından hedeflenmemiş (rekabet — TASKS.md "boşuna aynı noktaya
    // üşüşmesinler").
    const candidates: { n: Nutrient; dist: number }[] = [];
    // Faz XV — Performans: `pool` popülasyon tavanında yüzlerce nutrient içerebiliyor
    // ve bu tarama her otçul için çağrılıyor — önce ucuz bir kare-mesafe eşiği ile
    // menzil dışındakileri ele, sadece menzile GİRENLER için gerçek `Math.hypot`
    // (aşağıdaki puanlama formülü gerçek mesafeye ihtiyaç duyduğundan sqrt'ten tamamen
    // kaçınamıyoruz, ama artık sadece adaylar için hesaplanıyor, tüm havuz için değil).
    const radiusSq = radius * radius;
    for (const n of pool) {
      if (claimed && claimed.has(n)) continue;
      const dx = n.x2 - x;
      const dy = n.y2 - y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= radiusSq) candidates.push({ n, dist: Math.sqrt(distSq) });
    }
    if (candidates.length === 0) return undefined;
    // Küçük aday havuzu (algı menziliyle doğal olarak sınırlı) — basit O(n²) yoğunluk
    // sayımı burada performans sorunu yaratmaz (TASKS.md: "basit bir yerel yoğunluk
    // tahmini yeterli, karmaşık bir kümeleme sistemi gerekmiyor"). Kare-mesafe ile eşik
    // karşılaştırması burada da sqrt'ten kaçınıyor (Faz XV).
    const clusterRadiusSq = Ecosystem.SENSE_CLUSTER_RADIUS * Ecosystem.SENSE_CLUSTER_RADIUS;
    for (const candidate of candidates) {
      let neighborCount = 0;
      for (const other of candidates) {
        if (other === candidate) continue;
        const dx = other.n.x2 - candidate.n.x2;
        const dy = other.n.y2 - candidate.n.y2;
        if (dx * dx + dy * dy <= clusterRadiusSq) neighborCount++;
      }
      // Skor: yoğunluk (komşu sayısı) yakınlıkla hafifletilmiş bir ceza ile birlikte —
      // çok uzak bir yoğun küme, yakın ama tekil bir nutrient'a karşı otomatik kazanmasın.
      const proximityFactor = Ecosystem.CLUSTER_DISTANCE_SCALE / (Ecosystem.CLUSTER_DISTANCE_SCALE + candidate.dist);
      const score = (1 + neighborCount) * proximityFactor;
      if (score > bestScore) {
        bestScore = score;
        best = candidate.n;
      }
    }
    return best;
  }

  private removeNutrient(pool: Nutrient[], nutrient: Nutrient): void {
    const idx = pool.indexOf(nutrient);
    if (idx >= 0) pool.splice(idx, 1);
    this.stage.removeChild(nutrient);
    nutrient.destroy();
  }

  // --- Bölünme (aseksüel çoğalma) ---

  private updateDivision(dt: number): void {
    void dt;
    if (this.creatures.length >= MAX_CREATURES) return;

    for (const creature of [...this.creatures]) {
      if (!creature.alive) continue;
      // Faz VII — `reproductionStrategy==="sexual"` olan bireyler artık aseksüel
      // bölünmüyor, YERİNE `updateSexualReproduction`'da eşleşmeyi bekliyor (TASKS.md:
      // "bazı bireyler bu stratejiyi kazanır, bazıları aseksüel bölünmeye devam eder" —
      // bu, AYNI bireyin İKİ yoldan birden üremesi değil, popülasyon genelinde iki
      // stratejinin PARALEL var olması anlamına geliyor). Bu kontrol olmadan "sexual"
      // geni tamamen etkisiz kalırdı — enerji eşiğine ulaşan birey her zaman önce
      // burada aseksüel bölünüp eşiğin altına düşer, cinsel eşleşmeye hiç sıra gelmez.
      if (creature.genome.reproductionStrategy === "sexual") continue;
      const cd = this.divideCooldowns.get(creature) ?? 0;
      if (cd > 0) continue;
      if (creature.energy < creature.maxEnergy * creature.genome.divideEnergyFraction) continue;

      this.divideCreature(creature);
      if (this.creatures.length >= MAX_CREATURES) break;
    }
  }

  private divideCreature(parent: Creature): void {
    const [min, max] = DIVIDE_COOLDOWN;
    parent.energy -= parent.maxEnergy * DIVIDE_ENERGY_COST_FRACTION;
    this.divideCooldowns.set(parent, min + Math.random() * (max - min));

    const childGenome = divideGenome(parent.genome);
    this.spawnOffspring(childGenome, parent.x2, parent.y2, parent.genome.radius, parent, null);
  }

  /**
   * Faz VII — ortak yavru doğurma yolu: hem aseksüel bölünme hem cinsel üreme aynı
   * mantığı paylaşır (konumlandırma, kara/su kısıtı, doğum sayacı, soy kaydı, görsel
   * işaret, `parentRef` ataması). `laysEggs` genine göre YA hemen aktif bir `Creature`
   * doğar YA DA bir `Egg` nesnesi olarak kuluçkaya yatar (TASKS.md — "Yumurtalama").
   * `secondParent` sadece cinsel üreme için (görsel işaretin iki ebeveynden de
   * çizilebilmesi için), aseksüel bölünmede `null`.
   */
  private spawnOffspring(
    childGenome: ReturnType<typeof divideGenome>,
    parentX: number,
    parentY: number,
    parentRadius: number,
    primaryParent: Creature,
    secondParent: Creature | null
  ): void {
    const angle = Math.random() * Math.PI * 2;
    const offset = parentRadius * 2.5;
    let cx = parentX + Math.cos(angle) * offset;
    let cy = parentY + Math.sin(angle) * offset;
    // Faz XVII — KÖK NEDEN DÜZELTMESİ (donma bug'ı, ikinci/asıl tetikleyici): bu
    // fonksiyon hiçbir zaman harita SINIRLARINI kontrol etmiyordu — sadece su/kara
    // kısıtını. Bir ebeveyn harita kenarına yakınken (`parentX`/`parentY` sınıra
    // 0-`offset` px mesafede), rastgele `angle`'a bağlı olarak yavru DOĞRUDAN harita
    // sınırının DIŞINDA (`cx`/`cy` ∉ [0,w]×[0,h]) doğabiliyordu — kanıtlandı (gerçek
    // bir koşuda `y2=1012.8` gözlemlendi, `MAP_HEIGHT=1000`). Bu, `moveCreature`'daki
    // (artık düzeltilen) `outOfBounds`-reddi bug'ıyla birleşince kalıcı bir donmaya
    // yol açıyordu. Düzeltme: doğum konumu her zaman harita sınırlarına clamp edilir
    // (su/kara kontrolü clamp SONRASI, güncel konumla tekrar yapılır — kıyıya çok
    // yakın bir clamp'in yanlışlıkla karaya düşürme ihtimaline karşı).
    cx = Math.max(0, Math.min(this.world.width_, cx));
    cy = Math.max(0, Math.min(this.world.height_, cy));
    const childCanWalkOnLand = childGenome.organs.some((o) => o.type === "leg");
    if (!this.world.isWater(cx, cy) && !childCanWalkOnLand) {
      cx = parentX;
      cy = parentY;
    }

    if (childGenome.laysEggs) {
      const egg = new Egg(cx, cy, childGenome);
      this.stage.addChild(egg);
      this.eggs.push(egg);
      // Yumurta anında da hafif bir görsel işaret (bölünme/çiftleşme gerçekten oldu
      // hissi) — TASKS.md'nin "üreme/büyüme görselliği net görünmeli" ilkesiyle tutarlı.
      const effect = new DivisionEffect(parentX, parentY, cx, cy, parentRadius);
      this.stage.addChild(effect);
      this.divisionEffects.push(effect);
      if (secondParent) void secondParent; // görsel işaret tek ebeveyn merkezli, yeterli
      return;
    }

    const [min, max] = DIVIDE_COOLDOWN;
    const child = new Creature(cx, cy, childGenome, true);
    child.energy = child.maxEnergy * NEWBORN_ENERGY_FRACTION;
    child.parentRef = primaryParent;
    this.divideCooldowns.set(child, min + Math.random() * (max - min));

    this.stage.addChild(child);
    this.creatures.push(child);
    this.totalBirths++;
    this.recordLineage(child);
    if (childGenome.generation > this.historicalMaxGeneration) {
      this.historicalMaxGeneration = childGenome.generation;
    }

    // Faz V — Üreme/büyüme görselliği: ebeveyn-yavru arasında kısa, hafif bir görsel
    // işaret (ince bağlantı çizgisi + ebeveyn etrafında genişleyip solan halka).
    const effect = new DivisionEffect(parentX, parentY, cx, cy, parentRadius);
    this.stage.addChild(effect);
    this.divisionEffects.push(effect);
  }

  /**
   * Faz VII — Çiftleşme (cinsel üreme, TASKS.md): `reproductionStrategy==="sexual"`
   * olan, üreme eşiğini geçmiş ve birbirine `MATING_RADIUS` içinde olan iki bireyi
   * eşleştirip `crossoverGenomes` ile bir yavru üretir. Aseksüel `updateDivision`'a
   * PARALEL/bağımsız çalışır — aynı `MAX_CREATURES` tavanına saygı duyar ama kendi
   * ayrı kuluçka sayaçlarını (`matingCooldowns`) kullanır.
   */
  private updateSexualReproduction(dt: number): void {
    void dt;
    if (this.creatures.length >= MAX_CREATURES) return;

    const eligible = this.creatures.filter((c) => {
      if (!c.alive) return false;
      if (c.genome.reproductionStrategy !== "sexual") return false;
      const cd = this.matingCooldowns.get(c) ?? 0;
      if (cd > 0) return false;
      return c.energy >= c.maxEnergy * c.genome.divideEnergyFraction;
    });

    // Faz XI — Sürekli İyileştirme (performans, 2026-09-09, PM onaylı): `eligible`
    // pozisyonları bu noktada zaten sabit (bu fonksiyon boyunca hiçbir canlı hareket
    // etmiyor, sadece eşleşme/enerji/yeni-doğan ekleniyor) — bu yüzden grid'i BİR KEZ
    // burada, `eligible`'dan inşa etmek güvenli (mid-frame hareket riski YOK, aksine
    // `findNearestPrey`/`findNearestThreat` gibi hareket-döngüsü İÇİNDE çağrılan
    // fonksiyonlara bu optimizasyon UYGULANMADI çünkü orada her canlı taranırken
    // komşularının pozisyonu aynı karede DEĞİŞMİŞ olabiliyor — grid anlık görüntüsü
    // bu canlı mutasyonu yakalayamaz, tie-break/sonuç eşdeğerliğini bozardı).
    this.rebuildCreatureGrid(eligible);
    const paired = new Set<Creature>();
    for (const a of eligible) {
      if (paired.has(a)) continue;
      let bestPartner: Creature | null = null;
      // Faz XV — Performans: bkz. `findNearestThreat`'teki kare-mesafe notu.
      let bestDistSq = MATING_RADIUS * MATING_RADIUS;
      const candidates = this.candidatesNear(a.x2, a.y2, MATING_RADIUS);
      for (const b of candidates) {
        if (a === b || paired.has(b)) continue;
        const dx = a.x2 - b.x2;
        const dy = a.y2 - b.y2;
        const distSq = dx * dx + dy * dy;
        if (distSq <= bestDistSq) {
          bestPartner = b;
          bestDistSq = distSq;
        }
      }
      if (!bestPartner) continue;

      paired.add(a);
      paired.add(bestPartner);
      this.mateCreatures(a, bestPartner);
      if (this.creatures.length >= MAX_CREATURES) break;
    }
  }

  private mateCreatures(a: Creature, b: Creature): void {
    const [min, max] = MATING_COOLDOWN;
    // Çiftleşme de aseksüel bölünme gibi bir enerji maliyeti taşır — bedava değil,
    // aksi halde cinsel üreme aseksüele göre haksız bir avantaj kazanır.
    a.energy -= a.maxEnergy * DIVIDE_ENERGY_COST_FRACTION * 0.5;
    b.energy -= b.maxEnergy * DIVIDE_ENERGY_COST_FRACTION * 0.5;
    this.matingCooldowns.set(a, min + Math.random() * (max - min));
    this.matingCooldowns.set(b, min + Math.random() * (max - min));

    const childGenome = crossoverGenomes(a.genome, b.genome);
    const midX = (a.x2 + b.x2) / 2;
    const midY = (a.y2 + b.y2) / 2;
    const avgRadius = (a.genome.radius + b.genome.radius) / 2;
    this.spawnOffspring(childGenome, midX, midY, avgRadius, a, b);
  }

  // --- Yumurtalama (Faz VII) ---

  /** Bekleyen yumurtaların kuluçka sürelerini ilerletir; süresi dolanları gerçek bir
   *  aktif `Creature`'a dönüştürür (TASKS.md — "bir süre bekleyip sonra açılıp aktif
   *  canlıya dönüşür"). */
  private updateEggs(dt: number): void {
    if (this.eggs.length === 0) return;
    for (const egg of this.eggs) {
      egg.update(dt);
    }
    const stillIncubating = this.eggs.filter((e) => !e.hatched);
    if (stillIncubating.length !== this.eggs.length) {
      for (const egg of this.eggs) {
        if (!egg.hatched) continue;
        this.stage.removeChild(egg);
        egg.destroy({ children: true });
        this.hatchEgg(egg);
      }
    }
    this.eggs = stillIncubating;
  }

  private hatchEgg(egg: Egg): void {
    if (this.creatures.length >= MAX_CREATURES) return; // tavan doluysa yavru kaybolur (aseksüel bölünmedeki tavan mantığıyla tutarlı)
    const [min, max] = DIVIDE_COOLDOWN;
    const child = new Creature(egg.x2, egg.y2, egg.genome, true);
    child.energy = child.maxEnergy * NEWBORN_ENERGY_FRACTION;
    this.divideCooldowns.set(child, min + Math.random() * (max - min));

    this.stage.addChild(child);
    this.creatures.push(child);
    this.totalBirths++;
    this.recordLineage(child);
    if (egg.genome.generation > this.historicalMaxGeneration) {
      this.historicalMaxGeneration = egg.genome.generation;
    }
  }

  // --- Ölüm ---

  /** `cause` — Faz IX: ölüm nedenini ayırt eder (TASKS.md/kullanıcı isteği: "yaşlılıktan
   *  ölüm istatistiği açlıktan ayrı tutulabilir"). Mekanik olarak hepsi aynı yolu
   *  (ceset+ayrıştırıcı, soy kaydı) izler — sadece isteğe bağlı sayaç/event için ayrım
   *  yapılıyor, davranışsal bir fark YOK (TASKS.md: "asıl önemli olan MEKANİK"). */
  private oldAgeDeathCount = 0;
  private killCreature(
    creature: Creature,
    cause: "starvation" | "predation" | "old_age" | "meteor" = "starvation"
  ): void {
    if (!creature.alive) return;
    creature.alive = false;
    this.spawnCorpse(creature);
    this.stage.removeChild(creature);
    creature.destroy();
    const idx = this.lineageIndexById.get(creature.genome.id);
    if (idx !== undefined) this.lineage[idx].diedAtSimTime = this.simulationTime;
    if (cause === "old_age") this.oldAgeDeathCount++;
  }

  /**
   * Faz VIII — Meteor (TASKS.md): haritada verilen bölgedeki (dairesel) canlıların
   * ve besinlerin BİR KISMINI (tamamını değil — TASKS.md "bir kısmı yok olur")
   * anında yok eder. Etkilenen canlı/besin SAYISINI döner (event log metni ve
   * headless doğrulama için). Ceset/soy kaydı mekaniğine `killCreature` üzerinden
   * AYNEN bağlanıyor (ayrı bir ölüm yolu değil, sadece farklı bir tetikleyici —
   * Faz IX'un `old_age` deseniyle aynı ilke).
   */
  private static readonly METEOR_KILL_FRACTION = 0.6; // etkilenen bölgedeki canlıların/besinlerin ~%60'ı

  public applyMeteorImpact(x: number, y: number, radius: number): { creaturesKilled: number; nutrientsDestroyed: number } {
    let creaturesKilled = 0;
    for (const c of this.creatures) {
      if (!c.alive) continue;
      const dist = Math.hypot(c.x2 - x, c.y2 - y);
      if (dist <= radius && Math.random() < Ecosystem.METEOR_KILL_FRACTION) {
        this.killCreature(c, "meteor");
        creaturesKilled++;
      }
    }

    let nutrientsDestroyed = 0;
    for (const pool of [this.nutrients, this.landNutrients]) {
      const toRemove: Nutrient[] = [];
      for (const n of pool) {
        const dist = Math.hypot(n.x2 - x, n.y2 - y);
        if (dist <= radius && Math.random() < Ecosystem.METEOR_KILL_FRACTION) toRemove.push(n);
      }
      for (const n of toRemove) {
        this.removeNutrient(pool, n);
        nutrientsDestroyed++;
      }
    }

    if (this.creatures.some((c) => !c.alive)) {
      this.creatures = this.creatures.filter((c) => c.alive);
    }

    return { creaturesKilled, nutrientsDestroyed };
  }

  /** Faz IX — test/doğrulama amaçlı: yaşlılıktan ölen toplam birey sayısı. */
  public getOldAgeDeathCount(): number {
    return this.oldAgeDeathCount;
  }

  /** Faz VI — Ölüm görünürlüğü (TASKS.md): canlı sessizce kaybolmak yerine geride bir
   *  ceset/iskelet kalıntısı bırakır (bkz. `Corpse`). Ayrıca %55 ihtimalle (her cesede
   *  bir bakteri gerekmiyor, TASKS.md kapsamı "basit tutulabilir" diyor) hemen bir
   *  ayrıştırıcı bakteri de belirebilir — ceset zaten kendi ömrü boyunca da solar,
   *  bakteri sadece süreci hızlandıran opsiyonel bir detay. */
  private static readonly DECOMPOSER_SPAWN_CHANCE = 0.55;

  /** Faz XI — Ayrıştırıcı-besin katkısı (bkz. `updateCorpsesAndDecomposers`): %40
   *  ihtimalle, ilgili havuz taban kapasitesinin altındaysa, ayrıştırıcının son
   *  konumuna bir nutrient ekler. Kapasite kontrolü kasıtlı olarak SADE (sabit taban
   *  cap, `computeHungerCapacityBoost` YOK) — bu küçük, opsiyonel bir katkı, Faz
   *  XIII'in zorlukla kurduğu açlık/kapasite dengesine karışmamalı. */
  private static readonly DECOMPOSER_NUTRIENT_CONTRIBUTION_CHANCE = 0.4;
  // TEST-ONLY (tester, bağımsız doğrulama için, salt-okunur sayaç — Faz V/VI'daki
  // __getCorpseCount vb. emsalle tutarlı, kullanıcı arayüzüne etkisi yok): mekanizmanın
  // gerçekten tetiklendiğini/cap'e saygı duyduğunu ölçmek için üç ayrı sayaç.
  private decomposerContributionsAdded = 0;
  private decomposerContributionsSkippedChance = 0;
  private decomposerContributionsSkippedCap = 0;

  private spawnDecomposerNutrientContribution(x: number, y: number): void {
    if (Math.random() >= Ecosystem.DECOMPOSER_NUTRIENT_CONTRIBUTION_CHANCE) {
      this.decomposerContributionsSkippedChance++;
      return;
    }
    const onLand = !this.world.isWater(x, y);
    if (onLand) {
      if (this.landNutrients.length >= BASE_MAX_LAND_NUTRIENTS) {
        this.decomposerContributionsSkippedCap++;
        return;
      }
      const nutrient = new Nutrient(x, y);
      this.stage.addChild(nutrient);
      this.landNutrients.push(nutrient);
    } else {
      if (this.nutrients.length >= BASE_MAX_NUTRIENTS) {
        this.decomposerContributionsSkippedCap++;
        return;
      }
      const nutrient = new Nutrient(x, y);
      this.stage.addChild(nutrient);
      this.nutrients.push(nutrient);
    }
    this.decomposerContributionsAdded++;
  }

  public getDecomposerContributionStats(): {
    added: number;
    skippedChance: number;
    skippedCap: number;
  } {
    return {
      added: this.decomposerContributionsAdded,
      skippedChance: this.decomposerContributionsSkippedChance,
      skippedCap: this.decomposerContributionsSkippedCap,
    };
  }

  private spawnCorpse(creature: Creature): void {
    const corpse = new Corpse(creature.x2, creature.y2, creature.genome.radius);
    this.stage.addChild(corpse);
    this.corpses.push(corpse);

    if (Math.random() < Ecosystem.DECOMPOSER_SPAWN_CHANCE) {
      const decomposer = new Decomposer(creature.x2, creature.y2, creature.genome.radius);
      this.stage.addChild(decomposer);
      this.decomposers.push(decomposer);
      this.decomposerTargets.set(decomposer, corpse);
    }
  }

  /** Faz VI — ceset/ayrıştırıcı yaşam döngüsünü ilerletir: bakteriler tüketimlerini
   *  tamamlayınca bağlı oldukları cesedi de hemen tüketilmiş sayar (erken kaybolma);
   *  cesetler kendi ömürleri (`Corpse.LIFETIME`) dolunca da bağımsız olarak solar. */
  private updateCorpsesAndDecomposers(dt: number): void {
    if (this.decomposers.length > 0) {
      for (const decomposer of this.decomposers) {
        decomposer.update(dt);
        const corpse = this.decomposerTargets.get(decomposer);
        if (corpse && !corpse.finished) {
          corpse.beingConsumed = true;
        }
      }
      const stillActive = this.decomposers.filter((d) => !d.finished);
      if (stillActive.length !== this.decomposers.length) {
        for (const d of this.decomposers) {
          if (d.finished) {
            // Faz XI aday havuzu — "ayrıştırıcıların tükettiği cesetlerden besin
            // havuzuna küçük katkı" (Faz VI'da kasıtlı olarak kapsam dışı bırakılmıştı).
            // Basit tutuldu: tüketim bitince %40 ihtimalle (her seferinde değil,
            // "küçük katkı" olsun diye), ayrıştırıcının konumuna göre doğru havuza
            // (su/kara) TEK bir nutrient eklenir — mevcut spawn zamanlayıcılarına
            // dokunmadan, doğrudan. Fragile popülasyon dengesini (Faz XIII'te zorlukla
            // kurulmuştu) bozmamak için: (1) dinamik/açlık-genişletilmiş cap yerine
            // SABİT taban cap'e (`BASE_MAX_NUTRIENTS`/`BASE_MAX_LAND_NUTRIENTS`) göre
            // kontrol edilir — havuz zaten doluysa katkı sessizce atlanır, asla cap'i
            // aşmaz; (2) mevcut `updateNutrientSpawning`/`updateLandNutrientSpawning`
            // hızını/zamanlayıcısını DEĞİŞTİRMEZ, bağımsız bir ek.
            this.spawnDecomposerNutrientContribution(d.x, d.y);
            this.stage.removeChild(d);
            d.destroy({ children: true });
          }
        }
      }
      this.decomposers = stillActive;
    }

    if (this.corpses.length > 0) {
      for (const corpse of this.corpses) {
        corpse.update(dt);
      }
      const stillActive = this.corpses.filter((c) => !c.finished);
      if (stillActive.length !== this.corpses.length) {
        for (const c of this.corpses) {
          if (c.finished) {
            this.stage.removeChild(c);
            c.destroy({ children: true });
          }
        }
      }
      this.corpses = stillActive;
    }
  }

  /** Faz VI — Seçim halkası desteği: seçili bir canlı öldüyse `main.ts`'in seçimi
   *  temizleyebilmesi için basit bir sorgu (canlı listesinde artık yok = öldü). */
  public isCreatureAlive(creature: Creature): boolean {
    return creature.alive && this.creatures.includes(creature);
  }

  // --- Faz III: Neden/gerekçe şeffaflığı ---

  /** Her organ tipini kaç canlının taşıdığını sayar (basit histogram — TASKS.md
   *  "Veri toplama": popülasyon genelinde kaç bireyin o organı taşıdığını izle). */
  public getOrganPrevalence(): Record<OrganType, number> {
    const counts = Object.fromEntries(ALL_ORGAN_TYPES.map((t) => [t, 0])) as Record<OrganType, number>;
    for (const c of this.creatures) {
      if (!c.alive) continue;
      for (const organ of c.genome.organs) {
        counts[organ.type]++;
      }
    }
    return counts;
  }

  /** Faz XI — organ trend oku: `checkPrevalenceMilestones`'ın hesapladığı ANLIK
   *  oranı kayan pencereye ekler (en eski örnek pencere dolunca atılır). */
  private recordPrevalenceSample(type: OrganType, fraction: number): void {
    const history = this.prevalenceHistory.get(type) ?? [];
    history.push(fraction);
    if (history.length > PREVALENCE_TREND_SAMPLE_COUNT) history.shift();
    this.prevalenceHistory.set(type, history);
  }

  /** Faz XI — organ trend oku (TASKS.md, PM onaylı, "uydurma yok" ilkesi): her organ
   *  tipi için pencerenin ilk yarısı/ikinci yarısı ortalamasını karşılaştırıp basit
   *  bir yön döndürür. Pencere henüz dolmadıysa (`PREVALENCE_TREND_SAMPLE_COUNT`'tan
   *  az örnek) `insufficient-data` döner — sahte bir "stabil" iddiası YOK. */
  public getOrganPrevalenceTrend(): Record<OrganType, OrganPrevalenceTrend> {
    const result = Object.fromEntries(
      ALL_ORGAN_TYPES.map((t) => [t, "insufficient-data" as OrganPrevalenceTrend])
    ) as Record<OrganType, OrganPrevalenceTrend>;

    for (const type of ALL_ORGAN_TYPES) {
      const history = this.prevalenceHistory.get(type);
      if (!history || history.length < PREVALENCE_TREND_SAMPLE_COUNT) continue;

      const half = Math.floor(history.length / 2);
      const firstHalf = history.slice(0, half);
      const secondHalf = history.slice(half);
      const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
      const delta = avg(secondHalf) - avg(firstHalf);

      if (Math.abs(delta) < PREVALENCE_TREND_STABLE_THRESHOLD) {
        result[type] = "stable";
      } else {
        result[type] = delta > 0 ? "up" : "down";
      }
    }
    return result;
  }

  /** Bekleyen (henüz Hud'a basılmamış) evrim olaylarını döndürür ve iç kuyruğu
   *  boşaltır. Ecosystem, Hud'a doğrudan bağımlı değil — `main.ts` bunu periyodik
   *  çağırıp `Hud.pushEvent` ile ekrana basıyor (ayrım: simülasyon mantığı UI'dan
   *  bağımsız kalsın). */
  public pollEvolutionEvents(): EvolutionEvent[] {
    if (this.pendingEvolutionEvents.length === 0) return [];
    const events = this.pendingEvolutionEvents.slice();
    this.pendingEvolutionEvents.length = 0;
    return events;
  }

  /** Faz III olayını hem bekleyen kuyruğa hem de Gemini'ye (Faz V) gönderilecek "son
   *  olaylar" geçmişine ekler — tek giriş noktası, iki ayrı push çağrısı yerine. */
  private pushEvolutionEvent(text: string): void {
    this.pendingEvolutionEvents.push({ simTime: this.simulationTime, text });
    this.recentEventTexts.push(text);
    if (this.recentEventTexts.length > Ecosystem.MAX_RECENT_EVENT_TEXTS) {
      this.recentEventTexts.shift();
    }
  }

  /** Faz V — Gemini'ye ham veri olarak gönderilecek en son eşik-tabanlı olay metinleri
   *  (en fazla `MAX_RECENT_EVENT_TEXTS` adet, en eskiden en yeniye). */
  public getRecentEventTexts(): readonly string[] {
    return this.recentEventTexts;
  }

  /** Faz V — popülasyon genelinde ortalama enerji oranı (energy/maxEnergy), 0 canlıysa 0. */
  public getAverageEnergyRatio(): number {
    const alive = this.creatures.filter((c) => c.alive);
    if (alive.length === 0) return 0;
    const sum = alive.reduce((acc, c) => acc + c.energy / c.maxEnergy, 0);
    return sum / alive.length;
  }

  private updateEvolutionEvents(dt: number): void {
    this.evolutionEventCheckTimer -= dt;
    if (this.evolutionEventCheckTimer > 0) return;
    this.evolutionEventCheckTimer = EVOLUTION_EVENT_CHECK_INTERVAL;

    const alive = this.creatures.filter((c) => c.alive);
    const population = alive.length;
    this.checkExtinctions(alive, population);
    if (population === 0) return;

    this.checkPrevalenceMilestones(alive, population);
    this.checkEnergyAdvantage(alive);
    this.checkFirstCarnivore(alive);
  }

  /** Faz IX — Diyet sistemi şeffaflığı (TASKS.md madde 3/5): popülasyonda İLK kez
   *  bir etçil ortaya çıktığında (mutasyonla, `mutateDietGene`) tek seferlik, gerçek
   *  bir olay düşer — kullanıcının "hangi canlının ne olduğu anlaşılmıyor" geri
   *  bildirimine ek bir şeffaflık katmanı. Faz III'ün dürüstlük ilkesiyle aynı: sadece
   *  gerçekten gözlemlenen bir duruma (carrierCount>0) dayanıyor, tekrar tetiklenmiyor. */
  private firedFirstCarnivore = false;
  private checkFirstCarnivore(alive: Creature[]): void {
    if (this.firedFirstCarnivore) return;
    const hasCarnivore = alive.some((c) => c.genome.diet === "carnivore");
    if (!hasCarnivore) return;
    this.firedFirstCarnivore = true;
    const t = Math.round(this.simulationTime);
    this.pushEvolutionEvent(`t=${t}s — 🍽️ Popülasyonda ilk etçil birey ortaya çıktı (mutasyonla diyet değişimi)`);
  }

  /** Faz VI — Soy tükenmesi takibi (TASKS.md): bir organ tipini taşıyan HİÇ birey
   *  kalmadığında (daha önce popülasyonda gerçekten VARDI, şimdi 0'a düştü) event
   *  log'a gerçek bir tükenme olayı düşer. Faz III'ün dürüstlük ilkesiyle aynı: bu
   *  simülasyonda hiç ortaya çıkmamış bir organ için asla sahte bir "tükendi" olayı
   *  üretilmez — `everObservedOrganTypes` gerçekten en az bir taşıyıcı gözlemlenmiş
   *  organları işaretler, sadece bu sette olan VE şimdi sayacı 0 olan tipler tetikler.
   *  Popülasyon 0'a düşmüş olsa bile (tüm türler aynı anda "tükenmiş" sayılır) bu
   *  gerçek bir veri durumu olduğundan (uydurma değil) kontrol edilmeye devam eder. */
  private checkExtinctions(alive: Creature[], population: number): void {
    void population;
    const carrierCounts = Object.fromEntries(ALL_ORGAN_TYPES.map((t) => [t, 0])) as Record<OrganType, number>;
    for (const c of alive) {
      for (const organ of c.genome.organs) {
        carrierCounts[organ.type]++;
      }
    }

    for (const type of ALL_ORGAN_TYPES) {
      const count = carrierCounts[type];
      if (count > 0) {
        this.everObservedOrganTypes.add(type);
        continue;
      }
      if (!this.everObservedOrganTypes.has(type)) continue; // hiç var olmadı — uydurma olay yok
      if (this.firedExtinction.has(type)) continue;

      this.firedExtinction.add(type);
      const label = ORGAN_DEFINITIONS[type].label;
      const t = Math.round(this.simulationTime);
      this.pushEvolutionEvent(`t=${t}s — 🦴 ${label} organı popülasyondan tamamen kayboldu (soy tükendi)`);
    }
  }

  /** TASKS.md örneği: "t=142s — Bacak taşıyan bireylerin oranı %20'yi geçti (karaya
   *  çıkış yaygınlaşıyor)". Sadece popülasyon yeterince büyükse (`MIN_POPULATION_
   *  FOR_PREVALENCE`) ve her eşik en fazla bir kez tetiklenir. */
  private checkPrevalenceMilestones(alive: Creature[], population: number): void {
    if (population < MIN_POPULATION_FOR_PREVALENCE) return;

    for (const type of ALL_ORGAN_TYPES) {
      let carriers = 0;
      for (const c of alive) {
        if (c.genome.organs.some((o) => o.type === type)) carriers++;
      }
      const fraction = carriers / population;
      this.recordPrevalenceSample(type, fraction);
      const fired = this.firedPrevalenceMilestones.get(type) ?? new Set<number>();

      for (const milestone of PREVALENCE_MILESTONES) {
        if (fraction >= milestone && !fired.has(milestone)) {
          fired.add(milestone);
          const label = ORGAN_DEFINITIONS[type].label;
          const pct = Math.round(milestone * 100);
          const t = Math.round(this.simulationTime);
          this.pushEvolutionEvent(
            `t=${t}s — ${label} taşıyan bireylerin oranı %${pct}'i geçti (${this.prevalenceContext(type)})`
          );
        }
      }
      this.firedPrevalenceMilestones.set(type, fired);
    }
  }

  /** Yaygınlık olayı için kısa, organ tipine özgü bir bağlam ifadesi (uydurma değil,
   *  organın bilinen mekanik etkisine dayalı sabit bir açıklama — TASKS.md
   *  "karaya çıkış yaygınlaşıyor" tarzı örneklerle tutarlı). */
  private prevalenceContext(type: OrganType): string {
    switch (type) {
      case "leg":
        return "karaya çıkış yaygınlaşıyor";
      case "fin":
        return "suda hız avantajı yayılıyor";
      case "wing":
        return "uçuşa yönelik uyarlanma yayılıyor";
      case "tentacle":
        return "ilkel hareket avantajı yayılıyor";
      case "eyespot":
        return "ilkel ışık algısı yayılıyor";
      case "eye":
        return "gelişmiş algı avantajı yayılıyor";
      case "mouth":
        return "beslenme verimliliği avantajı yayılıyor";
      case "shell":
        return "zırhlı savunma yayılıyor";
      case "camouflage":
        return "kamuflaj adaptasyonu yayılıyor";
      case "spike":
        return "caydırıcı savunma yayılıyor";
      default:
        return "popülasyonda yayılıyor";
    }
  }

  /** TASKS.md örneği: "t=310s — Göz taşıyan bireylerin ortalama enerjisi,
   *  taşımayanlardan %22 daha yüksek — algı avantajı gözlemleniyor". DÜRÜSTLÜK:
   *  her iki grupta da en az `MIN_GROUP_SIZE_FOR_ENERGY_COMPARISON` birey yoksa
   *  hiçbir karşılaştırma yapılmaz/yayınlanmaz. Enerji oranı (energy/maxEnergy)
   *  kullanılır ki farklı vücut boyutları karşılaştırmayı bozmasın. */
  private checkEnergyAdvantage(alive: Creature[]): void {
    for (const type of ALL_ORGAN_TYPES) {
      if (this.firedEnergyAdvantage.has(type)) continue;

      let carrierSum = 0;
      let carrierCount = 0;
      let nonCarrierSum = 0;
      let nonCarrierCount = 0;

      for (const c of alive) {
        const ratio = c.energy / c.maxEnergy;
        if (c.genome.organs.some((o) => o.type === type)) {
          carrierSum += ratio;
          carrierCount++;
        } else {
          nonCarrierSum += ratio;
          nonCarrierCount++;
        }
      }

      if (carrierCount < MIN_GROUP_SIZE_FOR_ENERGY_COMPARISON) continue;
      if (nonCarrierCount < MIN_GROUP_SIZE_FOR_ENERGY_COMPARISON) continue;

      const carrierAvg = carrierSum / carrierCount;
      const nonCarrierAvg = nonCarrierSum / nonCarrierCount;
      if (nonCarrierAvg <= 0) continue;

      const relativeDiff = (carrierAvg - nonCarrierAvg) / nonCarrierAvg;
      if (Math.abs(relativeDiff) < ENERGY_ADVANTAGE_THRESHOLD) continue;

      this.firedEnergyAdvantage.add(type);
      const label = ORGAN_DEFINITIONS[type].label;
      const pct = Math.round(Math.abs(relativeDiff) * 100);
      const t = Math.round(this.simulationTime);
      const direction = relativeDiff > 0 ? "daha yüksek" : "daha düşük";
      const context = relativeDiff > 0 ? this.advantageContext(type) : this.disadvantageContext(type);
      this.pushEvolutionEvent(
        `t=${t}s — ${label} taşıyan bireylerin ortalama enerjisi, taşımayanlardan %${pct} ${direction} — ${context}`
      );
    }
  }

  private advantageContext(type: OrganType): string {
    switch (type) {
      case "eye":
      case "eyespot":
        return "algı avantajı gözlemleniyor";
      case "mouth":
        return "beslenme avantajı gözlemleniyor";
      case "leg":
        return "karadaki rakipsiz besin avantajı gözlemleniyor";
      case "fin":
      case "tentacle":
      case "wing":
        return "hareket/erişim avantajı gözlemleniyor";
      case "shell":
      case "camouflage":
      case "spike":
        return "hayatta kalma avantajı gözlemleniyor";
      default:
        return "bir avantaj gözlemleniyor";
    }
  }

  private disadvantageContext(type: OrganType): string {
    switch (type) {
      case "shell":
        return "zırhın enerji maliyeti avantajını aşıyor olabilir";
      default:
        return "bu organın enerji maliyeti bir dezavantaj olarak görünüyor";
    }
  }

  /** Faz IX — Diyet sistemi (TASKS.md madde 3, madde 7 Gemini verisi için de
   *  kullanışlı): popülasyondaki otçul/etçil sayısı. */
  /** Faz XVII Madde 2 TEST-ONLY: `packHuntEscapeReduction`'ı doğrudan (istatistiksel
   *  deneme yapmadan) ölçmek için — mevcut `__getCorpseCount` vb. salt-okunur test
   *  hook'larıyla aynı gelenek. */
  public __debugGetPackHuntEscapeReduction(id: number): number | null {
    const target = this.creatures.find((c) => c.genome.id === id);
    if (!target) return null;
    return this.packHuntEscapeReduction(target);
  }

  public getDietCounts(): { herbivore: number; carnivore: number } {
    let herbivore = 0;
    let carnivore = 0;
    for (const c of this.creatures) {
      if (!c.alive) continue;
      if (c.genome.diet === "carnivore") carnivore++;
      else herbivore++;
    }
    return { herbivore, carnivore };
  }

  // --- İstatistikler ---

  public getStats(): {
    population: number;
    maxGeneration: number;
    historicalMaxGeneration: number;
    totalBirths: number;
  } {
    let maxGeneration = 0;
    let population = 0;
    for (const c of this.creatures) {
      if (!c.alive) continue;
      population++;
      if (c.genome.generation > maxGeneration) maxGeneration = c.genome.generation;
    }
    return {
      population,
      maxGeneration,
      historicalMaxGeneration: this.historicalMaxGeneration,
      totalBirths: this.totalBirths,
    };
  }
}
