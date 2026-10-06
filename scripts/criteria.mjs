// Denge testinin eşikleri: tohum başına sonuçlardan geçti/kaldı listesi üretir.
// check.mjs (test) ve noise.mjs (gürültü ölçümü) aynı tanımı kullanır.
//
// Eşikler ve gerekçeleri:
//  1. Baskınlık: otçul dışında hiçbir beslenme biçimi, tohumların yarısından fazlasında
//     ortalama %60'ı geçmemeli. Otçul hariçtir: ilk hücre otçuldur ve üreticileri yiyen
//     birincil tüketici besin ağının tabanıdır; onun çoğunlukta olması bir bozukluk değildir.
//  2. Kalıcılık: otçul dışındaki her biçim, tohumların en az yarısında sürenin en az %30'unda
//     var olmalı.
//  3. Hiçbir tohumda yaşam tükenmemeli (nüfusun sıfıra indiği ve dışarıdan göçle yeniden
//     başladığı durum da tükenme sayılır).
//  4. Tohumların en az yarısında çok hücreli canlı, en az birinde karaya çıkış görülmeli.
//  5. Patlama: otçul dışındaki bir biçimin payı, nüfus en az 20 iken, tohumların yarısından
//     fazlasında %90'ı geçmemeli. İlk ölçümde 1–4. eşiklerin hepsi geçti ama etçiller sekiz
//     tohumun beşinde bir ara nüfusun tamamını oluşturuyordu: ortalama pay bunu gizliyor.
//  6. Çöküş: nüfus 8'in altına düşüp dışarıdan göç gerektiren tohumlar yarıyı geçmemeli.
//     İlk ölçümde sekiz tohumun altısında oldu; "tükenmedi" eşiği bunu göremiyor çünkü
//     göç yaşamı yeniden başlatıyor.
export const LABELS = ["foto", "otçul", "parazit", "süzücü", "hepçil", "çürükçül", "etçil"];
export const HERBIVORE = 1;

/** "1-12,15,20-24" → [1, …, 12, 15, 20, …, 24] */
export function parseSeeds(text) {
  const out = [];
  for (const part of String(text).split(",")) {
    const [a, b] = part.split("-").map(Number);
    for (let s = a; s <= (b ?? a); s++) out.push(s);
  }
  return out;
}

/** Her eşik: ad, ölçülen sayı (`value`), tohum sayısı (`of`), geçti mi. `atMost`: sayı küçükken mi geçer. */
export function evaluate(results) {
  const n = results.length;
  const half = n / 2;
  const checks = [];
  const add = (name, value, atMost, limit) => checks.push({ name, value, of: n, atMost, limit, pass: atMost ? value <= limit : value >= limit });
  LABELS.forEach((name, i) => {
    if (i === HERBIVORE) return;
    add(`baskınlık: ${name} ortalama %60'ı geçen tohum ≤ yarı`, results.filter((r) => r.share[i] > 0.6).length, true, half);
    add(`kalıcılık: ${name} sürenin ≥%30'unda var olan tohum ≥ yarı`, results.filter((r) => r.present[i] >= 0.3).length, false, half);
  });
  LABELS.forEach((name, i) => {
    if (i === HERBIVORE) return;
    add(`patlama: ${name} payı %90'ı geçen tohum ≤ yarı`, results.filter((r) => r.peak[i] > 0.9).length, true, half);
  });
  add("çöküş: dışarıdan göç gerektiren tohum ≤ yarı", results.filter((r) => r.immigrants > 0).length, true, half);
  add("hiçbir tohumda yaşam tükenmedi", results.filter((r) => r.extinct).length, true, 0);
  add("çok hücreli görülen tohum ≥ yarı", results.filter((r) => r.multicellular > 0).length, false, half);
  add("karaya çıkış görülen tohum ≥ 1", results.filter((r) => r.land > 0).length, false, 1);
  return checks;
}

export function summarize(results) {
  const mean = (f) => results.reduce((a, r) => a + f(r), 0) / Math.max(1, results.length);
  return LABELS.map((name, i) => ({ name, share: mean((r) => r.share[i]), peak: Math.max(0, ...results.map((r) => r.peak[i])), present: mean((r) => r.present[i]) }));
}
