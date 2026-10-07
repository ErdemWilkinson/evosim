import { CATALYSTS, ENERGIES, GENETICS, MEMBRANES, ORIGINS, PIGMENTS, SCAFFOLDS, SOLVENTS, WALLS, Option } from "./chemistry";
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
  return `<p class="note">Oyundaki her kimya seçeneği ve köken senaryosu aşağıdaki yayınlardan birine dayanır. Yayınlar dergi makaleleridir; kitaplar yazar ve yılla anılır.</p><p class="note">Toplam ${total} kayıt, ${seen.size} ayrı kaynak.</p>${body}<p class="foot">Organların malzeme çizimleri Dünya'daki karşılıklarından uyarlanmış yalın modellerdir ve ayrı bir kaynak künyesi taşımaz. Simülasyon sayıları (hız, can, metabolizma çarpanları) bu yayınlardaki yönü izler; ölçüleri yayından alınmış değildir.</p>`;
}
