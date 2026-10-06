import { Chemistry, ELEMENTS, Option, originSteps } from "./chemistry";
import { Genome } from "./genome";
import { ORGANS, OrganType } from "./organs";
import { Theme, drawCreature } from "./render";

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

interface Part {
  label: string;
  option: Option;
  mol: Mol;
}

function partsOf(chem: Chemistry, g: Genome | null): Part[] {
  const m = (o: Option, fallback: Option): Mol => MOLECULES[o.id] ?? MOLECULES[fallback.id];
  const wallMol = chem.wall.id === "none" ? MOLECULES[chem.membrane.id] : MOLECULES[chem.wall.id];
  const parts: Part[] = [
    { label: "Zar", option: chem.membrane, mol: MOLECULES[chem.membrane.id] },
    { label: "Hücre duvarı", option: chem.wall, mol: wallMol },
    { label: "Kalıtım polimeri", option: chem.genetic, mol: m(chem.genetic, chem.membrane) },
    { label: "Enerji taşıyıcısı", option: chem.energy, mol: MOLECULES[chem.energy.id] },
    { label: "Katalizör", option: chem.catalyst, mol: MOLECULES[chem.catalyst.id === "manganese" ? "manganese" : chem.catalyst.id] ?? metalCenter("Mn") },
    { label: "Işık pigmenti", option: chem.pigment, mol: MOLECULES[chem.pigment.id] },
  ];
  if (g) {
    const fibre: Option = chem.scaffold.id === "silicon" ? { id: "siloxane", name: "Siloksan lif demeti", needs: [], note: "Kasılabilen uzun Si–O zincirleri; yan grupların dönmesi lifi kısaltıp uzatır.", ref: chem.scaffold.ref } : { id: "peptide", name: "Peptit lif demeti", needs: [], note: "Uzun peptit zincirleri demetlenip birbiri üzerinde kayarak kasılır.", ref: "Pollard & Cooper 2009, Science 326:1208" };
    const seen = new Set<OrganType>();
    for (const organ of g.organs) {
      if (seen.has(organ.type)) continue;
      seen.add(organ.type);
      const info = ORGANS[organ.type];
      const source = info.category === "movement" ? fibre : info.category === "sense" ? chem.pigment : info.category === "feeding" ? chem.catalyst : info.category === "defense" ? (chem.wall.id === "none" ? fibre : chem.wall) : chem.membrane;
      parts.push({
        label: info.label,
        option: { ...source, note: `${info.description} Bu organın yapı malzemesi: ${source.name.toLocaleLowerCase("tr")}. ${source.note}` },
        mol: MOLECULES[source.id] ?? MOLECULES[chem.membrane.id],
      });
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
  const label = (text: string, y: number): void => {
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
      this.info.innerHTML = `<b>${esc(p.label)}: ${esc(p.option.name)}</b><p class="mono">${esc(p.mol.formula)}</p><p>${esc(p.option.note)}</p><p class="ref">${esc(p.option.ref)}</p>`;
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

const SCENE_SECONDS = 5.2;

export class OriginFilm {
  private raf = 0;
  private t0 = 0;
  private chem: Chemistry | null = null;
  private planet: HTMLCanvasElement | null = null;
  private steps: string[] = [];
  private done: () => void = () => {};
  private shown = -1;

  constructor(
    private readonly root: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
    private readonly title: HTMLElement,
    private readonly caption: HTMLElement,
    private readonly source: HTMLElement,
    private readonly dots: HTMLElement,
    skip: HTMLElement
  ) {
    skip.addEventListener("click", () => this.finish());
  }

  public get playing(): boolean {
    return !this.root.hidden;
  }

  public play(chem: Chemistry, planet: HTMLCanvasElement, done: () => void): void {
    this.chem = chem;
    this.planet = planet;
    this.steps = originSteps(chem);
    this.done = done;
    this.shown = -1;
    this.root.hidden = false;
    this.t0 = performance.now();
    this.source.textContent = `Köken senaryosu: ${chem.origin.name} · ${chem.origin.ref}`;
    cancelAnimationFrame(this.raf);
    const loop = (now: number): void => {
      const t = (now - this.t0) / 1000;
      if (t >= SCENE_SECONDS * 6) return this.finish();
      this.draw(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private finish(): void {
    if (this.root.hidden) return;
    cancelAnimationFrame(this.raf);
    this.root.hidden = true;
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

  private draw(t: number): void {
    const fit = fitCanvas(this.canvas);
    const c = this.chem;
    if (!fit || !c) return;
    const { ctx, w, h } = fit;
    const scene = Math.min(5, Math.floor(t / SCENE_SECONDS));
    const p = t / SCENE_SECONDS - scene;
    if (scene !== this.shown) {
      this.shown = scene;
      const [title, text] = this.captionFor(scene);
      this.title.textContent = title;
      this.caption.textContent = text;
      this.dots.innerHTML = Array.from({ length: 6 }, (_, i) => `<i${i === scene ? ' class="on"' : ""}></i>`).join("");
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
      const kind = c.origin.scene;
      const floor = kind === "vent" ? h * 0.84 : h * 0.6;
      if (kind === "space") stars();
      if (kind === "vent") {
        ctx.fillStyle = liquid(9);
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = ground(13);
        ctx.fillRect(0, floor, w, h - floor);
        for (let v = 0; v < 3; v++) {
          const vx = w * (0.22 + v * 0.28);
          const vh = h * (0.16 + rnd(v, 5) * 0.14);
          ctx.fillStyle = ground(20);
          ctx.beginPath();
          ctx.moveTo(vx - 26, floor);
          ctx.lineTo(vx - 9, floor - vh);
          ctx.lineTo(vx + 9, floor - vh);
          ctx.lineTo(vx + 26, floor);
          ctx.fill();
          for (let i = 0; i < 26; i++) {
            const life = (t * 0.35 + rnd(i, v) * 1) % 1;
            ctx.fillStyle = `rgba(255, 214, 150, ${(1 - life) * 0.7})`;
            ctx.beginPath();
            ctx.arc(vx + Math.sin(life * 7 + i) * 22 * life, floor - vh - life * h * 0.5, 2 + life * 5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (kind === "ice") {
        ctx.fillStyle = "#b9cfe0";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = liquid(38);
        ctx.lineWidth = 7;
        ctx.lineCap = "round";
        for (let v = 0; v < 7; v++) {
          ctx.beginPath();
          let x = rnd(v, 1) * w;
          let y = 0;
          ctx.moveTo(x, y);
          for (let s = 0; s < 8; s++) {
            x += (rnd(v, s + 2) - 0.5) * w * 0.22;
            y += h / 7;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        for (let i = 0; i < 40; i++) {
          ctx.fillStyle = "rgba(255,255,255,0.8)";
          ctx.beginPath();
          ctx.arc(rnd(i, 7) * w, (rnd(i, 8) * h + t * 12) % h, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // gökyüzü, yer ve sıvı: havuz, gökyüzü, uzay ve mineral sahnelerinin ortak zemini
        const sky = ctx.createLinearGradient(0, 0, 0, floor);
        sky.addColorStop(0, kind === "space" ? "#05070f" : "#0d1430");
        sky.addColorStop(1, kind === "space" ? "#0d1430" : "#2a2440");
        if (kind !== "space") {
          ctx.fillStyle = sky;
          ctx.fillRect(0, 0, w, floor);
        }
        // ufuktaki tepeler
        ctx.fillStyle = ground(9);
        ctx.beginPath();
        ctx.moveTo(0, floor);
        for (let x = 0; x <= w; x += 24) ctx.lineTo(x, floor - 18 - Math.abs(Math.sin(x * 0.006 + c.seed) * 60 + Math.sin(x * 0.021) * 22));
        ctx.lineTo(w, floor);
        ctx.fill();
        ctx.fillStyle = ground(15);
        ctx.fillRect(0, floor, w, h - floor);
        const level = kind === "pool" ? 0.5 + Math.sin(t * 1.4) * 0.45 : 1;
        const poolY = floor + (h - floor) * 0.48;
        const poolRx = w * 0.36 * (0.6 + level * 0.4);
        const poolRy = (h - floor) * 0.3 * (0.5 + level * 0.5);
        ctx.fillStyle = ground(22);
        ctx.beginPath();
        ctx.ellipse(cx, poolY, w * 0.38, (h - floor) * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = liquid(26);
        ctx.beginPath();
        ctx.ellipse(cx, poolY, poolRx, poolRy, 0, 0, Math.PI * 2);
        ctx.fill();
        if (kind === "pool") {
          ctx.fillStyle = "rgba(255, 220, 150, 0.9)";
          ctx.beginPath();
          ctx.arc(w * 0.8, h * 0.2, 22, 0, Math.PI * 2);
          ctx.fill();
          for (let i = 0; i < 30; i++) {
            const a = rnd(i, 1) * Math.PI * 2;
            const k = 0.25 + rnd(i, 2) * 0.65;
            chip(c.elements[i % 10].sym, cx + Math.cos(a) * poolRx * k, poolY + Math.sin(a) * poolRy * k, 8, 0.95);
          }
        } else if (kind === "sky") {
          for (let i = 0; i < 5; i++) {
            ctx.fillStyle = "rgba(120, 124, 160, 0.55)";
            ctx.beginPath();
            ctx.ellipse(((rnd(i, 1) * w + t * 10) % (w + 160)) - 80, h * (0.12 + rnd(i, 2) * 0.16), 90, 22, 0, 0, Math.PI * 2);
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
            while (y < floor) {
              x += (rnd(strike, y) - 0.5) * 46;
              y += 22;
              ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.fillStyle = "rgba(255,255,255,0.08)";
            ctx.fillRect(0, 0, w, h);
          }
          for (let i = 0; i < 50; i++) {
            ctx.fillStyle = liquid(70, 0.5);
            ctx.fillRect(rnd(i, 4) * w, (rnd(i, 5) * floor + t * 160) % floor, 1.4, 8);
          }
        } else if (kind === "space") {
          for (let i = 0; i < 6; i++) {
            const life = (t * 0.45 + rnd(i, 1)) % 1;
            const sx = rnd(i, 2) * w * 0.8 + w * 0.25;
            const x = sx - life * w * 0.35;
            const y = life * floor;
            ctx.strokeStyle = `rgba(255, 196, 120, ${1 - life * 0.4})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 34, y - 60);
            ctx.stroke();
            if (life > 0.93) {
              ctx.fillStyle = "rgba(255, 220, 170, 0.8)";
              ctx.beginPath();
              ctx.arc(x, floor, 26 * (life - 0.9) * 10, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        } else {
          // mineral: tabakalar ve üzerlerinde dizilen parçacıklar
          for (let row = 0; row < 6; row++) {
            const y = floor - 12 - row * 22;
            ctx.strokeStyle = ground(34 + row * 3);
            ctx.lineWidth = 9;
            ctx.beginPath();
            ctx.moveTo(w * 0.12 + row * 8, y);
            ctx.lineTo(w * 0.88 - row * 8, y);
            ctx.stroke();
            for (let i = 0; i < 12; i++) {
              const settle = Math.min(1, p * 2.2);
              const tx = w * 0.16 + row * 8 + (i * (w * 0.68 - row * 16)) / 12;
              const x = tx + (rnd(i, row) - 0.5) * w * 0.5 * (1 - settle);
              chip(c.elements[(i + row) % 10].sym, x, y - 10 - (1 - settle) * rnd(i, row + 9) * h * 0.4, 5, 0.9);
            }
          }
        }
      }
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
      cell(ccx, ccy, rr * (1 + Math.sin(t * 2) * 0.02), 1, 1);
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
        ctx.fillText(k.toLocaleUpperCase("tr"), x, y - (narrow ? 0 : 9));
        ctx.font = `500 ${narrow ? 12.5 : 14.5}px Onest, system-ui, sans-serif`;
        ctx.fillStyle = "#f3f5fc";
        ctx.fillText(v, narrow ? x + 82 : x, y + (narrow ? 0 : 10));
        ctx.globalAlpha = 1;
      });
    } else {
      ctx.fillStyle = liquid(8);
      ctx.fillRect(0, 0, w, h);
      const split = Math.min(1, Math.max(0, (p - 0.25) * 2));
      const ease = split * split * (3 - 2 * split);
      const r = R * (0.75 - ease * 0.18);
      const dx = ease * R * 0.95;
      cell(cx - dx, cy, r, 1, 1);
      if (ease > 0.02) cell(cx + dx, cy, r, 1, 1);
    }
  }
}
