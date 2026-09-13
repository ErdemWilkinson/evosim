/**
 * Faz I (v3) — Minimal dashboard. v2'nin sekmeli/D3'lü çok panelli dashboard'u
 * TAMAMEN kaldırıldı (TASKS.md v3 — "Arayüz — Minimal Menü"). Yeni panel sadece:
 * - Temel sayılar (popülasyon, nesil, zaman, dünya su/kara %).
 * - Boş bir "evrim olay akışı" (event log) listesi — Faz III'te gerçek, eşik tabanlı
 *   olaylarla dolacak; bu fazda placeholder metniyle boş duruyor.
 * Karmaşık sekme/grafik YOK.
 */
import { OrganType, OrganCategory, ORGAN_DEFINITIONS } from "./organs";
import { OrganPrevalenceTrend } from "./ecosystem";

/**
 * Faz XII (v3) — Manuel kontroller (TASKS.md):
 * 1) Besin üretim oranı çarpanı (+/- kontrol) — Detaylar bölmesine eklendi.
 * 2) Manuel doğa olayı tetikleme butonu.
 * 3) Doğa olaylarını durdurma toggle'ı.
 * v3'ün "minimal menü" ilkesine uygun olarak yeni bir panel AÇILMIYOR — mevcut,
 * varsayılan-kapalı "▾ Detaylar" açılır bölmesine (Faz XI'de tanıtıldı) küçük bir
 * kontrol satırı olarak ekleniyor. `main.ts` gerçek mantığı (Ecosystem/WorldEventManager
 * çağrıları) callback'ler üzerinden buraya bağlıyor — Hud kendisi simülasyon durumunu
 * bilmiyor, sadece DOM/etkileşim sorumluluğu taşıyor (mevcut ayrım korunuyor).
 */
export interface ManualControlsHandlers {
  onNutrientRateChange: (multiplier: number) => void;
  onTriggerRandomEvent: () => void;
  onTriggerSpecificEvent: (kind: "meteor" | "climate" | "wind" | "quake") => void;
  onToggleWorldEvents: (enabled: boolean) => void;
}

/** Faz V — Canlı inceleme paneli için Hud'un beklediği sade veri şekli (Creature'ın
 *  kendi `getInspectionSummary`'sinden türetiliyor, main.ts üzerinden). */
export interface InspectionData {
  id: number;
  generation: number;
  age: number;
  energy: number;
  maxEnergy: number;
  moveSpeed: number;
  senseRadius: number;
  onLand: boolean;
  canWalkOnLand: boolean;
  /** Faz XI — organ trend oku (opsiyonel — verilmezse hiçbir ok gösterilmez, bkz.
   *  `main.ts` `showInspectorWithTrend`). */
  organs: { type: OrganType; label: string; power: number; description: string; trend?: OrganPrevalenceTrend }[];
  /** Faz IX — Diyet sistemi (TASKS.md madde 3). */
  diet: "herbivore" | "carnivore";
  /** Faz XVII Madde 2 — Sürü davranışı (TASKS.md): sadece etçillerde anlamlı. */
  packHunter: boolean;
  /** Faz IX — Etoloji (TASKS.md madde 4). */
  behaviorState: "wander" | "seek" | "flee" | "hunt";
}

/**
 * Kullanıcı isteği (2026-09-10, PM onaylı) — "Plague Inc tarzı" canlı diyagramı:
 * inceleme panelindeki metin-ağırlıklı organ listesinin yanına, canlının şematik bir
 * gövde şeklini + SAHİP OLDUĞU organları temsil eden ikonları gösteren bir SVG eklenir.
 * Bu TAMAMEN görsel bir eklenti — hiçbir mekanik DEĞİŞMEDİ, gösterilen her ikon gerçekten
 * `InspectionData.organs`'ta bulunan bir organa karşılık gelir (uydurma yok, TASKS.md
 * ilkesi). Anatomik kesinlik hedeflenmiyor: her `OrganCategory` gövde etrafında sabit bir
 * "bölgeye" (üst=algı, sağ/ön=beslenme, kenarlar=hareket, halka=savunma) atanır, aynı
 * kategoride birden fazla organ varsa o bölge içinde eşit açıyla dağıtılır — `organs.ts`
 * `slotAngle` ile aynı ruhta ama SVG/DOM uzayında, Pixi'nin `Graphics.draw` fonksiyonlarına
 * bağımlı olmadan (onlar canvas-sahne çizimi için, burası ayrı bir HTML paneli).
 */
