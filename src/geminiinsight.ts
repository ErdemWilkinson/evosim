/**
 * Faz V (v3) — Gemini API ile derin analiz (TASKS.md "Derin analiz için Gemini API
 * entegrasyonu"). Bu modül SADECE client tarafında çalışır ve anahtarı hiç görmez —
 * `/api/gemini-insight` adlı sunucu-taraflı proxy'ye (bkz. `vite.config.ts`) ham
 * simülasyon verisini (organ dağılımı, popülasyon/enerji trendi, son olaylar) içeren
 * kısa bir prompt gönderir, dönen metni alır.
 *
 * DÜRÜSTLÜK/HALÜSİNASYON KURALI: Prompt açıkça "sadece verilen sayısal veriye dayan,
 * uydurma yapma, veri yetersizse bunu söyle" talimatını içeriyor (TASKS.md gereksinimi).
 *
 * HATA TOLERANSI: API çağrısı başarısız olursa (ağ hatası, geçersiz anahtar, rate limit,
 * beklenmeyen yanıt şekli) bu modül ASLA fırlatmaz — `null` döner ve hatayı konsola
 * sessizce loglar. Gemini bir "ek" özellik, mevcut eşik-tabanlı event sistemi (Faz III)
 * bundan tamamen bağımsız çalışmaya devam eder (TASKS.md — "tek nokta arıza olmamalı").
 *
 * Faz VII (v3) — Gemini'nin hafif yönlendirmesi (TASKS.md): mevcut yorum metnine EK
 * olarak, aynı çağrıda Gemini'den yapılandırılmış (JSON) küçük bir "eğilim" önerisi de
 * isteniyor — hangi organ TİPİNİN (veya "sexual" üreme stratejisinin) mutasyon
 * ağırlığının hafifçe artırılması/azaltılması gerektiği. Gemini simülasyona DOĞRUDAN
 * karışmıyor (gerçek zamanlı/deterministik kalıyor) — bu öneri sadece `organs.ts`/
 * `genome.ts`'teki SINIRLI (±%20) çarpanlara uygulanıyor (bkz. `main.ts`
 * `applyGeminiWeightSuggestion`). Yanıt parse edilemezse/geçersizse `suggestion: null`
 * döner — sessizce görmezden gelinir, sabit ağırlıklarla devam edilir.
 */

import { ALL_ORGAN_TYPES } from "./organs";

export interface EcosystemSnapshot {
  simTimeSeconds: number;
  population: number;
  maxGeneration: number;
  totalBirths: number;
  waterPercent: number;
  organPrevalence: Record<string, number>;
  averageEnergyRatio: number;
  recentEvents: string[];
}

/** Faz VII — Gemini'nin yapılandırılmış öneri şekli. `target` "sexual" ise üreme
 *  stratejisi çarpanını, aksi halde bir `OrganType` ismini hedefler. `weightAdjustment`
 *  -0.2..0.2 arası bir öneri (uygulama tarafında ayrıca clamp edilir — burada sadece
 *  şekil doğrulanır, sınırlama `organs.ts`/`genome.ts`'te). */
export interface GeminiWeightSuggestion {
  target: string;
  weightAdjustment: number;
}

/**
 * Faz XIII (v3, opsiyonel madde 3) — Soy-bazlı davranış eğilimi önerisi. Faz VII'nin
 * organ ağırlık önerisiyle AYNI güvenlik felsefesi: küçük/sınırlı (-0.2..0.2), ana
 * hareket mantığı (bkz. `ecosystem.ts` stepHerbivore/stepCarnivore) ASLA bu öneriye
 * veya senkron bir API çağrısına bağımlı değil — Gemini hiç yanıt vermese/başarısız
 * olsa bile davranış tamamen lokal/deterministik çalışmaya devam eder (bkz.
 * `main.ts` `applyGeminiBehaviorSuggestion`, sadece periyodik/düşük sıklıklı mevcut
 * çağrı yapısını kullanır, YENİ bir döngü eklenmedi).
 * - "wanderBoldness": pozitif -> biraz daha az tedirgin (flee eşiği hafifçe düşer,
 *   yani biraz daha geç kaçar), negatif -> biraz daha ürkek.
 * - "foragingPriority": pozitif -> tokluk eşiği hafifçe yükselir (besin aramaya biraz
 *   daha istekli/uzun sürede tok sayılır), negatif -> tam tersi.
 */
export interface GeminiBehaviorSuggestion {
  trait: "wanderBoldness" | "foragingPriority";
  adjustment: number;
}

