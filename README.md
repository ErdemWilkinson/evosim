# Evosim

Tarayıcıda çalışan, açık uçlu bir gezegensel evrim simülasyonu. Her tohum kendi kimyasına sahip
bir gezegen üretir; yaşam o gezegenin yüzey sıvısında tek bir organsız hücreyle başlar ve bütün canlılar onun soyundan gelir; organlar, beslenme biçimi, örgütlenme düzeyi ve davranış mutasyon
ve seçilimle değişir. Çalışma zamanı bağımlılığı yoktur (TypeScript + Canvas 2D).

## Çalıştırma

```
npm install
npm run build      # dist/index.html (çift tıklayınca açılır) ve dist/artifact.html
npm run dev        # http://localhost:5180, kaynak değişince yeniden derler
npm run typecheck
npm run balance -- 6000 1 2 3 --brief   # başsız denge koşusu: [saniye] [tohumlar…] [--no-rescue]
npm run balance -- 4000 1 2 3 --summary # beslenme biçimlerinin ortalama/tepe payı ve var olduğu süre
npm run balance:check                   # denge testi: geçti/kaldı (24 tohum × 6000 sn; 1–12 geliştirme, 13–24 doğrulama)
node scripts/noise.mjs sonuc.json       # gürültü: balance:check -- --json=sonuc.json çıktısında eşiklerin tohum kümeleri arasında oynaması
npm run test:core                       # çekirdek testleri: belirlenimcilik ve kayıt gidiş-dönüşü (yaklaşık 3 dk)
```

## Yapı

| Dosya | İş |
| --- | --- |
| `src/sim.ts` | Simülasyon çekirdeği. DOM'a dokunmaz, sabit adımlı (1/30 sn), tek tohumlu rastgelelik. |
| `src/genome.ts` | Genom, mutasyon, çaprazlama, genetik uzaklık, karar ağı. |
| `src/organs.ts` | 38 organ. Her açıklama `sim.ts` içindeki gerçek mekaniği anlatır. |
| `src/chemistry.ts` | Gezegen kimyası: 22 elementten 10'u, çözücü, zar, duvar, kalıtım, enerji, katalizör, pigment, 20 köken senaryosu. |
| `src/world.ts`, `src/planet.ts` | Harita (sıvı, kıyı, sıradağlar); engebe, sıvı oranı ve dağ payı kimyadan gelir. |
| `src/inspect.ts` | Yapı inceleme ekranı (canlı → kabuk kesiti → molekül → atom) ve köken filmi. |
| `src/host.ts`, `src/worker.ts` | Simülasyonun sahibi; Web Worker içinde çalışır. |
| `src/protocol.ts`, `src/client.ts` | Arayüz ile simülasyon arasındaki mesajlar; Worker yoksa yerel kip. |
| `src/render.ts`, `src/ui.ts`, `src/phylo.ts`, `src/main.ts` | Harita çizimi, paneller, soy ağacı, etkileşim. |

## Gezegen kimyası

Her gezegen 22 elementlik havuzdan ağırlıklı rastgele 10 element alır. Bu elementlerle
kurulabilen seçenekler arasından bir yüzey sıvısı (su, amonyak, metan–etan, sülfürik asit,
formamid, hidrojen florür, hidrojen sülfür, sıvı CO₂, sıvı azot, erimiş kükürt), bir iskelet
(karbon, silisyum, bor–azot), bir zar, bir hücre duvarı, bir kalıtım polimeri, bir enerji
taşıyıcısı, bir katalizör metali ve bir ışık pigmenti seçilir; yaşamın 20 köken senaryosundan
biri de bu kimyaya uygunluğuna göre belirlenir. Her seçeneğin dayandığı yayın arayüzde
gezegen kartındaki "Kaynaklar" altında, üst çubuktaki **Kaynakça** penceresinde (80 kayıt, 71 ayrı kaynak, hepsi gruplanmış) ve `src/chemistry.ts` içinde yazılıdır.

Kimyanın simülasyona etkileri:

- Yüzey sıvısının sıcaklığı metabolizmayı, hızı ve üretici büyümesini en çok ±%13 değiştirir.
- Hücre duvarı canı, hızı ve metabolizmayı değiştirir (ör. demir-sülfür zırh: can ×1,22, hız ×0,90).
- Köken senaryosu ilk hücrenin genlerine küçük çarpanlar uygular.
- Azot yoksa azot kesesi, kükürt yoksa kemosentez organı ortaya çıkamaz.
- Haritanın engebesi, sıvı oranı, dağ payı ve renkleri element paylarından türetilir;
  üreticilerin rengi ışık pigmentinden gelir.

Kalıtım yapısı DNA olmak zorunda değildir: on seçenek vardır (RNA benzeri, sekiz harfli, treoz
ve glikol nükleik asitleri, peptit nükleik asit, amiloid şablonu, halkalı karbon istifi, kil
kristali, siloksan şerit, bileşimsel kalıtım). Her birinin kopyalama hatası çarpanı mutasyon
sıklığını ölçekler (×0,8 – ×1,8) ve kartlardaki kalıtım çizimi o yapının biçimini alır.

