import { SimHost } from "./host";
import { Command, Frame, HostMessage, STRIDE, UiPayload } from "./protocol";
import { Genome } from "./genome";
import { PlanetProfile, generatePlanetProfile } from "./planet";
import { SaveData, SimEvent } from "./sim";
import { World } from "./world";

/** Derleme sırasında gömülen Worker kaynağı (bkz. scripts/build.mjs). */
declare const __WORKER_SRC__: string;

/** Arayüzün elindeki dünya görüntüsü: son kare + biriken yardımcı veriler. */
export interface View {
  epoch: number;
  world: World;
  planet: PlanetProfile;
  frame: Frame;
  genomes: Map<number, Genome>;
  ui: UiPayload | null;
  events: SimEvent[];
}

const EVENT_CAP = 300;

/**
 * Simülasyonla konuşan uç. Simülasyon bir Web Worker'da çalışır; Worker
 * kurulamayan ortamlarda (kısıtlı gömme çerçeveleri) aynı kod ana iş parçacığında
 * çalışır — arayüz farkı görmez.
 */
export class Client {
  public view: View | null = null;
  public threaded = false;
  public onFrame: (view: View, fresh: boolean) => void = () => {};
  public onNote: (text: string) => void = () => {};
  private worker: Worker | null = null;
  private local: SimHost | null = null;
  private pending: Command[] = [];
  private confirmed = false;
  private saves = new Map<number, (data: SaveData) => void>();
  private saveSeq = 0;

  constructor() {
    try {
      const url = URL.createObjectURL(new Blob([__WORKER_SRC__], { type: "text/javascript" }));
      const worker = new Worker(url);
      worker.onmessage = (event: MessageEvent<HostMessage>) => {
        this.confirmed = true;
        this.pending = [];
        this.receive(event.data);
      };
      worker.onerror = () => {
        if (!this.confirmed) this.fallback();
      };
      this.worker = worker;
      this.threaded = true;
      // Worker sessiz kalırsa (ör. çerçeve politikası engellediyse) yerel kipe geç.
      setTimeout(() => {
        if (!this.confirmed) this.fallback();
      }, 2500);
    } catch {
      this.fallback();
    }
  }

  /** Worker çalışmadı: simülasyonu bu iş parçacığında kur ve bekleyen komutları yinele. */
  private fallback(): void {
    if (this.local) return;
    this.worker?.terminate();
    this.worker = null;
    this.threaded = false;
    const host = new SimHost((message) => this.receive(message));
    this.local = host;
    for (const cmd of this.pending) host.handle(cmd);
    this.pending = [];
    let last = performance.now();
    setInterval(() => {
      const t = performance.now();
      host.tick(t - last);
      last = t;
    }, 16);
  }

  public send(cmd: Command): void {
    if (this.local) return this.local.handle(cmd);
    if (!this.confirmed) this.pending.push(cmd);
    this.worker?.postMessage(cmd);
  }

  public save(): Promise<SaveData> {
    return new Promise((resolve) => {
      const req = ++this.saveSeq;
      this.saves.set(req, resolve);
      this.send({ type: "save", req });
    });
  }

  private receive(message: HostMessage): void {
    if (message.type === "ready") return;
    if (message.type === "note") return this.onNote(message.text);
    if (message.type === "saved") {
      this.saves.get(message.req)?.(message.data);
      this.saves.delete(message.req);
      return;
    }
    let view = this.view;
    const fresh = !view || view.epoch !== message.epoch;
    if (!view || fresh) {
      const world = new World(message.seed);
      view = { epoch: message.epoch, world, planet: generatePlanetProfile(world), frame: message, genomes: new Map(), ui: null, events: [] };
      this.view = view;
    }
    view.frame = message;
    for (const [id, , genome] of message.genomes) view.genomes.set(id, genome);
    if (view.world.version !== message.worldVersion || view.world.quakes.length !== message.quakes.length) {
      view.world.clearQuakes();
      for (const q of message.quakes) view.world.applyQuake(q.x, q.y, q.r, q.toWater);
      view.world.version = message.worldVersion;
    }
    if (message.ui) {
      view.ui = message.ui;
      if (message.ui.events.length > 0) {
        view.events.push(...message.ui.events);
        if (view.events.length > EVENT_CAP) view.events.splice(0, view.events.length - EVENT_CAP);
      }
      // Artık yaşamayanların genomları bırakılır.
      if (view.genomes.size > message.n * 2 + 64) {
        const alive = new Set<number>();
        for (let i = 0; i < message.n; i++) alive.add(message.c[i * STRIDE]);
        for (const id of view.genomes.keys()) if (!alive.has(id)) view.genomes.delete(id);
      }
    }
    this.onFrame(view, fresh);
  }
}
