import { LineageRecord, LineageSummaryNode } from "./ecosystem";
import { OrganCategory, OrganType, ORGAN_DEFINITIONS } from "./organs";

/**
 * Faz VI (v3) — Soy ağacı grafiği (TASKS.md): tüm popülasyonun soy ağacını (kim
 * kimden türedi) gösteren bir görsel. v2'de D3 ile yapılmış ama "çok karmaşık"
 * bulunup kaldırılmıştı — bu sefer VARSAYILAN OLARAK KAPALI, küçük bir toggle
 * butonuyla açılıp kapanan bir overlay panel (sürekli görünür bir dashboard DEĞİL).
 *
 * D3 yeniden eklemek yerine düz bir `<canvas>` çizimi tercih edildi: veri yapısı
 * basit bir orman (her düğümün en fazla bir ebeveyni var, `divideGenome` aseksüel
 * bölünme — bkz. genome.ts `parentIds: [parent.id, parent.id]`), bu kadar basit bir
 * ağaç için ekstra bir grafik kütüphanesi gerekmiyor (TASKS.md: "D3 kullanılabilir...
 * veya basit bir Canvas/SVG çizimi yeterli olabilir, coder karar versin").
 *
 * Gösterim: nesile göre satırlara ayrılmış düğümler (x: doğum sırası, y: nesil),
 * her düğümden ebeveynine ince bir çizgi. Ölü bireyler soluk/gri, canlılar diyete
 * göre renklendirilir; kenarlık/nokta ana organ tipini yansıtır (Faz XII madde 5).
 *
 * Faz XII — BUG düzeltmesi (TASKS.md madde 4, öncelikli): kök neden gerçek verilerle
 * (500 kayda kadar `MAX_LINEAGE_RECORDS`, sabit 520x380px panel) doğrulandı — önceki
 * sürüm TÜM `LineageRecord`'ları sabit `usableWidth` (~488px) içine sıkıştırıyordu.
 * Bir nesilde onlarca/yüzlerce birey birikince düğüm başına düşen yatay boşluk sabit
 * 3px yarıçap + click-tolerance'ın (r+4≈7px) çok altına düşüyor, düğümler üst üste
 * biniyor ve tıklama isabet testi (`nodePositions` üzerinde en-yakın-düğüm araması)
 * yanlış/komşu bir düğümü seçiyordu — TIKLANAMIYORDU denen davranışın gerçek nedeni.
 * Doğrulama: 80 kayıtlık sentetik bir soy ağacı (8 nesil x 10 birey) sabit 520x380
 * canvas'a çizilip düğüm aralığı ölçüldü — satır başına ortalama düğüm aralığı
 * ~54px (10 düğüm/satır) iken 40 birey/satıra çıkınca ~12px'e düşüyor, click
 * tolerance'ın (7px) İKİ KATINDAN AZ kalıyor (komşu düğümler isabet alanları
 * çakışıyor). Düzeltme (iki parça):
 * 1) Minimum düğüm ARALIĞI (`MIN_NODE_SPACING`) sabit tutulup canvas'ın SANAL
 *    genişliği (bir nesildeki en kalabalık satırın ihtiyacına göre) büyütülüyor —
 *    düğümler asla sıkışıp üst üste binmiyor, panel yatay kaydırma (`overflow-x:
 *    auto`) ile geziliyor. Bu, "görünür düğüm sayısını agresif şekilde sınırlamak"
 *    yerine (kullanıcı büyük ağacı yine de görebilsin) daha az veri kaybına yol açan
 *    bir çözüm; TASKS.md'nin önerdiği alternatiflerden "pan/zoom" ruhuna en yakını.
 * 2) Tıklama isabet testi artık canvas'ın SCROLL pozisyonunu hesaba katıyor (önceki
 *    sürüm sabit canvas boyutuna göre çalışıyordu, kaydırma eklenince koordinatlar
 *    kayardı — bu yeni bir regresyon olurdu, düzeltmeyle birlikte ele alındı).
 * Ayrıca minimum düğüm yarıçapı (`NODE_RADIUS`) ve tıklama toleransı büyütüldü
 * (3px -> 4px gövde, tolerans max(r+4,8) -> max(r+5,10)) — küçük düğümlerde bile
 * makul bir tıklama hedefi kalsın diye.
 *
 * Faz XI adayı — Zoom/pan (bu tur): mevcut kaydırma (scroll) davranışı korunuyor,
 * üzerine fare tekerleği ile zoom (0.5x-3x) eklendi. Yaklaşım: layout (nesil/satır/x
 * pozisyonu) hep "mantıksal" (zoom=1) uzayda hesaplanır, ardından TÜM koordinatlar
 * (düğüm x/y, yarıçap, çizgiler, canvas'ın CSS + fiziksel piksel boyutu) `zoom`
 * faktörüyle çarpılıp asıl çizim buna göre yapılır. `nodePositions` (tıklama isabet
 * testi) bu ÇARPILMIŞ (gerçek/görünen) koordinatlarda saklanıyor — tıklama handler'ı
 * zaten `getBoundingClientRect` ile canvas'ın kendi (görünen) client dikdörtgenini
 * kullanıyor, yani zoom'lu haldeyken de ekstra bir dönüşüme gerek kalmadan doğru
 * çalışıyor (canvas görünen boyutu zaten zoom'a göre büyümüş/küçülmüş oluyor).
 * Fare imlecinin altındaki noktayı sabit tutmak için zoom değişince scroll pozisyonu
 * da orantılı olarak güncelleniyor (bkz. `handleWheelZoom`).
 *
 * Faz XVI Madde 1 — Görsel yeniden tasarım (TASKS.md): kullanıcı gözlemi — nesil
 * bazlı satırlar + düz çizgiler "gerçek bir aile ağacı" hissi vermiyordu. Değişenler:
 * 1) Ebeveyn->çocuk bağlantıları artık düz çizgi DEĞİL, YUMUŞAK KÜBİK BEZİER eğrileri
 *    (bkz. `drawParentChildCurve`) — dikey S-eğrisi, klasik genealoji şemalarındaki
 *    "organik" bağlantı hissi. Bir ebeveynin birden fazla çocuğu varsa hepsi AYNI
 *    "çatal noktasından" (ebeveyn merkezinin hemen altında, `FORK_DROP` kadar aşağıda)
 *    çıkıyor — görsel olarak net bir "burada dallandı" izlenimi (önceki tasarımda
 *    tüm çizgiler doğrudan ebeveyn merkezinden çıkıp görsel olarak "saçılma" gibi
 *    görünüyordu, çatallanma noktası yoktu).
 * 2) Faz XVI Madde 1 (geçmiş kaybı): budanan (özetlenen) eski dallar artık TAMAMEN
 *    silinmiyor — `Ecosystem.getLineageSummaries()` bu dalları `LineageSummaryNode`
 *    olarak tutuyor (bkz. ecosystem.ts). Burada her özet düğüm ağacın en üstünde
 *    (nesil ekseninin başında), normal düğümlerden daha BÜYÜK, kare/elmas şekilli,
 *    etiketli bir "sıkıştırılmış geçmiş" düğümü olarak çizilir — gerçek çocuklarına
 *    (varsa) yine bezier eğrisiyle bağlanır, böylece ağaç köksüz/kesik görünmez.
 * Mevcut zoom/pan/tıklama/filtre/organ-rengi mantığı DEĞİŞTİRİLMEDİ — sadece layout
 * (satır yerleşimi artık ata-öncelikli x hizalaması kullanıyor, bkz. `computeXPositions`)
 * ve çizim fonksiyonları güncellendi.
 */

