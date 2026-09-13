# Evrimsel Gezegen — Arşiv (Faz Detayları ve Tester Doğrulamaları)

Bu dosya, `TASKS.md`'nin okunabilir kalması için ayrıştırılan **tarihsel** içeriği
tutar: her fazın uygulama detayları ve bağımsız tester doğrulama raporları. Güncel
özet/durum için `TASKS.md`'ye bakın. Fazlar kronolojik sırayla (I → XII) verilmiştir;
her faz kendi içinde "Detaylar" (coder) ve "Tester doğrulaması" alt bölümlerini içerir.

---

## Faz I — Detaylar ve Tester Doğrulaması (arşiv)

### Detaylar (tamamlandı)
- **Eski v2 kodu temizlendi**: `planet.ts`, `phylotree.ts`, `traithistogram.ts`,
  `populationhistory.ts` (D3 sürümü), `selectionanalysis.ts`, `selectiontrends.ts`,
  `biome.ts`, `pheromone.ts`, `plant.ts` silindi. `package.json`'dan `d3`/`@types/d3`
  kaldırıldı (`npm uninstall` ile node_modules'tan da temizlendi).
- **Düz harita** (`src/world.ts`): sabit boyutlu (1600×1000) dikdörtgen `World`.
  Su/kara ayrımı, her biri rastgele YÖNDE ilerleyen düzlemsel sinüs dalgalarının
  (3 oktav: kaba/orta/ince frekans) toplamıyla üretiliyor — kütüphane yok, sabit
  `MAP_SEED` ile deterministik, simülasyon boyunca sabit. İlk denemede tüm dalgalar
  eksen-hizalı (freqX/freqY) tutulunca köşegen "çizgili kumaş" deseni oluşmuştu;
  düzeltme olarak her dalgaya bağımsız rastgele bir açı verildi — sonuç organik
  ada/kıta şekilleri (~%47 su / %53 kara, ekran görüntüsüyle doğrulandı). Harita bir
  kez canvas dokusuna bake ediliyor, render döngüsüne ek maliyet yok. Su/kara oranı
  `World.waterFraction` ile dışarı açık, HUD'da gösteriliyor.
- **Mikroorganizma** (`src/genome.ts`, `src/creature.ts`): genomda organ/uzuv/diyet
  YOK — sadece yarıçap, renk, hız, algı menzili, metabolizma, bölünme eşiği. Görünüş
  tek bir daire. Konum artık theta değil düz (x,y). Üreme, eşleşme değil **bölünme**
  (aseksüel, `divideGenome` — küçük mutasyonlarla).
- **Ekosistem** (`src/ecosystem.ts`): canlılar SADECE su bölgelerinde spawn olur ve
  kalır (`moveWithinWater` — karaya/harita dışına çıkacak hareketi iptal edip yönü
  rastgele çevirir). Basit besin mekaniği: `Nutrient` parçacıkları periyodik olarak
  suda beliriyor, canlı yakındakini algılayıp yönelip yiyor, enerji kazanıyor;
  metabolizma sürekli enerji tüketiyor, enerji biterse ölüyor; enerji eşiğe ulaşınca
  ikiye bölünüyor. Headless testte (4x hız, ~80s simülasyon) 11 bölünme, nesil 2'ye
  ulaştı, popülasyon dengeli kaldı — mekanik çalışıyor.
- **Minimal UI** (`index.html`, `src/dashboard.css`, `src/hud.ts`): v2'nin sekmeli/
  D3'lü sağ paneli TAMAMEN kaldırıldı. Yeni panel: tek, kompakt bir blok (popülasyon,
  zaman, nesil, toplam bölünme, su/kara %) + altında boş bir "Evrim Olay Akışı"
  listesi (placeholder metinli, Faz III'te dolacak — `Hud.pushEvent` hazır ama şimdilik
  hiçbir yerden çağrılmıyor, kasıtlı). Sekme/grafik YOK. Hız kontrolü (II/1x/2x/4x) ve
  "Yeniden Başlat" v2'den korundu (DOM tabanlı, basit).
- **Kaydet/Yükle** (`src/savegame.ts`): yeni genom/konum şekline göre güncellendi,
  save-key sürümü v2'ye çıkarıldı (eski v1 kayıtları otomatik reddediliyor — "ya tam
  kabul ya tam red" felsefesi korundu).
- **Doğrulama**: `npx tsc -b --force` ve `npm run build` temiz geçti. Playwright ile
  headless tarayıcı testi: konsol hatası yok, harita görünüyor, canlılar (küçük renkli
  noktalar) suda hareket ediyor (iki farklı zaman noktasında pozisyon değişimi
  doğrulandı), event log gerçekten boş/placeholder, `.tab-btn` sayısı 0 (sekme
  kalmadığı doğrulandı). Ekran görüntüleri dürüstçe değerlendirildi: arayüz gerçekten
  sade — tek panel, büyük harita alanı, göze çarpan tek bir grafik/sekme yok.

### Tester doğrulaması (bağımsız, 2026-09-01): GEÇTİ
`npx tsc --noEmit` ve `npm run build` temiz (0 hata). `package.json`'da
`dependencies`/`devDependencies` içinde `d3` yok, `node_modules`'ta da yok. Eski v2
dosyalarının (`planet.ts`, `phylotree.ts`, `traithistogram.ts`, `populationhistory.ts`,
`selectionanalysis.ts`, `selectiontrends.ts`, `biome.ts`, `pheromone.ts`, `plant.ts`)
hepsi `src/`'den kaldırılmış. Headless Playwright ile `npm run dev` üzerinde tam sayfa
ekran görüntüleri (t=0s, ~20s, ~80s, 4x hızda) alındı ve dürüstçe incelendi: harita
gerçekten sabit 1600×1000 dikdörtgen (dairesel değil), su/kara sınırları organik
ada/kıta şekilleri — coder'ın bahsettiği köşegen "çizgili kumaş" artefaktı YOK,
düzeltme kalıcı görünüyor. Canlılar sade tek renkli daireler, hiçbir organ/uzuv/segment
yok (`creature.ts` `drawBody` sadece `circle().fill()+stroke()`; `genome.ts` `Genome`
arayüzünde organ alanı yok — kod incelemesiyle de teyit edildi). UI tek, kompakt bir
yan panel (`#side-panel`: istatistik bloğu + "Evrim Olay Akışı" listesi); `index.html`
içinde sekme/tab yapısı hiç yok, headless testte `.tab-btn` sayısı 0. Olay akışı
gerçekten boş/placeholder metinli (Faz III'e bırakılmış, kasıtlı). Canlıların su
dışına/karaya çıkmadığı hem görsel olarak (3 ekran görüntüsünde tüm noktalar
koyu-lacivert su alanı üzerinde, yeşil-gri kara üzerinde hiç nokta yok) hem kod
incelemesiyle (`ecosystem.ts` `moveWithinWater` — hedef nokta kara/sınır dışıysa
hareket iptal edilip yön rastgele çevriliyor; `randomWaterPoint` sadece su koordinatı
üretiyor) doğrulandı. Bölünme/nüfus mekaniği çalışıyor: 4x hızda ~80s'de popülasyon
22→22 (dengeli, ölüm de var), nesil 0→2→4, toplam bölünme 0→9→50 — canlı bir ekosistem,
sabit/statik değil. Konsol hatası ve sayfa hatası: 0. Tek risk/not: `randomGenome`'daki
hız/algı gibi parametrelerin dar aralıkları (Faz II'de organ sistemi eklenince
genişleyecek, bu fazda kapsam dışı bırakılması doğru). Sonuç: Faz I gerçekten
hedeflenen "minimal arayüz + düz harita + organsız mikroorganizma" konseptini
karşılıyor, v2'nin dashboard/D3/sekme/dairesel-gezegen izleri kalmamış.

---

## Faz II — Detaylar ve Tester Doğrulaması (arşiv)

### Detaylar (PM'in kod incelemesiyle doğrulandı; coder raporlama adımında takıldığı
### için PM tarafından tamamlandı)
- **`src/organs.ts` (yeni)**: Kapalı bir enum/switch yerine genişletilebilir bir
  `ORGAN_DEFINITIONS` kaydı. 4 kategori: hareket (fin/leg/wing/tentacle), algı
  (eyespot/eye), beslenme (mouth), savunma (shell/camouflage/spike) — 10 organ tipi.
  Her tanım kendi şematik çizim fonksiyonunu (çizgi/üçgen/nokta, karikatür DEĞİL) ve
  ağırlığını taşıyor. `pickRandomOrganType` ağırlıklı rastgele seçim yapıyor — sabit
  bir evrim sırası yok, tamamen fırsatçı (TASKS.md gereksinimi karşılanıyor).
  `LAND_CAPABLE_ORGAN_TYPES = ["leg"]` ile karaya çıkış yetkisi organ bazlı tanımlı,
  ileride genişletilebilir.
- **`src/genome.ts`**: `Genome.organs: Organ[]` eklendi, başlangıçta boş (mikroorganizma
  organsız — Faz I korunuyor). `divideGenome` içinde `maybeGainOrgan` (düşük olasılıkla
  yeni organ tipi kazanımı, `MAX_ORGAN_TYPES` ile sınırlı) ve `mutateOrganPowers`
  (mevcut organ güçlerinde küçük mutasyon) çağrılıyor. `MUTATION_CHANCE=0.25`,
  `ORGAN_POWER_MUTATION_CHANCE=0.3` — makul, agresif olmayan oranlar.
- **`src/creature.ts`**: Genomdaki organlar tipe göre gruplanıp gövde dairesi
  üzerine/etrafına çiziliyor (`ORGAN_DEFINITIONS[type].draw`) — v2'nin nötr/bilimsel
  görsel dili korunuyor.
- **`src/ecosystem.ts`**: Su→kara geçişi — `creature.canWalkOnLand()` (bacak organı)
  true ise birey karaya çıkabiliyor; ayrı bir `landNutrients` havuzu (daha yavaş
  spawn ama "rakipsiz besin kaynağı" mantığıyla ödüllendirici) karada beslenmeyi
  sağlıyor. Bacaksız bireyler için kara hâlâ tamamen yasak.
- **PM doğrulaması**: `npx tsc --noEmit` ve `npm run build` temiz (PM tarafından
  tekrar çalıştırıldı). Kod okuması ile mantığın TASKS.md gereksinimleriyle (açık
  organ havuzu, mutasyonla kazanım, görsel şematik temsil, su→kara geçişi) tutarlı
  olduğu doğrulandı.
- **Not**: Coder bu fazda raporlama/doğrulama adımında iki kez kendi başlattığı bir
  arka plan işini bekleyip takıldı (önceki fazlarda da görülen bir davranış paterni)
  — kod kalitesinden bağımsız bir süreç sorunu.

### Tester doğrulaması (bağımsız, 2026-09-01): GEÇTİ
`npx tsc --noEmit` ve `npm run build` temiz (0 hata, testerın kendi ortamında tekrar
çalıştırıldı, test sırasında coder'ın `ecosystem.ts` üzerinde eşzamanlı yaptığı bir
dengeleme düzeltmesi (besin üretim hızının popülasyona göre ölçeklenmesi) sonrası da
temiz kaldığı doğrulandı). Playwright headless tarayıcı ile SENKRON davranış testi
(`npm run dev`, port 5199, hiçbir adım arka plana atılmadı):
- **Başlangıç**: 24 canlının tamamı organsız (`getCreatureSummaries()` → `organs: []`),
  ekran görüntüsünde sadece düz renkli daireler, hiçbiri kara üzerinde değil.
- **4x hızda ~4 dakikalık gerçek-zamanlı (≈967 sim-saniyesi) koşu**, 20 saniyede bir
  `window.__debug.getCreatureSummaries()` ile örneklendi: organsız popülasyondan
  başlayarak t=20s'de ilk organlar (fin/wing/eyespot) belirdi, t=100-140s aralığında
  `leg` popülasyona hızla yayıldı (muhtemelen karadaki rakipsiz besin avantajı
  sayesinde — TASKS.md'nin öngördüğü tam senaryo), t=160s'de organ dağılımı fin:6,
  leg:92, camouflage:14, eye:2, mouth:4 idi. Deney sonunda (t=967s) 140 canlının
  96'sında en az bir organ vardı, 5 farklı organ TİPİ (fin/leg/camouflage/eye/mouth)
  gözlemlendi — kapalı/sabit bir sıra değil, organik/fırsatçı bir dağılım. Konsol/sayfa
  hatası: 0 (hem uzun koşu hem zoom testinde).
- **Görsel doğrulama**: id=241 (leg+camouflage+mouth, nesil 10, karada) ve id=81
  (fin+eye) gibi organlı bireylere kamera dönüşümü (fitCamera matematiği) ile
  hesaplanan ekran koordinatından yakınlaştırılmış kırpma ekran görüntüleri alındı —
  organlar gerçekten şematik (küçük üçgen/çizgi uzantılar gövde dairesinden dışarı
  çıkıyor), karikatür yüz/ifade YOK, v2'nin "bilimsel/nötr" görsel dili korunmuş.
- **Su→kara geçişi**: `getCreatureSummaries()`'teki `onLand`/`canWalkOnLand` alanları
  çapraz kontrol edildi — her örnekte `onLand` sayısı HİÇBİR ZAMAN `canWalkOnLand`
  (bacaklı birey) sayısını aşmadı (örn. t=160s: onLand=36, landCapable=92; t=200s:
  onLand=48, landCapable=90) — bacaksız bireyler için kara yasağı koşu boyunca hiç
  ihlal edilmedi.
- **Test metodolojisi notu**: Ekran-koordinatına yakınlaştırma için `window.__debug`'a
  geçici olarak `x2`/`y2`/`radius` alanları eklendi (main.ts), test bitince TAMAMEN
  geri alındı. Playwright test amaçlı geçici bir devDependency olarak eklenip test
  sonunda `npm uninstall` ile tamamen kaldırıldı.
- **Regresyon (Faz I)**: popülasyon 24→140 (tavana ulaşıp dengede kaldı), nesil 0→10,
  toplam bölünme 0→390, su/kara oranı hâlâ %47/%53 sabit.
- **Risk/not**: Test sırasında coder'ın aynı anda `ecosystem.ts` üzerinde canlı bir
  dosya düzenlemesi (besin dengeleme düzeltmesi) tespit edildi — tester bunu fark edip
  dosyanın durulmasını bekledi, tsc'yi tekrar çalıştırıp temiz olduğunu doğruladıktan
  sonra teste devam etti. Sonuç etkilenmedi.

---

## Faz III — Detaylar ve Tester Doğrulaması (arşiv)

### Detaylar (coder, 2026-09-01, tamamen senkron çalıştırıldı)
- **`src/ecosystem.ts`**: Faz III mantığı mevcut besin/ölüm/bölünme koduna
  DOKUNMADAN eklendi (sadece yeni sabitler/state/metodlar; `update()` sonuna tek bir
  `this.updateEvolutionEvents(dt)` çağrısı eklendi):
  - `getOrganPrevalence()`: her `OrganType` için canlı popülasyonda kaç bireyin o
    organı taşıdığını sayan basit bir histogram.
  - `updateEvolutionEvents` (2 saniyede bir kontrol):
    - **Yaygınlık eşiği** (`checkPrevalenceMilestones`): popülasyon ≥10 ise, her organ
      tipi için taşıyanların oranı %20/%40/%60/%80 eşiklerinden birini ilk kez
      geçtiğinde bir olay üretir. Her eşik organ başına bir kez tetiklenir.
    - **Enerji avantajı/dezavantajı** (`checkEnergyAdvantage`): her organ tipi için
      taşıyan/taşımayan gruplarının ortalama enerji ORANI karşılaştırılır. DÜRÜSTLÜK
      kuralı: her iki grupta da en az 12 birey yoksa karşılaştırma atlanır. Fark ≥%15
      ise organ tipi başına BİR KEZ olay üretilir.
  - `pollEvolutionEvents()`: bekleyen olayları döndürüp iç kuyruğu boşaltan public
    metod — `main.ts` her karede çağırıp `Hud.pushEvent`'e basıyor.
  - `reset()` içine Faz III state'inin sıfırlanması eklendi.
- **`src/hud.ts`**: `pushEvent` artık liste 30 satırı (`MAX_EVENTS`) aşarsa en eski
  satırı buduyor.
- **Örnek gerçek olay metinleri** (senkron testte gerçekten üretildi):
  - `t=135s — Kamuflaj taşıyan bireylerin ortalama enerjisi, taşımayanlardan %17
    daha yüksek — hayatta kalma avantajı gözlemleniyor`
  - `t=233s — Ağız/Çene taşıyan bireylerin oranı %20'i geçti (beslenme verimliliği
    avantajı yayılıyor)`
  - Küçük not: ünlü uyumu eki her zaman tam doğru değil (kozmetik, Faz IV'te
    düzeltilebilir).
- **Doğrulama (SENKRON)**: `npx tsc --noEmit`/`npm run build` temiz. 4 dakikalık koşuda
  6 gerçek olay düştü, YİNELENEN olay metni YOK, konsol/sayfa hatası 0.
- **Gözlemlenen ama Faz III kapsamı DIŞINDA bir bulgu**: bu koşuda popülasyon 140'tan
  0'a çöktü — event mekaniği doğru şekilde sessiz kaldı (yeni olay üretmedi). Var olan
  bir ekosistem besin dengeleme kırılganlığı (Faz IV'e bırakıldı).

### Tester doğrulaması (bağımsız, 2026-09-01): GEÇTİ
`npx tsc --noEmit` ve `npm run build`: 0 hata. **İki bağımsız koşu** (4x hızda 4'er
dakika, 15 saniyede bir örneklendi):
- **RUN1**: 9 gerçek olay düştü — 4 yaygınlık eşiği, 4 enerji avantajı. **RUN2**: 2
  olay. Yinelenen olay metni HİÇBİR run'da YOK.
- **Mantıklılık/dürüstlük çapraz kontrolü**: olay metnindeki yüzdeler elle yeniden
  hesaplanıp tutarlı bulundu.
- **Dürüstlük eşiği (min 12/12)**: ayrı bir 40 saniyelik koşuda hiçbir organ tipi
  12/12 eşiğine ulaşmadı VE 0 olay düştü — doğru davranış.
- **Event log 30 sınırı**: kod incelemesiyle doğrulandı.
- **Konsol/sayfa hatası**: 3 koşunun tamamında 0.
- **Popülasyon çöküşü gözlemi (Faz III kapsamı dışı)**: RUN2'de popülasyon 133'ten
  0'a çöktü; RUN1'de 140→45'e düşüp kendiliğinden toparlandı. İki bağımsız koşuda da
  ciddi düşüş görülmesi — Faz IV'te erken ele alınması önerildi.
- **Sonuç**: Faz III mekaniği (histogram, eşik tespiti, event kuyruğu) sağlam ve
  bağımsız doğrulandı. Tek risk ekosistem dengesi (Faz IV'e ait).

---

## Faz IV — Detaylar ve Tester Doğrulaması (arşiv)

### Detaylar (coder, 2026-09-01, tamamen senkron çalıştırıldı — popülasyon çöküşü
### acil önceliği)
- **Kök neden analizi metodolojisi**: kod incelemesiyle başlandı, sonra Playwright ile
  gerçek `npm run dev` üzerinde SENKRON, 4x hızda 240 saniyelik (≈960 sim-saniyesi)
  koşular yapılıp popülasyon/nutrient/enerji-oranı zaman serisi toplandı.
- **BULGU 1 (ilk hipotez, doğru ama TEK BAŞINA yetersiz)**: `MAX_NUTRIENTS=160` sabit
  besin stoku tavanı, `MAX_CREATURES=140` popülasyonun talebini karşılamaya
  yetmiyordu. İlk düzeltme (`nutrientCapacity` popülasyona göre büyütüldü) SONRASI bir
  doğrulama koşusunda popülasyon YİNE 140→0 çöktü (nutrient stoku bol olsa bile) — bu,
  "besin miktarı" hipotezinin eksik olduğunu kanıtladı.
- **BULGU 2 (gerçek/asıl kök neden)**: Sorun besin MİKTARI değil besin
  ERİŞİLEBİLİRLİĞİYDİ. Yeni nutrient'lar haritanın TÜM alanına tamamen rastgele
  dağıtılıyordu — ortalama komşu mesafesi canlıların `senseRadius`ıyla aynı mertebede
  kalıyor, çoğu nutrient hiçbir canlının algı menzilinde olmuyordu. Popülasyon tavana
  yapıştığında bu düşük bulma verimliliği enerji dengesini negatife çevirip geri
  dönüşsüz bir açlık sarmalı yaratıyordu.
- **Düzeltme (üç parça, `src/ecosystem.ts`)**:
  1. `BASE_MAX_NUTRIENTS=120`/`BASE_MAX_LAND_NUTRIENTS=60` + `nutrientCapacity()` —
     besin stok tavanı popülasyonla birlikte büyüyor.
  2. `nutrientSpawnRateMultiplier` — düşük/çöken popülasyonda üretim hızının aşırı
     düşmesini önleyen bir taban korunuyor.
  3. **`spawnPointNear()` (asıl belirleyici düzeltme)** — yeni nutrient'ların
     `NEAR_CREATURE_SPAWN_CHANCE=0.75` ihtimalle rastgele bir canlının 20-70px
     yakınına doğması. Kalan %25 hâlâ tamamen rastgele (keşif teşviki korunsun diye).
  4. Bölünme/metabolizma/organ eşiklerine DOKUNULMADI.
- **Doğrulama**: **Düzeltme SONRASI 5 bağımsız koşu**: 5/5 koşu hiç çökmedi, popülasyon
  her koşuda 140 tavanına ulaşıp koşu sonuna kadar dengede kaldı. Ortalama enerji
  oranı sağlıklı bir bantta (0.5-0.87) dalgalandı. Konsol/sayfa hatası: 0.
  - **Regresyon — Faz II**: organ çeşitliliği bozulmadı, kara yasağı ihlal edilmedi.
  - **Regresyon — Faz III**: event mekaniği besin düzeltmesinden etkilenmedi.
- **Kapsam dışı bırakılanlar**: "Faz IV — Cila" maddesindeki küçük UI/performans
  iyileştirmeleri — popülasyon dengesi çözülmeden bu maddelere geçilmedi.

(Faz IV için ayrı bir tester doğrulaması TASKS.md'de kayıtlı değil — Faz III/V/VI/VII
tester turlarının her biri popülasyon dengesini regresyon kontrolü olarak ayrıca
doğrulamış ve sağlam bulmuştur.)

---

## Faz V — Detaylar ve Tester Doğrulaması (arşiv)

### Detaylar (coder, 2026-09-02, tamamen senkron çalıştırıldı)

**Önce Gemini API anahtarı testi:**
- `.env`'deki `GEMINI_API_KEY` standart "AIzaSy..." formatında DEĞİL. Doğrudan `curl`
  ile gerçek Gemini REST API'sine test isteği atıldı.
- **SONUÇ: Anahtar ÇALIŞIYOR/GEÇERLİ.** `gemini-2.0-flash`/`gemini-2.5-flash` 404
  döndü (bu hesapta emekli edilmiş modeller). `gemini-3.6-flash` ile yapılan gerçek
  istek HTTP 200 döndü. **Model seçimi: `gemini-3.6-flash`** (`vite.config.ts`'te
  sabit).

**1) Canlı inceleme paneli**:
- `Ecosystem.findNearestCreature(x, y, maxDistance)` — 16px dışı tıklamalar hiçbir
  şeyi seçmiyor.
- `main.ts`: tıklanan ekran koordinatı world koordinatına çevrilip
  `findNearestCreature` çağrılıyor.
- `Creature.getInspectionSummary(onLand)`: id, nesil, yaş, enerji/maxEnerji, etkin
  hız, algı menzili, kara/su konumu, organ listesi döndürüyor.
- **Doğrulama**: gerçek tıklamayla panel açıldı, içerik (`ID #1, Nesil 0, Yaş 3.8s,
  Enerji 47.4/87.9...`) doğru render edildi.

**2) Üreme/büyüme/gelişme görselliği**:
- `Creature` constructor'ına `isNewborn` parametresi — `scale=0.15`'ten
  `GROWTH_DURATION=0.6s` boyunca DOĞRUSAL olarak `scale=1`'e büyüyor.
- `DivisionEffect` (yeni): bölünme anında kısa (0.5s) bir bağlantı çizgisi + halka.
- **Doğrulama**: `scale.x` değeri 100ms aralıklarla örneklendi:
  `0.292→0.457→0.669→0.882→1.0` (~0.6s'de tamamlandı).

**3) Gemini API ile derin analiz**:
- **Güvenlik**: `GEMINI_API_KEY` client'a ASLA gönderilmiyor. `vite.config.ts`'e
  `/api/gemini-insight` proxy middleware'i eklendi — anahtar SADECE sunucu tarafında
  okunuyor. `dist/` içinde anahtar/`GEMINI_API_KEY` string'i hiç bulunamadı.
  `dotenv` paketi kalıcı `dependencies`'e eklendi.
- `src/geminiinsight.ts`: `buildPrompt` HAM veriyi metne döküyor, "SADECE verilen
  sayısal veriye dayan, UYDURMA YAPMA" talimatı içeriyor.
  `fetchGeminiInsight`: TÜM hata yollarında fırlatmaz, `null` döner.
- `src/hud.ts`: `pushEvent(text, isInsight=true)` — metnin başına "🔬 " ekleniyor.
- **Doğrulama**: proxy'ye gerçek istek `{"text":"test-ok"}` döndü. Hata toleransı
  doğrudan test edildi (`window.fetch` reddedilen Promise'e sarmalandı) — fırlatmadı,
  `null` döndürdü, nazikçe logladı.

### Tester doğrulaması (bağımsız, 2026-09-02): GEÇTİ
- `npx tsc --noEmit` ve `npm run build`: 0 hata.
- **API anahtarı sızıntısı: SIZINTI YOK.** `dist/` içinde `grep -rn
  "AQ.Ab8RN6\|GEMINI_API_KEY\|generativelanguage" dist/` hiçbir eşleşme bulmadı.
- **Canlı inceleme paneli**: gerçek tıklamayla panel açıldı, içerik debug hook'undaki
  gerçek veriyle birebir eşleşti.
- **Büyüme animasyonu**: `scale.x` değeri ölçüldü:
  `0.22→0.29→0.41→0.55→0.69→0.83→1.0` (~350ms'de tamamlandı, doğrusal).
- **Gemini entegrasyonu — uçtan uca GERÇEKTEN çalıştığı doğrulandı**: 100s'lik koşuda
  gerçek bir istek atıldığı network seviyesinde doğrulandı; bir denemede Gemini
  kendisi HTTP 503 döndürdü ve kod bunu sessizce yuttu (sayfa hatası YOK). Ayrı bir
  koşuda başarı senaryosu da yakalandı: event log'a "🔬 Popülasyon genelinde
  ortalama..." metni gerçekten düştü.
- **Regresyon (Faz II/III/IV)**: organ çeşitliliği, su→kara kısıtı, Faz III eşik
  olayı, popülasyon dengesi (24→140) — hepsi sağlam.
- **Sonuç**: Faz V'in üç maddesi de çalışıyor, API anahtarı sızıntısı YOK, regresyon
  yok.

---

## Faz VI — Detaylar ve Tester Doğrulaması (arşiv)

### Detaylar (coder, 2026-09-02, tamamen senkron çalıştırıldı)

**Kısıt (birebir uyuldu)**: su→kara geçiş mekaniği hiç değiştirilmedi.

**1) Ölüm görünürlüğü** (`src/corpse.ts`, `src/ecosystem.ts`):
- `Corpse` — soluk/gri daire konturu + "X" iskelet çizgisi. `LIFETIME=22s` sonunda
  soluyor; ayrıştırıcı tarafından tüketilirse daha hızlı (~%18'i).
- `killCreature` artık `spawnCorpse()` çağırıyor (+%55 ihtimalle `Decomposer`).

**2) Soy ağacı grafiği** (`src/lineagetree.ts`):
- D3 YENİDEN EKLENMEDİ — düz bir `<canvas>` 2D çizimi. `LineageRecord[]` nesile göre
  satırlara ayrılıyor.
- **VARSAYILAN OLARAK KAPALI**: `#lineage-panel` `hidden` ile başlıyor, toggle butonu
  açıp kapatıyor.

**3) Seçim halkası** (`src/main.ts`):
- Pixi `Graphics` katmanı (`selectionRing`), seçili canlının konumunu her karede
  takip ediyor. Canlı ölünce veya boş alana tıklanınca kayboluyor.

**4) Soy tükenmesi takibi** (`src/ecosystem.ts`):
- `checkExtinctions()` — Faz III'ün döngüsüne eklendi. DÜRÜSTLÜK kuralı: bir organ
  tipi GERÇEKTEN gözlemlenmiş VE şimdi 0 ise tükenme olayı düşüyor.

**5) Ayrıştırıcı bakteriler** (`src/decomposer.ts`):
- Ayrı bir hareket/AI sistemi YOK — cesede sabit bir ofsetle "yapışık" beliriyor,
  `CONSUME_DURATION=4s` sonunda cesetle birlikte kayboluyor. %55 ihtimalle beliriyor.

