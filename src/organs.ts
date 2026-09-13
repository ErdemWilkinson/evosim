import { Graphics } from "pixi.js";
import { Palette } from "./genome";

/**
 * Faz II (v3) — Açık uçlu organ sistemi (TASKS.md "Açık organ havuzu"). Kapalı bir
 * enum + switch yerine bir KAYIT (registry) kuruluyor: her organ tipi kendi çizim
 * fonksiyonunu ve mekanik etkisini `ORGAN_DEFINITIONS` üzerinden tanımlıyor. Yeni bir
 * organ eklemek, bu haritaya yeni bir girdi eklemekten ibaret — sabit bir "evrim ağacı"
 * sırası yok, `divideGenome` rastgele/fırsatçı olarak havuzdan seçiyor (bkz. genome.ts).
 *
 * Görsel dil v2'den korunuyor: şematik/bilimsel çizimler (çizgi, üçgen, nokta) — asla
 * karikatür yüz/göz-kaş gibi ifade taşıyan şekiller değil.
 */

export type OrganCategory = "movement" | "sense" | "feeding" | "defense";

/** Bir canlının sahip olduğu tek bir organ örneği: tipi + genomdan gelen sürekli
 *  "güç/boyut" değeri (mutasyonla hafifçe değişebilir, TASKS.md — "zaten sahip olunan
 *  organ tiplerinin gücü/boyutu da hafifçe mutasyona uğrayabilir"). */
export interface Organ {
  type: OrganType;
  /** 0..1 arası göreli güç/boyut — organ tipine göre yorumlanır (örn. bacak için
   *  "karada ne kadar hızlı", göz için "algı artışı katsayısı"). */
  power: number;
}

export type OrganType =
  | "fin" // yüzgeç — suda hız
  | "leg" // bacak — karada hareket + karaya çıkış imkânı
  | "wing" // kanat — ileride uçuş (şimdilik küçük ek hız)
  | "tentacle" // dokunaç/kamçı — ilkel hareket, suda hafif hız artışı
  | "eyespot" // ilkel ışık noktası — küçük algı artışı
  | "eye" // göz — büyük algı artışı
  | "mouth" // ağız/çene — beslenme verimliliği
  | "shell" // kabuk/zırh — hayatta kalma (metabolizma tasarrufu / dayanıklılık)
  | "camouflage" // kamuflaj rengi — görsel + hafif savunma
  | "spike" // diken — caydırıcı savunma
  // --- Faz X (v3) — Solunum organları (TASKS.md): "organlar atmosfere göre
  // gelişecek" hissi — gill/lung'un göreceli avantajı `Ecosystem`'in global
  // atmosfer/oksijen seviyesine göre gerçekten değişir (bkz. `ecosystem.ts`
  // `getAtmosphereOxygenLevel`/`Creature.deepWaterTolerance`/`breathingEfficiency`). ---
  | "gill" // solungaç — derin su cezasını azaltır/kaldırır, düşük oksijende suda avantajlı
  | "lung" // akciğer — kara/yüzey verimliliği, yüksek oksijende avantajlı
  // --- Faz X — İç organlar (TASKS.md): görsel çizim gerekmiyor, sadece mekanik
  // etki — açık organ havuzu felsefesiyle tutarlı ("kapalı bir liste değil,
  // büyüyebilir bir sistem"). Genoma yeni bir alan eklemiyor, mevcut `organs: Organ[]`
  // havuzuna sadece iki yeni tip ekliyor — save format DEĞİŞMİYOR. ---
  | "heart" // kalp — dolaşım/enerji verimliliği (metabolizma tasarrufu)
  | "stomach" // mide — sindirim/besin dönüşüm verimliliği (beslenme verimliliği)
  // --- Faz XIV (v3) — Sıra dışı/gerçek-dünya-ilhamlı organlar (TASKS.md madde 1):
  // kullanıcı "adaptasyon/direnç mekanizmalarından ilham al" istedi — kışlama/
  // torpor, izolasyon tabakası, biyolüminesans, zehir bezi, rejenerasyon. Hepsi
  // HALA elle kodlanmış/sabit mekanik etkili (PM'in güvenlik/kararlılık kararı —
  // Gemini yeni mekanik İCAT ETMİYOR, sadece hangi organların bir soy için daha
  // "öne çıkarılacağını" — ağırlık nudge'ı — önerebiliyor, bkz. `applyOrganWeightSuggestion`
  // ve `main.ts`'teki Faz XIII davranış öneri mekanizması). ---
  | "torpor" // kışlama/torpor — kritik düşük enerjide metabolizmayı ciddi düşürür (kamp balığı/ayı ilhamlı)
  | "blubber" // izolasyon tabakası — iklim/sıcaklık dalgalanmalarına karşı metabolizma direnci (fok/penguen ilhamlı)
  | "bioluminescence" // biyolüminesans — algı menzili artışı (derin deniz canlılarından ilhamlı)
  | "venom" // zehir bezi — avdan kaçış şansını artırır (avcıyı caydırma)
  | "regeneration" // rejenerasyon — beslenmeden kazanılan enerjiyi hafifçe artırır (hızlı toparlanma)
  // --- Faz XVI Madde 3 (v3, TASKS.md) — Gezegene özgü organlar: bu organların
  // KENDİSİ hâlâ elle kodlanmış/sabit mekanik etkili (aynı Faz XIV güvenlik kararı,
  // Gemini/rastgelelik yeni mekanik İCAT ETMİYOR) — sadece HANGİ organların bir
  // gezegende MÜMKÜN olduğu, o gezegenin oluşum profiline (bkz. `planetformation.ts`)
  // bağlı bir filtreleme katmanıyla (`setPlanetAllowedOrgans`/`pickRandomOrganType`
  // aşağıda) kısıtlanıyor. Bu iki organ, filtrelemenin somut örnekleri: ---
  | "nitrogen_sac" // azot deposu — yüksek/orta azotlu gezegenlerde mümkün, metabolizma tasarrufu (baklagil kök yumrusu/yüzme kesesi ilhamlı)
  | "sulfur_vent_organ" // kükürt kemosentez organı — kükürt açısından zengin gezegenlerde mümkün, beslenme verimliliği (hidrotermal baca tüp kurdu ilhamlı)
  // --- Faz XX (v3) — Yaratıcı/geliştirici görev (kullanıcı isteği, 2026-09-11):
  // yeni bir organ tipi, gerçek/ölçülebilir bir mekanik etkiyle. Mürekkep balığı/
  // bukalemun ilhamlı "aktif kamuflaj" — mevcut `camouflage`'dan (sabit/pasif bir
  // temel kaçış payı) FARKLI bir mekanik: sadece YAKALANMA ANINDA (huntCreature'da,
  // bkz. ecosystem.ts) devreye giren EK bir "irkilme/renk-değiştirme" kaçış şansı —
  // sürekli bir bonus değil, avcı tam yakalayacakken tetiklenen tepkisel bir şans. ---
  | "chromatophore" // kromatofor (aktif kamuflaj) — yakalanma anında ek, tepkisel bir kaçış şansı sağlar
  // --- Faz XXI (v3) — Yaratıcı/geliştirici görev (kullanıcı isteği, 2026-09-11,
  // devamı): "simbiyotik bağırsak florası" — mevcut mouth/stomach/regeneration'ın
  // hepsi "kazanılan ENERJİYİ artırır" ekseninde; bu organ FARKLI bir eksende
  // çalışır — kazanılan enerjiyi değil, avdan sonraki sindirim molası SÜRESİNİ
  // kısaltır (bkz. creature.ts `digestCooldownMultiplier`, ecosystem.ts
  // `huntCreature`), yani predatöre daha SIK avlanma fırsatı verir; SADECE
  // etçillerde (avlanan bir birey) anlamlı bir etkisi olur. ---
  | "symbiotic_gut_flora"; // simbiyotik bağırsak florası — avdan sonraki sindirim molası süresini kısaltır

