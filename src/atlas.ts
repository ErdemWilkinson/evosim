import { SOLVENTS, SCAFFOLDS, MEMBRANES, WALLS, GENETICS, ENERGIES, CATALYSTS, PIGMENTS } from "./chemistry";
import { DIETS, DIET_LABEL } from "./genome";
import { MS_LABEL, milestoneKeys } from "./history";
import { ORGANS, ORGAN_TYPES } from "./organs";
import { PlanetProfile } from "./planet";
import { UiPayload } from "./protocol";
import { esc } from "./ui";

/**
 * Atlas ve başarımlar. Tarayıcı depolamasında tutulur (kapalıysa yalnızca bu oturumda).
 * Yalnızca gözlemden beslenir; benzetime dokunmaz. Oyun modunda kazanılanlar ayrıca işaretlenir.
 */

const KEY = "evosim.atlas.v1";

interface Entry {
  t: number;
  game: boolean;
}

interface Store {
  organs: Record<string, Entry>;
  diets: Record<string, Entry>;
  chem: Record<string, Entry>;
  miles: Record<string, Entry>;
  ach: Record<string, Entry>;
}

const CHEM_KINDS: { kind: string; label: string; list: { id: string; name: string }[] }[] = [
  { kind: "solvent", label: "Çözücü", list: SOLVENTS },
  { kind: "scaffold", label: "İskelet", list: SCAFFOLDS },
  { kind: "membrane", label: "Zar", list: MEMBRANES },
  { kind: "wall", label: "Hücre duvarı", list: WALLS },
  { kind: "genetic", label: "Kalıtım", list: GENETICS },
  { kind: "energy", label: "Enerji", list: ENERGIES },
  { kind: "catalyst", label: "Katalizör", list: CATALYSTS },
  { kind: "pigment", label: "Işık pigmenti", list: PIGMENTS },
];

const empty = (): Store => ({ organs: {}, diets: {}, chem: {}, miles: {}, ach: {} });

const store: Store = empty();
let persistent = false;
let loaded = false;
let worldGame = false;

function load(): void {
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    persistent = true;
    if (raw) {
      const data = JSON.parse(raw) as Partial<Store>;
      for (const k of Object.keys(store) as (keyof Store)[]) {
        const part = data[k];
        if (part && typeof part === "object") store[k] = part as Record<string, Entry>;
      }
    }
  } catch {
    persistent = false;
  }
}

function save(): void {
  if (!persistent) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    persistent = false;
  }
}

/** Yeni dünya: oyun modu bayrağı sıfırlanır. */
export function resetAtlasWorld(): void {
  worldGame = false;
}

function mark(group: Record<string, Entry>, id: string, game: boolean): boolean {
  const have = group[id];
  if (!have) {
    group[id] = { t: Date.now(), game };
    return true;
  }
  // Önce oyun modunda görülen şey sonradan salt gözlemle de görülürse bayrak kalkar.
  if (have.game && !game) {
    have.game = false;
    return true;
  }
  return false;
}

interface Ctx {
  ui: UiPayload;
  time: number;
  fossils: number;
  seen: { organs: number; diets: number; chem: number };
}

interface Achievement {
  id: string;
  label: string;
  note: string;
  test: (c: Ctx) => boolean;
}

const hasMs = (c: Ctx, key: string): boolean => c.ui.milestones.some((m) => m.key === key);

export const ACHIEVEMENTS: Achievement[] = [
  { id: "light", label: "İlk ışık", note: "Işıktan beslenen ilk canlıyı gördün.", test: (c) => hasMs(c, "photosynth") },
  { id: "hunt", label: "İlk av", note: "Bir canlının başka bir canlıyı avlamasına tanık oldun.", test: (c) => hasMs(c, "predator") },
  { id: "parasite", label: "Konak ve yük", note: "Parazitin ortaya çıkışını izledin.", test: (c) => hasMs(c, "parasite") },
  { id: "many", label: "Birlikte güçlü", note: "Çok hücreli yaşamın doğuşunu gördün.", test: (c) => hasMs(c, "multicellular") },
  { id: "land", label: "Karaya ilk adım", note: "Yaşam kıyıdan karaya çıktı.", test: (c) => hasMs(c, "land") },
  { id: "two", label: "İki ebeveyn", note: "Eşeyli üremenin ortaya çıkışını izledin.", test: (c) => hasMs(c, "sexual") },
  { id: "dieoff", label: "Yas tutan gezegen", note: "Kitlesel bir yok oluşa tanık oldun.", test: (c) => hasMs(c, "dieoff") },
  { id: "organs", label: "Organ koleksiyoncusu", note: "Atlasa sekiz farklı organ ekledin.", test: (c) => c.seen.organs >= 8 },
  { id: "diets", label: "Çeşitli sofra", note: "Atlasa beş farklı beslenme biçimi ekledin.", test: (c) => c.seen.diets >= 5 },
  { id: "chem", label: "Kimya meraklısı", note: "Atlasa on iki farklı kimya seçeneği ekledin.", test: (c) => c.seen.chem >= 12 },
  { id: "watch", label: "Uzun gözlem", note: "Tek bir dünyayı yarım saat boyunca izledin.", test: (c) => c.time >= 1800 },
  { id: "fossil", label: "Fosil bırakan", note: "Kalıcılaşmış bir tür tükendi ve fosil kaydına girdi.", test: (c) => c.fossils >= 1 },
  { id: "line", label: "Soy sürdürücü", note: "İşaretlediğin soy on nesil ilerledi.", test: (c) => !!c.ui.line && c.ui.line.maxGen >= 10 },
];