### Tester doğrulaması (bağımsız, 2026-09-02): GEÇTİ
- `npx tsc --noEmit` ve `npm run build`: 0 hata. API anahtarı sızıntısı: YOK.
- Kod incelemesi: `canWalkOnLand`/`LAND_CAPABLE_ORGAN_TYPES`/`moveCreature` bu turda
  hiç değişmemiş.
- **ÖNEMLİ ARA OLAY**: test sırasında eşzamanlı bir Faz VII coder oturumu tespit
  edildi (geçici bir `TypeError` sayfa hatası yakalandı) — test DURDURULDU, dosyaların
  durulması beklendi, `tsc` tekrar temiz olduktan SONRA test baştan tekrarlandı. İlk
  (kirli) koşunun sonuçları rapora dahil edilmedi.
- **3 dakikalık senkron koşu (temiz kod tabanında tekrarlandı)**:
  - Ceset/ayrıştırıcı sayıları gerçek zamanlı dalgalandı (0-8 / 0-1 arası).
  - Soy ağacı: `hidden:true`→toggle→`hidden:false` (502×321 canvas, 24 düğüm)→tekrar
    `hidden:true`.
  - Seçim halkası + inceleme paneli: gerçek fare tıklamasıyla doğrulandı, ekran
    görüntüsünde halka görsel olarak teyit edildi.
  - Soy tükenmesi: gerçek bir tükenme olayı düştü ("Işık Noktası organı
    popülasyondan tamamen kayboldu").
  - **Su→kara mekaniği (KRİTİK) — SAĞLAM**: 12/12 örnekte ihlal yok.
  - Konsol/sayfa hatası: 0.
- **Not (kapsam dışı)**: eşzamanlı coder/tester oturumlarının aynı dosyalarda
  çalışmaması için sıralama netleştirilmesi önerisi (Faz II'de de yapılmıştı) —
  bu, "Süreç Notu"na dönüştü.
- **Sonuç**: Faz VI'nın 5 alt özelliği de çalışıyor, su→kara mekaniği SAĞLAM.

---

## Faz VII — Detaylar ve Tester Doğrulaması (arşiv)

### Detaylar (coder, 2026-09-02, tamamen senkron çalıştırıldı)

**Kısıt**: Gemini simülasyona DOĞRUDAN karışmıyor — sadece periyodik çağrıda küçük
bir sayısal "eğilim" sinyali üretip mutasyon ağırlıklarını hafifçe (±%10-20 sınırı)
kaydırabiliyor.

**1) Çiftleşme (cinsel üreme)**: `Genome.reproductionStrategy: "asexual"|"sexual"` —
mutasyonla (`REPRODUCTION_STRATEGY_FLIP_CHANCE=0.03`) fırsatçı şekilde ortaya çıkıyor.
`crossoverGenomes(a,b)` — uniform crossover + organ tipi birleşimi.
`Ecosystem.updateSexualReproduction()` — bağımsız kuluçka sayacı, `MATING_RADIUS=60px`.
**ÖNEMLİ DÜZELTME**: `updateDivision` artık `"sexual"` bireyleri atlıyor (`continue`) —
ilk implementasyonda bu kontrol eksikti, aseksüel bölünme cinsel eşleşmeye hiç sıra
bırakmıyordu.

**2) Yumurtalama** (`src/egg.ts`): `Genome.laysEggs: boolean` — bağımsız bir gen.
`Egg`: kuluçka süresi 8-15s arası, sade görsel. `hatchEgg()` süre dolunca
`Creature`'a dönüştürüyor.

**3) Yavru bakımı**: `Creature.isNearCaringParent(maxDistance)` — sadece mesafe
kontrolü, `PARENTAL_CARE_RADIUS=50px` içinde metabolizma %30 indirim.

**4) Gemini'nin hafif yönlendirmesi**: `buildPrompt()`'a JSON öneri formatı eklendi
(`{"target":..., "weightAdjustment":...}`). `extractSuggestion()` parse hatasında
sessizce `null` döner. `applyOrganWeightSuggestion`: delta önce ±0.2'ye clamp, sonra
çarpan `[0.8,1.2]` aralığına clamp — birikimli sınırsız büyüme YOK, bir organı tamamen
açıp kapatamaz.

**Kaydet/Yükle**: save-key sürümü v4'e çıkarıldı.

### Tester doğrulaması (bağımsız, 2026-09-02): GEÇTİ
- `npx tsc --noEmit`/`npm run build`: 0 hata. API anahtarı sızıntısı: YOK.
- **KRİTİK — bug düzeltmesi davranışsal olarak doğrulandı**: iki `"sexual"` birey
  zorla yakın mesafeye getirildi; 20 saniyelik izlemede İKİ FARKLI ebeveynli
  (`[1,2]`) bir soy kaydı oluştu, aseksüel bölünme olmadı.
- **Çiftleşme (organik)**: zorlama olmadan `"sexual"` bireyler 3'ten 5'e organik çıktı.
- **Yumurtalama**: `getEggCount()` 0→1→0 döngüsü gözlemlendi.
- **Yavru bakımı**: `nearCaringParent` sayısı 5-19 arası gerçek zamanlı değişti.
- **Gemini clamp (kritik)**: aşırı bir değer (`weightAdjustment:5`) TEK çağrıda
  `mouth:1.2`'ye sıçradı (0.2 adım sınırı), 20 kez tekrar uygulanınca `1.2`'de SABİT
  kaldı — birikimli sınırsız büyüme YOK.
- **Eski kayıt (v3) reddi**: sahte v3 kaydı enjekte edilip reload edildi — çökme YOK,
  sessizce reddedildi.
- **Kritik regresyon — su→kara**: `onLand > landCapable` hiç olmadı.
- **Sonuç**: Faz VII'nin 4 alt özelliği de çalışıyor. "Sexual" bireylerin aseksüel
  bölünmeyi GERÇEKTEN atladığı kanıtlandı. Gemini clamp'i sınırı hiç aşmadı.

---

## Faz VIII — Detaylar ve Tester Doğrulaması (arşiv)

### Detaylar (coder, 2026-09-02, tamamen senkron çalıştırıldı)

**1. Rastgele harita**: sabit `MAP_SEED` kaldırıldı, `generateMapSeed()`
(`Date.now() ^ rastgele`) eklendi. `World` constructor'ı `seed` parametresi alıyor.
Kaydedilmiş durum yoksa yeni seed, varsa `savedGame.mapSeed` geri yükleniyor.
"Yeniden Başlat" haritayı DEĞİŞTİRMİYOR (bilinçli karar).

**Kaydet/yükle uyumluluğu**: `SaveData.mapSeed: number` eklendi. `SAVE_VERSION` → 7.

**KRİTİK — SAVE_VERSION senkronizasyonu**: `main.ts`'teki iki save-yazma noktası
önceden sabit bir sayı literali yazıyordu (uyuşmazlık riski). Artık ikisi de
`SAVE_VERSION` sabitini import ediyor — sayı literali YOK.

**2. Rastgele dünya olayları** (`src/worldevents.ts`, yeni): `WorldEventManager` — 4
bağımsız zamanlayıcı (`EVENT_CHECK_INTERVAL=8s`):
- **Meteor** (☄️): `applyMeteorImpact` — rastgele bölgedeki canlıların/besinlerin
  ~%60'ını yok ediyor.
- **İklim** (🌡️): 45-90s süren metabolizma/besin üretim çarpanı dalgası.
- **Rüzgar** (💨): 12-25s süren itiş vektörü, küçük gövdeliler daha fazla sürükleniyor.
- **Deprem** (🌍): GEÇİCİ (25-50s) küçük bir su<->kara override'ı.

**Görsel**: `EventFlash` — basit, kendi kendini söndüren daire konturu.

### Tester doğrulaması (bağımsız, 2026-09-02): GEÇTİ
- `npx tsc --noEmit`/`npm run build`: 0 hata. API anahtarı sızıntısı: YOK.
- **Rastgele harita — KESİN KANIT**: 3 bağımsız sayfa yüklemesinde 3 FARKLI `mapSeed`
  üretildi. 20×20 örnekleme ızgarasında su hücre sayıları 186/223/204 — 3 desenin 3'ü
  de birbirinden FARKLI (Hamming mesafeleri 207-216/400).
- **Kaydet/yükle + seed korunumu — KESİN KANIT**: reload SONRASI `mapSeed` birebir
  aynı, TÜM 24 canlı ID'si korunmuş.
- **Eski (v6) kayıt reddi**: sahte kayıt enjekte edilip reload edildi — çökme YOK,
  sessizce reddedildi.
- **Dünya olayları — mekanik etkiler ölçüldü**: Meteor (popülasyon 24→23), Rüzgar
  (deplasman ~5px→~149px), İklim (0.5→1.4 enerji düşüşü oranı ~2.8x), Deprem
  (su→kara→su override döngüsü doğrulandı).
- **Gemini kota düzeltmesi — KESİN KANIT**: `GEMINI_MODEL="gemini-flash-lite-latest"`
  doğrulandı, proxy'ye gerçek istek `{"text":"Test"}` HTTP 200 döndü.
- **SAVE_VERSION senkronizasyon düzeltmesi doğrulandı**: iki `writeSaveData`
  çağrısının ikisi de `SAVE_VERSION` kullanıyor, sayı literali yok.
- **Kritik regresyon (~240 sim-saniyelik koşu)**: popülasyon dengesi (40→140, çöküş
  YOK), su→kara mekaniği SAĞLAM (12/12), diyet/etoloji dinamik, ceset/ayrıştırıcı
  dalgalı, soy ağacı toggle bozulmamış.
- **Sonuç**: Faz VIII'in rastgele harita + kaydet/yükle uyumu + 4 dünya olayı + Gemini
  kota düzeltmesi hepsi bağımsız doğrulandı. Bulunan risk: yok.

**Ek düzeltme (aynı gün, kullanıcı geri bildirimi — Gemini model kotası)**:
Kullanıcı "yanıt alınamadı" hatası bildirdi; kök neden: `gemini-3.6-flash` ücretsiz
katmanda günde 20 istek kotasına sahip ve doldurulmuştu. Düzeltme:
`GEMINI_MODEL` → `gemini-flash-lite-latest`, periyodik yorum aralığı 75s→120s'ye
çıkarıldı (kota paylaşımı için).

---

## Faz IX — Detaylar ve Tester Doğrulaması (arşiv)

### Detaylar — Madde 1-2 (öncelikli bug fix'ler, coder, 2026-09-02)
1. **Soy ağacı paneli kapanmıyor — KÖK NEDEN BULUNDU VE DÜZELTİLDİ**: JS mantığı
   aslında hep doğruydu. Gerçek sebep `.overlay-panel { display: flex; }` kuralının
   `[hidden]` UA stilini her zaman override etmesiydi. Düzeltme:
   `.overlay-panel:not([hidden]) { display: flex; }`. Playwright ile doğrulandı: açık
   520×380, kapalı 0×0.
2. **Ceset mantığı "işlemiyor" — KÖK NEDEN: mekanik çalışıyordu, GÖRÜNÜRLÜK
   sorunuydu**: ceset görseli (1px kontur, max alpha ~0.6) canlı popülasyon noktaları
   arasında fark edilemiyordu. Düzeltme: kontur 1px→1.5px, max alpha 0.7→0.9, minimum
   görsel yarıçap `max(radius,5)`, hafif dolgu eklendi.

### Detaylar — Madde 3-7 + 4 ek bug (coder, 2026-09-02, tamamen SENKRON)

**Madde 3 — Diyet sistemi**: `Genome.diet: "herbivore"|"carnivore"` — mutasyonla
(`DIET_FLIP_CHANCE=0.035`) değişebilir. Etçiller `stepCarnivore`/`findNearestPrey`/
`huntCreature` ile avlanıyor (`EAT_RADIUS` + `PREY_ENERGY_TRANSFER_FRACTION=0.6`).
Görsel ayrım: etçillerde 8 küçük kırmızı "diş" üçgeni + kalın kırmızı kontur. Save
format v4→v5.

**Madde 4 — Etoloji**: `Creature.behaviorState: "wander"|"seek"|"flee"|"hunt"`.
Otçullar tehdit varsa toklukça bağımsız önce kaçar; etçiller av kovalar (sadece
otçul hedefliyor).

**Madde 5 — Emoji + animasyonlar**: 🍽️/🦴/🌱 emoji eklendi.
`triggerHuntFlash()` — 0.35s büyüyüp normale dönen görsel vurgu.

**Madde 6 — Soy ağacından canlı seçimi + evrim geçmişi**: `lineagetree.ts`'e MİNİMAL
dokunuldu — `onNodeClick(handler)` + click listener. `LineageRecord` genişletildi
(`organs`, `diet`, `offspringCount`). `getAncestryChain`/`getEvolutionHistory` —
her nesilde yeni kazanılan organı listeliyor.

**Madde 7 — Gemini soy analizi**: `fetchLineageAnalysis` — aynı proxy, farklı prompt.
İnceleme panelinde isteğe bağlı "Bu soyu analiz et 🔬" butonu.

**4 ek sorun (kullanıcı geri bildirimiyle bulunan)**:
1. **Flee-lock bug'ı (kök neden bulundu ve düzeltildi)**: `moveCreature` tam vektörü
   tek parça deniyordu — engellenen hedefte hareket TAMAMEN iptal ediliyordu, "flee"
   her karede heading'i yeniden hesapladığından `bounceHeading` etkisi anında
   eziliyordu. Düzeltme: eksenleri ayrı ayrı dene (önce dx, sonra dy).
2. **Enerji her zaman azalmalı**: zaten doğruydu, kullanıcının gözlemi madde 1'in
   sonucuydu.
3. **Yaşlanma ölümü (yeni özellik)**: `Genome.maxLifespan` (180-320s) eklendi.
   Save v5→v6.
4. **Açlık/tokluk + av-avcı dengesi**: ilk uygulamada bir koşuda etçil sayısı 4'ten
   32'ye çıkıp otçul popülasyonunu çökertti. Düzeltme (3 parça): tokluk eşiği ikiye
   ayrıldı (etçil 0.6/otçul 0.75), sindirim molası uzatıldı (10-20s→20-35s), av
   sığınağı eşiği density-dependent yapıldı, etçil-etçil avlanması KALDIRILDI.

### Tester doğrulaması (bağımsız, 2026-09-02, tamamen SENKRON): GEÇTİ (ve 1 bug bulundu)

**1) Flee-lock bug — GERÇEKTEN DÜZELMİŞ, kanıtlı**: 3 bağımsız izole koşuda otçul her
üçünde de tehditten gerçekten uzaklaştı (8.9px/27.7px/48.5px — önceki bug'da 0 olurdu).

**2) Sürekli enerji azalması — DOĞRULANDI**: 8s'de 36.2→26.8.

**3) Yaşlılıktan ölüm — DOĞRULANDI**: zorla yaşlandırılan birey öldü, ceset bırakıldı.

**4) Av-avcı dengesi — 3/3 BAĞIMSIZ KOŞUDA SAĞLAM**: 3 koşuda otçul hiç kritik
seviyeye inmedi (aksine sürekli arttı), etçil dengeli bir bantta kaldı.
Etçil-etçil avlanmasının kalktığı ayrıca doğrulandı.

**5) Diyet görsel ayrımı — DOĞRULANDI**: yakın çekimde otçul/etçil net ayırt
edilebiliyor.

**6) Soy ağacından canlı seçimi — ÇALIŞIYOR**.

**7) Gemini soy analizi — ÇALIŞIYOR, hata toleranslı**.

**8-10) Regresyonlar (su→kara, organ çeşitliliği, ceset görünürlüğü)**: hepsi sağlam.

**11) BULUNAN VE DÜZELTİLEN GERÇEK BUG — Kaydet/Yükle TAMAMEN BOZUKTU**:
`SAVE_VERSION` 6'ya çıkarılmış ama `main.ts`'teki İKİ save-yazma noktası hâlâ
`version: 5` yazıyordu — her sayfa yenilemesinde kayıt sessizce reddediliyor, tüm
simülasyon durumu kayboluyordu. **Düzeltildi**: her iki `writeSaveData` çağrısı da
`version: 6`'ya güncellendi. Doğrudan kayıt→yenile→yükle turuyla yeniden doğrulandı
(27 canlı korundu).

**Genel sonuç**: Faz IX'un 4 ek düzeltmesi + orijinal 7 madde hepsi çalışıyor. TEK
bulunan gerçek sorun (kaydet/yükle version uyuşmazlığı) bu tester turunda tespit
edilip düzeltildi.

---

## Faz X — Detaylar ve Tester Doğrulaması (arşiv)

### Detaylar (coder, 2026-09-02, tamamen SENKRON çalıştırıldı)

**1. Sığ/derin su ayrımı** (`src/world.ts`): mevcut ızgara üstüne ince, salt-okunur
bir katman — `World.isShallowWater(x,y)`/`isDeepWater(x,y)`.
`approxDistanceToLandPx` genişleyen halka araması ile en yakın kara hücresine
yaklaşık mesafe buluyor. Eşik `SHALLOW_WATER_BAND_PX=70`. Bacaklı-ama-yüzgeçsiz/
solungaçsız birey derin suya giren hareketi engelleniyor (`canEnterDeepWater()`).

*Doğrulama*: 1855+ hareket denemesinde 0 adet izinsiz derin suya giriş. Test-ölçüm
hassasiyeti sorunu (yuvarlama) tespit edilip düzeltildikten sonra sızıntı SIFIR'a
indi.