Yeni gezegen başlarken oynayan **köken filmi** gezegeni, seçilen köken senaryosunu (20
senaryonun her birinin kendi ortam çizimi vardır), yapı taşlarının zincirlenmesini, zarın
kapanmasını ve ilk hücrenin parçalarını altı sahnede anlatır.
Film kendiliğinden kapanmaz: "Geri" ve "İleri" düğmeleri, sahne çizgileri ya da ok tuşlarıyla
sahneler arasında gezilir (elle gezilen sahne okunana kadar bekler); son sahnenin sonunda
"Simülasyona geçmek istiyor musun?" diye sorulur. Filmdeki hücre, haritada görülecek ilk hücrenin
kendi genomuyla ve oyundaki çizimle çizilir. Son sahnede hücre ikiye bölünür; simülasyona geçilince film haritaya erir: simülasyon, ilk bölünmenin
hemen sonrasından, özdeş iki kardeş hücreyle başlar. İkisi de yeni bölünmüş hücre enerjisiyle
(azami enerjinin yarısı) başlar; toplamları bölünmeden önceki tek dolu hücrenin enerjisidir.
**Yapı inceleme** ekranı (birey kartında "Yapıyı incele", Genel sekmesinde "Hücre yapısını
incele") canlıdan kabuk kesitine, tek bir moleküle ve atomun elektron kabuklarına iner.

## Simülasyonda neler var

- **İlk yaşam ot yemez, kimyasal besin emer:** sıvıda çözünmüş kimyasal besin 40×25'lik bir
  ızgarada tutulur. Sıvı altındaki sırt çizgilerinde (bacalar) üç kata kadar zengindir, karada
  yoktur; emildiği yerde tükenir ve yavaşça yenilenir. İlk hücreler **kemotroftur** ve besinin
  en yoğun olduğu yerde belirir. Haritada besin soluk bir ışıma olarak görünür. Çürüyen leşin
  maddesinin yarısı bulunduğu yerdeki çözeltiye döner.
- **Bitki örtüsü sonradan evrilir:** başlangıçta hiç bitki yoktur. Fotosentetik bir canlı
  ortaya çıkıp yerleşik bir üretici öbeği bırakınca örtü başlar; ondan sonra bitkiler var
  olanların yanında çoğalır, yer dolunca durur ve tohum yağmuruyla yayılır. Otçulluk, süzücülük
  ve bitki yiyen öbür biçimler ondan önce tutunamaz.
- **Sekiz beslenme biçimi:** kemotrof, fotosentetik, otçul, parazit, süzücü, hepçil, çürükçül, etçil.
- **Örgütlenme düzeyi:** tek hücre → koloni → çok hücreli. Düzey organ yuvalarını (3/5/7),
  beden aralığını ve hangi organların mümkün olduğunu belirler; karaya çıkmak bacak ister,
  bacak çok hücrelilik ister.
- **Evrimleşen davranış:** her canlı 8 girdiyi 5 eyleme bağlayan tek katmanlı bir karar ağı
  taşır; ağırlıklar kalıtılır ve mutasyona uğrar.
- **Eşeyler ve eş seçimi:** eşeyli türlerde dişi, menzildeki erkekler arasından süs ×
  kondisyona göre seçer; süs metabolizmayı artırır ve avcılara görünürlüğü yükseltir; yavrunun
  maliyetinin çoğunu dişi öder.
- **Parazitlik ve hastalık:** parazitler başka türden konağa tutunup enerjisini emer; konak
  bir süre sonra paraziti atar ve bir süre dirençli kalır, zayıf konaktan daha az enerji emilir; türe
  özgü salgınlar kalabalıkta başlar ve temasla yayılır, iyileşen bir süre bağışık kalır.
- **Dengeyi geri beslemeler kurar** (bir grubu doğrudan güçlendiren ya da zayıflatan sayı ayarı
  yerine):
  - *Paylaşılan kaynak:* aynı bitki öbeğinden süzen süzücüler birbirinin payını düşürür. Leş
    zaten paylaşılır: her ısırık leşin enerjisinden düşer.
  - *Doyma ve sindirim:* etçil ve hepçil avını sindirene kadar yeniden avlanamaz; parazit, öğünü
    dolunca emmeyi bırakıp sindirir. Süre yenen miktarla orantılıdır.
  - *Sığınak:* haritanın yaklaşık beşte biri sık örtüdür (üretici pigmentinin renginde, benekli
    alanlar). Örtüdeki canlı ancak dokunacak kadar yaklaşılınca fark edilir; kıyı sığlığı ve
    bitki öbekleri kısmi örtü sağlar. Elektroreseptör örtünün içini görür. Sığınaktaki canlı
    haritada halkayla işaretlenir, üst şeritte "Sığınakta N" yazar.
  - *Tok canlı otlamaz:* bir bitkinin vereceği enerji sığmayacaksa otçul, hepçil ve çürükçül
    bitkiye yönelmez; tokken yiyip çevresini boşuna tüketmez.
  - *Sığınak büyük bedeni yavaşlatır:* sık örtüde en büyük beden hızının %65'ini kaybeder, en
    küçük beden hiç kaybetmez. Kaçan canlı, kaçış yönünün yakınında sık örtü varsa oraya
    yönelir. **Örtü biçici** organı (koloni düzeyi) bu yavaşlamayı %50–100 azaltır ve örtüde
    gizlenen avı o oranda daha uzaktan fark ettirir; bedeli bir organ yuvasıdır.
  - *Yamyamlık hastalık bulaştırır:* kendi türünü yiyen avcı, av hastaysa kesin, değilse %50
    olasılıkla türüne özgü hastalığı kapar.
  - *Parazitin ikilemi:* emiş gücü kalıtılan bir gendir. Çok emen konağını tüketir ve konak onu
    o oranda erken atar; az emen aç kalır.
  - *Sindirim yönü:* hepçil ve çürükçülün bitkiden ve etten aldığı verim tek bir gene bağlıdır;
    birinde iyileşen ötekinde kötüleşir.
- **Yumurtlama ve sürü avcılığı** yalnızca çok hücrelide ortaya çıkabilir.
- **Coğrafi yalıtım:** sıradağlar kanatsızlar için geçilmezdir.
- **Gün–gece**, iklim dalgaları, rüzgâr, deprem, meteor. Mevsim yoktur (6 Ekim 2026'da
  kaldırıldı): bitki büyümesi, fotosentez ve metabolizma artık yıl içinde salınmaz. Meteor,
  deprem ve iklim dalgası haritada gerçek zamanla akan canlandırmalarla gösterilir; simülasyon
  hızlıyken de izlenebilir.
- **Türleşme:** genetik uzaklığa dayalı; tür adları, soy ağacı ve tür başına nüfus eğrisi.

### Hücreden hücreye değişen yapı

**İlk hücre duvarsızdır.** Protohücrelerin çıplak zarla başladığı, duvarın sonradan evrildiği görüşüne uygun olarak (duvarsız L-formları: Errington 2013) her gezegende ilk hücre duvar taşımaz. Gezegenin seçtiği duvar "evrilebilecek duvar"dır; nadir yapı değiştirme mutasyonuyla (%0,4) ortaya çıkabilir. Duvarsız başlamak denge ölçümünü bozmadı (aşağıdaki tablo).

Duvar, zar, kalıtım polimeri, enerji taşıyıcısı ve katalizör merkezi artık her hücrenin kendi genomundadır. İlk hücre gezegenin seçtiği yapıyla başlar; yavrular çok nadir (mutasyon başına %0,4, kalıtım polimerinin kopyalama hatasıyla ölçeklenir) gezegenin elementlerinin kurmaya yettiği başka bir seçeneğe geçer. Gezegende olmayan elementi isteyen seçenek hiç çıkmaz. Etkiler verideki gerçek farklardır: duvar can, hız ve metabolizmayı, kalıtım polimeri mutasyon sıklığını değiştirir; zar, enerji ve katalizör farkı nötrdür, yalnızca sürüklenir. "Yapıyı incele" her hücrenin kendi yapısını gösterir ve ilk hücreden hangi bakımlardan ayrıştığını yazar; molekül düzeyi çizilmeyen hidrojenler dâhil bütün atomları sayar, atom düzeyi seçili atomun bağlı olduğu atomları gösterir. Oyun içi hücre, açılış filmindeki şematik hücreyle aynı çizilir (koyu iç, zar boncukları, kesikli duvar halkası, kalıtım spirali, katalizör metali noktaları).

Ölçüm (`node scripts/census.mjs`, hızlı mod, 6000 sn, 4 tohum): her koşuda 3–5 farklı duvar, 2–5 farklı zar ve 2–4 farklı kalıtım polimeri yaşıyor; çoğu zaman bir türü baskın, ötekiler az sayıda. Çekirdek testi (belirlenimcilik ve kayıt gidiş-dönüşü) geçti. Kayıt sürümü 10; sürüm 2–9 kayıtlar eksik alanları gezegenin ilk yapısıyla doldurarak yüklenir.

## Arayüz

Varsayılan görünüm yalnızca gözlem içindir. Elle müdahale araçları (bitki ek, canlı yerleştir,
meteor, kaldır, olay tetikleme, bitki verimi, seçili bireyin organlarını ve düzeyini düzenleme)
"Dünya ayarları" altındaki **Oyun modu** açılınca görünür. Bunların dışında: dönen DNA zinciri (bir basamağa tıklanınca o genin ne işe yaradığı, ilk canlıdaki ve şimdiki değeri açılır), tür kartı, organ tablosu, olay günlüğü, soy ağacı, zaman yolculuğu
(60 sn'de bir kayıt, en çok 24), dışa/içe aktarma. "Dünya ayarları"ndaki **Evrim hızı** üç kademelidir
(Hızlı, Orta, Gerçekçi); simülasyon sürerken değiştirilebilir ve kayıtla birlikte saklanır.

**Oyun modu düzeltmeleri:** meteorun hasarı artık çarpma anında verilir (düşüş süresi 0,6 benzetim sn; çizim bu süreyi hıza göre kısaltır), eskiden canlılar animasyon gelmeden ölüyordu. "Bitki ek" aracıyla fare ya da parmak basılı tutulup sürüklenince harita kaydırılmaz, geçilen yerlere bitki ekilir. Doğrulama: benzetimde tetikten sonra ilk ölüm 0,63 sn'de (düşüş 0,6); tarayıcıda sürükleyerek 0 → 310 bitki ekildi. Meteorun çizimi ile hasarın birebir örtüştüğü yüksek hızlarda (8× ve üstü) gözle değerlendirilmedi. Kaydedilmiş bir oyun düşüş sırasında alınırsa o meteor kaybolur.

**Yeni oyun modu araçları:** "Besin boya" (suya çözünmüş besin ekler), "Radyasyon fırçası" (çemberdeki canlıların bir kısmının genini yerinde mutasyona uğratır; kimlik, soy ve tür korunur). "Bitki ek", "Canlı yerleştir", "Besin boya", "Radyasyon fırçası" ve "Canlıyı kaldır" araçları basılı tutup sürükleyince boyar, harita kaydırılmaz. Bu araçlar için testler ayrı bir oturumda koşulacak; burada doğrulama yazılmadı.

**Müzik:** üst çubuktaki "Ses" düğmesiyle açılıp kapanır (tercih tarayıcıda saklanır). Dosya içermez, WebAudio ile üretilir (`src/audio.ts`): gezegenin tohumu anahtarı ve modu seçer, yavaş değişen akorlar bir pad üzerinde çalar, aralarda seyrek çan sesleri duyulur, gece kısılır. Simülasyondan bağımsızdır, simülasyonun belirlenimine dokunmaz. Tarayıcı kuralı gereği ilk dokunuşta başlar, sekme arka plandayken durur. Çalıştığı (ses bağlamı çalışıyor, osilatörler kuruluyor, düğme açıp kapatıyor) otomatik betikle doğrulandı; nasıl duyulduğu, ses seviyesi ve tat ise dinlenerek değerlendirilmedi.

**Dil:** Türkçe ve İngilizce. Yeni gezegen penceresinin sağ üstündeki düğmelerden ya da "Dünya ayarları"ndan seçilir; seçim tarayıcıda saklanır; ilk açılışta oyun İngilizce başlar. Kaynak metinler Türkçedir ve simülasyon çekirdeği dili bilmez; çeviri yalnızca gösterimde yapılır (`src/i18n.ts`, sözlükler `src/i18n.auto.ts` ve `src/i18n.manual.ts`), bu yüzden kayıtlar ve olay günlüğü dilden bağımsızdır ve dil değişince eski günlük satırları da çevrilir. Sözlükte olmayan metin Türkçe kalır.

**Oyuncu özellikleri (Tarih sekmesi ve çevresi).** Hepsi yalnızca gözlem verisini okur; benzetim durumunu değiştirmez. Bu bölümdeki hiçbir özellik için test koşulmadı ve tarayıcıda denenmedi: yalnızca tür denetimi (`tsc`) ve derleme yapıldı. Testler ayrı bir oturumda koşulacak.

- **Dönüm noktaları:** ilk fotosentetik, avcı, parazit, çok hücreli, karaya çıkış, eşeyli üreme ve kitlesel yok oluş; haritada kısa süre vurgulanır, zaman şeridinde işaretlenir, "Bu ana dön" ile anlık görüntüye dönülür. Kayıt sürümü 7.
- **Benim soyum:** canlı kartındaki "Soyumu işaretle" ile bir bireyin torunları haritada altın halkayla görünür; yaşayan torun, doğan toplam, tür kolları, atadan en büyük genetik uzaklık ve nesil sayısı izlenir. Soy tükenirse bildirim gelir. Soy kayıtla saklanır.
- **Fosil kaydı:** kalıcılaşmış bir tür tükenince portresi, yaşadığı dönem, zirve nüfusu ve atası saklanır. Tükenme nedeni yalnızca ölçülmüş son 12 ölümden okunur: bir neden en az %60 payla baskınsa yazılır (en az 5 ölüm kaydı varken), yoksa "Tek bir belirgin neden yok" denir. Ölüm kayıtları türle birlikte saklanır; eski kayıtlarda boş başlar.
- **Tahminler:** yaklaşık 90 benzetim saniyesinden sonra bir türün birey sayısı ya da hayatta kalması için iki dakikalık bir soru sorulur; sonuç sayılarla ve o sürede dünyada en çok ölüme yol açan nedenle açıklanır. Yüzde onun altındaki değişim sayılmaz. Ayarlardan kapatılabilir; tercih tarayıcıda saklanır. Soru sırası rastgelelik kullanmaz.
- **Atlas ve başarımlar:** görülen organlar, beslenme biçimleri, dönüm noktaları ve gezegenlerde karşılaşılan kimya seçenekleri tarayıcı depolamasında tutulur; depolama kapalıysa yalnızca oturum boyunca tutulur ve bu belirtilir. 13 başarım yalnızca gözlemle kazanılır; Oyun modu açıkken kazanılanlar ayrıca işaretlenir.
- **Gezegen kartı ve bağlantı:** kart bir tuvale çizilir (harita, elementler, kimya, varsa dünyanın özeti) ve PNG olarak kaydedilir. Adres çubuğunun `#` kısmı tohumu ve üç ayarı taşır; paylaşılan bağlantı açılınca gezegen penceresi o tohumla açılır, mevcut kayıt silinmez (pencere kapatılırsa kayıt geri yüklenir). "Günün gezegeni" UTC tarihinden türetilen bir tohum verir. Üçüncü taraf bir adrese hiçbir şey gönderilmez.
- **Olay sesleri:** doğum, av, yeni tür ve yok oluş, müziğin dizisinden notalarla kısa sesler olarak karışır. Aynı tür ses için en kısa aralık hızla uzar; iki saniyede en çok dört ses çalar. "Ses" düğmesi müzikle birlikte hepsini susturur.
- **Zaman atlamalı kayıt:** her 6 benzetim saniyesinde canlıların konumu (9 bayt/canlı) ve beslenme sınıfı kaydedilir; 600 kareye gelince her ikinci kare atılır ve aralık ikiye katlanır. En kötü durumda (500 canlı, 600 kare) hesaplanan bellek yaklaşık 2,6 MB'tır; bu bir hesaptır, tarayıcıda ölçülmedi. Gerçek değer oynatma penceresinde yazar. Yaklaşık 60 saniyede oynatılır.

**Yeni mekanikler (Bölüm C).** Altısı da çekirdek testini geçti (belirlenimcilik ve kayıt gidiş-dönüşü, 3 tohum × 600 sn). Her biri 24 tohum × 6000 sn (Hızlı) ölçüldü; sonuçlar aşağıda ve "Testler ve ölçüm" bölümündedir. Kayıt sürümü 10; eski kayıtlar ve eski karar ağları yeni düzene taşınır.

- **Renk kamuflajı (C1):** avcının algı menzili, avın gövde tonu o an bulunduğu zeminin tonuna uyduğu ölçüde en çok %35 kısalır (uyumun karesiyle; örtüde söner). Zemin rengi haritayı çizenle aynı koddan (`src/ground.ts`) okunur. Ton farkı çembersel. Organ kamuflajıyla bağımsız çarpılır, örtü dışında toplam gizlenme en çok %54,5. Ölçüm: eşikler geçti, ama canlıların tonunun yaşam alanının tonuna yaklaştığı görülmedi (önce ve sonra aynı eğri); etkisi bu sürede ölçülebilir değil. Mekanik koyu temadaki palete bağlıdır.
- **Yaşamla değişen atmosfer (C2):** oksijen artık üreticilerin (bitki ve ışıkla beslenen canlılar) enerji stokunun tüketicilere oranının kendi uzun vadeli ortalamasından sapmasına tepki verir (±0,15). Önceki saf salınım kalktı. Ölçüm: oksijenin tohumlar arası standart sapması 0,003'ten 0,034'e çıktı (yani gezegenler artık birbirinden ayrışıyor); bir koşunun içindeki oynama (sd ≈ 0,085) yaklaşık aynı kaldı.
- **Simbiyoz (C3):** tehdit altındaki ışıkla beslenen küçük canlı, yakındaki daha büyük (etçil ve parazit olmayan) bir konağa tutunabilir; konak onu avcıdan saklar, o fazla enerjisini konağa verir; konak yavaşlar. Ölçüm: 24 tohumun 24'ünde simbiyoz görüldü, canlı-örneklerin %15'inde en az bir simbiyont vardı. Konağın ortalama enerji oranı 0,71, ötekilerin 0,69; fark küçük, konağa belirgin bir yük ya da kazanç görülmedi.
- **Gerçek büyüme (C4):** yavru küçük doğar, yeterince tokken büyür ve bunun bedelini enerjiyle öder; aç kalan yavru bodur kalır ve geç ürer. Boy, metabolizmayı, hızı ve av-avcı boy karşılaştırmasını etkiler. Ölçüm: canlı-örneklerin yaklaşık %5'i yavru; bodur kalan yalnızca 11–23 örnek (1,4 milyon içinde). Yani bodurluk mekaniği pratikte neredeyse hiç tetiklenmiyor; yavrular neredeyse hep yeterince besleniyor.
- **Akıntılar (C5):** sıvıda eş-derinlik eğrileri boyunca dolanan bir akıntı alanı canlıları (küçüklere daha çok) ve çözünmüş besini taşır. "Akıntıları göster" ayarı okları çizer. Ölçüm: eşikler geçti; akıntının dağılıma ayrıca bir etkisi ölçülmedi.
- **Koku izi (C6):** avcı olmayan canlılar gövdeleriyle orantılı iz bırakır; iz zamanla söner, sıvıda ve sık örtüde daha çabuk. Av göremeyen aç avcı en güçlü iz yönüne döner. Ölçüm: eşikler geçti; izin avlanma başarısına etkisi ayrıca ölçülmedi.
- **Hafıza ve çağrı (C7):** karar ağına hafıza ve çağrı girdileri, "çağır" eylemi ve bir hafıza satırı eklendi. Başlangıçta bağlantıların hepsi 0'dır; davranış mutasyonla evrimleşir. Bedeller: çağıran durur, 1,5 kat enerji yakar ve avcıya daha uzaktan görünür. Ölçüm: çağrı davranışı canlı-örneklerin %0,74'ünde görüldü (11 066 / 1 492 829). Bu yalnızca kullanıldığını gösterir; çağrının hayatta kalmaya yardım edip etmediği (çağrısız karşılaştırma) ölçülmedi.

**Başlangıç menüsü.** Kayıtlı oyun yoksa ya da yeni gezegen istenirse sayfa tam ekran bir menüyle açılır: Evosim'in ne olduğunu anlatan beş tanıtım slaytı kendiliğinden döner (noktalardan seçilebilir), arkada süzülen hücreler birbirine çarpar (esnek çarpışma), boş bir yere ya da bir düğmeye basılınca (basılı tutulursa daha uzun) oraya toplanır, sonra yeniden dağılır. Basılan noktada (boş yer, dil düğmeleri, Kaynakça) daire ve kare biçimleri saçılıp söner; uzuvlar yalnızca "Başla"ya basınca çıkar. "Başla"ya basınca toplar toplanmaz: oldukları yerde titreyip organ çıkarır, bir kısmı mutasyonla renk değiştirir; Başla düğmesinden çıkan uzuvlar en yakın dört hücreye uzanıp saplanır ve enerjilerini çekmeye başlar (~2,4 sn), sonra menü aşağı doğru sönerek gezegen ekranına geçilir; bekleme sırasında "Başla"ya bir kez daha basmak geçişi hemen yapar. "Başla" gezegen penceresine, "Kaynakça" kaynak listesine götürür. Dil seçimi menüde de var. "Başla" gezegen penceresine götürür, orada çarpıya ya da Esc'ye basmak menüye döner (gezegen başlamaz). Menü açıkken oyun arayüzü ilk karesinden itibaren gizlidir (yenilemede görünüp kaybolmaz), oyun açılınca yumuşakça gelir. Adres çubuğu hep çalışan dünyanın tohumunu taşıdığı için sayfa yenilenince aynı tohumun kaydı varsa oyun doğrudan kaldığı yerden açılır; farklı bir tohumun bağlantısı gelirse eski gezegen penceresi ve "kayıt geri yüklenir" notu çıkar. Kayıt geri yüklenen oturumlarda ve paylaşım bağlantılarında menü atlanır. Masaüstü ve 390 px genişlikte tarayıcıda denendi (taşma ve konsol hatası yok); gerçek telefonda denenmedi.

**Karşılama sorusu.** Gezegen oluşturma ekranı açılınca Erdem imleci gelir (Rehber bir kez bitirilene ya da kapatılana dek her açılışta; "Hayır" yalnızca o oturum için hatırlanır) ve "Simülasyona yeni başlıyor gibisin, yardım edeyim mi?" diye sorar; yanıtlanana kadar arkadaki hiçbir yere basılamaz. Evet: Rehber başlar ve önce bu ekranı anlatır (tohum, rastgele, günün gezegeni, harita, gezegenin kimyası, dil), sonra oyunu kendisi başlatıp köken filmini atlar ve oyunun içini gezdirir. Hayır: imleç "Simülasyonu başlat" düğmesini gösterir ve çekilir; oyunda Rehber düğmesi parlar (Rehber kendiliğinden açılmaz). Rehber artık Yapı penceresini de kendisi açıp gezdirir (dört düzey, kabuk kesiti, molekül, atom ve komşu atomlara geçiş) ve kapatır.

**Yeni gezegen penceresi.** 900 px ve üstü genişlikte yatay açılır: solda başlık, tohum ve harita, sağda gezegenin elementleri ve özellikleri (üç sütun); 1366×768 ve 989×863 ekranda kaydırma gerekmez. Telefonda eskisi gibi dikey ve kaydırmalıdır.

**Rehber.** Üst çubuktaki "Rehber" düğmesi, "Erdem" yazılı hayalet bir fare imlecini başlatır (41 adım; oyun içinden başlatılınca gezegen ekranı adımları atlanır): imleç hız düğmelerine, yakınlaşmaya, bir canlıya, sekmelere ve Oyun düğmesine kendisi tıklar, ne işe yaradıklarını anlatır; "Yapıyı incele", Soy ağacı, Kaynakça, Kayıt ve Yeni gezegen gibi pencere açanları yalnızca gösterir. İleri/Geri/Kapat ve ok tuşları, Esc ile çıkış çalışır; bitince hız, oyun modu, sekme ve seçim eski hâline döner. İlk açılışta düğme parlar. Telefonda kart imlecin tersi yönde durur. Genom bölümünü de öğretir: Birey sekmesindeki gen şeridini, bir basamağa tıklayınca açılan gen kartını (aynı basamağa ya da ✕'e basınca kapanır), renklerin anlamını (ilk canlıdan kalan, mutasyonla değişen, yeni organ geni) ve mutasyonun rastgele, seçilimin çevreden geldiğini; oyundaki genomun gerçek bir nükleotit dizisi değil, sayısal özellikler ve karar ağı ağırlıkları listesi olduğunu açıkça söyler. Tarayıcıda masaüstü ve 390 px genişlikte (genom adımları yalnızca masaüstünde) adımların tamamı otomatik gezildi, konsol hatası ve yatay taşma yok; gerçek telefonda denenmedi.

**Yapı inceleme, yakınlaşmalı.** Düzeyler arası geçiş artık animasyonludur: kabuk kesitinde duvara, zara ya da hücre içine (kalıtım polimeri; katalizör noktalarına) dokununca görüntü o yapıya yakınlaşıp moleküle geçer; bir atoma dokununca atoma yakınlaşılır; üst düzey düğmeleriyle aynı yolla uzaklaşılır (hareket azaltma tercihinde geçiş anlıktır). Üstünden geçilen katman vurgulanır. Organlar da aynı yolu izler: parça listesinden bir organ seçilince "Organ kesiti" açılır (üstte organın canlıdaki yeri, altta malzemesinin doku düzeyinde nasıl dizildiği: mineral levhalar, lif demetleri ya da damlacıklar), dokuya dokununca molekül ve atom düzeyine inilir.

## Testler ve ölçüm

İki ayrı test vardır; ikisi de simülasyonu tarayıcısız, Node'da koşturur.

**Çekirdek testleri** (`npm run test:core`, `scripts/core.mjs`) iki güvenceyi sınar:

- *Belirlenimcilik:* aynı tohum ve ayar iki koşuda bire bir aynı durumu verir.
- *Kayıt gidiş-dönüşü:* koşunun ortasında kaydedilip yüklenen simülasyon, kaydedilmeden devam
  edenle bire bir aynı durumda biter.

Karşılaştırma tam durum üzerindendir (her canlının konumu, enerjisi, genomu ve zamanlayıcıları;
bitkiler, leşler, yumurtalar, türler, üreteç durumu) ve yuvarlama payı yoktur. Sonuç
(6 Ekim 2026): 3 tohum × 600 sn, Hızlı ve Gerçekçi kademelerde 18 denetimin 18'i geçti.
Bu test yazıldığında gidiş-dönüş kalıyordu, çünkü kayıt konumları yuvarlıyor; leşleri, deprem
bölgelerini, sindirim ve karar zamanlayıcılarını taşımıyordu. Kayıt sürüm 5 ile eksiksiz hâle
getirildi. Aynı sırada bir hata da çıktı: kayıt yüklenince türlerin birey sayısı sıfırdan
başlıyordu (245 canlılık bir kayıtta yüklemeden sonra yaşayan tür sayısı 26 yerine 0); sayı
artık yüklenen canlılardan sayılıyor.

**Denge testi** (`npm run balance:check`, `scripts/check.mjs`) bir termometredir, ayar düğmesi
değil: 24 tohumu (1–12 geliştirme, 13–24 doğrulama; eşikler iki küme için ayrı sütunlarda) 6000 sn koşturur ve şu eşiklere bakar (otçul hepsinde hariçtir; ilk hücre
otçuldur ve birincil tüketici besin ağının tabanıdır):

1. Baskınlık: hiçbir beslenme biçimi tohumların yarısından fazlasında ortalama %60'ı geçmez.
2. Kalıcılık: her biçim tohumların en az yarısında sürenin en az %30'unda vardır.
3. Hiçbir tohumda yaşam tükenmez.
4. Tohumların en az yarısında çok hücreli, en az birinde karaya çıkış görülür.
5. Patlama: bir biçimin anlık payı (nüfus en az 20 iken) tohumların yarısından fazlasında
   %90'ı geçmez. İlk ölçümden sonra eklendi: ortalama pay, etçillerin bir ara nüfusun tamamını
   oluşturduğu anları gizliyordu.
6. Çöküş: nüfusun 8'in altına düşüp dışarıdan göç gerektirdiği tohumlar yarıyı geçmez. İlk
   ölçümden sonra eklendi: göç yaşamı yeniden başlattığı için 3. eşik çöküşü göremiyordu.

### 24 tohumluk ölçümler (7 Ekim 2026)

Hepsi 24 tohum × 6000 sn; 1–12 geliştirme, 13–24 doğrulama. Hücreler: geliştirme / doğrulama / tümü sonucu. Ham çıktılar `out/` altındadır (git dışı); koşucu `scripts/check.mjs`.

| Koşu | Kademe | Sonuç |
| --- | --- | --- |
| Bölüm B | Hızlı | GEÇTİ / GEÇTİ / GEÇTİ |
| Bölüm B | Orta | GEÇTİ / GEÇTİ / GEÇTİ |
| Bölüm B | Gerçekçi (yavaş) | KALDI (2) / KALDI (1) / GEÇTİ |
| C1–C7 (her mekanik eklendikten sonra) | Hızlı | hepsi GEÇTİ / GEÇTİ / GEÇTİ |
| Güncel kod (hücre kimyası geni, basınç, kaçış düzeltmesi) | Hızlı | GEÇTİ / GEÇTİ / GEÇTİ |
| Güncel kod + ilk hücre duvarsız | Hızlı | GEÇTİ / GEÇTİ / GEÇTİ (tükenen 0, çok hücreli 24/24, karaya çıkış 24/24) |

*Gerçekçi kademe:* geliştirme kümesinde parazit kalıcılığı (4/12) ve çok hücreli görülme (5/12) kaldı; doğrulama kümesinde etçil kalıcılığı (5/12) kaldı; 24 tohumun tümünde geçti. Yani bu kademede eşiklere yakın ve kümeye göre oynuyor. Gerçekçi kademede ilk görülme zamanları uzun: çok hücrelilik ve karaya çıkış birçok tohumda 3000–5800. saniyelerde ya da hiç görülmüyor; bu kademe 6000 sn'de yeterince koşmamış sayılabilir.

*Gürültü (`scripts/noise.mjs`, güncel koddan önceki 96 tohumluk Hızlı koşu, 4 küme × 24):* eşik sayıları kümeler arasında en çok 2–5 tohum oynadı (ör. otçul kalıcılığı 19–23/24, göç gereken tohum 0–2). 96 tohumun 1'inde (tohum 80) yaşam bir ara tükendi olarak işaretlendi (koşu sonunda nüfus 262; dışarıdan göçle toparlanmış olabilir, ayrıca incelenmedi). Rastgele 24'lük bir çekilişin bütün eşikleri geçme olasılığı bu veride %74. Bu, "24 tohumda geçti" sonucunun tek bir çekilişte yaklaşık dörtte üç olasılıkla yinelendiği anlamına gelir.

### Taban ölçümü ve güncel durum

> Aşağıdaki tablo eski 8 tohumluk ölçümdür ve iki kardeş hücreli başlangıçtan (680829e) öncesine
> aittir; 24 tohumluk koşucuyla yenilenmedi. O koddaki 96 tohumluk ölçümde (Hızlı, 6000 sn)
> 24 tohumluk kümeler arasında "göç gereken tohum" 8–13, "yaşamın tükendiği tohum" 1–3 arasında
> oynadı; 96 tohumun 8'inde soy ilk 300 saniyede tükendi. Güncel kod için tam ölçüm sürüyor.

Taban ölçümü 6 Ekim 2026'da, evrim hızı ayarı girdikten sonra ve dengeleyici mekaniklerden
("fren" commit'leri) önce alındı; `scripts/balance-log.json` içinde `taban-fast`,
`taban-medium`, `taban-slow` etiketleriyle durur (günlüğe 0ddfe33 ile girdi, ölçülen kod
3aba30c ile aynıdır). Güncel sütunlar beş fren commit'inden sonraki koddur (d891d55). Hepsi 1–8 tohumları × 6000 sn.
Hücreler: sekiz tohumun ortalama payı / herhangi bir tohumdaki en yüksek anlık pay / var olduğu
sürenin ortalaması (%).

| | Taban Hızlı | Güncel Hızlı | Taban Orta | Güncel Orta | Taban Gerçekçi | Güncel Gerçekçi |
| --- | --- | --- | --- | --- | --- | --- |
| Fotosentetik | 3 / 19 / 73 | 3 / 30 / 74 | 3 / 30 / 63 | 4 / 25 / 73 | 1 / 9 / 27 | 1 / 15 / 44 |
| Otçul | 44 / 100 / 94 | 45 / 100 / 94 | 55 / 100 / 96 | 52 / 100 / 96 | 61 / 100 / 91 | 73 / 100 / 100 |
| Parazit | 2 / 51 / 66 | 4 / 84 / 62 | 2 / 64 / 51 | 3 / 67 / 53 | 1 / 28 / 24 | 0 / 6 / 23 |
| Süzücü | 24 / 95 / 85 | 13 / 63 / 77 | 19 / 98 / 74 | 20 / 98 / 77 | 27 / 85 / 68 | 14 / 58 / 45 |
| Hepçil | 5 / 73 / 67 | 9 / 85 / 72 | 4 / 69 / 51 | 3 / 48 / 48 | 5 / 100 / 28 | 1 / 31 / 29 |
| Çürükçül | 10 / 66 / 74 | 14 / 83 / 76 | 7 / 66 / 59 | 14 / 88 / 77 | 2 / 44 / 33 | 8 / 57 / 50 |
| Etçil | 12 / 100 / 72 | 12 / 100 / 76 | 10 / 100 / 61 | 6 / 97 / 53 | 3 / 51 / 23 | 2 / 56 / 32 |
| Çok hücreli görülen tohum | 8/8 | 8/8 | 8/8 | 6/8 | 4/8 | 4/8 |
| Karaya çıkış görülen tohum | 8/8 | 8/8 | 8/8 | 8/8 | 7/8 | 6/8 |
| Dışarıdan göç gereken tohum | 6/8 | 3/8 | 3/8 | 2/8 | 1/8 | 1/8 |
| Yaşamın tükendiği tohum | 0 | 0 | 0 | 0 | 0 | 0 |
| **Sonuç** | **KALDI (2)** | **GEÇTİ** | **GEÇTİ** | **GEÇTİ** | **KALDI (2)** | **KALDI (2)** |

Kalan eşikler:

- *Taban Hızlı:* etçil patlaması (payı %90'ı geçen tohum yarıdan fazla) ve çöküş (6/8 tohumda göç).
- *Taban Gerçekçi:* parazit ve etçil kalıcılığı (tohumların yarısından azında sürenin %30'unda var).
- *Güncel Gerçekçi:* parazit ve hepçil kalıcılığı. Olası neden: bu kademede beslenme değişimi
  beş kat seyrek olduğu için yeni bir biçim 6000 sn içinde çoğu tohumda geç ortaya çıkıyor;
  bu bir tahmindir, ilk görülme zamanı ölçülmedi.

Güncel Hızlı sütunu bu depoda 6 Ekim 2026'da yeniden koşturuldu ve günlükteki
`e-sindirim-geni` kaydıyla aynı çıktı. Güncel Orta ve Gerçekçi sütunları günlükteki `son-medium`
ve `son-slow` kayıtlarından alındı; yeniden koşturulmadı. Bu iki kayıt günlüğe d891d55'ten sonra yazıldı;
hangi kod üstünde koşturuldukları günlükte yazmıyor.

Güncel Hızlı sonucu yalnızca 1–8 tohumları için geçerlidir. Dengeleyici mekanikler bu sekiz
tohumda ölçülerek geliştirildi; günlükteki `son-tohum-9-16` kaydında (9–16 tohumları, Hızlı)
bir tohumda yaşam tükendiği için test kalıyor. Bu sekiz tohum olay olay izlendi:

- *Tohum 16 (tükenme):* ilk hücre ve tek yavrusu 50. saniyede açlıktan öldü (enerji 47 saniyede
  79'dan 2,6'ya indi); ortada henüz avcı yoktu. Bu, dengeleyici mekaniklerle ilgisiz bir başlangıç
  sorunudur: ilk hücrenin yakınında yeterli bitki olması garanti değildir.
- *Tohum 11 ve 12 (göç):* 5250–5400. saniyelerde nüfusun tamamı etçildi (9–10 birey) ve
  ölümlerin çoğu avlanmaydı; yani etçiller avı bitirip birbirini yedi. Sığınak ve doyma bu
  döngüyü seyreltti (taban ölçümünde 6/8 tohum) ama ortadan kaldırmadı.

## Deneme adresi

https://erdemwilkinson.github.io/evosim/ — `docs/index.html` dosyasından sunulur.
Yeni sürüm yayımlamak için: `npm run build`, `dist/index.html` dosyasını `docs/` altına
kopyala, commit + push.

## Bilinen sorunlar

- **Zaman yolculuğu bellek kullanır:** her dönüm noktası için o anın tam kaydı ayrıca tutulur (seyreltilmez) ve "Bu ana dön" tam o ana döner; düzenli kayıtlar 60 sn aralıklı, en çok 24 tanedir ve dolunca seyreltilir. Geri sarmadan önceki durum "Geri al" için bellekte tutulur; sayfa yenilenirse ya da yeni geri sarma yapılırsa kaybolur. Otomatik kayıt geri sarılmış durumu yazar (20 sn'de bir). Her kayıt 1–3 MB tuttuğundan uzun oyunda bellek yaklaşık 100 MB'a çıkabilir; ölçülmedi.
- **Yeni besin tabanı ve son dört mekanik ölçülmedi:** kemotrof beslenme, sonradan evrilen
  bitki örtüsü, tok canlının otlamaması, sığınağın büyük bedeni yavaşlatması, örtü biçici
  organ, örtüye kaçış ve yamyamlık hastalığı 6 Ekim 2026'da eklendi. Besin tabanı için
  typecheck ve çekirdek testleri geçti, üç tohumda 3000 sn'lik koşuda yaşam tutundu; son dört
  mekanik ve mevsimlerin kaldırılması için typecheck ve çekirdek testleri koştu. Denge testi bu
  kodda koşmadı; aşağıdaki denge tabloları eski besin tabanına ve mevsimli koda aittir. Tarayıcıda
  (masaüstü ve telefon genişliği) film gezinmesi, meteor ve deprem canlandırması ve gen kartı
  denendi; yeni mekaniklerin oyundaki etkisi (sığınak, örtü biçici, yamyamlık hastalığı) izlenmedi. Besin alanının sayıları
  (kapasite, yenilenme, emiş hızı) bir bütçe hesabından seçildi, ölçülerek doğrulanmadı.
- **Beden büyür ve küçülür (yalnızca görsel):** yavru erişkinin yarısı boyunda doğar ve olgunlaşma
  süresince büyür; tokken dolgunlaşır, açken büzülür, bölününce küçülür. Simülasyondaki yarıçap ve
  çarpışma değişmez; yalnızca çizim ölçeklenir. Typecheck ve çekirdek testleri geçti, iki
  genişlikte konsol hatası ve yatay taşma yok. 441 canlıda benzetim adımı 0,32 ms sürdü
  (adım başına 33 ms bütçe); çizim süresi ve tarayıcıdaki kare hızı ölçülmedi.
- **Denge testinin eşikleri değişti:** kemotrof artık besin ağının tabanı sayılır ve baskınlık
  ile patlama eşiklerinin dışındadır; otçul kalıcılık eşiğine dahil edildi (gerekçe
  `scripts/criteria.mjs` içinde).

- **Kaynaklar:** dergi makalelerinin 65'i de Crossref kaydıyla karşılaştırıldı (yazar, yıl, dergi,
  cilt, ilk sayfa tutuyor). Kitaplar (Schulze-Makuch & Irwin 2008, de Duve 1991, Cairns-Smith
  1982, Oparin 1938, Haldane 1954) bu yolla kontrol edilemedi.
- **Kimya seçimi büyük ölçüde basit bir kuraldır:** "gereken elementler varsa aday olur" mantığı
  kullanılır; çözünürlük ve tepkime serbest enerjisi hesaplanmaz. İki istisna vardır: yüzey
  basıncı ve köken enerjisi (aşağıda). Molekül çizimleri şematiktir.
- **Yüzey basıncı yalnızca tutarlılık içindir:** 0,3–30 bar arası çekilir ve sıvının o sıcaklıkta
  sıvı kalması için gereken buhar basıncının altına inmez (Clausius–Clapeyron, sıvının referans
  noktası, buharlaşma entalpisi ve kritik sıcaklığı yuvarlak değerlerle `SOLVENT_PHASE` içinde;
  değerler NIST Chemistry WebBook'tan hatırlanıp yuvarlandı, tek tek yeniden doğrulanmadı).
  Su 2,1 bar'da 395 K'ye kadar sıvı kalır; sıvı CO₂ ancak ≥10 bar'da çıkar. 3000 gezegende sıvı
  kalmayan tohum yok. Basınç simülasyona etki etmez ve köken seçimine girmez.
- **Köken enerjisi bilgi amaçlıdır:** her köken senaryosunun ana enerji kaynağı (yıldız morötesi,
  yıldırım, yer ısısı, redoks gradyanı, çarpma, radyoaktivite, döngüler, dışarıdan gelen organikler)
  elle eşlendi, miktarı hesaplanmadı; simülasyona etki etmez.
- **Organ malzemeleri şematiktir:** 37 organın her birinin kendi malzemesi ve molekül çizimi
  var, ama bunlar Dünya'daki karşılıklarından uyarlanmış yalın modellerdir ve organ malzemelerinin
  kaynak künyesi yoktur. Gezegende gereken element yoksa organ genel liften yapılmış gösterilir.
- **Denge testi yalnızca geliştirildiği tohumlarda geçiyor:** 1–8 tohumlarında (Hızlı ve Orta)
  geçer; 9–16 tohumlarında ve Gerçekçi kademede kalır (ayrıntı "Testler ve ölçüm" bölümünde).
  Açık kalan iki sorun: etçillerin bütün avı bitirip birbirini yediği çöküşler ve ilk hücrenin
  yiyecek bulamadan öldüğü başlangıçlar.
- **Denge ölçümü gürültülüdür:** simülasyon kaotiktir; kurala eklenen tek bir rastgele sayı
  çekimi aynı tohumda bambaşka bir tarih üretir. Sekiz tohumluk ölçümde eşiğe yakın sonuçlar
  (örneğin göç gereken tohum sayısı 3–5 arasında) bir değişiklikten ötekine yer değiştirebilir.
- **Eski el ayarları duruyor:** dengeleyici mekaniklerden önce elle ayarlanmış sabitler
  (süzme hızı, leşin kalma süresi, parazitin tutunma süresi gibi) geri alınmadı.
- **Sığınak sabit bir harita katmanıdır:** örtü alanları büyümez, küçülmez, canlılar tarafından
  yok edilemez.
- **Dosya indirme yayın parçasında denenmedi.** Kayıt dosyasını indirme düğmesi yalnızca
  artifact sürümünde ayrı bir köprü kullanır; GitHub Pages sürümünde dosya tarayıcının kendi
  indirmesiyle iner.
- **Yeni oyunlar artık "Orta" evrim hızıyla başlar** (öncesinde "Hızlı"; eski kayıtlar kendi
  kademesini korur, "Dünya ayarları"ndan değiştirilebilir). Neden: gün sayacına göre canlılar
  fazla hızlı evriliyordu. Yeni mekanik eklenmedi, yalnızca var olan bir kademe seçildi.
  Ölçüm: geliştirme tohumları 1–12, Orta kademe, 6000 sn, tüm denge ölçütleri geçti (hiçbir
  tohumda yaşam tükenmedi, çok hücrelilik ve karaya çıkış 12/12). Doğrulama tohumları (13–24)
  ve 96 tohumluk gürültü ölçümü bu kademe için koşmadı.
- **İngilizce çeviri:** kimya, organ, gen ve arayüz metinleri elle çevrildi; sayı içeren olay
  cümleleri kalıplarla çevriliyor. Otomatik tarayıcı betiği (masaüstü ve telefon genişliği) film,
  paneller, soy ağacı, kayıt ve yapı inceleme pencerelerini İngilizcede gezdi ve çevrilmemiş
  metin bulmadı; ancak 8 tohumluk 2500 sn'lik koşuda çıkan olay cümleleri dışında ender olayların
  (örneğin yatay gen transferi) cümleleri bu denemede görünmedi. Dil bilgisi (ek, çoğul) elle
  gözden geçirilmedi.
- **Elle sınanmayanlar:** araçlar, organ ekleme/kaldırma, düzey değiştirme, kayıt indirme ve
  yükleme otomatik tarayıcı betiğiyle (masaüstü ve telefon genişliği) sınandı; gerçek bir
  telefonda dokunarak sınanmadı.
- **Yakın görünümde arazi:** harita 1600 px genişliğinde bir kez boyanır; en yakın
  yakınlaştırmada sıradağ kenarları basamaklı görünür.
- **Eşeyli üreme nadir kalır:** erkeklerin doğurmaması eşeysiz üremeye karşı dezavantaj
  yaratır; koşularda nüfusun yalnızca küçük bir kısmı eşeylidir.
- **Tek atadan başlangıç garanti değildir:** ilk hücrenin soyu erken ölürse ya da nüfus
  sonradan 8'in altına düşerse dışarıdan ilkel canlılar gelir ve artık herkes tek atadan
  gelmez (12 tohumluk denemede 1 kez oldu). "Çöküşte dışarıdan göç" ayarı kapatılabilir.
- **Kalıtım yapısı eşiği:** sayısal bir gen, aralığının %2'sinden az kaydıysa "değişmedi"
  sayılır; eşik keyfîdir.
- **Eski kayıtlar:** güncel kayıt sürümü 10'dur; sürüm 2–9 kayıtları açılır (9 ve öncesinde hücre kimyası alanları yoktur, gezegenin ilk yapısıyla doldurulur). Sürüm 5 ve
  öncesinde çözünmüş besin alanı yoktur; dolu başlar, kayıttaki canlılar ve bitkiler aynen yüklenir. Sürüm 2'de
  harita farklıdır (artık kimyadan üretiliyor); yaşayamayacağı yerde kalan canlılar sığ sıvıya
  taşınır. Sürüm 4 ve öncesi canlının anlık durumunu (hedefi, zamanlayıcıları), leşleri ve
  deprem bölgelerini taşımaz; bunlar varsayılanla başlar, yani eski bir kayıttan devam eden
  koşu kaydedilmeden devam edenle aynı ilerlemez. Sürüm 1 kayıtları açılmaz.
- **Kayıt büyüdü:** sürüm 5 değerleri yuvarlamadan yazar; 245–326 canlılık bir koşuda kayıt
  yaklaşık 0,7 MB'tan 1,1 MB'a çıktı (iki ölçüm aynı anda alınmadı, nüfus farklı). 441 canlıda
  (tohum 1, hızlı mod, 6000 sn) kayıt 2,7 MB ölçüldü; yeni hücre kimyası alanları ve izler de
  eklendi. Zaman yolculuğu bu kayıtlardan 24 tane bellekte tutar (yaklaşık 65 MB).
- **Yalnızca koyu görünüm vardır;** açık tema kaldırıldı.
- **Otomatik testler dardır:** çekirdek testleri yalnızca belirlenimciliği ve kayıt
  gidiş-dönüşünü sınar (bkz. "Testler ve ölçüm"); tek tek mekanikler için birim testi yoktur.
  Gidiş-dönüş testi elle müdahaleyi (Oyun modu araçları) ve Orta kademeyi kapsamaz.

## Bilinen sınırlar

- Karar ağı tek katmanlıdır; derin bir sinir ağı değildir.
- Gezegen kimyasının simülasyona etkisi dengeyi bozmamak için küçük tutulmuştur (bkz. "Gezegen kimyası").
- Stres altında diyet mutasyonunun yönü ağırlıklıdır; bunun gerçek biyolojide karşılığı yoktur.
- Nüfus 8'in altına düşerse dışarıdan ilkel canlılar gelir (ayarlardan kapatılabilir).

## Telif ve kullanım

© 2026 ErdemWilkinson. Tüm hakları saklıdır. Depo yalnızca oyunun barındırılması ve okunabilmesi için
herkese açıktır; izinsiz kopyalama, yeniden yükleme, satma ya da dağıtma yasaktır (ayrıntı için
`LICENSE`). Oyunu tarayıcıda oynayabilir ve bağlantısını paylaşabilirsiniz. Bu bir kopyalama
engeli değil, hukuki bir bildirimdir: tarayıcıda çalışan bir oyunun kodu oyuncunun bilgisayarına
inmek zorundadır, teknik olarak tamamen gizlenemez.