export interface OrganDefinition {
  type: OrganType;
  category: OrganCategory;
  label: string;
  /** Bu organı ilk kez kazanma şansının göreceli ağırlığı (havuzdan seçilirken). */
  weight: number;
  /** Faz XIV (TASKS.md madde 3) — canlı inceleme panelinde organ satırının yanında
   *  gösterilen KISA, tek cümlelik mekanik-etki açıklaması. Koddaki GERÇEK etkiyle
   *  (creature.ts/ecosystem.ts) birebir tutarlı olmalı — uydurma/pazarlama metni
   *  DEĞİL, sadece "bu organ ne yapıyor" sorusuna dürüst bir cevap. */
  description: string;
  /** Canlının gövde dairesi üzerine/etrafına şematik çizim (yerel koordinat, merkez 0,0). */
  draw(g: Graphics, organ: Organ, bodyRadius: number, palette: Palette, index: number, total: number): void;
}

/** Organ tipini merkez etrafına eşit açılarla yerleştirmek için yardımcı — birden çok
 *  aynı tipte organ (örn. 2 bacak, 3 dokunaç) varsa simetrik dağılır. */
function slotAngle(index: number, total: number, offset = 0): number {
  return offset + (index / Math.max(1, total)) * Math.PI * 2;
}

export const ORGAN_DEFINITIONS: Record<OrganType, OrganDefinition> = {
  fin: {
    type: "fin",
    category: "movement",
    label: "Yüzgeç",
    weight: 1,
    description: "Suda hareket hızını artırır.",
    draw(g, organ, r, palette, index, total) {
      const angle = slotAngle(index, total, Math.PI * 0.25);
      const len = r * (0.9 + organ.power * 1.1);
      const baseX = Math.cos(angle) * r * 0.7;
      const baseY = Math.sin(angle) * r * 0.7;
      const tipX = Math.cos(angle) * (r + len);
      const tipY = Math.sin(angle) * (r + len);
      const perpX = Math.cos(angle + Math.PI / 2) * r * 0.25;
      const perpY = Math.sin(angle + Math.PI / 2) * r * 0.25;
      g.poly([baseX + perpX, baseY + perpY, tipX, tipY, baseX - perpX, baseY - perpY]);
      g.fill({ color: palette.bodyLight, alpha: 0.8 });
      g.stroke({ width: 0.75, color: palette.bodyDark, alpha: 0.7 });
    },
  },

  leg: {
    type: "leg",
    category: "movement",
    label: "Bacak",
    weight: 0.7,
    description: "Karada hareket + karaya çıkış imkânı sağlar.",
    draw(g, organ, r, palette, index, total) {
      const angle = slotAngle(index, total, Math.PI / 2 + Math.PI * 0.15);
      const len = r * (0.7 + organ.power * 0.9);
      const baseX = Math.cos(angle) * r * 0.85;
      const baseY = Math.sin(angle) * r * 0.85;
      const tipX = Math.cos(angle) * (r + len);
      const tipY = Math.sin(angle) * (r + len);
      g.moveTo(baseX, baseY);
      g.lineTo(tipX, tipY);
      g.stroke({ width: 1.4, color: palette.bodyDark, alpha: 0.9 });
      // ayak ucunda küçük bir çizgi (basit "ayak" işareti)
      const footAngle = angle + Math.PI / 2;
      const footLen = r * 0.18;
      g.moveTo(tipX - Math.cos(footAngle) * footLen, tipY - Math.sin(footAngle) * footLen);
      g.lineTo(tipX + Math.cos(footAngle) * footLen, tipY + Math.sin(footAngle) * footLen);
      g.stroke({ width: 1.1, color: palette.bodyDark, alpha: 0.9 });
    },
  },

  wing: {
    type: "wing",
    category: "movement",
    label: "Kanat",
    weight: 0.15,
    description: "Şu an için suda hafif ek hız sağlar (uçuş henüz uygulanmadı).",
    draw(g, organ, r, palette, index, total) {
      const angle = slotAngle(index, total, -Math.PI * 0.2);
      const len = r * (1.1 + organ.power * 1.3);
      const baseX = Math.cos(angle) * r * 0.6;
      const baseY = Math.sin(angle) * r * 0.6;
      const tipX = Math.cos(angle) * (r + len);
      const tipY = Math.sin(angle) * (r + len);
      const spreadAngle = angle + Math.PI * 0.35;
      const midX = Math.cos(spreadAngle) * (r + len * 0.6);
      const midY = Math.sin(spreadAngle) * (r + len * 0.6);
      g.poly([baseX, baseY, midX, midY, tipX, tipY]);
      g.fill({ color: palette.bodyLight, alpha: 0.35 });
      g.stroke({ width: 0.75, color: palette.bodyDark, alpha: 0.6 });
    },
  },

  tentacle: {
    type: "tentacle",
    category: "movement",
    label: "Dokunaç",
    weight: 1,
    description: "Suda hafif ek hız sağlar.",
    draw(g, organ, r, palette, index, total) {
      const angle = slotAngle(index, total, Math.PI);
      const len = r * (0.8 + organ.power * 1.0);
      // hafif dalgalı bir çizgi (kırık segmentlerle basit "kamçı" izlenimi)
      const segs = 3;
      let px = Math.cos(angle) * r * 0.9;
      let py = Math.sin(angle) * r * 0.9;
      g.moveTo(px, py);
      for (let s = 1; s <= segs; s++) {
        const t = s / segs;
        const wobble = Math.sin(t * Math.PI * 2 + index) * r * 0.15;
        const dist = r * 0.9 + len * t;
        const nx = Math.cos(angle) * dist + Math.cos(angle + Math.PI / 2) * wobble;
        const ny = Math.sin(angle) * dist + Math.sin(angle + Math.PI / 2) * wobble;
        g.lineTo(nx, ny);
        px = nx;
        py = ny;
      }
      g.stroke({ width: 1, color: palette.bodyDark, alpha: 0.75 });
    },
  },

  eyespot: {
    type: "eyespot",
    category: "sense",
    label: "Işık Noktası",
    weight: 1,
    description: "Algı menzilini az miktarda artırır.",
    draw(g, organ, r, palette, index, total) {
      const angle = slotAngle(index, total, -Math.PI / 2);
      const dist = r * 0.55;
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      const dotR = r * (0.08 + organ.power * 0.06);
      g.circle(x, y, dotR).fill({ color: 0xdfe8f5, alpha: 0.9 });
      void palette;
    },
  },

  eye: {
    type: "eye",
    category: "sense",
    label: "Göz",
    weight: 0.5,
    description: "Algı menzilini büyük ölçüde artırır.",
    draw(g, organ, r, palette, index, total) {
      const angle = slotAngle(index, total, -Math.PI / 2);
      const dist = r * 0.6;
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      const outerR = r * (0.14 + organ.power * 0.08);
      g.circle(x, y, outerR).fill({ color: 0xf2f6fb, alpha: 0.95 });
      g.circle(x, y, outerR * 0.45).fill({ color: 0x10131a, alpha: 0.95 });
      void palette;
    },
  },

  mouth: {
    type: "mouth",
    category: "feeding",
    label: "Ağız/Çene",
    weight: 1,
    description: "Beslenme verimliliğini artırır.",
    draw(g, organ, r, palette, index, total) {
      void index;
      void total;
      // Gövdenin "ön" yönünde basit bir yay/çentik — çizgi tabanlı, karikatür ağız değil.
      const width = r * (0.35 + organ.power * 0.25);
      g.moveTo(r * 0.4, -width / 2);
      g.lineTo(r * 0.95, 0);
      g.lineTo(r * 0.4, width / 2);
      g.stroke({ width: 1, color: palette.bodyDark, alpha: 0.85 });
    },
  },

  shell: {
    type: "shell",
    category: "defense",
    label: "Kabuk",
    weight: 0.6,
    description: "Hayatta kalma şansını artırır, karşılığında biraz daha fazla enerji tüketir.",
    draw(g, organ, r, palette) {
      const shellR = r * (1.15 + organ.power * 0.2);
      g.circle(0, 0, shellR).stroke({ width: 1.5, color: palette.bodyDark, alpha: 0.55 });
      // birkaç kısa radyal çizgi — segmentli kabuk izlenimi
      const segs = 6;
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        g.moveTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95);
        g.lineTo(Math.cos(a) * shellR, Math.sin(a) * shellR);
        g.stroke({ width: 0.75, color: palette.bodyDark, alpha: 0.4 });
      }
    },
  },

  camouflage: {
    type: "camouflage",
    category: "defense",
    label: "Kamuflaj",
    weight: 0.8,
    description: "Avlanmadan kaçış şansını artırır.",
    draw(g, organ, r, palette) {
      // Gövde üzerinde birkaç düzensiz, düşük-alfa benek — desen, yüz değil.
      const spots = 3 + Math.round(organ.power * 3);
      let seed = 1;
      const rand = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
      for (let i = 0; i < spots; i++) {
        const a = rand() * Math.PI * 2;
        const d = rand() * r * 0.6;
        const spotR = r * (0.12 + rand() * 0.12);
        g.circle(Math.cos(a) * d, Math.sin(a) * d, spotR).fill({ color: palette.bodyDark, alpha: 0.3 });
      }
    },
  },

  spike: {
    type: "spike",
    category: "defense",
    label: "Diken",
    weight: 0.6,
    description: "Avlanmadan kaçış şansını artırır.",
    draw(g, organ, r, palette, index, total) {
      const count = Math.max(3, total);
      const angle = slotAngle(index, count, 0);
      const len = r * (0.35 + organ.power * 0.45);
      const baseAngleSpread = 0.12;
      const baseX1 = Math.cos(angle - baseAngleSpread) * r;
      const baseY1 = Math.sin(angle - baseAngleSpread) * r;
      const baseX2 = Math.cos(angle + baseAngleSpread) * r;
      const baseY2 = Math.sin(angle + baseAngleSpread) * r;
      const tipX = Math.cos(angle) * (r + len);
      const tipY = Math.sin(angle) * (r + len);
      g.poly([baseX1, baseY1, tipX, tipY, baseX2, baseY2]);
      g.fill({ color: palette.bodyDark, alpha: 0.85 });
    },
  },

  // --- Faz X — Solunum organları (TASKS.md) ---
  gill: {
    type: "gill",
    category: "movement", // hareket kategorisi yok ama "suda kal(abil)me" hareket organlarıyla aynı ruhta
    label: "Solungaç",
    weight: 0.5,
    description: "Suda düşük oksijen seviyelerine karşı metabolizmayı verimli tutar.",
    draw(g, organ, r, palette, index, total) {
      // Gövde kenarında birkaç kısa, paralel yay çizgisi — şematik "solungaç yarığı".
      const angle = slotAngle(index, total, Math.PI * 0.75);
      const slits = 3;
      for (let i = 0; i < slits; i++) {
        const off = (i - (slits - 1) / 2) * r * 0.22;
        const cx = Math.cos(angle) * r * 0.85 + Math.cos(angle + Math.PI / 2) * off;
        const cy = Math.sin(angle) * r * 0.85 + Math.sin(angle + Math.PI / 2) * off;
        const len = r * (0.25 + organ.power * 0.2);
        g.moveTo(cx - Math.cos(angle) * len * 0.5, cy - Math.sin(angle) * len * 0.5);
        g.lineTo(cx + Math.cos(angle) * len * 0.5, cy + Math.sin(angle) * len * 0.5);
        g.stroke({ width: 1, color: palette.bodyDark, alpha: 0.6 });
      }
    },
  },

  lung: {
    type: "lung",
    category: "movement",
    label: "Akciğer",
    weight: 0.5,
    description: "Karada/yüzeyde bol oksijende metabolizma verimliliğini artırır.",
    draw(g, organ, r, palette, index, total) {
      // Gövdenin bir tarafında iki küçük, soluk oval — şematik "akciğer kesesi".
      const angle = slotAngle(index, total, -Math.PI * 0.75);
      const ovalR = r * (0.16 + organ.power * 0.1);
      const cx = Math.cos(angle) * r * 0.45;
      const cy = Math.sin(angle) * r * 0.45;
      g.ellipse(cx, cy, ovalR, ovalR * 1.4).fill({ color: palette.bodyLight, alpha: 0.4 });
      g.ellipse(cx, cy, ovalR, ovalR * 1.4).stroke({ width: 0.75, color: palette.bodyDark, alpha: 0.5 });
    },
  },

  // --- Faz X — İç organlar (TASKS.md: "görsel olarak dışarıdan çizilmesi
  // gerekmiyor, sadece mekanik etkisi olan genetik özellikler"). Yine de
  // `OrganDefinition.draw` zorunlu olduğundan çok küçük/soluk, neredeyse
  // görünmez bir iç işaret çiziyoruz (kozmetik detay, mekanik etkinin ASIL
  // kaynağı `creature.ts`/`ecosystem.ts` — bkz. `metabolismMultiplier`/
  // `feedingEfficiency`). ---
  heart: {
    type: "heart",
    category: "defense", // ne hareket ne algı ne beslenme — mevcut kategorilerden en yakını "hayatta kalma" (defense)
    label: "Kalp",
    weight: 0.45,
    description: "Dolaşım verimliliğiyle metabolizma tüketimini azaltır.",
    draw(g, organ, r, palette) {
      const dotR = r * (0.06 + organ.power * 0.04);
      g.circle(-r * 0.15, 0, dotR).fill({ color: palette.bodyDark, alpha: 0.25 });
    },
  },

  stomach: {
    type: "stomach",
    category: "feeding",
    label: "Mide",
    weight: 0.45,
    description: "Besinden alınan enerjiyi ağızla birlikte ayrıca artırır.",
    draw(g, organ, r, palette) {
      const dotR = r * (0.08 + organ.power * 0.05);
      g.circle(r * 0.15, r * 0.1, dotR).fill({ color: palette.bodyDark, alpha: 0.2 });
    },
  },

  // --- Faz XIV — Sıra dışı/gerçek-dünya-ilhamlı organlar (TASKS.md madde 1) ---
  torpor: {
    type: "torpor",
    category: "defense",
    label: "Kışlama Bezi",
    weight: 0.4,
    description: "Enerji kritik düşükken metabolizmayı ciddi şekilde yavaşlatır (kışlama).",
    draw(g, organ, r, palette) {
      // Gövde üzerinde soluk, iç içe iki yay — "uyku/donma" izlenimi (kabuktan
      // ayırt edilsin diye kısmi/yarım halka, tam çember değil).
      const outerR = r * (1.05 + organ.power * 0.15);
      g.arc(0, 0, outerR, Math.PI * 0.15, Math.PI * 1.05).stroke({ width: 1, color: palette.bodyLight, alpha: 0.35 });
      g.arc(0, 0, outerR * 0.85, Math.PI * 0.15, Math.PI * 1.05).stroke({ width: 0.75, color: palette.bodyLight, alpha: 0.25 });
    },
  },

  blubber: {
    type: "blubber",
    category: "defense",
    label: "İzolasyon Tabakası",
    weight: 0.4,
    description: "İklim/sıcaklık dalgalanmalarının metabolizmaya etkisini azaltır.",
    draw(g, organ, r, palette) {
      // Gövdeyi saran kalın, soluk bir dış katman — "yağ tabakası" izlenimi.
      const layerR = r * (1.12 + organ.power * 0.18);
      g.circle(0, 0, layerR).fill({ color: palette.bodyLight, alpha: 0.18 });
      g.circle(0, 0, layerR).stroke({ width: 1, color: palette.bodyLight, alpha: 0.3 });
    },
  },

  bioluminescence: {
    type: "bioluminescence",
    category: "sense",
    label: "Biyolüminesans",
    weight: 0.35,
    description: "Algı menzilini artırır (özellikle karanlık/derin sularda fark etmeye yardımcı olan kendi ışığı).",
    draw(g, organ, r, palette, index, total) {
      void palette;
      // Gövde çevresinde birkaç küçük, parlak nokta — bal ışığı benekleri.
      const dots = 3;
      for (let i = 0; i < dots; i++) {
        const angle = slotAngle(i, dots, index * 0.7 + total * 0.3);
        const dist = r * 0.75;
        const dotR = r * (0.05 + organ.power * 0.04);
        g.circle(Math.cos(angle) * dist, Math.sin(angle) * dist, dotR).fill({ color: 0x9fe8ff, alpha: 0.85 });
      }
    },
  },

  venom: {
    type: "venom",
    category: "defense",
    label: "Zehir Bezi",
    weight: 0.35,
    description: "Avlanmadan kaçış şansını artırır (avcıyı caydırır).",
    draw(g, organ, r, palette, index, total) {
      // Diken benzeri ama daha kısa, dolgu rengi farklı (zehir sarısı-yeşili) uçlar.
      const count = Math.max(3, total);
      const angle = slotAngle(index, count, Math.PI * 0.5);
      const len = r * (0.22 + organ.power * 0.25);
      const baseX = Math.cos(angle) * r * 0.95;
      const baseY = Math.sin(angle) * r * 0.95;
      const tipX = Math.cos(angle) * (r + len);
      const tipY = Math.sin(angle) * (r + len);
      g.moveTo(baseX, baseY);
      g.lineTo(tipX, tipY);
      g.stroke({ width: 1.2, color: 0xb8e05a, alpha: 0.8 });
      g.circle(tipX, tipY, r * 0.06).fill({ color: 0xb8e05a, alpha: 0.9 });
      void palette;
    },
  },

  regeneration: {
    type: "regeneration",
    category: "feeding",
    label: "Rejenerasyon",
    weight: 0.35,
    description: "Beslenmeden kazanılan enerjiyi hafifçe artırır (hızlı toparlanma).",
    draw(g, organ, r, palette) {
      // Gövde üzerinde küçük, soluk bir spiral izlenimi (yenilenme).
      const turns = 1.5;
      const steps = 10;
      let started = false;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const a = t * Math.PI * 2 * turns;
        const d = r * 0.15 + t * r * (0.25 + organ.power * 0.15);
        const x = Math.cos(a) * d;
        const y = Math.sin(a) * d;
        if (!started) {
          g.moveTo(x, y);
          started = true;
        } else {
          g.lineTo(x, y);
        }
      }
      g.stroke({ width: 0.75, color: palette.bodyLight, alpha: 0.5 });
    },
  },

  // --- Faz XVI Madde 3 (v3, TASKS.md) — Gezegene özgü organlar. Mekanik etkileri
  // (aşağıdaki `description` ile birebir tutarlı, bkz. creature.ts) diğer tüm
  // organlar gibi SABİT/elle kodlanmış — sadece hangi gezegende MÜMKÜN oldukları
  // değişken (bkz. dosya sonundaki `setPlanetAllowedOrgans`). ---
  nitrogen_sac: {
    type: "nitrogen_sac",
    category: "defense", // ne hareket ne algı ne beslenme — "hayatta kalma" (heart/torpor ile aynı kategori)
    label: "Azot Deposu",
    weight: 0.4,
    description:
      "Metabolizma tüketimini azaltır (yüksek/orta azotlu gezegenlerde ortaya çıkabilen bir depolama organı).",
    draw(g, organ, r, palette) {
      // Gövde içinde soluk, oval bir "kese" izlenimi — kalp/mide gibi iç organ
      // çizimleriyle aynı ruhta (küçük, neredeyse görünmez bir işaret).
      const sacR = r * (0.12 + organ.power * 0.06);
      g.ellipse(-r * 0.1, -r * 0.2, sacR, sacR * 1.3).fill({ color: 0x9fd6c8, alpha: 0.28 });
      g.ellipse(-r * 0.1, -r * 0.2, sacR, sacR * 1.3).stroke({ width: 0.6, color: 0x9fd6c8, alpha: 0.4 });
      void palette;
    },
  },

  sulfur_vent_organ: {
    type: "sulfur_vent_organ",
    category: "feeding",
    label: "Kükürt Kemosentez Organı",
    weight: 0.4,
    description: "Kemosentezle beslenmeden kazanılan enerjiyi ayrıca artırır.",
    draw(g, organ, r, palette, index, total) {
      // Gövde kenarında küçük, sarımsı-yeşil bir "baca/tüp" çizgisi — hidrotermal
      // baca tüp kurdu ilhamlı, mouth/gill çizimleriyle aynı şematik dil.
      const angle = slotAngle(index, total, Math.PI * 0.15);
      const len = r * (0.3 + organ.power * 0.3);
      const baseX = Math.cos(angle) * r * 0.9;
      const baseY = Math.sin(angle) * r * 0.9;
      const tipX = Math.cos(angle) * (r + len);
      const tipY = Math.sin(angle) * (r + len);
      g.moveTo(baseX, baseY);
      g.lineTo(tipX, tipY);
      g.stroke({ width: 1.3, color: 0xc9d65a, alpha: 0.75 });
      g.circle(tipX, tipY, r * 0.07).fill({ color: 0xc9d65a, alpha: 0.85 });
      void palette;
    },
  },

  chromatophore: {
    type: "chromatophore",
    category: "defense",
    label: "Kromatofor (Aktif Kamuflaj)",
    weight: 0.35,
    description: "Yakalanma anında ek, tepkisel bir kaçış şansı sağlar (mürekkep balığı ilhamlı).",
    draw(g, organ, r, palette) {
      // Kamuflaj'ın sabit/düzensiz beneklerinden farklı — birkaç örtüşen, çok renkli
      // (kontrast bir vurgu rengiyle) düzensiz "leke" halkası: "aktif renk değişimi"
      // izlenimi, kamuflaj'ın tek-renkli düşük-alfa benek deseninden görsel olarak
      // ayırt edilebilir olsun diye.
      const patches = 3 + Math.round(organ.power * 2);
      let seed = 7;
      const rand = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
      const accentColor = 0xd65ab8; // magenta/pembe vurgu — gövde paletinden bağımsız, "renk değişimi" hissi
      for (let i = 0; i < patches; i++) {
        const a = (i / patches) * Math.PI * 2 + rand() * 0.6;
        const d = r * (0.25 + rand() * 0.35);
        const patchR = r * (0.14 + rand() * 0.1 + organ.power * 0.06);
        g.circle(Math.cos(a) * d, Math.sin(a) * d, patchR).fill({ color: accentColor, alpha: 0.22 });
        g.circle(Math.cos(a) * d, Math.sin(a) * d, patchR).stroke({ width: 0.75, color: accentColor, alpha: 0.5 });
      }
      void palette;
    },
  },

  symbiotic_gut_flora: {
    type: "symbiotic_gut_flora",
    category: "feeding",
    label: "Simbiyotik Bağırsak Florası",
    weight: 0.35,
    description: "Avdan sonraki sindirim molası süresini kısaltır (daha sık avlanma fırsatı).",
    draw(g, organ, r, palette) {
      // Kalp/mide gibi küçük, iç organ çizim dilinde ama KIVRIMLI bir "bağırsak/koloni"
      // izlenimi — birkaç küçük, üst üste binen daire (koloniyi çoğaltan mikroorganizma
      // hissi), stomach'ın tek bir noktasından görsel olarak ayırt edilebilir.
      const dots = 3 + Math.round(organ.power * 2);
      for (let i = 0; i < dots; i++) {
        const t = i / Math.max(1, dots - 1);
        const x = r * (-0.05 + t * 0.3);
        const y = r * (0.2 + Math.sin(t * Math.PI * 1.5) * 0.08);
        const dotR = r * (0.045 + organ.power * 0.025);
        g.circle(x, y, dotR).fill({ color: 0x8fbf6a, alpha: 0.28 });
      }
      void palette;
    },
  },
};

