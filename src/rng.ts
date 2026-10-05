/** Tohumlanabilir PRNG (mulberry32). Simülasyonun tüm rastgeleliği tek bir akıştan
 *  gelir: aynı tohum + aynı kullanıcı müdahalesi = aynı evrim tarihi. Durum tek bir
 *  32-bit sayı olduğu için kayıt dosyasına yazılıp birebir geri yüklenebilir. */
export class Rng {
  public s = 1;

  public seed(n: number): void {
    this.s = n >>> 0;
    this.next();
  }

  public next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  public int(n: number): number {
    return Math.floor(this.next() * n);
  }

  public chance(p: number): boolean {
    return this.next() < p;
  }
}

/** Simülasyonun paylaşılan rastgelelik akışı (genom mutasyonları dahil). */
export const rng = new Rng();

export function makeRng(seed: number): Rng {
  const r = new Rng();
  r.seed(seed);
  return r;
}

export function randomSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}
