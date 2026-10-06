import { Client, View } from "./client";
import { BRAIN_ACTIONS, BRAIN_INPUTS, DIETS, DIET_DESCRIPTION, DIET_LABEL, EvolutionSpeed, Genome, IN } from "./genome";
import { ORGANS, OrganType, STAGE_LABEL } from "./organs";
import { PhyloTree } from "./phylo";
import { OriginFilm, StructureViewer } from "./inspect";
import { generatePlanetProfile } from "./planet";
import { FLAG, STRIDE, UiPayload } from "./protocol";
import { Scene, Tool, isDark, readTheme, renderTerrain } from "./render";
import { randomSeed } from "./rng";
import { DAY_LENGTH, EventKind, INITIAL_CREATURES, SaveData, WorldEventKind } from "./sim";
import { $, EVENT_KIND_LABEL, LineChart, StackChart, creatureSkeleton, dnaHtml, esc, pickGene, spinDna, fmtTime, logHtml, nf, organTable, planetHtml, portrait, setHtml, speciesRows, speciesSkeleton, updateCreatureCard, updateOverview, updateSpeciesCard } from "./ui";
import { World } from "./world";

const SAVE_KEY = "evosim-save-v2";
const LEGACY_SAVE_KEY = "evosim-opus-save-v2";
const AUTOSAVE_MS = 20000;

type Tab = "overview" | "species" | "organs" | "log" | "creature";

// ------------------------------------------------------------------ claude.ai çalışma zamanı (varsa)

interface SampleError {
  code?: string;
  text?: string;
}
type SampleFn = (input: string, options?: { onText?: (part: { text: string }) => void }) => Promise<{ text: string }>;
interface Downloads {
  save(request: { filename: string; data: string }): Promise<unknown>;
}
let sample: SampleFn | null = null;
let downloads: Downloads | null = null;
const runtime = (window as unknown as { claude?: { use(name: string): Promise<unknown> } }).claude;

// ------------------------------------------------------------------ durum

const theme = readTheme();
const client = new Client();
const scene = new Scene($<HTMLCanvasElement>("scene"), theme);
const popChart = new StackChart($("pop-chart"), $("pop-legend"));
let view: View | null = null;
let tool: Tool = "select";
let tab: Tab = "overview";
let selected = 0;
let selectedAt = 0;
let following = false;
let placeTemplate = 0;
let highlight = 0;
let speciesCard = 0;
let speciesSkeletonFor = -1;
let speciesPortraitFor = -1;
let speciesChart: LineChart | null = null;
let creatureSkeletonFor = -1;
let creaturePortraitKey = "";
let logFilter: EventKind | "" = "";
let lastSpeed = 1;
let timelinePinned = true;
let started = false;

// ------------------------------------------------------------------ küçük yardımcılar

let toastTimer = 0;
function toast(text: string): void {
  const el = $("toast");
  el.textContent = text;
  el.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.hidden = true), 3200);
}

function parseSeed(text: string): number {
  const trimmed = text.trim();
  if (/^\d{1,10}$/.test(trimmed)) return Number(trimmed) >>> 0;
  let h = 2166136261;
  for (let i = 0; i < trimmed.length; i++) h = Math.imul(h ^ trimmed.charCodeAt(i), 16777619);
  return h >>> 0;
}

const TOOL_HINT: Record<Tool, string> = {
  select: "",
  plants: "Tıkladığınız yere bir avuç bitki ekilir.",
  place: "",
  meteor: "Tıkladığınız yere meteor düşer: çemberin içindeki canlıların ve bitkilerin çoğu yok olur.",
  remove: "Tıkladığınız canlı haritadan kaldırılır.",
};

function setTool(next: Tool): void {
  tool = next;
  if (next !== "place") placeTemplate = 0;
  for (const b of document.querySelectorAll<HTMLElement>("[data-tool]")) b.setAttribute("aria-pressed", String(b.dataset.tool === next));
  const hint = next === "place" ? (placeTemplate ? `Tıkladığınız yere #${placeTemplate} numaralı bireyin kopyası yerleştirilir.` : "Tıkladığınız yere organsız bir mikroorganizma yerleştirilir (suya).") : TOOL_HINT[next];
  $("tool-hint").textContent = hint;
  $("tool-hint").hidden = hint === "";
}

function setTab(next: Tab): void {
  tab = next;
  for (const b of document.querySelectorAll<HTMLElement>("[data-tab]")) b.setAttribute("aria-selected", String(b.dataset.tab === next));
  for (const name of ["overview", "species", "organs", "log", "creature"]) $(`tab-${name}`).hidden = name !== next;
  if (view?.ui) refreshTab(view, view.ui);
}

