import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireTeamMember } from "@/lib/permissions";
import { requireDocumentAccess } from "@/lib/documents";
import { prisma } from "@/lib/prisma";
import { documentToHtml, type PMNode } from "@/lib/document-export";
import { documentStatusLabel } from "@/lib/utils";
import { PrintTrigger } from "@/components/ortak-alan/print-trigger";

interface PageProps {
  params: Promise<{ documentId: string }>;
}

/**
 * Yazdırma / PDF görünümü — AppShell'in DIŞINDA, ayrı bir route grubunda
 * (`(print)`) yaşar, böylece kenar çubuğu/üst bar gibi uygulama kabuğu
 * bileşenleri hiç render edilmez (bkz. print-trigger.tsx'teki PDF notu).
 */
export default async function DocumentPrintPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) notFound();
  const workspace = await getOrCreateWorkspaceTeam(session.user.id);
  await requireTeamMember(workspace.id, session.user.id);

  const { documentId } = await params;

  try {
    await requireDocumentAccess(documentId, session.user.id, "VIEWER");
  } catch {
    notFound();
  }

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      title: true,
      content: true,
      status: true,
      deletedAt: true,
      updatedAt: true,
      owner: { select: { name: true, email: true } },
    },
  });
  if (!document || document.deletedAt) notFound();

  const pmDoc = (document.content as PMNode | null) || { type: "doc", content: [] };
  const html = documentToHtml(pmDoc);

  return (
    <div className="mx-auto max-w-3xl px-8 py-10 print:max-w-none print:px-0 print:py-0">
      <PrintTrigger />
      <header className="mb-8 border-b border-border pb-4 print:border-black">
        <h1 className="text-2xl font-bold text-foreground">{document.title || "Adsız doküman"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {document.owner.name || document.owner.email} · {documentStatusLabel(document.status)} ·{" "}
          {new Date(document.updatedAt).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}
        </p>
      </header>
      <article
        className="prose-print max-w-none text-foreground [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:pl-6 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_pre]:rounded-md [&_pre]:bg-secondary [&_pre]:p-3"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
