# Evosim (eski adıyla Evrimsel Gezegen) — Proje Spesifikasyonu (v3, tam sıfırlama)

> **Not**: Tarihsel detaylar/tester kanıtları için `TASKS_ARCHIVE.md`'ye bakın.
> Her fazın burada 1-3 satırlık bir özeti var; tam uygulama detayı ve bağımsız
> tester doğrulama raporu arşiv dosyasında (`TASKS_ARCHIVE.md#faz-i` gibi
> başlıklarla) kronolojik sırayla tutuluyor.

## Önceki sürümlerle ilgili not
- **v1** (Webbed tarzı sevimli/karikatür canlılarla bir "yaşam simülasyonu"):
  kullanıcı tarafından reddedildi — "evrim simülasyonu istedim, yaşam simülasyonu
  değil".
- **v2** (dairesel gezegen + bilimsel/D3 dashboard: filogenetik ağaç, trait
  histogramları, sekmeli panel): kullanıcı tarafından yine reddedildi — menü/
  dashboard fazla karmaşık bulundu, konsept "hazır canlılar bir gezegende
  yaşıyor" yerine "mikroorganizmadan başlayan gerçek bir evrim/organ kazanma
  süreci" olmalı, ayrıca dairesel gezegen yerine düz bir harita (su+kara)
  isteniyor.
- Bu doküman ve kod tabanı **yine sıfırdan** yazıldı (v3). v2'deki bazı alt
  sistemler (genom/mutasyon çekirdek mantığı, nesil takibi, kaydet/yükle, hız
  kontrolü mimarisi) kavramsal olarak yeniden kullanıldı ama **gezegen/dünya
  modeli, canlı başlangıç noktası (artık mikroorganizma) ve TÜM UI/dashboard
  tamamen yeniden tasarlandı.**

## Yeni Vizyon (v3)
"Canlılar mikroorganizmadan başlayarak nasıl evrimleşirdi" sorusuna cevap arayan,
sade/minimal bir arayüze sahip bir evrim simülasyonu.

## Dünya Modeli
- **Düz bir harita** (dairesel gezegen YOK). Sabit boyutlu (1600×1000), dikdörtgen
  bir alan.
- Harita **bir kez, başlangıçta** prosedürel olarak (value-noise, ekstra
  kütüphane yok) üretilir: su/kara. Faz VIII'den beri harita seed'i her yeni
  sayfa yüklemesinde rastgele üretiliyor (kaydet/yükle ile uyumlu).
- **Arazi çeşitleri (Faz XVII)**: aynı ham noise değeri "yükseklik" olarak
  yeniden kullanılıp 5 tipe (derin su/sığ su/kumsal/ova/dağ) ayrılıyor — sadece
  görsel/kategorik bir üst katman, `terrainAt`/`isWater` (tüm hareket/spawn
  mantığının dayandığı ikili ayrım) değişmedi.
- **Gezegen oluşum ekranı (Faz XVI)**: her yeni simülasyon başlamadan önce,
  harita seed'inden TÜRETİLEN (deterministik) bir atmosfer/bio-madde özeti +
  kısa bir anlatı gösteriliyor, "Simülasyonu Başlat" ile devam ediliyor. Bir
  kayıt yüklenirken bu ekran hiç açılmıyor.
- "Gezegen bilgileri": su/kara %, sığ/derin su ayrımı, atmosfer/oksijen
  seviyesi (Faz X) — HUD "Detaylar" bölmesinde gösteriliyor.

## Canlı Modeli — Mikroorganizmadan Başlayan Açık Uçlu Evrim
- **Başlangıç**: Tüm canlılar en başta **tek hücreli/organsız mikroorganizmalar**
  olarak başlar. Su bölgelerinde yaşarlar.
