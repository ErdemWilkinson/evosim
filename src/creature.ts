import { Container, Graphics } from "pixi.js";
import { Genome, Palette, genomeToPalette, randomGenome } from "./genome";
import { ORGAN_DEFINITIONS, OrganType, canWalkOnLand, getOrgan } from "./organs";

/**
 * Faz I (v3) — Mikroorganizma görünümü: basit bir daire, organ/uzuv YOK (TASKS.md v3
 * — "sadece temel bir gövde: basit bir daire/nokta"). v2'nin şematik vücut planı
 * (kapsül/kite gövde + uzuv segmentleri) tamamen kaldırıldı.
 *
 * Faz II (v3) — Genomdaki `organs` listesi artık gövde dairesinin üzerine/etrafına
 * şematik olarak çiziliyor (bkz. `organs.ts` `ORGAN_DEFINITIONS`) — v2'nin nötr/
 * karikatür-olmayan görsel dili korunuyor (basit çizgi/üçgen/nokta, yüz/ifade YOK).
 *
 * Konum artık gezegen çevresindeki bir açı (theta) değil, düz haritada bir (x, y)
 * koordinatı (TASKS.md v3 — "Düz bir harita").
 */
export class Creature extends Container {
  public x2 = 0; // (Container.x zaten var, ama netlik için ayrı world-koordinat alanları)
  public y2 = 0;

  public readonly genome: Genome;
  public readonly palette: Palette;

  public readonly maxEnergy: number;
  public energy: number;
  public alive = true;

  /** Hareket yönü (radyan) — basit rastgele gezinme için. */
  private heading = Math.random() * Math.PI * 2;
  private wanderTimer = 0.5 + Math.random() * 1.5;

  public age = 0;

  private readonly body: Graphics;

  /** Faz V — Üreme/büyüme görselliği (TASKS.md): yeni doğan bir birey küçük
   *  başlayıp kısa sürede tam boyuta büyür. Karikatür/sıçramalı DEĞİL — düz/doğrusal
   *  bir scale-in geçişi (v2'nin "playBirthAnimation" deseninden ilham alındı ama
   *  v3'ün sade/bilimsel diline uygun, abartısız). `isNewborn=false` olan bireyler
   *  (başlangıç popülasyonu, kayıttan yüklenenler) hiç animasyon oynatmaz — tam
   *  boyutta belirir, sadece gerçek bölünmeyle doğanlar büyür.
   */
  private growthTimer = 0;
  private static readonly GROWTH_DURATION = 0.6; // saniye — abartısız, fark edilir ama hızlı

  /** Faz VII — Yavru bakımı (TASKS.md): yeni doğan bir birey, doğduğu andaki ebeveyn
   *  referansını (varsa) tutar. `Ecosystem.updateCreatures` bunu ebeveyn-yavru mesafesini
   *  kontrol edip hafif bir metabolizma indirimi uygulamak için kullanır — karmaşık bir
   *  takip/AI sistemi YOK, sadece basit bir mesafe kontrolü (TASKS.md: "sadece mesafe
   *  kontrolü yeterli"). Ebeveyn ölürse referans doğal olarak `alive=false` görülüp
   *  yok sayılır (WeakRef gerekmiyor, Ecosystem zaten ölü canlıları listeden çıkarıyor
   *  ama bu referans ayrı tutulduğu için Ecosystem'in kendi temizliğini beklemeden de
   *  `alive` bayrağı kontrol edilerek güvenle yok sayılabilir). */
  public readonly isNewborn: boolean;
  public parentRef: Creature | null = null;

  /** Faz IX — Etoloji (TASKS.md madde 4): basit bir davranış durum makinesi.
   *  Karar mantığı `Ecosystem.updateCreatureBehavior`'da (algı menzili/avcı-av
   *  taraması `Creature`'ın kendi işi değil, dünyayı/diğer canlıları bilmiyor) —
   *  burada sadece SONUÇ tutuluyor: geçerli davranış + varsa hedef canlı. Inceleme
   *  paneli ve görsel vurgular (avlanma anı) bu alanı okuyabilir. */
  public behaviorState: "wander" | "seek" | "flee" | "hunt" = "wander";
  public behaviorTarget: Creature | null = null;
  /** Avlanma anında kısa bir görsel vurgu için (TASKS.md madde 5) — `Ecosystem`
   *  bir avlanma gerçekleştiğinde bunu bir süreliğine true yapar, `update()` süresi
   *  dolunca kendiliğinden false'a döner. */
  private huntFlashTimer = 0;
  private static readonly HUNT_FLASH_DURATION = 0.35;

