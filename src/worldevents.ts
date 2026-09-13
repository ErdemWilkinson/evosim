import { World, MAP_WIDTH, MAP_HEIGHT } from "./world";
import { Ecosystem } from "./ecosystem";
import { Graphics } from "pixi.js";

/**
 * Faz VIII (v3) — Rastgele dünya olayları (TASKS.md). Nadir, gerçek mekanik etkisi
 * olan dört olay tipi: meteor, iklim/sıcaklık değişimi, rüzgar, deprem. Görsel
 * olarak BASİT/ŞEMATİK tutuluyor (gösterişli parçacık/patlama animasyonu YOK — bir
 * renk flaşı/ince gösterge yeterli, TASKS.md), ama mekanik etkileri gerçek ve
 * `Ecosystem`/`World` üzerinden ölçülebilir. Her olay event log'a (Faz III'ün
 * mevcut `EvolutionEvent` kuyruğuna benzer şekilde, ayrı bir kuyruk üzerinden)
 * düşürülüyor — `main.ts` bunu `Hud.pushEvent` ile ekrana basıyor.
 *
 * Sıklık/şiddet dengesi (TASKS.md: "Faz IV'te zar zor kurulan popülasyon dengesini
 * sürekli/agresif şekilde bozmamalı, nadir ve ilginç olmalı"): her olay tipi
 * kendi bağımsız zamanlayıcısıyla, birkaç dakikada bir DÜŞÜK bir olasılıkla
 * kontrol edilir (yani ortalama bekleme süresi dakikalar mertebesinde, ama tam
 * zamanı rastgele) — bkz. aşağıdaki `EVENT_CHECK_INTERVAL`/`*_CHANCE_PER_CHECK`
 * sabitleri. Meteor ve deprem etkisi KÜÇÜK/lokal tutuldu (TASKS.md deprem için
 * özellikle "BÜYÜK bir jeolojik değişim değil" diyor).
 */

export interface WorldEvent {
  simTime: number;
  text: string;
}

/** Her kaç saniyede bir "zar atılacağı" — bu, tek bir olayın süresi DEĞİL, sadece
 *  kontrol sıklığı. Gerçek tetiklenme aralığı `*_CHANCE_PER_CHECK` ile birlikte
 *  ortalama olarak dakikalar mertebesine yayılıyor. */
const EVENT_CHECK_INTERVAL = 8;

/** Kontrol başına tetiklenme olasılıkları — 8 saniyede bir kontrol edilip bu
 *  olasılıkla tetiklenince, ortalama bekleme süresi ~(EVENT_CHECK_INTERVAL /
 *  chance) saniye olur. Örn. meteor: 8/0.018 ≈ 444s (~7.4 dakika) ortalama —
 *  TASKS.md "birkaç dakikada bir düşük olasılık" ile tutarlı, nadir ve rastgele. */
const METEOR_CHANCE_PER_CHECK = 0.018;
const CLIMATE_CHANCE_PER_CHECK = 0.02;
const WIND_CHANCE_PER_CHECK = 0.03;
const QUAKE_CHANCE_PER_CHECK = 0.015;

const METEOR_RADIUS: [number, number] = [40, 90];
/** İklim dalgalanması — TASKS.md: "yavaş bir dalgalanma", metabolizma/besin üretimini
 *  KÜÇÜK bir oranda etkiler (aşırı olursa Faz IV'ün popülasyon dengesini bozar). */
const CLIMATE_DURATION: [number, number] = [45, 90];
const CLIMATE_METABOLISM_RANGE: [number, number] = [0.85, 1.2]; // soğuk dalga: metabolizma düşer; sıcak dalga: artar
const CLIMATE_NUTRIENT_RANGE: [number, number] = [0.7, 1.3]; // soğuk: besin üretimi düşer; sıcak: artar (aynı yönde, gerçekçi korelasyon)

const WIND_DURATION: [number, number] = [12, 25];
const WIND_STRENGTH: [number, number] = [8, 22]; // px/s cinsinden ek itiş

const QUAKE_RADIUS: [number, number] = [12, 28]; // küçük/lokal (TASKS.md)
const QUAKE_DURATION: [number, number] = [25, 50]; // geçici — bir süre sonra eski haline döner

