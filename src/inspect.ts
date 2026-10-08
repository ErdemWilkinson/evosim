import { CATALYSTS, Chemistry, ELEMENTS, ENERGIES, GENETICS, GeneticOption, MEMBRANES, Option, WALLS, originSteps } from "./chemistry";
import { Genome } from "./genome";
import { ORGANS, OrganType } from "./organs";
import { Theme, drawCreature } from "./render";
import { getLang, tr } from "./i18n";

/**
 * Yapı inceleme ekranı ve köken filmi. İkisi de gezegenin kimyasını (chemistry.ts)
 * çizer: canlıdan hücre kabuğunun kesitine, oradan tek bir moleküle ve atoma iner.
 * Molekül çizimleri iskelet gösterimidir: hidrojenler çizilmez, "R" zincirin devamıdır.
 */

interface Mol {
  formula: string;
  atoms: { sym: string; x: number; y: number }[];
  /** order 0: iyonik/koordinasyon bağı (kesikli). */
  bonds: { a: number; b: number; order: number }[];
}

function mol(formula: string, atoms: string, bonds: string): Mol {
  return {
    formula,
    atoms: atoms.split("|").map((part) => {
      const [sym, x, y] = part.trim().split(/\s+/);
      return { sym, x: Number(x), y: Number(y) };
    }),
    bonds: bonds
      .trim()
      .split(/\s+/)
      .filter((part) => part !== "")
      .map((part) => {
        const m =/^(\d+)([-=#.])(\d+)$/.exec(part)!;
        return { a: Number(m[1]), b: Number(m[3]), order: m[2] === "-" ? 1 : m[2] === "=" ? 2 : m[2] === "#" ? 3 : 0 };
      }),
  };
}

function lattice(formula: string, a: string, b: string, cols = 4, rows = 3): Mol {
  const atoms: Mol["atoms"] = [];
  const bonds: Mol["bonds"] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      atoms.push({ sym: (x + y) % 2 === 0 ? a : b, x: x * 1.1, y: y * 1.1 });
      if (x > 0) bonds.push({ a: y * cols + x - 1, b: y * cols + x, order: 1 });
      if (y > 0) bonds.push({ a: (y - 1) * cols + x, b: y * cols + x, order: 1 });
    }
  }
  return { formula, atoms, bonds };
}

const metalCenter = (sym: string): Mol => mol(`${sym} merkezi, dört bağlayıcı atomla`, `${sym} 0 0|N -1.2 0|N 1.2 0|S 0 -1.2|O 0 1.2|C -2.1 .6|C 2.1 -.6|C .6 -2.1|C -.6 2.1`, "0.1 0.2 0.3 0.4 1-5 2-6 3-7 4-8");
const porphyrin = (sym: string): Mol =>
  mol(`${sym}N₄ halka çekirdeği`, `${sym} 0 0|N 1.3 0|C 1.5 1.5|N 0 1.3|C -1.5 1.5|N -1.3 0|C -1.5 -1.5|N 0 -1.3|C 1.5 -1.5|C 2.6 .8|C 2.6 -.8|C -2.6 .8|C -2.6 -.8`, "0.1 0.3 0.5 0.7 1-2 2=3 3-4 4=5 5-6 6=7 7-8 8=1 1-9 1-10 5-11 5-12");

const SILOXANE = mol("[–Si(CH₃)₂–O–]ₙ", "Si 0 0|O 1 .5|Si 2 0|O 3 .5|Si 4 0|C 0 -1.1|C -.9 .6|C 2 -1.1|C 2 1.2|C 4 -1.1|R 5 .5", "0-1 1-2 2-3 3-4 0-5 0-6 2-7 2-8 4-9 4-10");
const PEPTIDE = mol("–NH–CHR–CO–NH–CHR–CO–", "N 0 .5|C 1 0|R 1 -1.1|C 2 .5|O 2 1.6|N 3 0|C 4 .5|R 4 1.6|C 5 0|O 5 -1.1|O 6 .5", "0-1 1-2 1-3 3=4 3-5 5-6 6-7 6-8 8=9 8-10");
const FES = lattice("FeS örgüsü", "Fe", "S");
const PAH = mol("C₁₄H₁₀ (üç kaynaşık halka)", "C 0 0|C 1 -.6|C 2 0|C 2 1.2|C 1 1.8|C 0 1.2|C 3 -.6|C 4 0|C 4 1.2|C 3 1.8|C 5 -.6|C 6 0|C 6 1.2|C 5 1.8", "0=1 1-2 2=3 3-4 4=5 5-0 2-6 6=7 7-8 8=9 9-3 7-10 10=11 11-12 12=13 13-8");

const MOLECULES: Record<string, Mol> = {
  phospholipid: mol("C₄₂H₈₂NO₈P (fosfatidilkolin)", "N -3 0|C -2 .5|C -1 0|O 0 .5|P 1 0|O 1 -1.1|O 1 1.1|O 2 .5|C 3 0|C 4 .5|C 5 0|O 4 1.6|C 4 2.6|O 3 3.1|R 5 3.1|O 6 .5|C 7 0|O 7 -1.1|R 8 .5", "0-1 1-2 2-3 3-4 4=5 4-6 4-7 7-8 8-9 9-10 9-11 11-12 12=13 12-14 10-15 15-16 16=17 16-18"),
  fattyacid: mol("CH₃(CH₂)ₙCOOH", "O -1 .5|C 0 0|O 0 -1.1|C 1 .5|C 2 0|C 3 .5|C 4 0|C 5 .5|R 6 0", "0-1 1=2 1-3 3-4 4-5 5-6 6-7 7-8"),
  etherlipid: mol("gliserol dieter, dallı izoprenoit zincir", "O -1 .5|C 0 0|C 1 .5|C 2 0|O 1 1.6|C 1 2.6|C 2 3.1|C 2 4.2|C 3 2.6|R 4 3.1|O 3 .5|C 4 0|C 5 .5|C 5 1.6|R 6 0", "0-1 1-2 2-3 2-4 4-5 5-6 6-7 6-8 8-9 3-10 10-11 11-12 12-13 12-14"),
  azotosome: mol("CH₂=CH–C≡N (akrilonitril)", "C 0 .5|C 1 0|C 2 .5|N 3 1", "0=1 1-2 2#3"),
  peptide: PEPTIDE,
  pah: PAH,
  pahstack: PAH,
  siloxane: SILOXANE,
  pore: FES,
  peptidoglycan: mol("N-asetilglukozamin birimi + peptit köprüsü", "C 0 0|C 1 -.5|C 2 0|C 2 1.1|C 1 1.6|O 0 1.1|N 3 -.5|C 4 0|O 4 1.1|C 5 -.5|O 3 1.6|R 4 2.1", "0-1 1-2 2-3 3-4 4-5 5-0 2-6 6-7 7=8 7-9 3-10 10-11"),
  silica: mol("SiO₂ (her Si dört O ile, her O iki Si ile bağlı)", "Si 0 0|O 1.1 0|Si 2.2 0|O 0 1.1|O 2.2 1.1|Si 0 2.2|O 1.1 2.2|Si 2.2 2.2|O -1.1 0|O 3.3 0|O -1.1 2.2|O 3.3 2.2", "0-1 1-2 0-3 3-5 2-4 4-7 5-6 6-7 0-8 2-9 5-10 7-11"),
  calcite: mol("CaCO₃", "Ca 0 0|C 2 0|O 2 -1.1|O 1.1 .6|O 2.9 .6|Ca 4 0", "1=2 1-3 1-4 0.3 4.5"),
  ironsulfide: lattice("Fe₃S₄ (greigit) örgüsü", "Fe", "S"),
  cellulose: mol("(C₆H₁₀O₅)ₙ", "C 0 0|C 1 -.5|C 2 0|C 2 1.1|C 1 1.6|O 0 1.1|O 3 -.5|C 4 0|C 5 -.5|C 6 0|C 6 1.1|C 5 1.6|O 4 1.1|O 1 -1.6|O 7 -.5", "0-1 1-2 2-3 3-4 4-5 5-0 2-6 6-7 7-8 8-9 9-10 10-11 11-12 12-7 1-13 9-14"),
  borate: mol("borat diester köprüsü, B(OR)₄⁻", "B 0 0|O -1 -.8|O -1 .8|O 1 -.8|O 1 .8|C -2 -.6|C -2 .6|C 2 -.6|C 2 .6|R -3 -1.1|R 3 1.1", "0-1 0-2 0-3 0-4 1-5 2-6 5-6 3-7 4-8 7-8 5-9 8-10"),
  slayer: mol("kükürtlü yan zincirli peptit", "N 0 .5|C 1 0|C 1 -1.1|S 1 -2.3|C 2 .5|O 2 1.6|N 3 0|C 4 .5|R 4 1.6|C 5 0|O 5 -1.1", "0-1 1-2 2-3 1-4 4=5 4-6 6-7 7-8 7-9 9=10"),
  manganese: mol("MnO₂ zinciri", "Mn 0 0|O 1 -.7|O 1 .7|Mn 2 0|O 3 -.7|O 3 .7|Mn 4 0", "0-1 0-2 1-3 2-3 3-4 3-5 4-6 5-6"),
  hachimoji: mol("şeker–fosfat omurga, sekiz bazdan biri", "C 0 0|C 1 -.4|C 1.6 .6|C .8 1.3|O -.2 .9|N 2 -1.2|C 3.1 -1.4|N 3.6 -2.4|O 4 -.6|O .8 2.4|P 1.9 2.9|O 1.9 4|O 2.7 2.1|O 3 3.4|R 4.1 3.7", "0-1 1-2 2-3 3-4 4-0 1-5 5-6 6=7 6-8 3-9 9-10 10=11 10-12 10-13 13-14"),
  tna: mol("dört karbonlu treoz şekeri–fosfat omurga", "C 0 0|C 1 -.4|C 1.6 .6|O .6 1.2|N 2 -1.2|R 3.1 -1.4|O 2.7 .9|P 3.6 1.6|O 3.6 2.7|O 4.6 1|O -.9 -.5|R -1.9 0", "0-1 1-2 2-3 3-0 1-4 4-5 2-6 6-7 7=8 7-9 0-10 10-11"),
  gna: mol("halkasız glikol–fosfat omurga", "O -1 .5|C 0 0|C 1 .5|C 2 0|N 1 1.6|R 1 2.7|O 3 .5|P 4 0|O 4 -1.1|O 4 1.1|O 5 .5|R 6 0", "0-1 1-2 2-3 2-4 4-5 3-6 6-7 7=8 7-9 7-10 10-11"),
  amyloid: mol("üst üste dizili iki peptit zinciri (hidrojen bağlı)", "N 0 0|C 1 .5|C 2 0|O 2 -1.1|N 3 .5|C 4 0|C 5 .5|O 5 1.6|N 0 2.6|C 1 3.1|C 2 2.6|O 2 1.6|N 3 3.1|C 4 2.6|C 5 3.1|O 5 4.2", "0-1 1-2 2=3 2-4 4-5 5-6 6=7 8-9 9-10 10=11 10-12 12-13 13-14 14=15 4.11 7.12"),
  phosphodiester: mol("şeker–fosfat omurga, bir baz", "C 0 0|C 1 -.4|C 1.6 .6|C .8 1.3|O -.2 .9|N 2 -1.2|R 3.1 -1.4|O .8 2.4|P 1.9 2.9|O 1.9 4|O 2.7 2.1|O 3 3.4|R 4.1 3.7", "0-1 1-2 2-3 3-4 4-0 1-5 5-6 3-7 7-8 8=9 8-10 8-11 11-12"),
  pna: mol("N-(2-aminoetil)glisin omurga, bir baz", "N 0 .5|C 1 0|C 2 .5|N 3 0|C 4 .5|C 5 0|O 5 -1.1|N 6 .5|C 3 -1.1|O 2 -1.6|C 4 -1.7|R 4 -2.8", "0-1 1-2 2-3 3-4 4-5 5=6 5-7 3-8 8=9 8-10 10-11"),
  clay: mol("alüminosilikat tabaka", "Si 0 0|O 1 .5|Al 2 0|O 3 .5|Si 4 0|O 0 -1.1|O 2 -1.1|O 4 -1.1|O 0 1.2|O 2 1.2|O 4 1.2", "0-1 1-2 2-3 3-4 0-5 2-6 4-7 0-8 2-9 4-10"),
  polysilane: SILOXANE,
  polyphosphate: mol("R–O–PO₂–O–PO₂–O–PO₃ (trifosfat)", "R -2 0|O -1 0|P 0 0|O 0 -1.1|O 0 1.1|O 1 0|P 2 0|O 2 -1.1|O 2 1.1|O 3 0|P 4 0|O 4 -1.1|O 4 1.1|O 5 0", "0-1 1-2 2=3 2-4 2-5 5-6 6=7 6-8 6-9 9-10 10=11 10-12 10-13"),
  thioester: mol("R–C(=O)–S–R′", "C 0 .5|C 1 0|O 1 -1.1|S 2 .5|C 3 0|R 4 .5", "0-1 1=2 1-3 3-4 4-5"),
  sodium: mol("Na⁺ iyonu", "Na 0 0", ""),
  proton: mol("H⁺ iyonu", "H 0 0", ""),
  redox: FES,
  fes: mol("Fe₄S₄ küpü", "Fe 0 0|S 1.3 0|Fe 1.3 1.3|S 0 1.3|S .6 -.6|Fe 1.9 -.6|S 1.9 .7|Fe .6 .7", "0-1 1-2 2-3 3-0 4-5 5-6 6-7 7-4 0-4 1-5 2-6 3-7"),
  nickel: metalCenter("Ni"),
  copper: metalCenter("Cu"),
  zinc: metalCenter("Zn"),
  molybdenum: metalCenter("Mo"),
  magnesium: metalCenter("Mg"),
  organo: mol("prolin (halkalı amino asit)", "N 0 0|C 1 -.4|C 1.6 .6|C .8 1.3|C -.2 .9|C 1.6 -1.5|O 2.7 -1.6|O 1 -2.5", "0-1 1-2 2-3 3-4 4-0 1-5 5=6 5-7"),
  mgporphyrin: porphyrin("Mg"),
  znporphyrin: porphyrin("Zn"),
  retinal: mol("almaşık çift bağlı polien zincir", "C 0 .5|C 1 0|C 2 .5|C 3 0|C 4 .5|C 5 0|C 6 .5|O 7 0", "0=1 1-2 2=3 3-4 4=5 5-6 6=7"),
  feoxide: lattice("Fe₂O₃ örgüsü", "Fe", "O"),
  tio2: lattice("TiO₂ örgüsü", "Ti", "O"),
  sulfurdot: mol("S₈ halkası", "S 1 0|S 2 .4|S 2.4 1.4|S 2 2.4|S 1 2.8|S 0 2.4|S -.4 1.4|S 0 .4", "0-1 1-2 2-3 3-4 4-5 5-6 6-7 7-0"),
  thermal: FES,
};

const CHITIN: Mol = { ...mol("x", "C 0 0|C 1 -.5|C 2 0|C 2 1.1|C 1 1.6|O 0 1.1|N 3 -.5|C 4 0|O 4 1.1|C 5 -.5|O 3 1.6|R 4 2.1", "0-1 1-2 2-3 3-4 4-5 5-0 2-6 6-7 7=8 7-9 3-10 10-11"), formula: "(C₈H₁₃NO₅)ₙ (N-asetilglukozamin zinciri)" };
const DISULFIDE = mol("–CH₂–S–S–CH₂– köprülü iki peptit", "N 0 0|C 1 .5|C 2 0|O 2 -1.1|C 1 1.6|S 1 2.8|S 2.2 3.4|C 2.2 4.6|C 3.2 5.1|N 1.2 5.2|O 3.2 6.2", "0-1 1-2 2=3 1-4 4-5 5-6 6-7 7-8 7-9 8=10");
const LUCIFERIN = mol("benzotiyazol çekirdekli lüsiferin (yalınlaştırılmış)", "C 0 0|C 1 -.6|C 2 0|C 2 1.2|C 1 1.8|C 0 1.2|N 3 -.5|C 3.8 .6|S 3 1.7|O -1 -.6|C 5 .6|O 5.6 -.4|O 5.6 1.6", "0=1 1-2 2=3 3-4 4=5 5-0 2-6 6=7 7-8 8-3 0-9 7-10 10=11 10-12");
const MELANIN = mol("indol-5,6-kinon birimi (melanin yapı taşı)", "C 0 0|C 1 -.6|C 2 0|C 2 1.2|C 1 1.8|C 0 1.2|C 3 -.5|C 3.8 .6|N 3 1.7|O -1 -.6|O -1 1.8", "0-1 1=2 2-3 3=4 4-5 5-0 2-6 6=7 7-8 8-3 0=9 5=10");
const TRIGLY = mol("gliserol + üç yağ asidi (triaçilgliserol)", "C 0 0|C 1 .5|C 2 0|O 0 -1.1|C -.9 -1.8|O -1.9 -1.4|R -.7 -2.9|O 1 1.6|C 2 2.2|O 3 1.8|R 1.8 3.3|O 2 -1.1|C 3 -1.7|O 4 -1.3|R 2.8 -2.8", "0-1 1-2 0-3 3-4 4=5 4-6 1-7 7-8 8=9 8-10 2-11 11-12 12=13 12-14");
const GLYCEROL = mol("C₃H₈O₃ (gliserol)", "C 0 0|C 1 .5|C 2 0|O 0 -1.1|O 1 1.6|O 2 -1.1", "0-1 1-2 0-3 1-4 2-5");
const MUCIN = mol("sülfatlı şeker birimi", "C 0 0|C 1 -.5|C 2 0|C 2 1.1|C 1 1.6|O 0 1.1|O 3 -.5|S 4 0|O 4 1.1|O 4 -1.1|O 5 -.5|O 1 -1.6", "0-1 1-2 2-3 3-4 4-5 5-0 2-6 6-7 7=8 7=9 7-10 1-11");
const APATITE = mol("Ca₅(PO₄)₃OH (hidroksiapatit)", "Ca 0 0|O 1 .6|P 2 0|O 2 -1.1|O 3 .6|Ca 4 0|O 2 1.3|Ca 2 2.4", "0.1 1-2 2=3 2-4 4.5 2-6 6.7");
const GASES: Record<string, Mol> = {
  "N₂": mol("N₂", "N 0 0|N 1.2 0", "0#1"),
  "CO₂": mol("CO₂", "O 0 0|C 1.2 0|O 2.4 0", "0=1 1=2"),
  "CH₄": mol("CH₄", "C 0 0|H 1 0|H -1 0|H 0 1|H 0 -1", "0-1 0-2 0-3 0-4"),
  "H₂": mol("H₂", "H 0 0|H 1 0", "0-1"),
  "NH₃": mol("NH₃", "N 0 0|H 1 .5|H -1 .5|H 0 -1", "0-1 0-2 0-3"),
  "SO₂": mol("SO₂", "O 0 .6|S 1 0|O 2 .6", "0=1 1=2"),
  "H₂S": mol("H₂S", "H 0 .6|S 1 0|H 2 .6", "0-1 1-2"),
  HCl: mol("HCl", "H 0 0|Cl 1.2 0", "0-1"),
  HF: mol("HF", "H 0 0|F 1.1 0", "0-1"),
  "O₂": mol("O₂", "O 0 0|O 1.2 0", "0=1"),
  Ar: mol("Ar", "N 0 0", ""),
};

