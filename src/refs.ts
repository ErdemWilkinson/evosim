import { CATALYSTS, ENERGIES, ORIGIN_ENERGY, PHASE_REF, GENETICS, MEMBRANES, ORIGINS, PIGMENTS, SCAFFOLDS, SOLVENTS, WALLS, Option } from "./chemistry";
import { ORGAN_REFS } from "./inspect";
import { ORGANS, OrganType } from "./organs";
import { esc } from "./ui";

/**
 * Kaynakça: oyundaki her kimya seçeneğinin ve köken senaryosunun dayandığı yayınlar, gruplanmış.
 * Veri `src/chemistry.ts` içindeki `ref` alanlarından okunur; burada ikinci bir liste tutulmaz.
 */
const GROUPS: [string, readonly { name: string; ref: string }[]][] = [
  ["Yüzey sıvısı", SOLVENTS],
  ["İskelet", SCAFFOLDS],
  ["Zar", MEMBRANES],
  ["Hücre duvarı", WALLS],
  ["Kalıtım polimeri", GENETICS],
  ["Enerji taşıyıcısı", ENERGIES],
  ["Katalizör", CATALYSTS],
  ["Işık pigmenti", PIGMENTS],
  ["Köken senaryosu", ORIGINS],
  ["Köken enerjisi", Object.values(ORIGIN_ENERGY)],
  ["Organ malzemeleri", (Object.keys(ORGAN_REFS) as OrganType[]).map((t) => ({ name: ORGANS[t].label, ref: ORGAN_REFS[t] ?? "" }))],
  ["Yüzey basıncı", [{ name: "Sıvının kaynama ve buhar basıncı", ref: PHASE_REF }]],
];

export function refsHtml(): string {
  let total = 0;
  const seen = new Set<string>();
  const body = GROUPS.map(([title, list]) => {
    const items = list
      .filter((o: Option | { name: string; ref: string }) => o.ref)
      .map((o) => {
        total++;
        seen.add(o.ref);
        return `<li><b>${esc(o.name)}</b><span class="ref">${esc(o.ref)}</span></li>`;
      })
      .join("");
    return `<section class="block"><h3>${esc(title)}</h3><ul class="refs-list">${items}</ul></section>`;
  }).join("");
  return `${modelHtml()}<p class="note">Oyundaki her kimya seçeneği ve köken senaryosu aşağıdaki yayınlardan birine dayanır. Yayınlar dergi makaleleridir; kitaplar yazar ve yılla anılır.</p><p class="note">Toplam ${total} kayıt, ${seen.size} ayrı kaynak.</p>${body}`;
}

/** Modelin neye dayandığını ve neye dayanmadığını açıkça söyleyen blok. */
function modelHtml(): string {
  return `<section class="block"><h3>Bu bir model, tahmin değil</h3>` +
    `<p class="note">Evosim bir eğitim ve keşif simülasyonudur; gerçek bir gezegenin ya da türün evrimini öngörmez.</p>` +
    `<h3>Yayınlara dayananlar</h3><ul class="refs-list"><li>Kimya seçeneklerinin kendisi: sıvılar, iskeletler, zarlar, duvarlar, kalıtım polimerleri, enerji taşıyıcıları, katalizörler, pigmentler ve köken senaryoları.</li><li>Sıvının hangi basınç ve sıcaklıkta sıvı kaldığı (Clausius–Clapeyron, yuvarlak değerlerle).</li><li>Etkilerin yönü: soğukta yavaş, sıcakta hızlı; ağır duvar daha sağlam ama yavaş.</li><li>Organ malzemelerinin Dünya'daki karşılıkları.</li></ul>` +
    `<h3>Ayarlanan ya da uydurulanlar</h3><ul class="refs-list"><li>Bütün sayısal çarpanlar (hız, can, metabolizma, mutasyon sıklığı), oyunun dengede kalması için ayarlandı. Yayınlardan ölçü alınmadı.</li><li>Kimya seçimi "gereken elementler var mı" kuralıdır; tepkime serbest enerjisi ve çözünürlük hesaplanmaz.</li><li>Hücre duvarı ve kalıtım polimeri dışındaki yapıların (zar, enerji taşıyıcısı, katalizör) simülasyondaki etkisi yoktur; yalnızca görünür ve rastgele sürüklenir.</li><li>Köken enerjisi ve her senaryoya atanan enerji türü bilgi amaçlıdır.</li><li>Organların işlevleri oyun kuralıdır; malzeme çizimleri Dünya'daki karşılıklarından uyarlanmış yalın modellerdir.</li><li>Denge ölçümleri belli tohum kümelerinde yapıldı; her tohumda aynı sonucu garanti etmez.</li></ul></section>`;
}