function count(group: Record<string, Entry>): number {
  return Object.keys(group).length;
}

/** Her yenilemede çağrılır. Yeni kazanılan başarımların listesini döndürür. */
export function observeAtlas(ui: UiPayload, planet: PlanetProfile, time: number, fossils: number, game: boolean): { label: string; game: boolean }[] {
  if (!loaded) load();
  if (game) worldGame = true;
  const g = worldGame;
  let dirty = false;
  for (const t of ORGAN_TYPES) if ((ui.organs[t] ?? 0) > 0) dirty = mark(store.organs, t, g) || dirty;
  DIETS.forEach((d, i) => {
    if ((ui.diets[i] ?? 0) > 0) dirty = mark(store.diets, d, g) || dirty;
  });
  for (const m of ui.milestones) dirty = mark(store.miles, m.key, g) || dirty;
  for (const k of CHEM_KINDS) {
    const opt = (planet.chem as unknown as Record<string, { id: string }>)[k.kind];
    if (opt) dirty = mark(store.chem, `${k.kind}:${opt.id}`, g) || dirty;
  }
  const ctx: Ctx = { ui, time, fossils, seen: { organs: count(store.organs), diets: count(store.diets), chem: count(store.chem) } };
  const won: { label: string; game: boolean }[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!a.test(ctx)) continue;
    if (!store.ach[a.id]) won.push({ label: a.label, game: g });
    dirty = mark(store.ach, a.id, g) || dirty;
  }
  if (dirty) save();
  return won;
}

const chip = (on: boolean, label: string, game: boolean): string => `<span class="chip${on ? " on" : ""}${on && game ? " game" : ""}">${on ? label : "?"}</span>`;

export function atlasHtml(): string {
  if (!loaded) load();
  const organs = ORGAN_TYPES.map((t) => chip(!!store.organs[t], ORGANS[t].label, store.organs[t]?.game ?? false)).join("");
  const diets = DIETS.map((d) => chip(!!store.diets[d], DIET_LABEL[d], store.diets[d]?.game ?? false)).join("");
  const miles = milestoneKeys()
    .map((k) => chip(!!store.miles[k], MS_LABEL[k], store.miles[k]?.game ?? false))
    .join("");
  const chem = CHEM_KINDS.map((k) => {
    const got = k.list.filter((o) => store.chem[`${k.kind}:${o.id}`]);
    return `<div class="atlas-chem"><span class="label">${k.label}</span><b>${got.length} / ${k.list.length}</b><small>${got.map((o) => esc(o.name)).join(" · ") || "—"}</small></div>`;
  }).join("");
  const ach = ACHIEVEMENTS.map((a) => {
    const e = store.ach[a.id];
    return `<div class="ach${e ? " on" : ""}${e?.game ? " game" : ""}"><b>${e ? a.label : "?"}</b><small>${e ? a.note : "Henüz kazanılmadı."}</small>${e?.game ? `<em>Oyun modunda kazanıldı</em>` : ""}</div>`;
  }).join("");
  return (
    (persistent ? "" : `<p class="foot" style="margin:0 0 8px">Tarayıcı depolaması kapalı: atlas yalnızca bu oturumda tutulur.</p>`) +
    `<h4 class="atlas-h">Organlar <small>${count(store.organs)} / ${ORGAN_TYPES.length}</small></h4><div class="chips">${organs}</div>` +
    `<h4 class="atlas-h">Beslenme biçimleri <small>${count(store.diets)} / ${DIETS.length}</small></h4><div class="chips">${diets}</div>` +
    `<h4 class="atlas-h">Dönüm noktaları <small>${count(store.miles)} / ${milestoneKeys().length}</small></h4><div class="chips">${miles}</div>` +
    `<h4 class="atlas-h">Kimya seçenekleri</h4><div class="atlas-chems">${chem}</div>` +
    `<h4 class="atlas-h">Başarımlar <small>${count(store.ach)} / ${ACHIEVEMENTS.length}</small></h4><div class="achs">${ach}</div>`
  );
}
