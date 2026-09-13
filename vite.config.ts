import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

/**
 * Faz V (v3) — Gemini API sunucu-taraflı proxy (TASKS.md "Derin analiz için Gemini API
 * entegrasyonu"). GÜVENLİK: `GEMINI_API_KEY` istemciye/tarayıcıya ASLA gitmemeli — bu
 * yüzden `VITE_` önekiyle env değişkeni olarak EKLENMEDİ (Vite yalnızca `VITE_` önekli
 * değişkenleri client bundle'a gömer, ama biz bunu bilerek kullanmıyoruz). Bunun yerine
 * dev server'a küçük bir Node-taraflı middleware eklendi: `/api/gemini-insight`
 * endpoint'i isteği alır, anahtarı `process.env.GEMINI_API_KEY`'den (sadece sunucu
 * tarafında, dotenv ile `.env`'den okunur) kullanarak Gemini REST API'sine sunucu
 * tarafından istek atar ve sonucu JSON olarak client'a döndürür. Anahtar hiçbir zaman
 * response gövdesi dışında client'a gönderilmez ve response'a da eklenmez.
 *
 * Model: `gemini-flash-lite-latest` (Faz VIII ek düzeltme, 2026-09-02 — kullanıcı
 * geri bildirimi). Önceki `gemini-3.6-flash` çalışıyordu ama ücretsiz katmanda GÜNDE
 * SADECE 20 istek kotası var (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`) ve
 * kullanıcı bunu doldurup `RESOURCE_EXHAUSTED` hatası aldı — soy analizi butonu
 * "yanıt alınamadı" gösterdi. `gemini-flash-lite-latest` canlı `curl`/fetch testiyle
 * doğrulandı (200 OK, gerçek yanıt), "lite" modeller genelde ayrı/daha yüksek bir
 * ücretsiz kota bucket'ına sahip oluyor. Eski model adları (`gemini-1.5-flash`,
 * `gemini-2.0-flash`, `gemini-2.5-flash`) bu hesapta 404/kaldırılmış durumda.
 */
const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function geminiProxyPlugin(): Plugin {
  return {
    name: "gemini-insight-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api/gemini-insight", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });

        req.on("end", async () => {
          try {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "GEMINI_API_KEY tanımlı değil (.env eksik)" }));
              return;
            }

            const parsed = JSON.parse(body || "{}") as { prompt?: string };
            const prompt = parsed.prompt;
            if (!prompt || typeof prompt !== "string") {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Geçersiz istek: 'prompt' alanı gerekli" }));
              return;
            }

            const upstream = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 320 },
              }),
            });

            const data = (await upstream.json()) as {
              candidates?: { content?: { parts?: { text?: string }[] } }[];
              error?: { message?: string };
            };

            if (!upstream.ok) {
              res.statusCode = upstream.status;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: data.error?.message ?? "Gemini API hatası" }));
              return;
            }

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ text: text ?? "" }));
          } catch (err) {
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error: err instanceof Error ? err.message : "Bilinmeyen sunucu hatası",
              })
            );
          }
        });
      });
    },
  };
}

/**
 * Faz XI (Otonom Çalışma Modu, kullanıcı isteği — "hem frontend hem backend işler
 * bekliyorum") — Popülasyon/soy verisi telemetri API'si. Simülasyon tamamen
 * client-side çalıştığından (PixiJS, sunucu tarafında hiçbir sim state'i yok),
 * gerçek bir "backend" işlevi görmesi için client periyodik olarak (mevcut
 * otomatik-kayıt zamanlayıcısıyla AYNI aralıkta, bkz. `main.ts`) özet bir anlık
 * görüntüyü buraya POST eder; sunucu bunu SADECE BELLEKTE (in-memory, kalıcı disk
 * yazımı yok — kaydet/yükle sisteminden tamamen bağımsız, ona dokunmuyor) tutar.
 * Bu, dışarıdaki bir araç/script'in (örn. `curl http://localhost:5173/api/population-snapshot`)
 * projenin GÜNCEL durumunu okuyabilmesini sağlar — salt-okunur bir dışa açılım,
 * hiçbir mekaniği/veriyi DEĞİŞTİRMEZ. Anahtar/gizli veri İÇERMEZ (sadece popülasyon
 * sayıları/organ dağılımı gibi istatistik).
 */
