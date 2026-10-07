import { Chemistry } from "./chemistry";
import { GRID_COLS, GRID_ROWS, MAP_H, MAP_W, World } from "./world";

/**
 * Zeminin rengi: haritayı çizen kod ile kamuflaj mekaniği aynı kaynaktan okur. Böylece izleyenin
 * gördüğü renk ile avcının "gördüğü" renk tutar. DOM'a bağlı değildir (simülasyon Node'da da koşar).
 */

export type RGB = [number, number, number];

export interface MapPalette {
  deep: RGB;
  shallow: RGB;
  beach: RGB;
  plainLow: RGB;
  plainHigh: RGB;
  mountain: RGB;
  peak: RGB;
  contour: number;
}

export const MAP_LIGHT: MapPalette = { deep: [170, 190, 204], shallow: [212, 224, 231], beach: [233, 230, 219], plainLow: [224, 227, 216], plainHigh: [204, 210, 194], mountain: [178, 181, 176], peak: [136, 140, 139], contour: 0.96 };

export function hsl(h: number, s: number, l: number): RGB {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => {
    const k = (n + (((h % 360) + 360) % 360) / 30) % 12;
    return (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
  };
  return [f(0), f(8), f(4)];
}

export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

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

/** Sık örtü ve üretici öbeklerinin rengi: ışık pigmentinden. */
export function leafColor(chem: Chemistry, dark: boolean): RGB {
  return hsl(chem.pigment.hue, 0.55, dark ? 0.3 : 0.45);
}

/** Bir noktanın zemin rengi (sıvının derinliği, kara, dağ, kumsal, sık örtü). `speck` yalnızca çizimdeki benek dokusu içindir. */
export function groundRGB(world: World, pal: MapPalette, leaf: RGB, x: number, y: number, speck = false): RGB {
  const sea = world.seaLevel;
  const mount = world.mountainLevel;
  const ridgeWidth = world.ridgeWidth;
  let h = world.sample(world.height, x, y);
  let c = world.sample(world.coast, x, y);
  let ridge = 1;
  const q = world.quakes.length > 0 ? world.quakeAt(x, y) : null;
  if (q !== null) {
    h = q ? sea - 0.1 : sea + 0.1;
    c = 3;
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
    rgb = mix(rgb, leaf, Math.min(0.42, 0.16 + cover * 0.5) + (speck ? 0.3 : 0));
  }
  return rgb;
}

// ------------------------------------------------------------------ ton karşılaştırması

/** Ton düzlemindeki konum: (doygunluk·cos ton, doygunluk·sin ton). Gri bir renk merkeze düşer. */
export type Tone = [number, number];

export function toneOfHSL(hDeg: number, s: number): Tone {
  const r = (hDeg * Math.PI) / 180;
  return [s * Math.cos(r), s * Math.sin(r)];
}

export function toneOfRGB(rgb: RGB): Tone {
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 1e-6) return [0, 0];
  const l = (max + min) / 2;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d + 6) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return toneOfHSL(h * 60, Math.min(1, s));
}

/**
 * İki tonun benzerliği 0–1. Düzlemdeki uzaklık, iki doygunluğun toplamına bölünür: aynı ton 1, karşıt ton 0,
 * gri üstüne gri 1, gri üstüne doygun renk 0. Ton farkı çembersel olduğundan 0° ile 359° komşudur.
 */
export function toneMatch(a: Tone, b: Tone): number {
  const total = Math.hypot(a[0], a[1]) + Math.hypot(b[0], b[1]);
  if (total < 1e-6) return 1;
  return 1 - Math.min(1, Math.hypot(a[0] - b[0], a[1] - b[1]) / total);
}

/** Canlının gövde rengi (çizimle aynı formül): HSL, doygunluk 0–1. */
export function bodyHSL(g: { hue: number; saturation: number; lightness: number }, dark: boolean): { h: number; s: number; l: number } {
  return { h: Math.round(g.hue), s: Math.round(g.saturation * 0.85) / 100, l: Math.round(dark ? 50 + (g.lightness - 30) * 0.36 : 62 + (g.lightness - 30) * 0.42) / 100 };
}

/** Haritanın hücre başına ton önbelleği: zemin rengi hücre merkezinden okunur; deprem olunca yenilenir. */
export class GroundTone {
  private readonly pal: MapPalette;
  private readonly leaf: RGB;
  private readonly tones = new Float32Array(GRID_COLS * GRID_ROWS * 2).fill(Number.NaN);
  private version: number;

  constructor(private readonly world: World) {
    this.pal = mapPalette(world.chem);
    this.leaf = leafColor(world.chem, true);
    this.version = world.version;
  }

  /** Zeminin tonu; `cover` (0–1) örtü oranı kadar üretici rengine kaydırılır. */
  public at(x: number, y: number, cover: number): Tone {
    if (this.version !== this.world.version) {
      this.tones.fill(Number.NaN);
      this.version = this.world.version;
    }
    const cx = Math.min(GRID_COLS - 1, Math.max(0, Math.floor((x / MAP_W) * GRID_COLS)));
    const cy = Math.min(GRID_ROWS - 1, Math.max(0, Math.floor((y / MAP_H) * GRID_ROWS)));
    const i = (cy * GRID_COLS + cx) * 2;
    if (Number.isNaN(this.tones[i])) {
      const t = toneOfRGB(groundRGB(this.world, this.pal, this.leaf, ((cx + 0.5) * MAP_W) / GRID_COLS, ((cy + 0.5) * MAP_H) / GRID_ROWS));
      this.tones[i] = t[0];
      this.tones[i + 1] = t[1];
    }
    const g: Tone = [this.tones[i], this.tones[i + 1]];
    if (cover <= 0) return g;
    // Üretici öbeği: zemin, örtü oranı kadar yaprak rengine kayar (çizimdeki en çok %42'lik karışım).
    const l = toneOfRGB(this.leaf);
    const w = 0.42 * Math.min(1, cover);
    return [g[0] + (l[0] - g[0]) * w, g[1] + (l[1] - g[1]) * w];
  }
}