function select(id: number): void {
  selected = id;
  selectedAt = performance.now();
  following = false;
  client.send({ type: "select", id });
  if (id) setTab("creature");
}

function openSpecies(id: number): void {
  speciesCard = id;
  client.send({ type: "species", id });
  const tree = $<HTMLDialogElement>("dlg-tree");
  if (tree.open) tree.close();
  setTab("species");
}

// ------------------------------------------------------------------ kareler

client.onNote = toast;
client.onFrame = (v, fresh) => {
  view = v;
  if (fresh) onEpoch(v);
  if (v.frame.ui) refresh(v, v.frame.ui);
};

/** Yeni bir dünya (yeni gezegen, yükleme ya da zaman yolculuğu) başladı. */
function onEpoch(v: View): void {
  started = true;
  selected = 0;
  following = false;
  highlight = 0;
  speciesCard = 0;
  speciesSkeletonFor = -1;
  creatureSkeletonFor = -1;
  timelinePinned = true;
  setTool("select");
  scene.fit();
  if (v.frame.time < 1 && v.frame.n === INITIAL_CREATURES) {
    // Yeni gezegen: önce köken filmi oynar (simülasyon bekler). Film, hücrenin ikiye bölündüğü
    // sahnede haritaya erir; alttaki harita o sırada iki kardeş hücreye yakınlaşmış durur.
    client.send({ type: "speed", value: 0 });
    scene.beginGenesis(true);
    playFilm(v, () => {
      client.send({ type: "speed", value: lastSpeed });
      scene.beginGenesis();
    });
  }
  $("seed-chip").textContent = `tohum ${v.world.seed}`;
  setHtml($("planet-facts"), planetHtml(v.planet));
  for (const id of ["dlg-planet", "dlg-save"]) {
    const dialog = $<HTMLDialogElement>(id);
    if (dialog.open) dialog.close();
  }
}

function refresh(v: View, ui: UiPayload): void {
  const time = v.frame.time;
  const light = v.frame.light;
  $("clock").textContent = fmtTime(time);
  $("calendar").textContent = `Gün ${Math.floor(time / DAY_LENGTH) + 1}`;
  $("daylight-label").textContent = light >= 0.6 ? "Gündüz" : light >= 0.25 ? "Alacakaranlık" : "Gece";
  $("daylight-fill").style.transform = `scaleX(${light.toFixed(3)})`;
  for (const b of document.querySelectorAll<HTMLElement>("[data-speed]")) b.setAttribute("aria-pressed", String(Number(b.dataset.speed) === ui.speed));
  if (ui.speed > 0) lastSpeed = ui.speed;

  const chips: string[] = [`<span class="chip">O₂ <b>%${Math.round(ui.oxygen * 100)}</b></span>`];
  if (ui.climate) chips.push(`<span class="chip">${ui.climate.warm ? "Sıcak dalga" : "Soğuk dalga"} <b>${Math.ceil(ui.climate.left)} sn</b></span>`);
  if (ui.wind) {
    const dirs = ["D", "GD", "G", "GB", "B", "KB", "K", "KD"];
    const deg = ((ui.wind.angle * 180) / Math.PI + 360) % 360;
    chips.push(`<span class="chip">Rüzgâr → <b>${dirs[Math.round(deg / 45) % 8]}</b> ${Math.ceil(ui.wind.left)} sn</span>`);
  }
  if (ui.quakeLeft > 0) chips.push(`<span class="chip">Deprem etkisi <b>${Math.ceil(ui.quakeLeft)} sn</b></span>`);
  if (ui.infected > 0) chips.push(`<span class="chip chip-alert">Hasta <b>${ui.infected}</b></span>`);
  let hidden = 0;
  for (let i = 0; i < v.frame.n; i++) if (v.frame.c[i * STRIDE + 6] & FLAG.hidden) hidden++;
  if (hidden > 0) chips.push(`<span class="chip" title="Sık bitki örtüsünde ya da kıyı sığlığında olan canlıyı avcı ve parazit daha zor fark eder; haritada kesik yeşil halkayla görünür.">Sığınakta <b>${hidden}</b></span>`);
  if (ui.eggs > 0) chips.push(`<span class="chip">Yumurta <b>${ui.eggs}</b></span>`);
  if (ui.speed > 1 && ui.rate < ui.speed * 0.8) chips.push(`<span class="chip">Gerçekleşen hız <b>×${nf(ui.rate)}</b></span>`);
  if (highlight) {
    const s = ui.species.find((x) => x.id === highlight);
    if (s) chips.push(`<span class="chip">Vurgulanan <b><em>${esc(s.name)}</em></b></span>`);
  }
  setHtml($("hud"), chips.join(""));
  $("extinct").hidden = !ui.extinct;

  // Zaman yolculuğu
  const range = $<HTMLInputElement>("tl-range");
  const count = ui.snaps.length;
  range.disabled = count === 0;
  $<HTMLButtonElement>("tl-go").disabled = count === 0;
  if (count > 0) {
    range.max = String(count - 1);
    if (timelinePinned) range.value = String(count - 1);
    const at = ui.snaps[Math.min(count - 1, Number(range.value))];
    $("tl-label").textContent = `${fmtTime(at)} · ${fmtTime(time - at)} önce`;
  } else $("tl-label").textContent = "ilk kayıt 60. saniyede";

  if (selected && !ui.selected && performance.now() - selectedAt > 600) {
    selected = 0;
    following = false;
  }
  refreshTab(v, ui);
  const tree = $<HTMLDialogElement>("dlg-tree");
  if (tree.open) drawTree();
}

