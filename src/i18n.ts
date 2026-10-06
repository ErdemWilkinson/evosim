import { AUTO } from "./i18n.auto";
import { MANUAL } from "./i18n.manual";

/**
 * Dil katmanı. Kaynak metin Türkçedir ve simülasyon çekirdeği dili hiç bilmez: çeviri yalnızca
 * gösterim anında yapılır. Böylece kayıtlar ve olay günlüğü dilden bağımsız kalır.
 * Sayfadaki metin düğümleri bir MutationObserver ile, tuvale yazılan metinler `tr()` ile çevrilir.
 */
export type Lang = "tr" | "en";

const LANG_KEY = "evosim-lang";
const NUM = /\d+(?:[.,]\d+)*/g;
const SEPARATORS = [" · ", " — ", " – ", ": ", ", ", " → "];
const ATTRS = ["title", "aria-label", "placeholder"];

let lang: Lang = "tr";
const exact = new Map<string, string>();
const lowered = new Map<string, string>();
const patterns: { re: RegExp; names: string[]; out: string }[] = [];
const cache = new Map<string, string>();

const lowerWords = (s: string): string => s.replace(/(^|[\s(/])([A-Z])(?=[a-z])/g, (_, a: string, b: string) => a + b.toLowerCase());
const upperFirst = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const lowerFirst = (s: string): string => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/** Cümle sonlarından böler: nokta, ardından boşluk ve büyük harf. Aradaki boşluklar korunur. */
function sentences(s: string): string[] {
  const out: string[] = [];
  let from = 0;
  for (let i = 0; i < s.length - 2; i++) {
    if (!".!?".includes(s[i]) || s[i + 1] !== " ") continue;
    if (!/[A-ZÇĞİÖŞÜ"“(]/.test(s[i + 2])) continue;
    out.push(s.slice(from, i + 1), " ");
    from = i + 2;
  }
  out.push(s.slice(from));
  return out;
}

for (const [key, value] of [...Object.entries(AUTO), ...Object.entries(MANUAL)]) {
  if (/\{[^}]+\}/.test(key)) {
    const names: string[] = [];
    const source = key
      .split(/\{([^}]+)\}/)
      .map((part, i) => (i % 2 === 1 ? (names.push(part), "(.+?)") : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
      .join("");
    patterns.push({ re: new RegExp(`^${source}$`), names, out: value });
  } else {
    exact.set(key, value);
  }
}
// Çok cümleli girdilerin cümleleri ayrıca da kaydedilir: başka bir metne eklendiklerinde de çevrilsinler.
for (const [key, value] of [...exact]) {
  const from = sentences(key);
  const to = sentences(value);
  if (from.length < 3 || from.length !== to.length) continue;
  for (let i = 0; i < from.length; i += 2) if (!exact.has(from[i])) exact.set(from[i], to[i]);
}
for (const [key, value] of exact) {
  const low = key.toLocaleLowerCase("tr");
  if (!exact.has(low) && !lowered.has(low)) lowered.set(low, lowerWords(value));
}

function lookup(s: string): string | null {
  const hit = exact.get(s);
  if (hit !== undefined) return hit;
  const low = lowered.get(s.toLocaleLowerCase("tr"));
  if (low === undefined) return null;
  return /^[A-ZÇĞİÖŞÜ]/.test(s) ? upperFirst(low) : low;
}

function parts(pieces: string[], depth: number): string | null {
  let changed = false;
  const out = pieces.map((piece) => {
    const t = core(piece, depth + 1);
    if (t !== null) changed = true;
    return t ?? piece;
  });
  return changed ? out.join("") : null;
}

function core(s: string, depth: number): string | null {
  if (depth > 6 || !/[A-Za-zçğıöşüÇĞİÖŞÜ]/.test(s)) return null;
  const direct = lookup(s);
  if (direct !== null) return direct;

  const numbers: string[] = [];
  const key = s.replace(NUM, (n) => (numbers.push(n), "§"));
  if (numbers.length > 0) {
    const hit = lookup(key);
    if (hit !== null) {
      let i = 0;
      return hit.replace(/§/g, () => numbers[i++] ?? "");
    }
  }

  const split = sentences(s);
  if (split.length > 1) return parts(split, depth);

  for (const p of patterns) {
    const m = p.re.exec(s);
    if (!m) continue;
    return p.out.replace(/\{([^}]+)\}/g, (_, name: string, at: number) => {
      const keep = name.endsWith("^");
      const raw = m[p.names.indexOf(keep ? name.slice(0, -1) : name) + 1] ?? "";
      const t = core(raw, depth + 1);
      if (t === null) return raw;
      return keep ? t : at === 0 ? upperFirst(t) : lowerFirst(t);
    });
  }

  const tail = /^(.*?)([.:;!?…]+)$/.exec(s);
  if (tail && tail[1] !== "") {
    const t = core(tail[1], depth + 1);
    if (t !== null) return t + tail[2];
  }
  const head = /^([+−\-~×#]\s?)(.+)$/.exec(s);
  if (head) {
    const t = core(head[2], depth + 1);
    if (t !== null) return head[1] + t;
  }
  const paren = /^(.+?) \((.+)\)$/.exec(s);
  if (paren) {
    const t = parts([paren[1], " (", paren[2], ")"], depth);
    if (t !== null) return t;
  }
  for (const sep of SEPARATORS) {
    if (!s.includes(sep)) continue;
    const pieces: string[] = [];
    s.split(sep).forEach((piece, i) => {
      if (i > 0) pieces.push(sep);
      pieces.push(piece);
    });
    const t = parts(pieces, depth);
    if (t !== null) return t;
  }
  return null;
}

/** Türkçe kaynak metni etkin dile çevirir; çevirisi olmayan metin olduğu gibi döner. */
export function tr(s: string): string {
  if (lang === "tr" || s === "") return s;
  const cached = cache.get(s);
  if (cached !== undefined) return cached;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
  let out = s;
  if (m && m[2] !== "") {
    const t = core(m[2], 0) ?? m[2];
    out = m[1] + t.replace(/ ve ark\./g, " et al.").replace(/%(\d+(?:[.,]\d+)?)/g, "$1%") + m[3];
  }
  if (cache.size > 8000) cache.clear();
  cache.set(s, out);
  return out;
}

export function getLang(): Lang {
  return lang;
}

/** Sayı biçimi için yerel ayar. */
export function locale(): string {
  return lang === "en" ? "en-US" : "tr-TR";
}

// ------------------------------------------------------------------ sayfa

const textState = new WeakMap<Node, { src: string; out: string }>();
const attrState = new WeakMap<Element, Record<string, { src: string; out: string }>>();
let observer: MutationObserver | null = null;

function skip(el: Element | null): boolean {
  return !el || el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.tagName === "TEXTAREA" || el.closest("[data-notr]") !== null;
}

function applyText(node: Node): void {
  const parent = node.parentElement;
  if (skip(parent)) return;
  const now = node.nodeValue ?? "";
  const rec = textState.get(node);
  const src = rec && rec.out === now ? rec.src : now;
  const override = lang === "en" && parent?.dataset.en && parent.childNodes.length === 1 ? parent.dataset.en : null;
  const out = override ?? tr(src);
  textState.set(node, { src, out });
  if (out !== now) node.nodeValue = out;
}

function applyAttrs(el: Element): void {
  if (skip(el)) return;
  for (const name of ATTRS) {
    const now = el.getAttribute(name);
    if (now === null) continue;
    let state = attrState.get(el);
    if (!state) attrState.set(el, (state = {}));
    const rec = state[name];
    const src = rec && rec.out === now ? rec.src : now;
    const out = tr(src);
    state[name] = { src, out };
    if (out !== now) el.setAttribute(name, out);
  }
}

function applyTree(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) return applyText(root);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  applyAttrs(root as Element);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) applyText(n);
    else applyAttrs(n as Element);
  }
}

function markButtons(): void {
  document.querySelectorAll<HTMLElement>("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  document.querySelectorAll<HTMLSelectElement>("select[data-lang-select]").forEach((s) => (s.value = lang));
}

export function setLang(next: Lang): void {
  if (next === lang) return;
  lang = next;
  cache.clear();
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // Depolama kapalıysa seçim yalnızca bu oturumda geçerli kalır.
  }
  document.documentElement.lang = lang;
  applyTree(document.body);
  markButtons();
  window.dispatchEvent(new Event("evosim-lang"));
}

/** Dili belirler (kayıtlı seçim, yoksa tarayıcı dili), sayfayı çevirir ve değişiklikleri izlemeye başlar. */
export function initI18n(): void {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(LANG_KEY);
  } catch {
    saved = null;
  }
  lang = saved === "tr" || saved === "en" ? saved : (navigator.language || "tr").toLowerCase().startsWith("tr") ? "tr" : "en";
  document.documentElement.lang = lang;
  observer = new MutationObserver((records) => {
    if (lang === "tr") return;
    for (const r of records) {
      if (r.type === "characterData") applyText(r.target);
      else if (r.type === "attributes") applyAttrs(r.target as Element);
      else r.addedNodes.forEach(applyTree);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  applyTree(document.body);
  markButtons();
  document.addEventListener("click", (e) => {
    const b = (e.target as Element | null)?.closest<HTMLElement>("[data-lang]");
    if (b && (b.dataset.lang === "tr" || b.dataset.lang === "en")) setLang(b.dataset.lang);
  });
  document.addEventListener("change", (e) => {
    const s = e.target as HTMLSelectElement | null;
    if (s && s.matches?.("select[data-lang-select]") && (s.value === "tr" || s.value === "en")) setLang(s.value);
  });
}
