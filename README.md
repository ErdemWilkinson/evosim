# Evosim

Mikroorganizmadan başlayan, açık uçlu bir evrim simülasyonu. Canlılar zamanla
mutasyonla yeni organlar kazanır, üreyip çoğalır, avlanır/avlanılır ve
soy ağaçları boyunca gözlemlenebilir bir evrim tarihi biriktirir. Sabit bir
"evrim ağacı" sırası yok — hangi organın ne zaman ortaya çıkacağı, hangilerinin
yayılıp hangilerinin eleneceği tamamen popülasyonun/çevrenin gerçek durumuna
bağlı. Yapay zeka destekli bir evrim simulasyonu.

## Kurulum ve çalıştırma

```bash
npm install
npm run dev
```

Tarayıcıda `http://localhost:5173` (Vite'ın gösterdiği adres) açılır.

### Gemini API anahtarı (opsiyonel)

Soy analizi ("Bu soyu analiz et") özelliği Google Gemini API kullanır. Bu
özellik olmadan da simülasyonun tamamı çalışır — anahtar sadece bu tek
özellik için gerekli.

Kullanmak isterseniz proje kökünde bir `.env` dosyası oluşturup içine
kendi anahtarınızı şu şekilde ekleyin:

```
GEMINI_API_KEY=kendi-anahtarınız
```

Anahtar yalnızca sunucu tarafında (Vite dev-server middleware) kullanılır,
tarayıcıya hiçbir zaman gönderilmez.

## Diğer komutlar

```bash
npm run build    # production build (dist/)
npm run preview  # build'i yerel olarak önizle
```

## Temel özellikler

- **Açık uçlu organ sistemi**: mutasyonla kazanılan organlar (hareket, algı,
  beslenme, savunma, solunum, gezegene-özgü organlar dahil 20+ tip) genomun
  bir parçası olur ve gerçek, ölçülebilir bir mekanik etkisi vardır.
- **Soy ağacı**: her bireyin ebeveyn/çocuk ilişkisini ve organ kazanım
  geçmişini gösteren, zoom/pan destekli tam sayfa bir görünüm.
- **Dünya olayları**: iklim dalgaları, rüzgar, deprem, meteor — hem otomatik
  hem manuel tetiklenebilir, popülasyon/besin dengesini gerçekten etkiler.
- **Deterministik gezegen oluşumu**: harita seed'inden türetilen bir atmosfer/
  bio-madde özeti, hangi gezegene-özgü organların o gezegende mümkün olduğunu
  belirler.
- **Kaydet/yükle + dışa/içe aktarma**: otomatik localStorage kaydı, ayrıca
  JSON dosyası olarak indirip/yükleyebilme.
