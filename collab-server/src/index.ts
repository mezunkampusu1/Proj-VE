import { Hocuspocus } from "@hocuspocus/server";
import jwt from "jsonwebtoken";
import * as Y from "yjs";
import { yDocToProsemirrorJSON } from "y-prosemirror";
import {
  getAccessLevel,
  loadYjsState,
  saveYjsState,
  updateDocumentSnapshot,
  documentExistsAndNotDeleted,
  maybeCreateAutoSnapshot,
  pool,
} from "./db.js";
import { extractPlainText, countWordsAndChars } from "./prosemirror-text.js";

const COLLAB_SECRET = process.env.COLLAB_SECRET;
if (!COLLAB_SECRET) {
  throw new Error("COLLAB_SECRET ortam değişkeni tanımlı değil — collab servisi başlatılamaz.");
}

const PORT = Number(process.env.COLLAB_PORT || 1234);

// Tiptap'ın Collaboration eklentisinde varsayılan Y.XmlFragment alan adı.
// Editör (src/components/ortak-alan/collaborative-editor.tsx, henüz
// yazılmadı — bkz. görev #144) bu isimle uyumlu olmalıdır.
const PROSEMIRROR_FRAGMENT_FIELD = "default";

interface AuthContext {
  userId: string;
  level: "VIEWER" | "COMMENTER" | "EDITOR" | "OWNER";
}

const server = new Hocuspocus({
  port: PORT,
  timeout: 30000,

  async onAuthenticate(data) {
    const { token, documentName } = data;
    if (!token) throw new Error("Yetkilendirme jetonu eksik.");

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, COLLAB_SECRET!) as jwt.JwtPayload;
    } catch {
      throw new Error("Yetkilendirme jetonu geçersiz veya süresi dolmuş.");
    }

    const userId = payload.sub as string | undefined;
    if (!userId) throw new Error("Yetkilendirme jetonu geçersiz.");

    const exists = await documentExistsAndNotDeleted(documentName);
    if (!exists) throw new Error("Doküman bulunamadı.");

    const level = await getAccessLevel(userId, documentName);
    if (!level) {
      // Spesifikasyon gereği: açık yetki verilmemiş bir dokümana URL
      // üzerinden dahi erişim kesinlikle engellenmelidir.
      throw new Error("Bu dokümana erişim yetkiniz yok.");
    }

    // Yalnızca görüntüleme/yorum yetkisi olanlar belgeyi düzenleyemez;
    // Yjs bağlantısı salt-okunur işaretlenir (canlı imleç/awareness yine
    // çalışır, içerik güncellemeleri reddedilir).
    data.connection.readOnly = level === "VIEWER" || level === "COMMENTER";

    const context: AuthContext = { userId, level };
    return context;
  },

  async onLoadDocument(data) {
    const { documentName, document } = data;
    const state = await loadYjsState(documentName);
    if (state && state.length > 0) {
      Y.applyUpdate(document, state);
    }
    return document;
  },

  async onStoreDocument(data) {
    const { documentName, document, context } = data;
    const update = Y.encodeStateAsUpdate(document);
    await saveYjsState(documentName, Buffer.from(update));

    try {
      const json = yDocToProsemirrorJSON(document, PROSEMIRROR_FRAGMENT_FIELD);
      const text = extractPlainText(json);
      const { wordCount, charCount } = countWordsAndChars(text);
      const lastEditedById = (context as AuthContext | undefined)?.userId ?? null;
      await updateDocumentSnapshot(documentName, json, text, wordCount, charCount, lastEditedById);
      // Sürüm geçmişi (§8): anlamlı aralıklarla otomatik anlık görüntü.
      await maybeCreateAutoSnapshot(documentName, json, text, lastEditedById);
    } catch (err) {
      // İçerik özetleme (arama/kelime sayısı) başarısız olsa bile Yjs
      // durumu zaten kaydedildi — kullanıcı veri kaybetmez, yalnızca
      // arama indeksi bir sonraki başarılı kayda kadar güncel olmaz.
      console.error(`[collab] ${documentName} için doküman özeti güncellenemedi:`, err);
    }
  },

  async onDisconnect(data) {
    // Bağlantı sayısı 0'a düşünce Hocuspocus otomatik olarak
    // onStoreDocument'ı tetikler (debounce ayarına göre); burada ek bir
    // işlem gerekmiyor. İleride "Şu Anda Burada" listesinin sunucu
    // tarafında da izlenmesi istenirse bu hook genişletilebilir.
    void data;
  },
});

server.listen();

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});

console.log(`[collab] Ortak Alan gerçek zamanlı işbirliği servisi ${PORT} portunda dinliyor.`);
