/**
 * Başlangıç menüsü: ilk açılışta tanıtım slaytları kendiliğinden döner, arkada sürüklenen hücreler çizilir.
 * Yalnızca arayüz canlandırmasıdır; simülasyonla ilgisi yoktur.
 */
export class StartMenu {
  private index = 0;
  private timer = 0;
  private raf = 0;
  private dots: HTMLElement[] = [];

  constructor(
    private readonly root: HTMLElement,
    private readonly onChoice: (what: "go" | "tour" | "refs") => void,
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
    root.querySelector("#start-go")!.addEventListener("click", () => this.choose("go"));
    root.querySelector("#start-tour")!.addEventListener("click", () => this.choose("tour"));
    root.querySelector("#start-refs")!.addEventListener("click", () => this.onChoice("refs"));
  }

  public open(): void {
    document.body.classList.add("at-start");
    this.root.hidden = false;
    this.show(0, false);
    this.draw();
  }

  private choose(what: "go" | "tour"): void {
    this.root.hidden = true;
    window.clearTimeout(this.timer);
    cancelAnimationFrame(this.raf);
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
    const cells = Array.from({ length: 46 }, () => ({ x: rnd(), y: rnd(), r: 5 + rnd() * 16, a: rnd() * 6.28, v: 0.00003 + rnd() * 0.00007, h: rnd() < 0.5 ? 168 : 252 }));
    const step = (t: number): void => {
      const w = (canvas.width = canvas.clientWidth);
      const h = (canvas.height = canvas.clientHeight);
      ctx.clearRect(0, 0, w, h);
      for (const c of cells) {
        const x = ((c.x + Math.cos(c.a) * c.v * t + 1) % 1) * w;
        const y = ((c.y + Math.sin(c.a) * c.v * t + 1) % 1) * h;
        const pulse = 1 + 0.06 * Math.sin(t / 900 + c.a * 9);
        ctx.beginPath();
        ctx.arc(x, y, c.r * pulse, 0, 6.2832);
        ctx.fillStyle = `hsla(${c.h},70%,60%,0.07)`;
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = `hsla(${c.h},80%,70%,0.28)`;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, c.r * 0.28, 0, 6.2832);
        ctx.fillStyle = `hsla(${c.h},80%,75%,0.35)`;
        ctx.fill();
      }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
}
