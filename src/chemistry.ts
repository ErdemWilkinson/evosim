import { makeRng } from "./rng";

/**
 * Gezegen kimyası: tohumdan deterministik türetilir. Her gezegen 22 elementlik
 * havuzdan 10 element alır; yüzey sıvısı (çözücü), canlının iskelet elementi, zarı,
 * hücre duvarı, kalıtım polimeri, enerji taşıyıcısı, katalizör metali ve ışık
 * pigmenti bu 10 elementle kurulabilenler arasından seçilir. Seçenekler astrobiyoloji
 * yazınında tartışılan gerçek önerilerdir (her birinin kaynağı `ref` alanındadır);
 * hangi gezegende hangisinin "gerçekten" çıkacağı ise bilinmez, burada kural basittir:
 * gereken elementler varsa aday olur, adaylar arasından ağırlıklı rastgele seçilir.
 */

export interface ElementInfo {
  sym: string;
  name: string;
  z: number;
  /** Elektron kabukları (K, L, M, N). */
  shells: number[];
  color: string;
  weight: number;
}

const el = (sym: string, name: string, z: number, shells: number[], color: string, weight: number): ElementInfo => ({ sym, name, z, shells, color, weight });

/** Ağırlıklar kabaca kozmik/kayaç bolluğunu izler: hafif ve kaya yapıcı elementler sık çıkar. */
export const ELEMENTS: Record<string, ElementInfo> = Object.fromEntries(
  [
    el("H", "Hidrojen", 1, [1], "#e8eef5", 15),
    el("B", "Bor", 5, [2, 3], "#f2b8a8", 1.5),
    el("C", "Karbon", 6, [2, 4], "#8a93a3", 11),
    el("N", "Azot", 7, [2, 5], "#6f8dfa", 8),
    el("O", "Oksijen", 8, [2, 6], "#f2685f", 12),
    el("F", "Flor", 9, [2, 7], "#9be36b", 2),
    el("Na", "Sodyum", 11, [2, 8, 1], "#b18cf0", 4),
    el("Mg", "Magnezyum", 12, [2, 8, 2], "#7fd88b", 5),
    el("Al", "Alüminyum", 13, [2, 8, 3], "#c9b8c4", 4),
    el("Si", "Silisyum", 14, [2, 8, 4], "#e2c08a", 6),
    el("P", "Fosfor", 15, [2, 8, 5], "#f59a3c", 3),
    el("S", "Kükürt", 16, [2, 8, 6], "#f1d84a", 5),
    el("Cl", "Klor", 17, [2, 8, 7], "#57d9a3", 3),
    el("K", "Potasyum", 19, [2, 8, 8, 1], "#a78bdb", 3),
    el("Ca", "Kalsiyum", 20, [2, 8, 8, 2], "#b9d77a", 4),
    el("Ti", "Titanyum", 22, [2, 8, 10, 2], "#b8c2cc", 2),
    el("Mn", "Manganez", 25, [2, 8, 13, 2], "#b58ad6", 2),
    el("Fe", "Demir", 26, [2, 8, 14, 2], "#e08a4f", 6),
    el("Ni", "Nikel", 28, [2, 8, 16, 2], "#6fcf7a", 2),
    el("Cu", "Bakır", 29, [2, 8, 18, 1], "#d98f5c", 1.5),
    el("Zn", "Çinko", 30, [2, 8, 18, 2], "#8f9bd1", 1.5),
    el("Mo", "Molibden", 42, [2, 8, 18, 13, 1], "#6fc7c2", 1),
  ].map((e) => [e.sym, e])
);

export interface Option {
  id: string;
  name: string;
  /** Gereken elementler. */
  needs: string[];
  /** Kısa açıklama: yapının ne olduğu ve nasıl çalıştığı. */
  note: string;
  /** Yazındaki dayanak. */
  ref: string;
  weight?: number;
}

export interface Solvent extends Option {
  /** 1 bar civarında sıvı kaldığı aralık (K). */
  range: [number, number];
  /** Harita rengi (ton, doygunluk). */
  hue: number;
  sat: number;
  /** Kutupsal mı? Zar seçimini belirler. */
  polar: boolean;
  /** Belirtme hâli ek: "… denizinde". */
  sea: string;
}

export const SOLVENTS: Solvent[] = [
  { id: "water", name: "Su", needs: ["H", "O"], range: [273, 373], hue: 200, sat: 0.75, polar: true, sea: "su", weight: 5, note: "Kutupsal, hidrojen bağı kuran çözücü; tuzları ve yüklü molekülleri çözer, yağları dışlayarak zarların kendiliğinden kurulmasını sağlar.", ref: "Benner, Ricardo & Carrigan 2004, Curr. Opin. Chem. Biol. 8:672" },
  { id: "ammonia", name: "Amonyak", needs: ["N", "H"], range: [195, 240], hue: 265, sat: 0.5, polar: true, sea: "amonyak", weight: 3, note: "Suya benzeyen kutupsal çözücü ama çok daha soğukta sıvı; tepkimeler yavaştır, karbonil kimyasının yerini imin (C=N) kimyası alır.", ref: "Benner, Ricardo & Carrigan 2004; Haldane 1954" },
  { id: "methane", name: "Metan–etan", needs: ["C", "H"], range: [91, 112], hue: 28, sat: 0.55, polar: false, sea: "metan–etan", weight: 3, note: "Kutupsuz kriyojenik çözücü (Titan denizleri gibi). Yağ zarları burada çözünür; zar, kutupsal başı içe dönük ters yapıda olmak zorundadır.", ref: "McKay & Smith 2005, Icarus 178:274; Stevenson, Lunine & Clancy 2015, Sci. Adv. 1:e1400067" },
  { id: "sulfuric", name: "Sülfürik asit", needs: ["H", "S", "O"], range: [283, 610], hue: 52, sat: 0.6, polar: true, sea: "sülfürik asit", weight: 2, note: "Çok asidik, sıcak çözücü. Çoğu şeker ve protein parçalanır; dayanıklı halkalı ve silisyumlu bileşikler ise kararlı kalır.", ref: "Bains, Petkowski, Zhan & Seager 2021, Life 11:400" },
  { id: "formamide", name: "Formamid", needs: ["C", "H", "N", "O"], range: [275, 483], hue: 150, sat: 0.45, polar: true, sea: "formamid", weight: 2, note: "Geniş sıcaklık aralığında sıvı kalan kutupsal çözücü; mineral yüzeylerde ısıtılınca nükleobaz ve amino asit öncülleri verir, fosfodiester bağını suya göre daha az parçalar.", ref: "Saladino, Crestini, Pino, Costanzo & Di Mauro 2012, Phys. Life Rev. 9:84" },
  { id: "hf", name: "Hidrojen florür", needs: ["H", "F"], range: [190, 293], hue: 95, sat: 0.5, polar: true, sea: "hidrojen florür", weight: 1.5, note: "Güçlü hidrojen bağı kuran kutupsal çözücü; kozmik olarak flor az olduğu için nadir sayılır.", ref: "Schulze-Makuch & Irwin 2008, Life in the Universe (2. baskı)" },
  { id: "h2s", name: "Hidrojen sülfür", needs: ["H", "S"], range: [187, 213], hue: 68, sat: 0.4, polar: true, sea: "hidrojen sülfür", weight: 1.5, note: "Suyun kükürtlü akrabası; daha zayıf kutupsal, dar bir soğuk aralıkta sıvı.", ref: "Schulze-Makuch & Irwin 2008; Bains 2004, Astrobiology 4:137" },
  { id: "co2", name: "Sıvı karbondioksit", needs: ["C", "O"], range: [217, 304], hue: 182, sat: 0.3, polar: false, sea: "karbondioksit", weight: 1, note: "Yüksek basınç altında sıvı ya da süperkritik; kutupsuz organikleri iyi çözer, bazı enzimler içinde çalışmayı sürdürür.", ref: "Budisa & Schulze-Makuch 2014, Life 4:331" },
  { id: "nitrogen", name: "Sıvı azot", needs: ["N"], range: [63, 77], hue: 225, sat: 0.35, polar: false, sea: "sıvı azot", weight: 0.5, note: "Aşırı soğuk kutupsuz çözücü; karbon bileşikleri çözünmez ama silanoller (Si–OH) çözünebilir, bu yüzden silisyum kimyası için önerilir.", ref: "Bains 2004, Astrobiology 4:137" },
  { id: "sulfur", name: "Erimiş kükürt", needs: ["S"], range: [388, 718], hue: 40, sat: 0.8, polar: false, sea: "erimiş kükürt", weight: 0.6, note: "Volkanik dünyalarda göller oluşturabilen sıcak, kutupsuz sıvı; sıcaklıkla rengi sarıdan kırmızıya döner.", ref: "Schulze-Makuch & Irwin 2008 (Io için tartışma)" },
];