export interface GeminiInsightResult {
  text: string;
  suggestion: GeminiWeightSuggestion | null;
  behaviorSuggestion: GeminiBehaviorSuggestion | null;
}

function buildPrompt(snapshot: EcosystemSnapshot): string {
  const organLines = Object.entries(snapshot.organPrevalence)
    .map(([type, count]) => `  - ${type}: ${count} birey`)
    .join("\n");
  const eventLines =
    snapshot.recentEvents.length > 0
      ? snapshot.recentEvents.map((e) => `  - ${e}`).join("\n")
      : "  - (henüz kayıtlı olay yok)";

  return [
    "Sen bir evrim simülasyonunun ham sayısal verisini yorumlayan bir bilim asistanısın.",
    "KURAL: SADECE aşağıda verilen sayısal veriye dayanarak KISA (en fazla 2-3 cümle),",
    "sade bir bilimsel yorum/çıkarım üret. UYDURMA YAPMA. Veriden çıkarım yapmak için",
    "yeterli bilgi yoksa (örn. popülasyon çok küçükse veya olay yoksa) bunu açıkça söyle.",
    "Türkçe cevap ver. Markdown/madde işareti kullanma, düz metin yaz.",
    "",
    "=== SİMÜLASYON VERİSİ ===",
    `Simülasyon zamanı: t=${Math.round(snapshot.simTimeSeconds)}s`,
    `Popülasyon: ${snapshot.population}`,
    `Maksimum nesil: ${snapshot.maxGeneration}`,
    `Toplam bölünme (doğum): ${snapshot.totalBirths}`,
    `Dünya: %${Math.round(snapshot.waterPercent)} su / %${Math.round(100 - snapshot.waterPercent)} kara`,
    `Ortalama enerji oranı (enerji/maksimum enerji): ${snapshot.averageEnergyRatio.toFixed(2)}`,
    "Organ dağılımı (kaç bireyde hangi organ var):",
    organLines || "  - (organ yok)",
    "Son eşik-tabanlı evrim olayları:",
    eventLines,
    "=== VERİ SONU ===",
    "",
    "EK GÖREV 1 (yorumdan sonra, AYRI bir satırda): yukarıdaki veriye dayanarak, hangi",
    `organ tipinin (${ALL_ORGAN_TYPES.join(", ")}) veya 'sexual' (cinsel üreme stratejisi) mutasyon ağırlığının HAFİFÇE`,
    "artırılması ya da azaltılması gerektiğine dair küçük bir öneri üret. Bu öneri",
    "SADECE küçük bir eğilim sinyali, kesin bir karar DEĞİL. Yorum metninden SONRA,",
    "yeni bir satırda TAM OLARAK şu formatta tek satırlık bir JSON yaz (başka hiçbir",
    "şey ekleme, kod bloğu/backtick kullanma):",
    '{"target": "<organ_tipi_veya_sexual>", "weightAdjustment": <-0.2 ile 0.2 arası sayı>}',
    "Yeterli veri yoksa veya net bir eğilim gözlemlemiyorsan weightAdjustment için 0 yaz.",
    "",
    "EK GÖREV 2 (yukarıdaki JSON'dan SONRA, yeni bir satırda): popülasyonun genel",
    "DAVRANIŞ eğilimine dair de küçük bir öneri üret — 'wanderBoldness' (canlılar",
    "tehlikeden ne kadar çabuk kaçmalı: pozitif=daha az tedirgin/cesur, negatif=daha",
    "ürkek) veya 'foragingPriority' (besin aramaya ne kadar istekli olmalılar:",
    "pozitif=daha istekli, negatif=daha az istekli) türlerinden BİRİNİ seç. TAM OLARAK",
    "şu formatta tek satırlık bir JSON yaz (başka hiçbir şey ekleme):",
    '{"trait": "<wanderBoldness_veya_foragingPriority>", "adjustment": <-0.2 ile 0.2 arası sayı>}',
    "Yeterli veri yoksa veya net bir eğilim gözlemlemiyorsan adjustment için 0 yaz.",
  ].join("\n");
}