/** Faz XII madde 6 — filtre durumu (main.ts panel dışından da okunabilir hale
 *  getirilmiyor, tamamen LineageTree içinde tutuluyor — "minimal menü" ilkesi
 *  gereği ayrı bir filtre paneli/modalı YOK, mevcut overlay'in içine küçük bir
 *  kontrol satırı eklendi). */
interface LineageFilters {
  diet: "all" | "herbivore" | "carnivore";
  organ: OrganType | "all";
  status: "all" | "alive" | "dead";
  minGeneration: number | null;
  maxGeneration: number | null;
}

/** Faz XII madde 4 — bir nesil satırında düğümler bu değerden daha sık olamaz;
 *  gerekirse canvas'ın sanal genişliği büyütülüp yatay kaydırmayla erişilir. */
const MIN_NODE_SPACING = 14;
const NODE_RADIUS = 4;
const ROW_HEIGHT = 34;
const PADDING = 16;

/** Faz XVII Madde 4 — BUG düzeltmesi (tester bulgusu, Faz XVI): dikey içerik
 *  yüksekliği eskiden `totalRows * ROW_HEIGHT` ile SINIRSIZ büyüyordu — çok uzun,
 *  dallanmayan (düşük çeşitlilikli tek soy, veya çok uzun bir oturumda binlerce
 *  nesil) bir senaryoda canvas onlarca/yüzlerce bin piksel yüksekliğe çıkıp panel
 *  görünümünde tamamen boş/beyaz görünüyordu (içerik görünür viewport'un ÇOK
 *  altında kalıyordu). Düzeltme, genişlik tarafının ZATEN kullandığı desenin
 *  (`MIN_NODE_SPACING` ile taban bir aralık + sabit bir üst sınır) dikey eşdeğeri:
 *  toplam içerik yüksekliği bu sabitle SINIRLANIYOR — nesil sayısı arttıkça satır
 *  yüksekliği (mevcut `rowHeight = (logicalHeight-PADDING*2)/totalRows` formülü
 *  ZATEN bunu otomatik yapıyor, sadece girdisi artık sınırsız değil) orantılı
 *  olarak küçülüyor, ama canvas'ın TOPLAM yüksekliği makul/kaydırılabilir bir
 *  üst sınırın (bu değer) ÜSTÜNE asla çıkmıyor — panel her zaman en azından
 *  BAŞLANGIÇ görünümünde bir şeyler gösteriyor. */
const MAX_CONTENT_HEIGHT = 6000;

/** Faz XI adayı — zoom sınırları ve tekerlek hassasiyeti. */
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

/** Faz XVI Madde 1 — genealoji-tarzı çatallanma: bir ebeveynin tüm çocukları önce
 *  ebeveyn merkezinin `FORK_DROP` px altındaki ORTAK bir "çatal noktasına" iner,
 *  oradan her çocuğa ayrı bir bezier eğrisi çıkar. Bu, "ebeveynden aynı anda birden
 *  fazla çizginin saçıldığı" görünümü yerine net bir "burada dallandı" hissi verir —
 *  klasik aile ağacı şemalarındaki dikey-sonra-dallı bağlantı biçimi. */
const FORK_DROP_RATIO = 0.45; // satır yüksekliğinin bu oranı kadar aşağıda çatallanır
/** Faz XVI Madde 1 — özet düğümler (bkz. ecosystem.ts `LineageSummaryNode`) normal
 *  düğümlerden belirgin şekilde büyük, elmas şeklinde çizilir — "bu tek bir birey
 *  değil, sıkıştırılmış bir grup" ayrımı görsel olarak da net olsun diye. */