export const SCAFFOLDS: Option[] = [
  { id: "carbon", name: "Karbon", needs: ["C"], weight: 6, note: "Dört bağ yapan, kendisiyle uzun kararlı zincirler ve halkalar kuran iskelet elementi.", ref: "Pace 2001, PNAS 98:805" },
  { id: "silicon", name: "Silisyum", needs: ["Si", "O"], weight: 2, note: "İskelet Si–O–Si (siloksan) zincirleridir; suda kolay parçalanır, asitte ve çok soğuk çözücülerde daha kararlıdır.", ref: "Petkowski, Bains & Seager 2020, Life 10:84" },
  { id: "boron", name: "Bor–azot", needs: ["B", "N"], weight: 1, note: "B–N çifti C–C çiftiyle eş elektronludur; borazin halkaları benzenin karşılığıdır. Bor kozmik olarak çok azdır.", ref: "Schulze-Makuch & Irwin 2008" },
];

export const MEMBRANES: (Option & { polar: boolean | null; scaffold?: string })[] = [
  { id: "phospholipid", name: "Fosfolipit çift katman", needs: ["C", "H", "O", "P"], polar: true, scaffold: "carbon", weight: 4, note: "Fosfat başlar çözücüye, yağ kuyrukları içe döner; iki katman sırt sırta verir.", ref: "Deamer 2017, Life 7:5" },
  { id: "fattyacid", name: "Yağ asidi vezikülü", needs: ["C", "H", "O"], polar: true, scaffold: "carbon", weight: 3, note: "Tek zincirli yağ asitleri kendiliğinden kese oluşturur; geçirgendir, büyüyüp bölünebilir.", ref: "Hanczyc, Fujikawa & Szostak 2003, Science 302:618" },
  { id: "etherlipid", name: "Eter lipit tek katman", needs: ["C", "H", "O"], polar: true, scaffold: "carbon", weight: 2, note: "İki ucu baş olan dallı zincirler zarı boydan boya geçer; sıcağa ve aside dayanır (arkelerdeki gibi).", ref: "Valentine 2007, Nat. Rev. Microbiol. 5:316" },
  { id: "azotosome", name: "Azotozom (akrilonitril zar)", needs: ["C", "H", "N"], polar: false, scaffold: "carbon", weight: 4, note: "Ters zar: azotlu kutupsal uçlar içte kenetlenir, kısa karbon uçları kutupsuz çözücüye bakar. Hesaplamayla önerildi; sonraki bir çalışma kendiliğinden kurulamayabileceğini gösterdi.", ref: "Stevenson, Lunine & Clancy 2015, Sci. Adv. 1:e1400067; karşı görüş: Sandström & Rahm 2020, Sci. Adv. 6:eaax0272" },
  { id: "peptide", name: "Amfifilik peptit kabuğu", needs: ["C", "H", "N", "O"], polar: null, scaffold: "carbon", weight: 1.5, note: "Bir ucu çözücüyü seven, öbür ucu sevmeyen kısa peptitler yan yana dizilip kese kurar.", ref: "Zhang 2012, Acc. Chem. Res. 45:2142" },
  { id: "pah", name: "Halkalı karbon tabakası", needs: ["C", "H"], polar: null, scaffold: "carbon", weight: 1, note: "Düz, halkalı karbon molekülleri yan yana dizilip zarı sertleştirir ve geçirgenliğini azaltır; oksijen ya da azot gerektirmez.", ref: "Groen, Deamer, Kros & Ehrenfreund 2012, Orig. Life Evol. Biosph. 42:295" },
  { id: "siloxane", name: "Siloksan zar", needs: ["Si", "O"], polar: null, scaffold: "silicon", weight: 4, note: "Si–O–Si omurgalı esnek zincirler; yan gruplar çözücüye göre içe ya da dışa döner.", ref: "Petkowski, Bains & Seager 2020, Life 10:84" },
  { id: "pore", name: "Mineral gözenek bölmesi", needs: [], polar: null, weight: 0.6, note: "Zar yoktur; canlı kimya, mineral çökeltinin mikron boyu gözeneklerinde hapsolur ve gözenek duvarı zarın işini görür.", ref: "Martin & Russell 2003, Phil. Trans. R. Soc. B 358:59" },
];

export interface WallOption extends Option {
  hp: number;
  speed: number;
  meta: number;
}

