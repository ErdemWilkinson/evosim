// Denge testi: simülasyonu tohumlarda başsız ve paralel koşturur, beslenme biçimlerinin payını
// ölçer ve eşiklere göre geçti/kaldı verir. Bir ayar düğmesi değildir, yalnızca ölçer.
// Eşiklerin tanımı ve gerekçeleri scripts/criteria.mjs içindedir.
//
// Kullanım: npm run balance:check -- [--seeds=1-24] [--dev=1-12] [--seconds=6000]
//           [--evo=fast|medium|slow] [--label=ad] [--save] [--json=dosya] [--diag] [--bundle=cekirdek.mjs]
//
// Tohumlar iki kümedir: geliştirme (--dev; mekanikler bunlara bakılarak geliştirilir) ve
// doğrulama (geri kalanı; yalnızca sonuç raporlanır). Eşikler iki küme ve tümü için ayrı
// ayrı hesaplanır; testin sonucu bütün tohumlar üzerindendir.
//   --save  özet sonucu scripts/balance-log.json dosyasına ekler
//   --json  tohum başına ham sonucu (teşhis ölçümleriyle birlikte) dosyaya yazar; noise.mjs okur
//   --diag  teşhis ölçümlerini (ilk görülme zamanları, başlangıç, genler, eşeyli üreme) basar
import { build } from "esbuild";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir, cpus } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { LABELS, evaluate, parseSeeds, summarize } from "./criteria.mjs";

const SAMPLE = 30;
/** Gen ve eşeyli üreme serilerinin çözünürlüğü (sn). */
const BUCKET = 300;
const EARLY = 300;

