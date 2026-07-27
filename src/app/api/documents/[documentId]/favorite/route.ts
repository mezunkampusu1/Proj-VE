import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";

interface Params {
  params: Promise<{ documentId: string }>;
}

/** POST: Dokümanı favorilere ekler (kişisel — yalnızca ekleyen kullanıcıyı etkiler, bkz. §18). */
export async function POST(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "VIEWER");

    await prisma.documentFavorite.upsert({
      where: { documentId_userId: { documentId, userId: session.user.id } },
      create: { documentId, userId: session.user.id },
      update: {},
    });

    return NextResponse.json({ isFavorite: true });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE: Dokümanı favorilerden çıkarır. */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    await requireDocumentAccess(documentId, session.user.id, "VIEWER");

    await prisma.documentFavorite.deleteMany({ where: { documentId, userId: session.user.id } });

    return NextResponse.json({ isFavorite: false });
  } catch (error) {
    return handleApiError(error);
  }
}
