import { Diet, Genome } from "./genome";
import { OrganType } from "./organs";
import { makeRng } from "./rng";

/** Tür adları: Latince görünümlü ikili adlar. Cins, diyet değiştiğinde yenilenir;
 *  tür eki kurucuyu atasından ayıran özelliği (yeni organ ya da diyet) yansıtır. */

const GENUS_PREFIX = ["Aqu", "Cyt", "Plasm", "Micr", "Vort", "Nemat", "Phyc", "Derm", "Rhiz", "Gastr", "Cili", "Halo", "Thalass", "Limn", "Pelag", "Bathy", "Terr", "Proto", "Xen", "Ambly"];
const GENUS_SUFFIX = ["ella", "ium", "ops", "ia", "odon", "phora", "monas", "cystis", "nema", "ina", "astra", "ura"];

const ORGAN_EPITHET: Partial<Record<OrganType, string>> = {
  leg: "pedata",
  fin: "pinnata",
  wing: "alata",
  tentacle: "flagellata",
  eye: "oculata",
  eyespot: "ocellata",
  bioluminescence: "lucens",
  mouth: "mandibulata",
  shell: "testacea",
  spike: "spinosa",
  camouflage: "cryptica",
  chromatophore: "versicolor",
  venom: "venenata",
  claw: "unguiculata",
  lung: "pulmonata",
  gill: "branchiata",
  torpor: "dormiens",
  blubber: "adiposa",
  regeneration: "rediviva",
  heart: "cordata",
  sucker: "acetabulata",
  olfactory: "olfactoria",
  lateral_line: "lineata",
  electroreceptor: "electrica",
  stomach: "gastrica",
  filter_comb: "pectinata",
  pigment: "pigmentata",
  ink_sac: "atramentaria",
  mucus_coat: "mucosa",
  fat_store: "pinguis",
  swim_bladder: "vesicata",
  brood_pouch: "marsupiata",
  immune_gland: "immunis",
  sprint_muscle: "celeris",
};

const DIET_EPITHET: Record<Diet, string[]> = {
  phototroph: ["viridis", "solaris", "chlorina"],
  herbivore: ["placida", "pascens", "mitis"],
  parasite: ["parasitica", "haustrix", "adhaerens"],
  filter_feeder: ["colans", "filtrans", "pelagica"],
  omnivore: ["varia", "omnivora", "versatilis"],
  scavenger: ["necrophaga", "saprofaga", "funesta"],
  carnivore: ["rapax", "vorax", "ferox"],
};

const FALLBACK_EPITHET = ["minor", "major", "nova", "affinis", "dubia", "communis", "gracilis", "robusta", "velox", "tarda"];

export function makeGenus(seed: number, speciesId: number): string {
  const r = makeRng(seed ^ Math.imul(speciesId, 0x45d9f3b));
  return GENUS_PREFIX[r.int(GENUS_PREFIX.length)] + GENUS_SUFFIX[r.int(GENUS_SUFFIX.length)];
}

export function makeEpithet(seed: number, speciesId: number, founder: Genome, parentType: Genome | null, taken: ReadonlySet<string>, genus: string): string {
  const r = makeRng(seed ^ Math.imul(speciesId, 0x2c1b3c6d));
  const candidates: string[] = [];
  if (parentType) {
    for (const o of founder.organs) {
      const e = ORGAN_EPITHET[o.type];
      if (e && !parentType.organs.some((p) => p.type === o.type)) candidates.push(e);
    }
  }
  const dietList = DIET_EPITHET[founder.diet];
  candidates.push(dietList[r.int(dietList.length)]);
  for (const o of founder.organs) {
    const e = ORGAN_EPITHET[o.type];
    if (e) candidates.push(e);
  }
  for (const e of dietList) candidates.push(e);
  for (let i = 0; i < FALLBACK_EPITHET.length; i++) candidates.push(FALLBACK_EPITHET[(i + speciesId) % FALLBACK_EPITHET.length]);
  for (const e of candidates) if (!taken.has(`${genus} ${e}`)) return e;
  return `sp. ${speciesId}`;
}
