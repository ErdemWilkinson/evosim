import { Chemistry, ELEMENTS, Option, originSteps } from "./chemistry";
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
  const m = table[type];
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

/** Zar ve duvarın kesiti: üstte dış ortam (çözücü), altta hücre içi. */
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

  // duvar
  if (wallH > 0) {
    const top = memTop - wallH - 4;
    const id = chem.wall.id;
    const mineral = id === "silica" || id === "calcite" || id === "ironsulfide" || id === "manganese";
    const color = id === "silica" ? "#cfe3ee" : id === "calcite" ? "#e8e2c8" : id === "ironsulfide" ? "#c9a24a" : id === "manganese" ? "#6b5a7a" : id === "borate" ? "#e7b6a4" : id === "slayer" ? "#9ad0c0" : "#c7b98a";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    if (mineral) {
      const bw = 34;
      for (let x = -bw; x < w + bw; x += bw + 5) {
        for (let row = 0; row < 2; row++) {
          ctx.globalAlpha = 0.75;
          ctx.beginPath();
          ctx.roundRect(x + (row ? bw / 2 : 0), top + row * (wallH / 2), bw, wallH / 2 - 3, 3);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.85;
      for (let row = 0; row < 3; row++) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) {
          const y = top + 4 + (row * (wallH - 8)) / 2 + Math.sin(x * 0.05 + row * 2 + t * 0.8) * 2.5;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      for (let x = 8; x < w; x += 22) {
        ctx.beginPath();
        ctx.moveTo(x, top + 4);
        ctx.lineTo(x + 6, top + wallH - 4);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    label(`Duvar: ${chem.wall.name}`, top - 14);
  }

  // zar
  const id = chem.membrane.id;
  const gap = 15;
  const headR = 5.2;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (let x = 6, i = 0; x < w; x += gap, i++) {
    const sway = Math.sin(t * 2 + i * 0.7) * 1.6;
    const yTop = memTop + headR;
    const yBot = memTop + memH - headR;
    if (id === "pore") {
      ctx.fillStyle = "#8d7f6a";
      if (i % 4 !== 3) ctx.fillRect(x - gap / 2, memTop, gap + 1, memH);
      continue;
    }
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
      ctx.lineTo(x, mid + wallH / 2 - 5);
      ctx.moveTo(x - sway, memTop + memH - 2);
      ctx.lineTo(x + gap / 2, mid + wallH / 2 + 5);
      ctx.stroke();
      ctx.fillStyle = elementColor("N");
      ctx.beginPath();
      ctx.arc(x, mid + wallH / 2 - 5, 3.6, 0, Math.PI * 2);
      ctx.arc(x + gap / 2, mid + wallH / 2 + 5, 3.6, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    const mono = id === "etherlipid" || id === "peptide";
    ctx.strokeStyle = id === "peptide" ? "rgba(111, 141, 250, 0.9)" : "rgba(226, 192, 138, 0.85)";
    ctx.beginPath();
    if (mono) {
      ctx.moveTo(x + sway, yTop);
      ctx.lineTo(x - sway, yBot);
    } else {
      for (const dx of [-2.5, 2.5]) {
        ctx.moveTo(x + dx, yTop);
        ctx.lineTo(x + dx + sway, mid + wallH / 2 - 2);
        ctx.moveTo(x + dx, yBot);
        ctx.lineTo(x + dx - sway, mid + wallH / 2 + 2);
      }
    }
    ctx.stroke();
    ctx.fillStyle = id === "phospholipid" ? elementColor("P") : elementColor("O");
    for (const y of [yTop, yBot]) {
      ctx.beginPath();
      ctx.arc(x, y, headR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  label(`Zar: ${chem.membrane.name}`, memTop + memH + 16);

  // hücre içi: kalıtım polimeri, katalizör, enerji taşıyıcıları
  const inTop = memTop + memH + 34;
  const inH = h - inTop - 34;
  if (inH > 30) {
    ctx.strokeStyle = "#8a7dff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 5) {
      const y = inTop + inH * 0.45 + Math.sin(x * 0.035 + t * 0.9) * inH * 0.22;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    for (let x = 6; x < w; x += 12) {
      const y = inTop + inH * 0.45 + Math.sin(x * 0.035 + t * 0.9) * inH * 0.22;
      ctx.strokeStyle = x % 24 < 12 ? "#6df0d2" : "#f59a3c";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 9);
      ctx.stroke();
    }
    const metal = chem.catalyst.needs[0];
    for (let i = 0; i < 7; i++) {
      const x = (i * 131 + Math.sin(t * 0.6 + i) * 14 + w * 0.1) % w;
      const y = inTop + ((i * 47) % inH);
      ctx.fillStyle = metal ? elementColor(metal) : "#b7bed6";
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    label(`Kalıtım: ${chem.genetic.name}`, h - 18);
  }
  label(`Dış ortam: ${chem.solvent.name.toLocaleLowerCase("tr")}, ${chem.temperature} K`, 18);
}

export class StructureViewer {
  private level = 0;
  private part = 0;
  private atom = -1;
  private parts: Part[] = [];
  private chem: Chemistry | null = null;
  private genome: Genome | null = null;
  private hits: { x: number; y: number; r: number }[] = [];
  private raf = 0;

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
      if (this.level < 2) this.level = 2;
      this.sync();
    });
    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (this.level === 2) {
        const i = this.hits.findIndex((p) => Math.hypot(p.x - x, p.y - y) <= p.r + 6);
        if (i >= 0 && this.parts[this.part].mol.atoms[i].sym !== "R") {
          this.atom = i;
          this.setLevel(3);
        }
      } else if (this.level < 3) this.setLevel(this.level + 1);
    });
    dialog.addEventListener("close", () => cancelAnimationFrame(this.raf));
  }

  public open(chem: Chemistry, genome: Genome | null): void {
    this.chem = chem;
    this.genome = genome;
    this.parts = partsOf(chem, genome);
    this.part = 0;
    this.atom = -1;
    this.level = genome ? 0 : 1;
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
    this.level = !this.genome && level === 0 ? 1 : level;
    this.sync();
  }

  private pickedSym(): string {
    const m = this.parts[this.part].mol;
    if (this.atom >= 0 && m.atoms[this.atom]) return m.atoms[this.atom].sym;
    const special = m.atoms.find((a) => !["C", "H", "O", "R"].includes(a.sym)) ?? m.atoms.find((a) => a.sym !== "R") ?? m.atoms[0];
    return special.sym;
  }

  private sync(): void {
    const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    this.levels.innerHTML = LEVELS.map((name, i) => `<button type="button" data-level="${i}" aria-pressed="${i === this.level}"${i === 0 && !this.genome ? " disabled" : ""}>${name}<small>${MAGNIFY[i]}</small></button>`).join("");
    this.list.innerHTML = this.parts.map((p, i) => `<button type="button" data-part="${i}" aria-pressed="${i === this.part}"><span>${esc(p.label)}</span><small>${esc(p.option.name)}</small></button>`).join("");
    const p = this.parts[this.part];
    const chem = this.chem!;
    if (this.level === 0) {
      this.caption.textContent = "Canlının bütünü. Yakınlaşmak için görüntüye ya da üstteki düzeylere dokunun.";
      this.info.innerHTML = `<b>Bu canlı nasıl kurulu?</b><p>${esc(chem.scaffold.name)} iskeleti üzerine kurulu, ${esc(chem.solvent.name.toLocaleLowerCase("tr"))} içinde yaşıyor. ${esc(chem.scaffold.note)}</p><p class="ref">${esc(chem.scaffold.ref)}</p>`;
    } else if (this.level === 1) {
      this.caption.textContent = "Hücre kabuğunun kesiti: üstte dış ortam, altta hücrenin içi.";
      this.info.innerHTML =
        `<b>Zar: ${esc(chem.membrane.name)}</b><p>${esc(chem.membrane.note)}</p><p class="ref">${esc(chem.membrane.ref)}</p>` +
        `<b>Duvar: ${esc(chem.wall.name)}</b><p>${esc(chem.wall.note)} Simülasyondaki etkisi: can ×${chem.wall.hp.toFixed(2)}, hız ×${chem.wall.speed.toFixed(2)}, metabolizma ×${chem.wall.meta.toFixed(2)}.</p><p class="ref">${esc(chem.wall.ref)}</p>`;
    } else if (this.level === 2) {
      this.caption.textContent = "Top-çubuk modeli. Hidrojenler çizilmez; R zincirin devamıdır. Bir atoma dokununca o atom açılır.";
      this.info.innerHTML = `<b>${esc(p.label)}: ${esc(p.option.name)}</b><p class="mono">${esc(p.mol.formula)}</p><p>${esc(p.option.note)}</p>${p.option.ref ? `<p class="ref">${esc(p.option.ref)}</p>` : ""}`;
    } else {
      const e = ELEMENTS[this.pickedSym()];
      const share = chem.elements.find((x) => x.sym === e.sym);
      this.caption.textContent = "Bohr şeması: çekirdek ve elektron kabukları. Gerçekte elektronlar yörüngede dönmez, bulut olarak dağılır.";
      this.info.innerHTML =
        `<b>${esc(e.name)} (${e.sym})</b><p>Atom numarası ${e.z}: çekirdekte ${e.z} proton, çevresinde ${e.z} elektron. Kabuk dizilimi ${e.shells.join("–")}; en dış kabuktaki ${e.shells[e.shells.length - 1]} elektron bağ yapar.</p>` +
        `<p>${share ? `Bu gezegenin kabuğundaki payı %${(share.share * 100).toFixed(1)}.` : "Bu gezegenin 10 temel elementi arasında değil; iz miktarda bulunur."} Burada ${esc(p.label.toLocaleLowerCase("tr"))} yapısının (${esc(p.option.name.toLocaleLowerCase("tr"))}) parçası.</p>`;
    }
  }

  private draw(t: number): void {
    const fit = fitCanvas(this.canvas);
    if (!fit || !this.chem) return;
    const { ctx, w, h } = fit;
    if (this.level === 0 && this.genome) {
      const g = this.genome;
      const scale = (Math.min(w, h) * 0.22) / g.radius;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      drawCreature(ctx, g, this.theme(), true, { t, state: 0, id: 1 });
      ctx.restore();
    } else if (this.level === 1) drawEnvelope(ctx, this.chem, w, h, t);
    else if (this.level === 2) this.hits = drawMolecule(ctx, this.parts[this.part].mol, w / 2, h / 2, w, h, t, this.atom);
    else drawAtom(ctx, this.pickedSym(), w / 2, h / 2, Math.min(w, h), t);
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
      if (wall > 0 && c.wall.id !== "none") {
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
      c.elements.forEach((e, i) => {
        const appear = Math.min(1, Math.max(0, p * 6 - i * 0.35));
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2 + t * 0.12;
        const orbit = R * 1.42;
        chip(e.sym, cx + Math.cos(a) * orbit * (w < h ? 0.92 : 1.25), cy + Math.sin(a) * orbit * (w < h ? 1.25 : 0.92), 11 + Math.sqrt(e.share) * (w < 620 ? 16 : 26), appear);
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
          const x = fx + (tx - fx) * join;
          const y = fy + (ty - fy) * join;
          if (prev && join > 0.95) {
            ctx.strokeStyle = "rgba(200, 208, 235, 0.7)";
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
      if (ease > 0.85) cell(cx, cy, R, Math.min(1, Math.max(0, (p - 0.7) * 4)), Math.min(1, (ease - 0.85) * 7));
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
        ["Duvar", c.wall.name],
        ["Kalıtım", c.genetic.name],
        ["Enerji", c.energy.name],
        ["Katalizör", c.catalyst.name],
        ["Pigment", c.pigment.name],
      ];
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      labels.forEach(([k, v], i) => {
        const appear = Math.min(1, Math.max(0, p * 7 - i * 0.6));
        const x = narrow ? 18 : w * 0.6;
        const y = narrow ? h * 0.56 + i * 26 : h * 0.2 + i * (h * 0.6) / 5;
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
      const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
      const out3 = (k: number): number => 1 - Math.pow(1 - clamp01(k), 3);
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
  }
}