export const WALLS: WallOption[] = [
  { id: "none", name: "Duvar yok (çıplak zar)", needs: [], hp: 0.9, speed: 1.08, meta: 0.97, weight: 2, note: "Hafif ve hızlıdır ama darbeye ve ozmotik basınca karşı korumasızdır.", ref: "Errington 2013, Open Biol. 3:120143 (duvarsız L-formlar)" },
  { id: "peptidoglycan", name: "Peptidoglikan ağ", needs: ["C", "H", "N", "O"], hp: 1.08, speed: 1, meta: 1.02, weight: 3, note: "Şeker zincirleri kısa peptit köprüleriyle çapraz bağlanır; tek parça bir ağ torba hücreyi sarar.", ref: "Vollmer, Blanot & de Pedro 2008, FEMS Microbiol. Rev. 32:149" },
  { id: "silica", name: "Silika kabuk", needs: ["Si", "O"], hp: 1.2, speed: 0.93, meta: 1.03, weight: 3, note: "Camsı SiO₂ kabuk; gözenekleri madde alışverişine izin verir (diyatom kabukları gibi).", ref: "Hildebrand 2008, Chem. Rev. 108:4855" },
  { id: "calcite", name: "Kalsit pullar", needs: ["Ca", "C", "O"], hp: 1.16, speed: 0.95, meta: 1.02, weight: 3, note: "Kalsiyum karbonat levhalar hücre yüzeyine döşenir (kokolitler gibi).", ref: "Young & Henriksen 2003, Rev. Mineral. Geochem. 54:189" },
  { id: "ironsulfide", name: "Demir-sülfür zırh", needs: ["Fe", "S"], hp: 1.22, speed: 0.9, meta: 1.05, weight: 2, note: "Greigit ve pirit taneleri yüzeye yerleşir; ağırdır ama serttir.", ref: "Warén, Bengtson, Goffredi & Van Dover 2003, Science 302:1007" },
  { id: "cellulose", name: "Polisakkarit lif duvar", needs: ["C", "H", "O"], hp: 1.1, speed: 0.98, meta: 1.01, weight: 2, note: "Uzun şeker zincirleri demetlenip lif oluşturur; çekmeye dayanıklıdır.", ref: "Cosgrove 2005, Nat. Rev. Mol. Cell Biol. 6:850" },
  { id: "borate", name: "Borat köprülü duvar", needs: ["B", "C", "O"], hp: 1.12, speed: 0.98, meta: 1.01, weight: 2, note: "Bor atomu iki şeker zincirini dört oksijen üzerinden birbirine kilitler.", ref: "O'Neill, Ishii, Albersheim & Darvill 2004, Annu. Rev. Plant Biol. 55:109" },
  { id: "slayer", name: "S-katman protein kafesi", needs: ["C", "H", "N", "O", "S"], hp: 1.05, speed: 1.02, meta: 1, weight: 2, note: "Tek tip proteinin kendiliğinden dizildiği iki boyutlu kristal kafes.", ref: "Sleytr, Schuster, Egelseer & Pum 2014, FEMS Microbiol. Rev. 38:823" },
  { id: "manganese", name: "Manganez oksit kın", needs: ["Mn", "O"], hp: 1.14, speed: 0.94, meta: 1.03, weight: 1.5, note: "Hücre çevresinde çöken koyu MnO₂ kabuk; oksitleyicilere ve ışınıma karşı kalkan olur.", ref: "Tebo ve ark. 2004, Annu. Rev. Earth Planet. Sci. 32:287" },
];

export interface GeneticOption extends Option {
  /** Kopyalama hatası çarpanı: büyüdükçe mutasyonlar sıklaşır. */
  error: number;
  /** Arayüzdeki çizim biçimi. */
  shape: "helix" | "ladder" | "stack" | "sheet" | "ribbon" | "cloud";
}

export const GENETICS: GeneticOption[] = [
  { id: "hachimoji", name: "Sekiz harfli fosfodiester polimer", needs: ["C", "N", "O", "P"], error: 0.8, shape: "helix", weight: 1.5, note: "Dört yerine sekiz baz, dört eşleşen çift: aynı uzunlukta daha çok bilgi taşır ve çift sarmal kararlı kalır.", ref: "Hoshika ve ark. 2019, Science 363:884" },
  { id: "tna", name: "Treoz nükleik asit", needs: ["C", "N", "O", "P"], error: 0.95, shape: "helix", weight: 1.5, note: "Omurgadaki şeker beş değil dört karbonludur; yapımı daha basittir, yine de bazlar eşleşip sarmal kurar.", ref: "Schöning ve ark. 2000, Science 290:1347" },
  { id: "gna", name: "Glikol nükleik asit", needs: ["C", "N", "O", "P"], error: 1, shape: "helix", weight: 1, note: "Omurga halkasızdır: üç karbonlu glikol birimleri fosfatla bağlanır; bilinen en yalın eşleşen polimerlerden biridir.", ref: "Zhang, Peritz & Meggers 2005, J. Am. Chem. Soc. 127:4174" },
  { id: "amyloid", name: "Amiloid peptit şablonu", needs: ["C", "N", "O"], error: 1.5, shape: "sheet", weight: 1.5, note: "Kısa peptitler üst üste dizilip lif kurar; lifin ucundaki dizilim, eklenen yeni peptidin dizilimini belirler.", ref: "Maury 2009, Orig. Life Evol. Biosph. 39:141" },
  { id: "phosphodiester", name: "Fosfodiester polimer (RNA benzeri)", needs: ["C", "N", "O", "P"], error: 0.9, shape: "helix", weight: 4, note: "Şeker–fosfat omurga üzerine dizili bazlar; omurgadaki tekrar eden yük, dizilim ne olursa olsun polimeri çözünür ve kopyalanabilir tutar.", ref: "Benner 2004, Acc. Chem. Res. 37:784" },
  { id: "pna", name: "Peptit nükleik asit", needs: ["C", "N", "O"], error: 1.05, shape: "ladder", weight: 3, note: "Omurga fosfatsızdır: amit bağlarıyla kurulur, bazlar yine eşleşir. Fosforun az olduğu dünyalar için önerilir.", ref: "Nelson, Levy & Miller 2000, PNAS 97:3868" },
  { id: "pahstack", name: "Halkalı karbon istif şablonu", needs: ["C", "H"], error: 1.3, shape: "stack", weight: 1, note: "Düz halkalar para gibi üst üste dizilir; kenarlarına tutunan yan grupların sırası bilgiyi taşır.", ref: "Ehrenfreund, Rasmussen, Cleaves & Chen 2006, Astrobiology 6:490" },
  { id: "clay", name: "Kil kristal geni", needs: ["Si", "O", "Al"], error: 1.4, shape: "sheet", weight: 2, note: "Kil tabakalarındaki yük ve kusur deseni, kristal büyürken alttaki tabakadan üsttekine kopyalanır.", ref: "Cairns-Smith 1982, Genetic Takeover and the Mineral Origins of Life" },
  { id: "polysilane", name: "Yan zincirli siloksan şerit", needs: ["Si", "O"], error: 1.2, shape: "ribbon", weight: 2, note: "Bilgi, Si–O omurgaya bağlı yan grupların sırasında tutulur; kuramsaldır.", ref: "Petkowski, Bains & Seager 2020, Life 10:84" },
  { id: "compositional", name: "Bileşimsel kalıtım", needs: [], error: 1.8, shape: "cloud", weight: 0.5, note: "Dizi yoktur; kesenin içindeki molekül karışımının oranları bölünmeyle yavruya geçer.", ref: "Segré, Ben-Eli & Lancet 2000, PNAS 97:4112" },
];

