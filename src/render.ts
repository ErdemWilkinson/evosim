import { Diet, DIETS, Genome } from "./genome";
import { OrganType } from "./organs";
import { FLAG, PLANT_LAND_BIT, PLANT_SCALE, STRIDE } from "./protocol";
import { View } from "./client";
import { MAP_H, MAP_W, World } from "./world";
import { Chemistry } from "./chemistry";
import { BEHAVIORS, INITIAL_CREATURES, SOUP_COLS, SOUP_ROWS } from "./sim";

/** Sahne çizimi (Canvas 2D). Simülasyondan gelen kareleri yalnızca okur. */

// ------------------------------------------------------------------ tema

export interface Theme {
  dark: boolean;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  surface: string;
  sceneBg: string;
  accent: string;
  critical: string;
  warn: string;
  plantWater: string;
  plantLand: string;
  diet: Record<Diet, string>;
}

/** Arayüz tek, koyu bir görünüme sahiptir. */
export function isDark(): boolean {
  return true;
}

export function readTheme(): Theme {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string): string => cs.getPropertyValue(name).trim();
  const diet = {} as Record<Diet, string>;
  for (const d of DIETS) diet[d] = v(`--d-${d}`);
  return {
    dark: isDark(),
    ink: v("--ink"),
    ink2: v("--ink-2"),
    ink3: v("--ink-3"),
    line: v("--line"),
    surface: v("--surface"),
    sceneBg: v("--scene-bg"),
    accent: v("--accent"),
    critical: v("--critical"),
    warn: v("--warn"),
    plantWater: v("--plant-water"),
    plantLand: v("--plant-land"),
    diet,
  };
}

// ------------------------------------------------------------------ arazi dokusu

type RGB = [number, number, number];
interface MapPalette {
  deep: RGB;
  shallow: RGB;
  beach: RGB;
  plainLow: RGB;
  plainHigh: RGB;
  mountain: RGB;
  peak: RGB;
  contour: number;
}
const MAP_LIGHT: MapPalette = { deep: [170, 190, 204], shallow: [212, 224, 231], beach: [233, 230, 219], plainLow: [224, 227, 216], plainHigh: [204, 210, 194], mountain: [178, 181, 176], peak: [136, 140, 139], contour: 0.96 };