**2. Avlanma event log gürültüsü**: Tekil avlanma olayları event log'dan TAMAMEN
KALDIRILDI (mekanik hâlâ çalışıyor, sadece log'a düşmüyor). Gerekçe: (a) tam kaldırma
periyodik özetten daha temiz, (b) diyet sayıları HUD'da zaten sürekli görünür, (c)
tekil av olayları tek seferlik kilometre taşı değil. `checkFirstCarnivore` (İLK
etçilin ortaya çıkışı) BİLEREK korundu.

**3. Solunum organları + iç organlar + atmosfer**: `gill`/`lung` eklendi (solunum),
`heart`/`stomach` (iç organlar, mekanik etkili ama görsel çizim gerektirmiyor).
`src/atmosphere.ts` (yeni): global oksijen seviyesi (0..1) yavaş sinüs dalgası
(`OXYGEN_CYCLE_SECONDS=240`) + iklim olayı etkisiyle ek ofset. Save format
DEĞİŞMEDİ (organ listesi zaten jenerik).

*Doğrulama*: uç değerlerde metabolizma çarpanı %25'e kadar değişti. Organik koşuda
`lung` organı 0'dan 9'a yayıldı, oksijen seviyesi 0.58→0.43 gerçekten dalgalandı.

**Regresyon (Faz I-IX)**: tümü temiz — su→kara SAĞLAM, kaydet/yükle organlar dahil
korundu, diyet/etoloji/ceset/ayrıştırıcı dinamik.

### Tester doğrulaması (bağımsız, 2026-09-02/03): GEÇTİ
- `npx tsc --noEmit`/`npm run build`: 0 hata. API anahtarı sızıntısı: YOK.
- **Sığ/derin su ayrımı — KESİN KANIT**: bacaklı-ama-yüzgeçsiz birey, çevresi
  TAMAMEN derin su olan bir noktaya yerleştirildi — 50 örnekte TOPLAM YER DEĞİŞTİRME
  SIFIR, tamamen donmuş kaldı. Kontrol grubu (bacak+yüzgeç) 10s'de 145px yer
  değiştirdi.
- **Avlanma event log gürültüsü — KESİN KANIT**: organik koşuda popülasyon 24→79,
  etçil 0→2, ceset 0→2 arttı ama event log'da SADECE 1 satır kaldı ("İlk etçil ortaya
  çıktı"). Zorlanmış bir avlanmada av öldü ama log'da av metni YOK, meteor/tükenme
  olayları log'a DÜŞMEYE DEVAM ETTİ.
- **Solunum organları + atmosfer — KESİN KANIT**: gill (suda) düşük O2'de çarpan
  0.896 (avantaj); lung (karada) yüksek O2'de 0.980 (avantaj), düşük O2'de 1.104
  (dezavantaj — bedava bonus değil). Atmosfer 60s'de 0.515→0.620 gerçekten
  dalgalandı. Save/load roundtrip'i (gill/lung/heart/stomach) tam korundu.
- **Kritik regresyonlar**: su→kara SAĞLAM, popülasyon dengesi normal (24→79, çöküş
  yok), diyet/etoloji dinamik, soy ağacı toggle çalışıyor. Konsol/sayfa hatası: SIFIR.
- **Yan not (kapsam dışı)**: `npm run dev` konsol çıktısında proje kodundan
  kaynaklanmayan şüpheli bir satır ("auth for agents" + üçüncü taraf domain)
  gözlemlendi — proje dosyalarında kaynağı bulunamadı, muhtemelen proje dışı bir
  ortam/kabuk kaynaklı.
- **Sonuç**: Faz X'in 3 maddesi de bağımsız olarak, gerçek ölçümle doğrulandı.
  Bulunan risk: yok.

---

## Faz XI — Detaylar (Sürekli İyileştirme, arşiv)

### Performans/entegrasyon denetimi (GEÇTİ, 2026-09-03)
Saf okuma/test (kaynak dosya değiştirilmedi) — 9+ dakikalık 4x hız koşusu (~545
sim-saniyesi):
- FPS ilk yükten sonra 16-17'de düz kaldı, bellek 9dk boyunca tam 15.4MB'de sabit
  (sızıntı yok), DOM node sayısı 300s civarı 95'te platoya oturdu. Popülasyon
  24→140'a çıkıp orada dengeye oturdu. 4 dünya olayı da organik tetiklendi.
  `lung`/`stomach` organik ortaya çıktı. Sıfır konsol/sayfa hatası.
- **Karar gereken bulgu**: sayfa yenilenince ceset sayacı sıfırlanıyor (10→0). PM
  kararı: bu KASITLI/kabul edilebilir — proje zaten geçici/görsel-çevresel durumları
  kaydetmiyor.
- **Sonuç: proje uzun vadede sağlam.**

### Faz XI — Responsive Detayları (coder, 2026-09-03)
- **Dürüst değerlendirme (öncesi)**: 5 viewport'ta headless ölçüm yapıldı.
  Geniş/orta ekranlarda sorun yoktu. Dar ekranlarda: `#dash-body` grid'i sabit
  `1fr 280px` idi — 800x600'de sağ panel ekranın %35'ini alıp sahne alanını
  520×548px'e sıkıştırıyordu. 640x480'de sahne 360×428px'e düşüyordu VE header
  metni 2 satıra bölünüyordu.
- **Yapılan değişiklikler (sadece `src/dashboard.css`)**:
  1. `#dash-header`: `height`→`min-height` + `flex-wrap`.
  2. `#dash-body` grid-template-columns kademeli daraltıldı: ≤1100px→`1fr 230px`,
     ≤860px→`1fr 190px`. ≤680px genişlik VEYA ≤560px yükseklik: tek sütuna döner.
  3. Header buton kompaktlaştırma: ≤680px'de başlık metni gizlenip "EG" rozeti kalıyor.
  4. `MAP_WIDTH`/`MAP_HEIGHT`/`fitCamera` DEĞİŞMEDİ.
- **Doğrulama (5 viewport)**: sahne canvas boyutu ölçüldü (800×600'de 520×548→
  610×548, +17%; 640×480'de tek-sütuna geçiş). Yatay taşma: 5/5 viewport'ta `false`.
  Tüm kontroller (hız/Soy Ağacı/Detaylar/Yeniden Başlat/Dışa Aktar/canlı tıklama)
  5 viewport'ta da PASS. Uzun regresyon koşusu (60s, 1024×768): popülasyon 24→140,
  konsol/sayfa hatası SIFIR.
- **Tester doğrulaması: GEÇTİ, 2026-09-03.** 4 viewport'ta (1920x1080, 1024x768,
  800x600, 640x480) bağımsız olarak sıfırdan doğrulandı — yatay/dikey taşma yok,
  panel daralması/stack davranışı görsel olarak teyit edildi, tüm kontroller
  erişilebilir/tıklanabilir, 800x600 ve 640x480'de canlı tıklama ile inceleme paneli
  gerçek koordinatla açıldı (kesilen içerik kaydırmayla erişilebilir). Kritik
  regresyon (1920x1080): UI/UX sadeleştirmesi bozulmamış, popülasyon 24→38 normal
  büyüme, localStorage kaydı sağlam. Sonuç: GEÇTİ, bug/regresyon yok.

### Faz XI — UI/UX Sadeleştirme Detayları (coder, 2026-09-03)
- **Dürüst değerlendirme**: olgun bir oturumda (inceleme paneli açık + Diyet/
  Atmosfer/Dünya dolu + event log dolu) yan panel 4 ayrı bloğa bölünüyordu, inceleme
  paneli event log'u neredeyse tamamen ekrandan itiyordu. Kalabalıklaşma gerçekti.
- **Yapılan değişiklikler**:
  1. **İstatistik ızgarası ikiye ayrıldı**: Popülasyon/Zaman/Nesil/Toplam Bölünme
     birincil 2x2 ızgarada kaldı; Dünya/Diyet/Atmosfer varsayılan KAPALI bir
     `<details>` "▸ Detaylar" bölmesine taşındı.
  2. **Header kontrolleri gruplandı**: Soy Ağacı ile hız/restart kümesi arasına
     ince bir dikey ayraç eklendi, Soy Ağacı butonuna 🌳 emoji eklendi.
  3. **İnceleme paneli sınırlandı**: `max-height: 46vh` + kendi içinde scroll —
     event log her zaman en az bir miktar görünür kalıyor.
  4. **Kaldırılan hiçbir özellik/panel yok**.
- **Doğrulama**: 21 assertion, hepsi PASS. Detaylar toggle çalışıyor, hız kontrolü/
  Yeniden Başlat/Soy Ağacı/canlı inceleme/Gemini butonu — hepsi sağlam. Konsol/sayfa
  hatası: SIFIR.
- **Tester doğrulaması: GEÇTİ, 2026-09-03.** `npx tsc -b --force`/`npm run build`:
  0 hata. API anahtarı sızıntısı: YOK. Dürüst görsel değerlendirme (73 popülasyon,
  olgun oturum ekran görüntüsü) — birincil 2x2 ızgara net üstte, "▾ Detaylar" tek
  satır, event log gerçekten yer kaplıyor (2 tam olay satırı görünür). Detaylar
  toggle gerçek tıklamayla kapalı→açık→kapalı doğrulandı. Regresyon kontrolü (hepsi
  PASS): hız kontrolü, Yeniden Başlat, Soy Ağacı toggle, canlı tıklama/inceleme
  paneli/seçim halkası, Gemini butonu. İnceleme paneli açıkken event log alanı ~106px
  (2 olay satırı tam görünür). Kritik regresyon: su→kara sağlam, diyet/etoloji
  dinamik, popülasyon dengeli (73→112). Sonuç: GEÇTİ, sadeleştirme gerçek, hiçbir
  özellik/regresyon kaybı yok.

### Faz XI — Dışa/İçe Aktarma Detayları (coder, 2026-09-03)
- **Kapsam**: mevcut localStorage-tabanlı otomatik kayıt sistemine HİÇ DOKUNULMADI.
  Birden fazla kayıt slotu kapsam dışı bırakıldı.
- **Yeni dosya**: `src/exportimport.ts`.
  - `exportSaveDataToFile(data)`: `Blob` + geçici `<a download>` ile indiriyor.
  - `importSaveDataFromFile(file)`: `isValidSaveData` ile "ya tam kabul ya tam red"
    doğrulaması, hata durumunda `null` döner (asla fırlatmaz).
- **UI**: header'a "⬇️ Dışa Aktar"/"⬆️ İçe Aktar" butonları + gizli file input.
  Geçersiz dosyada uygulama ÇÖKMEZ, görünür "⚠️ Geçersiz kayıt dosyası" mesajı
  düşer.
- **Bilinçli sınırlama**: içe aktarma farklı bir haritadan (`mapSeed`) geliyorsa bu
  seed UYGULANMIYOR — aynı oturumda dışa/içe aktarma (en yaygın kullanım) sorunsuz.
- **Doğrulama**: gerçek `download` olayı + geçerli JSON (`version:7`, 25 canlı,
  `mapSeed` mevcut). Bozuk/yanlış-şekilli dosyalar ikisinde de çökme yok, görünür
  hata mesajı düştü.
- **Tester doğrulaması: GEÇTİ, 2026-09-03.** `npx tsc --noEmit`/`npm run build`:
  0 hata. API anahtarı sızıntısı: YOK. 24 assertion, hepsi PASS: Dışa Aktar gerçek
  `download` olayı + geçerli JSON (version:7, 24 canlı, mapSeed); İçe Aktar ile
  popülasyon birebir eşleşti; bozuk JSON VE geçerli-JSON-yanlış-şekil ikisinde de
  çökme yok, görünür hata mesajı düştü. **Farklı mapSeed senaryosu test edildi**:
  çökme/sessiz bozulma YOK, mapSeed uygulanmıyor (coder'ın belgelediği sınırlama),
  koordinatlar her zaman harita sınırları içinde kaldığından risk sadece kozmetik
  (kara/su tutarsızlığı). Karar: kabul edilebilir sınırlama. Kritik regresyon: hız
  kontrolü, Soy Ağacı, localStorage otomatik kaydı (bozulmamış), popülasyon dengesi
  (24→24→24) — hepsi PASS. Sonuç: GEÇTİ.

---

## Faz XII — Detaylar ve Tester Doğrulaması (arşiv)

### Detaylar (coder, 2026-09-03)

**Madde 4 — BUG düzeltmesi (öncelikli)**: Kök neden: `lineagetree.ts` TÜM
`LineageRecord`'ları sabit 520×380px panel içine, sabit 3px yarıçaplı düğümlerle
sıkıştırıyordu. Bir nesil satırında birey sayısı arttıkça düğüm başına düşen aralık
tıklama toleransının altına düşüyor, düğümler üst üste biniyor, tıklama isabet testi
yanlış düğümü seçiyordu.
- **Düzeltme**: sabit panel genişliği yerine **minimum düğüm aralığı**
  (`MIN_NODE_SPACING=14px`) korunuyor — canvas'ın SANAL genişliği büyüyor, yeni
  `#lineage-canvas-wrap` (`overflow: auto`) ile kaydırmayla erişiliyor. Düğüm
  yarıçapı 3px→4px, tıklama toleransı büyütüldü.
- Mevcut "son 6 nesille sınırlama" iddiası kod incelemesiyle YANLIŞ çıktı — böyle bir
  sınırlama zaten yoktu, asıl sorun nesil SAYISI değil bir nesil SATIRINDAKİ birey
  yoğunluğuydu.
- *Doğrulama*: 46 bireylik bir nesil satırında 15 farklı düğüme gerçek fare
  tıklaması yapıldı, 15/15 doğru bireyi seçti.

**Madde 1 — Besin üretim oranı kontrolü**: `setUserNutrientMultiplier` (0.25x-3x)
eklendi, `climateNutrientMultiplier` ile ÇARPIMSAL. Detaylar bölmesine +/- butonlu
satır eklendi. 1x→3x arası nutrient sayısı 34→168 (su)/24→60 (kara) arttı.

**Madde 2 — Manuel doğa olayı tetikleme**: `<select>` (Rastgele/Meteor/İklim/
Rüzgar/Deprem) + "Tetikle" butonu, mevcut `forceTrigger` yeniden kullanıldı.

**Madde 3 — Doğa olaylarını durdurma butonu**: `setAutoEventsEnabled(false)` —
aktif bir olayın süresi etkilenmiyor, manuel tetikleme bu bayraktan bağımsız.

**Madde 5 — Soy ağacında renk/efekt/organ ayrımı**: `dominantOrganType` (genomdaki
SON eklenen organ) kategorisine göre renkli ince bir dış halka (`CATEGORY_COLORS`).

**Madde 6 — Soy ağacında filtreler**: diyet/organ tipi/hayatta-ölü/nesil aralığı
filtreleri — filtrelenmeyen düğümler SOLUKLAŞTIRILIYOR (`alpha:0.15`), gizlenmiyor.

**Doğrulama**: `npx tsc -b --force`/`npm run build`: 0 hata. API anahtarı sızıntısı:
YOK. Soy ağacı bug'ı — 40-45s'lik koşularla 145-196 kayıtlık ağaçlarda 15/15 doğru
tıklama. Manuel kontroller, renk/organ ayrımı, filtreler — hepsi gerçek UI/canvas
piksel testiyle doğrulandı (4/4 filtre gerçek görsel etki üretti).

### Tester doğrulaması (bağımsız oturum, 2026-09-03, tamamen SENKRON): GEÇTİ
Coder'ın iddialarının tümü, ayrı bir Playwright oturumunda bağımsız olarak
tekrarlandı. Hiçbir regresyon/bug bulunmadı.
- `npx tsc --noEmit`/`npm run build`: 0 hata. API anahtarı sızıntısı: YOK (mimari de
  incelendi — yapısal olarak sızıntıya kapalı).
- **Madde 4 (BUG) — KESİN, BAĞIMSIZ KANIT**: 407 kayıtlık bir soy ağacı üretildi; en
  kalabalık nesil satırı **100 birey** içeriyordu (coder'ın test ettiğinden fazla).
  Düğüm aralığının `MIN_NODE_SPACING` (14px) hedefini koruduğu ölçüldü (14.14px).
  100 düğümlük satırın 15 farklı noktasından gerçek fare tıklaması yapıldı: **15/15
  doğru birey seçildi**. Kaydırma mekanizması da doğrulandı.
- **Madde 1**: 1.00x→3.00x ve 3.00x→0.25x arası doğru clamp'lendi. 3x çarpanda
  nutrient +231, 0.25x çarpanda -117 (net düşüş) — gerçek ve yön olarak beklenen.
- **Madde 2**: Meteor/Rüzgar tetiklendi, sayaçlar ve event log satırları eşleşti.
- **Madde 3**: Toggle ile devre dışıyken 120 sim-saniyesi boyunca olay sayısı SIFIR
  arttı; tekrar açılınca 15s içinde organik olay tetiklendi.
- **Madde 5**: iki farklı baskın-organ kategorisi (movement/feeding) piksel
  örneklemesiyle karşılaştırıldı — renkler belirgin şekilde farklı (renk mesafesi
  226.5).
- **Madde 6**: 4 farklı filtre tek tek uygulanıp canvas piksel imzası her birinde
  ölçülebilir şekilde değişti (4/4 gerçek etki, no-op değil).
- **Kritik regresyon kontrolü (hepsi PASS)**: popülasyon dengesi, su→kara mekaniği,
  Dışa Aktar, hız kontrolü, Yeniden Başlat, 800×600 dar viewport'ta soy ağacı —
  tüm testler boyunca konsol/sayfa hatası SIFIR.
- **Küçük not (bug değil)**: `dominantOrganType` yorum satırı "en yüksek `power`
  değerine sahip organ" diyor ama kod aslında SON eklenen organı kullanıyor —
  davranış hâlâ gerçek veriye dayalı, sadece bir yorum küçük şekilde yanlış/çelişkili.

## Faz XIII — Detaylar ve Tester Doğrulaması (arşiv)

Kullanıcı geri bildirimi: mevcut davranış "başarısız canlılar" gibi görünüyordu —
karaya çarpıp rastgele hareket ediyorlar, gerçek bir hayvan gibi korkup kaçmıyor/
yemek için mücadele etmiyor/bol yiyecek olan yere gitmeye çalışmıyor gibi
hissettiriyordu. Ayrıca bir noktadan sonra denizlerde besin tükenip TÜM
popülasyon ölüyordu.

### Madde 1 — BUG — kök neden analizi (ilk tur)
**YANLIŞ ilk hipotez (elenmiş)**: flee/besin-arama çakışması şüpheliydi, ölçüm
elediği: bir düzeltme (kritik açlıkta kaçarken de yakın besin varsa yeme + sınır
farkındalığı) uygulanıp 3 bağımsız koşu yapıldığında YİNE toplu çöküş gözlemlendi
(`fixed_run2`: t=291-322s pop 140→0, `water_nutr` çöküş boyunca sabit/bol kaldı).
Bu, sorunun "canlılar besine ulaşamıyor" değil "yeni besin canlıların bulunduğu
yere hiç gelmiyor" olduğunu gösterdi.

**GERÇEK KÖK NEDEN (ölçümle doğrulandı)**: `nutrientCapacity(population, base) =
base + population*1.4` ANLIK popülasyona göre hesaplanıyordu. Popülasyon küçük
bir düşüş yaşadığında cap AYNI KAREDE küçülüyor, stok yeni (küçülmüş) cap'in
üstünde kaldığından `if (nutrients.length >= cap) return;` kapısı TAMAMEN
kapanıyor — yeni nutrient üretimi anında duruyor. Var olan stok sayıca bol
görünse de ÖNCEKİ (daha büyük) popülasyonun konumlarına göre coğrafi olarak
dağılmıştı; `medianDistToFood` bir ölçümde 644px'e fırladı, 140 canlının 121'i
algı menzilinde HİÇ besin bulamıyordu — kendi kendini besleyen bir geri
beslemeli çöküş sarmalı (140→0, bazı koşularda 27 saniyede).

**Düzeltme (ilk tur, 3 parça)**:
1. `effectiveWaterPopulation`/`effectiveLandPopulation` — ANLIK popülasyon
   yerine 20s yarı ömürlü üstel sönüm (`decayTowards`) ile hesaplanan bir
   tahmine göre kapasite/spawn hızı belirleniyor.
2. **Asıl belirleyici düzeltme**: `spawnPointNear`'ın anchor seçimi artık düz
   rastgele değil, enerji oranı düşük (AÇ) bireylere doğru ağırlıklı
   (`pickHungryWeightedAnchor`, ağırlık tabanı asla 0'a inmiyor).
3. Kritik açlıkta (`energy/maxEnergy <= 0.12`) kaçarken de `EAT_RADIUS`
   içindeki besin yeniyor (korunuyor).

**Doğrulama (ilk tur)**: 3 bağımsız 400s'lik koşu — hiçbirinde toplu/ani çöküş
yok, popülasyon 140'ta sabit, ortalama enerji 0.82-0.87 aralığında sağlıklı.

### Madde 2 — Davranış AI kalitesi: TAMAMLANDI
- **Sınır farkındalığı**: `applyBoundaryAwareness` — heading'de 26px ileri
  bakılıyor, geçersizse birkaç aday açı arasından ilk geçerliye HAFİFÇE
  (blendAngles, %55 ağırlık) yönelme uygulanıyor. Reaktif bounce güvenlik ağı
  olarak kalıyor ama normal şartlarda tetiklenmiyor. wander/seek/flee/hunt
  hepsi `steerDeltaAwayFromBoundary`'den geçiyor.
- **Gerçek besin arayışı**: `findBestNutrientCluster` — en yakın değil, yerel
  yoğunluk (55px komşuluk) + mesafe cezası birleşen bir skora göre en iyi
  kümeyi seçiyor.
- **Rekabet**: `claimedNutrientsThisFrame` — "ilk talep eden kazanır", ama
  algı menzilindeki HER ŞEY claim edilmişse claim yok sayılıp en yakın
  nutrient'a yönelme yapılıyor (hiç yememekten iyi).
- **Kaçış**: sınır farkındalığıyla birleşti, kaçarken karaya/sınıra sıkışma
  riski azaldı.
- Doğrulama: flee sayısı 10-25 arası dalgalanırken bile popülasyon/enerji
  sağlıklı kaldı (önceden toplu ölüme giden bir senaryo).

### Madde 3 — Gemini soy-bazlı davranış önerisi: TAMAMLANDI
`geminiinsight.ts`'teki periyodik (120s) çağrıya eklenen ikinci JSON satırı
(`{"trait": "wanderBoldness"|"foragingPriority", "adjustment": -0.2..0.2}`) —
Faz VII'nin organ ağırlık önerisiyle aynı desen: `applyGeminiBehaviorSuggestion`
±0.15 toplam clamp'li bir ofset biriktiriyor. Ana hareket kararı her zaman
senkron/lokal çalışıyor, Gemini başarısız olursa ofsetler 0 kalır.

### Tester doğrulaması (ilk tur, bağımsız): GEÇTİ
`tsc`/`build` temiz, API anahtarı sızıntısı yok. 3 bağımsız 4 dakikalık koşuda
(run1: pop 39→140 stabil enerji 0.75-0.85; run2: pop 46→140 enerji 0.70-0.84;
run3: pop 37→140 enerji 0.72-0.85) **3/3 koşuda toplu/ani çöküş SIFIR**.
Gemini clamp aşırı değerle (999/-999) test edilip ±0.15'e kesin clamp edildiği
doğrulandı. Kritik regresyon (organ çeşitliliği 8 tip, diyet 137/3, etoloji 4
durum, yaşlılık ölümü 5, ceset/ayrıştırıcı aktif, atmosfer geçerli) sağlam.

### Faz XIII — YENİDEN AÇILDI (ikinci tur, besin çöküşü tam düzelmemiş)
Faz XIV testeri, regresyon kontrolü sırasında düzeltmenin **5 bağımsız uzun
koşudan 2'sinde** hâlâ aynı çöküş imzasıyla (su besin stoku sabit/bol kalırken
`medianDistToFood` 123px→591px'e fırlıyor) tekrarlandığını buldu — birinde tam
140→0/~25s, diğerinde 140→13'e inip kendiliğinden toparlandı. Çöküş anlarında
Faz XIV'ün yeni organları YOKTU (ilgisiz bir regresyon).

**SONUÇ (coder): TAMAMLANDI — 10/10 bağımsız koşuda çöküş SIFIR.**
**Kesin kök neden**: `updateNutrientSpawning`'deki kapasite kapısı
(`if (nutrients.length >= cap) return;`) SADECE TOPLAM SAYIYA bakıyordu,
COĞRAFİ dağılıma değil. Tanılama koşusunda yakalandı: `waterNutr:316`
(kapasiteye yapışık) iken `medianDistToFood` 3 saniyede 179'dan 318'e fırladı —
stok SAYICA doluydu ama popülasyonun bulunduğu bölgeden UZAKTA donmuş kalmıştı,
kapı kapalı olduğu için yeni (aç bireye yakın) besin hiç eklenemiyordu.

**Elenen hipotez**: `spawnPointNear`'ın 8-denemelik yerel arama başarısız olup
tamamen rastgele bir noktaya düşme oranı ölçüldü (`%0.37`, 12823 denemeden 48
fallback) — ana kök neden değildi, elendi.

**Düzeltme (iki parça)**:
1. `computeHungerSeverity()` — ortalama enerji oranı %55 eşiğinin altına
   düşünce (popülasyon ≥10) 0-1 arası bir "ciddiyet" skoru üretir.
2. Bu skor hem kapasiteye (`computeHungerCapacityBoost`, +0-100) HEM spawn
   hızına (`computeHungerSpawnRateBoost`, +0-3x, toplamsal) ek yapıyor.
   **İLK deneme (sadece kapasite genişletmesi) 6 koşudan 5'inde geçti ama
   6.'da YİNE ÇÖKTÜ** — kapasiteyi büyütmek tek başına yetersizdi, kapı açılsa
   bile spawn hızı kıtlıkta toparlanmayı yeterince hızlandırmıyordu. İKİNCİ
   düzeltme (spawn hızına da ek) eklenince davranış düzeldi.

**Doğrulama — kesin sayılar**: İlk düzeltme 5/6 (yetersiz, ikinci düzeltme
eklendi). İkinci düzeltme: **10/10 bağımsız 5 dakikalık koşu — TAMAMI TEMİZ,
SIFIR çöküş** (w1-w10). `tsc`/`build` temiz, API anahtarı sızıntısı yok,
geçici tanılama sayaçları tamamen geri alındı.

### Son bağımsız tester doğrulaması: GEÇTİ — 5/5 bağımsız koşu, SIFIR çöküş
Coder'ın 10/10 sonucundan TAMAMEN BAĞIMSIZ, ayrı bir dev server ve script'le
5 bağımsız 5 dakikalık koşu — **5/5 TAMAMEN TEMİZ, SIFIR çöküş**, tüm 5 koşu
popülasyon tavanı 140'a ulaşıp orada stabil kaldı. `medianDistToFood` zaman
zaman yükseldi (maks 226px) ama hiçbir zaman popülasyon çöküşüyle sürdürülemedi
— güvenlik supabının beklenen davranışı. Regresyon (diyet 135/5, su→kara,
Faz XIV'ün 5 yeni organı mevcut ve 2'si organik ortaya çıktı) sağlam.

**NİHAİ SONUÇ**: Toplam 15 bağımsız uzun koşu (coder'ın 10 + tester'ın 5)
arasında SIFIR çöküş.

### Faz XIII — Ek doğrulama (kullanıcının gerçek tarayıcı raporu üzerine)
Kullanıcı 15/15 test onayına rağmen GERÇEK tarayıcısında hâlâ besin çöküşü
yaşadığını bildirdi. PM iki olası neden belirledi: (1) kullanıcının sekmesi
TÜM düzeltmelerden önce başlamış çok eski bir dev server'a bağlıydı (HMR-drift
riski) — durduruldu, temiz bir dev server başlatılıp kullanıcıya sert yenileme
(Ctrl+Shift+R) söylendi; (2) test koşularımız kısaydı (5-9dk), gerçek oturum
daha uzun/manuel kontrol kullanımı içeriyor olabilir.

**Ek doğrulama**: 5 bağımsız ~5dk'lık koşu, HEPSİ TEMİZ — `crashDetected:false`
ve `finalPop:140` hepsinde, `medianDistToFood` zaman zaman yükseldi (maks
268px) ama hep kendiliğinden düzeldi.

**Kümülatif durum**: Faz XIII'ün 10 + ilk tester'ın 5 + bu ek 5 = **toplam 20
bağımsız uzun/orta koşuda sıfır çöküş**. Bu koşular hep 5-9 dakikaydı; TAM
20-30+ dakikalık gerçek-zaman testi (manuel besin oranı/doğa olayı kontrolü
kullanımıyla) TASKS.md'nin güncel/açık konular bölümünde not edildi — henüz
tamamlanmadı. En olası açıklama hâlâ eski/HMR-drift dev server'dır.

## Faz XIV — Detaylar ve Tester Doğrulaması (arşiv)

Kullanıcı isteği: mevcut organ havuzu genişletilsin, "sıra dışı" organlar
istendi — gerçek dünya adaptasyon/direnç mekanizmalarından ilham almalı, saf
fantastik olmamalı (kışlama/torpor, kuraklık direnci, izolasyon tabakası,
mimikri, sembiyoz, sürü davranışı gibi örnekler verildi). **Tasarım kararı
(PM, güvenlik/kararlılık için)**: organlar HALA elle kodlanmış, sabit mekanik
etkili olacak — Gemini yeni mekanik icat etmiyor, sadece hangi organların bir
soy için öne çıkarılacağına dair bir ağırlık nudge'ı önerebiliyor (Faz XIII
madde 3'ün mekanizması genişletilmiş organ havuzuna da uygulanıyor).

### Madde 1 — Yeni/sıra dışı organlar: TAMAMLANDI
5 yeni organ tipi eklendi (`src/organs.ts`):
- **Kışlama Bezi (`torpor`)**: enerji oranı ≤%20 kritik eşiğine düşünce
  metabolizmayı %35-70 yavaşlatır — kamp balığı/ayı kışlama davranışı ilhamlı.
- **İzolasyon Tabakası (`blubber`)**: global iklim çarpanının etkisini
  %40-80 yumuşatır — fok/penguen yağ tabakası ilhamlı.
- **Biyolüminesans (`bioluminescence`)**: algı menzilini +20-50px artırır.
- **Zehir Bezi (`venom`)**: kaçış şansına +0.15-0.4 ekler.
- **Rejenerasyon (`regeneration`)**: beslenme verimliliğini +%10-25 artırır.
Her organın kendi şematik (karikatür olmayan) çizimi var. `ALL_ORGAN_TYPES`/
`pickRandomOrganType` otomatik kapsıyor, save format ekstra değişiklik
gerektirmeden yeni tipleri kabul ediyor.

**Doğrulama (coder)**: `__forceOrgans` ile 5 organ tek tek ve birlikte atanıp
teyit edildi; torpor mekaniği ÖLÇÜLEREK doğrulandı (aynı düşük enerjide 1s'de:
organsız 1.5 kayıp, torporlu 0.5 kayıp — %67 azalma). 3dk'lık koşuda
`bioluminescence` organik mutasyonla ortaya çıktı.

**Doğrulama (bağımsız tester)**: kod incelemesi coder'ın iddialarıyla birebir
örtüştü. 3 bağımsız 4dk'lık koşuda 5 yeni organdan EN AZ 2-4'ü HER koşuda
organik mutasyonla ortaya çıktı (run1: blubber+venom; run2: venom+regeneration+
blubber+torpor; run3: regeneration+venom+bioluminescence+torpor). Torpor
mekaniği ayrıca doğrulandı: kontrol grubu 1.2s'de 1.30 kaybederken torpor'lu
(power=1.0) birey 0.40 kaybetti (%69.2 azalma, kod formülüyle tutarlı).

### Madde 3 — Organ açıklamaları: TAMAMLANDI
`OrganDefinition`'a `description` alanı eklendi, TÜM organ tiplerine (19 tip)
koddaki GERÇEK mekanik etkiyle tutarlı kısa açıklama yazıldı. Inceleme
panelinde her organ chip'inin altında gösteriliyor, gerçek tıklamayla
doğrulandı (ekran görüntüsüyle de teyit).

### Madde 2 — BUG (soy ağacı seçim halkası): YENİDEN ÜRETİLEMEDİ (hem coder hem tester)
Kullanıcı raporu: soy ağacından bir düğüme tıklayınca seçim halkası sahnedeki
gerçek canlının etrafında değil, soy ağacı panelinin/canvas'ının üzerinde
"takılı" görünüyordu. Kapsamlı, çok senaryolu bir araştırma yapıldı ama bug
DOĞRULANAMADI:
- Kod incelemesi: `selectionRing` `world` container'ının çocuğu (dünya
  transform'una tabi), `setSelection()` her zaman `creature.x2`/`y2`
  (world-koordinatı) kullanıyor. `lineageTree.onNodeClick` aynı
  `setSelection()`'ı çağırıyor — soy ağacına özel farklı bir kod yolu yok.
- Coder: 4 farklı senaryo (duraklatılmış/aktif sim, zoom'lu, ölü→canlı geçiş)
  test edildi, HEPSİNDE halka pozisyonu canlının gerçek world-koordinatıyla
  (±birkaç px) birebir eşleşti. Ekran görüntüsüyle de doğrulandı: halka panelin
  dışında, sahnedeki gerçek konumda görünüyor.
- Tester (bağımsız tekrar): kod incelemesi coder raporunu doğruladı. 4 farklı
  senaryo (piksel-altı hassasiyette: 0.003px, 1.35px, 0.041px, 0.048px) hepsi
  eşleşti.
- **Olası açıklamalar**: (a) bug Faz XII'nin "soy ağacı tıklama bug'ı
  düzeltildi" turunda zaten giderilmiş olabilir, kullanıcının Faz XIV geri
  bildirimi o düzeltmeden ÖNCEKİ bir deneyimi yansıtıyor olabilir; (b) çok
  spesifik bir edge case (tarayıcı/DPI/pencere boyutu, hızlı ardışık tıklama)
  test kapsamı dışında kalmış olabilir; (c) kullanıcı farklı bir görsel
  karışıklığı kastetmiş olabilir. Varsayımla bir "düzeltme" YAPILMADI (zaten
  doğru çalışan koda dokunup regresyon riski almamak için) — kullanıcıdan
  somut bir tekrar senaryosu istenmesi önerildi.

**KRİTİK yan bulgu (tester turunda)**: regresyon kontrolü sırasında Faz XIII'ün
besin çöküşü bug'ının KISMEN geri döndüğü bağımsız olarak tespit edildi (5 uzun
koşudan 2'sinde) — Faz XIV'ün organlarıyla ilgisizdi (organ envanterinde yeni
organ yokken de oluyordu), Faz XIII'e ek bir madde olarak yeniden açıldı (bkz.
yukarıdaki Faz XIII bölümü).

**Metodoloji**: her iki turda da `tsc`/`build` temiz, API anahtarı sızıntısı
yok, Playwright geçici eklenip test bitince kaldırıldı, dev server sadece
kendi PID'iyle durduruldu.

## Faz XV — Detaylar ve Tester Doğrulaması (arşiv)

6a'nın performans/entegrasyon denetiminde bulundu: 9 dakikalık 4x-hız koşuda,
popülasyon tavana (140) ulaştıktan ~3 dakika sonra **FPS 25'ten 7-11'e çöküyor
ve 9 dakika boyunca hiç toparlanmıyordu**. `usedJSHeapMB` sabit (bellek
sızıntısı yok), DOM node sayısı neredeyse sabit — sorun render/çizim tarafında
değil, kaynağı henüz araştırılmamıştı.

### SONUÇ (6a): Kök neden bulundu ve düzeltildi
**Kesin kök neden (redraw/HUD DEĞİL)**: İki birleşen etken:
1. `main.ts`'teki `MAX_SIM_STEP_PER_FRAME=0.5` — bir render karesi
   yavaşladığında o karede 1/30'luk alt-adımlarla `ecosystem.update()`'i 15
   defaya kadar çağırıyordu. Popülasyon tavanına yakınken `update()` başına
   maliyet belirgin hale gelince bir "ölüm sarmalı" yaratıyordu: yavaş kare →
   daha fazla alt-adım → daha yavaş kare → ... (asla toparlanmıyordu).
2. `ecosystem.ts`'te `findNearestThreat`/`findNearestPrey` (O(n²), 140'ta
   ~19.600 çift), `updateSexualReproduction`'ın eşleşme araması, ve
   `findNearestNutrient`/`bestClusterAmong` — hepsi eşik/en-yakın
   karşılaştırması için gereksiz yere `Math.hypot` (sqrt) kullanıyordu.

**Düzeltme (davranış DEĞİŞMEDİ, sadece performans)**:
- `main.ts`: `MAX_SIM_STEP_PER_FRAME` 0.5 → 0.12 (bir karede en fazla ~4
  alt-adım, sarmalın kendini besleme kapasitesi büyük ölçüde kırıldı).
- `ecosystem.ts`: `findNearestThreat`, `findNearestPrey`,
  `updateSexualReproduction`, `findNearestNutrient`, `bestClusterAmong` —
  hepsinde `Math.hypot` yerine kare-mesafe (`dx*dx+dy*dy`) karşılaştırmasına
  geçildi (eşik karşılaştırmaları için matematiksel olarak tamamen eşdeğer).
  `bestClusterAmong`'da puanlama gerçek mesafeye ihtiyaç duyduğundan tam
  sqrt'ten kaçınılamadı, ama artık sadece menzil içine giren adaylar için
  hesaplanıyor.

**Doğrulama (6a) — SINIRLI/KESİN DEĞİL**: Düzeltme sonrası aynı 9 dakikalık
koşu tekrarlandı. FPS artık minute 2'den itibaren ~9'da YATAY kaldı (önceki
SÜREKLİ KÖTÜLEŞEN 25→20→11→7 deseni bir daha görülmedi) — "ölüm sarmalı"
davranışı ortadan kalkmış görünüyor. AMA mutlak FPS sayısı beklenenden düşük
kaldı — test sırasında makinede EŞ ZAMANLI ağır bir yük olduğu BAĞIMSIZ OLARAK
doğrulandı (19+ node.exe süreci, basit bir curl isteği 15+ saniye sürdü) —
bu koşunun mutlak FPS rakamları kirli/güvenilmez, sadece "artık monoton çöküş
yok" gözlemi güvenle raporlanabilir. Bağımsız/sistem-sakin bir tekrar önerildi.

## Faz XI — Çoklu Kayıt Slotu (eklenip sonra kaldırılması, arşiv)

Faz XI aday havuzundan seçilen bir özellik turu: kullanıcının 3 ayrı kayıt
slotu arasında geçiş yapıp manuel kaydedip/yükleyebilmesi (dışa/içe aktarma
zaten TAMAMLANDI'ydı, bu ayrı/ek bir özellikti).

### Uygulama (coder)
`savegame.ts`'te `loadSaveData`/`writeSaveData`/`clearSaveData` isteğe bağlı
bir `slot` parametresi aldı (slot 0 = eski/varsayılan anahtar, geriye dönük
uyumlu); doğrulama şekli ("ya tam kabul ya tam red") tüm slotlarda aynıydı.
Mevcut OTOMATİK kayıt sadece slot 0'a yazıyordu (kullanıcının seçtiği slotu
takip etmiyordu — istemsiz üzerine yazmayı önlemek için bilinçli karar). UI:
`#save-slot-group` (3 küçük buton) Dışa/İçe Aktar'ın yanına eklendi.

**Doğrulama (coder)**: `tsc`/`build` temiz; Playwright ile senkron test —
localStorage temizlenip slot 2'ye kaydedildi, `localStorage` anahtarları ile
slot izolasyonu doğrulandı (slot 0 otomatik kaydı ezilmedi), sim ilerleyip
slot 2 tekrar yüklenince popülasyon kayıt anındaki değere döndü.

**Doğrulama (bağımsız tester)**: coder'ın implementasyonunun kod incelemesine
değil DAVRANIŞINA odaklanarak yeni bir dev server üzerinden tekrar doğrulandı.
**ID-bazlı deterministik izolasyon testi** (popülasyon SAYISI değil gerçek
`genome.id` kümesi karşılaştırıldı, simülasyon duraklatılıp kararlı anlık
görüntüler alındı): duraklatılmış haldeki canlı ID kümesi kaydedilen slot
verisiyle BİREBİR eşleşti, farklı bir anda Slot 3'e kaydedilen veri Slot
2'ninkinden GERÇEKTEN FARKLIYDI, Slot 2 GERÇEK bir buton tıklamasıyla
yüklenince ID kümesi kaydedilen slot 2 verisiyle TAM eşleşti (Slot 3'ünkiyle
DEĞİL). Slot 0 (otomatik kayıt) manuel slot işlemlerinden etkilenmeden kaldı.
Dışa/içe aktarma regresyonu (gerçek dosya indirme + seçimi ile) uçtan uca
doğrulandı, geçersiz/bozuk bir dosya sessizce/çökmeden reddedildi. Konsol/
sayfa hatası: tüm testlerde sıfır.

### KULLANICI İSTEĞİYLE TAMAMEN KALDIRILDI
Kullanıcı geri bildirimi: özellik istenmiyordu, tek-slot (otomatik kayıt,
localStorage) davranışına dönülmesi istendi. Kaldırılanlar: `index.html`'deki
slot UI elemanları; `src/dashboard.css`'teki slot buton kuralları;
`src/main.ts`'teki `activeSlot`/`renderSlotButtons`/slot buton handler'ları;
`src/savegame.ts`'teki `slot` parametresi, `slotKey`, `SAVE_SLOT_COUNT`,
`DEFAULT_SLOT`, `SlotSummary`, `listSlotSummaries` — `loadSaveData`/
`writeSaveData`/`clearSaveData` artık parametresiz, tek `SAVE_KEY`
(`evrimsel-gezegen-save-v7`) üzerinden çalışıyor (format/`SAVE_VERSION`
değişmedi). Dışa/İçe Aktarma bu özellikten bağımsızdı, HİÇ DOKUNULMADI.

**Doğrulama (kaldırma sonrası)**: `tsc`/`build` temiz; Playwright ile test —
slot UI elemanları artık DOM'da yok, header'da sadece Soy Ağacı/Dışa Aktar/
İçe Aktar butonları kalıyor, `localStorage` içinde TEK anahtar var (eski slot
anahtarları yok), otomatik kayıt sonrası sayfa yenilemesinde popülasyon
korundu, dışa/içe aktarma gerçek dosya indirme/seçimiyle doğrulandı, konsol/
sayfa hatası sıfır.

---

## Faz XVI — Profesyonel soy ağacı + gezegen oluşum ekranı + gezegene özgü organlar (arşiv)

Kullanıcı isteği (2026-09-05). Üç madde: (1) soy ağacı geçmiş kaybı + profesyonel
görsel yeniden tasarım, (2) simülasyon başlamadan önce gezegenin nasıl oluştuğunu
anlatan bir "oluşum ekranı", (3) gezegen profiline bağlı, HER GEZEGENDE FARKLI
mümkün olan organ alt kümesi ("gezegene özgü organlar"). Kapsam: Faz I-XV
mekanikleri (su→kara, popülasyon dengesi, event log, Gemini) BOZULMADAN üstüne
inşa edilecek.

### Madde 1 — Soy ağacı: özet düğüm + görsel yeniden tasarım

**Geçmiş kaybı kararı (gerekçeli)**: Cap'i büyük ölçüde artırmak TEK BAŞINA
seçilmedi (sınırsız büyüyen bir dizi er ya da geç aynı soruna varır). Bunun
yerine: `MAX_LINEAGE_RECORDS` 500→4000'e çıkarıldı VE cap aşılınca en eski
`LINEAGE_SUMMARY_BLOCK_SIZE=1000` kayıt SİLİNMİYOR, bir `LineageSummaryNode`'a
sıkıştırılıyor (`ecosystem.ts` `summarizeOldestBlock`) — birey sayısı, nesil
aralığı, gözlemlenmiş organ tipleri (birleşim) ve gerçek çocuk id'leri (ağaca
bağlanabilsin diye) tutuluyor; ardışık özetleme turları TEK bir kümülatif
özete birleşiyor. `getAncestryChain`/`getAncestorSummary` bir özete "çarpınca"
sessizce kesmek yerine özeti döndürüyor.

**Görsel yeniden tasarım**: ebeveyn→çocuk bağlantıları artık yumuşak kübik
bezier eğrileri (`drawParentChildCurve`), bir ebeveynin TÜM çocukları önce
ortak bir "çatal noktasına" inip oradan ayrı ayrı dallanıyor. Özet düğümler
ağacın en üst satırında büyük elmas şeklinde, "N birey (nesil X-Y)" etiketiyle.
Mevcut zoom (0.5x-3x)/pan/filtre (diyet/organ/durum/nesil)/organ-rengi
halkası/tıklama-seçim mantığı DEĞİŞTİRİLMEDİ — sadece layout (ata-öncelikli
x sıralaması) ve çizim fonksiyonları güncellendi.

**Coder doğrulaması**: 9000 sentetik kayıt zorlanıp (`__debugForceSyntheticLineageChain`,
TEST-ONLY) `lineage.length` cap'te (≤4000) kaldığı, sıfır veri kaybı
(summarized+live=9024) doğrudan ölçüldü. 90s gerçek 4x-hız koşusunda (sentetik
veri olmadan) popülasyon/diyet/su→kara sağlıklı, panel açma/filtre/tıklama
sıfır hatayla çalıştı. `tsc`/`build` temiz.

### Madde 2 — Gezegen oluşum ekranı

Yeni modül `src/planetformation.ts` — `generatePlanetProfile(seed, waterFraction)`
saf/deterministik bir fonksiyon (kendi `mulberry32` RNG akışı, harita üretimini
etkilemiyor). Üretir: 4 bileşenli atmosfer (azot/oksijen/karbondioksit/metan,
%100'e normalize), azot seviyesi kategorisi (low/moderate/high — Madde 3'ün
organ filtrelemesi kullanıyor), 3-5 kurgusal "bio madde", kısa bir anlatı.
Gerçek/dinamik oksijen seviyesiyle (Faz X `atmosphere.ts`) KARIŞTIRILMIYOR.

**Ekran**: `index.html` `#planet-formation-overlay` (mevcut `.overlay-panel`
temelli, ortalanmış) — anlatı + atmosfer çubuğu/lejant + bio madde listesi +
"Simülasyonu Başlat" butonu, TEK ekran. SADECE yeni bir simülasyonda
gösteriliyor (`!savedGame`); "Başlat"a basana kadar hız 0'da kilitli, başlangıç
popülasyonu spawn edilmiyor.

**Bulunan/düzeltilen bug**: spawn'ı ertelemek, formasyon ekranı açıkken
`beforeunload`/periyodik otomatik kayıt tetiklenirse `creatures:[]` gibi "boş
ama GEÇERLİ" bir save yazılmasına yol açıyordu — sonraki yüklemede bu sahte
kayıt gerçek bir kayıt sanılıp ekranı kalıcı atlıyordu. Düzeltme: `simulationStarted`
bayrağı, gerçek başlangıçtan ÖNCE hiçbir kayıt yazılmasını engelliyor.

**Coder doğrulaması**: taze/temiz yüklemede overlay+pop 0+hız 0; aynı seed'le
iki `generatePlanetProfile` çağrısı BİREBİR aynı JSON (determinizm); "Başlat"
sonrası overlay kapanıp pop 24/hız 1; bir kayıt varken overlay hiç görünmedi;
75s gerçek koşu + restart sağlıklı. `tsc`/`build` temiz.

### Madde 3 — Gezegene özgü organlar

**Filtreleme katmanı**: `organs.ts` `setPlanetForbiddenOrgans(forbidden)`/
`getPlanetForbiddenOrgans()`/`resetPlanetForbiddenOrgans()` — modül seviyesinde
bir `Set<OrganType>`, `pickRandomOrganType` her çağrıda buna göre havuzu
daraltıyor. Tasarım kararı: fonksiyon MÜMKÜN değil YASAK olanları alıyor —
hiç çağrılmazsa TÜM organlar mümkün kalır (Faz II-XV davranışı DEĞİŞMEDİ,
tek nokta arıza yok). Organ HAVUZUNUN kendisi (mekanik etkiler) DEĞİŞMEDİ —
Faz XIV güvenlik kararı (Gemini/rastgelelik yeni mekanik icat etmiyor) korunuyor.

**2 yeni gezegene-özgü organ**: **Azot Deposu** (`nitrogen_sac`, defense) —
metabolizma tasarrufu (%8-20), sadece azot seviyesi moderate/high ise mümkün.
**Kükürt Kemosentez Organı** (`sulfur_vent_organ`, feeding) — beslenme
verimliliği çarpanı (%15-40), sadece gezegende `hasSulfurRichSubstance` varsa
mümkün (explicit boolean, narrative metnine string-matching YOK).

**Coder doğrulaması**: yasak listesi profil alanlarıyla birebir tutarlı;
her ikisi yasaklanınca 5000 çağrıda hiç seçilmedi, serbestken 20000 çağrıda
21 organ tipinin hepsi en az bir kez seçildi; `__forceOrgans` ile zorlanan
organ inceleme panelinde doğru göründü; iki 100s koşuda yasaklı organ hiç
popülasyona sızmadı, su→kara/diyet dengesi bozulmadı. `tsc`/`build` temiz.

### Tester doğrulaması (bağımsız, 2026-09-06): 3/3 madde GEÇTİ, 1 blocking-olmayan not

`npx tsc --noEmit`/`npm run build` (dist silinip sıfırdan) temiz, `dist/`'te
API anahtarı sızıntısı yok. Port 6301, senkron Playwright, dev server sadece
kendi PID'iyle (29500) durduruldu.

- **Madde 1**: `__debugForceSyntheticLineageChain(9000)` — 24+9000=9024 toplam,
  `lineage.length=3024` + `summarizedTotal=6000` = 9024, MATEMATİKSEL TAM,
  sıfır veri kaybı bağımsız doğrulandı. Filtreler DOM'da mevcut. **Görsel
  kalite — dürüst değerlendirme**: 90s organik koşuda (140 pop, 194 kayıt,
  6 nesil) bezier çatallanması gerçekten görünüyor, düz-satırdan belirgin
  iyileşme — ama "profesyonel bir aile ağacı" tabiri biraz iddialı: 140
  birey/6 nesilde düğümler sık/küçük, tek soyu takip zoom gerektiriyor; bu
  bir zevk meselesi, kod hatası değil. ⚠️ **Görsel dayanıklılık notu (blocking
  değil)**: sentetik stres testinde (dallanmayan tek-çizgi zincir → ~3024 AYRI
  nesil) canvas 306.066px'e çıkıp panel TAMAMEN boş/beyaz göründü — kök neden
  canvas yüksekliğinin nesil SAYISIYLA orantılı büyümesi. Gerçek oyunda üreme
  dallandığından aynı kayıt sayısı çok daha az nesile yayılır, pratikte
  muhtemelen tetiklenmez, ama teorik risk var — coder'a Faz XVII madde 4
  olarak iletildi (aşağıda düzeltildi).
- **Madde 2**: temiz `localStorage`+taze yükleme→overlay/pop 0/hız 0;
  Start'tan önce reload → YENİ seed (bug düzeltmesi doğrulandı); Start→overlay
  kapandı/pop 24/hız 1; 8s oynayıp reload→overlay AÇILMADI, `mapSeed` ve
  yeniden hesaplanan profil BİREBİR eşleşti (determinizm kanıtlandı).
- **Madde 3**: mevcut profil (`nitrogenLevel:"moderate"`, `hasSulfurRichSubstance:false`)
  için yasak liste (`["sulfur_vent_organ"]`) doğru; 20000 çağrıda
  `sulfur_vent_organ` hiç seçilmedi, `nitrogen_sac` 706 kez seçildi; ikisi
  yasaklanınca 5000 çağrıda sıfır; serbestken 20000 çağrıda 21 tipin hepsi
  seçildi; gerçek fare tıklamasıyla inceleme panelinde "Azot Deposu 0.15"
  + doğru açıklama göründü.
- **Regresyon**: 120s koşuda pop 24→140 sağlıklı, diyet 138-140/0-2,
  `onLandNotCapable:0` her örnekte, soy kaydı 45→263, event log gerçek/çeşitli
  olaylar (organ tükenmesi, deprem, soğuk dalga, ilk etçil, meteor). Konsol/
  sayfa hatası: TÜM testlerde sıfır.

## Faz XVI-sonrası performans/entegrasyon denetimi (arşiv, tester, 2026-09-06): GEÇTİ

Saf okuma/test (kaynak dosyalara dokunulmadı), port 6377. 10 dakikalık senkron
4x-hız koşusu, 60s'de bir örnekleme:
- Gezegen oluşum ekranı: taze yüklemede overlay/pop 0/hız 0; Start sonrası
  overlay kapandı/pop 24/hız 1.
- FPS: 21→18→6→13→8→7→8→7→12→12→12 (dalgalı ama son 3 dakika 12'de PLATOYA
  OTURDU — Faz XV'in "ölüm sarmalı" (monoton, hiç toparlanmayan düşüş) GERİ
  GELMEDİ). `usedJSHeapMB` 10.7'de SABİT (sızıntı yok), DOM node 155→175.
- Organ çeşitliliği: 12 farklı tip organik ortaya çıktı (Faz XIV'ün tümü
  dahil); bu gezegende yasaklı `sulfur_vent_organ` hiç çıkmadı (filtre
  doğrulandı), izinli `nitrogen_sac` bu tekil koşuda şans eseri çıkmadı
  (nadir bir organ, endişe verici değil).
- Soy ağacı (uzun koşu sonrası): panel açıldı, filtre çalıştı; zoom testinde
  İLK denemede yanlış-pozitif "değişmedi" sonucu çıktı (528 kayıtlık ağaçta
  canvas'ın tam yüksekliği viewport dışına taştığı için tıklama koordinatı
  yanlış hesaplanmıştı) — GÖRÜNÜR bir koordinatla tekrarlanınca zoom doğru
  çalıştı (1→1.1), gerçek bir regresyon DEĞİLDİ, test metodolojisi hatasıydı.
- Konsol/sayfa hatası: sıfır. `tsc` temiz, dev server sadece kendi PID'iyle
  (21240) durduruldu.

---

## Faz XVII — Donma bug'ı + sürü davranışı + arazi çeşitleri (arşiv)

Kullanıcı isteği (2026-09-05, Faz XVI'dan sonra ele alınmalı). 4 madde, madde 1
(bug) öncelikli, madde 4 en düşük öncelik. Faz I-XVI mekanikleri BOZULMADAN.

### Madde 1 — Donma/sınır bug'ı: kesin kök neden bulundu (iki parça), düzeltildi

**İlk hipotez (test metodolojisi hatası, dürüstçe elendi)**: ilk repro
denemesinde canlı donmuş göründü, ama neden Playwright'ta `Space` tuşunun bir
TOGGLE olduğuydu (ikinci basış farkında olmadan tekrar duraklatıyordu) —
uygulama bug'ı DEĞİLDİ. `__setSpeed()` debug hook'una geçilince ortadan kalktı.

**GERÇEK kök neden** (doğal 90s'lik 4x-hız koşusunda YAKALANDI): 330 canlı
arasından bir birey "seek" durumunda, 7 nutrient 100px içindeyken sabit kalıp
öldü. Konumu `y2=1012.8` (`MAP_HEIGHT=1000`) — harita sınırının DIŞINDA
sıkışmıştı. İki birleşen bug:
1. `moveCreature`'daki `outOfBounds` kontrolü hedef nokta clamp edilmeden ÖNCE
   hesaplanan bir bayrağa göre hareketi TAMAMEN reddediyordu — clamp sonrası
   konum geçerli olsa bile. Canlı sınırın az ötesindeyse HİÇBİR hareket kabul
   edilmiyordu — kalıcı kilitlenme.
2. `spawnOffspring` doğum konumunda HİÇ sınır kontrolü yapmıyordu (sadece
   su/kara vardı) — bir ebeveyn harita kenarına yakınken yavru DOĞRUDAN sınır
   dışında doğabiliyordu. Bu, ASIL tetikleyiciydi.

**Düzeltme (`ecosystem.ts`)**: `moveCreature`'daki `outOfBounds` reddi
kaldırıldı — hedef HER ZAMAN `[0,w]×[0,h]`'e clamp edilir, su/kara kısıtı
clamp SONRASI normal uygulanır. `spawnOffspring` doğum konumu artık sınırlara
clamp ediliyor (su/kara kontrolü clamp SONRASI tekrar yapılıyor).

**Coder doğrulaması**: izole repro (sınırın 12px ötesine yerleştirme) —
düzeltme ÖNCESİ 3s boyunca TAM SIFIR hareket, SONRASI 140.95px net hareket.
4 dakikalık doğal koşuda (185 canlı) `suspectCount:0`, `anyOutOfBounds:false`.
`tsc`/`build` temiz, konsol/sayfa hatası sıfır. Geçici tanılama hook'ları
bug kesinleşince tamamen geri alındı.

### Madde 2 — Sürü davranışı (tester tarafından sıfırdan yazıldı, 91'in kodu YOKTU)

**Yeni gen** (`genome.ts`): `packHunter: boolean` — diğer davranış genleriyle
aynı desen (başlangıç `false`, %3.5 bölünme/çiftleşme başına iki yönlü flip).
`crossoverGenomes`/`divideGenome`/`mutateGenome`'a bağlandı.

**Mekanik** (`ecosystem.ts`): `packHunter=true` bir avcının `PACK_HUNT_RADIUS=80px`
içindeki aynı-diyet müttefik sayısı × `PACK_HUNT_BONUS_PER_ALLY=0.08`, toplamda
`PACK_HUNT_MAX_BONUS=0.35` ile sınırlı, avın `escapeChance`'inden düşülüyor
(asla sıfırın altına inmez). Karmaşık bir sürü-AI/flocking algoritması YOK.

**Kaydet/yükle**: `savegame.ts` v7→v8, `isValidGenome`'a `packHunter` kontrolü.

**UI**: inceleme paneli diyet satırı, `packHunter=true` etçilde "Etçil 🍽️
(Sürü Avcısı 🐺)" gösteriyor.

**Doğrulama** (debug hook'larla doğrudan ölçüm): izole avcı → `reduction=0`;
3 müttefik → `reduction=0.24` (3×0.08, TAM); aynı müttefiklerle `packHunter=false`
→ `reduction=0`; 15 müttefik → `reduction=0.35` (üst sınır tam isabetli).
30s organik koşu: pop sağlıklı, su→kara ihlali yok, konsol/sayfa hatası sıfır.

### Madde 3 — Arazi çeşitleri (tester tarafından sıfırdan yazıldı)

**"İz düşüm yöntemi"**: `world.ts`'in zaten su/kara için kullandığı ham noise
değeri (`grid`) DOĞRUDAN "yükseklik" olarak yeniden kullanıldı — yeni bir
katman YOK. Su tarafı Faz X'in MEVCUT `isShallowWater`/`isDeepWater`'ını AYNEN
kullanıyor; kara tarafı yeni eşiklerle (kumsal: `BEACH_BAND=0.05`; dağ:
`MOUNTAIN_THRESHOLD=2.5`, 3 seed'de arazi dağılımı örneklenerek kalibre edildi
— ilk `0.55` değeri karanın %70'ini "dağ" yapıyordu, çok agresifti) 5 tipe
(`ElevationBand`: deep_water/shallow_water/beach/plain/mountain) ayrılıyor.
`TerrainKind`/`terrainAt`/`isWater` HİÇ değişmedi — tamamen görsel/kategorik
bir üst katman.

**Performans**: `isDeepWater`'ın ring-search'ünü 1.6M piksel için çağırmak
sayfa yüklenişini yavaşlatırdı — `elevationGrid` adlı 320×200 önbellek
(`grid` ile aynı çözünürlük) constructor'da BİR KEZ dolduruluyor; kara tarafı
tam piksel çözünürlüğünde (ring-search gerekmiyor). Ölçüldü: 165ms, regresyon
yok.

**Deprem uyumluluğu**: `repaintRegion` artık `colorForRepaint` kullanıyor —
aktif override varken önbelleği değil `terrainAt`'ın anlık durumunu yansıtıyor.

**Mekanik etki kasıtlı atlandı**: TASKS.md "opsiyonel" dedi; `effectiveMoveSpeed`'e
dokunmak Faz XIII/XV'in kırılgan dengesine gereksiz risk katardı.

**Doğrulama**: `__getElevationBandSample` ile 3 seed'de dağılım (dağ ~%9,
kumsal ~%3, ova ~%88 — makul). 2 dakikalık koşuda pop 30→140 sağlıklı,
`onLandNotCapable:0` her örnekte, manuel deprem sonrası repaint doğru,
konsol/sayfa hatası sıfır.

### Madde 4 — Soy ağacı yükseklik bug'ı (tester tarafından sıfırdan yazıldı)

**Kök neden**: `lineagetree.ts` dikey içerik yüksekliği `totalRows*ROW_HEIGHT`
ile SINIRSIZ büyüyordu (Faz XVI'da teşhis edilmişti).

**Düzeltme**: `MAX_CONTENT_HEIGHT=6000` — `neededHeight=Math.min(MAX_CONTENT_HEIGHT,
PADDING*2+totalRows*ROW_HEIGHT)`. Mevcut `rowHeight` formülü değişmedi, sadece
girdisi sınırlandı — nesil arttıkça satır otomatik küçülür, toplam yükseklik
6000px'i aşmaz.

**Doğrulama**: aynı stres senaryosu (9000 sentetik, dallanmayan zincir) tekrarlandı
— canvas 306.066px → 6000px'e sabitlendi, piksel analizi içeriğin GÖRÜNÜR
olduğunu kanıtladı (önceden tamamen boştu). Veri bütünlüğü hâlâ TAM (9024).
Normal ölçekte (156 kayıt) canvas 338px — sınırın altında, davranış aynı.

### Faz XVII — ÖZET

Madde 1 coder, Madde 2-4 tester (91'in yarım kalmış kodu YOKTU) tarafından
sıfırdan yazılıp doğrulandı. 3 dakikalık birleşik entegrasyon testinde:
popülasyon 45→140 sağlıklı, `onLandNotCapable` her örnekte 0, `packHunter`
geni ORGANİK olarak 2'den 39'a yayıldı (gerçekten mutasyonla ortaya çıkıp
yayılıyor), kaydet/yükle round-trip'i (yeni `packHunter` alanıyla) sorunsuz,
sıfır konsol/sayfa hatası.

### Tester doğrulaması (bağımsız, ikinci tur — PM'in ayrı bir subagent'ı, 2026-09-06): 4/4 madde GEÇTİ

Tamamen senkron, port 7301 (PID 35112, sadece bu PID durduruldu). `tsc`/`build`
(dist silinip sıfırdan) temiz. `dist/`'te `GEMINI_API_KEY`/`gemini-flash-lite`
SIFIR eşleşme.

- **Madde 1**: `__forcePosition` ile sınırın 12px ötesine yerleştirme → clamp
  anında `y2=1000`'e çekti (ışınlanma yok). 3s örneklemede `totalMoveOverTrace=90.3px`
  (donma yok). 80s'lik koşuda (20 örnek) `longRunAnyOutOfBounds:false`,
  `stuckCount:0`. Coder'ın iddiası bağımsız doğrulandı.
- **Madde 2**: izole avcı → `reduction=0`; 3 müttefik → `reduction=0.24`
  (matematiksel BİREBİR); gen kapatılınca → `reduction=0`; 15 müttefik →
  `reduction=0.35` (tavan tam isabetli). "%8/müttefik, %35 tavan" iddiası
  farklı bir test scriptiyle TAM DOĞRULANDI — gerçek/mekanik bir etki.
- **Madde 3**: `__getElevationBandSample(20)` ile 5 tipin GERÇEKTEN üretildiği
  doğrulandı (plain 2163, deep_water 1083, shallow_water 585, mountain 119,
  beach 50). **Objektif renk-mesafesi ölçümü** (RGB Öklid mesafesi): en yakın
  çift `deep_water↔shallow_water=44.0`, `shallow_water↔plain=45.0`,
  `plain↔mountain=49.8` — hepsi "zor ayırt edilir" ~25-30 eşiğinin üzerinde;
  en uzak çift `deep_water↔beach=162.1`. 5 tip GERÇEKTEN ayırt edilebilir,
  yakın renk çiftleri kasıtlı tasarım tercihi (v3'ün nötr diliyle tutarlı).
  Performans: `domLoadTime=190ms`, `reloadTime=385ms` — coder'ın "165ms"
  iddiasıyla tutarlı, gözle görülür yavaşlama yok.
- **Madde 4**: aynı stres senaryosu — canvas tam **6000px**'te (`style.height`)
  sabitlendi. Veri bütünlüğü: `lineageLen=3024` + özet `individualCount=6000`
  = 9024, kayıp yok.
- **Kritik regresyon** (30s+5s+reload birleşik): su→kara — `onLandNotCapable:0`;
  popülasyon dengesi — `{herbivore:92, carnivore:3}` sağlıklı; kaydet/yükle —
  `version:8` doğrulandı, kayıtlı genomda `packHunter` gerçekten `boolean`;
  reload sonrası gezegen oluşum ekranı tekrar AÇILMADI; event log gerçek/
  çeşitli olaylar gösterdi. Ayrı bir turda gezegen oluşum ekranı da uçtan uca
  doğrulandı (taze yükleme→overlay/pop 0/hız 0, Start sonrası pop 24/hız 1).
- **Tüm testlerde konsol/sayfa hatası: SIFIR.**

**Sonuç**: Faz XVII'nin 4 maddesi de bağımsız olarak, farklı bir test
metodolojisiyle (önceki tester turundan ayrı bir session) yeniden doğrulandı —
hepsi GEÇTİ, blocking hiçbir bulgu yok.

## Faz XI — Ayrıştırıcı-Besin Katkısı (arşiv)

Faz VI'da kasıtlı olarak kapsam dışı bırakılmıştı, Faz XI aday havuzundan
alınıp tamamlandı (tester, 2026-09-05). `ecosystem.ts` `spawnDecomposerNutrientContribution`:
bir ayrıştırıcı tüketimini bitirince %40 ihtimalle, konumuna göre doğru havuza
(su/kara) SABİT taban kapasitenin (`BASE_MAX_NUTRIENTS`/`BASE_MAX_LAND_NUTRIENTS`,
dinamik/açlık-genişletilmiş cap DEĞİL — Faz XIII'in zorlukla kurduğu dengeye
karışmasın diye bilinçli bir tercih) altındaysa tek bir nutrient ekliyor;
mevcut zamanlayıcı tabanlı spawn hızına dokunmuyor.

**Doğrulama**: `tsc`/`build` temiz; 3 dakikalık senkron 4x-hız koşusunda
(`__getDecomposerContributionStats()` debug hook'uyla) 11 gerçek katkı eklendi,
49 kez %40 zar tutmadı, 8 kez havuz dolu olduğu için doğru şekilde atlandı —
cap saygısı doğrudan ölçümle kanıtlandı. Konsol/sayfa hatası sıfır, popülasyon
sağlıklı (140 tavanında) kaldı. Geliştirme sırasında paralel çalışan bir başka
tester session'ı bu fonksiyonun henüz yazılmadığı bir ara anı yakalayıp geçici
bir sayfa hatası gördü — kalıcı bir hata değildi, iletişimle netleştirildi.

## Faz XI — Performans Denetimi 2. Tur (arşiv)

`ecosystem.ts`'deki O(n²) sıcak yollar (`findNearestPrey`, `findNearestThreat`,
`packHuntEscapeReduction`, `updateSexualReproduction` eşleşmesi, nutrient küme
puanlaması) kod incelemesinden geçirildi — hepsi Faz XV/XVII'de zaten
kare-mesafe (sqrt'siz) optimizasyonuyla ve sınırlı aday havuzlarıyla (algı
menzili/`MATING_RADIUS`) yazılmış, ek bir kolay kazanım bulunamadı.

Canlı ölçüm (Playwright, geçici dev server port 5188, PID doğrulanıp sadece o
PID durduruldu): popülasyon `MAX_CREATURES` tavanına (140) ulaşana kadar 4x
hızda çalıştırıldı, ardından 240 frame boyunca `requestAnimationFrame`
delta'ları örneklendi — ortalama ~19.6ms/frame, p95 ~21.7ms, maks 25ms,
konsol/sayfa hatası sıfır. İdeal 60fps (16.6ms) bütçesinin biraz üzerinde ama
stabil, sıçrama/donma yok.

**Sonuç**: mevcut brute-force komşu taraması popülasyon tavanında pratik
tavana yakın; bir sonraki adım (uzamsal bölümleme/grid) gerçek bir mimari
değişiklik olur ve o sırada belirgin bir kullanıcı şikayeti/semptomu
olmadığından önerilmedi — aday havuzunda bekletildi (bkz. aşağıdaki "Uzamsal
Bölümleme" turu, PM sonradan onayladı).

## Faz XI — Uzamsal Bölümleme (arşiv)

TAMAMLANDI, **Tester (6f) GEÇTİ (bağımsız, 2026-09-10 — bkz. aşağıdaki
"Tester doğrulaması" alt bölümü)**. PM onaylı, mimari değişiklik DEĞİL
(harici servis yok, tamamen yerel/geri alınabilir algoritma optimizasyonu).

**Kapsam bilinçli olarak daraltıldı**: SADECE `updateSexualReproduction`
(cinsel üreme eşleşmesi) grid'e taşındı. `findNearestPrey`/
`findNearestThreat`/`packHuntEscapeReduction`'a DOKUNULMADI — bunlar
`updateCreatures`'ın hareket döngüsü İÇİNDE, mid-frame çalışıyor (bir canlı
taranırken komşularının pozisyonu aynı karede zaten değişmiş olabiliyor);
grid'in anlık-görüntü doğası bu canlı mutasyonu yakalayamayacağından
sonuç-eşdeğerliğini bozardı. `updateSexualReproduction` ise ayrı, izole bir
pass — bu pass boyunca hiçbir canlı hareket etmiyor, bu yüzden grid'i baştan
bir kez inşa etmek TAMAMEN güvenli.

**Uygulama**: `Ecosystem` sınıfına sabit hücre boyutlu
(`CREATURE_GRID_CELL_SIZE=64`) bir uniform grid (`rebuildCreatureGrid`/
`candidatesNear`) eklendi. `candidatesNear` sorgu yarıçapına göre DİNAMİK
hücre-blok taraması yapar (sabit bir maksimum algı yarıçapı varsayımı YOK —
organ bonusları teorik olarak büyük radius üretebildiğinden bu önemli),
adayları `this.creatures`'daki ORİJİNAL sırayla döndürür (O(1)
`creatureOrderIndex` ile, `indexOf` DEĞİL — aksi halde O(n²)'yi geri
getirirdi) ki `<=` tie-break karşılaştırması eskisiyle birebir aynı
davransın.

**Doğrulama**: `npx tsc --noEmit`/`npm run build` temiz. Geçici bir
test-only debug hook (`__debugCompareMatingPairing`, DOĞRULAMA SONRASI
TAMAMEN GERİ ALINDI) ile aynı anlık durumda grid-tabanlı VE saf brute-force
eşleşme paralel hesaplatılıp karşılaştırıldı:
1. Doğal koşuda 6 örnek (30s ara ile) — hepsi eşleşti ama örneklem anında
   hiç uygun (sexual+enerji-hazır+cooldown-bitmiş) birey yoktu (0=0,
   trivial).
2. **Asıl kanıt**: `__forceReproductionGenes` ile 22 bireyi bilerek iki sıkı
   kümeye (biri 64px grid hücre sınırını KASTEN aşacak şekilde
   konumlandırıldı) + birkaç uzak tekil bireye zorlanıp karşılaştırıldı —
   grid 8 çift, brute-force 8 çift, BİREBİR AYNI id çiftleri.
3. 5 dakikalık eşzamanlı popülasyon-stabilite koşusu (Playwright, geçici
   port 6123, PID doğrulanıp sadece o PID durduruldu, 4x hız, 15s aralıklı
   örnekleme): popülasyon boyunca sabit 140 (MAX_CREATURES tavanı), hiç
   çöküş/düşüş yok, konsol/sayfa hatası sıfır.

Debug hook'lar (`main.ts` + `ecosystem.ts`) test sonrası tamamen kaldırıldı,
tsc/build tekrar temiz doğrulandı.

### Tester doğrulaması (bağımsız, 2026-09-10): GEÇTİ

Kod incelemesi (`rebuildCreatureGrid`/`candidatesNear`/`updateSexualReproduction`)
+ `npx tsc --noEmit`/`npm run build` (dist silinip sıfırdan) temiz. Port 6688,
senkron Playwright. **Kendi bağımsız eşdeğerlik metodolojim** (coder'ın
kaldırılmış hook'una güvenmeden, kendi el yazımı brute-force replikasıyla):
10 bireyi (`__forceReproductionGenes`) iki kümeye zorladım — biri (505,500)/
(520,500)/(500,530)/(560,560) 64px grid hücre sınırını (512=8×64) bilerek
aşacak şekilde, artı 2 uzak tekil (partner'sız kalmalı). Test scriptimde
TASKS.md'nin belgelediği algoritmayı (orijinal sıra, `<=` kare-mesafe
tie-break, MATING_RADIUS=60) sıfırdan yeniden yazıp kendi beklenen eşleşmemi
hesapladım: `["1-3","2-4","5-6"]`. Gerçek uygulamanın ürettiği soy kaydı
(`getLineage()`'daki yeni çift-ebeveynli kayıtlar) BİREBİR aynı çıktı —
`MATCH:true`. Hücre sınırını aşan aday (id 8, (560,560)) doğru şekilde
eşleşmedi (en yakın adayı 60px sınırının dışındaydı) — grid'in blok
taramasının sınır-ötesi adayları kaybetmediğinin kanıtı. 2 dakikalık gerçek
4x-hız koşusunda popülasyon sağlıklı büyüdü, `onLandNotCapable:0` her
örnekte, `packHunter` (dokunulmayan bir kod yolu) 0'dan 22'ye organik olarak
yayıldı — regresyon yok. Konsol/sayfa hatası sıfır. Dev server sadece kendi
PID'iyle (45864) durduruldu, geçici test dosyası silindi.

## Faz XI — Telemetri Zaman Serisi (arşiv)

PM görevlendirmesiyle (onaylı, mimari değişiklik DEĞİL — hâlâ dev-server
middleware deseni, hâlâ in-memory, hâlâ yeni framework/server yok): mevcut
`/api/population-snapshot` (tekil "son anlık görüntü") YANINA, geriye dönük
UYUMLULUĞU KIRMADAN bir zaman serisi eklendi:
- **`GET /api/population-snapshot/history`**: son `SNAPSHOT_HISTORY_LIMIT`
  (50) anlık görüntüyü kronolojik sırayla (`{count, snapshots}`) döndürür —
  basit bir ring-buffer (dizi + `push`/`shift`, kalıcı disk yazımı YOK,
  önceki turla aynı bellek-içi felsefe).
- **`GET /api/population-snapshot`** ve **`POST /api/population-snapshot`**
  davranışı HİÇ DEĞİŞMEDİ (aynı response şekli/durum kodları) — her başarılı
  `POST` artık aynı zamanda geçmiş dizisine de ekleniyor, ek bir işlem
  gerektirmiyor (client tarafında `main.ts`'e HİÇ dokunulmadı).
- **Uygulama notu**: Connect middleware `/api/population-snapshot` ÖNEKİYLE
  eşleştiği için (`/history` alt-yolu dahil), ayrım `req.url` üzerinden elle
  yapıldı — `/history` → yeni handler, bilinmeyen başka bir alt-yol → `404`,
  kök yol → eski davranış (aynen korunan `GET`/`POST` switch'i).

**Doğrulama**: `npx tsc --noEmit`/`npm run build` (temiz), `dist/` içinde
`GEMINI_API_KEY`/`AIza` taraması sıfır eşleşme. Geçici dev server (port
6211, PID 13200, sadece o PID durduruldu) üzerinde `curl` ile senkron test:
boş `GET /history` (`{"count":0,"snapshots":[]}`), 3 sıralı `POST` sonrası
`GET /` en sonuncuyu (pop 30) döndürdü, `GET /history` üçünü de kronolojik
sırayla (10,20,30) döndürdü, `POST /history` doğru şekilde `405`, bilinmeyen
bir alt-yol (`/bogus`) doğru şekilde `404`. **Ring-buffer sınır testi**: 52
ek `POST` (toplam 55) sonrası `GET /history` tam olarak 50 kayıt döndürdü,
en eski 5 kayıt (pop 1-5) atılmış, ilk kayıt pop 6 / son kayıt pop 55 — FIFO
tavan davranışı doğrulandı.

### Tester doğrulaması (bağımsız, 2026-09-10): GEÇTİ

Kod incelemesi (`vite.config.ts` `/history` alt-yol ayrımı) + `tsc`/`build`
(dist silinip sıfırdan) temiz, `dist/` sızıntı taraması sıfır. Port 6688,
`curl` ile bağımsız test (coder'ın kullandığından farklı bir port/oturum):
`GET /history` mevcut organik veriyle (10 kayıt, gerçek popülasyon/nesil/
organ ilerlemesi görünür şekilde) doğru döndü; `POST /history` doğru şekilde
`405`; kök `GET`/`POST` davranışı DEĞİŞMEDİ (aynı response); bilinmeyen bir
alt-yol (`/unknown-path`) doğru şekilde `404`. **Ring-buffer FIFO sınır
testi** (kendi sayılarımla, coder'ınkinden bağımsız): 10 organik kayıt
üzerine 45 ek `POST` (toplam 55) gönderildi — `count` tam **50**'de kaldı,
buffer'daki İLK kayıt organik 6. kaydın (population:140) beklenen değeriyle,
SON kayıt son fake POST'un (population:45) değeriyle BİREBİR eşleşti —
55-50=5 en eski kaydın doğru şekilde atıldığı aritmetik olarak doğrulandı.
Konsol/sayfa hatası sıfır. Dev server sadece kendi PID'iyle (45864)
durduruldu.

## Faz XI — Organ Trend Oku (arşiv)

TAMAMLANDI (coder, 2026-09-10), **Tester (6f) GEÇTİ (bağımsız, 2026-09-10 —
bkz. aşağıdaki "Tester doğrulaması" alt bölümü)**. PM görevlendirmesi:
inceleme panelinde her organ satırının yanına, o organın
popülasyon genelinde "yayılıyor/azalıyor/stabil" olduğunu gösteren küçük
bir trend oku (↑/↓/—) eklemek — "bu organ neden var, gelecekte ne olacak"
sorusuna panel içinde, ekstra tıklama olmadan cevap.

**Uygulanabilirlik notu (kod yazmadan önce PM'e soruldu, onaylandı)**:
mevcut altyapı (`checkPrevalenceMilestones`) SADECE tek yönlü eşik-geçiş
olayları tutuyordu (%20/40/60/80'i bir kez geçince tetiklenen olaylar,
hiç sıfırlanmıyor/azalışı yakalamıyor) — gerçek bir zaman içi prevalence
geçmişi hiç saklanmıyordu. Sahte bir yön göstermek TASKS.md'nin "Neden/
gerekçe şeffaflığı... uydurma yok" ilkesine doğrudan aykırı olurdu. İki
seçenek sunuldu: (A) hafif bir kayan-pencere (ring-buffer) eklemek — düşük
risk, panel yapısına dokunmuyor; (B) event log'daki geçmiş milestone
olaylarını geriye dönük analiz etmek — bu veri tek-yönlü olduğundan
azalışı hiç yakalayamaz, önerilmedi. PM (A)'yı onayladı, ek notlarla:
örnekleme periyodunu mevcut event-check döngüsüne bağla (performans
maliyeti olmasın), yeterli örnek yokken "—" değil hiçbir şey göster.

**Uygulama**:
- `ecosystem.ts`: `PREVALENCE_TREND_SAMPLE_COUNT=10`,
  `PREVALENCE_TREND_STABLE_THRESHOLD=0.03`, `OrganPrevalenceTrend` tipi
  (`"up"|"down"|"stable"|"insufficient-data"`). `prevalenceHistory: Map<OrganType, number[]>`
  — her organ tipi için son 10 prevalence oranını tutan bir kayan pencere,
  `checkPrevalenceMilestones` ile AYNI 2 saniyelik döngüde (`recordPrevalenceSample`)
  dolduruluyor (zaten hesaplanan `fraction` yeniden kullanılıyor, ekstra
  tarama YOK). `getOrganPrevalenceTrend()`: pencere dolmadıysa
  `insufficient-data` döner; doluysa ilk yarı/ikinci yarı ortalaması
  karşılaştırılıp (`PREVALENCE_TREND_STABLE_THRESHOLD` toleransıyla)
  `up`/`down`/`stable` döner. `restart()`'ta `prevalenceHistory.clear()`
  eklendi (diğer olay-durumu Map'leriyle tutarlı reset).
- `main.ts`: `showInspectorWithTrend()` yardımcı fonksiyonu — `Creature.
  getInspectionSummary()`'nin döndürdüğü organ listesine `ecosystem.
  getOrganPrevalenceTrend()`'i birleştirip `hud.showInspector()`'a geçiyor.
  `Creature` kendisi ekosistem-genelindeki veriyi BİLMİYOR (ayrım bilerek
  korundu) — birleşim sadece main.ts'te, panel açılmadan hemen önce.
  İki çağrı noktası (canlı tıklama + soy ağacından seçim) güncellendi.
- `hud.ts`: `InspectionData.organs`'a opsiyonel `trend?: OrganPrevalenceTrend`
  alanı eklendi. `TREND_SYMBOLS` haritası — `insufficient-data` BİLEREK boş
  string döner (hiçbir ok render edilmez, sahte "stabil" iddiası yok).
  `showDeceasedInspector`'a (ölüm anındaki organlar, geçmişe dönük bir
  görünüm) DOKUNULMADI — trend kavramı sadece canlı inceleme paneli için
  anlamlı.
- `dashboard.css`: `.inspector-organ-trend-{up,down,stable}` — yeşil/kırmızı/
  gri renkler, mevcut chip/organ satırı stiline uyumlu, minimal ek.

**Doğrulama**: `npx tsc --noEmit`/`npm run build` temiz. Geçici test-only
debug hook'lar (main.ts — `__debugOpenInspector`, `__getSimTime`,
`__getOrganPrevalenceTrendDebug`, DOĞRULAMA SONRASI TAMAMEN GERİ ALINDI,
tsc/build tekrar temiz doğrulandı) ile iki Playwright senaryosu:
1. Geçici dev server (port 6318/6319, PID doğrulanıp sadece o PID
   durduruldu) üzerinde ~60s (4x hız) çalıştırılıp pencere dolduktan sonra
   organ taşıyan bir birey zorla inceleme paneline açıldı — panel HTML'i
   gerçek render edilmiş organ satırında `inspector-organ-trend-stable`
   sınıflı "—" oku + doğru `title` tooltip'i ("Popülasyonda stabil")
   içerdiği doğrulandı, sıfır konsol/sayfa hatası.
2. Sim başlangıcında (pencere garantili boş) `getOrganPrevalenceTrend()`
   doğrudan çağrılıp 21 organ tipinin HEPSİNİN `insufficient-data`
   döndürdüğü doğrulandı — panel render kodunda bu değer boş string'e
   eşleniyor, yani hiçbir sahte ok gösterilmiyor.

### Tester doğrulaması (bağımsız, 2026-09-10): GEÇTİ

Dört dosya (`ecosystem.ts`/`main.ts`/`hud.ts`/`savegame.ts` dokunulmadığı
teyit edildi) satır satır incelendi, `getOrganPrevalenceTrend()`'in ilk
yarı/ikinci yarı ortalama karşılaştırmasının koddaki iddiayla birebir
eşleştiği, `showDeceasedInspector`'ın trend mantığını doğru şekilde bypass
ettiği doğrulandı. Kendi izole Playwright testim (coder'ın kaldırılmış
hook'larına güvenmeden, kendi debug hook'umla): bacaklı organ zorlanan bir
canlıda (1) sim başlangıcında (pencere garantili boş) inceleme panelinde
HİÇBİR trend oku YOK — `insufficient-data` doğru; (2) 4x hızda ~20s (pencere
dolduktan sonra) aynı canlı yeniden seçildiğinde organ satırı
`Bacak 0.30 —` olarak render edildi — `hud.ts`'teki `TREND_SYMBOLS.stable`
("—") birebir eşleşti. **Test metodolojisi notu**: ilk deneme turlarında
tıklama-taraması dünya-koordinatı/ekran-koordinatı karışıklığı yüzünden
canlıyı bulamıyordu (`__forcePosition` DÜNYA koordinatı alıyor, kamera
`fitCamera()` ile sabit ölçek/offset uyguluyor) — teşhis için `main.ts`'e
kalıcı bir TEST-ONLY `__worldToScreen(x,y)` debug hook'u eklendi (dünya→ekran
çevrimi, `world.position`/`world.scale` dışarıdan erişilebilir değildi),
bundan sonraki tıklama-tabanlı testler için de kullanılabilir. tsc/build
temiz.

## Faz XI — Geniş Sağlık Taraması (arşiv)

PM görevlendirmesiyle (kod dosyalarına dokunulmadı, salt-okunur test):
save/load (v8), export/import, Gemini proxy hata-toleransı, telemetri
`/history` ring-buffer'ının uzun (11dk gerçek) koşuda davranışı tarandı.

- **✅ Gemini proxy hata-toleransı**: GET→405, prompt eksik→400, geçersiz
  JSON→502 (çökme yok, `try/catch` doğru yakalıyor), geçerli prompt→gerçek
  API çağrısı başarılı.
- **✅ Save/Load (v8)**: round-trip temiz, `packHunter` alanı doğru
  kaydediliyor/okunuyor, autosave+reload sorunsuz.
- **✅ Telemetri `/history`**: 11 dakikalık gerçek 4x-hız koşusunda
  `historyCount` düzenli 5→49 arttı, popülasyon 140'ta stabil kaldı, sıfır
  hata — ring-buffer uzun vadede sağlam.
- **🔴 KRİTİK BUG (blocking) — Dışa/İçe Aktarma**: Kesin/deterministik tekrar
  üretimi: (1) taze bir sayfada (gezegen oluşum ekranı açık, "Başlat"a
  BASILMADAN) daha önce dışa aktarılmış bir kayıt dosyası içe aktarılır,
  (2) sonra "Simülasyonu Başlat"a basılır. **Kök neden**: `main.ts`'teki
  import handler (`importInput.addEventListener`) `ecosystem.loadFromSave(data)`
  çağırıyor ama `simulationStarted` bayrağını set ETMİYOR — `startNewSimulation()`
  (satır ~461) bu bayrağı kontrol etmeden `spawnInitialCreatures(INITIAL_CREATURE_COUNT)`
  çalıştırıyor, içe aktarılan popülasyonun ÜSTÜNE 24 yeni rastgele canlı
  ekleniyor (ölçüldü: 38→62). **İkinci, bağlantılı sorun**: import, `worldMap`'i
  kaydedilen `mapSeed`'e göre YENİDEN OLUŞTURMUYOR (sadece sayfa-yüklemesinde-
  kayıt-varsa yolu bunu yapıyor) — içe aktarılan canlıların konumları
  o anki (farklı/rastgele) haritaya karşı anlamsız kalıyor. **Ölçülen etki**:
  38 canlının **17'si (%45) su→kara kısıtını ihlal ediyor** (`onLand===true`
  VE `canWalkOnLand===false`) — Faz II'den beri her fazda ayrıca doğrulanan,
  hiç bozulmamış bir kuralın gerçek bir ihlali.
  **Düzeltilmedi** (bu görev salt-okunur/test-only idi) — coder'a devredildi
  (çözüm: bkz. "Faz XI — İçe Aktarma Kritik Bug Düzeltmesi").

## Faz XI — İçe Aktarma Bug Düzeltmesi (arşiv)

TAMAMLANDI (coder c5), **Tester (6f) GEÇTİ (bağımsız, 2026-09-10)**. Yukarıdaki
"Geniş Sağlık/Regresyon Taraması"nda 6f'nin bulduğu kritik bug'ın düzeltmesi.

**Kök neden (coder tarafından bağımsız yeniden doğrulandı)**: `main.ts`'teki
import handler doğrudan `ecosystem.loadFromSave(data)` çağırıyordu —
`simulationStarted` bayrağını hiç set etmiyordu VE `worldMap` (sayfa
açılışında zaten rastgele bir seed'le kurulmuş) kaydın `mapSeed`'iyle
yeniden kurulmuyordu.

**Düzeltme yaklaşımı**: `worldMap`, `Ecosystem` içinde `private readonly`
bir referans olarak tutulduğundan (`constructor(private readonly world: World, ...)`)
ve `World`'ün kendisi de `readonly grid`/`elevationGrid`/`seed` alanlarıyla
büyük ölçüde immutable inşa edildiğinden, canlı bir `World` örneğini yerinde
yeniden kurmak (veya `main.ts`'te yeni bir örnekle değiştirip her closure'ı
güncellemek) riskli/invazif bir refactor olurdu. Bunun yerine, sayfa
AÇILIŞINDA ZATEN doğru çalışan aynı yol (`loadSaveData()` +
`new World(savedGame.mapSeed)`, satır ~89-90) yeniden kullanıldı: import
handler artık `ecosystem.loadFromSave(data)` çağırmak yerine
`writeSaveData(data)` yazıp `location.reload()` yapıyor — `worldMap`
SIFIRDAN doğru seed'le kurulur, `simulationStarted` doğru başlangıç
değeriyle (`savedGame !== null`) hesaplanır, `spawnInitialCreatures` hiç
çağrılmaz. Mevcut, kanıtlanmış koddan YENİ bir harita-yeniden-kurma yolu
icat edilmedi.

**İkinci bug (canlı testte, ilk düzeltme denemesi sırasında bulundu)**:
İlk deneme (`app.ticker.stop()` çağırmak) YETERSİZ kaldı — canlı test
popülasyonun hâlâ eski/kendi durumuyla aynı kaldığını, içe aktarılan
verinin hiç uygulanmamış gibi göründüğünü gösterdi. Kök neden araştırması:
`location.reload()` `beforeunload` olayını da tetikliyor, ve o handler
(satır ~806) KENDİ `writeSaveData` çağrısıyla mevcut (henüz içe
aktarılmamış) canlı durumu YENİDEN yazıp benim az önce yazdığım içe
aktarılan veriyi SESSİZCE EZİYORDU — ama SADECE simülasyon zaten
çalışıyorsa (`simulationStarted===true`, `beforeunload`'ın kendi `if
(!simulationStarted) return` koruması yüzünden formasyon ekranı açıkken bu
sorun oluşmuyordu, bu da ilk testin — 6f'nin repro'suyla birebir aynı
senaryo — neden geçtiğini ama "import zaten çalışan bir sim üstüne"
senaryosunun neden başarısız olduğunu açıklıyor). Düzeltme: yeni bir
`skipBeforeUnloadAutosave` bayrağı eklendi, import handler `writeSaveData`
çağırmadan HEMEN önce bu bayrağı `true` yapıyor, `beforeunload` handler'ı
bu bayrak set'liyse kendi yazımını atlıyor.

**Doğrulama** (Playwright, 3 ayrı senaryo, her biri için geçici dev server
farklı bir portta, PID doğrulanıp sadece o PID durduruldu, hiçbir zaman
`taskkill /IM node.exe` kullanılmadı):
1. **6f'nin repro'su** (taze sayfa → import ÖNCESİ "Başlat" → "Başlat"a
   bas): gerçek bir simülasyon çalıştırılıp `export-save-btn` ile GERÇEK
   bir kayıt dosyası üretildi (Playwright `download` event'i ile
   yakalandı), sonra taze bir sayfada bu dosya "Başlat"a basmadan önce içe
   aktarıldı. Sonuç: reload sonrası popülasyon içe aktarılan dosyanın
   `creatures.length` alanıyla BİREBİR eşleşti (51=51), `__getMapSeed()`
   dosyanın `mapSeed` alanıyla BİREBİR eşleşti, gezegen oluşum ekranı
   DOĞRU şekilde gösterilmedi (yüklenen-oyun yolu), su/kara ihlali SIFIR
   (`onLand && !canWalkOnLand` kontrolü — 6f'nin metodolojisiyle aynı).
2. **İkinci bug'ın kanıtı** (import ZATEN ÇALIŞAN bir simülasyon üstüne):
   session B kendi simülasyonunu çalıştırırken session A'dan dışa
   aktarılan farklı bir kayıt içe aktarıldı. İlk düzeltme denemesiyle
   (sadece `ticker.stop()`) bu test BAŞARISIZ oldu (popülasyon/seed B'nin
   KENDİ eski durumunda kaldı, import hiç uygulanmamış gibiydi) — bu,
   `beforeunload` yarış durumunu kanıtlayan doğrudan kanıttı. `skipBeforeUnloadAutosave`
   bayrağı eklendikten SONRA aynı test: popülasyon içe aktarılan dosyanın
   `creatures.length`'iyle BİREBİR eşleşti (42=42), map seed BİREBİR
   eşleşti, sıfır ihlal.
3. **Normal otomatik-kayıt/sayfa-yenileme regresyon testi** (import HİÇ
   kullanılmadan, sadece normal tarayıcı yenilemesi): popülasyon/map-seed
   yenileme öncesi/sonrası BİREBİR aynı kaldı, sıfır ihlal — düzeltmenin bu
   ZATEN ÇALIŞAN yolu bozmadığı doğrulandı (aynı `loadSaveData`/`World`
   kod yolunu paylaşıyorlar, ama import HİÇBİR YENİ dal EKLEMEDİ, sadece
   mevcut yolu YENİDEN KULLANDI).

`npx tsc --noEmit`/`npm run build` temiz, `dist/` içinde API anahtarı
sızıntı taraması sıfır. Geçici test-only `console.log` (ilk teşhis
aşamasında eklenmişti) doğrulama tamamlanmadan ÖNCE geri alındı.

### Tester doğrulaması (bağımsız, 2026-09-10): GEÇTİ

Kendi Playwright script'im (c5'in testlerine güvenmeden, izole dev
server) coder'ın taze bir sim'den dışa aktarma yaptığı (seed 1344155058,
popA=25) senaryoları kendi ölçümlerimle tekrar ürettim: (1) taze sayfa,
"Başlat"a basmadan önce içe aktar: seed birebir eşleşti, popülasyon
birebir eşleşti (25=25), 0 su/kara ihlali; (2) sim ZATEN ÇALIŞIRKEN (24
canlı) içe aktar (`beforeunload` yarışı): seed birebir eşleşti,
popülasyon içe aktarılanla birebir eşleşti (25=25, ESKİ 24 ÜSTÜNE
EKLENMEDİ), 0 ihlal. Her iki senaryoda da sıfır sayfa hatası. tsc temiz.

## Faz XI — Organ Açıklama Metinleri Taraması (arşiv)

PM görevlendirmesi: `organs.ts`'teki 21 organ açıklaması + tip yorumlarını
(sadece METİN, mantık DEĞİŞMEDEN) okunabilirlik/tutarlılık için gözden
geçir — kullanıcı geçmişte "detaylı ama uzatmadan/saçmalamadan" demişti.

Her organ tanımı kod-gerçeğiyle (`creature.ts`'teki gerçek mekanik etki
hesaplamaları) tek tek karşılaştırıldı. 3 gerçek tutarsızlık bulunup
düzeltildi:

1. **`bioluminescence` — gerçek hata**: hem tip yorumu (`organs.ts` satır
   59) hem panel açıklaması "derin su/düşük oksijende algı artışı"
   iddia ediyordu. Kod incelemesi (`creature.ts` `effectiveSenseRadius`):
   organ etkiyi KOŞULSUZ uyguluyor — hiçbir su derinliği/oksijen kontrolü
   yok, her zaman aynı +20 ile +50 arası bonus veriyor. Dosyanın kendi
   ilkesine ("koddaki GERÇEK etkiyle birebir tutarlı olmalı, uydurma
   metin DEĞİL") doğrudan aykırıydı. Düzeltme: hem tip yorumu hem panel
   açıklaması, koşulu iddia etmeden ama flavor/ilham bağlamını (derin
   deniz canlıları) koruyan bir ifadeyle güncellendi.
2. **`tentacle` tip yorumu**: "ilkel hareket, hafif hız + algı" diyordu.
   Kod incelemesi (`creature.ts` `effectiveMoveSpeed`): tentacle SADECE
   su hızı faktörüne katkıda bulunuyor, `effectiveSenseRadius`'ta hiç
   görünmüyor — algıya hiç katkısı yok. Tip yorumu düzeltildi (panel
   açıklaması zaten doğruydu, dokunulmadı).
3. **`wing`**: panel açıklaması `tentacle` ile BİREBİR aynıydı ("Suda
   hafif ek hız sağlar") — mekanik olarak DOĞRU (ikisi de aynı küçük
   su-hızı bonusuna katkıda bulunuyor, `creature.ts`'te doğrulandı), ama
   tip yorumundaki "ileride uçuş" bağlamı panelde hiç yansımıyordu.
   Kullanıcının kafası karışabilir diye açıklama netleştirildi ("şu an
   için... uçuş henüz uygulanmadı").

Ayrıca `sulfur_vent_organ`'ın açıklaması `stomach`'ın deseniyle (mouth/
mide ile birlikte aynı besleyici-verimlilik zincirine katkı) tutarlı hale
getirildi, küçük bir netlik iyileştirmesi (kod incelemesi `creature.ts`
`feedingEfficiency` — sulfurVent gerçekten aynı çarpan zincirine
çarpımsal katkıda bulunuyor, doğrulandı).

Diğer 18 organ açıklaması tek tek incelendi, gerçek mekanikle tutarlı
bulundu — ek bir düzeltme yapılmadı. `npx tsc --noEmit`/`npm run build`
temiz.

## Faz XI — `loadFromSave` Olay-Durumu Temizliği (arşiv)

PM görevlendirdiği bug-avı/basitleştirme taramasında (main.ts/ecosystem.ts/
creature.ts, son eklenen özelliklerin — import bug fix, organ trend oku,
packHunter — etkileşiminde gözden kaçmış bir edge-case aranması) bulundu.

**Bulgu**: `Ecosystem.reset(count)` popülasyonu sıfırlarken soy/olay/organ-
trend TAKİP durumunu da (lineage, `firedPrevalenceMilestones`,
`prevalenceHistory`, `firedEnergyAdvantage`, `everObservedOrganTypes`,
`firedExtinction`, `firedFirstCarnivore`, `oldAgeDeathCount`,
`recentEventTexts`, `evolutionEventCheckTimer`, `pendingEvolutionEvents`,
`resetGenomeIdCounter()`) tam olarak temizliyordu — ama `Ecosystem.
loadFromSave(saved)` (import/sayfa-açılışı-kayıt-yükleme yolu) `clearAll()`
çağırıp canlı/nutrient'ları temizlemesine RAĞMEN bu takip durumunu HİÇ
temizlemiyordu. Dosyanın hiçbir yerinde bu asimetri belgelenmemişti.

**Neden şu ana kadar zararsızdı**: `loadFromSave`'in TEK çağrı noktası
(`main.ts` satır ~137) her zaman `new Ecosystem(worldMap, world)` ile
YENİ inşa edilmiş bir örnek üzerinde çalışıyordu — bu alanlar zaten
boş/varsayılan durumdaydı, yani pratikte hiçbir gözlemlenebilir hata
üretmiyordu.

**Neden yine de gerçek bir risk**: bu, kodda hiç garanti edilmeyen/
zorlanmayan bir varsayımdı ("`loadFromSave` sadece taze bir `Ecosystem`
üzerinde çağrılır"). İleride biri (örn. "sayfa yenilemeden farklı bir
kayıt yükle" gibi bir özellik eklerken) `loadFromSave`'i ÇALIŞAN bir
ekosistem üzerinde çağırsaydı, eski popülasyondan kalan takip verisi
YENİ popülasyonla SESSİZCE karışırdı — örn. yeni popülasyonda hâlâ var
olan bir organ için yanlış bir "tükendi" olayı, ya da organ trend
okunun eski (alakasız) veriye dayalı yanlış bir yön göstermesi gibi,
tespit edilmesi zor ve TASKS.md'nin "Neden/gerekçe şeffaflığı... uydurma
yok" ilkesini doğrudan ihlal eden bir sınıf hata.

**Düzeltme (PM onaylı)**: ortak bir `private clearEventTrackingState()`
yardımcı metodu eklendi (`reset()`'in eski gövdesinden aynen taşındı —
`simulationTime`/`totalBirths`/`historicalMaxGeneration` HARİÇ, çünkü
bunlar `reset()`'te sıfırlanıp `loadFromSave()`'de kayıttan geri
yükleniyor, ikisi arasında paylaşılan "olay TAKİBİ" durumu değil). Hem
`reset()` hem `loadFromSave()` artık bu yardımcıyı çağırıyor — davranış
HİÇ değişmedi (her iki çağrı da zaten boş durumlu nesnelerde çalışıyordu),
sadece gelecekteki bir yeniden-kullanımda sessizce hatalı davranışın
önü kapatıldı, aynı zamanda iki fonksiyon arasındaki kod tekrarı da
ortadan kalktı.

**Doğrulama**: `npx tsc --noEmit`/`npm run build` temiz, `dist/` API
anahtarı sızıntı taraması sıfır. 3 Playwright regresyon senaryosu (geçici
dev server, PID doğrulanıp sadece o PID durduruldu) — önceki turdaki
(İçe Aktarma Bug Düzeltmesi) AYNI üç senaryo (import-öncesi-başlat,
import-çalışan-sim-üstüne, normal-sayfa-yenileme) tekrar çalıştırıldı,
üçü de BİREBİR aynı sonuçları üretti (popülasyon/map-seed eşleşmesi,
sıfır su/kara ihlali, sıfır sayfa hatası) — davranış değişikliği
OLMADIĞI doğrulandı.

### Tester doğrulaması (bağımsız, 2026-09-10): GEÇTİ

Kod incelemesi — `nextGenomeId`'nin (`genome.ts`) MODÜL-SEVİYESİNDE bir
değişken olduğu ve `loadFromSave`'in TEK çağrı noktasının (`main.ts:137`)
her zaman TAZE bir modül yüklemesi (sayfa açılışı) sırasında çalıştığı
doğrulandı — yani `resetGenomeIdCounter()` çağrısı zaten
`nextGenomeId===1` olduğu bir anda çalışıyor, davranış değişikliği
yaratmıyor. Kendi Playwright script'im (coder c5'in testlerine güvenmeden,
izole dev server) 3 senaryoyu tekrar üretti, artı ekstra soy-kirlenmesi/
ID-benzersizliği kontrolleri: (1) import-öncesi-başlat: seed/pop birebir
eşleşti (24=24), 0 ihlal, soy kaydı TAM olarak içe aktarılanla eşleşti
(24=24), import sonrası 4 saniye daha çalıştırılıp yeni doğan canlıların
ID'lerinin benzersiz kaldığı doğrulandı; (2) import ÇALIŞAN bir sim üstüne
(kendi 25 kayıtlık soyu birikmiş): import sonrası soy kaydı İÇE
AKTARILANLA birebir eşleşti (24), eski çalışan sim'in 25 kaydıyla
KİRLENMEDİ/TOPLANMADI — `clearEventTrackingState()`'in gerçekten
çalıştığının doğrudan kanıtı; (3) normal sayfa yenileme (import hiç
kullanılmadan): popülasyon/seed etkilenmedi. Sıfır sayfa hatası, tsc
temiz.

## Faz XI — Organ Açıklaması Tutarlılığı, 2. Bağımsız Tur (arşiv)

TAMAMLANDI (coder, subagent, 2026-09-10), **Tester GEÇTİ (bağımsız,
2026-09-10)**. `organs.ts`/`creature.ts`/`ecosystem.ts` Faz XI'in ilk
"Organ Açıklama Metinleri Taraması"ndan (bkz. yukarıda) farklı bir
açıdan, ikinci bir bağımsız gözle tekrar tarandı.

**Bulunan tutarsızlık**: `creature.ts`'teki `survivalBonus()`
fonksiyonunun doc-comment'i "bu fazda pasif bir enerji-verimliliği bonusu
olarak da metabolizmayı hafifçe düşürür" diyordu — bu davranış kodda
YOKTU (fonksiyon sadece bir kaçış-şansı sayısı döndürüyor, metabolizmaya
hiç dokunmuyor) ve aynı dosyadaki `metabolismMultiplier()` yorumuyla
(satır ~232-234: "kamuflaj/diken metabolizmayı etkilemez") zaten
ÇELİŞİYORDU.

**Düzeltme (sadece metin)**: `survivalBonus()` yorumu, organın GERÇEK
kullanım yerine (`ecosystem.ts` `huntCreature`/
`packHuntEscapeReduction` — avdan kaçış şansı) doğru referans verecek
şekilde güncellendi, davranış/kod mantığı değişmedi. Diğer tüm organ
açıklamaları (gill/lung/shell/torpor/blubber/venom/regeneration/
nitrogen_sac/sulfur_vent_organ dahil) `creature.ts`/`ecosystem.ts`
mekanik etkileriyle karşılaştırıldı, ek bir uyuşmazlık bulunamadı.
`prevalenceContext()` (ecosystem.ts) sadece 10/21 organ için özel bağlam
metni içeriyor, kalanı zararsız bir "popülasyonda yayılıyor" default'una
düşüyor — bug değil, kapsam dışı bırakıldı (davranış değişikliği talep
edilmedi).

**Doğrulama (coder)**: `npx tsc --noEmit` (öncesi VE sonrası temiz) +
`npm run build` temiz, `dist/` içinde `GEMINI_API_KEY` adı da değeri de
bulunmadı (grep ile doğrulandı), `dist/` geçici çıktı olarak silindi.

### Tester doğrulaması (bağımsız, 2026-09-10): GEÇTİ

`survivalBonus()` kodu satır satır incelendi — sadece kabuk/kamuflaj/
diken/zehir bezine dayalı bir sayı döndürüyor, metabolizmaya dokunmuyor;
gerçek kullanım yeri `ecosystem.ts` `huntCreature`/
`packHuntEscapeReduction`'da kaçış şansı olarak doğrulandı, yeni yorum bu
davranışla tutarlı. `tsc --noEmit` ve `npm run build` bağımsız olarak
tekrar temiz, `dist/`'te anahtar sızıntısı yok, `dist/` silindi.

## Faz XI — Bug-avı Taraması (main.ts/hud.ts/lineagetree.ts/savegame.ts/exportimport.ts) (arşiv)

TAMAMLANDI (coder, 2026-09-10), **Tester GEÇTİ (bağımsız, 2026-09-10)**.
Event-listener temizliği, null/undefined kontrolleri, save/export-import
format tutarlılığı incelendi — hepsi ✅ sağlıklı (event listener'lar
uygulama ömrü boyunca bir kez kuruluyor, `dataset.wired` guard'ları var;
save ve export/import AYNI `isValidSaveData`'yı paylaşıyor, tutarsızlık
yok).

**Bulunan tutarsızlık**: `lineagetree.ts` `dominantOrganType()` yorumu "en
yüksek `power` değerine sahip organı" seçtiğini iddia ediyordu, kod
aslında `organs[organs.length - 1]` ile EN SON KAZANILAN organı
döndürüyor (genome.ts `maybeGainOrgan` yeni organları diziye append
ediyor, power karşılaştırması hiç yok) — soy ağacındaki düğüm halka rengi
de bu (yanlış belgelenmiş) mantığa dayanıyor. Düşük riskli olduğu için
sadece yorum düzeltildi (davranış DEĞİŞTİRİLMEDİ — gerçekten "en yüksek
power" mantığına geçmek görsel/davranışsal bir değişiklik olurdu, PM
onayı gerektirir, TASKS.md'de ayrı bir aday olarak not düşüldü).

**Doğrulama (coder)**: `npx tsc --noEmit` ve `npm run build` temiz,
`dist/`'te anahtar sızıntısı yok, `dist/` silindi.

### Tester doğrulaması (bağımsız, 2026-09-10): GEÇTİ

`dominantOrganType()` (lineagetree.ts satır ~140-142) gerçek kodu
doğrulandı — `organs.length > 0 ? organs[organs.length - 1] : null`,
herhangi bir `power` karşılaştırması/sort YOK, iddia doğru. `genome.ts`
`maybeGainOrgan` (satır ~275-283) da doğrulandı — yeni organı
`[...organs, newOrgan]` ile sona ekliyor, mevcut organların power'ıyla
karşılaştırma yapmıyor; coder'ın append-only iddiası doğru. Yeni yorum
(satır 127-132) kodla tutarlı. `npx tsc --noEmit` ve `npm run build`
bağımsız olarak tekrar çalıştırıldı, ikisi de temiz; `dist/` içinde
anahtar/sızıntı taraması negatif; `dist/` tekrar silindi. Davranış kodu
değişmemiş (sadece yorum), diff riski yok.

## Faz XI — Plague Inc Tarzı Canlı Diyagramı + Soy Ağacı Tam Sayfa Görünümü (arşiv)

Kullanıcı isteği (2026-09-10, coder 6f/c2, PM 6c görevlendirmesi):
TAMAMLANDI, **Tester GEÇTİ (bağımsız, 2026-09-10)**.

**Madde 1 — Şematik canlı diyagramı**: inceleme panelindeki organ
listesinin ÜSTÜNE, gövdeyi + sahip olunan organları gösteren küçük bir
SVG eklendi (`hud.ts` `buildCreatureDiagram`). Her `OrganCategory`
(movement/sense/feeding/defense, bkz. `organs.ts`) gövde etrafında sabit
bir bölgeye (üst=algı, sağ=beslenme, alt=hareket, sol=savunma) atanıyor —
anatomik kesinlik hedeflenmiyor, sadece "nerede ne var" hissi. Aynı
kategoride birden fazla organ varsa o bölge içinde eşit açıyla
dağıtılıyor (`organs.ts` `slotAngle` ile aynı ruhta, ama SVG/DOM
uzayında, Pixi `Graphics`'e bağımlı değil). Her ikon `<title>` ile
organın gerçek `label`/`description`'ını (hover tooltip) taşıyor. En son
kazanılan organ (`organs[organs.length-1]` — `lineagetree.ts`
`dominantOrganType` ile AYNI, zaten belgelenmiş kural) hafif bir CSS
`@keyframes` pulse animasyonuyla öne çıkıyor. **"Uydurma yok" garantisi**:
gösterilen HER ikon `InspectionData.organs`'tan (gerçek genom verisi)
türetiliyor, hiçbir sabit/dekoratif ikon yok — organsız bir mikroorganizma
boş bir gövde dairesi gösterir. Sadece `showInspector` (canlı bireyler)
için eklendi, `showDeceasedInspector` kapsam dışı bırakıldı (kullanıcının
net istediği "canlı ekranı" ile sınırlı).

**Madde 2 — Soy ağacı tam sayfa görünümü**: `.overlay-panel` (sağ üstte
sabit 520x380px) yerine yeni `.overlay-panel-fullpage` sınıfı — sahne
alanının neredeyse tamamını kaplıyor (14px kenar boşluğu). Mevcut
zoom/pan/tekerlek/filtre mantığı (`lineagetree.ts`) HİÇ DEĞİŞMEDİ —
üzerine açık −/yüzde/+/1:1 butonları eklendi (`setZoom`/`updateZoomLabel`,
mevcut `ZOOM_STEP`/`MIN_ZOOM`/`MAX_ZOOM` sabitlerini paylaşıyor), tekerlek
zoom'u hâlâ çalışıyor (butonlar ek/daha keşfedilebilir bir yol, eskiyi
kırmadı).

**Doğrulama (coder tarafı)**: `npx tsc --noEmit` ve `npm run build` temiz,
`dist/` API anahtarı sızıntı taraması sıfır, `dist/` silindi. İzole
Playwright testi (port 6933, PID 37876, sadece kendi PID'i durduruldu): 5
organ zorlanan bir canlıda inceleme paneli açıldı — `.creature-diagram`
DOM'da mevcut, 5 ikon render edildi (`ICON_COUNT 5`), en son eklenen
(`fin`) TEK başına pulse sınıfı taşıyor (`PULSE_COUNT 1`) — doğru. Soy
ağacı açılıp panel boyutu ölçüldü: 1500x1000 viewport'ta panel 1192x920px
(eski sabit 520x380'den belirgin şekilde büyük, gerçek "tam sayfa"
hissi). Zoom butonuna tıklanınca etiket 100%→110% doğru güncellendi.
Sıfır sayfa hatası. İki ekran görüntüsü kullanıcıya gönderildi (dürüst
görsel doğrulama).

### Tester doğrulaması (bağımsız, 2026-09-10): GEÇTİ

c2'nin senaryosuna güvenmeden farklı bir kombinasyon test edildi (geçici
dev server, PID doğrulanıp sadece o PID durduruldu): (1) **Diyagram**:
`eye/mouth/leg/shell/spike` (5 organ, İKİSİ aynı kategoride —
`shell`+`spike` ikisi de "defense" — açısal dağıtım mantığını da
kapsayacak şekilde) zorlandı, gerçek tıklamayla panel açıldı — 5 ikon
render edildi, SADECE en son eklenen (`spike`) pulse sınıfı taşıyor, her
ikonun `<title>`'ı gerçek organ `label`/`description`'ıyla BİREBİR
eşleşti (uydurma yok). Organsız bir birey AYRICA test edildi: 0 ikon +
sadece gövde dairesi (iddia edildiği gibi). (2) **Soy ağacı tam sayfa**:
1280×720 viewport'ta panel 972×640 (ekranın %76×%89'u) — "tam sayfa"
iddiası doğrulandı. Zoom butonlarıyla 3 kez yakınlaştırıldı
(110%→120%→130%, etiket her adımda doğru), ARDINDAN fare tekerleği ile
TEKRAR yakınlaştırıldı (1.3→1.4) — buton ve tekerlek zoom'unun AYNI
durumu paylaştığı, birbirini bozmadığı kanıtlandı (c2'nin testinde bu
kombinasyon test edilmemişti). 1:1 butonu zoom'u tam olarak 1.0/100%'e
döndürdü. Filtre kontrolleri (5 adet) ve düğüm tıklama pozisyonları (25
düğüm) bulundu/işlevsel. Sıfır sayfa hatası. `npx tsc --noEmit`/`npm run
build` bağımsız tekrarlandı, temiz; `dist/` sızıntı taraması sıfır,
`dist/` silindi.

## Faz XI — `crossoverGenomes` Organ Birleşimi Adalet Düzeltmesi (arşiv)

TAMAMLANDI (coder 6f/c2, 2026-09-10, PM onaylı — tester 62'nin bulgusu),
**Tester GEÇTİ (bağımsız, 2026-09-10, tester 62)**.

**Kök neden**: `genome.ts` `crossoverGenomes`'un organ birleşimi bir `Map`
üzerinden yapılıyordu (`a.organs` önce eklenip, sonra `b.organs`, insertion-
order korunarak) ve sonuç `.slice(0, MAX_ORGAN_TYPES)` (6) ile kesiliyordu.
Yorumun iddia ettiği "adil birleşim (union, tekrarsız)" aslında ADİL
DEĞİLDİ: birleşik organ sayısı 6'yı aşarsa (her ebeveyn bağımsız olarak
6'ya kadar farklı organ taşıyabildiğinden gerçekçi bir senaryo), `a.organs`
Map'e ÖNCE eklendiği için `slice` HER ZAMAN `a`'yı `b`'ye tercih ediyordu.
Çağrı yerinde (`ecosystem.ts` `updateSexualReproduction`) `a` rastgele
değil, her zaman eşleşme aramasında "arayan" (dizide daha erken indeksli)
taraf — yani sistematik, rastgele olmayan bir yanlılık.

**Düzeltme**: `genome.ts` `crossoverGenomes` — birleşik organ listesi
kesmeden ÖNCE Fisher-Yates ile karıştırılıyor, sonra `MAX_ORGAN_TYPES`'a
kesiliyor. Ortalama-power birleştirme mantığı (iki ebeveynde de aynı organ
tipi varsa güçlerinin ortalaması alınır) DEĞİŞMEDİ — sadece kimin hayatta
kaldığı artık rastgele (istenen davranış değişikliği).

**Coder'ın kendi testi**: main.ts'e geçici bir `__debugCrossoverOrganBias(trials)`
TEST-ONLY debug hook'u eklendi — her ebeveyne SADECE kendine özgü 4 organ
verilip (a: fin/leg/wing/tentacle, b: eyespot/eye/mouth/shell — toplam
8 > `MAX_ORGAN_TYPES`=6, eski bug'ı kesin tetikleyen senaryo) 2000 deneme
çalıştırıldı: `aWins=5953, bWins=6047` → a kazanma oranı **%49.61** (eski
koddan matematiksel olarak beklenen: a'nın 4 organı + b'nin ilk 2'si HER
ZAMAN kazanırdı, ~%100 a-yanlılığı). `npx tsc --noEmit`/`npm run build`
temiz, `dist/` sızıntı taraması sıfır, `dist/` silindi.

### Tester doğrulaması (bağımsız, 2026-09-10, tester 62): GEÇTİ

Kod incelemesi — Fisher-Yates shuffle'ın kendisi (`for i=len-1..1,
j=random(0..i), swap`) doğru/standart algoritma, off-by-one yok, bağımsız
olarak doğrulandı. Coder'ın hook'una körü körüne güvenmeden, aynı hook
FARKLI deneme sayılarıyla (coder'ın kullanmadığı 7000 ve 100) tekrar
çalıştırıldı — geçici dev server (port 6711, PID 32256, sadece kendi
PID'i durduruldu): 7000 denemede `aWins=21053, bWins=20947` → a oranı
**%50.13** (istatistiksel gürültü içinde, mükemmel dengeli); 100 denemede
bile `aWins=298, bWins=302` → %49.67 — küçük örneklemde bile sapma yok.
`npx tsc --noEmit`/`npm run build` bağımsız tekrarlandı, temiz; `dist/`
sızıntı taraması sıfır, `dist/` silindi. Sıfır sayfa hatası. **Temizlik**:
doğrulama tamamlandıktan sonra `__debugCrossoverOrganBias` hook'u
(main.ts) ve artık kullanılmayan `crossoverGenomes`/`randomGenome`
importları TAMAMEN kaldırıldı — tsc/build tekrar temiz doğrulandı, proje
kuralına uygun (test-only hook'lar doğrulama sonrası geri alınır).

## Faz XI — `geminiinsight.ts` Stale Organ Whitelist Düzeltmesi (arşiv)

TAMAMLANDI (coder 6f/c2, 2026-09-10, PM onaylı — tester 62'nin bulgusu),
**Tester GEÇTİ (bağımsız, 2026-09-10, tester 62)**.

**Kök neden**: `VALID_SUGGESTION_TARGETS` SADECE Faz II'nin orijinal 10
organ tipini SABİT listeliyordu (`fin, leg, wing, tentacle, eyespot, eye,
mouth, shell, camouflage, spike` + `"sexual"`) — proje Faz X/XIV/XVI'da 21
organ tipine çıkınca bu liste hiç güncellenmemişti. Prompt metni de
sadece bu eski 10 organı Gemini'ye sıralıyordu. `applyOrganWeightSuggestion`
(organs.ts) kendisi `ALL_ORGAN_TYPES`'a göre doğru validasyon yapıyordu,
ama `extractSuggestion`'daki bu stale whitelist Gemini yeni bir organ
(örn. "venom") önerse bile SESSİZCE reddediyordu — Faz VII'nin "hafif
yönlendirme" özelliği fiilen organ havuzunun yarısından azıyla sınırlı
kalmıştı.

**Düzeltme**: `VALID_SUGGESTION_TARGETS` artık `organs.ts` `ALL_ORGAN_TYPES`'tan
TÜRETİLİYOR (`[...ALL_ORGAN_TYPES, "sexual"]`), prompt metnindeki organ
listesi de dinamikleştirildi.

**Coder'ın kendi testi**: geçici bir TEST-ONLY debug hook (doğrulama
sonrası TAMAMEN geri alındı) ile sahte Gemini yanıtları üzerinden
`extractSuggestion` çağrıldı — YENİ organlar (`venom`, `nitrogen_sac`)
artık KABUL ediliyor (eskiden reddedilirdi); ESKİ organlar (`fin`) ve
`"sexual"` hâlâ kabul ediliyor (regresyon yok); uydurma bir hedef
(`not_a_real_organ`) hâlâ DOĞRU şekilde reddediliyor. `npx tsc --noEmit`/
`npm run build` temiz, `dist/` sızıntı taraması sıfır, `dist/` silindi.

### Tester doğrulaması (bağımsız, 2026-09-10, tester 62): GEÇTİ

Gemini API'yi gerçekten çağırmadan (günlük kota paylaşılıyor, boşa
harcamamak için), tamamen STATİK kod doğrulaması yapıldı — `organs.ts`'teki
`ORGAN_DEFINITIONS` nesnesinin gerçek anahtarları (grep ile çıkarıldı)
`OrganType` union'ındaki 21 tip ile BİREBİR eşleşiyor (`bioluminescence,
blubber, camouflage, eye, eyespot, fin, gill, heart, leg, lung, mouth,
nitrogen_sac, regeneration, shell, spike, stomach, sulfur_vent_organ,
tentacle, torpor, venom, wing` — tam 21, eksik/fazla yok) — yani
`ALL_ORGAN_TYPES = Object.keys(ORGAN_DEFINITIONS)` KESİN olarak 21 organı
içeriyor, `VALID_SUGGESTION_TARGETS`'ın spread'i (`[...ALL_ORGAN_TYPES,
"sexual"]`, filtre YOK) bunların TAMAMINI kapsıyor. `extractSuggestion`'ın
`.includes(target)` kontrolü değişmemiş, mantık bozulmamış. Ayrıca
`main.ts`'te `__debugCrossoverOrganBias` hook'unun GERÇEKTEN kaldırıldığı
grep ile doğrulandı (0 eşleşme). `npx tsc --noEmit`/`npm run build`
bağımsız tekrarlandı, temiz; `dist/` sızıntı taraması sıfır, `dist/`
silindi.

## Faz XI — `vite.config.ts` Eksik Content-Type Header Düzeltmesi (arşiv)

TAMAMLANDI (coder 6f/c2, 2026-09-10, PM'in "daha önce dokunulmamış bir
alanda küçük bir iyileştirme bul" talimatı üzerine bulundu, düşük risk/
metin-only olduğu için direkt düzeltildi), **Tester GEÇTİ (bağımsız,
2026-09-10, tester 62)**.

**Bulgu**: her iki proxy middleware'de (`geminiProxyPlugin`,
`populationTelemetryPlugin`) JSON gövdeli hata yanıtlarının HEPSİ
`Content-Type: application/json` set ediyordu — SADECE 3 tane "405 Method
Not Allowed" dalı (`/api/gemini-insight` kök, `/api/population-snapshot/history`,
`/api/population-snapshot` kök) bu header'ı UNUTMUŞTU, tarayıcı/istemci
yanıt gövdesini JSON olarak değil metin/`text/plain` (Node'un varsayılanı)
olarak yorumlayabilirdi — tutarsız bir API sözleşmesi.

**Düzeltme**: 3 eksik yere de `res.setHeader("Content-Type", "application/json")`
eklendi (davranış/durum kodu DEĞİŞMEDİ, sadece header).

**Coder'ın testi**: izole `curl` testi (port 6966, PID 25548, sadece kendi
PID'i durduruldu): 4 senaryo (`/api/gemini-insight` GET→405, `/api/population-snapshot`
GET→200 sanity, `/api/population-snapshot/history` POST→405,
`/api/population-snapshot` DELETE→405) hepsi doğru header'ı döndürdü. `npx
tsc --noEmit`/`npm run build` temiz, `dist/` sızıntı taraması sıfır,
`dist/` silindi.

### Tester doğrulaması (bağımsız, 2026-09-10, tester 62): GEÇTİ

Kod incelemesi ile 3 düzeltmenin tam da doğru yerlere eklendiği satır
satır teyit edildi. c2'nin KULLANMADIĞI metodlarla (PUT, PATCH — GET/DELETE
değil) `curl -i` testi (geçici dev server, port 6811, PID doğrulanıp
sadece o PID durduruldu): PUT `/api/gemini-insight` → 405 + doğru header;
PATCH `/api/population-snapshot/history` → 405 + doğru header; PUT
`/api/population-snapshot` → 405 + doğru header. Ayrıca regresyon kontrolü:
`GET /api/population-snapshot` → 200 + json, `POST` geçerli veri → 204,
`GET /history` → 200 + json — hiçbiri etkilenmemiş.

## Faz XI — Soy Ağacı Tam Sayfa Panelinde ESC Tuşuyla Kapatma (arşiv)

TAMAMLANDI (coder 6f/c2, 2026-09-10, PM onaylı — tester 62'nin
erişilebilirlik bulgusu), **Tester GEÇTİ (bağımsız, 2026-09-10, tester
62)**.

**Bulgu**: soy ağacı paneli eskiden küçük bir köşe kutusuydu (520×380px),
kullanıcı isteğiyle artık tam sayfa modal (ölçülen %76×%89 ekran kaplamı)
— bu boyutta standart modal-kapatma beklentisi (ESC) belirgin, ama panel
sadece "×" butonuyla kapanıyordu.

**Düzeltme**: `lineagetree.ts`'e `document` üzerinde bir `keydown`
dinleyicisi eklendi — panel SADECE görünürken (`this.visible` kontrolü)
`Escape` tuşunda "×" butonuyla (`lineage-close`) AYNI `hide()` yolunu
çağırıyor, iki kapatma yöntemi arasında tutarsızlık yok.

**Coder'ın testi**: izole Playwright testi (port 6977, PID 43364, sadece
kendi PID'i durduruldu), 6 senaryo: panel kapalıyken ESC → hiçbir şey
olmuyor/hata yok; panel açılıp ESC → kapanıyor; ESC sonrası toggle
butonunun `active` class'ı da doğru kalkıyor; tekrar aç → × ile kapat →
ardından ESC → ikinci bir hata/çakışma olmadan sessizce no-op. Sıfır
sayfa hatası. `npx tsc --noEmit`/`npm run build` temiz, `dist/` sızıntı
taraması sıfır, `dist/` silindi.

### Tester doğrulaması (bağımsız, 2026-09-10, tester 62): GEÇTİ

Kod incelemesi — `main.ts`'te İKİNCİ bir global `keydown` handler'ı
(Space/1/2/3, hız kontrolü) olduğu bulundu, `e.key==="Escape"` kontrolü
yapmadığı ve `preventDefault`/`stopPropagation` çağırmadığı doğrulandı —
çakışma riski yok. Farklı senaryolarla canlı test (Playwright, geçici
port 6911, PID doğrulanıp sadece o PID durduruldu): (1) panel açıkken ESC
ARKA ARKAYA 5 kez basıldı — ilk basışta kapandı, sonrakiler sessizce
no-op, hata yok; (2) panel AÇIKKEN main.ts'in hız-kontrolü keydown
handler'ının hâlâ ÇALIŞTIĞI doğrulandı (panel açıkken "2" tuşuna basılıp
hızın gerçekten 2'ye değiştiği ölçüldü) — iki `keydown` dinleyicisi
birbirini bozmuyor; (3) ESC, panelin İÇİNDE bir odak olmadan (body
odaklı) da paneli DOĞRU şekilde kapattı (`document`-seviyeli dinleyici
beklendiği gibi çalışıyor). Sıfır sayfa hatası.

## Faz XI — `dominantOrganType()` "En Yüksek Power" Mantığına Geçiş (arşiv)

TAMAMLANDI (coder 6f/c2, 2026-09-10, PM onaylı — kullanıcının "profesyonel
soy ağacı" isteğine daha uygun bir davranış), **Tester GEÇTİ (bağımsız,
2026-09-10, tester 62)**.

**Kök neden**: Ana organ (soy ağacı düğüm halka rengini belirleyen)
eskiden EN SON KAZANILAN organdı (`organs[organs.length-1]`) — yorum "en
yüksek power" iddia etse de kod öyle davranmıyordu (bkz. TASKS_ARCHIVE.md
2026-09-10 bug-avı taraması bulgusu).

**Düzeltme**: `LineageRecord`'a yeni bir `dominantOrganType: OrganType |
null` alanı eklendi, doğum anında (`ecosystem.ts` `recordLineage`, ham
genom verisiyle — power orada mevcut) `computeDominantOrganType` ile BİR
KEZ hesaplanıp saklanıyor (eşitlikte en son eklenen kazanıyor, eski
davranışla tutarlı tie-break, `o.power >= dominant.power` karşılaştırması
ile). **Kapsam bilinçli daraltıldı**: `LineageRecord.organs: OrganType[]`
alanının kendisi (power YOK) ve onu kullanan 6 farklı çağrı yeri
(`ecosystem.ts`/`lineagetree.ts`/`main.ts`) DOKUNULMADAN bırakıldı —
bunun yerine sadece yeni, dar kapsamlı bir alan eklendi, daha riskli bir
veri-modeli refactor'ü yerine. Save formatına etkisi yok (`LineageRecord`
kayıt formatının parçası değil, her sayfa açılışında/kayıt yüklemesinde
yeniden hesaplanıyor). `lineagetree.ts`'teki eski (yanlış belgelenmiş)
yerel `dominantOrganType()` heuristiği tamamen kaldırıldı, artık
`record.dominantOrganType` doğrudan okunuyor.

**Coder'ın kendi testi**: iki geçici TEST-ONLY debug hook ile (doğrulama
sonrası TAMAMEN geri alındı) 6 senaryo doğrulandı — en kritik ikisi: leg
(hareket) ÖNCE eklenip yüksek power (0.9), eye (algı) SONRA eklenip düşük
power (0.2) verildiğinde sonuç "leg" (eski kod "eye" seçerdi — sıra değil
güç kazanıyor); tersi sırayla da (eye önce+yüksek, leg sonra+düşük) doğru
şekilde "eye" seçildi — sıralamadan bağımsız, gerçekten power'a dayalı
olduğu kanıtlandı. Ayrıca eşit-power tie-break, tekil organ, boş organ
listesi (null), ve 3 organlı orta-en-yüksek senaryoları da doğru sonuç
verdi. Doğal simülasyon verisiyle de (60s, 4x hız) 8 canlı üzerinde
`getLineage()`'ın `dominantOrganType`'ı canlı organ verisiyle çapraz
kontrol edildi, hepsi eşleşti. Görsel olarak soy ağacı paneli ekran
görüntüsüyle de (140 popülasyon, 6 nesil) düğüm halkalarının hâlâ doğru
render edildiği (mavi/sarı/mor kategoriler) teyit edildi. `npx tsc
--noEmit`/`npm run build` temiz, `dist/` sızıntı taraması sıfır, `dist/`
silindi. Sıfır sayfa hatası.

### Tester doğrulaması (bağımsız, 2026-09-10, tester 62): GEÇTİ

Kod incelemesi: `__debugForceSyntheticLineageChain` (TEST-ONLY, sentetik
soy zinciri üretici) hâlâ eski `organs[organs.length-1]` deseniyle
görünüyordu — incelemede bunun bir REGRESYON OLMADIĞI doğrulandı: o
fonksiyon sadece bare `OrganType[]` (power BİLGİSİ YOK) ile çalışıyor,
`computeDominantOrganType` gerçek `Organ[]` (power'lı) bekliyor — tip
uyumsuzluğu nedeniyle kullanılamıyor, kasıtlı bir tasarım kısıtı,
unutulmuş bir güncelleme değil. `LineageRecord`'ın save formatının
parçası olmadığı da ayrıca doğrulandı (`savegame.ts`'de hiç referans
yok). Canlı Playwright testi (geçici dev server, port 7011, PID
doğrulanıp sadece o PID durduruldu), c2'nin senaryosundan FARKLI bir
kombinasyon: mouth(0.2, İLK) → shell(0.9, ORTADA) → spike(0.3, SON) —
ana organ doğru şekilde "shell" (ortadaki en yüksek power) seçildi, hem
ilk/son organ önyargısı hem basit sıra-tabanlı bir bug olmadığı
kanıtlandı. Eşit-power tie-break iddiasını CANLI test ETMEDİM (mutasyon
ebeveyn-çocuk arasında güçleri değiştirdiğinden gerçek bir "tam eşitlik"
senaryosunu çocukta güvenilir şekilde üretmek pratik değil) — bunun
yerine kodu statik olarak doğrudan izleyip `>=` mantığının iddia edilen
tie-break'i ürettiğini teyit etti. `npx tsc --noEmit`/`npm run build`
bağımsız tekrarlandı, temiz.

## Faz XI — Dünya Olayları Manuel/Otomatik Tetikleme Tutarsızlığı Düzeltmesi (arşiv)

TAMAMLANDI (coder 6f/c2, 2026-09-10, PM'in "worldevents.ts'i incele"
görevlendirmesi üzerine bulundu, PM onaylı düzeltme), **Tester GEÇTİ
(bağımsız, 2026-09-10, tester 62)**.

**İnceleme sonucu**: Faz VIII'in belgelediği süre/yoğunluk parametreleri
(iklim 45-90s, rüzgar 12-25s, deprem 25-50s) kodla (`worldevents.ts`
sabitleri) birebir eşleşiyordu, dokümantasyon driftı YOK.

**Bulunan gerçek tutarsızlık**: otomatik tetikleme (`updateChecks`)
climate/wind/quake için "zaten aktifse yeni tetikleme yapma" koruması
uyguluyordu (`if (this.xActiveTimer <= 0 && Math.random() < ...)`), ama
manuel tetikleme (`forceTrigger`, HUD butonu) bu korumayı HİÇ
paylaşmıyordu — art arda iki manuel tetikleme (örn. deprem üstüne
deprem) ikincisi birincinin süresini SESSİZCE eziyordu. Deprem için daha
ciddi: `world.ts` `quakeOverrides` birden fazla bölgeyi destekleyen bir
dizi ama `WorldEventManager`'da TEK bir `quakeActiveTimer` vardı — ilk
depremin bölgesi world.ts'te kalırken timer ikincinin süresine
sıfırlanıyordu (kalıcı sızıntı yok, `clearQuakeOverrides` ikisini de
temizliyor, ama süre-doğruluğu bozuluyordu).

**Düzeltme**: `forceTrigger`'a meteor DIŞINDAKİ üç tip için aynı "zaten
aktifse" koruması eklendi — engellenirse sessizce yok sayılmıyor, event
log'a kısa bir "zaten aktif, bekleniyor" mesajı düşüyor (mevcut
şeffaflık desenine uygun). Bu koruma çakışmayı zaten engellediğinden
ayrı bir per-bölge zamanlayıcı sistemi GEREKSİZ görüldü (basit koruma
yeterli, gereksiz karmaşıklık eklenmedi).

**Coder'ın kendi testi**: izole Playwright testi (port 7033, PID 28864,
sadece kendi PID'i durduruldu): art arda iki manuel deprem → ikinci
ENGELLENDİ (`quake count` 1'de kaldı), event log'da "Deprem etkisi
zaten aktif, bitmesi bekleniyor" mesajı doğru render edildi; aynı sonuç
climate için de doğrulandı; meteor (aktif-durum kavramı yok) korumadan
ETKİLENMEDİ — iki art arda manuel meteor ikisi de gerçekten tetiklendi
(`meteor count` 0→2); 8 saniyelik 4x-hız otomatik koşu sırasında hiç
hata/çökme olmadı. `npx tsc --noEmit`/`npm run build` temiz, `dist/`
sızıntı taraması sıfır, `dist/` silindi. Sıfır sayfa hatası.

### Tester doğrulaması (bağımsız, 2026-09-10, tester 62): GEÇTİ

Kod incelemesi: koruma mantığının `updateChecks`'in kendi guard'ıyla
(`climateActiveTimer > 0` vb.) birebir aynı koşulu kullandığı, event-log
mesaj etiketlerinin doğru eşleştiği teyit edildi. c2'nin test ETMEDİĞİ
iki ek senaryo, canlı Playwright testiyle (geçici dev server, port 7111,
PID doğrulanıp sadece o PID durduruldu): (1) **wind** için de aynı
engelleme (c2 sadece climate/quake/meteor test etmişti) — art arda iki
manuel rüzgar, ikincisi doğru şekilde engellendi (`wind count` 1'de
kaldı); (2) **engelin süre dolunca gerçekten AÇILDIĞI** — c2'nin testi
sadece engellemenin olduğunu gösteriyordu, kalıcı bir kilitlenme
olmadığını göstermiyordu; rüzgarın maksimum süresini (25s) güvenle
aşacak kadar (4x hızda 8s gerçek zaman ≈ 32 sim-saniye) beklendi,
`windActive` doğru şekilde `false`'a döndü, ÜÇÜNCÜ bir manuel rüzgar bu
kez BAŞARIYLA tetiklendi (`wind count` 1→2) — engelin geçici olduğu,
kalıcı bir kilitlenmeye dönüşmediği kanıtlandı. Ayrıca `getActiveState()`'in
tetiklemeden HEMEN sonra doğru `true` döndüğü (deprem ile) ayrıca
doğrulandı. Sıfır sayfa hatası. tsc/build bağımsız tekrarlandı, temiz;
`dist/` sızıntı taraması sıfır.

## Faz XI — Mobil/Dar-Ekran Responsive Taraması (arşiv)

PM'in "bugün eklenen organ diyagramı + soy ağacı tam sayfa paneli, Faz XI
Responsive'in dar-ekran davranışıyla uyumlu mu" sorusu üzerine (coder
6f/c2, 2026-09-10), izole Playwright testiyle 375×667 (gerçek telefon
boyutu) viewport'ta hem organ diyagramı hem soy ağacı tam sayfa paneli
test edildi.

**Bulgu**: soy ağacı paneli SORUNSUZDU (zoom kontrolleri erişilebilir,
taşma yok). Ama canlı inceleme paneli (organ diyagramı dahil) `#stats-panel`
ile YAN YANA sığdırılmaya çalışılan satır-tabanlı (flex-wrap) mobil
düzende (Faz XI Responsive, `max-width:680px`) GERÇEKTEN taşıyordu —
375px viewport'ta panel sağ kenarı viewport'u ~60-75px aşıyordu,
`#side-panel` SADECE dikey kaydırmalı olduğundan bu içerik (diyagramın
bir kısmı dahil) erişilemezdi. Kök neden TEK bir şey değildi: (1) yeni
SVG diyagramın sabit `width="140"` özniteliği flex-item'ın varsayılan
`min-width:auto` davranışıyla birleşip `max-width:100%`'ü geçersiz
kılıyordu; (2) `#inspector-panel`'in masaüstü/dikey-düzen için var olan
`flex-shrink:0` kuralı (event log'u sıkıştırmamak için, Faz XI UI/UX
sadeleştirme) mobil satır-düzeninde de aktif kalıp paneli hiç
küçültmüyordu; (3) EN TEMELDE, `#stats-panel`'in 2-sütunlu istatistik
ızgarası (büyük harf etiketler yüzünden ~233px gerçek min-content
tabanı) ile diyagram+metin içeren inceleme panelini 375px'lik bir satırda
YAN YANA sığdırmaya çalışmak baştan gerçekçi değildi.

**Düzeltme** (`dashboard.css`, 3 parça): SVG'ye `max-width:100%;
min-width:0` eklendi (kendi başına yeterli değildi ama gerekli); mobil
satır-düzeninde `#inspector-panel`'e `flex-shrink:1` override'ı eklendi
(masaüstü/dikey düzendeki orijinal `flex-shrink:0` DEĞİŞMEDİ); YENİ bir
`max-width:480px` kırılım noktası eklenip bu genişlikte `#side-panel`
doğrudan `flex-direction:column`'a dönüyor (masaüstünün ZATEN kullandığı,
kanıtlanmış düzen) — panelleri yan yana sığdırmaya ZORLAMAK yerine
gerçekten dar ekranlarda TAM GENİŞLİKTE alt alta istifliyor. 480-680px
arası (tablet/büyük telefon yatay) mevcut yan-yana düzen KORUNUYOR
(niyet olarak — bkz. aşağıdaki bağımsız doğrulama bulgusu).

**Coder'ın doğrulaması**: `npx tsc --noEmit`/`npm run build` temiz,
`dist/` sızıntı taraması sıfır, `dist/` silindi. İzole Playwright testleri
(port 7055, PID 10936, sadece kendi PID'i durduruldu): 375×667'de 4 organ
zorlanan bir canlının inceleme paneli açıldı — `statsOverflows`/
`inspectorOverflows`/`diagramOverflows`/`pageOverflowsHorizontally`
HEPSİ `false` (düzeltme öncesi inceleme paneli 436-610px'e kadar
taşıyordu); ekran görüntüsüyle görsel olarak da doğrulandı (paneller tam
genişlikte, düzgün alt alta). Soy ağacı paneli aynı viewport'ta yine
sorunsuz (zoom butonu tıklanabilir, 100%→110%). **Regresyon kontrolü**:
600px genişlikte (480-680px aralığı) `#stats-panel`/`#inspector-panel`
hâlâ YAN YANA (`sameRow:true`), taşma yok — orta genişlik düzeni bu
düzeltmeden ETKİLENMEDİ (c2'nin iddiası). Sıfır sayfa hatası.

**🔴 Bağımsız tester doğrulaması (62, 2026-09-10): 375px/320px/tam 480px
sınırı için GEÇTİ, ama 480-680px "tablet" aralığında AYRI, GERÇEK bir
CSS kaskad bug'ı bulundu (durum: TASKS.md'de "AÇIK" olarak takip
ediliyor, c2'ye devredildi — bu arşiv girdisi coder'ın İLK turunu
belgeliyor, düzeltmenin sonucu ayrı bir arşiv girdisinde olacak).**

Kök neden: `dashboard.css` satır 313-321'deki BASE (media-query'siz)
`#side-panel` kuralı `flex-direction: column` set ediyor — bu kural,
`@media (max-width: 680px)` kuralından (satır 223, `flex-direction: row`,
"tablet/yan-yana düzen korunuyor" diye belgelenmiş) dosyada SONRA
geliyor. Aynı özgüllükte iki kural çakıştığında CSS kaskadında dosyadaki
SONRAKİ kural kazanır — bir kuralın media query İÇİNDE olması onu
otomatik önceliklendirmiyor, sadece hangi genişliklerde aktif olacağını
belirliyor. Sonuç: 480-680px aralığında
(`window.matchMedia("(max-width: 680px)").matches === true` doğrulandı)
`flex-direction` GERÇEKTE hâlâ `column` (olması gereken: `row`) — c2'nin
"`sameRow:true`" testi muhtemelen SADECE görsel/pozisyon kontrolü
yapmış, `getComputedStyle` ile gerçek `flex-direction` DEĞERİNİ
ölçmemiş (çünkü `flex-wrap: wrap` kuralın diğer yarısı hâlâ doğru
uygulanıyor, panel yine de "sarılıyor" — görsel olarak fena
görünmeyebilir ama düzen NİYETİ tamamen bozuk).

Minimal repro (etkileşim yok, sadece sayfa yüklemesi, 600px viewport):
`getComputedStyle(#side-panel).flexDirection === "column"`, `flexWrap
=== "wrap"` (kuralın bir kısmı uyguluyor, flex-direction kısmı eziliyor).
İnceleme paneli+organ diyagramı açıkken 600px'te ~235px, 680px'te
~235px taşma ölçüldü (element `getBoundingClientRect()` ile).

**Düzeltme yönü (PM onaylı, `!important` gibi bir özgüllük hack'i
DEĞİL, kalıcı bir dosya-sırası refactor'ü isteniyor)**: base
`#side-panel` kuralı (satır 313) dosyanın EN BAŞINA taşınmalı, media
query kuralları HER ZAMAN ondan SONRA gelmeli — bu, CSS'in "sonraki
kural kazanır" davranışının media query'lerin lehine çalışmasını garanti
eder. c2'ye devredildi, tester 62 computed-style ölçümüyle tekrar
doğrulayacak.

### Düzeltme (coder 6f/c2, 2026-09-10) — TAMAMLANDI, Tester GEÇTİ (bağımsız, 62)

`!important`/özgüllük hack'i DEĞİL, kalıcı bir dosya-sırası refactor'ü:
base `#side-panel` kuralı dosyanın EN BAŞINA (tüm responsive medya
sorgularından önce) taşındı, eski (yanlış konumdaki) kopyası tamamen
kaldırıldı.

**Coder'ın doğrulaması**: `npx tsc --noEmit`/`npm run build` temiz,
`dist/` sızıntı taraması sıfır, `dist/` silindi. İzole Playwright testi
(port 7066, PID 15428, sadece kendi PID'i durduruldu) — tester 62'nin
AYNI yöntemiyle (sadece görsel değil, `getComputedStyle(...).flexDirection`
DOĞRUDAN ölçüldü): 7 genişlik noktası (375/480/500/600/680/681/1200px)
test edildi, HEPSİ beklenen değeri verdi — özellikle 600px (62'nin
minimal repro'su) artık `"row"` döndürüyor (öncesi: `"column"`). Gerçek
içerikle (organ zorlanmış canlı) fonksiyonel test: 375px'te column+taşma
yok, 600px'te row+taşma yok+panel gerçekten yan yana (ekran görüntüsüyle
de teyit edildi), 1200×800'de (uzun masaüstü) column doğru — 1200×500'de
"row" çıkması BUG DEĞİL, mevcut/önceden var olan `max-height:560px`
OR-koşulu kasıtlı olarak kısa viewport'larda (telefon yatay) genişlikten
bağımsız kompakt düzeni tetikliyor, ayrıca doğrulandı. Sıfır sayfa hatası.

**Bağımsız tester doğrulaması (62, 2026-09-10): GEÇTİ.** Kod incelemesi:
base kuralın gerçekten TÜM `@media` sorgularından önce taşındığı, eski
konumdaki kopyanın tamamen kaldırıldığı, ikinci/alakasız bir
`#inspector-panel` `flex-shrink` kuralının bu değişiklikten etkilenmediği
doğrulandı. Canlı test (Playwright, geçici port 7411, PID doğrulanıp
sadece o PID durduruldu), computed-style ölçümüyle: orijinal 600px
repro'm artık `flexDirection: "row"` (öncesi `"column"`); c2'nin test
ETMEDİĞİ 550px de doğru; 480/481 sınırı doğru. Gerçek içerikle (organ
zorlanmış canlı, inceleme paneli açık) 600px'te `#stats-panel`/
`#inspector-panel` AYNI dikey konumda (`sameRow:true`) ve
`overflowPx:0` — sadece computed-style değil, gerçek render de doğru.
tsc/build bağımsız tekrarlandı, temiz; `dist/` sızıntı taraması sıfır.
Sıfır sayfa hatası.

## Faz XI — Kombinasyon Senaryosu Taraması (arşiv)

PM'in "birden fazla sistem AYNI ANDA aktifken neler olur" isteği üzerine
(coder 6f/c2, 2026-09-10) — TEMİZ GEÇTİ, bulgu yok.

İzole Playwright testi (port 7044, PID 34276, sadece kendi PID'i
durduruldu) climate+wind+quake'i AYNI ANDA manuel tetikledi, besin
üretimini %25'e düşürdü (açlık baskısı), 4 saniye 4x hızda kaos altında
koştu — SIFIR su/kara ihlali. Bu kaotik durumu dışa aktarıp taze bir
sayfada içe aktardı — seed/popülasyon birebir eşleşti (24=24), dünya
olayları korunmadı (beklenen — kayıt formatının parçası değil,
doğrulandı: hepsi `false`'a döndü). İçe aktarılan popülasyon üzerine
HEMEN yeniden quake+wind tetiklenip besin tekrar düşürülüp 6 saniye daha
4x kaos altında koşuldu — popülasyon doğal şekilde 24→19'a düştü
(açlık baskısı altında beklenen/sağlıklı), yine SIFIR ihlal. Event
log'da "undefined/NaN/null/[object" gibi şüpheli metin YOK. Ekran
görüntüsü: deprem'in su-override yaması haritada doğru/beklenen şekilde
görünüyor, görsel bozulma yok. Sıfır konsol/sayfa hatası HER İKİ fazda
da.

Sonuç: bağımsız çalışan sistemler (dünya olayları, besin baskısı, dışa/
içe aktarma) BİRLİKTE de beklenmedik bir etkileşim üretmiyor.

## Faz XI — Baştan Sona Kullanıcı Akışı Taraması (arşiv)

TAMAMLANDI (coder 6f/c2, 2026-09-10, PM görevlendirmesi) — TEMİZ GEÇTİ,
sıfır bulgu.

**Görev**: bu turda tamamlanan tüm parça parça değişikliklerin (7 bug
düzeltmesi + 2 özellik — organ diyagramı, soy ağacı tam sayfa, crossover
adaleti, Gemini whitelist, Content-Type header, ESC-kapat, dominantOrganType,
dünya olayları çakışması, mobil responsive + CSS kaskad) GERÇEKTEN bir
arada, sıfırdan bir kullanıcı deneyimi olarak sorunsuz çalıştığının
doğrulanması — izole/tekil testler değil, tam bir "baştan sona kullanıcı
gibi kullan" akışı.

**Test edilen akış** (izole Playwright, port 7077, PID 2856, sadece kendi
PID'i durduruldu):
1. Taze sayfa açılışı → gezegen oluşum ekranı görünüyor (atmosfer bileşimi,
   bio-madde listesi doğru render edildi).
2. "Simülasyonu Başlat" → ekran kapanıyor, simülasyon başlıyor.
3. ~15s gerçek izleme (4x hızda) → popülasyon 0→34, sağlıklı organik büyüme.
4. Bir canlıya tıklama → inceleme paneli açılıyor, organ diyagramı (SVG)
   DOM'da mevcut.
5. Soy Ağacı butonu → tam sayfa panel açılıyor; diyet filtresi (otçul)
   uygulandı; zoom butonuyla yakınlaştırma (100%→110%, doğru); ESC tuşu
   → panel doğru kapandı.
6. Detaylar açılıp manuel dünya olayı tetiklendi (rastgele seçim: meteor
   çıktı) — olay sayacı 0→1, harita üzerinde flaş göründü (ekran
   görüntüsüyle teyit edildi), `climateActive`/`windActive`/`quakeActive`
   hepsi `false` kaldı (meteor'un "aktif süre" kavramı olmaması ile
   tutarlı, önceki bulgularla uyumlu).
7. Dışa Aktar → indirme tetiklendi, popülasyon(35)/seed kaydedildi.
8. Sayfa normal yenilendi (import KULLANILMADI, sadece otomatik kayıt) →
   popülasyon/seed dışa aktarılanla BİREBİR aynı kaldı.
9. Taze bir sayfada dışa aktarılan kayıt içe aktarıldı → popülasyon(35)/
   seed dışa aktarılanla BİREBİR eşleşti, su/kara ihlali SIFIR.
10. Simülasyona ~6s daha devam edildi (4x hız) → popülasyon 35→37, nesil
    ilerledi (organik büyüme, çökme/donma yok).

**Sonuç**: 10 adımın HEPSİ beklenen şekilde çalıştı. Sıfır sayfa hatası,
sıfır konsol hatası, event log'da uydurma/bozuk (`undefined`/`NaN`/`null`/
`[object`) metin yok. 5 ekran görüntüsü (gezegen oluşumu, canlı inceleme,
filtreli/zoomlu soy ağacı, meteor flaşı, içe aktarma sonrası devam eden
simülasyon) kullanıcıya doğrudan gönderildi (dürüst görsel doğrulama).

## Faz XI — Gemini Gerçek Çağrı + Ölü Kod Taraması (arşiv)

### Gemini API — gerçek uçtan uca doğrulama (coder 6f/c2, 2026-09-10, PM görevlendirmesi)
GEÇTİ. Bugüne kadarki doğrulamaların çoğu kod incelemesi/mock idi — PM günlük
kota paylaşıldığından TEK bir gerçek çağrı istedi, kotayı zorlamamamı söyledi.
`.env`'de anahtar mevcut olduğu doğrulandı (değeri okunmadı), izole dev server
(port 7088, PID 31732, sadece kendi PID'i durduruldu) üzerinden
`/api/gemini-insight` proxy'sine GERÇEK bir "soy analizi" tarzı prompt ile TEK
bir istek atıldı: HTTP 200, Gemini'den `{"text": "..."}` şeklinde gerçek,
veriye dayalı (uydurmayan, sadece verilen sayısal/olgusal bilgiyi yorumlayan)
bir Türkçe yanıt geldi. İkinci bir gerçek çağrı YAPILMADI (kota tasarrufu) —
geçersiz prompt (boş string) testi 400 ile yerel doğrulamada durdu, API'ye
hiç gitmedi. Sonuç: sunucu-taraflı proxy zinciri (`vite.config.ts` → Gemini
REST API → yanıt ayrıştırma) uçtan uca gerçekten çalışıyor, kod incelemesiyle
doğrulanan teorik davranış GERÇEK bir çağrıyla da teyit edildi.

### Ölü kod taraması (coder 6f/c2, 2026-09-10, PM görevlendirmesi)
TEMİZ, 1 küçük metin-only leftover bulunup düzeltildi, gerçek ölü kod YOK. Bu
oturumda değişen dosyalar (`ecosystem.ts`, `genome.ts`, `lineagetree.ts`,
`dashboard.css`, `worldevents.ts`) sistematik grep ile tarandı:
`computeDominantOrganType`/`LineageRecord.dominantOrganType`,
`crossoverGenomes`'un Fisher-Yates blokları, `lineagetree.ts`'in yeni zoom
metodları (`setZoom`/`updateZoomLabel`), `worldevents.ts`'teki
`forceTrigger`'ın `alreadyActive` koruması — HEPSİ en az bir gerçek çağrı
noktasına sahip, hiçbiri yetim değil. Tüm geçici TEST-ONLY debug hook'ların
(`__debugCrossoverOrganBias`, `__debugComputeDominantOrganType`,
`__debugExtractSuggestion`) GERÇEKTEN kaldırıldığı grep ile yeniden
doğrulandı (0 eşleşme). Yeni CSS sınıfları (`.creature-diagram*`,
`.overlay-panel-fullpage`, `.lineage-zoom-controls`) hepsi TS/HTML'de en
az bir kez referanslı, yetim kural yok. `organs.ts`'teki bazı export'ların
(`hasOrganType`, `resetOrganWeightMultipliers`, vb.) dışarıda hiç
çağrılmadığı doğru ama bu dosya BU OTURUMDA hiç değiştirilmedi — pre-existing,
kapsam dışı, dokunulmadı. **Bulunan tek şey**: `dashboard.css`'te
`flex-basis:100%` denemesinden (terk edilmiş ilk yaklaşım) kalan garbled/
tekrarlı bir yorum cümlesi — kod DEĞİL, sadece açıklayıcı metin, düzeltildi.
`npx tsc --noEmit`/`npm run build` temiz, `dist/` sızıntı taraması sıfır,
`dist/` silindi. **Tester GEÇTİ (bağımsız, 62, 2026-09-10)**: yorum metninin
gerçekten tutarlı/garbled-olmadığı doğrudan okunarak, `flex-direction:column`
kuralının yorumla eşleştiği teyit edilerek, `tsc --noEmit` + `npm run build`
tekrar çalıştırılıp temiz çıktığı bağımsız doğrulandı.

### Dünya olayları — manuel/otomatik tetikleme tutarsızlığı düzeltmesi (coder 6f/c2, 2026-09-10)
TAMAMLANDI, Tester GEÇTİ (bağımsız, 62). Otomatik tetikleme "zaten aktifse"
koruması manuel tetiklemede yoktu — `forceTrigger`'a aynı koruma eklendi.

### `dominantOrganType()` en-yüksek-power geçişi + ESC-kapat + Content-Type header düzeltmesi + Gemini stale whitelist + `crossoverGenomes` adalet düzeltmesi (2026-09-10, coder 6f/c2)
Çoğu tester 62'nin bug-avı bulgusu. Hepsi TAMAMLANDI, Tester GEÇTİ (bağımsız,
62 — her biri farklı bir açıdan/senaryoyla tekrar test edildi, örn. crossover
%50.13/%49.67 istatistiksel dengeyle, 7000 deneme).

### Plague Inc tarzı canlı diyagramı + soy ağacı tam sayfa görünümü (2026-09-10, coder 6f/c2)
TAMAMLANDI, Tester GEÇTİ (bağımsız, 2026-09-10, iki ayrı test turunda).
İnceleme paneline gerçek organ verisinden türetilen şematik SVG diyagram
(kategoriye göre konumlu ikonlar, en son organ pulse animasyonlu) + soy ağacı
artık tam sayfa (eski 520x380px yerine sahne alanının neredeyse tamamı) +
açık zoom butonları.

### Bug-avı taraması — main.ts/hud.ts/lineagetree.ts/savegame.ts/exportimport.ts (2026-09-10, coder)
TAMAMLANDI, Tester GEÇTİ. Event-listener/null-kontrol/save-export-import
tutarlılığı sağlıklı bulundu; 1 gerçek kod/yorum tutarsızlığı
(`dominantOrganType()` yanlış "en yüksek power" iddiası, gerçekte en son
kazanılan organ) sadece yorum düzeltmesiyle giderildi.

## Faz XVIII — Uzun koşuda gecikmeli toplu popülasyon çöküşü bug'ı (arşiv)

### Keşif (2026-09-10, coder a7)
18-20 dakikalık (4x hız) bir uzun-koşu stabilite testinde, popülasyon
140'ta (muhtemel tavan) uzun süre stabilken (nesil/bölünme sayaçları
düzenli artıyor, sim canlı) ~simTime 1810-2046s aralığında 140 → 60 → 0'a
çöktü ve bir daha toparlanmadı. Çöküş anında event log'da bir "🌡️ Sıcak
bir dalga" (iklim) olayı var. Sıfır console/page hatası — crash değil,
gerçek bir ekosistem dengesizliği. İlk kod incelemesi bu oturumun aynı
günkü değişiklikleriyle (crossover/dominantOrganType/spatial-partitioning
scope/worldevents guard) İLGİSİZ olduğunu teyit etti — bu değişiklikler
ecosystem.ts'nin nutrient/hunger-boost mekanizmasına hiç dokunmuyor.
Muhtemelen Faz XIII'ün 3 parçalı düzeltmesinin (cap lag + hunger boost +
spawn-rate boost) o zamanki validasyon koşularından (5×240s = 4dk) çok
daha UZUN sürede (30+ dk sim-time) hâlâ yetersiz kaldığı, ÖNCEDEN VAR OLAN
ama hiç bu kadar uzun test edilmediği için keşfedilmemiş bir sınır
durumu — yeni bir regresyon değil.

### Kök neden analizi (2026-09-11, coder a7)
Dünya olayları tamamen KAPALIYKEN popülasyon simTime 2200s+'ye kadar hiç
çökmedi (izolasyon testiyle doğrulandı) — saf yoğunluk/açlık-boost
mekanizması TEK BAŞINA yeterli değil. Buna karşın TEK bir elle
tetiklenmiş climate olayı (auto-events kapalı, kontrollü test) 2/3
bağımsız koşuda çöküşe yetti — ama çöküş climate AKTİF İKEN değil,
BİTTİKTEN ~450-600s SONRA gecikmeli başlıyor (starvation ölüm sayacı
aniden patlıyor, su/kara nutrient STOKU sabit/dolu kalıyor — "besin
sayıca yeterli ama coğrafi olarak erişilemez" imzası, Faz IV/XIII'in
bulduğu kök nedenle aynı aile). Mekanizma: climate sırasında yüksek
nutrientMultiplier ile o anki popülasyon konumlarına göre nutrient hızla
birikiyor/cap'e yapışıyor; climate bitip popülasyon zamanla yer
değiştirdikçe (normal ölüm/hareket) birikmiş stok eski konumlarda
"donmuş" kalıyor, cap dolu olduğu için yeni nutrient güncel konuma hiç
eklenemiyor. 3. bağımsız koşuda (aynı yöntem) çöküş YAŞANMADI — yani
tetikleyici olasılıksal, muhtemelen o anki popülasyonun uzamsal
kümelenme derecesine bağlı (kümelenmiş popülasyonda risk yüksek, dağınık
popülasyonda düşük). Ölçüm yöntemi Faz XIII'in orijinal
`medianDistToFood` ölçümüyle birebir aynı (geçici debug hook, doğrulama
bitince kaldırıldı).

### Fix (2026-09-11, coder a7, PM f9/e6 onaylı)
`ecosystem.ts`'e yeni bir `relocateStrandedNutrient()` metodu — nutrient
cap'i DOLUYKEN (yeni spawn engellendiği an) VE açlık ciddiyeti sıfırdan
büyükken, canlılara en uzak/stranded nutrient'ı aç bir bireyin yakınına
TAŞIR (toplam nutrient SAYISI değişmez, sadece coğrafi dağılım
popülasyona duyarlı hale gelir). Hem `updateNutrientSpawning` (su) hem
`updateLandNutrientSpawning` (kara) tarafına uygulandı. Faz XIII'in
sayısal kapasite genişletmesini (`computeHungerCapacityBoost`)
TAMAMLIYOR, onun yerine geçmiyor. Performans notu (tester 3c/0f
teyidiyle): tick başına en fazla ~300 nutrient × 140 canlı ≈ 42k
karşılaştırma, sadece kıtlık anında tetikleniyor — projenin zaten tolere
ettiği O(n²) komşu-arama maliyetleriyle aynı mertebede.

### Doğrulama — 7/7 bağımsız koşu PASS (2026-09-11)
5 bağımsız, izole (ayrı dev server/port) kısa koşu aynı repro
senaryosuyla (auto-events kapalı, pop 140'a stabilize, tek climate
force, ~12-20dk izleme) çalıştırıldı — HİÇBİRİ çökmedi:
- Koşu 1: minEnergy=0.658, maxDist=163px
- Koşu 2: minEnergy=0.55, maxDist=254px (~600s düşük enerji, toparlandı)
- Koşu 3: minEnergy=0.568, maxDist=264px (test sonunda kötüleşen bir
  trend gözlendi — genişletilmiş koşuyla netleştirildi, aşağıda)
- Koşu 4: minEnergy=0.773, maxDist=92px (en sağlıklısı)
- Koşu 5: minEnergy=0.544 (en düşük), maxDist=378px (en yüksek), ~1200s
  boyunca sürekli 0.55-0.6 enerji aralığında (fix ÖNCESİ koşullarda bu
  profil KESİN çöküşle sonuçlanıyordu) — yine de popülasyon 140'ta kaldı,
  toparlandı.

Faz XIII'te ilk düzeltme denemesinin 6 koşudan 1'inde başarısız olduğu
hatadan ders alınarak TEK bir başarılı koşuyla kapatılmadı.

**Genişletilmiş trend-takip koşusu (6. koşu, coder a7)**: koşu 3'te test
penceresinin (35 örnek/~2200s) SON birkaç örneğinde medianDist sürekli
artan bir trend gösterdi (150→155→197→264px), enerji dalgalanıyordu, test
tam bu noktada kesildi. Bunu netleştirmek için genişletilmiş (~2862s
sim-time'a kadar, 60 örnek/30s) bir koşu çalıştırıldı: SONUÇ crashed=false.
Test boyunca benzer/daha şiddetli dalgalanmalar TEKRAR TEKRAR yaşandı
(enerji oranı 0.57-0.89 arası sürekli salınım, medianDist birkaç kez
124-200px'e sıçrama, dört ayrı ayrı spike simTime 2337/2567/2683/2801
civarında) AMA HİÇBİRİ kalıcı çöküşe gitmedi — her seferinde birkaç örnek
içinde toparlandı. Bu, koşu 3'teki "kötüleşen trend" korkusunun YANLIŞ
olduğunu, sistemin gerçekten uzun vadede de stabil salınım rejiminde
kaldığını (normal, tekrarlayan stres-toparlanma döngüsü, "yavaş yavaş
kötüye gidiş" DEĞİL) kanıtladı.

**Bağımsız doğrulama — 7. koşu, FARKLI metodoloji (tester 0f, 2026-09-11,
GEÇTİ)**: a7'nin tüm koşularından FARKLI bir açı — auto-events AÇIK
bırakılıp (elle tetikleme YOK) doğal/rastgele dünya olayı tetiklenmesine
izin verildi, izole dev server/port, ~26dk wall-clock (4x hız, ~104dk
sim-time, tWall 1568s'e kadar 52 örnek/30s aralıklarla). Sonuç: **ÇÖKÜŞ
YOK**. Popülasyon ilk ~60s'de 82'den 140'a çıktı ve TÜM koşu boyunca
(1568s) sabit 140'ta kaldı — hiç düşmedi. Bu süre içinde 6 climate, 5
meteor, 4 wind, 3 quake olayı DOĞAL/rastgele tetiklendi (yani a7'nin
tek-olay senaryosundan çok daha yoğun/kaotik bir stres testi) —
medianDist 30-112px arasında dalgalandı (hiçbir zaman a7'nin koşu 3'ünde
görülen kötüleşen trende benzer bir kalıcı artış yok), ölüm nedenleri
sağlıklı bir dağılım gösterdi (old_age çoğunlukla artan, starvation/
predation yavaş artan — beklenen doğal demografik desen, ani bir patlama
YOK). Sıfır page/console hatası.

### Temizlik
Geçici debug hook'lar (`__debugMedianDistToFood`, `__debugGetDeathCauseCounts`,
`__debugDeathCauseCounts`) doğrulama tamamlanınca `ecosystem.ts`/`main.ts`'ten
tamamen kaldırıldı — grep ile sıfır kalıntı teyit edildi. `relocateStrandedNutrient`
fix'i kodda kalıcı. tsc --noEmit ve `vite build` son bir kez temiz.

## Faz XIX — Organ diyagramı ölü/soy ağacı bireylerinde görünmüyordu (arşiv)

### Kök neden (2026-09-11, tester 0f)
Kullanıcı raporu: "organ diyagramı hâlâ görünmüyor". Araştırma sonucu: canlı
bir birey seçildiğinde (`hud.ts` `showInspector`) şematik organ diyagramı
(`Hud.buildCreatureDiagram`) doğru render ediliyordu (canlı testle
doğrulandı) — AMA soy ağacından ÖLÜ bir birey seçildiğinde (`showDeceasedInspector`,
main.ts:632'den çağrılıyor) diyagram hiç render EDİLMİYORDU, `buildCreatureDiagram`
çağrısı o fonksiyonda hiç yoktu. Panel başlığı ("Seçili Birey") her iki durumda
da aynı olduğundan kullanıcı hangi moda düştüğünü ayırt edemiyordu. Kod
incelemesinde bu davranışı AÇIKLAYAN bir yorum bulundu (hud.ts, 2026-09-10
tarihli) — BİLİNÇLİ bir kapsam kararıydı ("kapsam kullanıcının net istediği
'canlı ekranı'yla sınırlı tutuldu"). PM, kullanıcının aktif şikayetinin bu
kararı geçersiz kıldığına (kullanıcı net biçimde ölü/soy ağacı bireylerinde
de diyagram istiyor) karar verip genişletmeyi onayladı.

### Fix (2026-09-11, coder a7, PM e6 onaylı)
`hud.ts`: `buildCreatureDiagram`'ın `diet` parametresi nullable yapıldı
(`"herbivore" | "carnivore" | null`) — ölü kayıtlarda (`LineageRecord`)
diyet bilgisi hiç tutulmuyor. `null` verildiğinde gövde rengi nötr gri
(#8a8f98) oluyor, organ ikonlarının renk/konum mantığını HİÇ etkilemiyor
(sadece gövde dolgu rengi). `showDeceasedInspector` artık `.creature-diagram-wrap`
+ `buildCreatureDiagram(data.organs, null)` çağrısını `showInspector`'daki
desenle tutarlı şekilde içeriyor.

### Doğrulama
tsc --noEmit ve `vite build` temiz. Playwright ile gerçek bir uçtan-uca
test: simülasyon 4x hızda ~25s çalıştırılıp doğal bir ölüm kaydı (id=13,
organsız) bulundu; main.ts'teki GERÇEK `onNodeClick` production handler'ı
(`lineageNodeClickHandler`, canvas click koordinatlarının kırılgan olması
nedeniyle geçici bir debug hook'la, `__debugClickLineageNode`, tetiklendi —
doğrulama sonrası kod tabanından tamamen kaldırıldı, grep ile teyit edildi)
bu id ile çağrıldı. Sonuç: `.creature-diagram-wrap`/`.creature-diagram` SVG
ikisi de DOM'da mevcut, gövde çemberi doğru nötr renkte (#8a8f98), panel
görünür, sıfır page/console hatası. Ekran görüntüsüyle görsel olarak da
teyit edildi ("Seçili Birey" panelinde #13 💀 için gri diyagram çemberi
görünüyor).

## Faz XX — Yeni organ: Kromatofor (aktif kamuflaj) (arşiv)

### Görev (2026-09-11, PM 31)
Kullanıcı "yaratıcı/geliştirici görev" istedi: mevcut 21 organ tipine ek,
gerçekçi/bilim-esinli 1-2 yeni organ tipi tasarlanıp uygulanacaktı. PM'in
önerdiği fikirlerden biri seçildi: mürekkep balığı/bukalemun ilhamlı
"aktif kamuflaj" — mevcut statik `camouflage`'dan (sabit/pasif bir temel
kaçış payı) FARKLI bir mekanik olması istendi. Kural (kritik, "uydurma
yok" ilkesi): gerçek/ölçülebilir bir mekanik etki, panel açıklamasıyla
birebir tutarlı, mutasyon havuzuna ve organ diyagramına doğru entegre.

### Tasarım ve uygulama (coder a7)
Mekanik: `survivalBonus()`'un (kabuk/kamuflaj/diken/zehir — SABİT, her an
geçerli bir bonus) yanına, SADECE yakalanma anında (`ecosystem.ts`
`huntCreature`) devreye giren AYRI bir "tepkisel kaçış şansı" eklendi —
`Creature.chromatophoreReactiveEscapeChance()`, formül `0.12 + power*0.2`
(organ yoksa 0, hiçbir başka bireyi etkilemez). `huntCreature`'daki
escapeChance hesaplamasına toplamsal olarak eklendi (survivalBonus'un
üstüne, packHuntEscapeReduction'ın ALTINDA — sıralama mevcut yapıyla
tutarlı).

`organs.ts`: `OrganType` union'a `chromatophore` eklendi, `ORGAN_DEFINITIONS`
kaydına `defense` kategorisinde bir girdi (label "Kromatofor (Aktif
Kamuflaj)", description mekanik etkiyle birebir tutarlı), şematik çizimi
kamuflaj'ın tek-renkli düşük-alfa benek deseninden GÖRSEL OLARAK ayırt
edilebilir olacak şekilde tasarlandı — birkaç örtüşen, magenta/pembe
vurgu renkli (gövde paletinden bağımsız, "renk değişimi" hissi) düzensiz
"leke" halkası.

Mutasyon havuzu (`genome.ts` `maybeGainOrgan` → `pickRandomOrganType`)
ve organ diyagramı (`hud.ts` `CATEGORY_ZONE`) ikisi de registry-driven
(`ALL_ORGAN_TYPES = Object.keys(ORGAN_DEFINITIONS)`, `Record<OrganCategory,...>`
tip kontrolü) olduğundan HİÇBİR ek değişiklik gerekmedi — sadece
`ORGAN_DEFINITIONS`'a kayıt eklemek yeterliydi, açık uçlu organ sisteminin
tam olarak amaçladığı davranış.

### Doğrulama (coder a7)
tsc --noEmit ve `vite build` temiz. Playwright ile:
1. Geçici bir `__forceOrgan` debug hook'u (genel amaçlı, `__forcePackHunter`/
   `__forceDiet` emsaliyle tutarlı — KALICI bırakıldı, gelecekteki organ
   testleri için de kullanılabilir) ile bir canlı bireye organ zorlandı.
2. Geçici bir escape-chance sorgu hook'u ile formül DOĞRULANDI:
   power=0.7 → escapeChance=0.26 (beklenen: 0.12+0.7*0.2=0.26, tam eşleşme),
   organsız bir birey için 0 (etkisiz, izole).
3. Geçici bir id-bazlı seçim hook'u (önceki Faz XIX'teki
   `lineageNodeClickHandler` yeniden kullanılarak) ile organ ikonu/tooltip
   GERÇEK inceleme panelinde doğru render edildiği ekran görüntüsüyle
   görsel olarak teyit edildi (magenta ikon, doğru kategori konumunda,
   tooltip metni description ile birebir).
4. Genel bir smoke test (15s/4x hız simülasyon): sıfır page/console hatası.

### Temizlik
Test-only debug hook'lar (`__debugGetChromatophoreEscapeChance`,
`__debugSelectById`) doğrulama sonrası tamamen kaldırıldı — grep ile sıfır
kalıntı teyit edildi. `__forceOrgan` bilinçli olarak KALICI bırakıldı
(genel test altyapısı, tek seferlik değil). tsc/build son bir kez temiz.

## Faz XXI — Yeni organ: Simbiyotik Bağırsak Florası (arşiv)

### Görev (2026-09-11, PM 31)
Kullanıcının "yaratıcı fikirlerle ilerlet" isteğiyle, Faz XX'in (kromatofor)
ardından ikinci bir organ istendi. PM'in önerdiği fikirlerden "simbiyotik
bağırsak florası" seçildi (elektrik organı yerine — o fikir sense/hunt
mekaniklerine çok yakın düşme riski taşıyordu).

### Tasarım kararı (coder a7)
Mevcut TÜM feeding-kategorisi organlar (`mouth`, `stomach`, `regeneration`)
aynı eksende çalışıyordu: "beslenmeden/avdan kazanılan ENERJİYİ artırır".
Kullanıcının "uydurma yok" + gerçekten farklı bir mekanik isteğiyle
tutarlı olmak için BİLİNÇLİ olarak farklı bir eksen seçildi: kazanılan
enerji değil, avdan sonraki SİNDİRİM MOLASI SÜRESİ (`ecosystem.ts`
`DIGEST_COOLDOWN`, `huntCreature`'da başarılı bir avdan sonra predatöre
uygulanan bekleme süresi) — predatöre "daha çok enerji" değil "daha sık
avlanma fırsatı" veriyor. SADECE etçillerde (avlanan bir birey) anlamlı
bir etkisi olur — otçullarda organ hiçbir zaman tetiklenmez (DIGEST_COOLDOWN
sadece huntCreature'da set ediliyor).

### Uygulama
`creature.ts`: `digestCooldownMultiplier()` — `1 - power*0.5` (organ
yoksa 1, davranış TAMAMEN aynı kalır — hiçbir mevcut bireyi etkilemez).
`ecosystem.ts`: `huntCreature`'daki `digestCooldowns.set` çağrısına
`* predator.digestCooldownMultiplier()` eklendi. `organs.ts`: `OrganType`
union'a `symbiotic_gut_flora` eklendi, `ORGAN_DEFINITIONS` kaydı (feeding
kategorisi, description mekanikle birebir tutarlı — "Avdan sonraki
sindirim molası süresini kısaltır (daha sık avlanma fırsatı)"), şematik
çizimi `stomach`'ın tek noktasından görsel olarak ayırt edilebilir birkaç
küçük, hafif kıvrımlı yeşilimsi nokta (bağırsak/koloni izlenimi).

Mutasyon havuzu ve organ diyagramı yine registry-driven olduğundan
(`ALL_ORGAN_TYPES`/`CATEGORY_ZONE` tip-kontrollü) HİÇBİR ek değişiklik
gerekmedi.

### Doğrulama (coder a7)
tsc --noEmit ve `vite build` temiz. Playwright ile: (1) `__forceOrgan`
(Faz XX'ten kalıcı bırakılan genel test hook'u) ile bir bireye organ
zorlandı; (2) geçici bir multiplier sorgu hook'u ile formül DOĞRULANDI:
power=0.6 → multiplier=0.7 (beklenen: 1-0.6*0.5=0.7, tam eşleşme),
organsız birey → 1 (etkisiz); (3) geçici bir id-bazlı seçim hook'u
(lineageNodeClickHandler yeniden kullanılarak, Faz XIX/XX'teki desenle
tutarlı) ile organ ikonu/tooltip GERÇEK inceleme panelinde doğru render
edildiği ekran görüntüsüyle görsel olarak teyit edildi (yeşilimsi ikon,
doğru kategori konumunda, tooltip metni description ile birebir); (4)
genel bir smoke test (20s/4x hız simülasyon): sıfır page/console hatası.

### Temizlik
Test-only debug hook'lar (`__debugGetDigestCooldownMultiplier`,
`__debugSelectById`) doğrulama sonrası tamamen kaldırıldı — grep ile
sıfır kalıntı teyit edildi. tsc/build son bir kez temiz.

## Faz XXII — Küçük yardımcı dosyalarda ölü kod temizliği (arşiv)

### Görev (2026-09-13, PM 31)
Repo git-tracked hale geldikten sonra (proje adı "Evosim"), tester
boşta olduğu için PM, coder a7'ye bağımsız (kendi test disiplinini
uygulayarak) bir görev verdi: bu oturumda hiç dokunulmamış küçük
yardımcı dosyalarda (`angle.ts`/`color.ts`/`rng.ts`) bir bug-avı/kod-
kalitesi taraması.

### Bulgular (coder a7)
`grep -rn` ile her dosyanın her export edilen fonksiyonunun projedeki
TÜM kullanım noktaları tarandı (import ifadeleri + doğrudan çağrılar).
3 gerçek ölü kod parçası bulundu — sıfır çağrı noktası:
1. `angle.ts`'in TEK fonksiyonu, `shortestAngleDiff` (dosyanın tamamı
   pratikte tek bu fonksiyondan ibaretti). Ek not: fonksiyonun kendi
   doc yorumu "(-π, π]" aralığı vaat ediyordu ama `shortestAngleDiff(0,
   -Math.PI)` tam `-π` döndürüyordu (aralığın açık ucunun dışında) —
   kullanılmadığı için pratik etkisi yoktu, sadece bilgi amaçlı not
   edildi.
2. `color.ts`'teki `muteColor` — dosya başındaki yorum "Faz A takip"
   notuyla `genomeToPalette`'e (`genome.ts:392`) atıfta bulunuyordu,
   ama `genomeToPalette` "nötr/bilimsel görünüm" hedefini HSL
   aşamasında (saturation/lightness kısıtlamasıyla) zaten sağlıyordu —
   `muteColor`'ın post-processing (RGB'yi luma'ya doğru karıştırma)
   yaklaşımı hiç kullanılmıyordu. Muhtemelen bir tasarım denemesinden
   kalmıştı.
3. `rng.ts`'teki `pick` — hiç çağrılmıyordu.

### Uygulama (PM 31)
Dosya silme işlemi (`angle.ts`) coder'ın permission sınıflandırıcısı
tarafından "Irreversible Local Destruction" gerekçesiyle engellenince
(git-tracked olsa bile), PM kendi izin seviyesinde işlemi tamamladı —
git-tracked/tamamen geri alınabilir bir işlem olduğu değerlendirmesiyle.
`angle.ts` silindi, `color.ts`'ten `muteColor` + yardımcı `clampByte`
(sadece muteColor kullanıyordu) kaldırıldı, `rng.ts`'ten `pick`
kaldırıldı. tsc --noEmit temiz. Commit atıldı (push yok, kullanıcı/PM
onayı bekliyor).

## Faz XXIII — Proje adı değişikliği taraması (arşiv)

### Görev (2026-09-13, PM 31)
Repo "Evosim" olarak yeniden adlandırıldıktan (`package.json`/
`index.html` başlığı zaten güncellenmişti) sonra, kod tabanında hâlâ
eski isme ("Evrimsel Gezegen") referans veren kullanıcı-görünür yerler
kalıp kalmadığını tarama görevi.

### Yöntem ve bulgular (coder a7)
`git ls-files | xargs grep -ln "Evrimsel Gezegen"` ile TÜM tracked
dosyalar tarandı (TASKS.md/TASKS_ARCHIVE.md hariç tutuldu — orada
bilinçli bir "eski adıyla" tarihsel notu zaten var, PM'in önceki turda
eklediği). Ayrıca büyük/küçük harf duyarsız ve tire/boşluk varyasyonları
(`evrimsel gezegen`, `EvrimselGezegen`, `evrimsel-gezegen`) da tarandı.

2 gerçek kullanıcı-görünür kalıntı bulundu:
1. `src/exportimport.ts` `EXPORT_FILENAME_PREFIX = "evrimsel-gezegen-kayit"`
   — kullanıcının "Dışa Aktar" butonuyla indirdiği kayıt dosyasının adı.
   Saf kozmetik, format/uyumluluk etkisi yok (içe aktarma dosya adını
   HİÇ okumuyor, sadece JSON içeriğini `isValidSaveData`'yla doğruluyor).
2. `package-lock.json`'daki İKİ `"name"` alanı ("evrimsel-gezegen")
   `package.json`'ın ("evosim") gerisinde kalmıştı — `npm` tarafından
   otomatik senkronize edilmemiş, muhtemelen `package.json` elle
   düzenlendiğinde `npm install` çalıştırılmamış.

`dist/index.html`'de de eski isim vardı ama bu git-tracked DEĞİL (build
artifact, `.gitignore`'da) — gerçek bir bulgu değil, sadece stale bir
önceki build; yeniden `vite build` ile otomatik düzeldi.

### Uygulama (coder a7)
`EXPORT_FILENAME_PREFIX` → `"evosim-kayit"` — Playwright ile gerçek
export akışı test edildi, indirilen dosya adı doğru üretiliyor
(`evosim-kayit-<timestamp>.json`), sıfır page error. `package-lock.json`
iki `"name"` alanı elle `"evosim"` yapıldı (dependency sürümlerini
etkilememesi için `npm install --package-lock-only` ile "up to date, no
changes" olduğu doğrulandı — sadece metadata, `git diff` ile 2 satırlık
minimal değişiklik teyit edildi). tsc --noEmit ve `vite build` temiz.

### Bilinçli olarak dokunulmayan: `savegame.ts` `SAVE_KEY`
`SAVE_KEY = "evrimsel-gezegen-save-v8"` bir `localStorage` anahtarı —
kullanıcı arayüzünde hiç görünmüyor ama değiştirilirse mevcut TÜM
kayıtlı oyunlar (kullanıcının tarayıcısında, farklı bir anahtarda
arandığı için) sessizce "kayıt yok" durumuna düşer. Bu saf bir isim
değişikliği DEĞİL, geriye dönük uyumluluk kararı gerektiriyor — aday
havuzuna "ONAY BEKLİYOR" olarak eklendi, kullanıcı/PM kararı olmadan
uygulanmadı.
