/**
 * Faz A — "Yeniden Başlat" kontrolü, artık gerçek bir DOM `<button>`
 * (`#dash-controls`'a eklenir), Pixi overlay hack'i değil.
 */
export class RestartButton {
  public readonly container: HTMLButtonElement;
  private onClickCallback: (() => void) | null = null;

  constructor() {
    this.container = document.createElement("button");
    this.container.className = "ctrl-btn-danger";
    this.container.textContent = "Yeniden Başlat";
    this.container.addEventListener("click", () => this.onClickCallback?.());
  }

  public onClick(cb: () => void): void {
    this.onClickCallback = cb;
  }
}