/**
 * Faz VIII — Basit, şematik görsel gösterge: dünya konteynerinin üzerine kısa
 * süreliğine görünen ince bir daire/flaş (parçacık efekti YOK). Kendi kendini
 * `update` ile ilerletip süresi dolunca `finished=true` olur, `WorldEventManager`
 * onu sahneden kaldırır.
 */
class EventFlash extends Graphics {
  private life: number;
  private readonly maxLife: number;
  public finished = false;

  constructor(x: number, y: number, radius: number, color: number) {
    super();
    this.maxLife = 1.4;
    this.life = this.maxLife;
    this.position.set(x, y);
    this.circle(0, 0, radius).stroke({ width: 2.5, color, alpha: 0.9 });
  }

  public update(dt: number): void {
    this.life -= dt;
    if (this.life <= 0) {
      this.finished = true;
      return;
    }
    this.alpha = Math.max(0, this.life / this.maxLife);
  }
}

/**
 * Rüzgar/iklim için ince, sürekli bir HUD-benzeri gösterge yerine (v3'ün minimal
 * diline uygun) — sahnenin köşesinde küçük bir ok/renk şeridi yeterli. Basitlik
 * için sadece event log'a düşülüyor + kısa bir `EventFlash` (haritanın kenarında)
 * gösteriliyor; ekstra bir sürekli-görünür UI paneli EKLENMİYOR (TASKS.md: "gösterişli
 * olmasın").
 */
export class WorldEventManager {
  private meteorTimer = 0;
  private climateTimer = 0;
  private windTimer = 0;
  private quakeTimer = 0;

  private climateActiveTimer = 0;
  private windActiveTimer = 0;
  private quakeActiveTimer = 0;
  private quakeRegionActive = false;

  private readonly pendingEvents: WorldEvent[] = [];
  private flashes: EventFlash[] = [];

  /** Test/doğrulama amaçlı sayaçlar (main.ts debug hook'u üzerinden dışa açılabilir). */
  private meteorCount = 0;
  private climateCount = 0;
  private windCount = 0;
  private quakeCount = 0;

  /** Faz XII — Doğa olaylarını durdurma butonu (TASKS.md madde 3): kullanıcı
   *  otomatik/rastgele tetiklenmeyi tamamen kapatabilir. Zaten AKTİF olan bir olayın
   *  süresi (`updateActiveEffects`) hâlâ normal şekilde ilerleyip biter — sadece YENİ
   *  rastgele tetiklenme kontrolleri (`updateChecks`) atlanıyor. Manuel tetikleme
   *  (`forceTrigger`, madde 2) bu bayraktan ETKİLENMİYOR — kullanıcı otomatik olayları
   *  durdurup yine de isteğe bağlı olarak elle bir olay tetikleyebilmeli. */
  private autoEventsEnabled = true;
  public setAutoEventsEnabled(enabled: boolean): void {
    this.autoEventsEnabled = enabled;
  }
  public isAutoEventsEnabled(): boolean {
    return this.autoEventsEnabled;
  }

  constructor(
    private readonly world: World,
    private readonly ecosystem: Ecosystem,
    private readonly stage: import("pixi.js").Container
  ) {
    this.scheduleNext();
  }

  private scheduleNext(): void {
    this.meteorTimer = EVENT_CHECK_INTERVAL;
    this.climateTimer = EVENT_CHECK_INTERVAL;
    this.windTimer = EVENT_CHECK_INTERVAL;
    this.quakeTimer = EVENT_CHECK_INTERVAL;
  }

  public update(dt: number, simTime: number): void {
    this.updateChecks(dt, simTime);
    this.updateActiveEffects(dt, simTime);
    this.updateFlashes(dt);
  }

