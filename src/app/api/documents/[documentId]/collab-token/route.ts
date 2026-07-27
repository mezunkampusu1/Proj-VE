import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { requireTeamMember } from "@/lib/permissions";
import { requireDocumentAccess } from "@/lib/documents";
import { handleApiError, unauthorized } from "@/lib/api-helpers";

interface Params {
  params: Promise<{ documentId: string }>;
}

const COLLAB_SECRET = process.env.COLLAB_SECRET;

/**
 * GET: İstemcinin Hocuspocus servisine bağlanabilmesi için kısa ömürlü
 * (5 dakika) imzalı bir jeton üretir. Yetki kontrolü BURADA (Next.js
 * tarafında) yapılır; collab servisi de kendi tarafında BAĞIMSIZ olarak
 * aynı kontrolü tekrarlar (bkz. collab-server/src/db.ts) — spesifikasyonun
 * "URL üzerinden yetkisiz erişim kesinlikle engellenmelidir" gereksinimi
 * için çift katmanlı savunma.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    if (!COLLAB_SECRET) {
      return NextResponse.json(
        { error: "Ortak Alan gerçek zamanlı servisi yapılandırılmamış (COLLAB_SECRET eksik)." },
        { status: 503 },
      );
    }

    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const { documentId } = await params;
    const level = await requireDocumentAccess(documentId, session.user.id, "VIEWER");

    const token = jwt.sign({ sub: session.user.id }, COLLAB_SECRET, { expiresIn: "5m" });

    return NextResponse.json({
      token,
      wsUrl: process.env.NEXT_PUBLIC_COLLAB_WS_URL || "ws://localhost:1234",
      documentId,
      level,
      user: {
        id: session.user.id,
        name: session.user.name || session.user.email || "Kullanıcı",
        email: session.user.email,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