export const ALL_ORGAN_TYPES = Object.keys(ORGAN_DEFINITIONS) as OrganType[];

/** "Karaya çıkış imkânı" veren organ tipleri — TASKS.md "Su → kara geçişi": bacak
 *  sahibi bir birey karaya çıkabilir. Fırsatçı sisteme uygun şekilde bir liste olarak
 *  tanımlanıyor (gelecekte başka bir kara-uyumlu organ eklenirse buraya eklenir). */
export const LAND_CAPABLE_ORGAN_TYPES: readonly OrganType[] = ["leg"];

export function hasOrganType(organs: readonly Organ[], type: OrganType): boolean {
  return organs.some((o) => o.type === type);
}

export function getOrgan(organs: readonly Organ[], type: OrganType): Organ | undefined {
  return organs.find((o) => o.type === type);
}

export function canWalkOnLand(organs: readonly Organ[]): boolean {
  return organs.some((o) => LAND_CAPABLE_ORGAN_TYPES.includes(o.type));
}

/**
 * Faz VII — Gemini'nin hafif yönlendirmesi (TASKS.md): Gemini periyodik olarak bir
 * organ tipi için küçük, SINIRLI bir ağırlık çarpanı önerebilir. Bu asla bir organı
 * tamamen açıp kapatmaz ve birikimli olarak sınırsız büyümez — `MIN_MULTIPLIER`/
 * `MAX_MULTIPLIER` arasında SIKI bir clamp uygulanır (±%20 aralığı çevresinde tutulur,
 * TASKS.md: "±%10-20 sınırı içinde"). Gemini hiç çağrılmadıysa veya yanıtı geçersizse
 * bu harita boş kalır ve `pickRandomOrganType` sabit ağırlıklarla (mevcut Faz II
 * davranışı) çalışmaya devam eder — tek nokta arıza yok.
 */