const CATEGORY_ZONE: Record<OrganCategory, { angle: number; spread: number; color: string }> = {
  // Üst yarım daire — "baş/algı bölgesi".
  sense: { angle: -90, spread: 70, color: "#e0c341" },
  // Sağ taraf — "ön/beslenme bölgesi".
  feeding: { angle: 0, spread: 60, color: "#e0743f" },
  // Alt yarım daire — "hareket organları" (bacak/yüzgeç/kanat aşağı-yanlara dağılır).
  movement: { angle: 105, spread: 150, color: "#3fa7d6" },
  // Sol taraf — "savunma/hayatta kalma bölgesi".
  defense: { angle: 180, spread: 60, color: "#8a6fd6" },
};

function polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
}

/** Kategori başına tek, sade bir glif (harf) — ikon setinden ayrı illüstrasyon
 *  gerektirmeden kategoriyi hızlıca ayırt etmeye yeter (hover/title zaten tam organ
 *  adını/açıklamasını veriyor, bkz. `buildCreatureDiagram`). */
function organCategoryGlyph(category: OrganCategory): string {
  switch (category) {
    case "movement":
      return "▶";
    case "sense":
      return "◎";
    case "feeding":
      return "◇";
    case "defense":
      return "◆";
  }
}

export class Hud {
  private readonly statsEl: HTMLElement;
  private readonly eventLogEl: HTMLElement;
  private readonly inspectorPanelEl: HTMLElement;
  private readonly inspectorBodyEl: HTMLElement;
  private readonly inspectorCloseEl: HTMLElement;
  private manualControlsHandlers: ManualControlsHandlers | null = null;
  private nutrientMultiplier = 1;
  private worldEventsEnabled = true;

  constructor() {
    const statsEl = document.getElementById("stats-panel");
    const eventLogEl = document.getElementById("event-log-list");
    const inspectorPanelEl = document.getElementById("inspector-panel");
    const inspectorBodyEl = document.getElementById("inspector-body");
    const inspectorCloseEl = document.getElementById("inspector-close");
    if (!statsEl || !eventLogEl || !inspectorPanelEl || !inspectorBodyEl || !inspectorCloseEl) {
      throw new Error(
        "Dashboard DOM elemanları bulunamadı (#stats-panel/#event-log-list/#inspector-panel)"
      );
    }
    this.statsEl = statsEl;
    this.eventLogEl = eventLogEl;
    this.inspectorPanelEl = inspectorPanelEl;
    this.inspectorBodyEl = inspectorBodyEl;
    this.inspectorCloseEl = inspectorCloseEl;

    this.inspectorCloseEl.addEventListener("click", () => this.hideInspector());
  }

  /** Faz XII — Manuel kontrolleri (besin oranı/olay tetikleme/olay durdurma)
   *  `main.ts`'teki gerçek Ecosystem/WorldEventManager çağrılarına bağlar. Detaylar
   *  bölmesi DOM'u ilk `updateStats` çağrısında kurulacağı için bu çağrı `updateStats`'ten
   *  ÖNCE de yapılabilir — DOM elemanları o an mevcut değilse `updateStats` içindeki
   *  ilk kurulum sırasında event listener'lar zaten bu handler'ları kullanacak. */
  public setManualControlsHandlers(handlers: ManualControlsHandlers): void {
    this.manualControlsHandlers = handlers;
    // Detaylar bölmesi zaten kurulmuşsa (updateStats daha önce çağrıldıysa) hemen bağla.
    this.wireManualControls();
  }

  private static readonly NUTRIENT_STEP = 0.25;
  private static readonly NUTRIENT_MIN = 0.25;
  private static readonly NUTRIENT_MAX = 3;

