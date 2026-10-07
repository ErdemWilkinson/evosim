import { getLang } from "./i18n";

/**
 * Rehber: "Erdem" adlı hayalet bir fare imleci arayüzün bölümlerine gider, düğmelere tıklar ve ne işe
 * yaradıklarını anlatır. Yalnızca arayüzdedir; benzetime dokunmaz. Rehber bitince ya da kapanınca hız, oyun modu,
 * sekme ve seçili canlı başladığı hâle döner.
 */

export interface TourContext {
  ready(): boolean;
  speed(): number;
  setSpeed(v: number): void;
  gameMode(): boolean;
  setGame(on: boolean): void;
  tab(): string;
  setTab(name: string): void;
  /** Haritadan bir canlı seçer ve ekran konumunu verir; `pick` canlıyı gerçekten seçer. Canlı yoksa null. */
  pickCreature(id?: number): { id: number; x: number; y: number; pick: () => void } | null;
  clearSelection(): void;
}

type Pair = [string, string];

interface Step {
  tr: Pair;
  en: Pair;
  /** İmlecin gideceği öğe (CSS seçici) ya da konum işlevi; yoksa ekranın ortası. */
  target?: string;
  /** İmleç varınca tıklanacak öğe (varsayılan: hedefin kendisi); false ise yalnızca gösterir. */
  click?: boolean | string;
  /** Hedef yerine bir canlıyı gösterir ve seçer. */
  creature?: boolean;
  /** Doğruysa tıklama atlanır (ör. oyun modu zaten açıksa tekrar tıklayıp kapatma). */
  skipIf?: (ctx: TourContext) => boolean;
  /** Hedefin üstündeki halka yerine büyük bir bölgeyi vurgular. */
  wide?: boolean;
  /** Oyun hazır olmasa da (gezegen ekranındayken) gösterilebilen adım. */
  anyStage?: boolean;
  /** Gezegen oluşturma penceresi açıkken gösterilen adım; oyun içinden başlatılan rehberde atlanır. */
  planet?: boolean;
  /** Bu adımın tıklaması oyunu başlatır: köken filmi atlanır, oyun hazır olunca rehber kendiliğinden sürer. */
  startGame?: boolean;
  /** Yapı penceresi açıkken gösterilen adım: pencere kapalıysa önce açılır, başka adımlarda kapatılır. */
  inspect?: boolean;
}

