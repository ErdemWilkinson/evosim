// Denge testi: simülasyonu birkaç tohumda başsız koşturur, beslenme biçimlerinin payını
// ölçer ve eşiklere göre geçti/kaldı verir. Bir ayar düğmesi değildir, yalnızca ölçer.
//
// Kullanım: npm run balance:check -- [--seeds=1,2,…] [--seconds=6000] [--evo=fast|medium|slow]
//           [--label=ad] [--save]   (--save: sonucu scripts/balance-log.json dosyasına ekler)
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
import { build } from "esbuild";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir, cpus } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const LABELS = ["foto", "otçul", "parazit", "süzücü", "hepçil", "çürükçül", "etçil"];
const HERBIVORE = 1;
const SAMPLE = 30;

if (!isMainThread) {
  const { out, seed, seconds, evo } = workerData;
  const { Sim, STEP } = await import(pathToFileURL(out).href);
  const sim = new Sim(seed);
  sim.setEvolutionSpeed(evo);
  const share = LABELS.map(() => 0);
  const peak = LABELS.map(() => 0);
  const present = LABELS.map(() => 0);
  let samples = 0;
  let total = 0;
  let multicellular = 0;
  let land = 0;
  let sexual = 0;
  let wiped = false;
  for (let t = 0; t < seconds; t += SAMPLE) {
    for (let i = 0; i < SAMPLE / STEP; i++) sim.step();
    samples++;
    const n = sim.creatures.length;
    total += n;
    if (n === 0) wiped = true;
    else {
      sim.dietCounts().forEach((count, i) => {
        share[i] += count / n;
        if (n >= 20) peak[i] = Math.max(peak[i], count / n);
        if (count > 0) present[i]++;
      });
    }
    multicellular = Math.max(multicellular, sim.creatures.filter((c) => c.g.stage === 2).length);
    land = Math.max(land, sim.creatures.filter((c) => c.onLand).length);
    sexual = Math.max(sexual, sim.creatures.filter((c) => c.g.reproductionStrategy === "sexual").length);
  }
  parentPort.postMessage({
    seed,
    share: share.map((v) => v / samples),
    peak,
    present: present.map((v) => v / samples),
    meanPopulation: total / samples,
    finalPopulation: sim.creatures.length,
    species: sim.livingSpecies().length,
    multicellular,
    land,
    sexual,
    immigrants: sim.immigrants,
    extinct: sim.extinct || wiped,
  });
} else {
  const arg = (name, fallback) => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : fallback;
  };
  const seeds = arg("seeds", "1,2,3,4,5,6,7,8").split(",").map(Number);
  const seconds = Number(arg("seconds", "6000"));
  const evo = arg("evo", "fast");
  const label = arg("label", "");
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const dir = mkdtempSync(join(tmpdir(), "evosim-check-"));
  const out = join(dir, "sim.mjs");
  await build({ entryPoints: [join(root, "src/sim.ts")], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error" });

  const queue = seeds.slice();
  const results = [];
  const started = Date.now();
  await Promise.all(
    Array.from({ length: Math.min(seeds.length, Math.max(1, cpus().length - 1)) }, async () => {
      while (queue.length > 0) {
        const seed = queue.shift();
        results.push(
          await new Promise((resolve, reject) => {
            const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { out, seed, seconds, evo } });
            worker.once("message", resolve);
            worker.once("error", reject);
          })
        );
      }
    })
  );
  rmSync(dir, { recursive: true, force: true });
  results.sort((a, b) => a.seed - b.seed);

  const pct = (v) => `${Math.round(v * 100)}`.padStart(3);
  console.log(`\nDenge testi · ${seeds.length} tohum × ${seconds} sn · evrim hızı: ${evo}${label ? ` · ${label}` : ""} · ${((Date.now() - started) / 1000).toFixed(0)} sn sürdü`);
  console.log(`tohum  nüfus  tür  çokh  kara  eşeyli  göç  | ${LABELS.map((l) => l.padEnd(11)).join("")}(ortalama/tepe/var %)`);
  for (const r of results) {
    console.log(
      `${String(r.seed).padStart(5)}  ${String(Math.round(r.meanPopulation)).padStart(5)}  ${String(r.species).padStart(3)}  ${String(r.multicellular).padStart(4)}  ${String(r.land).padStart(4)}  ${String(r.sexual).padStart(6)}  ${String(r.immigrants).padStart(3)}  | ` +
        LABELS.map((_, i) => `${pct(r.share[i])}/${pct(r.peak[i])}/${pct(r.present[i])}`.padEnd(11)).join("") +
        (r.extinct ? " TÜKENDİ" : "")
    );
  }
  const mean = (f) => results.reduce((a, r) => a + f(r), 0) / results.length;
  const summary = LABELS.map((name, i) => ({ name, share: mean((r) => r.share[i]), peak: Math.max(...results.map((r) => r.peak[i])), present: mean((r) => r.present[i]) }));
  console.log(`  tüm tohumlar${" ".repeat(27)}| ` + summary.map((s) => `${pct(s.share)}/${pct(s.peak)}/${pct(s.present)}`.padEnd(11)).join(""));

  const half = results.length / 2;
  const checks = [];
  LABELS.forEach((name, i) => {
    if (i === HERBIVORE) return;
    const dominant = results.filter((r) => r.share[i] > 0.6).length;
    checks.push({ name: `baskınlık: ${name} ortalama %60'ı geçen tohum ≤ yarı`, pass: dominant <= half, detail: `${dominant}/${results.length}` });
    const persistent = results.filter((r) => r.present[i] >= 0.3).length;
    checks.push({ name: `kalıcılık: ${name} sürenin ≥%30'unda var olan tohum ≥ yarı`, pass: persistent >= half, detail: `${persistent}/${results.length}` });
  });
  LABELS.forEach((name, i) => {
    if (i === HERBIVORE) return;
    const burst = results.filter((r) => r.peak[i] > 0.9).length;
    checks.push({ name: `patlama: ${name} payı %90'ı geçen tohum ≤ yarı`, pass: burst <= half, detail: `${burst}/${results.length}` });
  });
  const rescued = results.filter((r) => r.immigrants > 0).length;
  checks.push({ name: "çöküş: dışarıdan göç gerektiren tohum ≤ yarı", pass: rescued <= half, detail: `${rescued}/${results.length}` });
  const extinct = results.filter((r) => r.extinct).length;
  checks.push({ name: "hiçbir tohumda yaşam tükenmedi", pass: extinct === 0, detail: `${extinct} tükendi` });
  const multi = results.filter((r) => r.multicellular > 0).length;
  checks.push({ name: "çok hücreli görülen tohum ≥ yarı", pass: multi >= half, detail: `${multi}/${results.length}` });
  const landed = results.filter((r) => r.land > 0).length;
  checks.push({ name: "karaya çıkış görülen tohum ≥ 1", pass: landed >= 1, detail: `${landed}/${results.length}` });

  console.log("");
  for (const c of checks) console.log(`${c.pass ? "GEÇTİ" : "KALDI"}  ${c.name}  (${c.detail})`);
  const failed = checks.filter((c) => !c.pass);
  console.log(`\nSonuç: ${failed.length === 0 ? "GEÇTİ" : `KALDI (${failed.length} eşik)`}`);

  if (process.argv.includes("--save")) {
    const file = join(root, "scripts/balance-log.json");
    const log = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
    log.push({ label, evo, seeds, seconds, summary: summary.map((s) => ({ name: s.name, share: +s.share.toFixed(3), peak: +s.peak.toFixed(3), present: +s.present.toFixed(3) })), multicellularSeeds: multi, landSeeds: landed, extinctSeeds: extinct, rescuedSeeds: rescued, failed: failed.map((c) => c.name) });
    writeFileSync(file, JSON.stringify(log, null, 1) + "\n");
  }
  process.exit(failed.length === 0 ? 0 : 1);
}