  private wireManualControls(): void {
    if (!this.manualControlsHandlers) return;
    const handlers = this.manualControlsHandlers;

    const rateLabel = document.getElementById("nutrient-rate-value");
    const decBtn = document.getElementById("nutrient-rate-dec");
    const incBtn = document.getElementById("nutrient-rate-inc");
    if (rateLabel) rateLabel.textContent = `${this.nutrientMultiplier.toFixed(2)}x`;
    if (decBtn && !decBtn.dataset.wired) {
      decBtn.dataset.wired = "1";
      decBtn.addEventListener("click", () => {
        this.nutrientMultiplier = Math.max(Hud.NUTRIENT_MIN, Number((this.nutrientMultiplier - Hud.NUTRIENT_STEP).toFixed(2)));
        handlers.onNutrientRateChange(this.nutrientMultiplier);
        const label = document.getElementById("nutrient-rate-value");
        if (label) label.textContent = `${this.nutrientMultiplier.toFixed(2)}x`;
      });
    }
    if (incBtn && !incBtn.dataset.wired) {
      incBtn.dataset.wired = "1";
      incBtn.addEventListener("click", () => {
        this.nutrientMultiplier = Math.min(Hud.NUTRIENT_MAX, Number((this.nutrientMultiplier + Hud.NUTRIENT_STEP).toFixed(2)));
        handlers.onNutrientRateChange(this.nutrientMultiplier);
        const label = document.getElementById("nutrient-rate-value");
        if (label) label.textContent = `${this.nutrientMultiplier.toFixed(2)}x`;
      });
    }

    const eventSelect = document.getElementById("world-event-select") as HTMLSelectElement | null;
    const triggerBtn = document.getElementById("world-event-trigger-btn");
    if (triggerBtn && !triggerBtn.dataset.wired) {
      triggerBtn.dataset.wired = "1";
      triggerBtn.addEventListener("click", () => {
        const value = eventSelect?.value ?? "random";
        if (value === "random") handlers.onTriggerRandomEvent();
        else handlers.onTriggerSpecificEvent(value as "meteor" | "climate" | "wind" | "quake");
      });
    }

    const toggleBtn = document.getElementById("world-event-toggle-btn");
    if (toggleBtn && !toggleBtn.dataset.wired) {
      toggleBtn.dataset.wired = "1";
      toggleBtn.textContent = this.worldEventsEnabled ? "⏸️ Doğa Olaylarını Durdur" : "▶️ Doğa Olaylarını Başlat";
      toggleBtn.addEventListener("click", () => {
        this.worldEventsEnabled = !this.worldEventsEnabled;
        handlers.onToggleWorldEvents(this.worldEventsEnabled);
        toggleBtn.textContent = this.worldEventsEnabled ? "⏸️ Doğa Olaylarını Durdur" : "▶️ Doğa Olaylarını Başlat";
      });
    }
  }

  /** Faz XI — organ trend oku: `insufficient-data` bilerek boş string döner (hiçbir
   *  ok gösterilmez) — henüz yeterli veri yokken sahte bir "stabil" iddiası yok. */
  private static readonly TREND_SYMBOLS: Record<OrganPrevalenceTrend, string> = {
    up: " <span class=\"inspector-organ-trend inspector-organ-trend-up\" title=\"Popülasyonda yayılıyor\">↑</span>",
    down: " <span class=\"inspector-organ-trend inspector-organ-trend-down\" title=\"Popülasyonda azalıyor\">↓</span>",
    stable: " <span class=\"inspector-organ-trend inspector-organ-trend-stable\" title=\"Popülasyonda stabil\">—</span>",
    "insufficient-data": "",
  };

  private static readonly BEHAVIOR_LABELS: Record<InspectionData["behaviorState"], string> = {
    wander: "Geziniyor",
    seek: "Besin arıyor",
    flee: "Kaçıyor 🏃",
    hunt: "Avlıyor 🍽️",
  };

