import { BEHAVIORS, Creature, JUVENILE_AGE, MAX_CREATURES, SOUP_CAPACITY, STEP, SaveData, Sim } from "./sim";
import { Command, CreatureDetail, FLAG, Frame, HostMessage, PLANT_LAND_BIT, PLANT_SCALE, STRIDE, SpeciesInfo, UiPayload } from "./protocol";
import { EVOLUTION_SPEEDS, Genome, cloneGenome } from "./genome";

/**
 * Simülasyonun sahibi. Web Worker içinde çalışır (bkz. worker.ts); Worker
 * kurulamazsa aynı sınıf ana iş parçacığında da çalışabilir (bkz. client.ts).
 * Komutları uygular, zamanı ilerletir, her tur çizim için bir kare yayınlar.
 */

const STEP_BUDGET_MS = 11;
const UI_INTERVAL_MS = 380;
const SNAPSHOT_INTERVAL = 60;
const SNAPSHOT_CAP = 24;

const now = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

export class SimHost {
  private sim: Sim | null = null;
  private epoch = 0;
  private speed = 1;
  private acc = 0;
  private dirty = true;
  private uiDue = 0;
  private uiNow = true;
  private sent = new Map<number, number>();
  private lastEventSeq = 0;
  private selectedId = 0;
  private lastSelected: Genome | null = null;
  private speciesId = 0;
  private fossilSent = -1;
  private snaps: { t: number; data: string }[] = [];
  private snapT = 0;
  private rateT = 0;
  private rateSim = 0;
  private rate = 0;

  constructor(private readonly emit: (msg: HostMessage, transfer?: Transferable[]) => void) {}

  private replace(sim: Sim, keepSnaps = false): void {
    this.sim = sim;
    this.epoch++;
    this.sent.clear();
    this.lastEventSeq = 0;
    this.selectedId = 0;
    this.lastSelected = null;
    this.speciesId = 0;
    this.fossilSent = -1;
    this.acc = 0;
    if (!keepSnaps) this.snaps = [];
    this.snapT = sim.time;
    this.dirty = true;
    this.uiNow = true;
  }

  public handle(cmd: Command): void {
    try {
      this.apply(cmd);
    } catch (error) {
      this.emit({ type: "note", text: error instanceof Error ? error.message : String(error) });
    }
  }

  private apply(cmd: Command): void {
    if (cmd.type === "init") return this.replace(new Sim(cmd.seed));
    if (cmd.type === "load") return this.replace(Sim.load(cmd.data));
    const sim = this.sim;
    if (!sim) return;
    this.dirty = true;
    this.uiNow = true;
    switch (cmd.type) {
      case "speed":
        this.speed = Math.max(0, Math.min(64, cmd.value));
        this.acc = 0;
        break;
      case "select":
        this.selectedId = cmd.id;
        this.lastSelected = null;
        break;
      case "species":
        this.speciesId = cmd.id;
        break;
      case "trigger":
        if (!sim.trigger(cmd.kind, cmd.x !== undefined && cmd.y !== undefined ? { x: cmd.x, y: cmd.y } : undefined)) this.emit({ type: "note", text: "Bu olay zaten sürüyor." });
        break;
      case "plants":
        if (sim.addPlants(cmd.x, cmd.y) === 0 && !cmd.drag) this.emit({ type: "note", text: "Buraya bitki ekilemez." });
        break;
      case "soup":
        if (sim.addSoup(cmd.x, cmd.y) === 0 && !cmd.drag) this.emit({ type: "note", text: "Besin yalnızca suya eklenir." });
        break;
      case "radiate":
        if (sim.irradiate(cmd.x, cmd.y) === 0 && !cmd.drag) this.emit({ type: "note", text: "Burada canlı yok." });
        break;
      case "place": {
        const id = sim.placeCreature(cmd.x, cmd.y, cmd.template);
        if (id === null && !cmd.drag) this.emit({ type: "note", text: sim.creatures.length >= MAX_CREATURES ? `Canlı sınırına ulaşıldı (${MAX_CREATURES}).` : "Bu canlı bu arazide yaşayamaz." });
        break;
      }
      case "line":
        if (!sim.markLine(cmd.id)) this.emit({ type: "note", text: "Bu canlı artık yaşamıyor." });
        break;
      case "remove":
        sim.removeCreature(cmd.id);
        break;
      case "organ":
        if (!sim.editOrgan(cmd.id, cmd.organ, cmd.power)) this.emit({ type: "note", text: "Organ eklenemedi: boş yuva yok ya da canlının düzeyi yetersiz." });
        break;
      case "stage":
        sim.editStage(cmd.id, cmd.stage);
        break;
      case "set":
        if (cmd.autoEvents !== undefined) sim.autoEvents = cmd.autoEvents;
        if (cmd.rescueEnabled !== undefined) sim.rescueEnabled = cmd.rescueEnabled;
        if (cmd.evolutionSpeed !== undefined && EVOLUTION_SPEEDS.includes(cmd.evolutionSpeed)) sim.setEvolutionSpeed(cmd.evolutionSpeed);
        if (cmd.nutrientMultiplier !== undefined) sim.nutrientMultiplier = Math.max(0.2, Math.min(3, cmd.nutrientMultiplier));
        break;
      case "save":
        this.emit({ type: "saved", req: cmd.req, data: JSON.parse(JSON.stringify(sim.serialize())) as SaveData });
        break;
      case "rewind": {
        const snap = this.snaps[cmd.index];
        if (!snap) break;
        this.snaps.length = cmd.index + 1;
        this.replace(Sim.load(JSON.parse(snap.data) as SaveData), true);
        break;
      }
    }
  }

