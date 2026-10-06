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
```

## Yapı

| Dosya | İş |
| --- | --- |
| `src/sim.ts` | Simülasyon çekirdeği. DOM'a dokunmaz, sabit adımlı (1/30 sn), tek tohumlu rastgelelik. |
| `src/genome.ts` | Genom, mutasyon, çaprazlama, genetik uzaklık, karar ağı. |
| `src/organs.ts` | 37 organ. Her açıklama `sim.ts` içindeki gerçek mekaniği anlatır. |
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
"Kaynaklar" altında ve `src/chemistry.ts` içinde yazılıdır.

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
**Yapı inceleme** ekranı (birey kartında "Yapıyı incele", Genel sekmesinde "Hücre yapısını
incele") canlıdan kabuk kesitine, tek bir moleküle ve atomun elektron kabuklarına iner.

## Simülasyonda neler var

- **Bitki örtüsü gerçek bir üreticidir:** bitkiler var olanların yanında çoğalır, yer dolunca
  durur (yerel lojistik büyüme) ve tohum yağmuruyla yayılır; hız mevsime ve iklime bağlıdır.
- **Yedi beslenme biçimi:** fotosentetik, otçul, parazit, süzücü, hepçil, çürükçül, etçil.
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
- **Coğrafi yalıtım:** sıradağlar kanatsızlar için geçilmezdir.
- **Gün–gece ve mevsimler**, iklim dalgaları, rüzgâr, deprem, meteor.
- **Türleşme:** genetik uzaklığa dayalı; tür adları, soy ağacı ve tür başına nüfus eğrisi.

## Arayüz

Varsayılan görünüm yalnızca gözlem içindir. Elle müdahale araçları (bitki ek, canlı yerleştir,
meteor, kaldır, olay tetikleme, bitki verimi, seçili bireyin organlarını ve düzeyini düzenleme)
"Dünya ayarları" altındaki **Oyun modu** açılınca görünür. Bunların dışında: dönen DNA zinciri, tür kartı, organ tablosu, olay günlüğü, soy ağacı, zaman yolculuğu
(60 sn'de bir kayıt, en çok 24), dışa/içe aktarma. claude.ai üzerinde yayımlanan sürümde
tür ve birey kartlarındaki "Claude analizi" ölçülen verileri Claude'a yorumlatır.

## Deneme adresi

https://erdemwilkinson.github.io/evosim/ — `docs/index.html` dosyasından sunulur.
Yeni sürüm yayımlamak için: `npm run build`, `dist/index.html` dosyasını `docs/` altına
kopyala, commit + push.

## Bilinen sorunlar

- **Kaynaklar:** dergi makalelerinin 65'i de Crossref kaydıyla karşılaştırıldı (yazar, yıl, dergi,
  cilt, ilk sayfa tutuyor). Kitaplar (Schulze-Makuch & Irwin 2008, de Duve 1991, Cairns-Smith
  1982, Oparin 1938, Haldane 1954) bu yolla kontrol edilemedi.
- **Kimya seçimi basit bir kuraldır:** "gereken elementler varsa aday olur" mantığı kullanılır;
  basınç, çözünürlük ya da tepkime enerjisi hesaplanmaz. Molekül çizimleri şematiktir.
- **Organ malzemeleri şematiktir:** 37 organın her birinin kendi malzemesi ve molekül çizimi
  var, ama bunlar Dünya'daki karşılıklarından uyarlanmış yalın modellerdir ve organ malzemelerinin
  kaynak künyesi yoktur. Gezegende gereken element yoksa organ genel liften yapılmış gösterilir.
- **Beslenme dengesi tohumdan tohuma oynar:** 12 tohum × 4000 sn denemede parazitler ortalama
  %0–3 (tepe %25), süzücüler %11–35, çürükçüller %2–24 pay aldı; tek tek koşularda bir grubun
  kısa süreli olarak nüfusun çoğunu oluşturduğu anlar hâlâ görülüyor.

- **Claude analizi ve dosya indirme hiç denenmedi.** İkisi de yalnızca claude.ai üzerindeki
  artifact sürümünde çalışır; GitHub Pages sürümünde analiz bölümü yerine açıklama notu
  çıkar, kayıt dosyası ise tarayıcının kendi indirmesiyle iner.
- **Elle sınanmayanlar:** araçlar, organ ekleme/kaldırma, düzey değiştirme, kayıt indirme ve
  yükleme otomatik tarayıcı betiğiyle (masaüstü ve telefon genişliği) sınandı; gerçek bir
  telefonda dokunarak sınanmadı.
- **Soy ağacı dar ekranda:** tür adları çizginin sağında kalır; telefonda görmek için ağacı
  yana kaydırmak gerekir.
- **Yakın görünümde arazi:** harita 1600 px genişliğinde bir kez boyanır; en yakın
  yakınlaştırmada sıradağ kenarları basamaklı görünür.
- **Eşeyli üreme nadir kalır:** erkeklerin doğurmaması eşeysiz üremeye karşı dezavantaj
  yaratır; koşularda nüfusun yalnızca küçük bir kısmı eşeylidir.
- **Tek atadan başlangıç garanti değildir:** ilk hücrenin soyu erken ölürse ya da nüfus
  sonradan 8'in altına düşerse dışarıdan ilkel canlılar gelir ve artık herkes tek atadan
  gelmez (12 tohumluk denemede 1 kez oldu). "Çöküşte dışarıdan göç" ayarı kapatılabilir.
- **Kalıtım yapısı eşiği:** sayısal bir gen, aralığının %2'sinden az kaydıysa "değişmedi"
  sayılır; eşik keyfîdir.
- **Eski kayıtlar:** sürüm 2 kayıtları açılır, ama harita artık kimyadan üretildiği için arazi
  farklıdır; yaşayamayacağı yerde kalan canlılar sığ sıvıya taşınır. Sürüm 1 kayıtları açılmaz.
- **Yalnızca koyu görünüm vardır;** açık tema kaldırıldı.
- **Simülasyon çekirdeği için otomatik test yok:** denge yalnızca `npm run balance`
  çıktısına bakılarak ayarlandı.

## Bilinen sınırlar

- Karar ağı tek katmanlıdır; derin bir sinir ağı değildir.
- Gezegen kimyasının simülasyona etkisi dengeyi bozmamak için küçük tutulmuştur (bkz. "Gezegen kimyası").
- Stres altında diyet mutasyonunun yönü ağırlıklıdır; bunun gerçek biyolojide karşılığı yoktur.
- Nüfus 8'in altına düşerse dışarıdan ilkel canlılar gelir (ayarlardan kapatılabilir).