const SUMMARY_NODE_RADIUS = 9;

/** Faz XII madde 5 — bir bireyin "ana organ tipi" soy ağacındaki düğüm halka rengini
 *  belirler (kategoriye göre renklendirilir ki dala bakınca hangi organ ailesinin
 *  geliştiğini görsel olarak ayırt etmek mümkün olsun). Bug-avı düzeltmesi (2026-09-10,
 *  PM onaylı, kullanıcı isteği): "ana organ" artık gerçekten EN YÜKSEK `power`'lı organ
 *  (`ecosystem.ts` `computeDominantOrganType`, `LineageRecord.dominantOrganType` olarak
 *  doğum anında bir kez hesaplanıp saklanıyor — `organs: OrganType[]` alanında power
 *  bilgisi olmadığından burada yeniden hesaplanamaz). Eskiden yanlışlıkla "en son
 *  kazanılan organ" kullanılıyordu (yorum "en yüksek power" iddia ediyordu ama kod
 *  öyle davranmıyordu, bkz. TASKS_ARCHIVE.md 2026-09-10 bug-avı bulgusu). */
const CATEGORY_COLORS: Record<OrganCategory, number> = {
  movement: 0x3fa7d6,
  sense: 0xe0c341,
  feeding: 0xe0743f,
  defense: 0x8a6fd6,
};

export class LineageTree {
  private readonly panelEl: HTMLElement;
  private readonly toggleBtn: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly canvasWrapEl: HTMLElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly emptyEl: HTMLElement;
  private readonly filtersEl: HTMLElement;
  private readonly zoomValueEl: HTMLElement | null;
  private visible = false;

  private filters: LineageFilters = {
    diet: "all",
    organ: "all",
    status: "all",
    minGeneration: null,
    maxGeneration: null,
  };

  /** Faz IX — Soy ağacından canlı seçimi (TASKS.md madde 6): son çizimde her düğümün
   *  CSS-piksel (canvas client) koordinatını + yarıçapını saklar, tıklama isabet testi
   *  için kullanılır. Faz XII: canvas artık ebeveyn wrapper içinde kaydırılabilir
   *  olduğundan koordinatlar canvas'ın KENDİ (scroll'dan bağımsız, içerik) uzayında
   *  tutulup tıklama anında `getBoundingClientRect` ile (scroll zaten canvas'ın kendi
   *  boyutunu büyüttüğü için) doğrudan karşılaştırılıyor — ekstra bir scroll-offset
   *  hesaplamasına gerek kalmıyor. */
  private nodePositions: { id: number; x: number; y: number; r: number }[] = [];
  private nodeClickHandler: ((id: number) => void) | null = null;
  private lastRecords: readonly LineageRecord[] = [];
  /** Faz XVI Madde 1 — en son çizimde kullanılan özet düğümler (bkz. ecosystem.ts
   *  `LineageSummaryNode`), zoom/filtre değişince yeniden çizim için saklanıyor. */
  private lastSummaries: readonly LineageSummaryNode[] = [];

  /** Faz XI adayı — zoom seviyesi (1 = normal, mevcut Faz XII davranışıyla aynı). */
  private zoom = 1;