function refreshTab(v: View, ui: UiPayload): void {
  const population = v.frame.n;
  if (tab === "overview") {
    updateOverview(ui, population, v.frame.plants.length / 2);
    popChart.draw(ui.history, ui.diets, theme);
    const events = $<HTMLInputElement>("set-events");
    const rescue = $<HTMLInputElement>("set-rescue");
    const plants = $<HTMLInputElement>("set-plants");
    if (document.activeElement !== events) events.checked = ui.autoEvents;
    if (document.activeElement !== rescue) rescue.checked = ui.rescueEnabled;
    const evo = $<HTMLSelectElement>("set-evo");
    if (document.activeElement !== evo) evo.value = ui.evolutionSpeed;
    if (document.activeElement !== plants) plants.value = String(ui.nutrientMultiplier);
    $("set-plants-value").textContent = `×${nf(ui.nutrientMultiplier)}`;
    $("engine-note").textContent =
      `${client.threaded ? "Simülasyon ayrı bir iş parçacığında (Web Worker) çalışıyor" : "Simülasyon ana iş parçacığında çalışıyor"}` +
      ` · gerçekleşen hız ×${nf(ui.rate)} · eşeyli üreyen ${ui.sexual} · dışarıdan göç ${ui.immigrants}`;
  } else if (tab === "species") {
    const info = speciesCard ? ui.species.find((s) => s.id === speciesCard) : undefined;
    $("species-list-view").hidden = info !== undefined;
    $("species-card").hidden = info === undefined;
    if (!info) {
      setHtml($("species-list"), speciesRows(ui.species));
      return;
    }
    const root = $("species-card");
    if (speciesSkeletonFor !== info.id) {
      setHtml(root, speciesSkeleton(info, sample !== null));
      speciesSkeletonFor = info.id;
      speciesPortraitFor = -1;
      speciesChart = new LineChart($("sp-chart"));
    }
    const detail = ui.speciesDetail;
    if (!detail || detail.id !== info.id) return;
    if (speciesPortraitFor !== info.id) {
      portrait($<HTMLCanvasElement>("sp-portrait"), detail.type, theme);
      speciesPortraitFor = info.id;
    }
    updateSpeciesCard(ui, info, ui.species, v.frame.time);
    setHtml($("sp-dna"), dnaHtml(detail.type, ui.origin, v.world.chem.genetic));
    speciesChart?.draw(detail.series, theme.diet[info.diet], theme);
    $("sp-highlight").setAttribute("aria-pressed", String(highlight === info.id));
  } else if (tab === "organs") {
    setHtml($("organ-table"), organTable(ui, population, v.planet.forbiddenOrgans));
  } else if (tab === "log") {
    setHtml(
      $("log-filter"),
      `<button type="button" data-kind="" aria-pressed="${logFilter === ""}">Tümü</button>` +
        (Object.keys(EVENT_KIND_LABEL) as EventKind[]).map((k) => `<button type="button" data-kind="${k}" aria-pressed="${logFilter === k}">${EVENT_KIND_LABEL[k]}</button>`).join("")
    );
    setHtml($("log"), logHtml(v.events, logFilter));
  } else {
    const d = selected ? ui.selected : null;
    $("creature-empty").hidden = d !== null;
    $("creature-card").hidden = d === null;
    if (!d || d.id !== selected) return;
    if (creatureSkeletonFor !== d.id) {
      setHtml($("creature-card"), creatureSkeleton(d.id, sample !== null));
      creatureSkeletonFor = d.id;
      creaturePortraitKey = "";
    }
    const key = `${d.id}:${d.gv}:${theme.dark}`;
    if (creaturePortraitKey !== key) {
      portrait($<HTMLCanvasElement>("cr-portrait"), d.genome, theme);
      creaturePortraitKey = key;
    }
    updateCreatureCard(d, ui.species.find((s) => s.id === d.genome.speciesId), v.planet.forbiddenOrgans, { following, placing: tool === "place" && placeTemplate === d.id });
    setHtml($("cr-dna"), dnaHtml(d.genome, ui.origin, v.world.chem.genetic));
  }
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function frame(now: number): void {
  if (!reducedMotion) spinDna(now * 0.0011);
  if (view) {
    if (following && selected) {
      const p = scene.position(view, selected);
      if (p) scene.center(p.x, p.y);
    }
    const d = view.ui?.selected;
    scene.draw(view, { selected, senseRadius: d && d.alive && d.id === selected ? d.sense : 0, highlightSpecies: highlight, tool });
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ------------------------------------------------------------------ harita etkileşimi

scene.onUserPan = () => (following = false);
scene.onTap = (x, y, tolerance) => {
  if (!view) return;
  if (tool === "plants") client.send({ type: "plants", x, y });
  else if (tool === "place") client.send({ type: "place", x, y, template: placeTemplate });
  else if (tool === "meteor") client.send({ type: "trigger", kind: "meteor", x, y });
  else {
    const id = scene.pick(view, x, y, tolerance);
    if (tool === "remove") {
      if (id) client.send({ type: "remove", id });
    } else select(id);
  }
};

for (const b of document.querySelectorAll<HTMLElement>("[data-tool]")) b.addEventListener("click", () => setTool(b.dataset.tool as Tool));
for (const b of document.querySelectorAll<HTMLElement>("[data-event]")) b.addEventListener("click", () => client.send({ type: "trigger", kind: b.dataset.event as WorldEventKind }));
for (const b of document.querySelectorAll<HTMLElement>("[data-speed]")) b.addEventListener("click", () => client.send({ type: "speed", value: Number(b.dataset.speed) }));
for (const b of document.querySelectorAll<HTMLElement>("[data-tab]")) b.addEventListener("click", () => setTab(b.dataset.tab as Tab));
$("zoom-in").addEventListener("click", () => scene.zoomBy(1.5));
$("zoom-out").addEventListener("click", () => scene.zoomBy(1 / 1.5));
$("zoom-fit").addEventListener("click", () => {
  following = false;
  scene.fit();
});

// ------------------------------------------------------------------ yapı inceleme ve köken filmi

const viewer = new StructureViewer($<HTMLDialogElement>("dlg-inspect"), $<HTMLCanvasElement>("inspect-canvas"), $("inspect-levels"), $("inspect-list"), $("inspect-info"), $("inspect-caption"), () => theme);
const film = new OriginFilm($("film"), $<HTMLCanvasElement>("film-canvas"), $("film-title"), $("film-caption"), $("film-source"), $("film-dots"), {
  skip: $("film-skip"),
  back: $("film-back"),
  next: $("film-next"),
  end: $("film-end"),
  again: $("film-again"),
  go: $("film-go"),
});
function playFilm(v: View, done: () => void): void {
  // Filmdeki hücre, haritada görülecek ilk hücrenin kendisidir (aynı genom, aynı çizim).
  const founder = v.ui?.origin ?? v.genomes.get(v.frame.c[0]) ?? null;
  film.play(v.world.chem, renderTerrain(v.world, true, 480), done, founder, theme);
}

// ------------------------------------------------------------------ panel olayları

document.querySelector(".panel")!.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const speciesButton = target.closest<HTMLElement>("[data-species]");
  if (speciesButton) return openSpecies(Number(speciesButton.dataset.species));
  const kindButton = target.closest<HTMLElement>("[data-kind]");
  if (kindButton) {
    logFilter = (kindButton.dataset.kind ?? "") as EventKind | "";
    if (view?.ui) refreshTab(view, view.ui);
    return;
  }
  const gene = target.closest<HTMLElement>("[data-gene]");
  if (gene) {
    pickGene(gene.dataset.gene ?? "");
    if (view?.ui) refreshTab(view, view.ui);
    return;
  }
  const button = target.closest<HTMLElement>("[data-action]");
  if (!button) return;
  switch (button.dataset.action) {
    case "species-back":
      speciesCard = 0;
      client.send({ type: "species", id: 0 });
      break;
    case "species-highlight":
      highlight = highlight === speciesCard ? 0 : speciesCard;
      break;
    case "follow":
      following = !following;
      break;
    case "inspect": {
      const d = view?.ui?.selected;
      if (view && d) viewer.open(view.world.chem, d.genome);
      break;
    }
    case "inspect-planet":
      if (view) viewer.open(view.world.chem, null);
      break;
    case "origin-film":
      if (view) {
        const resume = view.ui && view.ui.speed > 0 ? view.ui.speed : 0;
        client.send({ type: "speed", value: 0 });
        playFilm(view, () => client.send({ type: "speed", value: resume }));
      }
      break;
    case "clone":
      if (tool === "place" && placeTemplate === selected) setTool("select");
      else {
        placeTemplate = selected;
        setTool("place");
      }
      break;
    case "remove":
      client.send({ type: "remove", id: selected });
      break;
    case "organ-remove":
      client.send({ type: "organ", id: selected, organ: button.dataset.organ as OrganType, power: null });
      break;
    case "organ-add": {
      const choice = document.getElementById("organ-add") as HTMLSelectElement | null;
      if (choice && choice.value) client.send({ type: "organ", id: selected, organ: choice.value as OrganType, power: 0.5 });
      break;
    }
    case "ai-species":
      void analyze("species", button as HTMLButtonElement);
      return;
    case "ai-creature":
      void analyze("creature", button as HTMLButtonElement);
      return;
  }
  if (view?.ui) refreshTab(view, view.ui);
});

document.querySelector(".panel")!.addEventListener("change", (event) => {
  const target = event.target as HTMLElement;
  if (target.id === "stage-set") client.send({ type: "stage", id: selected, stage: Number((target as HTMLSelectElement).value) });
});

const GAME_KEY = "evosim-game-mode";
function setGameMode(on: boolean): void {
  document.documentElement.toggleAttribute("data-game", on);
  $<HTMLInputElement>("set-game").checked = on;
  if (!on && tool !== "select") setTool("select");
  try {
    localStorage.setItem(GAME_KEY, on ? "1" : "0");
  } catch {
    // depolama kapalıysa seçim yalnızca bu oturumda geçerli olur
  }
}
$<HTMLInputElement>("set-game").addEventListener("change", (e) => setGameMode((e.target as HTMLInputElement).checked));
$<HTMLInputElement>("set-events").addEventListener("change", (e) => client.send({ type: "set", autoEvents: (e.target as HTMLInputElement).checked }));
$<HTMLSelectElement>("set-evo").addEventListener("change", (e) => client.send({ type: "set", evolutionSpeed: (e.target as HTMLSelectElement).value as EvolutionSpeed }));
$<HTMLInputElement>("set-rescue").addEventListener("change", (e) => client.send({ type: "set", rescueEnabled: (e.target as HTMLInputElement).checked }));
$<HTMLInputElement>("set-plants").addEventListener("input", (e) => client.send({ type: "set", nutrientMultiplier: Number((e.target as HTMLInputElement).value) }));

// ------------------------------------------------------------------ zaman yolculuğu

$<HTMLInputElement>("tl-range").addEventListener("input", (e) => {
  const range = e.target as HTMLInputElement;
  timelinePinned = range.value === range.max;
  const ui = view?.ui;
  if (ui && view && ui.snaps.length > 0) {
    const at = ui.snaps[Math.min(ui.snaps.length - 1, Number(range.value))];
    $("tl-label").textContent = `${fmtTime(at)} · ${fmtTime(view.frame.time - at)} önce`;
  }
});
$("tl-go").addEventListener("click", () => {
  const index = Number($<HTMLInputElement>("tl-range").value);
  const at = view?.ui?.snaps[index];
  if (at === undefined) return;
  client.send({ type: "rewind", index });
  toast(`${fmtTime(at)} anına dönüldü. Bundan sonrası yeniden yaşanacak.`);
});

// ------------------------------------------------------------------ Claude analizi

function strongestWeights(weights: readonly number[], count = 8): string[] {
  return weights
    .map((w, i) => ({ w, i }))
    .sort((a, b) => Math.abs(b.w) - Math.abs(a.w))
    .slice(0, count)
    .map(({ w, i }) => `${BRAIN_INPUTS[i % IN]} → ${BRAIN_ACTIONS[Math.floor(i / IN)]}: ${w.toFixed(2)}`);
}

function worldContext(v: View, ui: UiPayload): Record<string, unknown> {
  return {
    zaman_sn: Math.round(v.frame.time),
    toplam_nufus: v.frame.n,
    bitki_sayisi: v.frame.plants.length / 2,
    beslenme_dagilimi: Object.fromEntries(DIETS.map((d, i) => [DIET_LABEL[d], ui.diets[i]])),
    yasayan_tur_sayisi: ui.species.filter((s) => s.count > 0).length,
    gezegen: { sivi: v.planet.chem.solvent.name, sivi_yuzdesi: Math.round(v.planet.liquidPercent), sicaklik_K: v.planet.chem.temperature, elementler: v.planet.chem.elements.map((e) => e.sym), zar: v.planet.chem.membrane.name, hucre_duvari: v.planet.chem.wall.name },
  };
}

function organNotes(g: Genome): Record<string, string> {
  return Object.fromEntries(g.organs.map((o) => [`${ORGANS[o.type].label} (güç ${o.power.toFixed(2)})`, ORGANS[o.type].description]));
}

function buildPrompt(kind: "species" | "creature"): string | null {
  const v = view;
  const ui = v?.ui;
  if (!v || !ui) return null;
  let subject: Record<string, unknown>;
  if (kind === "species") {
    const d = ui.speciesDetail;
    const info = ui.species.find((s) => s.id === speciesCard);
    if (!d || !info) return null;
    const step = Math.max(1, Math.floor(d.series.length / 2 / 12));
    const curve: string[] = [];
    for (let i = 0; i < d.series.length / 2; i += step) curve.push(`${fmtTime(d.series[i * 2])}=${d.series[i * 2 + 1]}`);
    const name = (id: number): string => ui.species.find((s) => s.id === id)?.name ?? "bilinmiyor";
    subject = {
      tur: info.name,
      beslenme: `${DIET_LABEL[info.diet]}: ${DIET_DESCRIPTION[info.diet]}`,
      orgutlenme_duzeyi: STAGE_LABEL[info.stage],
      birey: info.count,
      en_cok_birey: info.peak,
      toplam_dogum: info.total,
      ortaya_cikis_sn: Math.round(info.born),
      ayrilma_nedeni: info.reason,
      ata_tur: info.parentId ? name(info.parentId) : "yok",
      yavru_turler: d.children.map(name),
      ortalamalar: { yaricap: d.radius, hiz: d.speed, algi: d.sense, metabolizma: d.metabolism },
      karada_olan: d.onLand,
      eseyli_ureyen: d.sexual,
      erkek: d.males,
      ortalama_sus: d.ornament,
      hasta: d.infected,
      organlar: d.organs.map((o) => ({ organ: ORGANS[o.type].label, tasiyan_birey: o.count, ortalama_guc: Number(o.power.toFixed(2)), etkisi: ORGANS[o.type].description })),
      karar_agi_en_guclu_agirliklar: strongestWeights(d.brain),
      nufus_egrisi: curve,
    };
  } else {
    const d = ui.selected;
    if (!d) return null;
    const g = d.genome;
    subject = {
      birey: d.id,
      tur: ui.species.find((s) => s.id === g.speciesId)?.name ?? "bilinmiyor",
      beslenme: `${DIET_LABEL[g.diet]}: ${DIET_DESCRIPTION[g.diet]}`,
      orgutlenme_duzeyi: STAGE_LABEL[g.stage],
      nesil: g.generation,
      ureme: `${g.reproductionStrategy === "sexual" ? `eşeyli, ${g.sex === "f" ? "dişi" : "erkek"}` : "eşeysiz"}, ${g.laysEggs ? "yumurtlar" : "canlı doğurur"}`,
      yasiyor: d.alive,
      enerji_orani: Number((d.energy / d.maxEnergy).toFixed(2)),
      yas_orani: Number((d.age / g.maxLifespan).toFixed(2)),
      hiz: d.speed,
      algi: d.sense,
      metabolizma: d.metabolism,
      nufus_ortalamalari: d.inspection.means,
      organlar: organNotes(g),
      karar_agi_en_guclu_agirliklar: strongestWeights(g.brain),
      soy_gecmisi: d.inspection.history.map((h) => `${h.gen}. nesil: ${h.notes.join(", ")}`),
      olum_nedeni: d.inspection.rec?.cause || null,
    };
  }
  return (
    `Aşağıda Evosim adlı bir yapay yaşam simülasyonundan ÖLÇÜLMÜŞ veriler var. Bu simülasyonda canlılar organsız tek hücreliler olarak başlar; organlar, beslenme biçimi, ` +
    `örgütlenme düzeyi ve davranışı belirleyen karar ağı (girdi → eylem ağırlıkları) mutasyon ve seçilimle değişir.\n\n` +
    `${kind === "species" ? "Bu TÜRÜ" : "Bu BİREYİ"} bir saha biyoloğu gibi yorumla: nasıl geçiniyor, organları ve karar ağı bu yaşam biçimiyle nasıl ilişkili, en belirgin zayıflığı ya da riski ne?\n` +
    `Kurallar: Türkçe yaz. Düz metin kullan, markdown ya da madde işareti kullanma. En çok 170 kelime. Yalnızca verilen ölçümlere dayan; ` +
    `veride olmayan bir nedeni kesinmiş gibi sunma, çıkarım yapıyorsan "muhtemelen" de.\n\n` +
    `VERİ:\n${JSON.stringify({ konu: subject, ortam: worldContext(v, ui) }, null, 1)}`
  );
}

async function analyze(kind: "species" | "creature", button: HTMLButtonElement): Promise<void> {
  const out = document.getElementById(`ai-${kind}-out`);
  const prompt = buildPrompt(kind);
  if (!sample || !out || !prompt) return;
  out.hidden = false;
  out.textContent = "Claude ölçümleri inceliyor…";
  button.disabled = true;
  try {
    const result = await sample(prompt, { onText: (part) => (out.textContent = part.text) });
    out.textContent = result.text;
  } catch (error) {
    const e = (error ?? {}) as SampleError;
    out.textContent = e.text ? e.text : e.code === "not_granted" ? "İzin verilmediği için analiz yapılamadı." : e.code === "rate_limited" ? "Çok sık istek gönderildi; biraz sonra yeniden deneyin." : "Analiz alınamadı.";
  } finally {
    button.disabled = false;
  }
}

if (runtime && typeof runtime.use === "function") {
  void runtime.use("sample").then((fn) => {
    sample = (fn as SampleFn | null) ?? null;
    // Analiz düğmesi kartların iskeletindedir; iskeletler yeniden kurulsun.
    speciesSkeletonFor = -1;
    creatureSkeletonFor = -1;
  });
  void runtime.use("downloads").then((ns) => (downloads = (ns as Downloads | null) ?? null));
}

// ------------------------------------------------------------------ pencereler

for (const b of document.querySelectorAll<HTMLElement>("[data-close]")) b.addEventListener("click", () => b.closest("dialog")?.close());

// Gezegen
let previewTimer = 0;
function previewPlanet(): void {
  const seed = parseSeed($<HTMLInputElement>("seed-input").value);
  const world = new World(seed);
  const canvas = $<HTMLCanvasElement>("planet-map");
  const terrain = renderTerrain(world, isDark(), 480);
  canvas.width = terrain.width;
  canvas.height = terrain.height;
  canvas.getContext("2d")!.drawImage(terrain, 0, 0);
  $("planet-preview-facts").innerHTML = planetHtml(generatePlanetProfile(world), false);
}

function openPlanet(): void {
  $<HTMLInputElement>("seed-input").value = String(randomSeed());
  previewPlanet();
  const dialog = $<HTMLDialogElement>("dlg-planet");
  if (!dialog.open) dialog.showModal();
}

function startPlanet(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* depolama yoksa silinecek kayıt da yoktur */
  }
  started = true;
  client.send({ type: "init", seed: parseSeed($<HTMLInputElement>("seed-input").value) });
  client.send({ type: "speed", value: lastSpeed });
}