const STEPS: Step[] = [
  {
    tr: ["Merhaba, ben Erdem", "Bu oyunu ben yaptım. Şimdi ekranın her köşesini sırayla göstereceğim: düğmelere kendim tıklayacağım, siz yalnızca izleyin. “İleri” ile ilerleyin, “Geri” ile dönün, “Kapat” ile istediğiniz an çıkın."],
    en: ["Hi, I'm Erdem", "I made this game. I'll walk you through every corner of the screen: I'll click the buttons myself, you just watch. Use “Next” to go on, “Back” to return, and “Close” to leave any time."],
    anyStage: true,
  },
  {
    tr: ["Önce gezegeni kuralım", "Burası “Yeni gezegen” ekranı: oyun her seferinde başka bir dünyayla başlar. Önce burayı gezdireyim, sonra oyunun içine geçeriz."],
    en: ["First, let's build a planet", "This is the “New planet” screen: the game starts with a different world every time. I'll show you around here first, then we'll go into the game."],
    planet: true,
  },
  {
    tr: ["Tohum", "Gezegenin tamamı bu sayıdan üretilir: kimya, sıvı, harita ve ilk hücre. Aynı tohumu yazan herkes aynı gezegeni görür. İstediğiniz sayıyı yazabilirsiniz."],
    en: ["Seed", "The whole planet is generated from this number: chemistry, liquid, map and first cell. Anyone who types the same seed sees the same planet. You can type any number you like."],
    target: "#seed-input",
    click: false,
    planet: true,
  },
  {
    tr: ["Rastgele", "Bu düğme yeni bir tohum seçer. Şimdi basıyorum; harita ve sağdaki bilgiler anında değişir."],
    en: ["Random", "This button picks a new seed. I'm pressing it now; the map and the facts on the right change at once."],
    target: "#seed-random",
    click: true,
    planet: true,
  },
  {
    tr: ["Günün gezegeni", "Bugün herkes için aynı olan gezegeni açar. Arkadaşlarınızla aynı dünyayı karşılaştırmak için güzel bir yol."],
    en: ["Planet of the day", "Opens the planet that is the same for everyone today. A nice way to compare the same world with your friends."],
    target: "#seed-daily",
    click: false,
    planet: true,
  },
  {
    tr: ["Gezegenin haritası", "Seçilen tohumun haritası: koyu alanlar derin sıvı, açık alanlar kara. Yaşam bu haritada, sıvının içinde ve kıyısında başlar."],
    en: ["The planet map", "The map of the chosen seed: dark areas are deep liquid, light areas are land. Life starts on this map, in the liquid and along its shores."],
    target: "#planet-map",
    click: false,
    planet: true,
    wide: true,
  },
  {
    tr: ["Gezegenin kimyası", "Sağdaki kutular bu dünyanın yazgısını belirler: kabuktaki elementler, yüzey sıvısı, basınç, atmosfer, yaşamın kökeni ve ilk hücrenin zarı, kalıtımı, enerjisi. Hücre duvarı ilk hücrede yoktur; sonradan evrilir."],
    en: ["The planet's chemistry", "The boxes on the right decide this world's fate: crust elements, surface liquid, pressure, atmosphere, the origin of life and the first cell's membrane, heredity and energy. The first cell has no wall; one evolves later."],
    target: "#planet-preview-facts",
    click: false,
    planet: true,
    wide: true,
  },
  {
    tr: ["Dil", "Oyun İngilizce ve Türkçe oynanabilir. Buradan istediğiniz zaman değiştirebilirsiniz."],
    en: ["Language", "The game can be played in English or Turkish. You can switch here at any time."],
    target: "#dlg-planet .lang-pick",
    click: false,
    planet: true,
  },
  {
    tr: ["Başlatalım", "Gezegen hazır. Şimdi “Simülasyonu başlat”a basıyorum. Köken filmini atlıyorum (sonra gezegen bilgilerinden izleyebilirsiniz); ardından oyunun içini gezdiririm."],
    en: ["Let's start", "The planet is ready. I'm pressing “Start the simulation” now. I'll skip the origin film (you can watch it later from the planet facts); then I'll show you around inside the game."],
    target: "#planet-start",
    click: true,
    planet: true,
    startGame: true,
  },
  {
    tr: ["Bu bir gezegen", "Tek bir hücreyle başlayan yaşamı izliyorsunuz. Kimya, sıvı, harita ve ilk hücre bir sayıdan, “tohumdan” üretilir. Aynı tohum herkeste aynı gezegeni açar; kartı paylaşırsanız arkadaşınız da aynısını görür."],
    en: ["This is a planet", "You are watching life that began with one cell. The chemistry, liquid, map and first cell all come from one number, the “seed”. The same seed opens the same planet for everyone; share the card and a friend sees the same one."],
    target: "#seed-chip",
  },
  {
    tr: ["Hız düğmeleri", "Zamanı duraklatabilir (Boşluk tuşu da çalışır) ya da 24 kata kadar hızlandırabilirsiniz. Evrim yavaştır: gerçek bir şeyin olması için çoğu zaman 8× ya da 24× gerekir. Şimdi 4×'e basıyorum."],
    en: ["Speed buttons", "You can pause time (the Space key works too) or speed it up to 24×. Evolution is slow: for anything real to happen you usually need 8× or 24×. I'm pressing 4× now."],
    target: '[data-speed="4"]',
    click: true,
  },
  {
    tr: ["Saat ve gün ışığı", "Burada geçen süre, gün sayısı ve gün ışığı görünür. Işıkla beslenen canlılar gündüz daha çok enerji alır; gece ya da loş sularda zorlanırlar."],
    en: ["Clock and daylight", "Here you see the elapsed time, the day count and the daylight. Light-feeding creatures gain more energy by day; they struggle at night or in dim water."],
    target: ".clock",
  },
  {
    tr: ["Harita", "Burası dünya. Sürükleyerek kaydırır, tekerlekle yakınlaşırsınız. Her renkli leke bir canlıdır; renk beslenme biçimini gösterir. Şimdi yakınlaşma düğmesine basıyorum."],
    en: ["The map", "This is the world. Drag to pan and use the wheel to zoom. Each coloured blob is a creature; the colour shows how it feeds. I'm pressing the zoom button now."],
    target: "#zoom-in",
    click: true,
  },
  {
    tr: ["Tüm harita", "Bu düğme bütün haritayı yeniden sığdırır. Yakınlaşınca kaybolursanız buraya basın."],
    en: ["Whole map", "This button fits the whole map back in view. If you get lost when zoomed in, press it."],
    target: "#zoom-fit",
    click: true,
  },
  {
    tr: ["Bir canlı seçelim", "Bir canlıya tıklayınca onu seçersiniz. Sağdaki panel “Birey” sekmesine geçer: enerjisi, canı, yaşı, nasıl beslendiği ve genleri. “F” tuşu seçili canlıyı takip eder, “Esc” seçimi bırakır."],
    en: ["Let's pick a creature", "Click a creature to select it. The right panel switches to the “Individual” tab: its energy, health, age, how it feeds and its genes. The “F” key follows the selected creature, “Esc” lets go."],
    creature: true,
  },
  {
    tr: ["Yapıyı incele", "Bu düğme canlıyı hücre düzeyine kadar açar. Şimdi ben açıyorum; her hücrenin duvarı, zarı, kalıtım polimeri ve organları kendi genomundan gelir, bu yüzden farklı hücreler farklı görünür."],
    en: ["Inspect structure", "This button opens the creature down to the cell level. I'm opening it now; each cell's wall, membrane, heredity polymer and organs come from its own genome, so different cells look different."],
    target: '[data-action="inspect"]',
    click: true,
  },
  {
    tr: ["Dört büyütme düzeyi", "Canlı, kabuk kesiti, molekül ve atom: her düzey bir öncekinden yüz ila yüz bin kat büyük bakar. Buradaki düğmelerle dilediğiniz düzeye atlarsınız; ya da görüntüye dokunarak yavaşça yakınlaşırsınız."],
    en: ["Four magnification levels", "Creature, shell cross-section, molecule and atom: each level looks far closer than the one before. Jump to any level with these buttons, or tap the picture to zoom in smoothly."],
    target: "#inspect-levels",
    click: false,
    inspect: true,
    wide: true,
  },
  {
    tr: ["Kabuk kesiti", "Şimdi “Kabuk kesiti”ne iniyorum. Üstte dış ortam, altta hücrenin içi var; aralarında hücre duvarı ve zar katmanları dizilir."],
    en: ["Shell cross-section", "I'm dropping into the “Shell cross-section” now. The outside is at the top and the cell interior at the bottom, with the wall and membrane layers between them."],
    target: '#inspect-levels [data-level="1"]',
    click: true,
    inspect: true,
  },
  {
    tr: ["Duvara, zara ya da içine dokunun", "Kesitte duvara, zara ya da hücre içine dokunursanız ekran o yapıya yakınlaşır. Sağdaki listeden de herhangi bir parçayı (zar, duvar, kalıtım polimeri, enerji taşıyıcısı, katalizör, organlar) seçebilirsiniz."],
    en: ["Tap the wall, membrane or interior", "Tap the wall, the membrane or the cell interior in the cross-section and the view zooms into that structure. You can also pick any part (membrane, wall, heredity polymer, energy carrier, catalyst, organs) from the list on the right."],
    target: "#inspect-canvas",
    click: false,
    inspect: true,
    wide: true,
  },
  {
    tr: ["Molekül", "Şimdi “Molekül”e iniyorum: seçili yapıyı kuran molekül top-çubuk modeliyle görünür. R zincirin devamıdır. Atomlardan birine dokunursanız o atom açılır."],
    en: ["Molecule", "I'm going down to “Molecule” now: the molecule that builds the selected structure appears as a ball-and-stick model. R is the continuation of the chain. Tap any atom to open it."],
    target: '#inspect-levels [data-level="2"]',
    click: true,
    inspect: true,
  },
  {
    tr: ["Atom", "En derin düzey atomdur: çekirdek ve elektron kabukları. Sağda atomun gezegendeki payı ve bu yapıdaki rolü yazar."],
    en: ["Atom", "The deepest level is the atom: the nucleus and its electron shells. On the right you see the element's share on this planet and its role in this structure."],
    target: '#inspect-levels [data-level="3"]',
    click: true,
    inspect: true,
  },
  {
    tr: ["Komşu atomlara geçin", "Atomun altında bağlı olduğu komşu atomlar küçük toplar olarak durur. Hangisine dokunursanız ekran o atoma geçer; hidrojene dokunursanız bağlı olduğu atoma geri dönebilirsiniz. Böylece molekülde atomdan atoma yürüyebilirsiniz."],
    en: ["Walk to neighbouring atoms", "Under the atom, the atoms it is bonded to sit as small balls. Tap one and the view switches to that atom; tap a hydrogen and you can return to the atom it hangs from. That way you can walk through the molecule, atom by atom."],
    target: "#inspect-canvas",
    click: false,
    inspect: true,
    wide: true,
  },
  {
    tr: ["Pencereyi kapatıyorum", "Yapı penceresini kapatıp haritaya dönüyorum. Bir canlıyı seçip “Yapıyı incele”ye basarak istediğiniz hücreye bu yolu kendiniz yürüyebilirsiniz."],
    en: ["Closing the window", "I'm closing the structure window and going back to the map. Select any creature and press “Inspect structure” to walk this path yourself on any cell."],
    target: "#dlg-inspect [data-close]",
    click: true,
    inspect: true,
  },
  {
    tr: ["Genom: canlının yazılı planı", "Aşağı kaydırınca Birey sekmesinde canlının genomu bir şerit olarak görünür. Her basamak bir gen: beden büyüklüğü, hız, algı menzili, renk, beslenme biçimi, organlar ve karar ağının her bir ağırlığı. Oyundaki genom bu sayısal özelliklerin listesidir; gerçek bir nükleotit dizisi değildir. Şeridin biçimi (sarmal, merdiven, istif, tabaka…) bu gezegenin kalıtım polimerinden gelir; DNA olmak zorunda değildir."],
    en: ["Genome: the creature's written plan", "Scroll down in the Individual tab and the creature's genome appears as a strip. Each rung is one gene: body size, speed, sensing range, colour, how it feeds, organs, and every single weight of its decision network. The genome in this game is a list of these numeric traits; it is not a real nucleotide sequence. The strip's shape (helix, ladder, stack, sheet…) comes from this planet's heredity polymer; it does not have to be DNA."],
    target: "#cr-dna .dna-wrap",
    wide: true,
  },
  {
    tr: ["Bir gene dokunun", "Her basamak tıklanabilir. Şimdi üçüncü basamağa tıklıyorum: o genin açıklaması bir kart olarak açılır."],
    en: ["Tap a gene", "Every rung is clickable. I'm clicking the third rung now: that gene's description opens as a card."],
    target: "#cr-dna rect.dna-hit:nth-of-type(3)",
    click: true,
  },
  {
    tr: ["Gen kartı", "Kart genin ne işe yaradığını, değer aralığını ve ilk canlıdaki ile şimdiki değerini gösterir. Aynı basamağa yeniden ya da ✕ düğmesine basarsanız kapanır; başka bir basamağa basarsanız o açılır. Karar ağının ağırlıkları da böyle birer gendir."],
    en: ["The gene card", "The card shows what the gene does, its range, and its value in the first creature and now. Click the same rung again or the ✕ button to close it; click another rung to open that one. The decision network's weights are genes like this too."],
    target: "#cr-dna .gene-card",
    wide: true,
  },
  {
    tr: ["Renkler ve mutasyon", "Parlak basamaklar ilk canlıdan kalanlar, mor olanlar mutasyonla değişenler, turuncular sonradan kazanılan organ genleridir. Yavru, ebeveynin genomunun kopyasıdır; kopyalama nadiren ve rastgele bozulur. Hangi değişimin kalacağını mutasyon değil, çevre (açlık, avcı, rakip) belirler. Kopyalama hatası çarpanı polimere göre değişir."],
    en: ["Colours and mutation", "Bright rungs are inherited from the first creature, purple ones changed by mutation, orange ones are organ genes gained later. The offspring is a copy of the parent's genome; copying occasionally and randomly goes wrong. Mutation does not decide which change stays; the environment (hunger, predators, rivals) does. The copy-error multiplier depends on the polymer."],
    target: "#cr-dna .legend",
    wide: true,
  },
  {
    tr: ["Genel sekmesi", "Genel sekmesi gezegenin özetidir: nüfus, tür sayısı, nesil, kullanılan kimya, atmosfer, basınç ve yaşamın nasıl başladığı. “Hücre yapısını incele” gezegenin ilk hücresini açar."],
    en: ["Overview tab", "The Overview tab summarises the planet: population, species count, generations, the chemistry in use, the atmosphere, the pressure and how life began. “Inspect cell structure” opens the planet's first cell."],
    target: '[data-tab="overview"]',
    click: true,
  },
  {
    tr: ["Tarih sekmesi", "Gezegenin dönüm noktaları burada: ilk çok hücreli, ilk avcı, ilk eşeyli üreme. Bir noktaya tıklayıp “Bu ana dön” derseniz oyun o ana geri sarılır; sonrası yeniden yaşanır. Yanlışlıkla olduysa “Geri sarmayı geri al” ile dönersiniz."],
    en: ["History tab", "The planet's milestones are here: first multicellular life, first predator, first sexual reproduction. Click a milestone and choose “Return to this moment” and the game rewinds to it; what follows is lived again. If it was a mistake, “Undo the rewind” brings it back."],
    target: '[data-tab="history"]',
    click: true,
  },
  {
    tr: ["Türler sekmesi", "Birbirine benzeyen canlılar bir tür sayılır. Burada her türün sayısı, soyu ve ne zaman ortaya çıktığı görünür. Bir türe tıklarsanız tür kartı açılır, haritada o tür vurgulanır."],
    en: ["Species tab", "Creatures that resemble each other count as one species. Here you see each species' numbers, ancestry and when it appeared. Click a species to open its card and highlight it on the map."],
    target: '[data-tab="species"]',
    click: true,
  },
  {
    tr: ["Organlar sekmesi", "Canlılar zamanla yüzgeç, göz, kanat, kabuk gibi organlar kazanır. Bu sekme hangi organın kaç canlıda olduğunu ve her organın ne işe yaradığını gösterir. Bazı organlar bu gezegenin kimyasıyla kurulamaz."],
    en: ["Organs tab", "Over time creatures gain organs such as fins, eyes, wings and shells. This tab shows how many creatures have each organ and what it does. Some organs cannot be built with this planet's chemistry."],
    target: '[data-tab="organs"]',
    click: true,
  },
  {
    tr: ["Günlük sekmesi", "Olup biten her şey burada yazılır: doğumlar, ölümler, hastalıklar, yeni türler, felaketler. Üstteki süzgeçle yalnızca bir tür olayı görebilirsiniz."],
    en: ["Log tab", "Everything that happens is written here: births, deaths, diseases, new species, disasters. Use the filter at the top to see only one kind of event."],
    target: '[data-tab="log"]',
    click: true,
  },
  {
    tr: ["Zaman yolculuğu", "Oyun arka planda düzenli anlık kayıtlar alır. Kaydırıcıyla geçmiş bir ana gidip “Bu ana dön” derseniz oyun oradan devam eder. Sonrası silinir, ama “Geri al” düğmesi görünür ve vazgeçebilirsiniz."],
    en: ["Time travel", "The game takes regular snapshots in the background. Drag the slider to a past moment and press “Return to this moment” and the game continues from there. What came after is erased, but an “Undo” button appears so you can change your mind."],
    target: ".timeline",
    wide: true,
  },
  {
    tr: ["Oyun modu", "Normalde yalnızca izlersiniz. “Oyun” düğmesi ise sol kenara müdahale araçları getirir ve tahmin sorularını açar. Şimdi açıyorum."],
    en: ["Game mode", "Normally you only watch. The “Game” button brings intervention tools to the left edge and turns on the prediction questions. I'm turning it on now."],
    target: "#btn-game",
    click: true,
    skipIf: (ctx) => ctx.gameMode(),
  },
  {
    tr: ["Müdahale araçları", "Sol kenardaki araçlar: bitki ek, canlı yerleştir, meteor düşür, canlıyı kaldır, besin boya, radyasyon fırçası; altında iklim dalgası, rüzgâr ve deprem. Bir aracı seçip haritaya tıklarsınız. Radyasyon fırçası canlıların genlerini zorla mutasyona uğratır; sonucunu genom şeridinde mor basamaklar olarak görürsünüz. Her araçla yaşamın nasıl tepki verdiğini deneyin."],
    en: ["Intervention tools", "The tools on the left edge: add plants, place a creature, drop a meteor, remove a creature, paint nutrients, a radiation brush; below them a climate wave, wind and an earthquake. Pick a tool and click the map. The radiation brush forces mutations into creatures' genes; you will see the result as purple rungs on the genome strip. Try each and see how life reacts."],
    target: '[data-tool="meteor"]',
    wide: true,
  },
  {
    tr: ["Soy ağacı", "Bütün türlerin birbirinden nasıl ayrıldığını bir ağaç olarak gösterir. Çizgi rengi beslenme biçimini, kalınlığı en yüksek nüfusu anlatır. Bir türe tıklayınca kartı açılır."],
    en: ["Family tree", "Shows how all the species branched from one another as a tree. Line colour shows how they feed, thickness the peak population. Click a species to open its card."],
    target: "#btn-tree",
  },
  {
    tr: ["Kaynakça", "Oyundaki her kimya seçeneğinin, köken senaryosunun ve organ malzemesinin dayandığı yayınlar burada listelenir. Aynı pencerede neyin yayına dayandığı, neyin ayarlandığı da açıkça yazar."],
    en: ["References", "The publications behind every chemistry option, origin scenario and organ material are listed here. The same window says plainly what rests on publications and what was tuned."],
    target: "#btn-refs",
  },
  {
    tr: ["Ses", "Müziği ve ses efektlerini açıp kapatır."],
    en: ["Sound", "Turns the music and sound effects on and off."],
    target: "#btn-sound",
  },
  {
    tr: ["Kayıt", "Oyun her 20 saniyede bir kendiliğinden kaydeder; sayfayı kapatıp açsanız kaldığınız yerden devam edersiniz. Bu düğmeyle kaydı dosya olarak indirir ya da bir dosyadan yüklersiniz."],
    en: ["Save", "The game saves itself every 20 seconds, so if you close and reopen the page you continue where you left off. This button downloads the save as a file or loads one from a file."],
    target: "#btn-save",
  },
  {
    tr: ["Yeni gezegen", "Başka bir tohumla yepyeni bir gezegen başlatır; kimya, sıvı, harita ve ilk hücre değişir. Önce açılışta bir film oynar: yaşamın nasıl başladığını anlatır. Gün ışığı, yüzey basıncı ve köken enerjisi gibi bilgiler de burada görünür."],
    en: ["New planet", "Starts a brand-new planet from another seed; the chemistry, liquid, map and first cell all change. First a short film plays, telling how life began. Details such as daylight, surface pressure and origin energy show up here too."],
    target: "#btn-new",
  },
  {
    tr: ["Hepsi bu", "Artık dünyayı izlemeye başlayabilirsiniz. Önce 8× deneyin, sonra bir canlıyı seçip yapısını inceleyin; Tarih sekmesinde dönüm noktalarını görün. Bu rehbere her zaman sağ üstteki “Rehber” düğmesinden dönebilirsiniz."],
    en: ["That's all", "You can start watching the world now. Try 8× first, then pick a creature and inspect its structure; see the milestones in the History tab. You can return to this guide any time with the “Guide” button at the top."],
    target: "#btn-tour",
  },
];