  constructor(x: number, y: number, genome: Genome = randomGenome(), isNewborn = false) {
    super();
    this.x2 = x;
    this.y2 = y;
    this.position.set(x, y);
    this.genome = genome;
    this.palette = genomeToPalette(genome);
    this.isNewborn = isNewborn;

    this.maxEnergy = 40 + genome.radius * 8;
    this.energy = this.maxEnergy * 0.6;

    this.body = new Graphics();
    this.drawBody();
    this.addChild(this.body);

    if (isNewborn) {
      this.growthTimer = Creature.GROWTH_DURATION;
      this.scale.set(0.15);
    }
  }

  private drawBody(): void {
    const g = this.genome;
    this.body.clear();
    this.body.circle(0, 0, g.radius).fill({ color: this.palette.body });

    if (g.diet === "carnivore") {
      // Faz IX — Diyet sistemi (TASKS.md madde 3): "hangi canlının ne olduğu
      // anlaşılmıyor" geri bildirimine çözüm — etçiller şematik/nötr ama AÇIKÇA farklı
      // bir kontur taşır: kalın, kırmızımsı bir dış çizgi + gövde etrafında küçük,
      // eşit aralıklı "diş/çentik" üçgenleri (karikatür ağız/yüz DEĞİL, spike organının
      // çizim diliyle tutarlı şematik bir işaret). Otçullar (varsayılan) mevcut sade
      // ince gri kontur ile kalır — v2'den beri korunan nötr/bilimsel dil bozulmuyor.
      const teeth = 8;
      for (let i = 0; i < teeth; i++) {
        const a = (i / teeth) * Math.PI * 2;
        const spread = 0.09;
        const baseX1 = Math.cos(a - spread) * g.radius;
        const baseY1 = Math.sin(a - spread) * g.radius;
        const baseX2 = Math.cos(a + spread) * g.radius;
        const baseY2 = Math.sin(a + spread) * g.radius;
        const tipX = Math.cos(a) * g.radius * 1.28;
        const tipY = Math.sin(a) * g.radius * 1.28;
        this.body.poly([baseX1, baseY1, tipX, tipY, baseX2, baseY2]);
        this.body.fill({ color: 0xb5433f, alpha: 0.85 });
      }
      this.body.circle(0, 0, g.radius).stroke({ width: 1.6, color: 0xb5433f, alpha: 0.9 });
    } else {
      this.body.circle(0, 0, g.radius).stroke({ width: 1, color: this.palette.bodyDark, alpha: 0.6 });
    }

    this.drawOrgans();
  }

  /** Faz II — genomdaki her organı, tipine göre gruplanmış olarak (aynı tipten birden
   *  fazla varsa merkez etrafına simetrik dağıtarak) gövdenin üzerine çizer. Çizim
   *  mantığı organ tanımının kendisinde (`organs.ts`) — burası sadece gruplayıp
   *  sırayla çağırıyor. */
  private drawOrgans(): void {
    const byType = new Map<OrganType, typeof this.genome.organs>();
    for (const organ of this.genome.organs) {
      const list = byType.get(organ.type) ?? [];
      list.push(organ);
      byType.set(organ.type, list);
    }
    for (const [type, organs] of byType) {
      const def = ORGAN_DEFINITIONS[type];
      organs.forEach((organ, index) => {
        def.draw(this.body, organ, this.genome.radius, this.palette, index, organs.length);
      });
    }
  }

  /** TASKS.md — "Su → kara geçişi": bacak (veya ileride başka kara-uyumlu bir organ)
   *  taşıyan bireyler karaya çıkabilir. */
  public canWalkOnLand(): boolean {
    return canWalkOnLand(this.genome.organs);
  }