const MIN_ORGAN_WEIGHT_MULTIPLIER = 0.8;
const MAX_ORGAN_WEIGHT_MULTIPLIER = 1.2;

const organWeightMultipliers = new Map<OrganType, number>();

/** Gemini'den gelen bir öneriyi uygular — `delta` (örn. 0.15 = %15 artış, -0.15 = %15
 *  azalış) MEVCUT çarpana eklenir, sonra SIKI bir üst/alt sınıra clamp edilir (kalıcı,
 *  sınırsız birikim engellenir — TASKS.md: "birikimli olarak sınırsız büyümesin, bir
 *  üst/alt sınır olsun"). `delta` kendisi de tek bir çağrıda ±0.2'yi aşamaz (savunma
 *  amaçlı ikinci bir sınır — Gemini'nin döndürdüğü sayı ne olursa olsun). */
export function applyOrganWeightSuggestion(type: OrganType, delta: number): void {
  if (!ALL_ORGAN_TYPES.includes(type)) return;
  if (!Number.isFinite(delta)) return;
  const clampedDelta = Math.min(0.2, Math.max(-0.2, delta));
  const current = organWeightMultipliers.get(type) ?? 1;
  const next = Math.min(MAX_ORGAN_WEIGHT_MULTIPLIER, Math.max(MIN_ORGAN_WEIGHT_MULTIPLIER, current + clampedDelta));
  organWeightMultipliers.set(type, next);
}