/** Gemini'nin serbest metin yanıtından (yorum + JSON satırı) yapılandırılmış öneriyi
 *  çıkarır. Metnin SON satırındaki `{...}` bloğunu arar — bulunamazsa/parse edilemezse
 *  veya şekli beklenenden farklıysa `null` döner (TASKS.md: "parse edilemezse/hatalıysa
 *  sessizce görmezden gel"). Yorum metninin kendisi bu JSON satırı çıkarılarak döndürülür.
 *  Bug-avı düzeltmesi (tester 62 bulgusu, 2026-09-10, PM onaylı): eskiden burada Faz
 *  II'nin orijinal 10 organ tipi SABİT/elle yazılıydı — proje Faz X/XIV/XVI'da 21 organ
 *  tipine çıkınca bu liste güncellenmemiş, Gemini yeni bir organ (örn. "venom") önerse
 *  bile SESSİZCE reddediliyordu. Artık `organs.ts` `ALL_ORGAN_TYPES`'tan TÜRETİLİYOR —
 *  yeni bir organ tipi eklendiğinde burası otomatik güncel kalır, ikinci bir yer
 *  unutulmaz. */
const VALID_SUGGESTION_TARGETS: readonly string[] = [...ALL_ORGAN_TYPES, "sexual"];

/** Faz XIII — Madde 3: `GeminiBehaviorSuggestion.trait` için geçerli değerler. */
const VALID_BEHAVIOR_TRAITS = ["wanderBoldness", "foragingPriority"];

function extractSuggestion(
  rawText: string
): { text: string; suggestion: GeminiWeightSuggestion | null; behaviorSuggestion: GeminiBehaviorSuggestion | null } {
  let workingText = rawText;
  let suggestion: GeminiWeightSuggestion | null = null;
  let behaviorSuggestion: GeminiBehaviorSuggestion | null = null;

  const jsonMatch = workingText.match(/\{[^{}]*"target"[^{}]*\}/);
  if (jsonMatch) {
    workingText =
      workingText.slice(0, jsonMatch.index) + workingText.slice((jsonMatch.index ?? 0) + jsonMatch[0].length);
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { target?: unknown; weightAdjustment?: unknown };
      const target = parsed.target;
      const weightAdjustment = parsed.weightAdjustment;
      if (
        typeof target === "string" &&
        VALID_SUGGESTION_TARGETS.includes(target) &&
        typeof weightAdjustment === "number" &&
        Number.isFinite(weightAdjustment) &&
        weightAdjustment !== 0
      ) {
        suggestion = { target, weightAdjustment };
      }
    } catch {
      // Parse hatası — sessizce görmezden gel (suggestion null kalır).
    }
  }

  // Faz XIII — Madde 3: ikinci (opsiyonel) davranış eğilimi JSON'u — Faz VII'nin
  // organ önerisiyle AYNI "parse edilemezse/geçersizse sessizce yok say" ilkesi.
  const behaviorMatch = workingText.match(/\{[^{}]*"trait"[^{}]*\}/);
  if (behaviorMatch) {
    workingText =
      workingText.slice(0, behaviorMatch.index) +
      workingText.slice((behaviorMatch.index ?? 0) + behaviorMatch[0].length);
    try {
      const parsed = JSON.parse(behaviorMatch[0]) as { trait?: unknown; adjustment?: unknown };
      const trait = parsed.trait;
      const adjustment = parsed.adjustment;
      if (
        typeof trait === "string" &&
        VALID_BEHAVIOR_TRAITS.includes(trait) &&
        typeof adjustment === "number" &&
        Number.isFinite(adjustment) &&
        adjustment !== 0
      ) {
        behaviorSuggestion = { trait: trait as GeminiBehaviorSuggestion["trait"], adjustment };
      }
    } catch {
      // Parse hatası — sessizce görmezden gel (behaviorSuggestion null kalır).
    }
  }

  const cleanedText = workingText.trim();
  return { text: cleanedText || rawText.trim(), suggestion, behaviorSuggestion };
}

/**
 * Faz IX (v3) — "Gemini'den daha fazla yararlanma" (TASKS.md madde 7): seçili bir
 * birey/soy hattı için İSTEĞE BAĞLI (buton ile tetiklenen, OTOMATİK/periyodik DEĞİL —
 * maliyet/rate-limit için) bir "Bu soyu analiz et" özelliği. Aynı `/api/gemini-insight`
 * proxy'sini KULLANIR (ayrı bir endpoint/anahtar yolu gerekmiyor, mevcut sunucu-taraflı
 * güvenlik modeli — anahtar client'a asla gitmiyor — burada da geçerli), sadece farklı
 * bir prompt gönderir. Aynı hata toleransı ilkesi (Faz V/VII): başarısız olursa `null`
 * döner, çağıran taraf (main.ts) bunu kullanıcıya nazikçe gösterir, uygulama çökmez.
 */
export interface LineageAnalysisInput {
  individualId: number;
  generation: number;
  isAlive: boolean;
  lifespanSeconds: number | null;
  offspringCount: number;
  diet: "herbivore" | "carnivore";
  organs: string[];
  ancestryOrganGains: { generation: number; label: string }[];
}

