import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamMember } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";

/** GET: Doküman türü referans listesi — tüm ekip üyeleri görebilir. */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamMember(workspace.id, session.user.id);

    const types = await prisma.documentType.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ types });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST: Devre dışı. Revizyon: "Döküman türlerinde hepsini kaldır 2 tane
 * olsun biri word formatı bir tanesi excel formatı" — tür artık yalnızca
 * bir etiket değil, editörün açılacağı BİÇİMİ de belirlediği için liste
 * sabit iki değerle (Word/Excel) sınırlandırıldı; serbestçe yeni tür
 * eklenmesi hem kafa karışıklığına hem de biçimi belirsiz dokümanlara yol
 * açardı (bkz. src/lib/document-format.ts).
 */
export async function POST() {
  return NextResponse.json(
    { error: "Doküman türü listesi Word ve Excel ile sabittir; yeni tür eklenemez." },
    { status: 400 },
  );
}