  /**
   * Faz X — Sığ/derin su ayrımı (TASKS.md): "bacaklı bireyler sığ suda rahatça
   * dolaşsın ama derin suya girmesi zorlaşsın/engellensin; sadece yüzgeçli/su-uyumlu
   * bireyler derin suda rahat olsun". Kural: bacaklı (kara-uyumlu) bir birey, EĞER
   * su-uyumlu bir organı (yüzgeç VEYA solungaç) da YOKSA derin suya giremez — sadece
   * kıyı/sığ su + kara ile sınırlı kalır (gerçekçi "amfibi/kıyı canlısı" davranışı).
   * Bacaksız (organ taşımayan veya sadece başka organ taşıyan) bireyler — v3'ün
   * varsayılan/ezici çoğunluğu — bu kısıttan HİÇ etkilenmez, her zamanki gibi tüm su
   * alanında serbestçe dolaşır (Faz I'den beri değişmeyen temel davranış BOZULMADI).
   * Yüzgeç veya solungaç taşıyan HERHANGİ bir birey (bacaklı olsun olmasın) derin
   * suda her zaman rahat.
   */
  public canEnterDeepWater(): boolean {
    if (!this.canWalkOnLand()) return true; // bacaksız — kısıt bacaklılara özel
    return !!getOrgan(this.genome.organs, "fin") || !!getOrgan(this.genome.organs, "gill");
  }

  /** Faz II — mekanik etki: organlar gerçek bir fark yaratmalı (TASKS.md). Arazi
   *  türüne göre etkin hareket hızı: suda yüzgeç/dokunaç/kanat bir miktar hız katar,
   *  karada bacak belirleyicidir (bacak olmadan zaten karaya çıkılamıyor, ama bacağın
   *  gücü karadaki hızı belirler — güçlü bacaklı bireyler karada daha hızlı). */
  public effectiveMoveSpeed(onLand: boolean): number {
    const base = this.genome.moveSpeed;
    if (onLand) {
      const leg = getOrgan(this.genome.organs, "leg");
      // Bacak yoksa zaten karaya çıkamaz (canWalkOnLand ile korunuyor), ama savunma
      // amaçlı: bacaksız bir çağrı düşük/sürünme hızı döndürsün.
      const legFactor = leg ? 0.6 + leg.power * 1.1 : 0.35;
      return base * legFactor;
    }
    let factor = 1;
    const fin = getOrgan(this.genome.organs, "fin");
    if (fin) factor += fin.power * 0.9;
    const tentacle = getOrgan(this.genome.organs, "tentacle");
    if (tentacle) factor += tentacle.power * 0.3;
    const wing = getOrgan(this.genome.organs, "wing");
    if (wing) factor += wing.power * 0.15;
    return base * factor;
  }

  /** Algı menzili: göz/ışık noktası genişletir (TASKS.md — "göz algı menzilini
   *  artırsın"). Faz XIV — biyolüminesans, düşük oksijen/derin sularda ek bir algı
   *  bonusu sağlar (karanlık ortamda "kendi ışığıyla" fark etme avantajı gerçek
   *  dünyadaki derin deniz canlılarından ilham alıyor). */
  public effectiveSenseRadius(): number {
    let radius = this.genome.senseRadius;
    const eyespot = getOrgan(this.genome.organs, "eyespot");
    if (eyespot) radius += 15 + eyespot.power * 20;
    const eye = getOrgan(this.genome.organs, "eye");
    if (eye) radius += 35 + eye.power * 55;
    const biolum = getOrgan(this.genome.organs, "bioluminescence");
    if (biolum) radius += 20 + biolum.power * 30;
    return radius;
  }

