# Bilinen sorunlar

Bölüm A (oyuncu özellikleri) için yapılan tarayıcı testinin sonucu. Test: Chrome (headless), masaüstü
1400×850 ve telefon 390×800, tohum 4242, 24× hızda ~25–70 dakikalık oyun süresi. Kod commit
`759ea23` üzerinden yeniden build edilip tekrar denendi. Aşağıdaki her madde ya ölçülmüş ya da
"doğrulanmadı" diye işaretlenmiştir.

## Açık sorunlar

### 6. Kare hızı: 500 canlı şartı doğrulanmadı
- **Ölçüm (headless, yazılım çizimi, 1400×850):** 2 canlıda 143,6 fps; 444 canlıda 16,1 fps (1×) ve
  13,8 fps (24×).
- **Sınır:** Bu ortam gerçek GPU'yu temsil etmiyor. Gerçek tarayıcıda ölçülmeli. Önceki sürümle
  karşılaştırma yapılmadı, yani düşüşün Bölüm A'dan gelip gelmediği bilinmiyor.

## Düzeltildi
- **Zaman atlamalı kayıt satırı İngilizcede Türkçe kalıyordu:** `24:14` gibi süreler iki sayı sayıldığı için
  çeviri anahtarı eşleşmiyordu; iki ve üç parçalı süre kalıpları için anahtarlar eklendi (`src/i18n.manual.ts`).
- **Gezegen kartında İngilizce "%66" biçimi:** `yüzeyin %§ sıvı` anahtarı "§% of the surface is liquid" olarak çevriliyor
  (commit `fa6b6f1`); kartta artık "66% of the surface is liquid" görünür.
- **Dönüm noktası satırı kesiliyordu:** satır artık en çok üç satıra kıvrılıyor (`src/card.ts`, `wrap`).
- **Kartta "en uzun yaşayan soy" yoktu:** yerleşmiş türler arasında en uzun varlığını sürdüren tür adı ve süresiyle eklendi.
- **Dönüm noktasına geri sarma kaba bir ana dönüyordu:** her dönüm noktasında ayrı, seyreltilmeyen anlık görüntü
  alınıyor ve "Geri al" var (commit `6dcbcb3`); ayrıca geri sarma bildirimi gösteriliyor.
- **Tarih sekmesi her çizimde `null.disabled` hatası veriyordu ve fosil kaydı hiç çizilmiyordu**
  (`src/main.ts:325` bulunmayan `#lapse-open` öğesini arıyordu). Commit `759ea23` ile giderildi.
  Yeniden test: sayfa hatası yok, 24 dakikada 5 fosil kartı göründü.

## Çalıştığı doğrulananlar (kısa)
- Dönüm noktası şeridi (5 nokta), seçme ve haritada bulma.
- Kendi soyun: işaretleme, altın halka, sayaçlar (174 yaşayan torun, 5 tür, 3 tükenen kol, 12 nesil).
- Fosil kaydı: portre, dönem, zirve, ata, ölçülmüş neden ve "dağınık nedenler" ifadesi.
- Tahmin: soru, cevap, süre sayacı, sonuç ("Doğru tahmin 1 / 1").
- Atlas: yeni gezegende ve sayfa yenilemeden sonra korunuyor; depolama engelliyken oturumluk
  uyarısı çıkıyor, hata yok.
- Gezegen kartı: PNG indirme, bağlantıyı kopyalama, bağlantının yeni sekmede aynı gezegeni açması,
  günün gezegeni (UTC, iki denemede aynı tohum).
- Ses: 24× hızda 15 sn'de 25 nota; Ses kapatılınca 0. Duyularak değil, nota sayısıyla ölçüldü.
- Zaman atlamalı kayıt: açılınca kendiliğinden oynuyor (14 dk'lık kayıt ~15 sn'de 04:04'e ilerledi);
  bellek 116 karede 230 KB, üst sınır 600 kare.
- Telefon genişliği: açılış, harita, 6 sekme, kart ve zaman atlamalı pencerede yatay taşma yok;
  konsol hatası yok.
- Gözlem kipinde müdahale araçları gizli.

## Doğrulanmadı
- Haritadaki dönüm noktası vurgusunun yüksek hızda okunabilirliği.
- Kitlesel yok oluş ve karaya çıkış dönüm noktaları (4242 tohumunda görülmedi).
- Soyun tükenmesi ve yeni soy önerisi.
- Tahminin kısa açıklama cümlesi ve ayarlardan kapatılması.
- Oyun modunda kazanılan başarımların ayrı işareti.
- Türkçe kipte yeni arayüz metinleri (dil seçicisi ayarlar panelinde; teste ulaşılamadı).
- Arayüz özelliklerinin (soy işaretleme, paneller) simülasyon durumunu değiştirmediği. `test:core`
  geçti ama bu özellikleri kapsamıyor.
- 1× hızda ses sıklığı; kalabalık ve sakin dönemin kulakla ayırt edilmesi.
- `balance:check` Bölüm A sonrası yeniden koşulmadı.