interface Part {
  label: string;
  option: Option;
  mol: Mol;
}

interface Material {
  name: string;
  note: string;
  needs: string[];
  mol: Mol;
  ref?: string;
}

/** Organ malzemelerinin dayandığı yayınlar: Dünya'daki karşılığının yapısı ve işlevi için. Malzeme gezegene uyarlanmış bir modeldir. */
export const ORGAN_REFS: Partial<Record<OrganType, string>> = {
  tentacle: "Kier & Smith 1985, Zool. J. Linn. Soc. 83:307",
  fin: "Merzendorfer & Zimoch 2003, J. Exp. Biol. 206:4393 (kitin)",
  leg: "Merzendorfer & Zimoch 2003, J. Exp. Biol. 206:4393 (kitin)",
  wing: "Merzendorfer & Zimoch 2003, J. Exp. Biol. 206:4393 (kitin)",
  filter_comb: "Merzendorfer & Zimoch 2003, J. Exp. Biol. 206:4393 (kitin)",
  brood_pouch: "Merzendorfer & Zimoch 2003, J. Exp. Biol. 206:4393 (kitin)",
  sucker: "Kier & Smith 1985, Zool. J. Linn. Soc. 83:307",
  lateral_line: "Kier & Smith 1985, Zool. J. Linn. Soc. 83:307 (kas-hidrostat); yan çizgi için ayrı kaynak yok",
  heart: "Huxley 1957, Prog. Biophys. Biophys. Chem. 7:255",
  sprint_muscle: "Huxley 1957, Prog. Biophys. Biophys. Chem. 7:255",
  eye: "Wistow & Piatigorsky 1988, Annu. Rev. Biochem. 57:479",
  bioluminescence: "Wilson & Hastings 1998, Annu. Rev. Cell Dev. Biol. 14:197",
  olfactory: "Buck & Axel 1991, Cell 65:175; Sevier & Kaiser 2002, Nat. Rev. Mol. Cell Biol. 3:836",
  electroreceptor: "Bellono, Leitch & Julius 2017, Nature 543:391 (gerçek alıcılar CaV ve BK kanallarını kullanır; Na⁺/K⁺ kanalı bu oyunun sadeleştirmesidir)",
  mouth: "Weiner & Wagner 1998, Annu. Rev. Mater. Sci. 28:271 (apatit); Lowenstam & Weiner 1989, On Biomineralization",
  shell: "Lowenstam & Weiner 1989, On Biomineralization, Oxford Univ. Press; Weiner & Wagner 1998, Annu. Rev. Mater. Sci. 28:271",
  spike: "Lowenstam & Weiner 1989, On Biomineralization, Oxford Univ. Press",
  thicket_cutter: "Sevier & Kaiser 2002, Nat. Rev. Mol. Cell Biol. 3:836 (disülfit köprüleri)",
  claw: "Sevier & Kaiser 2002, Nat. Rev. Mol. Cell Biol. 3:836 (disülfit köprüleri)",
  venom: "Fry ve ark. 2009, Annu. Rev. Genomics Hum. Genet. 10:483",
  immune_gland: "Schroeder & Cavacini 2010, J. Allergy Clin. Immunol. 125:S41",
  camouflage: "d'Ischia ve ark. 2015, Pigment Cell Melanoma Res. 28:520",
  chromatophore: "d'Ischia ve ark. 2015, Pigment Cell Melanoma Res. 28:520",
  ink_sac: "d'Ischia ve ark. 2015, Pigment Cell Melanoma Res. 28:520",
  mucus_coat: "Bansil & Turner 2006, Curr. Opin. Colloid Interface Sci. 11:164",
  gill: "Perutz 1970, Nature 228:726 (hemoglobin); van Holde, Miller & Decker 2001, J. Biol. Chem. 276:15563 (hemosiyanin)",
  lung: "Veldhuizen ve ark. 1998, Biochim. Biophys. Acta 1408:90",
  torpor: "Storey & Storey 1988, Physiol. Rev. 68:27",
  blubber: "Walther & Farese 2012, Annu. Rev. Biochem. 81:687",
  fat_store: "Walther & Farese 2012, Annu. Rev. Biochem. 81:687",
  sulfur_vent_organ: "Cavanaugh ve ark. 1981, Science 213:340",
};

/**
 * Her organın kendi yapı malzemesi. Malzeme gezegenin elementleriyle kurulamıyorsa
 * (ya da iskelet silisyumsa ve malzeme karbon kimyası gerektiriyorsa) organ, o
 * gezegenin genel lifinden yapılır; bu durum açıklamada belirtilir.
 */
function organMaterial(type: OrganType, chem: Chemistry): Material {
  const has = (...syms: string[]): boolean => syms.every((sym) => sym === "H" || chem.has.has(sym));
  const silicon = chem.scaffold.id === "silicon";
  const fibre: Material = silicon
    ? { name: "Siloksan lif demeti", note: "Uzun Si–O zincirleri demetlenir; yan grupların dönmesi lifi kısaltıp uzatır.", needs: [], mol: SILOXANE }
    : { name: "Peptit lif demeti", note: "Uzun peptit zincirleri demetlenip birbiri üzerinde kayarak kasılır.", needs: [], mol: PEPTIDE };
  const from = (o: Option, note: string): Material => ({ name: o.name, note: `${note} ${o.note}`, needs: [], mol: MOLECULES[o.id] ?? PEPTIDE, ref: o.ref });
  const mineral: Material = has("Ca", "P", "O")
    ? { name: "Hidroksiapatit", note: "Kalsiyum fosfat kristalleri; sert ve aşınmaya dayanıklıdır.", needs: [], mol: APATITE }
    : has("Ca", "C", "O")
      ? { name: "Kalsit", note: "Kalsiyum karbonat kristalleri katman katman çöker.", needs: [], mol: MOLECULES.calcite }
      : has("Si", "O")
        ? { name: "Biyojenik silika", note: "Camsı SiO₂ çökeltisi; hafif ve serttir.", needs: [], mol: MOLECULES.silica }
        : has("Fe", "S")
          ? { name: "Demir sülfür", note: "Greigit ve pirit taneleri dokuya gömülür.", needs: [], mol: MOLECULES.ironsulfide }
          : { ...fibre, note: `Bu gezegende mineral kabuk kuracak element yok; sertlik sık örülmüş liflerden gelir. ${fibre.note}` };
  const chitin: Material = { name: "Kitin benzeri polisakkarit", note: "Azotlu şeker zincirleri lif lif örülür; hafif ve sağlamdır.", needs: ["C", "N", "O"], mol: CHITIN };
  const disulfide = (name: string, note: string): Material => ({ name, note, needs: ["C", "N", "O", "S"], mol: DISULFIDE });
  const melanin = (note: string): Material => ({ name: "Melanin benzeri koyu boya", note, needs: ["C", "N", "O"], mol: MELANIN });
  const fat = (note: string): Material => ({ name: "Depo yağı (triaçilgliserol)", note, needs: ["C", "O"], mol: TRIGLY });
  const gas = chem.atmosphere[0].gas;
  const oxygenCarrier: Material = has("Fe", "N", "C")
    ? { name: "Demir porfirinli taşıyıcı (hem benzeri)", note: "Halkanın ortasındaki demir, solunum gazını geri bırakılabilir biçimde bağlar.", needs: [], mol: porphyrin("Fe") }
    : has("Cu")
      ? { name: "Bakırlı taşıyıcı (hemosiyanin benzeri)", note: "İki bakır atomu arasına gaz molekülü bağlanır.", needs: [], mol: metalCenter("Cu") }
      : from(chem.catalyst, "Solunum gazını bu gezegenin katalizör metali taşır.");
  const table: Record<OrganType, Material> = {
    tentacle: { ...fibre, note: `Sıvı dolu bir çekirdeği saran çapraz lifler: kemiksiz, her yöne bükülebilen bir kol. ${fibre.note}` },
    fin: { ...chitin, note: `Yüzgeç ışınları ince, esnek çubuklardır. ${chitin.note}` },
    leg: { ...chitin, note: `Bacak, eklemli içi boş bir borudur; kaslar içeriden tutunur. ${chitin.note}` },
    wing: { ...chitin, note: `Kanat, damarlarla gerilmiş çok ince bir zardır. ${chitin.note}` },
    sucker: { ...fibre, note: `Halka biçimli lifler kasılınca içeride basınç düşer ve vantuz yüzeye yapışır. ${fibre.note}` },
    sprint_muscle: from(chem.energy, "Hızlı kas lifleri kısa sürede çok enerji yakar; lifin içi enerji taşıyıcısıyla doludur."),
    thicket_cutter: disulfide("Keratin benzeri kesici kenar", "Ağzın önündeki sert, keskin kenarlı levhalar sık örtünün saplarını biçer; kükürt köprüleri kenarı körelmeye karşı sert tutar."),
    eyespot: from(chem.pigment, "Tek bir pigment yığını ışığın yönünü algılar."),
    eye: { name: "Saydam kristalin mercek", note: `Çok sıkı ve düzenli istiflenmiş ${silicon ? "siloksan" : "protein"} molekülleri ışığı saçmadan kırar; arkasındaki pigment tabakası görüntüyü algılar.`, needs: [], mol: silicon ? SILOXANE : PEPTIDE },
    bioluminescence: { name: "Lüsiferin benzeri ışık molekülü", note: "Bir enzim bu molekülü yükseltger; açığa çıkan enerji ısı yerine ışık olarak yayılır.", needs: ["C", "N", "O", "S"], mol: LUCIFERIN },
    olfactory: disulfide("Koku alıcı proteini", "Zara gömülü alıcının cebine uyan molekül bağlanınca alıcı biçim değiştirir ve sinyal başlar; kükürt köprüleri cebin biçimini sabit tutar."),
    lateral_line: { ...fibre, note: `Jöle bir kubbeye gömülü ince tüyler akıntıyla eğilir ve basınç dalgalarını algılar. ${fibre.note}` },
    electroreceptor: has("Na") ? { name: "Sodyum iyon kanalı", note: "Çevredeki zayıf elektrik alanı, alıcı hücrenin zarındaki kanalları açıp Na⁺ akışını değiştirir.", needs: [], mol: MOLECULES.sodium } : has("K") ? { name: "Potasyum iyon kanalı", note: "Çevredeki zayıf elektrik alanı, alıcı hücrenin zarındaki kanalları açıp K⁺ akışını değiştirir.", needs: [], mol: mol("K⁺ iyonu", "K 0 0", "") } : from(chem.energy, "İyon kanalı kuracak sodyum ya da potasyum yok; alıcı, enerji gradyanındaki değişimi algılar."),
    mouth: { ...mineral, note: `Ağız kenarındaki sert kazıyıcı plakalar besini parçalar. ${mineral.note}` },
    stomach: has("Cl") ? { name: "Hidroklorik asit ve sindirim enzimi", note: "Mide çeperi asit salgılar; asit besini açar, enzimler bağlarını koparır.", needs: [], mol: GASES.HCl } : from(chem.catalyst, "Klor olmadığı için güçlü asit yapılamaz; sindirimi metalli enzimler yürütür."),
    symbiotic_gut_flora: from(chem.membrane, "Bağırsakta yaşayan ortak mikroplar konağın sindiremediği besini parçalar; her biri kendi zarıyla çevrili ayrı bir hücredir."),
    sulfur_vent_organ: has("Fe", "S") ? from({ ...chem.catalyst, id: "fes", name: "Demir–kükürt kümeli enzim" } as Option, "Organdaki ortak bakteriler kükürt bileşiklerini yükseltgeyip enerji üretir.") : { name: "Kükürt halkası deposu", note: "Organdaki ortak bakteriler kükürt bileşiklerini yükseltgeyip enerji üretir; ara ürün olan kükürt tanecik olarak depolanır.", needs: ["S"], mol: MOLECULES.sulfurdot },
    filter_comb: { ...chitin, note: `Sık dişli tarak, sıvıdaki küçük parçacıkları süzer. ${chitin.note}` },
    pigment: from(chem.pigment, "Işık toplayan boya molekülleri zar katmanlarına dizilir."),
    shell: { ...mineral, note: `Kabuk, organik bir iskele üzerinde katman katman büyür. ${mineral.note}` },
    spike: { ...mineral, note: `Diken, kabukla aynı malzemenin sivrilmiş uzantısıdır. ${mineral.note}` },
    camouflage: melanin("Deri hücrelerindeki boya tanecikleri zemin rengine göre yoğunlaşır."),
    chromatophore: melanin("Boya dolu kesecikler çevresindeki kaslarla genişleyip daralır; renk saniyeler içinde değişir."),
    venom: disulfide("Kükürt köprülü toksin peptidi", "Küçük, sıkı katlanmış bir peptit avın sinir ya da kas kanallarını tıkar; kükürt köprüleri onu parçalanmaya karşı korur."),
    claw: disulfide("Keratin benzeri sert protein", "Zincirler arasındaki çok sayıda kükürt köprüsü proteini sert ve suda çözünmez yapar."),
    regeneration: from(chem.genetic, "Yaranın çevresindeki hücreler farklılaşmamış hâle döner ve eksik parçayı kalıtım bilgisinden yeniden kurar."),
    ink_sac: melanin("Kese, yoğun boya taneciklerini mukusla karıştırıp püskürtür."),
    mucus_coat: { name: "Sülfatlı şeker zincirli mukus", note: "Yoğun yüklü şeker zincirleri çok su tutar ve kaygan bir jel oluşturur.", needs: ["C", "O", "S"], mol: MUCIN },
    gill: { ...oxygenCarrier, note: `İnce katlı yüzey, çözünmüş gazı kana geçirir. ${oxygenCarrier.note}` },
    lung: from(chem.membrane, "İç yüzeyi ince bir zar filmi kaplar; bu film yüzey gerilimini düşürür ve keseciklerin kapanmasını önler."),
    heart: { ...fibre, note: `Kendiliğinden ritimle kasılan kas, dolaşım sıvısını pompalar. ${fibre.note}` },
    torpor: { name: "Gliserol (donma önleyici)", note: "Hücre içi sıvının donma noktasını düşürür ve soğukta proteinleri korur; metabolizma yavaşlarken hücreler zarar görmez.", needs: ["C", "O"], mol: GLYCEROL },
    blubber: fat("Deri altındaki kalın yağ tabakası ısı kaybını azaltır."),
    nitrogen_sac: { name: "Azot gazı kesesi", note: "Kese, dokuda çözünmüş azotu gaz olarak toplar.", needs: ["N"], mol: GASES["N₂"] },
    fat_store: fat("Enerji, hacim başına en yoğun biçimde yağ damlacıklarında saklanır."),
    swim_bladder: { name: `Gaz kesesi (${gas})`, note: `Kese, atmosferde en bol bulunan gazla (${gas}) dolup boşalarak canlının yoğunluğunu ayarlar.`, needs: [], mol: GASES[gas] ?? GASES["N₂"] },
    brood_pouch: { ...chitin, note: `Kese, yavruları dış ortamdan ayıran esnek bir örtüdür. ${chitin.note}` },
    immune_gland: disulfide("Antikor benzeri tanıma proteini", "Kükürt köprüleriyle bağlı zincirlerin ucundaki değişken bölge yabancı molekülü tanıyıp işaretler."),
  };
  const m = { ...table[type], ref: table[type].ref ?? ORGAN_REFS[type] };
  const carbonOnly = m.mol !== SILOXANE && m.needs.includes("C");
  if (m.needs.every((sym) => has(sym)) && !(silicon && carbonOnly)) return m;
  const why = silicon && carbonOnly ? "iskelet silisyum olduğu" : `${m.needs.filter((sym) => !has(sym)).join(", ")} bulunmadığı`;
  return { ...fibre, note: `Başka gezegenlerde bu organ ${m.name.toLocaleLowerCase("tr")} ile kurulur; bu gezegende ${why} için aynı işi lifler görür. ${fibre.note}` };
}

