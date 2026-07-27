"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import { ResizableImage } from "@/components/ortak-alan/resizable-image";
import TaskList from "@tiptap/extension-task-list";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import type { Editor } from "@tiptap/react";
import { fetchCollabToken, colorForUserId, type CollabTokenResponse } from "@/lib/collab-client";
import { EditorToolbar } from "@/components/ortak-alan/editor-toolbar";
import { SlashCommand } from "@/components/ortak-alan/slash-command";
import { SuggestionInsert, SuggestionDelete } from "@/components/ortak-alan/suggestion-marks";
import { SuggestionMode, type PendingSuggestion } from "@/components/ortak-alan/suggestion-mode-extension";
import { SuggestionsPanel } from "@/components/ortak-alan/suggestions-panel";
import { LinkedTaskItem } from "@/components/ortak-alan/linked-task-item";
import { ChecklistTaskLinker } from "@/components/ortak-alan/checklist-task-linker";
import { createDocumentMentionExtension } from "@/components/ortak-alan/document-mention";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { TeamMemberOption } from "@/components/kanban/types";
import styles from "./editor.module.css";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface PresenceUser {
  clientId: number;
  id: string;
  name: string;
  color: string;
}

interface CollaborativeEditorProps {
  documentId: string;
  teamId: string;
  initialContent: unknown;
  currentUser: { id: string; name: string; email: string | null };
  /** Doküman meta verisi güncellendiğinde (örn. Şu Anda Burada listesi
   * dışarıda da gösterilecekse) üst bileşene haber verir. */
  onAccessLevelResolved?: (level: CollabTokenResponse["level"]) => void;
  /** Sürüm geri yükleme gibi işlemler için Tiptap editör örneğini üst
   * bileşene açar (bkz. document-editor-shell.tsx → VersionHistoryPanel). */
  onEditorReady?: (editor: Editor | null) => void;
}

/**
 * Ortak Alan'ın kalbi: Yjs + Hocuspocus ile gerçek zamanlı ortak
 * düzenleme. Basitleştirme notu (kullanıcıya açıkça belirtilmiştir):
 * yeni/şablondan oluşturulan dokümanların başlangıç içeriği ayrı bir
 * `documents.content` JSON alanında tutulur; bu bileşen, Yjs belgesi
 * BOŞ olduğunda ve `initialContent` doluysa, ilk senkronizasyonda
 * içeriği bir kerelik olarak Yjs belgesine yazar (aşağıdaki seedInitialContent
 * useEffect'i). Böylece collab servisinin ProseMirror şemasını
 * tekrar üretmesine gerek kalmaz.
 *
 * Çevrimdışı dayanıklılık: y-indexeddb ile Yjs belgesi tarayıcıda yerel
 * olarak da saklanır — ağ bağlantısı kesilse, sekme kapansa veya sayfa
 * yenilense bile yazılan hiçbir karakter kaybolmaz; bağlantı geri
 * geldiğinde CRDT birleştirmesi otomatik ve çakışmasız gerçekleşir.
 */
