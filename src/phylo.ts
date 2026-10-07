import { DIET_LABEL } from "./genome";
import { SpeciesInfo } from "./protocol";
import { Theme } from "./render";
import { esc, fmtTime } from "./ui";

/**
 * Soy ağacı: türlerin filogenisi. Yatay eksen zaman; her tür, ortaya çıktığı andan
 * tükendiği ana (ya da şimdiye) uzanan bir çizgi. Çizgi rengi beslenme biçimini,
 * kalınlığı türün ulaştığı en yüksek birey sayısını gösterir.
 */

const MIN_ROW = 24;
const MAX_ROW = 52;
const TOP = 40;
const LEFT = 16;
const LABEL_SPACE = 250;

interface Row {
  s: SpeciesInfo;
  y: number;
  parentY: number;
}

export class PhyloTree {
  private rows: Row[] = [];
  /** Satır yüksekliği: az tür varken pencereyi dolduracak kadar açılır. */
  private row = MIN_ROW;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly wrap: HTMLElement,
    private readonly tip: HTMLElement,
    private readonly count: HTMLElement,
    private readonly onPick: (speciesId: number) => void
  ) {
    canvas.addEventListener("pointermove", (e) => {
      const row = this.rowAt(e);
      if (!row) {
        this.tip.hidden = true;
        canvas.style.cursor = "default";
        return;
      }
      const s = row.s;
      canvas.style.cursor = "pointer";
      this.tip.innerHTML =
        `<div class="tip-title"><em>${esc(s.name)}</em></div>` +
        `<div class="tip-row"><span>${DIET_LABEL[s.diet]}</span><b>${s.count > 0 ? `${s.count} birey` : "tükendi"}</b></div>` +
        `<div class="tip-row"><span>Dönem</span><b>${fmtTime(s.born)} – ${s.extinct >= 0 ? fmtTime(s.extinct) : "şimdi"}</b></div>` +
        `<div class="tip-row"><span>En çok</span><b>${s.peak} birey</b></div>` +
        `<div class="tip-row"><span>Toplam</span><b>${s.total} doğum</b></div>` +
        `<div>Ayrılma: ${esc(s.reason)}</div>`;
      this.tip.hidden = false;
      const rect = this.wrap.getBoundingClientRect();
      const x = e.clientX - rect.left + this.wrap.scrollLeft;
      const y = e.clientY - rect.top + this.wrap.scrollTop;
      this.tip.style.left = `${Math.max(4, Math.min(this.canvas.clientWidth - this.tip.offsetWidth - 4, x + 14))}px`;
      this.tip.style.top = `${y + 16}px`;
    });
    canvas.addEventListener("pointerleave", () => (this.tip.hidden = true));
    canvas.addEventListener("click", (e) => {
      const row = this.rowAt(e);
      if (row) this.onPick(row.s.id);
    });
  }

  private rowAt(e: MouseEvent): Row | null {
    const rect = this.canvas.getBoundingClientRect();
    const index = Math.floor((e.clientY - rect.top - TOP) / this.row);
    return index >= 0 && index < this.rows.length ? this.rows[index] : null;
  }

  public draw(all: SpeciesInfo[], time: number, theme: Theme, onlyEstablished: boolean, onlyLiving: boolean): void {
    const byId = new Map(all.map((s) => [s.id, s]));
    const wanted = new Set<number>();
    for (const s of all) {
      if (onlyEstablished && !s.established) continue;
      if (onlyLiving && s.count === 0) continue;
      // Gösterilen her türün ataları da gösterilir; aksi halde dallar havada kalır.
      let cur: SpeciesInfo | undefined = s;
      while (cur && !wanted.has(cur.id)) {
        wanted.add(cur.id);
        cur = byId.get(cur.parentId);
      }
    }
    const children = new Map<number, SpeciesInfo[]>();
    const roots: SpeciesInfo[] = [];
    for (const s of all) {
      if (!wanted.has(s.id)) continue;
      if (s.parentId !== 0 && wanted.has(s.parentId)) {
        const list = children.get(s.parentId) ?? [];
        list.push(s);
        children.set(s.parentId, list);
      } else roots.push(s);
    }
    const available = this.wrap.clientHeight - 2;
    this.row = Math.min(MAX_ROW, Math.max(MIN_ROW, (available - TOP - 16) / Math.max(1, wanted.size)));
    this.rows = [];
    const place = (s: SpeciesInfo, parentY: number): void => {
      const y = TOP + (this.rows.length + 0.5) * this.row;
      this.rows.push({ s, y, parentY });
      const kids = (children.get(s.id) ?? []).sort((a, b) => b.born - a.born);
      for (const k of kids) place(k, y);
    };
    for (const r of roots.sort((a, b) => a.born - b.born)) place(r, -1);

    this.count.textContent = `${this.rows.length} tür gösteriliyor · toplam ${all.length}`;

    const W = Math.max(300, this.wrap.clientWidth - 2);
    const H = Math.max(available, TOP + this.rows.length * this.row + 16);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    const ctx = this.canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const t1 = Math.max(1, time);
    const plotW = W - LEFT - Math.min(LABEL_SPACE, W * 0.4);
    const X = (t: number): number => LEFT + (t / t1) * plotW;

    // Zaman ekseni
    const tickStep = [30, 60, 120, 300, 600, 1200, 1800, 3600, 7200, 14400].find((s) => t1 / s <= 8) ?? 28800;
    ctx.font = `11px "Onest", system-ui, sans-serif`;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "center";
    for (let t = 0; t <= t1; t += tickStep) {
      const x = Math.round(X(t)) + 0.5;
      ctx.strokeStyle = theme.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 24);
      ctx.lineTo(x, H - 6);
      ctx.stroke();
      ctx.fillStyle = theme.ink3;
      ctx.fillText(fmtTime(t), Math.max(22, x), 16);
    }

    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.lineCap = "butt";
    for (const row of this.rows) {
      const s = row.s;
      const x0 = X(s.born);
      const x1 = Math.max(x0 + 2, X(s.extinct >= 0 ? s.extinct : t1));
      const alive = s.count > 0;
      if (row.parentY >= 0) {
        ctx.strokeStyle = theme.ink3;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(x0) + 0.5, row.parentY);
        ctx.lineTo(Math.round(x0) + 0.5, row.y);
        ctx.stroke();
      }
      ctx.globalAlpha = alive ? 1 : 0.45;
      ctx.strokeStyle = theme.diet[s.diet];
      ctx.lineWidth = 2 + Math.min(8, Math.log2(Math.max(1, s.peak)) * 1.05);
      ctx.beginPath();
      ctx.moveTo(x0, row.y);
      ctx.lineTo(x1, row.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (!alive) {
        ctx.strokeStyle = theme.ink2;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(x1) + 3.5, row.y - 6);
        ctx.lineTo(Math.round(x1) + 3.5, row.y + 6);
        ctx.stroke();
      }
      ctx.font = `italic ${alive ? 500 : 400} 13px "Onest", system-ui, sans-serif`;
      ctx.fillStyle = alive ? theme.ink : theme.ink3;
      const label = alive ? `${s.name} · ${s.count}` : s.name;
      const width = ctx.measureText(label).width;
      ctx.fillText(label, Math.min(x1 + 10, W - width - 6), row.y);
    }
  }
}
