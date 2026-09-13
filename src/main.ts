import { Application, Container, FederatedPointerEvent, Graphics } from "pixi.js";
import { World, MAP_WIDTH, MAP_HEIGHT, generateMapSeed } from "./world";
import { Ecosystem } from "./ecosystem";
import { Creature } from "./creature";
import { Hud } from "./hud";
import { SpeedControl } from "./speedcontrol";
import { RestartButton } from "./restartbutton";
import { LineageTree } from "./lineagetree";
import { loadSaveData, writeSaveData, clearSaveData, SAVE_VERSION } from "./savegame";
import { exportSaveDataToFile, importSaveDataFromFile } from "./exportimport";
import { WorldEventManager } from "./worldevents";
import { fetchGeminiInsight, fetchLineageAnalysis, GeminiWeightSuggestion, GeminiBehaviorSuggestion } from "./geminiinsight";
import { applyGeminiBehaviorSuggestion, getBehaviorAdjustmentOffsets } from "./ecosystem";
import {
  applyOrganWeightSuggestion,
  getOrganWeightMultipliers,
  ALL_ORGAN_TYPES,
  ORGAN_DEFINITIONS,
  OrganType,
  setPlanetForbiddenOrgans,
} from "./organs";
import { applySexualStrategyWeightSuggestion, getSexualStrategyMultiplier } from "./genome";
import { generatePlanetProfile, PlanetProfile } from "./planetformation";

/**
 * Faz I (v3) — Minimal iskelet: düz harita + mikroorganizmalar + sade dashboard.
 * v2'nin dairesel gezegen kamerası, D3 grafikleri, sekme sistemi ve gündüz-gece/mevsim
 * döngüsü TAMAMEN kaldırıldı (bu fazın kapsamı değil, TASKS.md v3 — Faz I).
 */

const INITIAL_CREATURE_COUNT = 24;
const HUD_UPDATE_INTERVAL = 0.25;
const MAX_SIM_SUBSTEP = 1 / 30;
// Faz XV — Performans regresyonu: eskiden 0.5s idi. Bir render karesi yavaşladığında
// (`ticker.deltaMS` büyüdüğünde) bu değer, O KAREDE kaç `ecosystem.update()` alt-adımı
// çalıştırılacağını belirliyordu — 0.5s / (1/30) = 15 alt-adıma kadar. Popülasyon
// tavana (140) yakınken `ecosystem.update()` başına maliyet (O(n²) tehdit/av taraması,
// bkz. `findNearestThreat`/`findNearestPrey`) belirgin hale gelince, bir karedeki 15
// alt-adım kendini besleyen bir "ölüm sarmalı" yaratıyordu: yavaş kare → daha fazla
// alt-adım → daha yavaş kare → ... (asla toparlanmıyordu, tam bu davranış 9 dakikalık
// tester koşusunda gözlemlendi). Küçültmek simülasyon-zamanı doğruluğundan biraz ödün
// verir (uzun bir yavaşlama anında sim biraz "geri kalabilir") ama kare hızının kendi
// kendini yiyip bitirmesini engeller — 4x hızda bile normal koşullarda tek karede
// yalnızca birkaç alt-adım yeterli, 0.5s'lik bir tampon hiç gerekmiyordu.
const MAX_SIM_STEP_PER_FRAME = 0.12;
const AUTOSAVE_INTERVAL_SECONDS = 12;
/** Faz V — Canlı inceleme paneli: tıklamanın bir canlıyı "vurduğu" sayılması için
 *  world-koordinatındaki maksimum mesafe (küçük mikroorganizmalar için tıklama
 *  toleransı gövde yarıçapından geniş tutuluyor, aksi halde neredeyse imkansız
 *  hedeflenir). */
const CREATURE_CLICK_TOLERANCE = 16;
/** Faz V — Gemini API ile derin analiz (TASKS.md): "periyodik olarak (örn. her
 *  60-90 saniyede bir, çok sık çağırma)". Faz VIII ek düzeltme (2026-09-02):
 *  75s'den 120s'ye çıkarıldı — model günlük ücretsiz kotasını (bkz. vite.config.ts)
 *  gereksiz hızlı tüketmesin diye ekstra bir tampon (soy analizi butonu da AYNI
 *  kotayı paylaşıyor, periyodik çağrı ne kadar seyrekse butona o kadar pay kalır). */
const GEMINI_INSIGHT_INTERVAL_SECONDS = 120;