function partsOf(chem: Chemistry, g: Genome | null): Part[] {
  const wallMol = chem.wall.id === "none" ? MOLECULES[chem.membrane.id] : MOLECULES[chem.wall.id];
  const parts: Part[] = [
    { label: "Zar", option: chem.membrane, mol: MOLECULES[chem.membrane.id] },
    { label: "Hücre duvarı", option: chem.wall, mol: wallMol },
    { label: "Kalıtım polimeri", option: chem.genetic, mol: MOLECULES[chem.genetic.id] ?? MOLECULES[chem.membrane.id] },
    { label: "Enerji taşıyıcısı", option: chem.energy, mol: MOLECULES[chem.energy.id] },
    { label: "Katalizör", option: chem.catalyst, mol: MOLECULES[chem.catalyst.id] ?? metalCenter("Mn") },
    { label: "Işık pigmenti", option: chem.pigment, mol: MOLECULES[chem.pigment.id] },
  ];
  if (g) {
    const seen = new Set<OrganType>();
    for (const organ of g.organs) {
      if (seen.has(organ.type)) continue;
      seen.add(organ.type);
      const info = ORGANS[organ.type];
      const material = organMaterial(organ.type, chem);
      parts.push({ label: info.label, option: { id: organ.type, name: material.name, needs: [], note: `${material.note} Simülasyondaki etkisi: ${info.description}`, ref: material.ref ?? "" }, mol: material.mol });
    }
  }
  return parts;
}

const LEVELS = ["Canlı", "Kabuk kesiti", "Molekül", "Atom"] as const;
const MAGNIFY = ["×1", "×100 000", "×10 000 000", "×1 000 000 000"];

function elementColor(sym: string): string {
  return ELEMENTS[sym]?.color ?? "#59607a";
}

function inkOn(color: string): string {
  const n = parseInt(color.slice(1), 16);
  const lum = ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
  return lum > 150 ? "#0a0e1c" : "#f3f5fc";
}

const esc2 = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function fitCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; w: number; h: number } | null {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w === 0 || h === 0) return null;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