- **Açık organ havuzu**: Mutasyon, zamanla genoma yeni bir organ/uzuv TİPİ ekleme
  şansı verir (sabit bir "evrim ağacı" sırası YOK). Kategoriler: hareket
  (fin/leg/wing/tentacle), algı (eyespot/eye), beslenme (mouth/stomach),
  savunma (shell/camouflage/spike), solunum (gill/lung), iç organ (heart),
  kışlama/izolasyon/biyolüminesans/zehir/rejenerasyon (Faz XIV: torpor/blubber/
  bioluminescence/venom/regeneration), gezegene-özgü (Faz XVI: `nitrogen_sac`/
  `sulfur_vent_organ`, sadece uygun gezegen profilinde mümkün). 21 tip, liste
  kapalı değil.
- **Su → kara geçişi**: Bacak organı olan bir canlı karaya çıkıp orada da
  hayatta kalabilir/beslenebilir.
- **Neden/gerekçe şeffaflığı**: organ ortaya çıkıp yayıldığında/elenirken
  event log'a gerçek, eşik-tabanlı bir olay düşer (Faz III), uydurma yok.
- **Diyet/etoloji (Faz IX/XIII/XVII)**: `diet: herbivore|carnivore`, wander/
  seek/flee/hunt durum makinesi, sınır farkındalığı/gerçek besin arayışı,
  **sürü avlanma** (`packHunter` geni — yakındaki aynı-tip etçil sayısı avlanma
  başarısını artırır).
- **Üreme çeşitliliği (Faz VII)**: aseksüel bölünme + fırsatçı cinsel üreme
  (crossover) + yumurtalama + basit yavru bakımı, hepsi paralel var olabilir.
- **Yaşam döngüsü (Faz IX)**: `maxLifespan` geni ile yaşlılıktan ölüm.
- **Ölüm/ayrıştırma (Faz VI/XI)**: ölüm görünür (ceset/iskelet), ayrıştırıcı
  bakteriler cesetleri tüketir ve besin havuzuna küçük bir katkı bırakır.
- **Organ açıklamaları (Faz XIV)**: inceleme panelinde her organın gerçek
  mekanik etkisini anlatan kısa bir cümle gösteriliyor.
- **Soy ağacı (Faz VI/XII/XVI)**: varsayılan KAPALI, buton ile açılan bir
  overlay; zoom/pan/filtre (diyet/organ/durum/nesil), organ-rengi halkası,
  bezier ebeveyn→çocuk dallanması. Çok büyük soylar TAMAMEN silinmiyor, eski
  bloklar bir özet düğüme sıkıştırılıyor (veri kaybı yok); canvas dikey
  boyutu üst sınırlı (`MAX_CONTENT_HEIGHT`, Faz XVII).

## Arayüz — Minimal Menü
- v2'deki sekmeli D3 dashboard'u TAMAMEN kaldırıldı. Ana odak harita+canlı sahnesi.
- Tek, kompakt bir yan panel: birincil 2x2 istatistik ızgarası her zaman
  görünür; ikincil bilgiler (Dünya/Diyet/Atmosfer) varsayılan KAPALI "▾
  Detaylar" bölmesinde.
- **Evrim olay akışı (event log)**: organ ortaya çıktığında/yayıldığında/
  tükendiğinde kısa satırlar. Tekil avlanma olayları BİLEREK log'a düşmüyor
  (gürültü kararı, Faz X).
- Canlı inceleme paneli (tıklamayla) + seçim halkası + Gemini "Bu soyu analiz
  et" butonu.
- Header: hız kontrolü (II/1x/2x/4x) + Yeniden Başlat + Dışa/İçe Aktar + manuel
  doğa olayı kontrolleri (Faz XII), gruplar arası ince ayraçlarla.
  (Faz XI'de eklenen çoklu-kayıt-slotu kullanıcı isteğiyle kaldırıldı — tek-slot
  otomatik kayda dönüldü, bkz. `TASKS_ARCHIVE.md#faz-xi-çoklu-kayıt-slotu`.)
- Responsive: dar ekranlarda panel sahnenin altına inip tek sütuna dönüşüyor.

