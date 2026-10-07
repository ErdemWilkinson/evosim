import { BRAIN_ACTIONS, BRAIN_INPUTS, DIETS, DIET_DESCRIPTION, DIET_LABEL, Diet, GENE_BOUNDS, Genome, IN } from "./genome";
import { CATEGORY_LABEL, ORGANS, ORGAN_SLOTS, ORGAN_TYPES, OrganCategory, OrganType, STAGE_LABEL } from "./organs";
import { ELEMENTS, GeneticOption } from "./chemistry";
import { PlanetProfile } from "./planet";
import { CreatureDetail, SpeciesInfo, UiPayload } from "./protocol";
import { Theme, drawCreature } from "./render";
import { locale, tr } from "./i18n";
import { BEHAVIOR_LABEL, DEATH_LABEL, DeathCause, EventKind, HistorySample, SimEvent } from "./sim";

/** Panel içerikleri. Hepsi veriden HTML üretir; olaylar main.ts'te `data-*` ile yakalanır. */

export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);
}

export function fmtTime(t: number): string {
  const s = Math.max(0, Math.floor(t));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (v: number): string => String(v).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

export function nf(v: number, digits = 1): string {
  return v.toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

const pct = (v: number): string => `%${Math.round(v * 100)}`;
const lower = (s: string): string => s.toLocaleLowerCase("tr");

const htmlCache = new WeakMap<Element, string>();

/** İçerik değişmediyse DOM'a dokunmaz (açık seçim kutuları ve imleç bozulmasın). */
export function setHtml(el: Element, html: string): boolean {
  if (htmlCache.get(el) === html) return false;
  htmlCache.set(el, html);
  el.innerHTML = html;
  return true;
}

function fitCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; w: number; h: number } {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

function niceMax(v: number): number {
  const steps = [10, 20, 40, 60, 80, 100, 150, 200, 300, 400, 500, 600, 800, 1000];
  return steps.find((s) => s >= v) ?? Math.ceil(v / 500) * 500;
}

const MONO = `10px "Onest", system-ui, sans-serif`;
const PAD = { l: 30, r: 6, t: 8, b: 16 };

function axes(ctx: CanvasRenderingContext2D, w: number, h: number, yMax: number, t0: number, t1: number, theme: Theme): void {
  ctx.font = MONO;
  ctx.lineWidth = 1;
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 2; i++) {
    const y = Math.round(PAD.t + ((h - PAD.t - PAD.b) * i) / 2) + 0.5;
    ctx.strokeStyle = theme.line;
    ctx.globalAlpha = i === 2 ? 1 : 0.55;
    ctx.beginPath();
    ctx.moveTo(PAD.l, y);
    ctx.lineTo(w - PAD.r, y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.ink3;
    ctx.textAlign = "right";
    ctx.fillText(String(Math.round(yMax * (1 - i / 2))), PAD.l - 6, y);
  }
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillText(fmtTime(t0), PAD.l, h - 3);
  ctx.textAlign = "right";
  ctx.fillText(fmtTime(t1), w - PAD.r, h - 3);
}

function placeTip(tip: HTMLElement, root: HTMLElement, x: number): void {
  tip.hidden = false;
  const left = x + 12 + tip.offsetWidth > root.clientWidth ? x - tip.offsetWidth - 12 : x + 12;
  tip.style.left = `${Math.max(0, left)}px`;
  tip.style.top = "4px";
}

// ------------------------------------------------------------------ popülasyon grafiği

export class StackChart {
  private readonly canvas: HTMLCanvasElement;
  private readonly tip: HTMLElement;
  private history: HistorySample[] = [];
  private theme: Theme | null = null;
  private hover = -1;

  constructor(
    private readonly root: HTMLElement,
    private readonly legend: HTMLElement
  ) {
    this.canvas = root.querySelector("canvas")!;
    this.tip = root.querySelector<HTMLElement>(".tip")!;
    this.canvas.addEventListener("pointermove", (e) => {
      const n = this.history.length;
      if (n < 2) return;
      const rect = this.canvas.getBoundingClientRect();
      const f = (e.clientX - rect.left - PAD.l) / (rect.width - PAD.l - PAD.r);
      this.hover = Math.max(0, Math.min(n - 1, Math.round(f * (n - 1))));
      this.paint();
    });
    this.canvas.addEventListener("pointerleave", () => {
      this.hover = -1;
      this.tip.hidden = true;
      this.paint();
    });
  }

  public draw(history: HistorySample[], counts: number[], theme: Theme): void {
    this.history = history;
    this.theme = theme;
    setHtml(
      this.legend,
      DIETS.map((d, i) => `<span><i class="sw" style="background:var(--d-${d})"></i>${DIET_LABEL[d]}<b>${counts[i] ?? 0}</b></span>`).join("")
    );
    this.paint();
  }

  private paint(): void {
    const theme = this.theme;
    if (!theme) return;
    const { ctx, w, h } = fitCanvas(this.canvas);
    const hist = this.history;
    if (hist.length < 2) return;
    const totals = hist.map((s) => s.diets.reduce((a, b) => a + b, 0));
    const yMax = niceMax(Math.max(10, ...totals));
    const t0 = hist[0].t;
    const t1 = hist[hist.length - 1].t;
    const X = (i: number): number => PAD.l + ((w - PAD.l - PAD.r) * i) / (hist.length - 1);
    const Y = (v: number): number => PAD.t + (h - PAD.t - PAD.b) * (1 - v / yMax);
    axes(ctx, w, h, yMax, t0, t1, theme);

    const base = new Float32Array(hist.length);
    for (let d = 0; d < DIETS.length; d++) {
      let any = false;
      for (const s of hist) if (s.diets[d] > 0) any = true;
      if (!any) continue;
      ctx.beginPath();
      for (let i = 0; i < hist.length; i++) ctx.lineTo(X(i), Y(base[i] + hist[i].diets[d]));
      for (let i = hist.length - 1; i >= 0; i--) ctx.lineTo(X(i), Y(base[i]));
      ctx.closePath();
      ctx.fillStyle = theme.diet[DIETS[d]];
      ctx.fill();
      // Katmanlar arasında yüzey renginde ince bir ayraç.
      ctx.beginPath();
      for (let i = 0; i < hist.length; i++) {
        base[i] += hist[i].diets[d];
        ctx.lineTo(X(i), Y(base[i]));
      }
      ctx.strokeStyle = theme.surface;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (this.hover >= 0 && this.hover < hist.length) {
      const s = hist[this.hover];
      const x = Math.round(X(this.hover)) + 0.5;
      ctx.strokeStyle = theme.ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, PAD.t);
      ctx.lineTo(x, h - PAD.b);
      ctx.stroke();
      this.tip.innerHTML =
        `<div class="tip-title">${fmtTime(s.t)}</div>` +
        DIETS.map((d, i) => (s.diets[i] > 0 ? `<div class="tip-row"><span><i class="sw" style="background:var(--d-${d})"></i>${DIET_LABEL[d]}</span><b>${s.diets[i]}</b></div>` : "")).join("") +
        `<div class="tip-row"><span>Toplam</span><b>${totals[this.hover]}</b></div>` +
        `<div class="tip-row"><span>Tür</span><b>${s.species}</b></div><div class="tip-row"><span>Bitki</span><b>${s.nutrients}</b></div>`;
      placeTip(this.tip, this.root, x);
    }
  }
}

// ------------------------------------------------------------------ tek serili çizgi grafiği

export class LineChart {
  private readonly canvas: HTMLCanvasElement;
  private readonly tip: HTMLElement;
  private series: number[] = [];
  private theme: Theme | null = null;
  private color = "";
  private hover = -1;

  constructor(private readonly root: HTMLElement) {
    this.canvas = root.querySelector("canvas")!;
    this.tip = root.querySelector<HTMLElement>(".tip")!;
    this.canvas.addEventListener("pointermove", (e) => {
      const n = this.series.length / 2;
      if (n < 2) return;
      const rect = this.canvas.getBoundingClientRect();
      const f = (e.clientX - rect.left - PAD.l) / (rect.width - PAD.l - PAD.r);
      const t = this.series[0] + f * (this.series[n * 2 - 2] - this.series[0]);
      let best = 0;
      for (let i = 1; i < n; i++) if (Math.abs(this.series[i * 2] - t) < Math.abs(this.series[best * 2] - t)) best = i;
      this.hover = best;
      this.paint();
    });
    this.canvas.addEventListener("pointerleave", () => {
      this.hover = -1;
      this.tip.hidden = true;
      this.paint();
    });
  }

  /** `series`: [zaman, değer, zaman, değer, …] */
  public draw(series: number[], color: string, theme: Theme): void {
    this.series = series;
    this.color = color;
    this.theme = theme;
    this.paint();
  }

  private paint(): void {
    const theme = this.theme;
    if (!theme) return;
    const { ctx, w, h } = fitCanvas(this.canvas);
    const s = this.series;
    const n = s.length / 2;
    if (n < 2) {
      ctx.font = MONO;
      ctx.fillStyle = theme.ink3;
      ctx.fillText(tr("henüz yeterli veri yok"), PAD.l, h / 2);
      return;
    }
    let max = 0;
    for (let i = 0; i < n; i++) max = Math.max(max, s[i * 2 + 1]);
    const yMax = niceMax(Math.max(10, max));
    const t0 = s[0];
    const t1 = Math.max(t0 + 1, s[n * 2 - 2]);
    const X = (t: number): number => PAD.l + ((w - PAD.l - PAD.r) * (t - t0)) / (t1 - t0);
    const Y = (v: number): number => PAD.t + (h - PAD.t - PAD.b) * (1 - v / yMax);
    axes(ctx, w, h, yMax, t0, t1, theme);
    ctx.beginPath();
    for (let i = 0; i < n; i++) ctx.lineTo(X(s[i * 2]), Y(s[i * 2 + 1]));
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.lineTo(X(s[n * 2 - 2]), Y(0));
    ctx.lineTo(X(s[0]), Y(0));
    ctx.closePath();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (this.hover >= 0 && this.hover < n) {
      const x = X(s[this.hover * 2]);
      const y = Y(s[this.hover * 2 + 1]);
      ctx.fillStyle = this.color;
      ctx.strokeStyle = theme.surface;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      this.tip.innerHTML = `<div class="tip-title">${fmtTime(s[this.hover * 2])}</div><div class="tip-row"><span>Birey</span><b>${s[this.hover * 2 + 1]}</b></div>`;
      placeTip(this.tip, this.root, x);
    }
  }
}

// ------------------------------------------------------------------ ortak parçalar

function fact(label: string, value: string, sub = ""): string {
  return `<div><span class="label">${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
}

export function portrait(canvas: HTMLCanvasElement, g: Genome, theme: Theme): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const size = 84;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2 + 3, size / 2);
  const scale = (size * 0.24) / g.radius;
  ctx.scale(scale, scale);
  drawCreature(ctx, g, theme, true);
}

/** Karar ağı ısı haritası: satır eylem, sütun girdi. Renk işareti, doygunluk büyüklüğü gösterir. */
export function brainMatrix(weights: readonly number[]): string {
  let html = `<div class="matrix-wrap"><table class="matrix"><tr><th></th>${BRAIN_INPUTS.map((n) => `<th title="${n}">${n.length > 6 ? `${n.slice(0, 5)}.` : n}</th>`).join("")}</tr>`;
  for (let a = 0; a < BRAIN_ACTIONS.length; a++) {
    html += `<tr><th>${BRAIN_ACTIONS[a]}</th>`;
    for (let i = 0; i < IN; i++) {
      const w = weights[a * IN + i] ?? 0;
      const strength = Math.round(Math.min(1, Math.abs(w) / 5) * 78);
      const bg = Math.abs(w) < 0.05 ? "transparent" : `color-mix(in srgb, var(${w > 0 ? "--pos" : "--neg"}) ${strength}%, transparent)`;
      html += `<td><span style="background:${bg}" title="${BRAIN_INPUTS[i]} → ${BRAIN_ACTIONS[a]}: ${nf(w, 2)}">${Math.abs(w) < 0.05 ? "·" : nf(w, 1)}</span></td>`;
    }
    html += "</tr>";
  }
  return `${html}</table></div>`;
}

export function planetHtml(planet: PlanetProfile, actions = true): string {
  const c = planet.chem;
  const blocked = planet.forbiddenOrgans.map((t) => ORGANS[t].label);
  const mult = (v: number): string => `×${nf(v, 2)}`;
  const refs = [c.solvent, c.scaffold, c.membrane, c.wall, c.genetic, c.energy, c.catalyst, c.pigment];
  return (
    `<div class="elements">${c.elements.map((e) => `<span class="el" style="--c:${ELEMENTS[e.sym].color}" title="${ELEMENTS[e.sym].name}"><b>${e.sym}</b><small>${pct(e.share)}</small></span>`).join("")}</div>` +
    `<div class="facts" style="margin-top:9px">` +
    fact("Yüzey sıvısı", esc(c.solvent.name), `${c.temperature} K · yüzeyin ${pct(planet.liquidPercent / 100)}`) +
    fact("İskelet", esc(c.scaffold.name)) +
    fact("Zar", esc(c.membrane.name)) +
    fact("Hücre duvarı", esc(c.wall.name)) +
    fact("Kalıtım", esc(c.genetic.name), `kopyalama hatası ×${nf(c.genetic.error, 2)}`) +
    fact("Enerji", esc(c.energy.name)) +
    fact("Katalizör", esc(c.catalyst.name)) +
    fact("Işık pigmenti", esc(c.pigment.name)) +
    fact("Atmosfer", c.atmosphere.map((g) => `${g.gas} ${pct(g.share)}`).join(" · ")) +
    fact("Yaşamın kökeni", esc(c.origin.name)) +
    `</div><p class="note" style="margin-top:9px">${esc(planet.narrative)}</p>` +
    `<p class="foot" style="margin-top:6px">Kimyanın simülasyona etkisi: metabolizma ${mult(c.mods.metabolism)}, hız ${mult(c.mods.speed)}, can ${mult(c.mods.hp)}, üretici büyümesi ${mult(c.mods.plant)}. ` +
    `${blocked.length > 0 ? `Bu gezegende ortaya çıkamayan organlar: ${blocked.join(", ")}.` : "Bu gezegende tüm organlar ortaya çıkabilir."}</p>` +
    (actions ? `<div class="card-actions" style="margin-top:9px"><button type="button" class="btn btn-small" data-action="inspect-planet">Hücre yapısını incele</button><button type="button" class="btn btn-small" data-action="origin-film">Köken filmini izle</button><button type="button" class="btn btn-small" data-action="planet-card">Gezegen kartı</button></div>` : "") +
    `<details class="refs"><summary>Kaynaklar</summary><ul>${refs.map((o) => `<li><b>${esc(o.name)}:</b> ${esc(o.note)} <i>${esc(o.ref)}</i></li>`).join("")}<li><b>${esc(c.origin.name)}:</b> <i>${esc(c.origin.ref)}</i></li></ul></details>`
  );
}

// ------------------------------------------------------------------ DNA zinciri

const NUMERIC_GENES: [keyof Genome, string][] = [
  ["radius", "Yarıçap"],
  ["hue", "Renk tonu"],
  ["saturation", "Renk doygunluğu"],
  ["lightness", "Renk açıklığı"],
  ["moveSpeed", "Hız"],
  ["senseRadius", "Algı menzili"],
  ["metabolism", "Metabolizma"],
  ["divideEnergyFraction", "Bölünme eşiği"],
  ["maxLifespan", "Ömür"],
  ["ornament", "Süs"],
  ["virulence", "Emiş gücü"],
  ["gutBias", "Bitki–et dengesi"],
];
const TRAIT_GENES: [keyof Genome, string][] = [
  ["stage", "Örgütlenme düzeyi"],
  ["diet", "Beslenme biçimi"],
  ["reproductionStrategy", "Üreme biçimi"],
  ["laysEggs", "Yumurtlama"],
  ["packHunter", "Sürü avcılığı"],
];

/** Sayısal genlerin ne işe yaradığı (gen kartında gösterilir). */
const GENE_NOTE: Partial<Record<keyof Genome, string>> = {
  radius: "Beden büyüklüğü. Büyük beden yavaştır ama birim kütle başına az enerji harcar; sık örtüde yavaşlar.",
  hue: "Gövdenin renk tonu. Yalnızca görünüştür; türleri gözle ayırt etmeye yarar.",
  saturation: "Gövde renginin doygunluğu. Yalnızca görünüştür.",
  lightness: "Gövde renginin açıklığı. Yalnızca görünüştür.",
  moveSpeed: "Taban hız. Yüzgeç, bacak ve beden büyüklüğü bunun üstüne eklenir.",
  senseRadius: "Besini, avı ve tehdidi fark ettiği uzaklık.",
  metabolism: "Saniyede harcanan enerjinin çarpanı. Düşük olan açlığa daha uzun dayanır.",
  divideEnergyFraction: "Bölünmek için enerjinin azami enerjiye oranla ne kadar dolması gerektiği.",
  maxLifespan: "Yaşlılıktan ölmeden önce yaşayabileceği en uzun süre (saniye).",
  ornament: "Erkekte süs. Eş seçiminde çekiciliği artırır; karşılığında metabolizmayı ve avcılara görünürlüğü yükseltir.",
  virulence: "Parazitin emiş gücü. Çok emen konağını tüketir ve o oranda erken atılır, az emen aç kalır.",
  gutBias: "Hepçil ve çürükçülde sindirimin yönü: 0 ete, 1 bitkiye uzmanlaşmış. İkisi birden en iyi olamaz.",
  stage: "Örgütlenme düzeyi: organ yuvası sayısını, beden aralığını ve hangi organların mümkün olduğunu belirler.",
  diet: "Beslenme biçimi: enerjinin nereden geldiği.",
  reproductionStrategy: "Eşeysiz bölünme ya da eşeyli üreme.",
  laysEggs: "Yavru canlı mı doğar, yumurtadan mı çıkar. Yalnızca çok hücrelide ortaya çıkabilir.",
  packHunter: "Aynı türden sürü avcılarının yanında saldırı gücü artar. Yalnızca çok hücrelide ortaya çıkabilir.",
};

/** Kalıtım çiziminde seçili gen (adıyla). Kartlar yeniden çizilirken seçim korunur. */
let dnaPick = "";
/** Bir geni seçer; aynı gene yeniden tıklanınca seçim kalkar. */
export function pickGene(name: string): void {
  dnaPick = dnaPick === name ? "" : name;
}

function traitText(key: keyof Genome, value: unknown): string {
  if (key === "stage") return STAGE_LABEL[value as number];
  if (key === "diet") return DIET_LABEL[value as Diet];
  if (key === "reproductionStrategy") return value === "sexual" ? "eşeyli" : "eşeysiz";
  return value ? "var" : "yok";
}

const DNA_STEP = 7;
type StrandShape = GeneticOption["shape"];

/**
 * Kalıtım yapısının çizim geometrisi: `i` numaralı genin basamağının iki ucu (y1, y2) ve
 * varsa iki ipliğin o noktadaki yüksekliği. Biçim gezegenin kalıtım polimerinden gelir:
 * çift sarmal, bükülmemiş merdiven, üst üste istif, tabaka, tek şerit ya da dizisiz bulut.
 */
function strandAt(shape: StrandShape, i: number, phase: number): [number, number, number | null, number | null] {
  const wave = Math.sin(i * 0.52 + phase);
  switch (shape) {
    case "helix": {
      const a = 23 + wave * 15;
      const b = 23 - wave * 15;
      return [a, b, a, b];
    }
    case "ladder": {
      const lift = Math.sin(i * 0.3 + phase) * 3;
      return [9 + lift, 37 + lift, 9 + lift, 37 + lift];
    }
    case "stack": {
      const tilt = Math.sin(i * 0.9 + phase * 1.5) * 4;
      return [12 + tilt, 34 + tilt, null, null];
    }
    case "sheet": {
      const lift = Math.sin(i * 0.25 + phase) * 1.5;
      return i % 2 === 0 ? [6 + lift, 21 + lift, 4, 42] : [25 + lift, 40 + lift, 4, 42];
    }
    case "ribbon": {
      const spine = 23 + (i % 2 === 0 ? -5 : 5) + Math.sin(i * 0.2 + phase) * 4;
      return [spine, spine + (i % 2 === 0 ? -13 : 13), spine, null];
    }
    default: {
      const y = 23 + Math.sin(i * 2.4 + phase * (0.6 + (i % 5) * 0.2)) * 16;
      return [y, y + 0.1, null, null];
    }
  }
}

function strandPaths(shape: StrandShape, count: number, phase: number, each: (i: number, y1: string, y2: string) => void): [string, string] {
  let top = "";
  let bottom = "";
  for (let i = 0; i < count; i++) {
    const x = 3 + i * DNA_STEP + DNA_STEP / 2;
    const [y1, y2, a, b] = strandAt(shape, i, phase);
    if (a !== null) top += `${top === "" ? "M" : "L"}${x} ${a.toFixed(1)}`;
    if (b !== null) bottom += `${bottom === "" ? "M" : "L"}${x} ${b.toFixed(1)}`;
    each(i, y1.toFixed(1), y2.toFixed(1));
  }
  return [top, bottom];
}

/** Görünen kalıtım çizimlerini canlandırır: sarmal döner, öteki biçimler dalgalanır. */
export function spinDna(phase: number): void {
  for (const svg of document.querySelectorAll<SVGSVGElement>("svg.dna")) {
    if (svg.getClientRects().length === 0) continue;
    const lines = svg.querySelectorAll("line");
    const paths = svg.querySelectorAll("path");
    const [top, bottom] = strandPaths((svg.dataset.shape ?? "helix") as StrandShape, lines.length, phase, (i, y1, y2) => {
      lines[i].setAttribute("y1", y1);
      lines[i].setAttribute("y2", y2);
    });
    paths[0]?.setAttribute("d", top);
    paths[1]?.setAttribute("d", bottom);
  }
}

const SHAPE_NOTE: Record<StrandShape, string> = {
  helix: "İki iplik birbirine sarılır; her basamak bir gen.",
  ladder: "İki iplik bükülmeden yan yana uzanır; her basamak bir gen.",
  stack: "İplik yoktur: düz halkalar üst üste dizilir, her halka bir gen taşır.",
  sheet: "Genler kristal tabakadaki tuğlalar gibi iki sıra hâlinde dizilir.",
  ribbon: "Tek bir omurga; genler omurgadan iki yana sarkan yan gruplardır.",
  cloud: "Dizili bir zincir yoktur: her nokta bir bileşen oranıdır ve kese bölünürken yavruya geçer.",
};

/**
 * Genomu gezegenin kalıtım yapısının biçiminde çizer: her basamak bir gen. Değeri ilk
 * canlıdakiyle aynı kalan genler parlak, mutasyonla değişenler mor, sonradan kazanılan
 * organ genleri turuncu görünür. Renk tonu dışındaki sayısal genlerde %2'den küçük
 * kayma "değişmedi" sayılır; bir genin üzerine gelince ne kadar değiştiği yazar.
 */
export function dnaHtml(g: Genome, origin: Genome | null, genetic: GeneticOption): string {
  if (!origin) return `<p class="foot">İlk canlının genomu bu kayıtta yok.</p>`;
  const genes: { name: string; kind: 0 | 1 | 2; detail: string; note: string; body: string }[] = [];
  // Sayısal gen: aralık üstünde ilk canlının ve şimdiki değerin yeri.
  const numeric = (name: string, now: number, then: number, min: number, max: number, note: string, digits: number): void => {
    const span = max - min;
    const shift = (now - then) / span;
    const kind = Math.abs(shift) < 0.02 ? 0 : 1;
    const at = (v: number): string => (Math.min(1, Math.max(0, (v - min) / span)) * 100).toFixed(1);
    genes.push({
      name,
      kind,
      detail: kind === 0 ? "ilk canlıdaki değerde" : `ilk canlıya göre aralığın %${Math.round(Math.abs(shift) * 100)} kadarı ${shift > 0 ? "arttı" : "azaldı"}`,
      note,
      body:
        `<div class="gene-scale" role="img" aria-label="Aralık ${nf(min, digits)} – ${nf(max, digits)}"><i class="then" style="left:${at(then)}%"></i><i class="now" style="left:${at(now)}%"></i></div>` +
        `<div class="gene-vals"><span>${nf(min, digits)}</span><span>İlk canlı <b>${nf(then, digits)}</b></span><span>Şimdi <b>${nf(now, digits)}</b></span><span>${nf(max, digits)}</span></div>`,
    });
  };
  for (const [key, name] of NUMERIC_GENES) {
    const bounds = GENE_BOUNDS[key as keyof typeof GENE_BOUNDS] ?? (key === "hue" ? [0, 360] : [0, 100]);
    numeric(name, g[key] as number, origin[key] as number, bounds[0], bounds[1], GENE_NOTE[key] ?? "", bounds[1] - bounds[0] > 20 ? 0 : 2);
  }
  for (const [key, name] of TRAIT_GENES) {
    const same = g[key] === origin[key];
    genes.push({ name, kind: same ? 0 : 1, detail: same ? "ilk canlıdaki gibi" : "değişti", note: GENE_NOTE[key] ?? "", body: `<div class="gene-vals"><span>İlk canlı <b>${traitText(key, origin[key])}</b></span><span>Şimdi <b>${traitText(key, g[key])}</b></span></div>` });
  }
  for (let i = 0; i < origin.brain.length; i++) {
    const input = BRAIN_INPUTS[i % IN];
    const action = BRAIN_ACTIONS[Math.floor(i / IN)];
    const w = g.brain[i] ?? 0;
    const effect = Math.abs(w) < 0.05 ? "bu eylemi etkilemiyor" : `bu eylemin puanını ${w > 0 ? "artırıyor" : "azaltıyor"}`;
    numeric(`Karar ağı: ${input} → ${action}`, w, origin.brain[i], -8, 8, `Karar ağının bir ağırlığı: "${input}" girdisi büyüdükçe "${action}" eyleminin puanı bu sayıyla çarpılıp eklenir. Şu an ${effect}.`, 2);
  }
  for (const organ of g.organs) {
    genes.push({ name: `Organ: ${ORGANS[organ.type].label}`, kind: 2, detail: "sonradan kazanıldı", note: ORGANS[organ.type].description, body: `<div class="gene-scale" role="img" aria-label="Organ gücü"><i class="now" style="left:${(organ.power * 100).toFixed(1)}%"></i></div><div class="gene-vals"><span>0</span><span>İlk canlıda yok</span><span>Güç <b>${nf(organ.power, 2)}</b></span><span>1</span></div>` });
  }
  const width = genes.length * DNA_STEP + 6;
  let rungs = "";
  const [top, bottom] = strandPaths(genetic.shape, genes.length, 0, (i, y1, y2) => {
    const x = 3 + i * DNA_STEP + DNA_STEP / 2;
    // Her genin tıklanabilir alanı basamağın bütün sütunudur; çizgi onun hemen ardından gelir (bkz. .dna-hit + line).
    rungs +=
      `<rect class="dna-hit" x="${x - DNA_STEP / 2}" y="0" width="${DNA_STEP}" height="46" data-gene="${esc(genes[i].name)}"><title>${esc(genes[i].name)}: ${genes[i].detail}. Ayrıntı için tıklayın.</title></rect>` +
      `<line class="dna-${genes[i].kind}${genes[i].name === dnaPick ? " on" : ""}" x1="${x}" x2="${x}" y1="${y1}" y2="${y2}"/>`;
  });
  const picked = genes.find((gene) => gene.name === dnaPick);
  const card = picked
    ? `<div class="gene-card gene-${picked.kind}"><div class="gene-head"><b>${esc(picked.name)}</b><span>${picked.detail}</span><button type="button" class="x" data-gene="${esc(picked.name)}" aria-label="Gen kartını kapat">✕</button></div>` +
      (picked.note ? `<p>${esc(picked.note)}</p>` : "") +
      `${picked.body}</div>`
    : `<p class="foot gene-hint">Bir basamağa tıklayın: o genin ne işe yaradığı, ilk canlıdaki ve şimdiki değeri açılır.</p>`;
  const counts = [0, 1, 2].map((k) => genes.filter((gene) => gene.kind === k).length);
  const inherited = genes.length - counts[2];
  return (
    `<p class="foot" style="margin-bottom:4px"><b style="color:var(--ink)">${esc(genetic.name)}.</b> ${SHAPE_NOTE[genetic.shape]}</p>` +
    `<div class="dna-wrap"><svg class="dna dna-${genetic.shape}" data-shape="${genetic.shape}" viewBox="0 0 ${width} 46" preserveAspectRatio="none" role="img" aria-label="Kalıtım yapısı: ${counts[0]} gen ilk canlıyla aynı">` +
    `<path class="dna-strand" d="${top}"/><path class="dna-strand" d="${bottom}"/>${rungs}</svg></div>` +
    card +
    `<div class="legend"><span><i class="sw dna-sw0"></i>İlk canlıdan kalan<b>${counts[0]}</b></span><span><i class="sw dna-sw1"></i>Değişen<b>${counts[1]}</b></span><span><i class="sw dna-sw2"></i>Yeni organ geni<b>${counts[2]}</b></span></div>` +
    `<p class="foot">Atadan devralınan ${inherited} genin ${counts[0]} tanesi (${pct(counts[0] / inherited)}) hâlâ ilk canlıdaki değere yakın. Bu polimerin kopyalama hatası çarpanı ×${nf(genetic.error, 2)}.</p>`
  );
}

// ------------------------------------------------------------------ Genel sekmesi

export function updateOverview(ui: UiPayload, population: number, plants: number): void {
  $("k-pop").textContent = String(population);
  $("k-species").textContent = String(ui.species.reduce((n, s) => n + (s.count > 0 ? 1 : 0), 0));
  $("k-gen").textContent = String(ui.maxGeneration);
  $("k-plants").textContent = String(plants);
  $("k-land").textContent = String(ui.onLand);
  $("k-sick").textContent = String(ui.infected);
  setHtml(
    $("k-stages"),
    `<div class="stagebar">${ui.stages.map((n, i) => (n > 0 ? `<i class="s${i}" style="flex:${n}"></i>` : "")).join("")}</div>` +
      `<div class="legend">${ui.stages.map((n, i) => `<span><i class="sw s${i}"></i>${STAGE_LABEL[i]}<b>${n}</b></span>`).join("")}</div>`
  );

  const causes = (Object.keys(DEATH_LABEL) as DeathCause[]).filter((c) => c !== "removed" || ui.deaths[c] > 0);
  const total = causes.reduce((n, c) => n + (ui.deaths[c] ?? 0), 0);
  $("deaths-total").textContent = `${total} ölüm · ${ui.births} doğum`;
  setHtml(
    $("deaths"),
    causes
      .map((c) => {
        const n = ui.deaths[c] ?? 0;
        return `<div class="bar-row${n === 0 ? " zero" : ""}"><span>${DEATH_LABEL[c]}</span><i><i style="display:block;height:100%;width:${total > 0 ? (n / total) * 100 : 0}%"></i></i><b>${n}</b></div>`;
      })
      .join("")
  );
}

// ------------------------------------------------------------------ Türler sekmesi

export function speciesRows(species: SpeciesInfo[]): string {
  const living = species.filter((s) => s.count > 0).sort((a, b) => b.count - a.count);
  if (living.length === 0) return `<p class="note" style="padding:10px 8px">Yaşayan tür yok.</p>`;
  return living
    .map(
      (s) =>
        `<button type="button" class="row" data-species="${s.id}"><i class="sw" style="background:var(--d-${s.diet})"></i>` +
        `<span class="row-name">${esc(s.name)}<span class="row-sub">${DIET_LABEL[s.diet]} · ${lower(STAGE_LABEL[s.stage])}${s.infected > 0 ? ` · ${s.infected} hasta` : ""}</span></span>` +
        `<span class="row-count">${s.count}</span></button>`
    )
    .join("");
}

export function speciesSkeleton(s: SpeciesInfo): string {
  return (
    `<div class="card">` +
    `<div class="card-actions"><button type="button" class="btn btn-small" data-action="species-back">← Türler</button>` +
    `<button type="button" class="btn btn-small" data-action="species-highlight" id="sp-highlight" aria-pressed="false">Haritada vurgula</button></div>` +
    `<div class="card-head"><canvas id="sp-portrait"></canvas><div><div class="card-title"><em>${esc(s.name)}</em></div><div class="card-sub" id="sp-sub"></div></div></div>` +
    `<div class="facts" id="sp-facts"></div>` +
    `<section class="block"><h3>Popülasyon <span>birey sayısı</span></h3><div class="chart chart-short" id="sp-chart"><canvas></canvas><div class="tip" hidden></div></div></section>` +
    `<section class="block"><h3>Organ dağılımı <span>taşıyan oranı · ort. güç</span></h3><div class="bars" id="sp-organs"></div></section>` +
    `<section class="block"><h3>Kalıtım yapısı <span>tip örneği, ilk canlıya göre</span></h3><div id="sp-dna"></div></section>` +
    `<section class="block"><h3>Karar ağı <span>tür ortalaması</span></h3><div id="sp-brain"></div></section>` +
    `<section class="block"><h3>Akrabalık</h3><div class="history" id="sp-kin"></div></section>` +
    `</div>`
  );
}

export function updateSpeciesCard(ui: UiPayload, info: SpeciesInfo, all: SpeciesInfo[], time: number): void {
  const d = ui.speciesDetail;
  if (!d || d.id !== info.id) return;
  const n = Math.max(1, d.members);
  $("sp-sub").textContent = `${DIET_LABEL[info.diet]} · ${lower(STAGE_LABEL[info.stage])}. ${DIET_DESCRIPTION[info.diet]}`;
  setHtml(
    $("sp-facts"),
    fact("Birey", info.count > 0 ? String(info.count) : "tükendi", `en çok ${info.peak}`) +
      fact("Dönem", `${fmtTime(info.born)} – ${info.extinct >= 0 ? fmtTime(info.extinct) : "şimdi"}`, `${fmtTime((info.extinct >= 0 ? info.extinct : time) - info.born)} sürdü`) +
      fact("Toplam doğum", String(info.total)) +
      fact("Nesil aralığı", d.members > 0 ? `${d.generation[0]}–${d.generation[1]}` : "—") +
      fact("Ort. yarıçap", d.members > 0 ? nf(d.radius) : "—") +
      fact("Ort. hız", d.members > 0 ? nf(d.speed) : "—", "birim/sn") +
      fact("Ort. algı", d.members > 0 ? nf(d.sense, 0) : "—", "birim") +
      fact("Ort. metabolizma", d.members > 0 ? nf(d.metabolism, 2) : "—", "enerji/sn") +
      fact("Karada", d.members > 0 ? pct(d.onLand / n) : "—") +
      fact("Eşeyli üreyen", d.members > 0 ? pct(d.sexual / n) : "—", d.sexual > 0 ? `${d.males} erkek · süs ${nf(d.ornament, 2)}` : "") +
      fact("Hasta", String(d.infected)) +
      (d.members > 0 && info.diet === "parasite" ? fact("Ort. emiş gücü", `×${nf(d.virulence, 2)}`, "çok emen erken atılır") : "") +
      (d.members > 0 && (info.diet === "omnivore" || info.diet === "scavenger") ? fact("Ort. sindirim yönü", `${pct(d.gutBias)} bitki`, `${pct(1 - d.gutBias)} et`) : "") +
      fact("Tip örneği", `${ORGAN_SLOTS[info.stage]} organ yuvası`, `yarıçap ${nf(d.type.radius)}`)
  );
  setHtml(
    $("sp-organs"),
    d.organs.length === 0
      ? `<p class="foot">Bu türün yaşayan bireylerinde organ yok.</p>`
      : d.organs
          .map((o) => `<div class="bar-row wide" title="${esc(ORGANS[o.type].description)}"><span>${ORGANS[o.type].label}</span><i><i style="display:block;height:100%;width:${(o.count / n) * 100}%"></i></i><b>${pct(o.count / n)} · ${nf(o.power, 2)}</b></div>`)
          .join("")
  );
  setHtml($("sp-brain"), brainMatrix(d.brain));
  const byId = new Map(all.map((s) => [s.id, s]));
  const link = (s: SpeciesInfo): string => `<button type="button" class="link" data-species="${s.id}">${esc(s.name)}</button>${s.count > 0 ? ` <span class="mono dim">${s.count}</span>` : ` <span class="mono dim">tükendi</span>`}`;
  const parent = byId.get(info.parentId);
  const children = d.children.map((id) => byId.get(id)).filter((s): s is SpeciesInfo => s !== undefined);
  setHtml(
    $("sp-kin"),
    `<div><b>ATA</b><span>${parent ? link(parent) : "yok (ilk yaşam ya da göç)"}</span></div>` +
      `<div><b>AYRILMA</b><span>${esc(info.reason)}</span></div>` +
      `<div><b>YAVRU TÜR</b><span>${children.length > 0 ? children.map(link).join("<br>") : "yerleşmiş yavru tür yok"}</span></div>`
  );
}

// ------------------------------------------------------------------ Organlar sekmesi

export function organTable(ui: UiPayload, population: number, forbidden: readonly OrganType[]): string {
  const groups = new Map<OrganCategory, OrganType[]>();
  for (const t of ORGAN_TYPES) {
    const list = groups.get(ORGANS[t].category) ?? [];
    list.push(t);
    groups.set(ORGANS[t].category, list);
  }
  let html = "";
  for (const [category, types] of groups) {
    html += `<div class="organ-group"><div class="label" style="margin-bottom:3px">${CATEGORY_LABEL[category]}</div>`;
    for (const t of types.sort((a, b) => (ui.organs[b] ?? 0) - (ui.organs[a] ?? 0))) {
      const n = ui.organs[t] ?? 0;
      const blocked = forbidden.includes(t);
      const share = population > 0 ? n / population : 0;
      html +=
        `<div class="organ-line${n === 0 ? " zero" : ""}${blocked ? " blocked" : ""}" title="${esc(ORGANS[t].description)}${blocked ? " — Bu gezegende ortaya çıkamaz." : ""}">` +
        `<span>${ORGANS[t].label}<sup>${ORGANS[t].stage}</sup></span><i><i style="display:block;height:100%;width:${share * 100}%"></i></i><b>${n === 0 ? "—" : pct(share)}</b></div>`;
    }
    html += `</div>`;
  }
  return html;
}

// ------------------------------------------------------------------ Günlük sekmesi

export const EVENT_KIND_LABEL: Record<EventKind, string> = { species: "Tür", organ: "Organ", stage: "Düzey", diet: "Diyet", gene: "Gen", disease: "Hastalık", population: "Nüfus", world: "Dünya" };

export function logHtml(events: SimEvent[], filter: EventKind | ""): string {
  const list = (filter ? events.filter((e) => e.kind === filter) : events).slice(-140).reverse();
  if (list.length === 0) return `<li><time></time><span class="kind"></span><span>Henüz kayıt yok.</span></li>`;
  return list.map((e) => `<li><time>${fmtTime(e.t)}</time><span class="kind">${EVENT_KIND_LABEL[e.kind]}</span><span>${esc(e.text)}</span></li>`).join("");
}

// ------------------------------------------------------------------ Birey sekmesi

export function creatureSkeleton(id: number): string {
  return (
    `<div class="card">` +
    `<div class="card-head"><canvas id="cr-portrait"></canvas><div><div class="card-title">Birey <span class="mono">#${id}</span></div><div id="cr-species"></div><div class="card-sub" id="cr-sub"></div></div></div>` +
    `<div class="card-actions" id="cr-actions"></div>` +
    `<div class="meters" id="cr-meters"></div>` +
    `<div class="facts" id="cr-facts"></div>` +
    `<section class="block"><h3>Organlar <span id="cr-slots"></span></h3><div id="cr-organs"></div><div id="cr-edit"></div></section>` +
    `<section class="block"><h3>Kalıtım yapısı <span>ilk canlıya göre</span></h3><div id="cr-dna"></div></section>` +
    `<section class="block"><h3>Karar ağı <span>girdi → eylem ağırlıkları</span></h3><div id="cr-brain"></div>` +
    `<p class="foot">Her eylemin puanı, o satırdaki ağırlıkların girdilerle çarpımının toplamıdır; en yüksek puanlı eylem seçilir. Ağırlıklar kalıtılır ve mutasyona uğrar.</p></section>` +
    `<section class="block"><h3>Soy geçmişi <span id="cr-chain"></span></h3><div class="history" id="cr-history"></div></section>` +
    `</div>`
  );
}

function meter(label: string, ratio: number, text: string): string {
  return `<div class="meter"><span>${label}</span><i><i style="display:block;height:100%;width:${Math.max(0, Math.min(1, ratio)) * 100}%"></i></i><b>${text}</b></div>`;
}

function versus(value: number, mean: number | undefined): string {
  if (mean === undefined || mean <= 0) return "";
  const diff = value / mean - 1;
  return Math.abs(diff) < 0.03 ? "nüfus ortalamasında" : `ortalamadan ${pct(Math.abs(diff))} ${diff > 0 ? "yüksek" : "düşük"}`;
}

/** Beslenme biçimine özgü kalıtılan özellik (varsa). */
function dietTrait(g: Genome): string {
  if (g.diet === "omnivore" || g.diet === "scavenger") return `sindirim: %${Math.round(g.gutBias * 100)} bitkiye, %${Math.round((1 - g.gutBias) * 100)} ete yatkın`;
  return g.diet === "parasite" ? `emiş gücü ×${nf(g.virulence, 2)}` : "";
}

export interface CreatureCardState {
  following: boolean;
  placing: boolean;
}

export function updateCreatureCard(d: CreatureDetail, species: SpeciesInfo | undefined, forbidden: readonly OrganType[], state: CreatureCardState): void {
  const g = d.genome;
  const rec = d.inspection.rec;
  setHtml($("cr-species"), species ? `<button type="button" class="link" data-species="${species.id}">${esc(species.name)}</button>` : "");
  $("cr-sub").textContent = d.alive
    ? `${BEHAVIOR_LABEL[d.state]}${d.onLand ? " · karada" : " · sıvıda"}`
    : `öldü${rec && rec.cause ? ` (${DEATH_LABEL[rec.cause]})` : ""}${rec && rec.died >= 0 ? ` · ${fmtTime(rec.died)}` : ""}`;
  setHtml(
    $("cr-actions"),
    d.alive
      ? `<button type="button" class="btn btn-small" data-action="follow" aria-pressed="${state.following}">Takip et</button>` +
          `<button type="button" class="btn btn-small" data-action="inspect">Yapıyı incele</button>` +
          `<button type="button" class="btn btn-small" data-action="line-mark">Soyumu işaretle</button>` +
          `<button type="button" class="btn btn-small game-only" data-action="clone" aria-pressed="${state.placing}">Kopyasını yerleştir</button>` +
          `<button type="button" class="btn btn-small btn-danger game-only" data-action="remove">Kaldır</button>`
      : `<button type="button" class="btn btn-small" data-action="inspect">Yapıyı incele</button><span class="foot">Bu birey artık yaşamıyor; genomu son hâliyle gösteriliyor.</span>`
  );
  setHtml(
    $("cr-meters"),
    d.alive
      ? meter("Enerji", d.energy / d.maxEnergy, `${nf(d.energy, 0)} / ${nf(d.maxEnergy, 0)}`) +
          meter("Can", d.hp / d.maxHp, `${nf(d.hp)} / ${nf(d.maxHp)}`) +
          meter("Yaş", d.age / g.maxLifespan, `${nf(d.age, 0)} / ${nf(g.maxLifespan, 0)} sn`)
      : ""
  );
  const means = d.inspection.means;
  const sexual = g.reproductionStrategy === "sexual";
  const health = d.infected > 0 ? `hasta (${nf(d.infected, 0)} sn)` : d.immune > 0 ? `bağışık (${nf(d.immune, 0)} sn)` : "sağlıklı";
  setHtml(
    $("cr-facts"),
    fact("Beslenme", DIET_LABEL[g.diet], dietTrait(g)) +
      fact("Düzey", STAGE_LABEL[g.stage]) +
      fact("Nesil", String(g.generation)) +
      fact("Üreme", sexual ? `eşeyli · ${g.sex === "f" ? "dişi" : "erkek"}` : "eşeysiz", `${g.laysEggs ? "yumurtlar" : "canlı doğurur"}${sexual && g.sex === "m" ? ` · süs ${nf(g.ornament, 2)}` : ""}`) +
      (d.alive
        ? fact("Hız", nf(d.speed), versus(d.speed, means?.speed)) +
          fact("Algı menzili", nf(d.sense, 0), versus(d.sense, means?.sense)) +
          fact("Metabolizma", nf(d.metabolism, 2), versus(d.metabolism, means?.metabolism)) +
          fact("Saldırı", nf(d.attack), g.packHunter ? "sürü avcısı" : "") +
          fact("Sağlık", health, d.parasites > 0 ? `${d.parasites} parazit taşıyor` : d.hostId ? `konak #${d.hostId}` : "")
        : "") +
      fact("Yarıçap", nf(g.radius), versus(g.radius, means?.radius))
  );
  const slots = ORGAN_SLOTS[g.stage];
  $("cr-slots").textContent = `${g.organs.length} / ${slots} yuva`;
  setHtml(
    $("cr-organs"),
    g.organs.length === 0
      ? `<p class="foot">Organ yok: çıplak bir hücre.</p>`
      : g.organs
          .map(
            (o) =>
              `<div class="organ-row"><span>${ORGANS[o.type].label}<small>${esc(ORGANS[o.type].description)}</small></span><i><i style="display:block;height:100%;width:${o.power * 100}%"></i></i><b>${nf(o.power, 2)}</b>` +
              (d.alive ? `<button type="button" class="x game-only" data-action="organ-remove" data-organ="${o.type}" aria-label="${ORGANS[o.type].label} organını kaldır" title="Organı kaldır">✕</button>` : `<span></span>`) +
              `</div>`
          )
          .join("")
  );
  if (d.alive) {
    const options = ORGAN_TYPES.filter((t) => !forbidden.includes(t) && ORGANS[t].stage <= g.stage && !g.organs.some((o) => o.type === t));
    const full = g.organs.length >= slots;
    setHtml(
      $("cr-edit"),
      `<div class="inline-form game-only" style="margin-top:9px">` +
        (full
          ? `<span class="foot" style="flex:1 1 160px">Boş yuva yok. Bir organı kaldırın ya da düzeyi yükseltin.</span>`
          : `<select id="organ-add" aria-label="Eklenecek organ">${options.map((t) => `<option value="${t}">${ORGANS[t].label} — ${CATEGORY_LABEL[ORGANS[t].category]}</option>`).join("")}</select>` +
            `<button type="button" class="btn btn-small" data-action="organ-add">Organ ekle</button>`) +
        `<select id="stage-set" aria-label="Örgütlenme düzeyi" style="flex:0 1 150px">${STAGE_LABEL.map((label, i) => `<option value="${i}"${i === g.stage ? " selected" : ""}>${label}</option>`).join("")}</select>` +
        `</div>`
    );
  } else setHtml($("cr-edit"), "");
  setHtml($("cr-brain"), brainMatrix(g.brain));
  $("cr-chain").textContent = `${d.inspection.chain} kuşak izleniyor`;
  setHtml(
    $("cr-history"),
    d.inspection.history.length === 0
      ? `<span class="foot">Bu soyda kayda geçmiş bir değişiklik yok.</span>`
      : d.inspection.history.map((h) => `<div><b>${h.gen}. NESİL</b><span>${esc(h.notes.join(", "))}</span></div>`).join("")
  );
}