  /** Beslenme verimliliği çarpanı — ağız/çene ile alınan enerji değeri artar
   *  (TASKS.md — "ağız/çene beslenme verimliliğini artırsın"). Faz X — mide (iç
   *  organ) sindirim/besin dönüşüm verimliliğini AYRICA artırır (ağızla birlikte
   *  çarpımsal olarak birikir — ikisi farklı aşamaları temsil ediyor: ağız
   *  "yakalama/alma", mide "dönüştürme"). */
  public feedingEfficiency(): number {
    const mouth = getOrgan(this.genome.organs, "mouth");
    let factor = mouth ? 1 + 0.35 + mouth.power * 0.65 : 1;
    const stomach = getOrgan(this.genome.organs, "stomach");
    if (stomach) factor *= 1 + 0.2 + stomach.power * 0.3;
    // Faz XIV — rejenerasyon: beslenmeden kazanılan enerjiyi hafifçe artırır
    // (hızlı doku/enerji toparlanması, gerçek dünyada bazı türlerin hızlı
    // rejenerasyon kapasitesinden ilham alıyor).
    const regeneration = getOrgan(this.genome.organs, "regeneration");
    if (regeneration) factor *= 1 + 0.1 + regeneration.power * 0.15;
    // Faz XVI Madde 3 — Kükürt kemosentez organı (gezegene özgü, TASKS.md): hidrotermal
    // baca tüp kurdu/bakterileri kemosentezle (güneş ışığı olmadan kükürt bileşiklerinden
    // enerji üretimi) besin verimliliğini artırıyor — mekanik olarak mouth/stomach ile
    // aynı "beslenme verimliliği" çarpanına katkı, sadece HANGİ gezegende ortaya
    // çıkabildiği kısıtlı (bkz. organs.ts `setPlanetAllowedOrgans`).
    const sulfurVent = getOrgan(this.genome.organs, "sulfur_vent_organ");
    if (sulfurVent) factor *= 1 + 0.15 + sulfurVent.power * 0.25;
    return factor;
  }

  /** Metabolizma (enerji tüketim) çarpanı — kabuk/zırh hayatta kalmayı artırır
   *  (TASKS.md — "kabuk/zırh hayatta kalmayı artırsın"); karşılığında biraz daha
   *  fazla enerji tüketir (zırhı taşımanın bedeli var, bedava bonus değil). Kamuflaj
   *  ve diken de ölüm riskini azaltan pasif bir "hayatta kalma şansı" çarpanı sağlar
   *  (bkz. `survivalBonus`), metabolizmayı etkilemez. Faz X — kalp (iç organ)
   *  dolaşım verimliliğini artırıp metabolizma çarpanını AZALTIR (daha az temel
   *  enerji kaybı) — kabuğun tersine bedelsiz bir bonus değil, ama en azından
   *  "kalbi olan biraz daha verimli" hissi TASKS.md'nin iç organ örneğiyle tutarlı. */
  public metabolismMultiplier(): number {
    const shell = getOrgan(this.genome.organs, "shell");
    let factor = shell ? 1 + shell.power * 0.2 : 1;
    const heart = getOrgan(this.genome.organs, "heart");
    if (heart) factor *= 1 - (0.1 + heart.power * 0.15);
    // Faz XIV — kışlama/torpor (TASKS.md madde 1): enerji oranı kritik eşiğin
    // (%20) altına düşünce metabolizma ciddi şekilde yavaşlar — kamp balığı/ayı
    // kışlama davranışından ilham alan bir "kıtlık direnci" mekaniği. Enerji
    // oranı eşiğin üstündeyken hiçbir etkisi yok (bedava bonus değil, sadece
    // kritik anda devreye giren bir hayatta kalma stratejisi).
    const torpor = getOrgan(this.genome.organs, "torpor");
    if (torpor && this.maxEnergy > 0 && this.energy / this.maxEnergy <= 0.2) {
      factor *= 1 - (0.35 + torpor.power * 0.35);
    }
    // Faz XVI Madde 3 — Azot deposu (gezegene özgü, TASKS.md): baklagil kök yumrusu/
    // yüzme kesesi ilhamlı bir depolama organı — kalp gibi bedelsiz bir metabolizma
    // tasarrufu sağlıyor (kabuğun aksine bir "taşıma bedeli" yok, TASKS.md'nin iç
    // organ örnekleriyle aynı ilke). Sadece yüksek/orta azotlu gezegenlerde ortaya
    // çıkabiliyor (bkz. organs.ts `setPlanetAllowedOrgans`).
    const nitrogenSac = getOrgan(this.genome.organs, "nitrogen_sac");
    if (nitrogenSac) factor *= 1 - (0.08 + nitrogenSac.power * 0.12);
    return Math.max(0.15, factor);
  }

  /** Faz XIV — İzolasyon tabakası (TASKS.md madde 1): global iklim çarpanının
   *  (bkz. `Ecosystem.climateMetabolismMultiplier`) 1'den (nötr) SAPMASINI azaltır
   *  — fok/penguen yağ tabakasından ilham alan bir "iklim direnci". `rawMultiplier`
   *  ecosystem.ts'teki güncel global iklim çarpanı; dönen değer bu bireyin GERÇEKTEN
   *  hissettiği (yumuşatılmış) çarpan. Blubber yoksa hiçbir etkisi olmaz (`rawMultiplier`
   *  aynen döner). */
  public climateResistantMultiplier(rawMultiplier: number): number {
    const blubber = getOrgan(this.genome.organs, "blubber");
    if (!blubber) return rawMultiplier;
    const dampening = 0.4 + blubber.power * 0.4; // %40-80 arası sapma azaltımı
    return 1 + (rawMultiplier - 1) * (1 - dampening);
  }