/** Test/hata ayıklama amaçlı — mevcut çarpan haritasının salt-okunur bir görünümü. */
export function getOrganWeightMultipliers(): ReadonlyMap<OrganType, number> {
  return organWeightMultipliers;
}

export function resetOrganWeightMultipliers(): void {
  organWeightMultipliers.clear();
}

function effectiveWeight(type: OrganType): number {
  const base = ORGAN_DEFINITIONS[type].weight;
  const multiplier = organWeightMultipliers.get(type) ?? 1;
  return base * multiplier;
}

/**
 * Faz XVI Madde 3 (v3, TASKS.md) — Gezegene özgü organ filtrelemesi: "hangi organlar
 * bu gezegende mümkün" katmanı. Organ HAVUZUNUN kendisi (`ORGAN_DEFINITIONS`) hâlâ
 * elle kodlanmış/sabit mekanik etkili kalıyor (PM'in Faz XIV'te verdiği güvenlik
 * kararı DEĞİŞMEDİ) — burada sadece `pickRandomOrganType`'ın seçim havuzunu, mevcut
 * gezegenin oluşum profiline (bkz. `planetformation.ts`) göre BİR ADIM daha
 * daraltıyoruz. Varsayılan (hiç çağrılmamışsa) davranış: TÜM organlar mümkün — yani
 * `main.ts` bu fonksiyonu hiç çağırmasa bile eski davranış (Faz II-XV) AYNEN çalışır,
 * tek nokta arıza riski yok.
 *
 * Uygulama: `main.ts` simülasyon başlarken (gezegen profili hesaplandıktan hemen
 * sonra) `setPlanetAllowedOrgans` çağırıp bu gezegende YASAK organ tiplerini bildirir
 * (mümkün olanları değil, YASAK olanları — bu şekilde yeni bir genel organ eklenince
 * varsayılan olarak "her gezegende mümkün" kalır, sadece gezegene-özgü olanlar açıkça
 * kısıtlanır). Şu anki kural (basit, TASKS.md örneğiyle birebir tutarlı):
 * - `nitrogen_sac` (azot deposu): SADECE azot seviyesi "moderate" veya "high" olan
 *   gezegenlerde mümkün — düşük azotlu bir gezegende hiç ortaya çıkamaz.
 * - `sulfur_vent_organ` (kükürt kemosentez organı): SADECE gezegenin "bio madde"
 *   listesinde kükürt/sülfür içeren bir bileşen varsa mümkün.
 */