function hsl(h: number, s: number, l: number): RGB {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => {
    const k = (n + (((h % 360) + 360) % 360) / 30) % 12;
    return (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
  };
  return [f(0), f(8), f(4)];
}

/** Haritanın renkleri gezegenin kimyasından gelir: sıvının tonu çözücüden, zeminin tonu kabuktaki elementlerden. */
export function mapPalette(chem: Chemistry): MapPalette {
  const { hue, sat } = chem.solvent;
  const g = chem.terrain.groundHue;
  const gs = chem.terrain.groundSat;
  return {
    deep: hsl(hue + 12, sat * 0.75, 0.055),
    shallow: hsl(hue, sat, 0.2),
    beach: hsl(g, gs + 0.08, 0.23),
    plainLow: hsl(g, gs, 0.105),
    plainHigh: hsl(g + 14, gs + 0.04, 0.17),
    mountain: hsl(g + 190, 0.14, 0.3),
    peak: hsl(g + 190, 0.12, 0.56),
    contour: 1.22,
  };
}

/** Üreticilerin rengi ışık pigmentinden gelir. */
export function plantColors(chem: Chemistry): [string, string] {
  const h = chem.pigment.hue;
  return [`hsl(${h} 78% 66%)`, `hsl(${(h + 22) % 360} 66% 58%)`];
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Haritayı bir kez boyar: suda kıyıya uzaklıkla derinleşen ton ve eş-derinlik
 *  çizgileri; karada yükseklik tonu, hafif kabartma ve sıradağ sırtları. */
export function renderTerrain(world: World, dark: boolean, width = 1600): HTMLCanvasElement {
  const height = Math.round((width * MAP_H) / MAP_W);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(width, height);
  const data = image.data;
  const pal = dark ? mapPalette(world.chem) : MAP_LIGHT;
  const ridgeWidth = world.ridgeWidth;
  const leaf = hsl(world.chem.pigment.hue, 0.55, dark ? 0.3 : 0.45);
  const sx = MAP_W / width;
  const sea = world.seaLevel;
  const mount = world.mountainLevel;
  const hasQuakes = world.quakes.length > 0;

  for (let py = 0; py < height; py++) {
    const y = (py + 0.5) * sx;
    for (let px = 0; px < width; px++) {
      const x = (px + 0.5) * sx;
      let h = world.sample(world.height, x, y);
      let c = world.sample(world.coast, x, y);
      let ridge = 1;
      if (hasQuakes) {
        const q = world.quakeAt(x, y);
        if (q !== null) {
          h = q ? sea - 0.1 : sea + 0.1;
          c = 3;
        } else ridge = world.sample(world.ridge, x, y);
      } else ridge = world.sample(world.ridge, x, y);
      let rgb: RGB;
      if (h < sea) {
        const t = Math.min(1, c / 26);
        rgb = mix(pal.shallow, pal.deep, t * t * (3 - 2 * t));
        const f = (c / 7) % 1;
        if (c > 1.5 && f < 0.07) rgb = [rgb[0] * pal.contour, rgb[1] * pal.contour, rgb[2] * pal.contour];
      } else {
        let base: RGB;
        if (h > mount && c > 5) base = mix(pal.mountain, pal.peak, Math.min(1, (h - mount) / 1.2));
        else base = mix(pal.plainLow, pal.plainHigh, Math.min(1, Math.max(0, (h - sea) / Math.max(0.01, mount - sea))));
        // Sıradağ: sırta yaklaştıkça koyulaşan bant, tam sırtta ince bir çizgi.
        if (ridge < ridgeWidth && c > 3.2) {
          const t = 1 - ridge / ridgeWidth;
          base = mix(base, ridge < 0.016 ? pal.peak : pal.mountain, Math.min(1, 0.55 + t * 0.45));
        }
        // Kumsal geçişi yükseklikten türetilir (hücre ızgarasının basamakları görünmesin).
        const bt = Math.min(1, Math.max(0, (h - sea) / 0.2));
        const beach = bt * bt * (3 - 2 * bt);
        const slope = world.sample(world.height, x + 5, y + 5) - world.sample(world.height, x - 5, y - 5);
        const shade = Math.min(1.1, Math.max(0.86, 1 - slope * 1.4)) * beach + (1 - beach);
        rgb = mix(pal.beach, base, beach);
        rgb = [rgb[0] * shade, rgb[1] * shade, rgb[2] * shade];
      }
      // Sık örtü (sığınak): üretici pigmentinin renginde, benekli bir doku.
      const cover = world.sample(world.thicket, x, y) - world.thicketLevel;
      if (cover > 0 && !(h >= sea && ((h > mount && c > 5) || (ridge < ridgeWidth && c > 3.2)))) {
        const speck = (px * 7 + py * 13) % 11 === 0 || (px * 5 + py * 3) % 17 === 0;
        rgb = mix(rgb, leaf, Math.min(0.42, 0.16 + cover * 0.5) + (speck ? 0.3 : 0));
      }
      const i = (py * width + px) * 4;
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

// ------------------------------------------------------------------ canlı çizimi

interface BodyPalette {
  fill: string;
  edge: string;
  inner: string;
  pale: string;
}
const paletteCache = [new WeakMap<Genome, BodyPalette>(), new WeakMap<Genome, BodyPalette>()];

function bodyPalette(g: Genome, dark: boolean): BodyPalette {
  const cache = paletteCache[dark ? 1 : 0];
  let p = cache.get(g);
  if (!p) {
    const h = Math.round(g.hue);
    const s = Math.round(g.saturation * 0.85);
    const l = Math.round(dark ? 50 + (g.lightness - 30) * 0.36 : 62 + (g.lightness - 30) * 0.42);
    p = {
      fill: `hsl(${h} ${s}% ${l}%)`,
      edge: `hsl(${h} ${Math.round(s * 0.9)}% ${dark ? l + 34 : l - 36}%)`,
      inner: `hsl(${h} ${s}% ${dark ? l + 16 : l - 16}%)`,
      pale: `hsl(${h} ${Math.round(s * 0.6)}% ${dark ? l - 12 : l + 16}%)`,
    };
    cache.set(g, p);
  }
  return p;
}

/** Gövdenin arkasında çizilen uzantılar. */
const BEHIND = new Set<OrganType>(["tentacle", "fin", "leg", "wing", "sucker", "olfactory", "filter_comb", "claw", "spike", "brood_pouch", "mucus_coat"]);

/** İç keseler: [x, y, yarıçap, dolgu] — gövde yarıçapına oranla. */
const VESICLE: Partial<Record<OrganType, [number, number, number, string]>> = {
  stomach: [0.1, 0.2, 0.26, "rgba(60,40,30,0.32)"],
  sulfur_vent_organ: [-0.3, -0.3, 0.15, "#d9b526"],
  heart: [0.32, -0.05, 0.14, "#d0484a"],
  nitrogen_sac: [-0.28, 0.32, 0.17, "#8fb6e8"],
  fat_store: [-0.48, -0.22, 0.19, "#ead48a"],
  ink_sac: [-0.52, 0.18, 0.14, "#1d1d26"],
  venom: [-0.6, -0.1, 0.13, "#8c54c4"],
};

function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawOrgan(ctx: CanvasRenderingContext2D, type: OrganType, p: number, r: number, fx: number, sy: number, pal: BodyPalette, g: Genome): void {
  const lw = Math.max(0.35, r * 0.09);
  ctx.strokeStyle = pal.edge;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  const vesicle = VESICLE[type];
  if (vesicle) {
    dot(ctx, vesicle[0] * fx, vesicle[1] * sy, vesicle[2] * r * (0.8 + p * 0.4), vesicle[3]);
    return;
  }
  switch (type) {
    case "tentacle":
      for (const k of [-1, 1]) {
        const len = r * (0.9 + p);
        ctx.beginPath();
        ctx.moveTo(-fx * 0.92, k * sy * 0.25);
        ctx.bezierCurveTo(-fx - len * 0.35, k * sy * 0.9, -fx - len * 0.65, -k * sy * 0.3, -fx - len, k * sy * 0.45);
        ctx.stroke();
      }
      break;
    case "fin": {
      const len = r * (0.55 + p * 0.55);
      ctx.fillStyle = pal.pale;
      ctx.beginPath();
      ctx.moveTo(-fx * 0.85, 0);
      ctx.lineTo(-fx - len, -sy * 0.7);
      ctx.lineTo(-fx - len * 0.7, 0);
      ctx.lineTo(-fx - len, sy * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "leg":
      for (let i = -1; i <= 1; i++) {
        const x = i * fx * 0.5;
        const len = r * (0.35 + p * 0.45);
        for (const k of [-1, 1]) line(ctx, x, k * sy * 0.85, x - r * 0.18, k * (sy + len));
      }
      break;
    case "wing":
      ctx.fillStyle = pal.pale;
      for (const k of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(fx * 0.2, k * sy * 0.7);
        ctx.quadraticCurveTo(-r * 0.2, k * (sy + r * (1 + p * 0.7)), -fx * 0.95, k * (sy + r * 0.25));
        ctx.quadraticCurveTo(-fx * 0.4, k * sy * 0.9, fx * 0.2, k * sy * 0.7);
        ctx.globalAlpha *= 0.6;
        ctx.fill();
        ctx.globalAlpha /= 0.6;
        ctx.stroke();
      }
      break;
    case "sucker":
      ctx.beginPath();
      ctx.arc(-fx - r * 0.14, 0, r * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "olfactory":
      for (const k of [-1, 1]) line(ctx, fx * 0.85, k * sy * 0.2, fx + r * (0.4 + p * 0.35), k * sy * 0.55);
      break;
    case "filter_comb":
      for (let i = -2; i <= 2; i++) line(ctx, fx * 0.9, i * sy * 0.16, fx + r * (0.3 + p * 0.3), i * sy * 0.3);
      break;
    case "claw":
      for (const k of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(fx * 0.75, k * sy * 0.5);
        ctx.quadraticCurveTo(fx + r * (0.55 + p * 0.4), k * sy * 0.95, fx + r * (0.4 + p * 0.3), k * sy * 0.12);
        ctx.lineWidth = lw * 1.5;
        ctx.stroke();
        ctx.lineWidth = lw;
      }
      break;
    case "spike":
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * 0.35 + (i / 6) * Math.PI * 1.3;
        const cx = Math.cos(a);
        const cy = Math.sin(a);
        line(ctx, cx * fx * 0.95, cy * sy * 0.95, cx * (fx + r * (0.25 + p * 0.35)), cy * (sy + r * (0.25 + p * 0.35)));
      }
      break;
    case "brood_pouch":
      ctx.fillStyle = pal.pale;
      ctx.beginPath();
      ctx.arc(-r * 0.1, sy * 0.8, r * 0.36, 0, Math.PI);
      ctx.fill();
      ctx.stroke();
      break;
    case "mucus_coat":
      ctx.globalAlpha *= 0.35;
      ctx.lineWidth = lw * 2.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, fx + r * 0.28, sy + r * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha /= 0.35;
      break;
    case "sprint_muscle":
      for (const x of [-0.15, -0.45]) {
        ctx.beginPath();
        ctx.moveTo((x + 0.2) * fx, -sy * 0.42);
        ctx.lineTo(x * fx, 0);
        ctx.lineTo((x + 0.2) * fx, sy * 0.42);
        ctx.stroke();
      }
      break;
    case "eyespot":
      dot(ctx, fx * 0.58, -sy * 0.32, r * 0.13, pal.edge);
      break;
    case "eye":
      for (const k of [-1, 1]) {
        const er = r * (0.17 + p * 0.09);
        dot(ctx, fx * 0.55, k * sy * 0.42, er, "#f4f6f8");
        ctx.beginPath();
        ctx.arc(fx * 0.55, k * sy * 0.42, er, 0, Math.PI * 2);
        ctx.stroke();
        dot(ctx, fx * 0.55 + er * 0.3, k * sy * 0.42, er * 0.5, "#14171c");
      }
      break;
    case "bioluminescence":
      dot(ctx, -fx * 0.25, -sy * 0.05, r * 0.42, "rgba(110,220,245,0.3)");
      dot(ctx, -fx * 0.25, -sy * 0.05, r * 0.14, "#8fe6f8");
      break;
    case "lateral_line":
      ctx.setLineDash([r * 0.16, r * 0.14]);
      line(ctx, -fx * 0.7, sy * 0.48, fx * 0.6, sy * 0.48);
      ctx.setLineDash([]);
      break;
    case "electroreceptor":
      ctx.beginPath();
      ctx.moveTo(fx * 0.15, -sy * 0.62);
      ctx.lineTo(fx * 0.3, -sy * 0.42);
      ctx.lineTo(fx * 0.45, -sy * 0.62);
      ctx.lineTo(fx * 0.6, -sy * 0.42);
      ctx.stroke();
      break;
    case "mouth":
      ctx.lineWidth = lw * 1.6;
      ctx.beginPath();
      ctx.arc(fx, 0, r * (0.22 + p * 0.16), Math.PI * 0.62, Math.PI * 1.38);
      ctx.stroke();
      break;
    case "symbiotic_gut_flora":
      for (const [x, y] of [
        [0.05, 0.42],
        [-0.15, 0.5],
        [0.22, 0.52],
      ])
        dot(ctx, x * fx, y * sy, r * 0.06, pal.edge);
      break;
    case "pigment":
      for (const [x, y] of [
        [0.3, 0.35],
        [-0.1, -0.45],
        [-0.4, 0.3],
        [0.1, -0.1],
      ])
        dot(ctx, x * fx, y * sy, r * 0.11, "#3f9d4a");
      break;
    case "shell":
      ctx.lineWidth = lw * (1.6 + p * 2.2);
      ctx.beginPath();
      ctx.ellipse(0, 0, fx, sy, 0, Math.PI * 0.42, Math.PI * 1.58);
      ctx.stroke();
      break;
    case "camouflage":
      for (const [x, y] of [
        [0.45, -0.1],
        [-0.2, 0.3],
        [-0.55, -0.3],
        [0.1, 0.55],
        [0.15, -0.55],
      ])
        dot(ctx, x * fx, y * sy, r * 0.09, pal.inner);
      break;
    case "chromatophore":
      dot(ctx, fx * 0.1, -sy * 0.4, r * 0.15, `hsl(${(g.hue + 130) % 360} 70% 55%)`);
      dot(ctx, -fx * 0.4, sy * 0.1, r * 0.13, `hsl(${(g.hue + 220) % 360} 70% 55%)`);
      dot(ctx, fx * 0.35, sy * 0.4, r * 0.11, `hsl(${(g.hue + 60) % 360} 70% 55%)`);
      break;
    case "regeneration":
      line(ctx, -fx * 0.45, -sy * 0.5, -fx * 0.45, -sy * 0.2);
      line(ctx, -fx * 0.45 - r * 0.15, -sy * 0.35, -fx * 0.45 + r * 0.15, -sy * 0.35);
      break;
    case "gill":
      for (let i = 0; i < 3; i++) line(ctx, fx * (0.2 + i * 0.16), sy * 0.78, fx * (0.1 + i * 0.16), sy * 0.38);
      break;
    case "lung":
      ctx.fillStyle = "rgba(244,246,248,0.55)";
      for (const k of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(fx * 0.05, k * sy * 0.3, r * 0.3, r * 0.17, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "torpor":
      ctx.beginPath();
      ctx.arc(-fx * 0.62, -sy * 0.02, r * 0.16, Math.PI * 0.3, Math.PI * 1.7);
      ctx.stroke();
      break;
    case "blubber":
      ctx.globalAlpha *= 0.55;
      ctx.beginPath();
      ctx.ellipse(0, 0, fx * 0.84, sy * 0.84, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha /= 0.55;
      break;
    case "swim_bladder":
      ctx.strokeStyle = "rgba(244,246,248,0.8)";
      ctx.beginPath();
      ctx.ellipse(-fx * 0.05, -sy * 0.3, r * 0.3, r * 0.14, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "immune_gland":
      ctx.beginPath();
      ctx.arc(fx * 0.42, sy * 0.36, r * 0.12, 0, Math.PI * 2);
      ctx.stroke();
      break;
    default:
      break;
  }
}

function bodyPath(ctx: CanvasRenderingContext2D, g: Genome, r: number): void {
  ctx.beginPath();
  if (g.stage === 0) ctx.arc(0, 0, r, 0, Math.PI * 2);
  else if (g.stage === 1) {
    // Koloni: bir arada kalmış hücreler.
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const x = Math.cos(a) * r * 0.45;
      const y = Math.sin(a) * r * 0.45;
      ctx.moveTo(x + r * 0.62, y);
      ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
    }
  } else ctx.ellipse(0, 0, r * 1.25, r * 0.85, 0, 0, Math.PI * 2);
}

/**
 * Canlıyı yerel koordinatlarda çizer (merkez 0,0; +x yönüne bakar). Gövde rengi
 * genetiktir; çekirdeğin rengi beslenme biçimini gösterir. `full` kapalıyken
 * (uzak görünüm) yalnızca gövde ve çekirdek çizilir.
 */
export interface CreatureAnim {
  /** Sahne saati (sn); simülasyon duraklayınca durur. */
  t: number;
  /** Davranış dizini (BEHAVIORS). */
  state: number;
  id: number;
}

const FAST = new Set(["flee", "escape", "hunt"]);
const STILL = new Set(["rest", "bask", "attached"]);

export function drawCreature(ctx: CanvasRenderingContext2D, g: Genome, theme: Theme, full: boolean, anim?: CreatureAnim): void {
  const r = g.radius;
  // Hareket: gövde yüzme vuruşuyla esneyip büzülür, arkadaki uzantılar (kamçı, yüzgeç,
  // bacak, dokunaç) sallanır; hız davranışa bağlıdır. Dinlenen canlı yavaşça soluk alır.
  let wag = 0;
  if (anim) {
    const beh = BEHAVIORS[anim.state] ?? "wander";
    const still = STILL.has(beh);
    const rate = FAST.has(beh) ? 15 : still ? 1.8 : beh === "graze" || beh === "scavenge" ? 5 : 8.5;
    const s = Math.sin(anim.t * rate + anim.id * 1.7);
    const amp = still ? 0.035 : FAST.has(beh) ? 0.09 : 0.06;
    const stretch = beh === "hunt" ? 1.06 : 1;
    if (still) ctx.scale(1 + amp * s, 1 + amp * s);
    else ctx.scale(stretch * (1 + amp * s), (1 - amp * s) / stretch);
    wag = s * (still ? 0.06 : FAST.has(beh) ? 0.34 : 0.24);
    if (!still) ctx.rotate(Math.sin(anim.t * rate * 0.5 + anim.id) * 0.07);
  }
  const pal = bodyPalette(g, theme.dark);
  const fx = g.stage === 2 ? r * 1.25 : r;
  const sy = g.stage === 2 ? r * 0.85 : r;
  if (full) {
    if (wag !== 0) {
      ctx.save();
      ctx.rotate(wag);
    }
    for (const organ of g.organs) if (BEHIND.has(organ.type)) drawOrgan(ctx, organ.type, organ.power, r, fx, sy, pal, g);
    if (wag !== 0) ctx.restore();
    // Erkek süsü: arkada, süs geninin büyüklüğüyle uzayan parlak iplikler.
    if (g.reproductionStrategy === "sexual" && g.sex === "m" && g.ornament > 0.12) {
      ctx.strokeStyle = `hsl(${(g.hue + 180) % 360} 80% ${theme.dark ? 68 : 48}%)`;
      ctx.lineWidth = Math.max(0.4, r * 0.11);
      ctx.lineCap = "round";
      for (let i = -1; i <= 1; i++) line(ctx, -fx * 0.8, i * sy * 0.35, -fx - r * (0.3 + g.ornament * 1.5), i * sy * (0.5 + g.ornament * 0.5));
    }
  }
  bodyPath(ctx, g, r);
  ctx.fillStyle = pal.fill;
  ctx.fill();
  ctx.strokeStyle = pal.edge;
  ctx.lineWidth = Math.max(0.5, r * 0.1);
  ctx.stroke();
  if (full) {
    if (g.stage === 2) {
      ctx.lineWidth = Math.max(0.3, r * 0.05);
      ctx.globalAlpha *= 0.5;
      for (const x of [-0.45, 0.2]) {
        ctx.beginPath();
        ctx.ellipse(x * fx, 0, r * 0.18, sy * (x < 0 ? 0.82 : 0.92), 0, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
      }
      ctx.globalAlpha /= 0.5;
    }
    for (const organ of g.organs) if (!BEHIND.has(organ.type)) drawOrgan(ctx, organ.type, organ.power, r, fx, sy, pal, g);
  }
  // Çekirdek: beslenme biçiminin rengi.
  const drift = anim ? Math.sin(anim.t * 1.3 + anim.id * 0.9) * r * 0.08 : 0;
  dot(ctx, (g.stage === 2 ? -fx * 0.12 : 0) + drift, anim ? Math.cos(anim.t * 1.1 + anim.id) * r * 0.06 : 0, r * (full ? 0.3 : 0.42), theme.diet[g.diet]);
}

// ------------------------------------------------------------------ sahne

export type Tool = "select" | "plants" | "place" | "meteor" | "remove";

const TOOL_RADIUS: Partial<Record<Tool, number>> = { plants: 34, meteor: 65 };

export interface SceneState {
  selected: number;
  senseRadius: number;
  highlightSpecies: number;
  tool: Tool;
}

const EFFECT_SECONDS: Record<string, number> = { meteor: 2.8, quake: 2.4, climate: 3.2, wind: 0 };
const easeOut = (k: number): number => 1 - (1 - k) * (1 - k) * (1 - k);

/** Dünya olayı canlandırması. `s` olayın başından beri geçen gerçek saniye, `px` bir ekran pikselinin harita birimi. */
function drawEffect(ctx: CanvasRenderingContext2D, e: { x: number; y: number; r: number; kind: string; warm: boolean }, s: number, px: number, theme: Theme): void {
  const { x, y, r } = e;
  const noise = (i: number): number => {
    const v = Math.sin(i * 127.1 + x * 0.37 + y * 0.71) * 43758.5453;
    return v - Math.floor(v);
  };
  if (e.kind === "meteor") {
    const FALL = 0.42;
    if (s < FALL) {
      // Düşüş: sağ üstten gelen, başı akkor, kuyruğu sönen bir iz.
      const q = s / FALL;
      const hx = x + (1 - q) * r * 2.4;
      const hy = y - (1 - q) * r * 3.4;
      const tail = ctx.createLinearGradient(hx, hy, hx + r * 1.1, hy - r * 1.55);
      tail.addColorStop(0, "rgba(255, 244, 214, 0.95)");
      tail.addColorStop(0.35, "rgba(255, 150, 80, 0.55)");
      tail.addColorStop(1, "rgba(255, 107, 94, 0)");
      ctx.strokeStyle = tail;
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(3 * px, r * 0.09);
      line(ctx, hx, hy, hx + r * 1.1, hy - r * 1.55);
      ctx.lineCap = "butt";
      const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 0.42);
      glow.addColorStop(0, "rgba(255, 250, 235, 1)");
      glow.addColorStop(0.3, "rgba(255, 190, 110, 0.7)");
      glow.addColorStop(1, "rgba(255, 107, 94, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(hx, hy, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const k = Math.min(1, (s - FALL) / (EFFECT_SECONDS.meteor - FALL));
    const out = easeOut(k);
    // Yanık izi: çarpma yerinde koyu, yavaş sönen bir leke.
    const scorch = ctx.createRadialGradient(x, y, 0, x, y, r * 0.75);
    scorch.addColorStop(0, `rgba(10, 4, 6, ${0.6 * (1 - k)})`);
    scorch.addColorStop(1, "rgba(10, 4, 6, 0)");
    ctx.fillStyle = scorch;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.75, 0, Math.PI * 2);
    ctx.fill();
    // Ateş topu: ilk anda beyaz, hızla turuncuya dönüp söner.
    if (k < 0.3) {
      const f = k / 0.3;
      const ball = ctx.createRadialGradient(x, y, 0, x, y, r * (0.5 + f * 0.8));
      ball.addColorStop(0, `rgba(255, 252, 240, ${1 - f})`);
      ball.addColorStop(0.45, `rgba(255, 170, 90, ${0.75 * (1 - f)})`);
      ball.addColorStop(1, "rgba(255, 107, 94, 0)");
      ctx.fillStyle = ball;
      ctx.beginPath();
      ctx.arc(x, y, r * (0.5 + f * 0.8), 0, Math.PI * 2);
      ctx.fill();
    }
    // Şok dalgası: biri hızlı ve ince, biri yavaş ve kalın iki halka.
    ctx.strokeStyle = theme.critical;
    for (const [delay, reach, width] of [
      [0, 1.75, 3],
      [0.14, 1.15, 6],
    ]) {
      const w = Math.min(1, Math.max(0, (k - delay) / (1 - delay)));
      if (w <= 0) continue;
      ctx.globalAlpha = (1 - w) * 0.9;
      ctx.lineWidth = (width * (1 - w) + 0.6) * px + r * 0.012;
      ctx.beginPath();
      ctx.arc(x, y, r * (0.15 + easeOut(w) * reach), 0, Math.PI * 2);
      ctx.stroke();
    }
    // Savrulan parçalar: merkezden dışarı kısa izler.
    ctx.strokeStyle = "#ffd9a0";
    ctx.lineCap = "round";
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + noise(i) * 0.5;
      const far = r * (0.25 + out * (0.7 + noise(i + 40) * 1.1));
      const len = r * 0.2 * (1 - k);
      ctx.globalAlpha = (1 - k) * (0.5 + noise(i + 80) * 0.5);
      ctx.lineWidth = (1 + noise(i + 20) * 1.6) * px + r * 0.008;
      line(ctx, x + Math.cos(a) * far, y + Math.sin(a) * far, x + Math.cos(a) * (far + len), y + Math.sin(a) * (far + len));
    }
    ctx.lineCap = "butt";
    ctx.globalAlpha = 1;
  } else if (e.kind === "quake") {
    const k = Math.min(1, s / EFFECT_SECONDS.quake);
    // Sarsıntı: titreyen, art arda yayılan halkalar.
    ctx.strokeStyle = theme.ink;
    for (let ring = 0; ring < 3; ring++) {
      const w = Math.min(1, Math.max(0, (k - ring * 0.16) / (1 - ring * 0.16)));
      if (w <= 0) continue;
      const shake = Math.floor(s * 22);
      ctx.globalAlpha = (1 - w) * 0.75;
      ctx.lineWidth = (2.4 * (1 - w) + 0.6) * px;
      ctx.beginPath();
      for (let i = 0; i <= 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        const rr = r * (0.4 + easeOut(w) * 2.2) * (1 + (noise((i % 36) + ring * 50 + shake) - 0.5) * 0.09 * (1 - w));
        if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.stroke();
    }
    // Çatlaklar: merkezden uzayan kırık çizgiler.
    ctx.globalAlpha = Math.min(1, (1 - k) * 1.6) * 0.85;
    ctx.lineWidth = 1.4 * px + r * 0.02;
    ctx.lineJoin = "round";
    const grow = easeOut(Math.min(1, k * 2.2));
    for (let crack = 0; crack < 6; crack++) {
      let a = (crack / 6) * Math.PI * 2 + noise(crack) * 0.7;
      let cx = x;
      let cy = y;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let seg = 0; seg < 5; seg++) {
        if (seg / 5 > grow) break;
        a += (noise(crack * 10 + seg) - 0.5) * 1.1;
        cx += Math.cos(a) * r * 0.24;
        cy += Math.sin(a) * r * 0.24;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (e.kind === "climate") {
    // İklim dalgası: merkezden yayılan geniş, yumuşak bir renk cephesi (sıcak turuncu, soğuk mavi).
    const k = Math.min(1, s / EFFECT_SECONDS.climate);
    const rgb = e.warm ? "255, 168, 88" : "120, 190, 255";
    const front = r * 2.6 * easeOut(k);
    const band = ctx.createRadialGradient(x, y, Math.max(0, front - r * 0.9), x, y, front + 1);
    band.addColorStop(0, `rgba(${rgb}, 0)`);
    band.addColorStop(0.75, `rgba(${rgb}, ${0.3 * (1 - k)})`);
    band.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    ctx.fillStyle = `rgba(${rgb}, ${0.1 * Math.sin(Math.PI * k)})`;
    ctx.fillRect(0, 0, MAP_W, MAP_H);
  }
}

export class Scene {
  public cx = MAP_W / 2;
  public cy = MAP_H / 2;
  public zoom = 0;
  public onTap: (x: number, y: number, tolerance: number) => void = () => {};
  public onUserPan: () => void = () => {};
  /** Sağda panelin kapattığı genişlik (px): açılış görünümü kalan alana ortalanır. */
  public padRight = 0;
  private glow = new Map<string, HTMLCanvasElement>();
  /** İlk canlının belirişi: kamera ona yakın başlar, sonra tüm haritaya açılır. */
  private genesis: { x: number; y: number; t0: number; hold: boolean } | null = null;
  private animT = 0;
  private animLast = 0;
  private animSimT = -1;
  private plantKey = "";
  private plantCol: [string, string] = ["", ""];
  /** Çözünmüş besin katmanı: ızgara hücresi başına bir piksel; haritaya yumuşatılarak gerilir. */
  private soupLayer: HTMLCanvasElement | null = null;
  private soupFrom: Uint8Array | null = null;
  /** Her canlının çizim ölçeği: hedefe yumuşakça yaklaşır, böylece büyüme ve küçülme sıçramaz. */
  private sizes = new Map<number, number>();
  /** Dünya olaylarının canlandırması gerçek zamanla akar: simülasyon hızlıyken de izlenebilir. */
  private effects: { key: string; x: number; y: number; r: number; kind: string; t0: number; warm: boolean }[] = [];
  private effectKeys = new Set<string>();
  private readonly ctx: CanvasRenderingContext2D;
  private terrain: HTMLCanvasElement | null = null;
  private terrainKey = "";
  private width = 0;
  private height = 0;
  private hover: { x: number; y: number } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private dragged = 0;
  private pinch = 0;

  constructor(
    public readonly canvas: HTMLCanvasElement,
    public theme: Theme
  ) {
    this.ctx = canvas.getContext("2d")!;
    canvas.addEventListener("pointerdown", (e) => {
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.genesis = null;
      if (this.pointers.size === 1) this.dragged = 0;
      this.pinch = 0;
    });
    canvas.addEventListener("pointermove", (e) => {
      const rect = canvas.getBoundingClientRect();
      this.hover = this.toWorld(e.clientX - rect.left, e.clientY - rect.top);
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        this.dragged += Math.abs(dx) + Math.abs(dy);
        if (this.dragged > 4) {
          this.cx -= dx / this.zoom;
          this.cy -= dy / this.zoom;
          this.clamp();
          this.onUserPan();
        }
      } else if (this.pointers.size === 2) {
        const [a, b] = Array.from(this.pointers.values());
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch > 0) this.zoomAt((a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, dist / this.pinch);
        this.pinch = dist;
        this.dragged = 99;
      }
    });
    const release = (e: PointerEvent): void => {
      const had = this.pointers.delete(e.pointerId);
      this.pinch = 0;
      if (had && e.type === "pointerup" && this.pointers.size === 0 && this.dragged <= 4) {
        const rect = canvas.getBoundingClientRect();
        const p = this.toWorld(e.clientX - rect.left, e.clientY - rect.top);
        this.onTap(p.x, p.y, (e.pointerType === "touch" ? 22 : 12) / this.zoom);
      }
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("pointerleave", () => (this.hover = null));
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        this.zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0015));
      },
      { passive: false }
    );
  }

  private fitZoom(): number {
    return Math.min(this.width / MAP_W, this.height / MAP_H);
  }

  /** Açılış görünümü: alanı doldurur, ama haritanın en çok üçte birini dışarıda bırakır. */
  private homeZoom(): number {
    const w = Math.max(200, this.width - this.padRight);
    const contain = Math.min(w / MAP_W, this.height / MAP_H);
    return Math.max(this.fitZoom(), Math.min(Math.max(w / MAP_W, this.height / MAP_H), contain * 1.35));
  }

  public fit(): void {
    this.zoom = this.homeZoom();
    this.cx = MAP_W / 2 + this.padRight / 2 / this.zoom;
    this.cy = MAP_H / 2;
    this.clamp();
  }

  /** İlk hücrelere yakınlaşır. `hold` ile kamera orada bekler (köken filmi oynarken);
   *  `hold` olmadan çağrılınca ışık halkası yayılır ve kamera bütün haritaya açılır. */
  public beginGenesis(hold = false): void {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    this.genesis = { x: this.genesis?.x ?? MAP_W / 2, y: this.genesis?.y ?? MAP_H / 2, t0: performance.now(), hold };
  }

  /** Işıma lekesi: beslenme rengine boyanmış, kenara doğru sönen bir disk. */
  private glowSprite(color: string): HTMLCanvasElement {
    let sprite = this.glow.get(color);
    if (!sprite) {
      sprite = document.createElement("canvas");
      sprite.width = sprite.height = 64;
      const g = sprite.getContext("2d")!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, color);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.globalAlpha = 0.9;
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      this.glow.set(color, sprite);
    }
    return sprite;
  }

  public zoomBy(factor: number): void {
    this.zoomAt(this.width / 2, this.height / 2, factor);
  }

  private zoomAt(sx: number, sy: number, factor: number): void {
    const before = this.toWorld(sx, sy);
    this.zoom = Math.min(7, Math.max(this.fitZoom(), this.zoom * factor));
    const after = this.toWorld(sx, sy);
    this.cx += before.x - after.x;
    this.cy += before.y - after.y;
    this.clamp();
  }

  private clamp(): void {
    const hw = this.width / 2 / this.zoom;
    const hh = this.height / 2 / this.zoom;
    const pad = this.padRight / this.zoom;
    this.cx = hw * 2 - pad >= MAP_W ? MAP_W / 2 + pad / 2 : Math.min(MAP_W - hw + pad, Math.max(hw, this.cx));
    this.cy = hh >= MAP_H / 2 ? MAP_H / 2 : Math.min(MAP_H - hh, Math.max(hh, this.cy));
  }

  public center(x: number, y: number): void {
    this.cx = x;
    this.cy = y;
    this.clamp();
  }

  public toWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: this.cx + (sx - this.width / 2) / this.zoom, y: this.cy + (sy - this.height / 2) / this.zoom };
  }

  /** Canlıların uzak görünümde seçilebilir kalması için çizim büyütmesi. */
  private boost(): number {
    return this.zoom >= 1.4 ? 1 : Math.pow(Math.min(2.4, 1.4 / this.zoom), 0.7);
  }

  public draw(view: View, state: SceneState): void {
    const canvas = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    if (w !== this.width || h !== this.height || canvas.width !== Math.round(w * dpr)) {
      const wasFit = this.zoom === 0 || Math.abs(this.zoom - this.homeZoom()) < 1e-6;
      this.width = w;
      this.height = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      if (wasFit) this.fit();
      else this.clamp();
    }
    let genesisT = -1;
    if (this.genesis) {
      genesisT = this.genesis.hold ? 0 : (performance.now() - this.genesis.t0) / 1000;
      // Hücreler yüzdükçe kamera ve halka onların ortasını izler.
      const founders = Math.min(view.frame.n, INITIAL_CREATURES);
      if (founders > 0 && genesisT < 3) {
        let x = 0;
        let y = 0;
        for (let i = 0; i < founders; i++) {
          x += view.frame.c[i * STRIDE + 1];
          y += view.frame.c[i * STRIDE + 2];
        }
        this.genesis.x = x / founders;
        this.genesis.y = y / founders;
      }
      if (genesisT > 5) {
        this.genesis = null;
        genesisT = -1;
        this.fit();
      } else {
        const k = Math.min(1, Math.max(0, (genesisT - 2.2) / 2.8));
        const ease = k * k * (3 - 2 * k);
        const home = this.homeZoom();
        const near = Math.min(7, home * 7);
        this.zoom = near * Math.pow(home / near, ease);
        this.cx = this.genesis.x + (MAP_W / 2 - this.genesis.x) * ease + this.padRight / 2 / this.zoom;
        this.cy = this.genesis.y + (MAP_H / 2 - this.genesis.y) * ease;
        this.clamp();
      }
    }
    const theme = this.theme;
    const key = `${view.epoch}:${view.world.version}:${theme.dark}`;
    if (!this.terrain || this.terrainKey !== key) {
      this.terrain = renderTerrain(view.world, theme.dark);
      this.terrainKey = key;
    }
    if (this.plantKey !== String(view.epoch)) {
      this.plantKey = String(view.epoch);
      this.plantCol = plantColors(view.world.chem);
    }
    // Animasyon saati yalnızca simülasyon ilerlerken akar: duraklatınca canlılar da durur.
    const nowMs = performance.now();
    if (view.frame.time !== this.animSimT) this.animT += Math.min(0.1, (nowMs - this.animLast) / 1000);
    this.animSimT = view.frame.time;
    this.animLast = nowMs;
    const anim: CreatureAnim = { t: this.animT, state: 0, id: 0 };

    const ctx = this.ctx;
    const frame = view.frame;
    const zoom = this.zoom;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = theme.sceneBg;
    ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2 - this.cx * zoom, h / 2 - this.cy * zoom);
    ctx.scale(zoom, zoom);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(this.terrain, 0, 0, MAP_W, MAP_H);

    const boost = this.boost();
    const x0 = this.cx - w / 2 / zoom - 30;
    const x1 = this.cx + w / 2 / zoom + 30;
    const y0 = this.cy - h / 2 / zoom - 30;
    const y1 = this.cy + h / 2 / zoom + 30;

    // Çözünmüş besin: zenginliğiyle orantılı soluk bir ışıma (sıvının rengini açar).
    const soup = view.ui?.soup;
    if (soup) {
      if (this.soupFrom !== soup) {
        this.soupFrom = soup;
        this.soupLayer ??= Object.assign(document.createElement("canvas"), { width: SOUP_COLS, height: SOUP_ROWS });
        const sctx = this.soupLayer.getContext("2d")!;
        const image = sctx.createImageData(SOUP_COLS, SOUP_ROWS);
        for (let i = 0; i < soup.length; i++) {
          image.data[i * 4] = 214;
          image.data[i * 4 + 1] = 236;
          image.data[i * 4 + 2] = 255;
          image.data[i * 4 + 3] = Math.round(soup[i] * 0.3);
        }
        sctx.putImageData(image, 0, 0);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.soupLayer!, 0, 0, MAP_W, MAP_H);
    }

    // Bitkiler
    const plants = frame.plants;
    const ps = Math.min(1.5 * boost, 5 / zoom);
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = this.plantCol[pass];
      ctx.beginPath();
      for (let i = 0; i < plants.length; i += 2) {
        const land = (plants[i + 1] & PLANT_LAND_BIT) !== 0;
        if (land !== (pass === 1)) continue;
        const x = plants[i] / PLANT_SCALE;
        const y = (plants[i + 1] & ~PLANT_LAND_BIT) / PLANT_SCALE;
        if (x < x0 || x > x1 || y < y0 || y > y1) continue;
        ctx.moveTo(x + ps, y);
        ctx.arc(x, y, ps, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    // Cesetler ve yumurtalar
    const corpses = frame.corpses;
    ctx.lineWidth = 0.8 * boost;
    for (let i = 0; i < corpses.length; i += 5) {
      const r = corpses[i + 2] * boost * 0.8;
      ctx.globalAlpha = 0.25 + corpses[i + 3] * 0.55;
      ctx.strokeStyle = theme.ink3;
      ctx.setLineDash([1.6 * boost, 1.4 * boost]);
      ctx.beginPath();
      ctx.arc(corpses[i], corpses[i + 1], r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    const eggs = frame.eggs;
    ctx.strokeStyle = theme.ink2;
    ctx.fillStyle = theme.surface;
    for (let i = 0; i < eggs.length; i += 2) {
      ctx.beginPath();
      ctx.ellipse(eggs[i], eggs[i + 1], 2.4 * boost, 1.8 * boost, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Canlılar: önce ışıma (gece güçlenir), sonra gövdeler.
    const c = frame.c;
    if (this.sizes.size > frame.n * 2 + 64) this.sizes.clear();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.2 + (1 - frame.light) * 0.3;
    for (let i = 0; i < frame.n; i++) {
      const o = i * STRIDE;
      const g = view.genomes.get(c[o]);
      if (!g || c[o + 1] < x0 || c[o + 1] > x1 || c[o + 2] < y0 || c[o + 2] > y1) continue;
      if (state.highlightSpecies !== 0 && g.speciesId !== state.highlightSpecies) continue;
      const gr = g.radius * boost * 3.4 * (this.sizes.get(c[o]) ?? 1);
      ctx.drawImage(this.glowSprite(theme.diet[g.diet]), c[o + 1] - gr, c[o + 2] - gr, gr * 2, gr * 2);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    let selX = NaN;
    let selY = NaN;
    let selR = 0;
    for (let i = 0; i < frame.n; i++) {
      const o = i * STRIDE;
      const id = c[o];
      const x = c[o + 1];
      const y = c[o + 2];
      const g = view.genomes.get(id);
      if (!g) continue;
      // Beden yaşla büyür (yavru erişkinin yarısı kadardır), tokken dolgunlaşır, açken büzülür.
      const mature = c[o + 8];
      const want = (0.5 + 0.5 * mature * (2 - mature)) * (0.86 + 0.2 * Math.min(1, c[o + 4]));
      const had = this.sizes.get(id) ?? want;
      const size = had + (want - had) * 0.08;
      this.sizes.set(id, size);
      if (id === state.selected) {
        selX = x;
        selY = y;
        selR = g.radius * boost * size;
      }
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const flags = c[o + 6];
      const dim = state.highlightSpecies !== 0 && g.speciesId !== state.highlightSpecies;
      ctx.globalAlpha = dim ? 0.16 : 1;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(c[o + 3]);
      ctx.scale(boost * size, boost * size);
      anim.state = c[o + 7];
      anim.id = id;
      drawCreature(ctx, g, theme, g.radius * boost * size * zoom >= 3.4, anim);
      ctx.restore();
      if (dim) continue;
      const rr = g.radius * boost * size;
      if (flags & FLAG.hidden) {
        // Sığınakta: bitki örtüsünün renginde, yaprak gibi kesik bir halka.
        ctx.strokeStyle = this.plantCol[flags & FLAG.land ? 1 : 0];
        ctx.lineWidth = 1.1 * boost;
        ctx.globalAlpha = 0.75;
        ctx.setLineDash([2.6 * boost, 2.2 * boost]);
        ctx.beginPath();
        ctx.arc(x, y, rr * 1.25 + 0.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      if (flags & FLAG.infected) {
        ctx.strokeStyle = theme.warn;
        ctx.lineWidth = 0.9 * boost;
        ctx.setLineDash([1.5 * boost, 1.5 * boost]);
        ctx.beginPath();
        ctx.arc(x, y, rr * 1.45 + 1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (flags & (FLAG.hurt | FLAG.flash)) {
        ctx.strokeStyle = theme.critical;
        ctx.lineWidth = 0.8 * boost;
        ctx.globalAlpha = flags & FLAG.hurt ? 0.9 : 0.45;
        ctx.beginPath();
        ctx.arc(x, y, rr * 1.3 + 0.8, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Enerji azaldıkça kısalan ince bir yay (yalnızca yakın görünümde).
      if (zoom * boost > 2.2) {
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = theme.ink2;
        ctx.lineWidth = 1.2 / zoom;
        ctx.beginPath();
        ctx.arc(x, y, rr * 1.75 + 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, c[o + 4])));
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // İlk canlı: film haritaya erirken iki kardeş hücrenin çevresinden bir ışık halkası yayılır.
    if (this.genesis && genesisT >= 0) {
      const gx = this.genesis.x;
      const gy = this.genesis.y;
      const px = 1 / zoom;
      ctx.strokeStyle = theme.accent;
      if (genesisT >= 1.5 && genesisT < 3) {
        const p = (genesisT - 1.5) / 1.5;
        ctx.globalAlpha = (1 - p) * 0.9;
        ctx.lineWidth = (3 - p * 2) * px;
        ctx.beginPath();
        ctx.arc(gx, gy, p * 220 * px + 6 * px, 0, Math.PI * 2);
        ctx.stroke();
      }
      const fade = Math.min(1, Math.max(0, (genesisT - 0.6) / 0.6)) * Math.min(1, Math.max(0, (4 - genesisT) / 0.8));
      if (fade > 0) {
        ctx.globalAlpha = fade;
        ctx.fillStyle = theme.ink;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.font = `700 ${18 * px}px "Unbounded", "Onest", sans-serif`;
        ctx.fillText("İlk canlılar", gx, gy + 104 * px);
        ctx.font = `${12.5 * px}px "Onest", system-ui, sans-serif`;
        ctx.fillStyle = theme.ink2;
        ctx.fillText("Bütün yaşam bu iki kardeş hücrenin soyundan gelecek.", gx, gy + 130 * px);
      }
      ctx.globalAlpha = 1;
    }

    // Gece: haritanın üstüne inen koyu bir örtü.
    const dark = 1 - frame.light;
    if (dark > 0.02) {
      ctx.fillStyle = `rgba(6,10,22,${(dark * 0.3).toFixed(3)})`;
      ctx.fillRect(0, 0, MAP_W, MAP_H);
    }

    // Dünya olayları: karede yeni görülen her olay bir canlandırma başlatır.
    const present = new Set<string>();
    for (const f of frame.flashes) {
      const key = `${view.epoch}:${f.kind}:${f.x.toFixed(1)}:${f.y.toFixed(1)}`;
      present.add(key);
      if (this.effectKeys.has(key)) continue;
      this.effectKeys.add(key);
      this.effects.push({ key, x: f.x, y: f.y, r: f.r, kind: f.kind, t0: nowMs, warm: view.ui?.climate?.warm ?? true });
    }
    for (const key of this.effectKeys) if (!present.has(key)) this.effectKeys.delete(key);
    this.effects = this.effects.filter((e) => nowMs - e.t0 < EFFECT_SECONDS[e.kind] * 1000 && e.key.startsWith(`${view.epoch}:`));
    for (const e of this.effects) drawEffect(ctx, e, (nowMs - e.t0) / 1000, 1 / zoom, theme);
    ctx.globalAlpha = 1;

    // Seçim: nişangâh ve algı menzili
    if (!Number.isNaN(selX)) {
      const px = 1 / zoom;
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 1.5 * px;
      const rr = selR * 1.5 + 5 * px;
      ctx.beginPath();
      ctx.arc(selX, selY, rr, 0, Math.PI * 2);
      ctx.stroke();
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        line(ctx, selX + Math.cos(a) * rr, selY + Math.sin(a) * rr, selX + Math.cos(a) * (rr + 5 * px), selY + Math.sin(a) * (rr + 5 * px));
      }
      if (state.senseRadius > 0) {
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = px;
        ctx.setLineDash([4 * px, 4 * px]);
        ctx.beginPath();
        ctx.arc(selX, selY, state.senseRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }

    // Araç önizlemesi
    const toolR = TOOL_RADIUS[state.tool];
    if (this.hover && toolR) {
      ctx.strokeStyle = state.tool === "meteor" ? theme.critical : theme.accent;
      ctx.lineWidth = 1.2 / zoom;
      ctx.setLineDash([5 / zoom, 4 / zoom]);
      ctx.beginPath();
      ctx.arc(this.hover.x, this.hover.y, toolR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Ölçek çubuğu
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const units = [10, 20, 50, 100, 200, 500].find((u) => u * zoom >= 56) ?? 500;
    const bw = units * zoom;
    const bx = this.padRight > 0 ? 84 : w - bw - 14;
    const by = h - 22;
    ctx.strokeStyle = theme.ink2;
    ctx.fillStyle = theme.ink2;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + 0.5, by - 4);
    ctx.lineTo(bx + 0.5, by + 0.5);
    ctx.lineTo(bx + bw + 0.5, by + 0.5);
    ctx.lineTo(bx + bw + 0.5, by - 4);
    ctx.stroke();
    ctx.font = `10px "Onest", system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`${units} birim`, bx, by - 8);
  }

  /** Verilen dünya noktasına en yakın canlının kimliği (yoksa 0). */
  public pick(view: View, x: number, y: number, tolerance: number): number {
    const c = view.frame.c;
    const boost = this.boost();
    let best = 0;
    let bestD = tolerance;
    for (let i = 0; i < view.frame.n; i++) {
      const o = i * STRIDE;
      const g = view.genomes.get(c[o]);
      if (!g) continue;
      const d = Math.hypot(c[o + 1] - x, c[o + 2] - y) - g.radius * boost;
      if (d < bestD) {
        bestD = d;
        best = c[o];
      }
    }
    return best;
  }

  public position(view: View, id: number): { x: number; y: number } | null {
    const c = view.frame.c;
    for (let i = 0; i < view.frame.n; i++) if (c[i * STRIDE] === id) return { x: c[i * STRIDE + 1], y: c[i * STRIDE + 2] };
    return null;
  }
}