  /**
   * Faz X — Atmosfer/solunum organları (TASKS.md): gill/lung taşıyan bireylerin
   * metabolizma verimliliği güncel GLOBAL oksijen seviyesine (`oxygenLevel`, 0..1,
   * 0.5 nötr) göre GERÇEKTEN değişir — "organlar atmosfere göre gelişecek" hissi,
   * ölçülebilir bir seçilim baskısı (kozmetik değil). Kural (basit, sezgisel):
   * - Solungaç (`gill`), SUDAYKEN etkili: düşük oksijende avantajlı (daha az enerji
   *   kaybı), yüksek oksijende nötre yakın (zaten avantaja ihtiyaç az).
   * - Akciğer (`lung`), KARADAYKEN/yüzeyde etkili: yüksek oksijende avantajlı,
   *   düşük oksijende nötre yakın (havadan yeterince oksijen alamıyor).
   * Hiçbir solunum organı YOKSA (v3'ün ezici çoğunluğu — organsız mikroorganizmalar)
   * bu fonksiyon her zaman nötr (1) döner — atmosfer SADECE solunum organı kazanmış
   * bireyler arasında bir fark yaratıyor, popülasyonun geri kalanını etkilemiyor.
   */
  public breathingMetabolismMultiplier(onLand: boolean, oxygenLevel: number): number {
    const gill = getOrgan(this.genome.organs, "gill");
    const lung = getOrgan(this.genome.organs, "lung");
    if (!gill && !lung) return 1;

    // oxygenLevel 0.5'ten ne kadar SAPTIĞI (-0.4..+0.4 civarı) — pozitif: bol
    // oksijen, negatif: az oksijen.
    const deviation = oxygenLevel - 0.5;

    let factor = 1;
    if (gill && !onLand) {
      // Az oksijende (deviation<0) solungaç avantajlı → metabolizma çarpanı 1'in
      // altına iner (daha az enerji kaybı). Bol oksijende etkisi küçülür.
      factor *= 1 - Math.max(0, -deviation) * (0.3 + gill.power * 0.4);
    }
    if (lung && onLand) {
      // Bol oksijende (deviation>0) akciğer avantajlı; az oksijende dezavantajlı
      // (biraz daha FAZLA enerji kaybı) — gerçek bir seçilim baskısı, tek yönlü
      // bedava bonus değil.
      factor *= 1 - deviation * (0.3 + lung.power * 0.4);
    }
    return Math.max(0.5, Math.min(1.5, factor));
  }

  /** 0..1+ arası bir "hayatta kalma şansı" çarpanı — kabuk/kamuflaj/diken/zehir bezi
   *  bunu artırır. Metabolizmayı ETKİLEMEZ (bkz. `metabolismMultiplier` — sadece
   *  kabuk/kalp/torpor/azot deposu metabolizmayı değiştirir); bu değer tek başına
   *  `ecosystem.ts`'in avlanma mekaniğinde (`huntCreature`/`packHuntEscapeReduction`)
   *  avdan KAÇIŞ ŞANSINA dönüştürülüyor. */
  public survivalBonus(): number {
    let bonus = 0;
    const shell = getOrgan(this.genome.organs, "shell");
    if (shell) bonus += 0.15 + shell.power * 0.25;
    const camouflage = getOrgan(this.genome.organs, "camouflage");
    if (camouflage) bonus += 0.1 + camouflage.power * 0.2;
    const spike = getOrgan(this.genome.organs, "spike");
    if (spike) bonus += 0.1 + spike.power * 0.2;
    // Faz XIV — zehir bezi: avcıyı caydırma yoluyla ek bir kaçış şansı sağlar.
    const venom = getOrgan(this.genome.organs, "venom");
    if (venom) bonus += 0.15 + venom.power * 0.25;
    return bonus;
  }