const planetForbiddenOrgans = new Set<OrganType>();

/** `main.ts` simülasyon başlarken bir kez çağırır — bu gezegende YASAK organ
 *  tiplerinin tam listesini (birikimli DEĞİL, her çağrı öncekini TAMAMEN değiştirir)
 *  bildirir. Boş bir liste = bu gezegende tüm organlar mümkün (varsayılan davranış). */
export function setPlanetForbiddenOrgans(forbidden: readonly OrganType[]): void {
  planetForbiddenOrgans.clear();
  for (const t of forbidden) planetForbiddenOrgans.add(t);
}

/** Test/hata ayıklama + `main.ts`'in kendi mantığı için salt-okunur görünüm. */
export function getPlanetForbiddenOrgans(): ReadonlySet<OrganType> {
  return planetForbiddenOrgans;
}

export function resetPlanetForbiddenOrgans(): void {
  planetForbiddenOrgans.clear();
}

/** Havuzdan ağırlıklı rastgele bir organ tipi seçer (henüz sahip olunmayanlar arasından
 *  tercihen — tamamen fırsatçı, sabit sıra yok). `excludeTypes` zaten sahip olunanları
 *  dışarıda bırakmak için kullanılır (aynı tipten organ zaten varsa güncelleme, ekleme
 *  değil, `divideGenome` tarafında ayrıca ele alınıyor). Faz VII: ağırlıklar Gemini'nin
 *  önerdiği (sınırlı) çarpanlarla hafifçe kaydırılmış olabilir, bkz. `applyOrganWeightSuggestion`.
 *  Faz XVI Madde 3: havuz ayrıca `planetForbiddenOrgans`'a göre daraltılıyor — bu
 *  gezegende yasak bir organ tipi ASLA seçilmiyor (havuzda hiç yer almıyor bile). */
export function pickRandomOrganType(excludeTypes: readonly OrganType[] = []): OrganType {
  const planetAllowed = ALL_ORGAN_TYPES.filter((t) => !planetForbiddenOrgans.has(t));
  const basePool = planetAllowed.length > 0 ? planetAllowed : ALL_ORGAN_TYPES;
  const candidates = basePool.filter((t) => !excludeTypes.includes(t));
  const pool = candidates.length > 0 ? candidates : basePool;
  const totalWeight = pool.reduce((sum, t) => sum + effectiveWeight(t), 0);
  let roll = Math.random() * totalWeight;
  for (const t of pool) {
    roll -= effectiveWeight(t);
    if (roll <= 0) return t;
  }
  return pool[pool.length - 1];
}
