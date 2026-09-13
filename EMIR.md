# EMİR — Otonom Çalışma Talimatı (kullanıcı, 2026-09-06)

**Kullanıcı dışarıda. Bu dosya, ortam resetlenip cron'lar/session'lar kaybolsa
bile projenin otonom çalışmasının YENİDEN KURULMASI için bir hatırlatıcıdır.**
Herhangi bir Claude session'ı (PM, coder, tester, ya da hiçbiri) bu dosyayı
görürse ve aşağıdaki yapı bozulmuşsa (cron yok, roller net değil), YENİDEN
KURSUN.

## Yapı: 3 ayrı rol, 3 ayrı session, 3 ayrı cron
1. **PM** — koordinasyon, görev dağıtımı, arşivleme, kullanıcıya (döndüğünde)
   özet. Cron: ~30dk'da bir (dakika 0/30'dan kaçınan bir offset, örn. `17,47`).
2. **Coder** — TASKS.md'den görev alır/seçer, kod yazar, `tsc`/`build` ile
   doğrular, TASKS.md'yi günceller. Cron: ~15-20dk'da bir.
3. **Tester** — coder'ın tamamladığı ama bağımsız doğrulama bekleyen fazları
   test eder (kod yazmaz, sadece okuma+headless test). Cron: ~15dk'da bir.

## Kritik kurallar (her cron promptuna dahil edilmeli)
- Dev server durdurma: SADECE kendi başlatılan process, PID ile. ASLA
  `taskkill /IM node.exe` (tüm Node process'lerini öldürür, başka
  session'ların işini bozar).
- `.env`'deki `GEMINI_API_KEY` client-side'a ASLA sızmamalı (mevcut
  `vite.config.ts` sunucu-taraflı proxy deseninin dışına çıkılmayacak).
- Aynı anda birden fazla coder/tester AYNI KOD TABANINDA PARALEL
  çalıştırılmayacak — dosya çakışması riski (Faz II/VI'da gerçekten yaşandı).
  Coder/tester birbirine "şu dosyalara dokunuyorum" diye kısa mesaj atar.
- **Geri alınamaz/büyük kararlar** (gerçek bir backend'e deploy, veritabanı
  kurulumu, harici bir servise bağlanma, mimari değişiklik) kullanıcı
  yokken YAPILMAZ — sadece yerel/geliştirme ortamında kalan, geri
  alınabilir adımlarla ilerlenir. Emin değilseniz PM'e danışın, PM de emin
  değilse ilerlemeyip not düşer, kullanıcı döndüğünde sorar.
- **Git (2026-09-13'ten itibaren)**: Proje artık bir git deposu, adı "Evosim"
  (GitHub: `ErdemWilkinson/evosim`, **2026-09-14'ten itibaren PUBLIC**).
  Coder her kod değişikliği turu sonunda `git add`+`git commit` atar (küçük,
  açıklayıcı mesajlarla). **`git push` SADECE PM onayıyla yapılır** —
  coder/tester kendi başına push ATMAZ (uzak repo, geri alınması
  coder/tester'ın yetkisinde olmayan bir eylem).
- **KRİTİK — repo PUBLIC olduğu için**: `.env`'deki `GEMINI_API_KEY` HİÇBİR
  ZAMAN (kod, yorum, commit mesajı, test script'i, geçici debug dosyası
  dahil) gerçek DEĞERİYLE bir dosyaya yazılmayacak — sadece
  `process.env.GEMINI_API_KEY` REFERANSI kullanılır. `.env` zaten
  `.gitignore`'da; yeni bir `.env`-benzeri/sırlı dosya eklenirse hemen
  `.gitignore`'a eklenmeli. Her commit öncesi `git diff --staged` ile
  gözden geçirin, şüpheli bir string görürseniz commit ATMAYIN, PM'e sorun.

## Kullanıcının açık isteği
- Proje sürekli mükemmelleştirilsin, kendi kendine yeni görevler seçip
  uygulasın ("sen sürekli mükemmelleştirmeye çalışacaksın projeyi yeni
  taskler verip").
- **Hem frontend hem backend** iş bekleniyor — TASKS.md'nin "Otonom Çalışma
  Modu" bölümünde backend fikirleri (Gemini proxy'sini gerçek backend'e
  taşımak, popülasyon/soy verisi API'si vb.) listeli.

## Bir session bu dosyayı görüp yapı bozulmuş bulursa ne yapmalı
1. TASKS.md'yi oku (güncel durum, aday havuzu).
2. ListAgents ile aktif peer session'ları kontrol et, rolleri (varsa)
   hatırla/netleştir (kısa bir mesajla sorabilir).
3. Kendi rolüne uygun bir cron kur (yukarıdaki cadence'lara göre), ilk
   turu hemen kendisi başlatsın (beklemeden).
4. Eksik rol varsa (örn. hiç coder yoksa) ve boşta bir peer session varsa
   ona rol ver.

Bu dosya, kullanıcı geri dönüp farklı bir talimat vermedikçe geçerlidir.
