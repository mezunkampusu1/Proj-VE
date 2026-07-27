import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireTeamMember } from "@/lib/permissions";
import { requireDocumentAccess } from "@/lib/documents";
import { prisma } from "@/lib/prisma";
import { DocumentEditorShell } from "@/components/ortak-alan/document-editor-shell";
import { getDocumentFormat } from "@/lib/document-format";

interface PageProps {
  params: Promise<{ documentId: string }>;
}

/**
 * Ortak Alan doküman ekranı. Yetki kontrolü burada (sunucu tarafında)
 * yapılır; erişimi olmayan bir kullanıcı dokümanın var olup olmadığını
 * bile öğrenemez (404) — spesifikasyonun "URL üzerinden yetkisiz erişim
 * kesinlikle engellenmelidir" gereksinimi.
 */
export default async function DocumentPage({ params }: PageProps) {
  const session = await auth();
  const workspace = await getOrCreateWorkspaceTeam(session!.user.id);
  const membership = await requireTeamMember(workspace.id, session!.user.id);

  const { documentId } = await params;

  let accessLevel;
  try {
    accessLevel = await requireDocumentAccess(documentId, session!.user.id, "VIEWER");
  } catch {
    notFound();
  }

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      title: true,
      content: true,
      status: true,
      typeId: true,
      folderId: true,
      ownerId: true,
      deletedAt: true,
      isTemplate: true,
      templateCategory: true,
      isSystemTemplate: true,
      isPinned: true,
      archivedAt: true,
      favorites: { where: { userId: session!.user.id }, select: { userId: true } },
    },
  });
  if (!document || document.deletedAt) notFound();

  return (
    <DocumentEditorShell
      documentId={document.id}
      teamId={workspace.id}
      initialTitle={document.title}
      initialContent={document.content}
      documentFormat={getDocumentFormat(document.typeId)}
      initialStatus={document.status}
      accessLevel={accessLevel!}
      isAdmin={membership.role === "ADMIN"}
      isTemplate={document.isTemplate}
      templateCategory={document.templateCategory}
      isSystemTemplate={document.isSystemTemplate}
      isPinned={document.isPinned}
      isArchived={!!document.archivedAt}
      isFavorite={document.favorites.length > 0}
      currentUser={{
        id: session!.user.id,
        name: session!.user.name || session!.user.email || "Kullanıcı",
        email: session!.user.email ?? null,
      }}
    />
  );
}
