/**
 * Başlangıç menüsü: ilk açılışta tanıtım slaytları kendiliğinden döner, arkada sürüklenen hücreler çizilir.
 * Yalnızca arayüz canlandırmasıdır; simülasyonla ilgisi yoktur.
 */
export class StartMenu {
  private index = 0;
  private timer = 0;
  private raf = 0;
  private leaving = false;
  private leaveTimer = 0;
  private runSeq: (() => void) | null = null;
  private stopInput: (() => void) | null = null;
  private dots: HTMLElement[] = [];

  constructor(
    private readonly root: HTMLElement,
    private readonly onChoice: (what: "go" | "refs") => void,
  ) {
    const slides = Array.from(root.querySelectorAll<HTMLElement>(".start-slide"));
    const dotBox = root.querySelector<HTMLElement>("#start-dots")!;
    slides.forEach((_, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "";
      b.setAttribute("aria-label", String(i + 1));
      b.addEventListener("click", () => this.show(i, true));
      dotBox.appendChild(b);
      this.dots.push(b);
    });
    // Başla'ya basılan noktada uzuvlar çıkar (yaklaşık 3 sn); sonra menü aşağı doğru sönerek gezegen ekranına geçilir.
    // Bekleme sırasında Başla'ya bir kez daha basmak geçişi hemen yapar.
    root.querySelector("#start-go")!.addEventListener("click", () => {
      if (this.leaving) {
        window.clearTimeout(this.leaveTimer);
        this.finish();
        return;
      }
      this.leaving = true;
      this.runSeq?.();
      this.leaveTimer = window.setTimeout(() => this.finish(), 2700);
    });
    root.querySelector("#start-refs")!.addEventListener("click", () => this.onChoice("refs"));
  }

  public open(): void {
    document.getElementById("app")?.classList.add("hold");
    this.root.classList.remove("leaving");
    this.leaving = false;
    this.root.hidden = false;
    this.show(0, false);
    cancelAnimationFrame(this.raf);
    this.stopInput?.();
    this.draw();
  }

  private finish(): void {
    this.root.classList.add("leaving");
    this.leaveTimer = window.setTimeout(() => {
      this.leaving = false;
      this.choose("go");
    }, 450);
  }

  private choose(what: "go"): void {
    this.root.hidden = true;
    window.clearTimeout(this.timer);
    cancelAnimationFrame(this.raf);
    this.stopInput?.();
    this.onChoice(what);
  }