## Teknik Yığın
- Vite + TypeScript + PixiJS (sahne render'ı).
- D3.js kullanılmıyor — soy ağacı düz `<canvas>` 2D çizimi.
- Basit value-noise fonksiyonu harita üretimi için yeterli.
- Gemini API (`gemini-flash-lite-latest`) — sunucu taraflı proxy
  (`vite.config.ts` `/api/gemini-insight`), anahtar ASLA client'a
  gönderilmiyor, `.env`'de tutulur.

## Faz Özeti ve Durum

Tüm fazlar TAMAMLANDI ve bağımsız tester tarafından GEÇTİ olarak doğrulandı,
aksi belirtilmedikçe. Detaylar için `TASKS_ARCHIVE.md`'ye bakın.

- **Faz I — Dünya + mikroorganizma iskeleti**: TAMAMLANDI, Tester GEÇTİ.
  `TASKS_ARCHIVE.md#faz-i`.
- **Faz II — Açık organ sistemi**: TAMAMLANDI, Tester GEÇTİ. `TASKS_ARCHIVE.md#faz-ii`.
- **Faz III — Neden/gerekçe şeffaflığı**: TAMAMLANDI, Tester GEÇTİ.
  `TASKS_ARCHIVE.md#faz-iii`.
- **Faz IV — Popülasyon çöküşü düzeltmesi**: TAMAMLANDI. Kök neden besin
  MİKTARI değil ERİŞİLEBİLİRLİĞİYDİ. `TASKS_ARCHIVE.md#faz-iv`.
- **Faz V — Canlı inceleme + üreme/büyüme görselliği + Gemini derin analiz**:
  TAMAMLANDI, Tester GEÇTİ. `TASKS_ARCHIVE.md#faz-v`.
- **Faz VI — Ölüm görünürlüğü, soy ağacı, seçim halkası, soy tükenmesi,
  ayrıştırıcılar**: TAMAMLANDI, Tester GEÇTİ. `TASKS_ARCHIVE.md#faz-vi`.
- **Faz VII — Çiftleşme, yumurtalama, yavru bakımı + Gemini hafif yönlendirme**:
  TAMAMLANDI, Tester GEÇTİ. `TASKS_ARCHIVE.md#faz-vii`.
- **Faz VIII — Rastgele harita + dünya olayları**: TAMAMLANDI, Tester GEÇTİ.
  `TASKS_ARCHIVE.md#faz-viii`.
- **Faz IX — Bug düzeltmeleri + diyet sistemi + etoloji**: TAMAMLANDI, Tester
  GEÇTİ. `TASKS_ARCHIVE.md#faz-ix`.
- **Faz X — Sığ/derin su + avlanma log gürültüsü + solunum organları/atmosfer**:
  TAMAMLANDI, Tester GEÇTİ. `TASKS_ARCHIVE.md#faz-x`.
- **Faz XI — Sürekli İyileştirme**: açık uçlu faz, PM tarafından sürdürülüyor.
  Detaylar ve güncel aday havuzu aşağıda.
- **Faz XII — Manuel kontroller + soy ağacı iyileştirmeleri**: TAMAMLANDI,
  Tester GEÇTİ. `TASKS_ARCHIVE.md#faz-xii`.
- **Faz XIII — Davranış AI kalitesi + besin çöküşü bug'ı**: TAMAMLANDI VE
  KAPANDI. Kök neden bulunup düzeltildi; toplam 20 kısa koşu + tam 22 dakikalık
  yoğun-müdahaleli bir koşu = sıfır çöküş, sıfır gerçek hata. Kullanıcının
  bildirdiği tekil olay muhtemelen eski/HMR-drift bir dev server sekmesiydi
  (düzeltildi). `TASKS_ARCHIVE.md#faz-xiii`.
- **Faz XIV — Yeni/sıra dışı organlar + soy ağacı seçim bug'ı + organ
  açıklamaları**: Madde 1 (5 yeni organ) ve Madde 3 (organ açıklamaları)
  TAMAMLANDI, Tester GEÇTİ. Madde 2 (soy ağacı seçim halkası bug'ı) hem coder
  hem tester tarafından YENİDEN ÜRETİLEMEDİ — açık, bkz. aşağıda "Güncel/Açık
  Konular". `TASKS_ARCHIVE.md#faz-xiv`.
- **Faz XV — Performans regresyonu: popülasyon tavanında FPS çöküşü**:
  TAMAMLANDI VE KAPANDI. Kök neden (fixed-timestep sarmalı + O(n²) sqrt
  maliyeti) bulunup düzeltildi, sistem-sakin bağımsız doğrulama da tamamlandı
  (FPS 14-25.4 arası platoya oturuyor, eski "ölüm sarmalı" bir daha
  görülmedi). `TASKS_ARCHIVE.md#faz-xv`.
- **Faz XVI — Profesyonel soy ağacı + gezegen oluşum ekranı + gezegene özgü
  organlar**: TAMAMLANDI, Tester GEÇTİ (3/3 madde). Soy ağacı özet düğüm
  (sıfır veri kaybı) + bezier görsel yeniden tasarım; gezegen oluşum ekranı
  (deterministik, save/load uyumlu); 2 yeni gezegene-özgü organ + filtreleme
  katmanı. `TASKS_ARCHIVE.md#faz-xvi`. Ardından bağımsız bir performans/
  entegrasyon denetimi de GEÇTİ (Faz XV'in sarmalı geri gelmedi).
- **Faz XVII — Donma bug'ı + sürü davranışı + arazi çeşitleri**: TAMAMLANDI,
  Tester GEÇTİ (4/4 madde, İKİ AYRI bağımsız tester turunda doğrulandı).
  Harita sınırı donma bug'ı (kesin kök neden, iki parça düzeltme); `packHunter`
  sürü avlanma geni (ölçülebilir etki: %8/müttefik, %35 tavan); 5 tipli arazi
  çeşitliliği (yükseklik-izdüşümü, performans önbellekli); soy ağacı canvas
  yükseklik sınırı (Faz XVI'nın görsel-dayanıklılık bulgusu düzeltildi).
  `TASKS_ARCHIVE.md#faz-xvii`.
- **Faz XVIII — Uzun koşuda gecikmeli toplu popülasyon çöküşü bug'ı
  (2026-09-10/11)**: TAMAMLANDI VE KAPANDI. Kök neden: bir iklim olayı
  sırasında nutrient popülasyon konumlarına göre hızla birikip cap'e
  yapışıyor, olay bitip popülasyon yer değiştirdikçe stok eski konumlarda
  "donmuş" kalıyor. Düzeltme: `ecosystem.ts` `relocateStrandedNutrient()`
  — stranded nutrient'ı aç bir bireyin yakınına taşır. TOPLAM 7/7 bağımsız
  doğrulama PASS (5 kısa koşu + 1 genişletilmiş + 1 tamamen farklı
  senaryo/tester). `TASKS_ARCHIVE.md#faz-xviii`.
- **Faz XIX — Organ diyagramı ölü/soy ağacı bireylerinde görünmüyordu
  (2026-09-11)**: TAMAMLANDI VE KAPANDI. Kök neden: `buildCreatureDiagram`
  sadece canlı birey seçildiğinde (`showInspector`) çağrılıyordu,
  `showDeceasedInspector`'da hiç yoktu. Düzeltme: `diet` parametresi
  nullable yapılıp (nötr gri renk) `showDeceasedInspector`'a da aynı
  diyagram çağrısı eklendi. Tester GEÇTİ (bağımsız, 0f — farklı organ/
  birey kombinasyonuyla, `lung` organlı gerçek bir ölüm kaydı). `tsc`
  temiz. `TASKS_ARCHIVE.md#faz-xix`.
- **Faz XX — Yeni organ: Kromatofor (aktif kamuflaj) (2026-09-11)**:
  TAMAMLANDI. 22. organ tipi — mürekkep balığı ilhamlı, YAKALANMA ANINDA
  devreye giren tepkisel bir kaçış şansı (`chromatophoreReactiveEscapeChance()`,
  `0.12+power*0.2`), statik `camouflage`'dan mekanik olarak farklı.
  **Tester GEÇTİ (bağımsız, 2b)**: "uydurma yok" ilkesi kod satırıyla
  doğrulandı, farklı power değeri + camouflage ile combined senaryo test
  edildi. `TASKS_ARCHIVE.md#faz-xx`.
- **Faz XXI — Yeni organ: Simbiyotik Bağırsak Florası (2026-09-11)**:
  TAMAMLANDI. 23. organ tipi — `mouth`/`stomach`'tan farklı bir eksende,
  avdan sonraki sindirim molası süresini kısaltır
  (`digestCooldownMultiplier()`, `1-power*0.5`). **Tester GEÇTİ (bağımsız,
  2b)**: farklı power değeri + combined senaryo test edildi, "sadece
  etçillerde anlamlı" iddiası hem kod-yolu izlemesiyle hem canlı testle
  (otçula zorla eklenip 15s çalıştırıldı, davranış hiç etkilenmedi)
  doğrulandı. `TASKS_ARCHIVE.md#faz-xxi`.

## Güncel/Açık Konular (bir sonraki PM/coder turunda ele alınmalı)
- **Faz XIV Madde 2 — soy ağacı seçim bug'ı**: kod hem coder hem tester
  tarafından incelendi, GERÇEK bir hata bulunamadı. Kullanıcıdan tam tekrar
  adımları (tarayıcı, pencere boyutu, hangi düğüme nasıl tıklandığı) istenmesi
  gerekiyor — bu bilgi olmadan ilerlemek zor.

## Gelecek Yön (henüz bir faza dönüşmedi)
- **"Sandbox oyunu" fikri (2026-09-06)**: Kullanıcı, projenin ileride bir
  sandbox oyununa dönüşüp dönüşemeyeceğini sordu. PM değerlendirmesi: EVET,
  mümkün — mevcut mimari (gezegen oluşturma, genom/organ sistemi, manuel
  besin/doğa olayı kontrolleri, kaydet/yükle) zaten bir "god game"in
  temelini taşıyor. Eksik olan asıl şey: OYUNCUYA DOĞRUDAN MÜDAHALE
  araçları — örn. eliyle canlı yerleştirme/organ düzenleme, arazi
  şekillendirme (terraforming), hedef/senaryo/skorlama sistemi.
  **Kullanıcı kararı**: Şimdilik mevcut yönde (gerçekçi, gözlemlenebilir,
  "gözlemci" bir evrim simülasyonu) devam edilecek; sandbox modu İLERİDE
  ayrı, isteğe bağlı bir mod olarak eklenecek — ana deneyimi (gözlemci
  bilimsel his) sulandırmadan. Henüz somut bir faz/görev açılmadı, kullanıcı
  ne zaman hazır olursa burada bir faz olarak detaylandırılabilir.

## Otonom Çalışma Modu (kullanıcı isteği, 2026-09-06)
Kullanıcı dışarı çıkıyor, projenin kendi kendine sürekli mükemmelleştirilmesini
istiyor. Roller AYRIŞTIRILDI (3 ayrı session, 3 ayrı cron):
- **PM** (bu session, cron zaten aktif): görev dağıtımı, coder/tester
  raporlarını işleme, aday havuzundan yeni görev seçme, arşivleme, kullanıcıya
  (döndüğünde) özet.
- **Coder** (ayrı bir peer session, kendi cron'u): PM'den görev bekler veya
  boştaysa TASKS.md'deki aday havuzdan/açık konulardan kendi seçip uygular.
- **Tester** (ayrı bir peer session, kendi cron'u): coder'ın tamamladığı ama
  bağımsız doğrulama bekleyen fazları test eder.
- **Kullanıcı isteği — hem frontend hem backend işler**: Şu ana kadarki proje
  saf frontend (Vite+PixiJS SPA + küçük bir Vite dev-server proxy'si, gerçek
  bir backend yok). Kullanıcı backend tarafında da iş bekliyor — popülasyon/
  soy verisini dışa aktarabilen bir API + zaman serisi geçmişi **TAMAMLANDI**
  (aşağıya bakın). Kalan aday fikirler: Gemini proxy'sini gerçek/kalıcı bir
  backend servisine taşımak, ileride çoklu-oyunculu/paylaşılan durum için bir
  sunucu bileşeni. Coder cron'u bir sonraki turlarda bunu değerlendirmeli —
  büyük bir mimari değişiklik olacaksa (örn. gerçek bir Node/Express backend
  eklemek) önce PM'e (ve gerekirse kullanıcıya döndüğünde) danışılmalı.

### Popülasyon Telemetri API'si (2 tur, TAMAMLANDI, Tester GEÇTİ)
`/api/population-snapshot` (GET/POST) + `/history` (ring-buffer, son 50
kayıt) — canlı popülasyon/soy verisini dışarıya açan salt-okunur bir
telemetri API'si, in-memory, mimari değişiklik değil (PM onaylı).
`TASKS_ARCHIVE.md#faz-xi-telemetri-zaman-serisi`.

### Geniş sağlık taraması (tester, 2026-09-10)
Save/load, export/import, Gemini proxy, telemetri tarandı — 1 KRİTİK BUG
bulundu (dışa/içe aktarma sonrası harita/popülasyon bozulması), coder'a
devredilip DÜZELTİLDİ ve Tester GEÇTİ (bkz. "Tamamlanan turlar").
`TASKS_ARCHIVE.md#faz-xi-geniş-sağlık-taraması`.

## Faz XI — Sürekli İyileştirme (açık uçlu, kapanmıyor)
PM, kullanıcıdan yeni bir talimat gelmediği sürece kendi kararıyla değerli
iyileştirmeler seçip ilerletir.

### Aday yön havuzu (PM her turda buradan seçer veya yeni bir fikir üretir)
- Yeni organ/davranış fikirleri (kullanıcı istediğinde).
- Genel performans/entegrasyon yeniden-denetimi (periyodik olarak
  tekrarlanabilir, en son 2026-09-09 yapıldı — sonuç: mevcut kod zaten
  optimize).
- Uzamsal bölümleme (grid/quadtree): `updateSexualReproduction` kısmı
  **TAMAMLANDI, Tester GEÇTİ**. `findNearestPrey`/`findNearestThreat`/
  `packHuntEscapeReduction` BİLEREK KAPSAM DIŞI bırakıldı (mid-frame mutasyon
  riski nedeniyle) — sadece belirgin bir performans şikayeti varsa ve güvenli
  bir yaklaşım (örn. hareket öncesi/sonrası iki-geçişli grid) bulunursa
  yeniden değerlendirilmeli.
- **Düşük öncelikli erişilebilirlik gözlemleri** (tester 62, 2026-09-10
  ESC-kapat incelemesi sırasında bulundu, düzeltme İSTENMİYOR — bilgi
  amaçlı): (1) canvas-tabanlı soy ağacı düğüm tıklaması klavyeyle
  erişilemiyor (screen reader/klavye-only kullanıcı düğümlere ulaşamaz) —
  proje hiçbir yerde WCAG uyumluluğu iddia etmiyor, mevcut/önceden var olan
  bir sınırlama; (2) zoom butonlarında (`lineage-zoom-*`) `title` var ama
  `aria-label` yok (close butonlarında ikisi de var) — küçük bir
  tutarsızlık, opsiyonel.
- **`npm audit` — orta önem dev-server güvenlik uyarısı** (tester 62,
  2026-09-10 config/bağımlılık taraması, ONAY BEKLİYOR): `esbuild <=0.24.2`
  (vite@5.4.21'in transitive bağımlılığı, sadece dev-time tooling, `dist/`'e
  girmiyor) — GHSA-67mh-4wv8-2f99: dev server çalışırken herhangi bir
  websitesi ona istek gönderip yanıtı okuyabiliyor. Prod build'e/API
  anahtarına sızmıyor, ama düzeltme (`npm audit fix --force`) major bir
  framework sürüm atlaması gerektiriyor (vite@5→8, breaking change riski) —
  EMIR.md'nin "mimari değişiklik, kullanıcı yokken yapılmaz" kategorisine
  giriyor, kullanıcı/PM onayı olmadan uygulanmamalı.

### Tamamlanan turlar (kronolojik, detaylar `TASKS_ARCHIVE.md`'de)
- **Gemini gerçek uçtan uca doğrulama + ölü kod taraması + baştan sona akış +
  mobil/responsive CSS kaskad düzeltmesi + kombinasyon senaryosu + arşiv
  anchor taraması + soy ağacı entegrasyon testi** (coder 6f/c2, tester 62,
  2026-09-10): hepsi TAMAMLANDI/TEMİZ/GEÇTİ. `TASKS_ARCHIVE.md#faz-xi-gemini-gerçek-çağrı--ölü-kod-taraması`,
  `#faz-xi-baştan-sona-kullanıcı-akışı-taraması`, `#faz-xi-mobildar-ekran-responsive-taraması`.
- **Dünya olayları tetikleme + `dominantOrganType()`/ESC-kapat/Content-Type/
  Gemini whitelist/`crossoverGenomes` adalet düzeltmeleri + Plague Inc canlı
  diyagramı + soy ağacı tam sayfa + bug-avı taraması** (2026-09-10, coder
  6f/c2): hepsi TAMAMLANDI, Tester GEÇTİ (bağımsız, 62, farklı açılardan).
- **Organ açıklaması tutarlılığı + `loadFromSave` temizliği + içe aktarma
  bug + organ trend oku + uzamsal bölümleme + performans denetimi 2. tur +
  ayrıştırıcı-besin katkısı** (2026-09-05—10, coder c5/6f/c2): hepsi
  TAMAMLANDI, Tester GEÇTİ. `TASKS_ARCHIVE.md#faz-xi-organ-açıklaması-tutarlılığı-2-bağımsız-tur`
  (diğer anchor'lar aynı dosyada `faz-xi-*` ile aranabilir).
- **Çoklu kayıt slotu** (2026-09-03): eklendi + doğrulandı, sonra kaldırıldı.
  `TASKS_ARCHIVE.md#faz-xi-çoklu-kayıt-slotu`.
- **Soy ağacı zoom/pan + performans denetimi + UI/UX sadeleştirme + Dışa/İçe
  Aktarma + Responsive destek** (2026-09-03): hepsi TAMAMLANDI + Tester GEÇTİ.

## Temizlik Notu (tester 0f, 2026-09-11)
Proje kökü process/dosya kalıntı taraması: orphan process yok, 3 gerçek
dosya leftover'ı (`diag_server.pid`, 2 Faz XV temp script'i) silindi, tsc
temiz doğrulandı.

## Süreç Notu (PM, 2026-09-01)
Coder/tester (veya coder/coder) görevleri PARALEL çalıştırılınca aynı dosyalar
üzerinde çakışıp geçici hatalara yol açıyor (birkaç kez gözlendi — testerlar
bunu doğru şekilde tespit edip temiz kod üzerinde tekrar test ederek telafi
etti, ama riskli). Bundan sonra: bir faz üzerinde coder çalışırken aynı anda
başka bir coder/tester aynı kod tabanında SIRAYLA çalıştırılacak, paralel
dispatch edilmeyecek.

## Roller
- **Coder**: Faz'lara göre implementasyon (subagent olarak yönetiliyor, session-only).
- **Tester**: Her faz sonunda bağımsız doğrulama (subagent olarak yönetiliyor).
- **PM** (bu session): Görev dağıtımı, önceliklendirme, kullanıcıyla iletişim,
  kabul/red kararları, sürekli cron ile otomatik ilerletme.
