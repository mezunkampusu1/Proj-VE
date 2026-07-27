import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamAdmin, NotFoundError } from "@/lib/permissions";
import { getOrCreateWorkspaceTeam } from "@/lib/workspace";
import { handleApiError, unauthorized } from "@/lib/api-helpers";
import { createDocumentTypeSchema } from "@/lib/validations";
import { slugify } from "@/lib/utils";

interface Params {
  params: Promise<{ typeId: string }>;
}

/**
 * PATCH: Doküman türünün adını değiştirir (yalnızca yönetici — §12/admin
 * paneli). Sistem varsayılanı türler de yeniden adlandırılabilir (yalnızca
 * silinemezler), slug isimle birlikte yeniden hesaplanır.
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const { typeId } = await params;
    const existing = await prisma.documentType.findUnique({ where: { id: typeId } });
    if (!existing) throw new NotFoundError("Doküman türü bulunamadı.");

    const body = await req.json();
    const data = createDocumentTypeSchema.parse(body);
    const slug = slugify(data.name);

    const conflict = await prisma.documentType.findUnique({ where: { slug } });
    if (conflict && conflict.id !== typeId) {
      return NextResponse.json({ error: "Bu isimde bir doküman türü zaten var." }, { status: 409 });
    }

    const type = await prisma.documentType.update({
      where: { id: typeId },
      data: { name: data.name, slug },
    });
    return NextResponse.json({ type });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE: Yalnızca sistem varsayılanı OLMAYAN türler silinebilir (isSystem
 * = false). Örnek listedeki 14 varsayılan tür (Genel Doküman, Toplantı
 * Notu, vb.) korunur; bu türü kullanan dokümanlar varsa typeId null'a
 * düşer (bkz. migration'daki ON DELETE SET NULL).
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const workspace = await getOrCreateWorkspaceTeam(session.user.id);
    await requireTeamAdmin(workspace.id, session.user.id);

    const { typeId } = await params;
    const type = await prisma.documentType.findUnique({ where: { id: typeId } });
    if (!type) throw new NotFoundError("Doküman türü bulunamadı.");
    if (type.isSystem) {
      return NextResponse.json({ error: "Sistem varsayılanı türler silinemez." }, { status: 400 });
    }

    await prisma.documentType.delete({ where: { id: typeId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