export function CollaborativeEditor({
  documentId,
  teamId,
  initialContent,
  currentUser,
  onAccessLevelResolved,
  onEditorReady,
}: CollaborativeEditorProps) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const statusRef = useRef<ConnectionStatus>("connecting");
  const [accessLevel, setAccessLevel] = useState<CollabTokenResponse["level"] | null>(null);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [suggestionModeActive, setSuggestionModeActive] = useState(false);
  const [members, setMembers] = useState<TeamMemberOption[]>([]);
  const membersRef = useRef<TeamMemberOption[]>([]);
  const seededRef = useRef(false);
  const lastCheckedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  useEffect(() => {
    fetch(`/api/teams/${teamId}/members`)
      .then((r) => r.json())
      .then((data) => {
        setMembers((data.members || []).map((m: { user: TeamMemberOption }) => m.user));
      })
      .catch(() => {});
  }, [teamId]);

  const handleMentionInserted = (userId: string, name: string) => {
    fetch(`/api/documents/${documentId}/mention-notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.hasAccess) {
          toast.warning(`${name} bu dokümana erişemiyor — etiketleme görünür ama bildirim alamaz.`);
        }
      })
      .catch(() => {});
  };

  const recordSuggestion = (documentIdArg: string, suggestion: PendingSuggestion) => {
    const isDelete = suggestion.type === "DELETE";
    fetch(`/api/documents/${documentIdArg}/suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: suggestion.suggestionId,
        type: suggestion.type,
        originalText: isDelete ? suggestion.text : undefined,
        suggestedText: isDelete ? undefined : suggestion.text,
      }),
    }).catch(() => {
      // Sessizce yut: mark zaten Yjs belgesine yazıldı (asıl kayıt orada) —
      // yalnızca Öneriler panelindeki metaveri kaydı başarısız oldu.
    });
  };

  const ydoc = useMemo(() => new Y.Doc(), [documentId]);

  // Jeton isteği (token) HocuspocusProvider tarafından her bağlantı/yeniden
  // bağlanma denemesinde ayrıca çağrılır (5 dakikalık kısa ömür nedeniyle);
  // WS adresi ise sabittir ve build-time NEXT_PUBLIC değişkeninden okunur —
  // bu yüzden provider, jeton yanıtını beklemeden hemen oluşturulabilir.
  const wsUrl = process.env.NEXT_PUBLIC_COLLAB_WS_URL || "ws://localhost:1234";

  const provider = useMemo(() => {
    return new HocuspocusProvider({
      url: wsUrl,
      name: documentId,
      document: ydoc,
      token: async () => (await fetchCollabToken(documentId)).token,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, ydoc, wsUrl]);

  useEffect(() => {
    let cancelled = false;
    const idb = new IndexeddbPersistence(`ortak-alan-${documentId}`, ydoc);

    fetchCollabToken(documentId)
      .then((res) => {
        if (cancelled) return;
        setAccessLevel(res.level);
        onAccessLevelResolved?.(res.level);
      })
      .catch((err) => {
        if (!cancelled) setTokenError(err.message || "Bağlantı kurulamadı.");
      });

    const onStatus = ({ status: s }: { status: ConnectionStatus }) => {
      statusRef.current = s;
      setStatus(s);
    };
    provider.on("status", onStatus);

    // Bağlantı kesikken sayfadan ayrılma uyarısı. Not: yazılan hiçbir
    // karakter gerçekte kaybolmaz (y-indexeddb ile yerel olarak zaten
    // saklanır ve bağlantı geri geldiğinde otomatik senkronize olur) —
    // ancak spesifikasyon açıkça bu uyarıyı istediği için (§ "sekme
    // kapatma sırasında uyarı") ek bir güvence katmanı olarak eklendi.
    // (statusRef kullanılır — closure'da state doğrudan okunursa efekt
    // yalnızca ilk kurulumdaki değeri görür.)
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (statusRef.current === "disconnected") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    const onAwarenessChange = () => {
      const states = provider.awareness?.getStates();
      if (!states) return;
      const users: PresenceUser[] = [];
      states.forEach((state, clientId) => {
        if (state?.user && clientId !== provider.awareness?.clientID) {
          users.push({ clientId, id: state.user.id, name: state.user.name, color: state.user.color });
        }
      });
      setPresence(users);
    };
    provider.awareness?.on("change", onAwarenessChange);

    return () => {
      cancelled = true;
      provider.awareness?.off("change", onAwarenessChange);
      provider.off("status", onStatus);
      window.removeEventListener("beforeunload", onBeforeUnload);
      provider.destroy();
      idb.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, ydoc, provider]);

  const editable = accessLevel === "EDITOR" || accessLevel === "OWNER";

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable,
      extensions: [
        StarterKit.configure({ history: false }),
        Collaboration.configure({ document: ydoc, field: "default" }),
        CollaborationCursor.configure({
          provider,
          user: { id: currentUser.id, name: currentUser.name, color: colorForUserId(currentUser.id) },
        }),
        Underline,
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        // Görüntüleyici/yorumcu (editable=false) için normal tık ile link
        // açılır. Düzenleyici (editable=true) için düz tık imleci
        // konumlandırmaya devam eder (yazarken yanlışlıkla sekme açılmasın
        // diye), Ctrl/Cmd+tık ile link yeni sekmede açılır — aşağıdaki
        // editorProps.handleClick bunu uygular (bkz. görev #189: linkler
        // hiçbir modda tıklanamıyordu, openOnClick her zaman false'tu).
        Link.configure({
          openOnClick: !editable,
          autolink: true,
          HTMLAttributes: {
            target: "_blank",
            rel: "noopener noreferrer nofollow",
            title: editable ? "Ctrl/Cmd + tık ile linki aç" : undefined,
          },
        }),
        ResizableImage,
        TaskList,
        LinkedTaskItem.configure({ nested: true }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        Placeholder.configure({ placeholder: "Yazmaya başlayın veya komut için “/” tuşuna basın…" }),
        CharacterCount,
        SlashCommand,
        SuggestionInsert,
        SuggestionDelete,
        SuggestionMode.configure({
          currentUser: { id: currentUser.id, name: currentUser.name },
          onSuggestionCreated: (s) => recordSuggestion(documentId, s),
        }),
        createDocumentMentionExtension(() => membersRef.current, handleMentionInserted),
      ],
      onUpdate: ({ editor: updatedEditor }) => {
        // Kontrol listesi ↔ görev senkronizasyonu (§7, doküman → görev
        // yönü). Bilinen basitleştirme: birden fazla kullanıcının aynı
        // dokümanı AÇIK tuttuğu anlarda, bir kutunun işaretlenmesi her
        // bağlı istemcide de bu callback'i tetikleyebilir — sonuç aynı
        // (idempotent) olduğu için zararsızdır, yalnızca fazladan bir
        // etkinlik kaydı oluşabilir.
        const current: Record<string, boolean> = {};
        updatedEditor.state.doc.descendants((node) => {
          if (node.type.name === "taskItem" && node.attrs.linkedTaskId) {
            current[node.attrs.linkedTaskId as string] = !!node.attrs.checked;
          }
        });
        const prev = lastCheckedRef.current;
        for (const [taskId, checked] of Object.entries(current)) {
          if (prev[taskId] !== undefined && prev[taskId] !== checked) {
            fetch(`/api/documents/${documentId}/checklist-tasks/${taskId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ checked }),
            }).catch(() => {});
          }
        }
        lastCheckedRef.current = current;
      },
      editorProps: {
        handleClick(view, pos, event) {
          // Düzenleme modunda düz tık yine imleci konumlandırsın; yalnızca
          // Ctrl/Cmd+tık linki yeni sekmede açsın (bkz. görev #189).
          if (!editable || !(event.metaKey || event.ctrlKey)) return false;
          const linkMarkType = view.state.schema.marks.link;
          if (!linkMarkType) return false;
          const mark = view.state.doc.resolve(pos).marks().find((m) => m.type === linkMarkType);
          const href = mark?.attrs?.href;
          if (typeof href === "string" && href) {
            window.open(href, "_blank", "noopener,noreferrer");
            return true;
          }
          return false;
        },
      },
    },
    [ydoc, provider, editable],
  );

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    onEditorReady?.(editor ?? null);
    return () => onEditorReady?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // İlk içerik ekimi: Yjs belgesi boşsa ve şablon/başlangıç içeriği varsa,
  // yalnızca bir kez editöre yazılır (bu yazma otomatik olarak Yjs
  // belgesine ve oradan da tüm bağlı istemcilere yayılır).
  useEffect(() => {
    if (!editor || seededRef.current || !editable) return;
    const onSynced = () => {
      if (seededRef.current) return;
      const fragment = ydoc.getXmlFragment("default");
      if (fragment.length === 0 && initialContent) {
        editor.commands.setContent(initialContent as never);
        seededRef.current = true;
      } else {
        seededRef.current = true;
      }
    };
    provider.on("synced", onSynced);
    return () => {
      provider.off("synced", onSynced);
    };
  }, [editor, provider, ydoc, initialContent, editable]);

  const words = editor?.storage.characterCount?.words?.() ?? 0;
  const chars = editor?.storage.characterCount?.characters?.() ?? 0;

  if (tokenError) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-border bg-card p-8 text-center">
        <div>
          <p className="font-medium text-foreground">Doküman açılamadı</p>
          <p className="mt-1 text-sm text-muted-foreground">{tokenError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <StatusIndicator status={status} />
        <div className="flex items-center gap-2">
          <PresenceStack users={presence} />
          {editable && editor && (
            <>
              <Button
                size="sm"
                variant={suggestionModeActive ? "primary" : "ghost"}
                onClick={() => {
                  const next = !suggestionModeActive;
                  setSuggestionModeActive(next);
                  editor.commands.setSuggestionModeActive(next);
                }}
                title="Öneri modu: yazdıklarınız ve sildikleriniz doğrudan uygulanmaz, öneri olarak işaretlenir"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                Öneri Modu
              </Button>
              <SuggestionsPanel editor={editor} documentId={documentId} />
              <ChecklistTaskLinker editor={editor} documentId={documentId} />
            </>
          )}
        </div>
      </div>

      {editable && editor && <EditorToolbar editor={editor} documentId={documentId} />}

      <div className={cn("px-6 py-4", styles.editorRoot)}>
        <EditorContent editor={editor} />
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <span>{words} kelime · {chars} karakter</span>
        {!editable && accessLevel && (
          <span>{accessLevel === "COMMENTER" ? "Yalnızca yorum yapabilirsiniz" : "Yalnızca görüntüleyebilirsiniz"}</span>
        )}
      </div>
    </div>
  );
}

function StatusIndicator({ status }: { status: ConnectionStatus }) {
  const config: Record<ConnectionStatus, { label: string; dot: string }> = {
    connecting: { label: "Bağlanıyor…", dot: "bg-amber-500" },
    connected: { label: "Tüm değişiklikler kaydedildi", dot: "bg-emerald-500" },
    disconnected: { label: "Çevrimdışı — değişiklikler yerelde saklanıyor", dot: "bg-rose-500" },
  };
  const { label, dot } = config[status];
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {label}
    </div>
  );
}

function PresenceStack({ users }: { users: PresenceUser[] }) {
  if (users.length === 0) {
    return <span className="text-xs text-muted-foreground">Şu anda burada yalnız çalışıyorsunuz</span>;
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Şu Anda Burada:</span>
      <div className="flex -space-x-2">
        {users.slice(0, 6).map((u) => (
          <div key={u.clientId} title={u.name} style={{ boxShadow: `0 0 0 2px ${u.color}` }} className="rounded-full">
            <Avatar name={u.name} size={24} />
          </div>
        ))}
      </div>
      {users.length > 6 && <span className="text-xs text-muted-foreground">+{users.length - 6}</span>}
    </div>
  );
}
