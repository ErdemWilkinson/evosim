import { UiPayload } from "./protocol";
import { fmtTime, esc } from "./ui";

/** "Tarih" sekmesinin içerik üreticileri. Yalnızca gözlem verisini gösterir; benzetime dokunmaz. */

export const MS_LABEL: Record<string, string> = {
  photosynth: "İlk fotosentetik",
  predator: "İlk avcı",
  parasite: "İlk parazit",
  multicellular: "İlk çok hücreli",
  land: "İlk karaya çıkış",
  sexual: "İlk eşeyli üreme",
  dieoff: "Kitlesel yok oluş",
};

const MS_ORDER = Object.keys(MS_LABEL);

/** Gezegenin tarihini gösteren şerit: işaretler zaman ekseninde dizilir, tıklanınca ayrıntı açılır. */
export function milestoneStrip(ui: UiPayload, time: number, pick: string, canRewind: (t: number) => boolean): string {
  const list = ui.milestones;
  const span = Math.max(60, time);
  if (list.length === 0) {
    return `<p class="note" style="padding:8px">Henüz dönüm noktası yok. İlk fotosentetik, ilk avcı, ilk karaya çıkış gibi anlar gerçekleştikçe burada işaretlenir.</p>`;
  }
  const dots = list
    .map((m, i) => {
      const left = Math.min(98, Math.max(2, (m.t / span) * 100));
      const label = MS_LABEL[m.key] ?? m.key;
      return `<button type="button" class="ms-dot ms-${esc(m.key)}${m.seq === Number(pick) ? " on" : ""}" data-action="ms-pick" data-seq="${m.seq}" style="left:${left.toFixed(2)}%;--row:${i % 3}" aria-label="${esc(label)}" title="${esc(label)}"><i></i></button>`;
    })
    .join("");
  const chosen = list.find((m) => m.seq === Number(pick)) ?? list[list.length - 1];
  const label = MS_LABEL[chosen.key] ?? chosen.key;
  const can = canRewind(chosen.t);
  return (
    `<div class="ms-strip" role="group" aria-label="Gezegenin tarihi"><div class="ms-track"></div>${dots}` +
    `<span class="ms-axis"><span>00:00</span><span>${fmtTime(span)}</span></span></div>` +
    `<div class="ms-detail"><b>${esc(label)}</b><span class="mono dim">${fmtTime(chosen.t)}</span>` +
    `<p>${esc(chosen.text)}</p>` +
    `<div class="card-actions">` +
    (chosen.id > 0 ? `<button type="button" class="btn btn-small" data-action="ms-find" data-id="${chosen.id}">Haritada bul</button>` : "") +
    `<button type="button" class="btn btn-small" data-action="ms-rewind" data-t="${chosen.t}"${can ? "" : " disabled"}>Bu ana dön</button>` +
    `</div></div>`
  );
}

export function milestoneKeys(): string[] {
  return MS_ORDER;
}