const LABELS = {
  tr: { dev: "Erdem", next: "İleri", back: "Geri", close: "Kapat", done: "Bitti" },
  en: { dev: "Erdem", next: "Next", back: "Back", close: "Close", done: "Done" },
};

const ARROW =
  '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M4 2.5l15.5 9.2-6.9 1.5-3.2 6.6z" fill="#fff" stroke="#0b0f19" stroke-width="1.6" stroke-linejoin="round"/></svg>';

const sleep = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

export class Tour {
  private root: HTMLElement | null = null;
  private cursor!: HTMLElement;
  private ring!: HTMLElement;
  private card!: HTMLElement;
  private index = 0;
  private run = 0;
  private open = false;
  private saved: { speed: number; game: boolean; tab: string } | null = null;
  private steps: Step[] = STEPS;

  constructor(private readonly ctx: TourContext) {}

  public get isOpen(): boolean {
    return this.open;
  }

  public start(): void {
    // Gezegen oluşturma ekranı açıkken rehber o ekranı da anlatır; oyun içinden başlatılınca o adımlar atlanır.
    const stage = (document.getElementById("dlg-planet") as HTMLDialogElement | null)?.open === true;
    if (this.open || (!stage && !this.ctx.ready())) return;
    this.steps = STEPS.filter((st) => stage || !st.planet);
    this.open = true;
    this.saved = { speed: this.ctx.speed(), game: this.ctx.gameMode(), tab: this.ctx.tab() };
    this.ctx.setSpeed(1);
    this.build();
    this.index = 0;
    void this.show();
  }