  /** Gerçek zamanda `elapsedMs` geçti: simülasyonu ilerlet ve kare yayınla. */
  public tick(elapsedMs: number): void {
    const sim = this.sim;
    if (!sim) return;
    let stepped = 0;
    if (this.speed > 0 && !sim.extinct) {
      this.acc += (Math.min(elapsedMs, 100) / 1000) * this.speed;
      const start = now();
      while (this.acc >= STEP) {
        sim.step();
        this.acc -= STEP;
        stepped++;
        if ((stepped & 3) === 0 && now() - start > STEP_BUDGET_MS) {
          // Makine bu hıza yetişemiyor: birikmiş zamanı bırak, donma olmasın.
          this.acc = 0;
          break;
        }
      }
      if (sim.time - this.snapT >= SNAPSHOT_INTERVAL) this.snapshot(sim);
    }
    this.rateSim += stepped * STEP;
    this.rateT += elapsedMs;
    if (this.rateT >= 1000) {
      this.rate = this.rateSim / (this.rateT / 1000);
      this.rateSim = 0;
      this.rateT = 0;
    }
    this.uiDue -= elapsedMs;
    const ui = this.uiNow || (this.uiDue <= 0 && (stepped > 0 || this.dirty));
    if (stepped === 0 && !this.dirty && !ui) return;
    this.dirty = false;
    this.publish(sim, ui);
  }

  /** Zaman yolculuğu için anlık kayıt. Liste dolunca eski kayıtlar seyreltilir. */
  private snapshot(sim: Sim): void {
    this.snapT = sim.time;
    this.snaps.push({ t: sim.time, data: JSON.stringify(sim.serialize()) });
    if (this.snaps.length > SNAPSHOT_CAP) {
      const half = this.snaps.length >> 1;
      this.snaps = this.snaps.filter((_, i) => i >= half || i % 2 === 0);
    }
  }

  private publish(sim: Sim, withUi: boolean): void {
    const list = sim.creatures;
    const c = new Float32Array(list.length * STRIDE);
    const genomes: [number, number, Genome][] = [];
    let n = 0;
    for (const k of list) {
      if (!k.alive) continue;
      const o = n * STRIDE;
      c[o] = k.id;
      c[o + 1] = k.x;
      c[o + 2] = k.y;
      c[o + 3] = k.heading;
      c[o + 4] = k.energy / k.maxEnergy;
      c[o + 5] = k.hp / k.maxHp;
      c[o + 6] =
        (k.onLand ? FLAG.land : 0) | (k.infectedT > 0 ? FLAG.infected : 0) | (k.flashT > 0 ? FLAG.flash : 0) | (k.hurtT > 0 ? FLAG.hurt : 0) | (k.bornT > 0 ? FLAG.born : 0) | (k.immuneT > 0 ? FLAG.immune : 0) | (k.host ? FLAG.attached : 0) | (k.cover >= 0.5 ? FLAG.hidden : 0) | (sim.isInLine(k.id) ? FLAG.line : 0);
      c[o + 7] = BEHAVIORS.indexOf(k.state);
      c[o + 8] = Math.min(1, k.age / JUVENILE_AGE);
      if (this.sent.get(k.id) !== k.gv) {
        this.sent.set(k.id, k.gv);
        genomes.push([k.id, k.gv, k.g]);
      }
      n++;
    }
    const plants = new Uint16Array(sim.nutrients.length * 2);
    for (let i = 0; i < sim.nutrients.length; i++) {
      const p = sim.nutrients[i];
      plants[i * 2] = Math.round(p.x * PLANT_SCALE);
      plants[i * 2 + 1] = Math.round(p.y * PLANT_SCALE) | (p.land ? PLANT_LAND_BIT : 0);
    }
    const corpses = new Float32Array(sim.corpses.length * 5);
    for (let i = 0; i < sim.corpses.length; i++) {
      const k = sim.corpses[i];
      corpses.set([k.x, k.y, k.r, Math.max(0, k.energy / k.energy0), k.hue], i * 5);
    }
    const eggs = new Float32Array(sim.eggs.length * 2);
    for (let i = 0; i < sim.eggs.length; i++) eggs.set([sim.eggs[i].x, sim.eggs[i].y], i * 2);

    const frame: Frame = {
      type: "frame",
      epoch: this.epoch,
      seed: sim.world.seed,
      time: sim.time,
      light: sim.light(),
      n,
      c,
      plants,
      corpses,
      eggs,
      flashes: sim.flashes,
      genomes,
      worldVersion: sim.world.version,
      quakes: sim.world.quakes.map((q) => ({ x: q.gx * 5, y: q.gy * 5, r: q.gr * 5, toWater: q.toWater })),
      ui: withUi ? this.ui(sim) : null,
    };
    if (withUi) {
      this.uiNow = false;
      this.uiDue = UI_INTERVAL_MS;
      // Ölenlerin genom kaydı bırakılır (bellek sızmasın).
      if (this.sent.size > list.length * 2 + 64) {
        const alive = new Set<number>();
        for (const k of list) alive.add(k.id);
        for (const id of this.sent.keys()) if (!alive.has(id)) this.sent.delete(id);
      }
    }
    this.emit(frame, [c.buffer, plants.buffer, corpses.buffer, eggs.buffer]);
  }