  private updateChecks(dt: number, simTime: number): void {
    if (!this.autoEventsEnabled) return;
    this.meteorTimer -= dt;
    if (this.meteorTimer <= 0) {
      this.meteorTimer = EVENT_CHECK_INTERVAL;
      if (Math.random() < METEOR_CHANCE_PER_CHECK) this.triggerMeteor(simTime);
    }

    this.climateTimer -= dt;
    if (this.climateTimer <= 0) {
      this.climateTimer = EVENT_CHECK_INTERVAL;
      if (this.climateActiveTimer <= 0 && Math.random() < CLIMATE_CHANCE_PER_CHECK) this.triggerClimate(simTime);
    }

    this.windTimer -= dt;
    if (this.windTimer <= 0) {
      this.windTimer = EVENT_CHECK_INTERVAL;
      if (this.windActiveTimer <= 0 && Math.random() < WIND_CHANCE_PER_CHECK) this.triggerWind(simTime);
    }

    this.quakeTimer -= dt;
    if (this.quakeTimer <= 0) {
      this.quakeTimer = EVENT_CHECK_INTERVAL;
      if (this.quakeActiveTimer <= 0 && Math.random() < QUAKE_CHANCE_PER_CHECK) this.triggerQuake(simTime);
    }
  }

  private updateActiveEffects(dt: number, simTime: number): void {
    if (this.climateActiveTimer > 0) {
      this.climateActiveTimer -= dt;
      if (this.climateActiveTimer <= 0) {
        this.ecosystem.setClimateMetabolismMultiplier(1);
        this.ecosystem.setClimateNutrientMultiplier(1);
        // Faz X — Atmosfer (TASKS.md): iklim dalgası bitince oksijen ofseti de nötre döner.
        this.ecosystem.setAtmosphereClimateOffset(0);
        void simTime;
      }
    }
    if (this.windActiveTimer > 0) {
      this.windActiveTimer -= dt;
      if (this.windActiveTimer <= 0) {
        this.ecosystem.setWind(0, 0);
      }
    }
    if (this.quakeActiveTimer > 0) {
      this.quakeActiveTimer -= dt;
      if (this.quakeActiveTimer <= 0 && this.quakeRegionActive) {
        this.world.clearQuakeOverrides();
        this.quakeRegionActive = false;
      }
    }
  }

  private updateFlashes(dt: number): void {
    if (this.flashes.length === 0) return;
    for (const f of this.flashes) f.update(dt);
    const stillActive = this.flashes.filter((f) => !f.finished);
    if (stillActive.length !== this.flashes.length) {
      for (const f of this.flashes) {
        if (f.finished) {
          this.stage.removeChild(f);
          f.destroy();
        }
      }
    }
    this.flashes = stillActive;
  }

  private pushEvent(simTime: number, text: string): void {
    this.pendingEvents.push({ simTime, text });
  }

  public pollEvents(): WorldEvent[] {
    if (this.pendingEvents.length === 0) return [];
    const events = this.pendingEvents.slice();
    this.pendingEvents.length = 0;
    return events;
  }

  private addFlash(x: number, y: number, radius: number, color: number): void {
    const flash = new EventFlash(x, y, radius, color);
    this.stage.addChild(flash);
    this.flashes.push(flash);
  }

  // --- Meteor ---

  private triggerMeteor(simTime: number): void {
    const x = Math.random() * MAP_WIDTH;
    const y = Math.random() * MAP_HEIGHT;
    const radius = METEOR_RADIUS[0] + Math.random() * (METEOR_RADIUS[1] - METEOR_RADIUS[0]);
    const { creaturesKilled, nutrientsDestroyed } = this.ecosystem.applyMeteorImpact(x, y, radius);
    this.meteorCount++;
    this.addFlash(x, y, radius, 0xd9803a);
    const t = Math.round(simTime);
    if (creaturesKilled > 0) {
      this.pushEvent(
        t,
        `t=${t}s — ☄️ Bir meteor haritaya çarptı, bölgedeki ${creaturesKilled} canlı ve ${nutrientsDestroyed} besin kaynağı yok oldu`
      );
    } else {
      this.pushEvent(t, `t=${t}s — ☄️ Bir meteor haritaya çarptı (o bölgede etkilenen canlı yoktu)`);
    }
  }

  // --- İklim/sıcaklık değişimi ---

