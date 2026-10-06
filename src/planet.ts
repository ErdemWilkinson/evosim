import { Chemistry } from "./chemistry";
import { OrganType } from "./organs";
import { World } from "./world";

/**
 * Gezegen profili: kimyayı (bkz. chemistry.ts) haritanın ölçülen sıvı oranıyla
 * birleştirir. Kimyanın simülasyona etkileri: çözücü sıcaklığı metabolizma, hız ve
 * üretici büyümesini; hücre duvarı can ve hızı; element listesi iki organın bu
 * dünyada ortaya çıkıp çıkamayacağını; köken senaryosu ilk hücrenin genlerini belirler.
 */
export interface PlanetProfile {
  seed: number;
  chem: Chemistry;
  liquidPercent: number;
  narrative: string;
  forbiddenOrgans: OrganType[];
}

export function generatePlanetProfile(world: World): PlanetProfile {
  const chem = world.chem;
  const liquidPercent = world.waterFraction * 100;
  const sea = chem.solvent.sea;
  const surface =
    liquidPercent >= 60 ? `geniş ${sea} okyanuslarının kapladığı bir yüzeyle` : liquidPercent >= 50 ? `dengeli bir ${sea} denizi ve kara dağılımıyla` : `dağınık ${sea} denizlerinin böldüğü geniş kara kütleleriyle`;
  const top = chem.elements.slice(0, 3).map((e) => e.sym).join(", ");
  const narrative =
    `Bu gezegen ${surface} şekillendi; yüzey sıcaklığı ${chem.temperature} K (${chem.temperature - 273} °C). ` +
    `Kabukta en bol elementler ${top}. Yaşam ${chem.scaffold.name.toLocaleLowerCase("tr")} iskeleti üzerine kurulu.`;

  const forbiddenOrgans: OrganType[] = [];
  if (!chem.has.has("N")) forbiddenOrgans.push("nitrogen_sac");
  if (!chem.has.has("S")) forbiddenOrgans.push("sulfur_vent_organ");

  return { seed: world.seed, chem, liquidPercent, narrative, forbiddenOrgans };
}