async function main(): Promise<void> {
  const scenePanel = document.getElementById("scene-panel");
  const mount = document.getElementById("app");
  if (!scenePanel || !mount) throw new Error("#scene-panel/#app bulunamadı");

  const app = new Application();
  await app.init({
    background: "#0a0c10",
    resizeTo: scenePanel,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });

  mount.appendChild(app.canvas);

  // --- Dünya konteyneri: sabit boyutlu düz harita, kamera onu sahne panelinin
  // ortasına (veya sığdığı ölçekte) yerleştirir. ---
  const world = new Container();
  app.stage.addChild(world);

  // Faz VIII — Rastgele harita (TASKS.md): kaydedilmiş bir durum varsa o kaydın
  // haritasını (aynı seed) yeniden üret ki canlı konumları anlamlı kalsın; yoksa
  // (yeni simülasyon) her sayfa yüklemesinde FARKLI bir seed üretilir.
  // Not: "Yeniden Başlat" butonu (aşağıda) haritayı DEĞİŞTİRMİYOR, sadece canlı
  // popülasyonunu sıfırlıyor — TASKS.md gereksinimi ("her yeni simülasyon
  // başlangıcında... farklı bir su/kara deseni") öncelikle sayfa yüklemesini
  // kastediyor; harita `Ecosystem`/kamera/event-handler durumuna sıkı bağlı
  // (`readonly world` üyesi) olduğundan restart'ta yeniden üretmek gereksiz risk
  // taşıyor, kapsam dışı bırakıldı.
  const savedGame = loadSaveData();
  const worldMap = new World(savedGame ? savedGame.mapSeed : generateMapSeed());
  world.addChild(worldMap);

  // Faz XVI Madde 2 (TASKS.md) — Gezegen oluşum profili: `worldMap.seed`/
  // `worldMap.waterFraction`'dan TÜRETİLEN (deterministik) bir özet — aynı seed her
  // zaman aynı profili üretir (bkz. `planetformation.ts`). Hem yeni hem yüklenen bir
  // oyun için hesaplanıyor (ucuz, saf bir fonksiyon) ama sadece YENİ bir simülasyonda
  // (aşağıda) kullanıcıya gösteriliyor — yüklenen bir oyunda gezegen zaten "oluşmuş"
  // sayılıyor, ekran tekrar gösterilmiyor (TASKS.md'nin "minimal" ilkesiyle tutarlı:
  // aynı gezegeni her sayfa yenilemesinde tekrar tekrar göstermek gürültü olurdu).
  const planetProfile = generatePlanetProfile(worldMap.seed, worldMap.waterFraction);

  // Faz XVI Madde 3 (TASKS.md) — Gezegene özgü organlar: bu gezegenin profiline göre
  // HANGİ organların mümkün olduğunu bildiriyoruz (organ havuzunun kendisi/mekanik
  // etkileri DEĞİŞMİYOR — sadece `pickRandomOrganType`'ın seçim havuzu daralıyor,
  // bkz. `organs.ts` `setPlanetForbiddenOrgans`). Bir kayıt yüklenirken de AYNI mantık
  // çalışıyor (mapSeed geri kullanıldığı için `planetProfile` otomatik tutarlı kalır —
  // yüklenen bir oyunda da azot/kükürt durumuna göre doğru organlar mümkün/yasak olur).
  const planetForbiddenOrgans: OrganType[] = [];
  if (planetProfile.nitrogenLevel === "low") planetForbiddenOrgans.push("nitrogen_sac");
  if (!planetProfile.hasSulfurRichSubstance) planetForbiddenOrgans.push("sulfur_vent_organ");
  setPlanetForbiddenOrgans(planetForbiddenOrgans);

  const ecosystem = new Ecosystem(worldMap, world);

  // --- Faz VIII — Rastgele dünya olayları (TASKS.md): meteor/iklim/rüzgar/deprem,
  // nadir tetiklenen, gerçek mekanik etkisi olan olaylar. Görsel flaşlar `world`
  // konteynerine (haritanın hemen üstüne) ekleniyor. ---
  const worldEvents = new WorldEventManager(worldMap, ecosystem, world);

  // --- Faz VI — Seçim halkası (TASKS.md): seçili canlının etrafında beliren, onu
  // takip eden ince bir halka. Ayrı bir Pixi Graphics katmanı olarak dünya
  // konteynerine ekleniyor (canlıların ÜSTÜNDE çizilsin diye en son eklendi),
  // her karede seçili canlının o anki (x2,y2) konumuna yeniden konumlandırılıyor. */
  const selectionRing = new Graphics();
  world.addChild(selectionRing);
  let selectedCreature: Creature | null = null;

  function setSelection(creature: Creature | null): void {
    selectedCreature = creature;
    selectionRing.clear();
    if (!creature) return;
    const r = creature.genome.radius * 1.9;
    selectionRing.circle(0, 0, r).stroke({ width: 1.5, color: 0xf0c04f, alpha: 0.9 });
  }

  if (savedGame) {
    ecosystem.loadFromSave(savedGame);
  }
  // Faz XVI Madde 2 — yeni bir simülasyonda (`!savedGame`) başlangıç popülasyonu HEMEN
  // spawn edilmiyor — kullanıcı aşağıdaki gezegen oluşum ekranında "Simülasyonu
  // Başlat"a basınca (`startNewSimulation`) spawn edilecek. Yüklenen bir oyunda bu
  // ekran hiç gösterilmiyor, `loadFromSave` yukarıda zaten popülasyonu geri getirdi.

  const hud = new Hud();

  // --- Faz XII — Manuel kontroller (TASKS.md): besin üretim oranı çarpanı, manuel
  // doğa olayı tetikleme, doğa olaylarını durdurma toggle'ı. Gerçek mantık zaten
  // Faz IV/VIII'de var (`Ecosystem.setUserNutrientMultiplier`,
  // `WorldEventManager.forceTrigger`/`setAutoEventsEnabled`) — burada sadece HUD'un
  // DOM/etkileşim katmanına bağlanıyor. ---
  hud.setManualControlsHandlers({
    onNutrientRateChange: (multiplier) => ecosystem.setUserNutrientMultiplier(multiplier),
    onTriggerRandomEvent: () => {
      const kinds: ("meteor" | "climate" | "wind" | "quake")[] = ["meteor", "climate", "wind", "quake"];
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      worldEvents.forceTrigger(kind, ecosystem.getSimulationTime());
    },
    onTriggerSpecificEvent: (kind) => worldEvents.forceTrigger(kind, ecosystem.getSimulationTime()),
    onToggleWorldEvents: (enabled) => worldEvents.setAutoEventsEnabled(enabled),
  });

  // --- Faz XI — Kaydet dosyasını dışa/içe aktarma (TASKS.md): mevcut localStorage
  // otomatik kayıt/yükleme sistemine (Faz VI/VIII, yukarıdaki `loadSaveData`/
  // `writeSaveData`) DOKUNULMUYOR — bu tamamen ek, isteğe bağlı bir özellik. Dışa
  // aktarma `Ecosystem.serialize()`'ı (otomatik kayıtla AYNI şekil) bir JSON dosyası
  // olarak indirir; içe aktarma AYNI `isValidSaveData` doğrulamasını (savegame.ts)
  // yeniden kullanır — geçersiz/bozuk bir dosya sessizce reddedilir (çökme yok) ama
  // kullanıcı aktif bir eylem yaptığı için (localStorage'ın sessiz reddinin aksine)
  // event log'a görünür kısa bir hata mesajı düşer. ---
  const exportBtn = document.getElementById("export-save-btn");
  const importBtn = document.getElementById("import-save-btn");
  const importInput = document.getElementById("import-save-input") as HTMLInputElement | null;
  if (!exportBtn || !importBtn || !importInput) {
    throw new Error("#export-save-btn/#import-save-btn/#import-save-input bulunamadı");
  }

  exportBtn.addEventListener("click", () => {
    const snapshot = ecosystem.serialize();
    exportSaveDataToFile({ version: SAVE_VERSION, ...snapshot });
    hud.pushEvent("💾 Kayıt dosyası dışa aktarıldı.");
  });

  importBtn.addEventListener("click", () => {
    importInput.click();
  });

  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0] ?? null;
    // Aynı dosyayı arka arkaya seçebilmek için input'u hemen sıfırla (`change` olayı
    // aksi halde ikinci seçimde tetiklenmez).
    importInput.value = "";
    if (!file) return;
    const data = await importSaveDataFromFile(file);
    if (!data) {
      hud.pushEvent("⚠️ Geçersiz kayıt dosyası — içe aktarma reddedildi.");
      return;
    }
    // Faz XI bug düzeltmesi (2026-09-10, tester 6f'nin raporu): burada doğrudan
    // `ecosystem.loadFromSave(data)` çağırmak İKİ ayrı hataya yol açıyordu — (1)
    // `simulationStarted` bayrağı hiç set edilmediğinden, kullanıcı ardından
    // "Simülasyonu Başlat"a basarsa `startNewSimulation` içe aktarılan popülasyonun
    // ÜSTÜNE 24 yeni rastgele canlı ekliyordu (bkz. aşağıdaki `startNewSimulation`);
    // (2) `worldMap` sayfa yüklemesinde ZATEN rastgele bir seed'le kurulmuş oluyor
    // (satır ~90) ve içe aktarma bunu kaydın `mapSeed`'iyle YENİDEN KURMUYORDU —
    // `worldMap` `Ecosystem`/kamera/event-handler'lara sıkı bağlı (`readonly world`
    // referansı `Ecosystem` içinde) olduğundan canlı bir yeniden kurma riskli/
    // invaziftir (bkz. `World`'ün `readonly grid`/`elevationGrid`/`seed` alanları).
    // Bunun yerine, sayfa YÜKLEMESİNDE ZATEN doğru çalışan aynı yolu (satır ~89-90,
    // `loadSaveData()` + `new World(savedGame.mapSeed)`) yeniden kullanıyoruz: kaydı
    // localStorage'a yazıp sayfayı yeniliyoruz — `worldMap` SIFIRDAN, doğru seed'le
    // kurulur, `simulationStarted` doğru başlangıç değeriyle (`savedGame !== null`)
    // hesaplanır, spawnInitialCreatures hiç çağrılmaz. Mevcut, kanıtlanmış koddan
    // YENİ bir harita-yeniden-kurma yolu YOK.
    //
    // KRİTİK ek düzeltme (canlı testte bulundu, ilk denemem — ticker'ı durdurmak —
    // YETERSİZDİ): simülasyon ZATEN çalışıyorsa (`simulationStarted`), `location.
    // reload()` `beforeunload` olayını tetikliyor ve o handler (yukarıda, satır
    // ~806) KENDİ `writeSaveData` çağrısıyla mevcut (henüz içe aktarılmamış) canlı
    // durumu YENİDEN yazıp benim az önce yazdığım içe aktarılan veriyi SESSİZCE
    // EZİYORDU — canlı testte tam olarak bu gözlemlendi (reload sonrası popülasyon
    // hep eski/kendi durumuydu, A'dan içe aktarılan hiç görünmüyordu).
    // `app.ticker.stop()` da (frame-loop otomatik kaydını önlemek için, hâlâ zararsız/
    // doğru bir önlem) eklendi ama asıl kök neden `beforeunload`'dı. Düzeltme:
    // `skipBeforeUnloadAutosave` bayrağını `beforeunload`'dan ÖNCE set ediyoruz.
    app.ticker.stop();
    skipBeforeUnloadAutosave = true;
    writeSaveData(data);
    location.reload();
  });

  // Faz II doğrulama amaçlı geçici debug hook'u — Tester/Coder headless doğrulaması
  // için (organ envanteri, kara geçişi kontrolü). Kullanıcı arayüzüne etkisi yok.
  (window as unknown as { __debug?: unknown }).__debug = {
    getCreatureSummaries: () =>
      ecosystem.getCreatures().map((c) => ({
        id: c.genome.id,
        organs: c.genome.organs.map((o) => ({ type: o.type, power: Number(o.power.toFixed(2)) })),
        onLand: !worldMap.isWater(c.x2, c.y2),
        canWalkOnLand: c.canWalkOnLand(),
        generation: c.genome.generation,
        energy: Number(c.energy.toFixed(1)),
        maxEnergy: Number(c.maxEnergy.toFixed(1)),
        // TEST-ONLY (tester, 2026-09-01): besin erişilebilirlik iddiasını doğrulamak
        // için konum eklendi, test bitince geri alınacak.
        x2: Number(c.x2.toFixed(1)),
        y2: Number(c.y2.toFixed(1)),
        // Faz VII TEST-ONLY: üreme stratejisi/yumurtalama genleri + ebeveyn bakımı
        // durumu, headless doğrulama için.
        reproductionStrategy: c.genome.reproductionStrategy,
        laysEggs: c.genome.laysEggs,
        isNewborn: c.isNewborn,
        nearCaringParent: c.isNearCaringParent(50),
        // Faz IX TEST-ONLY: diyet/etoloji doğrulaması için.
        diet: c.genome.diet,
        behaviorState: c.behaviorState,
      })),
    getNutrientCounts: () => ecosystem.getNutrientCounts(),
    getOrganPrevalence: () => ecosystem.getOrganPrevalence(),
    // Faz IX TEST-ONLY: diyet dağılımı + soy hattı/evrim geçmişi sorguları.
    __getDietCounts: () => ecosystem.getDietCounts(),
    __getEvolutionHistory: (id: number) => ecosystem.getEvolutionHistory(id),
    __getLineageRecordById: (id: number) => ecosystem.getLineageRecordById(id),
    __forceDiet: (id: number, diet: "herbivore" | "carnivore") => {
      const target = ecosystem.getCreatures().find((c) => c.genome.id === id);
      if (!target) return false;
      (target.genome as { diet: "herbivore" | "carnivore" }).diet = diet;
      return true;
    },
    // Faz XVII Madde 2 TEST-ONLY: sürü davranışı genini elle zorlamak için (mekanizmayı
    // uzun bir mutasyon beklemeden doğrulamak amacıyla).
    __forcePackHunter: (id: number, packHunter: boolean) => {
      const target = ecosystem.getCreatures().find((c) => c.genome.id === id);
      if (!target) return false;
      (target.genome as { packHunter: boolean }).packHunter = packHunter;
      return true;
    },
    __getPackHunterCount: () => ecosystem.getCreatures().filter((c) => c.genome.packHunter).length,
    // TEST-ONLY (coder, 2026-09-11): yeni bir organ tipini elle zorlamak için (uzun bir
    // mutasyon beklemeden mekanizmayı doğrulamak amacıyla, __forcePackHunter emsaliyle
    // tutarlı). Doğrulama bitince kaldırılacak.
    __forceOrgan: (id: number, type: OrganType, power = 0.7) => {
      const target = ecosystem.getCreatures().find((c) => c.genome.id === id);
      if (!target) return false;
      const organs = (target.genome as { organs: { type: OrganType; power: number }[] }).organs;
      if (!organs.some((o) => o.type === type)) organs.push({ type, power });
      return true;
    },
    __debugGetPackHuntEscapeReduction: (id: number) => ecosystem.__debugGetPackHuntEscapeReduction(id),
    __getOldAgeDeathCount: () => ecosystem.getOldAgeDeathCount(),
    __forceAge: (id: number, age: number) => {
      const target = ecosystem.getCreatures().find((c) => c.genome.id === id);
      if (!target) return false;
      (target as { age: number }).age = age;
      return true;
    },
    __forceEnergy: (id: number, energy: number) => {
      const target = ecosystem.getCreatures().find((c) => c.genome.id === id);
      if (!target) return false;
      target.energy = energy;
      return true;
    },
    // TEST-ONLY (tester, Faz VI bağımsız doğrulaması, 2026-09-02): ceset/ayrıştırıcı/
    // soy ağacı sayaçlarını test scriptine açar.
    __getCorpseCount: () => ecosystem.getCorpseCount(),
    __getDecomposerCount: () => ecosystem.getDecomposerCount(),
    __getDecomposerContributionStats: () => ecosystem.getDecomposerContributionStats(),
    __getLineage: () => ecosystem.getLineage(),
    // Faz XVI Madde 1 TEST-ONLY: özet düğüm (budanan eski dallar) doğrulaması için.
    __getLineageSummaries: () => ecosystem.getLineageSummaries(),
    __debugForceSyntheticLineageChain: (count: number) => ecosystem.__debugForceSyntheticLineageChain(count),
    // Faz XI adayı TEST-ONLY (soy ağacı zoom/pan doğrulaması): zoom seviyesini okur.
    __getLineageZoom: () => lineageTree.getZoom(),
    // Faz XIV TEST-ONLY (seçim halkası bug doğrulaması, geri alınacak): düğüm
    // konumlarını okur, gerçek fare tıklamasıyla belirli bir düğümü hedeflemek için.
    __getLineageNodePositions: () => lineageTree.getNodePositionsForTest(),
    __getSelectionRingState: () => ({
      x: selectionRing.position.x,
      y: selectionRing.position.y,
      visible: selectedCreature !== null,
      selectedId: selectedCreature?.genome.id ?? null,
    }),
    // Faz VII TEST-ONLY: yumurta sayısı ve Gemini ağırlık önerisini elle tetiklemek
    // için (mekanizmanın kendisini uzun bir mutasyon beklemeden doğrulamak amacıyla).
    __getEggCount: () => ecosystem.getEggCount(),
    __applyGeminiWeightSuggestion: (suggestion: GeminiWeightSuggestion) =>
      applyGeminiWeightSuggestion(suggestion),
    __getOrganWeightMultipliers: () => Object.fromEntries(getOrganWeightMultipliers()),
    __getSexualStrategyMultiplier: () => getSexualStrategyMultiplier(),
    // Faz XIII TEST-ONLY (opsiyonel madde 3): davranış eğilimi önerisini elle
    // tetiklemek/okumak için (uzun bir periyodik Gemini bekleyişi olmadan doğrulama).
    __applyGeminiBehaviorSuggestion: (suggestion: GeminiBehaviorSuggestion) =>
      applyGeminiBehaviorSuggestionSafe(suggestion),
    __getBehaviorAdjustmentOffsets: () => getBehaviorAdjustmentOffsets(),
    // Faz VII TEST-ONLY: belirli bir canlının genomuna zorla cinsel üreme/yumurtalama
    // geni ekleyip mekanizmayı uzun bir mutasyon beklemeden doğrulamak için.
    __forceReproductionGenes: (
      id: number,
      strategy: "asexual" | "sexual",
      laysEggs: boolean,
      x?: number,
      y?: number
    ) => {
      const target = ecosystem.getCreatures().find((c) => c.genome.id === id);
      if (!target) return false;
      (target.genome as { reproductionStrategy: "asexual" | "sexual" }).reproductionStrategy = strategy;
      (target.genome as { laysEggs: boolean }).laysEggs = laysEggs;
      target.energy = target.maxEnergy * 0.99;
      if (typeof x === "number" && typeof y === "number") target.setPosition(x, y);
      return true;
    },
    // Faz VII TEST-ONLY: bir canlıyı zorla belirli bir konuma taşımak için (çiftleşme
    // mesafe mekanizmasını uzun bir rastgele-gezinme beklemeden doğrulamak amacıyla).
    __forcePosition: (id: number, x: number, y: number) => {
      const target = ecosystem.getCreatures().find((c) => c.genome.id === id);
      if (!target) return false;
      target.setPosition(x, y);
      return true;
    },
    // TEST-ONLY (tester tarafından eklendi, 2026-09-10): dünya koordinatını ekran
    // koordinatına çevirir, headless testlerin bir canlıyı güvenilir şekilde tıklayabilmesi
    // için (world.position/scale doğrudan erişilebilir değil).
    __worldToScreen: (x: number, y: number) => ({
      x: world.position.x + x * world.scale.x,
      y: world.position.y + y * world.scale.y,
    }),
    // Faz VII TEST-ONLY: simülasyonu anlık olarak duraklatmak/başlatmak için (test
    // scriptinin ekstra bir simülasyon adımı ilerlemeden zorlanmış durumu okuyabilmesi
    // amacıyla) — SpeedControl'a doğrudan bağlı, tuş simülasyonuna gerek kalmadan.
    __setSpeed: (speed: 0 | 1 | 2 | 4) => speedControl.setSpeed(speed),
    __getSpeed: () => speedControl.getSpeed(),
    // TEST-ONLY (tester tarafından geçici eklendi, 2026-09-01): besin erişilebilirlik
    // iddiasını (yeni besinlerin ~%75'i bir canlıya yakın doğuyor) bağımsız doğrulamak
    // için nutrient konumlarını dışa açar. Test bitince main.ts'ten geri alınacak.
    __getNutrientPositionsForTest: () => ({
      water: (ecosystem as unknown as { nutrients: { x2: number; y2: number }[] }).nutrients?.map((n) => ({ x: n.x2, y: n.y2 })) ?? [],
    }),
    // Faz VIII TEST-ONLY: rastgele harita + dünya olayları doğrulaması için.
    __getMapSeed: () => worldMap.seed,
    // Faz XVII Madde 3 TEST-ONLY: arazi çeşidi dağılımını (derin su/sığ su/kumsal/
    // ova/dağ) örnekleyerek doğrulamak için — mevcut `getNutrientCounts` vb.
    // salt-okunur test hook'larıyla aynı gelenek.
    __getElevationBandSample: (stepPx: number = 20) => {
      const counts: Record<string, number> = {};
      for (let x = 0; x < MAP_WIDTH; x += stepPx) {
        for (let y = 0; y < MAP_HEIGHT; y += stepPx) {
          const band = worldMap.getElevationBand(x, y);
          counts[band] = (counts[band] ?? 0) + 1;
        }
      }
      return counts;
    },
    __getWorldEventCounts: () => worldEvents.getEventCounts(),
    __getWorldEventActiveState: () => worldEvents.getActiveState(),
    __forceWorldEvent: (kind: "meteor" | "climate" | "wind" | "quake") =>
      worldEvents.forceTrigger(kind, ecosystem.getSimulationTime()),
    __applyMeteorImpact: (x: number, y: number, radius: number) => ecosystem.applyMeteorImpact(x, y, radius),
    __setWind: (vx: number, vy: number) => ecosystem.setWind(vx, vy),
    __isWater: (x: number, y: number) => worldMap.isWater(x, y),
    __applyQuakeOverride: (x: number, y: number, radius: number, toWater: boolean) =>
      worldMap.applyQuakeOverride(x, y, radius, toWater),
    __clearQuakeOverrides: () => worldMap.clearQuakeOverrides(),
    __setClimateMultipliers: (metabolism: number, nutrient: number) => {
      ecosystem.setClimateMetabolismMultiplier(metabolism);
      ecosystem.setClimateNutrientMultiplier(nutrient);
    },
    // Faz X TEST-ONLY: sığ/derin su + solunum organları + atmosfer doğrulaması için.
    __forceOrgans: (id: number, organs: { type: OrganType; power: number }[], x?: number, y?: number) => {
      const target = ecosystem.getCreatures().find((c) => c.genome.id === id);
      if (!target) return false;
      (target.genome as { organs: { type: OrganType; power: number }[] }).organs = organs;
      if (typeof x === "number" && typeof y === "number") target.setPosition(x, y);
      return true;
    },
    __isDeepWater: (x: number, y: number) => worldMap.isDeepWater(x, y),
    __isShallowWater: (x: number, y: number) => worldMap.isShallowWater(x, y),
    __getOxygenLevel: () => ecosystem.getOxygenLevel(),
    __setAtmosphereClimateOffset: (offset: number) => ecosystem.setAtmosphereClimateOffset(offset),
    __forceMetabolism: (id: number, metabolism: number) => {
      const target = ecosystem.getCreatures().find((c) => c.genome.id === id);
      if (!target) return false;
      (target.genome as { metabolism: number }).metabolism = metabolism;
      return true;
    },
    __getBreathingMultiplier: (id: number, onLand: boolean) => {
      const target = ecosystem.getCreatures().find((c) => c.genome.id === id);
      if (!target) return null;
      return target.breathingMetabolismMultiplier(onLand, ecosystem.getOxygenLevel());
    },
    // Faz XII TEST-ONLY: besin oranı kontrolü / doğa olayı durdurma doğrulaması için.
    __setUserNutrientMultiplier: (mult: number) => ecosystem.setUserNutrientMultiplier(mult),
    __getUserNutrientMultiplier: () => ecosystem.getUserNutrientMultiplier(),
    // Faz XIII TEST-ONLY (kök neden teşhisi, geri alınacak): iklim çarpanlarının
    // gerçek zamanlı değerlerini dışa açar.
    __getClimateNutrientMultiplier: () => ecosystem.getClimateNutrientMultiplier(),
    __getClimateMetabolismMultiplier: () => ecosystem.getClimateMetabolismMultiplier(),
    __setAutoEventsEnabled: (enabled: boolean) => worldEvents.setAutoEventsEnabled(enabled),
    __isAutoEventsEnabled: () => worldEvents.isAutoEventsEnabled(),
    // Bu oturum TEST-ONLY (2026-09-11, uzun-koşu popülasyon çöküşü kök neden teşhisi,
    // geri alınacak): ortalama enerji oranı + besin sayıları zaten public metod olarak
    // vardı ama __debug köprüsünden dışa açık değildi.
    __getAverageEnergyRatio: () => ecosystem.getAverageEnergyRatio(),
    // Faz XVI Madde 2 TEST-ONLY: gezegen oluşum profili doğrulaması için.
    __getPlanetProfile: () => planetProfile,
    __isPlanetFormationOverlayVisible: () => !document.getElementById("planet-formation-overlay")?.hidden,
    // Faz XVI Madde 3 TEST-ONLY: gezegene özgü organ filtrelemesi doğrulaması için.
    __getPlanetForbiddenOrgans: () => planetForbiddenOrgans,
  };

  const speedControl = new SpeedControl();
  const restartButton = new RestartButton();
  const dashControls = document.getElementById("dash-controls");
  if (!dashControls) throw new Error("#dash-controls bulunamadı");
  dashControls.appendChild(speedControl.container);
  dashControls.appendChild(restartButton.container);

  // --- Faz XVI Madde 2 — Gezegen oluşum ekranı (TASKS.md): sadece YENİ bir
  // simülasyonda (`!savedGame`) gösterilir. Kullanıcı "Simülasyonu Başlat"a basana
  // kadar simülasyon SAATİ durur (hız 0/duraklat) VE başlangıç popülasyonu henüz
  // spawn edilmemiş olur (yukarıda ertelendi) — harita zaten görünür (arka planda),
  // sadece canlılar/ekosistem saati bekliyor. v3'ün minimal ilkesiyle tutarlı: büyük
  // bir cutscene değil, tek ekranlık bir özet + tek bir buton. ---
  const planetFormationOverlayEl = document.getElementById("planet-formation-overlay");
  const planetFormationBodyEl = document.getElementById("planet-formation-body");
  const planetFormationStartBtnEl = document.getElementById("planet-formation-start-btn");
  if (!planetFormationOverlayEl || !planetFormationBodyEl || !planetFormationStartBtnEl) {
    throw new Error("#planet-formation-overlay/#planet-formation-body/#planet-formation-start-btn bulunamadı");
  }
  // TS'in closure-içi null-narrowing sınırlaması nedeniyle (yukarıdaki throw guard'ı
  // aşağıdaki iç içe fonksiyonlarda otomatik narrow edilmiyor) non-null'ları AYRI,
  // açıkça `HTMLElement` tipli sabitlere atıyoruz.
  const planetFormationOverlay: HTMLElement = planetFormationOverlayEl;
  const planetFormationBody: HTMLElement = planetFormationBodyEl;
  const planetFormationStartBtn: HTMLElement = planetFormationStartBtnEl;

  function renderPlanetFormationScreen(profile: PlanetProfile): void {
    const atm = profile.atmosphere;
    const legendItems: { label: string; value: number; color: string }[] = [
      { label: "Azot", value: atm.nitrogen, color: "#3fa7d6" },
      { label: "Oksijen", value: atm.oxygen, color: "#e0c341" },
      { label: "Karbondioksit", value: atm.carbonDioxide, color: "#8a6fd6" },
      { label: "Metan", value: atm.methane, color: "#e0743f" },
    ];
    const barSegments = legendItems
      .map((it) => `<div style="width:${it.value.toFixed(2)}%; background:${it.color};"></div>`)
      .join("");
    const legend = legendItems
      .map(
        (it) =>
          `<span class="planet-formation-legend-item"><span class="planet-formation-legend-swatch" style="background:${it.color};"></span>${it.label} ${it.value.toFixed(1)}%</span>`
      )
      .join("");
    const bioList = profile.bioSubstances.map((s) => `<li>${s}</li>`).join("");

    planetFormationBody.innerHTML = `
      <p class="planet-formation-narrative">${profile.narrative}</p>
      <div class="planet-formation-section-title">Atmosfer Bileşimi</div>
      <div class="planet-formation-atmosphere-bar">${barSegments}</div>
      <div class="planet-formation-atmosphere-legend">${legend}</div>
      <div class="planet-formation-section-title">Bio Maddeler (kimyasal/mineral zenginlik)</div>
      <ul class="planet-formation-bio-list">${bioList}</ul>
    `;
  }

  let simulationStarted = savedGame !== null;
  // Faz XI bug düzeltmesi (2026-09-10): içe aktarma sayfayı yeniliyor (`location.reload()`)
  // — bu, `beforeunload`'ı da tetikliyor, o da mevcut (henüz içe aktarılmamış) canlı
  // durumu `writeSaveData` ile YENİDEN yazıp içe aktarma yazımını EZİYORDU (canlı testte
  // bulundu — reload sonrası popülasyon her zaman B'nin KENDİ eski durumuydu, A'dan
  // içe aktarılan hiç görünmüyordu). Bu bayrak `beforeunload`'a "bu bir normal
  // kapanış/yenileme değil, ben zaten doğru veriyi yazdım, üstüne yazma" demek için.
  let skipBeforeUnloadAutosave = false;
  if (!savedGame) {
    speedControl.setSpeed(0); // "Simülasyonu Başlat"a kadar saat durur.
    renderPlanetFormationScreen(planetProfile);
    planetFormationOverlay.hidden = false;
  }

  function startNewSimulation(): void {
    if (simulationStarted) return;
    simulationStarted = true;
    planetFormationOverlay.hidden = true;
    ecosystem.spawnInitialCreatures(INITIAL_CREATURE_COUNT);
    speedControl.setSpeed(1);
  }

  planetFormationStartBtn.addEventListener("click", startNewSimulation);

  // --- Kamera: sabit boyutlu haritayı sahne paneline sığdırır (contain) ve ortalar —
  // dairesel gezegenin merkezleme mantığı yerine basit bir "fit" ölçeklemesi. ---
  function fitCamera(): void {
    const scale = Math.min(app.screen.width / MAP_WIDTH, app.screen.height / MAP_HEIGHT) * 0.94;
    world.scale.set(scale);
    world.position.set(
      (app.screen.width - MAP_WIDTH * scale) / 2,
      (app.screen.height - MAP_HEIGHT * scale) / 2
    );
  }
  fitCamera();
  app.renderer.on("resize", fitCamera);

  /**
   * Faz XI — Sürekli İyileştirme (organ trend oku, 2026-09-10, PM onaylı): canlı
   * inceleme panelinde her organ satırının yanına popülasyon genelindeki yaygınlık
   * yönünü (↑/↓/—) ekler. `Creature.getInspectionSummary` ekosistem-genelindeki
   * veriyi bilmiyor (ayrım bilerek korunuyor, bkz. `creature.ts`), bu yüzden birleşim
   * burada, `hud.showInspector`'a geçmeden hemen önce yapılıyor. Yeterli örnek
   * birikmediyse (`insufficient-data`) hiçbir ok gösterilmiyor — sahte bir "stabil"
   * izlenimi verilmiyor (TASKS.md "uydurma yok" ilkesi).
   */
  function showInspectorWithTrend(
    summary: ReturnType<Creature["getInspectionSummary"]>,
    onAnalyzeLineage?: () => void
  ): void {
    const trend = ecosystem.getOrganPrevalenceTrend();
    hud.showInspector(
      {
        ...summary,
        organs: summary.organs.map((o) => ({ ...o, trend: trend[o.type] })),
      },
      onAnalyzeLineage
    );
  }

  // --- Faz V — Canlı inceleme paneli (TASKS.md): canvas'a tıklayınca canvas
  // koordinatını world koordinatına çevirip (Pixi'nin kendi global->local dönüşümü,
  // `fitCamera`'nın ölçek/konumunu otomatik hesaba katar) en yakın canlıyı bulur. ---
  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;
  app.renderer.on("resize", () => {
    app.stage.hitArea = app.screen;
  });
  // Faz IX — Soy analizi butonu (TASKS.md madde 7): şu an inceleme panelinde
  // gösterilen bireyin ID'si — hem canlı bir Creature seçiminden (`setSelection`)
  // hem soy ağacından ölü bir birey seçiminden (`selectedInspectedId`) gelebilir.
  // `Ecosystem`'in kendisi UI'a bağımlı olmasın diye bu id burada, main.ts'te tutuluyor.
  let selectedInspectedId: number | null = null;

  app.stage.on("pointertap", (e: FederatedPointerEvent) => {
    const local = world.toLocal(e.global);
    const clicked = ecosystem.findNearestCreature(local.x, local.y, CREATURE_CLICK_TOLERANCE);
    if (clicked) {
      const onLand = !worldMap.isWater(clicked.x2, clicked.y2);
      selectedInspectedId = clicked.genome.id;
      showInspectorWithTrend(clicked.getInspectionSummary(onLand), () => requestLineageAnalysis(selectedInspectedId));
      setSelection(clicked);
    } else {
      selectedInspectedId = null;
      hud.hideInspector();
      setSelection(null);
    }
  });

  // --- Faz VI — Soy ağacı overlay paneli (TASKS.md): varsayılan kapalı, küçük bir
  // toggle butonuyla açılıp kapanan bir panel — sürekli görünür bir dashboard değil. */
  const lineageTree = new LineageTree();

  /**
   * Faz IX — Soy ağacından canlı seçimi (TASKS.md madde 6): bir düğüme tıklanınca
   * o canlıyı seçer — hayattaysa mevcut inceleme paneli + seçim halkası (Faz V/VI'nın
   * DAVRANIŞI hiç değiştirilmedi, sadece giriş noktası bir tane daha eklendi); ölmüşse
   * `LineageRecord`'tan türetilen temel bilgiler + evrim geçmişi gösterilir. `lineagetree.ts`
   * MİNİMAL şekilde değiştirildi (bkz. dosyanın kendisi) — sadece bir `onNodeClick`
   * callback'i eklendi, mevcut show/hide/toggle mantığına DOKUNULMADI.
   */
  const lineageNodeClickHandler = (id: number): void => {
    // Faz XVI Madde 1 — özet düğümler (bkz. ecosystem.ts `LineageSummaryNode`)
    // sentetik NEGATİF id'ler kullanır (gerçek genom id'leri hep >=1 — bkz.
    // genome.ts `nextGenomeId`). Böyle bir düğüme tıklanınca inceleme paneli
    // AÇILMAZ (bir Creature/ölü kayıt değil) — bunun yerine event log'a kısa,
    // gerçek veriye dayalı bir özet satırı düşer (uydurma yok, doğrudan
    // `LineageSummaryNode` alanlarından).
    if (id < 0) {
      const summary = ecosystem.getLineageSummaries().find((s) => s.id === id);
      if (summary) {
        const genRange =
          summary.minGeneration === summary.maxGeneration
            ? `nesil ${summary.minGeneration}`
            : `nesil ${summary.minGeneration}-${summary.maxGeneration}`;
        hud.pushEvent(
          `🗂️ Sıkıştırılmış geçmiş: ${summary.individualCount} birey (${genRange}), gözlemlenen organlar: ${
            summary.observedOrgans.length > 0
              ? summary.observedOrgans.map((t) => ORGAN_DEFINITIONS[t].label).join(", ")
              : "yok"
          }.`
        );
      }
      return;
    }
    selectedInspectedId = id;
    const liveCreature = ecosystem.getCreatures().find((c) => c.genome.id === id && c.alive);
    if (liveCreature) {
      const onLand = !worldMap.isWater(liveCreature.x2, liveCreature.y2);
      showInspectorWithTrend(liveCreature.getInspectionSummary(onLand), () => requestLineageAnalysis(selectedInspectedId));
      setSelection(liveCreature);
      return;
    }

    const record = ecosystem.getLineageRecordById(id);
    if (!record) return;
    setSelection(null);
    const lifespan = record.diedAtSimTime !== null ? record.diedAtSimTime - record.bornAtSimTime : null;
    hud.showDeceasedInspector(
      {
        id: record.id,
        generation: record.generation,
        lifespan,
        organs: record.organs.map((type) => ({
          type,
          label: ORGAN_DEFINITIONS[type].label,
          power: 0.5,
          description: ORGAN_DEFINITIONS[type].description,
        })),
        offspringCount: record.offspringCount,
        evolutionHistory: ecosystem.getEvolutionHistory(id),
      },
      () => requestLineageAnalysis(selectedInspectedId)
    );
  };
  lineageTree.onNodeClick(lineageNodeClickHandler);

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      speedControl.togglePause();
    } else if (e.key === "1") {
      speedControl.setSpeed(1);
    } else if (e.key === "2") {
      speedControl.setSpeed(2);
    } else if (e.key === "3") {
      speedControl.setSpeed(4);
    }
  });

  restartButton.onClick(() => {
    clearSaveData();
    // Faz XVI Madde 2 — "Yeniden Başlat" formasyon ekranı hâlâ açıkken tıklanırsa
    // (kullanıcı hiç "Simülasyonu Başlat"a basmadan restart'a basarsa) önce ekranı
    // kapatıp simülasyonu normal şekilde başlatıyoruz — `ecosystem.reset` zaten
    // `spawnInitialCreatures`'ı kendi içinde çağırıyor, bu yüzden burada AYRICA
    // spawn etmiyoruz (çift spawn riskinden kaçınmak için `simulationStarted`
    // bayrağı sadece kapatma/hız durumunu senkronlamak için kullanılıyor).
    if (!simulationStarted) {
      simulationStarted = true;
      planetFormationOverlay.hidden = true;
      speedControl.setSpeed(1);
    }
    ecosystem.reset(INITIAL_CREATURE_COUNT);
  });

  let hudTimer = 0;
  let autosaveTimer = 0;
  let geminiTimer = 0;
  let geminiRequestInFlight = false;
  let telemetryTimer = 0;

  /** Faz XI (Otonom Çalışma Modu — "backend işi") — periyodik olarak popülasyon/soy
   *  özetini `/api/population-snapshot`'a POST eder (bkz. `vite.config.ts`). TAMAMEN
   *  isteğe bağlı/opsiyonel bir dışa açılım — istek başarısız olursa (dev server proxy'si
   *  yoksa, ağ hatası vb.) SESSİZCE yutulur, simülasyonu hiçbir şekilde etkilemez veya
   *  durdurmaz (Faz V'teki Gemini çağrısıyla aynı hata-toleransı felsefesi). */
  function sendPopulationTelemetry(): void {
    const stats = ecosystem.getStats();
    const dietCounts = ecosystem.getDietCounts();
    const organPrevalence = ecosystem.getOrganPrevalence();
    fetch("/api/population-snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        population: stats.population,
        maxGeneration: stats.maxGeneration,
        historicalMaxGeneration: stats.historicalMaxGeneration,
        totalBirths: stats.totalBirths,
        herbivoreCount: dietCounts.herbivore,
        carnivoreCount: dietCounts.carnivore,
        simTimeSeconds: ecosystem.getSimulationTime(),
        organPrevalence,
      }),
    }).catch(() => {
      // Sessizce yutulur — telemetri opsiyonel, sim asla buna bağımlı olmamalı.
    });
  }

  /** Faz VII — Gemini'nin hafif yönlendirmesi (TASKS.md): yapılandırılmış öneriyi
   *  (varsa) `organs.ts`/`genome.ts`'teki SINIRLI (±%20) çarpanlara uygular. Gemini
   *  simülasyona doğrudan karışmıyor — bu sadece mutasyon ağırlıklarını hafifçe
   *  kaydıran, tamamen opsiyonel bir dışsal sinyal. `suggestion` `null`/geçersizse
   *  (parse hatası, tanınmayan hedef) SESSİZCE hiçbir şey yapılmaz — sabit ağırlıklarla
   *  devam edilir (TASKS.md — "tek nokta arıza olmamalı").
   */
  function applyGeminiWeightSuggestion(suggestion: GeminiWeightSuggestion | null): void {
    if (!suggestion) return;
    if (suggestion.target === "sexual") {
      applySexualStrategyWeightSuggestion(suggestion.weightAdjustment);
    } else if (ALL_ORGAN_TYPES.includes(suggestion.target as OrganType)) {
      applyOrganWeightSuggestion(suggestion.target as OrganType, suggestion.weightAdjustment);
    }
    // Tanınmayan bir hedef string'i (beklenmeyen bir model çıktısı) sessizce yok
    // sayılır — yukarıdaki iki dal dışında hiçbir eylem alınmıyor.
  }

  /**
   * Faz XIII (opsiyonel madde 3) — Gemini'nin soy-bazlı davranış eğilimi önerisini
   * (varsa) `ecosystem.ts`'teki SINIRLI (±0.15 toplam clamp) ofsetlere uygular —
   * `applyGeminiWeightSuggestion` ile AYNI desen/güvenlik felsefesi. `suggestion`
   * `null`/geçersizse SESSİZCE hiçbir şey yapılmaz; ana hareket kararı zaten bu
   * çağrıya bağımlı değil — sadece MEVCUT periyodik Gemini döngüsünün (aşağıda,
   * `requestGeminiInsight`) bir sonucu olarak, gerçek zamanlı hareket kararının
   * DIŞINDA, senkron olmayan bir şekilde tetikleniyor.
   */
  function applyGeminiBehaviorSuggestionSafe(suggestion: GeminiBehaviorSuggestion | null): void {
    if (!suggestion) return;
    applyGeminiBehaviorSuggestion(suggestion.trait, suggestion.adjustment);
  }

  /** Faz V — Gemini API ile derin analiz (TASKS.md). Ham veri toplanıp proxy'ye
   *  gönderilir; sonuç event log'a 🔬 işaretiyle düşer. HATA TOLERANSI: bu fonksiyon
   *  hiçbir zaman fırlatmaz (fetchGeminiInsight zaten kendi içinde try/catch ile
   *  null döner) — Gemini bir "ek", eşik-tabanlı sistemi asla durdurmaz. Üst üste
   *  çağrıları engellemek için `geminiRequestInFlight` bayrağı kullanılıyor (yavaş
   *  bir yanıt varken ikinci bir istek atılmasın).
   */
  async function requestGeminiInsight(): Promise<void> {
    if (geminiRequestInFlight) return;
    geminiRequestInFlight = true;
    try {
      const stats = ecosystem.getStats();
      const result = await fetchGeminiInsight({
        simTimeSeconds: ecosystem.getSimulationTime(),
        population: stats.population,
        maxGeneration: stats.maxGeneration,
        totalBirths: stats.totalBirths,
        waterPercent: worldMap.waterFraction * 100,
        organPrevalence: ecosystem.getOrganPrevalence(),
        averageEnergyRatio: ecosystem.getAverageEnergyRatio(),
        recentEvents: [...ecosystem.getRecentEventTexts()],
      });
      if (result) {
        if (result.text) hud.pushEvent(result.text, true);
        applyGeminiWeightSuggestion(result.suggestion);
        applyGeminiBehaviorSuggestionSafe(result.behaviorSuggestion);
      }
    } catch (err) {
      // Ekstra güvenlik ağı: fetchGeminiInsight zaten hata yutuyor ama burada da
      // uygulamanın asla çökmemesini garanti ediyoruz.
      console.warn("[Gemini] Beklenmeyen hata (yutuldu):", err);
    } finally {
      geminiRequestInFlight = false;
    }
  }

  /**
   * Faz IX — "Bu soyu analiz et" (TASKS.md madde 7): İSTEĞE BAĞLI, buton ile
   * tetiklenen bir Gemini çağrısı — mevcut periyodik (75s) genel yorumlama sistemine
   * DOKUNMUYOR, ayrı/ek bir özellik. Sonuç inceleme panelindeki küçük alt bölgeye
   * yazılır (`Hud.setLineageAnalysisResult`). Hata toleranslı: `fetchLineageAnalysis`
   * zaten `null` dönebiliyor (ağ/parse hatası) — bu durumda kullanıcıya nazik bir
   * hata mesajı gösterilir, uygulama asla çökmez.
   */
  let lineageAnalysisInFlight = false;
  async function requestLineageAnalysis(id: number | null): Promise<void> {
    if (id === null || lineageAnalysisInFlight) return;
    lineageAnalysisInFlight = true;
    hud.setLineageAnalysisLoading();
    try {
      const liveCreature = ecosystem.getCreatures().find((c) => c.genome.id === id);
      const record = ecosystem.getLineageRecordById(id);
      if (!record) {
        hud.setLineageAnalysisResult("Bu birey için soy kaydı bulunamadı.", true);
        return;
      }
      const lifespanSeconds =
        record.diedAtSimTime !== null ? record.diedAtSimTime - record.bornAtSimTime : null;
      const text = await fetchLineageAnalysis({
        individualId: record.id,
        generation: record.generation,
        isAlive: liveCreature?.alive ?? false,
        lifespanSeconds,
        offspringCount: record.offspringCount,
        diet: record.diet,
        organs: record.organs.map((type) => ORGAN_DEFINITIONS[type].label),
        ancestryOrganGains: ecosystem.getEvolutionHistory(id),
      });
      if (text) {
        hud.setLineageAnalysisResult(text, false);
      } else {
        hud.setLineageAnalysisResult("Gemini'den şu anda bir yanıt alınamadı (ağ/API hatası). Daha sonra tekrar deneyin.", true);
      }
    } catch (err) {
      console.warn("[Gemini/Soy Analizi] Beklenmeyen hata (yutuldu):", err);
      hud.setLineageAnalysisResult("Beklenmeyen bir hata oluştu, analiz alınamadı.", true);
    } finally {
      lineageAnalysisInFlight = false;
    }
  }

  window.addEventListener("beforeunload", () => {
    // Faz XVI Madde 2 — BUG önlemi: gezegen oluşum ekranı hâlâ açıkken (kullanıcı
    // "Simülasyonu Başlat"a hiç basmadan) sayfa kapanırsa/yenilenirse, `ecosystem`
    // henüz HİÇ canlı spawn etmemiş olur — bu anda bir kayıt yazmak `creatures: []`
    // gibi "boş ama GEÇERLİ" bir save üretir, bir sonraki yüklemede bu sahte kayıt
    // `savedGame` olarak algılanıp formasyon ekranını YANLIŞLIKLA atlar (kalıcı
    // olarak 0 popülasyonlu bir "yüklenmiş oyun" durumuna sıkışır). Bu yüzden
    // simülasyon GERÇEKTEN başlamadan hiçbir kayıt yazılmıyor.
    if (!simulationStarted) return;
    // Faz XI bug düzeltmesi (2026-09-10): içe aktarma zaten doğru veriyi yazdıysa
    // (bkz. `skipBeforeUnloadAutosave`), burada TEKRAR yazıp onu ezmiyoruz.
    if (skipBeforeUnloadAutosave) return;
    const snapshot = ecosystem.serialize();
    // Faz VIII notu (kullanıcı uyarısı — geçmişte SAVE_VERSION uyuşmazlığı burada
    // gerçekleşmişti): sayı literali YAZILMIYOR, `savegame.ts`'ten import edilen
    // `SAVE_VERSION` kullanılıyor — otomatik kayıt noktasıyla otomatik senkron.
    writeSaveData({ version: SAVE_VERSION, ...snapshot });
  });

  app.ticker.add((ticker) => {
    const speed = speedControl.getSpeed();

    if (speed > 0) {
      const rawDt = ticker.deltaMS / 1000;
      let remaining = Math.min(rawDt * speed, MAX_SIM_STEP_PER_FRAME);
      while (remaining > 0) {
        const step = Math.min(MAX_SIM_SUBSTEP, remaining);
        ecosystem.update(step);
        // Faz VIII — dünya olaylarının zamanlayıcıları (iklim/rüzgar/deprem süresi)
        // simülasyon zamanına bağlı olsun diye AYNI substep döngüsünde ilerletiliyor
        // (4x hızda gerçek zamana göre "4 kat daha hızlı" değil, sim-zamanına göre
        // tutarlı sürsün diye — ekosistemin geri kalanıyla aynı zaman tabanı).
        worldEvents.update(step, ecosystem.getSimulationTime());
        remaining -= step;
      }
    }

    hudTimer += ticker.deltaMS / 1000;
    if (hudTimer >= HUD_UPDATE_INTERVAL) {
      hudTimer = 0;
      const stats = ecosystem.getStats();
      const dietCounts = ecosystem.getDietCounts();
      hud.updateStats({
        ...stats,
        simTimeSeconds: ecosystem.getSimulationTime(),
        waterPercent: worldMap.waterFraction * 100,
        herbivoreCount: dietCounts.herbivore,
        carnivoreCount: dietCounts.carnivore,
        oxygenLevel: ecosystem.getOxygenLevel(),
      });
    }

    // Faz XVI Madde 2 — aynı BUG önlemi periyodik otomatik kayıt için de geçerli:
    // formasyon ekranı açıkken (`!simulationStarted`) hiçbir otomatik kayıt yazılmaz
    // (bkz. `beforeunload` handler'ındaki AYNI gerekçe).
    if (simulationStarted) {
      autosaveTimer += ticker.deltaMS / 1000;
      if (autosaveTimer >= AUTOSAVE_INTERVAL_SECONDS) {
        autosaveTimer = 0;
        const snapshot = ecosystem.serialize();
        writeSaveData({ version: SAVE_VERSION, ...snapshot });
      }

      // Faz XI (Otonom Çalışma Modu — "backend işi"): otomatik kayıtla AYNI aralıkta,
      // ama TAMAMEN BAĞIMSIZ bir zamanlayıcı — biri diğerini etkilemez/geciktirmez.
      telemetryTimer += ticker.deltaMS / 1000;
      if (telemetryTimer >= AUTOSAVE_INTERVAL_SECONDS) {
        telemetryTimer = 0;
        sendPopulationTelemetry();
      }
    }

    // Faz VI — Seçim halkası: seçili canlı hâlâ hayattaysa onun güncel konumuna
    // taşı; öldüyse (ceset kalsa bile TASKS.md gereği seçim kaybolmalı) temizle.
    if (selectedCreature) {
      if (!ecosystem.isCreatureAlive(selectedCreature)) {
        setSelection(null);
        hud.hideInspector();
      } else {
        selectionRing.position.set(selectedCreature.x2, selectedCreature.y2);
      }
    }

    // Faz VI — Soy ağacı: panel kapalıyken `render` içeride erken çıkıyor (ucuz no-op),
    // açıkken periyodik olarak (HUD ile aynı aralıkta) yeniden çizilir.
    if (hudTimer === 0) {
      lineageTree.render(ecosystem.getLineage(), ecosystem.getLineageSummaries());
    }

    // Faz III — Neden/gerekçe şeffaflığı: Ecosystem eşik tabanlı olarak tespit ettiği
    // gerçek olayları (organ yaygınlaşması / enerji avantajı-dezavantajı) kuyruğa
    // koyuyor; burada Hud'a basıyoruz (en son olay üstte, bkz. Hud.pushEvent -> prepend).
    for (const event of ecosystem.pollEvolutionEvents()) {
      hud.pushEvent(event.text);
    }

    // Faz VIII — Rastgele dünya olayları: meteor/iklim/rüzgar/deprem olay metinleri
    // aynı event log'a (Faz III'ün mevcut sistemi) düşer.
    for (const event of worldEvents.pollEvents()) {
      hud.pushEvent(event.text);
    }

    // Faz V — Gemini API ile derin analiz: sadece simülasyon akıyorken (speed>0)
    // zamanlayıcıyı ilerlet, pause'dayken gereksiz çağrı atma.
    if (speed > 0) {
      geminiTimer += ticker.deltaMS / 1000;
      if (geminiTimer >= GEMINI_INSIGHT_INTERVAL_SECONDS) {
        geminiTimer = 0;
        void requestGeminiInsight();
      }
    }
  });
}

main().catch((err) => {
  console.error("Uygulama başlatılamadı:", err);
});