if (!isMainThread) {
  const { out, seed, seconds, evo, groundOut } = workerData;
  const { Sim, STEP } = await import(pathToFileURL(out).href);
  const sim = new Sim(seed);
  sim.setEvolutionSpeed(evo);
  // Renk ölçümü (yalnızca okur): yaşam alanı başına gövde tonunun zemin tonuna yakınlığı, üç zaman diliminde.
  const G = await import(pathToFileURL(groundOut).href);
  const ground = new G.GroundTone(sim.world);
  const HABITATS = ["derin", "sığ", "kara", "dağ", "örtü"];
  const habitat = (c) => {
    if (sim.world.inThicket(c.x, c.y)) return 4;
    const b = sim.world.band(c.x, c.y);
    return b === 0 ? 0 : b === 1 ? 1 : b === 4 ? 3 : 2;
  };
  const symb = { samples: 0, sym: 0, hosts: 0, symSamples: 0, hostE: 0, hostN: 0, otherE: 0, otherN: 0 };
  const growth = { samples: 0, n: 0, juv: 0, stunted: 0, sizeSum: 0 };
  const oxy = { n: 0, sum: 0, sq: 0, min: 1, max: 0 };
  const tone = Array.from({ length: 3 }, () => HABITATS.map(() => ({ n: 0, match: 0, bs: 0, bc: 0, ga: 0, gb: 0, dh: 0, dhn: 0 })));
  const bodyOf = (c) => {
    const b = G.bodyHSL(c.g, true);
    return { hue: b.h, tone: G.toneOfHSL(b.h, b.s) };
  };

  // --- Teşhis ölçümleri: yalnızca okur ve sayar; üreteçten sayı çekmez, durumu değiştirmez. ---
  const founder = sim.creatures[0];
  const plantsNear = (c) => {
    let all = 0;
    let reachable = 0;
    for (const n of sim.nutrients) {
      if (n.dead || Math.hypot(n.x - c.x, n.y - c.y) > c.g.senseRadius) continue;
      all++;
      if (sim.passable(c, n.x, n.y)) reachable++;
    }
    return [all, reachable];
  };
  const start = { sense: founder.g.senseRadius, metabolism: founder.g.metabolism, plants0: plantsNear(founder), plants50: [], lostAt: -1 };
  // Doğum ve ölüm sayaçları: üreme biçimine göre ömür ve yavru sayısı.
  const offspring = new Map();
  const life = {};
  const group = (c) => (c.g.reproductionStrategy === "sexual" ? `eşeyli-${c.g.sex === "f" ? "dişi" : "erkek"}` : "eşeysiz");
  const tally = (key, c) => {
    const e = (life[key] ??= { n: 0, age: 0, kids: 0, starved: 0, eaten: 0 });
    e.n++;
    e.age += c.age;
    e.kids += offspring.get(c.id) ?? 0;
  };
  const birth = sim.birth;
  sim.birth = function (g, ...rest) {
    for (const id of new Set(g.parentIds ?? [])) offspring.set(id, (offspring.get(id) ?? 0) + 1);
    return birth.call(this, g, ...rest);
  };
  const kill = sim.kill;
  sim.kill = function (c, cause, ...rest) {
    if (c.alive && cause !== "removed") {
      tally(group(c), c);
      if (c.g.diet === "chemotroph") tally(`${group(c)} (kemotrof)`, c);
      const e = life[group(c)];
      if (cause === "starvation") e.starved++;
      if (cause === "predation") e.eaten++;
      offspring.delete(c.id);
    }
    return kill.call(this, c, cause, ...rest);
  };
  let matings = 0;
  let selfings = 0;
  const mate = sim.mate;
  sim.mate = function (...a) {
    matings++;
    return mate.apply(this, a);
  };
  const divide = sim.divide;
  sim.divide = function (c) {
    if (c.g.reproductionStrategy === "sexual") selfings++;
    return divide.call(this, c);
  };

  const share = LABELS.map(() => 0);
  const peak = LABELS.map(() => 0);
  const present = LABELS.map(() => 0);
  const firstSeen = LABELS.map(() => -1);
  const first = { multicellular: -1, land: -1, sexual: -1, attach: -1, rescue: -1 };
  const series = [];
  let bucket = null;
  let samples = 0;
  let total = 0;
  let multicellular = 0;
  let land = 0;
  let sexual = 0;
  let sexualShare = 0;
  let sexualPresent = 0;
  let wiped = false;
  const mark = (key, hit) => {
    if (first[key] < 0 && hit) first[key] = Math.round(sim.time);
  };
  const steps = Math.round(SAMPLE / STEP);
  for (let t = 0; t < seconds; t += SAMPLE) {
    for (let i = 0; i < steps; i++) {
      sim.step();
      if (sim.time <= EARLY && start.lostAt < 0 && sim.creatures.length === 0 && sim.eggs.length === 0) start.lostAt = Math.round(sim.time);
      if (sim.time <= 50 && founder.alive && (i + 1) % 150 === 0) start.plants50.push(plantsNear(founder)[1]);
    }
    samples++;
    const pop = sim.creatures;
    {
      symb.samples++;
      let sy = 0;
      for (const c of pop) {
        if (c.host && c.g.diet === "phototroph") sy++;
        const sized = c.g.diet !== "phototroph" && c.g.diet !== "carnivore" && c.g.diet !== "parasite";
        if (!sized) continue;
        if ((c.symbionts ?? 0) > 0) { symb.hosts++; symb.hostE += c.energy / c.maxEnergy; symb.hostN++; }
        else { symb.otherE += c.energy / c.maxEnergy; symb.otherN++; }
      }
      symb.sym += sy;
      if (sy > 0) symb.symSamples++;
    }
    {
      growth.samples++;
      for (const c of pop) {
        const sz = c.size ?? 1;
        growth.n++; growth.sizeSum += sz;
        if (sz < 0.98) { growth.juv++; if (c.age > 30) growth.stunted++; }
      }
    }
    {
      const o = sim.oxygen();
      oxy.n++; oxy.sum += o; oxy.sq += o * o; oxy.min = Math.min(oxy.min, o); oxy.max = Math.max(oxy.max, o);
    }
    {
      const w = tone[Math.min(2, Math.floor((t / seconds) * 3))];
      for (const c of pop) {
        const h = habitat(c);
        const e = w[h];
        const body = bodyOf(c);
        const gt = ground.at(c.x, c.y, 0);
        e.n++;
        e.match += G.toneMatch(body.tone, gt);
        e.bs += Math.sin((body.hue * Math.PI) / 180);
        e.bc += Math.cos((body.hue * Math.PI) / 180);
        e.ga += gt[0];
        e.gb += gt[1];
        if (Math.hypot(gt[0], gt[1]) > 0.08) {
          const gh = (Math.atan2(gt[1], gt[0]) * 180) / Math.PI;
          let d = Math.abs(body.hue - gh) % 360;
          if (d > 180) d = 360 - d;
          e.dh += d;
          e.dhn++;
        }
      }
    }
    const n = pop.length;
    total += n;
    if (n === 0) wiped = true;
    else {
      sim.dietCounts().forEach((count, i) => {
        share[i] += count / n;
        if (n >= 20) peak[i] = Math.max(peak[i], count / n);
        if (count > 0) {
          present[i]++;
          if (firstSeen[i] < 0) firstSeen[i] = Math.round(sim.time);
        }
      });
    }
    const multi = pop.filter((c) => c.g.stage === 2).length;
    const onLand = pop.filter((c) => c.onLand).length;
    const sex = pop.filter((c) => c.g.reproductionStrategy === "sexual").length;
    multicellular = Math.max(multicellular, multi);
    land = Math.max(land, onLand);
    sexual = Math.max(sexual, sex);
    if (n > 0) sexualShare += sex / n;
    if (sex > 0) sexualPresent++;
    mark("multicellular", multi > 0);
    mark("land", onLand > 0);
    mark("sexual", sex > 0);
    mark("attach", pop.some((c) => c.host));
    mark("rescue", sim.immigrants > 0);

    // Gen serisi: parazitte emiş gücü, hepçil ve çürükçülde sindirim yönü; her dilimde birey ortalaması.
    bucket ??= { t: 0, n: 0, pop: 0, sexual: 0, vir: [0, 0], gutO: [0, 0], gutS: [0, 0], gutLow: 0, gutHigh: 0 };
    bucket.n++;
    bucket.pop += n;
    bucket.sexual += sex;
    for (const c of pop) {
      if (c.g.diet === "parasite") {
        bucket.vir[0]++;
        bucket.vir[1] += c.g.virulence;
      } else if (c.g.diet === "omnivore" || c.g.diet === "scavenger") {
        const e = c.g.diet === "omnivore" ? bucket.gutO : bucket.gutS;
        e[0]++;
        e[1] += c.g.gutBias;
        if (c.g.gutBias < 0.1) bucket.gutLow++;
        if (c.g.gutBias > 0.9) bucket.gutHigh++;
      }
    }
    if (bucket.n * SAMPLE >= BUCKET || t + SAMPLE >= seconds) {
      bucket.t = Math.round(sim.time);
      series.push(bucket);
      bucket = null;
    }
  }
  parentPort.postMessage({
    seed,
    share: share.map((v) => v / samples),
    peak,
    present: present.map((v) => v / samples),
    meanPopulation: total / samples,
    finalPopulation: sim.creatures.length,
    species: sim.livingSpecies().length,
    tone,
    oxy,
    symb,
    growth,
    clusters: (() => {
      const bins = new Array(12).fill(0);
      for (const c of sim.creatures) bins[Math.floor((((c.g.hue % 360) + 360) % 360) / 30)]++;
      const n = sim.creatures.length || 1;
      return bins.filter((v) => v / n >= 0.1).length;
    })(),
    speciesEver: sim.species.size,
    multicellular,
    land,
    sexual,
    immigrants: sim.immigrants,
    extinct: sim.extinct || wiped,
    diag: { firstSeen, first, start, series, life, matings, selfings, sexualShare: sexualShare / samples, sexualPresent: sexualPresent / samples, deaths: sim.deaths, births: sim.births },
  });
} else {
  const arg = (name, fallback) => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : fallback;
  };
  const seeds = parseSeeds(arg("seeds", "1-24"));
  const dev = new Set(parseSeeds(arg("dev", "1-12")));
  const seconds = Number(arg("seconds", "6000"));
  const evo = arg("evo", "fast");
  const label = arg("label", "");
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const dir = mkdtempSync(join(tmpdir(), "evosim-check-"));
  // --bundle: önceden derlenmiş bir çekirdek (ör. bir değişiklikten önceki kod) aynı tohumlarda ölçülür.
  const out = arg("bundle", "") || join(dir, "sim.mjs");
  const groundOut = join(dir, "ground.mjs");
  await build({ entryPoints: [join(root, "src/ground.ts")], bundle: true, format: "esm", platform: "node", outfile: groundOut, logLevel: "error" });
  if (!arg("bundle", "")) await build({ entryPoints: [join(root, "src/sim.ts")], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error" });

  const queue = seeds.slice();
  const results = [];
  const started = Date.now();
  await Promise.all(
    Array.from({ length: Math.min(seeds.length, Math.max(1, cpus().length - 1)) }, async () => {
      while (queue.length > 0) {
        const seed = queue.shift();
        results.push(
          await new Promise((resolve, reject) => {
            const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { out, seed, seconds, evo, groundOut } });
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
  console.log(`tohum   nüfus  tür  çokh  kara  eşeyli  göç  | ${LABELS.map((l) => l.padEnd(11)).join("")}(ortalama/tepe/var %)`);
  for (const r of results) {
    console.log(
      `${String(r.seed).padStart(4)}${dev.has(r.seed) ? "g" : "d"}  ${String(Math.round(r.meanPopulation)).padStart(5)}  ${String(r.species).padStart(3)}  ${String(r.multicellular).padStart(4)}  ${String(r.land).padStart(4)}  ${String(r.sexual).padStart(6)}  ${String(r.immigrants).padStart(3)}  | ` +
        LABELS.map((_, i) => `${pct(r.share[i])}/${pct(r.peak[i])}/${pct(r.present[i])}`.padEnd(11)).join("") +
        (r.extinct ? " TÜKENDİ" : "")
    );
  }
  const groups = [
    { name: "geliştirme", results: results.filter((r) => dev.has(r.seed)) },
    { name: "doğrulama", results: results.filter((r) => !dev.has(r.seed)) },
    { name: "tümü", results },
  ].filter((g) => g.results.length > 0);
  for (const g of groups) {
    g.summary = summarize(g.results);
    g.checks = evaluate(g.results);
    console.log(`  ${g.name.padEnd(12)}(${String(g.results.length).padStart(2)} tohum)${" ".repeat(18)}| ` + g.summary.map((s) => `${pct(s.share)}/${pct(s.peak)}/${pct(s.present)}`.padEnd(11)).join(""));
  }

  console.log(`\n${"eşik".padEnd(62)}${groups.map((g) => g.name.padEnd(16)).join("")}`);
  const all = groups[groups.length - 1];
  all.checks.forEach((c, i) => {
    console.log(`${c.name.padEnd(62)}${groups.map((g) => `${g.checks[i].pass ? "GEÇTİ" : "KALDI"} ${g.checks[i].value}/${g.checks[i].of}`.padEnd(16)).join("")}`);
  });
  const failedOf = (g) => g.checks.filter((c) => !c.pass);
  console.log(`\n${"Sonuç".padEnd(62)}${groups.map((g) => (failedOf(g).length === 0 ? "GEÇTİ" : `KALDI (${failedOf(g).length})`).padEnd(16)).join("")}`);

  if (process.argv.includes("--diag")) {
    const d = (v) => (v < 0 ? "    —" : String(v).padStart(5));
    console.log(`\nİlk görülme zamanı (sn; — görülmedi) ve başlangıç (algı menzilindeki bitki: tümü/ulaşılabilir)`);
    console.log(`tohum  ${LABELS.map((l) => l.padStart(8)).join("")}  çokh   kara  eşeyli  tutunma    göç | bitki t=0  soy tükendi(≤${EARLY} sn)`);
    for (const r of results) {
      const g = r.diag;
      console.log(`${String(r.seed).padStart(5)}  ${g.firstSeen.map((v) => d(v).padStart(8)).join("")} ${d(g.first.multicellular)}  ${d(g.first.land)}   ${d(g.first.sexual)}    ${d(g.first.attach)}  ${d(g.first.rescue)} | ${`${g.start.plants0[0]}/${g.start.plants0[1]}`.padStart(9)}  ${g.start.lostAt < 0 ? "—" : `${g.start.lostAt}. sn`}`);
    }
  }

  if (process.argv.includes("--symb")) {
    const tot = (k) => results.reduce((a, r) => a + r.symb[k], 0);
    console.log(`
Simbiyoz (24 tohum): simbiyont görülen örnek payı ${(tot("symSamples") / tot("samples")).toFixed(3)} · örnek başına ortalama simbiyont ${(tot("sym") / tot("samples")).toFixed(2)}`);
    console.log(`simbiyonlu tohum: ${results.filter((r) => r.symb.symSamples > 0).length}/${results.length}`);
    console.log(`konak enerji doluluğu: simbiyontlu ${(tot("hostN") ? tot("hostE") / tot("hostN") : 0).toFixed(3)} (n=${tot("hostN")}) · simbiyontsuz ${(tot("otherN") ? tot("otherE") / tot("otherN") : 0).toFixed(3)} (n=${tot("otherN")})`);
  }
  if (process.argv.includes("--growth")) {
    const tot = (k) => results.reduce((a, r) => a + r.growth[k], 0);
    console.log(`
Büyüme (24 tohum): ortalama boy ${(tot("sizeSum") / Math.max(1, tot("n"))).toFixed(3)} · yetişkin olmayan pay ${(tot("juv") / Math.max(1, tot("n"))).toFixed(3)} · 30 sn'den yaşlı ama büyümemiş pay ${(tot("stunted") / Math.max(1, tot("n"))).toFixed(4)}`);
  }
  if (process.argv.includes("--atmo")) {
    const rows = results.map((r) => { const m = r.oxy.sum / r.oxy.n; return { m, sd: Math.sqrt(Math.max(0, r.oxy.sq / r.oxy.n - m * m)), lo: r.oxy.min, hi: r.oxy.max }; });
    const avg = (f) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
    console.log(`
Oksijen (24 tohum): ortalama ${avg((r) => r.m).toFixed(3)} · tohum içi sapma ${avg((r) => r.sd).toFixed(3)} · en düşük ${Math.min(...rows.map((r) => r.lo)).toFixed(2)} · en yüksek ${Math.max(...rows.map((r) => r.hi)).toFixed(2)}`);
    console.log(`tohumlar arası ortalama farkı (sapma): ${Math.sqrt(avg((r) => (r.m - avg((x) => x.m)) ** 2)).toFixed(3)}`);
  }
  if (process.argv.includes("--tone")) {
    const HAB = ["derin", "sığ", "kara", "dağ", "örtü"];
    console.log(`
Renk: gövde tonu ile zemin tonunun yakınlığı (tohumlar üzerinden toplam). Dilim: sürenin üçte biri.`);
    console.log(`alan    dilim   birey   uyum(0-1)  ort.|ton farkı|(°)   gövde ort.ton  zemin ort.ton`);
    for (let w = 0; w < 3; w++) {
      HAB.forEach((name, h) => {
        let n = 0, match = 0, bs = 0, bc = 0, ga = 0, gb = 0, dh = 0, dhn = 0;
        for (const r of results) {
          const e = r.tone[w][h];
          n += e.n; match += e.match; bs += e.bs; bc += e.bc; ga += e.ga; gb += e.gb; dh += e.dh; dhn += e.dhn;
        }
        const deg = (y, x) => ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
        console.log(`${name.padEnd(7)} ${String(w + 1).padStart(4)} ${String(n).padStart(8)}   ${(n ? match / n : 0).toFixed(3).padStart(8)}   ${(dhn ? dh / dhn : 0).toFixed(1).padStart(14)}   ${n ? deg(bs, bc).toFixed(0).padStart(11) : "—".padStart(11)}   ${n ? deg(gb, ga).toFixed(0).padStart(11) : "—".padStart(11)}`);
      });
    }
    const mean = (f) => results.reduce((a, r) => a + f(r), 0) / results.length;
    console.log(`
Belirgin renk kümesi (30°'lik dilimde nüfusun ≥%10'u), son an, tohum ortalaması: ${mean((r) => r.clusters).toFixed(2)}`);
    console.log(`Yaşayan tür sayısı ortalaması: ${mean((r) => r.species).toFixed(1)} · bugüne dek görülen tür: ${mean((r) => r.speciesEver).toFixed(1)}`);
  }

  const json = arg("json", "");
  if (json) writeFileSync(json, JSON.stringify({ label, evo, seconds, dev: Array.from(dev), results }) + "\n");
  if (process.argv.includes("--save")) {
    const file = join(root, "scripts/balance-log.json");
    const log = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
    const brief = (g) => ({
      seeds: g.results.map((r) => r.seed),
      summary: g.summary.map((s) => ({ name: s.name, share: +s.share.toFixed(3), peak: +s.peak.toFixed(3), present: +s.present.toFixed(3) })),
      multicellularSeeds: g.results.filter((r) => r.multicellular > 0).length,
      landSeeds: g.results.filter((r) => r.land > 0).length,
      extinctSeeds: g.results.filter((r) => r.extinct).length,
      rescuedSeeds: g.results.filter((r) => r.immigrants > 0).length,
      earlyLostSeeds: g.results.filter((r) => r.diag.start.lostAt >= 0).length,
      failed: failedOf(g).map((c) => `${c.name} (${c.value}/${c.of})`),
    });
    log.push({ label, evo, seconds, ...brief(all), groups: Object.fromEntries(groups.slice(0, -1).map((g) => [g.name, brief(g)])) });
    writeFileSync(file, JSON.stringify(log, null, 1) + "\n");
  }
  process.exit(failedOf(all).length === 0 ? 0 : 1);
}
