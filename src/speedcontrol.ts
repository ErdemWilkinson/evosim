/**
 * Faz A — Hız kontrolü, artık Pixi `Graphics`/`Text` overlay'i DEĞİL, gerçek bir DOM
 * buton grubu (`#dash-controls`'a eklenir). Önceki sürümdeki "Pixi'nin derin event-
 * target sistemi `app.stage.hitArea` ile çakışıyor" sorunu DOM'da hiç yok — gerçek
 * `<button>` elemanları kendi `click` olaylarını doğal şekilde alır.
 */

/** Desteklenen hız çarpanları — 0 = duraklat (pause). */
export type SpeedMultiplier = 0 | 1 | 2 | 4;

const OPTIONS: SpeedMultiplier[] = [0, 1, 2, 4];
const LABELS: Record<SpeedMultiplier, string> = {
  0: "II",
  1: "1x",
  2: "2x",
  4: "4x",
};

export class SpeedControl {
  public readonly container: HTMLElement;
  private current: SpeedMultiplier = 1;
  /** Pause'a girmeden önceki hız — Space/`togglePause` ile "resume" ederken buraya döner. */
  private lastActiveSpeed: SpeedMultiplier = 1;
  private readonly buttons: Map<SpeedMultiplier, HTMLButtonElement> = new Map();
  private onChangeCallback: ((speed: SpeedMultiplier) => void) | null = null;

  constructor() {
    this.container = document.createElement("div");
    this.container.className = "ctrl-group";

    for (const value of OPTIONS) {
      const btn = document.createElement("button");
      btn.className = "ctrl-btn";
      btn.textContent = LABELS[value];
      btn.addEventListener("click", () => this.setSpeed(value));
      this.container.appendChild(btn);
      this.buttons.set(value, btn);
    }

    this.redraw();
  }

  public getSpeed(): SpeedMultiplier {
    return this.current;
  }

  public onChange(cb: (speed: SpeedMultiplier) => void): void {
    this.onChangeCallback = cb;
  }

  public setSpeed(value: SpeedMultiplier): void {
    if (this.current === value) return;
    if (this.current !== 0) this.lastActiveSpeed = this.current;
    this.current = value;
    this.redraw();
    this.onChangeCallback?.(value);
  }

  /** Klavye kısayolu (Space) için: duraklıysa son aktif hıza döner, değilse duraklatır. */
  public togglePause(): void {
    this.setSpeed(this.current === 0 ? this.lastActiveSpeed : 0);
  }

  private redraw(): void {
    for (const [value, btn] of this.buttons) {
      btn.classList.toggle("active", value === this.current);
    }
  }
}
