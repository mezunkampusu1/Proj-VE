import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess, getDocumentAccessLevel } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { notifyDocumentUser } from "@/lib/document-notifications";

interface Params {
  params: Promise<{ documentId: string }>;
}

const schema = z.object({ userId: z.string() });

/**
 * POST: Doküman GÖVDESİNE bir `@` etiketlemesi eklendiğinde çağrılır
 * (bkz. document-mention.tsx → onMentionInserted). Etiketlenen kullanıcı
 * ekip üyesiyse bildirim gönderilir; dokümana erişimi YOKSA bildirim
 * gönderilmez ve `hasAccess: false` döner — istemci bunu anında bir
 * uyarı olarak gösterir (§11 "erişimi olmayan kullanıcı etiketlenirse
 * uyarı gösterilmeli").
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "COMMENTER");

    const { userId } = schema.parse(await req.json());
    if (userId === session.user.id) {
      return NextResponse.json({ hasAccess: true, selfMention: true });
    }

    const targetMembership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: workspace.id, userId } },
    });
    if (!targetMembership) {
      return NextResponse.json({ hasAccess: false, notMember: true });
    }

    const level = await getDocumentAccessLevel(userId, documentId);
    if (!level) {
      return NextResponse.json({ hasAccess: false });
    }

    const document = await prisma.document.findUnique({ where: { id: documentId }, select: { title: true } });
    await notifyDocumentUser({
      userId,
      title: "Bir dokümanda etiketlendiniz",
      message: `${session.user.name || session.user.email} sizi "${document?.title}" dokümanında etiketledi.`,
      link: `/ortak-alan/${documentId}`,
      type: "DOCUMENT_MENTIONED",
    });

    return NextResponse.json({ hasAccess: true });
  } catch (error) {
    return handleApiError(error);
  }
}
