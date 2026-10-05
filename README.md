# Evosim

Tarayıcıda çalışan, açık uçlu bir yapay yaşam simülasyonu. Yaşam sığ suda tek bir organsız
hücreyle başlar ve bütün canlılar onun soyundan gelir; organlar, beslenme biçimi, örgütlenme düzeyi ve davranış mutasyon
ve seçilimle değişir. Çalışma zamanı bağımlılığı yoktur (TypeScript + Canvas 2D).

## Çalıştırma

```
npm install
npm run build      # dist/index.html (çift tıklayınca açılır) ve dist/artifact.html
npm run dev        # http://localhost:5180, kaynak değişince yeniden derler
npm run typecheck
npm run balance -- 6000 1 2 3 --brief   # başsız denge koşusu: [saniye] [tohumlar…] [--no-rescue]
```

## Yapı

| Dosya | İş |
| --- | --- |
| `src/sim.ts` | Simülasyon çekirdeği. DOM'a dokunmaz, sabit adımlı (1/30 sn), tek tohumlu rastgelelik. |
| `src/genome.ts` | Genom, mutasyon, çaprazlama, genetik uzaklık, karar ağı. |
| `src/organs.ts` | 37 organ. Her açıklama `sim.ts` içindeki gerçek mekaniği anlatır. |
| `src/world.ts`, `src/planet.ts` | Harita (su, kıyı, sıradağlar) ve gezegen kimyası. |
| `src/host.ts`, `src/worker.ts` | Simülasyonun sahibi; Web Worker içinde çalışır. |
| `src/protocol.ts`, `src/client.ts` | Arayüz ile simülasyon arasındaki mesajlar; Worker yoksa yerel kip. |
| `src/render.ts`, `src/ui.ts`, `src/phylo.ts`, `src/main.ts` | Harita çizimi, paneller, soy ağacı, etkileşim. |

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
- **Parazitlik ve hastalık:** parazitler başka türden konağa tutunup enerjisini emer; türe
  özgü salgınlar kalabalıkta başlar ve temasla yayılır, iyileşen bir süre bağışık kalır.
- **Coğrafi yalıtım:** sıradağlar kanatsızlar için geçilmezdir.
- **Gün–gece ve mevsimler**, iklim dalgaları, rüzgâr, deprem, meteor.
- **Türleşme:** genetik uzaklığa dayalı; tür adları, soy ağacı ve tür başına nüfus eğrisi.

## Arayüz

Araç çubuğu (seç, bitki ek, canlı yerleştir, meteor, kaldır), seçili bireyin organlarını ve
düzeyini elle düzenleme, tür kartı, organ tablosu, olay günlüğü, soy ağacı, zaman yolculuğu
(60 sn'de bir kayıt, en çok 24), dışa/içe aktarma. claude.ai üzerinde yayımlanan sürümde
tür ve birey kartlarındaki "Claude analizi" ölçülen verileri Claude'a yorumlatır.

## Bilinen sınırlar

- Karar ağı tek katmanlıdır; derin bir sinir ağı değildir.
- Gezegen kimyası kurgusaldır; yalnızca iki organın ortaya çıkıp çıkamayacağını belirler.
- Stres altında diyet mutasyonunun yönü ağırlıklıdır; bunun gerçek biyolojide karşılığı yoktur.
- Nüfus 8'in altına düşerse dışarıdan ilkel canlılar gelir (ayarlardan kapatılabilir).