  private show(i: number, manual: boolean): void {
    const slides = this.root.querySelectorAll<HTMLElement>(".start-slide");
    this.index = (i + slides.length) % slides.length;
    slides.forEach((s, k) => s.classList.toggle("on", k === this.index));
    this.dots.forEach((d, k) => d.classList.toggle("on", k === this.index));
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.show(this.index + 1, false), manual ? 12000 : 7000);
  }

  private draw(): void {
    const canvas = this.root.querySelector<HTMLCanvasElement>("#start-bg")!;
    const ctx = canvas.getContext("2d")!;
    let seed = 12345;
    const rnd = (): number => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    interface Ball {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      m: number;
      phase: number;
      h: number;
      /** Başla'ya basılınca çıkan organlar: yön ve boy. */
      org: { a: number; len: number }[];
      /** Mutasyonla alacağı renk (-1: değişmez). */
      mut: number;
      /** Enerjisi çekilme oranı (0..1). */
      drain: number;
    }
    const balls: Ball[] = Array.from({ length: 46 }, () => {
      const r = 5 + rnd() * 16;
      const a = rnd() * Math.PI * 2;
      const v = 0.015 + rnd() * 0.03;
      return { x: rnd(), y: rnd(), vx: Math.cos(a) * v, vy: Math.sin(a) * v, r, m: r * r, phase: rnd() * 6.28,
        h: rnd() < 0.5 ? 168 : 252,
        org: Array.from({ length: 3 + Math.floor(rnd() * 3) }, () => ({ a: rnd() * 6.28, len: 0.55 + rnd() * 0.7 })),
        mut: rnd() < 0.45 ? [24, 330, 52, 200][Math.floor(rnd() * 4)] : -1,
        drain: 0,
      };
    });
    let placed = false;
    let last = 0;
    // Basılı tutulan nokta: toplar oraya çekilir; kısa bir halka basılan yeri gösterir.
    // Kısa bir tıklama da yeter: basılı değilse çekim yaklaşık 3 sn içinde zayıflayarak sürer.
    let pull: { x: number; y: number } | null = null;
    let pressed = false;
    let releasedAt = 0;
    // Basılan noktada büyüyen, dalgalanan uzuvlar (yaklaşık 3 sn yaşar, son 0,8 sn'de söner).
    // "Başla" dizisi: toplar titrer, organ çıkarır, bazıları mutasyonla renk değiştirir; düğmeden çıkan uzuvlar birkaç
    // hücreye saplanıp enerjilerini çekmeye başlar.
    let seq: { t0: number; targets: Ball[]; ox: number; oy: number } | null = null;
    this.runSeq = (): void => {
      const btn = this.root.querySelector<HTMLElement>("#start-go");
      if (!btn || seq) return;
      const br = btn.getBoundingClientRect();
      const cr = canvas.getBoundingClientRect();
      const ox = br.left + br.width / 2 - cr.left;
      const oy = br.top + br.height / 2 - cr.top;
      const targets = [...balls].sort((a, b) => Math.hypot(a.x - ox, a.y - oy) - Math.hypot(b.x - ox, b.y - oy)).slice(0, 4);
      seq = { t0: performance.now(), targets, ox, oy };
    };
    const limbs: { x: number; y: number; t0: number; base: number }[] = [];
    const LIMB_LIFE = 3000;
    const where = (e: PointerEvent): { x: number; y: number } => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onDown = (e: PointerEvent): void => {
      // Düğmeye basılınca toplar o düğmenin ortasına doğru toplanır.
      const btn = (e.target as HTMLElement).closest("button, a, input, select");
      if (btn && btn.id === "start-go") {
        return;
      }
      if (btn) {
        const br = btn.getBoundingClientRect();
        const cr = canvas.getBoundingClientRect();
        pull = { x: br.left + br.width / 2 - cr.left, y: br.top + br.height / 2 - cr.top };
      } else pull = where(e);
      pressed = true;
      // Uzuvlar toplanma noktasında değil, basılan noktada çıkar.
      const at = where(e);
      limbs.push({ x: at.x, y: at.y, t0: performance.now(), base: Math.random() * 6.28 });
    };
    const onMove = (e: PointerEvent): void => {
      if (pressed && !(e.target as HTMLElement).closest("button, a, input, select")) pull = where(e);
    };
    const onUp = (): void => {
      if (!pressed) return;
      pressed = false;
      releasedAt = performance.now();
    };
    this.root.addEventListener("pointerdown", onDown);
    this.root.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    this.stopInput = (): void => {
      this.root.removeEventListener("pointerdown", onDown);
      this.root.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      pull = null;
      pressed = false;
    };
    const step = (t: number): void => {
      const dt = Math.min(40, last ? t - last : 16);
      last = t;
      const w = (canvas.width = canvas.clientWidth);
      const h = (canvas.height = canvas.clientHeight);
      if (!placed) {
        for (const b of balls) {
          b.x *= w;
          b.y *= h;
        }
        placed = true;
      }
      ctx.clearRect(0, 0, w, h);
      let power = 0;
      if (pull) {
        power = pressed ? 1 : Math.max(0, 1 - (performance.now() - releasedAt) / 3000);
        if (power === 0) pull = null;
      }
      for (const b of balls) {
        if (pull) {
          const dx = pull.x - b.x;
          const dy = pull.y - b.y;
          const d = Math.max(30, Math.hypot(dx, dy));
          const a = 0.0022 * power * Math.min(1, 320 / d) * dt;
          b.vx += (dx / d) * a;
          b.vy += (dy / d) * a;
          // Çekim yerinde toplar birbirine yığılmasın diye hız hafifçe sönümlenir.
          const damp = Math.pow(0.9985, dt);
          b.vx *= damp;
          b.vy *= damp;
        } else {
          // Serbest bırakılınca yavaşça eski süzülmeye döner: hız, taban hıza doğru yumuşar.
          const sp = Math.hypot(b.vx, b.vy) || 0.0001;
          const target = 0.03;
          const k = 1 + (target / sp - 1) * Math.min(1, dt * 0.0006);
          b.vx *= k;
          b.vy *= k;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < b.r) {
          b.x = b.r;
          b.vx = Math.abs(b.vx);
        } else if (b.x > w - b.r) {
          b.x = w - b.r;
          b.vx = -Math.abs(b.vx);
        }
        if (b.y < b.r) {
          b.y = b.r;
          b.vy = Math.abs(b.vy);
        } else if (b.y > h - b.r) {
          b.y = h - b.r;
          b.vy = -Math.abs(b.vy);
        }
      }
      // Çarpışmalar: örtüşme ayrılır, normal doğrultudaki hızlar kütleye göre esnek olarak değişir.
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i];
          const c = balls[j];
          const dx = c.x - a.x;
          const dy = c.y - a.y;
          const min = a.r + c.r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 === 0) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d;
          const ny = dy / d;
          const push = (min - d) / (a.m + c.m);
          a.x -= nx * push * c.m;
          a.y -= ny * push * c.m;
          c.x += nx * push * a.m;
          c.y += ny * push * a.m;
          const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
          if (rel < 0) {
            const imp = (2 * rel) / (a.m + c.m);
            a.vx += imp * c.m * nx;
            a.vy += imp * c.m * ny;
            c.vx -= imp * a.m * nx;
            c.vy -= imp * a.m * ny;
          }
        }
      }
      const nowT = performance.now();
      const sq = seq ? nowT - seq.t0 : 0;
      const org = seq ? Math.min(1, sq / 1100) : 0;
      const mutP = seq ? Math.min(1, Math.max(0, (sq - 300) / 700)) : 0;
      for (const b of balls) {
        // Titreme: dizi başlayınca giderek artar.
        const amp = seq ? 0.4 + 2.6 * org : 0;
        const bx = b.x + Math.sin(t * 0.083 + b.phase * 7) * amp;
        const by = b.y + Math.cos(t * 0.091 + b.phase * 5) * amp;
        const hue = b.mut >= 0 ? b.h + (b.mut - b.h) * mutP : b.h;
        const keep = 1 - 0.55 * b.drain;
        const pulseR = b.r * (1 + 0.06 * Math.sin(t / 900 + b.phase * 9)) * (1 - 0.12 * b.drain);
        if (org > 0) {
          // Organlar: kısa, dalgalı çıkıntılar ve uçlarında küçük kesecikler.
          for (const o of b.org) {
            const len = b.r * (0.5 + 0.9 * o.len) * org;
            const ca = Math.cos(o.a);
            const sa = Math.sin(o.a);
            const wob = Math.sin(t / 210 + o.a * 3) * 2;
            const ex = bx + ca * (pulseR + len) - sa * wob;
            const ey = by + sa * (pulseR + len) + ca * wob;
            ctx.beginPath();
            ctx.moveTo(bx + ca * pulseR, by + sa * pulseR);
            ctx.lineTo(ex, ey);
            ctx.lineWidth = 1.4;
            ctx.strokeStyle = `hsla(${hue},80%,72%,${0.5 * keep})`;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(ex, ey, 1.6 + 1.4 * o.len * org, 0, 6.2832);
            ctx.fillStyle = `hsla(${hue},85%,78%,${0.6 * keep})`;
            ctx.fill();
          }
        }
        ctx.beginPath();
        ctx.arc(bx, by, pulseR, 0, 6.2832);
        ctx.fillStyle = `hsla(${hue},70%,60%,${0.07 + (b.mut >= 0 ? 0.1 * mutP : 0)})`;
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = `hsla(${hue},80%,70%,${0.28 + (b.mut >= 0 ? 0.3 * mutP : 0)})`;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(bx, by, b.r * 0.28 * (1 + 0.5 * org), 0, 6.2832);
        ctx.fillStyle = `hsla(${hue},80%,75%,${0.35 * keep + (b.mut >= 0 ? 0.25 * mutP : 0)})`;
        ctx.fill();
      }
      if (seq) {
        // Düğmeden çıkan uzuvlar: hedef hücreye uzanır (0,3-1,8 sn), saplanır, enerji çekilir (1,8 sn sonrası).
        const sx = seq.ox;
        const sy = seq.oy;
        const reach = Math.min(1, Math.max(0, (sq - 300) / 1500));
        const g = 1 - Math.pow(1 - reach, 3);
        const drainP = Math.min(1, Math.max(0, (sq - 1800) / 800));
        const waveAt = (f: number, k: number): number => Math.sin(f * 7 - t / 190 + k * 1.3) * 14 * Math.sin(Math.PI * Math.min(1, f * 1.2));
        seq.targets.forEach((tb, k) => {
          tb.drain = drainP;
          const dx = tb.x - sx;
          const dy = tb.y - sy;
          const dist = Math.hypot(dx, dy) || 1;
          const nx = -dy / dist;
          const ny = dx / dist;
          const calm = g >= 1 ? 0.3 : 1;
          const segs = 22;
          const pts: { x: number; y: number }[] = [];
          for (let q = 0; q <= segs; q++) {
            const f = (q / segs) * g;
            const w = waveAt(f, k) * calm;
            pts.push({ x: sx + dx * f + nx * w, y: sy + dy * f + ny * w });
          }
          for (let q = 1; q < pts.length; q++) {
            const f = q / pts.length;
            ctx.beginPath();
            ctx.moveTo(pts[q - 1].x, pts[q - 1].y);
            ctx.lineTo(pts[q].x, pts[q].y);
            ctx.lineWidth = 1 + 4.2 * (1 - f);
            ctx.lineCap = "round";
            ctx.strokeStyle = `hsla(${k % 2 ? 168 : 190},85%,72%,0.7)`;
            ctx.stroke();
          }
          const tip = pts[pts.length - 1];
          if (g >= 1) {
            // Saplanma: hücrenin içine giren uç ve yayılan halka.
            const ring = Math.min(1, (sq - 1800) / 600);
            ctx.beginPath();
            ctx.arc(tip.x, tip.y, tb.r * (0.4 + 1.1 * ring), 0, 6.2832);
            ctx.strokeStyle = `hsla(168,90%,80%,${0.6 * (1 - ring)})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(tip.x, tip.y, 3.2, 0, 6.2832);
            ctx.fillStyle = "hsla(168,95%,85%,0.95)";
            ctx.fill();
            if (drainP > 0) {
              // Hücreden düğmeye doğru akan enerji parçacıkları.
              for (let j = 0; j < 3; j++) {
                const f = 1 - ((t / 520 + j / 3 + k * 0.21) % 1);
                const w = waveAt(f, k) * calm;
                ctx.beginPath();
                ctx.arc(sx + dx * f + nx * w, sy + dy * f + ny * w, 2.6, 0, 6.2832);
                ctx.fillStyle = `hsla(52,95%,72%,${0.9 * drainP})`;
                ctx.fill();
              }
            }
          } else {
            ctx.beginPath();
            ctx.arc(tip.x, tip.y, 3, 0, 6.2832);
            ctx.fillStyle = "hsla(168,90%,85%,0.9)";
            ctx.fill();
          }
        });
      }
      const now = performance.now();
      for (let li = limbs.length - 1; li >= 0; li--) {
        const L = limbs[li];
        const age = now - L.t0;
        if (age > LIMB_LIFE) {
          limbs.splice(li, 1);
          continue;
        }
        const grow = 1 - Math.pow(1 - Math.min(1, age / 1300), 3);
        const fade = age > LIMB_LIFE - 800 ? (LIMB_LIFE - age) / 800 : 1;
        const arms = 8;
        for (let k = 0; k < arms; k++) {
          const ang = L.base + (k * Math.PI * 2) / arms + 0.22 * Math.sin(t / 650 + k * 1.7);
          const len = (46 + (k % 3) * 22) * grow;
          const dx = Math.cos(ang);
          const dy = Math.sin(ang);
          const segs = 16;
          let px = L.x;
          let py = L.y;
          for (let sIdx = 1; sIdx <= segs; sIdx++) {
            const f = sIdx / segs;
            const wave = Math.sin(f * 5 - t / 240 + k) * 9 * f;
            const x = L.x + dx * len * f - dy * wave;
            const y = L.y + dy * len * f + dx * wave;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(x, y);
            ctx.lineWidth = Math.max(0.8, 5.5 * (1 - f) + 0.8);
            ctx.lineCap = "round";
            ctx.strokeStyle = `hsla(${k % 2 ? 168 : 252},80%,72%,${0.55 * fade})`;
            ctx.stroke();
            px = x;
            py = y;
          }
          ctx.beginPath();
          ctx.arc(px, py, 2.6, 0, 6.2832);
          ctx.fillStyle = `hsla(168,90%,80%,${0.8 * fade})`;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(L.x, L.y, 9 + 2 * Math.sin(t / 200), 0, 6.2832);
        ctx.fillStyle = `hsla(168,80%,70%,${0.35 * fade})`;
        ctx.fill();
      }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
}