  /** Faz XX (v3) — Kromatofor (aktif kamuflaj, TASKS.md kullanıcı isteği): `survivalBonus`'un
   *  SABİT/pasif bonusundan farklı olarak, bu şans sadece YAKALANMA ANINDA (bkz.
   *  `ecosystem.ts` `huntCreature`) devreye girer — "tepkisel bir irkilme/renk-değiştirme"
   *  sezgisiyle, avcının tam yakaladığı anda ayrı, EK bir kaçış şansı. Organ yoksa 0
   *  döner (etkisiz), başka hiçbir bireyin davranışını etkilemez. */
  public chromatophoreReactiveEscapeChance(): number {
    const chromatophore = getOrgan(this.genome.organs, "chromatophore");
    if (!chromatophore) return 0;
    return 0.12 + chromatophore.power * 0.2;
  }

  /** Faz XXI (v3) — Simbiyotik Bağırsak Florası (TASKS.md kullanıcı isteği): mevcut
   *  `mouth`/`stomach`/`regeneration` (üçü de "beslenmeden kazanılan ENERJİYİ artırır")
   *  organlarından FARKLI bir eksende çalışır — kazanılan enerjiyi DEĞİL, avdan sonraki
   *  SİNDİRİM MOLASI süresini (`ecosystem.ts` `DIGEST_COOLDOWN`) kısaltır, yani predatöre
   *  aynı enerjiyi değil DAHA SIK avlanma fırsatı verir. `1` (organ yoksa, etkisiz) ile
   *  `0.5` (organ maksimum güçteyken, süre yarıya iner) arası bir çarpan döner —
   *  `ecosystem.ts`'te sindirim molası süresiyle ÇARPILIR. */
  public digestCooldownMultiplier(): number {
    const gutFlora = getOrgan(this.genome.organs, "symbiotic_gut_flora");
    if (!gutFlora) return 1;
    return 1 - gutFlora.power * 0.5;
  }

  /** Faz VII — Yavru bakımı (TASKS.md): bu birey yeni doğmuşsa VE ebeveyni hâlâ
   *  hayattaysa VE ebeveyn `maxDistance` içindeyse `true` döner. Basit bir mesafe
   *  kontrolü — karmaşık bir takip/AI sistemi yok. */
  public isNearCaringParent(maxDistance: number): boolean {
    if (!this.isNewborn || !this.parentRef) return false;
    if (!this.parentRef.alive) return false;
    const dist = Math.hypot(this.parentRef.x2 - this.x2, this.parentRef.y2 - this.y2);
    return dist <= maxDistance;
  }

  /** Her karede çağrılır — sadece yaş/alfa/görsel güncelleme, hareket kararı
   *  `Ecosystem` tarafında (bkz. `stepWander`/`moveTo`). */
   public update(dt: number): void {
    this.age += dt;
    this.alpha = 0.5 + 0.5 * Math.min(1, this.energy / this.maxEnergy);

    if (this.growthTimer > 0) {
      this.growthTimer = Math.max(0, this.growthTimer - dt);
      // Doğrusal (ease yok, karikatür/sıçramalı olmasın) küçükten tam boyuta geçiş.
      const t = 1 - this.growthTimer / Creature.GROWTH_DURATION;
      const s = 0.15 + 0.85 * t;
      this.scale.set(s);
    }

    if (this.huntFlashTimer > 0) {
      this.huntFlashTimer = Math.max(0, this.huntFlashTimer - dt);
      // Faz IX — Emoji + küçük animasyonlar (TASKS.md madde 5): avlanma anında kısa,
      // abartısız bir görsel vurgu — gövde kısa süreliğine hafifçe büyür/parlar, sonra
      // normale döner. Karmaşık parçacık efekti YOK.
      const t = this.huntFlashTimer / Creature.HUNT_FLASH_DURATION;
      const flashScale = 1 + t * 0.35;
      this.body.scale.set(flashScale);
    } else if (this.body.scale.x !== 1) {
      this.body.scale.set(1);
    }
  }

  /** Faz IX — Etoloji/avlanma görselliği: bir avlanma gerçekleştiğinde `Ecosystem`
   *  bunu çağırır, kısa bir görsel vurgu tetiklenir (bkz. `update`). */
  public triggerHuntFlash(): void {
    this.huntFlashTimer = Creature.HUNT_FLASH_DURATION;
  }