  /** Kullanıcı isteği (2026-09-10) — şematik canlı diyagramı (bkz. dosya başı yorumu).
   *  Bug düzeltmesi (2026-09-11, kullanıcı raporu + PM onayı): önceden sadece
   *  `showInspector`'da (canlı birey) kullanılıyordu — kullanıcı soy ağacından
   *  ölü bir birey seçtiğinde diyagramı hiç görmüyordu, bu da "diyagram
   *  görünmüyor" şikayetine yol açtı. Artık `showDeceasedInspector` da aynı
   *  diyagramı çağırıyor; ölü kayıtlarda diyet bilgisi tutulmadığından (bkz.
   *  `LineageRecord`) `diet` parametresi NULLABLE — null verilirse gövde
   *  otçul/etçil rengi yerine nötr bir gri ton kullanır (organ ikonlarının
   *  renk/konumunu ETKİLEMEZ, sadece gövde dolgu rengini). En son kazanılan
   *  organ (`organs[organs.length-1]` — `lineagetree.ts` `dominantOrganType`
   *  ile AYNI, zaten belgelenmiş kural, TASKS.md 2026-09-10 bug-avı turu)
   *  hafif bir "pulse" animasyonuyla öne çıkarılır. */
  private static buildCreatureDiagram(
    organs: { type: OrganType; label: string; description: string }[],
    diet: "herbivore" | "carnivore" | null
  ): string {
    const size = 140;
    const cx = size / 2;
    const cy = size / 2;
    const bodyR = 30;
    const bodyColor = diet === "carnivore" ? "#b5433f" : diet === "herbivore" ? "#4f8ff0" : "#8a8f98";
    const mostRecentType = organs.length > 0 ? organs[organs.length - 1].type : null;

    const byCategory = new Map<OrganCategory, typeof organs>();
    for (const o of organs) {
      const category = ORGAN_DEFINITIONS[o.type].category;
      const list = byCategory.get(category) ?? [];
      list.push(o);
      byCategory.set(category, list);
    }

    let iconsSvg = "";
    for (const [category, list] of byCategory) {
      const zone = CATEGORY_ZONE[category];
      list.forEach((organ, i) => {
        const angle =
          list.length > 1 ? zone.angle - zone.spread / 2 + (i / (list.length - 1)) * zone.spread : zone.angle;
        const iconPos = polar(cx, cy, bodyR + 16, angle);
        const isNewest = organ.type === mostRecentType;
        const pulseClass = isNewest ? " creature-diagram-icon-pulse" : "";
        iconsSvg += `
          <g class="creature-diagram-icon${pulseClass}" transform="translate(${iconPos.x},${iconPos.y})">
            <title>${organ.label} — ${organ.description}</title>
            <circle r="9" fill="${zone.color}" fill-opacity="0.22" stroke="${zone.color}" stroke-opacity="0.85" stroke-width="1.5"></circle>
            <text x="0" y="3.5" text-anchor="middle" font-size="9" fill="${zone.color}">${organCategoryGlyph(category)}</text>
          </g>`;
      });
    }

    return `
      <svg class="creature-diagram" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Canlı organ şeması">
        <circle cx="${cx}" cy="${cy}" r="${bodyR}" fill="${bodyColor}" fill-opacity="0.25" stroke="${bodyColor}" stroke-width="2"></circle>
        ${iconsSvg}
      </svg>`;
  }

