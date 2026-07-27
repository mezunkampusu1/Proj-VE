"use client";

import { useEffect, useRef, useState } from "react";
import { Workbook } from "@fortune-sheet/react";
import type { WorkbookInstance } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import type { Sheet, Op } from "@fortune-sheet/core";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";

interface Props {
  documentId: string;
  teamId: string;
  initialContent: unknown;
  canEdit: boolean;
  currentUserId: string;
}

type SaveState = "idle" | "saving" | "saved" | "error";
type SyncState = "connected" | "connecting";

/** "Şu Anda Burada" listesi ve fortune-sheet'in yerleşik Presence API'sine
 * (addPresences/removePresences) beslenen canlı hücre imleci — bkz.
 * lib/spreadsheet-presence.ts ve /api/documents/[documentId]/spreadsheet-presence. */
interface PresenceEntry {
  userId: string;
  name: string;
  color: string;
  sheetId: string;
  row: number;
  column: number;
}

function createEmptySheet(): Sheet[] {
  return [{ id: "sheet1", name: "Sayfa1", row: 84, column: 26, status: 1, order: 0, celldata: [], config: {} }];
}

function isValidSheetArray(value: unknown): value is Sheet[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * GERÇEK KÖK NEDEN (görevlendirme #328/#329/#331 — "excele veri girdim,
 * başka girişte/F5'te tamamen boş görünüyor" / "hiçbirşeyi kaydetmiyor").
 *
 * fortune-sheet, bir sayfayı HER YENİ MOUNT'TA (F5, başka sekme, admin
 * girişi — hepsi Workbook bileşeninin sıfırdan kurulması demektir) sheet
 * verisini SADECE `celldata` (seyrek/sparse) alanından yeniden inşa eder
 * (bkz. node_modules/@fortune-sheet/react/dist/index.esm.js,
 * `initSheetData` fonksiyonu — paketin kendi kaynağı, düzenlenmedi).
 * Zaten dolu bir `.data` (yoğun/dense matris) varsa bile bunu YOK SAYAR ve
 * `celldata`'dan (boşsa BOŞ bir matrisle) yeniden oluşturur.
 *
 * Bizim `onChange` geri çağrısından aldığımız `Sheet[]` ise TAM OLARAK
 * `.data` dolu, `celldata` SİLİNMİŞ haldedir (fortune-sheet bunu kendi
 * hydration'ında yapar). Bu şekliyle OLDUĞU GİBİ veritabanına kaydedersek
 * doküman "zehirlenir": kayıt sunucuda başarıyla tamamlanır (hata YOKTUR,
 * "sessizce kaybediyor" hissi buradan gelir) ama dokümanın BİR SONRAKİ
 * açılışında fortune-sheet kendi `initSheetData`'sıyla `celldata`'yı arar,
 * bulamaz, `.data`'yı sıfırdan BOŞ bir matrisle değiştirir — kullanıcı
 * "az önce girdiğim onca veri nereye gitti" ile karşılaşır. Bu, önceki iki
 * "şüpheli boşaltmayı engelle" denemesinin (ikisi de yanlış pozitif verip
 * geri alındı) ASIL çözmesi gereken sorundu.
 *
 * Çözüm: kaydetmeden HEMEN önce, kütüphanenin KENDİ dışa açık
 * `dataToCelldata()` API'siyle (bkz. WorkbookInstance tipleri —
 * `getSheetWithLatestCelldata` iç fonksiyonunun yaptığıyla birebir aynı
 * dönüşüm) `.data`'yı tekrar `celldata`'ya çeviriyoruz; böylece
 * kaydedilen içerik, kütüphanenin bir SONRAKİ açılışta beklediği TAM
 * formatta olur.
 */
function toStorableSheets(sheets: Sheet[], workbook: WorkbookInstance): Sheet[] {
  return sheets.map((sheet) => {
    const sheetData = (sheet as { data?: unknown }).data;
    if (!sheetData) return sheet;
    const celldata = workbook.dataToCelldata(sheetData as Parameters<typeof workbook.dataToCelldata>[0]);
    const rest = { ...sheet } as Record<string, unknown>;
    delete rest.data;
    rest.celldata = celldata;
    return rest as Sheet;
  });
}

function presenceListsEqual(a: PresenceEntry[], b: PresenceEntry[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (x.userId !== y.userId || x.row !== y.row || x.column !== y.column || x.sheetId !== y.sheetId) return false;
  }
  return true;
}

/**
 * Excel türü dokümanlar için tablo editörü (§ Ortak Alan revizyonu:
 * "hepsi word formatı ... bana bir excel birde word formatı lazım").
 * Formül desteği (`=SUM()`, hücre referansları vb.) fortune-sheet'in kendi
 * hesaplama motorundan gelir, ekstra kod gerekmez.
 *
 * Kullanıcı talebi #16: "Excel formatında ortak çalışılmıyor ... o hızı
 * çözmen gerekiyor. ortak çalışmayı da [çözmen gerekiyor]" — Word'ün
 * Yjs/Hocuspocus CRDT altyapısının fortune-sheet karşılığı yok, bu yüzden
 * paketin KENDİ onOp/applyOp çifti kullanılıyor (bkz. prisma/schema.prisma
 * SpreadsheetOp yorumu — applyOp ham setContext kullanır, onOp'u yeniden
 * TETİKLEMEZ, dolayısıyla burada bir yankı/sonsuz döngü riski yoktur, bu
 * paket kaynağından doğrulanmıştır). Her yerel düzenleme küçük bir "op"
 * listesi üretir; bunlar POST ile sunucuya, oradan da ~1.5 sn'lik
 * yoklama (polling) ile diğer açık sekmelere yayılır — kanban panosunda
 * (kullanıcı talebi #7/#9) ve bildirimlerde zaten kullanılan "yoklamalı
 * gerçek zamanlılık" desenine bilinçli olarak sadık kalınmıştır (bu
 * projede genel bir WebSocket altyapısı yok, yalnızca Word editörü için
 * özel Hocuspocus servisi var).
 *
 * Kayıt yolu Word'den TAMAMEN FARKLI: Word içeriği collab-server'ın
 * onStoreDocument kancasından yazılır (bkz. collaborative-editor.tsx);
 * burada ise doğrudan `PATCH /api/documents/[id]` ile `content` alanına
 * debounce'lu olarak yazılır — bu debounce, "hız" şikayetine karşı 1.2
 * sn'den 600 ms'ye düşürüldü (bu, kalıcı anlık görüntüdür; canlı işbirliği
 * artık bu debounce'u BEKLEMEDEN op yayınıyla çalışır).
 *
 * Bug fix (kullanıcı talebi): "sürekli kaydediliyor diyip sürekli f5 atıyor
 * gibi oluyor, word'de bu sorun yok". Kök neden: uzaktan gelen işlemler
 * `workbookRef.current.applyOp(...)` ile uygulanınca fortune-sheet KENDİ
 * `onChange` olayını da tetikliyordu (yalnızca `onOp` değil) — `handleOp`
 * bu yankıyı `applyingRemoteOp` ile zaten engelliyordu ama `handleChange`
 * bu korumaya sahip DEĞİLDİ. Sonuç: başka biri her yazdığında (1.5 sn'lik
 * yoklamayla) yerel tarafta da sahte bir "değişiklik" algılanıp
 * "Kaydediliyor…" durumuna geçiliyor ve 600 ms sonra gereksiz bir PATCH
 * daha atılıyordu — sürekli tetiklenen bu döngü sayfanın kendi kendine
 * yenileniyormuş hissi veriyordu. `handleChange`'e de aynı
 * `applyingRemoteOp` koruması eklendi.
 */
export function SpreadsheetEditor({ documentId, teamId, initialContent, canEdit, currentUserId }: Props) {
  const [data] = useState<Sheet[]>(() =>
    isValidSheetArray(initialContent) ? (initialContent as Sheet[]) : createEmptySheet(),
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [syncState, setSyncState] = useState<SyncState>("connecting");
  const [presences, setPresences] = useState<PresenceEntry[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestData = useRef<Sheet[]>(data);
  const isFirstChange = useRef(true);
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const workbookRef = useRef<WorkbookInstance | null>(null);
  // fortune-sheet'in removePresences() çağrısı `username` bekliyor (bkz.
  // WorkbookInstance tipleri) — biri ayrıldığında hangi isimle eklendiğini
  // hatırlamak için son uygulanan presence listesi burada tutulur.
  const appliedPresences = useRef<Map<string, PresenceEntry>>(new Map());
  const lastBroadcastSelection = useRef<string>("");
  // Sahte "resize" olayı yayınlandıktan sonra fortune-sheet'in kendi iç
  // yeniden ölçüm/yeniden çizim tepkisini gerçek bir kullanıcı değişikliği
  // sanıp kayıt tetiklememek için kısa bir bastırma penceresi (bkz. aşağıdaki
  // ResizeObserver efekti ve handleChange).
  const suppressChangeUntil = useRef(0);
  // Bug fix (kullanıcı talebi: TAMAMEN BOŞ, hiç dokunulmamış bir dokümanda
  // bile "Kaydediliyor…" sürekli takılı kalıyordu — ekran görüntüsünde
  // "A1:NaN" gibi fortune-sheet'in kendi iç durumunda bir tuhaflık da
  // görülüyor). `isFirstChange` yalnızca EN İLK onChange çağrısını
  // atlıyordu; fortune-sheet boş bir sayfada kendi iç hazırlığı sırasında
  // (sütun genişliği hesaplama, stil ilklendirme vb.) birden fazla kez
  // onChange tetikleyebiliyor. Şimdi son kaydedilen içeriğin JSON izdüşümü
  // tutuluyor ve gerçekten DEĞİŞMEDİYSE (ne kadar çok kez onChange
  // tetiklenirse tetiklensin) kayıt asla başlatılmıyor — bu, nedeni ne
  // olursa olsun (hydration tuhaflığı, resize yankısı, remote-op yankısı)
  // "içerik hiç değişmemişken kaydediliyor" sınıfındaki TÜM hataları kapatan
  // genel bir güvenlik ağı.
  const lastSavedSnapshot = useRef<string>(JSON.stringify(data));

  // Kendi yayınladığımız işlemler geri poll ile döndüğünde (aynı kullanıcı
  // başka bir sekmede açıksa) yeniden uygulamayı önlemek için basit bir
  // koruma — sunucu zaten `userId != kendisi` filtresi uyguluyor (bkz.
  // spreadsheet-ops/route.ts), bu yalnızca ek bir güvenlik katmanıdır.
  const pendingOpBatch = useRef<Op[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sinceCursor = useRef<string>(new Date().toISOString());
  const applyingRemoteOp = useRef(false);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      // Sekmeden ayrılırken/bileşen kapanırken kendi imlecimizi en iyi çaba
      // ile hemen kaldır — atlanırsa sunucudaki TTL (bkz.
      // lib/spreadsheet-presence.ts) birkaç saniyede kendiliğinden temizler.
      fetch(`/api/documents/${documentId}/spreadsheet-presence`, {
        method: "DELETE",
        keepalive: true,
      }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Görevlendirme #328/#329 (veri kaybı raporu — "excele bir sürü veri
  // girdim, sonra tamamen boş görünüyor", sonra bunun için denenen
  // "şüpheli boşaltmayı engelle" güvenlik ağının GERÇEK kayıtları da
  // engellediği regresyonu): kaydı ENGELLEMEK güvenli biçimde
  // uygulanamadı, bu yüzden tamamen kaldırıldı (bkz. handleChange). Bunun
  // yerine veri kaybına karşı koruma artık dokümanı her AÇIŞTA, içeriği
  // anlamlı büyüklükteyse (boş/az veri içeren dokümanlar için gereksiz
  // sürüm çöplüğü oluşturmamak amacıyla >= 500 karakter JSON eşiği),
  // sessizce ve TEK SEFERLİK bir "Sürüm Geçmişi" anlık görüntüsü alarak
  // sağlanıyor — bu, hiçbir canlı kaydı DURDURMAZ, yalnızca EK bir yedek
  // oluşturur; sorun çıkarsa Sürüm Geçmişi'nden geri yüklenebilir.
  const autoSnapshotAttempted = useRef(false);
  useEffect(() => {
    if (autoSnapshotAttempted.current || !canEdit) return;
    autoSnapshotAttempted.current = true;
    let size = 0;
    try {
      size = JSON.stringify(data).length;
    } catch {
      return;
    }
    if (size < 500) return;
    const label = `Otomatik yedek — ${new Date().toLocaleString("tr-TR")}`;
    fetch(`/api/documents/${documentId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Yerel işlemleri kısa aralıklarla (400ms) toplu gönder — tuş başına bir
  // istek atmak yerine, kullanıcı yazarken üretilen ardışık op'ları
  // biriktirip tek seferde POST eder (§ "hız" şikayeti).
  const flushOps = async () => {
    if (pendingOpBatch.current.length === 0) return;
    const batch = pendingOpBatch.current;
    pendingOpBatch.current = [];
    try {
      await fetch(`/api/documents/${documentId}/spreadsheet-ops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ops: batch }),
      });
    } catch {
      // Sessizce yut — ops yalnızca canlı yayın için, kalıcı kayıt zaten
      // ayrı bir debounce'lu PATCH ile güvence altında (aşağıda).
    }
  };

  const handleOp = (ops: Op[]) => {
    if (applyingRemoteOp.current) return; // applyOp() kaynaklı değil (bkz. yukarıdaki yorum) ama yine de korumalı
    if (!canEdit || ops.length === 0) return;
    pendingOpBatch.current.push(...ops);
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flushOps, 400);
  };

  // Kullanıcı talebi: "Word'de kimin nerede yazdığını görebiliyorduk, isim
  // etiketi çıkıyordu — Excel'de de olur mu?". fortune-sheet'in KENDİ
  // Presence API'si var (addPresences/removePresences, bkz.
  // WorkbookInstance tipleri) — Word'ün Yjs "awareness"ının bir eşleniği,
  // yalnızca burada bir WebSocket yerine aynı ~1.5sn'lik yoklama ritmiyle
  // besleniyor: her tur kendi aktif hücremizi (varsa, değiştiyse) sunucuya
  // bildirir, diğer kullanıcıların en güncel konumlarını çeker ve
  // fortune-sheet'e uygular — sonuç, Word'dekine görsel olarak çok yakın
  // bir "kim nerede" deneyimi (yalnızca imleç sn'de bir kayıyor, her tuş
  // vuruşunda değil).
  const broadcastOwnSelection = () => {
    const sheetId = workbookRef.current?.getSheet()?.id;
    const selection = workbookRef.current?.getSelection();
    if (!sheetId || !selection || selection.length === 0) return;
    const row = selection[0].row[0];
    const column = selection[0].column[0];
    if (row === undefined || column === undefined) return;
    const key = `${sheetId}:${row}:${column}`;
    if (key === lastBroadcastSelection.current) return;
    lastBroadcastSelection.current = key;
    fetch(`/api/documents/${documentId}/spreadsheet-presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheetId, row, column }),
    }).catch(() => {});
  };

  const pollPresence = async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/spreadsheet-presence`);
      if (!res.ok) return;
      const json = await res.json();
      const list: PresenceEntry[] = json.presences ?? [];
      if (!workbookRef.current) return;

      const nextIds = new Set(list.map((p) => p.userId));
      const toRemove = Array.from(appliedPresences.current.values()).filter((p) => !nextIds.has(p.userId));
      if (toRemove.length > 0) {
        workbookRef.current.removePresences(toRemove.map((p) => ({ username: p.name, userId: p.userId })));
      }
      if (list.length > 0) {
        workbookRef.current.addPresences(
          list.map((p) => ({
            sheetId: p.sheetId,
            username: p.name,
            userId: p.userId,
            color: p.color,
            selection: { r: p.row, c: p.column },
          })),
        );
      }
      appliedPresences.current = new Map(list.map((p) => [p.userId, p]));
      // Bug fix (kullanıcı talebi: "excelde bir yere tıklayıp bir şey
      // yaptığımda en başa sürüklüyor"): burası ~1.5 sn'de bir KOŞULSUZ
      // `setPresences(list)` çağırıyordu — liste boş/aynı kalsa BİLE her
      // turda YENİ bir dizi referansı üretip SpreadsheetEditor'ı (ve onun
      // altındaki Workbook'u) gereksiz yere yeniden render ediyordu. Bu tek
      // başına fortune-sheet'in dahili kaydırma durumunu sıfırlamasa da,
      // araştırma sırasında tespit edilen tek KESİN gereksiz-render kaynağı
      // buydu — artık liste GERÇEKTEN değişmediyse state hiç güncellenmiyor.
      setPresences((prev) => (presenceListsEqual(prev, list) ? prev : list));
    } catch {
      // Sessizce yut — presence yalnızca görsel bir katman, kalıcı veri
      // değil; bir sonraki turda kendiliğinden düzelir.
    }
  };

  // Diğer kullanıcıların yayınladığı işlemleri yoklama (polling) ile çek ve
  // applyOp() ile yerel tabloya uygula — kanban panosunda kullanılan aynı
  // desen (setInterval + visibilitychange/focus, bkz. kanban-board.tsx).
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/documents/${documentId}/spreadsheet-ops?since=${encodeURIComponent(sinceCursor.current)}`,
        );
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setSyncState("connected");
        const remoteOps: { id: number; userId: string; ops: Op[] }[] = json.ops ?? [];
        if (remoteOps.length > 0 && workbookRef.current) {
          applyingRemoteOp.current = true;
          try {
            for (const entry of remoteOps) {
              if (entry.userId === currentUserId) continue;
              workbookRef.current.applyOp(entry.ops);
            }
          } finally {
            applyingRemoteOp.current = false;
          }
        }
        if (json.serverTime) sinceCursor.current = json.serverTime;
      } catch {
        if (!cancelled) setSyncState("connecting");
      }
      broadcastOwnSelection();
      await pollPresence();
    };

    poll();
    const interval = setInterval(poll, 1500);
    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", poll);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", poll);
    };
  }, [documentId, currentUserId]);

  // fortune-sheet, iç canvas'ını yalnızca `window`'un "resize" olayını
  // dinleyerek yeniden ölçer (bkz. paket kaynağı) — konteynerinin kendi
  // boyutu (panel açma/kapama, kenar çubuğu daralması, ilk yerleşim vb.)
  // değiştiğinde bundan haberi olmaz ve "boyutlanmamış" görünür (bkz.
  // kullanıcı ekran görüntüsü: sağ panel kayboluyor, tablo sol üstte küçük
  // kalıyor — manuel pencere boyutlandırmasına kadar). ResizeObserver ile
  // gerçek konteyner ölçüsü her değiştiğinde sahte bir "resize" olayı
  // tetiklenir; ilk yerleşimde de (mount anında) aynı sorun oluştuğu için
  // aynı efekt bir kerelik ek bir tetikleme de yapar.
  //
  // Bug fix (kullanıcı talebi: "hâlâ sürekli kaydediliyor/yeniliyor"):
  // ResizeObserver, tarayıcıya göre boyut GERÇEKTEN değişmese bile (ör.
  // ilk `observe()` çağrısında, ya da alt piksel yuvarlamalarında) tekrar
  // tetiklenebiliyor — önceki hâliyle bu her seferinde sahte bir "resize"
  // olayı yayıyordu, bu da fortune-sheet'in tuvalini durmadan yeniden
  // ölçüp yeniden çizmesine (dolayısıyla "sürekli yenileniyor" hissine ve
  // olası bir geri besleme döngüsüne) yol açabiliyordu. Artık yalnızca
  // ÖLÇÜ GERÇEKTEN değiştiğinde (1px'ten büyük fark) "resize" olayı
  // yayınlanıyor.
  useEffect(() => {
    const el = gridWrapperRef.current;
    if (!el) return;
    let raf = 0;
    let lastWidth = -1;
    let lastHeight = -1;
    // Bug fix (kullanıcı talebi: "excelde herhangi bir yere tıklayıp bir
    // şey yaptığımda / yazdığımda / G sütununa gittiğimde en başa
    // sürüklüyor"). Kök nedeni fortune-sheet'in kendi kaynağında (bkz.
    // node_modules/@fortune-sheet/core: scrollToHighlightCell) doğrulandı:
    // her hücre tıklaması/ok tuşu/yazma sonrası seçili hücreyi görünür
    // tutmak için kütüphane KENDİ `ctx.cellmainWidth`/`cellmainHeight`
    // (görünür tablo alanı ölçüsü) değerine göre kaydırma hesaplıyor. Bu
    // ölçü, aşağıdaki sahte "resize" olayı (bkz. görev #225 yorumu) her
    // dispatch edildiğinde `placeholder.clientWidth/Height`'tan YENİDEN
    // okunuyor — kullanıcı tam o an bir hücrede yazarken/düzenlerken bu
    // yeniden ölçüm araya girerse (özellikle formül çubuğu/araç çubuğu
    // içeriği yazarken küçük layout kaymalarına neden olabildiğinden),
    // kütüphanenin kaydırma hesaplaması geçici olarak yanlış bir ölçüyle
    // çalışıp seçili hücreyi (görsel olarak A1'e çok yakın bir konuma)
    // hatalı kaydırabiliyor. Artık kullanıcı bir hücrede AKTİF olarak
    // yazarken (fortune-sheet'in kendi contenteditable hücre girişi
    // odaktaysa) sahte resize dispatch'i ERTELENİYOR — düzenleme bitip
    // odak o alandan ayrılınca normal şekilde tetiklenir.
    const isEditingCell = () =>
      document.activeElement?.id === "luckysheet-rich-text-editor" ||
      document.activeElement?.classList.contains("luckysheet-cell-input");
    const nudge = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (isEditingCell()) return;
        suppressChangeUntil.current = Date.now() + 400;
        window.dispatchEvent(new Event("resize"));
      });
    };
    const maybeNudge = (width: number, height: number) => {
      if (Math.abs(width - lastWidth) < 1 && Math.abs(height - lastHeight) < 1) return;
      lastWidth = width;
      lastHeight = height;
      nudge();
    };
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) maybeNudge(box.width, box.height);
    });
    observer.observe(el);
    // İlk yerleşim: ölçü henüz bilinmediği için (lastWidth/lastHeight -1)
    // ilk ResizeObserver tetiklemesi zaten koşulsuz nudge() çağıracaktır;
    // yine de mount anındaki bilinen bir eski soruna karşı (bkz. yukarıdaki
    // yorum) bir kerelik ek bir "settle" tetiklemesi tutulur.
    const settleTimer = setTimeout(nudge, 300);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settleTimer);
      observer.disconnect();
    };
  }, []);

  // Bug fix (kullanıcı talebi): ekran görüntüsünde görülen üst üste
  // yığılmış "Doküman kaydedilemedi" bildirimleri — her başarısız kayıt
  // denemesinde YENİ bir toast açılıyordu; kayıt art arda birkaç kez
  // başarısız olunca (örn. sunucu birkaç saniyeliğine yeniden başlarken)
  // ekranda üst üste patlayan bildirimler "sürekli F5 atıyor gibi" bir
  // görsel kargaşa yaratıyordu. Artık SABİT bir toast id kullanılıyor
  // (sonner aynı id ile çağrıldığında yeni toast AÇMAZ, var olanı
  // günceller) ve başarısız kayıt kullanıcı beklemeden birkaç kez otomatik
  // yeniden denenir — geçici bir kesinti (örn. deploy sırasında konteynerin
  // birkaç saniyeliğine yeniden başlaması) kendiliğinden düzelir.
  const SAVE_TOAST_ID = "spreadsheet-save-error";
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  const pendingSnapshot = useRef<string>(lastSavedSnapshot.current);

  const performSave = async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: latestData.current }),
      });
      if (!res.ok) throw new Error();
      setSaveState("saved");
      retryCount.current = 0;
      lastSavedSnapshot.current = pendingSnapshot.current;
      toast.dismiss(SAVE_TOAST_ID);
    } catch {
      setSaveState("error");
      toast.error("Doküman kaydedilemedi, yeniden deneniyor…", { id: SAVE_TOAST_ID });
      // Üstel geri çekilme (3sn, 6sn, 12sn… en fazla 30sn) — kullanıcı bir
      // şey yapmasa bile geçici kesintiler kendi kendine toparlanır.
      if (retryCount.current < 5) {
        const delay = Math.min(3000 * 2 ** retryCount.current, 30000);
        retryCount.current += 1;
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(performSave, delay);
      }
    }
  };

  const scheduleSave = (next: Sheet[]) => {
    latestData.current = next;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryCount.current = 0;
    // "hız" şikayeti (kullanıcı talebi #16): kalıcı anlık görüntü kaydı
    // 1.2 sn yerine 600 ms sonra tetiklenir. Canlı işbirliği artık bu
    // debounce'u beklemeden op yayınıyla (handleOp/flushOps) çalıştığı
    // için bu süre yalnızca "diskteki son hâl"in tazeliğini etkiler.
    saveTimer.current = setTimeout(performSave, 600);
  };

  const handleChange = (next: Sheet[]) => {
    // fortune-sheet ilk render sırasında da onChange tetikleyebilir; içerik
    // gerçekte değişmediği için gereksiz bir kayıt turu atlanır.
    if (isFirstChange.current) {
      isFirstChange.current = false;
      return;
    }
    // Bug fix: applyOp() ile uzaktan gelen işlemleri uygularken fortune-sheet
    // bu onChange'i de tetikliyordu — kendi işlemimiz değilken kaydetme
    // döngüsüne girmeyi önler (bkz. dosya başındaki yorum).
    if (applyingRemoteOp.current) return;
    // Bug fix: sahte "resize" olayının hemen ardından gelen bir onChange,
    // kullanıcının gerçek bir değişikliği değil, fortune-sheet'in kendi
    // yeniden ölçüm tepkisi olabilir — kısa bastırma penceresi içindeyse
    // yok say (bkz. ResizeObserver efekti).
    if (Date.now() < suppressChangeUntil.current) return;
    if (!canEdit) return;
    // Görevlendirme #331 — GERÇEK kök neden burada düzeltildi: fortune-sheet
    // `.data` (yoğun) formatını bir SONRAKİ mount'ta YOK SAYIP `celldata`
    // (seyrek) formatından yeniden inşa ediyor (bkz. yukarıdaki
    // `toStorableSheets` yorumu). `next` (onChange'in verdiği ham hâl)
    // OLDUĞU GİBİ kaydedilirse doküman bir sonraki açılışta sessizce
    // boşalır — bu, iki kez yanlışlıkla "otomatik kayıt hatası" sanılan
    // asıl sorundu. Kaydetmeden önce her zaman `celldata`'ya çevriliyor.
    const storable = workbookRef.current ? toStorableSheets(next, workbookRef.current) : next;
    // Son güvenlik ağı: içerik son kaydedilenle GERÇEKTEN aynıysa (nedeni
    // ne olursa olsun — hydration, kütüphanenin kendi iç yeniden hesabı
    // vb.) kayıt turu hiç başlatılmaz (bkz. yukarıdaki `lastSavedSnapshot`
    // notu).
    const snapshot = JSON.stringify(storable);
    if (snapshot === lastSavedSnapshot.current) return;
    pendingSnapshot.current = snapshot;
    scheduleSave(storable);
  };

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <SaveStatusIndicator state={saveState} canEdit={canEdit} />
        <div className="flex items-center gap-3">
          <PresenceStack users={presences} />
          {canEdit && <SyncStatusIndicator state={syncState} />}
        </div>
      </div>
      <div ref={gridWrapperRef} style={{ height: "75vh", width: "100%" }} className="relative min-w-0 overflow-hidden">
        <Workbook
          ref={workbookRef}
          data={data}
          onChange={handleChange}
          onOp={handleOp}
          allowEdit={canEdit}
          showToolbar={canEdit}
          showFormulaBar={canEdit}
        />
      </div>
    </div>
  );
}

/** Word'deki (collaborative-editor.tsx) PresenceStack ile aynı görsel
 * desen — kullanıcı talebi: "Word'deki gibi olsun". */
function PresenceStack({ users }: { users: PresenceEntry[] }) {
  if (users.length === 0) {
    return <span className="text-xs text-muted-foreground">Şu anda burada yalnız çalışıyorsunuz</span>;
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Şu Anda Burada:</span>
      <div className="flex -space-x-2">
        {users.slice(0, 6).map((u) => (
          <div key={u.userId} title={u.name} style={{ boxShadow: `0 0 0 2px ${u.color}` }} className="rounded-full">
            <Avatar name={u.name} size={24} />
          </div>
        ))}
      </div>
      {users.length > 6 && <span className="text-xs text-muted-foreground">+{users.length - 6}</span>}
    </div>
  );
}

function SyncStatusIndicator({ state }: { state: SyncState }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-[11px] text-muted-foreground",
        state === "connecting" && "opacity-60",
      )}
      title={
        state === "connected"
          ? "Diğer kullanıcıların değişiklikleri anlık olarak yansıtılıyor"
          : "Canlı işbirliğine bağlanılıyor…"
      }
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", state === "connected" ? "bg-emerald-500" : "bg-amber-500")} />
      {state === "connected" ? "Ortak çalışma aktif" : "Bağlanıyor…"}
    </span>
  );
}

function SaveStatusIndicator({ state, canEdit }: { state: SaveState; canEdit: boolean }) {
  if (!canEdit) {
    return <span className="text-xs text-muted-foreground">Yalnızca görüntüleyebilirsiniz</span>;
  }
  const config: Record<SaveState, { label: string; dot: string }> = {
    idle: { label: "Tüm değişiklikler kaydedildi", dot: "bg-emerald-500" },
    saving: { label: "Kaydediliyor…", dot: "bg-amber-500" },
    saved: { label: "Tüm değişiklikler kaydedildi", dot: "bg-emerald-500" },
    error: { label: "Kaydedilemedi — yeniden deneniyor", dot: "bg-rose-500" },
  };
  const { label, dot } = config[state];
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {label}
    </div>
  );
}
