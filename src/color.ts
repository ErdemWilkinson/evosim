/**
 * HSL (h: 0-360, s/l: 0-100) değerini Pixi'nin kabul ettiği 0xRRGGBB hex sayısına çevirir.
 * Genomdan türetilen renkleri (hue kaydırma vb.) kolayca üretebilmek için kullanılır.
 */
export function hslToHex(h: number, s: number, l: number): number {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp01(s / 100);
  const ll = clamp01(l / 100);

  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const R = Math.round((r + m) * 255);
  const G = Math.round((g + m) * 255);
  const B = Math.round((b + m) * 255);
  return (R << 16) | (G << 8) | B;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Verilen hex rengi belirtilen oranda beyaza veya siyaha yaklaştırır (basit tonlama). */
export function shade(color: number, amount: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const mix = (c: number) => {
    const target = amount >= 0 ? 255 : 0;
    return Math.round(c + (target - c) * Math.abs(amount));
  };
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

/**
 * Faz A takip — bilimsel/nötr görsel dil: verilen rengi kendi algısal parlaklığına
 * (luma) sahip bir griye doğru karıştırarak doygunluğunu düşürür (basit bir
 * desaturasyon), ardından hafifçe koyulaştırır. `creature.ts`'teki
 * `genomeToPalette`'in "doygunluk/parlaklığı bastır" mantığıyla aynı — parlak/oyunsu
 * renkler yerine "veri kategorisi" gibi okunan, laboratuvar örneği hissi veren tonlar
 * üretir. `desaturate` 0 (değişiklik yok) .. 1 (tam gri) arası, `darken` 0..1 arası
 * ek bir koyulaştırma miktarıdır.
 */
export function muteColor(color: number, desaturate: number, darken = 0): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const luma = r * 0.299 + g * 0.587 + b * 0.114;
  const mixR = r + (luma - r) * desaturate;
  const mixG = g + (luma - g) * desaturate;
  const mixB = b + (luma - b) * desaturate;
  const dk = 1 - darken;
  const R = Math.round(clampByte(mixR * dk));
  const G = Math.round(clampByte(mixG * dk));
  const B = Math.round(clampByte(mixB * dk));
  return (R << 16) | (G << 8) | B;
}

function clampByte(v: number): number {
  return Math.min(255, Math.max(0, v));
}
