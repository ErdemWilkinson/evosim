// Çekirdek testleri: simülasyonun iki temel güvencesini başsız koşuda sınar.
//  1. Belirlenimcilik: aynı tohum ve ayar iki koşuda bire bir aynı durumu verir.
//  2. Kayıt gidiş-dönüşü: kaydet, yükle, devam et; kaydetmeden devam edenle bire bir aynı durum.
//
// Kullanım: npm run test:core -- [--seeds=1,2,3] [--seconds=600] [--evo=fast,slow]
// Karşılaştırma tam durum üzerindendir (her canlının konumu, enerjisi, genomu, zamanlayıcıları;
// bitkiler, leşler, yumurtalar, türler, üreteç durumu); yuvarlama payı yoktur.
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const seeds = arg("seeds", "1,2,3").split(",").map(Number);
const seconds = Number(arg("seconds", "600"));
const tiers = arg("evo", "fast,slow").split(",");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "evosim-core-"));
const out = join(dir, "core.mjs");
// Sim ile üreteç aynı paketten alınır: üreteç modül düzeyinde tektir ve durumu karşılaştırmaya girer.
await build({
  stdin: { contents: `export { Sim, STEP } from "./src/sim"; export { rng } from "./src/rng";`, resolveDir: root, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "error",
});
const { Sim, STEP, rng } = await import(pathToFileURL(out).href);

// Ölmüş bir canlıya kalan başvuru boş başvuruyla eşdeğerdir (kod her yerde `alive` sınar).
const ref = (c) => (c && c.alive ? c.id : 0);
/** Simülasyonun ileriki adımları etkileyen bütün durumu; nesne başvuruları kimliğe çevrilir. */
function snapshot(sim) {
  return {
    time: sim.time,
    rng: rng.s,
    creatures: sim.creatures.map((c) => ({ ...c, d: undefined, tC: ref(c.tC), tN: c.tN ? sim.nutrients.indexOf(c.tN) : -1, tK: c.tK ? sim.corpses.indexOf(c.tK) : -1, host: ref(c.host), parent: ref(c.parent) })),
    nutrients: sim.nutrients,
    corpses: sim.corpses,
    eggs: sim.eggs,
    species: Array.from(sim.species.values()),
    births: sim.births,
    deaths: sim.deaths,
    immigrants: sim.immigrants,
    maxGeneration: sim.maxGeneration,
    climate: sim.climate,
    wind: sim.wind,
    quakeLeft: sim.quakeLeft,
    quakes: sim.world.quakes,
    events: sim.eventSeq,
  };
}
/** Alan sırasından bağımsız metin: aynı durum, alanlar hangi sırayla kurulmuş olursa olsun aynı çıkar. */
const canon = (v) => JSON.stringify(v, (_, o) => (o && typeof o === "object" && !Array.isArray(o) ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]])) : o));
const digest = (sim) => createHash("sha256").update(canon(snapshot(sim))).digest("hex").slice(0, 16);

function run(sim, until) {
  while (sim.time < until - STEP / 2) sim.step();
  return sim;
}
function fresh(seed, evo) {
  const sim = new Sim(seed);
  sim.setEvolutionSpeed(evo);
  return sim;
}

/** İki durumun ilk ayrıştığı yeri kısa bir metinle söyler. */
function firstDifference(a, b) {
  for (const key of Object.keys(a)) {
    if (canon(a[key]) === canon(b[key])) continue;
    if (!Array.isArray(a[key])) return `${key}: ${canon(a[key])} ≠ ${canon(b[key])}`.slice(0, 160);
    if (a[key].length !== b[key].length) return `${key}: ${a[key].length} ≠ ${b[key].length} öğe`;
    const i = a[key].findIndex((v, j) => canon(v) !== canon(b[key][j]));
    const fields = Object.keys(a[key][i] ?? {}).filter((f) => canon(a[key][i][f]) !== canon(b[key][i][f]));
    return `${key}[${i}] alanları: ${fields.join(", ")}`.slice(0, 160);
  }
  return "";
}

const results = [];
const started = Date.now();
for (const evo of tiers) {
  for (const seed of seeds) {
    // Belirlenimcilik: iki bağımsız koşu.
    const first = digest(run(fresh(seed, evo), seconds));
    const second = digest(run(fresh(seed, evo), seconds));
    results.push({ name: `belirlenimcilik · tohum ${seed} · ${evo} · ${seconds} sn`, pass: first === second, detail: `${first} / ${second}` });

    // Kayıt gidiş-dönüşü: yarı yolda kaydet; biri kesintisiz, diğeri kayıttan devam eder.
    const half = seconds / 2;
    const straight = run(fresh(seed, evo), half);
    const saved = JSON.stringify(straight.serialize());
    // Kayıt alınır alınmaz, tek adım atmadan: kayıt durumu eksiksiz taşıyor mu?
    const atSave = snapshot(straight);
    const atLoad = snapshot(Sim.load(JSON.parse(saved)));
    const lost = firstDifference(atSave, atLoad);
    results.push({ name: `kayıt, yükleme anında aynı durum · tohum ${seed} · ${evo}`, pass: lost === "", detail: lost || "aynı" });

    const direct = snapshot(run(straight, seconds));
    const resumed = snapshot(run(Sim.load(JSON.parse(saved)), seconds));
    const diff = firstDifference(direct, resumed);
    results.push({ name: `kayıt gidiş-dönüşü · tohum ${seed} · ${evo} · ${half}+${half} sn`, pass: diff === "", detail: diff || `aynı (${direct.creatures.length} canlı)` });
  }
}
rmSync(dir, { recursive: true, force: true });

console.log(`\nÇekirdek testleri · ${seeds.length} tohum × ${seconds} sn · kademeler: ${tiers.join(", ")} · ${((Date.now() - started) / 1000).toFixed(0)} sn sürdü\n`);
for (const r of results) console.log(`${r.pass ? "GEÇTİ" : "KALDI"}  ${r.name}  (${r.detail})`);
const failed = results.filter((r) => !r.pass);
console.log(`\nSonuç: ${failed.length === 0 ? "GEÇTİ" : `KALDI (${failed.length}/${results.length})`}`);
process.exit(failed.length === 0 ? 0 : 1);