export const ENERGIES: Option[] = [
  { id: "polyphosphate", name: "Polifosfat (ATP benzeri)", needs: ["P", "O"], weight: 5, note: "Enerji, fosfat–fosfat (P–O–P) bağında taşınır; bağ koparken iş yapılır.", ref: "Kornberg, Rao & Ault-Riché 1999, Annu. Rev. Biochem. 68:89" },
  { id: "thioester", name: "Tiyoester", needs: ["C", "O", "S"], weight: 3, note: "Enerji, karbon–kükürt (C(=O)–S) bağında taşınır; fosfattan önceki enerji parası olabileceği öne sürülür.", ref: "de Duve 1991, Blueprint for a Cell" },
  { id: "sodium", name: "Sodyum gradyanı", needs: ["Na"], weight: 2, note: "Zarın iki yanındaki Na⁺ farkı bir pil gibi kullanılır.", ref: "Mulkidjanian, Dibrov & Galperin 2008, Biochim. Biophys. Acta 1777:985" },
  { id: "proton", name: "Proton gradyanı", needs: ["H"], weight: 2, note: "Zarın iki yanındaki H⁺ (asitlik) farkı enerji kaynağıdır.", ref: "Lane & Martin 2012, Cell 151:1406" },
  { id: "redox", name: "Mineral yüzeyde elektron aktarımı", needs: [], weight: 0.5, note: "Elektronlar doğrudan iletken mineral yüzeyden alınıp verilir.", ref: "Wächtershäuser 1988, Microbiol. Rev. 52:452" },
];

export const CATALYSTS: Option[] = [
  { id: "fes", name: "Demir–kükürt kümesi", needs: ["Fe", "S"], weight: 5, note: "Fe₄S₄ küpü: tek tek elektron alıp verir; en eski enzim merkezlerinden sayılır.", ref: "Beinert, Holm & Münck 1997, Science 277:653" },
  { id: "nickel", name: "Nikel merkezi", needs: ["Ni"], weight: 3, note: "Hidrojeni ve karbon monoksiti işleyen enzimlerin merkezindeki metal.", ref: "Ragsdale 2009, J. Biol. Chem. 284:18571" },
  { id: "copper", name: "Bakır merkezi", needs: ["Cu"], weight: 2, note: "Oksijenli ortamda elektron taşıyan ve oksijeni bağlayan metal.", ref: "Solomon ve ark. 2014, Chem. Rev. 114:3659" },
  { id: "zinc", name: "Çinko merkezi", needs: ["Zn"], weight: 2, note: "Yükü değişmez; suyu ve karbondioksiti etkinleştiren asit merkezi olarak çalışır.", ref: "Mulkidjanian 2009, Biol. Direct 4:26" },
  { id: "molybdenum", name: "Molibden merkezi", needs: ["Mo"], weight: 2, note: "Azotu ve nitratı işleyen enzimlerde iki elektronluk aktarım yapar.", ref: "Schwarz, Mendel & Ribbe 2009, Nature 460:839" },
  { id: "manganese", name: "Manganez kümesi", needs: ["Mn"], weight: 2, note: "Dört manganezli küme çözücüyü parçalayıp elektron koparabilir.", ref: "Umena, Kawakami, Shen & Kamiya 2011, Nature 473:55" },
  { id: "magnesium", name: "Magnezyum iyonu", needs: ["Mg"], weight: 2, note: "Fosfatlı molekülleri tutup katlar; katalitik polimerlerin çalışması için gerekir.", ref: "Bowman, Lenz, Hud & Williams 2012, Curr. Opin. Struct. Biol. 22:262" },
  { id: "organo", name: "Metalsiz organik katalizör", needs: [], weight: 0.5, note: "Metal yoktur; küçük organik moleküller ve polimer katlanması tepkimeleri hızlandırır.", ref: "Barbas 2008, Angew. Chem. Int. Ed. 47:42" },
];

export interface Pigment extends Option {
  /** Üreticilerin haritadaki rengi (ton). */
  hue: number;
}

export const PIGMENTS: Pigment[] = [
  { id: "mgporphyrin", name: "Magnezyum porfirin (klorofil benzeri)", needs: ["Mg", "C", "N"], hue: 105, weight: 4, note: "Dört azotun ortasında magnezyum; kırmızı ve maviyi soğurur, yeşili yansıtır.", ref: "Kiang ve ark. 2007, Astrobiology 7:222" },
  { id: "retinal", name: "Retinal benzeri polien", needs: ["C", "H"], hue: 300, weight: 3, note: "Almaşık çift bağlı zincir yeşili soğurur; üreticiler mor görünür.", ref: "DasSarma & Schwieterman 2021, Int. J. Astrobiol. 20:241" },
  { id: "znporphyrin", name: "Çinko porfirin", needs: ["Zn", "C", "N"], hue: 170, weight: 3, note: "Klorofilin çinkolu türevi; asitte magnezyumlu olandan kararlıdır.", ref: "Wakao ve ark. 1996, Plant Cell Physiol. 37:889" },
  { id: "feoxide", name: "Demir oksit yarıiletken tanecik", needs: ["Fe", "O"], hue: 18, weight: 2, note: "Pas rengi mineral tanecikleri ışıkla elektron koparır.", ref: "Lu ve ark. 2012, Nat. Commun. 3:768" },
  { id: "tio2", name: "Titanyum dioksit tanecik", needs: ["Ti", "O"], hue: 210, weight: 2, note: "Morötesi ışıkla uyarılan beyazımsı yarıiletken; yüzeyinde organik molekül indirger.", ref: "Saladino ve ark. 2003, ChemBioChem 4:514" },
  { id: "sulfurdot", name: "Kükürt halkalı boya", needs: ["S"], hue: 55, weight: 1.5, note: "Kükürt halkaları ve polisülfürler maviyi soğurur; sarı görünür.", ref: "Schulze-Makuch & Irwin 2008" },
  { id: "thermal", name: "Işıksız: kimyasal enerji", needs: [], hue: 20, weight: 0.4, note: "Işık toplayan boya yoktur; üreticiler çözünmüş kimyasallardan enerji alır.", ref: "Wächtershäuser 1988, Microbiol. Rev. 52:452" },
];