  public stop(): void {
    if (!this.open) return;
    this.open = false;
    this.run++;
    document.removeEventListener("keydown", this.onKey, true);
    window.removeEventListener("resize", this.onResize);
    this.root?.hidePopover?.();
    this.root?.remove();
    this.root = null;
    const s = this.saved;
    const insp = document.getElementById("dlg-inspect") as HTMLDialogElement | null;
    if (insp?.open) {
      if (this.root) document.body.appendChild(this.root);
      insp.close();
    }
    // Rehberin açtığı gen kartı kapatılır.
    document.querySelector<HTMLElement>("#cr-dna .gene-card .x")?.click();
    if (s) {
      this.ctx.clearSelection();
      this.ctx.setGame(s.game);
      this.ctx.setTab(s.tab);
      this.ctx.setSpeed(s.speed);
    }
    this.saved = null;
    try {
      localStorage.setItem("evosim-tour-seen", "1");
    } catch {
      // depolama kapalıysa yalnızca bu oturumda hatırlanır
    }
  }

  private lang(): "tr" | "en" {
    return getLang() === "en" ? "en" : "tr";
  }

  private build(): void {
    const root = document.createElement("div");
    root.id = "tour";
    root.setAttribute("popover", "manual");
    root.innerHTML =
      `<div class="tour-ring"></div>` +
      `<div class="tour-cursor">${ARROW}<span class="tour-name"></span></div>` +
      `<div class="tour-card" role="dialog" aria-live="polite"><div class="tour-step"></div><h3></h3><p></p>` +
      `<div class="tour-dots"></div><div class="tour-actions"><button type="button" class="btn btn-small" data-t="back"></button><button type="button" class="btn btn-small tour-next" data-t="next"></button><button type="button" class="btn btn-small" data-t="close"></button></div></div>`;
    document.body.appendChild(root);
    root.showPopover?.();
    this.root = root;
    this.cursor = root.querySelector<HTMLElement>(".tour-cursor")!;
    this.ring = root.querySelector<HTMLElement>(".tour-ring")!;
    this.card = root.querySelector<HTMLElement>(".tour-card")!;
    root.querySelector<HTMLElement>(".tour-name")!.textContent = LABELS[this.lang()].dev;
    root.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-t]");
      if (!b) return;
      if (b.dataset.t === "close") this.stop();
      else if (b.dataset.t === "next") this.go(this.index + 1);
      else this.go(this.index - 1);
    });
    document.addEventListener("keydown", this.onKey, true);
    window.addEventListener("resize", this.onResize);
    // İmleç ekranın ortasından doğar.
    this.place(this.cursor, window.innerWidth / 2, window.innerHeight / 2, true);
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (!this.open) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      this.stop();
    } else if (e.key === "ArrowRight") this.go(this.index + 1);
    else if (e.key === "ArrowLeft") this.go(this.index - 1);
  };

  private readonly onResize = (): void => {
    if (this.open) void this.show(true);
  };

  private go(to: number): void {
    if (to >= this.steps.length) {
      this.stop();
      return;
    }
    this.index = Math.max(0, to);
    void this.show();
  }

  private place(el: HTMLElement, x: number, y: number, instant = false): void {
    if (instant) el.style.transition = "none";
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    if (instant) {
      void el.offsetWidth;
      el.style.transition = "";
    }
  }

  /** Bir adımı gösterir: önce yazı, sonra imleç hedefe gider ve (varsa) tıklar. */
  private async show(quick = false): Promise<void> {
    const token = ++this.run;
    const step = this.steps[this.index];
    if (!step.planet && !step.anyStage && !this.ctx.ready()) {
      await this.untilReady(token);
      if (token !== this.run) return;
    }
    // Açık bir pencere varsa rehber onun içinde, yoksa sayfada durur (kip pencereleri dışını tıklanamaz yapar).
    const want = Array.from(document.querySelectorAll<HTMLDialogElement>("dialog[open]")).pop() ?? document.body;
    if (this.root && this.root.parentElement !== want) this.raise();
    const L = LABELS[this.lang()];
    const text = step[this.lang()];
    this.card.querySelector("h3")!.textContent = text[0];
    this.card.querySelector("p")!.textContent = text[1];
    this.card.querySelector(".tour-step")!.textContent = `${this.index + 1} / ${this.steps.length}`;
    this.card.querySelector<HTMLElement>('[data-t="back"]')!.textContent = L.back;
    this.card.querySelector<HTMLElement>('[data-t="close"]')!.textContent = L.close;
    const next = this.card.querySelector<HTMLElement>('[data-t="next"]')!;
    next.textContent = this.index === this.steps.length - 1 ? L.done : L.next;
    this.card.querySelector<HTMLButtonElement>('[data-t="back"]')!.disabled = this.index === 0;
    this.card.querySelector(".tour-dots")!.innerHTML = this.steps.map((_, i) => `<i class="${i === this.index ? "on" : i < this.index ? "past" : ""}"></i>`).join("");
    this.root?.querySelector<HTMLElement>(".tour-name")!.replaceChildren(L.dev);

    // Yapı penceresi yalnızca ona ait adımlarda açık durur.
    const dlg = document.getElementById("dlg-inspect") as HTMLDialogElement | null;
    if (dlg) {
      if (!step.inspect && dlg.open) {
        this.root && document.body.appendChild(this.root);
        dlg.close();
        this.raise();
      }
      else if (step.inspect && !dlg.open) {
        document.querySelector<HTMLElement>('[data-action="inspect"]')?.click();
        this.raise();
        await sleep(quick ? 0 : 450);
        if (token !== this.run) return;
      }
    }

    // Hedefi bul (dar ekranda görünür kıl).
    let point: { x: number; y: number; w: number; h: number } | null = null;
    let pick: (() => void) | null = null;
    let creatureId = 0;
    if (step.creature) {
      const c = this.ctx.pickCreature();
      if (c) {
        point = { x: c.x, y: c.y, w: 40, h: 40 };
        pick = c.pick;
        creatureId = c.id;
      }
    } else if (step.target) {
      const el = document.querySelector<HTMLElement>(step.target);
      if (el) {
        if (!quick) el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
        await sleep(quick ? 0 : 250);
        if (token !== this.run) return;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) point = { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
      }
    }
    if (token !== this.run) return;
    if (!point) point = { x: window.innerWidth / 2, y: window.innerHeight / 2, w: 0, h: 0 };

    // Halka ve kart yeri.
    const ring = this.ring;
    if (step.target || step.creature) {
      const pad = step.wide ? 4 : 6;
      ring.style.opacity = "1";
      ring.style.width = `${Math.max(34, point.w + pad * 2)}px`;
      ring.style.height = `${Math.max(34, point.h + pad * 2)}px`;
      ring.style.transform = `translate(${Math.round(point.x - Math.max(34, point.w + pad * 2) / 2)}px, ${Math.round(point.y - Math.max(34, point.h + pad * 2) / 2)}px)`;
    } else ring.style.opacity = "0";
    this.card.dataset.pos = point.y > window.innerHeight * 0.5 && step.target !== "#btn-tour" ? "top" : "bottom";

    // İmleç hedefe kayar; kuyruğu hedefin içinde kalacak biçimde biraz sağ-alta.
    this.cursor.classList.toggle("flip", point.x > window.innerWidth - 120);
    this.place(this.cursor, point.x - 4, point.y - 3, quick);
    if (quick) return;
    await sleep(1000);
    if (token !== this.run) return;
    if (pick) {
      // Canlı bu bir saniyede kımıldadı: imleç son konuma kısa bir kayışla varır, sonra tıklar.
      const again = this.ctx.pickCreature(creatureId);
      if (again) {
        this.place(this.cursor, again.x - 4, again.y - 3);
        this.ring.style.transform = `translate(${Math.round(again.x - 23)}px, ${Math.round(again.y - 23)}px)`;
        await sleep(450);
        if (token !== this.run) return;
        pick = again.pick;
      }
      this.ripple();
      pick();
      return;
    }
    if (step.click !== false && step.target && step.click && !(step.skipIf && step.skipIf(this.ctx))) {
      const el = document.querySelector<HTMLElement>(typeof step.click === "string" ? step.click : step.target);
      if (el) {
        this.ripple();
        // SVG öğelerinde click() yoktur (gen basamakları); olay elle gönderilir.
        if (typeof el.click === "function") el.click();
        else el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
        // Tıklama bir pencere açtıysa rehber yine en üste alınır.
        this.raise();
        if (step.startGame) {
          await this.untilReady(token);
          if (token !== this.run) return;
          await sleep(900);
          if (token !== this.run) return;
          this.go(this.index + 1);
        }
      }
    }
  }

  /** Oyun hazır olana kadar bekler; köken filmi görünürse atlar. */
  private async untilReady(token: number): Promise<void> {
    for (let i = 0; i < 60 && token === this.run; i++) {
      if (this.ctx.ready()) return;
      document.querySelector<HTMLElement>("#film:not([hidden]) #film-skip")?.click();
      await sleep(250);
    }
  }

  /** Üst katman sırasında en öne alır (sonradan açılan pencerelerin üstüne çıkmak için). */
  private raise(): void {
    const r = this.root;
    if (!r) return;
    // Açık bir kip penceresi (showModal) dışındaki her şeyi tıklanamaz yapar; rehber o pencerenin içine alınır.
    // Üst katmandaki öğenin konumu pencereden etkilenmez.
    const open = Array.from(document.querySelectorAll<HTMLDialogElement>("dialog[open]")).pop();
    // Öğe taşınınca açılır pencere durumu kendiliğinden kapanır; yeni yerinde yeniden gösterilir.
    (open ?? document.body).appendChild(r);
    try {
      r.showPopover();
    } catch {
      /* zaten açıksa sorun değil */
    }
  }

  private ripple(): void {
    this.cursor.classList.remove("click");
    void this.cursor.offsetWidth;
    this.cursor.classList.add("click");
  }
}