$("btn-new").addEventListener("click", openPlanet);
$("seed-random").addEventListener("click", () => {
  $<HTMLInputElement>("seed-input").value = String(randomSeed());
  previewPlanet();
});
$("seed-input").addEventListener("input", () => {
  window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(previewPlanet, 180);
});
$("planet-form").addEventListener("submit", (e) => {
  e.preventDefault();
  startPlanet();
  $<HTMLDialogElement>("dlg-planet").close();
});
// İlk açılışta pencere başlatmadan kapatılırsa da gösterilen gezegen başlar.
$("dlg-planet").addEventListener("close", () => {
  if (!started) startPlanet();
});

// Soy ağacı
const tree = new PhyloTree($<HTMLCanvasElement>("tree-canvas"), $("tree-wrap"), $("tree-tip"), $("tree-count"), (id) => {
  highlight = id;
  openSpecies(id);
});
function drawTree(): void {
  const ui = view?.ui;
  if (!view || !ui) return;
  tree.draw(ui.species, view.frame.time, theme, $<HTMLInputElement>("tree-established").checked, $<HTMLInputElement>("tree-living").checked);
}
$("btn-tree").addEventListener("click", () => {
  $<HTMLDialogElement>("dlg-tree").showModal();
  drawTree();
});
$("tree-established").addEventListener("change", drawTree);
$("tree-living").addEventListener("change", drawTree);
new ResizeObserver(() => {
  if ($<HTMLDialogElement>("dlg-tree").open) drawTree();
}).observe($("tree-wrap"));

