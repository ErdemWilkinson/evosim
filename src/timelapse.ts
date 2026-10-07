import { DIETS } from "./genome";
import { Theme } from "./render";
import { MAP_H, MAP_W } from "./world";

/**
 * Zaman atlamalı kayıt: dünya ilerledikçe küçük anlık görüntüler biriktirilir, sonra yaklaşık
 * bir dakikada yeniden oynatılır. Yalnızca arayüzdedir; benzetim durumuna dokunmaz ve rastgelelik kullanmaz.
 *
 * Bir anlık görüntü canlı başına 9 bayttır: kimlik (4), x ve y (2+2, harita 65535 adıma bölünmüş),
 * beslenme sınıfı (1). Sayı üst sınıra gelince her ikinci kare atılır ve aralık ikiye katlanır;
 * böylece bellek sabit kalır, kayıt tüm geçmişi daha seyrek örnekleyerek korur.
 */

const BASE_INTERVAL = 6;
const MAX_FRAMES = 600;
const PLAY_SECONDS = 60;

interface Shot {
  t: number;
  ids: Uint32Array;
  xy: Uint16Array;
  cls: Uint8Array;
}

let shots: Shot[] = [];
let interval = BASE_INTERVAL;
let lastT = -Infinity;

export function resetTimelapse(): void {
  shots = [];
  interval = BASE_INTERVAL;
  lastT = -Infinity;
}

/** Çerçeve verisinden bir kare ekler; aralık dolmadıysa hiçbir şey yapmaz. */
export function recordTimelapse(time: number, n: number, c: Float32Array, stride: number, diets: (id: number) => number): void {
  if (time < lastT) resetTimelapse();
  if (time < lastT + interval) return;
  lastT = time;
  const ids = new Uint32Array(n);
  const xy = new Uint16Array(n * 2);
  const cls = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * stride;
    ids[i] = c[o];
    xy[i * 2] = Math.max(0, Math.min(65535, (c[o + 1] / MAP_W) * 65535));
    xy[i * 2 + 1] = Math.max(0, Math.min(65535, (c[o + 2] / MAP_H) * 65535));
    cls[i] = diets(ids[i]);
  }
  shots.push({ t: time, ids, xy, cls });
  if (shots.length > MAX_FRAMES) {
    shots = shots.filter((_, i) => i % 2 === 0);
    interval *= 2;
  }
}

export function timelapseStats(): { frames: number; bytes: number; span: number; interval: number } {
  let bytes = 0;
  for (const s of shots) bytes += s.ids.byteLength + s.xy.byteLength + s.cls.byteLength;
  return { frames: shots.length, bytes, span: shots.length > 1 ? shots[shots.length - 1].t - shots[0].t : 0, interval };
}

export const timelapseSeconds = PLAY_SECONDS;

export function dietClass(diet: string): number {
  return Math.max(0, DIETS.indexOf(diet as (typeof DIETS)[number]));
}

/** `progress` 0–1: iki komşu kare arasında kimliği eşleşen canlıların konumu aradeğerlenir. */
export function drawTimelapse(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number, theme: Theme): { t: number; n: number } | null {
  if (shots.length === 0) return null;
  const f = Math.max(0, Math.min(1, progress)) * (shots.length - 1);
  const i = Math.floor(f);
  const a = shots[i];
  const b = shots[Math.min(shots.length - 1, i + 1)];
  const k = f - i;
  const next = new Map<number, number>();
  for (let j = 0; j < b.ids.length; j++) next.set(b.ids[j], j);
  const sx = w / 65535;
  const sy = h / 65535;
  const r = Math.max(1.6, w / 420);
  for (let j = 0; j < a.ids.length; j++) {
    let x = a.xy[j * 2];
    let y = a.xy[j * 2 + 1];
    const m = next.get(a.ids[j]);
    if (m !== undefined) {
      x += (b.xy[m * 2] - x) * k;
      y += (b.xy[m * 2 + 1] - y) * k;
    }
    ctx.fillStyle = theme.diet[DIETS[a.cls[j]] ?? DIETS[0]];
    ctx.beginPath();
    ctx.arc(x * sx, y * sy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return { t: a.t + (b.t - a.t) * k, n: a.ids.length };
}