export type OriginScene = "vent" | "pool" | "sky" | "ice" | "space" | "mineral";

export interface Origin {
  id: string;
  name: string;
  ref: string;
  scene: OriginScene;
  /** Uygunluk ağırlığı: 0 ise bu gezegende olamaz. */
  fit: (c: ChemistryBase) => number;
  /** Dört adım: ortam, yapı taşları, bölme, ayakta kalış. `{sıvı}` çözücü adıyla değişir. */
  steps: [string, string, string, string];
  /** İlk hücrenin genlerine küçük çarpanlar. */
  founder: { radius?: number; moveSpeed?: number; senseRadius?: number; maxLifespan?: number; metabolism?: number };
}

const has = (c: ChemistryBase, ...syms: string[]): boolean => syms.every((s) => c.has.has(s));
const hot = (c: ChemistryBase): boolean => c.temperature > 300;
const cold = (c: ChemistryBase): boolean => c.temperature < 230;

export const ORIGINS: Origin[] = [
  { id: "alkaline_vent", name: "Alkali hidrotermal baca", ref: "Martin & Russell 2007, Phil. Trans. R. Soc. B 362:1887", scene: "vent", fit: (c) => (has(c, "Fe") || has(c, "Mg") ? 3 : 1), founder: { metabolism: 0.92, moveSpeed: 0.92 },
    steps: ["Deniz tabanında ılık, alkali akışkan gözenekli mineral bacalardan {sıvı} içine sızıyor.", "Bacanın ince duvarları iki farklı akışkanı ayırıyor; aradaki asitlik farkı doğal bir pil gibi çalışıp küçük organik molekülleri kuruyor.", "Moleküller gözeneklerde yoğunlaşıyor; gözenek duvarını zamanla canlının kendi {zar} yapısı kaplıyor.", "Kendi gradyanını üretebilen ilk bölme bacadan ayrılıyor: serbest yaşayan ilk hücre." ] },
  { id: "iron_sulfur", name: "Demir–kükürt dünyası", ref: "Wächtershäuser 1988, Microbiol. Rev. 52:452", scene: "vent", fit: (c) => (has(c, "Fe", "S") ? 4 : 0), founder: { metabolism: 1.06, maxLifespan: 0.94 },
    steps: ["Sıcak volkanik bacalar demir ve kükürt yüklü akışkan püskürtüyor.", "Pirit (FeS₂) oluşurken açığa çıkan enerji, mineral yüzeyine tutunmuş karbon bileşiklerini birbirine ekliyor: metabolizma kalıtımdan önce başlıyor.", "Yüzeydeki tepkime ağı kendi ürünleriyle hızlanıyor; ürünlerden {zar} oluşup ağı sarıyor.", "Mineral yüzeyinden kopan sarılı ağ, katalizörünü ({katalizör}) içinde taşıyarak yaşamayı sürdürüyor." ] },
  { id: "hot_spring", name: "Sıcak kaynak havuzu", ref: "Damer & Deamer 2020, Astrobiology 20:429", scene: "pool", fit: (c) => (hot(c) ? 3 : 1), founder: { radius: 1.06 },
    steps: ["Volkanik karada sığ {sıvı} havuzları ısınıp soğuyor, kuruyup yeniden doluyor.", "Her kuruyuşta moleküller havuz kenarında katman katman sıkışıp zincirlere eklenir; her ıslanışta zincirler keselerin içine hapsolur.", "Binlerce döngüde yalnızca içindekini koruyabilen keseler ({zar}) dağılmadan kalıyor.", "En dayanıklı kese havuzdan denize taşınıyor ve orada bölünmeye başlıyor." ] },
  { id: "primordial_soup", name: "İlkel çorba ve yıldırım", ref: "Miller 1953, Science 117:528", scene: "sky", fit: (c) => (has(c, "H") ? 2.5 : 0.5), founder: {},
    steps: ["Genç atmosferde fırtınalar dinmiyor; yıldırımlar gaz moleküllerini parçalıyor.", "Parçalar yeniden birleşip amino asit benzeri yapı taşlarına dönüşüyor ve yağışla {sıvı} denizine iniyor.", "Yapı taşları sığ kıyılarda birikiyor; yağımsı olanlar kendiliğinden {zar} kuruyor.", "İçine kopyalanabilen bir polimer ({genetik}) hapseden kese, ilk hücre oluyor." ] },
  { id: "rna_world", name: "Kendini kopyalayan polimer", ref: "Gilbert 1986, Nature 319:618", scene: "pool", fit: (c) => (c.genetic.shape === "helix" || c.genetic.shape === "ladder" ? 3 : 0), founder: { maxLifespan: 1.06 },
    steps: ["Sığ {sıvı} içinde kısa polimer zincirleri rastgele oluşup dağılıyor.", "Zincirlerden biri hem bilgi taşıyor hem de kendi kopyasının yapımını hızlandırıyor: {genetik}.", "Kopyalayıcı zincirler bir kesenin ({zar}) içine girince ürettiklerini rakiplerle paylaşmaz oluyor.", "İyi kopyalayan keseler çoğalıyor; seçilim başlıyor." ] },
  { id: "clay", name: "Kil şablonu", ref: "Cairns-Smith 1982; Ferris 2006, Phil. Trans. R. Soc. B 361:1777", scene: "mineral", fit: (c) => (has(c, "Si", "Al") ? 3 : has(c, "Si") ? 1 : 0), founder: { moveSpeed: 0.94, maxLifespan: 1.08 },
    steps: ["Kıyı çamurunda kil mineralleri tabaka tabaka büyüyor.", "Yüklü kil yüzeyleri yapı taşlarını sıraya dizip zincirlere bağlıyor; kilin kendi kusur deseni de tabakadan tabakaya kopyalanıyor.", "Kil taneleri {zar} oluşumunu da hızlandırıyor; keseler tanelerin çevresinde kuruluyor.", "Organik polimerler kilin işini devralıyor; kil iskele gibi geride kalıyor." ] },
  { id: "cyanosulfidic", name: "Siyanosülfidik kimya", ref: "Patel, Percivalle, Ritson, Duffy & Sutherland 2015, Nat. Chem. 7:301", scene: "pool", fit: (c) => (has(c, "C", "N", "S", "H") ? 3 : 0), founder: { senseRadius: 1.08 },
    steps: ["Göktaşı çarpmalarının ardından yüzeyde siyanür ve kükürt bileşikleri birikiyor.", "Yıldızın morötesi ışığı altında aynı basit karışım, kalıtım polimerinin, proteinlerin ve yağların öncüllerini birlikte veriyor.", "Akarsular bu öncülleri aynı havuza taşıyor; yağ öncüllerinden {zar} kuruluyor.", "Üç bileşeni bir arada tutan ilk bölme, parçalarını yenileyebildiği için kalıcı oluyor." ] },
  { id: "lipid_world", name: "Yağ dünyası", ref: "Segré, Ben-Eli, Deamer & Lancet 2001, Orig. Life Evol. Biosph. 31:119", scene: "pool", fit: (c) => (c.membrane.id !== "pore" ? 2 : 0), founder: { radius: 1.08, metabolism: 0.95 },
    steps: ["{sıvı} yüzeyinde yağımsı moleküller ince bir film oluşturuyor.", "Dalgalar filmi kırıp keselere ayırıyor; her kese içindeki molekül karışımını büyüyüp bölünürken yavrularına aktarıyor.", "Kendi yapı taşlarının üretimini hızlandıran karışımlar daha hızlı büyüyor: {zar}.", "Dizili bir polimer ({genetik}) sonradan eklenip bu bileşimsel kalıtımı devralıyor." ] },
  { id: "panspermia", name: "Göktaşı organikleri", ref: "Pizzarello & Shock 2010, Cold Spring Harb. Perspect. Biol. 2:a002105", scene: "space", fit: () => 1.5, founder: { senseRadius: 0.94, maxLifespan: 1.06 },
    steps: ["Genç gezegen karbonlu göktaşlarının yağmuru altında.", "Göktaşları uzayda oluşmuş amino asitleri, şekerleri ve yağımsı molekülleri yüzeye taşıyor.", "{sıvı} ile buluşan yağımsı moleküller kendiliğinden {zar} kuruyor; gökten gelen yapı taşları içlerinde birikiyor.", "Hazır malzemeyi kullanabilen ilk kese, malzeme tükenmeden kendi üretimini kurmayı başarıyor." ] },
  { id: "ice", name: "Buz damarları", ref: "Trinks, Schröder & Biebricher 2005, Orig. Life Evol. Biosph. 35:429", scene: "ice", fit: (c) => (cold(c) ? 4 : 0.3), founder: { metabolism: 0.9, moveSpeed: 0.9, maxLifespan: 1.12 },
    steps: ["Donmuş yüzeyin kristalleri arasında incecik sıvı {sıvı} damarları kalıyor.", "Donma, çözünmüş molekülleri bu damarlara sıkıştırıyor; soğuk, zincirlerin parçalanmasını yavaşlatırken uzamasına izin veriyor.", "Damarlar doğal bölmeler gibi çalışıyor; içlerinde {zar} olgunlaşıyor.", "Erime dönemlerinde bölmeler serbest kalıyor; soğuğa uyumlu, yavaş ama uzun ömürlü ilk hücre." ] },
  { id: "pah_world", name: "Halkalı karbon (PAH) dünyası", ref: "Ehrenfreund, Rasmussen, Cleaves & Chen 2006, Astrobiology 6:490", scene: "space", fit: (c) => (has(c, "C", "H") ? 2 : 0), founder: { senseRadius: 1.06 },
    steps: ["Yıldızlararası tozdan gelen düz, halkalı karbon molekülleri {sıvı} içinde birikiyor.", "Halkalar para gibi üst üste istifleniyor; istifin kenarına bazlar belli aralıklarla tutunuyor.", "İstif bir şablon olup bazları zincire bağlıyor; halkaların bir kısmı {zar} içine girip ışık soğuran ilk boya oluyor.", "Şablondan kurtulan zincir ({genetik}) kendi başına kopyalanmaya başlıyor." ] },
  { id: "thioester", name: "Tiyoester dünyası", ref: "de Duve 1991, Blueprint for a Cell", scene: "vent", fit: (c) => (has(c, "C", "S", "O") ? 2.5 : 0), founder: { metabolism: 1.05, moveSpeed: 1.05 },
    steps: ["Kükürtlü sıcak kaynakların çevresinde tiyoller ve organik asitler bir arada.", "Karbon–kükürt bağları (tiyoesterler) kendiliğinden oluşuyor ve enerjiyi bir tepkimeden ötekine taşıyor.", "Bu enerji parasıyla peptitler ve yağlar kuruluyor; yağlardan {zar} oluşuyor.", "Enerjisini tiyoesterle çeviren ilk bölme, fosfata gerek duymadan çoğalıyor." ] },
  { id: "zinc_world", name: "Çinko dünyası", ref: "Mulkidjanian 2009, Biol. Direct 4:26", scene: "mineral", fit: (c) => (has(c, "Zn", "S") ? 4 : 0), founder: { senseRadius: 1.1 },
    steps: ["Jeotermal alanlarda gözenekli çinko sülfür çökeltileri güneş alan sığlıkları kaplıyor.", "Çinko sülfür ışığı soğurup karbondioksiti organik moleküllere indirgiyor: mineral, ilk fotosentez yüzeyi.", "Ürünler gözeneklerde birikiyor; {zar} gözenek duvarının yerini alıyor.", "Işığa bağımlı doğan ilk hücre, ışığı algılayıp ona yönelmeye yatkın." ] },
  { id: "tidal", name: "Gelgit döngüsü", ref: "Lathe 2004, Icarus 168:18", scene: "pool", fit: () => 1.5, founder: { moveSpeed: 1.06 },
    steps: ["Yakın bir uydu, kıyıları birkaç saatte bir {sıvı} altında bırakıp yeniden açığa çıkarıyor.", "Çekilmede tuz derişimi artıyor ve zincirler eşleşip uzuyor; kabarmada seyreliyor ve eşler ayrılıyor: doğal bir kopyalama döngüsü.", "Her döngüde çoğalan zincirler ({genetik}) kıyı köpüğündeki keselere ({zar}) doluyor.", "Döngüye ayak uyduran keseler kıyıdan açığa yayılıyor." ] },
  { id: "radioactive_beach", name: "Radyoaktif kumsal", ref: "Adam 2007, Astrobiology 7:852", scene: "mineral", fit: () => 1, founder: { maxLifespan: 0.94, metabolism: 1.04 },
    steps: ["Gelgitler ağır, radyoaktif mineral tanelerini kumsalda yoğun şeritler hâlinde ayıklıyor.", "Işınım, çözücüdeki küçük molekülleri etkinleştirip amino asit ve şeker öncüllerine çeviriyor; aynı taneler fosfat da salıyor.", "Kum taneleri arasındaki boşluklarda öncüller birikiyor ve {zar} kuruluyor.", "Işınımın yol açtığı hasarı onarabilen ilk bölme hayatta kalıyor; değişinim hızı baştan yüksek." ] },
  { id: "coacervate", name: "Koaservat damlacıkları", ref: "Oparin 1938, The Origin of Life; Koga ve ark. 2011, Nat. Chem. 3:720", scene: "pool", fit: (c) => (c.solvent.polar ? 2 : 0.3), founder: { radius: 1.1, moveSpeed: 0.95 },
    steps: ["{sıvı} içinde zıt yüklü polimerler birbirini buluyor.", "Polimerler çözücüden ayrılıp yoğun, zarsız damlacıklar oluşturuyor; damlacıklar çevredeki molekülleri içine çekip derişik tutuyor.", "Damlacıkların yüzeyine yağımsı moleküller diziliyor: {zar}.", "İçeriğini yenileyip büyüdükçe bölünen damlacık, ilk hücreye dönüşüyor." ] },
  { id: "aerosol", name: "Deniz spreyi damlacıkları", ref: "Dobson, Ellison, Tuck & Vaida 2000, PNAS 97:11864", scene: "sky", fit: (c) => (c.membrane.id !== "pore" ? 1.5 : 0), founder: { radius: 0.92, moveSpeed: 1.06 },
    steps: ["Dalgalar {sıvı} yüzeyindeki yağımsı filmi kırıp havaya incecik damlacıklar savuruyor.", "Her damlacık tek katlı bir yağ zarıyla kaplı küçük bir tepkime kabı; havada kuruyup derişiyor, ışık altında içeriği tepkimeye giriyor.", "Damlacık denize geri düşerken yüzey filminden ikinci katı alıyor: çift katlı {zar}.", "Milyarlarca damlacıktan içeriği kendini kopyalayabileni kalıcı oluyor; küçük ve hareketli bir ilk hücre." ] },
  { id: "formamide", name: "Formamid havuzu", ref: "Saladino, Crestini, Pino, Costanzo & Di Mauro 2012, Phys. Life Rev. 9:84", scene: "mineral", fit: (c) => (c.solvent.id === "formamide" ? 5 : has(c, "C", "H", "N", "O") ? 1 : 0), founder: { maxLifespan: 1.05 },
    steps: ["Sıcak mineral yüzeylerinde formamid buharlaşıp derişiyor.", "Isı ve mineral katalizörlerle formamid, bazların ve amino asitlerin öncüllerine dönüşüyor; fosfatlı mineraller bunları zincire bağlıyor.", "Zincirler ({genetik}) formamid içinde suya göre daha uzun süre sağlam kalıyor; çevrelerinde {zar} kuruluyor.", "Zincirini parçalanmadan kopyalayabilen ilk bölme çoğalıyor." ] },
  { id: "impact_crater", name: "Çarpma krateri gölü", ref: "Osinski, Cockell, Pontefract & Sapers 2020, Astrobiology 20:1121", scene: "space", fit: () => 1.5, founder: { metabolism: 1.04 },
    steps: ["Büyük bir çarpma kabuğu eritiyor; krater {sıvı} ile doluyor.", "Çatlamış sıcak kayaçta binlerce yıl süren bir sıcak akışkan dolaşımı başlıyor; çarpmanın getirdiği organikler camsı, gözenekli kayaçta birikiyor.", "Kil ve cam gözeneklerinde yapı taşları zincirleniyor; {zar} gözenekleri kaplıyor.", "Krater soğurken ılık kıyıda tutunan ilk hücreler göle yayılıyor." ] },
  { id: "pumice", name: "Pomza salları", ref: "Brasier, Matthewman, McMahon & Wacey 2011, Astrobiology 11:725", scene: "mineral", fit: (c) => (has(c, "Si") ? 2 : 0.3), founder: { moveSpeed: 0.95, radius: 1.05 },
    steps: ["Volkanik patlamalar denize yüzen pomza taşları saçıyor.", "Pomzanın sayısız gözeneği yüzerken yağları, metalleri ve fosfatı emiyor; taş kıyıya vurup kuruyor, yeniden yüzüyor.", "Her gözenek ayrı bir deney kabı; birinde {zar} ve {genetik} bir araya geliyor.", "Gözenekten çıkan ilk hücre, salın taşıdığı her kıyıya yayılıyor." ] },
];