// Kayıt
function saveStatus(text: string): void {
  $("save-status").textContent = text;
}

function loadText(text: string): void {
  let data: SaveData;
  try {
    data = JSON.parse(text) as SaveData;
  } catch {
    saveStatus("Metin geçerli bir kayıt değil.");
    return;
  }
  saveStatus("");
  started = true;
  client.send({ type: "load", data });
}

$("btn-save").addEventListener("click", () => {
  saveStatus("");
  $("save-download").hidden = downloads === null && window.top !== window;
  $<HTMLDialogElement>("dlg-save").showModal();
});
$("save-download").addEventListener("click", async () => {
  if (!view) return;
  const json = JSON.stringify(await client.save());
  const filename = `evosim-${view.world.seed}-${Math.round(view.frame.time)}sn.json`;
  if (downloads) {
    try {
      await downloads.save({ filename, data: json });
      saveStatus("Dosya kaydedildi.");
    } catch (error) {
      saveStatus((error as SampleError | null)?.code === "declined" ? "İndirme iptal edildi." : "Dosya indirilemedi; panoya kopyalamayı deneyin.");
    }
    return;
  }
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  saveStatus(`${Math.round(json.length / 1024)} KB indirildi.`);
});
$("save-copy").addEventListener("click", async () => {
  const json = JSON.stringify(await client.save());
  try {
    await navigator.clipboard.writeText(json);
    saveStatus(`${Math.round(json.length / 1024)} KB panoya kopyalandı.`);
  } catch {
    const area = $<HTMLTextAreaElement>("save-text");
    area.value = json;
    area.select();
    saveStatus("Panoya yazılamadı; metin aşağıda seçili, elle kopyalayın.");
  }
});
$<HTMLInputElement>("save-file").addEventListener("change", (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => loadText(String(reader.result));
  reader.readAsText(file);
  input.value = "";
});
$("save-load").addEventListener("click", () => loadText($<HTMLTextAreaElement>("save-text").value));

