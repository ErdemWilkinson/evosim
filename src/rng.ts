/**
 * Basit, bağımlılıksız deterministic PRNG (mulberry32).
 * Aynı seed her zaman aynı sayı dizisini üretir — böylece bir genomdan
 * üretilen görünüş, her yeniden yüklemede aynı kalır.
 */
export function mulberry32(seed: number): () => number {
  let t = seed;
  const next = () => {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  // Isınma çağrısı: ardışık küçük seed'lerde (1,2,3...) ilk sayı düşük entropili
  // çıkabiliyor, bu da örn. pick()'in ilk seçiminde gözle görülür bir çarpıklığa yol
  // açıyordu (Tester notu: 1..40 seed'lerinde limbType dağılımı ~%47 wing'e kaymıştı).
  // Üretimden önce state'i bir kez ilerleterek bu ilk-sayı zayıflığını gideriyoruz.
  next();
  return next;
}

/** [min, max) aralığında rastgele float. */
export function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** dizi içinden rastgele bir eleman seçer. */
export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}
