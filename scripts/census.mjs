// Hücre kimyası sayımı: koşu sonunda duvar, zar, kalıtım polimeri, enerji ve katalizörün kaç farklı çeşidi var.
// Kullanım: node scripts/census.mjs [--seeds=1,2,3] [--seconds=3000] [--evo=fast]
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const arg = (n, f) => { const h = process.argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : f; };
const seeds = arg("seeds", "1,2,3").split(",").map(Number);
const seconds = Number(arg("seconds", "3000"));
const evo = arg("evo", "fast");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(mkdtempSync(join(tmpdir(), "evosim-census-")), "s.mjs");
await build({ entryPoints: [join(root, "src/sim.ts")], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error" });
const { Sim, STEP } = await import(pathToFileURL(out).href);
for (const seed of seeds) {
  const sim = new Sim(seed);
  sim.setEvolutionSpeed(evo);
  while (sim.time < seconds) sim.step();
  const line = [];
  for (const k of ["wall", "membrane", "genetic", "energy", "catalyst"]) {
    const m = new Map();
    for (const c of sim.creatures) m.set(c.g[k], (m.get(c.g[k]) ?? 0) + 1);
    line.push(`${k}:${[...m.entries()].map(([a, b]) => `${a}=${b}`).join(",")}`);
  }
  console.log(`tohum ${seed} · ${sim.creatures.length} canlı · ${line.join(" | ")}`);
}