  /** Hedefsiz, basit bir gezinme adımı: zaman zaman rastgele yön değiştirip o yönde
   *  ilerler. Dünya sınırlarına çarpınca yansır (bkz. Ecosystem.clampToWorld).
   *  `onLand` — Faz II: etkin hız arazi türüne ve organlara göre değişir (bkz.
   *  `effectiveMoveSpeed`). */
  public stepWander(dt: number, onLand = false): { dx: number; dy: number } {
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.heading += (Math.random() - 0.5) * Math.PI * 0.9;
      this.wanderTimer = 0.5 + Math.random() * 1.5;
    }
    const dist = this.effectiveMoveSpeed(onLand) * dt;
    return { dx: Math.cos(this.heading) * dist, dy: Math.sin(this.heading) * dist };
  }

  /** Belirli bir yöne doğru dönmesini sağlar (örn. yakındaki besine doğru) — sonraki
   *  `stepWander` çağrısı bu yeni heading'den devam eder. */
  public steerToward(targetX: number, targetY: number): { dx: number; dy: number } {
    const dx = targetX - this.x2;
    const dy = targetY - this.y2;
    this.heading = Math.atan2(dy, dx);
    return { dx, dy };
  }

  /** Faz IX — Etoloji (TASKS.md madde 4): "flee" durumu için tam ters yöne döner
   *  (bir tehditten uzaklaşma). `steerToward`'ın simetriği — ayrı tutulması niyeti
   *  (kaçış) çağıran koddaki okunabilirliği artırıyor. */
  public steerAway(threatX: number, threatY: number, onLand: boolean, dt: number): { dx: number; dy: number } {
    const dx = this.x2 - threatX;
    const dy = this.y2 - threatY;
    this.heading = Math.atan2(dy, dx);
    const dist = this.effectiveMoveSpeed(onLand) * dt;
    return { dx: Math.cos(this.heading) * dist, dy: Math.sin(this.heading) * dist };
  }

  public setPosition(x: number, y: number): void {
    this.x2 = x;
    this.y2 = y;
    this.position.set(x, y);
  }

  /** Faz V — Canlı inceleme paneli (TASKS.md): tıklanan bireyin detaylarını UI'ın
   *  ihtiyaç duyduğu sade bir şekle indirger (tür/nesil/yaş/enerji/organ listesi/
   *  hız/algı menzili). "Tür" kavramı v3'te resmi olarak yok (açık uçlu evrim, sabit
   *  tür etiketleri yok) — bunun yerine kısa, deterministik bir "genom imzası"
   *  (id tabanlı) tür benzeri bir kimlik olarak gösteriliyor. */
  public getInspectionSummary(onLand: boolean): {
    id: number;
    generation: number;
    age: number;
    energy: number;
    maxEnergy: number;
    moveSpeed: number;
    senseRadius: number;
    onLand: boolean;
    canWalkOnLand: boolean;
    organs: { type: OrganType; label: string; power: number; description: string }[];
    diet: "herbivore" | "carnivore";
    packHunter: boolean;
    behaviorState: "wander" | "seek" | "flee" | "hunt";
  } {
    return {
      id: this.genome.id,
      generation: this.genome.generation,
      age: this.age,
      energy: this.energy,
      maxEnergy: this.maxEnergy,
      moveSpeed: this.effectiveMoveSpeed(onLand),
      senseRadius: this.effectiveSenseRadius(),
      onLand,
      canWalkOnLand: this.canWalkOnLand(),
      organs: this.genome.organs.map((o) => ({
        type: o.type,
        label: ORGAN_DEFINITIONS[o.type].label,
        power: o.power,
        description: ORGAN_DEFINITIONS[o.type].description,
      })),
      diet: this.genome.diet,
      packHunter: this.genome.packHunter,
      behaviorState: this.behaviorState,
    };
  }

  /** Karadan/sudan yansıma sonrası yön değiştirmek için (basit "duvara çarpma"). */
  public bounceHeading(normalX: number, normalY: number): void {
    const dot = Math.cos(this.heading) * normalX + Math.sin(this.heading) * normalY;
    const newDx = Math.cos(this.heading) - 2 * dot * normalX;
    const newDy = Math.sin(this.heading) - 2 * dot * normalY;
    this.heading = Math.atan2(newDy, newDx);
  }
}