interface PopulationSnapshot {
  receivedAt: string;
  population: number;
  maxGeneration: number;
  historicalMaxGeneration: number;
  totalBirths: number;
  herbivoreCount: number;
  carnivoreCount: number;
  simTimeSeconds: number;
  organPrevalence: Record<string, number>;
}

let latestSnapshot: PopulationSnapshot | null = null;

/**
 * Faz XI (2. tur, 2026-09-09, PM onaylı) — Zaman serisi genişletmesi: kullanıcının
 * "hem frontend hem backend" isteği doğrultusunda, tekil "son anlık görüntü"nün
 * YANINA (davranışını KIRMADAN, geriye dönük uyumlu) son N görüntüyü tutan basit
 * bir ring-buffer eklendi — `GET /api/population-snapshot/history` ile popülasyon
 * trendinin (çöküş/patlama) zaman içinde gözlemlenmesini sağlar. Hâlâ SADECE
 * BELLEKTE (disk yazımı yok), hâlâ yeni bir framework/server yok — aynı middleware
 * deseni içinde `req.url` ile alt-yol ayrımı yapılıyor.
 */
const SNAPSHOT_HISTORY_LIMIT = 50;
const snapshotHistory: PopulationSnapshot[] = [];

function populationTelemetryPlugin(): Plugin {
  return {
    name: "population-telemetry-api",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api/population-snapshot", (req, res) => {
        // Connect middleware "/api/population-snapshot" önekiyle eşleşen HER isteği
        // buraya yönlendirir (örn. "/api/population-snapshot/history" dahil) — bu
        // yüzden alt-yol ayrımı burada `req.url` ile elle yapılıyor.
        const url = req.url ?? "/";
        const isHistory = url === "/history" || url.startsWith("/history?");

        if (isHistory) {
          if (req.method !== "GET") {
            res.statusCode = 405;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Method not allowed" }));
            return;
          }
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ count: snapshotHistory.length, snapshots: snapshotHistory }));
          return;
        }

        if (url !== "/" && url !== "") {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Bilinmeyen alt-yol" }));
          return;
        }

        if (req.method === "GET") {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(latestSnapshot ?? { message: "Henüz bir anlık görüntü alınmadı" }));
          return;
        }

        if (req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", () => {
            try {
              const parsed = JSON.parse(body || "{}") as Partial<PopulationSnapshot>;
              if (typeof parsed.population !== "number") {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Geçersiz istek: 'population' sayısal alanı gerekli" }));
                return;
              }
              latestSnapshot = {
                receivedAt: new Date().toISOString(),
                population: parsed.population,
                maxGeneration: parsed.maxGeneration ?? 0,
                historicalMaxGeneration: parsed.historicalMaxGeneration ?? 0,
                totalBirths: parsed.totalBirths ?? 0,
                herbivoreCount: parsed.herbivoreCount ?? 0,
                carnivoreCount: parsed.carnivoreCount ?? 0,
                simTimeSeconds: parsed.simTimeSeconds ?? 0,
                organPrevalence: parsed.organPrevalence ?? {},
              };
              snapshotHistory.push(latestSnapshot);
              if (snapshotHistory.length > SNAPSHOT_HISTORY_LIMIT) {
                snapshotHistory.shift();
              }
              res.statusCode = 204;
              res.end();
            } catch {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Geçersiz JSON gövdesi" }));
            }
          });
          return;
        }

        res.statusCode = 405;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Method not allowed" }));
      });
    },
  };
}

export default defineConfig({
  root: ".",
  plugins: [geminiProxyPlugin(), populationTelemetryPlugin()],
  server: {
    port: 5173,
    strictPort: false,
  },
});
