import { makeRng } from "./rng";
import { OrganType } from "./organs";
import { World } from "./world";

/**
 * Gezegen oluşum profili: harita tohumundan ve haritanın ölçülen su oranından
 * deterministik türetilir. Kurgusaldır (gerçek bir iklim modeli değildir) ama
 * simülasyona iki gerçek etkisi vardır: azot seviyesi ve kükürtçe zengin bileşenler,
 * gezegene özgü iki organın bu dünyada ortaya çıkıp çıkamayacağını belirler.
 */

export type NitrogenLevel = "low" | "moderate" | "high";

export interface PlanetProfile {
  seed: number;
  atmosphere: { nitrogen: number; oxygen: number; carbonDioxide: number; methane: number };
  nitrogenLevel: NitrogenLevel;
  bioSubstances: string[];
  sulfurRich: boolean;
  narrative: string;
  waterPercent: number;
  forbiddenOrgans: OrganType[];
}

const BIO_SUBSTANCES: readonly { name: string; sulfur?: boolean }[] = [
  { name: "Zengin organik çözelti" },
  { name: "Yüksek kükürt konsantrasyonu", sulfur: true },
  { name: "İz demir-sülfür kristalleri", sulfur: true },
  { name: "Alkali mineral tortusu" },
  { name: "Fosfatça zengin tortul katman" },
  { name: "Yoğun amino asit izleri" },
  { name: "Volkanik silikat tozu" },
  { name: "Karbonat kayaç tortusu" },
  { name: "Jeotermal iz elementler" },
  { name: "Metan hidrat cepleri" },
  { name: "Amonyak izli buzul kalıntıları" },
  { name: "Bakır-çinko iz mineralleri" },
];

export const NITROGEN_LABEL: Record<NitrogenLevel, string> = { low: "düşük", moderate: "orta", high: "yüksek" };

export function generatePlanetProfile(world: World): PlanetProfile {
  const r = makeRng(world.seed ^ 0x9e3779b9);
  const wet = world.waterFraction;

  const n = r.range(68, 84);
  const o = r.range(12, 22);
  const c = r.range(2, 8) + wet * 3;
  const m = r.range(0.5, 4) + wet * 2;
  const scale = 100 / (n + o + c + m);
  const atmosphere = { nitrogen: n * scale, oxygen: o * scale, carbonDioxide: c * scale, methane: m * scale };
  const nitrogenLevel: NitrogenLevel = atmosphere.nitrogen >= 78 ? "high" : atmosphere.nitrogen >= 72 ? "moderate" : "low";

  const pool = BIO_SUBSTANCES.slice();
  const count = 3 + r.int(3);
  const bioSubstances: string[] = [];
  let sulfurRich = false;
  for (let i = 0; i < count; i++) {
    const picked = pool.splice(r.int(pool.length), 1)[0];
    bioSubstances.push(picked.name);
    if (picked.sulfur) sulfurRich = true;
  }

  const waterPercent = wet * 100;
  const surface =
    waterPercent >= 60
      ? "geniş okyanusların kapladığı bir yüzeyle"
      : waterPercent >= 50
        ? "dengeli bir su ve kara dağılımıyla"
        : "dağınık denizlerin böldüğü geniş kara kütleleriyle";
  const nitrogenText =
    nitrogenLevel === "high" ? "alışılmadık yoğunlukta azot" : nitrogenLevel === "moderate" ? "orta düzeyde azot" : "görece az azot";
  const narrative =
    `Bu gezegen ${surface} şekillendi. Atmosferinde ${nitrogenText} var. ` +
    `${bioSubstances[0]} ve ${bioSubstances[1].toLocaleLowerCase("tr")} gibi bileşenler, ` +
    `ilk mikroorganizmaların sığ sularda ortaya çıkması için elverişli bir kimyasal zemin hazırladı.`;

  const forbiddenOrgans: OrganType[] = [];
  if (nitrogenLevel === "low") forbiddenOrgans.push("nitrogen_sac");
  if (!sulfurRich) forbiddenOrgans.push("sulfur_vent_organ");

  return { seed: world.seed, atmosphere, nitrogenLevel, bioSubstances, sulfurRich, narrative, waterPercent, forbiddenOrgans };
}