  /** Faz V — Canlı inceleme paneli (TASKS.md): tıklanan bireyin özetini gösterir.
   *  Minimal/sade bir yan kutu — v2'nin karmaşık modal/dashboard'una dönüşmüyor.
   *  Faz IX: diyet (madde 3) ve davranış durumu (madde 4) satırları + soy analizi
   *  butonu (madde 7, `onAnalyzeLineage` verilirse gösterilir) eklendi. */
  public showInspector(data: InspectionData, onAnalyzeLineage?: () => void): void {
    this.inspectorPanelEl.hidden = false;

    const organsHtml =
      data.organs.length > 0
        ? data.organs
            .map(
              (o) =>
                `<div class="inspector-organ-row"><span class="inspector-organ-chip">${o.label} <b>${o.power.toFixed(2)}</b>${o.trend ? Hud.TREND_SYMBOLS[o.trend] : ""}</span><div class="inspector-organ-desc">${o.description}</div></div>`
            )
            .join("")
        : `<div class="inspector-empty">Organsız (mikroorganizma)</div>`;

    const dietLabel =
      data.diet === "carnivore"
        ? data.packHunter
          ? "Etçil 🍽️ (Sürü Avcısı 🐺)"
          : "Etçil 🍽️"
        : "Otçul 🌱";
    const behaviorLabel = Hud.BEHAVIOR_LABELS[data.behaviorState];
    const diagramSvg = Hud.buildCreatureDiagram(data.organs, data.diet);

    this.inspectorBodyEl.innerHTML = `
      <div class="creature-diagram-wrap">${diagramSvg}</div>
      <div class="inspector-row"><span class="inspector-row-label">ID</span><span class="inspector-row-value">#${data.id}</span></div>
      <div class="inspector-row"><span class="inspector-row-label">Nesil</span><span class="inspector-row-value">${data.generation}</span></div>
      <div class="inspector-row"><span class="inspector-row-label">Yaş</span><span class="inspector-row-value">${data.age.toFixed(1)}s</span></div>
      <div class="inspector-row"><span class="inspector-row-label">Enerji</span><span class="inspector-row-value">${data.energy.toFixed(1)} / ${data.maxEnergy.toFixed(1)}</span></div>
      <div class="inspector-row"><span class="inspector-row-label">Diyet</span><span class="inspector-row-value">${dietLabel}</span></div>
      <div class="inspector-row"><span class="inspector-row-label">Davranış</span><span class="inspector-row-value">${behaviorLabel}</span></div>
      <div class="inspector-row"><span class="inspector-row-label">Hız</span><span class="inspector-row-value">${data.moveSpeed.toFixed(1)} px/s</span></div>
      <div class="inspector-row"><span class="inspector-row-label">Algı Menzili</span><span class="inspector-row-value">${data.senseRadius.toFixed(0)} px</span></div>
      <div class="inspector-row"><span class="inspector-row-label">Konum</span><span class="inspector-row-value">${data.onLand ? "Kara" : "Su"}${data.canWalkOnLand ? " (bacaklı)" : ""}</span></div>
      <div class="inspector-organs">
        <div class="inspector-organs-title">Organlar</div>
        ${organsHtml}
      </div>
      ${onAnalyzeLineage ? `<button id="inspector-analyze-btn" class="ctrl-btn-danger inspector-analyze-btn" type="button">Bu soyu analiz et 🔬</button>
      <div id="inspector-analyze-result" class="inspector-analyze-result" hidden></div>` : ""}
    `;

    if (onAnalyzeLineage) {
      const btn = document.getElementById("inspector-analyze-btn");
      btn?.addEventListener("click", () => onAnalyzeLineage());
    }
  }

  /** Faz IX — Soy ağacından ölü bir birey seçildiğinde (TASKS.md madde 6): canlı
   *  inceleme panelinden farklı, ölü bir bireyin temel bilgilerini + (varsa) evrim
   *  geçmişi listesini gösterir. Aynı panel DOM elemanı yeniden kullanılıyor (v3'ün
   *  "tek panel" minimal diline uygun, ayrı bir modal/dashboard AÇILMIYOR). */
  public showDeceasedInspector(data: {
    id: number;
    generation: number;
    lifespan: number | null;
    organs: { type: OrganType; label: string; power: number; description: string }[];
    offspringCount: number;
    evolutionHistory: { generation: number; label: string }[];
  }, onAnalyzeLineage?: () => void): void {
    this.inspectorPanelEl.hidden = false;

    const organsHtml =
      data.organs.length > 0
        ? data.organs
            .map(
              (o) =>
                `<div class="inspector-organ-row"><span class="inspector-organ-chip">${o.label} <b>${o.power.toFixed(2)}</b></span><div class="inspector-organ-desc">${o.description}</div></div>`
            )
            .join("")
        : `<div class="inspector-empty">Organsız (mikroorganizma)</div>`;

    const historyHtml =
      data.evolutionHistory.length > 0
        ? `<ul class="inspector-history-list">${data.evolutionHistory
            .map((h) => `<li>Nesil ${h.generation}: ${h.label} kazanıldı</li>`)
            .join("")}</ul>`
        : `<div class="inspector-empty">Bilinen bir organ kazanım olayı yok.</div>`;

    const diagramSvg = Hud.buildCreatureDiagram(data.organs, null);

    this.inspectorBodyEl.innerHTML = `
      <div class="creature-diagram-wrap">${diagramSvg}</div>
      <div class="inspector-row"><span class="inspector-row-label">ID</span><span class="inspector-row-value">#${data.id} 💀</span></div>
      <div class="inspector-row"><span class="inspector-row-label">Nesil</span><span class="inspector-row-value">${data.generation}</span></div>
      <div class="inspector-row"><span class="inspector-row-label">Yaşam Süresi</span><span class="inspector-row-value">${data.lifespan !== null ? data.lifespan.toFixed(1) + "s" : "bilinmiyor"}</span></div>
      <div class="inspector-row"><span class="inspector-row-label">Yavru Sayısı</span><span class="inspector-row-value">${data.offspringCount}</span></div>
      <div class="inspector-organs">
        <div class="inspector-organs-title">Organlar (ölüm anında)</div>
        ${organsHtml}
      </div>
      <div class="inspector-organs">
        <div class="inspector-organs-title">Evrim Geçmişi (soy hattı)</div>
        ${historyHtml}
      </div>
      ${onAnalyzeLineage ? `<button id="inspector-analyze-btn" class="ctrl-btn-danger inspector-analyze-btn" type="button">Bu soyu analiz et 🔬</button>
      <div id="inspector-analyze-result" class="inspector-analyze-result" hidden></div>` : ""}
    `;

    if (onAnalyzeLineage) {
      const btn = document.getElementById("inspector-analyze-btn");
      btn?.addEventListener("click", () => onAnalyzeLineage());
    }
  }