export function tourSeen(): boolean {
  try {
    return localStorage.getItem("evosim-tour-seen") === "1";
  } catch {
    return true;
  }
}

const GREET = {
  tr: {
    title: "Simülasyona yeni başlıyor gibisin",
    text: "Emin ol, bu simülasyonda Rehber'e ihtiyaç duyacaksın. Yardım edeyim mi?",
    yes: "Evet",
    no: "Hayır",
    later: "Tamam. Rehber düğmesi burada; canın isteyince basarsın, ben beklerim.",
    laterPlanet: "Tamam. Hazır olunca “Simülasyonu başlat”a bas. Oyunda üst çubuktaki Rehber düğmesi seni bekliyor olacak.",
  },
  en: {
    title: "You look new to the simulation",
    text: "Trust me, you're going to want the guide in here. Shall I help?",
    yes: "Yes",
    no: "No",
    later: "Okay. The Guide button is right here; press it whenever you like, I'll be waiting.",
    laterPlanet: "Okay. Press “Start the simulation” when you're ready. In the game, the Guide button in the top bar will be waiting for you.",
  },
};

/** Soru, Rehber bir kez bitirilene (ya da kapatılana) dek her açılışta sorulur; "Hayır" yalnızca o oturum için hatırlanır. */
export function greeted(): boolean {
  if (tourSeen()) return true;
  try {
    return sessionStorage.getItem("evosim-greeted") === "1";
  } catch {
    return false;
  }
}