  private triggerClimate(simTime: number): void {
    const isWarm = Math.random() < 0.5;
    const metabolismMult = isWarm
      ? CLIMATE_METABOLISM_RANGE[1] - Math.random() * 0.1
      : CLIMATE_METABOLISM_RANGE[0] + Math.random() * 0.1;
    const nutrientMult = isWarm
      ? CLIMATE_NUTRIENT_RANGE[1] - Math.random() * 0.15
      : CLIMATE_NUTRIENT_RANGE[0] + Math.random() * 0.15;
    const duration = CLIMATE_DURATION[0] + Math.random() * (CLIMATE_DURATION[1] - CLIMATE_DURATION[0]);

    this.ecosystem.setClimateMetabolismMultiplier(metabolismMult);
    this.ecosystem.setClimateNutrientMultiplier(nutrientMult);
    // Faz X — Atmosfer (TASKS.md): sıcak dalga = hafifçe daha düşük oksijen (gerçek
    // dünyada sıcak suyun daha az çözünmüş oksijen tutması sezgisiyle), soğuk dalga =
    // hafifçe daha yüksek oksijen. Küçük bir ek ofset (bkz. `atmosphere.ts`), süre
    // dolunca `updateActiveEffects` tarafından 0'a geri döndürülüyor.
    this.ecosystem.setAtmosphereClimateOffset(isWarm ? -0.08 : 0.08);
    this.climateActiveTimer = duration;
    this.climateCount++;

    this.addFlash(MAP_WIDTH / 2, MAP_HEIGHT / 2, Math.max(MAP_WIDTH, MAP_HEIGHT) * 0.42, isWarm ? 0xc9542f : 0x3f7fd6);

    const t = Math.round(simTime);
    const label = isWarm ? "Sıcak bir dalga" : "Soğuk bir dalga";
    const effect = isWarm
      ? "metabolizma hızlanıp besin üretimi arttı"
      : "metabolizma yavaşlayıp besin üretimi azaldı";
    this.pushEvent(t, `t=${t}s — 🌡️ ${label} başladı (~${Math.round(duration)}s sürecek), ${effect}`);
  }

  // --- Rüzgar ---

  private triggerWind(simTime: number): void {
    const angle = Math.random() * Math.PI * 2;
    const strength = WIND_STRENGTH[0] + Math.random() * (WIND_STRENGTH[1] - WIND_STRENGTH[0]);
    const duration = WIND_DURATION[0] + Math.random() * (WIND_DURATION[1] - WIND_DURATION[0]);
    const vx = Math.cos(angle) * strength;
    const vy = Math.sin(angle) * strength;

    this.ecosystem.setWind(vx, vy);
    this.windActiveTimer = duration;
    this.windCount++;

    // Şematik gösterge: haritanın bir kenarında rüzgar yönünü gösteren kısa bir ok/çizgi
    // yerine (v3'ün "gösterişli değil" ilkesiyle tutarlı) basit bir ince flaş yeterli.
    this.addFlash(MAP_WIDTH / 2, MAP_HEIGHT / 2, 30, 0x9fd6c8);

    const t = Math.round(simTime);
    const compass = this.compassLabel(angle);
    this.pushEvent(t, `t=${t}s — 💨 ${compass} yönünden bir rüzgar esiyor (~${Math.round(duration)}s), canlıların hareketi hafifçe sapıyor`);
  }

  private compassLabel(angle: number): string {
    const deg = ((angle * 180) / Math.PI + 360) % 360;
    const dirs = ["Doğu", "Güneydoğu", "Güney", "Güneybatı", "Batı", "Kuzeybatı", "Kuzey", "Kuzeydoğu"];
    const idx = Math.round(deg / 45) % 8;
    return dirs[idx];
  }

  // --- Deprem ---

  private triggerQuake(simTime: number): void {
    const x = Math.random() * MAP_WIDTH;
    const y = Math.random() * MAP_HEIGHT;
    const radius = QUAKE_RADIUS[0] + Math.random() * (QUAKE_RADIUS[1] - QUAKE_RADIUS[0]);
    const duration = QUAKE_DURATION[0] + Math.random() * (QUAKE_DURATION[1] - QUAKE_DURATION[0]);
    const wasWater = this.world.isWater(x, y);

    this.world.applyQuakeOverride(x, y, radius, !wasWater);
    this.quakeRegionActive = true;
    this.quakeActiveTimer = duration;
    this.quakeCount++;

    this.addFlash(x, y, radius, 0x8a6f4a);

    const t = Math.round(simTime);
    const change = wasWater ? "küçük bir kara parçası su altında kaldı" : "küçük bir alan geçici olarak su altında kaldı";
    this.pushEvent(t, `t=${t}s — 🌍 Lokal bir deprem oldu, ${change} (~${Math.round(duration)}s sürecek)`);
  }