  /** Faz IX — Gemini soy analizi sonucu/hata mesajını inceleme panelindeki küçük
   *  alt bölgeye yazar (yeni bir panel/modal AÇMIYOR, mevcut panelin bir parçası). */
  public setLineageAnalysisResult(text: string, isError = false): void {
    const el = document.getElementById("inspector-analyze-result");
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
    el.classList.toggle("inspector-analyze-error", isError);
  }

  public setLineageAnalysisLoading(): void {
    const el = document.getElementById("inspector-analyze-result");
    if (!el) return;
    el.hidden = false;
    el.classList.remove("inspector-analyze-error");
    el.textContent = "Gemini'den analiz isteniyor…";
  }

  public hideInspector(): void {
    this.inspectorPanelEl.hidden = true;
  }

  /**
   * Faz XI — UI/UX sadeleştirme (TASKS.md): v3'ün "minimal menü" ilkesi zamanla
   * aşınmıştı — Dünya/Diyet/Atmosfer satırları ana istatistik ızgarasıyla aynı görsel
   * ağırlıkta, sürekli açık duruyordu (bkz. TASKS.md Faz XI günlüğü, ekran görüntüsü
   * kanıtı). Bunlar İKİNCİL bilgi (birincil: Popülasyon/Zaman/Nesil/Toplam Bölünme) —
   * artık ayrı, varsayılan olarak KAPALI bir `<details>` açılır-kapanır alt bölmesine
   * taşındı ("Detaylar ▾"). Fonksiyonellik/veri AYNI, sadece görünürlük/hiyerarşi
   * değişti — hiçbir bilgi kaldırılmadı.
   */
  public updateStats(stats: {
    population: number;
    maxGeneration: number;
    historicalMaxGeneration: number;
    totalBirths: number;
    simTimeSeconds: number;
    waterPercent: number;
    /** Faz IX — Diyet sistemi (TASKS.md madde 3): sade özet göstergesi. */
    herbivoreCount: number;
    carnivoreCount: number;
    /** Faz X — Atmosfer/oksijen seviyesi (TASKS.md madde 3), 0..1. */
    oxygenLevel: number;
  }): void {
    const t = Math.round(stats.simTimeSeconds);
    const oxygenPct = Math.round(stats.oxygenLevel * 100);

    // İlk çağrıda iskeleti bir kere kur (details açık/kapalı durumu her güncellemede
    // sıfırlanmasın diye) — sonraki çağrılarda sadece değer hücrelerini güncelle.
    if (!this.statsEl.querySelector(".stat-primary-grid")) {
      this.statsEl.innerHTML = `
        <div class="stat-primary-grid">
          <div class="stat-cell">
            <span class="stat-label">Popülasyon</span>
            <span class="stat-value" data-stat="population"></span>
          </div>
          <div class="stat-cell">
            <span class="stat-label">Zaman</span>
            <span class="stat-value" data-stat="time"></span>
          </div>
          <div class="stat-cell">
            <span class="stat-label">Nesil</span>
            <span class="stat-value" data-stat="generation"></span>
          </div>
          <div class="stat-cell">
            <span class="stat-label">Toplam Bölünme</span>
            <span class="stat-value" data-stat="births"></span>
          </div>
        </div>
        <details class="stat-details">
          <summary class="stat-details-summary">Detaylar</summary>
          <div class="stat-details-body">
            <div class="stat-cell stat-cell-wide">
              <span class="stat-label">Dünya</span>
              <span class="stat-value" data-stat="world"></span>
            </div>
            <div class="stat-cell stat-cell-wide">
              <span class="stat-label">Diyet</span>
              <span class="stat-value" data-stat="diet"></span>
            </div>
            <div class="stat-cell stat-cell-wide">
              <span class="stat-label">Atmosfer 💨</span>
              <span class="stat-value" data-stat="atmosphere"></span>
            </div>
          </div>
          <div class="stat-controls-row">
            <span class="stat-label">Besin Oranı</span>
            <button id="nutrient-rate-dec" class="ctrl-btn-mini" type="button" title="Besin üretimini azalt">−</button>
            <span id="nutrient-rate-value" class="stat-controls-value">1.00x</span>
            <button id="nutrient-rate-inc" class="ctrl-btn-mini" type="button" title="Besin üretimini artır">+</button>
          </div>
          <div class="stat-controls-row">
            <span class="stat-label">Dünya Olayı</span>
            <select id="world-event-select" class="lineage-filter-select" title="Tetiklenecek olay">
              <option value="random">Rastgele</option>
              <option value="meteor">☄️ Meteor</option>
              <option value="climate">🌡️ İklim</option>
              <option value="wind">💨 Rüzgar</option>
              <option value="quake">🌍 Deprem</option>
            </select>
            <button id="world-event-trigger-btn" class="ctrl-btn-mini" type="button" title="Seçili olayı hemen tetikle">Tetikle</button>
          </div>
          <div class="stat-controls-row">
            <button id="world-event-toggle-btn" class="ctrl-btn-mini stat-controls-toggle" type="button">⏸️ Doğa Olaylarını Durdur</button>
          </div>
        </details>
      `;
      this.wireManualControls();
    }

    const set = (name: string, html: string) => {
      const el = this.statsEl.querySelector(`[data-stat="${name}"]`);
      if (el) el.innerHTML = html;
    };
    set("population", String(stats.population));
    set("time", `${t}s`);
    set("generation", `${stats.maxGeneration} <span class="stat-sub">(${stats.historicalMaxGeneration})</span>`);
    set("births", String(stats.totalBirths));
    set("world", `%${Math.round(stats.waterPercent)} su / %${Math.round(100 - stats.waterPercent)} kara`);
    set("diet", `🌱 ${stats.herbivoreCount} / 🍽️ ${stats.carnivoreCount}`);
    set("atmosphere", `Oksijen %${oxygenPct}`);
  }

