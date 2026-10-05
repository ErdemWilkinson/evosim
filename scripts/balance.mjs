// Başsız denge koşusu: simülasyon çekirdeğini Node'da çalıştırır ve popülasyonun
// zaman içindeki seyrini basar. Kullanım: npm run balance -- [saniye] [tohum...]
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "evosim-"));
const out = join(dir, "sim.mjs");
await build({ entryPoints: [join(root, "src/sim.ts")], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error" });
const { Sim, STEP } = await import(pathToFileURL(out).href);

const brief = process.argv.includes("--brief");
const args = process.argv.slice(2).filter((a) => !a.startsWith("--")).map(Number);
const seconds = args[0] || 1200;
const seeds = args.length > 1 ? args.slice(1) : [1, 2, 3, 4];
const LABELS = ["foto", "otçul", "parazit", "süzücü", "hepçil", "çürükçül", "etçil"];
const noRescue = process.argv.includes("--no-rescue");

for (const seed of seeds) {
  const sim = new Sim(seed);
  if (noRescue) sim.rescueEnabled = false;
  const started = Date.now();
  console.log(`\n== tohum ${seed} · su %${Math.round(sim.world.waterFraction * 100)} ==`);
  const every = Math.max(60, Math.round(seconds / 12));
  for (let t = 0; t < seconds && !sim.extinct; t += every) {
    for (let i = 0; i < every / STEP; i++) sim.step();
    const diets = sim.dietCounts().map((n, i) => (n ? `${LABELS[i]} ${n}` : "")).filter(Boolean).join(" · ");
    const land = sim.creatures.filter((c) => c.onLand).length;
    const stages = [0, 1, 2].map((s) => sim.creatures.filter((c) => c.g.stage === s).length).join("/");
    const sexual = sim.creatures.filter((c) => c.g.reproductionStrategy === "sexual").length;
    if (!brief || t + every >= seconds) console.log(`t=${String(Math.round(sim.time)).padStart(5)}  n=${String(sim.creatures.length).padStart(3)}  tür=${String(sim.livingSpecies().length).padStart(2)}  nesil=${String(sim.maxGeneration).padStart(3)}  besin=${String(sim.nutrients.length).padStart(3)}  kara=${String(land).padStart(3)}  düzey=${stages}  eşeyli=${sexual}  ${diets}`);
  }
  const d = sim.deaths;
  console.log(`ölüm: açlık ${d.starvation} · yaşlılık ${d.old_age} · av ${d.predation} · zehir ${d.venom} · meteor ${d.meteor} · hastalık ${d.disease} | doğum ${sim.births} | göçmen ${sim.immigrants} | toplam tür ${sim.species.size} | ${((Date.now() - started) / 1000).toFixed(1)} sn gerçek süre`);
  if (sim.extinct) console.log("!! YAŞAM TÜKENDİ");
}
rmSync(dir, { recursive: true, force: true });
