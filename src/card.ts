import { ELEMENTS } from "./chemistry";
import { EvolutionSpeed } from "./genome";
import { tr } from "./i18n";
import { MS_LABEL } from "./history";
import { PlanetProfile, generatePlanetProfile } from "./planet";
import { renderTerrain } from "./render";
import { UiPayload } from "./protocol";
import { fmtTime } from "./ui";
import { World } from "./world";

/**
 * Gezegen kartı ve paylaşım bağlantısı. Yalnızca arayüzdedir: kart bir tuvale çizilir,
 * bağlantı tohumu ve birkaç ayarı adres çubuğunun `#` kısmında taşır. Benzetime dokunmaz.
 */

export interface Share {
  seed: number;
  evo: EvolutionSpeed;
  events: boolean;
  plants: number;
}

const EVO: EvolutionSpeed[] = ["fast", "medium", "slow"];

export function encodeShare(s: Share): string {
  return `#s=${s.seed >>> 0}&e=${s.evo}&ev=${s.events ? 1 : 0}&pl=${s.plants}`;
}

/** Adres çubuğundaki `#` kısmından tohumu ve ayarları okur; geçersizse null. */
export function parseShare(hash: string): Share | null {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const raw = p.get("s");
  if (!raw || !/^\d{1,10}$/.test(raw)) return null;
  const seed = Number(raw) >>> 0;
  const evo = EVO.includes(p.get("e") as EvolutionSpeed) ? (p.get("e") as EvolutionSpeed) : "medium";
  const plants = Math.min(2.5, Math.max(0.3, Number(p.get("pl") ?? 1) || 1));
  return { seed, evo, events: p.get("ev") !== "0", plants };
}

/** Günün gezegeni: UTC tarihinden türetilen tohum; aynı gün herkes için aynıdır. */
export function dailySeed(now = new Date()): number {
  const key = now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
  let h = 2166136261 ^ key;
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

const W = 1200;
const H = 675;
const INK = "#f3f5fc";
const DIM = "#9aa3b8";
const BG = "#04050c";

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

/** Kartı çizer. `ui` varsa çalışan dünyanın özeti de eklenir. */
export function drawCard(seed: number, ui: UiPayload | null, time: number, profile?: PlanetProfile): HTMLCanvasElement {
  const world = new World(seed);
  const p = profile ?? generatePlanetProfile(world);
  const c = p.chem;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Harita: solda, yuvarlatılmış köşeli.
  const pad = 36;
  const mapW = 600;
  const mapH = 375;
  const terrain = renderTerrain(world, true, mapW * 2);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad + 60, mapW, mapH, 14);
  ctx.clip();
  ctx.drawImage(terrain, pad, pad + 60, mapW, mapH);
  ctx.restore();

  const font = (px: number, weight = 400): string => `${weight} ${px}px "Segoe UI", system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  ctx.font = font(34, 700);
  ctx.fillText(`${tr("Tohum")} ${seed}`, pad, pad + 34);
  ctx.fillStyle = DIM;
  ctx.font = font(16);
  ctx.fillText(fit(ctx, `${tr(c.origin.name)} · ${c.temperature} K · ${Math.round(c.pressure * 100) / 100} bar · ${tr(`yüzeyin %${Math.round(p.liquidPercent)} sıvı`)}`, mapW), pad, pad + 56);

  // Elementler: haritanın altında.
  const ey = pad + 60 + mapH + 22;
  const chips = [...c.elements.map((e) => ({ ...e, trace: false })), ...c.trace.map((t) => ({ ...t, trace: true }))];
  chips.forEach((e, i) => {
    const info = ELEMENTS[e.sym];
    const x = pad + (i % 7) * 86;
    const y = ey + Math.floor(i / 7) * 48;
    ctx.globalAlpha = e.trace ? 0.7 : 1;
    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.roundRect(x, y, 78, 40, 8);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#0b0f19";
    ctx.font = font(17, 700);
    ctx.fillText(e.sym, x + 8, y + 18);
    ctx.font = font(12);
    ctx.fillText(e.trace ? tr("iz") : `${Math.round(e.share * 100)}%`, x + 8, y + 33);
  });

  // Sağ sütun: kimya.
  const rx = pad + mapW + 40;
  const rw = W - rx - pad;
  let y = pad + 34;
  const row = (label: string, value: string): void => {
    ctx.fillStyle = DIM;
    ctx.font = font(14);
    ctx.fillText(tr(label), rx, y);
    ctx.fillStyle = INK;
    ctx.font = font(19, 600);
    ctx.fillText(fit(ctx, tr(value), rw), rx, y + 24);
    y += 52;
  };
  row("Yüzey sıvısı", c.solvent.name);
  row("Zar", c.membrane.name);
  row("Hücre duvarı", c.wall.name);
  row("Kalıtım", c.genetic.name);
  row("Enerji", c.energy.name);
  row("Işık pigmenti", c.pigment.name);
  row("Köken enerjisi", c.originEnergy.name);
  row("Atmosfer", c.atmosphere.map((g) => `${g.gas} ${Math.round(g.share * 100)}%`).join(" · "));

  // Alt şerit: çalışan dünyanın özeti.
  const by = H - pad - 44;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rx, by - 16);
  ctx.lineTo(W - pad, by - 16);
  ctx.stroke();
  if (ui) {
    const living = ui.species.filter((s) => s.count > 0).length;
    const gone = ui.species.filter((s) => s.established && s.count === 0).length;
    ctx.fillStyle = INK;
    ctx.font = font(18, 600);
    ctx.fillText(`${tr("Geçen süre")} ${fmtTime(time)}`, rx, by + 6);
    ctx.fillStyle = DIM;
    ctx.font = font(15);
    ctx.fillText(fit(ctx, `${living} ${tr("yaşayan tür")} · ${gone} ${tr("tükenen tür")} · ${ui.milestones.length} ${tr("dönüm noktası")}`, rw), rx, by + 30);
    const names = ui.milestones.map((m) => tr(MS_LABEL[m.key] ?? m.key)).join(" · ");
    if (names) {
      ctx.font = font(13);
      ctx.fillText(fit(ctx, names, rw), rx, by + 52);
    }
  } else {
    ctx.fillStyle = DIM;
    ctx.font = font(15);
    ctx.fillText(tr("Bütün yaşam tek bir hücreyle başlar."), rx, by + 8);
  }
  ctx.fillStyle = DIM;
  ctx.font = font(13, 600);
  ctx.textAlign = "right";
  ctx.fillText("Evosim", W - pad, pad + 14);
  ctx.textAlign = "left";
  return canvas;
}