// Paneller haritanın üstünde yüzer: açılış görünümü panelin kapatmadığı alana ortalanır.
function layout(): void {
  scene.padRight = window.innerWidth > 920 ? 432 : 0;
}
window.addEventListener("resize", layout);
layout();
// Yazı tipleri yüklenince tuval yazıları da yenilensin.
void document.fonts?.ready.then(() => {
  if (view?.ui) refreshTab(view, view.ui);
});

// ------------------------------------------------------------------ klavye

window.addEventListener("keydown", (e) => {
  const target = e.target as HTMLElement;
  if (target.closest("input, textarea, select, dialog")) return;
  if (e.code === "Space") {
    e.preventDefault();
    client.send({ type: "speed", value: view?.ui && view.ui.speed > 0 ? 0 : lastSpeed });
  } else if (e.key === "Escape") {
    if (tool !== "select") setTool("select");
    else if (selected) select(0);
    else highlight = 0;
  } else if (e.key === "f" || e.key === "F") {
    if (selected) following = !following;
  }
});

// ------------------------------------------------------------------ otomatik kayıt ve açılış

window.setInterval(() => {
  if (!view || document.hidden || view.ui?.extinct) return;
  void client.save().then((data) => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* kota dolduysa otomatik kayıt atlanır */
    }
  });
}, AUTOSAVE_MS);

setTool("select");
try {
  setGameMode(localStorage.getItem(GAME_KEY) === "1");
} catch {
  setGameMode(false);
}
let restored = false;
try {
  // Eski anahtarla tutulan otomatik kayıt yeni anahtara taşınır.
  const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
  if (legacy) {
    if (!localStorage.getItem(SAVE_KEY)) localStorage.setItem(SAVE_KEY, legacy);
    localStorage.removeItem(LEGACY_SAVE_KEY);
  }
  const saved = localStorage.getItem(SAVE_KEY);
  if (saved) {
    client.send({ type: "load", data: JSON.parse(saved) as SaveData });
    restored = true;
  }
} catch {
  restored = false;
}
if (restored) {
  // Kayıt bozuksa ya da eski sürümdense kare gelmez: yeni gezegen penceresi açılır.
  window.setTimeout(() => {
    if (!view) openPlanet();
  }, 1800);
} else openPlanet();