  constructor() {
    const panelEl = document.getElementById("lineage-panel");
    const toggleBtn = document.getElementById("lineage-toggle-btn");
    const canvas = document.getElementById("lineage-canvas") as HTMLCanvasElement | null;
    const canvasWrapEl = document.getElementById("lineage-canvas-wrap");
    const closeBtn = document.getElementById("lineage-close");
    const emptyEl = document.getElementById("lineage-empty");
    const filtersEl = document.getElementById("lineage-filters");
    const zoomInBtn = document.getElementById("lineage-zoom-in");
    const zoomOutBtn = document.getElementById("lineage-zoom-out");
    const zoomResetBtn = document.getElementById("lineage-zoom-reset");
    const zoomValueEl = document.getElementById("lineage-zoom-value");
    if (!panelEl || !toggleBtn || !canvas || !canvasWrapEl || !closeBtn || !emptyEl || !filtersEl) {
      throw new Error(
        "Soy ağacı DOM elemanları bulunamadı (#lineage-panel/#lineage-toggle-btn/#lineage-canvas/#lineage-canvas-wrap/#lineage-filters)"
      );
    }
    this.panelEl = panelEl;
    this.toggleBtn = toggleBtn;
    this.canvas = canvas;
    this.canvasWrapEl = canvasWrapEl;
    this.emptyEl = emptyEl;
    this.filtersEl = filtersEl;
    this.zoomValueEl = zoomValueEl;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Soy ağacı canvas 2d context alınamadı");
    this.ctx = ctx;

    this.toggleBtn.addEventListener("click", () => this.toggle());
    closeBtn.addEventListener("click", () => this.hide());

    // Tester (62) bulgusu (2026-09-10, PM onaylı) — panel artık tam sayfa bir
    // modal (eskiden küçük bir köşe kutusuydu), bu boyutta ESC ile kapatma
    // standart bir kullanıcı beklentisi. `document` üzerinde dinleniyor (panel
    // kapsamındaki hiçbir öğe global bir keydown handler'ına sahip değildi) ama
    // SADECE panel görünürken tetikleniyor (`this.visible` kontrolü) — kapalıyken
    // ESC'nin başka bir şeyi (örn. ileride eklenecek başka bir modal) etkilememesi
    // için. "×" butonuyla AYNI `hide()` yolunu çağırır — iki kapatma yöntemi
    // arasında tutarsızlık yok.
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.visible) this.hide();
    });

    // Kullanıcı isteği (2026-09-10) — fare tekerleğine ek olarak açık +/- butonları
    // (keşfedilebilirlik): mevcut `handleWheelZoom`'un adım büyüklüğünü (ZOOM_STEP)
    // ve sınırlarını (MIN_ZOOM/MAX_ZOOM) aynen kullanan `setZoom` yardımcısına bağlanır.
    zoomInBtn?.addEventListener("click", () => this.setZoom(this.zoom + ZOOM_STEP));
    zoomOutBtn?.addEventListener("click", () => this.setZoom(this.zoom - ZOOM_STEP));
    zoomResetBtn?.addEventListener("click", () => this.resetZoom());
    this.updateZoomLabel();

    this.buildFilterControls();

    // Faz IX — bir düğüme tıklanınca en yakın düğümü bulup callback'i çağırır
    // (isabet toleransı: düğüm yarıçapı + birkaç px, küçük noktalar için makul).
    // Faz XII: canvas artık kaydırmalı bir sarmalayıcı içinde büyüyebiliyor —
    // `getBoundingClientRect` canvas'ın KENDİ (scroll edilmiş) client dikdörtgenini
    // verdiği için tıklama koordinatı hâlâ doğrudan `nodePositions` (canvas içerik
    // uzayı, CSS piksel) ile karşılaştırılabiliyor, ekstra dönüşüm gerekmiyor.
    this.canvas.addEventListener("click", (e) => {
      if (!this.nodeClickHandler || this.nodePositions.length === 0) return;
      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      let best: { id: number; distance: number } | null = null;
      for (const node of this.nodePositions) {
        const distance = Math.hypot(node.x - clickX, node.y - clickY);
        const tolerance = Math.max(node.r + 5, 10);
        if (distance <= tolerance && (!best || distance < best.distance)) {
          best = { id: node.id, distance };
        }
      }
      if (best) this.nodeClickHandler(best.id);
    });

    // Faz XI adayı — fare tekerleği ile zoom. `wheel` varsayılan davranışı (sayfa/
    // sarmalayıcı kaydırması) engellenir ki tekerlek SADECE zoom yapsın (pan hâlâ
    // sürükleme/scrollbar ile mevcut, TASKS.md madde 2 — kaydırma davranışı korunuyor).
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.handleWheelZoom(e);
      },
      { passive: false }
    );

    // Faz XI adayı — isteğe bağlı "sıfırla" (madde 5): çift tıklama zoom'u 1x'e döndürür.
    this.canvas.addEventListener("dblclick", () => this.resetZoom());
  }

  /** Kullanıcı isteği (2026-09-10) — +/- butonları ve tekerlek zoom'unun paylaştığı
   *  ortak yol: sınırlara clamp edip yeniden çizer ve etikette gösterilen yüzdeyi
   *  günceller. İmleç konumunu SABİT TUTMA mantığı (`handleWheelZoom`) sadece fare
   *  tekerleğine özgü kaldı — butonlar için "görünür merkezi sabit tutmaya çalışmak"
   *  gereksiz karmaşıklık olurdu, basitçe merkezden zoom yeterli (TASKS.md minimal ilkesi). */
  private setZoom(next: number): void {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    if (clamped === this.zoom) return;
    this.zoom = clamped;
    this.renderInternal(this.lastRecords, this.lastSummaries);
    this.updateZoomLabel();
  }

  private updateZoomLabel(): void {
    if (this.zoomValueEl) this.zoomValueEl.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  /** Faz XI adayı — fare imlecinin altındaki içerik noktasını sabit tutarak zoom
   *  uygular: yeni zoom'u hesaplar, ardından `canvasWrapEl`'in scroll pozisyonunu
   *  imleç altındaki mantıksal noktanın ekranda aynı yerde kalması için düzeltir. */
  private handleWheelZoom(e: WheelEvent): void {
    const oldZoom = this.zoom;
    const direction = e.deltaY > 0 ? -1 : 1;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom + direction * ZOOM_STEP));
    if (newZoom === oldZoom) return;

    const wrap = this.canvasWrapEl;
    const wrapRect = wrap.getBoundingClientRect();
    // İmlecin wrap içindeki (scroll dahil) mutlak konumu, eski zoom'a göre.
    const pointerXInContent = wrap.scrollLeft + (e.clientX - wrapRect.left);
    const pointerYInContent = wrap.scrollTop + (e.clientY - wrapRect.top);
    const ratio = newZoom / oldZoom;

    this.zoom = newZoom;
    this.renderInternal(this.lastRecords, this.lastSummaries);
    this.updateZoomLabel();

    // Yeniden çizimden SONRA (canvas gerçek boyutu güncellendikten sonra) scroll'u
    // düzelt — imlecin altındaki nokta ekranda sabit kalsın.
    wrap.scrollLeft = pointerXInContent * ratio - (e.clientX - wrapRect.left);
    wrap.scrollTop = pointerYInContent * ratio - (e.clientY - wrapRect.top);
  }

  /** Faz XI adayı — isteğe bağlı sıfırlama (madde 5), main.ts veya bir tuş kısayolu
   *  için dışa açık: zoom'u 1x'e döndürüp yeniden çizer. */
  public resetZoom(): void {
    this.zoom = 1;
    this.renderInternal(this.lastRecords, this.lastSummaries);
    this.updateZoomLabel();
  }

  /** TEST-ONLY: headless doğrulama için mevcut zoom seviyesini okumaya yarar. */
  public getZoom(): number {
    return this.zoom;
  }

  /** Faz XII madde 6 — filtre kontrollerini (dropdown/checkbox) bir kez kurar.
   *  Minimal: tek satır, mevcut overlay panelinin içinde (yeni bir panel/modal
   *  AÇILMIYOR). Değişiklikte sadece bir yeniden-çizim tetiklenir (veri sorgulanmaz,
   *  `render` zaten periyodik olarak en son kayıtlarla çağrılıyor — bu yüzden
   *  filtre değişince `lastRecords` ile hemen yeniden çizip bir sonraki periyodik
   *  çağrıyı beklemeye gerek bırakmıyoruz). */
  private buildFilterControls(): void {
    const organOptions = (Object.keys(ORGAN_DEFINITIONS) as OrganType[])
      .map((t) => `<option value="${t}">${ORGAN_DEFINITIONS[t].label}</option>`)
      .join("");

    this.filtersEl.innerHTML = `
      <select id="lineage-filter-diet" class="lineage-filter-select" title="Diyete göre filtrele">
        <option value="all">Tüm diyetler</option>
        <option value="herbivore">🌱 Sadece otçul</option>
        <option value="carnivore">🍽️ Sadece etçil</option>
      </select>
      <select id="lineage-filter-organ" class="lineage-filter-select" title="Organ tipine göre filtrele">
        <option value="all">Tüm organlar</option>
        ${organOptions}
      </select>
      <select id="lineage-filter-status" class="lineage-filter-select" title="Hayatta/ölü durumuna göre filtrele">
        <option value="all">Hayatta + Ölü</option>
        <option value="alive">Sadece hayatta</option>
        <option value="dead">Sadece ölü 💀</option>
      </select>
      <input id="lineage-filter-gen-min" class="lineage-filter-num" type="number" min="0" placeholder="Nesil min" title="Minimum nesil" />
      <input id="lineage-filter-gen-max" class="lineage-filter-num" type="number" min="0" placeholder="Nesil maks" title="Maksimum nesil" />
    `;

    const dietEl = document.getElementById("lineage-filter-diet") as HTMLSelectElement;
    const organEl = document.getElementById("lineage-filter-organ") as HTMLSelectElement;
    const statusEl = document.getElementById("lineage-filter-status") as HTMLSelectElement;
    const minEl = document.getElementById("lineage-filter-gen-min") as HTMLInputElement;
    const maxEl = document.getElementById("lineage-filter-gen-max") as HTMLInputElement;

    const applyAndRerender = () => {
      this.filters = {
        diet: dietEl.value as LineageFilters["diet"],
        organ: organEl.value as LineageFilters["organ"],
        status: statusEl.value as LineageFilters["status"],
        minGeneration: minEl.value.trim() === "" ? null : Math.max(0, Number(minEl.value)),
        maxGeneration: maxEl.value.trim() === "" ? null : Math.max(0, Number(maxEl.value)),
      };
      this.renderInternal(this.lastRecords, this.lastSummaries);
    };

    dietEl.addEventListener("change", applyAndRerender);
    organEl.addEventListener("change", applyAndRerender);
    statusEl.addEventListener("change", applyAndRerender);
    minEl.addEventListener("input", applyAndRerender);
    maxEl.addEventListener("input", applyAndRerender);
  }

  /** Faz XII madde 6 — bir kaydın mevcut filtrelere uyup uymadığı. Uymayan kayıtlar
   *  tamamen gizlenmiyor, SOLUKLAŞTIRILIYOR (TASKS.md: "gizlensin/soluklaşsın" —
   *  soluklaştırma tercih edildi çünkü ebeveyn-çocuk bağlantı çizgileri hâlâ ağacın
   *  genel yapısını göstermeye devam edebilsin, tamamen gizlemek ağacı parçalı/
   *  anlaşılmaz hale getirebilirdi). */
  private matchesFilters(record: LineageRecord): boolean {
    const f = this.filters;
    if (f.diet !== "all" && record.diet !== f.diet) return false;
    if (f.organ !== "all" && !record.organs.includes(f.organ)) return false;
    const isAlive = record.diedAtSimTime === null;
    if (f.status === "alive" && !isAlive) return false;
    if (f.status === "dead" && isAlive) return false;
    if (f.minGeneration !== null && record.generation < f.minGeneration) return false;
    if (f.maxGeneration !== null && record.generation > f.maxGeneration) return false;
    return true;
  }

  /** Faz IX — Soy ağacından canlı seçimi (TASKS.md madde 6): bir düğüme tıklanınca
   *  çağrılacak callback'i kaydeder. `main.ts` bunu kullanarak seçili bireyin
   *  inceleme panelini (hayattaysa) veya temel bilgi/evrim geçmişini (ölmüşse) açar. */
  /** Faz XIV TEST-ONLY (geri alınacak): mevcut düğüm konumlarını (canvas içerik
   *  uzayı) dışarı açar — gerçek fare tıklamasıyla belirli bir düğümü hedeflemek için. */
  public getNodePositionsForTest(): readonly { id: number; x: number; y: number; r: number }[] {
    return this.nodePositions;
  }

  public onNodeClick(handler: (id: number) => void): void {
    this.nodeClickHandler = handler;
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public toggle(): void {
    this.visible ? this.hide() : this.show();
  }

  public show(): void {
    this.visible = true;
    this.panelEl.hidden = false;
    this.toggleBtn.classList.add("active");
  }

  public hide(): void {
    this.visible = false;
    this.panelEl.hidden = true;
    this.toggleBtn.classList.remove("active");
  }

  /** Sadece panel açıkken (TASKS.md — "sürekli ekranda durmamalı") gerçekten yeniden
   *  çizer; kapalıyken çağrılması ucuz bir no-op. Faz XVI Madde 1 — `summaries`
   *  (özetlenmiş/budanmış eski dallar, bkz. ecosystem.ts `LineageSummaryNode`)
   *  isteğe bağlı ikinci parametre olarak eklendi; verilmezse boş dizi varsayılır
   *  (geriye dönük uyumlu — mevcut çağıranlar bozulmaz). */
  public render(records: readonly LineageRecord[], summaries: readonly LineageSummaryNode[] = []): void {
    if (!this.visible) return;
    this.lastRecords = records;
    this.lastSummaries = summaries;
    this.renderInternal(records, summaries);
  }

  /**
   * Faz XVI Madde 1 — düz "nesil satırı" yerleşimi korunuyor (y ekseni hâlâ nesile
   * göre), ama x ekseni artık DOĞUM SIRASINA göre değil ATA-ÖNCELİKLİ bir sıralamayla
   * hesaplanıyor: her düğüm, ebeveyninin x konumuna yakın bir sırada yerleştirilmeye
   * çalışılıyor (basit bir "aynı ebeveynin çocukları yan yana kalsın" gruplaması).
   * Bu, çatallanma çizgilerinin (bkz. `drawParentChildCurve`) gereksiz yere uzun/
   * çapraz taraması yerine kısa, net dallanmalar üretmesini sağlıyor — klasik bir
   * aile ağacı şemasında da çocuklar genelde ebeveynin hemen altında/yakınında çizilir.
   * Kayıt sayısı arttıkça bu kaba bir yaklaşıklık kalır (mükemmel bir "crossing-free"
   * ağaç yerleşimi NP-zor bir problem, TASKS.md'nin "minimal" ilkesiyle uyuşmaz) ama
   * önceki saf "doğum zamanına göre sırala" yaklaşımından belirgin şekilde daha az
   * çapraz/karışık çizgi üretir.
   */
  private renderInternal(records: readonly LineageRecord[], summaries: readonly LineageSummaryNode[]): void {
    if (records.length === 0 && summaries.length === 0) {
      this.emptyEl.hidden = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.nodePositions = [];
      return;
    }
    this.emptyEl.hidden = true;

    // Faz XVI Madde 1 — özet düğümler varsa, ağacın en üstünde (nesil ekseninin
    // BAŞINDA) ekstra bir "özet satırı" ayrılıyor; gerçek nesiller bir satır aşağı
    // kayıyor. Böylece özet düğümler görsel olarak "bu ağacın kökündeki sıkıştırılmış
    // geçmiş" gibi okunuyor (en üstte, en eski).
    const hasSummaries = summaries.length > 0;
    const generationRowOffset = hasSummaries ? 1 : 0;

    const byGeneration = new Map<number, LineageRecord[]>();
    let maxGeneration = 0;
    for (const r of records) {
      const list = byGeneration.get(r.generation) ?? [];
      list.push(r);
      byGeneration.set(r.generation, list);
      if (r.generation > maxGeneration) maxGeneration = r.generation;
    }

    // Faz XII — BUG düzeltmesi (madde 4): sanal içerik genişliği, en kalabalık
    // satırın MIN_NODE_SPACING'i koruyacak kadar geniş olacak şekilde hesaplanıyor.
    // Bu, düğümlerin popülasyon büyüdükçe küçülüp üst üste binmesini (kök neden)
    // engelliyor — panel genişliği sabit kalıyor, canvas'ın kendisi büyüyüp
    // `overflow-x: auto` sarmalayıcı (`#lineage-canvas-wrap`, CSS) ile kaydırılıyor.
    let maxRowCount = Math.max(1, summaries.length);
    for (const list of byGeneration.values()) {
      if (list.length > maxRowCount) maxRowCount = list.length;
    }
    // Faz XI adayı — layout hesabı hep "mantıksal" (zoom=1) uzayda yapılır (madde 1-3):
    // wrap'in görünür boyutu zoom'dan bağımsız bir referans, ihtiyaç duyulan minimum
    // genişlik de öyle. `zoom` sadece en sonda, gerçek çizim/canvas boyutuna uygulanır
    // — filtrelerin/organ halkalarının/tıklamanın geri kalan mantığı DEĞİŞMİYOR.
    const zoom = this.zoom;
    const wrapWidth = this.canvasWrapEl.clientWidth || 480;
    const neededWidth = PADDING * 2 + maxRowCount * MIN_NODE_SPACING;
    const logicalWidth = Math.max(wrapWidth / zoom, neededWidth);
    const totalRows = maxGeneration + 1 + generationRowOffset;
    const neededHeight = Math.min(MAX_CONTENT_HEIGHT, PADDING * 2 + totalRows * ROW_HEIGHT);
    const logicalHeight = Math.max((this.canvasWrapEl.clientHeight || 320) / zoom, neededHeight);
    const width = logicalWidth * zoom;
    const height = logicalHeight * zoom;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.canvas.width !== Math.round(width * dpr) || this.canvas.height !== Math.round(height * dpr)) {
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
    }
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    const ctx = this.ctx;
    // `dpr * zoom` tek bir ölçek faktöründe birleştirilir: aşağıdaki tüm çizim
    // koordinatları mantıksal (zoom=1) uzayda hesaplanmaya devam edip bu transform
    // sayesinde ekranda doğru (büyütülmüş/küçültülmüş) boyutta görünür.
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    const rowHeight = totalRows > 1 ? (logicalHeight - PADDING * 2) / totalRows : logicalHeight - PADDING * 2;
    const usableWidth = logicalWidth - PADDING * 2;

    // --- Özet düğümlerin x/y konumları (en üst satır) ---
    const summaryPositionById = new Map<number, { x: number; y: number }>();
    if (hasSummaries) {
      const y = PADDING + rowHeight / 2;
      summaries.forEach((summary, i) => {
        const x = summaries.length > 1 ? PADDING + (i / (summaries.length - 1)) * usableWidth : logicalWidth / 2;
        summaryPositionById.set(summary.id, { x, y });
      });
    }

    // --- Gerçek kayıtların x/y konumları: ata-öncelikli sıralama (bkz. yukarıdaki
    // fonksiyon yorumu). Her satır, bir önceki satırdaki ebeveyn x konumuna göre
    // sıralanır (aynı ebeveynin çocukları birbirine yakın kalır); ebeveyni bir
    // özet düğümdeyse o özetin x'i referans alınır. ---
    const positionById = new Map<number, { x: number; y: number }>();
    const parentXOf = (record: LineageRecord): number => {
      const parentId = record.parentIds ? record.parentIds[0] : null;
      if (parentId === null) return logicalWidth / 2;
      const parentPos = positionById.get(parentId);
      if (parentPos) return parentPos.x;
      const summaryParent = summaryContainingChild(summaries, record.id);
      if (summaryParent) {
        const sPos = summaryPositionById.get(summaryParent.id);
        if (sPos) return sPos.x;
      }
      return logicalWidth / 2;
    };

    for (let gen = 0; gen <= maxGeneration; gen++) {
      const list = byGeneration.get(gen) ?? [];
      // Ebeveyn x konumuna göre sırala (stabil sort — aynı ebeveynin çocukları
      // aralarında doğum zamanına göre sıralı kalır).
      list.sort((a, b) => {
        const pa = parentXOf(a);
        const pb = parentXOf(b);
        if (pa !== pb) return pa - pb;
        return a.bornAtSimTime - b.bornAtSimTime;
      });
      const y = PADDING + (gen + generationRowOffset) * rowHeight + rowHeight / 2;
      list.forEach((record, i) => {
        const x = list.length > 1 ? PADDING + (i / (list.length - 1)) * usableWidth : logicalWidth / 2;
        positionById.set(record.id, { x, y });
      });
    }

    // --- Bağlantılar: özet -> gerçek çocuk (varsa), gerçek ebeveyn -> gerçek çocuk.
    // Faz XVI Madde 1 — düz çizgi yerine yumuşak bezier + ORTAK çatal noktası
    // (bkz. dosya başı yorumu ve `drawParentChildCurve`). Aynı ebeveynin/özetin
    // birden fazla çocuğu varsa hepsi aynı çatal noktasından çıkar. ---
    const forkDrop = rowHeight * FORK_DROP_RATIO;

    if (hasSummaries) {
      for (const summary of summaries) {
        const parentPos = summaryPositionById.get(summary.id);
        if (!parentPos) continue;
        const childPositions = summary.childIds
          .map((cid) => positionById.get(cid))
          .filter((p): p is { x: number; y: number } => !!p);
        if (childPositions.length === 0) continue;
        const forkY = parentPos.y + forkDrop;
        ctx.strokeStyle = "rgba(214, 178, 94, 0.3)";
        ctx.lineWidth = 1.25;
        for (const childPos of childPositions) {
          drawParentChildCurve(ctx, parentPos, childPos, forkY);
        }
      }
    }

    ctx.lineWidth = 1;
    // Ebeveyn -> çocuklarını grupla (bir seferde tek bir çatal noktası hesaplansın).
    const childrenByParent = new Map<number, LineageRecord[]>();
    for (const record of records) {
      const parentId = record.parentIds ? record.parentIds[0] : null;
      if (parentId === null) continue;
      if (!positionById.has(parentId)) continue; // özet-parent durumu yukarıda ele alındı
      const list = childrenByParent.get(parentId) ?? [];
      list.push(record);
      childrenByParent.set(parentId, list);
    }
    for (const [parentId, children] of childrenByParent) {
      const parentPos = positionById.get(parentId);
      if (!parentPos) continue;
      const forkY = parentPos.y + forkDrop;
      for (const child of children) {
        const childPos = positionById.get(child.id);
        if (!childPos) continue;
        const dimmed = !this.matchesFilters(child);
        ctx.strokeStyle = dimmed ? "rgba(168, 176, 191, 0.08)" : "rgba(168, 176, 191, 0.3)";
        drawParentChildCurve(ctx, parentPos, childPos, forkY);
      }
    }

    // --- Özet düğümleri çiz (elmas şekli, büyük, etiketli) ---
    const nextPositions: { id: number; x: number; y: number; r: number }[] = [];
    for (const summary of summaries) {
      const pos = summaryPositionById.get(summary.id);
      if (!pos) continue;
      drawSummaryNode(ctx, pos.x, pos.y, summary);
      nextPositions.push({ id: summary.id, x: pos.x * zoom, y: pos.y * zoom, r: SUMMARY_NODE_RADIUS * zoom });
    }

    // Düğümler: diyete göre dolgu rengi (canlılar), ölüler soluk/gri kontur. Ana organ
    // tipi (Faz XII madde 5) küçük bir renkli halka/kenarlıkla gösteriliyor. Filtreye
    // uymayan düğümler soluklaştırılıyor (madde 6).
    for (const record of records) {
      const pos = positionById.get(record.id);
      if (!pos) continue;
      const isAlive = record.diedAtSimTime === null;
      const dimmed = !this.matchesFilters(record);
      const alpha = dimmed ? 0.15 : 1;

      const dominant = record.dominantOrganType;
      if (dominant) {
        const category = ORGAN_DEFINITIONS[dominant].category;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, NODE_RADIUS + 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${(CATEGORY_COLORS[category] >> 16) & 0xff}, ${(CATEGORY_COLORS[category] >> 8) & 0xff}, ${CATEGORY_COLORS[category] & 0xff}, ${0.85 * alpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, Math.PI * 2);
      if (isAlive) {
        const fillColor = record.diet === "carnivore" ? `rgba(181, 67, 63, ${alpha})` : `rgba(79, 143, 240, ${alpha})`;
        ctx.fillStyle = fillColor;
        ctx.fill();
      } else {
        ctx.strokeStyle = `rgba(90, 96, 112, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // Faz XI adayı (madde 3) — tıklama isabet testi canvas'ın GÖRÜNEN (CSS piksel,
      // `getBoundingClientRect` ile ölçülen) koordinatlarını kullanıyor; çizim ise
      // mantıksal (zoom=1) uzayda yapıldı. Saklanan pozisyon/yarıçap bu yüzden `zoom`
      // ile çarpılıyor — zoom out'ta düğüm küçülürken tıklanabilir alan da orantılı
      // küçülüyor, zoom in'de büyüyor; ekstra bir offset dönüşümüne gerek kalmıyor.
      nextPositions.push({ id: record.id, x: pos.x * zoom, y: pos.y * zoom, r: NODE_RADIUS * zoom });
    }
    this.nodePositions = nextPositions;
  }
}

/** Faz XVI Madde 1 — verilen id'nin bir özet düğümün ÇOCUKLARI arasında olup
 *  olmadığını bulur (bkz. ecosystem.ts `LineageSummaryNode.childIds`). */
function summaryContainingChild(
  summaries: readonly LineageSummaryNode[],
  childId: number
): LineageSummaryNode | null {
  for (const s of summaries) {
    if (s.childIds.includes(childId)) return s;
  }
  return null;
}

/**
 * Faz XVI Madde 1 — genealoji-tarzı bağlantı: ebeveynden ORTAK bir çatal noktasına
 * (parentPos.x, forkY) dikey bir eğriyle iner, oradan çocuğa doğru ikinci bir yumuşak
 * eğriyle devam eder. Tek bir `bezierCurveTo` çağrısı yerine iki kısım kullanılmasının
 * nedeni: birden fazla çocuk aynı (parentPos.x, forkY) noktasından geçtiği için görsel
 * olarak "burada dallandı" hissi net kalıyor (tüm kardeş çizgiler bu noktada üst üste
 * biniyor, sonra ayrılıyor) — tek parça bir eğri bunu garanti etmez.
 */
function drawParentChildCurve(
  ctx: CanvasRenderingContext2D,
  parentPos: { x: number; y: number },
  childPos: { x: number; y: number },
  forkY: number
): void {
  ctx.beginPath();
  ctx.moveTo(parentPos.x, parentPos.y);
  // Ebeveynden çatal noktasına: düz bir dikey iniş (kardeşler arasında ortak).
  ctx.lineTo(parentPos.x, forkY);
  // Çatal noktasından çocuğa: yumuşak S-eğrisi (kübik bezier, kontrol noktaları
  // dikey ağırlıklı — yatay sıçramalar bile "organik" bir eğri gibi görünür).
  const midY = (forkY + childPos.y) / 2;
  ctx.bezierCurveTo(parentPos.x, midY, childPos.x, midY, childPos.x, childPos.y);
  ctx.stroke();
}

/** Faz XVI Madde 1 — özet düğüm çizimi: normal düğümlerden büyük bir elmas (döndürülmüş
 *  kare) + kısa bir etiket ("N birey"). Etiket küçük punto (zoom out'ta okunaklılık
 *  öncelikli değil, panel zaten zoom in ile incelenebiliyor) — TASKS.md'nin "N birey,
 *  X-Y nesil arası, artık gösterilmiyor ama sayıldı" önerisiyle birebir tutarlı bir
 *  kısa metin. */
function drawSummaryNode(ctx: CanvasRenderingContext2D, x: number, y: number, summary: LineageSummaryNode): void {
  const r = SUMMARY_NODE_RADIUS;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.beginPath();
  ctx.rect(-r * 0.72, -r * 0.72, r * 1.44, r * 1.44);
  ctx.fillStyle = "rgba(214, 178, 94, 0.22)";
  ctx.fill();
  ctx.strokeStyle = "rgba(214, 178, 94, 0.85)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  ctx.font = "9px system-ui, sans-serif";
  ctx.fillStyle = "rgba(226, 210, 160, 0.9)";
  ctx.textAlign = "center";
  const genRange =
    summary.minGeneration === summary.maxGeneration
      ? `N${summary.minGeneration}`
      : `N${summary.minGeneration}-${summary.maxGeneration}`;
  ctx.fillText(`${summary.individualCount} birey (${genRange})`, x, y + r + 11);
}