export interface ChemistryBase {
  seed: number;
  /** 10 element, paya göre azalan sırada (pay toplamı 1). */
  elements: { sym: string; share: number }[];
  has: Set<string>;
  temperature: number;
  solvent: Solvent;
  scaffold: Option;
  membrane: Option;
  wall: WallOption;
  genetic: GeneticOption;
  energy: Option;
  catalyst: Option;
  pigment: Pigment;
}

export interface Chemistry extends ChemistryBase {
  origin: Origin;
  /** Simülasyona etkiler: çözücünün sıcaklığı tepkime hızını, duvar bedeni belirler. */
  mods: { metabolism: number; speed: number; hp: number; plant: number; mutation: number };
  /** Arazi üretimi: dalga sıklığı, sıvı oranı aralığı, dağ payı, sırt genişliği. */
  terrain: { roughness: number; liquid: [number, number]; mountain: number; ridge: number; groundHue: number; groundSat: number };
  atmosphere: { gas: string; share: number }[];
}

const cache = new Map<number, Chemistry>();

export function generateChemistry(seedRaw: number): Chemistry {
  const seed = seedRaw >>> 0;
  const cached = cache.get(seed);
  if (cached) return cached;
  const r = makeRng(seed ^ 0x51ed270b);
  const pickWeighted = <T,>(items: T[], weight: (item: T) => number): T => {
    let total = 0;
    for (const item of items) total += weight(item);
    let roll = r.next() * total;
    for (const item of items) {
      roll -= weight(item);
      if (roll <= 0) return item;
    }
    return items[items.length - 1];
  };

  // 10 element: ağırlıklı, yinelemesiz çekiliş.
  const pool = Object.values(ELEMENTS);
  const chosen: ElementInfo[] = [];
  while (chosen.length < 10) {
    const e = pickWeighted(pool.filter((p) => !chosen.includes(p)), (p) => p.weight);
    chosen.push(e);
  }
  const hasAll = (needs: string[]): boolean => needs.every((s) => chosen.some((e) => e.sym === s));
  // Sıvısı ya da iskeleti olmayan gezegende yaşam kurulamaz: eksik element, en seyrek olanın yerine konur.
  const ensure = (needs: string[], keep: string[]): void => {
    for (const sym of needs) {
      if (chosen.some((e) => e.sym === sym)) continue;
      const replaceable = chosen.filter((e) => !needs.includes(e.sym) && !keep.includes(e.sym)).sort((a, b) => a.weight - b.weight);
      chosen[chosen.indexOf(replaceable[0])] = ELEMENTS[sym];
    }
  };
  if (!SOLVENTS.some((s) => hasAll(s.needs))) ensure(pickWeighted(SOLVENTS, (s) => s.weight ?? 1).needs, []);
  const solvent = pickWeighted(SOLVENTS.filter((s) => hasAll(s.needs)), (s) => s.weight ?? 1);
  if (!SCAFFOLDS.some((s) => hasAll(s.needs))) ensure(["C"], solvent.needs);
  const scaffold = pickWeighted(SCAFFOLDS.filter((s) => hasAll(s.needs)), (s) => s.weight ?? 1);

  const shares = chosen.map((e) => e.weight * (0.4 + r.next() * 1.6));
  const total = shares.reduce((a, b) => a + b, 0);
  const elements = chosen.map((e, i) => ({ sym: e.sym, share: shares[i] / total })).sort((a, b) => b.share - a.share);
  const has = new Set(elements.map((e) => e.sym));
  const temperature = Math.round(solvent.range[0] + (solvent.range[1] - solvent.range[0]) * (0.2 + r.next() * 0.6));

  const pick = <T extends Option>(options: T[], extra: (o: T) => boolean = () => true): T => {
    // Hidrojen evrenin en bol elementidir: on temel element arasında olmasa da iz
    // miktarda her gezegende bulunur, bu yüzden yapı seçiminde eksik sayılmaz.
    const fits = options.filter((o) => hasAll(o.needs.filter((n) => n !== "H")) && extra(o));
    return pickWeighted(fits.length > 0 ? fits : options.filter((o) => o.needs.length === 0), (o) => o.weight ?? 1);
  };
  const membrane = pick(MEMBRANES, (m) => (m.polar === null || m.polar === solvent.polar) && (m.scaffold === undefined || m.scaffold === scaffold.id || (scaffold.id === "boron" && m.scaffold === "carbon" && has.has("C"))));
  const wall = pick(WALLS);
  const genetic = pick(GENETICS, (g) => (scaffold.id === "silicon" ? g.id === "polysilane" || g.id === "clay" || g.id === "compositional" : g.id !== "polysilane"));
  const energy = pick(ENERGIES);
  const catalyst = pick(CATALYSTS);
  const pigment = pick(PIGMENTS);

  const base: ChemistryBase = { seed, elements, has, temperature, solvent, scaffold, membrane, wall, genetic, energy, catalyst, pigment };
  const origin = pickWeighted(ORIGINS, (o) => o.fit(base));

  // Sıcaklık tepkime hızını belirler (Arrhenius'un kabaca yönü): soğuk çözücüde yaşam
  // yavaş, sıcakta hızlıdır. Dengeyi bozmamak için etki ±%15 ile sınırlıdır.
  const heat = Math.max(-1, Math.min(1, (temperature - 290) / 200));
  const mods = {
    metabolism: (1 + heat * 0.13) * wall.meta,
    speed: (1 + heat * 0.1) * wall.speed,
    hp: wall.hp,
    plant: 1 + heat * 0.13,
    mutation: genetic.error,
  };

  const share = (sym: string): number => elements.find((e) => e.sym === sym)?.share ?? 0;
  const rocky = share("Si") + share("Fe") + share("Mg") + share("Al") + share("Ti") + share("Ca");
  const volatile = share("H") + share("O") + share("N") + share("C");
  const terrain = {
    roughness: 0.75 + rocky * 2.2 + r.next() * 0.35,
    liquid: [0.42 + Math.min(0.12, volatile * 0.2), 0.52 + Math.min(0.16, volatile * 0.3)] as [number, number],
    mountain: 0.955 - Math.min(0.05, rocky * 0.12),
    ridge: 0.06 + Math.min(0.1, rocky * 0.22),
    groundHue: has.has("Fe") && share("Fe") > 0.08 ? 16 : has.has("S") && share("S") > 0.1 ? 48 : has.has("Cu") ? 160 : has.has("Mn") ? 290 : has.has("Si") ? 35 : 220,
    groundSat: 0.1 + Math.min(0.25, (share("Fe") + share("S") + share("Cu") + share("Mn")) * 1.2),
  };

  const gases: [string, string[], number][] = [
    ["N₂", ["N"], 6],
    ["CO₂", ["C", "O"], 4],
    ["CH₄", ["C", "H"], 2],
    ["H₂", ["H"], 2],
    ["NH₃", ["N", "H"], 1.5],
    ["SO₂", ["S", "O"], 1.5],
    ["H₂S", ["H", "S"], 1],
    ["HCl", ["H", "Cl"], 0.8],
    ["HF", ["H", "F"], 0.5],
    ["O₂", ["O"], 0.4],
  ];
  const present = gases.filter(([, needs]) => hasAll(needs)).map(([gas, , w]) => ({ gas, share: w * (0.3 + r.next()) }));
  if (present.length === 0) present.push({ gas: "Ar", share: 1 });
  present.sort((a, b) => b.share - a.share);
  const top = present.slice(0, 4);
  const gasTotal = top.reduce((a, b) => a + b.share, 0);
  const atmosphere = top.map((g) => ({ gas: g.gas, share: g.share / gasTotal }));

  const chem: Chemistry = { ...base, origin, mods, terrain, atmosphere };
  if (cache.size > 64) cache.clear();
  cache.set(seed, chem);
  return chem;
}

/** Köken adımlarındaki yer tutucuları bu gezegenin kimyasıyla doldurur. */
export function originSteps(c: Chemistry): string[] {
  const lower = (s: string): string => s.toLocaleLowerCase("tr");
  return c.origin.steps.map((step) => {
    const text = step
      .replace(/\{sıvı\}/g, lower(c.solvent.sea))
      .replace(/\{zar\}/g, lower(c.membrane.name))
      .replace(/\{genetik\}/g, lower(c.genetic.name))
      .replace(/\{katalizör\}/g, lower(c.catalyst.name));
    return text.charAt(0).toLocaleUpperCase("tr") + text.slice(1);
  });
}