  // --- Test/doğrulama amaçlı sayaçlar ---

  public getEventCounts(): { meteor: number; climate: number; wind: number; quake: number } {
    return { meteor: this.meteorCount, climate: this.climateCount, wind: this.windCount, quake: this.quakeCount };
  }

  public getActiveState(): {
    climateActive: boolean;
    windActive: boolean;
    quakeActive: boolean;
  } {
    return {
      climateActive: this.climateActiveTimer > 0,
      windActive: this.windActiveTimer > 0,
      quakeActive: this.quakeActiveTimer > 0,
    };
  }

  /** Faz XII madde 2 — manuel doğa olayı tetikleme (HUD butonu, `main.ts`
   *  `onTriggerSpecificEvent`/`onTriggerRandomEvent`); test scriptleri de aynı yolu
   *  kullanıyor. Bug-avı düzeltmesi (2026-09-10, PM onaylı, tester 62'nin manuel/
   *  otomatik tetikleme tutarsızlığı bulgusu): `updateChecks`'teki OTOMATİK
   *  tetikleme climate/wind/quake için "zaten aktifse yeni bir tane tetikleme"
   *  koruması uyguluyordu (`if (this.xActiveTimer <= 0 && ...)`) ama manuel yol bu
   *  korumayı HİÇ paylaşmıyordu — art arda iki manuel tetikleme (örn. deprem
   *  üstüne deprem) ikincisi birincinin süresini/etkisini SESSİZCE EZİYORDU: (1)
   *  climate/wind için `*ActiveTimer` yeni süreye sıfırlanıyor, ilk olayın event
   *  log'da vaat ettiği "~Xs sürecek" süresi yanlış hale geliyordu; (2) deprem için
   *  daha ciddi — `world.ts`'teki `quakeOverrides` birden fazla bölgeyi DESTEKLEYEN
   *  bir dizi ama `WorldEventManager`'da TEK bir `quakeActiveTimer` vardı, ikinci
   *  tetiklemede ilk depremin bölgesi world.ts'te kalırken timer ikincinin süresine
   *  sıfırlanıyordu (kalıcı sızıntı yok, `clearQuakeOverrides` ikisini de temizliyor,
   *  ama süre-doğruluğu bozuluyordu). Düzeltme: meteor DIŞINDAKİ (meteor anlık, bir
   *  "aktif" durumu yok) üç tip için aynı "zaten aktifse" korumasını burada da
   *  uyguluyoruz — engellenirse SESSİZCE yok sayılmıyor, mevcut event-log/şeffaflık
   *  desenine uygun kısa bir "zaten aktif, bekleyin" mesajı düşüyor. Bu koruma
   *  sayesinde deprem için ayrı bir per-bölge zamanlayıcı sistemine GEREK KALMADI
   *  (basit koruma zaten çakışmayı engelliyor, gereksiz karmaşıklık eklenmedi). */
  public forceTrigger(kind: "meteor" | "climate" | "wind" | "quake", simTime: number): void {
    if (kind === "meteor") {
      this.triggerMeteor(simTime);
      return;
    }
    const alreadyActive =
      (kind === "climate" && this.climateActiveTimer > 0) ||
      (kind === "wind" && this.windActiveTimer > 0) ||
      (kind === "quake" && this.quakeActiveTimer > 0);
    if (alreadyActive) {
      const label = kind === "climate" ? "İklim dalgası" : kind === "wind" ? "Rüzgar" : "Deprem etkisi";
      const t = Math.round(simTime);
      this.pushEvent(t, `t=${t}s — ${label} zaten aktif, bitmesi bekleniyor (yeni tetikleme atlandı)`);
      return;
    }
    if (kind === "climate") this.triggerClimate(simTime);
    else if (kind === "wind") this.triggerWind(simTime);
    else this.triggerQuake(simTime);
  }

  public destroy(): void {
    for (const f of this.flashes) {
      this.stage.removeChild(f);
      f.destroy();
    }
    this.flashes = [];
  }
}
