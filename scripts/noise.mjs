// Denge ölçümünün gürültüsü: aynı kodun farklı tohum kümelerinde her eşik için ne kadar
// oynadığını ölçer. Girdi, check.mjs'in --json ile yazdığı ham sonuçtur (ör. 96 tohum).
//
// Kullanım: node scripts/noise.mjs sonuc.json [--size=24] [--draws=4000] [--compare=baska.json]
//
//  - Ayrık kümeler: tohumlar sırayla `size`'lık kümelere bölünür, her kümede eşik sayılır.
//  - Yeniden örnekleme: havuzdan yerine koymadan `size` tohum çekilir (`draws` kez); her
//    eşiğin sayısının ortalaması, standart sapması, %5–%95 aralığı ve geçme oranı basılır.
//  - --compare: ikinci dosyanın (aynı tohumlar, değişmiş kod) her eşikteki farkı, tohum
//    kümesi oynamasıyla (standart sapma) karşılaştırılır. Fark 2 sapmadan küçükse "gürültü içinde".
import { readFileSync } from "node:fs";
import { evaluate } from "./criteria.mjs";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const file = process.argv[2];
const size = Number(arg("size", "24"));
const draws = Number(arg("draws", "4000"));
const data = JSON.parse(readFileSync(file, "utf8"));
const pool = data.results.slice().sort((a, b) => a.seed - b.seed);

// Yeniden örnekleme de belirlenimcidir: sabit tohumlu küçük bir üreteç.
let state = 0x2f6e2b1;
const random = () => {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
function draw(from) {
  const a = from.slice();
  for (let i = 0; i < size; i++) {
    const j = i + Math.floor(random() * (a.length - i));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, size);
}
function distribution(from) {
  const names = evaluate(from.slice(0, size)).map((c) => c.name);
  const values = names.map(() => []);
  const passes = names.map(() => 0);
  let allPass = 0;
  for (let d = 0; d < draws; d++) {
    const checks = evaluate(draw(from));
    checks.forEach((c, i) => {
      values[i].push(c.value);
      if (c.pass) passes[i]++;
    });
    if (checks.every((c) => c.pass)) allPass++;
  }
  return {
    allPass: allPass / draws,
    rows: names.map((name, i) => {
      const v = values[i].sort((a, b) => a - b);
      const mean = v.reduce((a, b) => a + b, 0) / v.length;
      return { name, mean, sd: Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length), lo: v[Math.floor(v.length * 0.05)], hi: v[Math.floor(v.length * 0.95)], pass: passes[i] / draws };
    }),
  };
}

const blocks = [];
for (let i = 0; i + size <= pool.length; i += size) blocks.push(pool.slice(i, i + size));
const base = distribution(pool);
console.log(`\nGürültü · ${file} · ${pool.length} tohum (${pool[0].seed}–${pool[pool.length - 1].seed}) · ${data.evo} · ${data.seconds} sn · küme ${size} tohum`);
console.log(`${"eşik (sayı: eşiği sınayan tohum adedi)".padEnd(62)}${blocks.map((b) => `${b[0].seed}–${b[b.length - 1].seed}`.padEnd(8)).join("")}| ort   sapma  %5–%95   geçme`);
const perBlock = blocks.map((b) => evaluate(b));
base.rows.forEach((r, i) => {
  console.log(`${r.name.padEnd(62)}${perBlock.map((c) => `${c[i].value}${c[i].pass ? "" : "*"}`.padEnd(8)).join("")}| ${r.mean.toFixed(1).padStart(4)}  ${r.sd.toFixed(2).padStart(5)}  ${`${r.lo}–${r.hi}`.padEnd(7)}  %${Math.round(r.pass * 100)}`);
});
console.log(`${"kalan eşik sayısı (* kalan)".padEnd(62)}${perBlock.map((c) => String(c.filter((x) => !x.pass).length).padEnd(8)).join("")}| bütün eşikleri geçen çekiliş: %${Math.round(base.allPass * 100)}`);

const other = arg("compare", "");
if (other) {
  const next = JSON.parse(readFileSync(other, "utf8"));
  const seeds = new Set(next.results.map((r) => r.seed));
  const common = pool.filter((r) => seeds.has(r.seed));
  const a = evaluate(common);
  const b = evaluate(next.results.filter((r) => common.some((c) => c.seed === r.seed)));
  // Oynama, karşılaştırılan küme büyüklüğüne ölçeklenir (sayı ~ n ile, sapma ~ √n ile büyür).
  const scale = Math.sqrt(common.length / size);
  console.log(`\nKarşılaştırma · ${other} · ortak ${common.length} tohum · oynama ${size} tohumluk kümeden ölçeklendi (×${scale.toFixed(2)})`);
  console.log(`${"eşik".padEnd(62)}önce   sonra  fark   oynama(1σ)  yargı`);
  a.forEach((c, i) => {
    const diff = b[i].value - c.value;
    const sd = base.rows[i].sd * scale;
    const verdict = diff === 0 ? "aynı" : Math.abs(diff) > 2 * sd ? "gürültüden büyük" : "gürültü içinde";
    console.log(`${c.name.padEnd(62)}${`${c.value}${c.pass ? "" : "*"}`.padEnd(7)}${`${b[i].value}${b[i].pass ? "" : "*"}`.padEnd(7)}${String(diff > 0 ? `+${diff}` : diff).padEnd(7)}${sd.toFixed(2).padEnd(12)}${verdict}`);
  });
}