  private detail(sim: Sim): CreatureDetail | null {
    if (!this.selectedId) return null;
    const k: Creature | null = sim.findCreature(this.selectedId);
    const inspection = sim.inspect(this.selectedId);
    if (!k) {
      if (!this.lastSelected) return null;
      return { id: this.selectedId, alive: false, gv: -1, genome: this.lastSelected, x: 0, y: 0, energy: 0, maxEnergy: 1, hp: 0, maxHp: 1, age: 0, state: "wander", onLand: false, infected: 0, immune: 0, parasites: 0, hostId: 0, sense: 0, speed: 0, metabolism: 0, attack: 0, inspection };
    }
    this.lastSelected = cloneGenome(k.g);
    return {
      id: k.id,
      alive: true,
      gv: k.gv,
      genome: k.g,
      x: k.x,
      y: k.y,
      energy: k.energy,
      maxEnergy: k.maxEnergy,
      hp: k.hp,
      maxHp: k.maxHp,
      age: k.age,
      state: k.state,
      onLand: k.onLand,
      infected: Math.max(0, k.infectedT),
      immune: Math.max(0, k.immuneT),
      parasites: k.parasites,
      hostId: k.host && k.host.alive ? k.host.id : 0,
      sense: k.senseNow,
      speed: k.onLand && k.d.walk > 0 ? k.d.walk : k.d.swim,
      metabolism: k.g.metabolism * k.d.meta,
      attack: k.d.attack,
      inspection,
    };
  }

  private ui(sim: Sim): UiPayload {
    const stages: [number, number, number] = [0, 0, 0];
    let onLand = 0;
    let sexual = 0;
    let infected = 0;
    for (const k of sim.creatures) {
      stages[k.g.stage]++;
      if (k.onLand) onLand++;
      if (k.g.reproductionStrategy === "sexual") sexual++;
      if (k.infectedT > 0) infected++;
    }
    const species: SpeciesInfo[] = [];
    for (const s of sim.species.values()) {
      species.push({ id: s.id, name: s.name, parentId: s.parentId, born: s.born, extinct: s.extinct, count: s.count, peak: s.peak, total: s.total, established: s.established, reason: s.reason, diet: s.type.diet, hue: s.type.hue, stage: s.type.stage, infected: s.infected });
    }
    const events = sim.events.filter((e) => e.seq > this.lastEventSeq);
    this.lastEventSeq = sim.eventSeq;
    const soup = new Uint8Array(sim.soup.length);
    for (let i = 0; i < soup.length; i++) soup[i] = Math.min(255, Math.round((sim.soup[i] / (SOUP_CAPACITY * 3)) * 255));
    const stats = this.speciesId ? sim.speciesStats(this.speciesId) : null;
    const sp = stats ? sim.species.get(this.speciesId) : undefined;
    return {
      births: sim.births,
      deaths: sim.deaths,
      maxGeneration: sim.maxGeneration,
      immigrants: sim.immigrants,
      extinct: sim.extinct,
      onLand,
      eggs: sim.eggs.length,
      stages,
      sexual,
      infected,
      oxygen: sim.oxygen(),
      climate: sim.climate ? { warm: sim.climate.warm, left: sim.climate.left } : null,
      wind: sim.wind ? { angle: sim.wind.angle, left: sim.wind.left } : null,
      quakeLeft: Math.max(0, sim.quakeLeft),
      diets: sim.dietCounts(),
      organs: sim.organCounts(),
      species,
      history: sim.history,
      events,
      milestones: sim.milestones,
      line: sim.lineStats(),
      fossils: this.fossilSent === sim.fossilVersion ? null : ((this.fossilSent = sim.fossilVersion), sim.fossils()),
      snaps: this.snaps.map((s) => s.t),
      autoEvents: sim.autoEvents,
      rescueEnabled: sim.rescueEnabled,
      evolutionSpeed: sim.evolutionSpeed,
      nutrientMultiplier: sim.nutrientMultiplier,
      speed: this.speed,
      selected: this.detail(sim),
      speciesDetail: stats && sp ? { ...stats, type: sp.type } : null,
      soup,
      origin: sim.species.get(1)?.type ?? null,
      rate: this.rate,
    };
  }
}