function buildLineageAnalysisPrompt(input: LineageAnalysisInput): string {
  const gainsLines =
    input.ancestryOrganGains.length > 0
      ? input.ancestryOrganGains.map((g) => `  - Nesil ${g.generation}: ${g.label} kazanıldı`).join("\n")
      : "  - (bilinen bir organ kazanım olayı yok)";

  return [
    "Sen bir evrim simülasyonundaki TEK BİR bireyin/soy hattının ham verisini yorumlayan",
    "bir bilim asistanısın. KURAL: SADECE aşağıdaki sayısal/olgusal veriye dayanarak KISA",
    "(en fazla 3-4 cümle) bir yorum üret. UYDURMA YAPMA — verilmeyen bir şeyi (örn. bu",
    "bireyin hiç yaşamadığı bir olay) asla icat etme. Türkçe cevap ver. Markdown/madde",
    "işareti kullanma, düz metin yaz. JSON YAZMA, sadece yorum metni.",
    "",
    "=== BİREY/SOY HATTI VERİSİ ===",
    `Birey ID: #${input.individualId}`,
    `Nesil: ${input.generation}`,
    `Durum: ${input.isAlive ? "hayatta" : "öldü"}`,
    input.lifespanSeconds !== null ? `Yaşam süresi: ${Math.round(input.lifespanSeconds)} saniye` : "Yaşam süresi: bilinmiyor",
    `Yavru sayısı: ${input.offspringCount}`,
    `Diyet: ${input.diet === "carnivore" ? "etçil" : "otçul"}`,
    `Şu anki organlar: ${input.organs.length > 0 ? input.organs.join(", ") : "(organsız)"}`,
    "Soy hattı boyunca organ kazanım sırası (atalardan bu bireye doğru):",
    gainsLines,
    "=== VERİ SONU ===",
  ].join("\n");
}

export async function fetchLineageAnalysis(input: LineageAnalysisInput): Promise<string | null> {
  try {
    const prompt = buildLineageAnalysisPrompt(input);
    const response = await fetch("/api/gemini-insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.warn("[Gemini/Soy Analizi] İstek başarısız:", response.status, errBody);
      return null;
    }

    const data = (await response.json()) as { text?: string; error?: string };
    if (data.error) {
      console.warn("[Gemini/Soy Analizi] Sunucu hatası:", data.error);
      return null;
    }
    if (!data.text) {
      console.warn("[Gemini/Soy Analizi] Boş yanıt alındı.");
      return null;
    }
    return data.text.trim();
  } catch (err) {
    console.warn("[Gemini/Soy Analizi] İstek atılamadı (ağ/parse hatası):", err);
    return null;
  }
}

export async function fetchGeminiInsight(snapshot: EcosystemSnapshot): Promise<GeminiInsightResult | null> {
  try {
    const prompt = buildPrompt(snapshot);
    const response = await fetch("/api/gemini-insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.warn("[Gemini] İstek başarısız:", response.status, errBody);
      return null;
    }

    const data = (await response.json()) as { text?: string; error?: string };
    if (data.error) {
      console.warn("[Gemini] Sunucu hatası:", data.error);
      return null;
    }
    if (!data.text) {
      console.warn("[Gemini] Boş yanıt alındı.");
      return null;
    }

    // Faz VII — yorum metninden yapılandırılmış öneriyi ayıkla. Parse edilemezse/
    // geçersizse `suggestion: null` ile devam edilir — tek nokta arıza olmamalı,
    // yorum metni yine de kullanılabilir olsun. Faz XIII — aynı çağrı/ayıklama
    // içinde opsiyonel `behaviorSuggestion` da (madde 3) aynı toleransla çıkarılıyor.
    try {
      const { text, suggestion, behaviorSuggestion } = extractSuggestion(data.text);
      return { text: text || data.text, suggestion, behaviorSuggestion };
    } catch (err) {
      console.warn("[Gemini] Öneri ayrıştırılamadı (yorum metni yine de kullanılıyor):", err);
      return { text: data.text, suggestion: null, behaviorSuggestion: null };
    }
  } catch (err) {
    // Ağ hatası, proxy çalışmıyor, JSON parse hatası vb. — sessizce logla, uygulamayı
    // ASLA çökertme (TASKS.md — "tek nokta arıza olmamalı").
    console.warn("[Gemini] İstek atılamadı (ağ/parse hatası):", err);
    return null;
  }
}
