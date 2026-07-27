"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Editor } from "@tiptap/react";
import { ArrowLeft, MessageSquare, History, PanelRightClose, PanelRightOpen, BadgeCheck } from "lucide-react";
import { CollaborativeEditor } from "@/components/ortak-alan/collaborative-editor";
import { SpreadsheetEditor } from "@/components/ortak-alan/spreadsheet-editor";
import { CommentsPanel } from "@/components/ortak-alan/comments-panel";
import { VersionHistoryPanel } from "@/components/ortak-alan/version-history-panel";
import { ApprovalPanel } from "@/components/ortak-alan/approval-panel";
import { TemplateSettings } from "@/components/ortak-alan/template-settings";
import { NotificationPreferences } from "@/components/ortak-alan/notification-preferences";
import { DocumentQuickActions } from "@/components/ortak-alan/document-quick-actions";
import { DocumentExportMenu } from "@/components/ortak-alan/document-export-menu";
import { ShareDialog } from "@/components/ortak-alan/share-dialog";
import { DuplicateButton } from "@/components/ortak-alan/duplicate-button";
import { Share2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { documentStatusLabel, documentAccessLevelLabel, cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  "DRAFT",
  "IN_PROGRESS",
  "IN_REVIEW",
  "BEING_REVISED",
  "PENDING_APPROVAL",
  "APPROVED",
  "READY_TO_PUBLISH",
  "COMPLETED",
  "ARCHIVED",
];

interface Props {
  documentId: string;
  teamId: string;
  initialTitle: string;
  initialContent: unknown;
  /** Word (zengin metin/Yjs) veya Excel (tablo/otomatik kayıt) — bkz.
   * src/lib/document-format.ts. */
  documentFormat: "WORD" | "EXCEL";
  initialStatus: string;
  accessLevel: "VIEWER" | "COMMENTER" | "EDITOR" | "OWNER";
  isAdmin: boolean;
  isTemplate: boolean;
  templateCategory: string | null;
  isSystemTemplate: boolean;
  isPinned: boolean;
  isArchived: boolean;
  isFavorite: boolean;
  currentUser: { id: string; name: string; email: string | null };
}

type RightTab = "comments" | "versions" | "approval";

/**
 * Doküman ekranının çerçevesi: üstte başlık + durum + geri dön, ortada
 * gerçek zamanlı editör, sağda açılıp kapanabilir sekmeli panel (Yorumlar /
 * Sürüm Geçmişi — §30 sabit ekran düzeni). Spesifikasyon gereği görünür
 * bir "Kaydet" düğmesi YOK — başlık değişikliği alan kaybettiğinde (blur)
 * otomatik kaydedilir, tıpkı içerik gibi.
 */
export function DocumentEditorShell({
  documentId,
  teamId,
  initialTitle,
  initialContent,
  documentFormat,
  initialStatus,
  accessLevel,
  isAdmin,
  isTemplate,
  templateCategory,
  isSystemTemplate,
  isPinned,
  isArchived,
  isFavorite,
  currentUser,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState(initialStatus);
  const [panelOpen, setPanelOpen] = useState(true);
  const [rightTab, setRightTab] = useState<RightTab>("comments");
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const canEdit = accessLevel === "EDITOR" || accessLevel === "OWNER";
  const canComment = canEdit || accessLevel === "COMMENTER";
  const lastSavedTitle = useRef(initialTitle);

  const saveTitle = async () => {
    if (title.trim() === lastSavedTitle.current || !title.trim()) {
      setTitle(lastSavedTitle.current);
      return;
    }
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!res.ok) throw new Error();
      lastSavedTitle.current = title.trim();
    } catch {
      toast.error("Doküman adı kaydedilemedi.");
      setTitle(lastSavedTitle.current);
    }
  };

  const changeStatus = async (newStatus: string) => {
    const previous = status;
    setStatus(newStatus);
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Durum güncellenemedi.");
      setStatus(previous);
    }
  };

  useEffect(() => setTitle(initialTitle), [initialTitle]);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/ortak-alan"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          {canEdit ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              className="min-w-0 flex-1 truncate rounded-lg bg-transparent px-1 text-xl font-semibold text-foreground outline-none focus:bg-accent"
              placeholder="Adsız doküman"
            />
          ) : (
            <h1 className="truncate text-xl font-semibold text-foreground">{title}</h1>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DocumentQuickActions
            documentId={documentId}
            initialIsFavorite={isFavorite}
            initialIsPinned={isPinned}
            initialIsArchived={isArchived}
            canPin={canEdit}
          />
          {canEdit ? (
            <Select value={status} onValueChange={changeStatus}>
              <SelectTrigger className="h-8 w-auto min-w-[9rem] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {documentStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              {documentStatusLabel(status)}
            </span>
          )}
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {documentAccessLevelLabel(accessLevel)}
          </span>
          <TemplateSettings
            documentId={documentId}
            isTemplate={isTemplate}
            templateCategory={templateCategory}
            isSystemTemplate={isSystemTemplate}
            isAdmin={isAdmin}
            canEdit={canEdit}
          />
          <NotificationPreferences />
          <DocumentExportMenu documentId={documentId} documentFormat={documentFormat} />
          <DuplicateButton documentId={documentId} />
          <button
            onClick={() => setShareOpen(true)}
            title="Paylaş"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setPanelOpen((v) => !v)}
            title={panelOpen ? "Paneli kapat" : "Paneli göster"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {panelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className={cn("grid gap-4", panelOpen ? "lg:grid-cols-[1fr_320px]" : "grid-cols-1")}>
        {documentFormat === "EXCEL" ? (
          <SpreadsheetEditor
            documentId={documentId}
            teamId={teamId}
            initialContent={initialContent}
            canEdit={canEdit}
            currentUserId={currentUser.id}
          />
        ) : (
          <CollaborativeEditor
            documentId={documentId}
            teamId={teamId}
            initialContent={initialContent}
            currentUser={currentUser}
            onEditorReady={setEditorInstance}
          />
        )}

        {panelOpen && (
          <div className="flex h-[75vh] flex-col rounded-2xl border border-border bg-card lg:sticky lg:top-20">
            <div className="flex border-b border-border">
              <button
                onClick={() => setRightTab("comments")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
                  rightTab === "comments" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Yorumlar
              </button>
              {documentFormat === "WORD" && (
                <button
                  onClick={() => setRightTab("versions")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
                    rightTab === "versions" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <History className="h-3.5 w-3.5" />
                  Sürüm Geçmişi
                </button>
              )}
              <button
                onClick={() => setRightTab("approval")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
                  rightTab === "approval" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <BadgeCheck className="h-3.5 w-3.5" />
                Onay
              </button>
            </div>
            <div className="min-h-0 flex-1">
              {rightTab === "comments" ? (
                <CommentsPanel
                  documentId={documentId}
                  teamId={teamId}
                  currentUserId={currentUser.id}
                  canComment={canComment}
                />
              ) : rightTab === "versions" ? (
                <VersionHistoryPanel documentId={documentId} editor={editorInstance} canEdit={canEdit} />
              ) : (
                <ApprovalPanel
                  documentId={documentId}
                  currentUserId={currentUser.id}
                  isAdmin={isAdmin}
                  canEdit={canEdit}
                  onDocumentStatusChanged={setStatus}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        documentId={documentId}
        teamId={teamId}
        canManage={canEdit}
      />
    </div>
  );
}
