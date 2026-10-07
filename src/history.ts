import { UiPayload } from "./protocol";
import { DEATH_LABEL, Fossil, LineStats } from "./sim";
import { fmtTime, esc } from "./ui";

/** "Tarih" sekmesinin içerik üreticileri. Yalnızca gözlem verisini gösterir; benzetime dokunmaz. */

export const MS_LABEL: Record<string, string> = {
  photosynth: "İlk fotosentetik",
  predator: "İlk avcı",
  parasite: "İlk parazit",
  symbiosis: "İlk simbiyoz",
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

/** "Benim soyum" bloğu: işaretlenen canlının torunlarının özeti. Yalnızca takip eder, müdahale etmez. */
export function lineBlock(line: LineStats | null): string {
  if (!line) {
    return (
      `<p class="note" style="padding:8px">Bir canlıyı seçip "Soyumu işaretle"ye basın: torunları haritada altın halkayla görünür; kaç birey, kaç tür kaldığı ve ` +
      `soyun ne kadar farklılaştığı burada izlenir.</p>`
    );
  }
  const head = `<p class="foot" style="margin:0">${esc(line.rootName)} · #${line.root} · ${fmtTime(line.t0)}'den beri</p>`;
  if (line.alive === 0 && line.extinctAt >= 0) {
    return (
      head +
      `<div class="line-dead"><b>Soyun tükendi</b><p>${fmtTime(line.extinctAt)} anında son birey de öldü. İşaretlendiğinden beri soyda ${line.born} birey doğdu, ${line.maxGen} nesil ilerledi.</p>` +
      `<p>Haritada yaşayan başka bir canlı seçip "Soyumu işaretle"ye basarak yeni bir soy seçebilirsiniz.</p>` +
      `<div class="card-actions"><button type="button" class="btn btn-small" data-action="line-clear">İşareti kaldır</button></div></div>`
    );
  }
  const arms = line.arms
    .slice(0, 6)
    .map((a) => `<div class="line-arm"><span>${esc(a.name)}</span><b>${a.alive}</b></div>`)
    .join("");
  return (
    head +
    `<div class="facts">` +
    `<div><span class="label">Yaşayan torun</span><b>${line.alive}</b></div>` +
    `<div><span class="label">Doğan toplam</span><b>${line.born}</b></div>` +
    `<div><span class="label">Yaşayan tür</span><b>${line.arms.length}</b></div>` +
    `<div><span class="label">Tükenen kol</span><b>${line.extinctArms}</b></div>` +
    `<div><span class="label">İlerlenen nesil</span><b>${line.maxGen}</b></div>` +
    `<div><span class="label">Atadan uzaklık</span><b>${(line.maxDist * 100).toFixed(0)}</b><small>en uzak torun, 0 = aynı</small></div>` +
    `</div>` +
    `<div class="line-arms">${arms}</div>` +
    `<div class="card-actions"><button type="button" class="btn btn-small" data-action="line-find">Haritada göster</button><button type="button" class="btn btn-small" data-action="line-clear">İşareti kaldır</button></div>`
  );
}

/** Fosil kaydı: tükenmiş türler, en yeni en üstte. Neden yalnızca ölçülmüş son ölümlerden okunur. */
export function fossilCards(list: Fossil[]): string {
  if (list.length === 0) {
    return `<p class="note" style="padding:8px">Henüz tükenmiş tür yok. Kalıcılaşmış bir tür tükendiğinde portresi, yaşadığı dönem ve tükenme nedeni burada saklanır.</p>`;
  }
  return list
    .map((f) => {
      const cause =
        f.cause !== ""
          ? `<b>${DEATH_LABEL[f.cause]}</b><small>son ${f.causeN} ölümün %${Math.round(f.causeShare * 100)}'i</small>`
          : `<b>Tek bir belirgin neden yok</b>${f.causeN > 0 ? `<small>son ${f.causeN} ölüm dağınık nedenlerle</small>` : `<small>ölüm kaydı yetersiz</small>`}`;
      return (
        `<div class="fossil"><canvas data-fossil="${f.id}" aria-hidden="true"></canvas><div class="fossil-body">` +
        `<div class="card-title"><em>${esc(f.name)}</em></div>` +
        `<div class="fossil-line"><span class="label">Yaşadığı dönem</span><b class="mono">${fmtTime(f.born)} – ${fmtTime(f.extinct)}</b></div>` +
        `<div class="fossil-line"><span class="label">Zirve</span><b>${f.peak} birey</b></div>` +
        (f.parentName ? `<div class="fossil-line"><span class="label">Atası</span><b><em>${esc(f.parentName)}</em></b></div>` : "") +
        `<div class="fossil-line"><span class="label">Tükenme nedeni</span><span class="fossil-cause">${cause}</span></div>` +
        `</div></div>`
      );
    })
    .join("");
}

export function milestoneKeys(): string[] {
  return MS_ORDER;
}