/**
 * Oyuna girince Erdem imleci gelir ve rehbere ihtiyaç olup olmadığını sorar. Soru yanıtlanana kadar ekrandaki
 * hiçbir yere basılamaz. Evet: rehber başlar. Hayır: imleç Rehber düğmesini gösterir ve çekilir.
 */
export function greet(tour: Tour): void {
  if (document.getElementById("greet") || tour.isOpen) return;
  const L = GREET[getLang() === "en" ? "en" : "tr"];
  const lang = getLang() === "en" ? "en" : "tr";
  const root = document.createElement("div");
  root.id = "greet";
  root.setAttribute("popover", "manual");
  root.innerHTML =
    `<div class="tour-ring"></div>` +
    `<div class="tour-cursor">${ARROW}<span class="tour-name">${LABELS[lang].dev}</span></div>` +
    `<div class="tour-card greet-card" role="alertdialog" aria-live="assertive" data-pos="bottom"><h3>${L.title}</h3><p>${L.text}</p>` +
    `<div class="tour-actions"><button type="button" class="btn btn-small btn-primary" data-g="yes">${L.yes}</button><button type="button" class="btn btn-small" data-g="no">${L.no}</button></div></div>`;
  // Gezegen penceresi gibi bir kip penceresi açıksa soru onun içinde durur (aksi hâlde tıklanamaz).
  (Array.from(document.querySelectorAll<HTMLDialogElement>("dialog[open]")).pop() ?? document.body).appendChild(root);
  root.showPopover?.();
  const cursor = root.querySelector<HTMLElement>(".tour-cursor")!;
  const ring = root.querySelector<HTMLElement>(".tour-ring")!;
  const card = root.querySelector<HTMLElement>(".greet-card")!;
  const put = (x: number, y: number, instant = false): void => {
    if (instant) cursor.style.transition = "none";
    cursor.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    if (instant) {
      void cursor.offsetWidth;
      cursor.style.transition = "";
    }
  };
  const mark = (on: boolean): void => {
    try {
      if (on) sessionStorage.setItem("evosim-greeted", "1");
    } catch {
      /* depolama kapalıysa yalnızca bu oturum */
    }
  };
  const swallow = (e: KeyboardEvent): void => {
    if (e.key === "Tab" || e.key === "Enter" || e.key === " ") return;
    e.stopPropagation();
    e.preventDefault();
  };
  document.addEventListener("keydown", swallow, true);
  const done = (): void => {
    document.removeEventListener("keydown", swallow, true);
    root.hidePopover?.();
    root.remove();
  };
  // İmleç ekranın dışından gelir, kartın üst köşesine yerleşir.
  card.style.opacity = "0";
  put(window.innerWidth + 40, window.innerHeight * 0.3, true);
  window.setTimeout(() => {
    const r = card.getBoundingClientRect();
    put(r.left + 36, r.top - 26);
    card.style.transition = "opacity 0.25s";
    card.style.opacity = "1";
    root.querySelector<HTMLElement>('[data-g="yes"]')?.focus({ preventScroll: true });
  }, 20);
  root.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-g]");
    if (!b) return;
    mark(true);
    if (b.dataset.g === "yes") {
      card.style.opacity = "0";
      // İmleç ekranın ortasına süzülür; rehber de oradan başlar.
      put(window.innerWidth / 2, window.innerHeight / 2);
      window.setTimeout(() => {
        done();
        tour.start();
      }, 800);
      return;
    }
    // Hayır: engel kalkar, imleç Rehber düğmesini gösterir.
    root.classList.add("free");
    const inPlanet = (document.getElementById("dlg-planet") as HTMLDialogElement | null)?.open === true;
    const btn = document.getElementById(inPlanet ? "planet-start" : "btn-tour");
    card.querySelector("h3")!.textContent = "";
    card.querySelector("p")!.textContent = inPlanet ? L.laterPlanet : L.later;
    card.querySelector(".tour-actions")!.remove();
    card.dataset.pos = "bottom";
    if (btn) {
      const br = btn.getBoundingClientRect();
      const w = Math.max(34, br.width + 12);
      const h = Math.max(34, br.height + 12);
      ring.style.opacity = "1";
      ring.style.width = `${w}px`;
      ring.style.height = `${h}px`;
      ring.style.transform = `translate(${Math.round(br.left + br.width / 2 - w / 2)}px, ${Math.round(br.top + br.height / 2 - h / 2)}px)`;
      put(br.left + br.width / 2 - 4, br.top + br.height / 2 - 3);
      document.getElementById("btn-tour")?.classList.add("pulse");
    }
    window.setTimeout(done, 4200);
  });
}
