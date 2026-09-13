import { SaveData, isValidSaveData } from "./savegame";

/**
 * Faz XI — Kaydet dosyasını dışa/içe aktarma (TASKS.md, Faz XI günlüğü aday havuzu:
 * "Kaydet/yükle: ... dışa/içe aktarma (JSON indir/yükle)"). Mevcut localStorage-tabanlı
 * otomatik kayıt/yükleme sistemine (Faz VI/VIII) HİÇ DOKUNULMADI — bu tamamen ek,
 * isteğe bağlı bir özellik. `isValidSaveData` (savegame.ts) buradaki içe aktarma için
 * YENİDEN KULLANILIYOR — "ya tam kabul ya tam red" felsefesi burada da geçerli.
 */

const EXPORT_FILENAME_PREFIX = "evrimsel-gezegen-kayit";

/** Mevcut `Ecosystem.serialize()` çıktısını (main.ts'te `{ version: SAVE_VERSION, ...snapshot }`
 *  olarak zaten kuruluyor) bir JSON dosyası olarak kullanıcının tarayıcısına indirir.
 *  Standart `Blob` + geçici `<a download>` linki tekniği — sunucuya hiçbir şey gitmiyor. */
export function exportSaveDataToFile(data: SaveData): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const a = document.createElement("a");
  a.href = url;
  a.download = `${EXPORT_FILENAME_PREFIX}-${timestamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Kullanıcının seçtiği bir `File`'ı okuyup doğrular. Mevcut `isValidSaveData`
 * (localStorage yüklemesiyle AYNI fonksiyon) ile "ya tam kabul ya tam red" doğrulaması
 * yapılır. localStorage'daki sessiz reddin aksine burada kullanıcı aktif bir eylem
 * yaptığı için çağıran taraf (main.ts) görünür bir hata mesajı gösterecek — bu
 * fonksiyon geçersiz/bozuk dosyada ASLA fırlatmaz (çökme yok), sadece `null` döner.
 */
export async function importSaveDataFromFile(file: File): Promise<SaveData | null> {
  try {
    const text = await file.text();
    const parsed: unknown = JSON.parse(text);
    return isValidSaveData(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
