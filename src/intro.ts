/**
 * Başlangıç menüsü: ilk açılışta tanıtım slaytları kendiliğinden döner, arkada sürüklenen hücreler çizilir.
 * Yalnızca arayüz canlandırmasıdır; simülasyonla ilgisi yoktur.
 */
export class StartMenu {
  private index = 0;
  private timer = 0;
  private raf = 0;
  private leaving = false;
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
    // Başla'ya basınca toplar düğmeye doğru akarken menü kısa bir an daha açık kalır.
    root.querySelector("#start-go")!.addEventListener("click", () => {
      if (this.leaving) return;
      this.leaving = true;
      window.setTimeout(() => {
        this.leaving = false;
        this.choose("go");
      }, 450);
    });
    root.querySelector("#start-refs")!.addEventListener("click", () => this.onChoice("refs"));
  }

  public open(): void {
    document.getElementById("app")?.classList.add("hold");
    this.root.hidden = false;
    this.show(0, false);
    cancelAnimationFrame(this.raf);
    this.stopInput?.();
    this.draw();
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
    }
    const balls: Ball[] = Array.from({ length: 46 }, () => {
      const r = 5 + rnd() * 16;
      const a = rnd() * Math.PI * 2;
      const v = 0.015 + rnd() * 0.03;
      return { x: rnd(), y: rnd(), vx: Math.cos(a) * v, vy: Math.sin(a) * v, r, m: r * r, phase: rnd() * 6.28, h: rnd() < 0.5 ? 168 : 252 };
    });
    let placed = false;
    let last = 0;
    // Basılı tutulan nokta: toplar oraya çekilir; kısa bir halka basılan yeri gösterir.
    // Kısa bir tıklama da yeter: basılı değilse çekim yaklaşık 3 sn içinde zayıflayarak sürer.
    let pull: { x: number; y: number } | null = null;
    let pressed = false;
    let releasedAt = 0;
    let pulse = 0;
    const where = (e: PointerEvent): { x: number; y: number } => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onDown = (e: PointerEvent): void => {
      // Düğmeye basılınca toplar o düğmenin ortasına doğru toplanır.
      const btn = (e.target as HTMLElement).closest("button, a, input, select");
      if (btn) {
        const br = btn.getBoundingClientRect();
        const cr = canvas.getBoundingClientRect();
        pull = { x: br.left + br.width / 2 - cr.left, y: br.top + br.height / 2 - cr.top };
        pressed = true;
        pulse = 1;
        return;
      }
      pull = where(e);
      pressed = true;
      pulse = 1;
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
      for (const b of balls) {
        const pulseR = b.r * (1 + 0.06 * Math.sin(t / 900 + b.phase * 9));
        ctx.beginPath();
        ctx.arc(b.x, b.y, pulseR, 0, 6.2832);
        ctx.fillStyle = `hsla(${b.h},70%,60%,0.07)`;
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = `hsla(${b.h},80%,70%,0.28)`;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 0.28, 0, 6.2832);
        ctx.fillStyle = `hsla(${b.h},80%,75%,0.35)`;
        ctx.fill();
      }
      if (pull && pulse > 0) {
        pulse = Math.max(0, pulse - dt / 500);
        ctx.beginPath();
        ctx.arc(pull.x, pull.y, 14 + (1 - pulse) * 60, 0, 6.2832);
        ctx.strokeStyle = `rgba(109,240,210,${0.5 * pulse})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
}
