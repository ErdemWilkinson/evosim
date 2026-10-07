import { DEATH_LABEL, DeathCause } from "./sim";
import { UiPayload } from "./protocol";
import { esc, fmtTime } from "./ui";

/**
 * Tahmin soruları: yalnızca arayüzde yaşar, benzetim durumuna dokunmaz ve rastgelelik kullanmaz.
 * Soru, o anki türlerden sırayla üretilir; süre dolunca ölçülen sayılarla sonuçlanır.
 */

const WINDOW = 120;
const COOLDOWN = 45;
const FIRST_AT = 90;
const NEUTRAL = 0.1;

type Kind = "grow" | "survive";
type Guess = "up" | "down" | "yes" | "no";

interface Active {
  kind: Kind;
  speciesId: number;
  name: string;
  t0: number;
  due: number;
  base: number;
  deaths0: Record<string, number>;
  guess: Guess | "";
}

interface Result {
  kind: Kind;
  name: string;
  verdict: "right" | "wrong" | "neutral";
  base: number;
  now: number;
  cause: DeathCause | "";
  causeN: number;
  guess: Guess;
}

/** Tahmin soruları Oyun moduyla birlikte açılır (bkz. main.ts setGameMode). */
let enabled = false;

let active: Active | null = null;
let last: Result | null = null;
let lastEnd = 0;
let counter = 0;
let right = 0;
let total = 0;

export function predictEnabled(): boolean {
  return enabled;
}

export function setPredictEnabled(on: boolean): void {
  enabled = on;
  if (!on) active = null;
}

/** Yeni dünya, kayıt yükleme veya geri sarma: bekleyen soru anlamını yitirir. */
export function resetPredict(): void {
  active = null;
  last = null;
  lastEnd = 0;
}

export function answerPredict(g: string): void {
  if (active && active.guess === "" && (g === "up" || g === "down" || g === "yes" || g === "no")) active.guess = g;
}

function nextQuestion(ui: UiPayload, time: number): void {
  const living = ui.species.filter((s) => s.established && s.count > 0);
  const big = living.filter((s) => s.count >= 6).sort((a, b) => a.id - b.id);
  const small = living.filter((s) => s.count <= 5).sort((a, b) => a.id - b.id);
  const wantSurvive = counter % 2 === 1 && small.length > 0;
  const pool = wantSurvive ? small : big;
  if (pool.length === 0) return;
  const sp = pool[Math.floor(counter / 2) % pool.length];
  counter++;
  active = { kind: wantSurvive ? "survive" : "grow", speciesId: sp.id, name: sp.name, t0: time, due: time + WINDOW, base: sp.count, deaths0: { ...ui.deaths }, guess: "" };
}

function resolve(ui: UiPayload, a: Active, time: number): void {
  const now = ui.species.find((s) => s.id === a.speciesId)?.count ?? 0;
  let verdict: Result["verdict"] = "neutral";
  if (a.guess !== "") {
    if (a.kind === "survive") verdict = (a.guess === "yes") === now > 0 ? "right" : "wrong";
    else if (Math.abs(now - a.base) / Math.max(1, a.base) >= NEUTRAL) verdict = (a.guess === "up") === now > a.base ? "right" : "wrong";
  }
  let cause: DeathCause | "" = "";
  let causeN = 0;
  for (const k of Object.keys(DEATH_LABEL) as DeathCause[]) {
    const d = (ui.deaths[k] ?? 0) - (a.deaths0[k] ?? 0);
    if (d > causeN) {
      causeN = d;
      cause = k;
    }
  }
  if (a.guess !== "" && verdict !== "neutral") {
    total++;
    if (verdict === "right") right++;
  }
  last = { kind: a.kind, name: a.name, verdict, base: a.base, now, cause, causeN, guess: a.guess === "" ? "yes" : a.guess };
  if (a.guess === "") last.verdict = "neutral";
  active = null;
  lastEnd = time;
}

/** Her yenilemede çağrılır; soruyu üretir ya da sonuçlandırır. Değişim olduysa true döner. */
export function tickPredict(ui: UiPayload, time: number): void {
  if (!enabled) return;
  if (active) {
    if (time < active.t0) active = null;
    else if (time >= active.due) resolve(ui, active, time);
    return;
  }
  if (time < lastEnd) lastEnd = 0;
  if (time >= Math.max(FIRST_AT, lastEnd + COOLDOWN)) nextQuestion(ui, time);
}

const GUESS_LABEL: Record<Guess, string> = { up: "Artar", down: "Azalır", yes: "Yaşar", no: "Tükenir" };

export function predictHtml(time: number): string {
  if (!enabled) return `<p class="note" style="padding:8px">Tahmin soruları Oyun modunda çıkar. Üstteki "Oyun" düğmesine basarak açın.</p>`;
  const score = total > 0 ? `<p class="foot pred-score" style="margin:0"><span>Doğru tahmin:</span> <b>${right} / ${total}</b></p>` : "";
  let body = "";
  if (active) {
    const q =
      `<p class="pred-q"><em>${esc(active.name)}</em> ` +
      (active.kind === "grow" ? `<span>türünün birey sayısı iki dakika sonra nasıl olacak?</span>` : `<span>türü iki dakika sonra hâlâ yaşıyor olacak mı?</span>`) +
      ` <small>Şu an ${active.base} birey var.</small></p>`;
    if (active.guess === "") {
      const opts: Guess[] = active.kind === "grow" ? ["up", "down"] : ["yes", "no"];
      body = q + `<div class="card-actions">${opts.map((g) => `<button type="button" class="btn btn-small" data-action="pred" data-g="${g}">${GUESS_LABEL[g]}</button>`).join("")}</div>`;
    } else {
      body = q + `<p class="pred-wait"><span>Tahminin:</span> <b>${GUESS_LABEL[active.guess]}</b> <span>Sonuç için kalan süre:</span> <b class="mono">${fmtTime(Math.max(0, active.due - time))}</b></p>`;
    }
  } else if (last) {
    const r = last;
    const head = r.verdict === "right" ? "Doğru bildin" : r.verdict === "wrong" ? "Yanıldın" : "Sonuç sayılmadı";
    const detail =
      r.kind === "survive"
        ? `<span>${r.now > 0 ? "Tür hâlâ yaşıyor." : "Tür tükendi."}</span> <small>Birey sayısı ${r.base} idi, şimdi ${r.now}.</small>`
        : `<span>Birey sayısı ${r.base} idi, şimdi ${r.now}.</span>`;
    const why =
      r.causeN > 0 && r.cause !== ""
        ? `<p class="pred-why"><span>Bu sürede dünyada en çok ölüm nedeni:</span> <b>${DEATH_LABEL[r.cause]}</b> <small>${r.causeN} ölüm</small></p>`
        : `<p class="pred-why"><span>Bu sürede hiç ölüm kaydı yok.</span></p>`;
    const neutral = r.verdict === "neutral" ? `<p class="foot" style="margin:0">Fark yüzde onun altında kaldı ya da soru cevapsız kaldı.</p>` : "";
    body = `<div class="pred-res ${r.verdict}"><b>${head}</b> <em>${esc(r.name)}</em></div><p class="pred-q">${detail}</p>${why}${neutral}<p class="foot" style="margin:0">Sonraki soru birazdan gelecek.</p>`;
  } else {
    body = `<p class="note" style="padding:8px">Birkaç dakika sonra ilk soru gelir: gözlemlediğiniz türlerden biri için kısa vadeli bir tahmin yapacaksınız.</p>`;
  }
  return score + body;
}
