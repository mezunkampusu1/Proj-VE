"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileType, FileSpreadsheet } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { WORD_DOCUMENT_TYPE_ID, EXCEL_DOCUMENT_TYPE_ID } from "@/lib/document-format";
import { toast } from "sonner";

interface MemberOption {
  id: string;
  name: string | null;
  email: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  folderId: string | null;
  teamId: string;
}

/**
 * Yeni doküman oluşturma akışı (§ ana ekran): Word/Excel biçimi seçilir
 * (bkz. src/lib/document-format.ts) ve kimlerin görebileceği belirlenir
 * (bkz. kullanıcı talebi #13: "kimler etiketlenmesi gerekiyor diye sor,
 * sadece o kişilere göster... etiketli değilse sadece kendine ortak alan
 * oluştursun"). Erişim modeli zaten bu davranışa göre kurulmuştu (bkz.
 * GET /api/documents "mine ∪ shared" varsayılan kapsamı ve
 * getDocumentAccessLevel — açık bir DocumentPermission olmayan bir
 * dokümanı sahibi ve admin dışında kimse göremiyordu); burada eklenen tek
 * şey, bu paylaşımı oluşturma anında sorup EDITOR düzeyinde
 * DocumentPermission satırları açması. "Başlangıç noktası" (şablondan
 * oluşturma) seçimi kaldırıldı (bkz. kullanıcı talebi #15).
 */
export function NewDocumentDialog({ open, onClose, folderId, teamId }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [typeId, setTypeId] = useState<string>(WORD_DOCUMENT_TYPE_ID);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [mentionedUserIds, setMentionedUserIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const isWord = typeId === WORD_DOCUMENT_TYPE_ID;

  useEffect(() => {
    if (!open) return;
    fetch(`/api/teams/${teamId}/members`)
      .then((r) => r.json())
      .then((json) => setMembers(json.members?.map((m: { user: MemberOption }) => m.user) ?? json.members ?? []))
      .catch(() => {});
  }, [open, teamId]);

  function toggleMember(userId: string) {
    setMentionedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          typeId,
          folderId,
          templateDocumentId: null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      const documentId: string = json.document.id;
      // Bkz. kullanıcı geri bildirimi: "birini ekleyemiyorum" — burada yetki
      // verme isteklerinin sonucu daha önce hiç kontrol edilmiyordu, biri
      // 400 dönse bile sessizce yutuluyor ve kullanıcı hiçbir şey fark
      // etmiyordu. Artık başarısız olanlar sayılıp toast ile bildiriliyor.
      const permissionResults = await Promise.all(
        Array.from(mentionedUserIds).map((userId) =>
          fetch(`/api/documents/${documentId}/permissions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subjectType: "USER", subjectUserId: userId, level: "EDITOR" }),
          }).then((r) => r.ok),
        ),
      );
      const failedCount = permissionResults.filter((ok) => !ok).length;
      if (failedCount > 0) {
        toast.error(
          failedCount === 1
            ? "Doküman oluşturuldu ama 1 kişi eklenemedi. Paylaş menüsünden tekrar deneyin."
            : `Doküman oluşturuldu ama ${failedCount} kişi eklenemedi. Paylaş menüsünden tekrar deneyin.`,
        );
      }

      router.push(`/ortak-alan/${documentId}`);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Doküman oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Yeni Doküman" wide>
      <div className="space-y-4">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Doküman adı" autoFocus />

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Doküman türü</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTypeId(WORD_DOCUMENT_TYPE_ID)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs",
                isWord ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-accent",
              )}
            >
              <FileType className="h-5 w-5" />
              Word (Zengin Metin)
            </button>
            <button
              onClick={() => setTypeId(EXCEL_DOCUMENT_TYPE_ID)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs",
                !isWord ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-accent",
              )}
            >
              <FileSpreadsheet className="h-5 w-5" />
              Excel (Tablo)
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Kişi Etiketle (opsiyonel)</p>
          <p className="text-xs text-muted-foreground">
            Seçilen kişiler dokümanı görüp düzenleyebilir. Kimse seçilmezse bu doküman yalnızca
            size görünür.
          </p>
          {members.length === 0 ? (
            <p className="text-xs text-muted-foreground">Ekipte başka üye yok.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {members.map((member) => {
                const active = mentionedUserIds.has(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleMember(member.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-foreground/80 hover:border-primary/50",
                    )}
                  >
                    <Avatar name={member.name} email={member.email} size={18} />
                    {member.name || member.email}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Button className="w-full" disabled={saving || !title.trim()} onClick={submit}>
          Oluştur
        </Button>
      </div>
    </Modal>
  );
}