function drawMolecule(ctx: CanvasRenderingContext2D, m: Mol, cx: number, cy: number, w: number, h: number, t: number, picked: number): { x: number; y: number; r: number }[] {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const a of m.atoms) {
    x0 = Math.min(x0, a.x);
    x1 = Math.max(x1, a.x);
    y0 = Math.min(y0, a.y);
    y1 = Math.max(y1, a.y);
  }
  const unit = Math.min(64, (w - 70) / Math.max(1.5, x1 - x0), (h - 70) / Math.max(1.5, y1 - y0));
  const r = Math.max(9, Math.min(19, unit * 0.34));
  const pos = m.atoms.map((a, i) => ({
    x: cx + (a.x - (x0 + x1) / 2) * unit + Math.sin(t * 1.6 + i * 1.9) * 1.6,
    y: cy + (a.y - (y0 + y1) / 2) * unit + Math.cos(t * 1.3 + i * 2.3) * 1.6,
    r: a.sym === "R" ? r * 0.8 : r,
  }));
  ctx.lineCap = "round";
  for (const b of m.bonds) {
    const p = pos[b.a];
    const q = pos[b.b];
    const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    const nx = (-(q.y - p.y) / len) * 4;
    const ny = ((q.x - p.x) / len) * 4;
    ctx.strokeStyle = "rgba(200, 208, 235, 0.75)";
    ctx.lineWidth = 2.4;
    ctx.setLineDash(b.order === 0 ? [3, 5] : []);
    const offsets = b.order === 2 ? [-0.6, 0.6] : b.order === 3 ? [-1.1, 0, 1.1] : [0];
    for (const o of offsets) {
      ctx.beginPath();
      ctx.moveTo(p.x + nx * o, p.y + ny * o);
      ctx.lineTo(q.x + nx * o, q.y + ny * o);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  m.atoms.forEach((a, i) => {
    const p = pos[i];
    const color = elementColor(a.sym);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(4, 6, 14, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (i === picked) {
      ctx.strokeStyle = "#6df0d2";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = inkOn(color);
    ctx.font = `600 ${Math.round(p.r * 0.95)}px Onest, system-ui, sans-serif`;
    ctx.fillText(a.sym, p.x, p.y + 0.5);
  });
  return pos;
}

/** Tipik bağ sayısı (değerlik): bağları sayılan atomun eksik kalan kısmı hidrojenle tamamlanır. */
const VALENCE: Record<string, number> = { C: 4, N: 3, O: 2, S: 2, Si: 4, B: 3 };

/** Bir atomun bağlı olduğu atomlar: çizimdeki komşular ile çizilmeyen (örtük) hidrojenler. */
function neighboursOf(m: Mol, i: number): { syms: string[]; idx: number[]; hydrogens: number; chain: boolean } {
  const syms: string[] = [];
  const idx: number[] = [];
  let used = 0;
  let chain = false;
  for (const b of m.bonds) {
    if (b.a !== i && b.b !== i) continue;
    const oi = b.a === i ? b.b : b.a;
    const other = m.atoms[oi];
    if (b.order === 0) {
      syms.push(other.sym);
      idx.push(oi);
      continue;
    }
    used += b.order;
    if (other.sym === "R") chain = true;
    else {
      syms.push(other.sym);
      idx.push(oi);
    }
  }
  const v = VALENCE[m.atoms[i].sym];
  return { syms, idx, hydrogens: v === undefined ? 0 : Math.max(0, v - used), chain };
}

/** Molekülün bütün atomları (çizilmeyen hidrojenler dâhil), sembole göre sayılmış. */
function compositionOf(m: Mol): [string, number][] {
  const count = new Map<string, number>();
  m.atoms.forEach((a, i) => {
    if (a.sym === "R") return;
    count.set(a.sym, (count.get(a.sym) ?? 0) + 1);
    const h = neighboursOf(m, i).hydrogens;
    if (h > 0) count.set("H", (count.get("H") ?? 0) + h);
  });
  return [...count.entries()].sort((a, b) => b[1] - a[1]);
}

/** Seçili atomun çevresine bağlı olduğu atomları küçük kürelerle çizer. */
type NeighbourHit = { x: number; y: number; r: number; sym: string; idx: number };

function drawNeighbours(ctx: CanvasRenderingContext2D, m: Mol, i: number, w: number, h: number, fromH: boolean): NeighbourHit[] {
  const n = neighboursOf(m, i);
  // Hidrojen seçiliyken tek komşusu bağlı olduğu atomdur.
  const items: { sym: string; idx: number }[] = fromH
    ? [{ sym: m.atoms[i].sym, idx: i }]
    : [...n.syms.map((sym, k) => ({ sym, idx: n.idx[k] })), ...Array.from({ length: n.hydrogens }, () => ({ sym: "H", idx: -1 }))];
  if (n.chain && !fromH) items.push({ sym: "R", idx: -2 });
  const hits: NeighbourHit[] = [];
  if (items.length === 0) return hits;
  const r = Math.min(20, (w - 40) / (items.length * 2.6));
  const gap = r * 2.6;
  const x0 = w / 2 - ((items.length - 1) * gap) / 2;
  const y = h - r - 14;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  items.forEach(({ sym, idx }, k) => {
    const x = x0 + k * gap;
    if (idx !== -2) hits.push({ x, y, r, sym, idx });
    const color = elementColor(sym);
    ctx.strokeStyle = "rgba(200, 208, 235, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(w / 2, h / 2 + Math.min(w, h) * 0.34);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = inkOn(color);
    ctx.font = `600 ${Math.round(r * 0.95)}px Onest, system-ui, sans-serif`;
    ctx.fillText(sym, x, y + 0.5);
  });
  return hits;
}

function drawAtom(ctx: CanvasRenderingContext2D, sym: string, cx: number, cy: number, size: number, t: number): void {
  const e = ELEMENTS[sym];
  if (!e) return;
  const shells = e.shells;
  const step = (size / 2 - 22) / (shells.length + 0.6);
  const color = e.color;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, step * 0.9);
  glow.addColorStop(0, "#ffffff");
  glow.addColorStop(0.4, color);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, step * 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = inkOn(color);
  ctx.font = `700 ${Math.round(step * 0.34)}px Onest, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${e.z} p⁺`, cx, cy);
  shells.forEach((count, s) => {
    const r = step * (s + 1.4);
    ctx.strokeStyle = "rgba(200, 208, 235, 0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    const speed = (0.9 / (s + 1)) * (s % 2 === 0 ? 1 : -1);
    ctx.fillStyle = s === shells.length - 1 ? "#6df0d2" : "#b7bed6";
    for (let i = 0; i < count; i++) {
      const a = t * speed + (i / count) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Dört baz rengi (kalıtım polimerlerinde) ve sekiz harfli polimer için dört ek renk. */
const BASES = ["#6df0d2", "#f59a3c", "#ff7ad9", "#8a7dff", "#f2d94e", "#5fb4ff", "#ff6b6b", "#b6e86b"];

/** Sabit, deterministik sahte rastgele sayı (0–1): kesit çizimlerinde yer ve boyut çeşitliliği için. */
function hash01(i: number, salt = 0): number {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.moveTo(x + r, y);
  for (let k = 1; k < 6; k++) ctx.lineTo(x + Math.cos((k * Math.PI) / 3) * r, y + Math.sin((k * Math.PI) / 3) * r);
  ctx.closePath();
}

/** Duvarın kesiti: her duvar türü kendi örgüsüyle çizilir (üstte dış ortam, altta zar). */
function drawWallLayer(ctx: CanvasRenderingContext2D, id: string, top: number, wallH: number, w: number, t: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, w, wallH);
  ctx.clip();
  const bot = top + wallH;
  switch (id) {
    case "silica": {
      // Camsı kabuk: yarı saydam levhalar, düzenli gözenek dizisi ve kaburga çizgileri.
      ctx.fillStyle = "rgba(190, 224, 244, 0.55)";
      ctx.fillRect(0, top + 2, w, wallH - 4);
      ctx.strokeStyle = "rgba(235, 248, 255, 0.9)";
      ctx.lineWidth = 1.4;
      for (let x = 0; x < w; x += 46) {
        ctx.beginPath();
        ctx.moveTo(x, top + 2);
        ctx.lineTo(x, bot - 2);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(20, 40, 60, 0.7)";
      for (let x = 12; x < w; x += 15)
        for (let r = 0; r < 2; r++) {
          ctx.beginPath();
          ctx.arc(x + (r ? 7 : 0), top + wallH * (0.32 + r * 0.36), 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      break;
    }
    case "calcite": {
      // Kalsit pullar: çatı kiremiti gibi üst üste binen beyaz levhalar.
      for (let row = 0; row < 3; row++)
        for (let x = -30 + (row % 2) * 19; x < w + 30; x += 38) {
          const y = top + 4 + row * (wallH / 3);
          ctx.fillStyle = row % 2 ? "#e9e4cf" : "#f4f1e4";
          ctx.strokeStyle = "rgba(120, 110, 80, 0.6)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(x, y + wallH / 3, 22, wallH / 2.6, 0, Math.PI, 0);
          ctx.fill();
          ctx.stroke();
        }
      break;
    }
    case "ironsulfide": {
      // Demir-sülfür zırh: düzensiz boyda koyu altın küpler, üstlerinde parıltı.
      for (let i = 0; i < w / 14; i++) {
        const s = 8 + hash01(i, 1) * 14;
        const x = i * 14 + hash01(i, 2) * 6;
        const y = top + hash01(i, 3) * (wallH - s);
        ctx.fillStyle = `hsl(${42 + hash01(i, 4) * 12} ${55 + hash01(i, 5) * 20}% ${32 + hash01(i, 6) * 18}%)`;
        ctx.fillRect(x, y, s, s);
        ctx.fillStyle = "rgba(255, 240, 170, 0.55)";
        ctx.fillRect(x + 1, y + 1, s * 0.35, 2);
      }
      break;
    }
    case "cellulose": {
      // Selüloz: iki kat çapraz lif demeti; demetler arası hidrojen bağı noktaları.
      for (let layer = 0; layer < 2; layer++) {
        ctx.strokeStyle = layer ? "rgba(160, 214, 140, 0.85)" : "rgba(196, 232, 170, 0.9)";
        ctx.lineWidth = 3.2;
        for (let k = -wallH; k < w + wallH; k += 11) {
          ctx.beginPath();
          ctx.moveTo(k, layer ? bot - 3 : top + 3);
          ctx.lineTo(k + (layer ? 1 : -1) * wallH * 0.55, layer ? top + 3 : bot - 3);
          ctx.stroke();
        }
      }
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      for (let x = 6; x < w; x += 22) ctx.fillRect(x, top + wallH / 2 - 1, 2, 2);
      break;
    }
    case "borate": {
      // Borat köprüsü: şeker zincirleri kare bor düğümleriyle birbirine kilitlenir.
      ctx.strokeStyle = "rgba(231, 182, 164, 0.9)";
      ctx.lineWidth = 2.2;
      for (const f of [0.22, 0.78]) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) ctx.lineTo(x, top + wallH * f + Math.sin(x * 0.06 + t * 0.7) * 2);
        ctx.stroke();
      }
      for (let x = 14; x < w; x += 30) {
        ctx.strokeStyle = "rgba(231, 182, 164, 0.7)";
        ctx.beginPath();
        ctx.moveTo(x, top + wallH * 0.22);
        ctx.lineTo(x, top + wallH * 0.78);
        ctx.stroke();
        ctx.fillStyle = "#f2b8a8";
        ctx.fillRect(x - 4, top + wallH / 2 - 4, 8, 8);
      }
      break;
    }
    case "slayer": {
      // S-katman: tek tip proteinin altıgen kafesi.
      ctx.strokeStyle = "rgba(154, 208, 192, 0.95)";
      ctx.fillStyle = "rgba(154, 208, 192, 0.2)";
      ctx.lineWidth = 1.3;
      const hr = wallH / 3.1;
      ctx.beginPath();
      for (let r = 0; r * hr * 1.5 < wallH + hr; r++)
        for (let x = (r % 2) * hr * 0.87; x < w + hr; x += hr * 1.74) hexPath(ctx, x, top + hr * 0.9 + r * hr * 1.5, hr * 0.95);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "manganese": {
      // Manganez oksit kın: koyu mor-kahve kabuk, taneli doku ve çatlaklar.
      ctx.fillStyle = "#4a3b50";
      ctx.fillRect(0, top + 2, w, wallH - 4);
      for (let i = 0; i < w / 5; i++) {
        ctx.fillStyle = `rgba(${90 + hash01(i, 1) * 50}, ${70 + hash01(i, 2) * 30}, ${100 + hash01(i, 3) * 40}, 0.85)`;
        ctx.beginPath();
        ctx.arc(i * 5 + 2, top + 4 + hash01(i, 4) * (wallH - 8), 1.5 + hash01(i, 5) * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(20, 12, 24, 0.8)";
      ctx.lineWidth = 1;
      for (let x = 20; x < w; x += 70) {
        ctx.beginPath();
        ctx.moveTo(x, top + 2);
        ctx.lineTo(x + 6, top + wallH / 2);
        ctx.lineTo(x - 3, bot - 2);
        ctx.stroke();
      }
      break;
    }
    default: {
      // Peptidoglikan: uzun şeker zincirleri ve aralarındaki peptit köprüleri; köprü uçlarında düğüm.
      ctx.strokeStyle = "rgba(232, 226, 200, 0.9)";
      ctx.lineWidth = 2;
      for (let row = 0; row < 3; row++) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) ctx.lineTo(x, top + 5 + (row * (wallH - 10)) / 2 + Math.sin(x * 0.05 + row * 2 + t * 0.8) * 2);
        ctx.stroke();
      }
      ctx.lineWidth = 1.2;
      ctx.fillStyle = "#e8e2c8";
      for (let x = 8; x < w; x += 20)
        for (let row = 0; row < 2; row++) {
          const y0 = top + 5 + (row * (wallH - 10)) / 2;
          const y1 = top + 5 + ((row + 1) * (wallH - 10)) / 2;
          ctx.beginPath();
          ctx.moveTo(x, y0);
          ctx.lineTo(x + 4, y1);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x + 2, (y0 + y1) / 2, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
    }
  }
  ctx.restore();
}

/** Zarın kesiti: her zar türü kendi yapısıyla (çift katman, tek katman, sarmal, tabaka, mineral) çizilir. */
function drawMembraneLayer(ctx: CanvasRenderingContext2D, id: string, memTop: number, memH: number, w: number, t: number): void {
  const cy = memTop + memH / 2;
  const headR = 5.2;
  ctx.lineCap = "round";
  ctx.lineWidth = 2;
  if (id === "pore") {
    // Mineral gözenek bölmesi: çökeltiden duvarlar ve içlerinde gözenekler.
    for (let x = 6, i = 0; x < w; x += 15, i++) {
      ctx.fillStyle = i % 4 === 3 ? "#5b5142" : "#8d7f6a";
      ctx.fillRect(x - 7.5, memTop, 16, memH);
    }
    ctx.fillStyle = "rgba(10, 8, 6, 0.85)";
    for (let x = 36; x < w; x += 60) {
      ctx.beginPath();
      ctx.ellipse(x, cy, 7, memH * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (id === "pah") {
    // Halkalı karbon tabakası: yan yana duran, üst üste dizili düz altıgen halkalar (sikke yığınları).
    for (let x = 14; x < w; x += 30)
      for (let k = 0; k < 4; k++) {
        const y = memTop + 6 + k * ((memH - 12) / 3);
        const wob = Math.sin(t * 1.2 + x * 0.1 + k) * 1.5;
        ctx.fillStyle = k % 2 ? "rgba(138, 147, 163, 0.85)" : "rgba(168, 176, 190, 0.85)";
        ctx.strokeStyle = "#3a4050";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(x + wob, y, 12, 4.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#1c202c";
        ctx.beginPath();
        ctx.ellipse(x + wob, y, 4.2, 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    return;
  }
  for (let x = 6, i = 0; x < w; x += id === "fattyacid" ? 11 + hash01(i, 7) * 8 : 15, i++) {
    const sway = Math.sin(t * 2 + i * 0.7) * 1.6;
    const yTop = memTop + headR;
    const yBot = memTop + memH - headR;
    if (id === "siloxane") {
      ctx.strokeStyle = elementColor("Si");
      ctx.beginPath();
      for (let y = memTop; y <= memTop + memH; y += 4) ctx.lineTo(x + Math.sin(y * 0.3 + i + t * 1.5) * 3.5, y);
      ctx.stroke();
      ctx.fillStyle = elementColor("O");
      for (const y of [memTop, memTop + memH]) {
        ctx.beginPath();
        ctx.arc(x, y, 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }
    if (id === "azotosome") {
      // Ters zar: azotlu uçlar ortada kenetlenir, karbon uçlar dışa bakar.
      ctx.strokeStyle = "rgba(183, 190, 214, 0.8)";
      ctx.beginPath();
      ctx.moveTo(x + sway, memTop + 2);
      ctx.lineTo(x, cy - 5);
      ctx.moveTo(x - sway, memTop + memH - 2);
      ctx.lineTo(x + 7.5, cy + 5);
      ctx.stroke();
      ctx.fillStyle = elementColor("N");
      ctx.beginPath();
      ctx.arc(x, cy - 5, 3.6, 0, Math.PI * 2);
      ctx.arc(x + 7.5, cy + 5, 3.6, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    if (id === "peptide") {
      // Amfifilik peptit: zarı boydan boya geçen mavi sarmal; iki ucunda polar boncuk.
      ctx.strokeStyle = "rgba(111, 141, 250, 0.95)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let y = yTop; y <= yBot; y += 2) ctx.lineTo(x + Math.sin((y - yTop) * 0.55 + i + t) * 3.4, y);
      ctx.stroke();
      ctx.fillStyle = elementColor("N");
      for (const y of [yTop, yBot]) {
        ctx.beginPath();
        ctx.arc(x, y, 4.2, 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }
    if (id === "etherlipid") {
      // Eter lipit tek katman: zarı boydan boya geçen dallı zincir; her iki ucunda baş, gövdede metil dalları.
      ctx.strokeStyle = "rgba(226, 192, 138, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + sway, yTop);
      ctx.lineTo(x - sway, yBot);
      for (let b = 1; b <= 3; b++) {
        const y = yTop + ((yBot - yTop) * b) / 4;
        ctx.moveTo(x + sway * (1 - b / 2), y);
        ctx.lineTo(x + (b % 2 ? 5 : -5), y - 3);
      }
      ctx.stroke();
      ctx.fillStyle = elementColor("O");
      for (const y of [yTop, yBot]) {
        ctx.beginPath();
        ctx.arc(x, y, headR + 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }
    // Fosfolipit (çift kuyruklu, kıvrık, fosfor başlı çift katman) ve yağ asidi (tek kuyruklu, seyrek, kırmızı küçük baş).
    const phos = id === "phospholipid";
    ctx.strokeStyle = phos ? "rgba(226, 192, 138, 0.9)" : "rgba(238, 170, 150, 0.85)";
    ctx.beginPath();
    for (const side of [-1, 1]) {
      const y0 = side < 0 ? yTop : yBot;
      const y1 = cy + side * 2;
      for (const dx of phos ? [-2.6, 2.6] : [0]) {
        ctx.moveTo(x + dx, y0);
        const kink = phos && dx > 0 ? 1.8 : 0;
        ctx.lineTo(x + dx + sway * side * -1 + kink, (y0 + y1) / 2);
        ctx.lineTo(x + dx - sway * side * -1, y1);
      }
    }
    ctx.stroke();
    ctx.fillStyle = phos ? elementColor("P") : elementColor("O");
    for (const y of [yTop, yBot]) {
      ctx.beginPath();
      ctx.arc(x, y, phos ? headR : headR * 0.72, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (id === "phospholipid") {
    // Zara gömülü protein kanalları.
    ctx.fillStyle = "rgba(120, 170, 210, 0.8)";
    for (let x = 90; x < w; x += 220) {
      ctx.beginPath();
      ctx.roundRect(x - 16, memTop - 4, 12, memH + 8, 5);
      ctx.roundRect(x + 4, memTop - 4, 12, memH + 8, 5);
      ctx.fill();
    }
  }
  if (id === "fattyacid") {
    // Yağ asidi veziküllerinin geçirgenliği: küçük bir molekül zardan sızar.
    const k = (t * 0.25) % 1;
    ctx.fillStyle = "rgba(150, 240, 200, 0.9)";
    ctx.beginPath();
    ctx.arc(w * 0.7, memTop - 14 + k * (memH + 28), 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Kalıtım polimerinin kesiti: sarmal, merdiven, tabaka, istif, kristal, şerit ya da bulut; her biri kendi çizimiyle. */
function drawGeneticLayer(ctx: CanvasRenderingContext2D, g: GeneticOption, inTop: number, inH: number, w: number, t: number): void {
  const mid = inTop + inH * 0.45;
  const amp = inH * 0.22;
  const id = g.id;
  ctx.lineCap = "round";
  const strand = (phase: number, color: string, width: number, zig = false): void => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let x = 0; x <= w; x += zig ? 14 : 4) {
      const y = mid + Math.sin(x * 0.035 + t * 0.9 + phase) * amp * (zig ? 0.8 : 1);
      if (zig) ctx.lineTo(x, mid + (Math.floor(x / 14) % 2 ? -1 : 1) * amp * 0.45 + Math.sin(x * 0.035 + t * 0.9 + phase) * amp * 0.5);
      else if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  if (id === "hachimoji" || id === "tna" || id === "gna") {
    // Çift sarmal: iki omurga, aralarında baz çiftleri. Hachimoji sekiz renk, TNA dört köşeli şeker, GNA zikzak omurga.
    const zig = id === "gna";
    const colors = id === "hachimoji" ? BASES : BASES.slice(0, 4);
    const back = id === "tna" ? "#7ad1e0" : id === "gna" ? "#e08ab8" : "#8a7dff";
    const stepX = id === "hachimoji" ? 9 : 12;
    for (let x = 6, i = 0; x < w; x += stepX, i++) {
      const a = mid + Math.sin(x * 0.035 + t * 0.9) * amp * (zig ? 0.8 : 1);
      const b = mid + Math.sin(x * 0.035 + t * 0.9 + Math.PI) * amp * (zig ? 0.8 : 1);
      const c1 = colors[i % colors.length];
      const c2 = colors[(i + colors.length / 2 + (i % 2)) % colors.length];
      ctx.lineWidth = id === "hachimoji" ? 3 : 2.4;
      ctx.strokeStyle = c1;
      ctx.beginPath();
      ctx.moveTo(x, a);
      ctx.lineTo(x, (a + b) / 2);
      ctx.stroke();
      ctx.strokeStyle = c2;
      ctx.beginPath();
      ctx.moveTo(x, (a + b) / 2);
      ctx.lineTo(x, b);
      ctx.stroke();
      if (id === "tna") {
        ctx.fillStyle = back;
        ctx.fillRect(x - 2, a - 2, 4, 4);
        ctx.fillRect(x - 2, b - 2, 4, 4);
      }
    }
    strand(0, back, id === "tna" ? 3.4 : 2.4, zig);
    strand(Math.PI, back, id === "tna" ? 3.4 : 2.4, zig);
    return;
  }
  if (id === "pna" || id === "phosphodiester") {
    if (id === "pna") {
      // Peptit nükleik asit: düz, fosfatsız amit omurga; azotlu bağlantı noktaları ve baz basamakları.
      for (const f of [-0.5, 0.5]) {
        ctx.strokeStyle = "#7a96e8";
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) ctx.lineTo(x, mid + f * amp * 1.6 + Math.sin(x * 0.05 + t) * 1.5);
        ctx.stroke();
      }
      for (let x = 8, i = 0; x < w; x += 12, i++) {
        ctx.strokeStyle = BASES[i % 4];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, mid - amp * 0.8);
        ctx.lineTo(x, mid + amp * 0.8);
        ctx.stroke();
        ctx.fillStyle = elementColor("N");
        ctx.beginPath();
        ctx.arc(x, mid - amp * 0.8, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    // Fosfodiester (RNA benzeri): tek omurga, üzerinde fosfat noktaları, bazlar dışa sarkar.
    strand(0, "#8a7dff", 2);
    for (let x = 6, i = 0; x < w; x += 12, i++) {
      const y = mid + Math.sin(x * 0.035 + t * 0.9) * amp;
      ctx.strokeStyle = BASES[i % 4];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 9);
      ctx.stroke();
      if (i % 3 === 0) {
        ctx.fillStyle = elementColor("P");
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }
  if (id === "amyloid") {
    // Amiloid: üst üste dizilmiş beta-iplikler (oklar), aralarında dikey hidrojen bağları.
    for (let row = 0; row < 3; row++) {
      const y = mid + (row - 1) * amp * 0.9;
      ctx.fillStyle = row === 1 ? "#c9a7ff" : "#a98aef";
      for (let x = 4; x < w; x += 46) {
        ctx.beginPath();
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x + 32, y - 5);
        ctx.lineTo(x + 32, y - 9);
        ctx.lineTo(x + 43, y);
        ctx.lineTo(x + 32, y + 9);
        ctx.lineTo(x + 32, y + 5);
        ctx.lineTo(x, y + 5);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.setLineDash([2, 3]);
    ctx.lineWidth = 1;
    for (let x = 14; x < w; x += 23) {
      ctx.beginPath();
      ctx.moveTo(x, mid - amp * 0.9);
      ctx.lineTo(x, mid + amp * 0.9);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    return;
  }
  if (id === "pahstack") {
    // Halkalı karbon istifi: yan görünüşte sikke gibi dizili halkalar, kenarlarında renkli yan gruplar bilgi taşır.
    for (let x = 10, i = 0; x < w; x += 16, i++) {
      const y = mid + Math.sin(x * 0.02 + t * 0.7) * amp * 0.5;
      ctx.fillStyle = "rgba(150, 160, 180, 0.9)";
      ctx.strokeStyle = "#2b3040";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, y, 4.5, amp * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = BASES[(i * 3) % 8];
      ctx.beginPath();
      ctx.arc(x, y - amp * 0.9 - 3, 2.6, 0, Math.PI * 2);
      ctx.fill();
      if (i % 2) {
        ctx.fillStyle = BASES[(i * 5) % 8];
        ctx.beginPath();
        ctx.arc(x, y + amp * 0.9 + 3, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }
  if (id === "clay") {
    // Kil kristali: üst üste tabakalar; yük kusurları (renkli noktalar) kopyalanan bilgiyi taşır.
    for (let row = 0; row < 3; row++) {
      const y = mid + (row - 1) * amp * 0.75;
      ctx.fillStyle = `hsl(${28 + row * 6} 38% ${40 + row * 6}%)`;
      ctx.beginPath();
      ctx.moveTo(0, y - 6);
      ctx.lineTo(w, y - 10);
      ctx.lineTo(w, y + 6);
      ctx.lineTo(0, y + 10);
      ctx.closePath();
      ctx.fill();
      for (let x = 10, i = row; x < w; x += 18, i++)
        if (hash01(i, row + 3) > 0.45) {
          ctx.fillStyle = BASES[Math.floor(hash01(i, 9) * 4)];
          ctx.beginPath();
          ctx.arc(x, y + Math.sin(x * 0.03 + row) * 2, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
    }
    return;
  }
  if (id === "polysilane") {
    // Siloksan şerit: Si–O dönüşümlü boncuklu omurga ve yanlarda renkli yan gruplar.
    for (let x = 4, i = 0; x < w; x += 12, i++) {
      const y = mid + Math.sin(x * 0.03 + t * 0.8) * amp * 0.8;
      ctx.fillStyle = i % 2 ? elementColor("O") : elementColor("Si");
      ctx.beginPath();
      ctx.arc(x, y, i % 2 ? 3 : 4.6, 0, Math.PI * 2);
      ctx.fill();
      if (i % 2 === 0) {
        ctx.strokeStyle = BASES[(i / 2) % 4 | 0];
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 2, y + ((i / 2) % 2 ? 11 : -11));
        ctx.stroke();
      }
    }
    return;
  }
  // Bileşimsel kalıtım: dizi yoktur; kesenin içindeki molekül karışımı, oranlarıyla yavruya geçer.
  for (let i = 0; i < 70; i++) {
    const x = (hash01(i, 1) * w + Math.sin(t * 0.5 + i) * 10 + w) % w;
    const y = mid + (hash01(i, 2) - 0.5) * amp * 2.4 + Math.cos(t * 0.6 + i * 0.7) * 5;
    ctx.fillStyle = BASES[Math.floor(hash01(i, 3) * (i % 5 === 0 ? 8 : 3))];
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.arc(x, y, 2.4 + hash01(i, 4) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Katalizör taneciklerinin konumu (çizim ve tıklama için ortak). */
function catalystPoint(i: number, t: number, w: number, inTop: number, inH: number): { x: number; y: number } {
  return { x: (i * 131 + Math.sin(t * 0.6 + i) * 14 + w * 0.1) % w, y: inTop + ((i * 47) % inH) };
}

function drawCatalystDots(ctx: CanvasRenderingContext2D, cat: Option, t: number, w: number, inTop: number, inH: number): void {
  const metal = cat.needs.find((n) => n !== "S") ?? cat.needs[0];
  const color = metal ? elementColor(metal) : "#b7bed6";
  for (let i = 0; i < 7; i++) {
    const { x, y } = catalystPoint(i, t, w, inTop, inH);
    if (cat.id === "fes") {
      // Fe₄S₄ kümesi: dönüşümlü demir ve kükürt köşeli küp.
      const s = 5.2;
      const pts: [number, number, string][] = [
        [-s, -s, elementColor("Fe")],
        [s, -s, elementColor("S")],
        [-s, s, elementColor("S")],
        [s, s, elementColor("Fe")],
      ];
      ctx.strokeStyle = "rgba(220,220,230,0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - s, y - s, s * 2, s * 2);
      for (const [dx, dy, c] of pts) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (cat.id === "organo") {
      // Metalsiz organik katalizör: küçük halkalı organik molekül.
      ctx.fillStyle = "rgba(183, 190, 214, 0.7)";
      ctx.strokeStyle = "#b7bed6";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      hexPath(ctx, x, y, 5.6);
      ctx.fill();
      ctx.stroke();
    } else {
      // Metal merkez: dört ligand (azot) onu çevreler.
      ctx.fillStyle = elementColor("N");
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.arc(x + Math.cos((k * Math.PI) / 2 + t * 0.4) * 8, y + Math.sin((k * Math.PI) / 2 + t * 0.4) * 8, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 5.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Enerji taşıyıcılarının hücre içindeki konumu (çizim ve tıklama için ortak). */
function energyPoint(i: number, t: number, w: number, inTop: number, inH: number): { x: number; y: number } {
  return { x: (i * 97 + 40 + Math.sin(t * 0.7 + i * 1.3) * 16) % w, y: inTop + inH * (0.8 + 0.15 * Math.sin(t * 0.5 + i)) };
}

function drawEnergyCarriers(ctx: CanvasRenderingContext2D, en: Option, t: number, w: number, inTop: number, inH: number, memTop: number, wallTop: number): void {
  const n = 8;
  for (let i = 0; i < n; i++) {
    const { x, y } = energyPoint(i, t, w, inTop, inH);
    switch (en.id) {
      case "polyphosphate": {
        // ATP benzeri: fosfat zinciri; uçtaki bağ parlayıp koparak enerji verir.
        const glow = 0.5 + 0.5 * Math.sin(t * 2 + i);
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = k === 2 ? `rgba(255, 220, 120, ${0.5 + glow * 0.5})` : elementColor("P");
          ctx.beginPath();
          ctx.arc(x + k * 9, y, 3.8, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "thioester": {
        // Tiyoester: kükürt (sarı) ve karbonil karbonu arasındaki yüksek enerjili bağ.
        ctx.strokeStyle = "rgba(255, 230, 120, 0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 10, y);
        ctx.stroke();
        ctx.fillStyle = elementColor("S");
        ctx.beginPath();
        ctx.arc(x + 10, y, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = elementColor("C");
        ctx.beginPath();
        ctx.arc(x, y, 3.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "sodium":
      case "proton": {
        // Gradyan: iyonlar zarın dışında yığılır, içeride seyrektir; pil gibi.
        if (i < 3) {
          ctx.fillStyle = en.id === "sodium" ? "#f0b04a" : "#eef2f8";
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#1a1f2e";
          ctx.font = "600 9px Onest, system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("+", x, y + 0.5);
          ctx.textAlign = "left";
        }
        const ox = (i * 83 + 20 + Math.sin(t * 0.8 + i) * 10) % w;
        const oy = Math.max(10, wallTop - 14 - ((i * 29) % Math.max(10, wallTop - 40)));
        ctx.fillStyle = en.id === "sodium" ? "#f0b04a" : "#eef2f8";
        for (let k = 0; k < 2; k++) {
          ctx.beginPath();
          ctx.arc(ox + k * 26, oy + k * 6, 3.6, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      default: {
        // Mineral yüzeyde elektron aktarımı: iletken şerit boyunca sıçrayan elektron.
        if (i === 0) {
          ctx.strokeStyle = "rgba(200, 205, 220, 0.5)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, inTop + inH * 0.93);
          ctx.lineTo(w, inTop + inH * 0.93);
          ctx.stroke();
        }
        ctx.fillStyle = "#6df0d2";
        ctx.beginPath();
        ctx.arc(((i * w) / n + t * 40) % w, inTop + inH * 0.93, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  void memTop;
}

/** Zar ve duvarın kesiti: üstte dış ortam (çözücü), altta hücre içi. Her yapı türü kendi görünümüne sahiptir. */
function drawEnvelope(ctx: CanvasRenderingContext2D, chem: Chemistry, w: number, h: number, t: number): void {
  const hue = chem.solvent.hue;
  ctx.fillStyle = `hsl(${hue} ${chem.solvent.sat * 60}% 11%)`;
  ctx.fillRect(0, 0, w, h);
  const mid = h * 0.5;
  const wallH = chem.wall.id === "none" ? 0 : h * 0.14;
  const memH = h * 0.2;
  const memTop = mid - memH / 2 + wallH / 2;
  ctx.fillStyle = "rgba(255,255,255,0.035)";
  ctx.fillRect(0, memTop + memH, w, h);
  ctx.font = "500 11.5px Onest, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const label = (source: string, y: number): void => {
    const text = tr(source);
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = "rgba(4, 6, 14, 0.72)";
    ctx.fillRect(10, y - 10, tw + 14, 20);
    ctx.fillStyle = "#f3f5fc";
    ctx.fillText(text, 17, y + 0.5);
  };

  // dış ortamdaki çözücü molekülleri
  for (let i = 0; i < 26; i++) {
    const x = ((i * 97.3 + t * 9 * (1 + (i % 3) * 0.4)) % (w + 20)) - 10;
    const y = 14 + ((i * 53.7) % Math.max(20, memTop - wallH - 30)) + Math.sin(t + i) * 3;
    ctx.fillStyle = `hsl(${hue} 70% 70% / 0.5)`;
    ctx.beginPath();
    ctx.arc(x, y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // hücre içi alanı (enerji taşıyıcıları dış ortam iyonlarını da çizer; bu yüzden duvardan önce)
  const inTop = memTop + memH + 34;
  const inH = h - inTop - 34;

  if (wallH > 0) {
    const top = memTop - wallH - 4;
    drawWallLayer(ctx, chem.wall.id, top, wallH + 4, w, t);
    label(`Duvar: ${chem.wall.name}`, top - 14);
  }

  drawMembraneLayer(ctx, chem.membrane.id, memTop, memH, w, t);
  label(`Zar: ${chem.membrane.name}`, memTop + memH + 16);

  // hücre içi: kalıtım polimeri, enerji taşıyıcıları, katalizör
  if (inH > 30) {
    drawGeneticLayer(ctx, chem.genetic, inTop, inH, w, t);
    drawEnergyCarriers(ctx, chem.energy, t, w, inTop, inH, memTop, memTop - wallH - 4);
    drawCatalystDots(ctx, chem.catalyst, t, w, inTop, inH);
    label(`Kalıtım: ${chem.genetic.name}`, h - 18);
  }
  label(`Dış ortam: ${chem.solvent.name.toLocaleLowerCase("tr")}, ${chem.temperature} K`, 18);
}

/** Büyütme geçişinin süresi (sn) ve yakınlaşma çarpanı: bir düzey öbürüne yakınlaşarak geçilir. */
/** Parça listesinde hücrenin kendi parçalarından sonra organlar başlar (zar, duvar, kalıtım, enerji, katalizör, pigment). */
const ORGAN_PART_START = 6;
const ZOOM_SECONDS = 0.85;
const ZOOM_FACTOR = 7;
const easeInOut = (p: number): number => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/** Kabuk kesitindeki katmanların yerleşimi (drawEnvelope ile aynı sayılar). */
function envelopeGeometry(chem: Chemistry, h: number): { wallH: number; memH: number; memTop: number } {
  const mid = h * 0.5;
  const wallH = chem.wall.id === "none" ? 0 : h * 0.14;
  const memH = h * 0.2;
  return { wallH, memH, memTop: mid - memH / 2 + wallH / 2 };
}

/** Kabuk kesitinde (x, y) noktasının hangi yapıya düştüğü: parça dizini (0 zar, 1 duvar, 2 kalıtım, 4 katalizör) ya da -1. */
function envelopePick(chem: Chemistry, w: number, h: number, t: number, x: number, y: number): number {
  const { wallH, memH, memTop } = envelopeGeometry(chem, h);
  if (wallH > 0 && y >= memTop - wallH - 4 && y < memTop) return 1;
  if (y >= memTop && y < memTop + memH) return 0;
  if (y < memTop + memH) return -1;
  const inTop = memTop + memH + 34;
  const inH = h - inTop - 34;
  if (inH > 30) {
    for (let i = 0; i < 7; i++) {
      const c = catalystPoint(i, t, w, inTop, inH);
      if (Math.hypot(c.x - x, c.y - y) <= 16) return 4;
    }
    for (let i = 0; i < 8; i++) {
      const e = energyPoint(i, t, w, inTop, inH);
      if (Math.hypot(e.x + 9 - x, e.y - y) <= 22) return 3;
    }
  }
  return 2;
}

/** Fareyle üstünden geçilen katmanı hafifçe aydınlatır. */
function drawEnvelopeHover(ctx: CanvasRenderingContext2D, chem: Chemistry, w: number, h: number, part: number): void {
  const { wallH, memH, memTop } = envelopeGeometry(chem, h);
  let y0: number;
  let y1: number;
  if (part === 1) [y0, y1] = [memTop - wallH - 4, memTop];
  else if (part === 0) [y0, y1] = [memTop, memTop + memH];
  else [y0, y1] = [memTop + memH + 2, h];
  ctx.fillStyle = "rgba(109, 240, 210, 0.10)";
  ctx.fillRect(0, y0, w, y1 - y0);
  ctx.strokeStyle = "rgba(109, 240, 210, 0.7)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, y0 + 1, w - 2, y1 - y0 - 2);
  ctx.font = "600 12px Onest, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#6df0d2";
  ctx.fillText(tr("dokun: yakınlaş"), w - 12, y0 + Math.min(16, (y1 - y0) / 2));
}

/** Organın baskın elementi: malzemenin molekülünde en çok bulunan (H ve R dışında). */
function mainElement(m: Mol): string {
  const count = new Map<string, number>();
  for (const a of m.atoms) if (a.sym !== "R" && a.sym !== "H") count.set(a.sym, (count.get(a.sym) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "C";
}

/**
 * Organ kesiti: üstte organın canlı üstündeki yeri, altta malzemesinin doku düzeyinde nasıl dizildiği
 * (mineral levhalar, lif demetleri ya da damlacıklar). Doku, molekülün milyonlarca kez yan yana dizilmiş hâlidir.
 */
function drawOrganSection(ctx: CanvasRenderingContext2D, part: Part, g: Genome, theme: Theme, w: number, h: number, t: number, hover: boolean): void {
  ctx.fillStyle = "#070a14";
  ctx.fillRect(0, 0, w, h);
  const organ = g.organs.find((o) => o.type === part.option.id);
  // Üst: yalnızca bu organı taşıyan canlı.
  const topH = h * 0.56;
  if (organ) {
    const scale = Math.min(topH * 0.34, w * 0.2) / g.radius;
    ctx.save();
    ctx.translate(w / 2, topH * 0.52);
    ctx.scale(scale, scale);
    drawCreature(ctx, { ...g, organs: [organ] }, theme, true, { t, state: 0, id: 1 });
    ctx.restore();
  }
  ctx.font = "500 11.5px Onest, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const label = (text: string, y: number): void => {
    const s = tr(text);
    const tw = ctx.measureText(s).width;
    ctx.fillStyle = "rgba(4, 6, 14, 0.72)";
    ctx.fillRect(10, y - 10, tw + 14, 20);
    ctx.fillStyle = "#f3f5fc";
    ctx.fillText(s, 17, y + 0.5);
  };
  label(`Organ: ${part.label}`, 18);
  // Alt: doku.
  const y0 = h * 0.64;
  const y1 = h - 14;
  const el = mainElement(part.mol);
  const color = elementColor(el);
  const atoms = part.mol.atoms.map((a) => a.sym);
  const crystal = atoms.some((s) => s === "Ca" || s === "Fe" || s === "Mn") || (atoms.includes("Si") && !atoms.includes("C"));
  const droplets = /yağ|gaz|kese|jel|mukus|gliserol|zar film/i.test(part.option.name);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y0, w, y1 - y0);
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(0, y0, w, y1 - y0);
  if (crystal) {
    const tw = 40;
    const th = 22;
    for (let row = 0, y = y0 + 4; y < y1; row++, y += th + 4) {
      for (let x = -tw + (row % 2 ? tw / 2 : 0); x < w; x += tw + 5) {
        ctx.globalAlpha = 0.55 + 0.25 * Math.sin(row * 1.7 + x * 0.05 + t * 0.6);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, y, tw, th, 4);
        ctx.fill();
      }
    }
  } else if (droplets) {
    for (let i = 0; i < 70; i++) {
      const gx = (i * 61.7) % w;
      const gy = y0 + 8 + ((i * 37.3) % Math.max(10, y1 - y0 - 16));
      const r = 5 + ((i * 7) % 9);
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(gx + Math.sin(t + i) * 3, gy + Math.cos(t * 0.8 + i) * 2, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(gx - r * 0.3 + Math.sin(t + i) * 3, gy - r * 0.3, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.lineCap = "round";
    for (let row = 0, y = y0 + 8; y < y1; row++, y += 11) {
      ctx.globalAlpha = row % 2 ? 0.55 : 0.9;
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 6) {
        const yy = y + Math.sin(x * 0.04 + row * 0.9 + t * 0.7) * 2.2;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  if (hover) {
    ctx.strokeStyle = "rgba(109, 240, 210, 0.8)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, y0, w - 2, y1 - y0);
  }
  label(`Doku: ${part.option.name}`, y0 - 14);
  if (hover) {
    ctx.font = "600 12px Onest, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#6df0d2";
    ctx.fillText(tr("dokun: yakınlaş"), w - 12, y0 - 14);
  }
}

export class StructureViewer {
  private level = 0;
  private part = 0;
  private atom = -1;
  /** Hidrojen seçiliyse bağlı olduğu atomun sırası (hidrojen çizimde yoktur, yalnızca komşu olarak açılır). */
  private hFrom = -1;
  private nbHits: NeighbourHit[] = [];
  private parts: Part[] = [];
  private chem: Chemistry | null = null;
  private base: Chemistry | null = null;
  private genome: Genome | null = null;
  private hits: { x: number; y: number; r: number }[] = [];
  private raf = 0;
  /** Süren büyütme geçişi: hangi düzeyden hangisine, nereye yakınlaşılarak. */
  private anim: { from: number; to: number; t0: number; fx: number; fy: number } | null = null;
  private hover = -1;
  private now = 0;

  constructor(
    private readonly dialog: HTMLDialogElement,
    private readonly canvas: HTMLCanvasElement,
    private readonly levels: HTMLElement,
    private readonly list: HTMLElement,
    private readonly info: HTMLElement,
    private readonly caption: HTMLElement,
    private readonly theme: () => Theme
  ) {
    levels.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-level]");
      if (b) this.setLevel(Number(b.dataset.level));
    });
    list.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-part]");
      if (!b) return;
      this.part = Number(b.dataset.part);
      this.atom = -1;
    this.hFrom = -1;
      if (this.part >= ORGAN_PART_START) {
        if (this.level < 1) this.go(1);
        else this.sync();
      } else if (this.level < 2) this.go(2);
      else this.sync();
    });
    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (this.anim) return;
      if (this.level === 0) this.go(1, x, y);
      else if (this.level === 1) {
        if (this.part >= ORGAN_PART_START) this.go(2, x, y);
        else if (this.chem) {
          const picked = envelopePick(this.chem, rect.width, rect.height, this.now, x, y);
          if (picked >= 0) {
            this.part = picked;
            this.atom = -1;
    this.hFrom = -1;
            this.go(2, x, y);
          }
        }
      } else if (this.level === 2) {
        const i = this.hits.findIndex((p) => Math.hypot(p.x - x, p.y - y) <= p.r + 6);
        if (i >= 0 && this.parts[this.part].mol.atoms[i].sym !== "R") {
          this.atom = i;
          this.hFrom = -1;
          this.go(3, this.hits[i].x, this.hits[i].y);
        }
      } else if (this.level === 3) {
        const k = this.nbHits.findIndex((p) => Math.hypot(p.x - x, p.y - y) <= p.r + 6);
        if (k < 0) return;
        const hit = this.nbHits[k];
        if (hit.idx >= 0) {
          this.atom = hit.idx;
          this.hFrom = -1;
        } else if (hit.sym === "H") this.hFrom = this.pickedIndex();
        this.sync();
      }
    });
    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      let over = -1;
      let pointer = false;
      if (!this.anim) {
        if (this.level === 0) pointer = true;
        else if (this.level === 1) {
          if (this.part >= ORGAN_PART_START) {
            over = y > rect.height * 0.6 ? 1 : -1;
            pointer = over >= 0;
          } else if (this.chem) {
            over = envelopePick(this.chem, rect.width, rect.height, this.now, x, y);
            pointer = over >= 0;
          }
        } else if (this.level === 3) pointer = this.nbHits.some((p) => Math.hypot(p.x - x, p.y - y) <= p.r + 6);
        else if (this.level === 2) pointer = this.hits.some((p, i) => Math.hypot(p.x - x, p.y - y) <= p.r + 6 && this.parts[this.part].mol.atoms[i]?.sym !== "R");
      }
      this.hover = over;
      canvas.style.cursor = pointer ? "pointer" : "default";
    });
    canvas.addEventListener("mouseleave", () => {
      this.hover = -1;
    });
    dialog.addEventListener("close", () => cancelAnimationFrame(this.raf));
  }

  public open(chem: Chemistry, genome: Genome | null): void {
    // Hücrenin kendi yapısı: duvar, zar, kalıtım polimeri, enerji taşıyıcısı ve katalizör genomdan gelir.
    const pickOpt = <T extends Option>(list: readonly T[], id: string | undefined, fallback: T): T => list.find((o) => o.id === id) ?? fallback;
    this.base = chem;
    chem = genome
      ? { ...chem, wall: pickOpt(WALLS, genome.wall, chem.wall), membrane: pickOpt(MEMBRANES, genome.membrane, chem.membrane), genetic: pickOpt(GENETICS, genome.genetic, chem.genetic), energy: pickOpt(ENERGIES, genome.energy, chem.energy), catalyst: pickOpt(CATALYSTS, genome.catalyst, chem.catalyst) }
      : { ...chem, wall: WALLS.find((o) => o.id === "none") ?? chem.wall };
    this.chem = chem;
    this.genome = genome;
    this.parts = partsOf(chem, genome);
    this.part = 0;
    this.atom = -1;
    this.hFrom = -1;
    this.level = genome ? 0 : 1;
    this.anim = null;
    this.hover = -1;
    this.sync();
    if (!this.dialog.open) this.dialog.showModal();
    cancelAnimationFrame(this.raf);
    const loop = (now: number): void => {
      this.draw(now / 1000);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private setLevel(level: number): void {
    this.go(level);
  }

  /** Başka bir düzeye geçer: yakınlaşırken (ya da uzaklaşırken) iki düzey birbirine karışarak geçilir. */
  private go(level: number, fx = Number.NaN, fy = Number.NaN): void {
    const to = !this.genome && level === 0 ? 1 : level;
    const from = this.level;
    this.level = to;
    this.sync();
    if (from === to || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    this.anim = { from, to, t0: this.now, fx, fy };
  }

  private pickedSym(): string {
    const m = this.parts[this.part].mol;
    if (this.hFrom >= 0) return "H";
    if (this.atom >= 0 && m.atoms[this.atom]) return m.atoms[this.atom].sym;
    const special = m.atoms.find((a) => !["C", "H", "O", "R"].includes(a.sym)) ?? m.atoms.find((a) => a.sym !== "R") ?? m.atoms[0];
    return special.sym;
  }

  private sync(): void {
    const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const organ = this.part >= ORGAN_PART_START;
    this.levels.innerHTML = LEVELS.map((name0, i) => {
      const name = i === 1 && organ ? "Organ kesiti" : name0;
      return `<button type="button" data-level="${i}" aria-pressed="${i === this.level}"${i === 0 && !this.genome ? " disabled" : ""}>${name}<small>${MAGNIFY[i]}</small></button>`;
    }).join("");
    this.list.innerHTML = this.parts.map((p, i) => `<button type="button" data-part="${i}" aria-pressed="${i === this.part}"><span>${esc(p.label)}</span><small>${esc(p.option.name)}</small></button>`).join("");
    const p = this.parts[this.part];
    const chem = this.chem!;
    if (this.level === 0) {
      this.caption.textContent = "Canlının bütünü. Yakınlaşmak için görüntüye ya da üstteki düzeylere dokunun.";
      this.info.innerHTML = `<b>Bu canlı nasıl kurulu?</b><p>${esc(chem.scaffold.name)} iskeleti üzerine kurulu, ${esc(chem.solvent.name.toLocaleLowerCase("tr"))} içinde yaşıyor. ${esc(chem.scaffold.note)}</p><p class="ref">${esc(chem.scaffold.ref)}</p>${this.differences()}`;
    } else if (this.level === 1 && organ) {
      this.caption.textContent = "Organın kesiti: üstte canlı üzerindeki yeri, altta malzemesinin doku düzeyindeki dizilişi. Dokuya dokunarak moleküle yakınlaşın.";
      this.info.innerHTML = `<b>${esc(p.label)}: ${esc(p.option.name)}</b><p>${esc(p.option.note)}</p>${p.option.ref ? `<p class="ref">${esc(p.option.ref)}</p>` : ""}`;
    } else if (this.level === 1) {
      this.caption.textContent = "Hücre kabuğunun kesiti: üstte dış ortam, altta hücrenin içi. Duvara, zara ya da hücre içine dokunarak o yapıya yakınlaşın.";
      this.info.innerHTML =
        `<b>Zar: ${esc(chem.membrane.name)}</b><p>${esc(chem.membrane.note)}</p><p class="ref">${esc(chem.membrane.ref)}</p>` +
        `<b>Duvar: ${esc(chem.wall.name)}</b><p>${esc(chem.wall.note)} Simülasyondaki etkisi: can ×${chem.wall.hp.toFixed(2)}, hız ×${chem.wall.speed.toFixed(2)}, metabolizma ×${chem.wall.meta.toFixed(2)}.</p><p class="ref">${esc(chem.wall.ref)}</p>` +
        (this.genome ? this.differences() : `<p class="dim">İlk hücre duvarsızdır. Bu gezegende sonradan evrilebilecek duvar:</p><p>${esc(this.base?.wall.name ?? "")}</p>`);
    } else if (this.level === 2) {
      this.caption.textContent = "Top-çubuk modeli. R zincirin devamıdır; çizilmeyen hidrojenler aşağıdaki bileşimde sayılır. Bir atoma dokununca o atom açılır.";
      this.info.innerHTML = `<b>${esc(p.label)}: ${esc(p.option.name)}</b><p class="mono">${esc(p.mol.formula)}</p><p>${esc(p.option.note)}</p>${this.composition(p.mol)}${p.option.ref ? `<p class="ref">${esc(p.option.ref)}</p>` : ""}`;
    } else {
      const e = ELEMENTS[this.pickedSym()];
      const share = chem.elements.find((x) => x.sym === e.sym);
      this.caption.textContent = "Bohr şeması: çekirdek ve elektron kabukları. Gerçekte elektronlar yörüngede dönmez, bulut olarak dağılır. Alttaki komşu atomlara dokunarak onlara geçebilirsiniz.";
      this.info.innerHTML =
        `<b>${esc(e.name)} (${e.sym})</b><p>Atom numarası ${e.z}: çekirdekte ${e.z} proton, çevresinde ${e.z} elektron. Kabuk dizilimi ${e.shells.join("–")}; en dış kabuktaki ${e.shells[e.shells.length - 1]} elektron bağ yapar.</p>` +
        `<p>${share ? `Bu gezegenin kabuğundaki payı %${(share.share * 100).toFixed(1)}.` : "Bu gezegenin 10 temel elementi arasında değil; iz miktarda bulunur."} Burada ${esc(p.label.toLocaleLowerCase("tr"))} yapısının (${esc(p.option.name.toLocaleLowerCase("tr"))}) parçası.</p>${this.neighbourInfo(p.mol)}`;
    }
  }

  private draw(t: number): void {
    this.now = t;
    const fit = fitCanvas(this.canvas);
    if (!fit || !this.chem) return;
    const { ctx, w, h } = fit;
    const a = this.anim;
    if (!a) {
      this.drawLevel(this.level, ctx, w, h, t, true);
      return;
    }
    const p = (t - a.t0) / ZOOM_SECONDS;
    if (p >= 1) {
      this.anim = null;
      this.drawLevel(this.level, ctx, w, h, t, true);
      return;
    }
    const e = easeInOut(Math.max(0, p));
    const fx = Number.isNaN(a.fx) ? w / 2 : a.fx;
    const fy = Number.isNaN(a.fy) ? h / 2 : a.fy;
    const S = ZOOM_FACTOR;
    const layer = (level: number, pivotX: number, pivotY: number, scale: number, alpha: number): void => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.translate(pivotX, pivotY);
      ctx.scale(scale, scale);
      ctx.translate(-pivotX, -pivotY);
      this.drawLevel(level, ctx, w, h, t, false);
      ctx.restore();
    };
    if (a.to > a.from) {
      // Yakınlaş: eski düzey odak noktasına doğru büyür ve solar; yeni düzey ortadan küçükten büyüyerek belirir.
      layer(a.from, fx, fy, 1 + (S - 1) * e, 1 - e * 1.1);
      layer(a.to, w / 2, h / 2, 1 / S + (1 - 1 / S) * e, e * 1.1 - 0.1);
    } else {
      // Uzaklaş: yeni (daha geniş) düzey odaktan büyükten küçülür; eski düzey ortaya doğru küçülüp solar.
      layer(a.to, fx, fy, S - (S - 1) * e, e * 1.1 - 0.1);
      layer(a.from, w / 2, h / 2, 1 - (1 - 1 / S) * e, 1 - e * 1.1);
    }
  }

  /** Bir düzeyi çizer. `live` doğruysa tıklama alanları ve üstünden geçilen katman güncellenir. */
  private drawLevel(level: number, ctx: CanvasRenderingContext2D, w: number, h: number, t: number, live: boolean): void {
    const chem = this.chem!;
    if (level === 0 && this.genome) {
      const g = this.genome;
      const scale = (Math.min(w, h) * 0.22) / g.radius;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      drawCreature(ctx, g, this.theme(), true, { t, state: 0, id: 1 });
      ctx.restore();
    } else if (level === 1) {
      const part = this.parts[this.part];
      if (this.part >= ORGAN_PART_START && this.genome) drawOrganSection(ctx, part, this.genome, this.theme(), w, h, t, live && this.hover >= 0);
      else {
        drawEnvelope(ctx, chem, w, h, t);
        if (live && this.hover >= 0) drawEnvelopeHover(ctx, chem, w, h, this.hover);
      }
    } else if (level === 2) {
      const hits = drawMolecule(ctx, this.parts[this.part].mol, w / 2, h / 2, w, h, t, this.atom);
      if (live) this.hits = hits;
    } else {
      drawAtom(ctx, this.pickedSym(), w / 2, h / 2 - 14, Math.min(w, h) * 0.8, t);
      const m = this.parts[this.part].mol;
      const i = this.pickedIndex();
      const hits = i >= 0 ? drawNeighbours(ctx, m, i, w, h, this.hFrom >= 0) : [];
      if (live) this.nbHits = hits;
    }
  }

  private pickedIndex(): number {
    const m = this.parts[this.part].mol;
    if (this.atom >= 0 && m.atoms[this.atom]) return this.atom;
    const special = m.atoms.findIndex((a) => !["C", "H", "O", "R"].includes(a.sym));
    if (special >= 0) return special;
    return m.atoms.findIndex((a) => a.sym !== "R");
  }

  /** Molekülün içerdiği bütün atomlar (hidrojenler dâhil). */
  private composition(m: Mol): string {
    const parts = compositionOf(m).map(([sym, n]) => `<span class="comp">${sym}<small>×${n}</small></span>`);
    return parts.length ? `<p>İçerdiği atomlar:</p><p class="mono">${parts.join(" ")}</p>` : "";
  }

  /** Seçili atomun bağlı olduğu komşular. */
  private neighbourInfo(m: Mol): string {
    const i = this.pickedIndex();
    if (i < 0) return "";
    if (this.hFrom >= 0) return `<p>Bağlı olduğu atom:</p><p class="mono"><span class="comp">${esc2(ELEMENTS[m.atoms[this.hFrom].sym]?.name ?? m.atoms[this.hFrom].sym)}</span></p>`;
    const n = neighboursOf(m, i);
    const bits = [...n.syms.map((s) => ELEMENTS[s]?.name ?? s)];
    if (n.hydrogens > 0) bits.push(n.hydrogens === 1 ? "Hidrojen" : `Hidrojen ×${n.hydrogens}`);
    if (n.chain) bits.push("zincirin devamı");
    return bits.length ? `<p>Bağlı olduğu atomlar:</p><p class="mono">${bits.map((b) => `<span class="comp">${esc2(b)}</span>`).join(" ")}</p>` : "";
  }

  /** Bu hücrenin yapısı gezegenin ilk hücresinden ayrıldıysa hangi bakımlardan ayrıldığını söyler. */
  private differences(): string {
    const g = this.genome;
    const base = this.base;
    const chem = this.chem;
    if (!g || !base || !chem) return "";
    const rows: string[] = [];
    const check = (label: string, a: Option, b: Option): void => {
      if (a.id !== b.id) rows.push(`<li><b>${esc2(label)}</b>: <span>${esc2(b.name)}</span> <span class="dim">ilk hücrede</span> <span>${esc2(a.name)}</span></li>`);
    };
    check("Duvar", WALLS.find((o) => o.id === "none") ?? base.wall, chem.wall);
    check("Zar", base.membrane, chem.membrane);
    check("Kalıtım polimeri", base.genetic, chem.genetic);
    check("Enerji taşıyıcısı", base.energy, chem.energy);
    check("Katalizör", base.catalyst, chem.catalyst);
    if (rows.length === 0) return `<p class="dim">Bu hücrenin yapısı gezegenin ilk hücresininkiyle aynı.</p>`;
    return `<p>İlk hücreden ayrışan yapılar:</p><ul class="diff">${rows.join("")}</ul>`;
  }
}

// ------------------------------------------------------------------ köken filmi

interface SceneKit {
  liquid: (l: number, a?: number) => string;
  ground: (l: number) => string;
  rnd: (i: number, k: number) => number;
  stars: () => void;
  chip: (sym: string, x: number, y: number, r: number, alpha: number) => void;
}

/**
 * Köken senaryosunun ortamı: 20 senaryonun her birinin kendi çizimi vardır. Renkler
 * gezegenden gelir (sıvı çözücünün, zemin kabuktaki elementlerin tonunda).
 */
function drawOriginScene(ctx: CanvasRenderingContext2D, c: Chemistry, w: number, h: number, t: number, p: number, kit: SceneKit): void {
  const { liquid, ground, rnd, stars, chip } = kit;
  const cx = w / 2;
  const disc = (x: number, y: number, r: number, fill: string): void => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    ctx.fill();
  };
  const sky = (top: string, bottom: string, to: number): void => {
    const g = ctx.createLinearGradient(0, 0, 0, to);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, to);
  };
  const hills = (base: number, height: number, light: number): void => {
    ctx.fillStyle = ground(light);
    ctx.beginPath();
    ctx.moveTo(0, base);
    for (let x = 0; x <= w; x += 20) ctx.lineTo(x, base - 14 - Math.abs(Math.sin(x * 0.006 + c.seed) * height + Math.sin(x * 0.021) * height * 0.35));
    ctx.lineTo(w, base);
    ctx.fill();
  };
  /** Dalgalı sıvı yüzeyi: `y` çizgisinden aşağısı sıvıdır. */
  const sea = (y: number, light: number, amp = 5): void => {
    ctx.fillStyle = liquid(light);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.025 + t * 1.6) * amp + Math.sin(x * 0.011 - t) * amp);
    ctx.lineTo(w, h);
    ctx.fill();
  };
  const land = (y: number, light: number): void => {
    ctx.fillStyle = ground(light);
    ctx.fillRect(0, y, w, h - y);
  };
  const pool = (y: number, rx: number, ry: number): void => {
    ctx.fillStyle = ground(22);
    ctx.beginPath();
    ctx.ellipse(cx, y, rx * 1.08, ry * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = liquid(26);
    ctx.beginPath();
    ctx.ellipse(cx, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  const vents = (floor: number, smoke: string, body: number, mark: (vx: number, top: number) => void): void => {
    ctx.fillStyle = liquid(9);
    ctx.fillRect(0, 0, w, h);
    land(floor, 13);
    for (let v = 0; v < 3; v++) {
      const vx = w * (0.22 + v * 0.28);
      const vh = h * (0.2 + rnd(v, 5) * 0.16);
      ctx.fillStyle = ground(body);
      ctx.beginPath();
      ctx.moveTo(vx - 30, floor);
      ctx.lineTo(vx - 10, floor - vh);
      ctx.lineTo(vx + 10, floor - vh);
      ctx.lineTo(vx + 30, floor);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      mark(vx, floor - vh);
      for (let i = 0; i < 28; i++) {
        const life = (t * 0.35 + rnd(i, v)) % 1;
        ctx.globalAlpha = (1 - life) * 0.75;
        disc(vx + Math.sin(life * 7 + i) * 24 * life, floor - vh - life * h * 0.5, 2 + life * 6, smoke);
      }
      ctx.globalAlpha = 1;
    }
  };
  const horizon = h * 0.6;
  const el = (i: number): string => c.elements[i % c.elements.length].sym;

  switch (c.origin.id) {
    case "alkaline_vent":
      // Soluk, gözenekli karbonat bacalar ve berrak ılık akışkan.
      vents(h * 0.84, "rgba(225, 240, 255, 0.9)", 62, (vx, top) => {
        for (let i = 0; i < 9; i++) disc(vx + (rnd(i, vx) - 0.5) * 22, top + 14 + rnd(i, 3) * (h * 0.84 - top - 20), 2.4, "rgba(4, 6, 14, 0.45)");
      });
      break;
    case "iron_sulfur":
      // Kara bacalar: koyu duman, baca gövdesinde parlayan pirit kristalleri.
      vents(h * 0.84, "rgba(20, 18, 22, 0.95)", 9, (vx, top) => {
        ctx.fillStyle = "#e7c65a";
        for (let i = 0; i < 7; i++) {
          const y = top + 10 + rnd(i, 7) * (h * 0.84 - top - 22);
          ctx.fillRect(vx + (rnd(i, vx) - 0.5) * 20 - 3, y, 6, 6);
        }
        disc(vx, top, 12, "rgba(255, 110, 60, 0.35)");
      });
      break;
    case "thioester": {
      // Sığ kükürtlü kaynak: sarı çökeltiler ve yükselen kabarcıklar.
      sky("#151226", "#3a2a2a", horizon);
      hills(horizon, 50, 8);
      ctx.fillStyle = "#6b5a1c";
      ctx.fillRect(0, horizon, w, h - horizon);
      for (let i = 0; i < 5; i++) {
        const x = w * (0.12 + i * 0.19);
        const y = horizon + (h - horizon) * (0.35 + rnd(i, 2) * 0.4);
        ctx.fillStyle = "#d8c23a";
        ctx.beginPath();
        ctx.ellipse(x, y, 58, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = liquid(30);
        ctx.beginPath();
        ctx.ellipse(x, y, 44, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let k = 0; k < 6; k++) {
          const life = (t * 0.6 + rnd(k, i)) % 1;
          ctx.globalAlpha = 1 - life;
          disc(x + (rnd(k, i + 4) - 0.5) * 60, y - life * 90, 3 + life * 3, "#f1e27a");
        }
        ctx.globalAlpha = 1;
      }
      break;
    }
    case "hot_spring": {
      // Islanıp kuruyan havuz, buhar ve bir gayzer.
      sky("#0d1430", "#33263c", horizon);
      hills(horizon, 70, 9);
      land(horizon, 15);
      const level = 0.5 + Math.sin(t * 1.4) * 0.45;
      const y = horizon + (h - horizon) * 0.5;
      pool(y, w * 0.34 * (0.6 + level * 0.4), (h - horizon) * 0.28 * (0.5 + level * 0.5));
      for (let i = 0; i < 26; i++) chip(el(i), cx + Math.cos(rnd(i, 1) * 6.28) * w * 0.2 * rnd(i, 2), y + Math.sin(rnd(i, 1) * 6.28) * 18 * rnd(i, 3), 7, 0.95);
      for (let i = 0; i < 18; i++) {
        const life = (t * 0.3 + rnd(i, 9)) % 1;
        ctx.globalAlpha = (1 - life) * 0.35;
        disc(cx + (rnd(i, 4) - 0.5) * w * 0.5 + Math.sin(life * 5 + i) * 20, y - life * h * 0.45, 14 + life * 26, "#dfe6f5");
      }
      ctx.globalAlpha = 1;
      const jet = Math.max(0, Math.sin(t * 1.4));
      ctx.fillStyle = liquid(70, 0.7);
      ctx.fillRect(w * 0.82 - 4, horizon + 20 - jet * h * 0.3, 8, jet * h * 0.3);
      break;
    }
    case "primordial_soup": {
      // Fırtına bulutları, yıldırım ve denize yağan yağmur.
      sky("#0a0f24", "#272341", horizon);
      sea(horizon, 16);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = "rgba(120, 124, 160, 0.55)";
        ctx.beginPath();
        ctx.ellipse(((rnd(i, 1) * w + t * 10) % (w + 180)) - 90, h * (0.1 + rnd(i, 2) * 0.16), 110, 26, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const strike = Math.floor(t * 1.6);
      if ((t * 1.6) % 1 < 0.22) {
        ctx.strokeStyle = "#f4f1ff";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        let x = w * (0.2 + rnd(strike, 9) * 0.6);
        let y = h * 0.2;
        ctx.moveTo(x, y);
        while (y < horizon) {
          x += (rnd(strike, y) - 0.5) * 46;
          y += 22;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(0, 0, w, h);
      }
      ctx.fillStyle = liquid(70, 0.5);
      for (let i = 0; i < 60; i++) ctx.fillRect(rnd(i, 4) * w, (rnd(i, 5) * horizon + t * 170) % horizon, 1.4, 9);
      break;
    }
    case "rna_world": {
      // Yıldızlı gece, durgun havuz ve içinde kıvrılan kısa zincirler.
      sky("#05070f", "#131a36", horizon);
      stars();
      hills(horizon, 40, 7);
      land(horizon, 13);
      const y = horizon + (h - horizon) * 0.5;
      pool(y, w * 0.4, (h - horizon) * 0.34);
      for (let k = 0; k < 7; k++) {
        const x0 = cx + (rnd(k, 1) - 0.5) * w * 0.55;
        const y0 = y + (rnd(k, 2) - 0.5) * (h - horizon) * 0.34;
        ctx.strokeStyle = k % 2 ? "#8a7dff" : "#6df0d2";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i <= 12; i++) ctx.lineTo(x0 + i * 6 - 36, y0 + Math.sin(i * 0.9 + t * 2 + k) * 6);
        ctx.stroke();
      }
      break;
    }
    case "clay": {
      // Kıyı çamuru: üst üste kil tabakaları ve yüzeylerine dizilen yapı taşları.
      sky("#0d1430", "#2a2440", horizon * 0.7);
      land(horizon * 0.7, 12);
      for (let row = 0; row < 7; row++) {
        const y = h * 0.9 - row * 26;
        ctx.strokeStyle = ground(30 + row * 4);
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.moveTo(w * 0.1 + row * 10, y);
        ctx.lineTo(w * 0.9 - row * 10, y);
        ctx.stroke();
        for (let i = 0; i < 12; i++) {
          const settle = Math.min(1, p * 2.2);
          const tx = w * 0.14 + row * 10 + (i * (w * 0.72 - row * 20)) / 12;
          chip(el(i + row), tx + (rnd(i, row) - 0.5) * w * 0.5 * (1 - settle), y - 11 - (1 - settle) * rnd(i, row + 9) * h * 0.4, 5.5, 0.95);
        }
      }
      break;
    }
    case "cyanosulfidic": {
      // Morötesi ışınlar altında, akarsuların beslediği havuz.
      sky("#100c2a", "#2d1f4a", horizon);
      disc(w * 0.78, h * 0.16, 26, "#cdbcff");
      ctx.strokeStyle = "rgba(170, 130, 255, 0.28)";
      ctx.lineWidth = 10;
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.moveTo(w * 0.78, h * 0.16);
        ctx.lineTo(w * (0.1 + i * 0.13) + Math.sin(t + i) * 12, h);
        ctx.stroke();
      }
      hills(horizon, 60, 9);
      land(horizon, 15);
      const y = horizon + (h - horizon) * 0.55;
      ctx.strokeStyle = liquid(34);
      ctx.lineWidth = 6;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + side * w * 0.48, horizon + 6);
        ctx.quadraticCurveTo(cx + side * w * 0.3, y - 30, cx + side * w * 0.2, y);
        ctx.stroke();
        const life = (t * 0.5) % 1;
        disc(cx + side * w * (0.48 - life * 0.28), horizon + 6 + life * (y - horizon - 6), 5, side < 0 ? "#f1d84a" : "#6f8dfa");
      }
      pool(y, w * 0.24, (h - horizon) * 0.26);
      break;
    }
    case "lipid_world": {
      // Deniz yüzeyinde yanardöner yağ filmi ve filmden kopan keseler.
      sky("#0d1430", "#2a2440", horizon * 0.8);
      sea(horizon * 0.8, 17, 7);
      const film = ctx.createLinearGradient(0, 0, w, 0);
      for (let i = 0; i <= 6; i++) film.addColorStop(i / 6, `hsl(${(i * 60 + t * 40) % 360} 80% 70% / 0.55)`);
      ctx.strokeStyle = film;
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 12) ctx.lineTo(x, horizon * 0.8 + Math.sin(x * 0.025 + t * 1.6) * 7 + Math.sin(x * 0.011 - t) * 7);
      ctx.stroke();
      for (let i = 0; i < 16; i++) {
        const life = (t * 0.18 + rnd(i, 1)) % 1;
        ctx.strokeStyle = "rgba(226, 192, 138, 0.9)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(rnd(i, 2) * w, horizon * 0.8 + 20 + life * (h - horizon * 0.8 - 40), 8 + rnd(i, 3) * 14, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case "panspermia": {
      // Karbonlu göktaşı yağmuru.
      stars();
      land(h * 0.72, 14);
      hills(h * 0.72, 40, 9);
      for (let i = 0; i < 9; i++) {
        const life = (t * 0.45 + rnd(i, 1)) % 1;
        const x = rnd(i, 2) * w * 0.9 + w * 0.2 - life * w * 0.35;
        const y = life * h * 0.72;
        ctx.strokeStyle = `rgba(255, 196, 120, ${1 - life * 0.4})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 38, y - 66);
        ctx.stroke();
        disc(x, y, 5, "#3a3030");
        if (life > 0.9) chip(el(i), x, h * 0.72 - (life - 0.9) * 200, 8, 1);
      }
      break;
    }
    case "ice": {
      // Buz kristalleri ve aralarındaki sıvı damarları.
      ctx.fillStyle = "#b9cfe0";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = liquid(38);
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      for (let v = 0; v < 7; v++) {
        const points: [number, number][] = [];
        let x = rnd(v, 1) * w;
        let y = 0;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 8; k++) {
          x += (rnd(v, k + 2) - 0.5) * w * 0.22;
          y += h / 7;
          ctx.lineTo(x, y);
          points.push([x, y]);
        }
        ctx.stroke();
        points.forEach(([px, py], k) => {
          if (k % 2 === 0) chip(el(v + k), px, py - Math.sin(t + k) * 6, 6, 0.95);
        });
      }
      for (let i = 0; i < 40; i++) disc(rnd(i, 7) * w, (rnd(i, 8) * h + t * 12) % h, 2, "rgba(255,255,255,0.8)");
      break;
    }
    case "pah_world": {
      // Yıldızlararası bulutta süzülüp istiflenen altıgen karbon halkaları.
      stars();
      const neb = ctx.createRadialGradient(cx, h * 0.45, 10, cx, h * 0.45, Math.max(w, h) * 0.6);
      neb.addColorStop(0, "rgba(138, 125, 255, 0.28)");
      neb.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, w, h);
      const join = Math.min(1, p * 1.6);
      for (let i = 0; i < 14; i++) {
        const fx = rnd(i, 1) * w;
        const fy = rnd(i, 2) * h;
        const x = fx + (cx - fx) * join + Math.sin(t + i) * 6;
        const y = fy + (h * 0.2 + i * (h * 0.6) / 14 - fy) * join;
        ctx.strokeStyle = "#b7bed6";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let k = 0; k <= 6; k++) ctx.lineTo(x + Math.cos((k / 6) * Math.PI * 2 + (1 - join) * (t + i)) * 34, y + Math.sin((k / 6) * Math.PI * 2 + (1 - join) * (t + i)) * 12);
        ctx.stroke();
      }
      break;
    }
    case "zinc_world": {
      // Gözenekli çinko sülfür çökeltisi ve üstüne düşen ışık demetleri.
      sky("#101733", "#2c3157", h * 0.4);
      ctx.fillStyle = "#c9cbd8";
      ctx.fillRect(0, h * 0.4, w, h * 0.6);
      for (let i = 0; i < 70; i++) disc(rnd(i, 1) * w, h * 0.44 + rnd(i, 2) * h * 0.54, 5 + rnd(i, 3) * 13, liquid(22));
      for (let i = 0; i < 6; i++) {
        const x = w * (0.1 + i * 0.16) + Math.sin(t * 0.6 + i) * 14;
        const beam = ctx.createLinearGradient(0, 0, 0, h);
        beam.addColorStop(0, "rgba(255, 240, 170, 0.5)");
        beam.addColorStop(1, "rgba(255, 240, 170, 0)");
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(x - 8, 0);
        ctx.lineTo(x + 8, 0);
        ctx.lineTo(x + 46, h);
        ctx.lineTo(x - 46, h);
        ctx.fill();
      }
      break;
    }
    case "tidal": {
      // Büyük bir uydu ve kumsalda ileri geri gidip gelen kıyı çizgisi.
      sky("#070b1c", "#1e2444", horizon);
      stars();
      disc(w * 0.74, h * 0.2, Math.min(w, h) * 0.13, "#d7d3c4");
      disc(w * 0.74 - 14, h * 0.2 - 10, Math.min(w, h) * 0.03, "#bdb8a6");
      ctx.fillStyle = ground(24);
      ctx.beginPath();
      ctx.moveTo(0, horizon + 10);
      ctx.lineTo(w, h * 0.92);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.fill();
      const tide = 0.5 + Math.sin(t * 1.2) * 0.4;
      ctx.fillStyle = liquid(24, 0.92);
      ctx.beginPath();
      ctx.moveTo(w * tide, horizon + 10 + (h * 0.92 - horizon - 10) * tide);
      ctx.lineTo(w, horizon + 4);
      ctx.lineTo(w, h * 0.92);
      ctx.fill();
      for (let i = 0; i < 14; i++) {
        const k = 0.2 + rnd(i, 1) * 0.6;
        chip(el(i), w * k, horizon + 4 + (h * 0.92 - horizon - 10) * k, 6.5, k < tide ? 1 : 0.55);
      }
      break;
    }
    case "radioactive_beach": {
      // Kumsalda koyu, ışıyan ağır mineral şeritleri.
      sky("#0d1430", "#2a2440", horizon);
      sea(horizon - 20, 16, 4);
      land(horizon + 16, 24);
      for (let row = 0; row < 4; row++) {
        ctx.strokeStyle = "#1c1a22";
        ctx.lineWidth = 12;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 20) ctx.lineTo(x, horizon + 60 + row * 42 + Math.sin(x * 0.012 + row) * 9);
        ctx.stroke();
        for (let i = 0; i < 7; i++) {
          const x = rnd(i, row) * w;
          const y = horizon + 60 + row * 42 + Math.sin(x * 0.012 + row) * 9;
          const life = (t * 0.7 + rnd(i, row + 5)) % 1;
          ctx.strokeStyle = `rgba(150, 255, 170, ${(1 - life) * 0.8})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 4 + life * 30, 0, Math.PI * 2);
          ctx.stroke();
          disc(x, y, 4, "#9dffb0");
        }
      }
      break;
    }
    case "coacervate": {
      // Sıvının içinde birleşip büyüyen zarsız damlacıklar.
      ctx.fillStyle = liquid(9);
      ctx.fillRect(0, 0, w, h);
      const merge = Math.min(1, p * 1.3);
      for (let i = 0; i < 26; i++) {
        const home = i % 5;
        const hx = w * (0.14 + home * 0.18);
        const hy = h * (0.3 + (home % 2) * 0.3);
        const fx = rnd(i, 1) * w;
        const fy = rnd(i, 2) * h;
        const x = fx + (hx - fx) * merge + Math.sin(t * 0.8 + i) * 8;
        const y = fy + (hy - fy) * merge + Math.cos(t * 0.7 + i) * 8;
        const g = ctx.createRadialGradient(x, y, 2, x, y, 34 + merge * 26);
        g.addColorStop(0, "rgba(255, 214, 170, 0.5)");
        g.addColorStop(1, "rgba(255, 214, 170, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 34 + merge * 26, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "aerosol": {
      // Kırılan dalgalardan havaya savrulan, zarla kaplı damlacıklar.
      sky("#0d1430", "#33304f", horizon);
      sea(horizon, 17, 12);
      for (let i = 0; i < 34; i++) {
        const life = (t * 0.32 + rnd(i, 1)) % 1;
        const x = rnd(i, 2) * w + life * 60;
        const y = horizon - Math.sin(life * Math.PI) * h * (0.2 + rnd(i, 3) * 0.3);
        disc(x, y, 5 + rnd(i, 4) * 5, liquid(60, 0.7));
        ctx.strokeStyle = "rgba(226, 192, 138, 0.9)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(x, y, 6.5 + rnd(i, 4) * 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case "formamide": {
      // Kızgın koyu kayaç üzerinde buharlaşıp derişen damlalar.
      sky("#160d12", "#3a1c18", horizon);
      ctx.fillStyle = "#1a1416";
      ctx.fillRect(0, horizon, w, h - horizon);
      const glow = ctx.createLinearGradient(0, horizon, 0, h);
      glow.addColorStop(0, "rgba(255, 110, 50, 0)");
      glow.addColorStop(1, "rgba(255, 110, 50, 0.35)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, horizon, w, h - horizon);
      for (let i = 0; i < 9; i++) {
        const x = w * (0.08 + i * 0.105);
        const y = horizon + 30 + rnd(i, 1) * (h - horizon - 60);
        const shrink = 1 - ((t * 0.25 + rnd(i, 2)) % 1) * 0.7;
        ctx.fillStyle = liquid(40, 0.9);
        ctx.beginPath();
        ctx.ellipse(x, y, 30 * shrink, 10 * shrink, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let k = 0; k < 4; k++) {
          const life = (t * 0.5 + rnd(k, i)) % 1;
          ctx.globalAlpha = (1 - life) * 0.4;
          disc(x + Math.sin(life * 6 + k) * 12, y - life * 120, 6 + life * 10, "#e9dccf");
        }
        ctx.globalAlpha = 1;
      }
      break;
    }
    case "impact_crater": {
      // Çarpma, ardından sıvıyla dolan ve buharı tüten krater.
      stars();
      land(h * 0.7, 13);
      const hit = Math.min(1, p * 3);
      if (hit < 1) {
        ctx.strokeStyle = "#ffd9a0";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(cx + (1 - hit) * w * 0.3, h * 0.7 * hit - 40);
        ctx.lineTo(cx + (1 - hit) * w * 0.3 + 40, h * 0.7 * hit - 110);
        ctx.stroke();
      } else {
        const flash = Math.max(0, Math.min(1, 1 - (p - 0.34) * 4));
        disc(cx, h * 0.7, flash * Math.max(w, h) * 0.5, `rgba(255, 230, 190, ${flash * 0.8})`);
        ctx.fillStyle = ground(8);
        ctx.beginPath();
        ctx.ellipse(cx, h * 0.74, w * 0.3, h * 0.11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = liquid(26);
        ctx.beginPath();
        ctx.ellipse(cx, h * 0.75, w * 0.24 * Math.max(0, Math.min(1, (p - 0.34) * 2)), h * 0.07, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 14; i++) {
          const life = (t * 0.3 + rnd(i, 1)) % 1;
          ctx.globalAlpha = (1 - life) * 0.3;
          disc(cx + (rnd(i, 2) - 0.5) * w * 0.4, h * 0.74 - life * h * 0.4, 14 + life * 24, "#dfe6f5");
        }
        ctx.globalAlpha = 1;
      }
      break;
    }
    default: {
      // Pomza salları: deniz yüzeyinde yüzen gözenekli volkanik taşlar.
      sky("#0d1430", "#3b2a30", horizon);
      ctx.fillStyle = ground(7);
      ctx.beginPath();
      ctx.moveTo(w * 0.62, horizon);
      ctx.lineTo(w * 0.78, horizon - h * 0.26);
      ctx.lineTo(w * 0.86, horizon - h * 0.26);
      ctx.lineTo(w, horizon);
      ctx.fill();
      for (let i = 0; i < 12; i++) {
        const life = (t * 0.25 + rnd(i, 9)) % 1;
        ctx.globalAlpha = (1 - life) * 0.4;
        disc(w * 0.82 + Math.sin(life * 4 + i) * 30, horizon - h * 0.26 - life * h * 0.25, 12 + life * 22, "#8d8690");
      }
      ctx.globalAlpha = 1;
      sea(horizon, 16, 6);
      for (let i = 0; i < 9; i++) {
        const x = ((rnd(i, 1) * w + t * 14) % (w + 120)) - 60;
        const y = horizon + 10 + rnd(i, 2) * (h - horizon) * 0.5 + Math.sin(t * 1.6 + i) * 5;
        const r = 16 + rnd(i, 3) * 20;
        ctx.fillStyle = "#b9b0a8";
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let k = 0; k < 6; k++) disc(x + (rnd(k, i) - 0.5) * r * 1.3, y + (rnd(k, i + 3) - 0.5) * r * 0.7, 2.6, "rgba(4, 6, 14, 0.5)");
      }
    }
  }
}


const SCENE_SECONDS = 5.2;
const SCENES = 6;
/** Film, son sahnede hücre ikiye bölünürken bu sürede haritaya erir (styles.css `.film.leaving` ile aynı). */
const FILM_FADE_SECONDS = 1.1;

export class OriginFilm {
  private raf = 0;
  private t0 = 0;
  private chem: Chemistry | null = null;
  private planet: HTMLCanvasElement | null = null;
  private steps: string[] = [];
  private done: () => void = () => {};
  private shown = -1;
  private leaving = 0;
  /** Gösterilen sahne ve o sahnenin başladığı an (ms). */
  private scene = 0;
  private sceneT0 = 0;
  /** İzleyici elle gezindiyse sahne kendiliğinden ilerlemez; okumak için bekler. */
  private manual = false;
  private founder: Genome | null = null;
  private theme: Theme | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
    private readonly title: HTMLElement,
    private readonly caption: HTMLElement,
    private readonly source: HTMLElement,
    private readonly dots: HTMLElement,
    private readonly controls: { skip: HTMLElement; back: HTMLElement; next: HTMLElement; end: HTMLElement; again: HTMLElement; go: HTMLElement }
  ) {
    controls.skip.addEventListener("click", () => this.finish());
    controls.go.addEventListener("click", () => this.finish());
    controls.back.addEventListener("click", () => this.goTo(this.scene - 1, true));
    controls.next.addEventListener("click", () => (this.scene >= SCENES - 1 ? this.finish() : this.goTo(this.scene + 1, true)));
    controls.again.addEventListener("click", () => this.goTo(0, false));
    dots.addEventListener("click", (e) => {
      const dot = (e.target as HTMLElement).closest<HTMLElement>("[data-scene]");
      if (dot) this.goTo(Number(dot.dataset.scene), true);
    });
    window.addEventListener("keydown", (e) => {
      if (!this.playing || this.leaving) return;
      if (e.key === "ArrowLeft") this.goTo(this.scene - 1, true);
      else if (e.key === "ArrowRight") this.goTo(this.scene + 1, true);
      else return;
      e.preventDefault();
    });
  }

  private goTo(scene: number, manual: boolean): void {
    this.scene = Math.min(SCENES - 1, Math.max(0, scene));
    this.sceneT0 = performance.now();
    this.manual = manual;
  }

  public get playing(): boolean {
    return !this.root.hidden;
  }

  public play(chem: Chemistry, planet: HTMLCanvasElement, done: () => void, founder: Genome | null = null, theme: Theme | null = null): void {
    this.chem = chem;
    this.planet = planet;
    this.founder = founder;
    this.theme = theme;
    this.goTo(0, false);
    this.steps = originSteps(chem);
    this.done = done;
    this.shown = -1;
    clearTimeout(this.leaving);
    this.leaving = 0;
    this.root.classList.remove("leaving");
    this.root.hidden = false;
    this.t0 = performance.now();
    this.source.textContent = `Köken senaryosu: ${chem.origin.name} · ${chem.origin.ref}`;
    cancelAnimationFrame(this.raf);
    const loop = (now: number): void => {
      if (this.root.hidden) return;
      let p = (now - this.sceneT0) / 1000 / SCENE_SECONDS;
      // Sahne bitince sıradakine geçilir; izleyici elle gezindiyse ya da son sahnedeyse beklenir.
      // Film kendiliğinden kapanmaz: sonda "Simülasyona geç" sorulur.
      if (p >= 1 && !this.manual && this.scene < SCENES - 1) {
        this.goTo(this.scene + 1, false);
        p = 0;
      }
      const ended = this.scene === SCENES - 1 && p >= 1;
      if (this.controls.end.hidden === ended) this.controls.end.hidden = !ended;
      this.draw(this.scene, Math.min(p, 0.999), (now - this.t0) / 1000);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Filmi bitirir: simülasyon hemen başlar (`done`), film üstünde eriyerek kaybolur. */
  private finish(): void {
    if (this.root.hidden || this.leaving) return;
    this.root.classList.add("leaving");
    this.leaving = window.setTimeout(() => {
      cancelAnimationFrame(this.raf);
      this.root.hidden = true;
      this.root.classList.remove("leaving");
      this.leaving = 0;
    }, FILM_FADE_SECONDS * 1000);
    this.done();
  }

  private captionFor(scene: number): [string, string] {
    const c = this.chem!;
    const top = c.elements.map((e) => e.sym).join(" · ");
    switch (scene) {
      case 0:
        return ["Gezegen", `Yüzey sıcaklığı ${c.temperature} K (${c.temperature - 273} °C). Denizleri ${c.solvent.name.toLocaleLowerCase("tr")}. Kabuğundaki on element: ${top}.`];
      case 1:
        return [c.origin.name, this.steps[0]];
      case 2:
        return ["Yapı taşları", this.steps[1]];
      case 3:
        return ["İlk bölme", this.steps[2]];
      case 4:
        return ["İlk hücre", this.steps[3]];
      default:
        return ["Yaşam başladı", "Hücre büyüyüp ikiye bölündü. Bu gezegende bundan sonra yaşayacak her canlı onun soyundan gelecek."];
    }
  }

  /** `scene` sahnesini `p` (0–1) ilerlemesinde çizer; `t` kesintisiz akan saattir (salınımlar için). */
  private draw(scene: number, p: number, t: number): void {
    const fit = fitCanvas(this.canvas);
    const c = this.chem;
    if (!fit || !c) return;
    const { ctx, w, h } = fit;
    if (scene !== this.shown) {
      this.shown = scene;
      const [title, text] = this.captionFor(scene);
      this.title.textContent = title;
      this.caption.textContent = text;
      this.dots.innerHTML = Array.from({ length: SCENES }, (_, i) => `<button type="button" data-scene="${i}" aria-label="${i + 1}. sahne"${i === scene ? ' class="on" aria-current="step"' : ""}></button>`).join("");
      (this.controls.back as HTMLButtonElement).disabled = scene === 0;
      // Son sahnede ileri yoktur; simülasyona geçiş alttaki soruyla yapılır.
      this.controls.next.hidden = scene === SCENES - 1;
    }
    const hue = c.solvent.hue;
    const liquid = (l: number, a = 1): string => `hsl(${hue} ${Math.round(c.solvent.sat * 80)}% ${l}% / ${a})`;
    const ground = (l: number): string => `hsl(${c.terrain.groundHue} ${Math.round(c.terrain.groundSat * 100 + 8)}% ${l}%)`;
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.3;
    ctx.fillStyle = "#05070f";
    ctx.fillRect(0, 0, w, h);
    const rnd = (i: number, k: number): number => {
      const v = Math.sin(i * 127.1 + k * 311.7 + c.seed * 0.013) * 43758.5453;
      return v - Math.floor(v);
    };
    const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
    const out3 = (k: number): number => 1 - Math.pow(1 - clamp01(k), 3);
    const back = (k: number): number => {
      const x = clamp01(k) - 1;
      return 1 + 2.4 * x * x * x + 1.4 * x * x;
    };
    const stars = (): void => {
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.2 + rnd(i, 3) * 0.6})`;
        ctx.fillRect(rnd(i, 1) * w, rnd(i, 2) * h, 1.3, 1.3);
      }
    };
    const chip = (sym: string, x: number, y: number, r: number, alpha: number): void => {
      const color = elementColor(sym);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = inkOn(color);
      ctx.font = `600 ${Math.round(r * 0.95)}px Onest, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(sym, x, y + 0.5);
      ctx.globalAlpha = 1;
    };
    const cell = (x: number, y: number, r: number, wall: number, inner: number): void => {
      // İlk hücre duvarsızdır: duvar sonradan, bir mutasyonla evrilir.
      if (wall > 0 && false) {
        ctx.strokeStyle = `rgba(232, 226, 200, ${0.85 * wall})`;
        ctx.lineWidth = Math.max(3, r * 0.09);
        ctx.setLineDash([r * 0.16, r * 0.05]);
        ctx.beginPath();
        ctx.arc(x, y, r * 1.1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = liquid(16, 0.9);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      const n = Math.max(18, Math.round(r * 0.5));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + t * 0.15;
        ctx.fillStyle = c.membrane.id === "phospholipid" ? elementColor("P") : c.membrane.id === "azotosome" ? elementColor("N") : c.membrane.id === "siloxane" ? elementColor("Si") : elementColor("O");
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, Math.max(2.2, r * 0.045), 0, Math.PI * 2);
        ctx.fill();
      }
      if (inner > 0) {
        ctx.strokeStyle = `rgba(138, 125, 255, ${inner})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const a = (i / 40) * Math.PI * 3;
          const rr = r * 0.12 + (i / 40) * r * 0.42;
          ctx.lineTo(x + Math.cos(a + t * 0.4) * rr, y + Math.sin(a + t * 0.4) * rr);
        }
        ctx.stroke();
        const metal = c.catalyst.needs[0];
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = metal ? elementColor(metal) : "#b7bed6";
          ctx.globalAlpha = inner;
          ctx.beginPath();
          ctx.arc(x + Math.cos(i * 1.3 + t * 0.3) * r * 0.6, y + Math.sin(i * 2.1 + t * 0.2) * r * 0.6, Math.max(2.5, r * 0.05), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    };

    // Oyundaki çizimle ilk hücre: `size` yarıçaplı, `alpha` saydamlıkta; `facing` −1 ise ters yöne bakar.
    const living = (x: number, y: number, size: number, alpha: number, facing: number, stretch = 1): void => {
      if (!this.founder || !this.theme || alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      const k = size / this.founder.radius;
      ctx.scale(k * facing * stretch, k / stretch);
      drawCreature(ctx, this.founder, this.theme, true, { t, state: 0, id: 1 });
      ctx.restore();
    };

    if (scene === 0) {
      stars();
      const zoom = 0.9 + 0.1 * out3(p * 2.2);
      const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.35);
      halo.addColorStop(0, liquid(60, 0.28 * out3(p * 3)));
      halo.addColorStop(1, liquid(60, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(zoom, zoom);
      ctx.translate(-cx, -cy);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      if (this.planet) {
        const iw = R * 2 * (this.planet.width / this.planet.height);
        const shift = (t * 14) % iw;
        ctx.drawImage(this.planet, cx - R - shift, cy - R, iw, R * 2);
        ctx.drawImage(this.planet, cx - R - shift + iw, cy - R, iw, R * 2);
      }
      const shade = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.4, R * 0.2, cx, cy, R * 1.05);
      shade.addColorStop(0, "rgba(255,255,255,0.12)");
      shade.addColorStop(0.6, "rgba(0,0,0,0)");
      shade.addColorStop(1, "rgba(0,0,0,0.75)");
      ctx.fillStyle = shade;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.restore();
      ctx.strokeStyle = liquid(60, 0.35);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, R + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      c.elements.forEach((e, i) => {
        const appear = Math.min(1, Math.max(0, p * 6 - i * 0.35));
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2 + t * 0.12;
        const orbit = R * 1.42;
        chip(e.sym, cx + Math.cos(a) * orbit * (w < h ? 0.92 : 1.25), cy + Math.sin(a) * orbit * (w < h ? 1.25 : 0.92), (11 + Math.sqrt(e.share) * (w < 620 ? 16 : 26)) * back(appear), clamp01(appear * 3));
      });
    } else if (scene === 1) {
      drawOriginScene(ctx, c, w, h, t, p, { liquid, ground, rnd, stars, chip });
    } else if (scene === 2) {
      ctx.fillStyle = liquid(8);
      ctx.fillRect(0, 0, w, h);
      // serbest yapı taşları zincirlere bağlanır
      const chains = 5;
      const per = 9;
      for (let k = 0; k < chains; k++) {
        const y0 = h * (0.18 + k * 0.16);
        let prev: [number, number] | null = null;
        for (let i = 0; i < per; i++) {
          const join = Math.min(1, Math.max(0, p * 2.4 - i * 0.12 - k * 0.1));
          const tx = w * 0.14 + (i * w * 0.72) / (per - 1);
          const ty = y0 + Math.sin(i * 0.9 + t * 1.5 + k) * 10;
          const fx = rnd(i, k) * w;
          const fy = rnd(i, k + 20) * h + Math.sin(t + i) * 8;
          const m = out3(join);
          const x = fx + (tx - fx) * m;
          const y = fy + (ty - fy) * m;
          if (prev && join > 0.95) {
            ctx.strokeStyle = `rgba(200, 208, 235, ${0.7 * clamp01((join - 0.95) * 20)})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(prev[0], prev[1]);
            ctx.lineTo(x, y);
            ctx.stroke();
          }
          const needs = c.genetic.needs.length > 0 ? c.genetic.needs : c.membrane.needs.length > 0 ? c.membrane.needs : ["C"];
          chip(needs[(i + k) % needs.length], x, y, Math.max(7, Math.min(12, w * 0.016)), 1);
          prev = [x, y];
        }
      }
    } else if (scene === 3) {
      ctx.fillStyle = liquid(8);
      ctx.fillRect(0, 0, w, h);
      // amfifilik moleküller bir çemberde toplanıp zarı kapatır
      const n = 46;
      const gather = Math.min(1, p * 1.5);
      const ease = gather * gather * (3 - 2 * gather);
      const closed = clamp01((p - 0.72) / 0.28);
      if (ease > 0.85) cell(cx, cy, R * (1 + 0.07 * Math.sin(closed * Math.PI * 3) * (1 - closed)), Math.min(1, Math.max(0, (p - 0.7) * 4)), Math.min(1, (ease - 0.85) * 7));
      if (closed > 0 && closed < 1) {
        ctx.strokeStyle = liquid(70, (1 - closed) * 0.5);
        ctx.lineWidth = 3 * (1 - closed) + 1;
        ctx.beginPath();
        ctx.arc(cx, cy, R * (1.05 + out3(closed) * 0.7), 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const fx = rnd(i, 1) * w;
        const fy = rnd(i, 2) * h;
        const x = fx + (cx + Math.cos(a) * R - fx) * ease;
        const y = fy + (cy + Math.sin(a) * R - fy) * ease;
        ctx.strokeStyle = "rgba(226, 192, 138, 0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - Math.cos(a) * 12, y - Math.sin(a) * 12);
        ctx.stroke();
        ctx.fillStyle = elementColor(c.membrane.needs.includes("P") ? "P" : c.membrane.needs.includes("N") ? "N" : c.membrane.needs.includes("Si") ? "Si" : "O");
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (scene === 4) {
      ctx.fillStyle = liquid(8);
      ctx.fillRect(0, 0, w, h);
      const narrow = w < 620;
      const ccx = narrow ? cx : w * 0.34;
      const ccy = narrow ? h * 0.3 : cy;
      const rr = narrow ? Math.min(w, h) * 0.2 : R;
      // Şematik hücre, haritada görülecek ilk hücrenin kendi çizimine dönüşür.
      const morph = Math.min(1, p * 3.2);
      if (morph < 1 || !this.founder) cell(ccx, ccy, rr * (1 + Math.sin(t * 2) * 0.02), 1, 1);
      living(ccx, ccy, rr, morph, 1);
      const labels: [string, string][] = [
        ["Zar", c.membrane.name],
        ["Duvar", "yok (sonradan evrilir)"],
        ["Kalıtım", c.genetic.name],
        ["Enerji", c.energy.name],
        ["Katalizör", c.catalyst.name],
        ["Pigment", c.pigment.name],
      ];
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      labels.forEach(([k, v], i) => {
        const appear = Math.min(1, Math.max(0, p * 7 - i * 0.6));
        const slide = (1 - out3(appear)) * 26;
        const x = (narrow ? 18 : w * 0.6) + slide;
        const y = narrow ? h * 0.56 + i * 26 : h * 0.2 + i * (h * 0.6) / 5;
        if (!narrow && appear > 0) {
          ctx.strokeStyle = `rgba(109, 240, 210, ${0.28 * appear})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(ccx + rr * 1.02, ccy + (i - 2.5) * rr * 0.28);
          ctx.lineTo(x - 12, y);
          ctx.stroke();
        }
        ctx.globalAlpha = appear;
        ctx.font = "600 12px Onest, system-ui, sans-serif";
        ctx.fillStyle = "#6df0d2";
        ctx.fillText(tr(k).toLocaleUpperCase(getLang()), x, y - (narrow ? 0 : 9));
        ctx.font = `500 ${narrow ? 12.5 : 14.5}px Onest, system-ui, sans-serif`;
        ctx.fillStyle = "#f3f5fc";
        ctx.fillText(tr(v), narrow ? x + 82 : x, y + (narrow ? 0 : 10));
        ctx.globalAlpha = 1;
      });
    } else {
      ctx.fillStyle = liquid(8);
      ctx.fillRect(0, 0, w, h);
      // Bölünme agar.io'daki "W" gibi: ana hücre gerilir, içinden küçük bir hücre fırlar,
      // hızla uzaklaşıp yavaşlar; ikisi de kütlenin yarısıyla jöle gibi titreyerek oturur.
      const rBig = R * 0.78;
      const rHalf = rBig * Math.SQRT1_2;
      const charge = clamp01((p - 0.2) / 0.2);
      const fire = clamp01((p - 0.4) / 0.35);
      const settle = clamp01((p - 0.4) / 0.6);
      const gap = rHalf * 2.7;
      const body = (x: number, r: number, stretch: number, alpha: number, facing: number): void => {
        if (this.founder) living(x, cy, r, alpha, facing, stretch);
        else cell(x, cy, r, 1, 1);
      };
      if (fire <= 0) {
        // Büyür, sonra fırlatmadan önce yönüne doğru gerilip titrer.
        const r0 = rBig * (0.55 + 0.45 * out3(p / 0.2));
        const tense = Math.sin(charge * Math.PI);
        body(cx, r0 * (1 + 0.04 * Math.sin(charge * Math.PI * 6) * charge), 1 + 0.2 * tense, 1, 1);
      } else {
        const shrink = out3(fire * 2.5);
        const wobble = 1 + 0.08 * Math.sin(settle * 30) * (1 - settle);
        const rMother = (rBig + (rHalf - rBig) * shrink) * (1 / wobble);
        const rDaughter = (rBig + (rHalf - rBig) * shrink) * wobble;
        const dist = gap * out3(fire);
        const speed = Math.pow(1 - fire, 2);
        // Fırlayan hücrenin ardında solan izler.
        for (let g = 3; g >= 1; g--) {
          const f = fire - g * 0.06;
          if (f <= 0) continue;
          body(cx + (gap * out3(f)) / 2, rDaughter * 0.95, 1 + 0.4 * Math.pow(1 - f, 2), 0.2 / g, 1);
        }
        // Yeni hücre ana hücrenin gövdesinin altından çıkar: önce o, sonra üstüne ana hücre çizilir.
        body(cx + dist / 2, rDaughter, 1 + 0.4 * speed, 1, 1);
        body(cx - dist / 2, rMother, 1 - 0.1 * speed, 1, 1);
        // Fırlama anında yayılan halka.
        const ring = clamp01((p - 0.4) / 0.25);
        if (ring < 1) {
          ctx.strokeStyle = liquid(70, (1 - ring) * 0.55);
          ctx.lineWidth = Math.max(2, rBig * 0.08 * (1 - ring));
          ctx.beginPath();
          ctx.arc(cx, cy, rBig * (0.9 + out3(ring) * 1.7), 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    // Her sahne karanlıktan yumuşakça açılır.
    const lead = clamp01(p / 0.08);
    if (lead < 1) {
      ctx.fillStyle = `rgba(5, 7, 15, ${1 - lead})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}