  /**
   * Faz III (v3) — Evrim olay akışına yeni bir satır ekler. `Ecosystem`'in eşik
   * tabanlı olarak tespit ettiği gerçek olaylar (`main.ts` üzerinden) buraya düşer.
   * En yeni olay listenin ÜSTÜNDE görünür (prepend); liste çok uzarsa (TASKS.md —
   * "son 20-30 olayla sınırlı kalsın") en eski satırlar budanır.
   */
  private static readonly MAX_EVENTS = 30;

  /** `isInsight=true` — Faz V Gemini derin analiz yorumu (farklı görsel işaret/stil,
   *  TASKS.md — "🔬 ile ekle"); `false` — Faz III'ün eşik-tabanlı normal olayı. */
  public pushEvent(text: string, isInsight = false): void {
    const placeholder = this.eventLogEl.querySelector(".event-log-placeholder");
    if (placeholder) placeholder.remove();

    const item = document.createElement("li");
    item.className = isInsight ? "event-log-item event-log-item-insight" : "event-log-item";
    item.textContent = isInsight ? `🔬 ${text}` : text;
    this.eventLogEl.prepend(item);

    while (this.eventLogEl.children.length > Hud.MAX_EVENTS) {
      this.eventLogEl.lastElementChild?.remove();
    }
  }
}
